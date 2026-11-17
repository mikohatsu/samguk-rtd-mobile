// T6 장수 해금: 잠긴 신화·불멸이 나오지 않는지, 불멸이 다 잠겼을 때 신화로 대체되는지, 해금 후 나오는지, 협동에서 각자 목록을 쓰는지.
// 유형: Logic/Integration · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok, info, T, E } = L;
const json = (o) => JSON.parse(JSON.stringify(o));
const UL = T.unlock;
const itemUnit = {}; Object.keys(T.recipes).forEach((id) => { const r = T.recipes[id]; if (!Array.isArray(r) && r.item) itemUnit[r.item] = id; });
const tierOfItem = (it) => T.items.find((i) => i.id === it).tier;
// 상자 n개를 열어 나온 것 세기(나온 아이템은 바로 치워 "이미 가짐" 거르기가 끼지 않게)
function openMany(g, n) {
  const out = {};
  for (let i = 0; i < n; i++) { const c = g.spawnDrop(g.me, 'chest', {}); const o = g.openChest(g.me, c); const k = o.kind === 'item' ? o.item : o.kind; out[k] = (out[k] || 0) + 1; g.removeDrop(o); }
  return out;
}

// 1) 데이터: 불멸 10명 전부 + 신화 4명 잠김, 열린 신화 5명
try {
  const locked = UL.lockedIds(), imm = T.units.filter((d) => d.tier === 10).map((d) => d.id), myth = T.units.filter((d) => d.tier === 9).map((d) => d.id);
  ok(imm.every((id) => locked.includes(id)), `불멸 ${imm.length}명이 모두 잠김`);
  const mLocked = myth.filter((id) => locked.includes(id));
  ok(mLocked.length >= 3 && mLocked.length <= 5, `신화는 대략 절반 잠김 (${mLocked.join(',')})`);
  ok(UL.freeMyth.every((id) => myth.includes(id)), '처음 열린 신화 목록이 모두 실제 신화 장수');
  ok(locked.every((id) => UL.price(id) > 0) && UL.price('join') === null && UL.price('cav') === null, '잠긴 장수만 가격이 있음');
} catch (e) { ok(false, '데이터 확인 중 예외 — ' + L.errText(e)); }

// 2) 아무것도 열지 않음: 상자에서 잠긴 장수 아이템이 안 나오고, 불멸 몫은 신화(열린 장수)로 대체
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 61, unlocked: [] });
  const out = openMany(g, 600), items = Object.keys(out).filter((k) => itemUnit[k]);
  ok(items.every((it) => !g.isLocked(itemUnit[it])), `잠긴 장수의 조합 아이템이 상자에서 나오지 않음 (${JSON.stringify(out)})`);
  ok(items.every((it) => tierOfItem(it) === 9), '불멸이 모두 잠기면 불멸 몫이 신화 아이템으로 대체됨');
  ok(!out.rankUp, '열린 신화가 있으면 등급 상승권으로 넘어가지 않음 (확률은 그대로, 종류만 대체)');
  ok(g.tierIds(10).length === 0 && g.tierIds(9).length === UL.freeMyth.length, `tierIds가 잠긴 장수를 뺌 (불멸 ${g.tierIds(10).length}, 신화 ${g.tierIds(9).length})`);
  // 조합: 재료와 아이템을 다 갖춰도 잠긴 장수는 만들 수 없다
  const r = g.recipeOf('gwanu'); r.parts.forEach((x) => g.spawnUnit(g.me, x)); g.spawnDrop(g.me, 'item', { item: r.item });
  const st = g.recipeStatus(g.me, 'gwanu');
  ok(st.locked && !st.ok && g.craft(g.me, 'gwanu') === null, '잠긴 불멸(관우)은 재료가 다 있어도 조합되지 않음');
  // 신화 아이템 4개 합치기: 열린 불멸이 없으면 못 함
  ['sapa', 'cheonggang', 'hwagong', 'pyewol'].forEach((it) => g.spawnDrop(g.me, 'item', { item: it }));
  ok(!g.canFuse(g.me) && g.fuseItems(g.me) === null, '열린 불멸이 없으면 신화 아이템 합치기가 막힘');
  // 선택권으로 잠긴 장수를 고를 수 없음
  g.me.tickets[10] = 1;
  ok(g.useTicket(g.me, 10, 'jojo') === false, '선택권으로 잠긴 장수를 받을 수 없음');
  // 장수 교체권: 신화 → 다른 열린 신화만
  const u = g.spawnUnit(g.me, 'join'), d = g.spawnDrop(g.me, 'generalSwap', {});
  const n = g.useDrop(g.me, d, u);
  ok(n && n.def.tier === 9 && !g.isLocked(n.def.id), `장수 교체권 결과가 열린 신화 (${n && n.def.id})`);
} catch (e) { ok(false, '전부 잠김 확인 중 예외 — ' + L.errText(e)); }

// 3) 해금 후: 연 장수는 상자·합치기·조합에서 나온다
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 62, unlocked: ['gwanu', 'gwakga'] });
  const out = openMany(g, 600);
  ok(out.cheongryong > 0 && out.yugye > 0, `연 장수(관우·곽가)의 아이템이 상자에서 나옴 (청룡 ${out.cheongryong || 0}, 유계 ${out.yugye || 0})`);
  const imm = Object.keys(out).filter((k) => itemUnit[k] && tierOfItem(k) === 10);
  ok(imm.length === 1 && imm[0] === 'cheongryong', '불멸 아이템은 연 장수(관우) 것만 나옴');
  const r = g.recipeOf('gwanu'); r.parts.forEach((x) => g.spawnUnit(g.me, x)); g.spawnDrop(g.me, 'item', { item: r.item });
  const nu = g.craft(g.me, 'gwanu');
  ok(nu && nu.def.id === 'gwanu', '해금한 관우는 조합됨');
  const g2 = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 63, unlocked: ['gwanu'] });
  ['sapa', 'cheonggang', 'hwagong', 'pyewol'].forEach((it) => g2.spawnDrop(g2.me, 'item', { item: it }));
  const f = g2.fuseItems(g2.me);
  ok(f && f.item === 'cheongryong', `합치기 결과가 연 불멸의 아이템 (${f && f.item})`);
  // 확률은 그대로: 불멸 아이템 비율이 약 27%
  const g3 = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 64, unlocked: UL.lockedIds() });
  const o3 = openMany(g3, 2000), immN = Object.keys(o3).filter((k) => itemUnit[k] && tierOfItem(k) === 10).reduce((a, k) => a + o3[k], 0);
  ok(immN / 2000 > 0.23 && immN / 2000 < 0.31, `전부 열면 불멸 아이템 비율이 그대로(약 27%): ${(immN / 20).toFixed(1)}%`);
  // 옵션이 없으면(시험·시뮬레이터) 전부 열림
  ok(new E.Game(T, { diff: 'easy', mode: 'solo', seed: 65 }).lockedSet.size === 0, '해금 목록 없이 만든 판은 전부 열림');
} catch (e) { ok(false, '해금 후 확인 중 예외 — ' + L.errText(e)); }

// 4) 이어하기: 저장본에 해금 목록이 남는다
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 66, unlocked: ['yubi'] });
  const g2 = E.Game.restore(T, json(g.snapshot()));
  ok(JSON.stringify(g2.unlocked) === '["yubi"]' && g2.isLocked('gwanu') && !g2.isLocked('yubi'), '불러온 판도 같은 해금 목록');
} catch (e) { ok(false, '이어하기 확인 중 예외 — ' + L.errText(e)); }

// 5) 화면 provider: opt.unlocked가 없으면 theme.unlock.provider()를 쓴다
try {
  UL.provider = () => ['juyu'];
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 67 });
  UL.provider = null;
  ok(!g.isLocked('juyu') && g.isLocked('jojo'), 'provider가 준 목록으로 판이 만들어짐');
} catch (e) { UL.provider = null; ok(false, 'provider 확인 중 예외 — ' + L.errText(e)); }

// 6) 협동: 사람마다 자기 해금 목록으로 뽑는다(라인은 각자 돌림). 섞여도 판이 어긋나지 않는다.
try {
  const lists = [[], ['gwanu'], UL.lockedIds()];
  let k = 0; UL.provider = () => lists[k++];
  const P = L.makeParty({ diff: 'easy', seed: 6006, n: 3 });
  UL.provider = null;
  P.members.forEach((m, i) => ok(JSON.stringify(m.g.unlocked) === JSON.stringify(lists[i]), `협동 #${i}의 해금 목록이 자기 것 (${(m.g.unlocked || []).length}개)`));
  const o0 = openMany(P.members[0].g, 300), o1 = openMany(P.members[1].g, 300);
  ok(Object.keys(o0).every((it) => !itemUnit[it] || tierOfItem(it) === 9), '협동 #0(아무것도 안 엶)은 신화 아이템만');
  ok(Object.keys(o1).filter((it) => itemUnit[it] && tierOfItem(it) === 10).every((it) => it === 'cheongryong') && o1.cheongryong > 0, '협동 #1(관우만 엶)은 불멸 아이템이 관우 것만');
  for (let i = 0; i < 30 * 60 * 6; i++) L.stepParty(P); // 6분(라운드 몇 개)
  const rounds = P.members.map((m) => m.g.round), viol = L.partyViol(P);
  ok(rounds.every((r) => r === rounds[0]) && rounds[0] > 3, `해금 목록이 달라도 라운드가 함께 감 (${rounds.join(',')})`);
  ok(!viol.length, '협동 진행 중 이상 값 없음' + (viol.length ? ': ' + viol.slice(0, 3).join(' / ') : ''));
  P.members.forEach((m, i) => ok(m.g.units.filter((u) => u.owner === m.g.me.idx).every((u) => !m.g.isLocked(u.def.id)), `협동 #${i}의 보드에 잠긴 장수가 없음`));
} catch (e) { UL.provider = null; ok(false, '협동 확인 중 예외 — ' + L.errText(e)); }

info('잠김: ' + UL.lockedIds().join(','));
L.done('t6-unlock');
