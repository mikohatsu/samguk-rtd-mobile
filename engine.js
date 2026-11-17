// 게임 규칙과 시뮬레이션. DOM을 쓰지 않아 브라우저와 Node 양쪽에서 돈다.
(function (root) {
  const W = 1500, H = 1010;
  const ROAD = { x0: 190, y0: 70, x1: W - 222, y1: H - 70 }; // 왼쪽 여백은 전황, 오른쪽 여백은 업적 깃발 자리
  const INNER = { x0: ROAD.x0 + 48, y0: ROAD.y0 + 48, x1: ROAD.x1 - 48, y1: ROAD.y1 - 48 };
  const PATH = [[ROAD.x0, ROAD.y0], [ROAD.x1, ROAD.y0], [ROAD.x1, ROAD.y1], [ROAD.x0, ROAD.y1]];
  const ARENA = { x0: 175, y0: 60, x1: W - 50, y1: H - 60 }; // 왼쪽은 전황 표시 자리
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  function mulberry(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 기하: 스킬과 패턴이 같은 판정을 쓴다
  const inLine = (px, py, x, y, a, len, w, pad) => {
    const dx = px - x, dy = py - y, c = Math.cos(a), s = Math.sin(a);
    const along = dx * c + dy * s, side = Math.abs(-dx * s + dy * c);
    return along >= -pad && along <= len + pad && side <= w / 2 + pad;
  };
  const inCone = (px, py, x, y, a, r, arc, pad) =>
    dist(px, py, x, y) <= r + pad && (dist(px, py, x, y) < pad || angDiff(Math.atan2(py - y, px - x), a) <= arc / 2);

  class Game {
    constructor(theme, opt) {
      this.T = theme; this.R = theme.rules;
      this.diff = theme.difficulties.find((d) => d.id === opt.diff) || theme.difficulties[0];
      this.mode = opt.mode || 'solo'; // solo | multi (AI 동맹도 가상 방을 쓰는 multi다)
      this.bot = !!opt.bot; // AI 사령관의 게임: 보스전 출전 유닛을 스스로 움직인다
      this.rand = mulberry(opt.seed || (Math.random() * 1e9) | 0);
      this.net = opt.net || null;
      this.defs = {}; theme.units.forEach((d) => (this.defs[d.id] = d));
      // 장수 해금(theme.unlock): opt.unlocked = 이 사람이 연 잠금 장수 id 목록. 없으면 화면이 넣은 provider, 그것도 없으면(시험·시뮬레이터) 전부 열림.
      // 잠긴 장수는 조합·교체권·선택권·상자에서 나오지 않는다(확률은 그대로, 종류만 대신한다).
      const UL = theme.unlock, ul = opt.unlocked !== undefined ? opt.unlocked : (UL && UL.provider ? UL.provider() : null);
      this.unlocked = Array.isArray(ul) ? ul.filter((x) => typeof x === 'string').slice(0, 64) : null;
      this.lockedSet = new Set(this.unlocked && UL ? UL.lockedIds().filter((id) => !this.unlocked.includes(id)) : []);
      this.itemUnit = {}; Object.keys(theme.recipes).forEach((id) => { const r = theme.recipes[id]; if (!Array.isArray(r) && r.item) this.itemUnit[r.item] = id; });
      this.rankOf = {}; theme.ranks.forEach((r) => (this.rankOf[r.t] = r));
      this.bossByRound = {}; theme.bosses.forEach((b) => (this.bossByRound[b.round] = b));
      this.midByRound = {}; theme.midbosses.forEach((m) => (this.midByRound[m.round] = m));
      this.time = 0; this.round = 0; this.roundT = 0; this.phase = 'wave'; this.over = null;
      this.units = []; this.drops = []; this.midDone = {}; this.enemies = []; this.fx = []; this.events = []; this.nextId = 1;
      // 판 변형 규칙(악몽 +N): 고른 규칙들의 효과를 하나로 합친다. 배율은 곱하고, 한도는 작은 쪽, 나머지는 더한다.
      this.mutLv = opt.mutLv || 0;
      this.muts = (opt.muts || []).map((id) => (theme.mutators || []).find((m) => m.id === id)).filter(Boolean);
      const MUL = { bossAtk: 1, laneHp: 1, midHp: 1, bossGap: 1, bossGold: 1, spawn: 1, bossHp: 1, hazDmg: 1, champHp: 1, champAtk: 1, bossTime: 1, itemLuck: 1 };
      this.mut = Object.assign({ extraPat: [] }, MUL);
      this.muts.forEach((m) => Object.keys(m.eff).forEach((k) => {
        const v = m.eff[k];
        if (k === 'extraPat') this.mut.extraPat.push(v);
        else if (k in MUL) this.mut[k] *= v;
        else if (k === 'limit' || k === 'lives') this.mut[k] = Math.min(this.mut[k] || 1e9, v);
        else if (typeof v === 'number') this.mut[k] = (this.mut[k] || 0) + v;
        else this.mut[k] = v;
      }));
      this.spawned = 0; this.toSpawn = 0; this.mids = {}; this.lives = this.mut.lives || this.R.lives;
      this.players = [this.newPlayer(0)];
      this.me = this.players[0];
      // 판 끝 통계(내 것만 센다)
      this.stats = { kills: 0, midKill: 0, midMiss: 0, lifeLost: 0, goldIn: 0, goldUp: 0, goldHire: 0, combines: 0, crafts: [], chests: 0, tickets: 0, best: 0, bestName: '', dmgUnit: {}, bosses: [] };
      this.auraT = 0; this.achDirty = true; this.fight = null; this.speed = 1;
      this.players.forEach((p) => {
        p.gold = this.R.startGold + (this.mut.startGold || 0);
        for (let i = 0; i < this.diff.startUnits; i++) this.spawnUnit(p, this.pick(this.tierIds(1)));
        if (this.mut.startTier) this.spawnUnit(p, this.pick(this.tierIds(this.mut.startTier)));
        if (this.mut.startHire) { p.gold += this.defs[this.mut.startHire].cost; this.hire(p, this.mut.startHire); p.gold = Math.max(0, p.gold); if (p === this.me) this.stats.goldHire = 0; }
      });
      this.nextRound();
    }

    get limit() { return Math.min(this.R.enemyLimit, this.mut.limit || 1e9); }
    get party() { return this.mode === 'solo' ? 1 : Math.max(1, this.net ? this.net.partySize() : 1); }
    get isAuthority() { return !this.net || this.net.isHost(); }

    newPlayer(idx) {
      return { idx, gold: 0, upgrades: {}, tickets: {}, auto: {}, zones: { t1: 'L', t2: 'B1', t3: 'B2', t45: 'R' }, ever: {}, done: {} };
    }
    log(type, data) { this.events.push(Object.assign({ type }, data)); }
    pick(a) { return a[(this.rand() * a.length) | 0]; }
    // 신화·불멸 아이템을 들고 있으면 그 아이템 조합식에 들어가는 장수(재료의 재료까지)가 더 잘 나온다
    relatedToItems(p) {
      const out = new Set(), walk = (id) => { if (out.has(id)) return; out.add(id); const r = this.recipeOf(id); if (r) r.parts.forEach(walk); };
      this.drops.forEach((d) => {
        if (d.owner !== p.idx || d.kind !== 'item') return;
        const id = Object.keys(this.T.recipes).find((x) => this.recipeOf(x).item === d.item);
        if (id) this.recipeOf(id).parts.forEach(walk);
      });
      return out;
    }
    pickFor(p, a) {
      const rel = this.relatedToItems(p), k = this.R.itemBias, w = a.map((id) => (rel.has(id) ? k : 1));
      let r = this.rand() * w.reduce((s, x) => s + x, 0);
      for (let i = 0; i < a.length; i++) { r -= w[i]; if (r < 0) return a[i]; }
      return a[a.length - 1];
    }
    tierIds(t) { return this.T.units.filter((d) => d.tier === t && !this.lockedSet.has(d.id)).map((d) => d.id); }
    isLocked(id) { return this.lockedSet.has(id); }
    // 조합 아이템이 잠긴 장수 전용이면 false
    itemOpen(itemId) { const u = this.itemUnit[itemId]; return !u || !this.lockedSet.has(u); }

    // ---- 유닛 ----
    spawnUnit(p, defId, x, y, quiet) {
      const d = this.defs[defId];
      // 새 유닛은 어떤 경로로 얻든 항상 중앙 성채에서 태어난다
      x = (ROAD.x0 + ROAD.x1) / 2 + (this.rand() - 0.5) * 160; y = H / 2 + (this.rand() - 0.5) * 100;
      const u = { id: this.nextId++, def: d, owner: p.idx, x, y, cd: this.rand() * 0.5, order: { t: 'idle' }, target: null, aura: 0, hits: 0, scan: 0, fl: 0 };
      this.units.push(u);
      p.ever[defId] = true; this.achDirty = true; this.auraT = 0;
      if (p === this.me && d.tier === 10) (this.stats.imm = this.stats.imm || {})[d.id] = (this.stats.imm[d.id] || 0) + 1; // 랭킹: 불멸 소환 수
      if (p === this.me && d.tier >= 9) (this.stats.myth = this.stats.myth || {})[d.id] = (this.stats.myth[d.id] || 0) + 1; // 전적: 신화 이상 소환
      if (p === this.me && d.tier > this.stats.best) { this.stats.best = d.tier; this.stats.bestName = d.name; }
      // 등장 연출: 7성 이상은 항상, 6성은 90라운드까지, 4성은 55라운드 전·5성은 70라운드 전까지만, 선택권으로 고른 유닛은 생략
      const loud = d.tier >= 7 || (d.tier === 6 && this.round <= 90) || (!quiet && ((d.tier === 4 && this.round < 55) || (d.tier === 5 && this.round < 70)));
      if (p === this.me && loud) this.log('pop', { def: d });
      if (p === this.me) this.autoPlace(p, u);
      return u;
    }
    autoKey(t) { return t >= 1 && t <= 3 ? 't' + t : t === 4 || t === 5 ? 't45' : null; }
    // 정렬 구역: 왼쪽 벽 1(L), 아래쪽 벽 3(B1~B3), 오른쪽 벽 1(R). 등급 묶음마다 어느 구역에 둘지 고른다.
    // 같은 유닛끼리 한 줄로 서고, 위쪽 라인은 메인 유닛 자리로 비운다.
    autoIds(key) { return key === 't45' ? this.tierIds(4).concat(this.tierIds(5)) : this.tierIds(+key.slice(1)); }
    // 구역 안의 i번째 칸. 벽에 붙은 줄부터 빈틈없이 채우고, 줄이 차면 한 칸 안쪽 줄로 넘어간다.
    sortPos(zone, i) {
      const I = INNER, gap = 42;
      if (zone === 'L' || zone === 'R') {
        const top = I.y0 + 150, rows = Math.floor((I.y1 - 130 - top) / gap) + 1, r = i % rows, c = Math.floor(i / rows);
        return [zone === 'L' ? I.x0 + 14 + c * gap : I.x1 - 14 - c * gap, top + r * gap];
      }
      const z = +zone.slice(1) - 1, x0 = I.x0 + 130 + z * 290, cols = 7, c = i % cols, r = Math.floor(i / cols);
      return [x0 + c * gap, I.y1 - 14 - r * gap];
    }
    setZone(p, key, zone) {
      // 이미 다른 묶음이 쓰는 구역이면 서로 맞바꾼다
      const other = Object.keys(p.zones).find((x) => x !== key && p.zones[x] === zone);
      if (other) p.zones[other] = p.zones[key];
      p.zones[key] = zone;
      this.tidy(p);
    }
    arrange(p, u) {
      const used = {};
      this.units.forEach((o) => { if (o.slot && o.def === u.def && o.owner === p.idx) used[o.slot.n] = true; });
      let n = 0; while (used[n]) n++;
      u.slot = { n };
      this.tidy(p);
    }
    // 정렬 중인 유닛을 빈칸 없이 앞으로 당겨 세운다(합성으로 빠진 자리, 보스전 뒤 멈춘 유닛 포함)
    // 자동 정렬이 켜진 묶음마다: 같은 유닛끼리 이어서, 구역 칸을 앞에서부터 채운다(합성으로 빈 칸은 당겨 메운다)
    tidy(p) {
      Object.keys(p.zones).forEach((key) => {
        if (!p.auto[key] && !p.arrangeAll) return; // AI 사령관은 합성 없이 정렬만 쓴다(arrangeAll)
        const ids = this.autoIds(key), zone = p.zones[key];
        const list = this.units.filter((u) => u.owner === p.idx && u.slot && !this.inFight(u) && ids.includes(u.def.id))
          .sort((a, b) => ids.indexOf(a.def.id) - ids.indexOf(b.def.id) || a.slot.n - b.slot.n);
        let prev = null, n = 0;
        list.forEach((u, i) => {
          n = u.def.id === prev ? n + 1 : 0; prev = u.def.id;
          u.slot.n = n;
          const [px, py] = this.sortPos(zone, i), x = clamp(px, INNER.x0, INNER.x1), y = clamp(py, INNER.y0, INNER.y1);
          const going = u.order.t === 'move' && u.order.x === x && u.order.y === y;
          if (!going && dist(u.x, u.y, x, y) > 6) { u.order = { t: 'move', x, y, after: 'hold' }; u.target = null; }
        });
      });
    }
    autoPlace(p, u) { const k = this.autoKey(u.def.tier); if (k && p.auto[k]) this.arrange(p, u); }
    setAuto(p, key, on) {
      p.auto[key] = on;
      if (on && key !== 'sell') {
        this.units.filter((u) => u.owner === p.idx && this.autoKey(u.def.tier) === key && !u.slot).forEach((u) => this.arrange(p, u));
        this.runAuto(p);
      }
    }
    runAuto(p) {
      [1, 2, 3].forEach((t) => {
        if (!p.auto['t' + t]) return;
        this.tierIds(t).forEach((id) => { while (this.canCombine(p, id)) this.combine(p, id); });
      });
      this.tidy(p);
    }
    removeUnit(u) {
      const i = this.units.indexOf(u);
      if (i >= 0) this.units.splice(i, 1);
      this.achDirty = true; this.auraT = 0;
      this.log('removed', { id: u.id });
    }
    ownedOf(p, defId) { return this.units.filter((u) => u.owner === p.idx && u.def.id === defId); }
    // 보스전에 나가 있는 유닛. 결투에서 쓰러진 유닛은 라인으로 돌아온 것으로 보고 조합 재료로 쓸 수 있다(다시 출전은 못 한다).
    inFight(u) {
      const f = this.fight;
      if (!(f && this.phase !== 'wave' && f.used[u.id])) return false;
      const c = f.champs.find((x) => x.uid === u.id);
      return !c || !c.dead;
    }
    freeOf(p, defId) { return this.ownedOf(p, defId).filter((u) => !this.inFight(u)); }
    has(p, defId) { return this.units.some((u) => u.owner === p.idx && u.def.id === defId); }
    upgradeGroup(d) { return this.T.upgrades.find((g) => g.test(d)); }
    upgradeLevel(p, d) { const g = this.upgradeGroup(d); return g ? p.upgrades[g.id] || 0 : 0; }
    range(d) { return d.rng || this.R.baseRange; }
    attackTime(d) { return d.as || this.R.baseAttackTime; }
    passives(d, k) { return (d.p || []).filter((x) => x.k === k); }
    teamPassives(p, k) {
      const out = [];
      this.units.forEach((u) => { if (u.owner === p.idx) (u.def.p || []).forEach((x) => { if (x.k === k) out.push(x); }); });
      return out;
    }
    globalBuff(p, d) {
      let v = 0; const seen = {};
      this.teamPassives(p, 'globalAtk').forEach((x) => {
        if ((x.fac === 'all' || x.fac === d.fac) && !seen[x.name]) { seen[x.name] = 1; v += x.pct; }
      });
      return v;
    }
    baseAtk(p, d) {
      const r = this.rankOf[d.tier];
      if (!r) return 0;
      // 공격 속도가 다른 장수도 등급 표기 공격력은 초당 피해 기준으로 맞춘다
      // 강화 1단계당 공격력 증가율: 난이도별 upPct(없으면 0.2). 2026-11-17 보통·어려움 0.25(강화를 챙기는 쪽이 보상받게)
      return r.atk * this.attackTime(d) * (1 + (this.diff.upPct || 0.2) * this.upgradeLevel(p, d));
    }
    unitAtk(u) {
      const p = this.players[u.owner];
      return this.baseAtk(p, u.def) * (1 + this.globalBuff(p, u.def) + u.aura + this.synFor(u.owner, u.def).atk + (this.mut.atk || 0) + this.mutAtk());
    }
    recomputeAuras() {
      this.units.forEach((u) => (u.aura = 0));
      this.units.forEach((src) => (src.def.p || []).forEach((x) => {
        if (x.k !== 'aura') return;
        this.units.forEach((u) => {
          if (u.owner === src.owner && (!x.fac || x.fac === u.def.fac) && u.aura < x.pct && dist(u.x, u.y, src.x, src.y) <= x.r) u.aura = x.pct;
        });
      }));
      // 인연 시너지: 인물이 모두 있으면 켜진다
      this.players.forEach((p) => { p.syn = {}; (this.T.synergies || []).forEach((s) => { if (s.units.every((id) => this.has(p, id))) p.syn[s.id] = s; }); });
      this.fieldSlow = this.players.reduce((m, p) => Math.max(m, ...this.teamPassives(p, 'fieldSlow').map((x) => x.pct), 0) + this.synVal(p, 'fieldSlow'), 0);
    }
    // 이 유닛에 걸리는 시너지 효과 합(atk·guard·cdr·crit 목록)
    synFor(owner, d) {
      const p = this.players[owner], out = { atk: 0, guard: 0, cdr: 0, skill: 0, hp: 0, boss: 0, burn: 0, crit: [] };
      if (!p || !p.syn) return out;
      const add = (o, name) => {
        ['atk', 'guard', 'cdr', 'skill', 'hp', 'boss', 'burn'].forEach((k) => { if (o[k]) out[k] += o[k]; });
        if (o.crit) out.crit.push({ name, ch: o.crit.ch, mult: o.crit.mult });
      };
      Object.values(p.syn).forEach((s) => {
        const e = s.eff || {};
        if ((e.only || s.units).includes(d.id)) add(e, s.name);
        if (s.per && s.per[d.id]) add(s.per[d.id], s.name);
        if (e.facAtk && d.fac === e.facAtk.fac) out.atk += e.facAtk.pct;
      });
      return out;
    }
    synVal(p, k) { return Object.values(p.syn || {}).reduce((a, s) => a + ((s.eff || {})[k] || 0), 0); }

    // ---- 플레이어 명령 ----
    cmd(kind, ids, x, y) {
      const list = this.units.filter((u) => ids.includes(u.id) && u.owner === this.me.idx);
      const n = list.length;
      list.forEach((u, i) => {
        u.slot = null; // 직접 움직인 유닛은 정렬에서 제외한다
        // 다중 선택 이동은 격자로 벌려 한 점에 뭉치지 않게 한다
        const col = Math.ceil(Math.sqrt(n)), ox = ((i % col) - (col - 1) / 2) * 52, oy = (Math.floor(i / col) - (Math.ceil(n / col) - 1) / 2) * 52;
        const tx = clamp(x + ox, INNER.x0, INNER.x1), ty = clamp(y + oy, INNER.y0, INNER.y1);
        if (kind === 'move') u.order = { t: 'move', x: tx, y: ty };
        else if (kind === 'amove') u.order = { t: 'amove', x: tx, y: ty };
        else if (kind === 'stop') { u.order = { t: 'idle' }; u.target = null; }
        else if (kind === 'hold') { u.order = { t: 'hold' }; u.target = null; }
        else if (kind === 'focus') {
          // 점사: 다른 명령 전까지 유지되며, 사거리 안에 중간보스가 있으면 무조건 중간보스를 때린다
          u.order = { t: 'focus' }; u.target = this.midInRange(u.x, u.y, this.range(u.def)) || u.target; u.scan = 0;
        }
      });
    }
    canCombine(p, defId) {
      const d = this.defs[defId], need = this.T.combineNeed[d.tier];
      return need ? this.freeOf(p, defId).length >= need : false;
    }
    combine(p, defId, preferId) {
      if (!this.canCombine(p, defId)) return null;
      const d = this.defs[defId], need = this.T.combineNeed[d.tier];
      const own = this.freeOf(p, defId).sort((a, b) => (b.id === preferId) - (a.id === preferId));
      const used = own.slice(0, need), at = used[0], x = at.x, y = at.y;
      used.forEach((u) => this.removeUnit(u));
      const n = this.spawnUnit(p, this.pickFor(p, this.tierIds(d.tier + 1)), x, y);
      this.fxBurst(x, y, '#ffe9a8', 40);
      if (p === this.me) { this.log('sfx', { s: 'combine' }); this.stats.combines++; }
      if (p === this.me) this.log('toast', { text: this.L('e_combined', { a: d.name, n: need, b: n.def.name, r: this.rankOf[n.def.tier].name }, `${d.name} ${need}기 → ${n.def.name}(${this.rankOf[n.def.tier].name})`), tone: 'good' });
      this.combineBonus(p);
      return n;
    }
    combineAll(p) {
      let made = 0, again = true;
      while (again) {
        again = false;
        for (const t of [1, 2, 3, 4, 5]) for (const id of this.tierIds(t)) if (this.canCombine(p, id)) { this.combine(p, id); made++; again = true; }
      }
      return made;
    }
    recipeOf(id) { const r = this.T.recipes[id]; if (!r) return null; return Array.isArray(r) ? { parts: r } : r; }
    recipeStatus(p, id) {
      const r = this.recipeOf(id), need = {};
      r.parts.forEach((x) => (need[x] = (need[x] || 0) + 1));
      const parts = Object.keys(need).map((x) => ({ id: x, need: need[x], have: this.freeOf(p, x).length }));
      const hasItem = !r.item || !!this.findItem(p, r.item);
      const locked = this.lockedSet.has(id);
      return { parts, item: r.item, hasItem, locked, ok: !locked && hasItem && parts.every((x) => x.have >= x.need) };
    }
    craft(p, id) {
      const st = this.recipeStatus(p, id);
      if (!st.ok) return null;
      let pos = null;
      st.parts.forEach((x) => this.freeOf(p, x.id).slice(0, x.need).forEach((u) => { pos = pos || [u.x, u.y]; this.removeUnit(u); }));
      if (st.item) { this.removeDrop(this.findItem(p, st.item)); (p.usedItems = p.usedItems || []).push(st.item); }
      const n = this.spawnUnit(p, id, pos[0], pos[1]);
      this.fxBurst(pos[0], pos[1], this.T.factions[n.def.fac].color, 80);
      if (p === this.me) { this.log('sfx', { s: n.def.tier >= 9 ? 'legend' : 'craft' }); this.stats.crafts.push(n.def.name); }
      if (p === this.me) this.log('toast', { text: this.L('e_joined', { a: n.def.name }, `${n.def.name} 합류`), tone: 'good' });
      this.combineBonus(p);
      return n;
    }
    useTicket(p, tier, defId) {
      if (!(p.tickets[tier] > 0) || !this.defs[defId] || this.defs[defId].tier !== tier || this.lockedSet.has(defId)) return false;
      p.tickets[tier]--; if (p === this.me) this.stats.tickets++; this.spawnUnit(p, defId, undefined, undefined, true);
      return true;
    }
    sell(p, u) {
      if (u.def.tier !== 1 || this.inFight(u)) return 0;
      const v = this.disbandValue();
      this.removeUnit(u); p.gold += v; if (p === this.me) this.stats.goldIn += v;
      return v;
    }
    // 1성 해산 금화: R.disbandGold 범위에 난이도별 sellGold(없으면 1)를 곱한다. 2026-11-17 보통·어려움 0.7(기본 수입을 줄이고 보스·명사 쪽 비중을 키움)
    disbandValue() {
      const [a, b] = this.R.disbandGold, v = a + Math.floor(this.rand() * (b - a + 1)), k = this.diff.sellGold || 1;
      return k === 1 ? v : Math.max(1, Math.round(v * k));
    }
    upgradeCost(p, g) {
      const off = Math.min(0.5, this.teamPassives(p, 'discount').reduce((m, x) => Math.max(m, x.pct), 0) + (this.mut.upDisc || 0));
      // 6단계까지는 단계에 비례하고, 그 뒤로는 단계마다 25%씩, 13단계부터는 50%씩 더 비싸진다.
      // 악몽에서 금화를 모두 챙기고(명사 다섯·사마휘 할인·채문희 보너스) 주력 진영 하나만 20강을 찍을 수 있는 정도.
      const lv = p.upgrades[g.id] || 0;
      return Math.floor(g.base * (lv + 1) * (1 + Math.max(0, lv - 5) * 0.25 + Math.max(0, lv - 11) * 0.5) * (1 - off));
    }
    buyUpgrade(p, gid) {
      const g = this.T.upgrades.find((x) => x.id === gid), lv = p.upgrades[gid] || 0, c = this.upgradeCost(p, g);
      if (lv >= this.upMax(p, g) || p.gold < c) return false;
      p.gold -= c; p.upgrades[gid] = lv + 1; if (p === this.me) this.stats.goldUp += c;
      return true;
    }
    sagesOf(p) { return this.units.filter((u) => u.owner === p.idx && u.def.tier === 0); }
    sageMax() { return this.mut.noSage ? 0 : this.T.sageMax || 99; }
    // 변형 규칙의 상황 공격력: 배수진(라이프 5 이하), 대군 쇄도(전선의 적 10마리마다)
    mutAtk() { return (this.mut.lowLifeAtk && this.lives <= 1 ? this.mut.lowLifeAtk : 0) + (this.mut.hordeAtk ? Math.floor(this.enemies.length / 10) * this.mut.hordeAtk : 0); }
    fastNeed() { return this.mut.fastNeed || this.T.fastClearRemain; }
    hire(p, id) {
      const d = this.defs[id], mine = this.sagesOf(p);
      if (d.tier !== 0 || this.has(p, id) || p.gold < d.cost || mine.length >= this.sageMax()) return false;
      p.gold -= d.cost; if (p === this.me) this.stats.goldHire += d.cost;
      // 영입한 명사는 중원 성채 양옆의 빈자리(최대 4칸)에 선다
      const taken = mine.map((u) => u.sageSlot), k = [0, 1, 2, 3, 4, 5].find((i) => !taken.includes(i));
      const u = this.spawnUnit(p, id), cx = (ROAD.x0 + ROAD.x1) / 2;
      u.sageSlot = k; u.x = cx + (k % 2 ? 1 : -1) * (160 + Math.floor(k / 2) * 76); u.y = H / 2;
      this.auraT = 0;
      return true;
    }
    // 해임: 자리를 비우고 금화는 돌려주지 않는다
    dismiss(p, id) {
      const u = this.sagesOf(p).find((x) => x.def.id === id);
      if (!u) return false;
      this.removeUnit(u);
      if (p === this.me) this.log('toast', { text: this.L('e_dismissed', { a: u.def.name }, `${u.def.name} 해임`), tone: 'warn' });
      return true;
    }
    sageVal(p, k, f) { return this.teamPassives(p, k).reduce((m, x) => Math.max(m, x[f || 'pct']), 0); }
    // 견희: 6성 이상 공격 속도
    hasteOf(owner, d) {
      const p = this.players[owner];
      if (!p || !d.tier) return 0;
      return this.teamPassives(p, 'tierHaste').reduce((m, x) => (d.tier >= x.tier ? Math.max(m, x.pct) : m), 0);
    }
    // 좌자: 강화 최대 단계
    upMax(p, g) { return g.max + this.synVal(p, 'upMax'); }
    // 우길: 합성할 때마다 랜덤 1성
    combineBonus(p) {
      if (!this.teamPassives(p, 'combineT1').length) return;
      this.spawnUnit(p, this.pick(this.tierIds(1)));
      if (p === this.me) this.stats.sageT1 = (this.stats.sageT1 || 0) + 1;
    }
    // 상자와 아이템은 게임판에 놓인 말이다. 상자를 클릭하면 그 자리에 내용물이 나온다.
    spawnDrop(p, kind, extra, x, y) {
      if (x == null) { x = W / 2 + (this.rand() - 0.5) * 420; y = 240 + this.rand() * 90; }
      const d = Object.assign({ id: this.nextId++, kind, owner: p.idx, x, y, born: this.time }, extra);
      this.drops.push(d);
      this.achDirty = true;
      return d;
    }
    // 상자·아이템도 유닛처럼 옮길 수 있다(겹쳐서 집기 어려울 때)
    moveDrop(p, d, x, y) {
      if (!d || d.owner !== p.idx) return;
      d.tx = clamp(x, INNER.x0, INNER.x1); d.ty = clamp(y, INNER.y0, INNER.y1);
    }
    stepDrops(dt) {
      for (const d of this.drops) {
        if (d.tx == null) continue;
        const dx = d.tx - d.x, dy = d.ty - d.y, l = Math.hypot(dx, dy), s = 420 * dt;
        if (l <= s) { d.x = d.tx; d.y = d.ty; d.tx = d.ty = null; } else { d.x += (dx / l) * s; d.y += (dy / l) * s; }
      }
    }
    removeDrop(d) { const i = this.drops.indexOf(d); if (i >= 0) this.drops.splice(i, 1); this.log('dropGone', { id: d.id }); }
    findItem(p, id) { return this.drops.find((d) => d.owner === p.idx && d.kind === 'item' && d.item === id); }
    // 들고 있거나 이미 조합에 써 버린 아이템(다시 나오지 않는다)
    itemDone(p, id) { return !!this.findItem(p, id) || (p.usedItems || []).includes(id); }
    dropName(d) {
      if (d.kind === 'chest') return this.T.chestName;
      if (d.kind === 'item') return this.T.items.find((i) => i.id === d.item).name;
      return this.T.consumables[d.kind].name;
    }
    openChest(p, d) {
      if (!d || d.kind !== 'chest' || d.owner !== p.idx) return null;
      this.removeDrop(d);
      if (p === this.me) this.stats.chests++;
      const tb = this.T.chestTable.map((x) => (x.kind === 'item' && x.tier === 10 ? Object.assign({}, x, { w: x.w * this.mut.itemLuck }) : x)), sum = tb.reduce((a, b) => a + b.w, 0);
      let r = this.rand() * sum, row = tb[0];
      for (const x of tb) { r -= x.w; if (r <= 0) { row = x; break; } }
      // 신화·불멸 조합 아이템은 같은 것을 한 번에 하나만 갖는다: 이미 들고 있는 것은 빼고 뽑고,
      // 그 등급을 다 들고 있으면 다른 등급, 그것도 없으면 등급 상승권을 준다
      const held = (i) => this.itemDone(p, i.id); // 들고 있거나 이미 조합에 쓴 것은 빼고 뽑는다
      // 잠긴 장수 전용 아이템도 뺀다. 그 등급에 열린 것이 없으면 한 등급 아래(불멸 → 신화), 그래도 없으면 남은 열린 아이템 아무거나
      const open = row.kind === 'item' ? this.T.items.filter((i) => !held(i) && this.itemOpen(i.id)) : [];
      const pool = open.filter((i) => i.tier === row.tier), down = pool.length ? pool : open.filter((i) => i.tier < row.tier);
      const any = down.length ? down : open;
      const out = row.kind !== 'item' ? this.spawnDrop(p, row.kind, {}, d.x, d.y)
        : any.length ? this.spawnDrop(p, 'item', { item: this.pick(any).id }, d.x, d.y)
        : this.spawnDrop(p, 'rankUp', {}, d.x, d.y);
      this.fxBurst(d.x, d.y, '#ffd86a', 60);
      if (p === this.me) this.log('sfx', { s: 'chest' });
      if (p === this.me) this.log('toast', { text: `${this.T.chestName}: ${this.dropName(out)}`, tone: 'good' });
      return out;
    }
    mythItems(p) { return this.drops.filter((d) => d.owner === p.idx && d.kind === 'item' && this.T.items.find((i) => i.id === d.item).tier === 9); }
    fuseTargets(p) { return this.T.items.filter((i) => i.tier === 10 && !this.itemDone(p, i.id) && this.itemOpen(i.id)); }
    canFuse(p) { return this.mythItems(p).length >= 4 && this.fuseTargets(p).length > 0; }
    fuseItems(p, keepId) {
      if (!this.canFuse(p)) return null;
      const list = this.mythItems(p), first = list.find((d) => d.id === keepId) || list[0];
      const use = [first].concat(list.filter((d) => d !== first).slice(0, 3)), x = first.x, y = first.y;
      use.forEach((d) => this.removeDrop(d));
      const out = this.spawnDrop(p, 'item', { item: this.pick(this.fuseTargets(p)).id }, x, y);
      this.fxBurst(x, y, '#ff6a4a', 110);
      if (p === this.me) { this.log('sfx', { s: 'legend' }); this.log('toast', { text: this.L('e_fused', { a: this.dropName(out) }, `신화 아이템 4개 → ${this.dropName(out)}`), tone: 'good' }); }
      return out;
    }
    canUseDrop(d, u) {
      if (d.kind === 'rankUp') return u.def.tier >= 1 && u.def.tier <= 5;
      // 장수 교체권: 7성 이상 장수를 같은 등급의 다른 장수로(세력 무관)
      if (d.kind === 'generalSwap') return u.def.tier >= 7 && this.tierIds(u.def.tier).some((x) => x !== u.def.id);
      if (d.kind === 'factionReroll') return u.def.tier >= 2 && u.def.tier <= 7 && this.tierIds(u.def.tier).some((x) => this.defs[x].fac !== u.def.fac);
      return false;
    }
    useDrop(p, d, u) {
      if (!d || !u || u.owner !== p.idx || this.inFight(u) || !this.canUseDrop(d, u)) return null;
      const x = u.x, y = u.y, t = u.def.tier;
      const opts = d.kind === 'rankUp' ? this.tierIds(t + 1)
        : d.kind === 'generalSwap' ? this.tierIds(t).filter((id) => id !== u.def.id)
        : this.tierIds(t).filter((id) => this.defs[id].fac !== u.def.fac);
      this.removeDrop(d); this.removeUnit(u);
      return this.spawnUnit(p, this.pickFor(p, opts), x, y);
    }
    mulReward(rw, k) {
      const m = (l) => (l || []).map(([t, n]) => [t, n * k]);
      const cons = {}; Object.keys(rw.cons || {}).forEach((c) => (cons[c] = rw.cons[c] * k));
      return Object.assign({}, rw, { gold: rw.gold ? rw.gold * k : 0, randomT1: (rw.randomT1 || 0) * k, tickets: m(rw.tickets), randomT: m(rw.randomT), chest: (rw.chest || 0) * k, cons });
    }
    grant(p, rw, why) {
      const parts = [];
      if (rw.gold) { p.gold += rw.gold; if (p === this.me) this.stats.goldIn += rw.gold; parts.push(`${this.T.currency} ${rw.gold}`); }
      if (rw.randomT1) { for (let i = 0; i < rw.randomT1; i++) this.spawnUnit(p, this.pick(this.tierIds(1))); parts.push(this.L('rwT1', { n: rw.randomT1 }, `랜덤 1성 ${rw.randomT1}기`)); }
      // 1성은 선택권 없이 바로 랜덤 유닛으로 준다
      (rw.tickets || []).forEach(([t, n]) => {
        if (t <= 1) { for (let i = 0; i < n; i++) this.spawnUnit(p, this.pick(this.tierIds(1))); parts.push(this.L('rwT1', { n }, `랜덤 1성 ${n}기`)); return; }
        p.tickets[t] = (p.tickets[t] || 0) + n; parts.push(this.L('rwTicket', { r: this.rankOf[t].name, n }, `${this.rankOf[t].name} 선택권 ${n}장`));
      });
      (rw.randomT || []).forEach(([t, n]) => { for (let i = 0; i < n; i++) this.spawnUnit(p, this.pickFor(p, this.tierIds(t))); parts.push(this.L('rwRandT', { r: this.rankOf[t].name, n }, `랜덤 ${this.rankOf[t].name} ${n}기`)); });
      if (rw.chest) { for (let i = 0; i < rw.chest; i++) this.spawnDrop(p, 'chest'); parts.push(this.L('rwChest', { n: rw.chest }, `${this.T.chestName} ${rw.chest}개`)); }
      Object.keys(rw.cons || {}).forEach((c) => { const n = rw.cons[c]; if (!n) return; for (let i = 0; i < n; i++) this.spawnDrop(p, c); parts.push(this.L('rwCons', { a: this.T.consumables[c].name, n }, `${this.T.consumables[c].name} ${n}장`)); });
      if (p === this.me && why) this.log('toast', { text: `${why}: ${parts.join(', ')}`, tone: 'good' });
    }

    // ---- 라운드 진행 ----
    monsterHp(r) {
      // 쉬움 기준 체력표(R.laneHp) 사이를 로그로 잇고 난이도별 라인 배율(lane)을 곱한다
      const pts = this.R.laneHp;
      let v = pts[pts.length - 1][1];
      for (let i = 0; i < pts.length - 1; i++) {
        const [a, x] = pts[i], [b, y] = pts[i + 1];
        if (r <= b) { v = Math.exp(Math.log(x) + ((Math.max(r, a) - a) / (b - a)) * (Math.log(y) - Math.log(x))); break; }
      }
      // laneBump: 난이도별 [시작 라운드, 끝 라운드, 배율] 구간 보정(없으면 1). 2026-11-17 보통 R31~80 ×1.1(빌드 부족이 중반에 드러나게)
      const bump = (this.diff.laneBump || []).reduce((m, [a, b, k]) => (r >= a && r <= b ? m * k : m), 1);
      return v * this.diff.lane * bump * this.mut.laneHp;
    }
    monsterDef(r) { return Math.floor(r / 5) * (this.diff.mult / 0.4); }
    waveInfo(r) { let w = this.T.waves[0]; this.T.waves.forEach((x) => { if (r >= x.from) w = x; }); return w; }

    // ---- 이어하기(오프라인 혼자): 라인 단계의 판 상태를 저장·복원한다. 보스전 중에는 저장하지 않는다. ----
    // 알림 문구: 언어 모듈이 있으면 그 번역, 없으면(Node 시험 등) 한국어
    L(k, v, ko) { const f = this.T.L; return f ? f(k, v) : ko; }
    snapshot() {
      if (this.phase !== 'wave' || this.over || this.fight) return null;
      const T = this.T, p = this.me;
      return {
        v: 1, at: Date.now(), diff: this.diff.id, mutLv: this.mutLv, muts: this.muts.map((m) => m.id), unl: this.unlocked,
        round: this.round, roundT: this.roundT, time: this.time, lives: this.lives, nextId: this.nextId,
        spawned: this.spawned, toSpawn: this.toSpawn, spawnCd: this.spawnCd || 0, endedRound: this.endedRound, midDone: this.midDone, mids: this.mids, stats: this.stats,
        me: { gold: p.gold, upgrades: p.upgrades, tickets: p.tickets, auto: p.auto, zones: p.zones, ever: p.ever, done: p.done, usedItems: (p.usedItems || []).slice() },
        units: this.units.filter((u) => u.owner === p.idx).map((u) => ({ id: u.id, d: u.def.id, x: Math.round(u.x), y: Math.round(u.y), slot: u.slot || null, o: u.order && (u.order.t === 'hold' || u.order.t === 'focus') ? u.order.t : 'idle', ss: u.sageSlot })),
        drops: this.drops.map((d) => Object.assign({}, d)),
        enemies: this.enemies.map((e) => ({ id: e.id, w: e.mid ? -1 : T.waves.indexOf(e.w), x: Math.round(e.x), y: Math.round(e.y), seg: e.seg, hp: e.hp, mhp: e.mhp, def: e.def, sp: e.speed, mr: e.midDef ? e.midDef.round : 0, mt: e.midT || 0 })),
      };
    }
    static restore(theme, s) {
      const g = new Game(theme, Object.assign({ diff: s.diff, mode: 'solo', muts: s.muts, mutLv: s.mutLv }, s.unl !== undefined ? { unlocked: s.unl } : {}));
      g.events.length = 0; // 새 판을 만들며 생긴 알림은 버린다
      ['round', 'roundT', 'time', 'lives', 'nextId', 'spawned', 'toSpawn', 'spawnCd', 'endedRound', 'midDone', 'mids', 'stats'].forEach((k) => { if (s[k] !== undefined) g[k] = s[k]; });
      Object.assign(g.me, s.me);
      if (!Array.isArray(g.me.usedItems)) g.me.usedItems = []; // 옛 저장본에는 이 항목이 없다
      g.units = s.units.filter((u) => g.defs[u.d]).map((u) => ({ id: u.id, def: g.defs[u.d], owner: 0, x: u.x, y: u.y, cd: 0, order: { t: u.o || 'idle' }, target: null, aura: 0, hits: 0, scan: 0, fl: 0, slot: u.slot || undefined, sageSlot: u.ss }));
      g.drops = (s.drops || []).map((d) => Object.assign({}, d, { tx: undefined, ty: undefined }));
      g.enemies = (s.enemies || []).map((e) => {
        const m = e.mr ? g.midByRound[e.mr] : null;
        const w = m ? { mark: m.mark, name: m.name, color: '#e8c15a', look: theme.midLooks[m.name] } : theme.waves[Math.max(0, e.w)];
        const o = { id: e.id, w, x: e.x, y: e.y, seg: e.seg, hp: e.hp, mhp: e.mhp, def: e.def, speed: e.sp, mid: !!m, slow: 0, slowT: 0, burn: 0, burnT: 0, stun: 0, r: m ? 24 : 13 };
        if (m) { o.midDef = m; o.midT = e.mt; }
        return o;
      });
      g.phase = 'wave'; g.fight = null; g.achDirty = true; g.auraT = 0;
      g.recomputeAuras();
      return g;
    }
    nextRound() {
      if (this.isAuthority) {
        const r = this.round + 1;
        if (this.net) this.net.send('phase', { p: 'round', r });
        this.applyRound(r);
      }
    }
    applyRound(r) {
      if (this.over) return;
      this.round = r; this.roundT = 0; this.spawned = 0; this.spawnCd = 0;
      this.toSpawn = Math.round(this.R.spawnCount * this.mut.spawn);
      if (this.bossByRound[r]) { this.startBoss(this.bossByRound[r]); return; }
      this.phase = 'wave';
      const m = this.midByRound[r];
      if (m) this.spawnMid(m);
      this.log('round', { round: r });
    }
    spawnMid(m) {
      const mm = this.R.midHpMul;
      let k = mm[mm.length - 1][1];
      for (let i = 0; i < mm.length - 1; i++) if (m.round <= mm[i + 1][0]) { const [a, x] = mm[i], [b, y] = mm[i + 1]; k = x + ((Math.max(m.round, a) - a) / (b - a)) * (y - x); break; }
      const late = 1 + Math.max(0, Math.min(m.round, 115) - 45) / 70; // 후반 중간보스 강화(R45 ×1 → R115 ×2)
      const hpBase = this.monsterHp(m.round) * k * this.mut.midHp * late;
      const e = this.spawnEnemy({ mark: m.mark, name: m.name, color: '#e8c15a', look: this.T.midLooks[m.name] }, hpBase, this.monsterDef(m.round) * 4, this.R.midSpeed, true);
      e.midDef = m; e.midT = this.R.midLimit;
      this.mids[m.round] = { state: 'field' };
      this.log('banner', { text: this.L('e_midBanner', { a: m.name }, `중간보스 ${m.name}`), sub: m.story });
      this.log('sfx', { s: 'warn' });
    }
    loseLife(n, why) {
      this.stats.lifeLost += Math.min(n, this.lives);
      this.lives = Math.max(0, this.lives - n);
      this.log('toast', { text: this.L('e_lifeLost', { n, why }, `라이프 -${n}: ${why}`), tone: 'warn' });
      this.log('sfx', { s: 'life' });
      if (this.lives <= 0) { this.finish(false); if (this.net) this.net.send('phase', { p: 'over', win: false }); }
    }
    spawnEnemy(w, hp, def, speed, mid) {
      const e = { id: this.nextId++, w, x: PATH[0][0] - 10, y: PATH[0][1], seg: 0, hp, mhp: hp, def, speed, mid: !!mid, slow: 0, slowT: 0, burn: 0, burnT: 0, stun: 0, r: mid ? 24 : 13 };
      this.enemies.push(e);
      return e;
    }
    spawnWave(dt) {
      if (this.spawned >= this.toSpawn) return;
      this.spawnCd -= dt;
      if (this.spawnCd > 0) return;
      this.spawnCd = this.R.spawnInterval;
      this.spawned++;
      // 한도를 넘으면 몹 대신 라이프가 깎인다
      if (this.enemyCount() >= this.limit) { this.loseLife(1, this.L('e_frontFull', null, '전선 포화')); return; }
      const r = this.round, w = this.waveInfo(r), kind = this.spawned % 7 === 0 ? 1 : this.spawned % 5 === 0 ? 2 : 0;
      const hp = this.monsterHp(r) * (kind === 1 ? 1.8 : kind === 2 ? 0.7 : 1) * (r >= 20 ? 1.3 : 1);
      this.spawnEnemy(w, hp, this.monsterDef(r) * (kind === 1 ? 2 : 1), kind === 2 ? 135 : 92, false);
      if (this.mut.elite && this.spawned === Math.ceil(this.toSpawn / 2)) {
        const el = this.spawnEnemy(w,this.monsterHp(r) * 12 * (r >= 20 ? 1.3 : 1), this.monsterDef(r) * 2, 70, false);
        el.elite = true; el.r = 20;
      }
    }
    endRound() {
      this.endedRound = this.round;
      this.players.forEach((p) => {
        for (let i = 0; i < (this.mut.roundT1 || 2) + this.sageVal(p, 'roundT1', 'n'); i++) {
          if (p.auto.sell) { const v = this.disbandValue(); p.gold += v; if (p === this.me) this.stats.goldIn += v; }
          else this.spawnUnit(p, this.pick(this.tierIds(1)));
        }
        // 금화는 특수 유닛 효과로만 라운드마다 들어온다
        const seen = {};
        this.teamPassives(p, 'roundGold').forEach((x) => { if (!seen[x.name]) { seen[x.name] = 1; p.gold += x.n; if (p === this.me) this.stats.goldIn += x.n; } });
        this.teamPassives(p, 'interest').slice(0, 1).forEach((x) => { const v = Math.min(x.max, Math.floor(p.gold * x.pct)); p.gold += v; if (p === this.me) this.stats.goldIn += v; });
      });
    }
    finish(win) {
      if (this.over) return;
      this.over = win ? 'win' : 'lose'; this.phase = 'over';
      this.log('over', { win });
    }

    step(dt) {
      if (this.over) return;
      this.time += dt;
      this.auraT -= dt;
      if (this.auraT <= 0) { this.auraT = 0.5; this.recomputeAuras(); }
      this.stepFx(dt);
      this.stepDrops(dt);
      if (this.phase === 'wave') this.stepWave(dt);
      else if (this.fight) this.stepFight(dt);
      if (this.achDirty) { this.achDirty = false; this.checkAchievements(); }
    }
    stepWave(dt) {
      this.roundT += dt;
      this.spawnWave(dt);
      Object.keys(this.mids).forEach((r) => {
        const s = this.mids[r];
        if (s.state === 'cool') { s.t -= dt; if (s.t <= 0) this.spawnMid(this.midByRound[r]); }
      });
      this.stepEnemies(dt);
      this.stepUnits(dt);
      this.autoT = (this.autoT || 0) - dt;
      if (this.autoT <= 0) { this.autoT = 0.5; this.runAuto(this.me); }
      if (this.over) return;
      if (this.roundT >= this.R.roundTime && this.isAuthority) { this.endRound(); this.nextRound(); }
      else if (this.roundT >= this.R.roundTime && this.net) this.roundT = this.R.roundTime; // 방장의 신호를 기다린다
    }
    enemyCount() { return this.enemies.length; }
    stepEnemies(dt) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.hitT = Math.max(0, (e.hitT || 0) - dt);
        if (e.mid) {
          e.midT -= dt;
          if (e.midT <= 0) {
            this.enemies.splice(i, 1);
            this.mids[e.midDef.round] = { state: 'cool', t: e.midDef.respawn || this.R.midRespawn };
            this.stats.midMiss++;
            this.loseLife(this.R.midLifeLoss, this.L('e_midMissed', { a: e.midDef.name }, `${e.midDef.name} 놓침`));
            if (this.over) return;
            continue;
          }
        }
        if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burn * dt; if (e.hp <= 0) { this.killEnemy(e, this.players[0]); continue; } }
        if (e.stun > 0) { e.stun -= dt; continue; }
        if (e.slowT > 0) e.slowT -= dt; else e.slow = 0;
        const sp = e.speed * (1 - e.slow) * (1 - (this.fieldSlow || 0));
        let move = sp * dt;
        while (move > 0) {
          const [tx, ty] = PATH[(e.seg + 1) % 4], d = dist(e.x, e.y, tx, ty);
          if (d <= move) { e.x = tx; e.y = ty; e.seg = (e.seg + 1) % 4; move -= d; }
          else { e.x += ((tx - e.x) / d) * move; e.y += ((ty - e.y) / d) * move; move = 0; }
        }
      }
    }
    nearestEnemy(x, y, r) {
      let best = null, bd = r * r;
      for (const e of this.enemies) {
        const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    midInRange(x, y, r) {
      for (const e of this.enemies) if (e.mid && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) <= r * r) return e;
      return null;
    }
    stepUnits(dt) {
      const speed = 255;
      for (const u of this.units) {
        if (u.def.tier === 0) continue;
        u.cd -= dt; u.scan -= dt; u.atkT = Math.max(0, (u.atkT || 0) - dt); u.moveT = Math.max(0, (u.moveT || 0) - dt);
        const o = u.order, rng = this.range(u.def);
        // 타워처럼 사거리 안의 적만 때리고, 벗어나면 쫓아가지 않는다
        if (u.target && (u.target.hp <= 0 || !this.enemies.includes(u.target) || dist(u.x, u.y, u.target.x, u.target.y) > rng)) u.target = null;
        // 조이스틱 직접 이동(모바일 라인): 고른 유닛을 조이스틱 방향으로 움직인다. 움직이는 동안은 공격하지 않고, 놓으면 그 자리를 지킨다.
        const J = this.laneJoy;
        if (J && u.owner === this.me.idx && J.ids.has(u.id)) {
          const jm = Math.hypot(J.x, J.y);
          if (jm > 0.1) {
            u.slot = null; u.order = { t: 'hold' }; u.target = null;
            const s = speed * Math.min(1, jm / 0.5) * dt;
            u.x = clamp(u.x + (J.x / jm) * s, INNER.x0, INNER.x1); u.y = clamp(u.y + (J.y / jm) * s, INNER.y0, INNER.y1);
            u.face = Math.atan2(J.y, J.x); u.moveT = 0.12;
            continue;
          }
        }
        if (o.t === 'move') { if (this.moveTo(u, o.x, o.y, speed, dt)) u.order = { t: o.after || 'idle' }; continue; }
        if (o.t === 'focus' && u.scan <= 0) {
          u.scan = 0.05;
          u.target = this.midInRange(u.x, u.y, rng) || u.target || this.nearestEnemy(u.x, u.y, rng);
        } else if (!u.target && u.scan <= 0) {
          u.scan = 0.1 + this.rand() * 0.08;
          u.target = this.nearestEnemy(u.x, u.y, rng);
        }
        if (u.target) {
          const e = u.target;
          u.face = Math.atan2(e.y - u.y, e.x - u.x);
          if (u.cd <= 0) { u.cd = this.attackTime(u.def) / (1 + this.hasteOf(u.owner, u.def)); u.atkT = 0.22; this.attackEnemy(u, e); }
        } else if (o.t === 'amove') {
          if (this.moveTo(u, o.x, o.y, speed, dt)) u.order = { t: 'idle' };
        }
      }
      // 겹침을 살짝 풀어 말이 한 칸에 쌓이지 않게 한다
      const list = this.units;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 1296 && d2 > 0.01 && a.def.tier && b.def.tier) {
            const d = Math.sqrt(d2), push = ((36 - d) / d) * 0.12;
            a.x += dx * push; a.y += dy * push; b.x -= dx * push; b.y -= dy * push;
          }
        }
      }
      // 유닛은 도로에 들어가지 못한다
      list.forEach((u) => { u.x = clamp(u.x, INNER.x0, INNER.x1); u.y = clamp(u.y, INNER.y0, INNER.y1); });
    }
    moveTo(u, x, y, sp, dt) {
      const d = dist(u.x, u.y, x, y);
      if (d < 6) return true;
      this.moveToward(u, x, y, sp, dt);
      return false;
    }
    moveToward(u, x, y, sp, dt) {
      const d = dist(u.x, u.y, x, y) || 1, s = Math.min(d, sp * dt);
      u.moveT = 0.12;
      u.x += ((x - u.x) / d) * s; u.y += ((y - u.y) / d) * s;
      u.face = Math.atan2(y - u.y, x - u.x);
    }
    rollHit(d, u) {
      // 패시브 공통 처리: 치명, n번째 강타
      // procs: 이번 공격에서 터진 패시브 이름(화면에 알리기 위함)
      let mult = 1, big = false;
      const procs = [];
      this.passives(d, 'crit').forEach((x) => { if (this.rand() < x.ch) { mult *= x.mult; big = true; procs.push(x.name); } });
      if (u) {
        u.hits++;
        this.passives(d, 'everyN').forEach((x) => { if (u.hits % x.n === 0) { mult *= x.mult; big = true; procs.push(x.name); } });
        // 시너지 치명(비장의 피 등)
        if (u.owner != null) this.synFor(u.owner, d).crit.forEach((x) => { if (this.rand() < x.ch) { mult *= x.mult; big = true; procs.push(x.name); } });
      }
      return { mult, big, procs };
    }
    attackEnemy(u, e) {
      const d = u.def, p = this.players[u.owner], atk = this.unitAtk(u), { mult, big, procs } = this.rollHit(d, u), wp = this.weapon(d);
      if (u.owner === this.me.idx) this.log('sfx', { s: wp, gap: 70 });
      const shoot = (t, amount) => {
        this.fx.push({ k: 'shot', wp, big: d.tier >= 9, x0: u.x, y0: u.y, x1: t.x, y1: t.y, t: 0, life: 0.24, c: this.shotColor(d) });
        t.hitT = 0.14; t.hitA = Math.atan2(t.y - u.y, t.x - u.x);
        if (d.tier >= 2 || this.rand() < 0.4) this.fx.push({ k: 'spark', x: t.x, y: t.y, t: -0.2, life: 0.18, c: this.shotColor(d), r: d.tier >= 6 ? 26 : 16, a: t.hitA });
        this.damageEnemy(t, amount, u, p);
      };
      shoot(e, atk * mult);
      if (big) this.log('dmgtext', { x: e.x, y: e.y - 16, v: Math.round(atk * mult) });
      this.passives(d, 'multi').forEach((x) => {
        const near = this.enemies.filter((o) => o !== e && dist(o.x, o.y, e.x, e.y) < 200).slice(0, x.n);
        near.forEach((o) => shoot(o, atk * 0.8));
      });
      this.passives(d, 'splash').forEach((x) => {
        this.enemies.filter((o) => o !== e && dist(o.x, o.y, e.x, e.y) < x.r).slice(0, 12).forEach((o) => this.damageEnemy(o, atk * x.pct, u, p));
        this.fx.push({ k: 'ring', x: e.x, y: e.y, r: x.r, t: 0, life: 0.25, c: this.shotColor(d) });
      });
      this.passives(d, 'slow').forEach((x) => { e.slow = Math.max(e.slow, x.pct); e.slowT = x.dur; });
      this.passives(d, 'stun').forEach((x) => { if (!e.mid && this.rand() < x.ch) { e.stun = x.dur; procs.push(x.name); } });
      this.passives(d, 'burn').forEach((x) => { e.burn = Math.max(e.burn, atk * x.pct * (1 + (u.owner != null ? this.synFor(u.owner, d).burn : 0))); e.burnT = x.dur; });
      // 6성 이상 내 유닛의 확률 패시브가 터지면 알린다(유닛마다 0.8초에 한 번까지)
      if (procs.length && u.owner === this.me.idx && d.tier >= 6 && !(u.procT > this.time)) {
        u.procT = this.time + 0.8;
        this.log('proc', { x: u.x, y: u.y, tx: e.x, ty: e.y, names: procs, c: this.shotColor(d), lane: true });
      }
    }
    weapon(d) { const l = this.T.looks[d.id]; return l ? l[0] : 'spear'; }
    shotColor(d) { return d.tier >= 6 ? this.T.factions[d.fac].color : '#f4e8c8'; }
    damageEnemy(e, amount, u, p) {
      if (e.hp <= 0) return;
      const d = u.def;
      let pierce = 0, bonus = 0;
      this.passives(d, 'pierce').forEach((x) => (pierce = Math.max(pierce, x.pct)));
      if (e.mid) this.passives(d, 'bossPct').forEach((x) => (bonus += x.pct));
      const v = Math.max(amount * 0.25, amount * (1 + bonus) - e.def * (1 - pierce));
      if (p === this.me) this.stats.dmgUnit[d.id] = (this.stats.dmgUnit[d.id] || 0) + Math.min(v, e.hp);
      e.hp -= v;
      if (e.hp <= 0) this.killEnemy(e, p, d);
    }
    killEnemy(e, p, d) {
      const i = this.enemies.indexOf(e);
      if (i < 0) return;
      this.enemies.splice(i, 1);
      e.hp = 0;
      if (p === this.me) this.stats.kills++;
      if (e.elite && p) { p.gold += 15; if (p === this.me) { this.stats.goldIn += 15; this.log('dmgtext', { x: e.x, y: e.y - 40, v: '+15', gold: true }); } }
      if (e.mid) {
        this.stats.midKill++;
        const round = e.midDef.round;
        this.midDone[round] = true;
        this.mids[round] = { state: 'cool', t: e.midDef.respawn || this.R.midRespawn };
        this.players.forEach((q) => {
          const mk2 = (this.teamPassives(q, 'midReward').length ? 2 : 1) * (this.mut.midDouble ? 2 : 1);
          let rw = mk2 > 1 ? this.mulReward(e.midDef.reward, mk2) : e.midDef.reward;
          const mg = this.sageVal(q, 'midGold', 'n');
          if (mg) rw = Object.assign({}, rw, { gold: (rw.gold || 0) + mg });
          this.grant(q, rw, this.L('e_defeated', { a: e.midDef.name }, `${e.midDef.name} 토벌`));
        });
        this.log('sfx', { s: 'midkill' });
        this.fxBurst(e.x, e.y, '#ffd86a', 70);
      }
      this.fx.push({ k: 'die', e, x: e.x, y: e.y, t: 0, life: 0.34, c: e.w.color, a: e.hitA || 0 });
    }
    fxBurst(x, y, c, r) { this.fx.push({ k: 'ring', x, y, r, t: 0, life: 0.45, c }); }
    stepFx(dt) {
      for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; if (f.t >= f.life) this.fx.splice(i, 1); }
      if (this.fx.length > 260) this.fx.splice(0, this.fx.length - 260);
    }

    // ---- 업적 ----
    checkAchievements() {
      const p = this.me;
      for (const a of this.T.achievements) {
        if (p.done[a.id]) continue;
        const c = a.cond;
        let ok = false;
        if (c.type === 'have') ok = c.units.every((id) => this.has(p, id));
        else if (c.type === 'haveEach') ok = c.units.every((id) => this.ownedOf(p, id).length >= c.n);
        else if (c.type === 'ever') ok = c.units.every((id) => p.ever[id]);
        else if (c.type === 'tierEver') ok = this.tierIds(c.tier).filter((id) => p.ever[id]).length >= c.n;
        else if (c.type === 'haveSet') ok = Object.keys(c.need).every((id) => this.ownedOf(p, id).length >= c.need[id]);
        else if (c.type === 'sameHave') ok = this.tierIds(c.tier).some((id) => this.ownedOf(p, id).length >= c.n);
        else if (c.type === 'tierHave') ok = this.tierIds(c.tier).reduce((s, id) => s + this.ownedOf(p, id).length, 0) >= c.n;
        else if (c.type === 'speed') ok = this.round <= c.before && (this.phase === 'wave' || this.round < c.before) && Object.keys(p.ever).some((id) => this.defs[id].tier >= c.tier);
        if (ok) this.completeAchievement(p, a);
      }
    }
    completeAchievement(p, a) {
      p.done[a.id] = true;
      this.log('achievement', { ach: a });
      this.grant(p, a.reward, null);
    }
    // 협동 업적: 인원이 min보다 적으면 열리지 않는다. 필요 인원은 지금 인원에 맞춘다.
    partyAchOpen(c) { return this.mode === 'multi' && this.party >= c.min; }
    partyAchNeed(c) { const n = this.party; return c.anyOf ? Math.min(c.anyOf.length, Math.max(2, Math.ceil(n / 2))) : n; }
    checkPartyAchievements(deployed) {
      if (this.mode !== 'multi') return;
      for (const a of this.T.achievements) {
        const c = a.cond;
        if (c.type !== 'party' || this.me.done[a.id] || c.round !== this.round || !this.partyAchOpen(c)) continue;
        const need = this.partyAchNeed(c);
        let ok = false;
        if (c.anyOf) ok = new Set(deployed.filter((id) => c.anyOf.includes(id))).size >= need;
        // 모두가 서로 다른, 같은 등급 유닛으로 출전
        else ok = deployed.length >= need && new Set(deployed).size === deployed.length && deployed.every((id) => this.defs[id].tier === c.sameTierDistinct);
        if (ok) this.completeAchievement(this.me, a);
      }
    }

    // ---- 보스전 ----
    slotCount() { return Math.max(1, (this.mode === 'solo' ? 2 : 1) - (this.mut.slotLess || 0)); }
    bossStats(b) {
      const m = this.diff.mult, scale = this.R.partyBossScale[Math.min(4, this.party - 1)];
      // 이동 중엔 공격하지 못하므로 실제 딜 시간 비율을 넣는다. hpx는 강화까지 고려해 보스별로 맞춘 체력 배율이다.
      // 그 난이도의 마지막 보스면 fhpx(5인 기준 최종 보스 맞춤)를 쓴다
      // bossHpx: 난이도별 라운드→보스 체력 보정(없으면 1). 2026-11-17 보통은 실패를 R90 육손에서 R55~80으로 나눔
      const x = (b.round === this.diff.rounds && b.fhpx ? b.fhpx : b.hpx || 1) * ((this.diff.bossHpx || {})[b.round] || 1);
      const hp = b.reqDps * b.time * this.R.bossUptime * (m / 0.4) * scale * x * this.mut.bossHp;
      const specAtk = b.reqDps / 2;
      return { hp, def: specAtk * 0.25 * m, hit: this.rankOf[b.hitTier].hp * this.diff.bossAtk * this.mut.bossAtk };
    }
    startBoss(b) {
      const s = this.bossStats(b);
      this.phase = 'bossIntro';
      this.units.forEach((u) => { u.order = { t: 'idle' }; u.target = null; });
      this.fight = {
        def: b, t: 0, introT: 4.2, pickT: this.R.pickTime, limit: Math.round(b.time * this.mut.bossTime), champs: [], used: {}, hazards: [], sel: 0, dealt: {}, total: 0,
        boss: { x: W + 160, y: H / 2, tx: W - 280, ty: H / 2, hp: s.hp, mhp: s.hp, def: s.def, hit: s.hit, speed: 120, stun: 0, slow: 0, cast: 0, gap: 3, order: [], atkCd: 2, burn: 0, burnT: 0, charge: null, flash: 0 },
        healUsed: 0, picked: false, pending: 0, ghosts: {}, flushT: 0, syncT: 0,
      };
      this.raidInit(this.fight);
      this.log('bossIntro', { boss: b });
    }
    pickChoices() {
      const f = this.fight;
      // 출전은 2성부터. 2성 이상이 하나도 없을 때만 1성을 내보낸다(바로 패배하지 않게).
      const mine = this.units.filter((u) => u.owner === this.me.idx && u.def.tier > 0 && !f.used[u.id]);
      const up = mine.filter((u) => u.def.tier >= 2);
      return (up.length ? up : mine).sort((a, b) => b.def.tier - a.def.tier || this.unitAtk(b) - this.unitAtk(a));
    }
    confirmPick(ids) {
      const f = this.fight;
      if (!f || f.picked) return;
      f.picked = true;
      let list = ids.map((id) => this.units.find((u) => u.id === id)).filter(Boolean);
      const fallback = this.pickChoices();
      while (list.length < this.slotCount() && fallback.length) { const c = fallback.shift(); if (!list.includes(c)) list.push(c); }
      list = list.slice(0, this.slotCount());
      list.forEach((u, i) => this.deploy(u, i));
      if (this.net) this.net.announcePick(list.map((u) => u.def.id));
      else if (this.phase === 'bossPick') this.beginFight();
    }
    deploy(u, slot) {
      const f = this.fight, p = this.players[u.owner];
      let hpMul = 1;
      this.passives(u.def, 'hpPct').forEach((x) => (hpMul += x.pct));
      hpMul += this.synFor(u.owner, u.def).hp;
      const mhp = this.rankOf[u.def.tier].hp * hpMul * this.mut.champHp;
      f.used[u.id] = true;
      const c = {
        uid: u.id, u, def: u.def, owner: u.owner, slot, x: 340, y: 310 + slot * 300, hp: mhp, mhp, tx: 340, ty: 310 + slot * 300,
        cd: 0.3, move: false, chase: false, skillCd: (u.def.sk || []).map(() => 0), dashCd: 0, inv: 0, buff: 0, buffT: 0, shieldT: 0, think: 0, ai: u.owner !== this.me.idx || this.bot, dead: false, hits: 0, atkFx: 0,
      };
      const i = f.champs.findIndex((x) => x.slot === slot && x.owner === u.owner);
      if (i >= 0) f.champs[i] = c; else f.champs.push(c);
      return c;
    }
    beginFight(dep) {
      const f = this.fight;
      this.phase = 'boss';
      f.t = 0;
      this.log('bossFight', {});
      if (this.net && this.net.partyDeployed) this.checkPartyAchievements(dep || this.net.partyDeployed());
    }
    // 보스전이 끝난 직후 남은 버튼이 눌려도 예외가 나지 않게 fight가 없으면 빈 값으로 답한다
    localChamps() { return this.fight ? this.fight.champs.filter((c) => c.owner === this.me.idx) : []; }
    myRelayTurn() { return !this.net || !this.net.relayMine || this.net.relayMine(); }
    // 일기토에서 기다리는 장수: 내 차례가 아니거나, 내 장수 중 앞 순서가 아직 살아 있으면 대기
    benched(c) {
      if (!this.mut.relay || c.dead) return false;
      if (c.owner !== this.me.idx) return false;
      const first = this.localChamps().filter((o) => !o.dead).sort((a, b) => a.slot - b.slot)[0];
      return c !== first || !this.myRelayTurn();
    }
    active() {
      // 조작과 스킬은 선택 중인 유닛에게만 들어간다
      if (!this.fight) return null;
      if (this.mut.relay) return this.localChamps().find((o) => !o.dead && !o.bench) || null;
      const c = this.localChamps()[this.fight.sel];
      return c && !c.dead ? c : null;
    }
    firstLocal() { return this.localChamps().find((c) => !c.dead && !c.bench) || null; }
    allTargets() {
      const f = this.fight, out = f.champs.filter((c) => !c.dead && !c.bench);
      Object.values(f.ghosts).forEach((g) => { if (g.alive) out.push(g); });
      return out;
    }
    selectChamp(i) {
      if (!this.fight) return;
      const l = this.localChamps();
      if (i == null) this.fight.sel = null;
      else if (l[i] && !l[i].dead) this.fight.sel = i;
    }
    arenaMove(x, y, attack) {
      const c = this.active();
      if (!c) return;
      c.tx = clamp(x, ARENA.x0, ARENA.x1); c.ty = clamp(y, ARENA.y0, ARENA.y1); c.move = true; c.chase = !!attack;
    }
    arenaChase(tgt) { const c = this.active(); if (c) { c.chase = true; c.move = true; c.tgt = tgt == null ? null : tgt; } }
    arenaStop() { const c = this.active(); if (c) { c.move = false; c.chase = false; } }
    canDash(c) { return c && c.def.tier >= this.R.dashMinTier && c.dashCd <= 0; }
    dash(c, x, y) {
      if (!this.canDash(c)) return;
      const a = Math.atan2(y - c.y, x - c.x), l = Math.min(280, dist(c.x, c.y, x, y));
      const nx = clamp(c.x + Math.cos(a) * l, ARENA.x0, ARENA.x1), ny = clamp(c.y + Math.sin(a) * l, ARENA.y0, ARENA.y1);
      this.fx.push({ k: 'dash', x0: c.x, y0: c.y, x1: nx, y1: ny, t: 0, life: 0.3, c: this.T.factions[c.def.fac].color });
      this.log('sfx', { s: 'dash' });
      c.x = nx; c.y = ny; c.dashCd = this.R.dashCd; c.inv = Math.max(c.inv, 0.3); c.move = false;
    }
    // 역할 패시브 합계(같은 종류가 여럿이면 더한다)
    pv(d, k) { return (d.p || []).filter((x) => x.k === k).reduce((s, x) => s + (x.pct || 0), 0); }
    // 버퍼의 상시 공격력 증가: 결투에 나온 모든 장수(다른 사령관 포함)의 사기 진작 합
    partyAtk() {
      const f = this.fight;
      let v = 0;
      f.champs.forEach((c) => { if (!c.dead) v += this.pv(c.def, 'partyAtk'); });
      Object.values(f.ghosts || {}).forEach((g) => { if (g.alive && g.def) v += this.pv(g.def, 'partyAtk'); });
      return v;
    }
    partySum(k) {
      const f = this.fight;
      let v = 0;
      f.champs.forEach((c) => { if (!c.dead) v += this.pv(c.def, k); });
      Object.values(f.ghosts || {}).forEach((g) => { if (g.alive && g.def) v += this.pv(g.def, k); });
      return v;
    }
    // 보스 공격력 감소(장비 호통·축융 비도 난사, 초선 경국지색): 방장 값이 기준
    weakenBossAtk(v, dur) {
      const M = this.fight.mech;
      if (!(M.adT > 0) || v >= M.adV) M.adV = v;
      M.adT = Math.max(M.adT || 0, dur);
      if (this.net && !this.isAuthority) this.fight.pendAd = [Math.max(v, (this.fight.pendAd || [0])[0]), dur];
    }
    // 가후 이간계: 보스의 다음 패턴을 늦춘다
    delayBoss(v) {
      const f = this.fight;
      if (this.isAuthority) f.boss.gap += v;
      else f.pendGap = (f.pendGap || 0) + v;
    }
    champAtk(c) { return this.unitAtk(c.u) * (1 + c.buff + (c.pbuffT > 0 ? c.pbuff : 0) + (this.fight.patk || 0)) * this.mut.champAtk; }
    // 아군 전체 지원(치료·호령): 내 장수에 바로 적용하고 협동이면 다른 사령관에게도 보낸다
    support(k, v, dur) {
      this.applySupport({ k, v, dur });
      if (this.net) this.net.send('sup', { k, v, dur });
    }
    applySupport(d) {
      const f = this.fight;
      if (!f || this.phase !== 'boss') return;
      this.localChamps().forEach((c) => {
        if (c.dead) return;
        if (d.k === 'heal') { c.hp = Math.min(c.mhp, c.hp + c.mhp * d.v); if (d.dur) this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 70, t: 0, life: 0.6, c: '#8ee6a0' }); }
        else if (d.k === 'guard') { c.coverV = Math.max(c.coverT > 0 ? c.coverV : 0, d.v); c.coverT = Math.max(c.coverT || 0, d.dur); c.coverMax = c.coverT; }
        else if (d.k === 'pshield') { c.pshT = Math.max(c.pshT || 0, d.dur); c.pshMax = c.pshT; }
        else if (d.k === 'haste') { c.hasteV = Math.max(c.hasteT > 0 ? c.hasteV : 0, d.v); c.hasteT = Math.max(c.hasteT || 0, d.dur); c.hasteMax = c.hasteT; }
        else if (d.k === 'hot') { c.hotV = Math.max(c.hotT > 0 ? c.hotV : 0, d.v); c.hotT = Math.max(c.hotT || 0, d.dur); }
        else if (d.k === 'healLow') { if (c.hp < c.mhp * 0.5) { c.hp = Math.min(c.mhp, c.hp + c.mhp * d.v); this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 60, t: 0, life: 0.5, c: '#8ee6a0' }); } }
        else if (d.k === 'rally') { c.pbuff = Math.max(c.pbuffT > 0 ? c.pbuff : 0, d.v); c.pbuffT = Math.max(c.pbuffT || 0, d.dur); c.pbuffMax = c.pbuffT; this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 80, t: 0, life: 0.7, c: '#ffe07a' }); }
      });
    }
    // 보스 약화(받는 피해 증가). 방장 값이 기준이고, 다른 사람은 피해와 함께 보낸다.
    ampBoss(v, dur) {
      const f = this.fight, M = f.mech;
      if (!(M.ampT > 0) || v >= M.amp) M.amp = v;
      M.ampT = Math.max(M.ampT || 0, dur);
      if (this.net && !this.isAuthority) f.pendAmp = [Math.max(v, (f.pendAmp || [0])[0]), dur];
    }
    // 매혹: 보스가 깔아 둔 장판·투사체와 대기 중인 연속기를 없앤다
    charmClear() {
      const f = this.fight, M = f.mech;
      f.hazards = f.hazards.filter((h) => h.own || h.cast);
      if (M.q) M.q.length = 0;
      M.ctr = 0; M.ctrGo = null;
    }
    // 미인계 재사용은 팀이 같이 쓴다: 한 명이 쓰면 미인계를 가진 모든 출전 장수의 버튼이 같이 돈다
    charmShare() {
      const f = this.fight, M = f.mech;
      if (!(M.charmCd > 0)) return;
      f.champs.forEach((c) => (c.def.sk || []).forEach((s, j) => { if (s.k === 'charm' && c.skillCd && !(c.skillCd[j] >= M.charmCd)) c.skillCd[j] = M.charmCd; }));
    }
    charmBoss(dur, amp, cd) {
      const f = this.fight, b = f.boss, M = f.mech;
      M.charmT = dur;
      if (cd > 0) { M.charmCd = Math.max(M.charmCd > 0 ? M.charmCd : 0, cd); this.charmShare(); }
      b.stun = Math.max(b.stun, dur); b.charge = null; b.cast = 0;
      this.charmClear();
      if (amp) { if (!(M.ampT > 0) || amp >= M.amp) M.amp = amp; M.ampT = Math.max(M.ampT || 0, dur); }
      return true;
    }
    useSkill(c, i, x, y) {
      const s = (c.def.sk || [])[i], f = this.fight;
      if (!f || !s || c.dead || c.skillCd[i] > 0) return false;
      if (s.k === 'charm' && (f.mech.hide || f.mech.charmCd > 0)) return false;
      c.skillCd[i] = s.cd * (1 - Math.min(0.6, this.pv(c.def, 'cdr') + this.synFor(c.owner, c.def).cdr + this.sageVal(this.players[c.owner], 'sageCdr') + (f.pcdr || 0) + (this.mut.bossCdr || 0)));
      const ch = this.passives(c.def, 'chain').reduce((m, x) => m + x.n, 0);
      if (ch) c.skillCd = c.skillCd.map((v, j) => (j === i ? v : Math.max(0, v - ch))); c.atkT = 0.36; c.face = Math.atan2(y - c.y, x - c.x);
      this.log('dmgtext', { x: c.x, y: c.y - 86, v: s.n, big: true });
      const a = Math.atan2(y - c.y, x - c.x), b = f.boss;
      // 스킬 피해는 등급 표기 공격력 기준이며 조준이 빗나가면 0이다
      const dmg = this.champAtk(c) / this.attackTime(c.def) * s.mult * (1 + this.pv(c.def, 'skillPct') + this.synFor(c.owner, c.def).skill);
      const hitBoss = (extra) => { if (f.mech.hide) return; this.damageBoss(dmg, c, extra); this.log('dmgtext', { x: b.x, y: b.y - 90, v: Math.round(dmg), big: true }); };
      if (s.k === 'line') {
        this.fx.push({ k: 'beam', x: c.x, y: c.y, a, len: s.len, w: s.w, t: 0, life: 0.5, c: s.fx, vx: s.vx }); this.log('shake', { v: 0.6 });
        if (inLine(b.x, b.y, c.x, c.y, a, s.len, s.w, 60)) hitBoss();
        if (s.dashThrough) { const l = Math.min(s.len, 360); c.x = clamp(c.x + Math.cos(a) * l, ARENA.x0, ARENA.x1); c.y = clamp(c.y + Math.sin(a) * l, ARENA.y0, ARENA.y1); c.inv = Math.max(c.inv, 0.4); c.move = false; }
      } else if (s.k === 'cone') {
        this.fx.push({ k: 'cone', x: c.x, y: c.y, a, r: s.r, arc: s.arc, t: 0, life: 0.42, c: s.fx, vx: s.vx }); this.log('shake', { v: 0.5 });
        if (inCone(b.x, b.y, c.x, c.y, a, s.r, s.arc, 60)) hitBoss();
      } else if (s.k === 'circle') {
        const d = s.range ? Math.min(s.range, dist(c.x, c.y, x, y)) : 0;
        const px = clamp(c.x + Math.cos(a) * d, ARENA.x0, ARENA.x1), py = clamp(c.y + Math.sin(a) * d, ARENA.y0, ARENA.y1);
        f.hazards.push({ own: true, vx: s.vx, x: px, y: py, r: s.r * (1 + this.pv(c.def, 'aoe')), delay: s.delay, t: 0, c: s.fx, dmg, stun: s.stun || 0, champ: c });
      } else if (s.k === 'buff') {
        c.buff = s.atk; c.buffT = s.dur; this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 110, t: 0, life: 0.8, c: s.fx, vx: s.vx });
      } else if (s.k === 'shield') {
        c.shieldT = s.dur; c.inv = Math.max(c.inv, s.dur); this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 90, t: 0, life: 0.7, c: s.fx, vx: s.vx });
      } else if (s.k === 'heal') {
        // 아군 전체(다른 사령관 포함) 치료
        this.support('heal', s.pct, 1);
        if (s.hot) this.support('hot', s.hot, s.hotDur);
        const hb = this.pv(c.def, 'healBuff'); if (hb) this.support('rally', hb, 3);
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 150, t: 0, life: 0.9, c: s.fx, vx: s.vx });
      } else if (s.k === 'rally') {
        this.support('rally', s.atk, s.dur);
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 170, t: 0, life: 0.9, c: s.fx, vx: s.vx });
      } else if (s.k === 'taunt') {
        // 보스를 끌어오고 그동안 받는 피해를 더 줄인다
        c.tauntT = s.dur;
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 120, t: 0, life: 0.8, c: s.fx, vx: s.vx });
      } else if (s.k === 'cover') {
        // 엄호: 보스를 끌어오고 아군 전체가 받는 피해를 줄인다
        c.tauntT = s.dur; this.support('guard', s.v, s.dur);
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 170, t: 0, life: 0.9, c: s.fx, vx: s.vx });
      } else if (s.k === 'pshield') {
        this.support('pshield', 0, s.dur);
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 170, t: 0, life: 0.9, c: s.fx, vx: s.vx });
      } else if (s.k === 'hasteAll') {
        this.support('haste', s.v, s.dur);
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 170, t: 0, life: 0.9, c: s.fx, vx: s.vx });
      } else if (s.k === 'roar') {
        if (!f.mech.hide) this.weakenBossAtk(s.v, s.dur);
        this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 150, t: 0, life: 0.7, c: s.fx, vx: s.vx }); this.log('shake', { v: 0.5 });
      } else if (s.k === 'delay') {
        if (!f.mech.hide) this.delayBoss(s.v);
        this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 130, t: 0, life: 0.8, c: s.fx, vx: s.vx });
      } else if (s.k === 'reflect') {
        c.reflT = s.dur; c.reflMult = s.mult; c.tauntT = Math.max(c.tauntT || 0, s.dur);
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 120, t: 0, life: 0.8, c: s.fx, vx: s.vx });
      } else if (s.k === 'charm') {
        // 미인계: 보스가 넋을 잃고 멈춘다(무력화 시전은 끊지 못함). 팀 전체가 재사용을 같이 쓴다.
        // 같이 쓰는 재사용 시간 = 쓴 사람이 실제로 받은 재사용(재사용 단축 반영). s.cd 수치는 그대로다.
        const shareCd = c.skillCd[i] > 0 ? c.skillCd[i] : s.cd;
        this.charmBoss(s.dur, s.amp, shareCd);
        if (this.net && !this.isAuthority) { f.pendCharm = [s.dur, s.amp, Math.round(shareCd * 10) / 10]; f.mech.charmHold = 1.5; }
        this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 150, t: 0, life: 0.9, c: s.fx, vx: s.vx });
        this.log('proc', { x: c.x, y: c.y, tx: b.x, ty: b.y, names: [this.L('e_charm', null, '매혹')], c: s.fx, vx: s.vx });
      } else if (s.k === 'weaken') {
        if (!f.mech.hide) this.ampBoss(s.amp, s.dur);
        this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 120, t: 0, life: 0.6, c: s.fx, vx: s.vx });
      }
      this.log('skill', { name: s.n, c: s.fx });
      this.log('sfx', { s: 'skill' });
      return true;
    }
    healLeft() {
      const x = this.teamPassives(this.me, 'activeHeal')[0];
      return x && this.fight ? Math.max(0, x.uses - this.fight.healUsed) : null;
    }
    useHeal() {
      const x = this.teamPassives(this.me, 'activeHeal')[0];
      if (!x || this.phase !== 'boss' || !this.healLeft()) return false;
      this.fight.healUsed++;
      this.localChamps().forEach((c) => { if (!c.dead) { c.hp = Math.min(c.mhp, c.hp + c.mhp * x.pct); this.fxBurst(c.x, c.y, '#a8ffb8', 70); } });
      this.log('skill', { name: x.name, c: '#a8ffb8' });
      this.log('sfx', { s: 'ach' });
      return true;
    }
    // 딜미터 집계
    addDealt(c, d) {
      if (!c) return;
      const f = this.fight, key = c.owner === this.me.idx ? c.def.name : this.L('e_ally', { a: c.def.name }, `동맹 ${c.def.name}`);
      f.dealt[key] = (f.dealt[key] || 0) + d;
      if (c.owner === this.me.idx) f.total += d;
    }
    damageBoss(v, c, opt) {
      const f = this.fight, b = f.boss;
      let pierce = 0, bonus = 0;
      if (c) { this.passives(c.def, 'pierce').forEach((x) => (pierce = Math.max(pierce, x.pct))); this.passives(c.def, 'bossPct').forEach((x) => (bonus += x.pct)); bonus += this.synFor(c.owner, c.def).boss; if (b.hp < b.mhp * 0.3) bonus += this.pv(c.def, 'execute'); }
      if (f.mech.hide) return 0;
      const d = Math.max(v * 0.25, v * (1 + bonus) - b.def * (1 - pierce)) * this.raidMul();
      b.hp = Math.max(0, b.hp - d); b.flash = 0.1;
      this.raidOnBossDmg(d, c);
      this.addDealt(c, d);
      if (this.net) { f.pending += d; if (opt && opt.stun) f.pendStun = opt.stun; }
      if (opt && opt.stun) b.stun = Math.max(b.stun, opt.stun);
      return d;
    }
    hurtChamp(c, dmg) {
      if (c.inv > 0 || c.dead || c.bench) return;
      // 탱커: 철벽 감쇄, 진영 사수 중에는 절반 더 줄인다
      const f = this.fight;
      dmg *= 1 - Math.min(0.8, this.pv(c.def, 'guard') + this.synFor(c.owner, c.def).guard + (f.pguard || 0) + (c.coverT > 0 ? c.coverV : 0));
      if (c.tauntT > 0) dmg *= 0.5;
      if (c.hp < c.mhp * 0.3) dmg *= 1 - this.pv(c.def, 'lowGuard');
      c.hp -= dmg; c.hurt = 0.2;
      if (c.hp <= 0 && !c.lastUsed && this.passives(c.def, 'lastStand').length) { c.hp = 1; c.lastUsed = true; c.inv = 1; this.log('proc', { x: c.x, y: c.y, tx: c.x, ty: c.y, names: [this.passives(c.def, 'lastStand')[0].name || '칠종칠금'], c: '#ff9a5a' }); }
      if (c.reflT > 0 && !(c.reflCd > 0) && !f.mech.hide) {
        c.reflCd = 0.5;
        const v = this.champAtk(c) / this.attackTime(c.def) * c.reflMult;
        this.damageBoss(v, c); this.fx.push({ k: 'shot', wp: this.weapon(c.def), big: true, x0: c.x, y0: c.y, x1: f.boss.x, y1: f.boss.y, t: 0, life: 0.26, c: '#ff9080' });
      }
      if (c.owner === this.me.idx) this.log('shake', { v: 0.5 });
      if (c.owner === this.me.idx) this.log('sfx', { s: 'hurt' });
      this.fx.push({ k: 'ring', x: c.x, y: c.y, r: 46, t: 0, life: 0.25, c: '#ff5040' });
      if (c.hp <= 0) {
        c.dead = true; c.hp = 0;
        this.log('sfx', { s: 'dead' });
        if (c.owner === this.me.idx) this.log('champDead', { name: c.def.name });
        const others = this.localChamps().filter((o) => !o.dead);
        if (c.owner === this.me.idx && !others.length && this.net && this.net.relayDone && this.mut.relay) this.net.relayDone();
        if (c.owner === this.me.idx && !others.length && (this.mut.relay || !this.pickChoices().length)) this.champsGone();
      }
    }
    champsGone() {
      if (!this.net) { if (!this.fight.champs.some((c) => !c.dead)) this.endFight(false); return; }
      this.net.send('wiped', { r: this.round });
    }
    replaceChamp(id) {
      const f = this.fight, u = this.units.find((x) => x.id === id);
      if (!f || !u || f.used[id] || this.phase !== 'boss' || this.mut.relay) return; // 일기토는 대체 출전 없음
      const l = this.localChamps(), dead = l.find((c) => c.dead);
      if (!dead) return;
      const c = this.deploy(u, dead.slot);
      c.x = 260; c.y = H / 2; c.tx = 260; c.ty = H / 2; c.inv = 2;
      f.sel = this.localChamps().indexOf(c);
    }
    danger(x, y, t) {
      // 인공지능과 비조작 유닛의 회피용 위험도. 텔레그래프를 그대로 읽는다.
      let v = 0;
      for (const h of this.fight.hazards) {
        if (h.own) continue;
        // 탄환은 지금 자리와 0.7초 뒤까지 날아갈 길을 함께 피한다
        if (h.k === 'proj') { if (dist(x, y, h.x, h.y) < h.r + 60 || inLine(x, y, h.x, h.y, h.a, h.v * 0.7, h.r * 2 + 50, 0)) v += 2; continue; }
        if (this.hazardHits(h, x, y, 34)) v += 3;
      }
      return v;
    }
    hazardHits(h, x, y, pad) {
      if (h.k === 'circle') return dist(x, y, h.x, h.y) <= h.r + pad;
      if (h.k === 'line') return inLine(x, y, h.x, h.y, h.a, h.len, h.w, pad);
      if (h.k === 'cone') return inCone(x, y, h.x, h.y, h.a, h.r, h.arc, pad);
      if (h.k === 'donut') { const d = dist(x, y, h.x, h.y); return d >= h.r0 - pad && d <= h.r1 + pad; }
      if (h.k === 'safe') return !h.spots.some((s) => dist(x, y, s[0], s[1]) <= s[2] - pad * 0.3);
      return false;
    }
    stepFight(dt) {
      const f = this.fight, b = f.boss;
      if (this.phase === 'bossIntro') {
        f.introT -= dt;
        b.x += (b.tx - b.x) * Math.min(1, dt * 1.6);
        if (f.introT <= 0 && this.isAuthority) this.gotoPick();
        return;
      }
      if (this.phase === 'bossPick') {
        f.pickT -= dt;
        if (f.pickT <= 0 && !f.picked) this.confirmPick([]);
        if (this.net && this.isAuthority && (f.pickT <= -2 || this.net.allPicked())) this.net.startFight();
        return;
      }
      if (this.phase !== 'boss') return;
      f.t += dt;
      b.flash = Math.max(0, b.flash - dt);
      // 1초마다: 버퍼 사기 진작 합 갱신, 힐러 구호(아군 전체 회복)
      f.roleT = (f.roleT || 0) - dt;
      if (f.roleT <= 0) {
        f.roleT = 1;
        f.patk = this.partyAtk(); f.pcdr = this.partySum('partyCdr'); f.pguard = this.partySum('auraGuard'); f.bweak = this.partySum('bossWeak');
        f.roleN = (f.roleN || 0) + 1;
        this.localChamps().forEach((c) => {
          if (c.dead) return;
          const r = this.pv(c.def, 'regen'); if (r) this.support('heal', r, 0);
          const hl = this.pv(c.def, 'healLow'); if (hl && f.roleN % 3 === 0) this.support('healLow', hl, 0);
        });
      }
      if (this.isAuthority) this.bossBrain(dt);
      this.raidTick(dt);
      this.stepHazards(dt);
      // 일기토: 대기 장수는 결투장 밖에서 기다리고, 차례가 오면 입구에서 잠깐 무적으로 나온다
      f.champs.forEach((c) => {
        const was = c.bench, now = this.benched(c);
        c.bench = now;
        if (was && !now) { c.x = 260; c.y = H / 2; c.tx = c.x; c.ty = c.y; c.inv = Math.max(c.inv, 1.5); }
        if (!now) this.stepChamp(c, dt);
      });
      if (b.burnT > 0) { b.burnT -= dt; const d = b.burn * dt; b.hp = Math.max(0, b.hp - d); this.addDealt(b.burnC, d); if (this.net) f.pending += d; }
      if (this.net) this.net.tickFight(dt, this);
      if (this.isAuthority) {
        if (b.hp <= 0) this.endFight(true);
        else if (f.t >= f.limit) this.endFight(false);
      }
    }
    gotoPick() {
      if (this.net) this.net.send('phase', { p: 'pick' });
      this.applyPick();
    }
    applyPick() {
      if (!this.fight) return; // 보스 시작 신호보다 먼저 도착한 경우
      this.phase = 'bossPick';
      this.log('bossPick', {});
      if (this.mode !== 'multi' && !this.pickChoices().length) this.finish(false);
    }
    bossBrain(dt) {
      const f = this.fight, b = f.boss, targets = this.allTargets();
      const hold = this.raidStep(dt); // 레이드 기믹: 2 완전 정지, 1 제자리
      if (b.stun > 0) { b.stun -= dt; return; }
      if (b.charge) {
        const c = b.charge;
        c.delay -= dt;
        if (c.delay <= 0) {
          const s = 1300 * dt; b.x += Math.cos(c.a) * s; b.y += Math.sin(c.a) * s; c.left -= s;
          if (c.left <= 0 || b.x < ARENA.x0 || b.x > ARENA.x1 || b.y < ARENA.y0 || b.y > ARENA.y1) {
            b.x = clamp(b.x, ARENA.x0, ARENA.x1); b.y = clamp(b.y, ARENA.y0, ARENA.y1);
            b.charge = null;
          }
        }
        return;
      }
      if (hold === 2) return;
      b.gap -= dt; b.atkCd -= dt;
      if (b.cast > 0) { b.cast -= dt; return; }
      if (!targets.length) return;
      // 탱커가 있으면 탱커를 먼저 노린다(진영 사수 중이면 거리와 상관없이)
      const tauntOf = (o) => (o.tauntT > 0 ? 2 : o.def && o.def.role === 'tank' ? 1 : 0);
      let t = targets[0];
      targets.forEach((o) => { const a = tauntOf(o), z = tauntOf(t); if (a > z || (a === z && dist(o.x, o.y, b.x, b.y) < dist(t.x, t.y, b.x, b.y))) t = o; });
      const d = dist(t.x, t.y, b.x, b.y);
      if (f.def.style === 'caster') { if (!hold) this.casterAct(t, d, dt); }
      else if (d > 100) {
        const sp = b.speed * (b.hp / b.mhp < 0.3 ? 1.3 : 1) * dt;
        if (!hold) { b.x += ((t.x - b.x) / d) * sp; b.y += ((t.y - b.y) / d) * sp; }
      } else if (b.atkCd <= 0) {
        b.atkCd = 1.6;
        this.addHazards([{ k: 'cone', x: b.x, y: b.y, a: Math.atan2(t.y - b.y, t.x - b.x), r: 150, arc: 1.5, delay: 0.5, dmg: b.hit * 0.14, fx: 'blade' }]);
      }
      if (f.bigCd > 0) f.bigCd -= dt;
      if (this.bigPending()) b.gap = Math.max(b.gap, 1.6);
      if (b.gap <= 0) this.castPattern(t);
    }
    // 피하기 위해 자리를 잡아야 하는 큰 장판(안전지대·엄폐·좁은 길·전체기·한 방에 큰 피해)
    isBig(h) { return h.k === 'safe' || h.k === 'los' || h.k === 'band' || h.k === 'all' || (h.dmg && h.dmg >= this.fight.boss.hit * 0.9); }
    bigPending() { const f = this.fight; return f.hazards.some((h) => !h.own && h.t < h.delay && this.isBig(h)); }
    castPattern(t) {
      const f = this.fight, b = f.boss, lv = this.diff.level;
      const list = f.def.patterns.filter((p) => (p.min || 0) <= lv).concat(this.mut.extraPat);
      if (!b.order.length) { b.order = list.slice(); for (let i = b.order.length - 1; i > 0; i--) { const j = (this.rand() * (i + 1)) | 0; [b.order[i], b.order[j]] = [b.order[j], b.order[i]]; } }
      // 큰 공격: 전멸기(팔진도·안전지대) 22초, 맵 전체를 덮는 패턴(줄 폭발·띠·고리·시선·갑판) 14초 동안 큰 공격을 다시 쓰지 않는다
      const BIG = { gates: 22, safe: 22, rows: 14, spread: 14, rings: 14, gaze: 14, deck: 14 };
      // 큰 공격 대기 중이면 다른 패턴을 먼저 쓴다
      let pat;
      if (f.bigCd > 0 && BIG[b.order[0].gen]) {
        const k = b.order.findIndex((p) => !BIG[p.gen]), alt = list.filter((p) => !BIG[p.gen]);
        // 남은 순서에 전멸기만 있으면 순서는 두고 일반 패턴 하나를 대신 쓴다
        pat = k >= 0 ? b.order.splice(k, 1)[0] : alt.length ? this.pick(alt) : b.order.shift();
      } else pat = b.order.shift();
      if (BIG[pat.gen]) f.bigCd = Math.max(f.bigCd || 0, BIG[pat.gen]);
      const enrage = b.hp / b.mhp < 0.3;
      b.gap = Math.max(f.mech.enr ? 2 : 2.6, 5.2 - lv * 0.5 - (enrage ? 0.8 : 0) - (f.mech.enr ? 0.8 : 0)) * this.mut.bossGap + (BIG[pat.gen] ? 2.5 : 0);
      const tuned = Object.assign({}, pat.p);
      if (tuned.n && pat.gen !== 'safe') tuned.n += lv + (this.party >= 3 ? 1 : 0);
      // 기술마다 장판·투사체 연출 이름(vis → 장판의 fx)을 붙인다
      f.vis = pat.vis || null;
      this.patternGen[pat.gen].call(this, f, b, t, tuned, Math.max(0.55, 1.05 - lv * 0.08), this.allTargets());
      f.vis = null;
      b.cast = 0.6;
      this.log('pattern', { name: pat.n });
      this.log('sfx', { s: 'warn' });
      if (this.net) this.net.send('pattern', { n: pat.n });
    }
    addHazards(list) {
      const f = this.fight, c = f.def.fx;
      const M = f.mech || {}, weak = 1 - Math.min(0.5, (f.bweak || 0) + (M.adT > 0 ? M.adV : 0));
      const out = list.map((h) => Object.assign({ c, t: 0, fx: f.vis || undefined }, h, h.dmg ? { dmg: h.dmg * this.mut.hazDmg * weak } : {}));
      this.fight.hazards.push(...out);
      if (this.net) this.net.sendHazards(out);
    }
    stepHazards(dt) {
      const f = this.fight, b = f.boss;
      for (let i = f.hazards.length - 1; i >= 0; i--) {
        const h = f.hazards[i];
        h.t += dt;
        if (h.raid) { if (this.raidHazard(h, dt)) f.hazards.splice(i, 1); continue; }
        if (h.k === 'proj') {
          if (h.t < h.delay) continue;
          h.x += Math.cos(h.a) * h.v * dt; h.y += Math.sin(h.a) * h.v * dt;
          let gone = h.x < 0 || h.x > W || h.y < 0 || h.y > H;
          f.champs.forEach((c) => { if (!gone && !c.dead && dist(c.x, c.y, h.x, h.y) < h.r + 18 && c.inv <= 0) { if (c.pshT > 0) this.fx.push({ k: 'ring', x: c.x, y: c.y, r: 40, t: 0, life: 0.3, c: '#d8ecff' }); else this.hurtChamp(c, h.dmg); gone = true; } });
          if (gone) f.hazards.splice(i, 1);
          continue;
        }
        if (h.t >= h.delay && !h.fired) {
          h.fired = true;
          if (!h.own) this.log('sfx', { s: 'boom', gap: 110 });
          if (h.own) {
            this.fx.push({ k: 'blast', x: h.x, y: h.y, r: h.r, t: 0, life: 0.6, c: h.c, vx: h.vx }); this.log('shake', { v: 0.8 });
            if (dist(b.x, b.y, h.x, h.y) <= h.r + 60) { this.damageBoss(h.dmg, h.champ, { stun: h.stun }); this.log('dmgtext', { x: b.x, y: b.y - 90, v: Math.round(h.dmg), big: true }); }
          } else f.champs.forEach((c) => { if (!c.dead && this.hazardHits(h, c.x, c.y, 16)) this.hurtChamp(c, h.dmg); });
        }
        if (h.t >= h.delay + 0.28) f.hazards.splice(i, 1);
      }
    }
    stepChamp(c, dt) {
      if (c.dead) return;
      const f = this.fight, b = f.boss, rng = this.range(c.def), selected = c === this.active();
      c.cd -= dt; c.inv -= dt; c.dashCd -= dt; c.shieldT -= dt; c.hurt = Math.max(0, (c.hurt || 0) - dt); c.atkT = Math.max(0, (c.atkT || 0) - dt); c.moveT = Math.max(0, (c.moveT || 0) - dt);
      c.skillCd = c.skillCd.map((x) => Math.max(0, x - dt));
      if (c.buffT > 0) { c.buffT -= dt; if (c.buffT <= 0) c.buff = 0; }
      if (c.pbuffT > 0) c.pbuffT -= dt;
      if (c.tauntT > 0) c.tauntT -= dt;
      if (c.coverT > 0) c.coverT -= dt;
      if (c.pshT > 0) c.pshT -= dt;
      if (c.hasteT > 0) c.hasteT -= dt;
      if (c.reflT > 0) c.reflT -= dt;
      if (c.reflCd > 0) c.reflCd -= dt;
      if (c.hotT > 0) { c.hotT -= dt; c.hp = Math.min(c.mhp, c.hp + c.mhp * c.hotV * dt); }
      const speed = 250;
      if (c.kt > 0) { c.kt -= dt; c.x = clamp(c.x + c.kx * dt, ARENA.x0, ARENA.x1); c.y = clamp(c.y + c.ky * dt, ARENA.y0, ARENA.y1); return; }
      if (!selected || c.ai) this.champAuto(c, dt);
      const fo = this.champFoe(c), d = fo ? dist(c.x, c.y, fo.x, fo.y) : 1e9;
      // 직접 조작(모바일 조이스틱): 왼쪽 조이스틱으로 움직이고, 공격 버튼을 누르고 있을 때만 때린다.
      // 공격 버튼을 누르는데 사거리 밖이면 다가가서 때린다. 조이스틱을 움직이는 동안은 이동이 먼저다.
      const man = this.manual && selected && !c.ai;
      if (c.atkHold > 0) c.atkHold -= dt;
      if (c.atkLock > 0) c.atkLock -= dt;
      // 이동 중 공격 보정: 조이스틱을 밀고 있어도 공격 버튼을 눌렀고 사거리 안이며 칠 수 있으면, 잠깐 멈춰 치고 다시 조이스틱대로 움직인다.
      const joyHeld = man && c.joy && Math.hypot(c.joy.x, c.joy.y) > 0.1;
      const wantHit = man && c.atkHold > 0 && fo && c.cd <= 0 && d <= rng + 40 + (fo === b ? 0 : fo.r);
      let joyMove = false;
      if (joyHeld && !wantHit && !(c.atkLock > 0)) {
        const jm = Math.hypot(c.joy.x, c.joy.y);
        {
          joyMove = true; c.move = false; c.chase = false;
          const s = speed * Math.min(1, jm / 0.5) * dt; // 절반만 밀어도 최고 속도(끝까지 밀어야 빨라지면 굼뜨게 느껴진다)
          c.x = clamp(c.x + (c.joy.x / jm) * s, ARENA.x0, ARENA.x1); c.y = clamp(c.y + (c.joy.y / jm) * s, ARENA.y0, ARENA.y1);
          c.face = Math.atan2(c.joy.y, c.joy.x); c.moveT = 0.12;
        }
      }
      if (joyHeld) { c.move = false; c.chase = false; } // 조이스틱을 쥐고 있는 동안은 자동으로 다가가지 않는다
      else if (man && c.atkHold > 0 && fo && d > rng + 30) { c.tx = fo.x; c.ty = fo.y; c.move = true; c.chase = false; }
      else if (man && c.atkHold > 0 && fo && c.move && !c.chase) c.move = false;
      if (c.chase && selected && !c.ai && fo) { if (d > rng * 0.9) { c.tx = fo.x; c.ty = fo.y; c.move = true; } else c.move = false; }
      if (c.move) {
        const m = dist(c.x, c.y, c.tx, c.ty);
        if (m < 6) c.move = false;
        else { const s = Math.min(m, speed * dt); c.x += ((c.tx - c.x) / m) * s; c.y += ((c.ty - c.y) / m) * s; c.face = Math.atan2(c.ty - c.y, c.tx - c.x); c.moveT = 0.12; }
      }
      if (fo && !c.move && !joyMove && (!man || c.atkHold > 0) && d <= rng + 40 + (fo === b ? 0 : fo.r) && c.cd <= 0) {
        c.cd = this.attackTime(c.def) * (1 - Math.min(0.6, this.pv(c.def, 'haste'))) / (1 + this.hasteOf(c.owner, c.def) + (c.hasteT > 0 ? c.hasteV : 0)); c.atkT = 0.24;
        if (man) c.atkLock = Math.min(0.16, c.cd * 0.5); // 치는 동작 동안 발을 멈춘다
        const { mult, big, procs } = this.rollHit(c.def, c), atk = this.champAtk(c);
        this.hitFoe(fo, atk * mult, c);
        const ls = this.pv(c.def, 'lifesteal'); if (ls && fo === b) c.hp = Math.min(c.mhp, c.hp + c.mhp * ls);
        // 보스전 확률 패시브 발동: 이름과 함께 크게 알린다
        if (procs.length && c.owner === this.me.idx) this.log('proc', { x: c.x, y: c.y, tx: fo.x, ty: fo.y, names: procs, c: this.shotColor(c.def), v: Math.round(atk * mult) });
        // 디버퍼 평타: 보스가 받는 피해 증가
        if (fo === b && !f.mech.hide) this.passives(c.def, 'expose').forEach((x) => this.ampBoss(x.pct, x.dur));
        // 평타 딜러의 강타는 크게 터뜨린다
        if (big && c.def.role === 'auto') {
          this.fx.push({ k: 'blast', x: fo.x, y: fo.y - 10, r: 70 + c.def.tier * 6, t: 0, life: 0.45, c: this.shotColor(c.def) });
          this.fx.push({ k: 'spark', x: fo.x, y: fo.y - 20, t: 0, life: 0.3, c: '#fff6c8', r: 90, a: Math.atan2(fo.y - c.y, fo.x - c.x) });
          if (c.owner === this.me.idx) this.log('shake', { v: 0.45 });
        }
        c.face = Math.atan2(fo.y - c.y, fo.x - c.x);
        this.fx.push({ k: 'shot', wp: this.weapon(c.def), big: true, x0: c.x, y0: c.y, x1: fo.x, y1: fo.y, t: 0, life: 0.26, c: this.shotColor(c.def) });
        this.fx.push({ k: 'spark', x: fo.x, y: fo.y - 20, t: -0.22, life: 0.22, c: this.shotColor(c.def), r: 44, a: c.face });
        if (c.owner === this.me.idx) this.log('sfx', { s: this.weapon(c.def), gap: 70 });
        if (big && fo === b) this.log('dmgtext', { x: b.x + 30, y: b.y - 70, v: Math.round(atk * mult) });
        if (fo === b) this.passives(c.def, 'burn').forEach((x) => { b.burn = Math.max(b.burn, atk * x.pct * (1 + this.synFor(c.owner, c.def).burn)); b.burnT = x.dur; b.burnC = c; });
      }
    }
    champAuto(c, dt) {
      c.think -= dt;
      if (c.think > 0) return;
      c.think = c.ai ? 0.16 : 0.24;
      this.raidAutoTarget(c);
      const b = this.champFoe(c) || this.fight.boss, rng = this.range(c.def) * 0.85;
      const here = this.danger(c.x, c.y);
      if (here > 0) {
        // 이미 고른 피신처가 아직 안전하면 그대로 간다(매번 새로 고르면 제자리에서 흔들린다)
        if (c.flee && c.move && this.danger(c.flee[0], c.flee[1]) === 0) return;
        let best = null, bs = 1e9;
        // 가까운 안전한 자리부터 찾는다(가까운 곳이 모두 위험하면 더 멀리)
        for (const r of [150, 280, 420]) for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2, x = clamp(c.x + Math.cos(a) * r, ARENA.x0, ARENA.x1), y = clamp(c.y + Math.sin(a) * r, ARENA.y0, ARENA.y1);
          const s = this.danger(x, y) * 1000 + dist(x, y, c.x, c.y) * 0.6 + Math.abs(dist(x, y, b.x, b.y) - rng) * 0.4;
          if (s < bs) { bs = s; best = [x, y]; }
        }
        // 기믹이 알려 주는 숨을 자리(돌기둥 그림자, 안전지대)도 후보로 본다
        for (const [x, y] of this.raidSpots()) {
          const s = this.danger(x, y) * 1000 + dist(x, y, c.x, c.y) * 0.6;
          if (s < bs) { bs = s; best = [x, y]; }
        }
        c.tx = best[0]; c.ty = best[1]; c.move = true; c.flee = best;
        if (here >= 3 && this.canDash(c)) this.dash(c, best[0], best[1]);
        return;
      }
      const goal = this.raidGoal(c);
      if (goal) {
        if (dist(c.x, c.y, goal[0], goal[1]) > 18 && this.danger(goal[0], goal[1]) === 0) { c.tx = goal[0]; c.ty = goal[1]; c.move = true; } else c.move = false;
        if (c.ai) this.autoSkills(c);
        return;
      }
      const d = dist(c.x, c.y, b.x, b.y);
      const wall = (x, y) => Math.min(x - ARENA.x0, ARENA.x1 - x, y - ARENA.y0, ARENA.y1 - y);
      if (d > rng + 30 || d < 110 || wall(c.x, c.y) < 120) {
        // 보스와 사거리만큼 떨어진 자리 중 벽에서 먼 쪽을 고른다(구석에 몰리면 장판을 못 피한다)
        const a0 = Math.atan2(c.y - b.y, c.x - b.x);
        let tx = 0, ty = 0, bs = -1e9;
        for (let i = -9; i <= 9; i++) {
          const a = a0 + i * 0.35, x = clamp(b.x + Math.cos(a) * rng, ARENA.x0, ARENA.x1), y = clamp(b.y + Math.sin(a) * rng, ARENA.y0, ARENA.y1);
          // 남아 있는 불길 같은 장판을 피해 보스 둘레의 다른 쪽으로 돈다
          const s = Math.min(wall(x, y), 160) - Math.abs(i) * 12 - this.danger(x, y) * 1000;
          if (s > bs) { bs = s; tx = x; ty = y; }
        }
        // 다가갈 자리가 아직 장판 안이면 터질 때까지 밖에서 기다린다
        if (this.danger(tx, ty) > 0 || (this.gazing() && d > rng + 30)) c.move = false;
        else { c.tx = tx; c.ty = ty; c.move = true; }
      } else c.move = false;
      if (c.ai) this.autoSkills(c);
    }
    autoSkills(c) {
      const b = this.fight.boss;
      if (this.fight.mech.hide) return;
      (c.def.sk || []).forEach((s, i) => { if (c.skillCd[i] <= 0 && this.rand() < 0.25) this.useSkill(c, i, b.x, b.y); });
    }
    endFight(win) {
      const f = this.fight;
      const remain = 1 - f.t / f.limit;
      if (this.net) this.net.send('phase', { p: 'bossEnd', win, remain });
      this.applyBossEnd(win, remain);
    }
    applyBossEnd(win, remain) {
      const f = this.fight;
      if (!f) return;
      // 판 끝 통계: 보스전 기록(걸린 시간·빠른 클리어·출전 장수·피해 순위)
      const fastNow = win && remain >= this.fastNeed();
      this.stats.bosses.push({ name: f.def.name, title: f.def.title, round: f.def.round, win, time: Math.round(f.limit * (1 - remain)), limit: f.limit, fast: fastNow, champs: this.localChamps().map((c) => c.def.name), dealt: Object.assign({}, f.dealt), total: f.total });
      if (!win) { this.log('bossFail', {}); this.finish(false); return; }
      const round = f.def.round, rw = this.T.bossRewards[round] || {}, fast = remain >= this.fastNeed();
      this.players.forEach((p) => {
        const r = Object.assign({}, rw);
        const bonus = this.teamPassives(p, 'bossGold').reduce((m, x) => Math.max(m, x.pct), 0);
        if (r.gold) r.gold = Math.floor(r.gold * (1 + bonus) * this.mut.bossGold * (this.diff.bossGold || 1));
        if (this.mut.bossChest) r.chest = (r.chest || 0) + this.mut.bossChest;
        if (this.mut.bossTicket && r.tickets) r.tickets = r.tickets.concat([[r.tickets[0][0], this.mut.bossTicket]]);
        if (this.mut.bossRankUp) r.cons = Object.assign({}, r.cons, { rankUp: ((r.cons || {}).rankUp || 0) + this.mut.bossRankUp });
        if (fast && r.tickets) r.tickets = r.tickets.concat([[Math.max(1, r.tickets[0][0] - 1), 1]]);
        this.grant(p, r, this.L('e_defeated', { a: f.def.name }, `${f.def.name} 토벌`) + (fast ? this.L('e_fast', null, ' (빠른 클리어)') : ''));
      });
      const shown = Object.assign({}, rw);
      if (fast && rw.tickets) shown.tickets = rw.tickets.concat([[Math.max(1, rw.tickets[0][0] - 1), 1]]);
      this.log('bossWin', { boss: f.def, fast, time: Math.round(f.t), reward: shown, dealt: f.dealt, total: f.total });
      this.fight = null;
      this.endRound();
      if (round >= this.diff.rounds) { this.finish(true); if (this.net) this.net.send('phase', { p: 'over', win: true }); return; }
      this.phase = 'wave';
      if (this.isAuthority) this.nextRound();
    }

  }

  // 패턴 생성기. 보스 데이터의 gen 이름으로 호출된다. pace는 난이도별 텔레그래프 시간 배율.
  Game.prototype.patternGen = {
    rain(f, b, t, p, pace, all) {
      const list = [];
      for (let i = 0; i < p.n; i++) {
        const o = all[i % all.length], s = i < all.length ? 0 : 170;
        list.push({ k: 'circle', x: clamp(o.x + (this.rand() - 0.5) * s * 2, ARENA.x0, ARENA.x1), y: clamp(o.y + (this.rand() - 0.5) * s * 2, ARENA.y0, ARENA.y1), r: p.r, delay: (0.9 + i * 0.16) * pace, dmg: b.hit * 0.3 });
      }
      this.addHazards(list);
    },
    fan(f, b, t, p, pace) {
      const a0 = Math.atan2(t.y - b.y, t.x - b.x), list = [];
      for (let i = 0; i < p.n; i++) list.push({ k: 'line', x: b.x, y: b.y, a: a0 + (i - (p.n - 1) / 2) * 0.32, len: 1900, w: 46, delay: 1 * pace, dmg: b.hit * 0.35 });
      this.addHazards(list);
    },
    cross(f, b, t, p, pace) {
      const a0 = Math.atan2(t.y - b.y, t.x - b.x), list = [];
      for (let i = 0; i < p.n; i++) list.push({ k: 'line', x: b.x, y: b.y, a: a0 + (i / p.n) * Math.PI * 2, len: 2000, w: 70, delay: 1.1 * pace, dmg: b.hit * 0.4 });
      this.addHazards(list);
    },
    nova(f, b, t, p, pace) { this.addHazards([{ k: 'circle', x: b.x, y: b.y, r: p.r, delay: 1.2 * pace, dmg: b.hit * 0.45 }]); },
    rings(f, b, t, p, pace) {
      const list = [];
      for (let i = 0; i < Math.min(p.n, 7); i++) list.push({ k: 'donut', x: b.x, y: b.y, r0: 90 + i * 140, r1: 190 + i * 140, delay: (1 + i * 0.45) * pace, dmg: b.hit * 0.35 });
      this.addHazards(list);
    },
    sweep(f, b, t, p, pace) {
      const a0 = Math.atan2(t.y - b.y, t.x - b.x), list = [];
      for (let i = 0; i < p.n; i++) list.push({ k: 'cone', x: b.x, y: b.y, a: a0 + (i % 2 ? 1 : -1) * 0.5 + i * 1.05, r: 420, arc: p.arc, delay: (0.9 + i * 0.4) * pace, dmg: b.hit * 0.38 });
      this.addHazards(list);
    },
    charge(f, b, t, p, pace) {
      const a = Math.atan2(t.y - b.y, t.x - b.x), len = Math.max(620, dist(t.x, t.y, b.x, b.y) + 200), delay = 1 * pace;
      this.addHazards([{ k: 'line', x: b.x, y: b.y, a, len, w: p.w, delay, dmg: b.hit * 0.45 }]);
      b.charge = { a, left: len, delay };
      if (p.repeat > 1) b.gap = Math.min(b.gap, 2.2);
    },
    bullet(f, b, t, p, pace) {
      const list = [];
      for (let w = 0; w < p.waves; w++) for (let i = 0; i < p.n; i++) {
        list.push({ k: 'proj', x: b.x, y: b.y, a: (i / p.n) * Math.PI * 2 + w * 0.2, v: 300, r: 15, delay: (0.8 + w * 0.5) * pace, dmg: b.hit * 0.2 });
      }
      this.addHazards(list);
    },
    safe(f, b, t, p, pace) {
      const spots = [];
      for (let i = 0; i < p.n; i++) spots.push([300 + this.rand() * (W - 450), 180 + this.rand() * 650, p.r]);
      this.addHazards([{ k: 'safe', spots, x: 0, y: 0, delay: 2.4 * pace, dmg: b.hit * 0.7 }]);
    },
    rows(f, b, t, p, pace) {
      const list = [], gap = (ARENA.y1 - ARENA.y0) / p.n, off = this.rand() < 0.5 ? 0 : 1;
      for (let i = 0; i < p.n; i++) list.push({ k: 'line', x: ARENA.x0, y: ARENA.y0 + gap * (i + 0.5), a: 0, len: ARENA.x1 - ARENA.x0, w: gap * 0.8, delay: (1.1 + ((i + off) % 2) * 0.9) * pace, dmg: b.hit * 0.4 });
      this.addHazards(list);
    },
  };

  const api = { Game, W, H, ROAD, INNER, ARENA, PATH, dist, clamp, inLine, inCone, angDiff };
  root.RTD_ENGINE = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
