// T4 이어하기: 저장 → JSON → 불러오기 → 다시 저장 비교, 살아 있는 me와 저장된 me의 키 비교(QA B-07).
// 유형: Logic · 위치: tests/engine/ · 게이트: BLOCKING ([B-07] 줄은 고치기 전까지 실패가 정상)
'use strict';
const L = require('./lib');
const { ok, skip, info, T, E, AI } = L;
const json = (o) => JSON.parse(JSON.stringify(o));

// 1) 직접 확인 [B-07]: usedItems가 저장을 거쳐 남는가
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 41 });
  g.me.usedItems = ['__probe__'];
  const s = g.snapshot();
  ok(!!s, '라인 단계에서 snapshot()이 값을 돌려줌');
  const g2 = E.Game.restore(T, json(s));
  ok(JSON.stringify(g2.me.usedItems) === '["__probe__"]', `[B-07] 이미 쓴 조합 아이템(usedItems)이 불러온 뒤에도 남음 (불러온 값: ${JSON.stringify(g2.me.usedItems)})`);
} catch (e) { ok(false, 'usedItems 직접 확인 중 예외 — ' + L.errText(e)); }

// 2) 한 판을 돌리며 라운드마다 저장본으로 갈아 끼운다
let swaps = 0, lastRound = 0, valDiff = null, bossNull = 0, bossNonNull = 0, sawUsed = false;
const lostKeys = new Map(), enemyKeys = new Set();
const r = L.runSolo({
  diff: 'easy', seed: 4004,
  each(st) {
    const g = st.g;
    if (g.phase !== 'wave' && !g.over) { if (g.snapshot() === null) bossNull++; else bossNonNull++; return; }
    if (g.over || g.round === lastRound) return;
    lastRound = g.round;
    const snap = g.snapshot();
    if (!snap) return;
    const s1 = json(snap), g2 = E.Game.restore(T, json(s1)), s2 = json(g2.snapshot());
    delete s1.at; delete s2.at;
    if (!valDiff) { const d = L.firstDiff(s1, s2); if (d) valDiff = `R${g.round}: ${d}`; }
    // 살아 있는 me의 키가 저장본에 있고, 불러온 값이 같은가(idx는 자리 번호라 뺀다)
    if (g.me.usedItems) sawUsed = true;
    Object.keys(g.me).forEach((k) => {
      // idx: 자리 번호. syn: 유닛으로 다시 계산되는 값(engine.js recomputeAuras). arrangeAll: AI 사령관만 켜는 값(ai.js:25)
      if (k === 'idx' || k === 'syn' || k === 'arrangeAll' || lostKeys.has(k)) return;
      if (!(k in s1.me)) lostKeys.set(k, `R${g.round} 저장본에 없음`);
      else if (JSON.stringify(g.me[k]) !== JSON.stringify(g2.me[k])) lostKeys.set(k, `R${g.round} 값이 달라짐`);
    });
    // 참고: 살아 있는 적에는 있고 불러온 적에는 없는 속성
    const rk = new Set(g2.enemies.flatMap((e) => Object.keys(e)));
    if (g2.enemies.length) g.enemies.forEach((e) => Object.keys(e).forEach((k) => { if (!rk.has(k) && e[k]) enemyKeys.add(k); }));
    g2.bot = true; // 저장에는 없는 시험용 설정: 보스전 장수를 AI가 움직이게
    st.g = g2; st.brain = new AI.Brain(g2, L.build(0));
    swaps++;
  },
});
ok(!r.error, '저장본으로 갈아 끼우며 한 판: 예외 없음' + (r.error ? ' — ' + r.error : ''));
ok(swaps > 0, `저장 → 불러오기를 ${swaps}번 함`);
ok(!valDiff, '저장 → JSON → 불러오기 → 다시 저장한 값이 모두 같음' + (valDiff ? ' — ' + valDiff : ''));
const used = lostKeys.has('usedItems');
if (sawUsed) ok(!used, '[B-07] 실제 판에서 생긴 usedItems가 저장·복원됨' + (used ? ' — ' + lostKeys.get('usedItems') : ''));
else skip('AI가 이 판에서 아이템 조합을 하지 않아 usedItems가 실제 판에서는 생기지 않음(위 직접 확인만 함)');
const others = [...lostKeys.entries()].filter(([k]) => k !== 'usedItems');
ok(others.length === 0, 'me의 나머지 키가 모두 저장·복원됨' + (others.length ? ' — 빠지는 키: ' + others.map(([k, v]) => `${k}(${v})`).join(', ') : ''));
if (r.g) {
  ok(!!r.g.over && !r.capped && !r.stalled, `갈아 끼운 판이 끝까지 감 over=${r.g.over} R${r.g.round} ${r.ms}ms`);
  const v = L.violText(r.watch);
  ok(v.length === 0, '갈아 끼운 판의 불변식' + (v.length ? ' — ' + v.join(' ; ') : ' 통과'));
}
ok(bossNull > 0 && bossNonNull === 0, `보스 단계에서는 snapshot()이 null (null ${bossNull}번, 값 ${bossNonNull}번)`);
if (enemyKeys.size) info(`참고(B-11 관련, 판정 아님): 살아 있는 적에만 있고 불러온 적에는 없는 속성: ${[...enemyKeys].join(', ')}`);

// 3) 옛 저장·빠진 항목
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 43 });
  for (let i = 0; i < 900; i++) g.step(L.DT);
  const s = json(g.snapshot()), n = s.units.length;
  s.units.push({ id: 999999, d: 'no_such_unit_id', x: 500, y: 500, slot: null, o: 'idle' });
  const g2 = E.Game.restore(T, s);
  for (let i = 0; i < 900; i++) g2.step(L.DT);
  ok(g2.units.every((u) => u.def) && !g2.units.some((u) => u.id === 999999), `없는 장수 id가 든 저장: 그 유닛만 빼고 불러와 30초 더 돎 (유닛 ${n}→불러온 직후 기준 유지)`);
  const s3 = json(g.snapshot()); delete s3.drops; delete s3.enemies; delete s3.spawnCd; delete s3.endedRound;
  const g3 = E.Game.restore(T, s3);
  for (let i = 0; i < 900; i++) g3.step(L.DT);
  ok(g3.round >= s3.round, '항목이 빠진 옛 저장(drops·enemies·spawnCd 없음): 예외 없이 불러와 30초 더 돎');
} catch (e) { ok(false, '옛 저장·빠진 항목 불러오기 중 예외 — ' + L.errText(e)); }

skip('저장 파일이 실제로 깨졌을 때(JSON 잘림)와 저장 위치(localStorage) 덮어쓰기는 화면 코드(src/ui/17-loop.js) 몫이라 확인 못 함');
skip('없는 장수 id가 조합법·업적 기록(ever/done)에 남아 있을 때(B-14)는 확인 못 함');
skip('불러온 판의 난수 흐름은 저장 전과 다르다(씨앗을 저장하지 않음). 같은 판이 재현되는지는 보지 않음');
L.done('t4-save');
