// 보스 처치 시간 측정: 정한 보스를 정한 출전 장수(등급·강화)로 자동 조작(c.ai) 해서 잡는 데 걸린 시간을 잰다.
// 게임 코드는 읽기만 한다(라인 단계 없이 그 라운드의 보스전만 바로 연다). 측정 도구(게이트 아님).
//   node tests/balance/boss-time.js [난이도] [보스 라운드] [강화] [판 위 장수 id,..] [출전 장수 id,..] [씨앗 수]
//   예) node tests/balance/boss-time.js normal 80 15 jeonwi,munang,songyeon,sonhyang jeonwi,munang 5
//   출전 장수를 비우면('-') 판 위 장수 중 엔진의 출전 후보 순서(pickChoices)로 고른다.
//   판 위 장수에 auto를 주면 그 보스 hitTier+1 등급 2명을 씨앗마다 고른다(BT_ALL과 같이 써서 보스 전부 비교).
//   BT_HPX·BT_FIRE·BT_ROAD·BT_POINT: 아래 조정 실험용 환경 변수. BT_ALL=1 이면 그 난이도의 보스 전부(판 위·출전 장수는 같은 조건)를 잰다.
// 시간 제한을 없애고 끝까지 잡게 해서 실제 처치 시간을 잰다(제한 대비 비율 = 시간/limit). 자동 조작은 스킬을 쿨이 돌면 보스에 바로 쓰고
// 장판을 피한다. 사람은 피하느라 덜 때리거나 더 맞으므로 이 시간보다 느리다(trial-calib.js와 같은 가정).
'use strict';
globalThis.window = globalThis;
const path = require('path'), ROOT = process.env.RTD_ROOT ? path.resolve(process.env.RTD_ROOT) : path.join(__dirname, '..', '..');
const E = require(path.join(ROOT, 'engine.js'));
require(path.join(ROOT, 'raid.js')); require(path.join(ROOT, 'synergy.js'));
const T = require(path.join(ROOT, 'theme-samguk.js'));
const DT = 1 / 30;
// 조정 실험용(측정 프로세스 안에서만 바꾼다, 파일은 그대로): BT_HPX=배율 → 그 난이도 bossHpx[보스 라운드]를 이 값으로, BT_FIRE=값 → 조조 화용도 불판 tick
const HPX = process.env.BT_HPX != null ? +process.env.BT_HPX : null, FIRE = process.env.BT_FIRE != null ? +process.env.BT_FIRE : null;
// BT_ROAD=폭 → 조조 화용도 길 폭(fire.road), BT_POINT=1 → 옛 피격 판정 흉내(위치 한 점 + 16, 회피 34: hitBox 0·hitEdge 16·dangerPad 18)
const ROAD = process.env.BT_ROAD != null ? +process.env.BT_ROAD : null;
if (process.env.BT_POINT) Object.assign(T.rules, { hitBox: { hw: 0, top: 0, bot: 0 }, hitEdge: 16, dangerPad: 18 });

// 한 판: 보스전만 열어 처치 시간(초)과 시간 제한, 장수 전멸 여부를 돌려준다
function run(o) {
  const g = new E.Game(T, { diff: o.diff, mode: 'solo', seed: o.seed, bot: true, unlocked: T.unlock.lockedIds() });
  const p = g.me;
  g.units.slice().forEach((u) => { if (u.owner === p.idx) g.units.splice(g.units.indexOf(u), 1); }); // 시작 1성 치우기
  o.board.forEach((id) => g.spawnUnit(p, id, undefined, undefined, true));
  g.events.length = 0;
  T.upgrades.forEach((ug) => { if (ug.id.startsWith('g7')) p.upgrades[ug.id] = o.up; });
  if (o.up56 != null) T.upgrades.forEach((ug) => { if (!ug.id.startsWith('g7')) p.upgrades[ug.id] = o.up56; });
  g.recomputeAuras && g.recomputeAuras();
  const b = T.bosses.find((x) => x.round === o.round);
  g.round = o.round;
  g.startBoss(b);
  const f = g.fight, limit = f.limit;
  g.phase = 'bossPick';
  const ids = o.dep && o.dep.length ? o.dep.map((id) => g.units.find((u) => u.owner === p.idx && u.def.id === id && !f.used[u.id]).id) : [];
  g.confirmPick(ids);
  f.champs.forEach((c) => { c.ai = true; });
  f.limit = 1e9;
  const champs = f.champs.map((c) => c.def.id);
  let t = null, dead = false;
  for (let i = 0; i < 1200 / DT && g.fight === f; i++) {
    g.step(DT); g.events.length = 0;
    if (f.champs.every((c) => c.dead)) { dead = true; break; }
  }
  if (g.fight !== f) t = f.t;
  return { t, limit, dead, champs, mhp: f.boss.mhp, hpLeft: f.boss.hp / f.boss.mhp, tAt: f.t };
}

const diff = process.argv[2] || 'normal';
const rounds = process.env.BT_ALL ? T.bosses.filter((b) => b.round <= T.difficulties.find((d) => d.id === diff).rounds).map((b) => b.round) : [+(process.argv[3] || 80)];
const up = +(process.argv[4] || 15);
const board = (process.argv[5] || 'jeonwi,munang,songyeon,sonhyang').split(',');
const dep = !process.argv[6] || process.argv[6] === '-' ? [] : process.argv[6].split(',');
const N = +(process.argv[7] || 5);
const up56 = process.env.BT_UP56 != null ? +process.env.BT_UP56 : null;
for (const round of rounds) {
  if (HPX != null) { const d = T.difficulties.find((x) => x.id === diff); d.bossHpx = Object.assign({}, d.bossHpx, { [round]: HPX }); }
  if (FIRE != null) T.bosses.forEach((b) => (b.phases || []).forEach((ph) => { if (ph.fire) ph.fire = Object.assign({}, ph.fire, { tick: FIRE }); }));
  if (ROAD != null) T.bosses.forEach((b) => (b.phases || []).forEach((ph) => { if (ph.fire) ph.fire = Object.assign({}, ph.fire, { road: ROAD }); }));
  const rs = [];
  for (let s = 0; s < N; s++) {
    const seed = 7000 + s * 13;
    // board 'auto': 그 보스의 hitTier + 1 등급(보스 피해 기준 등급보다 한 단계 위, 설계상 그 라운드에 갖출 등급) 장수 2명을 씨앗마다 골라 출전. 3~6성 강화는 10
    if (board[0] === 'auto') {
      const bt = T.bosses.find((x) => x.round === round), tier = Math.min(10, bt.hitTier + 1), ids = T.units.filter((d) => d.tier === tier).map((d) => d.id);
      let a = seed; const rnd = () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648);
      const one = ids[(rnd() * ids.length) | 0]; let two = ids[(rnd() * ids.length) | 0]; if (two === one) two = ids[(ids.indexOf(one) + 1) % ids.length];
      rs.push(run({ diff, round, up, up56: up56 != null ? up56 : 10, board: [one, two], dep: [one, two], seed }));
    } else rs.push(run({ diff, round, up, up56, board, dep, seed }));
  }
  const ok = rs.filter((r) => r.t != null), b = T.bosses.find((x) => x.round === round);
  const avg = ok.length ? ok.reduce((a, r) => a + r.t, 0) / ok.length : null;
  const wipes = rs.filter((r) => r.dead).length, inLim = rs.filter((r) => r.t != null && r.t <= r.limit).length;
  console.log(`R${round} ${b.name.padEnd(3)} ${diff} 강화${up} 출전 ${board[0] === 'auto' ? 'auto(' + rs.map((r) => r.champs.join('+')).join(' ') + ')' : rs[0].champs.join('+')} 체력 ${(rs[0].mhp / 1e6).toFixed(2)}M 제한 ${rs[0].limit}s | 처치 ${ok.length}/${N} 평균 ${avg == null ? '-' : avg.toFixed(1) + 's'} (제한의 ${avg == null ? '-' : Math.round((avg / rs[0].limit) * 100) + '%'}) 전멸 ${wipes} 제한안 ${inLim} [${rs.map((r) => (r.t != null ? r.t.toFixed(0) : r.dead ? '전멸@' + r.tAt.toFixed(0) + '/' + Math.round(r.hpLeft * 100) + '%' : '시간')).join(' ')}]`);
}
