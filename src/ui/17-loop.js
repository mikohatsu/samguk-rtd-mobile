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
    if (S.stay) { stayStep(dt); drainEvents(); return; } // 게임에 남기: 판 계산·통신·AI는 돌리지 않고 내 유닛·장수만 움직인다
    // 신화·불멸 컷신 동안은 시간이 멈추고, 보스전은 항상 1배속이다
    const held = net && (net.clock.pz || net.kicked);
    if (S.freeze > 0) { S.freeze -= dt; acc = 0; }
    else if (S.hitStop > 0) { S.hitStop -= dt; acc = 0; } // 강타 히트스톱(혼자 할 때만)
    else if (held || S.mutHold) acc = 0; // mutHold: 악몽 +N 규칙 등장 연출 중(17b-mutintro). 통신 상태 알림은 아래에서 계속 보낸다
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
      if (!held && !(S.freeze > 0) && !S.mutHold) b.brain.update(dt);
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
  let fBud = 0, fPrev = 0; // 그리기 예산(ms)과 직전 rAF 시각
  function loop(now) {
    requestAnimationFrame(loop);
    if (!g) return;
    // 화면 주사율과 상관없이 초당 약 60번만 그린다(120Hz에서 두 배로 그려 봐야 발열·끊김만 늘어난다).
    // 고정 문턱(직전 그림에서 14ms)이면 90Hz는 11ms 프레임을 건너뛰고 22ms마다 그려 45fps에 묶인다(144Hz는 48fps).
    // 그래서 흐른 시간을 예산으로 모아 16.7ms가 차면 그린다(2ms 여유). 남은 몫은 다음으로 넘겨 90Hz는 11·22ms를 번갈아 평균 60번이 된다.
    // 남은 몫은 8ms까지만 넘겨 멈칫한 뒤에 몰아 그리지 않는다.
    fBud += Math.max(0, Math.min(100, now - (fPrev || now - 16.7))); fPrev = now;
    // 30fps 제한: 배터리·발열용. 시뮬레이션은 흐른 시간만큼 따라잡는다.
    if (Q.fps30 && now - lastDraw < 30) return;
    if (fBud < 16.7 - 2) return;
    fBud = Math.min(fBud - 16.7, 8);
    // 쉬는 화면: 일시정지(창은 DOM이라 캔버스가 멈춰도 보인다), 또는 판이 끝나고 승리·등장 연출과 경험치 연출이 다 끝난 결과 화면.
    // 이때는 초당 5번만 그린다(발열·배터리). 글자판을 고칠 일이 있으면(needs) 바로 돈다. 튜토리얼 설명 중에는 그대로 그린다.
    // 패배 연출 중(performance.now() < S.endHoldUntil)은 쉬는 화면에서 빼서 연출이 끊기지 않게 한다
    const idle = !S.tutHold && ((S.paused && !g.over) || (g.over && !S.stay && !S.pop && !popQ.length && !S.xpPlaying && now >= (S.endHoldUntil || 0) && !(S.kill && killOn())));
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
  // ---- 게임에 남기(2026-11-25): 결과창을 닫고 끝난 판의 전장에 남아 내 유닛·장수를 보고 움직이며 논다 ----
  // 판은 이미 끝났으므로(g.over 그대로) 엔진 계산(g.step)·라운드·결과 보고·전적은 다시 돌지 않는다. 결과·보상·기록은 'over' 때 한 번 보낸 것으로 확정이다.
  // - 라인: 남은 적·상자·아이템은 치운다(유닛이 적을 쳐 금화·처치 수가 늘거나 상자를 열지 않게). 유닛 선택·이동·정보 보기만.
  // - 보스전 화면: 이 판의 마지막 결투장에 내 출전 장수를 되살려 세운다(보스·장판·동료 장수는 없음). 조이스틱 이동·공격 동작만, 스킬·이동기·치료는 없다.
  // - 협동: 통신을 판에서 떼어(net.attach(null)) 동료 신호를 받지도 보내지도 않는다. 각자 따로 남는다.
  // 되는 행동은 11-actions의 STAY_OK. 합성·해산·뽑기·강화·선택권·명사·자동·배속은 막는다.
  function stayFight(F) {
    if (!F || !F.def || !F.boss) return null;
    const mine = F.champs.filter((c) => c.owner === g.me.idx);
    if (!mine.length) return null;
    const champs = mine.map((c, i) => {
      const y = Math.max(ARENA.y0 + 40, Math.min(ARENA.y1 - 40, 310 + i * 300));
      return Object.assign({}, c, { dead: false, bench: false, hp: c.mhp, x: 340, y, tx: 340, ty: y, move: false, chase: false, joy: null, tgt: null, atkHold: 0, atkLock: 0, kt: 0, cd: 0, atkT: 0, moveT: 0, inv: 0, hurt: 0, ai: false, skillCd: (c.skillCd || []).map(() => 0), dashCd: 0 });
    });
    return Object.assign({}, F, { champs, hazards: [], ghosts: {}, sel: 0, t: 0, picked: true, mech: Object.assign({}, F.mech, { hide: true, objs: [], cast: null, charmT: 0, ctr: 0, gr: 0, ampT: 0 }), boss: Object.assign({}, F.boss, { hp: 0, charge: null, burnT: 0, stun: 0 }) });
  }
  function stayEnter() {
    if (!g || !g.over || S.stay || !(S.es && S.es.open)) return;
    if (net) { try { net.attach(null); } catch (e) { /* 이미 끊김 */ } }
    S.stay = { arena: false, fight: stayFight(g.fight || S.lastArena) };
    g.enemies = []; g.drops = []; g.laneJoy = null; g.fight = null; g.phase = 'wave';
    S.view = null; S.drawer = null; S.ticket = null; S.combineAsk = null; S.dropSel = null; S.rsel = null; S.cmdMode = null; S.drag = null;
    S.kill = null; S.lastFight = null; S.pattern = null; S.banner = null; S.laneView = false; S.allyOpen = false;
    setSel([]);
    $('stage').classList.add('stay');
    $('overlay').dataset.key = '';
    last = performance.now();
  }
  function stayView() {
    const st = S.stay;
    if (!st || !st.fight) return;
    st.arena = !st.arena;
    if (st.arena) { g.fight = st.fight; g.phase = 'boss'; st.fight.sel = 0; }
    else { g.fight = null; g.phase = 'wave'; S.lastFight = null; S.kill = null; } // 07-arena watchKill이 처치 연출로 착각하지 않게
    setSel([]); S.cmdMode = null; S.drag = null; S.dropSel = null;
    $('stage').classList.toggle('stayarena', st.arena);
  }
  // 남은 동안의 계산: 라인은 유닛 이동(조이스틱·이동 명령. 적이 없으니 치지 않는다), 보스전 화면은 내 장수 이동과 빈 공격 동작
  function stayStep(dt) {
    if (g.phase === 'boss' && g.fight) g.localChamps().forEach((c) => stayChamp(c, dt));
    else g.stepUnits(dt);
    g.stepFx(dt);
  }
  function stayChamp(c, dt) {
    const sp = 250;
    c.cd -= dt; c.atkT = Math.max(0, (c.atkT || 0) - dt); c.moveT = Math.max(0, (c.moveT || 0) - dt);
    if (c.atkHold > 0) c.atkHold -= dt;
    const j = c.joy, jm = j ? Math.hypot(j.x, j.y) : 0;
    if (jm > 0.1) {
      c.move = false;
      const s = sp * Math.min(1, jm / 0.5) * dt;
      c.x = Math.max(ARENA.x0, Math.min(ARENA.x1, c.x + (j.x / jm) * s)); c.y = Math.max(ARENA.y0, Math.min(ARENA.y1, c.y + (j.y / jm) * s));
      c.face = Math.atan2(j.y, j.x); c.moveT = 0.12;
    } else if (c.move) {
      const m = Math.hypot(c.tx - c.x, c.ty - c.y);
      if (m < 6) c.move = false;
      else { const s = Math.min(m, sp * dt); c.x += ((c.tx - c.x) / m) * s; c.y += ((c.ty - c.y) / m) * s; c.face = Math.atan2(c.ty - c.y, c.tx - c.x); c.moveT = 0.12; }
    }
    // 공격 버튼: 보는 방향으로 한 번 휘두르거나 쏜다(맞을 것은 없다)
    if (c.atkHold > 0 && c.cd <= 0 && jm <= 0.1) {
      c.cd = g.attackTime(c.def); c.atkT = 0.24;
      const a = c.face || 0, wp = g.weapon(c.def), col = g.shotColor(c.def);
      g.fx.push({ k: 'shot', wp, big: true, x0: c.x, y0: c.y, x1: c.x + Math.cos(a) * 140, y1: c.y + Math.sin(a) * 140, t: 0, life: 0.26, c: col });
      Snd.play(wp, 70);
    }
  }
  // 판 표를 못 받았을 때 다시 받는 간격(ms)
  const TICKET_RETRY_MS = [3000, 6000, 12000, 24000];
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
        const b = pool.splice((Math.random() * pool.length) | 0, 1)[0], bn = hub.join(I.t('ai_' + b.id)); // 동맹 이름은 문구표(ai_<빌드 id>)로 4개 언어
        const bg = new E.Game(T, { diff: opt.diff, mode: 'multi', seed: opt.seed + i + 1, net: bn, bot: true, muts: opt.muts, mutLv: opt.mutLv });
        bn.attach(bg);
        bots.push({ g: bg, net: bn, brain: new window.RTD_AI.Brain(bg, b) });
      }
    }
    g = opt.snap ? E.Game.restore(T, opt.snap) : new E.Game(T, opt);
    // 설정 「인연 유지」(기본 켬): 자동 조합이 켜진 인연 단계의 마지막 한 기를 남긴다. 기기 설정 'rtd-keepsyn' = '0'이면 끔
    try { g.keepSyn = localStorage.getItem('rtd-keepsyn') !== '0'; } catch (e) { g.keepSyn = true; }
    // 신화·불멸 체험(opt.trial, trial-mode.md): 저장·판 표·결과 보고·전적·튜토리얼·광고 없음. S.trial = { unit }
    S.trial = g.trial ? opt.trial : null; S.trialFx = null;
    // 오프라인 혼자 하기만 자동 저장한다(앱이 꺼져도 이어하기). 체험은 저장하지 않는다(rtd-save에 있던 일반 판 이어하기도 그대로 남는다)
    S.saveOn = !S.trial && !opt.online && !opt.ai && !opt.net && (opt.mode || 'solo') === 'solo'; S.saveT = 0;
    // 판 표: 로그인해 있으면 서버에서 받아 둔다(결과·전적은 이 표가 있어야 서버가 받는다). 이어하기는 저장해 둔 표를 다시 쓴다.
    // 판 표는 S.gameTk에 둔다(S.ticket은 선택권 창이 쓰는 값이라 같이 쓰면 선택권을 쓸 때 판 표가 지워진다).
    // 표를 못 받으면(끊김·서버 오류) 3·6·12·24초 뒤에 다시 받는다. 판이 끝났거나 다른 판이 시작됐으면 멈춘다.
    // 끝까지 못 받은 채 판이 끝나면 결과 화면에서 알린다(S.tkWant = 이 판은 표를 받아야 하는 판, S.tkMiss = 못 받고 끝남).
    S.ticket = null; S.gameTk = null; S.tkWant = false; S.tkMiss = false;
    if (ACC.token && !S.trial) { // 체험은 서버에 판 표를 받지 않는다(서버 통신 0회)
      if (opt.snap) { try { S.gameTk = localStorage.getItem('rtd-save-tk') || null; } catch (e) { /* 저장 불가 */ } }
      else {
        const saveOn = !opt.online && !opt.ai && !opt.net && (opt.mode || 'solo') === 'solo';
        const mine = g, waits = TICKET_RETRY_MS.slice();
        S.tkWant = true;
        const ask = () => api('/api/game/start', { diff: opt.diff, mutLv: opt.mutLv || 0, room: (opt.net && opt.net.code) || undefined }).then((r) => {
          if (g !== mine) return; // 그 사이 다른 판이 시작됐다
          if (r.ticket) { S.gameTk = r.ticket; if (saveOn) { try { localStorage.setItem('rtd-save-tk', r.ticket); } catch (e) { /* 저장 불가 */ } } return; }
          // 로그인이 풀렸거나(401) 요청이 잘못됐으면(400) 다시 해도 같다
          if (r.status === 401 || r.status === 400 || g.over || !waits.length) return;
          setTimeout(() => { if (g === mine && !g.over && !S.gameTk) ask(); }, waits.shift());
        });
        ask();
      }
    }
    S.everSel = false; S.frontWarned = false; S.fromSnap = !!opt.snap; S.endHoldUntil = 0; S.toastHoldUntil = 0; S.toastQ = []; S.vicUntil = 0;
    arenaFree(S.arenaUsed); S.arenaUsed = null; // 지난 판의 결투장 캔버스(07-arena)
    S.es = null; S.stay = null; S.lastArena = null; S.repDone = false; S.xpFrom = null; $('stage').classList.remove('stay');
    S.online = !!opt.online; S.gameKey = opt.key || null; S.reported = false; S.xpGained = null; S.coinGained = 0; S.xpDone = false; S.xpPlaying = false; S.overAt = 0; S.paused = false;
    if (opt.net) { net = opt.net; net.onLobby = null; net.attach(g); speed = 1; }
    Snd.init();
    S.tutHold = false;
    // 첫 오프라인 혼자 하기(이어하기 제외)에서 튜토리얼
    // 자동 배치(1~3성 자동 합성·정렬)는 기본으로 꺼 둔다. 직접 켠 사람만 그 선택을 기억해 다음 판에도 켠다('rtd-auto' = '1').
    // 튜토리얼이 자동 버튼을 가르친다. 건너뛰어도 켜지 않는다.
    const autoOnAll = () => ['t1', 't2', 't3'].forEach((k) => g.setAuto(g.me, k, true));
    let autoPref = false; try { autoPref = localStorage.getItem('rtd-auto') === '1'; } catch (e) { /* 저장 불가 */ }
    // 팁(명사·시너지)은 모든 판에서 보고, 단계 안내는 혼자 하는 오프라인 새 판에서만(tutorial)
    const tutOn = !!(window.RTD_TUT && window.RTD_TUT.maybeStart({ get g() { return g; }, S, T, t: I.t, dirty, tutorial: S.saveOn && !opt.snap, onSkip: () => { if (autoPref) autoOnAll(); dirty(); } }));
    if (!opt.snap && !tutOn && autoPref && !S.trial) autoOnAll();
    window.__rtd = { g, S, begin, net, bots, cv: () => ({ mode: CV, swaps: cvSwaps, gl: !!ctx.isGL, w: view.width, h: view.height }), xp: playXp, frame: (now) => { tick(now, 0.1); render(now); renderPane(); renderInfo(); renderTimers(); renderOverlay(); }, tick, render, dom: () => { renderPane(); renderInfo(); renderTimers(); renderOverlay(); } };
    view.focus({ preventScroll: true });
    last = performance.now();
    // 악몽 +N: 이번 판 규칙을 도장 찍듯 보여 주는 동안 멈춘다(이어하기는 이미 본 판이라 생략)
    S.mutHold = false;
    if (!opt.snap && g.muts && g.muts.length) mutIntro(g);
  }

