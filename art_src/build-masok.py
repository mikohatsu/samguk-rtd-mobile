# 체험 보스 마속(b_masok) 그림 만들기. 그림을 새로 그리지 않고 Canva 원본 두 장을 자르고 줄이기만 한다(2026-11-25).
#   python art_src/build-masok.py            gfx/에 쓴다 + 아틀라스(atlas0.png·index.js)에 masok·masok_s 칸을 덧붙인다
#   python art_src/build-masok.py --preview  쓰지 않고 자세 미리보기만(scratch 폴더 대신 shots-v41-trial/masok_rig_preview.png)
# 원본: art_src/masok_f_canva_trim.png(앞, 847×1261, 투명) · art_src/masok_s_canva_cut.png(옆, 오른쪽 봄, 흰 배경 지움)
# 만드는 것(다른 보스와 같은 체계):
#   gfx/masok.png, masok_s.png           1배(높이 184, 아틀라스 재료. 흰 테두리 제거 build-defringe와 같은 처리)
#   gfx/hb_masok.png, hb_masok_s.png     보스전 2배(원본이 크므로 Real-ESRGAN 없이 원본에서 바로 줄임)
#   gfx/rig_b_masok_{f,s}_*.png          조각(2배. rig.js는 R.w×R.h로 줄여 그린다), 1배 원본은 art_src/defringe_orig/에 보관
#   atlas0.png·index.js의 masok·masok_s  gfx/build.js를 다시 돌리지 않고 빈 자리에 덧붙인다(build.js를 돌리면 흰 테두리 처리가 빠지므로)
# 조각: 앞모습 weapon = 죽간 든 손(손목 축), off = 위를 가리키는 팔(어깨 축). 옆모습 weapon = 죽간 든 앞손.
#   조각을 떼어 낸 자리 중 몸 안쪽(fill 다각형)만 주변 색을 번지게 해 메운다(기존 rig_b_* 몸통과 같은 방식). 새 모양을 그리지 않는다.
import os, sys, re, json
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GFX = os.path.join(ROOT, 'gfx')
ORIG = os.path.join(ROOT, 'art_src', 'defringe_orig')
H1 = 184  # 1배 높이(다른 보스 169~189)

src = open(os.path.join(ROOT, 'art_src', 'build-defringe.py'), encoding='utf8').read().replace('\nmain()\n', '\n')
dfr = {'__file__': os.path.join(ROOT, 'art_src', 'build-defringe.py')}; exec(compile(src, 'build-defringe.py', 'exec'), dfr)

# 원본 픽셀 좌표(다각형). pivot도 원본 좌표 → 1배로 바꿔 rig.js에 적는다
VIEWS = {
  'f': {
    'src': 'masok_f_canva_trim.png',
    'parts': [
      ('off', [(587, 527), (693, 333), (820, 327), (840, 560), (853, 933), (740, 933), (727, 747), (707, 627), (627, 587)], (607, 545)),
      ('weapon', [(0, 515), (330, 505), (330, 760), (250, 760), (205, 800), (95, 800), (85, 730), (0, 640)], (175, 755)),
    ],
    'fill': [[(573, 520), (690, 530), (745, 600), (748, 940), (640, 960), (585, 640)], [(200, 505), (332, 505), (332, 760), (230, 760), (200, 600)]],
    'hip': (440, 1000),
  },
  's': {
    'src': 'masok_s_canva_cut.png',
    'parts': [
      ('weapon', [(510, 450), (803, 440), (803, 560), (690, 665), (685, 715), (625, 720), (595, 665), (510, 665)], (640, 690)),
    ],
    'fill': [[(505, 520), (560, 520), (560, 670), (505, 670)]],
    'hip': (430, 960),
  },
}

def poly_mask(size, pts):
    m = Image.new('L', size, 0); ImageDraw.Draw(m).polygon(pts, fill=255)
    return np.array(m) > 127

def bleed_fill(rgb, have, want, n=400):
    # want 칸을 가장 가까운 have 칸의 색으로 채운다(한 겹씩 번지기)
    rgb = rgb.astype(np.float32).copy(); have = have.copy(); want = want & ~have
    for _ in range(n):
        if not want.any(): break
        acc = np.zeros_like(rgb); cnt = np.zeros(have.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sh = np.roll(np.roll(rgb, dy, 0), dx, 1); hv = np.roll(np.roll(have, dy, 0), dx, 1)
            acc += sh * hv[..., None]; cnt += hv
        new = want & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]; have |= new; want &= ~new
    return rgb

def down(im4, w, h):
    # 미리 곱한 알파로 줄인다(build-boss-hires.py와 같음)
    f = im4.astype(np.float32) / 255.0
    pm = np.dstack([f[..., :3] * f[..., 3:4], f[..., 3:4]])
    chans = [np.array(Image.fromarray((pm[..., i] * 255).astype(np.float32), 'F').resize((w, h), Image.Resampling.LANCZOS)) for i in range(4)]
    r = np.dstack(chans) / 255.0
    a = np.clip(r[..., 3], 0, 1)
    rgb = np.where(a[..., None] > 1e-3, r[..., :3] / np.maximum(a[..., None], 1e-3), 0)
    return (np.dstack([np.clip(rgb, 0, 1), a]) * 255 + 0.5).astype(np.uint8)

def posterize(im):
    q = im.copy(); q[..., :3] = np.clip(np.round(q[..., :3] / 4.0) * 4, 0, 255).astype(np.uint8)
    a = q[..., 3]; a[a > 250] = 255; a[a < 6] = 0; q[a == 0] = 0
    return q

def build_view(v, V):
    im = np.array(Image.open(os.path.join(ROOT, 'art_src', V['src'])).convert('RGBA'))
    Hs, Ws = im.shape[:2]
    k = H1 / Hs; w1 = round(Ws * k); h1 = H1
    pieces = {}
    taken = np.zeros((Hs, Ws), bool)
    for pid, pts, pv in V['parts']:
        m = poly_mask((Ws, Hs), pts) & ~taken
        taken |= m
        p = im.copy(); p[~m, 3] = 0
        pieces[pid] = (p, pv)
    body = im.copy(); body[taken, 3] = 0
    fill = np.zeros((Hs, Ws), bool)
    for pts in V['fill']: fill |= poly_mask((Ws, Hs), pts)
    want = fill & taken & (im[..., 3] > 0)
    if want.any():
        rgb = bleed_fill(im[..., :3], body[..., 3] > 200, want)
        body[want, :3] = np.clip(rgb[want], 0, 255).astype(np.uint8); body[want, 3] = 255
    out = {'w': w1, 'h': h1, 'k': k, 'full1': down(im, w1, h1), 'full2': down(im, w1 * 2, h1 * 2), 'parts': []}
    out['body1'] = down(body, w1, h1); out['body2'] = down(body, w1 * 2, h1 * 2)
    for pid, (p, pv) in pieces.items():
        out['parts'].append((pid, down(p, w1, h1), down(p, w1 * 2, h1 * 2), (round(pv[0] * k), round(pv[1] * k))))
    out['hip'] = (round(V['hip'][0] * k), round(V['hip'][1] * k))
    return out

def preview(res, path):
    # 조각을 몇 각도로 돌려 붙여 본다(rig.js poseFor의 대표 각도)
    tiles = []
    for v, R in res.items():
        for ang in ([0, -0.45, 0.3, -0.75] if v == 's' else [0, -0.4, 0.18, -0.75]):
            cv = Image.new('RGBA', (R['w'] * 2 + 160, R['h'] * 2 + 160), (58, 88, 58, 255))
            cv.alpha_composite(Image.fromarray(R['body2']), (80, 80))
            for pid, a1, a2, pv in R['parts']:
                deg = -(ang if pid == 'weapon' else ang * 1.5) * 57.3
                big = Image.new('RGBA', cv.size, (0, 0, 0, 0)); big.alpha_composite(Image.fromarray(a2), (80, 80))
                big = big.rotate(deg, center=(80 + pv[0] * 2, 80 + pv[1] * 2), resample=Image.Resampling.BICUBIC)
                cv.alpha_composite(big)
            tiles.append(cv)
    W = sum(t.width for t in tiles); Hh = max(t.height for t in tiles)
    sheet = Image.new('RGBA', (W, Hh), (20, 20, 20, 255)); x = 0
    for t in tiles: sheet.alpha_composite(t, (x, 0)); x += t.width
    os.makedirs(os.path.dirname(path), exist_ok=True); sheet.save(path)

def atlas_add(cells):
    ip = os.path.join(GFX, 'index.js'); s = open(ip, encoding='utf8').read()
    d = json.loads(re.search(r'RTD_GFX = (\{.*?\});', s).group(1))
    ap = os.path.join(GFX, 'atlas0.png'); atlas = np.array(Image.open(ap).convert('RGBA'))
    for k in cells: d.pop(k, None)
    # 빈 자리: 맨 아래 줄 오른쪽(기존 칸과 겹치지 않는 곳)을 찾는다
    rects = [(x, y, x + w, y + h) for (w, h, sh, x, y) in d.values() if sh == 0]
    def free(x, y, w, h): return all(x + w + 2 <= a or x >= c + 2 or y + h + 2 <= b or y >= e + 2 for (a, b, c, e) in rects)
    for k, im in cells.items():
        h, w = im.shape[:2]; spot = None
        for y in range(0, 2048 - h + 1, 2):
            for x in range(0, 2048 - w + 1, 2):
                if free(x, y, w, h): spot = (x, y); break
            if spot: break
        if not spot: raise SystemExit('아틀라스에 빈 자리 없음: ' + k)
        x, y = spot
        need = y + h
        if need > atlas.shape[0]: atlas = np.vstack([atlas, np.zeros((need - atlas.shape[0], atlas.shape[1], 4), np.uint8)])
        atlas[y:y + h, x:x + w] = im
        d[k] = [w, h, 0, x, y]; rects.append((x, y, x + w, y + h))
    Image.fromarray(atlas).save(ap, optimize=True)
    # 브라우저 캐시를 새로 받게 판 번호를 바꾼다(gfx/build.js와 같은 방식: 파일 크기에서)
    ver = (os.path.getsize(ap) * 31 + len(d)) % 4294967296
    s = re.sub(r'RTD_GFX = \{.*?\};', 'RTD_GFX = ' + json.dumps(d, separators=(',', ':'), ensure_ascii=False) + ';', s, count=1)
    s = re.sub(r'RTD_GFX_VER = "[^"]*"', 'RTD_GFX_VER = "' + np.base_repr(ver, 36).lower() + '"', s)
    open(ip, 'w', encoding='utf8', newline='\n').write(s)
    return {k: d[k] for k in cells}

def main():
    res = {v: build_view(v, V) for v, V in VIEWS.items()}
    if '--preview' in sys.argv:
        preview(res, os.path.join(ROOT, 'shots-v41-trial', 'masok_rig_preview.png')); print('preview'); return
    os.makedirs(ORIG, exist_ok=True)
    cells = {}
    for v, R in res.items():
        name = 'masok' + ('' if v == 'f' else '_s')
        one = posterize(dfr['defringe'](R['full1']))
        Image.fromarray(one).save(os.path.join(GFX, name + '.png'), optimize=True)
        cells[name] = one
        Image.fromarray(posterize(R['full2'])).save(os.path.join(GFX, 'hb_' + name + '.png'), optimize=True)
        for pid, a1, a2 in [('body', R['body1'], R['body2'])] + [(p[0], p[1], p[2]) for p in R['parts']]:
            fn = 'rig_b_masok_%s_%s.png' % (v, pid)
            Image.fromarray(a1).save(os.path.join(ORIG, fn), optimize=True)
            Image.fromarray(posterize(a2)).save(os.path.join(GFX, fn), optimize=True)
        print(v, 'w', R['w'], 'h', R['h'], 'hip', R['hip'], 'parts', [(p[0], p[3]) for p in R['parts']])
    print('atlas', atlas_add(cells))
    preview(res, os.path.join(ROOT, 'shots-v41-trial', 'masok_rig_preview.png'))

main()
