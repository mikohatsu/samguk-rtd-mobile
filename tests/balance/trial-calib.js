// 체험(마속) 장수별 체력 보정 측정: 잠긴 신화·불멸 20명을 자동 조작(c.ai)으로 체험시켜 처치 시간을 재고,
// 목표 시간(기본 24초)에 맞는 theme.trial.hpx 값을 제안한다. 게임 코드는 읽기만 한다.
//   node tests/balance/trial-calib.js            지금 값으로 잰 시간과 제안 hpx
//   node tests/balance/trial-calib.js 24 4       목표 24초, 맞추기 4번 반복
// 자동 조작은 스킬을 쿨이 돌자마자 보스에 정확히 맞힌다. 사람은 이보다 느리므로 목표를 30초보다 낮게(24초) 잡아 60초 안에 끝나게 한다.
'use strict';
globalThis.window = globalThis;
const path = require('path'), ROOT = path.join(__dirname, '..', '..');
const E = require(path.join(ROOT, 'engine.js'));
require(path.join(ROOT, 'raid.js')); require(path.join(ROOT, 'synergy.js'));
const T = require(path.join(ROOT, 'theme-samguk.js'));
const target = +process.argv[2] || 24, rounds = +process.argv[3] || 4, SEEDS = [11, 22, 33];
const DT = 1 / 60;
function killTime(id, seed, k) {
  const keep = T.trial.hpx; T.trial.hpx = Object.assign({}, keep, { [id]: k });
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed, trial: { unit: id } });
  T.trial.hpx = keep;
  let t = null;
  for (let i = 0; i < 200 / DT && !g.over; i++) {
    if (g.phase === 'boss') g.localChamps().forEach((c) => { c.ai = true; });
    g.fight && (g.fight.limit = 1e9); // 재는 동안은 시간 제한 없이
    g.step(DT);
    g.events.forEach((e) => { if (e.type === 'trialEnd') t = e.t; }); g.events.length = 0;
  }
  return t;
}
const out = {};
for (const id of T.unlock.lockedIds()) {
  let k = (T.trial.hpx || {})[id] || 1, t0 = null;
  for (let r = 0; r < rounds; r++) {
    const ts = SEEDS.map((s) => killTime(id, s, k)), avg = ts.reduce((a, b) => a + b, 0) / ts.length;
    if (r === 0) t0 = avg;
    if (Math.abs(avg - target) < 1) break;
    k = k * (target / avg);
  }
  const ts = SEEDS.map((s) => killTime(id, s, Math.round(k * 10) / 10));
  out[id] = Math.round(k * 10) / 10;
  console.log(`${id.padEnd(9)} 지금 ${t0.toFixed(1)}s → hpx ${out[id]} : ${ts.map((x) => x.toFixed(1)).join(' / ')}s`);
}
console.log('hpx: ' + JSON.stringify(out).replace(/"/g, ''));
