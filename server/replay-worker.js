// 재연산 작업자 스레드(worker_threads). 게임 서버(중계·API)를 막지 않도록 판 재연산은 여기서만 돈다.
// 받는 소식: { id, dir(엔진 묶음 폴더), lang, rec(풀린 입력 기록), report(보고 값), maxMs } + 협동 방 판이면 { kind: 'room', logFile(방 중계 기록), uid }
// 보내는 소식: { id, ok, err, res(재연산 결과 요약), diff(보고와 어긋난 칸, 빈 배열 = 일치), ms }
'use strict';
const { parentPort } = require('worker_threads');
const RC = require('./replay-core');

let logCache = null;
parentPort.on('message', (m) => {
  let out;
  try {
    const B = RC.loadBundle(m.dir, m.lang);
    if (m.kind === 'room') {
      // 협동 방 판(C1): 서버 방 기록 파일과 함께 재연산. 같은 판의 다음 기준 판 시도가 같은 파일을 쓰므로 하나만 기억한다
      if (!logCache || logCache.f !== m.logFile) logCache = { f: m.logFile, L: RC.loadRoomLog(m.logFile) };
      const r = RC.replayRoom(B, m.rec, logCache.L, { maxMs: m.maxMs, uid: m.uid });
      out = { id: m.id, ok: r.ok, err: r.err || null, res: r.res || null, diff: r.ok ? RC.compare(r.res, m.report, m.rec).concat(r.out.map((x) => 'out.' + x)) : null, ms: r.ms };
    } else {
      const r = RC.replay(B, m.rec, { maxMs: m.maxMs });
      out = { id: m.id, ok: r.ok, err: r.err || null, res: r.res || null, diff: r.ok ? RC.compare(r.res, m.report, m.rec) : null, ms: r.ms };
    }
  } catch (e) {
    out = { id: m.id, ok: false, err: 'worker:' + String(e && e.message).slice(0, 120), res: null, diff: null, ms: 0 };
  }
  parentPort.postMessage(out);
});
