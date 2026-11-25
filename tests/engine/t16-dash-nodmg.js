// T16 이동기(대시)는 피해 없이 이동만 (2026-11-26 사용자 「이동기에 왜 딜이 있어???」)
// 원인: 인연 v0.3의 대시 발동 효과 — 단기의 맹장(danqi) 「대시하면 찌르기 3~4.5S」, 하비의 책사(xiapi) 「장료가 함께 돌진 4~8S」.
// theme rules.dashNoDmg가 켜져 있으면 대시로 발동하는 인연 효과 중 피해(dmg·dashHit)만 빼고 나머지(버프·재사용 등)는 그대로 쓴다.
// 유형: Integration · 위치: tests/engine/ · 게이트: BLOCKING
'use strict';
const L = require('./lib');
const { ok } = L;

// 단기의 맹장 구성원(cav·gamnyeong·jangryo·munang)을 판에 두고 문앙(전설, 대시 가능)을 출전시켜 대시한다
function dashOnce(noDmg) {
  L.T.rules.dashNoDmg = noDmg;
  L.seedRandom(16001);
  const g = new L.E.Game(L.T, { diff: 'normal', mode: 'solo', seed: 16001, bot: false });
  ['cav', 'gamnyeong', 'jangryo', 'munang', 'cav'].forEach((id) => g.spawnUnit(g.me, id, undefined, undefined, true));
  g.recomputeAuras();
  g.round = 25; g.startBoss(L.T.bosses.find((b) => b.round === 25)); g.phase = 'bossPick';
  const mu = g.units.find((u) => u.def.id === 'munang');
  g.confirmPick([mu.id]); g.beginFight();
  const f = g.fight, b = f.boss, c = f.champs.find((x) => x.def.id === 'munang');
  b.hp = b.mhp = 1e9; b.x = 900; b.y = 500; c.x = 600; c.y = 500; c.cd = 99; c.skillCd = c.skillCd.map(() => 99); f.mech.gr = 0; b.def = 0;
  const syn = (c.syR || []).map((R) => R.s.id);
  const hp0 = b.hp;
  g.events.length = 0;
  g.dash(c, 850, 500);
  const txt = g.events.filter((e) => e.type === 'dmgtext' && typeof e.v === 'number').length;
  const name = g.events.some((e) => e.type === 'dmgtext' && typeof e.v === 'string' && e.v.indexOf('「') === 0);
  return { syn, lost: hp0 - b.hp, txt, name, moved: c.x > 700 };
}
const keep = L.T.rules.dashNoDmg;
const on = dashOnce(true), off = dashOnce(false);
L.T.rules.dashNoDmg = keep;
ok(on.syn.includes('danqi'), `인연 단기의 맹장이 켜진 문앙으로 시험(켜진 인연: ${on.syn.join(',') || '없음'})`);
ok(off.lost > 0, `대조: dashNoDmg를 끄면 대시가 보스에게 피해 ${Math.round(off.lost)}를 준다(원인 재현)`);
ok(on.moved && on.lost === 0, `이동기: 이동은 하고(${on.moved}) 보스 피해 0`);
ok(on.txt === 0, '이동기: 피해 숫자 연출도 없음');
ok(keep === false, 'theme rules.dashNoDmg 기본값이 꺼짐(2026-11-26 사용자 결정: 인연 대시 피해 유지)');
ok(off.name, '피해가 날 때 인연 이름(「…」)이 장수 머리 위에 뜬다');
ok(!on.name, '피해를 끈 설정에서는 인연 이름도 안 뜬다');
L.done('t16-dash-nodmg');
