// 밸런스 측정용 AI 정책 3종. ai.js의 Brain(배치·중간보스 추격·보스전 출전/교체/회복)을 그대로 쓰고
// 금화·합성·선택권·강화·영입 판단만 실력 단계에 맞게 바꾼다.
// 유형: 측정 도구(게이트 아님) · 위치: tests/balance/
'use strict';

module.exports = function makePolicies(AI) {
  const { Brain } = AI;

  // 공통: 상자 열기, 되는 조합법 만들기, 진급·리롤 아이템 쓰기
  function basics(b, act, opt) {
    const g = b.g, p = b.p;
    for (const d of g.drops.filter((x) => x.owner === p.idx && x.kind === 'chest')) { if (!act()) return false; g.openChest(p, d); }
    const craftable = Object.keys(g.T.recipes).filter((id) => g.recipeStatus(p, id).ok).sort((a, c) => g.defs[c].tier - g.defs[a].tier);
    for (const id of craftable) { if (!g.recipeStatus(p, id).ok) continue; if (!act()) return false; g.craft(p, id); }
    for (const d of g.drops.filter((x) => x.owner === p.idx && x.kind === 'rankUp')) {
      const list = b.mine().filter((u) => !g.inFight(u) && g.canUseDrop(d, u)).sort((a, c) => (opt.smart ? c.def.tier - a.def.tier : 0));
      const u = opt.smart ? list[0] : list[(g.rand() * list.length) | 0];
      if (u) { if (!act()) return false; g.useDrop(p, d, u); }
    }
    return true;
  }
  function combineAll(b, act, keep) {
    const g = b.g, p = b.p;
    for (const t of [1, 2, 3, 4, 5]) for (const id of g.tierIds(t)) {
      while (g.freeOf(p, id).length - ((keep && keep[id]) || 0) >= g.T.combineNeed[t]) { if (!act()) return false; g.combine(p, id); }
    }
    return true;
  }
  // 합치기에 가장 가까운 것
  function nearest(b, t, keep) {
    const g = b.g, p = b.p, need = g.T.combineNeed[t] || 1;
    const sc = (id) => ((g.freeOf(b.p, id).length - ((keep && keep[id]) || 0)) % need) + g.rand() * 0.1;
    return g.tierIds(t).slice().sort((x, y) => sc(y) - sc(x))[0];
  }

  // (a) 초보: 뽑히는 대로 합치고, 선택권은 아무거나, 강화·영입·시너지는 보지 않는다
  class Novice extends Brain {
    economy() {
      const g = this.g, p = this.p;
      let acts = 4; const act = () => acts-- > 0;
      if (!basics(this, act, { smart: false })) return;
      for (const t of Object.keys(p.tickets)) while (p.tickets[t] > 0) { if (!act()) return; const ids = g.tierIds(+t); if (!g.useTicket(p, +t, ids[(g.rand() * ids.length) | 0])) break; }
      combineAll(this, act, null);
    }
  }

  // (b) 보통: 합치기, 선택권은 합치기에 가까운 것, 강화는 가진 등급 그룹을 고르게(가장 싼 것부터). 영입 없음
  class Casual extends Brain {
    economy() {
      const g = this.g, p = this.p;
      let acts = 4; const act = () => acts-- > 0;
      if (!basics(this, act, { smart: true })) return;
      for (const t of Object.keys(p.tickets)) while (p.tickets[t] > 0) { if (!act()) return; if (!g.useTicket(p, +t, nearest(this, +t))) break; }
      if (!combineAll(this, act, null)) return;
      const own = this.mine();
      const groups = g.T.upgrades.filter((gr) => own.some((u) => gr.test(u.def)) && (p.upgrades[gr.id] || 0) < g.upMax(p, gr))
        .sort((a, c) => g.upgradeCost(p, a) - g.upgradeCost(p, c));
      if (groups[0] && p.gold >= g.upgradeCost(p, groups[0])) g.buyUpgrade(p, groups[0].id);
    }
  }

  // (c) 숙련: 초반은 아끼지 않고 합쳐 등급을 올리고, 5성이 생기면 진영 조합법(시너지·신화·불멸)을 노려 재료를 남긴다.
  // 강화는 주력(등급 높은 유닛)이 걸린 그룹에 몰아 준다. 금화 명사(좌자·간옹)를 일찍 들이고, 뒤에 보스전 명사.
  const HIRE = ['jwaja', 'ganong', 'samahwi', 'gyeonhui'];
  class Skilled extends Brain {
    constructor(g, build) { super(g, build); }
    economy() {
      const g = this.g, p = this.p;
      let acts = 5; const act = () => acts-- > 0;
      const late = this.mine().some((u) => u.def.tier >= 5);
      const wanted = late ? this.wanted() : [], keep = this.keepMap(wanted);
      if (!basics(this, act, { smart: true })) return;
      for (const t of Object.keys(p.tickets)) while (p.tickets[t] > 0) {
        if (!act()) return;
        const choice = late ? this.ticketChoice(+t, keep) : nearest(this, +t);
        if (!g.useTicket(p, +t, choice)) break;
      }
      if (!combineAll(this, act, keep)) return;
      for (const d of g.drops.filter((x) => x.owner === p.idx && x.kind === 'factionReroll')) {
        const u = this.itemTarget(d, keep);
        if (u) { if (!act()) return; g.useDrop(p, d, u); }
      }
      // 영입: 좌자는 25라운드 전에 사면 본전 이상, 나머지는 강화가 한 번 돈 뒤
      const h = g.sagesOf(p).length < g.sageMax() ? HIRE.find((id) => !g.has(p, id)) : null;
      if (h && (h === 'jwaja' ? g.round >= 12 && g.round <= 50 : g.round >= 35) && p.gold >= g.defs[h].cost) { g.hire(p, h); return; }
      if (h === 'jwaja' && g.round >= 12 && g.round <= 50 && p.gold < g.defs[h].cost && g.enemyCount() < g.limit * 0.5) return; // 모은다
      this.upgrade();
    }
    // 보스전: 회복을 체력 50%에 쓰고, 출전은 공격력 순(기본)
    bossPlay(dt) {
      const g = this.g, l = g.localChamps();
      super.bossPlay(dt);
      if (g.healLeft() && l.some((c) => !c.dead && c.hp / c.mhp < 0.5)) g.useHeal();
    }
  }
  return { novice: Novice, casual: Casual, skilled: Skilled };
};
