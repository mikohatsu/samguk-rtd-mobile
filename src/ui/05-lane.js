  // 잠긴 장수의 아이템 표시용 자물쇠(로비·상점과 같은 gfx/ic_lock.png). 못 불러오면 width 0이라 그리지 않는다
  const LOCK_IM = typeof Image !== 'undefined' ? new Image() : { width: 0 };
  if (LOCK_IM.src !== undefined) LOCK_IM.src = 'gfx/ic_lock.png';
  const TSTAR_SZ = 10; // 유닛 발밑 등급 별 하나의 크기(전장 단위, 휴대폰 배율 uiS를 곱한다). 불멸 10개 = 두 줄 × 5개라 폭이 원판과 비슷하다
  function drawLane(t) {
    const c = ctx;
    blitBg(c, mapCv, 'map', mapVer);
    drawFlags(c);
    // 터치 자리: 퍼지는 충격파 고리 그림(fxa_wave, 물들임)
    for (const p of S.pings) { p.t += S.fdt; const k = Math.min(0.99, p.t / 0.5), s0 = (30 + p.t * 120) * uiS(); Art.fxAnim(c, 'wave', k, p.x, p.y, s0, s0, 0, 1 - k * 0.6, null, { col: p.c, sy: 0.6 }); }
    S.pings = S.pings.filter((p) => p.t < 0.5);
    const us = uiS(), SK = window.RTD_SKFX;
    for (const e of g.enemies) {
      if (e.mid) {
        // 중간보스 발밑: 금색 법진 그림이 천천히 돈다
        blobShadow(c, e.x, e.y + 22, 70, 0.55);
        Art.fxPic(c, 'mc_rune1', e.x, e.y + 20, 96, 96, t * 0.5, 0.75, { col: '#e8c15a', sy: 0.42 });
        const v = [2, 0, 2, 4][e.seg], fr = Math.sin(t * 13) > 0 ? 1 : 2, img = e.w.look ? Art.namedSprite(e.w.name, e.w.look, '#b5361f', v, fr) : Art.soldierSprite({ name: e.w.name, color: '#b5361f', hat: 'helm', weapon: 'guandao' }, v, fr);
        // 놓치기 10초 전: 붉은 오라가 발밑에서 천천히 차올랐다가 가라앉기를 2초마다 되풀이(깜빡임·떨림 없음)
        const warn = e.midT <= 10;
        if (warn && SK) {
          // 붉은 빛기둥(Kenney 빛줄기)과 붉은 법진이 함께 차올랐다 가라앉는다(깜빡임 없음)
          const w = (1 - Math.cos(t * Math.PI)) / 2, hgt = 50 + w * 90;
          SK.spr(c, 'trace_06', '#ff3a24', e.x, e.y + 26 - hgt / 2, 110, hgt, 0, 0.45 + w * 0.4);
          SK.spr(c, 'light_02', '#ff4a30', e.x, e.y + 20, 120, 120, t, 0.35 + w * 0.35, true, 0.42);
          Art.fxPic(c, 'mc_rune2', e.x, e.y + 20, 104, 104, -t * 1.2, 0.5 + w * 0.4, { col: '#ff4a3a', sy: 0.42 });
        }
        Art.drawSprite(c, img, e.x, e.y, 96, e.seg === 2);
        bar(c, e.x, e.y - 50, 74 * us, 6 * us, e.hp / e.mhp, '#ff6a50');
        // 이름·남은 시간: 휴대폰에서도 읽히게 배율을 곱하고 먹 테두리를 두른다
        c.save(); c.translate(e.x, e.y - 50 - 5 * us); c.scale(us, us);
        c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(20,12,6,.9)'; c.lineWidth = 4;
        const mt = warn ? I.t('midLeft', { name: e.w.name, n: Math.ceil(e.midT) }) : `${e.w.name} ${Math.ceil(e.midT)}`;
        c.font = warn ? '400 22px "Black Han Sans", sans-serif' : '700 16px "IBM Plex Sans KR", sans-serif';
        c.strokeText(mt, 0, 0); c.fillStyle = warn ? '#ff7a60' : '#ffe9a8'; c.fillText(mt, 0, 0);
        c.restore();
      } else {
        const hit = (e.hitT || 0) / 0.14, ex = e.x + Math.cos(e.hitA || 0) * 7 * hit, ey = e.y + Math.sin(e.hitA || 0) * 7 * hit - Math.abs(Math.sin(t * 12 + e.id)) * 3;
        const v = [2, 0, 2, 4][e.seg], img = Art.soldierSprite(e.w, v, Math.sin(t * 11 + e.id) > 0 ? 1 : 2), sz = e.elite ? 96 : 60;
        // 발밑 그림자: 누런 길 위에서도 적이 바탕에서 떠 보이게. 보통 병사는 그림자와 몸을 합친 한 장으로 찍는다(soldierShadowed)
        const sw = !e.elite && !(hit > 0) ? soldierShadowed(img, sz, 16) : null;
        if (sw) { drawShadowed(c, sw, ex, ey, e.seg === 2); }
        else {
          blobShadow(c, ex, ey + (e.elite ? 26 : 16), sz * 0.7, 0.5);
          if (e.elite && SK) {
            // 군웅할거 정예: 장수 후광과 같은 방식(그림) — 금빛 바닥 빛 + 금색 법진 + 솟는 빛 알갱이
            const pu = 0.75 + Math.sin(t * 4 + e.id) * 0.25;
            SK.spr(c, 'light_01', '#ffd86a', ex, ey + 4, 128, 128, t * 0.3, 0.45 * pu);
            Art.fxPic(c, 'mc_rune3', ex, ey + 22, 84, 84, t * 0.7, 0.75, { col: '#ffd86a', sy: 0.42 });
            for (let i = 0; i < 4; i++) { const ph = (t * 0.9 + i / 4 + e.id * 0.13) % 1; SK.spr(c, 'star_04', '#ffe9a8', ex + Math.sin(i * 1.9 + t) * 22, ey + 20 - ph * 70, 14, 14, 0, Math.sin(ph * Math.PI) * 0.8); }
          }
          Art.drawSprite(c, img, ex, ey, sz, e.seg === 2, hit * 0.25);
        }
        if (hit > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = hit * 0.8; Art.drawSprite(c, img, ex, ey, sz, e.seg === 2, hit * 0.25); c.restore(); }
        // 적 체력 막대: 휴대폰 배율을 곱한다(예전 28×3은 화면에서 1px 남짓이었다)
        if (e.elite) bar(c, e.x, e.y - 50, 74 * us, 6 * us, e.hp / e.mhp, '#ffd86a');
        else if (e.hp < e.mhp) bar(c, e.x, e.y - 30 - 2 * us, 32 * us, 4 * us, e.hp / e.mhp, '#ff6a50');
      }
    }
    for (const d of g.drops) {
      if (d.owner !== 0) continue;
      const bob = Math.sin(t * 3 + d.id) * 2, selected = S.dropSel === d.id;
      if (selected) selMark(c, d.x, d.y + 16, 24, t);
      const dimg = Art.img(d.kind === 'chest' ? 'prop_chest' : d.kind === 'item' ? 'prop_scroll' : 'prop_' + d.kind);
      // 잠긴 장수의 아이템은 두루마리 오른쪽 위에 자물쇠 그림(gfx/ic_lock)을 얹는다
      const dlock = d.kind === 'item' && LOCK_IM.width && !g.itemOpen(d.item);
      if (dimg) { blobShadow(c, d.x, d.y + 16, 40, 0.5); c.drawImage(dimg, d.x - 24, d.y - 26 + bob, 48, 48 * (dimg.height / dimg.width)); if (dlock) c.drawImage(LOCK_IM, d.x + 6, d.y - 30 + bob, 22, 22); continue; }
      c.fillStyle = d.kind === 'chest' ? '#7a3b1c' : '#2a2140'; c.strokeStyle = '#ffd86a'; c.lineWidth = 2.5;
      c.fillRect(d.x - 17, d.y - 15 + bob, 34, 30); c.strokeRect(d.x - 17, d.y - 15 + bob, 34, 30);
      c.fillStyle = '#ffe9a8'; c.font = '900 21px "Noto Serif KR", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(d.kind === 'chest' ? T.chestMark : d.kind === 'item' ? T.itemMark : T.consumables[d.kind].mark, d.x, d.y + 1 + bob);
      if (dlock) c.drawImage(LOCK_IM, d.x + 6, d.y - 30 + bob, 22, 22);
    }
    const sel = new Set(S.sel), fo = synFocus(), myIdx = g.me ? g.me.idx : 0; // fo: 열린 인연 창의 구성원(발밑 고리 + 나머지 내 유닛 흐리게)
    // 겹쳐 선 유닛은 아래쪽(y가 큰 쪽)을 나중에 그려 앞뒤가 맞게 한다(배치는 그대로, 그리는 순서만)
    const order = g.units.length > 1 ? g.units.slice().sort((a, b) => a.y - b.y || a.id - b.id) : g.units;
    for (const u of order) {
      // 라인 유닛 크기(등급이 높을수록 큼). 폰에서 알아보기 쉽게 15% 키웠다(1.3 → 1.5). 정렬 칸 간격(42)은 그대로라 줄 세우면 살짝 겹친다.
      const r = (15 + Math.min(u.def.tier, 10) * 0.8) * 1.5;
      if (sel.has(u.id)) selMark(c, u.x, u.y + (u.def.tier ? r * 0.72 : 22), u.def.tier ? r : 30, t);
      const away = g.inFight(u), mine = u.owner === myIdx && u.def.tier > 0, foIn = fo && mine && fo.set.has(u.def.id);
      if (foIn) ringSpr(c, 'circle_02', fo.col, u.x, u.y + r * 0.72, r * 1.25, t * 0.6, 0.75 + Math.sin(t * 5) * 0.2, true, 0.42);
      if (away) c.globalAlpha = 0.35;
      else if (fo && !foIn) c.globalAlpha = 0.45;
      piece(c, u.x, u.y + (u.def.tier ? 0 : Math.sin(t * 3 + u.x) * 3), u.def.tier ? r : 30, u.def, t, u.owner === 1, { pose: poseOf(u, t, r) });
      if (u.def.tier) tierStars(c, u.x, u.y + r * 1.15, u.def.tier, TSTAR_SZ * us); // 원판 아래 등급 별(03-unit)
      if (fo && !foIn && !away) c.globalAlpha = 1;
      if (away) { c.globalAlpha = 1; c.save(); c.translate(u.x, u.y - r - 10); c.scale(us, us); c.fillStyle = '#ffd86a'; c.strokeStyle = 'rgba(20,12,6,.9)'; c.lineWidth = 4; c.lineJoin = 'round'; c.font = '700 14px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.strokeText(I.t('deployed'), 0, 0); c.fillText(I.t('deployed'), 0, 0); c.restore(); }
      if (!u.def.tier) { c.fillStyle = '#ffe9a8'; c.strokeStyle = 'rgba(32,21,12,.85)'; c.lineWidth = 4; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText(u.def.name, u.x, u.y + 46); c.fillText(u.def.name, u.x, u.y + 46); }
    }
    if (S.sel.length === 1) {
      const u = g.units.find((x) => x.id === S.sel[0]);
      if (u && u.def.tier > 0) rangeMark(c, u.x, u.y, g.rangeOf(u), '#7dff8e', 0.22); // 인연 사거리 포함(engine stepUnits와 같은 값)
    }
    drawFx(c);
    if (g.mut.night) drawNight(c);
    if (S.drag && S.drag.moved) {
      c.strokeStyle = '#7dff8e'; c.lineWidth = 1.5; c.fillStyle = 'rgba(125,255,142,.1)';
      c.fillRect(S.drag.x0, S.drag.y0, S.drag.x1 - S.drag.x0, S.drag.y1 - S.drag.y0); c.strokeRect(S.drag.x0, S.drag.y0, S.drag.x1 - S.drag.x0, S.drag.y1 - S.drag.y0);
    }
  }

  // F1~F5로 고른 다른 사람의 전장. 그 사람이 보낸 라인 묶음을 그대로 그린다.
  function viewedPeer() {
    if (!S.view || !net || g.phase !== 'wave') return null;
    const p = net.roster().find((x) => x.id === S.view && !x.me);
    return p && p.state.ln ? p : null;
  }
  // 받은 묶음 사이를 한 묶음 늦게 이어 그려 끊김 없이 움직이게 한다
  const remoteBuf = {};
  function remoteFrame(peer) {
    const ln = peer.state.ln, now = performance.now();
    let s = remoteBuf[peer.id];
    if (!s || s.seq !== ln.s) {
      const prev = s ? { at: s.at, u: new Map(s.ln.u.map((r) => [r[0], r])), e: new Map(s.ln.e.map((r) => [r[0], r])) } : null;
      s = remoteBuf[peer.id] = { seq: ln.s, ln, at: now, span: prev ? Math.min(1200, Math.max(60, now - prev.at)) : 1, prev };
    }
    const k = Math.min(1, (now - s.at) / s.span), lerp = (old, r, i) => (old ? old[i] + (r[i] - old[i]) * k : r[i]);
    return {
      u: s.ln.u.map((r) => { const o = s.prev && s.prev.u.get(r[0]); return { id: r[0], i: r[1], x: lerp(o, r, 2), y: lerp(o, r, 3), f: r[4], m: r[5], a: r[6], atk: r[7] }; }),
      e: s.ln.e.map((r) => { const o = s.prev && s.prev.e.get(r[0]); return { id: r[0], k: r[1], x: lerp(o, r, 2), y: lerp(o, r, 3), h: r[4], seg: r[5] }; }),
    };
  }
  function drawRemoteLane(t, peer) {
    const c = ctx, fr0 = remoteFrame(peer);
    blitBg(c, mapCv, 'map', mapVer);
    fr0.e.forEach(({ id, k, x, y, h, seg }) => {
      const v = [2, 0, 2, 4][seg] || 0, fr = Math.sin(t * 11 + id) > 0 ? 1 : 2;
      y -= k >= 100 ? 0 : Math.abs(Math.sin(t * 12 + id)) * 3;
      if (k >= 100) {
        const m = T.midbosses[k - 100], img = Art.namedSprite(m.name, T.midLooks[m.name], '#b5361f', v, fr);
        Art.fxPic(c, 'mc_rune1', x, y + 20, 84, 84, t * 0.5, 0.75, { col: '#e8c15a', sy: 0.42 });
        Art.drawSprite(c, img, x, y, 76, seg === 2); bar(c, x, y - 50, 74 * uiS(), 6 * uiS(), h / 20, '#ff6a50');
      } else {
        Art.drawSprite(c, Art.soldierSprite(T.waves[k] || T.waves[0], v, fr), x, y, 48, seg === 2);
        if (h < 20) bar(c, x, y - 30, 32 * uiS(), 4 * uiS(), h / 20, '#ff6a50');
      }
    });
    // 다른 사령관 유닛은 클릭해서 정보만 볼 수 있다
    const hits = [], rs = S.rsel && S.rsel.peer === peer.id ? S.rsel : null;
    let found = false;
    fr0.u.forEach(({ id, i, x, y, f, m, a, atk }) => {
      const d = T.units[i]; if (!d) return;
      const r = d.tier ? (15 + Math.min(d.tier, 10) * 0.8) * 1.3 : 30;
      if (rs && rs.id === id) { found = true; rs.atk = atk; selMark(c, x, y + r * 0.72, r, t, '#ffd86a'); }
      piece(c, x, y, r, d, t, false, { pose: poseOf({ face: f / 10, moveT: m ? 0.1 : 0, atkT: a ? 0.1 : 0, id, def: d }, t, r) });
      if (d.tier) tierStars(c, x, y + r * 1.15, d.tier, TSTAR_SZ * uiS());
      hits.push({ id, x, y, d, atk });
    });
    S.remoteHits = hits;
    if (rs && !found) S.rsel = null;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '400 40px "Black Han Sans", sans-serif'; c.lineWidth = 6;
    c.strokeStyle = 'rgba(20,14,10,.85)'; c.strokeText(I.t('peerField', { a: peer.state.name }), W / 2, ROAD.y0 + 110); c.fillStyle = '#ffe2a8'; c.fillText(I.t('peerField', { a: peer.state.name }), W / 2, ROAD.y0 + 110);
  }
  function drawMotif(c, m, a, t) {
    c.strokeStyle = a; c.fillStyle = a; c.globalAlpha = 0.28; c.lineWidth = 4;
    if (m === 'gate' || m === 'city' || m === 'palace') { for (let i = 0; i < 16; i++) c.fillRect(i * 105, 34, 70, 26); c.fillRect(W / 2 - 150, 0, 300, 34); }
    else if (m === 'altar') { for (let r = 120; r < 330; r += 70) { c.beginPath(); c.arc(W / 2, H / 2, r, 0, 7); c.stroke(); } }
    else if (m === 'bagua') { for (let i = 0; i < 8; i++) { const an = (i * Math.PI) / 4 + t * 0.05; c.save(); c.translate(W / 2 + Math.cos(an) * 340, H / 2 + Math.sin(an) * 340); c.rotate(an + Math.PI / 2); for (let j = 0; j < 3; j++) c.fillRect(-50, j * 18, (i >> j) & 1 ? 100 : 44, 9); c.restore(); } }
    else if (m === 'river') { for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(0, 120 + i * 62); for (let x = 0; x <= W; x += 60) c.lineTo(x, 120 + i * 62 + Math.sin(x * 0.01 + t + i) * 9); c.stroke(); } }
    else if (m === 'forest') { for (let i = 0; i < 40; i++) { const x = (i * 197) % W, y = (i * 113) % H; c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x + 18, y + 16); c.lineTo(x - 18, y + 16); c.fill(); } }
    else if (m === 'wagon') { for (let i = 0; i < 10; i++) { c.strokeRect(70 + i * 150, H - 110, 110, 40); } }
    else if (m === 'cliff') { c.beginPath(); c.moveTo(0, 0); for (let x = 0; x <= W; x += 80) c.lineTo(x, 40 + ((x * 7) % 50)); c.lineTo(W, 0); c.fill(); }
    c.globalAlpha = 1;
  }
  // 딜미터: 협동이면 플레이어별, 단독이면 출전 유닛별
  function meterRows(dealt, total) {
    const rows = net ? net.roster().map((p) => ({ name: p.state.name || '?', v: p.me ? total : p.state.dmg || 0, me: p.me }))
      : Object.keys(dealt).map((k) => ({ name: k, v: dealt[k] }));
    return rows.sort((a, b) => b.v - a.v);
  }
  // 보스전 피해 순위: 접힌 한 줄이 기본이다. 내 줄(협동) 또는 1위 줄(혼자)을 "순위. 이름  피해 (몫%)"로만 보여 준다.
  // 누르면 펼쳐서 5위까지(S.meterOpen, 10-input이 meterHit으로 판정). 4초 뒤·기술 이름 띠가 뜰 때·보스전이 끝나면 다시 접힌다(아래, 16-hud).
  // 자리: 화면 고정 좌표(09 hudCam)에서 보스 체력 막대 오른쪽 끝 아래. 부르는 쪽의 변환은 쓰지 않고 여기서 직접 잡는다
  // (체력 막대와 같은 칸: 화면 위 가운데 기준 us배. 막대 폭 식은 07-arena bossBar와 같아야 한다).
  // 테·바탕은 UI 공통 판(.glass·.hb)과 같은 금 선·먹 바탕. 그린 상자는 캔버스 픽셀 좌표로 S.meterBox에 남긴다.
  function drawMeter(c, rows) {
    if (!rows.length || !S.base) return;
    const us = hudS(), BW = Math.min(760, 900 / us), w = 236, x = W / 2 + BW / 2 - w, y0 = 74, rh = 24, rp = 26;
    const top = rows[0].v || 1, sum = rows.reduce((a, b) => a + b.v, 0) || 1;
    // 펼친 표는 4초 뒤 저절로 접는다(카메라 위 끝에서 내 장수를 오래 가리지 않게). 기술 이름 띠(07 S.pattern)가 새로 뜨는 순간에도 접는다(띠가 첫 줄을 덮지 않게)
    const now = performance.now(), np = S.pattern && S.pattern.t > 0 && S.pattern !== S.meterPat;
    if (np) S.meterPat = S.pattern;
    if (!S.meterOpen) S.meterOpenAt = 0;
    else if (!S.meterOpenAt) S.meterOpenAt = now;
    if (S.meterOpen && (np || now - S.meterOpenAt > 4000)) { S.meterOpen = false; S.meterOpenAt = 0; }
    const open = !!S.meterOpen, mi = Math.max(0, rows.findIndex((r) => r.me));
    const list = open ? rows.slice(0, 5).map((r, i) => [r, i]) : [[rows[mi], mi]];
    const bh = open ? rh + list.length * rp + 4 : rh, UI = '"IBM Plex Sans KR", sans-serif';
    c.save();
    hudCam(c, 0, 0); c.translate(W / 2, hudTop()); c.scale(us, us); c.translate(-W / 2, 0);
    c.fillStyle = 'rgba(16, 11, 8, .6)'; c.fillRect(x, y0, w, bh);
    c.lineWidth = 1; c.strokeStyle = 'rgba(205, 167, 91, .55)'; c.strokeRect(x + 0.5, y0 + 0.5, w - 1, bh - 1);
    c.textBaseline = 'middle';
    if (open) {
      c.textAlign = 'left'; c.fillStyle = '#e6c578'; c.font = '700 15px "Gowun Batang", serif'; c.fillText(I.t('meter'), x + 8, y0 + rh / 2 + 1);
      c.textAlign = 'right'; c.font = '700 11px ' + UI; c.fillText('▲', x + w - 7, y0 + rh / 2 + 1);
    }
    list.forEach(([r, rank], i) => {
      const y = open ? y0 + rh + i * rp : y0 + 2, h = open ? rp - 4 : rh - 4, cy = y + h / 2 + 1, vr = open ? x + w - 8 : x + w - 22;
      c.fillStyle = r.me ? 'rgba(255, 216, 106, .32)' : 'rgba(205, 167, 91, .2)'; c.fillRect(x + 2, y, ((w - 4) * r.v) / top, h);
      c.font = '700 14px ' + UI; c.fillStyle = r.me ? '#ffe2a8' : '#f4ecd8';
      const val = `${fmt(r.v)} (${Math.round((r.v / sum) * 100)}%)`, vw = c.measureText(val).width;
      c.textAlign = 'right'; c.fillText(val, vr, cy);
      c.textAlign = 'left'; c.fillText(`${rank + 1}. ${r.name}`, x + 8, cy, Math.max(40, vr - vw - 10 - (x + 8)));
      if (!open) { c.textAlign = 'right'; c.fillStyle = '#e6c578'; c.font = '700 11px ' + UI; c.fillText('▼', x + w - 7, cy); }
    });
    const m = c.getTransform ? c.getTransform() : null;
    if (m) {
      const px = (u, v) => m.a * u + m.c * v + m.e, py = (u, v) => m.b * u + m.d * v + m.f;
      const xa = px(x, y0), xb = px(x + w, y0 + bh), ya = py(x, y0), yb = py(x + w, y0 + bh);
      S.meterBox = { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: Math.min(ya, yb), y1: Math.max(ya, yb), t: performance.now() };
    }
    c.restore();
  }
  // 누른 자리가 딜미터 위인가(방금 그린 상자 기준). 누르는 곳은 화면 44px 이상이 되게 넓힌다.
  function meterHit(e) {
    const B = S.meterBox;
    if (!B || performance.now() - B.t > 400) return false;
    const r = view.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const kx = view.width / r.width, ky = view.height / r.height, x = (e.clientX - r.left) * kx, y = (e.clientY - r.top) * ky;
    const gx = Math.max(0, (44 * kx - (B.x1 - B.x0)) / 2), gy = Math.max(0, (44 * ky - (B.y1 - B.y0)) / 2);
    return x >= B.x0 - gx && x <= B.x1 + gx && y >= B.y0 - gy && y <= B.y1 + gy;
  }
