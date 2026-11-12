// 협동 네트워크. 전송 계층만 갈아 끼우면 된다: Claude room, 협동 서버(WebSocket), 같은 브라우저 탭(BroadcastChannel).
// 라인은 각자 클라이언트가 돌리지만, 시계(라운드·남은 시간·단계·배속)와 보스는 방장이 결정하고 모두 그 값에 맞춘다.
// 반응이 없는 사람이 생기면 모두 멈추고, 오래 끊기면 방에서 제외한다.
(function (root) {
  const TOPICS = ['phase', 'hz', 'pattern', 'bs', 'dmg', 'wiped', 'start', 'pop', 'clk', 'sup', 'vol', 'chat', 'chatno'];
  const STALL_MS = 4000, DROP_MS = 60000; // 반응 없는 사람은 60초 뒤 제외(앱을 내려도 그동안은 자리를 지킨다)

  async function roomTransport(code) {
    if (!root.claude || !root.claude.use) return null;
    const lobby = await root.claude.use('room');
    if (!lobby) return null;
    const r = await lobby.join('rtd-' + code);
    return {
      kind: 'room',
      on: (t, fn) => r.on(t, (m) => fn(m.data, m.peer, m.sameTab)),
      send: (t, d) => r.emit(t, d).catch(() => {}),
      presence: (p) => r.presence(p).catch(() => {}),
      peers: () => r.peers().map((p) => ({ id: p.peer, me: p.sameTab, state: p.presence, seen: p.updatedAt })),
      onPeers: (fn) => r.onPeers(() => fn()),
      leave: () => r.leave(),
    };
  }

  // 협동 서버(server/server.js) 연결. 서버 주소에서 열었을 때 쓰인다.
  function wsTransport(code, token) {
    return new Promise((resolve) => {
      const base = root.RTD_SERVER || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
      const url = `${base}/ws?room=${encodeURIComponent(code)}${token ? '&t=' + encodeURIComponent(token) : ''}`;
      let ws;
      try { ws = new WebSocket(url); } catch (e) { resolve(null); return; }
      const handlers = {}, peers = {}, watch = [], fire = () => watch.forEach((f) => f());
      let id = null, mine = {}, pending = null, timer = null, done = false, left = false, retryT = null, lostAt = 0;
      const out = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
      const flush = () => { timer = null; if (pending) { out({ k: 'pres', p: pending }); pending = null; } };
      const giveUp = setTimeout(() => { ws.close(); resolve(null); }, 4000);
      // 앱을 내렸다 돌아오는 등으로 끊기면 같은 방에 다시 붙는다(서버가 60초 동안 자리를 지킨다)
      const reconnect = () => {
        if (left || retryT) return;
        if (!lostAt) lostAt = Date.now();
        if (Date.now() - lostAt > 65000) return;
        retryT = setTimeout(() => {
          retryT = null;
          try { const w = new WebSocket(url); w.onmessage = ws.onmessage; w.onclose = ws.onclose; w.onerror = () => {}; ws = w; } catch (e) { reconnect(); }
        }, 1500);
      };
      ws.onerror = () => { if (!done) { clearTimeout(giveUp); resolve(null); } };
      ws.onclose = () => { if (done) { fire(); reconnect(); } };
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.k === 'error') { if (!done) { clearTimeout(giveUp); resolve(m.code === 'full' ? 'full' : m.code === 'auth' ? 'auth' : null); } }
        else if (m.k === 'hello') {
          clearTimeout(giveUp); id = m.id; lostAt = 0;
          Object.keys(peers).forEach((k) => delete peers[k]);
          Object.keys(m.peers).forEach((k) => (peers[k] = { state: m.peers[k], seen: Date.now() }));
          if (m.mine) mine = Object.assign(mine, m.mine);
          // 다시 붙었으면 내 상태를 서버에 다시 알린다
          if (done) { out({ k: 'pres', p: mine }); fire(); return; }
          done = true;
          resolve({
            kind: 'ws',
            on: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
            send: (t, d) => { out({ k: 'msg', t, d }); (handlers[t] || []).forEach((f) => f(d, id, true)); },
            // 위치처럼 자주 바뀌는 값은 초당 20번으로 묶어 보낸다
            presence: (p) => { mine = Object.assign(mine, p); pending = Object.assign(pending || {}, p); if (!timer) timer = setTimeout(flush, 50); fire(); },
            peers: () => [{ id, me: true, state: mine, seen: Date.now() }].concat(Object.keys(peers).map((k) => ({ id: k, me: false, state: peers[k].state, seen: peers[k].seen }))),
            onPeers: (fn) => watch.push(fn),
            leave: () => { left = true; ws.close(); },
            closed: () => ws.readyState > 1,
            online: () => ws.readyState === 1,
          });
        } else if (m.k === 'pres') { const p = peers[m.id] || { state: {} }; Object.assign(p.state, m.p); p.seen = Date.now(); peers[m.id] = p; fire(); }
        else if (m.k === 'left') { delete peers[m.id]; fire(); }
        else if (m.k === 'msg') { if (peers[m.from]) peers[m.from].seen = Date.now(); (handlers[m.t] || []).forEach((f) => f(m.d, m.from, false)); }
      };
    });
  }

  function localTransport(code) {
    const id = Math.random().toString(36).slice(2, 10), bc = new BroadcastChannel('rtd-' + code);
    const handlers = {}, peers = {}, watch = [];
    let mine = {};
    const fire = () => watch.forEach((f) => f());
    bc.onmessage = (ev) => {
      const m = ev.data;
      if (m.pres) {
        const known = !!peers[m.from];
        peers[m.from] = { state: m.pres, at: Date.now() };
        if (!known) bc.postMessage({ from: id, pres: mine });
        fire();
      } else if (m.bye) { delete peers[m.from]; fire(); }
      else { if (peers[m.from]) peers[m.from].at = Date.now(); (handlers[m.t] || []).forEach((f) => f(m.d, m.from, false)); }
    };
    root.addEventListener && root.addEventListener('beforeunload', () => bc.postMessage({ from: id, bye: 1 }));
    return {
      kind: 'local',
      on: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
      send: (t, d) => { bc.postMessage({ from: id, t, d }); (handlers[t] || []).forEach((f) => f(d, id, true)); },
      presence: (p) => { mine = Object.assign(mine, p); bc.postMessage({ from: id, pres: mine }); fire(); },
      peers: () => [{ id, me: true, state: mine, seen: Date.now() }].concat(Object.keys(peers).map((k) => ({ id: k, me: false, state: peers[k].state, seen: peers[k].at }))),
      onPeers: (fn) => watch.push(fn),
      leave: () => { bc.postMessage({ from: id, bye: 1 }); bc.close(); },
    };
  }

  // AI 동맹용: 한 화면 안의 여러 사령관(나 + AI)을 잇는 가상 방. 메시지는 쌓아 두었다가 flush 때 한꺼번에 전한다.
  function makeHub() {
    const members = [], q = [];
    return {
      flush() {
        while (q.length) {
          const [t, d, from] = q.shift();
          members.forEach((m) => (m.handlers[t] || []).forEach((f) => f(d, from, m.id === from)));
        }
      },
      join() {
        const m = { id: 'h' + members.length, state: {}, handlers: {} };
        members.push(m);
        return {
          kind: 'hub',
          on: (t, fn) => { (m.handlers[t] = m.handlers[t] || []).push(fn); },
          send: (t, d) => q.push([t, d, m.id]),
          presence: (p) => { Object.assign(m.state, p); },
          peers: () => members.map((o) => ({ id: o.id, me: o === m, state: o.state, seen: Date.now() })),
          onPeers: () => {},
          leave: () => {},
        };
      },
    };
  }

  const round1 = (v) => Math.round(v * 10) / 10;
  const packHazard = (h) => {
    const o = { k: h.k, delay: round1(h.delay), dmg: Math.round(h.dmg), x: Math.round(h.x), y: Math.round(h.y) };
    ['a', 'len', 'w', 'r', 'arc', 'r0', 'r1', 'v', 'rw', 'rh', 'y0', 'y1', 'dur', 'tick', 'need', 'vx', 'vy', 'pw', 'kill', 'frac', 'raid', 'hide'].forEach((f) => { if (h[f] != null) o[f] = Math.round(h[f] * 100) / 100; });
    if (h.spots) o.spots = h.spots.map((s) => s.map(Math.round));
    if (typeof h.fx === 'string') o.fx = h.fx.slice(0, 12); // 연출 이름
    return o;
  };

  class Net {
    constructor(transport, name) {
      this.t = transport; this.name = name; this.game = null; this.started = false;
      this.onLobby = null; this.onStart = null; this.pickSent = false; this.diff = 'easy';
      this.presT = 0; this.laneT = 0; this.clkT = 0; this.hb = 0;
      this.speedWant = 1; this.dropped = new Set(); this.kicked = false; this.lnSeq = 0; this.watching = null;
      // 방장이 알려 준 시계. pz는 멈춘 이유(기다리는 사람 이름), sp는 적용 배속
      this.clock = { sp: 1, pz: null, last: Date.now() };
      this.t.presence({ name, ready: true, picked: 0, sp: 1, hb: 0 });
      this.t.onPeers(() => this.onLobby && this.onLobby());
      this.t.on('start', (d) => { if (!this.started) { this.started = true; this.diff = d.diff; this.clock.last = Date.now(); this.onStart && this.onStart(d); } });
      this.t.on('phase', (d, peer, self) => { if (!self && this.game) this.applyPhase(d); });
      this.t.on('clk', (d, peer, self) => { if (!self) this.syncClock(d); });
      this.t.on('hz', (d, peer, self) => {
        const g = this.game;
        if (self || !g || !g.fight) return;
        d.forEach((h) => g.fight.hazards.push(Object.assign({ c: g.fight.def.fx, t: 0 }, h)));
      });
      // 일기토 출전 신청: 신청한 사람의 외침을 모두에게 띄운다(외침은 번호로 보내 각자 언어로 보여 준다)
      this.t.on('vol', (d) => { if (this.game && d && d.r === this.game.round) { const L = root.RTD_I18N; const line = L ? L.t('volLine' + ((d.i | 0) % 3)) : ''; this.game.log('toast', { text: `${String(d.n).slice(0, 12)}: "${line}"`, tone: 'good' }); } });
      // 방 채팅: 서버가 거른 글만 보인다(내가 보낸 글도 서버를 거쳐 돌아온 것을 쓴다)
      this.t.on('chat', (d, peer, self) => { if (!self && d && this.onChat) this.onChat(d, peer); });
      this.t.on('chatno', (d) => { if (d && this.onChatNo) this.onChatNo(d); }); // 내 채팅이 막혔을 때(도배·광고) 서버가 나에게만 보낸다
      this.t.on('pattern', (d, peer, self) => { if (!self && this.game) { this.game.log('pattern', { name: d.n }); this.game.log('sfx', { s: 'warn' }); } });
      this.t.on('pop', (d, peer, self) => {
        const g = this.game;
        if (!self && g && g.defs[d.id]) g.log('pop', { def: g.defs[d.id], who: d.name, remote: true });
      });
      this.t.on('bs', (d, peer, self) => {
        const g = this.game;
        if (self || !g || !g.fight) return;
        const b = g.fight.boss;
        b.x = d.x; b.y = d.y; b.hp = Math.min(b.hp, d.hp); g.fight.t = d.t;
        g.raidApply(d.m);
      });
      this.t.on('dmg', (d, peer, self) => {
        const g = this.game;
        if (self || !g || !g.fight || !this.isHost()) return;
        g.remoteDamage(d);
      });
      // 다른 사령관의 힐러·버퍼가 보낸 치료와 호령
      this.t.on('sup', (d, peer, self) => { if (!self && this.game && d && typeof d.v === 'number') this.game.applySupport(d); });
      this.t.on('wiped', (d, peer) => {
        const g = this.game;
        if (!g || !g.fight || !this.isHost()) return;
        // 쓰러진 사람 목록은 보스전(라운드)마다 따로 센다. 앞 보스전에서 쓰러진 사람이 남아 있으면 다음 보스전이 잘못 전멸 처리된다
        if (d && d.r != null && d.r !== g.round) return;
        if (!this.wiped || this.wiped.r !== g.round) this.wiped = { r: g.round, who: {} };
        this.wiped.who[peer] = true;
        if (Object.keys(this.wiped.who).length >= this.partySize()) { this.wiped = null; g.endFight(false); }
      });
    }
    me() { return this.t.peers().find((p) => p.me); }
    roster() { return this.t.peers().filter((p) => p.state && p.state.name && !this.dropped.has(p.id) && (p.me || !p.state.away)).sort((a, b) => (a.id < b.id ? -1 : 1)); }
    // 자리 비운 사람(앱을 내림): 60초 안에 돌아오면 다시 명단에 들어간다
    awayList() { return this.t.peers().filter((p) => !p.me && p.state && p.state.away && !this.dropped.has(p.id)); }
    partySize() { return Math.min(5, this.roster().length); }
    isHost() { const r = this.roster(); return !r.length || r[0].me; }
    send(topic, data) { this.t.send(topic, data); }
    // 시작 신호: 난이도, 씨앗, 악몽 +N 규칙(모두 같은 규칙으로 돈다)
    start(diff, extra) { this.t.send('start', Object.assign({ diff, seed: (Math.random() * 1e9) | 0 }, extra || {})); }
    leave() { this.t.leave(); }
    // 판이 시작된 시각. 대기실에서는 상태 알림을 주고받지 않으므로, 그 전의 마지막 알림 시각으로 끊김을 판단하면
    // 대기실에 오래 있던 사람이 시작하자마자 '멈춤·제외'로 튕긴다. 판 시작 전 시각은 시작 시각으로 본다.
    attach(game) { this.game = game; this.startAt = Date.now(); this.clock.last = this.startAt; }
    seenAt(p, now) { return Math.max(p.seen || now, this.startAt || 0); }
    applyPhase(d) {
      const g = this.game;
      if (d.p === 'round') { if (d.r > g.round) { if (g.endedRound !== g.round) g.endRound(); g.applyRound(d.r); } }
      else if (d.p === 'pick') g.applyPick();
      else if (d.p === 'fight') g.beginFight(Array.isArray(d.dep) ? d.dep : null);
      else if (d.p === 'bossEnd') g.applyBossEnd(d.win, d.remain);
      else if (d.p === 'over') g.finish(d.win);
    }
    // 방장의 시계에 맞춘다. 놓친 신호가 있어도 여기서 따라잡는다.
    syncClock(d) {
      const g = this.game;
      this.clock = { sp: d.sp || 1, pz: d.pz || null, last: Date.now() };
      (d.dr || []).forEach((id) => this.dropped.add(id));
      const me = this.me();
      if (me && this.dropped.has(me.id)) this.kicked = true;
      if (!g || g.over || this.kicked) return;
      if (d.r > g.round) {
        if (g.fight && g.phase !== 'wave') g.applyBossEnd(true, 0);
        if (d.r > g.round) { if (g.endedRound !== g.round) g.endRound(); g.applyRound(d.r); }
      }
      if (d.r !== g.round) return;
      if (g.phase === 'wave' && d.ph === 'wave' && Math.abs(g.roundT - d.t) > 0.3) g.roundT = d.t;
      if (g.fight && d.ph === 'bossPick' && g.phase === 'bossIntro') g.applyPick();
      if (g.fight && d.ph === 'boss' && g.phase !== 'boss') g.beginFight();
    }
    setWatch(id) { if (this.watching !== id) { this.watching = id; this.t.presence({ watch: id }); } }
    announcePick(ids) {
      this.pickSent = true;
      this.t.presence({ picked: this.game.round, deployed: ids, dmg: 0 });
      this.myDeployed = ids;
    }
    // 모두 출전한 뒤(결투 시작 때) 이번 라운드에 고른 출전 목록을 모은다. 내 것은 직접 넣어 두 번 세지 않는다.
    partyDeployed() {
      const r = this.game.round;
      return this.roster().filter((p) => !p.me && p.state.picked === r).flatMap((p) => p.state.deployed || []).concat(this.myDeployed || []);
    }
    // 일기토: 명단 순서대로, 앞 사람들이 모두 '다 쓰러짐'을 알렸으면 내 차례
    // 일기토 출전 신청(대장전): 출전 고르는 동안 "출전 신청"을 누른 사람 중 한 명이 먼저 나간다.
    // 여러 명이면 라운드와 신청자로 정해지는 같은 무작위 값으로 모두가 같은 사람을 고른다. 나머지는 명단 순서.
    volunteer() {
      const r = this.game.round;
      if (this.me() && this.me().state.vol === r) return;
      this.t.presence({ vol: r });
      this.send('vol', { r, n: this.name, i: (Math.random() * 3) | 0 });
    }
    volunteers() { const r = this.game.round; return this.roster().filter((p) => p.state.vol === r); }
    relayOrder() {
      const g = this.game, r = g.round;
      if (this.relayOrd && this.relayOrd.r === r) return this.relayOrd.list;
      const ros = this.roster(), vols = this.volunteers();
      let list = ros;
      if (vols.length) {
        let h = r * 31; vols.map((p) => p.id).sort().join('|').split('').forEach((ch) => (h = (h * 33 + ch.charCodeAt(0)) >>> 0));
        const first = vols[h % vols.length];
        list = [first].concat(ros.filter((p) => p.id !== first.id));
      }
      // 결투가 시작되면 순서를 굳힌다(늦게 온 신청은 반영하지 않는다)
      if (g.phase === 'boss') {
        this.relayOrd = { r, list };
        if (vols.length) { const L = root.RTD_I18N; g.log('toast', { text: L ? L.t('vanguard', { a: list[0].state.name }) : list[0].state.name, tone: 'good' }); }
      }
      return list;
    }
    // 일기토: 정해진 순서대로, 앞 사람들이 모두 '다 쓰러짐'을 알렸으면 내 차례
    relayMine() { const r = this.game.round; for (const p of this.relayOrder()) { if (p.me) return true; if (p.state.rd !== r) return false; } return true; }
    chat(text) { this.send('chat', { x: String(text).slice(0, 80) }); }
    relayDone() { this.t.presence({ rd: this.game.round }); }
    allPicked() { const r = this.game.round; return this.roster().every((p) => p.me ? this.game.fight.picked : p.state.picked === r); }
    startFight() {
      const g = this.game;
      if (g.phase === 'boss') return;
      // 방장이 마지막에 출전하면 출전 목록(presence)이 늦게 가므로, 방장이 본 목록을 신호에 실어 보낸다
      const dep = this.partyDeployed();
      this.send('phase', { p: 'fight', dep });
      g.beginFight(dep);
    }
    sendHazards(list) {
      // 메시지 한도 4KiB를 넘지 않게 묶음을 나눈다
      const packed = list.map(packHazard);
      for (let i = 0; i < packed.length; i += 18) this.send('hz', packed.slice(i, i + 18));
    }
    tickFight(dt, g) {
      const f = g.fight;
      // 2초 뒤 한 번 더 판정: 그사이 도착한 출전 목록까지 반영
      if (!f.achRe && f.t > 2) { f.achRe = true; g.checkPartyAchievements(this.partyDeployed()); }
      f.flushT -= dt; f.syncT -= dt;
      if (f.flushT <= 0) {
        f.flushT = 0.25;
        const po = Object.keys(f.pendObj).length ? f.pendObj : null;
        // ctr: 정면 피해(반격 게이지), sg: 디버퍼가 무력화 게이지에 더 넣는 양, amp: 보스 약화
        if ((f.pending > 0 || po || f.pendCtr || f.pendAmp || f.pendCharm || f.pendAd || f.pendGap) && !this.isHost()) this.send('dmg', { ad: f.pendAd || null, gp: f.pendGap || 0, v: Math.round(f.pending), stun: f.pendStun || 0, o: po, ctr: Math.round(f.pendCtr || 0), sg: Math.round(f.pendSg || 0), amp: f.pendAmp || null, cm: f.pendCharm || null });
        f.pending = 0; f.pendStun = 0; f.pendObj = {}; f.pendCtr = 0; f.pendSg = 0; f.pendAmp = null; f.pendCharm = null; f.pendAd = null; f.pendGap = 0;
      }
      if (this.isHost() && f.syncT <= 0) {
        f.syncT = 0.2;
        const b = f.boss;
        this.send('bs', { x: Math.round(b.x), y: Math.round(b.y), hp: Math.round(b.hp), t: round1(f.t), m: g.raidWire() });
      }
      const c = g.firstLocal();
      this.t.presence({ cx: c ? Math.round(c.x) : null, cy: c ? Math.round(c.y) : null, ch: c ? c.def.id : null, hpf: c ? round1(c.hp / c.mhp) : 0, dmg: Math.round(f.total) });
      f.ghosts = {};
      this.roster().forEach((p) => {
        if (!p.me && p.state.ch && p.state.cx != null) f.ghosts[p.id] = { x: p.state.cx, y: p.state.cy, alive: true, ghost: true, def: g.defs[p.state.ch], hpf: p.state.hpf, name: p.state.name };
      });
    }
    // 다른 사람이 F키로 내 전장을 볼 수 있게 라인 상태를 짧게 묶어 보낸다
    // 묶음마다 번호(s)와 개체 id를 붙여 받는 쪽이 이전 묶음과 이어 부드럽게 움직이게 한다
    laneSnapshot(g) {
      const T = g.T;
      return {
        s: ++this.lnSeq,
        u: g.units.filter((x) => x.owner === 0).slice(0, 60).map((x) => [x.id, T.units.indexOf(x.def), x.x | 0, x.y | 0, Math.round((x.face == null ? 1.57 : x.face) * 10), x.moveT > 0 ? 1 : 0, x.atkT > 0 ? 1 : 0, Math.round(g.unitAtk(x))]),
        e: g.enemies.slice(0, 60).map((x) => [x.id, x.mid ? 100 + T.midbosses.indexOf(x.midDef) : T.waves.indexOf(x.w), x.x | 0, x.y | 0, Math.round((x.hp / x.mhp) * 20), x.seg]),
        g: g.me.gold, l: g.lives, n: g.enemyCount(),
      };
    }
    // 매 틱 호출: 내 상태 알림, 끊긴 사람 감시, 방장이면 시계 방송
    tickStatus(dt, g) {
      const now = Date.now();
      this.presT -= dt; this.laneT -= dt; this.clkT -= dt;
      if (this.presT <= 0) {
        this.presT = 1;
        const top = g.units.filter((u) => u.owner === 0).sort((a, b) => b.def.tier - a.def.tier)[0];
        this.t.presence({ hb: ++this.hb, sp: this.speedWant, round: g.round, units: g.units.length, enemies: g.enemyCount(), top: top ? top.def.id : null });
      }
      // 누가 내 전장을 보고 있을 때만 자주 보낸다(서버 연결은 초당 10번)
      const me = this.me(), watched = me && this.roster().some((p) => !p.me && p.state.watch === me.id);
      const gap = watched ? (this.t.kind === 'room' ? 0.25 : 0.1) : 1;
      if (this.laneT > gap) this.laneT = gap;
      if (this.laneT <= 0 && g.phase === 'wave') { this.laneT = gap; this.t.presence({ ln: this.laneSnapshot(g) }); }
      // 오래 반응이 없는 사람은 모두가 같은 규칙으로 제외한다
      this.roster().forEach((p) => { if (!p.me && now - this.seenAt(p, now) > DROP_MS) this.dropped.add(p.id); });
      if (this.isHost()) {
        if (this.clkT <= 0) {
          this.clkT = 0.5;
          const sp = this.roster().reduce((m, p) => Math.min(m, p.me ? this.speedWant : p.state.sp || 1), 3);
          this.clock = { sp, pz: null, last: now };
          this.send('clk', { r: g.round, t: round1(g.roundT), ph: g.phase, sp, pz: this.clock.pz, dr: [...this.dropped] });
        }
      } else if (now - this.clock.last > STALL_MS) {
        const host = this.roster()[0];
        this.clock.pz = host ? host.state.name : (window.RTD_I18N ? window.RTD_I18N.t('host') : '방장');
      }
    }
  }

  root.RTD_NET = {
    TOPICS,
    // AI 동맹: hub.join(이름)으로 나와 AI 사령관을 같은 가상 방에 넣는다
    hub() {
      const h = makeHub();
      return { flush: h.flush, join: (name) => new Net(h.join(), name) };
    },
    async connect(code, name, opt) {
      let t = null;
      if (opt && opt.token) {
        t = await wsTransport(code, opt.token);
        if (t === 'full' || t === 'auth') return t;
        return t ? new Net(t, name) : null;
      }
      try { t = await roomTransport(code); } catch (e) { t = null; }
      if (!t) t = await wsTransport(code);
      if (t === 'full') return 'full';
      if (!t && root.BroadcastChannel) t = localTransport(code);
      return t ? new Net(t, name) : null;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
