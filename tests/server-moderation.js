// 운영 제재 시험: 임시 포트·임시 DATA_DIR(JSON 저장소)로 서버를 띄우고, 운영 도구(server/admin.js)를 따로 실행해
// 채팅 금지·계정 정지를 걸고 풀면서 서버가 그대로 따르는지 본다(로그인·API 403, 열린 연결 끊김, 채팅 막힘, 신고 열람·신고 몰림 기록).
// 쓰는 법: node tests/server-moderation.js   (DATABASE_URL은 비우고 띄운다. 운영 DB를 건드리지 않는다)
'use strict';
const { spawn, spawnSync } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');
const WebSocket = require('../server/node_modules/ws');
const PORT = 19000 + ((Math.random() * 1000) | 0);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-mod-'));
// MOD_REFRESH_MS: 서버가 제재 목록을 다시 읽는 간격(운영 기본 30초)을 시험에서는 0.3초로 줄인다
const env = Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '', MOD_REFRESH_MS: '300' });
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'app.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let srvLog = ''; srv.stdout.on('data', (d) => (srvLog += d)); srv.stderr.on('data', (d) => (srvLog += d));
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (p, body, tok) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
async function waitUp() { for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/api/me`); return; } catch (e) { await pause(200); } } throw new Error('서버가 뜨지 않음'); }
// 운영 도구를 다른 프로세스로 돌린다(운영에서와 같다)
const admin = (...args) => { const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'server', 'admin.js'), ...args], { env, encoding: 'utf8' }); return { code: r.status, out: r.stdout || '', err: r.stderr || '' }; };
// WebSocket 하나: 받은 메시지를 모으고, 조건에 맞는 메시지를 기다린다
function sock(query) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?${query}`), got = [], waits = [];
  const s = { ws, got, closed: false };
  ws.on('message', (raw) => { let m; try { m = JSON.parse(raw); } catch (e) { return; } got.push(m); waits.slice().forEach((w) => { if (w.f(m)) { waits.splice(waits.indexOf(w), 1); w.done(m); } }); });
  ws.on('close', () => { s.closed = true; }); ws.on('error', () => {});
  s.wait = (f, ms = 3000) => new Promise((done) => { const hit = got.find(f); if (hit) return done(hit); const w = { f, done }; waits.push(w); setTimeout(() => { const i = waits.indexOf(w); if (i >= 0) { waits.splice(i, 1); done(null); } }, ms); });
  s.send = (o) => ws.send(JSON.stringify(o));
  s.untilClosed = async (ms = 3000) => { for (let t = 0; t < ms && !s.closed; t += 50) await pause(50); return s.closed; };
  return s;
}
// 조건이 참이 될 때까지 다시 해 본다(서버가 제재 목록을 다시 읽을 때까지)
async function until(fn, ms = 4000) { for (let t = 0; t < ms; t += 150) { const v = await fn(); if (v) return v; await pause(150); } return null; }

(async () => {
  try {
    await waitUp();
    // 계정: 대상(bad) 하나, 신고자 다섯
    const reg = async (id, nick) => api('/api/register', { id, password: 'password123', nick, agree: true });
    const bad = await reg('modbad' + PORT, 'target');
    const reps = []; for (let i = 0; i < 5; i++) reps.push(await reg('modrep' + i + PORT, 'rep' + i));
    ok(!!bad.token && reps.every((r) => r.token), '계정 6개 생성');
    const BAD = bad.me.id;

    // ---- 신고: 로비에 있는 대상을 5명이 신고 → [mod] 기록 한 줄, 자동 제재는 없음 ----
    let lob = sock('lobby=1&t=' + bad.token);
    const hello = await lob.wait((m) => m.k === 'hello');
    await lob.wait((m) => m.k === 'ch');
    ok(!!hello, '대상이 로비 채팅에 접속');
    for (let i = 0; i < 4; i++) await api('/api/report', { room: '#lobby', slot: hello.id, nick: 'target', text: '나쁜 말 ' + i }, reps[i].token);
    await api('/api/report', { room: '#lobby', slot: hello.id, nick: 'target', text: '또 신고' }, reps[0].token); // 같은 사람이 또 신고해도 사람 수는 그대로
    await pause(200);
    ok(!/\[mod\]/.test(srvLog), '서로 다른 4명까지는 기록 없음(같은 사람의 반복 신고는 세지 않는다)');
    await api('/api/report', { room: '#lobby', slot: hello.id, nick: 'target', text: '\u001b[31m제어 문자가 섞인 신고' }, reps[4].token);
    ok(!!(await until(() => /\[mod\] 신고 몰림: 계정 \S+ — 24시간 안에 서로 다른 5명/.test(srvLog) && srvLog.includes(BAD))), '서로 다른 5명이 신고하면 서버 기록에 [mod] 한 줄');
    let r = await api('/api/me', null, bad.token);
    ok(r.status === 200, '신고만으로는 제재되지 않는다(자동 제재 없음)');

    // ---- 운영 도구: 잘못된 인자 ----
    let a = admin();
    ok(a.code === 2 && a.out.includes('쓰는 법'), '명령 없이 부르면 사용법');
    a = admin('mute', BAD, '3weeks', '사유');
    ok(a.code === 2 && a.out.includes('쓰는 법') && a.out.includes('기간'), '잘못된 기간은 사용법');
    a = admin('ban', BAD, '1d');
    ok(a.code === 2 && a.out.includes('쓰는 법'), '사유가 없으면 사용법');
    a = admin('ban', 'nosuchaccount', '1d', '시험');
    ok(a.code === 1 && a.out.includes('그런 계정이 없습니다'), '없는 계정은 제재하지 못함');
    a = admin('ban', "x'; DROP TABLE accounts;--", '1d', '시험');
    ok(a.code === 2, '이상한 계정 ID는 거절');

    // ---- reports / user (서버가 신고를 파일에 적을 때까지 3초 남짓 기다린다) ----
    await pause(3400);
    a = admin('reports');
    ok(a.code === 0 && a.out.includes(BAD) && a.out.includes('target') && a.out.includes('나쁜 말 0') && a.out.includes('대상별 요약') && /6\s+5\s*$/m.test(a.out), 'reports: 신고 목록과 대상별 요약(6건, 신고자 5명)');
    ok(!a.out.includes('\u001b'), 'reports: 신고 글의 터미널 제어 문자는 찍지 않는다');
    a = admin('reports', '--days', '1', '--target', reps[0].me.id);
    ok(a.code === 0 && a.out.includes('신고 0건'), 'reports --target: 다른 계정으로 거르면 0건');
    a = admin('user', 'TARGET');
    ok(a.code === 0 && a.out.includes(BAD) && a.out.includes('password') && a.out.includes('6건') && a.out.includes('신고자 5명') && a.out.includes('없음'), 'user <닉네임>: 계정 요약(제공자·받은 신고·현재 제재 없음)');

    // ---- 채팅 금지: 로비·방 채팅이 막히고 게임(API)은 된다 ----
    const peer = sock('lobby=1&t=' + reps[0].token);
    await peer.wait((m) => m.k === 'ch');
    lob.send({ k: 'say', x: '안녕하세요' });
    ok(!!(await peer.wait((m) => m.k === 'say' && m.x === '안녕하세요')), '금지 전: 로비 채팅이 전달됨');
    a = admin('mute', BAD, '1h', '욕설', '반복');
    ok(a.code === 0 && a.out.includes('채팅 금지'), 'mute 1h');
    const no = await until(async () => { lob.got.length = 0; lob.send({ k: 'say', x: '금지 뒤 ' + Date.now() }); return lob.wait((m) => m.k === 'no' && m.why === 'muted', 400); });
    ok(!!no && no.s > 3500 && no.s <= 3600, `로비 채팅: 보낸 사람에게만 muted와 남은 초 (${no && no.s})`);
    peer.got.length = 0; lob.send({ k: 'say', x: '이 말은 가면 안 된다' }); await pause(400);
    ok(!peer.got.some((m) => m.k === 'say'), '로비 채팅: 다른 사람에게 전달되지 않음');
    const room = sock('room=modt' + (PORT % 1000) + '&t=' + bad.token), room2 = sock('room=modt' + (PORT % 1000) + '&t=' + reps[1].token);
    await room.wait((m) => m.k === 'hello'); await room2.wait((m) => m.k === 'hello');
    room.send({ k: 'msg', t: 'chat', d: { x: '방에서 한마디' } });
    const cn = await room.wait((m) => m.k === 'msg' && m.t === 'chatno');
    await pause(300);
    ok(!!cn && cn.d.why === 'muted' && cn.d.s > 0 && cn.self === 1 && !room2.got.some((m) => m.t === 'chat'), '방 채팅: chatno(why muted, 남은 초)만 돌아오고 전달되지 않음');
    room.send({ k: 'msg', t: 'dmg', d: { n: 1 } });
    ok(!!(await room2.wait((m) => m.k === 'msg' && m.t === 'dmg')), '채팅 금지 중에도 게임 신호는 전달됨');
    r = await api('/api/me', null, bad.token);
    ok(r.status === 200, '채팅 금지 중에도 API는 된다');
    a = admin('user', BAD);
    ok(a.code === 0 && a.out.includes('채팅 금지 ~') && a.out.includes('욕설 반복'), 'user: 현재 제재에 채팅 금지와 사유');
    a = admin('unmute', BAD);
    ok(a.code === 0, 'unmute');
    const WORDS = ['가나다', '라마바', '사아자', '차카타', '파하'];
    ok(!!(await until(async () => { room2.got.length = 0; room.send({ k: 'msg', t: 'chat', d: { x: '풀린 뒤 ' + WORDS.shift() } }); await pause(1200); return room2.got.some((m) => m.t === 'chat'); }, 5000)), '풀면 방 채팅이 다시 전달됨');
    room.ws.close(); room2.ws.close();

    // ---- 계정 정지: 열린 연결 끊김, API·로그인·WebSocket 거절 ----
    a = admin('ban', BAD, '7d', '부정행위');
    ok(a.code === 0 && a.out.includes('계정 정지'), 'ban 7d');
    ok(await lob.untilClosed(4000), '정지하면 열려 있던 로비 연결이 끊김');
    r = await api('/api/me', null, bad.token);
    const span = r.until - Date.now();
    ok(r.status === 403 && r.error === 'banned' && span > 6.9 * 86400000 && span <= 7 * 86400000, `정지 계정의 /api/me는 403 banned + until (${r.status})`);
    r = await api('/api/hist', {}, bad.token);
    ok(r.status === 403 && r.error === 'banned', '정지 계정의 다른 API도 403');
    r = await api('/api/nick', { nick: 'newname' }, bad.token);
    ok(r.status === 403 && r.error === 'banned', '정지 계정은 닉네임도 못 바꿈');
    r = await api('/api/login', { id: 'modbad' + PORT, password: 'password123' });
    ok(r.status === 403 && r.error === 'banned' && !r.token, '정지 계정의 로그인은 403(토큰을 주지 않음)');
    r = await api('/api/login', { id: 'modbad' + PORT, password: 'wrong-password' });
    ok(r.status === 401 && r.error === 'wrong', '비밀번호가 틀리면 정지 여부를 알려 주지 않음(401)');
    r = await api('/api/me', null, reps[0].token);
    ok(r.status === 200, '다른 계정은 그대로');
    for (const q of ['lobby=1&t=' + bad.token, 'room=modban&t=' + bad.token]) {
      const w = sock(q), e = await w.wait((m) => m.k === 'error');
      ok(!!e && e.code === 'banned' && e.until > Date.now() && (await w.untilClosed()), `정지 계정의 WebSocket(${q.split('&')[0]}) 접속 거절`);
    }
    // ---- 풀기 ----
    a = admin('unban', BAD);
    ok(a.code === 0, 'unban');
    ok(!!(await until(async () => (await api('/api/me', null, bad.token)).status === 200)), '풀면 예전 토큰으로 다시 들어온다');
    r = await api('/api/login', { id: 'modbad' + PORT, password: 'password123' });
    ok(r.status === 200 && !!r.token, '풀면 로그인도 된다');
    lob = sock('lobby=1&t=' + bad.token);
    ok(!!(await lob.wait((m) => m.k === 'hello')), '풀면 로비 채팅에도 접속된다');

    // ---- 영구 정지와 이력 ----
    a = admin('ban', BAD, 'perm', '재범');
    ok(a.code === 0 && a.out.includes('영구'), 'ban perm');
    r = await until(async () => { const x = await api('/api/me', null, bad.token); return x.status === 403 ? x : null; });
    ok(!!r && r.until > Date.now() + 1000 * 365 * 86400000, '영구 정지: until이 먼 미래');
    a = admin('unban', BAD);
    a = admin('log');
    const lines = a.out.split('\n').filter((l) => l.includes(BAD));
    ok(a.code === 0 && lines.length === 6 && lines[0].includes('계정 정지 풀기') && lines[1].includes('영구') && lines[1].includes('재범') && lines[5].includes('채팅 금지') && lines[5].includes('욕설 반복'), `log: 제재 이력 6줄(새것부터) (${lines.length})`);
    // 운영 도구가 서버의 계정 파일을 덮어쓰지 않았는지: 서버가 계속 정상
    ok(!!(await until(async () => (await api('/api/me', null, bad.token)).status === 200)) && (await api('/api/me', null, reps[3].token)).status === 200, '운영 도구를 여러 번 돌린 뒤에도 계정은 그대로');
    // ---- 정지 중에도 계정 삭제는 할 수 있다(토큰이 있으면 토큰으로, 로그인이 막힌 게스트는 게스트 ID·비밀값으로) ----
    const g1 = await api('/api/guest/new', { nick: 'gdel1', agree: true }), g2 = await api('/api/guest/new', { nick: 'gdel2', agree: true });
    // 운영 도구는 다른 프로세스라 서버가 새 계정을 파일에 적은 뒤에야 찾는다 → 될 때까지 다시 건다
    ok(!!(await until(() => admin('ban', g1.me.id, '7d', '시험').code === 0 && admin('ban', g2.me.id, '7d', '시험').code === 0, 8000)), '새 게스트 둘을 정지');
    ok(!!(await until(async () => (await api('/api/me', null, g1.token)).status === 403 && (await api('/api/me', null, g2.token)).status === 403)), '정지된 게스트 둘: API 403');
    r = await api('/api/nick', { nick: 'zzz' }, g1.token);
    ok(r.status === 403 && r.error === 'banned', '정지 중 다른 API는 계속 막힘');
    r = await api('/api/delete', { confirm: 'DELETE' }, g1.token);
    ok(r.status === 200 && r.ok === true && (await api('/api/guest/login', g1.guest)).status === 401, '정지 중에도 토큰으로 계정 삭제 가능, 삭제 뒤 로그인 불가');
    r = await api('/api/guest/login', g2.guest);
    ok(r.status === 403 && r.error === 'banned', '정지된 게스트는 로그인(토큰 발급) 불가');
    r = await api('/api/delete', { confirm: 'DELETE', guest: { id: g2.guest.id, secret: 'wrong-secret' } });
    ok(r.status === 401, '토큰 없이 틀린 비밀값으로는 삭제 불가');
    r = await api('/api/delete', { guest: g2.guest });
    ok(r.status === 401, '확인 문자 없이는 삭제 불가');
    r = await api('/api/delete', { confirm: 'DELETE', guest: g2.guest });
    ok(r.status === 200 && r.ok === true && (await api('/api/guest/login', g2.guest)).status === 401, '토큰 없이 게스트 ID·비밀값으로 계정 삭제 가능');
    lob.ws.close(); peer.ws.close();
  } catch (e) { ok(false, '예외 ' + (e && e.stack || e)); }
  srv.kill();
  if (fail) console.log('--- 서버 기록 ---\n' + srvLog);
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 무시 */ }
  console.log(`RESULT server-moderation ok=${okN} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
