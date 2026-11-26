// 판 결과 재연산 검증 일꾼(2026-11-26 사용자 결정: 모든 판 전수 검증, 보상은 판 끝에 바로 주고 어긋나면 회수).
//
// 흐름
// 1) 판 보고(/api/history·/api/result)가 오면 app.js가 settle 전에 stash(결과 id, 본문)로 입력 기록과 보고 값을 DATA_DIR/replay/<id>.json에 둔다.
//    settle이 거절하면 drop(id), 받으면 kick()으로 깨운다. 응답은 기다리지 않는다(이용자는 바로 결과를 본다).
// 2) 대기열 = 저장소의 검증 대기 판(store.pendingResults, verify = pending, 오래된 것부터 — A 담당 results 표). 서버를 다시 켜도 이어서 한다.
// 3) 한 판씩 worker_threads(replay-worker.js)에서 재연산한다. 판마다 시간 상한(REPLAY_MAX_MS). 게임 서버 스레드는 소식만 주고받는다.
// 4) 판정:
//    ok    재연산 결과 = 보고(라운드·승패·시간·걸음 수·통계·소환·업적)                → confirmResult
//    bad   씨앗·난이도·악몽 단계·규칙이 표와 다름, 계정이 안 가진 장수를 연 기록, 재연산 결과가 보고와 다름 → revokeResult(REPLAY_MODE=log면 norec로 기록만)
//    norec 기록 없음(예전 앱 표·압축 못 한 기기·기록 넘침), 협동 방 판(다음 단계), 그 엔진 버전이 서버에 없음, 재연산 시간 초과·예외 → noRecResult(보상 유지)
//    예전 표(verify = legacy)는 대기열에 들어오지 않는다(사용자 결정 "기존판은 냅둬").
// 5) 다 본 기록 파일: ok는 지우고, 나머지는 replay/keep/에 14일 둔다(운영자 확인용).
//
// 엔진 버전: 기록의 eh(엔진 묶음 해시, scripts/build-ui.js가 앱에 넣는다)와 같은 엔진으로 돌린다.
//   지금 서버 폴더(ROOT)의 묶음 해시가 같으면 ROOT, 아니면 server/engines/<해시>/(배포 때 scripts/engine-pack.js로 남긴 옛 버전). 없으면 norec('noeng').
//
// 환경 변수: REPLAY_MODE = enforce(기본, 어긋나면 회수) | log(회수하지 않고 norec + 'would_revoke'로 남김) | off(일꾼을 돌리지 않음)
//            REPLAY_MAX_MS(판 하나 상한, 기본 120000), REPLAY_KEEP_DAYS(기본 14), REPLAY_NOREC_BAD=1(새 앱 표인데 기록이 없으면 회수. 기본 끔 — 사용자 결정 필요)
// 쓰는 법(app.js): const REPLAY = require('./replay'); REPLAY.start({ store, dataDir, root, confirm, norec, revoke, lockedIds, unitKey });
//                 REPLAY.stash(id, body) → settle → r.bad ? REPLAY.drop(id) : REPLAY.kick()
// 스레드: 이 파일은 게임 서버 스레드에서 돈다(파일 읽기·쓰기는 동기지만 64KB 이하). 재연산은 작업자 스레드 하나.
'use strict';
const fs = require('fs'), path = require('path');
const { Worker } = require('worker_threads');
const RC = require('./replay-core');

const CFG = {
  mode: process.env.REPLAY_MODE || 'enforce',
  jscMode: process.env.REPLAY_JSC_MODE || 'log', // 애플 엔진 판: 기본 log(2026-11-26 사용자 결정 — 아이폰 실측 전)
  maxMs: Math.max(5000, +process.env.REPLAY_MAX_MS || 120000),
  keepDays: Math.max(1, +process.env.REPLAY_KEEP_DAYS || 14),
  noRecBad: process.env.REPLAY_NOREC_BAD === '1',
  idleMs: 30000, batch: 20,
};
let S = null; // start()가 채운다
const stats = { ok: 0, bad: 0, norec: 0, err: 0, ms: 0, n: 0, last: null };

const safeId = (id) => String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const fileOf = (id) => path.join(S.dir, safeId(id) + '.json');
// 표 몸통 읽기(서명은 settle이 이미 확인했다): { v, s(씨앗), d, m, o(예전 앱), r(방) ... }
function ticketBody(raw) {
  const s = String(raw || ''), i = s.indexOf('.');
  if (i < 1) return null;
  try { return JSON.parse(Buffer.from(s.slice(0, i), 'base64url').toString('utf8')); } catch (e) { return null; }
}

// 보고 본문에서 재연산에 필요한 것만 남겨 둔다(settle 전에 부른다). id = 'tk-<표 번호>'(A의 결과 id와 같다). 돌려주는 값: 새로 쓴 파일의 id(이미 있으면 null)
function idOf(b) { const t = b && ticketBody(b.ticket); return t && typeof t.n === 'string' ? 'tk-' + t.n : null; }
function stash(b) {
  if (!S || CFG.mode === 'off') return null;
  const id = idOf(b);
  if (!id) return null;
  const pick = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  const job = {
    at: Date.now(), ticket: String(b.ticket).slice(0, 600),
    rec: typeof b.rec === 'string' ? b.rec.slice(0, 70000) : null, recj: b.recj && typeof b.recj === 'object' ? b.recj : null,
    report: { round: b.round | 0, win: !!b.win, time: +b.time || 0, st: pick(b.st), myth: pick(b.myth), imm: pick(b.imm), ach: Array.isArray(b.ach) ? b.ach.slice(0, 80).map(String) : [], mode: String(b.mode || '').slice(0, 8) },
  };
  // 같은 표로 두 번 보고하면 처음 것을 둔다(두 번째 보고는 settle이 거절하고, drop은 이번에 쓴 파일만 지운다)
  try { fs.mkdirSync(S.dir, { recursive: true }); if (fs.existsSync(fileOf(id))) return null; fs.writeFileSync(fileOf(id), JSON.stringify(job)); } catch (e) { console.warn('[verify] 기록 저장 실패', id, e.message); return null; }
  return id;
}
function drop(id) { if (!S || !id) return; try { fs.unlinkSync(fileOf(id)); } catch (e) { /* 없음 */ } }

// 엔진 묶음 폴더 찾기(기록의 eh)
function engineDir(eh) {
  if (typeof eh !== 'string' || !/^[0-9a-f]{16}$/.test(eh)) return null;
  try { if (RC.engineHash(S.root) === eh) return S.root; } catch (e) { /* 지금 폴더에 파일이 빠짐 */ }
  const d = path.join(S.engines, eh);
  return RC.BUNDLE_FILES.every((f) => fs.existsSync(path.join(d, f))) ? d : null;
}

// ---- 작업자 스레드 ----
let worker = null, waiting = null;
function spawn() {
  worker = new Worker(path.join(__dirname, 'replay-worker.js'), { resourceLimits: { maxOldGenerationSizeMb: 384 } });
  worker.on('message', (m) => { const w = waiting; waiting = null; if (w) { clearTimeout(w.t); w.resolve(m); } });
  worker.on('error', (e) => { const w = waiting; waiting = null; if (w) { clearTimeout(w.t); w.resolve({ ok: false, err: 'worker:' + e.message }); } worker = null; });
  worker.on('exit', () => { worker = null; const w = waiting; waiting = null; if (w) { clearTimeout(w.t); w.resolve({ ok: false, err: 'worker_exit' }); } });
  if (worker.unref) worker.unref();
}
function runJob(msg) {
  if (!worker) spawn();
  return new Promise((resolve) => {
    const t = setTimeout(() => { waiting = null; try { worker.terminate(); } catch (e) { /* 이미 끝남 */ } worker = null; resolve({ ok: false, err: 'timeout_hard' }); }, CFG.maxMs + 30000);
    waiting = { resolve, t };
    worker.postMessage(msg);
  });
}

// 한 판 판정. 돌려주는 값: { v: 'ok'|'bad'|'norec', note }
async function verdictOf(row) {
  if (row.room) return { v: 'norec', note: 'coop' }; // 협동 방 판: 다음 단계(C)
  let job = null;
  try { job = JSON.parse(fs.readFileSync(fileOf(row.id), 'utf8')); } catch (e) { job = null; }
  if (!job) return { v: 'norec', note: 'nofile' };
  const tk = ticketBody(job.ticket) || {};
  const rec = job.rec ? RC.decodeRec(job.rec) : job.recj && typeof job.recj === 'object' ? job.recj : null;
  row._pf = rec && rec.pf; // 이 판을 돌린 엔진(jsc = 애플). finish가 회수 여부를 정할 때 쓴다
  if (!rec) return { v: CFG.noRecBad && !tk.o ? 'bad' : 'norec', note: tk.o ? 'old_app' : job.rec ? 'rec_unreadable' : 'norec' };
  // 표와 맞는가(씨앗은 서버가 정했다)
  if ((rec.seed >>> 0) !== (tk.s >>> 0)) return { v: 'bad', note: 'seed' };
  if (rec.diff !== tk.d) return { v: 'bad', note: 'diff' };
  if ((rec.mutLv | 0) !== (tk.m | 0)) return { v: 'bad', note: 'mut' };
  // 잠긴 장수: 기록의 열린 목록이 계정이 가진 것 안에 있어야 한다(SEC-009). 판 뒤에 산 장수가 있어도 앞 목록은 그 안에 든다
  if (Array.isArray(rec.unl) && S.lockedIds) {
    const u = await S.store.getUser(row.uid), owned = u && Array.isArray(u.owned) ? u.owned : [];
    const locked = new Set(S.lockedIds());
    const key = S.unitKey || ((id) => id); // 계정 owned에는 상품 열쇠(theme unlock.key)로 들어 있다
    if (rec.unl.some((id) => locked.has(id) && !owned.includes(key(id)))) return { v: 'bad', note: 'unl' };
  }
  const dir = engineDir(rec.eh);
  if (!dir) return { v: 'norec', note: 'noeng:' + String(rec.eh).slice(0, 16) };
  const r = await runJob({ id: row.id, dir, lang: rec.lang, rec, report: job.report, maxMs: CFG.maxMs });
  stats.ms += r.ms || 0; stats.n++;
  if (!r.ok) {
    if (/^(rec_|muts|cmd_order|restore_)/.test(r.err || '')) return { v: 'bad', note: r.err };
    stats.err++;
    return { v: 'norec', note: 'err:' + r.err };
  }
  if (r.diff && r.diff.length) return { v: 'bad', note: 'mismatch:' + r.diff.slice(0, 8).join(',') + ` R${r.res.round}${r.res.win ? 'W' : 'L'}/${job.report.round}${job.report.win ? 'W' : 'L'}` };
  return { v: 'ok', note: `R${r.res.round} ${r.ms}ms` };
}

async function finish(row, d) {
  let v = d.v, note = d.note;
  // 애플 JavaScriptCore(아이폰 등)에서 돌린 판은 실기기 일치를 재기 전까지 회수하지 않고 기록만(REPLAY_JSC_MODE=enforce로 바꾸면 회수). pf가 없으면 v8로 본다.
  const jscLog = CFG.jscMode !== 'enforce' && row._pf === 'jsc';
  if (v === 'bad' && (CFG.mode === 'log' || jscLog)) { v = 'norec'; note = 'would_revoke:' + (jscLog ? 'jsc:' : '') + note; }
  if (v === 'ok') await S.confirm(row.id, note);
  else if (v === 'bad') await S.revoke(row.id, 'replay:' + note);
  else await S.norec(row.id, note);
  stats[v]++; stats.last = { id: row.id, v, note, at: Date.now() };
  if (v !== 'ok') console.log(`[verify] ${v} ${row.id} uid=${row.uid} ${note}`);
  // 기록 파일 정리
  try {
    const f = fileOf(row.id);
    if (fs.existsSync(f)) { if (v === 'ok') fs.unlinkSync(f); else { fs.mkdirSync(path.join(S.dir, 'keep'), { recursive: true }); fs.renameSync(f, path.join(S.dir, 'keep', path.basename(f))); } }
  } catch (e) { /* 정리 실패는 다음 청소에 */ }
}

let busy = false, again = false, timer = null;
async function pump() {
  if (!S || busy) { again = true; return; }
  busy = true;
  try {
    for (;;) {
      again = false;
      const rows = await S.store.pendingResults(CFG.batch);
      if (!rows.length) break;
      for (const row of rows) {
        let d;
        try { d = await verdictOf(row); } catch (e) { d = { v: 'norec', note: 'err:' + String(e && e.message).slice(0, 80) }; }
        try { await finish(row, d); } catch (e) { console.error('[verify] 판정 기록 실패', row.id, e && e.message); return; }
      }
    }
  } catch (e) { console.error('[verify] 대기열 읽기 실패', e && e.message); }
  finally { busy = false; if (again) setImmediate(pump); }
}
function kick() { if (S && CFG.mode !== 'off') setImmediate(pump); }

function cleanup() {
  const keep = path.join(S.dir, 'keep'), old = Date.now() - CFG.keepDays * 86400000;
  for (const d of [S.dir, keep]) {
    let list = []; try { list = fs.readdirSync(d); } catch (e) { continue; }
    list.forEach((f) => { if (!f.endsWith('.json')) return; const p = path.join(d, f); try { if (fs.statSync(p).mtimeMs < old) fs.unlinkSync(p); } catch (e) { /* 지나감 */ } });
  }
}

// opts: { store, dataDir, root(지금 엔진 폴더), engines(옛 엔진 폴더, 기본 server/engines), confirm(id, note), norec(id, note), revoke(id, why), lockedIds(), unitKey(id) }
function start(opts) {
  S = Object.assign({ engines: path.join(__dirname, 'engines') }, opts, { dir: path.join(opts.dataDir, 'replay') });
  if (CFG.mode === 'off') { console.log('[verify] 재연산 검증 꺼짐(REPLAY_MODE=off)'); return; }
  timer = setInterval(pump, CFG.idleMs); if (timer.unref) timer.unref();
  const ct = setInterval(cleanup, 6 * 3600000); if (ct.unref) ct.unref();
  console.log(`[verify] 재연산 검증 켜짐(${CFG.mode}, 판당 ${CFG.maxMs / 1000}초)`);
  kick();
}
function stop() { if (timer) clearInterval(timer); timer = null; if (worker) { try { worker.terminate(); } catch (e) { /* 끝남 */ } } worker = null; S = null; }
// 시험용: 대기열이 빌 때까지 돌린다
async function drain(maxMs) { const end = Date.now() + (maxMs || CFG.maxMs * 2); while (Date.now() < end) { await pump(); if (!busy && !again && !(await S.store.pendingResults(1)).length) return; await new Promise((r) => setTimeout(r, 50)); } }

module.exports = { start, stop, stash, drop, kick, drain, idOf, stats: () => Object.assign({ mode: CFG.mode }, stats), CFG };
