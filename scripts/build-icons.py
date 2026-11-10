"""앱 아이콘·시작 화면을 art_src/app_icon.png(정사각형 원본, Canva AI 생성) 하나에서 만든다.
사용: python scripts/build-icons.py   (Pillow 필요)
만드는 것: 안드로이드 mipmap-*/ic_launcher*.png, drawable*/splash.png, iOS AppIcon·Splash."""
import os, glob
from PIL import Image, ImageDraw
root = os.path.join(os.path.dirname(__file__), '..')
src = Image.open(os.path.join(root, 'art_src', 'app_icon.png')).convert('RGB')
BG = (26, 18, 12)  # capacitor.config.json의 backgroundColor(#1a120c)
res = os.path.join(root, 'android', 'app', 'src', 'main', 'res')
def fit(n): return src.resize((n, n), Image.LANCZOS)
def rounded(im, r):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255)
    out = im.convert('RGBA'); out.putalpha(m); return out
def circle(im):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).ellipse([0, 0, im.size[0] - 1, im.size[1] - 1], fill=255)
    out = im.convert('RGBA'); out.putalpha(m); return out
# 안드로이드 아이콘: 옛 방식(사각·원)과 적응형 앞그림(108dp 중 가운데 72dp만 보이므로 0.76배로 넣어 얼굴이 잘리지 않게)
for name, dp in [('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)]:
    d = os.path.join(res, 'mipmap-' + name); n = int(48 * dp)
    rounded(fit(n), n // 6).save(os.path.join(d, 'ic_launcher.png'))
    circle(fit(n)).save(os.path.join(d, 'ic_launcher_round.png'))
    f = int(108 * dp); s = int(f * 0.76); fg = Image.new('RGBA', (f, f), (0, 0, 0, 0)); fg.paste(fit(s), ((f - s) // 2, (f - s) // 2)); fg.save(os.path.join(d, 'ic_launcher_foreground.png'))
# 시작 화면: 어두운 바탕 가운데에 아이콘(짧은 변의 38%)
def splash(w, h):
    im = Image.new('RGB', (w, h), BG); n = int(min(w, h) * 0.38); ic = rounded(fit(n), n // 6)
    im.paste(ic, ((w - n) // 2, (h - n) // 2), ic); return im
for p in glob.glob(os.path.join(res, 'drawable*', 'splash.png')):
    w, h = Image.open(p).size; splash(w, h).save(p)
ios = os.path.join(root, 'ios', 'App', 'App', 'Assets.xcassets')
fit(1024).save(os.path.join(ios, 'AppIcon.appiconset', 'AppIcon-512@2x.png'))  # iOS 아이콘은 투명·둥근 모서리 없이
for p in glob.glob(os.path.join(ios, 'Splash.imageset', '*.png')):
    w, h = Image.open(p).size; im = Image.new('RGB', (w, h), BG); n = int(min(w, h) * 0.2); ic = rounded(fit(n), n // 6); im.paste(ic, ((w - n) // 2, (h - n) // 2), ic); im.save(p)
print('아이콘·시작 화면 생성 완료')
