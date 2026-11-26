// 판 결과 보안 보강 시험(2026-11-26, secure-a): 표 v2·이어하기 칸·잠금 검사·표 모으기 막기(SEC-002)·순위 시간 하한(SEC-003)·
// 하루 경험치/동전 상한을 DB에(SEC-004·008)·파티 열쇠를 서버가(SEC-006)·통계 상한·결과 기록과 회수(revokeResult)·예전 표(legacy).
// 서버를 이 프로세스 안에서 띄운다(회수 함수를 직접 부르고 저장소를 들여다보려고). 저장소 둘(json, pg-mem)로 한 번씩 돈다.
// 실제로 몇십 분을 기다릴 수 없으므로, 이 시험이 만든 임시 DATA_DIR의 ticket.key로 서버가 준 표의 발급 시각만 앞당겨 다시 서명한다.
// 쓰는 법: node tests/server-secure.js   (한 저장소만: node tests/server-secure.js json | pg)
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const which = process.argv[2];
if (which !== 'json' && which !== 'pg') {
  let bad = 0;
  for (const k of ['json', 'pg']) { const r = spawnSync(process.execPath, [__filename, k], { stdio: 'inherit' }); if (r.status !== 0) bad++; }
  console.log(`RESULT server-secure ${bad ? 'FAIL' : 'OK'}`);
  process.exit(bad ? 1 : 0);
}
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-sec-'));
Object.assign(process.env, { DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '', RESULT_XP_DAY: '300', RESULT_COINS_DAY: '120' });
const SRV = path.join(__dirname, '..', 'server');
const app = require(path.join(SRV, 'app.js'));
const WebSocket = require(path.join(SRV, 'node_modules', 'ws'));
const THEME = require('../theme-samguk.js');
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ` [${which}] ` + m); if (c) okN++; else fail++; };
let PORT = 0, store = null, pool = null;
const api = async (p, body, tok) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
const key = () => fs.readFileSync(path.join(DATA, 'ticket.key'));
const sign = (o) => { const body = Buffer.from(JSON.stringify(o)).toString('base64url'); return body + '.' + crypto.createHmac('sha256', key()).update(body).digest('base64url'); };
const decode = (tk) => JSON.parse(Buffer.from(String(tk).split('.')[0], 'base64url').toString('utf8'));
// 서버가 준 표의 발급 시각만 agoSec초 전으로 바꿔 다시 서명(번호·칸·씨앗은 그대로)
const aged = (tk, agoSec) => sign(Object.assign(decode(tk), { t: Date.now() - agoSec * 1000 }));
// 예전 표(v 없음, 업데이트 전에 받은 표)
const legacy = (uid, diff, mut, agoSec, k) => { const o = { u: uid, d: diff, m: mut, t: Date.now() - agoSec * 1000, n: crypto.randomBytes(9).toString('base64url') }; if (k !== undefined) o.k = k; return sign(o); };
// 실시간 v2 표(협동·AI 동맹 등, 이어하기 칸이 아님)
const live = (uid, diff, mut, agoSec, k) => sign({ v: 2, u: uid, d: diff, m: mut | 0, k: k | 0, t: Date.now() - agoSec * 1000, n: crypto.randomBytes(9).toString('base64url'), s: 12345 });
const guest = async (nick) => { const r = await api('/api/guest/new', { nick, agree: true }); return { tok: r.token, uid: r.me.id }; };
async function setProg(uid, clr, nmx) {
  if (pool) await pool.query('UPDATE accounts SET clr = $2, nmx = $3 WHERE id = $1', [uid, clr, nmx]);
  else { const u = store._raw().users[uid]; u.clr = clr; u.nmx = nmx; }
}
const startSave = async (a, diff, mutLv) => api('/api/game/start', { diff, mutLv: mutLv || 0, save: true }, a.tok);
const easyWin = (tk, extra) => Object.assign({ ticket: tk, round: 70, win: true, time: 3300, st: { kills: 2600, goldIn: 4400, combines: 110, bossWins: 5, bosses: 5 } }, extra || {});
const wsOpen = (code, tok) => new Promise((res, rej) => { const w = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${code}&t=${tok}`); w.on('message', (m) => { const x = JSON.parse(m); if (x.k === 'hello') res(w); }); w.on('error', rej); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try {
    if (which === 'pg') {
      const { newDb } = require(path.join(SRV, 'node_modules', 'pg-mem'));
      const mem = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
      const { Pool } = mem.adapters.createPg(); pool = new Pool();
      // 운영 DB에 적용할 이전 SQL이 schema.sql 위에 다시 돌아도 되는지(여러 번 적용해도 안전)
      await pool.query(fs.readFileSync(path.join(SRV, 'db', 'schema.sql'), 'utf8'));
      const mig = fs.readdirSync(path.join(SRV, 'db')).filter((f) => /^migrate-2026-11-26-.*\.sql$/.test(f));
      for (const f of mig) await pool.query(fs.readFileSync(path.join(SRV, 'db', f), 'utf8'));
      ok(mig.length >= 1, `이전 SQL(migrate-2026-11-26-*.sql ${mig.length}개)을 schema.sql 위에 적용해도 오류 없음`);
    }
    const s = await app.start({ pool: pool || undefined, port: 0 });
    store = s.store; PORT = s.server.address().port;
    ok(typeof app.revokeResult === 'function' && typeof app.confirmResult === 'function', '회수·확정 함수(revokeResult·confirmResult)를 내보냄');

    // ---- A. 표를 줄 때 잠금 검사 + 씨앗 (SEC-002 (1), SEC-011) ----
    const a = await guest('secA');
    let r = await api('/api/game/start', { diff: 'normal' }, a.tok);
    ok(r.status === 400 && r.error === 'locked' && r.me && r.me.prog.clr === -1, `쉬움도 못 깬 계정의 보통 표 요청: 400 locked + 계정 진행(me) (${r.status} ${r.error})`);
    const ladder = [];
    for (const [d, m] of [['hard', 0], ['nightmare', 0], ['nightmare', 5]]) ladder.push((await api('/api/game/start', { diff: d, mutLv: m }, a.tok)).status);
    ok(ladder.every((x) => x === 400), `표 모으기 사다리(SEC-002): 어려움·악몽·악몽+5 표를 미리 받을 수 없음 (${ladder.join(',')})`);
    await setProg(a.uid, 3, 1);
    r = await api('/api/game/start', { diff: 'nightmare', mutLv: 3 }, a.tok);
    ok(r.status === 400 && r.error === 'locked', '악몽 +1까지 깬 계정의 악몽 +3 표 요청: locked');
    r = await api('/api/game/start', { diff: 'nightmare', mutLv: 2 }, a.tok);
    ok(r.status === 200 && !!r.ticket, '악몽 +2(깬 단계 + 1)는 받음');
    await setProg(a.uid, -1, -1);
    r = await startSave(a, 'easy');
    const tA = r.ticket, bA = tA ? decode(tA) : {};
    ok(r.status === 200 && Number.isInteger(r.seed) && r.seed > 0 && bA.v === 2 && bA.sv === 1 && bA.s === r.seed, `혼자 새 판 표: v2·이어하기 칸 표·씨앗을 표와 응답에 (seed ${r.seed})`);

    // ---- B. 이어하기 칸: 새 혼자 판이 칸을 바꾼다, 기한 없음, 한 번만 ----
    const tB = (await startSave(a, 'easy')).ticket;
    r = await api('/api/game/check', { ticket: tA }, a.tok);
    ok(r.state === 'replaced', `새 혼자 판을 시작한 뒤 앞 표 확인: replaced (${r.state})`);
    r = await api('/api/game/check', { ticket: tB }, a.tok);
    ok(r.state === 'ok', `지금 칸의 표 확인: ok (${r.state})`);
    r = await api('/api/history', easyWin(aged(tA, 3600)), a.tok);
    ok(r.rejected === true && r.why === 'replaced' && r.me.prog.clr === -1, `바뀐 칸의 표로 낸 결과는 받지 않음(why ${r.why})`);
    r = await api('/api/history', easyWin(aged(tB, 30 * 86400)), a.tok);
    ok(!r.rejected && r.gained === 43 && r.coins === 23 && r.me.prog.clr === 0, `30일 전에 시작한 이어하기 판도 받음(기한 없음): 경험치 43·동전 23·보통 열림 (${r.gained}/${r.coins})`);
    ok(r.verify === 'pending' && typeof r.id === 'string', `결과 id와 검증 상태를 돌려줌(${r.id} ${r.verify})`);
    r = await api('/api/game/check', { ticket: tB }, a.tok);
    ok(r.state === 'used', `쓴 표 확인: used (${r.state})`);
    r = await api('/api/history', easyWin(aged(tB, 30 * 86400)), a.tok);
    ok(r.rejected === true, '같은 이어하기 표로 두 번은 받지 않음');
    r = await api('/api/game/check', { ticket: tB }, (await guest('secA2')).tok);
    ok(r.state === 'other', `다른 계정의 표 확인: other (${r.state})`);

    // ---- C. 예전 표(업데이트 전에 시작한 판): 지금 규칙 그대로 받고 검증에서 뺀다 ----
    const old = legacy(a.uid, 'easy', 0, 3 * 86400);
    r = await api('/api/game/check', { ticket: old }, a.tok);
    ok(r.state === 'legacy', `예전 표 확인: legacy (${r.state})`);
    r = await api('/api/history', easyWin(old), a.tok);
    const lgKey = r.id;
    ok(!r.rejected && r.verify === 'legacy' && r.rank === false, `3일 전 예전 이어하기 표: 칸 정책과 상관없이 받음, 검증 상태 legacy, 순위 후보 아님 (${r.verify})`);
    r = await api('/api/history', easyWin(legacy(a.uid, 'easy', 0, 8 * 86400)), a.tok);
    ok(r.rejected === true, '8일 지난 예전 표는 지금처럼 거부');
    // 실시간 v2 표는 24시간
    r = await api('/api/history', { ticket: live(a.uid, 'easy', 0, 25 * 3600), round: 3, win: false, time: 100 }, a.tok);
    ok(r.rejected === true, '25시간 지난 실시간(협동·AI 동맹) 표는 거부');
    // 업데이트 전 앱(save를 보내지 않음)이 서버 업데이트 뒤에 받은 혼자 판 표: 지금 규칙(오프라인 7일)대로 받는다
    const oa = await guest('secOld');
    r = await api('/api/game/start', { diff: 'easy' }, oa.tok);
    ok(decode(r.ticket).o === 1 && !decode(r.ticket).sv, '예전 앱의 표 요청(save 없음): 예전 앱 표시(o)');
    r = await api('/api/history', easyWin(aged(r.ticket, 3 * 86400)), oa.tok);
    ok(!r.rejected && r.gained > 0, '예전 앱의 3일 전 혼자 판 이어하기도 받음(7일 규칙)');
    r = await api('/api/game/start', { diff: 'easy', save: false }, oa.tok);
    r = await api('/api/history', { ticket: aged(r.ticket, 25 * 3600), round: 3, win: false, time: 100 }, oa.tok);
    ok(r.rejected === true, '새 앱의 AI 동맹 표(save: false)는 24시간');

    // ---- D. 순위 시간 하한: 라인 라운드 45초 × 라인 라운드 수 + 보스 최소 시간 (SEC-003) ----
    const d = await guest('secD');
    r = await api('/api/history', easyWin(aged((await startSave(d, 'easy')).ticket, 7200), { time: 2800 }), d.tok);
    let solo = await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy&mode=solo`)).json();
    ok(r.gained > 0 && !solo.list.some((c) => c.members.some((m) => m.nick === 'secD')), `쉬움을 2800초(예전 하한 2760초 위, 실제 판 구조로는 불가능)로 적은 클리어: 보상은 주되 순위에는 없음`);
    await wait(30); // 순위 응답 30초 기억을 피하려고 다른 계정·다른 시간으로 본다
    const d2 = await guest('secD2');
    r = await api('/api/history', easyWin(aged((await startSave(d2, 'easy')).ticket, 7200), { time: 3000 }), d2.tok);
    const d2k = r.id;
    ok(r.rank === true, `3000초 클리어는 순위 후보(rank ${r.rank})`);
    // 순위는 재연산 검증이 ok인 판만(2026-11-26 사용자 결정 "검증된 거만 올리게 해줘 랭킹은")
    await app.confirmResult('tk-none', 'x'); // 없는 판: 아무 일 없음(캐시만 비운다)
    ok(!(await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy&mode=solo`)).json()).list.some((c) => c.members.some((m) => m.nick === 'secD2')), '검증 전(pending) 판은 솔로 순위에 없음');
    ok((await app.confirmResult(d2k, 'match')).result === 'ok', '확정(confirmResult)');
    let sl = (await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy&mode=solo`)).json());
    ok(sl.list.some((c) => c.time === 3000 && c.members.some((m) => m.nick === 'secD2')), '확정 뒤 솔로 순위에 나타남(3000초)');
    const lv = await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=level`)).json();
    const lvOf = (nick) => (lv.list.find((x) => x.nick === nick) || {}).xp;
    ok(lvOf('secD2') === 43 && lvOf('secD') === 0, `레벨 순위 값은 검증된 경험치만(확정 43, 검증 전 0: ${lvOf('secD2')}/${lvOf('secD')})`);
    await app.revokeResult(d2k, 'late mismatch');
    sl = (await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy&mode=solo`)).json());
    ok(!sl.list.some((c) => c.members.some((m) => m.nick === 'secD2')), '확정 뒤 회수하면 순위에서 빠짐');

    // ---- E. 값싼 통계 상한 ----
    const e = await guest('secE');
    r = await api('/api/history', { ticket: aged((await startSave(e, 'easy')).ticket, 600), round: 10, win: false, time: 500, st: { kills: 99999 } }, e.tok);
    ok(r.rejected === true && r.why === 'no', `10라운드에 처치 99999: 받지 않음(까닭은 기기에 알리지 않음: why ${r.why})`);
    r = await api('/api/history', { ticket: aged((await startSave(e, 'easy')).ticket, 600), round: 10, win: false, time: 500, st: { combines: 500 } }, e.tok);
    ok(r.rejected === true, '10라운드에 합성 500: 받지 않음');
    r = await api('/api/history', { ticket: aged((await startSave(e, 'easy')).ticket, 600), round: 10, win: false, time: 500, st: { bossWins: 3, bosses: 3 } }, e.tok);
    ok(r.rejected === true, '10라운드에 보스 처치 3(보스는 1명뿐): 받지 않음');
    r = await api('/api/history', { ticket: aged((await startSave(e, 'easy')).ticket, 600), round: 10, win: false, time: 500, st: { kills: 380, goldIn: 900, combines: 18, bossWins: 1, bosses: 1, midKill: 2 } }, e.tok);
    ok(!r.rejected && r.gained > 0, '10라운드의 보통 통계는 받음');

    // ---- F. 하루 경험치·동전 상한(이 시험은 경험치 300·동전 120으로 낮춰 둔다), DB에 남는다 ----
    const f = await guest('secF'); let gx = 0, gc = 0;
    for (let i = 0; i < 8; i++) { r = await api('/api/history', easyWin(aged((await startSave(f, 'easy')).ticket, 7200), { time: 3300 + i }), f.tok); gx += r.gained | 0; gc += r.coins | 0; }
    const fu = await store.getUser(f.uid);
    ok(gx === 300 && gc === 120, `쉬움 클리어 8판(경험치 344·동전 184 몫): 하루 상한까지만 (경험치 ${gx}, 동전 ${gc})`);
    ok(fu.rday && fu.rday.xp === 300 && fu.rday.coins === 120, `하루 받은 양이 저장소(계정)에 남음 — 서버를 다시 켜도 유지 (${JSON.stringify(fu.rday)})`);
    ok(typeof fu.lastReward === 'number' && Date.now() - fu.lastReward < 60000, '마지막 보상 시각이 저장소(계정)에 남음');

    // ---- G. 협동: 파티 열쇠는 서버가(방 코드 + 판 시작 신호 시각), 손님은 잠긴 난이도 표 예외 (SEC-006) ----
    const h = await guest('secHost'), gst = await guest('secGuest');
    const wh = await wsOpen('secroom1', h.tok); await wait(50);
    const wg = await wsOpen('secroom1', gst.tok); await wait(50);
    r = await api('/api/game/start', { diff: 'hard', room: 'secroom1' }, gst.tok);
    ok(r.status === 200 && !!r.ticket, '협동 손님: 방장이 고른 잠긴 난이도라도 표를 받음(보고 때 깬 난이도 + 1로 깎음)');
    r = await api('/api/game/start', { diff: 'hard', room: 'secroom1' }, h.tok);
    ok(r.status === 400 && r.error === 'locked', '협동 방장: 자기 잠금대로 거절');
    wh.send(JSON.stringify({ k: 'msg', t: 'start', d: { diff: 'easy', seed: 77 } })); await wait(80);
    const th = (await api('/api/game/start', { diff: 'easy', room: 'secroom1' }, h.tok)).ticket, tg = (await api('/api/game/start', { diff: 'easy', room: 'secroom1' }, gst.tok)).ticket;
    const dh = decode(th), dg = decode(tg);
    ok(dh.r === 'secroom1' && dh.g > 0 && dh.g === dg.g && dh.k === 2 && !dh.sv, `협동 표: 방 코드·판 시작 시각이 같고 인원 2 (${dh.r} ${dh.g}/${dg.g})`);
    r = await api('/api/result', easyWin(aged(th, 7200), { party: 'evilA' }), h.tok);
    const r2 = await api('/api/result', easyWin(aged(tg, 7200), { party: 'evilB', time: 3250 }), gst.tok);
    const coUrl = `http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy`;
    ok(!(await (await fetch(coUrl)).json()).list.some((c) => c.members.some((m) => m.nick === 'secHost')), '협동 판도 검증 전에는 순위에 없음');
    await app.confirmResult(r.id, 'ok'); await app.confirmResult(r2.id, 'ok');
    const co = await (await fetch(coUrl)).json();
    const row = co.list.find((c) => c.members.some((m) => m.nick === 'secHost'));
    ok(r.rank && r2.rank && row && row.members.length === 2 && row.time === 3250, `기기가 보낸 파티 열쇠(evilA·evilB)는 무시하고 한 줄로 모임 (${row ? row.members.length : 0}명, ${row ? row.time : '-'}초)`);
    wh.close(); wg.close();

    // ---- H. 회수: 그 판으로 준 경험치·동전·해금·첫 클리어·업적·순위를 되돌린다 ----
    const v = await guest('secV');
    await setProg(v.uid, 0, -1);
    r = await api('/api/history', { ticket: aged((await startSave(v, 'normal')).ticket, 7200), round: 90, win: true, time: 4500, ach: ['all1'], st: { kills: 3400, goldIn: 9000, combines: 150, bossWins: 6, bosses: 6 } }, v.tok);
    const vk = r.id, vx = r.gained, vc = r.coins, achC = (r.ach || []).reduce((n, x) => n + x.coins, 0);
    ok(r.me.prog.clr === 1 && r.rank === true && vx > 0 && achC > 0, `보통 클리어: 어려움 열림·순위·업적 동전 (경험치 ${vx}, 동전 ${vc}, 업적 ${achC})`);
    r = await api('/api/missions/claim', { id: 'f_normal' }, v.tok);
    ok(r.status === 200 && r.coins === 300, '보통 첫 클리어 동전 300 받음(판 끝에 바로 받을 수 있음)');
    const myth = THEME.unlock.lockedIds().find((id) => (THEME.units.find((x) => x.id === id) || {}).tier === 9);
    r = await api('/api/unlock', { id: myth }, v.tok);
    const before = JSON.parse(JSON.stringify(await store.getUser(v.uid))), spent = 300 + vc + achC - before.coins;
    ok(r.status === 200 && spent > 0, `동전 일부를 써 버림(남은 동전 ${before.coins})`);
    ok((await store.result(vk)).verify === 'pending', '회수 전 검증 상태 pending');
    const rv = await app.revokeResult(vk, 'test');
    const after = await store.getUser(v.uid);
    const owe = vc + achC + 300;
    ok(rv.result === 'ok' && after.xp === before.xp - vx && after.clr === 0 && !((after.clears || {}).normal > 0),`회수: 경험치 −${vx}, 진행은 쉬움까지로(clr ${after.clr})`);
    ok(after.coins === Math.max(0, before.coins - owe) && (after.coinDebt | 0) === Math.max(0, owe - before.coins), `동전: 남은 만큼 빼고 모자란 ${Math.max(0, owe - before.coins)}은 빚으로 (동전 ${after.coins}, 빚 ${after.coinDebt})`);
    const ms = await api('/api/missions', {}, v.tok);
    ok(ms.firsts && !ms.firsts.find((x) => x.id === 'f_normal').claimed && !ms.firsts.find((x) => x.id === 'f_normal').done, '보통 첫 클리어 받음 표시가 지워짐(다시 깨면 다시 받는다)');
    const sn = await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=normal&mode=solo`)).json();
    ok(!sn.list.some((c) => c.members.some((m) => m.nick === 'secV')), '솔로 순위에서 빠짐');
    ok((await store.result(vk)).verify === 'bad', '검증 상태 bad');
    ok((await app.revokeResult(vk, 'again')).result === 'already', '같은 판을 두 번 회수해도 한 번만');
    r = await api('/api/me', undefined, v.tok);
    ok(Array.isArray(r.revoked) && r.revoked.length === 1 && r.revoked[0].id === vk && r.revoked[0].diff === 'normal', '다음 접속(/api/me) 때 회수 알림이 감');
    await api('/api/revoked/ack', { ids: [vk] }, v.tok);
    r = await api('/api/me', undefined, v.tok);
    ok(!r.revoked || r.revoked.length === 0, '알림을 봤다고 알리면 다시 오지 않음');
    // 빚은 다음 수입에서 먼저 갚는다
    const debt0 = after.coinDebt | 0;
    r = await api('/api/history', easyWin(aged((await startSave(v, 'easy')).ticket, 7200)), v.tok);
    const paid = await store.getUser(v.uid);
    ok(debt0 > 0 && (paid.coinDebt | 0) === Math.max(0, debt0 - r.coins) && paid.coins === Math.max(0, r.coins - debt0), `다음 판 동전 ${r.coins}은 빚부터 갚음 (빚 ${debt0} → ${paid.coinDebt}, 동전 ${paid.coins})`);
    ok((await app.confirmResult(r.id)).result === 'ok' && (await store.result(r.id)).verify === 'ok', '확정: 검증 상태 ok');
    ok((await app.revokeResult(r.id, 'late')).result === 'ok', '확정된 판도 회수할 수 있음(운영자 판단)');
    ok((await app.revokeResult(lgKey, 'x')).result === 'legacy' && (await store.result(lgKey)).verify === 'legacy', '예전 표 판은 회수하지 않음(legacy)');
    const nr = (await api('/api/history', { ticket: aged((await startSave(v, 'easy')).ticket, 600), round: 5, win: false, time: 200 }, v.tok)).id;
    ok((await app.noRecResult(nr, 'no input log')).result === 'ok' && (await store.result(nr)).verify === 'norec', '입력 기록이 없는 판: 검증 상태 norec(보상 유지)');
    const pend = await store.pendingResults(50);
    ok(!pend.some((x) => x.id === nr), 'norec 판은 재연산 대기열에서 빠짐');
    ok(Array.isArray(pend) && pend.length > 0 && pend.every((x) => x.verify === 'pending' && x.seed > 0), `재연산 대기열(pendingResults): pending 판 ${pend.length}개, 씨앗 포함`);
  } catch (e) { ok(false, '예외 ' + (e && e.stack || e)); }
  try { if (store) await store.close(); } catch (e) { /* 무시 */ }
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 무시 */ }
  console.log(`RESULT server-secure[${which}] ok=${okN} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
