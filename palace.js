// 로비 배경: 삼국시대 왕성(정전·누각·계단·깃발·등불)을 노을 아래 웅장하게 그린다. 그림 파일 없이 캔버스로.
(function (root) {
  function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  // 겹지붕 하나: 처마 끝이 위로 휘어 올라간다
  function roof(c, cx, y, w, h, col, edge) {
    c.beginPath();
    c.moveTo(cx - w / 2 - w * 0.06, y + h - h * 0.35);
    c.quadraticCurveTo(cx - w / 2 + w * 0.08, y + h, cx - w * 0.3, y + h * 0.92);
    c.lineTo(cx + w * 0.3, y + h * 0.92);
    c.quadraticCurveTo(cx + w / 2 - w * 0.08, y + h, cx + w / 2 + w * 0.06, y + h - h * 0.35);
    c.quadraticCurveTo(cx + w * 0.22, y + h * 0.18, cx + w * 0.12, y);
    c.lineTo(cx - w * 0.12, y);
    c.quadraticCurveTo(cx - w * 0.22, y + h * 0.18, cx - w / 2 - w * 0.06, y + h - h * 0.35);
    c.closePath(); c.fillStyle = col; c.fill();
    c.strokeStyle = edge; c.lineWidth = Math.max(1, h * 0.06); c.stroke();
    // 용마루 장식
    c.fillStyle = edge; c.fillRect(cx - w * 0.13, y - h * 0.08, w * 0.26, h * 0.1);
  }
  // 기둥 줄과 벽
  function hall(c, cx, y, w, h, wall, pillar, glow) {
    c.fillStyle = wall; c.fillRect(cx - w / 2, y, w, h);
    const n = Math.max(4, Math.round(w / (h * 0.45)));
    for (let i = 0; i <= n; i++) { const x = cx - w / 2 + (w * i) / n; c.fillStyle = pillar; c.fillRect(x - w * 0.012, y, w * 0.024, h); }
    // 문틈 불빛
    for (let i = 0; i < n; i++) { const x = cx - w / 2 + (w * (i + 0.5)) / n; const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, glow + '00'); g.addColorStop(1, glow + '88'); c.fillStyle = g; c.fillRect(x - w * 0.025, y + h * 0.35, w * 0.05, h * 0.65); }
  }
  function building(c, cx, base, w, tiers, sc, pal) {
    // 기단
    c.fillStyle = pal.stone; c.fillRect(cx - w * 0.62, base - sc * 0.18, w * 1.24, sc * 0.18);
    c.fillStyle = pal.stoneDark; c.fillRect(cx - w * 0.62, base - sc * 0.03, w * 1.24, sc * 0.03);
    let y = base - sc * 0.18;
    for (let t = 0; t < tiers; t++) {
      const k = 1 - t * 0.2, hw = w * k, hh = sc * 0.42 * k, rh = sc * 0.32 * k;
      hall(c, cx, y - hh, hw * 0.86, hh, pal.wall, pal.pillar, pal.glow);
      roof(c, cx, y - hh - rh * 0.78, hw * 1.12, rh, pal.roof, pal.roofEdge);
      y = y - hh - rh * 0.55;
    }
  }
  function paintPalace(cv) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, R = rnd(7);
    // 하늘: 노을
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a0f1c'); sky.addColorStop(0.35, '#4a2230'); sky.addColorStop(0.58, '#b8582c'); sky.addColorStop(0.7, '#e8a24a'); sky.addColorStop(1, '#2a1610');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    // 해
    const sun = c.createRadialGradient(W * 0.62, H * 0.6, 0, W * 0.62, H * 0.6, H * 0.5);
    sun.addColorStop(0, 'rgba(255,230,160,.9)'); sun.addColorStop(0.15, 'rgba(255,190,90,.5)'); sun.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = sun; c.fillRect(0, 0, W, H);
    // 구름 띠
    c.globalAlpha = 0.35;
    for (let i = 0; i < 9; i++) { const y = H * (0.12 + R() * 0.4), x = R() * W, w = W * (0.25 + R() * 0.3); c.fillStyle = i % 2 ? '#6a3040' : '#8a4a3a'; c.beginPath(); c.ellipse(x, y, w, H * 0.018, 0, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    // 먼 산
    [['#3a2230', 0.6, 0.08], ['#2c1a24', 0.66, 0.1]].forEach(([col, base, amp], j) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 40) c.lineTo(x, H * base - Math.abs(Math.sin(x / W * (5 + j * 3) + j)) * H * amp - R() * H * 0.02);
      c.lineTo(W, H); c.fill();
    });
    const pal = { stone: '#5a4a3e', stoneDark: '#2e241e', wall: '#3a1612', pillar: '#8a1e18', glow: '#ffb04a', roof: '#1c1a20', roofEdge: '#c8963c' };
    const base = H * 0.78, sc = H * 0.24;
    // 성벽
    c.fillStyle = '#3a2c26'; c.fillRect(0, base - sc * 0.32, W, sc * 0.32);
    c.fillStyle = '#4a3a30'; for (let x = 0; x < W; x += W / 60) c.fillRect(x, base - sc * 0.38, W / 120, sc * 0.08);
    // 좌우 누각(멀리)
    [[0.12, 0.7], [0.88, 0.7], [0.3, 0.8], [0.72, 0.8]].forEach(([fx, k]) => building(c, W * fx, base - sc * 0.3, W * 0.12 * k, 2, sc * k, pal));
    // 정전(가운데, 3층)
    building(c, W * 0.52, base - sc * 0.05, W * 0.26, 3, sc * 1.25, pal);
    // 정전 앞 큰 계단
    c.fillStyle = '#6a5848';
    for (let i = 0; i < 10; i++) { const y = base - sc * 0.05 + i * sc * 0.03, w = W * (0.1 + i * 0.012); c.fillRect(W * 0.52 - w / 2, y, w, sc * 0.028); }
    // 앞마당
    const yard = c.createLinearGradient(0, base, 0, H); yard.addColorStop(0, '#4a3a30'); yard.addColorStop(1, '#1a120e');
    c.fillStyle = yard; c.fillRect(0, base + sc * 0.25, W, H);
    // 깃발(붉은 군기)
    for (let i = 0; i < 12; i++) {
      const x = W * (0.04 + i * 0.083), y = base + sc * 0.2, ph = R() * 6;
      c.strokeStyle = '#2a1a10'; c.lineWidth = W * 0.003; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - sc * 0.9); c.stroke();
      c.fillStyle = i % 3 ? '#9a1c18' : '#c8963c';
      c.beginPath(); c.moveTo(x, y - sc * 0.88);
      for (let k = 0; k <= 6; k++) c.lineTo(x + W * 0.035 * (k / 6), y - sc * 0.88 + Math.sin(ph + k) * sc * 0.02);
      for (let k = 6; k >= 0; k--) c.lineTo(x + W * 0.035 * (k / 6), y - sc * 0.56 + Math.sin(ph + k) * sc * 0.02);
      c.closePath(); c.fill();
    }
    // 등불
    for (let i = 0; i < 10; i++) {
      const x = W * (0.08 + i * 0.094), y = base + sc * 0.12, g = c.createRadialGradient(x, y, 0, x, y, sc * 0.18);
      g.addColorStop(0, 'rgba(255,200,110,.9)'); g.addColorStop(0.25, 'rgba(255,140,60,.35)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.fillRect(x - sc * 0.2, y - sc * 0.2, sc * 0.4, sc * 0.4);
      c.fillStyle = '#e8402a'; c.fillRect(x - sc * 0.02, y - sc * 0.03, sc * 0.04, sc * 0.06);
    }
    // 아래·가장자리 어둡게
    const vg = c.createRadialGradient(W * 0.55, H * 0.55, H * 0.3, W * 0.55, H * 0.55, W * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,2,.75)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  // 생성 AI 등으로 만든 배경 그림(gfx/lobby_bg.jpg)이 있으면 그것을 화면에 꽉 차게 그린다
  const bgImg = typeof Image !== 'undefined' ? new Image() : null;
  let bgOk = false, bgBad = false, waiting = [];
  if (bgImg) { bgImg.onload = () => { bgOk = true; waiting.forEach(paint); waiting = []; }; bgImg.onerror = () => { bgBad = true; waiting = []; }; bgImg.src = 'gfx/lobby_bg.jpg?v=2'; }
  function paint(cv) {
    if (!bgOk && bgImg && bgImg.complete && bgImg.naturalWidth) bgOk = true; // 캐시에서 바로 받아져 onload보다 먼저 그려질 때
    if (bgOk) {
      const c = cv.getContext('2d'), W = cv.width, H = cv.height, k = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
      const w = bgImg.naturalWidth * k, h = bgImg.naturalHeight * k;
      c.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
      const vg = c.createRadialGradient(W * 0.55, H * 0.55, H * 0.3, W * 0.55, H * 0.55, W * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,2,.7)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
      return;
    }
    paintPalace(cv);
    if (bgImg && !bgBad && !waiting.includes(cv)) waiting.push(cv); // 그림이 늦게 받아지면 다시 칠한다
  }
  root.RTD_PALACE = { paint };
})(typeof window !== 'undefined' ? window : globalThis);
