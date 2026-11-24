// T2 협동: 가상 방 2·3·5인. 모든 게임의 라운드가 같이 가고 같은 결과로 끝나는지.
// 유형: Integration · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok, skip } = L;

const CASES = [
  { n: 2, diff: 'hard', seed: 7002 },
  { n: 3, diff: 'easy', seed: 7003 },
  { n: 5, diff: 'nightmare', seed: 7005 },
];
let ran = 0;
CASES.forEach((c) => {
  const r = L.runParty(c), tag = `${c.n}인 ${c.diff}`;
  ok(!r.error, `${tag}: 예외 없음` + (r.error ? ' — ' + r.error : ''));
  if (!r.P) return;
  ran++;
  const gs = r.P.members.map((m) => m.g);
  ok(gs.every((g) => g.party === c.n), `${tag}: 모두 인원을 ${c.n}명으로 봄 (${gs.map((g) => g.party).join(',')})`);
  ok(gs.every((g) => g.over) && !r.capped, `${tag}: 모두 끝남 over=[${gs.map((g) => g.over).join(',')}] ${r.steps}걸음 ${r.ms}ms`);
  // 팀 결과(teamOver)로 비교한다: 라이프가 다해 탈락한 AI는 팀이 이겨도 자기 기록은 패배다(2026-11-24 탈락 규칙, t10)
  ok(new Set(gs.map((g) => g.teamOver || g.over)).size === 1, `${tag}: 모두 같은 팀 결과 [${gs.map((g) => (g.out ? `탈락R${g.out}/` : '') + (g.teamOver || g.over)).join(',')}]`);
  ok(new Set(gs.map((g) => g.round)).size === 1, `${tag}: 끝났을 때 라운드가 같음 [${gs.map((g) => g.round).join(',')}]`);
  ok(r.maxGap <= 1, `${tag}: 도중 라운드 차이 최대 ${r.maxGap} (1 이하)`);
  ok(!r.stalled, `${tag}: 120초 멈춤 없음`);
  const v = L.partyViol(r.P);
  ok(v.length === 0, `${tag}: 불변식` + (v.length ? ' — ' + v.join(' ; ') : ' 통과'));
  ok(gs[0].stats.bosses.length > 0, `${tag}: 보스전을 한 번 이상 함 (${L.bossLog(gs[0])})`);
  if (gs[0].over !== 'win') skip(`${tag}: R${gs[0].round}에서 져서 그 뒤(보스 ${L.bossesMissed(gs[0]).join(',') || '-'})는 확인 못 함`);
});
ok(ran === CASES.length, `협동 ${ran}/${CASES.length}판을 실제로 돌림`);
skip('가상 방은 메시지가 늦거나 빠지지 않는다. 실제 통신의 지연·끊김·재접속(B-02, B-05, B-06, B-08, B-09)은 확인 못 함');
skip('사람이 섞인 방(bot이 아닌 게임), 도중 입장·퇴장(B-03, B-04)은 확인 못 함');
L.done('t2-coop');
