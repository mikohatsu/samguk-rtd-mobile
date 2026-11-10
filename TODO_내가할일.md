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

## 0. GitHub 연결 (git은 지금 이 PC 안에만 있음)
- [ ] github.com에서 본인 계정으로 **비공개(private)** 저장소를 하나 만들기(예: `samguk-rtd-mobile`, README 없이 빈 저장소)
- [ ] 이 폴더에서 아래 두 줄 실행. 처음 push할 때 브라우저 로그인 창이 뜹니다.
  - `F:\Git\cmd\git.exe remote add origin https://github.com/<계정>/samguk-rtd-mobile.git`
  - `F:\Git\cmd\git.exe push -u origin main`
- 연결되면 Mac이 없어도 GitHub Actions(맥 빌드 서버)로 iOS 빌드를 돌릴 수 있습니다.

## 0-1. iOS 앱으로 내보내기 (자세한 순서는 MAC_HANDOFF.md)
- [ ] Apple Developer Program 가입(연 12,800엔) — 본인 인증 필요
- [ ] 빌드 방법 고르기: (가) Mac + Xcode에서 `npm install` → `npm run ios`, (나) Mac 없이 GitHub Actions/Codemagic 같은 클라우드 맥 빌드
- [ ] 앱 아이콘(1024×1024)·스토어 스크린샷 정하기

## 4. 게임 안 크레딧 화면 (결정 필요)
- [ ] 새 스킬 버튼 아이콘(game-icons.net)은 **CC BY 3.0**이라 출시 때 출처 표기가 필요합니다. 지금은 CREDITS.md 파일에만 적어 두었습니다. 설정 메뉴에 '크레딧' 화면을 넣을지 알려 주세요.

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
