// 보스 레이드 기믹: 페이즈, 무력화, 반격, 전멸기, 나눠 맞기와 보스별 고유 기믹.
// 결정(페이즈 진입, 오브젝트, 성공·실패)은 방장 게임만 하고, 상태는 보스 동기화(bs)에 실어 모두에게 보낸다.
// 장판(hazard)은 기존처럼 방장이 만들어 hz로 보내고, 각자 자기 출전 유닛에게 적용한다.
(function (root) {
  const E = root.RTD_ENGINE || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const { Game, ARENA, dist, clamp, inLine, inCone, angDiff } = E;
  const P = Game.prototype;
  const CX = (ARENA.x0 + ARENA.x1) / 2, CY = (ARENA.y0 + ARENA.y1) / 2;
  const AW = ARENA.x1 - ARENA.x0, AH = ARENA.y1 - ARENA.y0;
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  // 공격할 수 있는 오브젝트(체력이 있는 것)와 분신
  const HITTABLE = { altar: 1, tower: 1, amb: 1 };
  const PASSIVE = { wind: 1, gaze: 1, push: 1, all: 1 };

  P.raidInit = function (f) {
    f.mech = { ph: 0, objs: [], cast: null, gr: 0, vuln: 0, ctr: 0, face: 0, hide: false, bur: null, busy: null, q: [], oid: 1, enr: false, sym: -1 };
    f.boss.speed = f.def.speed || 120;
    // 기믹을 푸는 동안 보스를 못 치는 시간만큼 체력을 덜어 준다
    f.boss.hp = f.boss.mhp = f.boss.mhp * 0.92;
    f.pendObj = {}; f.pendCtr = 0;
  };
  P.pace = function () { return Math.max(0.55, 1.05 - this.diff.level * 0.08); };
  P.nearestTo = function (x, y) {
    let t = null, bd = 1e9;
    this.allTargets().forEach((o) => { const d = dist(o.x, o.y, x, y); if (d < bd) { bd = d; t = o; } });
    return t;
  };
  P.announce = function (name) {
    this.log('pattern', { name }); this.log('sfx', { s: 'warn' });
    if (this.net) this.net.send('pattern', { n: name });
  };
  P.addObj = function (k, x, y, r, hp, extra) {
    const M = this.fight.mech, o = Object.assign({ id: M.oid++, k, x, y, r, hp: hp || 0, mhp: hp || 0, cd: 1 + this.rand() * 1.5 }, extra);
    M.objs.push(o);
    return o;
  };
  P.dropObjs = function (k) { const M = this.fight.mech; M.objs = M.objs.filter((o) => o.k !== k); };
  // 무력화 필요량: 이 시간 동안 "제한 시간에 겨우 잡는 화력"의 staggerK배를 넣어야 끊긴다(딜이 모자라면 못 끊는다)
  P.staggerNeed = function (dur, k) {
    const f = this.fight, ease = this.players.reduce((m, p) => Math.max(m, this.sageVal(p, 'staggerEase')), 0); // 소교
    return (f.boss.mhp / f.limit) * dur * (k || this.R.staggerK) * (1 - ease);
  };
  // 무력화 게이지에 들어가는 피해(디버퍼의 기세 꺾기 반영)
  P.breakDmg = function (d, c) { return d * (1 + (c && c.def ? this.pv(c.def, 'breaker') : 0)); };
  P.startCast = function (n, dur, fail, extra) {
    const f = this.fight;
    f.mech.cast = Object.assign({ n, t: 0, dur, need: this.staggerNeed(dur), got: 0, fail, lock: true }, extra);
  };

  // ---- 방장 전용: 매 틱 기믹 진행. 2 = 보스 완전 정지, 1 = 제자리(패턴은 씀), 0 = 평소 ----
  P.raidStep = function (dt) {
    const f = this.fight, b = f.boss, M = f.mech;
    for (let i = M.q.length - 1; i >= 0; i--) {
      const q = M.q[i]; if (this.bigPending()) continue; q.t -= dt;
      if (q.t <= 0) { M.q.splice(i, 1); const t = this.nearestTo(b.x, b.y); f.vis = q.v || null; if (t) this.patternGen[q.gen].call(this, f, b, t, Object.assign({}, q.p), this.pace(), this.allTargets()); f.vis = null; }
    }
    const ph = f.def.phases || [];
    // 기믹이 끝나면 12초 동안 큰 공격을 쓰지 않는다(기믹 → 전멸기 → 기믹이 연달아 오지 않게)
    const busyNow = !!(M.busy || M.cast || M.hide);
    if (M.wasBusy && !busyNow) f.bigCd = Math.max(f.bigCd || 0, 12);
    M.wasBusy = busyNow;
    if (!busyNow && !(f.bigCd > 0) && M.ph < ph.length && b.hp / b.mhp <= ph[M.ph].at) {
      const p = ph[M.ph++];
      this.announce(p.n);
      this.mechs[p.m].start.call(this, f, b, p);
      f.bigCd = Math.max(f.bigCd || 0, 15);
    }
    if (M.ctr > 0) {
      M.ctr -= dt;
      if (M.ctr <= 0) {
        M.ctr = 0;
        const go = M.ctrGo; M.ctrGo = null;
        if (go) { f.vis = go.v || null; this.patternGen[go.gen].call(this, f, b, go.t, Object.assign({}, go.p, { now: true }), this.pace(), this.allTargets()); f.vis = null; }
      }
    }
    this.stepObjs(dt);
    if (M.busy) { const m = this.mechs[M.busy.k]; M.busy.t += dt; if (m.step) m.step.call(this, f, b, dt, M.busy); }
    if (M.cast) this.stepCast(dt);
    if (M.gr > 0) { M.gr -= dt; return 2; }
    if (M.hide || M.ctr > 0 || (M.cast && M.cast.lock) || (M.busy && M.busy.lock)) return 2;
    return M.busy && M.busy.still ? 1 : 0;
  };
  // 모든 게임: 표시용 시간 진행(방장 값이 오면 덮어쓴다)
  P.raidTick = function (dt) {
    const M = this.fight.mech;
    if (M.ampT > 0) M.ampT -= dt;
    if (M.charmCd > 0) M.charmCd -= dt;
    if (M.charmT > 0) M.charmT -= dt;
    if (M.adT > 0) M.adT -= dt;
    M.objs.forEach((o) => { if (o.flash > 0) o.flash -= dt; });
    if (!this.isAuthority) { if (M.gr > 0) M.gr -= dt; if (M.ctr > 0) M.ctr -= dt; if (M.cast) M.cast.t += dt; }
  };
  P.stepCast = function (dt) {
    const f = this.fight, M = f.mech, c = M.cast;
    c.t += dt;
    if (c.got >= c.need) {
      M.cast = null; M.gr = 4;
      this.announce(this.L('e_breakOk', null, '무력화 성공 · 그로기'));
      this.fxBurst(f.boss.x, f.boss.y, '#7fd4ff', 160);
      if (c.after) c.after.call(this, true);
    } else if (c.t >= c.dur) {
      M.cast = null;
      this.announce(this.L('e_castGo', { a: c.n }, `${c.n} 발동`));
      if (c.fail === 'safe') this.addHazards([{ k: 'safe', cast: 1, spots: c.spots, x: 0, y: 0, delay: 0.3, dmg: f.boss.hit * 3 }]);
      // 무력화 실패: 전멸 대신 모두 최대 체력의 60% 피해(탱커·힐러가 버티게 해 준다)
      else this.addHazards([{ k: 'all', cast: 1, raid: 1, frac: 0.6, x: 0, y: 0, delay: 0.3, dmg: 0 }]);
      if (c.after) c.after.call(this, false);
    }
  };
  P.counterHit = function () {
    const f = this.fight, M = f.mech;
    if (!(M.ctr > 0)) return;
    M.ctr = 0; M.ctrGo = null; M.gr = 3; f.boss.charge = null;
    this.announce(this.L('e_counterOk', null, '반격 성공 · 그로기'));
    this.fxBurst(f.boss.x, f.boss.y, '#7fd4ff', 140);
  };
  // 보스 정면(반격 판정)
  P.inFront = function (c) { const f = this.fight, b = f.boss; return angDiff(Math.atan2(c.y - b.y, c.x - b.x), f.mech.face) < 1.1; };
  // damageBoss 안에서 호출: 피해 배율(그로기·약점)
  P.raidMul = function () { const M = this.fight.mech; return (1 + M.vuln) * (M.gr > 0 ? 1.3 : 1) * (1 + (M.ampT > 0 ? M.amp : 0)); };
  // 반격도 한두 대가 아니라 정면에서 일정 피해를 넣어야 성공한다
  P.addCounter = function (v) {
    const M = this.fight.mech;
    M.ctrGot = (M.ctrGot || 0) + v;
    if (M.ctrGot >= (M.ctrNeed || 1)) this.counterHit();
  };
  P.raidOnBossDmg = function (d, c) {
    const f = this.fight, M = f.mech, bd = this.breakDmg(d, c), hit = M.ctr > 0 && c ? (this.inFront(c) ? 2 : 1) : 0;
    if (this.isAuthority) { if (M.cast) M.cast.got += bd; if (hit) this.addCounter(hit); }
    else { f.pendSg = (f.pendSg || 0) + bd - d; if (hit) f.pendCtr = (f.pendCtr || 0) + hit; }
  };
  // 방장: 다른 사람이 보낸 피해
  P.remoteDamage = function (d) {
    const f = this.fight, b = f.boss, M = f.mech;
    b.hp = Math.max(0, b.hp - d.v);
    if (d.stun) b.stun = Math.max(b.stun, d.stun);
    if (M.cast) M.cast.got += d.v + (d.sg || 0);
    Object.keys(d.o || {}).forEach((id) => { const o = M.objs.find((x) => x.id === +id); if (o && o.hp > 0) this.damageObj(o, d.o[id]); });
    if (d.ctr && M.ctr > 0) this.addCounter(d.ctr);
    if (d.amp) { if (!(M.ampT > 0) || d.amp[0] >= M.amp) M.amp = d.amp[0]; M.ampT = Math.max(M.ampT || 0, d.amp[1]); }
    if (d.cm) this.charmBoss(d.cm[0], d.cm[1], d.cm[2]);
    if (d.ad) { if (!(M.adT > 0) || d.ad[0] >= M.adV) M.adV = d.ad[0]; M.adT = Math.max(M.adT || 0, d.ad[1]); }
    if (d.gp) b.gap += d.gp;
  };

  // ---- 오브젝트 ----
  P.hitFoe = function (o, v, c) {
    const f = this.fight;
    if (o === f.boss) return this.damageBoss(v, c);
    o.flash = 0.12;
    if (o.k === 'clone') return 0; // 분신은 피해를 받지 않는다
    this.addDealt(c, v);
    if (this.isAuthority) this.damageObj(o, v);
    else { o.hp -= v; f.pendObj[o.id] = (f.pendObj[o.id] || 0) + v; }
    return v;
  };
  P.damageObj = function (o, d) {
    o.hp -= d;
    if (o.hp > 0) return;
    const f = this.fight, M = f.mech;
    M.objs = M.objs.filter((x) => x !== o);
    this.fxBurst(o.x, o.y, '#ffd86a', 70);
    this.log('sfx', { s: 'midkill' });
    if (o.k === 'altar' && !M.objs.some((x) => x.k === 'altar')) { if (M.busy && M.busy.k === 'altars') M.busy = null; M.gr = 5; this.announce(this.L('e_altarDown', null, '제단 파괴 · 그로기')); }
    if (o.k === 'tower' && !M.objs.some((x) => x.k === 'tower')) this.announce(this.L('e_towerDown', null, '궁루 붕괴'));
  };
  P.stepObjs = function (dt) {
    const f = this.fight, b = f.boss, M = f.mech, pace = this.pace();
    for (const o of M.objs.slice()) {
      o.cd -= dt;
      if (o.life != null) { o.life -= dt; if (o.life <= 0) { M.objs = M.objs.filter((x) => x !== o); continue; } }
      if (o.k === 'tower' && o.cd <= 0) {
        o.cd = 3.4; const t = this.nearestTo(o.x, o.y);
        if (t) { const a0 = Math.atan2(t.y - o.y, t.x - o.x); this.addHazards([-0.25, 0, 0.25].map((da) => ({ k: 'line', x: o.x, y: o.y, a: a0 + da, len: 1500, w: 40, delay: 1 * pace, dmg: b.hit * 0.28, fx: 'arrow' }))); }
      } else if (o.k === 'amb' && o.cd <= 0) {
        o.cd = 2.6; const t = this.nearestTo(o.x, o.y);
        if (t) this.addHazards([{ k: 'proj', x: o.x, y: o.y, a: Math.atan2(t.y - o.y, t.x - o.x), v: 360, r: 15, delay: 0.5, dmg: b.hit * 0.22, fx: 'arrow' }]);
      }
    }
  };
  // 출전 유닛이 때릴 대상: 지정 대상 → 가장 가까운 보스·분신·오브젝트
  P.champFoe = function (c) {
    const f = this.fight, b = f.boss, M = f.mech;
    const foes = M.objs.filter((o) => (HITTABLE[o.k] && o.hp > 0) || o.k === 'clone');
    if (c.tgt === 'b') { if (!M.hide) return b; c.tgt = null; }
    if (c.tgt != null) { const o = foes.find((x) => x.id === c.tgt); if (o) return o; c.tgt = null; }
    let best = M.hide ? null : b, bd = best ? dist(c.x, c.y, b.x, b.y) : 1e9;
    foes.forEach((o) => { const d = dist(c.x, c.y, o.x, o.y); if (d < bd) { bd = d; best = o; } });
    return best;
  };
  // 우클릭한 자리에 있는 대상(보스면 'b')
  P.foeAt = function (x, y) {
    const f = this.fight, b = f.boss, M = f.mech;
    const o = M.objs.find((q) => ((HITTABLE[q.k] && q.hp > 0) || q.k === 'clone') && dist(x, y, q.x, q.y) < q.r + 40);
    if (o) return o.id;
    if (!M.hide && dist(x, y, b.x, b.y) < 90) return 'b';
    return null;
  };

  // ---- 장판 ----
  P.exposed = function (bx, by, x, y) {
    // 보스와 유닛 사이를 돌기둥이 가리면 안전
    return !this.fight.mech.objs.some((p) => {
      if (p.k !== 'pillar') return false;
      const dx = x - bx, dy = y - by, l2 = dx * dx + dy * dy || 1, t = ((p.x - bx) * dx + (p.y - by) * dy) / l2;
      if (t <= 0 || t >= 1) return false;
      return dist(bx + dx * t, by + dy * t, p.x, p.y) < p.r * 0.8 && dist(x, y, p.x, p.y) < 260;
    });
  };
  const baseHits = P.hazardHits;
  P.hazardHits = function (h, x, y, pad) {
    if (h.k === 'rect') return x >= h.x - pad && x <= h.x + h.rw + pad && y >= h.y - pad && y <= h.y + h.rh + pad;
    if (h.k === 'band') return y < h.y0 + pad || y > h.y1 - pad;
    if (h.k === 'all') return true;
    if (h.k === 'los') return this.exposed(h.x, h.y, x, y);
    if (PASSIVE[h.k]) return false;
    return baseHits.call(this, h, x, y, pad);
  };
  // 인공지능과 비조작 유닛의 회피용 위험도
  P.danger = function (x, y) {
    let v = 0;
    const f = this.fight, M = f.mech;
    for (const h of f.hazards) {
      if (h.own || PASSIVE[h.k]) continue;
      if (h.k === 'proj') { if (dist(x, y, h.x, h.y) < h.r + 60 || inLine(x, y, h.x, h.y, h.a, h.v * 0.7, h.r * 2 + 50, 0)) v += 2; continue; }
      if (h.dur && h.fired && h.t > h.delay + h.dur - 0.2) continue;
      if (this.hazardHits(h, x, y, 34)) v += 3;
    }
    return v;
  };
  // 피할 때 함께 따져 볼 자리: 돌기둥 그림자, 안전지대·생문 한가운데
  P.raidSpots = function () {
    const f = this.fight, out = [];
    f.hazards.forEach((h) => {
      if (h.k === 'los' && !h.fired) f.mech.objs.forEach((p) => { if (p.k === 'pillar') { const a = Math.atan2(p.y - h.y, p.x - h.x); out.push([p.x + Math.cos(a) * (p.r + 46), p.y + Math.sin(a) * (p.r + 46)]); } });
      if (h.k === 'safe' && !h.fired) h.spots.forEach((s) => out.push([s[0], s[1]]));
      if (h.k === 'band' && !h.fired) out.push([f.boss.x, (h.y0 + h.y1) / 2], [CX, (h.y0 + h.y1) / 2]);
    });
    return out;
  };
  P.gazing = function () { return this.fight.hazards.some((h) => h.k === 'gaze' && h.fired && h.t < h.delay + h.dur); };
  P.gazeHit = function (c) {
    const b = this.fight.boss;
    if (!c.move || dist(c.x, c.y, c.tx, c.ty) < 6) return false;
    return angDiff(Math.atan2(c.ty - c.y, c.tx - c.x), Math.atan2(b.y - c.y, b.x - c.x)) < 1.0;
  };
  // stepHazards에서 raid 장판을 넘겨받는다. true면 지운다.
  P.raidHazard = function (h, dt) {
    const f = this.fight, own = f.champs.filter((c) => !c.dead), end = h.delay + (h.dur || 0);
    if (h.t >= h.delay && !h.fired) {
      h.fired = true;
      if (h.k !== 'wind' && h.k !== 'gaze') this.log('sfx', { s: 'boom', gap: 110 });
      if (h.k === 'push') {
        own.forEach((c) => {
          if (dist(c.x, c.y, h.x, h.y) > h.r) return;
          const a = Math.atan2(c.y - h.y, c.x - h.x);
          c.kx = (Math.cos(a) * h.pw) / 0.35; c.ky = (Math.sin(a) * h.pw) / 0.35; c.kt = 0.35; c.move = false;
        });
      } else if (h.k === 'all') own.forEach((c) => this.hurtChamp(c, h.kill ? c.hp + 1e6 : h.frac ? c.mhp * h.frac : h.dmg));
      else if (h.dmg && h.k !== 'wind' && h.k !== 'gaze') own.forEach((c) => { if (this.hazardHits(h, c.x, c.y, 16)) this.hurtChamp(c, h.kill ? c.hp + 1e6 : h.dmg); });
    }
    if (h.fired && h.t < end) {
      if (h.k === 'wind') own.forEach((c) => { c.x = clamp(c.x + h.vx * dt, ARENA.x0, ARENA.x1); c.y = clamp(c.y + h.vy * dt, ARENA.y0, ARENA.y1); });
      if (h.tick) {
        h.pulse = (h.pulse || 0) - dt;
        if (h.pulse <= 0) {
          h.pulse = 0.5;
          own.forEach((c) => { if (h.k === 'gaze' ? this.gazeHit(c) : this.hazardHits(h, c.x, c.y, 6)) this.hurtChamp(c, h.tick * 0.5); });
        }
      }
    }
    return h.t >= end + 0.3;
  };

  // ---- 인공지능·비조작 유닛 ----
  P.raidAutoTarget = function (c) {
    if (!c.ai) return;
    const M = this.fight.mech, objs = M.objs.filter((o) => HITTABLE[o.k] && o.hp > 0);
    if (objs.length) {
      if (!objs.some((o) => o.id === c.tgt)) c.tgt = objs.slice().sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0].id;
    } else c.tgt = M.objs.some((o) => o.k === 'clone') ? 'b' : null;
  };
  // 기믹이 요구하는 자리(없으면 null)
  P.raidGoal = function (c) {
    const f = this.fight, b = f.boss, M = f.mech;
    // 무력화 실패 대비 안전지대: 시전 끝 3.5초 전부터
    if (M.cast && M.cast.spots && M.cast.t > M.cast.dur - 3.5) {
      const s = M.cast.spots.slice().sort((p, q) => dist(c.x, c.y, p[0], p[1]) - dist(c.x, c.y, q[0], q[1]))[0];
      return [s[0], s[1]];
    }
    // 반격: 보스 정면으로
    if (M.ctr > 0 && !this.inFront(c)) { const r = Math.min(200, this.range(c.def) * 0.8); return [clamp(b.x + Math.cos(M.face) * r, ARENA.x0, ARENA.x1), clamp(b.y + Math.sin(M.face) * r, ARENA.y0, ARENA.y1)]; }
    return null;
  };

  // ---- 시전형 보스: 붙지 않고 거리를 벌려 순간이동하며 원거리로 친다 ----
  P.casterAct = function (t, d, dt) {
    const f = this.fight, b = f.boss, M = f.mech;
    M.blink = (M.blink || 0) - dt;
    if (d < 240 && M.blink <= 0) {
      M.blink = 6;
      const all = this.allTargets();
      let best = null, bs = -1;
      for (let i = 0; i < 12; i++) {
        const x = ARENA.x0 + 120 + this.rand() * (AW - 240), y = ARENA.y0 + 120 + this.rand() * (AH - 240);
        const s = Math.min(...all.map((o) => dist(o.x, o.y, x, y)), 700);
        if (s > bs && s < 700) { bs = s; best = [x, y]; }
      }
      if (best) { this.fx.push({ k: 'dash', x0: b.x, y0: b.y, x1: best[0], y1: best[1], t: 0, life: 0.3, c: f.def.fx }); b.x = best[0]; b.y = best[1]; }
    }
    if (b.atkCd <= 0) {
      b.atkCd = 2.2;
      this.addHazards([{ k: 'proj', x: b.x, y: b.y, a: Math.atan2(t.y - b.y, t.x - b.x), v: 430, r: 16, delay: 0.35, dmg: b.hit * 0.1, fx: 'orb' }]);
    }
  };

  // ---- 보스별 고유 기믹(페이즈) ----
  const ring = (n, rx, ry, off) => Array.from({ length: n }, (_, i) => { const a = off + (i / n) * Math.PI * 2; return [CX + Math.cos(a) * rx, CY + Math.sin(a) * ry]; });
  P.mechs = {
    // 장각: 부적 제단 3개. 제단이 있는 동안 모두에게 낙뢰. 다 부수면 그로기, 30초를 넘기면 폭주.
    altars: {
      start(f) { ring(3, 380, 290, this.rand() * 6).forEach(([x, y]) => this.addObj('altar', x, y, 40, f.boss.mhp * 0.015)); f.mech.busy = { k: 'altars', t: 0, cd: 1.5 }; },
      step(f, b, dt, s) {
        s.cd -= dt;
        if (s.cd <= 0) { s.cd = 2.4; this.addHazards(this.allTargets().map((o) => ({ k: 'circle', x: o.x, y: o.y, r: 75, delay: 1.1 * this.pace(), dmg: b.hit * 0.2, fx: 'bolt' }))); }
        if (s.t >= 30) { this.dropObjs('altar'); f.mech.busy = null; this.announce(this.L('e_altarRage', null, '제단 폭주')); this.addHazards([{ k: 'all', raid: 1, x: 0, y: 0, delay: 0.5, dmg: b.hit * 0.6 }]); }
      },
    },
    // 장각: 분신 2체와 자리를 바꾼다. 그림자가 있는 진짜만 피해를 받는다.
    clones: {
      start(f, b) {
        b.x = CX; b.y = CY;
        ring(2, 330, 260, this.rand() * 6).forEach(([x, y]) => this.addObj('clone', x, y, 60, 0));
        f.mech.busy = { k: 'clones', t: 0, sw: 4, still: true };
      },
      step(f, b, dt, s) {
        s.sw -= dt;
        if (s.sw <= 0) {
          s.sw = 5;
          const cl = f.mech.objs.filter((o) => o.k === 'clone'), pos = [[b.x, b.y]].concat(cl.map((o) => [o.x, o.y]));
          for (let i = pos.length - 1; i > 0; i--) { const j = (this.rand() * (i + 1)) | 0; [pos[i], pos[j]] = [pos[j], pos[i]]; }
          [b.x, b.y] = pos[0]; cl.forEach((o, i) => { [o.x, o.y] = pos[i + 1]; });
          this.fxBurst(b.x, b.y, f.def.fx, 90);
        }
        if (s.t >= 18) { this.dropObjs('clone'); f.mech.busy = null; }
      },
    },
    // 화웅: 사수관 낙석이 한 줄씩 차례로 떨어진다(두 번, 방향 반대)
    domino: {
      start(f, b) {
        const n = 8, w = AW / n, dir = this.rand() < 0.5 ? 1 : -1, pace = this.pace(), list = [];
        for (let wave = 0; wave < 2; wave++) for (let i = 0; i < n; i++) {
          const col = (dir * (wave ? -1 : 1)) > 0 ? i : n - 1 - i;
          list.push({ k: 'rect', raid: 1, x: ARENA.x0 + col * w, y: ARENA.y0, rw: w, rh: AH, delay: (2 + i * 0.85 + wave * 9) * pace, dmg: b.hit * 0.5 });
        }
        this.addHazards(list);
      },
    },
    // 동탁·여포·사마의: 무력화 시전. 실패하면 안전지대 밖(또는 전원) 쓰러짐.
    crush: {
      start(f, b, p) {
        b.x = CX; b.y = CY;
        const spots = ring(2, 420, 300, this.rand() * 6).map(([x, y]) => [x | 0, y | 0, 120]);
        this.startCast(p.n, 9, 'safe', { spots });
      },
    },
    awaken: {
      start(f, b, p) {
        this.startCast(p.n, 8, 'kill', { after() { f.mech.enr = true; b.speed *= 1.3; } });
      },
    },
    // 사마의 천하통일·제갈량 칠성등 기도: 중앙에서 무력화, 실패하면 전멸
    unify: {
      start(f, b, p) { b.x = CX; b.y = CY; this.startCast(p.n, 9, 'kill'); },
    },
    // 원소: 궁루 2기. 부수기 전까지 화살 일제사.
    towers: {
      start(f, b) {
        [[ARENA.x1 - 160, ARENA.y0 + 150], [ARENA.x1 - 160, ARENA.y1 - 150]].forEach(([x, y]) => this.addObj('tower', x, y, 46, b.mhp * 0.03));
      },
    },
    // 조조: 화용도. 좁은 길만 안전하고 동남풍이 길 밖으로 민다.
    huarong: {
      start(f, b) {
        const h = 190, y0 = ARENA.y0 + 140 + this.rand() * (AH - 280 - h), pace = this.pace(), vy = (this.rand() < 0.5 ? -1 : 1) * 110;
        this.addHazards([
          { k: 'band', raid: 1, x: 0, y: 0, y0, y1: y0 + h, delay: 3.6 * pace, dmg: b.hit * 1.2 },
          { k: 'wind', raid: 1, x: 0, y: 0, vx: 0, vy, delay: 0.8, dur: 4.4 * pace },
        ]);
      },
    },
    // 육손·사마의: 석병팔진. 돌기둥 뒤에 숨어야 사방 화공을 피한다(세 번, 보스가 자리를 옮긴다).
    pillars: {
      start(f) {
        ring(4, 260, 190, Math.PI / 4).forEach(([x, y]) => this.addObj('pillar', x, y, 48, 0));
        f.mech.busy = { k: 'pillars', t: 0, n: 3, cd: 1, still: true };
      },
      step(f, b, dt, s) {
        s.cd -= dt;
        if (s.cd > 0) return;
        if (s.n <= 0) { this.dropObjs('pillar'); f.mech.busy = null; return; }
        s.n--; s.cd = 5.2;
        const a = this.rand() * Math.PI * 2;
        b.x = clamp(CX + Math.cos(a) * 560, ARENA.x0 + 60, ARENA.x1 - 60); b.y = clamp(CY + Math.sin(a) * 340, ARENA.y0 + 60, ARENA.y1 - 60);
        this.fxBurst(b.x, b.y, f.def.fx, 90);
        this.addHazards([{ k: 'los', raid: 1, x: b.x | 0, y: b.y | 0, delay: 3.8 * this.pace(), dmg: b.hit * 0.95 }]);
      },
    },
    // 등애: 가장자리가 절벽이 되고 주기적으로 충격파가 밀어낸다
    cliff: {
      start(f, b) {
        const e = 80, d = 1.5, dur = 40, tick = b.hit * 0.6;
        this.addHazards([
          { k: 'rect', raid: 1, x: ARENA.x0, y: ARENA.y0, rw: AW, rh: e, delay: d, dur, tick, dmg: 0 },
          { k: 'rect', raid: 1, x: ARENA.x0, y: ARENA.y1 - e, rw: AW, rh: e, delay: d, dur, tick, dmg: 0 },
          { k: 'rect', raid: 1, x: ARENA.x0, y: ARENA.y0, rw: e, rh: AH, delay: d, dur, tick, dmg: 0 },
          { k: 'rect', raid: 1, x: ARENA.x1 - e, y: ARENA.y0, rw: e, rh: AH, delay: d, dur, tick, dmg: 0 },
        ]);
        f.mech.busy = { k: 'cliff', t: 0, cd: 4 };
      },
      step(f, b, dt, s) {
        s.cd -= dt;
        if (s.cd <= 0) { s.cd = 7; this.addHazards([{ k: 'push', raid: 1, x: b.x | 0, y: b.y | 0, r: 420, pw: 300, delay: 1.3 * this.pace(), dmg: 0, fx: 'roar' }]); }
        if (s.t >= 40) f.mech.busy = null;
      },
    },
    // 등애: 담중의 복병 3기가 화살을 쏜다
    ambush: {
      start(f, b) {
        [[ARENA.x0 + 120, CY], [CX, ARENA.y0 + 110], [CX, ARENA.y1 - 110]].forEach(([x, y]) => this.addObj('amb', x, y, 36, b.mhp * 0.012));
      },
    },
  };

  // ---- 고유 패턴 ----
  const G = P.patternGen;
  const baseCharge = G.charge;
  // 반격 창이 있는 돌진: 푸른빛을 내는 동안 정면에서 충분한 피해를 넣으면 끊긴다
  G.charge = function (f, b, t, p, pace, all) {
    if (p.ctr && !p.now) {
      const M = f.mech;
      M.ctr = 3; M.ctrGot = 0; M.ctrNeed = 4 + 2 * this.party; M.face = Math.atan2(t.y - b.y, t.x - b.x); M.ctrGo = { gen: 'charge', t, p, v: f.vis };
      return;
    }
    baseCharge.call(this, f, b, t, p, pace, all);
  };
  Object.assign(G, {
    // 여포: 표적을 바꿔 가며 세 번 돌진
    chain(f, b, t, p, pace, all) {
      baseCharge.call(this, f, b, t, p, pace, all);
      for (let i = 1; i < (p.times || 3); i++) f.mech.q.push({ t: 1.9 * i, gen: 'charge', p: { w: p.w }, v: f.vis });
    },
    // 여포: 횡소 → 돌진 → 난무
    combo(f, b, t, p, pace, all) {
      G.sweep.call(this, f, b, t, { n: 3, arc: 1.4 }, pace, all);
      f.mech.q.push({ t: 1.4, gen: 'charge', p: { w: 130 }, v: 'redhare' }, { t: 2.8, gen: 'cross', p: { n: 6 }, v: 'halberd' });
    },
    // 조조: 연환선 갑판 구획 중 몇 칸에 불이 붙고 잠시 탄다
    deck(f, b, t, p, pace) {
      const cells = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) cells.push([i, j]);
      const k = 2 + (this.diff.level >= 2 ? 1 : 0), list = [];
      for (let n = 0; n < k; n++) {
        const [i, j] = cells.splice((this.rand() * cells.length) | 0, 1)[0];
        list.push({ k: 'rect', raid: 1, x: ARENA.x0 + (i * AW) / 3, y: ARENA.y0 + (j * AH) / 2, rw: AW / 3, rh: AH / 2, delay: 1.8 * pace, dur: 3.5, tick: b.hit * 0.35, dmg: b.hit * 0.3 });
      }
      this.addHazards(list);
    },
    // 육손: 불이 줄 단위로 번지며 잠시 남는다
    spread(f, b, t, p, pace) {
      const n = p.bands || 5, hh = AH / n, down = this.rand() < 0.5, list = [];
      for (let i = 0; i < n; i++) {
        const row = down ? i : n - 1 - i;
        list.push({ k: 'rect', raid: 1, x: ARENA.x0, y: ARENA.y0 + row * hh, rw: AW, rh: hh, delay: (1.6 + i * 1.5) * pace, dur: 0.9, tick: b.hit * 0.25, dmg: b.hit * 0.3 });
      }
      this.addHazards(list);
    },
    // 동탁: 낙양 방화. 떨어진 자리에 불길이 남아 싸울 땅이 줄어든다.
    fire(f, b, t, p, pace, all) {
      const list = [];
      for (let i = 0; i < p.n; i++) {
        const o = all[i % all.length], s = i < all.length ? 0 : 260;
        list.push({ k: 'circle', raid: 1, x: clamp(o.x + (this.rand() - 0.5) * s * 2, ARENA.x0, ARENA.x1), y: clamp(o.y + (this.rand() - 0.5) * s * 2, ARENA.y0, ARENA.y1), r: p.r, delay: (1 + i * 0.12) * pace, dur: 16, tick: b.hit * 0.16, dmg: b.hit * 0.3 });
      }
      this.addHazards(list);
    },
    // 제갈량·사마의: 팔진도. 보스 머리 위 문양과 같은 문만 안전.
    gates(f, b, t, p, pace) {
      const M = f.mech, syms = [0, 1, 2, 3, 4, 5, 6, 7];
      for (let i = 7; i > 0; i--) { const j = (this.rand() * (i + 1)) | 0; [syms[i], syms[j]] = [syms[j], syms[i]]; }
      const delay = 4.6 * pace, pos = ring(8, 470, 330, this.rand());
      M.objs = M.objs.filter((o) => o.k !== 'gate');
      pos.forEach(([x, y], i) => this.addObj('gate', x, y, 95, 0, { s: syms[i], life: delay + 0.4 }));
      M.sym = syms[(this.rand() * 8) | 0];
      const g = pos[syms.indexOf(M.sym)];
      this.addHazards([{ k: 'safe', hide: 1, spots: [[g[0] | 0, g[1] | 0, 95]], x: 0, y: 0, delay, dmg: b.hit * 1.1 }]);
    },
    // 등애: 땅을 파고 숨어 표적 발밑을 쫓다가 튀어나온다(세 번)
    burrow(f, b, t, p, pace, all) {
      const M = f.mech;
      if (M.busy) return G.rain.call(this, f, b, t, { n: 8, r: 110 }, pace, all);
      M.hide = true;
      M.busy = { k: 'burrow', t: 0, n: 2, st: 'follow', tgt: t };
      M.bur = { x: t.x, y: t.y, lock: false };
    },
    // 사마의: 낭고의 시선. 보스 쪽으로 걸어가면 피해.
    gaze(f, b, t, p, pace) { this.addHazards([{ k: 'gaze', raid: 1, x: 0, y: 0, delay: 1.2 * pace, dur: 3.5, tick: b.hit * 0.5, dmg: 0 }]); },
  });
  P.mechs.burrow = {
    start() {},
    step(f, b, dt, s) {
      const M = f.mech;
      if (s.st === 'follow') {
        const t = this.allTargets().includes(s.tgt) ? s.tgt : this.nearestTo(M.bur.x, M.bur.y);
        if (t) { M.bur.x = t.x; M.bur.y = t.y; }
        if (s.t >= 2) { s.st = 'lock'; s.t = 0; M.bur.lock = true; this.addHazards([{ k: 'circle', x: M.bur.x | 0, y: M.bur.y | 0, r: 150, delay: 0.9, dmg: b.hit * 0.5, fx: 'quake' }]); }
      } else if (s.st === 'lock' && s.t >= 0.9) {
        s.st = 'up'; s.t = 0; M.hide = false; b.x = M.bur.x; b.y = M.bur.y; this.log('shake', { v: 0.8 });
      } else if (s.st === 'up' && s.t >= 2) {
        if (--s.n <= 0) { M.busy = null; M.bur = null; return; }
        M.hide = true; s.st = 'follow'; s.t = 0; M.bur.lock = false;
        const all = this.allTargets(); s.tgt = all[(this.rand() * all.length) | 0];
      }
    },
  };

  // ---- 동기화 ----
  P.raidWire = function () {
    const M = this.fight.mech;
    return {
      g: r1(M.gr), v: M.vuln, c: r1(M.ctr), cp: M.ctr > 0 ? r2((M.ctrGot || 0) / (M.ctrNeed || 1)) : 0, a: M.ampT > 0 ? [r2(M.amp), r1(M.ampT)] : null, f: r2(M.face), h: M.hide ? 1 : 0, y: M.sym, cm: M.charmT > 0 ? [0, r1(M.charmT)] : null,
      s: M.cast ? { n: M.cast.n, t: r1(M.cast.t), d: M.cast.dur, p: r2(M.cast.got / M.cast.need), sp: M.cast.spots || null } : null,
      o: M.objs.map((o) => [o.id, o.k, o.x | 0, o.y | 0, o.r, Math.round(o.hp), Math.round(o.mhp), o.s == null ? -1 : o.s, o.lit ? 1 : 0, o.done ? 1 : 0, r2(o.p || 0)]),
      b: M.bur ? [M.bur.x | 0, M.bur.y | 0, M.bur.lock ? 1 : 0] : null,
    };
  };
  P.raidApply = function (m) {
    const M = this.fight.mech;
    if (!m) return;
    M.gr = m.g; M.vuln = m.v; M.ctr = m.c; M.face = m.f; M.hide = !!m.h; M.sym = m.y;
    const was = M.charmT > 0;
    M.charmCd = m.cm ? m.cm[0] : 0; M.charmT = m.cm ? m.cm[1] : 0;
    if (M.charmT > 0 && !was) this.charmClear();
    M.ctrGot = m.cp || 0; M.ctrNeed = 1;
    if (m.a) { M.amp = m.a[0]; M.ampT = m.a[1]; } else M.ampT = 0;
    M.cast = m.s ? { n: m.s.n, t: m.s.t, dur: m.s.d, need: 1, got: m.s.p, spots: m.s.sp } : null;
    const old = {}; M.objs.forEach((o) => (old[o.id] = o));
    M.objs = m.o.map(([id, k, x, y, r, hp, mhp, s, lit, done, p]) => Object.assign(old[id] || {}, { id, k, x, y, r, hp, mhp, s, lit: !!lit, done: !!done, p }));
    M.bur = m.b ? { x: m.b[0], y: m.b[1], lock: !!m.b[2] } : null;
  };

  if (typeof module !== 'undefined') module.exports = {};
})(typeof window !== 'undefined' ? window : globalThis);
