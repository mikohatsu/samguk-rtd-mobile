// 판 보상 배율(인원)·첫 클리어 보상·일일 미션 시험 (production/team/2026-11-18/spec-rewards-missions.md).
// 임시 포트·임시 DATA_DIR(JSON 저장소)로 서버를 띄운다. 방 인원은 실제 WebSocket으로 방에 앉혀 판 표(ticket)에 적힌 k를 본다.
// 보상 금액은 tests/server-ticket.js처럼 임시 DATA_DIR의 ticket.key로 "예전에 발급된 표"를 직접 서명해 확인한다(몇십 분을 기다릴 수 없으므로).
// 쓰는 법: node tests/server-missions.js   (DATABASE_URL은 비우고 띄운다. 운영 DB를 건드리지 않는다)
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const WebSocket = require('../server/node_modules/ws');
const PORT = 20100 + ((Math.random() * 300) | 0);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-ms-'));
const env = Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '' });
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'app.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const api = async (p, body, tok) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) });
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUp() { for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); return; } catch (e) { await wait(200); } } throw new Error('서버가 뜨지 않음'); }
// 서버와 같은 방식으로 표를 서명한다(agoSec초 전에 발급된 것처럼). k = 판 인원(0 오프라인, undefined면 옛 표처럼 k 없음)
function forge(uid, diff, mut, agoSec, k) {
  const o = { u: uid, d: diff, m: mut, t: Date.now() - agoSec * 1000, n: crypto.randomBytes(9).toString('base64url') };
  if (k !== undefined) o.k = k;
  const body = Buffer.from(JSON.stringify(o)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', fs.readFileSync(path.join(DATA, 'ticket.key'))).update(body).digest('base64url');
}
// 표에 적힌 판 인원
const seatsOf = (ticket) => JSON.parse(Buffer.from(String(ticket).split('.')[0], 'base64url').toString('utf8')).k;
// 방에 앉기: hello를 받으면 연결을 돌려준다
function sit(room, tok) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}&t=${tok}`);
    const t = setTimeout(() => rej(new Error('방에 못 들어감')), 5000);
    ws.on('message', (raw) => { let m = {}; try { m = JSON.parse(raw); } catch (e) { /* 무시 */ } if (m.k === 'hello') { clearTimeout(t); res(ws); } if (m.k === 'error') { clearTimeout(t); rej(new Error('방 오류 ' + m.code)); } });
    ws.on('error', (e) => { clearTimeout(t); rej(e); });
  });
}
const guest = async (nick) => { const r = await api('/api/guest/new', { nick, agree: true }); return { tok: r.token, id: r.me.id }; };
const dailyOf = (r, id) => (r.daily || []).find((x) => x.id === id) || {};
const firstOf = (r, id) => (r.firsts || []).find((x) => x.id === id) || {};
const socks = [];
// 관직 승급 보상(progression.js): 경험치 xp까지 오른 계급의 승급 동전 합
const PROG = require('../progression.js');
const rkSum = (xp) => { let n = 0; for (let k = 1; k <= PROG.rankOf(PROG.levelOf(xp)); k++) n += PROG.RANK_COINS[k]; return n; };
(async () => {
  try {
    await waitUp();
    const A = await guest('ms_a'), B = await guest('ms_b'), C = await guest('ms_c');

    // ---------- 1. 판 표에 적히는 판 인원 ----------
    let r = await api('/api/game/start', { diff: 'easy', mutLv: 0 }, A.tok);
    ok(r.status === 200 && seatsOf(r.ticket) === 0, `방 코드 없이 시작: 오프라인(k=0) (${seatsOf(r.ticket)})`);
    r = await api('/api/game/start', { diff: 'easy', mutLv: 0, room: 'nosuch1' }, A.tok);
    ok(seatsOf(r.ticket) === 0, `없는 방 코드: 오프라인(k=0) (${seatsOf(r.ticket)})`);
    const room = 'ms' + crypto.randomBytes(3).toString('hex');
    socks.push(await sit(room, A.tok));
    r = await api('/api/game/start', { diff: 'easy', mutLv: 0, room }, A.tok);
    ok(seatsOf(r.ticket) === 1, `방에 혼자 앉아 시작: 온라인 1인(k=1) (${seatsOf(r.ticket)})`);
    const wsB = await sit(room, B.tok); socks.push(wsB);
    r = await api('/api/game/start', { diff: 'easy', mutLv: 0, room }, A.tok);
    const rb = await api('/api/game/start', { diff: 'easy', mutLv: 0, room: room.toUpperCase() + ' ' }, B.tok);
    ok(seatsOf(r.ticket) === 2 && seatsOf(rb.ticket) === 2, `방에 둘이 앉아 시작: 둘 다 온라인 2인(k=2). 방 코드는 대소문자·빈칸을 고쳐 읽음 (${seatsOf(r.ticket)}, ${seatsOf(rb.ticket)})`);
    r = await api('/api/game/start', { diff: 'easy', mutLv: 0, room }, C.tok);
    ok(seatsOf(r.ticket) === 0, `그 방에 앉아 있지 않은 계정이 방 코드만 보냄: 오프라인(k=0) (${seatsOf(r.ticket)})`);
    // 방금 받은 2인 표로 1라운드 패배 보고: 기본 16 × 1.0
    const two = await api('/api/game/start', { diff: 'easy', mutLv: 0, room }, B.tok);
    await wait(30);
    r = await api('/api/result', { ticket: two.ticket, round: 1, win: false, time: 30 }, B.tok);
    ok(r.gained === 16 && r.coins === 3, `서버가 내준 2인 표로 1라운드 패배: 경험치 16·동전 3(×1.0) (${r.gained}/${r.coins})`);
    wsB.close(); await wait(300);
    r = await api('/api/game/start', { diff: 'easy', mutLv: 0, room }, A.tok);
    ok(seatsOf(r.ticket) === 1, `한 명이 연결을 끊은 뒤: 연결된 사람만 센다(k=1) (${seatsOf(r.ticket)})`);
    // 서버가 내준 오프라인 표로 1라운드 패배: 기본 16 × 0.5 = 8, 동전 3 × 0.5 = 2(반올림)
    const off = await api('/api/game/start', { diff: 'easy', mutLv: 0, room: 'nosuch2' }, C.tok);
    await wait(30);
    r = await api('/api/history', { ticket: off.ticket, round: 1, win: false, time: 30 }, C.tok);
    ok(r.gained === 8 && r.coins === 2 && r.me.xp === 8 && r.me.coins === 2, `가짜 방 코드로 받은 표(오프라인)로 1라운드 패배: 경험치 8·동전 2(×0.5) (${r.gained}/${r.coins})`);

    // ---------- 2. 배율(쉬움 70R 클리어 기본 131·46) ----------
    const want = { 0: [66, 23], 1: [79, 28], 2: [131, 46], 3: [157, 55], 4: [183, 64], 5: [223, 78] };
    const acc = {};
    for (const k of [0, 1, 2, 3, 4, 5]) {
      const u = (acc[k] = await guest('ms_k' + k));
      // 오프라인(k=0)은 전적 보고(/api/history), 나머지는 결과 보고(/api/result)
      r = await api(k ? '/api/result' : '/api/history', { ticket: forge(u.id, 'easy', 0, 3600, k), round: 70, win: true, time: 3200, party: 'p-' + k }, u.tok);
      ok(r.gained === want[k][0] && r.coins === want[k][1] && r.me.xp === want[k][0] && r.me.coins === want[k][1] + rkSum(want[k][0]) && r.me.prog.clr === 0, `쉬움 70R 클리어, 판 인원 ${k}: 경험치 ${want[k][0]}·동전 ${want[k][1]} + 관직 승급 ${rkSum(want[k][0])} (받은 값 ${r.gained}/${r.coins}, 보유 ${r.me.coins})`);
    }
    const D = acc[0], E = acc[5];
    // 옛 표(k 없음)는 오프라인으로 친다
    const old = await guest('ms_old');
    r = await api('/api/result', { ticket: forge(old.id, 'easy', 0, 3600), round: 70, win: true, time: 3200 }, old.tok);
    ok(r.gained === 66 && r.coins === 23, `판 인원이 안 적힌 옛 표: 오프라인 배율 (${r.gained}/${r.coins})`);
    // 클리어 순위: 온라인 협동(k>=2) 4건, 솔로(k=0 전적 보고, k=1 혼자 한 온라인, 옛 표) 3건으로 나뉜다
    const rk = await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy`)).json();
    const rs = await (await fetch(`http://127.0.0.1:${PORT}/api/rank?type=clear&diff=easy&mode=solo`)).json();
    ok(rk.list.length === 4 && rs.list.length === 3, `클리어 순위: 온라인 협동 ${rk.list.length}건(기대 4), 솔로 ${rs.list.length}건(기대 3)`);
    // 전적의 online 표시: 전적 보고는 오프라인, 결과 보고는 온라인
    const hD = await api('/api/hist', {}, D.tok), hE = await api('/api/hist', {}, E.tok);
    ok(hD.hist.length === 1 && hD.hist[0].online === false && hE.hist[0].online === true, '전적의 온라인 표시: 전적 보고 = 오프라인, 결과 보고 = 온라인');

    // ---------- 3. 같은 표를 두 번 ----------
    const tkDup = forge(C.id, 'easy', 0, 3600, 0);
    // C는 위에서 방금 보상을 받았으므로 이 표는 앞선 보상과 겹친다 → 전적·진행만 남고 보상은 0
    r = await api('/api/history', { ticket: tkDup, round: 70, win: true, time: 3200 }, C.tok);
    ok(r.gained === 0 && r.me.coins === 2 && r.me.prog.clr === 0, `앞선 보상보다 먼저 발급된 오프라인 표: 전적·난이도 진행만 남고 보상은 0 (경험치 ${r.gained}, 동전 ${r.me.coins}, clr ${r.me.prog.clr})`);
    r = await api('/api/history', { ticket: tkDup, round: 70, win: true, time: 3200 }, C.tok);
    const hC = await api('/api/hist', {}, C.tok);
    ok(r.gained === 0 && hC.hist.length === 2 && hC.prog.plays.easy === 2, `같은 표로 전적 보고를 두 번: 두 번째는 받지 않음 (전적 ${hC.hist.length}줄, 쉬움 ${hC.prog.plays.easy}판)`);
    // 이 표는 old가 위에서 받은 보상보다 확실히 뒤에 발급된 것이어야 한다(겹치면 보상이 0이라 이 확인이 뜻이 없다)
    await wait(100);
    const tkD = forge(old.id, 'easy', 0, 0.01, 0);
    await wait(30);
    r = await api('/api/history', { ticket: tkD, round: 1, win: false, time: 30 }, old.tok);
    const r2 = await api('/api/history', { ticket: tkD, round: 1, win: false, time: 30 }, old.tok);
    ok(r.gained === 8 && r2.gained === 0 && r2.me.xp === 66 + 8, `같은 표로 보상 받는 전적 보고를 두 번: 한 번만 지급 (${r.gained}, ${r2.gained}, 경험치 ${r2.me.xp})`);

    // ---------- 4. 일일 미션 ----------
    r = await api('/api/missions', {});
    ok(r.status === 401, '로그인 없이 미션 상태를 볼 수 없음');
    const fresh = await guest('ms_new');
    r = await api('/api/missions', {}, fresh.tok);
    ok(r.status === 200 && r.daily.length === 3 && r.firsts.length === 8 && r.daily.every((x) => x.n === 0 && !x.done && !x.claimed) && r.firsts.every((x) => !x.done && !x.claimed), '새 계정: 일일 미션 3개·첫 클리어 8개, 모두 진행 0');
    ok(dailyOf(r, 'd_play2').coins === 60 && dailyOf(r, 'd_play2').xp === 30 && dailyOf(r, 'd_play2').need === 2
      && dailyOf(r, 'd_comb10').coins === 40 && dailyOf(r, 'd_comb10').xp === 15 && dailyOf(r, 'd_comb10').need === 10
      && dailyOf(r, 'd_boss3').coins === 50 && dailyOf(r, 'd_boss3').xp === 25 && dailyOf(r, 'd_boss3').need === 3
      && firstOf(r, 'f_normal').coins === 700 && firstOf(r, 'f_hard').coins === 700 && firstOf(r, 'f_nightmare').coins === 700 && [1, 2, 3, 4, 5].every((n) => firstOf(r, 'f_nm' + n).coins === 200), '보상 수치: 일일(판 2번 60+30XP·합성 10번 40+15XP·보스 3마리 50+25XP), 첫 클리어 700×3·200×5');
    ok(r.resetAt > Date.now() && r.resetAt - Date.now() <= 86400000 && new Date(r.resetAt + 9 * 3600000).getUTCHours() === 0, '초기화 시각 = 다음 일본 시간 0시');
    // 판 통계 없이 오프라인 70R 1판(D): 판 2번은 1/2, 합성·보스는 0
    r = await api('/api/missions', {}, D.tok);
    ok(dailyOf(r, 'd_play2').n === 1 && !dailyOf(r, 'd_play2').done && dailyOf(r, 'd_comb10').n === 0 && dailyOf(r, 'd_boss3').n === 0, '통계 없는 70R 판 1번: 판 2번 1/2, 합성·보스 0');
    // 1라운드에서 끝난 판(B): 10라운드 미만이라 판 수로 치지 않음
    r = await api('/api/missions', {}, B.tok);
    ok(dailyOf(r, 'd_play2').n === 0, '10라운드 미만으로 끝난 판은 판 수로 세지 않음');
    // 통계를 부풀린 판: 합성은 라운드당 4번, 보스는 도달 라운드까지 나온 보스 수를 넘지 못한다
    const N = await guest('ms_n');
    await api('/api/history', { ticket: forge(N.id, 'easy', 0, 600, 0), round: 2, win: false, time: 60, st: { combines: 500, bossWins: 9 } }, N.tok);
    r = await api('/api/missions', {}, N.tok);
    ok(dailyOf(r, 'd_comb10').n === 8 && dailyOf(r, 'd_boss3').n === 0 && dailyOf(r, 'd_play2').n === 0, `2라운드 판에 합성 500·보스 9를 적어 보냄: 합성 8(라운드×4), 보스 0 (${dailyOf(r, 'd_comb10').n}, ${dailyOf(r, 'd_boss3').n})`);
    await api('/api/history', { ticket: forge(N.id, 'easy', 0, 600, 0), round: 30, win: false, time: 1200, st: { combines: 5, bossWins: 9 } }, N.tok);
    r = await api('/api/missions', {}, N.tok);
    ok(dailyOf(r, 'd_boss3').n === 2, `30라운드 판에 보스 9를 적어 보냄: 보스 2(R10·R25) (${dailyOf(r, 'd_boss3').n})`);
    // 셋 다 채우기(M): 70R 클리어(합성 30·보스 5) + 1R 패배(판 수 아님) + 10R 패배
    const M = await guest('ms_m');
    r = await api('/api/history', { ticket: forge(M.id, 'easy', 0, 7200, 0), round: 70, win: true, time: 3200, st: { combines: 30, bossWins: 5 } }, M.tok);
    await wait(20);
    await api('/api/history', { ticket: forge(M.id, 'easy', 0, 0.01, 0), round: 1, win: false, time: 20 }, M.tok);
    r = await api('/api/missions', {}, M.tok);
    ok(dailyOf(r, 'd_play2').n === 1 && dailyOf(r, 'd_comb10').done && dailyOf(r, 'd_boss3').done && dailyOf(r, 'd_comb10').n === 10 && dailyOf(r, 'd_boss3').n === 3, '70R 판(합성 30·보스 5): 합성·보스 미션 완료(진행은 need까지), 1R 판은 판 수로 안 셈');
    await api('/api/history', { ticket: forge(M.id, 'easy', 0, 600, 0), round: 10, win: false, time: 400 }, M.tok);
    r = await api('/api/missions', {}, M.tok);
    ok(dailyOf(r, 'd_play2').done && dailyOf(r, 'd_play2').n === 2, '10라운드 이상 판 2번: 판 2번 하기 완료');
    // 표 없는 보고로는 진행이 오르지 않는다
    r = await api('/api/history', { round: 70, win: true, time: 3200, diff: 'easy', st: { combines: 99, bossWins: 5 } }, fresh.tok);
    r = await api('/api/missions', {}, fresh.tok);
    ok(r.daily.every((x) => x.n === 0), '표 없는 보고로는 미션 진행이 오르지 않음');

    // 받기: 동전과 경험치
    const c0 = (await api('/api/hist', {}, M.tok)) && (await api('/api/missions/claim', { id: 'd_boss3' }, M.tok));
    r = c0;
    const xp1 = r.me && r.me.xp;
    ok(r.status === 200 && r.coins === 50 && r.xp === 25 && dailyOf(r, 'd_boss3').claimed && !dailyOf(r, 'd_comb10').claimed, `일일 미션 받기: 동전 +50·경험치 +25 (응답 ${r.coins}/${r.xp})`);
    r = await api('/api/missions/claim', { id: 'd_boss3' }, M.tok);
    ok(r.status === 409 && r.error === 'no_claim', '같은 일일 미션은 하루에 한 번만');
    r = await api('/api/missions/claim', { id: 'd_play2' }, D.tok);
    ok(r.status === 409 && r.error === 'no_claim', '완료하지 않은 일일 미션은 받을 수 없음');
    r = await api('/api/missions/claim', { id: 'zzz' }, D.tok);
    ok(r.status === 400 && r.error === 'bad_item', '없는 미션 id 거절');
    r = await api('/api/missions/claim', { id: 'd_play2' });
    ok(r.status === 401, '로그인 없이 받을 수 없음');
    r = await api('/api/missions/claim', { id: 'd_play2' }, M.tok);
    // M: 70R 클리어 66 + 1R 패배 8 = 74(10R 판은 앞 보상과 겹친 표라 0) → 미션 +25 = 99 → +30 = 129. 9품(100)은 두 번째 받기에서 오르고, 그때 승급 보상도 준다
    ok(r.status === 200 && r.me.xp === xp1 + 30 && r.rankUp.length === 1 && r.rankUp[0].rank === 1 && r.rankUp[0].coins === 100, `두 번째 일일 미션 받기: 경험치 +30, 미션 경험치로 9품 도달 → 승급 보상 +100 (${xp1} → ${r.me && r.me.xp}, ${JSON.stringify(r.rankUp)})`);

    // ---------- 4b. 관직 승급 보상(자동, 계급마다 한 번) ----------
    const R = await guest('ms_r');
    r = await api('/api/result', { ticket: forge(R.id, 'easy', 0, 7200, 5), round: 70, win: true, time: 3200 }, R.tok);
    ok(r.me.rank === 1 && Array.isArray(r.rankUp) && r.rankUp.length === 1 && r.rankUp[0].rank === 1 && r.rankUp[0].coins === 100 && r.me.coins === 78 + 100, `5인 쉬움 클리어(223XP): 9품 승급 보상 +100 (rankUp ${JSON.stringify(r.rankUp)}, 동전 ${r.me.coins})`);
    await wait(20);
    r = await api('/api/result', { ticket: forge(R.id, 'easy', 0, 0.01, 5), round: 1, win: false, time: 20 }, R.tok);
    ok(Array.isArray(r.rankUp) && r.rankUp.length === 0, '계급이 그대로면 승급 보상 없음');
    await wait(20);
    // 판 경험치만으로는 한 판에 두 계급을 못 넘으니, 미션 경험치로 8품(270)을 넘긴다: 223 + 27(5인 1R) = 250 → 보스 미션은 진행이 없으니 판 하나 더 대신 확인만
    ok(r.me.xp === 223 + 27 && r.me.rank === 1, `5인 1R 패배 뒤 경험치 ${r.me.xp}, 아직 9품`);
    r = await api('/api/missions', {}, R.tok);
    ok(Array.isArray(r.rankUp) && r.rankUp.length === 0, '이미 받은 승급 보상은 미션 창을 열어도 다시 주지 않음');
    const R3 = await guest('ms_r3');
    r = await api('/api/result', { ticket: forge(R3.id, 'easy', 0, 7200, 5), round: 70, win: true, time: 3200, st: { combines: 40, bossWins: 5 } }, R3.tok);
    await wait(20);
    r = await api('/api/result', { ticket: forge(R3.id, 'easy', 0, 0.01, 5), round: 1, win: false, time: 20 }, R3.tok);
    await api('/api/missions/claim', { id: 'd_comb10' }, R3.tok);
    r = await api('/api/missions/claim', { id: 'd_boss3' }, R3.tok);
    ok(r.me.xp === 223 + 27 + 15 + 25 && r.me.rank === 2 && r.rankUp.length === 1 && r.rankUp[0].rank === 2 && r.rankUp[0].coins === 150, `경험치 ${r.me.xp}(≥270): 8품 승급 보상 +150 (${JSON.stringify(r.rankUp)})`);

    // ---------- 4c. 업적 첫 달성 보상 ----------
    const Q = await guest('ms_q');
    r = await api('/api/result', { ticket: forge(Q.id, 'easy', 0, 600, 2), round: 10, win: false, time: 400, ach: ['all1', 'm_two', 'm_diverse', 'zzz', 'all1'] }, Q.tok);
    let got = (r.ach || []).map((x) => x.id + ':' + x.coins).sort().join(',');
    ok(got === 'all1:30,m_two:50' && r.me.coins === r.coins + 80 + rkSum(r.me.xp), `2인 10R 판 업적: 아는 업적만, 중복은 한 번, m_diverse(25R 필요)는 제외 (${got}, 동전 ${r.me.coins})`);
    await wait(20);
    r = await api('/api/history', { ticket: forge(Q.id, 'easy', 0, 0.01, 0), round: 1, win: false, time: 20, ach: ['all1', 'e_first2', 'flash70', 'm_two'] }, Q.tok);
    got = (r.ach || []).map((x) => x.id + ':' + x.coins).sort().join(',');
    ok(got === 'e_first2:30,flash70:100', `오프라인 판: 이미 받은 all1·m_two는 다시 안 줌(협동 업적은 오프라인 판으로 인정 안 함), 새 업적만 (${got})`);
    r = await api('/api/history', { ach: ['all2'], round: 70, win: true, time: 3200, diff: 'easy' }, Q.tok);
    ok(!r.ach || r.ach.length === 0, '표 없는 보고의 업적은 받지 않음');

    // ---------- 5. 첫 클리어 보상 ----------
    r = await api('/api/missions/claim', { id: 'f_normal' }, D.tok);
    ok(r.status === 409 && r.error === 'no_claim', '보통을 깨지 않았으면 첫 클리어 보상을 받을 수 없음');
    // D가 보통·어려움·악몽·악몽+1을 차례로 깬다(앞선 보상과 겹치는 오프라인 표 → 판 보상은 0이지만 서버 기록에는 남는다)
    for (const [diff, mut, rounds] of [['normal', 0, 90], ['hard', 0, 100], ['nightmare', 0, 120], ['nightmare', 1, 120]]) {
      r = await api('/api/history', { ticket: forge(D.id, diff, mut, 20000, 0), round: rounds, win: true, time: rounds * 45 }, D.tok);
    }
    ok(r.me.prog.clr === 3 && r.me.prog.nmx === 1 && r.me.coins === 23, `보통~악몽+1 클리어 기록(겹친 표라 판 보상은 0): clr ${r.me.prog.clr}, nmx ${r.me.prog.nmx}, 동전 ${r.me.coins}`);
    r = await api('/api/missions', {}, D.tok);
    ok(['f_normal', 'f_hard', 'f_nightmare', 'f_nm1'].every((id) => firstOf(r, id).done && !firstOf(r, id).claimed) && ['f_nm2', 'f_nm3', 'f_nm4', 'f_nm5'].every((id) => !firstOf(r, id).done), '첫 클리어: 보통·어려움·악몽·악몽+1 완료(미수령), +2~+5는 미완료');
    r = await api('/api/missions/claim', { id: 'f_normal' }, D.tok);
    ok(r.status === 200 && r.me.coins === 23 + 700 && firstOf(r, 'f_normal').claimed, `보통 첫 클리어 받기: 동전 +700 (지금 ${r.me && r.me.coins})`);
    r = await api('/api/missions/claim', { id: 'f_normal' }, D.tok);
    ok(r.status === 409 && r.error === 'no_claim', '첫 클리어 보상은 한 번만');
    r = await api('/api/missions/claim', { id: 'f_nm1' }, D.tok);
    ok(r.status === 200 && r.me.coins === 23 + 700 + 200, `악몽 +1 첫 클리어 받기: 동전 +200 (지금 ${r.me && r.me.coins})`);
    r = await api('/api/missions/claim', { id: 'f_nm2' }, D.tok);
    ok(r.status === 409, '악몽 +2는 아직 받을 수 없음');
    // 쉬움만 깬 계정(E)은 첫 클리어 보상 없음
    r = await api('/api/missions', {}, E.tok);
    ok(r.firsts.every((x) => !x.done), '쉬움 클리어는 첫 클리어 보상 대상이 아님');
  } catch (e) { ok(false, '예외 ' + e.message + ' ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')); }
  socks.forEach((ws) => { try { ws.close(); } catch (e) { /* 무시 */ } });
  srv.kill();
  await wait(100);
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 무시 */ }
  console.log(`RESULT server-missions ok=${okN} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
