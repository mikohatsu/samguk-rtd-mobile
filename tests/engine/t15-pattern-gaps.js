// T15 보스 기술의 틈에 발판이 지나갈 수 있는가(2026-11-26 「던파식 발밑 판정」 + 기술 틈 재계산)
// 피격 판정이 장수 발밑 타원(폭 86·깊이 44, 테두리 포함)이 되면서, 한 점 판정에 맞춰 짜인 틈(동남풍 줄 사이 50, 고리 사이 40)에
// 발판이 들어가지 않았다. 각 기술을 실제 생성기(patternGen·mechs)로 만들고, 사람이 서야 할 자리에 발판을 두면 하나도 안 겹치는지(= 피할 수 있는지)를 본다.
// 유형: Logic · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok } = L;

L.seedRandom(15001);
const g = new L.E.Game(L.T, { diff: 'hard', mode: 'solo', seed: 15001, bot: false });
['jeonwi', 'munang'].forEach((id) => g.spawnUnit(g.me, id, undefined, undefined, true));
g.round = 80; g.startBoss(L.T.bosses.find((b) => b.round === 80)); g.phase = 'bossPick'; g.confirmPick([]);
const f = g.fight, b = f.boss, G = g.patternGen;
const box = (x, y) => g.footPoly(x, y, g.hitEdge());
const hits = (x, y) => f.hazards.filter((h) => g.hazardFoot(h, box(x, y)));
const fresh = () => { f.hazards = []; f.mech.objs = []; };

// 1) 동남풍(부채꼴 직선): 표적은 가운데 두 줄 사이. 표적이 보스 옆(가로)·아래(세로)로 300, 그리고 가까이(200)
[['옆 300', 300, 0], ['아래 300', 0, 300], ['대각 250', 177, 177], ['아래 200', 0, 200]].forEach(([m, dx, dy]) => {
  fresh(); b.x = 800; b.y = 400;
  // 발판 가운데가 표적 자리에 오게(장수 위치는 발판 가운데보다 28.8 위)
  const t = { x: b.x + dx, y: b.y + dy };
  G.fan.call(g, f, b, t, { n: 10 }, 1, []);
  const n = f.hazards.length, cy = t.y - g.footMid();
  ok(hits(t.x, cy).length === 0, `동남풍 ${m}: 가만히 선 발판이 줄 ${n}개 중 어느 것에도 안 걸림`);
});
// 2) 고리(rings): 첫 고리와 둘째 고리 사이 틈 가운데에 발판(가로 방향이 가장 불리)
fresh(); b.x = 800; b.y = 300;
G.rings.call(g, f, b, b, { n: 4 }, 1, []);
{ const r0 = f.hazards[0], r1 = f.hazards[1], mid = (r0.r1 + r1.r0) / 2;
  ok(hits(b.x + mid, b.y - g.footMid()).length === 0, `고리: 고리 사이 틈(${Math.round(r1.r0 - r0.r1)})에 발판이 가로로 들어감`); }
// 3) 십자(cross): 보스에서 300 떨어진 줄 사이 가운데
fresh(); b.x = 800; b.y = 500;
G.cross.call(g, f, b, { x: 1200, y: 500 }, { n: 12 }, 1, []);
{ const n = f.hazards.length, a = (Math.PI * 2) / n / 2, x = b.x + Math.cos(a) * 320, y = b.y + Math.sin(a) * 320;
  ok(hits(x, y - g.footMid()).length === 0, `십자 ${n}줄(12 요청): 보스에서 320, 줄 사이 가운데에 발판이 들어감`); }
// 4) 탄막(bullet): 한 바퀴 탄 수 — 350에서 탄 사이가 발판 평균 폭 이상
fresh();
G.bullet.call(g, f, b, b, { n: 28, waves: 1 }, 1, []);
{ const n = f.hazards.length, gap = (Math.PI * 2 * 350) / n - 30;
  ok(gap >= (g.footW() + g.footD()) / 2, `탄막 28발 요청 → ${n}발: 350에서 탄 사이 ${Math.round(gap)} ≥ 발판 평균 폭 ${Math.round((g.footW() + g.footD()) / 2)}`); }
// 5) 화용도 길: 길 가운데에 발판
fresh();
g.mechs.huarong.start.call(g, f, b, f.def.phases[0]);
{ const band = f.hazards.find((h) => h.k === 'band'), y = (band.y0 + band.y1) / 2 - g.footMid();
  ok(hits(700, y).filter((h) => h.k === 'band').length === 0, `화용도 길(폭 ${band.y1 - band.y0}): 길 가운데 발판은 불판에 안 닿음, 남는 폭 ${Math.round(band.y1 - band.y0 - g.footD())}`); }
// 6) 팔진도 생문: AI·사람이 서는 자리(생문 가운데 = 발판 가운데)는 안전
fresh();
G.gates.call(g, f, b, b, {}, 1, []);
{ const safe = f.hazards.find((h) => h.k === 'safe'), s = safe.spots[0];
  ok(hits(s[0], s[1] - g.footMid()).length === 0, `생문(반지름 ${s[2]}): 가운데 선 발판은 안전`); }
// 7) 원복: 보스 장판 크기는 줄이지 않는다(2026-11-26 사용자 「범위 줄인 거 원복」) — addHazards로 만든 원은 반지름 그대로
fresh();
g.addHazards([{ k: 'circle', x: 500, y: 500, r: 100, delay: 1, dmg: 1 }]);
ok(f.hazards[0].r === 100, '장판 크기 원복: 원 100 → 100');
L.done('t15-pattern-gaps');
