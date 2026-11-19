// T8 라인 공격 버튼(모바일 라인 조이스틱과 함께 쓰는 공격): 누르고 있으면 사거리 안의 중간보스를 먼저,
// 없으면 가장 가까운 적을 친다. 조이스틱으로 움직이는 동안에도 친다. 떼면 원래 동작(자동으로 가까운 적).
// 유형: Logic · 위치: tests/engine/ · 게이트: BLOCKING
// 설계: production/team/2026-11-19/lane-attack-button.md
'use strict';
const L = require('./lib');
const { ok, info, T, E, DT } = L;

// 판을 비우고 1성 궁병 하나와 적들만 둔다. 적은 stepUnits만 돌려 제자리에 둔다(길을 따라 움직이지 않음).
function setup(o) {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 8101, bot: true });
  g.units = []; g.enemies = []; g.drops = [];
  const u = g.spawnUnit(g.me, 'arc', 600, 130, true) || g.units[g.units.length - 1];
  u.x = 600; u.y = 130; u.order = { t: 'idle' }; u.target = null; u.cd = 0; u.scan = 0;
  g.recomputeAuras(); g.events.length = 0;
  const rng = g.rangeOf(u);
  const foe = (x, y, mid) => { const e = g.spawnEnemy({ name: mid ? 'M' : 'n' }, 1e12, 0, 0, mid); e.x = x; e.y = y; return e; };
  return { g, u, rng, foe };
}
const dealt = (e) => 1e12 - e.hp;
function tick(g, n) { for (let i = 0; i < n; i++) { g.stepUnits(DT); g.events.length = 0; } }

// ---- 1. 누르고 있으면 더 가까운 일반 적보다 사거리 안의 중간보스를 친다 ----
{
  const { g, u, rng, foe } = setup();
  const near = foe(600, 70), far = Math.sqrt(Math.max(0, (rng * 0.9) ** 2 - 60 ** 2));
  const mid = foe(600 + far, 70, true);
  info(`사거리 ${Math.round(rng)}, 일반 적 거리 60, 중간보스 거리 ${Math.round(Math.hypot(far, 60))}`);
  g.laneJoy = { ids: new Set([u.id]), x: 0, y: 0, atk: true };
  tick(g, 90);
  ok(dealt(mid) > 0 && dealt(near) === 0, `공격 버튼: 중간보스만 친다 (중간보스 ${Math.round(dealt(mid))}, 일반 ${Math.round(dealt(near))})`);
  ok(u.order.t === 'idle', '움직이지 않고 누르기만 하면 명령은 바뀌지 않는다');
  // 떼면 원래 동작: 잡은 대상은 사거리를 벗어나거나 쓰러질 때까지 그대로(타워 규칙), 그 뒤 새로 고를 때는 가까운 적
  g.laneJoy = null;
  tick(g, 30);
  ok(u.target === mid, '떼도 잡고 있던 대상(중간보스)은 사거리 안에 있는 동안 계속 친다(기존 규칙)');
  g.enemies = g.enemies.filter((e) => e !== mid);
  const mid2 = foe(600 + far, 70, true), n0 = dealt(near);
  tick(g, 90);
  ok(dealt(near) > n0 && dealt(mid2) === 0, `떼고 대상이 풀린 뒤에는 원래대로 가장 가까운 적을 고른다(중간보스 우선 아님) (일반 +${Math.round(dealt(near) - n0)})`);
}
// ---- 2. 중간보스가 사거리 밖이면 가장 가까운 적 ----
{
  const { g, u, rng, foe } = setup();
  const near = foe(640, 70), other = foe(600 + Math.sqrt((rng * 0.9) ** 2 - 60 ** 2), 70);
  const mid = foe(600 + rng + 200, 70, true);
  g.laneJoy = { ids: new Set([u.id]), x: 0, y: 0, atk: true };
  tick(g, 90);
  ok(dealt(near) > 0 && dealt(other) === 0 && dealt(mid) === 0, `중간보스가 사거리 밖: 가장 가까운 적을 친다 (가까운 ${Math.round(dealt(near))}, 먼 ${Math.round(dealt(other))}, 중간보스 ${Math.round(dealt(mid))})`);
}
// ---- 3. 움직이면서 친다(버튼 없이 움직이면 치지 않는다) ----
{
  const { g, u, foe } = setup();
  const a = foe(560, 70), b = foe(700, 70), c = foe(840, 70);
  g.laneJoy = { ids: new Set([u.id]), x: 1, y: 0, atk: false };
  const x0 = u.x;
  tick(g, 30);
  ok(u.x > x0 + 50 && dealt(a) + dealt(b) + dealt(c) === 0, `버튼 없이 조이스틱: 움직이기만 하고 치지 않는다 (이동 ${Math.round(u.x - x0)})`);
  g.laneJoy = { ids: new Set([u.id]), x: 1, y: 0, atk: true };
  const x1 = u.x, sp0 = (u.x - x0) / 30;
  tick(g, 30);
  const sp1 = (u.x - x1) / 30, hit = dealt(a) + dealt(b) + dealt(c);
  ok(u.x > x1 + 50 && hit > 0, `공격 버튼 + 조이스틱: 움직이면서 친다 (이동 ${Math.round(u.x - x1)}, 피해 ${Math.round(hit)})`);
  ok(Math.abs(sp1 - sp0) < 0.01, `이동 속도는 그대로 (${sp0.toFixed(2)} = ${sp1.toFixed(2)} px/프레임)`);
  ok(u.order.t === 'hold', '움직였으면 그 자리를 지킨다(hold), 기존 조이스틱과 같음');
  // 협동: 다른 사람 유닛은 내 공격 버튼에 반응하지 않는다(owner 검사)
  const v = g.spawnUnit(g.me, 'arc', 900, 130, true) || g.units[g.units.length - 1];
  v.owner = 1; v.x = 900; v.y = 130; v.order = { t: 'idle' };
  g.laneJoy = { ids: new Set([u.id, v.id]), x: 1, y: 0, atk: true };
  tick(g, 10);
  ok(Math.abs(v.x - 900) < 30, '다른 사람(owner≠나) 유닛은 laneJoy로 움직이지 않는다');
}
L.done('t8-lane-attack');
