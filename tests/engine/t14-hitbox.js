// T14 보스전 피격 판정 = 장수 그림(몸통 사각형) 대 장판 그림(테두리 선 바깥 끝까지) (2026-11-26 사용자 결정)
//   「내 캐릭터 발판이 장판 선에 걸쳐 있는데 안 맞는 것 같은 느낌. 딱 유닛 그림을 피격 판정으로, 그리고 장판은 테두리 선까지 범위인 걸로」
// 예전: 장수 위치 한 점(그림의 허리쯤) + 여유 16. 지금: 위치 기준 x±28, y-87(머리)~y+32(발끝) 사각형을 장판 테두리 선 폭 4만큼 늘려 겹치면 맞음.
// 실제 장판을 터뜨려(stepHazards·raidHazard) 체력이 줄었는지로 본다. 같은 판정을 쓰는 AI 회피(danger)·AI 장수도 본다.
// 유형: Integration · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok } = L;

L.seedRandom(14001);
const g = new L.E.Game(L.T, { diff: 'normal', mode: 'solo', seed: 14001, bot: false });
['jeonwi', 'munang'].forEach((id) => g.spawnUnit(g.me, id, undefined, undefined, true));
g.round = 25; g.startBoss(L.T.bosses.find((b) => b.round === 25)); g.phase = 'bossPick'; g.confirmPick([]);
const f = g.fight, b = f.boss, [c, c2] = f.champs;
b.hp = b.mhp = 1e12; b.x = 1300; b.y = 150;
// 장수 c를 (700, 500)에 세우고 장판 하나를 바로 터뜨린 뒤 체력이 줄었는지
const X = 700, Y = 500;
function hitBy(h, who) {
  const u = who || c;
  f.champs.forEach((o) => { o.x = o === u ? X : 300; o.y = o === u ? Y : 900; o.tx = o.x; o.ty = o.y; o.move = false; o.inv = 0; o.hp = o.mhp; o.dead = false; o.cd = 99; o.kx = 0; o.ky = 0; o.kt = 0; });
  f.mech.gr = 99; f.mech.q.length = 0; b.atkCd = 99; b.gap = 99; b.charge = null;
  f.hazards = [Object.assign({ t: 0, delay: 0, dmg: 100, x: 0, y: 0 }, h)];
  for (let i = 0; i < 2; i++) g.step(1 / 30);
  return u.hp < u.mhp - 1;
}
// 몸통: x 672~728, y 413(머리)~532(발끝). 테두리 선 4 → 668~732, 409~536
const cases = [
  // [설명, 장판, 맞아야 하나]
  ['원: 발끝 아래 가장자리가 걸침(중심이 위치에서 111 떨어짐, 예전 한 점이면 안 맞음)', { k: 'circle', x: X, y: 532 + 80 - 1, r: 80 }, true],
  ['원: 발끝에서 테두리 선(4) 바깥으로 3 떨어짐', { k: 'circle', x: X, y: 536 + 80 + 3, r: 80 }, false],
  ['원: 머리 위 끝만 걸침', { k: 'circle', x: X, y: 413 - 80 + 2, r: 80 }, true],
  ['직선: 몸 오른쪽 끝이 선(폭 60) 테두리에 걸침', { k: 'line', x: 760, y: 0, a: Math.PI / 2, len: 1000, w: 60 }, true],
  ['직선: 몸 오른쪽 끝에서 5 떨어짐', { k: 'line', x: 767, y: 0, a: Math.PI / 2, len: 1000, w: 60 }, false],
  ['부채꼴: 끝이 몸 오른쪽에 닿음', { k: 'cone', x: 1000, y: 470, a: Math.PI, r: 270, arc: 0.6 }, true],
  ['부채꼴: 끝이 몸에서 6 모자람', { k: 'cone', x: 1000, y: 470, a: Math.PI, r: 262, arc: 0.6 }, false],
  ['고리: 몸이 안쪽 구멍에 다 들어감', { k: 'donut', x: X, y: 470, r0: 150, r1: 300 }, false],
  ['고리: 머리가 고리에 걸침', { k: 'donut', x: X, y: 470, r0: 70, r1: 300 }, true],
  ['안전지대(95): 몸통 가운데가 원 가운데', { k: 'safe', spots: [[X, Y - 27.5, 95]] }, false],
  ['안전지대(95): 발이 원 가운데(머리가 원 밖)', { k: 'safe', spots: [[X, Y + 32, 95]] }, true],
];
cases.forEach(([m, h, want]) => ok(hitBy(h) === want, `${m} → ${want ? '맞음' : '안 맞음'}`));
// 레이드 장판(raidHazard): 구획·화용도 길·충격파
ok(hitBy({ k: 'rect', raid: 1, x: 730, y: 300, rw: 200, rh: 400 }) === true, '구획(rect): 몸 오른쪽 끝이 구획 테두리에 걸침 → 맞음');
ok(hitBy({ k: 'rect', raid: 1, x: 735, y: 300, rw: 200, rh: 400 }) === false, '구획(rect): 몸에서 3 떨어짐 → 안 맞음');
ok(hitBy({ k: 'band', raid: 1, y0: 400, y1: 590 }) === false, '화용도 길(190): 몸 전체가 길 안 → 안 맞음');
ok(hitBy({ k: 'band', raid: 1, y0: 420, y1: 610 }) === true, '화용도 길: 머리가 길 위 선을 넘음 → 맞음');
ok(hitBy({ k: 'band', raid: 1, y0: 420, y1: 610, dmg: 0, dur: 2, tick: 100 }) === true, '화용도 불판(지속 피해): 머리가 넘으면 틱 피해');
// 탄환: 몸통 + 테두리에 닿으면
const proj = (x) => { f.champs.forEach((o) => { o.x = o === c ? X : 300; o.y = o === c ? Y : 900; o.hp = o.mhp; o.inv = 0; }); f.hazards = [{ k: 'proj', t: 0, delay: 0, dmg: 100, x, y: 470, a: Math.PI / 2, v: 1, r: 15 }]; g.step(1 / 30); return c.hp < c.mhp - 1; };
ok(proj(745) === true, '탄환(반지름 15): 몸 오른쪽 끝에서 13 → 맞음');
ok(proj(750) === false, '탄환(반지름 15): 몸 오른쪽 끝에서 18 → 안 맞음');
// AI 장수(c.ai)도 같은 판정
c2.ai = true;
ok(hitBy({ k: 'circle', x: X, y: 532 + 80 - 1, r: 80 }, c2) === true, 'AI 장수: 발끝만 걸친 원 → 맞음(같은 판정)');
// AI 회피 점수: 몸통이 장판에 걸치는 자리는 위험, 안전지대는 몸통 가운데를 원 가운데에 두면 위험 0
f.hazards = [{ k: 'circle', t: 0, delay: 5, dmg: 1, x: X, y: 532 + 80 + 10, r: 80 }];
ok(g.danger(X, Y) > 0, 'AI 회피: 발끝에서 10 떨어진 원도 위험으로 봄(몸통 + 여유)');
f.hazards = [{ k: 'safe', t: 0, delay: 5, dmg: 1, x: 0, y: 0, spots: [[X, 470, 95]] }];
const sp = g.raidSpots()[0];
ok(sp && g.danger(sp[0], sp[1]) === 0, `AI 회피: 생문(95) 안전 자리(${sp && sp.map(Math.round)})에 서면 위험 0`);
L.done('t14-hitbox');
