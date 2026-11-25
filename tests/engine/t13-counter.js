// T13 보스 반격(돌진 반격 창) 그로기 규칙(2026-11-26 사용자 결정):
//   「5명이 끝까지 뒤에서 때리면 절대 그로기 못 하게. 몇 대는 뒤에서 때려도 되는데 절반 정도는 앞에서 2배로 때려야 그로기」
//   → 정면 한 대 = R.ctrFront(2), 뒤·옆 한 대 = 1, 뒤·옆 몫은 게이지의 R.ctrBackCap(50%)까지만(raid.js addCounter).
// 1) 혼자: 뒤에서만 → 50%에서 멈춤·그로기 없음 / 정면만 → 2배로 쌓여 그로기
// 2) 가상 방 5인: 손님 넷 + 방장이 뒤에서만 → 방장 게이지 50%에서 멈춤·그로기 없음, 그 뒤 두 명이 정면으로 → 그로기(모두에게 동기화)
// 3) 동기화 값(raidWire→raidApply)에 뒤·옆 몫이 실려 방장이 바뀌어도 상한이 이어짐
// 유형: Integration · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok, info } = L;
const R = L.T.rules, FRONT = R.ctrFront || 2, CAP = R.ctrBackCap != null ? R.ctrBackCap : 0.5;
const near = (a, b) => Math.abs(a - b) < 1e-6;
// 보스 정면(face 방향)·뒤로 r만큼 떨어진 자리
const spot = (b, face, r, back) => [b.x + Math.cos(face) * r * (back ? -1 : 1), b.y + Math.sin(face) * r * (back ? -1 : 1)];
const openCounter = (g) => {
  const f = g.fight, M = f.mech;
  M.ctr = 3; M.ctrGot = 0; M.ctrBack = 0; M.ctrNeed = 4 + 2 * g.party; M.face = 0; M.ctrGo = null; M.gr = 0; f.boss.charge = null;
};

// ---- 1) 혼자 ----
{
  L.seedRandom(13001);
  const g = new L.E.Game(L.T, { diff: 'normal', mode: 'solo', seed: 13001, bot: true });
  ['jeonwi', 'munang'].forEach((id) => g.spawnUnit(g.me, id, undefined, undefined, true));
  g.round = 25; g.startBoss(L.T.bosses.find((b) => b.round === 25)); g.phase = 'bossPick'; g.confirmPick([]);
  const f = g.fight, M = f.mech, b = f.boss, c = f.champs[0];
  b.hp = b.mhp = 1e12;
  // 뒤에서만: 필요량의 3배만큼 때린다
  openCounter(g);
  const need = M.ctrNeed;
  [c.x, c.y] = spot(b, M.face, 120, true);
  for (let i = 0; i < need * 3; i++) g.damageBoss(10, c);
  ok(M.gr === 0 && M.ctr > 0, `혼자: 뒤에서 ${need * 3}대(옛 규칙이면 그로기 ${need}대) → 그로기 안 됨 (게이지 ${(M.ctrGot / need * 100).toFixed(0)}%)`);
  ok(near(M.ctrGot / need, CAP) && near(M.ctrBack, need * CAP), `혼자: 뒤·옆 몫이 게이지 ${CAP * 100}%에서 멈춤`);
  // 이어서 정면: 남은 절반을 정면 ×${FRONT}로 채우면 그로기
  [c.x, c.y] = spot(b, M.face, 120, false);
  const left = Math.ceil((need * (1 - CAP)) / FRONT);
  for (let i = 0; i < left - 1; i++) g.damageBoss(10, c);
  ok(M.gr === 0 && M.ctr > 0, `혼자: 정면 ${left - 1}대까지는 아직(게이지 ${(M.ctrGot / need * 100).toFixed(0)}%)`);
  g.damageBoss(10, c);
  ok(M.gr > 0 && M.ctr === 0, `혼자: 정면 ${left}대째(×${FRONT})에 그로기`);
  // 정면만: need/FRONT 대면 그로기
  openCounter(g);
  for (let i = 0; i < Math.ceil(need / FRONT); i++) g.damageBoss(10, c);
  ok(M.gr > 0, `혼자: 정면만 ${Math.ceil(need / FRONT)}대(×${FRONT})로 그로기`);
  // 동기화 값: 다른 게임이 받아 뒤·옆 몫을 그대로 안다(방장이 바뀌어도 상한이 이어진다)
  openCounter(g);
  [c.x, c.y] = spot(b, M.face, 120, true);
  for (let i = 0; i < need; i++) g.damageBoss(10, c);
  const w = JSON.parse(JSON.stringify(g.raidWire()));
  const g2 = new L.E.Game(L.T, { diff: 'normal', mode: 'solo', seed: 13002, bot: true });
  ['jeonwi'].forEach((id) => g2.spawnUnit(g2.me, id, undefined, undefined, true));
  g2.round = 25; g2.startBoss(L.T.bosses.find((x) => x.round === 25));
  g2.raidApply(w);
  ok(near(g2.fight.mech.ctrBack, M.ctrBack) && near(g2.fight.mech.ctrGot, M.ctrGot), `동기화: 뒤·옆 몫(cq)이 실려 받는 쪽도 ${g2.fight.mech.ctrBack}/${g2.fight.mech.ctrNeed}`);
  // 받은 게임이 방장이 되어 뒤에서 더 때려도 상한을 넘지 않는다
  g2.fight.boss.hp = g2.fight.boss.mhp = 1e12; g2.phase = 'boss';
  const c2 = { def: g2.defs.jeonwi, x: 0, y: 0, owner: 0 };
  [c2.x, c2.y] = spot(g2.fight.boss, g2.fight.mech.face, 120, true);
  for (let i = 0; i < need; i++) g2.damageBoss(10, c2);
  ok(g2.fight.mech.gr === 0 && near(g2.fight.mech.ctrBack, need * CAP), '동기화: 이어받은 쪽도 뒤·옆 몫 상한 유지');
}

// ---- 2) 가상 방 5인: 손님이 보낸 뒤·옆 몫에도 상한, 정면 둘이 합류하면 그로기 ----
{
  const n = 5;
  let stage = 0, t0 = 0, need = 0, backOk = null, backPct = 0, sentBack = 0, groggy = false, guestSaw = false, why = '';
  const r = L.runParty({
    n, diff: 'easy', seed: 13005,
    each(P, step) {
      const host = L.hostOf(P), hg = host && host.g;
      if (!hg) return;
      const live = P.members.filter((m) => m.active);
      if (stage === 0) {
        if (hg.round >= 10 && hg.phase === 'boss' && hg.fight && hg.fight.t > 1 && live.every((m) => m.g.phase === 'boss' && m.g.fight)) {
          const f = hg.fight; f.boss.hp = f.boss.mhp = 1e12; f.mech.q.length = 0; f.hazards.length = 0;
          openCounter(hg); need = f.mech.ctrNeed; stage = 1; t0 = step;
        }
        if (hg.round > 10 || hg.over) { why = '10라운드 보스전에 못 감'; return 'stop'; }
        return;
      }
      const hf = hg.fight;
      if (!hf) { why = '보스전이 끝남(stage ' + stage + ')'; return 'stop'; }
      const M = hf.mech, b = hf.boss, el = step - t0;
      if (stage === 1 || stage === 2) M.ctr = 3; // 창이 닫히지 않게(돌진은 하지 않는다: ctrGo 없음)
      // 모두의 장수를 자리에 세우고 직접 때린다(damageBoss → 손님이면 pendCtr/pendCtrB → 0.25초마다 dmg 메시지)
      live.forEach((m, i) => {
        const g = m.g, gf = g.fight; if (!gf) return;
        const front = stage === 2 && i < 2;
        g.localChamps().forEach((c) => {
          if (c.dead) return;
          [c.x, c.y] = spot(b, M.face, 110, !front); c.move = false; c.ai = false; c.tx = c.x; c.ty = c.y;
          // 1단계는 손님만 친다(방장 장수는 공격을 묶는다): 게이지가 차면 손님 dmg 메시지의 뒤·옆 몫(cb)이 방장에게 닿아 상한에 걸린 것이다
          if (stage === 1 && m === host) { c.cd = 9; return; }
          if (el % 3 === 0) { g.damageBoss(1, c); if (!front) sentBack++; }
        });
      });
      if (stage === 1 && el >= 90) { // 3초: 뒤에서만 친 양이 필요량의 몇 배가 된 뒤
        backPct = M.ctrGot / need; backOk = M.gr === 0 && near(M.ctrBack, need * CAP) && near(backPct, CAP);
        stage = 2; t0 = step;
      } else if (stage === 2) {
        if (M.gr > 0) { groggy = true; }
        if (groggy) guestSaw = live.filter((m) => m !== host).every((m) => m.g.fight && m.g.fight.mech.gr > 0);
        if (guestSaw || el >= 90) return 'stop';
      }
    },
  });
  ok(!r.error, '협동: 예외 없음' + (r.error ? ' — ' + r.error : ''));
  ok(stage >= 1, `협동 ${n}인: 10라운드 보스전에서 반격 창을 엶` + (why ? ' — ' + why : ''));
  info(`협동: 필요 ${need}, 손님이 뒤에서 직접 친 횟수 ${sentBack}(옛 규칙이면 필요량의 ${(sentBack / Math.max(1, need)).toFixed(1)}배)`);
  ok(backOk === true, `협동 ${n}인: 손님 넷이 뒤에서만 3초 → 그로기 안 됨, 게이지 ${(backPct * 100).toFixed(0)}%(상한 ${CAP * 100}%)`);
  ok(groggy, `협동 ${n}인: 그 뒤 두 명이 정면으로 → 그로기`);
  ok(guestSaw, `협동 ${n}인: 손님 화면에도 그로기가 동기화됨`);
}
L.done('t13-counter');
