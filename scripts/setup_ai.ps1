# 게임 그림 생성용 로컬 AI 설치(F:\AI): ComfyUI(구형 GPU용 cu126) + FLUX.1-schnell(상업 이용 가능, GGUF 양자화) + 필요한 노드
$ErrorActionPreference = 'Continue'
$root = 'F:\AI'
New-Item -ItemType Directory -Force $root | Out-Null
$log = "$root\setup.log"
function Log($m) { "$(Get-Date -Format 'HH:mm:ss') $m" | Tee-Object -FilePath $log -Append }
function Get-File($url, $out) {
  if ((Test-Path $out) -and ((Get-Item $out).Length -gt 1MB)) { Log "있음: $out"; return $true }
  Log "받는 중: $url"
  & curl.exe -L --fail --retry 5 --retry-delay 5 -C - -o $out $url 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Log "실패($LASTEXITCODE): $url"; return $false }
  Log "완료: $out ($([math]::Round((Get-Item $out).Length/1MB))MB)"; return $true
}
# 1) ComfyUI 휴대판
$z = "$root\ComfyUI_windows_portable_nvidia_cu126.7z"
if (Get-File 'https://github.com/Comfy-Org/ComfyUI/releases/download/v0.44.0/ComfyUI_windows_portable_nvidia_cu126.7z' $z) {
  if (-not (Test-Path "$root\ComfyUI_windows_portable")) { Log '압축 푸는 중'; & 'C:\Program Files\7-Zip\7z.exe' x $z "-o$root" -y | Out-Null; Log '압축 풀기 끝' }
}
$cu = Get-ChildItem $root -Directory | Where-Object { $_.Name -like 'ComfyUI_windows_portable*' } | Select-Object -First 1
if (-not $cu) { Log 'ComfyUI 폴더 없음 — 중단'; exit 1 }
$base = $cu.FullName; $m = "$base\ComfyUI\models"; $py = "$base\python_embeded\python.exe"
New-Item -ItemType Directory -Force "$m\unet", "$m\clip", "$m\vae", "$m\text_encoders" | Out-Null
# 2) GGUF 노드(ComfyUI-GGUF)와 ComfyUI-Manager: git이 없어 zip으로 받는다
foreach ($n in @(@('city96/ComfyUI-GGUF', 'ComfyUI-GGUF'), @('Comfy-Org/ComfyUI-Manager', 'ComfyUI-Manager'))) {
  $dst = "$base\ComfyUI\custom_nodes\$($n[1])"
  if (-not (Test-Path $dst)) {
    $zip = "$root\$($n[1]).zip"
    if (Get-File "https://codeload.github.com/$($n[0])/zip/refs/heads/main" $zip) {
      Expand-Archive $zip "$root\_tmp_$($n[1])" -Force
      Move-Item (Get-ChildItem "$root\_tmp_$($n[1])" -Directory | Select-Object -First 1).FullName $dst
      Remove-Item "$root\_tmp_$($n[1])" -Recurse -Force; Log "노드 설치: $($n[1])"
    }
  }
}
& $py -m pip install --no-warn-script-location gguf 2>&1 | Select-Object -Last 1 | ForEach-Object { Log "pip gguf: $_" }
if (Test-Path "$base\ComfyUI\custom_nodes\ComfyUI-Manager\requirements.txt") { & $py -m pip install --no-warn-script-location -r "$base\ComfyUI\custom_nodes\ComfyUI-Manager\requirements.txt" 2>&1 | Select-Object -Last 1 | ForEach-Object { Log "pip manager: $_" } }
# 3) FLUX.1-schnell(Apache 2.0) 모델: 본체 GGUF Q4_K_S, 글자 인코더(T5 GGUF Q5_K_M + CLIP-L), VAE
$ok = @{}
$ok.unet = Get-File 'https://huggingface.co/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q4_K_S.gguf' "$m\unet\flux1-schnell-Q4_K_S.gguf"
$ok.t5 = Get-File 'https://huggingface.co/city96/t5-v1_1-xxl-encoder-gguf/resolve/main/t5-v1_1-xxl-encoder-Q5_K_M.gguf' "$m\clip\t5-v1_1-xxl-encoder-Q5_K_M.gguf"
$ok.clip = Get-File 'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors' "$m\clip\clip_l.safetensors"
$ok.vae = Get-File 'https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors' "$m\vae\ae.safetensors"
# 4) GPU 확인
& $py -c "import torch;print('torch',torch.__version__,'cuda',torch.cuda.is_available(),torch.cuda.get_device_name(0) if torch.cuda.is_available() else '-', torch.cuda.get_arch_list() if torch.cuda.is_available() else '')" 2>&1 | ForEach-Object { Log "GPU: $_" }
Log ("결과: " + (($ok.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' '))
Log '설치 스크립트 끝'
