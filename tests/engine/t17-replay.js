// T17 입력 기록·재연산(2026-11-26 사용자 결정: 모든 판 결과를 서버가 같은 씨앗 + 입력 기록으로 다시 돌려 검증).
// 유형: Integration · 게이트: BLOCKING
// 보는 것(시나리오 → 기대):
//  1) 같은 씨앗·같은 명령으로 두 번 → 걸음마다 상태 지문이 같다(결정성)
//  2) 기기 쪽(엔진 묶음 A, 일본어)이 g.input으로만 판을 하고 기록 → 서버 쪽(새 묶음 B)이 재연산 → 결과 요약이 보고와 일치
//  3) 이어하기: 판 중간에 snapshot → JSON → restore(기록에 'R') → 끝까지 → 재연산 일치. 저장·복원한 판과 끊김 없는 판의 지문이 복원 직후 같은 걸음에서 같다(난수 상태 보존)
//  4) AI 동맹(가상 방, 동맹 2) 판도 재연산 일치
//  5) 조작: 보고 라운드·승패·처치 수를 바꾸면 불일치, 기록에서 명령 하나를 빼면 불일치, 악몽 규칙을 바꿔 적으면 거절
// 시간 상한: 판마다 maxSteps. 재연산 시간은 info로 적는다.
'use strict';
const path = require('path');
const L = require('./lib');
const RC = require(path.join(__dirname, '..', '..', 'server', 'replay-core.js'));
const { Driver } = require('./driver');
const ROOT = process.env.RTD_ROOT ? path.resolve(process.env.RTD_ROOT) : path.join(__dirname, '..', '..');
const { ok, info, done } = L;

const EH = RC.engineHash(ROOT);
// 기기 쪽 판 한 판: 묶음 A에서 Driver가 input으로만 조작. restoreAt = 이 걸음 근처(라인 단계)에서 이어하기 한 번
function playClient(opt) {
  const A = RC.loadBundle(ROOT, opt.lang || 'ja');
  const muts = opt.diff === 'nightmare' ? A.E.Game.rollMuts(A.T, opt.mutLv | 0, opt.seed) : [];
  const head = { v: 1, eh: EH, lang: A.lang, seed: opt.seed, diff: opt.diff, mutLv: opt.mutLv | 0, muts, unl: null, ai: opt.ai | 0, b: opt.ai ? opt.builds : undefined };
  const w = RC.buildWorld(A, head);
  w.g.rec = new A.E.Recorder(head);
  const drv = new Driver(opt.seed * 7 + 1), digests = [];
  let restored = 0;
  while (!w.g.over && w.g.stepN < opt.maxSteps) {
    if (opt.restoreAt && !restored && w.g.stepN >= opt.restoreAt && w.g.phase === 'wave') {
      const s = w.g.snapshot(), rec = w.g.rec.dump(w.g.stepN);
      const before = RC.digest(w.g);
      const g2 = A.E.Game.restore(A.T, JSON.parse(JSON.stringify(s)));
      g2.rec = A.E.Recorder.from(rec); g2.rec.mark(g2.stepN);
      g2.input('ks', [1]); // 앱 begin이 이어하기 때 하는 것
      w.g = g2; restored = { at: g2.stepN, before, after: RC.digest(g2), randS: s.rs === g2.rand.s };
    }
    const h = w.g.stepDt();
    RC.stepWorld(w);
    drv.update(w.g, h);
    if (opt.trace && w.g.stepN % 600 === 0) digests.push(RC.digest(w.g));
  }
  const g = w.g, sum = RC.summarize(g);
  const report = { round: sum.round, win: sum.win, time: sum.time, st: sum.st, myth: sum.myth, imm: sum.imm, ach: sum.ach };
  return { g, rec: g.rec.dump(g.stepN), report, sum, digests, restored };
}

function check(label, c, maxMs) {
  const B = RC.loadBundle(ROOT, c.rec.lang);
  const t0 = Date.now(), r = RC.replay(B, c.rec, { maxMs: maxMs || 150000 });
  const ms = Date.now() - t0;
  ok(r.ok, `${label}: 재연산 완료(${r.ok ? '' : r.err})`);
  if (!r.ok) return null;
  const diff = RC.compare(r.res, c.report, c.rec);
  ok(diff.length === 0, `${label}: 재연산 결과 = 보고(${diff.join(',') || '일치'}) R${r.res.round} ${r.res.over} 걸음 ${r.res.steps} 명령 ${c.rec.c.length}`);
  const raw = JSON.stringify(c.rec).length, gz = RC.encodeRec(c.rec).length;
  info(`${label}: 재연산 ${ms}ms, 기록 JSON ${(raw / 1024).toFixed(1)}KB → gzip+base64 ${(gz / 1024).toFixed(1)}KB`);
  return { r, ms, gz };
}

// 1) 결정성: 같은 씨앗 두 번
{
  const a = playClient({ seed: 4242, diff: 'easy', maxSteps: 30000, trace: true });
  const b = playClient({ seed: 4242, diff: 'easy', maxSteps: 30000, trace: true });
  ok(a.digests.length > 10 && a.digests.join() === b.digests.join(), `같은 씨앗·같은 조작 두 번 → 600걸음마다 상태 지문 ${a.digests.length}개 모두 같음`);
  ok(JSON.stringify(a.rec) === JSON.stringify(b.rec), '두 번의 입력 기록이 같음');
}
// 2) 혼자 쉬움 끝까지 + 재연산
const solo = playClient({ seed: 12345, diff: 'easy', maxSteps: 400000 });
ok(!!solo.g.over, `혼자 쉬움 판이 끝남(${solo.g.over} R${solo.g.round})`);
const cs = check('혼자 쉬움', solo);
// 5) 조작 시험(같은 판으로)
if (cs) {
  const B = RC.loadBundle(ROOT, solo.rec.lang), res = cs.r.res;
  const tam = (k, f) => { const rp = JSON.parse(JSON.stringify(solo.report)); f(rp); return RC.compare(res, rp, solo.rec); };
  ok(tam('round', (x) => { x.round += 1; }).includes('round'), '조작: 보고 라운드 +1 → 불일치(round)');
  ok(tam('win', (x) => { x.win = !x.win; }).includes('win'), '조작: 승패 뒤집기 → 불일치(win)');
  ok(tam('kills', (x) => { x.st.kills += 50; }).includes('st.kills'), '조작: 처치 수 +50 → 불일치(st.kills)');
  ok(tam('ach', (x) => { x.ach = x.ach.concat(['zz_fake']); }).includes('ach'), '조작: 업적 하나 끼워 넣기 → 불일치(ach)');
  // 기록에서 합성 명령 하나를 빼면 판이 달라진다
  const rec2 = JSON.parse(JSON.stringify(solo.rec)), i = rec2.c.findIndex((x) => x[1] === 'cb' || x[1] === 'cr' || x[1] === 'up');
  if (i >= 0) { const d = rec2.c[i][0]; rec2.c.splice(i, 1); if (rec2.c[i]) rec2.c[i][0] += d; }
  const r2 = RC.replay(B, rec2, { maxMs: 150000 });
  ok(i >= 0 && (!r2.ok || RC.compare(r2.res, solo.report, rec2).length > 0), `조작: 기록에서 명령 하나(${i >= 0 ? solo.rec.c[i][1] : '-'}) 빼기 → 불일치`);
  const rec3 = JSON.parse(JSON.stringify(solo.rec)); rec3.seed += 1;
  const r3 = RC.replay(B, rec3, { maxMs: 150000 });
  ok(!r3.ok || RC.compare(r3.res, solo.report, rec3).length > 0, '조작: 씨앗을 바꿔 재연산 → 불일치');
}
// 3) 이어하기 한 번 + 같은 걸음의 끊김 없는 판과 비교
{
  const c = playClient({ seed: 777, diff: 'easy', maxSteps: 400000, restoreAt: 9000 });
  ok(!!c.restored && c.restored.randS, `이어하기 저장본에 난수 상태가 들어가 복원됨(걸음 ${c.restored && c.restored.at})`);
  ok(c.rec.c.some((x) => x[1] === 'R'), "기록에 이어하기 표시('R')가 있음");
  check('혼자 쉬움 + 이어하기', c);
}
// 4) AI 동맹 2 + 악몽 규칙 검사
{
  const c = playClient({ seed: 99, diff: 'easy', ai: 2, builds: [0, 4], maxSteps: 200000 });
  check('AI 동맹 2(쉬움)', c);
  const n = playClient({ seed: 31337, diff: 'nightmare', mutLv: 2, maxSteps: 60000 });
  ok(n.rec.muts.length === 2, `악몽 +2 규칙은 씨앗으로 정해짐(${n.rec.muts.join(',')})`);
  const B = RC.loadBundle(ROOT, 'ja'), bad = JSON.parse(JSON.stringify(n.rec));
  bad.muts = B.T.mutators.map((m) => m.id).filter((id) => !n.rec.muts.includes(id)).slice(0, 2);
  const r = RC.replay(B, bad);
  ok(!r.ok && r.err === 'muts', `조작: 악몽 규칙을 골라 적으면 재연산 거절(${r.err})`);
}
done('t17-replay');
