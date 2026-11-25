// T14 보스전 피격 판정 = 장수 발밑 원판 타원 대 장판 그림(테두리 선 바깥 끝까지) (2026-11-26 사용자 결정 「던파식 발밑 판정」)
//   「기존처럼 하반신(발판 쪽)이 피격 범위로 하는 게 맞는 것 같아. 대신 보스의 판정은 선 걸치기라도 하면 맞는 건 그대로」
// 예전: 장수 위치 한 점(그림의 허리) + 여유 16. 지금: 위치 + (0, 28.8)을 가운데로 반지름 38.8×18.2 타원(원판 그림)을 테두리 선 4만큼 늘려 겹치면 맞음.
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
// 발판(테두리 포함): 가운데 (700, 528.8), 가로 657.2~742.8, 세로 506.6~551.0. 몸통(그림)은 그 위로 머리까지(y 413)
const cases = [
  // [설명, 장판, 맞아야 하나]
  ['원: 발판 아래 가장자리가 테두리에 걸침(예전 한 점이면 안 맞음)', { k: 'circle', x: X, y: 551 + 80 - 1, r: 80 }, true],
  ['원: 발판에서 테두리 선 바깥으로 3 떨어짐', { k: 'circle', x: X, y: 551 + 80 + 3, r: 80 }, false],
  ['원: 머리(몸통)만 걸침, 발판은 밖', { k: 'circle', x: X, y: 413 - 80 + 2, r: 80 }, false],
  ['직선: 발판 오른쪽 끝이 선(폭 60) 테두리에 걸침', { k: 'line', x: 770, y: 0, a: Math.PI / 2, len: 1000, w: 60 }, true],
  ['직선: 발판 오른쪽 끝에서 3 떨어짐', { k: 'line', x: 776, y: 0, a: Math.PI / 2, len: 1000, w: 60 }, false],
  ['부채꼴: 끝이 발판 오른쪽에 닿음', { k: 'cone', x: 1000, y: 528.8, a: Math.PI, r: 260, arc: 0.6 }, true],
  ['부채꼴: 끝이 발판에서 5 모자람', { k: 'cone', x: 1000, y: 528.8, a: Math.PI, r: 252, arc: 0.6 }, false],
  ['고리: 발판이 안쪽 구멍에 다 들어감', { k: 'donut', x: X, y: 528.8, r0: 60, r1: 300 }, false],
  ['고리: 발판 가장자리가 고리에 걸침', { k: 'donut', x: X, y: 528.8, r0: 40, r1: 300 }, true],
  ['안전지대(95): 발판 가운데가 원 가운데', { k: 'safe', spots: [[X, 528.8, 95]] }, false],
  ['안전지대(95): 발판 아래 끝이 원 밖', { k: 'safe', spots: [[X, 528.8 - 80, 95]] }, true],
];
cases.forEach(([m, h, want]) => ok(hitBy(h) === want, `${m} → ${want ? '맞음' : '안 맞음'}`));
// 레이드 장판(raidHazard): 구획·화용도 길·충격파
ok(hitBy({ k: 'rect', raid: 1, x: 742, y: 300, rw: 200, rh: 400 }) === true, '구획(rect): 발판 오른쪽 끝이 구획 테두리에 걸침 → 맞음');
ok(hitBy({ k: 'rect', raid: 1, x: 746, y: 300, rw: 200, rh: 400 }) === false, '구획(rect): 발판에서 3 떨어짐 → 안 맞음');
ok(hitBy({ k: 'band', raid: 1, y0: 440, y1: 630 }) === false, '화용도 길(190): 머리는 길 밖이어도 발판이 길 안 → 안 맞음');
ok(hitBy({ k: 'band', raid: 1, y0: 510, y1: 700 }) === true, '화용도 길: 발판이 길 위 선을 넘음 → 맞음');
ok(hitBy({ k: 'band', raid: 1, y0: 510, y1: 700, dmg: 0, dur: 2, tick: 100 }) === true, '화용도 불판(지속 피해): 발판이 넘으면 틱 피해');
// 탄환: 몸통 + 테두리에 닿으면
const proj = (x) => { f.champs.forEach((o) => { o.x = o === c ? X : 300; o.y = o === c ? Y : 900; o.hp = o.mhp; o.inv = 0; }); f.hazards = [{ k: 'proj', t: 0, delay: 0, dmg: 100, x, y: 528.8, a: Math.PI / 2, v: 1, r: 15 }]; g.step(1 / 30); return c.hp < c.mhp - 1; };
ok(proj(755) === true, '탄환(반지름 15): 발판 오른쪽 끝에서 12 → 맞음');
ok(proj(760) === false, '탄환(반지름 15): 발판 오른쪽 끝에서 17 → 안 맞음');
// AI 장수(c.ai)도 같은 판정
c2.ai = true;
ok(hitBy({ k: 'circle', x: X, y: 551 + 80 - 1, r: 80 }, c2) === true, 'AI 장수: 발판 가장자리만 걸친 원 → 맞음(같은 판정)');
// AI 회피 점수: 몸통이 장판에 걸치는 자리는 위험, 안전지대는 몸통 가운데를 원 가운데에 두면 위험 0
f.hazards = [{ k: 'circle', t: 0, delay: 5, dmg: 1, x: X, y: 551 + 80 + 10, r: 80 }];
ok(g.danger(X, Y) > 0, 'AI 회피: 발판에서 10 떨어진 원도 위험으로 봄(발판 + 여유)');
f.hazards = [{ k: 'safe', t: 0, delay: 5, dmg: 1, x: 0, y: 0, spots: [[X, 470, 95]] }];
const sp = g.raidSpots()[0];
ok(sp && g.danger(sp[0], sp[1]) === 0, `AI 회피: 생문(95) 안전 자리(${sp && sp.map(Math.round)})에 서면 위험 0`);
L.done('t14-hitbox');
