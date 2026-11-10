// accounts.json(지금 서버 파일)을 PostgreSQL로 옮긴다. 한 번만 돌리면 되고, 이미 있는 계정은 건너뛴다.
// 사용: DATABASE_URL=postgres://... node server/db/migrate-json.js /opt/rtd-online/server/data/accounts.json
// 토큰: 옛 파일은 토큰 원문을 열쇠로 둬서, 옮기면서 SHA-256으로 바꿔 저장한다(이미 로그인한 사람은 그대로 유지).
'use strict';
const fs = require('fs'), path = require('path');
const { sha } = require('../store/common');
const DIFFS = ['easy', 'normal', 'hard', 'nightmare'];
const ts = (ms) => new Date(ms || Date.now()).toISOString();

async function migrate(db, pool, log = console.log) {
  const c = await pool.connect();
  const n = { users: 0, skipped: 0, sessions: 0, games: 0, clears: 0, reports: 0 };
  try {
    await c.query('BEGIN');
    for (const u of Object.values(db.users || {})) {
      if ((await c.query('SELECT 1 FROM accounts WHERE id = $1', [u.id])).rows.length) { n.skipped++; continue; }
      await c.query(`INSERT INTO accounts (id, nick, track, xp, games, wins, best_round, coins, gems, icon, map_skin, clr, nmx, guest_salt, guest_hash, pw_salt, pw_hash, terms_ver, agreed_at, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [u.id, String(u.nick || u.id).replace(/[<>]/g, '').slice(0, 12), u.track === 'civ' ? 'civ' : 'mil', u.xp | 0, u.games | 0, u.wins | 0, u.best | 0, u.coins | 0, u.gems | 0,
          u.icon || 'cav', u.mapSkin || 'spring', u.clr == null ? -1 : u.clr, u.nmx == null ? -1 : u.nmx, u.gsalt || null, u.gsec || null, u.salt || null, u.pw || null,
          u.agreed ? u.agreed.terms : null, u.agreed ? ts(u.agreed.at) : null, ts(u.created)]);
      if (u.prov && u.sub) await c.query('INSERT INTO identities (provider, subject, account_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [u.prov, u.sub, u.id]);
      for (const d of DIFFS) {
        const p = (u.plays || {})[d] | 0, cl = (u.clears || {})[d] | 0;
        if (p || cl) await c.query('INSERT INTO play_counts (account_id, diff, plays, clears) VALUES ($1, $2, $3, $4)', [u.id, d, p, cl]);
      }
      for (const it of u.owned || []) await c.query('INSERT INTO inventory (account_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [u.id, it]);
      for (const [unit, skin] of Object.entries(u.skins || {})) await c.query('INSERT INTO unit_skins (account_id, unit_id, skin_id) VALUES ($1, $2, $3)', [u.id, unit, skin]);
      for (const [unit, k] of Object.entries(u.imm || {})) if (k > 0) await c.query('INSERT INTO immortal_counts (account_id, unit_id, n) VALUES ($1, $2, $3)', [u.id, unit, k]);
      // 전적: 오래된 것부터 넣어 순서를 지킨다. 중복 보고 막는 열쇠(seen)는 전적 줄과 따로라 빈 줄로 남기지 않는다.
      for (const h of (u.hist || []).slice().reverse()) {
        await c.query(`INSERT INTO games (account_id, played_at, diff, mut, round, win, time_sec, online, mode, myth, stats) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [u.id, ts(h.at), DIFFS.includes(h.diff) ? h.diff : 'easy', h.mut | 0, h.round | 0, !!h.win, h.time | 0, !!h.online, String(h.mode || ''), JSON.stringify(h.myth || {}), JSON.stringify(h.st || {})]);
        n.games++;
      }
      if (u.coins) await c.query("INSERT INTO currency_ledger (account_id, currency, delta, balance_after, reason, ref) VALUES ($1, 'coin', $2, $2, 'migrate', 'accounts.json')", [u.id, u.coins | 0]);
      n.users++;
    }
    // 링크 표에만 있는 연결(옛 형식)
    for (const [k, uid] of Object.entries(db.links || {})) {
      const [prov, ...rest] = k.split(':'); const sub = rest.join(':');
      if ((prov === 'apple' || prov === 'google') && db.users[uid]) await c.query('INSERT INTO identities (provider, subject, account_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [prov, sub, uid]);
    }
    for (const [t, s] of Object.entries(db.tokens || {})) {
      if (!db.users[s.uid] || !(s.exp > Date.now())) continue;
      const h = /^[0-9a-f]{64}$/.test(t) ? t : sha(t); // 이미 해시면 그대로
      await c.query('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [h, s.uid, ts(s.exp)]);
      n.sessions++;
    }
    for (const [diff, list] of Object.entries(db.clears || {})) {
      for (const r of list) {
        const rec = await c.query('INSERT INTO clear_records (diff, party_key, time_sec, mut, cleared_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (diff, party_key) DO NOTHING RETURNING id', [diff, r.key, r.time | 0, r.mut | 0, ts(r.at)]);
        if (!rec.rows.length) continue;
        for (let i = 0; i < (r.members || []).length && i < 5; i++) {
          const m = r.members[i];
          await c.query('INSERT INTO clear_members (record_id, slot, account_id, nick, icon) VALUES ($1, $2, $3, $4, $5)', [rec.rows[0].id, i, db.users[m.id] ? m.id : null, String(m.nick || '').slice(0, 12), m.icon || 'cav']);
        }
        n.clears++;
      }
    }
    for (const r of db.reports || []) {
      await c.query('INSERT INTO reports (reporter_id, target_id, nick, text, room, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [db.users[r.by] ? r.by : null, db.users[r.target] ? r.target : null, String(r.nick || '').slice(0, 12), String(r.text || '').slice(0, 120), String(r.room || '').slice(0, 12), ts(r.at)]);
      n.reports++;
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  log(`이전 완료: 계정 ${n.users}(건너뜀 ${n.skipped}), 로그인 ${n.sessions}, 전적 ${n.games}, 클리어 기록 ${n.clears}, 신고 ${n.reports}`);
  return n;
}
module.exports = { migrate };

if (require.main === module) {
  (async () => {
    const file = process.argv[2]; if (!file || !process.env.DATABASE_URL) { console.error('사용: DATABASE_URL=... node migrate-json.js <accounts.json>'); process.exit(2); }
    const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    await migrate(JSON.parse(fs.readFileSync(file, 'utf8')), pool);
    await pool.end();
  })().catch((e) => { console.error(e); process.exit(1); });
}
