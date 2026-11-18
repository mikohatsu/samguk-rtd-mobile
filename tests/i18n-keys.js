// 문구 열쇠 대조 시험: 코드가 부르는 t('열쇠')·I.t·C.t·L('열쇠')·data-i18n·엔진의 this.L('열쇠')를 전부 뽑아
// i18n.js의 문구표(S)와 lobby.js의 로비 문구표(S)에 있는지 본다. 없는 열쇠는 화면에 열쇠 이름이 그대로 보인다.
// 거꾸로 문구표에는 있는데 코드 어디에도 글자로 나오지 않는 열쇠(쓰이지 않는 문구 후보)도 적는다.
// 또 4개 언어 칸이 비었거나 {변수}가 언어마다 다른 줄을 찾는다.
// 쓰는 법: node tests/i18n-keys.js   (게임 코드는 읽기만 한다)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const Q1 = "'", Q2 = '"', Q3 = '`';

// 문구표를 소스에서 그대로 잘라 읽는다: "const S = {" 부터 짝이 맞는 "}" 까지
function tableOf(src) {
  const i = src.indexOf('const S = {'); if (i < 0) throw new Error('문구표를 찾지 못함');
  const a = src.indexOf('{', i);
  let d = 0, j = a, q = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
    if (c === Q1 || c === Q2 || c === Q3) { q = c; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) break; }
  }
  return vm.runInNewContext('(' + src.slice(a, j + 1) + ')');
}
const i18nSrc = rd('i18n.js'), lobbySrc = rd('lobby.js');
const SI = tableOf(i18nSrc), SL = tableOf(lobbySrc);
ok(Object.keys(SI).length > 300 && Object.keys(SL).length > 50, `문구표 읽음: i18n.js ${Object.keys(SI).length}개, lobby.js ${Object.keys(SL).length}개`);

// 호출에서 첫 인자를 잘라 그 안의 글자 상수를 모은다(삼항식의 양쪽 모두). 'a' + x 꼴은 앞머리(prefix)로 따로 모은다.
function calls(src, re) {
  const keys = new Map(), pre = new Map(), dyn = [];
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, d = 0, q = null, arg = '';
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { arg += c; if (c === '\\') { arg += src[++i]; } else if (c === q) q = null; continue; }
      if (c === Q1 || c === Q2 || c === Q3) { q = c; arg += c; continue; }
      if (c === '(' || c === '[' || c === '{') d++;
      if (c === ')' || c === ']' || c === '}') { if (!d) break; d--; }
      if (c === ',' && !d) break;
      arg += c;
    }
    const line = src.slice(0, m.index).split('\n').length;
    // 비교식의 글자(kind === 'skin' ? ...)는 열쇠가 아니므로 뺀다
    const lits = [...arg.replace(/[!=]==?\s*'[A-Za-z0-9_]*'/g, '').matchAll(/'([A-Za-z0-9_]+)'/g)].map((x) => x[1]);
    if (!lits.length) { if (arg.trim()) dyn.push({ line, arg: arg.trim().slice(0, 60) }); continue; }
    if (/'\s*\+/.test(arg)) lits.forEach((k) => pre.set(k, line));
    else lits.forEach((k) => { if (!keys.has(k)) keys.set(k, line); });
  }
  return { keys, pre, dyn };
}
const uiFiles = fs.readdirSync(path.join(ROOT, 'src', 'ui')).filter((f) => /\.js$/.test(f)).map((f) => 'src/ui/' + f);
const iFiles = uiFiles.concat(['tutorial.js', 'net.js', 'lobby.js', 'engine.js', 'raid.js', 'native.js', 'audio.js', 'skillfx.js', 'art.js', 'rig.js', 'ai.js', 'shop.js', 'palace.js']);
const missI = [], dynI = [], preI = new Set();
for (const f of iFiles) {
  const src = rd(f);
  // 화면 코드: t( · I.t( · C.t( · L.t( · N.t( · tt( · c.t(  / 엔진: this.L(
  const res = [/(?<![A-Za-z0-9_$.])t\(/g, /\b(?:I|C|L|N|c|ctx|RTD_I18N)\.t\(/g, /(?<![A-Za-z0-9_$.])tt\(/g];
  if (f === 'engine.js' || f === 'raid.js') res.push(/\bthis\.L\(/g, /\bg\.L\(/g);
  for (const re of res) {
    const r = calls(src, re);
    r.keys.forEach((line, k) => { if (!SI[k]) missI.push(`${f}:${line} ${k}`); });
    r.pre.forEach((line, k) => preI.add(k));
    r.dyn.forEach((d) => dynI.push(`${f}:${d.line} ${d.arg}`));
  }
}
// 튜토리얼 단계의 k: '열쇠' 와 '(tut|tip|gift)_...' 글자
{
  const src = rd('tutorial.js');
  [...src.matchAll(/\bk: (?:\(c\) => \[)?'([A-Za-z0-9_]+)'/g), ...src.matchAll(/'((?:tut|tip|gift)_[A-Za-z0-9_]+)'/g)].forEach((m) => {
    if (!SI[m[1]] && !/_$/.test(m[1])) missI.push(`tutorial.js:${src.slice(0, m.index).split('\n').length} ${m[1]}`);
    if (/_$/.test(m[1])) preI.add(m[1]);
  });
}
// html의 data-i18n, data-i18n-ph
{
  const src = rd('samguk-rtd.html');
  [...src.matchAll(/data-i18n(?:-ph)?="([A-Za-z0-9_]+)"/g)].forEach((m) => { if (!SI[m[1]]) missI.push(`samguk-rtd.html:${src.slice(0, m.index).split('\n').length} ${m[1]}`); });
}
ok(missI.length === 0, `i18n.js에 없는 열쇠를 부르는 곳 ${missI.length}건` + (missI.length ? '\n     ' + [...new Set(missI)].join('\n     ') : ''));

// 로비 문구표 L('열쇠')
const rl = calls(lobbySrc, /(?<![A-Za-z0-9_$.])L\(/g), missL = [];
rl.keys.forEach((line, k) => { if (!SL[k]) missL.push(`lobby.js:${line} ${k}` + (SI[k] ? ' (i18n.js에는 있음: L이 아니라 C.t로 불러야 함)' : '')); });
ok(missL.length === 0, `lobby.js 문구표에 없는 열쇠를 L()로 부르는 곳 ${missL.length}건` + (missL.length ? '\n     ' + missL.join('\n     ') : ''));

// 앞머리로 만드는 열쇠('err_' + e 등): 앞머리로 시작하는 열쇠가 하나라도 있는지
const badPre = [...preI].filter((p) => !Object.keys(SI).some((k) => k.startsWith(p)) && !SI[p]);
ok(badPre.length === 0, `앞머리로 만드는 열쇠(${[...preI].join(', ')}) 가운데 문구가 하나도 없는 것 ${badPre.length}건 ${badPre.join(', ')}`);
console.log('INFO 열쇠가 변수라 대조하지 못한 호출 ' + dynI.length + '건:\n     ' + dynI.join('\n     '));
const lobbyPre = [...rl.pre.keys()];
console.log('INFO lobby.js L() 변수 호출:\n     ' + rl.dyn.map((d) => `lobby.js:${d.line} ${d.arg}`).concat(lobbyPre.map((k) => `앞머리 '${k}'`)).join('\n     '));

// 서버가 돌려주는 error 값 → err_<값> 문구가 있는지(없으면 errText가 영어 열쇠 글자를 그대로 보여 준다)
{
  const src = rd('server/app.js'), errs = new Set([...src.matchAll(/error: '([a-z_]+)'/g)].map((m) => m[1]));
  const no = [...errs].filter((e) => !SI['err_' + e]);
  ok(no.length === 0, `서버 오류 값 ${errs.size}종 가운데 err_ 문구가 없는 것 ${no.length}건: ${no.join(', ')}`);
}

// 언어 칸: 4칸이 다 찼는지, {변수}가 같은지
function rows(S, name) {
  const bad = [];
  Object.keys(S).forEach((k) => {
    const list = Array.isArray(S[k][0]) ? S[k] : [S[k]];
    list.forEach((r, n) => {
      if (!Array.isArray(r)) return;
      if (r.length !== 4 || r.some((x) => typeof x !== 'string' || !x)) { bad.push(`${k}${list.length > 1 ? '[' + n + ']' : ''}: 칸 ${r.length}개 또는 빈 칸`); return; }
      const v = (s) => [...s.matchAll(/\{([a-z0-9]+)\}/gi)].map((m) => m[1]).sort().join(',');
      if (r.some((x) => v(x) !== v(r[0]))) bad.push(`${k}: {변수}가 언어마다 다름 (${r.map(v).join(' | ')})`);
    });
  });
  ok(bad.length === 0, `${name}: 언어 칸·변수 어긋남 ${bad.length}건` + (bad.length ? '\n     ' + bad.join('\n     ') : ''));
}
rows(SI, 'i18n.js'); rows(SL, 'lobby.js');

// 쓰이지 않는 문구 후보: 열쇠 글자가 어느 소스에도 따옴표로 싸인 꼴로 나오지 않고, 앞머리로 만들어지지도 않는 것
const all = iFiles.concat(['news.js', 'credits.js', 'samguk-rtd.html', 'theme-samguk.js', 'server/app.js', 'server/chat.js', 'i18n-data.js', 'i18n.js']).map(rd).join('\n');
const quoted = (k, src) => src.includes(Q1 + k + Q1) || src.includes(Q2 + k + Q2) || src.includes(Q3 + k + Q3);
const unusedI = Object.keys(SI).filter((k) => !quoted(k, all) && ![...preI].some((p) => k.startsWith(p)));
const unusedL = Object.keys(SL).filter((k) => !quoted(k, lobbySrc) && !lobbyPre.some((p) => k.startsWith(p)));
console.log(`INFO i18n.js에서 쓰이지 않는 문구 후보 ${unusedI.length}건(변수로 만든 열쇠면 실제로는 쓰일 수 있음):\n     ` + unusedI.join(' '));
console.log(`INFO lobby.js에서 쓰이지 않는 문구 후보 ${unusedL.length}건:\n     ` + unusedL.join(' '));
console.log(`RESULT i18n-keys ok=${okN} fail=${fail}`);
process.exit(fail ? 1 : 0);
