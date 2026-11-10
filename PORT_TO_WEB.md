# 모바일판 → 웹판으로 옮길 것 (2026-11-10 기준, 모바일 커밋 396c629)

사용자 요청: **UI(배치·조작)는 빼고**, 효과음·이펙트·애니메이션과 그 밖에 웹판에도 해당하는 수정을 웹판에 옮긴다.
그리고 **웹판 메인 페이지에 안드로이드 APK 다운로드**를 넣는다.

모바일 폴더: `C:\Users\A\Documents\samguk-rtd-mobile` (git 저장소, GitHub mikohatsu/samguk-rtd-mobile 비공개)
화면 코드는 `src/ui/NN-*.js` 조각으로 나뉘어 있고 `ui.js`는 그걸 이어 붙인 자동 생성 파일이다. 아래 "위치"는 조각 기준.
바뀐 내용을 정확히 보려면 `git -C <모바일 폴더> log -p -- <파일>` 또는 조각 파일에서 아래 검색어로 찾는다.

## A. 옮길 것

### 1. 조각 애니메이션 (기존 SD 그림을 몸통·무기로 잘라 움직임)
- 새 파일 `rig.js` (통째로), 그림 `gfx/rig_*.png` 81장(보스 10명 앞·옆, 장수 19명 옆. 보스와 같은 그림을 쓰는 장수는 보스 조각 공유 → 장수 28명).
- `samguk-rtd.html`에 `<script src="rig.js">` (skillfx.js 다음).
- 화면 쪽 연결:
  - `03-unit` `piece()`: `RTD_RIG` 검색 — 조각이 있으면 조각으로 그림(라인은 옆모습 v===2일 때만, 화질 낮음이면 끔).
  - `07-arena`: 장수 `rs`(공격·스킬·피격·걷기 상태), 보스 `rView`/`rv`/`st`(기술 종류별 앞·옆 동작).
  - `17-loop` `e.type === 'pattern'`: 기술 이름 → `S.bossAct = RTD_RIG.actOf(gen)`.
- 조각 자르는 도구·좌표는 모바일 세션 임시 폴더에만 있음(다시 필요하면 모바일 세션에 요청).

### 2. 보스전 타격감
- `07-arena`의 `S.bhr`(hr): 보스 넉백·찌그러짐·흰 번쩍, 피해 숫자 누적(0.14초마다 `hit:true`), 기술 전 힘 모으기(`wind`)·내리찍기(`slam`), 장수 피격 넉백(`kb`).
- `04-fx-text` `drawText`: `d.hit`/`d.big` 숫자 튀어나오는 연출.
- `17-loop` `dmgtext`: 히트스톱(`S.hitStop`, 혼자 할 때만·숫자일 때만), 카메라 펀치(`S.punch`), 숫자 흩뿌리기, `Snd.play('hit', 90)`.
- `17-loop` tick: `else if (S.hitStop > 0) { S.hitStop -= dt; acc = 0; }`
- `09-render-camera` render: 카메라 펀치 변환.
- **버그 수정** 보스 등장·이동 때 덜덜 떨림: `07-arena`의 `S.bossMovedAt`(마지막으로 움직인 뒤 0.15초까지 걷는 중).

### 3. 프레임 애니메이션 이펙트 (OpenGameArt CC0)
- 그림 `gfx/fxa_{hit,hit2,boom,boom2,ring,bolt}.png`.
- `art.js`: `FXA_META`, `FXA`, `fxAnim()` + export에 `fxAnim` 추가.
- 쓰는 곳(`Art.fxAnim` 검색): `04-fx-text`(평타·스킬 타격 spark, 스킬 폭발 blast), `06-boss-vfx`(충격파 shock, 번개 bolt, 폭발 img), `07-arena`(보스 내리찍기).

### 4. 효과음 (무기별 녹음 샘플, 쇳소리 없음)
- 새 파일 `sfxdata.js`(277KB, 자동 생성) + `audio.js` 통째로 교체. html에 `<script src="sfxdata.js" defer>`.
- 다시 만들 때: `scripts/build-sfx.py` (원본은 모바일 세션 임시 폴더).
- 사용자가 쇳소리(칼 부딪힘·칼날 긁는 소리)를 싫어함 → 넣지 말 것.

### 5. 크기
- `07-arena`: `CHAMP_R = 40`(기존 31), `BOSS_S = 1.25`. 체력 막대·선택 고리 위치도 같이 바뀜(같은 조각 안).
- `05-lane`: 라인 유닛 `* 1.5`(기존 1.3). ← 폰 가독성 때문에 키운 것이라 웹(PC)에는 과할 수 있음. 웹 세션이 판단.

### 6. 그 밖에 웹에도 해당하는 수정
- `11-actions` `toast`: 같은 알림이 연달아 오면 `×N`으로 합침, 최대 4줄.
- `17-loop` `e.type === 'skill'`: 장수 스킬 이름은 알림 줄에 안 띄움(보스 기술 이름을 가리던 문제). 화타 치료는 유지.
- `17-loop` begin: 자동 배치 기본 켜기 + 선택 기억(`rtd-auto`), `tutorial.js`: 건너뛰면 자동 배치 켜기(`onSkip`).
- `lobby.js` `markLocks`: 잠긴 난이도 버튼 안에 "(이전 난이도) 클리어 필요" 글(+ html의 `#diffs button .lk` CSS).
- `server/app.js` 닉네임 금칙어 필터(`nickBad`, `shownNick`)와 `lobby.js`의 안내 — 이미 옮겼으면 건너뜀.
- `CREDITS.md`: 에셋 출처(아이콘은 CC BY 3.0이라 표기 필요 — 단, 아이콘은 모바일 스킬 버튼용이라 웹에 안 옮기면 해당 없음).

## B. 옮기지 말 것 (모바일 UI·조작)
- `15-pad`(조이스틱·공격 버튼·스킬 조준·고양이 발 배치), `skillicons.js`, html의 `#skillbar`/`#joy` CSS.
- `engine.js`의 `this.manual`/`c.joy`/`c.atkHold`(직접 조작). 옮겨도 `g.manual`을 켜지 않으면 동작은 같다.
- `04-fx-text`의 `uiS()` 글씨 확대(작은 화면용. PC에서는 1배라 옮겨도 무해).
- 통계창(`14-endstats-xp`)·오른쪽 서랍 C안·`.over` z-index 등 화면 배치.
- `android/`, `.github/workflows/`.

## C. 웹판 메인 페이지에 APK 다운로드
- APK 파일: `C:\Users\A\Documents\samguk-rtd-mobile\dist\sangokurtd-test.apk` (52MB, 디버그 서명, 플레이스토어용 아님).
- 최신본 받기: `gh release download android-latest -R mikohatsu/samguk-rtd-mobile -D <폴더> --clobber` (gh는 이 PC에서 mikohatsu로 로그인됨, `F:\Git\cmd`를 PATH에 넣어야 함). 모바일 main에 올릴 때마다 GitHub Actions가 새로 만든다(약 4분).
- **저장소가 비공개라 GitHub 주소로는 일반 사용자가 못 받는다.** 웹 서버가 직접 파일을 내주거나(예: `/download/sangokurtd-test.apk`, Content-Type `application/vnd.android.package-archive`) GCS 공개 버킷에 올려 링크해야 한다.
- 메인 페이지에 "안드로이드 시험판 받기" 버튼 + "출처를 알 수 없는 앱 설치 허용 필요" 안내.
- 모바일판이 갱신될 때 웹의 APK도 같이 바꾸는 방법(수동 복사 / 서버에서 주기적으로 받기)은 웹 세션이 정하고 사용자에게 알려 줄 것.
