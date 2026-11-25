  // ---- 입력 ----
  const toWorld = (e) => { const r = view.getBoundingClientRect(); return { x: (((e.clientX - r.left) / r.width) * view.width - S.ox) / S.scale, y: (((e.clientY - r.top) / r.height) * view.height - S.oy) / S.scale }; };
  const unitAt = (x, y) => { let best = null, bd = S.coarse ? 52 : 38; g.units.forEach((u) => { if (u.owner !== 0) return; const d = dist(u.x, u.y, x, y); if (d < bd) { bd = d; best = u; } }); return best; };
  // 누른 자리에서 가장 가까운 상자·아이템(거리가 같으면 위에 그려진, 나중에 생긴 것). 터치는 손가락 크기에 맞게 범위를 넓힌다.
  const dropAt = (x, y) => {
    const rx = S.coarse ? 56 : 24, ry = S.coarse ? 52 : 22;
    let best = null, bd = Infinity;
    g.drops.forEach((d) => { if (d.owner !== 0 || Math.abs(d.x - x) >= rx || Math.abs(d.y - y) >= ry) return; const dd = dist(d.x, d.y, x, y); if (dd <= bd) { bd = dd; best = d; } });
    return best;
  };
  // 터치에서 손가락이 이만큼(화면 px) 움직이기 전까지는 탭으로 본다
  const TOUCH_SLOP = 18, MOUSE_SLOP = 10, JOY_SLOP = 8; // JOY_SLOP: 라인 떠 있는 조이스틱이 생기는 끌기 거리(짧게 — 누르자마자 밀어도 방향이 살게)
  const enemyAt = (x, y) => g.enemies.find((e) => dist(e.x, e.y, x, y) < e.r + 12);
  // 보스전 중에도 Tab으로 내 라인 화면에 와서 선택권·조합·강화를 할 수 있다. 그동안 결투 시간은 그대로 흐른다.
  const inBoss = () => g && g.phase === 'boss' && !S.laneView;
  // 보스 처치 연출(S.kill, 07-arena) 동안은 판이 이미 라인으로 넘어갔어도 결투장을 그리므로 라인 화면으로 치지 않는다
  // (라인 버튼 열·인연 줄·선택 바·조이스틱이 연출 위로 먼저 돌아오고, 보이지 않는 라인을 누르게 되던 것)
  const laneOn = () => g && !S.kill && (g.phase === 'wave' || (g.phase === 'boss' && !!S.laneView));
  // 협동에서 라이프가 다해 탈락한 뒤(관전): 동료 전장 보기·화면 끌기만 되고 내 라인·장수 조작은 막는다(engine.js eliminate)
  const spect = () => !!(g && g.out && !g.over);
  view.addEventListener('contextmenu', (e) => e.preventDefault());
  // 게임 중에는 화면 어디서든(패널·버튼·스킬 막대·팝업) 브라우저 우클릭 메뉴를 막는다. 글자 입력칸은 그대로 둔다.
  window.addEventListener('contextmenu', (e) => { if (g && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); });
  // ---- 카메라: 손가락·휠로 확대하고 끌어서 움직인다 ----
  const zoomAt = (cx, cy, nz) => {
    const before = toWorld({ clientX: cx, clientY: cy });
    S.cam.z = nz; applyCam();
    const after = toWorld({ clientX: cx, clientY: cy });
    S.cam.x += before.x - after.x; S.cam.y += before.y - after.y; applyCam();
    S.camHold = performance.now() + 2500;
  };
  const panBy = (sx, sy, dx, dy) => { const k = S.base.s0 * S.cam.z; S.cam.x = sx - dx / k; S.cam.y = sy - dy / k; applyCam(); S.camHold = performance.now() + 2500; };
  // 터치 기기는 확대·축소를 막는다(가장 축소한 화면으로 고정). 마우스 휠 확대는 PC에서만.
  view.addEventListener('wheel', (e) => { if (!g) return; e.preventDefault(); if (S.coarse) return; zoomAt(e.clientX, e.clientY, S.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  const ptrs = new Map();
  let pinch = null, touch = null;
  const cancelTouch = () => { if (touch && touch.lp) clearTimeout(touch.lp); touch = null; };
  // 터치 한 번(움직이지 않고 뗌): 선택·이동·상자 열기
  // 오른쪽 서랍이 열린 채 전장을 탭하면(끌기·범위 선택이 아닌 짧은 탭·클릭) 서랍을 닫는다(2026-11-26 실기 소감).
  // 탭은 원래 할 일(고르기·선택 해제·상자 열기)도 그대로 한다 — 선택권 창 바깥 누름(12-panels)과 같은 규칙. 서랍 안은 DOM이라 여기로 오지 않는다.
  const drawerTapClose = () => { if (S.drawer) { S.drawer = null; dirty(); } };
  function tapAt(m, e) {
    drawerTapClose();
    if (inBoss()) {
      const l = g.localChamps(), i = l.findIndex((c) => !c.dead && dist(c.x, c.y, m.x, m.y) < 50);
      if (i >= 0) g.selectChamp(i);
      // 터치로는 이동하지 않는다(이동은 조이스틱). 적을 톡 치면 그 적을 노리기만 한다.
      else if (g.active()) { const tg = g.foeAt(m.x, m.y); if (tg != null) g.active().tgt = tg; }
      dirty(); return;
    }
    if (!laneOn()) return;
    const vp = viewedPeer();
    if (vp) {
      let best = null, bd = 44;
      (S.remoteHits || []).forEach((h) => { const dd = dist(h.x, h.y, m.x, m.y); if (dd < bd) { bd = dd; best = h; } });
      S.rsel = best ? { peer: vp.id, id: best.id, d: best.d, atk: best.atk } : null;
      dirty(); return;
    }
    if (spect()) return;
    if (S.cmdMode === 'use') {
      const d = g.drops.find((x) => x.id === S.dropSel), u = unitAt(m.x, m.y);
      const n = g.useDrop(g.me, d, u);
      if (n) { setSel([n.id]); S.dropSel = null; } else toast(I.t('cantUse'), 'warn');
      setMode(null); return;
    }
    if (S.cmdMode) { rightClick(m, S.cmdMode); setMode(null); return; }
    // 상자 범위가 넓어서 상자 옆 유닛을 누를 수도 있다: 둘 다 걸리면 누른 자리에 더 가까운 쪽을 고른다(상자 열기는 되돌릴 수 없다)
    let drop = dropAt(m.x, m.y);
    if (drop) { const u0 = unitAt(m.x, m.y); if (u0 && dist(u0.x, u0.y, m.x, m.y) < dist(drop.x, drop.y, m.x, m.y)) drop = null; }
    if (drop) {
      if (drop.kind === 'chest') { const out = g.openChest(g.me, drop); S.dropSel = out ? out.id : null; S.sel = []; }
      else { S.dropSel = drop.id; S.sel = []; }
      dirty(); return;
    }
    const u = unitAt(m.x, m.y);
    if (u) {
      S.dropSel = null;
      const now = performance.now();
      // 같은 유닛을 두 번 톡 치면 그 유닛 전부 선택
      if (now - S.lastClick.t < 360 && S.lastClick.id === u.def.id) setSel(g.units.filter((o) => o.owner === 0 && o.def.id === u.def.id).map((o) => o.id));
      else setSel([u.id]);
      S.lastClick = { t: now, id: u.def.id };
      return;
    }
    const f = g.phase === 'wave' ? flagAt(e) : null;
    if (f) { showFlag(f, e); return; } // 다른 곳을 누를 때까지 띄워 둔다(아래 pointerdown에서 닫는다)
    // 빈 곳: 터치는 유닛을 톡 쳐서 옮기지 않는다(고르면 뜨는 조이스틱으로 움직인다). 고른 상자·아이템만 빈 곳을 쳐서 옮긴다.
    // 유닛을 고른 상태면 선택을 풀고 선택 바·상세 카드를 내린다(2026-11-25 실기 소감: X 버튼으로만 닫히던 것. 마우스 클릭은 원래 풀렸다).
    // 끌기와는 손가락이 TOUCH_SLOP 안에서 떨어졌을 때만 여기로 오는 것으로 가른다(아래 pointermove).
    if (S.dropSel && !S.sel.length) rightClick(m, 'amove');
    else if (S.sel.length) { setSel([]); S.ucard = false; }
  }
  function boxSelect(d) {
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    S.dropSel = null;
    const ids = g.units.filter((u) => u.owner === 0 && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1).map((u) => u.id);
    setSel(d.add ? [...new Set(S.sel.concat(ids))] : ids);
  }
  view.addEventListener('pointerdown', (e) => {
    if (!g) return;
    // 신화·불멸 등장 컷신: 섬광(3.3초)이 지난 뒤 화면을 누르면 넘긴다. 멈춘 시간도 남은 만큼 덜어 낸다.
    const pp = S.pop;
    if (pp && pp.def && pp.def.tier >= 9 && !pp.skip && pp.t > 3.3 && pp.dur - pp.t > 0.4) {
      const cut = pp.dur - pp.t - 0.3; pp.skip = 1; pp.dur = pp.t + 0.3;
      if (S.freeze > 0) S.freeze = Math.max(0, S.freeze - cut);
      return;
    }
    if (inBoss()) {
      // 딜미터를 누르면 펼치고 접는다(05-lane drawMeter)
      if (e.button !== 2 && meterHit(e)) { S.meterOpen = !S.meterOpen; Snd.play('click', 40); return; }
      // 떠 있는 조이스틱: 화면 왼쪽 아래 영역을 누르면 그 자리에 조이스틱이 생긴다(15-pad). 이 손가락은 아래 탭·끌기 처리에 넣지 않는다
      if (e.pointerType === 'touch' && joyZone(e)) { e.preventDefault(); joyStart(e, true); return; }
    }
    view.focus({ preventScroll: true });
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { view.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    // 두 손가락: 확대·이동
    if (ptrs.size === 2) {
      cancelTouch(); S.drag = null;
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: S.cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    const m = toWorld(e); S.mouse = m;
    // 마우스 가운데 버튼: 지도 끌기
    if (e.button === 1) { e.preventDefault(); S.pan = { x: e.clientX, y: e.clientY, cx: S.cam.x, cy: S.cam.y }; return; }
    if (e.pointerType === 'touch') {
      // 라인 떠 있는 조이스틱(2026-11-25): 유닛을 골라 조이스틱이 보이는 동안 왼쪽 아래 영역(15-pad JOY_ZONE)의 빈 땅을 누르고 끌면
      // 누른 자리에 조이스틱이 생긴다(아래 pointermove). 끌지 않고 떼면 빈 곳 탭(선택 해제). 유닛·상자 위를 누르면 원래대로 고르기.
      const jz = PAD.lane && !S.cmdMode && !viewedPeer() && !spect() && joyZone(e) && !unitAt(m.x, m.y) && !dropAt(m.x, m.y);
      touch = { id: e.pointerId, x: e.clientX, y: e.clientY, m, mode: null, cx: S.cam.x, cy: S.cam.y, joy: jz };
      // 꾹 누르고 있으면 범위 선택으로 바뀐다
      if (laneOn() && !viewedPeer() && !spect() && !S.cmdMode) touch.lp = setTimeout(() => {
        if (touch && !touch.mode) { touch.mode = 'box'; S.drag = { x0: m.x, y0: m.y, x1: m.x, y1: m.y, moved: true, add: false }; if (navigator.vibrate) navigator.vibrate(12); }
      }, 380);
      return;
    }
    // ---- 마우스(PC): 기존 조작 ----
    if (inBoss()) {
      if (e.button === 2) { const tg = g.foeAt(m.x, m.y); if (tg != null) g.arenaChase(tg); else g.arenaMove(m.x, m.y, false); }
      else if (S.cmdMode === 'amove') { g.arenaChase(); setMode(null); }
      else if (S.cmdMode === 'move') { g.arenaMove(m.x, m.y, false); setMode(null); }
      else {
        const l = g.localChamps(), i = l.findIndex((c) => !c.dead && dist(c.x, c.y, m.x, m.y) < 40);
        if (i >= 0) g.selectChamp(i); else g.selectChamp(null);
        drawerTapClose();
        dirty();
      }
      return;
    }
    if (!laneOn()) return;
    if (viewedPeer()) { if (e.button === 0) tapAt(m, e); return; }
    if (spect()) return;
    if (e.button === 2) { rightClick(m); return; }
    if (S.cmdMode) { tapAt(m, e); return; }
    S.drag = { x0: m.x, y0: m.y, x1: m.x, y1: m.y, moved: false, add: e.shiftKey };
  });
  view.addEventListener('pointermove', (e) => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (!S.coarse) zoomAt(pinch.mx, pinch.my, pinch.z * (d / pinch.d));
      const k = S.base.s0 * S.cam.z; S.cam.x -= (mx - pinch.mx) / k; S.cam.y -= (my - pinch.my) / k; applyCam();
      pinch.mx = mx; pinch.my = my; pinch.z = S.cam.z; pinch.d = d;
      return;
    }
    if (S.pan) { panBy(S.pan.cx, S.pan.cy, e.clientX - S.pan.x, e.clientY - S.pan.y); return; }
    const m = toWorld(e); S.mouse = m;
    if (touch && e.pointerId === touch.id) {
      const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
      if (touch.mode === 'box') { S.drag.x1 = m.x; S.drag.y1 = m.y; return; }
      // 떠 있는 조이스틱: 처음 누른 자리를 중심으로 받침을 세우고 이 손가락을 조이스틱에 넘긴다(이 뒤 움직임·뗌은 15-pad가 창에서 받는다)
      if (!touch.mode && touch.joy && Math.hypot(dx, dy) > JOY_SLOP) {
        const t0 = touch; cancelTouch(); ptrs.delete(e.pointerId);
        joyStart({ pointerId: e.pointerId, clientX: t0.x, clientY: t0.y }, true); joyMove(e);
        return;
      }
      if (!touch.mode && Math.hypot(dx, dy) > (S.coarse ? TOUCH_SLOP : MOUSE_SLOP)) { touch.mode = 'pan'; if (touch.lp) clearTimeout(touch.lp); }
      if (touch.mode === 'pan') panBy(touch.cx, touch.cy, dx, dy);
      return;
    }
    if (g && e.pointerType !== 'touch') showFlag(g.phase === 'wave' && !S.drag ? flagAt(e) : null, e);
    if (S.drag) { S.drag.x1 = m.x; S.drag.y1 = m.y; if (dist(S.drag.x0, S.drag.y0, m.x, m.y) > 10) S.drag.moved = true; }
  });
  view.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') $('achpop').hidden = true; });
  // 터치로 띄운 업적 설명은 화면 어디든 다시 누르면 닫힌다(같은 깃발이나 다른 깃발을 누르면 손을 뗄 때 다시 뜬다)
  // 동료 목록(「同盟 n」)은 바깥을 누르면 닫는다
  document.addEventListener('pointerdown', (e) => { if (S.allyOpen && !(e.target.closest && e.target.closest('#hud .party.fold'))) S.allyOpen = false; }, true);
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !$('achpop').hidden && !$('achpop').contains(e.target)) $('achpop').hidden = true; }, true); // 인연 창은 안을 눌러 스크롤할 수 있다
  const endPtr = (e) => {
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) { pinch = null; cancelTouch(); } return; }
    if (S.pan) { S.pan = null; return; }
    if (!g) return;
    if (touch && e.pointerId === touch.id) {
      const t = touch; cancelTouch();
      if (t.mode === 'box') { const d = S.drag; S.drag = null; if (d) boxSelect(d); }
      else if (!t.mode) tapAt(t.m, e);
      return;
    }
    const d = S.drag; S.drag = null;
    if (!d) return;
    if (d.moved) { boxSelect(d); return; }
    drawerTapClose(); // 마우스 클릭(끌지 않음)
    const drop = dropAt(d.x0, d.y0);
    if (drop) {
      if (drop.kind === 'chest') { const out = g.openChest(g.me, drop); S.dropSel = out ? out.id : null; S.sel = []; dirty(); }
      else { S.dropSel = drop.id; S.sel = []; dirty(); }
      return;
    }
    S.dropSel = null;
    const u = unitAt(d.x0, d.y0);
    if (!u) { if (!d.add) setSel([]); return; }
    const now = performance.now();
    if ((now - S.lastClick.t < 320 && S.lastClick.id === u.def.id) || e.ctrlKey) setSel(g.units.filter((o) => o.owner === 0 && o.def.id === u.def.id).map((o) => o.id));
    else if (d.add) setSel(S.sel.includes(u.id) ? S.sel.filter((i) => i !== u.id) : S.sel.concat(u.id));
    else setSel([u.id]);
    S.lastClick = { t: now, id: u.def.id };
  };
  view.addEventListener('pointerup', endPtr);
  view.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); pinch = null; cancelTouch(); S.drag = null; S.pan = null; });
  function rightClick(m, mode) {
    if (spect()) return;
    // 상자·아이템을 고른 상태면 그것을 옮긴다
    const drop = !S.sel.length && S.dropSel && g.drops.find((d) => d.id === S.dropSel);
    if (drop) { g.moveDrop(g.me, drop, m.x, m.y); S.pings.push({ x: m.x, y: m.y, t: 0, c: '#7dff8e' }); return; }
    if (mode === 'amove') { g.cmd('amove', S.sel, m.x, m.y); S.pings.push({ x: m.x, y: m.y, t: 0, c: '#ff7a60' }); }
    else { g.cmd('move', S.sel, m.x, m.y); S.pings.push({ x: m.x, y: m.y, t: 0, c: '#7dff8e' }); }
  }
  function setMode(m) { S.cmdMode = m; $('stage').classList.toggle('targeting', !!m); dirty(); }
  function setSel(ids) { S.sel = ids; dirty(); }
  const selUnits = () => { S.sel = S.sel.filter((id) => g.units.some((u) => u.id === id)); return S.sel.map((id) => g.units.find((u) => u.id === id)); };
