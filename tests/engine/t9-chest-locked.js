// T9 상자 잠긴 장수 아이템(2026-11-24 사용자 결정, 같은 날 2차: 가진 장수의 아이템 비중을 늘림): 등급을 정한 뒤 70%는 해금한 장수 몫, 30%는 잠긴 장수 아이템.
// 보는 것: 해금 0명·첫 신화 2명·전부 해금의 분포, 해금 정보가 없으면 예전과 똑같음,
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

// 1) 분포(2026-11-24 2차 결정): 등급을 정한 뒤 70%는 해금한 장수 몫(v0.3.7 규칙: 그 등급 → 한 등급 아래 → 아무거나 → 등급 상승권), 30%는 잠긴 장수 아이템
const SH = UL.chestOpenShare;
function dist(unlocked, seed, N) {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed, unlocked }), out = openMany(g, N), r = { open9: 0, open10: 0, lock9: 0, lock10: 0, rankUp: 0, other: 0 };
  Object.keys(out).forEach((k) => {
    if (k === 'rankUp') r.rankUp += out[k];
    else if (itemUnit[k]) r[(g.itemOpen(k) ? 'open' : 'lock') + tierOfItem(k)] += out[k];
    else r.other += out[k];
  });
  Object.keys(r).forEach((k) => (r[k] /= N));
  r.text = ['open9', 'open10', 'lock9', 'lock10', 'rankUp'].map((k) => `${k} ${(r[k] * 100).toFixed(1)}%`).join(', ');
  return { g, out, r };
}
const near = (a, b) => Math.abs(a - b) < 0.02; // N=12000에서 표준오차 약 0.4%p
try {
  ok(SH === 0.7, `해금 몫 상수 theme.unlock.chestOpenShare = ${SH}`);
  const N = 12000;
  // 해금 0명: 70% 몫은 등급 상승권(첫 판 보호), 30%는 잠긴 아이템(신화 21.9% · 불멸 8.1%)
  const z = dist([], 91, N).r;
  ok(near(z.rankUp, SH) && near(z.lock9, 0.73 * (1 - SH)) && near(z.lock10, 0.27 * (1 - SH)) && z.open9 + z.open10 === 0, `해금 0명: ${z.text}`);
  // 첫 신화 2명: 신화 몫 70%는 그 2명 아이템, 불멸 몫 70%는 한 등급 아래(열린 신화)로 → 쓸 수 있는 아이템 70%
  const s = dist(STARTER, 92, N), sr = s.r;
  ok(near(sr.open9, SH) && sr.open10 === 0 && near(sr.lock9, 0.73 * (1 - SH)) && near(sr.lock10, 0.27 * (1 - SH)) && sr.rankUp === 0, `첫 신화 2명: ${sr.text}`);
  const myth = T.items.filter((i) => i.tier === 9).map((i) => i.id), imm = T.items.filter((i) => i.tier === 10).map((i) => i.id);
  const lockMyth = myth.filter((it) => !s.g.itemOpen(it));
  ok(lockMyth.every((it) => s.out[it] > 0) && imm.every((it) => s.out[it] > 0), '잠긴 신화·불멸 장수의 아이템도 모두 나옴(비중만 줄어듦)');
  const cnt = imm.map((it) => s.out[it]), mn = Math.min(...cnt), mx = Math.max(...cnt);
  ok(mx / mn < 1.6, `잠긴 불멸 아이템끼리는 고르게 나옴 (최소 ${mn}, 최대 ${mx})`);
  // 첫 신화 2 + 불멸 1(관우): 불멸 몫 70%는 청룡
  const g1 = dist(STARTER.concat(['gwanu']), 93, N).r;
  ok(near(g1.open10, 0.27 * SH) && near(g1.open9, 0.73 * SH) && g1.rankUp === 0, `첫 신화 2 + 관우: ${g1.text}`);
  // 전부 해금: 잠긴 것이 없으니 100% 해금한 장수 아이템, 등급 확률 73/27 그대로
  const a = dist(UL.lockedIds(), 94, N).r;
  ok(near(a.open9, 0.73) && near(a.open10, 0.27) && a.lock9 + a.lock10 + a.rankUp === 0, `전부 해금: ${a.text}`);
} catch (e) { ok(false, '분포 확인 중 예외 — ' + L.errText(e)); }

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
