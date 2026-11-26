// 재연산 작업자 스레드(worker_threads). 게임 서버(중계·API)를 막지 않도록 판 재연산은 여기서만 돈다.
// 받는 소식: { id, dir(엔진 묶음 폴더), lang, rec(풀린 입력 기록), report(보고 값), maxMs }
// 보내는 소식: { id, ok, err, res(재연산 결과 요약), diff(보고와 어긋난 칸, 빈 배열 = 일치), ms }
'use strict';
const { parentPort } = require('worker_threads');
const RC = require('./replay-core');

parentPort.on('message', (m) => {
  let out;
  try {
    const B = RC.loadBundle(m.dir, m.lang);
    const r = RC.replay(B, m.rec, { maxMs: m.maxMs });
    out = { id: m.id, ok: r.ok, err: r.err || null, res: r.res || null, diff: r.ok ? RC.compare(r.res, m.report, m.rec) : null, ms: r.ms };
  } catch (e) {
    out = { id: m.id, ok: false, err: 'worker:' + String(e && e.message).slice(0, 120), res: null, diff: null, ms: 0 };
  }
  parentPort.postMessage(out);
});
