  // 스킬 이펙트를 쓴 장수의 등급(이펙트 모양 vx와 색이 같은 스킬을 가진 결투장 장수 중 가장 높은 등급). 처음 볼 때 한 번 찾고,
  // 그때 신화·불멸이면 흔들림을 더한다. 게임 객체에는 아무것도 붙이지 않는다.
  // 묵직한 소리는 여기서 내지 않는다(2026-11-25): 엔진의 스킬 소리 이벤트(sk·skb)가 등급 무게를 명중 순간에 싣는다.
  // 예전 skillHi/skillMax는 연출을 처음 그릴 때 울려 원형 스킬은 시점이 어긋났고, 치료·방어 같은 기운 스킬에도 폭발 쿵이 났다.
  const SKT = new WeakMap();
  function skillTier(f) {
    let v = SKT.get(f);
    if (v != null) return v;
    v = 0;
    const fi = g.fight;
    if (fi) for (const ch of fi.champs) if (ch.def.tier > v && (ch.def.sk || []).some((s) => s.vx === f.vx && s.fx === f.c)) v = ch.def.tier;
    SKT.set(f, v);
    if (v >= 9 && f.t < 0.15) {
      S.shake = Math.max(S.shake || 0, v >= 10 ? 0.9 : 0.6);
      if (v >= 10) S.skFlash = { t: 0, c: f.c };
    }
    return v;
  }
  // 불멸 스킬: 화면이 스킬 색으로 0.25초 옅게 물든다(전체 화면 사각형 하나)
  function drawSkFlash(c) {
    const fl = S.skFlash;
    if (!fl) return;
    fl.t += S.fdt;
    if (fl.t > 0.25) { S.skFlash = null; return; }
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.22 * (1 - fl.t / 0.25); c.fillStyle = fl.c; c.fillRect(-W, -H, W * 3, H * 3); c.restore();
  }
  // 연출 이름이 없는 이펙트의 기본 연출(skillfx.js): 직선은 찌르기, 부채꼴은 난무, 기운은 색으로 회복·호령·강화
  const DEF_VX = { beam: 'thrust', cone: 'blades' };
  function defVx(f) { return DEF_VX[f.k] || (f.k === 'aura' ? (f.c === '#8ee6a0' ? 'heal' : f.c === '#ffe07a' ? 'rally' : 'power') : null); }
  // 게임 상태(g.fx)는 고치지 않고, 연출 이름을 붙인 사본을 이펙트마다 한 번 만들어 둔다
  const VXC = new WeakMap();
  function withVx(f, vx) { let o = VXC.get(f); if (!o) { o = Object.create(f); o.vx = vx; VXC.set(f, o); } return o; }
  // 스킬 연출은 엔진 수명보다 길게 그린다(skillfx extra: 강화류는 +0.5초 늘여 천천히, 직선·부채꼴·폭발은 끝난 뒤 여운 +0.45~0.6초.
  // 2026-11-26 전투 이펙트 개편, 불멸 강화류 +0.2초는 2026-11-25 검토 4-1). 엔진이 g.fx에서 지운 뒤에도
  // 화면 쪽 사본으로 남은 몫을 마저 그린다(게임 상태는 고치지 않는다). 동시에 남는 여운은 LING_MAX개까지(오래된 것부터 버림).
  const LING = new Map(), LING_MAX = 14; let fxFr = 0;
  function drawFx(c) {
    if (window.RTD_SKFX) window.RTD_SKFX.setQuality(Q.level === 'low' ? 0.5 : Q.level === 'mid' ? 0.75 : 1);
    fxFr++;
    for (const f of g.fx) {
      if (f.t < 0) continue;
      let p = f.t / f.life;
      // 스킬 연출(skillfx.js, 그림·프레임 애니메이션). 연출 이름(vx)이 없는 직선·부채꼴·폭발·기운도 기본 연출로 그린다.
      const SK = window.RTD_SKFX, dvx = f.vx || defVx(f);
      if (dvx && SK) {
        const ff = f.vx ? f : withVx(f, dvx), tr = f.vx ? skillTier(f) : 0, ex = SK.extra ? SK.extra(f, tr) : 0;
        if (ex) { LING.set(f, { f: ff, t: f.t, life: f.life + ex, tier: tr, fr: fxFr }); if (LING.size > LING_MAX) LING.delete(LING.keys().next().value); }
        if (SK.fxT ? SK.fxT(c, ff, f.t, tr, !f.vx) : SK.fx(c, ff, ex ? f.t / (f.life + ex) : p, tr)) { c.globalAlpha = 1; continue; }
      }
      if (f.k === 'shot') { c.globalAlpha = Math.min(1, (1 - p) * 3); Art.shot(c, f); c.globalAlpha = 1; continue; }
      c.globalAlpha = 1 - p;
      // 작은 충격파: 프레임 애니메이션 고리
      if (f.k === 'ring') Art.fxAnim(c, 'wave', p, f.x, f.y, f.r * 2.6, f.r * 2.6, 0, 1, null, { col: f.c });
      // 타격: 프레임 애니메이션(평타는 작은 타격, 강타·스킬은 큰 타격)
      else if (f.k === 'spark') { if (!Art.fxAnim(c, f.r < 60 ? 'hit2' : 'hit', p, f.x, f.y, f.r * 3.2, f.r * 3.2, f.a, 1)) Art.fxImg(c, 'hit', f.x, f.y, f.r * 2.4 * (0.7 + p * 0.5), f.a, 1 - p); }
      else if (f.k === 'die') {
        // 처치: 튕겨 나가며 쓰러진다
        c.globalAlpha = 1 - p;
        Art.drawSprite(c, f.e.mid && f.e.w.look ? Art.namedSprite(f.e.w.name, f.e.w.look, '#b5361f') : Art.soldierSprite(f.e.w), f.x + Math.cos(f.a) * 34 * p, f.y + Math.sin(f.a) * 34 * p - Math.sin(p * 3.14) * 22, f.e.mid ? 76 : 48, false, p * 1.5);
      } else if (f.k === 'dash' && SK) {
        // 돌진 자국: Kenney 빛줄기 그림을 출발점에서 도착점까지 늘여 그린다
        const dx = f.x1 - f.x0, dy = f.y1 - f.y0;
        SK.spr(c, 'trace_06', f.c, (f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 70 * (1 - p) + 16, Math.hypot(dx, dy) + 30, Math.atan2(dy, dx) + Math.PI / 2, 1 - p);
      } else if (f.k === 'cone') Art.fxImg(c, 'slash', f.x + Math.cos(f.a) * f.r * 0.55, f.y + Math.sin(f.a) * f.r * 0.55, f.r * 1.3, f.a + Math.PI / 2, (1 - p) * 1.5);
      else if (f.k === 'blast') { if (!Art.fxAnim(c, 'boom', p, f.x, f.y - f.r * 0.2, f.r * 3.4, f.r * 3.4, 0, 1)) Art.fxImg(c, 'boom', f.x, f.y, f.r * 2.6 * (0.7 + p * 0.5), p, (1 - p) * 1.4); Art.fxAnim(c, 'wave', p, f.x, f.y, f.r * 3.2, f.r * 3.2, 0, 1, null, { col: f.c, sy: 0.6 }); }
      else if (f.k === 'aura') Art.fxImg(c, 'magic', f.x, f.y + 20, f.r * 2.4, p * 2, (1 - p) * 1.2, 0.45);
      // (그림을 아직 못 받았을 때 도형으로 대신 그리던 것은 뺐다: 그림은 첫 화면에서 이미 받는다)
    }
    // 엔진이 지운 불멸 강화류 연출의 남은 0.2초
    for (const [k, o] of LING) {
      if (o.fr === fxFr) continue;
      o.t += S.fdt || 0;
      // 시간이 멈춘 동안(일시정지 등) 끝없이 남지 않게 40프레임이 지나면 버린다
      if (o.t >= o.life || fxFr - o.fr > 40 || !window.RTD_SKFX) { LING.delete(k); continue; }
      if (window.RTD_SKFX.fxT) window.RTD_SKFX.fxT(c, o.f, o.t, o.tier); else window.RTD_SKFX.fx(c, o.f, o.t / o.life, o.tier);
    }
    c.globalAlpha = 1;
    drawSkFlash(c);
  }
  // 작은 화면(휴대폰)에서는 전장이 축소돼 글씨가 깨알만 해진다. 전장 위 글씨·막대를 그만큼 키우는 배율(1~1.7).
  const uiS = () => Math.max(1, Math.min(1.7, 0.62 / ((S.base && S.base.s0 ? S.base.s0 : 1) * (S.cam ? S.cam.z : 1))));
  function drawText(c) {
    c.textAlign = 'center';
    const us = uiS();
    for (let i = S.dmg.length - 1; i >= 0; i--) {
      const d = S.dmg[i]; d.t += S.fdt;
      if (d.proc) {
        // 패시브 발동 글자: 튀어나오듯 커졌다가 떠오르며 사라진다
        if (d.t > 1.1) { S.dmg.splice(i, 1); continue; }
        const s = d.t < 0.12 ? 0.6 + d.t / 0.12 * 0.6 : 1.2 - Math.min(0.2, (d.t - 0.12));
        c.save(); c.translate(d.x, d.y - d.t * 34); c.scale(s * us, s * us);
        c.globalAlpha = d.t > 0.8 ? (1.1 - d.t) / 0.3 : 1;
        c.font = '400 26px "Black Han Sans", sans-serif'; c.lineJoin = 'round';
        c.strokeStyle = 'rgba(20,12,6,.9)'; c.lineWidth = 6; c.strokeText(d.v, 0, 0);
        c.shadowColor = d.c; c.shadowBlur = 14; c.fillStyle = '#fff6c8'; c.fillText(d.v, 0, 0);
        c.restore();
        continue;
      }
      if (d.hit || d.big) {
        // 보스 피해 숫자: 톡 튀어나왔다가 떠오르며 사라진다. 강타는 크고 금빛으로 통통 튄다.
        const L = d.big ? 1.0 : 0.7;
        if (d.t > L) { S.dmg.splice(i, 1); continue; }
        const s = d.t < 0.08 ? 0.5 + d.t / 0.08 * (d.big ? 1.0 : 0.6) : (d.big ? 1.5 : 1.1) - Math.min(d.big ? 0.4 : 0.1, (d.t - 0.08) * 2);
        c.save(); c.translate(d.x, d.y - d.t * (d.big ? 40 : 55)); c.scale(s * us, s * us);
        c.globalAlpha = d.t > L - 0.25 ? (L - d.t) / 0.25 : 1;
        c.font = `400 ${d.big ? 34 : 22}px "Black Han Sans", sans-serif`; c.lineJoin = 'round';
        c.strokeStyle = 'rgba(16,8,4,.95)'; c.lineWidth = d.big ? 7 : 5; const txt = typeof d.v === 'string' ? d.v : fmt(d.v); c.strokeText(txt, 0, 0);
        if (d.big) { c.shadowColor = '#ff9a2a'; c.shadowBlur = 16; }
        c.fillStyle = d.big ? '#ffd24a' : d.ally ? '#a8dcff' : '#fff4dc'; c.fillText(txt, 0, 0); // 동료(협동·AI 동맹) 타격 숫자는 하늘색(07-arena allyHit)
        c.restore();
        continue;
      }
      if (d.t > 0.8) { S.dmg.splice(i, 1); continue; }
      // 라인 피해 숫자: 전장 위 숫자는 굵은 제목 글꼴 하나로(명조를 섞지 않는다) + 먹 테두리
      const tx = typeof d.v === 'string' ? d.v : fmt(d.v);
      c.globalAlpha = 1 - d.t / 0.8; c.lineJoin = 'round'; c.lineWidth = 4 * us; c.strokeStyle = 'rgba(16,8,4,.85)';
      c.font = `400 ${Math.round((d.big ? 30 : 20) * us)}px "Black Han Sans", sans-serif`; c.strokeText(tx, d.x, d.y - d.t * 50);
      c.fillStyle = d.big ? '#ffd86a' : '#fff'; c.fillText(tx, d.x, d.y - d.t * 50);
    }
    c.globalAlpha = 1;
  }

  // 업적 깃발: 위아래 여백에 나란히 세운다. 달성하면 색이 차고 금색 별이 붙는다.
  const ACH_COLOR = { collect: '#4d8fd8', speed: '#e0b13c', bond: '#c9483a', party: '#46a868' };
  const achKind = (a) => (a.cond.type === 'party' ? 'party' : a.cond.type === 'speed' ? 'speed' : a.cond.type === 'have' || a.cond.type === 'haveSet' || (a.cond.type === 'haveEach' && a.cond.units.length < 5) ? 'bond' : 'collect');
  const achTier = (a) => { const c = a.cond, ids = c.units || c.anyOf || []; return c.tier || c.sameTierDistinct || ids.reduce((m, id) => Math.max(m, defOf[id] ? defOf[id].tier : 0), 1); };
  // 깃발 글자: 수집은 등급, 전광석화는 전장, 나머지는 첫 낱말 첫 글자 + 끝 낱말 첫 글자
  const achLabel = (a) => {
    const k = achKind(a);
    if (k === 'collect' && (a.cond.type === 'ever' || a.cond.type === 'haveEach')) return rankTag(achTier(a));
    const n = a.name.replace(/^[[［][^\]］]*[\]］]\s*/, '').replace(/^[^:：]*[:：]\s*/, ''), w = n.split(' ');
    if (k === 'speed' || w.length === 1) return n.slice(0, 2);
    return w[0][0] + w[w.length - 1][0];
  };
  // 깃발 자리(flagLayout): 전장 좌표가 아니라 화면 고정 좌표(무대 CSS px)로 잡는다.
  // 화면 비율마다 맵이 보이는 폭이 달라서, 전장 오른쪽 여백에 박아 두면 휴대폰·태블릿에서 오른쪽 버튼 열(#rail)·배속 버튼(#tr) 밑에 깔렸다.
  // 길 바깥 가장자리 ~ 오른쪽 버튼 열 사이의 빈 띠를 DOM 단추 위치로 재고, 그 안에 깃발이 가장 크게 들어가는 열 수를 골라 격자로 세운다.
  const FLAGS = T.achievements.map((a) => ({ a }));
  const FCW = 60, FCH = 72, FKMIN = 0.5; // 깃발 한 칸(그림 단위). 빈 띠가 좁아 이 배율(FKMIN)도 안 나오면 띠를 길 쪽으로 넓힌다(깃발은 유닛·적 밑에 깔린다)
  let flagL = null, flagLT = 0;
  function flagLayout() {
    const B = S.base, now = performance.now();
    // DOM 위치 재기는 0.5초에 한 번(화면 크기가 바뀌면 바로)
    if (flagL && flagL.sw === B.sw && flagL.sh === B.sh && flagL.dpr === B.dpr && now - flagLT < 500) return flagL;
    flagLT = now;
    const st = $('stage').getBoundingClientRect(), kx = B.sw / (st.width || 1), ky = B.sh / (st.height || 1);
    const box = (el) => { if (!el || el.hidden || !el.getClientRects().length) return null; const r = el.getBoundingClientRect(); return r.width ? { l: (r.left - st.left) * kx, t: (r.top - st.top) * ky, r: (r.right - st.left) * kx, b: (r.bottom - st.top) * ky } : null; };
    const pad = 6, rail = box($('rail')), th = 24, n = FLAGS.length;
    const right = (rail ? rail.l : B.sw - 8) - pad;
    // 길 바깥 가장자리(길 가운데 줄 + 44단위), 카메라를 푼 바탕 배율 기준
    const edge = B.sw / 2 + (ROAD.x1 + 44 - W / 2) * B.s0;
    let top = pad, bot = B.sh - pad, left = Math.max(pad, Math.min(edge, right - 40));
    // 위아래 단추(배속·메뉴, 보스전 버튼, 내 전장으로, 라인 공격 버튼)와 겹치는 만큼 띠를 줄인다
    const clip = () => ['tr', 'bossbtn', 'backbtn', 'skillbar'].forEach((id) => { const r = box($(id)); if (!r || r.r <= left || r.l >= right) return; if ((r.t + r.b) / 2 < B.sh / 2) top = Math.max(top, r.b + pad); else bot = Math.min(bot, r.t - pad); });
    const best = (w) => { let o = null; for (let cols = 1; cols <= 8; cols++) { const rows = Math.ceil(n / cols), k = Math.min(1, w / (cols * FCW), (bot - top - th) / (rows * FCH)); if (!o || k > o.k) o = { cols, rows, k }; } return o; };
    clip();
    let G = best(right - left);
    if (G.k < FKMIN) {
      // 좁은 화면(4:3 태블릿 등): FKMIN 배율이 나오는 가장 좁은 폭까지 띠를 왼쪽(길 쪽)으로 넓힌다
      for (let cols = 1; cols <= 8; cols++) if ((bot - top - th) / (Math.ceil(n / cols) * FCH) >= FKMIN) { left = Math.max(pad, right - cols * FCW * FKMIN); break; }
      clip(); G = best(right - left);
    }
    // 격자는 띠 아래쪽에 붙인다(2026-11-23 사용자 요청: 위 배속·메뉴 단추와 멀리). 칸 간격은 늘리지 않고 그림 칸 크기 그대로
    const cw = FCW * G.k, ch = FCH * G.k, gw = cw * G.cols, x0 = left + (right - left - gw) / 2, y0 = bot - G.rows * ch;
    FLAGS.forEach((f, i) => { f.x = x0 + Math.floor(i / G.rows) * cw; f.y = y0 + (i % G.rows) * ch; f.w = cw; f.h = ch; });
    flagL = { sw: B.sw, sh: B.sh, dpr: B.dpr, l: Math.floor(Math.min(left, x0)), t: Math.floor(y0 - th), r: Math.ceil(Math.max(right, x0 + gw)), b: Math.ceil(bot), k: G.k, cols: G.cols, cx: x0 + gw / 2, th };
    flagL.key = [flagL.l, flagL.t, flagL.r, flagL.b, G.k.toFixed(3), G.cols].join();
    flagL.cells = FLAGS.map((f) => [f.x, f.y, f.w, f.h]);
    S.flagL = flagL; // 시험·디버그용(무대 CSS px의 깃발 칸 x·y·w·h)
    return flagL;
  }
  // 전황: 왼쪽 맵 여백에 세로로 놓는다
  function drawStats() {
    const c = ctx, vp = viewedPeer(), ln = vp && vp.state.ln;
    const gold = ln ? ln.g : g.me.gold, lives = ln ? ln.l : g.lives, en = ln ? ln.n : g.enemyCount(), own = ln ? ln.u.length : g.units.filter((u) => u.owner === 0).length;
    const rows = [
      [I.t('round'), `${g.round}/${g.diff.rounds}`, '#ffd86a'], [g.diff.name, g.phase === 'wave' ? clock(Math.max(0, g.R.roundTime - g.roundT)) : g.phase === 'boss' && g.fight ? I.t('duel') + ' ' + clock(Math.max(0, g.fight.limit - g.fight.t)) : I.t('duel'), '#f4ecd8'],
      [T.currency, fmt(gold), '#ffd86a'], [I.t('lives'), `${lives}/${g.R.lives}`, lives <= 5 ? '#ff7a60' : '#f4ecd8'],
      [I.t('front'), `${en}/${g.limit}`, en > g.limit * 0.75 ? '#ff7a60' : '#f4ecd8'], [I.t('troops'), String(own), '#f4ecd8'],
    ];
    const x = 10, w = 128, y0 = 130, step = 112;
    c.fillStyle = 'rgba(20, 14, 10, .78)'; c.fillRect(x, y0, w, step * rows.length + 16);
    c.strokeStyle = '#cda75b'; c.lineWidth = 2; c.strokeRect(x, y0, w, step * rows.length + 16);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    rows.forEach(([l, v, col], i) => {
      const y = y0 + 8 + i * step;
      c.fillStyle = '#b8a888'; c.font = '500 21px "IBM Plex Sans KR", sans-serif'; c.fillText(l, x + w / 2, y + 30);
      c.fillStyle = col; c.font = `400 ${v.length > 6 ? 30 : 38}px "Black Han Sans", sans-serif`; c.fillText(v, x + w / 2, y + 70);
    });
  }
  // 깃발 28개는 글자·도형이 많아 매 프레임 그리면 무겁다. 달성 상태가 바뀔 때만 다시 그려 두고 한 장으로 찍는다.
  let flagCv = null, flagKey = '';
  // 깃발 그림(gfx/ach_*.png, Higgsfield 생성): 밝은 천 그림을 등급 색으로 물들여 쓴다. 종류: 수집=깃발, 전광석화=펄럭이는 기, 협동=세로 군기, 인연=성루
  const ACH_PIC = { collect: 'flag', speed: 'pennant', party: 'banner', bond: 'castle' }, ACH_IM = {}, ACH_TINT = {};
  let achLoaded = 0;
  if (typeof Image !== 'undefined') Object.values(ACH_PIC).forEach((n) => { const im = new Image(); im.onload = () => { ACH_IM[n] = im; achLoaded++; }; im.src = 'gfx/ach_' + n + '.png?v=1'; });
  function achSprite(n, col) {
    const im = ACH_IM[n], key = n + col;
    if (!im) return null;
    if (!ACH_TINT[key]) {
      const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
      const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
      // 곱하기로 물들여 천의 주름·명암을 살리고, 원래 모양대로 다시 잘라 낸다
      x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
      ACH_TINT[key] = cv;
    }
    return ACH_TINT[key];
  }
  function drawFlags(c) {
    const L = flagLayout(), dpr = S.base.dpr;
    const key = Object.keys(g.me.done).join() + '|' + g.mode + g.party + '|' + (I.lang || '') + '|' + achLoaded + '|' + L.key + '|' + dpr;
    if (flagKey !== key || !flagCv) {
      flagKey = key;
      if (!flagCv) flagCv = document.createElement('canvas');
      flagCv.width = Math.max(1, Math.ceil((L.r - L.l) * dpr)); flagCv.height = Math.max(1, Math.ceil((L.b - L.t) * dpr));
      const x = flagCv.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, -L.l * dpr, -L.t * dpr);
      paintFlags(x, L);
    }
    // 화면 고정 좌표(카메라·흔들림과 무관)로 찍는다. 유닛·적은 이 위에 그려진다.
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(flagCv, Math.round(L.l * dpr), Math.round(L.t * dpr)); c.restore();
  }
  function paintFlags(c, L) {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.font = '400 20px "Black Han Sans", sans-serif'; c.strokeStyle = 'rgba(32, 21, 12, .85)'; c.lineWidth = 4;
    c.strokeText(I.t('ach'), L.cx, L.t + L.th / 2); c.fillStyle = '#e6c578'; c.fillText(I.t('ach'), L.cx, L.t + L.th / 2);
    for (const f of FLAGS) {
      const done = g.me.done[f.a.id], kind = achKind(f.a), col = tierColor(achTier(f.a));
      // 인원이 모자라 열리지 않는 협동 업적은 흐리게
      const closed = kind === 'party' && !g.partyAchOpen(f.a.cond);
      c.globalAlpha = done ? 1 : closed ? 0.18 : 0.55;
      // 칸 왼쪽 아래를 원점으로, 그림 단위(칸 60×72)를 배율 k로 줄여 그린다
      c.save(); c.translate(f.x, f.y + f.h - 4 * L.k); c.scale(L.k, L.k);
      const label = achLabel(f.a);
      const sp = achSprite(ACH_PIC[kind], col);
      if (sp) {
        // 그림 깃발: 종류마다 그림 비율이 달라 칸(54×62, 성루는 58×62) 안에 맞춰 넣고, 칸 가운데·같은 바닥선에 세운다(칸이 어긋나 보이지 않게)
        const fk = Math.min((kind === 'bond' ? 58 : 54) / sp.width, 62 / sp.height), ww = sp.width * fk, hh = sp.height * fk, dx = (FCW - ww) / 2, AT = { collect: [0.56, 0.47], speed: [0.56, 0.36], party: [0.52, 0.43], bond: [0.5, 0.66] }[kind];
        c.drawImage(sp, dx, -hh, ww, hh);
        // 깃발 글자: 휴대폰에서 깨알이 되지 않게 천 폭에 맞는 한도에서 키우고 굵은 제목 글꼴로
        c.fillStyle = '#fff'; c.strokeStyle = 'rgba(20,14,10,.9)'; c.lineWidth = 5; c.font = `400 ${label.length > 2 ? 17 : 21}px "Black Han Sans", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        const tx = dx + ww * AT[0], ty = -hh + hh * AT[1];
        c.strokeText(label, tx, ty); c.fillText(label, tx, ty);
        if (done) { const sx = Math.min(FCW - 6, dx + ww - 2); c.fillStyle = '#ffd86a'; c.strokeStyle = 'rgba(20,14,10,.9)'; c.lineWidth = 3; c.font = '900 19px "Noto Serif KR", serif'; c.strokeText('★', sx, -hh + 6); c.fillText('★', sx, -hh + 6); }
        c.restore(); c.globalAlpha = 1; continue;
      }
      c.translate(7, 0); // 그림을 못 불렀을 때의 도형 깃발도 칸 안쪽으로
      if (kind === 'speed' || kind === 'party') {
        // 전광석화는 삼각 깃, 협동은 세로 군기. 테두리 색으로 종류를 한 번 더 구분한다.
        c.strokeStyle = '#2a1c10'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -60); c.stroke();
        c.fillStyle = col; c.strokeStyle = ACH_COLOR[kind]; c.lineWidth = 3; c.beginPath();
        if (kind === 'speed') { c.moveTo(0, -60); c.lineTo(50, -42); c.lineTo(0, -24); }
        else { c.moveTo(2, -60); c.lineTo(40, -60); c.lineTo(40, -18); c.lineTo(21, -26); c.lineTo(2, -18); }
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#fff'; c.strokeStyle = 'rgba(20,14,10,.8)'; c.lineWidth = 3; c.font = '700 15px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.strokeText(label, kind === 'speed' ? 16 : 21, kind === 'speed' ? -42 : -40); c.fillText(label, kind === 'speed' ? 16 : 21, kind === 'speed' ? -42 : -40);
      } else if (kind === 'bond') {
        // 인연 업적은 성 모양
        c.fillStyle = col; c.fillRect(0, -44, 46, 44);
        for (let i = 0; i < 3; i++) c.fillRect(i * 19, -54, 8, 11);
        c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(23, -4, 7, Math.PI, 0); c.lineTo(30, 0); c.lineTo(16, 0); c.fill();
        c.strokeStyle = '#2a1c10'; c.lineWidth = 2; c.strokeRect(0, -44, 46, 44);
        c.fillStyle = '#fff'; c.strokeStyle = 'rgba(20,14,10,.8)'; c.lineWidth = 3; c.font = '700 16px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText(label, 23, -24); c.fillText(label, 23, -24);
      } else {
        c.strokeStyle = '#2a1c10'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -60); c.stroke();
        c.fillStyle = col; c.beginPath(); c.moveTo(0, -60); c.lineTo(46, -49); c.lineTo(37, -37); c.lineTo(46, -24); c.lineTo(0, -24); c.closePath(); c.fill();
        c.fillStyle = '#fff'; c.strokeStyle = 'rgba(20,14,10,.8)'; c.lineWidth = 3; c.font = '700 16px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText(label, 19, -41); c.fillText(label, 19, -41);
      }
      if (done) { c.fillStyle = '#ffd86a'; c.font = '900 18px "Noto Serif KR", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', 42, -56); }
      c.restore();
      c.globalAlpha = 1;
    }
  }
  // e: 포인터 이벤트(화면 좌표). 깃발 칸 전체가 누르는 자리다.
  const flagAt = (e) => {
    if (!flagL) return null;
    const r = view.getBoundingClientRect(), x = ((e.clientX - r.left) / (r.width || 1)) * S.base.sw, y = ((e.clientY - r.top) / (r.height || 1)) * S.base.sh;
    return FLAGS.find((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) || null;
  };
  function showFlag(f, e) {
    const pop = $('achpop');
    pop.classList.remove('sp'); // 인연 창 모양(스크롤)을 업적 창에 남기지 않는다
    if (!f) { pop.hidden = true; return; }
    const a = f.a, c = a.cond, ids = c.units || c.anyOf || [];
    // 여러 기가 필요한 조건은 (보유/필요)를 붙이고, 다 모아야 진하게 켠다
    const chips = ids.map((id) => {
      const d = defOf[id], n = c.need ? c.need[id] : c.n, cnt = n ? g.ownedOf(g.me, id).length : 0;
      const have = c.type === 'party' ? false : n ? cnt >= n : c.type === 'ever' ? g.me.ever[id] : g.has(g.me, id);
      return `<span class="ac ${have ? 'have' : ''}" style="color:${tierColor(d.tier)}">${esc(d.name)} ${rankTag(d.tier)}${n ? ` (${Math.min(cnt, n)}/${n})` : ''}</span>`;
    }).join('');
    // 협동 업적: 지금 인원에서 필요한 수, 인원이 모자라면 비활성 안내
    const partyLine = c.type !== 'party' ? '' : g.partyAchOpen(c)
      ? `<div style="margin-top:4px">${I.t('partyNow', { n: g.partyLive, need: I.t(c.anyOf ? 'needAtLeast' : 'needAll', { n: g.partyAchNeed(c) }) })}</div>`
      : `<div style="margin-top:4px;color:#ff7a60">${I.t('partyLack', { n: c.min })}</div>`;
    // 등급 단위 조건은 진행도를 한 줄로 보여 준다
    const tids = c.tier ? T.units.filter((d) => d.tier === c.tier).map((d) => d.id) : [];
    const prog = c.type === 'tierHave' ? tids.reduce((s, id) => s + g.ownedOf(g.me, id).length, 0)
      : c.type === 'sameHave' ? Math.max(0, ...tids.map((id) => g.ownedOf(g.me, id).length))
      : c.type === 'tierEver' ? tids.filter((id) => g.me.ever[id]).length : null;
    const progLine = prog === null ? '' : `<div class="chips"><span class="ac ${prog >= c.n ? 'have' : ''}">${I.t('progress', { a: Math.min(prog, c.n), b: c.n })}</span></div>`;
    pop.innerHTML = `<strong>${esc(a.name)}${g.me.done[a.id] ? ' ★' : ''}</strong><div>${esc(a.desc)}</div>${chips ? `<div class="chips">${chips}</div>` : ''}${progLine}${partyLine}<div style="color:var(--dim);margin-top:4px">${I.t('reward')}: ${esc(rwText(a.reward))}</div>`;
    pop.hidden = false;
    // 화면 배율 안쪽 좌표로 옮기고 창 밖으로 나가지 않게 막는다
    const x = Math.min(e.clientX / zoom + 12, window.innerWidth / zoom - pop.offsetWidth - 4);
    const y = Math.max(4, Math.min(e.clientY / zoom + 12, window.innerHeight / zoom - pop.offsetHeight - 4));
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function rwText(r) {
    return [r.randomT1 ? I.t('rwT1', { n: r.randomT1 }) : '', ...Object.keys(r.cons || {}).map((c) => I.t('rwCons', { a: T.consumables[c].name, n: r.cons[c] })), ...(r.tickets || []).map(([a, b]) => I.t('rwTicket', { r: rankName(a), n: b })), r.gold ? `${T.currency} ${r.gold.toLocaleString()}` : '', r.chest ? I.t('rwChest', { n: r.chest }) : ''].filter(Boolean).join(', ');
  }
  // 야습: 어둠을 깔고 밝힐 곳만 뚫는다(반 해상도 캔버스)
  // 라인은 성채 둘레와 내 유닛 사거리, 보스전은 내 장수·동료·보스 둘레. 보스전은 장판이 멀리서도 희미하게 보이도록 조금 옅게.
  let nightCv = null, nightHole = null;
  function drawNight(c, arena) {
    if (arena) {
      const f = g.fight, holes = [];
      f.champs.forEach((u) => { if (!u.dead && !u.bench && u.owner === g.me.idx) holes.push([u.x, u.y, 600]); });
      Object.values(f.ghosts || {}).forEach((o) => holes.push([o.x, o.y, 420]));
      return nightLayer(c, holes, 0.8);
    }
    const holes = [[(ROAD.x0 + ROAD.x1) / 2, (ROAD.y0 + ROAD.y1) / 2, 260]];
    for (const u of g.units) if (u.owner === g.me.idx && u.def.tier > 0) holes.push([u.x, u.y, g.range(u.def) + 70]);
    nightLayer(c, holes, 0.86);
  }
  function nightLayer(c, holes, alpha) {
    if (!nightCv) {
      nightCv = document.createElement('canvas'); nightCv.width = W / 2; nightCv.height = H / 2;
      nightHole = document.createElement('canvas'); nightHole.width = nightHole.height = 128;
      const x = nightHole.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    }
    const x = nightCv.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W / 2, H / 2);
    x.fillStyle = `rgba(6,8,22,${alpha})`; x.fillRect(0, 0, W / 2, H / 2);
    x.globalCompositeOperation = 'destination-out';
    for (const [px, py, r] of holes) x.drawImage(nightHole, (px - r) / 2, (py - r) / 2, r, r);
    c.drawImage(nightCv, 0, 0, W, H);
    // 지도 바깥 여백도 어둡게
    c.fillStyle = `rgba(6,8,22,${alpha})`;
    c.fillRect(-W, -H, W * 3, H); c.fillRect(-W, H, W * 3, H); c.fillRect(-W, 0, W, H); c.fillRect(W, 0, W, H);
  }
