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
  db.links = db.links || {}; db.clears = db.clears || {}; db.reports = db.reports || []; db.tokens = db.tokens || {}; db.users = db.users || {};
  let dirty = false;
  const mark = () => (dirty = true);
  function flush() { if (!dirty) return; dirty = false; const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, FILE); }
  const timer = setInterval(flush, 3000); timer.unref && timer.unref();
  // 옛 파일은 토큰 원문을 열쇠로 썼다. 원문 열쇠도 그대로 받되 새 토큰은 해시로 둔다.
  const tok = (t) => db.tokens[sha(t)] || db.tokens[t];
  const P = (v) => Promise.resolve(v);
  const user = (id) => db.users[id] || null;
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
      db.users[id] = Object.assign({ id, xp: 0, games: 0, wins: 0, best: 0, created: Date.now(), track: 'mil' }, fields, { id });
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
      u.ads.n++; u.coins = (u.coins || 0) + coins; mark(); return P({ ok: true, left: daily - u.ads.n });
    },
    grantIap: (uid, txId, productId, items, at) => {
      db.iap = db.iap || {};
      const had = db.iap[txId]; if (had && had.uid !== uid) return P('other');
      if (!had) db.iap[txId] = { uid, productId, at: at || Date.now() };
      const u = user(uid); u.owned = u.owned || []; items.forEach((it) => { if (!u.owned.includes(it)) u.owned.push(it); }); mark(); return P('ok');
    },
    equip: (uid, e) => {
      const u = user(uid);
      if (e.icon) u.icon = e.icon;
      if (e.mapSkin) u.mapSkin = e.mapSkin;
      if (e.unit) { u.skins = u.skins || {}; if (e.skin) u.skins[e.unit] = e.skin; else delete u.skins[e.unit]; }
      mark(); return P(u);
    },
    setFields: (uid, f) => { const u = user(uid); if (f.track) u.track = f.track; if (f.nick) u.nick = f.nick; mark(); return P(u); },
    report: (r) => { db.reports.push(Object.assign({ at: Date.now() }, r)); if (db.reports.length > 2000) db.reports.shift(); mark(); return P(); },
    // 온라인 판 결과: 같은 열쇠는 한 번만. 경험치·동전·전적·불멸·클리어 기록을 한꺼번에.
    recordResult: (uid, r) => {
      const u = user(uid); u.seen = u.seen || [];
      if (u.seen.includes(r.key)) return P(false);
      u.seen.push(r.key); if (u.seen.length > 30) u.seen.shift();
      u.xp += r.xp; u.games++; if (r.win) u.wins++; u.best = Math.max(u.best || 0, r.round);
      u.coins = (u.coins || 0) + r.coins;
      applyHist(u, r.hist);
      if (r.imm) { u.imm = u.imm || {}; Object.keys(r.imm).forEach((id) => (u.imm[id] = (u.imm[id] || 0) + r.imm[id])); }
      if (r.clear) {
        const c = r.clear, list = (db.clears[c.diff] = db.clears[c.diff] || []);
        let row = list.find((x) => x.key === c.party);
        if (!row) { row = { key: c.party, time: c.time, mut: c.mut, at: Date.now(), members: [] }; list.push(row); }
        row.time = Math.min(row.time, c.time);
        if (!row.members.some((m) => m.id === u.id) && row.members.length < 5) row.members.push({ id: u.id, nick: u.nick, icon: u.icon || 'cav' });
        list.sort((x, y) => x.time - y.time); if (list.length > 100) list.length = 100;
      }
      mark(); return P(true);
    },
    deleteUser: (uid) => {
      Object.keys(db.links).forEach((k) => { if (db.links[k] === uid) delete db.links[k]; });
      Object.keys(db.tokens).forEach((t) => { if (db.tokens[t].uid === uid) delete db.tokens[t]; });
      delete db.users[uid]; mark(); flush(); return P();
    },
    rankLevel: (n) => P(Object.values(db.users).sort((a, b) => b.xp - a.xp).slice(0, n)),
    rankClear: (diff, n) => P((db.clears[diff] || []).slice(0, n).map((c) => ({ time: c.time, mut: c.mut, at: c.at, members: c.members.map((m) => ({ id: m.id, nick: m.nick, icon: m.icon, user: user(m.id) })) }))),
    rankImm: (id, n) => P(Object.values(db.users).filter((u) => u.imm && u.imm[id] > 0).sort((a, b) => b.imm[id] - a.imm[id]).slice(0, n).map((u) => ({ user: u, n: u.imm[id] }))),
    // ---------- 미션(2026-11-18): 일일 미션 진행·받기, 첫 클리어 보상 받기. pg.js와 함수 모양이 같다 ----------
    // day = 일본 시간 날짜 글자('2026-11-18'). 계정의 ms = { day, n: { 미션 id: 횟수 }, got: [받은 일일 미션] }(날이 바뀌면 새로), firsts = [받은 첫 클리어 보상]
    missionProgress: (uid, day, ids) => {
      const u = user(uid); if (!u.ms || u.ms.day !== day) u.ms = { day, n: {}, got: [] };
      ids.forEach((id) => (u.ms.n[id] = (u.ms.n[id] || 0) + 1)); mark(); return P();
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
      u.coins = (u.coins || 0) + m.coins; mark(); return P('ok');
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
  const di = DIFFS.indexOf(h.diff);
  u.plays = u.plays || {}; u.clears = u.clears || {};
  u.plays[h.diff] = (u.plays[h.diff] || 0) + 1;
  if (h.win) {
    u.clears[h.diff] = (u.clears[h.diff] || 0) + 1;
    u.clr = Math.max(u.clr == null ? -1 : u.clr, di);
    if (h.diff === 'nightmare') u.nmx = Math.max(u.nmx == null ? -1 : u.nmx, h.mut);
  }
  u.hist = u.hist || []; u.hist.unshift(h); if (u.hist.length > 20) u.hist.length = 20;
}
