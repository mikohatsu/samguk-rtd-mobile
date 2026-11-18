// 판 표(ticket) 시험: 결과·전적은 서버가 내준 표로만 받고, 난이도·시간을 기기 값이 아니라 표와 서버 시계로 정하는지 본다.
// 실제로 몇십 분을 기다릴 수 없으므로, 이 시험이 만든 임시 DATA_DIR의 ticket.key로 "예전에 발급된 표"를 직접 서명해 쓴다
// (운영 서버의 열쇠는 서버 안에만 있으므로 밖에서는 이렇게 할 수 없다).
// 쓰는 법: node tests/server-ticket.js
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const PORT = 19600 + ((Math.random() * 300) | 0);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-tk-'));
const env = Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '' });
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'app.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const api = async (p, body, tok) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) });
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
async function waitUp() { for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); return; } catch (e) { await new Promise((r) => setTimeout(r, 200)); } } throw new Error('서버가 뜨지 않음'); }
// 서버와 같은 방식으로 표를 서명한다(agoSec초 전에 발급된 것처럼). k = 판 인원(안 적으면 옛 표처럼 없음 = 오프라인 배율 ×0.5, 2 = 온라인 2인 ×1.0)
function forge(uid, diff, mut, agoSec, key, k) {
  const o = { u: uid, d: diff, m: mut, t: Date.now() - agoSec * 1000, n: crypto.randomBytes(9).toString('base64url') }; if (k !== undefined) o.k = k;
  const body = Buffer.from(JSON.stringify(o)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', key || fs.readFileSync(path.join(DATA, 'ticket.key'))).update(body).digest('base64url');
}
(async () => {
  try {
    await waitUp();
    const reg = await api('/api/guest/new', { nick: 'tk1', agree: true });
    const tok = reg.token, uid = reg.me.id;
    const other = await api('/api/guest/new', { nick: 'tk2', agree: true });

    // 표 없이
    let r = await api('/api/result', { key: 'k1', diff: 'nightmare', mutLv: 5, round: 120, win: true, time: 5400 }, tok);
    ok(r.status === 200 && r.gained === 0 && r.me.coins === 0 && r.me.xp === 0, '표 없는 결과 보고: 경험치·동전 0');

    // 표 발급
    r = await api('/api/game/start', { diff: 'easy', mutLv: 0 }, tok);
    ok(r.status === 200 && typeof r.ticket === 'string' && r.ticket.includes('.'), '판 시작: 표를 받음');
    const fresh = r.ticket;
    r = await api('/api/game/start', { diff: 'godmode' }, tok);
    ok(r.status === 400, '없는 난이도로는 표를 받지 못함');

    // 방금 받은 표로 곧바로 70라운드 클리어를 보고(시간은 기기가 5400초라고 우김)
    r = await api('/api/result', { ticket: fresh, round: 70, win: true, time: 5400 }, tok);
    ok(r.gained === 0 && r.me.xp === 0, '방금 받은 표로 70라운드 클리어 보고: 서버 시계로 보아 불가능하므로 0');

    // 가짜 서명
    r = await api('/api/result', { ticket: forge(other.me.id, 'easy', 0, 3600, crypto.randomBytes(32)), round: 70, win: true, time: 3200 }, other.token);
    ok(r.gained === 0, '다른 열쇠로 서명한 표는 거절');
    // 남의 표
    r = await api('/api/result', { ticket: forge(uid, 'easy', 0, 3600), round: 70, win: true, time: 3200 }, other.token);
    ok(r.gained === 0, '다른 계정의 표는 거절');

    // 순위 조작: 판 시간을 터무니없이 짧게 적은 클리어(다른 계정) → 보상은 주되 순위에는 올리지 않는다
    const g3 = await api('/api/guest/new', { nick: 'tk3', agree: true });
    r = await api('/api/result', { ticket: forge(g3.me.id, 'easy', 0, 3600, null, 2), round: 70, win: true, time: 100 }, g3.token);
    ok(r.gained > 0, '판 시간을 100초라고 적은 클리어: 보상은 줌');

    // 정상: 1시간 전에 받은 쉬움 표(온라인 2인 판 = 배율 ×1.0)로 70라운드 클리어
    const t1 = forge(uid, 'easy', 0, 3600, null, 2);
    r = await api('/api/result', { ticket: t1, round: 70, win: true, time: 3200, diff: 'nightmare', mutLv: 5 }, tok);
    ok(r.gained === 131 && r.coins === 46 && r.me.prog.clr === 0, `정상 판(쉬움 70R 클리어): 경험치 131·동전 46, 보통이 열림. 보고에 적은 난이도(악몽+5)는 무시 (받은 값 ${r.gained}/${r.coins})`);
    r = await api('/api/result', { ticket: t1, round: 70, win: true, time: 3200 }, tok);
    ok(r.gained === 0, '같은 표를 두 번 내면 두 번째는 0');
    let rk = await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy`)).json();
    ok(rk.list.length === 1 && rk.list[0].time === 3200, `클리어 순위에는 정상 기록만 있음(100초라고 적은 기록은 없음, ${rk.list.length}건)`);

    // 겹치는 판: 앞선 보상보다 먼저 발급된 표(여러 장 받아 두고 한꺼번에 내기)
    r = await api('/api/result', { ticket: forge(uid, 'easy', 0, 3000), round: 70, win: true, time: 3200 }, tok);
    ok(r.gained === 0, '앞선 보상보다 먼저 발급된 표(동시에 여러 판)는 0');

    // 아직 안 열린 난이도: 악몽 +5 표(서버 기록으로는 보통까지만 열림) → 열린 데까지만 쳐 준다
    await new Promise((x) => setTimeout(x, 30));
    const t2 = forge(uid, 'nightmare', 5, 0.01);
    r = await api('/api/result', { ticket: t2, round: 1, win: false, time: 30 }, tok);
    // 판 인원이 안 적힌 표 = 오프라인 배율(×0.5): 기본 21 → 11, 동전 4 → 2
    ok(r.gained === Math.round(Math.round((15 + 0.8) * 1.3) * 0.5) && r.coins === 2, `안 열린 악몽 +5 표: 보통 배율로만 쳐 줌(오프라인 ×0.5) (받은 값 ${r.gained}/${r.coins})`);

    // 이긴 척: 마지막 라운드가 아닌데 win
    await new Promise((x) => setTimeout(x, 30));
    r = await api('/api/result', { ticket: forge(other.me.id, 'easy', 0, 0.01), round: 1, win: true, time: 30 }, other.token);
    ok(r.me.prog.clr === -1 && r.me.wins === 0 && r.gained === 8, '1라운드에서 이겼다는 보고: 승리로 치지 않음(난이도 진행·승수 그대로, 경험치는 진 판만큼 = 기본 16 × 오프라인 0.5)');

    // 전적(오프라인 판)
    r = await api('/api/history', { diff: 'hard', round: 100, win: true, time: 5000 }, tok);
    ok(r.me.prog.clr === 0, '표 없는 전적: 난이도 진행 그대로');
    r = await api('/api/history', { ticket: forge(uid, 'normal', 0, 7200), round: 90, win: true, time: 4100 }, tok);
    // 이 표는 앞선 보상보다 먼저 발급됐다(겹치는 판) → 전적·난이도 진행만 남고 보상은 없다
    ok(r.me.prog.clr === 1 && r.me.coins === 46 + 2, `표 있는 전적(보통 90R 클리어, 앞선 보상과 겹침): 어려움이 열림, 동전은 그대로 (동전 ${r.me.coins})`);

    // 최단 클리어 순위는 온라인 협동(2인 이상)과 솔로(오프라인·혼자 시작한 온라인)로 나뉜다
    const s1 = await api('/api/guest/new', { nick: 'solo1', agree: true }), s2 = await api('/api/guest/new', { nick: 'solo2', agree: true });
    await api('/api/history', { ticket: forge(s1.me.id, 'easy', 0, 3600), round: 70, win: true, time: 3300 }, s1.token); // 오프라인(AI 동맹)
    await api('/api/result', { ticket: forge(s2.me.id, 'easy', 0, 3600, null, 1), round: 70, win: true, time: 3100 }, s2.token); // 온라인 방에 혼자
    const solo = await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy&mode=solo`)).json();
    ok(solo.list.length === 2 && solo.list[0].time === 3100 && solo.list[1].time === 3300 && solo.list.every((c) => c.members.length === 1), `솔로 순위: 오프라인 판과 혼자 한 온라인 판이 빠른 순으로 (${solo.list.map((c) => c.time).join(',')})`);
    rk = await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy`)).json();
    ok(rk.list.length === 1 && rk.list[0].time === 3200, `온라인 협동 순위에는 솔로 기록이 섞이지 않음(${rk.list.length}건)`);
  } catch (e) { ok(false, '예외 ' + e.message); }
  srv.kill();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 무시 */ }
  console.log(`RESULT server-ticket ok=${okN} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
