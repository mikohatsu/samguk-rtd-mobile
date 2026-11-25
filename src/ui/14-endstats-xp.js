  // ---- 결과창(2026-11-25 다시 짬, production/team/2026-11-25/endscreen-spec.md) ----
  // 위에서부터: 제목판 → 진 곳 한 줄 → ① 경험치 줄(상자 없음) → ①' 보상 한 줄 → ② 배틀기록(종이 한 장) → ③ 다음 목표(글만, 3줄까지) → 세부(보스전 표·라인 피해·강화·합성) → 고정 버튼 줄.
  // 진 곳 한 줄: 보스에게 졌으면 보스와 남은 체력, 아니면 라이프. 협동에서 탈락했으면 탈락 라운드와 팀 결과(칸으로 두지 않는다)
  function lostLine() {
    if (g.out) return `${esc(t('elimAt', { n: g.out }))} · ${esc(t(g.teamOver === 'win' ? 'elimTeamWin' : 'elimTeamLose'))}`;
    if (g.over === 'win') return '';
    const b = g.stats.bosses[g.stats.bosses.length - 1], f = g.fight;
    if (b && !b.win && b.round === g.round) {
      const p = f && f.boss && f.def && f.def.round === b.round && f.boss.mhp > 0 ? Math.max(1, Math.min(100, Math.ceil((f.boss.hp / f.boss.mhp) * 100))) : 0;
      return I.t(p ? 'goalLostBossHp' : 'goalLostBoss', { r: b.round, a: esc(b.name), p });
    }
    return I.t(g.lives <= 0 ? 'goalLostLane' : 'goalLost', { r: g.round });
  }
  // 경험치 막대와 같은 값: 서버 답이 왔으면 이번 판 뒤 경험치(받기 전 + 받은 것), 아니면 계정 값.
  // (예전 goalBox는 갱신 전 ACC.me.xp로 다음 관직을 계산해, 막대는 軍候인데 '다음 관직'이 百人隊長로 나오는 일이 있었다)
  const esXpEnd = () => (S.xpFrom != null ? S.xpFrom + (S.xpGained || 0) : (ACC.me && ACC.me.xp) || 0);
  // ③ 다음 목표: 글만, 많아야 3줄. 한 줄 = "무엇까지 · 얼마". ' · ' 뒤(위치 안내 등)는 흐리게.
  // 우선순위: 이번 판으로 열린 것(2줄까지) → 진 판 조언 → 받을 미션 보상 → 지금 동전으로 장수 해금 → 다음 난이도 조건 → 다음 관직까지 XP → 장수 해금까지 남은 동전
  function goalBox() {
    const DF = ['easy', 'normal', 'hard', 'nightmare'], win = g.over === 'win', num = (n) => Math.round(n).toLocaleString(), out = [];
    const dn = (id) => esc((T.difficulties.find((d) => d.id === id) || {}).name || id);
    const k = (s) => `<b>${s}</b>`;
    const line = (html, cls) => { const i = html.lastIndexOf(' · '); out.push(`<li${cls ? ` class="${cls}"` : ''}>${i > 0 ? `${html.slice(0, i)}<span> · ${html.slice(i + 3)}</span>` : html}</li>`); };
    const pb = S.progBefore, pn = window.RTD_LOBBY && window.RTD_LOBBY.progNow ? window.RTD_LOBBY.progNow() : null, mut = g.mutLv || 0;
    // 1. 이번 판으로 열린 것(승리 판)
    let opened = 0;
    if (win && pb) {
      const i = DF.indexOf(g.diff.id), nx = T.difficulties.find((d) => d.id === DF[i + 1]);
      if (i > pb.clr && nx) { line(I.t('goalDiff', { a: k(esc(nx.name)) }), 'new'); opened++; }
      if (g.diff.id === 'nightmare' && mut > pb.nmx && mut < 5) { line(I.t('goalMut', { n: mut + 1 }), 'new'); opened++; }
      if (pb.clr < 0 && opened < 2) { line(I.t('goalShop'), 'new'); opened++; }
    }
    // 2. 진 판 조언(강화를 한 번도 안 했으면 강화, 합성을 한 번도 안 했으면 합성)
    if (!win) { const ups = Object.values(g.me.upgrades || {}).reduce((a, b) => a + b, 0); if (!ups) line(I.t('tipUpgrade'), 'tip'); else if (!g.stats.combines) line(I.t('tipCombine'), 'tip'); }
    const me = ACC.token && ACC.me;
    // 3. 받을 미션 보상
    if (me && S.msClaim) line(I.t('goalMsShort'));
    // 4·7. 가장 싼 잠긴 장수(지금 동전으로 되면 4, 아니면 7로 뒤에)
    let coinLine = '';
    if (me) {
      const U = T.unlock, shop = !window.RTD_LOBBY || window.RTD_LOBBY.shopOpen();
      if (U && shop) {
        const d = U.lockedIds().filter((id) => !(me.owned || []).includes(U.key(id))).map((id) => defOf[id]).filter(Boolean).sort((a, b) => U.coins[a.tier] - U.coins[b.tier])[0];
        if (d) { const need = U.coins[d.tier] - (me.coins || 0), r = k(esc(rankName(d.tier))); if (need <= 0) line(I.t('goalCoinsOk', { r })); else coinLine = I.t('goalCoins', { n: k(num(need)), r }); }
      }
    }
    // 5. 다음 난이도를 여는 조건(이번 판으로 열린 것이 없을 때)
    if (!opened && pn) {
      const nxt = DF[pn.clr + 1], after = DF[pn.clr + 2];
      if (nxt && after) line(I.t('goalDiffNeed2', { a: k(dn(nxt)), b: k(dn(after)) }));
      else if (pn.clr >= 2 && pn.nmx + 2 <= 5) { const n = pn.nmx + 1; line(I.t('goalDiffNeed2', { a: k(dn('nightmare') + (n ? ` +${n}` : '')), b: k(`${dn('nightmare')} +${n + 1}`) })); }
    }
    // 6. 다음 관직까지(막대와 같은 xp)
    if (me) { const xp = esXpEnd(), r = rkOfLv(lvOfXp(xp)); if (r < 10) { const trk = me.track === 'civ' ? 'civ' : 'mil'; line(I.t('esGoalRank', { a: k(esc(t('rk_' + trk + (r + 1)))), n: k(num(Math.max(0, rankSpan(r)[1] - xp))) })); } }
    if (coinLine) line(coinLine);
    if (!out.length) return '';
    return `<div class="es-next ${S.es && S.es.open ? 'on' : ''}"><span class="esn-cap">${esc(I.t('goalHead'))}</span><ul>${out.slice(0, 3).join('')}</ul></div>`;
  }
  // ①' 보상 한 줄: 동전(판 보상) · 승급(여러 번이면 하나로) · 업적 첫 달성(2개 이상이면 ×N). 상자 없이 그림 20px + 글.
  // 자리는 처음부터 잡아 두고(투명) esStep이 차례로 켠다. 동전은 +XP와 함께, 승급·업적은 막대가 다 찬 뒤 하나씩(seq).
  function esRewards() {
    const me = ACC.me, trk = me && me.track === 'civ' ? 'civ' : 'mil', num = (n) => Math.round(n).toLocaleString(), out = [];
    const rk = S.rwRank || [], ac = S.rwAch || [], sum = (l) => l.reduce((a, x) => a + (x.coins || 0), 0);
    if (rk.length) { const top = rk.reduce((a, x) => (x.rank > a.rank ? x : a), rk[0]); out.push(`<img alt="" src="gfx/rank_${top.rank}.png" onerror="this.remove()"><span>${esc(I.t('esChipRank', { a: t('rk_' + trk + top.rank), n: num(sum(rk)) }))}</span>`); }
    if (ac.length === 1) { const a = T.achievements.find((q) => q.id === ac[0].id); out.push(`<img alt="" src="gfx/ach_pennant.png" onerror="this.remove()"><span>${esc(I.t('esChipAch1', { a: a ? a.name : ac[0].id, n: num(sum(ac)) }))}</span>`); }
    else if (ac.length > 1) out.push(`<img alt="" src="gfx/ach_pennant.png" onerror="this.remove()"><span>${esc(I.t('esChipAchN', { k: ac.length, n: num(sum(ac)) }))}</span>`);
    return out;
  }
  // ① 경험치 줄: 관직 문양 · 관직명 Lv · 막대(이전 몫 어두운 금 + 이번 판 몫 밝은 금) · 수치 · +XP · 다음 관직 문양(흐리게)
  function esMe() {
    const E = S.es, me = ACC.token && ACC.me;
    if (!me) return `<div class="es-xp guest">${esc(I.t('esLoginHint'))}</div>`;
    const wait = S.xpFrom == null && E && E.want && !S.repDone;
    const st = wait ? esc(t('sendingResult')) : S.repDone && S.xpFrom == null && E && E.want ? esc(t('noServer')) : '';
    const xp = E && E.xpNow != null ? E.xpNow : S.xpFrom != null ? S.xpFrom : me.xp || 0, r = rkOfLv(lvOfXp(xp));
    const gain = S.xpGained ? `+${fmt(S.xpGained)} XP` : '';
    // want = 경험치 답을 기다리거나 받은 줄: 숫자 칸 폭과 +XP 자리를 처음부터 잡아 둔다('보내는 중…' → 숫자·+XP로 바뀔 때 막대가 78px 줄던 것, 2026-11-26 layout-shift)
    const want = !!(E && E.want) && !(S.repDone && S.xpFrom == null);
    const row = `<div class="es-xp ${st ? 'st' : ''}${want ? ' want' : ''}" data-r="${r}"><span class="esx-mk">${rankMark(r)}</span><span class="esx-id"><b class="esx-rn"></b><small class="esx-lv"></small></span>`
      + `<span class="esx-bar"><i class="n"></i><i class="p"></i></span><span class="esx-num">${st}</span><span class="esx-gain ${E && E.xpT0 && performance.now() >= E.xpT0 ? 'on' : ''}">${gain}</span><span class="esx-nx">${r < 10 ? rankMark(r + 1) : ''}</span></div>`;
    // 보상 줄: 서버 답을 기다리는 동안과 답을 받은 뒤만 자리를 잡는다(보내지 않은 판·답이 없는 판은 받을 것이 없다)
    if (!(E && E.want && !S.repDone) && S.xpFrom == null) return row;
    const coin = S.xpFrom != null ? `<span class="esr coin ${E && E.coinOn ? 'on' : ''}" aria-label="${esc(I.t('esCoinsGot'))} +${fmt(S.coinGained || 0)}"><i class="ico coin" aria-hidden="true"></i><span>+${fmt(S.coinGained || 0)}</span></span>` : '';
    const rw = S.xpFrom != null ? esRewards().map((h, i) => `<span class="esr seq ${E && (E.open || i < E.shown) ? 'on' : ''}">${h}</span>`).join('') : '';
    return `${row}<div class="es-rw">${coin}${rw}</div>`;
  }
  // 막대 그리기: 경험치 xp일 때 "계급명 등급"·막대·숫자. 막대는 지금 등급 → 다음 등급 한 칸(2026-11-25 economy-v2: 계급마다 등급 1~5).
  // 등급·계급이 바뀌면 문양(지금·다음 등급의 계급)을 바꾸고 한 번 튀게 한다.
  // 이전 몫(.p) = 이 판 전 경험치가 지금 등급 안에서 찬 만큼(등급을 넘었으면 0), 이번 판 몫(.n) = 지금까지
  function esDrawXp(root, xp) {
    const el = root.querySelector('.es-xp:not(.guest)');
    if (!el || !ACC.me) return;
    const trk = ACC.me.track === 'civ' ? 'civ' : 'mil', lv = lvOfXp(xp), r = rkOfLv(lv), [lo, hi] = lvSpan(lv), k = r >= 10 ? 1 : Math.max(0, Math.min(1, (xp - lo) / (hi - lo)));
    S.es.xpNow = xp;
    if (el.dataset.lv !== String(lv)) { const first = el.dataset.lv == null; el.dataset.lv = lv; el.dataset.r = r; el.querySelector('.esx-mk').innerHTML = rankMark(r); el.querySelector('.esx-nx').innerHTML = r < 10 ? rankMark(rkOfLv(lv + 1)) : ''; if (!first) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); } }
    const rn = el.querySelector('.esx-rn'), lt = el.querySelector('.esx-lv'), nm = window.RTD_PROG.label(t, 'rk_' + trk + r, lv), lvs = '';
    if (rn.textContent !== nm) rn.textContent = nm;
    if (lt.textContent !== lvs) lt.textContent = lvs;
    const pf = S.xpFrom != null && r < 10 ? Math.max(0, Math.min(k, (S.xpFrom - lo) / (hi - lo))) : k;
    el.querySelector('.esx-bar .n').style.width = (k * 100).toFixed(1) + '%';
    el.querySelector('.esx-bar .p').style.width = (pf * 100).toFixed(1) + '%';
    const nb = el.querySelector('.esx-num');
    if (S.xpFrom != null || !S.es.want) { const v = r >= 10 ? 'MAX' : `${fmt(Math.round(xp - lo))} / ${fmt(hi - lo)}`; if (nb.textContent !== v) nb.textContent = v; if (el.classList.contains('st')) el.classList.remove('st'); }
  }
  // ---- 결과창 진행(강제 보기): 창이 뜬 뒤 최소 ES_MIN, 서버 답(최대 ES_WAIT)을 기다려 경험치가 다 차고 보상이 하나씩 다 나온 뒤에야
  // 바닥 버튼(게임에 남기·로비로·다시)을 연다. 잠긴 동안 버튼은 눌리지 않고(disabled) 아래 가는 줄이 차오르며, 열릴 때 한 번 빛난다.
  // 다음 목표 글은 버튼이 열릴 때 함께 나타난다(자리는 처음부터 잡혀 있어 밀림 없음)
  const ES_MIN = 2500, ES_WAIT = 8000, ES_FILL = 1400, ES_RANK = 500, ES_ITEM = 700, ES_TAIL = 500;
  function esStep() {
    const E = S.es, root = document.getElementById('end');
    if (!E) return;
    E.raf = 0;
    if (!root || E.g !== g) return;
    const now = performance.now();
    let xpDone = true;
    const xr = root.querySelector('.es-xp:not(.guest)');
    if (!ACC.token || !ACC.me) { /* 로그인 안 함: 기다릴 경험치 없음 */ }
    else if (S.xpFrom != null && S.xpGained > 0) {
      if (!E.xpT0) E.xpT0 = Math.max(now, E.t0 + 500);
      if (now >= E.xpT0) { const gn = root.querySelector('.esx-gain'); if (gn && !gn.classList.contains('on')) gn.classList.add('on'); E.coinOn = true; }
      const from = S.xpFrom, to = from + S.xpGained, D = ES_FILL + Math.max(0, rkOfLv(lvOfXp(to)) - rkOfLv(lvOfXp(from))) * ES_RANK;
      const p = Math.max(0, Math.min(1, (now - E.xpT0) / D));
      esDrawXp(root, from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (xr) xr.classList.toggle('fill', p > 0 && p < 1);
      if (p < 1) xpDone = false;
    } else if (E.want && !S.repDone && now - E.t0 < ES_WAIT) { xpDone = false; esDrawXp(root, ACC.me.xp || 0); }
    else { esDrawXp(root, esXpEnd()); if (S.xpFrom != null) E.coinOn = true; }
    if (E.coinOn) { const c = root.querySelector('.esr.coin'); if (c && !c.classList.contains('on')) c.classList.add('on'); }
    if (xpDone && !E.xpEnd) { E.xpEnd = now; E.nextAt = now + 300; }
    // 승급·업적을 하나씩(자리는 이미 잡혀 있으므로 본문을 스크롤하지 않는다)
    const items = root.querySelectorAll('.esr.seq');
    if (xpDone && E.shown < items.length && now >= E.nextAt) { items[E.shown].classList.add('on'); E.shown++; E.nextAt = now + ES_ITEM; Snd.play('ach', 200); }
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
    const nx = root.querySelector('.es-next'); if (nx) nx.classList.add('on');
  }
  // 결과창을 (다시) 그린 직후 부른다: 진행을 이어 간다
  function esKick() { const E = S.es; if (E && !E.raf && E.g === g) E.raf = requestAnimationFrame(esStep); }
  // ② 배틀기록 칸 하나: 라벨 + 값. 값은 숫자(굵은 숫자 글꼴)와 단위(작게)를 나눠 쓴다
  // 문구 안의 {n} 자리에서 갈라 숫자만 크게: 「{n}討伐」 → 0 + 討伐
  const esNumUnit = (key, n) => { const s = String(I.t(key, { n: '\u0001' })).split('\u0001'); return `${s[0] ? `<small>${esc(s[0])}</small>` : ''}<b>${n}</b>${s[1] ? `<small>${esc(s[1])}</small>` : ''}`; };
  // 판 끝 통계: 요약 · 보스전 기록(순위) · 라인 피해 순위 · 강화·조합 기록
  function endStats() {
    const s = g.stats, win = g.over === 'win', mm = Math.floor(g.time / 60), ss = Math.floor(g.time % 60);
    const cell = (l, v, cls, extra) => `<div class="esr-c ${cls || ''}"${extra || ''}><small class="esr-l">${l}</small><span class="esr-v">${v}</span></div>`;
    // 결과창 진행 상태(강제 보기): 처음 그릴 때 시작한다. want = 서버에 결과를 보냈다(경험치·동전 답을 기다린다)
    if (!S.es || S.es.g !== g) S.es = { g, t0: performance.now(), want: !!S.reported, open: false, shown: 0, xpT0: 0, xpEnd: 0, nextAt: 0, xpNow: null, coinOn: false, raf: 0 };
    const lock = !S.es.open;
    // 큰 칸 4: 도달 라운드(승리면 「クリア」, 값 주홍) · 난이도 · 최고 등급(등급색) · 처치
    const hasMut = !!(g.mutLv && g.muts && g.muts.length);
    const diff = `<b class="tx">${esc(g.diff.name)}</b>${g.mutLv ? `<em class="mut">+${g.mutLv}</em>` : ''}${net ? `<small>${esc(I.t('nCoop', { n: net.roster().length }))}</small>` : ''}`
      + (hasMut ? `<em class="es-bang" aria-label="${esc(I.t('mutHead', { n: g.mutLv }))}">!</em>` : '');
    const best = s.bestName ? `<b class="tx" style="--tc:${tierColor(s.best)}">${esc(s.bestName)}</b>${s.best != null ? `<small>${esc(rankTag(s.best))}</small>` : ''}` : '<b>-</b>';
    const big = cell(esc(I.t(win ? 'esClear' : 'reachRound')), `<b>${g.resultRound}</b><small>/ ${g.diff.rounds}</small>`, `rd ${win ? 'win' : ''}`)
      + cell(esc(t('difficulty')), diff, `es-diff ${hasMut ? 'has-mut' : ''}`)
      + cell(esc(I.t('bestTier')), best, 'best')
      + cell(esc(I.t('kills')), `<b>${fmt(s.kills)}</b>`);
    // 작은 칸 6: 시간 · 중보스(놓친 경우만 「逃しN」 붉게) · 잃은 라이프(라이프가 다해 졌을 때만 붉게) · 번 금화 · 합성·조합 · 업적
    const small = cell(esc(I.t('playTime')), `<b>${mm}:${String(ss).padStart(2, '0')}</b>`)
      + cell(esc(I.t('midboss')), esNumUnit('midKills', s.midKill) + (s.midMiss ? `<em class="bad">${esc(I.t('esMidMiss', { n: s.midMiss }))}</em>` : ''))
      + cell(esc(I.t('lifeLost')), `<b>${s.lifeLost}</b>`, !win && g.lives <= 0 ? 'bad' : '')
      + cell(esc(I.t('goldEarned')), `<b>${fmt(s.goldIn)}</b>`)
      + cell(esc(I.t('combCraft')), `<b>${s.combines}</b><small>·</small><b>${s.crafts.length}</b>`)
      + cell(esc(I.t('ach')), `<b>${Object.keys(g.me.done).length}</b><small>/ ${T.achievements.length}</small>`);
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
    const detail = `${bossRows ? `<h3>${I.t('bossLog')}</h3><table class="es-boss"><tr><th>${I.t('thBoss')}</th><th>${I.t('thResult')}</th><th>${I.t('thTime')}</th><th>${I.t('thChamp')}</th><th>${I.t('dmgRank')}</th></tr>${bossRows}</table>` : ''}
      ${dmgRows ? `<h3>${I.t('laneDmgRank')}</h3>${dmgRows}` : ''}
      ${ups ? `<h3>${I.t('upgrade')}</h3><div class="chips">${ups}</div>` : ''}
      ${crafts ? `<h3>${I.t('craftedHead')}</h3><div class="chips">${crafts}</div>` : ''}`;
    // '같은 설정으로 다시': 이 판이 마지막에 시작한 설정(rtd-last)과 같은 싱글 판일 때만(협동 방·빠른 대전·이어하기는 숨김)
    let last = null; try { last = JSON.parse(localStorage.getItem('rtd-last') || 'null'); } catch (e) { last = null; }
    const againOk = !!last && !S.fromSnap && !S.online && last.play === 'offline' && last.diff === g.diff.id && (bots.length ? last.mode === 'ai' : !net && last.mode === 'solo');
    const lost = lostLine();
    // 제목판: 먹 붓자국 위 붓글씨(승리 금빛, 패배 종이색)
    const head = win ? `<div class="es-win"><span>${t('win')}</span></div>` : `<div class="es-lose"><span>${t('lose')}</span></div>`;
    // 창 = 스크롤되는 본문(.es-body) + 고정 바닥 줄(.es-foot). 버튼이 통계 칸을 가리지 않는다
    return `<div class="over" id="end"><div class="sheet es ${win ? 'is-win' : 'is-lose'}"><div class="es-body">
      ${head}${lost ? `<div class="es-lost">${lost}</div>` : ''}${S.tkMiss ? `<div class="dim" style="color:#ff9d8a">${t('noTicket')}</div>` : ''}
      ${esMe()}
      <div class="es-rec"><div class="esr-big">${big}</div><div class="esr-small">${small}</div></div>
      ${goalBox()}
      ${hasMut ? `<div class="es-mutpop" hidden><b>${esc(I.t('mutHead', { n: g.mutLv }))}</b>${g.muts.map((m, i) => mutCard(m.id, i)).join('')}</div>` : ''}
      ${detail.trim() ? `<div class="es-detail">${detail}</div>` : ''}
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
  // 등급 한 칸(레벨 lv → lv+1)의 경험치 범위. 군주는 끝
  const lvSpan = (lv) => [xpAt(lv), lv < window.RTD_PROG.MAX_LV ? xpAt(lv + 1) : xpAt(lv) + 1];
  const rankMark = (r) => `<span class="xpm"><img alt="" src="gfx/rank_${r}.png" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'${r}'}))"></span>`;
  function playXp(from, to, coins, done) {
    const track = ACC.me && ACC.me.track === 'civ' ? 'civ' : 'mil';
    const el = document.createElement('div'); el.id = 'xpfx';
    el.innerHTML = `<div class="xpbox"><div class="xpside l"></div><div class="xpmid"><div class="xpbar"><i></i></div><div class="xpnum"></div><div class="xpgain">+${fmt(to - from)} XP</div><div class="xpcoin">+${fmt(coins || 0)} ${t('lb_coin')}</div></div><div class="xpside r"></div></div>`;
    $('app').appendChild(el);
    // 양옆: 지금 등급과 다음 등급("백인대장 3" → "백인대장 4"). 막대는 등급 한 칸(2026-11-25 economy-v2)
    const side = (lv) => `${rankMark(rkOfLv(lv))}<small>${esc(window.RTD_PROG.label(t, 'rk_' + track + rkOfLv(lv), lv))}</small>`;
    let shownLv = -1;
    const draw = (xp) => {
      const lv = lvOfXp(xp), r = rkOfLv(lv), [lo, hi] = lvSpan(lv), k = r >= 10 ? 1 : Math.max(0, Math.min(1, (xp - lo) / (hi - lo)));
      if (lv !== shownLv) { el.querySelector('.l').innerHTML = side(lv); el.querySelector('.r').innerHTML = r < 10 ? side(lv + 1) : ''; if (shownLv >= 0) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); } shownLv = lv; }
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
  // ---- 신화·불멸 체험 결과 카드(trial-mode.md 4-3): 장수 얼굴·이름·등급·칭호, 큰 숫자 3개(총 피해·초당 피해·최대 한 방),
  // 걸린 시간과 「강화 10단계 기준」, 마속의 한 줄, 특성 목록, 「이 장수 해금하기」(동전 안내)·「상점으로 돌아가기」. 두 버튼 모두 로비 상점 해금 탭의 그 장수 카드로(11-actions trialLeave).
  // 보상·경험치·전적은 없다(결과 보고를 하지 않는다).
  function trialCard() {
    const R = g.trialRes || {}, d = defOf[g.trial.unit], bossName = (T.trialBoss && T.trialBoss.name) || '';
    if (!d) return '';
    const me = ACC.me, U = T.unlock, cost = U && U.coins ? U.coins[d.tier] : null;
    const owned = me && U && (me.owned || []).includes(U.key(d.id));
    let coin = '';
    if (me && ACC.token && cost && !owned) coin = (me.coins || 0) >= cost ? I.t('trCanBuy', { n: cost }) : I.t('trShort', { n: cost - (me.coins || 0) });
    const num = (k, v) => `<div class="tr-num"><small>${esc(I.t(k))}</small><b>${esc(fmt(v || 0))}</b></div>`;
    const traits = (d.p || []).map((x) => `<li><b>${esc(x.name)}</b> ${esc(x.desc || '')}</li>`).join('');
    return `<div class="over"><div class="sheet trialc" id="trialc">
      <div class="tr-head"><img class="tr-por" alt="" src="${Art.portrait(d)}"><div class="tr-nm"><small>${esc(I.t('trHead'))}</small><strong style="color:${tierColor(d.tier)}">${esc(d.name)}</strong><span>${esc(rankName(d.tier))}${d.title ? ' · ' + esc(d.title) : ''}</span></div></div>
      <div class="tr-line">${esc(I.t(R.win ? 'tb_down' : 'tb_timeup'))}</div>
      <div class="tr-nums">${num('trTotal', R.total)}${num('trDps', R.dps)}${num('trBest', R.best)}</div>
      <div class="tr-sub">${esc(R.win ? I.t('trWin', { a: bossName, n: R.time }) : I.t('trTimeUp'))} · ${esc(I.t('trBasis', { n: R.upLv != null ? R.upLv : g.trial.upLv }))}</div>
      ${traits ? `<div class="tr-traits"><small>${esc(I.t('trTraits'))}</small><ul>${traits}</ul></div>` : ''}
      <div class="tr-btns"><button class="btn go tr-cta" data-act="trialUnlock" type="button">${esc(I.t('trUnlock'))}${coin ? `<small>${esc(coin)}</small>` : ''}</button><button class="btn" data-act="trialBack" type="button">${esc(I.t('trBack'))}</button></div>
    </div></div>`;
  }
