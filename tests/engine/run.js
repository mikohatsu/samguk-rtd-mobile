// 게임 규칙 자동 시험을 차례로 돌린다. 실패가 하나라도 있으면 종료 코드 1.
// 쓰는 법: node tests/engine/run.js [t1 t4 ...]
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const ALL = ['t1-smoke', 't2-coop', 't3-mutators', 't4-save', 't5-host-change', 't6-unlock', 't7-synergy', 't8-lane-attack', 't9-chest-locked', 't10-coop-elim', 't12-kill-hold', 't13-counter', 't14-hitbox', 't15-pattern-gaps', 't16-dash-nodmg', 't17-replay'];
const want = process.argv.slice(2);
const list = want.length ? ALL.filter((n) => want.some((w) => n.startsWith(w))) : ALL;
if (!list.length) { console.log('FAIL 돌릴 시험이 없음: ' + want.join(' ')); process.exit(1); }

const t0 = Date.now(), rows = [];
let bad = false;
for (const name of list) {
  console.log(`\n===== ${name} =====`);
  const s = Date.now();
  const p = spawnSync(process.execPath, [path.join(__dirname, name + '.js')], { encoding: 'utf8', timeout: 170000, maxBuffer: 32 * 1024 * 1024 });
  const out = (p.stdout || '') + (p.stderr ? '\n[stderr]\n' + p.stderr : '');
  process.stdout.write(out.endsWith('\n') ? out : out + '\n');
  const m = /^RESULT \S+ ok=(\d+) fail=(\d+) skip=(\d+)/m.exec(p.stdout || '');
  const row = { name, ok: m ? +m[1] : 0, fail: m ? +m[2] : 0, skip: m ? +m[3] : 0, sec: (Date.now() - s) / 1000, note: '' };
  // 결과 줄 없이 끝난 시험은 통과가 아니다
  if (!m) { row.note = p.error ? '시간 초과·실행 실패: ' + p.error.message : '결과 줄(RESULT) 없이 끝남'; row.fail++; }
  else if (p.status !== 0 && !row.fail) { row.note = '종료 코드 ' + p.status; row.fail++; }
  else if (row.ok === 0) { row.note = '확인한 것이 0개'; row.fail++; }
  if (row.fail) bad = true;
  rows.push(row);
}
const total = (Date.now() - t0) / 1000;
console.log('\n===== 요약 =====');
rows.forEach((r) => console.log(`${r.fail ? 'FAIL' : 'OK  '} ${r.name.padEnd(16)} OK ${String(r.ok).padStart(3)}  FAIL ${String(r.fail).padStart(2)}  SKIP(확인 못 함) ${String(r.skip).padStart(2)}  ${r.sec.toFixed(1)}s ${r.note}`));
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
console.log(`합계: OK ${sum('ok')}, FAIL ${sum('fail')}, SKIP ${sum('skip')}, ${total.toFixed(1)}초` + (total > 180 ? '  (경고: 3분을 넘김)' : ''));
console.log('SKIP은 통과가 아니라 이 시험이 확인하지 못한 것이다. 화면·실제 통신·앱 내리기·광고·성능은 README 참고.');
process.exit(bad ? 1 : 0);
