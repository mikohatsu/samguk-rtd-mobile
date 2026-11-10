  function drawBossAt(c, x, y, t, flash) {
    const f = g.fight, bd = Art.facing(S.bossFace ?? Math.PI / 2), bMove = S.bossMove;
    const im = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, bd.v, bMove ? (Math.sin(t * 10) > 0 ? 1 : 2) : 0);
    Art.drawSprite(c, im, x, y - 56 * (BOSS_S - 1), 200 * BOSS_S, bd.flip, 0, flash ? 0.96 : 1);
    // 번쩍임은 캔버스 필터(brightness) 대신 같은 그림을 한 번 더 밝게 얹는다(필터는 휴대폰에서 매우 느리다)
    if (flash) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; Art.drawSprite(c, im, x, y - 56 * (BOSS_S - 1), 200 * BOSS_S, bd.flip, 0, 0.96); c.restore(); }
  }
  // 전장 바닥은 판마다 한 번만 그려 두고 찍는다(매 프레임 화면 전체에 그라디언트·무늬·그라디언트를 세 번 덧칠하던 것)
  let arenaCv = null, arenaKey = '';
  function arenaFloor(c, a) {
    const key = a.motif + a.ground + a.sky + qMap() + (Art.img('tex_' + a.motif) ? 1 : 0);
    if (arenaKey !== key) {
      arenaKey = key;
      if (!arenaCv) arenaCv = document.createElement('canvas');
      const q = qMap(), w = W + OVER.x * 2, h = H + OVER.y * 2;
      arenaCv.width = Math.round(w * q); arenaCv.height = Math.round(h * q);
      const x = arenaCv.getContext('2d');
      x.setTransform(q, 0, 0, q, OVER.x * q, OVER.y * q);
      const gr = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1300);
      gr.addColorStop(0, a.ground); gr.addColorStop(1, a.sky);
      x.fillStyle = gr; x.fillRect(-OVER.x, -OVER.y, w, h);
      // 바닥이 유닛·장판보다 튀지 않게 채도와 밝기를 낮추고(타일에 미리 구움) 경기장 색을 얇게 덮는다
      const floor = tilePat(x, 'tex_' + a.motif, 1.2, 'saturate(0.45) brightness(0.62) contrast(0.85)');
      arenaCv._tex = !!floor;
      if (floor) {
        x.fillStyle = floor; x.fillRect(-OVER.x, -OVER.y, w, h);
        x.fillStyle = gr; x.globalAlpha = 0.4; x.fillRect(-OVER.x, -OVER.y, w, h); x.globalAlpha = 1;
      }
    }
    blitBg(c, arenaCv, 'arena', arenaKey);
    return arenaCv._tex;
  }
  function drawArena(t) {
    const c = ctx, f = g.fight, a = f.def.arena, b = f.boss;
    if (!arenaFloor(c, a)) drawMotif(c, a.motif, '#f0e0c0', t);
    c.strokeStyle = f.def.fx + '66'; c.lineWidth = 3; c.strokeRect(ARENA.x0, ARENA.y0, ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0);
    f.hazards.forEach((h) => drawHazard(c, h));
    drawRaid(c, t);
    // 보스(잠행 중에는 보이지 않는다. 분신 기믹에서는 그림자가 있는 쪽이 진짜)
    const M = f.mech;
    if (!M.hide) {
    if (b.charge) { c.fillStyle = f.def.fx + '55'; c.beginPath(); c.arc(b.x, b.y, 86, 0, 7); c.fill(); }
    if (M.ctr > 0) { c.save(); c.globalAlpha = 0.5 + Math.sin(t * 20) * 0.3; c.fillStyle = '#4aa8ff'; c.beginPath(); c.arc(b.x, b.y, 110, 0, 7); c.fill(); c.restore(); }
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(b.x, b.y + 62, 62 * BOSS_S, 20 * BOSS_S, 0, 0, 7); c.fill();
    c.strokeStyle = f.def.fx; c.lineWidth = 4; c.beginPath(); c.ellipse(b.x, b.y + 62, 62 * BOSS_S, 20 * BOSS_S, 0, 0, 7); c.stroke();
    // 게임은 1초에 30번 움직이고 화면은 그보다 자주 그려서, 프레임마다 '움직임'만 보면 걷기·서기가 번갈아 덜덜 떨린다.
    // 마지막으로 움직인 뒤 0.15초까지는 걷는 중으로 본다.
    const bdx = b.x - (S.bossX ?? b.x), bdy = b.y - (S.bossY ?? b.y), moved = Math.hypot(bdx, bdy) > 0.3;
    if (moved) { S.bossFace = Math.atan2(bdy, bdx); S.bossMovedAt = t; }
    const bMove = S.bossMovedAt != null && t - S.bossMovedAt < 0.15 && t >= S.bossMovedAt;
    S.bossX = b.x; S.bossY = b.y;
    S.bossMove = bMove;
    const bd = Art.facing(S.bossFace ?? Math.PI / 2);
    // ---- 타격감: 맞으면 공격한 쪽 반대로 밀리고 움찔(찌그러졌다 펴짐), 하얗게 번쩍. 패턴 전에는 힘을 모으고(솟으며 부풂) 터질 때 내리찍는다 ----
    const hr = S.bhr && S.bhr.f === f ? S.bhr : (S.bhr = { f, k: 0, ax: 0, ay: 1, hp: b.hp, num: 0, numT: 0, wind: 0, slam: 0 });
    if (b.hp < hr.hp - 0.5) {
      const ac = g.active(), dmg = hr.hp - b.hp;
      if (ac) { const a = Math.atan2(b.y - ac.y, b.x - ac.x); hr.ax = Math.cos(a); hr.ay = Math.sin(a); }
      hr.k = Math.min(1.4, hr.k + 0.55 + Math.min(0.6, dmg / (b.mhp * 0.02))); hr.num += dmg;
    }
    hr.hp = b.hp; hr.k *= Math.pow(0.8, S.f60);
    hr.numT += S.fdt;
    if (hr.num > 0 && hr.numT > 0.14) { if (S.dmg.length < 50) S.dmg.push({ x: b.x + (Math.random() - 0.5) * 70, y: b.y - 96, v: Math.round(hr.num), t: 0, hit: true }); hr.num = 0; hr.numT = 0; }
    let wind = 0;
    f.hazards.forEach((h) => { if (!h.own && h.t < h.delay) wind = Math.max(wind, h.t / Math.max(0.01, h.delay)); });
    if (hr.wind > 0.85 && wind < 0.2) { hr.slam = 1; S.shake = Math.max(S.shake || 0, 0.55); }
    hr.wind = wind; hr.slam *= Math.pow(0.86, S.f60);
    const wk = Math.pow(wind, 1.5), push = hr.k * 16;
    const bx = b.x + hr.ax * push, by = b.y + hr.ay * push * 0.6 - wk * 18 + hr.slam * 10 - 56 * (BOSS_S - 1);
    const sy = (1 - hr.k * 0.08) * (1 + wk * 0.08) * (1 - hr.slam * 0.1), sc = 200 * BOSS_S * (1 + hr.k * 0.04 + wk * 0.06 + hr.slam * 0.05);
    const bImg = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, bd.v, bMove ? (Math.sin(t * 10) > 0 ? 1 : 2) : 0);
    // 힘 모으기: 붉은 기운이 몸에 맺힌다
    if (wk > 0.05) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = wk * 0.5; c.drawImage(glowSprite('w' + f.def.fx, [[0, f.def.fx + 'cc'], [0.6, f.def.fx + '44'], [1, f.def.fx + '00']]), bx - 130, by - 150, 260, 260); c.restore(); }
    const RG = window.RTD_RIG;
    // 조각 애니메이션 보스: 기술 전 힘 모으기 → 터질 때 내지르기. 기술 종류에 따라 전방위(정면에서 두 팔 벌리기)·소환(무기 치켜들기)은 앞모습,
    // 겨누기는 옆모습으로 상대를 본다. 평소에는 이동 방향의 그림(앞·옆)을 쓰고, 조각이 없는 방향(뒷모습)은 기존 그림.
    const casting = wind > 0.05 || hr.slam > 0.1, act = S.bossAct || 'raise';
    const rView = casting ? (act === 'aim' ? 's' : 'f') : bd.v === 2 ? 's' : bd.v <= 1 ? 'f' : null;
    const rv = RG && rView && (RG.has(f.def.id, rView) ? rView : casting && RG.has(f.def.id, 's') ? 's' : null);
    if (rv) {
      const st = wind > 0.05 ? { state: 'skill', act, p: wind * 0.45, t } : hr.slam > 0.1 ? { state: 'skill', act, p: 0.45 + (1 - hr.slam) * 0.55, t } : hr.k > 0.15 ? { state: 'hurt', k: Math.min(1, hr.k), t } : { state: bMove ? 'walk' : 'idle', t };
      st.view = rv;
      const tgt = g.active(), flipR = rv === 'f' ? bd.flip : casting ? (tgt ? tgt.x < b.x : false) : bMove ? Math.cos(S.bossFace ?? 0) < 0 : tgt ? tgt.x < b.x : false; // 옆모습은 멈춰 있거나 기술을 쓰면 내 장수 쪽을 본다
      const drawR = () => { c.save(); c.translate(bx, by); c.scale(1, sy); RG.draw(c, f.def.id, 0, 0, sc, flipR, st); c.restore(); };
      drawR();
      if (hr.k > 0.08) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(0.85, hr.k * 0.7); drawR(); c.restore(); }
    } else {
      Art.drawSprite(c, bImg, bx, by, sc, bd.flip, hr.ax * hr.k * 0.06 * (bd.flip ? -1 : 1), sy);
      if (hr.k > 0.08) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(0.85, hr.k * 0.7); Art.drawSprite(c, bImg, bx, by, sc, bd.flip, 0, sy); c.restore(); }
    }
    if (hr.slam > 0.1) { Art.fxAnim(c, 'ring', 1 - hr.slam, b.x, b.y + 62, 420, 170, 0, 1); Art.fxAnim(c, 'boom2', Math.min(0.99, (1 - hr.slam) * 1.3), b.x, b.y + 40, 260, 260, 0, 0.9); }
    if (hr.slam > 0.1) { c.save(); c.globalAlpha = hr.slam * 0.8; c.strokeStyle = '#fff2d0'; c.lineWidth = 6 * hr.slam; c.beginPath(); c.ellipse(b.x, b.y + 62, 70 + (1 - hr.slam) * 120, 24 + (1 - hr.slam) * 40, 0, 0, 7); c.stroke(); c.restore(); }
    c.filter = 'none';
    c.textAlign = 'center';
    if (M.charmT > 0) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.8 + i / 5) % 1, hx = b.x + Math.sin(i * 2.3 + t * 2) * 46, hy = b.y - 70 - ph * 90, s = 14 + Math.sin(ph * Math.PI) * 10;
        c.globalAlpha = Math.sin(ph * Math.PI) * 0.9; c.fillStyle = i % 2 ? '#ff7ac0' : '#ffb0dc';
        c.beginPath(); c.moveTo(hx, hy + s * 0.35); c.bezierCurveTo(hx - s, hy - s * 0.4, hx - s * 0.45, hy - s, hx, hy - s * 0.45); c.bezierCurveTo(hx + s * 0.45, hy - s, hx + s, hy - s * 0.4, hx, hy + s * 0.35); c.fill();
      }
      c.restore();
      c.fillStyle = '#ff9ad0'; c.font = '400 28px "Black Han Sans", sans-serif'; c.fillText(I.t('e_charm'), b.x, b.y - 84);
    } else if (b.stun > 0) { c.fillStyle = '#ffe27a'; c.font = '700 20px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('stun'), b.x, b.y - 84); }
    if (M.gr > 0) { c.fillStyle = '#7fd4ff'; c.font = '400 30px "Black Han Sans", sans-serif'; c.fillText(I.t('groggy'), b.x, b.y - 96); }
    if (M.ctr > 0) {
      c.fillStyle = '#bfe2ff'; c.font = '400 28px "Black Han Sans", sans-serif'; c.fillText(I.t('counter'), b.x, b.y - 112);
      // 반격 게이지: 정면에서 넣은 피해
      bar(c, b.x, b.y - 92, 150, 8, Math.min(1, (M.ctrGot || 0) / (M.ctrNeed || 1)), '#4aa8ff');
    }
    if (M.ampT > 0) { c.fillStyle = '#d8b4ff'; c.font = '700 18px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('weakened', { n: Math.round(M.amp * 100) }), b.x, b.y + 98); }
    // 팔진도: 보스 머리 위 문양과 같은 문이 생문
    if (M.objs.some((o) => o.k === 'gate')) { c.fillStyle = 'rgba(16,11,8,.7)'; c.fillRect(b.x - 46, b.y - 170, 92, 70); c.fillStyle = '#d8ecff'; drawSym(c, b.x, b.y - 135, M.sym, 30); }
    }
    // 출전 무장
    const act = g.phase === 'boss' ? g.active() : null;
    // 일기토 대기 장수: 결투장 왼쪽 아래에 흐리게 줄 세운다
    f.champs.filter((u) => u.bench).forEach((u, i) => {
      c.globalAlpha = 0.45; Art.drawSprite(c, Art.unitSprite(u.def, 0, 0), ARENA.x0 + 40 + i * 60, ARENA.y1 - 40, 60, false); c.globalAlpha = 1;
      c.fillStyle = '#ffd86a'; c.font = '700 13px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(I.t('waiting'), ARENA.x0 + 40 + i * 60, ARENA.y1 - 78);
    });
    f.champs.forEach((u) => {
      if (u.dead || u.bench) return;
      if (u === act) {
        c.strokeStyle = '#7dff8e'; c.lineWidth = 2; c.beginPath(); c.ellipse(u.x, u.y + 6, 46, 38, 0, 0, 7); c.stroke();
        c.strokeStyle = 'rgba(125,255,142,.2)'; c.lineWidth = 1; c.beginPath(); c.arc(u.x, u.y, g.range(u.def) + 40, 0, 7); c.stroke();
        if (u.move) { c.strokeStyle = 'rgba(125,255,142,.5)'; c.beginPath(); c.moveTo(u.x, u.y); c.lineTo(u.tx, u.ty); c.stroke(); }
      }
      drawBuffs(c, u, t);
      // 맞으면 보스 반대쪽으로 튕겨 밀린다(그림만, 위치는 그대로)
      const kb = Math.max(0, (u.hurt || 0) / 0.2), ka = Math.atan2(u.y - b.y, u.x - b.x), kx = u.x + Math.cos(ka) * kb * 12, ky = u.y + Math.sin(ka) * kb * 8;
      if (u.hurt > 0) { c.fillStyle = `rgba(255,60,40,${0.45 * kb})`; c.beginPath(); c.arc(kx, ky, 44, 0, 7); c.fill(); }
      // 조각 애니메이션 동작 상태: 공격(atkT 0.24)·스킬(0.36 이상)은 시작할 때의 길이로 구분, 맞으면 피격, 움직이면 걷기
      if ((u.atkT || 0) > (u._atkPrev || 0) + 0.01) u._atkMax = u.atkT;
      u._atkPrev = u.atkT || 0;
      const rs = u.atkT > 0 ? { state: (u._atkMax || 0) >= 0.3 ? 'skill' : 'attack', p: 1 - u.atkT / (u._atkMax || 0.24), t } : kb > 0.05 ? { state: 'hurt', k: kb, t } : { state: u.move || u.moveT > 0 ? 'walk' : 'idle', t };
      piece(c, kx, ky, CHAMP_R, u.def, t, u.owner === 1, { pose: poseOf(u, t, CHAMP_R), rig: rs });
      bar(c, u.x, u.y - 80, 76, 7, u.hp / u.mhp, u.hp / u.mhp < 0.3 ? '#ff6a50' : '#7ed08c');
    });
    drawAim(c);
    Object.values(f.ghosts).forEach((o) => {
      if (!o.def) return;
      // 동료 유닛은 위치 변화로 방향을 맞춘다
      const pv = (S.ghostPos = S.ghostPos || {})[o.name] || { x: o.x, y: o.y, moveT: 0, face: Math.PI / 2, def: o.def, id: 1 };
      if (Math.hypot(o.x - pv.x, o.y - pv.y) > 0.3) { pv.face = Math.atan2(o.y - pv.y, o.x - pv.x); pv.moveT = 0.15; } else pv.moveT = Math.max(0, pv.moveT - S.fdt);
      pv.x = o.x; pv.y = o.y; S.ghostPos[o.name] = pv;
      c.globalAlpha = 0.85; piece(c, o.x, o.y, CHAMP_R, o.def, t, true, { pose: poseOf(pv, t, CHAMP_R) }); c.globalAlpha = 1;
      bar(c, o.x, o.y - 78, 72, 6, o.hpf, '#7fd4ff');
      c.fillStyle = '#d8f0ff'; c.font = '500 14px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(o.name || '', o.x, o.y + 52);
    });
    drawVfx(c);
    drawFx(c);
    if (g.mut.night) drawNight(c, true);
    if (g.phase === 'boss') {
      // 휴대폰에서는 보스 체력·남은 시간·기술 이름·딜미터를 키워 그린다(위 가운데 / 오른쪽 위 기준)
      const us = uiS();
      c.save(); c.translate(W - 56, 66); c.scale(Math.min(us, 1.3), Math.min(us, 1.3)); c.translate(-(W - 56), -66);
      drawMeter(c, meterRows(f.dealt, f.total));
      c.restore();
      c.save(); c.translate(W / 2, 0); c.scale(us, us); c.translate(-W / 2, 0);
      bar(c, W / 2, 12, 960, 26, b.hp / b.mhp, f.def.fx);
      c.fillStyle = '#fff'; c.font = '700 18px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineJoin = 'round'; c.strokeText(`${f.def.name}  ${fmt(b.hp)} / ${fmt(b.mhp)}`, W / 2, 26);
      c.fillText(`${f.def.name}  ${fmt(b.hp)} / ${fmt(b.mhp)}`, W / 2, 26);
      const left = Math.max(0, f.limit - f.t), fast = f.t / f.limit <= 1 - g.fastNeed();
      c.fillStyle = left < 20 ? '#ff7a60' : '#fff'; c.font = '400 28px "Black Han Sans", sans-serif'; c.fillText(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, W / 2, 58);
      c.fillStyle = fast ? '#ffd86a' : '#a8987f'; c.font = '500 13px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t(fast ? 'fastOk' : 'fastNo'), W / 2, 82);
      const M = f.mech;
      if (M.vuln > 0) { c.fillStyle = '#ffb070'; c.font = '700 14px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('vuln', { n: Math.round(M.vuln * 100) }), W / 2 + 560, 26); }
      if (M.cast) {
        const fr = Math.min(1, M.cast.got / M.cast.need), left = Math.max(0, M.cast.dur - M.cast.t);
        c.fillStyle = 'rgba(16,11,8,.75)'; c.fillRect(W / 2 - 330, 150, 660, 58);
        bar(c, W / 2, 190, 620, 16, fr, '#7fd4ff');
        c.fillStyle = '#fff'; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('castLine', { a: M.cast.n, p: Math.round(fr * 100), s: left.toFixed(1) }) + I.t(M.cast.spots ? 'castSpots' : 'castAll'), W / 2, 166);
        // 서야 할 자리는 실제 전장 좌표라서 글씨 확대를 잠시 풀고 그린다
        if (M.cast.spots) { c.save(); c.translate(W / 2, 0); c.scale(1 / us, 1 / us); c.translate(-W / 2, 0); c.strokeStyle = '#a8ffb8'; c.lineWidth = 3; c.setLineDash([10, 8]); M.cast.spots.forEach((s) => { c.beginPath(); c.arc(s[0], s[1], s[2], 0, 7); c.stroke(); }); c.setLineDash([]); c.restore(); }
      }
      if (M.objs.some((o) => o.k === 'clone')) { c.fillStyle = '#fff'; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('clones'), W / 2, 176); }
      if (S.pattern && S.pattern.t > 0) {
        S.pattern.t -= S.fdt;
        c.fillStyle = f.def.fx; c.font = '400 38px "Black Han Sans", sans-serif'; c.globalAlpha = Math.min(1, S.pattern.t * 2); c.fillText(S.pattern.name, W / 2, 124); c.globalAlpha = 1;
      }
      c.restore();
    }
    if (g.phase === 'bossIntro') {
      const p = 1 - f.introT / 4.2, bh = Math.min(120, p * 500);
      c.fillStyle = '#000'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, OVER.y + bh); c.fillRect(-OVER.x, H - bh, W + OVER.x * 2, OVER.y + bh);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#e8dcc0'; c.font = '700 26px "Gowun Batang", serif'; c.fillText(I.t('roundPlace', { r: f.def.round, p: f.def.place }), W / 2, 60);
      c.fillStyle = f.def.fx; c.font = '400 76px "Black Han Sans", sans-serif'; c.globalAlpha = Math.min(1, p * 3); c.fillText(f.def.title, W / 2, H - 230);
      c.fillStyle = '#fff'; c.font = '400 42px "Black Han Sans", sans-serif'; c.fillText(f.def.name, W / 2, H - 160);
      c.fillStyle = '#e8dcc0'; c.font = '400 23px "Gowun Batang", serif'; c.fillText(`“${f.def.line}”`, W / 2, H - 60); c.globalAlpha = 1;
    }
  }
  const popQ = [];
  const POP_DUR = { 4: 2.4, 5: 2.4, 6: 3.2, 7: 3.8, 8: 3.4, 9: 6.6, 10: 7.2 };
