// AI 사령관. 사람 협동 참가자처럼 자기 라인(게임)을 따로 받아 명령만 내린다:
// 상자·선택권·조합·조합법·강화·영입·배치, 중간보스 인코스 추격, 보스전 출전과 교체.
(function (root) {
  const DET = root.RTD_DET || (typeof require !== 'undefined' ? require('./det.js') : null); // 결정적 sin·cos·atan2·hypot·exp·log(det.js, 서버 재연산 검증)
  const E = root.RTD_ENGINE || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const { INNER, dist } = E;

  // 빌드 패턴. fac: 그 진영 조합법을 처음부터 노린다. econ: 해산·영입으로 금화를 먼저 굴린다. rush: 아끼지 않고 바로 합친다.
  const BUILDS = [
    // name은 코드 안 설명용. 화면에 보이는 동맹 이름은 문구표 ai_<id>(i18n.js, 4개 언어)를 쓴다(17-loop)
    { id: 'wei', name: '위 정예', fac: 'wei' },
    { id: 'shu', name: '촉 정예', fac: 'shu' },
    { id: 'wu', name: '오 정예', fac: 'wu' },
    { id: 'etc', name: '군웅 할거', fac: 'etc' },
    { id: 'econ', name: '내정 우선', econ: true },
    { id: 'rush', name: '물량 속공', rush: true },
  ];
  // 명사는 4명까지: 내정 빌드는 금화·강화, 나머지는 유닛·보스전 쪽
  const HIRE = { econ: ['mijuk', 'jwaja', 'chaemunhui', 'samahwi'], other: ['ganong', 'ugil', 'gyeonhui', 'sogyo'] };
  // 6성 이상 주력은 길이 꺾이는 네 모서리 안쪽에 세운다(두 변을 함께 맡는다)
  const CORNERS = [[INNER.x0 + 34, INNER.y0 + 34], [INNER.x1 - 34, INNER.y0 + 34], [INNER.x1 - 34, INNER.y1 - 34], [INNER.x0 + 34, INNER.y1 - 34]];

  class Brain {
    constructor(g, build) {
      this.g = g; this.b = build;
      this.econT = 1; this.chaseT = 0; this.pickWait = 1.5 + g.rand() * 2; this.repT = 1;
      g.me.arrangeAll = true; // 합성은 직접 하고 정렬만 쓴다
      this.chasers = []; this.midSeen = 0;
    }
    get p() { return this.g.me; }
    mine() { return this.g.units.filter((u) => u.owner === this.p.idx && u.def.tier > 0); }

    update(dt) {
      const g = this.g;
      if (g.over || !g.round) return;
      this.econT -= dt; this.chaseT -= dt;
      if (g.phase === 'bossPick') this.bossPick(dt);
      if (g.phase === 'boss') this.bossPlay(dt);
      // 사람처럼 한 번에 몇 동작씩만 한다
      if (this.econT <= 0) { this.econT = 0.6 + g.rand() * 0.5; this.economy(); }
      if (g.phase === 'wave' && this.chaseT <= 0) { this.chaseT = 0.2; this.chase(0.2); this.place(); }
    }

    // ---- 노리는 조합법과 남겨 둘 재료 ----
    completion(id) {
      const st = this.g.recipeStatus(this.p, id);
      const tot = st.parts.reduce((a, x) => a + x.need, 0), have = st.parts.reduce((a, x) => a + Math.min(x.have, x.need), 0);
      return have / tot;
    }
    wanted() {
      const g = this.g, ids = Object.keys(g.T.recipes);
      if (this.b.fac) return ids.filter((id) => g.defs[id].fac === this.b.fac);
      // 진영을 정하지 않은 빌드는 가장 많이 모인 7~8성 하나와, 거의 다 모인 9~10성을 노린다
      let best = null, bs = -1;
      ids.forEach((id) => { if (g.defs[id].tier <= 8) { const c = this.completion(id); if (c > bs) { bs = c; best = id; } } });
      const out = ids.filter((id) => g.defs[id].tier >= 9 && this.completion(id) >= 0.6);
      if (best && (!this.b.rush || bs >= 0.6)) out.push(best);
      return out;
    }
    keepMap(wanted) {
      const keep = {};
      wanted.forEach((id) => {
        const need = {};
        this.g.recipeOf(id).parts.forEach((x) => (need[x] = (need[x] || 0) + 1));
        Object.keys(need).forEach((x) => (keep[x] = Math.max(keep[x] || 0, need[x])));
      });
      return keep;
    }

    economy() {
      const g = this.g, p = this.p, wanted = this.wanted(), keep = this.keepMap(wanted);
      let acts = 4;
      const act = () => acts-- > 0;
      // 상자는 바로 연다
      for (const d of g.drops.filter((x) => x.owner === p.idx && x.kind === 'chest')) { if (!act()) return; g.openChest(p, d); }
      // 조합법: 진영 빌드는 자기 진영(과 아이템까지 갖춘 9성 이상)만, 나머지는 되는 대로
      const craftable = Object.keys(g.T.recipes)
        .filter((id) => (!this.b.fac || wanted.includes(id) || g.defs[id].tier >= 9) && g.recipeStatus(p, id).ok)
        .sort((a, b) => g.defs[b].tier - g.defs[a].tier);
      for (const id of craftable) { if (!g.recipeStatus(p, id).ok) continue; if (!act()) return; g.craft(p, id); }
      // 선택권
      for (const t of Object.keys(p.tickets)) while (p.tickets[t] > 0) { if (!act()) return; if (!g.useTicket(p, +t, this.ticketChoice(+t, keep))) break; }
      // 합치기: 조합법 재료로 남길 몫을 빼고 합친다
      for (const t of [1, 2, 3, 4, 5]) for (const id of g.tierIds(t)) {
        while (g.freeOf(p, id).length - (keep[id] || 0) >= g.T.combineNeed[t]) { if (!act()) return; g.combine(p, id); }
      }
      // 진급 상자·진영 변경 아이템
      for (const d of g.drops.filter((x) => x.owner === p.idx && (x.kind === 'rankUp' || x.kind === 'factionReroll'))) {
        const u = this.itemTarget(d, keep);
        if (u) { if (!act()) return; g.useDrop(p, d, u); }
      }
      // 영입: 내정 빌드는 강화보다 먼저 돈을 모아 명사를 들이고, 나머지는 40라운드부터 남는 돈으로
      const h = this.nextHire();
      if (h && (this.b.econ || g.round >= 40) && p.gold >= g.defs[h].cost) { if (!act()) return; g.hire(p, h); return; }
      // 내정 빌드도 라인이 밀리면 모으던 돈을 강화에 쓴다
      if (h && this.b.econ && g.enemyCount() < g.limit * 0.55) return;
      this.upgrade();
    }
    nextHire() {
      const list = this.b.econ ? HIRE.econ : HIRE.other;
      if (this.g.sagesOf(this.p).length >= this.g.sageMax()) return null;
      return list.find((id) => !this.g.has(this.p, id)) || null;
    }
    upgrade() {
      const g = this.g, p = this.p, own = this.mine();
      // 주력이 많이 걸린 강화 그룹부터, 살 수 있는 만큼
      const groups = g.T.upgrades
        .map((gr) => ({ gr, w: own.filter((u) => gr.test(u.def)).reduce((a, u) => a + u.def.tier * u.def.tier, 0) }))
        .filter((x) => x.w > 0 && (p.upgrades[x.gr.id] || 0) < g.upMax(p, x.gr))
        .sort((a, b) => b.w / g.upgradeCost(p, b.gr) - a.w / g.upgradeCost(p, a.gr));
      const top = groups.find((x) => p.gold >= g.upgradeCost(p, x.gr));
      if (top) g.buyUpgrade(p, top.gr.id);
    }
    ticketChoice(t, keep) {
      const g = this.g, p = this.p, ids = g.tierIds(t), need = g.T.combineNeed[t];
      const facOk = (id) => !this.b.fac || g.defs[id].fac === this.b.fac;
      // 노리는 조합법에 모자란 재료부터
      const miss = ids.filter((id) => (keep[id] || 0) > g.ownedOf(p, id).length).sort((a, b) => facOk(b) - facOk(a));
      if (miss.length) return miss[0];
      // 없으면 합치기에 가장 가까운 것(진영 빌드는 자기 진영을 조금 더 쳐준다)
      // 점수는 장수마다 한 번만 매긴다(난수 포함). 정렬 비교 함수 안에서 난수를 뽑으면 엔진마다(V8·JavaScriptCore) 비교 횟수가 달라
      // 난수 소비가 갈린다 → 서버 재연산과 어긋난다(2026-11-26).
      const sc = {}; ids.forEach((id) => { sc[id] = (need ? (g.freeOf(p, id).length - (keep[id] || 0)) % need : 0) + (facOk(id) ? 0.5 : 0) + g.rand() * 0.1; });
      return ids.slice().sort((a, b) => sc[b] - sc[a])[0];
    }
    itemTarget(d, keep) {
      const g = this.g, list = this.mine().filter((u) => !g.inFight(u) && g.canUseDrop(d, u));
      // 조합법 재료로 남겨 둔 몫은 건드리지 않는다
      const spare = list.filter((u) => g.freeOf(this.p, u.def.id).length > (keep[u.def.id] || 0));
      if (d.kind === 'rankUp') return spare.sort((a, b) => b.def.tier - a.def.tier)[0] || null;
      const wrong = spare.filter((u) => u.def.tier <= 6 && (this.b.fac ? u.def.fac !== this.b.fac : !keep[u.def.id]));
      return wrong.sort((a, b) => b.def.tier - a.def.tier)[0] || null;
    }

    // ---- 중간보스: 가장 센 유닛 몇 기로 인코스를 따라가며 점사 ----
    chase(dt) {
      const g = this.g, mid = g.enemies.find((e) => e.mid);
      if (!mid) {
        // 끝나면 원래 자리로 돌려보낸다
        this.chasers.forEach((id) => { const u = g.units.find((x) => x.id === id); if (u) { u.order = { t: 'idle' }; u.target = null; u.home = null; } });
        this.chasers = []; this.midSeen = 0;
        return;
      }
      this.midSeen += dt;
      if (this.midSeen < 1.2) return; // 알아차리는 데 걸리는 시간
      this.chasers = this.chasers.filter((id) => g.units.some((u) => u.id === id));
      const want = g.round <= 10 ? 3 : 4;
      if (this.chasers.length < want) {
        const pool = this.mine().filter((u) => !g.inFight(u) && !this.chasers.includes(u.id)).sort((a, b) => g.unitAtk(b) - g.unitAtk(a));
        pool.slice(0, want - this.chasers.length).forEach((u) => this.chasers.push(u.id));
      }
      const cx = (INNER.x0 + INNER.x1) / 2, cy = (INNER.y0 + INNER.y1) / 2;
      this.chasers.forEach((id) => {
        const u = g.units.find((x) => x.id === id), rng = g.range(u.def), d = dist(mid.x, mid.y, u.x, u.y);
        if (d > rng * 0.8) {
          // 길 바로 안쪽(인코스)으로 앞질러 간다
          const ax = cx - mid.x, ay = cy - mid.y, al = DET.hypot(ax, ay) || 1;
          g.cmd('move', [u.id], mid.x + (ax / al) * rng * 0.6, mid.y + (ay / al) * rng * 0.6);
          u.order.after = 'focus';
        } else if (u.order.t !== 'focus') g.cmd('focus', [u.id]);
      });
    }
    place() {
      const g = this.g, p = this.p;
      let k = 0;
      this.mine().forEach((u) => {
        if (this.chasers.includes(u.id) || g.inFight(u)) return;
        if (u.def.tier <= 5) { if (!u.slot && u.order.t === 'idle') g.arrange(p, u); return; }
        if (u.home && u.order.t !== 'idle') return;
        const c = CORNERS[k % 4], n = Math.floor(k / 4), x = c[0] + (c[0] < INNER.x0 + 100 ? 1 : -1) * n * 44, y = c[1];
        k++;
        if (!u.home || dist(u.x, u.y, x, y) > 8) { u.home = [x, y]; u.order = { t: 'move', x, y }; }
      });
    }

    // ---- 보스전 ----
    bossPick(dt) {
      const g = this.g;
      if (g.fight.picked) return;
      this.pickWait -= dt;
      if (this.pickWait > 0) return;
      this.pickWait = 1.5 + g.rand() * 2;
      g.confirmPick(g.pickChoices().slice(0, g.slotCount()).map((u) => u.id));
    }
    bossPlay(dt) {
      const g = this.g, l = g.localChamps();
      if (l.length && l.every((c) => c.dead)) {
        this.repT -= dt;
        if (this.repT <= 0) { this.repT = 1; const n = g.pickChoices()[0]; if (n) g.replaceChamp(n.id); }
      } else this.repT = 1;
      if (g.healLeft() && l.some((c) => !c.dead && c.hp / c.mhp < 0.4)) g.useHeal();
    }
  }

  const api = { BUILDS, Brain };
  root.RTD_AI = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
