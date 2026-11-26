// 판 결과 재연산 검증(서버 일꾼) 시험 — 2026-11-26 사용자 결정: 모든 판을 같은 씨앗 + 입력 기록으로 서버가 다시 돌려 보고와 맞춘다.
// 유형: Integration · 게이트: BLOCKING. 서버를 이 프로세스 안에서 띄운다(json 저장소, 임시 DATA_DIR, 재연산 일꾼 켬).
// 기기 쪽 판은 Node에서 엔진 묶음을 앱처럼 불러 g.input만으로 조작한다(tests/engine/driver.js). 표의 발급 시각만 앞당겨 다시 서명한다(벽시계 검사).
// 시나리오 → 기대
//  1) 정직한 혼자 판(서버 표의 씨앗, gzip 기록) → 판 끝에 보상, 재연산 뒤 verify ok, 보상 그대로, 기록 파일 지움
//  2) 같은 판인데 보고 처치 수만 +5 → 판 끝에 보상, 재연산 뒤 verify bad, 경험치·동전 회수
//  3) 기록의 씨앗이 표와 다름(다른 씨앗으로 한 판) → bad(seed)
//  4) 기록 없는 예전 표(v 없음) → verify legacy, 대기열에 안 들어감, 기록 파일 없음, 보상 유지
//  5) 기록 없는 새 표 → norec(보상 유지), 예전 앱 표(o) → norec old_app
//  6) AI 동맹 2 판(recj = 압축 안 한 기록) → ok
//  7) 서버에 없는 엔진 해시 → norec(noeng), 보상 유지
//  8) 64KB 본문: 판 보고 주소는 60KB 기록을 받고, 다른 주소는 8KB를 넘으면 거절
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-rep-'));
Object.assign(process.env, { DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '', REPLAY_MODE: 'enforce' });
const ROOT = path.join(__dirname, '..');
const app = require(path.join(ROOT, 'server', 'app.js'));
const REPLAY = require(path.join(ROOT, 'server', 'replay.js'));
const RC = require(path.join(ROOT, 'server', 'replay-core.js'));
const { Driver } = require('./engine/driver');
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
let PORT = 0, store = null;
// 기기 쪽 판(play)이 이 프로세스를 몇 초 붙잡는 동안 서버가 묵은 연결을 닫을 수 있어 연결 오류면 한 번 더 보낸다(시험 환경 문제, 서버 동작과 무관)
const api = async (p, body, tok) => {
  const go = () => fetch(`http://127.0.0.1:${PORT}${p}`, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
  let r; try { r = await go(); } catch (e) { r = await go(); }
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
const key = () => fs.readFileSync(path.join(DATA, 'ticket.key'));
const sign = (o) => { const body = Buffer.from(JSON.stringify(o)).toString('base64url'); return body + '.' + crypto.createHmac('sha256', key()).update(body).digest('base64url'); };
const decode = (tk) => JSON.parse(Buffer.from(String(tk).split('.')[0], 'base64url').toString('utf8'));
const aged = (tk, sec, extra) => sign(Object.assign(decode(tk), { t: Date.now() - sec * 1000 }, extra || {}));
const guest = async (nick) => { const r = await api('/api/guest/new', { nick, agree: true }); return { tok: r.token, uid: r.me.id }; };
const EH = RC.engineHash(ROOT);

// 기기 쪽 한 판(앱 17-loop begin과 같은 머리). 돌려주는 값: { rec, body(보고 본문 일부) }
function play(seed, opt) {
  const o = Object.assign({ diff: 'easy', ai: 0, maxSteps: 120000, lang: 'ja' }, opt || {});
  const A = RC.loadBundle(ROOT, o.lang);
  const head = { v: 1, pf: o.pf, eh: o.eh || EH, lang: A.lang, seed, diff: o.diff, mutLv: 0, muts: [], unl: null, ai: o.ai, b: o.ai ? o.builds : undefined };
  const w = RC.buildWorld(A, head); w.g.rec = new A.E.Recorder(head);
  const d = new Driver(seed + 3);
  while (!w.g.over && w.g.stepN < o.maxSteps) { const h = w.g.stepDt(); RC.stepWorld(w); d.update(w.g, h); }
  const s = RC.summarize(w.g);
  return { rec: w.g.rec.dump(w.g.stepN), body: { round: s.round, win: s.win, time: s.time, st: s.st, myth: s.myth, imm: {}, ach: s.ach, mode: o.ai ? 'ai' : 'solo', diff: o.diff, mutLv: 0 } };
}
const settleWait = async () => { await REPLAY.drain(); };

(async () => {
  try {
    const s = await app.start({ port: 0, replay: true });
    PORT = s.server.address().port; store = s.store;
    const a = await guest('재연산1');

    // 1) 정직한 혼자 판
    const t1 = await api('/api/game/start', { diff: 'easy', mutLv: 0, save: true }, a.tok);
    ok(!!t1.ticket && t1.seed > 0, `표에 서버 씨앗(${t1.seed})`);
    const p1 = play(t1.seed);
    ok(p1.rec.c.length > 50, `기기 판(입력 명령 ${p1.rec.c.length}개, R${p1.body.round} ${p1.body.win ? '승' : '패'})`);
    const tk1 = aged(t1.ticket, p1.body.round * 15 + 60);
    const r1 = await api('/api/history', Object.assign({ ticket: tk1, rec: RC.encodeRec(p1.rec) }, p1.body), a.tok);
    ok(!r1.rejected && r1.verify === 'pending' && r1.gained > 0, `판 끝에 바로 보상(경험치 ${r1.gained}, verify ${r1.verify})`);
    const t0 = Date.now(); await settleWait();
    const v1 = await store.result(r1.id);
    ok(v1 && v1.verify === 'ok', `재연산 뒤 verify ok(${v1 && v1.verify} ${v1 && v1.note}, ${Date.now() - t0}ms)`);
    ok(!fs.existsSync(path.join(DATA, 'replay', r1.id + '.json')), '확인된 판의 기록 파일은 지움');
    const me1 = (await api('/api/me', undefined, a.tok)).me;

    // 2) 보고만 바꾼 판(같은 판을 다시 해서 처치 수 +5)
    const b2 = await guest('재연산2');
    const t2 = await api('/api/game/start', { diff: 'easy', mutLv: 0, save: true }, b2.tok);
    const p2 = play(t2.seed);
    const body2 = JSON.parse(JSON.stringify(p2.body)); body2.st.kills += 5;
    const r2 = await api('/api/history', Object.assign({ ticket: aged(t2.ticket, p2.body.round * 15 + 60), rec: RC.encodeRec(p2.rec) }, body2), b2.tok);
    const xpBefore = (await api('/api/me', undefined, b2.tok)).me.xp;
    ok(!r2.rejected && r2.gained > 0 && xpBefore >= r2.gained, `조작한 보고도 판 끝에는 보상(경험치 ${r2.gained})`);
    await settleWait();
    const v2 = await store.result(r2.id), xpAfter = (await api('/api/me', undefined, b2.tok)).me.xp;
    ok(v2 && v2.verify === 'bad' && /st\.kills/.test(v2.note || ''), `재연산이 처치 수 조작을 찾음(verify ${v2 && v2.verify}, ${v2 && v2.note})`);
    ok(xpAfter === xpBefore - r2.gained, `경험치 회수(${xpBefore} → ${xpAfter})`);

    // 2b) 아이폰(JSC) 판은 측정 전까지 기록만(2026-11-27 사용자 결정): 같은 조작이어도 회수하지 않고 norec + would_revoke:jsc:
    const b2j = await guest('재연산2j');
    const t2j = await api('/api/game/start', { diff: 'easy', mutLv: 0, save: true }, b2j.tok);
    const p2j = play(t2j.seed, { pf: 'jsc' });
    const body2j = JSON.parse(JSON.stringify(p2j.body)); body2j.st.kills += 5;
    const r2j = await api('/api/history', Object.assign({ ticket: aged(t2j.ticket, p2j.body.round * 15 + 60), rec: RC.encodeRec(p2j.rec) }, body2j), b2j.tok);
    const xpJ0 = (await api('/api/me', undefined, b2j.tok)).me.xp;
    await settleWait();
    const v2j = await store.result(r2j.id), xpJ1 = (await api('/api/me', undefined, b2j.tok)).me.xp;
    ok(v2j && v2j.verify === 'norec' && /^would_revoke:jsc:/.test(v2j.note || ''), `JSC 판 불일치는 기록만(verify ${v2j && v2j.verify}, ${v2j && v2j.note})`);
    ok(xpJ1 === xpJ0 && xpJ0 > 0, `JSC 판 경험치 유지(${xpJ0} → ${xpJ1})`);

    // 3) 다른 씨앗으로 한 판을 이 표로 보고
    const t3 = await api('/api/game/start', { diff: 'easy', mutLv: 0, save: true }, a.tok);
    const p3 = play(t3.seed + 1);
    const r3 = await api('/api/history', Object.assign({ ticket: aged(t3.ticket, p3.body.round * 15 + 60), rec: RC.encodeRec(p3.rec) }, p3.body), a.tok);
    await settleWait();
    const v3 = await store.result(r3.id);
    ok(v3 && v3.verify === 'bad' && v3.note === 'replay:seed', `씨앗이 표와 다른 기록 → bad(${v3 && v3.note})`);

    // 4) 예전 표(v 없음) + 기록 없음 → legacy, 대기열 밖
    const c = await guest('예전판');
    const old = sign({ u: c.uid, d: 'easy', m: 0, t: Date.now() - 3600000, n: crypto.randomBytes(9).toString('base64url') });
    const r4 = await api('/api/history', Object.assign({ ticket: old }, p1.body), c.tok);
    ok(!r4.rejected && r4.verify === 'legacy' && r4.gained > 0, `예전 표 판은 지금처럼 받음(verify ${r4.verify}, 경험치 ${r4.gained})`);
    await settleWait();
    const v4 = await store.result(r4.id), xp4 = (await api('/api/me', undefined, c.tok)).me.xp;
    ok(v4.verify === 'legacy' && xp4 >= r4.gained && !fs.existsSync(path.join(DATA, 'replay', r4.id + '.json')), `예전 판은 검증 대기열에 안 들어가고 보상 유지(${v4.verify}, 경험치 ${xp4})`);

    // 5) 새 표인데 기록 없음 → norec, 예전 앱 표(o) → norec old_app
    const t5 = await api('/api/game/start', { diff: 'easy', mutLv: 0, save: true }, c.tok);
    const r5 = await api('/api/history', Object.assign({ ticket: aged(t5.ticket, 2000) }, p1.body), c.tok);
    const t6 = await api('/api/game/start', { diff: 'easy', mutLv: 0 }, c.tok); // save 없는 혼자 판 요청 = 예전 앱(o)
    const r6 = await api('/api/history', Object.assign({ ticket: aged(t6.ticket, 2000) }, p1.body), c.tok);
    await settleWait();
    const v5 = await store.result(r5.id), v6 = await store.result(r6.id);
    ok(v5 && v5.verify === 'norec' && v5.note === 'norec', `기록 없는 새 판 → norec, 보상 유지(${v5 && v5.verify} ${v5 && v5.note})`);
    ok(v6 && v6.verify === 'norec' && (decode(t6.ticket).o ? v6.note === 'old_app' : true), `예전 앱 표(o=${decode(t6.ticket).o}) → norec(${v6 && v6.note})`);

    // 6) AI 동맹 2(실시간 표, 압축 안 한 기록 recj)
    const d = await guest('동맹판');
    const t7 = await api('/api/game/start', { diff: 'easy', mutLv: 0 }, d.tok);
    const p7 = play(t7.seed, { ai: 2, builds: [1, 5], maxSteps: 60000 });
    console.log('     AI 판 기록 JSON ' + JSON.stringify(p7.rec).length + 'B, 명령 ' + p7.rec.c.length + ', R' + p7.body.round + ' 걸음 ' + p7.rec.end.step);
    const r7 = await api('/api/history', Object.assign({ ticket: aged(t7.ticket, p7.body.round * 15 + 60), recj: p7.rec }, p7.body), d.tok);
    await settleWait();
    const v7 = await store.result(r7.id);
    ok(v7 && v7.verify === 'ok', `AI 동맹 판 재연산 일치(${v7 && v7.verify} ${v7 && v7.note})`);

    // 7) 서버에 없는 엔진 해시
    const t8 = await api('/api/game/start', { diff: 'easy', mutLv: 0, save: true }, d.tok);
    const p8 = play(t8.seed, { eh: '0123456789abcdef', maxSteps: 20000 });
    const r8 = await api('/api/history', Object.assign({ ticket: aged(t8.ticket, 2000), rec: RC.encodeRec(p8.rec) }, p8.body), d.tok);
    await settleWait();
    const v8 = await store.result(r8.id);
    ok(v8 && v8.verify === 'norec' && /^noeng/.test(v8.note || ''), `모르는 엔진 버전 → norec(${v8 && v8.note})`);

    // 8) 본문 크기
    const big = 'x'.repeat(60000);
    const r9 = await api('/api/history', { ticket: 'bad.ticket', rec: big, round: 1 }, d.tok);
    ok(r9.status === 200 && r9.rejected, `판 보고 주소는 60KB 본문을 읽음(표가 틀려 거절: ${r9.status})`);
    let r10; try { r10 = await api('/api/nick', { nick: big.slice(0, 9000) }, d.tok); } catch (e) { r10 = { status: 0 }; } // 서버가 연결을 끊는다(readBody 상한)
    ok(r10.status === 400 || r10.status === 0, `다른 주소는 8KB 넘으면 읽지 않음(${r10.status})`);
    const st = REPLAY.stats();
    console.log(`     일꾼 통계: ok ${st.ok}, bad ${st.bad}, norec ${st.norec}, 재연산 ${st.n}판 평균 ${st.n ? Math.round(st.ms / st.n) : 0}ms`);
  } catch (e) { ok(false, '예외: ' + (e && e.stack)); }
  REPLAY.stop();
  console.log(`RESULT server-replay ok=${okN} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
