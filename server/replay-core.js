// 판 재연산(서버 검증·시험이 같이 쓴다). 2026-11-26 사용자 결정: 모든 판을 같은 씨앗 + 입력 기록으로 서버가 다시 돌려 보고와 맞춰 본다.
//
// 1) 엔진 묶음(BUNDLE_FILES)을 앱과 같은 순서로 따로 떨어진 전역 상자(가짜 window) 안에 불러온다(loadBundle).
//    언어(lang)도 기록에 적힌 값으로 맞춘다: i18n.js가 테마의 이름을 바꾸고, 엔진 일부는 이름으로 같은 패시브를 한 번만 센다(engine.js globalBuff 등).
// 2) 기록대로 판을 처음부터 다시 돌린다: 걸음마다 명령을 같은 순서로 넣고, 'R'(이어하기)에서는 snapshot → JSON → restore를 똑같이 한다.
//    AI 동맹 판은 앱(src/ui/17-loop begin)과 같은 방식으로 가상 방(hub)과 AI 사령관을 만든다.
// 3) 결과 요약(라운드·승패·시간·통계·소환·업적·걸음 수)을 돌려준다. 보고와 맞추는 것은 compare().
//
// 기록 형식(앱 src/ui/17-loop의 기록기가 만든다, v 1):
//   { v: 1, eh: 엔진 묶음 해시, lang, seed, diff, mutLv, muts: [...], unl: [...] | null, ai: AI 수(0 = 혼자), b: [빌드 번호...],
//     c: [[걸음 차, 종류, 인자...], ...],   // 걸음 차 = 앞 명령과의 걸음 수 차이(첫 명령은 0걸음부터). 종류 'R' = 이 걸음에서 이어하기(저장 → 복원)
//     end: { step: 판이 끝난 걸음 수 } }
// 전송은 JSON → gzip → base64(앱의 CompressionStream, 서버의 zlib.gunzipSync).
//
// 쓰는 법:
//   const RC = require('./replay-core');
//   const B = RC.loadBundle(dir, 'ja');            // dir = 엔진 묶음 파일이 있는 폴더
//   const r = RC.replay(B, rec, { maxMs: 90000 }); // { ok, res: { round, win, time, steps, st, myth, imm, ach, over }, ms } | { ok: false, err }
//   const diff = RC.compare(r.res, report);        // 맞으면 [], 아니면 어긋난 칸 이름 목록
// 스레드: 동기 함수. 한 판에 수 초가 걸리므로 서버에서는 worker_threads(server/replay-worker.js)에서만 부른다.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');

// 판 결과에 영향을 주는 파일(앱이 불러오는 순서 그대로). 이 묶음의 해시가 기록의 eh다(scripts/build-ui.js가 version.js에 넣는다).
const BUNDLE_FILES = ['det.js', 'theme-samguk.js', 'i18n-data.js', 'i18n.js', 'engine.js', 'raid.js', 'synergy.js', 'net.js', 'ai.js'];
const LANGS = ['ko', 'ja', 'en', 'zh'];
const REC_V = 1;

// 묶음 해시: 파일 이름과 내용(줄 끝 CRLF → LF)을 이어 SHA-256, 앞 16자
function engineHash(dir) {
  const h = crypto.createHash('sha256');
  for (const f of BUNDLE_FILES) { h.update(f + '\n'); h.update(fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n')); h.update('\n'); }
  return h.digest('hex').slice(0, 16);
}

// 묶음 파일마다 함수로 컴파일해 폴더마다 기억한다(같은 버전을 여러 판 돌릴 때 다시 읽지 않게). 실행(전역 상자 W)은 판마다 새로 한다(테마를 판이 바꿔도 다음 판에 새지 않게).
// vm.createContext를 쓰지 않는 까닭: vm 안에서는 Math·Object 같은 전역을 찾을 때마다 상자 경계를 넘어 5~10배 느리다(2026-11-26 실측: 같은 판 7.9초 → 0.8초).
// 대신 각 파일을 function(window, globalThis, localStorage, navigator, document, module, require)로 감싸 전역 이름을 상자 W로 가린다.
// 파일들은 (function (root) { ... })(typeof window !== 'undefined' ? window : globalThis) 꼴이라 root = W가 된다(앱 브라우저와 같은 모양).
const fnCache = new Map();
function fnsOf(dir) {
  let s = fnCache.get(dir);
  if (!s) {
    s = BUNDLE_FILES.map((f) => new Function('window', 'globalThis', 'localStorage', 'navigator', 'document', 'module', 'require', fs.readFileSync(path.join(dir, f), 'utf8') + '\n//# sourceURL=' + path.join(dir, f).split(path.sep).join('/')));
    if (fnCache.size > 8) fnCache.clear();
    fnCache.set(dir, s);
  }
  return s;
}
function loadBundle(dir, lang) {
  const L = LANGS.includes(lang) ? lang : 'ko';
  const store = { 'rtd-lang': L };
  const W = {
    console: { log() {}, warn() {}, error() {} }, // 엔진·통신이 남기는 경고는 버린다
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem() {}, removeItem() {} },
    navigator: { language: L },
  };
  W.window = W; W.globalThis = W;
  for (const fn of fnsOf(dir)) fn(W, W, W.localStorage, W.navigator, undefined, undefined, undefined);
  if (!W.RTD_ENGINE || !W.RTD_THEME || !W.RTD_DET) throw new Error('bundle_incomplete');
  return { E: W.RTD_ENGINE, T: W.RTD_THEME, NET: W.RTD_NET, AI: W.RTD_AI, I: W.RTD_I18N, lang: L, ctx: W };
}

// 판 끝 통계(lobby.js statsOf와 같은 식이어야 한다 — 앱이 보고에 넣는 st)
function statsOf(g) {
  const s = g.stats || {};
  return { kills: s.kills | 0, midKill: s.midKill | 0, midMiss: s.midMiss | 0, lifeLost: s.lifeLost | 0, goldIn: s.goldIn | 0, combines: s.combines | 0, crafts: (s.crafts || []).length, best: s.best | 0, tickets: s.tickets | 0, chests: s.chests | 0, bosses: (s.bosses || []).length, bossWins: (s.bosses || []).filter((b) => b.win).length, fast: (s.bosses || []).filter((b) => b.fast).length };
}
// 보고에 들어가는 값과 같은 모양의 결과 요약(src/ui/18-account reportResult)
function summarize(g) {
  const done = (g.me && g.me.done) || {};
  return {
    over: g.over || null, round: g.resultRound, win: g.over === 'win', time: Math.round(g.time), steps: g.stepN,
    st: statsOf(g), myth: Object.assign({}, g.stats.myth || {}), imm: Object.assign({}, g.stats.imm || {}),
    ach: Object.keys(done).filter((k) => done[k]).sort(),
  };
}

// 기록 모양 검사. 잘못됐으면 까닭 글자
function checkRec(rec, T) {
  if (!rec || typeof rec !== 'object' || rec.v !== REC_V) return 'rec_v';
  if (!Number.isFinite(rec.seed)) return 'rec_seed';
  if (!T.difficulties.some((d) => d.id === rec.diff)) return 'rec_diff';
  if (!Array.isArray(rec.c) || !rec.end || !Number.isFinite(rec.end.step)) return 'rec_shape';
  if (!Array.isArray(rec.muts) || rec.muts.some((x) => typeof x !== 'string')) return 'rec_muts';
  if (rec.unl != null && (!Array.isArray(rec.unl) || rec.unl.some((x) => typeof x !== 'string'))) return 'rec_unl';
  const ai = rec.ai | 0;
  if (ai < 0 || ai > 4 || (ai && (!Array.isArray(rec.b) || rec.b.length !== ai))) return 'rec_ai';
  for (const c of rec.c) if (!Array.isArray(c) || !Number.isInteger(c[0]) || c[0] < 0 || typeof c[1] !== 'string') return 'rec_cmd';
  return null;
}

// 앱과 같은 방식으로 판(과 AI 동맹)을 만든다. 돌려주는 값: { g, hub, bots }
function buildWorld(B, rec) {
  const { E, T, NET, AI } = B;
  const unl = Array.isArray(rec.unl) ? rec.unl.slice() : null;
  if (T.unlock) T.unlock.provider = () => (unl ? unl.slice() : null); // 앱은 lobby.js가 넣는다(판을 만들 때 엔진이 부른다)
  const base = { diff: rec.diff, muts: rec.muts.slice(), mutLv: rec.mutLv | 0 };
  if (!(rec.ai > 0)) return { g: new E.Game(T, Object.assign({ mode: 'solo', seed: rec.seed }, base)), hub: null, bots: [] };
  const hub = NET.hub(), myNet = hub.join('me'), bots = [];
  for (let i = 0; i < rec.ai; i++) {
    const b = AI.BUILDS[rec.b[i]];
    if (!b) throw new Error('rec_build');
    const bn = hub.join('ai' + i);
    const bg = new E.Game(T, Object.assign({ mode: 'multi', seed: rec.seed + i + 1, net: bn, bot: true }, base));
    bn.attach(bg);
    bots.push({ g: bg, net: bn, brain: new AI.Brain(bg, b) });
  }
  const g = new E.Game(T, Object.assign({ mode: 'multi', seed: rec.seed, net: myNet, ai: rec.ai }, base));
  myNet.attach(g);
  return { g, hub, bots };
}

// 한 걸음(앱 src/ui/17-loop tick의 계산 한 번과 같아야 한다)
function stepWorld(w) {
  const h = w.g.stepDt();
  if (w.hub) w.hub.flush();
  w.g.step(h);
  for (const b of w.bots) { b.g.step(h); b.brain.update(h); b.g.events.length = 0; }
  w.g.events.length = 0;
}

// 재연산. opt: { maxMs(기본 120초), maxSteps(기본 600000), checkMuts(기본 true) }
function replay(B, rec, opt) {
  const o = Object.assign({ maxMs: 120000, maxSteps: 600000, checkMuts: true }, opt || {});
  const t0 = Date.now();
  const bad = checkRec(rec, B.T);
  if (bad) return { ok: false, err: bad, ms: Date.now() - t0 };
  if (rec.room) return { ok: false, err: 'rec_room_kind', ms: Date.now() - t0 }; // 협동 방 기록은 replayRoom으로
  // 악몽 +N 규칙은 씨앗으로 정해진다(앱 17-loop begin). 다르면 기기가 규칙을 골라 낸 것
  if (o.checkMuts) {
    const want = rec.diff === 'nightmare' ? B.E.Game.rollMuts(B.T, rec.mutLv | 0, rec.seed) : [];
    if (JSON.stringify(want) !== JSON.stringify(rec.muts)) return { ok: false, err: 'muts', ms: Date.now() - t0 };
  }
  let w;
  try { w = buildWorld(B, rec); } catch (e) { return { ok: false, err: 'build:' + e.message, ms: Date.now() - t0 }; }
  const cmds = rec.c, n = cmds.length, end = rec.end.step | 0;
  let ci = 0, at = n ? cmds[0][0] : Infinity, restores = 0;
  try {
    for (;;) {
      const g = w.g;
      while (ci < n && at === g.stepN) {
        const c = cmds[ci];
        if (c[1] === 'R') {
          if (w.hub) return { ok: false, err: 'restore_multi', ms: Date.now() - t0 };
          const s = g.snapshot();
          if (!s) return { ok: false, err: 'restore_phase', ms: Date.now() - t0 };
          w.g = B.E.Game.restore(B.T, JSON.parse(JSON.stringify(s)));
          restores++;
        } else w.g.input(c[1], c.slice(2));
        ci++;
        at = ci < n ? at + cmds[ci][0] : Infinity;
      }
      const g2 = w.g;
      if (g2.over) break;
      if (ci < n && at < g2.stepN) return { ok: false, err: 'cmd_order', ms: Date.now() - t0 };
      if (g2.stepN >= o.maxSteps || g2.stepN > end + 2) break; // 보고된 끝을 지나도 끝나지 않음 → 결과 다름
      stepWorld(w);
      if ((g2.stepN & 1023) === 0 && Date.now() - t0 > o.maxMs) return { ok: false, err: 'timeout', steps: g2.stepN, ms: Date.now() - t0 };
    }
  } catch (e) {
    return { ok: false, err: 'throw:' + String(e && e.message).slice(0, 120), steps: w.g.stepN, ms: Date.now() - t0 };
  }
  const res = summarize(w.g);
  res.restores = restores; res.left = n - ci; // 판이 끝난 뒤에 남은 명령(정상 기록이면 0)
  return { ok: true, res, ms: Date.now() - t0 };
}

// 재연산 결과와 보고를 맞춘다. report = 앱이 보낸 본문(round, win, time, st, myth, imm, ach)과 기록의 end.step.
// 판 결과·보상에 쓰이는 값만 본다. 돌려주는 값: 어긋난 칸 이름 목록(빈 배열 = 일치)
function compare(res, report, rec) {
  const out = [];
  if (!res.over) out.push('not_over');
  if ((report.round | 0) !== res.round) out.push('round');
  if (!!report.win !== res.win) out.push('win');
  if (Math.round(+report.time || 0) !== res.time) out.push('time');
  if (rec && rec.end && (rec.end.step | 0) !== res.steps) out.push('steps');
  const st = report.st && typeof report.st === 'object' ? report.st : {};
  Object.keys(res.st).forEach((k) => { if ((+st[k] || 0) !== res.st[k]) out.push('st.' + k); });
  const sameMap = (a, b) => { const x = a && typeof a === 'object' ? a : {}, ka = Object.keys(x).filter((k) => +x[k] > 0).sort(), kb = Object.keys(b).filter((k) => b[k] > 0).sort(); return ka.length === kb.length && ka.every((k, i) => k === kb[i] && (x[k] | 0) === b[k]); };
  if (!sameMap(report.myth, res.myth)) out.push('myth');
  if (report.imm && Object.keys(report.imm).length && !sameMap(report.imm, res.imm)) out.push('imm'); // 불멸 수는 온라인 판만 보고에 들어간다
  const ach = Array.isArray(report.ach) ? [...new Set(report.ach.map(String))].sort() : [];
  if (ach.length !== res.ach.length || ach.some((a, i) => a !== res.ach[i])) out.push('ach');
  if (res.left) out.push('cmds_after_end');
  return out;
}

// 전송 형식 풀기: base64(gzip(JSON)) → 기록. 크기 상한(풀린 뒤) 4MB
function decodeRec(b64, max) {
  if (typeof b64 !== 'string' || b64.length > (max || 200000)) return null; // max: 협동 방 판의 따로 온 큰 기록(replay.js COOP_REC_MAX)
  try { return JSON.parse(zlib.gunzipSync(Buffer.from(b64, 'base64'), { maxOutputLength: 4 * 1024 * 1024 }).toString('utf8')); } catch (e) { return null; }
}
const encodeRec = (rec) => zlib.gzipSync(Buffer.from(JSON.stringify(rec))).toString('base64');

// 시험·비교용 상태 지문(판 상태 핵심 값의 해시)
function digest(g) {
  const h = crypto.createHash('sha256');
  const u = g.units.map((x) => [x.id, x.def.id, x.x, x.y, x.cd]), e = g.enemies.map((x) => [x.id, x.x, x.y, x.hp]);
  h.update(JSON.stringify([g.stepN, g.round, g.phase, g.time, g.lives, g.players.map((p) => p.gold), g.rand.s, u, e, g.fight ? [g.fight.boss.hp, g.fight.boss.x, g.fight.boss.y, g.fight.champs.map((c) => [c.x, c.y, c.hp])] : 0]));
  return h.digest('hex').slice(0, 16);
}


// ======================= 협동 방 판 재연산(2026-11-28 C1) =======================
// 기기 기록(앱 17-loop begin, net.js recHead): 혼자 판 기록 머리 + room: { me(내 자리 id), q0(판을 붙일 때까지 적용한 방 일련번호), dr0(그때 뺀 자리) }
//   명령에 더해지는 것(net.js): ['M', dq] 이 걸음 앞에서 방 일련번호를 dq만큼 더 적용(같은 걸음의 소식은 하나로 합친다)
//                              ['J', q]  다시 붙음(그 시점 서버 방 상태로 바뀌고 rejoined)
//                              ['N', 종류, 값...] net.js applyCmd(벽시계·화면 판단: dr·sy·hg·ts·vo·qt)
// 서버 방 기록(server/room-log.js 파일): { startQ, baseQ, endQ, base: { 자리: { u: 계정, s: 상태 } }, ev: [[q, 'p'|'m'|'l'|'h', 자리, ...]], host, capped }
// 재연산: 기록 시작 상태(base)에 q0까지 접은 방 상태로 그 기기의 net(전송 계층만 재연산용)을 만들고, 기기 명령대로 소식을 같은 걸음에 넣는다.
// 그 기기가 내보낸 소식은 방 기록의 그 자리 소식과 맞아야 한다(outCheck — 기기가 판과 다른 소식을 보냈으면 방장 소식 위조).

// 서버 중계가 소식에 하는 정리(server/app.js cleanRelay와 같아야 한다 — 기기가 보낸 값과 기록 값을 같은 모양으로 맞춰 비교)
function cleanRelay(v, cap, depth) {
  depth = depth || 0;
  if (v == null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'string') { const s = v.replace(/[<>"`]/g, ''); return cap ? s.slice(0, cap) : s; }
  if (depth >= 6) return null;
  if (Array.isArray(v)) return v.slice(0, 400).map((x) => cleanRelay(x, cap, depth + 1));
  if (typeof v === 'object') {
    const o = {};
    Object.keys(v).slice(0, 80).forEach((k) => { if (/^[A-Za-z0-9_$-]{1,24}$/.test(k) && k !== '__proto__' && k !== 'constructor' && k !== 'prototype') o[k] = cleanRelay(v[k], cap, depth + 1); });
    return o;
  }
  return null;
}
const jclone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const OUT_TOPICS = ['phase', 'hz', 'pattern', 'bs', 'dmg', 'sup', 'wiped']; // 걸음 안에서 나가는 소식: 순서까지 맞아야 한다
const OUT_PRES = ['out', 'picked', 'deployed', 'rd', 'vol']; // 판 흐름을 정하는 자리 상태(값이 바뀐 순서가 맞아야 한다)
const PHASE_NO = { wave: 1, bossIntro: 2, bossPick: 3, boss: 4, over: 5 };

function roomFold(st, e) {
  const pid = e[2];
  if (e[1] === 'p') { const s = st[pid] || (st[pid] = { u: null, s: {} }); Object.assign(s.s, jclone(e[3])); }
  else if (e[1] === 'h') { const s = st[pid] || (st[pid] = { u: null, s: {} }); s.u = e[3]; }
  else if (e[1] === 'l') delete st[pid];
}
function loadRoomLog(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file), { maxOutputLength: 256 * 1024 * 1024 }).toString('utf8'));
}
// 기록에서 자리 하나의 계정(처음 본 값)
function seatUid(L, pid) {
  if (L.base && L.base[pid] && L.base[pid].u) return L.base[pid].u;
  const h = L.ev.find((e) => e[1] === 'h' && e[2] === pid);
  return h ? h[3] : null;
}
// 계정 → 판 시작 뒤 그 계정의 자리 id
function seatOf(L, uid) {
  for (const e of L.ev) if (e[1] === 'h' && e[3] === uid) return e[2];
  for (const pid of Object.keys(L.base || {})) if (L.base[pid].u === uid) return pid;
  return null;
}
// 판 시작 뒤 그 자리가 처음 알린 탈락 라운드(없으면 0)
function outRoundOf(L, pid) {
  for (const e of L.ev) if (e[0] > L.startQ && e[1] === 'p' && e[2] === pid && e[3] && e[3].out) return e[3].out | 0;
  return 0;
}
function startOf(L) { return L.ev.find((e) => e[0] >= L.startQ && e[1] === 'm' && e[3] === 'start') || null; }

// 재연산용 전송 계층(net.js wsTransport와 같은 모양·같은 적용 순서)
function replayTransport(me, mine) {
  const handlers = {}, peers = {}, outM = {}, outP = {};
  const api = {
    kind: 'ws', presHook: true, onPres: null, onRejoin: null, onSeq: null, onHelloQ: null,
    on: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
    send: (t, d) => { (outM[t] = outM[t] || []).push(JSON.stringify(cleanRelay(jclone(d), 0))); (handlers[t] || []).forEach((f) => f(d, me, true)); },
    presence: (p) => { Object.assign(mine, p); OUT_PRES.forEach((k) => { if (p && p[k] !== undefined) (outP[k] = outP[k] || []).push(JSON.stringify(cleanRelay(jclone(p[k]), 64))); }); },
    peers: () => [{ id: me, me: true, state: mine, seen: 0 }].concat(Object.keys(peers).map((k) => ({ id: k, me: false, state: peers[k].state, seen: 0 }))),
    onPeers: () => {}, leave: () => {}, closed: () => false, online: () => true, linked: () => true, seq: () => 0, seqOn: () => false,
  };
  return { api, handlers, peers, outM, outP, get mine() { return mine; }, set mine(v) { mine = v; } };
}
// a(기록)가 b(재연산)의 부분 열(순서 그대로)인지. 앞뒤로 같은 값은 하나로 본다(presence는 50ms 묶음이라 중간 값이 빠진다)
const dedupe = (a) => a.filter((x, i) => i === 0 || x !== a[i - 1]);
function subseq(a, b) { let j = 0; for (const x of a) { while (j < b.length && b[j] !== x) j++; if (j >= b.length) return false; j++; } return true; }

// opt: { uid(보고한 계정, 자리 확인), maxMs, maxSteps }
// 돌려주는 값: { ok, res(summarize + team), out: [내보낸 소식이 기록과 다른 칸], ms } | { ok: false, err }
function replayRoom(B, rec, L, opt) {
  const o = Object.assign({ maxMs: 120000, maxSteps: 600000 }, opt || {});
  const t0 = Date.now(), fail = (err, x) => Object.assign({ ok: false, err, ms: Date.now() - t0 }, x || {});
  const bad = checkRec(rec, B.T);
  if (bad) return fail(bad);
  const R = rec.room;
  if (!R || typeof R.me !== 'string' || !Number.isInteger(R.q0) || (R.dr0 != null && (!Array.isArray(R.dr0) || R.dr0.some((x) => typeof x !== 'string')))) return fail('rec_room');
  if (!L || !Array.isArray(L.ev)) return fail('log_bad');
  if (L.capped) return fail('log_capped');
  const st = startOf(L);
  if (!st || !st[4] || typeof st[4] !== 'object') return fail('log_nostart');
  // 판 설정은 방장의 시작 신호(서버 기록)에서. 기기 기록 머리와 다르면 기기가 다른 판을 보고한 것
  const sd = st[4], diff = String(sd.diff || '').slice(0, 16), seed = (sd.seed | 0) >>> 0, mutLv = (Number.isFinite(sd.mutLv) ? Math.min(99, Math.max(0, sd.mutLv)) : 0) | 0;
  const muts = Array.isArray(sd.muts) ? sd.muts.filter((x) => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 24)) : [];
  if ((rec.seed >>> 0) !== seed || rec.diff !== diff || (rec.mutLv | 0) !== mutLv || JSON.stringify(rec.muts) !== JSON.stringify(muts)) return fail('start_mismatch');
  if (!B.T.difficulties.some((d) => d.id === diff)) return fail('rec_diff');
  const me = R.me;
  if (o.uid != null && seatUid(L, me) !== String(o.uid)) return fail('seat');
  if (R.q0 < (L.baseQ | 0) || R.q0 > L.endQ) return fail('q0');
  // q0까지 접은 서버 방 상태
  const S = jclone(L.base || {}), ev = L.ev;
  let i = 0;
  while (i < ev.length && ev[i][0] <= R.q0) roomFold(S, ev[i++]);
  // 판을 붙일 때 이미 빠져 있던 자리(dr0)는 그 전에 방장 시계(clk)가 알린 목록 안에 있어야 한다
  if (R.dr0 && R.dr0.length) {
    const seen = new Set();
    ev.forEach((e) => { if (e[0] <= R.q0 && e[1] === 'm' && e[3] === 'clk' && e[4] && Array.isArray(e[4].dr)) e[4].dr.forEach((x) => seen.add(x)); });
    if (R.dr0.some((x) => !seen.has(x))) return fail('dr0');
  }
  const TR = replayTransport(me, S[me] ? jclone(S[me].s) : {});
  Object.keys(S).forEach((pid) => { if (pid !== me) TR.peers[pid] = { state: jclone(S[pid].s) }; });
  const { E, T, NET } = B;
  if (!NET || !NET.make) return fail('noeng_room');
  const unl = Array.isArray(rec.unl) ? rec.unl.slice() : null;
  if (T.unlock) T.unlock.provider = () => (unl ? unl.slice() : null);
  const net = NET.make(TR.api, 'replay');
  net.started = true; net.diff = diff;
  if (R.dr0) R.dr0.forEach((x) => net.dropped.add(x));
  let g;
  try { g = new E.Game(T, { diff, mode: 'multi', seed, net, muts, mutLv, online: true }); } catch (e) { return fail('build:' + e.message); }
  net.attach(g);
  // 방장 시계(clk)가 보여 준 라운드·단계가 실제로 있었는지 보려고 지나간 (라운드, 단계)를 모은다
  const seenRP = new Set(), dropAll = new Set(R.dr0 || []);
  const mark = () => { seenRP.add(g.round * 8 + (PHASE_NO[g.phase] || 0)); net.dropped.forEach((x) => dropAll.add(x)); };
  let rq = R.q0, rejoins = 0, err = null;
  const deliverTo = (q) => {
    if (q > L.endQ) { err = 'log_short'; return; }
    while (i < ev.length && ev[i][0] <= q) {
      const e = ev[i++];
      roomFold(S, e);
      if (e[2] === me) { if (e[1] === 'h') { err = 'm_hello'; return; } continue; } // 내가 보낸 것은 나에게 오지 않는다. 내 hello는 J로만
      if (e[1] === 'p') { const P = TR.peers[e[2]] || { state: {} }; Object.assign(P.state, jclone(e[3])); TR.peers[e[2]] = P; if (TR.api.onPres) TR.api.onPres(e[2], jclone(e[3]), 0, P.state); }
      else if (e[1] === 'm') (TR.handlers[e[3]] || []).forEach((f) => f(jclone(e[4]), e[2], false));
      else if (e[1] === 'l') delete TR.peers[e[2]];
      mark();
    }
  };
  const helloAt = (q) => {
    if (q < rq || q > L.endQ) { err = 'j_order'; return; }
    while (i < ev.length && ev[i][0] <= q) roomFold(S, ev[i++]); // 끊긴 동안의 소식은 받지 못했다(접기만)
    Object.keys(TR.peers).forEach((k) => delete TR.peers[k]);
    Object.keys(S).forEach((pid) => { if (pid !== me) TR.peers[pid] = { state: jclone(S[pid].s) }; });
    if (S[me]) Object.assign(TR.mine, jclone(S[me].s));
    rejoins++;
    if (TR.api.onRejoin) TR.api.onRejoin();
    mark();
  };
  const cmds = rec.c, n = cmds.length, end = rec.end.step | 0;
  let ci = 0, at = n ? cmds[0][0] : Infinity;
  try {
    mark();
    for (;;) {
      while (ci < n && at === g.stepN) {
        const c = cmds[ci];
        if (c[1] === 'M') { if (!Number.isInteger(c[2]) || c[2] < 0) return fail('rec_cmd'); rq += c[2]; deliverTo(rq); }
        else if (c[1] === 'J') { if (!Number.isInteger(c[2])) return fail('rec_cmd'); helloAt(c[2]); rq = c[2]; }
        else if (c[1] === 'N') { if (typeof c[2] !== 'string') return fail('rec_cmd'); net.applyCmd(c[2], c.slice(3)); }
        else if (c[1] === 'R') return fail('restore_room');
        else g.input(c[1], c.slice(2));
        if (err) return fail(err, { steps: g.stepN });
        mark();
        ci++;
        at = ci < n ? at + cmds[ci][0] : Infinity;
      }
      if (g.over) break;
      if (ci < n && at < g.stepN) return fail('cmd_order');
      if (g.stepN >= o.maxSteps || g.stepN > end + 2) break;
      g.step(g.stepDt());
      g.events.length = 0;
      mark();
      if ((g.stepN & 1023) === 0 && Date.now() - t0 > o.maxMs) return fail('timeout', { steps: g.stepN });
    }
  } catch (e) {
    return fail('throw:' + String(e && e.message).slice(0, 120), { steps: g.stepN });
  }
  const res = summarize(g);
  res.left = n - ci;
  res.team = { team: g.teamOver || null, round: g.round, out: g.out | 0, dropped: [...dropAll], rejoins, seat: me, bossN: (T.bosses || []).filter((b) => b.round > 0 && b.round <= g.round).length };
  // 내보낸 소식 맞추기: 방 기록의 내 자리 소식(시작 신호 뒤)이 재연산이 내보낸 소식의 부분 열이어야 한다(끊긴 동안·서버가 넘쳐 버린 것은 빠질 수 있다)
  const out = [], logM = {}, logP = {}, joinP = new Set();
  ev.forEach((e) => { if (e[1] === 'h' && e[2] === me) joinP.add(e[0] + 1); }); // 들어올 때 서버가 대신 알린 내 상태 줄
  ev.forEach((e) => {
    if (e[0] <= L.startQ || e[2] !== me) return;
    if (e[1] === 'm' && OUT_TOPICS.includes(e[3])) (logM[e[3]] = logM[e[3]] || []).push(JSON.stringify(e[4]));
    else if (e[1] === 'm' && e[3] === 'clk') {
      const d = e[4] || {};
      if (!Number.isFinite(d.r) || !seenRP.has((d.r | 0) * 8 + (PHASE_NO[d.ph] || 0))) out.push('clk');
      else if (Array.isArray(d.dr) && d.dr.some((x) => !dropAll.has(x))) out.push('clk.dr');
    } else if (e[1] === 'p' && !joinP.has(e[0])) OUT_PRES.forEach((k) => { if (e[3] && e[3][k] !== undefined) (logP[k] = logP[k] || []).push(JSON.stringify(e[3][k])); });
  });
  OUT_TOPICS.forEach((t) => { if (logM[t] && !subseq(logM[t], TR.outM[t] || [])) out.push('msg.' + t); });
  OUT_PRES.forEach((k) => { if (logP[k] && !subseq(dedupe(logP[k]), dedupe(TR.outP[k] || []))) out.push('pres.' + k); });
  return { ok: true, res, out: [...new Set(out)], ms: Date.now() - t0 };
}

// 손님 보고를 기준 판(재연산한 팀 결과)과 맞춘다. team = replayRoom의 res.team(bossN = 팀 끝 라운드까지 나온 보스 수), seat = 손님 자리, outR = 기록에서 손님이 알린 탈락 라운드(0 = 없음)
// 돌려주는 값: 어긋난 칸 목록(빈 배열 = 맞음)
function guestCheck(team, rep, seat, outR) {
  const out = [], round = rep.round | 0, win = !!rep.win;
  if (!seat) return ['seat'];
  if (outR) { if (win) out.push('win'); if (round > outR) out.push('round'); }
  else {
    if (win !== (team.team === 'win')) out.push('win');
    if (win ? round !== team.round : round > team.round) out.push('round');
  }
  if (win && team.dropped.includes(seat)) out.push('dropped');
  const nb = team.bossN | 0, s = rep.st && typeof rep.st === 'object' ? rep.st : {};
  if ((+s.bosses || 0) > nb) out.push('st.bosses');
  if ((+s.bossWins || 0) > nb) out.push('st.bossWins');
  return out;
}

module.exports = { BUNDLE_FILES, REC_V, engineHash, loadBundle, replay, compare, summarize, statsOf, decodeRec, encodeRec, digest, buildWorld, stepWorld, checkRec, cleanRelay, loadRoomLog, replayRoom, guestCheck, seatOf, seatUid, outRoundOf, roomFold };
