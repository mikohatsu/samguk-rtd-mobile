// 저장소(PostgreSQL판). 함수 모양은 json.js와 같다. pool은 'pg' 패키지의 Pool(또는 같은 모양의 객체).
// 돈·기록이 함께 바뀌는 일(판 결과, 구매)은 트랜잭션 하나로 처리하고, 재화가 바뀔 때마다 currency_ledger에 한 줄 남긴다.
'use strict';
const crypto = require('crypto');
const { DIFFS, sha, newToken, TOKEN_MS } = require('./common');

module.exports = function pgStore(pool) {
  const q = (sql, args) => pool.query(sql, args);
  async function tx(fn) {
    const c = await pool.connect();
    try { await c.query('BEGIN'); const r = await fn((s, a) => c.query(s, a)); await c.query('COMMIT'); return r; }
    catch (e) { try { await c.query('ROLLBACK'); } catch (e2) { /* 무시 */ } throw e; }
    finally { c.release(); }
  }
  const ms = (d) => (d ? new Date(d).getTime() : null);

  // 계정 한 명을 서버가 쓰는 모양(user view)으로 모은다
  async function hydrate(id, qq = q) {
    const a = (await qq('SELECT * FROM accounts WHERE id = $1', [id])).rows[0];
    if (!a) return null;
    const [pc, inv, sk, idn, im] = await Promise.all([
      qq('SELECT diff, plays, clears FROM play_counts WHERE account_id = $1', [id]),
      qq('SELECT item_id FROM inventory WHERE account_id = $1 ORDER BY acquired_at', [id]),
      qq('SELECT unit_id, skin_id FROM unit_skins WHERE account_id = $1', [id]),
      qq('SELECT provider, subject FROM identities WHERE account_id = $1 ORDER BY created_at', [id]),
      qq('SELECT unit_id, n FROM immortal_counts WHERE account_id = $1', [id]),
    ]);
    const u = {
      id: a.id, nick: a.nick, track: a.track, xp: a.xp, games: a.games, wins: a.wins, best: a.best_round,
      coins: a.coins, gems: a.gems, icon: a.icon, mapSkin: a.map_skin, clr: a.clr, nmx: a.nmx, created: ms(a.created_at),
      plays: {}, clears: {}, owned: inv.rows.map((r) => r.item_id), skins: {}, imm: {},
    };
    pc.rows.forEach((r) => { u.plays[r.diff] = r.plays; if (r.clears) u.clears[r.diff] = r.clears; });
    sk.rows.forEach((r) => (u.skins[r.unit_id] = r.skin_id));
    im.rows.forEach((r) => (u.imm[r.unit_id] = r.n));
    if (idn.rows[0]) { u.prov = idn.rows[0].provider; u.sub = idn.rows[0].subject; }
    if (a.guest_hash) { u.gsec = a.guest_hash; u.gsalt = a.guest_salt; }
    if (a.pw_hash) { u.pw = a.pw_hash; u.salt = a.pw_salt; }
    return u;
  }
  async function newId(prefix, qq) {
    for (;;) { const id = prefix + crypto.randomBytes(6).toString('hex'); if (!(await qq('SELECT 1 FROM accounts WHERE id = $1', [id])).rows.length) return id; }
  }
  // 전적 한 줄 + 판 수·클리어 수·해금 진행(트랜잭션 안에서 부른다)
  async function applyHist(qq, uid, h, extra) {
    const di = DIFFS.indexOf(h.diff);
    // 같은 판 열쇠는 한 번만(동시에 두 번 오면 고유 색인이 막고, 그 오류는 '이미 받음'으로 본다)
    if (extra.key && (await qq('SELECT 1 FROM games WHERE account_id = $1 AND result_key = $2', [uid, extra.key])).rows.length) return false;
    const ins = await qq(
      `INSERT INTO games (account_id, played_at, diff, mut, round, win, time_sec, online, mode, result_key, xp_gained, coins_gained, myth, stats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (account_id, result_key) DO NOTHING RETURNING id`,
      [uid, new Date(h.at), h.diff, h.mut, h.round, h.win, h.time, h.online, h.mode, extra.key || null, extra.xp || 0, extra.coins || 0, JSON.stringify(h.myth || {}), JSON.stringify(h.st || {})]);
    if (!ins.rows.length) return false;
    await qq(`INSERT INTO play_counts (account_id, diff, plays, clears) VALUES ($1, $2, 1, $3)
              ON CONFLICT (account_id, diff) DO UPDATE SET plays = play_counts.plays + 1, clears = play_counts.clears + EXCLUDED.clears`, [uid, h.diff, h.win ? 1 : 0]);
    if (h.win) {
      await qq('UPDATE accounts SET clr = GREATEST(clr, $2::smallint) WHERE id = $1', [uid, di]);
      if (h.diff === 'nightmare') await qq('UPDATE accounts SET nmx = GREATEST(nmx, $2::smallint) WHERE id = $1', [uid, h.mut]);
    }
    // 계정마다 전적은 최근 200판만 둔다
    await qq(`DELETE FROM games WHERE account_id = $1 AND id NOT IN (SELECT id FROM games WHERE account_id = $1 ORDER BY played_at DESC, id DESC LIMIT 200)`, [uid]);
    return true;
  }
  const ledger = (qq, uid, cur, delta, bal, reason, ref) =>
    qq('INSERT INTO currency_ledger (account_id, currency, delta, balance_after, reason, ref) VALUES ($1, $2, $3, $4, $5, $6)', [uid, cur, delta, bal, reason, ref || null]);

  return {
    kind: 'pg',
    ...require('./mod-pg')(pool, (id) => hydrate(id)), // 운영 제재(채팅 금지·계정 정지)·신고 열람: mod-pg.js
    flush: async () => {},
    close: async () => { if (pool.end) await pool.end(); },
    async userByToken(t) {
      if (!t) return null;
      const r = await q('SELECT account_id FROM sessions WHERE token_hash = $1 AND expires_at > now()', [sha(t)]);
      return r.rows[0] ? hydrate(r.rows[0].account_id) : null;
    },
    async issueToken(uid) {
      const t = newToken();
      await q('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3)', [sha(t), uid, new Date(Date.now() + TOKEN_MS)]);
      return t;
    },
    async revokeToken(t) { await q('DELETE FROM sessions WHERE token_hash = $1', [sha(t)]); },
    getUser: (id) => hydrate(String(id)),
    async createUser(prefix, f) {
      return tx(async (qq) => {
        const id = f.id || (await newId(prefix, qq));
        await qq(`INSERT INTO accounts (id, nick, guest_salt, guest_hash, pw_salt, pw_hash, terms_ver, agreed_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, f.nick, f.gsalt || null, f.gsec || null, f.salt || null, f.pw || null, f.agreed ? f.agreed.terms : null, new Date(f.agreed ? f.agreed.at : Date.now())]);
        if (f.prov && f.sub) await qq('INSERT INTO identities (provider, subject, account_id) VALUES ($1, $2, $3)', [f.prov, f.sub, id]);
        return hydrate(id, qq);
      });
    },
    async findByIdentity(prov, sub) {
      const r = await q('SELECT account_id FROM identities WHERE provider = $1 AND subject = $2', [prov, sub]);
      return r.rows[0] ? hydrate(r.rows[0].account_id) : null;
    },
    async linkIdentity(uid, prov, sub) {
      return tx(async (qq) => {
        await qq('INSERT INTO identities (provider, subject, account_id) VALUES ($1, $2, $3)', [prov, sub, uid]);
        await qq('UPDATE accounts SET guest_salt = NULL, guest_hash = NULL WHERE id = $1', [uid]);
        return hydrate(uid, qq);
      });
    },
    async addHistory(uid, h) { await tx((qq) => applyHist(qq, uid, h, {})); return hydrate(uid); },
    async history(uid) {
      const r = await q('SELECT * FROM games WHERE account_id = $1 ORDER BY played_at DESC, id DESC LIMIT 20', [uid]);
      return r.rows.map((g) => ({ at: ms(g.played_at), diff: g.diff, mut: g.mut, round: g.round, win: g.win, time: g.time_sec, online: g.online, mode: g.mode, myth: g.myth || {}, st: g.stats || {} }));
    },
    async buy(uid, item, cost) {
      return tx(async (qq) => {
        if ((await qq('SELECT 1 FROM inventory WHERE account_id = $1 AND item_id = $2', [uid, item])).rows.length) return 'owned';
        const up = await qq('UPDATE accounts SET coins = coins - $2::int WHERE id = $1 AND coins >= $2::int RETURNING coins', [uid, cost]);
        if (!up.rows.length) return 'coins';
        await qq('INSERT INTO inventory (account_id, item_id) VALUES ($1, $2)', [uid, item]);
        await ledger(qq, uid, 'coin', -cost, up.rows[0].coins, 'buy', item);
        return 'ok';
      });
    },
    // 해금: 보유 목록(inventory)에 열쇠를 넣는다(이미 있으면 그대로). 소급 해금·결제에 쓴다.
    async grantItems(uid, items) {
      for (const it of items) await q('INSERT INTO inventory (account_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [uid, it]);
      return hydrate(uid);
    },
    // 이 계정이 지금까지 소환한 신화·불멸 id(판 기록 games.myth + 불멸 소환 수)
    async everMyth(uid) {
      const r = await q('SELECT myth FROM games WHERE account_id = $1', [uid]); // 로그인당 한 번만 부른다(소급 해금)
      const im = await q('SELECT unit_id FROM immortal_counts WHERE account_id = $1 AND n > 0', [uid]);
      const out = new Set(im.rows.map((x) => x.unit_id));
      r.rows.forEach((x) => Object.keys((typeof x.myth === 'string' ? JSON.parse(x.myth) : x.myth) || {}).forEach((k) => out.add(k)));
      return [...out];
    },
    // 보상형 광고: 하루(since 이후) daily번까지 동전 coins. 계정 줄을 잠가 동시에 두 번 와도 상한을 넘지 않게 한다.
    async adReward(uid, coins, daily, since) {
      return tx(async (qq) => {
        await qq('SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE', [uid]);
        const n = +(await qq("SELECT count(*) AS n FROM currency_ledger WHERE account_id = $1 AND reason = 'ad' AND created_at >= $2", [uid, new Date(since)])).rows[0].n;
        if (n >= daily) return { ok: false, left: 0 };
        const up = await qq('UPDATE accounts SET coins = coins + $2::int WHERE id = $1 RETURNING coins', [uid, coins]);
        await ledger(qq, uid, 'coin', coins, up.rows[0].coins, 'ad', null);
        return { ok: true, left: daily - n - 1 };
      });
    },
    // 앱스토어 결제(해금 상품): 같은 거래 번호는 한 번만. 표 구조는 그대로(purchases.gems = 0).
    async grantIap(uid, txId, productId, items, at) {
      return tx(async (qq) => {
        const ins = await qq('INSERT INTO purchases (transaction_id, account_id, product_id, gems, purchased_at) VALUES ($1, $2, $3, 0, $4) ON CONFLICT DO NOTHING RETURNING transaction_id', [txId, uid, productId, new Date(at || Date.now())]);
        if (!ins.rows.length) {
          const own = (await qq('SELECT account_id FROM purchases WHERE transaction_id = $1', [txId])).rows[0];
          if (!own || own.account_id !== uid) return 'other';
        }
        for (const it of items) await qq('INSERT INTO inventory (account_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [uid, it]);
        return 'ok';
      });
    },
    async equip(uid, e) {
      if (e.icon) await q('UPDATE accounts SET icon = $2 WHERE id = $1', [uid, e.icon]);
      if (e.mapSkin) await q('UPDATE accounts SET map_skin = $2 WHERE id = $1', [uid, e.mapSkin]);
      if (e.unit) {
        if (e.skin) await q(`INSERT INTO unit_skins (account_id, unit_id, skin_id) VALUES ($1, $2, $3)
                             ON CONFLICT (account_id, unit_id) DO UPDATE SET skin_id = EXCLUDED.skin_id`, [uid, e.unit, e.skin]);
        else await q('DELETE FROM unit_skins WHERE account_id = $1 AND unit_id = $2', [uid, e.unit]);
      }
      return hydrate(uid);
    },
    async setFields(uid, f) {
      if (f.track) await q('UPDATE accounts SET track = $2 WHERE id = $1', [uid, f.track]);
      if (f.nick) await q('UPDATE accounts SET nick = $2 WHERE id = $1', [uid, f.nick]);
      return hydrate(uid);
    },
    async report(r) {
      await q('INSERT INTO reports (reporter_id, target_id, nick, text, room) VALUES ($1, $2, $3, $4, $5)', [r.by, r.target || null, r.nick, r.text, r.room]);
    },
    async recordResult(uid, r) {
      return tx(async (qq) => {
        // (동시에 같은 열쇠가 들어와 고유 색인에 걸리면 아래 catch에서 false)
        if (!(await applyHist(qq, uid, r.hist, { key: r.key, xp: r.xp, coins: r.coins }))) return false;
        const up = await qq(`UPDATE accounts SET xp = xp + $2::int, games = games + 1, wins = wins + $3::int, best_round = GREATEST(best_round, $4::int), coins = coins + $5::int
                             WHERE id = $1 RETURNING coins, nick, icon`, [uid, r.xp, r.win ? 1 : 0, r.round, r.coins]);
        const a = up.rows[0];
        if (r.coins) await ledger(qq, uid, 'coin', r.coins, a.coins, 'result', r.key);
        for (const id of Object.keys(r.imm || {})) {
          await qq(`INSERT INTO immortal_counts (account_id, unit_id, n) VALUES ($1, $2, $3)
                    ON CONFLICT (account_id, unit_id) DO UPDATE SET n = immortal_counts.n + EXCLUDED.n`, [uid, id, r.imm[id]]);
        }
        if (r.clear) {
          const c = r.clear;
          const rec = await qq(`INSERT INTO clear_records (diff, party_key, time_sec, mut) VALUES ($1, $2, $3, $4)
                                ON CONFLICT (diff, party_key) DO UPDATE SET time_sec = LEAST(clear_records.time_sec, EXCLUDED.time_sec) RETURNING id`, [c.diff, c.party, c.time, c.mut]);
          const rid = rec.rows[0].id;
          const mem = (await qq('SELECT slot, account_id FROM clear_members WHERE record_id = $1', [rid])).rows;
          if (!mem.some((m) => m.account_id === uid) && mem.length < 5) {
            await qq('INSERT INTO clear_members (record_id, slot, account_id, nick, icon) VALUES ($1, $2, $3, $4, $5)', [rid, mem.length, uid, a.nick, a.icon]);
          }
        }
        return true;
      }).catch((e) => { if (e.code === '23505') return false; throw e; });
    },
    // ---------- 미션(2026-11-18): 일일 미션 진행·받기, 첫 클리어 보상 받기. json.js와 함수 모양이 같다 ----------
    // day = 일본 시간 날짜 글자('2026-11-18'). 지난 날의 줄은 진행을 적을 때 지운다(계정마다 그날 것만 남는다).
    async missionProgress(uid, day, ids) {
      await tx(async (qq) => {
        await qq('DELETE FROM mission_daily WHERE account_id = $1 AND day <> $2', [uid, day]);
        for (const id of ids) {
          await qq(`INSERT INTO mission_daily (account_id, day, mission_id, n) VALUES ($1, $2, $3, 1)
                    ON CONFLICT (account_id, day, mission_id) DO UPDATE SET n = mission_daily.n + 1`, [uid, day, id]);
        }
      });
    },
    async missionState(uid, day) {
      const d = await q('SELECT mission_id, n, claimed_at FROM mission_daily WHERE account_id = $1 AND day = $2', [uid, day]);
      const f = await q('SELECT mission_id FROM mission_claims WHERE account_id = $1', [uid]);
      const daily = {}; d.rows.forEach((r) => (daily[r.mission_id] = { n: r.n, claimed: !!r.claimed_at }));
      return { daily, firsts: f.rows.map((r) => r.mission_id) };
    },
    // m = { id, coins, day, need }(일일: 그날 need번 채웠고 아직 안 받았을 때만) 또는 { id, coins }(첫 클리어: 한 번만. 조건은 부르는 쪽이 본다). 'ok' | 'no'
    // 받았다는 표시와 동전 지급·원장 기록을 트랜잭션 하나로 한다(동시에 두 번 와도 한 번만).
    async missionClaim(uid, m) {
      return tx(async (qq) => {
        await qq('SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE', [uid]);
        if (m.day) {
          const up = await qq('UPDATE mission_daily SET claimed_at = $5 WHERE account_id = $1 AND day = $2 AND mission_id = $3 AND n >= $4::int AND claimed_at IS NULL RETURNING n', [uid, m.day, m.id, m.need, new Date()]);
          if (!up.rows.length) return 'no';
        } else {
          const ins = await qq('INSERT INTO mission_claims (account_id, mission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING mission_id', [uid, m.id]);
          if (!ins.rows.length) return 'no';
        }
        const a = await qq('UPDATE accounts SET coins = coins + $2::int WHERE id = $1 RETURNING coins', [uid, m.coins]);
        await ledger(qq, uid, 'coin', m.coins, a.rows[0].coins, 'mission', m.day ? m.day + ':' + m.id : m.id);
        return 'ok';
      }).catch((e) => { if (e.code === '23505') return 'no'; throw e; });
    },
    async deleteUser(uid) { await q('DELETE FROM accounts WHERE id = $1', [uid]); },
    // ---------- Sign in with Apple refresh token(2026-11-20). json.js와 함수 모양이 같다 ----------
    async putAppleToken(sub, token) {
      await q('INSERT INTO apple_tokens (subject, refresh_token, updated_at) VALUES ($1, $2, now()) ON CONFLICT (subject) DO UPDATE SET refresh_token = EXCLUDED.refresh_token, updated_at = now()', [sub, token]);
    },
    async appleToken(sub) { const r = await q('SELECT refresh_token FROM apple_tokens WHERE subject = $1', [sub]); return r.rows[0] ? r.rows[0].refresh_token : null; },
    async dropAppleToken(sub, token) {
      if (token) await q('DELETE FROM apple_tokens WHERE subject = $1 AND refresh_token = $2', [sub, token]);
      else await q('DELETE FROM apple_tokens WHERE subject = $1', [sub]);
    },
    async orphanAppleTokens(before) {
      const r = await q("SELECT t.subject, t.refresh_token FROM apple_tokens t LEFT JOIN identities i ON i.provider = 'apple' AND i.subject = t.subject WHERE i.subject IS NULL AND t.updated_at < $1 LIMIT 100", [new Date(before)]);
      return r.rows.map((x) => ({ sub: x.subject, token: x.refresh_token }));
    },
    async rankLevel(n) {
      const r = await q('SELECT id FROM accounts ORDER BY xp DESC, created_at LIMIT $1', [n]);
      return Promise.all(r.rows.map((x) => hydrate(x.id)));
    },
    async rankClear(diff, n) {
      const recs = (await q('SELECT * FROM clear_records WHERE diff = $1 ORDER BY time_sec, cleared_at LIMIT $2', [diff, n])).rows;
      return Promise.all(recs.map(async (c) => {
        const mem = (await q('SELECT account_id, nick, icon FROM clear_members WHERE record_id = $1 ORDER BY slot', [c.id])).rows;
        return { time: c.time_sec, mut: c.mut, at: ms(c.cleared_at), members: await Promise.all(mem.map(async (m) => ({ id: m.account_id, nick: m.nick, icon: m.icon, user: m.account_id ? await hydrate(m.account_id) : null }))) };
      }));
    },
    async rankImm(id, n) {
      const r = await q('SELECT account_id, n FROM immortal_counts WHERE unit_id = $1 AND n > 0 ORDER BY n DESC LIMIT $2', [id, n]);
      return Promise.all(r.rows.map(async (x) => ({ user: await hydrate(x.account_id), n: x.n })));
    },
  };
};
