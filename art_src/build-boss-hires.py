# 보스전 그림 해상도 올리기(디자인은 그대로, 해상도만). 그림을 새로 그리지 않는다.
#   python art_src/build-boss-hires.py
# 대상: 보스 10명이 쓰는 장수 그림(앞·옆·뒤) → gfx/hb_<id>[_s|_b].png (보스전에서만 art.js가 따로 받는다)
#       보스 조각 애니메이션 rig_b_*.png → 같은 이름으로 2배 크기(rig.js는 조각을 원래 크기 R.w×R.h로 줄여 맞추므로 관절 좌표는 그대로)
# 순서: 원본(1배) → 흰 테두리·갇힌 흰 배경 제거(build-defringe) → 투명 칸 색 번지기(업스케일러가 흰 배경색을 끌어오지 않게)
#       → Real-ESRGAN x4(realesrgan-x4plus-anime, BSD-3-Clause, 앱에 넣지 않는 도구) → 미리 곱한 알파로 LANCZOS 2배까지 줄이기 → 가벼운 디프린지
# 원본: 장수 낱장은 gfx/<id>.png(아틀라스 재료, 보스용 장수는 줄이지 않은 원래 크기), 조각은 art_src/defringe_orig/rig_b_*.png
import os, sys, glob, subprocess, importlib.util
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GFX = os.path.join(ROOT, 'gfx')
ORIG = os.path.join(ROOT, 'art_src', 'defringe_orig')
TMP = os.path.join(ROOT, 'art_src', 'hires_tmp')
ESR = r'F:\samguk-media\tools\realesrgan\realesrgan-ncnn-vulkan.exe'
OUT_K = 2
BOSSES = ['janggak', 'hwawoong', 'dongtak', 'wonso', 'yeopo', 'jojo', 'yukson', 'jegal', 'deungae', 'samaui']

src = open(os.path.join(ROOT, 'art_src', 'build-defringe.py'), encoding='utf8').read().replace('\nmain()\n', '\n')
dfr = {'__file__': os.path.join(ROOT, 'art_src', 'build-defringe.py')}; exec(compile(src, 'build-defringe.py', 'exec'), dfr)

def bleed(im, n=12):
    # 투명 칸의 색을 가장 가까운 그림 색으로 채운다(알파는 그대로)
    rgb = im[..., :3].astype(np.float32); a = im[..., 3]
    have = a > 0
    for _ in range(n):
        acc = np.zeros_like(rgb); cnt = np.zeros(a.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sh = np.roll(np.roll(rgb, dy, 0), dx, 1); hv = np.roll(np.roll(have, dy, 0), dx, 1)
            acc += sh * hv[..., None]; cnt += hv
        new = (~have) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]; have = have | new
    out = im.copy(); out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out

def down(im4, w, h):
    # 미리 곱한 알파로 줄여야 투명 쪽 색이 가장자리에 번지지 않는다
    f = im4.astype(np.float32) / 255.0
    pm = np.dstack([f[..., :3] * f[..., 3:4], f[..., 3:4]])
    chans = [np.array(Image.fromarray((pm[..., i] * 255).astype(np.float32), 'F').resize((w, h), Image.Resampling.LANCZOS)) for i in range(4)]
    r = np.dstack(chans) / 255.0
    a = np.clip(r[..., 3], 0, 1)
    rgb = np.where(a[..., None] > 1e-3, r[..., :3] / np.maximum(a[..., None], 1e-3), 0)
    return (np.dstack([np.clip(rgb, 0, 1), a]) * 255 + 0.5).astype(np.uint8)

def posterize(im):
    # gfx/build.js 아틀라스와 같은 색 단계 줄이기(채널당 64단계, 눈으로는 차이 없음): 파일 약 23% 감소. 완전 투명 칸 색은 0으로
    q = im.copy(); q[..., :3] = np.clip(np.round(q[..., :3] / 4.0) * 4, 0, 255).astype(np.uint8)
    a = q[..., 3]; a[a > 250] = 255; a[a < 6] = 0; q[a == 0] = 0
    return q

def hires(src_path, dst_path):
    im = np.array(Image.open(src_path).convert('RGBA'))
    h, w = im.shape[:2]
    clean = bleed(dfr['defringe'](im))
    os.makedirs(TMP, exist_ok=True)
    a = os.path.join(TMP, 'in.png'); b = os.path.join(TMP, 'out.png')
    Image.fromarray(clean).save(a)
    subprocess.run([ESR, '-i', a, '-o', b, '-n', 'realesrgan-x4plus-anime', '-s', '4'], check=True, capture_output=True, cwd=os.path.dirname(ESR))
    up = np.array(Image.open(b).convert('RGBA'))
    # 업스케일러는 알파를 따로 키운다: 원본에서 비어 있던 칸이 흐릿하게 살아나지 않게 알파는 원본(깨끗한 것)을 키운 값과 곱으로 묶는다
    a_ref = np.array(Image.fromarray(clean[..., 3]).resize((w * 4, h * 4), Image.Resampling.BICUBIC)).astype(np.float32) / 255
    up[..., 3] = (np.minimum(up[..., 3].astype(np.float32) / 255, np.clip(a_ref * 1.15, 0, 1)) * 255).astype(np.uint8)
    out = down(up, w * OUT_K, h * OUT_K)
    out = posterize(out)
    Image.fromarray(out).save(dst_path, optimize=True)
    return out.shape[1], out.shape[0]

def main():
    done = []
    for bid in BOSSES:
        for suf in ('', '_s', '_b'):
            p = os.path.join(GFX, bid + suf + '.png')
            if not os.path.exists(p): continue
            done.append(('hb_' + bid + suf,) + hires(p, os.path.join(GFX, 'hb_' + bid + suf + '.png')))
    for p in sorted(glob.glob(os.path.join(ORIG, 'rig_b_*.png'))):
        done.append((os.path.basename(p),) + hires(p, os.path.join(GFX, os.path.basename(p))))
    for d in done: print(*d)

main()
