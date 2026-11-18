  // ---- 계정(온라인) ----
  const API = window.RTD_API || '';
  const ACC = (() => { try { return JSON.parse(localStorage.getItem('rtd-acc') || 'null'); } catch (e) { return null; } })() || { token: null, me: null };
  const saveAcc = () => { try { localStorage.setItem('rtd-acc', JSON.stringify(ACC)); } catch (e) { /* 저장 불가 */ } };
  async function api(path, body) {
    try {
      const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, ACC.token ? { Authorization: 'Bearer ' + ACC.token } : {}), body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 && !/^\/api\/(login|delete|guest\/login|auth\/)/.test(path)) { ACC.token = null; ACC.me = null; saveAcc(); }
      return Object.assign({ status: r.status }, j);
    } catch (e) { return { status: 0, error: 'net' }; }
  }
  const errText = (e) => (e === 'net' ? t('noServer') : t('err_' + e) !== 'err_' + e ? t('err_' + e) : String(e || ''));
  const xpLv = (lv) => 40 * (lv - 1) * (lv - 1);
  // 게스트 비밀값(이 기기에만): 토큰이 만료돼도 다시 들어온다
  // GUEST는 늘 같은 객체다(비밀값이 없으면 id가 null). saveGuest가 저장소와 이 객체를 같이 바꾸므로, 같은 실행 안에서 가입·로그아웃을 해도 최신 값을 본다
  const GUEST = Object.assign({ id: null, secret: null }, (() => { try { return JSON.parse(localStorage.getItem('rtd-guest') || 'null'); } catch (e) { return null; } })() || {});
  const saveGuest = (g2) => {
    Object.keys(GUEST).forEach((k) => { delete GUEST[k]; }); Object.assign(GUEST, { id: null, secret: null }, g2 || {});
    try { if (g2) localStorage.setItem('rtd-guest', JSON.stringify(g2)); else localStorage.removeItem('rtd-guest'); } catch (e) { /* 저장 불가 */ }
  };
  // 게스트로 들어가기: 이 기기에 비밀값이 있으면 먼저 그걸로 로그인한다. 서버가 401(없는 계정)이라고 할 때만 비밀값을 지우고 make()로 새로 만든다.
  // 끊김·429·5xx면 비밀값을 그대로 두고 그 답을 돌려준다(새 계정을 만들어 옛 계정을 덮지 않게). make가 null을 돌려주면(약관 미동의 등) { stop: true }
  async function guestEnter(make) {
    if (GUEST.id) {
      const r = await api('/api/guest/login', { id: GUEST.id, secret: GUEST.secret });
      if (r.token) return r;
      if (r.status !== 401) return r;
      saveGuest(null);
    }
    const body = make(); if (!body) return { stop: true };
    const r = await api('/api/guest/new', body);
    if (r.token && r.guest) { saveGuest(r.guest); r.fresh = true; }
    return r;
  }
  const gradeTag = (st) => (st && st.gr ? `<span class="gr">${esc(t(st.gr))} ${t('level', { n: st.lv })}</span>` : '');
  // 판이 끝나면 온라인 판 결과를 서버에 보내 경험치를 받는다(같은 판은 한 번만)
  // 서버에 닿지 못하면(끊김·5xx) 보낼 내용을 기기에 남겨 두고 다음에 앱을 켤 때·로비로 돌아올 때 다시 보낸다(lobby.js queueSend·flushPending)
  async function reportResult() {
    if (!S.online || !ACC.token || S.reported) return;
    S.reported = true;
    const body = { ticket: S.gameTk, myth: g.stats.myth || {}, st: window.RTD_LOBBY ? window.RTD_LOBBY.statsOf(g) : {}, mode: net ? 'room' : 'solo', key: S.gameKey, party: S.gameKey, diff: g.diff.id, round: g.round, win: g.over === 'win', mutLv: g.mutLv || 0, time: Math.round(g.time), imm: g.stats.imm || {} };
    const uid = ACC.me && ACC.me.id, r = await api('/api/result', body);
    if ((r.status === 0 || r.status >= 500) && body.ticket && window.RTD_LOBBY) window.RTD_LOBBY.queueSend('/api/result', body, uid);
    if (r.me) {
      ACC.me = r.me; saveAcc(); S.xpGained = r.gained;
      if (r.gained > 0) { S.xpPlaying = true; playXp(r.me.xp - r.gained, r.me.xp, r.coins, () => { S.xpPlaying = false; S.xpDone = true; dirty(); $('overlay').dataset.key = ''; }); }
      dirty(); const box = $('overlay'); box.dataset.key = '';
    }
  }
  // 판 끝 전면 광고: 판이 끝나 로비로 돌아갈 때만(판 도중에는 절대 안 띄운다).
  // 덜 불편하게: 처음 2판은 없음, 앞 광고(보상형 포함)에서 5분이 안 지났으면 없음(빨리 다시 하기 반복 방지), 광고 제거를 샀으면 없음.
  const AD_FREE_GAMES = 2, AD_GAP = 5 * 60000;
  function noAds() {
    const k = T.unlock && T.unlock.noAdsKey, me = ACC.me;
    if (me && k) { const own = (me.owned || []).includes(k); try { localStorage.setItem('rtd-noads', own ? '1' : ''); } catch (e) { /* 저장 안 됨 */ } return own; }
    try { return localStorage.getItem('rtd-noads') === '1'; } catch (e) { return false; }
  }
  function adThen(next) {
    let n = 0, lastAd = 0; const now = Date.now();
    try { n = +(localStorage.getItem('rtd-games') || 0) + 1; localStorage.setItem('rtd-games', String(n)); lastAd = +(localStorage.getItem('rtd-adT') || 0); } catch (e) { n = 1; }
    if (n <= AD_FREE_GAMES || now - lastAd < AD_GAP || noAds()) { next(); return; }
    try { localStorage.setItem('rtd-adT', String(now)); } catch (e) { /* 저장 안 됨 */ }
    // 앱에서는 AdMob 전면 광고, 웹·광고 준비 안 됨이면 아래 자리 표시
    if (window.RTD_NATIVE && window.RTD_NATIVE.on) { if (!window.RTD_NATIVE.interstitial(next)) next(); return; }
    const ov = $('adover'), btn = $('adclose');
    ov.hidden = false; let left = 5;
    const tickAd = () => { btn.disabled = left > 0; btn.textContent = left > 0 ? t('adSkip', { n: left }) : t('adClose'); left--; if (left >= -1) setTimeout(tickAd, 1000); };
    tickAd();
    btn.onclick = () => { if (!btn.disabled) { ov.hidden = true; next(); } };
  }

