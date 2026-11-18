// 운영 제재(채팅 금지·계정 정지)·신고 열람 — PostgreSQL판. 함수 모양은 mod-json.js와 같다(pg.js가 저장소 객체에 펼쳐 넣는다).
// 제재는 accounts의 muted_until·banned_until(+사유), 이력은 mod_log 표(db/schema.sql 끝의 운영 제재 블록).
'use strict';
const REASON_MAX = 200;
// 열 이름은 이 표에서만 고른다(입력값을 SQL에 끼워 넣지 않는다)
const KINDS = { mute: ['muted_until', 'mute_reason'], ban: ['banned_until', 'ban_reason'] };

module.exports = function modPg(pool, hydrate) {
  const q = (sql, args) => pool.query(sql, args);
  const ms = (d) => (d ? new Date(d).getTime() : 0);
  const log = (qq, by, action, uid, until, reason) => qq('INSERT INTO mod_log (actor, action, account_id, until, reason) VALUES ($1, $2, $3, $4, $5)', [String(by || 'admin').slice(0, 40), action, uid, until ? new Date(until) : null, reason || null]);
  async function tx(fn) {
    const c = await pool.connect();
    try { await c.query('BEGIN'); const r = await fn((s, a) => c.query(s, a)); await c.query('COMMIT'); return r; }
    catch (e) { try { await c.query('ROLLBACK'); } catch (e2) { /* 무시 */ } throw e; }
    finally { c.release(); }
  }
  return {
    // 제재 걸기. kind: 'mute' | 'ban', until: 끝나는 시각(ms). 계정이 없으면 false.
    async setSanction(uid, kind, until, reason, by) {
      const K = KINDS[kind]; if (!K || !(until > Date.now())) return false;
      reason = String(reason || '').slice(0, REASON_MAX);
      return tx(async (qq) => {
        const up = await qq(`UPDATE accounts SET ${K[0]} = $2, ${K[1]} = $3 WHERE id = $1 RETURNING id`, [uid, new Date(until), reason]);
        if (!up.rows.length) return false;
        await log(qq, by, kind, uid, until, reason); return true;
      });
    },
    // 제재 풀기. 걸려 있지 않아도 true(이력에는 남긴다). 계정이 없으면 false.
    async clearSanction(uid, kind, by) {
      const K = KINDS[kind]; if (!K) return false;
      return tx(async (qq) => {
        const up = await qq(`UPDATE accounts SET ${K[0]} = NULL, ${K[1]} = NULL WHERE id = $1 RETURNING id`, [uid]);
        if (!up.rows.length) return false;
        await log(qq, by, 'un' + kind, uid, 0, ''); return true;
      });
    },
    async getSanction(uid) {
      const a = (await q('SELECT muted_until, mute_reason, banned_until, ban_reason FROM accounts WHERE id = $1', [uid])).rows[0] || {};
      return { mutedUntil: ms(a.muted_until), muteReason: a.mute_reason || '', bannedUntil: ms(a.banned_until), banReason: a.ban_reason || '' };
    },
    // 지금 걸려 있는 제재 전부(서버가 주기적으로 읽어 메모리에 둔다)
    async activeSanctions() {
      const r = await q('SELECT id, muted_until, banned_until FROM accounts WHERE muted_until > now() OR banned_until > now()');
      return r.rows.map((a) => ({ id: a.id, mutedUntil: ms(a.muted_until), bannedUntil: ms(a.banned_until) }));
    },
    async modLog(limit) {
      const r = await q('SELECT created_at, actor, action, account_id, until, reason FROM mod_log ORDER BY id DESC LIMIT $1', [limit || 100]);
      return r.rows.map((x) => ({ at: ms(x.created_at), by: x.actor, action: x.action, target: x.account_id, until: ms(x.until), reason: x.reason || '' }));
    },
    // 신고 목록(새것부터). since: 이 시각(ms) 이후, target: 대상 계정(없으면 전부)
    async listReports({ since = 0, target = null, limit = 500 } = {}) {
      const args = [new Date(since), limit]; if (target) args.push(target);
      const r = await q(`SELECT r.created_at, r.reporter_id, r.target_id, r.nick, r.text, r.room, a.nick AS target_nick
                         FROM reports r LEFT JOIN accounts a ON a.id = r.target_id
                         WHERE r.created_at >= $1${target ? ' AND r.target_id = $3' : ''} ORDER BY r.created_at DESC, r.id DESC LIMIT $2`, args);
      return r.rows.map((x) => ({ at: ms(x.created_at), by: x.reporter_id || null, target: x.target_id || null, targetNick: x.target_nick || null, nick: x.nick || '', text: x.text || '', room: x.room || '' }));
    },
    async countReports(uid) { return +(await q('SELECT count(*) AS n FROM reports WHERE target_id = $1', [uid])).rows[0].n; },
    // since 이후 이 계정을 신고한 서로 다른 사람 수(자기 자신·탈퇴한 신고자는 세지 않는다)
    async reportersSince(uid, since) {
      const r = await q('SELECT reporter_id FROM reports WHERE target_id = $1 AND created_at >= $2 AND reporter_id IS NOT NULL AND reporter_id <> target_id LIMIT 2000', [uid, new Date(since)]);
      return new Set(r.rows.map((x) => x.reporter_id)).size;
    },
    // 계정 찾기: 계정 ID가 같거나 닉네임이 같은(대소문자 무시) 계정들
    async findUsers(s) {
      const r = await q('SELECT id FROM accounts WHERE id = $1 OR lower(nick) = lower($1) ORDER BY created_at LIMIT 20', [String(s || '')]);
      return (await Promise.all(r.rows.map((x) => hydrate(x.id)))).filter(Boolean);
    },
  };
};
