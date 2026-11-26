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
function decodeRec(b64) {
  if (typeof b64 !== 'string' || b64.length > 200000) return null;
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

module.exports = { BUNDLE_FILES, REC_V, engineHash, loadBundle, replay, compare, summarize, statsOf, decodeRec, encodeRec, digest, buildWorld, stepWorld, checkRec };
