// 미션용 저장소 함수 시험(pg-mem, PostgreSQL판): 일일 미션 진행·받기(하루 한 번, 날이 바뀌면 새로), 첫 클리어 보상 받기(한 번만), 원장 기록,
// 오프라인 판도 판 열쇠로 한 번만 받기. schema.sql을 두 번 적용해도 되는지도 본다.
// 쓰는 법: node server/test/missions-pg.js
'use strict';
const fs = require('fs'), path = require('path');
const { newDb } = require('pg-mem');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const mem = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const { openStore } = require('../store');
  const s = await openStore({ pool });
  // 운영 DB 적용용 SQL과 schema.sql을 한 번 더 돌려도 오류가 없어야 한다
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'migrate-2026-11-18-missions.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  ok(true, 'schema.sql·migrate-2026-11-18-missions.sql을 다시 적용해도 오류 없음');

  const u = await s.createUser('g', { nick: '손권', gsalt: 'a', gsec: 'b', agreed: { terms: 1, at: Date.now() } });
  const D1 = '2026-11-18', D2 = '2026-11-19';
  let st = await s.missionState(u.id, D1);
  ok(Object.keys(st.daily).length === 0 && st.firsts.length === 0, '처음: 진행·수령 없음');
  ok((await s.missionClaim(u.id, { id: 'd_play', coins: 60, day: D1, need: 1 })) === 'no', '진행이 없는 일일 미션은 받지 못함');

  await s.missionProgress(u.id, D1, ['d_play', 'd_r30']);
  await s.missionProgress(u.id, D1, ['d_play']);
  st = await s.missionState(u.id, D1);
  ok(st.daily.d_play.n === 2 && st.daily.d_r30.n === 1 && !st.daily.d_play.claimed && !st.daily.d_coop, `진행 쌓기 (d_play ${st.daily.d_play.n}, d_r30 ${st.daily.d_r30.n})`);
  ok((await s.missionClaim(u.id, { id: 'd_play', coins: 60, day: D1, need: 1 })) === 'ok' && (await s.getUser(u.id)).coins === 60, '일일 미션 받기: 동전 +60');
  ok((await s.missionClaim(u.id, { id: 'd_play', coins: 60, day: D1, need: 1 })) === 'no' && (await s.getUser(u.id)).coins === 60, '같은 날 두 번은 받지 못함');
  ok((await s.missionClaim(u.id, { id: 'd_coop', coins: 80, day: D1, need: 1 })) === 'no', '완료하지 않은 미션은 받지 못함');
  st = await s.missionState(u.id, D1);
  ok(st.daily.d_play.claimed === true && st.daily.d_r30.claimed === false, '받은 표시');

  // 날이 바뀌면: 어제 것은 보이지 않고(안 받은 d_r30은 사라진다), 새로 진행하면 다시 받을 수 있다
  st = await s.missionState(u.id, D2);
  ok(Object.keys(st.daily).length === 0, '다음 날: 진행이 비어 있음');
  ok((await s.missionClaim(u.id, { id: 'd_r30', coins: 40, day: D2, need: 1 })) === 'no', '어제 완료하고 안 받은 미션은 다음 날 받지 못함');
  await s.missionProgress(u.id, D2, ['d_play']);
  ok((await s.missionClaim(u.id, { id: 'd_play', coins: 60, day: D2, need: 1 })) === 'ok' && (await s.getUser(u.id)).coins === 120, '다음 날 다시 받기: 동전 120');
  const old = await pool.query('SELECT count(*) AS n FROM mission_daily WHERE account_id = $1 AND day = $2', [u.id, D1]);
  ok(+old.rows[0].n === 0, '지난 날의 줄은 지워짐');

  // 첫 클리어 보상: 한 번만
  ok((await s.missionClaim(u.id, { id: 'f_normal', coins: 700 })) === 'ok' && (await s.getUser(u.id)).coins === 820, '첫 클리어 받기: 동전 +700');
  ok((await s.missionClaim(u.id, { id: 'f_normal', coins: 700 })) === 'no' && (await s.getUser(u.id)).coins === 820, '첫 클리어는 한 번만');
  ok((await s.missionClaim(u.id, { id: 'f_nm1', coins: 200 })) === 'ok', '다른 첫 클리어는 따로 받음');
  st = await s.missionState(u.id, D2);
  ok(st.firsts.sort().join() === 'f_nm1,f_normal', `받은 첫 클리어 목록 (${st.firsts.join()})`);

  // 원장: 미션 지급마다 한 줄(reason = mission), 잔액이 맞는다
  const lg = (await pool.query("SELECT delta, balance_after, ref FROM currency_ledger WHERE account_id = $1 AND reason = 'mission' ORDER BY id", [u.id])).rows;
  ok(lg.length === 4 && lg.map((x) => x.delta).join() === '60,60,700,200' && lg[3].balance_after === 1020 && lg[0].ref === D1 + ':d_play' && lg[2].ref === 'f_normal', `원장 4줄 (${lg.map((x) => x.delta + '→' + x.balance_after).join(' ')})`);

  // 오프라인 판도 판 열쇠로 한 번만(전적 보고가 recordResult 길로 들어온다). 전적의 online 표시는 false로 남는다
  const h = { at: Date.now(), diff: 'easy', mut: 0, round: 70, win: true, time: 3000, online: false, mode: 'solo', myth: {}, st: {} };
  ok(await s.recordResult(u.id, { key: 'tk-off1', xp: 66, coins: 23, win: true, round: 70, hist: h, imm: {}, clear: null }), '오프라인 판 결과 저장(경험치·동전)');
  ok(!(await s.recordResult(u.id, { key: 'tk-off1', xp: 66, coins: 23, win: true, round: 70, hist: h, imm: {}, clear: null })), '같은 표(열쇠)로 두 번은 받지 않음');
  const v = await s.getUser(u.id), hs = await s.history(u.id);
  ok(v.xp === 66 && v.coins === 1043 && v.clr === 0 && hs.length === 1 && hs[0].online === false, `오프라인 판: 경험치 ${v.xp}, 동전 ${v.coins}, 전적 ${hs.length}줄(오프라인 표시)`);

  // 2026-11-24: 진행을 양으로 더하기({ id: 양 }), 미션 경험치, 한 번만 주는 보상(관직 승급·업적)
  const D3 = '2026-11-20';
  await s.missionProgress(u.id, D3, { d_comb10: 7, d_boss3: 2 });
  await s.missionProgress(u.id, D3, { d_comb10: 6 });
  st = await s.missionState(u.id, D3);
  ok(st.daily.d_comb10.n === 13 && st.daily.d_boss3.n === 2, `양으로 더하기: 합성 ${st.daily.d_comb10.n}, 보스 ${st.daily.d_boss3.n}`);
  ok((await s.missionClaim(u.id, { id: 'd_comb10', coins: 40, xp: 15, day: D3, need: 10 })) === 'ok', '경험치 있는 일일 미션 받기');
  let w = await s.getUser(u.id);
  ok(w.xp === 66 + 15 && w.coins === 1043 + 40, `미션 받기: 경험치 ${w.xp}(+15), 동전 ${w.coins}(+40)`);
  let g1 = await s.grantOnce(u.id, [{ id: 'rk_1', coins: 100, reason: 'rank' }, { id: 'a_all1', coins: 30, reason: 'ach' }]);
  const g2 = await s.grantOnce(u.id, [{ id: 'rk_1', coins: 100, reason: 'rank' }, { id: 'rk_2', coins: 150, reason: 'rank' }]);
  w = await s.getUser(u.id);
  ok(g1.join() === 'rk_1,a_all1' && g2.join() === 'rk_2' && w.coins === 1043 + 40 + 100 + 30 + 150, `한 번만 주는 보상: 처음 ${g1.join()}, 다음 ${g2.join()}, 동전 ${w.coins}`);
  const lg2 = (await pool.query("SELECT delta, reason, ref FROM currency_ledger WHERE account_id = $1 AND reason IN ('rank', 'ach') ORDER BY id", [u.id])).rows;
  ok(lg2.map((x) => x.reason + ':' + x.ref + ':' + x.delta).join() === 'rank:rk_1:100,ach:a_all1:30,rank:rk_2:150', `원장: 관직·업적 보상 (${lg2.map((x) => x.ref).join()})`);
  g1 = await Promise.all([s.grantOnce(u.id, [{ id: 'rk_3', coins: 200 }]), s.grantOnce(u.id, [{ id: 'rk_3', coins: 200 }])]);
  ok(g1.flat().length === 1 && (await s.getUser(u.id)).coins === w.coins + 200, '동시에 두 번 와도 한 번만');

  // 탈퇴하면 미션 기록도 지워진다
  await s.deleteUser(u.id);
  const left = await pool.query('SELECT (SELECT count(*) FROM mission_daily) AS a, (SELECT count(*) FROM mission_claims) AS b');
  ok(+left.rows[0].a === 0 && +left.rows[0].b === 0, '탈퇴: 미션 기록 삭제');
  await s.close();
})().catch((e) => { console.log('FAIL 예외 ' + e.message + ' ' + String(e.stack || '').split('\n').slice(1, 4).join(' | ')); process.exitCode = 1; });
