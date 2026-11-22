  function renderInfo() {
    if (inBoss()) return renderFight();
    if (!laneOn()) { setInfo(`<h3>${g.fight ? esc(g.fight.def.title) : ''}</h3><div class="sub">${I.t('laneStopped')}</div>`); setRecipes(''); setCmds(fillCmds([])); return; }
    const vp = viewedPeer();
    if (vp) {
      const r = S.rsel && S.rsel.peer === vp.id ? S.rsel : null;
      setInfo(r ? unitInfo({ def: r.d }, r.atk) : `<h3>${esc(I.t('peerField', { a: vp.state.name }))}</h3><div class="sub">${I.t('peerHint')}</div>`);
      setRecipes(`<div class="sub line">${I.t('peerUnits')}</div>`);
      setCmds(fillCmds(r ? (r.d.p || []).map(passiveCell).concat((r.d.sk || []).map((s) => skillCell(s))) : []));
      return;
    }
    const list = selUnits(), p = g.me, drop = S.dropSel ? g.drops.find((d) => d.id === S.dropSel) : null;
    if (drop) {
      setInfo(dropInfo(drop));
      { const rid = drop.kind === 'item' && Object.keys(T.recipes).find((id) => g.recipeOf(id).item === drop.item); 
        // 신화 아이템 4개 → 랜덤 불멸 아이템(모바일은 접힌 정보 칸 대신 늘 보이는 조합식 줄에 둔다)
        const myth = drop.kind === 'item' && T.items.find((i) => i.id === drop.item).tier === 9, ok = myth && g.canFuse(p);
        const fuse = myth ? `<div class="rc"><span class="rp">${I.t('fuseHave', { n: g.mythItems(p).length })}</span><button class="btn ${ok ? 'go' : ''}" data-act="fuse" type="button" ${ok ? '' : 'disabled'}>${I.t('fuseBtn')}</button></div>` : '';
        setRecipes((rid ? recipeLine(rid) : '') + fuse); }
      setCmds(fillCmds(drop.kind === 'item' ? [] : [cmdBtn('useDrop', I.t('use'), '', true, S.cmdMode === 'use')]));
      return;
    }
    if (!list.length) { setInfo(`<h3>${I.t('commandHead')}</h3><div class="sub">${I.t('commandHint')}</div>`); setRecipes(`<div class="sub line">${I.t('recipeHint')}</div>`); setCmds(fillCmds([])); return; }
    const u = list[0], d = u.def, mob = list.some((x) => x.def.tier > 0);
    if (list.length === 1) setInfo(unitInfo(u));
    else {
      const c = {}; list.forEach((x) => (c[x.def.id] = (c[x.def.id] || 0) + 1));
      // 등급 높은 순으로, 등급 색과 함께. 누르면 그 유닛만 다시 선택한다.
      const ids = Object.keys(c).sort((a, b) => defOf[b].tier - defOf[a].tier);
      setInfo(`<h3>${I.t('nSelected', { n: list.length })}</h3><div class="chips">${ids.map((id) => `<button class="chip" data-act="selDef" data-arg="${id}" type="button" style="color:${tierColor(defOf[id].tier)};border-color:${tierColor(defOf[id].tier)}">${esc(defOf[id].name)} ${rankTag(defOf[id].tier)} ×${c[id]}</button>`).join('')}</div>`);
    }
    // 이동·어택땅·점사 아이콘은 뺐다(터치·키 M/A/S로는 그대로 쓴다)
    const cells = [];
    if (list.length === 1) {
      (d.p || []).forEach((x) => cells.push(passiveCell(x)));
      (d.sk || []).forEach((s) => cells.push(skillCell(s)));
      if (d.tier === 1) cells.push(cmdBtn('sell', t('disband'), '', true));
      if (!S.coarse) { /* PC는 Esc로 해제 */ }
      setRecipes(unitRecipes(u));
    } else setRecipes(`<div class="sub line">${I.t('recipeOne')}</div>`);
    cells.push(cmdBtn('desel', t('deselect'), '', true));
    setCmds(fillCmds(cells));
  }
  function renderFight() {
    const l = g.localChamps(), act = g.active(), dead = l.some((c) => c.dead);
    setInfo(act ? unitInfo(act.u) : `<h3>${I.t('noChamp')}</h3><div class="sub">${I.t('noChampHint')}</div>`);
    const subs = g.pickChoices().slice(0, 6);
    // 내 장수 HP + 걸린 보스전 인연(상한 초과는 흐리게, 스택 수)
    const sy = act && act.syR ? act.syR.map((R) => ({ s: R.s, lv: R.lv, g: R.g })).concat((act.syOver || []).map((id) => { const s = T.synergies.find((x) => x.id === id), x = g.me.syn[id]; return { s, lv: x ? x.lv : 1, g: x ? x.tier.g : 1, over: true }; })) : [];
    const hpLine = act ? `<div class="line">${I.t('curHp')} <strong>${fmt(act.hp)} / ${fmt(act.mhp)}</strong></div>${sy.length ? `<div class="line">${synBadges(sy, act)}</div>` : ''}` : '';
    const mini = l.map((c, i) => `<button class="btn ${c === act ? 'on' : ''}" data-act="champ" data-arg="${i}" type="button" ${c.dead ? 'disabled' : ''}>${i + 1}. ${esc(c.def.name)} ${Math.round((c.hp / c.mhp) * 100)}%</button>`).join('');
    setRecipes(`${hpLine}${dead && !g.mut.relay ? `<div class="h">${I.t('subDeploy')}</div><div class="chips">${subs.map((u) => `<button class="btn" data-act="sub" data-arg="${u.id}" type="button">${esc(u.def.name)} ${rankTag(u.def.tier)}</button>`).join('') || I.t('noSubs')}</div>` : ''}<div class="mini">${mini}</div>`);
    const left = g.healLeft();
    const healCell = left == null ? [] : [cmdBtn('heal', I.t('hwataHeal', { n: left }), '', left > 0)];
    if (!act) { setCmds(fillCmds(healCell)); return; }
    const d = act.def, cells = [cmdBtn('stop', I.t('stop'), '', true)];
    if (d.tier >= g.R.dashMinTier) cells.push(cmdBtn('dash', I.t('dash'), '', true, false, act.dashCd > 0 ? `<i class="cool" style="height:${(act.dashCd / g.R.dashCd) * 100}%"></i>` : ''));
    const M = g.fight.mech;
    (d.sk || []).forEach((s, i) => {
      // 미인계는 팀 공용 재사용을 함께 보여 준다
      const cd = act.skillCd[i];
      cells.push(`<button class="cmd" data-act="skill" data-arg="${i}" type="button" ${tipAttr(s.n, t('active'), skillDesc(s))}>${icon(SKILL_ICON[s.k], s.fx)}${cd > 0 ? `<i class="cool" style="height:${Math.min(100, (cd / s.cd) * 100)}%"></i>` : ''}</button>`);
    });
    (d.p || []).forEach((x) => cells.push(passiveCell(x)));
    cells.push(...healCell);
    const box = $('cmds'), html = fillCmds(cells); if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
  }
  // 명령칸 설명 팝업
  {
    const tip = document.createElement('div'); tip.id = 'cmdtip'; tip.hidden = true; document.body.appendChild(tip);
    let cur = null;
    const show = (el) => {
      cur = el;
      tip.innerHTML = `<b>${esc(el.dataset.tn)}</b><small>${esc(el.dataset.tt)}</small>${el.dataset.td ? `<div>${esc(el.dataset.td)}</div>` : ''}`;
      tip.hidden = false;
      const r = el.getBoundingClientRect(), z = zoom || 1;
      const x = Math.min(r.left / z, window.innerWidth / z - tip.offsetWidth - 6), y = r.top / z - tip.offsetHeight - 8;
      tip.style.left = Math.max(4, x) + 'px'; tip.style.top = (y < 4 ? r.bottom / z + 8 : y) + 'px';
    };
    $('cmds').addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tn]'); if (el && el !== cur) show(el); else if (!el) { tip.hidden = true; cur = null; } });
    $('cmds').addEventListener('mouseleave', () => { tip.hidden = true; cur = null; });
    let tipT = 0;
    $('cmds').addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      const el = e.target.closest('[data-tn]'); if (!el) return;
      show(el); clearTimeout(tipT); tipT = setTimeout(() => { tip.hidden = true; cur = null; }, 2600);
    });
    // 칸이 다시 그려지면 같은 자리의 새 칸으로 설명을 이어 준다
    setInterval(() => { if (cur && !cur.isConnected) { tip.hidden = true; cur = null; } }, 300);
  }
  // 권장 화력을 등급·업글·기수로 풀어 쓴다
  function advise(need, n) {
    for (let t = 2; t <= 10; t++) {
      const r = g.rankOf[t], cap = t < 3 ? 0 : t <= 6 ? 8 : 14, lv = Math.max(0, Math.ceil((need / (n * r.atk) - 1) / 0.2));
      if (lv <= cap) return `${rankName(t)}${lv ? ' ' + I.t('upg', { n: lv }) : ''} ${I.t('nUnits', { n })}`;
    }
    return `${rankName(10)} ${I.t('upg', { n: 20 })} ${I.t('nUnits', { n })}`;
  }
  function timerDetail(x) {
    if (x.boss) {
      const b = g.bossByRound[x.r], dps = g.bossStats(b).hp / (b.time * 0.45), n = g.slotCount(), rw = T.bossRewards[x.r] || {};
      const fast = rw.tickets ? `<div><b>${I.t('fastClear')}</b> ${I.t('fastHint', { r: rankName(Math.max(1, rw.tickets[0][0] - 1)) })}</div>` : '';
      return `<div>${esc(b.title)} · ${I.t('limit', { t: clock(b.time) })}</div><div><b>${I.t('recommend')}</b> ${advise(dps, n)}${n > 1 ? ` ${I.t('or')} ${advise(dps, 1)}` : ''}</div><div><b>${I.t('reward')}</b> ${esc(rwText(rw))}</div>${fast}`;
    }
    const m = g.midByRound[x.r], hp = g.monsterHp(m.round) * 12;
    return `<div>${esc(m.story)} · ${I.t('limit45')}</div><div><b>${I.t('recommend')}</b> ${I.t('onPath', { a: advise(hp / 18, 3) })}</div><div><b>${I.t('reward')}</b> ${esc(rwText(m.reward))}</div>`;
  }
  let timerRows = null;
  function buildTimers() {
    timerRows = T.bosses.map((b) => ({ r: b.round, name: b.name, boss: true }))
      .concat(T.midbosses.map((m) => ({ r: m.round, name: m.name })))
      .filter((x) => x.r <= g.diff.rounds).sort((a, b) => a.r - b.r);
    $('tlist').innerHTML = timerRows.map((x) => `<div class="tw" data-r="${x.r}"><div class="tr ${x.boss ? 'boss' : ''}" data-act="timer" data-arg="${x.r}"><span class="rd">R${x.r}</span><span class="nm">${esc(x.name)}</span><span class="tm"></span><i class="gauge"></i></div><div class="td"><div class="ti">${timerDetail(x)}</div></div></div>`).join('');
    timerRows.forEach((x) => { x.row = $('tlist').querySelector(`.tw[data-r="${x.r}"] .tr`); x.tm = x.row.querySelector('.tm'); x.gauge = x.row.querySelector('.gauge'); });
  }
  // 보스와 중간보스의 소환까지 남은 시간. 보스전 시간은 플레이에 따라 달라 계산에서 뺀다.
  function renderTimers() {
    if (!timerRows) buildTimers();
    const left = g.phase === 'wave' ? Math.max(0, g.R.roundTime - g.roundT) : g.R.roundTime;
    const eta = (x) => {
      let t = left;
      for (let r = g.round + 1; r < x.r; r++) if (!g.bossByRound[r]) t += g.R.roundTime;
      return t;
    };
    let nextKey = null, hudBoss = null;
    const hudMid = [];
    timerRows.forEach((x) => {
      let tm, cls = x.boss ? 'tr boss' : 'tr', fill = 0;
      if (x.boss && x.r === g.round && g.fight) { tm = g.phase === 'boss' ? clock(Math.max(0, g.fight.limit - g.fight.t)) : I.t('appearShort'); cls += ' now'; }
      else if (!x.boss && g.mids[x.r] && g.mids[x.r].state === 'field') {
        const e = g.enemies.find((o) => o.mid && o.midDef.round === x.r);
        tm = e ? I.t('field') + ' ' + clock(Math.ceil(e.midT)) : I.t('field'); cls += ' now'; fill = e ? e.midT / g.R.midLimit : 0;
      }
      else if (!x.boss && g.mids[x.r] && g.mids[x.r].state === 'cool') { tm = I.t('respawn') + ' ' + clock(Math.ceil(g.mids[x.r].t)); fill = g.mids[x.r].t / (g.midByRound[x.r].respawn || g.R.midRespawn); }
      else if (x.r <= g.round) { tm = I.t('downed'); cls += ' past'; }
      else tm = clock(eta(x));
      if (!cls.includes('past') && nextKey == null) nextKey = x.r;
      if (x.boss && !cls.includes('past') && !hudBoss) hudBoss = `R${x.r} ${x.name} ${tm}`;
      if (!x.boss && cls.includes('now') && tm.startsWith(I.t('field'))) hudMid.push([`${t('midBoss')} ${x.name}`, tm]); // 16-hud가 두 묶음으로 나눠 줄바꿈한다
      x.gauge.style.width = fill * 100 + '%';
      if (x.tm.textContent !== tm) x.tm.textContent = tm;
      if (x.row.className !== cls) x.row.className = cls;
    });
    S.hudNext = { boss: hudBoss, mids: hudMid };
    const box = $('tlist');
    if (box.dataset.next !== String(nextKey)) {
      box.dataset.next = nextKey;
      const el = box.querySelector(`.tw[data-r="${nextKey}"]`);
      if (el) box.scrollTop = el.offsetTop - box.offsetTop;
    }
  }
  // 이 장수가 출전하면 받을 보스전 인연(지금 판 기준): 시그니처는 core만. 등급 높은 순 → 표 순서, 상한을 넘는 것은 over
  function synBossFor(d) {
    const p = g && g.me, max = g.synMaxPerCarry || 5;
    if (!p || !p.syn || !d.tier) return [];
    const out = [];
    (T.synergies || []).forEach((s, i) => { const x = p.syn[s.id]; if (x && x.tier && x.tier.boss && (s.core ? s.core === d.id : s.units.includes(d.id))) out.push({ s, lv: x.lv, g: x.tier.g || 1, o: i }); });
    out.sort((a, b) => b.g - a.g || a.o - b.o);
    out.forEach((x, i) => (x.over = i >= max));
    return out;
  }
  // 인연 배지 한 줄(출전 카드·보스전 정보): 등급색 점 + 단계 수, 상한 초과는 흐리게. stacks: 보스전 중이면 쌓인 수
  function synBadges(list, champ) {
    return list.length ? `<span class="sybd">${list.map((x) => {
      const tr = x.s.tiers[x.lv - 1], key = champ && champ.syS && tr && tr.boss ? ((tr.boss.rules || []).map((r) => r.do.find((q) => q.k === 'stack')).find(Boolean) || {}).key : null, st = key ? champ.syS[key] : null; // 쌓인 수
      return `<i class="${x.over ? 'ov' : ''}" title="${esc(x.s.name)}${x.over ? ' · ' + esc(t('synOverCap')) : ''}"><b style="background:${GRADE_COL[x.g]}"></b>${esc(x.s.name)} ${x.lv}${st && st.n > 0 ? ` <u>${st.n}</u>` : ''}</i>`;
    }).join('')}</span>` : '';
  }
  // ---- 맵 왼쪽 인연 줄(v0.3 단계형): 인연마다 육각 아이콘(대표 인물 얼굴) + 진행(모은 수/다음 단계 인원) + 단계 점 + 등급 배지. ----
  // 켜진 것 → 다음 단계까지 1명 남은 것 → 나머지 순. 50개가 넘어도 줄이 세로로 스크롤된다(쪽 넘김 없음).
  // 누르면(마우스는 올리면) 단계 표·구성원·보스전 안내가 뜬다(창 안을 스크롤할 수 있다).
  const GRADE_COL = ['#9a8e78', '#7ed08c', '#6aa8ff', '#c08aff', '#ffd86a', '#ff8a5a'];
  const gradeTxt = (gr) => t('synG' + Math.max(1, Math.min(5, gr)));
  let synRep = null;
  // 대표 인물: 시그니처는 core, 아니면 다른 인연에 가장 덜 나오는 인물(같은 얼굴이 여러 칸에 겹치지 않게)
  function synFace(s) {
    if (!synRep) {
      const cnt = {}; synRep = {};
      (T.synergies || []).forEach((x) => x.units.forEach((id) => { cnt[id] = (cnt[id] || 0) + 1; }));
      (T.synergies || []).forEach((x) => { synRep[x.id] = x.core || x.units.filter((id) => defOf[id].tier > 0).sort((a, b) => cnt[a] - cnt[b] || defOf[b].tier - defOf[a].tier)[0] || x.units[0]; });
    }
    return defOf[synRep[s.id]];
  }
  // 인연 하나의 진행: 모은 수 n, 단계 lv, 다음 단계 인원 next(없으면 마지막 단계 인원), 다음까지 남은 수 gap, 지금(없으면 다음) 등급
  function synProg(s, p) {
    const n = (p.synN && p.synN[s.id]) || 0, x = p.syn && p.syn[s.id], lv = x ? x.lv : 0, tiers = s.tiers || [];
    const nt = tiers[lv] || null, next = nt ? nt.n : (tiers[tiers.length - 1] || { n: s.units.length }).n;
    const gr = (tiers[Math.max(0, lv - 1)] || {}).g || 1;
    return { s, n, lv, on: lv > 0, next, gap: nt ? Math.max(0, nt.n - n) : 0, g: lv ? gr : (tiers[0] || {}).g || 1, coreMiss: !!(s.core && !g.has(p, s.core)) };
  }
  function synVisible(p) {
    return (T.synergies || []).map((s) => synProg(s, p)).filter((x) => (x.s.hidden ? x.on : x.n > 0))
      .sort((a, b) => b.on - a.on || (b.on ? b.g - a.g : 0) || (a.gap === 1) * -1 + (b.gap === 1) * 1 || b.n / b.next - a.n / a.next);
  }
  const dotsOf = (x) => (x.s.tiers || []).map((tr, i) => `<i class="${i < x.lv ? 'on' : ''}"></i>`).join('');
  // 다음 단계에 core가 필요한데 core가 없으면 지금은 노릴 수 없는 인연이다(needCore: false 단계는 core 없이도 노릴 수 있다)
  const synCoreOk = (x, p) => { const nt = (x.s.tiers || [])[x.lv]; return !x.s.core || g.has(p, x.s.core) || !!(nt && nt.needCore === false); };
  // 왼쪽 줄(2026-11-21 정리): 켜진 것(등급 높은 순) + 다음 단계까지 1명 남고 core 조건을 채운 것(가까운 순).
  // 6칸까지(켜진 것이 6개를 넘으면 켜진 것만 9칸까지). 화면 아래까지 자리가 모자라면 들어가는 줄 수만큼만(목록 버튼이 늘 보이게).
  // 나머지는 줄 끝 「인연 목록」 창에서 본다.
  const SYN_BAR_MIN = 6, SYN_BAR_MAX = 9;
  function synBarList(vis, p, room) {
    const on = vis.filter((x) => x.on), near = vis.filter((x) => !x.on && x.gap === 1 && synCoreOk(x, p)).sort((a, b) => b.n / b.next - a.n / a.next || b.g - a.g);
    return on.concat(near).slice(0, Math.min(room, Math.max(SYN_BAR_MIN, Math.min(SYN_BAR_MAX, on.length))));
  }
  const synCell = (x, tag) => `<${tag} class="sy ${x.on ? 'on' : ''} ${x.gap === 1 && !x.coreMiss ? 'near' : ''}"${tag === 'button' ? ` data-syn="${x.s.id}" type="button" aria-label="${esc(x.s.name)}"` : ''}><i><img alt="" src="${Art.portrait(synFace(x.s))}"></i><u>${dotsOf(x)}</u><em style="background:${GRADE_COL[x.g]}">${esc(gradeTxt(x.g))}</em><b>${x.n}/${x.next}</b></${tag}>`;
  function renderSynBar(vis) {
    const bar = $('synbar'), show = laneOn() && !viewedPeer() && !g.over;
    if (bar.hidden !== !show) bar.hidden = !show;
    if (!show) { if (S.synPop) showSyn(null); if (S.synAll) openSynAll(false); return; }
    // 왼쪽 정보 줄 바로 아래에 3칸씩 놓고, 화면 아래까지 넘치면 줄 안에서 세로로 스크롤한다
    const hud = $('hud'), vh = window.innerHeight / zoom;
    // 아래 안전 영역(아이폰 홈 막대): #synall의 padding-bottom(var(--sb) = max(6px, env(safe-area-inset-bottom)))을 화면 크기가 바뀔 때만 읽는다
    const szk = window.innerWidth + 'x' + window.innerHeight;
    if (S.synSbK !== szk) { S.synSbK = szk; S.synSb = parseFloat(getComputedStyle($('synall')).paddingBottom) || 6; }
    const left = hud.offsetLeft, topY = hud.offsetTop + hud.offsetHeight + 6, avail = Math.max(60, vh - topY - S.synSb - 4);
    // 얼굴 그림은 주소가 길어 매번 만들지 않는다(구성이 바뀌거나 5초마다 한 번만 다시 그린다 — 그림이 늦게 불러져도 따라온다)
    // 칸 한 줄 높이(칸 + 줄 간격)는 그려진 칸에서 재어 둔다. 목록 버튼 자리(약 24px)와 위 여백(7px)을 빼고 들어가는 줄 수 × 3칸
    const rows = Math.max(1, Math.floor((avail - 31) / (S.synRowH || 46)));
    const list = synBarList(vis, g.me, rows * 3), more = vis.length - list.length;
    const key = list.map((x) => x.s.id + x.n + ':' + x.lv).join() + '|' + more + '@' + Math.floor(performance.now() / 5000);
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = list.map((x) => synCell(x, 'button')).join('') + `<button class="syall" data-synall="1" type="button">${esc(t('synAll'))}${more > 0 ? ` (${more})` : ''}</button>`;
      const c = bar.querySelector('.sy'); if (c) S.synRowH = c.offsetHeight + (parseFloat(getComputedStyle(bar).rowGap) || 6);
    }
    const pos = left + ',' + topY + ',' + Math.round(avail);
    if (bar.dataset.pos !== pos) { bar.dataset.pos = pos; bar.style.left = left + 'px'; bar.style.top = topY + 'px'; bar.style.maxHeight = Math.round(avail) + 'px'; }
    // 넘칠 때만 줄이 손가락을 받아 스크롤한다(안 넘치면 아래 전장을 가리지 않게 통과)
    const sc = bar.scrollHeight > bar.clientHeight + 2; if (bar.classList.contains('scroll') !== sc) bar.classList.toggle('scroll', sc);
  }
  // 단계 표: 단계마다 인원·등급·라인 효과·보스전 효과, 지금 단계 강조
  function synTiersHtml(x) {
    const st = I.synTierText;
    return (x.s.tiers || []).map((tr, i) => {
      const d = st ? st(T, x.s, tr) : { lane: '', boss: '' };
      return `<div class="st ${i === x.lv - 1 ? 'cur' : i < x.lv ? 'past' : ''}"><span class="tn">${esc(t('synTierN', { n: tr.n }))}<em style="background:${GRADE_COL[tr.g || 1]}">${esc(gradeTxt(tr.g || 1))}</em></span>`
        + `<span><b>${esc(t('synLaneH'))}</b> ${esc(d.lane || t('synNone'))}</span><span><b>${esc(t('synBossH'))}</b> ${esc(d.boss || t('synNone'))}</span></div>`;
    }).join('');
  }
  function showSyn(id, el) {
    const pop = $('achpop'), s = id && (T.synergies || []).find((x) => x.id === id), p = g && g.me;
    if (!s || !el || !p) { if (S.synPop) { pop.hidden = true; pop.classList.remove('sp'); } S.synPop = null; return; }
    const x = synProg(s, p);
    // 구성원: 가진 사람 밝게, 없는 사람 흐리게, 잠긴 장수는 흐린 점선, core는 금 테
    const chips = s.units.map((u) => { const d = defOf[u], lk = g.isLocked && g.isLocked(u); return `<span class="ac ${g.has(p, u) ? 'have' : ''} ${lk ? 'lk' : ''} ${s.core === u ? 'core' : ''}" style="color:${(d.tier && tierColor(d.tier)) || '#f4ecd8'}">${esc(d.name)}</span>`; }).join('');
    pop.innerHTML = `<strong>${s.hidden ? '★ ' : ''}${esc(s.name)} <span style="font:400 12px 'Black Han Sans',sans-serif;color:${x.on ? '#ffd86a' : '#cfc3a8'}">${x.n}/${x.next}</span></strong>`
      + `<div class="chips">${chips}</div>${x.coreMiss ? `<div class="sn">${esc(t('synCore', { a: defOf[s.core].name }))}</div>` : ''}`
      + `<div style="margin-top:4px;color:${x.on ? '#f4ecd8' : 'var(--dim)'}">${esc(s.desc)}</div><div class="sts">${synTiersHtml(x)}</div>`
      + `<div class="sn">${esc(t('synBossNote', { n: g.synMaxPerCarry || 5 }))}</div>`;
    const inAll = !!el.closest('#synall');
    pop.classList.add('sp'); pop.classList.toggle('sx', inAll);
    pop.hidden = false; S.synPop = id;
    const r = el.getBoundingClientRect(), vw = window.innerWidth / zoom;
    const lx = inAll ? (r.right / zoom + 6 + pop.offsetWidth <= vw - 4 ? r.right / zoom + 6 : r.left / zoom - pop.offsetWidth - 6) : $('synbar').getBoundingClientRect().right / zoom + 8;
    pop.style.left = Math.max(4, Math.min(lx, vw - pop.offsetWidth - 4)) + 'px';
    pop.style.top = Math.max(4, Math.min(r.top / zoom, window.innerHeight / zoom - pop.offsetHeight - 4)) + 'px';
  }
  {
    const bar = $('synbar');
    // 터치: 누르면 뜨고, 다른 곳을 누르면 닫힌다(닫기는 10-input의 업적 창 처리와 같이 쓴다). 마우스: 올리면 뜨고 벗어나면 닫힌다.
    bar.addEventListener('click', (e) => { if (e.target.closest('[data-synall]')) { showSyn(null); openSynAll(true); return; } const b = e.target.closest('[data-syn]'); if (b) showSyn(b.dataset.syn, b); });
    bar.addEventListener('pointerover', (e) => { if (e.pointerType === 'touch') return; const b = e.target.closest('[data-syn]'); if (b) showSyn(b.dataset.syn, b); });
    bar.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !(e.relatedTarget && $('achpop').contains(e.relatedTarget))) showSyn(null); });
    bar.addEventListener('scroll', () => { if (S.synPop) showSyn(null); }, { passive: true });
    // 전체 인연 창: 칸을 누르면 인연 창, 빈 곳을 누르면 인연 창만 닫고, 바깥 어두운 곳·닫기 버튼은 창을 닫는다
    const all = $('synall');
    all.addEventListener('click', (e) => {
      if (e.target === all || e.target.closest('[data-synclose]')) { showSyn(null); openSynAll(false); return; }
      const b = e.target.closest('[data-syn]');
      if (b) showSyn(b.dataset.syn, b); else showSyn(null);
    });
    all.addEventListener('scroll', () => { if (S.synPop) showSyn(null); }, { passive: true, capture: true });
  }
  // 전체 인연 창(왼쪽 줄 끝 「인연 목록」): 58개 전부를 발동 중 / 진행 중 / 시작 안 함으로 나눈다. 숨은 인연(hidden)은 켜질 때까지 뺀다.
  function openSynAll(on) {
    const box = $('synall');
    S.synAll = !!on; box.hidden = !on;
    if (on) { box.dataset.key = ''; renderSynAll(); const b = box.querySelector('.sabody'); if (b) b.scrollTop = 0; } else box.innerHTML = '';
  }
  function renderSynAll() {
    const box = $('synall'), p = g.me;
    if (!S.synAll || !p) return;
    const all = (T.synergies || []).map((s) => synProg(s, p)).filter((x) => !x.s.hidden || x.on);
    const on = all.filter((x) => x.on).sort((a, b) => b.g - a.g || b.lv - a.lv);
    // 진행 중: 노릴 수 있는 것(core 조건 충족) 먼저, 그 안에서 남은 수가 적은 순. core가 없어 못 켜는 것은 뒤로
    const prog = all.filter((x) => !x.on && x.n > 0).sort((a, b) => synCoreOk(b, p) - synCoreOk(a, p) || a.gap - b.gap || b.n / b.next - a.n / a.next);
    const none = all.filter((x) => !x.on && !x.n);
    const key = all.map((x) => x.n + ':' + x.lv).join() + '@' + Math.floor(performance.now() / 5000);
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    const sc = box.querySelector('.sabody'), top = sc ? sc.scrollTop : 0;
    const grp = (k, l) => (l.length ? `<h4>${esc(t(k))}<small>${l.length}</small></h4><div class="sagrid">${l.map((x) => `<button class="sar ${x.on ? 'on' : ''}" data-syn="${x.s.id}" type="button">${synCell(x, 'span')}<span class="san">${x.s.hidden ? '★ ' : ''}${esc(x.s.name)}</span></button>`).join('')}</div>` : '');
    box.innerHTML = `<div class="sabox" role="dialog" aria-label="${esc(t('synAll'))}"><div class="sahead"><b>${esc(t('synAll'))}</b><button class="saclose" data-synclose="1" type="button" aria-label="${esc(t('close'))}"><i class="ico close" aria-hidden="true"></i></button></div>`
      + `<div class="sabody">${grp('synGrpOn', on)}${grp('synGrpProg', prog)}${grp('synGrpNone', none)}</div></div>`;
    const nb = box.querySelector('.sabody'); if (nb && top) nb.scrollTop = top;
  }
  // 인연 목록(전황 서랍): 진행·등급·지금 단계 효과. 켜진 것 → 1명 남은 것 → 나머지
  function renderSyn() {
    const box = $('synlist'), p = g.me;
    const vis = synVisible(p);
    // 목록 글은 인연별 진행·단계·가진 장수가 바뀔 때만 다시 만든다(0.18초마다 58개 인연 설명문을 새로 짓던 것)
    const hk = I.lang + '|' + vis.map((x) => x.s.id + (x.on ? '+' : '-') + x.n + '/' + x.next + ':' + x.lv + ':' + x.g + ':' + x.s.units.map((id) => (g.has(p, id) ? 1 : 0)).join('')).join();
    if (box.dataset.hk !== hk) {
    box.dataset.hk = hk;
    const h = !vis.length ? `<div class="sub" style="padding:6px 10px">${t('synergyHint')}</div>` : vis.map((x) => {
      const s = x.s, tr = (s.tiers || [])[Math.max(0, x.lv - 1)], d = tr && I.synTierText ? I.synTierText(T, s, tr) : { lane: '', boss: '' };
      return `<div class="syn ${x.on ? 'on' : ''}" title="${esc(s.desc)}"><span class="cnt">${x.n}/${x.next}</span><b>${s.hidden ? '★ ' : ''}${esc(s.name)} <em class="gd" style="background:${GRADE_COL[x.g]}">${esc(gradeTxt(x.g))}</em> <u class="dt">${dotsOf(x)}</u></b>`
        + `<div class="us">${s.units.map((id) => `<span class="${g.has(p, id) ? 'h' : ''}">${esc(defOf[id].name)}</span>`).join(' · ')}</div>`
        + `<small style="grid-column:2">${x.on ? esc([d.lane, d.boss].filter(Boolean).join(' / ')) : esc(s.desc)}</small></div>`;
    }).join('');
    if (box.dataset.html !== h) { box.innerHTML = h; box.dataset.html = h; }
    }
    renderSynBar(vis);
    if (S.synAll) renderSynAll();
    // 이번 판 변형 규칙(악몽 +N)
    const mb = $('mutlist'), mt = $('mutt');
    if (g.muts && g.muts.length && !mb.dataset.done) {
      mb.dataset.done = '1'; mt.hidden = false; mt.textContent = I.t('mutHead', { n: g.mutLv });
      mb.innerHTML = `<div style="display:grid;gap:4px;padding:4px 6px 8px">${g.muts.map((m, i) => mutCard(m.id, i)).join('')}</div>`;
    }
  }
