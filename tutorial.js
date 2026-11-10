// 첫 오프라인 판 안내. 실제 화면 요소를 비추고 말풍선으로 설명한다. 건너뛸 수 있고, 설정에서 다시 볼 수 있다.
// 설명하는 동안(hold)은 게임 시간이 멈춘다(S.tutHold). 끝나거나 건너뛰면 localStorage 'rtd-tut'에 기록한다.
(function (root) {
  const KEY = 'rtd-tut';
  const done = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } };
  const mark = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* 저장 불가 */ } };
  const reset = () => { try { localStorage.removeItem(KEY); } catch (e) { /* 저장 불가 */ } };
  const $ = (s) => document.querySelector(s);
  const vis = (el) => el && !el.hidden && el.getClientRects().length > 0;
  const deployed = (c) => c.g.phase === 'boss' && !!c.g.fight && c.g.localChamps().length > 0;

  // 단계: 비출 곳(at), 문구 키(k), 다음으로 넘어가는 조건(until, 없으면 '다음' 버튼), 시간 멈춤(hold), 시작 조건(when)
  const STEPS = [
    { k: 'tut_hello', at: '#hud', hold: true },
    { k: 'tut_select', at: null, hold: true, until: (c) => c.S.sel.length > 0, noNext: true },
    { k: 'tut_selbar', at: '#selbar', hold: true },
    { k: 'tut_move', at: null, hold: true },
    { k: 'tut_upgrade', at: '#rail [data-arg="upgrade"]', hold: true },
    { k: 'tut_auto', at: '#rail [data-act="autoAll"]', hold: true },
    { k: 'tut_ticket', at: '#rail [data-arg="ticket"]', hold: true },
    { k: 'tut_go', at: null, hold: true },
    { k: 'tut_mid', at: '#hud', hold: true, when: (c) => c.g.enemies.some((e) => e.mid) },
    // 출전 고르기 화면을 놓쳤으면(이미 출전) 건너뛴다
    { k: 'tut_pick', at: '.over .sheet', hold: false, when: (c) => c.g.phase === 'boss' && !!$('.over .sheet .pickcard'), until: (c) => !$('.over .sheet .pickcard'), skip: (c) => deployed(c), noNext: true },
    // 스킬이 없는 장수면 스킬 칸 대신 화면 가운데에 안내
    { k: 'tut_fight', at: () => (vis($('#skillbar')) ? '#skillbar' : null), hold: true, when: (c) => deployed(c) },
    { k: 'tut_end', at: null, hold: true },
  ];

  let ctx = null, i = -1, box = null, ring = null, raf = 0, shownKey = '';
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
      if (b.dataset.tut === 'skip') finish(); else advance();
    });
  }
  function hide() { if (box) { box.hidden = true; ring.hidden = true; } if (ctx) ctx.S.tutHold = false; shownKey = ''; }
  function finish() { mark(); hide(); cancelAnimationFrame(raf); ctx = null; i = STEPS.length; }
  function advance() { hide(); i++; if (i >= STEPS.length) finish(); }

  function place(st) {
    const t = ctx.t, sel = typeof st.at === 'function' ? st.at(ctx) : st.at, el = sel ? $(sel) : null, r = vis(el) ? el.getBoundingClientRect() : null;
    if (shownKey !== st.k) {
      shownKey = st.k;
      box.querySelector('.tt').innerHTML = t(st.k);
      const nb = box.querySelector('[data-tut="next"]');
      nb.hidden = !!st.noNext; nb.textContent = t(i === STEPS.length - 1 ? 'tut_done' : 'tut_next');
      box.querySelector('[data-tut="skip"]').textContent = t('tut_skip');
      box.querySelector('[data-tut="skip"]').hidden = i === STEPS.length - 1;
    }
    box.hidden = false;
    const W = innerWidth, H = innerHeight, bw = Math.min(360, W - 24);
    box.style.width = bw + 'px';
    if (r) {
      ring.hidden = false;
      Object.assign(ring.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
      const bh = box.offsetHeight, below = r.bottom + 12 + bh < H - 8;
      let x = Math.min(W - bw - 12, Math.max(12, r.left + r.width / 2 - bw / 2));
      let y = below ? r.bottom + 12 : Math.max(8, r.top - bh - 12);
      // 대상이 화면 높이를 거의 다 차지하면(서랍 등) 옆에 둔다
      if (!below && r.top - bh - 12 < 8) { y = Math.max(8, H / 2 - bh / 2); x = r.left > W / 2 ? Math.max(12, r.left - bw - 12) : Math.min(W - bw - 12, r.right + 12); }
      box.style.left = x + 'px'; box.style.top = y + 'px';
    } else {
      ring.hidden = true;
      // 비출 곳이 없으면 아래쪽 가운데(지도 가운데 성채와 유닛을 가리지 않게)
      box.style.left = (W - bw) / 2 + 'px'; box.style.top = Math.max(12, H - box.offsetHeight - 14) + 'px';
    }
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!ctx || !ctx.g) return;
    if (ctx.g.over) { hide(); return; }
    const st = STEPS[i]; if (!st) return;
    if (st.skip && st.skip(ctx)) { advance(); return; }
    if (st.when && !st.when(ctx)) { hide(); return; } // 그 장면이 올 때까지 기다린다
    if (st.until && st.until(ctx)) { advance(); return; }
    ctx.S.tutHold = !!st.hold;
    place(st);
  }

  // 혼자 하는 오프라인 새 판에서, 아직 안 봤으면 시작
  function maybeStart(c) {
    if (done()) return false;
    ui(); ctx = c; i = 0; shownKey = '';
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    return true;
  }
  root.RTD_TUT = { maybeStart, reset, done };
})(typeof window !== 'undefined' ? window : globalThis);
