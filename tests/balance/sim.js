// 난이도별 클리어율 측정. AI 정책 3종(초보·보통·숙련) × 난이도 × 여러 씨앗, 혼자 판.
// 쓰는 법: node tests/balance/sim.js [난이도,..] [정책,..] [판 수] [시작 씨앗]
//   예) node tests/balance/sim.js easy,normal novice,skilled 20
// 출력: 판마다 한 줄(JSON, 앞에 'G ') + 맨 끝 표 2개(정책별, 최고 등급별). 같은 씨앗이면 같은 결과(코드가 같을 때).
// 유형: 측정 도구(게이트 아님). RTD_ROOT로 다른 폴더(예: 고치기 전 코드)를 잴 수 있다(lib.js 참고).
// 환경 변수(측정 도구 안에서만 쓰는 조건, 게임 규칙은 바꾸지 않는다):
//   SIM_K     사람 보정: 출전 장수 공격력 배율(기본 1, 보고서 기준 3)
//   SIM_CAP   내 조합법 제작을 이 등급까지만 허용(예: 8 → 신화·불멸 없이 끝까지). "최고 등급 ≤ N이면 클리어하나"를 잴 때
//   SIM_GIFT  '등급@라운드[,등급@라운드]' 그 라운드 시작에 그 등급 유닛(열린 것 중 무작위)을 하나 준다(예: 9@50,10@75).
//             AI가 신화·불멸을 드물게 만들어 표본이 적을 때 "만들었다면 깨나"를 재는 용도. 받은 유닛도 best에 잡힌다.
'use strict';
const L = require('../engine/lib');
const POL = require('./policies')(L.AI);

const diffs = (process.argv[2] || 'easy,normal,hard,nightmare').split(',');
const pols = (process.argv[3] || 'novice,casual,skilled').split(',');
const N = +(process.argv[4] || 20), S0 = +(process.argv[5] || 9000);
const CAP = +(process.env.SIM_CAP || 99);
const GIFTS = (process.env.SIM_GIFT || '').split(',').filter(Boolean).map((s) => s.split('@').map(Number));

function play(diff, pol, seed) {
  L.seedRandom(seed);
  // 해금: 측정은 모든 장수를 연 상태(신화·불멸 잠금과 무관하게 같은 조건으로 비교)
  const g = new L.E.Game(L.T, { diff, mode: 'solo', seed, bot: true, unlocked: L.T.unlock ? L.T.unlock.lockedIds() : undefined });
  // 사람 보정 K: AI는 보스전 조작(직접 이동·스킬 조준·회피)과 판단이 사람보다 약하다.
  // 출전 장수 공격력에 K를 곱해 "숙련 정책 = 악몽을 도전할 만한 사람"이 되게 맞춘다(보고서 1절). 기본 1.
  g.mut.champAtk *= +(process.env.SIM_K || 1);
  if (CAP < 99) {
    const craft = g.craft.bind(g), rs = g.recipeStatus.bind(g);
    g.craft = (p, id) => (p === g.me && g.defs[id].tier > CAP ? false : craft(p, id));
    g.recipeStatus = (p, id) => { const s = rs(p, id); return p === g.me && g.defs[id].tier > CAP ? Object.assign({}, s, { ok: false }) : s; };
  }
  const bestAt = {}, given = [];
  const spawn = g.spawnUnit.bind(g);
  g.spawnUnit = (p, id, ...a) => { const u = spawn(p, id, ...a); if (p === g.me && u.def.tier >= 7 && !bestAt[u.def.tier]) bestAt[u.def.tier] = g.round; return u; };
  // 시너지: 판 중 가장 많이 켜진 수, 그리고 보스전 출전 장수 중 시너지를 받은 장수가 있었는지(보스 라운드 목록)
  let synMax = 0, lastFight = null;
  const synBoss = [], bossT = {};
  const brain = new POL[pol](g, L.build(seed % 6));
  const cap = L.maxStepsFor(diff);
  let steps = 0, last = null, lastRound = -1;
  while (!g.over && steps < cap) {
    if (g.round !== lastRound) {
      lastRound = g.round;
      GIFTS.forEach(([t, r]) => {
        if (r !== g.round || given.includes(t)) return;
        const ids = g.tierIds(t);
        if (ids.length) { g.spawnUnit(g.me, ids[(g.rand() * ids.length) | 0]); given.push(t); }
      });
    }
    g.step(L.DT); brain.update(L.DT); g.events.length = 0; steps++;
    if (steps % 30 === 0) synMax = Math.max(synMax, Object.keys(g.me.syn || {}).length);
    if (g.fight && g.phase === 'boss') {
      last = { b: g.fight.def.round, hp: g.fight.boss.hp / g.fight.boss.mhp, champs: g.fight.champs.map((c) => c.def.tier) };
      if (lastFight !== g.fight) lastFight = g.fight;
      // 보스별 결과: 이기면 쓴 시간 비율(t/제한), 지면 -남은 체력 비율. 수치 여유(몇 배 더 세게 해도 되는지)를 보는 용도
      bossT[g.fight.def.round] = [g.fight.t / g.fight.limit, g.fight.boss.hp / g.fight.boss.mhp];
      if (!synBoss.includes(g.fight.def.round) && g.fight.champs.some((c) => !c.dead && c.syR && c.syR.length > 0)) synBoss.push(g.fight.def.round);
    }
  }
  const lostBoss = g.stats.bosses.find((b) => !b.win);
  Object.keys(bossT).forEach((r) => { const w = g.stats.bosses.find((b) => b.round === +r && b.win); bossT[r] = w ? +bossT[r][0].toFixed(2) : -(+bossT[r][1].toFixed(2)); });
  return {
    diff, pol, seed, win: g.over === 'win', round: g.round, lives: g.lives,
    death: g.over === 'win' ? '-' : lostBoss ? 'B' + lostBoss.round : g.over ? 'L' + g.round : 'cap',
    bossHpLeft: lostBoss && last ? +last.hp.toFixed(2) : null, champs: lostBoss && last ? last.champs : null,
    best: g.stats.best, bestAt, gift: given, synMax, synBoss, syn: synBoss.length > 0, bossT,
    up: Object.values(g.me.upgrades).reduce((a, x) => a + x, 0), sages: g.sagesOf(g.me).length,
  };
}

const rows = [];
for (const d of diffs) for (const pol of pols) for (let i = 0; i < N; i++) {
  const r = play(d, pol, S0 + i * 13);
  rows.push(r);
  console.log('G ' + JSON.stringify(r));
}
console.log(`\n[K=${process.env.SIM_K || 1} CAP=${process.env.SIM_CAP || '-'} GIFT=${process.env.SIM_GIFT || '-'}]`);
console.log('난이도 | 정책 | 클리어 | 죽은 곳(빈도)');
for (const d of diffs) for (const pol of pols) {
  const rs = rows.filter((r) => r.diff === d && r.pol === pol);
  const w = rs.filter((r) => r.win).length, dc = {};
  rs.filter((r) => !r.win).forEach((r) => (dc[r.death] = (dc[r.death] || 0) + 1));
  console.log(`${d} | ${pol} | ${w}/${rs.length} (${Math.round((100 * w) / rs.length)}%) | ${Object.entries(dc).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '×' + v).join(' ')}`);
}
// 최고 등급별(정책 합산): ≤8 / 9 / 10, 시너지(보스전 출전 장수가 시너지를 받음) 유무
console.log('\n난이도 | 최고 등급 | 클리어 | 시너지 O 클리어 | 시너지 X 클리어 | 죽은 곳');
const grp = [['≤6', (b) => b <= 6], ['7~8', (b) => b === 7 || b === 8], ['9', (b) => b === 9], ['10', (b) => b === 10]];
for (const d of diffs) for (const [name, f] of grp) {
  const rs = rows.filter((r) => r.diff === d && f(r.best));
  if (!rs.length) continue;
  const fr = (a) => `${a.filter((r) => r.win).length}/${a.length}`, dc = {};
  rs.filter((r) => !r.win).forEach((r) => (dc[r.death] = (dc[r.death] || 0) + 1));
  console.log(`${d} | ${name} | ${fr(rs)} | ${fr(rs.filter((r) => r.syn))} | ${fr(rs.filter((r) => !r.syn))} | ${Object.entries(dc).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '×' + v).join(' ')}`);
}
