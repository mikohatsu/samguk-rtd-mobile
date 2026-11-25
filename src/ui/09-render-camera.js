  function render(now) {
    const t = now / 1000;
    // 프레임 간격: 화면 주사율(60·120Hz)이나 렉과 상관없이 연출 속도가 같도록 모든 감쇠·타이머가 이 값을 쓴다
    const dt = Math.min(0.1, Math.max(0.001, (now - (S.lastNow || now - 16)) / 1000)); S.lastNow = now;
    S.fdt = dt; S.f60 = dt * 60;
    S.auraPrev = S.auraN || 0; S.auraN = 0;
    S.shake = Math.max(0, (S.shake || 0) - 0.06 * S.f60);
    // 흔들림 폭은 글씨처럼 작은 화면에서 키운다(uiS: PC 1, 휴대폰 최대 1.7)
    const shk = 14 * uiS() * (S.shake || 0) * S.scale;
    const sx = (Math.random() - 0.5) * shk, sy = (Math.random() - 0.5) * shk;
    // 보스 처치 순간(S.kill)은 판이 이미 라인으로 넘어간 뒤에도 경기장을 붙잡아 그리므로, 그동안은 보스전 카메라를 그대로 둔다
    watchKill();
    // 체험 처치는 연출이 끝나도 마지막 장면(보스가 사라진 결투장)을 결과 카드 뒤에 남긴다(라인 화면이 없는 판이라)
    if (S.kill && !killOn() && !(g.trial && g.over)) S.kill = null;
    const arenaV = !!S.kill || !!(g.fight && g.phase !== 'wave' && !laneOn());
    const ph = S.kill ? S.camPh : g.phase + (S.laneView ? 'L' : '') + (viewedPeer() ? 'V' : '');
    S.camArena = arenaV;
    // 결투장 화면이 끝나면(라인으로 돌아오고 처치 연출도 끝남) 결투장 전용 캔버스를 비운다(07-arena arenaFree). 보스전 중 라인 보기,
    // 결투장에서 진 채 끝난 판(g.fight가 남는다), 게임에 남기는 비우지 않는다(새 판 시작 때 17-loop begin이 비운다)
    if (arenaV) S.arenaUsed = S.kill ? S.kill.f : g.fight || S.arenaUsed;
    else if (S.arenaUsed && !g.fight && !S.stay) { arenaFree(S.arenaUsed); S.arenaUsed = null; }
    if (S.camPh !== ph) { S.camPh = ph; resetCam(); }
    if (inBoss() && performance.now() > (S.camHold || 0) && S.cam.z > 1.01) {
      const ac = g.active();
      if (ac) {
        // 내 장수를 따라가되, 보스가 위 표시 띠(hudBand) 밑이나 화면 아래로 빠지지 않는 쪽으로 높이를 고른다. 둘 다 못 담으면 내 장수가 먼저다.
        // 내 장수의 아래 여백은 65단위(발 35 + 발밑 고리까지 = 아래 경계에 선 장수와 같은 자리. 예전 110이라 아래쪽에 선 장수와 위쪽 보스를 절충할 폭이 45단위 좁았다)
        // 휴대폰 가로 1.2배(세로 842단위, 띠 약 133단위): 보스와 내 장수(둘 다 기준점)의 세로 거리가 약 450단위를 넘으면 둘 다는 못 담고 보스 머리가 띠 밑으로 들어간다.
        const ck = 1 - Math.pow(0.9, S.f60), vh = S.base.sh / (S.base.s0 * S.cam.z), hb = hudBand(), b = g.fight.boss, cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        let ty = cl(ac.y, b.y - vh / 2 + 100, b.y + vh / 2 - hb - 190);
        ty = cl(ty, ac.y - vh / 2 + 65, ac.y + vh / 2 - hb - 120);
        S.cam.x += (ac.x - S.cam.x) * ck; S.cam.y += (ty - S.cam.y) * ck;
      }
    }
    applyCam();
    // 그리기 상태를 프레임마다 기본값으로 되돌린다: 어떤 연출이 투명도·합성·필터·번짐을 남기면 다음 프레임 배경이 반투명으로 덮여
    // 이전 프레임이 비치는 잔상이 되므로, 새는 곳이 생겨도 한 프레임 안에서 끝나게 한다
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.shadowBlur = 0; ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.setTransform(S.scale, 0, 0, S.scale, S.ox + sx, S.oy + sy);
    // 강타 카메라 펀치: 보스 쪽으로 순간 확대했다 돌아온다
    if (S.punch > 0.02 && g.fight && g.phase === 'boss') { const p = 1 + S.punch * 0.035, fx = g.fight.boss.x, fy = g.fight.boss.y; ctx.translate(fx, fy); ctx.scale(p, p); ctx.translate(-fx, -fy); S.punch *= Math.pow(0.82, S.f60); } else S.punch = 0;
    const watching = viewedPeer();
    if (net) net.setWatch(watching ? watching.id : null);
    // 보스 등장: 보스 쪽으로 밀어 들어가는 확대(그리기 변환만. S.cam은 그대로). 글씨·레터박스는 확대를 풀고 화면 좌표로 그린다
    const intro = g.fight && !laneOn() ? introState() : null;
    if (intro) introCam(ctx, intro);
    watchMoments();
    if (S.kill) drawKillCam(t);
    else if (g.fight && g.phase !== 'wave' && !laneOn()) drawArena(t); else if (watching) drawRemoteLane(t, watching); else drawLane(t);
    // 피해 숫자는 전장 좌표(카메라 그대로, 등장 확대·펀치만 푼다)
    ctx.setTransform(S.scale, 0, 0, S.scale, S.ox + sx, S.oy + sy);
    drawText(ctx);
    // 보스전 화면에서는 여기부터 카메라를 풀고 화면 고정 좌표로 그린다: 보스 체력·남은 시간·기술 이름·안내, 등장 글씨, 알림 띠, 등장 연출
    if (arenaV) {
      hudCam(ctx, 0, 0);
      if (!S.kill && g.phase === 'boss' && !S.stay) drawBossHud(ctx, t); // 게임에 남기의 빈 결투장에는 보스 체력·시간 줄이 없다
      hudCam(ctx, sx, sy);
      if (intro) drawBossIntro(ctx);
    }
    // 보스전: 알림 띠는 기술 이름 띠·기믹 안내가 떠 있으면 그 아래로 내려 그린다(S.hudBottom은 drawBossHud가 매 프레임 적는다. 띠 그림의 위 끝이 y 150)
    const bdy = arenaV && !S.kill && g.phase === 'boss' && S.hudBottom ? Math.max(0, S.hudBottom + 6 - 150) : 0;
    if (bdy) { ctx.save(); ctx.translate(0, bdy); drawBanner(); ctx.restore(); } else drawBanner();
    drawMoments(ctx);
    drawPop(ctx, t, dt);
  }
  // ---- 판의 고비 연출(그리기만. 게임 상태는 읽기만 한다): 라운드 전환, 목숨 잃음, 판 패배 ----
  // 상태가 바뀐 것을 그릴 때 알아챈다(이벤트를 처리하는 16-hud는 건드리지 않는다).
  S.mo = {};
  function watchMoments() {
    const M = S.mo;
    if (M.g !== g) { S.mo = { g, round: g.round, lives: g.lives, over: g.over }; if (g.round === 1 && g.phase === 'wave' && g.time < 3) S.mo.rd = { t: 0, n: 1 }; return; }
    if (g.round !== M.round) { if (g.phase === 'wave' && g.round > M.round) M.rd = { t: 0, n: g.round }; M.round = g.round; }
    if (g.lives < M.lives && !g.over) { M.life = { t: 0 }; S.shake = Math.max(S.shake || 0, 0.35); if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* 진동 없음 */ } } }
    M.lives = g.lives;
    if (g.over && !M.over) {
      M.over = g.over;
      // 패배: 크게 흔들리고 화면 가장자리가 어두운 붉은빛으로 잠기며, 부서진 나무판과 흰 깃발(gfx/defeat_plank)이 떨어진다.
      // S.endHoldUntil: 결과 창을 이 시각(performance.now 기준)까지 미루면 연출이 가려지지 않는다(결과 창은 16-hud가 띄운다).
      if (g.over === 'lose') { M.lose = { t: 0 }; S.shake = Math.max(S.shake || 0, 1); S.endHoldUntil = performance.now() + 1600; if (navigator.vibrate) { try { navigator.vibrate([30, 40, 30]); } catch (e) { /* 진동 없음 */ } } }
    }
  }
  // 화면 가장자리 물들임(가운데는 비고 가장자리만 짙은 판을 색별로 한 번 만들어 둔다)
  function edgeSprite(rgb) { return glowSprite('edge' + rgb, [[0, `rgba(${rgb},0)`], [0.55, `rgba(${rgb},0)`], [0.85, `rgba(${rgb},.55)`], [1, `rgba(${rgb},.9)`]]); }
  function drawEdge(c, rgb, a) {
    if (!(a > 0.01)) return;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = Math.min(1, a);
    const w = view.width, h = view.height, s = Math.hypot(w, h) * 0.5;
    c.drawImage(edgeSprite(rgb), w / 2 - s * 1.05, h / 2 - s * 1.05, s * 2.1, s * 2.1);
    c.restore();
  }
  function drawMoments(c) {
    const M = S.mo, dt = S.fdt, us = uiS();
    // 라운드 전환: 먹 띠(gfx/ui_ink)가 왼쪽에서 그어지고 "라운드 N"이 박혔다가 1.6초 뒤 사라진다
    // 보스 처치 순간에는 미뤘다가 그다음에 띄운다
    // 討伐成功 패널(08-pop drawVictory)이 떠 있는 동안에도 미룬다(패널 글자 뒤로 먹 띠가 비쳤다)
    if (M.rd && !S.kill && !(S.pop && S.pop.vic) && !popQ.some((p) => p.vic)) {
      const k = (M.rd.t += dt), L = 1.6;
      if (k >= L || g.phase !== 'wave' || g.over) M.rd = null;
      else {
        const sw = 1 - Math.pow(1 - Math.min(1, k / 0.25), 3), out = 1 - Math.max(0, (k - L + 0.35) / 0.35), ts = k < 0.08 ? 1.35 : k < 0.32 ? 1.35 - 0.35 * ((k - 0.08) / 0.24) : 1;
        const cy = ROAD.y0 + (ROAD.y1 - ROAD.y0) * 0.3, ink = Art.pic('ui_ink'), txt = `${I.t('round')} ${M.rd.n}`;
        c.save(); c.translate(W / 2, cy); c.scale(us, us); c.globalAlpha = out;
        if (ink) { c.save(); c.beginPath(); c.rect(-260, -60, 520 * sw, 120); c.clip(); c.globalAlpha = out * 0.9; c.drawImage(ink, -260, -46, 520, 92); c.restore(); }
        if (k > 0.08) {
          c.globalAlpha = out * Math.min(1, (k - 0.08) / 0.1); c.scale(ts, ts); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
          c.font = '400 52px "Black Han Sans", sans-serif'; c.lineWidth = 7; c.strokeStyle = 'rgba(14,9,6,.9)'; c.strokeText(txt, 0, 2); c.fillStyle = '#ffe2a8'; c.fillText(txt, 0, 2);
        }
        c.restore();
        // 박히는 순간 금빛 충격파 고리 한 번
        if (k > 0.08 && k < 0.6) Art.fxAnim(c, 'wave', (k - 0.08) / 0.52, W / 2, cy, 700 * us, 700 * us, 0, 0.6 * (1 - (k - 0.08) / 0.52), null, { col: '#ffd890', sy: 0.35 });
      }
    }
    // 목숨 잃음: 화면 가장자리가 붉게 번쩍(0.6초)
    if (M.life) { const k = (M.life.t += dt); if (k >= 0.6) M.life = null; else drawEdge(c, '230,30,20', (k < 0.08 ? k / 0.08 : 1 - (k - 0.08) / 0.52) * 0.85); }
    // 판 패배(라인에서 무너졌거나 보스전 실패): 1.6초
    if (M.lose) {
      const k = (M.lose.t += dt), L = 1.6;
      if (k > 3) M.lose = null;
      else {
        drawEdge(c, '60,6,4', Math.min(1, k / 0.9) * 0.95);
        // 성(또는 경기장 가운데) 위로 연기가 피어오른다
        // 보스전은 화면 고정 좌표로 그리므로(render의 hudCam) 보스의 전장 높이를 화면 고정 좌표로 바꾼다(카메라가 1.2배로 장수를 따라가도 보스 쪽에 피어오르게)
        const fx0 = W / 2, fy0 = g.fight ? (S.camArena ? H / 2 + (g.fight.boss.y - S.cam.y) * S.cam.z : g.fight.boss.y) : H / 2;
        for (let i = 0; i < 3; i++) { const q = (k - i * 0.25) / 1.4; if (q > 0 && q < 1) Art.fxAnim(c, 'smoke', q, fx0 + (i - 1) * 120, fy0 - 40 - q * 60, 420, 420, 0, 0.6 * (1 - q), null, { col: '#3a3028', op: 'source-over' }); }
        // 부서진 나무판과 흰 깃발이 위에서 떨어져 쿵 하고 박힌다
        const pl = Art.pic('defeat_plank');
        if (pl && k > 0.35) {
          const q = Math.min(1, (k - 0.35) / 0.35), y = H * 0.42 - (1 - q * q) * 520, bounce = q >= 1 ? Math.exp(-(k - 0.7) * 8) * Math.sin((k - 0.7) * 22) * 12 : 0;
          if (q >= 1 && !M.lose.hit) { M.lose.hit = 1; S.shake = Math.max(S.shake || 0, 0.6); }
          const pw = 560 * us * 0.8, ph = (pw * pl.height) / pl.width;
          c.save(); c.globalAlpha = Math.min(1, (k - 0.35) / 0.15) * (k > L ? Math.max(0, 1 - (k - L) / 0.6) : 1);
          c.translate(W / 2, y - bounce); c.rotate(-0.06 + (1 - q) * 0.2); c.drawImage(pl, -pw / 2, -ph / 2, pw, ph); c.restore();
          if (M.lose.hit) { const d = Math.min(0.99, (k - 0.7) / 0.6); for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.3; vs(c, 'dust', W / 2 + Math.cos(a) * (80 + d * 160) * us, H * 0.42 + ph * 0.3 - d * 30, 170 * us, a, 0.55 * (1 - d)); } }
        }
      }
    }
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
  // 보스전 화면(S.camArena)은 1.2배로 당겨 내 장수를 따라간다. 터치 기기는 이 배율로 고정, PC는 휠로 1~3.2배.
  const BOSS_Z = 1.2;
  // 화면 고정 좌표: 카메라를 푼 변환(맵 전체가 보이는 배율, 화면 가운데 = (W/2, H/2)). 화면 위 끝의 y는 hudTop(), 글자 배율은 hudS()(uiS에서 카메라 배율을 뺀 것)
  function hudCam(c, sx, sy) { const B = S.base; c.setTransform(B.s0 * B.dpr, 0, 0, B.s0 * B.dpr, (B.sw / 2 - (W / 2) * B.s0) * B.dpr + sx, (B.sh / 2 - (H / 2) * B.s0) * B.dpr + sy); }
  const hudTop = () => H / 2 - S.base.sh / (2 * S.base.s0);
  const hudS = () => Math.max(1, Math.min(1.7, 0.62 / S.base.s0));
  // 화면 위 보스 표시 띠(체력 막대·이름·남은 시간·속공 문구)의 높이를 지금 카메라의 전장 단위로 잰 값(휴대폰 가로 1.2배: 105단위 = 화면 97px@2x)
  // 피해 순위 접힌 줄(05-lane drawMeter: 같은 칸의 y 74~98)의 아래 끝까지를 띠로 본다
  const hudBand = () => (100 * hudS()) / S.cam.z;
  // 터치 기기: 라인 길(또는 결투장)이 화면에 꽉 차게 맞춘다. 바깥 여백(업적 깃발 등)은 손가락으로 끌어서 본다.
  function resetCam() {
    // 라인: 터치 기기도 맵 전체가 보이는 배율(가장 축소한 화면)로 고정한다. 손가락 확대·축소는 막았다(10-input).
    // 보스전: 1.2배, 경기장 가운데에서 시작(등장 연출 → 전투로 넘어갈 때는 보던 높이를 그대로 둔다)
    const was = S.cam;
    S.cam = S.camArena ? { z: BOSS_Z, x: (ARENA.x0 + ARENA.x1) / 2, y: was && was.arena ? was.y : (ARENA.y0 + ARENA.y1) / 2, arena: true } : { z: 1, x: W / 2, y: H / 2 };
    applyCam();
  }
  function applyCam() {
    const B = S.base;
    if (!B) return;
    const c = S.cam;
    c.z = S.coarse ? (S.camArena ? BOSS_Z : 1) : Math.max(1, Math.min(3.2, c.z));
    const s = B.s0 * c.z, vw = B.sw / s, vh = B.sh / s;
    if (S.camArena) {
      // 보스전: 경기장 둘레까지만 본다. 위는 위 난간(바깥 끝이 경계선에서 85단위)이 보스 표시 띠(hudBand) 바로 밑에 오는 데까지, 아래는 아래 난간 가운데 줄(65단위)까지, 양옆은 폭의 10%까지 경기장 밖을 보여 준다.
      // (휴대폰 가로 1.2배: 세로 842단위가 보이고 움직이는 폭은 332단위라, 어디에 서 있어도 경기장 세로의 70% 안팎이 한 화면에 들어온다)
      // 그 범위가 화면보다 좁으면(휴대폰 가로: 경기장 폭이 다 들어온다) 경기장 가운데에 고정한다.
      const x0 = ARENA.x0 - vw * 0.1, x1 = ARENA.x1 + vw * 0.1, y0 = ARENA.y0 - 85 - hudBand(), y1 = ARENA.y1 + 65;
      c.x = vw >= x1 - x0 ? (ARENA.x0 + ARENA.x1) / 2 : Math.max(x0 + vw / 2, Math.min(x1 - vw / 2, c.x));
      c.y = vh >= y1 - y0 ? (y0 + y1) / 2 : Math.max(y0 + vh / 2, Math.min(y1 - vh / 2, c.y));
    } else {
      c.x = vw >= W ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, c.x));
      c.y = vh >= H ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, c.y));
    }
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

