// [자동 생성] 이 파일을 직접 고치지 말 것. src/ui/*.js를 고친 뒤 `npm run ui`로 다시 만든다.
// 화면 그리기와 입력. 게임 규칙은 engine.js, 내용은 테마 파일에 있다.
(function () {
  const T = window.RTD_THEME, E = window.RTD_ENGINE, { W, H, ROAD, ARENA, dist } = E;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n).toLocaleString());
  const view = $('view'), ctx = view.getContext('2d');
  // ---- 화질: high(PC 기본) / mid(폰 기본) / low, 30fps 제한. 이 기기에만 저장한다. ----
  const Q = (() => {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('rtd-gfx') || '{}') || {}; } catch (e) { s = {}; }
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    return { level: ['high', 'mid', 'low'].includes(s.level) ? s.level : coarse ? 'mid' : 'high', fps30: !!s.fps30, perf: !!s.perf, coarse, rs: 1 };
  })();
  const qDpr = () => (Q.level === 'high' ? 2 : Q.level === 'mid' ? 1.5 : 1);
  // 터치 기기는 캔버스 픽셀 수에 상한을 둔다. 태블릿(2560×1600)은 그대로 그리면 400만 픽셀이라 그래픽 칩이 못 따라간다(갤럭시 탭 S6에서 15~25fps).
  const qPix = () => (!Q.coarse ? Infinity : Q.level === 'high' ? 2.0e6 : Q.level === 'mid' ? 1.3e6 : 0.8e6);
  const qPart = () => (Q.level === 'high' ? 1 : Q.level === 'mid' ? 0.6 : 0.35);
  const qMap = () => (Q.level === 'high' ? (Q.coarse ? 0.7 : 1) : Q.level === 'mid' ? 0.55 : 0.4);
  const BLUR = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
  // 빛 번짐(shadowBlur)은 iOS에서 특히 무겁다: 보통은 상한을 두고, 낮음은 끈다
  function applyQuality() {
    if (Q.level === 'high' && !Q.coarse) delete ctx.shadowBlur;
    else {
      // 휴대폰·태블릿(터치 기기)은 화질과 상관없이 끈다(높음 포함): 번짐 하나하나가 흐림 연산이라 안드로이드에서 프레임이 크게 떨어진다
      const cap = Q.level === 'mid' && !Q.coarse ? 6 : 0;
      Object.defineProperty(ctx, 'shadowBlur', { configurable: true, get() { return BLUR.get.call(this); }, set(v) { BLUR.set.call(this, Math.min(v, cap)); } });
    }
    try { localStorage.setItem('rtd-gfx', JSON.stringify({ level: Q.level, fps30: Q.fps30, perf: Q.perf })); } catch (e) { /* 저장 못 해도 이번 판은 그대로 */ }
  }
  applyQuality();
  // 매 프레임 만들던 빛 그라디언트를 색별로 한 번만 그려 두고 찍는다
  const gCache = {};
  function glowSprite(key, stops) {
    if (gCache[key]) return gCache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return (gCache[key] = cv);
  }
  function pillarSprite(col) {
    const key = 'p' + col;
    if (gCache[key]) return gCache[key];
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 128;
    const x = cv.getContext('2d'), gr = x.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, col + '99'); gr.addColorStop(1, col + '00');
    x.fillStyle = gr; x.fillRect(0, 0, 8, 128);
    return (gCache[key] = cv);
  }
  const defOf = {}; T.units.forEach((d) => (defOf[d.id] = d));
  const rankName = (t) => (t === 0 ? I.t('special') : T.ranks.find((r) => r.t === t).name);
  const TIER_COLOR = { 0: '#d9c27c', 1: '#b9b2a3', 2: '#7fd08a', 3: '#6fb7ff', 4: '#b79cff', 5: '#ff8fc0', 6: '#4fe0d0', 7: '#ffe27a', 8: '#ffb347', 9: '#e070ff', 10: '#ff5a5a' };
  const tierColor = (t) => TIER_COLOR[t];
  const rankTag = (t) => (t === 0 ? I.t('special') : t <= 7 ? `${t}★` : rankName(t));
  const rankBadge = (t) => `<i class="rt" style="background:${tierColor(t)};font-style:normal">${rankTag(t)}</i>`;

  let g = null, net = null, speed = 1;
  const Art = window.RTD_ART, Snd = window.RTD_AUDIO;
  const I = window.RTD_I18N, t = I.t;
  const S = { sel: [], dropSel: null, groups: {}, cmdMode: null, drag: null, mouse: { x: W / 2, y: H / 2 }, tab: 'upgrade', pick: [], cut: null, banner: null, pattern: null, ticket: null, dmg: [], pings: [], lastClick: { t: 0, id: 0 }, scale: 1, bossIntro: null, fdt: 1 / 60, f60: 1 };

  // ---- 전장 배경: 먹으로 그린 군사 지도 ----
  const OVER = { x: 1200, y: 600 };
  // ---- 테마 지도(상점 '전장 지도'의 그림 스킨): 바닥·길·강·가운데 건물·소품을 테마별 그림으로 갈아 끼운다. 길 위치(규칙)는 그대로다. ----
  // 그림: gfx/map_<테마>_{ground,road,water}.jpg, gfx/map_<테마>_{keep,p1,p2}.png (Higgsfield 생성, 출처는 CREDITS.md)
  // river: 강 폭(0이면 없음). night: 밤 테마의 어두운 덮개. gf: 바닥 색 보정(유닛이 묻히지 않게 누른다).
  const MAP_THEMES = {
    plain: { label: '中原', river: 46, water: 'plain', gf: 'saturate(0.8) brightness(0.9)', props: ['p1', 'p1', 'p2'] },
    redcliff: { label: '赤壁', river: 150, water: 'redcliff', gf: 'brightness(1)', night: 'rgba(14,10,26,.2)', props: ['p1', 'p1', 'p2'], p2: 'gfx/vs_fireship.png' },
    luoyang: { label: '洛陽', river: 0, gf: 'saturate(0.7) brightness(0.66)', rf: 'saturate(0.9) brightness(0.95)', props: ['p1', 'p1', 'p2'], inner: 1.5 },
    hanzhong: { label: '漢中', river: 40, water: 'plain', gf: 'saturate(1.1) brightness(0.66)', rf: 'sepia(0.55) saturate(1.5) brightness(0.92)', props: ['p1', 'p2', 'p2'] },
  };
  const THI = {};
  let thTimer = 0;
  function themeImg(th, part) {
    const T2 = MAP_THEMES[th], src = part === 'water' ? `gfx/map_${T2.water}_water.jpg` : T2[part] || `gfx/map_${th}_${part}.${part === 'ground' || part === 'road' ? 'jpg' : 'png'}`;
    let im = THI[src];
    if (!im) {
      im = THI[src] = new Image();
      // 그림이 도착하면 지도를 다시 칠하고, 상점 미리보기도 다시 그리게 알린다
      im.onload = () => { im._ok = true; clearTimeout(thTimer); thTimer = setTimeout(() => { if (typeof sizeMap === 'function') sizeMap(); try { window.dispatchEvent(new Event('rtd-maptheme')); } catch (e) { /* 무시 */ } }, 150); };
      im.src = src + '?v=3';
    }
    return im._ok ? im : null;
  }
  const curTheme = () => { const k = window.RTD_LOBBY && window.RTD_LOBBY.mapTheme ? window.RTD_LOBBY.mapTheme() : null; return k && MAP_THEMES[k] ? k : null; };
  // 테마 지도를 칠한다. 그림이 아직 덜 왔으면 false(기본 지도로 칠한다).
  function paintTheme(c, w, h, th) {
    const T2 = MAP_THEMES[th], G = themeImg(th, 'ground'), R = themeImg(th, 'road'), K = themeImg(th, 'keep'), P1 = themeImg(th, 'p1'), P2 = themeImg(th, 'p2'), Wt = T2.river ? themeImg(th, 'water') : null;
    if (!G || !R || !K || !P1 || !P2 || (T2.river && !Wt)) return false;
    const sx = w / (W + OVER.x * 2), sy = h / (H + OVER.y * 2);
    c.save(); c.scale(sx, sy); c.translate(OVER.x, OVER.y);
    c.fillStyle = tilePat(c, 'th_' + th + '_g', 1.25, T2.gf, G); c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
    // 강
    if (T2.river) {
      c.lineCap = 'round'; c.strokeStyle = 'rgba(10,14,20,.45)'; c.lineWidth = T2.river + 10;
      const river = () => { c.beginPath(); c.moveTo(-OVER.x, 760); c.lineTo(-20, 690); c.bezierCurveTo(330, 590, 450, 780, 680, 640); c.bezierCurveTo(880, 520, 1060, 680, W + 30, 510); c.lineTo(W + OVER.x, 420); c.stroke(); };
      river(); c.strokeStyle = tilePat(c, 'th_' + th + '_w', 0.7, 'brightness(0.9)', Wt); c.lineWidth = T2.river; river();
    }
    // 소품: 기본 지도와 같은 자리 규칙(길·가운데는 비운다)
    let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const list = [];
    for (let i = 0; i < 230; i++) {
      const x = r() * (W + OVER.x * 2) - OVER.x, y = r() * (H + OVER.y * 2) - OVER.y, s = 14 + r() * 26, pick = T2.props[Math.floor(r() * T2.props.length)];
      const inside = x > ROAD.x0 && x < ROAD.x1 && y > ROAD.y0 && y < ROAD.y1;
      if (x > -20 && x < W + 20 && y > -20 && y < H + 20 && !(x > ROAD.x0 + 70 && x < ROAD.x1 - 70 && y > ROAD.y0 + 70 && y < ROAD.y1 - 70)) continue;
      if (x > ROAD.x0 - 70 && x < ROAD.x1 + 70 && (Math.abs(y - ROAD.y0) < 70 || Math.abs(y - ROAD.y1) < 70)) continue;
      if (y > ROAD.y0 - 70 && y < ROAD.y1 + 70 && (Math.abs(x - ROAD.x0) < 70 || Math.abs(x - ROAD.x1) < 70)) continue;
      if (Math.abs(x - W / 2) < 170 && Math.abs(y - H / 2) < 130) continue;
      if (inside && i % 3) continue; // 길 안쪽은 유닛 자리라 드문드문
      list.push([x, y, s * (inside ? 2.1 * (T2.inner || 1) : 3.6), pick === 'p1' ? P1 : P2]);
    }
    list.sort((a, b) => a[1] - b[1]);
    c.filter = 'saturate(0.8) brightness(0.78)';
    list.forEach(([x, y, z, im]) => { c.drawImage(im, x - z / 2, y - z * 0.8, z, z * (im.height / im.width)); });
    c.filter = 'none';
    // 도로
    c.lineJoin = 'round'; c.strokeStyle = 'rgba(24,16,10,.8)'; c.lineWidth = 84;
    c.strokeRect(ROAD.x0, ROAD.y0, ROAD.x1 - ROAD.x0, ROAD.y1 - ROAD.y0);
    c.strokeStyle = tilePat(c, 'th_' + th + '_r', 0.5, T2.rf || 'saturate(0.8) brightness(0.82)', R); c.lineWidth = 72; c.strokeRect(ROAD.x0, ROAD.y0, ROAD.x1 - ROAD.x0, ROAD.y1 - ROAD.y0);
    if (T2.night) { c.fillStyle = T2.night; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); }
    // 가운데 건물: 유닛이 태어나는 자리라 어둡게 눌러 깐다
    const cx = (ROAD.x0 + ROAD.x1) / 2, cy = H / 2, z = 270;
    c.filter = 'saturate(0.7) brightness(0.7)'; c.drawImage(K, cx - z / 2, cy - z * (K.height / K.width) * 0.58, z, z * (K.height / K.width)); c.filter = 'none';
    c.fillStyle = 'rgba(30,20,12,.75)'; c.fillRect(cx - 52, cy + 70, 104, 40);
    c.fillStyle = '#ffe2a0'; c.font = '900 30px "Noto Serif KR", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(T2.label, cx, cy + 91);
    c.restore();
    return true;
  }
  function paintMap(c, w, h, theme) {
    const th = theme === undefined ? curTheme() : theme && MAP_THEMES[theme] ? theme : null;
    if (th && paintTheme(c, w, h, th)) return;
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
  function poseOf(u, t, r) {
    const f = u.face == null ? Math.PI / 2 : u.face, dir = Art.facing(f), p = { flip: !!dir.flip, v: dir.v, frame: 0, x: 0, y: 0, rot: 0, sy: 1 };
    if (u.moveT > 0) { const w = t * 15 + (u.id || u.uid || 0); p.y -= Math.abs(Math.sin(w)) * r * 0.12; p.frame = Math.sin(w) > 0 ? 1 : 2; p.sy = 1 + Math.abs(Math.cos(w)) * 0.03; }
    if (u.atkT > 0) {
      // 무기 계열마다 다른 공격 동작: q는 동작 진행(0→1)
      const q = 1 - Math.min(1, u.atkT / 0.22), wp = g.weapon(u.def), side = p.flip ? -1 : 1, cx = Math.cos(f), cy = Math.sin(f);
      const kind = ATK_KIND[wp] || 'slash';
      if (kind === 'thrust') {
        // 창: 뒤로 당겼다가 길게 찌른다
        const d = q < 0.3 ? -q / 0.3 * 0.35 : Math.sin(((q - 0.3) / 0.7) * Math.PI) * 1.15;
        p.x += cx * r * d; p.y += cy * r * d; p.sy = 1 - 0.08 * Math.max(0, d);
      } else if (kind === 'slash') {
        // 검: 한 바퀴 휘두르며 살짝 뛰어든다
        p.rot += side * (-0.6 + q * 1.4) * Math.sin(q * Math.PI); const d = Math.sin(q * Math.PI) * 0.45;
        p.x += cx * r * d; p.y += cy * r * d - Math.sin(q * Math.PI) * r * 0.15;
      } else if (kind === 'heavy') {
        // 대도·도끼·철퇴: 크게 들어 올렸다가 내리찍는다
        if (q < 0.5) { const k = q / 0.5; p.rot -= side * 0.45 * k; p.y -= r * 0.35 * k; p.sy = 1 + 0.08 * k; }
        else { const k = (q - 0.5) / 0.5; p.rot += side * (0.55 - 0.55 * k); p.x += cx * r * 0.5 * (1 - k); p.y += cy * r * 0.5 * (1 - k) + r * 0.05; p.sy = 0.86 + 0.14 * k; }
      } else if (kind === 'ranged') {
        // 활: 시위를 놓으며 뒤로 밀린다
        const k = Math.sin(q * Math.PI); p.x -= cx * r * 0.32 * k; p.y -= cy * r * 0.32 * k; p.rot -= side * 0.12 * k; p.sy = 1 + 0.05 * k;
      } else {
        // 술사: 떠오르며 기를 모아 쏜다
        const k = Math.sin(q * Math.PI); p.y -= r * 0.3 * k; p.sy = 1 + 0.12 * k; p.cast = k;
      }
    }
    return p;
  }
  // 보스전 버프 표시: 걸려 있는 동안 발밑에 장판이 깔리고, 남은 시간만큼 테두리 호가 줄어든다
  const BUFF_LOOK = {
    buff: { c: '#ffb347', n: I.t('buff_buff') }, rally: { c: '#ffe07a', n: I.t('buff_rally') }, cover: { c: '#9ec0f0', n: I.t('buff_cover') }, psh: { c: '#d8ecff', n: I.t('buff_psh') }, haste: { c: '#ffd27a', n: I.t('buff_haste') }, taunt: { c: '#8fb0d8', n: I.t('buff_taunt') }, shield: { c: '#d8ecff', n: I.t('buff_shield') },
  };
  function drawBuffs(c, u, t) {
    const list = [];
    if (u.buffT > 0 && u.buff > 0) list.push(['buff', u.buffT, buffMax(u, 'buff')]);
    if (u.pbuffT > 0) list.push(['rally', u.pbuffT, u.pbuffMax || 6]);
    if (u.tauntT > 0) list.push(['taunt', u.tauntT, buffMax(u, 'taunt')]);
    if (u.shieldT > 0) list.push(['shield', u.shieldT, buffMax(u, 'shield')]);
    if (u.coverT > 0) list.push(['cover', u.coverT, u.coverMax || 4]);
    if (u.pshT > 0) list.push(['psh', u.pshT, u.pshMax || 3]);
    if (u.hasteT > 0) list.push(['haste', u.hasteT, u.hasteMax || 6]);
    list.forEach(([k, left, max], i) => {
      const L = BUFF_LOOK[k], rx = 48 + i * 12, ry = rx * 0.45, cy = u.y + 24, frac = Math.max(0, Math.min(1, left / (max || left)));
      c.save();
      // 바닥 장판: 은은하게 맥동
      const spr = glowSprite('b' + L.c, [[0, L.c + '00'], [0.7, L.c + '44'], [0.98, L.c + 'aa'], [1, L.c + '00']]);
      c.globalAlpha = 0.75 + Math.sin(t * 6 + i) * 0.15; c.drawImage(spr, u.x - rx, cy - ry, rx * 2, ry * 2);
      // 남은 시간 호
      c.globalAlpha = 1; c.strokeStyle = L.c; c.lineWidth = 3; c.shadowColor = L.c; c.shadowBlur = 10;
      c.beginPath(); c.ellipse(u.x, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.stroke();
      // 도는 문양 점
      c.fillStyle = '#fff';
      for (let j = 0; j < 3; j++) { const a = t * 2.5 + (j * Math.PI * 2) / 3 + i; c.beginPath(); c.arc(u.x + Math.cos(a) * rx, cy + Math.sin(a) * ry, 2.5, 0, 7); c.fill(); }
      c.restore();
      if (k === 'shield') { c.save(); c.strokeStyle = L.c; c.globalAlpha = 0.6; c.lineWidth = 3; c.beginPath(); c.arc(u.x, u.y - 10, 40, 0, 7); c.stroke(); c.restore(); }
    });
    // 머리 위에 걸린 버프 이름
    if (list.length) {
      c.save(); c.font = '700 13px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center';
      list.forEach(([k, left], i) => { const L = BUFF_LOOK[k]; c.fillStyle = 'rgba(16,10,6,.7)'; c.fillRect(u.x - 34, u.y - 96 - i * 17, 68, 15); c.fillStyle = L.c; c.fillText(`${L.n} ${Math.ceil(left)}s`, u.x, u.y - 84 - i * 17); });
      c.restore();
    }
  }
  // 그 버프를 건 스킬의 원래 지속 시간(남은 시간 비율 계산용)
  function buffMax(u, k) {
    const s = (u.def.sk || []).find((x) => (k === 'buff' ? x.k === 'buff' : k === 'taunt' ? x.k === 'taunt' : x.k === 'shield'));
    return s ? s.dur : 0;
  }
  // 발밑 원판은 색·굵기별로 한 번 그려 두고 찍는다(유닛마다 매 프레임 타원을 채우고 테두리를 긋던 것)
  const DISC = {};
  function discSprite(col, thick) {
    const key = col + (thick ? 't' : '');
    if (DISC[key]) return DISC[key];
    const cv = document.createElement('canvas'); cv.width = 100; cv.height = 48;
    const x = cv.getContext('2d');
    x.fillStyle = col; x.globalAlpha = 0.72; x.beginPath(); x.ellipse(50, 24, 46, 20.3, 0, 0, 7); x.fill();
    x.globalAlpha = 1; x.strokeStyle = 'rgba(20,12,6,.75)'; x.lineWidth = thick ? 3.8 : 1.9; x.stroke();
    return (DISC[key] = cv);
  }
  function piece(c, x, y, r, d, t, ownerAI, opt) {
    const tier = d.tier, col = tierColor(tier), seed = (x * 7 + y * 13) % 6.28;
    opt = opt || {};
    // 등급 후광: 6성부터. 등급이 오를 때마다 한 단계씩 더해진다.
    // 6성 은은한 빛 → 7성 발밑 회전 고리 → 전설 회전 호와 오르는 불티 → 신화 바닥 법진과 궤도 구슬 → 불멸 빛기둥과 이중 고리
    // 후광 유닛이 많아질수록(판 후반) 유닛마다 덧그리는 빛을 줄인다: 지난 프레임에 그린 후광 수로 단계를 정한다
    let lod = 2;
    if (tier >= 6) { S.auraN = (S.auraN || 0) + 1; const n = S.auraPrev || 0; lod = n <= (Q.coarse ? 4 : 10) ? 2 : n <= (Q.coarse ? 10 : 22) ? 1 : 0; }
    const kAura = tier >= 6 && window.RTD_SKFX && window.RTD_SKFX.tierAura(c, x, y, r, tier, col, t, seed, Q.level === 'low', lod);
    if (tier >= 6 && !kAura) {
      const pulse = 1 + Math.sin(t * 3 + seed) * 0.1, big = tier >= 9 ? 2.5 : tier >= 8 ? 2.1 : tier >= 7 ? 1.9 : 1.6;
      const a0 = tier >= 8 ? 'aa' : '88', R = r * big * pulse;
      c.drawImage(glowSprite('a' + col + a0, [[0, col + a0], [0.5 / big, col + a0], [1, col + '00']]), x - R, y - R, R * 2, R * 2);
    }
    if (tier >= 7 && !kAura) {
      // 발밑에서 도는 점선 고리
      c.save(); c.strokeStyle = col; c.lineWidth = 2; c.globalAlpha = 0.8; c.setLineDash([6, 6]); c.lineDashOffset = -t * 30;
      c.beginPath(); c.ellipse(x, y + r * 0.72, r * 1.35, r * 0.6, 0, 0, 7); c.stroke(); c.restore();
    }
    if (tier >= 9 && !kAura) Art.fxImg(c, 'magic', x, y + r * 0.72, r * 3.4, t * 0.8, 0.55, 0.42);
    if (tier >= 8 && !kAura) {
      c.strokeStyle = col; c.lineWidth = tier >= 9 ? 3 : 2;
      const n = tier >= 9 ? 3 : 2;
      for (let i = 0; i < n; i++) { const a = t * 2.2 + (i * Math.PI * 2) / n; c.beginPath(); c.arc(x, y, r * 1.5, a, a + 1); c.stroke(); }
      // 위로 떠오르는 불티(낮음 화질은 생략)
      c.fillStyle = col;
      for (let i = 0; i < (Q.level === 'low' ? 0 : tier >= 10 ? 7 : 4); i++) {
        const k = ((t * 0.6 + i / 4 + seed) % 1), px = x + Math.sin(i * 2.3 + seed) * r * 0.9;
        c.globalAlpha = 1 - k; c.beginPath(); c.arc(px, y + r * 0.6 - k * r * 2.4, 2.2 + (1 - k) * 1.5, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    }
    if (tier >= 9 && !kAura && Q.level !== 'low') for (let i = 0; i < (tier >= 10 ? 8 : 5); i++) {
      // 궤도를 도는 빛 구슬
      const a = -t * 1.6 + (i * Math.PI * 2) / (tier >= 10 ? 8 : 5), rr = r * (1.85 + Math.sin(t * 2 + i) * 0.2);
      c.fillStyle = i % 2 ? '#ffffff' : col; c.beginPath(); c.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, 3, 0, 7); c.fill();
    }
    if (tier >= 10 && !kAura) {
      // 불멸: 솟는 빛기둥과 바깥 이중 고리
      c.globalAlpha = 0.55 + Math.sin(t * 4 + seed) * 0.2; c.drawImage(pillarSprite(col), x - r * 0.7, y - r * 3.2, r * 1.4, r * 4.2); c.globalAlpha = 1;
      c.save(); c.strokeStyle = '#fff0c8'; c.lineWidth = 1.5; c.globalAlpha = 0.7; c.setLineDash([3, 9]); c.lineDashOffset = t * 40;
      c.beginPath(); c.ellipse(x, y + r * 0.72, r * 1.7, r * 0.78, 0, 0, 7); c.stroke(); c.restore();
    }
    // 발밑 원판: 등급 색으로 멀리서도 구별된다
    { const sp = discSprite(col, tier >= 6), k = (r * 0.95) / 46; c.drawImage(sp, x - 50 * k, y + r * 0.72 - 24 * k, 100 * k, 48 * k); }
    const p = opt.pose || { x: 0, y: 0 };
    if (p.cast) Art.fxImg(c, 'magic', x, y + r * 0.7, r * 2.6 * (0.7 + p.cast * 0.4), t * 2, p.cast, 0.45);
    // 조각 애니메이션이 있는 장수는 조각으로 그린다(동작 상태는 보스전이 넘겨 주고, 라인에서는 옆모습일 때만 걷기·대기 + 기존 자세 흔들림)
    const RG = window.RTD_RIG;
    // 화질 '낮음'에서는 라인의 조각 그리기를 끈다(유닛이 많을 때 느려지는 기기 보호. 보스전은 그대로)
    if (RG && (opt.rig || (p.v === 2 && Q.level !== 'low')) && RG.has(d.id)) {
      const st = opt.rig || { state: p.frame ? 'walk' : 'idle', t };
      c.save(); c.translate(x + (opt.rig ? 0 : p.x), y + (opt.rig ? 0 : p.y)); if (!opt.rig && p.rot) c.rotate(p.rot);
      RG.draw(c, d.id, 0, 0, r * 3.7, p.flip, st); c.restore();
    } else Art.drawSprite(c, Art.unitSprite(d, p.v, p.frame), x + p.x, y + p.y + Math.sin(t * 3 + x) * 0.6, r * 3.7, p.flip, p.rot, p.sy);
    if (ownerAI) { c.fillStyle = '#7fd4ff'; c.fillRect(x - r, y - r * 1.5, r * 2, 2.5); }
  }
  function bar(c, x, y, w, h, f, col) {
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - w / 2, y, w, h);
    c.fillStyle = col; c.fillRect(x - w / 2, y, w * Math.max(0, f), h);
  }
  function drawFx(c) {
    if (window.RTD_SKFX) window.RTD_SKFX.setQuality(Q.level === 'low' ? 0.5 : Q.level === 'mid' ? 0.75 : 1);
    for (const f of g.fx) {
      if (f.t < 0) continue;
      const p = f.t / f.life;
      // 스킬 연출: 새 이펙트(skillfx.js)가 그리면 기존 모양은 건너뛴다
      if (f.vx && window.RTD_SKFX && window.RTD_SKFX.fx(c, f, p)) { c.globalAlpha = 1; continue; }
      if (f.k === 'shot') { c.globalAlpha = Math.min(1, (1 - p) * 3); Art.shot(c, f); c.globalAlpha = 1; continue; }
      c.globalAlpha = 1 - p;
      c.strokeStyle = f.c; c.fillStyle = f.c;
      if (f.k === 'ring') { c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, f.r * (0.5 + p * 0.5), 0, 7); c.stroke(); }
      // 타격: 프레임 애니메이션(평타는 작은 타격, 강타·스킬은 큰 타격)
      else if (f.k === 'spark' && Art.fxAnim(c, f.r < 60 ? 'hit2' : 'hit', p, f.x, f.y, f.r * 3.2, f.r * 3.2, f.a, 1)) { /* 애니메이션 이펙트 */ }
      else if (f.k === 'spark' && Art.fxImg(c, 'hit', f.x, f.y, f.r * 2.4 * (0.7 + p * 0.5), f.a, 1 - p)) { /* 생성 이펙트 */ }
      else if (f.k === 'spark') {
        // 타격 지점의 방사형 불꽃
        c.lineWidth = 3; c.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const a = f.a + (i - 2.5) * 0.7, a1 = f.r * (0.3 + p * 0.5), a2 = f.r * (0.6 + p); c.beginPath(); c.moveTo(f.x + Math.cos(a) * a1, f.y + Math.sin(a) * a1); c.lineTo(f.x + Math.cos(a) * a2, f.y + Math.sin(a) * a2); c.stroke(); }
        c.fillStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, f.r * 0.4 * (1 - p), 0, 7); c.fill();
      } else if (f.k === 'die') {
        // 처치: 튕겨 나가며 쓰러진다
        c.globalAlpha = 1 - p;
        Art.drawSprite(c, f.e.mid && f.e.w.look ? Art.namedSprite(f.e.w.name, f.e.w.look, '#b5361f') : Art.soldierSprite(f.e.w), f.x + Math.cos(f.a) * 34 * p, f.y + Math.sin(f.a) * 34 * p - Math.sin(p * 3.14) * 22, f.e.mid ? 76 : 48, false, p * 1.5);
      } else if (f.k === 'dash') { c.lineWidth = 16 * (1 - p); c.beginPath(); c.moveTo(f.x0, f.y0); c.lineTo(f.x1, f.y1); c.stroke(); }
      else if (f.k === 'beam') {
        // 직선 스킬: 앞머리가 달려 나가고 뒤로 잔광이 남는다
        const head = Math.min(1, p * 2.6) * f.len, tail = Math.max(0, (p - 0.4) / 0.6) * f.len;
        c.save(); c.translate(f.x, f.y); c.rotate(f.a);
        const gr = c.createLinearGradient(tail, 0, head, 0); gr.addColorStop(0, f.c + '00'); gr.addColorStop(0.7, f.c + 'cc'); gr.addColorStop(1, '#ffffff');
        c.globalAlpha = 1; c.fillStyle = gr; c.fillRect(tail, -f.w / 2, Math.max(1, head - tail), f.w);
        c.fillStyle = '#fff'; c.globalAlpha = 0.8 * (1 - p); c.fillRect(tail, -f.w / 7, Math.max(1, head - tail), f.w / 3.5);
        c.globalAlpha = 1 - p; c.fillStyle = '#fff'; c.beginPath(); c.arc(head - f.w * 0.45, 0, f.w * 0.7, -1.2, 1.2); c.arc(head - f.w * 0.75, 0, f.w * 0.6, 1.05, -1.05, true); c.closePath(); c.fill();
        c.restore();
      } else if (f.k === 'cone') {
        // 부채꼴 스킬: 호가 바깥으로 퍼진다
        for (let i = 0; i < 3; i++) {
          const rr = f.r * Math.min(1, p * 1.5 + i * 0.16);
          c.globalAlpha = (1 - p) * (0.5 - i * 0.12); c.beginPath(); c.moveTo(f.x, f.y); c.arc(f.x, f.y, rr, f.a - f.arc / 2, f.a + f.arc / 2); c.closePath(); c.fill();
        }
        c.globalAlpha = 1 - p; c.lineWidth = 8; c.strokeStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, f.r * Math.min(1, p * 1.5), f.a - f.arc / 2, f.a + f.arc / 2); c.stroke();
        Art.fxImg(c, 'slash', f.x + Math.cos(f.a) * f.r * 0.55, f.y + Math.sin(f.a) * f.r * 0.55, f.r * 1.3, f.a + Math.PI / 2, (1 - p) * 1.5);
      } else if (f.k === 'blast') {
        // 지정 위치 스킬의 폭발
        if (!Art.fxAnim(c, 'boom', p, f.x, f.y - f.r * 0.2, f.r * 3.4, f.r * 3.4, 0, 1)) Art.fxImg(c, 'boom', f.x, f.y, f.r * 2.6 * (0.7 + p * 0.5), p, (1 - p) * 1.4);
        c.globalAlpha = (1 - p) * 0.7; c.beginPath(); c.arc(f.x, f.y, f.r * (0.6 + p * 0.5), 0, 7); c.fill();
        c.globalAlpha = 1 - p; c.fillStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, f.r * 0.5 * (1 - p), 0, 7); c.fill();
        c.lineWidth = 6; c.beginPath(); c.arc(f.x, f.y, f.r * (0.8 + p * 0.6), 0, 7); c.stroke();
        for (let i = 0; i < 10; i++) { const a = i * 0.63, d1 = f.r * (0.5 + p), d2 = f.r * (0.7 + p * 1.2); c.lineWidth = 3; c.beginPath(); c.moveTo(f.x + Math.cos(a) * d1, f.y + Math.sin(a) * d1); c.lineTo(f.x + Math.cos(a) * d2, f.y + Math.sin(a) * d2); c.stroke(); }
      } else if (f.k === 'aura') {
        // 강화·보호·회복: 바닥 법진, 빛 고리와 위로 오르는 입자
        Art.fxImg(c, 'magic', f.x, f.y + 20, f.r * 2.4, p * 2, (1 - p) * 1.2, 0.45);
        c.lineWidth = 5; c.beginPath(); c.ellipse(f.x, f.y + 20, f.r * (0.5 + p * 0.5), f.r * 0.3 * (0.5 + p * 0.5), 0, 0, 7); c.stroke();
        c.fillStyle = f.c;
        for (let i = 0; i < 12; i++) { const a = i * 0.52, rr = f.r * 0.6; c.beginPath(); c.arc(f.x + Math.cos(a) * rr, f.y + 20 + Math.sin(a) * rr * 0.5 - p * 110 - (i % 3) * 14, 4, 0, 7); c.fill(); }
      }
    }
    c.globalAlpha = 1;
  }
  // 작은 화면(휴대폰)에서는 전장이 축소돼 글씨가 깨알만 해진다. 전장 위 글씨·막대를 그만큼 키우는 배율(1~1.7).
  const uiS = () => Math.max(1, Math.min(1.7, 0.62 / ((S.base && S.base.s0 ? S.base.s0 : 1) * (S.cam ? S.cam.z : 1))));
  function drawText(c) {
    c.textAlign = 'center';
    const us = uiS();
    for (let i = S.dmg.length - 1; i >= 0; i--) {
      const d = S.dmg[i]; d.t += S.fdt;
      if (d.proc) {
        // 패시브 발동 글자: 튀어나오듯 커졌다가 떠오르며 사라진다
        if (d.t > 1.1) { S.dmg.splice(i, 1); continue; }
        const s = d.t < 0.12 ? 0.6 + d.t / 0.12 * 0.6 : 1.2 - Math.min(0.2, (d.t - 0.12));
        c.save(); c.translate(d.x, d.y - d.t * 34); c.scale(s * us, s * us);
        c.globalAlpha = d.t > 0.8 ? (1.1 - d.t) / 0.3 : 1;
        c.font = '400 26px "Black Han Sans", sans-serif'; c.lineJoin = 'round';
        c.strokeStyle = 'rgba(20,12,6,.9)'; c.lineWidth = 6; c.strokeText(d.v, 0, 0);
        c.shadowColor = d.c; c.shadowBlur = 14; c.fillStyle = '#fff6c8'; c.fillText(d.v, 0, 0);
        c.restore();
        continue;
      }
      if (d.hit || d.big) {
        // 보스 피해 숫자: 톡 튀어나왔다가 떠오르며 사라진다. 강타는 크고 금빛으로 통통 튄다.
        const L = d.big ? 1.0 : 0.7;
        if (d.t > L) { S.dmg.splice(i, 1); continue; }
        const s = d.t < 0.08 ? 0.5 + d.t / 0.08 * (d.big ? 1.0 : 0.6) : (d.big ? 1.5 : 1.1) - Math.min(d.big ? 0.4 : 0.1, (d.t - 0.08) * 2);
        c.save(); c.translate(d.x, d.y - d.t * (d.big ? 40 : 55)); c.scale(s * us, s * us);
        c.globalAlpha = d.t > L - 0.25 ? (L - d.t) / 0.25 : 1;
        c.font = `400 ${d.big ? 34 : 22}px "Black Han Sans", sans-serif`; c.lineJoin = 'round';
        c.strokeStyle = 'rgba(16,8,4,.95)'; c.lineWidth = d.big ? 7 : 5; const txt = typeof d.v === 'string' ? d.v : fmt(d.v); c.strokeText(txt, 0, 0);
        if (d.big) { c.shadowColor = '#ff9a2a'; c.shadowBlur = 16; }
        c.fillStyle = d.big ? '#ffd24a' : '#fff4dc'; c.fillText(txt, 0, 0);
        c.restore();
        continue;
      }
      if (d.t > 0.8) { S.dmg.splice(i, 1); continue; }
      c.globalAlpha = 1 - d.t / 0.8; c.fillStyle = d.big ? '#ffd86a' : '#fff';
      c.font = `900 ${Math.round((d.big ? 30 : 20) * us)}px "Noto Serif KR", serif`; c.fillText(typeof d.v === 'string' ? d.v : fmt(d.v), d.x, d.y - d.t * 50);
    }
    c.globalAlpha = 1;
  }

  // 업적 깃발: 위아래 여백에 나란히 세운다. 달성하면 색이 차고 금색 별이 붙는다.
  const ACH_COLOR = { collect: '#4d8fd8', speed: '#e0b13c', bond: '#c9483a', party: '#46a868' };
  const achKind = (a) => (a.cond.type === 'party' ? 'party' : a.cond.type === 'speed' ? 'speed' : a.cond.type === 'have' || a.cond.type === 'haveSet' || (a.cond.type === 'haveEach' && a.cond.units.length < 5) ? 'bond' : 'collect');
  const achTier = (a) => { const c = a.cond, ids = c.units || c.anyOf || []; return c.tier || c.sameTierDistinct || ids.reduce((m, id) => Math.max(m, defOf[id] ? defOf[id].tier : 0), 1); };
  // 깃발 글자: 수집은 등급, 전광석화는 전장, 나머지는 첫 낱말 첫 글자 + 끝 낱말 첫 글자
  const achLabel = (a) => {
    const k = achKind(a);
    if (k === 'collect' && (a.cond.type === 'ever' || a.cond.type === 'haveEach')) return rankTag(achTier(a));
    const n = a.name.replace(/^[[［][^\]］]*[\]］]\s*/, '').replace(/^[^:：]*[:：]\s*/, ''), w = n.split(' ');
    if (k === 'speed' || w.length === 1) return n.slice(0, 2);
    return w[0][0] + w[w.length - 1][0];
  };
  // 오른쪽 여백에 3열로 모아 세운다
  const flagPos = () => {
    const rows = Math.ceil(T.achievements.length / 3), step = Math.min(68, 820 / (rows - 1));
    return T.achievements.map((a, i) => ({ a, x: W - 174 + Math.floor(i / rows) * 58, y: 128 + (i % rows) * step }));
  };
  const FLAGS = flagPos();
  // 전황: 왼쪽 맵 여백에 세로로 놓는다
  function drawStats() {
    const c = ctx, vp = viewedPeer(), ln = vp && vp.state.ln;
    const gold = ln ? ln.g : g.me.gold, lives = ln ? ln.l : g.lives, en = ln ? ln.n : g.enemyCount(), own = ln ? ln.u.length : g.units.filter((u) => u.owner === 0).length;
    const rows = [
      [I.t('round'), `${g.round}/${g.diff.rounds}`, '#ffd86a'], [g.diff.name, g.phase === 'wave' ? clock(Math.max(0, g.R.roundTime - g.roundT)) : g.phase === 'boss' && g.fight ? I.t('duel') + ' ' + clock(Math.max(0, g.fight.limit - g.fight.t)) : I.t('duel'), '#f4ecd8'],
      [T.currency, fmt(gold), '#ffd86a'], [I.t('lives'), `${lives}/${g.R.lives}`, lives <= 5 ? '#ff7a60' : '#f4ecd8'],
      [I.t('front'), `${en}/${g.limit}`, en > g.limit * 0.75 ? '#ff7a60' : '#f4ecd8'], [I.t('troops'), String(own), '#f4ecd8'],
    ];
    const x = 10, w = 128, y0 = 130, step = 112;
    c.fillStyle = 'rgba(20, 14, 10, .78)'; c.fillRect(x, y0, w, step * rows.length + 16);
    c.strokeStyle = '#cda75b'; c.lineWidth = 2; c.strokeRect(x, y0, w, step * rows.length + 16);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    rows.forEach(([l, v, col], i) => {
      const y = y0 + 8 + i * step;
      c.fillStyle = '#b8a888'; c.font = '500 21px "IBM Plex Sans KR", sans-serif'; c.fillText(l, x + w / 2, y + 30);
      c.fillStyle = col; c.font = `400 ${v.length > 6 ? 30 : 38}px "Black Han Sans", sans-serif`; c.fillText(v, x + w / 2, y + 70);
    });
  }
  // 게임 로고: 왼쪽 맵 여백 맨 위, 전황 패널 바로 위
  function drawLogo(c) {
    // 맵이 아니라 화면 왼쪽 끝을 기준으로 붙인다
    const x = 8 - S.ox / S.scale, y = 4 - S.oy / S.scale;
    c.save();
    c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(32, 21, 12, .85)';
    c.font = '900 46px "Noto Serif KR", serif'; c.lineWidth = 7; c.strokeText('三國志', x, y + 50);
    c.fillStyle = '#e6c578'; c.fillText('三國志', x, y + 50);
    c.font = '700 20px "Noto Serif KR", serif'; c.lineWidth = 4; c.fillStyle = '#f4ecd8';
    c.strokeText('RANDOM', x + 2, y + 78); c.fillText('RANDOM', x + 2, y + 78);
    c.strokeText('DEFENSE', x + 2, y + 100); c.fillText('DEFENSE', x + 2, y + 100);
    c.restore();
  }
  // 깃발 28개는 글자·도형이 많아 매 프레임 그리면 무겁다. 달성 상태가 바뀔 때만 다시 그려 두고 한 장으로 찍는다.
  let flagCv = null, flagKey = '';
  // 깃발 그림(gfx/ach_*.png, Higgsfield 생성): 밝은 천 그림을 등급 색으로 물들여 쓴다. 종류: 수집=깃발, 전광석화=펄럭이는 기, 협동=세로 군기, 인연=성루
  const ACH_PIC = { collect: 'flag', speed: 'pennant', party: 'banner', bond: 'castle' }, ACH_IM = {}, ACH_TINT = {};
  let achLoaded = 0;
  if (typeof Image !== 'undefined') Object.values(ACH_PIC).forEach((n) => { const im = new Image(); im.onload = () => { ACH_IM[n] = im; achLoaded++; }; im.src = 'gfx/ach_' + n + '.png?v=1'; });
  function achSprite(n, col) {
    const im = ACH_IM[n], key = n + col;
    if (!im) return null;
    if (!ACH_TINT[key]) {
      const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
      const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
      // 곱하기로 물들여 천의 주름·명암을 살리고, 원래 모양대로 다시 잘라 낸다
      x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
      ACH_TINT[key] = cv;
    }
    return ACH_TINT[key];
  }
  function drawFlags(c) {
    const key = Object.keys(g.me.done).join() + '|' + g.mode + g.party + '|' + (I.lang || '') + '|' + achLoaded;
    if (flagKey !== key || !flagCv) {
      flagKey = key;
      if (!flagCv) { flagCv = document.createElement('canvas'); flagCv.width = 220; flagCv.height = H; }
      const x = flagCv.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 220, H); x.translate(-(W - 205), 0);
      paintFlags(x);
    }
    c.drawImage(flagCv, W - 205, 0);
  }
  function paintFlags(c) {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.font = '400 34px "Black Han Sans", sans-serif'; c.strokeStyle = 'rgba(32, 21, 12, .85)'; c.lineWidth = 6;
    c.strokeText(I.t('ach'), W - 98, 38); c.fillStyle = '#e6c578'; c.fillText(I.t('ach'), W - 98, 38);
    for (const f of FLAGS) {
      const done = g.me.done[f.a.id], kind = achKind(f.a), col = tierColor(achTier(f.a));
      // 인원이 모자라 열리지 않는 협동 업적은 흐리게
      const closed = kind === 'party' && !g.partyAchOpen(f.a.cond);
      c.globalAlpha = done ? 1 : closed ? 0.18 : 0.55;
      c.save(); c.translate(f.x, f.y);
      const label = achLabel(f.a);
      const sp = achSprite(ACH_PIC[kind], col);
      if (sp) {
        // 그림 깃발: 높이를 맞춰 세우고 천 가운데에 글자를 쓴다
        const hh = kind === 'bond' ? 50 : 66, ww = (hh * sp.width) / sp.height, AT = { collect: [0.56, 0.47], speed: [0.56, 0.36], party: [0.52, 0.43], bond: [0.5, 0.66] }[kind];
        c.drawImage(sp, kind === 'bond' ? -2 : -4, -hh, ww, hh);
        c.fillStyle = '#fff'; c.strokeStyle = 'rgba(20,14,10,.85)'; c.lineWidth = 3.5; c.font = `700 ${label.length > 2 ? 13 : 15}px "IBM Plex Sans KR", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        const tx = (kind === 'bond' ? -2 : -4) + ww * AT[0], ty = -hh + hh * AT[1];
        c.strokeText(label, tx, ty); c.fillText(label, tx, ty);
        if (done) { c.fillStyle = '#ffd86a'; c.strokeStyle = 'rgba(20,14,10,.9)'; c.lineWidth = 3; c.font = '900 19px "Noto Serif KR", serif'; c.strokeText('★', ww - 4, -hh + 6); c.fillText('★', ww - 4, -hh + 6); }
        c.restore(); c.globalAlpha = 1; continue;
      }
      if (kind === 'speed' || kind === 'party') {
        // 전광석화는 삼각 깃, 협동은 세로 군기. 테두리 색으로 종류를 한 번 더 구분한다.
        c.strokeStyle = '#2a1c10'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -60); c.stroke();
        c.fillStyle = col; c.strokeStyle = ACH_COLOR[kind]; c.lineWidth = 3; c.beginPath();
        if (kind === 'speed') { c.moveTo(0, -60); c.lineTo(50, -42); c.lineTo(0, -24); }
        else { c.moveTo(2, -60); c.lineTo(40, -60); c.lineTo(40, -18); c.lineTo(21, -26); c.lineTo(2, -18); }
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#fff'; c.strokeStyle = 'rgba(20,14,10,.8)'; c.lineWidth = 3; c.font = '700 15px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.strokeText(label, kind === 'speed' ? 16 : 21, kind === 'speed' ? -42 : -40); c.fillText(label, kind === 'speed' ? 16 : 21, kind === 'speed' ? -42 : -40);
      } else if (kind === 'bond') {
        // 인연 업적은 성 모양
        c.fillStyle = col; c.fillRect(0, -44, 46, 44);
        for (let i = 0; i < 3; i++) c.fillRect(i * 19, -54, 8, 11);
        c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(23, -4, 7, Math.PI, 0); c.lineTo(30, 0); c.lineTo(16, 0); c.fill();
        c.strokeStyle = '#2a1c10'; c.lineWidth = 2; c.strokeRect(0, -44, 46, 44);
        c.fillStyle = '#fff'; c.strokeStyle = 'rgba(20,14,10,.8)'; c.lineWidth = 3; c.font = '700 16px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText(label, 23, -24); c.fillText(label, 23, -24);
      } else {
        c.strokeStyle = '#2a1c10'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -60); c.stroke();
        c.fillStyle = col; c.beginPath(); c.moveTo(0, -60); c.lineTo(46, -49); c.lineTo(37, -37); c.lineTo(46, -24); c.lineTo(0, -24); c.closePath(); c.fill();
        c.fillStyle = '#fff'; c.strokeStyle = 'rgba(20,14,10,.8)'; c.lineWidth = 3; c.font = '700 16px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText(label, 19, -41); c.fillText(label, 19, -41);
      }
      if (done) { c.fillStyle = '#ffd86a'; c.font = '900 18px "Noto Serif KR", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', 42, -56); }
      c.restore();
      c.globalAlpha = 1;
    }
  }
  const flagAt = (m) => FLAGS.find((f) => m.x > f.x - 6 && m.x < f.x + 50 && m.y > f.y - 64 && m.y < f.y + 4);
  function showFlag(f, e) {
    const pop = $('achpop');
    if (!f) { pop.hidden = true; return; }
    const a = f.a, c = a.cond, ids = c.units || c.anyOf || [];
    // 여러 기가 필요한 조건은 (보유/필요)를 붙이고, 다 모아야 진하게 켠다
    const chips = ids.map((id) => {
      const d = defOf[id], n = c.need ? c.need[id] : c.n, cnt = n ? g.ownedOf(g.me, id).length : 0;
      const have = c.type === 'party' ? false : n ? cnt >= n : c.type === 'ever' ? g.me.ever[id] : g.has(g.me, id);
      return `<span class="ac ${have ? 'have' : ''}" style="color:${tierColor(d.tier)}">${esc(d.name)} ${rankTag(d.tier)}${n ? ` (${Math.min(cnt, n)}/${n})` : ''}</span>`;
    }).join('');
    // 협동 업적: 지금 인원에서 필요한 수, 인원이 모자라면 비활성 안내
    const partyLine = c.type !== 'party' ? '' : g.partyAchOpen(c)
      ? `<div style="margin-top:4px">${I.t('partyNow', { n: g.party, need: I.t(c.anyOf ? 'needAtLeast' : 'needAll', { n: g.partyAchNeed(c) }) })}</div>`
      : `<div style="margin-top:4px;color:#ff7a60">${I.t('partyLack', { n: c.min })}</div>`;
    // 등급 단위 조건은 진행도를 한 줄로 보여 준다
    const tids = c.tier ? T.units.filter((d) => d.tier === c.tier).map((d) => d.id) : [];
    const prog = c.type === 'tierHave' ? tids.reduce((s, id) => s + g.ownedOf(g.me, id).length, 0)
      : c.type === 'sameHave' ? Math.max(0, ...tids.map((id) => g.ownedOf(g.me, id).length))
      : c.type === 'tierEver' ? tids.filter((id) => g.me.ever[id]).length : null;
    const progLine = prog === null ? '' : `<div class="chips"><span class="ac ${prog >= c.n ? 'have' : ''}">${I.t('progress', { a: Math.min(prog, c.n), b: c.n })}</span></div>`;
    pop.innerHTML = `<strong>${esc(a.name)}${g.me.done[a.id] ? ' ★' : ''}</strong><div>${esc(a.desc)}</div>${chips ? `<div class="chips">${chips}</div>` : ''}${progLine}${partyLine}<div style="color:var(--dim);margin-top:4px">${I.t('reward')}: ${esc(rwText(a.reward))}</div>`;
    pop.hidden = false;
    // 화면 배율 안쪽 좌표로 옮기고 창 밖으로 나가지 않게 막는다
    const x = Math.min(e.clientX / zoom + 12, window.innerWidth / zoom - pop.offsetWidth - 4);
    const y = Math.max(4, Math.min(e.clientY / zoom + 12, window.innerHeight / zoom - pop.offsetHeight - 4));
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function rwText(r) {
    return [r.randomT1 ? I.t('rwT1', { n: r.randomT1 }) : '', ...Object.keys(r.cons || {}).map((c) => I.t('rwCons', { a: T.consumables[c].name, n: r.cons[c] })), ...(r.tickets || []).map(([a, b]) => I.t('rwTicket', { r: rankName(a), n: b })), r.gold ? `${T.currency} ${r.gold.toLocaleString()}` : '', r.chest ? I.t('rwChest', { n: r.chest }) : ''].filter(Boolean).join(', ');
  }
  // 야습: 어둠을 깔고 밝힐 곳만 뚫는다(반 해상도 캔버스)
  // 라인은 성채 둘레와 내 유닛 사거리, 보스전은 내 장수·동료·보스 둘레. 보스전은 장판이 멀리서도 희미하게 보이도록 조금 옅게.
  let nightCv = null, nightHole = null;
  function drawNight(c, arena) {
    if (arena) {
      const f = g.fight, holes = [];
      f.champs.forEach((u) => { if (!u.dead && !u.bench && u.owner === g.me.idx) holes.push([u.x, u.y, 600]); });
      Object.values(f.ghosts || {}).forEach((o) => holes.push([o.x, o.y, 420]));
      return nightLayer(c, holes, 0.8);
    }
    const holes = [[(ROAD.x0 + ROAD.x1) / 2, (ROAD.y0 + ROAD.y1) / 2, 260]];
    for (const u of g.units) if (u.owner === g.me.idx && u.def.tier > 0) holes.push([u.x, u.y, g.range(u.def) + 70]);
    nightLayer(c, holes, 0.86);
  }
  function nightLayer(c, holes, alpha) {
    if (!nightCv) {
      nightCv = document.createElement('canvas'); nightCv.width = W / 2; nightCv.height = H / 2;
      nightHole = document.createElement('canvas'); nightHole.width = nightHole.height = 128;
      const x = nightHole.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    }
    const x = nightCv.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W / 2, H / 2);
    x.fillStyle = `rgba(6,8,22,${alpha})`; x.fillRect(0, 0, W / 2, H / 2);
    x.globalCompositeOperation = 'destination-out';
    for (const [px, py, r] of holes) x.drawImage(nightHole, (px - r) / 2, (py - r) / 2, r, r);
    c.drawImage(nightCv, 0, 0, W, H);
    // 지도 바깥 여백도 어둡게
    c.fillStyle = `rgba(6,8,22,${alpha})`;
    c.fillRect(-W, -H, W * 3, H); c.fillRect(-W, H, W * 3, H); c.fillRect(-W, 0, W, H); c.fillRect(W, 0, W, H);
  }
  function drawLane(t) {
    const c = ctx;
    blitBg(c, mapCv, 'map', mapVer);
    drawFlags(c);
    for (const p of S.pings) { p.t += S.fdt; c.strokeStyle = p.c; c.globalAlpha = 1 - p.t / 0.5; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, 8 + p.t * 40, 0, 7); c.stroke(); c.globalAlpha = 1; }
    S.pings = S.pings.filter((p) => p.t < 0.5);
    for (const e of g.enemies) {
      if (e.mid) {
        c.strokeStyle = '#e8c15a'; c.lineWidth = 3; c.beginPath(); c.ellipse(e.x, e.y + 20, 28, 12, 0, 0, 7); c.stroke();
        const v = [2, 0, 2, 4][e.seg], fr = Math.sin(t * 13) > 0 ? 1 : 2, img = e.w.look ? Art.namedSprite(e.w.name, e.w.look, '#b5361f', v, fr) : Art.soldierSprite({ name: e.w.name, color: '#b5361f', hat: 'helm', weapon: 'guandao' }, v, fr);
        // 놓치기 10초 전: 붉은 오라가 발밑에서 천천히 차올랐다가 가라앉기를 2초마다 되풀이(깜빡임·떨림 없음)
        const warn = e.midT <= 10;
        if (warn) {
          const w = (1 - Math.cos(t * Math.PI)) / 2, top = e.y + 26 - (30 + w * 70), base = e.y + 26;
          c.save(); c.globalCompositeOperation = 'lighter';
          const gr = c.createLinearGradient(0, base, 0, top);
          gr.addColorStop(0, 'rgba(255,50,30,.55)'); gr.addColorStop(0.6, 'rgba(255,60,30,.22)'); gr.addColorStop(1, 'rgba(255,60,30,0)');
          c.fillStyle = gr; c.beginPath(); c.ellipse(e.x, (base + top) / 2, 40, (base - top) / 2 + 6, 0, 0, 7); c.fill();
          c.globalAlpha = 0.5; c.strokeStyle = '#ff4a3a'; c.lineWidth = 3; c.beginPath(); c.ellipse(e.x, e.y + 20, 36, 15, 0, 0, 7); c.stroke();
          c.restore();
        }
        Art.drawSprite(c, img, e.x, e.y, 96, e.seg === 2);
        bar(c, e.x, e.y - 50, 74, 6, e.hp / e.mhp, '#ff6a50');
        c.textAlign = 'center';
        if (warn) { c.fillStyle = '#ff6a50'; c.font = '400 22px "Black Han Sans", sans-serif'; c.fillText(I.t('midLeft', { name: e.w.name, n: Math.ceil(e.midT) }), e.x, e.y - 60); }
        else { c.fillStyle = '#ffe9a8'; c.font = '700 15px "IBM Plex Sans KR", sans-serif'; c.fillText(`${e.w.name} ${Math.ceil(e.midT)}`, e.x, e.y - 58); }
      } else {
        const hit = (e.hitT || 0) / 0.14, ex = e.x + Math.cos(e.hitA || 0) * 7 * hit, ey = e.y + Math.sin(e.hitA || 0) * 7 * hit - Math.abs(Math.sin(t * 12 + e.id)) * 3;
        const v = [2, 0, 2, 4][e.seg], img = Art.soldierSprite(e.w, v, Math.sin(t * 11 + e.id) > 0 ? 1 : 2), sz = e.elite ? 96 : 60;
        if (e.elite) {
          // 군웅할거 정예: 중간보스만 한 크기에 금빛 오라(바닥 빛 + 발밑 고리 + 솟는 빛)
          const pu = 0.75 + Math.sin(t * 4 + e.id) * 0.25;
          c.save(); c.globalCompositeOperation = 'lighter';
          const gr = c.createRadialGradient(ex, ey + 4, 6, ex, ey + 4, 64);
          gr.addColorStop(0, `rgba(255,216,106,${0.5 * pu})`); gr.addColorStop(0.55, `rgba(255,170,60,${0.22 * pu})`); gr.addColorStop(1, 'rgba(255,150,40,0)');
          c.fillStyle = gr; c.beginPath(); c.arc(ex, ey + 4, 64, 0, 7); c.fill();
          for (let i = 0; i < 4; i++) { const ph = (t * 0.9 + i / 4 + e.id * 0.13) % 1; c.globalAlpha = Math.sin(ph * Math.PI) * 0.7; c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(ex + Math.sin(i * 1.9 + t) * 22, ey + 20 - ph * 70, 2.5, 0, 7); c.fill(); }
          c.restore();
          c.strokeStyle = '#ffd86a'; c.lineWidth = 3; c.beginPath(); c.ellipse(ex, ey + 22, 30, 12, 0, 0, 7); c.stroke();
        }
        Art.drawSprite(c, img, ex, ey, sz, e.seg === 2, hit * 0.25);
        if (hit > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = hit * 0.8; Art.drawSprite(c, img, ex, ey, sz, e.seg === 2, hit * 0.25); c.restore(); }
        if (e.elite) bar(c, e.x, e.y - 50, 74, 6, e.hp / e.mhp, '#ffd86a');
        else if (e.hp < e.mhp) bar(c, e.x, e.y - 30, 28, 3, e.hp / e.mhp, '#ff6a50');
      }
    }
    for (const d of g.drops) {
      if (d.owner !== 0) continue;
      const bob = Math.sin(t * 3 + d.id) * 2, selected = S.dropSel === d.id;
      if (selected) { c.strokeStyle = '#7dff8e'; c.lineWidth = 2; c.beginPath(); c.ellipse(d.x, d.y + 3, 27, 22, 0, 0, 7); c.stroke(); }
      const dimg = Art.img(d.kind === 'chest' ? 'prop_chest' : d.kind === 'item' ? 'prop_scroll' : 'prop_' + d.kind);
      if (dimg) { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(d.x, d.y + 16, 20, 7, 0, 0, 7); c.fill(); c.drawImage(dimg, d.x - 24, d.y - 26 + bob, 48, 48 * (dimg.height / dimg.width)); continue; }
      c.fillStyle = d.kind === 'chest' ? '#7a3b1c' : '#2a2140'; c.strokeStyle = '#ffd86a'; c.lineWidth = 2.5;
      c.fillRect(d.x - 17, d.y - 15 + bob, 34, 30); c.strokeRect(d.x - 17, d.y - 15 + bob, 34, 30);
      c.fillStyle = '#ffe9a8'; c.font = '900 21px "Noto Serif KR", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(d.kind === 'chest' ? T.chestMark : d.kind === 'item' ? T.itemMark : T.consumables[d.kind].mark, d.x, d.y + 1 + bob);
    }
    const sel = new Set(S.sel);
    for (const u of g.units) {
      // 라인 유닛 크기(등급이 높을수록 큼). 폰에서 알아보기 쉽게 15% 키웠다(1.3 → 1.5). 정렬 칸 간격(42)은 그대로라 줄 세우면 살짝 겹친다.
      const r = (15 + Math.min(u.def.tier, 10) * 0.8) * 1.5;
      if (sel.has(u.id)) { c.strokeStyle = '#7dff8e'; c.lineWidth = 2; c.beginPath(); c.ellipse(u.x, u.y + 3, r + 7, r + 4, 0, 0, 7); c.stroke(); }
      const away = g.inFight(u);
      if (away) c.globalAlpha = 0.35;
      piece(c, u.x, u.y + (u.def.tier ? 0 : Math.sin(t * 3 + u.x) * 3), u.def.tier ? r : 30, u.def, t, u.owner === 1, { pose: poseOf(u, t, r) });
      if (away) { c.globalAlpha = 1; c.fillStyle = '#ffd86a'; c.font = '700 14px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(I.t('deployed'), u.x, u.y - r - 10); }
      if (!u.def.tier) { c.fillStyle = '#ffe9a8'; c.strokeStyle = 'rgba(32,21,12,.85)'; c.lineWidth = 4; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText(u.def.name, u.x, u.y + 46); c.fillText(u.def.name, u.x, u.y + 46); }
    }
    if (S.sel.length === 1) {
      const u = g.units.find((x) => x.id === S.sel[0]);
      if (u && u.def.tier > 0) { c.strokeStyle = 'rgba(125,255,142,.28)'; c.lineWidth = 1; c.beginPath(); c.arc(u.x, u.y, g.range(u.def), 0, 7); c.stroke(); }
    }
    drawFx(c);
    if (g.mut.night) drawNight(c);
    if (S.drag && S.drag.moved) {
      c.strokeStyle = '#7dff8e'; c.lineWidth = 1.5; c.fillStyle = 'rgba(125,255,142,.1)';
      c.fillRect(S.drag.x0, S.drag.y0, S.drag.x1 - S.drag.x0, S.drag.y1 - S.drag.y0); c.strokeRect(S.drag.x0, S.drag.y0, S.drag.x1 - S.drag.x0, S.drag.y1 - S.drag.y0);
    }
  }

  // F1~F5로 고른 다른 사람의 전장. 그 사람이 보낸 라인 묶음을 그대로 그린다.
  function viewedPeer() {
    if (!S.view || !net || g.phase !== 'wave') return null;
    const p = net.roster().find((x) => x.id === S.view && !x.me);
    return p && p.state.ln ? p : null;
  }
  // 받은 묶음 사이를 한 묶음 늦게 이어 그려 끊김 없이 움직이게 한다
  const remoteBuf = {};
  function remoteFrame(peer) {
    const ln = peer.state.ln, now = performance.now();
    let s = remoteBuf[peer.id];
    if (!s || s.seq !== ln.s) {
      const prev = s ? { at: s.at, u: new Map(s.ln.u.map((r) => [r[0], r])), e: new Map(s.ln.e.map((r) => [r[0], r])) } : null;
      s = remoteBuf[peer.id] = { seq: ln.s, ln, at: now, span: prev ? Math.min(1200, Math.max(60, now - prev.at)) : 1, prev };
    }
    const k = Math.min(1, (now - s.at) / s.span), lerp = (old, r, i) => (old ? old[i] + (r[i] - old[i]) * k : r[i]);
    return {
      u: s.ln.u.map((r) => { const o = s.prev && s.prev.u.get(r[0]); return { id: r[0], i: r[1], x: lerp(o, r, 2), y: lerp(o, r, 3), f: r[4], m: r[5], a: r[6], atk: r[7] }; }),
      e: s.ln.e.map((r) => { const o = s.prev && s.prev.e.get(r[0]); return { id: r[0], k: r[1], x: lerp(o, r, 2), y: lerp(o, r, 3), h: r[4], seg: r[5] }; }),
    };
  }
  function drawRemoteLane(t, peer) {
    const c = ctx, fr0 = remoteFrame(peer);
    blitBg(c, mapCv, 'map', mapVer);
    fr0.e.forEach(({ id, k, x, y, h, seg }) => {
      const v = [2, 0, 2, 4][seg] || 0, fr = Math.sin(t * 11 + id) > 0 ? 1 : 2;
      y -= k >= 100 ? 0 : Math.abs(Math.sin(t * 12 + id)) * 3;
      if (k >= 100) {
        const m = T.midbosses[k - 100], img = Art.namedSprite(m.name, T.midLooks[m.name], '#b5361f', v, fr);
        c.strokeStyle = '#e8c15a'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 20, 28, 12, 0, 0, 7); c.stroke();
        Art.drawSprite(c, img, x, y, 76, seg === 2); bar(c, x, y - 50, 74, 6, h / 20, '#ff6a50');
      } else {
        Art.drawSprite(c, Art.soldierSprite(T.waves[k] || T.waves[0], v, fr), x, y, 48, seg === 2);
        if (h < 20) bar(c, x, y - 30, 28, 3, h / 20, '#ff6a50');
      }
    });
    // 다른 사령관 유닛은 클릭해서 정보만 볼 수 있다
    const hits = [], rs = S.rsel && S.rsel.peer === peer.id ? S.rsel : null;
    let found = false;
    fr0.u.forEach(({ id, i, x, y, f, m, a, atk }) => {
      const d = T.units[i]; if (!d) return;
      const r = d.tier ? (15 + Math.min(d.tier, 10) * 0.8) * 1.3 : 30;
      if (rs && rs.id === id) { found = true; rs.atk = atk; c.strokeStyle = '#ffd86a'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 3, r + 7, r + 4, 0, 0, 7); c.stroke(); }
      piece(c, x, y, r, d, t, false, { pose: poseOf({ face: f / 10, moveT: m ? 0.1 : 0, atkT: a ? 0.1 : 0, id, def: d }, t, r) });
      hits.push({ id, x, y, d, atk });
    });
    S.remoteHits = hits;
    if (rs && !found) S.rsel = null;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '400 40px "Black Han Sans", sans-serif'; c.lineWidth = 6;
    c.strokeStyle = 'rgba(20,14,10,.85)'; c.strokeText(I.t('peerField', { a: peer.state.name }), W / 2, ROAD.y0 + 110); c.fillStyle = '#ffe2a8'; c.fillText(I.t('peerField', { a: peer.state.name }), W / 2, ROAD.y0 + 110);
  }
  function drawMotif(c, m, a, t) {
    c.strokeStyle = a; c.fillStyle = a; c.globalAlpha = 0.28; c.lineWidth = 4;
    if (m === 'gate' || m === 'city' || m === 'palace') { for (let i = 0; i < 16; i++) c.fillRect(i * 105, 34, 70, 26); c.fillRect(W / 2 - 150, 0, 300, 34); }
    else if (m === 'altar') { for (let r = 120; r < 330; r += 70) { c.beginPath(); c.arc(W / 2, H / 2, r, 0, 7); c.stroke(); } }
    else if (m === 'bagua') { for (let i = 0; i < 8; i++) { const an = (i * Math.PI) / 4 + t * 0.05; c.save(); c.translate(W / 2 + Math.cos(an) * 340, H / 2 + Math.sin(an) * 340); c.rotate(an + Math.PI / 2); for (let j = 0; j < 3; j++) c.fillRect(-50, j * 18, (i >> j) & 1 ? 100 : 44, 9); c.restore(); } }
    else if (m === 'river') { for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(0, 120 + i * 62); for (let x = 0; x <= W; x += 60) c.lineTo(x, 120 + i * 62 + Math.sin(x * 0.01 + t + i) * 9); c.stroke(); } }
    else if (m === 'forest') { for (let i = 0; i < 40; i++) { const x = (i * 197) % W, y = (i * 113) % H; c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x + 18, y + 16); c.lineTo(x - 18, y + 16); c.fill(); } }
    else if (m === 'wagon') { for (let i = 0; i < 10; i++) { c.strokeRect(70 + i * 150, H - 110, 110, 40); } }
    else if (m === 'cliff') { c.beginPath(); c.moveTo(0, 0); for (let x = 0; x <= W; x += 80) c.lineTo(x, 40 + ((x * 7) % 50)); c.lineTo(W, 0); c.fill(); }
    c.globalAlpha = 1;
  }
  // 딜미터: 협동이면 플레이어별, 단독이면 출전 유닛별
  function meterRows(dealt, total) {
    const rows = net ? net.roster().map((p) => ({ name: p.state.name || '?', v: p.me ? total : p.state.dmg || 0, me: p.me }))
      : Object.keys(dealt).map((k) => ({ name: k, v: dealt[k] }));
    return rows.sort((a, b) => b.v - a.v);
  }
  function drawMeter(c, rows) {
    if (!rows.length) return;
    const x = W - 66 - 300, w = 300, top = rows[0].v || 1, sum = rows.reduce((a, b) => a + b.v, 0) || 1;
    c.fillStyle = 'rgba(16, 11, 8, .72)'; c.fillRect(x - 10, 66, w + 20, 44 + rows.length * 34);
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = '#e6c578'; c.font = '700 20px "Gowun Batang", serif'; c.fillText(I.t('meter'), x, 88);
    rows.slice(0, 5).forEach((r, i) => {
      const y = 108 + i * 34;
      c.fillStyle = r.me ? 'rgba(125,255,142,.4)' : 'rgba(255,190,90,.36)'; c.fillRect(x, y, (w * r.v) / top, 28);
      c.fillStyle = '#fff'; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'left'; c.fillText(r.name, x + 8, y + 15);
      c.textAlign = 'right'; c.fillText(`${fmt(r.v)} (${Math.round((r.v / sum) * 100)}%)`, x + w - 8, y + 15);
    });
  }
  // ---- 보스 기술 연출 ----
  // 기술마다 강조색이 다르다(장판 테두리·투사체·착탄). 없으면 보스 색.
  const VIS_COL = {
    bolt: '#ffe45c', thunder: '#fff07a', talisman: '#ffd27a', spirit: '#c4b0ff', charge: '#ffb070', blade: '#ff9a7a', rock: '#d8b48a',
    roar: '#ff6a5a', flame: '#ff7a2a', fireball: '#ff8c3a', fireship: '#ff6a2a', firearrow: '#ffa04a', army: '#ff5a5a', arrow: '#f2ead4',
    redhare: '#ff3a3a', halberd: '#ff5a8a', wind: '#9fe8ff', bagua: '#9fd8ff', ox: '#e0b878', quake: '#d8a46a', gaze: '#c08aff', shadow: '#b47aff', orb: '#d0bcff',
  };
  const visCol = (h) => VIS_COL[h.fx] || h.c;
  // 불꽃 그림은 옆으로 누운 혜성(머리가 오른쪽)이다. UP만큼 돌리면 머리가 아래, 꼬리가 위로 솟아 서 있는 불길이 된다.
  const UP = Math.PI / 2;
  // 착탄 순간 남는 효과(파편·불씨·충격파 등)와 날아가는 투사체
  S.vfx = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  // 그린 이펙트 그림(gfx/vs_*.png, Higgsfield로 생성. 출처는 CREDITS.md). 도형을 이어 붙여 그리던 것을 대신한다.
  // 아직 못 불러왔으면 false를 돌려주고, 부른 쪽은 예전 도형으로 그린다.
  const VS = {};
  if (typeof Image !== 'undefined') ['slash', 'crack', 'dust', 'wisp', 'eye', 'wind', 'streak', 'talisman', 'rock', 'arrow', 'tower', 'fireship', 'altar', 'ambush', 'pillar', 'spears', 'chev', 'ring', 'dao', 'ji', 'gate', 'orb'].forEach((n) => { const im = new Image(); im.onload = () => { VS[n] = im; }; im.src = 'gfx/vs_' + n + '.png?v=1'; });
  // 가운데 기준으로 그린다. w = 그릴 폭(높이는 비율대로), rot 회전, a 투명도, add 더하기 합성, flip 좌우 반전, sy 세로 납작함
  function vs(c, n, x, y, w, rot, a, add, flip, sy) {
    const im = VS[n];
    if (!im) return false;
    const h = (w * im.height) / im.width;
    c.save();
    c.globalAlpha = Math.max(0, Math.min(1, a == null ? 1 : a));
    if (add) c.globalCompositeOperation = 'lighter';
    c.translate(x, y); if (sy) c.scale(1, sy); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1);
    c.drawImage(im, -w / 2, -h / 2, w, h);
    c.restore();
    return true;
  }
  function addVfx(o) {
    // 불꽃·파편 같은 잔조각은 화질에 따라 줄인다(큰 모양은 그대로)
    if ((o.k === 'spark' || o.k === 'debris' || o.k === 'ember') && Math.random() > qPart()) return;
    if (S.vfx.length < (Q.level === 'high' ? 600 : 300)) S.vfx.push(Object.assign({ t: 0 }, o));
  }
  // 장판이 터질 때 한 번 부른다
  function hazardImpact(h) {
    const col = visCol(h), fx = h.fx;
    if (h.k === 'circle' || h.own) {
      const fire = fx === 'flame' || fx === 'fireball' || fx === 'fireship' || fx === 'firearrow';
      addVfx({ k: 'flash', x: h.x, y: h.y, r: h.r * 1.2, life: 0.25, c: fx === 'bolt' || fx === 'thunder' ? '#fffbe0' : col });
      addVfx({ k: 'shock', x: h.x, y: h.y, r: h.r * 1.4, life: 0.45, c: col });
      if (fx === 'bolt' || fx === 'thunder') {
        addVfx({ k: 'bolt', x: h.x, y: h.y, life: 0.32, r: h.r, c: col });
        for (let i = 0; i < 10; i++) addVfx({ k: 'spark', x: h.x, y: h.y, a: rnd(0, 7), s: rnd(160, 420), life: rnd(0.2, 0.4), c: '#fff6a0' });
      } else if (fx === 'rock' || fx === 'quake') {
        for (let i = 0; i < 14; i++) addVfx({ k: 'debris', x: h.x, y: h.y, a: rnd(0, 7), s: rnd(120, 340), z: rnd(120, 300), life: rnd(0.5, 0.8), sz: rnd(6, 14), c: i % 3 ? '#8a6a4a' : '#c9a27a' });
        addVfx({ k: 'crack', x: h.x, y: h.y, r: h.r, life: 1.2, seed: Math.random() * 99 }); addVfx({ k: 'decal', x: h.x, y: h.y, r: h.r * 1.1, life: 1.3 });
        addVfx({ k: 'dust', x: h.x, y: h.y, r: h.r * 1.3, life: 0.7 });
      } else if (fire) {
        addVfx({ k: 'img', img: 'fire', x: h.x, y: h.y - h.r * 0.3, r: h.r * 2.4, life: 0.5 });
        for (let i = 0; i < 16; i++) addVfx({ k: 'ember', x: h.x + rnd(-h.r, h.r) * 0.7, y: h.y + rnd(-h.r, h.r) * 0.5, vy: rnd(-180, -60), vx: rnd(-40, 40), life: rnd(0.5, 1), sz: rnd(3, 6) });
      } else if (fx === 'roar') {
        for (let i = 0; i < 3; i++) addVfx({ k: 'shock', x: h.x, y: h.y, r: h.r * (1 + i * 0.25), life: 0.5 + i * 0.15, c: col, w: 10 - i * 3 });
        addVfx({ k: 'dust', x: h.x, y: h.y, r: h.r, life: 0.8 });
      } else { addVfx({ k: 'img', img: 'boom', x: h.x, y: h.y, r: h.r * 2.3, life: 0.4 }); addVfx({ k: 'decal', x: h.x, y: h.y, r: h.r, life: 1.1 }); }
    } else if (h.k === 'line') {
      // 직선 기술: 무엇이 실제로 날아가거나 달려 나간다
      const kind = fx === 'talisman' ? 'talisman' : fx === 'arrow' || fx === 'firearrow' ? 'arrow' : fx === 'wind' ? 'gust' : fx === 'army' || fx === 'ox' ? 'troop' : fx === 'shadow' ? 'wisp' : fx === 'halberd' || fx === 'blade' ? 'slashline' : fx === 'charge' || fx === 'redhare' ? 'dustline' : 'streak';
      const n = kind === 'talisman' ? 3 : kind === 'arrow' ? 5 : kind === 'troop' ? 4 : kind === 'gust' ? 3 : kind === 'wisp' ? 3 : 1;
      // 초당 약 1400px로 날아가 눈으로 따라갈 수 있게 한다
      const life = Math.min(1.4, Math.max(0.6, h.len / 1400));
      for (let i = 0; i < n; i++) addVfx({ k: kind, x: h.x, y: h.y, a: h.a, len: h.len, w: h.w, off: n > 1 ? (i / (n - 1) - 0.5) * h.w * 0.8 : 0, lag: i * 0.06, life: life + i * 0.06, c: col });
      // 지나간 자리에 남는 잔광(베기·돌진·기본 직선). 끝에서는 땅이 터진다.
      if (kind === 'slashline' || kind === 'streak' || kind === 'dustline') {
        addVfx({ k: 'scar', x: h.x, y: h.y, a: h.a, len: h.len, w: h.w, life: 0.55, c: col });
        addVfx({ k: 'decal', x: h.x + Math.cos(h.a) * h.len * 0.92, y: h.y + Math.sin(h.a) * h.len * 0.92, r: h.w * 0.9, life: 1.0, lag: life * 0.7 });
      }
    } else if (h.k === 'cone') {
      // 칼·극 휘두르기: 오른쪽·왼쪽 번갈아 휘두른다
      S.swingDir = -(S.swingDir || 1);
      addVfx({ k: 'swing', x: h.x, y: h.y, a: h.a, r: h.r, arc: h.arc, life: 0.42, c: col, dir: S.swingDir, pole: h.fx === 'halberd' });
    } else if (h.k === 'donut') {
      addVfx({ k: 'ringwave', x: h.x, y: h.y, r0: h.r0, r1: h.r1, life: 0.45, c: col, fx });
    } else if (h.k === 'rect') {
      addVfx({ k: 'flash', x: h.x + h.rw / 2, y: h.y + h.rh / 2, rect: [h.x, h.y, h.rw, h.rh], life: 0.25, c: col });
      // 구획 전체가 터진다: 넓이에 맞춰 폭발과 균열을 흩뿌린다
      { const nb = Math.max(2, Math.min(7, Math.round((h.rw * h.rh) / 60000))), rr = Math.min(h.rw, h.rh) * 0.34;
        for (let i = 0; i < nb; i++) { const bx = h.x + h.rw * ((i + 0.5) / nb) + rnd(-20, 20), by = h.y + h.rh * rnd(0.25, 0.75); addVfx({ k: 'img', img: 'boom', x: bx, y: by, r: rr * 2.2, life: 0.45, lag: i * 0.04 }); addVfx({ k: 'decal', x: bx, y: by, r: rr, life: 1.0, lag: i * 0.04 }); } }
    } else if (h.k === 'all') {
      addVfx({ k: 'flash', x: W / 2, y: H / 2, rect: [-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2], life: 0.5, c: '#ffffff' });
      for (let i = 0; i < 9; i++) { const bx = rnd(ARENA.x0 + 80, ARENA.x1 - 80), by = rnd(ARENA.y0 + 60, ARENA.y1 - 60); addVfx({ k: 'img', img: 'boom', x: bx, y: by, r: 260, life: 0.5, lag: i * 0.05 }); addVfx({ k: 'decal', x: bx, y: by, r: 120, life: 1.2, lag: i * 0.05 }); }
    } else if (h.k === 'push') {
      for (let i = 0; i < 2; i++) addVfx({ k: 'shock', x: h.x, y: h.y, r: h.r * (1 + i * 0.2), life: 0.5 + i * 0.2, c: col, w: 8 });
    }
    if (h.k === 'circle' || h.k === 'line' || h.k === 'cone' || h.k === 'donut' || h.k === 'all') S.shake = Math.max(S.shake || 0, h.k === 'all' ? 1 : 0.35);
  }
  // 떨어지는 물체(바위·불배·불화살 등): 터지기 0.5초 전부터 위에서 내려온다
  function drawFalling(c, h, q) {
    const col = visCol(h), y = h.y - 620 * (1 - q) * (1 - q), x = h.x + (h.fx === 'firearrow' ? 260 * (1 - q) : 0);
    c.globalAlpha = 0.35 * q; c.fillStyle = '#000'; c.beginPath(); c.ellipse(h.x, h.y + 4, h.r * 0.5 * q, h.r * 0.2 * q, 0, 0, 7); c.fill();
    c.globalAlpha = 1;
    if (h.fx === 'rock') {
      if (vs(c, 'rock', x, y, h.r * 1.1, q * 6)) return;
      c.save(); c.translate(x, y); c.rotate(q * 6);
      const s = h.r * 0.45;
      c.fillStyle = '#7a5c40'; c.beginPath(); c.moveTo(-s, -s * 0.3); c.lineTo(-s * 0.4, -s); c.lineTo(s * 0.6, -s * 0.8); c.lineTo(s, s * 0.1); c.lineTo(s * 0.3, s); c.lineTo(-s * 0.7, s * 0.7); c.closePath(); c.fill();
      c.fillStyle = '#b08a64'; c.beginPath(); c.moveTo(-s * 0.4, -s); c.lineTo(s * 0.6, -s * 0.8); c.lineTo(s * 0.2, -s * 0.1); c.lineTo(-s * 0.5, -s * 0.2); c.closePath(); c.fill();
      c.restore();
    } else if (h.fx === 'firearrow') {
      for (let i = 0; i < 3; i++) { const ox = (i - 1) * 22, oy = i * 18; c.strokeStyle = '#ffd8a0'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(x + ox + 60, y + oy - 140); c.stroke(); Art.fxImg(c, 'fire', x + ox, y + oy, 46, Math.atan2(140, -60), 1); }
    } else if (h.fx === 'fireship') {
      if (vs(c, 'fireship', x, y - 26, 150, Math.sin(performance.now() / 160) * 0.06)) return;
      c.save(); c.translate(x, y);
      c.fillStyle = '#5a3a22'; c.beginPath(); c.moveTo(-50, -6); c.lineTo(50, -6); c.lineTo(36, 14); c.lineTo(-36, 14); c.closePath(); c.fill();
      c.fillStyle = '#3a2614'; c.fillRect(-3, -60, 6, 54);
      c.restore();
      Art.fxImg(c, 'fire', x, y - 40, 110, UP + Math.sin(performance.now() / 90) * 0.1, 1);
    } else if (h.fx === 'flame' || h.fx === 'fireball') {
      Art.fxImg(c, 'fire', x, y, h.r * 1.3, UP, 1);
    } else if (h.fx === 'bolt' || h.fx === 'thunder') {
      // 낙뢰 전조: 하늘에서 지직거리는 잔전기
      c.strokeStyle = col; c.lineWidth = 2; c.globalAlpha = 0.5 + Math.random() * 0.5;
      for (let i = 0; i < 2; i++) { let px = h.x + rnd(-h.r, h.r) * 0.6, py = h.y - 300; c.beginPath(); c.moveTo(px, py); for (let j = 0; j < 5; j++) { px += rnd(-18, 18); py += 300 * q / 5; c.lineTo(px, py); } c.stroke(); }
      c.globalAlpha = 1;
    }
  }
  // 장판 표시: 어두운 위험 바탕 + 기술 색 테두리(빛남) + 터질 때까지 차오르는 안쪽
  function teleStyle(c, col, p) {
    c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 14; c.lineWidth = 3 + p * 2;
    c.globalAlpha = 0.75 + Math.sin(performance.now() / 90) * 0.2 * p;
  }
  function drawHazard(c, h) {
    const p = Math.min(1, h.t / Math.max(0.01, h.delay)), fired = h.t >= h.delay;
    // 오래 남는 장판(불길·절벽)은 지속 시간 동안 일렁이며 남는다
    const live = h.dur && fired && h.t < h.delay + h.dur;
    if (fired && !h.vd) { h.vd = 1; hazardImpact(h); }
    if (h.hide && !fired) return; // 팔진도: 생문은 문양으로만 알려 준다
    const col = visCol(h), now = performance.now() / 1000;
    const alpha = live ? 0.4 + Math.sin(h.t * 12) * 0.06 : fired ? 0.75 * (1 - (h.t - h.delay - (h.dur || 0)) / 0.28) : 0.12 + p * 0.26;
    const danger = 'rgba(176,22,12,1)';
    c.save();
    c.fillStyle = h.c; c.strokeStyle = h.c; c.lineWidth = 2; c.globalAlpha = Math.max(0, alpha);
    if (h.k === 'wind' || h.k === 'gaze') { if (fired && h.t < h.delay + h.dur) drawAura(c, h); }
    else if (h.k === 'rect') {
      if (!fired) {
        c.globalAlpha = 0.18 + p * 0.2; c.fillStyle = danger; c.fillRect(h.x, h.y, h.rw, h.rh);
        // 움직이는 사선 경고 무늬
        c.save(); c.beginPath(); c.rect(h.x, h.y, h.rw, h.rh); c.clip();
        c.globalAlpha = 0.16 + p * 0.18; c.strokeStyle = col; c.lineWidth = 10;
        const off = (now * 60) % 48;
        for (let d = -h.rh; d < h.rw + h.rh; d += 48) { c.beginPath(); c.moveTo(h.x + d + off, h.y); c.lineTo(h.x + d + off - h.rh, h.y + h.rh); c.stroke(); }
        c.restore();
        teleStyle(c, col, p); c.strokeRect(h.x + 3, h.y + 3, h.rw - 6, h.rh - 6); c.shadowBlur = 0;
        c.globalAlpha = 0.9; c.fillStyle = col; c.fillRect(h.x, h.y + h.rh - 6, h.rw * p, 6);
      } else if (live && h.fx === 'flame') {
        // 타오르는 구획: 불길이 일렁인다
        c.globalAlpha = 0.35; c.fillStyle = '#7a1e08'; c.fillRect(h.x, h.y, h.rw, h.rh);
        for (let ix = 0; ix < 6; ix++) for (let iy = 0; iy < 3; iy++) {
          const fx = h.x + (ix + 0.5) * (h.rw / 6), fy = h.y + (iy + 0.6) * (h.rh / 3), fl = 0.8 + Math.sin(now * 9 + ix * 1.7 + iy * 2.3) * 0.2;
          Art.fxImg(c, 'fire', fx, fy - Math.min(h.rw / 6, h.rh / 3) * 0.3, Math.min(h.rw / 6, h.rh / 3) * 1.3 * fl, UP + Math.sin(now * 6 + ix + iy) * 0.12, 0.75);
        }
      } else { c.fillRect(h.x, h.y, h.rw, h.rh); }
    } else if (h.k === 'band') {
      c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, h.y0 + OVER.y); c.fillRect(-OVER.x, h.y1, W + OVER.x * 2, H - h.y1 + OVER.y);
      if (!fired) { c.globalAlpha = 1; c.strokeStyle = '#a8ffb8'; c.lineWidth = 3; c.beginPath(); c.moveTo(ARENA.x0, h.y0); c.lineTo(ARENA.x1, h.y0); c.moveTo(ARENA.x0, h.y1); c.lineTo(ARENA.x1, h.y1); c.stroke(); }
    } else if (h.k === 'all') {
      c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
    } else if (h.k === 'los') {
      c.fillRect(ARENA.x0, ARENA.y0, ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0);
      // 돌기둥 뒤 그림자 = 안전
      c.globalAlpha = fired ? 0.2 : 0.45; c.fillStyle = '#a8ffb8';
      g.fight.mech.objs.forEach((o) => {
        if (o.k !== 'pillar') return;
        const a = Math.atan2(o.y - h.y, o.x - h.x), px = -Math.sin(a) * o.r * 0.8, py = Math.cos(a) * o.r * 0.8, ex = Math.cos(a) * 250, ey = Math.sin(a) * 250;
        c.beginPath(); c.moveTo(o.x + px, o.y + py); c.lineTo(o.x + px + ex, o.y + py + ey); c.lineTo(o.x - px + ex, o.y - py + ey); c.lineTo(o.x - px, o.y - py); c.closePath(); c.fill();
      });
      if (!fired) { c.globalAlpha = 0.9; c.strokeStyle = h.c; c.lineWidth = 4; c.beginPath(); c.arc(h.x, h.y, 60 + p * 40, 0, 7); c.stroke(); }
    } else if (h.k === 'push') {
      c.globalAlpha = fired ? Math.max(0, alpha) : 0.6; c.lineWidth = 6; c.beginPath(); c.arc(h.x, h.y, fired ? h.r : h.r * p, 0, 7); c.stroke();
    } else if (h.k === 'proj') {
      drawProj(c, h, col, fired);
    } else if (h.own || h.k === 'circle') {
      if (h.own) { if (!(h.vx && window.RTD_SKFX && window.RTD_SKFX.tele(c, h, p, fired))) { c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.fill(); if (!fired) { c.globalAlpha = 0.9; c.beginPath(); c.arc(h.x, h.y, h.r * p, 0, 7); c.stroke(); } } }
      else if (!fired) {
        // 바탕 + 차오르는 원 + 도는 점선 테두리
        c.globalAlpha = 0.2 + p * 0.15; c.fillStyle = danger; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.fill();
        const gr = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, Math.max(1, h.r * p));
        gr.addColorStop(0, col + '10'); gr.addColorStop(1, col + '88');
        c.globalAlpha = 0.85; c.fillStyle = gr; c.beginPath(); c.arc(h.x, h.y, Math.max(1, h.r * p), 0, 7); c.fill();
        // 테두리: 천천히 도는 불 고리(그림). 터질 때가 가까울수록 밝아진다
        if (!vs(c, 'ring', h.x, h.y, h.r * 2.24, now * 0.5 + h.x, 0.55 + p * 0.45, true)) { teleStyle(c, col, p); c.setLineDash([16, 10]); c.lineDashOffset = -now * 40; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.stroke(); c.setLineDash([]); c.shadowBlur = 0; }
        if (p > 0.82) { c.globalAlpha = (p - 0.82) * 5; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.stroke(); }
        const left = h.delay - h.t;
        if (left < 0.5 && h.fx) drawFalling(c, h, 1 - left / 0.5);
      } else if (live) {
        // 남는 불길·장판
        c.globalAlpha = 0.3 + Math.sin(h.t * 12) * 0.05; c.fillStyle = h.fx === 'flame' ? '#7a1e08' : h.c; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.fill();
        if (h.fx === 'flame' || h.fx === 'fireball') for (let i = 0; i < 5; i++) { const a = i * 1.26 + now, rr = h.r * 0.5; Art.fxImg(c, 'fire', h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr * 0.6 - h.r * 0.3, h.r * (0.8 + Math.sin(now * 8 + i) * 0.15), UP + Math.sin(now * 7 + i) * 0.12, 0.7); }
      }
    } else if (h.k === 'line') {
      c.translate(h.x, h.y); c.rotate(h.a);
      if (!fired) {
        c.globalAlpha = 0.18 + p * 0.18; c.fillStyle = danger; c.fillRect(0, -h.w / 2, h.len, h.w);
        // 진행 방향으로 흐르는 화살표 무늬와 차오르는 띠
        c.globalAlpha = 0.5; c.fillStyle = col + '66'; c.fillRect(0, -h.w / 2, h.len * p, h.w);
        c.globalAlpha = 0.65; c.strokeStyle = col; c.lineWidth = 3;
        const step = 60, off = (now * 160) % step;
        if (VS.chev) { const cw = Math.max(26, Math.min(h.w * 0.62, 54)), st2 = Math.max(70, cw * 1.6), o2 = (now * 190) % st2; for (let d = o2; d < h.len; d += st2) vs(c, 'chev', d, 0, cw, 0, (0.45 + p * 0.5) * Math.min(1, d / 60, (h.len - d) / 60), true); }
        else for (let d = off; d < h.len; d += step) { const s = Math.min(h.w * 0.32, 14); c.beginPath(); c.moveTo(d - s, -s); c.lineTo(d, 0); c.lineTo(d - s, s); c.stroke(); }
        teleStyle(c, col, p); c.beginPath(); c.moveTo(0, -h.w / 2); c.lineTo(h.len, -h.w / 2); c.moveTo(0, h.w / 2); c.lineTo(h.len, h.w / 2); c.stroke(); c.shadowBlur = 0;
      } else { c.globalAlpha *= 0.35; c.fillStyle = col; c.fillRect(0, -h.w / 2, h.len, h.w); }
    } else if (h.k === 'cone') {
      const path = (r) => { c.beginPath(); c.moveTo(h.x, h.y); c.arc(h.x, h.y, r, h.a - h.arc / 2, h.a + h.arc / 2); c.closePath(); };
      if (!fired) {
        c.globalAlpha = 0.2 + p * 0.15; c.fillStyle = danger; path(h.r); c.fill();
        c.globalAlpha = 0.6; c.fillStyle = col + '77'; path(h.r * p); c.fill();
        teleStyle(c, col, p); path(h.r); c.stroke(); c.shadowBlur = 0;
      } else if (h.fx !== 'blade' && h.fx !== 'halberd') { c.globalAlpha *= 0.45; c.fillStyle = col; path(h.r); c.fill(); } // 칼 휘두르기는 궤적 연출만 남긴다
    } else if (h.k === 'donut') {
      const ringPath = () => { c.beginPath(); c.arc(h.x, h.y, h.r1, 0, 7); c.arc(h.x, h.y, h.r0, 0, 7, true); };
      if (!fired) {
        c.globalAlpha = 0.2 + p * 0.15; c.fillStyle = danger; ringPath(); c.fill();
        c.globalAlpha = 0.55; c.fillStyle = col + '66'; c.beginPath(); c.arc(h.x, h.y, h.r0 + (h.r1 - h.r0) * p, 0, 7); c.arc(h.x, h.y, h.r0, 0, 7, true); c.fill();
        if (vs(c, 'ring', h.x, h.y, h.r1 * 2.24, now * 0.4, 0.55 + p * 0.45, true)) { if (h.r0 > 24) vs(c, 'ring', h.x, h.y, h.r0 * 2.24, -now * 0.6, 0.5 + p * 0.4, true); }
        else { teleStyle(c, col, p); c.setLineDash([18, 10]); c.lineDashOffset = now * 50; c.beginPath(); c.arc(h.x, h.y, h.r1, 0, 7); c.stroke(); c.beginPath(); c.arc(h.x, h.y, h.r0, 0, 7); c.stroke(); c.setLineDash([]); c.shadowBlur = 0; }
      } else { c.globalAlpha *= 0.45; c.fillStyle = col; ringPath(); c.fill(); }
    } else if (h.k === 'safe') {
      c.beginPath(); c.rect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
      h.spots.forEach((s) => { c.moveTo(s[0] + s[2], s[1]); c.arc(s[0], s[1], s[2], 0, 7, true); });
      c.fill('evenodd');
      c.globalAlpha = 1; c.strokeStyle = '#a8ffb8'; c.lineWidth = 3;
      if (!fired) h.spots.forEach((s) => { c.beginPath(); c.arc(s[0], s[1], s[2], 0, 7); c.stroke(); });
    }
    c.restore();
  }
  // 탄환: 기술마다 생김새가 다르다(불덩이·혼령·바람·화살·요기 구슬)
  function drawProj(c, h, col, fired) {
    if (!fired) {
      // 발사 전: 보스 앞에 모이는 기운
      const q = h.t / Math.max(0.01, h.delay);
      c.globalAlpha = 0.25 + q * 0.4; c.fillStyle = col; c.beginPath(); c.arc(h.x + Math.cos(h.a) * 40 * q, h.y + Math.sin(h.a) * 40 * q, 6 + q * 6, 0, 7); c.fill();
      return;
    }
    const a = h.a, tx = -Math.cos(a), ty = -Math.sin(a), fx = h.fx;
    // 꼬리
    const tl = fx === 'arrow' ? 0 : 70, gr = c.createLinearGradient(h.x, h.y, h.x + tx * tl, h.y + ty * tl);
    gr.addColorStop(0, col + 'cc'); gr.addColorStop(1, col + '00');
    if (tl) { c.globalAlpha = 0.9; c.strokeStyle = gr; c.lineWidth = h.r * 1.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(h.x, h.y); c.lineTo(h.x + tx * tl, h.y + ty * tl); c.stroke(); }
    c.globalAlpha = 1;
    if (fx === 'fireball') { Art.fxImg(c, 'fire', h.x - Math.cos(a) * h.r, h.y - Math.sin(a) * h.r, h.r * 3.6, a, 1); c.fillStyle = '#fff4c8'; c.beginPath(); c.arc(h.x, h.y, h.r * 0.45, 0, 7); c.fill(); }
    else if (fx === 'spirit' || fx === 'shadow') {
      // 혼령: 흐느적이는 반투명 불꽃
      const w = Math.sin(performance.now() / 70 + h.x) * 3;
      if (vs(c, 'wisp', h.x + tx * h.r * 1.6, h.y + ty * h.r * 1.6, h.r * 6, a + w * 0.02, 0.95, true)) return;
      c.globalAlpha = 0.85; c.fillStyle = col; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.fill();
      c.beginPath(); c.moveTo(h.x - ty * h.r, h.y + tx * h.r); c.quadraticCurveTo(h.x + tx * h.r * 2 + w, h.y + ty * h.r * 2 - w, h.x + tx * h.r * 3, h.y + ty * h.r * 3); c.quadraticCurveTo(h.x + tx * h.r * 2 - w, h.y + ty * h.r * 2 + w, h.x + ty * h.r, h.y - tx * h.r); c.fill();
      c.fillStyle = '#1a0a2a'; c.beginPath(); c.arc(h.x + Math.cos(a) * 3 - ty * 4, h.y + Math.sin(a) * 3 + tx * 4, 2.5, 0, 7); c.arc(h.x + Math.cos(a) * 3 + ty * 4, h.y + Math.sin(a) * 3 - tx * 4, 2.5, 0, 7); c.fill();
    } else if (fx === 'wind') {
      if (vs(c, 'wind', h.x + tx * h.r, h.y + ty * h.r, h.r * 5, a, 0.95, true)) return;
      c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(h.x, h.y, h.r * 1.4, a - 1.2, a + 1.2); c.stroke();
      c.globalAlpha = 0.5; c.beginPath(); c.arc(h.x + tx * 12, h.y + ty * 12, h.r * 1.1, a - 1.1, a + 1.1); c.stroke();
    } else if (fx === 'arrow') {
      if (vs(c, 'arrow', h.x + tx * 18, h.y + ty * 18, 78, a)) return;
      c.save(); c.translate(h.x, h.y); c.rotate(a);
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-34, 0); c.lineTo(6, 0); c.stroke();
      c.fillStyle = '#e8e8e8'; c.beginPath(); c.moveTo(14, 0); c.lineTo(2, -6); c.lineTo(2, 6); c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); c.moveTo(-34, 0); c.lineTo(-42, -6); c.lineTo(-30, 0); c.lineTo(-42, 6); c.closePath(); c.fill();
      c.restore();
    } else {
      // 요기 구슬(시전형 보스 기본 탄)
      Art.fxImg(c, 'magic', h.x, h.y, h.r * 3.2, performance.now() / 300, 0.9);
      if (vs(c, 'orb', h.x, h.y, h.r * 3, performance.now() / 200, 1, true)) return;
      c.fillStyle = col; c.beginPath(); c.arc(h.x, h.y, h.r * 0.8, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(h.x, h.y, h.r * 0.35, 0, 7); c.fill();
    }
  }
  // 착탄 효과·날아가는 물체 그리기(매 프레임)
  function drawVfx(c) {
    const dt = S.fdt;
    for (let i = S.vfx.length - 1; i >= 0; i--) {
      const v = S.vfx[i];
      v.t += dt;
      const p = (v.t - (v.lag || 0)) / (v.life - (v.lag || 0));
      if (v.t >= v.life) { S.vfx.splice(i, 1); continue; }
      if (p < 0) continue;
      c.save();
      c.globalAlpha = 1;
      if (v.k === 'flash') {
        c.globalAlpha = 0.55 * (1 - p); c.fillStyle = v.c;
        if (v.rect) c.fillRect(...v.rect); else { c.beginPath(); c.arc(v.x, v.y, v.r, 0, 7); c.fill(); }
      } else if (v.k === 'shock') {
        c.globalAlpha = 1 - p; c.strokeStyle = v.c; c.lineWidth = (v.w || 7) * (1 - p) + 1; c.shadowColor = v.c; c.shadowBlur = 12;
        c.beginPath(); c.ellipse(v.x, v.y, v.r * (0.3 + p * 0.8), v.r * (0.3 + p * 0.8) * 0.75, 0, 0, 7); c.stroke(); c.shadowBlur = 0;
        // 충격파 고리 애니메이션(바닥에 눕힘)
        Art.fxAnim(c, 'ring', p, v.x, v.y, v.r * 2.8, v.r * 2.1, 0, 0.9);
      } else if (v.k === 'bolt') {
        // 하늘에서 내리꽂는 번개 줄기
        c.globalAlpha = 1 - p; c.strokeStyle = '#fffbe0'; c.shadowColor = v.c; c.shadowBlur = 24;
        for (let k = 0; k < 2; k++) {
          c.lineWidth = k ? 3 : 8; let x = v.x + (k ? 14 : 0), y = v.y - 560; c.beginPath(); c.moveTo(x, y);
          for (let j = 0; j < 8; j++) { x += rnd(-26, 26); y += 70; c.lineTo(x, Math.min(y, v.y)); }
          c.stroke();
        }
        // 번개 애니메이션: 하늘에서 땅까지 세로로, 줄기 모양이 번쩍이며 바뀐다
        if (!Art.fxAnim(c, 'bolt', p, v.x, v.y - 290, 600, 170, Math.PI / 2, (1 - p) * 1.4, Math.floor(v.t * 30))) Art.fxImg(c, 'bolt', v.x, v.y - v.r * 0.9, v.r * 2.4, 0, 1 - p);
        Art.fxAnim(c, 'hit', p, v.x, v.y, v.r * 2.2, v.r * 1.4, 0, 1);
      } else if (v.k === 'spark') {
        const d = v.s * p; c.globalAlpha = 1 - p; c.strokeStyle = v.c; c.lineWidth = 3;
        c.beginPath(); c.moveTo(v.x + Math.cos(v.a) * d * 0.6, v.y + Math.sin(v.a) * d * 0.6); c.lineTo(v.x + Math.cos(v.a) * d, v.y + Math.sin(v.a) * d); c.stroke();
      } else if (v.k === 'debris') {
        // 튀는 돌조각(포물선)
        const d = v.s * p, z = v.z * 4 * p * (1 - p);
        if (!vs(c, 'rock', v.x + Math.cos(v.a) * d, v.y + Math.sin(v.a) * d * 0.6 - z, v.sz * 2.2, p * 9 + v.a, 1 - p * p)) { c.globalAlpha = 1 - p * p; c.fillStyle = v.c; c.save(); c.translate(v.x + Math.cos(v.a) * d, v.y + Math.sin(v.a) * d * 0.6 - z); c.rotate(p * 9); c.fillRect(-v.sz / 2, -v.sz / 2, v.sz, v.sz * 0.7); c.restore(); }
      } else if (v.k === 'decal') {
        // 땅에 남는 균열 자국(그림): 터지는 순간 밝게 달아올랐다가 식으며 사라진다. 바닥에 눕힌다.
        vs(c, 'crack', v.x, v.y, v.r * 2.6 * (0.85 + Math.min(1, p * 6) * 0.15), (v.x * 7 + v.y * 3) % 6.28, p < 0.15 ? 1 : (1 - p) * 0.8, p < 0.3, false, 0.62);
      } else if (v.k === 'scar') {
        // 직선 기술이 지나간 자리의 잔광: 길 전체에 길게 늘여 깔았다가 사라진다
        const im = VS.streak;
        if (im) { c.translate(v.x, v.y); c.rotate(v.a); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - p) * 0.85; c.drawImage(im, 0, -v.w * 0.55, v.len * Math.min(1, p * 5 + 0.25), v.w * 1.1); c.globalCompositeOperation = 'source-over'; }
      } else if (v.k === 'crack' && VS.crack) {
        // 그림 자국(decal)이 대신 그린다
      } else if (v.k === 'crack') {
        // 땅이 갈라진 자국(천천히 사라짐)
        c.globalAlpha = 0.7 * (1 - p); c.strokeStyle = '#2a1a0e'; c.lineWidth = 3;
        let sd = v.seed; const r = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
        for (let k = 0; k < 6; k++) { let a = k * 1.05 + r(), x = v.x, y = v.y; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 3; j++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * v.r * 0.3; y += Math.sin(a) * v.r * 0.22; c.lineTo(x, y); } c.stroke(); }
      } else if (v.k === 'dust') {
        if (VS.dust) { for (let k = 0; k < 5; k++) { const a = k * 1.26 + v.x, rr = v.r * (0.35 + p * 0.6); vs(c, 'dust', v.x + Math.cos(a) * rr, v.y + Math.sin(a) * rr * 0.5 - p * 26, v.r * 0.9 * (0.7 + p * 0.6), a, 0.6 * (1 - p)); } }
        else { c.globalAlpha = 0.35 * (1 - p); c.fillStyle = '#b8a07a';
        for (let k = 0; k < 7; k++) { const a = k * 0.9, rr = v.r * (0.4 + p * 0.6); c.beginPath(); c.arc(v.x + Math.cos(a) * rr, v.y + Math.sin(a) * rr * 0.5 - p * 20, v.r * 0.25 * (1 + p), 0, 7); c.fill(); } }
      } else if (v.k === 'ember') {
        c.globalAlpha = 1 - p; c.fillStyle = p < 0.4 ? '#fff0a0' : '#ff7a2a'; c.beginPath(); c.arc(v.x + v.vx * v.t, v.y + v.vy * v.t, v.sz * (1 - p * 0.5), 0, 7); c.fill();
      } else if (v.k === 'img') {
        // 폭발은 프레임 애니메이션, 불길은 기존 그림
        if (!(v.img === 'boom' && Art.fxAnim(c, 'boom2', p, v.x, v.y - v.r * 0.15, v.r * 1.5, v.r * 1.5, 0, 1)))
          Art.fxImg(c, v.img, v.x, v.y - (v.img === 'fire' ? v.r * 0.25 : 0), v.r * (0.8 + p * 0.4), v.img === 'fire' ? UP : p, (1 - p) * 1.3);
      } else if (v.k === 'swing') {
        // 칼 휘두르기: 칼끝이 호를 그리며 지나가고, 지나간 자리에 칼끝 쪽이 두껍고 밝은 궤적이 남는다
        const u = Math.min(1, p / 0.38), e = 1 - (1 - u) * (1 - u) * (1 - u), fade = p < 0.38 ? 1 : 1 - (p - 0.38) / 0.62;
        const a0 = v.a - v.dir * v.arc / 2, a1 = v.a + v.dir * v.arc / 2, head = a0 + (a1 - a0) * e, N = 48;
        const pt = (ang, rr) => [v.x + Math.cos(ang) * rr, v.y + Math.sin(ang) * rr];
        // 빛 궤적은 더해 그리기(lighter)로: 겹칠수록 밝아져 검광처럼 보인다
        c.globalCompositeOperation = 'lighter';
        // 하나의 도형(바깥 호 → 안쪽 곡선)으로 그리고, 호를 따라 꼬리는 투명·칼끝은 밝게 칠한다
        const span = Math.abs(head - a0);
        if (span > 0.02) {
          c.beginPath();
          for (let k = 0; k <= N; k++) { const s = k / N, [x, y] = pt(a0 + (head - a0) * s, v.r); if (k) c.lineTo(x, y); else c.moveTo(x, y); }
          for (let k = N; k >= 0; k--) { const s = k / N, [x, y] = pt(a0 + (head - a0) * s, v.r * (0.97 - 0.2 * s * s)); c.lineTo(x, y); }
          c.closePath();
          let fill = v.c;
          if (c.createConicGradient) {
            const st = v.dir > 0 ? a0 : head, gr = c.createConicGradient(st, v.x, v.y), f = Math.min(0.999, span / (Math.PI * 2));
            if (v.dir > 0) { gr.addColorStop(0, v.c + '00'); gr.addColorStop(f * 0.7, v.c + 'aa'); gr.addColorStop(f, '#fff6dc'); gr.addColorStop(Math.min(1, f + 0.001), v.c + '00'); }
            else { gr.addColorStop(0, '#fff6dc'); gr.addColorStop(f * 0.3, v.c + 'aa'); gr.addColorStop(f, v.c + '00'); }
            fill = gr;
          }
          c.globalAlpha = fade * 0.85; c.fillStyle = fill; c.fill();
        }
        // 날 끝선(가장 밝은 테두리)
        c.globalAlpha = fade * 0.9; c.strokeStyle = '#fffbe8'; c.lineWidth = 4; c.shadowColor = v.c; c.shadowBlur = 18;
        const lo = Math.min(a0, head), hi = Math.max(a0, head);
        c.beginPath(); c.arc(v.x, v.y, v.r, Math.max(lo, hi - v.arc * 0.6), hi); c.stroke();
        c.globalCompositeOperation = 'source-over';
        // 휘두르는 칼(극이면 긴 자루)
        if (u < 1 || p < 0.5) {
          const [hx, hy] = pt(head, v.r * 1.02), [gx, gy] = pt(head, v.r * (v.pole ? 0.05 : 0.3));
          c.globalAlpha = fade; c.shadowBlur = 10; c.lineCap = 'round';
          const [bx, by] = pt(head, v.r * (v.pole ? 0.52 : 0.64));
          if (vs(c, v.pole ? 'ji' : 'dao', bx, by, v.r * (v.pole ? 1.02 : 0.78), head, fade, false, false)) { /* 그림으로 그렸다 */ }
          else {
          if (v.pole) { c.strokeStyle = '#6a3a1e'; c.lineWidth = 7; c.beginPath(); c.moveTo(gx, gy); c.lineTo(...pt(head, v.r * 0.72)); c.stroke(); }
          c.strokeStyle = '#e8eef5'; c.lineWidth = v.pole ? 9 : 7; c.beginPath(); c.moveTo(...(v.pole ? pt(head, v.r * 0.72) : [gx, gy])); c.lineTo(hx, hy); c.stroke();
          if (!v.pole) { const [ga, gb] = [pt(head, v.r * 0.3), head + Math.PI / 2]; c.strokeStyle = '#c9a24a'; c.lineWidth = 6; c.beginPath(); c.moveTo(ga[0] + Math.cos(gb) * 14, ga[1] + Math.sin(gb) * 14); c.lineTo(ga[0] - Math.cos(gb) * 14, ga[1] - Math.sin(gb) * 14); c.stroke(); }
          }
          Art.fxImg(c, 'hit', hx, hy, 60 * fade, head, fade);
        }
      } else if (v.k === 'ringwave') {
        // 포위: 링 위로 창끝(군대)이나 불길·충격파가 솟는다
        const rr = (v.r0 + v.r1) / 2, n = Math.max(12, Math.round(rr / 22));
        c.globalAlpha = 1 - p; c.strokeStyle = v.c; c.lineWidth = (v.r1 - v.r0) * 0.25 * (1 - p); c.beginPath(); c.arc(v.x, v.y, rr, 0, 7); c.stroke();
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2, x = v.x + Math.cos(a) * rr, y = v.y + Math.sin(a) * rr, up = Math.sin(Math.min(1, p * 2) * Math.PI) * 34;
          if (v.fx === 'flame') Art.fxImg(c, 'fire', x, y - 18 - up * 0.5, 54, UP, 1 - p);
          else if (v.fx === 'army' && k % 2 === 0 && vs(c, 'spears', x, y - 14 - up * 0.6, 54, -Math.PI / 2, 1 - p)) { /* 솟는 창 대열 */ }
          else if (v.fx === 'army') { /* 그림으로 그릴 때는 한 칸 건너 하나씩만 */ if (!VS.spears) { c.fillStyle = '#e8e8e8'; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x, y - 10 - up); c.lineTo(x + 6, y); c.closePath(); c.fill(); } }
          else { c.fillStyle = v.c; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x, y - 10 - up); c.lineTo(x + 6, y); c.closePath(); c.fill(); }
        }
      } else {
        // 직선을 따라 날아가거나 달려가는 것들
        const q = Math.min(1, p * 1.25), d = q * v.len, ca = Math.cos(v.a), sa = Math.sin(v.a);
        const px = v.x + ca * d - sa * v.off, py = v.y + sa * d + ca * v.off;
        c.translate(px, py); c.rotate(v.a);
        if (v.k === 'arrow' || v.k === 'troop' || v.k === 'wisp') c.scale(1.7, 1.7);
        c.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1;
        if (v.k === 'talisman' && VS.talisman) {
          // 부적(그림): 팔랑이며 날아가고 뒤로 빛 꼬리가 남는다
          const al = c.globalAlpha;
          vs(c, 'streak', -70, 0, 150, 0, al * 0.55, true);
          vs(c, 'talisman', 0, 0, 30, Math.PI / 2 + Math.sin(v.t * 30 + v.off) * 0.4, al);
        } else if (v.k === 'arrow' && VS.arrow) {
          const al = c.globalAlpha;
          if (v.c === VIS_COL.firearrow) { vs(c, 'streak', -44, 0, 110, 0, al * 0.9, true); }
          vs(c, 'arrow', -14, 0, 64, 0, al);
        } else if (v.k === 'gust' && VS.wind) {
          vs(c, 'wind', -v.w * 0.2, 0, Math.max(120, v.w * 1.5), 0, c.globalAlpha, true);
        } else if (v.k === 'troop' && VS.spears) {
          vs(c, 'spears', -18, 0, 74, 0, c.globalAlpha);
        } else if (v.k === 'wisp' && VS.wisp) {
          vs(c, 'wisp', -30, Math.sin(v.t * 14 + v.off) * 3, 96, 0, c.globalAlpha, true);
        } else if (v.k === 'slashline' && VS.slash) {
          // 검기: 초승달 모양 칼바람이 길을 따라 날아가고 뒤로 불꼬리가 따른다
          const al = c.globalAlpha, sz = Math.max(110, v.w * 1.7);
          vs(c, 'streak', -sz * 0.9, 0, sz * 1.9, 0, al * 0.8, true);
          vs(c, 'slash', 0, 0, sz, 0, al, true, true);
        } else if (v.k === 'streak' && VS.streak) {
          vs(c, 'streak', -Math.max(130, v.w * 1.2), 0, Math.max(260, v.w * 2.6), 0, c.globalAlpha, true);
        } else if (v.k === 'dustline' && VS.dust) {
          // 돌진이 지나간 자리: 흙먼지가 피어오른다
          c.rotate(-v.a); c.translate(-px, -py);
          for (let k = 0; k < 7; k++) { const dd = d * (k / 7), x = v.x + ca * dd, y = v.y + sa * dd; vs(c, 'dust', x, y - p * 14, v.w * (0.9 - k * 0.04) * (0.7 + p * 0.6), k * 1.3, 0.5 * (1 - p)); }
        } else if (v.k === 'talisman') {
          // 부적: 노란 종이에 붉은 글씨, 팔랑이며 날아간다
          c.rotate(Math.sin(v.t * 30 + v.off) * 0.4);
          c.shadowColor = '#ffe9a0'; c.shadowBlur = 12;
          c.fillStyle = '#f4d860'; c.fillRect(-22, -14, 44, 28); c.shadowBlur = 0; c.strokeStyle = '#b8231a'; c.lineWidth = 3; c.strokeRect(-18, -10, 36, 20);
          c.beginPath(); c.moveTo(-9, -5); c.lineTo(9, 5); c.moveTo(-9, 5); c.lineTo(9, -5); c.moveTo(0, -8); c.lineTo(0, 8); c.stroke();
          c.globalAlpha *= 0.4; c.fillStyle = v.c; c.fillRect(-80, -8, 56, 16);
        } else if (v.k === 'arrow') {
          c.strokeStyle = '#6a4a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-40, 0); c.lineTo(8, 0); c.stroke();
          c.fillStyle = '#e8e8e8'; c.beginPath(); c.moveTo(18, 0); c.lineTo(4, -6); c.lineTo(4, 6); c.closePath(); c.fill();
          if (v.c === VIS_COL.firearrow) Art.fxImg(c, 'fire', 10, 0, 34, 0, 1);
          c.globalAlpha *= 0.35; c.fillStyle = '#fff'; c.fillRect(-90, -1.5, 50, 3);
        } else if (v.k === 'gust') {
          c.strokeStyle = v.c; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, v.w * 0.45, -1.3, 1.3); c.stroke();
          c.globalAlpha *= 0.5; c.beginPath(); c.arc(-24, 0, v.w * 0.38, -1.2, 1.2); c.stroke(); c.beginPath(); c.arc(-48, 0, v.w * 0.3, -1.1, 1.1); c.stroke();
        } else if (v.k === 'troop') {
          // 진격하는 창끝 대열
          for (let k = -1; k <= 1; k++) { c.fillStyle = '#d8d8d8'; c.beginPath(); c.moveTo(16, k * 12); c.lineTo(0, k * 12 - 5); c.lineTo(0, k * 12 + 5); c.closePath(); c.fill(); c.strokeStyle = '#6a4a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, k * 12); c.lineTo(-40, k * 12); c.stroke(); }
          c.fillStyle = v.c; c.globalAlpha *= 0.5; c.fillRect(-44, -18, 8, 36);
        } else if (v.k === 'wisp') {
          c.fillStyle = v.c; c.globalAlpha *= 0.85; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill();
          c.globalAlpha *= 0.5; c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(-40, Math.sin(v.t * 20) * 10, -70, 0); c.quadraticCurveTo(-40, -Math.sin(v.t * 20) * 10, 0, 12); c.fill();
        } else if (v.k === 'slashline' || v.k === 'streak') {
          const gr = c.createLinearGradient(-160, 0, 20, 0); gr.addColorStop(0, v.c + '00'); gr.addColorStop(1, '#ffffff');
          c.fillStyle = gr; c.fillRect(-160, -v.w * 0.3, 180, v.w * 0.6);
        } else if (v.k === 'dustline') {
          // 돌진이 지나간 자리의 먼지
          c.rotate(-v.a); c.translate(-px, -py);
          for (let k = 0; k < 8; k++) { const dd = d * (k / 8), x = v.x + ca * dd, y = v.y + sa * dd; c.globalAlpha = 0.35 * (1 - p); c.fillStyle = '#c8b090'; c.beginPath(); c.arc(x + rnd(-8, 8), y + rnd(-8, 8), v.w * 0.3 * (1 - k / 10), 0, 7); c.fill(); }
        }
      }
      c.restore();
    }
  }
  // 바람(화살표 흐름)과 시선(보스 머리 위 눈)
  function drawAura(c, h) {
    c.save();
    if (h.k === 'wind') {
      c.globalAlpha = 0.5; c.strokeStyle = '#d8ecff'; c.lineWidth = 3;
      const l = Math.hypot(h.vx, h.vy) || 1, ux = h.vx / l, uy = h.vy / l;
      for (let i = 0; i < 36; i++) {
        const x = ARENA.x0 + ((i * 263) % (ARENA.x1 - ARENA.x0)), y0 = ARENA.y0 + ((i * 151) % (ARENA.y1 - ARENA.y0));
        const s = ((h.t * 220 + i * 70) % 300), x1 = x + ux * s, y1 = y0 + uy * s;
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + ux * 40, y1 + uy * 40); c.lineTo(x1 + ux * 30 - uy * 8, y1 + uy * 30 + ux * 8); c.stroke();
      }
    } else {
      const b = g.fight.boss;
      c.globalAlpha = 0.18; c.fillStyle = '#6a2aa0'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
      if (!vs(c, 'eye', b.x, b.y - 156, 170 * (1 + Math.sin(performance.now() / 260) * 0.05), 0, 0.98, true)) {
        c.globalAlpha = 0.95; c.fillStyle = '#f4e8ff'; c.beginPath(); c.ellipse(b.x, b.y - 150, 56, 26, 0, 0, 7); c.fill();
        c.fillStyle = '#7a1ad0'; c.beginPath(); c.arc(b.x, b.y - 150, 18, 0, 7); c.fill();
      }
      c.globalAlpha = 0.95;
      c.fillStyle = '#fff'; c.font = '700 18px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(I.t('walkHurt'), b.x, b.y - 108);
    }
    c.restore();
  }
  // 팔진도 문양(괘)
  function drawSym(c, x, y, s, sz) {
    for (let j = 0; j < 3; j++) {
      const yy = y - sz * 0.6 + j * sz * 0.6;
      if ((s >> j) & 1) c.fillRect(x - sz, yy - 4, sz * 2, 8);
      else { c.fillRect(x - sz, yy - 4, sz * 0.8, 8); c.fillRect(x + sz * 0.2, yy - 4, sz * 0.8, 8); }
    }
  }
  // 레이드 오브젝트: 제단·궁루·복병·군량고·돌기둥·칠성등·팔진 문·분신·잠행 표식
  function drawRaid(c, t) {
    const f = g.fight, M = f.mech, b = f.boss, act = g.phase === 'boss' ? g.active() : null;
    M.objs.forEach((o) => {
      c.save();
      if (o.k === 'gate') {
        if (vs(c, 'gate', o.x, o.y, o.r * 2.3, 0, 0.95)) { c.globalAlpha = 0.92; c.fillStyle = '#123040'; drawSym(c, o.x, o.y, o.s, Math.min(26, o.r * 0.42)); }
        else { c.globalAlpha = 0.85; c.strokeStyle = '#d8ecff'; c.lineWidth = 3; c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.stroke();
        c.fillStyle = '#d8ecff'; drawSym(c, o.x, o.y, o.s, 26); }
      } else if (o.k === 'pillar' && VS.pillar) {
        c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(o.x, o.y + o.r * 0.55, o.r * 1.1, o.r * 0.4, 0, 0, 7); c.fill();
        vs(c, 'pillar', o.x, o.y - o.r * 0.75, o.r * 2.3);
      } else if (o.k === 'pillar') {
        c.fillStyle = '#6f6a62'; c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.fill();
        c.strokeStyle = '#2c2a26'; c.lineWidth = 5; c.stroke();
        c.fillStyle = '#9b958a'; c.beginPath(); c.arc(o.x - 10, o.y - 10, o.r * 0.45, 0, 7); c.fill();
      } else if (o.k === 'clone') {
        drawBossAt(c, o.x, o.y, t, o.flash > 0);
      } else {
        // 공격할 수 있는 오브젝트
        const col = o.k === 'altar' ? '#f2dd5c' : o.k === 'tower' ? '#b08850' : '#c0c8d8';
        c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(o.x, o.y + o.r * 0.8, o.r, o.r * 0.35, 0, 0, 7); c.fill();
        c.fillStyle = o.flash > 0 ? '#fff' : col; c.strokeStyle = '#2a1c10'; c.lineWidth = 3;
        const pic = o.k === 'tower' ? 'tower' : o.k === 'altar' ? 'altar' : 'ambush', pw = o.k === 'tower' ? 104 : o.k === 'altar' ? 124 : o.r * 2.9, py = o.k === 'tower' ? o.y - 40 : o.k === 'altar' ? o.y - 22 : o.y - o.r * 0.25;
        if (vs(c, pic, o.x, py, pw)) { if (o.flash > 0) vs(c, pic, o.x, py, pw, 0, 0.75, true); /* 맞으면 번쩍 */ }
        else if (o.k === 'tower') { c.fillRect(o.x - 30, o.y - 50, 60, 80); c.strokeRect(o.x - 30, o.y - 50, 60, 80); c.beginPath(); c.moveTo(o.x - 42, o.y - 50); c.lineTo(o.x, o.y - 82); c.lineTo(o.x + 42, o.y - 50); c.closePath(); c.fill(); c.stroke(); }
        else if (o.k === 'altar') { c.fillRect(o.x - 34, o.y - 20, 68, 44); c.strokeRect(o.x - 34, o.y - 20, 68, 44); c.fillStyle = '#c03020'; c.fillRect(o.x - 8, o.y - 60, 16, 44); c.fillStyle = '#fff3a0'; c.font = '400 16px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.fillText('符', o.x, o.y - 32); }
        else { c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#2a1c10'; c.font = '400 22px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('伏', o.x, o.y); }
        bar(c, o.x, o.y - o.r - 34, 70, 6, Math.max(0, o.hp / (o.mhp || 1)), '#ff8a5c');
      }
      if (act && act.tgt === o.id) { c.globalAlpha = 1; c.strokeStyle = '#ff5040'; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); c.arc(o.x, o.y, o.r + 18, 0, 7); c.stroke(); c.setLineDash([]); }
      c.restore();
    });
    if (M.bur) {
      c.save(); c.strokeStyle = M.bur.lock ? '#ff5040' : '#c9b48a'; c.lineWidth = 4; c.globalAlpha = 0.9;
      if (VS.dust) { for (let i = 0; i < 4; i++) { const a = t * 2.2 + i * 1.57; vs(c, 'dust', M.bur.x + Math.cos(a) * 34, M.bur.y + Math.sin(a) * 20, 70, a, 0.6); } c.lineWidth = 2; c.beginPath(); c.ellipse(M.bur.x, M.bur.y, 52 + ((t * 30) % 18), (52 + ((t * 30) % 18)) * 0.6, 0, 0, 7); c.stroke(); }
      else for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(M.bur.x, M.bur.y, 30 + i * 22 + ((t * 40) % 22), 0, 7); c.stroke(); }
      c.restore();
    }
  }
  // 보스전 그림 크기: 장수 반지름(기존 31)과 보스 배율(기존 1). 동작이 잘 보이게 키웠다. 판정(사거리·장판)은 그대로다.
  const CHAMP_R = 40, BOSS_S = 1.25;
  function drawBossAt(c, x, y, t, flash) {
    const f = g.fight, bd = Art.facing(S.bossFace ?? Math.PI / 2), bMove = S.bossMove;
    const im = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, bd.v, bMove ? (Math.sin(t * 10) > 0 ? 1 : 2) : 0);
    Art.drawSprite(c, im, x, y - 56 * (BOSS_S - 1), 200 * BOSS_S, bd.flip, 0, flash ? 0.96 : 1);
    // 번쩍임은 캔버스 필터(brightness) 대신 같은 그림을 한 번 더 밝게 얹는다(필터는 휴대폰에서 매우 느리다)
    if (flash) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; Art.drawSprite(c, im, x, y - 56 * (BOSS_S - 1), 200 * BOSS_S, bd.flip, 0, 0.96); c.restore(); }
  }
  // 전장 바닥은 판마다 한 번만 그려 두고 찍는다(매 프레임 화면 전체에 그라디언트·무늬·그라디언트를 세 번 덧칠하던 것)
  let arenaCv = null, arenaKey = '';
  function arenaFloor(c, a) {
    const key = a.motif + a.ground + a.sky + qMap() + (Art.img('tex_' + a.motif) ? 1 : 0);
    if (arenaKey !== key) {
      arenaKey = key;
      if (!arenaCv) arenaCv = document.createElement('canvas');
      const q = qMap(), w = W + OVER.x * 2, h = H + OVER.y * 2;
      arenaCv.width = Math.round(w * q); arenaCv.height = Math.round(h * q);
      const x = arenaCv.getContext('2d');
      x.setTransform(q, 0, 0, q, OVER.x * q, OVER.y * q);
      const gr = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1300);
      gr.addColorStop(0, a.ground); gr.addColorStop(1, a.sky);
      x.fillStyle = gr; x.fillRect(-OVER.x, -OVER.y, w, h);
      // 바닥이 유닛·장판보다 튀지 않게 채도와 밝기를 낮추고(타일에 미리 구움) 경기장 색을 얇게 덮는다
      const floor = tilePat(x, 'tex_' + a.motif, 1.2, 'saturate(0.45) brightness(0.62) contrast(0.85)');
      arenaCv._tex = !!floor;
      if (floor) {
        x.fillStyle = floor; x.fillRect(-OVER.x, -OVER.y, w, h);
        x.fillStyle = gr; x.globalAlpha = 0.4; x.fillRect(-OVER.x, -OVER.y, w, h); x.globalAlpha = 1;
      }
    }
    blitBg(c, arenaCv, 'arena', arenaKey);
    return arenaCv._tex;
  }
  function drawArena(t) {
    const c = ctx, f = g.fight, a = f.def.arena, b = f.boss;
    if (!arenaFloor(c, a)) drawMotif(c, a.motif, '#f0e0c0', t);
    c.strokeStyle = f.def.fx + '66'; c.lineWidth = 3; c.strokeRect(ARENA.x0, ARENA.y0, ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0);
    f.hazards.forEach((h) => drawHazard(c, h));
    drawRaid(c, t);
    // 보스(잠행 중에는 보이지 않는다. 분신 기믹에서는 그림자가 있는 쪽이 진짜)
    const M = f.mech;
    if (!M.hide) {
    if (b.charge) { c.fillStyle = f.def.fx + '55'; c.beginPath(); c.arc(b.x, b.y, 86, 0, 7); c.fill(); }
    if (M.ctr > 0) { c.save(); c.globalAlpha = 0.5 + Math.sin(t * 20) * 0.3; c.fillStyle = '#4aa8ff'; c.beginPath(); c.arc(b.x, b.y, 110, 0, 7); c.fill(); c.restore(); }
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(b.x, b.y + 62, 62 * BOSS_S, 20 * BOSS_S, 0, 0, 7); c.fill();
    c.strokeStyle = f.def.fx; c.lineWidth = 4; c.beginPath(); c.ellipse(b.x, b.y + 62, 62 * BOSS_S, 20 * BOSS_S, 0, 0, 7); c.stroke();
    // 게임은 1초에 30번 움직이고 화면은 그보다 자주 그려서, 프레임마다 '움직임'만 보면 걷기·서기가 번갈아 덜덜 떨린다.
    // 마지막으로 움직인 뒤 0.15초까지는 걷는 중으로 본다.
    const bdx = b.x - (S.bossX ?? b.x), bdy = b.y - (S.bossY ?? b.y), moved = Math.hypot(bdx, bdy) > 0.3;
    if (moved) { S.bossFace = Math.atan2(bdy, bdx); S.bossMovedAt = t; }
    const bMove = S.bossMovedAt != null && t - S.bossMovedAt < 0.15 && t >= S.bossMovedAt;
    S.bossX = b.x; S.bossY = b.y;
    S.bossMove = bMove;
    const bd = Art.facing(S.bossFace ?? Math.PI / 2);
    // ---- 타격감: 맞으면 공격한 쪽 반대로 밀리고 움찔(찌그러졌다 펴짐), 하얗게 번쩍. 패턴 전에는 힘을 모으고(솟으며 부풂) 터질 때 내리찍는다 ----
    const hr = S.bhr && S.bhr.f === f ? S.bhr : (S.bhr = { f, k: 0, ax: 0, ay: 1, hp: b.hp, num: 0, numT: 0, wind: 0, slam: 0 });
    if (b.hp < hr.hp - 0.5) {
      const ac = g.active(), dmg = hr.hp - b.hp;
      if (ac) { const a = Math.atan2(b.y - ac.y, b.x - ac.x); hr.ax = Math.cos(a); hr.ay = Math.sin(a); }
      hr.k = Math.min(1.4, hr.k + 0.55 + Math.min(0.6, dmg / (b.mhp * 0.02))); hr.num += dmg;
    }
    hr.hp = b.hp; hr.k *= Math.pow(0.8, S.f60);
    hr.numT += S.fdt;
    if (hr.num > 0 && hr.numT > 0.14) { if (S.dmg.length < 50) S.dmg.push({ x: b.x + (Math.random() - 0.5) * 70, y: b.y - 96, v: Math.round(hr.num), t: 0, hit: true }); hr.num = 0; hr.numT = 0; }
    let wind = 0;
    f.hazards.forEach((h) => { if (!h.own && h.t < h.delay) wind = Math.max(wind, h.t / Math.max(0.01, h.delay)); });
    if (hr.wind > 0.85 && wind < 0.2) { hr.slam = 1; S.shake = Math.max(S.shake || 0, 0.55); }
    hr.wind = wind; hr.slam *= Math.pow(0.86, S.f60);
    const wk = Math.pow(wind, 1.5), push = hr.k * 16;
    const bx = b.x + hr.ax * push, by = b.y + hr.ay * push * 0.6 - wk * 18 + hr.slam * 10 - 56 * (BOSS_S - 1);
    const sy = (1 - hr.k * 0.08) * (1 + wk * 0.08) * (1 - hr.slam * 0.1), sc = 200 * BOSS_S * (1 + hr.k * 0.04 + wk * 0.06 + hr.slam * 0.05);
    const bImg = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, bd.v, bMove ? (Math.sin(t * 10) > 0 ? 1 : 2) : 0);
    // 힘 모으기: 붉은 기운이 몸에 맺힌다
    if (wk > 0.05) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = wk * 0.5; c.drawImage(glowSprite('w' + f.def.fx, [[0, f.def.fx + 'cc'], [0.6, f.def.fx + '44'], [1, f.def.fx + '00']]), bx - 130, by - 150, 260, 260); c.restore(); }
    const RG = window.RTD_RIG;
    // 조각 애니메이션 보스: 기술 전 힘 모으기 → 터질 때 내지르기. 기술 종류에 따라 전방위(정면에서 두 팔 벌리기)·소환(무기 치켜들기)은 앞모습,
    // 겨누기는 옆모습으로 상대를 본다. 평소에는 이동 방향의 그림(앞·옆)을 쓰고, 조각이 없는 방향(뒷모습)은 기존 그림.
    const casting = wind > 0.05 || hr.slam > 0.1, act = S.bossAct || 'raise';
    const rView = casting ? (act === 'aim' ? 's' : 'f') : bd.v === 2 ? 's' : bd.v <= 1 ? 'f' : null;
    const rv = RG && rView && (RG.has(f.def.id, rView) ? rView : casting && RG.has(f.def.id, 's') ? 's' : null);
    if (rv) {
      const st = wind > 0.05 ? { state: 'skill', act, p: wind * 0.45, t } : hr.slam > 0.1 ? { state: 'skill', act, p: 0.45 + (1 - hr.slam) * 0.55, t } : hr.k > 0.15 ? { state: 'hurt', k: Math.min(1, hr.k), t } : { state: bMove ? 'walk' : 'idle', t };
      st.view = rv;
      const tgt = g.active(), flipR = rv === 'f' ? bd.flip : casting ? (tgt ? tgt.x < b.x : false) : bMove ? Math.cos(S.bossFace ?? 0) < 0 : tgt ? tgt.x < b.x : false; // 옆모습은 멈춰 있거나 기술을 쓰면 내 장수 쪽을 본다
      const drawR = () => { c.save(); c.translate(bx, by); c.scale(1, sy); RG.draw(c, f.def.id, 0, 0, sc, flipR, st); c.restore(); };
      drawR();
      if (hr.k > 0.08) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(0.85, hr.k * 0.7); drawR(); c.restore(); }
    } else {
      Art.drawSprite(c, bImg, bx, by, sc, bd.flip, hr.ax * hr.k * 0.06 * (bd.flip ? -1 : 1), sy);
      if (hr.k > 0.08) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(0.85, hr.k * 0.7); Art.drawSprite(c, bImg, bx, by, sc, bd.flip, 0, sy); c.restore(); }
    }
    if (hr.slam > 0.1) { Art.fxAnim(c, 'ring', 1 - hr.slam, b.x, b.y + 62, 420, 170, 0, 1); Art.fxAnim(c, 'boom2', Math.min(0.99, (1 - hr.slam) * 1.3), b.x, b.y + 40, 260, 260, 0, 0.9); }
    if (hr.slam > 0.1) { c.save(); c.globalAlpha = hr.slam * 0.8; c.strokeStyle = '#fff2d0'; c.lineWidth = 6 * hr.slam; c.beginPath(); c.ellipse(b.x, b.y + 62, 70 + (1 - hr.slam) * 120, 24 + (1 - hr.slam) * 40, 0, 0, 7); c.stroke(); c.restore(); }
    c.filter = 'none';
    c.textAlign = 'center';
    if (M.charmT > 0) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.8 + i / 5) % 1, hx = b.x + Math.sin(i * 2.3 + t * 2) * 46, hy = b.y - 70 - ph * 90, s = 14 + Math.sin(ph * Math.PI) * 10;
        c.globalAlpha = Math.sin(ph * Math.PI) * 0.9; c.fillStyle = i % 2 ? '#ff7ac0' : '#ffb0dc';
        c.beginPath(); c.moveTo(hx, hy + s * 0.35); c.bezierCurveTo(hx - s, hy - s * 0.4, hx - s * 0.45, hy - s, hx, hy - s * 0.45); c.bezierCurveTo(hx + s * 0.45, hy - s, hx + s, hy - s * 0.4, hx, hy + s * 0.35); c.fill();
      }
      c.restore();
      c.fillStyle = '#ff9ad0'; c.font = '400 28px "Black Han Sans", sans-serif'; c.fillText(I.t('e_charm'), b.x, b.y - 84);
    } else if (b.stun > 0) { c.fillStyle = '#ffe27a'; c.font = '700 20px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('stun'), b.x, b.y - 84); }
    if (M.gr > 0) { c.fillStyle = '#7fd4ff'; c.font = '400 30px "Black Han Sans", sans-serif'; c.fillText(I.t('groggy'), b.x, b.y - 96); }
    if (M.ctr > 0) {
      c.fillStyle = '#bfe2ff'; c.font = '400 28px "Black Han Sans", sans-serif'; c.fillText(I.t('counter'), b.x, b.y - 112);
      // 반격 게이지: 정면에서 넣은 피해
      bar(c, b.x, b.y - 92, 150, 8, Math.min(1, (M.ctrGot || 0) / (M.ctrNeed || 1)), '#4aa8ff');
    }
    if (M.ampT > 0) { c.fillStyle = '#d8b4ff'; c.font = '700 18px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('weakened', { n: Math.round(M.amp * 100) }), b.x, b.y + 98); }
    // 팔진도: 보스 머리 위 문양과 같은 문이 생문
    if (M.objs.some((o) => o.k === 'gate')) { c.fillStyle = 'rgba(16,11,8,.7)'; c.fillRect(b.x - 46, b.y - 170, 92, 70); c.fillStyle = '#d8ecff'; drawSym(c, b.x, b.y - 135, M.sym, 30); }
    }
    // 출전 무장
    const act = g.phase === 'boss' ? g.active() : null;
    // 일기토 대기 장수: 결투장 왼쪽 아래에 흐리게 줄 세운다
    f.champs.filter((u) => u.bench).forEach((u, i) => {
      c.globalAlpha = 0.45; Art.drawSprite(c, Art.unitSprite(u.def, 0, 0), ARENA.x0 + 40 + i * 60, ARENA.y1 - 40, 60, false); c.globalAlpha = 1;
      c.fillStyle = '#ffd86a'; c.font = '700 13px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(I.t('waiting'), ARENA.x0 + 40 + i * 60, ARENA.y1 - 78);
    });
    f.champs.forEach((u) => {
      if (u.dead || u.bench) return;
      if (u === act) {
        c.strokeStyle = '#7dff8e'; c.lineWidth = 2; c.beginPath(); c.ellipse(u.x, u.y + 6, 46, 38, 0, 0, 7); c.stroke();
        c.strokeStyle = 'rgba(125,255,142,.2)'; c.lineWidth = 1; c.beginPath(); c.arc(u.x, u.y, g.range(u.def) + 40, 0, 7); c.stroke();
        if (u.move) { c.strokeStyle = 'rgba(125,255,142,.5)'; c.beginPath(); c.moveTo(u.x, u.y); c.lineTo(u.tx, u.ty); c.stroke(); }
      }
      drawBuffs(c, u, t);
      // 맞으면 보스 반대쪽으로 튕겨 밀린다(그림만, 위치는 그대로)
      const kb = Math.max(0, (u.hurt || 0) / 0.2), ka = Math.atan2(u.y - b.y, u.x - b.x), kx = u.x + Math.cos(ka) * kb * 12, ky = u.y + Math.sin(ka) * kb * 8;
      if (u.hurt > 0) { c.fillStyle = `rgba(255,60,40,${0.45 * kb})`; c.beginPath(); c.arc(kx, ky, 44, 0, 7); c.fill(); }
      // 조각 애니메이션 동작 상태: 공격(atkT 0.24)·스킬(0.36 이상)은 시작할 때의 길이로 구분, 맞으면 피격, 움직이면 걷기
      if ((u.atkT || 0) > (u._atkPrev || 0) + 0.01) u._atkMax = u.atkT;
      u._atkPrev = u.atkT || 0;
      const rs = u.atkT > 0 ? { state: (u._atkMax || 0) >= 0.3 ? 'skill' : 'attack', p: 1 - u.atkT / (u._atkMax || 0.24), t } : kb > 0.05 ? { state: 'hurt', k: kb, t } : { state: u.move || u.moveT > 0 ? 'walk' : 'idle', t };
      piece(c, kx, ky, CHAMP_R, u.def, t, u.owner === 1, { pose: poseOf(u, t, CHAMP_R), rig: rs });
      bar(c, u.x, u.y - 80, 76, 7, u.hp / u.mhp, u.hp / u.mhp < 0.3 ? '#ff6a50' : '#7ed08c');
    });
    drawAim(c);
    Object.values(f.ghosts).forEach((o) => {
      if (!o.def) return;
      // 동료 유닛은 위치 변화로 방향을 맞춘다
      const pv = (S.ghostPos = S.ghostPos || {})[o.name] || { x: o.x, y: o.y, moveT: 0, face: Math.PI / 2, def: o.def, id: 1 };
      if (Math.hypot(o.x - pv.x, o.y - pv.y) > 0.3) { pv.face = Math.atan2(o.y - pv.y, o.x - pv.x); pv.moveT = 0.15; } else pv.moveT = Math.max(0, pv.moveT - S.fdt);
      pv.x = o.x; pv.y = o.y; S.ghostPos[o.name] = pv;
      c.globalAlpha = 0.85; piece(c, o.x, o.y, CHAMP_R, o.def, t, true, { pose: poseOf(pv, t, CHAMP_R) }); c.globalAlpha = 1;
      bar(c, o.x, o.y - 78, 72, 6, o.hpf, '#7fd4ff');
      c.fillStyle = '#d8f0ff'; c.font = '500 14px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(o.name || '', o.x, o.y + 52);
    });
    drawVfx(c);
    drawFx(c);
    if (g.mut.night) drawNight(c, true);
    if (g.phase === 'boss') {
      // 휴대폰에서는 보스 체력·남은 시간·기술 이름·딜미터를 키워 그린다(위 가운데 / 오른쪽 위 기준)
      const us = uiS();
      c.save(); c.translate(W - 56, 66); c.scale(Math.min(us, 1.3), Math.min(us, 1.3)); c.translate(-(W - 56), -66);
      drawMeter(c, meterRows(f.dealt, f.total));
      c.restore();
      c.save(); c.translate(W / 2, 0); c.scale(us, us); c.translate(-W / 2, 0);
      bar(c, W / 2, 12, 960, 26, b.hp / b.mhp, f.def.fx);
      c.fillStyle = '#fff'; c.font = '700 18px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineJoin = 'round'; c.strokeText(`${f.def.name}  ${fmt(b.hp)} / ${fmt(b.mhp)}`, W / 2, 26);
      c.fillText(`${f.def.name}  ${fmt(b.hp)} / ${fmt(b.mhp)}`, W / 2, 26);
      const left = Math.max(0, f.limit - f.t), fast = f.t / f.limit <= 1 - g.fastNeed();
      c.fillStyle = left < 20 ? '#ff7a60' : '#fff'; c.font = '400 28px "Black Han Sans", sans-serif'; c.fillText(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, W / 2, 58);
      c.fillStyle = fast ? '#ffd86a' : '#a8987f'; c.font = '500 13px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t(fast ? 'fastOk' : 'fastNo'), W / 2, 82);
      const M = f.mech;
      if (M.vuln > 0) { c.fillStyle = '#ffb070'; c.font = '700 14px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('vuln', { n: Math.round(M.vuln * 100) }), W / 2 + 560, 26); }
      if (M.cast) {
        const fr = Math.min(1, M.cast.got / M.cast.need), left = Math.max(0, M.cast.dur - M.cast.t);
        c.fillStyle = 'rgba(16,11,8,.75)'; c.fillRect(W / 2 - 330, 150, 660, 58);
        bar(c, W / 2, 190, 620, 16, fr, '#7fd4ff');
        c.fillStyle = '#fff'; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('castLine', { a: M.cast.n, p: Math.round(fr * 100), s: left.toFixed(1) }) + I.t(M.cast.spots ? 'castSpots' : 'castAll'), W / 2, 166);
        // 서야 할 자리는 실제 전장 좌표라서 글씨 확대를 잠시 풀고 그린다
        if (M.cast.spots) { c.save(); c.translate(W / 2, 0); c.scale(1 / us, 1 / us); c.translate(-W / 2, 0); c.strokeStyle = '#a8ffb8'; c.lineWidth = 3; c.setLineDash([10, 8]); M.cast.spots.forEach((s) => { c.beginPath(); c.arc(s[0], s[1], s[2], 0, 7); c.stroke(); }); c.setLineDash([]); c.restore(); }
      }
      if (M.objs.some((o) => o.k === 'clone')) { c.fillStyle = '#fff'; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('clones'), W / 2, 176); }
      if (S.pattern && S.pattern.t > 0) {
        S.pattern.t -= S.fdt;
        c.fillStyle = f.def.fx; c.font = '400 38px "Black Han Sans", sans-serif'; c.globalAlpha = Math.min(1, S.pattern.t * 2); c.fillText(S.pattern.name, W / 2, 124); c.globalAlpha = 1;
      }
      c.restore();
    }
    if (g.phase === 'bossIntro') {
      const p = 1 - f.introT / 4.2, bh = Math.min(120, p * 500);
      c.fillStyle = '#000'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, OVER.y + bh); c.fillRect(-OVER.x, H - bh, W + OVER.x * 2, OVER.y + bh);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#e8dcc0'; c.font = '700 26px "Gowun Batang", serif'; c.fillText(I.t('roundPlace', { r: f.def.round, p: f.def.place }), W / 2, 60);
      c.fillStyle = f.def.fx; c.font = '400 76px "Black Han Sans", sans-serif'; c.globalAlpha = Math.min(1, p * 3); c.fillText(f.def.title, W / 2, H - 230);
      c.fillStyle = '#fff'; c.font = '400 42px "Black Han Sans", sans-serif'; c.fillText(f.def.name, W / 2, H - 160);
      c.fillStyle = '#e8dcc0'; c.font = '400 23px "Gowun Batang", serif'; c.fillText(`“${f.def.line}”`, W / 2, H - 60); c.globalAlpha = 1;
    }
  }
  const popQ = [];
  const POP_DUR = { 4: 2.4, 5: 2.4, 6: 3.2, 7: 3.8, 8: 3.4, 9: 6.6, 10: 7.2 };
  function queuePop(def, who) { if (def.tier >= 9) { illust(def); try { document.fonts.load('400 200px "Yuji Boku"', '不滅神話'); } catch (e) {} vx('ring'); vx(def.tier === 10 ? 'burst_imm' : 'burst_myth'); ['flame_01', 'flame_02', 'flame_03', 'flame_04', 'flame_05', 'flame_06', 'smoke_04', 'smoke_07', 'exp0', 'exp1', 'exp2', 'exp3', 'exp4', 'exp5', 'exp6', 'exp7', 'exp8', 'bsm0', 'bsm4', 'bsm8', 'bsm12', 'bsm16', 'bsm20'].forEach((n) => kn(n, '255,255,255')); } popQ.push({ def, who, t: 0, dur: POP_DUR[def.tier] || 2.4, hits: {}, fire: [], shake: 0 }); }
  function star(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.44 : r; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }
  // 별이 반투명하게 커졌다가 작아지며 박힌다
  function slamStar(c, p, key, x, y, r, col, at, big) {
    const tt = p.t - at;
    if (tt < 0) return;
    const f = Math.min(1, tt / 0.18), s = 3.2 - 2.2 * f;
    if (f >= 1 && !p.hits[key]) { p.hits[key] = 1; p.shake = big ? 1 : 0.5; Snd.play(big ? 'bigslam' : 'slam', 20); }
    c.globalAlpha = 0.4 + 0.6 * f; c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 2;
    star(c, x, y, r * s); c.fill(); c.stroke();
    if (f >= 1 && tt < 0.55) { c.globalAlpha = 1 - (tt - 0.18) / 0.37; c.lineWidth = 4; c.strokeStyle = col; c.beginPath(); c.arc(x, y, r * (1 + (tt - 0.18) * 6), 0, 7); c.stroke(); }
    c.globalAlpha = 1;
  }
  function popBand(c, y, h, a) {
    const g2 = c.createLinearGradient(0, y, 0, y + h);
    g2.addColorStop(0, 'rgba(10,6,4,0)'); g2.addColorStop(0.2, 'rgba(10,6,4,.86)'); g2.addColorStop(0.8, 'rgba(10,6,4,.86)'); g2.addColorStop(1, 'rgba(10,6,4,0)');
    c.globalAlpha = a; c.fillStyle = g2; c.fillRect(-OVER.x, y, W + OVER.x * 2, h); c.globalAlpha = 1;
  }
  function popName(c, p, y, size, a) {
    c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff'; c.font = `400 ${size}px "Black Han Sans", sans-serif`;
    c.fillText(I.t('appears', { a: (p.who ? I.t('whose', { w: p.who }) : '') + p.def.name }), W / 2, y); c.globalAlpha = 1;
  }
  const glowCache = {};
  function softGlow(rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.4, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return (glowCache[rgb] = cv);
  }
  // 신화·불멸 등장: 빛줄기 → 한문 명대사와 번역 → 등급 글자가 불타며 박힘 → 그림·한자 이름·한글 이름
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const HZ_FONT = '"Noto Serif KR", "Noto Serif SC", "Noto Serif TC", "SimSun", serif';
  function fitFont(c, text, weight, size, family, maxW) {
    let sz = size; c.font = `${weight} ${sz}px ${family}`;
    while (sz > 20 && c.measureText(text).width > maxW) { sz -= 4; c.font = `${weight} ${sz}px ${family}`; }
    return sz;
  }
  // 고해상도 일러스트: 처음 필요할 때 받고, 가장자리를 어둡게 흐려 연출 화면에 녹인다
  const ILL = {};
  function illust(d) {
    if (!(T.illusts || {})[d.id]) return null;
    let e = ILL[d.id];
    if (!e) {
      e = ILL[d.id] = { im: new Image(), cv: null };
      e.im.onload = () => {
        const w = e.im.naturalWidth, h = e.im.naturalHeight, cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const x = cv.getContext('2d');
        x.drawImage(e.im, 0, 0);
        x.globalCompositeOperation = 'destination-in';
        const gx = x.createLinearGradient(0, 0, w, 0);
        gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.18, '#000'); gx.addColorStop(0.82, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gx; x.fillRect(0, 0, w, h);
        const gy = x.createLinearGradient(0, 0, 0, h);
        gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.08, '#000'); gy.addColorStop(0.8, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gy; x.fillRect(0, 0, w, h);
        e.cv = cv;
      };
      e.im.src = 'gfx/il_' + d.id + '.jpg?v=' + T.illusts[d.id];
    }
    return e.cv;
  }
  // 생성 이펙트(검은 배경 jpg, 더하기 합성으로 쓴다)
  const VX = {};
  function vx(name) {
    let e = VX[name];
    if (!e) { e = VX[name] = new Image(); e.src = 'gfx/vx_' + name + '.jpg?v=1'; }
    return e.complete && e.naturalWidth ? e : null;
  }
  // 일러스트를 크게 흐려 깔아 연출 배경 색을 그림과 맞춘다
  function illustBg(d) {
    const il = illust(d), e = ILL[d.id];
    if (!il) return null;
    if (!e.bg) {
      const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270;
      const x = cv.getContext('2d'), sc = Math.max(cv.width / e.im.naturalWidth, cv.height / e.im.naturalHeight) * 1.25;
      x.filter = 'blur(14px) saturate(1.3) brightness(0.55)';
      x.drawImage(e.im, (cv.width - e.im.naturalWidth * sc) / 2, (cv.height - e.im.naturalHeight * sc) / 2 - 20, e.im.naturalWidth * sc, e.im.naturalHeight * sc);
      e.bg = cv;
    }
    return e.bg;
  }
  // Kenney 입자 텍스처(CC0, gfx/kn_*.png): 흰색 그림을 원하는 색으로 물들여 캐시한다
  const KN = {};
  function kn(name, rgb) {
    const key = name + '|' + rgb;
    if (KN[key]) return KN[key].cv;
    let base = KN[name];
    if (!base) { base = KN[name] = { im: new Image() }; base.im.src = 'gfx/kn_' + name + '.png?v=1'; }
    if (!(base.im.complete && base.im.naturalWidth)) return null;
    const cv = document.createElement('canvas'); cv.width = base.im.naturalWidth; cv.height = base.im.naturalHeight;
    // 곱하기로 물들여 텍스처 안의 명암(결)을 살리고, 원래 투명도로 다시 잘라 낸다
    const x = cv.getContext('2d'); x.drawImage(base.im, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${rgb})`; x.fillRect(0, 0, cv.width, cv.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(base.im, 0, 0);
    KN[key] = { cv };
    return cv;
  }
  // 연기 뭉치 그림(한 번 만들어 둔다): 옅은 덩어리 여러 개를 겹친 불규칙한 연기
  let puffCv = null;
  function smokePuff() {
    if (puffCv) return puffCv;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, d = 18 + (i * 37 % 23), px = 64 + Math.cos(a) * d * 0.9, py = 64 + Math.sin(a) * d * 0.7, r = 22 + (i * 13 % 18);
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(232,222,255,.55)'); g.addColorStop(1, 'rgba(232,222,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    return (puffCv = cv);
  }
  function slamOnce(p, key, big) { if (!p.hits[key]) { p.hits[key] = 1; p.shake = big ? 1.3 : 0.7; Snd.play(big ? 'bigslam' : 'slam', 20); } }
  function drawCutscene(c, p, t) {
    const d = p.def, imm = d.tier === 10, T0 = p.t, fade = Math.min(1, T0 * 5) * Math.min(1, (p.dur - T0) * 2.5);
    // 불멸은 붉은 불꽃, 신화는 보랏빛 불꽃과 번개
    const C = imm ? { core: '255,240,170', mid: '255,110,30', out: '190,20,10', hex: '#ff5a2a', soft: '#ffd27a' } : { core: '255,235,255', mid: '210,110,255', out: '90,30,200', hex: '#d070ff', soft: '#f0c8ff' };
    c.save();
    if (p.shake > 0) c.translate((Math.random() - 0.5) * 26 * p.shake, (Math.random() - 0.5) * 26 * p.shake);
    c.globalAlpha = fade; c.fillStyle = '#050304'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
    // 1) 빛줄기가 화면을 가로지른다
    if (T0 < 0.95) {
      const q = Math.min(1, T0 / 0.8), k = q * q * (3 - 2 * q), x = -500 + (W + 1000) * k;
      c.globalCompositeOperation = 'lighter';
      c.save(); c.translate(x, H / 2); c.rotate(-0.32);
      const gr = c.createLinearGradient(-160, 0, 160, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, `rgba(${C.mid},.5)`); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, `rgba(${C.mid},.5)`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalAlpha = fade * (1 - Math.max(0, T0 - 0.75) / 0.2); c.fillStyle = gr; c.fillRect(-160, -H * 1.4, 320, H * 2.8);
      c.restore();
      // 가로 섬광선
      const lg = c.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(Math.min(1, Math.max(0, x / W)), 'rgba(255,255,255,.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalAlpha = fade * 0.8 * (1 - T0 / 0.95); c.fillStyle = lg; c.fillRect(-OVER.x, H / 2 - 2, W + OVER.x * 2, 4);
      c.globalCompositeOperation = 'source-over';
    }
    // 2) 한문 명대사 → 번역
    const qc = d.qc || '', qk = d.quote || '';
    if (T0 > 0.45 && T0 < 3.05) {
      const out = 1 - Math.max(0, (T0 - 2.7) / 0.35), chars = Array.from(qc), cnt = Math.min(chars.length, Math.floor((T0 - 0.5) * 16) + 1);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const sz = fitFont(c, qc, 900, 76, HZ_FONT, W - 180);
      // 한 글자씩 빛나며 찍힌다(전체 폭 기준으로 위치를 잡는다)
      const full = c.measureText(qc).width; let cx = W / 2 - full / 2;
      chars.forEach((ch, i) => {
        const w = c.measureText(ch).width;
        if (i < cnt) {
          const age = (T0 - 0.5) - i / 16, pop = 1 + Math.max(0, 0.25 - age) * 2.4;
          c.save(); c.translate(cx + w / 2, H / 2 - 50); c.scale(pop, pop);
          c.globalAlpha = fade * out; c.shadowColor = C.hex; c.shadowBlur = 26; c.fillStyle = '#fff6e6'; c.font = `900 ${sz}px ${HZ_FONT}`; c.fillText(ch, 0, 0);
          c.restore();
        }
        cx += w;
      });
      if (T0 > 0.5 + chars.length / 16) {
        const ka = Math.min(1, (T0 - 0.5 - chars.length / 16) * 3) * out;
        c.globalAlpha = fade * ka; c.shadowBlur = 0; c.fillStyle = '#e8d8b8';
        fitFont(c, qk, 700, 36, '"Gowun Batang", serif', W - 220); c.fillText(qk, W / 2, H / 2 + 40);
        c.strokeStyle = C.hex; c.lineWidth = 1.5; c.globalAlpha = fade * ka * 0.7; c.beginPath(); c.moveTo(W / 2 - 260 * ka, H / 2 + 4); c.lineTo(W / 2 + 260 * ka, H / 2 + 4); c.stroke();
      }
    }
    // 3) 섬광
    if (T0 >= 2.95 && T0 < 3.5) slamOnce(p, 'flash', true);
    if (T0 >= 2.95) {
      const rx = W * 0.3, ry = H * 0.36, rank = rankName(d.tier);
      const pulse = 0.8 + Math.sin(t * (imm ? 9 : 6)) * 0.12;
      const hx = W * 0.7, hy = H * 0.56, ga = ease((T0 - 3.2) / 0.5), bga = ease((T0 - 2.95) / 0.7);
      // 흐린 일러스트 배경 + 가장자리 어둡게
      const bg = illustBg(d);
      if (bg) { c.globalAlpha = fade * bga; c.drawImage(bg, -OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); }
      const vg = c.createRadialGradient(W * 0.55, H * 0.5, H * 0.25, W * 0.55, H * 0.5, W * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)');
      c.globalAlpha = fade; c.fillStyle = vg; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
      c.globalCompositeOperation = 'lighter';
      // 인물 뒤 은은한 등급 빛
      const gl = c.createRadialGradient(hx, hy - 40, 20, hx, hy - 40, 460);
      gl.addColorStop(0, `rgba(${C.mid},${0.45 * ga})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = fade; c.fillStyle = gl; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
      // 소환진: 인물 뒤에서 천천히 돈다(바깥 큰 고리, 안쪽 반대로 도는 고리)
      const ring = vx('ring');
      if (ring) {
        const rs0 = 760 * (0.85 + 0.15 * ga);
        c.save(); c.translate(hx, hy - 60); c.rotate(t * 0.12); c.globalAlpha = fade * ga * 0.55; c.drawImage(ring, -rs0 / 2, -rs0 / 2, rs0, rs0); c.restore();
        c.save(); c.translate(hx, hy - 60); c.rotate(-t * 0.2); c.globalAlpha = fade * ga * 0.3; c.drawImage(ring, -rs0 * 0.33, -rs0 * 0.33, rs0 * 0.66, rs0 * 0.66); c.restore();
      }
      // 빛 폭발: 섬광 순간 등급 글자 자리에서 크게 터지고, 인물 뒤에는 약하게 맥동한다
      const burst = vx(imm ? 'burst_imm' : 'burst_myth');
      if (burst) {
        const bk = (T0 - 2.95) / 0.9;
        if (bk < 1) { const bs = 300 + 1500 * ease(bk); c.save(); c.translate(rx, ry); c.rotate(bk * 0.6); c.globalAlpha = fade * (1 - bk); c.drawImage(burst, -bs / 2, -bs / 2, bs, bs); c.restore(); }
        const ps = 980 * (0.95 + Math.sin(t * 2.2) * 0.05);
        c.save(); c.translate(hx, hy - 40); c.rotate(t * 0.05); c.globalAlpha = fade * ga * 0.32; c.drawImage(burst, -ps / 2, -ps / 2, ps, ps); c.restore();
      }
      // 불티: 작고 밝은 불씨가 흩날린다(불멸만). 신화는 바닥에 깔린 연기가 낮게 피어오른다.
      if (!imm) {
        c.globalCompositeOperation = 'source-over';
        p.fog = p.fog || [];
        if (Math.random() < 0.5 * qPart()) p.fog.push({ x: Math.random() * W, y: H + 30, vx: (Math.random() - 0.5) * 14, vy: -(14 + Math.random() * 22), l: 0, m: 5 + Math.random() * 3, r: 90 + Math.random() * 90, a: Math.random() * 6 });
        const fa = fade * Math.min(1, Math.max(0, (T0 - 2.95) / 1));
        for (let i = p.fog.length - 1; i >= 0; i--) {
          const q = p.fog[i]; q.l += 1 / 60; q.x += (q.vx + Math.sin(q.l * 0.6 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 10) / 60; q.y += q.vy / 60;
          const k = q.l / q.m;
          if (k >= 1) { p.fog.splice(i, 1); continue; }
          const rr = q.r * (0.8 + k * 0.9);
          const fog = kn((q.alt == null ? (q.alt = Math.random() < 0.5) : q.alt) ? 'smoke_07' : 'smoke_04', '190,175,230') || smokePuff();
          c.save(); c.translate(q.x, q.y); c.rotate(q.a + q.l * 0.08); c.globalAlpha = fa * Math.sin(k * Math.PI) * 0.2;
          c.drawImage(fog, -rr, -rr * 0.7, rr * 2, rr * 1.4); c.restore();
        }
        c.globalCompositeOperation = 'lighter';
      }
      const n = Math.ceil((imm ? 6 : 0) * qPart());
      for (let i = 0; i < n; i++) {
        const nearText = Math.random() < 0.5;
        p.fire.push({ x: nearText ? rx + (Math.random() - 0.5) * 420 : Math.random() * W, y: nearText ? ry + 40 + Math.random() * 60 : H + 20, vx: (Math.random() - 0.5) * 40, vy: -(60 + Math.random() * 200), l: 0, m: 0.9 + Math.random() * 1.6, r: 2 + Math.random() * 5 });
      }
      for (let i = p.fire.length - 1; i >= 0; i--) {
        const q = p.fire[i]; q.l += 1 / 60; q.x += (q.vx + Math.sin(q.l * 4 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 30) / 60; q.y += q.vy / 60;
        const k = q.l / q.m;
        if (k >= 1) { p.fire.splice(i, 1); continue; }
        const rr = q.r * (1 - k * 0.5) * 3;
        c.globalAlpha = fade * (1 - k) * Math.min(1, k * 6) * 0.9; c.drawImage(softGlow(k < 0.4 ? C.core : C.mid), q.x - rr, q.y - rr, rr * 2, rr * 2);
      }
      // 글자 주변: 불멸은 큰 불꽃이 거세게 타오르고, 신화는 보랏빛 아지랑이가 느릿하게 피어오른다
      p.flame = p.flame || [];
      if (imm) {
        // 영겁의 화마: 화면 아래에서 불구름이 굽이치며 치솟고, 그 위로 검은 연기가 피어오른다(Kenney 텍스처)
        const ia = fade * Math.min(1, Math.max(0, (T0 - 2.95) / 0.5));
        p.hell = p.hell || []; p.ash = p.ash || [];
        if (Math.random() < 0.8 * qPart()) p.hell.push({ x: Math.random() * (W + 200) - 100, y: H + 90, vx: (Math.random() - 0.5) * 30, vy: -(90 + Math.random() * 140), l: 0, m: 1.1 + Math.random() * 0.9, r: 110 + Math.random() * 120, a: Math.random() * 6, sp: (Math.random() - 0.5) * 1.2, f: (Math.random() * 9) | 0 });
        if (Math.random() < 0.7 * qPart()) p.ash.push({ x: Math.random() * W, y: H * 0.62 + Math.random() * 80, vx: (Math.random() - 0.5) * 20, vy: -(40 + Math.random() * 50), l: 0, m: 3 + Math.random() * 2, r: 150 + Math.random() * 120, a: Math.random() * 6, f: [0, 4, 8, 12, 16, 20][(Math.random() * 6) | 0] });
        c.globalCompositeOperation = 'source-over';
        for (let i = p.ash.length - 1; i >= 0; i--) {
          const q = p.ash[i]; q.l += 1 / 60; q.x += q.vx / 60; q.y += q.vy / 60;
          const k = q.l / q.m;
          if (k >= 1) { p.ash.splice(i, 1); continue; }
          const tex = kn('bsm' + q.f, '40,14,8');
          if (!tex) continue;
          const rr = q.r * (0.7 + k * 0.9);
          c.save(); c.translate(q.x, q.y); c.rotate(q.a + q.l * 0.12); c.globalAlpha = ia * Math.sin(k * Math.PI) * 0.55; c.drawImage(tex, -rr, -rr, rr * 2, rr * 2); c.restore();
        }
        c.globalCompositeOperation = 'lighter';
        for (let i = p.hell.length - 1; i >= 0; i--) {
          const q = p.hell[i]; q.l += 1 / 60; q.x += (q.vx + Math.sin(q.l * 3 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 30) / 60; q.y += q.vy / 60;
          const k = q.l / q.m;
          if (k >= 1) { p.hell.splice(i, 1); continue; }
          const tex = kn('exp' + q.f, k < 0.3 ? '255,200,120' : k < 0.65 ? '255,110,40' : '170,30,10');
          if (!tex) continue;
          const rr = q.r * (0.6 + k * 0.8);
          c.save(); c.translate(q.x, q.y); c.rotate(q.a + q.sp * q.l); c.globalAlpha = ia * (1 - k) * Math.min(1, k * 5) * 0.32; c.drawImage(tex, -rr, -rr, rr * 2, rr * 2); c.restore();
        }
        // 화면 테두리가 맥동하는 붉은 열기
        const hv = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
        hv.addColorStop(0, 'rgba(0,0,0,0)'); hv.addColorStop(1, `rgba(255,60,10,${0.22 + Math.sin(t * 3) * 0.06})`);
        c.globalAlpha = ia; c.fillStyle = hv; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
        for (let i = 0, n = Math.ceil(16 * qPart()); i < n; i++) p.flame.push({ x: rx + (Math.random() - 0.5) * 380, y: ry + 30 + Math.random() * 70, vx: (Math.random() - 0.5) * 40, vy: -(220 + Math.random() * 360), l: 0, m: 0.45 + Math.random() * 0.8, r: 16 + Math.random() * 42 });
        for (let i = p.flame.length - 1; i >= 0; i--) {
          const q = p.flame[i]; q.l += 1 / 60;
          q.x += (q.vx + Math.sin(q.l * 9 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 70) / 60; q.y += q.vy / 60;
          const k = q.l / q.m;
          if (k >= 1) { p.flame.splice(i, 1); continue; }
          const col = k < 0.25 ? C.core : k < 0.6 ? C.mid : C.out, rr = q.r * (1 - k * 0.6), fa2 = fade * (1 - k) * Math.min(1, k * 8);
          c.globalAlpha = fa2 * 0.3; c.drawImage(softGlow(col), q.x - rr, q.y - rr * 1.9, rr * 2, rr * 3.8);
          // 불꽃 혀(Kenney 텍스처): 위로 날름거리며 타오른다
          const tongue = kn((q.alt == null ? (q.alt = Math.random() < 0.5) : q.alt) ? 'flame_05' : 'flame_06', k < 0.3 ? '255,220,140' : '255,110,30');
          if (tongue) { c.globalAlpha = fa2 * 0.65; c.drawImage(tongue, q.x - rr * 0.9, q.y - rr * 3, rr * 1.8, rr * 3.4); }
        }
      } else {
        // 신화: 향 연기처럼 가는 연기 줄기와 옅은 연기 뭉치가 솔솔 피어오른다(빛이 아니라 연기라 더하기 합성을 쓰지 않는다)
        c.globalCompositeOperation = 'source-over';
        const sa = fade * Math.min(1, Math.max(0, (T0 - 2.95) / 0.8));
        // 연기 갈래(Kenney 텍스처): 글자 아래에서 휘감기며 천천히 솔솔 올라가 퍼진다
        p.smoke = p.smoke || [];
        if (Math.random() < 0.45 * qPart()) p.smoke.push({ x: rx + (Math.random() - 0.5) * 360, y: ry + 80 + Math.random() * 30, vx: (Math.random() - 0.5) * 12, vy: -(28 + Math.random() * 30), l: 0, m: 3.2 + Math.random() * 2, r: 70 + Math.random() * 60, a: (Math.random() - 0.5) * 0.6, sp: (Math.random() - 0.5) * 0.25, tex: 'flame_0' + (1 + ((Math.random() * 4) | 0)), fl: Math.random() < 0.5 });
        for (let i = p.smoke.length - 1; i >= 0; i--) {
          const q = p.smoke[i]; q.l += 1 / 60; q.x += (q.vx + Math.sin(q.l * 0.8 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 10) / 60; q.y += q.vy / 60;
          const k = q.l / q.m;
          if (k >= 1) { p.smoke.splice(i, 1); continue; }
          const wisp = kn(q.tex, k < 0.4 ? '235,225,255' : '185,160,235') || smokePuff();
          const rr = q.r * (0.8 + k * 0.9);
          c.save(); c.translate(q.x, q.y); c.rotate(q.a + q.sp * q.l); if (q.fl) c.scale(-1, 1);
          c.globalAlpha = sa * Math.sin(k * Math.PI) * 0.5;
          c.drawImage(wisp, -rr, -rr * 1.3, rr * 2, rr * 2.6); c.restore();
        }
        c.globalCompositeOperation = 'lighter';
      }
      c.globalCompositeOperation = 'source-over';
      // 4) 그림이 빛과 함께 들어온다
      if (T0 > 3.2) {
        const k = ease((T0 - 3.2) / 0.45), il = illust(d);
        if (il) {
          // 화면 높이보다 조금 크게, 천천히 다가오는 느낌으로
          const ih = (H + 60) * (1.08 - 0.08 * k) * (1 + Math.min(0.04, (T0 - 3.6) * 0.008)), iw = ih * il.width / il.height;
          c.globalAlpha = fade * k; c.drawImage(il, hx - iw / 2 + (1 - k) * 140, H / 2 - ih / 2 + 10, iw, ih);
          // 일러스트 위로 다시 빛을 얹어 등급 색과 섞는다
          c.globalCompositeOperation = 'lighter'; c.globalAlpha = fade * k * (0.25 + Math.sin(t * 3) * 0.06);
          c.drawImage(softGlow(C.mid), hx - iw * 0.6, H * 0.15, iw * 1.2, H * 0.9);
          c.globalCompositeOperation = 'source-over';
        } else {
          const sz = 780 * (0.7 + 0.3 * k);
          c.globalAlpha = fade * k; Art.drawSprite(c, Art.unitSprite(d), hx + (1 - k) * 160, hy + 150 + Math.sin(t * 2) * 6, sz);
        }
      }
      // 5) 등급 글자: 굵은 붓글씨 한자(不滅·神話)가 박히고 아래에 한글
      const rk = ease((T0 - 2.95) / 0.22), rs = 2.4 - 1.4 * rk;
      if (rk >= 1) slamOnce(p, 'rank', true);
      const hzRank = imm ? '不滅' : '神話';
      if (imm) {
        c.save(); c.translate(rx, ry - 14); c.scale(rs, rs); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = `400 210px "Yuji Boku", ${HZ_FONT}`;
        const ink = c.createLinearGradient(0, -110, 0, 100);
        ink.addColorStop(0, '#fff3c8'); ink.addColorStop(0.35, '#ffb040'); ink.addColorStop(0.7, '#e2361a'); ink.addColorStop(1, '#6a0c00');
        c.globalAlpha = fade * rk; c.lineJoin = 'round';
        // 먹 번짐 같은 어두운 테두리 → 불빛 → 붓글씨
        c.shadowColor = 'rgba(255,90,30,.9)'; c.shadowBlur = 40 + Math.sin(t * 7) * 12;
        c.lineWidth = 12; c.strokeStyle = 'rgba(30,4,0,.92)'; c.strokeText(hzRank, 0, 0);
        c.shadowBlur = 0; c.fillStyle = ink; c.fillText(hzRank, 0, 0);
        // 주기적으로 훑는 광택
        const sh = ((t * 0.5) % 1.6) - 0.3, shine = c.createLinearGradient(-240, -110, 240, 110);
        shine.addColorStop(0, 'rgba(255,255,255,0)'); shine.addColorStop(Math.max(0, Math.min(1, sh - 0.07)), 'rgba(255,255,255,0)');
        shine.addColorStop(Math.max(0, Math.min(1, sh)), 'rgba(255,255,255,.7)'); shine.addColorStop(Math.max(0, Math.min(1, sh + 0.07)), 'rgba(255,255,255,0)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = fade * rk * 0.6; c.fillStyle = shine; c.fillText(hzRank, 0, 0);
        c.globalCompositeOperation = 'source-over';
        c.restore();
      } else {
        // 신화: 글자는 고정. 은빛·보랏빛 먹으로 차분하게, 불멸보다 빛을 덜 쓴다.
        c.save(); c.translate(rx, ry - 14); c.scale(rs, rs); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = `400 210px "Yuji Boku", ${HZ_FONT}`; c.lineJoin = 'round';
        const ink = c.createLinearGradient(0, -110, 0, 100);
        ink.addColorStop(0, '#ffffff'); ink.addColorStop(0.4, '#e6d6ff'); ink.addColorStop(0.75, '#9a70ff'); ink.addColorStop(1, '#3a1a7a');
        c.globalAlpha = fade * rk;
        c.shadowColor = 'rgba(180,140,255,.7)'; c.shadowBlur = 22;
        c.lineWidth = 10; c.strokeStyle = 'rgba(14,4,32,.88)'; c.strokeText(hzRank, 0, 0);
        c.shadowBlur = 0; c.fillStyle = ink; c.fillText(hzRank, 0, 0);
        c.restore();
      }
      // 한글 부제: 양옆 선과 함께
      const kr = Math.min(1, Math.max(0, (T0 - 3.2) * 3));
      if (kr > 0 && I.lang !== 'ja') { // 일본어는 위의 큰 한자(神話·不滅)와 같은 글자라 생략
        c.save(); c.translate(rx, ry + 112); c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = fade * kr;
        c.font = '700 50px "Gowun Batang", serif'; const label = rank.split('').join('  ');
        c.shadowColor = '#000'; c.shadowBlur = 8; c.fillStyle = C.soft; c.fillText(label, 0, 0); c.shadowBlur = 0;
        const lw = c.measureText(label).width / 2 + 18;
        c.strokeStyle = C.hex; c.lineWidth = 2; c.beginPath(); c.moveTo(-lw - 90 * kr, 0); c.lineTo(-lw, 0); c.moveTo(lw, 0); c.lineTo(lw + 90 * kr, 0); c.stroke();
        c.restore();
      }
      // 6) 한자 이름, 한글 이름이 차례로 박힌다
      const hz = d.hz || d.mark;
      const k1 = ease((T0 - 3.75) / 0.18);
      if (T0 > 3.75) {
        if (k1 >= 1) slamOnce(p, 'hz', false);
        const s1 = 1.8 - 0.8 * k1;
        c.save(); c.translate(rx, ry + 205); c.scale(s1, s1); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.globalAlpha = fade * k1; c.shadowColor = C.hex; c.shadowBlur = 24; c.fillStyle = '#fff3dc'; c.font = `900 104px ${HZ_FONT}`; c.fillText(hz, 0, 0);
        c.restore();
      }
      const k2 = ease((T0 - 4.2) / 0.18);
      if (T0 > 4.2) {
        // 일본어는 한자 이름이 곧 이름이라 아래에 한 번 더 쓰지 않는다
        const dup = I.lang === 'ja' || d.name === hz;
        if (k2 >= 1 && !dup) slamOnce(p, 'ko', true);
        const s2 = 1.9 - 0.9 * k2;
        if (!dup) {
        c.save(); c.translate(rx, ry + 308); c.scale(s2, s2); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.globalAlpha = fade * k2; c.shadowColor = '#000'; c.shadowBlur = 12; c.fillStyle = C.soft; c.font = '400 76px "Black Han Sans", sans-serif'; c.fillText(d.name, 0, 0);
        c.restore();
        }
        const k3 = Math.min(1, (T0 - 4.45) * 3);
        if (k3 > 0) {
          c.globalAlpha = fade * k3; c.textAlign = 'center'; c.fillStyle = '#d8c8a8'; c.font = '700 26px "Gowun Batang", serif';
          c.fillText(`${d.title || ''}${p.who ? '  ·  ' + I.t('whoseGeneral', { w: p.who }) : ''}`, rx, ry + (dup ? 300 : 378));
        }
      }
    }
    // 섬광은 맨 위에 덮는다
    if (T0 >= 2.95 && T0 < 3.5) { c.globalAlpha = fade * Math.pow(1 - (T0 - 2.95) / 0.55, 2); c.fillStyle = '#fff'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); }
    c.globalAlpha = 1; c.shadowBlur = 0; c.restore();
  }
  function drawVictory(c, p, t) {
    const e = p.vic, b = e.boss, a = Math.min(1, p.t * 4) * Math.min(1, (p.dur - p.t) * 3), cx = W / 2 - 16;
    const rows = p.rows.slice(0, 5), y0 = 120;
    popBand(c, y0, 640 + rows.length * 40, a);
    c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeStyle = b.fx; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 420, y0 + 192); c.lineTo(cx + 420, y0 + 192); c.stroke();
    c.shadowColor = '#ffb347'; c.shadowBlur = 30 + Math.sin(t * 6) * 10; c.fillStyle = '#ffe2a8';
    const s = 1 + Math.max(0, 0.4 - p.t) * 1.5;
    c.font = `400 ${Math.round(130 * s)}px "East Sea Dokdo", "Black Han Sans", serif`; c.fillText(I.t('bossDown'), cx, y0 + 90); c.shadowBlur = 0;
    c.fillStyle = '#fff'; c.font = '400 38px "Black Han Sans", sans-serif'; c.fillText(`${b.title} · ${b.name}`, cx, y0 + 162);
    c.font = '700 24px "IBM Plex Sans KR", sans-serif'; c.fillStyle = '#d8c8a8'; c.fillText(I.t('timeTaken', { t: clock(e.time) }) + (e.fast ? '  ·  ' : ''), cx - (e.fast ? 90 : 0), y0 + 226);
    if (e.fast) { c.fillStyle = '#ffd86a'; c.fillText(I.t('fastBonus'), cx + 110, y0 + 226); }
    c.fillStyle = '#e6c578'; c.font = '700 22px "Gowun Batang", serif'; c.fillText(I.t('rewardsGot'), cx, y0 + 272);
    c.fillStyle = '#fff'; c.font = '700 26px "IBM Plex Sans KR", sans-serif'; c.fillText(rwText(e.reward), cx, y0 + 308);
    // 피해 순위: 순위 · 이름 · 피해량 · 비율 막대
    if (rows.length) {
      const sum = p.rows.reduce((q, r) => q + r.v, 0) || 1, top = rows[0].v || 1, bx = cx - 330, bw = 660;
      c.fillStyle = '#e6c578'; c.font = '700 22px "Gowun Batang", serif'; c.fillText(I.t('dmgRank'), cx, y0 + 360);
      rows.forEach((r, i) => {
        const y = y0 + 392 + i * 40, pctv = r.v / sum;
        c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(bx, y, bw, 32);
        c.fillStyle = i === 0 ? 'rgba(255,200,90,.55)' : r.me ? 'rgba(125,255,142,.4)' : 'rgba(255,190,90,.3)'; c.fillRect(bx, y, bw * (r.v / top), 32);
        c.textAlign = 'left'; c.fillStyle = i === 0 ? '#ffd86a' : '#fff'; c.font = '400 22px "Black Han Sans", sans-serif'; c.fillText(`${i + 1}`, bx + 12, y + 17);
        c.font = '700 19px "IBM Plex Sans KR", sans-serif'; c.fillText(r.name + (r.me ? I.t('meTag') : ''), bx + 44, y + 17);
        c.textAlign = 'right'; c.fillText(`${fmt(r.v)}  ·  ${Math.round(pctv * 100)}%`, bx + bw - 12, y + 17);
      });
      c.textAlign = 'center';
    }
    c.globalAlpha = 1;
  }
  function drawPop(c, t, dt) {
    if (!S.pop && popQ.length) {
      S.pop = popQ.shift();
      const tier = S.pop.def ? S.pop.def.tier : 0;
      if (tier >= 9) Snd.play('legend'); else if (tier === 8) Snd.play('craft');
      else if (tier && tier <= 5) Snd.play('combine');
    }
    const p = S.pop;
    if (!p) return;
    p.t += dt; p.shake = Math.max(0, p.shake - dt * 3);
    if (p.t >= p.dur) { S.pop = null; return; }
    if (p.vic) return drawVictory(c, p, t);
    const d = p.def, col = tierColor(d.tier), a = Math.min(1, p.t * 5) * Math.min(1, (p.dur - p.t) * 3);
    if (d.tier >= 9) return drawCutscene(c, p, t);
    c.save();
    if (p.shake > 0) c.translate((Math.random() - 0.5) * 22 * p.shake, (Math.random() - 0.5) * 22 * p.shake);
    if (d.tier <= 5) {
      popBand(c, 150, 200, a);
      for (let i = 0; i < d.tier; i++) { c.globalAlpha = a; c.fillStyle = col; star(c, W / 2 + (i - (d.tier - 1) / 2) * 62, 220, 25); c.fill(); }
      c.globalAlpha = 1; popName(c, p, 292, 46, a);
    } else if (d.tier === 6) {
      popBand(c, 150, 340, a);
      for (let i = 0; i < 6; i++) slamStar(c, p, i, W / 2 + (i - 2.5) * 96, 260, 40, col, 0.1 + i * 0.2);
      popName(c, p, 390, 62, Math.min(1, Math.max(0, (p.t - 1.4) * 4)) * a);
    } else if (d.tier === 7) {
      popBand(c, 90, 420, a);
      [-310, -215, -120, 120, 215, 310].forEach((o, i) => slamStar(c, p, i, W / 2 + o, 290, 40, col, 0.1 + i * 0.2));
      const fall = Math.min(1, Math.max(0, (p.t - 1.5) / 0.3));
      if (fall > 0) {
        const y = -160 + (225 + 160) * fall * fall;
        if (fall >= 1 && !p.hits.big) { p.hits.big = 1; p.shake = 1.2; Snd.play('bigslam', 20); }
        c.globalAlpha = a; c.fillStyle = '#fff'; c.shadowColor = col; c.shadowBlur = 40; star(c, W / 2, y, 86); c.fill(); c.fillStyle = col; star(c, W / 2, y, 76); c.fill(); c.shadowBlur = 0; c.globalAlpha = 1;
      }
      popName(c, p, 420, 66, Math.min(1, Math.max(0, (p.t - 1.9) * 4)) * a);
    } else {
      popBand(c, 150, 360, a);
      const sweep = (p.t * 1.1) % 1.6 - 0.3, gr = c.createLinearGradient(W / 2 - 320, 0, W / 2 + 320, 0);
      gr.addColorStop(0, '#d98a1e'); gr.addColorStop(Math.max(0, Math.min(1, sweep)), '#fff6c8'); gr.addColorStop(1, '#ffb347');
      c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#ffb347'; c.shadowBlur = 34 + Math.sin(t * 7) * 14; c.fillStyle = gr;
      c.font = '400 150px "East Sea Dokdo", "Black Han Sans", serif'; c.fillText(d.name, W / 2, 300);
      c.shadowBlur = 0; c.fillStyle = '#ffe2a8'; c.font = '700 32px "Gowun Batang", serif'; c.fillText((p.who ? I.t('whose', { w: p.who }) : '') + I.t('legendAppear', { title: d.title ? '· ' + d.title + ' ' : '' }), W / 2, 410);
      c.globalAlpha = 1;
    }
    c.restore();
  }
  function drawBanner() {
    const b = S.banner, c = ctx;
    if (!b) return;
    b.t -= S.fdt;
    if (b.t <= 0) { S.banner = null; return; }
    c.globalAlpha = Math.min(1, b.t * 2); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(15,10,8,.7)'; c.fillRect(W / 2 - 300, 170, 600, 86);
    c.fillStyle = '#ffd86a'; c.font = '400 40px "Black Han Sans", sans-serif'; c.fillText(b.text, W / 2, 200);
    c.fillStyle = '#e8dcc0'; c.font = '400 20px "Gowun Batang", serif'; c.fillText(b.sub || '', W / 2, 236);
    c.globalAlpha = 1;
  }
  function render(now) {
    const t = now / 1000;
    // 프레임 간격: 화면 주사율(60·120Hz)이나 렉과 상관없이 연출 속도가 같도록 모든 감쇠·타이머가 이 값을 쓴다
    const dt = Math.min(0.1, Math.max(0.001, (now - (S.lastNow || now - 16)) / 1000)); S.lastNow = now;
    S.fdt = dt; S.f60 = dt * 60;
    S.auraPrev = S.auraN || 0; S.auraN = 0;
    S.shake = Math.max(0, (S.shake || 0) - 0.06 * S.f60);
    const sx = (Math.random() - 0.5) * 14 * (S.shake || 0) * S.scale, sy = (Math.random() - 0.5) * 14 * (S.shake || 0) * S.scale;
    const ph = g.phase + (S.laneView ? 'L' : '') + (viewedPeer() ? 'V' : '');
    if (S.camPh !== ph) { S.camPh = ph; resetCam(); }
    if (inBoss() && performance.now() > (S.camHold || 0) && S.cam.z > 1.01) { const ac = g.active(); if (ac) { const ck = 1 - Math.pow(0.9, S.f60); S.cam.x += (ac.x - S.cam.x) * ck; S.cam.y += (ac.y - S.cam.y) * ck; } }
    applyCam();
    ctx.setTransform(S.scale, 0, 0, S.scale, S.ox + sx, S.oy + sy);
    // 강타 카메라 펀치: 보스 쪽으로 순간 확대했다 돌아온다
    if (S.punch > 0.02 && g.fight && g.phase === 'boss') { const p = 1 + S.punch * 0.035, fx = g.fight.boss.x, fy = g.fight.boss.y; ctx.translate(fx, fy); ctx.scale(p, p); ctx.translate(-fx, -fy); S.punch *= Math.pow(0.82, S.f60); } else S.punch = 0;
    const watching = viewedPeer();
    if (net) net.setWatch(watching ? watching.id : null);
    if (g.fight && g.phase !== 'wave' && !laneOn()) drawArena(t); else if (watching) drawRemoteLane(t, watching); else drawLane(t);
    drawText(ctx); drawBanner();
    drawPop(ctx, t, dt);
  }
  // 화면 배율: 작은 화면(폰)은 1배 그대로 두고 큰 화면만 키운다. 맵은 카메라로 따로 확대한다.
  let zoom = 1;
  S.coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  function applyZoom() {
    const w = window.innerWidth, h = window.innerHeight;
    zoom = Math.max(1, Math.min(w / 1280, h / 720, 2.2));
    $('app').style.zoom = zoom; $('title').style.zoom = 1; // 메인 로비는 화면 크기에 맞춰 스스로 배치한다
  }
  // 카메라: z 1 = 맵 전체가 보이는 배율. 터치 기기는 화면을 꽉 채우는 배율에서 시작한다.
  S.cam = { z: 1, x: W / 2, y: H / 2 };
  // 터치 기기: 라인 길(또는 결투장)이 화면에 꽉 차게 맞춘다. 바깥 여백(업적 깃발 등)은 손가락으로 끌어서 본다.
  function resetCam() {
    const B = S.base, r = g && g.phase !== 'wave' && g.fight && !S.laneView ? ARENA : ROAD, pad = 24;
    // 터치 기기도 맵 전체가 보이는 배율(가장 축소한 화면)로 고정한다. 손가락 확대·축소는 막았다(10-input).
    S.cam = { z: 1, x: W / 2, y: H / 2 };
    applyCam();
  }
  function applyCam() {
    const B = S.base;
    if (!B) return;
    const c = S.cam;
    c.z = S.coarse ? 1 : Math.max(1, Math.min(3.2, c.z));
    const s = B.s0 * c.z, vw = B.sw / s, vh = B.sh / s;
    c.x = vw >= W ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, c.x));
    c.y = vh >= H ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, c.y));
    S.scale = s * B.dpr; S.ox = (B.sw / 2 - c.x * s) * B.dpr; S.oy = (B.sh / 2 - c.y * s) * B.dpr;
  }
  function fit() {
    const st = $('stage'), sw = st.clientWidth, sh = st.clientHeight, dpr = Math.min((window.devicePixelRatio || 1) * zoom, qDpr(), Math.sqrt(qPix() / Math.max(1, sw * sh))) * Q.rs;
    view.style.width = sw + 'px'; view.style.height = sh + 'px';
    view.width = Math.round(sw * dpr); view.height = Math.round(sh * dpr);
    const first = !S.base;
    S.base = { sw, sh, dpr, s0: Math.min(sw / W, sh / H) };
    if (first) resetCam(); else applyCam();
  }
  window.addEventListener('resize', () => { applyZoom(); if (g) fit(); });
  applyZoom();

  // ---- 입력 ----
  const toWorld = (e) => { const r = view.getBoundingClientRect(); return { x: (((e.clientX - r.left) / r.width) * view.width - S.ox) / S.scale, y: (((e.clientY - r.top) / r.height) * view.height - S.oy) / S.scale }; };
  const unitAt = (x, y) => { let best = null, bd = S.coarse ? 52 : 38; g.units.forEach((u) => { if (u.owner !== 0) return; const d = dist(u.x, u.y, x, y); if (d < bd) { bd = d; best = u; } }); return best; };
  // 겹쳐 있으면 위에 그려진(나중에 생긴) 것을 집는다
  const dropAt = (x, y) => g.drops.slice().reverse().find((d) => d.owner === 0 && Math.abs(d.x - x) < 24 && Math.abs(d.y - y) < 22);
  const enemyAt = (x, y) => g.enemies.find((e) => dist(e.x, e.y, x, y) < e.r + 12);
  // 보스전 중에도 Tab으로 내 라인 화면에 와서 선택권·조합·강화를 할 수 있다. 그동안 결투 시간은 그대로 흐른다.
  const inBoss = () => g && g.phase === 'boss' && !S.laneView;
  const laneOn = () => g && (g.phase === 'wave' || (g.phase === 'boss' && !!S.laneView));
  view.addEventListener('contextmenu', (e) => e.preventDefault());
  // 게임 중에는 화면 어디서든(패널·버튼·스킬 막대·팝업) 브라우저 우클릭 메뉴를 막는다. 글자 입력칸은 그대로 둔다.
  window.addEventListener('contextmenu', (e) => { if (g && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); });
  // ---- 카메라: 손가락·휠로 확대하고 끌어서 움직인다 ----
  const zoomAt = (cx, cy, nz) => {
    const before = toWorld({ clientX: cx, clientY: cy });
    S.cam.z = nz; applyCam();
    const after = toWorld({ clientX: cx, clientY: cy });
    S.cam.x += before.x - after.x; S.cam.y += before.y - after.y; applyCam();
    S.camHold = performance.now() + 2500;
  };
  const panBy = (sx, sy, dx, dy) => { const k = S.base.s0 * S.cam.z; S.cam.x = sx - dx / k; S.cam.y = sy - dy / k; applyCam(); S.camHold = performance.now() + 2500; };
  // 터치 기기는 확대·축소를 막는다(가장 축소한 화면으로 고정). 마우스 휠 확대는 PC에서만.
  view.addEventListener('wheel', (e) => { if (!g) return; e.preventDefault(); if (S.coarse) return; zoomAt(e.clientX, e.clientY, S.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  const ptrs = new Map();
  let pinch = null, touch = null;
  const cancelTouch = () => { if (touch && touch.lp) clearTimeout(touch.lp); touch = null; };
  // 터치 한 번(움직이지 않고 뗌): 선택·이동·상자 열기
  function tapAt(m, e) {
    if (inBoss()) {
      const l = g.localChamps(), i = l.findIndex((c) => !c.dead && dist(c.x, c.y, m.x, m.y) < 50);
      if (i >= 0) g.selectChamp(i);
      // 터치로는 이동하지 않는다(이동은 조이스틱). 적을 톡 치면 그 적을 노리기만 한다.
      else if (g.active()) { const tg = g.foeAt(m.x, m.y); if (tg != null) g.active().tgt = tg; }
      dirty(); return;
    }
    if (!laneOn()) return;
    const vp = viewedPeer();
    if (vp) {
      let best = null, bd = 44;
      (S.remoteHits || []).forEach((h) => { const dd = dist(h.x, h.y, m.x, m.y); if (dd < bd) { bd = dd; best = h; } });
      S.rsel = best ? { peer: vp.id, id: best.id, d: best.d, atk: best.atk } : null;
      dirty(); return;
    }
    if (S.cmdMode === 'use') {
      const d = g.drops.find((x) => x.id === S.dropSel), u = unitAt(m.x, m.y);
      const n = g.useDrop(g.me, d, u);
      if (n) { setSel([n.id]); S.dropSel = null; } else toast(I.t('cantUse'), 'warn');
      setMode(null); return;
    }
    if (S.cmdMode) { rightClick(m, S.cmdMode); setMode(null); return; }
    const drop = dropAt(m.x, m.y);
    if (drop) {
      if (drop.kind === 'chest') { const out = g.openChest(g.me, drop); S.dropSel = out ? out.id : null; S.sel = []; }
      else { S.dropSel = drop.id; S.sel = []; }
      dirty(); return;
    }
    const u = unitAt(m.x, m.y);
    if (u) {
      S.dropSel = null;
      const now = performance.now();
      // 같은 유닛을 두 번 톡 치면 그 유닛 전부 선택
      if (now - S.lastClick.t < 360 && S.lastClick.id === u.def.id) setSel(g.units.filter((o) => o.owner === 0 && o.def.id === u.def.id).map((o) => o.id));
      else setSel([u.id]);
      S.lastClick = { t: now, id: u.def.id };
      return;
    }
    const f = g.phase === 'wave' ? flagAt(m) : null;
    if (f) { showFlag(f, e); return; } // 다른 곳을 누를 때까지 띄워 둔다(아래 pointerdown에서 닫는다)
    // 빈 곳: 고른 게 있으면 그리로 '공격하며 이동'(가는 길에 사거리 안의 적이 있으면 멈춰서 때린다), 없으면 아무것도 안 함
    // 터치: 유닛은 톡 쳐서 옮기지 않는다(고르면 뜨는 조이스틱으로 움직인다). 고른 상자·아이템만 빈 곳을 쳐서 옮긴다.
    if (S.dropSel && !S.sel.length) rightClick(m, 'amove');
  }
  function boxSelect(d) {
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    S.dropSel = null;
    const ids = g.units.filter((u) => u.owner === 0 && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1).map((u) => u.id);
    setSel(d.add ? [...new Set(S.sel.concat(ids))] : ids);
  }
  view.addEventListener('pointerdown', (e) => {
    if (!g) return;
    view.focus({ preventScroll: true });
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { view.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    // 두 손가락: 확대·이동
    if (ptrs.size === 2) {
      cancelTouch(); S.drag = null;
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: S.cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    const m = toWorld(e); S.mouse = m;
    // 마우스 가운데 버튼: 지도 끌기
    if (e.button === 1) { e.preventDefault(); S.pan = { x: e.clientX, y: e.clientY, cx: S.cam.x, cy: S.cam.y }; return; }
    if (e.pointerType === 'touch') {
      touch = { id: e.pointerId, x: e.clientX, y: e.clientY, m, mode: null, cx: S.cam.x, cy: S.cam.y };
      // 꾹 누르고 있으면 범위 선택으로 바뀐다
      if (laneOn() && !viewedPeer() && !S.cmdMode) touch.lp = setTimeout(() => {
        if (touch && !touch.mode) { touch.mode = 'box'; S.drag = { x0: m.x, y0: m.y, x1: m.x, y1: m.y, moved: true, add: false }; if (navigator.vibrate) navigator.vibrate(12); }
      }, 380);
      return;
    }
    // ---- 마우스(PC): 기존 조작 ----
    if (inBoss()) {
      if (e.button === 2) { const tg = g.foeAt(m.x, m.y); if (tg != null) g.arenaChase(tg); else g.arenaMove(m.x, m.y, false); }
      else if (S.cmdMode === 'amove') { g.arenaChase(); setMode(null); }
      else if (S.cmdMode === 'move') { g.arenaMove(m.x, m.y, false); setMode(null); }
      else {
        const l = g.localChamps(), i = l.findIndex((c) => !c.dead && dist(c.x, c.y, m.x, m.y) < 40);
        if (i >= 0) g.selectChamp(i); else g.selectChamp(null);
        dirty();
      }
      return;
    }
    if (!laneOn()) return;
    if (viewedPeer()) { if (e.button === 0) tapAt(m, e); return; }
    if (e.button === 2) { rightClick(m); return; }
    if (S.cmdMode) { tapAt(m, e); return; }
    S.drag = { x0: m.x, y0: m.y, x1: m.x, y1: m.y, moved: false, add: e.shiftKey };
  });
  view.addEventListener('pointermove', (e) => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (!S.coarse) zoomAt(pinch.mx, pinch.my, pinch.z * (d / pinch.d));
      const k = S.base.s0 * S.cam.z; S.cam.x -= (mx - pinch.mx) / k; S.cam.y -= (my - pinch.my) / k; applyCam();
      pinch.mx = mx; pinch.my = my; pinch.z = S.cam.z; pinch.d = d;
      return;
    }
    if (S.pan) { panBy(S.pan.cx, S.pan.cy, e.clientX - S.pan.x, e.clientY - S.pan.y); return; }
    const m = toWorld(e); S.mouse = m;
    if (touch && e.pointerId === touch.id) {
      const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
      if (touch.mode === 'box') { S.drag.x1 = m.x; S.drag.y1 = m.y; return; }
      if (!touch.mode && Math.hypot(dx, dy) > 10) { touch.mode = 'pan'; if (touch.lp) clearTimeout(touch.lp); }
      if (touch.mode === 'pan') panBy(touch.cx, touch.cy, dx, dy);
      return;
    }
    if (g && e.pointerType !== 'touch') showFlag(g.phase === 'wave' && !S.drag ? flagAt(m) : null, e);
    if (S.drag) { S.drag.x1 = m.x; S.drag.y1 = m.y; if (dist(S.drag.x0, S.drag.y0, m.x, m.y) > 10) S.drag.moved = true; }
  });
  view.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') $('achpop').hidden = true; });
  // 터치로 띄운 업적 설명은 화면 어디든 다시 누르면 닫힌다(같은 깃발이나 다른 깃발을 누르면 손을 뗄 때 다시 뜬다)
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !$('achpop').hidden) $('achpop').hidden = true; }, true);
  const endPtr = (e) => {
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) { pinch = null; cancelTouch(); } return; }
    if (S.pan) { S.pan = null; return; }
    if (!g) return;
    if (touch && e.pointerId === touch.id) {
      const t = touch; cancelTouch();
      if (t.mode === 'box') { const d = S.drag; S.drag = null; if (d) boxSelect(d); }
      else if (!t.mode) tapAt(t.m, e);
      return;
    }
    const d = S.drag; S.drag = null;
    if (!d) return;
    if (d.moved) { boxSelect(d); return; }
    const drop = dropAt(d.x0, d.y0);
    if (drop) {
      if (drop.kind === 'chest') { const out = g.openChest(g.me, drop); S.dropSel = out ? out.id : null; S.sel = []; dirty(); }
      else { S.dropSel = drop.id; S.sel = []; dirty(); }
      return;
    }
    S.dropSel = null;
    const u = unitAt(d.x0, d.y0);
    if (!u) { if (!d.add) setSel([]); return; }
    const now = performance.now();
    if ((now - S.lastClick.t < 320 && S.lastClick.id === u.def.id) || e.ctrlKey) setSel(g.units.filter((o) => o.owner === 0 && o.def.id === u.def.id).map((o) => o.id));
    else if (d.add) setSel(S.sel.includes(u.id) ? S.sel.filter((i) => i !== u.id) : S.sel.concat(u.id));
    else setSel([u.id]);
    S.lastClick = { t: now, id: u.def.id };
  };
  view.addEventListener('pointerup', endPtr);
  view.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); pinch = null; cancelTouch(); S.drag = null; S.pan = null; });
  function rightClick(m, mode) {
    // 상자·아이템을 고른 상태면 그것을 옮긴다
    const drop = !S.sel.length && S.dropSel && g.drops.find((d) => d.id === S.dropSel);
    if (drop) { g.moveDrop(g.me, drop, m.x, m.y); S.pings.push({ x: m.x, y: m.y, t: 0, c: '#7dff8e' }); return; }
    if (mode === 'amove') { g.cmd('amove', S.sel, m.x, m.y); S.pings.push({ x: m.x, y: m.y, t: 0, c: '#ff7a60' }); }
    else { g.cmd('move', S.sel, m.x, m.y); S.pings.push({ x: m.x, y: m.y, t: 0, c: '#7dff8e' }); }
  }
  function setMode(m) { S.cmdMode = m; $('stage').classList.toggle('targeting', !!m); dirty(); }
  function setSel(ids) { S.sel = ids; dirty(); }
  const selUnits = () => { S.sel = S.sel.filter((id) => g.units.some((u) => u.id === id)); return S.sel.map((id) => g.units.find((u) => u.id === id)); };
  // ---- 행동: DOM 갱신 중에도 놓치지 않게 pointerdown 위임으로 받는다 ----
  function doAct(a, arg) {
    Snd.play('click', 40);
    const p = g && g.me, list = g ? selUnits() : [], u = list[0];
    if (a === 'tab') { S.tab = arg; S.drawer = arg; }
    else if (a === 'drawer') { if (S.drawer === arg) S.drawer = null; else { S.drawer = arg; S.tab = arg; } }
    else if (a === 'drawerClose') S.drawer = null;
    else if (a === 'autoAll') { const on = !['t1', 't2', 't3'].every((k) => p.auto[k]); ['t1', 't2', 't3'].forEach((k) => g.setAuto(p, k, on)); try { localStorage.setItem('rtd-auto', on ? '1' : '0'); } catch (e) { /* 저장 불가 */ } toast(on ? t('autoToastOn') : t('autoToastOff'), on ? 'good' : ''); }
    else if (a === 'selExp') S.selExp = !S.selExp;
    else if (a === 'langSet') { if (arg !== I.lang) { try { localStorage.setItem('rtd-lang', arg); } catch (e) { /* 저장 불가 */ } toast(I.LANGS.find(([k]) => k === arg)[1] + ' — ' + t('toTitle'), 'good'); } }
    else if (a === 'gfx') { if (Q.level !== arg) { Q.level = arg; Q.rs = 1; applyQuality(); sizeMap(); if (g) fit(); } }
    else if (a === 'fps30') { Q.fps30 = !Q.fps30; applyQuality(); }
    else if (a === 'perf') { Q.perf = !Q.perf; applyQuality(); }
    else if (a === 'credits') { if (window.RTD_CREDITS) window.RTD_CREDITS.open(); }
    else if (a === 'desel') { setSel([]); S.dropSel = null; S.rsel = null; setMode(null); }
    else if (a === 'amove') { if (inBoss() || S.sel.length) setMode('amove'); }
    else if (a === 'modeMove') { if (inBoss() || S.sel.length) setMode('move'); }
    else if (a === 'stop') { if (inBoss()) g.arenaStop(); else g.cmd('focus', S.sel); setMode(null); }
    else if (a === 'esc') setMode(null);
    else if (a === 'combine') { if (u) { const n = g.combine(p, u.def.id, u.id); if (n) setSel([n.id]); } }
    else if (a === 'sell') { if (list.length === 1 && u.def.tier === 1) { const v = g.sell(p, u); toast(I.t('disbanded', { a: u.def.name, c: T.currency, v }), 'good'); } }
    else if (a === 'speed') { speed = speed === 3 ? 1 : speed + 1; if (net) net.speedWant = speed; }
    else if (a === 'myview') S.view = null;
    else if (a === 'statDet') { S.statDet = !S.statDet; const sb = $('selbar'); if (sb && S.statDet) sb.classList.add('exp'); }
    else if (a === 'viewPeer') { S.view = arg === 'me' || S.view === arg ? null : arg; setSel([]); S.dropSel = null; }
    else if (a === 'laneView') { if (g.phase === 'boss') { S.laneView = !S.laneView; S.cmdMode = null; S.drag = null; } }
    else if (a === 'auto') g.setAuto(p, arg, !p.auto[arg]);
    else if (a === 'zone') { const [k, z] = arg.split(':'); g.setZone(p, k, z); }
    else if (a === 'vol') {
      const key = arg, cur = Snd.state[key], next = cur >= 0.99 ? 0 : Math.round((cur + 0.25) * 4) / 4 >= 1 ? 1 : Math.round((Math.floor(cur * 4 + 0.001) + 1) * 25) / 100;
      if (key === 'sfx') Snd.setSfx(next); else Snd.setBgm(next);
    }
    else if (a === 'book') S.book = S.book === arg ? null : arg;
    else if (a === 'timer') { const el = document.querySelector(`.tw[data-r="${arg}"]`); if (el) el.classList.toggle('open'); }
    else if (a === 'useDrop') { if (S.dropSel && g.drops.some((d) => d.id === S.dropSel && d.kind !== 'item')) setMode('use'); }
    else if (a === 'up') g.buyUpgrade(p, arg);
    else if (a === 'craft') { const n = g.craft(p, arg); if (n) setSel([n.id]); }
    else if (a === 'hire') g.hire(p, arg);
    else if (a === 'fuse') { const n = g.fuseItems(p, S.dropSel); if (n) S.dropSel = n.id; }
    else if (a === 'dismiss') { if (S.dismiss === arg) { g.dismiss(p, arg); S.dismiss = null; } else { S.dismiss = arg; toast(I.t('dismissConfirm', { a: defOf[arg].name }), 'warn'); setTimeout(() => { if (S.dismiss === arg) S.dismiss = null; }, 3000); } }
    else if (a === 'ticket') { S.ticket = +arg; S.drawer = 'ticket'; S.tab = 'ticket'; }
    else if (a === 'ticketPick') { g.useTicket(p, S.ticket, arg); if (!(p.tickets[S.ticket] > 0)) S.ticket = null; }
    else if (a === 'ticketClose') S.ticket = null;
    else if (a === 'selDef') setSel(list.filter((x) => x.def.id === arg).map((x) => x.id));
    else if (a === 'pick') { const id = +arg, i = S.pick.indexOf(id); if (i >= 0) S.pick.splice(i, 1); else { S.pick.push(id); if (S.pick.length > g.slotCount()) S.pick.shift(); } }
    else if (a === 'pickGo') { g.confirmPick(S.pick); S.pick = []; }
    else if (a === 'sub') g.replaceChamp(+arg);
    else if (a === 'skill') { const c = g.active(); if (c) g.useSkill(c, +arg, S.mouse.x, S.mouse.y); }
    // 스킬 막대를 눌러 쓸 때는 마우스가 막대 위에 있으므로 보스를 겨눈다
    else if (a === 'skillBar') { const c = g.active(), b = g.fight && g.fight.boss; if (c && b) g.useSkill(c, +arg, b.x, b.y); }
    else if (a === 'heal') g.useHeal();
    else if (a === 'dash') { g.dash(g.active(), S.mouse.x, S.mouse.y); }
    else if (a === 'champ') g.selectChamp(+arg);
    else if (a === 'restart') adThen(() => location.reload());
    else if (a === 'resume') { S.paused = false; last = performance.now(); }
    else if (a === 'volunteer') { if (net && net.volunteer) net.volunteer(); }
    else if (a === 'tutReset') { if (window.RTD_TUT) window.RTD_TUT.reset(); toast(I.t('tutReplayHint'), 'good'); }
    else if (a === 'lang') { I.setLang(arg); }
    dirty();
  }
  // 터치로 서랍(전황·인연 시너지 등) 안을 누르면 바로 실행하지 않고, 손가락을 거의 움직이지 않고 뗐을 때만 실행한다.
  // 누르자마자 실행하면 목록을 스크롤하려는 손가락이 타이머 줄을 펼쳤다 접었다 해서 스크롤이 안 된다.
  let tapPend = null;
  // 결과창 난이도 칸(악몽 +N): 꾹 누르면 변형 규칙 팝업, 다른 곳을 누르면 닫힌다
  let mutLp = null;
  document.addEventListener('pointerdown', (e) => {
    const pop = document.querySelector('#end .es-mutpop');
    if (!pop) return;
    if (!e.target.closest('.es-mutpop')) pop.hidden = true;
    const cell = e.target.closest('.es-diff.has-mut');
    if (cell) { clearTimeout(mutLp); mutLp = setTimeout(() => { pop.hidden = false; if (navigator.vibrate) navigator.vibrate(12); }, 450); }
  });
  ['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => clearTimeout(mutLp)));
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (e.pointerType === 'touch' && b.closest('#drawer')) { tapPend = { b, id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
    e.preventDefault();
    doAct(b.dataset.act, b.dataset.arg);
    if (g) view.focus({ preventScroll: true });
  });
  document.addEventListener('pointerup', (e) => {
    const p = tapPend; tapPend = null;
    if (!p || p.id !== e.pointerId || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10 || p.b.disabled || !p.b.isConnected) return;
    doAct(p.b.dataset.act, p.b.dataset.arg);
  });
  document.addEventListener('pointercancel', () => { tapPend = null; }); // 스크롤이 시작되면 브라우저가 취소를 보낸다

  // ---- 패널 ----
  let needs = true, lastDom = 0;
  const dirty = () => (needs = true);
  const toast = (text, tone) => {
    const box = $('toasts');
    // 같은 알림이 연달아 오면 줄을 쌓지 않고 ×N으로 합친다(전선 포화로 라이프가 연속으로 깎일 때 화면을 덮던 문제)
    const prev = box.lastElementChild;
    if (prev && prev._text === text) {
      prev._n = (prev._n || 1) + 1; prev.textContent = `${text} ×${prev._n}`;
      clearTimeout(prev._tm); prev._tm = setTimeout(() => prev.remove(), 3600);
      return;
    }
    const d = document.createElement('div'); d.className = 'toast ' + (tone || ''); d.textContent = text; d._text = text;
    box.appendChild(d);
    d._tm = setTimeout(() => d.remove(), 3600);
    while (box.children.length > 4) box.firstChild.remove();
    return;
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => d.remove(), 3600);
  };
  function clock(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`; }
  function nextBoss() { return T.bosses.find((b) => b.round >= g.round && b.round <= g.diff.rounds); }
  function nextMid() { return T.midbosses.find((m) => m.round > g.round); }
  function recipeRow(id) {
    const st = g.recipeStatus(g.me, id), d = defOf[id];
    const chips = st.parts.map((x) => `<span class="chip ${x.have >= x.need ? 'have' : 'miss'}">${esc(defOf[x.id].name)} ${rankTag(defOf[x.id].tier)} ${Math.min(x.have, x.need)}/${x.need}</span>`).join('');
    const it = st.item ? `<span class="chip ${st.hasItem ? 'have' : 'miss'}">${esc(T.items.find((i) => i.id === st.item).name)}</span>` : '';
    return `<div class="row ${st.ok ? 'ok' : ''}"><div><strong style="color:${tierColor(d.tier)}">${esc(d.name)}</strong> ${rankBadge(d.tier)}<div class="chips">${chips}${it}</div></div><button class="btn ${st.ok ? 'go' : ''}" data-act="craft" data-arg="${id}" type="button" ${st.ok ? '' : 'disabled'}>${I.t('combineBtn')}</button></div>`;
  }
  const SKILL_TEXT = {
    line: (s) => `직선 ${s.len} 범위, 공격력 ${s.mult}배`, cone: (s) => `부채꼴 ${s.r} 범위, 공격력 ${s.mult}배`,
    circle: (s) => `지정 위치 반경 ${s.r}, 공격력 ${s.mult}배${s.stun ? `, 기절 ${s.stun}초` : ''}`,
    buff: (s) => `${s.dur}초간 공격력 +${Math.round(s.atk * 100)}%`, shield: (s) => `${s.dur}초간 무적`, heal: (s) => `아군 전체(다른 사령관 포함) 체력 ${Math.round(s.pct * 100)}% 회복${s.hot ? `, ${s.hotDur}초간 매초 ${Math.round(s.hot * 100)}% 더` : ''}`,
    rally: (s) => `${s.dur}초간 아군 전체 공격력 +${Math.round(s.atk * 100)}%`, taunt: (s) => `${s.dur}초간 보스를 끌어오고 받는 피해 감소`,
    weaken: (s) => `${s.dur}초간 보스가 받는 피해 +${Math.round(s.amp * 100)}%`,
    cover: (s) => `보스를 끌어오고 ${s.dur}초간 아군 전체(다른 사령관 포함) 받는 피해 -${Math.round(s.v * 100)}%`,
    pshield: (s) => `${s.dur}초간 아군 전체(다른 사령관 포함) 투사체를 막음`,
    hasteAll: (s) => `${s.dur}초간 아군 전체 공격 속도 +${Math.round(s.v * 100)}%`,
    roar: (s) => `${s.dur}초간 보스 공격력 -${Math.round(s.v * 100)}%`,
    delay: (s) => `보스의 다음 패턴을 ${s.v}초 늦춤`,
    reflect: (s) => `${s.dur}초간 보스를 끌어오고, 맞을 때마다 공격력 ${s.mult}배로 반격`,
    charm: (s) => `보스를 ${s.dur}초간 매혹해 멈추고 받는 피해 +${Math.round(s.amp * 100)}% (무력화 시전은 못 끊음)`,
  };
  if (I.skillText) Object.assign(SKILL_TEXT, I.skillText);
  // 도감: 줄을 누르면 능력치와 스킬, 조합식이 펼쳐진다
  function bookRow(d) {
    const open = S.book === d.id, f = T.factions[d.fac];
    const row = `<div class="row" data-act="book" data-arg="${d.id}"><img alt="" src="${Art.portrait(d)}"><div><span style="color:${f.color}">${esc(f.name)}</span> ${esc(d.name)}${d.title ? `<small>${esc(d.title)}</small>` : ''}</div></div>`;
    if (!open) return row;
    const stats = d.tier ? `${I.t('atk')} ${fmt(g.baseAtk(g.me, d))} · ${I.t('hp')} ${fmt(g.rankOf[d.tier].hp)} · ${I.t('range')} ${g.range(d)} · ${I.t('interval')} ${I.t('sec', { n: g.attackTime(d).toFixed(2) })}` : I.t('hireCost', { c: T.currency, n: fmt(d.cost) });
    const pass = (d.p || []).map((x) => `<div><span class="tag">${t('passive')}</span>${esc(x.name)}: ${esc(x.desc)}</div>`).join('');
    const sk = (d.sk || []).map((s) => `<div><span class="tag">${t('active')}</span>${esc(s.n)}: ${SKILL_TEXT[s.k](s)}, ${I.t('cooldown', { n: s.cd })}</div>`).join('');
    const need = T.combineNeed[d.tier];
    const comb = need ? `<div>${I.t('combineNeed', { b: need, r: rankName(d.tier + 1) })}</div>` : '';
    return row + `<div class="bk"><div>${stats}</div>${pass}${sk}${comb}${T.recipes[d.id] ? recipeRow(d.id) : ''}</div>`;
  }
  function renderPane() {
    const p = g.me, tick = Object.values(p.tickets).reduce((a, b) => a + b, 0);
    const tabs = [['upgrade', t('upgrade')], ['sage', t('sage')], ['ticket', t('ticket')], ['book', t('book')], ['war', t('war')], ['set', t('settings')]];
    if (!S.tab) S.tab = 'upgrade';
    $('tabs').innerHTML = tabs.map(([k, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-arg="${k}" type="button">${n}${k === 'ticket' && tick ? `<span class="dot">${tick}</span>` : ''}</button>`).join('');
    let h = '';
    if (S.tab === 'upgrade') {
      h = `<div class="h">${t('hold', { c: esc(T.currency), n: fmt(p.gold) })}</div>` + T.upgrades.map((u) => {
        const lv = p.upgrades[u.id] || 0, c = g.upgradeCost(p, u), mx = g.upMax(p, u), max = lv >= mx;
        return `<div class="row"><div>${esc(u.name)} <small>${lv}/${mx} · ${t('atkUp', { n: lv * 20 })}</small></div><button class="btn" data-act="up" data-arg="${u.id}" type="button" ${max || p.gold < c ? 'disabled' : ''}>${max ? t('max') : fmt(c)}</button></div>`;
      }).join('');
    } else if (S.tab === 'sage') {
      const hired = g.sagesOf(p).length, full = hired >= g.sageMax();
      h = `<div class="h">${t('hold', { c: esc(T.currency), n: fmt(p.gold) })}</div>`;
      h += `<div class="h">${t('sageHead')} <small>${t('sageHint', { a: hired, b: g.sageMax() })}</small></div>` + T.units.filter((d) => d.tier === 0).map((d) => {
        const has = g.has(p, d.id);
        const btn = has ? `<button class="btn warn" data-act="dismiss" data-arg="${d.id}" type="button">${t('dismiss')}</button>`
          : `<button class="btn" data-act="hire" data-arg="${d.id}" type="button" ${full || p.gold < d.cost ? 'disabled' : ''}>${full ? t('full') : fmt(d.cost)}</button>`;
        return `<div class="row sagerow ${has ? 'ok' : ''}"><img class="spor" alt="" src="${Art.portrait(d)}"><div>${esc(d.name)} <span class="bt">${esc(d.build || '')}</span> <small>${esc(d.p.map((x) => x.desc).join(' / '))}</small></div>${btn}</div>`;
      }).join('');
    } else if (S.tab === 'ticket') {
      const ts = Object.keys(p.tickets).filter((t) => p.tickets[t] > 0);
      h = ts.map((t) => `<div class="row"><div>${I.t('ticketN', { r: rankName(+t) })} <small>${I.t('nSheets', { n: p.tickets[t] })}</small></div><button class="btn go" data-act="ticket" data-arg="${t}" type="button">${I.t('use')}</button></div>`).join('');
      if (!h) h = `<div class="row"><div>${t('noTicket')} <small>${t('noTicketHint')}</small></div></div>`;
    } else if (S.tab === 'set') {
      const tg = (k, l) => `<div class="row"><div>${l}</div><button class="toggle ${p.auto[k] ? 'on' : ''}" data-act="auto" data-arg="${k}" type="button">${I.t(p.auto[k] ? 'onOff' : 'offOff')}</button></div>`;
      // 정렬 위치: 왼쪽 벽 1, 아래쪽 벽 3, 오른쪽 벽 1 중에서 고른다(겹치면 서로 맞바꿈)
      const ZN = [['L', I.t('zL')], ['B1', I.t('zB1')], ['B2', I.t('zB2')], ['B3', I.t('zB3')], ['R', I.t('zR')]];
      const zones = (k) => `<div class="zones">${ZN.map(([z, l]) => `<button class="zb ${p.zones[k] === z ? 'on' : ''}" data-act="zone" data-arg="${k}:${z}" type="button">${l}</button>`).join('')}</div>`;
      const az = (k, l) => tg(k, l) + `<div class="row zrow"><div><small>${I.t('sortPos')}</small></div>${zones(k)}</div>`;
      const ql = [['high', t('high')], ['mid', t('mid')], ['low', t('low')]];
      h = `<div class="h">${t('language')}</div><div class="row"><div class="zones">${I.LANGS.map(([k, n]) => `<button class="zb ${I.lang === k ? 'on' : ''}" data-act="langSet" data-arg="${k}" type="button">${n}</button>`).join('')}</div></div>`;
      h += `<div class="h">${t('gfx')}</div><div class="row"><div>${t('gfxRow')} <small>${t('gfxHint')}</small></div><div class="zones">${ql.map(([k, l]) => `<button class="zb ${Q.level === k ? 'on' : ''}" data-act="gfx" data-arg="${k}" type="button">${l}</button>`).join('')}</div></div>`;
      h += `<div class="row"><div>${t('fps30')} <small>${t('fps30Hint')}</small></div><button class="toggle ${Q.fps30 ? 'on' : ''}" data-act="fps30" type="button">${Q.fps30 ? t('on') : t('off')}</button></div>`;
      h += `<div class="row"><div>${t('perfShow')} <small>${t('perfShowHint')}</small></div><button class="toggle ${Q.perf ? 'on' : ''}" data-act="perf" type="button">${Q.perf ? t('on') : t('off')}</button></div>`;
      h += `<div class="h">${t('autoSection')}</div>` + az('t1', I.t('autoT1')) + az('t2', I.t('autoT2')) + az('t3', I.t('autoT3')) + az('t45', I.t('autoT45')) + tg('sell', I.t('autoSell'));
      h += `<div class="h">${t('sound')}</div><div class="row"><div>${t('sfx')}</div><button class="toggle" data-act="vol" data-arg="sfx" type="button">${Math.round(Snd.state.sfx * 100)}%</button></div>`;
      h += `<div class="h">${I.t('tutReplay')}</div><div class="row"><div><small>${I.t('tutReplayHint')}</small></div><button class="toggle" data-act="tutReset" type="button">${I.t('tutReplay')}</button></div>`;
      h += `<div class="row"><div>${window.RTD_CREDITS ? window.RTD_CREDITS.label() : ''}</div><button class="toggle" data-act="credits" type="button">${t('view')}</button></div>`;
      h += `<div class="row"><div>${t('version')}</div><div>v${window.RTD_VERSION || '?'}</div></div>`;
      h += `<div class="row"><div>${t('bgm')}</div><button class="toggle" data-act="vol" data-arg="bgm" type="button">${Math.round(Snd.state.bgm * 100)}%</button></div>`;
    } else if (S.tab === 'war') {
      h = '';
    } else {
      h = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((t) => `<div class="h" style="color:${tierColor(t)}">${rankName(t)}</div>` + T.units.filter((d) => d.tier === t).map(bookRow).join('')).join('');
    }
    const pane = $('pane'), top = pane.scrollTop;
    if (pane.dataset.html !== h) { pane.innerHTML = h; pane.dataset.html = h; pane.scrollTop = top; }
    let a = '';
    if (net) a = net.roster().map((r) => `<div><span>${esc(r.state.name || '')}${r.me ? I.t('meTag') : ''}</span><span>${I.t('alliesLine', { u: r.state.units || 0, e: r.state.enemies || 0 })}</span></div>`).join('');
    $('allies').innerHTML = a; $('allies').hidden = !a;
  }
  // 보스전 역할 표시(7성 이상)
  const roleBadge = (d) => (d.role ? `<span class="role" style="color:${T.roles[d.role].color};border-color:${T.roles[d.role].color}">${esc(T.roles[d.role].name)}</span>` : '');
  // atk를 주면 다른 사령관 유닛: 그 사람 기준 공격력을 쓰고 내 강화 단계는 보이지 않는다
  // 공격력·공격 간격이 무엇 때문에 바뀌었는지: [{ n: 이름, v: 비율 }] (강화·시너지·명사/패시브·오라·변형 규칙)
  function atkSources(u) {
    const d = u.def, p = g.players[u.owner], out = [];
    const lv = g.upgradeLevel(p, d); if (lv) out.push({ n: I.t('upShort', { n: lv }), v: 0.2 * lv, mul: true });
    const seen = {};
    g.units.forEach((s) => { if (s.owner === p.idx) (s.def.p || []).forEach((x) => { if (x.k === 'globalAtk' && (x.fac === 'all' || x.fac === d.fac) && !seen[x.name]) { seen[x.name] = 1; out.push({ n: s.def.name, v: x.pct }); } }); });
    if (u.aura) { const src = g.units.find((s) => s.owner === u.owner && (s.def.p || []).some((x) => x.k === 'aura' && x.pct === u.aura && (!x.fac || x.fac === d.fac) && Math.hypot(u.x - s.x, u.y - s.y) <= x.r)); out.push({ n: src ? src.def.name : I.t('aura'), v: u.aura }); }
    Object.values((p && p.syn) || {}).forEach((s) => { const e = s.eff || {}; let v = 0; if ((e.only || s.units).includes(d.id)) v += e.atk || 0; if (s.per && s.per[d.id]) v += s.per[d.id].atk || 0; if (e.facAtk && d.fac === e.facAtk.fac) v += e.facAtk.pct; if (v) out.push({ n: s.name, v }); });
    const m = (g.mut.atk || 0) + g.mutAtk(); if (m) out.push({ n: I.t('mutShort'), v: m });
    return out;
  }
  function hasteSources(u) {
    const d = u.def, p = g.players[u.owner], out = [];
    let best = null; g.units.forEach((s) => { if (s.owner === p.idx) (s.def.p || []).forEach((x) => { if (x.k === 'tierHaste' && d.tier >= x.tier && (!best || x.pct > best.v)) best = { n: s.def.name, v: x.pct }; }); });
    if (best && best.v) out.push(best);
    return out;
  }
  const pctTxt = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  // 오른 값은 연한 빨강 굵게, 내린 값은 파랑 굵게
  const buffCls = (k) => (k > 1.0001 ? 'bup' : k < 0.9999 ? 'bdn' : '');
  function unitInfo(u, atk) {
    const d = u.def, f = T.factions[d.fac], remote = atk != null, lv = remote ? 0 : g.upgradeLevel(g.me, d);
    const spd = remote ? 1 : 1 + g.hasteOf(g.me.idx, d);
    let stats = '';
    if (d.tier) {
      const base = g.rankOf[d.tier].atk * g.attackTime(d), now = remote ? atk : g.unitAtk(u);
      const iv = g.attackTime(d) / spd;
      const src = remote ? [] : atkSources(u), hs = remote ? [] : hasteSources(u);
      const det = !remote && S.statDet ? `<div class="sdet"><span>${I.t('baseAtk')} ${fmt(base)}</span>${src.map((x) => `<span class="${x.v >= 0 ? 'bup' : 'bdn'}">${esc(x.n)} ${pctTxt(x.v)}</span>`).join('')}${hs.map((x) => `<span class="bup">${esc(x.n)} ${I.t('speedShort')} ${pctTxt(x.v)}</span>`).join('')}${src.length || hs.length ? '' : `<span>${I.t('noBuff')}</span>`}</div>` : '';
      stats = `<div class="line">${I.t('atk')} <strong class="${remote ? '' : buffCls(now / base)}">${fmt(now)}</strong> · ${I.t('hp')} ${fmt(g.rankOf[d.tier].hp)} · ${I.t('range')} ${g.range(d)} · ${I.t('interval')} <span class="${buffCls(g.attackTime(d) / iv)}">${I.t('sec', { n: iv.toFixed(2) })}</span>${remote ? '' : ` <button class="sdbtn" data-act="statDet" type="button">${I.t(S.statDet ? 'detClose' : 'detOpen')}</button>`}</div>${det}`;
    }
    const pass = (d.p || []).map((x) => `<div class="line" title="${esc(x.desc)}"><span class="tag">${t('passive')}</span>${esc(x.name)}: ${esc(x.desc)}</div>`).join('');
    const skills = (d.sk || []).map((s) => `<div class="line"><span class="tag">${t('active')}</span>${esc(s.n)} (${I.t('cooldown', { n: s.cd })})</div>`).join('');
    const role = d.role ? `<div class="line">${roleBadge(d)} <small>${esc(T.roles[d.role].desc)}</small></div>` : '';
    return `<img class="por" alt="" src="${Art.portrait(d)}">${unitHead(d, lv, remote)}<div class="sub line">${d.tier ? '' : I.t('special') + ' · '}<span style="color:${f.color}">${esc(f.name)}</span>${d.title ? ' · ' + esc(d.title) : ''}</div><div style="clear:both"></div>${role}${stats}${pass}${skills}`;
  }
  // 이름 머리: 전설·신화·불멸은 그 등급 글씨를 이름 앞에, 1~7성은 이름 뒤에 별, 강화는 +N
  function unitHead(d, lv, remote) {
    const rk = d.tier >= 8 ? `<span class="rkf rk${d.tier}">${rankName(d.tier)}</span>` : '';
    const st = d.tier >= 1 && d.tier <= 7 ? `<span class="stars" style="color:${tierColor(d.tier)}">${'★'.repeat(d.tier)}</span>` : '';
    const up = !remote && lv > 0 ? `<span class="plus">+${lv}</span>` : '';
    return `<h3 class="uh">${rk}<span style="color:${tierColor(d.tier)}">${esc(d.name)}</span>${up}${st}</h3>`;
  }
  // 조합식 전용 칸. 스크롤 없이 한 줄씩 보여주고 완성에 가까운 순서로 정렬한다.
  function recipeLine(id) {
    const st = g.recipeStatus(g.me, id), d = defOf[id];
    const parts = st.parts.map((x) => { const n = `${defOf[x.id].name} ${rankTag(defOf[x.id].tier)}` + (x.need > 1 ? ' ×' + x.need : ''); return x.have >= x.need ? `<b>${esc(n)}</b>` : esc(n); });
    if (st.item) { const n = T.items.find((i) => i.id === st.item).name; parts.push(st.hasItem ? `<b>${esc(n)}</b>` : esc(n)); }
    return `<div class="rc"><span class="rn">${esc(d.name)}</span>${rankBadge(d.tier)}<span class="rp" title="${parts.join(', ').replace(/<[^>]+>/g, '')}">${parts.join(' · ')}</span><button class="btn ${st.ok ? 'go' : ''}" data-act="craft" data-arg="${id}" type="button" ${st.ok ? '' : 'disabled'}>${I.t('combineBtn')}</button></div>`;
  }
  function unitRecipes(u) {
    const d = u.def, need = T.combineNeed[d.tier], lines = [];
    if (need) {
      const have = g.ownedOf(g.me, d.id).length;
      lines.push(`<div class="rc"><span class="rp">${I.t('combineInto', { a: Math.min(have, need), b: need, r: rankName(d.tier + 1) })}</span><button class="btn ${have >= need ? 'go' : ''}" data-act="combine" type="button" ${have >= need ? '' : 'disabled'}>${I.t('combineBtn')} R</button></div>`);
    }
    const score = (id) => { const st = g.recipeStatus(g.me, id); return st.parts.filter((x) => x.have >= x.need).length / st.parts.length; };
    const used = Object.keys(T.recipes).filter((id) => g.recipeOf(id).parts.includes(d.id)).sort((a, b) => score(b) - score(a));
    const list = used, max = need ? 5 : 6; // 자기 자신의 조합식은 재료로 쓰이는 곳이 아니므로 뺀다
    lines.push(...list.slice(0, max).map(recipeLine));
    if (list.length > max) lines.push(`<div class="sub line">${I.t('moreInBook', { n: list.length - max })}</div>`);
    if (!list.length && !need) lines.push(`<div class="sub line">${t('noRecipe')}</div>`);
    return lines.join('');
  }
  // 명령 패널은 스타크래프트처럼 선택한 대상의 것만 보여준다. 칸은 아이콘이고, 마우스를 올리면 설명이 뜬다.
  const ICON = {
    move: 'M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
    amove: 'M5 19 17 7M13 5l6-1-1 6M7 13l4 4M4 20l3-3',
    focus: 'M12 2v5M12 17v5M2 12h5M17 12h5M12 5a7 7 0 1 0 0.01 0M12 10a2 2 0 1 0 0.01 0',
    stop: 'M6 6h12v12H6z',
    sell: 'M4 7a8 3 0 1 0 16 0a8 3 0 1 0-16 0M4 7v5a8 3 0 0 0 16 0V7M4 12v5a8 3 0 0 0 16 0v-5',
    dash: 'M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7',
    heal: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    use: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
    crit: 'M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z',
    splash: 'M12 9a3 3 0 1 0 .01 0M12 5a7 7 0 1 0 .01 0M12 1.5a10.5 10.5 0 1 0 .01 0',
    burn: 'M12 2c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 2-8 1 1 2 3 2 5 1-2 2-5 2-8z',
    slow: 'M12 2v20M3.5 7l17 10M20.5 7l-17 10M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5',
    stun: 'M12 12a2 2 0 1 1 4 0a4 4 0 1 1-8 0a6 6 0 1 1 12 0a8 8 0 1 1-16 0',
    bossPct: 'M3 18h18L19 7l-4.5 4.5L12 5l-2.5 6.5L5 7zM3 21h18',
    pierce: 'M2 12h17M15 7l5 5-5 5M9 5v14',
    multi: 'M3 12h7l9-7M10 12h9M10 12l9 7',
    everyN: 'M13 2 4 14h7l-1 8 9-12h-7z',
    aura: 'M12 4a8 8 0 1 0 .01 0M12 9a3 3 0 1 0 .01 0',
    banner: 'M5 22V2M5 3h13l-3.5 4.5L18 12H5',
    hpPct: 'M12 21s-8.5-5.2-8.5-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.8C20.5 15.8 12 21 12 21z',
    guard: 'M12 2l8 3v6c0 5.2-3.6 9-8 11-4.4-2-8-5.8-8-11V5z',
    taunt: 'M3 10v4h4l8 5V5l-8 5zM18 8.5a5 5 0 0 1 0 7M20.5 6a8.5 8.5 0 0 1 0 12',
    regen: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8',
    expose: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 .01 0',
    breaker: 'M13 3l8 8-3 3-8-8zM10 9l-7 7 3 3 7-7M14 17l3 4M17 14l4 3',
    cdr: 'M6 2h12M6 22h12M7 2c0 6 10 5 10 10S7 16 7 22M17 2c0 6-10 5-10 10s10 4 10 10',
    skillPct: 'M6 3h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM6 17a2 2 0 0 0 2 2M10 8h6M10 12h6',
    haste: 'M4 6l6 6-6 6M12 6l6 6-6 6',
    coin: 'M12 3a9 9 0 1 0 .01 0M9 9h6M9 9v6h6M12 6v12',
    tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5a1 1 0 1 0 .01 0',
    upMax: 'M12 21V8M6 14l6-6 6 6M5 3h14',
    plus1: 'M12 3a9 9 0 1 0 .01 0M12 8v8M8 12h8',
    line: 'M3 21 19 5M14 4h6v6M3 21l3-1-2-2z',
    cone: 'M12 22 3.5 7.5a10 10 0 0 1 17 0z',
    circle: 'M12 8a4 4 0 1 0 .01 0M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8 7 17M17 7l2.8-2.8',
    buff: 'M12 21V5M5 12l7-7 7 7M5 21h14',
    weaken: 'M12 2l8 3v6c0 5.2-3.6 9-8 11-4.4-2-8-5.8-8-11V5zM12 6l-2 5 3 2-2 5',
    charm: 'M12 21s-8.5-5.2-8.5-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.8C20.5 15.8 12 21 12 21zM9 11c1 1.5 5 1.5 6 0',
    dot: 'M12 5l7 7-7 7-7-7z',
    close: 'M6 6l12 12M18 6L6 18',
  };
  const PASSIVE_ICON = { crit: 'crit', splash: 'splash', burn: 'burn', slow: 'slow', fieldSlow: 'slow', stun: 'stun', bossPct: 'bossPct', pierce: 'pierce', multi: 'multi', everyN: 'everyN', aura: 'aura', globalAtk: 'banner', partyAtk: 'banner', hpPct: 'hpPct', guard: 'guard', taunt: 'taunt', regen: 'regen', expose: 'expose', breaker: 'breaker', staggerEase: 'breaker', cdr: 'cdr', sageCdr: 'cdr', skillPct: 'skillPct', haste: 'haste', tierHaste: 'haste', roundGold: 'coin', interest: 'coin', bossGold: 'coin', midReward: 'coin', discount: 'tag', upMax: 'upMax', combineT1: 'plus1', activeHeal: 'heal', lastStand: 'hpPct', lowGuard: 'guard', auraGuard: 'guard', healLow: 'heal', healBuff: 'heal', partyCdr: 'cdr', bossWeak: 'weaken', aoe: 'circle', chain: 'cdr', lifesteal: 'regen', execute: 'bossPct' };
  const SKILL_ICON = { line: 'line', cone: 'cone', circle: 'circle', buff: 'buff', shield: 'guard', heal: 'heal', rally: 'banner', taunt: 'taunt', weaken: 'weaken', charm: 'charm', cover: 'guard', pshield: 'guard', hasteAll: 'haste', roar: 'taunt', delay: 'cdr', reflect: 'guard' };
  const icon = (k, col) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="color:${col || 'currentColor'}"><path d="${ICON[k] || ICON.dot}"/></svg>`;
  const tipAttr = (name, type, desc) => `data-tn="${esc(name)}" data-tt="${esc(type)}" data-td="${esc(desc)}"`;
  const CMD_INFO = { modeMove: ['move', t('move'), t('moveDesc')], amove: ['amove', t('attack'), t('attackDesc')], stop: ['focus', t('focus'), t('focusDesc')], sell: ['sell', t('disband'), t('disbandDesc')], useDrop: ['use', t('use'), ''], dash: ['dash', t('dash'), ''], heal: ['heal', '', ''], desel: ['close', t('deselect'), t('deselectDesc')] };
  const cmdBtn = (a, l, k, ok, on, extra) => {
    const ci = CMD_INFO[a] || ['dot', l, ''], ik = a === 'stop' && l === I.t('stop') ? 'stop' : ci[0];
    return `<button class="cmd ${on ? 'on' : ''}" data-act="${a}" type="button" ${ok ? '' : 'disabled'} ${tipAttr(l, t('command'), a === 'stop' && l === I.t('stop') ? I.t('stopDesc') : ci[2])}>${icon(ik)}${extra || ''}</button>`;
  };
  const passiveCell = (x) => `<div class="cmd info" ${tipAttr(x.name, t('passive'), x.desc)}>${icon(PASSIVE_ICON[x.k], '#e6c578')}<kbd>${t('passive')}</kbd></div>`;
  const skillDesc = (s) => `${(SKILL_TEXT[s.k] || (() => ''))(s)} · ${I.t('cooldown', { n: s.cd })}`;
  const skillCell = (s) => `<div class="cmd info" ${tipAttr(s.n, t('active'), skillDesc(s))}>${icon(SKILL_ICON[s.k], s.fx)}<kbd>${t('active')}</kbd></div>`;
  function fillCmds(cells) {
    // 9칸을 넘는 장수(불멸 등)도 잘리지 않게 모두 보여 준다
    const list = cells.slice();
    while (list.length < 9) list.push('<div class="cmd empty"></div>');
    return list.join('');
  }
  function setCmds(html) { const box = $('cmds'); if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; } }
  function setRecipes(h) { const box = $('recipes'); if (box.dataset.html !== h) { box.innerHTML = h; box.dataset.html = h; } }
  function setInfo(h) { const info = $('info'); if (info.dataset.html !== h) { const top = info.scrollTop; info.innerHTML = h; info.dataset.html = h; info.scrollTop = top; } }
  function dropInfo(d) {
    if (d.kind === 'item') {
      const tier = T.items.find((i) => i.id === d.item).tier;
      return `<h3>${esc(g.dropName(d))}</h3><div class="sub">${I.t('itemSub', { r: rankName(tier) })}</div>`;
    }
    return `<h3>${esc(g.dropName(d))}</h3><div>${esc(T.consumables[d.kind].desc)}</div><div class="sub">${I.t('useHint')}</div>`;
  }
  function renderInfo() {
    if (inBoss()) return renderFight();
    if (!laneOn()) { setInfo(`<h3>${g.fight ? esc(g.fight.def.title) : ''}</h3><div class="sub">${I.t('laneStopped')}</div>`); setRecipes(''); setCmds(fillCmds([])); return; }
    const vp = viewedPeer();
    if (vp) {
      const r = S.rsel && S.rsel.peer === vp.id ? S.rsel : null;
      setInfo(r ? unitInfo({ def: r.d }, r.atk) : `<h3>${esc(I.t('peerField', { a: vp.state.name }))}</h3><div class="sub">${I.t('peerHint')}</div>`);
      setRecipes(`<div class="sub line">${I.t('peerUnits')}</div>`);
      setCmds(fillCmds(r ? (r.d.p || []).map(passiveCell).concat((r.d.sk || []).map((s) => skillCell(s))) : []));
      return;
    }
    const list = selUnits(), p = g.me, drop = S.dropSel ? g.drops.find((d) => d.id === S.dropSel) : null;
    if (drop) {
      setInfo(dropInfo(drop));
      { const rid = drop.kind === 'item' && Object.keys(T.recipes).find((id) => g.recipeOf(id).item === drop.item); 
        // 신화 아이템 4개 → 랜덤 불멸 아이템(모바일은 접힌 정보 칸 대신 늘 보이는 조합식 줄에 둔다)
        const myth = drop.kind === 'item' && T.items.find((i) => i.id === drop.item).tier === 9, ok = myth && g.canFuse(p);
        const fuse = myth ? `<div class="rc"><span class="rp">${I.t('fuseHave', { n: g.mythItems(p).length })}</span><button class="btn ${ok ? 'go' : ''}" data-act="fuse" type="button" ${ok ? '' : 'disabled'}>${I.t('fuseBtn')}</button></div>` : '';
        setRecipes((rid ? recipeLine(rid) : '') + fuse); }
      setCmds(fillCmds(drop.kind === 'item' ? [] : [cmdBtn('useDrop', I.t('use'), '', true, S.cmdMode === 'use')]));
      return;
    }
    if (!list.length) { setInfo(`<h3>${I.t('commandHead')}</h3><div class="sub">${I.t('commandHint')}</div>`); setRecipes(`<div class="sub line">${I.t('recipeHint')}</div>`); setCmds(fillCmds([])); return; }
    const u = list[0], d = u.def, mob = list.some((x) => x.def.tier > 0);
    if (list.length === 1) setInfo(unitInfo(u));
    else {
      const c = {}; list.forEach((x) => (c[x.def.id] = (c[x.def.id] || 0) + 1));
      // 등급 높은 순으로, 등급 색과 함께. 누르면 그 유닛만 다시 선택한다.
      const ids = Object.keys(c).sort((a, b) => defOf[b].tier - defOf[a].tier);
      setInfo(`<h3>${I.t('nSelected', { n: list.length })}</h3><div class="chips">${ids.map((id) => `<button class="chip" data-act="selDef" data-arg="${id}" type="button" style="color:${tierColor(defOf[id].tier)};border-color:${tierColor(defOf[id].tier)}">${esc(defOf[id].name)} ${rankTag(defOf[id].tier)} ×${c[id]}</button>`).join('')}</div>`);
    }
    // 이동·어택땅·점사 아이콘은 뺐다(터치·키 M/A/S로는 그대로 쓴다)
    const cells = [];
    if (list.length === 1) {
      (d.p || []).forEach((x) => cells.push(passiveCell(x)));
      (d.sk || []).forEach((s) => cells.push(skillCell(s)));
      if (d.tier === 1) cells.push(cmdBtn('sell', t('disband'), '', true));
      if (!S.coarse) { /* PC는 Esc로 해제 */ }
      setRecipes(unitRecipes(u));
    } else setRecipes(`<div class="sub line">${I.t('recipeOne')}</div>`);
    cells.push(cmdBtn('desel', t('deselect'), '', true));
    setCmds(fillCmds(cells));
  }
  function renderFight() {
    const l = g.localChamps(), act = g.active(), dead = l.some((c) => c.dead);
    setInfo(act ? unitInfo(act.u) : `<h3>${I.t('noChamp')}</h3><div class="sub">${I.t('noChampHint')}</div>`);
    const subs = g.pickChoices().slice(0, 6);
    const hpLine = act ? `<div class="line">${I.t('curHp')} <strong>${fmt(act.hp)} / ${fmt(act.mhp)}</strong></div>` : '';
    const mini = l.map((c, i) => `<button class="btn ${c === act ? 'on' : ''}" data-act="champ" data-arg="${i}" type="button" ${c.dead ? 'disabled' : ''}>${i + 1}. ${esc(c.def.name)} ${Math.round((c.hp / c.mhp) * 100)}%</button>`).join('');
    setRecipes(`${hpLine}${dead && !g.mut.relay ? `<div class="h">${I.t('subDeploy')}</div><div class="chips">${subs.map((u) => `<button class="btn" data-act="sub" data-arg="${u.id}" type="button">${esc(u.def.name)} ${rankTag(u.def.tier)}</button>`).join('') || I.t('noSubs')}</div>` : ''}<div class="mini">${mini}</div>`);
    const left = g.healLeft();
    const healCell = left == null ? [] : [cmdBtn('heal', I.t('hwataHeal', { n: left }), '', left > 0)];
    if (!act) { setCmds(fillCmds(healCell)); return; }
    const d = act.def, cells = [cmdBtn('stop', I.t('stop'), '', true)];
    if (d.tier >= g.R.dashMinTier) cells.push(cmdBtn('dash', I.t('dash'), '', true, false, act.dashCd > 0 ? `<i class="cool" style="height:${(act.dashCd / g.R.dashCd) * 100}%"></i>` : ''));
    const M = g.fight.mech;
    (d.sk || []).forEach((s, i) => {
      // 미인계는 팀 공용 재사용을 함께 보여 준다
      const cd = act.skillCd[i];
      cells.push(`<button class="cmd" data-act="skill" data-arg="${i}" type="button" ${tipAttr(s.n, t('active'), skillDesc(s))}>${icon(SKILL_ICON[s.k], s.fx)}${cd > 0 ? `<i class="cool" style="height:${Math.min(100, (cd / s.cd) * 100)}%"></i>` : ''}</button>`);
    });
    (d.p || []).forEach((x) => cells.push(passiveCell(x)));
    cells.push(...healCell);
    const box = $('cmds'), html = fillCmds(cells); if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
  }
  // 명령칸 설명 팝업
  {
    const tip = document.createElement('div'); tip.id = 'cmdtip'; tip.hidden = true; document.body.appendChild(tip);
    let cur = null;
    const show = (el) => {
      cur = el;
      tip.innerHTML = `<b>${esc(el.dataset.tn)}</b><small>${esc(el.dataset.tt)}</small>${el.dataset.td ? `<div>${esc(el.dataset.td)}</div>` : ''}`;
      tip.hidden = false;
      const r = el.getBoundingClientRect(), z = zoom || 1;
      const x = Math.min(r.left / z, window.innerWidth / z - tip.offsetWidth - 6), y = r.top / z - tip.offsetHeight - 8;
      tip.style.left = Math.max(4, x) + 'px'; tip.style.top = (y < 4 ? r.bottom / z + 8 : y) + 'px';
    };
    $('cmds').addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tn]'); if (el && el !== cur) show(el); else if (!el) { tip.hidden = true; cur = null; } });
    $('cmds').addEventListener('mouseleave', () => { tip.hidden = true; cur = null; });
    let tipT = 0;
    $('cmds').addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      const el = e.target.closest('[data-tn]'); if (!el) return;
      show(el); clearTimeout(tipT); tipT = setTimeout(() => { tip.hidden = true; cur = null; }, 2600);
    });
    // 칸이 다시 그려지면 같은 자리의 새 칸으로 설명을 이어 준다
    setInterval(() => { if (cur && !cur.isConnected) { tip.hidden = true; cur = null; } }, 300);
  }
  // 권장 화력을 등급·업글·기수로 풀어 쓴다
  function advise(need, n) {
    for (let t = 2; t <= 10; t++) {
      const r = g.rankOf[t], cap = t < 3 ? 0 : t <= 6 ? 8 : 14, lv = Math.max(0, Math.ceil((need / (n * r.atk) - 1) / 0.2));
      if (lv <= cap) return `${rankName(t)}${lv ? ' ' + I.t('upg', { n: lv }) : ''} ${I.t('nUnits', { n })}`;
    }
    return `${rankName(10)} ${I.t('upg', { n: 20 })} ${I.t('nUnits', { n })}`;
  }
  function timerDetail(x) {
    if (x.boss) {
      const b = g.bossByRound[x.r], dps = g.bossStats(b).hp / (b.time * 0.45), n = g.slotCount(), rw = T.bossRewards[x.r] || {};
      const fast = rw.tickets ? `<div><b>${I.t('fastClear')}</b> ${I.t('fastHint', { r: rankName(Math.max(1, rw.tickets[0][0] - 1)) })}</div>` : '';
      return `<div>${esc(b.title)} · ${I.t('limit', { t: clock(b.time) })}</div><div><b>${I.t('recommend')}</b> ${advise(dps, n)}${n > 1 ? ` ${I.t('or')} ${advise(dps, 1)}` : ''}</div><div><b>${I.t('reward')}</b> ${esc(rwText(rw))}</div>${fast}`;
    }
    const m = g.midByRound[x.r], hp = g.monsterHp(m.round) * 12;
    return `<div>${esc(m.story)} · ${I.t('limit45')}</div><div><b>${I.t('recommend')}</b> ${I.t('onPath', { a: advise(hp / 18, 3) })}</div><div><b>${I.t('reward')}</b> ${esc(rwText(m.reward))}</div>`;
  }
  let timerRows = null;
  function buildTimers() {
    timerRows = T.bosses.map((b) => ({ r: b.round, name: b.name, boss: true }))
      .concat(T.midbosses.map((m) => ({ r: m.round, name: m.name })))
      .filter((x) => x.r <= g.diff.rounds).sort((a, b) => a.r - b.r);
    $('tlist').innerHTML = timerRows.map((x) => `<div class="tw" data-r="${x.r}"><div class="tr ${x.boss ? 'boss' : ''}" data-act="timer" data-arg="${x.r}"><span class="rd">R${x.r}</span><span class="nm">${esc(x.name)}</span><span class="tm"></span><i class="gauge"></i></div><div class="td"><div class="ti">${timerDetail(x)}</div></div></div>`).join('');
    timerRows.forEach((x) => { x.row = $('tlist').querySelector(`.tw[data-r="${x.r}"] .tr`); x.tm = x.row.querySelector('.tm'); x.gauge = x.row.querySelector('.gauge'); });
  }
  // 보스와 중간보스의 소환까지 남은 시간. 보스전 시간은 플레이에 따라 달라 계산에서 뺀다.
  function renderTimers() {
    if (!timerRows) buildTimers();
    const left = g.phase === 'wave' ? Math.max(0, g.R.roundTime - g.roundT) : g.R.roundTime;
    const eta = (x) => {
      let t = left;
      for (let r = g.round + 1; r < x.r; r++) if (!g.bossByRound[r]) t += g.R.roundTime;
      return t;
    };
    let nextKey = null, hudBoss = null;
    const hudMid = [];
    timerRows.forEach((x) => {
      let tm, cls = x.boss ? 'tr boss' : 'tr', fill = 0;
      if (x.boss && x.r === g.round && g.fight) { tm = g.phase === 'boss' ? clock(Math.max(0, g.fight.limit - g.fight.t)) : I.t('appearShort'); cls += ' now'; }
      else if (!x.boss && g.mids[x.r] && g.mids[x.r].state === 'field') {
        const e = g.enemies.find((o) => o.mid && o.midDef.round === x.r);
        tm = e ? I.t('field') + ' ' + clock(Math.ceil(e.midT)) : I.t('field'); cls += ' now'; fill = e ? e.midT / g.R.midLimit : 0;
      }
      else if (!x.boss && g.mids[x.r] && g.mids[x.r].state === 'cool') { tm = I.t('respawn') + ' ' + clock(Math.ceil(g.mids[x.r].t)); fill = g.mids[x.r].t / (g.midByRound[x.r].respawn || g.R.midRespawn); }
      else if (x.r <= g.round) { tm = I.t('downed'); cls += ' past'; }
      else tm = clock(eta(x));
      if (!cls.includes('past') && nextKey == null) nextKey = x.r;
      if (x.boss && !cls.includes('past') && !hudBoss) hudBoss = `R${x.r} ${x.name} ${tm}`;
      if (!x.boss && cls.includes('now') && tm.startsWith(I.t('field'))) hudMid.push(`${t('midBoss')} ${x.name} ${tm}`);
      x.gauge.style.width = fill * 100 + '%';
      if (x.tm.textContent !== tm) x.tm.textContent = tm;
      if (x.row.className !== cls) x.row.className = cls;
    });
    S.hudNext = { boss: hudBoss, mids: hudMid };
    const box = $('tlist');
    if (box.dataset.next !== String(nextKey)) {
      box.dataset.next = nextKey;
      const el = box.querySelector(`.tw[data-r="${nextKey}"]`);
      if (el) box.scrollTop = el.offsetTop - box.offsetTop;
    }
  }
  // 인연 시너지 목록(왼쪽): 모인 인물 수 / 필요 수, 켜지면 밝게
  function renderSyn() {
    const box = $('synlist'), p = g.me;
    const vis = (T.synergies || []).map((s) => ({ s, n: s.units.filter((id) => g.has(p, id)).length, on: !!(p.syn && p.syn[s.id]) }))
      .filter((x) => (x.s.hidden ? x.on : x.n > 0)).sort((a, b) => b.on - a.on || b.n / b.s.units.length - a.n / a.s.units.length);
    const h = !vis.length ? `<div class="sub" style="padding:6px 10px">${t('synergyHint')}</div>` : vis.map(({ s }) => {
      const have = s.units.filter((id) => g.has(p, id)), on = p.syn && p.syn[s.id];
      return `<div class="syn ${on ? 'on' : ''}" title="${esc(s.desc)}"><span class="cnt">${have.length}/${s.units.length}</span><b>${s.hidden ? '★ ' : ''}${esc(s.name)}</b><div class="us">${s.units.map((id) => `<span class="${g.has(p, id) ? 'h' : ''}">${esc(defOf[id].name)}</span>`).join(' · ')}</div><small style="grid-column:2">${esc(s.desc)}</small></div>`;
    }).join('');
    if (box.dataset.html !== h) { box.innerHTML = h; box.dataset.html = h; }
    // 이번 판 변형 규칙(악몽 +N)
    const mb = $('mutlist'), mt = $('mutt');
    if (g.muts && g.muts.length && !mb.dataset.done) {
      mb.dataset.done = '1'; mt.hidden = false; mt.textContent = I.t('mutHead', { n: g.mutLv });
      mb.innerHTML = `<div style="display:grid;gap:4px;padding:4px 6px 8px">${g.muts.map((m, i) => mutCard(m.id, i)).join('')}</div>`;
    }
  }
  // 판 끝 통계: 요약 · 보스전 기록(순위) · 라인 피해 순위 · 강화·조합 기록
  function endStats() {
    const s = g.stats, win = g.over === 'win', mm = Math.floor(g.time / 60), ss = Math.floor(g.time % 60);
    const card = (l, v, sub) => `<div class="es-card"><small>${l}</small><b>${v}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
    const cards = [
      card(I.t('reachRound'), `${g.round} / ${g.diff.rounds}`), card(I.t('playTime'), `${mm}:${String(ss).padStart(2, '0')}`),
      card(I.t('kills'), fmt(s.kills)), card(I.t('midboss'), I.t('midKills', { n: s.midKill }), s.midMiss ? I.t('midMiss', { n: s.midMiss }) : I.t('noMiss')),
      card(I.t('lifeLost'), `${s.lifeLost}`, I.t('livesLeft', { n: g.lives })), card(I.t('bestTier'), s.bestName ? `${esc(s.bestName)}` : '-', s.best ? rankName(s.best) : ''),
      card(I.t('goldEarned'), fmt(s.goldIn), I.t('upHire', { a: fmt(s.goldUp), b: fmt(s.goldHire) })), card(I.t('combCraft'), `${s.combines} · ${s.crafts.length}`, I.t('tixChest', { a: s.tickets, b: s.chests })),
      card(I.t('ach'), `${Object.keys(g.me.done).length} / ${T.achievements.length}`),
    ].join('')
      // 현재 난이도 칸: 악몽 +N이면 (!) 표시, 꾹 누르면 이번 판 변형 규칙 팝업
      + `<div class="es-card es-diff ${g.mutLv && g.muts && g.muts.length ? 'has-mut' : ''}" style="--dc:${DIFF_COL[g.diff.id] || '#c99a2e'}"><small>${t('difficulty')}</small><b>${esc(g.diff.name)}${g.mutLv ? ` +${g.mutLv}` : ''}</b>${net ? `<i>${esc(I.t('nCoop', { n: net.roster().length }))}</i>` : ''}${g.mutLv && g.muts && g.muts.length ? `<em class="es-bang" aria-label="${esc(I.t('mutHead', { n: g.mutLv }))}">!</em>` : ''}</div>`;
    // 보스전: 결과·시간·빠른 클리어와 피해 순위
    const bossRows = s.bosses.map((b) => {
      const rows = (S.bossRows && S.bossRows[b.round]) || Object.keys(b.dealt).map((k) => ({ name: k, v: b.dealt[k] })).sort((x, y) => y.v - x.v);
      const sum = rows.reduce((a, r) => a + r.v, 0) || 1;
      const rank = rows.slice(0, 5).map((r, i) => `<span class="es-rk ${r.me ? 'me' : ''}">${i + 1}. ${esc(r.name)} <em>${fmt(r.v)} (${Math.round((r.v / sum) * 100)}%)</em></span>`).join('');
      return `<tr><td>R${b.round} ${esc(b.name)}</td><td class="${b.win ? 'ok' : 'bad'}">${b.win ? I.t(b.fast ? 'fastClear' : 'downed') : I.t('fail')}</td><td>${clock(b.time)} / ${clock(b.limit)}</td><td>${esc(b.champs.join(', '))}</td><td class="es-rks">${rank}</td></tr>`;
    }).join('');
    // 라인 피해 순위(유닛 종류별)
    const du = Object.keys(s.dmgUnit).map((id) => ({ d: defOf[id], v: s.dmgUnit[id] })).filter((x) => x.d).sort((a, b) => b.v - a.v), dsum = du.reduce((a, x) => a + x.v, 0) || 1, top = du[0] ? du[0].v : 1;
    const dmgRows = du.slice(0, 10).map((x, i) => `<div class="es-bar"><span class="n" style="color:${tierColor(x.d.tier)}">${i + 1}. ${esc(x.d.name)} ${rankTag(x.d.tier)}</span><span class="b"><i style="width:${(x.v / top) * 100}%;background:${tierColor(x.d.tier)}"></i></span><span class="v">${fmt(x.v)} · ${Math.round((x.v / dsum) * 100)}%</span></div>`).join('');
    const ups = T.upgrades.map((u) => `<span class="chip">${esc(u.name)} ${I.t('lvN', { n: g.me.upgrades[u.id] || 0 })}</span>`).join('');
    const crafts = s.crafts.length ? s.crafts.map((n) => `<span class="chip">${esc(n)}</span>`).join('') : `<span class="dim">${I.t('none')}</span>`;
    // 승리: 철괴 제목판을 키워 글씨를 얹는다. 패배: 기울어진 부서진 나무판(흰 깃발 그림)에 '전선 붕괴'.
    const head = win ? `<div class="es-win"><span>${t('win')}</span></div>` : `<div class="es-lose"><span>${t('lose')}</span></div>`;
    return `<div class="over" id="end"><div class="sheet es">
      ${head}${S.xpGained != null && ACC.me ? `<div class="dim" style="color:#ffd86a">${t('xpGain', { n: S.xpGained })} · ${esc(t(ACC.me.grade))} ${t('level', { n: ACC.me.level })}</div>` : ''}<div class="es-cards">${cards}</div>
      ${g.mutLv && g.muts && g.muts.length ? `<div class="es-mutpop" hidden><b>${esc(I.t('mutHead', { n: g.mutLv }))}</b>${g.muts.map((m, i) => mutCard(m.id, i)).join('')}</div>` : ''}
      <h3>${I.t('bossLog')}</h3>${bossRows ? `<table class="es-boss"><tr><th>${I.t('thBoss')}</th><th>${I.t('thResult')}</th><th>${I.t('thTime')}</th><th>${I.t('thChamp')}</th><th>${I.t('dmgRank')}</th></tr>${bossRows}</table>` : `<div class="dim">${I.t('noBossLog')}</div>`}
      <h3>${I.t('laneDmgRank')}</h3>${dmgRows || `<div class="dim">${I.t('noRecord')}</div>`}
      <h3>${I.t('upgrade')}</h3><div class="chips">${ups}</div>
      <h3>${I.t('craftedHead')}</h3><div class="chips">${crafts}</div>
      <button class="btn go es-again" data-act="restart" type="button">${t('again')}</button></div></div>`;
  }
  // ---- 판 끝 경험치 연출: 화면을 어둡게 흐리고, 지금 계급 문양 ─ 경험치 막대 ─ 다음 계급 문양.
  // +경험치가 뜬 뒤 막대가 그만큼 차오르고(계급이 오르면 문양이 바뀜), 잠시 뒤 사라지며 결과창이 나온다.
  const RANK_LV = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 51];
  const lvOfXp = (xp) => Math.min(51, Math.floor(Math.sqrt(xp / 40)) + 1);
  const rkOfLv = (lv) => RANK_LV.reduce((k, m, i) => (lv >= m ? i : k), 0);
  const xpAt = (lv) => 40 * (lv - 1) * (lv - 1);
  const rankSpan = (r) => [xpAt(RANK_LV[r]), r < 10 ? xpAt(RANK_LV[r + 1]) : xpAt(RANK_LV[r]) + 1];
  const rankMark = (r) => `<span class="xpm"><img alt="" src="gfx/rank_${r}.png" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'${r}'}))"></span>`;
  function playXp(from, to, coins, done) {
    const track = ACC.me && ACC.me.track === 'civ' ? 'civ' : 'mil', nm = (r) => t('rk_' + track + r);
    const el = document.createElement('div'); el.id = 'xpfx';
    el.innerHTML = `<div class="xpbox"><div class="xpside l"></div><div class="xpmid"><div class="xpbar"><i></i></div><div class="xpnum"></div><div class="xpgain">+${fmt(to - from)} XP</div><div class="xpcoin">+${fmt(coins || 0)} ${t('lb_coin')}</div></div><div class="xpside r"></div></div>`;
    $('app').appendChild(el);
    const side = (r) => `${rankMark(r)}<small>${esc(nm(r))}</small>`;
    let shownR = -1;
    const draw = (xp) => {
      const r = rkOfLv(lvOfXp(xp)), [lo, hi] = rankSpan(r), k = r >= 10 ? 1 : Math.max(0, Math.min(1, (xp - lo) / (hi - lo)));
      if (r !== shownR) { el.querySelector('.l').innerHTML = side(r); el.querySelector('.r').innerHTML = r < 10 ? side(r + 1) : ''; if (shownR >= 0) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); } shownR = r; }
      el.querySelector('.xpbar i').style.width = (k * 100).toFixed(1) + '%';
      el.querySelector('.xpnum').textContent = r >= 10 ? 'MAX' : `${fmt(Math.round(xp - lo))} / ${fmt(hi - lo)}`;
    };
    draw(from);
    requestAnimationFrame(() => el.classList.add('in'));
    // 0.7초 뒤 +XP가 뜨고, 1.4초 동안 차오른다. 다 차고 1.6초 뒤 사라진다.
    setTimeout(() => { el.classList.add('gain'); const t0 = performance.now(), D = 1400;
      const step = (now) => { const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3); draw(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); else setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); done(); }, 600); }, 1600); };
      requestAnimationFrame(step); }, 700);
  }
  // ---- 보스전 직접 조작(모바일 MOBA식) ----
  // 왼쪽 조이스틱으로 이동, 오른쪽 아래 공격 버튼을 누르고 있는 동안 공격(자동 공격 없음).
  // 스킬·이동기는 공격 버튼을 둘러싼 '고양이 발' 배치. 짧게 톡 = 사거리 안의 적에게 자동 조준(밖이면 보는 방향),
  // 꾹 누르고 끌면 장수 둘레에 사거리와 범위가 보이고 끈 방향·거리로 조준해 손을 떼면 쓴다.
  const PAD = { atk: null, aim: null, joy: null, jv: null };
  const AIM_HOLD = 220, AIM_DRAG = 80;
  function skillInfo(c, k) {
    if (k === 'dash') return { range: 280, shape: 'dash', w: 44 };
    const s = (c.def.sk || [])[+k];
    if (!s) return null;
    if (s.k === 'line') return { range: s.len, shape: 'line', w: s.w };
    if (s.k === 'cone') return { range: s.r, shape: 'cone', arc: s.arc };
    if (s.k === 'circle') return { range: s.range || 0, shape: 'circle', r: s.r };
    return { range: 0, shape: 'self' };
  }
  // 짧게 눌렀을 때: 사거리 안에 적이 있으면 그 적, 없으면 보는 방향으로
  function autoTarget(c, info) {
    const fo = g.champFoe(c) || (g.fight && g.fight.boss), reach = info.shape === 'circle' && !info.range ? info.r : info.range;
    if (fo && (info.shape === 'self' || dist(c.x, c.y, fo.x, fo.y) <= reach + 60)) return { x: fo.x, y: fo.y };
    const a = c.face ?? 0, r = Math.max(info.range, 120);
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  }
  // 끌어서 조준: 버튼에서 끈 방향이 쏘는 방향, 끈 거리(최대 AIM_DRAG px)가 사거리 비율
  function aimTarget(c, info, A) {
    const len = Math.hypot(A.dx, A.dy);
    if (len < 14) return autoTarget(c, info);
    const k = Math.min(1, len / AIM_DRAG), r = info.shape === 'circle' ? info.range * k : Math.max(info.range, 120);
    return { x: c.x + (A.dx / len) * Math.max(r, info.shape === 'circle' ? 0 : 30), y: c.y + (A.dy / len) * Math.max(r, info.shape === 'circle' ? 0 : 30) };
  }
  function castAt(c, k, x, y) {
    if (k === 'dash') g.dash(c, x, y);
    else g.useSkill(c, +k, x, y);
  }
  function drawAim(c) {
    const A = PAD.aim, ch = g.active();
    if (!A || !ch) return;
    if (!A.on && performance.now() - A.t0 > AIM_HOLD) A.on = true;
    if (!A.on) return;
    const info = skillInfo(ch, A.k);
    if (!info) return;
    const tg = aimTarget(ch, info, A), a = Math.atan2(tg.y - ch.y, tg.x - ch.x);
    c.save();
    // 사거리(장수 둘레)
    const rr = info.range || (info.shape === 'circle' ? info.r : 90);
    c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeStyle = 'rgba(150,205,255,.85)'; c.fillStyle = 'rgba(120,180,255,.08)';
    c.beginPath(); c.arc(ch.x, ch.y, rr, 0, 7); c.fill(); c.stroke(); c.setLineDash([]);
    // 맞는 범위
    c.fillStyle = 'rgba(255,205,110,.3)'; c.strokeStyle = 'rgba(255,225,150,.95)'; c.lineWidth = 2.5;
    if (info.shape === 'line' || info.shape === 'dash') {
      const L = info.shape === 'dash' ? Math.min(info.range, Math.max(30, dist(ch.x, ch.y, tg.x, tg.y))) : info.range;
      c.translate(ch.x, ch.y); c.rotate(a); c.beginPath(); c.rect(0, -info.w / 2, L, info.w); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(L + 18, 0); c.lineTo(L, -12); c.lineTo(L, 12); c.closePath(); c.fillStyle = 'rgba(255,225,150,.9)'; c.fill();
    } else if (info.shape === 'cone') {
      c.beginPath(); c.moveTo(ch.x, ch.y); c.arc(ch.x, ch.y, info.range, a - info.arc / 2, a + info.arc / 2); c.closePath(); c.fill(); c.stroke();
    } else if (info.shape === 'circle') {
      const px = info.range ? tg.x : ch.x, py = info.range ? tg.y : ch.y;
      c.beginPath(); c.arc(px, py, info.r, 0, 7); c.fill(); c.stroke();
    }
    c.restore();
  }
  function padInit() {
    const bar = $('skillbar'), joy = $('joy');
    if (!bar || bar._pad) return;
    bar._pad = true;
    bar.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-sk]'), c = g && g.active();
      if (!b || !c) return;
      e.preventDefault(); e.stopPropagation();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      const k = b.dataset.sk;
      if (k === 'atk') { PAD.atk = e.pointerId; c.atkHold = 0.3; b.classList.add('on'); return; }
      if (k === 'heal') { g.useHeal(); return; }
      if (b.dataset.cd === '1') return;
      const r = b.getBoundingClientRect();
      PAD.aim = { id: e.pointerId, k, cx: r.left + r.width / 2, cy: r.top + r.height / 2, t0: performance.now(), dx: 0, dy: 0, on: false, el: b };
      b.classList.add('on');
    });
    bar.addEventListener('pointermove', (e) => {
      const A = PAD.aim;
      if (!A || A.id !== e.pointerId) return;
      A.dx = e.clientX - A.cx; A.dy = e.clientY - A.cy;
      if (Math.hypot(A.dx, A.dy) > 14) A.on = true;
    });
    const up = (e) => {
      if (PAD.atk === e.pointerId) { PAD.atk = null; bar.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); return; }
      const A = PAD.aim;
      if (!A || A.id !== e.pointerId) return;
      PAD.aim = null; A.el.classList.remove('on');
      const c = g && g.active(), info = c && skillInfo(c, A.k);
      if (!info || e.type === 'pointercancel') return;
      const tg = A.on ? aimTarget(c, info, A) : autoTarget(c, info);
      castAt(c, A.k, tg.x, tg.y);
      dirty();
    };
    bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    // 조이스틱: 받침 안에서 누른 자리를 기준으로 끈 방향·세기로 움직인다
    const knob = joy.querySelector('i'), R = 52;
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      try { joy.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      const r = joy.getBoundingClientRect();
      PAD.joy = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      joyMove(e);
    });
    const joyMove = (e) => {
      const J = PAD.joy;
      if (!J || J.id !== e.pointerId) return;
      let dx = e.clientX - J.cx, dy = e.clientY - J.cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      PAD.jv = { x: dx / R, y: dy / R };
      joy.classList.add('on');
    };
    joy.addEventListener('pointermove', joyMove);
    const joyUp = (e) => { if (!PAD.joy || PAD.joy.id !== e.pointerId) return; PAD.joy = null; PAD.jv = null; knob.style.transform = ''; joy.classList.remove('on'); };
    joy.addEventListener('pointerup', joyUp); joy.addEventListener('pointercancel', joyUp);
  }
  // 매 프레임: 조이스틱·공격 버튼 상태를 지금 고른 장수에 넘긴다
  function padTick() {
    if (!g) return;
    // 라인: 고른 유닛들을 조이스틱 방향으로 직접 움직인다(다중 선택도 대형 그대로 함께 움직인다)
    g.laneJoy = PAD.lane && PAD.jv && S.sel.length ? { ids: new Set(S.sel), x: PAD.jv.x, y: PAD.jv.y } : null;
    const c = g.phase === 'boss' && !S.laneView ? g.active() : null;
    if (!c) return;
    g.localChamps().forEach((o) => { if (o !== c) o.joy = null; });
    c.joy = PAD.jv;
    if (PAD.atk != null) c.atkHold = 0.3;
  }
  // 보스전 스킬: 선택한 장수의 스킬·이동기·화타 치료를 공격 버튼 둘레(고양이 발)에 아이콘과 재사용 시간으로 보여 준다
  const SK_GLYPH = { line: '斬', circle: '爆', cone: '扇', buff: '勢', shield: '盾', heal: '治', rally: '令', taunt: '挑', weaken: '弱' };
  // 공격 버튼 중심에서의 자리(반지름 px, 각도: 0=오른쪽, 90=위)
  // 화면 오른쪽 끝에서 잘리지 않게 모두 공격 버튼의 왼쪽~위쪽에만 둔다(안쪽 줄 3개, 바깥 줄 3개)
  const PAW = [[112, 186], [112, 140], [112, 94], [188, 168], [188, 132], [188, 100]];
  function renderSkillBar() {
    const bar = $('skillbar'), joy = $('joy'), c = inBoss() && g.phase === 'boss' ? g.active() : null;
    padInit();
    g.manual = !!c;
    // 라인에서는 터치 기기에서 유닛을 고르면 조이스틱만 띄운다(공격·스킬 버튼 없음, 유닛은 사거리 안의 적을 알아서 친다)
    const lane = !c && !!S.coarse && laneOn() && !viewedPeer() && !g.over && S.sel.length > 0;
    PAD.lane = lane;
    $('stage').classList.toggle('lanejoy', lane);
    if (!c) {
      if (!bar.hidden) { bar.hidden = true; bar.dataset.k = ''; PAD.atk = null; PAD.aim = null; }
      if (joy.hidden === lane) { joy.hidden = !lane; if (!lane) { PAD.jv = null; PAD.joy = null; joy.classList.remove('on'); joy.querySelector('i').style.transform = ''; } }
      return;
    }
    const sk = c.def.sk || [], heal = g.healLeft(), dash = c.def.tier >= g.R.dashMinTier;
    const key = c.uid + ':' + sk.length + ':' + dash + ':' + (heal == null ? 'n' : 'h');
    if (bar.dataset.k !== key) {
      bar.dataset.k = key;
      let slot = 0;
      const pos = () => { const [r, a] = PAW[Math.min(slot++, PAW.length - 1)], rad = (a * Math.PI) / 180; return `--x:${(Math.cos(rad) * r).toFixed(0)}px;--y:${(-Math.sin(rad) * r).toFixed(0)}px`; };
      // 아이콘: game-icons.net 그림(skillicons.js), 없으면 한자
      const ic = (k, glyph) => (window.RTD_ICON && window.RTD_ICON(k)) || glyph;
      const cell = (k, col, glyph, name) => `<button class="sk" data-sk="${k}" type="button" style="--c:${col};${pos()}" title="${esc(name)}">${glyph}<span class="cd"></span><span class="sec"></span><span class="nm">${esc(name)}</span></button>`;
      bar.innerHTML = sk.map((s, i) => cell(i, s.fx || '#ffd86a', ic(s.k, SK_GLYPH[s.k] || '技'), s.n)).join('')
        + (dash ? cell('dash', '#9fd8ff', ic('dash', '迅'), I.t('dash')) : '')
        + (heal != null ? cell('heal', '#a8ffb8', ic('hwata', '醫'), I.t('hwataHeal', { n: heal })) : '')
        + `<button class="sk atk" data-sk="atk" type="button" style="--c:#ffb070" title="${esc(t('attack'))}">${ic('atk', '攻')}</button>`;
      bar._cells = [...bar.querySelectorAll('.sk:not(.atk)')];
      bar.hidden = false; joy.hidden = false;
    }
    // 재사용 시간 갱신(돌아오는 순간 반짝)
    const cds = sk.map((s, i) => [c.skillCd[i], s.cd * (1 - Math.min(0.6, g.pv(c.def, 'cdr')))]);
    if (dash) cds.push([c.dashCd, g.R.dashCd]);
    if (heal != null) cds.push([heal > 0 ? 0 : 1, 1]);
    bar._cells.forEach((el, i) => {
      const [left, max] = cds[i] || [0, 1], p = left > 0 ? Math.min(1, left / max) : 0;
      const pv = `${Math.round(p * 50) * 2}%`; // 2% 단위로만 바꿔 불필요한 다시 그리기를 줄인다
      if (el._p !== pv) { el._p = pv; el.querySelector('.cd').style.setProperty('--p', pv); }
      const sec = el.querySelector('.sec'), txt = left > 0 && max > 1 ? String(Math.ceil(left)) : '';
      if (sec.textContent !== txt) sec.textContent = txt;
      const was = el.dataset.cd === '1', now = p > 0;
      if (was && !now) { el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); }
      el.dataset.cd = now ? '1' : '0';
    });
    if (heal != null) { const nm = bar._cells[bar._cells.length - 1].querySelector('.nm'), hl = I.t('hwataHeal', { n: heal }); if (nm.textContent !== hl) nm.textContent = hl; }
  }
  // ---- 화면 위 정보 줄 · 오른쪽 버튼 열 · 서랍 ----
  const RAIL_ICON = {
    upgrade: 'M12 21V8M6 14l6-6 6 6M5 3h14',
    sage: 'M6 3h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM6 17a2 2 0 0 0 2 2M10 8h6M10 12h6',
    ticket: 'M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 0 0-4V4H3zM14 4v12',
    war: 'M5 22V2M5 3h13l-3.5 4.5L18 12H5',
    auto: 'M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5',
    menu: 'M4 6h16M4 12h16M4 18h16',
  };
  // 오른쪽 버튼 아이콘: 강화·명사·선택권·전황은 그린 그림(gfx/ic_*.png), 자동은 도는 화살표(켜져 있으면 CSS로 빙글빙글 돈다)
  const RAIL_PIC = { upgrade: 1, sage: 1, ticket: 1, war: 1 };
  const rIcon = (k) => (RAIL_PIC[k] ? `<img class="ri" alt="" src="gfx/ic_${k}.png?v=3">` : `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${RAIL_ICON[k]}"/></svg>`);
  function renderHud() {
    const vp = viewedPeer(), ln = vp && vp.state.ln;
    const gold = ln ? ln.g : g.me.gold, lives = ln ? ln.l : g.lives, en = ln ? ln.n : g.enemyCount(), own = ln ? ln.u.length : g.units.filter((u) => u.owner === 0).length;
    const tm = g.phase === 'wave' ? clock(Math.max(0, g.R.roundTime - g.roundT)) : g.phase === 'boss' && g.fight ? clock(Math.max(0, g.fight.limit - g.fight.t)) : '-';
    const cell = (l, v, cls) => `<div class="hs ${cls || ''}"><small>${l}</small><b>${v}</b></div>`;
    let h = `<div class="hrow">${cell(t('round'), `${g.round}/${g.diff.rounds}`)}${cell(g.phase === 'wave' ? t('timeLeft') : t('duel'), tm)}${cell(T.currency, fmt(gold), 'gold')}${g.phase === 'boss' && !S.laneView ? '' : cell(t('lives'), lives, lives <= 5 ? 'alert' : '') + cell(t('front'), `${en}/${g.limit}`, en > g.limit * 0.75 ? 'alert' : '') + cell(t('troops'), own)}</div>`;
    const hd = S.hudNext || {};
    const chips = (hd.mids || []).map((m) => `<span class="nc mid" data-act="drawer" data-arg="war">${esc(m)}</span>`).join('') + (hd.boss ? `<span class="nc boss" data-act="drawer" data-arg="war">${t('nextBoss')}<br><b>${esc(hd.boss)}</b></span>` : '');
    // 자리 비운 동료(앱을 내림)
    const aw = net && net.awayList ? net.awayList().map((p) => `<span class="nc mid">${esc(p.state.name || '?')} · ${t('away')}</span>`).join('') : '';
    if (chips || aw) h += `<div class="hrow">${chips}${aw}</div>`;
    // 파티원(세로, 반투명): 아이콘·닉네임·등급 문양·전선·라이프. 누르면 그 사람 전장을 본다(내 줄은 내 전장으로)
    if (net && net.roster && g.mode === 'multi') {
      const ros = net.roster(), lim = g.limit;
      const rows = ros.map((pp) => {
        const st = pp.state || {}, ln = pp.me ? null : st.ln;
        const en = pp.me ? g.enemyCount() : ln ? ln.n : st.enemies, lv = pp.me ? g.lives : ln ? ln.l : null;
        const d = defOf[st.ic] || defOf.cav, rk = /(\d+)$/.exec(st.gr || '') ? +/(\d+)$/.exec(st.gr)[1] : null;
        const on = pp.me ? !S.view : S.view === pp.id;
        return `<button class="pm ${on ? 'on' : ''} ${st.away ? 'away' : ''}" data-act="viewPeer" data-arg="${pp.me ? 'me' : pp.id}" type="button"><img class="pi" alt="" src="${Art.portrait(d)}"><span class="pn">${rk != null ? `<img class="rkm" alt="" src="gfx/rank_${rk}.png" onerror="this.remove()">` : ''}${esc(st.name || '?')}</span><span class="ps">${t('front')} ${en == null ? '-' : en}/${lim} · ${t('lives')} ${lv == null ? '-' : lv}</span></button>`;
      }).join('');
      if (ros.length > 1) h += `<div class="party">${rows}</div>`;
    }
    const box = $('hud');
    box.style.display = g.over ? 'none' : ''; // 결과창 위에 겹치지 않게
    if (box.dataset.html !== h) { box.innerHTML = h; box.dataset.html = h; }
    // 오른쪽 버튼 열: 라인 화면에서만
    const rail = $('rail'), p = g.me, show = laneOn() && !vp && !g.over;
    rail.hidden = !show;
    if (show) {
      const tick = Object.values(p.tickets).reduce((a, b) => a + b, 0), autoOn = ['t1', 't2', 't3'].every((k) => p.auto[k]);
      const cheap = T.upgrades.filter((u) => (p.upgrades[u.id] || 0) < g.upMax(p, u)).map((u) => g.upgradeCost(p, u)).sort((a, b) => a - b)[0];
      const btn = (act, arg, ic, label, extra, cls) => `<button class="rb ${cls || ''}" data-act="${act}" data-arg="${arg}" type="button"><i class="rc">${rIcon(ic)}</i><span>${label}</span>${extra || ''}</button>`;
      const cur = (k) => (S.drawer === k ? 'cur' : '');
      const r = btn('drawer', 'upgrade', 'upgrade', t('upgrade'), cheap != null && p.gold >= cheap ? '<span class="dot">!</span>' : '', cur('upgrade'))
        + btn('drawer', 'sage', 'sage', `${t('sage')} ${g.sagesOf(p).length}/${g.sageMax()}`, '', cur('sage'))
        + btn('drawer', 'ticket', 'ticket', t('ticket'), tick ? `<span class="dot">${tick}</span>` : '', cur('ticket'))
        + btn('drawer', 'war', 'war', t('war'), '', cur('war'))
        + btn('autoAll', '', 'auto', autoOn ? t('autoOn') : t('autoOff'), '', autoOn ? 'on' : '');
      if (rail.dataset.html !== r) { rail.innerHTML = r; rail.dataset.html = r; }
    }
    const mb = $('menubtn'), mh = rIcon('menu');
    if (mb.dataset.html !== mh) { mb.innerHTML = mh; mb.dataset.html = mh; }
    // 서랍
    const dr = $('drawer');
    if (dr.hidden !== !S.drawer) dr.hidden = !S.drawer;
    const war = S.tab === 'war';
    if ($('timers').hidden !== !war) $('timers').hidden = !war;
    if ($('pane').hidden !== war) $('pane').hidden = war;
  }
  function renderOverlay() {
    const box = $('overlay');
    let h = '', key = '';
    // 일기토(협동): 대장전처럼 먼저 나갈 사람을 자진 신청받는다
    let vol = '', volKey = '';
    if (g.phase === 'bossPick' && g.mut.relay && net && net.volunteers) {
      const vs = net.volunteers(), mine = vs.some((p) => p.me);
      volKey = 'v' + vs.map((p) => p.id).join();
      vol = `<div class="line" style="margin:8px 0;padding:8px;border:1px solid #ffd86a55;background:#ffd86a12"><b style="color:#ffd86a">${I.t('volHead')}</b> <small>${I.t('volHint')}</small><br>
        <button class="btn ${mine ? '' : 'go'}" data-act="volunteer" type="button" ${mine ? 'disabled' : ''}>${I.t(mine ? 'volDone' : 'volBtn')}</button> <small>${I.t('volList', { a: vs.length ? vs.map((p) => esc(p.state.name)).join(', ') : I.t('none') })}</small></div>`;
    }
    if (S.paused && !g.over) {
      key = 'paused'; h = `<div class="over"><div class="sheet" style="width:min(380px,100%);align-items:center;text-align:center"><h2>${t('paused')}</h2><div>${t('pausedHint')}</div><button class="btn go" data-act="resume" type="button" style="padding:10px 26px">${t('resume')}</button></div></div>`;
    } else if (g.phase === 'bossPick' && g.fight && !g.fight.picked) {
      const ch = g.pickChoices(), n = g.slotCount(), f = g.fight;
      key = 'p' + S.pick.join() + ch.length + Math.ceil(f.pickT) + volKey;
      h = `<div class="over"><div class="sheet"><h2>${t('pickTitle')}</h2>${vol}<div>${I.t('pickInfo', { title: esc(f.def.title), name: esc(f.def.name), t: clock(f.limit), n, s: Math.ceil(f.pickT) })}<br><span style="color:var(--dim)">${I.t('recommendColon', { a: advise(g.bossStats(f.def).hp / (f.def.time * 0.45), n) })}</span></div>
        <div class="grid">${ch.map((u) => `<button class="pickcard ${S.pick.includes(u.id) ? 'on' : ''}" data-act="pick" data-arg="${u.id}" type="button"><img class="pcpor" alt="" src="${Art.portrait(u.def)}"><strong style="color:${tierColor(u.def.tier)}">${esc(u.def.name)}</strong> ${roleBadge(u.def)}<small>${I.t('pickCard', { r: rankName(u.def.tier), a: fmt(g.unitAtk(u)), h: fmt(g.rankOf[u.def.tier].hp) })}${u.def.sk ? I.t('skillsList', { a: u.def.sk.map((s) => esc(s.n)).join('·') }) : ''}</small>${(u.def.p || []).length ? `<small class="pp">${u.def.p.map((x) => `<b>${esc(x.name)}</b> ${esc(x.desc)}`).join('<br>')}</small>` : ''}</button>`).join('')}</div>
        <button class="btn go" data-act="pickGo" type="button" style="padding:9px">${t('deploy')} (${S.pick.length}/${n})</button></div></div>`;
    } else if (g.phase === 'bossPick') {
      h = `<div class="over"><div class="sheet"><h2>${t('waitAllies')}</h2>${vol}</div></div>`; key = 'w' + volKey;
    } else if (S.ticket != null && laneOn()) {
      const ids = g.tierIds(S.ticket), left = g.me.tickets[S.ticket] || 0;
      key = 't' + S.ticket + left;
      // 전투를 가리지 않도록 패널 안에서 고른다
      const sh = `<div class="h">${I.t('ticketN', { r: rankName(S.ticket) })} ${I.t('nSheets', { n: left })}</div>` + ids.map((id) => `<div class="row"><img class="tpor" alt="" src="${Art.portrait(defOf[id])}"><div>${esc(defOf[id].name)} <small>${I.t('owned', { n: g.ownedOf(g.me, id).length })}</small></div><button class="btn" data-act="ticketPick" data-arg="${id}" type="button">${I.t('pick')}</button></div>`).join('') + `<button class="btn" data-act="ticketClose" type="button">${I.t('close')}</button>`;
      const pane = $('pane'); pane.innerHTML = sh; pane.dataset.html = sh;
      h = ''; key = '';
    } else if (net && net.kicked) {
      key = 'k'; h = `<div class="over"><div class="sheet"><h2>${t('kicked')}</h2><div>${t('kickedHint')}</div><button class="btn go" data-act="restart" type="button" style="padding:9px 20px">${t('toTitle')}</button></div></div>`;
    } else if (net && net.clock.pz && !g.over) {
      key = 'z' + net.clock.pz; h = `<div class="over"><div class="sheet"><h2>${I.t('waitTitle')}</h2><div>${I.t('waitPz', { a: esc(net.clock.pz) })}</div></div></div>`;
    } else if (g.over) {
      if (S.drawer) { S.drawer = null; $('drawer').hidden = true; } // 오른쪽 서랍이 결과·경험치 연출을 가리지 않게
      // 온라인 판은 경험치 연출이 끝난 뒤 결과창(서버 답이 4초 넘게 없으면 그냥 결과창)
      const waitXp = S.online && ACC.token && !S.xpDone && (S.xpPlaying || (S.xpGained == null && performance.now() - (S.overAt || (S.overAt = performance.now())) < 4000));
      if (waitXp) { key = 'ox'; h = '<div class="over xpwait"></div>'; }
      else { key = 'o' + (S.xpGained != null ? S.xpGained : ''); h = endStats(); }
    }
    if (box.dataset.key !== key) { box.innerHTML = h; box.dataset.key = key; }
    $('backbtn').hidden = !viewedPeer();
    renderHud();
    const sbar = $('selbar'), boss = inBoss() && g.phase === 'boss' && !!g.fight;
    const selVis = !g.over && (boss || (laneOn() && (S.sel.length > 0 || !!S.dropSel || !!(viewedPeer() && S.rsel))));
    if (sbar.hidden !== !selVis) sbar.hidden = !selVis;
    sbar.classList.toggle('boss', boss); sbar.classList.toggle('exp', !!S.selExp);
    renderSkillBar();
    renderSyn();
    // 배속: 게임판 오른쪽 위. 보스 결투장은 항상 1배속이라 숨긴다. 협동은 모두 켜야 적용된다.
    const sb = $('speedbtn'), st = g.over || g.phase !== 'wave' ? '' : `${t('speed', { n: speed })}${net && net.clock.sp !== speed ? ` (×${net.clock.sp})` : ''}`;
    if (sb.dataset.t !== st) { sb.textContent = st; sb.dataset.t = st; sb.hidden = !st; sb.title = net ? I.t('speedTip') : ''; }
    if (g.phase !== 'boss') S.laneView = false;
    const bb = $('bossbtn'), bt = g.phase === 'boss' ? (S.laneView ? `${t('backToBoss')} · ${clock(Math.max(0, g.fight.limit - g.fight.t))}` : t('toLane')) : '';
    if (bb.dataset.t !== bt) { bb.textContent = bt; bb.dataset.t = bt; bb.hidden = !bt; bb.classList.toggle('go', !!S.laneView); }
  }
  function drainEvents() {
    for (const e of g.events) {
      if (e.type === 'sfx') { Snd.play(e.s, e.gap); continue; }
      if (e.type === 'toast') toast(e.text, e.tone);
      else if (e.type === 'pop') { queuePop(e.def, e.who || (net ? net.name : null)); if (e.def.tier >= 9 && g.phase !== 'boss') S.freeze = (S.freeze || 0) + POP_DUR[e.def.tier]; if (net && !e.remote) net.send('pop', { id: e.def.id, name: net.name }); }
      else if (e.type === 'round') { Snd.play('round'); saveGame(); }
      else if (e.type === 'bossIntro') { Snd.play('gong'); Snd.setBoss(true); }
      else if (e.type === 'over') { Snd.play(e.win ? 'win' : 'lose'); Snd.setBoss(false); reportResult(); if (window.RTD_LOBBY) window.RTD_LOBBY.recordGame(g, S.online, net ? 'room' : bots.length ? 'ai' : 'solo'); if (S.saveOn) { try { localStorage.removeItem('rtd-save'); } catch (er) { /* 저장 불가 */ } } }
      else if (e.type === 'banner') S.banner = { text: e.text, sub: e.sub, t: 3 };
      else if (e.type === 'dmgtext') {
        // 숫자가 같은 자리에 겹쳐 안 읽히지 않게 조금씩 흩어 놓는다
        if (S.dmg.length < 40) S.dmg.push({ x: e.x + (typeof e.v === 'number' && g.phase === 'boss' ? (Math.random() - 0.5) * 90 : 0), y: e.y - (typeof e.v === 'number' && g.phase === 'boss' ? Math.random() * 30 : 0), v: e.v, big: e.big != null ? e.big : g.phase === 'boss', t: 0 });
        // 보스전 강타: 짧게 멈칫(혼자 할 때만 실제로 시간이 멈춤) + 카메라가 순간 다가감
        // 스킬 이름 글자(문자열)는 타격이 아니므로 멈칫하지 않는다(치료·강화 스킬에도 화면이 멈칫하던 문제)
        if (g.phase === 'boss' && typeof e.v === 'number') { if (!net) S.hitStop = 0.07; S.punch = 1; S.shake = Math.max(S.shake || 0, 0.5); Snd.play('hit', 90); if (navigator.vibrate && e.big !== false) navigator.vibrate(10); }
      }
      else if (e.type === 'proc') {
        // 패시브 발동: 이름을 크게 띄우고 유닛·대상에 터지는 효과
        if (S.dmg.length < 60) S.dmg.push({ x: e.x, y: e.y - (e.lane ? 46 : 78), v: e.names.join(' · ') + '!', proc: true, c: e.c, t: 0 });
        if (e.lane) {
          g.fx.push({ k: 'ring', x: e.x, y: e.y, r: 44, t: 0, life: 0.4, c: e.c }, { k: 'spark', x: e.tx, y: e.ty - 10, t: 0, life: 0.3, c: '#fff6c8', r: 46, a: Math.atan2(e.ty - e.y, e.tx - e.x) });
        } else {
          addVfx({ k: 'shock', x: e.x, y: e.y + 10, r: 90, life: 0.45, c: e.c, w: 8 });
          addVfx({ k: 'img', img: 'hit', x: e.tx, y: e.ty - 20, r: 150, life: 0.35 });
          for (let i = 0; i < 8; i++) addVfx({ k: 'spark', x: e.tx, y: e.ty - 20, a: rnd(0, 7), s: rnd(120, 260), life: rnd(0.2, 0.35), c: '#fff6c8' });        }
      }
      else if (e.type === 'shake') S.shake = Math.max(S.shake || 0, e.v);
      else if (e.type === 'pattern') {
        S.pattern = { name: e.name, t: 1.6 };
        // 조각 애니메이션 보스의 기술 동작: 기술 이름으로 종류(gen)를 찾아 전방위·소환·겨누기 중 하나로(협동 손님도 이름으로 찾는다)
        const fp = g.fight && g.fight.def.patterns && g.fight.def.patterns.find((q) => q.n === e.name);
        if (window.RTD_RIG) S.bossAct = window.RTD_RIG.actOf(fp ? fp.gen : '');
      }
      else if (e.type === 'achievement') { toast(I.t('achDone', { a: e.ach.name }), 'good'); Snd.play('ach'); S.banner = { text: e.ach.name, sub: e.ach.desc, t: 2.6 }; }
      else if (e.type === 'champDead') toast(I.t('champDown', { a: e.name }), 'warn');
      // 장수 스킬 이름은 이미 장수 머리 위에 크게 뜬다. 알림 줄까지 띄우면 보스 기술 이름(피해야 할 경고)을 가려서, 화타 치료 같은 것만 알림으로 보인다.
      else if (e.type === 'skill') { if (!(g.fight && g.fight.champs.some((c) => (c.def.sk || []).some((s) => s.n === e.name)))) toast(e.name); }
      else if (e.type === 'bossPick') { S.pick = []; setSel([]); }
      else if (e.type === 'bossWin') { const rows = meterRows(e.dealt, e.total); (S.bossRows = S.bossRows || {})[e.boss.round] = rows; Snd.setBoss(false); Snd.play('win'); popQ.push({ vic: e, rows, t: 0, dur: 5.5, hits: {}, shake: 0 }); }
      else if (e.type === 'bossFail') { if (g.fight) (S.bossRows = S.bossRows || {})[g.fight.def.round] = meterRows(g.fight.dealt, g.fight.total); }
      else if (e.type === 'removed') { S.sel = S.sel.filter((i) => i !== e.id); }
      else if (e.type === 'dropGone') { if (S.dropSel === e.id) S.dropSel = null; }
      dirty();
    }
    g.events.length = 0;
  }

  // ---- 메인 루프 ----
  let last = 0, acc = 0, hub = null, bots = [];
  function saveGame() {
    if (!S.saveOn || !g || g.over) return;
    const s = g.snapshot();
    if (s) { try { localStorage.setItem('rtd-save', JSON.stringify(s)); } catch (e) { /* 저장 공간 없음 */ } }
  }
  function lifeOffline() { return !net || net.t.kind === 'hub'; }
  document.addEventListener('visibilitychange', () => {
    if (!g || g.over) return;
    if (document.hidden) { S.hiddenAt = Date.now(); if (lifeOffline()) S.paused = true; saveGame(); }
    else {
      if (!lifeOffline() && S.hiddenAt && Date.now() - S.hiddenAt > 60000) { net.kicked = true; try { net.leave(); } catch (e) { /* 이미 끊김 */ } }
      S.hiddenAt = 0; last = performance.now(); dirty();
    }
  });
  function tick(now, cap) {
    if (S.paused || S.tutHold) { last = now; acc = 0; return; } // 튜토리얼 설명 중에도 멈춘다
    padTick();
    const dt = Math.max(0, Math.min(cap, (now - last) / 1000)) || 0; last = now; // 시계가 거꾸로 가거나 값이 깨져도 계산이 멈추지 않게
    if (!(acc >= 0)) acc = 0;
    // 신화·불멸 컷신 동안은 시간이 멈추고, 보스전은 항상 1배속이다
    const held = net && (net.clock.pz || net.kicked);
    if (S.freeze > 0) { S.freeze -= dt; acc = 0; }
    else if (S.hitStop > 0) { S.hitStop -= dt; acc = 0; } // 강타 히트스톱(혼자 할 때만)
    else if (held) acc = 0;
    else {
      // 보스전은 1배속. 협동 배속은 방장이 정한 값(모두 켰을 때만 2배 이상)을 쓴다.
      acc += dt * (g.phase !== 'wave' ? 1 : net ? net.clock.sp : speed);
      // 혼자(또는 AI와) 하는 보스전은 계산을 초당 60번으로 한다: 30번이면 조이스틱을 민 뒤 최대 한 프레임 늦게 움직여 굼떠 보인다.
      // 협동은 서로 같은 간격으로 계산해야 하므로 30번 그대로.
      const h = !net && g.phase === 'boss' ? 1 / 60 : 1 / 30;
      let n = 0;
      while (acc >= h && n < 40) { if (hub) hub.flush(); g.step(h); bots.forEach((b) => b.g.step(h)); acc -= h; n++; }
      if (acc > 0.3) acc = 0;
    }
    if (net) net.tickStatus(dt, g);
    bots.forEach((b) => {
      b.net.speedWant = net.speedWant;
      b.net.tickStatus(dt, b.g);
      if (!held && !(S.freeze > 0)) b.brain.update(dt);
      // AI도 사람처럼 높은 등급 등장을 알린다. 남에게서 받은 알림(remote)을 다시 보내면 AI끼리 끝없이 주고받아 멈추므로 자기 것만 보낸다.
      b.g.events.forEach((e) => { if (e.type === 'pop' && !e.remote) b.net.send('pop', { id: e.def.id, name: b.net.name }); });
      b.g.events.length = 0;
    });
    if (hub) hub.flush();
    drainEvents();
  }
  // 협동 중에는 탭이 뒤로 가도 시뮬레이션이 멈추면 안 된다
  // 협동 중에는 탭이 뒤로 가도 멈추지 않게 워커 타이머로 돌린다(백그라운드 타이머 제한을 받지 않는다)
  try {
    const tw = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 100)'], { type: 'text/javascript' })));
    tw.onmessage = () => { if (g && g.mode === 'multi' && performance.now() - last > 150) tick(performance.now(), 0.5); };
  } catch (e) {
    setInterval(() => { if (g && g.mode === 'multi' && performance.now() - last > 240) tick(performance.now(), 1); }, 250);
  }
  let lastDraw = 0;
  // 성능 표시(설정에서 켠다): 초당 프레임, 가장 길었던 프레임 간격, 계산·그리기 시간, 화면에 있는 것의 수.
  // 그리기 시간은 명령을 내보내는 데 든 시간이라, 그래픽 칩이 실제로 칠하는 시간은 '프레임'과 '최장'으로 본다.
  const PF = { n: 0, t0: 0, sim: 0, draw: 0, worst: 0, prev: 0, wj: 0 };
  function perfMark(now, p0, p1) {
    const el = $('perf');
    if (!Q.perf) { if (el && !el.hidden) el.hidden = true; return; }
    const p2 = performance.now();
    PF.n++; PF.sim += p1 - p0; PF.draw += p2 - p1; PF.wj = Math.max(PF.wj, p2 - p0); // wj: 한 프레임에서 코드가 쓴 시간의 최댓값
    if (PF.prev) PF.worst = Math.max(PF.worst, now - PF.prev);
    PF.prev = now;
    if (!PF.t0) PF.t0 = now;
    if (now - PF.t0 < 500) return;
    const fps = (PF.n * 1000) / (now - PF.t0), f = g.fight;
    // 글자는 언어와 상관없는 약어: U 유닛, E 적, HZ 장판, FX 연출
    const things = inBoss() && f ? `HZ ${f.hazards.length} · FX ${S.vfx.length + g.fx.length}` : `U ${g.units.length} · E ${g.enemies.length} · FX ${g.fx.length}`;
    el.hidden = false;
    el.textContent = `${fps.toFixed(0)}fps · max ${PF.worst.toFixed(0)}ms (js ${PF.wj.toFixed(0)})
sim ${(PF.sim / PF.n).toFixed(1)} · draw ${(PF.draw / PF.n).toFixed(1)}ms
${things}
${view.width}×${view.height} · ${Q.level}${Q.rs < 1 ? " " + Math.round(Q.rs * 100) + "%" : ""}${bots.length ? ' · AI ' + bots.length : ''}${net && !bots.length ? ' · NET' : ''}`;
    PF.n = 0; PF.t0 = now; PF.sim = 0; PF.draw = 0; PF.worst = 0; PF.wj = 0;
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (!g) return;
    // 30fps 제한: 배터리·발열용. 시뮬레이션은 흐른 시간만큼 따라잡는다.
    if (Q.fps30 && now - lastDraw < 30) return;
    // 120Hz 화면에서도 60번만 그린다(두 배로 그려 봐야 발열·끊김만 늘어난다)
    if (now - lastDraw < 14) return;
    lastDraw = now;
    const p0 = Q.perf ? performance.now() : 0;
    tick(now, 0.1);
    const p1 = Q.perf ? performance.now() : 0;
    render(now);
    perfMark(now, p0, p1);
    if (S.saveOn && now - (S.saveT || 0) > 10000) { S.saveT = now; saveGame(); }
    if (now - lastDom > 180 || needs) {
      lastDom = now; needs = false;
      renderPane(); renderInfo(); renderTimers(); renderOverlay();
    }
  }
  function begin(opt) {
    if (window.RTD_LOBBY) window.RTD_LOBBY.close();
    $('title').hidden = true; $('title').style.display = 'none';
    I.applyDom($('app'));
    $('app').hidden = false;
    fit();
    // AI 동맹: 나와 AI 사령관들을 가상 방에 넣고, AI마다 자기 라인을 따로 돌린다(방 협동과 같은 규칙)
    if (opt.ai) {
      hub = window.RTD_NET.hub();
      opt.net = hub.join(myName());
      opt.mode = 'multi'; opt.seed = opt.seed || (Math.random() * 1e9) | 0;
      const pool = window.RTD_AI.BUILDS.slice();
      bots = [];
      for (let i = 0; i < opt.ai; i++) {
        const b = pool.splice((Math.random() * pool.length) | 0, 1)[0], bn = hub.join('AI ' + b.name);
        const bg = new E.Game(T, { diff: opt.diff, mode: 'multi', seed: opt.seed + i + 1, net: bn, bot: true, muts: opt.muts, mutLv: opt.mutLv });
        bn.attach(bg);
        bots.push({ g: bg, net: bn, brain: new window.RTD_AI.Brain(bg, b) });
      }
    }
    g = opt.snap ? E.Game.restore(T, opt.snap) : new E.Game(T, opt);
    // 오프라인 혼자 하기만 자동 저장한다(앱이 꺼져도 이어하기)
    S.saveOn = !opt.online && !opt.ai && !opt.net && (opt.mode || 'solo') === 'solo'; S.saveT = 0;
    S.online = !!opt.online; S.gameKey = opt.key || null; S.reported = false; S.xpGained = null; S.xpDone = false; S.xpPlaying = false; S.overAt = 0; S.paused = false;
    if (opt.net) { net = opt.net; net.onLobby = null; net.attach(g); speed = 1; }
    Snd.init();
    S.tutHold = false;
    // 첫 오프라인 혼자 하기(이어하기 제외)에서 튜토리얼
    // 자동 배치(1~3성 자동 합성·정렬)는 기본으로 켠다. 직접 끈 사람은 그 선택을 기억한다('rtd-auto').
    // 튜토리얼 판은 자동 버튼을 가르치려고 꺼 둔 채 시작하고, 건너뛰면 켠다.
    const autoOnAll = () => ['t1', 't2', 't3'].forEach((k) => g.setAuto(g.me, k, true));
    let autoPref = true; try { autoPref = localStorage.getItem('rtd-auto') !== '0'; } catch (e) { /* 저장 불가 */ }
    const tutOn = !!(window.RTD_TUT && S.saveOn && !opt.snap && window.RTD_TUT.maybeStart({ get g() { return g; }, S, t: I.t, onSkip: () => { autoOnAll(); toast(t('autoToastOn'), 'good'); dirty(); } }));
    if (!opt.snap && !tutOn && autoPref) autoOnAll();
    window.__rtd = { g, S, begin, net, bots, xp: playXp, frame: (now) => { tick(now, 0.1); render(now); renderPane(); renderInfo(); renderTimers(); renderOverlay(); }, tick, render, dom: () => { renderPane(); renderInfo(); renderTimers(); renderOverlay(); } };
    view.focus({ preventScroll: true });
    last = performance.now();
  }

  // ---- 계정(온라인) ----
  const API = window.RTD_API || '';
  const ACC = (() => { try { return JSON.parse(localStorage.getItem('rtd-acc') || 'null'); } catch (e) { return null; } })() || { token: null, me: null };
  const saveAcc = () => { try { localStorage.setItem('rtd-acc', JSON.stringify(ACC)); } catch (e) { /* 저장 불가 */ } };
  async function api(path, body) {
    try {
      const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, ACC.token ? { Authorization: 'Bearer ' + ACC.token } : {}), body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 && !/^\/api\/(login|delete|guest\/login|auth\/)/.test(path)) { ACC.token = null; ACC.me = null; saveAcc(); }
      return Object.assign({ status: r.status }, j);
    } catch (e) { return { status: 0, error: 'net' }; }
  }
  const errText = (e) => (e === 'net' ? t('noServer') : t('err_' + e) !== 'err_' + e ? t('err_' + e) : String(e || ''));
  const xpLv = (lv) => 40 * (lv - 1) * (lv - 1);
  // 게스트 비밀값(이 기기에만): 토큰이 만료돼도 다시 들어온다
  const GUEST = (() => { try { return JSON.parse(localStorage.getItem('rtd-guest') || 'null'); } catch (e) { return null; } })();
  const saveGuest = (g2) => { try { if (g2) localStorage.setItem('rtd-guest', JSON.stringify(g2)); else localStorage.removeItem('rtd-guest'); } catch (e) { /* 저장 불가 */ } };
  const gradeTag = (st) => (st && st.gr ? `<span class="gr">${esc(t(st.gr))} ${t('level', { n: st.lv })}</span>` : '');
  // 판이 끝나면 온라인 판 결과를 서버에 보내 경험치를 받는다(같은 판은 한 번만)
  async function reportResult() {
    if (!S.online || !ACC.token || S.reported) return;
    S.reported = true;
    const r = await api('/api/result', { myth: g.stats.myth || {}, st: window.RTD_LOBBY ? window.RTD_LOBBY.statsOf(g) : {}, mode: net ? 'room' : 'solo', key: S.gameKey, party: S.gameKey, diff: g.diff.id, round: g.round, win: g.over === 'win', mutLv: g.mutLv || 0, time: Math.round(g.time), imm: g.stats.imm || {} });
    if (r.me) {
      ACC.me = r.me; saveAcc(); S.xpGained = r.gained;
      if (r.gained > 0) { S.xpPlaying = true; playXp(r.me.xp - r.gained, r.me.xp, r.coins, () => { S.xpPlaying = false; S.xpDone = true; dirty(); $('overlay').dataset.key = ''; }); }
      dirty(); const box = $('overlay'); box.dataset.key = '';
    }
  }
  // 광고: 두 판에 한 번(시제품은 자리만). 실제 앱에서는 광고 SDK로 바꾼다.
  function adThen(next) {
    let n = 0;
    try { n = +(localStorage.getItem('rtd-games') || 0) + 1; localStorage.setItem('rtd-games', String(n)); } catch (e) { n = 1; }
    if (n % 2) { next(); return; }
    // 앱에서는 AdMob 전면 광고, 웹·광고 준비 안 됨이면 아래 자리 표시
    if (window.RTD_NATIVE && window.RTD_NATIVE.on) { if (!window.RTD_NATIVE.interstitial(next)) next(); return; }
    const ov = $('adover'), btn = $('adclose');
    ov.hidden = false; let left = 5;
    const tickAd = () => { btn.disabled = left > 0; btn.textContent = left > 0 ? t('adSkip', { n: left }) : t('adClose'); left--; if (left >= -1) setTimeout(tickAd, 1000); };
    tickAd();
    btn.onclick = () => { if (!btn.disabled) { ov.hidden = true; next(); } };
  }

  // ---- 시작 화면 ----
  const cfg = { diff: 'easy', mode: 'solo', ai: '2', mutLv: '0', muts: [], play: 'offline', accTab: 'login', showRank: false };
  try { const p = localStorage.getItem('rtd-play'); if (p === 'online' || p === 'offline') cfg.play = p; } catch (e) { /* 저장 불가 */ }
  // 악몽 +N: 규칙 N개를 겹치지 않게 무작위로 고른다
  const rollMuts = () => { const pool = (T.mutators || []).map((m) => m.id); cfg.muts = []; for (let i = 0; i < +cfg.mutLv && pool.length; i++) cfg.muts.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]); };
  const mutCard = (id, i) => { const m = T.mutators.find((x) => x.id === id); return m ? `<div class="mut"><span class="n">${i + 1}</span><b>${esc(m.name)}</b><div class="gb"><span class="g">＋ ${esc(m.good)}</span><span class="bd">－ ${esc(m.bad)}</span></div></div>` : ''; };
  const DIFF_COL = { easy: '#7fd08a', normal: '#6fb7ff', hard: '#ffb347', nightmare: '#ff5a5a' };
  const myName = () => (ACC.me && cfg.play === 'online' ? ACC.me.nick : t('solo'));
  function setupTitle() {
    I.applyDom();
    $('gametitle').textContent = T.title;
    const hc = $('herocv'), hx = hc.getContext('2d');
    hc.width = 1600; hc.height = 900; if (window.RTD_PALACE) window.RTD_PALACE.paint(hc); else paintMap(hx, W, H);
    $('langsel').innerHTML = I.LANGS.map(([k, n]) => `<option value="${k}" ${I.lang === k ? 'selected' : ''}>${n}</option>`).join('');
    $('langsel').onchange = (e) => I.setLang(e.target.value);
      let lobby = null;
    // 계정: Apple·Google·게스트. 처음 가입할 때만 닉네임과 약관 동의를 받는다.
    const pum = (rk) => (rk >= 1 && rk <= 9 ? ' <small>' + t('rankPum', { n: 10 - rk }) + '</small>' : '');
    const accHtml = () => {
      const link = (k, p) => `<a href="${API}/${p}?lang=${I.lang}" target="_blank" rel="noopener">${t(k)}</a>`;
      const N = window.RTD_NATIVE, app = !!(N && N.on);
      if (!ACC.token || !ACC.me) {
        return `<div class="acc-form"><input id="acc-nick" maxlength="12" placeholder="${esc(t('nickFirst'))}">
          <label class="agree"><input id="acc-agree" type="checkbox"><span>${t('agree', { terms: link('terms', 'terms'), privacy: link('privacy', 'privacy') })}</span></label>
          <button class="btn sso apple" data-sso="apple" type="button" ${app ? '' : 'disabled'}>${t('loginApple')}</button>
          <button class="btn sso google" data-sso="google" type="button" ${app ? '' : 'disabled'}>${t('loginGoogle')}</button>
          ${app ? '' : `<div class="hint2">${t('appOnly')}</div>`}
          <button class="btn go" id="acc-guest" type="button">${t('loginGuest')}</button>
          <div class="err" id="acc-err"></div></div>`;
      }
      const m = ACC.me, lv = m.level, max = m.rank >= 10, f = max ? 1 : Math.max(0, Math.min(1, (m.xp - xpLv(lv)) / Math.max(1, xpLv(lv + 1) - xpLv(lv))));
      const guest = m.provider === 'guest', prov = m.provider === 'apple' ? 'Apple' : m.provider === 'google' ? 'Google' : guest ? t('provGuest') : '';
      return `<div class="acc-card"><span class="badge">${lv}</span><div><b>${esc(m.nick)}</b> <span class="gr">${esc(t(m.grade))}${pum(m.rank)} ${t('level', { n: lv })}</span> <small class="prov">${esc(prov)}</small></div><div class="xpbar"><i style="width:${(f * 100).toFixed(1)}%"></i></div></div>
        <div class="hint2">${t('gamesWins', { g: m.games, w: m.wins })} · XP ${fmt(m.xp)}</div>
        <div class="acc-track"><span>${t('trackHead')}</span><button class="${m.track !== 'civ' ? 'on' : ''}" data-track="mil" type="button">${t('trackMil')}</button><button class="${m.track === 'civ' ? 'on' : ''}" data-track="civ" type="button">${t('trackCiv')}</button></div>
        ${guest ? `<div class="acc-link"><b>${t('linkHead')}</b><div class="hint2">${t('linkHint')}</div><div class="acc-btns"><button class="btn sso apple" data-sso="apple" data-link="1" type="button" ${app ? '' : 'disabled'}>${t('loginApple')}</button><button class="btn sso google" data-sso="google" data-link="1" type="button" ${app ? '' : 'disabled'}>${t('loginGoogle')}</button></div></div>` : ''}
        <div class="acc-btns"><button class="btn" id="acc-rank" type="button">${t('ranking')}</button><button class="btn" id="acc-nickbtn" type="button">${t('nickEdit')}</button><button class="btn" id="acc-out" type="button">${t('logout')}</button><button class="btn warn" id="acc-del" type="button">${t('deleteAcc')}</button></div>
        <div id="acc-nickbox" hidden><div class="inline"><input id="acc-nick2" maxlength="12" value="${esc(m.nick)}"><button class="btn" id="acc-nicksave" type="button">${t('save')}</button></div></div>
        <div id="acc-delbox" hidden><div class="hint2">${t('delConfirmSso')}</div><div class="inline">${m.provider === 'password' ? `<input id="acc-delpw" type="password" placeholder="${esc(t('accPw'))}">` : ''}<button class="btn warn" id="acc-delgo" type="button">${t('delYes')}</button></div></div>
        <div class="err" id="acc-err"></div><div class="rank-list" id="acc-ranklist"></div>`;
    };
    // 위저드에서 아직 고르지 않은 항목은 선택 표시를 하지 않는다
    const pk = (k) => !window.RTD_LOBBY || !window.RTD_LOBBY.picked || window.RTD_LOBBY.picked(k);
    const dr = () => {
      const on = cfg.play === 'online';
      $('playmode').innerHTML = [['offline', t('offline')], ['online', t('online')]].map(([k, n]) => `<button class="${cfg.play === k && pk('play') ? 'on' : ''}" data-cfg="play" data-v="${k}" type="button">${n}</button>`).join('');
      $('playhint').textContent = t(on ? 'onlineHint' : 'offlineHint');
      $('accbox').hidden = false; // 계정 상자는 로비의 계정 창에 들어간다
      refreshAcc();
      const ready = !on || (ACC.token && ACC.me);
      ['diffsec', 'modesec'].forEach((id) => ($(id).hidden = !ready));
      $('diffs').innerHTML = T.difficulties.map((d) => `<button class="${cfg.diff === d.id && pk('diff') ? 'on' : ''}" data-cfg="diff" data-v="${d.id}" type="button" style="--dc:${DIFF_COL[d.id] || '#c99a2e'}">${d.name}${d.id === 'nightmare' && +cfg.mutLv ? ` +${cfg.mutLv}` : ''}<small>${t('rounds', { n: d.rounds, m: d.mult })}</small></button>`).join('');
      const nm = cfg.diff === 'nightmare' && ready;
      $('mutbox').hidden = !nm;
      if (nm) {
        $('mutlv').innerHTML = [0, 1, 2, 3, 4, 5].map((n) => `<button class="${+cfg.mutLv === n ? 'on' : ''}" data-cfg="mutLv" data-v="${n}" type="button">${n ? '+' + n : t('base')}</button>`).join('') + (+cfg.mutLv ? `<button class="btn reroll" id="mutroll" type="button">${t('reroll')}</button>` : '');
        $('mutrules').innerHTML = cfg.muts.map(mutCard).join('');
      }
      // 오프라인: 단독·AI 동맹 / 온라인: 단독(기록)·방 협동
      const modes = on ? [['quick', t('lb_quick'), t('lb_quickSub')], ['create', t('lb_create'), t('lb_createSub')], ['join', t('lb_join'), t('lb_joinSub')]] : [['solo', t('solo'), t('soloSub')], ['ai', t('aiAlly'), t('aiAllySub')]];
      if (!modes.some(([k]) => k === cfg.mode)) cfg.mode = modes[0][0];
      $('modes').innerHTML = modes.map(([k, n, s]) => `<button class="${cfg.mode === k && pk('mode') ? 'on' : ''}" data-cfg="mode" data-v="${k}" type="button">${n}<small>${s}</small></button>`).join('');
      const isRoom = cfg.mode === 'create' || cfg.mode === 'join' || cfg.mode === 'multi';
      $('netbox').hidden = !(ready && isRoom);
      $('netbox').dataset.room = cfg.mode;
      $('aibox').hidden = !(ready && cfg.mode === 'ai');
      $('aicount').innerHTML = ['1', '2', '3', '4'].map((k) => `<button class="${cfg.ai === k ? 'on' : ''}" data-cfg="ai" data-v="${k}" type="button">${t('nAi', { n: k })}<small>${t('nPlayers', { n: +k + 1 })}</small></button>`).join('');
      const host = lobby && lobby.isHost();
      $('startbtn').hidden = !ready;
      let sv = null;
      try { sv = JSON.parse(localStorage.getItem('rtd-save') || 'null'); } catch (e) { sv = null; }
      const cb = $('contbtn'), showC = !on && sv && sv.v === 1;
      cb.hidden = !showC;
      if (showC) { const dn = (T.difficulties.find((d) => d.id === sv.diff) || {}).name || ''; cb.textContent = t('continueGame', { r: sv.round, d: dn }); cb.onclick = () => begin({ snap: sv, mode: 'solo', diff: sv.diff }); }
      $('startbtn').textContent = isRoom ? (!lobby ? t('joinFirst') : host ? t('startHost') : t('waitHost')) : t('start');
      $('startbtn').disabled = (isRoom && (!lobby || !host)) || !pk('diff') || (window.RTD_LOBBY && !window.RTD_LOBBY.diffOpen(cfg.diff, +cfg.mutLv));
      if (lobby && host) {
        const c = { diff: cfg.diff, mutLv: +cfg.mutLv, muts: cfg.muts }, k = JSON.stringify(c);
        if (lobby.sentCfg !== k) { lobby.sentCfg = k; lobby.t.presence({ cfg: c }); }
      }
      renderLobby();
      if (window.RTD_LOBBY) window.RTD_LOBBY.refresh();
    };
    function refreshAcc() { const ah = accHtml(); if ($('accbox').dataset.html !== ah) { $('accbox').innerHTML = ah; $('accbox').dataset.html = ah; bindAcc(); } }
    // 로비: 방 코드, 다섯 자리(이름·등급·방장 표시), 방장이 고른 설정
    const renderLobby = () => {
      const box = $('lobby');
      box.hidden = !lobby;
      if (!lobby) return;
      const r = lobby.roster(), hostCfg = r[0] && r[0].state.cfg;
      $('lbcode').textContent = lobby.code || '';
      $('lbnet').textContent = t('roomOnline');
      $('lbslots').innerHTML = Array.from({ length: 5 }, (_, i) => {
        const p = r[i];
        if (!p) return `<div class="lb-slot empty">${t('emptySeat')}</div>`;
        const nm = p.state.name || '?';
        return `<div class="lb-slot in ${p.me ? 'me' : ''}">${i === 0 ? `<span class="host">★ ${t('host')}</span>` : ''}<span class="av">${esc(nm.slice(0, 1))}</span><span>${esc(nm)}${p.me ? ` (${t('me')})` : ''}</span>${gradeTag(p.state)}</div>`;
      }).join('');
      const hc = lobby.isHost() ? { diff: cfg.diff, mutLv: +cfg.mutLv, muts: cfg.muts } : hostCfg;
      const dn = hc ? (T.difficulties.find((d) => d.id === hc.diff) || {}).name : '';
      $('lbcfg').innerHTML = hc ? `${t('hostCfg')}: <b>${esc(dn || '')}${hc.mutLv ? ` +${hc.mutLv}` : ''}</b>${!lobby.isHost() && (hc.muts || []).length ? `<div style="display:grid;gap:4px;margin-top:5px">${hc.muts.map(mutCard).join('')}</div>` : ''}` : '';
    };
    const setErr = (e) => { const el = $('acc-err'); if (el) el.textContent = e ? errText(e) : ''; };
    const signedIn = (r) => { ACC.token = r.token; ACC.me = r.me; saveAcc(); $('accbox').dataset.html = ''; dr(); };
    function bindAcc() {
      const box = $('accbox');
      const nickIn = () => { const el = $('acc-nick'); return (el && el.value.trim()) || ''; };
      const agreed = () => { const el = $('acc-agree'); return !!(el && el.checked); };
      // 게스트: 이 기기에 비밀값이 있으면 그걸로, 없으면 새로 만든다
      const gb = $('acc-guest');
      if (gb) gb.onclick = async () => {
        setErr(''); gb.disabled = true;
        let r;
        if (GUEST && GUEST.id) { r = await api('/api/guest/login', { id: GUEST.id, secret: GUEST.secret }); if (r.status === 401) { saveGuest(null); GUEST.id = null; } }
        if (!r || !r.token) {
          if (!agreed()) { gb.disabled = false; setErr('need_agree'); return; }
          r = await api('/api/guest/new', { nick: nickIn() || t('guestNick', { n: 1000 + ((Math.random() * 9000) | 0) }), agree: true, termsVer: 1, lang: I.lang });
          if (r.guest) { saveGuest(r.guest); Object.assign(GUEST || {}, r.guest); }
        }
        gb.disabled = false;
        if (r.token) signedIn(r); else setErr(r.error);
      };
      // Apple·Google: 로그인 또는(게스트일 때) 연결
      box.querySelectorAll('[data-sso]').forEach((bt) => (bt.onclick = async () => {
        setErr('');
        const prov = bt.dataset.sso, link = !!bt.dataset.link;
        let s;
        try { s = await window.RTD_NATIVE.signIn(prov); } catch (e) { setErr(e.message === 'app_only' ? '' : e.message); if (e.message === 'app_only') { const el = $('acc-err'); if (el) el.textContent = t('appOnly'); } return; }
        const r = await api('/api/auth/' + prov, { idToken: s.idToken, link, nick: nickIn() || s.name || t('guestNick', { n: 1000 + ((Math.random() * 9000) | 0) }), agree: agreed(), termsVer: 1, lang: I.lang });
        if (!r.token) { setErr(r.error); return; }
        if (r.linked) saveGuest(null); // 연결된 게스트 비밀값은 더 쓰지 않는다
        signedIn(r);
        if (r.linked || (link && r.existed)) toastTitle(t(r.linked ? 'linked' : 'existed'));
      }));
      box.querySelectorAll('[data-track]').forEach((bt) => (bt.onclick = async () => { const r = await api('/api/track', { track: bt.dataset.track }); if (r.me) { ACC.me = r.me; saveAcc(); $('accbox').dataset.html = ''; dr(); } else setErr(r.error); }));
      const nb = $('acc-nickbtn'); if (nb) nb.onclick = () => { $('acc-nickbox').hidden = !$('acc-nickbox').hidden; };
      const ns = $('acc-nicksave'); if (ns) ns.onclick = async () => { const r = await api('/api/nick', { nick: $('acc-nick2').value.trim() }); if (r.me) { ACC.me = r.me; saveAcc(); $('accbox').dataset.html = ''; dr(); } else setErr(r.error); };
      const out = $('acc-out');
      if (out) out.onclick = async () => { const pv = ACC.me && ACC.me.provider; await api('/api/logout', {}); if (window.RTD_NATIVE && (pv === 'apple' || pv === 'google')) window.RTD_NATIVE.signOut(pv); ACC.token = null; ACC.me = null; saveAcc(); if (lobby) { lobby.leave(); lobby = null; } $('accbox').dataset.html = ''; dr(); };
      const del = $('acc-del');
      if (del) del.onclick = () => { $('acc-delbox').hidden = !$('acc-delbox').hidden; };
      const delgo = $('acc-delgo');
      if (delgo) delgo.onclick = async () => {
        const pw = $('acc-delpw'), pv = ACC.me && ACC.me.provider;
        const r = await api('/api/delete', pw ? { password: pw.value } : { confirm: 'DELETE' });
        if (r.ok) { if (pv === 'guest') saveGuest(null); ACC.token = null; ACC.me = null; saveAcc(); $('accbox').dataset.html = ''; dr(); toastTitle(t('deleted')); } else setErr(r.error);
      };
      const rk = $('acc-rank');
      if (rk) rk.onclick = async () => {
        const lb = $('acc-ranklist');
        if (lb.innerHTML) { lb.innerHTML = ''; return; }
        const r = await api('/api/ranking');
        lb.innerHTML = (r.top || []).slice(0, 20).map((p, i2) => `<div><span>${i2 + 1}</span><span>${esc(p.nick)} <span class="gr">${esc(t(p.grade))}</span></span><span>${t('level', { n: p.level })}</span></div>`).join('') || errText(r.error);
      };
    }
    const toastTitle = (txt) => { $('roster').textContent = txt; };
    // 로그인 상태 새로 받기(등급이 다른 기기에서 올랐을 수 있다)
    if (ACC.token) api('/api/me').then((r) => { if (r.me) { ACC.me = r.me; saveAcc(); } $('accbox').dataset.html = ''; dr(); });
    else if (GUEST && GUEST.id) api('/api/guest/login', { id: GUEST.id, secret: GUEST.secret }).then((r) => { if (r.token) signedIn(r); });
    document.addEventListener('click', (e) => {
      if (!$('title') || $('title').hidden) return;
      if (e.target.id === 'mutroll') { rollMuts(); dr(); return; }
      if (e.target.id === 'lbcopy' && lobby) { try { navigator.clipboard.writeText(lobby.code); e.target.textContent = t('copied'); } catch (er) { /* 복사 불가 환경 */ } return; }
      const b = e.target.closest('[data-cfg]');
      if (b) {
        cfg[b.dataset.cfg] = b.dataset.v;
        if (b.dataset.cfg === 'play') { try { localStorage.setItem('rtd-play', b.dataset.v); } catch (er) { /* 저장 불가 */ } if (lobby && b.dataset.v === 'offline') { lobby.leave(); lobby = null; } }
        if (b.dataset.cfg === 'diff' && b.dataset.v !== 'nightmare') cfg.mutLv = '0';
        if (b.dataset.cfg === 'mutLv' || b.dataset.cfg === 'diff') rollMuts();
        if (b.dataset.cfg === 'accTab') $('accbox').dataset.html = '';
        dr();
        if (window.RTD_LOBBY) window.RTD_LOBBY.onCfg(b.dataset.cfg);
      }
    });
    const join = async (code) => {
      if (!ACC.token) return;
      $('roster').textContent = t('connecting');
      const l = await window.RTD_NET.connect(code, ACC.me.nick, { token: ACC.token });
      if (l === 'full') { $('roster').textContent = t('roomFull'); return; }
      if (l === 'auth') { ACC.token = null; ACC.me = null; saveAcc(); $('accbox').dataset.html = ''; $('roster').textContent = t('err_auth'); dr(); return; }
      if (!l) { $('roster').textContent = t('noServer'); return; }
      lobby = l;
      $('code').value = code;
      lobby.code = code;
      $('roster').textContent = '';
      const show = () => dr();
      lobby.onLobby = show; show();
      lobby.onStart = (d) => begin({ diff: d.diff, mode: 'multi', seed: d.seed, net: lobby, muts: d.muts || [], mutLv: d.mutLv || 0, online: true, key: code + '-' + d.seed });
    };
    $('mk').onclick = () => join(Math.random().toString(36).slice(2, 7));
    document.addEventListener('pointerdown', () => { if (g) Snd.init(); });
    $('jn').onclick = () => { const c = $('code').value.trim().toLowerCase().replace(/[^a-z0-9]/g, ''); if (c) join(c); };
    $('startbtn').onclick = () => {
      const mm = cfg.diff === 'nightmare' ? { muts: cfg.muts.slice(), mutLv: +cfg.mutLv } : { muts: [], mutLv: 0 };
      const online = cfg.play === 'online';
      if (cfg.mode === 'multi' || cfg.mode === 'create' || cfg.mode === 'join') { if (lobby && lobby.isHost()) lobby.start(cfg.diff, mm); return; }
      if (cfg.mode === 'ai') { begin(Object.assign({ diff: cfg.diff, ai: +cfg.ai }, mm)); return; }
      begin(Object.assign({ diff: cfg.diff, mode: 'solo', online, key: online ? 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : null }, mm));
    };
    // 메인 로비(lobby.js)에 필요한 도구를 넘긴다
    const settingsHtml = () => {
      const ql = [['high', t('high')], ['mid', t('mid')], ['low', t('low')]];
      let h = `<div class="h">${t('language')}</div><div class="row"><div class="zones">${I.LANGS.map(([k, n]) => `<button class="zb ${I.lang === k ? 'on' : ''}" data-act="langSet" data-arg="${k}" type="button">${n}</button>`).join('')}</div></div>`;
      h += `<div class="h">${t('gfx')}</div><div class="row"><div>${t('gfxRow')} <small>${t('gfxHint')}</small></div><div class="zones">${ql.map(([k, l]) => `<button class="zb ${Q.level === k ? 'on' : ''}" data-act="gfx" data-arg="${k}" type="button">${l}</button>`).join('')}</div></div>`;
      h += `<div class="row"><div>${t('fps30')} <small>${t('fps30Hint')}</small></div><button class="toggle ${Q.fps30 ? 'on' : ''}" data-act="fps30" type="button">${Q.fps30 ? t('on') : t('off')}</button></div>`;
      h += `<div class="row"><div>${t('perfShow')} <small>${t('perfShowHint')}</small></div><button class="toggle ${Q.perf ? 'on' : ''}" data-act="perf" type="button">${Q.perf ? t('on') : t('off')}</button></div>`;
      h += `<div class="h">${t('sound')}</div><div class="row"><div>${t('sfx')}</div><button class="toggle" data-act="vol" data-arg="sfx" type="button">${Math.round(Snd.state.sfx * 100)}%</button></div>`;
      h += `<div class="row"><div>${t('bgm')}</div><button class="toggle" data-act="vol" data-arg="bgm" type="button">${Math.round(Snd.state.bgm * 100)}%</button></div>`;
      h += `<div class="h">${I.t('tutReplay')}</div><div class="row"><div><small>${I.t('tutReplayHint')}</small></div><button class="toggle" data-act="tutReset" type="button">${I.t('tutReplay')}</button></div>`;
      h += `<div class="row"><div>${window.RTD_CREDITS ? window.RTD_CREDITS.label() : ''}</div><button class="toggle" data-act="credits" type="button">${t('view')}</button></div>`;
      h += `<div class="row"><div>${t('version')}</div><div>v${window.RTD_VERSION || '?'}</div></div>`;
      return `<div class="setlist">${h}</div>`;
    };
    const repaintMap = () => { sizeMap(); };
    if (window.RTD_LOBBY) window.RTD_LOBBY.init({ api, ACC, saveAcc, t, I, T, cfg, getLobby: () => lobby, joinRoom: (code) => join(code), begin, refreshAcc, settingsHtml, errText, clock, repaintMap, repaintSetup: () => dr(), paintMini: (cv, theme) => paintMap(cv.getContext('2d'), cv.width, cv.height, theme || null) });
    dr();
  }
  setupTitle();
  requestAnimationFrame(loop);
})();
