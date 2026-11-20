// Sign in with Apple refresh token 저장 함수 시험(pg-mem, PostgreSQL판): 넣기·덮어쓰기·읽기·값이 같을 때만 지우기·연결 없는 오래된 토큰 찾기.
// 운영 DB용 SQL(migrate-2026-11-20-apple-tokens.sql)을 스키마 위에 다시 돌려도 되는지도 본다.
'use strict';
const fs = require('fs'), path = require('path');
const { newDb } = require('pg-mem');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const mem = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const { Pool } = mem.adapters.createPg();
  const { openStore } = require('../store');
  const pool = new Pool();
  const s = await openStore({ pool });
  let mig = true; try { await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'migrate-2026-11-20-apple-tokens.sql'), 'utf8')); } catch (e) { mig = false; console.log('     ' + e.message); }
  ok(mig, 'migrate-2026-11-20-apple-tokens.sql을 스키마 위에 다시 돌려도 된다');

  await s.putAppleToken('sub.A', 'rt1');
  ok((await s.appleToken('sub.A')) === 'rt1', '넣고 읽기');
  await s.putAppleToken('sub.A', 'rt2');
  ok((await s.appleToken('sub.A')) === 'rt2', '같은 sub는 새 토큰으로 덮어쓴다');
  await s.dropAppleToken('sub.A', 'rt1');
  ok((await s.appleToken('sub.A')) === 'rt2', '값이 다르면 지우지 않는다(그 사이 받은 새 토큰 보호)');
  await s.dropAppleToken('sub.A', 'rt2');
  ok((await s.appleToken('sub.A')) === null, '값이 같으면 지운다');

  await s.putAppleToken('sub.linked', 'rtL');
  await s.putAppleToken('sub.orphan', 'rtO');
  await s.createUser('a', { nick: 'Apple1', prov: 'apple', sub: 'sub.linked', agreed: { terms: 1, at: Date.now() } });
  ok((await s.orphanAppleTokens(Date.now() - 3600000)).length === 0, '방금 받은 토큰은 연결이 없어도 아직 건드리지 않는다');
  const o = await s.orphanAppleTokens(Date.now() + 1000);
  ok(o.length === 1 && o[0].sub === 'sub.orphan' && o[0].token === 'rtO', '연결된 계정이 없는 오래된 토큰만 찾는다');
  const u = await s.findByIdentity('apple', 'sub.linked');
  await s.deleteUser(u.id);
  ok((await s.orphanAppleTokens(Date.now() + 1000)).some((x) => x.sub === 'sub.linked') && (await s.appleToken('sub.linked')) === 'rtL', '계정을 지워도 토큰 줄은 남는다(철회 실패 시 재시도 대상)');
})().catch((e) => { ok(false, '예외 ' + e.message); });
