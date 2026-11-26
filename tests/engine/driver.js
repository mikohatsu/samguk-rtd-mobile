// 시험용 '사람' 조작기: 화면처럼 g.input(명령)만으로 판을 한다(엔진 상태를 직접 쓰지 않는다). 입력 기록·재연산 시험(t17)이 쓴다.
// 자기 난수(씨앗)로 고른다 — 판 난수(g.rand)를 건드리면 기록에 없는 난수 소비가 생겨 재연산이 어긋나므로 쓰지 않는다.
// 하는 일: 상자·선택권·소모품·합치기·조합법·명사·강화·유닛 이동·라인 조이스틱, 보스전 출전·직접 조작(조이스틱·공격·스킬·이동기·치료·대체 출전).
'use strict';
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
class Driver {
  constructor(seed) { this.r = mulberry(seed); this.t = 0; this.next = 0; this.bossT = 0; this.joyT = 0; this.laneJoyT = 0; this.pickAt = null; this.started = false; }
  pick(a) { return a[(this.r() * a.length) | 0]; }
  // 매 걸음 뒤 한 번 부른다(dt = 그 걸음 크기)
  update(g, dt) {
    if (g.over) return;
    const p = g.me, I = (t, a) => g.input(t, a);
    if (!this.started) { this.started = true; I('ks', [1]); ['t1', 't2'].forEach((k) => I('au', [k, 1])); }
    this.t += dt;
    if (g.phase === 'bossPick' && g.fight && !g.fight.picked) {
      if (this.pickAt == null) this.pickAt = this.t + 0.5 + this.r() * 3;
      if (this.t >= this.pickAt) { this.pickAt = null; I('pk', g.pickChoices().slice(0, g.slotCount()).map((u) => u.id)); }
      return;
    }
    if (g.phase === 'boss' && g.fight) { this.boss(g, dt, I); return; }
    if (this.bossT) { this.bossT = 0; I('bj', []); I('ba', [0]); I('mn', [0]); }
    if (g.phase !== 'wave') return;
    // 라인 조이스틱(가끔 1~2초)
    if (this.laneJoyT > 0) { this.laneJoyT -= dt; if (this.laneJoyT <= 0) I('lj', []); else if (this.r() < 0.1) I('lj', [(this.r() * 64) | 0, 1 + ((this.r() * 4) | 0), this.r() < 0.5 ? 1 : 0]); }
    if (this.t < this.next) return;
    this.next = this.t + 0.4 + this.r() * 0.5;
    let acts = 5;
    const act = () => acts-- > 0;
    for (const d of g.drops.filter((x) => x.owner === p.idx && x.kind === 'chest')) { if (!act()) return; I('ch', [d.id]); }
    for (const t of Object.keys(p.tickets)) if (p.tickets[t] > 0 && act()) { const ids = g.tierIds(+t); if (ids.length) I('tk', [+t, this.pick(ids)]); }
    for (const d of g.drops.filter((x) => x.owner === p.idx && x.kind !== 'chest' && x.kind !== 'item')) {
      const u = g.units.find((v) => v.owner === p.idx && !g.inFight(v) && g.canUseDrop(d, v) && v.def.tier >= 3);
      if (u && act()) I('ud', [d.id, u.id]);
    }
    if (g.canFuse(p) && act()) I('fu', [0]);
    for (const id of Object.keys(g.T.recipes)) if (g.recipeStatus(p, id).ok && act()) I('cr', [id]);
    for (const t of [1, 2, 3, 4, 5]) for (const id of g.tierIds(t)) if (g.canCombine(p, id) && act()) I('cb', [id, 0]);
    const sages = g.T.units.filter((d) => d.tier === 0 && !g.has(p, d.id) && p.gold >= d.cost);
    if (sages.length && g.round >= 8 && g.sagesOf(p).length < g.sageMax() && this.r() < 0.3) I('hi', [this.pick(sages).id]);
    const ups = g.T.upgrades.filter((gr) => (p.upgrades[gr.id] || 0) < g.upMax(p, gr) && p.gold >= g.upgradeCost(p, gr) && g.units.some((u) => u.owner === p.idx && gr.test(u.def)));
    if (ups.length && this.r() < 0.7) I('up', [this.pick(ups).id]);
    const mine = g.units.filter((u) => u.owner === p.idx && u.def.tier >= 4);
    if (mine.length && this.r() < 0.15) { const u = this.pick(mine), mid = g.enemies.find((e) => e.mid); if (mid) I('mv', ['focus', 0, 0, u.id]); else I('mv', ['move', 300 + this.r() * 900, 200 + this.r() * 600, u.id]); }
    if (mine.length && this.laneJoyT <= 0 && this.r() < 0.05) { I('ls', mine.slice(0, 3).map((u) => u.id)); I('lj', [(this.r() * 64) | 0, 4, 0]); this.laneJoyT = 1 + this.r(); }
    if (this.r() < 0.01) I('zn', ['t1', this.pick(['L', 'R', 'B1', 'B2', 'B3'])]);
  }
  boss(g, dt, I) {
    if (!this.bossT) { this.bossT = 1; I('mn', [1]); I('sc', [0]); }
    const f = g.fight, b = f.boss, c = g.active();
    const l = g.localChamps();
    if (l.length && l.every((x) => x.dead)) { const n = g.pickChoices()[0]; if (n && this.r() < 0.05) I('sb', [n.id]); return; }
    if (!c) { if (this.r() < 0.1) I('sc', [l.findIndex((x) => !x.dead)]); return; }
    this.joyT -= dt;
    if (this.joyT <= 0) {
      this.joyT = 0.15 + this.r() * 0.4;
      const danger = g.danger(c.x, c.y) > 0;
      // 위험하면 보스 반대쪽 아무 방향, 아니면 보스 쪽으로 다가가거나 멈춤
      const ab = Math.atan2(b.y - c.y, b.x - c.x), d = Math.hypot(b.x - c.x, b.y - c.y);
      const a = danger ? ab + Math.PI + (this.r() - 0.5) * 2 : d > g.range(c.def) ? ab : null;
      if (a == null) I('bj', []); else I('bj', [Math.round((a / (Math.PI * 2)) * 64) & 63, 4]);
      I('ba', [this.r() < 0.85 ? 1 : 0]);
      if (danger && g.canDash(c) && this.r() < 0.3) I('ds', [c.x + Math.cos(ab + Math.PI) * 200, c.y + Math.sin(ab + Math.PI) * 200]);
    }
    (c.def.sk || []).forEach((s, i) => { if (c.skillCd[i] <= 0 && this.r() < 0.05) I('sk', [i, b.x, b.y]); });
    if (g.healLeft() && c.hp / c.mhp < 0.4 && this.r() < 0.1) I('hl', []);
  }
}
module.exports = { Driver };
