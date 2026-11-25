// 서버 해금 시험: 임시 포트·임시 DATA_DIR(JSON 저장소)로 서버를 띄워 해금 구매·동전 부족·광고 하루 상한·소급 해금·결제 꺼짐을 확인한다.
// 쓰는 법: node tests/server-unlock.js   (DATABASE_URL은 비우고 띄운다. 운영 DB를 건드리지 않는다)
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const PORT = 18000 + ((Math.random() * 1000) | 0);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-unl-'));
const env = Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '' });
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'app.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const api = async (p, body, tok) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) });
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
// 서버와 같은 방식으로 판 표를 서명한다(agoSec초 전에 발급된 것처럼, k = 판 인원). tests/server-missions.js와 같다
function forge(uid, diff, mut, agoSec, k) {
  const o = { u: uid, d: diff, m: mut, t: Date.now() - agoSec * 1000, n: crypto.randomBytes(9).toString('base64url'), k };
  const body = Buffer.from(JSON.stringify(o)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', fs.readFileSync(path.join(DATA, 'ticket.key'))).update(body).digest('base64url');
}
async function waitUp() { for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/api/me`); return; } catch (e) { await new Promise((r) => setTimeout(r, 200)); } } throw new Error('서버가 뜨지 않음'); }
(async () => {
  try {
    await waitUp();
    const reg = await api('/api/register', { id: 'unltest' + PORT, password: 'password123', nick: 'tester', agree: true });
    const tok = reg.token;
    ok(!!tok && reg.me.coins === 0, '계정 생성, 동전 0');
    let r = await api('/api/unlock', { id: 'gwakga' }, tok);
    ok(r.status === 400 && r.error === 'coins', '동전이 부족하면 해금 거절(coins)');
    r = await api('/api/unlock/starter', { want: ['join', 'yeopo', 'join'] }, tok);
    ok(r.status === 200 && r.granted.length === 2 && r.granted[0] === 'join' && r.me.owned.includes('unl_join') && r.me.owned.includes('starter'), `첫 신화 2명: 원한 신화(조인)는 그대로, 불멸(여포)은 무시, 나머지 1명 랜덤 (${(r.granted || []).join(',')})`);
    // 아래에서 동전으로 살 신화: 첫 신화로 받지 않은 것 중 하나(첫 신화 1명은 랜덤이라 고정하면 가끔 겹친다)
    const TH = require('../theme-samguk.js');
    const buyId = TH.unlock.lockedIds().find((id) => TH.units.find((d) => d.id === id).tier === 9 && !r.me.owned.includes('unl_' + id));
    r = await api('/api/unlock/starter', {}, tok);
    ok(r.status === 200 && r.granted.length === 0, '첫 신화는 계정마다 한 번만');
    r = await api('/api/unlock', { id: '../x' }, tok);
    ok(r.status === 400 && r.error === 'bad_item', '이상한 id 거절');
    let last = null;
    for (let i = 0; i < 5; i++) last = await api('/api/ad/reward', {}, tok);
    ok(last.status === 200 && last.me.coins === 150 && last.left === 0, `광고 5회 = 동전 150 (지금 ${last.me && last.me.coins}, 남은 ${last.left})`);
    r = await api('/api/ad/reward', {}, tok);
    ok(r.status === 429 && r.error === 'ad_cap', '하루 6번째 광고는 거절(ad_cap)');
    // 신화 해금 200(2026-11-25 economy-v2): 광고 5회(150)로는 모자라고, 판 하나(5인 쉬움 클리어 동전 78)를 더하면 된다
    ok(TH.unlock.coins[9] === 200 && TH.unlock.coins[10] === 1000, `해금 가격: 신화 ${TH.unlock.coins[9]}, 불멸 ${TH.unlock.coins[10]}`);
    r = await api('/api/unlock', { id: buyId }, tok);
    ok(r.status === 400 && r.error === 'coins' && !r.me, '광고 5회(동전 150)로는 신화(200) 해금 불가(coins)');
    await api('/api/game/start', { diff: 'easy', mutLv: 0 }, tok); // 판 표 서명 열쇠(ticket.key)는 첫 표를 낼 때 생긴다
    r = await api('/api/result', { ticket: forge(reg.me.id, 'easy', 0, 3600, 5), round: 70, win: true, time: 3200 }, tok);
    ok(r.status === 200 && r.coins === 78 && r.me.coins === 228, `5인 쉬움 클리어 한 판: 동전 +78 → 228 (받은 값 ${r.coins}, 지금 ${r.me && r.me.coins})`);
    r = await api('/api/unlock', { id: buyId }, tok);
    ok(r.status === 200 && r.me.coins === 28 && r.me.owned.includes('unl_' + buyId), `동전 200으로 신화(${buyId}) 해금, owned에 열쇠 (남은 동전 ${r.me && r.me.coins})`);
    r = await api('/api/unlock', { id: buyId }, tok);
    ok(r.status === 409 && r.error === 'owned', '이미 연 장수는 다시 살 수 없음');
    r = await api('/api/unlock', { id: 'jojo' }, tok);
    ok(r.status === 400 && r.error === 'coins', '불멸(1000)은 동전 부족');
    // 소급 해금은 닫혔다(2026-11-18 보안): 가짜 전적을 보내도 전적이 안 남고, 불러도 아무것도 열리지 않는다
    r = await api('/api/history', { diff: 'nightmare', round: 120, win: true, time: 9000, myth: { yeopo: 1, sunuk: 2 } }, tok);
    ok(r.status === 200 && r.me.prog.clr === 0, '표 없는 전적 보고는 난이도 진행을 올리지 못함(위의 쉬움 클리어 그대로)');
    r = await api('/api/unlock/claim', {}, tok);
    // 순욱(신화)은 첫 신화 랜덤이나 위의 동전 구매로 이미 가졌을 수 있어, 불멸인 여포로 확인한다
    ok(r.status === 200 && r.granted.length === 0 && !r.me.owned.includes('unl_yeopo'), '소급 해금: 가짜 전적으로 아무것도 열리지 않음(여포)');
    r = await api('/api/iap/verify', { signed: 'a.b.c' }, tok);
    ok(r.status === 503 && r.error === 'not_configured', '결제 설정이 없으면 503(not_configured)');
    r = await api('/api/unlock', { id: 'gwakga' });
    ok(r.status === 401, '로그인 없이 해금 불가');
  } catch (e) { ok(false, '예외 ' + e.message); }
  srv.kill();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 무시 */ }
  console.log(`RESULT server-unlock ok=${okN} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
