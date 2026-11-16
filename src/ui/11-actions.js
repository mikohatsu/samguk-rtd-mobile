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
    // 판 도중 나가기(설정 탭): 두 번 눌러 확인. 혼자 하는 오프라인 판은 저장해 두고(이어하기) 멈춘다.
    // 협동 방은 오래 자리를 비웠을 때와 같은 길(kicked + leave)로 방에서 나간다. 그 뒤는 결과창의 restart와 같다.
    else if (a === 'quit') {
      if (S.quitArm) {
        S.quitArm = false; saveGame();
        if (lifeOffline()) S.paused = true; else { net.kicked = true; try { net.leave(); } catch (e) { /* 이미 끊김 */ } }
        adThen(() => location.reload());
      } else { S.quitArm = true; toast(t('quitConfirm'), 'warn'); setTimeout(() => { if (S.quitArm) { S.quitArm = false; dirty(); } }, 3000); }
    }
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

