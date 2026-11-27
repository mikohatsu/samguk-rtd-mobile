// 협동 방 판 흉내(시험용): 이 프로세스 안의 서버(server/app.js)에 Node 기기 여럿을 진짜 WebSocket으로 붙여 방 판을 한다.
// 기기마다 엔진 묶음을 따로 불러(server/replay-core loadBundle — 앱과 같은 전역 상자) net.js wsTransport를 그대로 쓴다.
// 판 시작·기록·보고는 앱(src/ui/17-loop begin, 18-account reportResult)과 같은 순서로 한다. 조작은 tests/engine/driver.js(g.input만).
// tests/server-coop-replay.js가 쓴다.
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RC = require(path.join(ROOT, 'server', 'replay-core.js'));
const { Driver } = require('./engine/driver');

// 끊김 흉내: 기기가 만든 WebSocket을 모아 둔다(drop(기기)로 그 기기의 연결만 끊는다)
const sockets = [];
const RealWS = globalThis.WebSocket;
class TrackWS extends RealWS { constructor(u) { super(u); sockets.push(this); this._u = u; } }
globalThis.WebSocket = TrackWS;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const tick = () => new Promise((r) => setImmediate(r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// o = { port, api(path, body, tok), lang }
function makeClient(o, name, tok, seed, opt) {
  const A = RC.loadBundle(ROOT, o.lang || 'ja');
  A.ctx.RTD_SERVER = `ws://127.0.0.1:${o.port}`;
  const c = { name, tok, A, net: null, g: null, drv: opt && opt.passive ? null : new Driver(seed), r: mulberry(seed * 13 + 5), ticket: null, startD: null, active: true, frames: 0, sockets: [], hooks: opt || {} };
  c.connect = async (code) => {
    const before = sockets.length;
    const n = await A.NET.connect(code, name, { token: tok });
    if (!n || typeof n !== 'object') throw new Error('connect ' + n);
    c.net = n; n.code = code;
    c.sockets = sockets.slice(before);
    n.onStart = (s) => { c.startD = s; };
    return c;
  };
  // 앱 begin(방 협동)과 같은 순서: 판 만들기 → 기록기(net.recHead) → 인연 유지 입력 → 표 요청 → attach
  c.begin = async () => {
    // startEdit(시작 신호 사본): 조작 흉내(예: 서버 씨앗을 무시하고 자기 씨앗으로 판을 만든다)
    const s = c.hooks.startEdit ? c.hooks.startEdit(Object.assign({}, c.startD)) : c.startD, E = A.E;
    const opt2 = { diff: s.diff, mode: 'multi', seed: s.seed, net: c.net, muts: s.muts || [], mutLv: s.mutLv || 0, online: true, key: c.net.code + '-' + s.seed };
    const g = new E.Game(A.T, opt2);
    const rh = c.hooks.noRec ? null : c.net.recHead();
    if (rh) g.rec = new E.Recorder({ v: 1, pf: c.hooks.pf || 'v8', eh: RC.engineHash(ROOT), lang: A.lang, seed: g.seed, diff: g.diff.id, mutLv: g.mutLv | 0, muts: g.muts.map((m) => m.id), unl: g.unlocked, ai: 0, room: rh });
    g.input('ks', [1]);
    c.net.attach(g);
    c.g = g;
    const r = await o.api('/api/game/start', { diff: s.diff, mutLv: s.mutLv || 0, room: c.net.code, seed: c.hooks.oldTk ? undefined : g.seed, save: false }, tok); // 앱 17-loop처럼 판 씨앗을 실어 그 시작의 표를 받는다
    c.ticket = r.ticket || null;
  };
  // 한 프레임: 걸음 몇 번(앱 17-loop tick) → tickStatus
  c.frame = () => {
    const g = c.g, net = c.net;
    if (!g || !c.active) return;
    const held = net.clock.pz || net.kicked;
    let n = 0;
    if (!g.over && !held) {
      n = 1 + ((c.r() * 3) | 0);
      for (let k = 0; k < n && !g.over; k++) {
        const h = g.stepDt();
        g.step(h);
        if (c.drv) c.drv.update(g, h);
        if (c.hooks.each) c.hooks.each(c, g);
      }
    }
    net.tickStatus(Math.max(n, 1) / 30, g);
    g.events.length = 0;
    c.frames++;
  };
  c.body = () => {
    const g = c.g, s = RC.summarize(g);
    return { ticket: c.ticket, myth: s.myth, st: s.st, mode: 'room', key: c.net.code + '-' + g.seed, party: c.net.code + '-' + g.seed, diff: g.diff.id, round: s.round, win: s.win, mutLv: g.mutLv || 0, time: s.time, imm: s.imm, ach: s.ach };
  };
  c.rec = () => (c.g && c.g.rec ? c.g.rec.dump(c.g.stepN) : null);
  // 연결 끊기(앱을 내렸다 돌아온 것처럼): 열린 소켓을 닫으면 net.js가 1.5초 뒤 같은 방에 다시 붙는다
  c.drop = () => { sockets.filter((w) => w.readyState === 1 && c.sockets.includes(w)).forEach((w) => w.close()); };
  return c;
}
// 새 소켓(다시 붙기)도 그 기기 것으로 센다
function adopt(c) { const mine = new Set(c.sockets); sockets.forEach((w) => { if (!mine.has(w) && w._u && w._u.includes('t=' + encodeURIComponent(c.tok))) c.sockets.push(w); }); }

// 방 하나에 기기들을 넣고 판을 끝까지(또는 stopAt) 돌린다. o.each(frame) 훅
async function playRoom(o, clients, opt) {
  const code = opt.code;
  for (const c of clients) { await c.connect(code); await sleep(30); }
  await sleep(200);
  const host = clients[0];
  if (opt.startFn) opt.startFn(host, opt); // 시작 신호를 다르게 보내는 흉내(예전 앱 방장·조작)
  else host.net.start(opt.diff || 'easy', { muts: opt.muts || [], mutLv: opt.mutLv || 0 });
  for (let i = 0; i < 200 && clients.some((c) => !c.startD); i++) await sleep(10);
  if (clients.some((c) => !c.startD)) throw new Error('start 신호를 못 받음');
  for (const c of clients) await c.begin();
  let frames = 0;
  const t0 = Date.now();
  for (;;) {
    clients.forEach((c) => { adopt(c); c.frame(); });
    frames++;
    if (opt.onFrame && opt.onFrame(frames) === 'stop') break;
    const act = clients.filter((c) => c.active);
    if (act.every((c) => c.g.over)) { for (let k = 0; k < 10; k++) { clients.forEach((c) => c.frame()); await tick(); } break; }
    if (frames > (opt.maxFrames || 200000)) throw new Error('판이 끝나지 않음 R' + act.map((c) => c.g.round).join('/'));
    await tick();
  }
  await sleep(150);
  return { frames, ms: Date.now() - t0 };
}

module.exports = { makeClient, playRoom, sockets, mulberry, sleep, tick, adopt };
