// T9 상자 잠긴 장수 아이템(2026-11-24 사용자 결정): 상자는 아직 해금하지 않은 장수의 조합 아이템도 같은 가중치로 준다.
// 보는 것: 잠긴 아이템이 나옴, 같은 등급 아이템끼리 가중치가 같음, 등급 확률은 그대로, 해금 정보가 없으면 예전과 똑같음,
// AI 사령관(bot) 판은 예전 규칙(열린 것만), 잠긴 아이템이 다른 아이템·조합을 막지 않음, 합치기 재료로는 쓰임, 저장·사람 협동.
// 유형: Logic/Integration · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok, info, T, E, NET } = L;
const json = (o) => JSON.parse(JSON.stringify(o));
const UL = T.unlock;
const itemUnit = {}; Object.keys(T.recipes).forEach((id) => { const r = T.recipes[id]; if (!Array.isArray(r) && r.item) itemUnit[r.item] = id; });
const tierOfItem = (it) => T.items.find((i) => i.id === it).tier;
const STARTER = ['join', 'jangbi']; // 첫 신화 2명만 연 계정(무과금 기본)
// 상자 n개를 열어 나온 것 세기(나온 아이템은 바로 치워 "이미 가짐" 거르기가 끼지 않게). seq = 나온 순서
function openMany(g, n, seq) {
  const out = {};
  for (let i = 0; i < n; i++) {
    const c = g.spawnDrop(g.me, 'chest', {}), o = g.openChest(g.me, c), k = o.kind === 'item' ? o.item : o.kind;
    out[k] = (out[k] || 0) + 1; if (seq) seq.push(k); g.removeDrop(o);
  }
  return out;
}

// 1) 첫 신화 2명만: 잠긴 장수 아이템이 나오고, 같은 등급 안에서 열린·잠긴 아이템의 몫이 같다
try {
  const N = 12000, g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 91, unlocked: STARTER });
  const out = openMany(g, N);
  const myth = T.items.filter((i) => i.tier === 9 && itemUnit[i.id]).map((i) => i.id), imm = T.items.filter((i) => i.tier === 10 && itemUnit[i.id]).map((i) => i.id);
  const openMyth = myth.filter((it) => g.itemOpen(it)), lockMyth = myth.filter((it) => !g.itemOpen(it));
  ok(openMyth.length === 2 && lockMyth.length === myth.length - 2, `신화 아이템 열린 ${openMyth.length} / 잠긴 ${lockMyth.length}`);
  ok(lockMyth.every((it) => out[it] > 0) && imm.every((it) => out[it] > 0), '잠긴 신화·불멸 장수의 아이템이 모두 상자에서 나옴');
  const avg = (a) => a.reduce((s, it) => s + (out[it] || 0), 0) / a.length;
  const ratio = avg(lockMyth) / avg(openMyth);
  ok(ratio > 0.85 && ratio < 1.15, `같은 등급 안에서 잠긴 아이템 하나의 몫 = 열린 아이템 하나의 몫 (잠긴/열린 ${ratio.toFixed(2)})`);
  const cnt = imm.map((it) => out[it]), mn = Math.min(...cnt), mx = Math.max(...cnt);
  ok(mx / mn < 1.4, `불멸 아이템(전부 잠김)끼리도 고르게 나옴 (최소 ${mn}, 최대 ${mx})`);
  // 등급 확률은 그대로(전부 연 판과 같은 비율)
  const immShare = imm.reduce((s, it) => s + out[it], 0) / N;
  const gAll = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 92, unlocked: UL.lockedIds() }), oAll = openMany(gAll, N);
  const immAll = imm.reduce((s, it) => s + (oAll[it] || 0), 0) / N;
  ok(Math.abs(immShare - immAll) < 0.03, `불멸 아이템 비율이 해금 수와 무관 (첫 신화만 ${(immShare * 100).toFixed(1)}%, 전부 ${(immAll * 100).toFixed(1)}%)`);
  ok(!out.rankUp, '아이템 줄에서 등급 상승권으로 새지 않음');
} catch (e) { ok(false, '가중치 확인 중 예외 — ' + L.errText(e)); }

// 2) 해금 정보가 없으면(시험·시뮬레이터·옛 저장) 예전과 똑같다: 전부 연 판과 같은 씨앗이면 같은 순서로 나온다
try {
  const a = [], b = [];
  openMany(new E.Game(T, { diff: 'easy', mode: 'solo', seed: 93 }), 400, a);
  openMany(new E.Game(T, { diff: 'easy', mode: 'solo', seed: 93, unlocked: UL.lockedIds() }), 400, b);
  ok(JSON.stringify(a) === JSON.stringify(b), '해금 정보 없음 = 전부 엶과 같은 결과(규칙 변경 영향 없음)');
} catch (e) { ok(false, '해금 정보 없음 확인 중 예외 — ' + L.errText(e)); }

// 3) AI 사령관 판은 예전 규칙: 열린 장수 아이템만(쓸 수 없는 아이템으로 AI 동맹이 약해지지 않게)
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 94, bot: true, unlocked: STARTER });
  const out = openMany(g, 600), items = Object.keys(out).filter((k) => itemUnit[k]);
  ok(items.length > 0 && items.every((it) => g.itemOpen(it)), `AI 사령관 판은 잠긴 장수 아이템이 안 나옴 (${items.join(',')})`);
} catch (e) { ok(false, 'AI 사령관 확인 중 예외 — ' + L.errText(e)); }

// 4) 잠긴 아이템은 아무것도 막지 않는다
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 95, unlocked: ['gwanu'].concat(STARTER) });
  // 잠긴 장수 조합은 여전히 안 됨(재료·아이템을 다 갖춰도)
  const r = g.recipeOf('jojo'); r.parts.forEach((x) => g.spawnUnit(g.me, x)); const li = g.spawnDrop(g.me, 'item', { item: r.item });
  ok(!g.itemOpen(r.item) && g.craft(g.me, 'jojo') === null, '잠긴 장수(조조)는 아이템을 들고 있어도 조합되지 않음');
  // 같은 아이템은 다시 안 나오지만(하나만 갖는 규칙), 다른 아이템은 계속 나온다
  const out = openMany(g, 300);
  ok(!out[r.item] && Object.keys(out).some((k) => itemUnit[k]), '들고 있는 잠긴 아이템만 빠지고 다른 아이템은 계속 나옴');
  // 열린 장수(관우) 조합은 잠긴 아이템과 무관하게 됨
  const rg = g.recipeOf('gwanu'); rg.parts.forEach((x) => g.spawnUnit(g.me, x)); g.spawnDrop(g.me, 'item', { item: rg.item });
  ok(g.recipeStatus(g.me, 'gwanu').ok && g.craft(g.me, 'gwanu'), '잠긴 아이템을 들고 있어도 열린 장수 조합은 됨');
  g.removeDrop(li);
  // 잠긴 신화 아이템 4개 → 열린 불멸 아이템으로 합치기(쓸 곳이 있다). 관우는 이미 조합해 usedItems라 다른 불멸이 열려 있어야 함
  const g2 = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 96, unlocked: ['gwanu'] });
  const lm = T.items.filter((i) => i.tier === 9 && itemUnit[i.id] && !g2.itemOpen(i.id)).slice(0, 4).map((i) => i.id);
  lm.forEach((it) => g2.spawnDrop(g2.me, 'item', { item: it }));
  const f = g2.fuseItems(g2.me);
  ok(lm.length === 4 && f && f.item === 'cheongryong', `잠긴 신화 아이템 4개도 합치기 재료가 됨 → ${f && f.item}`);
  // 모든 아이템을 들고 있으면 예전처럼 등급 상승권
  const g3 = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 97, unlocked: [] });
  T.items.forEach((i) => g3.spawnDrop(g3.me, 'item', { item: i.id }));
  const o3 = openMany(g3, 50);
  ok(Object.keys(o3).every((k) => !itemUnit[k]) && o3.rankUp > 0, '아이템을 다 들고 있으면 등급 상승권(잠긴 아이템도 "가짐"으로 셈)');
} catch (e) { ok(false, '막힘 확인 중 예외 — ' + L.errText(e)); }

// 5) 이어하기: 필드의 잠긴 아이템과 해금 목록이 저장본에 남는다
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 98, unlocked: STARTER });
  g.spawnDrop(g.me, 'item', { item: g.recipeOf('jojo').item });
  const g2 = E.Game.restore(T, json(g.snapshot()));
  const d = g2.drops.find((x) => x.kind === 'item');
  ok(d && d.item === g.recipeOf('jojo').item && !g2.itemOpen(d.item), '불러온 판에도 잠긴 아이템이 잠긴 채로 남음');
} catch (e) { ok(false, '이어하기 확인 중 예외 — ' + L.errText(e)); }

// 6) 사람 협동 판(bot 아님): 각자 자기 해금 목록으로 새 규칙
try {
  const hub = NET.hub(), na = hub.join('A'), nb = hub.join('B');
  const ga = new E.Game(T, { diff: 'easy', mode: 'multi', seed: 99, net: na, unlocked: [] }); na.attach(ga);
  const gb = new E.Game(T, { diff: 'easy', mode: 'multi', seed: 100, net: nb, unlocked: UL.lockedIds() }); nb.attach(gb);
  const oa = openMany(ga, 400), ob = openMany(gb, 400);
  ok(Object.keys(oa).some((k) => itemUnit[k] && !ga.itemOpen(k)), '협동 A(아무것도 안 엶)도 잠긴 장수 아이템을 받음');
  ok(Object.keys(ob).every((k) => !itemUnit[k] || gb.itemOpen(k)), '협동 B(전부 엶)는 전부 열린 아이템');
} catch (e) { ok(false, '사람 협동 확인 중 예외 — ' + L.errText(e)); }

info('잠김: ' + UL.lockedIds().length + '명');
L.done('t9-chest-locked');
