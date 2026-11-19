// 협동(가상 방 n인) 클리어율 측정. sim.js(혼자)와 같은 AI 정책·보정 K·등급 상한·지급을 플레이어마다 따로 준다.
// 쓰는 법: node tests/balance/coop.js <난이도,..> <구성,..> [판 수] [시작 씨앗]
//   예) node tests/balance/coop.js normal,hard LLL77,MLL77,IIM77 8
// 구성 = 플레이어마다 한 글자(글자 수 = 인원, 1~5). 글자 뜻(측정 도구 안의 조건, 게임 규칙은 바꾸지 않는다):
//   N  자연: 상한·지급 없음
//   6  6성 상한(전설·영웅 없이 끝까지)          7  7성 상한
//   L  전설: 8성 상한 + 8성 1기 지급(@COOP_L, 기본 60)
//   M  신화: 9성 상한 + 9성 1기 지급(@COOP_M, 기본 70)
//   I  불멸: 10성 상한 + 10성 1기 지급(@COOP_I, 기본 80)
// 환경 변수: SIM_K(출전 장수 공격력 배율, 보고서 기준 3), COOP_POL(정책, 기본 skilled; 'skilled,casual,..'면 자리 순서대로)
//   COOP_LANE 라인 몹 체력 배율(측정용 보정, 기본 1). 협동은 한 사람 라인만 무너져도 모두 지므로, AI 라인 약점과
//             보스 기준(등급 구성)을 떼어 보고 싶을 때 쓴다. 게임 수치가 아니다.
//   COOP_PHPX 협동 보스 체력 보정(theme R.partyHpx) 후보를 theme을 고치지 않고 시험: 'hard:100=0.85,90=1;normal:90=1.2'
//             (그 난이도의 partyHpx를 이 값으로 바꿔 끼운다. 이 프로세스 안에서만)
// 출력: 판마다 'G {json}' + 끝에 난이도×구성 표(클리어율, 진 곳, 보스별 시간 사용률 중앙값 — 지면 -남은 체력).
// 유형: 측정 도구(게이트 아님). 같은 씨앗이면 같은 결과(코드가 같을 때). RTD_ROOT로 다른 폴더를 잴 수 있다(lib.js).
'use strict';
const L = require('../engine/lib');
const POL = require('./policies')(L.AI);

const diffs = (process.argv[2] || 'normal').split(',');
const comps = (process.argv[3] || 'LLL77').split(',');
const N = +(process.argv[4] || 8), S0 = +(process.argv[5] || 5000);
const K = +(process.env.SIM_K || 1), LANE = +(process.env.COOP_LANE || 1);
const pols = (process.env.COOP_POL || 'skilled').split(',');
const AT = { L: +(process.env.COOP_L || 60), M: +(process.env.COOP_M || 70), I: +(process.env.COOP_I || 80) };
(process.env.COOP_PHPX || '').split(';').filter(Boolean).forEach((part) => {
  const [id, kv] = part.split(':'), R = L.T.rules || L.T.R;
  const t = (R.partyHpx = R.partyHpx || {})[id] = {}; kv.split(',').forEach((x) => { const [r, v] = x.split('='); t[+r] = +v; });
});
const SPEC = {
  N: { cap: 99, gift: [] }, 6: { cap: 6, gift: [] }, 7: { cap: 7, gift: [] },
  L: { cap: 8, gift: [[8, AT.L]] }, M: { cap: 9, gift: [[9, AT.M]] }, I: { cap: 10, gift: [[10, AT.I]] },
};

// 한 플레이어 게임에 상한·지급·기록을 붙인다(sim.js와 같은 방식)
function rig(m, spec) {
  const g = m.g;
  g.mut.champAtk *= K;
  g.mut.laneHp *= LANE;
  if (spec.cap < 99) {
    const craft = g.craft.bind(g), rs = g.recipeStatus.bind(g);
    g.craft = (p, id) => (p === g.me && g.defs[id].tier > spec.cap ? false : craft(p, id));
    g.recipeStatus = (p, id) => { const s = rs(p, id); return p === g.me && g.defs[id].tier > spec.cap ? Object.assign({}, s, { ok: false }) : s; };
  }
  m.bestAt = {}; m.given = []; m.synMax = 0; m.lastRound = -1;
  const spawn = g.spawnUnit.bind(g);
  g.spawnUnit = (p, id, ...a) => { const u = spawn(p, id, ...a); if (p === g.me && u.def.tier >= 7 && !m.bestAt[u.def.tier]) m.bestAt[u.def.tier] = g.round; return u; };
  m.tick = () => {
    if (g.round !== m.lastRound) {
      m.lastRound = g.round;
      spec.gift.forEach(([t, r]) => {
        if (r !== g.round || m.given.includes(t)) return;
        const ids = g.tierIds(t);
        if (ids.length) { g.spawnUnit(g.me, ids[(g.rand() * ids.length) | 0]); m.given.push(t); }
      });
    }
  };
}

function play(diff, comp, seed) {
  L.seedRandom(seed);
  const hub = L.NET.hub(), members = [], n = comp.length;
  const unlocked = L.T.unlock ? L.T.unlock.lockedIds() : undefined;
  for (let i = 0; i < n; i++) {
    const net = hub.join('AI' + i);
    const g = new L.E.Game(L.T, { diff, mode: 'multi', seed: seed + i, net, bot: true, unlocked });
    net.attach(g);
    const m = { i, g, net, spec: SPEC[comp[i]] };
    rig(m, m.spec);
    m.brain = new POL[pols[i % pols.length]](g, L.build(seed + i));
    members.push(m);
  }
  const cap = L.maxStepsFor(diff);
  let steps = 0, grace = -1, firstOver = null;
  const bossT = {}, synBoss = new Set();
  for (;;) {
    hub.flush();
    members.forEach((m) => m.tick());
    members.forEach((m) => m.g.step(L.DT));
    members.forEach((m) => {
      m.net.tickStatus(L.DT, m.g); m.brain.update(L.DT); m.g.events.length = 0;
    });
    hub.flush();
    steps++;
    if (steps % 30 === 0) members.forEach((m) => (m.synMax = Math.max(m.synMax, Object.keys(m.g.me.syn || {}).length)));
    const h = members.find((m) => m.net.isHost()) || members[0];
    const f = h.g.fight;
    if (f && h.g.phase === 'boss') {
      bossT[f.def.round] = [f.t / f.limit, f.boss.hp / f.boss.mhp];
      members.forEach((m) => { const mf = m.g.fight; if (mf && mf.champs.some((c) => c.owner === m.g.me.idx && !c.dead && c.syR && c.syR.length > 0)) synBoss.add(m.i); });
    }
    if (!firstOver) { const o = members.find((m) => m.g.over); if (o) firstOver = { i: o.i, over: o.g.over, round: o.g.round, phase: o.g.phase, lives: o.g.lives }; }
    if (members.every((m) => m.g.over)) break;
    if (members.some((m) => m.g.over)) { if (grace < 0) grace = 90; else if (--grace === 0) break; }
    if (steps >= cap) break;
  }
  const h = members.find((m) => m.net.isHost()) || members[0], g = h.g;
  const win = members.every((m) => m.g.over === 'win');
  const lostBoss = g.stats.bosses.find((b) => !b.win);
  Object.keys(bossT).forEach((r) => { const w = g.stats.bosses.find((b) => b.round === +r && b.win); bossT[r] = w ? +bossT[r][0].toFixed(2) : -(+bossT[r][1].toFixed(2)); });
  // 진 곳: 보스(B라운드) 또는 라인(L라운드, 누구의 라인이 무너졌는지 #자리)
  let death = '-';
  if (!win) {
    if (lostBoss) death = 'B' + lostBoss.round;
    else if (firstOver && firstOver.lives <= 0) death = 'L' + firstOver.round + '#' + firstOver.i;
    else death = firstOver ? 'L' + firstOver.round : 'cap';
  }
  return {
    diff, comp, n, seed, win, round: g.round, death, bossT,
    best: members.map((m) => m.g.stats.best), bestAt: members.map((m) => m.bestAt), synMax: members.map((m) => m.synMax), synBoss: [...synBoss],
    up: members.map((m) => Object.values(m.g.me.upgrades).reduce((a, x) => a + x, 0)),
  };
}

const rows = [];
for (const d of diffs) for (const c of comps) for (let i = 0; i < N; i++) {
  const r = play(d, c, S0 + i * 17);
  rows.push(r);
  console.log('G ' + JSON.stringify(r));
}
const med = (a) => { if (!a.length) return '-'; const s = a.slice().sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
console.log(`\n[K=${K} LANE=${LANE} PHPX=${process.env.COOP_PHPX || "-"} POL=${pols.join(',')} L@${AT.L} M@${AT.M} I@${AT.I}]`);
console.log('난이도 | 구성 | 클리어 | 진 곳 | 보스별 시간 사용 중앙값(이긴 판) / 진 판 남은 체력');
for (const d of diffs) for (const c of comps) {
  const rs = rows.filter((r) => r.diff === d && r.comp === c);
  const w = rs.filter((r) => r.win).length, dc = {};
  rs.filter((r) => !r.win).forEach((r) => { const k = r.death.replace(/#\d+$/, ''); dc[k] = (dc[k] || 0) + 1; });
  const rounds = [...new Set(rs.flatMap((r) => Object.keys(r.bossT).map(Number)))].sort((a, b) => a - b).filter((x) => x >= 55);
  const bt = rounds.map((b) => {
    const v = rs.map((r) => r.bossT[b]).filter((x) => x != null);
    const ws = v.filter((x) => x >= 0), ls = v.filter((x) => x < 0).map((x) => -x);
    return `${b}:${med(ws)}${ls.length ? '/-' + med(ls) + '×' + ls.length : ''}`;
  }).join(' ');
  console.log(`${d} | ${c} | ${w}/${rs.length} (${Math.round((100 * w) / rs.length)}%) | ${Object.entries(dc).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '×' + v).join(' ')} | ${bt}`);
}
