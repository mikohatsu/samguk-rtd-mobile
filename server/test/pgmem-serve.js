// 시험용: 메모리 안 PostgreSQL(pg-mem)로 서버를 띄운다. DATA_DIR/accounts.json이 있으면 먼저 DB로 옮긴다.
// 실제 PostgreSQL과 SQL이 같은지 확인하는 용도(운영에서는 DATABASE_URL을 쓴다).
'use strict';
const fs = require('fs'), path = require('path');
const { newDb } = require('pg-mem');
(async () => {
  // noAstCoverageCheck: 스키마를 두 번 적용(IF NOT EXISTS)할 때 pg-mem이 '안 읽은 구문'이라며 막는 것을 끈다
  const mem = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  const f = process.env.DATA_DIR && path.join(process.env.DATA_DIR, 'accounts.json');
  if (f && fs.existsSync(f)) await require('../db/migrate-json').migrate(JSON.parse(fs.readFileSync(f, 'utf8')), pool, () => {});
  await require('../app').start({ pool, port: +process.env.PORT });
})().catch((e) => { console.error(e); process.exit(1); });
