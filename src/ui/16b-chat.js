  // ---- 협동 판 게임 중 채팅·이모티콘(2026-11-28) ----
  // 협동 방 판(서버 방)에서만 쓴다: 혼자·AI 동맹·체험 판에는 버튼이 없다. 입력 중에도 판은 멈추지 않는다.
  // 받은 글·이모티콘은 화면 왼쪽 구석 채팅 줄에 잠깐 쌓였다가 흐려져 사라진다(내 것도 서버가 돌려준 것이 보인다).
  // 판이 시작되면(17-loop beginNow) 대기실(lobby.js attachChat)이 net에 걸어 둔 onChat·onChatNo를 이쪽이 가져간다.
  // 판을 나가면 늘 페이지를 다시 불러오므로(11-actions restart·again·quit) 대기실로 돌려줄 일은 없다.
  // 차단 목록·신고·'한 번 더 누르기'·막힘 문구는 대기실과 같은 것을 쓴다(RTD_LOBBY.chatKit).
  // 이모티콘 그림은 gfx/emo_<id>.png(id 목록은 net.js EMOS = 서버 server/chat.js EMOS). 그림을 못 불러오면 그 칸·그 줄은 보이지 않는다.
  const GCHAT = {
    showMs: 6000,    // 한 줄이 또렷이 보이는 시간
    fadeMs: 600,     // 흐려지는 시간(CSS #gchat .gcl transition과 같게)
    afterHoldMs: 2500, // 입력 창·신고 창을 닫은 뒤 남은 줄이 더 보이는 시간
    maxLines: () => (window.innerHeight >= 600 ? 5 : 4),
    keep: 12,        // 기억해 두는 줄 수(보이는 것은 maxLines)
    tickMs: 200,     // 흐려짐·자리 다시 잡기 간격
    laneW: 340, laneWk: 0.42, // 라인 화면 채팅 줄 폭: 최대 px, 화면 폭 비율
    laneHk: 0.42,    // 라인 화면 채팅 줄 높이 상한(화면 높이 비율)
  };
  const NICK_COL = ['#ffd86a', '#8fd3ff', '#ffa58a', '#a6e38f', '#d9a8ff']; // 자리 순서(모두 같은 순서로 본다)별 닉 색
  const GC = { on: false, lines: [], seq: 0, open: false, op: null, emo: {}, timer: 0 };
  const gcKit = () => (window.RTD_LOBBY && window.RTD_LOBBY.chatKit ? window.RTD_LOBBY.chatKit() : null);
  const gcEmos = () => (window.RTD_NET && window.RTD_NET.EMOS) || [];
  const emoSrc = (id) => `gfx/emo_${id}.png`;
  const gcZoom = () => (typeof zoom === 'number' && zoom > 0 ? zoom : 1); // #app 확대(큰 화면)만큼 화면 px과 CSS px이 다르다
  const gcMine = (peer) => { const me = net && net.me && net.me(); return !!me && me.id === peer; };
  function gcColor(peer) {
    const ids = net && net.t && net.t.peers ? net.t.peers().map((p) => p.id).sort() : [];
    let i = ids.indexOf(peer);
    if (i < 0) i = Array.from(String(peer)).reduce((a, c) => a + c.charCodeAt(0), 0);
    return NICK_COL[i % NICK_COL.length];
  }
  // 판 시작(17-loop beginNow): room = 서버 협동 방 판
  function chatBegin(room) {
    GC.on = !!(room && net && net.t && net.t.kind === 'ws' && net.chat && net.emo);
    GC.lines = []; GC.op = null; chatClose(); gcOpClose();
    clearInterval(GC.timer); GC.timer = 0;
    if (!GC.on) { chatTick(); return; }
    // 그림을 미리 불러 둔다(못 불러온 그림은 고르기 판에서 빼고, 받은 줄도 보이지 않는다)
    gcEmos().forEach((id) => {
      if (GC.emo[id] != null) return;
      GC.emo[id] = 0;
      const im = new Image();
      im.onload = () => { GC.emo[id] = 1; gcPicker(); };
      im.onerror = () => { GC.emo[id] = -1; gcPicker(); };
      im.src = emoSrc(id);
    });
    const btn = $('chatbtn');
    if (!btn.firstChild) {
      btn.innerHTML = `<img alt="" src="${emoSrc('laugh')}">`;
      btn.firstChild.onerror = () => { btn.innerHTML = `<span class="gtx">${esc(t('gchat'))}</span>`; };
    }
    net.onChat = (d, peer) => gcPush({ peer, n: d.n, x: d.x });
    net.onEmo = (d, peer) => gcPush({ peer, n: d.n, e: d.e });
    net.onChatNo = (d) => { const k = gcKit(); if (k) gcPush({ sys: k.chatNo(d), warn: 1 }); };
    GC.timer = setInterval(chatTick, GCHAT.tickMs);
    chatTick();
  }
  function gcPush(o) {
    if (!GC.on) return;
    const k = gcKit();
    if (o.sys != null) { if (!o.sys) return; }
    else {
      o.n = String(o.n || '?'); o.mine = gcMine(o.peer);
      if (!o.mine && k && k.isBlocked(o.n)) return; // 차단한 사람 것은 보이지 않는다
      if (o.e && GC.emo[o.e] === -1) return; // 그림이 없는 이모티콘
      o.col = gcColor(o.peer);
    }
    o.id = ++GC.seq; o.t = performance.now();
    GC.lines.push(o);
    if (GC.lines.length > GCHAT.keep) GC.lines.splice(0, GC.lines.length - GCHAT.keep);
    chatTick();
  }
  function gcLineHtml(l) {
    if (l.sys) return `<div class="gcl sys${l.warn ? ' warn' : ''}">${esc(l.sys)}</div>`;
    const body = l.e ? `<img class="emo" alt="${esc(t('emo_' + l.e))}" src="${emoSrc(l.e)}">` : `<span>${esc(l.x)}</span>`;
    const tap = l.mine ? '' : ` data-gcl="${l.id}" role="button" aria-label="${esc(t('gchatLine', { a: l.n }))}"`;
    return `<div class="gcl${l.mine ? ' mine' : ''}${GC.op && GC.op.id === l.id ? ' sel' : ''}"${tap}><b style="color:${l.col}">${esc(l.n)}</b>${body}</div>`;
  }
  // 버튼 보이기, 줄 흐려지기, 자리 잡기
  function chatTick() {
    const btn = $('chatbtn'), box = $('gchat'), stg = $('stage');
    const show = GC.on && !!g && !!net && !net.kicked && !g.trial && !(g.over && !S.stay);
    if (btn.hidden !== !show) btn.hidden = !show;
    if (stg.classList.contains('chaton') !== show) stg.classList.toggle('chaton', show);
    // 보스전 출전 고르기 등 전장 위 창(#overlay .over)이 떠 있어도 채팅은 쓸 수 있게 버튼 줄·채팅 줄을 그 위로 올린다(결과창 제외)
    const up = show && !g.over && !!document.querySelector('#overlay .over');
    if (stg.classList.contains('chatup') !== up) stg.classList.toggle('chatup', up);
    if (!show && (GC.open || GC.op)) { chatClose(); gcOpClose(); }
    const now = performance.now(), hold = GC.open || !!GC.op;
    // 입력 창·신고 창이 열려 있는 동안은 줄이 사라지지 않는다(닫으면 afterHoldMs 뒤에 흐려진다)
    if (hold) GC.lines.forEach((l) => { l.t = Math.max(l.t, now - GCHAT.showMs + GCHAT.afterHoldMs); });
    GC.lines = GC.lines.filter((l) => now - l.t < GCHAT.showMs + GCHAT.fadeMs);
    const list = show ? GC.lines.slice(-GCHAT.maxLines()) : [];
    if (box.hidden !== !list.length) box.hidden = !list.length;
    if (!list.length) { box.dataset.key = ''; return; }
    const key = list.map((l) => l.id).join() + '|' + (GC.op ? GC.op.id : '');
    if (box.dataset.key !== key) { box.dataset.key = key; box.innerHTML = list.map(gcLineHtml).join(''); }
    list.forEach((l, i) => { const el = box.children[i], out = !hold && now - l.t >= GCHAT.showMs; if (el && el.classList.contains('out') !== out) el.classList.toggle('out', out); });
    gcPlace(box);
    // 높이가 모자라 위로 잘린 오래된 줄은 반쪽만 보이지 않게 통째로 숨긴다
    for (const el of box.children) { const cut = el.offsetTop < 0; if ((el.style.visibility === 'hidden') !== cut) el.style.visibility = cut ? 'hidden' : ''; }
  }
  // 자리: 라인 화면 = 왼쪽 정보 줄·인연 칸 오른쪽, 전장 위 구석(왼쪽 아래는 조이스틱·선택 바 자리).
  // 보스전 = 왼쪽 정보(라운드·동료 얼굴) 아래 ~ 조이스틱 위. 보이는 버튼(조이스틱·선택 바·스킬·라인으로·내 전장으로)과 겹치면 그 앞에서 멈춘다.
  function gcPlace(box) {
    const z = gcZoom(), st = $('stage'), sr = st.getBoundingClientRect();
    const rect = (el) => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
    const L0 = sr.left / z, T0 = sr.top / z, SW = sr.width / z, SH = sr.height / z;
    const rel = (r) => ({ l: r.left / z - L0, t: r.top / z - T0, r: r.right / z - L0, b: r.bottom / z - T0 });
    const hud = rect($('hud')), syn = rect($('synbar')), pad = 8;
    const lv = laneOn();
    let left, top, right, bottom;
    // 출전 고르기 같은 창(chatup)이 떠 있으면: 창 위쪽 띠(왼쪽 끝 ~ 위 오른쪽 버튼 줄 앞)에 최근 줄만. 창 안의 칸을 가리지 않는다
    const ov = st.classList.contains('chatup') ? document.querySelector('#overlay .over') : null, sheet = ov && rect(ov.firstElementChild), tr = rect($('tr'));
    if (sheet) {
      left = pad; top = 4;
      right = tr ? rel(tr).l - 6 : SW - pad;
      bottom = Math.max(top + 40, rel(sheet).t - 4);
      const h = Math.round(bottom - top), w = Math.round(right - left), pos = `${left},${top},${w},${h}`;
      if (box.dataset.pos !== pos) { box.dataset.pos = pos; box.style.left = left + 'px'; box.style.top = top + 'px'; box.style.width = w + 'px'; box.style.maxHeight = h + 'px'; }
      box.style.visibility = '';
      return;
    }
    if (lv) {
      left = Math.max(hud ? rel(hud).r : 0, syn ? rel(syn).r : 0) + pad;
      top = (hud ? rel(hud).t : 6) + 2;
      right = Math.min(SW - pad, left + Math.min(GCHAT.laneW, SW * GCHAT.laneWk));
      bottom = Math.min(SH - pad, top + SH * GCHAT.laneHk);
    } else {
      left = hud ? rel(hud).l : pad;
      top = (hud ? rel(hud).b : 6) + 6;
      right = Math.min(SW - pad, left + Math.min(GCHAT.laneW, SW * GCHAT.laneWk));
      bottom = SH - pad;
    }
    // 겹치면 안 되는 것: 아래에 있으면 그 위에서 멈추고, 위 줄(같은 높이)에 있으면 폭을 줄인다
    ['joy', 'selbar', 'skillbar', 'lanehint', 'backbtn', 'bossbtn', 'tr'].forEach((id) => {
      const r0 = rect($(id)); if (!r0) return;
      const r = rel(r0); if (r.r <= left || r.l >= right) return;
      if (r.t >= top + 20) bottom = Math.min(bottom, r.t - 6);
      else if (r.b > top) right = Math.min(right, r.l - 6);
    });
    const h = Math.max(0, Math.round(bottom - top)), w = Math.max(0, Math.round(right - left));
    const pos = `${Math.round(left)},${Math.round(top)},${w},${h}`;
    if (box.dataset.pos !== pos) { box.dataset.pos = pos; box.style.left = Math.round(left) + 'px'; box.style.top = Math.round(top) + 'px'; box.style.width = w + 'px'; box.style.maxHeight = h + 'px'; }
    box.style.visibility = h < 22 || w < 90 ? 'hidden' : '';
  }
  // 이모티콘 고르기 판: 불러온 그림만
  function gcPicker() {
    const el = document.querySelector('#gchatin .gce'); if (!el) return;
    const ids = gcEmos().filter((id) => GC.emo[id] === 1), key = ids.join();
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = ids.map((id) => `<button type="button" data-gemo="${id}" aria-label="${esc(t('emo_' + id))}" title="${esc(t('emo_' + id))}"><img alt="" src="${emoSrc(id)}"></button>`).join('');
  }
  function chatOpen() {
    if (!GC.on || GC.open) return;
    gcOpClose(); gcPicker();
    GC.open = true; $('gchatin').hidden = false;
    const b = $('chatbtn'); b.classList.add('on'); b.setAttribute('aria-expanded', 'true');
    gcVv();
    if (!S.coarse) $('gchatx').focus({ preventScroll: true }); // 터치 기기는 키보드를 바로 올리지 않는다(이모티콘만 고를 때 화면을 가리지 않게)
    chatTick();
  }
  function chatClose() {
    const f = $('gchatin'); if (!f) return;
    if (document.activeElement === $('gchatx')) $('gchatx').blur();
    GC.open = false; f.hidden = true;
    const b = $('chatbtn'); b.classList.remove('on'); b.setAttribute('aria-expanded', 'false');
  }
  function gcOpOpen(id) {
    const l = GC.lines.find((x) => x.id === id), k = gcKit();
    if (!l || l.mine || l.sys || !k) return;
    GC.op = l;
    const op = $('gchatop');
    op.innerHTML = `<b style="color:${l.col}">${esc(l.n)}</b><button class="btn" type="button" data-gcop="rep">${esc(k.L('report'))}</button><button class="btn" type="button" data-gcop="block">${esc(k.L('block'))}</button><button class="gcx" type="button" data-gcop="x" aria-label="${esc(t('close'))}"><i class="ico close" aria-hidden="true"></i></button>`;
    op.hidden = false;
    chatTick();
    // 누른 줄 오른쪽(넘치면 아래)에 띄운다
    const z = gcZoom(), sr = $('stage').getBoundingClientRect(), ln = document.querySelector(`#gchat [data-gcl="${id}"]`);
    if (!ln) { gcOpClose(); return; }
    const r = ln.getBoundingClientRect(), W0 = sr.width / z, H0 = sr.height / z, ow = op.offsetWidth, oh = op.offsetHeight;
    let x = (r.right - sr.left) / z + 6, y = (r.top - sr.top) / z + ((r.height / z) - oh) / 2;
    if (x + ow > W0 - 8) { x = Math.max(8, (r.left - sr.left) / z); y = (r.bottom - sr.top) / z + 4; }
    op.style.left = Math.round(Math.max(8, Math.min(W0 - ow - 8, x))) + 'px';
    op.style.top = Math.round(Math.max(8, Math.min(H0 - oh - 8, y))) + 'px';
  }
  function gcOpClose() { const op = $('gchatop'); if (op) { op.hidden = true; op.innerHTML = ''; } if (GC.op) { GC.op = null; chatTick(); } }
  // 휴대폰 키보드: 보이는 화면이 위로 밀리면(아이폰) 입력 창도 따라 내려 보이게 한다
  function gcVv() {
    const vv = window.visualViewport, f = $('gchatin');
    if (!f) return;
    f.style.marginTop = vv && !f.hidden && vv.offsetTop > 0 ? Math.round(vv.offsetTop / gcZoom()) + 'px' : '';
  }
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', gcVv); window.visualViewport.addEventListener('scroll', gcVv); }
  $('chatbtn').addEventListener('click', () => { if (GC.open) chatClose(); else chatOpen(); });
  $('gchatin').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('gchatx'), v = inp.value.trim();
    if (!v || !GC.on || !net) return;
    net.chat(v); inp.value = ''; chatClose();
  });
  $('gchatin').addEventListener('click', (e) => {
    const em = e.target.closest('[data-gemo]');
    if (em) { if (GC.on && net) net.emo(em.dataset.gemo); chatClose(); return; }
    if (e.target.closest('[data-gcx]')) chatClose();
  });
  $('gchatx').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); chatClose(); } });
  $('gchat').addEventListener('click', (e) => { const ln = e.target.closest('[data-gcl]'); if (ln) gcOpOpen(+ln.dataset.gcl); });
  $('gchatop').addEventListener('click', (e) => {
    const b = e.target.closest('[data-gcop]'), l = GC.op, k = gcKit();
    if (!b || !l || !k) return;
    const a = b.dataset.gcop;
    if (a === 'x') { gcOpClose(); return; }
    if (!k.armed(b)) return; // 신고·차단은 3초 안에 한 번 더 눌러야 한다(대기실과 같다)
    if (a === 'rep') { k.report(net && net.code, l.peer, l.n, l.e ? '[emo:' + l.e + ']' : l.x).then(() => gcPush({ sys: k.L('reported') })).catch(() => {}); }
    else if (a === 'block') { k.block(l.n); GC.lines = GC.lines.filter((x) => x.sys || x.mine || x.n !== l.n); gcPush({ sys: k.L('blocked') }); }
    gcOpClose();
  });
  // 바깥을 누르면 입력 창·신고 창을 닫는다(쓰던 글은 남겨 둔다). 전장 누르기는 그대로 판에 간다
  document.addEventListener('pointerdown', (e) => {
    if (!GC.open && !GC.op) return;
    const tg = e.target;
    if (GC.open && !tg.closest('#gchatin, #chatbtn')) chatClose();
    if (GC.op && !tg.closest('#gchatop, #gchat')) gcOpClose();
  }, true);
