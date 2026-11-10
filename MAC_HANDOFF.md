# Mac에서 이어서 할 일 (iOS 출시)

Windows에서 할 수 있는 작업은 끝났습니다. 이 폴더를 통째로 Mac에 옮긴 뒤 아래 순서대로 진행합니다.
`node_modules/`와 `www/`는 옮기지 않아도 됩니다(Mac에서 다시 만듦).

## 0. 지금 상태

| 항목 | 상태 |
|---|---|
| 게임 본체 (`samguk-rtd.html`, `*.js`, `gfx/`, `fonts/`) | 완료. 웹 브라우저에서 그대로 돌아감 |
| 4개 언어 (일·영·한·중) | 완료. 설정에서 바꿈, 첫 실행은 기기 언어 |
| 온라인 서버 | 가동 중: https://34-146-124-57.sslip.io (GCP mikoserver-513016, VM `rtd-online`, 도쿄) |
| 약관·개인정보처리방침 | https://34-146-124-57.sslip.io/terms , /privacy (`?lang=ja|en|ko|zh`) |
| Capacitor 8 iOS 프로젝트 (`ios/`) | 생성됨. Swift Package Manager 방식이라 CocoaPods 필요 없음 |
| Info.plist | 가로 전용, 상태 표시줄 숨김, 암호화 면제, AdMob **시험용** 앱 ID, ATT 문구, SKAdNetwork |
| 언어별 ATT 문구·앱 이름 | `ios/App/App/{ja,en,ko,zh-Hans}.lproj/InfoPlist.strings` (**Xcode에 추가 필요**) |
| 개인정보 매니페스트 | `ios/App/App/PrivacyInfo.xcprivacy` (**Xcode에 추가 필요**) |
| 광고 | `native.js`: 앱에서는 AdMob 전면 광고(2판에 1번), ATT는 첫 실행에 한 번 물음. 지금은 **구글 시험용 광고 ID** |

## 1. Mac 준비

1. Xcode 최신판 설치 (App Store), 한 번 실행해 추가 구성요소 설치
2. Node.js 22 LTS 설치 (`brew install node@22` 또는 nodejs.org)
3. Apple Developer Program 가입(개인, 연 12,800엔). 이름은 HONGSUNGJAE로 표시됨
4. 이 폴더에서:

```bash
npm install
```

```bash
npm run ios
```

`npm run ios` = 게임 파일을 `www/`로 복사 → `npx cap sync ios` → Xcode 열기.
게임 코드를 고칠 때마다 `npm run sync` 후 Xcode에서 다시 실행합니다.

## 2. Xcode에서 한 번만 할 일

1. 왼쪽 파일 목록에서 `App` 폴더에 다음을 끌어다 놓기(“Copy items if needed” 끄고, Target `App` 체크):
   - `PrivacyInfo.xcprivacy`
   - `ja.lproj`, `en.lproj`, `ko.lproj`, `zh-Hans.lproj` 폴더 (InfoPlist.strings)
2. Project `App` → Info → Localizations에 Japanese, English, Korean, Chinese (Simplified) 추가
3. Target `App` → Signing & Capabilities
   - Team: 본인 개발자 계정
   - Bundle Identifier: `com.hongsungjae.sangokurtd` (바꾸려면 `capacitor.config.json`의 appId도 같이)
4. Target `App` → General
   - Display Name: 三国ランダムディフェンス
   - Deployment Target: iOS 15 이상
   - iPhone·iPad 둘 다, Requires Full Screen 체크(이미 Info.plist에 있음)
5. 앱 아이콘: `Assets.xcassets/AppIcon`에 1024×1024 PNG 한 장(투명 없음). 아이콘 그림은 아직 없음 → 정해야 함
6. 시작 화면: `Assets.xcassets/Splash` 이미지 교체(지금은 Capacitor 기본). 배경색 `#1a120c`

## 3. 실기기 확인 목록

- [ ] 가로로만 돌아가는지, 노치·홈 바에 버튼이 가리지 않는지
- [ ] 혼자 하기 중 앱을 내렸다 돌아오면 일시정지 → 계속
- [ ] 앱을 완전히 껐다 켜면 시작 화면에 “이어하기”
- [ ] 온라인: 회원가입·로그인, 방 만들기·참가, 휴대폰 2대 이상 협동
- [ ] 온라인 중 앱을 1분 넘게 내리면 방에서 빠지고 남은 사람은 계속
- [ ] 처음 실행에 ATT 창(일본어 문구), 2판째 끝나고 시험 광고가 뜨고 닫히면 다음 판
- [ ] 약관 링크가 앱 안 브라우저로 열림
- [ ] 소리: 무음 스위치, 다른 앱 음악과 겹칠 때
- [ ] 화질 설정(높음/보통/낮음, 30fps)이 오래된 기기에서 버벅이지 않는지

## 3-1. 로그인(Apple·Google·게스트) 설정

게스트 로그인은 지금 바로 됩니다. Apple·Google은 아래를 해야 켜집니다(코드는 다 들어가 있음: `native.js`의 `signIn`, 서버 `/api/auth/apple`·`/api/auth/google`).

**Apple로 로그인**
1. Xcode → Target `App` → Signing & Capabilities → `+ Capability` → **Sign in with Apple** 추가
2. Apple Developer 사이트의 App ID(`com.hongsungjae.sangokurtd`)에도 Sign in with Apple이 켜졌는지 확인
3. 서버는 앱 번들 ID를 받는 쪽으로 검증한다(기본값 그대로면 됨). 번들 ID를 바꾸면 서버 환경 변수 `APPLE_AUDS`도 같이
4. **계정 삭제 시 토큰 철회(Apple 심사 요구):** Apple 키(.p8)를 만들어 서버에서 `https://appleid.apple.com/auth/revoke`를 부르게 해야 함 → 키 발급 후 말하기(서버 쪽 작업)

**Google로 로그인**
1. Google Cloud 콘솔(mikoserver-513016) → API 및 서비스 → OAuth 동의 화면 설정
2. 사용자 인증 정보 → OAuth 클라이언트 ID 2개: **iOS**(번들 ID 입력) + **웹 애플리케이션**
3. `native.js`의 `SSO = { googleIOS: 'iOS 클라이언트 ID', googleWeb: '웹 클라이언트 ID' }`
4. `ios/App/App/Info.plist`에 iOS 클라이언트 ID의 **역순 URL 스킴**(`com.googleusercontent.apps.…`)을 URL Types로 추가
5. 서버 환경 변수 `GOOGLE_AUDS=iOS클라이언트ID,웹클라이언트ID` (systemd 서비스 `rtd-online`의 Environment) 후 재시작. 설정 전에는 Google 로그인이 "준비 중"으로 막힘

**실기기 확인**
- [ ] 게스트로 시작 → 몇 판 → Apple(또는 Google) 연결 → 경험치·계급 그대로
- [ ] 앱 삭제 후 재설치 → Apple로 로그인하면 같은 계정
- [ ] 계정 삭제 후 같은 Apple 계정으로 다시 로그인하면 새 계정(약관 동의 필요)

## 4. 광고를 실제로 붙이기 (출시 직전)

1. https://admob.google.com 에서 앱 등록(iOS) → **앱 ID**와 **전면 광고 단위 ID** 발급
2. `ios/App/App/Info.plist`의 `GADApplicationIdentifier`를 실제 앱 ID로
3. `native.js`의 `AD.interstitial`을 실제 광고 단위 ID로, `testing: false`
4. `SKAdNetworkItems`: 구글이 안내하는 전체 목록으로 교체 (https://developers.google.com/admob/ios/3p-skadnetworks)
5. AdMob의 `app-ads.txt`: 개발자 웹사이트에 올려야 함 → 서버에 `/app-ads.txt` 추가 필요(그때 말하기)
6. 유럽(EEA)·영국에도 배포한다면 AdMob의 동의 메시지(UMP) 설정이 필요. 일본만이면 불필요

## 5. App Store Connect

1. 새 앱: 플랫폼 iOS, 이름 `三国ランダムディフェンス`, 기본 언어 일본어, 번들 ID, SKU `sangokurtd`
2. 스토어 문구·키워드·연령 등급·개인정보 라벨은 `STORE.md`에 초안
3. 개인정보처리방침 URL: `https://34-146-124-57.sslip.io/privacy?lang=ja`
4. 지원 URL: 지금은 같은 서버 주소 또는 메일. 정식 도메인을 사면 바꾸기
5. 심사용 데모 계정: 온라인 기능 확인용으로 아이디 하나 만들어 심사 메모에 적기
6. Xcode → Product → Archive → Distribute → App Store Connect → TestFlight로 먼저 확인

## 6. 출시 전에 정할 것 (사용자 결정)

- 앱 아이콘·스토어 스크린샷 그림
- 정식 도메인(지금 `sslip.io` 주소는 임시. 심사에서 문제되진 않지만 바꾸는 게 좋음)
- 판매 국가(일본만 / 전 세계), 가격(무료)
- 수익 모델의 나머지(작혼처럼 꾸미기 상품 등): 아직 미정이라 결제(IAP)는 넣지 않음
- 사업자 정보가 바뀌면 `legal/privacy.html`, `legal/terms.html`과 서버 재배포

## 7. 파일 구조

```
samguk-rtd.html   게임 화면(앱에서는 www/index.html이 됨)
*.js              게임 코드. native.js = 앱 전용(광고·ATT·가로 고정·바깥 링크)
gfx/ fonts/       그림·글꼴(앱에 포함, 인터넷 없이도 글꼴 표시)
legal/            약관·개인정보처리방침(서버에서 제공)
server/app.js     온라인 서버(계정·방·순위). 서버 VM에 배포됨
scripts/build-www.js  앱에 넣을 파일을 www/로 복사
capacitor.config.json 앱 설정
ios/              Xcode 프로젝트
```

서버 배포는 Mac에서도 `gcloud`(mikohatsu97 계정, 프로젝트 mikoserver-513016)로 할 수 있습니다.
