  // ---- 메인 루프 ----
  let last = 0, acc = 0, hub = null, bots = [];
  function saveGame() {
    if (!S.saveOn || !g || g.over) return;
    const s = g.snapshot();
    if (s) { try { localStorage.setItem('rtd-save', JSON.stringify(s)); } catch (e) { /* 저장 공간 없음 */ } }
  }
  function lifeOffline() { return !net || net.t.kind === 'hub'; }
  // 앱을 내렸을 때: 브라우저의 visibilitychange와 앱의 appStateChange(native.js가 'rtd-appstate'로 넘긴다) 둘 다 받는다.
  // iOS에서 제어 센터·전화처럼 화면이 '보이는' 채로 앱이 비활성이 되는 경우를 잡기 위해서다. 두 신호가 겹쳐도 한 번만 처리한다.
  function onHidden(hidden) {
    if (!g || g.over) return;
    if (hidden) { if (S.hiddenAt) return; S.hiddenAt = Date.now(); if (lifeOffline()) S.paused = true; saveGame(); }
    else {
      if (!S.hiddenAt) return;
      if (!lifeOffline() && Date.now() - S.hiddenAt > 60000) { net.kicked = true; try { net.leave(); } catch (e) { /* 이미 끊김 */ } }
      S.hiddenAt = 0; last = performance.now(); dirty();
    }
  }
  document.addEventListener('visibilitychange', () => onHidden(document.hidden));
  window.addEventListener('rtd-appstate', (e) => onHidden(!(e.detail && e.detail.active)));
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
    // 쉬는 화면: 일시정지(창은 DOM이라 캔버스가 멈춰도 보인다), 또는 판이 끝나고 승리·등장 연출과 경험치 연출이 다 끝난 결과 화면.
    // 이때는 초당 5번만 그린다(발열·배터리). 글자판을 고칠 일이 있으면(needs) 바로 돈다. 튜토리얼 설명 중에는 그대로 그린다.
    const idle = !S.tutHold && ((S.paused && !g.over) || (g.over && !S.pop && !popQ.length && !S.xpPlaying));
    if (idle && !needs && now - lastDraw < 200) return;
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

