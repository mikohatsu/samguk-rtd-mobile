# 직접 해 주셔야 하는 일 (로그인·계정·결제가 필요한 것)

AI 도구 중 Claude가 대신 설치·연결할 수 없는 것만 모았습니다. 끝내면 줄을 지워 주세요.

## 1. 커넥터 연결 (claude.ai 설정 → 커넥터)
- [ ] **Hugging Face** — 모델·Space(무료 생성 앱) 검색과 실행. 연결 버튼을 누르고 Hugging Face 계정으로 로그인.
- [ ] **Adobe** (Firefly 포함) — 그림 생성·배경 제거·편집. Adobe 계정 로그인 필요. 무료 계정은 생성 크레딧이 월 제한.
- (이미 연결됨) Canva · Google Drive · Gmail · Claude Docs

## 2. Hugging Face 계정 (로컬 모델용)
- [ ] huggingface.co 가입 후 **Access Token(read)** 발급 → 알려 주시면 로컬에 저장해 아래 '승인 필요 모델'을 받습니다.
- 승인 필요 모델(각 모델 페이지에서 "Agree" 눌러야 받을 수 있음):
  - [ ] **Stable Audio Open 1.0** (stabilityai/stable-audio-open-1.0) — 효과음·짧은 배경음 생성. 매출 100만 달러 이하 상업 이용 무료(커뮤니티 라이선스).
  - [ ] (선택) **FLUX.1-dev** — 그림 품질은 더 좋지만 **비상업 라이선스**라 게임에 넣을 그림에는 쓰지 않는 것을 권장. 지금 설치한 FLUX.1-schnell은 Apache 2.0(상업 이용 가능).

## 3. 유료·계정 서비스 (필요할 때만)
- [ ] 음악: Suno / Udio — 유료 요금제에서만 상업 이용 가능. 쓰실 거면 가입 후 알려 주세요.
- [ ] 효과음·목소리: ElevenLabs — 무료는 비상업. 상업 이용은 유료.

## 0. 갤럭시에 시험용 APK 깔기
- [ ] 폰 브라우저에서 GitHub(mikohatsu)에 로그인 → https://github.com/mikohatsu/samguk-rtd-mobile/releases/tag/android-latest → `sangokurtd-test.apk` 받기
  (또는 이 PC의 `dist\sangokurtd-test.apk`를 카톡·USB로 옮기기)
- [ ] 설치할 때 "출처를 알 수 없는 앱 설치 허용"을 켜야 합니다. Play 프로텍트 경고가 뜨면 "무시하고 설치".
- 새 버전은 GitHub에 올릴 때마다 자동으로 다시 만들어져 같은 주소에 덮어씁니다(약 3~4분).
- 덮어 설치가 "앱이 설치되지 않았습니다"로 실패하면 서명 키가 바뀐 것이니 기존 앱을 지우고 다시 설치하세요.

## 0-1. iOS 앱으로 내보내기
iOS 출시에 필요한 일은 모두 `MAC_HANDOFF.md` 2장 "내가 할 일"에 순서대로 있습니다. 여기에는 따로 적지 않습니다.

## 4. 저작권 — 남은 확인
- [x] 게임 안 크레딧 화면: 설정 > 크레딧 · 라이선스에 넣었습니다(음악·아이콘·글꼴·라이브러리).
- [ ] **그림을 만든 도구 확인**: 장수·보스·배경·UI 그림을 어떤 생성 도구·요금제로 만들었는지 알려 주세요(무료 요금제는 상업 이용이 안 되는 도구가 있습니다).
- [x] 앱 아이콘·시작 화면을 자체 그림으로 교체했습니다(안드로이드·iOS). 마음에 안 들면 art_src/app_icon.png를 바꾸고 `python scripts/build-icons.py`.
- [x] 그림 도구: Canva Pro(AI) — 상업 이용 가능 확인.
- [ ] **이번 한 번만** 폰의 기존 시험판을 지우고 새 APK를 설치해 주세요. 서명 키를 고정했기 때문에 다음부터는 지우지 않고 업데이트됩니다.

## 5. 로컬 그림 생성기 설치 승인 (아직 안 됨)
Claude가 설치하려 했지만, 외부 프로그램을 내려받아 실행하는 작업이라 Claude Code 권한 검사에서 막혔습니다. 둘 중 하나를 해 주세요.
- [ ] **직접 실행**: PowerShell에서 아래 한 줄 실행(약 13GB, F:\AI에 설치)
  `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\A\Documents\samguk-rtd-mobile\scripts\setup_ai.ps1"`
- [ ] 또는 Claude Code 설정에서 이 작업을 허용한 뒤 "로컬 AI 설치 다시 해줘"라고 말해 주세요.

설치되는 것:
- **ComfyUI** (GTX 1070용 CUDA 12.6판) — 실행: `F:\AI\ComfyUI_windows_portable\run_nvidia_gpu.bat` → http://127.0.0.1:8188
- **FLUX.1-schnell** (Apache 2.0, 상업 이용 가능, 8GB 그래픽카드용 GGUF Q4) + T5/CLIP 글자 인코더 + VAE
- ComfyUI-GGUF 노드, ComfyUI-Manager
- 설치 기록: F:\AI\setup.log

C 드라이브 여유 공간이 2.4GB뿐이라 F 드라이브에 설치하도록 해 두었습니다. C 드라이브 정리를 권장합니다.
