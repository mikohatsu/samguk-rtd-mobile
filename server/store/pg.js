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
  const itemList = (x) => { try { const a = JSON.parse(x || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; } };

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
    // 2026-11-26(secure-a): 이어하기 칸(표 번호), 마지막 보상 시각, 오늘(일본 시간) 받은 판 보상, 회수로 생긴 동전 빚
    u.saveTk = a.save_tk || null; u.lastReward = ms(a.last_reward_at);
    u.rankXp = a.rank_xp == null ? a.xp : a.rank_xp;
    u.rday = { k: a.reward_day || null, xp: a.reward_day_xp | 0, coins: a.reward_day_coins | 0 }; u.coinDebt = a.coin_debt | 0;
    return u;
  }
  async function newId(prefix, qq) {
    for (;;) { const id = prefix + crypto.randomBytes(6).toString('hex'); if (!(await qq('SELECT 1 FROM accounts WHERE id = $1', [id])).rows.length) return id; }
  }
  // 전적 한 줄 + 판 수·클리어 수·해금 진행(트랜잭션 안에서 부른다)
  async function applyHist(qq, uid, h, extra) {
    const pd = h.pdiff || h.diff, pm = h.pmut != null ? h.pmut : h.mut; // 진행용(깬 난이도 + 1까지). h.diff는 전적에 보이는 실제 난이도
    const di = DIFFS.indexOf(pd);
    // 같은 판 열쇠는 한 번만(동시에 두 번 오면 고유 색인이 막고, 그 오류는 '이미 받음'으로 본다)
    if (extra.key && (await qq('SELECT 1 FROM games WHERE account_id = $1 AND result_key = $2', [uid, extra.key])).rows.length) return false;
    const ins = await qq(
      `INSERT INTO games (account_id, played_at, diff, mut, round, win, time_sec, online, mode, result_key, xp_gained, coins_gained, myth, stats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (account_id, result_key) DO NOTHING RETURNING id`,
      [uid, new Date(h.at), h.diff, h.mut, h.round, h.win, h.time, h.online, h.mode, extra.key || null, extra.xp || 0, extra.coins || 0, JSON.stringify(h.myth || {}), JSON.stringify(h.st || {})]);
    if (!ins.rows.length) return false;
    await qq(`INSERT INTO play_counts (account_id, diff, plays, clears) VALUES ($1, $2, 1, $3)
              ON CONFLICT (account_id, diff) DO UPDATE SET plays = play_counts.plays + 1, clears = play_counts.clears + EXCLUDED.clears`, [uid, pd, h.win ? 1 : 0]);
    if (h.win) {
      await qq('UPDATE accounts SET clr = GREATEST(clr, $2::smallint) WHERE id = $1', [uid, di]);
      if (pd === 'nightmare') await qq('UPDATE accounts SET nmx = GREATEST(nmx, $2::smallint) WHERE id = $1', [uid, pm]);
    }
    // 계정마다 전적은 최근 200판만 둔다
    await qq(`DELETE FROM games WHERE account_id = $1 AND id NOT IN (SELECT id FROM games WHERE account_id = $1 ORDER BY played_at DESC, id DESC LIMIT 200)`, [uid]);
    return true;
  }
  const ledger = (qq, uid, cur, delta, bal, reason, ref) =>
    qq('INSERT INTO currency_ledger (account_id, currency, delta, balance_after, reason, ref) VALUES ($1, $2, $3, $4, $5, $6)', [uid, cur, delta, bal, reason, ref || null]);
  // 회수로 생긴 동전 빚(coin_debt)을 지금 잔액에서 먼저 갚는다. 동전이 들어오는 트랜잭션 끝에서 부른다(계정 줄은 이미 잠겨 있다)
  async function payDebt(qq, uid, ref) {
    const a = (await qq('SELECT coins, coin_debt FROM accounts WHERE id = $1', [uid])).rows[0];
    const p = a ? Math.min(a.coins | 0, a.coin_debt | 0) : 0;
    if (p <= 0) return 0;
    const up = await qq('UPDATE accounts SET coins = coins - $2::int, coin_debt = coin_debt - $2::int WHERE id = $1 RETURNING coins', [uid, p]);
    await ledger(qq, uid, 'coin', -p, up.rows[0].coins, 'debt', ref);
    return p;
  }
  const jsn = (x) => { if (x && typeof x === 'object') return x; try { return JSON.parse(x || '{}') || {}; } catch (e) { return {}; } };
  // 판 결과 한 줄(results)을 바깥에 보이는 모양으로
  const resView = (r) => (r ? {
    id: r.id, uid: r.account_id, kind: r.kind, online: r.online, verify: r.verify, issuedAt: ms(r.issued_at), reportedAt: ms(r.reported_at),
    diff: r.diff, played: r.played, mut: r.mut, round: r.round, win: r.win, time: r.time_sec, seats: r.seats, seed: r.seed, room: r.room,
    xp: r.xp, coins: r.coins, verifiedAt: ms(r.verified_at), note: r.verify_note, revokedAt: ms(r.revoked_at), revokeCoins: r.revoke_coins | 0,
  } : null);
  const claimDel = async (qq, uid, mid) => (await qq('DELETE FROM mission_claims WHERE account_id = $1 AND mission_id = $2 RETURNING mission_id', [uid, mid])).rows.length > 0;

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
        await qq(`INSERT INTO accounts (id, nick, guest_salt, guest_hash, pw_salt, pw_hash, terms_ver, agreed_at, rank_xp)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
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
        await payDebt(qq, uid, 'ad');
        return { ok: true, left: daily - n - 1 };
      });
    },
    // 앱스토어 결제(해금 상품): 같은 거래 번호는 한 번만. purchases.gems = 0.
    // 돌려주는 값: 'ok' / 'other'(다른 계정의 거래) / 'refunded'(환불된 거래 — 옛 영수증으로 다시 열지 못한다)
    // env = 결제 환경(Production / Sandbox / Test). 이 거래로 새로 들어간 열쇠만 items에 적어 둔다(환불 때 그것만 뺀다).
    async grantIap(uid, txId, productId, items, at, env) {
      return tx(async (qq) => {
        await qq('INSERT INTO purchases (transaction_id, account_id, product_id, gems, purchased_at, environment, items) VALUES ($1, $2, $3, 0, $4, $5, $6) ON CONFLICT DO NOTHING', [txId, uid, productId, new Date(at || Date.now()), env || null, '[]']);
        const row = (await qq('SELECT account_id, status, items FROM purchases WHERE transaction_id = $1 FOR UPDATE', [txId])).rows[0];
        if (!row || row.account_id !== uid) return 'other';
        if (row.status === 'refunded') return 'refunded';
        const added = [];
        for (const it of items) if ((await qq('INSERT INTO inventory (account_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING item_id', [uid, it])).rows.length) added.push(it);
        if (added.length) await qq('UPDATE purchases SET items = $2 WHERE transaction_id = $1', [txId, JSON.stringify([...new Set(itemList(row.items).concat(added))])]);
        return 'ok';
      });
    },
    // 환불 회수: 거래를 refunded로 바꾸고 그 거래로 들어간 열쇠를 뺀다. 같은 계정의 다른 유효 결제(itemsOf(상품))가 주는 열쇠는 남긴다.
    // items가 비어 있는 옛 줄(이 기능 전 결제)은 상품의 열쇠 전체에서 동전으로 산 것(장부 reason='buy')을 빼고 회수한다. 재화는 건드리지 않는다.
    // 돌려주는 값 { result: 'ok' | 'already' | 'unknown', uid, removed }
    async revokeIap(txId, itemsOf) {
      return tx(async (qq) => {
        const row = (await qq('SELECT account_id, product_id, status, items FROM purchases WHERE transaction_id = $1 FOR UPDATE', [txId])).rows[0];
        if (!row) return { result: 'unknown', removed: [] };
        if (row.status === 'refunded') return { result: 'already', uid: row.account_id, removed: [] };
        await qq("UPDATE purchases SET status = 'refunded', refunded_at = now() WHERE transaction_id = $1", [txId]);
        const uid = row.account_id;
        if (!uid) return { result: 'ok', uid: null, removed: [] }; // 계정을 지운 뒤의 환불
        const legacy = row.items == null, keep = new Set();
        (await qq("SELECT product_id FROM purchases WHERE account_id = $1 AND status = 'granted' AND transaction_id <> $2", [uid, txId])).rows.forEach((o) => (itemsOf(o.product_id) || []).forEach((k) => keep.add(k)));
        if (legacy) (await qq("SELECT ref FROM currency_ledger WHERE account_id = $1 AND reason = 'buy'", [uid])).rows.forEach((l) => keep.add(l.ref));
        const removed = (legacy ? (itemsOf(row.product_id) || []) : itemList(row.items)).filter((k) => !keep.has(k));
        for (const k of removed) await qq('DELETE FROM inventory WHERE account_id = $1 AND item_id = $2', [uid, k]);
        return { result: 'ok', uid, removed };
      });
    },
    // 결제 기록 한 줄(시험·운영 확인용)
    async purchase(txId) {
      const r = (await q('SELECT transaction_id, account_id, product_id, status, environment, items FROM purchases WHERE transaction_id = $1', [txId])).rows[0];
      return r ? { txId: r.transaction_id, uid: r.account_id, productId: r.product_id, status: r.status, env: r.environment, items: itemList(r.items) } : null;
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
    // 판 결과(2026-11-26 secure-a로 넓힘): 전적·경험치·동전·불멸·클리어 기록·결과 한 줄(results)을 트랜잭션 하나로.
    // r = { key, xp, coins(상한 전 몫), win, round, hist, imm, clear, slot(이어하기 표 번호 또는 null), day(일본 시간 날짜), caps: { xp, coins }(하루 상한),
    //       setLast(마지막 보상 시각을 지금으로), meta: { kind, online, issuedAt, diff, played, mut, time, seats, seed, room, verify } }
    // 돌려주는 값: false(같은 열쇠로 이미 받음) / { why: 'replaced' }(이어하기 칸이 바뀜) / { ok: true, xp, coins }(하루 상한을 적용해 실제로 준 양)
    async recordResult(uid, r) {
      return tx(async (qq) => {
        const a = (await qq('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [uid])).rows[0];
        if (!a) return false;
        if (r.slot && a.save_tk !== r.slot) return { why: 'replaced' }; // 칸 비교와 비우기를 같은 잠금 안에서(동시에 두 번 와도 한 번만)
        const sameDay = !!r.day && a.reward_day === r.day, cap = r.caps || {};
        const usedX = sameDay ? a.reward_day_xp | 0 : 0, usedC = sameDay ? a.reward_day_coins | 0 : 0;
        const xp = Math.max(0, Math.min(r.xp | 0, cap.xp == null ? Infinity : cap.xp - usedX));
        const coins = Math.max(0, Math.min(r.coins | 0, cap.coins == null ? Infinity : cap.coins - usedC));
        // (동시에 같은 열쇠가 들어와 고유 색인에 걸리면 아래 catch에서 false)
        if (!(await applyHist(qq, uid, r.hist, { key: r.key, xp, coins }))) return false;
        const up = await qq(`UPDATE accounts SET xp = xp + $2::int, games = games + 1, wins = wins + $3::int, best_round = GREATEST(best_round, $4::int), coins = coins + $5::int,
                               reward_day = $6, reward_day_xp = $7::int, reward_day_coins = $8::int, rank_xp = COALESCE(rank_xp, xp)
                             WHERE id = $1 RETURNING coins, nick, icon`, [uid, xp, r.win ? 1 : 0, r.round, coins, r.day || null, usedX + xp, usedC + coins]);
        if (r.setLast) await qq('UPDATE accounts SET last_reward_at = $2 WHERE id = $1', [uid, new Date()]);
        if (r.slot) await qq('UPDATE accounts SET save_tk = NULL, save_tk_at = NULL WHERE id = $1', [uid]);
        const na = up.rows[0];
        if (coins) { await ledger(qq, uid, 'coin', coins, na.coins, 'result', r.key); await payDebt(qq, uid, r.key); }
        // 순위(최단 클리어 줄·불멸 소환 수)는 여기서 넣지 않는다: 재연산 검증이 ok인 판만 순위에 오른다(2026-11-26 사용자 결정 "검증된 거만 올리게 해줘 랭킹은").
        // 후보(clear_*·imm)만 결과 줄에 적어 두고 confirmResult(ok) 때 넣는다. 예전 표 판(legacy)은 검증할 수 없어 순위에 오르지 않는다.
        const clearPrev = null;
        const m = r.meta || {}, c = r.clear;
        await qq(`INSERT INTO results (id, account_id, issued_at, kind, online, diff, played, mut, round, win, time_sec, seats, seed, room, xp, coins,
                                       prev_clr, prev_nmx, prev_best, clear_board, clear_party, clear_time, clear_mut, clear_prev, imm, verify)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
          [r.key, uid, new Date(m.issuedAt || Date.now()), m.kind || 'legacy', !!m.online, m.diff || r.hist.pdiff || r.hist.diff, m.played || r.hist.diff, m.mut | 0, r.round | 0, !!r.win, m.time | 0, m.seats | 0,
            m.seed ? m.seed | 0 : null, m.room || null, xp, coins, a.clr, a.nmx, a.best_round | 0, c ? c.diff : null, c ? c.party : null, c ? c.time : null, c ? c.mut : null, clearPrev,
            JSON.stringify(r.imm || {}), m.verify || 'pending']);
        return { ok: true, xp, coins };
      }).catch((e) => { if (e.code === '23505') return false; throw e; });
    },
    // ---------- 판 결과 검증·회수(2026-11-26 secure-a). 재연산 작업자(B)가 확정(ok)·회수(bad)를 부른다(app.js confirmResult·revokeResult) ----------
    // 이어하기 칸: 혼자 새 판의 표 번호를 적는다(앞 표는 이 순간 무효)
    async setSaveSlot(uid, n) { await q('UPDATE accounts SET save_tk = $2, save_tk_at = $3 WHERE id = $1', [uid, n, new Date()]); },
    // 이 열쇠(tk-<번호>)로 이미 결과를 받았는지(업데이트 전 판은 games.result_key에만 있다)
    async resultExists(uid, key) {
      if ((await q('SELECT 1 FROM results WHERE id = $1', [key])).rows.length) return true;
      return (await q('SELECT 1 FROM games WHERE account_id = $1 AND result_key = $2', [uid, key])).rows.length > 0;
    },
    async result(id) { return resView((await q('SELECT * FROM results WHERE id = $1', [String(id)])).rows[0]); },
    // 재연산 대기열: 검증 상태 pending인 판, 오래된 것부터
    async pendingResults(n) { return (await q("SELECT * FROM results WHERE verify = 'pending' ORDER BY reported_at, id LIMIT $1", [Math.max(1, Math.min(1000, (n | 0) || 100))])).rows.map(resView); },
    // 이 판으로 준 한 번짜리 보상(업적 첫 달성·관직 승급). 회수 때 같이 되돌린다. g = { ach: [{ id, coins }], ranks: [{ id, rank, coins }] }
    async noteResultGrants(id, g) { await q('UPDATE results SET grants = $2 WHERE id = $1', [id, JSON.stringify(g || {})]); },
    // 확정: pending → ok(재연산이 맞음) 또는 norec(입력 기록이 없어 재연산 못 함). 돌려주는 값 { result: 'ok' | 'unknown' | 'legacy' | 'already' }
    // ok면 그 판의 순위 후보(최단 클리어 줄·불멸 소환 수)를 이때 순위에 넣는다(ranked). norec는 순위에 넣지 않는다.
    async confirmResult(id, note, to) {
      return tx(async (qq) => {
        const row = (await qq('SELECT * FROM results WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (!row) return { result: 'unknown' };
        if (row.verify !== 'pending') return { result: row.verify === 'legacy' ? 'legacy' : 'already', verify: row.verify };
        const ok = to !== 'norec', uid = row.account_id;
        let ranked = false, clearPrev = null;
        if (ok) {
          await qq('UPDATE accounts SET rank_xp = COALESCE(rank_xp, 0) + $2::int WHERE id = $1', [uid, row.xp | 0]); // 레벨 순위 값
          const a = (await qq('SELECT nick, icon FROM accounts WHERE id = $1', [uid])).rows[0];
          for (const [unit, n] of Object.entries(jsn(row.imm))) {
            await qq(`INSERT INTO immortal_counts (account_id, unit_id, n) VALUES ($1, $2, $3)
                      ON CONFLICT (account_id, unit_id) DO UPDATE SET n = immortal_counts.n + EXCLUDED.n`, [uid, unit, n | 0]);
            ranked = true;
          }
          if (row.clear_board && a) {
            const had = (await qq('SELECT time_sec FROM clear_records WHERE diff = $1 AND party_key = $2', [row.clear_board, row.clear_party])).rows[0];
            clearPrev = had ? had.time_sec : null;
            const rec = await qq(`INSERT INTO clear_records (diff, party_key, time_sec, mut) VALUES ($1, $2, $3, $4)
                                  ON CONFLICT (diff, party_key) DO UPDATE SET time_sec = LEAST(clear_records.time_sec, EXCLUDED.time_sec) RETURNING id`, [row.clear_board, row.clear_party, row.clear_time, row.clear_mut | 0]);
            const rid = rec.rows[0].id;
            const mem = (await qq('SELECT slot, account_id FROM clear_members WHERE record_id = $1', [rid])).rows;
            if (!mem.some((x) => x.account_id === uid) && mem.length < 5) {
              const slot = mem.reduce((mx, x) => Math.max(mx, x.slot + 1), 0); // 회수로 빠진 자리가 있어도 겹치지 않게
              await qq('INSERT INTO clear_members (record_id, slot, account_id, nick, icon) VALUES ($1, $2, $3, $4, $5)', [rid, slot, uid, a.nick, a.icon]);
            }
            ranked = true;
          }
        }
        await qq('UPDATE results SET verify = $4, verified_at = $3, verify_note = $2, ranked = $5, clear_prev = $6 WHERE id = $1', [id, note || null, new Date(), ok ? 'ok' : 'norec', ranked, clearPrev]);
        return { result: 'ok', ranked };
      });
    },
    // 회수: 그 판으로 준 경험치·동전·난이도 진행·첫 클리어·업적·관직 승급·불멸 수·순위·전적 한 줄을 되돌리고 검증 상태를 bad로.
    // o = { firsts: [{ id, coins, diff | mut }], rankOfXp(xp), why }. 동전은 잔액에서 빼고 모자라면 빚(coin_debt)으로 남긴다(다음 수입에서 먼저 갚음).
    // 돌려주는 값 { result: 'ok' | 'unknown' | 'legacy' | 'already', uid, xp, coins(되돌린 동전 합), taken(잔액에서 뺀 것), debt(빚으로 남긴 것) }
    async revokeResult(id, o) {
      return tx(async (qq) => {
        const row = (await qq('SELECT * FROM results WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (!row) return { result: 'unknown' };
        if (row.verify === 'legacy') return { result: 'legacy', uid: row.account_id };
        if (row.verify === 'bad') return { result: 'already', uid: row.account_id };
        const uid = row.account_id, a = (await qq('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [uid])).rows[0];
        let owed = row.coins | 0;
        const newXp = Math.max(0, (a.xp | 0) - (row.xp | 0)), g = jsn(row.grants);
        for (const x of g.ach || []) if (await claimDel(qq, uid, x.id)) owed += x.coins | 0;
        for (const x of g.ranks || []) if (o.rankOfXp(newXp) < x.rank && (await claimDel(qq, uid, x.id))) owed += x.coins | 0;
        // 전적 한 줄·판 수·클리어 수
        await qq('DELETE FROM games WHERE account_id = $1 AND result_key = $2', [uid, id]);
        await qq('UPDATE play_counts SET plays = GREATEST(0, plays - 1), clears = GREATEST(0, clears - $3::int) WHERE account_id = $1 AND diff = $2', [uid, row.diff, row.win ? 1 : 0]);
        // 난이도 진행: 이 판 앞의 값과, 회수되지 않은 다른 승리 판 가운데 큰 쪽(지금 값보다 올리지는 않는다)
        const others = (await qq("SELECT diff, mut, round, win FROM results WHERE account_id = $1 AND id <> $2 AND verify <> 'bad'", [uid, id])).rows;
        const wins = others.filter((x) => x.win);
        const clr = row.win ? Math.min(a.clr, Math.max(row.prev_clr, ...wins.map((x) => DIFFS.indexOf(x.diff)))) : a.clr;
        const nmx = row.win ? Math.min(a.nmx, Math.max(row.prev_nmx, ...wins.filter((x) => x.diff === 'nightmare').map((x) => x.mut | 0))) : a.nmx;
        const best = Math.min(a.best_round, Math.max(row.prev_best | 0, ...others.map((x) => x.round | 0)));
        // 난이도 첫 클리어: 되돌린 진행으로 조건이 깨지면 받은 표시를 지우고 동전을 돌려받는다(다시 깨면 다시 받는다)
        for (const f of o.firsts || []) {
          const done = f.mut ? nmx >= f.mut : clr >= DIFFS.indexOf(f.diff);
          if (!done && (await claimDel(qq, uid, f.id))) owed += f.coins | 0;
        }
        // 순위는 confirmResult(ok)로 넣은 판(ranked)만 되돌린다(검증 전에 회수된 판은 순위에 들어간 적이 없다)
        if (row.verify === 'ok') await qq('UPDATE accounts SET rank_xp = GREATEST(0, COALESCE(rank_xp, 0) - $2::int) WHERE id = $1', [uid, row.xp | 0]);
        if (row.ranked) for (const [unit, n] of Object.entries(jsn(row.imm))) await qq('UPDATE immortal_counts SET n = GREATEST(0, n - $3::int) WHERE account_id = $1 AND unit_id = $2', [uid, unit, n | 0]);
        // 순위: 그 줄을 이 판을 넣기 전의 기록과, 같은 줄에 들어간(ranked) 회수되지 않은 다른 판으로 다시 맞춘다
        if (row.ranked && row.clear_board) {
          const rec = (await qq('SELECT id FROM clear_records WHERE diff = $1 AND party_key = $2', [row.clear_board, row.clear_party])).rows[0];
          if (rec) {
            const rest = (await qq("SELECT account_id, clear_time FROM results WHERE clear_board = $1 AND clear_party = $2 AND id <> $3 AND verify = 'ok' AND ranked = true", [row.clear_board, row.clear_party, id])).rows;
            const times = rest.map((x) => x.clear_time).concat(row.clear_prev != null ? [row.clear_prev] : []);
            if (!times.length) await qq('DELETE FROM clear_records WHERE id = $1', [rec.id]);
            else {
              await qq('UPDATE clear_records SET time_sec = $2 WHERE id = $1', [rec.id, Math.min(...times)]);
              if (!rest.some((x) => x.account_id === uid) && row.clear_prev == null) await qq('DELETE FROM clear_members WHERE record_id = $1 AND account_id = $2', [rec.id, uid]);
            }
          }
        }
        const take = Math.min(a.coins | 0, owed), debt = owed - take;
        const up = await qq(`UPDATE accounts SET xp = $2::int, coins = coins - $3::int, coin_debt = coin_debt + $4::int, clr = $5::smallint, nmx = $6::smallint, best_round = $7::int,
                               games = GREATEST(0, games - 1), wins = GREATEST(0, wins - $8::int) WHERE id = $1 RETURNING coins`, [uid, newXp, take, debt, clr, nmx, best, row.win ? 1 : 0]);
        if (take) await ledger(qq, uid, 'coin', -take, up.rows[0].coins, 'revoke', id);
        await qq("UPDATE results SET verify = 'bad', verified_at = $4, revoked_at = $4, verify_note = $2, revoke_coins = $3::int, ranked = false WHERE id = $1", [id, o.why || null, owed, new Date()]);
        return { result: 'ok', uid, xp: row.xp | 0, coins: owed, taken: take, debt };
      });
    },
    // 다음 접속 때 알릴 회수 목록(아직 알리지 않은 것)과 '봤음' 표시
    async revokedUnseen(uid) {
      return (await q("SELECT * FROM results WHERE account_id = $1 AND verify = 'bad' AND revoked_at IS NOT NULL AND notified = false ORDER BY revoked_at LIMIT 20", [uid])).rows
        .map((r) => ({ id: r.id, diff: r.played, mut: r.mut, round: r.round, win: r.win, at: ms(r.reported_at), xp: r.xp, coins: r.revoke_coins | 0 }));
    },
    async ackRevoked(uid, ids) { for (const id of (ids || []).slice(0, 50)) await q('UPDATE results SET notified = true WHERE account_id = $1 AND id = $2', [uid, String(id)]); },
    // ---------- 미션(2026-11-18): 일일 미션 진행·받기, 첫 클리어 보상 받기. json.js와 함수 모양이 같다 ----------
    // day = 일본 시간 날짜 글자('2026-11-18'). 지난 날의 줄은 진행을 적을 때 지운다(계정마다 그날 것만 남는다).
    // ids = 미션 id 목록(각 +1) 또는 { 미션 id: 더할 양 }(2026-11-24)
    async missionProgress(uid, day, ids) {
      const add = Array.isArray(ids) ? ids.map((id) => [id, 1]) : Object.entries(ids || {});
      await tx(async (qq) => {
        await qq('DELETE FROM mission_daily WHERE account_id = $1 AND day <> $2', [uid, day]);
        for (const [id, n] of add) {
          await qq(`INSERT INTO mission_daily (account_id, day, mission_id, n) VALUES ($1, $2, $3, $4::int)
                    ON CONFLICT (account_id, day, mission_id) DO UPDATE SET n = mission_daily.n + EXCLUDED.n`, [uid, day, id, Math.max(0, n | 0)]);
        }
      });
    },
    async missionState(uid, day) {
      const d = await q('SELECT mission_id, n, claimed_at FROM mission_daily WHERE account_id = $1 AND day = $2', [uid, day]);
      const f = await q('SELECT mission_id FROM mission_claims WHERE account_id = $1', [uid]);
      const daily = {}; d.rows.forEach((r) => (daily[r.mission_id] = { n: r.n, claimed: !!r.claimed_at }));
      return { daily, firsts: f.rows.map((r) => r.mission_id) };
    },
    // m.xp(일일 미션 경험치, 2026-11-24)가 있으면 경험치도 더한다.
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
        const a = await qq('UPDATE accounts SET coins = coins + $2::int, xp = xp + $3::int, rank_xp = COALESCE(rank_xp, xp) + $3::int WHERE id = $1 RETURNING coins', [uid, m.coins, Math.max(0, m.xp | 0)]);
        await ledger(qq, uid, 'coin', m.coins, a.rows[0].coins, 'mission', m.day ? m.day + ':' + m.id : m.id);
        await payDebt(qq, uid, m.id);
        return 'ok';
      }).catch((e) => { if (e.code === '23505') return 'no'; throw e; });
    },
    // 한 번만 주는 보상(관직 승급 'rk_<계급>'·업적 첫 달성 'a_<id>', 2026-11-24). list = [{ id, coins, reason }]. 돌려주는 값: 이번에 준 id 목록.
    // 받은 표시는 mission_claims(첫 클리어와 같은 표)에 한 줄. 표시·동전·원장을 트랜잭션 하나로(동시에 두 번 와도 한 번만).
    async grantOnce(uid, list) {
      return tx(async (qq) => {
        await qq('SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE', [uid]);
        const got = [];
        for (const x of list) {
          const ins = await qq('INSERT INTO mission_claims (account_id, mission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING mission_id', [uid, x.id]);
          if (!ins.rows.length) continue;
          got.push(x.id);
          if (x.coins > 0) {
            const a = await qq('UPDATE accounts SET coins = coins + $2::int WHERE id = $1 RETURNING coins', [uid, x.coins]);
            await ledger(qq, uid, 'coin', x.coins, a.rows[0].coins, x.reason || 'once', x.id);
          }
        }
        if (got.length) await payDebt(qq, uid, 'once');
        return got;
      }).catch((e) => { if (e.code === '23505') return []; throw e; });
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
    // 레벨 순위: 검증 ok가 아닌 판(pending·norec·legacy)으로 받은 경험치는 빼고 줄 세운다(2026-11-26 "검증된 거만"). 업데이트 전 경험치(결과 줄 없음)는 그대로
    async rankLevel(n) {
      const r = await q('SELECT id FROM accounts ORDER BY COALESCE(rank_xp, xp) DESC, created_at LIMIT $1', [n]);
      return Promise.all(r.rows.map((x) => hydrate(x.id))); // hydrate가 rankXp(= rank_xp, 없으면 xp)를 붙인다
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
