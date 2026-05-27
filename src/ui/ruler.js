import { hw } from '../core/hw.js';

function shortenFolderLabel(label) {
  if (label === '(root)') return label;
  return label.endsWith('/') ? label : `${label}/`;
}

/** 顶部固定：C1/C2… 刻度（不随纵向滚动离开视口） */
function renderVersionRulerHeader(g) {
  const rh = hw.CONFIG.RULER_HEIGHT;
  const baseline = rh - 8;
  const parsed = hw.state.parsed;
  const headUploadIdx = hw.headUploadColumn(parsed);
  const loadedMaxCol = hw.maxLoadedUploadColumn(parsed);
  const pulseCol = hw.pulseColumn(parsed);
  const extent = hw.rulerExtent(parsed);
  const extendX = hw.versionColumnX(extent);
  const chromeG = g.append('g').attr('class', 'version-ruler');

  chromeG.append('rect')
    .attr('class', 'version-ruler__backdrop')
    .attr('x', -8000)
    .attr('y', 0)
    .attr('width', 16000)
    .attr('height', rh + 2)
    .attr('fill', 'var(--bg)');

  for (let v = 1; v <= extent; v += 1) {
    const vx = hw.versionColumnX(v);
    const uploadCommit = parsed ? hw.commitAtUploadColumn(parsed, v) : null;
    const isFuture = v > loadedMaxCol;
    const isLit = !!uploadCommit && !isFuture;
    const isHead = v === headUploadIdx;
    const isBranchOnly = isLit && uploadCommit && !uploadCommit.isMainline;

    chromeG.append('line')
      .attr('class', [
        'version-ruler__tick',
        isLit ? 'version-ruler__tick--lit' : '',
        isFuture ? 'version-ruler__tick--empty' : '',
      ].filter(Boolean).join(' '))
      .attr('x1', vx)
      .attr('x2', vx)
      .attr('y1', baseline - (isLit ? 6 : 3))
      .attr('y2', baseline + 1);

    chromeG.append('text')
      .attr('class', [
        'version-ruler__label',
        isLit ? 'version-ruler__label--lit' : 'version-ruler__label--future',
        isHead && isLit ? 'version-ruler__label--head' : '',
      ].filter(Boolean).join(' '))
      .attr('x', vx)
      .attr('y', baseline - 9)
      .attr('text-anchor', 'middle')
      .text(hw.PER_LANE_VERSION ? `C${v}` : `V${v}`);

    if (uploadCommit || isFuture) {
      chromeG.append('circle')
        .attr('class', [
          'version-ruler__dot',
          isLit ? 'version-ruler__dot--lit' : '',
          isHead && isLit ? 'version-ruler__dot--head' : '',
          isFuture ? 'version-ruler__dot--future' : '',
          isBranchOnly ? 'version-ruler__dot--branch' : '',
        ].filter(Boolean).join(' '))
        .attr('cx', vx)
        .attr('cy', baseline)
        .attr('r', isLit ? 2.2 : 1.4);
    }
  }

  chromeG.append('line')
    .attr('class', 'version-ruler__baseline')
    .attr('x1', hw.versionColumnX(1) - 8)
    .attr('x2', extendX + 8)
    .attr('y1', baseline)
    .attr('y2', baseline);

  if (headUploadIdx > 0) {
    chromeG.append('line')
      .attr('class', 'version-ruler__progress')
      .attr('x1', hw.versionColumnX(1))
      .attr('x2', hw.versionColumnX(headUploadIdx))
      .attr('y1', baseline)
      .attr('y2', baseline);
  }

  if (loadedMaxCol > headUploadIdx) {
    chromeG.append('line')
      .attr('class', 'version-ruler__progress version-ruler__progress--branch')
      .attr('x1', hw.versionColumnX(headUploadIdx))
      .attr('x2', hw.versionColumnX(loadedMaxCol))
      .attr('y1', baseline)
      .attr('y2', baseline);
  }

  chromeG.append('line')
    .attr('class', 'version-ruler__separator')
    .attr('x1', -16)
    .attr('x2', extendX + hw.CONFIG.VERSION_SPACING)
    .attr('y1', rh)
    .attr('y2', rh);

  const pulseV = Math.round(pulseCol);
  if (pulseV >= 1 && pulseV <= extent) {
    hw.appendRulerRipples(chromeG, hw.versionColumnX(pulseV), baseline);
  }
}

/** 随泳道纵向滚动：C 列淡竖线 */
function renderVersionRulerGrid(g, model, innerH) {
  const rh = hw.CONFIG.RULER_HEIGHT;
  const parsed = hw.state.parsed;
  const loadedMaxCol = hw.maxLoadedUploadColumn(parsed);
  const extent = hw.rulerExtent(parsed);
  const gridG = g.append('g').attr('class', 'version-ruler__grid');

  for (let v = 1; v <= extent; v += 1) {
    const vx = hw.versionColumnX(v);
    const uploadCommit = parsed ? hw.commitAtUploadColumn(parsed, v) : null;
    const isFuture = v > loadedMaxCol;
    const isLit = !!uploadCommit && !isFuture;

    gridG.append('line')
      .attr('class', `version-ruler__vline${isFuture ? ' version-ruler__vline--future' : ''}${isLit ? ' version-ruler__vline--lit' : ''}`)
      .attr('x1', vx)
      .attr('x2', vx)
      .attr('y1', rh)
      .attr('y2', innerH);
  }
}

function renderVersionRuler(g, model, innerH) {
  hw.renderVersionRulerHeader(g);
  hw.renderVersionRulerGrid(g, model, innerH);
}

function truncatePath(str) {
  if (str.length <= 44) return str;
  return '…' + str.slice(-43);
}

Object.assign(hw, {
  shortenFolderLabel,
  renderVersionRuler,
  renderVersionRulerHeader,
  renderVersionRulerGrid,
  truncatePath,
});
