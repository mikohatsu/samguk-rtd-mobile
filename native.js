// 앱(Capacitor)에서만 쓰는 기능. 웹 브라우저에서는 아무것도 하지 않는다.
(function (root) {
  const C = root.Capacitor, on = !!(C && C.isNativePlatform && C.isNativePlatform());
  const P = on ? C.Plugins || {} : {};
  // 출시 전에 실제 AdMob 광고 단위 ID로 바꾼다(지금은 구글 공식 시험용 ID)
  const AD = { interstitial: 'ca-app-pub-3940256099942544/4411468910', testing: true };
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

  root.RTD_NATIVE = { on, init, interstitial, openUrl, signIn, signOut };
  if (on) init();
})(typeof window !== 'undefined' ? window : globalThis);
