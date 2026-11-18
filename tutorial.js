// 안내(튜토리얼). 로비 안내 → 첫 오프라인 판에서 '해 보면 넘어가는' 단계. 첫 신화 2명(RTD_LOBBY.grantStarter)은 쉬움을 처음 클리어해 상점이 열릴 때 상점 안내 중에 준다.
// 실제 화면 요소를 비추고(#tutring) 말풍선(#tutbox)으로 설명한다. 설명하는 동안(hold)은 게임 시간이 멈춘다(S.tutHold).
// 끝나거나 건너뛰면 localStorage 'rtd-tut'=1. 명사·시너지 팁은 판과 상관없이 처음 그 장면이 올 때 한 번씩('rtd-tip-sage', 'rtd-tip-syn').
// 해금 연출은 기존 그림만 합성한다(장수 초상, gfx/ray_sun·pic_star, fxa_burst 프레임 애니메이션). 도형을 그려 만들지 않는다.
(function (root) {
  const KEY = 'rtd-tut', GIFT_SEEN = 'rtd-starter-seen', SHOP_KEY = 'rtd-shoptut';
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } };
  const done = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } };
  const mark = () => set(KEY, '1');
  const reset = () => { try { localStorage.removeItem(KEY); } catch (e) { /* 저장 불가 */ } };
  const $ = (s) => document.querySelector(s);
  const vis = (el) => el && !el.hidden && el.getClientRects().length > 0;
  const deployed = (c) => c.g.phase === 'boss' && !!c.g.fight && c.g.localChamps().length > 0;
  const me = (c) => c.g.me;
  const cheapUp = (c) => { const g = c.g, p = me(c); return c.T.upgrades.filter((u) => (p.upgrades[u.id] || 0) < g.upMax(p, u)).map((u) => g.upgradeCost(p, u)).sort((a, b) => a - b)[0]; };
  const upCount = (c) => Object.values(me(c).upgrades || {}).reduce((a, b) => a + b, 0);
  // 합성할 수 있는 1~5성 유닛 종류(없으면 null)
  const combinable = (c) => { const g = c.g, p = me(c); const u = g.units.find((x) => x.owner === p.idx && x.def.tier >= 1 && x.def.tier <= 5 && g.canCombine(p, x.def.id)); return u ? u.def : null; };
  const selUnits = (c) => c.g.units.filter((u) => c.S.sel.includes(u.id));
  const setupOpen = () => vis($('#setup'));
  const titleOn = () => { const t = $('#title'); return !!t && !t.hidden && t.style.display !== 'none'; };

  // ---------- 단계 ----------
  // k: 문구 키(또는 (c) => [키, 값]), at: 비출 곳(선택자 또는 함수), until: 해 보면 넘어가는 조건(없으면 '다음' 버튼),
  // hold: 시간 멈춤, when: 그 장면이 올 때까지 기다림, defer: 기다리는 동안 다음 단계를 먼저 진행해도 됨,
  // skip: 이미 지나간 장면이면 건너뜀, enter: 처음 보일 때 한 번, pos: 'top'이면 비출 곳 없을 때 위쪽에
  // until 단계는 오래 막히지 않게 20초가 지나면 '다음' 버튼을 보여 준다.
  const LOBBY = [
    { k: 'tut_l_hello', at: null },
    { k: () => [setupOpen() ? 'tut_l_wiz' : 'tut_l_battle'], at: () => (setupOpen() ? null : '#battlebtn'), pos: 'top', until: () => !titleOn(), noNext: true },
  ];
  // 상점 안내: 쉬움을 처음 클리어한 뒤 로비에서 한 번(또는 클리어했는데 첫 신화가 없을 때). 장수 해금 탭에서 첫 신화 2명을 연다.
  const LB = () => root.RTD_LOBBY || {};
  const SHOP = [
    { k: 'shop_open', at: '#lmenu [data-lp="shop"]', until: () => LB().panel && LB().panel() === 'shop', noNext: true },
    { k: 'shop_unlock', at: () => (vis($('#lpbody')) ? '#lpbody' : null), last: true, enter: () => gift(null) },
  ];
  const GAME = [
    { k: 'tut_hello', at: '#hud', hold: true },
    { k: 'tut_select', at: null, hold: true, until: (c) => c.S.sel.length > 0, noNext: true },
    // 고른 유닛이 실제로 움직이면 넘어간다(조이스틱이 안 보이면 = 선택이 풀리면 글만)
    { k: 'tut_move', at: () => (vis($('#joy')) ? '#joy' : null), until: (c, st) => moved(c, st), noNext: true,
      enter: (c, st) => { st.from = {}; c.g.units.forEach((u) => { if (u.owner === me(c).idx) st.from[u.id] = [u.x, u.y]; }); } },
    // 뽑기: 라운드가 끝날 때마다 랜덤 1성이 들어온다 → 다음 라운드가 오면 넘어감
    { k: 'tut_reward', at: '#hud', until: (c, st) => c.g.round > st.r0, noNext: true, enter: (c, st) => { st.r0 = c.g.round; } },
    // 합성: 같은 유닛이 모이면(자동이 꺼진 첫 판) 직접 합성해 본다
    { k: (c) => { const d = combinable(c); return ['tut_combine', { a: d ? d.name : '' }]; }, defer: true, hold: true,
      at: (c) => (selUnits(c).some((u) => c.g.canCombine(me(c), u.def.id)) && vis($('[data-act="combine"]')) ? '[data-act="combine"]' : null),
      when: (c) => !!combinable(c) || c.g.stats.combines > 0, until: (c) => c.g.stats.combines > 0, noNext: true },
    // 강화: 금화가 가장 싼 강화 값에 처음 닿으면
    { k: 'tut_upgrade', defer: true, hold: true,
      at: (c) => (c.S.drawer === 'upgrade' ? ($('#pane [data-act="up"]:not([disabled])') ? '#pane [data-act="up"]:not([disabled])' : '#pane') : '#rail [data-arg="upgrade"]'),
      when: (c) => upCount(c) > 0 || (cheapUp(c) != null && me(c).gold >= cheapUp(c)), until: (c) => upCount(c) > 0, noNext: true },
    // 조합법: 서랍을 열고 도감 탭으로
    { k: (c) => [c.S.drawer ? 'tut_book2' : 'tut_book'], hold: true, at: (c) => (c.S.drawer ? '#tabs [data-arg="book"]' : '#rail [data-arg="war"]'), until: (c) => !!c.S.drawer && c.S.tab === 'book', noNext: true },
    // 신화 조합법을 펼쳐 보여 준다
    { k: 'tut_myth', hold: true, at: (c, st) => { const b = $('#pane .bk'); if (!b) return '#pane'; if (!st._sc) { st._sc = 1; b.scrollIntoView({ block: 'start' }); } return '#pane .bk'; },
      enter: (c) => { const id = Object.keys(c.T.recipes).find((k) => (c.T.units.find((u) => u.id === k) || {}).tier === 9); if (id) c.S.book = id; if (c.dirty) c.dirty();
 } },
    { k: 'tut_auto', hold: true, at: '#rail [data-act="autoAll"]', until: (c) => ['t1', 't2', 't3'].every((k) => me(c).auto[k]), noNext: true,
      enter: (c) => { c.S.drawer = null; c.S.book = null; if (c.dirty) c.dirty(); } },
    { k: 'tut_mid', at: '#hud', hold: true, when: (c) => c.g.enemies.some((e) => e.mid), skip: (c) => c.g.round > 6 || (c.g.stats.midKill + c.g.stats.midMiss > 0 && !c.g.enemies.some((e) => e.mid)) },
    // 출전 고르기 화면을 놓쳤으면(이미 출전) 건너뛴다
    { k: 'tut_pick', at: '.over .sheet', when: (c) => c.g.phase === 'boss' && !!$('.over .sheet .pickcard'), until: () => !$('.over .sheet .pickcard'), skip: (c) => deployed(c), noNext: true },
    // 스킬이 없는 장수면 스킬 칸 대신 화면 가운데에 안내
    { k: 'tut_fight', at: () => (vis($('#skillbar')) ? '#skillbar' : null), hold: true, when: (c) => deployed(c) },
    // 첫 보스전이 끝나 라인으로 돌아오면 마무리
    { k: 'tut_end', at: null, hold: true, last: true, when: (c) => c.g.phase === 'wave' && (c.g.stats.bosses || []).length > 0 },
  ];
  // 판과 상관없이 처음 한 번씩 뜨는 팁
  const TIPS = [
    { key: 'rtd-tip-sage', k: 'tip_sage', at: '#rail [data-arg="sage"]',
      when: (c) => { const g = c.g, p = me(c); if (!g.sageMax() || g.sagesOf(p).length >= g.sageMax()) return false; const m = c.T.units.filter((d) => d.tier === 0 && !g.has(p, d.id)).map((d) => d.cost).sort((a, b) => a - b)[0]; return m != null && p.gold >= m; } },
    { key: 'rtd-tip-syn', k: 'tip_syn', at: () => (vis($('#synbar')) ? '#synbar' : null), when: (c) => Object.keys(me(c).syn || {}).length > 0 },
    // 선택권을 처음 받았을 때
    { key: 'rtd-tip-ticket', k: 'tip_ticket', at: '#rail [data-arg="ticket"]', when: (c) => !c.S.drawer && vis($('#rail')) && Object.values(me(c).tickets || {}).reduce((a, b) => a + b, 0) > 0 },
    // 배속: 단계 안내가 다 끝난 뒤, 몇 라운드 지나서
    { key: 'rtd-tip-speed', k: 'tip_speed', at: '#speedbtn', when: (c) => !steps.length && c.g.round >= 3 && vis($('#speedbtn')) },
    // 서랍의 각 탭을 처음 열었을 때 그 탭이 무엇인지 한 번씩. 강화·도감은 단계 안내가 이미 설명하므로 안내 중에는 본 것으로 친다
    tabTip('upgrade', true), tabTip('sage'), tabTip('ticket'), tabTip('book', true), tabTip('war'), tabTip('set'),
  ];
  function tabTip(k, covered) {
    const key = 'rtd-tip-tab-' + k;
    return { key, tab: true, k: 'tip_tab_' + k, at: `#tabs [data-arg="${k}"]`,
      when: (c) => { if (!c.S.drawer || c.S.tab !== k || !vis($('#pane'))) return false; if (covered && steps.length) { set(key, '1'); return false; } return true; } };
  }
  function moved(c, st) {
    return c.g.units.some((u) => { const f = st.from && st.from[u.id]; return f && c.S.sel.includes(u.id) && Math.hypot(u.x - f[0], u.y - f[1]) > 40; });
  }

  // ---------- 말풍선 ----------
  let ctx = null, mode = null, steps = [], stDone = [], raf = 0, shownKey = '', tip = null, cur = null, t = (k) => k;
  let box = null, ring = null;
  function ui() {
    if (box) return;
    ring = document.createElement('div'); ring.id = 'tutring'; ring.hidden = true;
    box = document.createElement('div'); box.id = 'tutbox'; box.hidden = true;
    box.innerHTML = '<div class="tt"></div><div class="tb"><button type="button" class="btn" data-tut="skip"></button><button type="button" class="btn go" data-tut="next"></button></div>';
    document.body.append(ring, box);
    // 말풍선 버튼은 게임의 data-act 처리와 따로 받는다
    box.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-tut]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      // 건너뛰기는 안내 전체를 끝내므로 한 번 누르면 '한 번 더'로 바뀌고, 3초 안에 다시 눌러야 끝낸다('다음' 바로 옆이라 잘못 누르기 쉽다)
      if (b.dataset.tut === 'skip') {
        if (b.dataset.armed) { delete b.dataset.armed; skipAll(); return; }
        b.dataset.armed = '1'; b.textContent = t('tut_skipAgain');
        setTimeout(() => { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = t('tut_skip'); } }, 3000);
      } else next();
    });
  }
  function hide() { if (box) { box.hidden = true; ring.hidden = true; } if (ctx && ctx.S) ctx.S.tutHold = false; shownKey = ''; }
  // 건너뛰기: 기록한다. 자동 배치는 켜 주지 않는다(기본은 끔, 전에 직접 켠 사람만 onSkip에서 다시 켜진다)
  function skipAll() {
    const c = ctx, inGame = mode === 'game';
    if (mode === 'shop') { shopEnd(); gift(null); return; }
    endTut();
    if (inGame && c && c.onSkip) c.onSkip();
  }
  function shopEnd() { set(SHOP_KEY, '1'); hide(); steps = []; stDone = []; cur = null; }
  function endTut() { mark(); hide(); steps = []; stDone = []; cur = null; if (mode !== 'game') stop(); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function next() {
    if (tip) { set(tip.key, '1'); tip = null; hide(); return; }
    if (!cur) return;
    const i = steps.indexOf(cur); stDone[i] = true; const wasLast = cur.last || stDone.every(Boolean);
    hide(); cur = null;
    if (mode === 'lobby') { if (stDone.every(Boolean)) steps = []; return; }
    if (wasLast && steps.length) { if (mode === 'shop') shopEnd(); else endTut(); }
  }

  function textOf(st) { const r = typeof st.k === 'function' ? st.k(ctx) : [st.k]; return r; }
  function place(st, isTip) {
    const sel = typeof st.at === 'function' ? st.at(ctx, st) : st.at, el = sel ? $(sel) : null, r = vis(el) ? el.getBoundingClientRect() : null;
    const [k, v] = textOf(st), key = k + JSON.stringify(v || {}) + (isTip ? 't' : '') + (st._late ? 'l' : '');
    if (shownKey !== key) {
      shownKey = key;
      box.querySelector('.tt').innerHTML = t(k, v);
      const nb = box.querySelector('[data-tut="next"]'), sb = box.querySelector('[data-tut="skip"]');
      nb.hidden = !isTip && !!st.noNext && !st._late; nb.textContent = t(isTip ? 'tut_ok' : st.last ? 'tut_done' : 'tut_next');
      sb.textContent = t('tut_skip'); sb.hidden = isTip || !!st.last; delete sb.dataset.armed;
    }
    box.hidden = false;
    const W = innerWidth, H = innerHeight, cs = getComputedStyle(document.documentElement);
    const SL = Math.max(12, parseFloat(cs.getPropertyValue('--sl')) || 0), SR = Math.max(12, parseFloat(cs.getPropertyValue('--sr')) || 0);
    const bw = Math.min(360, W - SL - SR);
    box.style.width = bw + 'px';
    box.classList.toggle('lobby', mode === 'lobby' || mode === 'shop');
    if (mode === 'lobby' && !r) {
      // 비출 곳이 없는 로비 말풍선(첫 인사, 전투 시작 창 안내): 첫 인사는 캐릭터 옆 왼쪽 가운데, 창 안내는 위쪽 가운데
      ring.hidden = true;
      const wiz = setupOpen(), mn = $('#lmenu'), mr = vis(mn) ? mn.getBoundingClientRect() : null;
      // 메뉴 왼쪽 끝 앞에서 끝나게(메뉴·이름표를 가리지 않음). 자리가 모자라면 폭을 줄인다
      if (!wiz && mr) { const w2 = Math.max(260, Math.min(bw, mr.left - SL - 12)); box.style.width = w2 + 'px'; box.style.left = Math.max(SL, mr.left - w2 - 12) + 'px'; }
      else box.style.left = (W - bw) / 2 + 'px';
      box.style.top = (wiz ? 10 : Math.max(60, H * 0.5 - box.offsetHeight / 2)) + 'px';
      return;
    }
    if (mode === 'lobby' && r) {
      // 출진 버튼: 버튼 왼쪽에 둔다(위에 두면 메뉴 이름표를 가린다)
      ring.hidden = false;
      Object.assign(ring.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
      const bh = box.offsetHeight;
      box.style.left = Math.max(SL, r.left - bw - 16) + 'px';
      box.style.top = Math.max(8, Math.min(H - bh - 8, r.top + r.height / 2 - bh / 2)) + 'px';
      return;
    }
    if (r) {
      ring.hidden = false;
      Object.assign(ring.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
      const bh = box.offsetHeight, below = r.bottom + 12 + bh < H - 8;
      let x = Math.min(W - bw - SR, Math.max(SL, r.left + r.width / 2 - bw / 2));
      let y = below ? r.bottom + 12 : Math.max(8, r.top - bh - 12);
      // 대상이 화면 높이를 거의 다 차지하면(서랍 등) 옆에 둔다
      if (!below && r.top - bh - 12 < 8) { y = Math.max(8, H / 2 - bh / 2); x = r.left > W / 2 ? Math.max(SL, r.left - bw - 12) : Math.min(W - bw - SR, r.right + 12); }
      box.style.left = x + 'px'; box.style.top = y + 'px';
    } else {
      ring.hidden = true;
      // 비출 곳이 없으면 아래쪽 가운데(지도 가운데 성채와 유닛을 가리지 않게). 위저드처럼 아래에 버튼이 있으면 위쪽
      box.style.left = (W - bw) / 2 + 'px';
      box.style.top = (st.pos === 'top' ? 10 : Math.max(12, H - box.offsetHeight - 14)) + 'px';
    }
  }

  // 지금 보일 단계: 끝나지 않았고, 앞의 단계가 모두 끝났거나 '기다려도 되는(defer)' 단계일 때
  function pick() {
    for (let i = 0; i < steps.length; i++) {
      if (stDone[i]) continue;
      const st = steps[i];
      if (st.skip && st.skip(ctx)) { stDone[i] = true; continue; }
      if (!st.when || st.when(ctx)) return st;
      if (!st.defer) return null;
    }
    return null;
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (gifting) { if (box && !box.hidden) hide(); return; }
    if (mode === 'lobby') {
      if (!titleOn() && !steps.length) { hide(); stop(); return; }
      if (vis($('#lpanel'))) { hide(); return; } // 메뉴 창이 열려 있으면 잠시 숨긴다
    } else if (mode === 'shop') {
      if (!titleOn()) { hide(); stop(); return; }
    } else {
      if (!ctx || !ctx.g) return;
      // 판이 끝났는데 안내가 남았으면 마친 것으로 친다(첫 신화와 연출은 로비로 돌아갔을 때)
      if (ctx.g.over) { if (steps.length) { mark(); steps = []; cur = null; } tip = null; hide(); return; }
    }
    if (!tip) {
      const st = steps.length ? pick() : null;
      if (st) {
        const i = steps.indexOf(st);
        if (st !== cur) { cur = st; st._t = now; st._late = false; if (st.enter) st.enter(ctx, st); }
        if (st.until && st.until(ctx, st)) { stDone[i] = true; cur = null; hide(); if (mode === 'lobby' && stDone.every(Boolean)) steps = []; return; }
        if (st.until && !st._late && mode !== 'lobby' && now - st._t > 20000) st._late = true; // 로비 단계에는 늦은 '다음'을 보이지 않는다
        if (mode === 'game') ctx.S.tutHold = !!st.hold;
        place(st);
        return;
      }
      if (cur) { cur = null; hide(); }
      // 팁: 안내 단계가 보이지 않을 때만, 판 안에서
      // 보스전(라운드 진행 중이 아닐 때)에는 팁을 띄우지 않는다: 경기장 가운데를 가린다
      if (mode === 'game' && !ctx.g.over && ctx.g.phase === 'wave' && !((ctx.S.vicUntil || 0) > performance.now())) tip = TIPS.find((x) => get(x.key) !== '1' && x.when(ctx)) || null;
    }
    if (tip && tip.tab && mode === 'game' && !tip.when(ctx)) { set(tip.key, '1'); tip = null; hide(); return; }
    // 떠 있던 팁도 보스전에 들어가면 접어 둔다(본 것으로 치지 않으므로 라운드로 돌아오면 다시 뜬다)
    if (tip && !tip.tab && mode === 'game' && ctx.g.phase !== 'wave') { tip = null; hide(); return; }
    if (tip) {
      if (mode === 'game') ctx.S.tutHold = !!ctx.S.saveOn;
      place(tip, true);
      return;
    }
    if (box && !box.hidden) hide();
  }
  function run() { ui(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }

  // 판을 시작할 때마다(17-loop). 아직 안 봤고 혼자 하는 오프라인 새 판이면 단계 안내, 아니어도 팁은 본다.
  // 돌려주는 값: 안내를 시작했는지(시작했으면 자동 배치를 꺼 둔 채로 둔다)
  function maybeStart(c) {
    ctx = c; mode = 'game'; t = c.t; tip = null; cur = null; shownKey = '';
    const on = !done() && c.tutorial !== false;
    steps = on ? GAME.map((s) => Object.assign({}, s)) : []; stDone = steps.map(() => false);
    run();
    return on;
  }
  // 로비에 들어올 때(19-title). 안내를 아직 안 봤으면 로비 안내, 봤으면 아직 못 받은 첫 신화를 받고 연출.
  function lobby(c) {
    ctx = c; mode = 'lobby'; t = c.t; tip = null; cur = null; shownKey = '';
    if (!done()) { steps = LOBBY.map((s) => Object.assign({}, s)); stDone = steps.map(() => false); run(); return; }
    const L = LB();
    if (L.shopOpen && L.shopOpen() && (get(SHOP_KEY) !== '1' || !L.hasStarter())) { mode = 'shop'; steps = SHOP.map((s) => Object.assign({}, s)); stDone = steps.map(() => false); run(); }
  }

  // ---------- 첫 신화 해금 연출 ----------
  let gifting = false;
  const loadJ = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || []; } catch (e) { return []; } };
  async function gift(c) {
    const L = root.RTD_LOBBY; if (!L || !L.grantStarter || gifting) return;
    let ids = [];
    try { ids = await L.grantStarter(); } catch (e) { ids = []; }
    // 이번에 새로 열지 않았어도(다른 곳에서 먼저 받음) 이 기기에서 연출을 아직 안 봤으면 보여 준다
    if (!ids || !ids.length) ids = get(GIFT_SEEN) === '1' ? [] : loadJ('rtd-starter');
    if (!ids.length) return;
    set(GIFT_SEEN, '1');
    reveal(ids, c);
  }
  function reveal(ids, c) {
    const T = (ctx && ctx.T) || root.RTD_THEME, Art = root.RTD_ART, tt = (ctx && ctx.t) || t;
    const defs = ids.map((id) => T.units.find((u) => u.id === id)).filter(Boolean);
    if (!defs.length || !Art) return;
    gifting = true; hide();
    if (c && c.S) c.S.tutHold = true;
    const wrap = document.createElement('div'); wrap.id = 'tutgift';
    wrap.innerHTML = `<canvas></canvas><div class="gh">${tt('gift_title')}</div><div class="gn">${defs.map((d, i) => `<span data-i="${i}"><b>${d.name}</b><small>${d.title || ''}</small></span>`).join('')}</div><div class="gs">${tt('gift_sub')}</div><button type="button" class="btn go">${tt('tut_ok')}</button>`;
    document.body.appendChild(wrap);
    const cv = wrap.querySelector('canvas'), cx = cv.getContext('2d'), dpr = Math.min(2, root.devicePixelRatio || 1);
    const imgs = defs.map((d) => { const im = new Image(); im.src = Art.portrait(d); return im; });
    const calm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const COL = '#ffcf5a', t0 = performance.now(), STEP = 0.75;
    let skipT = calm ? 99 : 0, rq = 0;
    const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    size(); addEventListener('resize', size);
    function frame(now) {
      rq = requestAnimationFrame(frame);
      const W = cv.width / dpr, H = cv.height / dpr, s = (now - t0) / 1000 + skipT, n = defs.length;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
      const R = Math.min(H * 0.24, W / (n * 2 + 1)), y = H * 0.47;
      defs.forEach((d, i) => {
        const x = W / 2 + (i - (n - 1) / 2) * Math.min(W * 0.34, R * 3.1), a0 = s - 0.35 - i * STEP;
        if (a0 < 0) return;
        const ap = Math.min(1, a0 / 0.45), ease = 1 - Math.pow(1 - ap, 3);
        // 뒤: 빛살 그림을 천천히 돌린다
        Art.fxPic(cx, 'ray_sun', x, y, R * 3.4, R * 3.4, calm ? 0 : s * 0.35 + i, 0.75 * ap, { col: COL });
        // 등장 순간: 터짐 프레임 애니메이션 한 번
        if (a0 < 0.7) Art.fxAnim(cx, 'fxa_burst', a0 / 0.7, x, y, R * 3, R * 3, 0, 1 - a0 / 0.9, null, { col: COL });
        // 초상: 크게 들어와 제자리에
        const im = imgs[i], k = 1.35 - 0.35 * ease, sz = R * 1.9 * k;
        if (im.complete && im.naturalWidth) { cx.save(); cx.globalAlpha = ap; cx.drawImage(im, x - sz / 2, y - sz / 2, sz, sz); cx.restore(); }
        // 둘레의 별 그림이 반짝인다
        for (let j = 0; j < 5; j++) {
          const ang = j * 1.257 + i, rr = R * (1.05 + 0.12 * (j % 2)), tw = calm ? 0.8 : 0.5 + 0.5 * Math.sin(s * 3 + j * 1.7);
          Art.fxPic(cx, 'pic_star', x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.9, R * 0.22, R * 0.21, 0, ap * tw, { col: COL });
        }
        const lab = wrap.querySelector(`.gn span[data-i="${i}"]`); if (lab && ap >= 1 && !lab.classList.contains('on')) { lab.classList.add('on'); lab.style.left = x + 'px'; }
        if (lab) lab.style.left = x + 'px';
      });
      if (s > 0.35 + n * STEP) wrap.classList.add('ready');
    }
    rq = requestAnimationFrame(frame);
    // 아무 곳이나 누르면 연출을 끝 장면으로 건너뛴다. 끝 장면에서 확인을 누르면 닫는다.
    wrap.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!wrap.classList.contains('ready')) { skipT = 99; return; }
      if (!e.target.closest('.btn')) return;
      cancelAnimationFrame(rq); removeEventListener('resize', size); wrap.remove(); gifting = false;
      if (c && c.S) c.S.tutHold = false;
      if (titleOn() && root.RTD_LOBBY && root.RTD_LOBBY.refresh) root.RTD_LOBBY.refresh();
    });
  }
  root.RTD_TUT = { maybeStart, lobby, reset, done };
})(typeof window !== 'undefined' ? window : globalThis);
