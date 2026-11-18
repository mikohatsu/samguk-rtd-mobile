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
  const GUEST = (() => { try { return JSON.parse(localStorage.getItem('rtd-guest') || 'null'); } catch (e) { return null; } })();
  const saveGuest = (g2) => { try { if (g2) localStorage.setItem('rtd-guest', JSON.stringify(g2)); else localStorage.removeItem('rtd-guest'); } catch (e) { /* 저장 불가 */ } };
  const gradeTag = (st) => (st && st.gr ? `<span class="gr">${esc(t(st.gr))} ${t('level', { n: st.lv })}</span>` : '');
  // 판이 끝나면 온라인 판 결과를 서버에 보내 경험치를 받는다(같은 판은 한 번만)
  async function reportResult() {
    if (!S.online || !ACC.token || S.reported) return;
    S.reported = true;
    const r = await api('/api/result', { ticket: S.ticket, myth: g.stats.myth || {}, st: window.RTD_LOBBY ? window.RTD_LOBBY.statsOf(g) : {}, mode: net ? 'room' : 'solo', key: S.gameKey, party: S.gameKey, diff: g.diff.id, round: g.round, win: g.over === 'win', mutLv: g.mutLv || 0, time: Math.round(g.time), imm: g.stats.imm || {} });
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

