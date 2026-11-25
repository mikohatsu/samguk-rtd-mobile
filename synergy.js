// 인연 시너지 v0.3 보스전 효과: 트리거 → 행동 처리기 하나로 데이터(theme-samguk.js synergies[].tiers[].boss)를 읽는다.
// 설계: production/team/2026-11-19/synergy-v03-design.md (4-2절). engine.js의 Game에 함수를 더한다(raid.js와 같은 방식).
// 규칙
// - 보스전 효과는 보스전 함수(stepFight·stepChamp·useSkill·damageBoss·hurtChamp)에서만 읽는다. 라인 중간보스(damageEnemy)는 읽지 않는다.
// - 한 사람의 한 인연은 출전한 구성원 중 칸 번호가 가장 앞선 장수(주장) 한 명에게만 걸린다. 단계는 첫 출전 때 찍어 두고 그 보스전 동안 바꾸지 않는다.
// - 난수를 쓰지 않는다(시간·횟수·사건으로만 발동). 피해는 모두 damageBoss(v, c, { syn: true })를 거쳐 협동에서는 pending으로 방장에게 간다.
// - 원군 피해(syn)는 적중 트리거(hitN·crit·표식)를 다시 부르지 않는다.
// - 연출은 fx 목록에 넣기만 한다(그림은 src/ui/07-arena.js가 기존 그림으로 그린다). 남의 원군 연출은 presence(sv)로 받아 이름표와 함께 그린다.
(function (root) {
  const E = root.RTD_ENGINE || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const { Game, ARENA, dist, clamp, inLine, inCone } = E;
  const P = Game.prototype;
  // 겹치기 상한(설계 1-4절)
  const CAP = { bdmg: 1, guard: 0.3, haste: 0.6, dashCdr: 0.4, samp: 0.5, shield: 0.5, endure: 2 };
  const VIS_MAX = 4; // 동시에 화면에 나오는 원군 그림 수(피해는 그림 수와 상관없이 들어간다)
  // 주장 한 명에게 걸리는 보스전 인연 수 상한(확장 문서 1-6절). 단계 등급이 높은 순, 같으면 표 순서로 고른다. 사용자가 바꿀 수 있는 값
  const MAX_PER_CARRY = 5;
  // 원군 피해 예산: 주장 자신의 피해 대비 비율(등급 하·중·상·극·극+). 최고 단계 30~50%, 낮은 단계는 더 낮게
  const ALLY_RATIO = [0, 0.15, 0.22, 0.3, 0.4, 0.5], ALLY_SEED = 4;
  const r2 = (v) => Math.round(v * 100) / 100;

  const baseStat = () => ({ bdmg: 0, guard: 0, hpPct: 0, skillAmp: 0, haste: 0, dashCdr: 0, burnAmp: 0, healUses: 0, healAmp: 0, regen: 0, crit: [], lowHp: [], highHp: [], bossLow: [], endure: [], rotate: [], revive: null, pair: 0 });
  function addStat(o, st, s) {
    Object.keys(st).forEach((k) => {
      const v = st[k];
      if (k === 'crit') v.forEach((x) => o.crit.push({ ch: x.ch, mult: x.mult, name: s.name }));
      else if (k === 'dashCdr') o.dashCdr = Math.max(o.dashCdr, v); // 대시 단축은 가장 큰 값만
      else if (k === 'lowHp' || k === 'highHp' || k === 'bossLow' || k === 'rotate') o[k].push(Object.assign({ sid: s.id }, v));
      else if (k === 'endure') o.endure.push(Object.assign({ name: s.name }, v));
      else if (k === 'revive') { if (!o.revive || v.pct > o.revive.pct) o.revive = Object.assign({ name: s.name }, v); } // 회복량이 가장 큰 것 하나
      else if (k === 'pairBdmg') { /* synRefresh가 따로 본다 */ }
      else if (typeof v === 'number') o[k] = (o[k] || 0) + v;
    });
  }

  // ---- 셈: 주장과 상시 수치 ----
  // 이번 보스전의 인연 단계(첫 출전 때 한 번). 보스전 도중 라인 조합으로 단계가 바뀌어도 반영하지 않는다(설계 1-3절).
  P.synSnapshot = function () {
    const f = this.fight;
    if (f.synSnap) return f.synSnap;
    this.recomputeAuras();
    const p = this.me, out = [];
    (this.T.synergies || []).forEach((s) => { const x = p.syn && p.syn[s.id]; if (x && x.tier && x.tier.boss) out.push({ s, lv: x.lv, tier: x.tier, B: x.tier.boss }); });
    f.synSnap = out;
    return out;
  };
  // 그 인연의 주장: 출전 중(쓰러지지 않고 대기 중이 아닌) 내 구성원 중 칸 번호가 가장 앞선 장수. 시그니처(s.core)는 core 장수만
  P.synCarrier = function (s) {
    let best = null;
    for (const c of this.fight.champs) {
      if (c.owner !== this.me.idx || c.dead || c.bench || !(s.core ? c.def.id === s.core : s.units.includes(c.def.id))) continue;
      if (!best || c.slot < best.slot) best = c;
    }
    return best;
  };
  // 주장이 바뀌었을 때만(출전·쓰러짐·일기토 교대) 장수마다 걸린 인연(c.syR)과 상시 수치(c.syP)를 다시 모은다
  P.synRefresh = function () {
    const f = this.fight, snap = f.synSnap;
    if (!snap) return;
    const mine = this.localChamps();
    const car = snap.map((x) => { const c = this.synCarrier(x.s); return c ? c.uid : 0; });
    const sig = car.join() + '|' + mine.map((c) => c.uid + (c.dead ? 'd' : '') + (c.bench ? 'b' : '')).join();
    if (sig === f.synSig) return;
    f.synSig = sig;
    mine.forEach((c) => { c.syR = []; c.syP = baseStat(); c.syS = c.syS || {}; c.syT = c.syT || {}; c.syCd = c.syCd || {}; c.syCnt = c.syCnt || {}; c.syOnce = c.syOnce || {}; c.syBuf = c.syBuf || {}; });
    snap.forEach((x, i) => {
      const c = car[i] && mine.find((o) => o.uid === car[i]);
      if (c) c.syR.push({ s: x.s, B: x.B, lv: x.lv, g: x.tier.g || 1, o: i });
    });
    // 주장 한 명당 MAX_PER_CARRY개까지(등급 높은 순 → 표 순서). 나머지는 라인 효과만(c.syOver에 이름만 남긴다)
    mine.forEach((c) => {
      c.syR.sort((a, b) => b.g - a.g || a.o - b.o);
      c.syOver = c.syR.slice(MAX_PER_CARRY).map((R) => R.s.id);
      c.syR = c.syR.slice(0, MAX_PER_CARRY);
      c.syR.forEach((R) => { if (R.B.stat) addStat(c.syP, R.B.stat, R.s); });
    });
    // 신정의 결투: 혼자 하기에서 맞수 둘이 함께 출전하면 그림 대신 두 장수 모두 피해 +
    snap.forEach((x) => {
      const pb = x.B.stat && x.B.stat.pairBdmg;
      if (!pb) return;
      const both = mine.filter((c) => !c.dead && !c.bench && x.s.units.includes(c.def.id));
      if (new Set(both.map((c) => c.def.id)).size >= 2) both.forEach((c) => (c.syP.pair += pb));
    });
  };
  // 출전 직후(engine deploy): 단계를 찍고 주장을 정한 뒤 보스전 체력을 더한다
  P.synDeployed = function (c) {
    if (c.owner !== this.me.idx) return;
    this.synSnapshot();
    this.fight.synSig = null;
    this.synRefresh();
    const hp = c.syP ? c.syP.hpPct : 0;
    if (hp > 0) { c.mhp *= 1 + hp; c.hp = c.mhp; }
  };
  // 보스전 시작: 시작 트리거
  P.synBegin = function () {
    const f = this.fight;
    if (!f || !f.synSnap) return;
    f.synSig = null; this.synRefresh();
    this.localChamps().forEach((c) => { if (!c.dead && !c.bench) this.synFire(c, 'start', {}); });
  };
  // 지휘 교대(동오 대도독): 지금 켜진 효과
  P.synRot = function (c) {
    const out = [];
    (c.syP ? c.syP.rotate : []).forEach((r) => out.push(r.list[Math.floor(this.fight.t / r.every) % r.list.length]));
    return out;
  };
  // 상시 + 시간 제한 + 스택 + 조건부 값의 합(상한 적용). k: bdmg·guard·haste·skillAmp
  P.synGet = function (c, k) {
    const S = c && c.syP;
    if (!S) return 0;
    let v = S[k] || 0;
    this.synRot(c).forEach((o) => { if (typeof o[k] === 'number') v += o[k]; });
    const bf = c.syBuf[k]; if (bf && bf.t > 0) v += bf.v;
    Object.keys(c.syS).forEach((key) => { const st = c.syS[key]; if (st.n > 0 && st.per && st.per[k]) v += st.n * st.per[k]; });
    const hpf = c.hp / c.mhp;
    if (k === 'bdmg') {
      S.lowHp.forEach((x) => { if (hpf <= x.th && x.bdmg) v += x.bdmg; });
      S.highHp.forEach((x) => { if (hpf >= x.th && x.bdmg) v += x.bdmg; });
      const bf2 = this.fight.boss; S.bossLow.forEach((x) => { if (bf2.hp < bf2.mhp * x.th) v += x.bdmg; }); // 보스 체력이 낮을 때(오관참장)
      v += S.pair;
      return Math.min(CAP.bdmg, v);
    }
    if (k === 'guard') {
      S.lowHp.forEach((x) => { if (hpf <= x.th && x.guard) v += x.guard; });
      (c.syAl || []).forEach((a) => { if (a.t > 0 && a.guard) v = Math.max(v, (S.guard || 0) + a.guard); });
      return Math.min(CAP.guard, v);
    }
    if (k === 'haste') return Math.min(CAP.haste, v);
    return v;
  };
  // 보스전 치명 목록(라인 인연 치명은 넣지 않는다)
  P.synCrits = function (c) {
    if (!c.syP) return [];
    let out = c.syP.crit;
    this.synRot(c).forEach((o) => { if (o.crit) out = out.concat(o.crit); });
    return out;
  };
  P.synDashCdr = function (c) { return c && c.syP ? Math.min(CAP.dashCdr, c.syP.dashCdr) : 0; };
  // 화타 회복 버튼 추가 횟수(괄골요독): 내 장수 중 가장 큰 값
  P.synHealBonus = function () { return this.fight ? this.localChamps().reduce((m, c) => Math.max(m, c.syP ? c.syP.healUses : 0), 0) : 0; };
  // 다음 스킬 피해 배율(출사표·오장원). 쓰면 사라진다
  P.synTakeNext = function (c) { const n = c.syNext; if (!n || !(n.t > 0)) return 0; c.syNext = null; return n.x; };

  // ---- 팀 보스 약화(samp): ampBoss와 따로 곱한다. 플레이어 중 가장 큰 값만(겹쳐 쌓이지 않는다) ----
  P.sampBoss = function (v, dur) {
    const f = this.fight, M = f.mech;
    v = Math.min(CAP.samp, v);
    if (!(M.sampT > 0) || v >= M.sampV) M.sampV = v;
    M.sampT = Math.max(M.sampT || 0, dur);
    if (this.net && !this.isAuthority) f.pendSamp = [Math.max(v, (f.pendSamp || [0])[0]), dur];
  };

  // ---- 회복: 넘친 양을 heal 트리거로(인술) ----
  P.synHealC = function (c, amt) {
    if (!(amt > 0) || c.dead) return;
    const before = c.hp;
    c.hp = Math.min(c.mhp, c.hp + amt);
    const over = amt - (c.hp - before);
    if (over > 0 && c.syR && c.syR.length) this.synFire(c, 'heal', { over });
  };

  // ---- 트리거 ----
  P.synFire = function (c, on, ctx) {
    if (!c || !c.syR || !c.syR.length || c.dead) return;
    for (const R of c.syR) {
      const rules = R.B.rules;
      if (!rules) continue;
      for (let i = 0; i < rules.length; i++) if (rules[i].on === on) this.synRun(c, R, rules[i], i, ctx || {});
    }
  };
  // 이벤트를 내 출전 장수 모두에게(보스 패턴 등)
  P.synEvent = function (on, ctx) {
    if (!this.fight || this.phase !== 'boss' || this.fight.mech.hide) return;
    this.localChamps().forEach((c) => { if (!c.dead && !c.bench) this.synFire(c, on, ctx); });
  };
  P.synRun = function (c, R, r, ri, ctx) {
    const key = R.s.id + ':' + ri, f = this.fight;
    if (r.key && ctx.key !== r.key) return;
    if (r.carrier && c.def.id !== r.carrier) return;
    if (r.skillK && !(ctx.s && ctx.s.k === r.skillK)) return;
    if (r.dmgSkill && !(ctx.s && ctx.s.mult > 0)) return;
    if (r.first && ctx.i !== this.synFirstSkill(c)) return;
    if (r.atMax) { const st = c.syS[r.atMax]; if (!st || st.n < st.max) return; }
    if (r.inField && !(f.synF || []).some((o) => o.c === c && dist(c.x, c.y, o.x, o.y) <= o.r)) return;
    if (r.lane && this.synLane(c, R.s).length < r.lane) return;
    if (r.need && !this.synLane(c, R.s).some((id) => r.need.includes(id))) return;
    if (r.th) { if (!(c.hp > 0 && c.hp < c.mhp * r.th)) return; if (r.once) { if (c.syOnce[key]) return; c.syOnce[key] = 1; } }
    if (r.n) { c.syCnt[key] = (c.syCnt[key] || 0) + 1; if (c.syCnt[key] % r.n) return; }
    if (r.nth) { c.syCnt[key + 'n'] = (c.syCnt[key + 'n'] || 0) + 1; if (c.syCnt[key + 'n'] % r.nth) return; }
    if (r.cd) { if (c.syCd[key] > 0) return; c.syCd[key] = r.cd; }
    // 이동기(대시)는 피해 없이 이동만(2026-11-26 사용자 「이동기에 왜 딜이 있어???」, theme rules.dashNoDmg): 대시로 발동하는 인연 효과 중
    // 피해를 주는 것(하비의 책사 장료 돌진 dashHit, 단기의 맹장 찌르기 dmg)은 빼고 버프·재사용 같은 나머지만 쓴다
    const noDmg = r.on === 'dash' && this.R.dashNoDmg;
    r.do.forEach((a) => { if (noDmg && (a.k === 'dmg' || a.k === 'dashHit')) return; this.synDo(c, R, a, ctx); });
    // 대시에 피해가 붙는 인연(단기의 맹장·하비의 책사)은 발동할 때 장수 머리 위에 인연 이름을 띄워 왜 피해가 났는지 알게 한다(2026-11-26 사용자 결정: 피해 유지 + 이름 표시)
    if (r.on === 'dash' && !noDmg && c.owner === this.me.idx && R.s && R.s.name && r.do.some((a) => a.k === 'dmg' || a.k === 'dashHit')) this.log('dmgtext', { x: c.x, y: c.y - 150, v: '「' + R.s.name + '」', big: true });
  };
  // 메아리를 거는 스킬: 첫 직선 스킬(없으면 첫 피해 스킬)
  P.synFirstSkill = function (c) {
    const sk = c.def.sk || [];
    const i = sk.findIndex((s) => s.k === 'line');
    return i >= 0 ? i : sk.findIndex((s) => s.mult > 0);
  };
  // 라인에 남은 구성원(주장과 같은 장수·출전 중인 유닛 제외), 인연 구성원 순서로
  P.synLane = function (c, s, ids) {
    const p = this.players[c.owner], seen = {}, out = [];
    for (const u of this.units) {
      const id = u.def.id;
      if (u.owner !== p.idx || id === c.def.id || seen[id] || !(ids || s.units).includes(id) || this.inFight(u)) continue;
      seen[id] = 1; out.push(id);
    }
    return out.sort((a, b) => s.units.indexOf(a) - s.units.indexOf(b));
  };
  P.synS = function (c) { return this.champAtk(c) / this.attackTime(c.def); };
  // 인연 피해(원군·화선·표식 폭발 등) 예산: 주장이 실제로 넣은 피해(평타·스킬·화상)의 비율까지만. 원군이 주장보다 돋보이지 않게(2026-11-19 프로듀서 결정)
  // 비율은 주장에게 걸린 인연 중 가장 높은 단계 등급으로 정한다. 처음 몇 초는 공칭 피해(ALLY_SEED초 × S)를 미리 쳐 준다. 결정적이다(난수 없음).
  P.synAllyBudget = function (c) {
    const g = (c.syR || []).reduce((m, R) => Math.max(m, R.g || 1), 1);
    return ALLY_RATIO[Math.min(5, g)] * ((c.syOwnD || 0) + ALLY_SEED * this.synS(c)) - (c.syAllyD || 0);
  };
  P.synHit = function (c, v, extra) {
    const f = this.fight;
    if (!f || f.mech.hide || !(v > 0) || this.phase !== 'boss') return 0;
    const cap = this.synAllyBudget(c);
    if (!(cap > 0)) return 0;
    return this.damageBoss(v, c, Object.assign({ syn: true, cap }, extra));
  };
  P.synLater = function (c, t, fn) { const f = this.fight; (f.synQ = f.synQ || []).push({ t, c, fn }); };

  // ---- 연출(fx만 넣는다) ----
  P.synVisOk = function () { let n = 0; for (const x of this.fx) if (x.k === 'synAlly' && !x.who) n++; return n < VIS_MAX; };
  P.synPos = function (c, pos, i) {
    const b = this.fight.boss, a = Math.atan2(b.y - c.y, b.x - c.x);
    if (pos === 'side') { const o = [[-1, 0.9], [1, 0.9], [-1, -0.9], [1, -0.9]][i % 4]; return [clamp(c.x + Math.cos(a + o[1] * 1.6) * 80 * Math.abs(o[0]), ARENA.x0, ARENA.x1), clamp(c.y + Math.sin(a + o[1] * 1.6) * 80, ARENA.y0, ARENA.y1)]; }
    if (pos === 'far') return [ARENA.x1 - 70, clamp(b.y + ((i % 3) - 1) * 110, ARENA.y0 + 60, ARENA.y1 - 60)];
    if (pos === 'behind') return [clamp(b.x + Math.cos(a) * 95, ARENA.x0, ARENA.x1), clamp(b.y + Math.sin(a) * 95, ARENA.y0, ARENA.y1)];
    // 기본: 결투장 왼쪽 가장자리(라인에서 온 원군)
    const span = ARENA.y1 - ARENA.y0 - 220;
    return [ARENA.x0 + 50, ARENA.y0 + 110 + ((i * 170 + (this.fight.synVisN || 0) * 70) % span)];
  };
  // 원군 그림 한 번: 그림 + 공격 연출(look: shot 무기 투사체 / skill 그 장수의 첫 피해 스킬 연출 / charge 돌격)
  P.synAllyFx = function (id, x, y, look, wp, who) {
    const d = this.defs[id], f = this.fight, b = f.boss;
    if (!d) return;
    if (!who) f.synVisN = (f.synVisN || 0) + 1;
    this.fx.push({ k: 'synAlly', id, x, y, t: 0, life: 0.75, tx: b.x, ty: b.y, who: who || null });
    const a = Math.atan2(b.y - y, b.x - x), dd = dist(x, y, b.x, b.y), sk = look === 'skill' ? (d.sk || []).find((s) => s.mult > 0) : null;
    if (look === 'charge') this.fx.push({ k: 'cone', x, y, a, r: dd + 60, arc: 0.7, t: -0.1, life: 0.42, c: '#ffd0a0', vx: 'charge' });
    else if (sk && sk.k === 'line') this.fx.push({ k: 'beam', x, y, a, len: dd + 80, w: 70, t: -0.1, life: 0.5, c: sk.fx, vx: sk.vx });
    else if (sk && sk.k === 'cone') this.fx.push({ k: 'cone', x, y, a, r: dd + 60, arc: 0.8, t: -0.1, life: 0.42, c: sk.fx, vx: sk.vx });
    else if (sk && sk.k === 'circle') this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 120, t: -0.1, life: 0.6, c: sk.fx, vx: sk.vx });
    else this.fx.push({ k: 'shot', wp: wp || this.weapon(d), big: true, x0: x, y0: y, x1: b.x, y1: b.y, t: -0.12, life: 0.3, c: this.shotColor(d) });
    this.fx.push({ k: 'spark', x: b.x, y: b.y - 20, t: -0.3, life: 0.22, c: this.shotColor(d), r: 44, a });
  };
  // 협동: 다른 사람 화면에 보낼 연출 기록(최근 6개). net.js가 presence(sv)로 보낸다
  P.synOut = function (ev) {
    const f = this.fight;
    this.synQn = (this.synQn || 0) + 1;
    (f.synEv = f.synEv || []).push(Object.assign({ q: this.synQn, r: this.round }, ev));
    if (f.synEv.length > 6) f.synEv.shift();
  };
  P.synShowAlly = function (c, id, pos, i, look, wp) {
    if (!this.synVisOk()) return;
    const [x, y] = this.synPos(c, pos, i);
    this.synAllyFx(id, x, y, look, wp);
    this.synOut({ k: 'a', id, x: Math.round(x), y: Math.round(y), l: look || '', w: wp || '' });
  };
  // 받는 쪽: 남의 원군 연출(피해 없음, 이름표). peer별로 이미 본 번호는 다시 그리지 않는다
  P.synRemote = function (peer, name, list) {
    const f = this.fight;
    if (!f || this.phase !== 'boss' || !Array.isArray(list)) return;
    const seen = (this.synSeen = this.synSeen || {}), first = seen[peer] == null;
    let top = seen[peer] || 0;
    list.forEach((e) => {
      if (!e || typeof e.q !== 'number' || e.r !== this.round) return;
      if (!first && e.q > (seen[peer] || 0)) this.synRemoteOne(e, String(name || '').slice(0, 12));
      top = Math.max(top, e.q);
    });
    seen[peer] = top;
  };
  P.synRemoteOne = function (e, who) {
    const b = this.fight.boss, num = (v) => typeof v === 'number' && isFinite(v);
    if (e.k === 'a' && this.defs[e.id] && num(e.x) && num(e.y)) this.synAllyFx(e.id, clamp(e.x, ARENA.x0, ARENA.x1), clamp(e.y, ARENA.y0, ARENA.y1), e.l === 'skill' || e.l === 'charge' ? e.l : null, typeof e.w === 'string' && e.w ? e.w : null, who);
    else if (e.k === 's' && num(e.y)) this.fx.push({ k: 'synShip', x0: ARENA.x0 + 30, y0: clamp(e.y, ARENA.y0, ARENA.y1), x1: b.x, y1: b.y, t: 0, life: 0.8, who });
    else if (e.k === 'r' && num(e.y)) this.fx.push({ k: 'synRider', id: this.defs[e.id] ? e.id : null, x0: ARENA.x0, x1: ARENA.x1, y: clamp(e.y, ARENA.y0, ARENA.y1), t: 0, life: 1.2, who });
  };

  // ---- 행동 ----
  P.synDo = function (c, R, a, ctx) {
    const f = this.fight, b = f.boss, S = this.synS(c), s = R.s;
    const pickId = (ids) => {
      if (!ids) return null;
      const lane = this.synLane(c, s, ids), pool = ids.filter((id) => id !== c.def.id);
      return lane[0] || pool[0] || null;
    };
    switch (a.k) {
      case 'dmg': {
        const id = a.partner ? (a.ids.find((x) => x !== c.def.id) || null) : pickId(a.ids);
        const go = () => {
          this.synHit(c, a.m * S, a.stun ? { stun: a.stun } : null);
          if (id) this.synShowAlly(c, id, a.pos || 'side', 0, a.look, a.wp);
          if (a.vx) this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 130, t: 0, life: 0.6, c: a.col || '#fff0b0', vx: a.vx });
          if (a.beam) this.fx.push({ k: 'beam', x: c.x, y: c.y, a: Math.atan2(b.y - c.y, b.x - c.x), len: dist(c.x, c.y, b.x, b.y) + 80, w: 80, t: 0, life: 0.5, c: a.col || '#c8f0ff', vx: a.beam });
          if (a.anim) this.fx.push({ k: 'synAnim', name: a.anim, x: b.x, y: b.y - 30, r: 150, t: 0, life: 0.5, col: a.col || null });
          if (c.owner === this.me.idx) this.log('dmgtext', { x: b.x, y: b.y - 110, v: Math.round(a.m * S), big: true });
        };
        if (a.delay) this.synLater(c, a.delay, go); else go();
        break;
      }
      case 'volley': {
        let list = a.ids ? this.synLane(c, s, a.ids) : this.synLane(c, s);
        if (!list.length && a.any && a.ids) list = a.ids.filter((id) => id !== c.def.id).slice(0, 1);
        if (!list.length) break;
        const n = a.n || list.length, rot = (c.syCnt['rot:' + s.id] = (c.syCnt['rot:' + s.id] || 0) + n) - n;
        this.synHit(c, a.m * S * n);
        for (let k = 0; k < n; k++) this.synShowAlly(c, list[(rot + k) % list.length], a.pos, k, a.look, a.wp);
        break;
      }
      case 'ally': {
        // 호위·소환: 라인에 있는 구성원(ids가 있으면 그중)을 먼저, 없으면 출전하지 않은 다른 구성원 그림. dur 'fight' = 보스전 끝까지
        const pool = a.ids || s.units;
        let list = this.synLane(c, s, pool);
        if (!list.length) list = pool.filter((id) => id !== c.def.id && this.defs[id] && this.defs[id].tier > 0);
        const n = Math.min(a.n || 1, list.length), alt = (c.syCnt['alt:' + s.id] = (c.syCnt['alt:' + s.id] || 0) + 1) - 1, dur = a.dur === 'fight' ? 1e6 : a.dur;
        c.syAl = (c.syAl || []).filter((al) => al.sid !== s.id);
        for (let k = 0; k < n; k++) c.syAl.push({ sid: s.id, id: list[(alt + k) % list.length], t: dur, max: dur, cd: 0.4 + k * 0.5, m: a.m, guard: a.guard || 0, i: c.syAl.length });
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 110, t: 0, life: 0.7, c: '#d8ecff', vx: 'guard' });
        break;
      }
      case 'ship': {
        for (let k = 0; k < (a.n || 1); k++) {
          const y0 = clamp(b.y + (k - ((a.n || 1) - 1) / 2) * 120, ARENA.y0 + 40, ARENA.y1 - 40), lag = k * 0.35;
          this.fx.push({ k: 'synShip', x0: ARENA.x0 + 30, y0, x1: b.x, y1: b.y, t: -lag, life: 0.8 });
          this.synOut({ k: 's', y: Math.round(y0) });
          this.synLater(c, 0.8 + lag, () => {
            this.synHit(c, a.m * S);
            this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 140, t: 0, life: 0.6, c: '#ff7a2a', vx: 'fireblast' });
            this.fx.push({ k: 'synAnim', name: 'boom', x: b.x, y: b.y - 30, r: 170, t: 0, life: 0.55 });
            if (c.owner === this.me.idx) { this.log('dmgtext', { x: b.x, y: b.y - 110, v: Math.round(a.m * S), big: true }); this.log('sfx', { s: 'skb', vx: 'fireblast', tier: 7, hit: true, gap: 110 }); }
          });
        }
        break;
      }
      case 'riders': {
        const n = a.n || 5, ids = a.ids || ['cav'];
        for (let k = 0; k < n; k++) {
          const id = a.soldier ? null : ids[k % Math.max(1, ids.length)] || null, y = clamp(b.y + ((k % 3) - 1) * 70 + (k > 2 ? 35 : 0), ARENA.y0 + 30, ARENA.y1 - 30);
          this.fx.push({ k: 'synRider', id, x0: ARENA.x0, x1: ARENA.x1, y, t: -k * 0.12, life: 1.2 });
          if (k < 2) this.synOut({ k: 'r', id: id || '', y: Math.round(y) });
        }
        const at = clamp((b.x - ARENA.x0) / (ARENA.x1 - ARENA.x0), 0.1, 0.95) * 1.2 + 0.1;
        this.synLater(c, at, () => { this.synHit(c, a.m * S * n); this.fx.push({ k: 'synAnim', name: 'smoke', x: b.x, y: b.y, r: 160, t: 0, life: 0.6, col: '#d8c8a8' }); });
        break;
      }
      case 'echo': {
        const sk = (c.def.sk || [])[ctx.i];
        if (!sk) break;
        for (let k = 0; k < (a.n || 1); k++) this.synLater(c, (a.gap || 0.35) * (k + 1), () => this.synEcho(c, sk, ctx, a.pct, a.ally && k === (a.n || 1) - 1 ? a.ally : null));
        break;
      }
      case 'field': {
        const F = (f.synF = f.synF || []), r = 130;
        const at = ctx.s && ctx.s.k === 'circle' && ctx.px != null ? [ctx.px, ctx.py] : [b.x, b.y];
        const mine = F.filter((o) => o.c === c);
        if (mine.length >= (a.max || 2)) F.splice(F.indexOf(mine[0]), 1); // 가장 오래된 것부터
        // vis: rune 수경 법진(기본) / fire 이릉 불 장판
        F.push({ c, x: at[0], y: at[1], r, t: a.dur, max: a.dur, tick: 1, m: a.m, vis: a.vis || 'rune' });
        this.fx.push({ k: 'blast', x: at[0], y: at[1], r, t: 0, life: 0.6, c: a.vis === 'fire' ? '#ff7a2a' : '#a0d8ff', vx: a.vis === 'fire' ? 'fireblast' : 'rune' });
        break;
      }
      case 'buff': {
        const o = c.syBuf[a.stat];
        c.syBuf[a.stat] = { v: o && o.t > 0 ? Math.max(o.v, a.v) : a.v, t: Math.max(o && o.t > 0 ? o.t : 0, a.dur) };
        if (a.vx) this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 90, t: 0, life: 0.6, c: '#c8f0ff', vx: a.vx });
        break;
      }
      case 'stack': {
        const st = (c.syS[a.key] = c.syS[a.key] || { n: 0 });
        st.max = a.max; st.per = a.per || null; st.mark = a.mark || st.mark || null;
        if (a.dur) st.t = a.dur;
        const was = st.n;
        st.n = Math.min(a.max, st.n + (a.add || 1));
        if (a.vx && st.n > was) this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 80, t: 0, life: 0.5, c: '#ffd080', vx: a.vx });
        if (st.n >= a.max) this.synFire(c, 'stackMax', { key: a.key });
        break;
      }
      case 'stackReset': { const st = c.syS[a.key]; if (st) st.n = 0; break; }
      case 'shield': {
        const cap = Math.min(CAP.shield, a.cap || CAP.shield) * c.mhp, cur = c.syShdT > 0 ? c.syShd : 0;
        const v = a.over ? Math.min(cap, cur + (ctx.over || 0)) : Math.min(cap, Math.max(cur, (a.pct || 0) * c.mhp));
        if (!(v > cur)) break;
        if (!(cur > 0)) this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 90, t: 0, life: 0.6, c: '#d8ecff', vx: 'guard' });
        c.syShd = v; c.syShdT = Math.max(c.syShdT > 0 ? c.syShdT : 0, a.dur || 10);
        break;
      }
      case 'refund': c.skillCd = c.skillCd.map((v, j) => (a.which === 'others' && j === ctx.i ? v : Math.max(0, v - a.s))); break;
      case 'samp':
        this.sampBoss(a.v, a.dur);
        if (a.vx) this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 120, t: 0, life: 0.6, c: '#c890ff', vx: a.vx });
        break;
      case 'rally': this.support('rally', a.v, a.dur); break;
      case 'pshield': this.support('pshield', 0, a.dur); break;
      case 'weaken': this.weakenBossAtk(a.v, a.dur); break;
      case 'delay':
        this.delayBoss(a.v);
        if (a.vx) this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 130, t: 0, life: 0.8, c: '#9ad070', vx: a.vx });
        break;
      case 'nextSkill': c.syNext = { x: Math.max(c.syNext && c.syNext.t > 0 ? c.syNext.x : 0, a.x), t: a.win }; break;
      case 'heal':
        this.synHealC(c, a.pct * c.mhp);
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 100, t: 0, life: 0.7, c: '#8ee6a0', vx: 'heal' });
        this.fx.push({ k: 'synAnim', name: 'burst', x: c.x, y: c.y - 30, r: 110, t: 0, life: 0.6, col: '#8ee6a0' });
        break;
      case 'dmgHit': {
        const n = a.n || 1;
        this.synHit(c, (ctx.v || 0) * a.pct * n);
        const a0 = Math.atan2(b.y - c.y, b.x - c.x);
        for (let k = 0; k < Math.min(n, 3); k++) { const da = (k - (n - 1) / 2) * 0.12; this.fx.push({ k: 'shot', wp: 'bow', big: true, x0: c.x, y0: c.y, x1: b.x + Math.cos(a0 + da + Math.PI / 2) * 30 * (k - 1), y1: b.y + Math.sin(a0 + da + Math.PI / 2) * 30 * (k - 1), t: -0.05 * k, life: 0.3, c: '#f4e8c8' }); }
        break;
      }
      case 'dashHit': {
        const id = pickId(a.ids), x0 = ctx.x0, y0 = ctx.y0, len = dist(x0, y0, c.x, c.y), an = Math.atan2(c.y - y0, c.x - x0);
        if (id && this.synVisOk()) { this.synAllyFx(id, x0, y0 + 40, null, null); this.synOut({ k: 'a', id, x: Math.round(x0), y: Math.round(y0 + 40), l: '', w: '' }); }
        this.fx.push({ k: 'beam', x: x0, y: y0 + 40, a: an, len: len + 120, w: 80, t: 0, life: 0.45, c: '#9ad0ff', vx: 'thrust' });
        if (inLine(b.x, b.y, x0, y0, an, len + 120, 160, 60) || dist(c.x, c.y, b.x, b.y) < 200) this.synHit(c, a.m * S);
        break;
      }
      case 'cameo': {
        const id = pickId(a.ids);
        if (id && this.synVisOk()) { const [x, y] = this.synPos(c, 'side', 1); this.fx.push({ k: 'synAlly', id, x, y, t: 0, life: 1, tx: b.x, ty: b.y }); this.synOut({ k: 'a', id, x: Math.round(x), y: Math.round(y), l: 'c', w: '' }); }
        if (a.vx) { if (a.at === 'boss') this.fx.push({ k: 'blast', x: b.x, y: b.y, r: 150, t: 0, life: 0.7, c: '#ff8a7a', vx: a.vx }); else this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 150, t: 0, life: 0.8, c: '#ffe07a', vx: a.vx }); }
        break;
      }
      default: break;
    }
  };
  // 스킬 메아리: 같은 방향(원형은 같은 자리)으로 피해·판정만 다시(재사용은 건드리지 않는다)
  P.synEcho = function (c, sk, ctx, pct, allyId) {
    const f = this.fight, b = f.boss;
    if (!f || c.dead || f.mech.hide) return;
    const dmg = this.champAtk(c) / this.attackTime(c.def) * sk.mult * (1 + this.pv(c.def, 'skillPct') + this.synGet(c, 'skillAmp')) * pct;
    let x = c.x, y = c.y;
    if (allyId && this.synVisOk()) { [x, y] = this.synPos(c, 'side', 0); this.fx.push({ k: 'synAlly', id: allyId, x, y, t: 0, life: 0.75, tx: b.x, ty: b.y }); this.synOut({ k: 'a', id: allyId, x: Math.round(x), y: Math.round(y), l: 'c', w: '' }); }
    const a = ctx.a;
    let hit = false;
    if (sk.k === 'line') { this.fx.push({ k: 'beam', x, y, a, len: sk.len, w: sk.w, t: 0, life: 0.5, c: sk.fx, vx: sk.vx }); hit = inLine(b.x, b.y, x, y, a, sk.len, sk.w, 60); }
    else if (sk.k === 'cone') { this.fx.push({ k: 'cone', x, y, a, r: sk.r, arc: sk.arc, t: 0, life: 0.42, c: sk.fx, vx: sk.vx }); hit = inCone(b.x, b.y, x, y, a, sk.r, sk.arc, 60); }
    else if (sk.k === 'circle' && ctx.px != null) { this.fx.push({ k: 'blast', x: ctx.px, y: ctx.py, r: sk.r, t: 0, life: 0.6, c: sk.fx, vx: sk.vx }); hit = dist(b.x, b.y, ctx.px, ctx.py) <= sk.r + 60; }
    if (hit) { this.synHit(c, dmg); if (c.owner === this.me.idx) this.log('dmgtext', { x: b.x, y: b.y - 90, v: Math.round(dmg), big: true }); }
  };

  // ---- 쓰러짐: 순서는 패시브 버팀(engine) → 인연 버팀 → 부활. 버팀은 패시브와 합해 보스전마다 2회, 부활은 1회 ----
  P.synDeath = function (c, before) {
    const f = this.fight, S = c.syP;
    if (!S || c.owner !== this.me.idx) return false;
    const used = (f.synEnd || 0) + (c.lastUsed ? 1 : 0), endN = S.endure.reduce((m, e) => m + (e.n || 1), 0);
    if (endN > (f.synEnd || 0) && used < CAP.endure) {
      const e = S.endure[0];
      f.synEnd = (f.synEnd || 0) + 1;
      c.hp = e.negate ? Math.max(1, before) : 1; c.inv = Math.max(c.inv, e.inv || 1);
      if (e.buff) c.syBuf.bdmg = { v: e.buff.bdmg, t: e.buff.dur };
      this.fx.push({ k: 'synAnim', name: 'burst', x: c.x, y: c.y - 30, r: 120, t: 0, life: 0.6, col: '#ff6a50' });
      if (e.vx) this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 120, t: 0, life: 0.8, c: '#d8ecff', vx: e.vx });
      this.log('proc', { x: c.x, y: c.y, tx: c.x, ty: c.y, names: [e.name], c: '#ff9a5a' });
      return true;
    }
    if (S.revive && !f.synRev) {
      const r = S.revive;
      f.synRev = true;
      if (r.delay) { c.hp = 1; c.inv = Math.max(c.inv, r.delay + (r.inv || 1)); c.syRevT = r.delay; c.syRevPct = r.pct; this.fx.push({ k: 'synStars', x: c.x, y: c.y, t: 0, life: r.delay, uid: c.uid }); }
      else {
        c.hp = c.mhp * r.pct; c.inv = Math.max(c.inv, r.inv || 1);
        this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 120, t: 0, life: 0.8, c: '#8ee6a0', vx: 'heal' });
        this.fx.push({ k: 'synAnim', name: 'burst', x: c.x, y: c.y - 30, r: 130, t: 0, life: 0.7, col: '#ffd86a' });
      }
      if (r.buff) c.syBuf.bdmg = { v: r.buff.bdmg, t: r.buff.dur + (r.delay || 0) };
      if (r.ps) this.support('pshield', 0, r.ps);
      this.log('proc', { x: c.x, y: c.y, tx: c.x, ty: c.y, names: [r.name], c: '#ffd86a' });
      return true;
    }
    return false;
  };
  // 보스 큰 공격을 피함(오장원): 보스 장판이 터지는 순간, 큰 공격이고 가까이 있었는데 맞지 않았으면
  P.synHazardFired = function (h) {
    if (h.own || h.raid || !this.isBig(h)) return;
    this.localChamps().forEach((c) => {
      if (c.dead || c.bench || !c.syR || !c.syR.length) return;
      if (this.champHit(h, c)) return; // 맞았는지는 피격 판정과 같은 몸통 사각형으로(engine.js champHit)
      const near = h.k === 'safe' || h.k === 'all' || h.k === 'band' || h.k === 'los' || (h.k === 'line' ? inLine(c.x, c.y, h.x, h.y, h.a, h.len, (h.w || 0) + 400, 0) : dist(c.x, c.y, h.x, h.y) <= (h.r || h.r1 || 0) + 400);
      if (near) { this.synFire(c, 'bigDodge', {}); this.fx.push({ k: 'synAnim', name: 'ring', x: c.x, y: c.y, r: 90, t: 0, life: 0.5, col: '#a8ffb8' }); }
    });
  };

  // ---- 매 걸음(stepFight에서 장수 처리 전에) ----
  P.synStep = function (dt) {
    const f = this.fight;
    if (!f || !f.synSnap) return;
    this.synRefresh();
    const hide = f.mech.hide;
    if (f.synQ && f.synQ.length) {
      const due = [];
      f.synQ = f.synQ.filter((q) => { q.t -= dt; if (q.t <= 0) { due.push(q); return false; } return true; });
      due.forEach((q) => { if (!q.c.dead) q.fn(); });
    }
    // 수경 법진: 1초마다 보스가 안에 있으면 피해
    if (f.synF && f.synF.length) {
      f.synF = f.synF.filter((o) => {
        o.t -= dt; o.tick -= dt;
        if (o.tick <= 0) { o.tick += 1; if (!o.c.dead && dist(f.boss.x, f.boss.y, o.x, o.y) <= o.r + 60) this.synHit(o.c, o.m * this.synS(o.c)); }
        return o.t > 0;
      });
    }
    for (const c of this.localChamps()) {
      if (c.dead || !c.syP) continue;
      Object.keys(c.syCd).forEach((k) => { if (c.syCd[k] > 0) c.syCd[k] -= dt; });
      Object.keys(c.syBuf).forEach((k) => { const o = c.syBuf[k]; if (o.t > 0) o.t -= dt; });
      Object.keys(c.syS).forEach((k) => { const st = c.syS[k]; if (st.t != null && st.n > 0) { st.t -= dt; if (st.t <= 0) st.n = 0; } });
      if (c.syNext && c.syNext.t > 0) c.syNext.t -= dt;
      if (c.syShdT > 0) { c.syShdT -= dt; if (c.syShdT <= 0) c.syShd = 0; }
      if (c.dashInv > 0) c.dashInv -= dt;
      if (c.syHurtCd > 0) c.syHurtCd -= dt;
      if (c.syRevT > 0) {
        c.syRevT -= dt; c.hp = Math.max(c.hp, 1);
        if (c.syRevT <= 0) { c.hp = Math.max(c.hp, c.mhp * c.syRevPct); this.fx.push({ k: 'aura', x: c.x, y: c.y, r: 120, t: 0, life: 0.8, c: '#8ee6a0', vx: 'heal' }); }
      }
      if (c.bench || hide) continue;
      // 호위 원군: 주장 곁을 따라다니며 1초마다 친다
      if (c.syAl && c.syAl.length) {
        c.syAl = c.syAl.filter((al) => {
          al.t -= dt; al.cd -= dt;
          if (al.cd <= 0) {
            al.cd += 1;
            this.synHit(c, al.m * this.synS(c));
            const [x, y] = this.synAlPos(c, al);
            const d = this.defs[al.id];
            if (d) { this.fx.push({ k: 'shot', wp: this.weapon(d), big: true, x0: x, y0: y, x1: f.boss.x, y1: f.boss.y, t: 0, life: 0.28, c: this.shotColor(d) }); this.synOut({ k: 'a', id: al.id, x: Math.round(x), y: Math.round(y), l: '', w: '' }); }
          }
          return al.t > 0;
        });
      }
      // 재생(강동이교)
      if (c.syP.regen) { c.syRg = (c.syRg || 0) + dt; if (c.syRg >= 1) { c.syRg -= 1; this.synHealC(c, c.mhp * c.syP.regen); } }
      // 타이머
      for (const R of c.syR) {
        const rules = R.B.rules;
        if (!rules) continue;
        for (let i = 0; i < rules.length; i++) {
          const r = rules[i];
          if (r.on !== 'timer') continue;
          const key = R.s.id + ':' + i;
          c.syT[key] = (c.syT[key] || 0) + dt;
          if (c.syT[key] >= r.every) { c.syT[key] -= r.every; this.synRun(c, R, r, i, {}); }
        }
      }
    }
  };
  // 호위 원군이 서는 자리(주장 둘레, 순번마다 다른 쪽)
  const AL_ANG = [1.2, -1.2, 2.3, -2.3];
  P.synAlPos = function (c, al) {
    const b = this.fight.boss, a = Math.atan2(b.y - c.y, b.x - c.x) + AL_ANG[al.i % 4];
    return [clamp(c.x + Math.cos(a) * 70, ARENA.x0, ARENA.x1), clamp(c.y + Math.sin(a) * 70, ARENA.y0, ARENA.y1)];
  };
  // 실제로 피해를 받았을 때(무적·보호막으로 다 막으면 제외) 0.3초에 1번까지(확장 문서 N2)
  P.synHurt = function (c, dmg) {
    if (!(dmg > 0) || c.dead || !c.syR || !c.syR.length || c.syHurtCd > 0) return;
    c.syHurtCd = 0.3;
    this.synFire(c, 'hurt', {});
  };
  // 협동 presence로 보낼 남의 화면용 연출(바뀌었을 때만). 없으면 null
  P.synWire = function () {
    const f = this.fight;
    if (!f || !f.synEv || !f.synEv.length) return null;
    const top = f.synEv[f.synEv.length - 1].q;
    if (f.synSent === top) return null;
    f.synSent = top;
    return f.synEv.map((e) => Object.assign({}, e));
  };
  P.synCap = CAP;
  P.synMaxPerCarry = MAX_PER_CARRY;
  P.synAllyRatio = ALLY_RATIO;
  P.synR2 = r2;

  if (typeof module !== 'undefined') module.exports = {};
})(typeof window !== 'undefined' ? window : globalThis);
