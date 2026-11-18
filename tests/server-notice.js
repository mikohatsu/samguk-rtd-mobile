// 서버 공지·최소 버전 시험: 임시 포트·임시 DATA_DIR로 서버를 띄워 GET /api/notice를 확인한다.
// 파일 없음 → 둘 다 null, notice.json을 쓰면 바로 반영(수정 시각), 깨진 JSON·8KB 초과·잘못된 값 → null, 로그인 불필요, 주소당 분당 60번.
// 쓰는 법: node tests/server-notice.js   (DATABASE_URL은 비우고 띄운다. 운영 DB를 건드리지 않는다)
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');
const PORT = 19000 + ((Math.random() * 1000) | 0);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-notice-'));
const FILE = path.join(DATA, 'notice.json');
const env = Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '' });
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'app.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let fail = 0, okN = 0, calls = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const get = async () => {
  calls++;
  const r = await fetch(`http://127.0.0.1:${PORT}/api/notice`);
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
// 수정 시각이 꼭 달라지게 쓴다(같은 밀리초에 두 번 써도)
let stamp = Date.now() / 1000;
const put = (txt) => { fs.writeFileSync(FILE, txt); stamp += 2; fs.utimesSync(FILE, stamp, stamp); };
const none = (r) => r.status === 200 && r.notice === null && r.minVersion === null;
async function waitUp() { for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/api/me`); return; } catch (e) { await new Promise((r) => setTimeout(r, 200)); } } throw new Error('서버가 뜨지 않음'); }
(async () => {
  try {
    await waitUp();
    let r = await get();
    ok(none(r), 'notice.json이 없으면 notice·minVersion 둘 다 null (로그인 없이 200)');
    const text = { ko: '점검 안내', ja: 'メンテナンスのお知らせ', en: 'Maintenance notice', zh: '维护公告' };
    put(JSON.stringify({ notice: { id: 'n1', text }, minVersion: '0.2.33' }));
    r = await get();
    ok(r.status === 200 && r.notice && r.notice.id === 'n1' && r.notice.text.ja === text.ja && r.notice.text.zh === text.zh && r.minVersion === '0.2.33', '파일을 쓰면 공지(4개 언어)와 최소 버전이 나온다');
    ok(Object.keys(r).sort().join() === 'minVersion,notice,status' && Object.keys(r.notice).sort().join() === 'id,text', '응답 모양: { notice: { id, text }, minVersion }');
    put(JSON.stringify({ notice: { id: 'n2', text: { ko: '두 번째' }, extra: 'x' }, minVersion: '1.0.0' }));
    r = await get();
    ok(r.notice && r.notice.id === 'n2' && r.notice.text.ko === '두 번째' && !('extra' in r.notice) && r.minVersion === '1.0.0', '파일을 고치면 서버를 다시 켜지 않아도 새 내용(모르는 칸은 내보내지 않음)');
    put(JSON.stringify({ minVersion: '0.3.0' }));
    r = await get();
    ok(r.status === 200 && r.notice === null && r.minVersion === '0.3.0', '공지 없이 최소 버전만');
    put(JSON.stringify({ notice: { id: 'n3', text } }));
    r = await get();
    ok(r.notice && r.notice.id === 'n3' && r.minVersion === null, '최소 버전 없이 공지만');
    put(JSON.stringify({ notice: { id: 'n4', text: { ko: 3, ja: '' } }, minVersion: 'latest' }));
    r = await get();
    ok(none(r), '글이 없는 공지·모양이 틀린 버전은 null');
    put(JSON.stringify({ notice: { text }, minVersion: '1.2' }));
    r = await get();
    ok(none(r), 'id 없는 공지·두 자리 버전은 null');
    put('{ "notice": ');
    r = await get();
    ok(none(r), '깨진 JSON이면 둘 다 null');
    put(JSON.stringify({ notice: { id: 'big', text: { ko: '가'.repeat(4000) } }, minVersion: '9.9.9' }));
    r = await get();
    ok(fs.statSync(FILE).size > 8192 && none(r), '8KB를 넘는 파일은 읽지 않는다(둘 다 null)');
    put(JSON.stringify({ notice: { id: 'n5', text }, minVersion: '0.2.40' }));
    r = await get();
    ok(r.notice && r.notice.id === 'n5' && r.minVersion === '0.2.40', '다시 고치면 되살아난다');
    fs.unlinkSync(FILE);
    r = await get();
    ok(none(r), '파일을 지우면 다시 null');
    const post = await fetch(`http://127.0.0.1:${PORT}/api/notice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    ok(post.status === 401 || post.status === 404, `POST로는 받지 않는다(${post.status})`);
    // 주소당 분당 60번: 지금까지 부른 횟수를 채운 뒤 61번째는 429
    let last = null; while (calls < 60) last = await get();
    ok(last && last.status === 200, '60번째까지는 200');
    r = await get();
    ok(r.status === 429 && r.error === 'slow_down', '61번째는 429(slow_down)');
  } catch (e) { ok(false, '예외 ' + e.message); }
  srv.kill();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 무시 */ }
  console.log(`RESULT server-notice ok=${okN} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
