// T12 보스 처치 연출 동안 라인 정지(2026-11-25 실기 소감 「보스 처치 모션이 끝나기 전에 뒤에서 라인이 돈다」).
// 보스를 이긴 뒤 KILL_HOLD(4.3초) 동안 적 생성·이동·라운드 시간·유닛 공격이 멈추고, 그 뒤 다시 흐르는지. 협동은 모두가 같이 멈추는지.
// 유형: Integration · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok, info } = L;
const HOLD = 4.3, CHECK = 4.0; // 연출 4.3초 중 4.0초 동안(걸음 오차 여유) 멈춰 있어야 한다
const laneSig = (g) => ({ roundT: g.roundT, spawned: g.spawned, en: g.enemies.map((e) => `${e.id}:${Math.round(e.x)},${Math.round(e.y)},${Math.round(e.hp)}`).join('|'), hits: new Map(g.units.map((u) => [u.id, u.hits || 0])) });
// 유닛 공격: 두 때 다 있는 유닛의 명중 수가 늘지 않았나(시험 AI가 합성해 유닛이 빠지는 것은 라인 진행이 아니다)
const noHit = (old, now) => [...now.hits].every(([id, n]) => !old.hits.has(id) || n <= old.hits.get(id));
const same = (old, now) => old.roundT === now.roundT && old.spawned === now.spawned && old.en === now.en && noHit(old, now);

// ---- 1) 혼자: 첫 보스 처치 직후 lane이 멈췄다가 4.3초 뒤 다시 흐른다 ----
{
  let at = -1, sig0 = null, prevBoss = false, frozenOk = true, resumed = false, round = 0, why = '';
  const r = L.runSolo({
    diff: 'easy', seed: 12001,
    each(st, step) {
      const g = st.g;
      if (at < 0) {
        const won = prevBoss && g.phase === 'wave' && g.stats.bosses.length && g.stats.bosses[g.stats.bosses.length - 1].win;
        prevBoss = g.phase === 'boss';
        if (won) { at = step; sig0 = laneSig(g); round = g.round; }
        return;
      }
      const el = (step - at) * L.DT;
      // 시험 쪽 AI가 사고·합성할 수는 있다(화면에서는 연출 동안 입력을 막는다). 라인 진행만 본다
      if (el <= CHECK) { const s = laneSig(g); if (!same(sig0, s)) { frozenOk = false; why = why || `${el.toFixed(2)}초: roundT ${sig0.roundT.toFixed(2)}→${s.roundT.toFixed(2)}, 생성 ${sig0.spawned}→${s.spawned}`; } return; }
      if (el >= HOLD + 1) { resumed = g.roundT > sig0.roundT + 0.5 && g.round === round; return 'stop'; }
    },
  });
  ok(!r.error, '혼자: 예외 없음' + (r.error ? ' — ' + r.error : ''));
  ok(at >= 0, `혼자: 보스를 이김(R${round})`);
  ok(at >= 0 && frozenOk, `혼자: 처치 뒤 ${CHECK}초 동안 라운드 시간·적 생성·적 이동·유닛 공격이 멈춤` + (why ? ' — ' + why : ''));
  ok(resumed, '혼자: 연출 시간이 지나면 라인이 다시 흐름');
}

// ---- 2) 협동 3인(가상 방): 각자 bossEnd를 받은 순간부터 모두 같이 멈추고, 라운드가 어긋나지 않는다 ----
{
  const n = 3, st = [];
  let fail = '', done = false;
  const r = L.runParty({
    n, diff: 'easy', seed: 12003,
    each(P, step) {
      P.members.forEach((m, i) => {
        const g = m.g, s = st[i] || (st[i] = { prevBoss: false, at: -1, sig: null, frozen: true, resumed: false });
        if (s.at < 0) {
          if (s.prevBoss && g.phase === 'wave' && !g.over) { s.at = step; s.sig = laneSig(g); s.round = g.round; }
          s.prevBoss = g.phase === 'boss';
          return;
        }
        const el = (step - s.at) * L.DT;
        if (el <= CHECK) { if (!same(s.sig, laneSig(g))) { s.frozen = false; fail = fail || `#${i} ${el.toFixed(2)}초에 라인이 움직임(roundT ${s.sig.roundT.toFixed(2)}→${g.roundT.toFixed(2)})`; } }
        else if (el >= HOLD + 1 && s.resumed === false) s.resumed = g.roundT > s.sig.roundT + 0.5;
      });
      if (st.length === n && st.every((s) => s.at >= 0 && (step - s.at) * L.DT >= HOLD + 1.1)) { done = true; return 'stop'; }
    },
  });
  ok(!r.error, '협동: 예외 없음' + (r.error ? ' — ' + r.error : ''));
  ok(done, `협동: ${n}명 모두 보스를 이기고 라인으로 돌아옴`);
  ok(done && st.every((s) => s.frozen), `협동: 모두 처치 뒤 ${CHECK}초 동안 라인이 멈춤` + (fail ? ' — ' + fail : ''));
  ok(done && st.every((s) => s.resumed), '협동: 모두 연출 뒤 다시 흐름');
  if (done) {
    const gs = r.P.members.map((m) => m.g);
    ok(new Set(gs.map((g) => g.round)).size === 1, `협동: 라운드가 같음 [${gs.map((g) => g.round).join(',')}]`);
    const rt = gs.map((g) => g.roundT), gap = Math.max(...rt) - Math.min(...rt);
    ok(gap < 0.5, `협동: 라운드 시간 차이 ${gap.toFixed(2)}초 (0.5 미만)`);
    info(`처치 시점(걸음): ${st.map((s) => s.at).join(', ')}`);
  }
}
L.done('t12-kill-hold');
