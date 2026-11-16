// T5 보스전 중 방장 교체(QA B-01): 페이즈가 지난 뒤 방장을 명단에서 빼고, 남은 사람들의 보스전이 제대로 끝나는지.
// 유형: Integration · 위치: tests/engine/ · 게이트: BLOCKING ([B-01] 줄은 고치기 전까지 실패가 정상)
'use strict';
const L = require('./lib');
const { ok, skip, info } = L;

const SCEN = [
  { id: 'idle', name: '페이즈가 지난 뒤(기믹 없음)', cond: (M) => M.ph >= 1 && !M.busy && !M.cast && !M.hide, need: true },
  { id: 'busy', name: '기믹·시전 진행 중(시작 1초 뒤)', cond: (M) => M.ph >= 1 && ((M.busy && M.busy.t >= 1) || (M.cast && M.cast.t >= 1)), need: true },
  { id: 'hide', name: '보스가 숨은 중', cond: (M) => !!M.hide && !!M.busy && M.busy.t >= 1, need: false },
];
SCEN.forEach((sc, k) => {
  let sw = null, endAt = -1;
  const r = L.runParty({
    n: 3, diff: 'easy', seed: 5100 + k,
    each(P, step) {
      if (!sw) {
        const h = L.hostOf(P), f = h && h.g.fight;
        if (!f || h.g.phase !== 'boss' || !sc.cond(f.mech)) return;
        const M = f.mech;
        sw = { boss: f.def.name, round: h.g.round, phases: (f.def.phases || []).length, hostPh: M.ph, hp: Math.round((f.boss.hp / f.boss.mhp) * 100), t: f.t, limit: f.limit, state: `busy=${M.busy ? M.busy.k : '-'} cast=${M.cast ? M.cast.n : '-'} hide=${!!M.hide} objs=${M.objs.length}` };
        L.removeHost(P);
        sw.nh = L.hostOf(P);
        const nf = sw.nh && sw.nh.g.fight;
        sw.newPh = nf ? nf.mech.ph : null; sw.maxPh = sw.newPh; sw.authority = !!(sw.nh && sw.nh.g.isAuthority); sw.maxT = 0;
        return;
      }
      const g = sw.nh.g;
      if (endAt < 0) {
        if (g.fight && g.round === sw.round && !g.over) { sw.maxPh = Math.max(sw.maxPh, g.fight.mech.ph); sw.maxT = Math.max(sw.maxT, g.fight.t); sw.lastHide = !!g.fight.mech.hide; sw.lastHp = Math.round((g.fight.boss.hp / g.fight.boss.mhp) * 100); }
        else { endAt = step; sw.result = g.over === 'lose' ? '패배' : '승리'; }
      } else if (step - endAt >= 90) return 'stop';
    },
  });
  const tag = `[${sc.id}] ${sc.name}`;
  ok(!r.error, `${tag}: 예외 없음` + (r.error ? ' — ' + r.error : ''));
  if (!sw) {
    // 조건을 못 만들었으면 아무것도 확인하지 못한 것이다
    if (sc.need) ok(false, `${tag}: 시험이 이 상황을 만들지 못함(한 판 내내 조건이 안 옴) — 아무것도 확인 못 함`);
    else skip(`${tag}: 쉬움 3인 한 판(R${r.P ? r.P.members[0].g.round : '?'}까지)에서 보스가 숨는 순간이 없었음. 등애(110라운드, 악몽 전용)는 AI가 닿지 못해 B-01의 "숨은 채 안 나옴"은 확인 못 함`);
    return;
  }
  info(`${tag}: R${sw.round} ${sw.boss} 체력 ${sw.hp}% t=${sw.t.toFixed(1)}/${sw.limit}s 에서 방장을 뺌. 방장 페이즈 ${sw.hostPh}/${sw.phases}, ${sw.state}`);
  ok(sw.authority, `${tag}: 남은 사람 중 한 명이 새 방장이 됨`);
  ok(sw.newPh !== null && sw.newPh >= sw.hostPh, `[B-01] ${tag}: 새 방장이 지난 페이즈 수를 이어받음 (옛 방장 ${sw.hostPh}, 새 방장 ${sw.newPh})`);
  const started = sw.maxPh - sw.newPh, left = sw.phases - sw.hostPh;
  ok(started <= left, `[B-01] ${tag}: 지난 페이즈가 다시 나오지 않음 (교체 뒤 새로 시작한 페이즈 ${started}개, 남아 있던 페이즈 ${left}개)`);
  ok(endAt >= 0 && !r.stalled && !r.capped, `${tag}: 보스전이 승패로 끝남` + (endAt >= 0 ? ` (${sw.result}, 보스전 시간 ${sw.maxT.toFixed(0)}/${sw.limit}s)` : ` — 안 끝남 (체력 ${sw.lastHp}%, 숨음=${sw.lastHide}, t=${sw.maxT.toFixed(0)})`));
  ok(sw.maxT <= sw.limit + 1, `${tag}: 제한 시간을 넘겨 계속되지 않음 (${sw.maxT.toFixed(1)}/${sw.limit}s)`);
  const rest = r.P.members.filter((m) => m.active).map((m) => m.g);
  ok(rest.length === 2 && new Set(rest.map((g) => g.round + '|' + g.over + '|' + g.phase)).size === 1, `${tag}: 남은 ${rest.length}명의 상태가 같음 [${rest.map((g) => `R${g.round} ${g.phase} ${g.over || '-'}`).join(' / ')}]`);
  const v = L.partyViol(r.P);
  ok(v.length === 0, `${tag}: 불변식` + (v.length ? ' — ' + v.join(' ; ') : ' 통과'));
});

skip('방장을 즉시 명단에서 빼는 흉내다. 실제 서버의 5~10초 지연, 60초 안 복귀(B-02), 재접속은 확인 못 함');
skip('남은 오브젝트(분신·돌기둥·제단) 정리와 무력화 게이지 이어받기(B-01의 3번)는 판정하지 않음');
L.done('t5-host-change');
