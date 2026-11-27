// 협동 방 중계 기록(2026-11-28, 협동 판 재연산 검증 C1).
//
// 왜: 협동 판에서 한 기기의 판 = 자기 조작 + 받은 소식(방장의 단계·시계·보스, 동료의 피해·지원·자리 상태)이다.
//     서버가 중계한 소식을 그대로 남겨 두면, 기기는 "몇 번째 소식까지 적용했는지(일련번호 q)"만 기록하면 되고,
//     서버 재연산(replay-core replayRoom)이 같은 소식을 같은 걸음에 넣어 그 판을 다시 만든다.
//
// 일련번호(q): 방마다 1부터. 엔진 상태에 영향을 주는 중계에만 붙는다(관련 없는 것은 q 없이 그대로 중계 — 기록 크기를 줄인다):
//   - pres(자리 상태)의 PRES_KEYS 열쇠(net.js가 판 계산에 읽는 것), msg의 MSG_TOPICS(net.js 받기 핸들러가 판을 바꾸는 것),
//     left(자리 비움 끝), hello(들어옴·다시 붙음 표시).
//   - chat·emo·pop·vol·go, 위치 외 상태(hb·ln·sp·watch·ready ...)는 판 계산에 쓰이지 않아 q가 없다.
// 기록 한 줄: [q, 'p', 자리, {열쇠만 거른 상태}] | [q, 'm', 자리, 종류, 내용] | [q, 'l', 자리] | [q, 'h', 자리, 계정 id]
//
// 보관: 평소(판 밖)에는 방마다 마지막 RING개만 두고 그보다 오래된 것은 '바탕 상태'(rb)에 접어 넣는다.
//       방장의 시작 신호(start)가 오면 바탕 + 남은 줄을 붙잡고(pin) 그 판이 끝날 때까지 모두 모은다.
//       끝(방장 over 뒤 FIN_AFTER_OVER_MS, 다음 start, 방이 빔, IDLE_MS 동안 소식 없음, MAX_AGE_MS)에 gzip 파일
//       <dir>/<방 코드>-<시작 시각>.json.gz 로 쓰고(임시 이름 → 바꾸기) 메모리에서 뺀다.
// 상한: 판 하나 GAME_BYTES·GAME_EVENTS, 전체 TOTAL_BYTES. 넘으면 그 판은 더 모으지 않고 capped로 표시(재연산은 norec).
// 스레드: 게임 서버 스레드(중계마다 부른다). 일은 JSON 한 줄 만들기와 배열 넣기뿐이고, 파일 쓰기는 비동기다.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const PRES_KEYS = ['name', 'away', 'out', 'picked', 'deployed', 'rd', 'sy', 'vol', 'cx', 'cy', 'ch', 'hpf', 'sv'];
const MSG_TOPICS = new Set(['start', 'phase', 'clk', 'hz', 'pattern', 'bs', 'dmg', 'sup', 'wiped']);
const CFG = {
  ring: 512,
  gameBytes: 32 * 1024 * 1024, gameEvents: 600000, totalBytes: 160 * 1024 * 1024,
  finAfterOverMs: 15000, idleMs: 10 * 60000, maxAgeMs: 6 * 3600000,
};
let DIR = null, total = 0;
const live = new Set(); // 붙잡은(pin) 방 기록
const writes = new Set(); // 쓰는 중인 파일(시험이 기다린다)
const stats = { pinned: 0, written: 0, capped: 0, writeErr: 0, restarts: 0 };

function config(o) { DIR = o && o.dir ? o.dir : DIR; Object.assign(CFG, (o && o.cfg) || {}); }
const headOf = (f) => f.replace(/\.json\.gz$/, '.head.json');
const fileOf = (code, startAt) => (DIR ? path.join(DIR, String(code).replace(/[^a-z0-9]/g, '').slice(0, 12) + '-' + (Number(startAt) || 0) + '.json.gz') : null);

function rlOf(room) {
  if (!room.rl) room.rl = { q: 0, cur: {}, rb: {}, rbQ: 0, ring: [], pin: null };
  return room.rl;
}
const seq = (room) => rlOf(room).q;
function fold(st, e) {
  const pid = e[2];
  if (e[1] === 'p') { const s = st[pid] || (st[pid] = { u: null, s: {} }); Object.assign(s.s, e[3]); }
  else if (e[1] === 'h') { const s = st[pid] || (st[pid] = { u: null, s: {} }); s.u = e[3]; }
  else if (e[1] === 'l') delete st[pid];
}
const clone = (o) => JSON.parse(JSON.stringify(o));

function add(room, code, e) {
  const R = rlOf(room);
  e[0] = ++R.q;
  fold(R.cur, e);
  const P = R.pin;
  if (P) {
    P.last = Date.now();
    if (e[1] === 'm' && e[3] === 'clk') P.host = e[2];
    if (e[1] === 'h') P.seats[e[2]] = e[3];
    if (e[1] === 'p' && e[3].out && !P.outs[e[2]]) P.outs[e[2]] = e[3].out | 0; // 판 시작 뒤 처음 알린 탈락 라운드(손님 보고 맞추기)
    if (!P.capped) {
      const s = JSON.stringify(e);
      if (P.bytes + s.length > CFG.gameBytes || P.ev.length >= CFG.gameEvents || total + s.length > CFG.totalBytes) { P.capped = true; stats.capped++; }
      else { P.ev.push(s); P.bytes += s.length; total += s.length; }
    }
  } else {
    R.ring.push(e);
    while (R.ring.length > CFG.ring) { const o = R.ring.shift(); fold(R.rb, o); R.rbQ = o[0]; }
  }
  return e[0];
}

// 자리 상태 중계(p는 서버가 이미 거른 값). 관련 열쇠가 없으면 0(q 없이 중계)
function pres(room, code, pid, p) {
  if (!p || typeof p !== 'object') return 0;
  let o = null;
  for (const k of PRES_KEYS) if (Object.prototype.hasOwnProperty.call(p, k) && p[k] !== undefined) { (o = o || {})[k] = p[k]; }
  return o ? add(room, code, [0, 'p', pid, o]) : 0;
}
function msg(room, code, pid, t, d) { return MSG_TOPICS.has(t) ? add(room, code, [0, 'm', pid, t, d === undefined ? null : d]) : 0; }
function left(room, code, pid) { return add(room, code, [0, 'l', pid]); }
function hello(room, code, pid, uid) { return add(room, code, [0, 'h', pid, String(uid || '')]); }

// 방장의 시작 신호: 앞 판 기록을 끝내고 새 판 기록을 붙잡는다(시작 신호 줄은 이 뒤에 msg로 들어온다)
// info(2026-11-28 방 판 씨앗, app.js noteStart): { ss(서버가 준 씨앗, 0 = 방장이 고른 씨앗), by(시작을 보낸 자리), uid(그 계정), n(이 방의 몇 번째 시작), hs(그 계정의 최근 1시간 시작 수), mutLv, muts }
//   → 머리에 v: 2와 함께 남는다. ab: 1 = 앞 판이 끝나기(over) 전에 다시 시작했다(버린 판)
function start(room, code, startAt, info) {
  const R = rlOf(room);
  const ab = R.pin && !R.pin.overAt ? 1 : 0;
  if (R.pin) finalize(room, 'restart');
  const I = info || {};
  R.pin = { code, startAt, at: Date.now(), last: Date.now(), base: clone(R.rb), baseQ: R.rbQ, ev: [], bytes: 0, overAt: 0, host: null, capped: false, startQ: R.q + 1, seats: {}, outs: {},
    sd: info ? { ss: I.ss >>> 0, by: I.by || null, byUid: I.uid != null ? String(I.uid) : null, n: I.n | 0, hs: I.hs | 0, ab, mutLv: I.mutLv | 0, muts: Array.isArray(I.muts) ? I.muts.slice(0, 20) : [] } : null };
  if (ab) stats.restarts++;
  Object.keys(R.cur).forEach((pid) => { if (R.cur[pid].u) R.pin.seats[pid] = R.cur[pid].u; });
  for (const e of R.ring) { const s = JSON.stringify(e); R.pin.ev.push(s); R.pin.bytes += s.length; total += s.length; }
  R.ring = [];
  R.pin.room = room;
  live.add(R.pin); stats.pinned++;
}
// 서버가 보는 방장이 판 끝(over)을 알렸다: 늦게 오는 소식을 조금 더 받은 뒤 끝낸다
function over(room) { const P = room.rl && room.rl.pin; if (P && !P.overAt) P.overAt = Date.now(); }

function finalize(room, why) {
  const R = room.rl, P = R && R.pin;
  if (!P) return null;
  R.pin = null; live.delete(P);
  total -= P.bytes;
  // 판 밖 모드로 돌아간다: 바탕 = 지금 상태
  R.rb = clone(R.cur); R.rbQ = R.q; R.ring = [];
  const f = fileOf(P.code, P.startAt);
  if (!f) return null;
  const head = Object.assign({ v: P.sd ? 2 : 1, code: P.code, startAt: P.startAt, startQ: P.startQ, baseQ: P.baseQ, endQ: R.q, host: P.host, fin: why, capped: P.capped, at: P.at, end: Date.now() }, P.sd || {});
  const json = JSON.stringify(head).slice(0, -1) + ',"base":' + JSON.stringify(P.base) + ',"ev":[' + P.ev.join(',') + ']}';
  P.ev = null;
  const w = new Promise((resolve) => {
    zlib.gzip(Buffer.from(json), (err, gz) => {
      if (err) { stats.writeErr++; console.warn('[roomlog] 압축 실패', P.code, err.message); return resolve(); }
      try { fs.mkdirSync(DIR, { recursive: true }); } catch (e) { stats.writeErr++; console.warn('[roomlog] 폴더 실패', e.message); return resolve(); }
      const tmp = f + '.tmp';
      fs.writeFile(tmp, gz, (e2) => {
        if (e2) { stats.writeErr++; console.warn('[roomlog] 쓰기 실패', P.code, e2.message); return resolve(); }
        fs.rename(tmp, f, (e3) => {
          if (e3) { stats.writeErr++; console.warn('[roomlog] 이름 바꾸기 실패', P.code, e3.message); return resolve(); }
          // 머리 파일(작다): 판정이 큰 기록을 읽지 않고 기준 판(방장)·자리·탈락을 본다. 이 파일이 있으면 기록이 다 쓰였다는 뜻
          const hd = Object.assign({}, head, { hostUid: P.host ? P.seats[P.host] || null : null, seats: P.seats, outs: P.outs });
          fs.writeFile(headOf(f), JSON.stringify(hd), (e4) => { if (e4) stats.writeErr++; else stats.written++; resolve(); });
        });
      });
    });
  });
  writes.add(w); w.then(() => writes.delete(w));
  return f;
}
// 방이 비었다(모두 나감)
function closeRoom(room) { if (room.rl && room.rl.pin) finalize(room, 'empty'); }

function sweep() {
  const now = Date.now();
  for (const P of [...live]) {
    const why = P.overAt && now - P.overAt > CFG.finAfterOverMs ? 'over' : now - P.last > CFG.idleMs ? 'idle' : now - P.at > CFG.maxAgeMs ? 'age' : null;
    if (why) finalize(P.room, why);
  }
}
const timer = setInterval(sweep, 2000); if (timer.unref) timer.unref();

// 시험용: 붙잡은 기록을 모두 지금 끝낸다
function flushAll(why) { for (const P of [...live]) finalize(P.room, why || 'flush'); return Promise.all([...writes]); }
const settled = () => Promise.all([...writes]);

module.exports = { headOf, PRES_KEYS, MSG_TOPICS, CFG, config, fileOf, seq, pres, msg, left, hello, start, over, finalize, closeRoom, sweep, flushAll, settled, fold, stats: () => Object.assign({ live: live.size, bytes: total }, stats) };
