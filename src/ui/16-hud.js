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
  const rIcon = (k) => (RAIL_PIC[k] ? `<img class="ri" alt="" src="gfx/ic_${k}.png?v=5">` : `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${RAIL_ICON[k]}"/></svg>`);
  function renderHud() {
    const vp = viewedPeer(), ln = vp && vp.state.ln;
    const gold = ln ? +ln.g || 0 : g.me.gold, lives = ln ? ln.l | 0 : g.lives, en = ln ? ln.n | 0 : g.enemyCount(), own = ln ? (ln.u || []).length : g.units.filter((u) => u.owner === 0).length;
    const tm = g.phase === 'wave' ? clock(Math.max(0, g.R.roundTime - g.roundT)) : g.phase === 'boss' && g.fight ? clock(Math.max(0, g.fight.limit - g.fight.t)) : '-';
    const cell = (l, v, cls) => `<div class="hs ${cls || ''}"><small>${l}</small><b>${v}</b></div>`;
    let h = `<div class="hrow">${cell(t('round'), `${g.round}/${g.diff.rounds}`)}${cell(g.phase === 'wave' ? t('timeLeft') : t('duel'), tm)}${cell(T.currency, fmt(gold), 'gold')}${g.phase === 'boss' && !S.laneView ? '' : cell(t('lives'), lives, lives <= 5 ? 'alert' : '') + cell(t('front'), `${en}/${g.limit}`, en > g.limit * 0.75 ? 'alert' : '') + cell(t('troops'), own)}</div>`;
    const hd = S.hudNext || {};
    const chips = (hd.mids || []).map((m) => `<span class="nc mid" data-act="drawer" data-arg="war">${Array.isArray(m) ? `<span class="nw">${esc(m[0])}</span> <span class="nw">${esc(m[1])}</span>` : esc(m)}</span>`).join('') + (hd.boss ? `<span class="nc boss" data-act="drawer" data-arg="war">${t('nextBoss')}<br><b>${esc(hd.boss)}</b></span>` : '');
    // 자리 비운 동료(앱을 내림)
    const aw = net && net.awayList ? net.awayList().map((p) => `<span class="nc mid">${esc(p.state.name || '?')} · ${t('away')}</span>`).join('') : '';
    if (chips || aw) h += `<div class="hrow">${chips}${aw}</div>`;
    // 파티원(세로, 반투명): 아이콘·닉네임·등급 문양·전선·라이프. 누르면 그 사람 전장을 본다(내 줄은 내 전장으로)
    if (net && net.roster && g.mode === 'multi') {
      const ros = net.roster(), lim = g.limit;
      const rows = ros.map((pp) => {
        const st = pp.state || {}, ln = pp.me ? null : st.ln;
        const en = pp.me ? g.enemyCount() : ln ? ln.n | 0 : st.enemies == null ? null : st.enemies | 0, lv = pp.me ? g.lives : ln ? ln.l | 0 : null; // 남이 보낸 값은 숫자로만 쓴다
        const d = defOf[st.ic] || defOf.cav, rk = /(\d+)$/.exec(st.gr || '') ? +/(\d+)$/.exec(st.gr)[1] : null;
        const on = pp.me ? !S.view : S.view === pp.id;
        return `<button class="pm ${on ? 'on' : ''} ${st.away ? 'away' : ''}" data-act="viewPeer" data-arg="${pp.me ? 'me' : esc(pp.id)}" type="button"><img class="pi" alt="" src="${Art.portrait(d)}"><span class="pn">${rk != null ? `<img class="rkm" alt="" src="gfx/rank_${rk}.png" onerror="this.remove()">` : ''}${esc(st.name || '?')}</span><span class="ps">${t('front')} ${en == null ? '-' : en}/${lim} <span class="lf" aria-label="${esc(t('lives'))}">♥${lv == null ? '-' : lv}</span></span></button>`;
      }).join('');
      if (ros.length > 1) h += `<div class="party">${rows}</div>`;
    }
    const box = $('hud');
    box.style.display = g.over ? 'none' : ''; // 결과창 위에 겹치지 않게
    // 첫 라운드에 아직 아무 유닛도 고르지 않았으면 화면 아래에 한 줄 힌트(한 번 고르면 이 판에서는 다시 안 나온다). 안내 말풍선이 떠 있으면 숨긴다
    if (S.sel.length) S.everSel = true;
    { const lh = $('lanehint'), tb = document.getElementById('tutbox'), on = !!lh && laneOn() && !vp && !S.drawer && !g.over && g.round <= 1 && !S.everSel && !(tb && !tb.hidden);
      if (lh) { if (on && !lh.textContent) lh.textContent = t('laneHint'); if (lh.hidden !== !on) lh.hidden = !on; } }
    // 전선이 75%를 넘으면 한 판에 한 번 알림 줄로 경고(칸이 빨개지는 것만으로는 놓치기 쉽다)
    if (!vp && !S.frontWarned && g.phase === 'wave' && !g.over && en > g.limit * 0.75) { S.frontWarned = true; toast(t('frontWarn'), 'warn'); }
    // 보스 처치 뒤: 미뤄 둔 알림을 내보내고, 討伐成功 패널이 떠 있는 동안 알림 줄을 아래로(패널과 겹치지 않게)
    { const n0 = performance.now(); if (S.toastQ && S.toastQ.length && n0 >= (S.toastHoldUntil || 0)) { const q = S.toastQ; S.toastQ = []; q.forEach(([a, b]) => toast(a, b)); }
      const vic = n0 < (S.vicUntil || 0), stg = $('stage'); if (stg.classList.contains('vic') !== vic) stg.classList.toggle('vic', vic); }
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
      // 기다림 창에서도 나갈 수 있게 나가기 버튼을 둔다(설정 탭의 나가기와 같은 길: 한 번 더 눌러 확정 → 11-actions의 quit).
      // 10초 넘게 기다리면 끊긴 쪽이 나일 수 있으므로 내 연결을 확인하라는 글을 더한다.
      if (!S.pzAt) S.pzAt = performance.now();
      const late = performance.now() - S.pzAt > 10000;
      key = 'z' + net.clock.pz + (late ? 'L' : '') + (S.quitArm ? 'A' : '');
      h = `<div class="over pzwait"><div class="sheet"><h2>${I.t('waitTitle')}</h2><div>${I.t('waitPz', { a: esc(net.clock.pz) })}</div>${late ? `<div class="warnline">${I.t('waitSelf')}</div>` : ''}<div class="dim">${I.t('quitHintRoom')}</div><button class="btn ${S.quitArm ? 'warn' : ''}" data-act="quit" type="button">${I.t(S.quitArm ? 'quitAgain' : 'quitGame')}</button></div></div>`;
    } else if (g.over && performance.now() < (S.endHoldUntil || 0)) {
      // 패배 연출(09-render-camera가 S.endHoldUntil = 패배 순간 + 1.6초로 둔다)이 끝날 때까지 결과 창을 미룬다
      if (S.drawer) { S.drawer = null; $('drawer').hidden = true; }
      key = 'oh'; h = '';
    } else if (g.over) {
      if (S.drawer) { S.drawer = null; $('drawer').hidden = true; } // 오른쪽 서랍이 결과·경험치 연출을 가리지 않게
      // 온라인 판은 경험치 연출이 끝난 뒤 결과창(서버 답이 4초 넘게 없으면 그냥 결과창)
      const waitXp = S.online && ACC.token && !S.xpDone && (S.xpPlaying || (S.xpGained == null && performance.now() - (S.overAt || (S.overAt = performance.now())) < 4000));
      if (waitXp) { key = 'ox' + (S.xpPlaying ? 'p' : ''); h = `<div class="over xpwait">${S.xpPlaying ? '' : `<div class="xpsend">${t('sendingResult')}</div>`}</div>`; }
      else { key = 'o' + (S.xpGained != null ? S.xpGained : ''); h = endStats(); }
    }
    if (box.dataset.key !== key) { box.innerHTML = h; box.dataset.key = key; }
    // 기다림 창이 떠 있는 동안에는 오른쪽 위 메뉴 버튼이 창 위로 올라온다(CSS #stage.pz). 창이 사라지면 기다린 시간도 지운다.
    { const pz = key[0] === 'z', stg = $('stage'); if (!pz) S.pzAt = 0; if (stg.classList.contains('pz') !== pz) stg.classList.toggle('pz', pz); }
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
  const CANVAS_ONLY = { dmgtext: 1, proc: 1, shake: 1, pattern: 1, banner: 1 };
  function drainEvents() {
    for (const e of g.events) {
      if (e.type === 'sfx') { Snd.play(e.s, e.gap); continue; }
      if (e.type === 'toast') toast(e.text, e.tone);
      else if (e.type === 'pop') { queuePop(e.def, e.who || (net ? net.name : null)); if (e.def.tier >= 9 && g.phase !== 'boss') S.freeze = (S.freeze || 0) + POP_DUR[e.def.tier]; if (net && !e.remote) net.send('pop', { id: e.def.id, name: net.name }); }
      else if (e.type === 'round') { Snd.play('round'); saveGame(); }
      else if (e.type === 'bossIntro') { Snd.play('gong'); Snd.setBoss(true); }
      else if (e.type === 'over') { Snd.play(e.win ? 'win' : 'lose'); Snd.setBoss(false); S.tkMiss = !!(S.tkWant && !S.gameTk); reportResult(); if (window.RTD_LOBBY) { S.progBefore = window.RTD_LOBBY.progNow(); window.RTD_LOBBY.recordGame(g, S.online, net ? 'room' : bots.length ? 'ai' : 'solo', S.gameTk); } if (S.saveOn) { try { localStorage.removeItem('rtd-save'); } catch (er) { /* 저장 불가 */ } } }
      else if (e.type === 'banner') S.banner = { text: e.text, sub: e.sub, t: 3 };
      else if (e.type === 'dmgtext') {
        // 숫자가 같은 자리에 겹쳐 안 읽히지 않게 조금씩 흩어 놓는다
        if (S.dmg.length < 40) S.dmg.push({ x: e.x + (typeof e.v === 'number' && g.phase === 'boss' ? (Math.random() - 0.5) * 90 : 0), y: e.y - (typeof e.v === 'number' && g.phase === 'boss' ? Math.random() * 30 : 0), v: e.v, big: e.big != null ? e.big : g.phase === 'boss', t: 0 });
        // 보스전 강타: 짧게 멈칫(혼자 할 때만 실제로 시간이 멈춤) + 카메라가 순간 다가감
        // 스킬 이름 글자(문자열)는 타격이 아니므로 멈칫하지 않는다(치료·강화 스킬에도 화면이 멈칫하던 문제)
        // 멈칫은 220ms에 한 번까지: 강타가 초당 여러 번 나도 조작이 뚝뚝 끊기지 않게. 스킬(big: true)은 0.06초, 강타 평타는 0.035초.
        if (g.phase === 'boss' && typeof e.v === 'number') { if (!net) { const nowMs = performance.now(); if (nowMs - (S.hitStopAt || 0) > 220) { S.hitStop = e.big === true ? 0.06 : 0.035; S.hitStopAt = nowMs; } } S.punch = 1; S.shake = Math.max(S.shake || 0, 0.5); Snd.play('hit', 90); if (navigator.vibrate && e.big !== false) navigator.vibrate(10); }
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
      else if (e.type === 'bossWin') { { const n0 = performance.now(); S.toastHoldUntil = n0 + 1300; S.vicUntil = n0 + 1300 + 5500; } const rows = meterRows(e.dealt, e.total); (S.bossRows = S.bossRows || {})[e.boss.round] = rows; Snd.setBoss(false); Snd.play('win'); popQ.push({ vic: e, rows, t: 0, dur: 5.5, hits: {}, shake: 0 }); }
      else if (e.type === 'bossFail') { if (g.fight) (S.bossRows = S.bossRows || {})[g.fight.def.round] = meterRows(g.fight.dealt, g.fight.total); }
      else if (e.type === 'removed') { S.sel = S.sel.filter((i) => i !== e.id); }
      else if (e.type === 'dropGone') { if (S.dropSel === e.id) S.dropSel = null; }
      // 캔버스에만 그리는 알림은 글자판(DOM)을 다시 만들 이유가 없다. 이것까지 dirty()하면 후반에 매 프레임 글자판을 다시 만든다.
      if (!CANVAS_ONLY[e.type]) dirty();
    }
    g.events.length = 0;
  }

