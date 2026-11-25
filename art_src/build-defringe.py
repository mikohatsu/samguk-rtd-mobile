# 캐릭터 그림(장수·보스·라인 몹)의 흰 배경 오려 내기 잔여 흰 테두리(halo/fringe)를 없앤다. 그림을 새로 그리지 않고 가장자리만 가공한다.
#   python art_src/build-defringe.py            gfx/atlas0.png(캐릭터 칸만)과 gfx/rig_*.png를 고친다. 처음 한 번 원본을 art_src/defringe_orig/에 보관한다.
#   python art_src/build-defringe.py --preview  고치지 않고 전후 비교 그림만 만든다(shots-v40-boss/defringe_*.png)
# gfx/build.js로 아틀라스를 다시 만들면 이 단계가 사라지므로 그 뒤에 다시 돌린다(원본 보관 폴더를 지워야 새 원본을 다시 보관한다).
# 방법(가장자리에서 안쪽으로 R픽셀 띠만):
#  1) 안쪽부터 바깥으로 한 겹씩, 더 안쪽 이웃 픽셀들의 평균색 F를 '진짜 색'으로 본다.
#  2) 원래 색 C가 F와 흰색의 섞임(C = (1-k)F + k*255)이라 보고 k를 구한다(F가 이미 밝은 흰 옷·수염이면 k≈0이라 그대로 남는다).
#  3) 색은 F로 바꾸고(디프린지), 투명도는 (1-k)배로 줄인다. 맨 바깥 한 겹은 투명도를 한 번 더 줄인다(1px 침식).
import sys, os, re, json, shutil, glob
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GFX = os.path.join(ROOT, 'gfx')
ORIG = os.path.join(ROOT, 'art_src', 'defringe_orig')
R = 3

def ring_dist(a):
    m = a > 0
    d = np.zeros(a.shape, np.int32)
    cur = m.copy()
    for r in range(1, R + 2):
        p = np.pad(cur, 1, constant_values=False)
        inner = cur & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        d[cur & ~inner] = r
        cur = inner
    d[cur] = R + 2  # 더 안쪽
    return d

def comps(mask):
    H, W = mask.shape; lab = np.zeros((H, W), bool); out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        lab[y0, x0] = True; st = [(y0, x0)]; pts = []
        while st:
            a, b = st.pop(); pts.append((a, b))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = a + dy, b + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]: lab[yy, xx] = True; st.append((yy, xx))
        out.append(pts)
    return out

def pockets(im):
    # 몸 안쪽에 갇혀 오려지지 않은 흰 배경(활과 시위 사이, 깃털과 머리 사이 등): 거의 순백(250 이상이 80% 넘음)이고
    # 둘레가 어두운 외곽선(밝기 160 미만, 채도 46 미만)인 덩어리만 지운다. 둘레가 밝거나 색이 진하면(번개·불꽃의 흰 심, 흰 옷) 그대로 둔다.
    rgb = im[..., :3].astype(int); a = im[..., 3]
    wh = (a > 200) & (rgb.min(2) > 226) & ((rgb.max(2) - rgb.min(2)) < 28)
    n = 0
    for p in comps(wh):
        if len(p) < 16: continue
        ys, xs = map(np.array, zip(*p))
        if (rgb[ys, xs].min(1) >= 250).mean() <= 0.8: continue
        m = np.zeros(wh.shape, bool); m[ys, xs] = True; dm = m.copy()
        for _ in range(2):
            q = np.pad(dm, 1); dm = dm | q[:-2, 1:-1] | q[2:, 1:-1] | q[1:-1, :-2] | q[1:-1, 2:]
        bd = dm & ~m & (a > 50)  # 투명한 쪽(잘린 조각의 열린 면)은 둘레 색에서 뺀다
        if not bd.any(): im[ys, xs, 3] = 0; n += 1; continue
        L = rgb[bd].mean(1).mean(); S = (rgb[bd].max(1) - rgb[bd].min(1)).mean()
        if L < 160 and S < 46: im[ys, xs, 3] = 0; n += 1
    return n

def defringe(im):
    im = im.copy(); pockets(im)
    px = im.astype(np.float32)
    a = px[..., 3].copy()
    rgb = px[..., :3].copy()
    d = ring_dist(px[..., 3])
    out = rgb.copy()
    H, W = a.shape
    for r in range(R, 0, -1):
        ys, xs = np.nonzero(d == r)
        if not len(ys): continue
        acc = np.zeros((len(ys), 3), np.float32); n = np.zeros(len(ys), np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not dy and not dx: continue
                yy = np.clip(ys + dy, 0, H - 1); xx = np.clip(xs + dx, 0, W - 1)
                ok = (d[yy, xx] > r)
                acc += out[yy, xx] * ok[:, None]; n += ok
        has = n > 0
        C = rgb[ys, xs]
        # 안쪽이 없는 가는 부분(수염 끝·창끝 등): 같은 겹의 밝지 않은 이웃 색을 쓴다
        acc2 = np.zeros((len(ys), 3), np.float32); n2 = np.zeros(len(ys), np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not dy and not dx: continue
                yy = np.clip(ys + dy, 0, H - 1); xx = np.clip(xs + dx, 0, W - 1)
                ok = (d[yy, xx] >= 1) & (rgb[yy, xx].min(axis=1) < 150)
                acc2 += rgb[yy, xx] * ok[:, None]; n2 += ok
        F = np.where(has[:, None], acc / np.maximum(n, 1)[:, None], np.where((n2 > 0)[:, None], acc2 / np.maximum(n2, 1)[:, None], C))
        room = 255.0 - F
        kk = np.where(room > 24, (C - F) / np.maximum(room, 1), np.nan)
        k = np.nanmean(np.where(np.isnan(kk), np.nan, kk), axis=1)
        k = np.nan_to_num(k, nan=0.0)
        # 밝게 섞인 것만(어두워진 외곽 먹선은 그대로). 원래 색이 충분히 밝을 때만 흰 섞임으로 본다
        light = C.min(axis=1) > 120
        k = np.clip(k, 0, 1) * light
        # 이웃이 모두 밝은 외톨이 흰 점(안쪽도 비교할 색도 없음)은 거의 지운다
        k = np.where(~has & (n2 == 0) & (C.min(axis=1) > 200), 0.7, k)
        out[ys, xs] = np.where((k > 0.04)[:, None], F, C)
        a[ys, xs] = a[ys, xs] * (1 - k)
        if r == 1:
            # 맨 바깥 한 겹: 밝게 남은 픽셀은 투명도를 한 번 더 줄인다(1px 침식)
            a[ys, xs] = np.where(C.min(axis=1) > 150, a[ys, xs] * 0.45, a[ys, xs])
    # 띠 밖(안쪽)에 남은 반투명 흰 픽셀도 배경 찌꺼기다(오려 내기는 가장자리에만 반투명을 만들었다)
    semi = (a < 128) & (out.min(axis=2) > 200)
    a[semi] *= 0.3
    res = np.dstack([np.clip(out, 0, 255), np.clip(a, 0, 255)]).astype(np.uint8)
    res[res[..., 3] < 6] = 0
    return res

def atlas_ids():
    s = open(os.path.join(GFX, 'index.js'), encoding='utf8').read()
    d = json.loads(re.search(r'RTD_GFX = (\{.*?\});', s).group(1))
    return {k: v for k, v in d.items() if not re.match(r'^(fx_|tex_|prop_)', k)}

def save_orig(path):
    os.makedirs(ORIG, exist_ok=True)
    dst = os.path.join(ORIG, os.path.basename(path))
    if not os.path.exists(dst): shutil.copy2(path, dst)
    return dst

def preview(pairs, name):
    # 어두운 바닥 위에 4배로 키워 전후를 나란히
    tiles = []
    for before, after in pairs:
        h, w = before.shape[:2]
        row = Image.new('RGBA', (w * 2 + 8, h), (40, 44, 38, 255))
        row.alpha_composite(Image.fromarray(before), (0, 0)); row.alpha_composite(Image.fromarray(after), (w + 8, 0))
        tiles.append(row.resize((row.width * 2, row.height * 2), Image.Resampling.NEAREST))
    W = max(t.width for t in tiles); Hh = sum(t.height + 8 for t in tiles)
    sheet = Image.new('RGBA', (W, Hh), (20, 20, 20, 255)); y = 0
    for t in tiles: sheet.alpha_composite(t, (0, y)); y += t.height + 8
    os.makedirs(os.path.join(ROOT, 'shots-v40-boss'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'shots-v40-boss', name))

def main():
    pv = '--preview' in sys.argv
    ids = atlas_ids()
    ap = os.path.join(GFX, 'atlas0.png')
    src = ap if pv else save_orig(ap)
    atlas = np.array(Image.open(src).convert('RGBA'))
    pairs = []
    for k, (w, h, s, x, y) in ids.items():
        if s != 0: continue
        cell = atlas[y:y + h, x:x + w]
        new = defringe(cell)
        if k in ('dongtak', 'yeopo', 'deungae', 'hwangchung', 'janggak', 'wave3'): pairs.append((cell.copy(), new))
        atlas[y:y + h, x:x + w] = new
    preview(pairs, 'defringe_atlas.png')
    rp = []
    for p in sorted(glob.glob(os.path.join(GFX, 'rig_*.png'))):
        src = p if pv else save_orig(p)
        im = np.array(Image.open(src).convert('RGBA'))
        new = defringe(im)
        if 'dongtak_f_body' in p or 'yeopo_f_body' in p: rp.append((im.copy(), new))
        if not pv: Image.fromarray(new).save(p, optimize=True)
    preview(rp, 'defringe_rig.png')
    if not pv: Image.fromarray(atlas).save(ap, optimize=True)
    print('done', len(ids), 'atlas cells', 'preview' if pv else 'written')

main()
