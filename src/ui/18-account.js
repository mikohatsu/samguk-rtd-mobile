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
  const xpLv = window.RTD_PROG.xpAt; // 레벨 lv의 누적 경험치(progression.js, 서버와 같은 관직 곡선)
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
  // 판이 끝나면 판 결과를 서버에 보내 경험치·동전을 받는다(같은 판은 한 번만). 온라인 판은 /api/result, 오프라인 판(혼자·AI 동맹)은 /api/history.
  // 보상 배율은 서버가 판 표에 적어 둔 판 종류(인원)로 정한다. 오프라인 판은 표가 있을 때만 보낸다(표가 없으면 서버가 받지 않는다)
  // 서버에 닿지 못하면(끊김·5xx) 보낼 내용을 기기에 남겨 두고 다음에 앱을 켤 때·로비로 돌아올 때 다시 보낸다(lobby.js queueSend·flushPending)
  async function reportResult() {
    S.msClaim = false; S.rwRank = null; S.rwAch = null;
    if (!ACC.token || S.reported || (!S.online && !S.gameTk)) return;
    S.reported = true;
    const path = S.online ? '/api/result' : '/api/history';
    const body = { ticket: S.gameTk, myth: g.stats.myth || {}, st: window.RTD_LOBBY ? window.RTD_LOBBY.statsOf(g) : {}, mode: net ? 'room' : bots.length ? 'ai' : 'solo', key: S.gameKey, party: S.gameKey, diff: g.diff.id, round: g.round, win: g.over === 'win', mutLv: g.mutLv || 0, time: Math.round(g.time), imm: g.stats.imm || {}, ach: Object.keys((g.me && g.me.done) || {}).filter((k) => g.me.done[k]) };
    const uid = ACC.me && ACC.me.id, r = await api(path, body);
    if ((r.status === 0 || r.status >= 500) && body.ticket && window.RTD_LOBBY) window.RTD_LOBBY.queueSend(path, body, uid);
    if (r.me) {
      ACC.me = r.me; saveAcc(); S.xpGained = r.gained; S.coinGained = r.coins || 0;
      // 서버가 준 관직 승급·업적 첫 달성 보상: 결과창 '다음 목표' 칸에 알린다(14-endstats-xp.js goalBox)
      S.rwRank = Array.isArray(r.rankUp) && r.rankUp.length ? r.rankUp : null; S.rwAch = Array.isArray(r.ach) && r.ach.length ? r.ach : null;
      // 경험치 연출도 패배 연출(S.endHoldUntil)이 끝난 뒤에 띄운다
      if (r.gained > 0) { S.xpPlaying = true; const mine0 = g; setTimeout(() => { if (g !== mine0) return; playXp(r.me.xp - r.gained, r.me.xp, r.coins, () => { S.xpPlaying = false; S.xpDone = true; dirty(); $('overlay').dataset.key = ''; }); }, Math.max(0, (S.endHoldUntil || 0) - performance.now())); }
      dirty(); const box = $('overlay'); box.dataset.key = '';
      // 받을 수 있는 미션 보상이 생겼는지 한 번 물어본다(결과창 '다음 목표'의 한 줄, 로비 미션 버튼의 빨간 점)
      const mine = g;
      if (window.RTD_LOBBY && window.RTD_LOBBY.missionCheck) window.RTD_LOBBY.missionCheck().then((n) => { if (g !== mine || !n) return; S.msClaim = true; dirty(); $('overlay').dataset.key = ''; });
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

