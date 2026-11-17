// 난이도별 클리어율 측정. AI 정책 3종(초보·보통·숙련) × 난이도 × 여러 씨앗, 혼자 판.
// 쓰는 법: node tests/balance/sim.js [난이도,..] [정책,..] [판 수] [시작 씨앗]
//   예) node tests/balance/sim.js easy,normal novice,skilled 20
// 출력: 판마다 한 줄(JSON, 앞에 'G ') + 맨 끝 표. 같은 씨앗이면 같은 결과(코드가 같을 때).
// 유형: 측정 도구(게이트 아님). RTD_ROOT로 다른 폴더(예: 고치기 전 코드)를 잴 수 있다(lib.js 참고).
'use strict';
const L = require('../engine/lib');
const POL = require('./policies')(L.AI);

const diffs = (process.argv[2] || 'easy,normal,hard,nightmare').split(',');
const pols = (process.argv[3] || 'novice,casual,skilled').split(',');
const N = +(process.argv[4] || 20), S0 = +(process.argv[5] || 9000);

function play(diff, pol, seed) {
  L.seedRandom(seed);
  const g = new L.E.Game(L.T, { diff, mode: 'solo', seed, bot: true });
  // 사람 보정 K: AI는 보스전 조작(직접 이동·스킬 조준·회피)과 판단이 사람보다 약하다.
  // 출전 장수 공격력에 K를 곱해 "숙련 정책 = 악몽을 도전할 만한 사람"이 되게 맞춘다(보고서 1절). 기본 1.
  g.mut.champAtk *= +(process.env.SIM_K || 1);
  const brain = new POL[pol](g, L.build(seed % 6));
  const cap = L.maxStepsFor(diff);
  let steps = 0, last = null;
  while (!g.over && steps < cap) {
    g.step(L.DT); brain.update(L.DT); g.events.length = 0; steps++;
    if (g.fight && g.phase === 'boss') last = { b: g.fight.def.round, hp: g.fight.boss.hp / g.fight.boss.mhp, champs: g.fight.champs.map((c) => c.def.tier) };
  }
  const lostBoss = g.stats.bosses.find((b) => !b.win);
  return {
    diff, pol, seed, win: g.over === 'win', round: g.round, lives: g.lives,
    death: g.over === 'win' ? '-' : lostBoss ? 'B' + lostBoss.round : g.over ? 'L' + g.round : 'cap',
    bossHpLeft: lostBoss && last ? +last.hp.toFixed(2) : null, champs: lostBoss && last ? last.champs : null,
    best: g.stats.best, up: Object.values(g.me.upgrades).reduce((a, x) => a + x, 0), sages: g.sagesOf(g.me).length,
  };
}

const rows = [];
for (const d of diffs) for (const pol of pols) for (let i = 0; i < N; i++) {
  const r = play(d, pol, S0 + i * 13);
  rows.push(r);
  console.log('G ' + JSON.stringify(r));
}
console.log('\n난이도 | 정책 | 클리어 | 죽은 곳(빈도)');
for (const d of diffs) for (const pol of pols) {
  const rs = rows.filter((r) => r.diff === d && r.pol === pol);
  const w = rs.filter((r) => r.win).length, dc = {};
  rs.filter((r) => !r.win).forEach((r) => (dc[r.death] = (dc[r.death] || 0) + 1));
  console.log(`${d} | ${pol} | ${w}/${rs.length} (${Math.round((100 * w) / rs.length)}%) | ${Object.entries(dc).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '×' + v).join(' ')}`);
}
