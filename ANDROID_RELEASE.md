# 안드로이드 출시 안내 (구글 플레이)

마지막 정리: 2026-11-18. iOS는 `MAC_HANDOFF.md`, 안드로이드는 이 문서 하나만 보면 됩니다.

- **1장** 지금 어디까지 됐나
- **2장** 내가 할 일 (순서대로) ← 여기만 따라가면 됩니다
- **3장** 받은 값을 넣는 곳 (Claude에게 알려 주면 넣어 줌)
- **4장** 참고

---

## 1. 지금 어디까지 됐나

| 항목 | 상태 |
|---|---|
| 앱 | 패키지 `com.hongsungjae.sangokurtd`, 대상 API 36, 가로 고정. 시험용 APK는 main에 올릴 때마다 자동 빌드(`android-latest`) |
| 출시 빌드(AAB) | **준비됨.** 업로드 키만 있으면 GitHub Actions의 "Android Release (AAB)"가 서명된 AAB를 만든다 |
| 구글 로그인 | **코드 완성.** 구글 클라우드에서 ID를 받아 넣으면 켜진다. 안드로이드에는 Apple 로그인 버튼이 없다 |
| 광고 | **코드 완성.** 지금은 구글 시험용 ID. 실제 ID를 넣으면 시험 모드가 저절로 꺼진다. 안드로이드는 추적 허용 창이 없다(iOS 전용) |
| 결제(장수 해금·광고 제거) | **코드 완성**(앱: `@capgo/native-purchases`, 서버: 구글 플레이 영수증 검증). 서버에 서비스 계정 키를 넣기 전에는 결제 버튼이 숨는다(돈만 나가고 못 받는 일 방지) |
| 계정 삭제 | 앱 안(로비 › 프로필 › 계정 삭제)과 웹 안내 페이지 https://34-146-124-57.sslip.io/delete-account (4개 언어) |
| 개인정보 처리방침 | https://34-146-124-57.sslip.io/privacy — 안드로이드 광고 ID·구글 플레이 결제 내용 넣음(2026-11-18) |

---

## 2. 내가 할 일 (순서대로)

### 1) 구글 플레이 개발자 계정 (가장 먼저)
- https://play.google.com/console 에서 가입. 등록비 US$25, 본인 인증(신분증), 개인 계정.
- **새 개인 계정은 정식 출시 전에 비공개 테스트를 해야 합니다**(2025년 기준: 12명 이상이 14일 연속 참여). 가장 오래 걸리니 계정이 나오면 바로 시작하세요. 지금 기준은 콘솔에서 확인.

### 2) 업로드 키 만들기 (이 PC에서 한 번)
PowerShell에서(경로는 원하는 곳, **저장소 폴더 밖**):
```
keytool -genkeypair -v -keystore C:\Users\A\keys\sangokurtd-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```
- 비밀번호 두 개(저장소·키)를 정하고, 이름 등은 아무거나(영문).
- **이 파일과 비밀번호를 잃어버리면 업데이트를 못 올립니다**(구글에 재설정 요청은 가능하지만 며칠 걸림). USB·클라우드 등 두 곳에 백업.
- `keytool`이 없으면 Android Studio의 `jbr\bin\keytool.exe`를 쓰거나 Claude에게 위치를 물어보세요.

### 3) GitHub에 키 등록
GitHub 저장소 › Settings › Secrets and variables › Actions › New repository secret 으로 네 개:

| 이름 | 값 |
|---|---|
| `RTD_UPLOAD_KEYSTORE_B64` | 키 파일을 base64로 바꾼 글자. PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\A\keys\sangokurtd-upload.jks")) \| Set-Clipboard` 후 붙여넣기 |
| `RTD_UPLOAD_STORE_PASSWORD` | 저장소 비밀번호 |
| `RTD_UPLOAD_KEY_ALIAS` | `upload` |
| `RTD_UPLOAD_KEY_PASSWORD` | 키 비밀번호 |

그 뒤 GitHub › Actions › **Android Release (AAB)** › Run workflow → 끝나면 그 실행 화면 아래 Artifacts에서 `sangokurtd-aab` 받기.

### 4) 플레이 콘솔에서 앱 만들기
- 앱 만들기: 기본 언어 일본어, 게임, 무료.
- **Play 앱 서명**: 기본값(구글이 관리) 그대로. 위 키는 "업로드 키"가 된다.
- 비공개 테스트 트랙에 AAB 올리기 → 테스터 이메일 목록 추가.
- **앱 서명 키의 SHA-1** 두 개를 메모: 콘솔 › 테스트 및 출시 › 설정 › 앱 서명 (앱 서명 키 + 업로드 키). 5)에서 쓴다.

### 5) 구글 로그인 ID (Google Cloud 콘솔, 프로젝트 mikoserver-513016 권장)
- API 및 서비스 › OAuth 동의 화면: 외부, 앱 이름, 지원 이메일, 개인정보 처리방침 주소.
- 사용자 인증 정보 › OAuth 클라이언트 ID 만들기:
  1. **웹 애플리케이션** 1개 → 클라이언트 ID를 Claude에게 전달(앱·서버에 넣음)
  2. **Android** 2개: 패키지 `com.hongsungjae.sangokurtd`, SHA-1은 4)의 앱 서명 키 것 1개, 업로드 키 것 1개(시험할 때 쓰는 디버그 키 SHA-1도 하나 더 만들면 시험판에서도 로그인됨 — Claude가 알려 줌)
  3. (iOS도 켤 거면) **iOS** 1개: 번들 ID `com.hongsungjae.sangokurtd`

### 6) AdMob
- https://admob.google.com › 앱 추가 › Android › (스토어 등록 전이면 "아직 등록 안 됨"으로) → **앱 ID**(`ca-app-pub-…~…`)
- 광고 단위 2개: **전면**, **보상형** → 각각 ID(`ca-app-pub-…/…`)
- 결제·세금 정보 입력, `app-ads.txt`는 스토어 등록 뒤 안내대로(필요하면 Claude가 서버에 올림).
- 세 ID를 Claude에게 전달.

### 7) 결제 상품 (플레이 콘솔 › 수익 창출 › 인앱 상품)
상품 ID는 iOS와 같게, **일회성(소비하지 않는) 상품**으로:

| 상품 ID | 가격(엔) |
|---|---|
| `remove_ads` | 480 |
| `unlock_imm_all` | 1200 |
| `unlock_myth_<장수id>` (신화 10명) | 160 |
| `unlock_imm_<장수id>` (불멸) | 320 |

장수 id 목록은 Claude에게 "상품 목록 뽑아줘"라고 하면 표로 드립니다. 판매자 계정(결제 프로필) 설정이 먼저 필요합니다.

### 8) 서버가 결제를 확인할 수 있게 (서비스 계정)
- Google Cloud 콘솔 › IAM › 서비스 계정 만들기(이름 예: `play-verify`) › 키 › JSON 키 만들기 → 파일 받기
- 플레이 콘솔 › 사용자 및 권한 › 새 사용자 초대 › 그 서비스 계정 이메일 › 앱 권한: **재무 데이터 보기**(+ 주문 관리)
- JSON 파일은 **채팅에 붙이지 말고** 이 PC의 정해진 곳(예: `C:\Users\A\keys\play-verify.json`)에 두고 위치만 알려 주세요. Claude가 서버 `/etc/rtd-online/`에 올리고 설정합니다.
- 결제 확인이 켜지면 앱에 결제 버튼이 나타납니다.

### 9) 스토어 등록 정보·정책 양식 (플레이 콘솔)
- 스토어 등록정보: 앱 이름, 짧은·긴 설명(일본어), 아이콘 512, 그래픽 이미지 1024×500, 스크린샷(가로) — Claude가 문구·그림을 준비할 수 있음
- 앱 콘텐츠: 개인정보 처리방침 `https://34-146-124-57.sslip.io/privacy?lang=ja`, 광고 포함 **예**, 앱 액세스(로그인 없이 게스트로 전부 가능), 콘텐츠 등급 설문(IARC, 전투 묘사 있음·도박 없음·채팅 있음), 타깃 연령(13세 이상 권장 — 아동 대상으로 하면 광고 규칙이 엄격해짐), 데이터 보안(아래 4장 표), 계정 삭제 URL `https://34-146-124-57.sslip.io/delete-account`
- 배포 국가: **일본(+ 원하면 한국 등)만** 권장. 유럽(EEA·영국)을 넣으면 광고 동의 창(UMP)을 따로 넣어야 합니다.

### 10) 비공개 테스트 → 정식 출시 신청
테스트 조건을 채우면 콘솔에서 "프로덕션 액세스 신청" → 심사.

---

## 3. 받은 값을 넣는 곳 (Claude가 함)

| 값 | 넣는 곳 |
|---|---|
| 구글 웹 클라이언트 ID | `native.js` `SSO.googleWeb`, 서버 `/etc/rtd-online.env` `GOOGLE_AUDS` |
| 구글 iOS 클라이언트 ID | `native.js` `SSO.googleIOS`, `GOOGLE_AUDS`, iOS Info.plist URL 스킴 |
| AdMob 안드로이드 앱 ID | `android/app/src/main/AndroidManifest.xml` `com.google.android.gms.ads.APPLICATION_ID` |
| AdMob 광고 단위 ID 2개 | `native.js` `REAL.android` |
| 서비스 계정 JSON | 서버 파일 + `/etc/rtd-online.env` `GOOGLE_PLAY_SA=<경로>` → `sudo systemctl restart rtd-online` |

---

## 4. 참고

### 데이터 보안 양식에 적을 내용
| 데이터 | 수집 | 공유 | 목적 | 비고 |
|---|---|---|---|---|
| 사용자 ID(구글 계정 식별자·게스트 ID) | 예 | 아니요 | 계정 관리 | 이메일·이름은 저장 안 함 |
| 앱 활동(전적·경험치·채팅 신고) | 예 | 아니요 | 앱 기능, 부정 방지 | 채팅 본문은 신고된 것만 |
| 구매 기록 | 예 | 아니요 | 앱 기능(구매 확인) | 카드 정보는 구글이 처리 |
| 기기 ID(광고 ID)·대략적 위치·진단 | 예(AdMob SDK) | 예(구글) | 광고 | AdMob 데이터 공개 문서 참고 |
- 전송 중 암호화: 예(HTTPS). 삭제 요청: 예(앱·웹).

### 명령
```
# 시험용 APK 받기
gh release download android-latest -R mikohatsu/samguk-rtd-mobile -D dist --clobber
# 이 PC에서 직접 AAB를 만들 때(안드로이드 SDK 필요): android/keystore.properties 에 storeFile·storePassword·keyAlias·keyPassword 를 적고
cd android && gradlew bundleRelease
```
- `android/keystore.properties`, `*.jks`는 `.gitignore`에 있어 올라가지 않는다.
- 결제 검증 시험: `node tests/server-gplay.js` (가짜 구글 서버로 확인).

### 알려진 한계
- 계정을 지운 뒤 같은 구글 계정 결제를 새 계정에서 "복원"하면 서버가 다른 계정 것으로 보고 거절한다(구매 기록은 남고 계정 연결만 끊기므로). 필요하면 운영자가 수동 처리.
- 환불되면 구글이 알려 주는 기능(RTDN)은 아직 없다. 환불된 구매의 혜택은 그대로 남는다(소액이라 첫 출시에서는 보류).
