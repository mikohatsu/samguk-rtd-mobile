  function drawLane(t) {
    const c = ctx;
    blitBg(c, mapCv, 'map', mapVer);
    drawFlags(c);
    for (const p of S.pings) { p.t += S.fdt; c.strokeStyle = p.c; c.globalAlpha = 1 - p.t / 0.5; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, 8 + p.t * 40, 0, 7); c.stroke(); c.globalAlpha = 1; }
    S.pings = S.pings.filter((p) => p.t < 0.5);
    for (const e of g.enemies) {
      if (e.mid) {
        c.strokeStyle = '#e8c15a'; c.lineWidth = 3; c.beginPath(); c.ellipse(e.x, e.y + 20, 28, 12, 0, 0, 7); c.stroke();
        const v = [2, 0, 2, 4][e.seg], fr = Math.sin(t * 13) > 0 ? 1 : 2, img = e.w.look ? Art.namedSprite(e.w.name, e.w.look, '#b5361f', v, fr) : Art.soldierSprite({ name: e.w.name, color: '#b5361f', hat: 'helm', weapon: 'guandao' }, v, fr);
        // 놓치기 10초 전: 붉은 오라가 발밑에서 천천히 차올랐다가 가라앉기를 2초마다 되풀이(깜빡임·떨림 없음)
        const warn = e.midT <= 10;
        if (warn) {
          const w = (1 - Math.cos(t * Math.PI)) / 2, top = e.y + 26 - (30 + w * 70), base = e.y + 26;
          c.save(); c.globalCompositeOperation = 'lighter';
          const gr = c.createLinearGradient(0, base, 0, top);
          gr.addColorStop(0, 'rgba(255,50,30,.55)'); gr.addColorStop(0.6, 'rgba(255,60,30,.22)'); gr.addColorStop(1, 'rgba(255,60,30,0)');
          c.fillStyle = gr; c.beginPath(); c.ellipse(e.x, (base + top) / 2, 40, (base - top) / 2 + 6, 0, 0, 7); c.fill();
          c.globalAlpha = 0.5; c.strokeStyle = '#ff4a3a'; c.lineWidth = 3; c.beginPath(); c.ellipse(e.x, e.y + 20, 36, 15, 0, 0, 7); c.stroke();
          c.restore();
        }
        Art.drawSprite(c, img, e.x, e.y, 96, e.seg === 2);
        bar(c, e.x, e.y - 50, 74, 6, e.hp / e.mhp, '#ff6a50');
        c.textAlign = 'center';
        if (warn) { c.fillStyle = '#ff6a50'; c.font = '400 22px "Black Han Sans", sans-serif'; c.fillText(I.t('midLeft', { name: e.w.name, n: Math.ceil(e.midT) }), e.x, e.y - 60); }
        else { c.fillStyle = '#ffe9a8'; c.font = '700 15px "IBM Plex Sans KR", sans-serif'; c.fillText(`${e.w.name} ${Math.ceil(e.midT)}`, e.x, e.y - 58); }
      } else {
        const hit = (e.hitT || 0) / 0.14, ex = e.x + Math.cos(e.hitA || 0) * 7 * hit, ey = e.y + Math.sin(e.hitA || 0) * 7 * hit - Math.abs(Math.sin(t * 12 + e.id)) * 3;
        const v = [2, 0, 2, 4][e.seg], img = Art.soldierSprite(e.w, v, Math.sin(t * 11 + e.id) > 0 ? 1 : 2), sz = e.elite ? 96 : 60;
        if (e.elite) {
          // 군웅할거 정예: 중간보스만 한 크기에 금빛 오라(바닥 빛 + 발밑 고리 + 솟는 빛)
          const pu = 0.75 + Math.sin(t * 4 + e.id) * 0.25;
          c.save(); c.globalCompositeOperation = 'lighter';
          const gr = c.createRadialGradient(ex, ey + 4, 6, ex, ey + 4, 64);
          gr.addColorStop(0, `rgba(255,216,106,${0.5 * pu})`); gr.addColorStop(0.55, `rgba(255,170,60,${0.22 * pu})`); gr.addColorStop(1, 'rgba(255,150,40,0)');
          c.fillStyle = gr; c.beginPath(); c.arc(ex, ey + 4, 64, 0, 7); c.fill();
          for (let i = 0; i < 4; i++) { const ph = (t * 0.9 + i / 4 + e.id * 0.13) % 1; c.globalAlpha = Math.sin(ph * Math.PI) * 0.7; c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(ex + Math.sin(i * 1.9 + t) * 22, ey + 20 - ph * 70, 2.5, 0, 7); c.fill(); }
          c.restore();
          c.strokeStyle = '#ffd86a'; c.lineWidth = 3; c.beginPath(); c.ellipse(ex, ey + 22, 30, 12, 0, 0, 7); c.stroke();
        }
        Art.drawSprite(c, img, ex, ey, sz, e.seg === 2, hit * 0.25);
        if (hit > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = hit * 0.8; Art.drawSprite(c, img, ex, ey, sz, e.seg === 2, hit * 0.25); c.restore(); }
        if (e.elite) bar(c, e.x, e.y - 50, 74, 6, e.hp / e.mhp, '#ffd86a');
        else if (e.hp < e.mhp) bar(c, e.x, e.y - 30, 28, 3, e.hp / e.mhp, '#ff6a50');
      }
    }
    for (const d of g.drops) {
      if (d.owner !== 0) continue;
      const bob = Math.sin(t * 3 + d.id) * 2, selected = S.dropSel === d.id;
      if (selected) { c.strokeStyle = '#7dff8e'; c.lineWidth = 2; c.beginPath(); c.ellipse(d.x, d.y + 3, 27, 22, 0, 0, 7); c.stroke(); }
      const dimg = Art.img(d.kind === 'chest' ? 'prop_chest' : d.kind === 'item' ? 'prop_scroll' : 'prop_' + d.kind);
      if (dimg) { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(d.x, d.y + 16, 20, 7, 0, 0, 7); c.fill(); c.drawImage(dimg, d.x - 24, d.y - 26 + bob, 48, 48 * (dimg.height / dimg.width)); continue; }
      c.fillStyle = d.kind === 'chest' ? '#7a3b1c' : '#2a2140'; c.strokeStyle = '#ffd86a'; c.lineWidth = 2.5;
      c.fillRect(d.x - 17, d.y - 15 + bob, 34, 30); c.strokeRect(d.x - 17, d.y - 15 + bob, 34, 30);
      c.fillStyle = '#ffe9a8'; c.font = '900 21px "Noto Serif KR", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(d.kind === 'chest' ? T.chestMark : d.kind === 'item' ? T.itemMark : T.consumables[d.kind].mark, d.x, d.y + 1 + bob);
    }
    const sel = new Set(S.sel);
    for (const u of g.units) {
      // 라인 유닛 크기(등급이 높을수록 큼). 폰에서 알아보기 쉽게 15% 키웠다(1.3 → 1.5). 정렬 칸 간격(42)은 그대로라 줄 세우면 살짝 겹친다.
      const r = (15 + Math.min(u.def.tier, 10) * 0.8) * 1.5;
      if (sel.has(u.id)) { c.strokeStyle = '#7dff8e'; c.lineWidth = 2; c.beginPath(); c.ellipse(u.x, u.y + 3, r + 7, r + 4, 0, 0, 7); c.stroke(); }
      const away = g.inFight(u);
      if (away) c.globalAlpha = 0.35;
      piece(c, u.x, u.y + (u.def.tier ? 0 : Math.sin(t * 3 + u.x) * 3), u.def.tier ? r : 30, u.def, t, u.owner === 1, { pose: poseOf(u, t, r) });
      if (away) { c.globalAlpha = 1; c.fillStyle = '#ffd86a'; c.font = '700 14px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(I.t('deployed'), u.x, u.y - r - 10); }
      if (!u.def.tier) { c.fillStyle = '#ffe9a8'; c.strokeStyle = 'rgba(32,21,12,.85)'; c.lineWidth = 4; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText(u.def.name, u.x, u.y + 46); c.fillText(u.def.name, u.x, u.y + 46); }
    }
    if (S.sel.length === 1) {
      const u = g.units.find((x) => x.id === S.sel[0]);
      if (u && u.def.tier > 0) { c.strokeStyle = 'rgba(125,255,142,.28)'; c.lineWidth = 1; c.beginPath(); c.arc(u.x, u.y, g.range(u.def), 0, 7); c.stroke(); }
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
        c.strokeStyle = '#e8c15a'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 20, 28, 12, 0, 0, 7); c.stroke();
        Art.drawSprite(c, img, x, y, 76, seg === 2); bar(c, x, y - 50, 74, 6, h / 20, '#ff6a50');
      } else {
        Art.drawSprite(c, Art.soldierSprite(T.waves[k] || T.waves[0], v, fr), x, y, 48, seg === 2);
        if (h < 20) bar(c, x, y - 30, 28, 3, h / 20, '#ff6a50');
      }
    });
    // 다른 사령관 유닛은 클릭해서 정보만 볼 수 있다
    const hits = [], rs = S.rsel && S.rsel.peer === peer.id ? S.rsel : null;
    let found = false;
    fr0.u.forEach(({ id, i, x, y, f, m, a, atk }) => {
      const d = T.units[i]; if (!d) return;
      const r = d.tier ? (15 + Math.min(d.tier, 10) * 0.8) * 1.3 : 30;
      if (rs && rs.id === id) { found = true; rs.atk = atk; c.strokeStyle = '#ffd86a'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 3, r + 7, r + 4, 0, 0, 7); c.stroke(); }
      piece(c, x, y, r, d, t, false, { pose: poseOf({ face: f / 10, moveT: m ? 0.1 : 0, atkT: a ? 0.1 : 0, id, def: d }, t, r) });
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
  function drawMeter(c, rows) {
    if (!rows.length) return;
    const x = W - 66 - 300, w = 300, top = rows[0].v || 1, sum = rows.reduce((a, b) => a + b.v, 0) || 1;
    c.fillStyle = 'rgba(16, 11, 8, .72)'; c.fillRect(x - 10, 66, w + 20, 44 + rows.length * 34);
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = '#e6c578'; c.font = '700 20px "Gowun Batang", serif'; c.fillText(I.t('meter'), x, 88);
    rows.slice(0, 5).forEach((r, i) => {
      const y = 108 + i * 34;
      c.fillStyle = r.me ? 'rgba(125,255,142,.4)' : 'rgba(255,190,90,.36)'; c.fillRect(x, y, (w * r.v) / top, 28);
      c.fillStyle = '#fff'; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'left'; c.fillText(r.name, x + 8, y + 15);
      c.textAlign = 'right'; c.fillText(`${fmt(r.v)} (${Math.round((r.v / sum) * 100)}%)`, x + w - 8, y + 15);
    });
  }
