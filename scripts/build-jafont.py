"""한자·가나를 쓰는 언어의 부분 글꼴을 만든다(게임에 쓰는 글자만 남긴다). 문구에 새 한자가 생기면 다시 돌린다.
사용: python scripts/build-jafont.py art_src/fonts_src   (fonttools, brotli 필요. 원본은 git에 없음 — 아래 받는 곳)

만드는 파일(fonts/):
  일본어 — i18n.js가 일본어일 때 한국어 글꼴 이름에 덧붙인다
    ja-display.woff2  Dela Gothic One(OFL)              + 원본에 없는 글자는 Noto Sans JP Black(OFL)로 채움(郃·傕 등)
    ja-brush.woff2    衡山毛筆フォント(OFL 아님, 무료·상업 이용 가능)   — 라이선스가 달라 다른 글꼴 글자를 섞지 않는다
    ja-serif.woff2    Zen Antique(OFL)                  + Noto Serif JP Medium(OFL)로 채움(瓚·褚·詡·龐 등)
  중국어(간체) — i18n.js가 중국어일 때 덧붙인다(같은 방식)
    zh-display.woff2  Noto Sans SC Black(OFL)
    zh-brush.woff2    Ma Shan Zheng(OFL)  — 간체 상용자만 있다. 번체 표식 글자 등 없는 글자는 다음 글꼴(굵은 고딕)로 넘어간다
                      (붓글씨는 로고·출정 버튼·등급 글자에만 쓰여 채우지 않는다: 채우면 400자 가까이 늘어난다)
    zh-serif.woff2    Noto Serif SC Regular(OFL)        (Gowun Batang 400 자리)
    zh-serif-b.woff2  Noto Serif SC Bold(OFL)           (Gowun Batang 700·Noto Serif KR 700/900 자리)
  모든 언어 — fonts.css에 'Noto Serif KR' 700/900 보충 글꼴로 적는다(아래 표시 사이를 이 스크립트가 다시 쓴다)
    kr-serif-x7.woff2 / kr-serif-x9.woff2  Noto Serif TC Bold/Black: 구글의 Noto Serif KR 사본에 없는 한자 중
                      언어와 상관없이 나오는 것(theme-samguk.js·src/ui·samguk-rtd.html의 한자: 신화·불멸 등장의 한문 명대사, 장수 표식 글자 —
                      兔·教·為·瘁·褚·詡·郃 등). 일본어·중국어 문구의 한자는 각 언어 파일이 맡는다

글자는 루트의 *.js(ui.js 제외)·src/ui/*.js·samguk-rtd.html에 나오는 한자·가나·전각 기호 전부(파일을 하나씩 적지 않는다:
예전에는 목록에 없는 파일의 글자가 빠졌다). 같은 글자 집합으로 모든 파일을 만든다(중국어 파일은 가나를 뺀다).

원본 받는 곳(art_src/fonts_src/에 둔다):
  Google Fonts 저장소 github.com/google/fonts — ofl/delagothicone/DelaGothicOne-Regular.ttf, ofl/zenantique/ZenAntique-Regular.ttf,
  ofl/mashanzheng/MaShanZheng-Regular.ttf, ofl/notosansjp/NotoSansJP[wght].ttf, ofl/notoserifjp/NotoSerifJP[wght].ttf,
  ofl/notosanssc/NotoSansSC[wght].ttf, ofl/notoserifsc/NotoSerifSC[wght].ttf, ofl/notoseriftc/NotoSerifTC[wght].ttf
  衡山毛筆: opentype.jp/bin/KouzanMouhituFont.zip (https://opentype.jp/kouzanmouhitufont.htm)
"""
import sys, os, re, glob
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen

src = sys.argv[1]
root = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
FONTS = os.path.join(root, 'fonts')

# ---- 글자 모으기 ----
files = [f for f in glob.glob(os.path.join(root, '*.js')) if os.path.basename(f) != 'ui.js']
files += sorted(glob.glob(os.path.join(root, 'src', 'ui', '*.js'))) + [os.path.join(root, 'samguk-rtd.html')]
text = ''.join(open(f, encoding='utf-8').read() for f in files)
CJK = re.compile(r'[　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]')
chars = sorted(set(CJK.findall(text)))
cps = [ord(c) for c in chars]
KANA = lambda cp: 0x3041 <= cp <= 0x30ff and cp != 0x30fb  # 중국어 파일에서 뺀다(가운뎃점 ・ 은 남김)
HAN = lambda cp: 0x3400 <= cp <= 0x9fff or 0xf900 <= cp <= 0xfaff
print('글자 수', len(chars), '(한자', sum(map(HAN, cps)), ')')

_cache = {}
def load(name, wght=None, want=None):
    """원본 글꼴. 가변 글꼴이면 want 글자만 남긴 뒤 굵기를 고정한다."""
    key = (name, wght, tuple(want) if want else None)
    if key in _cache: return _cache[key]
    f = TTFont(os.path.join(src, name))
    if 'fvar' in f:
        have = f.getBestCmap()
        o = subset.Options(); o.layout_features = ['kern', 'palt', 'vert']; o.name_IDs = ['*']; o.notdef_outline = True
        s = subset.Subsetter(o); s.populate(unicodes=[c for c in (want or cps) if c in have]); s.subset(f)
        f = instancer.instantiateVariableFont(f, {'wght': wght})
    _cache[key] = f
    return f

def cut(font, want):
    o = subset.Options(); o.flavor = 'woff2'; o.layout_features = ['kern', 'palt', 'vert']; o.name_IDs = ['*']; o.notdef_outline = True
    o.drop_tables += ['gasp', 'hdmx', 'LTSH', 'VDMX', 'DSIG']  # 衡山毛筆의 gasp 표가 깨져 있어 읽으면 오류(힌팅용이라 빼도 표시는 같다)
    s = subset.Subsetter(o); s.populate(unicodes=want); s.subset(font)
    return font

def fill(base, filler, want):
    """base에 없는 글자를 filler의 윤곽으로 채운다(둘 다 OFL일 때만 쓴다). 넣은 글자를 돌려준다."""
    have, fcm = base.getBestCmap(), filler.getBestCmap()
    need = [c for c in want if c not in have and c in fcm]
    if not need: return []
    gs = filler.getGlyphSet(); k = base['head'].unitsPerEm / filler['head'].unitsPerEm
    glyf, hmtx = base['glyf'], base['hmtx']
    vmtx = base['vmtx'] if 'vmtx' in base else None
    fv = filler['vmtx'] if 'vmtx' in filler else None
    order = list(base.getGlyphOrder())
    for c in need:
        g, name = fcm[c], 'fill%04X' % c
        rec = DecomposingRecordingPen(gs); gs[g].draw(rec)
        pen = TTGlyphPen(None); rec.replay(TransformPen(pen, (k, 0, 0, k, 0, 0)) if k != 1 else pen)
        gl = pen.glyph(); gl.recalcBounds(glyf)
        glyf.glyphs[name] = gl; order.append(name)
        hmtx.metrics[name] = (round(filler['hmtx'][g][0] * k), getattr(gl, 'xMin', 0))
        if vmtx is not None:
            vmtx.metrics[name] = (round(fv[g][0] * k), round(fv[g][1] * k)) if fv is not None and g in fv.metrics else (base['head'].unitsPerEm, 0)
        for t in base['cmap'].tables:
            if t.isUnicode(): t.cmap[c] = name
    base.setGlyphOrder(order); glyf.glyphOrder = order
    return [chr(c) for c in need]

def save(font, out, want):
    dst = os.path.join(FONTS, out + '.woff2')
    before = os.path.getsize(dst) if os.path.exists(dst) else 0
    font.flavor = 'woff2'; font.save(dst)
    have = font.getBestCmap()
    miss = ''.join(chr(c) for c in want if c not in have)
    print(f'{out:12s} {sum(1 for c in want if c in have)}/{len(want)}자 {before // 1024}KB → {os.path.getsize(dst) // 1024}KB' + (f'  없음: {miss}' if miss else ''))
    return dst

# ---- 일본어 ----
for out, base, filler in [('ja-display', 'DelaGothicOne-Regular.ttf', ('NotoSansJP[wght].ttf', 900)),
                          ('ja-brush', 'KouzanMouhitu.ttf', None),
                          ('ja-serif', 'ZenAntique-Regular.ttf', ('NotoSerifJP[wght].ttf', 500))]:
    f = cut(TTFont(os.path.join(src, base)), cps)
    added = fill(f, load(filler[0], filler[1]), cps) if filler else []
    save(f, out, cps)
    if added: print('   채움', len(added), ''.join(added))

# ---- 중국어 ----
zcps = [c for c in cps if not KANA(c)]
for out, base, w, filler in [('zh-display', 'NotoSansSC[wght].ttf', 900, None),
                             ('zh-brush', 'MaShanZheng-Regular.ttf', None, None),
                             ('zh-serif', 'NotoSerifSC[wght].ttf', 400, None),
                             ('zh-serif-b', 'NotoSerifSC[wght].ttf', 700, None)]:
    f = load(base, w, zcps) if w else TTFont(os.path.join(src, base))
    f = cut(f, zcps)
    have = f.getBestCmap(); dst = os.path.join(FONTS, out + '.woff2'); before = os.path.getsize(dst) if os.path.exists(dst) else 0
    f.flavor = 'woff2'; f.save(dst)
    print(f'{out:12s} {sum(1 for c in zcps if c in have)}/{len(zcps)}자 {before // 1024}KB → {os.path.getsize(dst) // 1024}KB')

# ---- Noto Serif KR 보충(모든 언어) ----
css_path = os.path.join(FONTS, 'fonts.css')
css = open(css_path, encoding='utf-8').read()
BEGIN, END = '/* kr-serif-x: build-jafont.py가 만든다', '/* /kr-serif-x */'
css = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n?', '', css, flags=re.S)
def urange(s):
    out = set()
    for p in s.split(','):
        p = p.strip().upper().replace('U+', '')
        if '-' in p: a, b = p.split('-'); out.update(range(int(a, 16), int(b, 16) + 1))
        elif p: out.add(int(p, 16))
    return out
kr = set()
for blk in re.findall(r'@font-face\s*\{(.*?)\}', css, re.S):
    if "'Noto Serif KR'" in blk and 'font-weight: 900' in blk:
        url = re.search(r'url\(([^)]+)\)', blk).group(1)
        kr |= set(TTFont(os.path.join(FONTS, url)).getBestCmap()) & urange(re.search(r'unicode-range:\s*([^;]+);', blk).group(1))
neutral = ''.join(open(f, encoding='utf-8').read() for f in [os.path.join(root, 'theme-samguk.js'), os.path.join(root, 'samguk-rtd.html')] + sorted(glob.glob(os.path.join(root, 'src', 'ui', '*.js'))))
tc = load('NotoSerifTC[wght].ttf', 900).getBestCmap()
xs = sorted(c for c in set(map(ord, CJK.findall(neutral))) if HAN(c) and c not in kr and c in tc)
rules = []
if xs:
    for w, out in [(700, 'kr-serif-x7'), (900, 'kr-serif-x9')]:
        save(cut(load('NotoSerifTC[wght].ttf', w, xs), xs), out, xs)
        rng = ', '.join('U+%04x' % c for c in xs)
        rules.append(f"@font-face {{\n  font-family: 'Noto Serif KR';\n  font-style: normal;\n  font-weight: {w};\n  font-display: swap;\n  src: url({out}.woff2) format('woff2');\n  unicode-range: {rng};\n}}\n")
    print('Noto Serif KR 보충', len(xs), ''.join(map(chr, xs)))
css = css.rstrip('\n') + '\n\n' + BEGIN + ' — 구글 사본 Noto Serif KR에 없는 한자를 Noto Serif TC/JP(OFL)로 채움. 손으로 고치지 않는다 */\n' + ''.join(rules) + END + '\n'
open(css_path, 'w', encoding='utf-8', newline='\n').write(css)
