  function drawFx(c) {
    if (window.RTD_SKFX) window.RTD_SKFX.setQuality(Q.level === 'low' ? 0.5 : Q.level === 'mid' ? 0.75 : 1);
    for (const f of g.fx) {
      if (f.t < 0) continue;
      const p = f.t / f.life;
      // 스킬 연출: 새 이펙트(skillfx.js)가 그리면 기존 모양은 건너뛴다
      if (f.vx && window.RTD_SKFX && window.RTD_SKFX.fx(c, f, p)) { c.globalAlpha = 1; continue; }
      if (f.k === 'shot') { c.globalAlpha = Math.min(1, (1 - p) * 3); Art.shot(c, f); c.globalAlpha = 1; continue; }
      c.globalAlpha = 1 - p;
      c.strokeStyle = f.c; c.fillStyle = f.c;
      if (f.k === 'ring') { c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, f.r * (0.5 + p * 0.5), 0, 7); c.stroke(); }
      // 타격: 프레임 애니메이션(평타는 작은 타격, 강타·스킬은 큰 타격)
      else if (f.k === 'spark' && Art.fxAnim(c, f.r < 60 ? 'hit2' : 'hit', p, f.x, f.y, f.r * 3.2, f.r * 3.2, f.a, 1)) { /* 애니메이션 이펙트 */ }
      else if (f.k === 'spark' && Art.fxImg(c, 'hit', f.x, f.y, f.r * 2.4 * (0.7 + p * 0.5), f.a, 1 - p)) { /* 생성 이펙트 */ }
      else if (f.k === 'spark') {
        // 타격 지점의 방사형 불꽃
        c.lineWidth = 3; c.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const a = f.a + (i - 2.5) * 0.7, a1 = f.r * (0.3 + p * 0.5), a2 = f.r * (0.6 + p); c.beginPath(); c.moveTo(f.x + Math.cos(a) * a1, f.y + Math.sin(a) * a1); c.lineTo(f.x + Math.cos(a) * a2, f.y + Math.sin(a) * a2); c.stroke(); }
        c.fillStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, f.r * 0.4 * (1 - p), 0, 7); c.fill();
      } else if (f.k === 'die') {
        // 처치: 튕겨 나가며 쓰러진다
        c.globalAlpha = 1 - p;
        Art.drawSprite(c, f.e.mid && f.e.w.look ? Art.namedSprite(f.e.w.name, f.e.w.look, '#b5361f') : Art.soldierSprite(f.e.w), f.x + Math.cos(f.a) * 34 * p, f.y + Math.sin(f.a) * 34 * p - Math.sin(p * 3.14) * 22, f.e.mid ? 76 : 48, false, p * 1.5);
      } else if (f.k === 'dash') { c.lineWidth = 16 * (1 - p); c.beginPath(); c.moveTo(f.x0, f.y0); c.lineTo(f.x1, f.y1); c.stroke(); }
      else if (f.k === 'beam') {
        // 직선 스킬: 앞머리가 달려 나가고 뒤로 잔광이 남는다
        const head = Math.min(1, p * 2.6) * f.len, tail = Math.max(0, (p - 0.4) / 0.6) * f.len;
        c.save(); c.translate(f.x, f.y); c.rotate(f.a);
        const gr = c.createLinearGradient(tail, 0, head, 0); gr.addColorStop(0, f.c + '00'); gr.addColorStop(0.7, f.c + 'cc'); gr.addColorStop(1, '#ffffff');
        c.globalAlpha = 1; c.fillStyle = gr; c.fillRect(tail, -f.w / 2, Math.max(1, head - tail), f.w);
        c.fillStyle = '#fff'; c.globalAlpha = 0.8 * (1 - p); c.fillRect(tail, -f.w / 7, Math.max(1, head - tail), f.w / 3.5);
        c.globalAlpha = 1 - p; c.fillStyle = '#fff'; c.beginPath(); c.arc(head - f.w * 0.45, 0, f.w * 0.7, -1.2, 1.2); c.arc(head - f.w * 0.75, 0, f.w * 0.6, 1.05, -1.05, true); c.closePath(); c.fill();
        c.restore();
      } else if (f.k === 'cone') {
        // 부채꼴 스킬: 호가 바깥으로 퍼진다
        for (let i = 0; i < 3; i++) {
          const rr = f.r * Math.min(1, p * 1.5 + i * 0.16);
          c.globalAlpha = (1 - p) * (0.5 - i * 0.12); c.beginPath(); c.moveTo(f.x, f.y); c.arc(f.x, f.y, rr, f.a - f.arc / 2, f.a + f.arc / 2); c.closePath(); c.fill();
        }
        c.globalAlpha = 1 - p; c.lineWidth = 8; c.strokeStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, f.r * Math.min(1, p * 1.5), f.a - f.arc / 2, f.a + f.arc / 2); c.stroke();
        Art.fxImg(c, 'slash', f.x + Math.cos(f.a) * f.r * 0.55, f.y + Math.sin(f.a) * f.r * 0.55, f.r * 1.3, f.a + Math.PI / 2, (1 - p) * 1.5);
      } else if (f.k === 'blast') {
        // 지정 위치 스킬의 폭발
        if (!Art.fxAnim(c, 'boom', p, f.x, f.y - f.r * 0.2, f.r * 3.4, f.r * 3.4, 0, 1)) Art.fxImg(c, 'boom', f.x, f.y, f.r * 2.6 * (0.7 + p * 0.5), p, (1 - p) * 1.4);
        c.globalAlpha = (1 - p) * 0.7; c.beginPath(); c.arc(f.x, f.y, f.r * (0.6 + p * 0.5), 0, 7); c.fill();
        c.globalAlpha = 1 - p; c.fillStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, f.r * 0.5 * (1 - p), 0, 7); c.fill();
        c.lineWidth = 6; c.beginPath(); c.arc(f.x, f.y, f.r * (0.8 + p * 0.6), 0, 7); c.stroke();
        for (let i = 0; i < 10; i++) { const a = i * 0.63, d1 = f.r * (0.5 + p), d2 = f.r * (0.7 + p * 1.2); c.lineWidth = 3; c.beginPath(); c.moveTo(f.x + Math.cos(a) * d1, f.y + Math.sin(a) * d1); c.lineTo(f.x + Math.cos(a) * d2, f.y + Math.sin(a) * d2); c.stroke(); }
      } else if (f.k === 'aura') {
        // 강화·보호·회복: 바닥 법진, 빛 고리와 위로 오르는 입자
        Art.fxImg(c, 'magic', f.x, f.y + 20, f.r * 2.4, p * 2, (1 - p) * 1.2, 0.45);
        c.lineWidth = 5; c.beginPath(); c.ellipse(f.x, f.y + 20, f.r * (0.5 + p * 0.5), f.r * 0.3 * (0.5 + p * 0.5), 0, 0, 7); c.stroke();
        c.fillStyle = f.c;
        for (let i = 0; i < 12; i++) { const a = i * 0.52, rr = f.r * 0.6; c.beginPath(); c.arc(f.x + Math.cos(a) * rr, f.y + 20 + Math.sin(a) * rr * 0.5 - p * 110 - (i % 3) * 14, 4, 0, 7); c.fill(); }
      }
    }
    c.globalAlpha = 1;
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
        c.fillStyle = d.big ? '#ffd24a' : '#fff4dc'; c.fillText(txt, 0, 0);
        c.restore();
        continue;
      }
      if (d.t > 0.8) { S.dmg.splice(i, 1); continue; }
      c.globalAlpha = 1 - d.t / 0.8; c.fillStyle = d.big ? '#ffd86a' : '#fff';
      c.font = `900 ${Math.round((d.big ? 30 : 20) * us)}px "Noto Serif KR", serif`; c.fillText(typeof d.v === 'string' ? d.v : fmt(d.v), d.x, d.y - d.t * 50);
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
  // 오른쪽 여백에 3열로 모아 세운다
  const flagPos = () => {
    const rows = Math.ceil(T.achievements.length / 3), step = Math.min(68, 820 / (rows - 1));
    return T.achievements.map((a, i) => ({ a, x: W - 174 + Math.floor(i / rows) * 58, y: 128 + (i % rows) * step }));
  };
  const FLAGS = flagPos();
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
  // 게임 로고: 왼쪽 맵 여백 맨 위, 전황 패널 바로 위
  function drawLogo(c) {
    // 맵이 아니라 화면 왼쪽 끝을 기준으로 붙인다
    const x = 8 - S.ox / S.scale, y = 4 - S.oy / S.scale;
    c.save();
    c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(32, 21, 12, .85)';
    c.font = '900 46px "Noto Serif KR", serif'; c.lineWidth = 7; c.strokeText('三國志', x, y + 50);
    c.fillStyle = '#e6c578'; c.fillText('三國志', x, y + 50);
    c.font = '700 20px "Noto Serif KR", serif'; c.lineWidth = 4; c.fillStyle = '#f4ecd8';
    c.strokeText('RANDOM', x + 2, y + 78); c.fillText('RANDOM', x + 2, y + 78);
    c.strokeText('DEFENSE', x + 2, y + 100); c.fillText('DEFENSE', x + 2, y + 100);
    c.restore();
  }
  // 깃발 28개는 글자·도형이 많아 매 프레임 그리면 무겁다. 달성 상태가 바뀔 때만 다시 그려 두고 한 장으로 찍는다.
  let flagCv = null, flagKey = '';
  function drawFlags(c) {
    const key = Object.keys(g.me.done).join() + '|' + g.mode + g.party + '|' + (I.lang || '');
    if (flagKey !== key || !flagCv) {
      flagKey = key;
      if (!flagCv) { flagCv = document.createElement('canvas'); flagCv.width = 220; flagCv.height = H; }
      const x = flagCv.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 220, H); x.translate(-(W - 205), 0);
      paintFlags(x);
    }
    c.drawImage(flagCv, W - 205, 0);
  }
  function paintFlags(c) {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.font = '400 34px "Black Han Sans", sans-serif'; c.strokeStyle = 'rgba(32, 21, 12, .85)'; c.lineWidth = 6;
    c.strokeText(I.t('ach'), W - 98, 38); c.fillStyle = '#e6c578'; c.fillText(I.t('ach'), W - 98, 38);
    for (const f of FLAGS) {
      const done = g.me.done[f.a.id], kind = achKind(f.a), col = tierColor(achTier(f.a));
      // 인원이 모자라 열리지 않는 협동 업적은 흐리게
      const closed = kind === 'party' && !g.partyAchOpen(f.a.cond);
      c.globalAlpha = done ? 1 : closed ? 0.18 : 0.55;
      c.save(); c.translate(f.x, f.y);
      const label = achLabel(f.a);
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
  const flagAt = (m) => FLAGS.find((f) => m.x > f.x - 6 && m.x < f.x + 50 && m.y > f.y - 64 && m.y < f.y + 4);
  function showFlag(f, e) {
    const pop = $('achpop');
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
      ? `<div style="margin-top:4px">${I.t('partyNow', { n: g.party, need: I.t(c.anyOf ? 'needAtLeast' : 'needAll', { n: g.partyAchNeed(c) }) })}</div>`
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
