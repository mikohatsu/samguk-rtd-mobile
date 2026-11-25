// T15 보스 기술의 틈이 몸통 판정에 맞는가(2026-11-26 사용자 「그림 판정 + 기술 재조정」)
// 피격 판정이 장수 그림 몸통(폭 56·키 119 + 테두리 4)이 되면서, 한 점 판정에 맞춰 짜인 틈(동남풍 줄 사이, 고리 사이, 궁루 화살 사이,
// 화용도 길, 생문)에 몸통이 들어가지 않았다. 각 기술을 실제 생성기(patternGen·mechs)로 만들고, 사람이 서야 할 자리에 몸통을 두면
// 하나도 안 겹치는지(= 피할 수 있는지)를 본다.
// 유형: Logic · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok } = L;

L.seedRandom(15001);
const g = new L.E.Game(L.T, { diff: 'hard', mode: 'solo', seed: 15001, bot: false });
['jeonwi', 'munang'].forEach((id) => g.spawnUnit(g.me, id, undefined, undefined, true));
g.round = 80; g.startBoss(L.T.bosses.find((b) => b.round === 80)); g.phase = 'bossPick'; g.confirmPick([]);
const f = g.fight, b = f.boss, G = g.patternGen;
const box = (x, y) => g.bodyBox(x, y, g.hitEdge());
const hits = (x, y) => f.hazards.filter((h) => g.hazardBox(h, box(x, y)));
const fresh = () => { f.hazards = []; f.mech.objs = []; };

// 1) 동남풍(부채꼴 직선): 표적은 가운데 두 줄 사이. 표적이 보스 옆(가로)·아래(세로)로 300, 그리고 가까이(200)
[['옆 300', 300, 0], ['아래 300', 0, 300], ['대각 250', 177, 177], ['아래 200', 0, 200]].forEach(([m, dx, dy]) => {
  fresh(); b.x = 800; b.y = 400;
  // 몸통 가운데가 표적 자리에 오게(장수 위치는 몸통 가운데보다 27.5 아래)
  const t = { x: b.x + dx, y: b.y + dy };
  G.fan.call(g, f, b, t, { n: 10 }, 1, []);
  const n = f.hazards.length, cy = t.y - g.bodyMid();
  ok(hits(t.x, cy).length === 0, `동남풍 ${m}: 가만히 선 몸통이 줄 ${n}개 중 어느 것에도 안 걸림`);
});
// 2) 고리(rings): 첫 고리와 둘째 고리 사이 틈 가운데에 몸통(세로 방향이 가장 불리)
fresh(); b.x = 800; b.y = 300;
G.rings.call(g, f, b, b, { n: 4 }, 1, []);
{ const r0 = f.hazards[0], r1 = f.hazards[1], mid = (r0.r1 + r1.r0) / 2;
  ok(hits(b.x, b.y + mid - g.bodyMid()).length === 0, `고리: 고리 사이 틈(${Math.round(r1.r0 - r0.r1)})에 몸통이 세로로 들어감`); }
// 3) 십자(cross): 보스에서 300 떨어진 줄 사이 가운데
fresh(); b.x = 800; b.y = 500;
G.cross.call(g, f, b, { x: 1200, y: 500 }, { n: 12 }, 1, []);
{ const n = f.hazards.length, a = (Math.PI * 2) / n / 2, x = b.x + Math.cos(a) * 320, y = b.y + Math.sin(a) * 320;
  ok(hits(x, y - g.bodyMid()).length === 0, `십자 ${n}줄(12 요청): 보스에서 320, 줄 사이 가운데에 몸통이 들어감`); }
// 4) 탄막(bullet): 한 바퀴 탄 수가 줄었는지 — 350에서 탄 사이가 몸통 평균 폭 + 여유 이상
fresh();
G.bullet.call(g, f, b, b, { n: 28, waves: 1 }, 1, []);
{ const n = f.hazards.length, gap = (Math.PI * 2 * 350) / n - 30;
  ok(gap >= (g.bodyW() + g.bodyH()) / 2, `탄막 28발 요청 → ${n}발: 350에서 탄 사이 ${Math.round(gap)} ≥ 몸통 평균 폭 ${Math.round((g.bodyW() + g.bodyH()) / 2)}`); }
// 5) 화용도 길: 길 가운데에 몸통
fresh();
g.mechs.huarong.start.call(g, f, b, f.def.phases[0]);
{ const band = f.hazards.find((h) => h.k === 'band'), y = (band.y0 + band.y1) / 2 - g.bodyMid();
  ok(hits(700, y).filter((h) => h.k === 'band').length === 0, `화용도 길(폭 ${band.y1 - band.y0}): 길 가운데 몸통은 불판에 안 닿음, 남는 폭 ${Math.round(band.y1 - band.y0 - g.bodyH())}`); }
// 6) 팔진도 생문: AI·사람이 서는 자리(생문 가운데 = 몸통 가운데)는 안전
fresh();
G.gates.call(g, f, b, b, {}, 1, []);
{ const safe = f.hazards.find((h) => h.k === 'safe'), s = safe.spots[0];
  ok(hits(s[0], s[1] - g.bodyMid()).length === 0, `생문(반지름 ${s[2]}): 가운데 선 몸통은 안전`); }
// 7) 근접 베기·장판 줄이기(fitHazard)가 그림 값에도 그대로 들어가는지: addHazards로 만든 원은 줄어든 반지름으로 저장·전송된다
fresh();
g.addHazards([{ k: 'circle', x: 500, y: 500, r: 100, delay: 1, dmg: 1 }]);
ok(f.hazards[0].r === 100 - (L.T.rules.hzShrink || 0), `장판 크기 보정: 원 100 → ${f.hazards[0].r}(그림도 이 값으로 그린다)`);
L.done('t15-pattern-gaps');
