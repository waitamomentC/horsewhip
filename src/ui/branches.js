import { hw } from '../core/hw.js';

function branchSegmentByName(name) {
  return (hw.state.parsed?.branchSegments || []).find((s) => s.id === name || s.name === name);
}

function isMainBranchName(name) {
  return /^(main|master)$/i.test(String(name || '').trim());
}

function mainBranchName() {
  const cur = hw.state.currentGitBranch || '';
  if (hw.isMainBranchName(cur)) return cur;
  const list = hw.state.gitBranches || [];
  if (list.some((b) => b.name === 'main')) return 'main';
  if (list.some((b) => b.name === 'master')) return 'master';
  return 'main';
}

function filesForBranchSegment(seg) {
  const s = new Set();
  (seg?.commits || []).forEach((c) => (c.files || []).forEach((f) => s.add(f)));
  return [...s].sort((a, b) => a.localeCompare(b));
}

function fusionBoundaryFiles() {
  const files = new Set();
  hw.state.selectedBranchNames.forEach((name) => {
    hw.filesForBranchSegment(hw.branchSegmentByName(name)).forEach((f) => files.add(f));
  });
  return [...files].sort((a, b) => a.localeCompare(b));
}

function buildBranchFusionPrompt() {
  const names = [...hw.state.selectedBranchNames].sort((a, b) => a.localeCompare(b));
  if (names.length < 2) return '';
  const main = hw.mainBranchName();
  const parsed = hw.state.parsed;
  const blocks = names.map((name) => {
    const b = (hw.state.gitBranches || []).find((x) => x.name === name);
    const seg = hw.branchSegmentByName(name);
    const tip = b?.hash && parsed ? hw.resolveCommitHash(b.hash, parsed.commitMap) : null;
    const files = seg ? hw.filesForBranchSegment(seg) : [];
    const preview = files.length
      ? files.slice(0, 36).join(', ') + (files.length > 36 ? ` …+${files.length - 36}` : '')
      : '(log 中无路径记录，请 checkout 该分支后自行查看)';
    const status = seg?.merged ? '已合并过' : (seg?.continued ? '进行中' : '实验保留');
    return `- **${name}**（${status}）${tip ? `\n  tip commit: \`${tip.hash}\`` : ''}\n  涉及文件 ${files.length} 个：${preview}`;
  }).join('\n\n');

  const allFiles = hw.fusionBoundaryFiles();
  const fileScope = allFiles.length
    ? allFiles.join(', ')
    : '（请根据各分支 diff 自行确定）';

  return `【horsewhip · AI 多分支融合】

目标：以下 ${names.length} 条实验分支各自都有可取之处，请把它们**择优融合**回主泳道 **${main}**，形成一个新的统一版本；完成后我会在 horsewhip 主泳道上继续观察（本工具为 AI 边界收束，非 Git 拓扑图）。

待融合分支（请保留各分支上「还可以」的实现，不要简单用某一版全覆盖）：
${blocks}

主泳道：\`${main}\`（融合结果的落点）

允许修改的文件范围（各分支触及路径的并集）：
${fileScope}

禁止修改上述范围以外的文件；若必须扩展范围，请先说明理由并等待确认。

推荐流程：
1. \`git checkout ${main}\` 并确保工作区干净（或 stash）
2. 逐分支对比 diff（\`git diff ${main}..<branch>\` 或 checkout 查看），按文件择优合并
3. 解决冲突后提交一次清晰的 merge commit（说明融合了：${names.join('、')}）
4. 告知我刷新 Horsewhip；新 commit 应出现在主泳道时间轴上

融合原则：同一文件多处改动时，保留各分支优点并合成一致风格；不确定处列出选项让我确认。`;
}

function clearBranchFusionSelection() {
  if (hw.state.selectedBranchNames.size === 0) return;
  hw.state.selectedBranchNames.clear();
  hw.syncFuseBar();
  hw.renderBranchRail();
  if (hw.state.parsed) hw.scheduleRenderFromState();
}

function toggleBranchFusionPick(name) {
  if (hw.isMainBranchName(name)) return;
  if (hw.state.selectedBranchNames.has(name)) hw.state.selectedBranchNames.delete(name);
  else hw.state.selectedBranchNames.add(name);
  hw.state.highlightBranchName = name;
  hw.syncFuseBar();
  hw.renderBranchRail();
  hw.syncBranchLaneHighlight();
  if (hw.state.parsed) hw.scheduleRenderFromState();
}

function runFusionPulseAnim() {
  hw.playWhipCrackSound();
  const stage = hw.els.stage || document.getElementById('stage');
  stage?.classList.add('hw-fuse-pulse');
  setTimeout(() => stage?.classList.remove('hw-fuse-pulse'), 1500);
}

function crackWhipOnFusion(btnEl) {
  const text = hw.buildBranchFusionPrompt();
  if (!text) return;
  const crackTarget = btnEl?.closest?.('.hw-fuse-bar') || btnEl;
  crackTarget?.classList.add('hw-fuse-bar--crack');
  hw.runFusionPulseAnim();
  hw.copyText(text);
  hw.showCopyToast(`已复制 ${hw.state.selectedBranchNames.size} 条分支的融合任务 · 粘贴到 Chat`);
  setTimeout(() => crackTarget?.classList.remove('hw-fuse-bar--crack'), 520);
}

function insertBranchFusionToChat() {
  const text = hw.buildBranchFusionPrompt();
  if (!text) return;
  hw.runFusionPulseAnim();
  if (window.HorsewhipPluginBridge?.insertBoundaryToChat) {
    window.HorsewhipPluginBridge.insertBoundaryToChat(text);
  } else {
    hw.copyText(text, hw.els.btnFuseChat);
  }
}

function syncFuseBar() {
  if (!hw.BRANCH_FUSION_ENABLED || !hw.BRANCH_RAIL_ENABLED) {
    if (hw.state.selectedBranchNames.size) hw.state.selectedBranchNames.clear();
    if (hw.els.fuseBar) hw.els.fuseBar.hidden = true;
    return;
  }
  const n = hw.state.selectedBranchNames.size;
  const show = n >= 2;
  if (hw.els.fuseBar) hw.els.fuseBar.hidden = !show;
  if (hw.els.fuseCount) {
    hw.els.fuseCount.textContent = show ? `已选 ${n} 条分支` : '';
  }
  if (hw.els.fuseNames) {
    hw.els.fuseNames.textContent = show ? [...hw.state.selectedBranchNames].sort().join(' · ') : '';
    hw.els.fuseNames.title = show ? [...hw.state.selectedBranchNames].join('\n') : '';
  }
  if (hw.els.btnFuseCopy) hw.els.btnFuseCopy.disabled = !show;
  if (hw.els.btnFuseChat) hw.els.btnFuseChat.disabled = !show;

  if (show && hw.isPluginHost() && window.HorsewhipPluginBridge?.setBoundaryAllowlist) {
    // 融合预选 ≠ 挥鞭圈定，不得自动 locked
    window.HorsewhipPluginBridge.setBoundaryAllowlist([], false);
  } else if (!show && hw.isPluginHost()) {
    hw.syncBoundaryBar();
  }
}

function renderBranchRail() {
  const rail = hw.els.branchRail;
  if (!rail) return;
  rail.innerHTML = '';
  if (!hw.BRANCH_RAIL_ENABLED) {
    rail.hidden = true;
    hw.syncFuseBar();
    return;
  }
  const list = hw.state.gitBranches || [];
  if (!list.length) {
    rail.hidden = true;
    return;
  }
  rail.hidden = false;

  const title = document.createElement('div');
  title.className = 'hw-branch-rail__title';
  title.textContent = `分支 (${list.length})`;
  rail.appendChild(title);

  const hint = document.createElement('div');
  hint.className = 'hw-branch-rail__hint';
  hint.textContent = '点击勾选融合 · Shift+点击仅聚焦';
  rail.appendChild(hint);

  list.forEach((b) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'hw-branch-rail__item';
    const seg = hw.branchSegmentByName(b.name);
    const tip = b.hash && hw.state.parsed ? hw.resolveCommitHash(b.hash, hw.state.parsed.commitMap) : null;
    const isMain = hw.isMainBranchName(b.name);
    if (b.name === hw.state.currentGitBranch) row.classList.add('hw-branch-rail__item--current');
    if (b.name === hw.state.highlightBranchName) row.classList.add('hw-branch-rail__item--focus');
    if (hw.state.selectedBranchNames.has(b.name)) row.classList.add('hw-branch-rail__item--fuse-pick');
    if (!tip || seg?.outOfLog) row.classList.add('hw-branch-rail__item--muted');
    if (seg?.merged) row.classList.add('hw-branch-rail__item--merged');
    if (isMain) row.classList.add('hw-branch-rail__item--main');

    const check = document.createElement('span');
    check.className = 'hw-branch-rail__check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = hw.state.selectedBranchNames.has(b.name) ? '✓' : '';
    const label = document.createElement('span');
    label.className = 'hw-branch-rail__label';
    label.textContent = b.name;
    row.appendChild(check);
    row.appendChild(label);

    const status = seg?.merged ? '已合并' : (seg?.continued ? '进行中' : (seg?.outOfLog ? '未载入' : '活跃'));
    row.title = `${b.name}${b.hash ? `\n${b.hash.slice(0, 12)}` : ''}\n${status}${isMain ? '\n主泳道（融合目标）' : '\n点击：加入/取消融合 · Shift+点击：聚焦时间轴'}`;
    row.addEventListener('click', (e) => {
      if (e.shiftKey || isMain) {
        hw.focusGitBranch(b.name);
        return;
      }
      hw.toggleBranchFusionPick(b.name);
    });
    rail.appendChild(row);
  });
  hw.syncFuseBar();
}

function focusGitBranch(name) {
  hw.state.highlightBranchName = name;
  const b = (hw.state.gitBranches || []).find((x) => x.name === name);
  if (b?.hash && hw.state.parsed) {
    const tip = hw.resolveCommitHash(b.hash, hw.state.parsed.commitMap);
    if (tip) {
      hw.state.focusGraphX = tip.displayColumn ?? tip.versionIndex;
      hw.state.panX = null;
      hw.scheduleRenderFromState();
    }
  }
  hw.renderBranchRail();
  hw.syncBranchLaneHighlight();
}

function isLaneCurrentGitBranch(lane) {
  if (!lane?.isBranchLane || !lane.branchSegment) return false;
  const cur = String(hw.state.currentGitBranch || '').trim();
  if (!cur || hw.isMainBranchName(cur)) return false;
  return lane.branchSegment.name === cur;
}

function syncBranchLaneHighlight() {
  if (!hw.els.fileRailInner) return;
  const name = hw.state.highlightBranchName;
  const fuseSet = hw.state.selectedBranchNames;
  const cur = String(hw.state.currentGitBranch || '').trim();
  const showCurrent = cur && !hw.isMainBranchName(cur);
  hw.els.fileRailInner.querySelectorAll('.file-rail__item--branch').forEach((row) => {
    const branchName =
      row.dataset.branchName
      || (row.querySelector('.file-rail__label')?.textContent || '').replace(/^⎇\s*/, '').trim();
    const match = name && branchName === name;
    row.classList.toggle('file-rail__item--branch-focus', !!match);
    row.classList.toggle('file-rail__item--branch-fuse', fuseSet.size >= 2 && fuseSet.has(branchName));
    row.classList.toggle('file-rail__item--branch-current', showCurrent && branchName === cur);
  });
}

Object.assign(hw, {
  branchSegmentByName,
  isMainBranchName,
  mainBranchName,
  filesForBranchSegment,
  fusionBoundaryFiles,
  buildBranchFusionPrompt,
  clearBranchFusionSelection,
  toggleBranchFusionPick,
  runFusionPulseAnim,
  crackWhipOnFusion,
  insertBranchFusionToChat,
  syncFuseBar,
  renderBranchRail,
  focusGitBranch,
  isLaneCurrentGitBranch,
  syncBranchLaneHighlight,
});
