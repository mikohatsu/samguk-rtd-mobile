// 운영 제재(채팅 금지·계정 정지)·신고 열람 — JSON 파일판. 함수 모양은 mod-pg.js와 같다(json.js가 저장소 객체에 펼쳐 넣는다).
// 제재와 이력은 accounts.json이 아니라 DATA_DIR/moderation.json에 따로 둔다:
//   서버는 accounts.json을 메모리에 들고 3초마다 통째로 덮어쓰므로, 다른 프로세스(admin.js)가 거기에 쓰면 사라진다.
//   moderation.json은 admin.js만 쓰고 서버는 읽기만 한다(파일 수정 시각이 바뀌면 다시 읽는다).
'use strict';
const fs = require('fs'), path = require('path');
const LOG_MAX = 5000, REASON_MAX = 200;
const KINDS = { mute: ['mutedUntil', 'muteReason'], ban: ['bannedUntil', 'banReason'] };

module.exports = function modJson(dir, getDb) {
  const FILE = path.join(dir, 'moderation.json');
  let mod = { sanctions: {}, log: [] }, seen = '';
  function load() {
    let st = null; try { st = fs.statSync(FILE); } catch (e) { /* 파일 없음 */ }
    if (!st) { mod = { sanctions: {}, log: [] }; seen = ''; return mod; }
    const key = st.mtimeMs + ':' + st.size;
    if (key === seen) return mod;
    // 쓰는 도중이거나 깨진 파일이면 앞서 읽은 것을 그대로 쓴다(제재가 풀리는 쪽으로 실패하지 않게)
    try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); mod = { sanctions: (j && j.sanctions) || {}, log: (j && j.log) || [] }; seen = key; } catch (e) { /* 다음에 다시 */ }
    return mod;
  }
  function save() {
    const tmp = FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(mod));
    // 윈도우에서는 서버가 읽는 순간과 겹치면 바꿔치기가 잠깐 실패할 수 있어 몇 번 다시 한다
    for (let i = 0; ; i++) { try { fs.renameSync(tmp, FILE); break; } catch (e) { if (i >= 20) throw e; const until = Date.now() + 25; while (Date.now() < until) { /* 잠깐 기다림 */ } } }
    seen = '';
  }
  const P = (v) => Promise.resolve(v);
  const users = () => getDb().users || {}, reports = () => getDb().reports || [];
  const view = (s) => ({ mutedUntil: (s && s.mutedUntil) || 0, muteReason: (s && s.muteReason) || '', bannedUntil: (s && s.bannedUntil) || 0, banReason: (s && s.banReason) || '' });
  const logAdd = (by, action, target, until, reason) => { mod.log.push({ at: Date.now(), by: String(by || 'admin').slice(0, 40), action, target, until: until || 0, reason: reason || '' }); if (mod.log.length > LOG_MAX) mod.log.splice(0, mod.log.length - LOG_MAX); };

  return {
    // 제재 걸기. kind: 'mute' | 'ban', until: 끝나는 시각(ms). 계정이 없으면 false.
    setSanction: (uid, kind, until, reason, by) => {
      const K = KINDS[kind]; if (!K || !users()[uid] || !(until > Date.now())) return P(false);
      load(); reason = String(reason || '').slice(0, REASON_MAX);
      const s = (mod.sanctions[uid] = mod.sanctions[uid] || {}); s[K[0]] = until; s[K[1]] = reason;
      logAdd(by, kind, uid, until, reason); save(); return P(true);
    },
    // 제재 풀기. 걸려 있지 않아도 true(이력에는 남긴다). 계정이 없으면 false.
    clearSanction: (uid, kind, by) => {
      const K = KINDS[kind]; if (!K || !users()[uid]) return P(false);
      load();
      const s = mod.sanctions[uid]; if (s) { delete s[K[0]]; delete s[K[1]]; if (!Object.keys(s).length) delete mod.sanctions[uid]; }
      logAdd(by, 'un' + kind, uid, 0, ''); save(); return P(true);
    },
    getSanction: (uid) => P(view(load().sanctions[uid])),
    // 지금 걸려 있는 제재 전부(서버가 주기적으로 읽어 메모리에 둔다)
    activeSanctions: () => {
      const now = Date.now(), out = [], S = load().sanctions;
      Object.keys(S).forEach((id) => { const v = view(S[id]); if (v.mutedUntil > now || v.bannedUntil > now) out.push({ id, mutedUntil: v.mutedUntil, bannedUntil: v.bannedUntil }); });
      return P(out);
    },
    modLog: (limit) => P(load().log.slice(-(limit || 100)).reverse()),
    // 신고 목록(새것부터). since: 이 시각(ms) 이후, target: 대상 계정(없으면 전부)
    listReports: ({ since = 0, target = null, limit = 500 } = {}) => P(reports().filter((r) => r.at >= since && (!target || r.target === target)).slice(-limit).reverse()
      .map((r) => ({ at: r.at, by: r.by || null, target: r.target || null, targetNick: r.target && users()[r.target] ? users()[r.target].nick : null, nick: r.nick || '', text: r.text || '', room: r.room || '' }))),
    countReports: (uid) => P(reports().filter((r) => r.target === uid).length),
    // since 이후 이 계정을 신고한 서로 다른 사람 수(자기 자신·탈퇴한 신고자는 세지 않는다)
    reportersSince: (uid, since) => P(new Set(reports().filter((r) => r.target === uid && r.at >= since && r.by && r.by !== uid).map((r) => r.by)).size),
    // 계정 찾기: 계정 ID가 같거나 닉네임이 같은(대소문자 무시) 계정들
    findUsers: (q) => { const s = String(q || ''), lo = s.toLowerCase(); return P(Object.values(users()).filter((u) => u.id === s || String(u.nick || '').toLowerCase() === lo).slice(0, 20)); },
  };
};
