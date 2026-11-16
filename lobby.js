// 메인 로비: 캐릭터(일러스트에 숨쉬기·살랑임·터치 반응), 상단 프로필·재화, 메뉴(상점·랭킹·계정·설정),
// 전투 시작 단계(온라인/싱글 → 모드 → 난이도 또는 방), 방 채팅(신고·차단), 스킨(장수 색·지도 색).
(function (root) {
  const SHOP = root.RTD_SHOP, Art = root.RTD_ART;
  const $ = (id) => document.getElementById(id);
  let C = null; // ui.js가 넘겨주는 도구들
  // 원보(유료 재화) 스위치: 첫 출시는 광고만이라 상점 원보 탭과 로비 위 원보 잔액을 숨긴다. 결제를 붙이면 true
  const GEMS_ON = false;
  const LI = () => ({ ko: 0, ja: 1, en: 2, zh: 3 }[C.I.lang] || 0);
  const nm = (arr) => arr[LI()] || arr[0];
  // 로비 전용 문구 [ko, ja, en, zh]
  const S = {
    shop: ['상점', 'ショップ', 'Shop', '商店'], rank: ['랭킹', 'ランキング', 'Rankings', '排行榜'], account: ['계정', 'アカウント', 'Account', '账号'], settings: ['설정', '設定', 'Settings', '设置'],
    icons: ['아이콘', 'アイコン', 'Icons', '头像'], skins: ['장수 외형', '武将の外見', 'General skins', '武将外观'], maps: ['전장 지도', '戦場マップ', 'Battle maps', '战场地图'], gems: ['원보 충전', '元宝チャージ', 'Ingots', '元宝充值'],
    buy: ['구매', '購入', 'Buy', '购买'], equip: ['장착', '装備', 'Equip', '装备'], equipped: ['장착 중', '装備中', 'Equipped', '装备中'], unequip: ['해제', '外す', 'Remove', '卸下'], owned: ['보유', '所持', 'Owned', '已拥有'], free: ['기본', '基本', 'Default', '默认'],
    nickBadHint: ['닉네임에 쓸 수 없는 말이 있어 다른 사람에게는 ***로 보입니다. 계정 창에서 바꿔 주세요.', 'ニックネームに使えない言葉が含まれているため、他の人には *** と表示されます。アカウント画面で変更してください。', 'Your nickname contains a banned word and shows as *** to others. Please change it in Account.', '昵称含有禁用词，其他人看到的是 ***。请在账号界面修改。'],
    noCoins: ['동전이 부족합니다.', '銅銭が足りません。', 'Not enough coins.', '铜钱不足。'],
    needLogin: ['로그인하면 이용할 수 있습니다.', 'ログインすると利用できます。', 'Sign in to use this.', '登录后可使用。'],
    coinHint: ['동전은 온라인 판을 마칠 때마다 받습니다(경험치의 1/5, 클리어하면 +20).', '銅銭はオンライン対局を終えるたびにもらえます（経験値の1/5、クリアで+20）。', 'Earn coins by finishing online games (1/5 of XP, +20 for a clear).', '每完成一局在线游戏可获得铜钱（经验的1/5，通关再+20）。'],
    gemHint: ['원보는 인앱 결제 준비 중입니다. 능력치에는 영향이 없는 꾸미기 전용입니다.', '元宝はアプリ内課金の準備中です。能力に影響しない見た目専用です。', 'Ingot purchases are coming soon. Cosmetics only, no stat effects.', '元宝充值准备中。仅用于外观，不影响能力。'],
    soon: ['준비 중', '準備中', 'Soon', '准备中'],
    rLevel: ['계정 레벨', 'アカウントLv', 'Account level', '账号等级'], rClear: ['최단 클리어', '最速クリア', 'Fastest clear', '最快通关'], rImm: ['불멸 소환', '不滅の召喚', 'Immortal summons', '不灭召唤'],
    times: ['{n}회', '{n}回', '×{n}', '{n}次'], empty: ['아직 기록이 없습니다.', 'まだ記録がありません。', 'No records yet.', '暂无记录。'],
    rankNote: ['온라인 판만 기록됩니다. 클리어 랭킹에는 함께한 파티원이 모두 표시됩니다.', 'オンライン対局のみ記録されます。クリアランキングには一緒に戦ったメンバー全員が表示されます。', 'Only online games count. Clear rankings show every party member.', '仅记录在线对局。通关榜会显示全部队友。'],
    icon: ['아이콘', 'アイコン', 'Icon', '头像'], iconPick: ['아이콘 바꾸기', 'アイコン変更', 'Change icon', '更换头像'],
    language: ['언어', '言語', 'Language', '语言'],
    history: ['전적', '戦績', 'Records', '战绩'], totalPlays: ['전체 판', '総プレイ', 'Games', '总局数'], playsClears: ['{p}판 · 클리어 {c}', '{p}回・クリア{c}', '{p} played · {c} cleared', '{p}局·通关{c}'],
    recent: ['최근 20판 (누르면 자세히)', '直近20回（押すと詳細）', 'Last 20 games (tap for details)', '最近20局（点击查看详情）'], win: ['승리', '勝利', 'Win', '胜利'], lose: ['패배', '敗北', 'Loss', '失败'],
    mythGot: ['신화 이상 소환', '神話以上の召喚', 'Myth+ summoned', '神话以上召唤'], noMyth: ['없음', 'なし', 'None', '无'], offlineTag: ['오프라인', 'オフライン', 'Offline', '离线'], onlineTag: ['온라인', 'オンライン', 'Online', '在线'],
    histLocal: ['로그인하지 않은 기록은 이 기기에만 저장됩니다.', 'ログインしていない記録はこの端末にだけ保存されます。', 'Records made while signed out stay on this device.', '未登录时的记录只保存在本设备。'],
    st_kills: ['처치', '撃破', 'Kills', '击杀'], st_mid: ['중간보스 토벌/놓침', '中ボス 討伐/逃走', 'Mid-bosses won/missed', '中首领 讨伐/逃脱'], st_life: ['잃은 라이프', '失ったライフ', 'Lives lost', '损失生命'], st_gold: ['번 금화', '獲得金貨', 'Gold earned', '获得金币'],
    st_comb: ['합성 · 조합', '合成・レシピ', 'Combines · Crafts', '合成·配方'], st_tix: ['선택권 · 상자', '選択券・宝箱', 'Tickets · Chests', '选择券·宝箱'], st_boss: ['보스 토벌/도전', 'ボス 討伐/挑戦', 'Bosses won/fought', '首领 击败/挑战'], st_fast: ['빠른 클리어', '速攻', 'Fast clears', '速通'],
    locked: ['{a} 클리어 필요', '{a}クリアが必要', 'Clear {a} first', '需先通关{a}'], lockedMut: ['악몽 +{n} 클리어 필요', '悪夢+{n}クリアが必要', 'Clear Nightmare +{n} first', '需先通关噩梦+{n}'],
    stepMatch: ['빠른 대전', 'クイック対戦', 'Quick match', '快速匹配'], searching: ['같은 난이도 상대를 찾는 중… (대기 {n}명)', '同じ難易度の相手を探しています…（待機{n}人）', 'Finding players… ({n} waiting)', '正在寻找同难度玩家…（等待{n}人）'],
    entering: ['방에 들어가는 중… ({a}/{b})', 'ルームに入っています…（{a}/{b}）', 'Joining room… ({a}/{b})', '正在进入房间…（{a}/{b}）'], cancel: ['취소', 'キャンセル', 'Cancel', '取消'], alone: ['혼자 시작', 'ひとりで開始', 'Start alone', '独自开始'], aloneHint: ['찾는 사람이 적습니다. 혼자 시작해도 기록은 남습니다.', '相手が少ないようです。ひとりで始めても記録は残ります。', 'Few players right now. Starting alone still counts.', '当前玩家较少，独自开始也会记录。'],
    stepPlay: ['어디서 싸울까요?', 'どこで戦いますか？', 'Where to fight?', '在哪里作战？'], stepMode: ['모드 선택', 'モード選択', 'Choose mode', '选择模式'], stepDiff: ['난이도 선택', '難易度選択', 'Choose difficulty', '选择难度'], stepRoom: ['협동 방', '協力ルーム', 'Co-op room', '合作房间'],
    singleWord: ['싱글', 'シングル', 'Single', '单人'],
    loginFirst: ['온라인은 로그인이 필요합니다.', 'オンラインはログインが必要です。', 'Online play requires signing in.', '在线模式需要登录。'], openAcc: ['계정 열기', 'アカウントを開く', 'Open account', '打开账号'],
    chatJoin: ['{a} 님이 들어왔습니다.', '{a}さんが入室しました。', '{a} joined.', '{a} 加入了。'], chatLeft: ['{a} 님이 나갔습니다.', '{a}さんが退室しました。', '{a} left.', '{a} 离开了。'],
    report: ['신고', '通報', 'Report', '举报'], block: ['차단', 'ブロック', 'Block', '屏蔽'], unblock: ['차단 풀기', 'ブロック解除', 'Unblock', '解除屏蔽'], reported: ['신고했습니다. 운영자가 확인합니다.', '通報しました。運営が確認します。', 'Reported. We will review it.', '已举报，运营将核实。'], blocked: ['차단한 사람의 채팅은 보이지 않습니다.', 'ブロックした人のチャットは表示されません。', "Blocked players' messages are hidden.", '已屏蔽该玩家的聊天。'],
    chatRule: ['욕설은 가려지고 광고·도배는 차단됩니다. 신고된 채팅은 운영자가 확인합니다.', '暴言は伏せ字になり、広告・連投はブロックされます。通報されたチャットは運営が確認します。', 'Abusive words are masked; ads and spam are blocked. Reported messages are reviewed.', '脏话会被屏蔽，广告和刷屏会被拦截。被举报的聊天由管理员审核。'],
    lchat: ['로비 채팅', 'ロビーチャット', 'Lobby chat', '大厅聊天'], chN: ['채널 {n}', 'チャンネル{n}', 'Channel {n}', '频道{n}'], lcSend: ['보내기', '送信', 'Send', '发送'], lcPh: ['메시지 입력', 'メッセージを入力', 'Type a message', '输入消息'],
    chEnter: ['채널 {n}에 들어왔습니다. (지금 {c}명)', 'チャンネル{n}に入りました。（現在{c}人）', 'Joined channel {n}. ({c} here now)', '已进入频道{n}。（当前{c}人）'], chFull: ['그 채널은 가득 찼습니다.', 'そのチャンネルは満員です。', 'That channel is full.', '该频道已满。'],
    lcWait: ['채팅 서버에 연결하는 중…', 'チャットサーバーに接続中…', 'Connecting to chat…', '正在连接聊天服务器…'], lcBar: ['채팅 · 채널 {n} ({c}명)', 'チャット・チャンネル{n}（{c}人）', 'Chat · Ch {n} ({c})', '聊天·频道{n}（{c}人）'],
    no_fast: ['너무 빨리 보내고 있습니다. 잠시 뒤에 보내 주세요.', '送信が速すぎます。少し待ってから送ってください。', 'You are sending too fast. Please wait a moment.', '发送过快，请稍后再发。'],
    no_dup: ['같은 말을 연달아 보낼 수 없습니다.', '同じ内容を続けて送ることはできません。', 'You cannot send the same message twice in a row.', '不能连续发送相同内容。'],
    no_ad: ['광고·연락처·주소는 보낼 수 없습니다.', '広告・連絡先・URLは送信できません。', 'Ads, contact details and links cannot be sent.', '不能发送广告、联系方式或链接。'],
    no_mute: ['도배·광고로 채팅이 {s}초 동안 막혔습니다.', '連投・広告のため、チャットが{s}秒間制限されました。', 'Chat is muted for {s}s due to spam or ads.', '因刷屏或广告，聊天已被禁言{s}秒。'],
    tapLines: [['오늘도 출진하시나요?', '今日も出陣されますか？', 'Heading out to battle today?', '今天也要出征吗？'], ['연환계라면 제게 맡기세요.', '連環の計なら私にお任せを。', 'Leave the chain stratagem to me.', '连环计就交给我吧。'], ['천하는 넓고, 영웅은 많지요.', '天下は広く、英雄は多いもの。', 'The realm is wide, and heroes are many.', '天下之大，英雄辈出。'], ['너무 빤히 보시면… 부끄러워요.', 'そんなに見つめられると…恥ずかしいです。', "Don't stare so… it's embarrassing.", '这样盯着看……人家会害羞的。']],
  };
  const L = (k, v) => { let s = nm(S[k] || [k]); if (v) Object.keys(v).forEach((x) => (s = s.split('{' + x + '}').join(v[x]))); return s; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 색 바꾸기(스킨) ----------
  // 그림의 색상(hue)을 돌리고 채도·밝기를 바꾼 새 캔버스. 한 번 만든 것은 다시 쓴다.
  function shift(src, p) {
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    if (!w || !h) return null;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d'); x.drawImage(src, 0, 0);
    let d; try { d = x.getImageData(0, 0, w, h); } catch (e) { return null; }
    const a = d.data, hs = (p.hue || 0) / 360, sat = p.sat == null ? 1 : p.sat, lit = p.lit || 0;
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      let r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, ss = 0, ll = (mx + mn) / 2;
      if (mx !== mn) { const dd = mx - mn; ss = ll > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn); hh = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; hh /= 6; }
      // 피부·금속처럼 채도가 낮은 곳은 덜 바꾼다(얼굴색이 이상해지지 않게)
      const k = Math.min(1, ss * 1.6);
      hh = (hh + hs * k + 1) % 1; ss = Math.min(1, ss * (1 + (sat - 1) * k)); ll = Math.max(0, Math.min(1, ll + lit));
      const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss, pp = 2 * ll - q;
      const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
      a[i] = f(hh + 1 / 3) * 255; a[i + 1] = f(hh) * 255; a[i + 2] = f(hh - 1 / 3) * 255;
    }
    x.putImageData(d, 0, 0);
    return cv;
  }
  const skinCache = new WeakMap();
  const mySkin = (id) => { const me = C && C.ACC.me, k = me && me.skins && me.skins[id]; return k && SHOP.UNIT_SKINS[k] ? Object.assign({ key: k }, SHOP.UNIT_SKINS[k]) : null; };
  function skinned(img, id, force) {
    const sk = force || mySkin(id);
    if (!sk || !img) return img;
    if (img.complete === false) return img; // 아직 안 받은 그림
    let m = skinCache.get(img); if (!m) skinCache.set(img, (m = {}));
    if (!(sk.key in m)) m[sk.key] = shift(img, sk) || img;
    return m[sk.key];
  }
  // 장수 그림을 그릴 때 내 장착 외형을 입힌다
  if (Art) { const base = Art.unitSprite; Art.unitSprite = (d, v, f) => skinned(base(d, v, f), d.id); }
  function tintMap(cv) {
    const me = C && C.ACC.me, ms = me && me.mapSkin, p = ms && SHOP.MAP_SKINS[ms];
    if (!p || ms === 'spring' || p.theme) return; // 그림 스킨은 지도 자체가 다르게 칠해진다(색 바꾸기 없음)
    const out = shift(cv, p); if (!out) return;
    const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(out, 0, 0);
  }

  // ---------- 로비 캐릭터 ----------
  const charImg = new Image(); charImg.src = 'gfx/lobby_char.png?v=1'; // 배경을 지운 그림(밝은 로비 배경 위에 그대로 세운다)
  let sayT = 0, hop = 0, lineI = 0;
  function charLoop(now) {
    requestAnimationFrame(charLoop);
    const cv = $('lcharcv'); if (!cv || $('title').hidden || !charImg.complete || !charImg.naturalWidth) return;
    const box = cv.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const x = cv.getContext('2d'), t = now / 1000;
    x.clearRect(0, 0, W, H);
    // 그림 맞추기(아래 붙임)
    const ih = charImg.naturalHeight, iw = charImg.naturalWidth, sc = Math.min(H * 0.94 / ih, W * 1.0 / iw), dw = iw * sc, dh = ih * sc, ox = (W - dw) / 2, oy = H - dh;
    hop = Math.max(0, hop - 1 / 60);
    const jump = Math.sin(Math.min(1, hop / 0.45) * Math.PI) * 16 * dpr;
    // 발밑 그림자(배경 위에 떠 보이지 않게)
    { const gx = W / 2, gy = H - dh * 0.035, rw = dw * 0.34, sh2 = x.createRadialGradient(gx, gy, 0, gx, gy, rw); sh2.addColorStop(0, 'rgba(30,12,6,.5)'); sh2.addColorStop(1, 'rgba(30,12,6,0)'); x.save(); x.translate(0, gy); x.scale(1, 0.22); x.translate(0, -gy); x.fillStyle = sh2; x.fillRect(gx - rw, gy - rw, rw * 2, rw * 2); x.restore(); }
    // 가로 띠로 잘라 위로 갈수록 살랑이게, 가슴 높이는 숨쉬듯 아주 조금 부풀었다 가라앉게
    const N = 90, sh = ih / N;
    for (let i = 0; i < N; i++) {
      const sy = i * sh, k = 1 - i / N; // 위쪽이 1
      const sway = Math.sin(t * 1.1 + i * 0.05) * 5 * dpr * k * k + Math.sin(t * 2.3) * 1.2 * dpr * k;
      const torso = i / N > 0.22 && i / N < 0.45 ? 1 : 0;
      const breathe = 1 + torso * Math.sin(t * 2.1) * 0.012;
      const yy = oy + sy * sc - jump - (1 - k) * 0;
      x.drawImage(charImg, 0, sy, iw, sh + 0.6, ox + sway - (breathe - 1) * dw / 2, yy, dw * breathe, sh * sc + 0.6);
    }
    if (sayT && now > sayT) { $('lsay').hidden = true; sayT = 0; }
  }
  function charTap() {
    hop = 0.45; const lines = S.tapLines; lineI = (lineI + 1) % lines.length;
    const el = $('lsay'); el.textContent = nm(lines[lineI]); el.hidden = false; sayT = performance.now() + 3200;
  }

  function toast(txt) {
    let el = $('ltoast'); if (!el) { el = document.createElement('div'); el.id = 'ltoast'; $('title').appendChild(el); }
    el.textContent = txt; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600);
  }
  // ---------- 전적과 난이도 해금 ----------
  const DIFFS = ['easy', 'normal', 'hard', 'nightmare'];
  const loadJ = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const saveJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 */ } };
  // 해금 진행도: 기기에서 깬 것과 계정에서 깬 것 중 높은 쪽
  function prog() {
    const l = loadJ('rtd-prog', { clr: -1, nmx: -1 }), a = (C.ACC.me && C.ACC.me.prog) || { clr: -1, nmx: -1 };
    return { clr: Math.max(l.clr, a.clr), nmx: Math.max(l.nmx, a.nmx) };
  }
  function diffOpen(diff, mut) {
    const p = prog(), i = DIFFS.indexOf(diff);
    if (i > p.clr + 1) return false;
    if (diff === 'nightmare' && mut > 0 && mut > p.nmx + 1) return false;
    return true;
  }
  function statsOf(g) {
    const s = g.stats || {};
    return { kills: s.kills | 0, midKill: s.midKill | 0, midMiss: s.midMiss | 0, lifeLost: s.lifeLost | 0, goldIn: s.goldIn | 0, combines: s.combines | 0, crafts: (s.crafts || []).length, best: s.best | 0, tickets: s.tickets | 0, chests: s.chests | 0, bosses: (s.bosses || []).length, bossWins: (s.bosses || []).filter((b) => b.win).length, fast: (s.bosses || []).filter((b) => b.fast).length };
  }
  // 판이 끝날 때: 기기에 남기고, 로그인한 오프라인 판은 서버에도(온라인 판은 결과 보고에 같이 간다)
  function recordGame(g, online, mode) {
    const rec = { at: Date.now(), diff: g.diff.id, mut: g.mutLv || 0, mutLv: g.mutLv || 0, round: g.round, win: g.over === 'win', time: Math.round(g.time), online: !!online, mode, myth: (g.stats && g.stats.myth) || {}, st: statsOf(g) };
    const h = loadJ('rtd-hist', []); h.unshift(rec); saveJ('rtd-hist', h.slice(0, 20));
    const p = loadJ('rtd-prog', { clr: -1, nmx: -1, plays: {}, clears: {} });
    p.plays = p.plays || {}; p.clears = p.clears || {};
    p.plays[rec.diff] = (p.plays[rec.diff] || 0) + 1;
    if (rec.win) { p.clears[rec.diff] = (p.clears[rec.diff] || 0) + 1; p.clr = Math.max(p.clr, DIFFS.indexOf(rec.diff)); if (rec.diff === 'nightmare') p.nmx = Math.max(p.nmx, rec.mut); }
    saveJ('rtd-prog', p);
    if (!online && C.ACC.token) C.api('/api/history', rec).then((r) => { if (r.me) { C.ACC.me = r.me; C.saveAcc(); } });
  }
  // 난이도 버튼에 잠금 표시
  function markLocks() {
    const dname = (id) => (C.T.difficulties.find((d) => d.id === id) || {}).name || id;
    document.querySelectorAll('#diffs button[data-v]').forEach((b) => {
      const i = DIFFS.indexOf(b.dataset.v), open = diffOpen(b.dataset.v, 0);
      b.classList.toggle('lock', !open); b.disabled = !open;
      b.title = open ? '' : L('locked', { a: dname(DIFFS[i - 1]) });
      // 잠긴 난이도는 무엇을 깨면 열리는지 버튼 안에 글로 보여 준다(터치 화면에서는 title이 안 보인다)
      let lk = b.querySelector('.lk');
      if (!open) { if (!lk) { lk = document.createElement('em'); lk.className = 'lk'; b.appendChild(lk); } lk.textContent = '🔒 ' + L('locked', { a: dname(DIFFS[i - 1]) }); }
      else if (lk) lk.remove();
    });
    const p = prog();
    document.querySelectorAll('#mutlv button[data-v]').forEach((b) => { const n = +b.dataset.v, open = n === 0 || n <= p.nmx + 1; b.disabled = !open; b.title = open ? '' : L('lockedMut', { n: n - 1 }); });
    if (!diffOpen(C.cfg.diff, 0)) { const best = DIFFS.filter((d) => diffOpen(d, 0)).pop(); if (best && best !== C.cfg.diff) { C.cfg.diff = best; C.cfg.mutLv = '0'; } }
  }

  // ---------- 상단 ----------
  const iconSrc = (id) => { const d = C.T.units.find((u) => u.id === id) || C.T.units.find((u) => u.id === 'cav'); return Art.portrait(d); };
  function renderTop() {
    const me = C.ACC.me;
    // 금칙어 닉네임: 한 번 알려 준다(다른 사람에게는 *** 로 보임)
    if (me && me.nickBad && !renderTop.warned) { renderTop.warned = true; setTimeout(() => toast(L('nickBadHint')), 600); }
    $('lico').src = iconSrc(me ? me.icon : 'cav');
    $('lnick').textContent = me ? me.nick : C.t('solo');
    $('lrank').textContent = me ? `${C.t(me.grade)} · ${C.t('level', { n: me.level })}` : L('needLogin');
    $('lcur').hidden = !me;
    if (me) { $('lcoins').textContent = (me.coins || 0).toLocaleString(); $('lgems').textContent = (me.gems || 0).toLocaleString(); }
    // #lcur .cur 은 CSS가 display:flex 라 hidden 속성이 안 먹는다 → style로 숨긴다
    const gemChip = $('lgems') && $('lgems').parentElement; if (gemChip) gemChip.style.display = GEMS_ON ? '' : 'none';
  }

  // ---------- 메뉴 창 ----------
  let panel = null, ptab = null, rdiff = 'normal', rimm = 'jojo';
  function openPanel(kind) {
    panel = kind; ptab = null; $('lpanel').hidden = false;
    $('lptitle').textContent = L(kind);
    // 계정 상자는 계정 창 안으로 옮겨 쓴다
    $('lhold').appendChild($('accbox')); $('lpbody').innerHTML = '';
    if (kind === 'account') $('lpbody').appendChild($('accbox'));
    renderPanel();
  }
  function closePanel() { panel = null; $('lpanel').hidden = true; $('lhold').appendChild($('accbox')); }
  const tabs = (list) => { if (!ptab || !list.some(([k]) => k === ptab)) ptab = list[0][0]; $('lptabs').innerHTML = list.map(([k, l]) => `<button type="button" class="${ptab === k ? 'on' : ''}" data-ptab="${k}">${l}</button>`).join(''); };
  async function renderPanel() {
    if (!panel) return;
    if (panel === 'lchat') { renderLchat(); return; }
    const me = C.ACC.me, body = $('lpbody');
    if (panel === 'account') {
      $('lptabs').innerHTML = '';
      C.refreshAcc();
      let ic = body.querySelector('#lpicons');
      if (!ic) { ic = document.createElement('div'); ic.id = 'lpicons'; body.appendChild(ic); }
      if (!me) { ic.innerHTML = ''; return; }
      const own = SHOP.ICON_FREE.concat(SHOP.ICON_SHOP.map(([u]) => u).filter((u) => me.owned.includes('icon_' + u)));
      ic.innerHTML = `<div class="label" style="margin-top:10px">${L('iconPick')}</div><div class="lp-grid">${own.map((u) => `<div class="lp-card ${me.icon === u ? 'on' : ''}"><img alt="" src="${iconSrc(u)}"><span class="nm">${esc((C.T.units.find((d) => d.id === u) || {}).name || u)}</span><button class="btn" type="button" data-equip="icon" data-id="icon_${u}" ${me.icon === u ? 'disabled' : ''}>${L(me.icon === u ? 'equipped' : 'equip')}</button></div>`).join('')}</div>`;
      return;
    }
    if (panel === 'history') {
      $('lptabs').innerHTML = '';
      let hist, pg;
      if (me) { const r = await C.api('/api/hist', {}); hist = r.hist || []; pg = r.prog || { plays: {}, clears: {} }; }
      else { hist = loadJ('rtd-hist', []); pg = loadJ('rtd-prog', { plays: {}, clears: {} }); }
      if (panel !== 'history') return;
      const plays = pg.plays || {}, clears = pg.clears || {}, total = Object.values(plays).reduce((a, b) => a + b, 0);
      const dn = (id) => (C.T.difficulties.find((d) => d.id === id) || {}).name || id;
      let h = `<div class="hs-sum"><div>${L('totalPlays')}<b>${total}</b></div>${DIFFS.map((d) => `<div>${esc(dn(d))}<b>${L('playsClears', { p: plays[d] || 0, c: clears[d] || 0 })}</b></div>`).join('')}</div>`;
      if (!me) h += `<div class="lp-note">${L('histLocal')}</div>`;
      h += `<div class="label">${L('recent')}</div>`;
      h += hist.map((x, i) => {
        const dt = new Date(x.at), when = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        const myth = Object.keys(x.myth || {});
        const st = x.st || {};
        const det = `<div class="hs-det" id="hsd${i}" hidden><b>${L('mythGot')}</b><div class="ms">${myth.length ? myth.map((id) => { const d = C.T.units.find((u) => u.id === id); return d ? `<span><img alt="" src="${Art.portrait(d)}">${esc(d.name)} ×${x.myth[id]}</span>` : ''; }).join('') : L('noMyth')}</div>
          <div class="sg"><span>${L('st_kills')} <b>${st.kills || 0}</b></span><span>${L('st_mid')} <b>${st.midKill || 0}/${st.midMiss || 0}</b></span><span>${L('st_life')} <b>${st.lifeLost || 0}</b></span><span>${L('st_gold')} <b>${(st.goldIn || 0).toLocaleString()}</b></span><span>${L('st_comb')} <b>${st.combines || 0} · ${st.crafts || 0}</b></span><span>${L('st_tix')} <b>${st.tickets || 0} · ${st.chests || 0}</b></span><span>${L('st_boss')} <b>${st.bossWins || 0}/${st.bosses || 0}</b></span><span>${L('st_fast')} <b>${st.fast || 0}</b></span></div></div>`;
        return `<div class="hs-row" data-hs="${i}"><span>${when} · ${esc(dn(x.diff))}${x.mut ? ' +' + x.mut : ''} <small>${L(x.online ? 'onlineTag' : 'offlineTag')}</small></span><span>R${x.round} · ${C.clock(x.time || 0)}</span><span class="${x.win ? 'w' : 'l'}">${L(x.win ? 'win' : 'lose')}</span></div>${det}`;
      }).join('') || `<div class="lp-note">${L('empty')}</div>`;
      body.innerHTML = h;
      return;
    }
    if (panel === 'settings') {
      $('lptabs').innerHTML = '';
      // 차단 풀기: 차단한 사람이 있으면 설정 맨 아래에 목록을 붙인다
      body.innerHTML = C.settingsHtml() + (blocked.length ? `<div class="setlist"><div class="h">${L('block')}</div>${blocked.map((n) => `<div class="row"><span>${esc(n)}</span><button type="button" class="unb" data-unblock="${esc(n)}">${L('unblock')}</button></div>`).join('')}</div>` : '');
      return;
    }
    if (panel === 'shop') {
      tabs([['icons', L('icons')], ['skins', L('skins')], ['maps', L('maps')]].concat(GEMS_ON ? [['gems', L('gems')]] : []));
      if (!me) { body.innerHTML = `<div class="lp-note">${L('needLogin')}</div>`; return; }
      const has = (id) => SHOP.free(id) || me.owned.includes(id);
      const btn = (id, cost, on, kind, unit) => has(id)
        ? `<button class="btn" type="button" data-equip="${kind}" data-id="${id}" ${unit ? `data-unit="${unit}"` : ''} ${on && kind !== 'skin' ? 'disabled' : ''}>${on ? L(kind === 'skin' ? 'unequip' : 'equipped') : L('equip')}</button>`
        : `<button class="btn go" type="button" data-buy="${id}" ${me.coins < cost ? 'disabled' : ''}>${L('buy')} · 銅 ${cost}</button>`;
      let h = `<div class="lp-note">${L('coinHint')}</div>`;
      if (ptab === 'icons') {
        h += `<div class="lp-grid">${SHOP.ICON_FREE.map((u) => [u, 0]).concat(SHOP.ICON_SHOP).map(([u, cost]) => `<div class="lp-card ${me.icon === u ? 'on' : ''}"><img alt="" src="${iconSrc(u)}"><span class="nm">${esc((C.T.units.find((d) => d.id === u) || {}).name || u)}</span>${cost ? '' : `<span class="pr">${L('free')}</span>`}${btn('icon_' + u, cost, me.icon === u, 'icon')}</div>`).join('')}</div>`;
      } else if (ptab === 'skins') {
        h += `<div class="lp-grid">${Object.keys(SHOP.UNIT_SKINS).map((k) => {
          const sk = SHOP.UNIT_SKINS[k], d = C.T.units.find((u) => u.id === sk.unit), on = me.skins && me.skins[sk.unit] === k;
          return `<div class="lp-card ${on ? 'on' : ''}"><img alt="" data-skinpv="${k}" src="${iconSrc(d.id)}"><span class="nm">${esc(nm(sk.name))}</span>${btn('skin_' + k, sk.price, on, 'skin', sk.unit)}</div>`;
        }).join('')}</div>`;
      } else if (ptab === 'maps') {
        h += `<div class="lp-grid">${Object.keys(SHOP.MAP_SKINS).map((k) => {
          const sk = SHOP.MAP_SKINS[k], on = (me.mapSkin || 'spring') === k;
          return `<div class="lp-card ${on ? 'on' : ''}"><canvas class="lp-sw" data-mappv="${k}" width="144" height="96"></canvas><span class="nm">${esc(nm(sk.name))}</span>${sk.price ? '' : `<span class="pr">${L('free')}</span>`}${btn('map_' + k, sk.price, on, 'map')}</div>`;
        }).join('')}</div>`;
      } else if (GEMS_ON) {
        h = `<div class="lp-note">${L('gemHint')}</div><div class="lp-grid">${SHOP.GEM_PACKS.map(([id, n, yen]) => `<div class="lp-card"><span style="font:900 26px 'Noto Serif KR',serif;color:#ff8a9a">寶</span><span class="nm">${n}</span><span class="pr">¥${yen}</span><button class="btn" type="button" disabled>${L('soon')}</button></div>`).join('')}</div>`;
      }
      body.innerHTML = h;
      // 미리보기: 장수 외형은 색을 바꾼 초상, 지도는 바뀐 바닥 색
      body.querySelectorAll('[data-skinpv]').forEach((img) => { const k = img.dataset.skinpv, sk = SHOP.UNIT_SKINS[k], src = new Image(); src.onload = () => { const c2 = shift(src, sk); if (c2) img.src = c2.toDataURL(); }; src.src = img.src; });
      body.querySelectorAll('[data-mappv]').forEach((cv) => { const k = cv.dataset.mappv; const sk = SHOP.MAP_SKINS[k]; C.paintMini(cv, sk.theme || null); if (k !== 'spring' && !sk.theme) { const o = shift(cv, sk); if (o) { const x = cv.getContext('2d'); x.drawImage(o, 0, 0); } } });
      return;
    }
    if (panel === 'rank') {
      tabs([['level', L('rLevel')], ['clear', L('rClear')], ['imm', L('rImm')]]);
      let h = `<div class="lp-note">${L('rankNote')}</div>`, list = [];
      const row = (i, p, val, extra) => `<div class="lp-row"><span class="no">${i + 1}</span><img alt="" src="${iconSrc(p.icon)}"><span class="who">${extra || esc(p.nick)}<small>${p.grade ? esc(C.t(p.grade)) + ' · ' : ''}${p.level ? C.t('level', { n: p.level }) : ''}</small></span><span class="val">${val}</span></div>`;
      if (ptab === 'clear') {
        h += `<div class="lp-sel">${C.T.difficulties.map((d) => `<button type="button" class="${rdiff === d.id ? 'on' : ''}" data-rdiff="${d.id}">${esc(d.name)}</button>`).join('')}</div>`;
        const r = await C.api('/api/rank?type=clear&diff=' + rdiff); list = r.list || [];
        h += list.map((c, i) => `<div class="lp-row"><span class="no">${i + 1}</span><img alt="" src="${iconSrc(c.members[0] && c.members[0].icon)}"><span class="who"><span class="lp-party">${c.members.map((m) => `<span><img alt="" src="${iconSrc(m.icon)}">${esc(m.nick)}</span>`).join('')}</span><small>${c.mut ? esc(((C.T.difficulties.find((d) => d.id === 'nightmare') || {}).name || '') + ' +' + c.mut) : ''}</small></span><span class="val">${C.clock(c.time)}</span></div>`).join('');
      } else if (ptab === 'imm') {
        const imms = C.T.units.filter((d) => d.tier === 10);
        h += `<div class="lp-sel">${imms.map((d) => `<button type="button" class="${rimm === d.id ? 'on' : ''}" data-rimm="${d.id}">${esc(d.name)}</button>`).join('')}</div>`;
        const r = await C.api('/api/rank?type=imm&id=' + rimm); list = r.list || [];
        h += list.map((p, i) => row(i, p, L('times', { n: p.n }))).join('');
      } else {
        const r = await C.api('/api/rank?type=level'); list = r.list || [];
        h += list.map((p, i) => row(i, p, C.t('level', { n: p.level }))).join('');
      }
      if (!list.length) h += `<div class="lp-note">${L('empty')}</div>`;
      if (panel === 'rank') body.innerHTML = h;
    }
  }
  async function buy(id) {
    const r = await C.api('/api/buy', { item: id });
    if (r.me) { C.ACC.me = r.me; C.saveAcc(); renderTop(); renderPanel(); } else toast(r.error === 'coins' ? L('noCoins') : C.errText(r.error));
  }
  async function equip(kind, id, unit) {
    const me = C.ACC.me;
    if (kind === 'skin' && me.skins && me.skins[unit] === id.slice(5)) id = ''; // 장착 중이면 해제
    const r = await C.api('/api/equip', { kind, id, unit });
    if (r.me) { C.ACC.me = r.me; C.saveAcc(); renderTop(); if (kind === 'map') C.repaintMap(); renderPanel(); C.refreshAcc(); } else toast(C.errText(r.error));
  }

  // ---------- 전투 시작 단계 ----------
  let step = null, painted = 'spring';
  const ORDER = () => (C.cfg.play !== 'online' ? ['play', 'mode', 'diff'] : C.cfg.mode === 'quick' ? ['play', 'mode', 'diff', 'match'] : ['play', 'mode', 'room']);
  // 빠른 대전: 서버 대기열에 넣고 2초마다 확인 → 묶이면 그 방으로 들어가 방장이 시작
  let mt = null;
  function matchUI(html) { $('matchbox').innerHTML = html; }
  function stopMatch(leave) { if (mt) { clearInterval(mt.iv); if (leave && !mt.room) C.api('/api/match/leave', {}); } mt = null; }
  async function startMatch() {
    stopMatch(true);
    const diff = C.cfg.diff, cancelB = `<button class="btn" type="button" id="mcancel">${L('cancel')}</button>`;
    mt = { at: Date.now(), diff, room: null, iv: null };
    matchUI(`<div class="spin"></div><div>${L('searching', { n: 1 })}</div>${cancelB}`);
    const r = await C.api('/api/match/join', { diff });
    if (r.error) { matchUI(`<div>${esc(C.errText(r.error))}</div>${cancelB}`); return; }
    const tick = async () => {
      if (!mt) return;
      if (!mt.room) {
        const p = await C.api('/api/match/poll', {});
        if (!mt) return;
        if (p.match) { mt.room = p.match.room; mt.size = p.match.size; mt.joinAt = Date.now(); C.joinRoom(mt.room); }
        else { const late = Date.now() - mt.at > 40000; matchUI(`<div class="spin"></div><div>${L('searching', { n: p.waiting || 1 })}</div>${late ? `<div class="hint2">${L('aloneHint')}</div><button class="btn go" type="button" id="malone">${L('alone')}</button>` : ''}${cancelB}`); }
        return;
      }
      // 방에 다 모이거나 15초가 지나면 방장이 시작한다
      const l = C.getLobby(), n = l ? l.roster().length : 0;
      matchUI(`<div class="spin"></div><div>${L('entering', { a: n, b: mt.size })}</div>`);
      if (l && l.isHost() && (n >= mt.size || Date.now() - mt.joinAt > 15000) && !mt.started) { mt.started = true; l.start(mt.diff, { muts: [], mutLv: 0 }); }
    };
    mt.iv = setInterval(tick, 2000); tick();
  }
  // 위저드를 열 때마다 아무것도 고르지 않은 상태로 시작한다. 고른 항목만 표시하고, 고르기 전에는 다음으로 못 간다.
  let picked = {};
  const STEP_KEY = { play: 'play', mode: 'mode', diff: 'diff' };
  function openWizard() { step = 'play'; picked = {}; $('setup').hidden = false; C.repaintSetup && C.repaintSetup(); showStep(); }
  function closeWizard() { stopMatch(true); step = null; $('setup').hidden = true; }
  function showStep() {
    if (!step) return;
    const order = ORDER(), i = order.indexOf(step);
    document.querySelectorAll('#setup .wz').forEach((el) => el.classList.toggle('cur', el.dataset.step === step));
    $('wztitle').textContent = L({ play: 'stepPlay', mode: 'stepMode', diff: 'stepDiff', room: 'stepRoom', match: 'stepMatch' }[step]);
    markLocks();
    $('wzsteps').textContent = `${i + 1} / ${order.length}`;
    $('wzback').style.visibility = i > 0 ? 'visible' : 'hidden';
    const online = C.cfg.play === 'online', ready = !online || (C.ACC.token && C.ACC.me);
    $('wzgate').hidden = !(step === 'play' && online && !ready);
    if (!$('wzgate').hidden) $('wzgate').innerHTML = `${L('loginFirst')} <button class="btn" type="button" data-lp="account">${L('openAcc')}</button>`;
    const last = i === order.length - 1;
    const need = STEP_KEY[step], chosen = !need || picked[need];
    $('wznext').hidden = last; $('wznext').disabled = !ready || !chosen || (step === 'diff' && !diffOpen(C.cfg.diff, +C.cfg.mutLv));
    $('startbtn').hidden = !last;
    if (last && !chosen) $('startbtn').disabled = true;
    // 방에서는 방장만 난이도를 고른다(난이도 칸을 방 안으로 옮김)
    const l = C.getLobby();
    if (step === 'room') { const host = l && l.isHost(); $('wzroomdiff').hidden = !host; if (host) { $('wzroomdiff').appendChild($('diffsec')); $('wzroomdiff').appendChild($('mutbox')); } }
    else if ($('diffsec').parentElement !== $('wzdiff')) { $('wzdiff').appendChild($('diffsec')); $('wzdiff').appendChild($('mutbox')); }
    attachChat();
    // 방 만들기는 들어오자마자 방을 연다
    if (step === 'room' && C.cfg.mode === 'create' && !l && !showStep.making) { showStep.making = true; $('mk').click(); setTimeout(() => (showStep.making = false), 3000); }
  }
  function next() { const o = ORDER(), i = o.indexOf(step); if (i < o.length - 1) { step = o[i + 1]; showStep(); if (step === 'match') startMatch(); } }
  function back() { if (step === 'match') stopMatch(true); const o = ORDER(), i = o.indexOf(step); if (i > 0) { step = o[i - 1]; showStep(); } }
  // 고르기만 하고 넘어가지는 않는다(다음 버튼으로 넘어감). 싱글/온라인을 바꾸면 그 뒤 고른 것은 다시 고른다.
  function onCfg(key) {
    if (!step) return;
    picked[key] = true;
    if (key === 'play') { delete picked.mode; delete picked.diff; }
    if (key === 'mode') delete picked.diff;
    C.repaintSetup && C.repaintSetup();
    showStep();
  }
  const isPicked = (k) => !step || !!picked[k];

  // ---------- 방 채팅 ----------
  const blocked = (() => { try { return JSON.parse(localStorage.getItem('rtd-block') || '[]'); } catch (e) { return []; } })();
  const saveBlock = () => { try { localStorage.setItem('rtd-block', JSON.stringify(blocked.slice(-200))); } catch (e) { /* 저장 불가 */ } };
  let chatNet = null, seenPeers = null;
  // 차단 안내 줄에 붙는 '차단 풀기' 버튼
  const unbBtn = (n) => `<button type="button" class="unb" data-unblock="${esc(n)}">${L('unblock')}</button>`;
  // 신고·차단은 바로 실행하지 않는다. 한 번 누르면 '한 번 더'로 바뀌고 3초 안에 다시 눌러야 실행한다.
  function armed(b) {
    if (b.dataset.armed) return true;
    const label = b.textContent; b.dataset.armed = '1'; b.classList.add('arm'); b.textContent = C.t('quitAgain');
    setTimeout(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.classList.remove('arm'); b.textContent = label; } }, 3000);
    return false;
  }
  function chatLine(html) { const log = $('chatlog'); if (!log) return; log.insertAdjacentHTML('beforeend', html); while (log.children.length > 80) log.firstChild.remove(); log.scrollTop = log.scrollHeight; }
  function attachChat() {
    const l = C.getLobby();
    if (!l || l === chatNet) return;
    chatNet = l; $('chatlog').innerHTML = `<div class="sys">${L('chatRule')}</div>`; seenPeers = null;
    l.onChatNo = (d) => chatLine(`<div class="sys warn">${esc(chatNo(d))}</div>`);
    l.onChat = (d, peer) => {
      const me = l.roster().find((p) => p.me), mine = me && me.id === peer, nick = String(d.n || '?');
      if (!mine && blocked.includes(nick)) return;
      chatLine(`<div class="cl"><b>${esc(nick)}</b><span>${esc(d.x)}</span>${mine ? '' : `<span class="op"><button type="button" data-chatrep="${esc(peer)}" data-nick="${esc(nick)}" data-text="${esc(d.x)}">${L('report')}</button><button type="button" data-chatblock="${esc(nick)}">${L('block')}</button></span>`}</div>`);
    };
  }
  function watchRoster() {
    // 들어오고 나간 사람을 채팅창에 알린다
    const l = C.getLobby(); if (!l || l !== chatNet) return;
    const now = l.roster().map((p) => p.state.name).filter(Boolean);
    if (seenPeers) { now.filter((n) => !seenPeers.includes(n)).forEach((n) => chatLine(`<div class="sys">${esc(L('chatJoin', { a: n }))}</div>`)); seenPeers.filter((n) => !now.includes(n)).forEach((n) => chatLine(`<div class="sys">${esc(L('chatLeft', { a: n }))}</div>`)); }
    seenPeers = now;
  }
  const chatNo = (d) => L('no_' + (['fast', 'dup', 'ad', 'mute'].includes(d && d.why) ? d.why : 'fast'), { s: (d && d.s) || 0 });
  function sendChat() { const inp = $('chatin'), l = C.getLobby(); const v = inp.value.trim(); if (!v || !l || !l.chat) return; l.chat(v); inp.value = ''; }


  // ---------- 로비 채팅 ----------
  // 로비에 있는 동안만 연결한다(판을 시작하면 끊는다). 채널은 서버가 빈 곳으로 넣어 주고, 창의 탭으로 옮길 수 있다.
  const lc = { ws: null, id: null, ch: 0, list: [], max: 50, lines: [], retryT: null, want: false };
  const lcOpen = () => lc.ws && lc.ws.readyState === 1;
  function lcPush(o) { lc.lines.push(o); if (lc.lines.length > 80) lc.lines.shift(); lcBar(); if (panel === 'lchat') { const log = $('lclog'); if (log) { log.insertAdjacentHTML('beforeend', lcHtml(o)); while (log.children.length > 80) log.firstChild.remove(); log.scrollTop = log.scrollHeight; } } }
  const lcHtml = (o) => (o.sys ? `<div class="sys${o.warn ? ' warn' : ''}">${esc(o.sys)}${o.unb != null ? unbBtn(o.unb) : ''}</div>`
    : `<div class="cl"><b>${esc(o.n)}</b><span>${esc(o.x)}</span>${o.self ? '' : `<span class="op"><button type="button" data-lcrep="${esc(o.id)}" data-nick="${esc(o.n)}" data-text="${esc(o.x)}">${L('report')}</button><button type="button" data-chatblock="${esc(o.n)}">${L('block')}</button></span>`}</div>`);
  function lcBar() {
    const bar = $('lchatbar'); if (!bar) return;
    bar.hidden = !(C && C.ACC.token);
    if (bar.hidden) return;
    const cnt = (lc.list.find(([n]) => n === lc.ch) || [0, 0])[1];
    const last = lc.lines.filter((o) => !o.sys).slice(-1)[0];
    bar.innerHTML = `<b>${esc(lcOpen() && lc.ch ? L('lcBar', { n: lc.ch, c: cnt }) : L('lchat'))}</b><span>${last ? esc(last.n + ': ' + last.x) : ''}</span>`;
  }
  function lcConnect() {
    if (lc.ws || !C.ACC.token) return;
    const base = root.RTD_SERVER || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    let ws;
    try { ws = new WebSocket(`${base}/ws?lobby=1&t=${encodeURIComponent(C.ACC.token)}`); } catch (e) { return; }
    lc.ws = ws;
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.k === 'hello') lc.id = m.id;
      else if (m.k === 'ch') {
        const moved = m.n !== lc.ch; lc.ch = m.n; lc.list = m.list || []; lc.max = m.max || 50;
        if (moved) { lc.lines = []; if (panel === 'lchat') renderLchat(); lcPush({ sys: L('chatRule') }); lcPush({ sys: L('chEnter', { n: m.n, c: (lc.list.find(([n]) => n === m.n) || [0, 1])[1] }) }); }
        else if (panel === 'lchat') lcTabs();
        lcBar();
      } else if (m.k === 'say') { if (m.self || !blocked.includes(String(m.n))) lcPush({ id: m.id, n: String(m.n || '?'), x: String(m.x || ''), self: !!m.self }); }
      else if (m.k === 'no') lcPush({ sys: m.why === 'full' ? L('chFull') : chatNo(m), warn: 1 });
      else if (m.k === 'error') lc.want = false; // 로그인이 풀렸거나 서버가 가득 참: 다시 붙지 않는다
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (lc.ws !== ws) return;
      lc.ws = null; lc.ch = 0; lcBar(); if (panel === 'lchat') lcTabs();
      if (lc.want && !lc.retryT) lc.retryT = setTimeout(() => { lc.retryT = null; lcSync(); }, 4000);
    };
  }
  function lcClose() { const ws = lc.ws; lc.ws = null; lc.ch = 0; if (ws) { try { ws.close(); } catch (e) { /* 무시 */ } } }
  // 로비가 보이고 로그인돼 있으면 붙고, 아니면 끊는다
  let lcTok = null;
  function lcSync() {
    const t = $('title'), tok = (C && C.ACC.token) || null, on = !!(tok && t && !t.hidden);
    if (on !== lc.want || tok !== lcTok) { if (lc.want) { lcClose(); lc.lines = []; if (panel === 'lchat' && !on) closePanel(); } lc.want = on; lcTok = tok; }
    if (on && !lc.retryT) lcConnect();
    lcBar();
  }
  const lcSend = (m) => { if (lcOpen()) lc.ws.send(JSON.stringify(m)); };
  function lcTabs() {
    $('lptabs').innerHTML = lcOpen() ? lc.list.map(([n, c]) => `<button type="button" class="${n === lc.ch ? 'on' : ''}" data-lch="${n}">${esc(L('chN', { n }))} <small>${c}/${lc.max}</small></button>`).join('') : `<span class="lcwait">${L('lcWait')}</span>`;
  }
  function renderLchat() {
    lcTabs();
    $('lpbody').innerHTML = `<div id="lchat"><div id="lclog" class="chatlog">${lc.lines.map(lcHtml).join('')}</div><div class="inline"><input id="lcin" maxlength="80" enterkeyhint="send" placeholder="${esc(L('lcPh'))}"><button class="btn" id="lcsend" type="button">${L('lcSend')}</button></div></div>`;
    const log = $('lclog'); log.scrollTop = log.scrollHeight;
    const say = () => { const inp = $('lcin'), v = inp.value.trim(); if (!v || !lcOpen()) return; lcSend({ k: 'say', x: v }); inp.value = ''; };
    $('lcsend').onclick = say; $('lcin').addEventListener('keydown', (e) => { if (e.key === 'Enter') say(); });
    lcSend({ k: 'ch' }); // 채널 인원을 새로 받는다
  }

  // ---------- 시작 ----------
  function init(ctx) {
    C = ctx;
    $('battlebtn').onclick = openWizard;
    $('wzclose').onclick = closeWizard; $('wzback').onclick = back; $('wznext').onclick = next;
    $('lpclose').onclick = closePanel;
    setInterval(lcSync, 3000); // 로그인·로비 표시가 바뀌면 채팅 연결을 맞춘다
    $('lchar').onclick = charTap;
    $('chatsend').onclick = sendChat;
    $('chatin').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    document.addEventListener('click', (e) => {
      if ($('title').hidden) return;
      const lp = e.target.closest('[data-lp]'); if (lp) { if (!$('setup').hidden && lp.closest('#setup')) closeWizard(); openPanel(lp.dataset.lp); return; }
      const pt = e.target.closest('[data-ptab]'); if (pt) { ptab = pt.dataset.ptab; renderPanel(); return; }
      const rd = e.target.closest('[data-rdiff]'); if (rd) { rdiff = rd.dataset.rdiff; renderPanel(); return; }
      const ri = e.target.closest('[data-rimm]'); if (ri) { rimm = ri.dataset.rimm; renderPanel(); return; }
      const hs = e.target.closest('[data-hs]'); if (hs) { const d = $('hsd' + hs.dataset.hs); if (d) d.hidden = !d.hidden; return; }
      if (e.target.id === 'mcancel') { stopMatch(true); back(); return; }
      if (e.target.id === 'malone') { stopMatch(true); closeWizard(); C.begin({ diff: C.cfg.diff, mode: 'solo', online: true, muts: [], mutLv: 0, key: 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); return; }
      const bb = e.target.closest('[data-buy]'); if (bb) { buy(bb.dataset.buy); return; }
      const eq = e.target.closest('[data-equip]'); if (eq) { equip(eq.dataset.equip, eq.dataset.id, eq.dataset.unit); return; }
      const rp = e.target.closest('[data-chatrep]'); if (rp) { if (!armed(rp)) return; const l = C.getLobby(); C.api('/api/report', { room: l && l.code, slot: rp.dataset.chatrep, nick: rp.dataset.nick, text: rp.dataset.text }).then(() => chatLine(`<div class="sys">${L('reported')}</div>`)); rp.disabled = true; return; }
      const lch = e.target.closest('[data-lch]'); if (lch) { lcSend({ k: 'ch', n: +lch.dataset.lch }); return; }
      const lrp = e.target.closest('[data-lcrep]'); if (lrp) { if (!armed(lrp)) return; C.api('/api/report', { room: '#lobby', slot: lrp.dataset.lcrep, nick: lrp.dataset.nick, text: lrp.dataset.text }).then(() => lcPush({ sys: L('reported') })); lrp.disabled = true; return; }
      const ub = e.target.closest('[data-unblock]'); if (ub) { const i = blocked.indexOf(ub.dataset.unblock); if (i >= 0) blocked.splice(i, 1); saveBlock(); ub.disabled = true; if (panel === 'settings') renderPanel(); return; }
      const bl = e.target.closest('[data-chatblock]'); if (bl && !armed(bl)) return;
      if (bl && bl.closest('#lchat')) { if (!blocked.includes(bl.dataset.chatblock)) blocked.push(bl.dataset.chatblock); saveBlock(); lc.lines = lc.lines.filter((o) => o.sys || o.self || o.n !== bl.dataset.chatblock); renderLchat(); lcPush({ sys: L('blocked'), unb: bl.dataset.chatblock }); return; }
      if (bl) { if (!blocked.includes(bl.dataset.chatblock)) blocked.push(bl.dataset.chatblock); saveBlock(); chatLine(`<div class="sys">${L('blocked')}${unbBtn(bl.dataset.chatblock)}</div>`); return; }
      if (panel === 'settings' && e.target.closest('[data-act]')) setTimeout(renderPanel, 60);
    });
    requestAnimationFrame(charLoop);
    refresh();
  }
  function refresh() {
    if (!C) return;
    renderTop(); showStep(); watchRoster();
    lcSync();
    // 생성 그림을 다 불러온 뒤 내 아이콘을 다시 그린다(먼저 그리면 옛 도형 그림이 보임)
    if (Art.ready && Art.ready.then) Art.ready.then(() => renderTop());
    const ms = (C.ACC.me && C.ACC.me.mapSkin) || 'spring'; if (ms !== painted) { painted = ms; C.repaintMap(); }
    if (panel === 'account') { C.refreshAcc(); renderPanel(); }
  }
  // 지금 장착한 지도가 그림 스킨이면 그 테마 이름(아니면 null)
  const mapTheme = () => { const me = C && C.ACC.me, p = me && me.mapSkin && SHOP.MAP_SKINS[me.mapSkin]; return p && p.theme ? p.theme : null; };
  // 테마 그림이 뒤늦게 도착하면 상점의 지도 미리보기를 다시 그린다
  if (typeof window !== 'undefined') window.addEventListener('rtd-maptheme', () => { if (panel === 'shop' && ptab === 'maps') renderPanel(); });
  root.RTD_LOBBY = { init, refresh, onCfg, picked: isPicked, tintMap, mapTheme, skinned, closeWizard, recordGame, statsOf, diffOpen: (d, m) => (C ? diffOpen(d, m) : true), close: () => { closeWizard(); closePanel(); } };
})(typeof window !== 'undefined' ? window : globalThis);
