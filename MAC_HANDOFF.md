# iOS 출시 안내 (Mac)

마지막 정리: 2026-11-18. 이 문서 하나만 보면 됩니다.

- **1장** 지금 어디까지 됐나
- **2장** 내가 할 일 (순서대로) ← 여기만 따라가면 됩니다
- **3장** 각 단계 자세한 방법
- **4장** 참고 (명령, 파일 구조)

---

## 1. 지금 어디까지 됐나

### 끝난 것

| 항목 | 내용 |
|---|---|
| 게임 본체 | 완성. 4개 언어(일·영·한·중), 웹 브라우저에서도 그대로 돌아감 |
| 온라인 서버 | 가동 중: https://34-146-124-57.sslip.io (GCP mikoserver-513016, VM `rtd-online`, 도쿄) |
| 약관·개인정보처리방침 | 같은 서버의 `/terms`, `/privacy` (`?lang=ja|en|ko|zh`) |
| Mac 준비 | macOS 27.2.1, Xcode 27.2, Node 22, iOS 27.2 시뮬레이터 설치됨. 저장소 위치 `/Users/miko/HSJ/samguk-rtd-mobile` |
| iOS 프로젝트 설정 | 가로 전용, 아이콘·시작 화면, 개인정보 매니페스트, 4개 언어 앱 이름·추적 허용 문구, Sign in with Apple 권한 파일, SKAdNetwork 50개. 모두 프로젝트에 들어가 있음 |
| iOS 빌드 | 시뮬레이터용(서명 없이) 빌드 **성공**. 만들어진 앱 안에 위 설정 파일이 다 들어간 것 확인 |
| 게임 스튜디오 템플릿 | 이 Mac에 설치됨(v1.3.0). git에는 없음 |

### 아직 안 된 것

| 항목 | 상태 |
|---|---|
| 시뮬레이터에서 화면 확인 | 앱은 실행되지만 **화면이 검게 나옴. 원인 미확인**(Mac이 느려서인지 실제 문제인지 확인 중) |
| 서명 빌드·실기기 설치 | 개발자 계정(Team)이 있어야 함 → 2장 1~2번 |
| 광고 | 지금은 구글 **시험용** ID. 실제 ID로 바꿔야 함 → 2장 4번 |
| Apple 로그인 | 코드는 완성. Apple 쪽 설정이 남음 → 2장 3번 |
| Google 로그인 | 코드는 완성. 켤지 말지 결정 필요. 설정 전에는 "준비 중"으로 막혀 있음 |
| 인앱 결제·원보 | 첫 출시에는 없음(광고만). 버튼이 숨겨져 있음 |
| 채팅 계정 정지 기능 | 없음(신고·차단·욕설 가림은 있음) |

---

## 2. 내가 할 일 (순서대로)

계정·결제·본인 인증이 필요해서 Claude가 대신 못 하는 일만 모았습니다. 끝낸 줄은 `[x]`로 바꿉니다.

### 먼저 (빌드를 기기에 올리기까지)

- [ ] **1. Apple Developer Program 가입** — 개인, 연 12,800엔, 본인 인증. 스토어 판매자 이름은 실명(HONGSUNGJAE)으로 나옴
- [ ] **2. Xcode에서 Team 고르기** — 한 번만 하면 됨 → [3-A](#3-a-xcode에서-team-고르기)
- [ ] **3. Apple 로그인 켜기** — Apple Developer 사이트에서 App ID 설정 + 키(.p8) 발급 → [3-B](#3-b-apple-로그인)

### 출시 준비

- [ ] **4. AdMob 가입·앱 등록** — 앱 ID, 전면 광고 ID, 보상형 광고 ID를 발급받아 Claude에게 전달 → [3-C](#3-c-광고-admob)
- [ ] **5. 고정 IP 예약, (가능하면) 도메인 구매** — 지금 서버 주소는 임시 IP라 바뀌면 앱이 서버에 못 붙음. 결제는 본인, gcloud 명령은 승인하면 Claude가 대신
- [ ] **6. 정할 것 4가지** → [3-G](#3-g-정할-것)
- [ ] **7. 실기기 확인** — 아이폰·아이패드에 설치해 목록대로 확인 → [3-E](#3-e-실기기-확인-목록)
- [ ] **8. 스크린샷 촬영** — iPhone 6.9형 가로 2868×1320, iPad 13형 가로 2752×2064, 각 3~10장
- [ ] **9. App Store Connect에 앱 만들기·정보 입력** → [3-D](#3-d-app-store-connect)
- [ ] **10. TestFlight로 먼저 설치해 확인한 뒤 심사 제출**

### 출시와 별개로 챙길 것

- [ ] **11. 법률 확인 의뢰** — 약관·처리방침의 채팅 조항, 신고 기록 보관 기간, 외국 사업자 고지, 개인 주소 공개 여부
- [ ] **12. 상표 조회** — J-PlatPat에서 「三国志」 등 키워드
- [ ] **13. Higgsfield 약관 확인** — 원문을 확인하거나 유료 요금제로 다시 생성(`CREDITS.md`의 확인 필요 항목)
- [ ] **14. 신고 처리 운영 정하기** — 누가 얼마나 자주 볼지 정하고 실제로 보기

### 선택

- [ ] **Google 로그인을 켤 경우** → [3-F](#3-f-google-로그인-선택)

사업자 정보가 바뀌면 `legal/privacy.html`, `legal/terms.html`을 고치고 서버에 다시 배포해야 합니다(Claude에게 말하기).

---

## 3. 각 단계 자세한 방법

### 3-A. Xcode에서 Team 고르기

1. 터미널에서 저장소 폴더로 가서 `npx cap open ios` → Xcode가 열림
2. 왼쪽 맨 위 `App` 클릭 → 가운데 TARGETS의 `App` → **Signing & Capabilities** 탭
3. **Team**에서 본인 개발자 계정 선택
4. 같은 화면에 **Sign in with Apple**이 보이면 정상

확인만 하면 되는 것(이미 들어가 있음):

- Bundle Identifier: `com.hongsungjae.sangokurtd`
- General 탭: Display Name `三国ランダムディフェンス`, 최소 iOS 15, iPhone·iPad
- 왼쪽 파일 목록에 `PrivacyInfo.xcprivacy`, `InfoPlist.strings`, `App.entitlements`

서명 오류가 나면 오류 문구를 Claude에게 그대로 알려 주세요.

### 3-B. Apple 로그인

1. https://developer.apple.com → Certificates, IDs & Profiles → Identifiers → `com.hongsungjae.sangokurtd` → **Sign in with Apple** 체크
2. Keys → 새 키 만들기 → Sign in with Apple 체크 → **.p8 파일** 내려받기(한 번만 받을 수 있음)
3. .p8 파일, **Key ID**, **Team ID**를 Claude에게 전달 → 서버에 "계정 삭제 시 Apple 연결 끊기"를 넣음(Apple 심사 요구 사항)

번들 ID를 바꾸면 서버 환경 변수 `APPLE_AUDS`도 같이 바꿔야 합니다.

### 3-C. 광고 (AdMob)

1. https://admob.google.com 가입 → 결제·세금 정보 입력
2. 앱 추가(iOS) → **앱 ID** 발급
3. 광고 단위 2개 만들기: **전면 광고**, **보상형 광고** → 각각 ID 발급
4. 광고 콘텐츠 등급 설정
5. ID 3개를 Claude에게 전달

Claude가 할 일(ID를 받은 뒤): `Info.plist`의 앱 ID 교체, `native.js`의 광고 ID 교체와 시험 모드 끄기, 서버에 `app-ads.txt` 추가.

참고:

- 광고가 뜨는 때: 판이 끝나 로비로 돌아갈 때 1번. 처음 2판과 앞 광고 뒤 5분 안에는 없음. 광고 제거 구매자는 없음
- 유럽(EEA)·영국에도 배포하면 AdMob의 동의 메시지 설정이 추가로 필요. 일본만이면 불필요
- 보상형 광고는 하루 5회 상한만 서버가 막음(시청 자체는 검증하지 않음)

### 3-D. App Store Connect

1. 새 앱: 플랫폼 iOS, 이름 `三国ランダムディフェンス`, 기본 언어 일본어, 번들 ID `com.hongsungjae.sangokurtd`, SKU `sangokurtd`
2. 무료 앱 계약, 세금, 은행 정보
3. 스토어 문구·키워드·연령 등급·개인정보 라벨 → 초안이 `STORE.md`에 있음
4. 개인정보처리방침 URL: `https://34-146-124-57.sslip.io/privacy?lang=ja` (도메인을 사면 바꾸기)
5. 지원 URL: 같은 서버 주소 또는 메일
6. 심사 메모(데모 계정 대신 적을 내용): 계정 창에서 「ゲストで開始」로 시작, 혼자서도 온라인 판 시작 가능, 채팅 위치(로비 아래 채팅 줄, 방 대기실), 신고·차단 버튼 위치
7. 올리기: Xcode → Product → Archive → Distribute App → App Store Connect

### 3-E. 실기기 확인 목록

화면·조작

- [ ] 가로로만 돌아가고, 노치·홈 바에 버튼이 가리지 않음
- [ ] iPad(가로)에서 화면이 잘리지 않음
- [ ] 시작 화면이 잘리지 않음, 앱 아이콘이 정상
- [ ] 화질 설정(높음/보통/낮음, 30fps)이 오래된 기기에서 버벅이지 않음
- [ ] 소리: 무음 스위치, 다른 앱 음악과 겹칠 때

이어하기

- [ ] 혼자 하기 중 앱을 내렸다 돌아오면 일시정지 → 계속
- [ ] 앱을 완전히 껐다 켜면 시작 화면에 "이어하기"

온라인

- [ ] 회원가입·로그인, 방 만들기·참가, 휴대폰 2대 이상 협동
- [ ] 온라인 중 앱을 1분 넘게 내리면 방에서 빠지고 남은 사람은 계속

광고·링크

- [ ] 처음 실행에 추적 허용 창(일본어 문구)
- [ ] 2판째가 끝나면 시험 광고가 뜨고, 닫으면 다음 판
- [ ] 약관 링크가 앱 안 브라우저로 열림
- [ ] 상점에 원보 탭이 없고, 로비 위에 원보 잔액이 안 보임(동전만)

채팅

- [ ] 욕설이 가려짐, 광고·연락처가 막힘, 연속으로 보내면 입막음
- [ ] 「通報」「ブロック」이 됨, 차단한 사람 글이 안 보이고 설정에서 풀림

로그인(3-B를 마친 뒤)

- [ ] 게스트로 시작 → 몇 판 → Apple 연결 → 경험치·계급 그대로
- [ ] 앱 삭제 후 재설치 → Apple로 로그인하면 같은 계정
- [ ] 계정 삭제 후 같은 Apple 계정으로 로그인하면 새 계정(약관 동의 필요)
- [ ] 계정 삭제 뒤 iOS 설정 › Apple 계정 › "Apple로 로그인"에서 이 앱 연결이 사라짐

### 3-F. Google 로그인 (선택)

본인이 할 일:

1. Google Cloud 콘솔(mikoserver-513016) → API 및 서비스 → OAuth 동의 화면 설정
2. 사용자 인증 정보 → OAuth 클라이언트 ID 2개 만들기: **iOS**(번들 ID 입력), **웹 애플리케이션**
3. 클라이언트 ID 2개를 Claude에게 전달

Claude가 할 일: `native.js`의 `SSO`에 ID 넣기, `Info.plist`에 URL 스킴 추가, 서버 환경 변수 `GOOGLE_AUDS` 설정 후 재시작.

### 3-G. 정할 것

| 정할 것 | 메모 |
|---|---|
| 판매 국가 | 일본만 / 전 세계. 유럽 포함이면 광고 동의 설정이 추가됨 |
| 정식 도메인 | 안 사면 최소한 고정 IP 예약은 출시 전에 |
| Google 로그인 | 켤지 말지 |
| 인앱 결제 시기 | 첫 출시는 광고만(결정됨). 결제는 다음 판에서 |

### 3-H. 인앱 결제 (다음 판, 지금은 안 함)

지금은 꺼져 있고 버튼이 숨겨져 있습니다. 켜기로 하면 Claude에게 말하면 됩니다. 그때 본인이 할 일:

1. App Store Connect → 유료 앱 계약·세금·은행 활성화
2. 인앱 구입에 **비소모성** 상품 등록:

| 상품 ID | 가격 | 내용 |
|---|---|---|
| `unlock_myth_<id>` × 10 | ¥160 | 신화 장수 1명 (gwakga, join, sunuk, jangbi, joun, macho, sonchaek, yukson, dongtak, choseon) |
| `unlock_imm_<id>` × 10 | ¥320 | 불멸 장수 1명 (jojo, samaui, yubi, gwanu, jegal, songwon, juyu, taesaja, janggak, yeopo) |
| `unlock_imm_all` | ¥1,200 | 불멸 전부 |
| `remove_ads` | ¥480 | 광고 제거 |

3. 상품 설명에 「プレイでも全員解放できます」 적기, 심사용 스크린샷 올리기
4. 연령 등급 설문의 "인앱 구입" 항목 다시 답하기

Claude가 할 일: 결제 플러그인 설치(후보 `@capgo/native-purchases` 또는 `cordova-plugin-purchase`, Capacitor 8 지원 여부는 확인 필요), `native.js`의 `IAP` 연결, 서버에 Apple 루트 인증서(`APPLE_IAP_ROOT_CA`)와 `APPLE_BUNDLE` 설정, 구매 복원 버튼 켜기. 환불 반영은 그다음 단계(App Store Server Notifications V2와 서버 API 키 필요).

---

## 4. 참고

### 자주 쓰는 명령 (저장소 폴더에서)

| 명령 | 하는 일 |
|---|---|
| `git pull` | 최신 코드 받기 |
| `npm install` | 의존성 설치(처음 한 번, 또는 `package.json`이 바뀌었을 때) |
| `npm run sync` | 게임 파일을 앱에 다시 넣기(코드를 고칠 때마다) |
| `npm run ios` | 위 작업 + Xcode 열기 |
| `npx cap open ios` | Xcode만 열기 |

### 파일 구조

```
samguk-rtd.html   게임 화면(앱에서는 www/index.html이 됨)
*.js              게임 코드. native.js = 앱 전용(광고·추적 허용·로그인)
gfx/ fonts/       그림·글꼴(앱에 포함)
legal/            약관·개인정보처리방침(서버에서 제공)
server/app.js     온라인 서버(계정·방·순위)
ios/              Xcode 프로젝트
STORE.md          스토어 문구 초안
CREDITS.md        에셋 출처
```

### iOS 프로젝트에 들어가 있는 설정

| 파일 | 내용 |
|---|---|
| `ios/App/App/Info.plist` | 가로 전용, 상태 표시줄 숨김, 암호화 면제, AdMob 시험용 앱 ID, 추적 허용 문구, SKAdNetwork 50개(구글 2026-01-30판. 목록이 바뀌면 https://developers.google.com/admob/ios/3p-skadnetworks 와 다시 맞춤) |
| `ios/App/App/{ja,en,ko,zh-Hans}.lproj/InfoPlist.strings` | 언어별 앱 이름·추적 허용 문구 |
| `ios/App/App/PrivacyInfo.xcprivacy` | 개인정보 매니페스트 |
| `ios/App/App/App.entitlements` | Sign in with Apple |
| `ios/App/App/Assets.xcassets` | 아이콘·시작 화면(`scripts/build-icons.py`가 만듦, 배경색 `#1a120c`) |
| `Package.resolved` | 외부 패키지 버전 고정 |

외부 패키지는 Swift Package Manager로 받습니다(CocoaPods 불필요). 첫 빌드는 내려받기 때문에 오래 걸리고, 시간 초과로 실패하면 다시 돌리면 됩니다.

### 서버

Mac에서도 `gcloud`(mikohatsu97 계정, 프로젝트 mikoserver-513016)로 배포할 수 있습니다. 방법은 `CLAUDE.md`의 "배포(서버)".

### 게임 스튜디오 템플릿

git에 없어서 컴퓨터마다 따로 깝니다. 이 Mac에는 설치돼 있습니다. 원본은 `~/.claude/ccgs/template`, 다시 깔 때는 저장소 맨 위에서 `bash ~/.claude/ccgs/install.sh`. Windows 쪽 `project.yaml`과 `production/` 내용은 넘어오지 않았습니다.
