  // ---- 시작 화면 ----
  const cfg = { diff: 'easy', mode: 'solo', ai: '2', mutLv: '0', muts: [], play: 'offline', accTab: 'login', showRank: false };
  try { const p = localStorage.getItem('rtd-play'); if (p === 'online' || p === 'offline') cfg.play = p; } catch (e) { /* 저장 불가 */ }
  // 마지막에 시작한 설정('rtd-last': 온라인/싱글·모드·난이도·AI 수·악몽 단계)을 기억해, 다음에 전투 시작 창을 열면 그 선택이 되어 있게 한다(lobby.js openWizard)
  try {
    const l = JSON.parse(localStorage.getItem('rtd-last') || 'null');
    if (l) {
      if (l.play === 'online' || l.play === 'offline') cfg.play = l.play;
      if (typeof l.mode === 'string') cfg.mode = l.mode;
      if (T.difficulties.some((d) => d.id === l.diff)) cfg.diff = l.diff;
      if (['1', '2', '3', '4'].includes(l.ai)) cfg.ai = l.ai;
      if (cfg.diff === 'nightmare' && ['1', '2', '3', '4', '5'].includes(l.mutLv)) cfg.mutLv = l.mutLv;
    }
  } catch (e) { /* 저장 불가 */ }
  const saveLast = () => { try { localStorage.setItem('rtd-last', JSON.stringify({ play: cfg.play, mode: cfg.mode, diff: cfg.diff, ai: cfg.ai, mutLv: String(cfg.mutLv) })); } catch (e) { /* 저장 불가 */ } };
  const savedGame = () => { try { const sv = JSON.parse(localStorage.getItem('rtd-save') || 'null'); return sv && sv.v === 1 ? sv : null; } catch (e) { return null; } };
  // 악몽 +N: 규칙 N개를 겹치지 않게 무작위로 고른다
  const rollMuts = () => { const pool = (T.mutators || []).map((m) => m.id); cfg.muts = []; for (let i = 0; i < +cfg.mutLv && pool.length; i++) cfg.muts.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]); };
  const mutCard = (id, i) => { const m = T.mutators.find((x) => x.id === id); return m ? `<div class="mut"><span class="n">${i + 1}</span><b>${esc(m.name)}</b><div class="gb"><span class="g">＋ ${esc(m.good)}</span><span class="bd">－ ${esc(m.bad)}</span></div></div>` : ''; };
  if (+cfg.mutLv) rollMuts(); // 기억해 둔 악몽 +N이면 규칙을 새로 뽑아 둔다
  const DIFF_COL = { easy: '#7fd08a', normal: '#6fb7ff', hard: '#ffb347', nightmare: '#ff5a5a' };
  const myName = () => (ACC.me && cfg.play === 'online' ? ACC.me.nick : t('solo'));
  function setupTitle() {
    I.applyDom();
    $('gametitle').textContent = T.title;
    const hc = $('herocv'), hx = hc.getContext('2d');
    hc.width = 1600; hc.height = 900; if (window.RTD_PALACE) window.RTD_PALACE.paint(hc); else paintMap(hx, W, H);
    $('langsel').innerHTML = I.LANGS.map(([k, n]) => `<option value="${k}" ${I.lang === k ? 'selected' : ''}>${n}</option>`).join('');
    $('langsel').onchange = (e) => I.setLang(e.target.value);
      let lobby = null;
    // accNote = 계정 창 안에 보여 주는 알림(연결됨·삭제됨·"게스트 기록은 합쳐지지 않습니다"). ovArm = 이어하기 기록을 덮어쓰기 전 '한 번 더' 확인. joinSeq = 방 입장 도중 나가면 늦게 온 연결을 버리기 위한 번호
    let accNote = '', ovArm = false, joinSeq = 0;
    // 계정: Apple·Google·게스트. 처음 가입할 때만 닉네임과 약관 동의를 받는다.
    const pum = (rk) => (rk >= 1 && rk <= 9 ? ' <small>' + t('rankPum', { n: 10 - rk }) + '</small>' : '');
    const accHtml = () => {
      const link = (k, p) => `<a href="${API}/${p}?lang=${I.lang}" target="_blank" rel="noopener">${t(k)}</a>`;
      const N = window.RTD_NATIVE, app = !!(N && N.on), apple = !(N && N.droid); // 안드로이드 앱에는 Apple 로그인 버튼이 없다
      const note = accNote ? `<div class="acc-note">${esc(accNote)}</div>` : '';
      if (!ACC.token || !ACC.me) {
        return `${note}<div class="acc-form"><input id="acc-nick" maxlength="12" placeholder="${esc(t('nickFirst'))}">
          <label class="agree"><input id="acc-agree" type="checkbox"><span>${t('agree', { terms: link('terms', 'terms'), privacy: link('privacy', 'privacy') })}</span></label>
          ${(app ? N.ssoHas('apple') : apple) ? `<button class="btn sso apple" data-sso="apple" type="button" ${app ? '' : 'disabled'}>${t('loginApple')}</button>` : ''}
          ${!app || N.ssoHas('google') ? `<button class="btn sso google" data-sso="google" type="button" ${app ? '' : 'disabled'}>${t('loginGoogle')}</button>` : ''}
          ${app ? '' : `<div class="hint2">${t('appOnly')}</div>`}
          <button class="btn go" id="acc-guest" type="button">${t('loginGuest')}</button>
          <div class="err" id="acc-err"></div></div>`;
      }
      const m = ACC.me, lv = m.level, max = m.rank >= 10, f = max ? 1 : Math.max(0, Math.min(1, (m.xp - xpLv(lv)) / Math.max(1, xpLv(lv + 1) - xpLv(lv))));
      const guest = m.provider === 'guest', prov = m.provider === 'apple' ? 'Apple' : m.provider === 'google' ? 'Google' : guest ? t('provGuest') : '';
      return `${note}<div class="acc-card"><span class="badge">${lv}</span><div><b>${esc(m.nick)}</b> <span class="gr">${esc(t(m.grade))}${pum(m.rank)} ${t('level', { n: lv })}</span> <small class="prov">${esc(prov)}</small></div><div class="xpbar"><i style="width:${(f * 100).toFixed(1)}%"></i></div></div>
        <div class="hint2">${t('gamesWins', { g: m.games, w: m.wins })} · XP ${fmt(m.xp)}</div>
        <div class="acc-track"><span>${t('trackHead')}</span><button class="${m.track !== 'civ' ? 'on' : ''}" data-track="mil" type="button">${t('trackMil')}</button><button class="${m.track === 'civ' ? 'on' : ''}" data-track="civ" type="button">${t('trackCiv')}</button><button class="btn acc-q" id="acc-treebtn" type="button" aria-label="${esc(t('treeHead'))}">?</button></div>
        <div class="acc-tree" id="acc-tree" ${S.accTree ? '' : 'hidden'}>${treeHtml(m)}</div>
        ${guest && (!app || N.ssoHas('apple') || N.ssoHas('google')) ? `<div class="acc-link"><b>${t('linkHead')}</b><div class="hint2">${t('linkHint')}</div><div class="acc-btns">${(app ? N.ssoHas('apple') : apple) ? `<button class="btn sso apple" data-sso="apple" data-link="1" type="button" ${app ? '' : 'disabled'}>${t('loginApple')}</button>` : ''}${!app || N.ssoHas('google') ? `<button class="btn sso google" data-sso="google" data-link="1" type="button" ${app ? '' : 'disabled'}>${t('loginGoogle')}</button>` : ''}</div></div>` : ''}
        <div class="acc-btns"><button class="btn" id="acc-rank" type="button">${t('ranking')}</button><button class="btn" id="acc-nickbtn" type="button">${t('nickEdit')}</button><button class="btn" id="acc-out" type="button">${t('logout')}</button></div>
        <div id="acc-nickbox" hidden><div class="inline"><input id="acc-nick2" maxlength="12" value="${esc(m.nick)}"><button class="btn" id="acc-nicksave" type="button">${t('save')}</button></div></div>
        <div class="acc-danger"><button class="btn warn" id="acc-del" type="button">${t('deleteAcc')}</button></div>
        <div id="acc-delbox" hidden><div class="hint2">${t('delConfirmSso')}</div><div class="inline">${m.provider === 'password' ? `<input id="acc-delpw" type="password" placeholder="${esc(t('accPw'))}">` : ''}<button class="btn warn" id="acc-delgo" type="button">${t('delYes')}</button></div></div>
        <div class="err" id="acc-err"></div><div class="rank-list" id="acc-ranklist"></div>`;
    };
    // 위저드에서 아직 고르지 않은 항목은 선택 표시를 하지 않는다
    const pk = (k) => !window.RTD_LOBBY || !window.RTD_LOBBY.picked || window.RTD_LOBBY.picked(k);
    const dr = () => {
      const on = cfg.play === 'online';
      $('playmode').innerHTML = [['offline', t('offline')], ['online', t('online')]].map(([k, n]) => `<button class="${cfg.play === k && pk('play') ? 'on' : ''}" data-cfg="play" data-v="${k}" type="button">${n}</button>`).join('');
      $('playhint').textContent = t(on ? 'onlineHint' : 'offlineHint');
      $('accbox').hidden = false; // 계정 상자는 로비의 계정 창에 들어간다
      refreshAcc();
      const ready = !on || (ACC.token && ACC.me);
      ['diffsec', 'modesec'].forEach((id) => ($(id).hidden = !ready));
      // 방장은 방 안에서 난이도를 따로 누르지 않아도 지금 난이도가 고른 것으로 친다(손님에게 보이는 '방장 설정'과 같게)
      const hostPick = !!(lobby && lobby.isHost());
      $('diffs').innerHTML = T.difficulties.map((d) => `<button class="${cfg.diff === d.id && (pk('diff') || hostPick) ? 'on' : ''}" data-cfg="diff" data-v="${d.id}" type="button" style="--dc:${DIFF_COL[d.id] || '#c99a2e'}">${d.name}${d.id === 'nightmare' && +cfg.mutLv ? ` +${cfg.mutLv}` : ''}<small>${t('rounds', { n: d.rounds, m: d.mult })}</small></button>`).join('');
      const nm = cfg.diff === 'nightmare' && ready;
      $('mutbox').hidden = !nm;
      if (nm) {
        $('mutlv').innerHTML = [0, 1, 2, 3, 4, 5].map((n) => `<button class="${+cfg.mutLv === n ? 'on' : ''}" data-cfg="mutLv" data-v="${n}" type="button">${n ? '+' + n : t('base')}</button>`).join('') + (+cfg.mutLv ? `<button class="btn reroll" id="mutroll" type="button">${t('reroll')}</button>` : '');
        $('mutrules').innerHTML = cfg.muts.map(mutCard).join('');
      }
      // 오프라인: 단독·AI 동맹 / 온라인: 단독(기록)·방 협동
      const modes = on ? [['quick', t('lb_quick'), t('lb_quickSub')], ['create', t('lb_create'), t('lb_createSub')], ['join', t('lb_join'), t('lb_joinSub')]] : [['solo', t('solo'), t('soloSub')], ['ai', t('aiAlly'), t('aiAllySub')]];
      if (!modes.some(([k]) => k === cfg.mode)) cfg.mode = modes[0][0];
      $('modes').innerHTML = modes.map(([k, n, s]) => `<button class="${cfg.mode === k && pk('mode') ? 'on' : ''}" data-cfg="mode" data-v="${k}" type="button">${n}<small>${s}</small></button>`).join('');
      const isRoom = cfg.mode === 'create' || cfg.mode === 'join' || cfg.mode === 'multi';
      $('netbox').hidden = !(ready && isRoom);
      $('netbox').dataset.room = cfg.mode;
      $('aibox').hidden = !(ready && cfg.mode === 'ai');
      $('aicount').innerHTML = ['1', '2', '3', '4'].map((k) => `<button class="${cfg.ai === k ? 'on' : ''}" data-cfg="ai" data-v="${k}" type="button">${t('nAi', { n: k })}<small>${t('nPlayers', { n: +k + 1 })}</small></button>`).join('');
      const host = lobby && lobby.isHost();
      $('startbtn').hidden = !ready;
      let sv = null;
      try { sv = JSON.parse(localStorage.getItem('rtd-save') || 'null'); } catch (e) { sv = null; }
      const cb = $('contbtn'), showC = sv && sv.v === 1; // 이어하기는 마지막에 온라인을 골랐어도 저장이 있으면 보인다
      cb.hidden = !showC;
      if (showC) { const dn = (T.difficulties.find((d) => d.id === sv.diff) || {}).name || ''; cb.textContent = t('continueGame', { r: sv.round, d: dn }); cb.onclick = () => begin({ snap: sv, mode: 'solo', diff: sv.diff }); }
      $('startbtn').textContent = isRoom ? (!lobby ? t('joinFirst') : host ? t('startHost') : t('waitHost')) : ovArm ? t('overwriteSave') : t('start');
      $('startbtn').disabled = (isRoom && (!lobby || !host)) || (!pk('diff') && !hostPick) || (window.RTD_LOBBY && !window.RTD_LOBBY.diffOpen(cfg.diff, +cfg.mutLv));
      if (lobby && host) {
        const c = { diff: cfg.diff, mutLv: +cfg.mutLv, muts: cfg.muts }, k = JSON.stringify(c);
        if (lobby.sentCfg !== k) { lobby.sentCfg = k; lobby.t.presence({ cfg: c }); }
      }
      renderLobby();
      if (window.RTD_LOBBY) window.RTD_LOBBY.refresh();
    };
    function refreshAcc() { const ah = accHtml(); if ($('accbox').dataset.html !== ah) { $('accbox').innerHTML = ah; $('accbox').dataset.html = ah; bindAcc(); } }
    // 로비: 방 코드, 다섯 자리(이름·등급·방장 표시), 방장이 고른 설정
    const renderLobby = () => {
      const box = $('lobby');
      box.hidden = !lobby;
      if (!lobby) return;
      const r = lobby.roster(), hostCfg = r[0] && r[0].state.cfg;
      $('lbcode').textContent = lobby.code || '';
      $('lbnet').textContent = t('roomOnline');
      $('lbslots').innerHTML = Array.from({ length: 5 }, (_, i) => {
        const p = r[i];
        if (!p) return `<div class="lb-slot empty">${t('emptySeat')}</div>`;
        const nm = p.state.name || '?';
        return `<div class="lb-slot in ${p.me ? 'me' : ''}">${i === 0 ? `<span class="host">★ ${t('host')}</span>` : ''}<span class="av">${esc(nm.slice(0, 1))}</span><span>${esc(nm)}${p.me ? ` (${t('me')})` : ''}</span>${gradeTag(p.state)}</div>`;
      }).join('');
      const hc = lobby.isHost() ? { diff: cfg.diff, mutLv: +cfg.mutLv, muts: cfg.muts } : hostCfg;
      const dn = hc ? (T.difficulties.find((d) => d.id === hc.diff) || {}).name : '';
      $('lbcfg').innerHTML = hc ? `${t('hostCfg')}: <b>${esc(dn || '')}${hc.mutLv | 0 ? ` +${hc.mutLv | 0}` : ''}</b>${!lobby.isHost() && (hc.muts || []).length ? `<div style="display:grid;gap:4px;margin-top:5px">${hc.muts.map(mutCard).join('')}</div>` : ''}` : '';
    };
    // 관직 표: 단계(0 신병 ~ 10 군주)마다 필요한 레벨·누적 경험치와 무관·문관 칭호. 서버(app.js)의 RANK_LV, 경험치 식(40·(레벨-1)²)과 같다
    const RANK_LV = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 51];
    function treeHtml(m) {
      const mine = m.track === 'civ' ? 'civ' : 'mil';
      const rows = RANK_LV.map((lv, i) => `<tr class="${m.rank === i ? 'cur' : ''}"><td>${i >= 1 && i <= 9 ? t('rankPum', { n: 10 - i }) : '—'}</td><td class="n">${lv}</td><td class="n">${xpLv(lv).toLocaleString()}</td><td class="${mine === 'mil' ? 'me' : ''}">${esc(t('rk_mil' + i))}</td><td class="${mine === 'civ' ? 'me' : ''}">${esc(t('rk_civ' + i))}</td></tr>`).join('');
      return `<table><thead><tr><th>${t('treeStage')}</th><th class="n">${t('treeLv')}</th><th class="n">${t('treeXp')}</th><th class="${mine === 'mil' ? 'me' : ''}">${t('trackMil')}</th><th class="${mine === 'civ' ? 'me' : ''}">${t('trackCiv')}</th></tr></thead><tbody>${rows}</tbody></table><div class="note">${t('treeNote', { xp: Math.round(m.xp).toLocaleString() })}</div>`;
    }
    const setErr = (e) => { const el = $('acc-err'); if (el) el.textContent = e ? errText(e) : ''; };
    const signedIn = (r) => { accNote = ''; ACC.token = r.token; ACC.me = r.me; saveAcc(); $('accbox').dataset.html = ''; dr(); };
    function bindAcc() {
      const box = $('accbox');
      const nickIn = () => { const el = $('acc-nick'); return (el && el.value.trim()) || ''; };
      const agreed = () => { const el = $('acc-agree'); return !!(el && el.checked); };
      // 게스트: 이 기기에 비밀값이 있으면 그걸로, 없으면 새로 만든다
      const gb = $('acc-guest');
      if (gb) gb.onclick = async () => {
        setErr(''); gb.disabled = true;
        // 비밀값이 있으면 그 계정으로 먼저 들어간다. 서버가 없는 계정(401)이라고 할 때만 새로 만든다(guestEnter)
        const r = await guestEnter(() => (agreed() ? { nick: nickIn() || t('guestNick', { n: 1000 + ((Math.random() * 9000) | 0) }), agree: true, termsVer: 1, lang: I.lang } : null));
        gb.disabled = false;
        if (r.stop) { setErr('need_agree'); return; }
        if (r.token) signedIn(r); else setErr(r.error);
      };
      // Apple·Google: 로그인 또는(게스트일 때) 연결
      box.querySelectorAll('[data-sso]').forEach((bt) => (bt.onclick = async () => {
        setErr('');
        const prov = bt.dataset.sso, link = !!bt.dataset.link;
        let s;
        try { s = await window.RTD_NATIVE.signIn(prov); } catch (e) { setErr(e.message === 'app_only' ? '' : e.message); if (e.message === 'app_only') { const el = $('acc-err'); if (el) el.textContent = t('appOnly'); } return; }
        const r = await api('/api/auth/' + prov, { idToken: s.idToken, link, nick: nickIn() || s.name || t('guestNick', { n: 1000 + ((Math.random() * 9000) | 0) }), agree: agreed(), termsVer: 1, lang: I.lang });
        if (!r.token) { setErr(r.error); return; }
        if (r.linked) saveGuest(null); // 연결된 게스트 비밀값은 더 쓰지 않는다
        signedIn(r);
        if (r.linked || (link && r.existed)) toastTitle(t(r.linked ? 'linked' : 'existed'));
      }));
      box.querySelectorAll('[data-track]').forEach((bt) => (bt.onclick = async () => { const r = await api('/api/track', { track: bt.dataset.track }); if (r.me) { ACC.me = r.me; saveAcc(); $('accbox').dataset.html = ''; dr(); } else setErr(r.error); }));
      const tb = $('acc-treebtn'); if (tb) tb.onclick = () => { S.accTree = !S.accTree; $('acc-tree').hidden = !S.accTree; };
      const nb = $('acc-nickbtn'); if (nb) nb.onclick = () => { $('acc-nickbox').hidden = !$('acc-nickbox').hidden; };
      const ns = $('acc-nicksave'); if (ns) ns.onclick = async () => { const r = await api('/api/nick', { nick: $('acc-nick2').value.trim() }); if (r.me) { ACC.me = r.me; saveAcc(); $('accbox').dataset.html = ''; dr(); } else setErr(r.error); };
      const out = $('acc-out');
      if (out) out.onclick = async () => { const pv = ACC.me && ACC.me.provider; await api('/api/logout', {}); if (window.RTD_NATIVE && (pv === 'apple' || pv === 'google')) window.RTD_NATIVE.signOut(pv); ACC.token = null; ACC.me = null; saveAcc(); if (lobby) { lobby.leave(); lobby = null; } $('accbox').dataset.html = ''; dr(); };
      const del = $('acc-del');
      if (del) del.onclick = () => { $('acc-delbox').hidden = !$('acc-delbox').hidden; };
      const delgo = $('acc-delgo');
      if (delgo) delgo.onclick = async () => {
        const pw = $('acc-delpw'), pv = ACC.me && ACC.me.provider;
        const r = await api('/api/delete', pw ? { password: pw.value } : { confirm: 'DELETE' });
        if (r.ok) { if (pv === 'guest') saveGuest(null); ACC.token = null; ACC.me = null; saveAcc(); $('accbox').dataset.html = ''; dr(); toastTitle(t('deleted')); } else setErr(r.error);
      };
      const rk = $('acc-rank');
      if (rk) rk.onclick = async () => {
        const lb = $('acc-ranklist');
        if (lb.innerHTML) { lb.innerHTML = ''; return; }
        const r = await api('/api/ranking');
        lb.innerHTML = (r.top || []).slice(0, 20).map((p, i2) => `<div><span>${i2 + 1}</span><span>${esc(p.nick)} <span class="gr">${esc(t(p.grade))}</span></span><span>${t('level', { n: p.level })}</span></div>`).join('') || errText(r.error);
      };
    }
    // 계정 알림은 계정 창 안(맨 위)에 적는다. 전에는 전투 시작 창의 #roster에 적혀 계정 창에서는 안 보였다
    const toastTitle = (txt) => { accNote = txt; $('accbox').dataset.html = ''; refreshAcc(); };
    // ---- 로딩 화면(#boot): 그림과 계정을 불러온 뒤 로비를 보여 준다.
    // 계정이 없으면(처음) 여기서 로그인(게스트·Apple·Google) → 닉네임 → 관직 갈래를 정한다. 'rtd-onb' = 남은 첫 설정 단계(nick·track).
    // 서버에 닿지 않으면 막지 않는다: 계정이 있으면 저장된 정보로, 없으면 '오프라인으로 시작'을 고를 수 있다.
    const ONB = 'rtd-onb';
    const onbGet = () => { try { return localStorage.getItem(ONB) || ''; } catch (e) { return ''; } };
    const onbSet = (v) => { try { if (v) localStorage.setItem(ONB, v); else localStorage.removeItem(ONB); } catch (e) { /* 저장 불가 */ } };
    const setAcc = (r) => { ACC.token = r.token; ACC.me = r.me; saveAcc(); };
    const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
    function firstRun(step, netDown) {
      return new Promise((done) => {
        const B = $('boot'), card = $('bootcard'), N = window.RTD_NATIVE, app = !!(N && N.on);
        const link = (k, p) => `<a href="${API}/${p}?lang=${I.lang}" target="_blank" rel="noopener">${t(k)}</a>`;
        const err = (e) => { const el = $('boot-err'); if (el) el.textContent = e ? errText(e) : ''; };
        const busy = (on) => card.querySelectorAll('button').forEach((b) => { b.disabled = on; });
        const guestName = () => t('guestNick', { n: 1000 + ((Math.random() * 9000) | 0) });
        const finish = () => { onbSet(''); card.hidden = true; B.classList.remove('form'); $('bootload').hidden = false; done(); };
        const show = (st) => {
          step = st; B.classList.add('form'); $('bootload').hidden = true; card.hidden = false;
          if (st === 'login') {
            card.innerHTML = `<h2>${t('boot_loginHead')}</h2><p>${t('boot_loginHint')}</p>
              <label class="agree"><input id="boot-agree" type="checkbox"><span>${t('agree', { terms: link('terms', 'terms'), privacy: link('privacy', 'privacy') })}</span></label>
              <button class="btn go" id="boot-guest" type="button">${t('loginGuest')}</button>
              ${app && N.ssoHas && N.ssoHas('google') ? `<button class="btn sso google" data-sso="google" type="button">${t('loginGoogle')}</button>` : ''}
              ${app && N.ssoHas && N.ssoHas('apple') ? `<button class="btn sso apple" data-sso="apple" type="button">${t('loginApple')}</button>` : ''}
              <div class="err" id="boot-err"></div>
              <button class="btn sub" id="boot-off" type="button" hidden>${t('boot_offline')}</button>`;
            const agreed = () => $('boot-agree').checked;
            const fail = (r) => { err(r.error || 'net'); if (r.status === 0) $('boot-off').hidden = false; };
            const after = (r, fresh) => { setAcc(r); if (fresh) { onbSet('nick'); show('nick'); } else finish(); };
            if (netDown) { err('net'); $('boot-off').hidden = false; }
            $('boot-off').onclick = () => finish();
            $('boot-guest').onclick = async () => {
              err(''); busy(true);
              // 이 기기에 게스트 비밀값이 남아 있으면 그 계정으로 먼저 들어간다(새로 만들면 옛 계정을 잃는다). 없는 계정(401)일 때만 새로 만든다
              const r = await guestEnter(() => (agreed() ? { nick: guestName(), agree: true, termsVer: 1, lang: I.lang } : null));
              busy(false);
              if (r.stop) { err('need_agree'); return; }
              if (!r.token) { fail(r); return; }
              after(r, !!r.fresh);
            };
            card.querySelectorAll('[data-sso]').forEach((bt) => (bt.onclick = async () => {
              err(''); if (!agreed()) { err('need_agree'); return; }
              let s;
              try { s = await N.signIn(bt.dataset.sso); } catch (e) { if (e.message !== 'cancel') err(e.message); return; }
              busy(true);
              const r = await api('/api/auth/' + bt.dataset.sso, { idToken: s.idToken, link: false, nick: s.name || guestName(), agree: true, termsVer: 1, lang: I.lang });
              busy(false);
              if (!r.token) { fail(r); return; }
              after(r, !r.existed);
            }));
          } else if (st === 'nick') {
            card.innerHTML = `<div class="step">1 / 2</div><h2>${t('boot_nickHead')}</h2><p>${t('boot_nickHint')}</p>
              <input id="boot-nick" type="text" maxlength="12" autocomplete="off" value="${esc((ACC.me && ACC.me.nick) || '')}">
              <div class="err" id="boot-err"></div>
              <button class="btn go" id="boot-next" type="button">${t('boot_next')}</button>`;
            $('boot-next').onclick = async () => {
              const nick = $('boot-nick').value.trim();
              err(''); if (!nick) { err('bad_nick'); return; }
              if (!ACC.me || nick !== ACC.me.nick) {
                busy(true); const r = await api('/api/nick', { nick }); busy(false);
                if (!r.me) { err(r.error || 'net'); return; }
                ACC.me = r.me; saveAcc();
              }
              onbSet('track'); show('track');
            };
          } else {
            let pick = (ACC.me && ACC.me.track) === 'civ' ? 'civ' : 'mil';
            const paint = () => {
              card.innerHTML = `<div class="step">2 / 2</div><h2>${t('boot_trackHead')}</h2><p>${t('boot_trackHint')}</p>
                <div class="boot-track">${[['mil', 'trackMil', 'boot_trackMil'], ['civ', 'trackCiv', 'boot_trackCiv']].map(([k, n, h]) => `<button class="${pick === k ? 'on' : ''}" data-tk="${k}" type="button"><b>${t(n)}</b><small>${t(h)}</small></button>`).join('')}</div>
                <div class="err" id="boot-err"></div>
                <button class="btn go" id="boot-next" type="button">${t('boot_start')}</button>`;
              card.querySelectorAll('[data-tk]').forEach((b) => (b.onclick = () => { pick = b.dataset.tk; paint(); }));
              $('boot-next').onclick = async () => {
                busy(true); const r = await api('/api/track', { track: pick }); busy(false);
                if (!r.me) { err(r.error || 'net'); return; }
                ACC.me = r.me; saveAcc(); finish();
              };
            };
            paint();
          }
        };
        show(step);
      });
    }
    // 서버 공지·최소 버전(GET /api/notice): 로딩하는 동안 받는다. 못 받으면(끊김·오류·4초 넘김) 조용히 넘어간다.
    const NOTICE_WAIT_MS = 4000;
    const verNum = (v) => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '')); return m ? [+m[1], +m[2], +m[3]] : null; };
    const verLess = (a, b) => { const x = verNum(a), y = verNum(b); if (!x || !y) return false; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
    // 지금 버전이 최소 버전보다 낮다: 앱은 업데이트 안내만 보이고 더 나아가지 않는다. 웹 브라우저는 새로고침을 권하되 막지 않는다.
    function needUpdate() {
      return new Promise((done) => {
        const B = $('boot'), card = $('bootcard'), app = !!(window.RTD_NATIVE && window.RTD_NATIVE.on);
        B.classList.add('form'); $('bootload').hidden = true; card.hidden = false;
        card.innerHTML = `<p>${t(app ? 'updateNeed' : 'updateWeb')}</p>${app ? '' : `<button class="btn go" id="boot-reload" type="button">${t('updateReload')}</button><button class="btn sub" id="boot-skip" type="button">${t('updateSkip')}</button>`}`;
        if (app) return; // 앱에서는 여기서 멈춘다
        $('boot-reload').onclick = () => location.reload();
        $('boot-skip').onclick = () => { card.hidden = true; card.innerHTML = ''; B.classList.remove('form'); $('bootload').hidden = false; done(); };
      });
    }
    async function boot() {
      const B = $('boot');
      if (!B) return;
      const bar = (f) => { $('bootfill').style.width = Math.round(f * 100) + '%'; }, say = (k) => { $('bootmsg').textContent = t(k); };
      const t0 = performance.now();
      $('boottitle').textContent = $('gametitle').textContent;
      const noticeP = Promise.race([api('/api/notice'), pause(NOTICE_WAIT_MS).then(() => ({}))]).catch(() => ({}));
      bar(0.15); say('boot_assets');
      try { await Promise.race([Art.ready, pause(6000)]); } catch (e) { /* 그림 없이도 진행 */ }
      {
        const nt = await noticeP;
        if (nt && nt.status === 200) {
          if (window.RTD_NEWS && window.RTD_NEWS.setNotice) window.RTD_NEWS.setNotice(nt.notice); // 안 본 공지면 로비의 '報' 버튼에 빨간 점, 내역 창 맨 위에 보인다
          if (verLess(window.RTD_VERSION, nt.minVersion)) await needUpdate();
        }
      }
      bar(0.55); say('boot_account');
      let netDown = false;
      // 로그인 상태 새로 받기(등급이 다른 기기에서 올랐을 수 있다). 토큰이 만료됐으면(401) api()가 지운다
      if (ACC.token) { const r = await api('/api/me'); if (r.me) { ACC.me = r.me; saveAcc(); } else if (r.status === 0) netDown = true; }
      if (!ACC.token && GUEST && GUEST.id) {
        const r = await api('/api/guest/login', { id: GUEST.id, secret: GUEST.secret });
        if (r.token) setAcc(r); else if (r.status === 401) saveGuest(null); else if (r.status === 0) netDown = true;
      }
      bar(0.9);
      const has = !!(ACC.token && ACC.me);
      if (!has && !(netDown && GUEST && GUEST.id)) await firstRun('login', netDown);
      else if (has && onbGet() && !netDown) await firstRun(onbGet() === 'track' ? 'track' : 'nick', false);
      // 지난번에 못 보낸 판 결과·결제 영수증을 다시 보낸다(lobby.js, 기다리지 않는다)
      if (window.RTD_LOBBY && window.RTD_LOBBY.flushPending) window.RTD_LOBBY.flushPending();
      bar(1); say('boot_done');
      const left = 700 - (performance.now() - t0); if (left > 0) await pause(left);
      $('accbox').dataset.html = ''; dr();
      B.classList.add('out'); setTimeout(() => { B.hidden = true; }, 450);
    }
    document.addEventListener('click', (e) => {
      if (!$('title') || $('title').hidden) return;
      if (e.target.id === 'mutroll') { rollMuts(); dr(); return; }
      if (e.target.id === 'lbcopy' && lobby) { try { navigator.clipboard.writeText(lobby.code); e.target.textContent = t('copied'); } catch (er) { /* 복사 불가 환경 */ } return; }
      const b = e.target.closest('[data-cfg]');
      if (b) {
        cfg[b.dataset.cfg] = b.dataset.v;
        if (b.dataset.cfg === 'play') { try { localStorage.setItem('rtd-play', b.dataset.v); } catch (er) { /* 저장 불가 */ } if (lobby && b.dataset.v === 'offline') { lobby.leave(); lobby = null; } }
        if (b.dataset.cfg === 'diff' && b.dataset.v !== 'nightmare') cfg.mutLv = '0';
        if (b.dataset.cfg === 'mutLv' || b.dataset.cfg === 'diff') rollMuts();
        if (b.dataset.cfg === 'accTab') $('accbox').dataset.html = '';
        dr();
        if (window.RTD_LOBBY) window.RTD_LOBBY.onCfg(b.dataset.cfg);
      }
    });
    // 방에서 나가기(방 나가기 버튼, 창 닫기·뒤로 가기 — lobby.js가 부른다). 들어가는 중이던 연결도 버린다
    const leaveRoom = () => { joinSeq++; if (lobby) { try { lobby.leave(); } catch (e) { /* 이미 끊김 */ } lobby = null; } $('roster').textContent = ''; dr(); };
    // 돌려주는 값: 들어갔으면 '', 못 들어갔으면 까닭 문구(빠른 대전 대기 화면이 보여 준다)
    const join = async (code) => {
      if (!ACC.token) return t('err_auth');
      const my = ++joinSeq;
      $('roster').textContent = t('connecting');
      const l = await window.RTD_NET.connect(code, ACC.me.nick, { token: ACC.token });
      if (my !== joinSeq) { if (l && typeof l === 'object') { try { l.leave(); } catch (e) { /* 이미 끊김 */ } } return ''; } // 기다리는 사이에 나갔다
      if (l === 'full') { $('roster').textContent = t('roomFull'); return t('roomFull'); }
      if (l === 'auth') { ACC.token = null; ACC.me = null; saveAcc(); $('accbox').dataset.html = ''; $('roster').textContent = t('err_auth'); dr(); return t('err_auth'); }
      if (!l) { $('roster').textContent = t('noServer'); return t('noServer'); }
      lobby = l;
      $('code').value = code;
      lobby.code = code;
      $('roster').textContent = '';
      const show = () => dr();
      lobby.onLobby = show; show();
      lobby.onStart = (d) => { saveLast(); begin({ diff: d.diff, mode: 'multi', seed: d.seed, net: lobby, muts: d.muts || [], mutLv: d.mutLv || 0, online: true, key: code + '-' + d.seed }); };
      return '';
    };
    $('mk').onclick = () => join(Math.random().toString(36).slice(2, 7));
    document.addEventListener('pointerdown', () => { if (g) Snd.init(); });
    $('jn').onclick = () => { const c = $('code').value.trim().toLowerCase().replace(/[^a-z0-9]/g, ''); if (c) join(c); };
    $('startbtn').onclick = () => {
      const mm = cfg.diff === 'nightmare' ? { muts: cfg.muts.slice(), mutLv: +cfg.mutLv } : { muts: [], mutLv: 0 };
      const online = cfg.play === 'online';
      if (cfg.mode === 'multi' || cfg.mode === 'create' || cfg.mode === 'join') { if (lobby && lobby.isHost()) { saveLast(); lobby.start(cfg.diff, mm); } return; }
      // 싱글 단독 새 판은 이어하기 기록을 덮어쓴다: 기록이 있으면 버튼 글을 바꾸고 3초 안에 한 번 더 눌러야 시작한다
      if (cfg.mode !== 'ai' && !online && !ovArm && savedGame()) { ovArm = true; dr(); setTimeout(() => { if (ovArm) { ovArm = false; if (!$('title').hidden) dr(); } }, 3000); return; }
      ovArm = false; saveLast();
      if (cfg.mode === 'ai') { begin(Object.assign({ diff: cfg.diff, ai: +cfg.ai }, mm)); return; }
      begin(Object.assign({ diff: cfg.diff, mode: 'solo', online, key: online ? 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : null }, mm));
    };
    // 메인 로비(lobby.js)에 필요한 도구를 넘긴다
    const settingsHtml = () => {
      const ql = [['high', t('high')], ['mid', t('mid')], ['low', t('low')]];
      let h = `<div class="h">${t('language')}</div><div class="row"><div class="zones">${I.LANGS.map(([k, n]) => `<button class="zb ${I.lang === k ? 'on' : ''}" data-act="langSet" data-arg="${k}" type="button">${n}</button>`).join('')}</div></div>`;
      h += `<div class="h">${t('gfx')}</div><div class="row"><div>${t('gfxRow')} <small>${t('gfxHint')}</small></div><div class="zones">${ql.map(([k, l]) => `<button class="zb ${Q.level === k ? 'on' : ''}" data-act="gfx" data-arg="${k}" type="button">${l}</button>`).join('')}</div></div>`;
      h += `<div class="row"><div>${t('fps30')} <small>${t('fps30Hint')}</small></div><button class="toggle ${Q.fps30 ? 'on' : ''}" data-act="fps30" type="button">${Q.fps30 ? t('on') : t('off')}</button></div>`;
      h += `<div class="row"><div>${t('perfShow')} <small>${t('perfShowHint')}</small></div><button class="toggle ${Q.perf ? 'on' : ''}" data-act="perf" type="button">${Q.perf ? t('on') : t('off')}</button></div>`;
      h += `<div class="h">${t('sound')}</div>` + volRow('sfx') + volRow('bgm');
      h += `<div class="h">${I.t('tutReplay')}</div><div class="row"><div><small>${I.t('tutReplayHint')}</small></div><button class="toggle" data-act="tutReset" type="button">${I.t('tutReplay')}</button></div>`;
      h += `<div class="row"><div>${window.RTD_CREDITS ? window.RTD_CREDITS.label() : ''}</div><button class="toggle" data-act="credits" type="button">${t('view')}</button></div>`;
      h += `<div class="row"><div>${t('version')}</div><div>v${window.RTD_VERSION || '?'}</div></div>`;
      return `<div class="setlist">${h}</div>`;
    };
    const repaintMap = () => { sizeMap(); };
    if (window.RTD_LOBBY) window.RTD_LOBBY.init({ api, ACC, saveAcc, t, I, T, cfg, getLobby: () => lobby, joinRoom: (code) => join(code), leaveRoom, saveLast, clearAccNote: () => { if (accNote) { accNote = ''; $('accbox').dataset.html = ''; } }, begin, refreshAcc, settingsHtml, errText, clock, repaintMap, repaintSetup: () => dr(), paintMini: (cv, theme) => paintMap(cv.getContext('2d'), cv.width, cv.height, theme || null) });
    dr();
    // 로딩(처음이면 로그인·닉네임·관직 갈래)이 끝난 뒤: 로비 안내(처음) 또는 아직 못 받은 첫 신화 해금 연출
    boot().catch(() => { const B = $('boot'); if (B) B.hidden = true; }).then(() => { if (window.RTD_TUT && window.RTD_TUT.lobby) window.RTD_TUT.lobby({ t, T }); });
  }
  setupTitle();
  requestAnimationFrame(loop);
})();
