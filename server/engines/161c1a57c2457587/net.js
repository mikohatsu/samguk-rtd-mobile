// 협동 네트워크. 전송 계층만 갈아 끼우면 된다: Claude room, 협동 서버(WebSocket), 같은 브라우저 탭(BroadcastChannel).
// 라인은 각자 클라이언트가 돌리지만, 시계(라운드·남은 시간·단계·배속)와 보스는 방장이 결정하고 모두 그 값에 맞춘다.
// 반응이 없는 사람이 생기면 모두 멈추고, 오래 끊기면 방에서 제외한다.
(function (root) {
  const TOPICS = ['phase', 'hz', 'pattern', 'bs', 'dmg', 'wiped', 'start', 'pop', 'clk', 'sup', 'vol', 'chat', 'chatno', 'go', 'emo', 'startno'];
  // 이모티콘 id(그림 gfx/emo_<id>.png). 서버(server/chat.js EMOS)도 같은 목록만 중계한다
  const EMOS = ['laugh', 'cry', 'angry', 'wow', 'good', 'help', 'thanks', 'think'];
  const STALL_MS = 4000, DROP_MS = 60000; // 반응 없는 사람은 60초 뒤 제외(앱을 내려도 그동안은 자리를 지킨다)
  // 통신 수치 표(코드에 흩지 않는다)
  const NETCFG = {
    interpDelayMs: 100, interpMaxMs: 250, // 팀원 위치를 이만큼 늦게 이어 그린다(도착 간격 × 1.5로 늘어나되 상한)
    extrapMaxMs: 100,  // 다음 위치가 늦으면 마지막 속도로 이만큼만 더 간다
    snapDist: 200,     // 이보다 멀리 뛰면 잇지 않고 바로 옮긴다(돌진·교체 출전)
    bufLen: 8, mergeMs: 20, // 위치 기록 길이, 이 안에 연달아 오면 마지막 것만
    hostGraceMs: 3000, // 방장이 막 바뀐 직후에는 앞 방장의 신호도 받는다
    resumeGapMs: 2000, // 계산이 이만큼 멈췄다 돌아오면(앱을 내렸다 켬) 다른 사람의 소식 시각을 새로 잡는다
    syncMaxMs: 20000,  // 다시 붙은 사람이 방장 자격을 보류하는 최대 시간
    startWaitMs: 10000, // 방장이 서버에 판 시작(씨앗)을 요청하고 답을 기다리는 시간. 넘으면 onStartFail(다시 누를 수 있다. 서버는 15초 안의 같은 요청에 앞 시작을 되돌려 준다)
  };
  // 받는 메시지 검사 수치(SEC-104). 정상 플레이 최댓값(theme-samguk.js 스킬 표·synergy.js)에 여유를 둔 값이다.
  // 시간은 방장 게임 시간(g.time) 기준: 배속·시험(빠른 계산)에서도 정상 신호를 깎지 않는다.
  const GUARD = {
    // 한 사람이 게임 1초에 보낼 수 있는 수와 몰아 보낼 수 있는 수 [초당, 몰아서](정상: dmg 4/초, 나머지 드묾)
    // popHi: 신화·불멸 등장 알림은 받는 화면의 시간을 6~7초 멈추므로(16-hud.js S.freeze) 한 사람당 8초에 한 번만 받는다
    rate: { dmg: [12, 12], sup: [24, 24], pop: [6, 12], popHi: [1 / 8, 1], vol: [4, 4], wiped: [4, 4] },
    dmgPerSec: 1, dmgBurst: 1, // 한 사람의 보스 피해 상한: 보스 최대 체력 × 이 비율 / 초(쌓아 둘 수 있는 양도 같은 비율). 정상 판의 센 손님을 깎지 않게 넉넉히
    stunMax: 3, ampMax: 0.5, adMax: 0.5, effDurMax: 10, gapMax: 6, ctrMax: 40, objMax: 32,
    charmDurMax: 5, charmCdMin: 10, charmCdMax: 60, // 미인계 재사용이 0이면 무한 매혹이 되므로 하한을 둔다(정상 최소 30×0.4=12)
    sup: { heal: 1, healLow: 1, hot: 0.2, rally: 1.5, guard: 0.8, haste: 1, pshield: 0 }, // 지원 종류별 값 상한(정상 최대 0.6·0.6·0.03·0.8·0.3·0.45)
    hzBatch: 40, hzTotal: 400, depMax: 25, drMax: 8,
    logGapMs: 10000, // 같은 종류의 이상 신호 기록은 이 간격에 한 번
  };
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const obj = (d) => !!d && typeof d === 'object' && !Array.isArray(d);
  const clampN = (v, lo, hi) => (fin(v) ? Math.min(hi, Math.max(lo, v)) : lo);
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const pair = (a, vMax, dMax) => (Array.isArray(a) && fin(a[0]) && fin(a[1]) && a[0] > 0 ? [Math.min(vMax, a[0]), clampN(a[1], 0, dMax)] : null);
  const PHASES = { round: 1, pick: 1, fight: 1, bossEnd: 1, over: 1 };
  const nowMs =() => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

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
      let id = null, mine = {}, pending = null, timer = null, done = false, left = false, retryT = null, lostAt = 0, api = null, linked = false;
      // 협동 재연산(2026-11-28 C1): 서버가 판 계산에 쓰이는 중계에 붙이는 방 일련번호(q). 적용하기 바로 앞에서 Net에 알린다(Net이 입력 기록에 ['M'] 으로 남긴다)
      let lastQ = 0, hasQ = false;
      let srvSeed = false; // 서버가 방 판 씨앗을 정한다(hello ss: 1, 2026-11-28). 예전 서버면 false → 방장이 씨앗을 고르는 예전 방식
      const seqd = (q) => { if (typeof q !== 'number') return; lastQ = q; if (api && api.onSeq) api.onSeq(q); };
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
      // 다시 붙은 뒤 옛 연결이 늦게 닫힌 것은 무시한다(새 연결을 끊긴 것으로 잘못 보지 않게)
      ws.onclose = function () { if (this && this !== ws && typeof this.readyState === 'number') return; linked = false; if (done) { fire(); reconnect(); } };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (!m || typeof m !== 'object') return;
        if (m.k === 'error') { if (!done) { clearTimeout(giveUp); resolve(m.code === 'full' ? 'full' : m.code === 'auth' ? 'auth' : null); } }
        else if (m.k === 'hello') {
          clearTimeout(giveUp); id = m.id; lostAt = 0; linked = true; srvSeed = m.ss === 1;
          if (typeof m.q === 'number') { if (done && api.onHelloQ) api.onHelloQ(m.q); lastQ = m.q; hasQ = true; } // 다시 붙음: 아래 상태 바꾸기보다 먼저 기록(['J'])
          Object.keys(peers).forEach((k) => delete peers[k]);
          Object.keys(m.peers || {}).forEach((k) => (peers[k] = { state: m.peers[k] || {}, seen: Date.now() }));
          if (m.mine) mine = Object.assign(mine, m.mine);
          // 다시 붙었으면(Net에 알려 상태를 고치게 한 뒤) 내 상태를 서버에 다시 알린다
          if (done) { if (api.onRejoin) api.onRejoin(); out({ k: 'pres', p: mine }); fire(); return; }
          done = true;
          resolve(api = {
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
            linked: () => linked, // 서버가 hello로 자리를 다시 확인해 준 뒤에만 참
            presHook: true, onPres: null, onRejoin: null,
            seq: () => lastQ, seqOn: () => hasQ, onSeq: null, onHelloQ: null, // 협동 재연산: 서버가 일련번호를 주는지, 마지막으로 적용한 번호
            // 방 판 씨앗: 서버가 정하는지, 서버에만 보내기(내 화면에 바로 적용하지 않는다 — 서버가 채워 되돌려 준다). 보내지 못했으면 false
            srvSeed: () => srvSeed, ask: (t, d) => { if (ws.readyState !== 1) return false; out({ k: 'msg', t, d }); return true; },
          });
        } else if (m.k === 'pres' && m.p && typeof m.p === 'object') {
          seqd(m.q);
          const p = peers[m.id] || { state: {} }; Object.assign(p.state, m.p); p.seen = Date.now(); peers[m.id] = p;
          if (api && api.onPres) api.onPres(m.id, m.p, nowMs(), p.state); // 도착 시각을 바로 적는다(위치 보간)
          fire();
        }
        else if (m.k === 'left') { seqd(m.q); delete peers[m.id]; fire(); }
        else if (m.k === 'msg') { seqd(m.q); if (peers[m.from]) peers[m.from].seen = Date.now(); (handlers[m.t] || []).forEach((f) => f(m.d, m.from, false)); }
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
        if (api.onPres) api.onPres(m.from, m.pres, nowMs(), m.pres);
        fire();
      } else if (m.bye) { delete peers[m.from]; fire(); }
      else { if (peers[m.from]) peers[m.from].at = Date.now(); (handlers[m.t] || []).forEach((f) => f(m.d, m.from, false)); }
    };
    root.addEventListener && root.addEventListener('beforeunload', () => bc.postMessage({ from: id, bye: 1 }));
    const api = {
      kind: 'local', presHook: true, onPres: null,
      on: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
      send: (t, d) => { bc.postMessage({ from: id, t, d }); (handlers[t] || []).forEach((f) => f(d, id, true)); },
      presence: (p) => { mine = Object.assign(mine, p); bc.postMessage({ from: id, pres: mine }); fire(); },
      peers: () => [{ id, me: true, state: mine, seen: Date.now() }].concat(Object.keys(peers).map((k) => ({ id: k, me: false, state: peers[k].state, seen: peers[k].at }))),
      onPeers: (fn) => watch.push(fn),
      leave: () => { bc.postMessage({ from: id, bye: 1 }); bc.close(); },
    };
    return api;
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

  // 방장이 보낸 보스 기술 하나를 packHazard가 보내는 칸만 남겨 다시 만든다(숫자가 아니거나 무한이면 버린다)
  const HZ_NUM = ['delay', 'dmg', 'x', 'y', 'a', 'len', 'w', 'r', 'arc', 'r0', 'r1', 'v', 'rw', 'rh', 'y0', 'y1', 'dur', 'tick', 'need', 'vx', 'vy', 'pw', 'kill', 'frac', 'raid', 'hide'];
  const cleanHazard = (h) => {
    if (!h || typeof h !== 'object' || Array.isArray(h) || typeof h.k !== 'string') return null;
    const o = { k: h.k.slice(0, 12) };
    for (const f of HZ_NUM) { if (h[f] != null) { if (!fin(h[f])) return null; o[f] = h[f]; } }
    if (!fin(o.x) || !fin(o.y)) return null;
    if (h.spots != null) { if (!Array.isArray(h.spots)) return null; o.spots = h.spots.slice(0, 16).filter((s) => Array.isArray(s) && s.length <= 4 && s.every(fin)); }
    if (typeof h.fx === 'string') o.fx = h.fx.slice(0, 12);
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
      this.gh = {}; // 팀원 위치 기록: 자리 id → { r, ch, buf: [{ t, x, y }], gap, held }
      this.sync = null; // 다시 붙은 뒤 방장에게서 따라잡는 중이면 { at, sig, bs }
      this.tickAt = 0; this.resumeAt = 0; this.hostNow = null; this.hostPrev = null; this.hostPrevAt = 0;
      this.t.presence({ name, ready: true, picked: 0, sp: 1, hb: 0, sy: 0 });
      this.t.onPeers(() => this.onLobby && this.onLobby());
      if (this.t.presHook) this.t.onPres = (id, p, now, full) => this.pushGhost(id, p, now, full);
      if ('onRejoin' in this.t) this.t.onRejoin = () => this.rejoined();
      if ('onSeq' in this.t) { this.t.onSeq = (q) => this.noteSeq(q); this.t.onHelloQ = (q) => this.noteHello(q); }
      this.recQ = null; // 협동 재연산: 입력 기록에 마지막으로 적은 방 일련번호(recHead가 정한다. null = 기록하지 않음)
      this.bucket = {}; this.badAt = {}; this.badN = {};
      // 방장 전용 신호(phase, clk, bs, hz, start, pattern)는 지금 방장(막 바뀌었으면 앞 방장도)에게서 온 것만 받는다
      // 서버가 씨앗을 채워 되돌려 준 내 시작(ss, 보낸 사람 = 나)은 이 Net이 시작을 요청했을 때만 받는다(다시 들어온 새 화면이 앞 판의 시작을 받지 않게)
      this.startAsk = 0; this.startAsked = false; this.onStartFail = null;
      this.t.on('start', (d, peer, self) => {
        if (!obj(d) || this.started) return;
        const echo = !self && d.ss === 1 && peer != null && peer === this.myId();
        if (echo && !this.startAsked) return;
        if (!this.fromHost(peer, self || echo)) return;
        if (typeof d.diff !== 'string' || !fin(d.seed)) return this.bad('start', peer);
        const s = { diff: d.diff.slice(0, 16), seed: d.seed | 0, mutLv: clampN(d.mutLv, 0, 99) | 0, muts: Array.isArray(d.muts) ? d.muts.filter((x) => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 24)) : [] };
        Object.keys(d).forEach((k) => { if (!(k in s) && (fin(d[k]) || typeof d[k] === 'boolean')) s[k] = d[k]; });
        this.started = true; this.diff = s.diff; this.clock.last = Date.now(); this.onStart && this.onStart(s);
      });
      // 단계 신호는 방장 것만 받는다. 라이프가 다하면 그 사람만 탈락(presence out)하고, 판 전체 패배는 남은 사람이 모두 탈락했을 때
      // 방장이 명단을 보고 정한다(checkAllOut). 손님이 보낸 패배 신호는 그 확인을 앞당기는 계기로만 쓴다(값은 믿지 않는다).
      this.t.on('phase', (d, peer, self) => {
        const g = this.game;
        if (self || !g || !obj(d)) return;
        if (!PHASES[d.p]) return this.bad('phase', peer);
        if (this.fromHost(peer, self)) { const c = this.cleanPhase(d); if (c) this.applyPhase(c); else this.bad('phase', peer); return; }
        if (d.p !== 'over' || d.win !== false || !this.isHost() || g.over) return; // 방장이 아닌 사람의 판 전체 신호는 버린다
        if (!this.inRoster(peer)) return this.bad('over', peer);
        this.checkAllOut();
      });
      this.t.on('clk', (d, peer, self) => {
        if (self || !obj(d) || !this.fromHost(peer, self)) return;
        if (!fin(d.r) || !fin(d.t)) return this.bad('clk', peer);
        d = { r: d.r | 0, t: d.t, ph: str(d.ph, 12), sp: clampN(d.sp, 1, 3), pz: d.pz ? str(String(d.pz), 24) || null : null, dr: Array.isArray(d.dr) ? d.dr.slice(0, GUARD.drMax) : null };
        const strict = peer === this.hostId();
        this.syncClock(d, strict);
        // 다시 붙은 사람: 지금 방장의 시계를 받아 라운드를 따라잡았으면(보스전이면 보스 상태도 받았으면) 보류를 푼다
        if (this.sync && strict) {
          this.sync.sig = Date.now();
          const g = this.game;
          if (!g || g.over || (d.r <= g.round && (d.ph !== 'boss' || this.sync.bs))) this.sync.ok = true;
        }
      });
      this.t.on('hz', (d, peer, self) => {
        const g = this.game;
        if (self || !g || !g.fight || !Array.isArray(d) || !this.fromHost(peer, self)) return;
        if (d.length > GUARD.hzBatch) this.bad('hz', peer);
        d.slice(0, GUARD.hzBatch).forEach((h) => {
          const c = cleanHazard(h);
          if (!c) return this.bad('hz', peer);
          if (g.fight.hazards.length < GUARD.hzTotal) g.fight.hazards.push(Object.assign({ c: g.fight.def.fx, t: 0 }, c));
        });
      });
      // 일기토 출전 신청: 신청한 사람의 외침을 모두에게 띄운다(외침은 번호로 보내 각자 언어로 보여 준다)
      this.t.on('vol', (d, peer, self) => { if (this.game && obj(d) && d.r === this.game.round && (self || this.allow('vol', peer))) { const L = root.RTD_I18N; const line = L ? L.t('volLine' + clampN(d.i | 0, 0, 2)) : ''; this.game.log('toast', { text: `${str(d.n, 12)}: "${line}"`, tone: 'good' }); } });
      // 방 채팅: 서버가 거른 글만 보인다(내가 보낸 글도 서버를 거쳐 돌아온 것을 쓴다)
      this.t.on('chat', (d, peer, self) => { if (!self && obj(d) && this.onChat) this.onChat({ x: str(d.x, 80), n: str(d.n, 24) }, peer); });
      // 이모티콘(협동 판 게임 중): 채팅과 같이 서버가 거른 것만 보인다(내 것도 서버가 돌려준 것을 쓴다)
      this.t.on('emo', (d, peer, self) => { if (!self && obj(d) && EMOS.includes(d.e) && this.onEmo) this.onEmo({ e: d.e, n: str(d.n, 24) }, peer); });
      // 내 채팅이 막혔을 때(도배·광고) 서버가 나에게만 보낸다: 서버가 내 자리 id로 보낸 것만 받는다(남이 흉내 낸 것은 버린다)
      this.t.on('chatno', (d, peer) => { const me = this.me(); if (obj(d) && this.onChatNo && this.t.kind === 'ws' && me && peer === me.id) this.onChatNo({ why: str(d.why, 12), s: clampN(d.s, 0, 1e9) }); });
      // 이 방은 이미 판을 시작했다(서버가 같은 방의 두 번째 시작을 막고 나에게만 알린다, 2026-11-28): 기다림을 끝내고 화면에 까닭을 넘긴다
      this.t.on('startno', (d, peer) => { const me = this.me(); if (obj(d) && this.t.kind === 'ws' && me && peer === me.id && this.startAsk && !this.started) { this.startAsk = 0; if (this.onStartFail) this.onStartFail(str(d.why, 12)); } });
      this.t.on('pattern', (d, peer, self) => { if (!self && this.game && obj(d) && this.fromHost(peer, self)) { this.game.log('pattern', { name: str(d.n, 24) }); this.game.log('sfx', { s: 'warn' }); if (this.game.synEvent) this.game.synEvent('pattern', {}); } });
      this.t.on('pop', (d, peer, self) => {
        const g = this.game;
        if (self || !g || !obj(d) || typeof d.id !== 'string' || !Object.prototype.hasOwnProperty.call(g.defs, d.id) || !this.allow('pop', peer)) return;
        if (g.defs[d.id].tier >= 9 && !this.allow('popHi', peer)) return;
        g.log('pop', { def: g.defs[d.id], who: str(d.name, 24), remote: true });
      });
      this.t.on('bs', (d, peer, self) => {
        const g = this.game;
        if (self || !g || !g.fight || !obj(d) || !this.fromHost(peer, self)) return;
        const b = g.fight.boss, num = (v) => typeof v === 'number' && isFinite(v);
        if (num(d.x) && num(d.y)) { b.x = d.x; b.y = d.y; }
        if (num(d.hp)) b.hp = Math.min(b.hp, d.hp);
        if (num(d.t)) g.fight.t = d.t;
        if (obj(d.m)) g.raidApply(d.m);
        if (this.sync && peer === this.hostId()) { this.sync.bs = true; this.sync.sig = Date.now(); }
      });
      this.t.on('dmg', (d, peer, self) => {
        const g = this.game;
        if (self || !g || !g.fight || !this.isHost() || !obj(d)) return;
        if (!this.inRoster(peer) || !this.allow('dmg', peer)) return this.bad('dmg', peer);
        const c = this.cleanDamage(d, peer);
        if (c) g.remoteDamage(c);
      });
      // 다른 사령관의 힐러·버퍼가 보낸 치료와 호령
      this.t.on('sup', (d, peer, self) => {
        if (self || !this.game || !obj(d)) return;
        const cap = typeof d.k === 'string' && Object.prototype.hasOwnProperty.call(GUARD.sup, d.k) ? GUARD.sup[d.k] : null;
        if (cap == null || !fin(d.v) || !this.inRoster(peer) || !this.allow('sup', peer)) return this.bad('sup', peer);
        this.game.applySupport({ k: d.k, v: clampN(d.v, 0, cap), dur: clampN(d.dur, 0, GUARD.effDurMax) });
      });
      this.t.on('wiped', (d, peer, self) => {
        const g = this.game;
        if (!g || !g.fight || !this.isHost() || !(self || (this.inRoster(peer) && this.allow('wiped', peer)))) return;
        // 쓰러진 사람 목록은 보스전(라운드)마다 따로 센다. 앞 보스전에서 쓰러진 사람이 남아 있으면 다음 보스전이 잘못 전멸 처리된다
        if (d && d.r != null && d.r !== g.round) return;
        if (!this.wiped || this.wiped.r !== g.round) this.wiped = { r: g.round, who: {} };
        this.wiped.who[peer] = true;
        // 탈락한 사람은 출전하지 않으므로 '다 쓰러짐'을 보내지 않는다: 아직 싸우는 사람이 모두 쓰러졌을 때 진다
        const alive = this.alive();
        if (alive.length && alive.every((p) => this.wiped.who[p.id])) { this.wiped = null; g.endFight(false); }
      });
    }
    me() { return this.t.peers().find((p) => p.me); }
    myId() { const m = this.me(); return m ? m.id : null; }
    // ---- 탈락(관전) ----
    // 탈락은 각자 자기 라이프로만 정하고 presence의 out(탈락 라운드)으로 알린다. 남이 내 탈락을 정할 수 없다(presence는 자리마다 따로다).
    // 거짓 out은 보낸 사람만 빠질 뿐이다(남을 탈락시키거나 판을 끝내지 못한다).
    isOut(p) { return p.me ? !!(this.game && this.game.out) : !!(p.state && p.state.out); }
    alive() { return this.roster().filter((p) => !this.isOut(p)); }
    aliveOthers() { return this.alive().filter((p) => !p.me).length; }
    partyLive() { return Math.min(5, this.alive().length); }
    markOut() { const g = this.game; this.t.presence({ out: (g && (g.out || g.round)) || 1 }); }
    // 방장: 명단의 모두가 탈락했으면 판 전체 패배를 알린다
    checkAllOut() {
      const g = this.game, r = this.roster();
      if (!g || g.over || !r.length || !r.every((p) => this.isOut(p) || (p.me && g.lives <= 0))) return;
      g.finish(false);
      this.send('phase', { p: 'over', win: false });
    }
    inRoster(peer) { return this.roster().some((p) => p.id === peer); }
    // 걸러 낸 신호 기록(종류마다 GUARD.logGapMs에 한 번, 그사이 개수를 함께 적는다)
    bad(kind, peer) {
      const now = Date.now(); this.badN[kind] = (this.badN[kind] || 0) + 1;
      if (now - (this.badAt[kind] || 0) < GUARD.logGapMs) return;
      this.badAt[kind] = now;
      if (typeof console !== 'undefined') console.warn(`[net] 버린 신호 ${kind} from=${String(peer).slice(0, 16)} 누계=${this.badN[kind]}`);
    }
    // 사람·종류별 보낼 수 있는 횟수(GUARD.rate: 게임 1초에 몇 개, 몰아서 몇 개)
    allow(kind, peer) {
      const g = this.game, now = g ? g.time : Date.now() / 1000, [r, cap] = GUARD.rate[kind] || [10, 10], key = kind + '|' + peer;
      let b = this.bucket[key];
      if (!b || now < b.at) b = this.bucket[key] = { tok: cap, at: now };
      b.tok = Math.min(cap, b.tok + (now - b.at) * r); b.at = now;
      if (b.tok < 1) { this.bad(kind + '_rate', peer); return false; }
      b.tok -= 1; return true;
    }
    // 손님이 보낸 보스 피해를 정리한다. 피해는 사람마다 보스 최대 체력의 비율로 예산을 두고 넘친 몫은 버린다.
    cleanDamage(d, peer) {
      const g = this.game, f = g.fight, mhp = f.boss.mhp > 0 ? f.boss.mhp : 1, now = g.time, key = 'dmgHp|' + peer, G = GUARD;
      if (d.v != null && !fin(d.v)) { this.bad('dmg', peer); return null; }
      let b = this.bucket[key];
      if (!b || now < b.at) b = this.bucket[key] = { tok: G.dmgBurst, at: now };
      b.tok = Math.min(G.dmgBurst, b.tok + (now - b.at) * G.dmgPerSec); b.at = now;
      const want = Math.max(0, d.v || 0), v = Math.min(want, b.tok * mhp);
      if (v < want) this.bad('dmg_cap', peer);
      b.tok -= v / mhp;
      const o = {};
      if (obj(d.o)) Object.keys(d.o).slice(0, G.objMax).forEach((id) => { if (/^\d{1,9}$/.test(id) && fin(d.o[id]) && d.o[id] > 0) o[id] = Math.min(d.o[id], mhp); });
      const cm = Array.isArray(d.cm) && fin(d.cm[0]) && fin(d.cm[2]) ? [clampN(d.cm[0], 0, G.charmDurMax), clampN(d.cm[1], 0, G.ampMax), clampN(d.cm[2], G.charmCdMin, G.charmCdMax)] : null;
      return {
        v, stun: clampN(d.stun, 0, G.stunMax), o, ctr: clampN(d.ctr, 0, G.ctrMax) | 0, cb: clampN(d.cb, 0, G.ctrMax) | 0, sg: clampN(d.sg, 0, 3 * v),
        amp: pair(d.amp, G.ampMax, G.effDurMax), ad: pair(d.ad, G.adMax, G.effDurMax), sa: pair(d.sa, 0.5, 10), cm: cm && cm[0] > 0 ? cm : null, gp: clampN(d.gp, 0, G.gapMax),
      };
    }
    // 방장의 단계 신호 형식 검사(잘못된 값이면 null)
    cleanPhase(d) {
      const g = this.game;
      if (d.p === 'round') { const max = g.diff && fin(g.diff.rounds) ? g.diff.rounds : 999; return fin(d.r) && d.r >= 1 && d.r <= max ? { p: 'round', r: d.r | 0 } : null; }
      if (d.p === 'fight') return { p: 'fight', dep: Array.isArray(d.dep) ? d.dep.filter((x) => typeof x === 'string' || fin(x)).slice(0, GUARD.depMax) : null };
      if (d.p === 'bossEnd') return typeof d.win === 'boolean' ? { p: 'bossEnd', win: d.win, remain: clampN(d.remain, 0, 1) } : null;
      if (d.p === 'over') return typeof d.win === 'boolean' ? { p: 'over', win: d.win } : null;
      return { p: d.p };
    }
    roster() { return this.t.peers().filter((p) => p.state && p.state.name && !this.dropped.has(p.id) && (p.me || !p.state.away)).sort((a, b) => (a.id < b.id ? -1 : 1)); }
    // 자리 비운 사람(앱을 내림): 60초 안에 돌아오면 다시 명단에 들어간다
    awayList() { return this.t.peers().filter((p) => !p.me && p.state && p.state.away && !this.dropped.has(p.id)); }
    // 난이도용 인원: 명단 + 탈락한 뒤 나간 사람(탈락자가 나가도 보스 체력 배율 등은 처음 인원 그대로. 2026-11-24 사용자 결정)
    partySize() {
      const r = this.roster(), ids = new Set(r.map((p) => p.id));
      let gone = 0; if (this.outIds) this.outIds.forEach((id) => { if (!ids.has(id)) gone++; });
      return Math.min(5, r.length + gone);
    }
    // 방장 = 명단에서 id가 가장 앞인 사람. 다만 다시 붙어 따라잡는 중인 사람(sy)은 건너뛴다(낡은 상태로 방장을 되찾지 않게).
    // 탈락한 사람도 건너뛴다(보스는 방장 게임이 계산하므로 출전하는 사람이 맡는다. 모두 탈락이면 예전 규칙대로).
    // 내 따라잡기 보류는 내 화면에서 바로 적용한다(서버에 sy가 닿기 전에도).
    hostPeer() {
      const r = this.roster(), ok = (p) => !(p.me ? this.sync : p.state.sy);
      return r.find((p) => ok(p) && !this.isOut(p)) || r.find(ok) || r[0] || null;
    }
    hostId() { const h = this.hostPeer(); return h ? h.id : null; }
    isHost() { const h = this.hostPeer(); return !h || h.me; }
    // 방장 전용 신호를 받아도 되는지: 지금 방장이거나, 방장이 바뀐 지 얼마 안 됐을 때의 앞 방장
    fromHost(peer, self) {
      if (self) return true;
      const h = this.hostId(), now = Date.now();
      if (h !== this.hostNow) { this.hostPrev = this.hostNow; this.hostPrevAt = now; this.hostNow = h; }
      // 앞 방장 유예가 끝나는 것은 판 안에서는 tickStatus가 'hg' 명령으로 정한다(벽시계 판단을 입력 기록에 남겨 서버 재연산이 같게). 판 밖(대기실)은 예전처럼 시각으로
      return peer === h || (peer != null && peer === this.hostPrev && (this.game ? true : now - this.hostPrevAt < NETCFG.hostGraceMs));
    }
    // 끊겼다가 같은 자리로 다시 붙었을 때(wsTransport의 hello)
    rejoined() {
      this.dropped = new Set(); // 끊긴 동안 내가 잘못 넣었을 수 있는 제외 목록은 버린다(방장의 clk가 다시 채운다)
      this.resumeAt = Date.now(); this.gh = {};
      const g = this.game;
      if (g && this.started && !g.over) {
        this.sync = { at: Date.now(), sig: Date.now(), bs: false, ok: false };
        this.t.presence({ sy: 1 });
      }
    }
    send(topic, data) { this.t.send(topic, data); }
    // 시작 신호: 난이도, 씨앗, 악몽 +N 규칙(모두 같은 규칙으로 돈다)
    // 2026-11-28: 서버가 씨앗을 정하면(srvSeed) { diff, mutLv, ss: 1 }만 서버에 보내고, 서버가 씨앗·규칙을 채워 모두에게(나에게도) 보낸 신호로 시작한다(extra.muts·seed는 쓰지 않는다).
    //   돌려주는 값: true = 보냄(또는 답을 기다리는 중), false = 연결이 없어 못 보냄(화면이 알린다). startWaitMs 안에 답이 없으면 onStartFail()
    //   예전 서버·같은 브라우저 탭(BroadcastChannel)·Claude room은 예전처럼 방장이 씨앗을 고르고 바로 시작한다
    start(diff, extra) {
      if (this.t.srvSeed && this.t.srvSeed()) {
        if (this.started) return true;
        const now = Date.now();
        if (this.startAsk && now - this.startAsk < NETCFG.startWaitMs) return true;
        const d = Object.assign({}, extra || {}, { diff, ss: 1 }); delete d.seed; delete d.muts;
        if (!this.t.ask('start', d)) return false;
        this.startAsk = now; this.startAsked = true;
        setTimeout(() => { if (!this.started && this.startAsk === now) { this.startAsk = 0; if (this.onStartFail) this.onStartFail(); } }, NETCFG.startWaitMs);
        return true;
      }
      this.t.send('start', Object.assign({ diff, seed: (Math.random() * 1e9) | 0 }, extra || {}));
      return true;
    }
    startPending() { return !this.started && !!this.startAsk; }
    leave() { this.t.leave(); }
    // 판이 시작된 시각. 대기실에서는 상태 알림을 주고받지 않으므로, 그 전의 마지막 알림 시각으로 끊김을 판단하면
    // 대기실에 오래 있던 사람이 시작하자마자 '멈춤·제외'로 튕긴다. 판 시작 전 시각은 시작 시각으로 본다.
    // 판을 붙일 때 방장 유예 상태를 지금 방장으로 맞춘다(재연산이 같은 상태에서 시작하게. 대기실에서 막 바뀐 방장의 유예 3초는 판 안으로 넘기지 않는다)
    attach(game) { this.game = game; this.startAt = Date.now(); this.clock.last = this.startAt; if (game) { this.hostPrev = null; this.hostNow = this.hostId(); } }
    // 앱을 내렸다 켜는 등으로 내 계산이 멈췄던 시간은 남의 잘못이 아니므로, 돌아온 시각(resumeAt)부터 다시 센다
    seenAt(p, now) { return Math.max(p.seen || now, this.startAt || 0, this.resumeAt || 0); }
    applyPhase(d) {
      const g = this.game;
      if (d.p === 'round') { if (d.r > g.round) { if (g.endedRound !== g.round) g.endRound(); g.applyRound(d.r); } }
      else if (d.p === 'pick') g.applyPick();
      else if (d.p === 'fight') g.beginFight(Array.isArray(d.dep) ? d.dep : null);
      else if (d.p === 'bossEnd') g.applyBossEnd(d.win, d.remain);
      else if (d.p === 'over') g.finish(d.win);
    }
    // 방장의 시계에 맞춘다. 놓친 신호가 있어도 여기서 따라잡는다.
    // strict: 보낸 사람이 지금 방장일 때만 제외 목록(dr)을 받는다(앞 방장 유예로 받은 clk의 dr은 버린다)
    syncClock(d, strict) {
      const g = this.game;
      this.clock = { sp: d.sp || 1, pz: d.pz || null, last: Date.now() };
      if (strict && Array.isArray(d.dr)) d.dr.forEach((id) => { if (typeof id === 'string' && id.length <= 24) this.dropped.add(id); });
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
      this.cmd('vo', [r, (Math.random() * 3) | 0]); // 내 자리 상태 vol이 출전 순서(relayOrder)를 바꾸므로 입력 기록에 남긴다
    }
    volunteers() { const r = this.game.round; return this.roster().filter((p) => p.state.vol === r); }
    relayOrder() {
      const g = this.game, r = g.round;
      if (this.relayOrd && this.relayOrd.r === r) return this.relayOrd.list;
      const ros = this.alive(), vols = this.volunteers().filter((p) => !this.isOut(p));
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
    emo(id) { if (EMOS.includes(id)) this.send('emo', { e: id }); }
    relayDone() { this.t.presence({ rd: this.game.round }); }
    allPicked() { const r = this.game.round; return this.roster().every((p) => this.isOut(p) || (p.me ? this.game.fight.picked : p.state.picked === r)); }
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
        // ctr: 정면 몫·cb: 뒤·옆 몫(반격 게이지, 방장이 뒤·옆 몫 상한을 건다), sg: 디버퍼가 무력화 게이지에 더 넣는 양, amp: 보스 약화
        // sa: 인연 팀 보스 약화(samp) [값, 시간]
        if ((f.pending > 0 || po || f.pendCtr || f.pendCtrB || f.pendAmp || f.pendCharm || f.pendAd || f.pendGap || f.pendSamp) && !this.isHost()) this.send('dmg', { sa: f.pendSamp || null, ad: f.pendAd || null, gp: f.pendGap || 0, v: Math.round(f.pending), stun: f.pendStun || 0, o: po, ctr: Math.round(f.pendCtr || 0), cb: Math.round(f.pendCtrB || 0), sg: Math.round(f.pendSg || 0), amp: f.pendAmp || null, cm: f.pendCharm || null });
        f.pending = 0; f.pendStun = 0; f.pendObj = {}; f.pendCtr = 0; f.pendCtrB = 0; f.pendSg = 0; f.pendAmp = null; f.pendCharm = null; f.pendAd = null; f.pendGap = 0; f.pendSamp = null;
      }
      if (this.isHost() && f.syncT <= 0) {
        f.syncT = 0.2;
        const b = f.boss;
        this.send('bs', { x: Math.round(b.x), y: Math.round(b.y), hp: Math.round(b.hp), t: round1(f.t), m: g.raidWire() });
      }
      const c = g.firstLocal();
      const pres = { cx: c ? Math.round(c.x) : null, cy: c ? Math.round(c.y) : null, ch: c ? c.def.id : null, hpf: c ? round1(c.hp / c.mhp) : 0, dmg: Math.round(f.total) };
      // 인연 원군 연출(남의 화면에 이름표와 함께 그린다, 피해 없음). 새 연출이 있을 때만 싣는다
      const sv = g.synWire ? g.synWire() : null; if (sv) pres.sv = sv;
      this.t.presence(pres);
      f.ghosts = {};
      const tn = nowMs();
      this.roster().forEach((p) => {
        // 판정용 좌표는 마지막으로 받은 값 그대로(방장의 표적 선택·사기 합산). 그림은 07-arena가 ghostAt으로 이어 그린다
        if (!p.me && !this.isOut(p) && p.state.ch && p.state.cx != null) f.ghosts[p.id] = { id: p.id, x: p.state.cx, y: p.state.cy, alive: true, ghost: true, def: g.defs[p.state.ch], hpf: p.state.hpf, name: p.state.name };
        if (!p.me && Array.isArray(p.state.sv) && g.synRemote) g.synRemote(p.id, p.state.name, p.state.sv);
        // 도착 갈고리가 없는 전송(Claude room·가상 방): 값이 바뀌었을 때 여기서 기록한다
        if (!p.me && !this.t.presHook) {
          const G = this.gh[p.id], L = G && G.buf[G.buf.length - 1];
          if (!L || L.x !== p.state.cx || L.y !== p.state.cy || G.ch !== p.state.ch) this.pushGhost(p.id, { cx: p.state.cx, cy: p.state.cy }, tn, p.state);
        }
      });
    }
    // 팀원 위치 하나를 도착 시각과 함께 기록한다. p는 이번에 온 값(일부), full은 합친 상태
    pushGhost(id, p, now, full) {
      if (!p || typeof p !== 'object') return;
      if (p.away) { delete this.gh[id]; return; }
      if (p.cx === undefined) return;
      const st = full || p, r = this.game ? this.game.round : 0, C = NETCFG;
      let G = this.gh[id];
      if (!G || G.r !== r || G.ch !== st.ch) G = this.gh[id] = { r, ch: st.ch, buf: [], gap: 67, held: null };
      const ok = (v) => typeof v === 'number' && isFinite(v);
      if (!ok(p.cx) || !ok(p.cy)) { G.buf.length = 0; G.held = null; return; } // 쓰러짐: 다음 위치에 바로 세운다
      const b = G.buf, last = b[b.length - 1];
      if (last && now - last.t < C.mergeMs) { last.x = p.cx; last.y = p.cy; last.t = now; return; }
      if (last) G.gap = G.gap * 0.8 + Math.min(500, now - last.t) * 0.2;
      // 늦게 와서 멈춰 서 있었다면, 서 있던 자리에서 출발해 따라잡는다(멀면 바로 옮긴다)
      if (G.held && last) {
        if (Math.hypot(p.cx - G.held.x, p.cy - G.held.y) <= C.snapDist) b.push({ t: Math.max(last.t + 1, now - this.interpDelay(G)), x: G.held.x, y: G.held.y });
        else b.length = 0;
      }
      G.held = null;
      b.push({ t: now, x: p.cx, y: p.cy });
      while (b.length > C.bufLen) b.shift();
    }
    interpDelay(G) { return Math.min(NETCFG.interpMaxMs, Math.max(NETCFG.interpDelayMs, G.gap * 1.5)); }
    // 그릴 위치: 지금보다 interpDelay만큼 앞선 시각의 위치. { x, y, vx, vy(px/ms) } 또는 기록이 없으면 null
    ghostAt(id, now) {
      const G = this.gh[id], C = NETCFG;
      if (!G || !G.buf.length) return null;
      const b = G.buf, rt = now - this.interpDelay(G);
      while (b.length > 2 && b[1].t <= rt) b.shift(); // rt보다 한 칸 넘게 오래된 표본은 버린다(두 개는 남긴다)
      if (rt < b[0].t) return { x: b[0].x, y: b[0].y, vx: 0, vy: 0 };
      for (let i = 0; i < b.length - 1; i++) {
        const a = b[i], c = b[i + 1];
        if (rt >= a.t && rt < c.t) {
          if (Math.hypot(c.x - a.x, c.y - a.y) > C.snapDist) return { x: a.x, y: a.y, vx: 0, vy: 0 };
          const k = (rt - a.t) / (c.t - a.t), dt = c.t - a.t;
          return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, vx: (c.x - a.x) / dt, vy: (c.y - a.y) / dt };
        }
      }
      // 다음 위치가 아직 안 왔다: 마지막 속도로 extrapMaxMs까지만 더 가고, 그 뒤에는 그 자리에 선다
      const L = b[b.length - 1], P = b.length > 1 ? b[b.length - 2] : null;
      let vx = 0, vy = 0;
      if (P && L.t > P.t && Math.hypot(L.x - P.x, L.y - P.y) <= C.snapDist) { vx = (L.x - P.x) / (L.t - P.t); vy = (L.y - P.y) / (L.t - P.t); }
      const over = rt - L.t, e = Math.min(over, C.extrapMaxMs), x = L.x + vx * e, y = L.y + vy * e;
      if (over > C.extrapMaxMs) { G.held = { x, y }; return { x, y, vx: 0, vy: 0 }; }
      return { x, y, vx, vy };
    }
    // 다른 사람이 F키로 내 전장을 볼 수 있게 라인 상태를 짧게 묶어 보낸다
    // 묶음마다 번호(s)와 개체 id를 붙여 받는 쪽이 이전 묶음과 이어 부드럽게 움직이게 한다
    // full이 아니면(아무도 내 전장을 보지 않음) 좌표 배열은 빈 배열로 보낸다. 파티원 줄이 쓰는 g, l, n은 늘 간다.
    // 필드를 빼지 않고 빈 배열로 두는 까닭: 받는 쪽(05-lane, 04-fx-text, 옛 버전)이 ln.u, ln.e를 바로 읽는다
    laneSnapshot(g, full) {
      const T = g.T;
      if (full === false) return { s: ++this.lnSeq, u: [], e: [], g: g.me.gold, l: g.lives, n: g.enemyCount() };
      return {
        s: ++this.lnSeq,
        u: g.units.filter((x) => x.owner === 0).slice(0, 60).map((x) => [x.id, T.units.indexOf(x.def), x.x | 0, x.y | 0, Math.round((x.face == null ? 1.57 : x.face) * 10), x.moveT > 0 ? 1 : 0, x.atkT > 0 ? 1 : 0, Math.round(g.unitAtk(x))]),
        e: g.enemies.slice(0, 60).map((x) => [x.id, x.mid ? 100 + T.midbosses.indexOf(x.midDef) : T.waves.indexOf(x.w), x.x | 0, x.y | 0, Math.round((x.hp / x.mhp) * 20), x.seg]),
        g: g.me.gold, l: g.lives, n: g.enemyCount(),
      };
    }
    // ---- 협동 재연산 기록(2026-11-28 C1, production/team/2026-11-28/coop-replay.md) ----
    // 방 판의 계산 = 내 조작(g.input) + 받은 소식 + 아래 명령. 받은 소식은 서버 일련번호(q)로만 적는다: ['M', 앞 M과의 q 차이](이 걸음 앞에서 q까지 적용, 같은 걸음이면 하나로 합침).
    // 다시 붙음은 ['J', q](그 시점 서버 방 상태로 바뀜 + rejoined), 벽시계·화면 판단은 ['N', 종류, 값...](applyCmd). 서버(server/replay-core.js replayRoom)가 같은 순서로 다시 넣는다.
    // 판 상태를 바꾸는 net 쪽 판단은 모두 소식 핸들러(→ M)나 cmd(→ N)를 거쳐야 한다. 새 판단을 넣을 때도 이 길로(소식 핸들러 안에서 cmd를 부르지 않는다 — 재연산에서 두 번 적용된다).
    // 판을 시작할 때(begin, attach 전) 부른다. 서버가 일련번호를 주지 않으면(업데이트 전 서버) null = 기록하지 않는다
    recHead() {
      const me = this.me();
      if (!this.t.seqOn || !this.t.seqOn() || !me) return null;
      this.recQ = this.t.seq();
      return { me: me.id, q0: this.recQ, dr0: [...this.dropped] };
    }
    recOn() { const g = this.game; return !!(g && g.rec && !g.over && this.recQ != null && !g.rec.full); }
    noteSeq(q) {
      if (!this.recOn()) return;
      const g = this.game, R = g.rec, L = R.c[R.c.length - 1];
      if (L && L[1] === 'M' && R.last === g.stepN) L[2] += q - this.recQ;
      else R.push(g.stepN, 'M', [q - this.recQ]);
      this.recQ = q;
    }
    noteHello(q) { if (!this.recOn()) return; const g = this.game; g.rec.push(g.stepN, 'J', [q]); this.recQ = q; }
    // 판을 바꾸는 net 판단 하나: 기록하고 적용한다
    cmd(k, a) { a = a || []; const g = this.game; if (this.recOn()) g.rec.push(g.stepN, 'N', [k].concat(a)); return this.applyCmd(k, a); }
    applyCmd(k, a) {
      const g = this.game;
      if (k === 'dr') { if (typeof a[0] === 'string') this.dropped.add(a[0].slice(0, 24)); } // 오래 반응 없는 사람 빼기(DROP_MS)
      else if (k === 'sy') { if (this.sync) { this.sync = null; this.t.presence({ sy: 0 }); } } // 다시 붙은 뒤 따라잡기 보류 풀기
      else if (k === 'hg') this.hostPrev = null; // 앞 방장 유예 끝
      else if (k === 'ts') this.stepStatus();
      else if (k === 'vo') { const r = a[0] | 0; this.t.presence({ vol: r }); this.send('vol', { r, n: this.name, i: clampN(a[1], 0, 2) | 0 }); } // 출전 신청
      else if (k === 'qt') { if (g && !g.over) g.finish(false); } // 관전 중 나가기(11-actions quit): 내 판을 패배로 끝낸다
    }
    quitOut() { this.cmd('qt'); }
    // tickStatus의 판 상태 부분이 할 일이 있는가(읽기만)
    statusDue() {
      const g = this.game; if (!g) return false;
      const r = this.roster();
      if (r.some((p) => !p.me && p.state.out && !(this.outIds && this.outIds.has(p.id)))) return true;
      return this.isHost() && !g.over && r.length > 0 && r.every((p) => this.isOut(p) || (p.me && g.lives <= 0));
    }
    // 새로 탈락한 동료를 알리고, 나가도 난이도 인원에 남도록 기억한다(partySize). 방장이면 전원 탈락을 확인한다
    stepStatus() {
      const g = this.game; if (!g) return;
      this.roster().forEach((p) => {
        if (p.me || !p.state.out) return;
        if (!this.outIds) this.outIds = new Set();
        if (this.outIds.has(p.id)) return;
        this.outIds.add(p.id);
        const L = root.RTD_I18N, a = str(p.state.name, 24) || '?';
        if (!g.over) g.log('toast', { text: L ? L.t('elimPeer', { a }) : a + ' 탈락', tone: 'warn' });
      });
      if (this.isHost()) this.checkAllOut();
    }
    // 매 틱 호출: 내 상태 알림, 끊긴 사람 감시, 방장이면 시계 방송
    tickStatus(dt, g) {
      const now = Date.now();
      // 계산이 오래 멈췄다 돌아왔으면(앱을 내렸다 켬) 남의 마지막 소식 시각을 지금부터 다시 센다
      if (this.tickAt && now - this.tickAt > NETCFG.resumeGapMs) this.resumeAt = now;
      this.tickAt = now;
      // 다시 붙은 뒤 따라잡기 보류: 방장 시계를 받아 따라잡았거나, 방장 신호가 STALL_MS 동안 없거나(다른 방장이 없음), 최대 시간이 지나면 푼다
      // 푸는 판단은 벽시계라 명령('sy')으로 넣어 입력 기록에 남긴다(협동 재연산)
      if (this.sync && (this.sync.ok || now - this.sync.sig > STALL_MS || now - this.sync.at > NETCFG.syncMaxMs)) this.cmd('sy');
      if (this.hostPrev != null && now - this.hostPrevAt >= NETCFG.hostGraceMs) this.cmd('hg'); // 앞 방장 유예 끝(fromHost)
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
      if (this.laneT <= 0 && g.phase === 'wave') { this.laneT = gap; this.t.presence({ ln: this.laneSnapshot(g, !!watched) }); }
      // 오래 반응이 없는 사람은 모두가 같은 규칙으로 제외한다. 내가 서버와 끊겨 있는 동안에는 판단하지 않는다(남의 소식이 안 오는 건 내 탓)
      const linked = !this.t.linked || this.t.linked();
      if (linked) this.roster().forEach((p) => { if (!p.me && now - this.seenAt(p, now) > DROP_MS) this.cmd('dr', [p.id]); });
      // 새로 탈락한 동료 기억(partySize)·방장의 전원 탈락 확인: 할 일이 있을 때만 명령('ts')으로 한다(stepStatus)
      if (this.statusDue()) this.cmd('ts');
      if (this.isHost()) {
        if (this.clkT <= 0) {
          this.clkT = 0.5;
          // 탈락한 사람의 배속 투표는 세지 않는다(관전자가 남은 사람의 배속을 묶지 않게)
          const sp = this.roster().filter((p) => !this.isOut(p)).reduce((m, p) => Math.min(m, clampN(p.me ? this.speedWant : p.state.sp || 1, 1, 3)), 3);
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
    TOPICS, EMOS,
    // 협동 재연산(서버 replay-core)이 재연산용 전송 계층으로 Net을 만든다
    make: (t, name) => new Net(t, name),
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
