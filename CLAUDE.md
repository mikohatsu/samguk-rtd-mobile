# 삼국 랜덤 디펜스 — 모바일판 (일본 App Store 목표, Capacitor iOS)

## 꼭 지킬 것
- 답은 한국어로.
- 설계 문서(Claude Docs, 프로젝트 Ft7sJGe2Hpdvs8FLXsVpzP)가 기준. 기능을 바꾸면 거기에 기록한다.
- 요청하지 않은 기능은 넣지 않는다. 애매하면 묻는다.
- 그림·디자인 에셋은 직접 그리지 않는다(생성 도구나 CC0/CC BY 에셋 사용, 출처는 CREDITS.md).
- GCP는 mikohatsu97 계정, 항상 `--project mikoserver-513016`. 웹판 서버(/opt/rtd)와 웹 아티팩트는 건드리지 않는다.
- 배포하면 공개 주소(https://34-146-124-57.sslip.io)에서 파일 해시로 확인한다.

## 고칠 때
- **화면 코드는 `src/ui/*.js` 조각을 고친다. `ui.js`는 자동 생성 파일**이다 → 고친 뒤 `npm run ui`.
- `npm run build` = ui.js 생성 + 앱용 `www/` 복사. 새 js 파일을 만들면 `scripts/build-www.js` 목록과 `samguk-rtd.html`의 script 태그에 추가.
- 서버가 내주는 파일 규칙: 루트의 `*.js`, `gfx/이름.(png|jpg|js)`(하위 폴더 금지), `fonts/*.woff2`, `bgm/이름.mp3`. `server/app.js`를 고치면 VM에서 `sudo systemctl restart rtd-online`.
- 변경은 git 커밋으로 남긴다(git은 F:\Git\cmd, PATH에 없으면 직접 경로).

## 파일 지도
| 파일 | 내용 |
|---|---|
| `samguk-rtd.html` | 화면 뼈대와 CSS 전부 |
| `engine.js` | 게임 규칙(라운드·유닛·보스전·스킬). 화면과 무관 |
| `raid.js` | 보스별 특수 기믹 |
| `theme-samguk.js` | 데이터: 장수·보스·난이도·시너지·변형 규칙 |
| `src/ui/01~19-*.js` | 화면 코드 조각(아래 표) → `ui.js` |
| `rig.js` | 조각 애니메이션(기존 SD 그림을 몸통·무기로 잘라 움직임). 그림은 `gfx/rig_*` |
| `art.js` | 스프라이트·이펙트 그림 불러오기(`fxAnim` = 프레임 애니메이션 이펙트 `gfx/fxa_*`) |
| `skillfx.js` | 스킬 전용 연출 |
| `audio.js` / `sfxdata.js` / `bgm/` | 소리. 배경음은 `bgm/*.mp3`(라인 5곡 섞어 틀기, 보스전 2곡. `scripts/build-bgm.py`), 무기 효과음은 녹음 샘플(sfxdata.js, `scripts/build-sfx.py`) |
| `lobby.js` | 시작 단계(위저드)·전적·난이도 잠금·스킨 |
| `net.js` | 협동 통신 |
| `i18n.js` / `i18n-data.js` | 4개 언어 문구 |
| `tutorial.js` | 첫 판 안내 |
| `credits.js` / `CREDITS.md` | 크레딧·라이선스 화면(설정 > 크레딧)과 출처 목록. 에셋을 더하거나 빼면 둘 다 고친다 |
| `native.js` | 앱 전용(광고·ATT·로그인) |
| `server/` | 온라인 서버(Node, PostgreSQL). VM rtd-online의 /opt/rtd-online |
| `ios/` | Xcode 프로젝트(Capacitor). 출시 절차는 MAC_HANDOFF.md |

### src/ui 조각
| 조각 | 내용 |
|---|---|
| 01-setup | 모듈 참조, 화질 설정, 상태 S |
| 02-map | 전장 배경 |
| 03-unit | 유닛 한 명 그리기(piece), 자세 |
| 04-fx-text | 전투 이펙트, 피해 숫자 |
| 05-lane | 라인 화면 |
| 06-boss-vfx | 보스 기술 장판·착탄 연출 |
| 07-arena | 보스전 화면(보스·장수·타격감) |
| 08-pop | 신화·불멸 등장 연출 |
| 09-render-camera | render, 카메라 |
| 10-input | 터치·마우스 입력 |
| 11-actions | 버튼 행동(doAct), 알림 |
| 12-panels | 오른쪽 서랍 |
| 13-info-timers | 선택 정보 창, 타이머·시너지 |
| 14-endstats-xp | 통계창, 경험치 연출 |
| 15-pad | 조이스틱·공격·스킬 버튼 |
| 16-hud | 위 정보 줄, 전체 창 |
| 17-loop | 메인 루프, 이벤트, 판 시작 |
| 18-account | 계정 |
| 19-title | 시작 화면 |

## GitHub·안드로이드
- 저장소: https://github.com/mikohatsu/samguk-rtd-mobile (비공개, `gh` CLI가 mikohatsu로 로그인돼 있음). 배포할 때 `git push origin main`도 같이 한다.
- main에 올리면 GitHub Actions(`.github/workflows/android-apk.yml`)가 시험용 APK를 만들어 Releases `android-latest`에 덮어쓴다. 받기: `gh release download android-latest -R mikohatsu/samguk-rtd-mobile -D dist --clobber`
- `android/` = Capacitor 안드로이드 프로젝트(가로 고정, AdMob 시험용 앱 ID). 플레이스토어에는 올리지 않는다(디버그 서명).

## 배포(서버)
```
tar -czf x.tgz <바뀐 파일들>
gcloud compute scp x.tgz rtd-online:/tmp/x.tgz --zone asia-northeast1-b --project mikoserver-513016 --account mikohatsu97@gmail.com
gcloud compute ssh rtd-online --zone asia-northeast1-b --project mikoserver-513016 --account mikohatsu97@gmail.com --command "sudo tar -xzf /tmp/x.tgz -C /opt/rtd-online && sudo chown -R rtd:rtd /opt/rtd-online"
```
그 뒤 공개 주소에서 받아 해시 비교, `npm run build`, 모바일 아티팩트(Ktr5qcLEUSmJ1Qtep1UmEe) 다시 게시.
