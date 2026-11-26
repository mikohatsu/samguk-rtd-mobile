// 앱에 넣을 게임 파일만 www/로 복사한다(서버 코드·설정은 빼고)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const files = ['config.js', 'version.js', 'det.js', 'theme-samguk.js', 'i18n-data.js', 'i18n.js', 'engine.js', 'raid.js', 'synergy.js', 'ai.js', 'art.js', 'audio.js', 'net.js', 'native.js', 'shop.js', 'progression.js', 'palace.js', 'lobby.js', 'skillfx.js', 'rig.js', 'skillicons.js', 'sfxdata.js', 'credits.js', 'news.js', 'tutorial.js', 'glctx.js', 'ui.js'];
// 첫 화면은 index.html이어야 한다
fs.copyFileSync(path.join(root, 'samguk-rtd.html'), path.join(out, 'index.html'));
files.forEach((f) => fs.copyFileSync(path.join(root, f), path.join(out, f)));
// gfx/에서 앱이 읽지 않는 것은 뺀다(서버·웹판 쪽 gfx/는 그대로 둔다):
//  - 아틀라스 재료 낱장: gfx/index.js에 이름이 있는 그림은 앱이 atlas*.png 한 장에서 잘라 쓴다(art.js). 낱장 파일은 부르지 않는다.
//  - 작업 파일: build.js(아틀라스 만드는 스크립트), map.txt·media.json(생성 작업 ID), _pilot.png(시험 그림)
//  - 어디서도 부르지 않는 옛 UI 그림: ui_big·ui_sort·ui_close(ic_close로 바뀜)
// 라이선스 파일(KENNEY_LICENSE.txt, CREDITS.txt)은 남긴다.
const gfxAtlas = (() => { const w = {}; new Function('window', fs.readFileSync(path.join(root, 'gfx', 'index.js'), 'utf8'))(w); return w.RTD_GFX || {}; })();
const GFX_SKIP = new Set(['build.js', 'map.txt', 'media.json', '_pilot.png', 'ui_big.png', 'ui_sort.png', 'ui_close.png']);
const skip = (d, f) => d === 'gfx' && (GFX_SKIP.has(f) || (/\.png$/.test(f) && gfxAtlas[f.slice(0, -4)] && !/^atlas\d+\.png$/.test(f)));
const copyDir = (d) => {
  fs.mkdirSync(path.join(out, d), { recursive: true });
  fs.readdirSync(path.join(root, d)).forEach((f) => {
    const s = path.join(root, d, f);
    if (fs.statSync(s).isDirectory()) copyDir(path.join(d, f)); else if (!skip(d, f)) fs.copyFileSync(s, path.join(out, d, f));
  });
};
['gfx', 'fonts', 'bgm'].forEach(copyDir);
// 빠진 그림이 없는지: 앱 파일에 글자 그대로 적힌 gfx/이름.확장자가 모두 www에 있어야 한다. 이름을 조합해 부르는 그림(rig_·kn_·il_·map_·vs_·fxa_ 등)은 빼는 대상이 아니라 그대로 들어간다
const allSrc = ['index.html'].concat(files).map((f) => fs.readFileSync(path.join(out, f), 'utf8')).join('\n');
const missG = [...new Set([...allSrc.matchAll(/gfx\/([A-Za-z0-9_]+\.(?:png|jpg|js|txt))/g)].map((m) => m[1]))].filter((n) => !fs.existsSync(path.join(out, 'gfx', n)));
if (missG.length) { console.error('www/gfx에 없는 그림:', missG.join(', ')); process.exit(1); }
// 빠진 스크립트가 없는지: html이 부르는 src가 모두 있어야 한다
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const miss = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s) && !fs.existsSync(path.join(out, s)));
if (miss.length) { console.error('www에 없는 파일:', miss.join(', ')); process.exit(1); }
console.log('www 준비 완료');
