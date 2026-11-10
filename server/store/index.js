// 저장소 고르기: DATABASE_URL이 있으면 PostgreSQL, 없으면 JSON 파일(DATA_DIR/accounts.json).
// PostgreSQL을 처음 쓸 때 schema.sql을 적용한다(IF NOT EXISTS라 여러 번 돌려도 안전).
'use strict';
const fs = require('fs'), path = require('path');
async function openStore({ dataDir, databaseUrl, pool } = {}) {
  if (pool || databaseUrl) {
    if (!pool) {
      const { Pool } = require('pg');
      pool = new Pool({ connectionString: databaseUrl, max: 10, ssl: process.env.PGSSL === '0' ? false : undefined });
    }
    await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
    return require('./pg')(pool);
  }
  return require('./json')(dataDir);
}
module.exports = { openStore };
