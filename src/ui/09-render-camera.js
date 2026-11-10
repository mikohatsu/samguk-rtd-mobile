  function render(now) {
    const t = now / 1000;
    S.shake = Math.max(0, (S.shake || 0) - 0.06);
    const sx = (Math.random() - 0.5) * 14 * (S.shake || 0) * S.scale, sy = (Math.random() - 0.5) * 14 * (S.shake || 0) * S.scale;
    const ph = g.phase + (S.laneView ? 'L' : '') + (viewedPeer() ? 'V' : '');
    if (S.camPh !== ph) { S.camPh = ph; resetCam(); }
    if (inBoss() && performance.now() > (S.camHold || 0) && S.cam.z > 1.01) { const ac = g.active(); if (ac) { S.cam.x += (ac.x - S.cam.x) * 0.1; S.cam.y += (ac.y - S.cam.y) * 0.1; } }
    applyCam();
    ctx.setTransform(S.scale, 0, 0, S.scale, S.ox + sx, S.oy + sy);
    // 강타 카메라 펀치: 보스 쪽으로 순간 확대했다 돌아온다
    if (S.punch > 0.02 && g.fight && g.phase === 'boss') { const p = 1 + S.punch * 0.035, fx = g.fight.boss.x, fy = g.fight.boss.y; ctx.translate(fx, fy); ctx.scale(p, p); ctx.translate(-fx, -fy); S.punch *= 0.82; } else S.punch = 0;
    const watching = viewedPeer();
    if (net) net.setWatch(watching ? watching.id : null);
    if (g.fight && g.phase !== 'wave' && !laneOn()) drawArena(t); else if (watching) drawRemoteLane(t, watching); else drawLane(t);
    drawText(ctx); drawBanner();
    const dt = Math.min(0.1, (now - (S.lastNow || now)) / 1000); S.lastNow = now;
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
    const z = B && S.coarse ? Math.min(B.sw / (r.x1 - r.x0 + pad * 2), B.sh / (r.y1 - r.y0 + pad * 2)) / B.s0 : 1;
    S.cam = { z, x: S.coarse ? (r.x0 + r.x1) / 2 : W / 2, y: S.coarse ? (r.y0 + r.y1) / 2 : H / 2 };
    applyCam();
  }
  function applyCam() {
    const B = S.base;
    if (!B) return;
    const c = S.cam;
    c.z = Math.max(1, Math.min(3.2, c.z));
    const s = B.s0 * c.z, vw = B.sw / s, vh = B.sh / s;
    c.x = vw >= W ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, c.x));
    c.y = vh >= H ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, c.y));
    S.scale = s * B.dpr; S.ox = (B.sw / 2 - c.x * s) * B.dpr; S.oy = (B.sh / 2 - c.y * s) * B.dpr;
  }
  function fit() {
    const st = $('stage'), sw = st.clientWidth, sh = st.clientHeight, dpr = Math.min((window.devicePixelRatio || 1) * zoom, qDpr());
    view.style.width = sw + 'px'; view.style.height = sh + 'px';
    view.width = Math.round(sw * dpr); view.height = Math.round(sh * dpr);
    const first = !S.base;
    S.base = { sw, sh, dpr, s0: Math.min(sw / W, sh / H) };
    if (first) resetCam(); else applyCam();
  }
  window.addEventListener('resize', () => { applyZoom(); if (g) fit(); });
  applyZoom();

