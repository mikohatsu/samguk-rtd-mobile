// T18 협동에서 중간보스를 놓쳐 탈락하면 그 걸음의 적 처리 반복이 멈춰야 한다(2026-11-28 협동 재연산 흉내 판에서 찾은 오류).
// 원인: stepEnemies가 적 목록을 뒤에서부터 돌다가 중간보스 놓침 → loseLife → eliminate()가 적 목록을 비우는데,
// 반복은 continue로 이어져 다음 칸(this.enemies[i - 1])이 undefined → e.hitT에서 TypeError. 실제 판에서는 그 걸음이 깨진다.
// 유형: Integration · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok } = L;

let err = null, elim = false, cleared = false, tried = false;
L.runParty({
  n: 2, diff: 'easy', seed: 18001, stopRound: 4,
  each(P) {
    if (tried) return;
    const ms = P.members, g0 = ms[0].g;
    if (g0.round < 3 || g0.phase !== 'wave') return;
    const el = ms.find((m) => !m.net.isHost()), g = el.g;
    if (g.enemies.length < 2) return; // 놓친 중간보스 앞(목록 앞쪽)에 적이 남아 있어야 재현된다
    tried = true;
    const m = L.T.midbosses[0];
    g.spawnMid(m);
    const mid = g.enemies[g.enemies.length - 1];
    mid.midT = 0.001; // 다음 걸음에 놓친다
    g.lives = 1; // 이번 놓침으로 탈락
    try { g.stepEnemies(0.05); } catch (e) { err = e; }
    elim = !!g.out; cleared = g.enemies.length === 0;
  },
});
ok(tried, '협동 2인 판 R3에서 손님 라인에 적 2마리 이상 + 놓칠 중간보스를 만듦');
ok(!err, `중간보스 놓침으로 탈락한 걸음에 오류 없음${err ? '(' + err.message + ')' : ''}`);
ok(elim && cleared, `탈락 처리(out=${elim})·적 목록 비움(${cleared})`);
L.done('t18-midmiss-elim');
