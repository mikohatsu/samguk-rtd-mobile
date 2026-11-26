// 저장소(JSON 파일판): DB 없이 돌릴 때(개발·시험, DB로 옮기기 전 서버). PostgreSQL판(pg.js)과 함수 모양이 같다.
// 모든 함수는 Promise를 돌려준다. 사용자 객체 모양은 store/README의 'user view'와 같다.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DIFFS, sha, newToken, TOKEN_MS } = require('./common');

module.exports = function jsonStore(dir) {
  const FILE = path.join(dir, 'accounts.json');
  fs.mkdirSync(dir, { recursive: true });
  let db = { users: {}, tokens: {}, links: {} };
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* 처음 */ }
  db.links = db.links || {}; db.clears = db.clears || {}; db.reports = db.reports || []; db.tokens = db.tokens || {}; db.users = db.users || {}; db.results = db.results || {};
  Object.values(db.users).forEach((u) => { if (u.rankXp == null) u.rankXp = u.xp || 0; }); // 레벨 순위 값: 이 업데이트 전 경험치는 그대로(pg.js rank_xp와 같다)
  let dirty = false;
  const mark = () => (dirty = true);
  function flush() { if (!dirty) return; dirty = false; const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, FILE); }
  const timer = setInterval(flush, 3000); timer.unref && timer.unref();
  // 옛 파일은 토큰 원문을 열쇠로 썼다. 원문 열쇠도 그대로 받되 새 토큰은 해시로 둔다.
  const tok = (t) => db.tokens[sha(t)] || db.tokens[t];
  const P = (v) => Promise.resolve(v);
  const user = (id) => db.users[id] || null;
  // 회수로 생긴 동전 빚을 지금 잔액에서 먼저 갚는다(pg.js payDebt와 같다)
  const payDebt = (u) => { const p = Math.min(u.coins || 0, u.coinDebt | 0); if (p > 0) { u.coins -= p; u.coinDebt -= p; } };
  const resView = (x) => (x ? { id: x.id, uid: x.uid, kind: x.kind, online: x.online, verify: x.verify, issuedAt: x.issuedAt, reportedAt: x.reportedAt, diff: x.diff, played: x.played, mut: x.mut, round: x.round, win: x.win, time: x.time, seats: x.seats, seed: x.seed, room: x.room, xp: x.xp, coins: x.coins, verifiedAt: x.verifiedAt || null, note: x.note || null, revokedAt: x.revokedAt || null, revokeCoins: x.revokeCoins | 0 } : null);
  const newId = (prefix) => { let id; do { id = prefix + crypto.randomBytes(6).toString('hex'); } while (db.users[id]); return id; };

  return {
    kind: 'json',
    ...require('./mod-json')(dir, () => db), // 운영 제재(채팅 금지·계정 정지)·신고 열람: mod-json.js
    flush: () => P(flush()),
    close: () => { clearInterval(timer); flush(); return P(); },
    userByToken: (t) => { const x = t && tok(t); return P(x && x.exp > Date.now() ? user(x.uid) : null); },
    issueToken: (uid) => { const t = newToken(); db.tokens[sha(t)] = { uid, exp: Date.now() + TOKEN_MS }; mark(); return P(t); },
    revokeToken: (t) => { delete db.tokens[sha(t)]; delete db.tokens[t]; mark(); return P(); },
    getUser: (id) => P(user(String(id))),
    createUser: (prefix, fields) => {
      const id = fields.id || newId(prefix);
      db.users[id] = Object.assign({ id, xp: 0, rankXp: 0, games: 0, wins: 0, best: 0, created: Date.now(), track: 'mil' }, fields, { id });
      if (fields.prov && fields.sub) db.links[fields.prov + ':' + fields.sub] = id;
      mark(); return P(db.users[id]);
    },
    findByIdentity: (prov, sub) => P(user(db.links[prov + ':' + sub])),
    linkIdentity: (uid, prov, sub) => { const u = user(uid); u.prov = prov; u.sub = sub; delete u.gsec; delete u.gsalt; db.links[prov + ':' + sub] = uid; mark(); return P(u); },
    addHistory: (uid, h) => { const u = user(uid); applyHist(u, h); mark(); return P(u); },
    history: (uid) => { const u = user(uid); return P(u ? (u.hist || []) : []); },
    buy: (uid, item, cost) => {
      const u = user(uid); u.owned = u.owned || [];
      if (u.owned.includes(item)) return P('owned');
      if ((u.coins || 0) < cost) return P('coins');
      u.coins -= cost; u.owned.push(item); mark(); return P('ok');
    },
    grantItems: (uid, items) => { const u = user(uid); u.owned = u.owned || []; items.forEach((it) => { if (!u.owned.includes(it)) u.owned.push(it); }); mark(); return P(u); },
    everMyth: (uid) => { const u = user(uid) || {}, s = new Set(Object.keys(u.imm || {})); (u.hist || []).forEach((h) => Object.keys(h.myth || {}).forEach((k) => s.add(k))); return P([...s]); },
    adReward: (uid, coins, daily, since) => {
      const u = user(uid); if (!u.ads || u.ads.since !== since) u.ads = { since, n: 0 };
      if (u.ads.n >= daily) return P({ ok: false, left: 0 });
      u.ads.n++; u.coins = (u.coins || 0) + coins; payDebt(u); mark(); return P({ ok: true, left: daily - u.ads.n });
    },
    // 결제·환불 회수: pg.js와 같은 규칙(환불된 거래는 다시 열지 않음, 그 거래로 새로 들어간 열쇠만 회수, 다른 유효 결제의 열쇠는 남김)
    grantIap: (uid, txId, productId, items, at, env) => {
      db.iap = db.iap || {};
      let had = db.iap[txId]; if (had && had.uid !== uid) return P('other');
      if (!had) had = db.iap[txId] = { uid, productId, at: at || Date.now(), env: env || null, status: 'granted', items: [] };
      if (had.status === 'refunded') return P('refunded');
      const u = user(uid); u.owned = u.owned || [];
      items.forEach((it) => { if (!u.owned.includes(it)) { u.owned.push(it); if (had.items && !had.items.includes(it)) had.items.push(it); } });
      mark(); return P('ok');
    },
    revokeIap: (txId, itemsOf) => {
      const row = (db.iap || {})[txId];
      if (!row) return P({ result: 'unknown', removed: [] });
      if (row.status === 'refunded') return P({ result: 'already', uid: row.uid, removed: [] });
      row.status = 'refunded'; row.refundedAt = Date.now(); mark();
      const u = user(row.uid); if (!u) return P({ result: 'ok', uid: null, removed: [] });
      const keep = new Set();
      Object.keys(db.iap).forEach((k) => { const o = db.iap[k]; if (k !== txId && o.uid === row.uid && o.status !== 'refunded') (itemsOf(o.productId) || []).forEach((x) => keep.add(x)); });
      const removed = (row.items || itemsOf(row.productId) || []).filter((k) => !keep.has(k) && (u.owned || []).includes(k));
      u.owned = (u.owned || []).filter((k) => !removed.includes(k));
      return P({ result: 'ok', uid: row.uid, removed });
    },
    purchase: (txId) => { const r = (db.iap || {})[txId]; return P(r ? { txId, uid: r.uid, productId: r.productId, status: r.status || 'granted', env: r.env || null, items: r.items || [] } : null); },
    equip: (uid, e) => {
      const u = user(uid);
      if (e.icon) u.icon = e.icon;
      if (e.mapSkin) u.mapSkin = e.mapSkin;
      if (e.unit) { u.skins = u.skins || {}; if (e.skin) u.skins[e.unit] = e.skin; else delete u.skins[e.unit]; }
      mark(); return P(u);
    },
    setFields: (uid, f) => { const u = user(uid); if (f.track) u.track = f.track; if (f.nick) u.nick = f.nick; mark(); return P(u); },
    report: (r) => { db.reports.push(Object.assign({ at: Date.now() }, r)); if (db.reports.length > 2000) db.reports.shift(); mark(); return P(); },
    // 판 결과: 같은 열쇠는 한 번만. 경험치·동전·전적·불멸·클리어 기록·결과 한 줄(results)을 한꺼번에. pg.js recordResult와 같은 규칙·돌려주는 값
    // (이어하기 칸 비교·비우기, 하루 경험치·동전 상한, 마지막 보상 시각, 빚 갚기)
    recordResult: (uid, r) => {
      const u = user(uid); if (!u) return P(false);
      u.seen = u.seen || [];
      if (u.seen.includes(r.key) || db.results[r.key]) return P(false);
      if (r.slot && u.saveTk !== r.slot) return P({ why: 'replaced' });
      const cap = r.caps || {}, rd = u.rday && r.day && u.rday.k === r.day ? u.rday : { k: r.day || null, xp: 0, coins: 0 };
      const xp = Math.max(0, Math.min(r.xp | 0, cap.xp == null ? Infinity : cap.xp - rd.xp));
      const coins = Math.max(0, Math.min(r.coins | 0, cap.coins == null ? Infinity : cap.coins - rd.coins));
      const prev = { clr: u.clr == null ? -1 : u.clr, nmx: u.nmx == null ? -1 : u.nmx, best: u.best || 0 };
      u.seen.push(r.key); if (u.seen.length > 30) u.seen.shift();
      u.xp += xp; u.games++; if (r.win) u.wins++; u.best = Math.max(u.best || 0, r.round);
      u.coins = (u.coins || 0) + coins; payDebt(u);
      u.rday = { k: rd.k, xp: rd.xp + xp, coins: rd.coins + coins };
      if (r.setLast) u.lastReward = Date.now();
      if (r.slot) u.saveTk = null;
      applyHist(u, Object.assign({}, r.hist, { key: r.key }));
      // 순위(최단 클리어 줄·불멸 소환 수)는 confirmResult(ok) 때 넣는다(2026-11-26 "검증된 거만"). 여기서는 후보만 적는다
      const clear = r.clear ? { board: r.clear.diff, party: r.clear.party, time: r.clear.time, mut: r.clear.mut, prev: null } : null;
      const m = r.meta || {};
      db.results[r.key] = { id: r.key, uid, issuedAt: m.issuedAt || Date.now(), reportedAt: Date.now(), kind: m.kind || 'legacy', online: !!m.online, diff: m.diff || r.hist.pdiff || r.hist.diff, played: m.played || r.hist.diff,
        mut: m.mut | 0, round: r.round | 0, win: !!r.win, time: m.time | 0, seats: m.seats | 0, seed: m.seed ? m.seed | 0 : null, room: m.room || null, xp, coins,
        prev, clear, imm: r.imm || {}, grants: {}, verify: m.verify || 'pending', notified: false };
      mark(); return P({ ok: true, xp, coins });
    },
    // ---------- 판 결과 검증·회수(2026-11-26 secure-a). pg.js와 함수 모양이 같다 ----------
    setSaveSlot: (uid, n) => { const u = user(uid); if (u) { u.saveTk = n; mark(); } return P(); },
    resultExists: (uid, key) => { const u = user(uid) || {}; return P(!!db.results[key] || (u.seen || []).includes(key)); },
    result: (id) => P(resView(db.results[String(id)])),
    pendingResults: (n) => P(Object.values(db.results).filter((x) => x.verify === 'pending').sort((a, b) => a.reportedAt - b.reportedAt).slice(0, Math.max(1, Math.min(1000, (n | 0) || 100))).map(resView)),
    noteResultGrants: (id, g) => { const x = db.results[id]; if (x) { x.grants = g || {}; mark(); } return P(); },
    // ok면 순위 후보를 이때 순위에 넣는다(ranked). norec는 넣지 않는다
    confirmResult: (id, note, to) => {
      const x = db.results[id]; if (!x) return P({ result: 'unknown' });
      if (x.verify !== 'pending') return P({ result: x.verify === 'legacy' ? 'legacy' : 'already', verify: x.verify });
      x.verify = to === 'norec' ? 'norec' : 'ok'; x.verifiedAt = Date.now(); x.note = note || null; x.ranked = false;
      const u = user(x.uid);
      if (x.verify === 'ok' && u) {
        u.rankXp = (u.rankXp || 0) + (x.xp | 0); // 레벨 순위 값
        if (x.imm && Object.keys(x.imm).length) { u.imm = u.imm || {}; Object.keys(x.imm).forEach((k) => (u.imm[k] = (u.imm[k] || 0) + x.imm[k])); x.ranked = true; }
        if (x.clear) {
          const c = x.clear, list = (db.clears[c.board] = db.clears[c.board] || []);
          let row = list.find((y) => y.key === c.party);
          c.prev = row ? row.time : null;
          if (!row) { row = { key: c.party, time: c.time, mut: c.mut, at: Date.now(), members: [] }; list.push(row); }
          row.time = Math.min(row.time, c.time);
          if (!row.members.some((m) => m.id === u.id) && row.members.length < 5) row.members.push({ id: u.id, nick: u.nick, icon: u.icon || 'cav' });
          list.sort((a, b) => a.time - b.time); if (list.length > 100) list.length = 100;
          x.ranked = true;
        }
      }
      mark(); return P({ result: 'ok', ranked: !!x.ranked });
    },
    revokeResult: (id, o) => {
      const x = db.results[id]; if (!x) return P({ result: 'unknown' });
      if (x.verify === 'legacy') return P({ result: 'legacy', uid: x.uid });
      if (x.verify === 'bad') return P({ result: 'already', uid: x.uid });
      const u = user(x.uid); let owed = x.coins | 0;
      if (u) {
        u.firsts = u.firsts || [];
        const drop = (mid) => { const i = u.firsts.indexOf(mid); if (i < 0) return false; u.firsts.splice(i, 1); return true; };
        const newXp = Math.max(0, (u.xp | 0) - (x.xp | 0)), g = x.grants || {};
        (g.ach || []).forEach((a) => { if (drop(a.id)) owed += a.coins | 0; });
        (g.ranks || []).forEach((a) => { if (o.rankOfXp(newXp) < a.rank && drop(a.id)) owed += a.coins | 0; });
        u.xp = newXp;
        u.hist = (u.hist || []).filter((h) => h.key !== id);
        u.plays = u.plays || {}; u.clears = u.clears || {};
        u.plays[x.diff] = Math.max(0, (u.plays[x.diff] || 0) - 1); if (x.win) u.clears[x.diff] = Math.max(0, (u.clears[x.diff] || 0) - 1);
        u.games = Math.max(0, (u.games || 0) - 1); if (x.win) u.wins = Math.max(0, (u.wins || 0) - 1);
        const others = Object.values(db.results).filter((y) => y.uid === x.uid && y.id !== id && y.verify !== 'bad'), wins = others.filter((y) => y.win);
        const curClr = u.clr == null ? -1 : u.clr, curNmx = u.nmx == null ? -1 : u.nmx;
        if (x.win) {
          u.clr = Math.min(curClr, Math.max(x.prev.clr, ...wins.map((y) => DIFFS.indexOf(y.diff))));
          u.nmx = Math.min(curNmx, Math.max(x.prev.nmx, ...wins.filter((y) => y.diff === 'nightmare').map((y) => y.mut | 0)));
        }
        u.best = Math.min(u.best || 0, Math.max(x.prev.best | 0, ...others.map((y) => y.round | 0)));
        (o.firsts || []).forEach((f) => { const done = f.mut ? u.nmx >= f.mut : u.clr >= DIFFS.indexOf(f.diff); if (!done && drop(f.id)) owed += f.coins | 0; });
        if (x.verify === 'ok') u.rankXp = Math.max(0, (u.rankXp || 0) - (x.xp | 0));
        if (x.ranked) Object.entries(x.imm || {}).forEach(([k, n]) => { if (u.imm && u.imm[k]) u.imm[k] = Math.max(0, u.imm[k] - (n | 0)); });
        const take = Math.min(u.coins || 0, owed);
        u.coins = (u.coins || 0) - take; u.coinDebt = (u.coinDebt | 0) + owed - take;
        x.taken = take;
      }
      if (x.ranked && x.clear) {
        const c = x.clear, list = db.clears[c.board] || [], row = list.find((y) => y.key === c.party);
        if (row) {
          const rest = Object.values(db.results).filter((y) => y.id !== id && y.verify === 'ok' && y.ranked && y.clear && y.clear.board === c.board && y.clear.party === c.party);
          const times = rest.map((y) => y.clear.time).concat(c.prev != null ? [c.prev] : []);
          if (!times.length) list.splice(list.indexOf(row), 1);
          else {
            row.time = Math.min(...times);
            if (!rest.some((y) => y.uid === x.uid) && c.prev == null) row.members = row.members.filter((mm) => mm.id !== x.uid);
            list.sort((p, q) => p.time - q.time);
          }
        }
      }
      x.verify = 'bad'; x.ranked = false; x.verifiedAt = x.revokedAt = Date.now(); x.note = o.why || null; x.revokeCoins = owed;
      mark(); return P({ result: 'ok', uid: x.uid, xp: x.xp | 0, coins: owed, taken: x.taken | 0, debt: owed - (x.taken | 0) });
    },
    revokedUnseen: (uid) => P(Object.values(db.results).filter((x) => x.uid === uid && x.verify === 'bad' && x.revokedAt && !x.notified).slice(0, 20)
      .map((x) => ({ id: x.id, diff: x.played, mut: x.mut, round: x.round, win: x.win, at: x.reportedAt, xp: x.xp, coins: x.revokeCoins | 0 }))),
    ackRevoked: (uid, ids) => { (ids || []).slice(0, 50).forEach((id) => { const x = db.results[String(id)]; if (x && x.uid === uid) { x.notified = true; mark(); } }); return P(); },
    deleteUser: (uid) => {
      Object.keys(db.links).forEach((k) => { if (db.links[k] === uid) delete db.links[k]; });
      Object.keys(db.tokens).forEach((t) => { if (db.tokens[t].uid === uid) delete db.tokens[t]; });
      delete db.users[uid]; mark(); flush(); return P();
    },
    // 레벨 순위: 검증 ok가 아닌 판(pending·norec·legacy)의 경험치는 빼고 줄 세운다(pg.js rankLevel과 같다)
    rankLevel: (n) => P(Object.values(db.users).sort((a, b) => (b.rankXp == null ? b.xp : b.rankXp) - (a.rankXp == null ? a.xp : a.rankXp)).slice(0, n)),
    rankClear: (diff, n) => P((db.clears[diff] || []).slice(0, n).map((c) => ({ time: c.time, mut: c.mut, at: c.at, members: c.members.map((m) => ({ id: m.id, nick: m.nick, icon: m.icon, user: user(m.id) })) }))),
    rankImm: (id, n) => P(Object.values(db.users).filter((u) => u.imm && u.imm[id] > 0).sort((a, b) => b.imm[id] - a.imm[id]).slice(0, n).map((u) => ({ user: u, n: u.imm[id] }))),
    // ---------- 미션(2026-11-18): 일일 미션 진행·받기, 첫 클리어 보상 받기. pg.js와 함수 모양이 같다 ----------
    // day = 일본 시간 날짜 글자('2026-11-18'). 계정의 ms = { day, n: { 미션 id: 횟수 }, got: [받은 일일 미션] }(날이 바뀌면 새로), firsts = [받은 첫 클리어 보상]
    missionProgress: (uid, day, ids) => {
      const u = user(uid); if (!u.ms || u.ms.day !== day) u.ms = { day, n: {}, got: [] };
      const add = Array.isArray(ids) ? ids.map((id) => [id, 1]) : Object.entries(ids || {}); // 목록(각 +1) 또는 { id: 양 }
      add.forEach(([id, n]) => (u.ms.n[id] = (u.ms.n[id] || 0) + Math.max(0, n | 0))); mark(); return P();
    },
    missionState: (uid, day) => {
      const u = user(uid) || {}, m = u.ms && u.ms.day === day ? u.ms : { n: {}, got: [] }, daily = {};
      Object.keys(m.n).forEach((id) => (daily[id] = { n: m.n[id], claimed: m.got.includes(id) }));
      return P({ daily, firsts: (u.firsts || []).slice() });
    },
    // m = { id, coins, day, need }(일일: 그날 need번 채웠고 아직 안 받았을 때만) 또는 { id, coins }(첫 클리어: 한 번만. 조건은 부르는 쪽이 본다). 'ok' | 'no'
    missionClaim: (uid, m) => {
      const u = user(uid);
      if (m.day) {
        const s = u.ms && u.ms.day === m.day ? u.ms : null;
        if (!s || (s.n[m.id] || 0) < m.need || s.got.includes(m.id)) return P('no');
        s.got.push(m.id);
      } else {
        u.firsts = u.firsts || [];
        if (u.firsts.includes(m.id)) return P('no');
        u.firsts.push(m.id);
      }
      u.coins = (u.coins || 0) + m.coins; u.xp = (u.xp || 0) + Math.max(0, m.xp | 0); u.rankXp = (u.rankXp || 0) + Math.max(0, m.xp | 0); payDebt(u); mark(); return P('ok');
    },
    // 한 번만 주는 보상(관직 승급·업적 첫 달성). 받은 표시는 첫 클리어와 같은 목록(firsts). 돌려주는 값: 이번에 준 id 목록
    grantOnce: (uid, list) => {
      const u = user(uid); if (!u) return P([]);
      u.firsts = u.firsts || []; const got = [];
      list.forEach((x) => { if (u.firsts.includes(x.id)) return; u.firsts.push(x.id); got.push(x.id); u.coins = (u.coins || 0) + Math.max(0, x.coins | 0); });
      if (got.length) { payDebt(u); mark(); } return P(got);
    },
    // ---------- Sign in with Apple refresh token(2026-11-20): 계정 삭제 때 Apple에 철회하려고 둔다. pg.js와 함수 모양이 같다 ----------
    // 열쇠는 Apple 이용자 식별자(sub). 계정이 생기기 전에 올 수 있어 계정과 묶지 않는다.
    putAppleToken: (sub, token) => { db.apple = db.apple || {}; db.apple[sub] = { t: token, at: Date.now() }; mark(); return P(); },
    appleToken: (sub) => P(db.apple && db.apple[sub] ? db.apple[sub].t : null),
    // token을 주면 그 값일 때만 지운다(그 사이 새로 받은 토큰은 남긴다)
    dropAppleToken: (sub, token) => { const x = db.apple && db.apple[sub]; if (x && (!token || x.t === token)) { delete db.apple[sub]; mark(); } return P(); },
    // before보다 오래됐고 연결된 계정이 없는 것(가입을 끝내지 않았거나, 계정 삭제 때 철회가 실패한 것)
    orphanAppleTokens: (before) => P(Object.keys(db.apple || {}).filter((s) => db.apple[s].at < before && !db.links['apple:' + s]).map((s) => ({ sub: s, token: db.apple[s].t }))),
    // 시험·이전용
    _raw: () => db,
  };
};

// 전적 한 줄 + 판 수·클리어 수·해금 진행
function applyHist(u, h) {
  const pd = h.pdiff || h.diff, pm = h.pmut != null ? h.pmut : h.mut; // 진행용(깬 난이도 + 1까지). h.diff는 전적에 보이는 실제 난이도
  const di = DIFFS.indexOf(pd);
  u.plays = u.plays || {}; u.clears = u.clears || {};
  u.plays[pd] = (u.plays[pd] || 0) + 1;
  if (h.win) {
    u.clears[pd] = (u.clears[pd] || 0) + 1;
    u.clr = Math.max(u.clr == null ? -1 : u.clr, di);
    if (pd === 'nightmare') u.nmx = Math.max(u.nmx == null ? -1 : u.nmx, pm);
  }
  u.hist = u.hist || []; u.hist.unshift(h); if (u.hist.length > 20) u.hist.length = 20;
}
