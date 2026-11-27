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
//    norec 기록 없음(예전 앱 표·압축 못 한 기기·기록 넘침), 그 엔진 버전이 서버에 없음, 재연산 시간 초과·예외 → noRecResult(보상 유지)
//    협동 방 판은 아래 coopVerdict(2026-11-28 C1: 기준 판 하나 재연산 + 나머지 보고는 팀 결과 맞추기)
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
  roomKeepDays: Math.max(1, +process.env.REPLAY_ROOM_KEEP_DAYS || 3),
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
    rec: typeof b.rec === 'string' ? b.rec.slice(0, 70000) : null, recj: b.recj && typeof b.recj === 'object' ? b.recj : null, recLater: b.recLater === 1 || b.recLater === true,
    report: { round: b.round | 0, win: !!b.win, time: +b.time || 0, st: pick(b.st), myth: pick(b.myth), imm: pick(b.imm), ach: Array.isArray(b.ach) ? b.ach.slice(0, 80).map(String) : [], mode: String(b.mode || '').slice(0, 8) },
  };
  // 같은 표로 두 번 보고하면 처음 것을 둔다(두 번째 보고는 settle이 거절하고, drop은 이번에 쓴 파일만 지운다)
  try { fs.mkdirSync(S.dir, { recursive: true }); if (fs.existsSync(fileOf(id))) return null; fs.writeFileSync(fileOf(id), JSON.stringify(job)); } catch (e) { console.warn('[verify] 기록 저장 실패', id, e.message); return null; }
  partyNote(b, id); // 협동 방 판: 같은 판 보고 목록(기준 판 고르기)
  return id;
}
// 협동 방 판의 따로 온 큰 기록(/api/result/rec): 그 결과의 대기 파일에 기록이 아직 없을 때만 붙인다
const COOP_REC_BODY = 600 * 1024, COOP_REC_MAX = 560000;
function attachRec(id, b64) {
  if (!S || !id || typeof b64 !== 'string' || b64.length > COOP_REC_MAX) return false;
  try {
    const f = fileOf(id), job = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (job.rec || job.recj || !job.recLater) return false;
    job.rec = b64; fs.writeFileSync(f, JSON.stringify(job)); deferred.delete(id); kick();
    return true;
  } catch (e) { return false; }
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

// ---- 협동 방 판(2026-11-28 C1, production/team/2026-11-28/coop-replay.md) ----
// 판 하나(파티 = 표의 방 코드 r + 방장 판 시작 시각 g)마다 기준 판(anchor) 하나를 재연산한다:
//   기준 판 = 서버가 본 마지막 방장(방 기록에서 마지막으로 시계 clk를 보낸 자리)의 보고. 그 보고가 COOP.anchorWaitMs 안에 오지 않거나
//            재연산이 어긋나면(그 보고는 bad) 다른 보고(입력 기록이 있는 것)로 대신한다. 최대 COOP.maxAnchors번.
//   기준 판 재연산이 맞으면(결과 = 보고, 내보낸 소식 = 방 기록) 그 보고는 ok, 팀 결과(승패·끝 라운드·뺀 자리·보스 수)를 파티 파일에 둔다.
//   나머지 보고(손님)는 팀 결과와 맞춰 본다(guestCheck: 승패·라운드, 탈락 라운드, 빠진 자리의 승리, 보스 수 상한) → ok | bad.
// 기다림: 방 기록 파일이 아직 없으면(판이 아직 안 끝남·서버가 기록을 닫기 전) 다시 본다. 보고 뒤 COOP.logWaitMs가 지나도 없으면 norec(coop_nolog).
// norec(보상 유지): 입력 기록 없음(예전 앱 coop_norec), 표에 방 판 열쇠 없음(coop_nokey), 방 기록 없음·넘침(coop_nolog·log_capped),
//                   기준 판을 끝내 못 정함(coop_noanchor), 그 엔진 버전 없음(noeng), 재연산 시간 초과·예외(err:).
const COOP = {
  logWaitMs: Math.max(60000, +process.env.REPLAY_COOP_LOG_WAIT_MS || 30 * 60000),
  anchorWaitMs: Math.max(0, +process.env.REPLAY_COOP_ANCHOR_WAIT_MS || 3 * 60000),
  retryMs: 15000, maxAnchors: 3,
};
const deferred = new Map(); // 결과 id → 다시 볼 시각(기다리는 판)
const roomKey = (tk) => (tk && typeof tk.r === 'string' && Number(tk.g) > 0 ? tk.r.replace(/[^a-z0-9]/g, '').slice(0, 12) + '-' + Number(tk.g) : null);
const roomLogOf = (key) => path.join(S.dir, 'rooms', key + '.json.gz');
const roomHeadOf = (key) => path.join(S.dir, 'rooms', key + '.head.json');
const partyFile = (key) => path.join(S.dir, 'party', key + '.json');
function partyLoad(key) { try { return JSON.parse(fs.readFileSync(partyFile(key), 'utf8')); } catch (e) { return { members: {}, tried: [], anchor: null }; } }
function partySave(key, P) { try { fs.mkdirSync(path.dirname(partyFile(key)), { recursive: true }); fs.writeFileSync(partyFile(key), JSON.stringify(P)); } catch (e) { console.warn('[verify] 파티 파일 실패', key, e.message); } }
// stash 때(동기) 파티에 보고를 적는다: 계정 → 결과 id
function partyNote(b, id) {
  const key = roomKey(ticketBody(b.ticket));
  if (!key) return;
  const P = partyLoad(key), t = ticketBody(b.ticket);
  if (!P.members[t.u]) { P.members[t.u] = id; partySave(key, P); }
}
const waitV = (why) => ({ v: 'wait', note: why });
const ANCHOR_BAD = /^(rec_|start_mismatch|seat|dr0|q0|m_hello|j_order|cmd_order|restore_room)/;

async function coopVerdict(row, job, tk, rec) {
  if (!rec && job.recLater && Date.now() - (job.at || 0) < COOP.logWaitMs) return waitV('rec_later'); // 큰 기록이 따로 오는 중
  if (!rec) return { v: 'norec', note: tk.o ? 'old_app' : job.rec ? 'rec_unreadable' : job.recLater ? 'coop_rec_missing' : 'coop_norec' };
  if (!rec.room) return { v: 'norec', note: 'coop_norec' };
  const key = roomKey(tk);
  if (!key) return { v: 'norec', note: 'coop_nokey' };
  let head = null; try { head = JSON.parse(fs.readFileSync(roomHeadOf(key), 'utf8')); } catch (e) { head = null; }
  if (!head) return Date.now() - (job.at || 0) > COOP.logWaitMs ? { v: 'norec', note: 'coop_nolog' } : waitV('log');
  if (head.capped) return { v: 'norec', note: 'coop_log_capped' };
  const P = partyLoad(key);
  P.members = P.members || {}; P.tried = P.tried || [];
  if (P.anchor) return guestVerdict(row, job, head, P.anchor);
  if (P.tried.includes(row.id)) return { v: 'norec', note: 'coop_tried' };
  if (P.tried.length >= COOP.maxAnchors) return { v: 'norec', note: 'coop_noanchor' };
  // 기준 판 고르기: 서버가 본 마지막 방장의 보고를 먼저. 그 보고가 아직 없으면(또는 대기 중) 조금 기다린다
  const hostRid = head.hostUid ? P.members[head.hostUid] : null, mine = head.hostUid && row.uid === head.hostUid;
  if (!mine && hostRid && !P.tried.includes(hostRid)) {
    const h = await S.store.result(hostRid).catch(() => null);
    if (h && h.verify === 'pending' && Date.now() - (head.end || 0) < COOP.anchorWaitMs * 4) return waitV('anchor_host');
  } else if (!mine && !hostRid && Date.now() - (head.end || 0) < COOP.anchorWaitMs) return waitV('anchor_wait');
  // 이 보고를 기준 판으로 재연산
  const dir = engineDir(rec.eh);
  P.tried.push(row.id); partySave(key, P);
  if (!dir) return { v: 'norec', note: 'noeng:' + String(rec.eh).slice(0, 16) };
  const r = await runJob({ id: row.id, kind: 'room', dir, lang: rec.lang, rec, report: job.report, logFile: roomLogOf(key), uid: row.uid, maxMs: CFG.maxMs });
  stats.ms += r.ms || 0; stats.n++;
  if (!r.ok) {
    if (ANCHOR_BAD.test(r.err || '')) return { v: 'bad', note: 'coop:' + r.err };
    stats.err++;
    return { v: 'norec', note: 'err:' + r.err };
  }
  if (r.diff && r.diff.length) return { v: 'bad', note: 'coop_mismatch:' + r.diff.slice(0, 8).join(',') + ` R${r.res.round}${r.res.win ? 'W' : 'L'}/${job.report.round}${job.report.win ? 'W' : 'L'}` };
  // 맞음: 팀 결과를 파티에 둔다(같은 판의 다른 보고가 쓴다). 애플 엔진 판은 기준으로 쓰지 않는다(실측 전, 일치해도 같은 규칙으로 맞추되 기준은 v8 판이 낫다 — 여기서는 일치했으므로 그대로 쓴다)
  const P2 = partyLoad(key);
  P2.members = Object.assign({}, P.members, P2.members); P2.tried = [...new Set([...(P2.tried || []), ...P.tried])];
  P2.anchor = { id: row.id, uid: row.uid, team: r.res.team, at: Date.now() };
  partySave(key, P2);
  return { v: 'ok', note: `coop_anchor R${r.res.round} team ${r.res.team.team}/R${r.res.team.round} ${r.ms}ms` };
}
function guestVerdict(row, job, head, A) {
  if (row.id === A.id) return { v: 'ok', note: 'coop_anchor' };
  let seat = null; Object.keys(head.seats || {}).forEach((pid) => { if (head.seats[pid] === row.uid) seat = pid; });
  if (!seat) return { v: 'norec', note: 'coop_noseat' };
  const d = RC.guestCheck(A.team, job.report, seat, (head.outs || {})[seat] | 0);
  if (d.length) return { v: 'bad', note: `coop_team:${d.join(',')} R${job.report.round}${job.report.win ? 'W' : 'L'}/team ${A.team.team} R${A.team.round}` };
  return { v: 'ok', note: `coop_team R${job.report.round} ${A.team.team}/R${A.team.round}` };
}

async function verdictOf(row) {
  let job = null;
  try { job = JSON.parse(fs.readFileSync(fileOf(row.id), 'utf8')); } catch (e) { job = null; }
  if (!job) return { v: 'norec', note: row.room ? 'coop_nofile' : 'nofile' };
  const tk = ticketBody(job.ticket) || {};
  const rec = job.rec ? RC.decodeRec(job.rec, COOP_REC_MAX) : job.recj && typeof job.recj === 'object' ? job.recj : null;
  row._pf = rec && rec.pf; // 이 판을 돌린 엔진(jsc = 애플). finish가 회수 여부를 정할 때 쓴다
  if (row.room) return coopVerdict(row, job, tk, rec); // 협동 방 판(C1)
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
      // 기다리는 협동 판(deferred)은 건너뛴다. 한 묶음이 모두 기다리는 판이면 다음 깨움까지 쉰다
      const now = Date.now(), all = await S.store.pendingResults(CFG.batch + deferred.size);
      const rows = all.filter((x) => !(deferred.get(x.id) > now)).slice(0, CFG.batch);
      if (!rows.length) break;
      for (const row of rows) {
        let d;
        try { d = await verdictOf(row); } catch (e) { d = { v: 'norec', note: 'err:' + String(e && e.message).slice(0, 80) }; }
        if (d.v === 'wait') { deferred.set(row.id, Date.now() + COOP.retryMs); continue; }
        deferred.delete(row.id);
        try { await finish(row, d); } catch (e) { console.error('[verify] 판정 기록 실패', row.id, e && e.message); return; }
      }
    }
  } catch (e) { console.error('[verify] 대기열 읽기 실패', e && e.message); }
  finally { busy = false; if (again) setImmediate(pump); }
}
function kick() { if (S && CFG.mode !== 'off') setImmediate(pump); }

function cleanup() {
  const keep = path.join(S.dir, 'keep'), old = Date.now() - CFG.keepDays * 86400000, oldRoom = Date.now() - CFG.roomKeepDays * 86400000;
  for (const d of [S.dir, keep, path.join(S.dir, 'party'), path.join(S.dir, 'rooms')]) {
    const lim = d.endsWith('rooms') ? oldRoom : old; // 방 중계 기록(판당 수백 KB~수 MB)은 짧게
    let list = []; try { list = fs.readdirSync(d); } catch (e) { continue; }
    list.forEach((f) => { if (!/\.json(\.gz|\.tmp)?$/.test(f) && !f.endsWith('.gz.tmp')) return; const p = path.join(d, f); try { if (fs.statSync(p).mtimeMs < lim) fs.unlinkSync(p); } catch (e) { /* 지나감 */ } });
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
// 시험용: 기다리는 판을 바로 다시 보게 한다
function retryNow() { deferred.clear(); }

module.exports = { COOP, COOP_REC_BODY, attachRec, retryNow, start, stop, stash, drop, kick, drain, idOf, stats: () => Object.assign({ mode: CFG.mode }, stats), CFG };
