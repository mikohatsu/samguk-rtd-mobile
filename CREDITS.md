# 외부 에셋 출처

게임 안 표기: 설정 > 크레딧 · 라이선스 (`credits.js`). **에셋을 더하거나 빼면 이 파일과 credits.js를 같이 고친다.**
출처 표기가 의무인 것 = 배경음(CC BY 4.0), 스킬 아이콘(CC BY 3.0), 글꼴(OFL 1.1), 앱 라이브러리(MIT·MPL). 나머지는 CC0 또는 직접 만든 것.
라이선스는 2026-11-10에 원본 페이지에서 다시 확인했다.

## 스킬 버튼 아이콘 — CC BY 3.0 (출처 표기 필요)
- game-icons.net — 작가 Lorc, Delapouite (https://game-icons.net, https://creativecommons.org/licenses/by/3.0/)
- 파일: skillicons.js (SVG 경로 데이터)

## 배경음 — CC BY 4.0 (출처 표기 필요)
- Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/
  - 라인: "Shenyang", "Eastminster", "Tea Roots", "Opium", "Dragon and Toast"
  - 보스전: "Lord of the Land", "Asian Drums"
- 파일: bgm/*.mp3 (scripts/build-bgm.py로 4분 이내로 자르고 음량을 맞춰 다시 인코딩함 — 원곡을 고쳤다는 표시)
- 게임 안 크레딧 화면에 곡명·작곡가·라이선스·고친 사실을 표기했다.

## 효과음 — CC0 (표기 의무 없음, 감사 표시)
- OpenGameArt.org → sfxdata.js (scripts/build-sfx.py로 가공)
  - artisticdude — "Swishes Sound Pack", "RPG Sound Pack" → 검·창·극·단검의 바람 가르는 소리, 활, 주문, 스킬, 방패
  - remaxim — "3 Melee sounds" → 도끼·철퇴 타격, 강타가 꽂히는 소리
  - Kenney — "50 RPG sound effects" → 도끼, 방패
  - (쇳소리는 쓰지 않는다)

## 이펙트 애니메이션 — CC0 (표기 의무 없음, 감사 표시)
- OpenGameArt.org
  - Sinestesia — "Hit Animation | Frame by frame", "Hit Animation 2", "2D Explosion Animations", "2D Explosion Animations #2" → gfx/fxa_hit, fxa_hit2, fxa_boom, fxa_boom2
  - wreaderror — "lightning" → gfx/fxa_bolt
  - Grahhhhh — "Animated Blue Ring Explosion" → gfx/fxa_ring

## 이펙트 입자 그림 — CC0 (표기 의무 없음, 감사 표시)
- Kenney (kenney.nl) — "Particle Pack" → gfx/kn_*.png (skillfx.js, 신화·불멸 등장 연출)

## 글꼴 — SIL Open Font License 1.1 (저작권 문구와 라이선스를 함께 배포해야 함)
- Google Fonts에서 받은 부분 파일(fonts/*.woff2). 저작권 문구와 라이선스 전문은 fonts/OFL.txt와 게임 안 크레딧 화면에 있다.
  - Black Han Sans, East Sea Dokdo, Gowun Batang, IBM Plex Sans KR, Noto Serif KR, Yuji Boku
  - 일본어용(fonts/ja-display.woff2, ja-serif.woff2): Dela Gothic One, Zen Antique — 게임에 쓰는 글자만 남긴 부분 파일(scripts/build-jafont.py)
- 일본어 붓글씨(fonts/ja-brush.woff2): **衡山毛筆フォント**(青柳衡山 作) — OFL 아님. 배포처 안내: 무료, 상업 이용 가능·제한 없음(https://opentype.jp/kouzanmouhitufont.htm, 2026-11-11 확인). 크레딧 화면에 감사 표시.
- 글꼴 파일만 따로 팔 수 없다(게임에 넣어 배포·판매하는 것은 허용).

## 앱 라이브러리 (앱에 들어가 배포됨)
- Capacitor(@capacitor/*) — MIT, Copyright (c) 2017-present Drifty Co. / Ionic
- @capacitor-community/admob — MIT, Copyright (c) 2021 Capacitor Community
- @capgo/capacitor-social-login — MPL-2.0 (고치지 않고 그대로 씀. 소스: https://github.com/Cap-go/capacitor-social-login)
- Google Mobile Ads SDK, Google/Apple 로그인 SDK — 각 회사의 이용 약관(오픈소스 아님, 표기 의무 없음)
- 서버 쪽 라이브러리(server/node_modules)는 배포물에 들어가지 않으므로 표기 대상이 아니다.

## 그림 (장수·보스·일러스트·배경·UI)
- gfx/의 장수·보스 SD 그림, il_*, tex_*, ui_*, prop_*, rank_*, fx_*, vx_*, 로비 배경은 이미지 생성 도구로 만든 것(웹판 세션에서 제작). gfx/rig_*는 그 그림을 잘라 만든 것.
- 도구: **Canva AI**(Canva 커넥터의 그림 생성, 배경 제거도 Canva). 웹판 세션 기록 기준 약 268회 생성, 작업 ID는 웹판 gfx/media.json·map.txt에 있다. ui_*, rank_*, 로비 배경은 모바일 세션에서 같은 방식으로 만들었다.
- 요금제: Canva Pro(유료, 사용자 확인 2026-11-11).
- 상업 이용: 가능. Canva AI Product Terms(https://www.canva.com/policies/ai-product-terms/)에 따르면 생성물은 사용자 소유이고 판매를 포함한 상업적 이용이 허용된다. 표기 의무 없음.
- 한계: AI 생성물은 나라에 따라 저작권 보호를 못 받을 수 있고(남이 베껴도 막기 어려움), 독점권도 보장되지 않는다. 알아볼 수 있는 실존 인물·타사 캐릭터·상표가 들어가면 Canva가 권리를 보장해 주지 않는다.

## 로비 그림 (2026-11-11, v0.2.4)
- gfx/lobby_bg.jpg(로비 배경), gfx/ui_paper.jpg(한지 질감), gfx/ui_ink.png(먹 붓자국): **Higgsfield**의 Z Image 모델로 생성(무료 요금제, 글만으로 생성). 원본 배경은 art_src/lobby_bg_v3.png.
- (v0.2.6) gfx/ic_shop.png·ic_rank.png·ic_hist.png(메뉴 아이콘: 돈주머니·투구·죽간), gfx/ui_silk.jpg(구름무늬 비단): Higgsfield Z Image로 생성, 아이콘의 흰 배경은 Canva로 제거.
- gfx/lobby_char.png: 기존 초선 일러스트(Canva AI 생성)의 배경을 Canva로 지운 것.
- 워터마크: 원본 3장의 네 모서리와 전체를 확인했고 보이는 워터마크는 없다(2026-11-12). 게임 안 크레딧의 그림 항목에 도구 이름(Canva AI · Higgsfield)을 표기했다.
- 사용자 결정(2026-11-12): 무료 요금제 생성물을 크레딧에 표기하고 쓴다.
- **확인 필요**: Higgsfield 무료 요금제 생성물의 상업 이용. 공식 도움말은 요금제와 무관하게 허용한다고 하지만 외부 글은 무료 요금제를 제외한다고 써서 엇갈린다. 출시 전에 약관 원문을 확인하거나, 유료 요금제에서 다시 생성한다.

## 아직 남은 것 (출시 전)
- (완료 2026-11-11) 앱 아이콘·시작 화면: Canva AI로 만든 art_src/app_icon.png에서 scripts/build-icons.py로 안드로이드·iOS용을 만든다.
- 일본 스토어 문구에서 "三国志"는 설명·키워드에만 쓰고, 앱 이름에는 쓰지 않는다(코에이테크모의 등록 상표 "三國志"와 혼동을 피하기 위해. 현재 이름 "三国ランダムディフェンス"는 해당 없음).