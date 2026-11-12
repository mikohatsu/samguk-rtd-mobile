  // ---- 시작 화면 ----
  const cfg = { diff: 'easy', mode: 'solo', ai: '2', mutLv: '0', muts: [], play: 'offline', accTab: 'login', showRank: false };
  try { const p = localStorage.getItem('rtd-play'); if (p === 'online' || p === 'offline') cfg.play = p; } catch (e) { /* 저장 불가 */ }
  // 악몽 +N: 규칙 N개를 겹치지 않게 무작위로 고른다
  const rollMuts = () => { const pool = (T.mutators || []).map((m) => m.id); cfg.muts = []; for (let i = 0; i < +cfg.mutLv && pool.length; i++) cfg.muts.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]); };
  const mutCard = (id, i) => { const m = T.mutators.find((x) => x.id === id); return m ? `<div class="mut"><span class="n">${i + 1}</span><b>${esc(m.name)}</b><div class="gb"><span class="g">＋ ${esc(m.good)}</span><span class="bd">－ ${esc(m.bad)}</span></div></div>` : ''; };
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
    // 계정: Apple·Google·게스트. 처음 가입할 때만 닉네임과 약관 동의를 받는다.
    const pum = (rk) => (rk >= 1 && rk <= 9 ? ' <small>' + t('rankPum', { n: 10 - rk }) + '</small>' : '');
    const accHtml = () => {
      const link = (k, p) => `<a href="${API}/${p}?lang=${I.lang}" target="_blank" rel="noopener">${t(k)}</a>`;
      const N = window.RTD_NATIVE, app = !!(N && N.on);
      if (!ACC.token || !ACC.me) {
        return `<div class="acc-form"><input id="acc-nick" maxlength="12" placeholder="${esc(t('nickFirst'))}">
          <label class="agree"><input id="acc-agree" type="checkbox"><span>${t('agree', { terms: link('terms', 'terms'), privacy: link('privacy', 'privacy') })}</span></label>
          <button class="btn sso apple" data-sso="apple" type="button" ${app ? '' : 'disabled'}>${t('loginApple')}</button>
          <button class="btn sso google" data-sso="google" type="button" ${app ? '' : 'disabled'}>${t('loginGoogle')}</button>
          ${app ? '' : `<div class="hint2">${t('appOnly')}</div>`}
          <button class="btn go" id="acc-guest" type="button">${t('loginGuest')}</button>
          <div class="err" id="acc-err"></div></div>`;
      }
      const m = ACC.me, lv = m.level, max = m.rank >= 10, f = max ? 1 : Math.max(0, Math.min(1, (m.xp - xpLv(lv)) / Math.max(1, xpLv(lv + 1) - xpLv(lv))));
      const guest = m.provider === 'guest', prov = m.provider === 'apple' ? 'Apple' : m.provider === 'google' ? 'Google' : guest ? t('provGuest') : '';
      return `<div class="acc-card"><span class="badge">${lv}</span><div><b>${esc(m.nick)}</b> <span class="gr">${esc(t(m.grade))}${pum(m.rank)} ${t('level', { n: lv })}</span> <small class="prov">${esc(prov)}</small></div><div class="xpbar"><i style="width:${(f * 100).toFixed(1)}%"></i></div></div>
        <div class="hint2">${t('gamesWins', { g: m.games, w: m.wins })} · XP ${fmt(m.xp)}</div>
        <div class="acc-track"><span>${t('trackHead')}</span><button class="${m.track !== 'civ' ? 'on' : ''}" data-track="mil" type="button">${t('trackMil')}</button><button class="${m.track === 'civ' ? 'on' : ''}" data-track="civ" type="button">${t('trackCiv')}</button></div>
        ${guest ? `<div class="acc-link"><b>${t('linkHead')}</b><div class="hint2">${t('linkHint')}</div><div class="acc-btns"><button class="btn sso apple" data-sso="apple" data-link="1" type="button" ${app ? '' : 'disabled'}>${t('loginApple')}</button><button class="btn sso google" data-sso="google" data-link="1" type="button" ${app ? '' : 'disabled'}>${t('loginGoogle')}</button></div></div>` : ''}
        <div class="acc-btns"><button class="btn" id="acc-rank" type="button">${t('ranking')}</button><button class="btn" id="acc-nickbtn" type="button">${t('nickEdit')}</button><button class="btn" id="acc-out" type="button">${t('logout')}</button><button class="btn warn" id="acc-del" type="button">${t('deleteAcc')}</button></div>
        <div id="acc-nickbox" hidden><div class="inline"><input id="acc-nick2" maxlength="12" value="${esc(m.nick)}"><button class="btn" id="acc-nicksave" type="button">${t('save')}</button></div></div>
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
      $('diffs').innerHTML = T.difficulties.map((d) => `<button class="${cfg.diff === d.id && pk('diff') ? 'on' : ''}" data-cfg="diff" data-v="${d.id}" type="button" style="--dc:${DIFF_COL[d.id] || '#c99a2e'}">${d.name}${d.id === 'nightmare' && +cfg.mutLv ? ` +${cfg.mutLv}` : ''}<small>${t('rounds', { n: d.rounds, m: d.mult })}</small></button>`).join('');
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
      const cb = $('contbtn'), showC = !on && sv && sv.v === 1;
      cb.hidden = !showC;
      if (showC) { const dn = (T.difficulties.find((d) => d.id === sv.diff) || {}).name || ''; cb.textContent = t('continueGame', { r: sv.round, d: dn }); cb.onclick = () => begin({ snap: sv, mode: 'solo', diff: sv.diff }); }
      $('startbtn').textContent = isRoom ? (!lobby ? t('joinFirst') : host ? t('startHost') : t('waitHost')) : t('start');
      $('startbtn').disabled = (isRoom && (!lobby || !host)) || !pk('diff') || (window.RTD_LOBBY && !window.RTD_LOBBY.diffOpen(cfg.diff, +cfg.mutLv));
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
      $('lbcfg').innerHTML = hc ? `${t('hostCfg')}: <b>${esc(dn || '')}${hc.mutLv ? ` +${hc.mutLv}` : ''}</b>${!lobby.isHost() && (hc.muts || []).length ? `<div style="display:grid;gap:4px;margin-top:5px">${hc.muts.map(mutCard).join('')}</div>` : ''}` : '';
    };
    const setErr = (e) => { const el = $('acc-err'); if (el) el.textContent = e ? errText(e) : ''; };
    const signedIn = (r) => { ACC.token = r.token; ACC.me = r.me; saveAcc(); $('accbox').dataset.html = ''; dr(); };
    function bindAcc() {
      const box = $('accbox');
      const nickIn = () => { const el = $('acc-nick'); return (el && el.value.trim()) || ''; };
      const agreed = () => { const el = $('acc-agree'); return !!(el && el.checked); };
      // 게스트: 이 기기에 비밀값이 있으면 그걸로, 없으면 새로 만든다
      const gb = $('acc-guest');
      if (gb) gb.onclick = async () => {
        setErr(''); gb.disabled = true;
        let r;
        if (GUEST && GUEST.id) { r = await api('/api/guest/login', { id: GUEST.id, secret: GUEST.secret }); if (r.status === 401) { saveGuest(null); GUEST.id = null; } }
        if (!r || !r.token) {
          if (!agreed()) { gb.disabled = false; setErr('need_agree'); return; }
          r = await api('/api/guest/new', { nick: nickIn() || t('guestNick', { n: 1000 + ((Math.random() * 9000) | 0) }), agree: true, termsVer: 1, lang: I.lang });
          if (r.guest) { saveGuest(r.guest); Object.assign(GUEST || {}, r.guest); }
        }
        gb.disabled = false;
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
    const toastTitle = (txt) => { $('roster').textContent = txt; };
    // 로그인 상태 새로 받기(등급이 다른 기기에서 올랐을 수 있다)
    if (ACC.token) api('/api/me').then((r) => { if (r.me) { ACC.me = r.me; saveAcc(); } $('accbox').dataset.html = ''; dr(); });
    else if (GUEST && GUEST.id) api('/api/guest/login', { id: GUEST.id, secret: GUEST.secret }).then((r) => { if (r.token) signedIn(r); });
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
    const join = async (code) => {
      if (!ACC.token) return;
      $('roster').textContent = t('connecting');
      const l = await window.RTD_NET.connect(code, ACC.me.nick, { token: ACC.token });
      if (l === 'full') { $('roster').textContent = t('roomFull'); return; }
      if (l === 'auth') { ACC.token = null; ACC.me = null; saveAcc(); $('accbox').dataset.html = ''; $('roster').textContent = t('err_auth'); dr(); return; }
      if (!l) { $('roster').textContent = t('noServer'); return; }
      lobby = l;
      $('code').value = code;
      lobby.code = code;
      $('roster').textContent = '';
      const show = () => dr();
      lobby.onLobby = show; show();
      lobby.onStart = (d) => begin({ diff: d.diff, mode: 'multi', seed: d.seed, net: lobby, muts: d.muts || [], mutLv: d.mutLv || 0, online: true, key: code + '-' + d.seed });
    };
    $('mk').onclick = () => join(Math.random().toString(36).slice(2, 7));
    document.addEventListener('pointerdown', () => { if (g) Snd.init(); });
    $('jn').onclick = () => { const c = $('code').value.trim().toLowerCase().replace(/[^a-z0-9]/g, ''); if (c) join(c); };
    $('startbtn').onclick = () => {
      const mm = cfg.diff === 'nightmare' ? { muts: cfg.muts.slice(), mutLv: +cfg.mutLv } : { muts: [], mutLv: 0 };
      const online = cfg.play === 'online';
      if (cfg.mode === 'multi' || cfg.mode === 'create' || cfg.mode === 'join') { if (lobby && lobby.isHost()) lobby.start(cfg.diff, mm); return; }
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
      h += `<div class="h">${t('sound')}</div><div class="row"><div>${t('sfx')}</div><button class="toggle" data-act="vol" data-arg="sfx" type="button">${Math.round(Snd.state.sfx * 100)}%</button></div>`;
      h += `<div class="row"><div>${t('bgm')}</div><button class="toggle" data-act="vol" data-arg="bgm" type="button">${Math.round(Snd.state.bgm * 100)}%</button></div>`;
      h += `<div class="h">${I.t('tutReplay')}</div><div class="row"><div><small>${I.t('tutReplayHint')}</small></div><button class="toggle" data-act="tutReset" type="button">${I.t('tutReplay')}</button></div>`;
      h += `<div class="row"><div>${window.RTD_CREDITS ? window.RTD_CREDITS.label() : ''}</div><button class="toggle" data-act="credits" type="button">${t('view')}</button></div>`;
      h += `<div class="row"><div>${t('version')}</div><div>v${window.RTD_VERSION || '?'}</div></div>`;
      return `<div class="setlist">${h}</div>`;
    };
    const repaintMap = () => { sizeMap(); };
    if (window.RTD_LOBBY) window.RTD_LOBBY.init({ api, ACC, saveAcc, t, I, T, cfg, getLobby: () => lobby, joinRoom: (code) => join(code), begin, refreshAcc, settingsHtml, errText, clock, repaintMap, repaintSetup: () => dr(), paintMini: (cv, theme) => paintMap(cv.getContext('2d'), cv.width, cv.height, theme || null) });
    dr();
  }
  setupTitle();
  requestAnimationFrame(loop);
})();
