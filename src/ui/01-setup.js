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
  // Q.rs는 그래도 느릴 때 자동으로 내리는 배율(17-loop의 autoRes).
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

