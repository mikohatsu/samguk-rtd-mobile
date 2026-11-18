"""gfx/arena_mark.png 만들기: 보스전 경기장 가운데 팔괘 문양(v0.2.38).

원본: art_src/arena_mark_v38_canva.png (1536x1536, 흰 바탕에 먹선, Canva AI 생성)
가공(그림 가공만, 새로 그리지 않는다):
  1. 밝기를 투명도로: 흰 바탕(밝기 >= HI)은 완전 투명, 먹선(밝기 <= LO)은 불투명, 사이는 부드럽게(안티에일리어싱 가장자리 유지).
  2. 색은 검정 한 가지(게임이 경기장 바닥 색으로 물들여 곱하기로 찍는다. 07-arena.js arenaFloor).
  3. 문양 테두리에 맞춰 정사각형으로 자르고(여백 조금), 1024px로 줄인다(LANCZOS).
실행: python art_src/build-arena-mark.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art_src' / 'arena_mark_v38_canva.png'
OUT = ROOT / 'gfx' / 'arena_mark.png'
SIZE, LO, HI, PAD = 1024, 70, 235, 8

g = Image.open(SRC).convert('L')
a = g.point(lambda v: 255 if v <= LO else 0 if v >= HI else round((HI - v) * 255 / (HI - LO)))
x0, y0, x1, y1 = a.point(lambda v: 255 if v > 24 else 0).getbbox()
cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) / 2 + PAD
box = tuple(round(v) for v in (cx - r, cy - r, cx + r, cy + r))
a = a.crop(box)
im = Image.merge('RGBA', (Image.new('L', a.size, 0),) * 3 + (a,))
im = im.resize((SIZE, SIZE), getattr(Image, 'Resampling', Image).LANCZOS)
im.save(OUT, optimize=True)
print(OUT, im.size, 'bbox', (x0, y0, x1, y1), OUT.stat().st_size, 'bytes')
