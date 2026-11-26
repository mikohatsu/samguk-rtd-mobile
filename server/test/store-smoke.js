// 저장소 직접 시험(pg-mem): 계정 만들기·토큰·판 결과·구매·순위·탈퇴
'use strict';
const fs = require('fs'), path = require('path');
const { newDb } = require('pg-mem');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const mem = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const { Pool } = mem.adapters.createPg();
  const { openStore } = require('../store');
  const s = await openStore({ pool: new Pool() });
  const u = await s.createUser('g', { nick: '유비', gsalt: 'a', gsec: 'b', agreed: { terms: 1, at: Date.now() } });
  ok(u && /^g[0-9a-f]{12}$/.test(u.id) && u.coins === 0 && u.icon === 'cav', '게스트 계정 ' + (u && u.id));
  const t = await s.issueToken(u.id);
  ok((await s.userByToken(t)).id === u.id, '토큰으로 찾기');
  const h = { at: Date.now(), diff: 'hard', mut: 0, round: 100, win: true, time: 3600, online: true, mode: 'multi', myth: { jojo: 1 }, st: { kills: 5 } };
  ok(await s.recordResult(u.id, { key: 'k1', xp: 300, coins: 80, win: true, round: 100, hist: h, imm: { jojo: 2 }, clear: { diff: 'hard', party: 'p1', time: 3600, mut: 0 } }), '판 결과 저장');
  ok(!(await s.recordResult(u.id, { key: 'k1', xp: 300, coins: 80, win: true, round: 100, hist: h, imm: {}, clear: null })), '같은 열쇠 두 번은 무시');
  // 순위(클리어 줄·불멸 수)는 재연산 검증 ok 때 들어간다(2026-11-26 "검증된 거만 올리게 해줘 랭킹은")
  ok((await s.confirmResult('k1', null, 'ok')).ranked === true, '검증 확정: 순위에 넣음');
  const v = await s.getUser(u.id);
  ok(v.xp === 300 && v.coins === 80 && v.games === 1 && v.clr === 2 && v.plays.hard === 1 && v.clears.hard === 1 && v.imm.jojo === 2, `계정 갱신 xp ${v.xp} 동전 ${v.coins} clr ${v.clr}`);
  ok((await s.history(u.id)).length === 1, '전적 1줄');
  ok((await s.buy(u.id, 'icon_gwanu', 500)) === 'coins', '동전 부족');
  ok((await s.buy(u.id, 'icon_gwanu', 50)) === 'ok' && (await s.getUser(u.id)).coins === 30, '구매');
  ok((await s.buy(u.id, 'icon_gwanu', 50)) === 'owned', '중복 구매 막음');
  const rc = await s.rankClear('hard', 30); ok(rc.length === 1 && rc[0].members[0].nick === '유비', '클리어 순위');
  ok((await s.rankImm('jojo', 30))[0].n === 2, '불멸 순위');
  await s.deleteUser(u.id);
  ok(!(await s.getUser(u.id)) && !(await s.userByToken(t)), '탈퇴: 계정·토큰 삭제');
  ok((await s.rankClear('hard', 30))[0].members[0].user === null, '탈퇴 뒤 클리어 기록은 이름만 남음');
})().catch((e) => { console.log('FAIL 예외', e.message, e.stack.split('\n').slice(1, 4).join(' | ')); process.exitCode = 1; });
