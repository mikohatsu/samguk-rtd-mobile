# 보스전 바닥 타일 만들기: art_src/floor_src/의 CC0 1K 재질(Poly Haven, 색 지도)을 밝기 무늬만 남긴 1024px 타일(gfx/flr_*.jpg)로 바꾼다.
# 색은 넣지 않는다(색은 theme-samguk.js의 경기장 색을 07-arena.js가 낮춰 쓰고, 이 타일을 overlay로 한 번만 얹는다).
# 사진 잔결을 SD 그림에 맞게 줄인다(아트 디렉터 검수 2026-11-19):
#   1) 5px 중간값 + 1.5px 흐림으로 알갱이를 없앤다
#   2) 판 안쪽 밝기는 128 ± 10 안으로 누르고, 줄눈·갈라진 틈(평균보다 뚜렷이 어두운 곳)만 128보다 30~40 어둡게 남긴다
#   3) 10 간격으로 포스터화(줄눈 있는 재질 6단계: 88~138) / 줄눈 없는 재질은 ±10 안에서 5 간격 5단계
#   4) 계단 가장자리가 거칠지 않게 0.7px만 다시 흐린다
# 이음매 없는 원본을 자르거나 돌리지 않고, 필터도 이어 붙인 판(3×3)에서 돌려 가운데만 잘라 쓰므로 이음매가 그대로 없다.
# 쓰기: python art_src/build-floor.py
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'art_src', 'floor_src')
# 타일 이름: (원본 파일, 줄눈이 있는가)
TILES = {
    'flr_slab': ('large_floor_tiles_02_diff_1k.jpg', True),
    'flr_brick': ('floor_bricks_02_diff_1k.jpg', True),
    'flr_earth': ('dry_ground_01_diff_1k.jpg', True),
    'flr_gravel': ('rock_ground_diff_1k.jpg', False),
    'flr_forest': ('brown_mud_leaves_01_diff_1k.jpg', False),
}


def wrap_filter(im, *filters):
    w, h = im.size
    big = Image.new('L', (w * 3, h * 3))
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * w, j * h))
    big = big.crop((w - 32, h - 32, 2 * w + 32, 2 * h + 32))
    for f in filters:
        big = big.filter(f)
    return big.crop((32, 32, 32 + w, 32 + h))


for name, (src, joints) in TILES.items():
    im = Image.open(os.path.join(SRC, src)).convert('L')
    im = wrap_filter(im, ImageFilter.MedianFilter(5), ImageFilter.GaussianBlur(1.5))
    a = np.asarray(im, dtype=np.float32)
    z = (a - a.mean()) / max(1e-3, a.std())
    out = 128 + 10 * np.clip(z / 1.3, -1, 1)
    if joints:
        k = np.clip((-z - 1.3) / 0.7, 0, 1)
        out = out - 28 * (k * k * (3 - 2 * k))
        out = np.round(out / 10) * 10 - 2
    else:
        out = np.round((out - 128) / 5) * 5 + 128
    res = wrap_filter(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'L'), ImageFilter.GaussianBlur(0.7))
    p = os.path.join(ROOT, 'gfx', name + '.jpg')
    res.save(p, quality=86, optimize=True)
    r = np.asarray(res)
    print(name, res.size, os.path.getsize(p), 'mean', round(float(r.mean()), 1), 'min', int(r.min()), 'max', int(r.max()), 'levels', len(np.unique(np.round(out))))
