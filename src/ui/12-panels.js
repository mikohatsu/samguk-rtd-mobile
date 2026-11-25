  // ---- 패널 ----
  let needs = true, lastDom = 0;
  const dirty = () => (needs = true);
  const toast = (text, tone) => {
    // 보스 처치 연출 중(S.toastHoldUntil, 16-hud bossWin)이면 미뤘다가 16-hud renderHud가 한꺼번에 내보낸다
    // 보스 처치 연출(S.kill) 중에도 모아 두었다가 끝나면 보인다
    if (performance.now() < (S.toastHoldUntil || 0) || S.kill) { (S.toastQ = S.toastQ || []).push([text, tone]); return; }
    const box = $('toasts');
    // 같은 알림이 연달아 오면 줄을 쌓지 않고 ×N으로 합친다(전선 포화로 라이프가 연속으로 깎일 때 화면을 덮던 문제)
    const prev = box.lastElementChild;
    if (prev && prev._text === text) {
      prev._n = (prev._n || 1) + 1; prev.textContent = `${text} ×${prev._n}`;
      clearTimeout(prev._tm); prev._tm = setTimeout(() => prev.remove(), 3600);
      return;
    }
    const d = document.createElement('div'); d.className = 'toast ' + (tone || ''); d.textContent = text; d._text = text;
    box.appendChild(d);
    d._tm = setTimeout(() => d.remove(), 3600);
    while (box.children.length > 4) box.firstChild.remove();
    return;
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => d.remove(), 3600);
  };
  function clock(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`; }
  function nextBoss() { return T.bosses.find((b) => b.round >= g.round && b.round <= g.diff.rounds); }
  function nextMid() { return T.midbosses.find((m) => m.round > g.round); }
  function recipeRow(id) {
    const st = g.recipeStatus(g.me, id), d = defOf[id];
    const chips = st.parts.map((x) => `<span class="chip ${x.have >= x.need ? 'have' : 'miss'}">${esc(defOf[x.id].name)} ${rankTag(defOf[x.id].tier)} ${Math.min(x.have, x.need)}/${x.need}</span>`).join('');
    const it = st.item ? `<span class="chip ${st.hasItem ? 'have' : 'miss'}">${esc(T.items.find((i) => i.id === st.item).name)}</span>` : '';
    // 잠긴 신화·불멸: 재료가 다 있어도 조합할 수 없으므로 버튼 대신 까닭(상점에서 해금)을 적는다
    // 2026-11-26 실기 소감: 칸 전체를 흑백으로 누르고 그 위에 쇠사슬 X(gfx/vs_chain 두 장을 엇갈려 돌림) + 자물쇠(gfx/ic_lock) + 「해금 필요」. 어디서 여는지는 칸 아래 한 줄
    if (g.isLocked && g.isLocked(id)) return `<div class="row rlk"><div><strong style="color:${tierColor(d.tier)}">${esc(d.name)}</strong> ${rankBadge(d.tier)}<div class="chips">${chips}${it}</div></div><div class="rlkx" aria-hidden="true"><i class="ch a"></i><i class="ch b"></i></div><span class="rlkb"><i class="ico lock" aria-hidden="true"></i><b>${I.t('needUnlock')}</b></span></div><small class="lockn">${I.t('lockedInShop')}</small>`;
    return `<div class="row ${st.ok ? 'ok' : ''}"><div><strong style="color:${tierColor(d.tier)}">${esc(d.name)}</strong> ${rankBadge(d.tier)}<div class="chips">${chips}${it}</div></div><button class="btn ${st.ok ? 'go' : ''}" data-act="craft" data-arg="${id}" type="button" ${st.ok ? '' : 'disabled'}>${I.t('combineBtn')}</button></div>`;
  }
  // 소리 크기 줄(판 안 설정 탭과 로비 설정 창이 같이 쓴다): − 값 ＋
  const volRow = (key) => { const v = Math.round(Snd.state[key] * 100); return `<div class="row"><div>${t(key)}</div><div class="volrow"><button class="toggle" data-act="vol" data-arg="${key}:-" type="button" aria-label="-" ${v <= 0 ? 'disabled' : ''}>−</button><b>${v}%</b><button class="toggle" data-act="vol" data-arg="${key}:+" type="button" aria-label="+" ${v >= 100 ? 'disabled' : ''}>＋</button></div></div>`; };
  const SKILL_TEXT = {
    line: (s) => `직선 ${s.len} 범위, 공격력 ${s.mult}배`, cone: (s) => `부채꼴 ${s.r} 범위, 공격력 ${s.mult}배`,
    circle: (s) => `지정 위치 반경 ${s.r}, 공격력 ${s.mult}배${s.stun ? `, 기절 ${s.stun}초` : ''}`,
    buff: (s) => `${s.dur}초간 공격력 +${Math.round(s.atk * 100)}%`, shield: (s) => `${s.dur}초간 무적`, heal: (s) => `아군 전체(다른 사령관 포함) 체력 ${Math.round(s.pct * 100)}% 회복${s.hot ? `, ${s.hotDur}초간 매초 ${Math.round(s.hot * 100)}% 더` : ''}`,
    rally: (s) => `${s.dur}초간 아군 전체 공격력 +${Math.round(s.atk * 100)}%`, taunt: (s) => `${s.dur}초간 보스를 끌어오고 받는 피해 감소`,
    weaken: (s) => `${s.dur}초간 보스가 받는 피해 +${Math.round(s.amp * 100)}%`,
    cover: (s) => `보스를 끌어오고 ${s.dur}초간 아군 전체(다른 사령관 포함) 받는 피해 -${Math.round(s.v * 100)}%`,
    pshield: (s) => `${s.dur}초간 아군 전체(다른 사령관 포함) 투사체를 막음`,
    hasteAll: (s) => `${s.dur}초간 아군 전체 공격 속도 +${Math.round(s.v * 100)}%`,
    roar: (s) => `${s.dur}초간 보스 공격력 -${Math.round(s.v * 100)}%`,
    delay: (s) => `보스의 다음 패턴을 ${s.v}초 늦춤`,
    reflect: (s) => `${s.dur}초간 보스를 끌어오고, 맞을 때마다 공격력 ${s.mult}배로 반격`,
    charm: (s) => `보스를 ${s.dur}초간 매혹해 멈추고 받는 피해 +${Math.round(s.amp * 100)}% (무력화 시전은 못 끊음)`,
  };
  if (I.skillText) Object.assign(SKILL_TEXT, I.skillText);
  // 도감: 줄을 누르면 능력치와 스킬, 조합식이 펼쳐진다
  function bookRow(d) {
    const open = S.book === d.id, f = T.factions[d.fac];
    // 잠긴 신화·불멸(2026-11-25 실기 소감): 자물쇠 글자 대신 상점과 같은 규칙 — 흑백 초상 + 이름 옆 짧은 「잠김」
    const lk = !!(g.isLocked && g.isLocked(d.id));
    const row = `<div class="row${lk ? ' lk' : ''}" data-act="book" data-arg="${d.id}"><img alt="" src="${Art.portrait(d)}"><div><span style="color:${f.color}">${esc(f.name)}</span> ${esc(d.name)}${lk ? ` <em class="lkt">${I.t('lockedTag')}</em>` : ''}${d.title ? `<small>${esc(d.title)}</small>` : ''}</div></div>`;
    if (!open) return row;
    const stats = d.tier ? `${I.t('atk')} ${fmt(g.baseAtk(g.me, d))} · ${I.t('hp')} ${fmt(g.rankOf[d.tier].hp)} · ${I.t('range')} ${g.range(d)} · ${I.t('interval')} ${I.t('sec', { n: g.attackTime(d).toFixed(2) })}` : I.t('hireCost', { c: T.currency, n: fmt(d.cost) });
    const pass = (d.p || []).map((x) => `<div><span class="tag">${t('passive')}</span>${esc(x.name)}: ${esc(x.desc)}</div>`).join('');
    const sk = (d.sk || []).map((s) => `<div><span class="tag">${t('active')}</span>${esc(s.n)}: ${SKILL_TEXT[s.k](s)}, ${I.t('cooldown', { n: s.cd })}</div>`).join('');
    const need = T.combineNeed[d.tier];
    const comb = need ? `<div>${I.t('combineNeed', { b: need, r: rankName(d.tier + 1) })}</div>` : '';
    return row + `<div class="bk"><div>${stats}</div>${pass}${sk}${comb}${T.recipes[d.id] ? recipeRow(d.id) : ''}</div>`;
  }
  // 선택권 창(S.ticket = 고르는 등급)은 모달이 아니다. 서랍이 닫히거나 다른 탭으로 가거나, 판 단계가 바뀌거나(보스전 시작 등),
  // 라인 화면이 아니거나, 그 등급 선택권이 다 떨어지면 닫는다. 닫아도 선택권은 그대로 남는다(다시 선택권 탭에서 연다).
  function ticketGuard() {
    if (S.ticket == null) return;
    if (g.over || !laneOn() || viewedPeer() || S.drawer !== 'ticket' || S.tab !== 'ticket' || g.phase !== S.ticketPh || !(g.me.tickets[S.ticket] > 0)) S.ticket = null;
  }
  // 선택권 창 바깥(서랍 탭·오른쪽 버튼·전장·조이스틱·메뉴 등)을 누르면 창을 닫고 그 누름은 그대로 제 일을 한다.
  // 창(#pane) 안과 첫 판 안내 말풍선(#tutbox, 선택권 탭 설명이 창 위에 뜬다)은 닫지 않는다.
  document.addEventListener('pointerdown', (e) => {
    if (S.ticket == null || (e.target.closest && e.target.closest('#pane, #tutbox'))) return;
    S.ticket = null; dirty();
  }, true);
  function renderPane() {
    if (g) ticketGuard();
    // 서랍이 닫혀 있으면 안 보이는 글자판을 만들지 않는다(서랍을 여는 행동이 dirty()를 불러 그때 한 번 그린다)
    if (!S.drawer) return;
    const p = g.me, tick = Object.values(p.tickets).reduce((a, b) => a + b, 0);
    const tabs = [['upgrade', t('upgrade')], ['sage', t('sage')], ['ticket', t('ticket')], ['book', t('book')], ['war', t('war')], ['set', t('settings')]];
    if (!S.tab) S.tab = 'upgrade';
    $('pane').dataset.tab = S.tab; // CSS가 탭별로 글꼴 등을 다르게 줄 수 있게(설정 탭은 기본 글꼴)
    const tb = $('tabs'), th = tabs.map(([k, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-arg="${k}" type="button">${n}${k === 'ticket' && tick ? `<span class="dot">${tick}</span>` : ''}</button>`).join('');
    if (tb.dataset.html !== th) { tb.innerHTML = th; tb.dataset.html = th; } // 같은 내용이면 버튼을 다시 만들지 않는다(누르는 도중 교체 방지)
    let h = '';
    if (S.tab === 'upgrade') {
      h = `<div class="h">${t('hold', { c: esc(T.currency), n: fmt(p.gold) })}</div>` + T.upgrades.map((u) => {
        const lv = p.upgrades[u.id] || 0, c = g.upgradeCost(p, u), mx = g.upMax(p, u), max = lv >= mx;
        return `<div class="row"><div>${esc(u.name)} <small>${lv}/${mx} · ${t('atkUp', { n: lv * 20 })}</small></div><button class="btn" data-act="up" data-arg="${u.id}" type="button" ${max || p.gold < c ? 'disabled' : ''}>${max ? t('max') : fmt(c)}</button></div>`;
      }).join('');
    } else if (S.tab === 'sage') {
      const hired = g.sagesOf(p).length, full = hired >= g.sageMax();
      h = `<div class="h">${t('hold', { c: esc(T.currency), n: fmt(p.gold) })}</div>`;
      h += `<div class="h">${t('sageHead')} <small>${t('sageHint', { a: hired, b: g.sageMax() })}</small></div>` + T.units.filter((d) => d.tier === 0).map((d) => {
        const has = g.has(p, d.id);
        const btn = has ? `<button class="btn warn" data-act="dismiss" data-arg="${d.id}" type="button">${t('dismiss')}</button>`
          : `<button class="btn" data-act="hire" data-arg="${d.id}" type="button" ${full || p.gold < d.cost ? 'disabled' : ''}>${full ? t('full') : fmt(d.cost)}</button>`;
        return `<div class="row sagerow ${has ? 'ok' : ''}"><img class="spor" alt="" src="${Art.portrait(d)}"><div>${esc(d.name)} <span class="bt">${esc(d.build || '')}</span> <small>${esc(d.p.map((x) => x.desc).join(' / '))}</small></div>${btn}</div>`;
      }).join('');
    } else if (S.tab === 'ticket' && S.ticket != null) {
      // 선택권으로 고르기: 전투를 가리지 않도록 서랍 안에서 고른다
      const ids = g.tierIds(S.ticket), left = p.tickets[S.ticket] || 0;
      h = `<div class="h">${I.t('ticketN', { r: rankName(S.ticket) })} ${I.t('nSheets', { n: left })}</div>` + ids.map((id) => `<div class="row"><img class="tpor" alt="" src="${Art.portrait(defOf[id])}"><div>${esc(defOf[id].name)} <small>${I.t('owned', { n: g.ownedOf(g.me, id).length })}</small></div><button class="btn" data-act="ticketPick" data-arg="${id}" type="button">${I.t('pick')}</button></div>`).join('') + `<button class="btn" data-act="ticketClose" type="button">${I.t('close')}</button>`;
    } else if (S.tab === 'ticket') {
      const ts = Object.keys(p.tickets).filter((t) => p.tickets[t] > 0);
      h = ts.map((t) => `<div class="row"><div>${I.t('ticketN', { r: rankName(+t) })} <small>${I.t('nSheets', { n: p.tickets[t] })}</small></div><button class="btn go" data-act="ticket" data-arg="${t}" type="button">${I.t('use')}</button></div>`).join('');
      if (!h) h = `<div class="row"><div>${t('noTicket')} <small>${t('noTicketHint')}</small></div></div>`;
    } else if (S.tab === 'set') {
      const tg = (k, l) => `<div class="row"><div>${l}</div><button class="toggle ${p.auto[k] ? 'on' : ''}" data-act="auto" data-arg="${k}" type="button">${I.t(p.auto[k] ? 'onOff' : 'offOff')}</button></div>`;
      // 정렬 위치: 왼쪽 벽 1, 아래쪽 벽 3, 오른쪽 벽 1 중에서 고른다(겹치면 서로 맞바꿈)
      const ZN = [['L', I.t('zL')], ['B1', I.t('zB1')], ['B2', I.t('zB2')], ['B3', I.t('zB3')], ['R', I.t('zR')]];
      const zones = (k) => `<div class="zones">${ZN.map(([z, l]) => `<button class="zb ${p.zones[k] === z ? 'on' : ''}" data-act="zone" data-arg="${k}:${z}" type="button">${l}</button>`).join('')}</div>`;
      const az = (k, l) => tg(k, l) + `<div class="row zrow"><div><small>${I.t('sortPos')}</small></div>${zones(k)}</div>`;
      const ql = [['high', t('high')], ['mid', t('mid')], ['low', t('low')]];
      // 판 도중 설정창(2026-11-25 정리): 언어·튜토리얼·크레딧·버전은 로비 설정에만 둔다. 화질과 「로비로 돌아가기」는 창 맨 아래.
      h = `<div class="h">${t('autoSection')}</div>` + az('t1', I.t('autoT1')) + az('t2', I.t('autoT2')) + az('t3', I.t('autoT3')) + az('t45', I.t('autoT45')) + tg('sell', I.t('autoSell'))
        + `<div class="row"><div>${t('keepSyn')} <small>${t('keepSynHint')}</small></div><button class="toggle ${g.keepSyn ? 'on' : ''}" data-act="keepSyn" type="button">${I.t(g.keepSyn ? 'onOff' : 'offOff')}</button></div>`;
      // 도움말: 인연 규칙 두 줄
      h += `<div class="h">${t('synHelpH')}</div><div class="row"><div><small>${esc(I.t('synHelp1', { n: g.synMaxPerCarry || 5 }))}</small></div></div><div class="row"><div><small>${esc(t('synHelp2'))}</small></div></div>`;
      h += `<div class="h">${t('sound')}</div>` + volRow('sfx') + volRow('bgm');
      h += `<div class="h">${t('gfx')}</div><div class="row"><div>${t('gfxRow')} <small>${t('gfxHint')}</small></div><div class="zones">${ql.map(([k, l]) => `<button class="zb ${Q.level === k ? 'on' : ''}" data-act="gfx" data-arg="${k}" type="button">${l}</button>`).join('')}</div></div>`;
      h += `<div class="row"><div>${t('fps30')} <small>${t('fps30Hint')}</small></div><button class="toggle ${Q.fps30 ? 'on' : ''}" data-act="fps30" type="button">${Q.fps30 ? t('on') : t('off')}</button></div>`;
      h += `<div class="row"><div>${t('perfShow')} <small>${t('perfShowHint')}</small></div><button class="toggle ${Q.perf ? 'on' : ''}" data-act="perf" type="button">${Q.perf ? t('on') : t('off')}</button></div>`;
      // 판 도중 나가기(맨 아래): 한 번 누르면 '한 번 더'로 바뀌고 3초 안에 다시 눌러야 나간다(11-actions의 quit)
      const qh = S.saveOn ? 'quitHintSave' : lifeOffline() ? 'quitHintEnd' : spect() ? 'quitHintElim' : 'quitHintRoom';
      h += `<div class="h">${I.t('quitGame')}</div><div class="row"><div><small>${I.t(qh)}</small></div><button class="toggle ${S.quitArm ? 'on' : ''}" data-act="quit" type="button">${I.t(S.quitArm ? 'quitAgain' : 'quitBtn')}</button></div>`;
    } else if (S.tab === 'war') {
      h = '';
    } else {
      h = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((t) => `<div class="h" style="color:${tierColor(t)}">${rankName(t)}</div>` + T.units.filter((d) => d.tier === t).map(bookRow).join('')).join('');
    }
    const pane = $('pane'), top = pane.scrollTop;
    if (pane.dataset.html !== h) { pane.innerHTML = h; pane.dataset.html = h; pane.scrollTop = top; }
    let a = '';
    if (net) a = net.roster().map((r) => `<div><span>${esc(r.state.name || '')}${r.me ? I.t('meTag') : ''}</span><span>${I.t('alliesLine', { u: r.state.units | 0, e: r.state.enemies | 0 })}</span></div>`).join('');
    const al = $('allies');
    if (al.dataset.html !== a) { al.innerHTML = a; al.dataset.html = a; al.hidden = !a; }
  }
  // 보스전 역할 표시(7성 이상)
  const roleBadge = (d) => (d.role ? `<span class="role" style="color:${T.roles[d.role].color};border-color:${T.roles[d.role].color}">${esc(T.roles[d.role].name)}</span>` : '');
  // atk를 주면 다른 사령관 유닛: 그 사람 기준 공격력을 쓰고 내 강화 단계는 보이지 않는다
  // 공격력·공격 간격이 무엇 때문에 바뀌었는지: [{ n: 이름, v: 비율 }] (강화·시너지·명사/패시브·오라·변형 규칙)
  function atkSources(u) {
    const d = u.def, p = g.players[u.owner], out = [];
    const lv = g.upgradeLevel(p, d); if (lv) out.push({ n: I.t('upShort', { n: lv }), v: (g.diff.upPct || 0.2) * lv, mul: true });
    const seen = {};
    g.units.forEach((s) => { if (s.owner === p.idx) (s.def.p || []).forEach((x) => { if (x.k === 'globalAtk' && (x.fac === 'all' || x.fac === d.fac) && !seen[x.name]) { seen[x.name] = 1; out.push({ n: s.def.name, v: x.pct }); } }); });
    if (u.aura) { const src = g.units.find((s) => s.owner === u.owner && (s.def.p || []).some((x) => x.k === 'aura' && x.pct === u.aura && (!x.fac || x.fac === d.fac) && Math.hypot(u.x - s.x, u.y - s.y) <= x.r)); out.push({ n: src ? src.def.name : I.t('aura'), v: u.aura }); }
    // 인연 라인 공격력(단계별 tier.lane: 구성원·only·per·진영 전체). 보스전 효과는 출전 장수에게 따로 걸린다
    Object.values((p && p.syn) || {}).forEach((x) => { const e = (x.tier && x.tier.lane) || {}; let v = 0; if ((e.only || x.s.units).includes(d.id)) v += e.atk || 0; if (e.per && e.per[d.id]) v += e.per[d.id].atk || 0; if (e.facAtk && d.fac === e.facAtk.fac) v += e.facAtk.pct; if (v) out.push({ n: x.s.name, v }); });
    const m = (g.mut.atk || 0) + g.mutAtk(); if (m) out.push({ n: I.t('mutShort'), v: m });
    return out;
  }
  function hasteSources(u) {
    const d = u.def, p = g.players[u.owner], out = [];
    let best = null; g.units.forEach((s) => { if (s.owner === p.idx) (s.def.p || []).forEach((x) => { if (x.k === 'tierHaste' && d.tier >= x.tier && (!best || x.pct > best.v)) best = { n: s.def.name, v: x.pct }; }); });
    if (best && best.v) out.push(best);
    const sh = g.synFor(u.owner, d).haste; if (sh) out.push({ n: t('synTag'), v: sh }); // 인연 라인 공격 속도
    return out;
  }
  const pctTxt = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  // 오른 값은 연한 빨강 굵게, 내린 값은 파랑 굵게
  const buffCls = (k) => (k > 1.0001 ? 'bup' : k < 0.9999 ? 'bdn' : '');
  function unitInfo(u, atk) {
    const d = u.def, f = T.factions[d.fac], remote = atk != null, lv = remote ? 0 : g.upgradeLevel(g.me, d);
    const spd = remote ? 1 : 1 + g.hasteOf(g.me.idx, d) + g.synFor(g.me.idx, d).haste;
    let stats = '';
    if (d.tier) {
      const base = g.rankOf[d.tier].atk * g.attackTime(d), now = remote ? atk : g.unitAtk(u);
      const iv = g.attackTime(d) / spd;
      const src = remote ? [] : atkSources(u), hs = remote ? [] : hasteSources(u);
      const det = !remote && S.statDet ? `<div class="sdet"><span>${I.t('baseAtk')} ${fmt(base)}</span>${src.map((x) => `<span class="${x.v >= 0 ? 'bup' : 'bdn'}">${esc(x.n)} ${pctTxt(x.v)}</span>`).join('')}${hs.map((x) => `<span class="bup">${esc(x.n)} ${I.t('speedShort')} ${pctTxt(x.v)}</span>`).join('')}${src.length || hs.length ? '' : `<span>${I.t('noBuff')}</span>`}</div>` : '';
      stats = `<div class="line">${I.t('atk')} <strong class="${remote ? '' : buffCls(now / base)}">${fmt(now)}</strong> · ${I.t('hp')} ${fmt(g.rankOf[d.tier].hp)} · ${I.t('range')} ${remote || g.inFight(u) ? g.range(d) : Math.round(g.rangeOf(u))} · ${I.t('interval')} <span class="${buffCls(g.attackTime(d) / iv)}">${I.t('sec', { n: iv.toFixed(2) })}</span>${remote ? '' : ` <button class="sdbtn" data-act="statDet" type="button">${I.t(S.statDet ? 'detClose' : 'detOpen')}</button>`}</div>${det}`;
    }
    const pass = (d.p || []).map((x) => `<div class="line" title="${esc(x.desc)}"><span class="tag">${t('passive')}</span>${esc(x.name)}: ${esc(x.desc)}</div>`).join('')
      + (() => { const sb = remote || g.inFight(u) ? [] : synBossFor(d); return sb.length ? `<div class="line"><span class="tag">${esc(t('synBossLine'))}</span>${synBadges(sb)}</div>` : ''; })();
    const skills = (d.sk || []).map((s) => `<div class="line"><span class="tag">${t('active')}</span>${esc(s.n)} (${I.t('cooldown', { n: s.cd })})</div>`).join('');
    const role = d.role ? `<div class="line">${roleBadge(d)} <small>${esc(T.roles[d.role].desc)}</small></div>` : '';
    return `<img class="por" alt="" src="${Art.portrait(d)}">${unitHead(d, lv, remote)}<div class="sub line">${d.tier ? '' : I.t('special') + ' · '}<span style="color:${f.color}">${esc(f.name)}</span>${d.title ? ' · ' + esc(d.title) : ''}</div><div style="clear:both"></div>${role}${stats}${pass}${skills}`;
  }
  // 이름 머리: 전설·신화·불멸은 그 등급 글씨를 이름 앞에, 1~7성은 이름 뒤에 별, 강화는 +N
  function unitHead(d, lv, remote) {
    const rk = d.tier >= 8 ? `<span class="rkf rk${d.tier}">${rankName(d.tier)}</span>` : '';
    const st = d.tier >= 1 && d.tier <= 7 ? `<span class="stars" style="color:${tierColor(d.tier)}">${'★'.repeat(d.tier)}</span>` : '';
    const up = !remote && lv > 0 ? `<span class="plus">+${lv}</span>` : '';
    return `<h3 class="uh">${rk}<span style="color:${tierColor(d.tier)}">${esc(d.name)}</span>${up}${st}</h3>`;
  }
  // 조합식 전용 칸. 스크롤 없이 한 줄씩 보여주고 완성에 가까운 순서로 정렬한다.
  function recipeLine(id) {
    const st = g.recipeStatus(g.me, id), d = defOf[id];
    const parts = st.parts.map((x) => { const n = `${defOf[x.id].name} ${rankTag(defOf[x.id].tier)}` + (x.need > 1 ? ' ×' + x.need : ''); return x.have >= x.need ? `<b>${esc(n)}</b>` : esc(n); });
    if (st.item) { const n = T.items.find((i) => i.id === st.item).name; parts.push(st.hasItem ? `<b>${esc(n)}</b>` : esc(n)); }
    // 재료 하나는 줄이 바뀌어도 쪼개지지 않게 span.rpi로 묶는다. 가운뎃점은 뒤 재료 앞에 붙인다(줄 끝에 매달리지 않게)
    return `<div class="rc"><span class="rn">${esc(d.name)}</span>${rankBadge(d.tier)}<span class="rp">${parts.map((x, i) => `<span class="rpi">${i ? '· ' : ''}${x}</span>`).join(' ')}</span><button class="btn ${st.ok ? 'go' : ''}" data-act="craft" data-arg="${id}" type="button" ${st.ok ? '' : 'disabled'}>${I.t('combineBtn')}</button></div>`;
  }
  function unitRecipes(u) {
    const d = u.def, need = T.combineNeed[d.tier], lines = [];
    if (need) {
      const have = g.ownedOf(g.me, d.id).length;
      lines.push(`<div class="rc"><span class="rp">${I.t('combineInto', { a: Math.min(have, need), b: need, r: rankName(d.tier + 1) })}</span><button class="btn ${have >= need ? 'go' : ''}" data-act="combine" type="button" ${have >= need ? '' : 'disabled'}>${I.t('combineBtn')}${S.coarse ? '' : ' R'}</button></div>`);
    }
    const list = recipesUsing(d).map((x) => x.id), max = need ? 5 : 6; // 자기 자신의 조합식은 재료로 쓰이는 곳이 아니므로 뺀다
    lines.push(...list.slice(0, max).map(recipeLine));
    if (list.length > max) lines.push(`<div class="sub line">${I.t('moreInBook', { n: list.length - max })}</div>`);
    if (!list.length && !need) lines.push(`<div class="sub line">${t('noRecipe')}</div>`);
    return lines.join('');
  }
  // ---- 선택 정보 바(2026-11-23 안 A): 위 [초상(등급 틀) | 가운데 4줄 | 큰 행동 1개], 아래 [가장 가까운 조합식 1줄 | 상세]. ----
  // 가운데 4줄: ① 등급 글자·이름·강화·진영·역할 ② 핵심 수치 3개(버프는 색+화살표) ③ 이 유닛이 속한 인연 칩(n/m, 누르면 인연 창) ④ 스킬·패시브 이름 알약(누르면 설명 고정).
  // 나머지(조합식 전체·인연 단계·해산·능력치 출처·기술 전문)는 바 위에 뜨는 상세 카드(#ucard, unitCard)에서 우선순위 순으로 본다.
  // atk를 주면 다른 사령관 유닛(읽기 전용): 행동·인연·강화 단계는 보이지 않는다.
  // 이 유닛이 재료로 들어가는 조합식(잠긴 장수 것은 뺀다)을 완성에 가까운 순서로: 부족한 재료 수 m(×2면 2로 셈, 아이템이 없으면 +1)이 적은 것부터,
  // 같으면 높은 등급, 그다음 채운 재료가 많은 것(2026-11-26 실기 소감: 지금 가진 유닛과 관련 있는 조합식이 먼저 나오게)
  const recipeMiss = (id) => { const st = g.recipeStatus(g.me, id); return { m: st.parts.reduce((n, x) => n + Math.max(0, x.need - x.have), 0) + (st.item && !st.hasItem ? 1 : 0), h: st.parts.reduce((n, x) => n + Math.min(x.have, x.need), 0) }; };
  const recipesUsing = (d) => Object.keys(T.recipes).filter((id) => g.recipeOf(id).parts.includes(d.id) && !(g.isLocked && g.isLocked(id)))
    .map((id) => Object.assign({ id, t: defOf[id].tier }, recipeMiss(id))).sort((a, b) => a.m - b.m || b.t - a.t || b.h - a.h);
  // 이 유닛이 속한 인연(숨은 인연은 켜졌을 때만): 켜진 것(등급 높은 순) → 진행 많은 순
  function unitSyns(d) {
    const p = g.me; if (!p || !d.tier) return [];
    return (T.synergies || []).filter((s) => s.units.includes(d.id)).map((s) => synProg(s, p)).filter((x) => !x.s.hidden || x.on)
      .sort((a, b) => b.on - a.on || (b.on ? b.g - a.g : 0) || b.n / b.next - a.n / a.next);
  }
  const synChip = (x) => `<button class="usy ${x.on ? 'on' : ''}" data-syn="${x.s.id}" type="button"><b style="background:${GRADE_COL[x.g]}"></b>${x.s.hidden ? '★' : ''}${esc(x.s.name)}<em>${x.n}/${x.next}</em></button>`;
  const skillPill = (s) => `<button class="pill sk" type="button" ${tipAttr(s.n, t('active'), skillDesc(s))}>${icon(SKILL_ICON[s.k], s.fx)}<span>${esc(s.n)}</span><em>${esc(I.t('sec', { n: s.cd }))}</em></button>`;
  const passivePill = (x) => `<button class="pill ps" type="button" ${tipAttr(x.name, t('passive'), x.desc)}>${icon(PASSIVE_ICON[x.k], '#e6c578')}<span>${esc(x.name)}</span></button>`;
  // 등급 글자(전설·신화·불멸은 이름 앞 글자, 1~7성은 별) + 이름 + 강화 + 진영 + 역할. 등급은 색과 글자 둘 다로 보인다(색약 대비)
  function unitLine1(d, lv, remote) {
    const f = T.factions[d.fac];
    const rk = d.tier >= 8 ? `<span class="urk rk${d.tier}">${esc(rankName(d.tier))}</span>` : '';
    const st = d.tier >= 1 && d.tier <= 7 ? `<span class="stars" style="color:${tierColor(d.tier)}">${'★'.repeat(d.tier)}</span>` : '';
    const up = !remote && lv > 0 ? `<span class="plus">+${lv}</span>` : '';
    return `<div class="ul1">${rk}<b class="unm" style="color:${tierColor(d.tier) || '#f4ecd8'}">${esc(d.name)}</b>${up}${st}<span class="ufac" style="color:${f.color}">${d.tier ? '' : esc(I.t('special')) + ' · '}${esc(f.name)}</span>${roleBadge(d)}</div>`;
  }
  // 공격력·공격 간격·사거리(그리고 full이면 체력). 버프로 오른 값은 빨강+↑, 내린 값은 파랑+↓
  function unitStatVals(u, atk) {
    const d = u.def, remote = atk != null;
    const spd = remote ? 1 : 1 + g.hasteOf(g.me.idx, d) + g.synFor(g.me.idx, d).haste;
    const base = g.rankOf[d.tier].atk * g.attackTime(d), now = remote ? atk : g.unitAtk(u), iv = g.attackTime(d) / spd;
    const ac = remote ? '' : buffCls(now / base), ic = buffCls(g.attackTime(d) / iv), ar = (c) => (c === 'bup' ? '↑' : c === 'bdn' ? '↓' : '');
    return { base, atk: `<b class="${ac}">${fmt(now)}${ar(ac)}</b>`, iv: `<b class="${ic}">${I.t('sec', { n: iv.toFixed(2) })}${ar(ic)}</b>`, rg: `<b>${remote || g.inFight(u) ? g.range(d) : Math.round(g.rangeOf(u))}</b>` };
  }
  function unitBar(u, atk) {
    const d = u.def, remote = atk != null, lv = remote ? 0 : g.upgradeLevel(g.me, d);
    let h = unitLine1(d, lv, remote);
    if (d.tier) { const v = unitStatVals(u, atk); h += `<div class="ul2"><span>${I.t('atk')} ${v.atk}</span><span>${I.t('interval')} ${v.iv}</span><span>${I.t('range')} ${v.rg}</span></div>`; }
    const sy = remote ? [] : unitSyns(d);
    if (sy.length) h += `<div class="uchips">${sy.map(synChip).join('')}</div>`;
    const pills = (d.sk || []).map(skillPill).concat((d.p || []).map(passivePill));
    if (pills.length) h += `<div class="upills">${pills.join('')}</div>`;
    return `<button class="upor t${d.tier}" data-act="ucard" type="button" style="--gc:${tierColor(d.tier) || '#9a8e78'}" aria-label="${esc(I.t('detOpen'))}"><img alt="" src="${Art.portrait(d)}"></button><div class="umid">${h}</div>`;
  }
  // 1성 해산으로 받을 금화 범위(engine disbandValue와 같은 계산: R.disbandGold × 난이도 sellGold)
  function sellRange() {
    const [a, b] = g.R.disbandGold, k = g.diff.sellGold || 1, f = (v) => (k === 1 ? v : Math.max(1, Math.round(v * k))), x = f(a), y = f(b);
    return x === y ? `${x}` : `${x}~${y}`;
  }
  // 해산은 두 번 눌러야 한다(11-actions sell: 처음 누르면 S.sellArm, 3초 안에 한 번 더)
  const sellBtn = (u, big) => {
    const arm = S.sellArm === u.id, lab = esc(arm ? I.t('sellAgain') : t('disband')), gold = `<i class="ico coin" aria-hidden="true"></i>+${sellRange()}`;
    return big ? `<button class="ubig sell ${arm ? 'arm' : ''}" data-act="sell" type="button"><b>${lab}</b><small>${gold}</small></button>`
      : `<button class="btn warn usellb ${arm ? 'arm' : ''}" data-act="sell" type="button">${lab} <small>${gold}</small></button>`;
  };
  // 오른쪽 큰 행동 1개: 같은 유닛 합성이 되면 合成, 아니면 1성은 해산, 그 밖에는 합성 진행(누를 수 없음). 불멸·특수는 없음
  function unitPrimary(u) {
    const d = u.def, need = T.combineNeed[d.tier], have = need ? g.ownedOf(g.me, d.id).length : 0;
    const cap = need ? `${Math.min(have, need)}/${need} → ${esc(rankTag(d.tier + 1))}` : '';
    if (need && have >= need) return { k: 'combine', html: `<button class="ubig go" data-act="combine" type="button"><b>${I.t('combineBtn')}${S.coarse ? '' : ' R'}</b><small>${cap}</small></button>` };
    if (d.tier === 1 && !g.inFight(u)) return { k: 'sell', html: sellBtn(u, true) };
    if (need) return { k: 'prog', html: `<button class="ubig" data-act="combine" type="button" disabled><b>${I.t('combineBtn')}</b><small>${cap}</small></button>` };
    return { k: '', html: '' };
  }
  // 아래 줄: 완성에 가장 가까운 조합식 1줄(같은 유닛 합성 진행이 오른쪽 버튼에 안 보일 때는 그것도 후보) + 상세 카드 버튼
  function unitNear(u, prim) {
    const d = u.def, need = T.combineNeed[d.tier], used = recipesUsing(d);
    const self = need && prim.k === 'sell' ? Math.max(0, need - g.ownedOf(g.me, d.id).length) : -1; // 같은 유닛 합성까지 부족한 수
    let line;
    if (self >= 0 && (!used.length || self < used[0].m)) line = `<div class="rc"><span class="rp">${I.t('combineInto', { a: Math.min(g.ownedOf(g.me, d.id).length, need), b: need, r: rankName(d.tier + 1) })}</span></div>`;
    else if (used.length) line = recipeLine(used[0].id);
    else line = `<div class="rc none"><span class="rp">${t('noRecipeS')}</span></div>`;
    return line + ucardBtn();
  }
  const ucardBtn = () => `<button class="umore ${S.ucard ? 'on' : ''}" data-act="ucard" type="button" aria-expanded="${S.ucard ? 'true' : 'false'}">${I.t(S.ucard ? 'detClose' : 'detOpen')} ${S.ucard ? '▾' : '▴'}</button>`;
  // 상세 카드: 위에서 아래로 우선순위(① 합성·조합식 전체 ② 인연·해산 ③ 보스전 역할·인연 ④ 능력치와 버프 출처 ⑤ 스킬·패시브 전문)
  function unitCard(u, atk) {
    const d = u.def, remote = atk != null, lv = remote ? 0 : g.upgradeLevel(g.me, d);
    const sec = (k, body, cls) => (body ? `<section class="${cls || ''}"><h4>${esc(k)}</h4>${body}</section>` : '');
    let h = `<div class="uch">${unitLine1(d, lv, remote)}${d.title ? `<div class="ucs">${esc(d.title)}</div>` : ''}</div>`;
    if (!remote) {
      const need = T.combineNeed[d.tier], used = recipesUsing(d);
      let rc = '';
      if (need) { const have = g.ownedOf(g.me, d.id).length; rc += `<div class="rc"><span class="rp">${I.t('combineInto', { a: Math.min(have, need), b: need, r: rankName(d.tier + 1) })}</span><button class="btn ${have >= need ? 'go' : ''}" data-act="combine" type="button" ${have >= need ? '' : 'disabled'}>${I.t('combineBtn')}</button></div>`; }
      rc += used.map((x) => recipeLine(x.id)).join('');
      h += sec(t('cardRecipe'), rc); // 관련 조합식이 없으면(불멸 등) 칸째 뺀다 — 바 아래 줄이 이미 '관련 조합식 없음'을 보인다
      const sy = unitSyns(d);
      h += sec(t('synTag'), sy.length ? `<div class="usyl">${sy.map(synChip).join('')}</div>` : '');
      if (d.tier === 1 && !g.inFight(u)) h += `<section class="usell"><span>${esc(t('disbandDesc'))}</span>${sellBtn(u, false)}</section>`;
    }
    const sb = remote || !d.tier || g.inFight(u) ? [] : synBossFor(d);
    if (d.role || sb.length) h += `<section>${d.role ? `<div>${roleBadge(d)} <small class="dim">${esc(T.roles[d.role].desc)}</small></div>` : ''}${sb.length ? `<div class="ubs"><small class="dim">${esc(t('synBossLine'))}</small>${synBadges(sb)}</div>` : ''}</section>`;
    if (d.tier) {
      const v = unitStatVals(u, atk), src = remote ? [] : atkSources(u), hs = remote ? [] : hasteSources(u);
      const det = remote ? '' : `<div class="sdet"><span>${I.t('baseAtk')} ${fmt(v.base)}</span>${src.map((x) => `<span class="${x.v >= 0 ? 'bup' : 'bdn'}">${esc(x.n)} ${pctTxt(x.v)}</span>`).join('')}${hs.map((x) => `<span class="bup">${esc(x.n)} ${I.t('speedShort')} ${pctTxt(x.v)}</span>`).join('')}${src.length || hs.length ? '' : `<span>${I.t('noBuff')}</span>`}</div>`;
      h += sec(t('cardStats'), `<div class="ust"><span>${I.t('atk')} ${v.atk}</span><span>${I.t('hp')} <b>${fmt(g.rankOf[d.tier].hp)}</b></span><span>${I.t('interval')} ${v.iv}</span><span>${I.t('range')} ${v.rg}</span></div>${det}`);
    }
    const sk = (d.sk || []).map((s) => `<div class="usk">${icon(SKILL_ICON[s.k], s.fx)}<div><b>${esc(s.n)}</b><small>${esc(t('active'))} · ${esc(I.t('cooldown', { n: s.cd }))}</small><p>${esc((SKILL_TEXT[s.k] || (() => ''))(s))}</p></div></div>`).join('')
      + (d.p || []).map((x) => `<div class="usk ps">${icon(PASSIVE_ICON[x.k], '#e6c578')}<div><b>${esc(x.name)}</b><small>${esc(t('passive'))}</small><p>${esc(x.desc)}</p></div></div>`).join('');
    h += sec(t('cardSkills'), sk);
    return h;
  }
  // 명령 패널은 스타크래프트처럼 선택한 대상의 것만 보여준다. 칸은 아이콘이고, 마우스를 올리면 설명이 뜬다.
  const ICON = {
    move: 'M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
    amove: 'M5 19 17 7M13 5l6-1-1 6M7 13l4 4M4 20l3-3',
    focus: 'M12 2v5M12 17v5M2 12h5M17 12h5M12 5a7 7 0 1 0 0.01 0M12 10a2 2 0 1 0 0.01 0',
    stop: 'M6 6h12v12H6z',
    sell: 'M4 7a8 3 0 1 0 16 0a8 3 0 1 0-16 0M4 7v5a8 3 0 0 0 16 0V7M4 12v5a8 3 0 0 0 16 0v-5',
    dash: 'M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7',
    heal: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    use: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
    crit: 'M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z',
    splash: 'M12 9a3 3 0 1 0 .01 0M12 5a7 7 0 1 0 .01 0M12 1.5a10.5 10.5 0 1 0 .01 0',
    burn: 'M12 2c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 2-8 1 1 2 3 2 5 1-2 2-5 2-8z',
    slow: 'M12 2v20M3.5 7l17 10M20.5 7l-17 10M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5',
    stun: 'M12 12a2 2 0 1 1 4 0a4 4 0 1 1-8 0a6 6 0 1 1 12 0a8 8 0 1 1-16 0',
    bossPct: 'M3 18h18L19 7l-4.5 4.5L12 5l-2.5 6.5L5 7zM3 21h18',
    pierce: 'M2 12h17M15 7l5 5-5 5M9 5v14',
    multi: 'M3 12h7l9-7M10 12h9M10 12l9 7',
    everyN: 'M13 2 4 14h7l-1 8 9-12h-7z',
    aura: 'M12 4a8 8 0 1 0 .01 0M12 9a3 3 0 1 0 .01 0',
    banner: 'M5 22V2M5 3h13l-3.5 4.5L18 12H5',
    hpPct: 'M12 21s-8.5-5.2-8.5-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.8C20.5 15.8 12 21 12 21z',
    guard: 'M12 2l8 3v6c0 5.2-3.6 9-8 11-4.4-2-8-5.8-8-11V5z',
    taunt: 'M3 10v4h4l8 5V5l-8 5zM18 8.5a5 5 0 0 1 0 7M20.5 6a8.5 8.5 0 0 1 0 12',
    regen: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8',
    expose: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 .01 0',
    breaker: 'M13 3l8 8-3 3-8-8zM10 9l-7 7 3 3 7-7M14 17l3 4M17 14l4 3',
    cdr: 'M6 2h12M6 22h12M7 2c0 6 10 5 10 10S7 16 7 22M17 2c0 6-10 5-10 10s10 4 10 10',
    skillPct: 'M6 3h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM6 17a2 2 0 0 0 2 2M10 8h6M10 12h6',
    haste: 'M4 6l6 6-6 6M12 6l6 6-6 6',
    coin: 'M12 3a9 9 0 1 0 .01 0M9 9h6M9 9v6h6M12 6v12',
    tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5a1 1 0 1 0 .01 0',
    upMax: 'M12 21V8M6 14l6-6 6 6M5 3h14',
    plus1: 'M12 3a9 9 0 1 0 .01 0M12 8v8M8 12h8',
    line: 'M3 21 19 5M14 4h6v6M3 21l3-1-2-2z',
    cone: 'M12 22 3.5 7.5a10 10 0 0 1 17 0z',
    circle: 'M12 8a4 4 0 1 0 .01 0M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8 7 17M17 7l2.8-2.8',
    buff: 'M12 21V5M5 12l7-7 7 7M5 21h14',
    weaken: 'M12 2l8 3v6c0 5.2-3.6 9-8 11-4.4-2-8-5.8-8-11V5zM12 6l-2 5 3 2-2 5',
    charm: 'M12 21s-8.5-5.2-8.5-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.8C20.5 15.8 12 21 12 21zM9 11c1 1.5 5 1.5 6 0',
    dot: 'M12 5l7 7-7 7-7-7z',
    close: 'M6 6l12 12M18 6L6 18',
  };
  const PASSIVE_ICON = { crit: 'crit', splash: 'splash', burn: 'burn', slow: 'slow', fieldSlow: 'slow', stun: 'stun', bossPct: 'bossPct', pierce: 'pierce', multi: 'multi', everyN: 'everyN', aura: 'aura', globalAtk: 'banner', partyAtk: 'banner', hpPct: 'hpPct', guard: 'guard', taunt: 'taunt', regen: 'regen', expose: 'expose', breaker: 'breaker', staggerEase: 'breaker', cdr: 'cdr', sageCdr: 'cdr', skillPct: 'skillPct', haste: 'haste', tierHaste: 'haste', roundGold: 'coin', interest: 'coin', bossGold: 'coin', midReward: 'coin', discount: 'tag', upMax: 'upMax', combineT1: 'plus1', activeHeal: 'heal', lastStand: 'hpPct', lowGuard: 'guard', auraGuard: 'guard', healLow: 'heal', healBuff: 'heal', partyCdr: 'cdr', bossWeak: 'weaken', aoe: 'circle', chain: 'cdr', lifesteal: 'regen', execute: 'bossPct' };
  const SKILL_ICON = { line: 'line', cone: 'cone', circle: 'circle', buff: 'buff', shield: 'guard', heal: 'heal', rally: 'banner', taunt: 'taunt', weaken: 'weaken', charm: 'charm', cover: 'guard', pshield: 'guard', hasteAll: 'haste', roar: 'taunt', delay: 'cdr', reflect: 'guard' };
  const icon = (k, col) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="color:${col || 'currentColor'}"><path d="${ICON[k] || ICON.dot}"/></svg>`;
  const tipAttr = (name, type, desc) => `data-tn="${esc(name)}" data-tt="${esc(type)}" data-td="${esc(desc)}"`;
  const CMD_INFO = { modeMove: ['move', t('move'), t('moveDesc')], amove: ['amove', t('attack'), t('attackDesc')], stop: ['focus', t('focus'), t('focusDesc')], sell: ['sell', t('disband'), t('disbandDesc')], useDrop: ['use', t('use'), ''], dash: ['dash', t('dash'), ''], heal: ['heal', '', ''], desel: ['close', t('deselect'), t('deselectDesc')] };
  const cmdBtn = (a, l, k, ok, on, extra) => {
    const ci = CMD_INFO[a] || ['dot', l, ''], ik = a === 'stop' && l === I.t('stop') ? 'stop' : ci[0];
    return `<button class="cmd ${on ? 'on' : ''}" data-act="${a}" type="button" ${ok ? '' : 'disabled'} ${tipAttr(l, t('command'), a === 'stop' && l === I.t('stop') ? I.t('stopDesc') : ci[2])}>${icon(ik)}${extra || ''}</button>`;
  };
  const passiveCell = (x) => `<div class="cmd info" ${tipAttr(x.name, t('passive'), x.desc)}>${icon(PASSIVE_ICON[x.k], '#e6c578')}<kbd>${t('cmdPassive')}</kbd></div>`;
  const skillDesc = (s) => `${(SKILL_TEXT[s.k] || (() => ''))(s)} · ${I.t('cooldown', { n: s.cd })}`;
  const skillCell = (s) => `<div class="cmd info" ${tipAttr(s.n, t('active'), skillDesc(s))}>${icon(SKILL_ICON[s.k], s.fx)}<kbd>${t('cmdActive')}</kbd></div>`;
  function fillCmds(cells) {
    // 9칸을 넘는 장수(불멸 등)도 잘리지 않게 모두 보여 준다
    const list = cells.slice();
    while (list.length < 9) list.push('<div class="cmd empty"></div>');
    return list.join('');
  }
  function setCmds(html) { const box = $('cmds'); if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; } }
  function setRecipes(h) { const box = $('recipes'); if (box.dataset.html !== h) { box.innerHTML = h; box.dataset.html = h; } }
  function setInfo(h) { const info = $('info'); if (info.dataset.html !== h) { const top = info.scrollTop; info.innerHTML = h; info.dataset.html = h; info.scrollTop = top; } }
  function dropInfo(d) {
    if (d.kind === 'item') {
      const tier = T.items.find((i) => i.id === d.item).tier;
      // 잠긴 장수의 아이템(상자에서 나옴, 2026-11-24): 이름 옆 자물쇠(gfx/ic_lock) + 해금 안내. 신화 아이템 4개 합치기 재료로는 그대로 쓴다.
      const lu = g.itemOpen && !g.itemOpen(d.item) ? g.itemUnit[d.item] : null;
      const lock = lu ? `<small class="lockn"><i class="ico lock"></i> ${esc(I.t('itemLocked', { a: defOf[lu].name }))}</small>` : '';
      return `<h3>${lu ? '<i class="ico lock"></i> ' : ''}${esc(g.dropName(d))}</h3><div class="sub">${I.t('itemSub', { r: rankName(tier) })}</div>${lock}`;
    }
    return `<h3>${esc(g.dropName(d))}</h3><div>${esc(T.consumables[d.kind].desc)}</div><div class="sub">${I.t('useHint')}</div>`;
  }
