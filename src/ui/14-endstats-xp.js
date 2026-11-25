  // ---- 결과창 맨 위 '다음 목표' 칸(글 2~4줄, 그림 없음): 진 곳 · 이번 판으로 새로 열린 것(난이도·상점) · 다음 관직까지 남은 경험치 · 가장 싼 잠긴 장수까지 남은 동전.
  // S.progBefore = 이 판을 기록하기 직전의 해금 진행도(16-hud drainEvents의 'over'). 로그인하지 않은 판은 열린 것과 진 곳만 나온다.
  function lostLine() {
    if (g.over === 'win') return '';
    const b = g.stats.bosses[g.stats.bosses.length - 1], f = g.fight;
    if (b && !b.win && b.round === g.round) {
      const p = f && f.boss && f.def && f.def.round === b.round && f.boss.mhp > 0 ? Math.max(1, Math.min(100, Math.ceil((f.boss.hp / f.boss.mhp) * 100))) : 0;
      return I.t(p ? 'goalLostBossHp' : 'goalLostBoss', { r: b.round, a: esc(b.name), p });
    }
    return I.t(g.lives <= 0 ? 'goalLostLane' : 'goalLost', { r: g.round });
  }
  // 다음 목표 카드(2026-11-25 개편): 그림(gfx 아이콘·장수 얼굴·관직 문양) + 제목 + 한 줄 설명 + 진행 막대.
  // 실제 데이터만 쓴다: 난이도 해금 진행(RTD_LOBBY.progNow), 다음 관직까지 경험치, 가장 싼 잠긴 장수까지 동전, 오늘의 미션(RTD_LOBBY.missions).
  // 이 판으로 받은 관직 승급·업적 보상·미션 받기 알림은 '내 정보'(esMe)의 보상 줄로 옮겼다.
  function goalBox() {
    const DF = ['easy', 'normal', 'hard', 'nightmare'], win = g.over === 'win', num = (n) => Math.round(n).toLocaleString(), out = [];
    const dn = (id) => esc((T.difficulties.find((d) => d.id === id) || {}).name || id);
    const pct = (k) => Math.round(Math.max(0, Math.min(1, k)) * 100);
    const card = (ic, head, body, bar, cls) => `<div class="esg ${cls || ''}">${ic}<div class="esg-t"><b>${head}</b>${body ? `<small>${body}</small>` : ''}${bar != null ? `<span class="esg-bar"><i style="width:${pct(bar)}%"></i></span>` : ''}</div></div>`;
    const pic = (src, cls) => `<span class="esg-ic ${cls || ''}"><img alt="" src="${src}" onerror="this.remove()"></span>`;
    // 진 판: 이미 있는 통계로 한 줄 조언(강화를 한 번도 안 했으면 강화, 합성을 한 번도 안 했으면 합성)
    let tip = '';
    if (!win) { const ups = Object.values(g.me.upgrades || {}).reduce((a, b) => a + b, 0); tip = !ups ? I.t('tipUpgrade') : !g.stats.combines ? I.t('tipCombine') : ''; }
    // 난이도: 이번 판으로 열린 것이 있으면 그것을, 없으면 다음에 열 난이도(또는 악몽 +N)와 깨야 할 판
    const pb = S.progBefore, pn = window.RTD_LOBBY && window.RTD_LOBBY.progNow ? window.RTD_LOBBY.progNow() : null, mut = g.mutLv || 0;
    let opened = false;
    if (win && pb) {
      const i = DF.indexOf(g.diff.id), nx = T.difficulties.find((d) => d.id === DF[i + 1]);
      if (i > pb.clr && nx) { out.push(card(pic('gfx/ic_war.png'), I.t('goalDiff', { a: esc(nx.name) }), I.t('esgNew'), null, 'new')); opened = true; }
      if (g.diff.id === 'nightmare' && mut > pb.nmx && mut < 5) { out.push(card(pic('gfx/ic_war.png'), I.t('goalMut', { n: mut + 1 }), I.t('esgNew'), null, 'new')); opened = true; }
      if (pb.clr < 0) out.push(card(pic('gfx/ic_shop.png'), I.t('goalShop'), '', null, 'new'));
    }
    if (!opened && pn) {
      const nxt = DF[pn.clr + 1], after = DF[pn.clr + 2];
      if (nxt && after) out.push(card(pic('gfx/ic_war.png'), I.t('esgDiffNext', { a: dn(after) }), I.t('esgDiffNeed', { a: dn(nxt) })));
      else if (pn.clr >= 2 && pn.nmx + 2 <= 5) { const k = pn.nmx + 1; out.push(card(pic('gfx/ic_war.png'), I.t('esgDiffNext', { a: `${dn('nightmare')} +${k + 1}` }), I.t('esgDiffNeed', { a: dn('nightmare') + (k ? ` +${k}` : '') }))); }
    }
    const me = ACC.token && ACC.me;
    if (me) {
      // 다음 관직: 다음 계급 문양, 남은 경험치, 지금 계급 안에서 찬 정도
      const trk = me.track === 'civ' ? 'civ' : 'mil', xp = me.xp || 0, r = rkOfLv(lvOfXp(xp));
      if (r < 10) { const [lo, hi] = rankSpan(r); out.push(card(pic(`gfx/rank_${r + 1}.png`, 'rk'), I.t('esgRank', { a: esc(t('rk_' + trk + (r + 1))) }), I.t('esgXpLeft', { n: num(Math.max(0, hi - xp)) }), (xp - lo) / Math.max(1, hi - lo))); }
      // 가장 싼 잠긴 장수: 얼굴, 이름, 모은 동전/값
      const U = T.unlock, shop = !window.RTD_LOBBY || window.RTD_LOBBY.shopOpen();
      if (U && shop) {
        const d = U.lockedIds().filter((id) => !(me.owned || []).includes(U.key(id))).map((id) => defOf[id]).filter(Boolean).sort((a, b) => U.coins[a.tier] - U.coins[b.tier])[0];
        if (d) { const cost = U.coins[d.tier], need = cost - (me.coins || 0); out.push(card(pic(Art.portrait(d), 'pt'), I.t('esgUnlock', { a: `<span style="color:${tierColor(d.tier)}">${esc(d.name)}</span>` }), I.t(need > 0 ? 'goalCoins' : 'goalCoinsOk', { n: num(Math.max(0, need)), r: esc(rankName(d.tier)) }), (me.coins || 0) / Math.max(1, cost), need > 0 ? '' : 'ok')); }
      }
      // 오늘의 미션: 3줄(이름 · 진행 막대 · n/m). 다 깬 것은 금색, 받은 것은 흐리게
      const ms = window.RTD_LOBBY && window.RTD_LOBBY.missions ? window.RTD_LOBBY.missions() : null;
      if (ms && Array.isArray(ms.daily) && ms.daily.length) {
        const rows = ms.daily.map((x) => `<span class="esg-ms ${x.claimed ? 'got' : x.done ? 'done' : ''}"><em>${esc(t('ms_' + x.id))}</em><span class="esg-bar"><i style="width:${pct(x.n / Math.max(1, x.need))}%"></i></span><u>${x.claimed ? '✓' : `${Math.min(x.n, x.need)}/${x.need}`}</u></span>`).join('');
        out.push(`<div class="esg ms">${pic('gfx/ic_mission.png')}<div class="esg-t"><b>${esc(t('msToday'))}${S.msClaim ? ` <span class="esg-new">${esc(I.t('esgClaim'))}</span>` : ''}</b>${rows}</div></div>`);
      }
    }
    if (!out.length && !tip) return '';
    return `<div class="es-goal"><h4>${I.t('goalHead')}</h4>${tip ? `<div class="esg-tip">${tip}</div>` : ''}${out.join('')}</div>`;
  }
  // ---- 내 정보(2026-11-25): 관직 문양·이름·레벨, 경험치 막대(이번 판 획득분이 차오른다), 받은 동전·번 금화, 이번 판 보상(승급·업적·미션) ----
  // 막대와 보상 줄은 esStep이 매 프레임 그린다. 결과창을 다시 그려도(미션 소식 등) S.es에 둔 진행 상태로 이어서 그린다.
  function esRewards() {
    const me = ACC.me, trk = me && me.track === 'civ' ? 'civ' : 'mil', num = (n) => Math.round(n).toLocaleString(), out = [];
    (S.rwRank || []).forEach((x) => out.push(`<img alt="" src="gfx/rank_${x.rank}.png" onerror="this.remove()"><span>${I.t('goalRankUp', { a: esc(t('rk_' + trk + x.rank)), n: num(x.coins) })}</span>`));
    (S.rwAch || []).forEach((x) => { const a = T.achievements.find((q) => q.id === x.id); out.push(`<img alt="" src="gfx/ach_pennant.png" onerror="this.remove()"><span>${I.t('esAchGot', { a: esc(a ? a.name : x.id), n: num(x.coins) })}</span>`); });
    if (S.msClaim) out.push(`<img alt="" src="gfx/ic_mission.png" onerror="this.remove()"><span>${I.t('goalMission')}</span>`);
    return out;
  }
  function esMe() {
    const E = S.es, s = g.stats, me = ACC.token && ACC.me;
    const gold = `<span class="esm-it gold"><small>${esc(I.t('goldEarned'))}</small><b>${fmt(s.goldIn)}</b></span>`;
    if (!me) return `<div class="es-me guest"><h4>${esc(I.t('esMeHead'))}</h4><div class="esm-hint">${esc(I.t('esLoginHint'))}</div><div class="esm-loot">${gold}</div></div>`;
    const wait = S.xpFrom == null && E && E.want && !S.repDone;
    const coins = `<span class="esm-it"><small>${esc(I.t('esCoinsGot'))}</small><b><i class="ico coin" aria-hidden="true"></i>${wait ? '…' : '+' + fmt(S.coinGained || 0)}</b></span>`;
    const rw = esRewards().map((h, i) => `<div class="esm-ri ${E && (E.open || i < E.shown) ? 'on' : ''}">${h}</div>`).join('');
    const xp = E && E.xpNow != null ? E.xpNow : S.xpFrom != null ? S.xpFrom : me.xp || 0, r = rkOfLv(lvOfXp(xp));
    return `<div class="es-me" data-r="${r}"><h4>${esc(I.t('esMeHead'))}</h4><div class="esm-top"><span class="esm-mk">${rankMark(r)}</span><div class="esm-id"><b class="esm-rn"></b><small class="esm-lv"></small></div><div class="esm-gain ${E && E.xpT0 ? 'on' : ''}">${S.xpGained ? `+${fmt(S.xpGained)} XP` : ''}</div></div>
      <div class="esm-bar"><i></i></div><div class="esm-num">${wait ? esc(t('sendingResult')) : S.repDone && S.xpFrom == null && E && E.want ? esc(t('noServer')) : ''}</div>
      <div class="esm-loot">${coins}${gold}</div>${rw ? `<div class="esm-rw">${rw}</div>` : ''}</div>`;
  }
  // 막대 그리기: 경험치 xp일 때 계급·레벨·막대·숫자. 계급이 바뀌면 문양을 바꾸고 한 번 튀게 한다
  function esDrawXp(root, xp) {
    const el = root.querySelector('.es-me:not(.guest)');
    if (!el || !ACC.me) return;
    const trk = ACC.me.track === 'civ' ? 'civ' : 'mil', lv = lvOfXp(xp), r = rkOfLv(lv), [lo, hi] = rankSpan(r), k = r >= 10 ? 1 : Math.max(0, Math.min(1, (xp - lo) / (hi - lo)));
    S.es.xpNow = xp;
    if (+el.dataset.r !== r) { el.dataset.r = r; el.querySelector('.esm-mk').innerHTML = rankMark(r); el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); }
    const rn = el.querySelector('.esm-rn'), lt = el.querySelector('.esm-lv'), nm = t('rk_' + trk + r), lvs = t('level', { n: lv });
    if (rn.textContent !== nm) rn.textContent = nm;
    if (lt.textContent !== lvs) lt.textContent = lvs;
    el.querySelector('.esm-bar i').style.width = (k * 100).toFixed(1) + '%';
    const nb = el.querySelector('.esm-num');
    if (S.xpFrom != null || !S.es.want) { const v = r >= 10 ? 'MAX' : `${fmt(Math.round(xp - lo))} / ${fmt(hi - lo)}`; if (nb.textContent !== v) nb.textContent = v; }
  }
  // ---- 결과창 진행(강제 보기): 창이 뜬 뒤 최소 ES_MIN, 서버 답(최대 ES_WAIT)을 기다려 경험치가 다 차고 보상 줄이 하나씩 다 나온 뒤에야
  // 바닥 버튼(게임에 남기·로비로·다시)을 연다. 잠긴 동안 버튼은 눌리지 않고(disabled) 아래 가는 줄이 차오르며, 열릴 때 한 번 빛난다.
  const ES_MIN = 2500, ES_WAIT = 8000, ES_FILL = 1400, ES_RANK = 500, ES_ITEM = 700, ES_TAIL = 500;
  function esStep() {
    const E = S.es, root = document.getElementById('end');
    if (!E) return;
    E.raf = 0;
    if (!root || E.g !== g) return;
    const now = performance.now();
    let xpDone = true;
    if (!ACC.token || !ACC.me) { /* 로그인 안 함: 기다릴 경험치 없음 */ }
    else if (S.xpFrom != null && S.xpGained > 0) {
      if (!E.xpT0) E.xpT0 = Math.max(now, E.t0 + 500);
      const gn = root.querySelector('.esm-gain'); if (gn && now >= E.xpT0 && !gn.classList.contains('on')) gn.classList.add('on');
      const from = S.xpFrom, to = from + S.xpGained, D = ES_FILL + Math.max(0, rkOfLv(lvOfXp(to)) - rkOfLv(lvOfXp(from))) * ES_RANK;
      const p = Math.max(0, Math.min(1, (now - E.xpT0) / D));
      esDrawXp(root, from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) xpDone = false;
    } else if (E.want && !S.repDone && now - E.t0 < ES_WAIT) { xpDone = false; esDrawXp(root, ACC.me.xp || 0); }
    else esDrawXp(root, S.xpFrom != null ? S.xpFrom + (S.xpGained || 0) : ACC.me.xp || 0);
    if (xpDone && !E.xpEnd) { E.xpEnd = now; E.nextAt = now + 300; }
    // 보상 줄을 하나씩
    const items = root.querySelectorAll('.esm-ri');
    // 작은 화면에서 보상 줄이 창 아래로 밀려 있으면 그 줄이 보이게 본문을 내린다(nearest: 이미 보이면 움직이지 않는다)
    if (xpDone && E.shown < items.length && now >= E.nextAt) { const it = items[E.shown]; it.classList.add('on'); try { it.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* 옛 브라우저 */ } E.shown++; E.nextAt = now + ES_ITEM; Snd.play('ach', 200); }
    const seqEnd = xpDone && E.shown >= items.length ? Math.max(E.nextAt || 0, E.xpEnd) : 0;
    if (!E.open) {
      const until = seqEnd ? Math.max(E.t0 + ES_MIN, seqEnd + ES_TAIL) : 0;
      const foot = root.querySelector('.es-foot');
      if (until && now >= until) esOpen(root);
      else if (foot) foot.style.setProperty('--lk', Math.min(0.97, (now - E.t0) / Math.max(ES_MIN, (until || now + 1500) - E.t0)).toFixed(3));
    }
    if (!E.open || E.shown < items.length) E.raf = requestAnimationFrame(esStep);
  }
  function esOpen(root) {
    S.es.open = true;
    root.querySelectorAll('.es-foot .btn').forEach((b) => { b.disabled = false; b.classList.remove('lock'); b.classList.add('ready'); });
    const f = root.querySelector('.es-foot'); if (f) { f.classList.remove('lock'); f.style.removeProperty('--lk'); }
  }
  // 결과창을 (다시) 그린 직후 부른다: 진행을 이어 간다
  function esKick() { const E = S.es; if (E && !E.raf && E.g === g) E.raf = requestAnimationFrame(esStep); }
  // 판 끝 통계: 요약 · 보스전 기록(순위) · 라인 피해 순위 · 강화·조합 기록
  function endStats() {
    const s = g.stats, win = g.over === 'win', mm = Math.floor(g.time / 60), ss = Math.floor(g.time % 60);
    const card = (l, v, sub, cls) => `<div class="es-card ${cls || ''}"><small>${l}</small><b>${v}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
    // 결과창 진행 상태(강제 보기): 처음 그릴 때 시작한다. want = 서버에 결과를 보냈다(경험치·동전 답을 기다린다)
    if (!S.es || S.es.g !== g) S.es = { g, t0: performance.now(), want: !!S.reported, open: false, shown: 0, xpT0: 0, xpEnd: 0, nextAt: 0, xpNow: null, raf: 0 };
    const lock = !S.es.open;
    // 받은 경험치·동전은 위쪽 '내 정보'(esMe)로 옮겼다(2026-11-25)
    // 탈락한 사람: 내 기록은 패배(도달 라운드는 판이 끝난 라운드)이고 팀 결과를 따로 알린다
    const elim = g.out ? `<div class="es-card"><small>${esc(t('elimTitle'))}</small><b>${esc(t(g.teamOver === 'win' ? 'elimTeamWin' : 'elimTeamLose'))}</b><i>${esc(t('elimAt', { n: g.out }))}</i></div>` : '';
    const cards = elim + [
      card(I.t('reachRound'), `${g.resultRound} / ${g.diff.rounds}`), card(I.t('playTime'), `${mm}:${String(ss).padStart(2, '0')}`),
      card(I.t('kills'), fmt(s.kills)), card(I.t('midboss'), I.t('midKills', { n: s.midKill }), s.midMiss ? I.t('midMiss', { n: s.midMiss }) : I.t('noMiss')),
      card(I.t('lifeLost'), `${s.lifeLost}`, I.t('livesLeft', { n: g.lives })), card(I.t('bestTier'), s.bestName ? `${esc(s.bestName)}` : '-', s.best ? rankName(s.best) : ''),
      card(I.t('goldEarned'), fmt(s.goldIn), I.t('upHire', { a: fmt(s.goldUp), b: fmt(s.goldHire) })), card(I.t('combCraft'), `${s.combines} · ${s.crafts.length}`, I.t('tixChest', { a: s.tickets, b: s.chests })),
      card(I.t('ach'), `${Object.keys(g.me.done).length} / ${T.achievements.length}`),
    ].join('')
      // 현재 난이도 칸: 악몽 +N이면 (!) 표시, 꾹 누르면 이번 판 변형 규칙 팝업
      + `<div class="es-card es-diff ${g.mutLv && g.muts && g.muts.length ? 'has-mut' : ''}" style="--dc:${DIFF_COL[g.diff.id] || '#c99a2e'}"><small>${t('difficulty')}</small><b>${esc(g.diff.name)}${g.mutLv ? ` +${g.mutLv}` : ''}</b>${net ? `<i>${esc(I.t('nCoop', { n: net.roster().length }))}</i>` : ''}${g.mutLv && g.muts && g.muts.length ? `<em class="es-bang" aria-label="${esc(I.t('mutHead', { n: g.mutLv }))}">!</em>` : ''}</div>`;
    // 보스전: 결과·시간·빠른 클리어와 피해 순위
    const bossRows = s.bosses.map((b) => {
      const rows = (S.bossRows && S.bossRows[b.round]) || Object.keys(b.dealt).map((k) => ({ name: k, v: b.dealt[k] })).sort((x, y) => y.v - x.v);
      const sum = rows.reduce((a, r) => a + r.v, 0) || 1;
      const rank = rows.slice(0, 5).map((r, i) => `<span class="es-rk ${r.me ? 'me' : ''}">${i + 1}. ${esc(r.name)} <em>${fmt(r.v)} (${Math.round((r.v / sum) * 100)}%)</em></span>`).join('');
      return `<tr><td>R${b.round} ${esc(b.name)}</td><td class="${b.win ? 'ok' : 'bad'}">${b.win ? I.t(b.fast ? 'fastClear' : 'downed') : I.t('fail')}</td><td>${clock(b.time)} / ${clock(b.limit)}</td><td>${esc(b.champs.join(', '))}</td><td class="es-rks">${rank}</td></tr>`;
    }).join('');
    // 라인 피해 순위(유닛 종류별)
    const du = Object.keys(s.dmgUnit).map((id) => ({ d: defOf[id], v: s.dmgUnit[id] })).filter((x) => x.d).sort((a, b) => b.v - a.v), dsum = du.reduce((a, x) => a + x.v, 0) || 1, top = du[0] ? du[0].v : 1;
    const dmgRows = du.slice(0, 10).map((x, i) => `<div class="es-bar"><span class="n" style="color:${tierColor(x.d.tier)}">${i + 1}. ${esc(x.d.name)} ${rankTag(x.d.tier)}</span><span class="b"><i style="width:${(x.v / top) * 100}%;background:${tierColor(x.d.tier)}"></i></span><span class="v">${fmt(x.v)} · ${Math.round((x.v / dsum) * 100)}%</span></div>`).join('');
    // 내용이 없는 칸은 제목째 숨긴다. 강화는 1단계 이상 올린 것만
    const ups = T.upgrades.filter((u) => (g.me.upgrades[u.id] || 0) > 0).map((u) => `<span class="chip">${esc(u.name)} ${I.t('lvN', { n: g.me.upgrades[u.id] || 0 })}</span>`).join('');
    const crafts = s.crafts.map((n) => `<span class="chip">${esc(n)}</span>`).join('');
    // '같은 설정으로 다시': 이 판이 마지막에 시작한 설정(rtd-last)과 같은 싱글 판일 때만(협동 방·빠른 대전·이어하기는 숨김)
    let last = null; try { last = JSON.parse(localStorage.getItem('rtd-last') || 'null'); } catch (e) { last = null; }
    const againOk = !!last && !S.fromSnap && !S.online && last.play === 'offline' && last.diff === g.diff.id && (bots.length ? last.mode === 'ai' : !net && last.mode === 'solo');
    const lost = lostLine();
    // 승리: 철괴 제목판을 키워 글씨를 얹는다. 패배: 기울어진 부서진 나무판(흰 깃발 그림)에 '전선 붕괴'.
    const head = win ? `<div class="es-win"><span>${t('win')}</span></div>` : `<div class="es-lose"><span>${t('lose')}</span></div>`;
    // 창 = 스크롤되는 본문(.es-body) + 고정 바닥 줄(.es-foot). 버튼이 통계 카드를 가리지 않는다
    return `<div class="over" id="end"><div class="sheet es"><div class="es-body">
      ${head}${lost ? `<div class="es-lost">${lost}</div>` : ''}<div class="es-top">${esMe()}${goalBox()}</div>${S.tkMiss ? `<div class="dim" style="color:#ff9d8a">${t('noTicket')}</div>` : ''}
      ${g.mutLv && g.muts && g.muts.length ? `<div class="es-mutpop" hidden><b>${esc(I.t('mutHead', { n: g.mutLv }))}</b>${g.muts.map((m, i) => mutCard(m.id, i)).join('')}</div>` : ''}
      ${bossRows ? `<h3>${I.t('bossLog')}</h3><table class="es-boss"><tr><th>${I.t('thBoss')}</th><th>${I.t('thResult')}</th><th>${I.t('thTime')}</th><th>${I.t('thChamp')}</th><th>${I.t('dmgRank')}</th></tr>${bossRows}</table>` : ''}
      ${dmgRows ? `<h3>${I.t('laneDmgRank')}</h3>${dmgRows}` : ''}
      ${ups ? `<h3>${I.t('upgrade')}</h3><div class="chips">${ups}</div>` : ''}
      ${crafts ? `<h3>${I.t('craftedHead')}</h3><div class="chips">${crafts}</div>` : ''}
      <h3>${I.t('esRecord')}</h3><div class="es-cards">${cards}</div>
      </div><div class="es-foot ${lock ? 'lock' : ''}">${['stay', 'restart', againOk ? 'again' : ''].filter(Boolean).map((a) => `<button class="btn ${a === 'restart' ? 'es-again' : a === 'again' ? 'go es-again2' : 'es-stay'} ${lock ? 'lock' : ''}" data-act="${a}" type="button" ${lock ? 'disabled' : ''}>${a === 'stay' ? I.t('stayBtn') : a === 'again' ? I.t('againSame') : t('quitGame')}</button>`).join('')}</div></div></div>`;
  }
  // ---- 판 끝 경험치 연출: 화면을 어둡게 흐리고, 지금 계급 문양 ─ 경험치 막대 ─ 다음 계급 문양.
  // +경험치가 뜬 뒤 막대가 그만큼 차오르고(계급이 오르면 문양이 바뀜), 잠시 뒤 사라지며 결과창이 나온다.
  // 관직 곡선은 progression.js(서버와 같은 표, 2026-11-24)
  const RANK_LV = window.RTD_PROG.RANK_LV;
  const lvOfXp = window.RTD_PROG.levelOf;
  const rkOfLv = window.RTD_PROG.rankOf;
  const xpAt = window.RTD_PROG.xpAt;
  const rankSpan = (r) => [xpAt(RANK_LV[r]), r < 10 ? xpAt(RANK_LV[r + 1]) : xpAt(RANK_LV[r]) + 1];
  const rankMark = (r) => `<span class="xpm"><img alt="" src="gfx/rank_${r}.png" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'${r}'}))"></span>`;
  function playXp(from, to, coins, done) {
    const track = ACC.me && ACC.me.track === 'civ' ? 'civ' : 'mil', nm = (r) => t('rk_' + track + r);
    const el = document.createElement('div'); el.id = 'xpfx';
    el.innerHTML = `<div class="xpbox"><div class="xpside l"></div><div class="xpmid"><div class="xpbar"><i></i></div><div class="xpnum"></div><div class="xpgain">+${fmt(to - from)} XP</div><div class="xpcoin">+${fmt(coins || 0)} ${t('lb_coin')}</div></div><div class="xpside r"></div></div>`;
    $('app').appendChild(el);
    const side = (r) => `${rankMark(r)}<small>${esc(nm(r))}</small>`;
    let shownR = -1;
    const draw = (xp) => {
      const r = rkOfLv(lvOfXp(xp)), [lo, hi] = rankSpan(r), k = r >= 10 ? 1 : Math.max(0, Math.min(1, (xp - lo) / (hi - lo)));
      if (r !== shownR) { el.querySelector('.l').innerHTML = side(r); el.querySelector('.r').innerHTML = r < 10 ? side(r + 1) : ''; if (shownR >= 0) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); } shownR = r; }
      el.querySelector('.xpbar i').style.width = (k * 100).toFixed(1) + '%';
      el.querySelector('.xpnum').textContent = r >= 10 ? 'MAX' : `${fmt(Math.round(xp - lo))} / ${fmt(hi - lo)}`;
    };
    draw(from);
    // 화면을 누르면 연출을 건너뛴다(끝 값으로 채우고 바로 결과창)
    let fin = false;
    const end = () => { if (fin) return; fin = true; el.classList.add('out'); setTimeout(() => { el.remove(); done(); }, 600); };
    el.addEventListener('pointerdown', () => { if (fin) return; draw(to); end(); });
    requestAnimationFrame(() => el.classList.add('in'));
    // 0.7초 뒤 +XP가 뜨고, 1.4초 동안 차오른다. 다 차고 1.6초 뒤 사라진다.
    setTimeout(() => { if (fin) return; el.classList.add('gain'); const t0 = performance.now(), D = 1400;
      const step = (now) => { if (fin) return; const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3); draw(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); else setTimeout(end, 1600); };
      requestAnimationFrame(step); }, 700);
  }
