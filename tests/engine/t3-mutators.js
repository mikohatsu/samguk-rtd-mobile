// T3 변형 규칙: 악몽 2인 + 규칙 하나씩, 그리고 5개 묶음 3가지.
// 유형: Logic · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const STOP = 60; // 3분 안에 끝내려고 60라운드에 닿으면 멈춘다
const { ok, skip, info, T, E } = L;

const muts = T.mutators || [];
// 규칙을 못 찾으면 0판을 돌리고 통과해 버린다. 그건 실패다.
if (!ok(muts.length > 0, `변형 규칙 ${muts.length}개를 찾음`)) { L.done('t3-mutators'); return; }

// 서로 배제(excl): 배수진+군웅할거는 R15~23 라인에서 거의 무조건 진다(production/team/2026-11-24/sim-difficulty.md 2-6). 뽑기(19-title rollMuts)가 excl을 본다.
const byId = (id) => muts.find((m) => m.id === id);
ok(muts.every((m) => (m.excl || []).every((x) => byId(x) && x !== m.id)), '변형 배제 목록(excl)이 있는 규칙만 가리킴');
ok(((byId('laststand') || {}).excl || []).includes('warlords') || ((byId('warlords') || {}).excl || []).includes('laststand'), '배수진과 군웅할거는 서로 배제');

const base = JSON.stringify(new E.Game(T, { diff: 'nightmare', mode: 'solo', seed: 1 }).mut);
let ran = 0;
const noBoss = [], stopped = [];
function one(ids, seed, label) {
  const r = L.runParty({ n: 2, diff: 'nightmare', seed, muts: ids, stopRound: STOP }), tag = `규칙 ${label}`;
  if (r.error || !r.P) { ok(false, `${tag}: 예외 — ${r.error}`); return; }
  ran++;
  const gs = r.P.members.map((m) => m.g), g = gs[0], v = L.partyViol(r.P);
  const applied = gs.every((x) => x.muts.length === ids.length) && JSON.stringify(g.mut) !== base;
  const fine = applied && (r.stopped || gs.every((x) => x.over)) && !r.capped && !r.stalled && v.length === 0 && new Set(gs.map((x) => x.over)).size === 1;
  ok(fine, `${tag}: 적용 ${applied ? '됨' : '안 됨'}, over=[${gs.map((x) => x.over || '-').join(',')}]${r.stopped ? ` (R${STOP}에서 멈춤)` : ''} R${g.round} 보스전 ${L.bossLog(g)} ${r.ms}ms`
    + (r.stalled ? ' — 멈춤' : '') + (r.capped ? ' — 걸음 수 한도' : '') + (v.length ? ' — ' + v.join(' ; ') : ''));
  if (!g.stats.bosses.length) noBoss.push(label);
  if (r.stopped) stopped.push(label);
}
muts.forEach((m, i) => one([m.id], 3000 + i, `${m.id}(${m.name})`));

// 5개 묶음: 씨앗으로 고른 3가지
const rand = (() => { let a = 12345; return () => (a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
if (muts.length >= 5) {
  for (let k = 0; k < 3; k++) {
    const pool = muts.map((m) => m.id), ids = [];
    while (ids.length < 5) ids.push(pool.splice((rand() * pool.length) | 0, 1)[0]);
    one(ids, 3100 + k, `묶음 ${ids.join('+')}`);
  }
} else ok(false, `규칙이 ${muts.length}개뿐이라 5개 묶음을 못 만듦`);

ok(ran === muts.length + 3, `규칙 판 ${ran}/${muts.length + 3}개를 실제로 돌림`);
if (noBoss.length) skip(`보스전에 닿지 못한 판: ${noBoss.join(', ')} — 이 규칙들의 보스전 쪽 효과는 확인 못 함`);
if (stopped.length) skip(`R${STOP}에서 멈춘 판(그 뒤 라운드·보스는 확인 못 함): ${stopped.join(', ')}`);
skip('AI가 악몽에서는 대개 10~55라운드에서 진다. 규칙의 후반 효과(보스 토벌 보상, 정예 적 누적 등)는 확인 못 함');
skip('규칙 효과의 수치가 설계와 맞는지는 보지 않음(판이 돌고 불변식이 지켜지는지만 봄)');
L.done('t3-mutators');
