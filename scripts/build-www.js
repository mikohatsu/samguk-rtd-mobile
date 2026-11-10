// 앱에 넣을 게임 파일만 www/로 복사한다(서버 코드·설정은 빼고)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const files = ['config.js', 'theme-samguk.js', 'i18n-data.js', 'i18n.js', 'engine.js', 'raid.js', 'ai.js', 'art.js', 'audio.js', 'net.js', 'native.js', 'shop.js', 'palace.js', 'lobby.js', 'skillfx.js', 'rig.js', 'skillicons.js', 'sfxdata.js', 'tutorial.js', 'ui.js'];
// 첫 화면은 index.html이어야 한다
fs.copyFileSync(path.join(root, 'samguk-rtd.html'), path.join(out, 'index.html'));
files.forEach((f) => fs.copyFileSync(path.join(root, f), path.join(out, f)));
const copyDir = (d) => {
  fs.mkdirSync(path.join(out, d), { recursive: true });
  fs.readdirSync(path.join(root, d)).forEach((f) => {
    const s = path.join(root, d, f);
    if (fs.statSync(s).isDirectory()) copyDir(path.join(d, f)); else fs.copyFileSync(s, path.join(out, d, f));
  });
};
['gfx', 'fonts'].forEach(copyDir);
// 빠진 스크립트가 없는지: html이 부르는 src가 모두 있어야 한다
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const miss = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s) && !fs.existsSync(path.join(out, s)));
if (miss.length) { console.error('www에 없는 파일:', miss.join(', ')); process.exit(1); }
console.log('www 준비 완료');
