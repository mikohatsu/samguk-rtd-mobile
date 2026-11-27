// 협동 판 이모티콘(2026-11-28) 서버 시험: server/chat.js emo 검사(시각을 넣어 바로 확인)와
// 임시 포트·임시 DATA_DIR로 띄운 서버의 방 중계(정해진 8개 id만, 도배 제한, 운영자 채팅 금지·도배 입막음 때 막힘).
// 쓰는 법: node tests/server-emo.js   (DATABASE_URL은 비우고 띄운다. 운영 DB를 건드리지 않는다)
'use strict';
const { spawn, spawnSync } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');
const WebSocket = require('../server/node_modules/ws');
const CHAT = require('../server/chat.js');
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1) chat.js emo: 시각을 직접 넣는다 ----
{
  // net.js와 서버의 목록이 같아야 한다(한쪽만 늘리면 그림이 보이지 않거나 서버가 버린다)
  const src = fs.readFileSync(path.join(__dirname, '..', 'net.js'), 'utf8');
  const m = /const EMOS = (\[[^\]]*\])/.exec(src);
  const netList = m ? JSON.parse(m[1].replace(/'/g, '"')) : null;
  ok(JSON.stringify(netList) === JSON.stringify(CHAT.EMOS) && CHAT.EMOS.length === 8, 'net.js EMOS와 server/chat.js EMOS가 같은 8개');
  CHAT.EMOS.forEach((id) => ok(fs.existsSync(path.join(__dirname, '..', 'gfx', 'emo_' + id + '.png')), `그림 gfx/emo_${id}.png 있음`));

  const T0 = 1e12;
  ok(CHAT.emo('u1', 'laugh', T0).ok === true && CHAT.emo('u1', 'laugh', T0).ok !== true, '목록의 id는 통과, 같은 순간 두 번째는 막힘');
  ok(CHAT.emo('u1', 'cry', T0 + 999).why === 'fast', '1초 안의 다음 이모티콘은 fast');
  ok(CHAT.emo('u1', 'cry', T0 + 1000).ok === true, '1초 뒤에는 통과');
  for (const bad of ['nope', 'Laugh', 'laugh ', '', null, 3, {}, ['laugh'], '__proto__', 'constructor', '<img>']) {
    ok(CHAT.emo('u2', bad, T0).why === 'bad', `목록에 없는 id 거절: ${JSON.stringify(bad)}`);
  }
  // 10초에 5개: 1.1초 간격으로 5개 통과, 6번째는 10초 안이면 막힘, 첫 것이 10초를 지나면 다시 통과
  let t = T0; const r = [];
  for (let i = 0; i < 6; i++) { r.push(CHAT.emo('u3', 'good', t).ok === true); t += 1100; }
  ok(r.slice(0, 5).every(Boolean) && r[5] === false, `10초에 5개까지(6번째 막힘) ${r.join(',')}`);
  ok(CHAT.emo('u3', 'good', T0 + 10001).ok === true, '첫 것이 10초를 지나면 다시 통과');
  // 막힌 시도는 시각을 쌓지 않는다(계속 눌러도 풀리는 시각이 밀리지 않는다)
  t = T0 + 50000; CHAT.emo('u4', 'wow', t);
  for (let i = 1; i <= 20; i++) CHAT.emo('u4', 'wow', t + i * 40);
  ok(CHAT.emo('u4', 'wow', t + 1000).ok === true, '막힌 시도가 많아도 1초 뒤에는 통과');
  // 채팅 도배로 입막음된 동안은 이모티콘도 막힌다(남은 초를 알린다)
  const tm = Date.now();
  for (let i = 0; i < 12; i++) CHAT.check('u5', '도배 ' + i, tm + i * 10);
  const g5 = CHAT._gates.get('u5');
  ok(!!g5 && g5.mutedUntil > tm, '채팅을 빨리 여러 번 보내면 입막음');
  const e5 = CHAT.emo('u5', 'help', tm + 200);
  ok(e5.ok === false && e5.why === 'mute' && e5.s > 0, `입막음 동안 이모티콘은 mute(남은 ${e5.s}초)`);
  // 이모티콘을 많이 눌러도 채팅 벌점은 쌓이지 않는다
  for (let i = 0; i < 30; i++) CHAT.emo('u6', 'think', T0 + i * 10);
  ok(!CHAT._gates.has('u6') && CHAT.check('u6', '안녕하세요', T0 + 400).ok === true, '이모티콘을 연타해도 채팅은 그대로');
}

// ---- 2) 서버 방 중계 ----
const PORT = 19000 + ((Math.random() * 1000) | 0);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-emo-'));
const env = Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '', MOD_REFRESH_MS: '300' });
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'app.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let srvLog = ''; srv.stdout.on('data', (d) => (srvLog += d)); srv.stderr.on('data', (d) => (srvLog += d));
const api = async (p, body, tok) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
async function waitUp() { for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/api/me`); return; } catch (e) { await pause(200); } } throw new Error('서버가 뜨지 않음'); }
const admin = (...args) => { const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'server', 'admin.js'), ...args], { env, encoding: 'utf8' }); return { code: r.status, out: r.stdout || '' }; };
function sock(query) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?${query}`), got = [], waits = [];
  const s = { ws, got };
  ws.on('message', (raw) => { let m; try { m = JSON.parse(raw); } catch (e) { return; } got.push(m); waits.slice().forEach((w) => { if (w.f(m)) { waits.splice(waits.indexOf(w), 1); w.done(m); } }); });
  ws.on('error', () => {});
  s.wait = (f, ms = 3000) => new Promise((done) => { const hit = got.find(f); if (hit) return done(hit); const w = { f, done }; waits.push(w); setTimeout(() => { const i = waits.indexOf(w); if (i >= 0) { waits.splice(i, 1); done(null); } }, ms); });
  s.send = (o) => ws.send(JSON.stringify(o));
  s.emos = () => got.filter((m) => m.k === 'msg' && m.t === 'emo');
  s.nos = () => got.filter((m) => m.k === 'msg' && m.t === 'chatno');
  return s;
}
async function until(fn, ms = 4000) { for (let t = 0; t < ms; t += 150) { const v = await fn(); if (v) return v; await pause(150); } return null; }

(async () => {
  try {
    await waitUp();
    const reg = async (id, nick) => api('/api/register', { id, password: 'password123', nick, agree: true });
    const A = await reg('emoa' + PORT, 'emoA'), B = await reg('emob' + PORT, 'emoB');
    ok(!!A.token && !!B.token, '계정 2개');
    const room = 'emo' + (PORT % 1000);
    const a = sock(`room=${room}&t=${A.token}`), b = sock(`room=${room}&t=${B.token}`);
    await a.wait((m) => m.k === 'hello'); await b.wait((m) => m.k === 'hello');

    // 정상: 다른 사람에게 { e, n }으로 전달, 보낸 사람에게도 self로 돌아온다
    a.send({ k: 'msg', t: 'emo', d: { e: 'laugh', x: '<b>덤</b>', n: '가짜닉' } });
    const gotB = await b.wait((m) => m.k === 'msg' && m.t === 'emo');
    const gotA = await a.wait((m) => m.k === 'msg' && m.t === 'emo');
    ok(!!gotB && gotB.d.e === 'laugh' && gotB.d.n === 'emoA' && Object.keys(gotB.d).sort().join() === 'e,n' && !gotB.self, '전달: 정해진 id와 서버가 붙인 닉만(보낸 쪽의 n·x는 버림)');
    ok(!!gotA && gotA.self === 1 && gotA.d.e === 'laugh', '보낸 사람에게도 돌아온다(self)');

    // 잘못된 id: 아무에게도 가지 않고 알림도 없다
    await pause(1100); b.got.length = 0; a.got.length = 0;
    for (const e of ['nope', '<script>', 7, null]) a.send({ k: 'msg', t: 'emo', d: { e } });
    a.send({ k: 'msg', t: 'emo', d: 'laugh' }); a.send({ k: 'msg', t: 'emo' });
    await pause(500);
    ok(b.emos().length === 0 && a.emos().length === 0 && a.nos().length === 0, '목록에 없는 id·모양이 틀린 것은 버림(전달·알림 없음)');

    // 도배: 바로 두 번 → 두 번째는 막히고 보낸 사람에게만 fast
    await pause(1100); b.got.length = 0; a.got.length = 0;
    a.send({ k: 'msg', t: 'emo', d: { e: 'wow' } }); a.send({ k: 'msg', t: 'emo', d: { e: 'cry' } });
    const no = await a.wait((m) => m.k === 'msg' && m.t === 'chatno');
    await pause(400);
    ok(b.emos().length === 1 && b.emos()[0].d.e === 'wow', '1초 안 두 번째는 전달되지 않음');
    ok(!!no && no.d.why === 'fast' && no.self === 1 && !b.nos().length, '보낸 사람에게만 chatno(why fast)');

    // 이모티콘 연타가 게임 신호를 막지 않는다
    a.send({ k: 'msg', t: 'dmg', d: { n: 1 } });
    ok(!!(await b.wait((m) => m.k === 'msg' && m.t === 'dmg')), '이모티콘 막힘과 상관없이 게임 신호는 전달');

    // 손님이 chatno를 흉내 내도 중계하지 않는다(기존 규칙 그대로)
    b.got.length = 0; a.send({ k: 'msg', t: 'chatno', d: { why: 'muted', s: 99 } }); await pause(300);
    ok(!b.nos().length, 'chatno 흉내는 버림');

    // 운영자 채팅 금지: 이모티콘도 막히고 muted와 남은 초
    let r = admin('mute', A.me.id, '1h', '시험');
    ok(r.code === 0, 'mute 1h');
    const muted = await until(async () => { a.got.length = 0; a.send({ k: 'msg', t: 'emo', d: { e: 'good' } }); return a.wait((m) => m.k === 'msg' && m.t === 'chatno' && m.d.why === 'muted', 500); }, 5000);
    ok(!!muted && muted.d.s > 3500 && muted.d.s <= 3600, `채팅 금지 중 이모티콘: muted(남은 ${muted && muted.d.s}초)`);
    b.got.length = 0; a.send({ k: 'msg', t: 'emo', d: { e: 'thanks' } }); await pause(1300); a.send({ k: 'msg', t: 'emo', d: { e: 'think' } }); await pause(400);
    ok(!b.emos().length, '채팅 금지 중 이모티콘은 전달되지 않음');
    r = admin('unmute', A.me.id);
    ok(r.code === 0, 'unmute');
    ok(!!(await until(async () => { b.got.length = 0; a.send({ k: 'msg', t: 'emo', d: { e: 'help' } }); await pause(1100); return b.emos().some((m) => m.d.e === 'help'); }, 6000)), '풀면 이모티콘이 다시 전달됨');

    // 채팅 도배 입막음 동안 이모티콘도 막힘(why mute)
    for (let i = 0; i < 12; i++) b.send({ k: 'msg', t: 'chat', d: { x: '도배 ' + i } });
    await b.wait((m) => m.k === 'msg' && m.t === 'chatno' && m.d.why === 'mute');
    a.got.length = 0; b.got.length = 0;
    b.send({ k: 'msg', t: 'emo', d: { e: 'angry' } });
    const bm = await b.wait((m) => m.k === 'msg' && m.t === 'chatno');
    await pause(300);
    ok(!!bm && bm.d.why === 'mute' && bm.d.s > 0 && !a.emos().length, `도배 입막음 동안 이모티콘: mute(남은 ${bm && bm.d.s}초), 전달 없음`);

    ok(!/\bws \S/.test(srvLog), '서버 중계 오류 기록 없음');
    a.ws.close(); b.ws.close();
  } catch (e) { ok(false, '예외: ' + (e && e.stack)); }
  srv.kill();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 임시 폴더 */ }
  console.log(`\n${okN} ok, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
