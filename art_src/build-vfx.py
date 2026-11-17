# 연출용 그림을 art_src/vfx_dl/(받은 CC0 원본)에서 게임용 gfx/로 가공한다.
# 실행: py -3.12 -I art_src/build-vfx.py  (저장소 맨 위 폴더에서)
# 흰색(또는 회색) 그림으로 만들어 두고, 색은 게임 코드(art.js fxTint)가 물들인다.
import os
from PIL import Image, ImageFilter, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DL = os.path.join(ROOT, 'art_src', 'vfx_dl')
OUT = os.path.join(ROOT, 'gfx')


def white(im, boost=1.0):
    """색을 빼고 밝기만 남긴 흰 그림(알파는 원래 알파 × 밝기)."""
    im = im.convert('RGBA')
    r, g, b, a = im.split()
    lum = Image.merge('RGB', (r, g, b)).convert('L')
    lum = lum.point(lambda v: min(255, int(v * boost)))
    a2 = ImageChops.multiply(a, lum)
    return Image.merge('RGBA', (lum, lum, lum, a2))


def sheet(frames, fw, fh, cols, name):
    rows = (len(frames) + cols - 1) // cols
    sh = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sh.paste(f.resize((fw, fh), Image.LANCZOS), ((i % cols) * fw, (i // cols) * fh))
    p = os.path.join(OUT, name)
    sh.save(p, optimize=True)
    print(name, sh.size, len(frames), 'frames', os.path.getsize(p) // 1024, 'KB')


def grid(path, cols, rows, n=None):
    im = Image.open(path).convert('RGBA')
    fw, fh = im.width // cols, im.height // rows
    out = []
    for i in range(n or cols * rows):
        x, y = (i % cols) * fw, (i // cols) * fh
        out.append(im.crop((x, y, x + fw, y + fh)))
    return out


# 1) 충격파 고리: para "Animated particle effects #1"(CC0) particlefx_14, 8×8칸 64프레임 → 앞의 점 프레임을 빼고 짝수 프레임 25장
fr = grid(os.path.join(DL, 'oga_para_particlefx1', 'particlefx_14.png'), 8, 8)
sheet([white(f, 1.6) for f in fr[14::2]], 96, 96, 5, 'fxa_wave.png')

# 2) 빛살 터짐: Esthar "Item popup starburst"(CC0) PNG 60장 → 짝수 프레임 30장
seq = os.path.join(DL, 'oga_esthar_starburst', 'starburst', 'png sequence')
fr = [Image.open(os.path.join(seq, 'burst%04d.png' % i)) for i in range(1, 61, 2)]
sheet([white(f, 1.2) for f in fr], 128, 128, 6, 'fxa_burst.png')

# 3) 연기: Beast "Smoke Aura"(CC0) Smoke30Frames, 6×5칸 30프레임
fr = grid(os.path.join(DL, 'oga_beast_smoke_aura', 'Smoke30Frames_0.png'), 6, 5)
sheet([white(f, 1.4) for f in fr], 96, 96, 6, 'fxa_smoke.png')

# 4) 법진: Luke.RUSTLTD "4 summoning circles"(CC0) 검은 선 → 흰 선(투명 배경)
for src, name in (('circle7.png', 'mc_rune1.png'), ('circle4.png', 'mc_rune2.png'), ('circle6.png', 'mc_rune3.png')):
    im = Image.open(os.path.join(DL, 'oga_lukerust_summoning_circles', src)).convert('RGBA')
    bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    ink = ImageChops.invert(bg.convert('L')).filter(ImageFilter.MaxFilter(3))
    ink = ink.resize((512, 512), Image.LANCZOS)
    glow = ink.filter(ImageFilter.GaussianBlur(6)).point(lambda v: min(255, v * 2))
    a = ImageChops.lighter(ink, glow.point(lambda v: v // 2))
    w = Image.new('L', a.size, 255)
    out = Image.merge('RGBA', (w, w, w, a))
    p = os.path.join(OUT, name); out.save(p, optimize=True)
    print(name, out.size, os.path.getsize(p) // 1024, 'KB')

# 5) 빛살: simranzenov "Sunbursts / 2D Rays"(CC0) 흑백 빛살 → 가장자리를 흐리고 가운데에서 바깥으로 사라지게
im = Image.open(os.path.join(DL, 'oga_simranzenov_sunbursts', 'sunburst_blackandwhite2.png')).convert('RGBA')
bg = Image.new('RGBA', im.size, (0, 0, 0, 255)); bg.alpha_composite(im)
lum = bg.convert('L').resize((512, 512), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9))
mask = Image.radial_gradient('L').resize((512, 512))  # 가운데 0 → 바깥 255
mask = mask.point(lambda v: int(255 * max(0.0, 1 - v / 230) ** 1.7))
a = ImageChops.multiply(lum, mask)
w = Image.new('L', a.size, 255)
out = Image.merge('RGBA', (w, w, w, a))
p = os.path.join(OUT, 'ray_sun.png'); out.save(p, optimize=True)
print('ray_sun.png', out.size, os.path.getsize(p) // 1024, 'KB')

# 6) 별: alexander123 "Stars Icon for UI"(CC0) Star2 → 밝기만 남긴 흰 별(등급 색으로 물들인다)
im = Image.open(os.path.join(DL, 'oga_alexander123_stars', 'Star2.png')).convert('RGBA')
im = white(im, 1.25).resize((128, 122), Image.LANCZOS)
p = os.path.join(OUT, 'pic_star.png'); im.save(p, optimize=True)
print('pic_star.png', im.size, os.path.getsize(p) // 1024, 'KB')
