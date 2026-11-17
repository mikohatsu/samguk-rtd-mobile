// 앱(Capacitor)에서만 쓰는 기능. 웹 브라우저에서는 아무것도 하지 않는다.
(function (root) {
  const C = root.Capacitor, on = !!(C && C.isNativePlatform && C.isNativePlatform());
  const P = on ? C.Plugins || {} : {};
  // 출시 전에 실제 AdMob 광고 단위 ID로 바꾼다(지금은 구글 공식 시험용 ID)
  // 시험용 전면 광고 ID는 iOS와 안드로이드가 다르다
  const droid = on && C.getPlatform && C.getPlatform() === 'android';
  const AD = { interstitial: droid ? 'ca-app-pub-3940256099942544/1033173712' : 'ca-app-pub-3940256099942544/4411468910', testing: true,
    reward: droid ? 'ca-app-pub-3940256099942544/5224354917' : 'ca-app-pub-3940256099942544/1712485313' }; // 보상형 광고(시험용 ID)
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
    return r || {};
  }

  // 인앱 결제(장수 해금, 확정 구매만). 결제 플러그인은 아직 설치하지 않았다 → IAP.plugin이 없으면 화면이 결제 버튼을 숨긴다.
  // 설치 후(MAC_HANDOFF.md '인앱 결제' 절) plugin 이름과 아래 두 함수를 플러그인 API에 맞춘다. 서버에는 StoreKit 2 서명 거래(JWS)를 보낸다.
  const IAP = { plugin: 'NativePurchases', enabled: false };
  const iapOn = () => on && IAP.enabled && !!P[IAP.plugin];
  async function iapBuy(productId) {
    if (!iapOn()) throw new Error('not_configured');
    // [확인 필요] 플러그인마다 이름이 다르다. 예) @capgo/native-purchases: purchaseProduct({ productIdentifier }) → { jwsRepresentation? }
    const r = await P[IAP.plugin].purchaseProduct({ productIdentifier: productId, productType: 'inapp', quantity: 1 });
    const signed = r && (r.jwsRepresentation || r.jws || r.signedTransaction);
    if (!signed) throw new Error('bad_receipt');
    return signed;
  }
  async function iapRestore() {
    if (!iapOn()) throw new Error('not_configured');
    await P[IAP.plugin].restorePurchases();
    const r = await P[IAP.plugin].getPurchases ? await P[IAP.plugin].getPurchases({ productType: 'inapp' }) : { purchases: [] };
    return ((r && r.purchases) || []).map((x) => x.jwsRepresentation || x.jws || x.signedTransaction).filter(Boolean);
  }

  // Apple·Google 로그인(@capgo/capacitor-social-login). ID 토큰을 받아 서버가 검증한다.
  // Google은 Google Cloud 콘솔에서 만든 iOS 클라이언트 ID와 웹(서버) 클라이언트 ID가 필요하다(MAC_HANDOFF.md 참고).
  const SSO = { googleIOS: '', googleWeb: '' };
  let ssoReady = null;
  async function ssoInit() {
    if (!P.SocialLogin) throw new Error('not_configured');
    if (!ssoReady) ssoReady = P.SocialLogin.initialize(Object.assign({ apple: {} }, SSO.googleIOS ? { google: { iOSClientId: SSO.googleIOS, iOSServerClientId: SSO.googleWeb || undefined, mode: 'online' } } : {}));
    await ssoReady;
  }
  async function signIn(provider) {
    if (!on) throw new Error('app_only');
    if (provider === 'google' && !SSO.googleIOS) throw new Error('not_configured');
    await ssoInit();
    let r;
    try { r = await P.SocialLogin.login({ provider, options: provider === 'apple' ? { scopes: ['name'] } : { scopes: ['profile'] } }); } catch (e) { throw new Error(/cancel/i.test(String(e && e.message)) ? 'cancel' : 'bad_token'); }
    const res = (r && r.result) || {};
    const tok = res.idToken || (res.responseType === 'online' && res.idToken);
    if (!tok) throw new Error('bad_token');
    const nm = res.profile && (res.profile.givenName || res.profile.name);
    return { idToken: tok, name: nm || '' };
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
  root.RTD_NATIVE = { on, init, interstitial, openUrl, signIn, signOut, rewardOn, rewardAd, iapOn, iapBuy, iapRestore };
  if (on) init();
})(typeof window !== 'undefined' ? window : globalThis);
