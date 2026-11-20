// 앱(Capacitor)에서만 쓰는 기능. 웹 브라우저에서는 아무것도 하지 않는다.
(function (root) {
  const C = root.Capacitor, on = !!(C && C.isNativePlatform && C.isNativePlatform());
  const P = on ? C.Plugins || {} : {};
  // AdMob 광고 단위 ID. 출시 전에 REAL에 AdMob 콘솔의 실제 ID를 넣는다(비어 있으면 구글 공식 시험용 ID와 시험 모드로 돈다).
  // 앱 ID는 따로: 안드로이드 android/app/src/main/AndroidManifest.xml, iOS ios/App/App/Info.plist의 GADApplicationIdentifier.
  const droid = on && C.getPlatform && C.getPlatform() === 'android';
  const REAL = { android: { interstitial: '', reward: '' }, ios: { interstitial: '', reward: '' } };
  const TEST = { android: { interstitial: 'ca-app-pub-3940256099942544/1033173712', reward: 'ca-app-pub-3940256099942544/5224354917' },
    ios: { interstitial: 'ca-app-pub-3940256099942544/4411468910', reward: 'ca-app-pub-3940256099942544/1712485313' } };
  const real = REAL[droid ? 'android' : 'ios'];
  const AD = real.interstitial && real.reward ? Object.assign({ testing: false }, real) : Object.assign({ testing: true }, TEST[droid ? 'android' : 'ios']);
  let adReady = false;

  async function prepareAd() {
    if (!P.AdMob) return;
    try { await P.AdMob.prepareInterstitial({ adId: AD.interstitial, isTesting: AD.testing }); adReady = true; } catch (e) { adReady = false; }
  }

  async function init() {
    if (!on) return;
    try { if (P.ScreenOrientation) await P.ScreenOrientation.lock({ orientation: 'landscape' }); } catch (e) { /* 지원 안 함 */ }
    try { if (P.StatusBar) await P.StatusBar.hide(); } catch (e) { /* 지원 안 함 */ }
    try { if (P.SplashScreen) await P.SplashScreen.hide(); } catch (e) { /* 이미 닫힘 */ }
    if (!P.AdMob) return;
    try {
      // 광고 추적 허용(ATT)은 처음 한 번만 묻는다. 거부해도 광고는 맞춤형이 아닐 뿐 그대로 나온다.
      const st = await P.AdMob.trackingAuthorizationStatus();
      if (st && st.status === 'notDetermined') await P.AdMob.requestTrackingAuthorization();
      await P.AdMob.initialize({});
      prepareAd();
    } catch (e) { /* 광고 없이 진행 */ }
  }

  // 전면 광고를 보여 주고 닫히면 next. 광고가 없으면 바로 next. 돌려주는 값: 앱 광고를 썼는지
  function interstitial(next) {
    if (!on || !P.AdMob || !adReady) return false;
    let done = false;
    const finish = () => { if (done) return; done = true; hs.forEach((h) => h.then((x) => x.remove()).catch(() => {})); adReady = false; prepareAd(); next(); };
    const hs = ['interstitialAdDismissed', 'interstitialAdFailedToShow'].map((ev) => Promise.resolve(P.AdMob.addListener(ev, finish)));
    P.AdMob.showInterstitial().catch(finish);
    return true;
  }

  // 보상형 광고(장수 해금용 동전). 끝까지 보면 resolve, 닫거나 실패하면 reject. 동전은 서버(/api/ad/reward)가 하루 상한을 지켜 준다.
  const rewardOn = () => on && !!P.AdMob;
  async function rewardAd() {
    if (!rewardOn()) throw new Error('no_ad');
    await P.AdMob.prepareRewardVideoAd({ adId: AD.reward, isTesting: AD.testing });
    const r = await P.AdMob.showRewardVideoAd(); // @capacitor-community/admob 8.x: 보상을 받으면 resolve
    try { localStorage.setItem('rtd-adT', String(Date.now())); } catch (e) { /* 저장 안 됨: 판 끝 광고 간격 계산에만 쓴다 */ }
    return r || {};
  }

  // 인앱 결제(장수 해금·광고 제거, 확정 구매만): @capgo/native-purchases. 구매 확인(acknowledge·finish)은 플러그인이 자동으로 한다.
  // 서버에 보내는 영수증: iOS = StoreKit 2 서명 거래(JWS) { signed }, 안드로이드 = 구글 플레이 구매 토큰 { store: 'google', productId, token }.
  // 서버가 검증한 뒤에만 해금한다(server/app.js /api/iap/verify).
  const IAP = { plugin: 'NativePurchases', enabled: true };
  const iapOn = () => on && IAP.enabled && !!P[IAP.plugin];
  function receipt(x) {
    if (!x) return null;
    if (droid) return x.purchaseToken && (x.purchaseState == null || String(x.purchaseState) === '1') ? { store: 'google', productId: x.productIdentifier, token: x.purchaseToken } : null;
    const signed = x.jwsRepresentation || x.jws || x.signedTransaction;
    return signed ? { signed } : null;
  }
  async function iapBuy(productId) {
    if (!iapOn()) throw new Error('not_configured');
    const r = receipt(await P[IAP.plugin].purchaseProduct({ productIdentifier: productId, productType: 'inapp', quantity: 1 }));
    if (!r) throw new Error('bad_receipt');
    return r;
  }
  async function iapRestore() {
    if (!iapOn()) throw new Error('not_configured');
    try { await P[IAP.plugin].restorePurchases(); } catch (e) { /* 목록만 다시 읽는다 */ }
    const r = await P[IAP.plugin].getPurchases(droid ? { productType: 'inapp' } : { onlyCurrentEntitlements: true });
    return ((r && r.purchases) || []).map(receipt).filter(Boolean);
  }

  // Apple·Google 로그인(@capgo/capacitor-social-login). ID 토큰을 받아 서버가 검증한다(서버 GOOGLE_AUDS에 아래 ID들을 넣는다).
  // Google 클라이언트 ID(Google Cloud 콘솔 > API 및 서비스 > 사용자 인증 정보, MAC_HANDOFF.md 참고):
  //   googleIOS = iOS 클라이언트 ID, googleWeb = 웹 애플리케이션 클라이언트 ID.
  //   안드로이드는 googleWeb만 쓴다(안드로이드 클라이언트 ID는 콘솔에 패키지 이름 + 서명 SHA-1로 만들어 두기만 하면 된다).
  // Apple 로그인은 iOS에서만 쓴다(안드로이드는 Apple 웹 로그인용 서버 설정이 따로 필요해서 버튼을 숨긴다).
  const SSO = { googleIOS: '', googleWeb: '' };
  const ssoHas = (provider) => on && (provider === 'apple' ? !droid : droid ? !!SSO.googleWeb : !!SSO.googleIOS);
  let ssoReady = null;
  async function ssoInit() {
    if (!P.SocialLogin) throw new Error('not_configured');
    if (!ssoReady) {
      const cfg = {};
      // useProperTokenExchange: Apple이 authorization code를 따로 돌려준다(서버가 refresh token으로 바꿔 두었다가 계정 삭제 때 철회)
      if (!droid) cfg.apple = { useProperTokenExchange: true };
      if (droid && SSO.googleWeb) cfg.google = { webClientId: SSO.googleWeb, mode: 'online', skipAuthOnlyAuthorizationAfterSignIn: true };
      if (!droid && SSO.googleIOS) cfg.google = { iOSClientId: SSO.googleIOS, iOSServerClientId: SSO.googleWeb || undefined, mode: 'online' };
      ssoReady = P.SocialLogin.initialize(cfg);
    }
    await ssoReady;
  }
  async function signIn(provider) {
    if (!on) throw new Error('app_only');
    if (!ssoHas(provider)) throw new Error('not_configured');
    await ssoInit();
    // 안드로이드 기본 BridgeActivity에서는 scopes를 넘기면 거절된다(profile·email은 기본 포함)
    // Apple: 이름·이메일을 요청하지 않는다(빈 배열. scopes를 빼면 플러그인이 이름·이메일을 기본으로 요청한다). 처리방침 「氏名は保存しません」, 실명이 닉네임 기본값이 되지 않게
    const options = provider === 'apple' ? { scopes: [] } : droid ? {} : { scopes: ['profile'] };
    let r;
    try { r = await P.SocialLogin.login({ provider, options }); } catch (e) { throw new Error(/cancel/i.test(String(e && e.message)) ? 'cancel' : 'bad_token'); }
    const res = (r && r.result) || {};
    const tok = res.idToken;
    if (!tok) throw new Error('bad_token');
    // Apple은 이름을 쓰지 않는다(예전 시험 로그인 때 플러그인이 기기에 남긴 이름이 돌아와도 버린다)
    const nm = provider === 'apple' ? '' : res.profile && (res.profile.givenName || res.profile.name);
    if (provider === 'apple' && res.authorizationCode) sendAppleCode(tok, res.authorizationCode);
    return { idToken: tok, name: nm || '' };
  }
  // Apple authorization code를 서버에 넘긴다(서버가 refresh token으로 바꿔 두고, 계정 삭제 때 Apple에 철회한다. 심사 지침 5.1.1(v)).
  // 로그인 흐름과 따로 보내고 기다리지 않는다. 실패해도 로그인은 그대로(서버에 Apple 키 설정이 없으면 503).
  function sendAppleCode(idToken, code) {
    const base = root.RTD_API;
    if (!base || typeof fetch !== 'function') return;
    fetch(base + '/api/auth/apple/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, code }) }).catch(() => {});
  }
  async function signOut(provider) { try { if (on && P.SocialLogin) await P.SocialLogin.logout({ provider }); } catch (e) { /* 이미 로그아웃 */ } }

  // 약관 같은 바깥 링크는 앱 안 브라우저로 연다
  function openUrl(url) {
    if (on && P.Browser) { P.Browser.open({ url }).catch(() => {}); return true; }
    return false;
  }
  if (on) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[target="_blank"]');
      if (a && openUrl(a.href)) e.preventDefault();
    }, true);
  }

  // 화면 꺼짐 방지: 앱은 네이티브 쪽(MainActivity·AppDelegate)에서 막는다. 브라우저에서는 Wake Lock을 쓴다(지원하는 브라우저만, 화면을 누른 뒤부터).
  if (!on && typeof navigator !== 'undefined' && navigator.wakeLock && typeof document !== 'undefined') {
    let lock = null;
    const keep = () => { if (lock || document.visibilityState !== 'visible') return; navigator.wakeLock.request('screen').then((l) => { lock = l; l.addEventListener('release', () => { lock = null; }); }).catch(() => {}); };
    document.addEventListener('pointerdown', keep, { passive: true });
    document.addEventListener('visibilitychange', keep);
  }
  // 앱 활성 상태(@capacitor/app): 제어 센터·전화처럼 visibilitychange가 안 오는 경우도 잡는다. 받는 쪽은 audio.js, 17-loop.js
  if (on && P.App && P.App.addListener) {
    try {
      Promise.resolve(P.App.addListener('appStateChange', (s) => {
        try { root.dispatchEvent(new CustomEvent('rtd-appstate', { detail: { active: !!(s && s.isActive) } })); } catch (e) { /* 무시 */ }
      })).catch(() => {});
    } catch (e) { /* 플러그인 없음 */ }
  }
  // 안드로이드 뒤로 가기(@capacitor/app backButton): 열려 있는 것을 하나 닫는다. 화면 코드를 부르지 않고 그 창의 닫기 버튼을 대신 눌러 준다.
  // 순서: 크레딧(맨 위에 뜨는 창) → 판 안 서랍 → 로비 창 → 전투 시작 창 → 안내 말풍선(다음·확인). 아무것도 없으면 로비에서는 앱을 내리고, 판 안에서는 메뉴(서랍)를 연다.
  function backButton() {
    const q = (s) => document.querySelector(s), shown = (el) => !!el && !el.hidden && el.getClientRects().length > 0;
    // 게임 버튼(data-act)과 말풍선은 pointerdown으로, 로비·크레딧 버튼은 click으로 받으므로 둘 다 보낸다
    const press = (b) => { b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' })); b.click(); };
    const shut = (boxSel, btnSel) => { const b = q(btnSel); if (!shown(q(boxSel)) || !b || b.hidden || b.disabled) return false; press(b); return true; };
    if (shut('#credits', '#credits-x') || shut('#drawer', '#dclose') || shut('#lpanel', '#lpclose') || shut('#setup', '#wzclose') || shut('#tutbox', '#tutbox [data-tut="next"]')) return;
    if (shown(q('#app'))) { const m = q('#menubtn'); if (m) press(m); return; }
    if (P.App && P.App.minimizeApp) Promise.resolve(P.App.minimizeApp()).catch(() => {});
  }
  if (droid && P.App && P.App.addListener) {
    try { Promise.resolve(P.App.addListener('backButton', () => { try { backButton(); } catch (e) { /* 무시 */ } })).catch(() => {}); } catch (e) { /* 플러그인 없음 */ }
  }
  root.RTD_NATIVE = { on, droid, init, interstitial, openUrl, signIn, signOut, ssoHas, rewardOn, rewardAd, iapOn, iapBuy, iapRestore };
  if (on) init();
})(typeof window !== 'undefined' ? window : globalThis);
