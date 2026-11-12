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
    const hpLine = act ? `<div class="line">${I.t('curHp')} <strong>${fmt(act.hp)} / ${fmt(act.mhp)}</strong></div>` : '';
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
      if (!x.boss && cls.includes('now') && tm.startsWith(I.t('field'))) hudMid.push(`${t('midBoss')} ${x.name} ${tm}`);
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
  // ---- 맵 왼쪽 시너지 줄: 인연마다 육각 아이콘(대표 인물 얼굴)과 모은 수/필요 수. 완성되면 금색으로 켜진다. ----
  // 누르면(마우스는 올리면) 필요한 인물과 효과가 업적 설명과 같은 반투명 창으로 뜬다. 자리가 모자라면 '+N'(누르면 전황 서랍의 전체 목록).
  let synRep = null;
  // 대표 인물: 다른 인연에 가장 덜 나오는 인물(같은 얼굴이 여러 줄에 겹치지 않게)
  function synFace(s) {
    if (!synRep) {
      const cnt = {}; synRep = {};
      (T.synergies || []).forEach((x) => x.units.forEach((id) => { cnt[id] = (cnt[id] || 0) + 1; }));
      (T.synergies || []).forEach((x) => { synRep[x.id] = x.units.slice().sort((a, b) => cnt[a] - cnt[b])[0]; });
    }
    return defOf[synRep[s.id]];
  }
  function renderSynBar(vis) {
    const bar = $('synbar'), show = laneOn() && !viewedPeer() && !g.over && vis.length > 0;
    if (bar.hidden !== !show) bar.hidden = !show;
    if (!show) { if (S.synPop) showSyn(null); return; }
    // 세로로 들어가는 만큼만 보여 준다
    const vh = window.innerHeight / zoom, item = vh <= 430 ? 39 : vh >= 600 ? 57 : 45;
    let max = Math.max(3, Math.floor((vh - 14) / item));
    if (vis.length > max) max -= 1;
    const top = vis.slice(0, max), more = vis.length - top.length;
    // 얼굴 그림은 주소가 길어 매번 만들지 않는다(구성이 바뀌거나 5초마다 한 번만 다시 그린다 — 그림이 늦게 불러져도 따라온다)
    const key = top.map(({ s, n, on }) => s.id + n + (on ? '!' : '')).join() + '+' + more + '@' + Math.floor(performance.now() / 5000);
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = top.map(({ s, n, on }) => `<button class="sy ${on ? 'on' : ''}" data-syn="${s.id}" type="button" aria-label="${esc(s.name)}"><i><img alt="" src="${Art.portrait(synFace(s))}"></i><b>${n}/${s.units.length}</b></button>`).join('')
        + (more > 0 ? `<button class="sy more" data-act="drawer" data-arg="war" type="button"><i><span>+${more}</span></i></button>` : '');
    }
    const hud = $('hud'), left = hud.offsetLeft + hud.offsetWidth + 6;
    if (bar.dataset.left !== String(left)) { bar.dataset.left = left; bar.style.left = left + 'px'; }
  }
  function showSyn(id, el) {
    const pop = $('achpop'), s = id && (T.synergies || []).find((x) => x.id === id), p = g && g.me;
    if (!s || !el || !p) { if (S.synPop) pop.hidden = true; S.synPop = null; return; }
    const have = s.units.filter((u) => g.has(p, u)).length, on = !!(p.syn && p.syn[s.id]);
    const chips = s.units.map((u) => { const d = defOf[u]; return `<span class="ac ${g.has(p, u) ? 'have' : ''}" style="color:${(d.tier && tierColor(d.tier)) || '#f4ecd8'}">${esc(d.name)}</span>`; }).join('');
    pop.innerHTML = `<strong>${s.hidden ? '★ ' : ''}${esc(s.name)} <span style="font:400 12px 'Black Han Sans',sans-serif;color:${on ? '#ffd86a' : '#cfc3a8'}">${have}/${s.units.length}</span></strong><div class="chips">${chips}</div><div style="margin-top:5px;color:${on ? '#f4ecd8' : 'var(--dim)'}">${esc(s.desc)}</div>`;
    pop.hidden = false; S.synPop = id;
    const r = el.getBoundingClientRect();
    pop.style.left = Math.min(r.right / zoom + 8, window.innerWidth / zoom - pop.offsetWidth - 4) + 'px';
    pop.style.top = Math.max(4, Math.min(r.top / zoom, window.innerHeight / zoom - pop.offsetHeight - 4)) + 'px';
  }
  {
    const bar = $('synbar');
    // 터치: 누르면 뜨고, 다른 곳을 누르면 닫힌다(닫기는 10-input의 업적 창 처리와 같이 쓴다). 마우스: 올리면 뜨고 벗어나면 닫힌다.
    bar.addEventListener('click', (e) => { const b = e.target.closest('[data-syn]'); if (b) showSyn(b.dataset.syn, b); });
    bar.addEventListener('pointerover', (e) => { if (e.pointerType === 'touch') return; const b = e.target.closest('[data-syn]'); if (b) showSyn(b.dataset.syn, b); });
    bar.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') showSyn(null); });
  }
  // 인연 시너지 목록(전황 서랍): 모인 인물 수 / 필요 수, 켜지면 밝게
  function renderSyn() {
    const box = $('synlist'), p = g.me;
    const vis = (T.synergies || []).map((s) => ({ s, n: s.units.filter((id) => g.has(p, id)).length, on: !!(p.syn && p.syn[s.id]) }))
      .filter((x) => (x.s.hidden ? x.on : x.n > 0)).sort((a, b) => b.on - a.on || b.n / b.s.units.length - a.n / a.s.units.length);
    const h = !vis.length ? `<div class="sub" style="padding:6px 10px">${t('synergyHint')}</div>` : vis.map(({ s }) => {
      const have = s.units.filter((id) => g.has(p, id)), on = p.syn && p.syn[s.id];
      return `<div class="syn ${on ? 'on' : ''}" title="${esc(s.desc)}"><span class="cnt">${have.length}/${s.units.length}</span><b>${s.hidden ? '★ ' : ''}${esc(s.name)}</b><div class="us">${s.units.map((id) => `<span class="${g.has(p, id) ? 'h' : ''}">${esc(defOf[id].name)}</span>`).join(' · ')}</div><small style="grid-column:2">${esc(s.desc)}</small></div>`;
    }).join('');
    if (box.dataset.html !== h) { box.innerHTML = h; box.dataset.html = h; }
    renderSynBar(vis);
    // 이번 판 변형 규칙(악몽 +N)
    const mb = $('mutlist'), mt = $('mutt');
    if (g.muts && g.muts.length && !mb.dataset.done) {
      mb.dataset.done = '1'; mt.hidden = false; mt.textContent = I.t('mutHead', { n: g.mutLv });
      mb.innerHTML = `<div style="display:grid;gap:4px;padding:4px 6px 8px">${g.muts.map((m, i) => mutCard(m.id, i)).join('')}</div>`;
    }
  }
