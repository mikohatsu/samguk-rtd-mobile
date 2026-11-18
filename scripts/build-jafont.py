"""일본어 표시용 글꼴(Dela Gothic One·Zen Antique는 SIL OFL, 붓글씨는 衡山毛筆フォント)을 게임에 쓰는 글자만 남겨 fonts/ja-*.woff2로 만든다.
사용: python scripts/build-jafont.py art_src/fonts_src   (fonttools, brotli 필요. 원본 ttf는 git에 없음: Google Fonts ofl/delagothicone·ofl/zenantique, opentype.jp/bin/KouzanMouhituFont.zip)
원본: DelaGothicOne-Regular.ttf(굵은 제목), KouzanMouhitu.ttf(붓글씨: 衡山毛筆フォント, 무료·상업 이용 제한 없음, https://opentype.jp/kouzanmouhitufont.htm), ZenAntique-Regular.ttf(고풍 명조)
글자는 i18n.js·i18n-data.js·theme-samguk.js·lobby.js·news.js·credits.js·shop.js·src/ui/01-setup.js·src/ui/15-pad.js·samguk-rtd.html에 나오는 가나·한자·전각 기호 전부. 문구를 바꾸면 다시 돌린다.
쓰는 곳: i18n.js가 일본어일 때만 한국어 글꼴 이름에 이 파일들을 덧붙인다(jaFonts)."""
import sys, os, re
from fontTools import subset
from fontTools.ttLib import TTFont
src = sys.argv[1]
root = os.path.join(os.path.dirname(__file__), '..')
text = ''.join(open(os.path.join(root, f), encoding='utf-8').read() for f in ['i18n.js', 'i18n-data.js', 'theme-samguk.js', 'lobby.js', 'news.js', 'credits.js', 'shop.js', 'src/ui/01-setup.js', 'src/ui/15-pad.js', 'samguk-rtd.html'] if os.path.exists(os.path.join(root, f)))
chars = sorted(set(re.findall(r'[　-ヿ一-鿿＀-￯]', text)))
print('글자 수', len(chars))
for out, f in [('ja-display', 'DelaGothicOne-Regular.ttf'), ('ja-brush', 'KouzanMouhitu.ttf'), ('ja-serif', 'ZenAntique-Regular.ttf')]:
    font = TTFont(os.path.join(src, f))
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['kern', 'palt', 'vert']; opt.name_IDs = ['*']; opt.notdef_outline = True; opt.drop_tables += ['gasp']  # 衡山毛筆의 gasp 표가 깨져 있어 읽으면 오류(힌팅용이라 빼도 표시는 같다)
    s = subset.Subsetter(opt); s.populate(unicodes=[ord(c) for c in chars]); s.subset(font)
    dst = os.path.join(root, 'fonts', out + '.woff2')
    font.flavor = 'woff2'; font.save(dst)
    have = len(font.getBestCmap())
    print(f'{out:11s} {have}/{len(chars)}자 {os.path.getsize(dst)//1024}KB')
