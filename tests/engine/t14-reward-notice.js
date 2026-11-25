// T14 보상·리롤 알림(2026-11-26 실기 소감).
// ① 중간보스 장양(R15, 랜덤 2성 1기) 처치 알림에 실제로 들어온 장수 이름이 적힌다(예전: 「랜덤 2성 1기」만).
// ② 다른 세력 리롤권으로 나온 장수는 등급(4~7성)·라운드와 상관없이 등장 연출(pop) 이벤트가 없다. 장수 교체권은 그대로 뜬다.
// 유형: Unit · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { E, T, ok } = L;

// ① 장양 처치 → 알림 글에 새 2성 장수 이름
try {
  // Arrange
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 1401 });
  const m = T.midbosses.find((x) => x.round === 15);
  g.spawnMid(m);
  const e = g.enemies.find((x) => x.mid);
  const before = new Set(g.units.map((u) => u.id));
  g.events.length = 0;
  // Act
  g.killEnemy(e, g.me);
  // Assert
  const fresh = g.units.filter((u) => !before.has(u.id));
  const toast = g.events.filter((x) => x.type === 'toast').map((x) => x.text).find((t) => t.startsWith(m.name));
  ok(fresh.length === 1 && fresh[0].def.tier === 2, `장양 보상으로 2성 1기 (${fresh.map((u) => u.def.name + '/' + u.def.tier).join(',')})`);
  ok(!!toast && fresh.length === 1 && toast.includes(fresh[0].def.name), `처치 알림에 들어온 장수 이름 (${toast})`);
} catch (e) { ok(false, '장양 보상 알림 확인 중 예외 — ' + L.errText(e)); }

// ①-2 1성 여러 기(정원지 R3, 랜덤 1성 3기): 이름이 모두 알림에 있다
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 1402 });
  const m = T.midbosses.find((x) => x.round === 3);
  g.spawnMid(m);
  const before = new Set(g.units.map((u) => u.id));
  g.events.length = 0;
  g.killEnemy(g.enemies.find((x) => x.mid), g.me);
  const fresh = g.units.filter((u) => !before.has(u.id)), toast = g.events.filter((x) => x.type === 'toast').map((x) => x.text).find((t) => t.startsWith(m.name)) || '';
  ok(fresh.length === 3 && fresh.every((u) => toast.includes(u.def.name)), `정원지 알림에 1성 3기 이름 모두 (${toast})`);
} catch (e) { ok(false, '정원지 보상 알림 확인 중 예외 — ' + L.errText(e)); }

// ② 다른 세력 리롤권: 4·5성(초반)·6성(R90 이하)·7성(항상) 모두 pop 없음
for (const [tier, round] of [[4, 10], [5, 20], [6, 30], [7, 40]]) {
  try {
    // Arrange
    const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 1410 + tier });
    g.round = round;
    const u = g.spawnUnit(g.me, g.tierIds(tier)[0], 0, 0, true), d = g.spawnDrop(g.me, 'factionReroll', {});
    g.events.length = 0;
    // Act
    const n = g.useDrop(g.me, d, u);
    // Assert
    const pops = g.events.filter((x) => x.type === 'pop').length;
    ok(n && n.def.tier === tier && n.def.fac !== u.def.fac && pops === 0, `리롤권 ${tier}성(R${round}) → 다른 세력 같은 등급, 등장 연출 없음 (pop ${pops})`);
  } catch (e) { ok(false, `리롤권 ${tier}성 확인 중 예외 — ` + L.errText(e)); }
}

// ②-2 대조: 장수 교체권(7성 이상)은 예전처럼 등장 연출이 뜬다
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 1420 });
  const u = g.spawnUnit(g.me, g.tierIds(7)[0], 0, 0, true), d = g.spawnDrop(g.me, 'generalSwap', {});
  g.events.length = 0;
  const n = g.useDrop(g.me, d, u);
  ok(n && g.events.some((x) => x.type === 'pop'), '장수 교체권은 등장 연출 그대로');
} catch (e) { ok(false, '장수 교체권 확인 중 예외 — ' + L.errText(e)); }

L.done('t14-reward-notice');
