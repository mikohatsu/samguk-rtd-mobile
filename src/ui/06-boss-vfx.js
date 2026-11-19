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
    blobShadow(c, h.x, h.y + 4, h.r * 1.4 * q + 1, 0.6 * q);
    c.globalAlpha = 1;
    if (h.fx === 'rock') {
      if (vs(c, 'rock', x, y, h.r * 1.1, q * 6)) return;
      c.save(); c.translate(x, y); c.rotate(q * 6);
      const s = h.r * 0.45;
      c.fillStyle = '#7a5c40'; c.beginPath(); c.moveTo(-s, -s * 0.3); c.lineTo(-s * 0.4, -s); c.lineTo(s * 0.6, -s * 0.8); c.lineTo(s, s * 0.1); c.lineTo(s * 0.3, s); c.lineTo(-s * 0.7, s * 0.7); c.closePath(); c.fill();
      c.fillStyle = '#b08a64'; c.beginPath(); c.moveTo(-s * 0.4, -s); c.lineTo(s * 0.6, -s * 0.8); c.lineTo(s * 0.2, -s * 0.1); c.lineTo(-s * 0.5, -s * 0.2); c.closePath(); c.fill();
      c.restore();
    } else if (h.fx === 'firearrow') {
      // 불화살: 화살 그림(gfx/vs_arrow)을 떨어지는 방향으로 돌리고 촉에 불꽃 그림
      for (let i = 0; i < 3; i++) { const ox = (i - 1) * 22, oy = i * 18, ra = Math.atan2(140, -60); if (!vs(c, 'arrow', x + ox + 30, y + oy - 70, 150, ra)) { c.strokeStyle = '#ffd8a0'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(x + ox + 60, y + oy - 140); c.stroke(); } Art.fxImg(c, 'fire', x + ox, y + oy, 46, ra, 1); }
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
      // 낙뢰 전조: 하늘에서 내려오는 잔전기 한 줄(Kenney 번개 그림)
      const SK = window.RTD_SKFX;
      if (SK) { const len = 300 * q + 40; SK.spr(c, 'spark_06', col, h.x, h.y - 300 + len / 2, len * 0.6, len, 0, 0.3 * q); } // 예고가 읽히게 한 줄만, 깜빡임 없이
    }
  }
  // ---- 장판 예고(v0.2.39) — 레이드 게임식 표준 예고 ----
  // 1) 위험 구역: 차분한 반투명 바탕 + 피격 경계에 딱 맞춘 선명한 테두리(밝은 띠는 경계 안쪽, 어두운 띠는 바깥쪽 → 어느 바닥 색에서도 보인다)
  // 2) 터지는 때: 안쪽(원은 가운데, 직선은 보스 쪽, 고리는 안쪽 둘레)에서 진한 채움이 차올라 테두리에 닿는 순간이 피해 프레임(h.t >= h.delay)
  // 3) 예고 중에는 도는 법진·빛 번짐·깜빡임을 쓰지 않는다. 화려한 연출은 터지는 순간(hazardImpact)에만.
  // 그림: Kenney circle_05(가운데가 평평한 부드러운 원판)를 물들여 장판 모양대로 잘라 깐다. 색·굵기는 TELE 한 곳에서 고친다.
  const TELE = { fill: '#ff3b1f', dark: '#120402', edge: '#ffc49a', front: '#ffe2c8', safe: '#86ffa6', baseA: 0.2, darkA: 0.16, growA: 0.3, edgeW: 6, darkW: 4, frontW: 4 };
  const teleC01 = (v) => Math.max(0, Math.min(1, v));
  // path()로 만든 모양(evenodd)으로 잘라 원판 그림을 깐다. R = 그 모양을 다 덮는 반지름
  function area(c, path, cx, cy, R, col, a) {
    if (!(a > 0.01)) return;
    const SK = window.RTD_SKFX, s = (Math.max(4, R) * 2) / 0.28;
    c.save(); c.beginPath(); path(); c.clip('evenodd');
    if (!(SK && SK.spr(c, 'circle_05', col, cx, cy, s, s, 0, a, false))) { c.globalAlpha = Math.min(1, a); c.fillStyle = col; c.fillRect(cx - R, cy - R, R * 2, R * 2); }
    c.restore();
  }
  const circ = (c, x, y, r) => { if (r > 0) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); } };
  // 장판 하나를 그린다. o.shape(off): 경계를 off만큼 키운(음수면 줄인) 모양, o.prog(p, off): 진행만큼 찬 모양(없으면 차오름 생략).
  // o.lim: 전체에 먼저 거는 자르기(경기장 안 등). em: 곧 터질 장판일수록 1(차례로 터지는 장판끼리 순서가 보이게)
  function tele(c, o, p, em, fired, q) {
    const { cx, cy, R } = o;
    c.save();
    if (o.lim) { c.beginPath(); o.lim(); c.clip(); }
    if (fired) { area(c, () => o.shape(0), cx, cy, R, TELE.fill, (TELE.baseA + TELE.growA) * (1 - q)); c.restore(); return; }
    area(c, () => o.shape(0), cx, cy, R, TELE.dark, TELE.darkA * em);
    area(c, () => o.shape(0), cx, cy, R, TELE.fill, TELE.baseA * em);
    if (o.prog && p > 0.005) {
      area(c, () => o.prog(p, 0), cx, cy, R, TELE.fill, TELE.growA);
      area(c, () => { o.prog(p, 0); o.prog(p, -TELE.frontW); }, cx, cy, R, TELE.front, 0.75);
    }
    if (!o.noEdge) {
      area(c, () => { o.shape(TELE.darkW); o.shape(0); }, cx, cy, R + TELE.darkW, TELE.dark, 0.55);
      area(c, () => { o.shape(0); o.shape(-TELE.edgeW); }, cx, cy, R, TELE.edge, 0.7 + 0.3 * em);
    }
    c.restore();
  }
  // 모양 만들기
  const shCircle = (c, x, y, r) => ({ cx: x, cy: y, R: r, shape: (off) => circ(c, x, y, r + off), prog: (p, off) => circ(c, x, y, r * p + off) });
  const shRect = (c, x, y, w, h) => ({ cx: x + w / 2, cy: y + h / 2, R: Math.hypot(w, h) / 2 + 8,
    shape: (off) => c.rect(x - off, y - off, w + off * 2, h + off * 2),
    // 가운데에서 네 변으로 차오른다
    prog: (p, off) => { const pw = Math.max(0, w * p + off * 2), ph = Math.max(0, h * p + off * 2); if (pw > 0 && ph > 0) c.rect(x + (w - pw) / 2, y + (h - ph) / 2, pw, ph); } });
  // 직선(이미 translate·rotate한 좌표): 보스(0,0)에서 len까지, 폭 w. 보스 쪽에서 끝으로 차오른다
  const shLine = (c, len, w) => ({ cx: len / 2, cy: 0, R: Math.hypot(len, w) / 2 + 8,
    shape: (off) => c.rect(-off, -w / 2 - off, len + off * 2, w + off * 2),
    prog: (p, off) => { const l = len * p + off; if (l > 0) c.rect(0, -w / 2, l, w); } });
  // 부채꼴: off만큼 키우거나 줄인 모양(줄일 때는 꼭짓점을 안으로 밀고 양옆을 off만큼 좁힌다)
  const coneP = (c, x, y, a, arc, r, off) => {
    const hs = arc / 2, sn = Math.max(0.2, Math.sin(Math.min(hs, Math.PI / 2))), sh = off < 0 ? Math.min(r * 0.4, -off / sn) : -off / sn;
    const ax = x + Math.cos(a) * sh, ay = y + Math.sin(a) * sh, rr = r + off;
    if (rr <= 2) return;
    const da = off < 0 ? Math.asin(Math.min(0.9, -off / rr)) : 0;
    c.moveTo(ax, ay); c.arc(x, y, rr, a - hs + da, a + hs - da); c.closePath();
  };
  const shCone = (c, h) => ({ cx: h.x, cy: h.y, R: h.r, shape: (off) => coneP(c, h.x, h.y, h.a, h.arc, h.r, off),
    prog: (p, off) => { const rr = h.r * p + off; if (rr > 2) { c.moveTo(h.x, h.y); c.arc(h.x, h.y, rr, h.a - h.arc / 2, h.a + h.arc / 2); c.closePath(); } } });
  // 고리: 안쪽 둘레(r0)에서 바깥 둘레(r1)로 차오른다
  const shDonut = (c, h) => ({ cx: h.x, cy: h.y, R: h.r1, shape: (off) => { circ(c, h.x, h.y, h.r1 + off); circ(c, h.x, h.y, Math.max(0.5, h.r0 - off)); },
    prog: (p, off) => { const rr = h.r0 + (h.r1 - h.r0) * p + off; if (rr > h.r0) { circ(c, h.x, h.y, rr); circ(c, h.x, h.y, h.r0); } } });
  const arenaRect = (c, off) => c.rect(ARENA.x0 - (off || 0), ARENA.y0 - (off || 0), ARENA.x1 - ARENA.x0 + (off || 0) * 2, ARENA.y1 - ARENA.y0 + (off || 0) * 2);
  const farR = (x, y) => Math.max(Math.hypot(x - ARENA.x0, y - ARENA.y0), Math.hypot(x - ARENA.x1, y - ARENA.y0), Math.hypot(x - ARENA.x0, y - ARENA.y1), Math.hypot(x - ARENA.x1, y - ARENA.y1));
  // 경기장 전체 위험(all·los): 한 점에서 퍼지는 진한 채움이 경기장 가장 먼 구석에 닿을 때 터진다
  const shArena = (c, x, y) => { const R = farR(x, y); return { cx: x, cy: y, R, lim: () => arenaRect(c), shape: (off) => arenaRect(c, off), prog: (p, off) => circ(c, x, y, R * p + off) }; };
  // 안전한 구역 표시: 초록
  function safeEdge(c, path, cx, cy, R, a) { area(c, path, cx, cy, R, TELE.safe, a); }
  function drawHazard(c, h) {
    const p = Math.min(1, h.t / Math.max(0.01, h.delay)), fired = h.t >= h.delay;
    // 오래 남는 장판(불길·절벽)은 지속 시간 동안 일렁이며 남는다
    const live = h.dur && fired && h.t < h.delay + h.dur;
    if (fired && !h.vd) { h.vd = 1; hazardImpact(h); }
    if (h.hide && !fired) return; // 팔진도: 생문은 문양으로만 알려 준다
    const col = visCol(h), now = performance.now() / 1000;
    // 터진 뒤 바탕이 사라지는 정도(0→1, 0.28초)
    const q = teleC01((h.t - h.delay - (h.dur || 0)) / 0.28);
    // 곧 터질 장판일수록 진하게(차례로 터지는 고리·낙석에서 다음 차례가 먼저 보이게)
    const left = h.delay - h.t, em = 0.45 + 0.55 * teleC01((1.3 - left) / 0.8);
    const after = fired && !live; // 터진 직후(바탕만 짧게 남았다 사라진다)
    c.save();
    if (h.k === 'wind' || h.k === 'gaze') { if (fired && h.t < h.delay + h.dur) drawAura(c, h); }
    else if (h.k === 'rect') {
      const o = shRect(c, h.x, h.y, h.rw, h.rh);
      if (live && h.fx === 'flame') {
        // 타오르는 구획: 불길이 일렁인다(바닥은 주황 빛 그림을 구획 크기로 늘여 깐다). 경계는 예고와 같은 테두리로 남긴다
        if (window.RTD_SKFX) window.RTD_SKFX.spr(c, 'light_02', '#ff5a1a', h.x + h.rw / 2, h.y + h.rh / 2, h.rw * 1.25, h.rh * 1.25, 0, 0.45);
        for (let ix = 0; ix < 6; ix++) for (let iy = 0; iy < 3; iy++) {
          const fx = h.x + (ix + 0.5) * (h.rw / 6), fy = h.y + (iy + 0.6) * (h.rh / 3), fl = 0.8 + Math.sin(now * 9 + ix * 1.7 + iy * 2.3) * 0.2;
          Art.fxImg(c, 'fire', fx, fy - Math.min(h.rw / 6, h.rh / 3) * 0.3, Math.min(h.rw / 6, h.rh / 3) * 1.3 * fl, UP + Math.sin(now * 6 + ix + iy) * 0.12, 0.75);
        }
        tele(c, Object.assign({}, o, { prog: null }), 1, 0.6, false);
      } else if (live) tele(c, Object.assign({}, o, { prog: null }), 1, 0.8, false);
      else tele(c, o, p, em, after, q);
    } else if (h.k === 'band') {
      // 띠 밖이 위험: 경기장 위·아래 끝에서 진한 채움이 안전한 띠 쪽으로 차올라 띠 경계에 닿을 때 터진다. 안전한 띠 경계는 초록
      const AW = ARENA.x1 - ARENA.x0, top = h.y0 - ARENA.y0, bot = ARENA.y1 - h.y1;
      const o = { cx: (ARENA.x0 + ARENA.x1) / 2, cy: (ARENA.y0 + ARENA.y1) / 2, R: Math.hypot(AW, ARENA.y1 - ARENA.y0) / 2 + 8, lim: () => arenaRect(c),
        shape: (off) => { c.rect(ARENA.x0 - off, ARENA.y0 - off, AW + off * 2, top + off * 2); c.rect(ARENA.x0 - off, h.y1 - off, AW + off * 2, bot + off * 2); },
        prog: (pp, off) => { const t1 = top * pp + off, b1 = bot * pp + off; if (t1 > 0) c.rect(ARENA.x0, ARENA.y0, AW, t1); if (b1 > 0) c.rect(ARENA.x0, ARENA.y1 - b1, AW, b1); } };
      tele(c, o, p, em, after, q);
      if (!fired) safeEdge(c, () => { c.rect(ARENA.x0, h.y0, AW, TELE.edgeW); c.rect(ARENA.x0, h.y1 - TELE.edgeW, AW, TELE.edgeW); }, o.cx, o.cy, o.R, 0.95);
    } else if (h.k === 'all') {
      // 경기장 전체: 가운데에서 퍼지는 채움이 구석에 닿을 때 터진다(터지는 순간의 흰 섬광은 착탄 효과가 덮는다)
      tele(c, shArena(c, (ARENA.x0 + ARENA.x1) / 2, (ARENA.y0 + ARENA.y1) / 2), p, 1, after, q);
    } else if (h.k === 'los') {
      // 보스에게서 퍼지는 채움이 구석에 닿을 때 터진다. 돌기둥 뒤 그림자 = 안전(초록 바탕)
      tele(c, shArena(c, h.x, h.y), p, 1, after, q);
      if (!fired) g.fight.mech.objs.forEach((o) => {
        if (o.k !== 'pillar') return;
        const a = Math.atan2(o.y - h.y, o.x - h.x), px = -Math.sin(a) * o.r * 0.8, py = Math.cos(a) * o.r * 0.8, ex = Math.cos(a) * 250, ey = Math.sin(a) * 250;
        const poly = () => { c.moveTo(o.x + px, o.y + py); c.lineTo(o.x + px + ex, o.y + py + ey); c.lineTo(o.x - px + ex, o.y - py + ey); c.lineTo(o.x - px, o.y - py); c.closePath(); };
        area(c, poly, o.x + ex / 2, o.y + ey / 2, 200, TELE.safe, 0.42);
      });
    } else if (h.k === 'push') {
      // 밀어내기(피해 없음): 같은 예고. 가운데에서 차오른 채움이 테두리에 닿을 때 밀려난다
      tele(c, shCircle(c, h.x, h.y, h.r), p, em, after, q);
    } else if (h.k === 'proj') {
      drawProj(c, h, col, fired);
    } else if (h.own) {
      // 내 장판(연출 이름이 없는 것 포함): 바닥 법진 그림과 차오르는 고리 그림(skillfx.tele)
      c.fillStyle = h.c; c.strokeStyle = h.c; c.lineWidth = 2; c.globalAlpha = fired ? Math.max(0, 0.75 * (1 - q)) : 0.12 + p * 0.26;
      if (!(window.RTD_SKFX && window.RTD_SKFX.tele(c, h, p, fired))) { c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.fill(); if (!fired) { c.globalAlpha = 0.9; c.beginPath(); c.arc(h.x, h.y, h.r * p, 0, 7); c.stroke(); } }
    } else if (h.k === 'circle') {
      const o = shCircle(c, h.x, h.y, h.r);
      if (live) {
        // 남는 불길·장판: 바닥은 빛 그림(불길이면 주황)을 장판 크기로 깔고, 경계는 예고와 같은 테두리로 남긴다
        if (!(window.RTD_SKFX && window.RTD_SKFX.spr(c, 'light_02', h.fx === 'flame' ? '#ff5a1a' : h.c, h.x, h.y, h.r * 2.5, h.r * 2.5, now * 0.4, 0.5 + Math.sin(h.t * 12) * 0.06))) { c.globalAlpha = 0.3 + Math.sin(h.t * 12) * 0.05; c.fillStyle = h.fx === 'flame' ? '#7a1e08' : h.c; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.fill(); }
        if (h.fx === 'flame' || h.fx === 'fireball') for (let i = 0; i < 5; i++) { const a = i * 1.26 + now, rr = h.r * 0.5; Art.fxImg(c, 'fire', h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr * 0.6 - h.r * 0.3, h.r * (0.8 + Math.sin(now * 8 + i) * 0.15), UP + Math.sin(now * 7 + i) * 0.12, 0.7); }
        tele(c, Object.assign({}, o, { prog: null }), 1, 0.6, false);
      } else {
        tele(c, o, p, em, after, q);
        // 떨어지는 물체(바위·불배·불화살 등)는 터지기 0.5초 전부터 내려온다
        if (!fired && left < 0.5 && h.fx) drawFalling(c, h, 1 - left / 0.5);
      }
    } else if (h.k === 'line') {
      c.translate(h.x, h.y); c.rotate(h.a);
      tele(c, shLine(c, h.len, h.w), p, em, after, q);
    } else if (h.k === 'cone') {
      // 칼 휘두르기는 터진 뒤 궤적 연출만 남긴다
      if (!fired || (h.fx !== 'blade' && h.fx !== 'halberd')) tele(c, shCone(c, h), p, em, after, q);
    } else if (h.k === 'donut') {
      tele(c, shDonut(c, h), p, em, after, q);
    } else if (h.k === 'safe') {
      // 안전한 자리 밖이 위험: 경기장(자리 구멍 뚫음)을 위험 바탕으로, 자리 테두리는 초록.
      // 터지는 때: 자리 밖에서 초록 고리가 좁혀 와 자리 테두리에 닿는 순간
      const o = shArena(c, (ARENA.x0 + ARENA.x1) / 2, (ARENA.y0 + ARENA.y1) / 2);
      o.shape = (off) => { arenaRect(c, off); h.spots.forEach((s) => circ(c, s[0], s[1], Math.max(1, s[2] - off))); };
      o.prog = null; o.noEdge = true;
      tele(c, o, p, 0.6 + 0.4 * p, after, q);
      if (!fired) h.spots.forEach((s) => {
        const R = s[2], rr = R * (1 + 1.6 * (1 - p));
        area(c, () => { circ(c, s[0], s[1], R + TELE.darkW); circ(c, s[0], s[1], R); }, s[0], s[1], R + TELE.darkW, TELE.dark, 0.55);
        safeEdge(c, () => { circ(c, s[0], s[1], R); circ(c, s[0], s[1], R - TELE.edgeW); }, s[0], s[1], R, 0.95);
        safeEdge(c, () => { circ(c, s[0], s[1], rr); circ(c, s[0], s[1], rr - TELE.frontW); }, s[0], s[1], rr, 0.8);
      });
    }
    c.restore();
  }
  // 탄환: 기술마다 생김새가 다르다(불덩이·혼령·바람·화살·요기 구슬)
  function drawProj(c, h, col, fired) {
    if (!fired) {
      // 발사 전: 보스 앞에 모이는 기운
      const q = h.t / Math.max(0.01, h.delay);
      const gx = h.x + Math.cos(h.a) * 40 * q, gy = h.y + Math.sin(h.a) * 40 * q;
      if (!(window.RTD_SKFX && window.RTD_SKFX.spr(c, 'light_01', col, gx, gy, (6 + q * 6) * 7, (6 + q * 6) * 7, q * 4, 0.35 + q * 0.5))) { c.globalAlpha = 0.25 + q * 0.4; c.fillStyle = col; c.beginPath(); c.arc(gx, gy, 6 + q * 6, 0, 7); c.fill(); }
      return;
    }
    const a = h.a, tx = -Math.cos(a), ty = -Math.sin(a), fx = h.fx;
    // 꼬리
    // 꼬리: 불 계열은 불꼬리 그림(vs_streak), 그 밖은 기술 색 빛줄기 그림
    const tl = fx === 'arrow' ? 0 : 70;
    if (tl) {
      const fire = fx === 'fireball' || fx === 'flame';
      if (!(fire && vs(c, 'streak', h.x + tx * tl * 0.45, h.y + ty * tl * 0.45, tl * 1.5, a, 0.9, true))) streak(c, col, h.x + tx * tl, h.y + ty * tl, h.x, h.y, h.r * 1.2, 0.9);
    }
    c.globalAlpha = 1;
    if (fx === 'fireball') { Art.fxImg(c, 'fire', h.x - Math.cos(a) * h.r, h.y - Math.sin(a) * h.r, h.r * 3.6, a, 1); if (window.RTD_SKFX) window.RTD_SKFX.spr(c, 'light_01', '#fff4c8', h.x, h.y, h.r * 2.2, h.r * 2.2, 0, 0.95); }
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
      const SK = window.RTD_SKFX;
      if (v.k === 'flash') {
        // 섬광: 화면 전체를 덮는 것(전체 장판)만 흰 덮개, 나머지는 빛 그림(단색 원반·사각을 칠하지 않는다)
        const full = v.rect && v.rect[2] > W;
        if (full || !SK) { c.globalAlpha = 0.55 * (1 - p); c.fillStyle = v.c; if (v.rect) c.fillRect(...v.rect); else { c.beginPath(); c.arc(v.x, v.y, v.r, 0, 7); c.fill(); } }
        else if (v.rect) SK.spr(c, 'light_02', v.c, v.rect[0] + v.rect[2] / 2, v.rect[1] + v.rect[3] / 2, v.rect[2] * 1.3, v.rect[3] * 1.3, 0, 0.8 * (1 - p));
        else { SK.spr(c, 'light_01', v.c, v.x, v.y, v.r * 2.6, v.r * 2.6, 0, 0.85 * (1 - p)); SK.spr(c, 'flare_01', '#ffffff', v.x, v.y, v.r * 1.6 * (1 + p), v.r * 1.6 * (1 + p), p * 2, 0.9 * (1 - p)); }
      } else if (v.k === 'shock') {
        // 충격파: 퍼지는 빛 고리 그림(바닥에 눕힘) + 고리 프레임 애니메이션
        ringSpr(c, 'circle_02', v.c, v.x, v.y, v.r * (0.3 + p * 0.8), 0, (1 - p) * 0.9, true, 0.75);
        // 충격파 고리 애니메이션(바닥에 눕힘)
        Art.fxAnim(c, 'ring', p, v.x, v.y, v.r * 2.8, v.r * 2.1, 0, 0.9);
      } else if (v.k === 'bolt') {
        // 하늘에서 내리꽂는 번개: 세로로 그린 번개 그림(Kenney spark_06·05, 원래 비율)을 두 줄기 겹치고, 0.05초마다 좌우를 바꿔 번쩍인다.
        // 위쪽은 화면 위 글자(남은 시간)를 가리지 않게 땅에서 470까지만.
        const fl = Math.floor(v.t * 20) % 2 ? -1 : 1, ba = Math.pow(1 - p, 0.7);
        if (SK && SK.spr(c, 'spark_06', '#fffbe0', v.x, v.y - 235, fl * 300, 470, 0, ba)) {
          SK.spr(c, 'spark_05', v.c, v.x + 16 * fl, v.y - 220, -fl * 260, 440, 0, ba * 0.8);
          SK.spr(c, 'light_01', v.c, v.x, v.y - 10, v.r * 2.2, v.r * 1.4, 0, ba * 0.9);
        } else if (!Art.fxAnim(c, 'bolt', p, v.x, v.y - 235, 470, 120, Math.PI / 2, (1 - p) * 1.2, Math.floor(v.t * 30))) Art.fxImg(c, 'bolt', v.x, v.y - v.r * 0.9, v.r * 2.4, 0, 1 - p);
        Art.fxAnim(c, 'hit', p, v.x, v.y, v.r * 2.2, v.r * 1.4, 0, 1);
      } else if (v.k === 'spark') {
        // 튀는 불꽃 조각: 짧은 빛줄기 그림
        const d = v.s * p;
        streak(c, v.c, v.x + Math.cos(v.a) * d * 0.6, v.y + Math.sin(v.a) * d * 0.6, v.x + Math.cos(v.a) * d, v.y + Math.sin(v.a) * d, 4, 1 - p);
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
        // 불씨: 부드러운 빛 알갱이 그림
        const es = v.sz * (1 - p * 0.5) * 5;
        if (SK) SK.spr(c, 'circle_05', p < 0.4 ? '#fff0a0' : '#ff7a2a', v.x + v.vx * v.t, v.y + v.vy * v.t, es, es, 0, 1 - p);
      } else if (v.k === 'img') {
        // 폭발은 프레임 애니메이션, 불길은 기존 그림
        if (!(v.img === 'boom' && Art.fxAnim(c, 'boom2', p, v.x, v.y - v.r * 0.15, v.r * 1.5, v.r * 1.5, 0, 1)))
          Art.fxImg(c, v.img, v.x, v.y - (v.img === 'fire' ? v.r * 0.25 : 0), v.r * (0.8 + p * 0.4), v.img === 'fire' ? UP : p, (1 - p) * 1.3);
      } else if (v.k === 'swing') {
        // 칼 휘두르기: 칼끝이 호를 그리며 지나가고, 지나간 자리에 칼끝 쪽이 두껍고 밝은 궤적이 남는다
        const u = Math.min(1, p / 0.38), e = 1 - (1 - u) * (1 - u) * (1 - u), fade = p < 0.38 ? 1 : 1 - (p - 0.38) / 0.62;
        const a0 = v.a - v.dir * v.arc / 2, a1 = v.a + v.dir * v.arc / 2, head = a0 + (a1 - a0) * e, N = 48;
        const pt = (ang, rr) => [v.x + Math.cos(ang) * rr, v.y + Math.sin(ang) * rr];
        // 궤적: 고리 그림(Kenney circle_03·02)을 휘두른 부채꼴 모양으로 잘라 여러 조각으로 깐다. 칼끝 쪽 조각일수록 밝다(도형을 칠하지 않는다).
        const span = head - a0;
        if (SK && Math.abs(span) > 0.02) {
          const n = 7;
          for (let k = 0; k < n; k++) {
            const s0 = a0 + (span * k) / n, s1 = a0 + (span * (k + 1)) / n, w = (k + 1) / n;
            c.save(); c.beginPath(); c.moveTo(v.x, v.y); c.arc(v.x, v.y, v.r * 1.3, Math.min(s0, s1), Math.max(s0, s1) + 0.01); c.closePath(); c.clip();
            ringSpr(c, 'circle_03', v.c, v.x, v.y, v.r * 0.9, 0, fade * w * w * 0.95);
            if (k >= n - 3) ringSpr(c, 'circle_02', '#fff6dc', v.x, v.y, v.r * 0.95, 0, fade * w * 0.9);
            c.restore();
          }
        }
        c.globalCompositeOperation = 'source-over';
        // 휘두르는 칼(극이면 긴 자루)
        if (u < 1 || p < 0.5) {
          const [hx, hy] = pt(head, v.r * 1.02), [gx, gy] = pt(head, v.r * (v.pole ? 0.05 : 0.3));
          c.globalAlpha = fade; c.lineCap = 'round';
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
        ringSpr(c, 'circle_03', v.c, v.x, v.y, rr, 0, 1 - p);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2, x = v.x + Math.cos(a) * rr, y = v.y + Math.sin(a) * rr, up = Math.sin(Math.min(1, p * 2) * Math.PI) * 34;
          if (v.fx === 'flame') Art.fxImg(c, 'fire', x, y - 18 - up * 0.5, 54, UP, 1 - p);
          else if (v.fx === 'army' && k % 2 === 0 && vs(c, 'spears', x, y - 14 - up * 0.6, 54, -Math.PI / 2, 1 - p)) { /* 솟는 창 대열 */ }
          else if (v.fx === 'army') { /* 그림으로 그릴 때는 한 칸 건너 하나씩만 */ if (!VS.spears) { c.fillStyle = '#e8e8e8'; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x, y - 10 - up); c.lineTo(x + 6, y); c.closePath(); c.fill(); } }
          else if (!streak(c, v.c, x, y, x, y - 14 - up, 8, 1 - p)) { c.fillStyle = v.c; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x, y - 10 - up); c.lineTo(x + 6, y); c.closePath(); c.fill(); }
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
      // 바람: 바람 방향으로 흐르는 빛줄기 그림(흐르며 나타났다 사라진다)
      const l = Math.hypot(h.vx, h.vy) || 1, ux = h.vx / l, uy = h.vy / l;
      for (let i = 0; i < 36; i++) {
        const x = ARENA.x0 + ((i * 263) % (ARENA.x1 - ARENA.x0)), y0 = ARENA.y0 + ((i * 151) % (ARENA.y1 - ARENA.y0));
        const s = ((h.t * 220 + i * 70) % 300), x1 = x + ux * s, y1 = y0 + uy * s, fa = Math.sin((s / 300) * Math.PI);
        if (!streak(c, '#d8ecff', x1, y1, x1 + ux * 70, y1 + uy * 70, 5, 0.6 * fa)) { c.globalAlpha = 0.5; c.strokeStyle = '#d8ecff'; c.lineWidth = 3; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + ux * 40, y1 + uy * 40); c.stroke(); }
      }
    } else {
      const b = g.fight.boss;
      c.globalAlpha = 0.18; c.fillStyle = '#6a2aa0'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
      if (!vs(c, 'eye', b.x, b.y - 156, 170 * (1 + Math.sin(performance.now() / 260) * 0.05), 0, 0.98, true)) {
        c.globalAlpha = 0.95; c.fillStyle = '#f4e8ff'; c.beginPath(); c.ellipse(b.x, b.y - 150, 56, 26, 0, 0, 7); c.fill();
        c.fillStyle = '#7a1ad0'; c.beginPath(); c.arc(b.x, b.y - 150, 18, 0, 7); c.fill();
      }
      c.globalAlpha = 0.95;
      if (!g.over) { const us = uiS(); c.save(); c.translate(b.x, b.y - 108); c.scale(us, us); c.fillStyle = '#fff'; c.strokeStyle = 'rgba(20,10,30,.9)'; c.lineWidth = 4; c.lineJoin = 'round'; c.font = '700 18px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.strokeText(I.t('walkHurt'), 0, 0); c.fillText(I.t('walkHurt'), 0, 0); c.restore(); }
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
        blobShadow(c, o.x, o.y + o.r * 0.55, o.r * 2.6, 0.7);
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
        blobShadow(c, o.x, o.y + o.r * 0.8, o.r * 2.4, 0.7);
        c.fillStyle = o.flash > 0 ? '#fff' : col; c.strokeStyle = '#2a1c10'; c.lineWidth = 3;
        const pic = o.k === 'tower' ? 'tower' : o.k === 'altar' ? 'altar' : 'ambush', pw = o.k === 'tower' ? 104 : o.k === 'altar' ? 124 : o.r * 2.9, py = o.k === 'tower' ? o.y - 40 : o.k === 'altar' ? o.y - 22 : o.y - o.r * 0.25;
        if (vs(c, pic, o.x, py, pw)) { if (o.flash > 0) vs(c, pic, o.x, py, pw, 0, 0.75, true); /* 맞으면 번쩍 */ }
        else if (o.k === 'tower') { c.fillRect(o.x - 30, o.y - 50, 60, 80); c.strokeRect(o.x - 30, o.y - 50, 60, 80); c.beginPath(); c.moveTo(o.x - 42, o.y - 50); c.lineTo(o.x, o.y - 82); c.lineTo(o.x + 42, o.y - 50); c.closePath(); c.fill(); c.stroke(); }
        else if (o.k === 'altar') { c.fillRect(o.x - 34, o.y - 20, 68, 44); c.strokeRect(o.x - 34, o.y - 20, 68, 44); c.fillStyle = '#c03020'; c.fillRect(o.x - 8, o.y - 60, 16, 44); c.fillStyle = '#fff3a0'; c.font = '400 16px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.fillText('符', o.x, o.y - 32); }
        else { c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#2a1c10'; c.font = '400 22px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('伏', o.x, o.y); }
        bar(c, o.x, o.y - o.r - 34, 70 * uiS(), 6 * uiS(), Math.max(0, o.hp / (o.mhp || 1)), '#ff8a5c');
      }
      // 공격 대상: 붉은 법진 그림이 돈다(점선 원 대신)
      if (act && act.tgt === o.id) Art.fxPic(c, 'mc_rune2', o.x, o.y, (o.r + 18) * 2.1, (o.r + 18) * 2.1, t * 0.8, 0.95, { col: '#ff5040' });
      c.restore();
    });
    if (M.bur) {
      c.save(); c.strokeStyle = M.bur.lock ? '#ff5040' : '#c9b48a'; c.lineWidth = 4; c.globalAlpha = 0.9;
      if (VS.dust) { for (let i = 0; i < 4; i++) { const a = t * 2.2 + i * 1.57; vs(c, 'dust', M.bur.x + Math.cos(a) * 34, M.bur.y + Math.sin(a) * 20, 70, a, 0.6); } ringSpr(c, 'circle_02', M.bur.lock ? '#ff5040' : '#c9b48a', M.bur.x, M.bur.y, 52 + ((t * 30) % 18), 0, 0.85, true, 0.6); }
      else for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(M.bur.x, M.bur.y, 30 + i * 22 + ((t * 40) % 22), 0, 7); c.stroke(); }
      c.restore();
    }
  }
  // 보스전 그림 크기: 장수 반지름(기존 31)과 보스 배율(기존 1). 동작이 잘 보이게 키웠다. 판정(사거리·장판)은 그대로다.
  const CHAMP_R = 40, BOSS_S = 1.25;
