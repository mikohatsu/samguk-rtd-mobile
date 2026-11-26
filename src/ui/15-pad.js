  // ---- 보스전 직접 조작(모바일 MOBA식) ----
  // 왼쪽 조이스틱으로 이동, 오른쪽 아래 공격 버튼을 누르고 있는 동안 공격(자동 공격 없음).
  // 조이스틱은 떠 있는 방식: 보스전에서 화면 왼쪽 아래 영역(JOY_ZONE) 어디든 누르면 그 자리에 받침이 생기고,
  // 끄는 거리(JOY_R)를 넘어가면 받침이 손가락을 따라온다. 손을 떼면 기본 자리(CSS, 희미하게)로 돌아간다.
  // 라인(유닛을 고르면 뜨는 조이스틱)도 같다(2026-11-25): 영역의 빈 땅을 누르고 끌면 그 자리에 생긴다(탭은 선택 해제라 끌 때 생긴다, 10-input).
  // 스킬·이동기는 공격 버튼을 둘러싼 '고양이 발' 배치. 짧게 톡 = 사거리 안의 적에게 자동 조준(밖이면 보는 방향),
  // 꾹 누르고 끌면 장수 둘레에 사거리와 범위가 보이고 끈 방향·거리로 조준해 손을 떼면 쓴다.
  const PAD = { atk: null, aim: null, joy: null, jv: null, buf: null };
  const AIM_HOLD = 220, AIM_DRAG = 80;
  function skillInfo(c, k) {
    if (k === 'dash') return { range: 280, shape: 'dash', w: 44 };
    const s = (c.def.sk || [])[+k];
    if (!s) return null;
    if (s.k === 'line') return { range: s.len, shape: 'line', w: s.w };
    if (s.k === 'cone') return { range: s.r, shape: 'cone', arc: s.arc };
    if (s.k === 'circle') return { range: s.range || 0, shape: 'circle', r: s.r };
    return { range: 0, shape: 'self' };
  }
  // 짧게 눌렀을 때: 사거리 안에 적이 있으면 그 적, 없으면 보는 방향으로
  // 이동기는 피하는 수단이라 적에게 붙지 않는다: 조이스틱을 밀고 있으면 그 방향, 아니면 보는 방향으로 최대 거리
  function autoTarget(c, info) {
    if (info.shape === 'dash') {
      const j = PAD.jv, a = j && Math.hypot(j.x, j.y) > 0.1 ? Math.atan2(j.y, j.x) : (c.face ?? 0);
      return { x: c.x + Math.cos(a) * info.range, y: c.y + Math.sin(a) * info.range };
    }
    const fo = g.champFoe(c) || (g.fight && g.fight.boss), reach = info.shape === 'circle' && !info.range ? info.r : info.range;
    if (fo && (info.shape === 'self' || dist(c.x, c.y, fo.x, fo.y) <= reach + 60)) return { x: fo.x, y: fo.y };
    const a = c.face ?? 0, r = Math.max(info.range, 120);
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  }
  // 끌어서 조준: 버튼에서 끈 방향이 쏘는 방향, 끈 거리(최대 AIM_DRAG px)가 사거리 비율
  function aimTarget(c, info, A) {
    const len = Math.hypot(A.dx, A.dy);
    if (len < 14) return autoTarget(c, info);
    const k = Math.min(1, len / AIM_DRAG), r = info.shape === 'circle' ? info.range * k : Math.max(info.range, 120);
    return { x: c.x + (A.dx / len) * Math.max(r, info.shape === 'circle' ? 0 : 30), y: c.y + (A.dy / len) * Math.max(r, info.shape === 'circle' ? 0 : 30) };
  }
  // 스킬·이동기는 지금 고른 장수(g.active())가 쓴다 — 입력 명령(g.input)으로 넣어 기록에 남긴다(2026-11-26 재연산 검증)
  function castAt(c, k, x, y) {
    if (S.stay || c !== g.active()) return;
    if (k === 'dash') g.input('ds', [x, y]);
    else g.input('sk', [+k, x, y]);
  }
  // 재사용이 거의 끝났을 때(BUF_EARLY초 이하) 누른 것은 버리지 않고 BUF_KEEP ms 동안 들고 있다가 끝나는 순간 쓴다(선입력)
  const BUF_EARLY = 0.25, BUF_KEEP = 300;
  const cdLeft = (c, k) => (k === 'dash' ? c.dashCd : c.skillCd[+k]) || 0;
  // 조준값은 떼는 순간의 것을 쓴다. 톡(자동 조준)은 쓰는 순간 다시 고른다.
  function fireAim(c, A) {
    const info = skillInfo(c, A.k);
    if (!info) return;
    const tg = A.on ? aimTarget(c, info, A) : autoTarget(c, info);
    castAt(c, A.k, tg.x, tg.y);
  }
  function drawAim(c) {
    const A = PAD.aim, ch = g.active();
    if (!A || !ch) return;
    if (!A.on && performance.now() - A.t0 > AIM_HOLD) A.on = true;
    if (!A.on) return;
    const info = skillInfo(ch, A.k);
    if (!info) return;
    const tg = aimTarget(ch, info, A), a = Math.atan2(tg.y - ch.y, tg.x - ch.x);
    c.save();
    // 사거리(장수 둘레)
    const rr = info.range || (info.shape === 'circle' ? info.r : 90);
    c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeStyle = 'rgba(150,205,255,.85)'; c.fillStyle = 'rgba(120,180,255,.08)';
    c.beginPath(); c.arc(ch.x, ch.y, rr, 0, 7); c.fill(); c.stroke(); c.setLineDash([]);
    // 맞는 범위
    c.fillStyle = 'rgba(255,205,110,.3)'; c.strokeStyle = 'rgba(255,225,150,.95)'; c.lineWidth = 2.5;
    if (info.shape === 'line' || info.shape === 'dash') {
      const L = info.shape === 'dash' ? Math.min(info.range, Math.max(30, dist(ch.x, ch.y, tg.x, tg.y))) : info.range;
      c.translate(ch.x, ch.y); c.rotate(a); c.beginPath(); c.rect(0, -info.w / 2, L, info.w); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(L + 18, 0); c.lineTo(L, -12); c.lineTo(L, 12); c.closePath(); c.fillStyle = 'rgba(255,225,150,.9)'; c.fill();
    } else if (info.shape === 'cone') {
      c.beginPath(); c.moveTo(ch.x, ch.y); c.arc(ch.x, ch.y, info.range, a - info.arc / 2, a + info.arc / 2); c.closePath(); c.fill(); c.stroke();
    } else if (info.shape === 'circle') {
      const px = info.range ? tg.x : ch.x, py = info.range ? tg.y : ch.y;
      c.beginPath(); c.arc(px, py, info.r, 0, 7); c.fill(); c.stroke();
    }
    c.restore();
  }
  function padInit() {
    const bar = $('skillbar'), joy = $('joy');
    if (!bar || bar._pad) return;
    bar._pad = true;
    bar.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-sk]'), c = g && g.active();
      if (!b || (!c && !PAD.lane)) return;
      e.preventDefault(); e.stopPropagation();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      const k = b.dataset.sk;
      if (k === 'atk') { PAD.atk = e.pointerId; if (c && !PAD.lane && !g.over) padSend(); b.classList.add('on'); return; }
      if (!c) return;
      if (k === 'heal') { g.input('hl', []); return; }
      // 버튼의 data-cd는 화면 갱신(180ms) 때만 바뀌므로 엔진의 남은 재사용 시간을 직접 본다
      if (cdLeft(c, k) > BUF_EARLY) return;
      const r = b.getBoundingClientRect();
      PAD.aim = { id: e.pointerId, k, cx: r.left + r.width / 2, cy: r.top + r.height / 2, t0: performance.now(), dx: 0, dy: 0, on: false, el: b };
      b.classList.add('on');
    });
    bar.addEventListener('pointermove', (e) => {
      const A = PAD.aim;
      if (!A || A.id !== e.pointerId) return;
      A.dx = e.clientX - A.cx; A.dy = e.clientY - A.cy;
      if (Math.hypot(A.dx, A.dy) > 14) A.on = true;
    });
    const up = (e) => {
      if (PAD.atk === e.pointerId) { PAD.atk = null; bar.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); return; }
      const A = PAD.aim;
      if (!A || A.id !== e.pointerId) return;
      PAD.aim = null; A.el.classList.remove('on');
      const c = g && g.active(), info = c && skillInfo(c, A.k);
      if (!info || e.type === 'pointercancel') return;
      if (cdLeft(c, A.k) > 0) { PAD.buf = { A, uid: c.uid, until: performance.now() + BUF_KEEP }; return; }
      PAD.buf = null;
      fireAim(c, A);
      dirty();
    };
    bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    // 조이스틱 받침을 직접 누름: 터치는 누른 자리가 중심(떠 있는 방식), 마우스는 받침 가운데가 중심
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      joyStart(e, e.pointerType === 'touch');
    });
    // 움직임·뗌은 창에서 받는다(전장을 눌러 시작한 손가락도 같은 길로 온다)
    window.addEventListener('pointermove', joyMove);
    window.addEventListener('pointerup', joyEnd); window.addEventListener('pointercancel', joyEnd);
  }
  // ---- 조이스틱 ----
  const JOY_R = 42, JOY_ZONE = { w: 0.45, h: 0.7 }; // 끌 수 있는 거리(px), 누르면 조이스틱이 생기는 영역(화면 왼쪽 45% × 아래 70%)
  const joyK = () => (typeof zoom === 'number' && zoom > 0 ? zoom : 1); // #app 확대(큰 화면)만큼 화면 px과 CSS px이 다르다
  // 전장(캔버스)을 누른 자리가 떠 있는 조이스틱 영역인가. 10-input이 보스전·라인(유닛을 고른 동안) 터치에서 묻는다.
  function joyZone(e) {
    const joy = $('joy');
    if (!joy || joy.hidden || !g || (!PAD.lane && !g.active())) return false;
    const r = $('stage').getBoundingClientRect();
    return e.clientX < r.left + r.width * JOY_ZONE.w && e.clientY > r.top + r.height * (1 - JOY_ZONE.h);
  }
  function joyPlace(J) {
    const k = joyK();
    $('joy').style.transform = J.cx === J.hx && J.cy === J.hy ? '' : `translate(${((J.cx - J.hx) / k).toFixed(1)}px, ${((J.cy - J.hy) / k).toFixed(1)}px)`;
  }
  function joyReset() {
    const joy = $('joy');
    PAD.joy = null; PAD.jv = null;
    joy.style.transform = ''; joy.firstElementChild.style.transform = ''; joy.classList.remove('on');
  }
  // float: 누른 자리를 중심으로 받침을 옮긴다. 아니면 받침의 기본 자리 가운데가 중심
  function joyStart(e, float) {
    const joy = $('joy');
    padInit();
    if (PAD.joy) joyReset(); // 앞 손가락의 뗌을 놓쳤어도 새로 누르면 다시 잡힌다
    try { joy.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    const r = joy.getBoundingClientRect(), hx = r.left + r.width / 2, hy = r.top + r.height / 2;
    const J = PAD.joy = { id: e.pointerId, hx, hy, cx: float ? e.clientX : hx, cy: float ? e.clientY : hy, float: !!float };
    joyPlace(J);
    joyMove(e);
  }
  function joyMove(e) {
    const J = PAD.joy;
    if (!J || J.id !== e.pointerId) return;
    const k = joyK(), R = JOY_R * k;
    let dx = e.clientX - J.cx, dy = e.clientY - J.cy;
    const l = Math.hypot(dx, dy);
    if (l > R) {
      // 떠 있는 조이스틱은 끝까지 민 손가락을 받침이 따라온다
      if (J.float) { J.cx += (dx / l) * (l - R); J.cy += (dy / l) * (l - R); joyPlace(J); }
      dx = (dx / l) * R; dy = (dy / l) * R;
    }
    const joy = $('joy');
    joy.firstElementChild.style.transform = `translate(${(dx / k).toFixed(1)}px, ${(dy / k).toFixed(1)}px)`;
    PAD.jv = { x: dx / R, y: dy / R };
    joy.classList.add('on');
  }
  function joyEnd(e) { if (PAD.joy && PAD.joy.id === e.pointerId) joyReset(); }
  // 조이스틱 값 → 입력 기록용 정수 [방향(0~63), 세기 단계(0~4)]. 엔진은 세기 0.5에서 최고 속도, 0.1 미만은 움직이지 않는다(det.js JOY)
  // 방향 64칸(5.6°)·세기 5단계로 묶어 같은 칸 안의 손가락 떨림은 명령을 만들지 않는다(기록 크기)
  function joyQ(v) {
    if (!v) return null;
    const m = Math.hypot(v.x, v.y);
    if (m < 0.1) return [0, 0];
    return [Math.round((Math.atan2(v.y, v.x) / (Math.PI * 2)) * 64) & 63, Math.max(1, Math.min(4, Math.round(m * 8)))];
  }
  // 지금 조작 상태를 엔진에 넣는다: 바뀐 것만 명령으로(g.input 'ls'·'lj'·'bj'·'ba'). 매 프레임(padTick)과 공격 버튼을 누른 순간에 부른다.
  // 예전에는 매 프레임 엔진 값(g.laneJoy, c.joy, c.atkHold)을 직접 썼다 — 화면이 판 상태를 바꾸면 서버가 같은 판을 다시 만들 수 없다.
  function padSend() {
    // 라인: 고른 유닛들을 조이스틱 방향으로 직접 움직인다(다중 선택도 대형 그대로 함께 움직인다)
    // 공격 버튼을 누르고 있으면(atk) 움직이면서도 사거리 안의 중간보스부터 친다. 라인은 각자 클라이언트가 돌리므로 협동에서도 내 유닛에만 걸린다.
    const la = PAD.lane && PAD.atk != null;
    const lj = PAD.lane && (PAD.jv || la) && S.sel.length ? (joyQ(PAD.jv) || [0, 0]).concat(la ? 1 : 0) : null;
    const ls = lj ? S.sel.slice(0, 200) : g.pad.ls;
    // 보스전: 고른 장수의 조이스틱·공격(라인 보기 중에는 놓는다)
    const boss = g.phase === 'boss' && !S.laneView && !!g.active();
    const bj = boss ? joyQ(PAD.jv) : null, ba = boss && PAD.atk != null ? 1 : 0;
    const P = g.pad;
    if (lj && ls.join() !== P.ls.join()) g.input('ls', ls);
    if (String(lj) !== String(P.lj)) g.input('lj', lj || []);
    if (String(bj) !== String(P.bj)) g.input('bj', bj || []);
    if (ba !== (P.ba ? 1 : 0)) g.input('ba', [ba]);
  }
  // 매 프레임: 조이스틱·공격 버튼 상태를 엔진에 넣는다(바뀐 것만)
  function padTick() {
    if (!g) return;
    if (g.over) { if (S.stay) stayPad(); return; }
    padSend();
    const c = g.phase === 'boss' && !S.laneView ? g.active() : null;
    if (!c) { PAD.buf = null; return; }
    // 선입력: 재사용이 끝나는 프레임에 쓴다. 시간이 지났거나 장수가 바뀌었거나 죽었으면 버린다.
    const B = PAD.buf;
    if (B) {
      if (B.uid !== c.uid || c.dead || performance.now() > B.until) PAD.buf = null;
      else if (cdLeft(c, B.A.k) <= 0) { PAD.buf = null; fireAim(c, B.A); dirty(); }
    }
  }
  // 게임에 남기(17-loop, 판이 끝난 뒤): 판 결과와 무관하므로 예전처럼 엔진 값을 직접 쓴다(명령·기록 없음)
  function stayPad() {
    const la = PAD.lane && PAD.atk != null;
    g.laneJoy = PAD.lane && (PAD.jv || la) && S.sel.length ? { ids: new Set(S.sel), x: PAD.jv ? PAD.jv.x : 0, y: PAD.jv ? PAD.jv.y : 0, atk: la } : null;
    const c = g.phase === 'boss' && !S.laneView ? g.active() : null;
    if (!c) return;
    g.localChamps().forEach((o) => { if (o !== c) o.joy = null; });
    c.joy = PAD.jv;
    if (PAD.atk != null) c.atkHold = 0.3;
  }
  // 보스전 스킬: 선택한 장수의 스킬·이동기·화타 치료를 공격 버튼 둘레(고양이 발)에 아이콘과 재사용 시간으로 보여 준다
  const SK_GLYPH = { line: '斬', circle: '爆', cone: '扇', buff: '勢', shield: '盾', heal: '治', rally: '令', taunt: '挑', weaken: '弱' };
  // 공격 버튼 중심에서의 자리(반지름 px, 각도: 0=오른쪽, 90=위)
  // 화면 오른쪽 끝에서 잘리지 않게 모두 공격 버튼의 왼쪽~위쪽에만 둔다(안쪽 줄 3개, 바깥 줄 3개)
  const PAW = [[96, 186], [96, 140], [96, 94], [158, 168], [158, 132], [158, 100]];
  function renderSkillBar() {
    const bar = $('skillbar'), joy = $('joy'), c = inBoss() && g.phase === 'boss' ? g.active() : null;
    padInit();
    if (!g.over && g.manual !== !!c) g.input('mn', [c ? 1 : 0]); // 직접 조작(조이스틱·공격 버튼) 켬/끔 — 바뀔 때만 명령
    // 라인에서는 터치 기기에서 유닛을 고르면 조이스틱과 공격 버튼만 띄운다(스킬 없음). 공격 버튼을 안 눌러도 유닛은 사거리 안의 적을 알아서 친다
    const lane = !c && !!S.coarse && laneOn() && !viewedPeer() && (!g.over || !!S.stay) && S.sel.length > 0;
    PAD.lane = lane;
    $('stage').classList.toggle('lanejoy', lane);
    if (!c) {
      if (lane) {
        if (bar.dataset.k !== 'lane') {
          bar.dataset.k = 'lane'; PAD.atk = null; PAD.aim = null; PAD.buf = null;
          const ic = (window.RTD_ICON && window.RTD_ICON('atk')) || '攻';
          bar.innerHTML = `<button class="sk atk" data-sk="atk" type="button" style="--c:#ffb070" title="${esc(t('attackShort'))}">${ic}</button>`;
          bar._cells = []; bar.hidden = false;
        }
        // 좁은 화면 CSS(폭 760px 미만)가 공격 버튼을 선택 창 위로 올릴 때 쓰는 선택 창 높이
        // 고른 유닛마다 선택 창 높이가 달라 공격 버튼이 오르내리지 않게, 선택 창이 열려 있는 동안은 가장 높았던 값을 유지한다(닫히면 다시 잰다)
        // 선택창 시험 'slim'(13)으로 띠↔큰 창이 바뀌면 다시 잰다(큰 창에서 접은 뒤에도 공격 버튼이 큰 창 높이에 떠 있지 않게)
        const sb = $('selbar'), sh = sb && !sb.hidden ? sb.offsetHeight : 0, sl = !!sb && sb.classList.contains('slim');
        if (bar._slim !== sl) { bar._slim = sl; bar._selh = 0; }
        if (!sh) bar._selh = 0;
        else if (sh > (bar._selh || 0)) { bar._selh = sh; $('stage').style.setProperty('--selh', sh + 'px'); }
      } else if (!bar.hidden) { bar.hidden = true; bar.dataset.k = ''; PAD.atk = null; PAD.aim = null; }
      if (!lane && PAD.joy && PAD.joy.float) joyReset(); // 보스전이 끝났거나 라인 보기로 넘어갔다: 떠 있던 받침을 제자리로(라인 조이스틱을 쓰는 중이면 그대로)
      if (joy.hidden === lane) { joy.hidden = !lane; if (!lane) joyReset(); }
      return;
    }
    // 게임에 남기(17-loop): 끝난 판이라 스킬·이동기·치료 없이 공격 버튼만
    const sk = S.stay ? [] : c.def.sk || [], heal = S.stay ? null : g.healLeft(), dash = !S.stay && c.def.tier >= g.R.dashMinTier;
    const key = c.uid + ':' + sk.length + ':' + dash + ':' + (heal == null ? 'n' : 'h');
    if (bar.dataset.k !== key) {
      bar.dataset.k = key;
      let slot = 0;
      const pos = () => { const [r, a] = PAW[Math.min(slot++, PAW.length - 1)], rad = (a * Math.PI) / 180; return `--x:${(Math.cos(rad) * r).toFixed(0)}px;--y:${(-Math.sin(rad) * r).toFixed(0)}px`; };
      // 아이콘: game-icons.net 그림(skillicons.js), 없으면 한자
      const ic = (k, glyph) => (window.RTD_ICON && window.RTD_ICON(k)) || glyph;
      const cell = (k, col, glyph, name) => `<button class="sk" data-sk="${k}" type="button" style="--c:${col};${pos()}" title="${esc(name)}">${glyph}<span class="cd"></span><span class="sec"></span><span class="nm">${esc(name)}</span></button>`;
      bar.innerHTML = sk.map((s, i) => cell(i, s.fx || '#ffd86a', ic(s.k, SK_GLYPH[s.k] || '技'), s.n)).join('')
        + (dash ? cell('dash', '#9fd8ff', ic('dash', '迅'), I.t('dash')) : '')
        + (heal != null ? cell('heal', '#a8ffb8', ic('hwata', '醫'), I.t('hwataHeal', { n: heal })) : '')
        + `<button class="sk atk" data-sk="atk" type="button" style="--c:#ffb070" title="${esc(t('attack'))}">${ic('atk', '攻')}</button>`;
      bar._cells = [...bar.querySelectorAll('.sk:not(.atk)')];
      bar.hidden = false; joy.hidden = false;
    }
    // 재사용 시간 갱신(돌아오는 순간 반짝)
    const cds = sk.map((s, i) => [c.skillCd[i], s.cd * (1 - Math.min(0.6, g.pv(c.def, 'cdr')))]);
    if (dash) cds.push([c.dashCd, g.R.dashCd]);
    if (heal != null) cds.push([heal > 0 ? 0 : 1, 1]);
    bar._cells.forEach((el, i) => {
      const [left, max] = cds[i] || [0, 1], p = left > 0 ? Math.min(1, left / max) : 0;
      const pv = `${Math.round(p * 50) * 2}%`; // 2% 단위로만 바꿔 불필요한 다시 그리기를 줄인다
      if (el._p !== pv) { el._p = pv; el.querySelector('.cd').style.setProperty('--p', pv); }
      const sec = el.querySelector('.sec'), txt = left > 0 && max > 1 ? String(Math.ceil(left)) : '';
      if (sec.textContent !== txt) sec.textContent = txt;
      const was = el.dataset.cd === '1', now = p > 0;
      if (was && !now) { el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); }
      el.dataset.cd = now ? '1' : '0';
    });
    if (heal != null) { const nm = bar._cells[bar._cells.length - 1].querySelector('.nm'), hl = I.t('hwataHeal', { n: heal }); if (nm.textContent !== hl) nm.textContent = hl; }
  }
