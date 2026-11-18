  // ---- 협동 입장 대기 화면(#match) ----
  // 온라인 협동 판(방·빠른 대전)에서 방장이 시작한 직후, 판 화면이 뜨기 전에 참가자 카드(닉네임·계급)를 나란히 보여 준다.
  // 흐름: 'start' 신호 → 모두 이 화면 → 각자 준비(그림 + 최소 1초)가 끝나면 presence { rdy: 판 seed }
  //       → 방장이 모두의 준비를 확인(최소 4초, 최대 12초)하고 'go' → 모두 begin. 손님은 'go'가 15초 안에 안 오면 스스로 시작한다.
  // 연출은 있는 그림만 움직인다: 빛살(ray_sun), 별(pic_star), 고리·터짐 프레임 시트(fxa_ring 5×4칸, fxa_burst 6×5칸 — art.js FXA_META와 같다. 칸 수는 CSS에 적혀 있다).
  // 수치 표(코드에 흩지 않는다)
  const MT_CFG = { selfMinMs: 1000, artMaxMs: 8000, showMinMs: 4000, hostMaxMs: 12000, guestMaxMs: 15000, stepS: 0.25, tips: 4, tickMs: 200 };
  // 계급(0 신병 ~ 10 군주)에 필요한 레벨. 서버(app.js)의 RANK_LV, 19-title.js의 관직 표와 같다
  const MT_RANK_LV = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 51];
  // 연출 단계: 0~2 수수 / 3~5 금테 + 빛살 / 6~8 큰 빛살 + 별 / 9 고리 / 10 군주(전부 + 등장 터짐)
  const mtTier = (r) => (r >= 10 ? 4 : r >= 9 ? 3 : r >= 6 ? 2 : r >= 3 ? 1 : 0);
  const mtRank = (gr) => { const m = /(\d+)$/.exec(gr || ''); return m ? Math.max(0, Math.min(10, +m[1])) : 0; };
  // 별 자리: [왼쪽 %, 위 %, 늦춤 초]
  const MT_STARS = [[10, 72, 0], [86, 64, 0.7], [28, 30, 1.3], [72, 24, 2.0], [50, 84, 2.6], [4, 38, 3.1], [94, 30, 0.4], [40, 6, 1.7], [62, 62, 2.3]];
  const MT_STAR_N = [0, 0, 4, 6, 9];
  let MT = null; // 지금 떠 있는 대기 화면(없으면 null)

  // 프레임 시트 한 장: 바깥(i)이 한 칸만 보이게 자르고, 가운데(b)가 줄을, 그림(img)이 칸을 steps()로 넘긴다
  const mtSheet = (name) => `<i class="mt-fx mt-${name}"><b><img alt="" src="gfx/fxa_${name}.png?v=1"></b></i>`;
  function mtCardHtml(p, i, ord, host) {
    const st = p.state || {}, r = mtRank(st.gr), tier = mtTier(r), low = Q.level === 'low';
    const d = T.units.find((u) => u.id === st.ic) || T.units.find((u) => u.id === 'cav');
    const gr = /^rk_(mil|civ)\d+$/.test(st.gr || '') ? t(st.gr) : '';
    const pum = r >= 1 && r <= 9 ? t('rankPum', { n: 10 - r }) : '';
    let glow = '', over = '';
    if (tier >= 1) glow += '<i class="mt-ray"></i>';
    if (tier >= 4) glow += '<i class="mt-ray r2"></i>';
    // 저사양(화질 낮음)에서는 프레임 애니메이션과 별을 빼고 빛살만
    if (!low) {
      for (let k = 0; k < MT_STAR_N[tier]; k++) { const s = MT_STARS[k]; over += `<i class="mt-star" style="left:${s[0]}%;top:${s[1]}%;animation-delay:${s[2]}s"></i>`; }
      if (tier >= 3) over += mtSheet('ring');
      if (tier >= 4) over += mtSheet('burst');
    }
    return `<div class="mt-slot t${tier}${p.me ? ' me' : ''}" style="grid-column:${i + 1};--d:${(ord * MT_CFG.stepS).toFixed(2)}s">${tier >= 3 ? '<i class="mt-aura"></i>' : ''}<div class="mt-card"><div class="mt-glow">${glow}</div>`
      + `${host ? `<span class="mt-tag host">${t('host')}</span>` : ''}${p.me ? `<span class="mt-tag mine">${t('me')}</span>` : ''}`
      + `<div class="mt-emb">${over}<img class="mt-rk" alt="" src="gfx/rank_${r}.png" onerror="this.style.visibility='hidden'">${d ? `<img class="mt-ic" alt="" src="${Art.portrait(d)}">` : ''}</div>`
      + `<b class="mt-nm">${esc(st.name || '?')}</b><span class="mt-gr">${esc(gr)}${gr && pum ? ' · ' : ''}${pum}</span><span class="mt-lv">${st.lv ? t('level', { n: st.lv | 0 }) : ''}</span><span class="mt-st" data-st="${i}"></span></div></div>`;
  }
  // 내 카드 아래 한 줄: 다음 계급까지 남은 경험치(레벨 L의 누적 경험치 = 40·(L-1)², 18-account.js xpLv)
  function mtNextHtml(a) {
    if (!a || typeof a.rank !== 'number') return '';
    if (a.rank >= 10) return t('mt_max');
    const nx = Math.max(0, a.rank) + 1, tk = a.track === 'civ' ? 'civ' : 'mil', left = Math.max(0, xpLv(MT_RANK_LV[nx]) - Math.round(a.xp || 0));
    return t('mt_next', { r: `<b>${esc(t('rk_' + tk + nx))}</b>`, n: `<b>${left.toLocaleString()}</b>` });
  }
  // 화면 그리기: 참가자 구성이 바뀔 때만 카드를 다시 만들고(등장 연출은 처음 한 번), 평소에는 준비 표시만 고친다
  function mtPaint(m) {
    const el = $('match'); if (!el) return;
    const ros = m.roster().slice(0, 5), key = ros.map((p) => p.id).join(',');
    if (key !== m.key) {
      const first = !m.key; m.key = key;
      // 등장 순서: 계급 낮은 사람부터(높은 계급이 마지막에 뜬다). 자리는 명단 순서 그대로
      const ord = ros.map((p, i) => [mtRank(p.state && p.state.gr), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[1]);
      const host = m.host(), mi = ros.findIndex((p) => p.me), dn = (T.difficulties.find((x) => x.id === m.diff) || {}).name || '';
      const nx = mi >= 0 ? mtNextHtml(m.acc()) : '';
      el.className = (first ? '' : 'mt-still ') + (Q.level === 'low' ? 'mt-low' : '');
      el.innerHTML = `<div class="mt-head"><b class="mt-diff" style="color:${DIFF_COL[m.diff] || '#ffd86a'}">${esc(dn)}${m.mutLv | 0 ? ` +${m.mutLv | 0}` : ''}</b><span class="mt-wait">${t('mt_wait')}</span></div>`
        + `<div class="mt-row">${ros.map((p, i) => mtCardHtml(p, i, ord.indexOf(i), p.id === host)).join('')}${nx ? `<div class="mt-next" style="grid-column:${mi + 1}">${nx}</div>` : ''}</div>`
        + `<div class="mt-tip">${t('mt_tip' + m.tip)}</div>`;
      el.hidden = false;
    }
    ros.forEach((p, i) => {
      const s = el.querySelector(`[data-st="${i}"]`), ok = !!m.ready(p);
      if (s && s.dataset.ok !== String(ok)) { s.dataset.ok = String(ok); s.textContent = t(ok ? 'mt_ready' : 'mt_loading'); s.classList.toggle('ok', ok); }
    });
  }
  function mtStop(m) {
    clearInterval(m.iv); m.done = true;
    if (MT === m) MT = null;
    const el = $('match'); if (el) { el.hidden = true; el.innerHTML = ''; }
  }
  // 시작 신호를 받았을 때 부른다. go = 판을 시작하는 함수(begin), alive = 아직 그 방에 있는지(대기 중에 방을 나갔으면 시작하지 않는다).
  // 어떤 경우에도 go는 한 번 불린다(방을 나간 경우만 빼고): 'go' 신호, 방장의 판단, 손님 15초, 방장 12초, 오류.
  function matchIntro(nt, d, go, alive) {
    if (MT) mtStop(MT);
    let n = 0; try { n = nt.roster().length; } catch (e) { /* 아래에서 바로 시작 */ }
    if (n < 2 || !$('match') || !d) { go(); return; } // 혼자 남은 방은 기다릴 사람이 없다
    const seed = d.seed != null ? d.seed : 1;
    const m = MT = {
      nt, seed, at: Date.now(), done: false, rdy: false, sent: false, key: '', iv: 0, tip: (Math.random() * MT_CFG.tips) | 0,
      diff: d.diff, mutLv: d.mutLv || 0,
      roster: () => nt.roster(), host: () => nt.hostId(), acc: () => ACC.me,
      ready: (p) => (p.me ? m.rdy : !!p.state && p.state.rdy === seed),
    };
    const start = () => {
      if (m.done) return;
      try { mtStop(m); } catch (e) { m.done = true; MT = null; }
      if (alive && !alive()) return; // 기다리는 사이 방을 나갔다
      go();
    };
    m.start = start;
    // 'go'는 방장(막 바뀌었으면 앞 방장도) 것만 받는다. 방(Net)마다 한 번만 건다
    if (!nt.mtGoOn) {
      nt.mtGoOn = true;
      nt.t.on('go', (x, peer, self) => { const c = MT; if (c && c.nt === nt && !c.done && x && typeof x === 'object' && x.seed === c.seed && nt.fromHost(peer, self)) c.start(); });
    }
    const safePaint = () => { try { mtPaint(m); } catch (e) { const el = $('match'); if (el) el.hidden = true; } }; // 화면이 깨져도 시작은 막지 않는다
    safePaint();
    // 내 준비: 그림을 다 불러오고(오래 걸리면 8초에서 끊는다) 최소 1초
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    Promise.all([wait(MT_CFG.selfMinMs), Promise.race([Promise.resolve(Art.ready).catch(() => {}), wait(MT_CFG.artMaxMs)])]).then(() => {
      if (m.done) return;
      m.rdy = true;
      try { nt.t.presence({ rdy: seed }); } catch (e) { /* 못 알려도 방장이 12초에 시작한다 */ }
      safePaint();
    });
    m.iv = setInterval(() => {
      try {
        const el = Date.now() - m.at;
        if (alive && !alive()) { start(); return; }
        if (nt.isHost()) {
          // 방장(원래 방장이 끊겨 넘겨받은 사람 포함): 모두 준비됐고 4초가 지났거나, 12초가 지났으면 시작
          const all = nt.roster().every((p) => m.ready(p));
          if ((all && el >= MT_CFG.showMinMs) || el >= MT_CFG.hostMaxMs) {
            if (!m.sent) { m.sent = true; try { nt.send('go', { seed }); } catch (e) { /* 손님은 15초에 스스로 시작한다 */ } }
            start();
            return;
          }
        } else if (el >= MT_CFG.guestMaxMs) { start(); return; }
        safePaint();
      } catch (e) { start(); }
    }, MT_CFG.tickMs);
  }
  // 개발용: 가짜 참가자로 화면만 띄워 본다(판은 시작하지 않는다). 다시 부르면 닫힌다. 예: __rtdMatchPreview([0, 3, 6, 9, 10])
  window.__rtdMatchPreview = (ranks) => {
    if (MT) { const pv = MT.preview; if (pv) mtStop(MT); return false; } // 진짜 대기 화면은 건드리지 않는다
    const rs = (Array.isArray(ranks) && ranks.length ? ranks : [0, 3, 6, 9, 10]).slice(0, 5).map((r) => Math.max(0, Math.min(10, r | 0)));
    const mi = Math.min(rs.length - 1, 1), us = T.units, step = Math.max(1, Math.floor(us.length / 5));
    const ros = rs.map((r, i) => { const u = us[(i * step + 3) % us.length]; return { id: 'v' + i, me: i === mi, at: 900 + i * 600, state: { name: u.name, lv: MT_RANK_LV[r] + (r < 10 ? 2 : 9), gr: 'rk_' + (i % 2 ? 'civ' : 'mil') + r, ic: u.id } }; });
    const me = ros[mi], m = MT = {
      preview: true, seed: 1, at: Date.now(), done: false, key: '', iv: 0, tip: (Math.random() * MT_CFG.tips) | 0, diff: 'nightmare', mutLv: 3,
      roster: () => ros, host: () => 'v0', acc: () => ({ rank: rs[mi], xp: xpLv(me.state.lv) + 120, track: mi % 2 ? 'civ' : 'mil' }),
      ready: (p) => Date.now() - m.at > p.at,
    };
    m.iv = setInterval(() => mtPaint(m), MT_CFG.tickMs); mtPaint(m);
    return true;
  };
