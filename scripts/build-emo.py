# 협동 채팅 이모티콘: Canva로 만든 2x2 시트(art_src/emo_sheet*.png, 흰 배경)를 잘라 gfx/emo_<id>.png(투명 배경 256px)로 만든다.
# 흰 배경은 시트 가장자리에서 이어진 거의 흰 칸만 지운다(flood fill). 그림 안의 흰 부분(깃털·눈물·김)은 외곽선이 막아 남는다.
# 쓰는 법: python scripts/build-emo.py   (시트가 있는 것만 만든다)
import os
from collections import deque
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
SHEETS = {
    'emo_sheet1.png': ['laugh', 'cry', 'angry', 'wow'],   # 조조 웃음, 유비 울음, 장비 화남, 조운 놀람
    'emo_sheet2.png': ['good', 'help', 'thanks', 'think'],  # 관우 엄지, 마초 도와줘, 손책 포권, 제갈량 생각
}
OUT = 256
WHITE = 236  # 이보다 밝은(세 채널 모두) 칸을 배경 후보로 본다


def cut(cell):
    im = cell.convert('RGBA')
    w, h = im.size
    px = im.load()
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if bg[i]:
            continue
        r, g, b, _ = px[x, y]
        if min(r, g, b) < WHITE:
            continue
        bg[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    # 그림에 둘러싸인 배경 틈(손책 끈과 어깨 사이 등): 가장자리와 안 이어진 흰 덩어리 가운데 색이 고르게 순백인 것만 지운다.
    # 그림의 흰 부분(깃털·옷·부채)은 음영이 있어 표준편차가 3 이상이다(2026-11-28 시트 측정: 배경 틈 254.9±1.3, 그림 흰 부분 246~252±3~5).
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            i0 = sy * w + sx
            if bg[i0] or seen[i0] or min(px[sx, sy][:3]) < WHITE:
                continue
            pts, q2 = [], deque([(sx, sy)]); seen[i0] = 1
            while q2:
                x, y = q2.popleft(); pts.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and not bg[ny * w + nx] and min(px[nx, ny][:3]) >= WHITE:
                        seen[ny * w + nx] = 1; q2.append((nx, ny))
            if len(pts) < 300:
                continue
            vals = [v for p in pts for v in px[p[0], p[1]][:3]]
            mean = sum(vals) / len(vals); sd = (sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5
            if mean >= 254 and sd <= 2:
                for x, y in pts:
                    bg[y * w + x] = 1
    mask = Image.new('L', (w, h), 255)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if bg[y * w + x]:
                mp[x, y] = 0
    # 가장자리 흰 테 줄이기: 한 칸 줄이고 살짝 부드럽게
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(mask)
    box = mask.point(lambda v: 255 if v > 16 else 0).getbbox()
    im = im.crop(box)
    side = max(im.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.size[0]) // 2, side - im.size[1]))  # 아래 맞춤(가슴까지 잘린 그림)
    return sq.resize((OUT, OUT), Image.Resampling.LANCZOS)


for sheet, ids in SHEETS.items():
    p = os.path.join(ROOT, 'art_src', sheet)
    if not os.path.exists(p):
        continue
    s = Image.open(p).convert('RGB')
    W, H = s.size
    for k, eid in enumerate(ids):
        cx, cy = k % 2, k // 2
        cell = s.crop((cx * W // 2, cy * H // 2, (cx + 1) * W // 2, (cy + 1) * H // 2))
        out = os.path.join(ROOT, 'gfx', 'emo_' + eid + '.png')
        cut(cell).save(out, optimize=True)
        print('emo_' + eid + '.png', os.path.getsize(out), 'B')
