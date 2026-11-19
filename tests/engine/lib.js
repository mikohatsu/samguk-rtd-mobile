// 게임 규칙 자동 시험 공용 함수. 의존성 없음(Node만). 출력은 server/test/store-smoke.js와 같은 OK/FAIL 줄.
// 유형: Logic/Integration · 위치: tests/engine/ · 게이트: BLOCKING(알려진 버그는 [B-xx]로 표시)
'use strict';
const path = require('path');
// RTD_ROOT로 다른 폴더의 게임 코드(예: 고치기 전 HEAD를 풀어 둔 곳)를 시험할 수 있다
const ROOT = process.env.RTD_ROOT ? path.resolve(process.env.RTD_ROOT) : path.join(__dirname, '..', '..');

// net.js:347이 window.RTD_I18N을 직접 본다. Node에는 window가 없으므로 먼저 둔다.
globalThis.window = globalThis;

// 난수 고정: 엔진은 opt.seed로 고정된다. net.js·Game.restore가 쓰는 Math.random도 씨앗 있는 것으로 바꾼다(이 프로세스 안에서만).
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let rnd = mulberry(1);
Math.random = () => rnd();
function seedRandom(s) { rnd = mulberry(s); }

const E = require(path.join(ROOT, 'engine.js'));
require(path.join(ROOT, 'raid.js'));
require(path.join(ROOT, 'synergy.js'));
const T = require(path.join(ROOT, 'theme-samguk.js'));
const AI = require(path.join(ROOT, 'ai.js'));
require(path.join(ROOT, 'net.js'));
const NET = globalThis.RTD_NET;
const DT = 1 / 30;

// ---- 결과 줄 ----
const C = { ok: 0, fail: 0, skip: 0 };
const T0 = Date.now();
function ok(c, m) { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) C.ok++; else { C.fail++; process.exitCode = 1; } return !!c; }
// 확인하지 못한 것. 통과로 세지 않는다.
function skip(m) { console.log('SKIP ' + m); C.skip++; }
function info(m) { console.log('     ' + m); }
function done(name) {
  console.log(`RESULT ${name} ok=${C.ok} fail=${C.fail} skip=${C.skip} ms=${Date.now() - T0}`);
  if (C.fail) process.exitCode = 1;
}
process.on('uncaughtException', (e) => {
  console.log('FAIL 시험 코드 밖으로 나온 예외: ' + e.message + ' | ' + String(e.stack).split('\n').slice(1, 4).join(' | '));
  C.fail++; process.exitCode = 1;
});
const errText = (e) => e.message + ' @ ' + String(e.stack).split('\n').slice(1, 4).map((s) => s.trim().replace(ROOT, '')).join(' | ');

// ---- 불변식 ----
const PHASES = ['wave', 'bossIntro', 'bossPick', 'boss', 'over'];
const SKIP_KEYS = new Set(['def', 'u', 'w', 'midDef', 'target', 'tgt', 'burnC', 'T', 'R', 'net']);
function walkFinite(v, p, seen, out, depth) {
  if (typeof v === 'number') { if (!Number.isFinite(v)) out.add(p + '=' + v); return; }
  if (!v || typeof v !== 'object' || depth > 8 || seen.has(v)) return;
  seen.add(v);
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) walkFinite(v[i], p + '[]', seen, out, depth + 1); return; }
  for (const k of Object.keys(v)) if (!SKIP_KEYS.has(k)) walkFinite(v[k], p + '.' + k, seen, out, depth + 1);
}
// 한 게임을 지켜보는 감시자. check(g)를 300걸음마다 부른다. 게임을 갈아 끼워도(T4) 이어서 쓸 수 있다.
function makeWatch(label) {
  const W = { label: label || '', viol: new Map(), lastRound: 0, sig: null, sigT: 0, stalled: false, checks: 0 };
  const add = (key, g, detail) => {
    const v = W.viol.get(key);
    if (v) v.n++;
    else W.viol.set(key, { n: 1, first: `R${g.round} ${g.phase} t=${Math.round(g.time)}s${detail ? ' ' + detail : ''}` });
  };
  W.check = (g) => {
    W.checks++;
    const { INNER, ARENA } = E, PAD = 2;
    if (g.round < W.lastRound) add('라운드가 줄어듦', g, `${W.lastRound}→${g.round}`);
    W.lastRound = g.round;
    if (!PHASES.includes(g.phase)) add('모르는 phase', g, String(g.phase));
    if (g.phase === 'wave' && g.fight) add('wave인데 fight가 남음', g);
    if ((g.phase === 'boss' || g.phase === 'bossPick' || g.phase === 'bossIntro') && !g.fight) add('보스 단계인데 fight가 없음', g);
    if (!(Number.isFinite(g.lives) && g.lives >= 0)) add('라이프 범위 밖', g, String(g.lives));
    g.players.forEach((p) => { if (!(Number.isFinite(p.gold) && p.gold >= 0)) add('금화 범위 밖', g, String(p.gold)); });
    if (g.enemies.length > g.limit + 10) add('적 수가 한도를 크게 넘음', g, `${g.enemies.length}/${g.limit}`);
    g.units.forEach((u) => {
      if (!u.def || !(u.def.tier > 0)) return;
      if (!(u.x >= INNER.x0 - PAD && u.x <= INNER.x1 + PAD && u.y >= INNER.y0 - PAD && u.y <= INNER.y1 + PAD)) add('유닛 좌표가 INNER 밖', g, `${u.def.id} (${Math.round(u.x)},${Math.round(u.y)})`);
    });
    const f = g.fight;
    if (f) {
      const b = f.boss;
      if (!(b.hp >= -1e-6 && b.hp <= b.mhp + 1e-6)) add('보스 체력 범위 밖', g, `${b.hp}/${b.mhp}`);
      if (g.phase === 'boss') f.champs.forEach((c) => {
        if (c.dead || c.bench) return;
        if (!(c.x >= ARENA.x0 - PAD && c.x <= ARENA.x1 + PAD && c.y >= ARENA.y0 - PAD && c.y <= ARENA.y1 + PAD)) add('출전 장수 좌표가 ARENA 밖', g, `${c.def.id} (${Math.round(c.x)},${Math.round(c.y)})`);
        if (!(c.hp <= c.mhp + 1e-6)) add('장수 체력이 최대보다 큼', g, `${c.def.id} ${c.hp}/${c.mhp}`);
      });
    }
    const bad = new Set(), seen = new Set();
    walkFinite(g.units, 'units', seen, bad, 0); walkFinite(g.enemies, 'enemies', seen, bad, 0); walkFinite(g.drops, 'drops', seen, bad, 0);
    walkFinite(g.fight, 'fight', seen, bad, 0); walkFinite(g.players, 'players', seen, bad, 0); walkFinite(g.stats, 'stats', seen, bad, 0);
    ['time', 'round', 'roundT', 'lives', 'spawned', 'toSpawn'].forEach((k) => { if (typeof g[k] === 'number' && !Number.isFinite(g[k])) bad.add(k + '=' + g[k]); });
    bad.forEach((p) => add('유한하지 않은 숫자: ' + p, g, f ? `보스 ${f.def.name}` : ''));
    // 멈춤 감시: 게임 시간 120초 동안 round도 fight.t도 phase도 그대로면 멈춘 것
    if (!g.over) {
      const sig = g.round + '|' + g.phase + '|' + (f ? f.t : '');
      if (sig !== W.sig) { W.sig = sig; W.sigT = g.time; }
      else if (g.time - W.sigT >= 120) { W.stalled = true; add('120초 동안 진행 없음', g, sig); }
    }
  };
  return W;
}
function violText(W) { return [...W.viol.entries()].map(([k, v]) => `${W.label ? W.label + ' ' : ''}${k} ×${v.n} (처음: ${v.first})`); }

// ---- 게임 만들기·돌리기 ----
const build = (i) => AI.BUILDS[i % AI.BUILDS.length];
const diffOf = (id) => T.difficulties.find((d) => d.id === id);
const maxStepsFor = (id) => Math.round((diffOf(id).rounds * 60 + 3600) / DT);

function makeSolo(o) {
  seedRandom(o.seed);
  const muts = o.muts || [];
  const g = new E.Game(T, { diff: o.diff, mode: 'solo', seed: o.seed, bot: true, muts, mutLv: muts.length });
  return { g, brain: new AI.Brain(g, build(o.build || 0)) };
}
// 혼자(AI 1인) 한 판. o.each(state, step)이 state.g/state.brain을 바꿔 끼울 수 있다. 'stop'을 돌려주면 멈춘다.
function runSolo(o) {
  const r = { error: null, steps: 0, capped: false, stalled: false, g: null, watch: makeWatch(), ms: 0 };
  const t0 = Date.now(), cap = o.maxSteps || maxStepsFor(o.diff);
  try {
    const st = makeSolo(o);
    r.state = st;
    while (!st.g.over) {
      st.g.step(DT); st.brain.update(DT); st.g.events.length = 0;
      r.steps++;
      if (o.each && o.each(st, r.steps) === 'stop') break;
      if (r.steps % 300 === 0) { r.watch.check(st.g); if (r.watch.stalled) { r.stalled = true; break; } }
      if (r.steps >= cap) { r.capped = true; break; }
    }
    r.watch.check(st.g);
    r.g = st.g;
  } catch (e) { r.error = errText(e); r.g = r.state && r.state.g; }
  r.ms = Date.now() - t0;
  return r;
}

// 가상 방(RTD_NET.hub)에 AI n명. src/ui/17-loop.js의 판 시작(107~116줄)과 같은 방식.
function makeParty(o) {
  seedRandom(o.seed);
  const hub = NET.hub(), members = [], muts = o.muts || [];
  for (let i = 0; i < o.n; i++) {
    const net = hub.join('AI' + i);
    const g = new E.Game(T, { diff: o.diff, mode: 'multi', seed: o.seed + i, net, bot: true, muts, mutLv: muts.length });
    net.attach(g);
    members.push({ i, g, net, brain: new AI.Brain(g, build(i + (o.build || 0))), active: true, watch: makeWatch('#' + i) });
  }
  return { hub, members };
}
// 화면 코드 tick()(17-loop.js:34~46)과 같은 순서
function stepParty(P) {
  P.hub.flush();
  const act = P.members.filter((m) => m.active);
  act.forEach((m) => m.g.step(DT));
  act.forEach((m) => {
    m.net.tickStatus(DT, m.g);
    m.brain.update(DT);
    m.g.events.forEach((e) => { if (e.type === 'pop' && !e.remote) m.net.send('pop', { id: e.def.id, name: m.net.name }); });
    m.g.events.length = 0;
  });
  P.hub.flush();
}
const hostOf = (P) => P.members.find((m) => m.active && m.net.isHost());
// 방장이 방을 나간 것처럼: 남은 사람의 명단에서 빠지고(away), 그 게임은 더 돌지 않고 메시지도 처리하지 않는다.
// 주의: 실제 서버 끊김(5~10초 뒤 자리 비움 처리)이 아니라 즉시 빠지는 흉내다.
function removeHost(P) {
  const h = hostOf(P);
  h.net.t.presence({ away: true });
  h.net.game = null;
  h.active = false;
  return h;
}
function runParty(o) {
  const r = { error: null, steps: 0, capped: false, stalled: false, P: null, maxGap: 0, ms: 0 };
  const t0 = Date.now(), cap = o.maxSteps || maxStepsFor(o.diff);
  let grace = -1;
  try {
    const P = makeParty(o); r.P = P;
    for (;;) {
      stepParty(P);
      r.steps++;
      const act = P.members.filter((m) => m.active);
      if (o.each && o.each(P, r.steps) === 'stop') break;
      if (act.every((m) => m.g.over)) break;
      // o.stopRound: 모두 이 라운드의 라인 단계에 닿으면 멈춘다(시간 절약. r.stopped로 알린다)
      if (o.stopRound && act.every((m) => !m.g.over && m.g.round >= o.stopRound && m.g.phase === 'wave')) { r.stopped = true; break; }
      // 한 명이 끝나면 나머지는 신호를 받아 곧 끝나야 한다(3초 여유)
      if (act.some((m) => m.g.over)) { if (grace < 0) grace = 90; else if (--grace === 0) break; }
      if (r.steps % 300 === 0) {
        act.forEach((m) => m.watch.check(m.g));
        const rs = act.map((m) => m.g.round);
        r.maxGap = Math.max(r.maxGap, Math.max(...rs) - Math.min(...rs));
        if (act.some((m) => m.watch.stalled)) { r.stalled = true; break; }
      }
      if (r.steps >= cap) { r.capped = true; break; }
    }
    P.members.filter((m) => m.active).forEach((m) => m.watch.check(m.g));
  } catch (e) { r.error = errText(e); }
  r.ms = Date.now() - t0;
  return r;
}
const partyViol = (P) => P.members.flatMap((m) => violText(m.watch));
const bossLog = (g) => g.stats.bosses.map((b) => `${b.round}${b.win ? '승' : '패'}`).join(' ') || '없음';
// 그 난이도에 나오는 보스 가운데 한 번도 싸워 보지 못한 라운드
const bossesMissed = (g) => T.bosses.filter((b) => b.round <= g.diff.rounds && !g.stats.bosses.some((x) => x.round === b.round)).map((b) => b.round);

// 처음 다른 곳의 경로(없으면 null)
function firstDiff(a, b, p) {
  p = p || '';
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return `${p || '(root)'}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${p}: 배열/객체 다름`;
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  for (const k of keys) { const d = firstDiff(a[k], b[k], p + (Array.isArray(a) ? `[${k}]` : '.' + k)); if (d) return d; }
  return null;
}

module.exports = { ROOT, E, T, AI, NET, DT, ok, skip, info, done, errText, seedRandom, makeWatch, violText, makeSolo, runSolo, makeParty, stepParty, runParty, hostOf, removeHost, partyViol, bossLog, bossesMissed, firstDiff, diffOf, build, maxStepsFor };
