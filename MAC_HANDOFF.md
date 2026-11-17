# Mac에서 이어서 할 일 (iOS 출시)

Windows에서 할 수 있는 작업은 끝났습니다. Mac에서는 GitHub에서 받아 아래 순서대로 진행합니다.

```bash
git clone https://github.com/mikohatsu/samguk-rtd-mobile.git
```

이미 받아 두었다면 `git pull`. `node_modules/`와 `www/`는 Mac에서 다시 만듭니다.
게임 스튜디오 템플릿(`.claude/` 등)은 git에 없으므로 Mac에서 쓰려면 `~/.claude/ccgs/`를 옮긴 뒤 `bash ~/.claude/ccgs/install.sh`.

## 0. 지금 상태

| 항목 | 상태 |
|---|---|
| 게임 본체 (`samguk-rtd.html`, `*.js`, `gfx/`, `fonts/`) | 완료. 웹 브라우저에서 그대로 돌아감 |
| 4개 언어 (일·영·한·중) | 완료. 설정에서 바꿈, 첫 실행은 기기 언어 |
| 온라인 서버 | 가동 중: https://34-146-124-57.sslip.io (GCP mikoserver-513016, VM `rtd-online`, 도쿄) |
| 약관·개인정보처리방침 | https://34-146-124-57.sslip.io/terms , /privacy (`?lang=ja|en|ko|zh`) |
| Capacitor 8 iOS 프로젝트 (`ios/`) | 생성됨. Swift Package Manager 방식이라 CocoaPods 필요 없음 |
| Info.plist | 가로 전용, 상태 표시줄 숨김, 암호화 면제, AdMob **시험용** 앱 ID, ATT 문구, SKAdNetwork |
| entitlements (Sign in with Apple) | 완료(2026-11-17): `ios/App/App/App.entitlements`, 빌드 설정 `CODE_SIGN_ENTITLEMENTS`에 연결됨 |
| 앱 아이콘·시작 화면 | 완료(`scripts/build-icons.py` → `ios/App/App/Assets.xcassets`) |
| 채팅 | 로비 채널·방 채팅, 욕설 가림·광고 차단·도배 입막음, 줄마다 신고·차단. 계정 정지 기능은 아직 없음 |
| 원보(유료 재화) | 첫 출시는 광고만. 상점 원보 탭과 잔액은 `lobby.js`의 `GEMS_ON = false`로 숨김. 결제(IAP) 없음 |
| 언어별 ATT 문구·앱 이름 | `ios/App/App/{ja,en,ko,zh-Hans}.lproj/InfoPlist.strings`, 프로젝트에 등록 완료(2026-11-17, Localizations 4개 포함) |
| 개인정보 매니페스트 | `ios/App/App/PrivacyInfo.xcprivacy`, 타깃 Resources에 등록 완료(2026-11-17) |
| SKAdNetwork | 구글 권장 전체 50개로 교체 완료(2026-11-17, 2026-01-30판 목록) |
| 광고 | `native.js`: 앱에서는 AdMob 전면 광고를 **판이 끝나 로비로 돌아갈 때마다** 1번(판 도중에는 없음). 처음 2판은 없음, 앞 광고(보상형 포함) 뒤 5분 안에는 없음, 광고 제거 구매자는 없음(`src/ui/18-account.js` `adThen`). ATT는 첫 실행에 한 번 물음. 지금은 **구글 시험용 광고 ID** |

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

1. ~~`PrivacyInfo.xcprivacy`, `*.lproj` 4개를 타깃에 추가~~ → 프로젝트 파일에 이미 넣음(2026-11-17). Xcode 왼쪽 목록 `App` 아래에 `PrivacyInfo.xcprivacy`, `InfoPlist.strings`(4개 언어), `App.entitlements`가 보이는지만 확인
2. ~~Localizations 4개~~ → 이미 넣음. Project `App` → Info → Localizations에 Japanese·Korean·Chinese (Simplified)가 보이는지만 확인
3. Target `App` → Signing & Capabilities (**본인이 할 일**)
   - Team: 본인 개발자 계정
   - Bundle Identifier: `com.hongsungjae.sangokurtd` (바꾸려면 `capacitor.config.json`의 appId도 같이)
4. Target `App` → General
   - Display Name: 三国ランダムディフェンス
   - Deployment Target: iOS 15 이상
   - iPhone·iPad 둘 다, Requires Full Screen 체크(이미 Info.plist에 있음)
5. 앱 아이콘: `Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`(1024×1024)에 이미 들어 있음(`scripts/build-icons.py`가 만듦). Xcode에서 투명 없이 보이는지만 확인
6. 시작 화면: `Assets.xcassets/Splash.imageset`(2732×2732 3장)도 `scripts/build-icons.py`가 이미 만듦. 실기기에서 잘리지 않는지 확인. 배경색 `#1a120c`
7. ~~Sign in with Apple Capability~~ → `App.entitlements`로 이미 켜 둠. Team을 고르면 Signing & Capabilities에 **Sign in with Apple**이 보여야 한다. 서명 오류가 나면 Apple Developer 사이트의 App ID에서 Sign in with Apple을 켠다(3-1절 2번)

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
- [ ] 채팅: 욕설이 가려지는지, 광고·연락처가 막히는지, 연속으로 보내면 입막음되는지, 「通報」「ブロック」이 되는지, 차단한 사람 글이 안 보이고 설정에서 풀리는지
- [ ] 상점에 원보 탭이 없고, 로비 위에 원보 잔액이 안 보이는지(동전만)
- [ ] iPad(가로)에서 화면이 잘리지 않는지

## 3-1. 로그인(Apple·Google·게스트) 설정

게스트 로그인은 지금 바로 됩니다. Apple·Google은 아래를 해야 켜집니다(코드는 다 들어가 있음: `native.js`의 `signIn`, 서버 `/api/auth/apple`·`/api/auth/google`).

**Apple로 로그인**
1. ~~Xcode에서 Capability 추가~~ → `App.entitlements`로 완료(2026-11-17)
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
- [ ] 계정 삭제 뒤 iOS 설정 › Apple 계정 › "Apple로 로그인"에서 이 앱 연결이 사라지는지(토큰 철회가 서버에 들어간 뒤)

## 4. 광고를 실제로 붙이기 (출시 직전)

1. https://admob.google.com 에서 앱 등록(iOS) → **앱 ID**와 **전면 광고 단위 ID** 발급
2. `ios/App/App/Info.plist`의 `GADApplicationIdentifier`를 실제 앱 ID로
3. `native.js`의 `AD.interstitial`을 실제 광고 단위 ID로, `testing: false`
4. ~~`SKAdNetworkItems` 전체 목록으로 교체~~ → 완료(2026-11-17, 50개). 구글이 목록을 바꾸면 https://developers.google.com/admob/ios/3p-skadnetworks 와 다시 맞춘다
5. AdMob의 `app-ads.txt`: 개발자 웹사이트에 올려야 함 → 서버에 `/app-ads.txt` 추가 필요(그때 말하기)
6. 유럽(EEA)·영국에도 배포한다면 AdMob의 동의 메시지(UMP) 설정이 필요. 일본만이면 불필요

## 5. App Store Connect

1. 새 앱: 플랫폼 iOS, 이름 `三国ランダムディフェンス`, 기본 언어 일본어, 번들 ID, SKU `sangokurtd`
2. 스토어 문구·키워드·연령 등급·개인정보 라벨은 `STORE.md`에 초안
3. 개인정보처리방침 URL: `https://34-146-124-57.sslip.io/privacy?lang=ja`
4. 지원 URL: 지금은 같은 서버 주소 또는 메일. 정식 도메인을 사면 바꾸기
5. 심사 메모: 데모 계정 대신 "계정 창에서 「ゲストで開始」, 혼자서도 온라인 판 시작 가능"을 적는다. 채팅 위치(로비 아래 채팅 줄, 방 대기실)와 신고·차단 버튼 위치도 적는다(`STORE.md` 분류·연령 절)
6. Xcode → Product → Archive → Distribute → App Store Connect → TestFlight로 먼저 확인

## 6. 출시 전에 정할 것 (사용자 결정)

- 스토어 스크린샷(iPhone 6.9형 가로 2868×1320, iPad 13형 가로 2752×2064, 3~10장)
- 정식 도메인과 고정 IP(지금 `sslip.io` 주소는 임시 IP에 묶여 있어, 출시 뒤 VM IP가 바뀌면 앱이 서버에 못 붙는다. 최소한 고정 IP 예약은 출시 전에)
- 판매 국가(일본만 / 전 세계), 가격(무료)
- 수익 모델: 첫 출시는 광고만(결정됨). 원보 결제(IAP)는 다음 판에서 정함

## 8. 사용자 본인만 할 수 있는 일 (순서대로)

1. Apple Developer Program 가입(개인, 본인 인증). 스토어 판매자 이름은 본인 실명으로 나온다
2. Mac + Xcode 준비 → `npm install`, `npm run ios`
3. Xcode 한 번만(2절): Team·서명 고르기. (매니페스트·언어 파일·Localizations·Sign in with Apple은 2026-11-17에 프로젝트 파일에 넣어 둠 — 보이는지만 확인)
4. Apple Developer 사이트: App ID에 Sign in with Apple 켜기, **Sign in with Apple용 키(.p8)** 발급 → Key ID·Team ID와 함께 서버 담당에게 전달(계정 삭제 때 토큰 철회용)
5. AdMob: iOS 앱 등록, 앱 ID·전면 광고 단위 ID 발급, 광고 콘텐츠 등급, 결제·세금 정보 → ID를 팀에 전달(4절)
6. (Google 로그인을 켜기로 하면) Google Cloud 콘솔: OAuth 동의 화면, iOS·웹 클라이언트 ID 2개(3-1절)
7. 도메인 구매·DNS, GCP 고정 IP 예약(결제·계정은 본인, gcloud 명령은 승인하면 팀이 대신)
8. App Store Connect: 앱 만들기(번들 ID, SKU), 무료 앱 계약·세금·은행, 연령 등급 설문, 개인정보 라벨, 문구·스크린샷, 심사 메모, 제출(`STORE.md`)
9. 실기기 확인(3절·3-1절 전부: 채팅, 계정 삭제 뒤 재로그인, iPad 포함)
10. 스크린샷 촬영(위 6절 크기)
11. TestFlight로 먼저 설치해 확인한 뒤 제출
12. 신고 처리 운영: 누가 얼마나 자주 볼지 정하고 실제로 본다
13. 법률 확인 의뢰(약관·처리방침의 채팅 조항, 신고 기록 보관 기간, 외국 사업자 고지, 개인 주소 공개 여부), J-PlatPat 상표 조회(「三国志」 키워드 등)
14. Higgsfield 약관 원문 확인 또는 유료 요금제로 다시 생성(`CREDITS.md`의 확인 필요 항목)
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

## 9. 장수 해금 — 보상형 광고·인앱 결제 (2026-11-17 추가)

신화·불멸 전부가 잠겨 있고(신화는 쉬움 첫 클리어 뒤 상점 안내에서 2명 랜덤 해금, 서버 `/api/unlock/starter`), 동전·보상형 광고·인앱 결제(확정 구매만)로 연다. 목록·가격은 `theme-samguk.js`의 `unlock`.

### 보상형 광고
- 이미 설치된 `@capacitor-community/admob`(8.x)의 `prepareRewardVideoAd`/`showRewardVideoAd`를 쓴다(`native.js` `rewardAd`). 지금은 구글 시험용 보상형 ID.
- 출시 전: AdMob 콘솔에서 **보상형 광고 단위**를 만들고 `native.js`의 `AD.reward`를 실제 ID로, `AD.testing`을 false로.
- 서버는 시청을 검증하지 못한다(하루 5회 상한만 서버가 막음). 나중에 AdMob 서버 측 확인(SSV) 콜백을 붙이면 `/api/ad/reward` 대신 콜백에서 동전을 준다.

### 인앱 결제(아직 꺼져 있음 — 버튼이 숨겨져 있다)
1. 플러그인 설치(메인/사용자): StoreKit 2의 서명 거래(JWS, `jwsRepresentation`)를 돌려주는 Capacitor 플러그인. 후보 `@capgo/native-purchases`(Capacitor 8 지원 여부·반환 필드 [확인 필요]) 또는 `cordova-plugin-purchase`(v13). 설치 후 `npx cap sync ios`.
2. `native.js`의 `IAP.plugin`(플러그인 이름)과 `iapBuy`·`iapRestore` 안의 호출을 플러그인 API에 맞추고 `IAP.enabled = true`.
3. App Store Connect > 앱 > 인앱 구입: **비소모성(Non-Consumable)** 상품 등록. ID와 가격(엔):
   - `unlock_myth_<id>` (gwakga, join, sunuk, jangbi, joun, macho, sonchaek, yukson, dongtak, choseon — 신화 10명 모두. 신화는 처음엔 전부 잠기고 쉬움을 처음 깨면 상점이 열리며 2명을 랜덤으로 연다) — ¥160
   - `unlock_imm_<id>` (jojo, samaui, yubi, gwanu, jegal, songwon, juyu, taesaja, janggak, yeopo) — ¥320
   - `unlock_imm_all` — ¥1,200
   - `remove_ads` — ¥480 (광고 제거: 판 끝 전면 광고를 없애고, 동전 광고는 보지 않고 바로 받는다(하루 5회 같음). 계정에 'noads'로 저장, 복원 버튼으로 되살아남)
   - 상품 설명에 「プレイでも全員解放できます」(플레이로도 모두 열 수 있음)를 적는다. 심사용 스크린샷 필요.
4. 계약·세금·은행(유료 앱 계약)이 활성이어야 결제가 된다.
5. 서버 설정(VM `/opt/rtd-online`, systemd 환경 변수):
   - `APPLE_IAP_ROOT_CA` = 애플 루트 인증서 **Apple Root CA - G3** 파일 경로(https://www.apple.com/certificateauthority/ 에서 받은 `AppleRootCA-G3.cer`). 이 값이 없으면 `/api/iap/verify`가 503(꺼짐).
   - `APPLE_BUNDLE` = 번들 ID(기본 `com.hongsungjae.sangokurtd`).
   - 환불 반영·구독은 아직 없다. 환불을 반영하려면 App Store Server Notifications V2 주소와 App Store Server API 키(In-App Purchase 키, .p8 + Key ID + Issuer ID)가 필요하다(다음 단계).
6. 구매 복원 버튼(결제 복원)은 결제가 켜지면 해금 탭에 같이 보인다(심사 필수).
7. 연령 등급 설문의 "인앱 구입" 항목을 다시 답한다.
