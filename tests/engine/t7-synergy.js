// T7 인연 시너지 v0.3: 단계 셈, 시그니처(core), 중간보스 제외, 협동 팀 약화(samp) 상한, 자동 조합 마지막 한 기 남김,
// 주장 한 명 규칙, 주장 인연 상한, 보스전 원군 피해·결정성.
// 유형: Logic · 위치: tests/engine/ · 게이트: BLOCKING
// 설계: production/team/2026-11-19/synergy-v03-design.md, synergy-v03-expansion.md
'use strict';
const L = require('./lib');
const { ok, info, T, E, DT } = L;

const syn = (id) => T.synergies.find((s) => s.id === id);
// 판을 비우고 주어진 장수만 둔다
function board(ids, o) {
  o = o || {};
  const g = new E.Game(T, Object.assign({ diff: 'nightmare', mode: 'solo', seed: o.seed || 7001, bot: o.bot !== false }, o.opt || {}));
  g.units = []; g.drops = []; g.enemies = [];
  ids.forEach((id) => g.spawnUnit(g.me, id));
  g.recomputeAuras(); g.events.length = 0;
  return g;
}
const lv = (g, id) => (g.me.syn[id] ? g.me.syn[id].lv : 0);
// 보스전을 바로 시작한다(출전 = 주어진 장수 id 순서)
function fight(g, round, champIds) {
  const b = T.bosses.find((x) => x.round === round);
  g.round = round; g.startBoss(b); g.applyPick();
  const pick = champIds.map((id) => g.units.find((u) => u.def.id === id && !g.fight.used[u.id])).filter(Boolean).map((u) => u.id);
  g.confirmPick(pick);
  return g.fight;
}
function run(g, sec) { for (let i = 0; i < sec / DT && g.fight && !g.over; i++) { g.step(DT); g.events.length = 0; } }

// ---- 단계 셈 ----
{
  const g = board(['yubi', 'gwanu']);
  ok(lv(g, 'peach') === 1, '도원결의: 구성원 2명이면 1단계(2명 단계)');
  g.spawnUnit(g.me, 'gwanu'); g.recomputeAuras();
  ok(lv(g, 'peach') === 1 && g.me.synN.peach === 2, '같은 장수 두 기는 1명으로 센다(관우 2기 → 여전히 2/3)');
  g.spawnUnit(g.me, 'jangbi'); g.recomputeAuras();
  ok(lv(g, 'peach') === 2, '도원결의: 3명이면 2단계(3명 단계)');
  ok(lv(g, 'tigers') === 1, '오호대장군: 유비는 구성원이 아니라 관우·장비 2명 → 1단계');
  const g2 = board(['hwangchung', 'gwanu', 'jangbi', 'joun', 'macho']);
  ok(lv(g2, 'tigers') === 3 && g2.me.syn.tigers.tier.g === 4, '오호대장군 5명: 마지막 단계(4명 이상, 극)');
}
// ---- 시그니처(core) ----
{
  const g = board(['hwawoong', 'anryang', 'munchu', 'jojo']);
  ok(lv(g, 'wuguan') === 0, '오관참장: 구성원 4명이어도 core(관우)가 없으면 0단계');
  g.spawnUnit(g.me, 'gwanu'); g.recomputeAuras();
  ok(lv(g, 'wuguan') === 3, '오관참장: 관우가 있으면 5명 → 3단계');
  const h = board(['cav', 'shd', 'arc']);
  ok(lv(h, 'huangjin') === 1, '황건 봉기: 1성 셋이면 장각 없이도 1단계(needCore: false)');
  const h2 = board(['cav', 'shd', 'arc', 'swd', 'spr', 'dongtak']);
  ok(lv(h2, 'huangjin') === 2, '황건 봉기: 장각 없이 6명이면 needCore 단계(6명)는 켜지지 않고 2단계(5명)');
}
// ---- 라인 효과는 중간보스에도 걸리고, 보스전 효과는 중간보스에 걸리지 않는다 ----
{
  const hitMid = (theme) => {
    const g = new E.Game(theme, { diff: 'nightmare', mode: 'solo', seed: 7101, bot: true });
    g.units = []; ['hwangchung', 'gwanu', 'jangbi', 'joun', 'macho'].forEach((id) => g.spawnUnit(g.me, id)); g.recomputeAuras();
    const m = T.midbosses[0];
    g.spawnMid(m);
    const e = g.enemies.find((x) => x.mid);
    e.hp = e.mhp = 1e12;
    const u = g.units.find((x) => x.def.id === 'gwanu');
    for (let i = 0; i < 40; i++) g.attackEnemy(u, e);
    return 1e12 - e.hp;
  };
  // 보스전 효과를 모두 뺀 테마(라인 효과는 그대로)
  const noBoss = Object.assign({}, T, { synergies: T.synergies.map((s) => Object.assign({}, s, { tiers: s.tiers.map((t) => Object.assign({}, t, { boss: undefined })) })) });
  const noSyn = Object.assign({}, T, { synergies: [] });
  const a = hitMid(T), b = hitMid(noBoss), c = hitMid(noSyn);
  ok(Math.abs(a - b) < 1e-6, `중간보스 피해: 보스전 인연 효과가 있든 없든 같다 (${Math.round(a)} = ${Math.round(b)})`);
  ok(a > c * 1.05, `중간보스 피해: 라인 인연 공격력은 걸린다 (인연 ${Math.round(a)} > 인연 없음 ${Math.round(c)})`);
}
// ---- 협동 팀 보스 약화(samp): 가장 큰 값만, 상한 50% ----
{
  const g = board(['gwanu', 'jangbi', 'hwangchung']);
  fight(g, 10, ['gwanu']);
  const M = g.fight.mech, base = g.raidMul();
  g.sampBoss(0.08, 3);
  g.remoteDamage({ v: 0, sa: [0.08, 3] });
  g.remoteDamage({ v: 0, sa: [0.08, 3] });
  ok(Math.abs(M.sampV - 0.08) < 1e-9 && Math.abs(g.raidMul() / base - 1.08) < 1e-9, `3인 모두 오호대장군 3단계(+8%) → 보스 받는 피해 +8% (×${(g.raidMul() / base).toFixed(3)}, +24% 아님)`);
  g.remoteDamage({ v: 0, sa: [0.9, 3] });
  ok(Math.abs(M.sampV - 0.5) < 1e-9, `samp 상한 50% (받은 0.9 → ${M.sampV})`);
  const w = g.raidWire(), g2 = board(['gwanu']);
  fight(g2, 10, ['gwanu']); g2.raidApply(w);
  ok(Math.abs(g2.fight.mech.sampV - 0.5) < 1e-9 && g2.fight.mech.sampT > 0, '방장 동기화(raidWire sa)로 다른 사람에게도 같은 samp');
}
// ---- 자동 조합: 켜진 단계의 마지막 한 기를 남긴다(설정 켬), 끄면 조합 ----
{
  const mk = (keep, cavN) => {
    const g = board(Array(cavN).fill('cav').concat(['shd', 'arc']), { bot: false, opt: { keepSyn: keep } });
    g.setAuto(g.me, 't1', true);
    return g;
  };
  const a = mk(true, 4), b = mk(false, 4), c = mk(true, 5);
  ok(a.ownedOf(a.me, 'cav').length === 4 && lv(a, 'huangjin') === 1, '인연 유지 켬: 기병 4기 조합이 황건 봉기를 끄면 자동 조합하지 않는다');
  ok(b.ownedOf(b.me, 'cav').length === 0, '인연 유지 끔: 기병 4기를 자동 조합한다');
  ok(c.ownedOf(c.me, 'cav').length === 1 && lv(c, 'huangjin') === 1, '인연 유지 켬: 기병 5기면 4기는 조합하고 1기는 남긴다');
  const bot = board(Array(4).fill('cav').concat(['shd', 'arc']), { opt: { keepSyn: true } });
  bot.setAuto(bot.me, 't1', true);
  ok(bot.ownedOf(bot.me, 'cav').length === 0, 'AI 사령관 게임(bot)은 인연 유지 설정과 무관하게 조합한다');
}
// ---- 주장 한 명 규칙(혼자 하기 2칸) ----
{
  const g = board(['hwangchung', 'gwanu', 'jangbi', 'joun', 'macho', 'yubi']);
  fight(g, 10, ['gwanu', 'jangbi']);
  const [c0, c1] = g.localChamps();
  const has = (c, id) => (c.syR || []).some((R) => R.s.id === id);
  ok(has(c0, 'tigers') && !has(c1, 'tigers'), '같은 인연 구성원 둘이 출전해도 칸 번호가 앞선 장수 하나만 받는다');
  // 오호대장군 원군 수 = 라인에 남은 구성원(출전 중 제외): 황충·조운·마초 3명
  ok(g.synLane(c0, syn('tigers')).join() === 'hwangchung,joun,macho', `원군은 라인에 남은 구성원만 (${g.synLane(c0, syn('tigers')).join()})`);
  c0.dead = true; c0.hp = 0; g.fight.synSig = null; g.synRefresh();
  ok(has(c1, 'tigers'), '주장이 쓰러지면 다음 구성원에게 넘어간다');
}
// ---- 주장 한 명에게 걸리는 보스전 인연 상한 ----
// 확정 구성(시그니처 1 + 주력 3 + 올스타 1)이면 관우는 딱 5개라, 시험용 인연 2개(등급 하)를 더한 테마로 넘치게 만든다
{
  const extra = ['xa', 'xb'].map((id) => ({ id, name: id, units: ['gwanu', 'hwata'], desc: '', tiers: [{ n: 2, g: 1, lane: {}, boss: { stat: { bdmg: 0.01 } } }] }));
  const T2 = Object.assign({}, T, { synergies: T.synergies.concat(extra) });
  const g = new E.Game(T2, { diff: 'nightmare', mode: 'solo', seed: 7201, bot: true });
  g.units = []; ['gwanu', 'jangbi', 'yubi', 'hwangchung', 'joun', 'macho', 'juchang', 'gwanpyeong', 'hwata', 'hwawoong', 'anryang', 'munchu', 'jojo', 'jegal'].forEach((id) => g.spawnUnit(g.me, id)); g.recomputeAuras();
  fight(g, 10, ['gwanu']);
  const c = g.localChamps()[0], max = g.synMaxPerCarry;
  ok(c.syR.length === max && c.syOver.length === 2, `관우 주장: 켜진 보스전 인연 ${c.syR.length + c.syOver.length}개 중 ${max}개만 (넘친 ${c.syOver.join(',')})`);
  ok(c.syR.every((R, i) => !i || c.syR[i - 1].g >= R.g) && !c.syR.some((R) => R.s.id === 'xa' || R.s.id === 'xb'), '고른 인연은 단계 등급이 높은 순(등급 낮은 시험용 인연이 빠짐)');
}
// ---- 보스전: 원군 피해·결정성·예외 없음 ----
{
  const ids = ['hwangchung', 'gwanu', 'jangbi', 'joun', 'macho', 'yubi', 'samaui', 'janghap', 'deungae', 'hwanggae', 'nosuk', 'bangtong', 'juyu', 'jegal', 'chaemunhui', 'jojo', 'heojeo'];
  const play = () => { L.seedRandom(5); const g = board(ids, { seed: 7301 }); fight(g, 70, ['gwanu', 'jegal']); run(g, 40); return g; };
  let a, b, err = null;
  try { a = play(); b = play(); } catch (e) { err = L.errText(e); }
  ok(!err, '보스전 40초(인연 여러 개) 예외 없음' + (err ? ' — ' + err : ''));
  if (a && b) {
    const f = a.fight || null, rows = a.stats.bosses.length ? a.stats.bosses[0].dealt : f ? f.dealt : {};
    const synRow = Object.keys(rows).filter((k) => k.includes('·'));
    ok(synRow.length > 0, `딜미터에 인연 원군 줄이 따로 있다 (${synRow.join(', ')})`);
    const hp = (g) => (g.fight ? Math.round(g.fight.boss.hp) + '@' + g.fight.t.toFixed(2) : g.stats.bosses[0] ? g.stats.bosses[0].time + 's ' + Math.round(g.stats.bosses[0].total) : 'x');
    ok(String(hp(a)) === String(hp(b)), `같은 씨앗 두 번 → 같은 결과(보스 체력·시간 또는 처치 시간·피해 합) (${hp(a)} / ${hp(b)})`);
    const bad = []; a.fight && a.fight.champs.forEach((c) => ['hp', 'mhp'].forEach((k) => { if (!Number.isFinite(c[k])) bad.push(c.def.id + '.' + k); }));
    ok(!bad.length, '장수 체력이 모두 유한한 수' + (bad.length ? ' — ' + bad.join(',') : ''));
    info(`보스전 40초 뒤 딜미터: ${Object.entries(rows).map(([k, v]) => k + ' ' + Math.round(v)).join(' / ')}`);
  }
}
// ---- 원군 피해 예산: 주장 자신의 피해 비율까지만(최고 등급 비율 + 처음 공칭분) ----
{
  const g = board(['hwangchung', 'gwanu', 'jangbi', 'joun', 'macho', 'yubi', 'jegal'], { seed: 7401 });
  fight(g, 120, ['gwanu']); run(g, 20);
  const c = g.fight ? g.localChamps()[0] : null;
  if (c) {
    const top = c.syR.reduce((m, R) => Math.max(m, R.g), 1), cap = g.synAllyRatio[top] * (c.syOwnD + 4 * g.synS(c));
    ok(c.syAllyD > 0 && c.syAllyD <= cap + 1, `인연 피해 ${Math.round(c.syAllyD)} ≤ 예산 ${Math.round(cap)} (주장 피해 ${Math.round(c.syOwnD)}, 비율 ${g.synAllyRatio[top]})`);
  } else ok(false, '원군 예산 시험: 20초 안에 보스전이 끝나 확인 못 함');
}
// ---- 라인 공격력 상한: 1성만 단계 값까지(청주병 +60%), 2성 이상은 +40% ----
{
  const g = board(['spr', 'shd', 'yujin', 'akjin', 'hayeon']);
  ok(Math.abs(g.synFor(0, g.defs.spr).atk - 0.6) < 1e-9 && Math.abs(g.synFor(0, g.defs.yujin).atk - 0.4) < 1e-9, `청주병 5단계: 창병(1성) +${Math.round(g.synFor(0, g.defs.spr).atk * 100)}%, 우금(2성) +${Math.round(g.synFor(0, g.defs.yujin).atk * 100)}%`);
}
// ---- 데이터 점검: 구성원·그림 id가 모두 있는 장수 ----
{
  const ids = new Set(T.units.map((d) => d.id)), bad = [];
  T.synergies.forEach((s) => {
    s.units.forEach((u) => { if (!ids.has(u)) bad.push(s.id + ':' + u); });
    if (s.core && !s.units.includes(s.core)) bad.push(s.id + ':core');
    (s.tiers || []).forEach((t, i) => { if (!(t.n > 0) || !(t.g >= 1 && t.g <= 5)) bad.push(s.id + ':tier' + i); if (i && s.tiers[i - 1].n >= t.n) bad.push(s.id + ':order' + i); });
  });
  ok(!bad.length && T.synergies.length >= 50, `인연 ${T.synergies.length}개 데이터 점검` + (bad.length ? ' — ' + bad.join(' ') : ''));
}
L.done('t7-synergy');
