  // ---- 결과창 맨 위 '다음 목표' 칸(글 2~4줄, 그림 없음): 진 곳 · 이번 판으로 새로 열린 것(난이도·상점) · 다음 관직까지 남은 경험치 · 가장 싼 잠긴 장수까지 남은 동전.
  // S.progBefore = 이 판을 기록하기 직전의 해금 진행도(16-hud drainEvents의 'over'). 로그인하지 않은 판은 열린 것과 진 곳만 나온다.
  function goalBox() {
    const DF = ['easy', 'normal', 'hard', 'nightmare'], win = g.over === 'win', lines = [], num = (n) => Math.round(n).toLocaleString();
    if (!win) {
      const b = g.stats.bosses[g.stats.bosses.length - 1], f = g.fight;
      if (b && !b.win && b.round === g.round) {
        const p = f && f.boss && f.def && f.def.round === b.round && f.boss.mhp > 0 ? Math.max(1, Math.min(100, Math.ceil((f.boss.hp / f.boss.mhp) * 100))) : 0;
        lines.push(I.t(p ? 'goalLostBossHp' : 'goalLostBoss', { r: b.round, a: esc(b.name), p }));
      } else lines.push(I.t(g.lives <= 0 ? 'goalLostLane' : 'goalLost', { r: g.round }));
    }
    const pb = S.progBefore, mut = g.mutLv || 0;
    if (win && pb) {
      const i = DF.indexOf(g.diff.id), nx = T.difficulties.find((d) => d.id === DF[i + 1]);
      if (i > pb.clr && nx) lines.push(I.t('goalDiff', { a: esc(nx.name) }));
      if (g.diff.id === 'nightmare' && mut > pb.nmx && mut < 5) lines.push(I.t('goalMut', { n: mut + 1 }));
      if (pb.clr < 0) lines.push(I.t('goalShop'));
    }
    const me = ACC.token && ACC.me;
    if (me) {
      const trk = me.track === 'civ' ? 'civ' : 'mil';
      if (me.rank >= 0 && me.rank < 10) lines.push(I.t('goalRank', { a: esc(t('rk_' + trk + (me.rank + 1))), n: num(Math.max(0, xpAt(RANK_LV[me.rank + 1]) - (me.xp || 0))) }));
      const U = T.unlock, shop = !window.RTD_LOBBY || window.RTD_LOBBY.shopOpen();
      if (U && shop) {
        const d = U.lockedIds().filter((id) => !(me.owned || []).includes(U.key(id))).map((id) => defOf[id]).filter(Boolean).sort((a, b) => U.coins[a.tier] - U.coins[b.tier])[0];
        if (d) { const need = U.coins[d.tier] - (me.coins || 0); lines.push(I.t(need > 0 ? 'goalCoins' : 'goalCoinsOk', { n: num(Math.max(0, need)), r: esc(rankName(d.tier)) })); }
      }
    }
    return lines.length ? `<div class="es-goal"><b>${I.t('goalHead')}</b>${lines.slice(0, 4).map((x) => `<div>${x}</div>`).join('')}</div>` : '';
  }
  // 판 끝 통계: 요약 · 보스전 기록(순위) · 라인 피해 순위 · 강화·조합 기록
  function endStats() {
    const s = g.stats, win = g.over === 'win', mm = Math.floor(g.time / 60), ss = Math.floor(g.time % 60);
    const card = (l, v, sub) => `<div class="es-card"><small>${l}</small><b>${v}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
    const cards = [
      card(I.t('reachRound'), `${g.round} / ${g.diff.rounds}`), card(I.t('playTime'), `${mm}:${String(ss).padStart(2, '0')}`),
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
    const ups = T.upgrades.map((u) => `<span class="chip">${esc(u.name)} ${I.t('lvN', { n: g.me.upgrades[u.id] || 0 })}</span>`).join('');
    const crafts = s.crafts.length ? s.crafts.map((n) => `<span class="chip">${esc(n)}</span>`).join('') : `<span class="dim">${I.t('none')}</span>`;
    // 승리: 철괴 제목판을 키워 글씨를 얹는다. 패배: 기울어진 부서진 나무판(흰 깃발 그림)에 '전선 붕괴'.
    const head = win ? `<div class="es-win"><span>${t('win')}</span></div>` : `<div class="es-lose"><span>${t('lose')}</span></div>`;
    return `<div class="over" id="end"><div class="sheet es">
      ${head}${goalBox()}${S.xpGained != null && ACC.me ? `<div class="dim" style="color:#ffd86a">${t('xpGain', { n: S.xpGained })} · ${esc(t(ACC.me.grade))} ${t('level', { n: ACC.me.level })}</div>` : ''}${S.tkMiss ? `<div class="dim" style="color:#ff9d8a">${t('noTicket')}</div>` : ''}<div class="es-cards">${cards}</div>
      ${g.mutLv && g.muts && g.muts.length ? `<div class="es-mutpop" hidden><b>${esc(I.t('mutHead', { n: g.mutLv }))}</b>${g.muts.map((m, i) => mutCard(m.id, i)).join('')}</div>` : ''}
      <h3>${I.t('bossLog')}</h3>${bossRows ? `<table class="es-boss"><tr><th>${I.t('thBoss')}</th><th>${I.t('thResult')}</th><th>${I.t('thTime')}</th><th>${I.t('thChamp')}</th><th>${I.t('dmgRank')}</th></tr>${bossRows}</table>` : `<div class="dim">${I.t('noBossLog')}</div>`}
      <h3>${I.t('laneDmgRank')}</h3>${dmgRows || `<div class="dim">${I.t('noRecord')}</div>`}
      <h3>${I.t('upgrade')}</h3><div class="chips">${ups}</div>
      <h3>${I.t('craftedHead')}</h3><div class="chips">${crafts}</div>
      <button class="btn go es-again" data-act="restart" type="button">${t('quitGame')}</button></div></div>`;
  }
  // ---- 판 끝 경험치 연출: 화면을 어둡게 흐리고, 지금 계급 문양 ─ 경험치 막대 ─ 다음 계급 문양.
  // +경험치가 뜬 뒤 막대가 그만큼 차오르고(계급이 오르면 문양이 바뀜), 잠시 뒤 사라지며 결과창이 나온다.
  const RANK_LV = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 51];
  const lvOfXp = (xp) => Math.min(51, Math.floor(Math.sqrt(xp / 40)) + 1);
  const rkOfLv = (lv) => RANK_LV.reduce((k, m, i) => (lv >= m ? i : k), 0);
  const xpAt = (lv) => 40 * (lv - 1) * (lv - 1);
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
