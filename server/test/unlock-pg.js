// 해금용 저장소 함수 시험(pg-mem, PostgreSQL판): 소급 해금 기록·보유 추가·광고 하루 상한·결제 거래 한 번만. 표 구조는 바꾸지 않는다.
'use strict';
const { newDb } = require('pg-mem');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const mem = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const { Pool } = mem.adapters.createPg();
  const { openStore } = require('../store');
  const s = await openStore({ pool: new Pool() });
  const u = await s.createUser('g', { nick: '조조', gsalt: 'a', gsec: 'b', agreed: { terms: 1, at: Date.now() } });
  const h = { at: Date.now(), diff: 'easy', mut: 0, round: 70, win: true, time: 3000, online: true, mode: 'solo', myth: { gwakga: 1 }, st: {} };
  await s.recordResult(u.id, { key: 'k1', xp: 100, coins: 0, win: true, round: 70, hist: h, imm: { jojo: 1 }, clear: null });
  let ever = [];
  try { ever = await s.everMyth(u.id); } catch (e) { console.log('     everMyth 예외(pg-mem이 jsonb_object_keys를 지원하지 않을 수 있음): ' + e.message); ever = null; }
  if (ever) ok(ever.includes('gwakga') && ever.includes('jojo'), `소환 기록 모으기 (${ever.join(',')})`);
  const v = await s.grantItems(u.id, ['unl_jojo', 'unl_jojo', 'unl_gwakga']);
  ok(v.owned.filter((x) => x === 'unl_jojo').length === 1 && v.owned.includes('unl_gwakga'), '보유 추가(중복 없음)');
  const day = Date.now() - 1000;
  const rs = []; for (let i = 0; i < 4; i++) rs.push(await s.adReward(u.id, 30, 3, day));
  ok(rs.map((r) => r.ok).join() === 'true,true,true,false' && (await s.getUser(u.id)).coins === 90, `광고 하루 3회 상한 (${rs.map((r) => r.ok).join()})`);
  ok((await s.grantIap(u.id, 'tx1', 'unlock_imm_gwanu', ['unl_gwanu'], Date.now())) === 'ok' && (await s.getUser(u.id)).owned.includes('unl_gwanu'), '결제 거래 → 해금');
  ok((await s.grantIap(u.id, 'tx1', 'unlock_imm_gwanu', ['unl_gwanu'], Date.now())) === 'ok', '같은 거래를 같은 계정이 다시 보내면(복원) 그대로 ok');
  const u2 = await s.createUser('g', { nick: '유비', gsalt: 'a', gsec: 'b', agreed: { terms: 1, at: Date.now() } });
  ok((await s.grantIap(u2.id, 'tx1', 'unlock_imm_gwanu', ['unl_gwanu'], Date.now())) === 'other' && !(await s.getUser(u2.id)).owned.includes('unl_gwanu'), '다른 계정은 같은 거래로 받지 못함');
  await s.close();
})().catch((e) => { console.log('FAIL 예외 ' + e.message); process.exitCode = 1; });
