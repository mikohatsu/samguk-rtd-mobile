// 메인 로비: 캐릭터(일러스트에 숨쉬기·살랑임·터치 반응), 상단 프로필·재화, 메뉴(상점·랭킹·계정·설정),
// 전투 시작 단계(온라인/싱글 → 모드 → 난이도 또는 방), 방 채팅(신고·차단), 스킨(장수 색·지도 색).
(function (root) {
  const SHOP = root.RTD_SHOP, Art = root.RTD_ART;
  const $ = (id) => document.getElementById(id);
  let C = null; // ui.js가 넘겨주는 도구들
  // 원보(유료 재화) 스위치: 첫 출시는 광고만이라 상점 원보 탭과 로비 위 원보 잔액을 숨긴다. 결제를 붙이면 true
  const GEMS_ON = false;
  // 빠른 대전: 이만큼 기다려도 상대가 없으면 '혼자 시작' 버튼을 보인다(ms)
  const ALONE_MS = 15000;
  const LI = () => ({ ko: 0, ja: 1, en: 2, zh: 3 }[C.I.lang] || 0);
  // 새 UI 그림(gfx/ic_*·ui_*)이 아직 없으면 <html>에 noic-<이름>을 붙인다. 그러면 CSS가 예전 글자(✕·‹·銅·報 등)나 예전 모양(조이스틱·공격 버튼)을 보인다
  if (typeof document !== 'undefined') [['coin', 'ic_coin'], ['news', 'ic_news'], ['lock', 'ic_lock'], ['close', 'ic_close'], ['back', 'ic_back'], ['gear', 'ic_gear'], ['joy', 'ui_joy'], ['knob', 'ui_knob'], ['attack', 'ic_attack']].forEach(([k, f]) => {
    const im = new Image(); im.onerror = () => document.documentElement.classList.add('noic-' + k); im.src = 'gfx/' + f + '.png';
  });
  const nm = (arr) => arr[LI()] || arr[0];
  // 로비 전용 문구 [ko, ja, en, zh]
  const S = {
    shop: ['상점', 'ショップ', 'Shop', '商店'], rank: ['랭킹', 'ランキング', 'Rankings', '排行榜'], account: ['계정', 'アカウント', 'Account', '账号'], settings: ['설정', '設定', 'Settings', '设置'],
    icons: ['아이콘', 'アイコン', 'Icons', '头像'], skins: ['장수 외형', '武将の外見', 'General skins', '武将外观'], maps: ['전장 지도', '戦場マップ', 'Battle maps', '战场地图'], gems: ['원보 충전', '元宝チャージ', 'Ingots', '元宝充值'],
    buy: ['구매', '購入', 'Buy', '购买'], equip: ['장착', '装備', 'Equip', '装备'], equipped: ['장착 중', '装備中', 'Equipped', '装备中'], unequip: ['해제', '外す', 'Remove', '卸下'], owned: ['보유', '所持', 'Owned', '已拥有'], free: ['기본', '基本', 'Default', '默认'],
    nickBadHint: ['닉네임에 쓸 수 없는 말이 있어 다른 사람에게는 ***로 보입니다. 계정 창에서 바꿔 주세요.', 'ニックネームに使えない言葉が含まれているため、他の人には *** と表示されます。アカウント画面で変更してください。', 'Your nickname contains a banned word and shows as *** to others. Please change it in Account.', '昵称含有禁用词，其他人看到的是 ***。请在账号界面修改。'],
    noCoins: ['동전이 부족합니다.', '銅銭が足りません。', 'Not enough coins.', '铜钱不足。'],
    needLogin: ['로그인하면 이용할 수 있습니다.', 'ログインすると利用できます。', 'Sign in to use this.', '登录后可使用。'],
    coinHint: ['동전은 판을 마칠 때마다 받습니다. 온라인 협동은 인원이 많을수록 더 많이 받고, 미션 보상으로도 받습니다.', '銅銭はバトルを終えるたびにもらえます。オンライン協力は人数が多いほど多くもらえ、ミッション報酬でももらえます。', 'Earn coins by finishing games. Online co-op pays more with more players, and missions pay coins too.', '每完成一局都能获得铜钱。在线合作人数越多获得越多，任务奖励也会给铜钱。'],
    // ---- 미션(2026-11-18): 일일 미션·첫 클리어 보상. 수치는 서버가 준다(/api/missions) ----
    mission: ['미션', 'ミッション', 'Missions', '任务'],
    msDaily: ['오늘의 미션', '今日のミッション', "Today's missions", '今日任务'], msFirsts: ['도전 과제', 'チャレンジ', 'Challenges', '挑战'],
    msReset: ['초기화까지 {h}시간 {m}분', 'リセットまで{h}時間{m}分', 'Resets in {h}h {m}m', '{h}小时{m}分后重置'],
    msFirst: ['{a} 첫 클리어', '{a} 初クリア', 'First clear: {a}', '首次通关{a}'], msFirstMut: ['{a} +{n} 첫 클리어', '{a}+{n} 初クリア', 'First clear: {a} +{n}', '首次通关{a}+{n}'],
    msClaim: ['받기', '受け取る', 'Claim', '领取'], msClaimed: ['받음', '受け取り済み', 'Claimed', '已领取'],
    msGot: ['동전 +{n}을 받았습니다.', '銅銭+{n}を受け取りました。', 'Received +{n} coins.', '已领取铜钱+{n}。'],
    gemHint: ['원보는 인앱 결제 준비 중입니다. 능력치에는 영향이 없는 꾸미기 전용입니다.', '元宝はアプリ内購入の準備中です。能力に影響しない見た目専用です。', 'Ingot purchases are coming soon. Cosmetics only, no stat effects.', '元宝充值准备中。仅用于外观，不影响能力。'],
    soon: ['준비 중', '準備中', 'Soon', '准备中'],
    // 장수 해금(일본어는 글꼴 부분 파일 fonts/ja-*.woff2에 이미 있는 글자만 쓴다)
    unlockTab: ['장수 해금', '武将解放', 'Unlock generals', '解锁武将'],
    shopLocked: ['쉬움 난이도를 클리어하면 상점이 열립니다', '「かんたん」をクリアするとショップが開きます', 'Clear Easy to open the Shop', '通关“简单”后开放商店'],
    shopLockShort: ['쉬움 클리어로 열림', 'かんたんクリアで開放', 'Clear Easy to open', '通关简单后开放'],
    unlockHint: ['잠긴 신화·불멸 장수는 조합할 수 없습니다(상자에서는 아이템이 나오니, 열면 바로 합성할 수 있습니다). 한 번 열면 이 계정에서 계속 나옵니다. 플레이로 모은 동전만으로도 모두 열 수 있습니다.', 'ロック中の神話・不滅の武将は合成できません（宝箱からアイテムは出るので、解放すればすぐ合成できます）。一度解放すると、このアカウントではずっと使えます。プレイで集めた銅銭だけでも全員解放できます。', 'Locked Myth/Immortal generals cannot be crafted (chests still drop their items, so unlock them to craft). Once unlocked they stay on this account. Everything can be unlocked with coins earned by playing.', '未解锁的神话·不灭武将无法合成（宝箱仍会掉落其道具，解锁后即可合成）。解锁后在本账号永久有效。只靠游戏获得的铜钱也能全部解锁。'],
    shInfo: ['안내', '説明', 'Info', '说明'],
    unlocked: ['해금됨', '解放済み', 'Unlocked', '已解锁'], unlockBtn: ['해금', '解放', 'Unlock', '解锁'], tMyth: ['신화', '神話', 'Myth', '神话'], tImm: ['불멸', '不滅', 'Immortal', '不灭'],
    adBtn: ['광고 보고 동전 +{n}', '広告を見て銅銭+{n}', 'Watch ad: +{n} coins', '看广告 铜钱+{n}'], adLeft: ['오늘 남은 횟수 {n}', '今日の残り{n}回', '{n} left today', '今日剩余{n}次'],
    adCap: ['오늘은 더 볼 수 없습니다.', '今日はこれ以上見られません。', 'No more ads today.', '今天已达上限。'], adFail: ['광고를 보여 주지 못했습니다.', '広告を表示できませんでした。', 'Could not show the ad.', '无法显示广告。'],
    iapAll: ['불멸 전원 해금', '不滅の武将を全員解放', 'Unlock all Immortals', '解锁全部不灭武将'], iapBtn: ['결제 ¥{y}', '購入 ¥{y}', 'Buy ¥{y}', '购买 ¥{y}'],
    noAds: ['광고 제거', '広告を削除', 'Remove ads', '移除广告'], noAdsOn: ['광고 제거됨', '広告削除済み', 'Ads removed', '已移除广告'],
    noAdsHint: ['판이 끝날 때 나오는 광고가 없어지고, 동전 광고는 보지 않고 바로 받습니다.', 'バトル終了時の広告がなくなり、銅銭は広告なしでそのまま受け取れます。', 'Removes the ad after each game, and coin rewards are given without watching ads.', '移除每局结束后的广告，铜钱奖励无需观看广告即可领取。'],
    adFree: ['동전 +{n} 받기', '銅銭+{n}を受け取る', 'Claim +{n} coins', '领取铜钱+{n}'],
    restore: ['결제 복원', '購入を復元', 'Restore purchases', '恢复购买'], iapFail: ['결제하지 못했습니다.', '購入できませんでした。', 'Purchase failed.', '购买失败。'],
    claimed: ['{a} 해금(이미 소환한 기록)', '{a}を解放しました（召喚済みの記録あり）', 'Unlocked {a} (summoned before)', '已解锁{a}（曾召唤过）'], unlockedNew: ['{a} 해금!', '{a}を解放しました', 'Unlocked {a}!', '已解锁{a}！'],
    // 결제 확인·복원 결과, 못 보낸 판 결과를 다시 보낸 뒤 알림
    iapWait: ['결제는 완료됐습니다. 서버 확인을 다시 시도합니다.', '購入は完了しました。サーバーでの確認をもう一度試します。', 'Your payment went through. We will retry the server check.', '付款已完成，将重新尝试服务器确认。'],
    iapLate: ['결제 확인이 끝났습니다.', '購入の確認が完了しました。', 'Your purchase has been confirmed.', '购买确认已完成。'],
    iapOther: ['이 구매는 다른 계정에 연결되어 있습니다.', 'この購入は別のアカウントに連携されています。', 'This purchase is linked to another account.', '此购买已关联到其他账号。'],
    tokusho: ['특정상거래법에 따른 표시', '特定商取引法に基づく表記', 'Specified Commercial Transactions Act notice', '特定商交易法标示'], restoreHint: ['이전에 구매한 장수 해금·광고 제거를 복원합니다.', '以前に購入した武将の解放・広告削除を復元します。', 'Restores the generals and ad removal you bought before.', '恢复以前购买的武将解锁和移除广告。'],
    restoreN: ['구매 {n}건을 복원했습니다.', '購入を{n}件復元しました。', 'Restored {n} purchase(s).', '已恢复{n}项购买。'],
    restoreNone: ['복원할 구매가 없습니다.', '復元できる購入がありません。', 'No purchases to restore.', '没有可恢复的购买。'],
    restoreFail: ['구매를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', '購入を確認できませんでした。しばらくしてからもう一度お試しください。', 'Could not check your purchases. Please try again later.', '无法确认购买，请稍后再试。'],
    resentXp: ['지난 판의 결과를 다시 보냈습니다. 경험치 +{n}', '前回のバトル結果を再送信しました。経験値 +{n}', 'Your last game result was sent again. +{n} XP', '已重新发送上一局的结果。经验 +{n}'],
    rLevel: ['계정 레벨', 'アカウントLv.', 'Account level', '账号等级'], rClear: ['최단 클리어', '最速クリア', 'Fastest clear', '最快通关'], rImm: ['불멸 소환', '不滅の召喚', 'Immortal summons', '不灭召唤'], rCoop: ['온라인 협동', 'オンライン協力', 'Online co-op', '在线协作'], rSolo: ['솔로', 'ソロ', 'Solo', '单人'],
    times: ['{n}회', '{n}回', '×{n}', '{n}次'], empty: ['아직 기록이 없습니다.', 'まだ記録がありません。', 'No records yet.', '暂无记录。'],
    rankNoteClear: ['온라인 협동(2인 이상)과 솔로(혼자·AI 동맹)로 나뉩니다.', 'オンライン協力（2人以上）とソロ（ひとり・AI同盟）に分かれます。', 'Split into online co-op (2+ players) and solo (alone or with AI allies).', '分为在线协作（2人以上）和单人（独自或AI同盟）。'],
    rankNoteImm: ['온라인 판만 기록됩니다.', 'オンラインバトルのみ記録されます。', 'Online games only.', '仅记录在线对局。'],
    icon: ['아이콘', 'アイコン', 'Icon', '头像'], iconPick: ['아이콘 바꾸기', 'アイコン変更', 'Change icon', '更换头像'],
    language: ['언어', '言語', 'Language', '语言'],
    history: ['전적', '戦績', 'Records', '战绩'], totalPlays: ['전체 판', '総プレイ', 'Games', '总局数'], hsClears: ['클리어 / 판', 'クリア / 回数', 'clears / games', '通关 / 局数'], hsNone: ['아직 안 함', '未プレイ', 'Not played', '未游玩'],
    recent: ['최근 20판 (누르면 자세히)', '直近20回（タップすると詳細）', 'Last 20 games (tap for details)', '最近20局（点击查看详情）'], win: ['승리', '勝利', 'Win', '胜利'], lose: ['패배', '敗北', 'Loss', '失败'],
    mythGot: ['신화 이상 소환', '神話以上の召喚', 'Myth+ summoned', '神话以上召唤'], noMyth: ['없음', 'なし', 'None', '无'], offlineTag: ['오프라인', 'オフライン', 'Offline', '离线'], tagSolo: ['싱글', 'シングル', 'Solo', '单人'], tagAi: ['AI 동맹', 'AI同盟', 'AI allies', 'AI同盟'], tagRoom: ['협동', '協力', 'Co-op', '合作'], onlineTag: ['온라인', 'オンライン', 'Online', '在线'],
    histLocal: ['로그인하지 않은 기록은 이 기기에만 저장됩니다.', 'ログインしていない記録はこの端末にだけ保存されます。', 'Records made while signed out stay on this device.', '未登录时的记录只保存在本设备。'],
    st_kills: ['처치', '撃破', 'Kills', '击杀'], st_mid: ['중간보스 토벌/놓침', '中ボス 討伐/逃し', 'Mid-bosses won/missed', '中首领 讨伐/逃脱'], st_life: ['잃은 라이프', '失ったライフ', 'Lives lost', '损失生命'], st_gold: ['번 금화', '獲得金貨', 'Gold earned', '获得金币'],
    st_comb: ['합성 · 조합', '合成・レシピ', 'Combines · Crafts', '合成·配方'], st_tix: ['선택권 · 상자', '選択券・宝箱', 'Tickets · Chests', '选择券·宝箱'], st_boss: ['보스 토벌/도전', 'ボス 討伐/挑戦', 'Bosses won/fought', '首领 击败/挑战'], st_fast: ['빠른 클리어', '速攻', 'Fast clears', '速通'],
    locked: ['{a} 클리어 필요', '{a}クリアが必要', 'Clear {a} first', '需先通关{a}'], lockedMut: ['악몽 +{n} 클리어 필요', '悪夢+{n}クリアが必要', 'Clear Nightmare +{n} first', '需先通关噩梦+{n}'],
    stepMatch: ['빠른 대전', 'クイックマッチ', 'Quick match', '快速匹配'], searching: ['같은 난이도 상대를 찾는 중… (대기 {n}명)', '同じ難易度の相手を探しています…（待機{n}人）', 'Finding players… ({n} waiting)', '正在寻找同难度玩家…（等待{n}人）'],
    entering: ['방에 들어가는 중… ({a}/{b})', 'ルームに入っています…（{a}/{b}）', 'Joining room… ({a}/{b})', '正在进入房间…（{a}/{b}）'], cancel: ['취소', 'キャンセル', 'Cancel', '取消'], alone: ['혼자 시작', 'ひとりで開始', 'Start alone', '独自开始'], aloneHint: ['찾는 사람이 적습니다. 혼자 시작해도 기록은 남습니다.', '相手が少ないようです。ひとりで始めても記録は残ります。', 'Few players right now. Starting alone still counts.', '当前玩家较少，独自开始也会记录。'],
    stepPlay: ['어디서 싸울까요?', 'どこで戦いますか？', 'Where to fight?', '在哪里作战？'], stepMode: ['모드 선택', 'モード選択', 'Choose mode', '选择模式'], stepDiff: ['난이도 선택', '難易度選択', 'Choose difficulty', '选择难度'], stepRoom: ['협동 방', '協力ルーム', 'Co-op room', '合作房间'],
    singleWord: ['싱글', 'シングル', 'Single', '单人'],
    loginFirst: ['온라인은 로그인이 필요합니다.', 'オンラインはログインが必要です。', 'Online play requires signing in.', '在线模式需要登录。'], openAcc: ['계정 열기', 'アカウントを開く', 'Open account', '打开账号'],
    chatJoin: ['{a} 님이 들어왔습니다.', '{a}さんが入室しました。', '{a} joined.', '{a} 加入了。'], chatLeft: ['{a} 님이 나갔습니다.', '{a}さんが退室しました。', '{a} left.', '{a} 离开了。'],
    report: ['신고', '通報', 'Report', '举报'], block: ['차단', 'ブロック', 'Block', '屏蔽'], unblock: ['차단 풀기', 'ブロック解除', 'Unblock', '解除屏蔽'], reported: ['신고했습니다. 운영자가 확인합니다.', '通報しました。運営が確認します。', 'Reported. We will review it.', '已举报，运营将核实。'], blocked: ['차단한 사람의 채팅은 보이지 않습니다.', 'ブロックした人のチャットは表示されません。', "Blocked players' messages are hidden.", '已屏蔽该玩家的聊天。'],
    chatRule: ['욕설은 가려지고 광고·도배는 차단됩니다. 신고된 채팅은 운영자가 확인합니다.', '暴言は伏せ字になり、広告・連投はブロックされます。通報されたチャットは運営が確認します。', 'Abusive words are masked; ads and spam are blocked. Reported messages are reviewed.', '脏话会被屏蔽，广告和刷屏会被拦截。被举报的聊天由管理员审核。'],
    lchat: ['로비 채팅', 'ロビーチャット', 'Lobby chat', '大厅聊天'], chN: ['채널 {n}', 'チャンネル{n}', 'Channel {n}', '频道{n}'], lcSend: ['보내기', '送信', 'Send', '发送'], lcPh: ['메시지 입력', 'メッセージを入力', 'Type a message', '输入消息'],
    chEnter: ['채널 {n}에 들어왔습니다.', 'チャンネル{n}に入りました。', 'Joined channel {n}.', '已进入频道{n}。'], chFull: ['그 채널은 가득 찼습니다.', 'そのチャンネルは満員です。', 'That channel is full.', '该频道已满。'],
    lcWait: ['채팅 서버에 연결하는 중…', 'チャットサーバーに接続中…', 'Connecting to chat…', '正在连接聊天服务器…'], lcBar: ['채팅 · 채널 {n} ({c}명)', 'チャット・チャンネル{n}（{c}人）', 'Chat · Ch {n} ({c})', '聊天·频道{n}（{c}人）'],
    no_fast: ['너무 빨리 보내고 있습니다. 잠시 뒤에 보내 주세요.', '送信が速すぎます。少し待ってから送ってください。', 'You are sending too fast. Please wait a moment.', '发送过快，请稍后再发。'],
    no_dup: ['같은 말을 연달아 보낼 수 없습니다.', '同じ内容を続けて送ることはできません。', 'You cannot send the same message twice in a row.', '不能连续发送相同内容。'],
    no_ad: ['광고·연락처·주소는 보낼 수 없습니다.', '広告・連絡先・URLは送信できません。', 'Ads, contact details and links cannot be sent.', '不能发送广告、联系方式或链接。'],
    no_mute: ['도배·광고로 채팅이 {s}초 동안 막혔습니다.', '連投・広告のため、チャットが{s}秒間制限されました。', 'Chat is muted for {s}s due to spam or ads.', '因刷屏或广告，聊天已被禁言{s}秒。'],
    no_muted: ['이용 약관 위반으로 채팅이 제한되었습니다. (약 {h}시간 남음)', '利用規約違反のため、チャット制限中です。（残り約{h}時間）', 'Your chat is restricted for violating the Terms. (about {h}h left)', '因违反使用条款，聊天已被限制。（剩余约{h}小时）'],
    no_mutedPerm: ['이용 약관 위반으로 채팅이 제한되었습니다.', '利用規約違反のため、チャット制限中です。', 'Your chat is restricted for violating the Terms.', '因违反使用条款，聊天已被限制。'],
    // ---- 출시 전 UX 점검(2026-11-18)에서 더한 문구: 한곳에 모아 둔다 ----
    loading: ['불러오는 중…', '読み込み中…', 'Loading…', '加载中…'],
    loadFail: ['불러오지 못했습니다. 인터넷 연결을 확인하세요.', '読み込めませんでした。通信状況を確認してください。', 'Could not load. Check your connection.', '加载失败，请检查网络。'],
    retry: ['다시 시도', '再試行', 'Retry', '重试'],
    histFallback: ['서버의 전적을 불러오지 못해 이 기기에 있는 기록을 보여 줍니다.', 'サーバーの戦績を読み込めなかったため、この端末の記録を表示しています。', 'Could not load server records. Showing the records on this device.', '无法加载服务器战绩，显示本设备的记录。'],
    adLoading: ['광고 불러오는 중…', '広告を読み込み中…', 'Loading ad…', '广告加载中…'],
    working: ['처리 중…', '処理中…', 'Working…', '处理中…'],
    balance: ['보유 동전 {n}', '所持 銅銭 {n}', 'Coins: {n}', '持有铜钱 {n}'],
    short: ['{n} 부족', '{n}不足', '{n} short', '还差{n}'],
    profGuest: ['로그인 안 함', '未ログイン', 'Not signed in', '未登录'],
    profTap: ['눌러서 로그인', 'タップしてログイン', 'Tap to sign in', '点击登录'],
    matchRetry: ['다시 찾기', 'もう一度探す', 'Search again', '重新匹配'],
    tapLines: [['오늘도 출진하시나요?', '今日も出陣されますか？', 'Heading out to battle today?', '今天也要出征吗？'], ['연환계라면 제게 맡기세요.', '連環の計なら私にお任せを。', 'Leave the chain stratagem to me.', '连环计就交给我吧。'], ['천하는 넓고, 영웅은 많지요.', '天下は広く、英雄は多いもの。', 'The realm is wide, and heroes are many.', '天下之大，英雄辈出。'], ['너무 빤히 보시면… 부끄러워요.', 'そんなに見つめられると…恥ずかしいです。', "Don't stare so… it's embarrassing.", '这样盯着看……人家会害羞的。']],
  };
  const L = (k, v) => { let s = nm(S[k] || [k]); if (v) Object.keys(v).forEach((x) => (s = s.split('{' + x + '}').join(v[x]))); return s; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 관직 표기 "계급명 등급"(예: 百人隊長 3, 2026-11-25 economy-v2). progression.js가 없으면 계급명만
  const rkLabel = (key, lv) => (root.RTD_PROG ? root.RTD_PROG.label(C.t, key, lv | 0) : C.t(key));

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
  let sayT = 0, hop = 0, lineI = 0, charLast = 0;
  // 높이(0 = 머리, 1 = 발)에서의 좌우 살랑임(px). 위로 갈수록 크게
  const swayAt = (t, f, dpr) => { const k = 1 - f; return Math.sin(t * 1.1 + f * 4.5) * 5 * dpr * k * k + Math.sin(t * 2.3) * 1.2 * dpr * k; };
  function charLoop(now) {
    requestAnimationFrame(charLoop);
    if (sayT && now > sayT) { $('lsay').hidden = true; sayT = 0; }
    // 판 화면이거나 메뉴 창(#lpanel)·시작 단계(#setup)가 덮고 있으면 그리지 않는다(마지막 모습 그대로 둔다)
    const cv = $('lcharcv'); if (!cv || $('title').hidden || !charImg.complete || !charImg.naturalWidth) return;
    const lp = $('lpanel'), su = $('setup'); if ((lp && !lp.hidden) || (su && !su.hidden)) return;
    // 초당 약 30번만 그린다(느린 흔들림이라 60번과 차이가 거의 없다. 120Hz 화면에서도 30번)
    if (now - charLast < 30) return;
    const dtc = Math.min(0.1, Math.max(0, (now - charLast) / 1000)); charLast = now;
    const box = cv.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const x = cv.getContext('2d'), t = now / 1000;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
    // 그림 맞추기(아래 붙임)
    const ih = charImg.naturalHeight, iw = charImg.naturalWidth, sc = Math.min(H * 0.94 / ih, W * 1.0 / iw), dw = iw * sc, dh = ih * sc, ox = (W - dw) / 2, oy = H - dh;
    hop = Math.max(0, hop - dtc);
    const jump = Math.sin(Math.min(1, hop / 0.45) * Math.PI) * 16 * dpr;
    // 발밑 그림자(배경 위에 떠 보이지 않게)
    { const gx = W / 2, gy = H - dh * 0.035, rw = dw * 0.34, sh2 = x.createRadialGradient(gx, gy, 0, gx, gy, rw); sh2.addColorStop(0, 'rgba(30,12,6,.5)'); sh2.addColorStop(1, 'rgba(30,12,6,0)'); x.save(); x.translate(0, gy); x.scale(1, 0.22); x.translate(0, -gy); x.fillStyle = sh2; x.fillRect(gx - rw, gy - rw, rw * 2, rw * 2); x.restore(); }
    // 가로 띠로 잘라 위로 갈수록 살랑이게, 가슴 높이는 숨쉬듯 아주 조금 부풀었다 가라앉게.
    // 띠는 30개. 각 띠를 위·아래 끝의 살랑임 값에 맞춰 기울여(평행사변형) 그리므로 띠 사이 경계가 계단지지 않고 이어진다(예전 평평한 띠 90개보다 매끈하다).
    const N = 30, sh = ih / N, hd = sh * sc;
    for (let i = 0; i < N; i++) {
      const f0 = i / N, s0 = swayAt(t, f0, dpr), s1 = swayAt(t, (i + 1) / N, dpr);
      const torso = f0 > 0.22 && f0 < 0.45 ? 1 : 0;
      const breathe = 1 + torso * Math.sin(t * 2.1) * 0.012;
      const yy = oy + i * sh * sc - jump, c = (s1 - s0) / hd;
      x.setTransform(1, 0, c, 1, -c * yy, 0);
      x.drawImage(charImg, 0, i * sh, iw, sh + 0.6, ox + s0 - (breathe - 1) * dw / 2, yy, dw * breathe, hd + 0.6);
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
  }
  function charTap() {
    hop = 0.45; const lines = S.tapLines; lineI = (lineI + 1) % lines.length;
    const el = $('lsay'); el.textContent = nm(lines[lineI]); el.hidden = false; sayT = performance.now() + 3200;
  }

  // ms: 보이는 시간(기본 2.6초. 긴 안내는 길게)
  function toast(txt, ms) {
    let el = $('ltoast'); if (!el) { el = document.createElement('div'); el.id = 'ltoast'; $('title').appendChild(el); }
    el.textContent = txt; el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), ms || 2600);
  }
  // ---------- 전적과 난이도 해금 ----------
  const DIFFS = ['easy', 'normal', 'hard', 'nightmare'];
  const loadJ = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const saveJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 */ } };
  // 해금 진행도(2026-11-26 secure-a, SEC-005): 로그인한 계정은 서버 계정 기록(me.prog)만 쓴다. 기기 기록(rtd-prog)은 계정이 없는 기기에서만.
  // 서버가 아직 받지 않은 판(보류 중·끊김)으로는 잠금을 풀지 않는다. 서버가 받으면 답(me)으로 바로 열린다.
  // 상점은 쉬움을 처음 클리어하면 열린다
  const shopOpen = () => !!C && prog().clr >= 0;
  const signedIn = () => !!(C && C.ACC.token && C.ACC.me);
  // 기기에 남기는 판 수·클리어 수(전적 창이 서버 전적을 못 불러올 때 대신 보이는 값). 계정마다 따로(계정을 바꿔도 섞이지 않게)
  const progKey = () => (signedIn() ? 'rtd-prog@' + C.ACC.me.id : 'rtd-prog');
  // 이어하기 판의 표(rtd-save-tk): { u: 계정, tk: 표, s: 씨앗 }. 예전 앱은 표 글자만 두었다(legacy: 그대로 받아 끝까지 보고한다)
  function readSaveTk() {
    let raw = null; try { raw = localStorage.getItem('rtd-save-tk'); } catch (e) { return null; }
    if (!raw) return null;
    if (raw[0] !== '{') return { u: null, tk: raw, legacy: true };
    try { const o = JSON.parse(raw); return o && typeof o.tk === 'string' ? o : null; } catch (e) { return null; }
  }
  // tk가 없으면 지운다(새 혼자 판이 시작될 때 앞 판의 표가 새 판에 붙지 않게)
  function writeSaveTk(tk, seed) {
    try { if (tk && signedIn()) localStorage.setItem('rtd-save-tk', JSON.stringify({ u: C.ACC.me.id, tk, s: seed || 0 })); else localStorage.removeItem('rtd-save-tk'); } catch (e) { /* 저장 불가 */ }
  }
  // 첫 신화 2명을 이미 받았는지(로그인: 계정 보유 목록, 아니면 이 기기의 rtd-starter)
  const hasStarter = () => { if (!C) return true; const me = C.ACC.me; if (me && C.ACC.token) return (me.owned || []).includes(UL().starterKey); return loadJ('rtd-starter', []).length > 0; };
  function prog() {
    if (signedIn()) { const a = C.ACC.me.prog || {}; return { clr: a.clr == null ? -1 : a.clr, nmx: a.nmx == null ? -1 : a.nmx }; }
    const l = loadJ('rtd-prog', { clr: -1, nmx: -1 });
    return { clr: l.clr == null ? -1 : l.clr, nmx: l.nmx == null ? -1 : l.nmx };
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
  // 판이 끝날 때: 기기에 남긴다(전적 창의 대신 보이는 기록). 서버 보고는 18-account.js reportResult가 한다.
  // 로그인한 계정이면 판 수·클리어 수만 그 계정 칸에 남기고 난이도 해금(clr·nmx)은 올리지 않는다(해금은 서버 답으로만, SEC-005)
  function recordGame(g, online, mode, ticket) {
    if (g.trial) return; // 체험은 전적을 남기지 않는다(rtd-hist의 myth는 로그인 안 한 기기의 해금 근거라 체험 장수가 열려 버린다)
    const rec = { at: Date.now(), diff: g.diff.id, mut: g.mutLv || 0, mutLv: g.mutLv || 0, round: g.resultRound || g.round, win: g.over === 'win', time: Math.round(g.time), online: !!online, mode, myth: (g.stats && g.stats.myth) || {}, st: statsOf(g) };
    const h = loadJ('rtd-hist', []); h.unshift(rec); saveJ('rtd-hist', h.slice(0, 20));
    const acct = signedIn(), k = progKey(), p = loadJ(k, { clr: -1, nmx: -1, plays: {}, clears: {} });
    p.plays = p.plays || {}; p.clears = p.clears || {};
    p.plays[rec.diff] = (p.plays[rec.diff] || 0) + 1;
    if (rec.win) { p.clears[rec.diff] = (p.clears[rec.diff] || 0) + 1; if (!acct) { p.clr = Math.max(p.clr, DIFFS.indexOf(rec.diff)); if (rec.diff === 'nightmare') p.nmx = Math.max(p.nmx, rec.mut); } }
    saveJ(k, p);
    // 서버 보고는 18-account.js reportResult가 한다(오프라인 판도 /api/history로 경험치·동전을 받는다)
  }
  // ---------- 못 보낸 판 결과 다시 보내기 ----------
  // 판이 끝날 때 서버에 닿지 못하면(끊김 = status 0, 서버 오류 = 5xx) 보낼 내용(주소·본문, 판 표 포함)을 기기에 둔다(최대 5건, 7일 — 서버가 예전 오프라인 표를 7일 받는다.
  // 이어하기 칸 표는 서버 기한이 없지만 기기 보관은 7일로 묶는다).
  // 앱을 켤 때(19-title.js boot)와 로비 화면을 다시 그릴 때(refresh, 1분에 한 번) 그 계정으로 로그인해 있으면 다시 보낸다.
  // 서버가 200으로 답하면(보상이 0이어도) 지운다. 같은 표는 서버가 한 번만 받으므로 두 번 받는 일은 없다.
  const PEND = 'rtd-pending', PEND_MAX = 5, PEND_MS = 7 * 24 * 3600000, PEND_PATHS = ['/api/result', '/api/history'], PEND_GAP = 60000;
  const netFail = (r) => r.status === 0 || r.status >= 500;
  function queueSend(path, body, uid) {
    if (!PEND_PATHS.includes(path) || !body) return;
    const q = loadJ(PEND, []); q.push({ k: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), p: path, b: body, u: uid || null, at: Date.now() }); saveJ(PEND, q.slice(-PEND_MAX));
  }
  // 로딩 화면이 걷힌 뒤에 알린다(로딩 화면이 로비의 알림을 가린다)
  const toastLobby = (txt, ms) => { const B = $('boot'); if (B && !B.hidden) setTimeout(() => toastLobby(txt, ms), 500); else toast(txt, ms); };
  let flushing = false, flushAt = 0;
  async function flushPending() {
    const me = C && C.ACC.me; if (!me || !C.ACC.token || flushing) return;
    flushing = true; flushAt = Date.now();
    try {
      const now = Date.now(), q = loadJ(PEND, []).filter((x) => x && PEND_PATHS.includes(x.p) && x.b && now - x.at < PEND_MS);
      saveJ(PEND, q); // 7일 지난 것은 버린다
      let gained = 0;
      for (const it of q) {
        if (it.u !== me.id) continue; // 다른 계정으로 한 판은 그 계정으로 들어왔을 때 보낸다
        const r = await C.api(it.p, it.b);
        if (r.status === 0 || r.status === 401) break; // 아직 못 닿음·로그인 풀림: 다음에
        if (r.status >= 500 || r.status === 429) continue; // 서버 오류·너무 잦음: 남겨 두고 다음에
        saveJ(PEND, loadJ(PEND, []).filter((x) => x && x.k !== it.k));
        if (r.me) { C.ACC.me = r.me; C.saveAcc(); if (r.gained > 0) gained += r.gained; }
      }
      await iapFlush();
      renderTop();
      if (gained > 0) toastLobby(L('resentXp', { n: gained }));
    } finally { flushing = false; }
  }
  // ---------- 계정 진행 새로 받기(2026-11-26 secure-a) ----------
  // 로비에 들어올 때(refresh)·다시 연결될 때 /api/me를 1분에 한 번까지 다시 받는다(다른 기기에서 오른 진행, 회수 결과가 반영된다).
  // 답에 회수 알림(revoked)이 있으면 한 번 알리고 서버에 봤다고 알린다. 업데이트 직후, 기기 기록으로만 열려 있던 난이도가 다시 잠긴 사람에게 한 번 안내.
  const ME_GAP = 60000; let meAt = 0, meBusy = false;
  function onMe(r) {
    if (!C || !r || !r.me) return;
    meAt = Date.now();
    if (Array.isArray(r.revoked) && r.revoked.length) {
      const xp = r.revoked.reduce((n, x) => n + (x.xp | 0), 0), coins = r.revoked.reduce((n, x) => n + (x.coins | 0), 0);
      toastLobby(C.t('revokedNote', { n: r.revoked.length, x: xp, c: coins }), 8000);
      C.api('/api/revoked/ack', { ids: r.revoked.map((x) => x.id) });
    }
    // 예전 기기 기록(rtd-prog)이 계정보다 앞서 있던 기기: 한 번만 안내('rtd-locksrc'). 기기 값을 서버에 올리지는 않는다(조작한 기기 값으로 해금되는 길이 된다)
    let seen = '1'; try { seen = localStorage.getItem('rtd-locksrc'); } catch (e) { /* 저장 불가 */ }
    if (!seen) {
      const l = loadJ('rtd-prog', { clr: -1, nmx: -1 }), a = r.me.prog || {}, n = (v) => (v == null ? -1 : v);
      try { localStorage.setItem('rtd-locksrc', '1'); } catch (e) { /* 저장 불가 */ }
      if (n(l.clr) > n(a.clr) || n(l.nmx) > n(a.nmx)) toastLobby(C.t('lockSrcNote'), 8000);
    }
  }
  async function syncMe(force) {
    if (!C || !C.ACC.token || meBusy || (!force && Date.now() - meAt < ME_GAP)) return;
    meBusy = true; meAt = Date.now();
    try {
      const before = JSON.stringify(prog()), r = await C.api('/api/me');
      if (!r.me) return;
      C.ACC.me = r.me; C.saveAcc(); onMe(r); renderTop();
      if (JSON.stringify(prog()) !== before && $('title') && !$('title').hidden) { if (C.repaintSetup) C.repaintSetup(); else markLocks(); }
    } finally { meBusy = false; }
  }
  // 서버에 아직 닿지 못한 이긴 판(보류 중)이 이 난이도를 열 판인지: 잠금 글을 '서버 확인 중'으로 바꿔 보인다(잠금은 풀지 않는다)
  const pendingOpens = (i) => { const me = signedIn() && C.ACC.me; return !!me && loadJ(PEND, []).some((x) => x && x.u === me.id && x.b && x.b.win && DIFFS.indexOf(x.b.diff) >= i - 1); };
  // 난이도 버튼에 잠금 표시
  function markLocks() {
    const dname = (id) => (C.T.difficulties.find((d) => d.id === id) || {}).name || id;
    document.querySelectorAll('#diffs button[data-v]').forEach((b) => {
      const i = DIFFS.indexOf(b.dataset.v), open = diffOpen(b.dataset.v, 0), why = !open && pendingOpens(i) ? C.t('lockPending') : L('locked', { a: dname(DIFFS[i - 1]) });
      b.classList.toggle('lock', !open); b.disabled = !open;
      b.title = open ? '' : why;
      // 잠긴 난이도는 무엇을 깨면 열리는지 버튼 안에 글로 보여 준다(터치 화면에서는 title이 안 보인다)
      let lk = b.querySelector('.lk');
      if (!open) { if (!lk) { lk = document.createElement('em'); lk.className = 'lk'; b.appendChild(lk); } lk.innerHTML = '<i class="ico lock" aria-hidden="true"></i>' + esc(why); }
      else if (lk) lk.remove();
    });
    const p = prog();
    document.querySelectorAll('#mutlv button[data-v]').forEach((b) => { const n = +b.dataset.v, open = n === 0 || n <= p.nmx + 1; b.disabled = !open; b.title = open ? '' : L('lockedMut', { n: n - 1 }); });
    // 잠긴 악몽 단계가 있으면 무엇을 깨면 다음 단계가 열리는지 단계 버튼 아래에 글로 보여 준다(터치 화면에서는 title이 안 보인다)
    {
      const box = $('mutlv'), first = p.nmx + 2; let lk = box && box.querySelector('.lk');
      if (box && box.children.length && first <= 5) {
        if (!lk) { lk = document.createElement('em'); lk.className = 'lk'; box.appendChild(lk); }
        lk.innerHTML = '<i class="ico lock" aria-hidden="true"></i>' + esc(first > 1 ? L('lockedMut', { n: first - 1 }) : L('locked', { a: dname('nightmare') }));
      } else if (lk) lk.remove();
    }
    if (!diffOpen(C.cfg.diff, 0)) { const best = DIFFS.filter((d) => diffOpen(d, 0)).pop(); if (best && best !== C.cfg.diff) { C.cfg.diff = best; C.cfg.mutLv = '0'; } }
  }

  // ---------- 장수 해금 ----------
  // 지금 이용자가 연 잠금 장수 id 목록(엔진이 판을 만들 때 theme.unlock.provider로 부른다)
  // 로그인: 계정 보유 목록의 'unl_<id>'만(서버 기준). 로그인하지 않음: 마지막 로그인 때 열린 것(rtd-unl) + 이 기기에서 이미 소환한 기록(rtd-hist)
  const UL = () => (root.RTD_THEME || (C && C.T) || {}).unlock;
  const unitOf = (id) => C.T.units.find((d) => d.id === id) || {};
  function unlockedList() {
    const U = UL(); if (!U || !C) return null;
    const me = C.ACC.me, locked = U.lockedIds();
    if (me) { const l = locked.filter((id) => (me.owned || []).includes(U.key(id))); saveJ('rtd-unl', l); return l; }
    const l = new Set(loadJ('rtd-unl', []).concat(loadJ('rtd-starter', []))); loadJ('rtd-hist', []).forEach((h) => Object.keys((h && h.myth) || {}).forEach((id) => l.add(id)));
    return locked.filter((id) => l.has(id));
  }
  // (소급 해금은 2026-11-18에 없앴다: 기기가 보낸 전적이 근거라 조작할 수 있었다)
  let claimedFor = null, adLeft = null;
  async function claimOld() {
    const me = C.ACC.me; if (!me || !C.ACC.token || claimedFor === me.id) return;
    claimedFor = me.id;
    // 이 기기에서 튜토리얼을 이미 마쳤는데 계정에 첫 신화가 없으면(로그인 전에 받은 경우) 같은 장수로 이어 준다
    if ((shopOpen() || loadJ('rtd-starter', []).length) && !(C.ACC.me.owned || []).includes(UL().starterKey)) await grantStarter();
    if (panel === 'shop') renderPanel();
  }
  // 첫 신화 2명(튜토리얼을 마치거나 건너뛰면). 돌려주는 값: 이번에 새로 연 신화 id 목록(이미 받았으면 []).
  // 로그인 전이면 이 기기에만 기록하고(rtd-starter), 나중에 로그인하면 서버가 같은 장수로 이어 준다.
  async function grantStarter() {
    const U = UL(); if (!U || !C) return [];
    const local = loadJ('rtd-starter', []);
    if (C.ACC.me && C.ACC.token) {
      if ((C.ACC.me.owned || []).includes(U.starterKey)) return [];
      const r = await C.api('/api/unlock/starter', { want: local });
      if (!r.me) return [];
      C.ACC.me = r.me; C.saveAcc(); saveJ('rtd-starter', local.length ? local : r.granted || []); unlockedList(); renderTop();
      return r.granted || [];
    }
    if (local.length) return [];
    const have = new Set(loadJ('rtd-unl', [])), pool = U.lockedIds().filter((id) => unitOf(id).tier === 9 && !have.has(id)), pick = [];
    while (pick.length < U.starterMyth && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    saveJ('rtd-starter', pick);
    return pick;
  }
  const afterMe = (r) => { C.ACC.me = r.me; C.saveAcc(); unlockedList(); renderTop(); renderPanel(); };
  async function unlockCoins(id) {
    const r = await C.api('/api/unlock', { id });
    if (r.me) { afterMe(r); toast(L('unlockedNew', { a: unitOf(id).name || id })); } else { toast(r.error === 'coins' ? L('noCoins') : C.errText(r.error)); renderPanel(); }
  }
  // 광고·결제 버튼: 누른 뒤 끝날 때까지 잠그고 글자로 진행을 알린다(여러 번 눌러 겹쳐 요청하지 않게). 끝나면 원래 글자로 돌린다(창을 다시 그렸으면 그대로 둔다)
  function busyBtn(b, label, pr) {
    const old = b.textContent; b.disabled = true; b.textContent = label;
    Promise.resolve(pr).catch(() => {}).then(() => { if (b.isConnected) { b.disabled = false; b.textContent = old; } });
  }
  async function watchAd() {
    const N = root.RTD_NATIVE;
    if (adLeft === 0) { toast(L('adCap')); return; }
    // 광고 제거를 산 사람은 광고 없이 바로 받는다(하루 횟수 상한은 같음)
    const me = C.ACC.me, free = !!(me && (me.owned || []).includes(UL().noAdsKey));
    if (!free) { try { await N.rewardAd(); } catch (e) { toast(L('adFail')); return; } }
    const r = await C.api('/api/ad/reward', {});
    if (r.me) { adLeft = r.left; afterMe(r); toast(L('adLeft', { n: r.left })); } else { if (r.error === 'ad_cap') adLeft = 0; toast(r.error === 'ad_cap' ? L('adCap') : C.errText(r.error)); }
  }
  // rc = 영수증 { signed }(iOS) 또는 { store: 'google', productId, token }(안드로이드)
  // 서버가 이 스토어의 영수증을 검증할 수 있을 때만 결제 버튼을 보인다(/api/iap/status). 한 번 묻고, 실패하면 다음 화면에서 다시 묻는다
  let iapSrv = null, iapAsk = null;
  function iapReady() {
    const N = root.RTD_NATIVE || {};
    if (!(N.iapOn && N.iapOn())) return false;
    if (!iapSrv && !iapAsk) iapAsk = C.api('/api/iap/status').then((r) => { if (r.status === 200) { iapSrv = r; renderPanel(); } }).finally(() => { iapAsk = null; });
    return !!(iapSrv && iapSrv[N.droid ? 'google' : 'apple']);
  }
  async function iapSend(rc) { const r = await C.api('/api/iap/verify', rc); if (r.me) afterMe(r); return r; }
  // 스토어 결제는 끝났는데 서버 확인이 안 된 영수증(끊김·5xx·503 등)은 기기에 두고, 앱을 켤 때와 상점을 열 때 다시 보낸다.
  // 서버가 받았거나(200) 받을 수 없다고 답하면(400 bad_receipt·bad_item, 409 other_account) 지운다.
  const IAPP = 'rtd-iap-pending', IAPP_MAX = 10;
  const rcKey = (rc) => JSON.stringify(rc);
  const iapKeep = (rc, uid) => { const q = loadJ(IAPP, []), k = rcKey(rc); if (!q.some((x) => x && rcKey(x.rc) === k)) q.push({ rc, u: uid || null, at: Date.now() }); saveJ(IAPP, q.slice(-IAPP_MAX)); };
  const iapDrop = (rc) => { const k = rcKey(rc); saveJ(IAPP, loadJ(IAPP, []).filter((x) => x && rcKey(x.rc) !== k)); };
  const iapFinal = (r) => r.status === 200 || r.status === 400 || r.status === 409;
  let iapFlushing = false;
  async function iapFlush() {
    const me = C && C.ACC.me; if (!me || !C.ACC.token || iapFlushing) return;
    const q = loadJ(IAPP, []).filter((x) => x && x.rc && x.u === me.id); // 결제한 계정으로 들어와 있을 때만
    if (!q.length) return;
    iapFlushing = true;
    try {
      let n = 0;
      for (const it of q) {
        const r = await iapSend(it.rc);
        if (r.me) n++;
        if (iapFinal(r)) iapDrop(it.rc); else if (r.status === 0 || r.status === 401) break;
      }
      if (n) toastLobby(L('iapLate'));
    } finally { iapFlushing = false; }
  }
  async function iapBuy(pid) {
    let rc; try { rc = await root.RTD_NATIVE.iapBuy(pid); } catch (e) { if (!/cancel/i.test(String(e && e.message))) toast(L('iapFail')); return; }
    const uid = C.ACC.me && C.ACC.me.id, r = await iapSend(rc);
    if (r.me) { toast(L('unlocked')); return; }
    if (iapFinal(r)) { toast(r.error === 'other_account' ? L('iapOther') : L('iapFail')); return; }
    // 돈은 나갔는데 서버 확인만 못 했다: 영수증을 남겨 두고 다시 보낸다
    iapKeep(rc, uid); toast(L('iapWait'));
  }
  // 복원 결과를 실제대로 알린다: 복원된 건수 / 복원할 것이 없음 / 다른 계정에 연결된 구매 / 서버 확인 실패
  async function iapRestore() {
    let list = []; try { list = await root.RTD_NATIVE.iapRestore(); } catch (e) { toast(L('iapFail')); return; }
    let n = 0, other = false, down = false;
    for (const s of list) { const r = await iapSend(s); if (r.me) n++; else if (r.status === 409) other = true; else if (r.status !== 400) down = true; }
    toast(n ? L('restoreN', { n }) : other ? L('iapOther') : down ? L('restoreFail') : L('restoreNone'));
  }
  // 서버의 법률 문서 링크(계정 창의 약관 링크와 같은 방식: 18-account.js의 API = window.RTD_API). 새 창 → 앱에서는 native.js가 앱 안 브라우저로 연다
  const legalLink = (page, label) => `<a href="${root.RTD_API || ''}/${page}?lang=${C.I.lang}" target="_blank" rel="noopener" style="color:inherit;display:inline-block;padding:10px 2px">${label}</a>`;
  // 설정 창의 구매 복원 줄(상점은 쉬움을 깨야 열리므로 설정에도 둔다). 앱이고 결제가 켜져 있을 때만 보이고, 로그인 전에는 버튼 대신 안내만
  const restoreRow = () => (iapReady() ? `<div class="setlist"><div class="h">${L('restore')}</div><div class="row"><div><small>${L('restoreHint')}</small></div>${C.ACC.me && C.ACC.token ? `<button type="button" class="toggle" data-iaprestore="1">${L('restore')}</button>` : `<small>${L('needLogin')}</small>`}</div></div>` : '');
  // ---------- 상점 카드(2026-11-25 다듬기: 글 대신 그림·배지) ----------
  // 카드 = 그림(주인공) + 이름 한 줄 + 아래 버튼 한 줄. 등급(신화·불멸)은 카드 틀 색, 상태는 배지(장착 ✓·부족 금액). 잠긴 장수는 원화를 흑백으로(자물쇠 그림 없음, 2026-11-25 실기 소감) — 해금되면 컬러.
  // 동전 가격 버튼 = 동사(구매·해금) + 동전 + 숫자. 셋을 한 줄 글(.sh-pr)로 묶어 기준선이 맞게 한다(정렬 점검 2026-11-25). 체험 버튼 옆(좁음)에서는 동사가 윗줄.
  const coinTag = (n) => `<i class="ico coin" aria-hidden="true"></i><b>${(n || 0).toLocaleString()}</b>`;
  const priceBtn = (attr, cost, verb, me) => `<button class="sh-buy${me.coins < cost ? ' short' : ''}" type="button" ${attr} ${me.coins < cost ? 'disabled' : ''} aria-label="${esc(verb)} ${cost}" title="${esc(verb)}"><span class="sh-pr"><span class="sh-vb">${esc(verb)}</span>${coinTag(cost)}</span></button>`;
  // o: { cls, id(체험 반짝임용 data-card), art(그림 html), rk(등급·기본 표시), st('on' = 장착 배지), short(부족 금액), name, foot(버튼 html) }
  const shCard = (o) => `<div class="sh-card ${o.cls || ''}"${o.id ? ` data-card="${o.id}"` : ''}><div class="sh-art">${o.art}${o.rk ? `<span class="sh-rk">${o.rk}</span>` : ''}${o.st === 'on' ? '<i class="sh-st on" aria-hidden="true">✓</i>' : ''}${o.short ? `<span class="sh-short">${L('short', { n: o.short.toLocaleString() })}</span>` : ''}</div><span class="sh-nm">${o.name}</span><div class="sh-ft">${o.foot}</div></div>`;
  // 장수 해금 카드 그림: 원화 축소본(gfx/ilt_*, 원본 il_*에서 잘라 줄임). 원화가 없는 장수는 SD 초상
  const heroArt = (d) => { const v = (C.T.illusts || {})[d.id]; return v ? `<img class="il" alt="" loading="lazy" decoding="async" src="gfx/ilt_${d.id}.jpg?v=${v}">` : `<img class="sd" alt="" src="${Art.portrait(d)}">`; };
  function unlockHtml(me) {
    const U = UL(), N = root.RTD_NATIVE || {}, iap = iapReady(), owns = (id) => (me.owned || []).includes(U.key(id));
    let h = '', bar = '';
    // 광고·결제 버튼은 앱에서만(웹 브라우저에서는 RTD_NATIVE.on이 false라 숨는다)
    if (N.rewardOn && N.rewardOn()) bar += `<button class="sh-offer go" type="button" data-adrw="1">${L((me.owned || []).includes(U.noAdsKey) ? 'adFree' : 'adBtn', { n: U.ad.coins })}${adLeft != null ? ' <small>' + L('adLeft', { n: adLeft }) + '</small>' : ''}</button>`;
    if (iap && U.lockedIds().some((id) => unitOf(id).tier === 10 && !owns(id))) bar += `<button class="sh-offer" type="button" data-iap="${U.iap.all10[0]}">${L('iapAll')} <b>¥${U.iap.all10[1].toLocaleString('en-US')}</b></button>`;
    if (iap) { const nk = U.noAdsKey, np = U.iap.noads; bar += (me.owned || []).includes(nk) ? `<span class="sh-offer done">✓ ${L('noAdsOn')}</span>` : `<button class="sh-offer" type="button" data-iap="${np[0]}" title="${L('noAdsHint')}">${L('noAds')} <b>¥${np[1].toLocaleString('en-US')}</b></button>`; }
    if (iap) bar += `<button class="sh-offer sub" type="button" data-iaprestore="1">${L('restore')}</button>`;
    if (bar) h += `<div class="sh-offers">${bar}</div>`;
    h += `<div class="sh-grid">${U.lockedIds().map((id) => {
      const d = unitOf(id), own = owns(id), cost = U.coins[d.tier], ip = U.iap[d.tier], imm = d.tier === 10;
      // 체험(2026-11-25): 잠긴 카드마다. 무료·무제한, 확인 창 없음(잃는 것이 없다)
      const foot = own ? `<span class="sh-done">✓ ${L('unlocked')}</span>`
        : `<button class="sh-try" type="button" data-trial="${id}">${esc(C.t('trialBtn'))}</button>${priceBtn(`data-unl="${id}"`, cost, L('unlockBtn'), me)}` + (iap && ip ? `<button class="sh-yen" type="button" data-iap="${ip[0] + id}" aria-label="${L('iapBtn', { y: ip[1].toLocaleString('en-US') })}">¥${ip[1].toLocaleString('en-US')}</button>` : '');
      return shCard({ cls: (imm ? 'r10' : 'r9') + (own ? ' own' : ' lock') + (iap && ip && !own ? ' iap' : ''), id, art: heroArt(d), rk: L(imm ? 'tImm' : 'tMyth'), short: !own && me.coins < cost ? cost - me.coins : 0, name: esc(d.name || id), foot });
    }).join('')}</div>`;
    // 결제 버튼이 보일 때만: 특정상거래법 표시·이용약관
    if (iap) h += `<div class="sh-legal">${legalLink('tokushoho', L('tokusho'))} · ${legalLink('terms', C.t('terms'))}</div>`;
    return h;
  }

  // ---------- 상단 ----------
  const iconSrc = (id) => { const d = C.T.units.find((u) => u.id === id) || C.T.units.find((u) => u.id === 'cav'); return Art.portrait(d); };
  function renderTop() {
    { const sb = document.querySelector('#lmenu [data-lp="shop"]'); if (sb) { const lockd = !shopOpen(); sb.classList.toggle('locked', lockd); let n = sb.querySelector('.lkn'); if (lockd && !n) { n = document.createElement('small'); n.className = 'lkn'; sb.appendChild(n); } if (n) { n.hidden = !lockd; n.textContent = L('shopLockShort'); } } }
    { const nd = document.querySelector('#lnews .dot'); if (nd) nd.hidden = !(root.RTD_NEWS && root.RTD_NEWS.unseen()); }
    msDot();
    const me = C.ACC.me;
    // 금칙어 닉네임: 한 번 알려 준다(다른 사람에게는 *** 로 보임)
    if (me && me.nickBad && !renderTop.warned) { renderTop.warned = true; setTimeout(() => toast(L('nickBadHint')), 600); }
    $('lico').src = iconSrc(me ? me.icon : 'cav');
    // 로그인하지 않았으면 이름 자리에 '로그인 안 함 · 눌러서 로그인'. 인터넷이 끊겨 있으면 등급 옆에 '오프라인'
    $('lnick').textContent = me ? me.nick : L('profGuest');
    // 내 관직: 경험치에서 바로(progression.js view, 계정 카드·결과창·협동 대기 카드와 같은 값. 2026-11-26)
    $('lrank').textContent = me ? `${root.RTD_PROG ? root.RTD_PROG.view(C.t, me.track, me.xp || 0).text : rkLabel(me.grade, me.level)}${root.navigator && root.navigator.onLine === false ? ' · ' + L('offlineTag') : ''}` : L('profTap');
    $('lcur').hidden = !me;
    if (me) { $('lcoins').textContent = (me.coins || 0).toLocaleString(); $('lgems').textContent = (me.gems || 0).toLocaleString(); }
    // #lcur .cur 은 CSS가 display:flex 라 hidden 속성이 안 먹는다 → style로 숨긴다
    const gemChip = $('lgems') && $('lgems').parentElement; if (gemChip) gemChip.style.display = GEMS_ON ? '' : 'none';
  }

  // ---------- 미션(일일 미션·첫 클리어 보상) ----------
  // ms = 서버가 준 미션 상태({ daily, firsts, resetAt }). 로비에 들어올 때(로그인 계정이 바뀔 때)와 판 결과를 보낸 뒤 한 번씩 받아 빨간 점을 맞춘다.
  let ms = null, msTok = null, msSeq = 0, msFresh = false;
  const msCount = () => (ms && C.ACC.token ? ms.daily.concat(ms.firsts).filter((x) => x.done && !x.claimed).length : 0);
  function msDot() { const el = document.querySelector('#lmenu [data-lp="mission"] .dot'); if (el) el.hidden = !msCount(); msStrip(); }
  // 로비의 오늘의 미션 칸(2026-11-24): 미션 3줄과 진행. 다 깬 미션이 있으면 '받기'(다 깬 것을 한꺼번에 받는다). 칸을 누르면 미션 창
  const msDone = () => (ms && C.ACC.token ? ms.daily.filter((x) => x.done && !x.claimed) : []);
  function msStrip() {
    let el = $('lms');
    if (!ms || !C || !C.ACC.token) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'lms'; $('title').appendChild(el); }
    const ready = msDone(), got = ms.daily.filter((x) => x.claimed).length;
    el.innerHTML = `<button type="button" class="lms-head" data-lp="mission"><b>${C.t('msToday')}</b><small>${got === ms.daily.length ? C.t('msAllDone') : got + '/' + ms.daily.length}</small></button>`
      + ms.daily.map((x) => `<button type="button" class="lms-row${x.claimed ? ' got' : x.done ? ' done' : ''}" data-lp="mission"><span>${C.t('ms_' + x.id)}</span><small>${x.claimed ? '✓' : x.n + '/' + x.need}</small></button>`).join('')
      + (ready.length ? `<button type="button" class="btn go lms-claim" data-msall="1">${L('msClaim')}<small>${C.t('msRewardSum', { c: ready.reduce((a, x) => a + x.coins, 0), x: ready.reduce((a, x) => a + (x.xp || 0), 0) })}</small></button>` : '');
    el.hidden = false;
  }
  // 서버가 준 관직 승급 보상 알림(로비에 들어와 미션 상태를 받을 때·미션 경험치로 오를 때)
  function rankToast(list) {
    if (!Array.isArray(list) || !list.length) return;
    const me = C.ACC.me, trk = me && me.track === 'civ' ? 'civ' : 'mil', top = list[list.length - 1], n = list.reduce((a, x) => a + x.coins, 0);
    toastLobby(C.t('rankUpGot', { a: C.t('rk_' + trk + top.rank), n }));
  }
  async function msLoad() {
    if (!C || !C.ACC.token) { ms = null; msDot(); return false; }
    const my = ++msSeq, r = await C.api('/api/missions', {});
    if (my !== msSeq) return !!ms;
    const good = r.status === 200 && Array.isArray(r.daily) && Array.isArray(r.firsts);
    if (good) ms = { daily: r.daily, firsts: r.firsts, resetAt: r.resetAt };
    if (good && r.me && r.rankUp && r.rankUp.length) { C.ACC.me = r.me; C.saveAcc(); renderTop(); rankToast(r.rankUp); }
    msDot(); return good;
  }
  // 받을 수 있는 보상 수를 돌려준다(18-account.js가 판 결과를 보낸 뒤 부른다)
  const missionCheck = () => msLoad().then(() => msCount());
  function missionHtml() {
    const me = C.ACC.me, dn = (id) => esc((C.T.difficulties.find((d) => d.id === id) || {}).name || id);
    const left = Math.max(0, (ms.resetAt || 0) - Date.now()), hh = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000);
    const fname = (id) => { const m = /^f_nm(\d)$/.exec(id); return m ? L('msFirstMut', { a: dn('nightmare'), n: m[1] }) : L('msFirst', { a: dn(id.slice(2)) }); };
    const row = (x, name, n, need) => `<div class="ms-row${x.claimed ? ' got' : x.done ? ' done' : ''}"><span class="nm">${name}</span><span class="pg"><i class="ms-bar"><b style="width:${Math.round(Math.min(1, n / Math.max(1, need)) * 100)}%"></b></i>${n}/${need}</span><span class="rw"><i class="ico coin" aria-hidden="true"></i>${x.coins}${x.xp ? `<small class="ms-xp">+${x.xp} XP</small>` : ''}</span>${x.claimed ? `<span class="ms-got">✓ ${L('msClaimed')}</span>` : x.done ? `<button class="btn go" type="button" data-msclaim="${x.id}">${L('msClaim')}</button>` : '<span class="ms-wait"></span>'}</div>`;
    // 받을 수 있는 것 → 진행 중 → 받은 것 순서(같은 무리 안에서는 서버 순서 그대로)
    const ord = (x) => (x.claimed ? 2 : x.done ? 0 : 1), sort = (a) => a.map((x, i) => [x, i]).sort((p, q) => ord(p[0]) - ord(q[0]) || p[1] - q[1]).map((p) => p[0]);
    return `<div class="lp-bal"><i class="ico coin" aria-hidden="true"></i>${L('balance', { n: (me.coins || 0).toLocaleString() })}</div>`
      + `<div class="ms-head"><b>${L('msDaily')}</b><small>${L('msReset', { h: hh, m: mm })}</small></div>${sort(ms.daily).map((x) => row(x, C.t('ms_' + x.id), x.n, x.need)).join('')}`
      + `<div class="ms-head"><b>${L('msFirsts')}</b></div>${sort(ms.firsts).map((x) => row(x, fname(x.id), x.done ? 1 : 0, 1)).join('')}`;
  }
  // quiet = 알림 없이 결과만 돌려준다(한꺼번에 받기). 돌려주는 값: 받았으면 { coins, xp, rankUp }, 아니면 null
  async function msClaim(id, quiet) {
    const r = await C.api('/api/missions/claim', { id });
    if (r.me && Array.isArray(r.daily)) {
      C.ACC.me = r.me; C.saveAcc(); ms = { daily: r.daily, firsts: r.firsts, resetAt: r.resetAt };
      renderTop(); if (panel === 'mission') { msFresh = true; renderPanel(); } msDot();
      if (!quiet) { toast(r.xp ? C.t('msGotXp', { n: r.coins, x: r.xp }) : L('msGot', { n: r.coins })); if (r.rankUp && r.rankUp.length) setTimeout(() => rankToast(r.rankUp), 2700); }
      return { coins: r.coins || 0, xp: r.xp || 0, rankUp: r.rankUp || [] };
    }
    if (!quiet) toast(C.errText(r.error));
    if (panel === 'mission') renderPanel();
    return null;
  }
  // 로비 미션 칸의 '받기': 다 깬 일일 미션을 차례로 받고 알림은 한 번
  let msAllBusy = false;
  async function msClaimAll() {
    if (msAllBusy) return; msAllBusy = true;
    let c = 0, x = 0; const ups = [];
    try { for (const m of msDone()) { const r = await msClaim(m.id, true); if (r) { c += r.coins; x += r.xp; ups.push(...r.rankUp); } } } finally { msAllBusy = false; msDot(); }
    if (c || x) toast(C.t('msGotXp', { n: c, x }));
    if (ups.length) setTimeout(() => rankToast(ups), 2700);
  }

  // ---------- 메뉴 창 ----------
  let panel = null, ptab = null, rdiff = 'easy', rimm = 'jojo', rmode = 'coop', rdiffSet = false;
  function openPanel(kind) {
    panel = kind; ptab = null; $('lpanel').hidden = false; $('lpanel').dataset.kind = kind;
    if (kind === 'rank' && !rdiffSet) { const c = prog().clr; rdiff = DIFFS[Math.max(0, Math.min(DIFFS.length - 1, c))]; } // 최단 클리어 기본 난이도 = 내가 깬 가장 높은 난이도(없으면 쉬움)
    $('lptitle').textContent = kind === 'news' && root.RTD_NEWS ? root.RTD_NEWS.label() : L(kind);
    // 계정 상자는 계정 창 안으로 옮겨 쓴다
    $('lhold').appendChild($('accbox')); $('lpbody').innerHTML = ''; $('lpbody').scrollTop = 0; // 앞 창의 스크롤 위치가 남지 않게
    if (kind === 'account') $('lpbody').appendChild($('accbox'));
    if (kind === 'shop') iapFlush(); // 서버 확인을 못 한 결제가 남아 있으면 다시 보낸다
    renderPanel();
  }
  function closePanel() { shTipClose(); panel = null; wizBack = false; $('lpanel').hidden = true; $('lhold').appendChild($('accbox')); if (C && C.clearAccNote) C.clearAccNote(); }
  // rseq = 창을 그릴 때마다 오르는 번호(서버 답을 기다리는 사이 다른 탭·창으로 바꿨으면 늦게 온 답을 버린다)
  // wizBack = 전투 시작 창의 '계정 열기'로 계정 창에 왔다(로그인하면 전투 시작 창을 온라인이 골라진 채로 다시 연다)
  let rseq = 0, wizBack = false;
  // 상점 ⓘ 설명 = 말풍선(2026-11-25 실기 소감: 본문에 펼쳐 카드를 밀지 않게 떠 있는 층). ⓘ 아래에 꼬리를 달고, 창(#lpanel) 안전 영역 밖으로 안 나가게 놓는다.
  // 닫기: ⓘ를 다시 누름 · 바깥을 누름(그 누름은 다른 버튼에 전달하지 않음 — 닫으려다 체험·구매가 눌리지 않게) · 탭 바꿈·창 다시 그림·창 닫기·화면 크기 바뀜
  // 계정 창 관직 ?(관직 표)도 같은 말풍선을 쓴다(2026-11-26 layout-shift: 표를 본문에 펼치면 아래 칸이 380px 밀렸다). 단추는 aria-controls="shtip"으로 표시한다.
  let tipBtn = null;
  function shTipClose() {
    const t = $('shtip'); if (t) t.remove();
    tipBtn = null;
    document.querySelectorAll('[aria-controls="shtip"]').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); });
  }
  // btn 아래(아래 자리가 모자라고 위가 더 넓으면 위)에 html을 띄운다. o.w = 최대 폭(기본 380), o.cls = 덧붙일 클래스
  function tipOpen(btn, html, o) {
    o = o || {};
    shTipClose(); tipBtn = btn;
    const host = $('lpanel'), t = document.createElement('div');
    t.id = 'shtip'; t.className = 'sh-tip' + (o.cls ? ' ' + o.cls : ''); t.setAttribute('role', 'note');
    t.innerHTML = `<div class="sh-tipb">${html}</div><i class="sh-tail" aria-hidden="true"></i>`;
    host.appendChild(t);
    btn.classList.add('on'); btn.setAttribute('aria-expanded', 'true');
    // 자리 계산은 #lpanel 기준, 넘지 않을 테두리는 창 상자(.lp-box) 안쪽 8px(태블릿에서 창 밖 어두운 곳까지 나가지 않게)
    const hr = host.getBoundingClientRect(), br = btn.getBoundingClientRect(), bx = (host.querySelector('.lp-box') || host).getBoundingClientRect();
    const ml = bx.left - hr.left + 8, mr = hr.right - bx.right + 8, mb = hr.bottom - bx.bottom + 8, mt = bx.top - hr.top + 8;
    const w = Math.min(o.w || 380, hr.width - ml - mr), cx = br.left + br.width / 2 - hr.left;
    const left = Math.max(ml, Math.min(hr.width - mr - w, cx - w + 30)), top = br.bottom - hr.top + 9;
    Object.assign(t.style, { width: w + 'px', left: left + 'px' });
    const need = t.offsetHeight, below = hr.height - top - mb, above = br.top - hr.top - 9 - mt;
    if (need > below && above > below) { t.classList.add('up'); Object.assign(t.style, { bottom: (hr.bottom - br.top + 9) + 'px', maxHeight: Math.max(60, above) + 'px' }); }
    else Object.assign(t.style, { top: top + 'px', maxHeight: Math.max(60, below) + 'px' });
    t.style.setProperty('--ax', Math.max(14, Math.min(w - 14, cx - left)) + 'px');
  }
  let shTipTab = null;
  function shTipOpen(btn) {
    shTipTab = ptab;
    tipOpen(btn, `${L('coinHint')}${ptab === 'unlock' ? '<br>' + L('unlockHint') : ''}`);
  }
  // 바깥(19-title 계정 상자 등)에서 쓰는 말풍선: 같은 단추를 다시 누르면 닫는다
  function tipToggle(btn, html, o) { if ($('shtip') && tipBtn === btn) shTipClose(); else tipOpen(btn, html, o); }
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // 바깥 누름: 다른 클릭 처리보다 먼저(잡기 단계) 닫고 그 누름은 멈춘다. 안드로이드 뒤로 가기(native.js가 닫기 버튼을 대신 누름)도 말풍선부터 닫는다
    document.addEventListener('click', (e) => { const t = $('shtip'); if (!t || t.contains(e.target) || (e.target.closest && e.target.closest('[aria-controls="shtip"]'))) return; shTipClose(); e.preventDefault(); e.stopPropagation(); }, true);
    window.addEventListener('resize', () => { if ($('shtip')) shTipClose(); });
    // 본문 안의 단추에 달린 말풍선은 본문을 스크롤하면 닫는다(단추만 움직이고 말풍선이 제자리에 남지 않게)
    document.addEventListener('scroll', (e) => { if (tipBtn && e.target && e.target.id === 'lpbody' && e.target.contains(tipBtn)) shTipClose(); }, true);
  }
  const loadingHtml = () => `<div class="lp-note lp-wait">${L('loading')}</div>`;
  const failHtml = () => `<div class="lp-note lp-fail">${L('loadFail')} <button class="btn" type="button" data-retry="1">${L('retry')}</button></div>`;
  const tabs = (list) => { if (!ptab || !list.some(([k]) => k === ptab)) ptab = list[0][0]; $('lptabs').innerHTML = list.map(([k, l]) => `<button type="button" class="${ptab === k ? 'on' : ''}" data-ptab="${k}">${l}</button>`).join(''); };
  async function renderPanel() {
    const keepTip = $('shtip') && panel === 'shop' ? shTipTab : null; // 같은 탭을 다시 그릴 때(동전·결제 상태가 와서)는 말풍선을 새 ⓘ에 다시 띄운다
    shTipClose();
    if (!panel) return;
    const my = ++rseq;
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
      // 로그인: 서버 전적(불러오는 동안 '불러오는 중…'). 못 불러오면 이 기기의 기록으로 대신하고 다시 시도 버튼을 보인다
      let hist, pg, fell = false;
      if (me) {
        body.innerHTML = loadingHtml();
        const r = await C.api('/api/hist', {});
        if (my !== rseq || panel !== 'history') return;
        if (r.status === 200 && !r.error) { hist = r.hist || []; pg = r.prog || { plays: {}, clears: {} }; } else fell = true;
      }
      if (!me || fell) { hist = loadJ('rtd-hist', []); pg = loadJ(progKey(), { plays: {}, clears: {} }); }
      const plays = pg.plays || {}, clears = pg.clears || {}, total = Object.values(plays).reduce((a, b) => a + b, 0);
      const dn = (id) => (C.T.difficulties.find((d) => d.id === id) || {}).name || id;
      let h = `<div class="hs-sum"><div><span>${L('totalPlays')}</span><b>${total}</b></div>${DIFFS.map((d) => { const p = plays[d] || 0; return `<div><span>${esc(dn(d))}</span><b>${p ? `${clears[d] || 0}/${p}` : '—'}</b><small>${p ? L('hsClears') : L('hsNone')}</small></div>`; }).join('')}</div>`;
      if (fell) h = `<div class="lp-note lp-fail">${L('histFallback')} <button class="btn" type="button" data-retry="1">${L('retry')}</button></div>` + h;
      if (!me) h += `<div class="lp-note">${L('histLocal')}</div>`;
      h += `<div class="label">${L('recent')}</div>`;
      h += hist.map((x, i) => {
        const dt = new Date(x.at), when = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        const myth = Object.keys(x.myth || {});
        const st = x.st || {};
        const det = `<div class="hs-det" id="hsd${i}" hidden><b>${L('mythGot')}</b><div class="ms">${myth.length ? myth.map((id) => { const d = C.T.units.find((u) => u.id === id); return d ? `<span><img alt="" src="${Art.portrait(d)}">${esc(d.name)} ×${x.myth[id]}</span>` : ''; }).join('') : L('noMyth')}</div>
          <div class="sg"><span>${L('st_kills')} <b>${st.kills || 0}</b></span><span>${L('st_mid')} <b>${st.midKill || 0}/${st.midMiss || 0}</b></span><span>${L('st_life')} <b>${st.lifeLost || 0}</b></span><span>${L('st_gold')} <b>${(st.goldIn || 0).toLocaleString()}</b></span><span>${L('st_comb')} <b>${st.combines || 0} · ${st.crafts || 0}</b></span><span>${L('st_tix')} <b>${st.tickets || 0} · ${st.chests || 0}</b></span><span>${L('st_boss')} <b>${st.bossWins || 0}/${st.bosses || 0}</b></span><span>${L('st_fast')} <b>${st.fast || 0}</b></span></div></div>`;
        return `<div class="hs-row" data-hs="${i}"><span>${when} · ${esc(dn(x.diff))}${x.mut ? ' +' + x.mut : ''} <small>${L(x.online || x.mode === 'room' ? 'tagRoom' : x.mode === 'ai' ? 'tagAi' : 'tagSolo')}</small></span><span>R${x.round} · ${C.clock(x.time || 0)}</span><span class="${x.win ? 'w' : 'l'}">${L(x.win ? 'win' : 'lose')}</span></div>${det}`;
      }).join('') || `<div class="lp-note lp-empty">${L('empty')}</div>`;
      body.innerHTML = h;
      return;
    }
    if (panel === 'mission') {
      // 미션: 로그인해야 쓴다. 열 때마다 서버에서 새로 받는다(받기 직후에는 그 응답을 그대로 쓴다)
      $('lptabs').innerHTML = '';
      if (!me || !C.ACC.token) { body.innerHTML = `<div class="lp-note">${L('needLogin')} <button class="btn" type="button" data-lp="account">${L('openAcc')}</button></div>`; return; }
      if (msFresh) msFresh = false;
      else {
        body.innerHTML = loadingHtml();
        const good = await msLoad();
        if (my !== rseq || panel !== 'mission') return;
        if (!good) { body.innerHTML = failHtml(); return; }
      }
      body.innerHTML = missionHtml();
      return;
    }
    if (panel === 'news') {
      // 업데이트 내역(news.js). 열면 본 것으로 치고 빨간 점을 끈다
      $('lptabs').innerHTML = '';
      body.innerHTML = root.RTD_NEWS ? root.RTD_NEWS.html() : '';
      if (root.RTD_NEWS) root.RTD_NEWS.markSeen();
      renderTop();
      return;
    }
    if (panel === 'settings') {
      $('lptabs').innerHTML = '';
      // 차단 풀기: 차단한 사람이 있으면 설정 맨 아래에 목록을 붙인다
      body.innerHTML = C.settingsHtml() + restoreRow() + (blocked.length ? `<div class="setlist"><div class="h">${L('block')}</div>${blocked.map((n) => `<div class="row"><span>${esc(n)}</span><button type="button" class="unb" data-unblock="${esc(n)}">${L('unblock')}</button></div>`).join('')}</div>` : '');
      return;
    }
    if (panel === 'shop') {
      tabs([['unlock', L('unlockTab')], ['icons', L('icons')], ['skins', L('skins')], ['maps', L('maps')]].concat(GEMS_ON ? [['gems', L('gems')]] : []));
      if (!me) { body.innerHTML = `<div class="sh-empty"><img alt="" src="gfx/ic_shop.png"><p>${L('needLogin')}</p><button class="btn go" type="button" data-lp="account">${L('openAcc')}</button></div>`; return; }
      // 탭 줄 오른쪽 = 재화 바(창 안에서 스크롤해도 늘 보인다) + ⓘ(동전 얻는 법·해금 설명은 눌러야 말풍선으로 뜬다)
      $('lptabs').insertAdjacentHTML('beforeend', `<div class="sh-wallet"><span class="sh-coins" role="status" aria-label="${L('balance', { n: (me.coins || 0).toLocaleString() })}">${coinTag(me.coins)}</span><button class="sh-ib" type="button" data-shinfo="1" aria-expanded="false" aria-controls="shtip" aria-label="${L('shInfo')}">i</button></div>`);
      if (keepTip && keepTip === ptab) shTipOpen($('lptabs').querySelector('[data-shinfo]'));
      const has = (id) => SHOP.free(id) || me.owned.includes(id);
      // 아래 버튼: 가진 것은 장착(장착 중이면 ✓ 표시, 외형은 해제), 없는 것은 동전 가격 버튼
      const foot = (id, cost, on, kind, unit) => (has(id)
        ? `<button class="sh-eq${on ? ' on' : ''}" type="button" data-equip="${kind}" data-id="${id}" ${unit ? `data-unit="${unit}"` : ''} ${on && kind !== 'skin' ? 'disabled' : ''}>${on ? (kind === 'skin' ? L('unequip') : '✓ ' + L('equipped')) : L('equip')}</button>`
        : priceBtn(`data-buy="${id}"`, cost, L('buy'), me));
      const card = (id, cost, on, kind, unit, art, name, cls) => shCard({ cls: (cls || '') + (on ? ' on' : has(id) ? ' own' : ''), art, rk: SHOP.free(id) ? L('free') : '', st: on ? 'on' : '', short: !has(id) && me.coins < cost ? cost - me.coins : 0, name, foot: foot(id, cost, on, kind, unit) });
      let h = '';
      if (ptab === 'unlock') {
        h += unlockHtml(me);
      } else if (ptab === 'icons') {
        h += `<div class="sh-grid">${SHOP.ICON_FREE.map((u) => [u, 0]).concat(SHOP.ICON_SHOP).map(([u, cost]) => card('icon_' + u, cost, me.icon === u, 'icon', null, `<img class="sd" alt="" src="${iconSrc(u)}">`, esc((C.T.units.find((d) => d.id === u) || {}).name || u))).join('')}</div>`;
      } else if (ptab === 'skins') {
        h += `<div class="sh-grid">${Object.keys(SHOP.UNIT_SKINS).map((k) => {
          const sk = SHOP.UNIT_SKINS[k], d = C.T.units.find((u) => u.id === sk.unit), on = !!(me.skins && me.skins[sk.unit] === k);
          return card('skin_' + k, sk.price, on, 'skin', sk.unit, `<img class="sd" alt="" data-skinpv="${k}" src="${iconSrc(d.id)}">`, esc(nm(sk.name)));
        }).join('')}</div>`;
      } else if (ptab === 'maps') {
        h += `<div class="sh-grid wide">${Object.keys(SHOP.MAP_SKINS).map((k) => {
          const sk = SHOP.MAP_SKINS[k], on = (me.mapSkin || 'spring') === k;
          return card('map_' + k, sk.price, on, 'map', null, `<canvas class="mp" data-mappv="${k}" width="240" height="160"></canvas>`, esc(nm(sk.name)), 'map');
        }).join('')}</div>`;
      } else if (GEMS_ON) {
        h = `<div class="sh-hint">${L('gemHint')}</div><div class="sh-grid">${SHOP.GEM_PACKS.map(([id, n, yen]) => shCard({ cls: 'gem', art: `<span class="sh-gem">寶</span>`, rk: `¥${yen.toLocaleString('en-US')}`, name: String(n), foot: `<button class="sh-eq" type="button" disabled>${L('soon')}</button>` })).join('')}</div>`;
      }
      body.innerHTML = h;
      // 미리보기: 장수 외형은 색을 바꾼 초상, 지도는 바뀐 바닥 색
      body.querySelectorAll('[data-skinpv]').forEach((img) => { const k = img.dataset.skinpv, sk = SHOP.UNIT_SKINS[k], src = new Image(); src.onload = () => { const c2 = shift(src, sk); if (c2) img.src = c2.toDataURL(); }; src.src = img.src; });
      body.querySelectorAll('[data-mappv]').forEach((cv) => { const k = cv.dataset.mappv; const sk = SHOP.MAP_SKINS[k]; C.paintMini(cv, sk.theme || null); if (k !== 'spring' && !sk.theme) { const o = shift(cv, sk); if (o) { const x = cv.getContext('2d'); x.drawImage(o, 0, 0); } } });
      return;
    }
    if (panel === 'rank') {
      tabs([['level', L('rLevel')], ['clear', L('rClear')], ['imm', L('rImm')]]);
      let h = ptab === 'clear' ? `<div class="lp-note">${L('rankNoteClear')}</div>` : ptab === 'imm' ? `<div class="lp-note">${L('rankNoteImm')}</div>` : '', list = [];
      // 서버에 묻는 동안 '불러오는 중…', 실패하면 '불러오지 못했습니다 + 다시 시도'(빈 순위와 구별). 그때는 null을 돌려준다
      const ask = async (url) => {
        body.innerHTML = h + loadingHtml();
        const r = await C.api(url);
        if (my !== rseq || panel !== 'rank') return null;
        if (r.status !== 200 || r.error) { body.innerHTML = h + failHtml(); return null; }
        return r;
      };
      const row = (i, p, val, extra) => `<div class="lp-row"><span class="no">${i + 1}</span><img alt="" src="${iconSrc(p.icon)}"><span class="who">${extra || esc(p.nick)}<small>${p.grade && ptab !== 'level' ? esc(rkLabel(p.grade, p.level)) : ''}</small></span><span class="val">${val}</span></div>`;
      if (ptab === 'clear') {
        h += `<div class="lp-sel">${[['coop', L('rCoop')], ['solo', L('rSolo')]].map(([k, n]) => `<button type="button" class="${rmode === k ? 'on' : ''}" data-rmode="${k}">${n}</button>`).join('')}</div>`;
        h += `<div class="lp-sel">${C.T.difficulties.map((d) => `<button type="button" class="${rdiff === d.id ? 'on' : ''}" data-rdiff="${d.id}">${esc(d.name)}</button>`).join('')}</div>`;
        const r = await ask('/api/rank?type=clear&diff=' + rdiff + (rmode === 'solo' ? '&mode=solo' : '')); if (!r) return; list = r.list || [];
        h += list.map((c, i) => `<div class="lp-row"><span class="no">${i + 1}</span><img alt="" src="${iconSrc(c.members[0] && c.members[0].icon)}"><span class="who"><span class="lp-party">${c.members.map((m) => `<span><img alt="" src="${iconSrc(m.icon)}">${esc(m.nick)}</span>`).join('')}</span><small>${c.mut ? esc(((C.T.difficulties.find((d) => d.id === 'nightmare') || {}).name || '') + ' +' + c.mut) : ''}</small></span><span class="val">${C.clock(c.time)}</span></div>`).join('');
      } else if (ptab === 'imm') {
        const imms = C.T.units.filter((d) => d.tier === 10);
        h += `<div class="lp-sel">${imms.map((d) => `<button type="button" class="${rimm === d.id ? 'on' : ''}" data-rimm="${d.id}">${esc(d.name)}</button>`).join('')}</div>`;
        const r = await ask('/api/rank?type=imm&id=' + rimm); if (!r) return; list = r.list || [];
        h += list.map((p, i) => row(i, p, L('times', { n: p.n }))).join('');
      } else {
        const r = await ask('/api/rank?type=level'); if (!r) return; list = r.list || [];
        h += list.map((p, i) => row(i, p, p.grade ? esc(rkLabel(p.grade, p.level)) : C.t('level', { n: p.level }))).join('');
      }
      if (!list.length) h += `<div class="lp-note lp-empty">${L('empty')}</div>`;
      if (panel === 'rank') body.innerHTML = h;
    }
  }
  async function buy(id) {
    const r = await C.api('/api/buy', { item: id });
    if (r.me) { C.ACC.me = r.me; C.saveAcc(); renderTop(); renderPanel(); } else { toast(r.error === 'coins' ? L('noCoins') : C.errText(r.error)); renderPanel(); }
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
        if (p.match) {
          mt.room = p.match.room; mt.size = p.match.size; mt.joinAt = Date.now();
          // 방에 못 들어가면(서버 연결 실패·만원) 대기 화면에 까닭과 '다시 찾기'를 보인다
          const m0 = mt;
          Promise.resolve(C.joinRoom(mt.room)).then((err) => { if (err && mt === m0) { clearInterval(m0.iv); mt = null; matchUI(`<div>${esc(err)}</div><button class="btn go" type="button" id="mretry">${L('matchRetry')}</button>${cancelB}`); } });
        }
        else { const late = Date.now() - mt.at > ALONE_MS; matchUI(`<div class="spin"></div><div>${L('searching', { n: p.waiting || 1 })}</div>${late ? `<div class="hint2">${L('aloneHint')}</div><button class="btn go" type="button" id="malone">${L('alone')}</button>` : ''}${cancelB}`); }
        return;
      }
      // 방에 다 모이거나 15초가 지나면 방장이 시작한다
      const l = C.getLobby(), n = l ? l.roster().length : 0;
      matchUI(`<div class="spin"></div><div>${L('entering', { a: n, b: mt.size })}</div>${mt.started ? '' : cancelB}`);
      // 서버에 시작을 보내지 못했거나(끊김) 답이 오지 않았으면(net.js startWaitMs) 다음 확인 때 다시 보낸다
      if (l && l.isHost() && (n >= mt.size || Date.now() - mt.joinAt > 15000) && !l.started && !(l.startPending && l.startPending())) { mt.started = l.start(mt.diff, { muts: [], mutLv: 0 }) !== false; }
    };
    mt.iv = setInterval(tick, 2000); tick();
  }
  // 위저드를 열면 마지막에 시작한 설정('rtd-last', 19-title이 판을 시작할 때 저장하고 켤 때 cfg에 넣어 둔다)이 골라져 있다.
  // 한 번도 시작한 적이 없으면 아무것도 고르지 않은 상태로 시작한다. 고른 항목만 표시하고, 고르기 전에는 다음으로 못 간다.
  let picked = {};
  const STEP_KEY = { play: 'play', mode: 'mode', diff: 'diff' };
  function openWizard() { step = 'play'; picked = loadJ('rtd-last', null) ? { play: true, mode: true, diff: true } : {}; $('setup').hidden = false; C.repaintSetup && C.repaintSetup(); showStep(); }
  // 창을 닫으면 방에서도 나간다(방에 남아 있다가 방장이 시작하면 판으로 끌려 들어가던 문제). 판을 시작하면서 닫을 때만(keepRoom === true) 방을 그대로 둔다
  function closeWizard(keepRoom) { stopMatch(true); step = null; $('setup').hidden = true; if (keepRoom !== true && C && C.leaveRoom) { showStep.making = false; C.leaveRoom(); } }
  function showStep() {
    if (!step) return;
    const order = ORDER(), i = order.indexOf(step);
    document.querySelectorAll('#setup .wz').forEach((el) => el.classList.toggle('cur', el.dataset.step === step));
    $('wztitle').textContent = L({ play: 'stepPlay', mode: 'stepMode', diff: 'stepDiff', room: 'stepRoom', match: 'stepMatch' }[step]);
    markLocks();
    // 단계 표시는 숫자 대신 점(갈래에 따라 단계 수가 바뀌어도 덜 어색하다). 읽어 주기용으로 숫자는 aria-label에
    $('wzsteps').textContent = '●'.repeat(i + 1) + '○'.repeat(Math.max(0, order.length - i - 1));
    $('wzsteps').setAttribute('aria-label', `${i + 1} / ${order.length}`);
    $('setup').dataset.step = step;
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
    $('setup').classList.toggle('inroom', step === 'room' && !!l); // 방에 들어온 뒤에는 방 코드 입력·만들기 줄과 겹친 제목을 숨긴다(CSS)
    if (step === 'room') { const host = l && l.isHost(); $('wzroomdiff').hidden = !host; if (host) { $('wzroomdiff').appendChild($('diffsec')); $('wzroomdiff').appendChild($('mutbox')); } }
    else if ($('diffsec').parentElement !== $('wzdiff')) { $('wzdiff').appendChild($('diffsec')); $('wzdiff').appendChild($('mutbox')); }
    attachChat();
    // 방 만들기는 들어오자마자 방을 연다
    if (step === 'room' && C.cfg.mode === 'create' && !l && !showStep.making) { showStep.making = true; $('mk').click(); setTimeout(() => (showStep.making = false), 3000); }
  }
  function next() { const o = ORDER(), i = o.indexOf(step); if (i < o.length - 1) { step = o[i + 1]; showStep(); if (step === 'match') startMatch(); } }
  // 방·빠른 대전 단계에서 뒤로 가면 방에서 나간다(들어가는 중이던 연결도 버린다)
  function back() { if (step === 'match') stopMatch(true); const o = ORDER(), i = o.indexOf(step); if (i > 0) { const was = step; step = o[i - 1]; if ((was === 'room' || was === 'match') && C.leaveRoom) { showStep.making = false; C.leaveRoom(); } showStep(); } }
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
    const label = b.innerHTML; b.dataset.armed = '1'; b.classList.add('arm'); b.textContent = C.t('confirmAgain'); // 되돌릴 때 버튼 안 그림(동전)까지 살린다
    setTimeout(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.classList.remove('arm'); b.innerHTML = label; } }, 3000);
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
  // muted = 운영자가 건 채팅 제한(남은 시간을 시간 단위로. 1년 넘게 남았으면 무기한으로 보인다)
  const chatNo = (d) => (d && d.why === 'muted' ? L(d.s > 31536000 ? 'no_mutedPerm' : 'no_muted', { h: Math.max(1, Math.ceil((d.s || 0) / 3600)) })
    : L('no_' + (['fast', 'dup', 'ad', 'mute'].includes(d && d.why) ? d.why : 'fast'), { s: (d && d.s) || 0 }));
  // 협동 판 게임 중 채팅(src/ui/16b-chat.js)이 같은 차단 목록·신고·확인 누름·막힘 문구를 쓴다(2026-11-28)
  const chatKit = {
    L: (k, v) => L(k, v), chatNo: (d) => chatNo(d), armed: (b) => armed(b), isBlocked: (n) => blocked.includes(n),
    block: (n) => { if (!blocked.includes(n)) blocked.push(n); saveBlock(); },
    report: (room, slot, nick, text) => C.api('/api/report', { room, slot, nick, text }),
  };
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
    { const U = UL(); if (U) U.provider = unlockedList; if (C.T && C.T.unlock) C.T.unlock.provider = unlockedList; } // 판을 만들 때 엔진이 부른다
    $('battlebtn').onclick = openWizard;
    $('wzclose').onclick = closeWizard; $('wzback').onclick = back; $('wznext').onclick = next;
    $('lpclose').onclick = closePanel;
    setInterval(lcSync, 3000); // 로그인·로비 표시가 바뀌면 채팅 연결을 맞춘다
    $('lchar').onclick = charTap;
    $('chatsend').onclick = sendChat;
    $('chatin').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    document.addEventListener('click', (e) => {
      if ($('title').hidden) return;
      const lp = e.target.closest('[data-lp]'); if (lp) { if (lp.dataset.lp === 'shop' && !shopOpen()) { toast(L('shopLocked')); return; } const fromWiz = !$('setup').hidden && !!lp.closest('#setup'); if (fromWiz) closeWizard(); openPanel(lp.dataset.lp); wizBack = fromWiz && lp.dataset.lp === 'account'; return; }
      if (e.target.closest('[data-retry]')) { renderPanel(); return; }
      if (e.target.id === 'lbleave') { back(); return; }
      if (e.target.id === 'mretry') { startMatch(); return; }
      const pt = e.target.closest('[data-ptab]'); if (pt) { ptab = pt.dataset.ptab; renderPanel(); return; }
      const si = e.target.closest('[data-shinfo]'); if (si) { if ($('shtip')) shTipClose(); else shTipOpen(si); return; }
      const rm = e.target.closest('[data-rmode]'); if (rm) { rmode = rm.dataset.rmode; renderPanel(); return; }
      const rd = e.target.closest('[data-rdiff]'); if (rd) { rdiff = rd.dataset.rdiff; rdiffSet = true; renderPanel(); return; }
      const ri = e.target.closest('[data-rimm]'); if (ri) { rimm = ri.dataset.rimm; renderPanel(); return; }
      const hs = e.target.closest('[data-hs]'); if (hs) { const d = $('hsd' + hs.dataset.hs); if (d) d.hidden = !d.hidden; return; }
      if (e.target.id === 'mcancel') { stopMatch(true); back(); return; }
      if (e.target.id === 'malone') { stopMatch(true); closeWizard(); C.begin({ diff: C.cfg.diff, mode: 'solo', online: true, muts: [], mutLv: 0, key: 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); return; }
      // 동전 구매·해금은 되돌릴 수 없으므로 같은 버튼을 한 번 더 눌러야 확정한다(armed: 신고·차단과 같은 방식)
      const bb = e.target.closest('[data-buy]'); if (bb) { if (!armed(bb)) return; bb.disabled = true; buy(bb.dataset.buy); return; }
      const tb = e.target.closest('[data-trial]'); if (tb) { if (!shopOpen()) return; C.begin({ diff: 'easy', mode: 'solo', trial: { unit: tb.dataset.trial } }); return; }
      const un = e.target.closest('[data-unl]'); if (un) { if (!armed(un)) return; un.disabled = true; unlockCoins(un.dataset.unl); return; }
      const mc = e.target.closest('[data-msclaim]'); if (mc) { mc.disabled = true; msClaim(mc.dataset.msclaim); return; }
      const ma = e.target.closest('[data-msall]'); if (ma) { ma.disabled = true; msClaimAll(); return; }
      const ad = e.target.closest('[data-adrw]'); if (ad) { busyBtn(ad, L('adLoading'), watchAd()); return; }
      const ia = e.target.closest('[data-iap]'); if (ia) { busyBtn(ia, L('working'), iapBuy(ia.dataset.iap)); return; }
      const ir = e.target.closest('[data-iaprestore]'); if (ir) { busyBtn(ir, L('working'), iapRestore()); return; }
      const eq = e.target.closest('[data-equip]'); if (eq) { equip(eq.dataset.equip, eq.dataset.id, eq.dataset.unit); return; }
      // 방 채팅: 신고·차단 버튼은 줄을 누르면 그 줄에만 보인다(평소에는 대화만 촘촘히)
      const cln = !e.target.closest('button') && e.target.closest('#chatlog .cl');
      if (cln) { const on = !cln.classList.contains('sel'); $('chatlog').querySelectorAll('.cl.sel').forEach((x) => x.classList.remove('sel')); cln.classList.toggle('sel', on);
        // 펼친 줄(신고·차단 버튼 포함)이 채팅 칸 안에 보이도록 채팅 칸만 스크롤한다
        if (on) { const log = $('chatlog'), lr = log.getBoundingClientRect(), r = cln.getBoundingClientRect(), dB = r.bottom - lr.bottom + 2, dT = r.top - lr.top; log.scrollTop += dB > 0 ? Math.min(dB, dT) : Math.min(0, dT); } // 줄이 칸보다 크면 줄 머리를 우선
        return; }
      const rp = e.target.closest('[data-chatrep]'); if (rp) { if (!armed(rp)) return; const l = C.getLobby(); C.api('/api/report', { room: l && l.code, slot: rp.dataset.chatrep, nick: rp.dataset.nick, text: rp.dataset.text }).then(() => chatLine(`<div class="sys">${L('reported')}</div>`)); rp.disabled = true; return; }
      const lch = e.target.closest('[data-lch]'); if (lch) { lcSend({ k: 'ch', n: +lch.dataset.lch }); return; }
      const lrp = e.target.closest('[data-lcrep]'); if (lrp) { if (!armed(lrp)) return; C.api('/api/report', { room: '#lobby', slot: lrp.dataset.lcrep, nick: lrp.dataset.nick, text: lrp.dataset.text }).then(() => lcPush({ sys: L('reported') })); lrp.disabled = true; return; }
      const ub = e.target.closest('[data-unblock]'); if (ub) { const i = blocked.indexOf(ub.dataset.unblock); if (i >= 0) blocked.splice(i, 1); saveBlock(); ub.disabled = true; if (panel === 'settings') renderPanel(); return; }
      const bl = e.target.closest('[data-chatblock]'); if (bl && !armed(bl)) return;
      if (bl && bl.closest('#lchat')) { if (!blocked.includes(bl.dataset.chatblock)) blocked.push(bl.dataset.chatblock); saveBlock(); lc.lines = lc.lines.filter((o) => o.sys || o.self || o.n !== bl.dataset.chatblock); renderLchat(); lcPush({ sys: L('blocked'), unb: bl.dataset.chatblock }); return; }
      if (bl) { if (!blocked.includes(bl.dataset.chatblock)) blocked.push(bl.dataset.chatblock); saveBlock(); chatLine(`<div class="sys">${L('blocked')}${unbBtn(bl.dataset.chatblock)}</div>`); return; }
      // 설정의 버튼(data-act)은 11-actions가 처리한다. 그쪽 알림은 판 화면에 떠서 로비에서는 안 보이므로, 튜토리얼 다시 보기는 로비 알림으로 알려 준다
      const sa = panel === 'settings' && e.target.closest('[data-act]');
      if (sa) { if (sa.dataset.act === 'tutReset') toast(C.t('tutReplayHint')); setTimeout(renderPanel, 60); }
    });
    requestAnimationFrame(charLoop);
    refresh();
  }
  function refresh() {
    if (!C) return;
    renderTop(); showStep(); watchRoster();
    claimOld();
    // 미션 빨간 점: 로비에 들어올 때(로그인한 계정이 바뀔 때) 한 번 받는다
    { const tk = C.ACC.token || null; if (tk !== msTok) { msTok = tk; ms = null; msDot(); if (tk) msLoad(); } }
    if (!$('title').hidden && Date.now() - flushAt > PEND_GAP) flushPending(); // 못 보낸 판 결과·결제 영수증
    if (!$('title').hidden) syncMe(); // 계정 진행 새로 받기(1분에 한 번까지)
    lcSync();
    // 생성 그림을 다 불러온 뒤 내 아이콘을 다시 그린다(먼저 그리면 옛 도형 그림이 보임)
    if (Art.ready && Art.ready.then) Art.ready.then(() => renderTop());
    const skin = (C.ACC.me && C.ACC.me.mapSkin) || 'spring'; if (skin !== painted) { painted = skin; C.repaintMap(); } // (이름을 ms로 두면 위의 미션 상태 ms를 가려 초기화 전 접근 오류가 난다)
    // 전투 시작 창의 '계정 열기'로 와서 로그인했으면: 계정 창을 닫고 전투 시작 창을 온라인이 골라진 채로 다시 연다
    if (wizBack && panel === 'account' && C.ACC.token && C.ACC.me) { closePanel(); openWizard(); picked.play = true; showStep(); return; }
    if (panel === 'account') { C.refreshAcc(); renderPanel(); }
  }
  // 체험에서 돌아옴(11-actions trialLeave가 sessionStorage 'rtd-trial-back'에 { id, cta }를 남기고 다시 불러온다):
  // 상점 해금 탭을 열고 그 장수 카드로 스크롤해 테두리를 1.5초 반짝인다. cta(「이 장수 해금하기」)면 카드의 해금 버튼도 강조한다. 돌아온 경우 true
  function trialBack() {
    let o = null; try { o = JSON.parse(sessionStorage.getItem('rtd-trial-back') || 'null'); sessionStorage.removeItem('rtd-trial-back'); } catch (e) { o = null; }
    if (!o || !C || typeof o.id !== 'string' || !shopOpen()) return false;
    openPanel('shop'); ptab = 'unlock'; renderPanel();
    const go = (n) => {
      const card = $('lpbody').querySelector(`[data-card="${o.id.replace(/[^a-z0-9_]/gi, '')}"]`);
      if (!card) { if (n > 0) setTimeout(() => go(n - 1), 150); return; }
      card.scrollIntoView({ block: 'center' });
      card.classList.add('trflash'); setTimeout(() => card.classList.remove('trflash'), 1500);
      if (o.cta) { const b = card.querySelector('[data-unl], [data-iap]'); if (b) b.classList.add('trcta'); }
    };
    go(10);
    return true;
  }
  // 지금 장착한 지도가 그림 스킨이면 그 테마 이름(아니면 null)
  const mapTheme = () => { const me = C && C.ACC.me, p = me && me.mapSkin && SHOP.MAP_SKINS[me.mapSkin]; return p && p.theme ? p.theme : null; };
  // 테마 그림이 뒤늦게 도착하면 상점의 지도 미리보기를 다시 그린다
  if (typeof window !== 'undefined') window.addEventListener('rtd-maptheme', () => { if (panel === 'shop' && ptab === 'maps') renderPanel(); });
  root.RTD_LOBBY = { trialBack, shopOpen, hasStarter, panel: () => panel, grantStarter, init, unlocked: () => (C ? unlockedList() : null), refresh, onCfg, picked: isPicked, tintMap, mapTheme, skinned, closeWizard, recordGame, queueSend, flushPending, missionCheck, onMe, syncMe, toast: (txt, ms) => toastLobby(txt, ms), saveTk: () => readSaveTk(), setSaveTk: (tk, seed) => writeSaveTk(tk, seed), missions: () => ms, statsOf, diffOpen: (d, m) => (C ? diffOpen(d, m) : true), progNow: () => (C ? prog() : null), tip: tipToggle, chatKit: () => (C ? chatKit : null), close: () => { closeWizard(true); closePanel(); } };
})(typeof window !== 'undefined' ? window : globalThis);
