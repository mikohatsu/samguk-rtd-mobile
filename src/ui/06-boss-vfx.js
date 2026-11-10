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
        addVfx({ k: 'crack', x: h.x, y: h.y, r: h.r, life: 1.2, seed: Math.random() * 99 });
        addVfx({ k: 'dust', x: h.x, y: h.y, r: h.r * 1.3, life: 0.7 });
      } else if (fire) {
        addVfx({ k: 'img', img: 'fire', x: h.x, y: h.y - h.r * 0.3, r: h.r * 2.4, life: 0.5 });
        for (let i = 0; i < 16; i++) addVfx({ k: 'ember', x: h.x + rnd(-h.r, h.r) * 0.7, y: h.y + rnd(-h.r, h.r) * 0.5, vy: rnd(-180, -60), vx: rnd(-40, 40), life: rnd(0.5, 1), sz: rnd(3, 6) });
      } else if (fx === 'roar') {
        for (let i = 0; i < 3; i++) addVfx({ k: 'shock', x: h.x, y: h.y, r: h.r * (1 + i * 0.25), life: 0.5 + i * 0.15, c: col, w: 10 - i * 3 });
        addVfx({ k: 'dust', x: h.x, y: h.y, r: h.r, life: 0.8 });
      } else addVfx({ k: 'img', img: 'boom', x: h.x, y: h.y, r: h.r * 2.3, life: 0.4 });
    } else if (h.k === 'line') {
      // 직선 기술: 무엇이 실제로 날아가거나 달려 나간다
      const kind = fx === 'talisman' ? 'talisman' : fx === 'arrow' || fx === 'firearrow' ? 'arrow' : fx === 'wind' ? 'gust' : fx === 'army' || fx === 'ox' ? 'troop' : fx === 'shadow' ? 'wisp' : fx === 'halberd' || fx === 'blade' ? 'slashline' : fx === 'charge' || fx === 'redhare' ? 'dustline' : 'streak';
      const n = kind === 'talisman' ? 3 : kind === 'arrow' ? 5 : kind === 'troop' ? 4 : kind === 'gust' ? 3 : kind === 'wisp' ? 3 : 1;
      // 초당 약 1400px로 날아가 눈으로 따라갈 수 있게 한다
      const life = Math.min(1.4, Math.max(0.6, h.len / 1400));
      for (let i = 0; i < n; i++) addVfx({ k: kind, x: h.x, y: h.y, a: h.a, len: h.len, w: h.w, off: n > 1 ? (i / (n - 1) - 0.5) * h.w * 0.8 : 0, lag: i * 0.06, life: life + i * 0.06, c: col });
    } else if (h.k === 'cone') {
      // 칼·극 휘두르기: 오른쪽·왼쪽 번갈아 휘두른다
      S.swingDir = -(S.swingDir || 1);
      addVfx({ k: 'swing', x: h.x, y: h.y, a: h.a, r: h.r, arc: h.arc, life: 0.42, c: col, dir: S.swingDir, pole: h.fx === 'halberd' });
    } else if (h.k === 'donut') {
      addVfx({ k: 'ringwave', x: h.x, y: h.y, r0: h.r0, r1: h.r1, life: 0.45, c: col, fx });
    } else if (h.k === 'rect') {
      addVfx({ k: 'flash', x: h.x + h.rw / 2, y: h.y + h.rh / 2, rect: [h.x, h.y, h.rw, h.rh], life: 0.25, c: col });
    } else if (h.k === 'all') {
      addVfx({ k: 'flash', x: W / 2, y: H / 2, rect: [-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2], life: 0.5, c: '#ffffff' });
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
      c.save(); c.translate(x, y); c.rotate(q * 6);
      const s = h.r * 0.45;
      c.fillStyle = '#7a5c40'; c.beginPath(); c.moveTo(-s, -s * 0.3); c.lineTo(-s * 0.4, -s); c.lineTo(s * 0.6, -s * 0.8); c.lineTo(s, s * 0.1); c.lineTo(s * 0.3, s); c.lineTo(-s * 0.7, s * 0.7); c.closePath(); c.fill();
      c.fillStyle = '#b08a64'; c.beginPath(); c.moveTo(-s * 0.4, -s); c.lineTo(s * 0.6, -s * 0.8); c.lineTo(s * 0.2, -s * 0.1); c.lineTo(-s * 0.5, -s * 0.2); c.closePath(); c.fill();
      c.restore();
    } else if (h.fx === 'firearrow') {
      for (let i = 0; i < 3; i++) { const ox = (i - 1) * 22, oy = i * 18; c.strokeStyle = '#ffd8a0'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(x + ox + 60, y + oy - 140); c.stroke(); Art.fxImg(c, 'fire', x + ox, y + oy, 46, Math.atan2(140, -60), 1); }
    } else if (h.fx === 'fireship') {
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
        teleStyle(c, col, p); c.setLineDash([16, 10]); c.lineDashOffset = -now * 40; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.stroke(); c.setLineDash([]); c.shadowBlur = 0;
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
        for (let d = off; d < h.len; d += step) { const s = Math.min(h.w * 0.32, 14); c.beginPath(); c.moveTo(d - s, -s); c.lineTo(d, 0); c.lineTo(d - s, s); c.stroke(); }
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
        teleStyle(c, col, p); c.setLineDash([18, 10]); c.lineDashOffset = now * 50; c.beginPath(); c.arc(h.x, h.y, h.r1, 0, 7); c.stroke(); c.beginPath(); c.arc(h.x, h.y, h.r0, 0, 7); c.stroke(); c.setLineDash([]); c.shadowBlur = 0;
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
      c.globalAlpha = 0.85; c.fillStyle = col; c.beginPath(); c.arc(h.x, h.y, h.r, 0, 7); c.fill();
      c.beginPath(); c.moveTo(h.x - ty * h.r, h.y + tx * h.r); c.quadraticCurveTo(h.x + tx * h.r * 2 + w, h.y + ty * h.r * 2 - w, h.x + tx * h.r * 3, h.y + ty * h.r * 3); c.quadraticCurveTo(h.x + tx * h.r * 2 - w, h.y + ty * h.r * 2 + w, h.x + ty * h.r, h.y - tx * h.r); c.fill();
      c.fillStyle = '#1a0a2a'; c.beginPath(); c.arc(h.x + Math.cos(a) * 3 - ty * 4, h.y + Math.sin(a) * 3 + tx * 4, 2.5, 0, 7); c.arc(h.x + Math.cos(a) * 3 + ty * 4, h.y + Math.sin(a) * 3 - tx * 4, 2.5, 0, 7); c.fill();
    } else if (fx === 'wind') {
      c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(h.x, h.y, h.r * 1.4, a - 1.2, a + 1.2); c.stroke();
      c.globalAlpha = 0.5; c.beginPath(); c.arc(h.x + tx * 12, h.y + ty * 12, h.r * 1.1, a - 1.1, a + 1.1); c.stroke();
    } else if (fx === 'arrow') {
      c.save(); c.translate(h.x, h.y); c.rotate(a);
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-34, 0); c.lineTo(6, 0); c.stroke();
      c.fillStyle = '#e8e8e8'; c.beginPath(); c.moveTo(14, 0); c.lineTo(2, -6); c.lineTo(2, 6); c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); c.moveTo(-34, 0); c.lineTo(-42, -6); c.lineTo(-30, 0); c.lineTo(-42, 6); c.closePath(); c.fill();
      c.restore();
    } else {
      // 요기 구슬(시전형 보스 기본 탄)
      Art.fxImg(c, 'magic', h.x, h.y, h.r * 3.2, performance.now() / 300, 0.9);
      c.fillStyle = col; c.beginPath(); c.arc(h.x, h.y, h.r * 0.8, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(h.x, h.y, h.r * 0.35, 0, 7); c.fill();
    }
  }
  // 착탄 효과·날아가는 물체 그리기(매 프레임)
  function drawVfx(c) {
    const dt = 1 / 60;
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
        c.globalAlpha = 1 - p * p; c.fillStyle = v.c; c.save(); c.translate(v.x + Math.cos(v.a) * d, v.y + Math.sin(v.a) * d * 0.6 - z); c.rotate(p * 9); c.fillRect(-v.sz / 2, -v.sz / 2, v.sz, v.sz * 0.7); c.restore();
      } else if (v.k === 'crack') {
        // 땅이 갈라진 자국(천천히 사라짐)
        c.globalAlpha = 0.7 * (1 - p); c.strokeStyle = '#2a1a0e'; c.lineWidth = 3;
        let sd = v.seed; const r = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
        for (let k = 0; k < 6; k++) { let a = k * 1.05 + r(), x = v.x, y = v.y; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 3; j++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * v.r * 0.3; y += Math.sin(a) * v.r * 0.22; c.lineTo(x, y); } c.stroke(); }
      } else if (v.k === 'dust') {
        c.globalAlpha = 0.35 * (1 - p); c.fillStyle = '#b8a07a';
        for (let k = 0; k < 7; k++) { const a = k * 0.9, rr = v.r * (0.4 + p * 0.6); c.beginPath(); c.arc(v.x + Math.cos(a) * rr, v.y + Math.sin(a) * rr * 0.5 - p * 20, v.r * 0.25 * (1 + p), 0, 7); c.fill(); }
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
          if (v.pole) { c.strokeStyle = '#6a3a1e'; c.lineWidth = 7; c.beginPath(); c.moveTo(gx, gy); c.lineTo(...pt(head, v.r * 0.72)); c.stroke(); }
          c.strokeStyle = '#e8eef5'; c.lineWidth = v.pole ? 9 : 7; c.beginPath(); c.moveTo(...(v.pole ? pt(head, v.r * 0.72) : [gx, gy])); c.lineTo(hx, hy); c.stroke();
          if (!v.pole) { const [ga, gb] = [pt(head, v.r * 0.3), head + Math.PI / 2]; c.strokeStyle = '#c9a24a'; c.lineWidth = 6; c.beginPath(); c.moveTo(ga[0] + Math.cos(gb) * 14, ga[1] + Math.sin(gb) * 14); c.lineTo(ga[0] - Math.cos(gb) * 14, ga[1] - Math.sin(gb) * 14); c.stroke(); }
          Art.fxImg(c, 'hit', hx, hy, 60 * fade, head, fade);
        }
      } else if (v.k === 'ringwave') {
        // 포위: 링 위로 창끝(군대)이나 불길·충격파가 솟는다
        const rr = (v.r0 + v.r1) / 2, n = Math.max(12, Math.round(rr / 22));
        c.globalAlpha = 1 - p; c.strokeStyle = v.c; c.lineWidth = (v.r1 - v.r0) * 0.25 * (1 - p); c.beginPath(); c.arc(v.x, v.y, rr, 0, 7); c.stroke();
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2, x = v.x + Math.cos(a) * rr, y = v.y + Math.sin(a) * rr, up = Math.sin(Math.min(1, p * 2) * Math.PI) * 34;
          if (v.fx === 'flame') Art.fxImg(c, 'fire', x, y - 18 - up * 0.5, 54, UP, 1 - p);
          else { c.fillStyle = v.fx === 'army' ? '#e8e8e8' : v.c; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x, y - 10 - up); c.lineTo(x + 6, y); c.closePath(); c.fill(); }
        }
      } else {
        // 직선을 따라 날아가거나 달려가는 것들
        const q = Math.min(1, p * 1.25), d = q * v.len, ca = Math.cos(v.a), sa = Math.sin(v.a);
        const px = v.x + ca * d - sa * v.off, py = v.y + sa * d + ca * v.off;
        c.translate(px, py); c.rotate(v.a);
        if (v.k === 'arrow' || v.k === 'troop' || v.k === 'wisp') c.scale(1.7, 1.7);
        c.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1;
        if (v.k === 'talisman') {
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
      c.globalAlpha = 0.95; c.fillStyle = '#f4e8ff'; c.beginPath(); c.ellipse(b.x, b.y - 150, 56, 26, 0, 0, 7); c.fill();
      c.fillStyle = '#7a1ad0'; c.beginPath(); c.arc(b.x, b.y - 150, 18, 0, 7); c.fill();
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
        c.globalAlpha = 0.85; c.strokeStyle = '#d8ecff'; c.lineWidth = 3; c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.stroke();
        c.fillStyle = '#d8ecff'; drawSym(c, o.x, o.y, o.s, 26);
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
        if (o.k === 'tower') { c.fillRect(o.x - 30, o.y - 50, 60, 80); c.strokeRect(o.x - 30, o.y - 50, 60, 80); c.beginPath(); c.moveTo(o.x - 42, o.y - 50); c.lineTo(o.x, o.y - 82); c.lineTo(o.x + 42, o.y - 50); c.closePath(); c.fill(); c.stroke(); }
        else if (o.k === 'altar') { c.fillRect(o.x - 34, o.y - 20, 68, 44); c.strokeRect(o.x - 34, o.y - 20, 68, 44); c.fillStyle = '#c03020'; c.fillRect(o.x - 8, o.y - 60, 16, 44); c.fillStyle = '#fff3a0'; c.font = '400 16px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.fillText('符', o.x, o.y - 32); }
        else { c.beginPath(); c.arc(o.x, o.y, o.r, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#2a1c10'; c.font = '400 22px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('伏', o.x, o.y); }
        bar(c, o.x, o.y - o.r - 34, 70, 6, Math.max(0, o.hp / (o.mhp || 1)), '#ff8a5c');
      }
      if (act && act.tgt === o.id) { c.globalAlpha = 1; c.strokeStyle = '#ff5040'; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); c.arc(o.x, o.y, o.r + 18, 0, 7); c.stroke(); c.setLineDash([]); }
      c.restore();
    });
    if (M.bur) {
      c.save(); c.strokeStyle = M.bur.lock ? '#ff5040' : '#c9b48a'; c.lineWidth = 4; c.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(M.bur.x, M.bur.y, 30 + i * 22 + ((t * 40) % 22), 0, 7); c.stroke(); }
      c.restore();
    }
  }
  // 보스전 그림 크기: 장수 반지름(기존 31)과 보스 배율(기존 1). 동작이 잘 보이게 키웠다. 판정(사거리·장판)은 그대로다.
  const CHAMP_R = 40, BOSS_S = 1.25;
