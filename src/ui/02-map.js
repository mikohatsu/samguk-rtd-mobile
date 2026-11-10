  // ---- 전장 배경: 먹으로 그린 군사 지도 ----
  const OVER = { x: 1200, y: 600 };
  function paintMap(c, w, h) {
    const sx = w / (W + OVER.x * 2), sy = h / (H + OVER.y * 2);
    c.save(); c.scale(sx, sy); c.translate(OVER.x, OVER.y);
    const grd = c.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#6f6a45'); grd.addColorStop(0.5, '#7d7349'); grd.addColorStop(1, '#5e5a3e');
    c.fillStyle = tilePat(c, 'tex_grass', 1.4, 'saturate(0.55) brightness(0.78)') || grd; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
    const fancy = !!Art.img('tex_grass');
    // 생성 풀밭은 채도가 높아 화면 톤에 맞게 살짝 누른다.
    // 필터를 그리기마다 걸면 그래픽 가속이 없는 PC에서 수십 초씩 멈추므로, 위에 얹는 것들은 따로 그린 뒤 필터를 한 번만 걸어 붙인다.
    const base = c;
    if (fancy) {
      c.fillStyle = 'rgba(40,36,18,.3)'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
      const lv = document.createElement('canvas'); lv.width = w; lv.height = h;
      c = lv.getContext('2d'); c.scale(sx, sy); c.translate(OVER.x, OVER.y);
    }
    let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '40,50,25' : '140,125,75'},${0.04 + r() * 0.07})`; c.beginPath(); c.ellipse(r() * (W + OVER.x * 2) - OVER.x, r() * (H + OVER.y * 2) - OVER.y, 40 + r() * 110, 18 + r() * 50, r() * 3, 0, 7); c.fill(); }
    // 강
    c.strokeStyle = tilePat(c, 'tex_water', 0.8) || '#4a7082'; c.lineWidth = 46; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-OVER.x, 760); c.lineTo(-20, 690); c.bezierCurveTo(330, 590, 450, 780, 680, 640); c.bezierCurveTo(880, 520, 1060, 680, W + 30, 510); c.lineTo(W + OVER.x, 420); c.stroke();
    c.strokeStyle = 'rgba(190,220,225,.25)'; c.lineWidth = 3; c.stroke();
    // 산
    for (let i = 0; i < 260; i++) {
      const x = r() * (W + OVER.x * 2) - OVER.x, y = r() * (H + OVER.y * 2) - OVER.y;
      if (x > -20 && x < W + 20 && y > -20 && y < H + 20 && !(x > ROAD.x0 + 60 && x < ROAD.x1 - 60 && y > ROAD.y0 + 60 && y < ROAD.y1 - 60)) continue;
      if (x > ROAD.x0 - 60 && x < ROAD.x1 + 60 && Math.abs(y - ROAD.y0) < 60) continue;
      if (x > ROAD.x0 - 60 && x < ROAD.x1 + 60 && Math.abs(y - ROAD.y1) < 60) continue;
      if (y > ROAD.y0 - 60 && y < ROAD.y1 + 60 && (Math.abs(x - ROAD.x0) < 60 || Math.abs(x - ROAD.x1) < 60)) continue;
      if (Math.abs(x - W / 2) < 130 && Math.abs(y - H / 2) < 100) continue;
      const s = 14 + r() * 26;
      // 생성 소품(나무·바위)이 있으면 그것을 놓는다
      const prop = fancy && Art.img(r() < 0.7 ? 'prop_tree' : 'prop_rock');
      if (prop) { const z = s * (x > ROAD.x0 && x < ROAD.x1 && y > ROAD.y0 && y < ROAD.y1 ? 1.9 : 3.2); c.drawImage(prop, x - z / 2, y - z * 0.8, z, z * (prop.height / prop.width)); continue; }
      c.fillStyle = 'rgba(38,40,28,.55)'; c.beginPath(); c.moveTo(x - s, y + s * 0.6); c.quadraticCurveTo(x - s * 0.3, y - s * 0.4, x, y - s); c.quadraticCurveTo(x + s * 0.3, y - s * 0.4, x + s, y + s * 0.6); c.fill();
    }
    // 도로
    c.lineJoin = 'round'; c.strokeStyle = '#3f3423'; c.lineWidth = 82;
    c.strokeRect(ROAD.x0, ROAD.y0, ROAD.x1 - ROAD.x0, ROAD.y1 - ROAD.y0);
    c.strokeStyle = tilePat(c, 'tex_road', 0.7) || '#a58e62'; c.lineWidth = 72; c.strokeRect(ROAD.x0, ROAD.y0, ROAD.x1 - ROAD.x0, ROAD.y1 - ROAD.y0);
    c.strokeStyle = 'rgba(70,52,30,.32)'; c.lineWidth = 2; c.setLineDash([18, 16]); c.strokeRect(ROAD.x0, ROAD.y0, ROAD.x1 - ROAD.x0, ROAD.y1 - ROAD.y0); c.setLineDash([]);
    if (c !== base) { base.save(); base.setTransform(1, 0, 0, 1, 0, 0); base.filter = 'saturate(0.65) brightness(0.85)'; base.drawImage(c.canvas, 0, 0); base.restore(); c = base; }
    // 중앙 성채
    const cx = (ROAD.x0 + ROAD.x1) / 2, cy = H / 2, keep = fancy && Art.img('prop_castle');
    if (keep) {
      // 유닛이 태어나는 자리라 어둡고 낮게 깔아 유닛이 위에서 잘 보이게 한다
      const z = 240; c.filter = 'saturate(0.5) brightness(0.62)'; c.drawImage(keep, cx - z / 2, cy - z * 0.6, z, z * (keep.height / keep.width)); c.filter = 'none';
      c.fillStyle = 'rgba(30,20,12,.75)'; c.fillRect(cx - 52, cy + 64, 104, 40);
      c.fillStyle = '#ffe2a0'; c.font = '900 30px "Noto Serif KR", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('中原', cx, cy + 85);
      c.restore(); return;
    }
    c.fillStyle = '#3b3126'; c.fillRect(cx - 90, cy - 60, 180, 120);
    c.strokeStyle = '#c5ab74'; c.lineWidth = 4; c.strokeRect(cx - 90, cy - 60, 180, 120);
    for (let i = 0; i < 9; i++) { c.fillStyle = '#c5ab74'; c.fillRect(cx - 86 + i * 20, cy - 68, 10, 8); }
    c.fillStyle = '#c5ab74'; c.font = '900 56px "Noto Serif KR", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('中原', cx, cy + 3);
    c.restore();
  }
  // 타일 텍스처: 좌우·상하로 뒤집어 붙여 이음매 없이 반복한다. 색 보정(filter)은 작은 타일에 한 번만 구워 둔다.
  const pats = {};
  function tilePat(c, name, scale, filter) {
    const im = Art.img(name), key = name + (filter || '');
    if (!im) return null;
    if (!pats[key]) {
      const w = im.width, h = im.height, cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2;
      const x = cv.getContext('2d');
      if (filter) x.filter = filter;
      [[0, 0, 1, 1], [2 * w, 0, -1, 1], [0, 2 * h, 1, -1], [2 * w, 2 * h, -1, -1]].forEach(([tx, ty, sx, sy]) => { x.save(); x.translate(tx, ty); x.scale(sx, sy); x.drawImage(im, 0, 0); x.restore(); });
      pats[key] = cv;
    }
    const pt = c.createPattern(pats[key], 'repeat');
    if (pt.setTransform && scale) pt.setTransform(new DOMMatrix().scale(scale));
    return pt;
  }
  // 큰 배경(지도·전장 바닥)은 화면보다 훨씬 큰 그림(최대 3900×2210)이라, 매 프레임 통째로 줄여 그리면 그래픽 칩이 화면의 몇 배를 읽어야 한다
  // (태블릿에서 15~25fps의 원인). 카메라가 멈춰 있는 동안은 화면 크기로 한 번 옮겨 둔 것을 1:1로 찍는다. 카메라·흔들림이 움직이는 프레임만 원본을 그린다.
  const BGC = {};
  let mapVer = 0;
  function blitBg(c, src, id, ver) {
    const o = BGC[id] || (BGC[id] = { cv: null, key: '', last: '' });
    // 기준은 카메라(S.scale·S.ox·S.oy). 화면 흔들림·타격 확대는 그 위에 얹히는 작은 변환이라, 둘레에 여백을 둔 저장본을 그대로 쓴다.
    const key = S.scale + '|' + S.ox + '|' + S.oy + '|' + view.width + '|' + view.height + '|' + ver + '|' + src.width;
    if (c !== ctx || key !== o.last) { o.last = key; c.drawImage(src, -OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); return; }
    const mx = Math.ceil(view.width * 0.06), my = Math.ceil(view.height * 0.06), cw = view.width + mx * 2, ch = view.height + my * 2;
    if (o.key !== key) {
      if (!o.cv) o.cv = document.createElement('canvas');
      if (o.cv.width !== cw || o.cv.height !== ch) { o.cv.width = cw; o.cv.height = ch; }
      const x = o.cv.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch);
      x.setTransform(S.scale, 0, 0, S.scale, S.ox + mx, S.oy + my); x.drawImage(src, -OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
      o.key = key;
    }
    // 저장본이 덮는 자리를 게임 좌표로 되돌려 그린다(흔들림이 없으면 화면 픽셀과 1:1)
    c.drawImage(o.cv, (-mx - S.ox) / S.scale, (-my - S.oy) / S.scale, cw / S.scale, ch / S.scale);
  }
  const mapCv = document.createElement('canvas');
  function sizeMap() { mapVer++; mapCv.width = Math.round((W + OVER.x * 2) * qMap()); mapCv.height = Math.round((H + OVER.y * 2) * qMap()); paintMap(mapCv.getContext('2d'), mapCv.width, mapCv.height); if (window.RTD_LOBBY) window.RTD_LOBBY.tintMap(mapCv); }
  sizeMap();
  // 생성 그림을 다 불러오면 지도를 다시 그린다
  Art.ready.then(() => {
    mapVer++; const x = mapCv.getContext('2d'); x.clearRect(0, 0, mapCv.width, mapCv.height); paintMap(x, mapCv.width, mapCv.height); if (window.RTD_LOBBY) window.RTD_LOBBY.tintMap(mapCv);
    const hc = document.getElementById('herocv');
    if (hc && window.RTD_PALACE) window.RTD_PALACE.paint(hc);
  });
  // 시작 화면 그림: 성채 앞에 불멸 장수들이 후광을 두르고 늘어선다
  function heroLineup(c) {
    const ids = ['yeopo', 'gwanu', 'jojo', 'yubi', 'songwon', 'jegal', 'samaui'];
    c.save(); c.fillStyle = 'rgba(10,6,4,.35)'; c.fillRect(0, 0, W, H); c.restore();
    ids.forEach((id, i) => {
      const d = T.units.find((u) => u.id === id), k = i - (ids.length - 1) / 2, x = W / 2 + k * 165, y = H * 0.56 + Math.abs(k) * 22;
      if (d) piece(c, x, y, 44 - Math.abs(k) * 3, d, i * 0.7, false, {});
    });
  }

  function octagon(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath();
  }
  // 유닛은 장기 말처럼 그린다. 등급이 오를수록 테두리와 후광이 화려해진다.
  // 유닛 자세: 보는 방향, 걷기, 공격 동작을 한곳에서 계산한다
  const RANGED = { bow: 1, crossbow: 1, flame: 1, fan: 1, thunder: 1, staff: 1, dagger: 1, scroll: 1 };
  const ATK_KIND = { spear: 'thrust', lance: 'thrust', serpent: 'thrust', sword: 'slash', twin: 'slash', dagger: 'slash', shield: 'slash', halberd: 'heavy', guandao: 'heavy', axe: 'heavy', mace: 'heavy', bow: 'ranged', crossbow: 'ranged', staff: 'cast', fan: 'cast', scroll: 'cast', flame: 'cast', thunder: 'cast', needle: 'cast', lute: 'cast', ribbon: 'cast' };
