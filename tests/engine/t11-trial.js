// T11 신화·불멸 체험(production/team/2026-11-25/trial-mode.md 6절 기능 항목 중 엔진 몫 4~10, 1·3의 엔진 쪽 근거, 14 회귀 일부).
// 화면·기기 저장(rtd-hist·rtd-save 등)·서버 통신(1·2·3·12·13·15)은 브라우저 통합 시험으로 따로 본다(trial-impl.md).
// 유형: Logic/Integration · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok, info, T, E } = L;
const DT = 1 / 60;
const LOCKED = T.unlock.lockedIds();
const mk = (unit, o) => new E.Game(T, Object.assign({ diff: 'easy', mode: 'solo', seed: 1101, trial: { unit } }, o || {}));
const evTypes = (g) => g.events.map((e) => e.type);
// 연출 4.2초를 넘겨 보스전에 들어갈 때까지(이벤트를 모은다)
function toFight(g, seen) {
  for (let i = 0; i < 60 * 6 && g.phase !== 'boss' && !g.over; i++) { g.step(DT); evTypes(g).forEach((t) => seen.add(t)); g.events.length = 0; }
}
// 체험 판을 끝까지(자동 조작). 이벤트 종류와 trialEnd를 돌려준다
function runTrial(g, maxT) {
  const seen = new Set(); let end = null;
  const take = () => { g.events.forEach((e) => { seen.add(e.type); if (e.type === 'trialEnd') end = e; }); g.events.length = 0; };
  take(); toFight(g, seen);
  g.localChamps().forEach((c) => { c.ai = true; });
  for (let i = 0; i < (maxT || 70) / DT && !g.over; i++) { g.step(DT); take(); }
  take();
  return { seen, end };
}

// 0) 데이터: 체험 설정·마속, 일반 보스 목록에 없음
try {
  ok(T.trial && T.trial.upLv === 10 && T.trial.limit === 60 && T.trial.killT === 30, `체험 설정(theme.trial) 강화 10단계·60초·목표 30초 (${JSON.stringify(T.trial)})`);
  ok(T.trialBoss && T.trialBoss.id === 'b_masok' && !T.bosses.some((b) => b.id === 'b_masok'), '마속은 trialBoss에만 있고 일반 보스 목록(bosses)에 없음');
  ok(!(T.trialBoss.phases || []).length && T.trialBoss.patterns.every((p) => ['rain', 'fan'].includes(p.gen)), '마속은 기믹 없이 낙석·부적 두 기술만');
  ok(T.bossLooks.b_masok === 'masok', 'bossLooks.b_masok = masok');
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 3 });
  ok(!Object.values(g.bossByRound).some((b) => b.id === 'b_masok') && !g.trial, '일반 판에는 마속이 없고 체험이 아님');
} catch (e) { ok(false, '데이터 확인 중 예외 — ' + L.errText(e)); }

// 4) 판 구조 · 9) 잠긴 장수 사용
try {
  const g = mk('gwanu', { unlocked: [] });
  ok(g.trial && g.phase === 'bossIntro' && g.round === 0 && g.units.length === 1 && g.units[0].def.id === 'gwanu', `만든 직후 bossIntro·라운드 0·유닛 1명 (phase ${g.phase}, round ${g.round}, units ${g.units.length})`);
  ok(g.lockedSet.size === 0 && !g.isLocked('gwanu'), `unlocked: []여도 체험 장수에는 잠금이 걸리지 않음 (lockedSet ${g.lockedSet.size})`);
  ok(!evTypes(g).includes('pop') && !evTypes(g).includes('round'), `등장 연출(pop)·라운드 이벤트 없음 (${evTypes(g).join(',')})`);
  ok(g.upgradeLevel(g.me, g.units[0].def) === 10, `강화 10단계 (${g.upgradeLevel(g.me, g.units[0].def)})`);
  ok(Object.keys(g.stats.myth || {}).length === 0 && Object.keys(g.stats.imm || {}).length === 0, '소환 기록(stats.myth·imm)을 남기지 않음 — rtd-hist 해금 근거가 생기지 않는다');
  const f = g.fight, d = g.units[0].def, rk = g.rankOf[d.tier];
  const want = rk.atk * (1 + 0.2 * 10) * (1 + g.passives(d, 'bossPct').reduce((a, x) => a + x.pct, 0)) * T.trial.uptime * T.trial.killT * ((T.trial.hpx || {}).gwanu || 1);
  ok(Math.abs(f.boss.mhp - want) < 1 && f.boss.hp === f.boss.mhp && f.boss.def === 0, `마속 체력 = 공식 × 장수별 보정 hpx(${Math.round(want)}), 방어 0 (실제 ${Math.round(f.boss.mhp)})`);
  ok(Math.abs(f.boss.hit - rk.hp * T.trial.hitPct) < 1e-6 && f.limit === 60, `마속 공격력 = 장수 등급 체력 × 3% (${f.boss.hit}), 시간 60초`);
  ok(g.slotCount() === 1, '출전 칸 1');
} catch (e) { ok(false, '판 구조 확인 중 예외 — ' + L.errText(e)); }

// 5) 자동 출전: 출전 선택 창 이벤트 없음
try {
  const g = mk('joun', { unlocked: [] }), seen = new Set();
  g.events.length = 0; toFight(g, seen);
  const ch = g.localChamps();
  ok(g.phase === 'boss' && ch.length === 1 && ch[0].def.id === 'joun', `연출 뒤 보스전, 내 장수 1명(조운) (phase ${g.phase}, ${ch.map((c) => c.def.id)})`);
  ok(!seen.has('bossPick') && seen.has('bossFight'), `출전 선택 창(bossPick) 이벤트 없이 bossFight (${[...seen].join(',')})`);
} catch (e) { ok(false, '자동 출전 확인 중 예외 — ' + L.errText(e)); }

// 6) 끝 처리(처치): over === 'trial', trialEnd만, 보상·기록 없음
try {
  const g = mk('yeopo'), seen = new Set();
  g.events.length = 0; toFight(g, seen);
  const gold0 = g.me.gold, tickets0 = JSON.stringify(g.me.tickets), units0 = g.units.length, drops0 = g.drops.length;
  g.fight.boss.hp = 1; g.damageBoss(10, g.localChamps()[0]);
  const ev = g.events.slice(); g.step(DT); ev.push(...g.events);
  const te = ev.find((e) => e.type === 'trialEnd');
  ok(g.over === 'trial' && g.phase === 'over' && te && te.win === true, `보스 체력 0 → over 'trial', trialEnd(win) (over ${g.over})`);
  ok(!ev.some((e) => e.type === 'over' || e.type === 'bossWin' || e.type === 'achievement'), `over·bossWin·업적 이벤트 없음 (${ev.map((e) => e.type).join(',')})`);
  ok(g.stats.bosses.length === 0 && g.me.gold === gold0 && JSON.stringify(g.me.tickets) === tickets0 && g.units.length === units0 && g.drops.length === drops0, '보스 기록·금화·선택권·유닛·상자 변화 없음');
  ok(g.fight === null && te.best > 0 && te.total > 0 && te.unit === 'yeopo', `처치 뒤 fight 비움(처치 연출용), 결과에 최대 한 방·총 피해 (best ${Math.round(te.best)})`);
  g.step(1); ok(g.events.every((e) => e.type !== 'over'), '끝난 뒤 step해도 over 없음');
  g.finish(true); ok(g.over === 'trial' && !g.events.some((e) => e.type === 'over'), '끝난 뒤 finish()를 불러도 over 없음');
} catch (e) { ok(false, '끝 처리 확인 중 예외 — ' + L.errText(e)); }

// 6b) 나가기 경로 대비: 판 도중 finish(false) → trialEnd
try {
  const g = mk('jojo'); g.events.length = 0;
  g.finish(false);
  ok(g.over === 'trial' && g.events.some((e) => e.type === 'trialEnd' && e.win === false) && !g.events.some((e) => e.type === 'over'), 'finish()도 over 대신 trialEnd');
} catch (e) { ok(false, 'finish 확인 중 예외 — ' + L.errText(e)); }

// 7) 시간 종료 · 8) 쓰러지지 않음
try {
  const g = mk('gwakga'), seen = new Set();
  g.events.length = 0; toFight(g, seen);
  const c = g.localChamps()[0];
  g.fight.boss.hp = g.fight.boss.mhp = 1e15; // 시간 안에 못 잡게
  g.hurtChamp(c, c.mhp * 10);
  ok(c.hp >= 1 && !c.dead, `장수 체력을 크게 깎아도 1 이상·쓰러지지 않음 (hp ${c.hp})`);
  let end = null;
  for (let i = 0; i < 61 / DT && !g.over; i++) { g.step(DT); g.events.forEach((e) => { if (e.type === 'trialEnd') end = e; }); g.events.length = 0; if (!c.dead && c.hp > 0) c.hp = Math.min(c.hp, 5); }
  ok(end && end.win === false && g.over === 'trial' && end.time === 60, `60초 끝 → trialEnd(win false, 60초) (${end && JSON.stringify({ win: end.win, time: end.time })})`);
  ok(!c.dead && c.hp >= 1, '체력 5로 묶어 60초 맞아도 쓰러지지 않음');
  ok(g.fight && g.fight.def.id === 'b_masok', '시간 종료면 보스전 화면이 남음(처치 연출 없음)');
} catch (e) { ok(false, '시간 종료 확인 중 예외 — ' + L.errText(e)); }

// 10) 처치 시간: 잠긴 20명 전원, 자동 조작
try {
  const rows = [], bad = [];
  for (const id of LOCKED) {
    L.seedRandom(7);
    const g = mk(id, { seed: 2000 + LOCKED.indexOf(id), unlocked: [] }), r = runTrial(g, 70);
    const e = r.end;
    rows.push(`${id} ${e ? (e.win ? e.time + 's' : 'TIMEOUT') : '-'}`);
    if (!e || !e.win || e.time > 45 || e.time < 15 || r.seen.has('over') || g.stats.bosses.length) bad.push(id + ':' + (e ? e.time + (e.win ? '' : 'x') : 'noend'));
  }
  info('처치 시간: ' + rows.join(' · '));
  ok(rows.length === 20 && !bad.length, `잠긴 ${rows.length}명 모두 60초 안에 처치(15~45초), over·보스 기록 없음${bad.length ? ' — 벗어남 ' + bad.join(', ') : ''}`);
  const t20 = rows.filter((x) => /\d+s$/.test(x)).map((x) => +x.split(' ')[1].slice(0, -1)), in2045 = t20.filter((x) => x >= 20 && x <= 45).length;
  ok(in2045 >= 18, `20~45초 안에 든 장수 ${in2045}/${t20.length} (18명 이상. 설계 6절 10번, 자동 조작은 운에 따라 몇 초 흔들린다)`);
} catch (e) { ok(false, '처치 시간 확인 중 예외 — ' + L.errText(e)); }

// 보스 대사 배너(70%·30%)
try {
  const g = mk('sunuk'), seen = new Set();
  g.events.length = 0; toFight(g, seen);
  const b = g.fight.boss, got = [];
  b.hp = b.mhp * 0.69; g.step(DT); got.push(...g.events.filter((e) => e.type === 'banner')); g.events.length = 0;
  b.hp = b.mhp * 0.29; g.step(DT); got.push(...g.events.filter((e) => e.type === 'banner')); g.events.length = 0;
  b.hp = b.mhp * 0.2; g.step(DT); got.push(...g.events.filter((e) => e.type === 'banner'));
  ok(got.length === 2 && got[0].sub === 'tb_l70' && got[1].sub === 'tb_l30', `체력 70%·30%에서 대사 배너 한 번씩 (${got.map((e) => e.sub)})`);
} catch (e) { ok(false, '대사 배너 확인 중 예외 — ' + L.errText(e)); }

// 14) 회귀: 체험이 아닌 판은 그대로(라운드 1·라인·잠금·출전 2칸)
try {
  const g = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 5, unlocked: [] });
  ok(!g.trial && g.phase === 'wave' && g.round === 1 && g.units.length === g.diff.startUnits && g.slotCount() === 2 && g.lockedSet.size === LOCKED.length, '일반 혼자 판: 라운드 1·시작 유닛·출전 2칸·잠금 그대로');
  const bad = new E.Game(T, { diff: 'easy', mode: 'solo', seed: 5, trial: { unit: 'nope' } });
  ok(!bad.trial && bad.phase === 'wave', '없는 장수 id로 체험을 열면 일반 판으로(예외 없음)');
} catch (e) { ok(false, '회귀 확인 중 예외 — ' + L.errText(e)); }

L.done('t11-trial');
