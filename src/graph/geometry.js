import { hw } from '../core/hw.js';

function curveBridge(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const bend = Math.max(6, Math.abs(dx) * 0.44);
  const cx1 = x1 + bend;
  const cx2 = x2 - bend;
  return `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
}

function curveSpoke(x1, y1, x2, y2) {
  const mx = x1 + (x2 - x1) * 0.58;
  if (Math.abs(y2 - y1) < 1) {
    const my = y1 - 3;
    return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
  }
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

function curveBus(x, yTop, yBot) {
  const mid = (yTop + yBot) / 2;
  const bow = Math.min(2, (yBot - yTop) * 0.05);
  return `M${x},${yTop} Q${x + bow},${mid} ${x},${yBot}`;
}

function laneLine(x1, y1, x2, y2) {
  return `M${x1},${y1} L${x2},${y2}`;
}

Object.assign(hw, {
  curveBridge,
  curveSpoke,
  curveBus,
  laneLine,
});
