// T1 한 판 연기 시험: 난이도 4종 × 고정 씨앗, AI 1인이 끝까지.
// 유형: Logic · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok, skip, info, T } = L;

const SEED = 20261117;
if (!ok(T.difficulties.length > 0, `난이도 ${T.difficulties.length}종을 찾음`)) { L.done('t1-smoke'); return; }

T.difficulties.forEach((d, i) => {
  const r = L.runSolo({ diff: d.id, seed: SEED + i, build: i });
  const g = r.g, tag = `${d.name}(${d.id}) 1인`;
  ok(!r.error, `${tag}: 예외 없음` + (r.error ? ' — ' + r.error : ''));
  if (!g) return;
  ok(!!g.over && !r.capped, `${tag}: 판이 끝남 over=${g.over} R${g.round}/${d.rounds} 게임 ${Math.round(g.time / 60)}분, ${r.steps}걸음, ${r.ms}ms`);
  ok(!r.stalled, `${tag}: 120초 멈춤 없음`);
  const v = L.violText(r.watch);
  ok(v.length === 0, `${tag}: 불변식 ${r.watch.checks}번 검사` + (v.length ? ' — ' + v.join(' ; ') : ''));
  ok(g.round >= 10 && g.stats.bosses.length > 0, `${tag}: 첫 보스전까지는 감 (보스전 ${L.bossLog(g)})`);
  const miss = L.bossesMissed(g);
  if (g.over !== 'win') skip(`${tag}: AI가 R${g.round}에서 져서 그 뒤 라운드와 보스 ${miss.join(',') || '-'}는 확인 못 함`);
});

// 같은 씨앗이면 같은 판이 나오는가(씨앗 고정이 실제로 되는지)
{
  const a = L.runSolo({ diff: 'nightmare', seed: SEED + 99 }), b = L.runSolo({ diff: 'nightmare', seed: SEED + 99 });
  const sig = (r) => (r.g ? `R${r.g.round} t=${r.g.time.toFixed(2)} gold=${r.g.me.gold} units=${r.g.units.length} kills=${r.g.stats.kills} ${r.g.over}` : 'x');
  ok(!a.error && !b.error && sig(a) === sig(b), `같은 씨앗 두 번 → 같은 결과 (${sig(a)} / ${sig(b)})`);
}

skip('사람 조작 경로(g.manual, c.joy, c.atkHold, g.laneJoy)는 AI가 쓰지 않아 실행되지 않음 (설계 T7, 만들지 않음)');
skip('보스전이 아닐 때의 replaceChamp·selectChamp·useSkill 호출(B-10, 설계 T6)은 만들지 않음');
L.done('t1-smoke');
