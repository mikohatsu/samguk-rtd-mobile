  // ---- 전장 배경: 먹으로 그린 군사 지도 ----
  const OVER = { x: 1200, y: 600 };
  // ---- 지도 그림 묶음: 바닥·길·강·가운데 성·소품. 길 위치(규칙)는 그대로다. ----
  // base = 기본 지도(처음 받은 사람이 보는 지도, 상점의 '봄 들판'과 계절 색 스킨의 바탕). 바랜 종이 위 담채 군사 지도처럼 칠한다.
  // 나머지는 상점 '전장 지도'의 그림 스킨. 그림: gfx/map_<테마>_{ground,road,water}.jpg, gfx/map_<테마>_{keep,p1,p2}.png (Higgsfield 생성, 출처는 CREDITS.md)
  // river: 강 폭(0이면 없음). night: 밤 테마의 어두운 덮개. gf/rf/wf: 바닥·길·물 색 보정(유닛이 묻히지 않게 누른다). paper: 종이 색으로 묶기.
  // pd: 소품·성을 누르는 세기(유닛 가독성). mix: 소품 무리의 종류 비율(p1 비율).
  const MAP_THEMES = {
    base: { label: '中原', river: 46, water: 'plain', ground: 'gfx/map_plain_ground.jpg', road: 'gfx/map_plain_road.jpg', keep: 'gfx/map_plain_keep.png', p1: 'gfx/map_plain_p1.png', p2: 'gfx/map_plain_p2.png', paper: 1, gs: 2, gf:'saturate(0.7) brightness(0.92)', rf: 'saturate(0.7) brightness(0.9)', wf: 'saturate(0.5) brightness(0.8)', pd: 0.22, mix: 0.7 },
    plain: { label: '中原', river: 46, water: 'plain', gf: 'saturate(0.8) brightness(0.9)', props: ['p1', 'p1', 'p2'], mix: 0.7 },
    redcliff: { label: '赤壁', river: 150, water: 'redcliff', gf: 'brightness(1)', night: 'rgba(14,10,26,.2)', props: ['p1', 'p1', 'p2'], p2: 'gfx/vs_fireship.png', mix: 0.75 },
    luoyang: { label: '洛陽', river: 0, gf: 'saturate(0.7) brightness(0.66)', rf: 'saturate(0.9) brightness(0.95)', props: ['p1', 'p1', 'p2'], inner: 1.5, mix: 0.6 },
    hanzhong: { label: '漢中', river: 40, water: 'plain', gf: 'saturate(1.1) brightness(0.66)', rf: 'sepia(0.55) saturate(1.5) brightness(0.92)', props: ['p1', 'p2', 'p2'], mix: 0.4 },
  };
  const THI = {};
  let thTimer = 0;
  function loadImg(src) {
    let im = THI[src];
    if (!im) {
      im = THI[src] = new Image();
      // 그림이 도착하면 지도를 다시 칠하고, 상점 미리보기도 다시 그리게 알린다
      im.onload = () => { im._ok = true; clearTimeout(thTimer); thTimer = setTimeout(() => { if (typeof sizeMap === 'function') sizeMap(); try { window.dispatchEvent(new Event('rtd-maptheme')); } catch (e) { /* 무시 */ } }, 150); };
      im.src = src + '?v=3';
    }
    return im._ok ? im : null;
  }
  function themeImg(th, part) {
    const T2 = MAP_THEMES[th], src = part === 'water' ? `gfx/map_${T2.water}_water.jpg` : T2[part] || `gfx/map_${th}_${part}.${part === 'ground' || part === 'road' ? 'jpg' : 'png'}`;
    return loadImg(src);
  }
  const curTheme = () => { const k = window.RTD_LOBBY && window.RTD_LOBBY.mapTheme ? window.RTD_LOBBY.mapTheme() : null; return k && MAP_THEMES[k] ? k : null; };
  // 강 물길(게임 좌표). 그리기와 '소품이 강 위에 서지 않게' 하는 판정이 같은 선을 쓴다.
  const RIVER = [[-OVER.x, 760], [-20, 690], [330, 590, 450, 780, 680, 640], [880, 520, 1060, 680, W + 30, 510], [W + OVER.x, 420]];
  function riverPath(c) { c.beginPath(); c.moveTo(RIVER[0][0], RIVER[0][1]); for (let i = 1; i < RIVER.length; i++) { const s = RIVER[i]; if (s.length === 2) c.lineTo(s[0], s[1]); else c.bezierCurveTo(s[0], s[1], s[2], s[3], s[4], s[5]); } }
  let riverPts = null;
  function riverDots() {
    if (riverPts) return riverPts;
    const out = []; let px = RIVER[0][0], py = RIVER[0][1];
    for (let i = 1; i < RIVER.length; i++) {
      const s = RIVER[i], n = 40;
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        if (s.length === 2) out.push([px + (s[0] - px) * t, py + (s[1] - py) * t]);
        else out.push([u * u * u * px + 3 * u * u * t * s[0] + 3 * u * t * t * s[2] + t * t * t * s[4], u * u * u * py + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5]]);
      }
      px = s[s.length - 2]; py = s[s.length - 1];
    }
    return (riverPts = out);
  }
  const riverDist = (x, y) => { let m = 1e9; riverDots().forEach(([a, b]) => { const d = (a - x) * (a - x) + (b - y) * (b - y); if (d < m) m = d; }); return Math.sqrt(m); };
  // 강이 길을 건너는 자리(다리 놓을 곳): 길 네 변(가운데 선)과 물길이 만나는 점
  function bridgeSpots() {
    const pts = riverDots(), out = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      [ROAD.x0, ROAD.x1].forEach((X) => { if ((ax - X) * (bx - X) <= 0 && ax !== bx) { const y = ay + ((X - ax) / (bx - ax)) * (by - ay); if (y > ROAD.y0 && y < ROAD.y1) out.push({ x: X, y, vert: true, a: Math.atan2(by - ay, bx - ax) }); } });
      [ROAD.y0, ROAD.y1].forEach((Y) => { if ((ay - Y) * (by - Y) <= 0 && ay !== by) { const x = ax + ((Y - ay) / (by - ay)) * (bx - ax); if (x > ROAD.x0 && x < ROAD.x1) out.push({ x, y: Y, vert: false, a: Math.atan2(by - ay, bx - ax) }); } });
    }
    return out;
  }
  // 부드러운 둥근 그림자 한 장(굽기 때 소품·성 발밑에 찍는다)
  let shadowSpr = null;
  function shadowSprite() {
    if (shadowSpr) return shadowSpr;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), g2 = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g2.addColorStop(0, 'rgba(24,18,8,.75)'); g2.addColorStop(0.55, 'rgba(24,18,8,.4)'); g2.addColorStop(1, 'rgba(24,18,8,0)');
    x.fillStyle = g2; x.fillRect(0, 0, 64, 64);
    return (shadowSpr = cv);
  }
  // 그림 한 장을 작은 캔버스에 옮기고 위에 색을 얹어 누른다(캔버스 filter 대신 합성: iOS에서도 같게)
  function toned(im, a) {
    if (!a) return im;
    const key = '_tone' + a; if (im[key]) return im[key];
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(34,26,14,${a})`; x.fillRect(0, 0, cv.width, cv.height);
    return (im[key] = cv);
  }
  // 큰 명암 얼룩(저주파): 아주 작은 난수 판을 지도 전체로 늘려 얹어 같은 바닥 무늬의 반복을 깬다
  function blotch(c, rnd, cols, rows, alpha) {
    const cv = document.createElement('canvas'); cv.width = cols; cv.height = rows;
    const x = cv.getContext('2d'), d = x.createImageData(cols, rows);
    for (let i = 0; i < cols * rows; i++) { const v = 90 + rnd() * 80, warm = rnd() * 18; d.data[i * 4] = v + warm; d.data[i * 4 + 1] = v + warm * 0.6; d.data[i * 4 + 2] = v - warm * 0.4; d.data[i * 4 + 3] = 255; }
    x.putImageData(d, 0, 0);
    c.save(); c.globalAlpha = alpha; c.globalCompositeOperation = 'soft-light'; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(cv, -OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); c.restore();
  }
  // 지명: 검은 상자 대신 옛 군사 지도처럼 성 옆에 먹으로 세로로 쓴다(바닥에 스미게 곱하기 합성)
  // light: 밤·어두운 바닥에서는 먹 대신 바랜 흰 글씨(곱하기로는 안 보인다)
  function mapLabel(c, text, x, y, light) {
    c.save(); c.font = '900 46px "Noto Serif KR", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (!light) c.globalCompositeOperation = 'multiply';
    const ink = light ? 'rgba(236,222,190,' : 'rgba(28,20,10,';
    [...text].forEach((ch, i) => { c.fillStyle = light ? 'rgba(0,0,0,.35)' : ink + '.16)'; c.fillText(ch, x + 2, y + i * 52 + 2); c.fillStyle = ink + (light ? '.6)' : '.62)'); c.fillText(ch, x, y + i * 52); });
    c.restore();
  }
  // 지도를 칠한다. 그림이 아직 덜 왔으면 false(임시 지도로 칠한다).
  function paintTheme(c, w, h, th) {
    const T2 = MAP_THEMES[th], G = themeImg(th, 'ground'), R = themeImg(th, 'road'), K = themeImg(th, 'keep'), P1 = themeImg(th, 'p1'), P2 = themeImg(th, 'p2'), Wt = T2.river ? themeImg(th, 'water') : null;
    const PL = T2.river ? loadImg('gfx/map_hanzhong_road.jpg') : null; // 다리 판자: 한중 잔도 그림의 나무 판자 부분을 잘라 쓴다
    if (!G || !R || !K || !P1 || !P2 || (T2.river && (!Wt || !PL))) return false;
    const sx = w / (W + OVER.x * 2), sy = h / (H + OVER.y * 2);
    const FX = -OVER.x, FY = -OVER.y, FW = W + OVER.x * 2, FH = H + OVER.y * 2;
    let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    c.save(); c.scale(sx, sy); c.translate(OVER.x, OVER.y);
    // 1) 바닥 + 큰 얼룩 두 겹
    const gs = T2.gs || 1.25; // 바닥 무늬 배율(크게 깔수록 같은 무늬의 반복이 덜 보인다)
    c.fillStyle = tilePat(c, 'th_' + th + '_g', gs, T2.gf, G); c.fillRect(FX, FY, FW, FH);
    blotch(c, r, 30, 18, 0.55); blotch(c, r, 90, 52, 0.22);
    // 2) 강: 진흙 둑 → 모래 물가 → 물 → 가운데 밝은 결 → 물가 반사선
    if (T2.river) {
      const rw = T2.river; c.lineCap = 'round'; c.lineJoin = 'round';
      riverPath(c);
      c.strokeStyle = 'rgba(60,46,26,.32)'; c.lineWidth = rw + 30; c.stroke();
      c.strokeStyle = 'rgba(150,132,92,.38)'; c.lineWidth = rw + 16; c.stroke();
      c.strokeStyle = 'rgba(10,14,20,.42)'; c.lineWidth = rw + 6; c.stroke();
      c.strokeStyle = tilePat(c, 'th_' + th + '_w', 0.7, T2.wf || 'brightness(0.9)', Wt); c.lineWidth = rw; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = rw * 0.45; c.stroke();
      c.save(); c.translate(0, -rw * 0.22); riverPath(c); c.strokeStyle = 'rgba(200,222,228,.16)'; c.lineWidth = 2.5; c.stroke(); c.restore();
    }
    // 3) 소품: 고르게 뿌리지 않고 무리(숲·바위 더미)로 모은다. 길·강·성 자리·화면 안 여백(전황·업적 판 자리)은 비운다.
    const cx = (ROAD.x0 + ROAD.x1) / 2, cy = H / 2;
    const inner = (x, y) => x > ROAD.x0 && x < ROAD.x1 && y > ROAD.y0 && y < ROAD.y1;
    const edgeIn = (x, y) => Math.min(x - ROAD.x0, ROAD.x1 - x, y - ROAD.y0, ROAD.y1 - y); // 길 안쪽에서 길까지 거리
    const roadD = (x, y) => { const dx = Math.max(ROAD.x0 - x, 0, x - ROAD.x1), dy = Math.max(ROAD.y0 - y, 0, y - ROAD.y1); return inner(x, y) ? edgeIn(x, y) : Math.hypot(dx, dy); };
    const okAt = (x, y, z) => {
      const ins = inner(x, y);
      if (!ins && x > -20 && x < W + 20 && y > -20 && y < H + 20) return false; // 화면 안 여백은 UI 자리
      if (roadD(x, y) < 40 + z * 0.35) return false;
      if (T2.river && riverDist(x, y) < T2.river / 2 + 14 + z * 0.3) return false;
      if (Math.abs(x - cx) < 250 && Math.abs(y - cy) < 190) return false; // 성과 마당
      if (ins && edgeIn(x, y) > 190) return false; // 길 안쪽은 가장자리 띠에만, 가운데는 유닛 자리로 비운다
      return true;
    };
    const props = [];
    const kinds = T2.props || ['p1', 'p1', 'p2'];
    const mix = T2.mix != null ? T2.mix : kinds.filter((k) => k === 'p1').length / kinds.length;
    const add = (x, y, z, forest) => { if (!okAt(x, y, z)) return; const im = (forest ? r() < 0.88 : r() < 0.2) ? P1 : P2; props.push({ x, y, z, im: toned(im, T2.pd != null ? T2.pd : 0.26), flip: r() < 0.5 }); };
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    for (let i = 0; i < 70; i++) {
      const x = r() * FW + FX, y = r() * FH + FY, ins = inner(x, y);
      if (!okAt(x, y, 60)) continue;
      const forest = r() < mix, n = ins ? 2 + Math.floor(r() * 3) : 3 + Math.floor(r() * 7), rad = ins ? 45 + r() * 30 : 70 + r() * 80;
      const base = (ins ? 0.85 * (T2.inner || 1) * 0.6 : 1) * (forest ? 95 + r() * 45 : 80 + r() * 35);
      for (let k = 0; k < n; k++) { const ox = gauss() * rad, oy = gauss() * rad * 0.7, d = Math.min(1, Math.hypot(ox, oy) / rad); add(x + ox, y + oy, base * (1.25 - 0.5 * d) * (0.85 + r() * 0.3), forest); }
    }
    // 길 안쪽 가장자리 띠에 작은 무리 몇 개(숲 자락·바위 더미). 가운데는 유닛 자리로 비운다.
    for (let i = 0, made = 0; i < 80 && made < 9; i++) {
      const x = ROAD.x0 + 60 + r() * (ROAD.x1 - ROAD.x0 - 120), y = ROAD.y0 + 60 + r() * (ROAD.y1 - ROAD.y0 - 120), e = edgeIn(x, y);
      if (e < 70 || e > 150 || !okAt(x, y, 50)) continue;
      made++; const forest = r() < mix, n = 2 + Math.floor(r() * 4), base = (forest ? 70 : 58) * (T2.inner || 1);
      for (let k = 0; k < n; k++) { const ox = gauss() * 50, oy = gauss() * 34, d = Math.min(1, Math.hypot(ox, oy) / 50); add(x + ox, y + oy, base * (1.2 - 0.4 * d) * (0.85 + r() * 0.3), forest); }
    }
    for (let i = 0; i < 40; i++) { const x = r() * FW + FX, y = r() * FH + FY; if (!inner(x, y)) add(x, y, 70 + r() * 50, r() < mix); } // 홀로 선 것 조금
    // 소품을 따로 한 장에 그려 놓고 붙인다(그림마다 필터를 걸지 않는다)
    const sh = shadowSprite();
    c.save(); c.globalCompositeOperation = 'multiply';
    props.forEach((p) => { const foot = p.y + p.z * 0.06; c.globalAlpha = 0.55; c.drawImage(sh, p.x - p.z * 0.42 + p.z * 0.08, foot - p.z * 0.1, p.z * 0.84, p.z * 0.22); });
    c.restore();
    props.sort((a, b) => a.y - b.y);
    props.forEach((p) => { const hh = p.z * (p.im.height / p.im.width); if (p.flip) { c.save(); c.translate(p.x, 0); c.scale(-1, 1); c.drawImage(p.im, -p.z / 2, p.y + p.z * 0.06 - hh, p.z, hh); c.restore(); } else c.drawImage(p.im, p.x - p.z / 2, p.y + p.z * 0.06 - hh, p.z, hh); });
    // 4) 길: 부드러운 그늘 → 흙 테 → 길 무늬(가로변·세로변 결 방향을 따로) → 가장자리를 풀·흙으로 흐트린다 → 바퀴 자국
    const RX = ROAD.x0, RY = ROAD.y0, RWd = ROAD.x1 - ROAD.x0, RHt = ROAD.y1 - ROAD.y0;
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(20,14,6,.10)'; c.lineWidth = 104; c.strokeRect(RX, RY, RWd, RHt);
    c.strokeStyle = 'rgba(20,14,6,.14)'; c.lineWidth = 92; c.strokeRect(RX, RY, RWd, RHt);
    c.strokeStyle = 'rgba(96,74,44,.55)'; c.lineWidth = 80; c.strokeRect(RX, RY, RWd, RHt);
    const rpH = tilePat(c, 'th_' + th + '_r', 0.5, T2.rf || 'saturate(0.8) brightness(0.82)', R), rpV = tilePat(c, 'th_' + th + '_r', 0.5, T2.rf || 'saturate(0.8) brightness(0.82)', R);
    if (rpH.setTransform) { rpH.setTransform(new DOMMatrix().rotate(-30).scale(0.5)); rpV.setTransform(new DOMMatrix().rotate(60).scale(0.5)); }
    c.strokeStyle = rpH; c.lineWidth = 72; c.strokeRect(RX, RY, RWd, RHt);
    c.save(); c.beginPath(); c.rect(RX - 40, RY + 40, 80, RHt - 80); c.rect(ROAD.x1 - 40, RY + 40, 80, RHt - 80); c.clip();
    c.strokeStyle = rpV; c.strokeRect(RX, RY, RWd, RHt); c.restore();
    // 가장자리: 바닥 무늬 조각(풀)이 길 위로 번지고, 길 무늬 조각(흙)이 길 밖으로 흩어진다
    const gp = tilePat(c, 'th_' + th + '_g', gs, T2.gf, G), per = 2 * (RWd + RHt);
    const onEdge = (t, off) => { t = ((t % per) + per) % per; if (t < RWd) return [RX + t, RY + off]; t -= RWd; if (t < RHt) return [ROAD.x1 - off, RY + t]; t -= RHt; if (t < RWd) return [ROAD.x1 - t, ROAD.y1 - off]; t -= RWd; return [RX + off, ROAD.y1 - t]; };
    for (let i = 0; i < 260; i++) {
      const side = r() < 0.5 ? -1 : 1, [ex, ey] = onEdge(r() * per, side * (33 + r() * 6));
      c.globalAlpha = 0.35 + r() * 0.35; c.fillStyle = gp; c.beginPath(); c.ellipse(ex, ey, 6 + r() * 16, 3 + r() * 5, (r() - 0.5) * 0.5, 0, 7); c.fill();
    }
    for (let i = 0; i < 90; i++) {
      const side = r() < 0.5 ? -1 : 1, [ex, ey] = onEdge(r() * per, side * (44 + r() * 14));
      c.globalAlpha = 0.25 + r() * 0.3; c.fillStyle = rpH; c.beginPath(); c.ellipse(ex, ey, 6 + r() * 16, 3 + r() * 6, r() * 3, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(60,40,20,.13)'; c.lineWidth = 3; c.strokeRect(RX - 14, RY - 14, RWd + 28, RHt + 28); c.strokeRect(RX + 14, RY + 14, RWd - 28, RHt - 28);
    // 5) 다리: 강이 길을 건너는 곳마다 판자 다리를 놓는다(물 위 그림자 → 판자 → 양옆 난간 그늘)
    if (T2.river) bridgeSpots().forEach((b) => {
      const len = T2.river + 44, wid = 84;
      c.save(); c.translate(b.x, b.y); if (!b.vert) c.rotate(-Math.PI / 2); // 길 방향을 세로로 맞춘다
      c.fillStyle = 'rgba(8,10,14,.38)'; c.fillRect(-wid / 2 + 7, -len / 2 + 9, wid, len);
      c.save(); c.beginPath(); c.rect(-wid / 2, -len / 2, wid, len); c.clip();
      // 잔도 그림의 판자 길은 비스듬히 놓여 있다 → 판자가 길을 가로지르게 돌려 세운다
      c.rotate(Math.PI / 2 - 1.2); const ps = 1.2; c.drawImage(PL, -160 * ps, -165 * ps, 320 * ps, 320 * ps);
      c.restore();
      c.fillStyle = 'rgba(60,44,26,.18)'; c.fillRect(-wid / 2, -len / 2, wid, len);
      c.strokeStyle = 'rgba(34,24,12,.7)'; c.lineWidth = 4; c.beginPath(); c.moveTo(-wid / 2, -len / 2); c.lineTo(-wid / 2, len / 2); c.moveTo(wid / 2, -len / 2); c.lineTo(wid / 2, len / 2); c.stroke();
      c.restore();
    });
    if (T2.night) { c.fillStyle = T2.night; c.fillRect(FX, FY, FW, FH); }
    // 6) 가운데 성: 흙 마당(가장자리 부드럽게) → 발밑 그림자 → 성 → 지명
    const z = 310, kh = z * (K.height / K.width), top = cy - kh * 0.58, foot = top + kh;
    {
      const rx = z * 0.66, ry = kh * 0.55, my = cy + kh * 0.12, pw = Math.max(2, Math.round(rx * 2 * sx)), ph = Math.max(2, Math.round(ry * 2 * sy));
      const cv = document.createElement('canvas'); cv.width = pw; cv.height = ph;
      const x = cv.getContext('2d'); x.scale(sx, sy); x.fillStyle = tilePat(x, 'th_' + th + '_r', 0.5, T2.rf || 'saturate(0.8) brightness(0.82)', R); x.fillRect(0, 0, rx * 2, ry * 2);
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-in'; x.translate(pw / 2, ph / 2); x.scale(pw / 2, ph / 2);
      const mg = x.createRadialGradient(0, 0, 0, 0, 0, 1); mg.addColorStop(0, 'rgba(0,0,0,.85)'); mg.addColorStop(0.65, 'rgba(0,0,0,.6)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = mg; x.fillRect(-1, -1, 2, 2);
      c.drawImage(cv, cx - rx, my - ry, rx * 2, ry * 2);
    }
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.6; c.drawImage(sh, cx - z * 0.5 + 14, foot - kh * 0.42, z * 1.0, kh * 0.5); c.restore();
    c.drawImage(toned(K, T2.pd != null ? T2.pd : 0.26), cx - z / 2, top, z, kh);
    // 유닛이 태어나는 자리: 성 위를 가운데만 살짝 눌러 유닛이 위에서 잘 보이게 한다
    const ug = c.createRadialGradient(cx, cy, 0, cx, cy, 150); ug.addColorStop(0, 'rgba(30,22,12,.28)'); ug.addColorStop(1, 'rgba(30,22,12,0)');
    c.fillStyle = ug; c.fillRect(cx - 150, cy - 150, 300, 300);
    if (T2.paper) {
      // 바랜 종이 색으로 한 팔레트에 묶는다(바닥·물·길·소품·성 모두): 색만 황토 쪽으로 옮기고(color) 따뜻한 종이색을 곱한다
      c.save(); c.globalCompositeOperation = 'color'; c.globalAlpha = 0.3; c.fillStyle = '#a89468'; c.fillRect(FX, FY, FW, FH);
      c.globalAlpha = 1; c.globalCompositeOperation = 'multiply'; c.fillStyle = '#efe2c4'; c.fillRect(FX, FY, FW, FH); c.restore();
    }
    mapLabel(c, T2.label, cx - z * 0.5 - 34, top + kh * 0.18, T2.night);
    // 7) 빛(왼쪽 위 따뜻하게, 오른쪽 아래 차갑게)과 가장자리 비네트: 시선을 길 안쪽으로 모은다
    const lg = c.createLinearGradient(FX, FY, FX + FW, FY + FH);
    lg.addColorStop(0, 'rgba(255,228,170,.10)'); lg.addColorStop(1, 'rgba(255,228,170,0)');
    c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = lg; c.fillRect(FX, FY, FW, FH);
    const dg = c.createLinearGradient(FX, FY, FX + FW, FY + FH); dg.addColorStop(0, 'rgba(20,30,50,0)'); dg.addColorStop(1, 'rgba(20,30,50,.14)');
    c.globalCompositeOperation = 'multiply'; c.fillStyle = dg; c.fillRect(FX, FY, FW, FH); c.restore();
    c.save(); c.translate(W / 2, H / 2); c.scale(1, H / W);
    const vg = c.createRadialGradient(0, 0, W * 0.5, 0, 0, W * 1.05); vg.addColorStop(0, 'rgba(14,10,4,0)'); vg.addColorStop(0.55, 'rgba(14,10,4,.32)'); vg.addColorStop(1, 'rgba(14,10,4,.6)');
    c.fillStyle = vg; c.fillRect(-FW, -FW, FW * 2, FW * 2); c.restore();
    c.restore();
    return true;
  }
  function paintMap(c, w, h, theme) {
    const th = theme === undefined ? curTheme() : theme && MAP_THEMES[theme] ? theme : null;
    if (th && paintTheme(c, w, h, th)) return;
    if (paintTheme(c, w, h, 'base')) return;
    // 그림이 오기 전 잠깐 보이는 임시 지도(그림이 도착하면 다시 칠한다)
    const sx = w / (W + OVER.x * 2), sy = h / (H + OVER.y * 2);
    c.save(); c.scale(sx, sy); c.translate(OVER.x, OVER.y);
    c.fillStyle = '#7d7349'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
    riverPath(c); c.strokeStyle = '#4a6672'; c.lineWidth = 46; c.lineCap = 'round'; c.stroke();
    c.lineJoin = 'round'; c.strokeStyle = 'rgba(96,74,44,.7)'; c.lineWidth = 80; c.strokeRect(ROAD.x0, ROAD.y0, ROAD.x1 - ROAD.x0, ROAD.y1 - ROAD.y0);
    c.strokeStyle = '#a58e62'; c.lineWidth = 72; c.strokeRect(ROAD.x0, ROAD.y0, ROAD.x1 - ROAD.x0, ROAD.y1 - ROAD.y0);
    c.restore();
  }
  // 타일 텍스처: 좌우·상하로 뒤집어 붙여 이음매 없이 반복한다. 색 보정(filter)은 작은 타일에 한 번만 구워 둔다.
  const pats = {};
  function tilePat(c, name, scale, filter, own) {
    const im = own || Art.img(name), key = name + (filter || '');
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
  // R: 원본이 덮는 게임 좌표 범위(없으면 지도 전체 범위)
  const BG_ALL = { x: -OVER.x, y: -OVER.y, w: W + OVER.x * 2, h: H + OVER.y * 2 };
  function blitBg(c, src, id, ver, R) {
    R = R || BG_ALL;
    const o = BGC[id] || (BGC[id] = { cv: null, key: '', last: '' });
    // 기준은 카메라(S.scale·S.ox·S.oy). 화면 흔들림·타격 확대는 그 위에 얹히는 작은 변환이라, 둘레에 여백을 둔 저장본을 그대로 쓴다.
    const key = S.scale + '|' + S.ox + '|' + S.oy + '|' + view.width + '|' + view.height + '|' + ver + '|' + src.width;
    if (c !== ctx || key !== o.last) { o.last = key; c.drawImage(src, R.x, R.y, R.w, R.h); return; }
    const mx = Math.ceil(view.width * 0.06), my = Math.ceil(view.height * 0.06), cw = view.width + mx * 2, ch = view.height + my * 2;
    if (o.key !== key) {
      if (!o.cv) o.cv = document.createElement('canvas');
      if (o.cv.width !== cw || o.cv.height !== ch) { o.cv.width = cw; o.cv.height = ch; }
      const x = o.cv.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch);
      x.setTransform(S.scale, 0, 0, S.scale, S.ox + mx, S.oy + my); x.drawImage(src, R.x, R.y, R.w, R.h);
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
