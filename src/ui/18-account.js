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
    const r = await api('/api/result', { myth: g.stats.myth || {}, st: window.RTD_LOBBY ? window.RTD_LOBBY.statsOf(g) : {}, mode: net ? 'room' : 'solo', key: S.gameKey, party: S.gameKey, diff: g.diff.id, round: g.round, win: g.over === 'win', mutLv: g.mutLv || 0, time: Math.round(g.time), imm: g.stats.imm || {} });
    if (r.me) {
      ACC.me = r.me; saveAcc(); S.xpGained = r.gained;
      if (r.gained > 0) { S.xpPlaying = true; playXp(r.me.xp - r.gained, r.me.xp, r.coins, () => { S.xpPlaying = false; S.xpDone = true; dirty(); $('overlay').dataset.key = ''; }); }
      dirty(); const box = $('overlay'); box.dataset.key = '';
    }
  }
  // 광고: 두 판에 한 번(시제품은 자리만). 실제 앱에서는 광고 SDK로 바꾼다.
  function adThen(next) {
    let n = 0;
    try { n = +(localStorage.getItem('rtd-games') || 0) + 1; localStorage.setItem('rtd-games', String(n)); } catch (e) { n = 1; }
    if (n % 2) { next(); return; }
    // 앱에서는 AdMob 전면 광고, 웹·광고 준비 안 됨이면 아래 자리 표시
    if (window.RTD_NATIVE && window.RTD_NATIVE.on) { if (!window.RTD_NATIVE.interstitial(next)) next(); return; }
    const ov = $('adover'), btn = $('adclose');
    ov.hidden = false; let left = 5;
    const tickAd = () => { btn.disabled = left > 0; btn.textContent = left > 0 ? t('adSkip', { n: left }) : t('adClose'); left--; if (left >= -1) setTimeout(tickAd, 1000); };
    tickAd();
    btn.onclick = () => { if (!btn.disabled) { ov.hidden = true; next(); } };
  }

