  // 조합 전 시너지 확인: 꺼지거나 단계가 내려가는 시너지가 있으면 S.combineAsk에 담고 true(조합은 확인 창에서)
  function combinePlanOf(kind, id) { return kind === 'craft' ? g.craftPlan(g.me, id) : g.combinePlan(g.me, id); }
  function askCombine(kind, id, uid) {
    const lost = g.synergiesLostByCombine(g.me, combinePlanOf(kind, id));
    if (!lost.length) return false;
    // 오른쪽 서랍(z-index 40)이 확인 창을 가리므로 잠시 닫았다가, 고른 뒤 다시 연다
    S.combineAsk = { a: kind, id, uid, lost, drawer: S.drawer };
    S.drawer = null;
    return true;
  }
  // 탈락(관전) 중에 되는 행동: 보기·설정·나가기만. 내 라인·장수를 바꾸는 행동은 막는다(10-input spect)
  const SPECT_OK = new Set(['tab', 'drawer', 'drawerClose', 'selExp', 'langSet', 'gfx', 'fps30', 'keepSyn', 'perf', 'credits', 'desel', 'esc', 'ucard', 'statDet', 'viewPeer', 'allyList', 'laneView', 'vol', 'book', 'timer', 'quit', 'restart', 'again', 'resume', 'tutReset', 'lang', 'ticketClose', 'combineNo', 'speed']);
  // 게임에 남기(끝난 판의 전장, 17-loop stayEnter) 동안 되는 행동: 보기·선택·이동·설정·로비로. 판을 바꾸는 행동(합성·해산·뽑기·강화·선택권·명사·자동·배속·스킬)은 막는다.
  // 서랍은 설정 탭만(강화·명사·선택권 탭은 살 수 있는 버튼이 있어서)
  const STAY_OK = new Set(['drawer', 'tab', 'drawerClose', 'selExp', 'langSet', 'gfx', 'fps30', 'perf', 'credits', 'desel', 'esc', 'ucard', 'statDet', 'selDef', 'amove', 'modeMove', 'stop', 'champ', 'vol', 'restart', 'quit', 'lang', 'stayView']);
  // ---- 행동: DOM 갱신 중에도 놓치지 않게 pointerdown 위임으로 받는다 ----
  // 판 상태를 바꾸는 행동은 모두 입력 명령(g.input, engine.js CMD)으로 넣는다 — 걸음 번호와 함께 기록되어 서버가 같은 판을 다시 돌린다(2026-11-26).
  // 화면 상태(S.*)·설정·소리만 바꾸는 행동은 그대로.
  function doAct(a, arg) {
    if (spect() && (!SPECT_OK.has(a) || (a === 'viewPeer' && arg === 'me'))) return;
    if (S.stay && (!STAY_OK.has(a) || ((a === 'drawer' || a === 'tab') && arg !== 'set'))) return;
    Snd.play('click', 40);
    const p = g && g.me, list = g ? selUnits() : [], u = list[0];
    if (a === 'tab') { S.tab = arg; S.drawer = arg; }
    else if (a === 'drawer') { if (S.drawer === arg) S.drawer = null; else { S.drawer = arg; S.tab = arg; } }
    else if (a === 'drawerClose') S.drawer = null;
    else if (a === 'autoAll') { const on = !['t1', 't2', 't3'].every((k) => p.auto[k]); ['t1', 't2', 't3'].forEach((k) => g.input('au', [k, on ? 1 : 0])); try { localStorage.setItem('rtd-auto', on ? '1' : '0'); } catch (e) { /* 저장 불가 */ } toast(on ? t('autoToastOn') : t('autoToastOff'), on ? 'good' : ''); }
    else if (a === 'selExp') S.selExp = !S.selExp;
    // 언어: 로비에서는 저장하고 바로 다시 불러온다(I.setLang). 판 안에서는 저장만 하고 로비로 돌아가면 바뀐다고 알린다.
    else if (a === 'langSet') { if (arg !== I.lang) { if (!g) { I.setLang(arg); return; } try { localStorage.setItem('rtd-lang', arg); } catch (e) { /* 저장 불가 */ } toast(I.LANGS.find(([k]) => k === arg)[1] + ' — ' + t('langLater'), 'good'); } }
    else if (a === 'gfx') { if (Q.level !== arg) { Q.level = arg; Q.rs = 1; applyQuality(); sizeMap(); if (g) fit(); } }
    else if (a === 'fps30') { Q.fps30 = !Q.fps30; applyQuality(); }
    else if (a === 'keepSyn') { if (g) { g.input('ks', [g.keepSyn ? 0 : 1]); try { localStorage.setItem('rtd-keepsyn', g.keepSyn ? '1' : '0'); } catch (e) { /* 저장 불가 */ } } }
    else if (a === 'perf') { Q.perf = !Q.perf; applyQuality(); }
    else if (a === 'credits') { if (window.RTD_CREDITS) window.RTD_CREDITS.open(); }
    else if (a === 'desel') { setSel([]); S.dropSel = null; S.rsel = null; setMode(null); }
    else if (a === 'amove') { if (inBoss() || S.sel.length) setMode('amove'); }
    else if (a === 'modeMove') { if (inBoss() || S.sel.length) setMode('move'); }
    else if (a === 'stop') { if (inBoss()) g.input('as', []); else g.input('mv', ['focus', 0, 0].concat(S.sel)); setMode(null); }
    else if (a === 'esc') setMode(null);
    // 직접 누른 조합·제작이 켜져 있는 인연 시너지를 끄거나 단계를 내리면 먼저 묻는다(16-hud renderOverlay의 확인 창). 자동 조합·AI 동맹은 묻지 않는다.
    // arg가 있으면 다중 선택 묶음 카드의 合成: 그 유닛으로 합성한다(13-info-timers renderInfo)
    else if (a === 'combine') { const cu = arg ? list.find((x) => x.def.id === arg) : u; if (cu && !askCombine('combine', cu.def.id, cu.id)) { const n = g.input('cb', [cu.def.id, cu.id]); if (n) setSel([n.id]); } }
    else if (a === 'combineGo') { const c = S.combineAsk; S.combineAsk = null; if (c) { if (c.drawer) S.drawer = c.drawer; const n = c.a === 'craft' ? g.input('cr', [c.id]) : g.input('cb', [c.id, c.uid || 0]); if (n) setSel([n.id]); } }
    else if (a === 'combineNo') { const c = S.combineAsk; S.combineAsk = null; if (c && c.drawer) S.drawer = c.drawer; }
    // 해산은 되돌릴 수 없어 두 번 누른다: 처음 누르면 버튼이 '한 번 더'로 바뀌고 3초 안에 같은 유닛으로 다시 눌러야 해산한다(설정의 나가기와 같은 방식)
    else if (a === 'sell') {
      if (list.length === 1 && u.def.tier === 1) {
        if (S.sellArm === u.id) { S.sellArm = null; const v = g.input('sl', [u.id]); toast(I.t('disbanded', { a: u.def.name, c: T.currency, v }), 'good'); }
        else { const id = u.id; S.sellArm = id; setTimeout(() => { if (S.sellArm === id) { S.sellArm = null; dirty(); } }, 3000); }
      }
    }
    else if (a === 'ucard') S.ucard = !S.ucard;
    else if (a === 'speed') { speed = speed === 3 ? 1 : speed + 1; if (net) net.speedWant = speed; }
    else if (a === 'myview') S.view = null;
    else if (a === 'statDet') { S.statDet = !S.statDet; const sb = $('selbar'); if (sb && S.statDet) sb.classList.add('exp'); }
    else if (a === 'viewPeer') { S.view = arg === 'me' || S.view === arg ? null : arg; setSel([]); S.dropSel = null; S.allyOpen = false; }
    else if (a === 'allyList') S.allyOpen = !S.allyOpen;
    else if (a === 'laneView') { if (g.phase === 'boss' && !g.trial) { S.laneView = !S.laneView; S.cmdMode = null; S.drag = null; } }
    else if (a === 'auto') g.input('au', [arg, p.auto[arg] ? 0 : 1]);
    else if (a === 'zone') { const [k, z] = arg.split(':'); g.input('zn', [k, z]); }
    else if (a === 'vol') {
      // 소리 크기: − / ＋ 버튼으로 25%씩(0~100%). arg = 'sfx:-' · 'sfx:+' · 'bgm:-' · 'bgm:+'
      const [key, dir] = String(arg).split(':'), next = Math.max(0, Math.min(1, (Math.round(Snd.state[key] * 4) + (dir === '-' ? -1 : 1)) / 4));
      if (key === 'sfx') Snd.setSfx(next); else Snd.setBgm(next);
    }
    else if (a === 'book') S.book = S.book === arg ? null : arg;
    else if (a === 'timer') { const el = document.querySelector(`.tw[data-r="${arg}"]`); if (el) el.classList.toggle('open'); }
    else if (a === 'useDrop') { if (S.dropSel && g.drops.some((d) => d.id === S.dropSel && d.kind !== 'item')) setMode('use'); }
    else if (a === 'up') g.input('up', [arg]);
    else if (a === 'craft') { if (!askCombine('craft', arg)) { const n = g.input('cr', [arg]); if (n) setSel([n.id]); } }
    else if (a === 'hire') g.input('hi', [arg]);
    else if (a === 'fuse') { const n = g.input('fu', [S.dropSel || 0]); if (n) S.dropSel = n.id; }
    else if (a === 'dismiss') { if (S.dismiss === arg) { g.input('dm', [arg]); S.dismiss = null; } else { S.dismiss = arg; toast(I.t('dismissConfirm', { a: defOf[arg].name }), 'warn'); setTimeout(() => { if (S.dismiss === arg) S.dismiss = null; }, 3000); } }
    else if (a === 'ticket') { S.ticket = +arg; S.ticketPh = g.phase; S.drawer = 'ticket'; S.tab = 'ticket'; }
    else if (a === 'ticketPick') { g.input('tk', [S.ticket, arg]); if (!(p.tickets[S.ticket] > 0)) S.ticket = null; }
    else if (a === 'ticketClose') S.ticket = null;
    else if (a === 'selDef') setSel(list.filter((x) => x.def.id === arg).map((x) => x.id));
    else if (a === 'pick') { const id = +arg, i = S.pick.indexOf(id); if (i >= 0) S.pick.splice(i, 1); else { S.pick.push(id); if (S.pick.length > g.slotCount()) S.pick.shift(); } }
    else if (a === 'pickGo') { g.input('pk', S.pick.slice()); S.pick = []; }
    else if (a === 'sub') g.input('sb', [+arg]);
    else if (a === 'skill') { if (g.active()) g.input('sk', [+arg, S.mouse.x, S.mouse.y]); }
    // 스킬 막대를 눌러 쓸 때는 마우스가 막대 위에 있으므로 보스를 겨눈다
    else if (a === 'skillBar') { const c = g.active(), b = g.fight && g.fight.boss; if (c && b) g.input('sk', [+arg, b.x, b.y]); }
    else if (a === 'heal') g.input('hl', []);
    else if (a === 'dash') { if (g.active()) g.input('ds', [S.mouse.x, S.mouse.y]); }
    else if (a === 'champ') g.input('sc', [+arg]);
    else if (a === 'restart') adThen(() => location.reload());
    // 체험 결과 카드: 로비로 돌아가 상점 해금 탭의 그 장수 카드를 연다(lobby.js trialBack). 광고(adThen)를 거치지 않는다.
    // trialUnlock은 카드의 해금 버튼을 강조한다(해금 자체는 카드의 기존 버튼을 눌러야 한다)
    else if (a === 'trialUnlock' || a === 'trialBack') trialLeave(a === 'trialUnlock');
    // 결과창 '게임에 남기': 결과창을 닫고 끝난 판의 전장에 남는다(17-loop). 결과창 버튼이 열린 뒤에만
    else if (a === 'stay') stayEnter();
    else if (a === 'stayView') stayView();
    // 결과창 '같은 설정으로 다시': 다시 불러온 뒤 로딩이 끝나면 마지막 설정으로 바로 시작한다(19-title startAgain)
    else if (a === 'again') { try { sessionStorage.setItem('rtd-again', '1'); } catch (e) { /* 저장 불가 */ } adThen(() => location.reload()); }
    // 판 도중 나가기(설정 탭): 두 번 눌러 확인. 혼자 하는 오프라인 판은 저장해 두고(이어하기) 멈춘다.
    // 협동 방은 오래 자리를 비웠을 때와 같은 길(kicked + leave)로 방에서 나간다. 그 뒤는 결과창의 restart와 같다.
    // 탈락(관전) 중에 나가면 지금 라운드로 패배 결과를 남긴다: 판을 끝내 결과 보고(reportResult)·전적을 처리하고, 보고가 끝나거나 3초 뒤 나간다.
    else if (a === 'quit') {
      if (S.quitArm) {
        S.quitArm = false;
        if (g.trial) { S.paused = true; trialLeave(false, true); return; } // 체험 중 나가기: 저장·광고 없이 로비로
        saveGame();
        let rep = null;
        if (!lifeOffline() && spect()) { g.finish(false); drainEvents(); rep = S.repP; }
        if (lifeOffline()) S.paused = true; else { net.kicked = true; try { net.leave(); } catch (e) { /* 이미 끊김 */ } }
        const go = () => adThen(() => location.reload());
        if (rep) Promise.race([rep.catch(() => {}), new Promise((r) => setTimeout(r, 3000))]).then(go); else go();
      } else { S.quitArm = true; toast(t('quitConfirm'), 'warn'); setTimeout(() => { if (S.quitArm) { S.quitArm = false; dirty(); } }, 3000); }
    }
    else if (a === 'resume') { S.paused = false; last = performance.now(); }
    else if (a === 'volunteer') { if (net && net.volunteer) net.volunteer(); }
    else if (a === 'tutReset') { if (window.RTD_TUT) window.RTD_TUT.reset(); toast(I.t('tutReplayHint'), 'good'); }
    else if (a === 'lang') { I.setLang(arg); }
    dirty();
  }
  // 체험 판을 떠나 로비로: 상점 해금 탭의 그 장수 카드로 돌아갈 곳을 sessionStorage에 남긴다(나가기는 상점으로 데려가지 않는다)
  function trialLeave(cta, plain) {
    if (!plain) { try { sessionStorage.setItem('rtd-trial-back', JSON.stringify({ id: g.trial.unit, cta: !!cta })); } catch (e) { /* 저장 불가 */ } }
    location.reload();
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

