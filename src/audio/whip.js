import { hw } from '../core/hw.js';

const WHIP_ICON_REV = '6';
let whipFloatNodesForCopy = null;

function ensureWhipAudioContext() {
  if (hw.whipAudioContext) return hw.whipAudioContext;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    hw.whipAudioContext = new Ctx();
  } catch {
    return null;
  }
  return hw.whipAudioContext;
}

function loadWhipSoundMuted() {
  try {
    return localStorage.getItem(hw.WHIP_SOUND_MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveWhipSoundMuted(muted) {
  try {
    localStorage.setItem(hw.WHIP_SOUND_MUTE_KEY, muted ? '1' : '0');
  } catch { /* ignore */ }
}

function getWhipCrackAudioUrl() {
  const meta = document.querySelector('meta[name="horsewhip-whip-audio"]');
  const url = meta?.getAttribute('content')?.trim();
  if (url) return url;
  if (hw.isPluginHost()) return 'media/whip.wav';
  return hw.WHIP_CRACK_AUDIO_DEFAULT;
}

function whipCrackAudioCandidates(primary) {
  const list = [primary];
  if (/^https?:/i.test(primary) || primary.includes('vscode-webview://')) return list;

  const stem = primary.replace(/\.(mp3|wav|ogg|m4a|webm)$/i, '');
  if (stem !== primary) {
    for (const ext of ['wav', 'mp3', 'ogg', 'm4a']) {
      const alt = `${stem}.${ext}`;
      if (!list.includes(alt)) list.push(alt);
    }
  } else if (!primary.includes('.')) {
    for (const ext of ['wav', 'mp3', 'ogg']) list.push(`${primary}.${ext}`);
  }
  const official = hw.isPluginHost()
    ? ['media/whip.wav', 'media/whip-crack.wav']
    : ['sound/whip.wav', 'media/whip.wav'];
  for (const p of official) {
    if (!list.includes(p)) list.push(p);
  }
  return list;
}

function loadWhipCrackAudio() {
  if (hw.whipCrackBuffer || hw.whipCrackUseSynth) return Promise.resolve();
  if (hw.whipCrackLoadPromise) return hw.whipCrackLoadPromise;
  hw.whipCrackLoadPromise = (async () => {
    const ctx = hw.ensureWhipAudioContext();
    if (!ctx) {
      hw.whipCrackUseSynth = true;
      return;
    }
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    for (const url of hw.whipCrackAudioCandidates(hw.getWhipCrackAudioUrl())) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        hw.whipCrackBuffer = await ctx.decodeAudioData(arr.slice(0));
        return;
      } catch { /* try next format */ }
    }
    hw.whipCrackUseSynth = true;
  })();
  return hw.whipCrackLoadPromise;
}

function playWhipCrackFromBuffer(ctx, buffer) {
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.72, now);
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(now);
  src.stop(now + buffer.duration);
}

function playWhipCrackSoundSynth(ctx) {
  const now = ctx.currentTime;
  const sampleRate = ctx.sampleRate;
  const crackDur = 0.045;
  const len = Math.floor(sampleRate * crackDur);
  const buf = ctx.createBuffer(1, len, sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 11);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3200;

  const peak = ctx.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = 5200;
  peak.Q.value = 1.6;
  peak.gain.value = 9;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.68, now);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + crackDur);

  noise.connect(hp);
  hp.connect(peak);
  peak.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + crackDur);

  const click = ctx.createOscillator();
  click.type = 'sine';
  click.frequency.setValueAtTime(3800, now);
  click.frequency.exponentialRampToValueAtTime(1800, now + 0.01);
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.1, now);
  clickGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.012);
  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  click.start(now);
  click.stop(now + 0.014);
}

function playWhipCrackSound() {
  if (hw.state.whipSoundMuted) return;
  const ctx = hw.ensureWhipAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  if (hw.whipCrackBuffer) {
    hw.playWhipCrackFromBuffer(ctx, hw.whipCrackBuffer);
    return;
  }
  if (hw.whipCrackUseSynth) {
    hw.playWhipCrackSoundSynth(ctx);
    return;
  }
  void hw.loadWhipCrackAudio().then(() => {
    if (hw.state.whipSoundMuted) return;
    const c = hw.ensureWhipAudioContext();
    if (!c) return;
    if (hw.whipCrackBuffer) hw.playWhipCrackFromBuffer(c, hw.whipCrackBuffer);
    else hw.playWhipCrackSoundSynth(c);
  });
}

function syncWhipSoundMuteButton() {
  const btn = hw.els.btnWhipSound;
  if (!btn) return;
  const muted = hw.state.whipSoundMuted;
  btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  btn.title = muted ? '开启挥鞭音效' : '关闭挥鞭音效';
  btn.setAttribute('aria-label', btn.title);
  btn.classList.toggle('hw-sound-btn--muted', muted);
  const on = btn.querySelector('.hw-sound__on');
  const off = btn.querySelector('.hw-sound__off');
  if (on) on.hidden = muted;
  if (off) off.hidden = !muted;
}

function toggleWhipSoundMute() {
  hw.state.whipSoundMuted = !hw.state.whipSoundMuted;
  hw.saveWhipSoundMuted(hw.state.whipSoundMuted);
  hw.syncWhipSoundMuteButton();
}

function whipIconSvgHtml(svgClass = 'hw-whip-btn__svg') {
  const large = svgClass === 'hw-whip-float__svg';
  const sparkR = large ? 2 : 1.35;
  const sparkCore = large ? 0.95 : 0.62;
  const gripRx = large ? 1.55 : 1.05;
  const gripRy = large ? 1.02 : 0.68;
  const edgeW = large ? 0.38 : 0.24;
  // Tapered lash: thick at handle (-5.5, 3.45) → hair-thin tip (~6.2, 0)
  return `<svg class="${svgClass}" viewBox="-8 -6 16 12" aria-hidden="true">
    <g class="hw-whip-icon__lash">
      <ellipse class="hw-whip-icon__grip" cx="-5.5" cy="3.45" rx="${gripRx}" ry="${gripRy}" fill="#92400e"/>
      <path fill="#f97316" d="M-6.5,2.45 C-3.55,0.75 1.25,-5.5 6.32,0.04 L6.02,0.2 C0.2,-4.05 -3.35,0.9 -4.48,4.22 Z"/>
      <path class="hw-whip-icon__lash-edge" fill="none" stroke="#c2410c" stroke-width="${edgeW}" stroke-linecap="round" d="M-6.5,2.45 C-3.55,0.75 1.25,-5.5 6.32,0.04"/>
    </g>
    <circle class="hw-whip-icon__spark" cx="6.18" cy="0.1" r="${sparkR}" fill="#fbbf24"/>
    <circle cx="6.18" cy="0.1" r="${sparkCore}" fill="#fef9c3"/>
  </svg>`;
}

function mountWhipIcon(host, svgClass) {
  if (!host) return;
  if (host.dataset.whipV === WHIP_ICON_REV && host.querySelector('.hw-whip-icon__lash')) return;
  host.dataset.whipV = WHIP_ICON_REV;
  host.querySelector('svg')?.remove();
  host.insertAdjacentHTML('beforeend', hw.whipIconSvgHtml(svgClass));
}

function ensureWhipFloatEl() {
  let el = document.getElementById('hw-whip-float');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hw-whip-float';
    el.className = 'hw-whip-float';
    el.hidden = true;
    el.innerHTML = `<button type="button" class="hw-whip-float__btn hw-whip-btn" aria-label="挥鞭上锁" title="挥鞭上锁"></button>`;
    el.querySelector('.hw-whip-float__btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hw.suppressOutsideClick = true;
      if (whipFloatNodesForCopy?.length) {
        hw.lockBoundaryFromSelection(whipFloatNodesForCopy, el);
      }
    });
    document.body.appendChild(el);
  }
  hw.mountWhipIcon(el.querySelector('.hw-whip-float__btn'), 'hw-whip-float__svg');
  return el;
}

function hideWhipFloat() {
  whipFloatNodesForCopy = null;
  const el = document.getElementById('hw-whip-float');
  if (el) {
    el.hidden = true;
    el.classList.remove('hw-whip-float--crack', 'hw-whip-btn--crack');
  }
}

/** 小马鞭浮在最后一次点击的节点旁（略偏右上，避免挡住节点）。 */
function positionWhipFloat(el, anchorNode) {
  if (!el || !anchorNode?.id) return;
  const hit = hw.findNodeGroupEl?.(anchorNode.id)?.querySelector('.node-hit');
  if (!hit) {
    el.style.left = '';
    el.style.top = '';
    el.style.transform = '';
    return;
  }
  const r = hit.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const offsetX = Math.max(44, r.width * 0.5 + 36);
  const offsetY = -Math.max(32, r.height * 0.5 + 28);
  const pad = 48;
  const x = Math.min(window.innerWidth - pad, Math.max(pad, cx + offsetX));
  const y = Math.min(window.innerHeight - pad, Math.max(pad, cy + offsetY));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.transform = 'translate(-50%, -50%)';
}

let whipFloatRepositionBound = false;

function bindWhipFloatReposition() {
  if (whipFloatRepositionBound) return;
  whipFloatRepositionBound = true;
  const reposition = () => {
    const el = document.getElementById('hw-whip-float');
    const anchor = hw.whipHostNode?.();
    if (!el || el.hidden || !anchor) return;
    hw.positionWhipFloat(el, anchor);
  };
  document.getElementById('graph-scroll')?.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition, { passive: true });
}

function showWhipFloat(anchorNode, nodesForCopy) {
  if (!nodesForCopy?.length) {
    hw.hideWhipFloat();
    return;
  }
  const el = hw.ensureWhipFloatEl();
  whipFloatNodesForCopy = nodesForCopy;
  el.hidden = false;
  const btn = el.querySelector('.hw-whip-float__btn');
  if (btn) {
    const relock = hw.isBoundaryLocked?.();
    const title = relock ? '重新挥鞭圈定（替换当前锁定）' : '挥鞭圈定（仅此范围可改）';
    btn.title = title;
    btn.setAttribute('aria-label', title);
  }
  hw.bindWhipFloatReposition();
  hw.positionWhipFloat(el, anchorNode || hw.whipHostNode?.());
}

Object.assign(hw, {
  ensureWhipAudioContext,
  loadWhipSoundMuted,
  saveWhipSoundMuted,
  getWhipCrackAudioUrl,
  whipCrackAudioCandidates,
  loadWhipCrackAudio,
  playWhipCrackFromBuffer,
  playWhipCrackSoundSynth,
  playWhipCrackSound,
  syncWhipSoundMuteButton,
  toggleWhipSoundMute,
  whipIconSvgHtml,
  mountWhipIcon,
  ensureWhipFloatEl,
  hideWhipFloat,
  showWhipFloat,
  positionWhipFloat,
  bindWhipFloatReposition,
});
