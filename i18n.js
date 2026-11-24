// 다국어: 한국어(기준)·日本語·English·中文. 언어는 기기에 저장하고, 바꾸면 화면을 다시 불러온다.
// 고유명사(장수·보스·세력·등급)는 테마 데이터를 시작할 때 바꿔 넣고, 화면 글자는 t(키)로 찾는다.
(function (root) {
  const LANGS = [['ko', '한국어'], ['ja', '日本語'], ['en', 'English'], ['zh', '中文']];
  let lang = 'ko';
  try {
    const saved = localStorage.getItem('rtd-lang');
    const nav = (navigator.language || 'ko').slice(0, 2);
    lang = LANGS.some(([k]) => k === saved) ? saved : LANGS.some(([k]) => k === nav) ? nav : 'en';
  } catch (e) { lang = 'ko'; }

  // ---- 화면 글자 ----
  const S = {
    title: ['삼국 랜덤 디펜스', '三国ランダムディフェンス', 'Three Kingdoms Random Defense', '三国随机防御'],
    tagline: ['황건의 난부터 사마씨의 천하통일까지. 라인을 지키며 무장을 조합하고, 보스 결투장에서는 대표 무장을 직접 조종해 패턴을 피하고 스킬을 맞히세요.', '黄巾の乱から司馬氏の天下統一まで。ラインを守りながら武将を組み合わせ、ボス戦では代表武将を直接操作して攻撃をかわし、スキルを当てよう。', 'From the Yellow Turban Rebellion to the unification under the Sima clan. Defend your lane, combine generals, and take direct control in boss duels to dodge attacks and land your skills.', '从黄巾之乱到司马氏统一天下。守住防线、合成武将，在首领决斗中亲自操控武将躲避招式、命中技能。'],
    tag1: ['보스 10인', 'ボス10人', '10 bosses', '10位首领'], tag2: ['무장 60여 명', '武将60人以上', '60+ generals', '60余名武将'], tag3: ['최대 5인 협동', '最大5人協力', 'Up to 5-player co-op', '最多5人合作'], tag4: ['악몽 +5 변형 규칙', '悪夢+5 変則ルール', 'Nightmare +5 modifiers', '噩梦+5 变异规则'],
    offline: ['싱글 플레이', 'シングルプレイ', 'Single Play', '单人游戏'], online: ['온라인', 'オンライン', 'Online', '在线'],
    offlineHint: ['혼자 또는 AI와 함께. 로그인해 있으면 경험치·동전을 조금 받습니다.', 'ひとり、またはAIと一緒に。ログイン中なら経験値・銅銭を少しもらえます。', 'Solo or with AI allies. If signed in, you earn a little XP and coins.', '单人或与AI一起。登录后可获得少量经验和铜钱。'],
    pickOne: ['하나를 고르세요', 'ひとつ選んでください', 'Choose one', '请选择一项'],
    onlineHint: ['계정으로 다른 사람과 협동. 싱글보다 경험치·동전을 많이 받고, 인원이 많을수록 더 받습니다.', 'アカウントで他の人と協力。シングルより経験値・銅銭が多く、人数が多いほど増えます。', 'Co-op with other players. More XP and coins than single play, and more with more players.', '使用账号与他人合作。经验和铜钱比单人更多，人数越多获得越多。'],
    difficulty: ['난이도', '難易度', 'Difficulty', '难度'], coopMode: ['협동 방식', 'プレイ方式', 'Play mode', '游戏方式'],
    solo: ['단독', 'ひとり', 'Solo', '单人'], soloSub: ['장수 2기로 출전', '武将2体で出陣', '2 champions', '出战2名武将'],
    aiAlly: ['AI 동맹', 'AI同盟', 'AI allies', 'AI同盟'], aiAllySub: ['AI 최대 4명', 'AI最大4人', 'Up to 4 AI', '最多4个AI'],
    aiCount: ['AI 인원', 'AIの人数', 'Number of AI allies', 'AI人数'], aiCountHint: ['각자 자기 라인을 맡고 빌드가 서로 다릅니다', 'それぞれ自分のラインを担当し、編成が異なります', 'Each runs its own lane with a different build', '各自负责一条防线，流派各不相同'],
    nPlayers: ['{n}인 협동', '{n}人協力', '{n}-player co-op', '{n}人合作'], nAi: ['AI {n}명', 'AI {n}人', '{n} AI', 'AI {n}个'],
    rounds: ['{n}라운드 · 체력 ×{m}', '{n}ラウンド・体力×{m}', '{n} rounds · HP ×{m}', '{n}回合 · 生命×{m}'], base: ['기본', '基本', 'Base', '基本'], reroll: ['규칙 다시 뽑기', 'ルールを引き直す', 'Reroll rules', '重抽规则'],
    mutTitle: ['악몽 + 변형 규칙', '悪夢＋変則ルール', 'Nightmare + modifiers', '噩梦＋变异规则'], mutHint: ['단계마다 이득·손해 묶음이 하나씩 붙습니다. 규칙은 판을 시작할 때 무작위로 정해집니다', '段階ごとにメリットとデメリットのセットが1つずつ付きます。ルールはゲーム開始時にランダムで決まります', 'Each level adds one bonus/penalty pair. The rules are drawn at random when the match starts', '每级附加一组增益与减益。规则在开局时随机决定'],
    room: ['협동 방', '協力ルーム', 'Co-op room', '合作房间'], roomHint: ['최대 5인', '最大5人', 'Up to 5', '最多5人'], roomCode: ['방 코드', 'ルームコード', 'Room code', '房间码'],
    makeRoom: ['방 만들기', 'ルーム作成', 'Create room', '创建房间'], joinRoom: ['입장', '入室', 'Join', '加入'], copy: ['복사', 'コピー', 'Copy', '复制'], copied: ['복사됨', 'コピー済み', 'Copied', '已复制'],
    emptySeat: ['빈 자리', '空き', 'Empty', '空位'], host: ['방장', 'ホスト', 'Host', '房主'], me: ['나', '自分', 'me', '我'], hostCfg: ['방장 설정', 'ホスト設定', 'Host settings', '房主设置'],
    lb_people: ['{n}/5명', '{n}/5人', '{n}/5', '{n}/5人'], lb_invite: ['코드를 보내 초대', 'コードを送って招待', 'Share the code', '发送房间码邀请'],
    mt_cnt: ['준비 {a}/{b}', '準備 {a}/{b}', 'Ready {a}/{b}', '准备 {a}/{b}'],
    roomOnline: ['연결됨', '接続済み', 'Connected', '已连接'], connecting: ['연결 중…', '接続中…', 'Connecting…', '连接中…'], roomFull: ['방이 가득 찼습니다. 다른 방 코드를 쓰세요.', '満員です。別のコードを使ってください。', 'Room is full. Try another code.', '房间已满，请换一个房间码。'],
    noServer: ['서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.', 'サーバーに接続できません。通信状況を確認してください。', 'Cannot reach the server. Check your connection.', '无法连接服务器，请检查网络。'],
    start: ['출정', '出陣', 'Deploy', '出征'], startHost: ['출정 (방장)', '出陣（ホスト）', 'Start (host)', '出征（房主）'], waitHost: ['방장이 시작하기를 기다리는 중', 'ホストの開始待ち', 'Waiting for the host', '等待房主开始'], joinFirst: ['방에 먼저 들어가세요', '先にルームに入ってください', 'Join a room first', '请先加入房间'],
    // 계정
    login: ['로그인', 'ログイン', 'Log in', '登录'], register: ['가입', '新規登録', 'Sign up', '注册'], logout: ['로그아웃', 'ログアウト', 'Log out', '退出登录'],
    accId: ['아이디 (영문 소문자·숫자 4~16자)', 'ID（半角英小文字・数字4〜16文字）', 'ID (4–16 lowercase letters/digits)', '账号（4~16位小写字母或数字）'], accPw: ['비밀번호 (8자 이상)', 'パスワード（8文字以上）', 'Password (8+ characters)', '密码（8位以上）'], accNick: ['닉네임 (12자까지)', 'ニックネーム（12文字まで）', 'Nickname (up to 12)', '昵称（最多12字）'],
    agree: ['{terms}과 {privacy}에 동의합니다', '{terms}と{privacy}に同意します', 'I agree to the {terms} and {privacy}', '我同意{terms}和{privacy}'], terms: ['이용약관', '利用規約', 'Terms of Service', '用户协议'], privacy: ['개인정보 처리방침', 'プライバシーポリシー', 'Privacy Policy', '隐私政策'],
    deleteAcc: ['계정 삭제', 'アカウント削除', 'Delete account', '删除账号'], deleteConfirm: ['계정과 등급 기록이 모두 지워지고 되돌릴 수 없습니다. 비밀번호를 입력하면 삭제합니다.', 'アカウントと階級の記録はすべて削除され、元に戻せません。パスワードを入力すると削除します。', 'Your account and rank history will be permanently deleted. Enter your password to confirm.', '账号与等级记录将被永久删除且无法恢复。输入密码以确认删除。'],
    deleted: ['계정을 삭제했습니다.', 'アカウントを削除しました。', 'Account deleted.', '账号已删除。'],
    err_bad_id: ['아이디는 영문 소문자·숫자·밑줄 4~16자입니다.', 'IDは半角英小文字・数字・アンダースコア（_）の4〜16文字です。', 'ID must be 4–16 lowercase letters, digits or _.', '账号须为4~16位小写字母、数字或下划线。'], err_bad_password: ['비밀번호는 8자 이상입니다.', 'パスワードは8文字以上です。', 'Password must be at least 8 characters.', '密码至少8位。'], err_bad_nick: ['닉네임을 확인하세요.', 'ニックネームを確認してください。', 'Check your nickname.', '请检查昵称。'],
    err_taken: ['이미 쓰는 아이디입니다.', 'このIDは使用されています。', 'That ID is taken.', '该账号已被使用。'], err_wrong: ['아이디 또는 비밀번호가 틀렸습니다.', 'IDまたはパスワードが違います。', 'Wrong ID or password.', '账号或密码错误。'], err_need_agree: ['약관에 동의해야 가입할 수 있습니다.', '規約への同意が必要です。', 'You must agree to the terms.', '需同意协议才能注册。'], err_slow_down: ['잠시 뒤에 다시 시도하세요.', 'しばらくしてから再度お試しください。', 'Please try again later.', '请稍后再试。'], err_auth: ['다시 로그인하세요.', '再度ログインしてください。', 'Please log in again.', '请重新登录。'],
    level: ['Lv.{n}', 'Lv.{n}', 'Lv.{n}', 'Lv.{n}'], gamesWins: ['{g}판 · {w}승', '{g}戦・{w}勝', '{g} games · {w} wins', '{g}局 · {w}胜'], ranking: ['순위', 'ランキング', 'Ranking', '排行榜'], xpGain: ['경험치 +{n}', '経験値 +{n}', '+{n} XP', '经验 +{n}'],
    g1: ['병졸', '兵卒', 'Private', '兵卒'], g2: ['오장', '伍長', 'Squad Leader', '伍长'], g3: ['백인장', '百人長', 'Centurion', '百夫长'], g4: ['천인장', '千人長', 'Chiliarch', '千夫长'], g5: ['교위', '校尉', 'Colonel', '校尉'], g6: ['장군', '将軍', 'General', '将军'], g7: ['대장군', '大将軍', 'Grand General', '大将军'], g8: ['대도독', '大都督', 'Grand Commander', '大都督'],
    // 게임 화면
    round: ['라운드', 'ラウンド', 'Round', '回合'], timeLeft: ['남은 시간', '残り時間', 'Time', '剩余时间'], duel: ['결투', '決闘', 'Duel', '决斗'], lives: ['라이프', 'ライフ', 'Lives', '生命'], front: ['전선', '戦線', 'Front', '战线'], troops: ['병력', '兵力', 'Units', '兵力'],
    nextBoss: ['다음 보스', '次のボス', 'Next boss', '下个首领'], midBoss: ['중간보스', '中ボス', 'Mid-boss', '中首领'],
    upgrade: ['강화', '強化', 'Upgrade', '强化'], sage: ['명사', '名士', 'Sages', '名士'], ticket: ['선택권', '選択券', 'Tickets', '选择券'], war: ['전황', '戦況', 'Status', '战况'], book: ['도감', '図鑑', 'Codex', '图鉴'], settings: ['설정', '設定', 'Settings', '设置'],
    autoOn: ['자동 켬', '自動ON', 'Auto on', '自动开'], autoOff: ['자동 끔', '自動OFF', 'Auto off', '自动关'], autoToastOn: ['1~3성 자동 정렬·합성 켬', '★1〜3 自動整列・合成ON', 'Auto sort & combine (★1–3) on', '1~3星自动整理与合成 开'], autoToastOff: ['1~3성 자동 정렬·합성 끔', '★1〜3 自動整列・合成OFF', 'Auto sort & combine (★1–3) off', '1~3星自动整理与合成 关'],
    speed: ['배속 ×{n}', '速度 ×{n}', 'Speed ×{n}', '速度 ×{n}'],
    gfx: ['화질', '画質', 'Graphics', '画质'], gfxRow: ['그래픽', 'グラフィック', 'Quality', '画面'], gfxHint: ['낮을수록 배터리·발열이 줄어듭니다', '低いほどバッテリーと発熱を抑えます', 'Lower saves battery and heat', '越低越省电、越不发热'], high: ['높음', '高', 'High', '高'], mid: ['보통', '中', 'Medium', '中'], low: ['낮음', '低', 'Low', '低'],
    fps30: ['30fps 제한', '30fps制限', 'Limit to 30fps', '限制30帧'], fps30Hint: ['배터리 절약', '省電力', 'Saves battery', '省电'], view: ['보기', '表示', 'View', '查看'], version: ['버전', 'バージョン', 'Version', '版本'], perfShow: ['성능 표시', '性能表示', 'Show performance', '显示性能'], perfShowHint: ['초당 프레임·처리 시간', 'FPS・処理時間', 'FPS and frame time', '帧率与耗时'], on: ['켜짐', 'オン', 'On', '开'], off: ['꺼짐', 'オフ', 'Off', '关'],
    language: ['언어', '言語', 'Language', '语言'], sound: ['소리', 'サウンド', 'Sound', '声音'], sfx: ['효과음', '効果音', 'Sound effects', '音效'], bgm: ['배경음', 'BGM', 'Music', '背景音乐'], autoSection: ['자동 정렬·합성', '自動整列・合成', 'Auto sort & combine', '自动整理与合成'],
    move: ['이동', '移動', 'Move', '移动'], attack: ['공격 이동', '攻撃移動', 'Attack-move', '攻击移动'], focus: ['점사', '集中攻撃', 'Focus', '集火'], disband: ['해산', '解散', 'Disband', '解散'], use: ['사용', '使用', 'Use', '使用'], dash: ['이동기', '移動技', 'Dash', '位移'], deselect: ['선택 해제', '選択解除', 'Deselect', '取消选择'], stop: ['정지', '停止', 'Stop', '停止'],
    moveDesc: ['선택한 유닛을 누른 곳으로 옮깁니다.', '選んだユニットをタップした場所へ移動します。', 'Move selected units to the tapped spot.', '把选中单位移到点击处。'], attackDesc: ['가는 길에 만나는 적을 공격하며 이동합니다.', '途中の敵を攻撃しながら移動します。', 'Move while attacking enemies on the way.', '边移动边攻击途中的敌人。'], focusDesc: ['중간보스·보스를 우선 공격합니다.', '中ボス・ボスを優先して攻撃します。', 'Prioritize mid-bosses and bosses.', '优先攻击中首领与首领。'], disbandDesc: ['1성 유닛을 금화로 바꿉니다.', '★1ユニットを金貨に換えます。', 'Turn a ★1 unit into gold.', '把1星单位换成金币。'], deselectDesc: ['선택을 풉니다.', '選択を解除します。', 'Clear the selection.', '取消选择。'],
    paused: ['일시정지', '一時停止', 'Paused', '已暂停'], pausedHint: ['앱을 내려서 멈췄습니다.', 'アプリがバックグラウンドに移ったため、一時停止しました。', 'The game paused while the app was in the background.', '应用切到后台，游戏已暂停。'], resume: ['계속하기', '続ける', 'Resume', '继续'],
    kicked: ['방에서 제외됨', 'ルームから除外されました', 'Removed from room', '已被移出房间'], kickedHint: ['1분 넘게 돌아오지 않아 다른 사람들이 계속 진행합니다.', '1分以上戻らなかったため、他の人たちは続行しています。', 'You were away for over a minute, so the others continued without you.', '超过1分钟未返回，其他人已继续游戏。'], toTitle: ['처음으로', 'ロビーへ', 'Back to title', '返回标题'],
    // 판 도중 나가기(게임 중 설정 탭), 다른 사람 전장에서 돌아오기, 명령 칸용 짧은 꼬리표
    quitGame: ['로비로 돌아가기', 'ロビーへ戻る', 'Back to lobby', '返回大厅'], quitBtn: ['나가기', '退出', 'Leave', '退出'], quitAgain: ['한 번 더 누르면 나감', 'もう一度押すと退出', 'Tap again to leave', '再按一次退出'],
    confirmAgain: ['한 번 더 눌러 확인', 'もう一度押して確定', 'Tap again to confirm', '再按一次确认'], tut_skipAgain: ['한 번 더 누르면 건너뜀', 'もう一度押すとスキップ', 'Tap again to skip', '再按一次跳过'],
    againSame: ['같은 설정으로 다시', '同じ設定でもう一度', 'Play again', '以相同设置再来'],
    quitConfirm: ['한 번 더 누르면 로비로 돌아갑니다', 'もう一度タップするとロビーへ戻ります', 'Tap again to return to the lobby', '再按一次返回大厅'],
    quitHintSave: ['이 판은 저장되어 이어하기로 계속할 수 있습니다.', 'このバトルは保存され、「続きから」で再開できます。', 'This game is saved. You can pick it up with Continue.', '本局会保存，可通过“继续游戏”接着玩。'],
    quitHintEnd: ['이 판은 여기서 끝나며 다시 돌아올 수 없습니다.', 'このバトルには戻れません。', 'This game ends here and cannot be resumed.', '本局将结束，无法返回。'],
    quitHintRoom: ['방에서 나갑니다. 이 판으로 돌아올 수 없습니다.', 'ルームから出ます。このバトルには戻れません。', 'You will leave the room and cannot rejoin this game.', '将退出房间，无法返回本局。'],
    myField: ['내 전장으로', '自分の戦場へ', 'Back to my field', '返回我的战场'],
    cmdPassive: ['패시브', 'パッシブ', 'Passive', '被动'], cmdActive: ['액티브', 'スキル', 'Active', '主动'],
    away: ['자리 비움', '離席中', 'Away', '离开'], awayBack: ['{n}초 안에 돌아오지 않으면 방에서 빠집니다', '{n}秒以内に戻らないとルームから外れます', 'Leaves the room in {n}s unless they return', '{n}秒内未返回将离开房间'],
    pickTitle: ['출전 무장 선택', '出陣武将の選択', 'Choose champions', '选择出战武将'], deploy: ['출전', '出陣', 'Deploy', '出战'], waitAllies: ['동료의 출전을 기다리는 중', '仲間の出陣を待っています', 'Waiting for allies', '等待队友出战'],
    backToBoss: ['보스전으로 돌아가기', 'ボス戦に戻る', 'Back to boss', '返回首领战'], toLane: ['내 라인으로', '自分のラインへ', 'To my lane', '回到防线'],
    win: ['천하통일', '天下統一', 'Victory', '天下统一'], lose: ['전선 붕괴', '戦線崩壊', 'Defeat', '防线崩溃'], again: ['다시 출정', 'もう一度出陣', 'Play again', '再次出征'],
    ad: ['광고', '広告', 'Ad', '广告'], adSkip: ['{n}초 뒤 닫기', '{n}秒後に閉じる', 'Close in {n}s', '{n}秒后关闭'], adClose: ['닫기', '閉じる', 'Close', '关闭'], adProto: ['광고 자리(시제품). 실제 앱에서는 2판마다 광고가 한 번 나옵니다.', '広告枠（試作）。実際のアプリでは2回に1回広告が表示されます。', 'Ad slot (prototype). The real app shows one ad every two games.', '广告位（原型）。正式版每两局显示一次广告。'],
    rotate: ['가로로 돌려 주세요', '横向きにしてください', 'Please rotate to landscape', '请横屏游玩'],
    hold: ['보유 {c} {n}', '所持 {c} {n}', '{c} {n}', '持有 {c} {n}'], max: ['최대', '最大', 'Max', '最大'], atkUp: ['공격력 +{n}%', '攻撃力 +{n}%', 'ATK +{n}%', '攻击 +{n}%'],
    sageHead: ['명사 초빙', '名士の招聘', 'Hire sages', '招募名士'], sageHint: ['{a}/{b}명 · 해임해도 금화는 돌아오지 않습니다', '{a}/{b}人・解任しても金貨は戻りません', '{a}/{b} · No refund when dismissed', '{a}/{b}人 · 解任不退还金币'], dismiss: ['해임', '解任', 'Dismiss', '解任'], full: ['자리 없음', '満員', 'Full', '已满'],
    noTicket: ['보유한 선택권이 없습니다.', '選択券がありません。', 'You have no tickets.', '没有选择券。'], noTicketHint: ['중간보스와 보스를 토벌하면 들어옵니다.', '中ボスやボスを倒すと手に入ります。', 'Defeat mid-bosses and bosses to earn them.', '击败中首领与首领可获得。'], ticketN: ['{r} 선택권', '{r} 選択券', '{r} ticket', '{r}选择券'], nSheets: ['{n}장', '{n}枚', '×{n}', '{n}张'], pick: ['선택', '選択', 'Pick', '选择'], close: ['닫기', '閉じる', 'Close', '关闭'], menuLbl: ['메뉴', 'メニュー', 'Menu', '菜单'], owned: ['보유 {n}기', '所持 {n}体', 'Own {n}', '持有{n}个'],
    continueGame: ['이어하기 · R{r} {d}', '続きから・R{r} {d}', 'Continue · R{r} {d}', '继续游戏 · R{r} {d}'],
    passive: ['패시브', 'パッシブ', 'Passive', '被动'], active: ['액티브', 'アクティブ', 'Active', '主动'], command: ['명령', 'コマンド', 'Command', '指令'], noRecipe: ['이 유닛과 관련된 조합식이 없습니다.', 'このユニットに関するレシピはありません。', 'No recipes use this unit.', '没有与此单位相关的配方。'],
    timers: ['보스 타이머', 'ボスタイマー', 'Boss timers', '首领计时'], synergy: ['인연 시너지', '縁のシナジー', 'Bond synergies', '羁绊'], synergyHint: ['인연 있는 인물을 얻으면 여기에 나타납니다.', '縁のある人物を得るとここに表示されます。', 'Bonds appear here when you get related characters.', '获得有羁绊的人物后会在此显示。'],
    special: ['특수', '特殊', 'Special', '特殊'],
    buff_buff: ['강화', '強化', 'Buff', '强化'],
    buff_rally: ['호령', '号令', 'Rally', '号令'],
    buff_cover: ['엄호', '援護', 'Cover', '掩护'],
    buff_psh: ['방진', '方陣', 'Bulwark', '方阵'],
    buff_haste: ['사기', '士気', 'Morale', '士气'],
    buff_taunt: ['진영 사수', '陣地死守', 'Hold', '死守'],
    buff_shield: ['보호', '保護', 'Shield', '保护'],
    ach: ['업적', '実績', 'Feats', '成就'],
    partyNow: ['지금 {n}인 기준 {need}', '現在{n}人で{need}', 'With {n} players: {need}', '当前{n}人：{need}'],
    needAtLeast: ['{n}명 이상', '{n}人以上', 'at least {n}', '至少{n}人'],
    needAll: ['{n}명 모두', '{n}人全員', 'all {n}', '全部{n}人'],
    partyLack: ['인원수가 부족합니다 ({n}인 이상 협동에서 열림)', '人数が足りません（{n}人以上の協力で解放）', 'Not enough players (needs {n}+ co-op)', '人数不足（{n}人以上合作时开放）'],
    progress: ['진행 ({a}/{b})', '進行（{a}/{b}）', 'Progress ({a}/{b})', '进度（{a}/{b}）'],
    lb_coin: ['동전', '銅銭', 'coins', '铜钱'],
    upShort: ['강화 +{n}', '強化 +{n}', 'Upgrade +{n}', '强化 +{n}'],
    mutShort: ['변형 규칙', '変則ルール', 'Modifier', '变异规则'],
    baseAtk: ['기본 공격력', '基本攻撃力', 'Base ATK', '基础攻击'],
    speedShort: ['공속', '攻速', 'Speed', '攻速'],
    noBuff: ['받는 버프 없음', 'バフなし', 'No buffs', '无增益'],
    detOpen: ['상세', '詳細', 'Details', '详情'],
    detClose: ['접기', '閉じる', 'Hide', '收起'],
    aura: ['오라', 'オーラ', 'Aura', '光环'],
    midLeft: ['{name} {n}초', '{name} 残り{n}秒', '{name} {n}s', '{name} 剩{n}秒'],
    reward: ['보상', '報酬', 'Reward', '奖励'],
    rwT1: ['랜덤 1성 {n}기', 'ランダム★1×{n}', 'random ★1 ×{n}', '随机1星×{n}'],
    rwTicket: ['{r} 선택권 {n}장', '{r}選択券×{n}', '{r} ticket ×{n}', '{r}选择券×{n}'],
    rwRandT: ['랜덤 {r} {n}기', 'ランダム{r}×{n}', 'random {r} ×{n}', '随机{r}×{n}'],
    rwChest: ['상자 {n}개', '宝箱×{n}', 'chest ×{n}', '宝箱×{n}'],
    deployed: ['출전 중', '出陣中', 'Deployed', '出战中'],
    peerField: ['{a}의 전장', '{a}の戦場', '{a}\'s field', '{a}的战场'],
    meter: ['딜미터', 'ダメージ', 'Damage', '伤害统计'],
    walkHurt: ['보스 쪽으로 걸으면 피해', 'ボスへ歩くとダメージ', 'Walking toward the boss hurts', '走向首领会受伤'],
    stun: ['기절', '気絶', 'Stunned', '眩晕'],
    groggy: ['그로기', 'ダウン', 'Downed', '倒地'],
    counter: ['반격! 많이 때리기 · 정면은 2배', '反撃！とにかく攻撃・正面は2倍', 'Counter! Hit it a lot · front hits count x2', '反击！多次攻击·正面算2次'],
    weakened: ['약화 +{n}%', '弱体 +{n}%', 'Weakened +{n}%', '削弱 +{n}%'],
    fastOk: ['빠른 클리어 보상 가능', '速攻報酬あり', 'Fast-clear bonus available', '可获速通奖励'],
    fastNo: ['빠른 클리어 시간 초과', '速攻の時間切れ', 'Fast-clear time passed', '速通时间已过'],
    vuln: ['받는 피해 +{n}%', '被ダメージ +{n}%', 'Damage taken +{n}%', '受伤 +{n}%'],
    castLine: ['{a} · 무력화 {p}% · {s}초', '{a}・ブレイク {p}%・{s}秒', '{a} · Break {p}% · {s}s', '{a} · 破防 {p}% · {s}秒'],
    castSpots: [' · 실패하면 초록 원 밖 큰 피해', '・失敗すると緑の円の外に大ダメージ', ' · Fail: heavy damage outside green circles', '・失败则绿圈外受到重创'],
    castAll: [' · 실패하면 모두 최대 체력 60% 피해', '・失敗すると全員最大体力60%ダメージ', ' · Fail: everyone takes 60% max HP', '・失败则全员受到最大生命60%伤害'],
    clones: ['그림자가 있는 쪽이 진짜 · 눌러서 지정', '影のある方が本物・タップして指定', 'The one with a shadow is real · tap to target', '有影子的是真身 · 点击指定'],
    roundPlace: ['{r}라운드 · {p}', '{r}ラウンド・{p}', 'Round {r} · {p}', '第{r}回合 · {p}'],
    appears: ['{a} 등장', '{a} 登場', '{a} appears', '{a} 登场'],
    whose: ['{w}의 ', '{w}の ', '{w}\'s ', '{w}的'],
    whoseGeneral: ['{w}의 무장', '{w}の武将', '{w}\'s general', '{w}的武将'],
    bossDown: ['토벌 성공', '討伐成功', 'Victory', '讨伐成功'],
    timeTaken: ['걸린 시간 {t}', '所要時間 {t}', 'Time {t}', '用时 {t}'],
    fastBonus: ['빠른 클리어 보너스', '速攻ボーナス', 'Fast-clear bonus', '速通奖励'],
    rewardsGot: ['획득 보상', '獲得報酬', 'Rewards', '获得奖励'],
    dmgRank: ['피해 순위', 'ダメージ順位', 'Damage ranking', '伤害排名'],
    legendAppear: ['전설 {title}등장', '伝説 {title}登場', 'Legend {title}appears', '传说 {title}登场'],
    cantUse: ['이 유닛에는 쓸 수 없습니다.', 'このユニットには使えません。', 'Can\'t use this on that unit.', '无法对该单位使用。'],
    disbanded: ['{a} 해산: {c} +{v}', '{a}を解散：{c} +{v}', '{a} disbanded: {c} +{v}', '{a}已解散：{c} +{v}'],
    dismissConfirm: ['{a} 해임: 한 번 더 누르면 해임합니다(환불 없음)', '{a}の解任：もう一度タップすると解任（返金なし）', 'Dismiss {a}: tap again to confirm (no refund)', '解任{a}：再按一次确认（不退款）'],
    atk: ['공격력', '攻撃力', 'ATK', '攻击'],
    hp: ['체력', '体力', 'HP', '生命'],
    range: ['사거리', '射程', 'Range', '射程'],
    interval: ['간격', '間隔', 'Interval', '间隔'],
    sec: ['{n}초', '{n}秒', '{n}s', '{n}秒'],
    hireCost: ['영입 {c} {n}', '招聘 {c} {n}', 'Hire {c} {n}', '招募 {c} {n}'],
    cooldown: ['재사용 {n}초', '再使用 {n}秒', 'Cooldown {n}s', '冷却 {n}秒'],
    combineInto: ['동일 유닛 {a}/{b}기 → 랜덤 {r}', '同じユニット {a}/{b}体 → ランダム{r}', 'Same unit {a}/{b} → random {r}', '相同单位 {a}/{b} → 随机{r}'],
    combineNeed: ['동일 유닛 {b}기 → 랜덤 {r}', '同じユニット {b}体 → ランダム{r}', '{b} of the same unit → random {r}', '{b}个相同单位 → 随机{r}'],
    combineBtn: ['조합', '合成', 'Combine', '合成'],
    cwTitle: ['인연 시너지 확인', '縁のシナジーの確認', 'Bond synergy check', '羁绊确认'],
    cwBody: ['이 조합에 재료로 쓰이는 장수가 빠져서 아래 인연 시너지가 꺼지거나 약해집니다. 그래도 조합할까요?', 'この合成で素材の武将がいなくなるため、下の縁のシナジーが解除、または弱まります。それでも合成しますか？', 'This combine uses up generals that the bond synergies below need, so they will turn off or weaken. Combine anyway?', '此次合成会消耗下列羁绊所需的武将，羁绊将失效或减弱。仍要合成吗？'],
    cwOff: ['꺼짐', '解除', 'Off', '失效'],
    // 인연 시너지 v0.3: 원군 피해 줄 꼬리표, 패널, 설정
    synTag: ['인연', '縁', 'Bond', '羁绊'],
    synLaneH: ['라인', 'ライン', 'Lane', '战线'],
    synBossH: ['보스전', 'ボス戦', 'Boss', '首领战'],
    synNone: ['없음', 'なし', 'None', '无'],
    synTierN: ['{n}명', '{n}人', '{n}', '{n}人'],
    synCore: ['{a}가 있어야 켜집니다', '{a}がいると発動', 'Requires {a}', '需要{a}'],
    synBossNote: ['보스전 효과는 출전 장수가 구성원일 때만, 한 장수에 {n}개까지(등급 높은 순)', 'ボス戦効果は出陣武将が構成員の時だけ。1人{n}個まで（等級の高い順）', 'Boss effects apply only if your champion is a member; up to {n} per champion (highest grade first)', '首领战效果仅在出战武将为成员时生效，每名武将最多{n}个（等级高者优先）'],
    synG1: ['하', '下', 'C', '下'], synG2: ['중', '中', 'B', '中'], synG3: ['상', '上', 'A', '上'], synG4: ['극', '極', 'S', '极'], synG5: ['극+', '極+', 'S+', '极+'],
    synBossLine: ['보스전 인연(이 장수가 출전하면)', 'ボス戦の縁（この武将が出陣すると）', 'Boss bonds (if this unit is deployed)', '首领战羁绊（此武将出战时）'],
    synOverCap: ['상한 초과', '上限超過', 'Over cap', '超出上限'],
    // 왼쪽 인연 줄 끝 버튼과 전체 인연 창(13-info-timers): 켜진 것 / 진행 중 / 시작 안 함
    synAll: ['인연 목록', '縁一覧', 'All bonds', '羁绊一览'], synGrpOn: ['발동 중', '発動中', 'Active', '已激活'], synGrpProg: ['진행 중', '進行中', 'In progress', '进行中'], synGrpNone: ['시작 안 함', '未着手', 'Not started', '未开始'],
    synHelpH: ['인연 시너지', '縁のシナジー', 'Bond synergies', '羁绊'],
    synHelp1: ['보스전 인연 효과는 출전한 구성원 중 한 명(주장)에게만, 한 장수에 {n}개까지 걸립니다(등급 높은 순).', 'ボス戦の縁の効果は出陣した構成員のうち1人（主将）だけに、1人{n}個まで（等級の高い順）。', 'Boss bond effects go to one deployed member (your carry), up to {n} per champion (highest grade first).', '首领战羁绊效果只作用于出战成员中的一人（主将），每名武将最多{n}个（等级高者优先）。'],
    synHelp2: ['스킬 재사용 단축이 합쳐서 60%를 넘으면, 넘친 만큼 스킬 피해가 오릅니다.', 'スキル再使用短縮の合計が60%を超えると、超えた分だけスキルダメージが上がります。', 'Cooldown reduction above 60% in total turns into the same amount of skill damage.', '技能冷却缩减合计超过60%时，超出部分转为等量技能伤害。'],
    cwDownG: ['{a}단계({ga}) → {b}단계({gb})', '{a}段階({ga}) → {b}段階({gb})', 'Tier {a} ({ga}) → {b} ({gb})', '{a}阶({ga}) → {b}阶({gb})'],
    cwOffG: ['{a}단계({ga}) → 꺼짐', '{a}段階({ga}) → 解除', 'Tier {a} ({ga}) → off', '{a}阶({ga}) → 失效'],
    keepSyn: ['인연 유지', '縁を維持', 'Keep bonds', '保留羁绊'],
    keepSynHint: ['자동 조합이 켜진 인연의 마지막 한 기를 남깁니다', '自動合成で、発動中の縁の最後の1体を残します', 'Auto-combine keeps the last unit an active bond needs', '自动合成时保留已激活羁绊所需的最后一个单位'],
    cwDown: ['{a}단계 → {b}단계', '{a}段階 → {b}段階', 'Tier {a} → {b}', '{a}阶 → {b}阶'],
    cwGo: ['조합하기', '合成する', 'Combine', '合成'],
    cwCancel: ['취소', 'キャンセル', 'Cancel', '取消'],
    moreInBook: ['외 {n}개는 도감에서 볼 수 있습니다.', 'ほか{n}件は図鑑で見られます。', '{n} more in the Codex.', '其余{n}项可在图鉴查看。'],
    stopDesc: ['출전 장수를 멈춥니다.', '出陣武将を止めます。', 'Stops your champion.', '让出战武将停下。'],
    itemSub: ['{r} 조합 아이템', '{r}の合成アイテム', '{r} crafting item', '{r}合成道具'],
    itemLocked: ['{a}을(를) 해금하면 합성할 수 있습니다', '{a}を解放すると合成できます', 'Unlock {a} to craft with it', '解锁{a}后即可合成'],
    useHint: ['사용 버튼을 누른 뒤 유닛을 누르세요.', '使用をタップしてからユニットをタップしてください。', 'Press Use, then tap a unit.', '按使用后再点单位。'],
    laneStopped: ['라인 전투가 멈췄습니다.', 'ラインの戦闘は停止中です。', 'The lane is paused.', '防线战斗已暂停。'],
    peerHint: ['유닛을 누르면 정보를 볼 수 있습니다. 조작은 할 수 없습니다.', 'ユニットをタップすると情報を見られます。操作はできません。', 'Tap a unit to see info. You can\'t control it.', '点击单位可查看信息，无法操作。'],
    peerUnits: ['다른 사령관의 유닛은 정보만 볼 수 있습니다.', '他の司令官のユニットは情報のみ見られます。', 'You can only view other commanders\' units.', '其他指挥官的单位只能查看信息。'],
    commandHead: ['전장 지휘', '戦場指揮', 'Command', '战场指挥'],
    commandHint: ['유닛을 누르거나 끌어서 선택하세요. 게임판의 상자는 누르면 열립니다.', 'ユニットをタップするかドラッグして選択。盤上の宝箱はタップすると開きます。', 'Tap or drag to select units. Tap chests to open them.', '点击或拖动选择单位，点击宝箱即可打开。'],
    recipeHint: ['유닛을 선택하면 조합식이 여기 표시됩니다.', 'ユニットを選ぶとレシピがここに表示されます。', 'Select a unit to see recipes here.', '选择单位后此处显示配方。'],
    nSelected: ['{n}기 선택', '{n}体選択', '{n} selected', '已选{n}个'],
    recipeOne: ['유닛 1기를 선택하면 조합식이 표시됩니다.', 'ユニットを1体選ぶとレシピが表示されます。', 'Select one unit to see recipes.', '选择1个单位即可显示配方。'],
    noChamp: ['유닛 미선택', '未選択', 'No unit selected', '未选择单位'],
    noChampHint: ['유닛을 누르면 조작할 수 있습니다.', 'ユニットをタップすると操作できます。', 'Tap a unit to control it.', '点击单位即可操控。'],
    curHp: ['현재 체력', '現在の体力', 'Current HP', '当前生命'],
    subDeploy: ['대체 출전', '交代出陣', 'Substitute', '替补出战'],
    noSubs: ['남은 유닛이 없습니다.', '残りのユニットはいません。', 'No units left.', '没有剩余单位。'],
    hwataHeal: ['화타 치료 {n}회', '華佗の治療 {n}回', 'Hua Tuo heal ×{n}', '华佗治疗{n}次'],
    attackShort: ['공격', '攻撃', 'Attack', '攻击'],
    upg: ['업글 {n}', '強化{n}', '+{n}', '强化{n}'],
    nUnits: ['{n}기', '{n}体', '×{n}', '{n}个'],
    fastHint: ['제한 시간 35% 이상 남기면 {r} 선택권 1장 추가', '制限時間を35%以上残すと{r}選択券+1', 'Finish with 35%+ time left for +1 {r} ticket', '剩余时间35%以上可额外获得{r}选择券1张'],
    limit: ['제한 {t}', '制限 {t}', 'Limit {t}', '时限 {t}'],
    recommend: ['권장', '推奨', 'Suggested', '推荐'],
    or: ['또는', 'または', 'or', '或'],
    limit45: ['제한 45초', '制限45秒', 'Limit 45s', '时限45秒'],
    onPath: ['지나는 길목에 {a}', '通り道に{a}', '{a} along its path', '在其路线上放{a}'],
    appearShort: ['등장', '登場', 'Here', '登场'],
    field: ['전장', '戦場', 'On field', '战场'],
    respawn: ['재등장', '再出現', 'Returns', '再现'],
    downed: ['토벌', '討伐', 'Defeated', '已讨伐'],
    mutHead: ['변형 규칙 · 악몽 +{n}', '変則ルール・悪夢 +{n}', 'Modifiers · Nightmare +{n}', '变异规则 · 噩梦 +{n}'],
    mutSkip: ['화면을 누르면 건너뜁니다', '画面をタップでスキップ', 'Tap to skip', '点击屏幕跳过'],
    reachRound: ['도달 라운드', '到達ラウンド', 'Round reached', '到达回合'],
    playTime: ['플레이 시간', 'プレイ時間', 'Play time', '游戏时间'],
    kills: ['처치', '撃破', 'Kills', '击杀'],
    midboss: ['중간보스', '中ボス', 'Mid-bosses', '中首领'],
    midKills: ['{n} 토벌', '{n}討伐', '{n} defeated', '讨伐{n}'],
    midMiss: ['{n}회 놓침', '{n}回逃した', '{n} escaped', '{n}次逃脱'],
    noMiss: ['놓침 없음', '逃しなし', 'None escaped', '无逃脱'],
    lifeLost: ['라이프 손실', '失ったライフ', 'Lives lost', '损失生命'],
    livesLeft: ['남은 라이프 {n}', '残りライフ {n}', '{n} lives left', '剩余生命 {n}'],
    bestTier: ['최고 등급', '最高等級', 'Best unit', '最高等级'],
    goldEarned: ['번 금화', '獲得金貨', 'Gold earned', '获得金币'],
    upHire: ['강화 {a} · 영입 {b}', '強化 {a}・招聘 {b}', 'Upgrades {a} · Hires {b}', '强化 {a} · 招募 {b}'],
    combCraft: ['합성 · 조합', '合成・レシピ', 'Combines · Crafts', '合成 · 配方'],
    tixChest: ['선택권 {a}장 · 상자 {b}개', '選択券{a}枚・宝箱{b}個', '{a} tickets · {b} chests', '选择券{a}张 · 宝箱{b}个'],
    fastClear: ['빠른 클리어', '速攻', 'Fast clear', '速通'],
    fail: ['실패', '失敗', 'Failed', '失败'],
    lvN: ['{n}강', '+{n}', '+{n}', '+{n}'],
    none: ['없음', 'なし', 'None', '无'],
    nCoop: ['{n}인 협동', '{n}人協力', '{n}-player co-op', '{n}人合作'],
    bossLog: ['보스전 기록', 'ボス戦の記録', 'Boss fights', '首领战记录'],
    thBoss: ['보스', 'ボス', 'Boss', '首领'],
    thResult: ['결과', '結果', 'Result', '结果'],
    thTime: ['시간', '時間', 'Time', '时间'],
    thChamp: ['출전', '出陣', 'Champions', '出战'],
    noBossLog: ['보스전 기록이 없습니다.', 'ボス戦の記録はありません。', 'No boss fights.', '没有首领战记录。'],
    laneDmgRank: ['라인 피해 순위', 'ラインのダメージ順位', 'Lane damage ranking', '防线伤害排名'],
    noRecord: ['기록 없음', '記録なし', 'No records', '无记录'],
    craftedHead: ['조합한 장수', '合成した武将', 'Crafted generals', '合成的武将'],
    pickInfo: ['{title} · {name} · 제한 {t} · {n}기 출전 · <strong>{s}초</strong> 뒤 자동 출전', '{title}・{name}・制限 {t}・{n}体出陣・<strong>{s}秒</strong>後に自動出陣', '{title} · {name} · Limit {t} · {n} champions · auto-deploy in <strong>{s}s</strong>', '{title} · {name} · 时限 {t} · 出战{n}个 · <strong>{s}秒</strong>后自动出战'],
    recommendColon: ['권장: {a}', '推奨：{a}', 'Suggested: {a}', '推荐：{a}'],
    pickCard: ['{r} · 공격 {a} · 체력 {h}', '{r}・攻撃 {a}・体力 {h}', '{r} · ATK {a} · HP {h}', '{r} · 攻击 {a} · 生命 {h}'],
    skillsList: [' · 스킬 {a}', '・スキル {a}', ' · Skills {a}', ' · 技能 {a}'],
    waitTitle: ['잠시 멈춤', '一時停止', 'Paused', '暂停'],
    waitFor: ['{a}의 연결을 기다리는 중입니다.', '{a}の接続を待っています。', 'Waiting for {a} to reconnect.', '正在等待{a}重新连接。'],
    rwCons: ['{a} {n}장', '{a}×{n}', '{a} ×{n}', '{a}×{n}'],
    e_fused: ['신화 아이템 4개 → {a}', '神話アイテム4個 → {a}', '4 Myth items → {a}', '4个神话道具 → {a}'],
    fuseBtn: ['신화 아이템 4개 → 랜덤 불멸 아이템', '神話アイテム4個 → ランダム不滅アイテム', '4 Myth items → random Immortal item', '4个神话道具 → 随机不灭道具'],
    fuseHave: ['보유 {n}/4', '所持 {n}/4', 'Have {n}/4', '持有 {n}/4'],
    tut_next: ['다음', '次へ', 'Next', '下一步'],
    tut_done: ['마치기', '完了', 'Finish', '完成'],
    tut_skip: ['건너뛰기', 'スキップ', 'Skip', '跳过'],
    tut_ok: ['확인', 'OK', 'OK', '确定'],
    tut_l_hello: ['<b>삼국 랜덤 디펜스</b>에 오신 것을 환영합니다!<br>무작위로 들어오는 삼국지 유닛을 <b>합성</b>하고 <b>조합</b>해 더 강한 장수를 만들고, 몰려오는 적과 <b>보스</b>를 막아내는 게임입니다.<br>먼저 한 판 해 보면서 배워 봅시다.', '<b>三国ランダムディフェンス</b>へようこそ！<br>ランダムに加わる三国志のユニットを<b>合成</b>し、<b>レシピ</b>で組み合わせて強い武将を作り、押し寄せる敵と<b>ボス</b>を食い止めるゲームです。<br>まずは1回遊びながら覚えましょう。', 'Welcome to <b>Three Kingdoms Random Defense</b>!<br>You <b>combine</b> and <b>craft</b> randomly drawn Three Kingdoms units into stronger generals, and hold off waves of enemies and <b>bosses</b>.<br>Let\'s learn by playing a round.', '欢迎来到<b>三国随机防御</b>！<br>把随机获得的三国单位<b>合成</b>、<b>组合</b>成更强的武将，抵挡不断涌来的敌人和<b>首领</b>。<br>先玩一局，边玩边学吧。'],
    boot_assets: ['그림을 불러오는 중…', '画像を読み込み中…', 'Loading art…', '正在加载图片…'],
    boot_account: ['계정 정보를 불러오는 중…', 'アカウント情報を読み込み中…', 'Loading your account…', '正在加载账号信息…'],
    boot_done: ['준비 완료', '準備完了', 'Ready', '准备完成'],
    boot_loginHead: ['시작하기', 'はじめる', 'Get started', '开始游戏'],
    boot_loginHint: ['계정을 만들면 기록과 해금한 장수가 저장됩니다. 게스트로 시작해도 나중에 Apple·Google 계정에 연결할 수 있습니다.', 'アカウントを作ると、記録や解放した武将が保存されます。ゲストで始めても、あとでApple・Googleアカウントに連携できます。', 'An account saves your records and unlocked generals. If you start as a guest, you can link an Apple or Google account later.', '创建账号后会保存记录和已解锁的武将。以游客身份开始，之后也可以绑定 Apple 或 Google 账号。'],
    boot_offline: ['오프라인으로 시작', 'オフラインで始める', 'Start offline', '离线开始'],
    boot_nickHead: ['닉네임을 정해 주세요', 'ニックネームを決めてください', 'Choose a nickname', '请设置昵称'],
    boot_nickHint: ['다른 플레이어에게 보이는 이름입니다(12자까지). 나중에 바꿀 수 있습니다.', 'ほかのプレイヤーに表示される名前です（12文字まで）。あとで変更できます。', 'This name is shown to other players (up to 12 characters). You can change it later.', '这是显示给其他玩家的名字（最多12个字）。之后可以更改。'],
    boot_next: ['다음', '次へ', 'Next', '下一步'],
    boot_trackHead: ['관직 갈래를 고르세요', '官職の系統を選んでください', 'Choose your career path', '请选择官职路线'],
    boot_trackHint: ['등급이 오를 때 받는 칭호가 달라집니다. 능력 차이는 없고, 언제든 바꿀 수 있습니다.', '階級が上がったときの称号が変わります。強さに差はなく、いつでも変更できます。', 'It changes the titles you earn as you rank up. It has no effect on strength and can be changed anytime.', '会影响升级时获得的称号。强度没有差别，随时可以更改。'],
    boot_trackMil: ['장수의 길 — 무장 칭호', '武将の道 — 武官の称号', 'Path of the warrior — military titles', '武将之路 — 武官称号'],
    boot_trackCiv: ['책사의 길 — 문신 칭호', '軍師の道 — 文官の称号', 'Path of the strategist — civil titles', '谋士之路 — 文官称号'],
    boot_start: ['시작', 'はじめる', 'Start', '开始'],
    tut_l_battle: ['<b>전투 시작</b>을 누르세요.', '<b>出陣</b>をタップしてください。', 'Tap <b>Battle</b>.', '点击<b>出征</b>。'],
    tut_l_wiz: ['<b>싱글 플레이</b> → <b>단독</b> → <b>쉬움</b>을 고르고 <b>출정</b>을 누르세요.', '<b>シングルプレイ</b> → <b>ひとり</b> → <b>かんたん</b>を選んで<b>出陣</b>をタップしてください。', 'Choose <b>Single Play</b> → <b>Solo</b> → <b>Easy</b>, then tap <b>Deploy</b>.', '依次选择<b>单人游戏</b> → <b>单人</b> → <b>简单</b>，然后点击<b>出征</b>。'],
    tut_hello: ['적이 길을 따라 성채 둘레를 돕니다. 왼쪽 위의 <b>전선</b> 수가 한도를 넘거나 중간보스를 놓치면 <b>라이프</b>가 줄고, 0이 되면 패배합니다.', '敵は道に沿って城の周りを回ります。左上の<b>戦線</b>の数が上限を超えたり、中ボスを逃したりすると<b>ライフ</b>が減り、0で敗北です。', 'Enemies circle the fortress along the road. If the <b>Front</b> count (top left) goes over the limit or a mid-boss escapes, you lose <b>Lives</b>. At 0 you lose.', '敌人沿道路绕着城池移动。左上角<b>战线</b>数量超过上限或放走中首领会减少<b>生命</b>，归零即失败。'],
    tut_select: ['성채 주변의 유닛을 <b>눌러서 선택</b>해 보세요.<br><small>길게 누르고 끌면 범위 선택, 같은 유닛을 두 번 누르면 같은 종류 모두 선택</small>', '城の周りのユニットを<b>タップして選択</b>してみましょう。<br><small>長押しでドラッグすると範囲選択、同じユニットを2回タップすると同じ種類をまとめて選択</small>', '<b>Tap a unit</b> near the fortress to select it.<br><small>Long-press and drag to box-select; tap the same unit twice to select all of that type.</small>', '<b>点击</b>城池周围的单位试试看。<br><small>长按拖动可框选，连点同一单位可选中同类全部</small>'],
    tut_move: ['왼쪽 아래 <b>조이스틱</b>을 밀어 유닛을 <b>옮겨 보세요</b>.<br><small>빈 곳을 끌면 지도가 움직입니다. 유닛 선택이 풀렸으면 다시 누르세요. 오른쪽 아래 <b>공격</b> 버튼을 누르고 있으면 움직이면서 중간보스부터 칩니다.</small>', '左下の<b>ジョイスティック</b>を動かして、ユニットを<b>移動させてみましょう</b>。<br><small>何もない所をドラッグすると地図が動きます。選択が外れたらもう一度タップ。右下の<b>攻撃</b>ボタンを押している間は、移動しながら中ボスを優先して攻撃します。</small>', 'Push the <b>joystick</b> at the bottom left to <b>move the unit</b>.<br><small>Drag an empty spot to pan the map. If the selection is gone, tap the unit again. Hold the <b>attack</b> button at the bottom right to attack while moving, mid-bosses first.</small>', '推动左下角的<b>摇杆</b>，<b>移动</b>单位试试。<br><small>拖动空白处可移动地图。若取消了选择，请再次点击单位。按住右下角的<b>攻击</b>按钮，可边移动边攻击，优先攻击中首领。</small>'],
    tut_reward: ['라운드가 끝날 때마다 <b>무작위 1성 유닛</b>이 들어옵니다. 이것이 이 게임의 <b>뽑기</b>입니다.<br>다음 라운드까지 지켜봅시다.', 'ラウンドが終わるたびに<b>ランダムな★1ユニット</b>が届きます。これがこのゲームの<b>ガチャ</b>です。<br>次のラウンドまで様子を見ましょう。', 'At the end of every round you get <b>random ★1 units</b> — that\'s the <b>draw</b> in this game.<br>Let\'s watch until the next round.', '每回合结束都会获得<b>随机1星单位</b>，这就是本游戏的<b>抽卡</b>。<br>看看下一回合吧。'],
    tut_combine: ['<b>{a}</b>이(가) 모였습니다! 그 유닛을 누르고 <b>조합</b> 버튼으로 <b>합성</b>해 보세요. 같은 유닛을 모으면 한 등급 위 유닛이 됩니다.', '<b>{a}</b>が揃いました！そのユニットをタップして<b>合成</b>ボタンで合成してみましょう。同じユニットを集めると1つ上の等級になります。', 'You have enough <b>{a}</b>! Tap one and press <b>Combine</b>. Copies of the same unit merge into a higher tier.', '<b>{a}</b>已集齐！点击该单位，用<b>合成</b>按钮合成试试。相同单位集齐后会升一个等级。'],
    tut_upgrade: ['금화가 모였습니다. 오른쪽 <b>강화</b>를 열고 강화를 하나 사 보세요. 등급 묶음별로 공격력이 오릅니다.<br><small>금화는 정예 적 처치, 유닛 해산, 보상으로 들어옵니다.</small>', '金貨が貯まりました。右の<b>強化</b>を開いて、強化を1つ買ってみましょう。等級グループごとに攻撃力が上がります。<br><small>金貨は精鋭の撃破・ユニット解散・報酬で手に入ります。</small>', 'You have gold. Open <b>Upgrade</b> on the right and buy one. Each tier group gets more ATK.<br><small>Gold comes from elite kills, disbanding units and rewards.</small>', '金币够了。打开右侧<b>强化</b>，买一级强化试试。各等级组的攻击力会提升。<br><small>金币来自击败精英、解散单位和奖励。</small>'],
    tut_book: ['이제 조합법을 봅시다. 오른쪽 버튼으로 <b>서랍</b>을 여세요.', '次はレシピを見てみましょう。右のボタンで<b>メニュー</b>を開いてください。', 'Now let\'s look at recipes. Open the <b>drawer</b> with a button on the right.', '来看看配方吧。用右侧按钮打开<b>抽屉</b>。'],
    tut_book2: ['<b>도감</b> 탭을 누르세요.', '<b>図鑑</b>タブをタップしてください。', 'Tap the <b>Codex</b> tab.', '点击<b>图鉴</b>标签。'],
    tut_myth: ['★7부터는 <b>인연 있는 장수</b>들과 보스 상자의 <b>아이템</b>을 모아 <b>조합</b>합니다. 이것이 ★9 <b>신화</b>의 조합법입니다.<br><small>★9 신화와 ★10 불멸은 처음엔 잠겨 있어 상점에서 열어야 만들 수 있습니다.</small>', '★7からは<b>縁のある武将</b>とボス宝箱の<b>アイテム</b>を集めて<b>合成</b>します。これが★9<b>神話</b>のレシピです。<br><small>★9神話と★10不滅は最初はロックされていて、ショップで解放すると作れるようになります。</small>', 'From ★7 up you <b>craft</b> from <b>bonded generals</b> plus <b>items</b> from boss chests. This is a ★9 <b>Myth</b> recipe.<br><small>★9 Myths and ★10 Immortals start locked; unlock them in the Shop to craft them.</small>', '7星起要集齐<b>有羁绊的武将</b>和首领宝箱的<b>道具</b>来<b>组合</b>。这是★9<b>神话</b>的配方。<br><small>★9神话和★10不灭一开始是锁定的，需在商店解锁后才能组合。</small>'],
    tut_auto: ['<b>자동</b>은 처음에 꺼져 있습니다. 눌러서 켜 보세요.<br>켜면 1~3성 유닛을 알아서 자리에 정렬하고, 같은 유닛이 모이면 합성합니다. 끄면 직접 옮기고 합성해야 합니다.<br><small>한 번 켜면 다음 판에도 켜진 채 시작합니다. 등급별 설정은 설정 탭에 있습니다.</small>', '<b>自動</b>は最初はオフです。タップしてオンにしてみましょう。<br>オンにすると★1〜3のユニットを自動で整列し、同じユニットがそろうと合成します。オフのときは自分で動かして合成します。<br><small>一度オンにすると次のバトルもオンのまま始まります。等級ごとの設定は設定タブにあります。</small>', '<b>Auto</b> starts off. Tap it to turn it on.<br>When on, it sorts ★1–3 units into place and combines matching units for you. When off, you move and combine them yourself.<br><small>Once on, it stays on for your next games. Per-tier options are in the Settings tab.</small>', '<b>自动</b>一开始是关闭的。点一下打开试试。<br>打开后会自动整理1~3星单位，有相同单位时自动合成。关闭时需要自己移动和合成。<br><small>打开一次后，下一局也会保持打开。各星级的设置在设置页。</small>'],
    tut_mid: ['<b>중간보스</b> 등장! 45초 안에 잡지 못하면 라이프가 줄어듭니다. 유닛을 중간보스가 지나는 길목으로 옮겨 집중 공격하세요.<br><small>잡으면 보상을, 보스를 잡으면 원하는 유닛을 고르는 <b>선택권</b>도 받습니다.</small>', '<b>中ボス</b>登場！45秒以内に倒せないとライフが減ります。ユニットを中ボスの通り道へ動かして集中攻撃しましょう。<br><small>倒すと報酬、ボスを倒すと好きなユニットを選べる<b>選択券</b>ももらえます。</small>', 'A <b>mid-boss</b> appeared! Fail to defeat it within 45 seconds and you lose a life. Move units to its path and focus it down.<br><small>Mid-bosses give rewards; bosses also give <b>tickets</b> to pick the unit you want.</small>', '<b>中首领</b>出现！45秒内未击败会减少生命。把单位移到它经过的路口集中攻击。<br><small>击败可获得奖励，击败首领还会获得可自选单位的<b>选择券</b>。</small>'],
    tut_pick: ['<b>보스전</b>입니다! 출전할 장수를 고르세요. 시간이 지나면 강한 순서로 자동 출전합니다.', '<b>ボス戦</b>です！出陣する武将を選びましょう。時間が来ると強い順に自動で出陣します。', 'It\'s a <b>boss fight</b>! Choose your champions. When time runs out the strongest go automatically.', '<b>首领战</b>开始！选择出战的武将，时间到会按强弱自动出战。'],
    tut_fight: ['보스전에서는 장수를 <b>직접 움직입니다</b>. 왼쪽 <b>조이스틱</b>으로 바닥의 공격 표시를 피하세요.<br>오른쪽 아래 큰 버튼을 <b>누르고 있는 동안만 공격</b>합니다. 둘레의 작은 버튼은 <b>스킬</b>입니다. 꾹 누른 채 끌면 방향을 정할 수 있습니다.', 'ボス戦では武将を<b>自分で動かします</b>。左の<b>ジョイスティック</b>で床の攻撃表示を避けましょう。<br>右下の大きなボタンを<b>押している間だけ攻撃</b>します。まわりの小さなボタンは<b>スキル</b>です。長押ししたままドラッグすると向きを決められます。', 'In boss fights you <b>control your champion</b>. Use the <b>joystick</b> on the left to dodge the markers on the floor.<br>You <b>only attack while holding</b> the big button at the bottom right. The small buttons around it are <b>skills</b>; press and drag to aim.', '首领战中由你<b>亲自操控</b>武将。用左侧<b>摇杆</b>躲开地面上的攻击标记。<br>只有<b>按住</b>右下角的大按钮时才会<b>攻击</b>。周围的小按钮是<b>技能</b>，按住并拖动可选择方向。'],
    tut_end: ['첫 보스를 넘겼습니다! 기본은 여기까지입니다. 보스 일정은 <b>전황</b>, 조합법은 <b>도감</b>에서 볼 수 있습니다.<br>이 판을 끝까지 클리어하면 <b>상점</b>이 열립니다.', '最初のボスを越えました！基本はここまでです。ボスの予定は<b>戦況</b>、レシピは<b>図鑑</b>で見られます。<br>このバトルをクリアすると<b>ショップ</b>が開きます。', 'You got past the first boss! That\'s the basics. See the boss schedule in <b>Status</b> and recipes in the <b>Codex</b>.<br>Clear this game to open the <b>Shop</b>.', '你闯过了第一个首领！基础就到这里。首领日程见<b>战况</b>，配方见<b>图鉴</b>。<br>通关本局即可开放<b>商店</b>。'],
    shop_open: ['<b>쉬움 클리어</b>를 축하합니다! <b>상점</b>이 열렸습니다. 눌러 보세요.', '<b>「かんたん」クリア</b>おめでとうございます！<b>ショップ</b>が開きました。タップしてみましょう。', 'Congratulations on <b>clearing Easy</b>! The <b>Shop</b> is now open. Tap it.', '恭喜<b>通关简单</b>！<b>商店</b>已开放，点击看看。'],
    shop_unlock: ['<b>장수 해금</b> 탭에서는 잠긴 ★9 <b>신화</b>와 ★10 <b>불멸</b>을 <b>동전</b>·<b>광고 보상</b>·<b>결제</b>로 엽니다(로그인 필요). 동전은 판을 끝낼 때 받습니다.<br>상점이 열린 기념으로 <b>신화 2명</b>을 무작위로 열어 드렸습니다.', '<b>武将解放</b>タブでは、ロック中の★9<b>神話</b>と★10<b>不滅</b>を<b>銅銭</b>・<b>広告視聴</b>・<b>購入</b>で解放できます（ログインが必要）。銅銭はバトルを終えるともらえます。<br>ショップ開放の記念に、<b>神話武将2人</b>をランダムで解放しました。', 'In the <b>Unlock generals</b> tab you unlock locked ★9 <b>Myths</b> and ★10 <b>Immortals</b> with <b>coins</b>, <b>ads</b> or <b>purchases</b> (login required). You earn coins by finishing games.<br>To celebrate, <b>2 random Myth generals</b> have been unlocked for you.', '在<b>解锁武将</b>标签中，可用<b>铜钱</b>、<b>看广告</b>或<b>购买</b>解锁★9<b>神话</b>和★10<b>不灭</b>（需登录）。铜钱在对局结束时获得。<br>为庆祝商店开放，已为你随机解锁<b>2名神话武将</b>。'],
    tip_sage: ['금화가 <b>명사</b> 값에 닿았습니다. <b>명사</b>를 영입하면 금화·공격력 같은 특수 효과를 줍니다.<br><small>오른쪽 명사 버튼에서 영입합니다.</small>', '金貨が<b>名士</b>を招聘できる額になりました。<b>名士</b>を招聘すると金貨や攻撃力などの特殊効果が得られます。<br><small>右の名士ボタンから招聘できます。</small>', 'You can afford a <b>Sage</b>. Hired sages grant special effects like gold or ATK.<br><small>Hire them from the Sages button on the right.</small>', '金币已够招募<b>名士</b>。名士能提供金币、攻击等特殊效果。<br><small>可通过右侧名士按钮招募。</small>'],
    tip_syn: ['<b>인연 시너지</b>가 켜졌습니다! 인연 있는 장수가 함께 있으면 능력이 오릅니다.<br><small>왼쪽 시너지 칸을 누르면 효과를 볼 수 있습니다.</small>', '<b>縁のシナジー</b>が発動しました！縁のある武将がそろうと能力が上がります。<br><small>左のシナジー欄をタップすると効果を確認できます。</small>', 'A <b>bond synergy</b> is active! Generals with historical bonds boost each other when fielded together.<br><small>Tap the synergy bar on the left for details.</small>', '<b>羁绊</b>已激活！有羁绊的武将同时在场时能力会提升。<br><small>点击左侧羁绊栏可查看效果。</small>'],
    tip_ticket: ['<b>선택권</b>을 받았습니다! 원하는 유닛을 직접 골라 받는 표입니다.<br><small>오른쪽 선택권 버튼에서 씁니다. 중간보스와 보스를 잡으면 들어옵니다.</small>', '<b>選択券</b>を手に入れました！好きなユニットを自分で選んで受け取れます。<br><small>右の選択券ボタンから使います。中ボスやボスを倒すと手に入ります。</small>', 'You got a <b>Ticket</b>! It lets you pick the unit you want.<br><small>Use it from the Tickets button on the right. Mid-bosses and bosses drop them.</small>', '获得了<b>选择券</b>！可以自己挑选想要的单位。<br><small>在右侧的选择券按钮中使用。击败中首领和首领可以获得。</small>'],
    tip_speed: ['<b>배속</b> 버튼으로 게임 속도를 바꿀 수 있습니다.<br><small>익숙해지면 빠르게 돌려 보세요. 보스전은 항상 기본 속도입니다.</small>', '<b>速度</b>ボタンでゲームの速さを変えられます。<br><small>慣れてきたら速くしてみましょう。ボス戦はいつも通常の速さです。</small>', 'The <b>Speed</b> button changes the game speed.<br><small>Speed up once you are comfortable. Boss fights always run at normal speed.</small>', '用<b>速度</b>按钮可以改变游戏速度。<br><small>熟悉后可以调快。首领战始终是普通速度。</small>'],
    tip_tab_upgrade: ['<b>강화</b> 탭입니다. 금화로 등급 묶음별 공격력을 올립니다. 한 단계마다 그 묶음의 유닛 모두가 강해집니다.<br><small>값은 살 때마다 오릅니다. 지금 많이 쓰는 등급부터 올리세요.</small>', '<b>強化</b>タブです。金貨で等級グループごとの攻撃力を上げます。1段階ごとにそのグループのユニット全員が強くなります。<br><small>買うたびに値段が上がります。今よく使う等級から上げましょう。</small>', 'This is the <b>Upgrade</b> tab. Spend gold to raise attack for a tier group. Each level strengthens every unit in that group.<br><small>The price rises with each purchase. Start with the tiers you use most.</small>', '这是<b>强化</b>页。用金币提升各星级分组的攻击力。每升一级，该分组的所有单位都会变强。<br><small>每次购买价格都会上涨。先强化现在常用的星级。</small>'],
    tip_tab_sage: ['<b>명사</b> 탭입니다. 금화로 명사를 초빙하면 금화 수입, 공격력 같은 <b>판 전체에 걸리는 효과</b>를 줍니다. 명사는 싸우지 않습니다.<br><small>초빙할 수 있는 수에 한도가 있고, 해임해도 금화는 돌아오지 않습니다. 이름 옆 설명을 읽고 고르세요.</small>', '<b>名士</b>タブです。金貨で名士を招聘すると、金貨の収入や攻撃力など<b>バトル全体に効く効果</b>がつきます。名士は戦いません。<br><small>招聘できる人数には上限があり、解任しても金貨は戻りません。名前の横の説明を読んで選びましょう。</small>', 'This is the <b>Sages</b> tab. Hire sages with gold for <b>effects that last the whole game</b>, such as gold income or attack. Sages do not fight.<br><small>You can hire only a limited number, and dismissing one gives no refund. Read each description before choosing.</small>', '这是<b>名士</b>页。用金币招募名士，可以获得金币收入、攻击力等<b>整局生效的效果</b>。名士不参加战斗。<br><small>可招募的人数有上限，解任也不退还金币。请先看名字旁的说明再选择。</small>'],
    tip_tab_ticket: ['<b>선택권</b> 탭입니다. 가진 선택권이 등급별로 보입니다. <b>사용</b>을 누르면 그 등급의 유닛 중 하나를 골라 받습니다.<br><small>조합에 모자란 유닛을 채울 때 쓰면 좋습니다.</small>', '<b>選択券</b>タブです。持っている選択券が等級ごとに表示されます。<b>使う</b>をタップすると、その等級のユニットから1体を選んで受け取れます。<br><small>合成に足りないユニットを補うときに使うと便利です。</small>', 'This is the <b>Tickets</b> tab. Your tickets are listed by tier. Tap <b>Use</b> to pick one unit of that tier.<br><small>Best used to fill in a unit you are missing for a recipe.</small>', '这是<b>选择券</b>页。按星级显示你持有的选择券。点<b>使用</b>可以从该星级的单位中选一个。<br><small>适合用来补上合成时缺少的单位。</small>'],
    tip_tab_book: ['<b>도감</b> 탭입니다. 모든 유닛과 <b>조합법</b>이 등급별로 있습니다. 유닛을 누르면 필요한 재료와 지금 가진 수를 볼 수 있습니다.<br><small>만들고 싶은 장수를 정하고 재료를 모으세요.</small>', '<b>図鑑</b>タブです。すべてのユニットと<b>レシピ</b>が等級ごとに並んでいます。ユニットをタップすると、必要な材料と今持っている数が見られます。<br><small>作りたい武将を決めて材料を集めましょう。</small>', 'This is the <b>Codex</b> tab. Every unit and its <b>recipe</b> is listed by tier. Tap a unit to see what it needs and how many you have.<br><small>Pick a general to aim for and gather the materials.</small>', '这是<b>图鉴</b>页。按星级列出所有单位和<b>合成方法</b>。点击单位可以查看所需材料和现在持有的数量。<br><small>先决定想做的武将，再收集材料。</small>'],
    tip_tab_war: ['<b>전황</b> 탭입니다. 다음 <b>보스가 언제 오는지</b>와 지금 켜진 <b>인연 시너지</b>를 봅니다.<br><small>보스가 오기 전에 강한 장수를 준비해 두세요.</small>', '<b>戦況</b>タブです。次の<b>ボスがいつ来るか</b>と、今有効な<b>縁のシナジー</b>が見られます。<br><small>ボスが来る前に強い武将を用意しておきましょう。</small>', 'This is the <b>Status</b> tab. It shows <b>when the next boss arrives</b> and which <b>bond synergies</b> are active.<br><small>Get strong generals ready before the boss comes.</small>', '这是<b>战况</b>页。可以查看下一个<b>首领何时到来</b>，以及现在生效的<b>羁绊</b>。<br><small>在首领到来之前准备好强力武将。</small>'],
    tip_tab_set: ['<b>설정</b> 탭입니다. 언어·화질·소리와 함께 <b>자동 정렬·합성</b>을 등급별로 켜고 끄고, 정렬할 자리를 정할 수 있습니다.<br><small>안내 다시 보기와 판 나가기도 여기에 있습니다.</small>', '<b>設定</b>タブです。言語・画質・サウンドのほか、<b>自動整列・合成</b>を等級ごとにオン・オフし、整列する場所を決められます。<br><small>チュートリアルの再表示とバトルからの退出もここにあります。</small>', 'This is the <b>Settings</b> tab. Besides language, graphics and sound, you can turn <b>auto sort & combine</b> on or off per tier and choose where units line up.<br><small>Replaying the tutorial and leaving the game are here too.</small>', '这是<b>设置</b>页。除了语言、画质、声音，还可以按星级开关<b>自动整理与合成</b>，并设定整理的位置。<br><small>重看教程和退出本局也在这里。</small>'],
    gift_title: ['신화 해금!', '神話解放！', 'Myths unlocked!', '神话解锁！'],
    gift_sub: ['이제 이 장수들을 조합할 수 있습니다. 다른 장수는 상점 › 장수 해금에서.', 'これらの武将を合成できるようになりました。ほかの武将はショップ › 武将解放で。', 'You can now craft these generals. Unlock more in Shop › Unlock generals.', '现在可以组合这些武将了。更多武将请到商店 › 解锁武将。'],
    tutReplay: ['튜토리얼', 'チュートリアル', 'Tutorial', '教程'], tutReplayBtn: ['다시 보기', 'もう一度見る', 'Replay', '重看'],
    tutReplayHint: ['다음 싱글 플레이에서 다시 안내합니다', '次のシングルプレイで表示します', 'Shown again in your next single-player game', '下一局单人游戏时再次显示'],
    waiting: ['대기', '待機', 'Waiting', '等待'],
    volLine0: ['내가 먼저 나가 저 자의 수급을 취해 오겠소!', '我が先陣を切り、奴の首を取ってこよう！', 'I\'ll go first and bring back his head!', '我先出阵，取他首级回来！'],
    volLine1: ['선봉은 이 몸에게 맡기시오!', '先鋒はこの身に任されよ！', 'Leave the vanguard to me!', '先锋就交给我吧！'],
    volLine2: ['적장의 목은 내가 베어 오리다!', '敵将の首、この私が討ち取ってくれよう！', 'I\'ll cut down the enemy general myself!', '敌将的首级由我来斩！'],
    vanguard: ['선봉 출전: {a}', '先鋒出陣：{a}', 'Vanguard: {a}', '先锋出战：{a}'],
    volHead: ['일기토 · 선봉 신청', '一騎討ち・先鋒志願', 'Single Combat · Volunteer', '单挑 · 自荐先锋'],
    volHint: ['한 명씩 순서대로 싸웁니다. 신청한 사람 중 한 명이 먼저 나갑니다(여러 명이면 무작위).', '1人ずつ順番に戦います。志願した人の中から1人が先に出ます（複数ならランダム）。', 'Champions fight one at a time. One volunteer goes first (random if several).', '一次一人依次战斗。自荐者中的一人先出战（多人时随机）。'],
    volBtn: ['출전 신청', '出陣志願', 'Volunteer', '申请出战'],
    volDone: ['신청함', '志願済み', 'Volunteered', '已申请'],
    volList: ['신청: {a}', '志願：{a}', 'Volunteers: {a}', '申请：{a}'],
    rk_mil0: ['신병', '新兵', 'Recruit', '新兵'],
    rk_mil1: ['백인대장', '百人隊長', 'Centurion', '百人队长'],
    rk_mil2: ['군후', '軍候', 'Company Captain', '军候'],
    rk_mil3: ['군사마', '軍司馬', 'Army Major', '军司马'],
    rk_mil4: ['교위', '校尉', 'Colonel', '校尉'],
    rk_mil5: ['중랑장', '中郎将', 'Household General', '中郎将'],
    rk_mil6: ['편장군', '偏将軍', 'Lieutenant General', '偏将军'],
    rk_mil7: ['도독', '都督', 'Area Commander', '都督'],
    rk_mil8: ['전장군', '前将軍', 'General of the Vanguard', '前将军'],
    rk_mil9: ['대장군', '大将軍', 'Grand General', '大将军'],
    rk_mil10: ['군주', '君主', 'Sovereign', '君主'],
    rk_civ0: ['신병', '新兵', 'Recruit', '新兵'],
    rk_civ1: ['종사', '従事', 'Attendant Officer', '从事'],
    rk_civ2: ['주부', '主簿', 'Registrar', '主簿'],
    rk_civ3: ['현령', '県令', 'County Magistrate', '县令'],
    rk_civ4: ['상서랑', '尚書郎', 'Secretariat Gentleman', '尚书郎'],
    rk_civ5: ['간의대부', '諫議大夫', 'Grand Remonstrant', '谏议大夫'],
    rk_civ6: ['태수', '太守', 'Grand Administrator', '太守'],
    rk_civ7: ['주목', '州牧', 'Provincial Governor', '州牧'],
    rk_civ8: ['상서령', '尚書令', 'Prefect of the Secretariat', '尚书令'],
    rk_civ9: ['승상', '丞相', 'Chancellor', '丞相'],
    rk_civ10: ['군주', '君主', 'Sovereign', '君主'],
    rankPum: ['{n}품', '{n}品', 'Grade {n}', '{n}品'],
    // 협동 입장 대기 화면(src/ui/18b-match.js)
    mt_wait: ['모든 플레이어를 기다리는 중…', '全プレイヤーを待っています…', 'Waiting for all players…', '正在等待所有玩家…'],
    mt_loading: ['불러오는 중…', '読み込み中…', 'Loading…', '加载中…'],
    mt_ready: ['준비 완료', '準備完了', 'Ready', '准备完毕'],
    mt_next: ['다음 계급 {r}까지 경험치 {n}', '次の官職 {r} まで経験値 {n}', '{n} XP to the next rank, {r}', '距下一官职 {r} 还需经验 {n}'],
    mt_max: ['최고 계급', '最高官職', 'Highest rank', '最高官职'],
    mt_tip0: ['5인이 함께하면 보상이 가장 큽니다', '5人でプレイすると報酬が最も多くなります', 'Rewards are highest with a full party of 5', '5人同行时奖励最多'],
    mt_tip1: ['계급이 오르면 카드가 더 화려해집니다', '官職が上がるとカードがより華やかになります', 'Your card gets flashier as your rank rises', '官职越高，卡片越华丽'],
    mt_tip2: ['판을 할수록 경험치가 쌓여 계급이 오릅니다', 'バトルを重ねると経験値がたまり、官職が上がります', 'Every game earns XP toward your next rank', '对局越多，经验越多，官职越高'],
    mt_tip3: ['가장 높은 계급은 군주입니다', '最高の官職は君主です', 'The highest rank is Sovereign', '最高官职是君主'],
    treeHead: ['관직 표', '官職一覧', 'Rank table', '官职表'],
    treeStage: ['품계', '品階', 'Grade', '品阶'],
    treeLv: ['레벨', 'レベル', 'Level', '等级'],
    treeXp: ['필요 경험치', '必要経験値', 'XP needed', '所需经验'],
    treeNote: ['필요 경험치는 처음부터 쌓은 합계입니다. 지금 내 경험치: {xp}', '必要経験値は最初からの累計です。現在の経験値：{xp}', 'XP needed is the running total from the start. Your XP: {xp}', '所需经验为从头累计的总量。当前经验：{xp}'],
    trackHead: ['관직 갈래', '官職の系統', 'Career path', '官职路线'],
    trackMil: ['무관', '武官', 'Military', '武官'],
    trackCiv: ['문관', '文官', 'Civil', '文官'],
    loginApple: ['Apple로 계속', 'Appleで続ける', 'Continue with Apple', '通过 Apple 继续'],
    loginGoogle: ['Google로 계속', 'Googleで続ける', 'Continue with Google', '通过 Google 继续'],
    loginGuest: ['게스트로 시작', 'ゲストで始める', 'Play as guest', '以游客身份开始'],
    nickFirst: ['닉네임 (처음 가입할 때만)', 'ニックネーム（初回登録時のみ）', 'Nickname (first sign-up only)', '昵称（仅首次注册）'],
    guestNick: ['손님{n}', 'ゲスト{n}', 'Guest{n}', '游客{n}'],
    appOnly: ['Apple·Google 로그인은 앱에서만 됩니다.', 'Apple・Googleログインはアプリでのみ使えます。', 'Apple/Google sign-in works only in the app.', 'Apple/Google 登录仅限 App 内使用。'],
    linkHead: ['계정 연결', 'アカウント連携', 'Link account', '绑定账号'],
    linkHint: ['게스트 기록은 이 기기에만 있습니다. Apple이나 Google에 연결하면 경험치·계급이 그대로 옮겨지고 다른 기기에서도 이어집니다.', 'ゲストの記録はこの端末にだけあります。AppleかGoogleに連携すると、経験値・階級がそのまま移り、別の端末でも続けられます。', 'Guest progress lives only on this device. Link Apple or Google to keep your XP and rank and play on other devices.', '游客记录只保存在本设备。绑定 Apple 或 Google 后经验与官阶会完整转移，也可在其他设备继续。'],
    linked: ['연결했습니다. 이제 다른 기기에서도 이어서 할 수 있습니다.', '連携しました。別の端末でも続けられます。', 'Linked. You can now continue on other devices.', '已绑定，可在其他设备继续。'],
    existed: ['이미 그 계정이 있어 그 계정으로 들어왔습니다(게스트 기록은 합쳐지지 않습니다).', 'そのアカウントは既にあるため、そのアカウントでログインしました（ゲストの記録は統合されません）。', 'That account already exists, so you are now signed in to it (guest progress was not merged).', '该账号已存在，已登录该账号（游客记录不合并）。'],
    provGuest: ['게스트', 'ゲスト', 'Guest', '游客'],
    nickEdit: ['닉네임 바꾸기', 'ニックネーム変更', 'Change nickname', '修改昵称'],
    save: ['저장', '保存', 'Save', '保存'],
    delConfirmSso: ['정말 계정을 삭제할까요? 경험치·계급이 모두 지워지고 되돌릴 수 없습니다.', '本当にアカウントを削除しますか？経験値・階級はすべて消え、元に戻せません。', 'Delete your account? Your XP and rank will be erased permanently.', '确定删除账号吗？经验与官阶将全部清除且无法恢复。'],
    delYes: ['삭제', '削除', 'Delete', '删除'],
    // 서버가 돌려주는 나머지 오류 값(tests/i18n-keys.js가 server/app.js의 error 값과 맞춰 본다)
    err_busy: ['서버가 바쁩니다. 잠시 뒤 다시 시도해 주세요.', 'サーバーが混み合っています。しばらくしてからもう一度お試しください。', 'The server is busy. Please try again shortly.', '服务器繁忙，请稍后再试。'],
    err_server: ['서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.', 'サーバーの処理に失敗しました。しばらくしてからもう一度お試しください。', 'Something went wrong on the server. Please try again later.', '服务器出现问题，请稍后再试。'],
    err_bad_payload: ['요청을 확인할 수 없습니다.', 'リクエストを確認できませんでした。', 'The request could not be verified.', '无法验证该请求。'],
    err_refunded: ['환불된 구매라 다시 열 수 없습니다.', '返金された購入のため、再度解放できません。', 'This purchase was refunded and cannot be restored.', '该购买已退款，无法恢复。'],
    err_not_found: ['요청한 내용을 찾을 수 없습니다.', '見つかりませんでした。', 'Not found.', '未找到请求的内容。'],
    err_bad_body: ['요청을 처리하지 못했습니다. 다시 시도해 주세요.', 'リクエストを処理できませんでした。もう一度お試しください。', 'The request could not be processed. Please try again.', '无法处理请求，请重试。'],
    err_bad_diff: ['난이도를 다시 골라 주세요.', '難易度を選び直してください。', 'Please choose the difficulty again.', '请重新选择难度。'],
    err_locked: ['아직 열리지 않은 난이도입니다.', 'この難易度はまだ解放されていません。', 'This difficulty is still locked.', '该难度尚未解锁。'],
    err_bad_item: ['살 수 없는 항목입니다.', 'これは購入できません。', 'This item is not available.', '无法购买该项目。'],
    err_owned: ['이미 가지고 있습니다.', 'すでに持っています。', 'You already own this.', '已拥有。'],
    err_coins: ['동전이 부족합니다.', '銅銭が足りません。', 'Not enough coins.', '铜钱不足。'],
    err_ad_cap: ['오늘 받을 수 있는 광고 보상을 모두 받았습니다.', '本日の広告報酬はすべて受け取りました。', "You have claimed all of today's ad rewards.", '今日的广告奖励已全部领取。'],
    err_bad_receipt: ['결제를 확인하지 못했습니다.', '購入を確認できませんでした。', 'The purchase could not be verified.', '无法验证购买。'],
    err_other_account: ['이 구매는 다른 계정에 연결되어 있습니다.', 'この購入は別のアカウントに連携されています。', 'This purchase is linked to another account.', '此购买已关联到其他账号。'],
    // 판 표를 끝까지 못 받은 판의 결과 화면, 서버가 알려 준 최소 버전보다 낮을 때(로딩 화면)
    noTicket: ['서버에 연결하지 못해 이번 판의 보상을 받지 못했습니다.', 'サーバーに接続できなかったため、今回のバトルの報酬を受け取れませんでした。', "Could not reach the server, so this game's rewards were not received.", '未能连接服务器，本局奖励未能领取。'],
    updateNeed: ['새 버전이 나왔습니다. 스토어에서 업데이트해 주세요.', '新しいバージョンがあります。ストアでアップデートしてください。', 'A new version is available. Please update from the store.', '有新版本，请前往商店更新。'],
    updateWeb: ['새 버전이 나왔습니다. 페이지를 새로고침해 주세요.', '新しいバージョンがあります。ページを再読み込みしてください。', 'A new version is available. Please reload the page.', '有新版本，请刷新页面。'],
    updateReload: ['새로고침', '再読み込み', 'Reload', '刷新'], updateSkip: ['그대로 계속', 'このまま続ける', 'Continue anyway', '继续'], updateStore: ['스토어로 가기', 'ストアへ', 'Go to store', '前往商店'],
    err_not_configured: ['이 로그인은 아직 준비 중입니다.', 'このログインは準備中です。', 'This sign-in is not set up yet.', '此登录方式尚未开放。'],
    err_bad_token: ['로그인 확인에 실패했습니다. 다시 시도해 주세요.', 'ログインの確認に失敗しました。もう一度お試しください。', 'Sign-in could not be verified. Please try again.', '登录验证失败，请重试。'],
    err_cancel: ['로그인을 취소했습니다.', 'ログインをキャンセルしました。', 'Sign-in cancelled.', '已取消登录。'],
    // 운영 제재(계정 정지): 로딩 화면과 로그인 오류에 보인다
    err_banned: ['이용 약관 위반으로 계정이 정지되었습니다. 문의: mikohatsu97@gmail.com', '利用規約違反のため、アカウント停止中です。お問い合わせ：mikohatsu97@gmail.com', 'This account has been suspended for violating the Terms. Contact: mikohatsu97@gmail.com', '因违反使用条款，账号已被停用。联系方式：mikohatsu97@gmail.com'],
    ban_until: ['정지 기간: {d}까지', '停止期間：{d}まで', 'Suspended until {d}', '停用至：{d}'], ban_perm: ['정지 기간: 무기한', '停止期間：無期限', 'Suspended indefinitely', '停用期限：无限期'],
    lb_shop: ['상점', 'ショップ', 'Shop', '商店'],
    lb_rank: ['랭킹', 'ランキング', 'Ranking', '排行'],
    lb_account: ['계정', 'アカウント', 'Account', '账号'],
    lb_settings: ['설정', '設定', 'Settings', '设置'],
    lb_battle: ['전투 시작', '出陣', 'Battle', '出征'],
    lb_chatPh: ['채팅 입력 (80자)', 'チャット入力（80文字）', 'Chat (80 chars)', '输入聊天（80字）'],
    lb_send: ['보내기', '送信', 'Send', '发送'],
    lb_quick: ['빠른 대전', 'クイックマッチ', 'Quick Match', '快速匹配'],
    lb_quickSub: ['같은 난이도 사람과 자동으로 만납니다', '同じ難易度の人と自動で組みます', 'Auto-match with players of the same difficulty', '自动匹配同难度玩家'],
    lb_create: ['방 만들기', 'ルーム作成', 'Create Room', '创建房间'],
    lb_createSub: ['코드를 친구에게 알려 주세요', 'コードを友達に教えましょう', 'Share the code with friends', '把房间码告诉好友'],
    lb_join: ['방 입장', 'ルーム参加', 'Join Room', '加入房间'],
    lb_joinSub: ['받은 코드로 들어갑니다', 'もらったコードで入ります', 'Enter with a room code', '输入房间码加入'],
    lb_history: ['전적', '戦績', 'Records', '战绩'],
    lb_mission: ['미션', 'ミッション', 'Missions', '任务'],
    err_no_claim: ['지금은 받을 수 없는 보상입니다.', 'この報酬は今は受け取れません。', 'This reward cannot be claimed right now.', '现在无法领取该奖励。'],
    // ---- 관직 승급·업적 첫 달성 보상, 일일 미션(2026-11-24 fix-progression.md). 수치는 서버가 준다 ----
    goalRankUp: ['관직 승급: {a} — 동전 +{n}', '官職昇進：{a} — 銅銭+{n}', 'Promoted to {a} — +{n} coins', '官职晋升：{a}——铜钱+{n}'],
    goalAchFirst: ['업적 첫 달성 {k}개 — 동전 +{n}', '実績を初めて{k}件達成 — 銅銭+{n}', 'First-time feats ×{k} — +{n} coins', '首次达成成就{k}个——铜钱+{n}'],
    rankUpGot: ['관직 승급: {a} (동전 +{n})', '官職昇進：{a}（銅銭+{n}）', 'Promoted to {a} (+{n} coins)', '官职晋升：{a}（铜钱+{n}）'],
    msToday: ['오늘의 미션', '今日のミッション', "Today's missions", '今日任务'],
    msAllDone: ['모두 완료', 'すべて完了', 'All done', '全部完成'],
    msRewardSum: ['동전 +{c} · 경험치 +{x}', '銅銭+{c}・経験値+{x}', '+{c} coins · +{x} XP', '铜钱+{c}・经验+{x}'],
    msGotXp: ['동전 +{n}, 경험치 +{x}를 받았습니다.', '銅銭+{n}・経験値+{x}を受け取りました。', 'Received +{n} coins and +{x} XP.', '已领取铜钱+{n}、经验+{x}。'],
    ms_d_play2: ['판 2번 하기(10라운드 이상)', 'バトルを2回（10ラウンド以上）', 'Play 2 games (round 10+)', '进行2局（第10回合以上）'],
    ms_d_comb10: ['합성 10번', '合成を10回', 'Combine 10 times', '合成10次'],
    ms_d_boss3: ['보스 3마리 처치', 'ボスを3体倒す', 'Defeat 3 bosses', '击败3个首领'],
    goalMission: ['받을 수 있는 미션 보상이 있습니다 (로비 › 미션)', '受け取れるミッション報酬があります（ロビー › ミッション）', 'You have mission rewards to claim (Lobby › Missions)', '有可领取的任务奖励（大厅 › 任务）'],
    speedTip: ['모두 같은 배속을 켜야 적용됩니다', '全員が同じ速度にすると適用されます', 'Applies when everyone picks the same speed', '所有人选择相同速度后生效'],
    achDone: ['업적 달성: {a}', '実績達成：{a}', 'Feat unlocked: {a}', '达成成就：{a}'],
    champDown: ['{a} 쓰러짐. 다른 유닛을 출전시킬 수 있습니다.', '{a}が倒れました。別のユニットを出陣できます。', '{a} fell. You can deploy another unit.', '{a}倒下了，可以派出其他单位。'],
    sortPos: ['정렬 위치', '整列位置', 'Sort position', '整理位置'],
    zL: ['좌', '左', 'L', '左'],
    zB1: ['하1', '下1', 'B1', '下1'],
    zB2: ['하2', '下2', 'B2', '下2'],
    zB3: ['하3', '下3', 'B3', '下3'],
    zR: ['우', '右', 'R', '右'],
    autoT1: ['1성 자동 정렬·합성', '★1 自動整列・合成', 'Auto sort & combine ★1', '1星自动整理与合成'],
    autoT2: ['2성 자동 정렬·합성', '★2 自動整列・合成', 'Auto sort & combine ★2', '2星自动整理与合成'],
    autoT3: ['3성 자동 정렬·합성', '★3 自動整列・合成', 'Auto sort & combine ★3', '3星自动整理与合成'],
    autoT45: ['4~5성 자동 정렬', '★4〜5 自動整列', 'Auto sort ★4–5', '4~5星自动整理'],
    autoSell: ['라운드 보상 1성 자동 판매', 'ラウンド報酬の★1を自動売却', 'Auto-sell round ★1 units', '自动出售回合奖励1星'],
    alliesLine: ['유닛 {u} · 적 {e}', 'ユニット{u}・敵{e}', '{u} units · {e} enemies', '单位{u} · 敌{e}'],
    e_combined: ['{a} {n}기 → {b}({r})', '{a}×{n} → {b}（{r}）', '{a} ×{n} → {b} ({r})', '{a}×{n} → {b}（{r}）'],
    e_joined: ['{a} 합류', '{a}が加入', '{a} joined', '{a}加入'],
    e_dismissed: ['{a} 해임', '{a}を解任', '{a} dismissed', '{a}已解任'],
    e_midBanner: ['중간보스 {a}', '中ボス {a}', 'Mid-boss: {a}', '中首领 {a}'],
    e_lifeLost: ['라이프 -{n}: {why}', 'ライフ -{n}：{why}', 'Lives -{n}: {why}', '生命 -{n}：{why}'],
    e_frontFull: ['전선 포화', '戦線飽和', 'Front overflow', '战线饱和'],
    e_midMissed: ['{a} 놓침', '{a}を逃した', '{a} escaped', '{a}逃脱'],
    e_defeated: ['{a} 토벌', '{a} 討伐', '{a} defeated', '讨伐{a}'],
    e_fast: [' (빠른 클리어)', '（速攻）', ' (fast clear)', '（速通）'],
    e_ally: ['동맹 {a}', '同盟 {a}', 'Ally {a}', '盟友 {a}'], allyBtn: ['동맹 {n}명', '同盟 {n}人', 'Allies ({n})', '同盟 {n}人'],
    e_charm: ['매혹', '魅了', 'Charm', '魅惑'],
    e_breakOk: ['무력화 성공 · 그로기', 'ブレイク成功・ダウン', 'Break! Boss downed', '破防成功·倒地'],
    e_castGo: ['{a} 발동', '{a} 発動', '{a} activated', '{a}发动'],
    e_counterOk: ['반격 성공 · 그로기', '反撃成功・ダウン', 'Counter! Boss downed', '反击成功·倒地'],
    e_altarDown: ['제단 파괴 · 그로기', '祭壇破壊・ダウン', 'Altars destroyed! Boss downed', '祭坛摧毁·倒地'],
    e_towerDown: ['궁루 붕괴', '櫓崩壊', 'Towers down', '箭楼倒塌'],
    e_altarRage: ['제단 폭주', '祭壇暴走', 'Altars overload', '祭坛暴走'],
    meTag: [' (나)', '（自分）', ' (you)', '（我）'],
    onOff: ['켜짐', 'オン', 'On', '开'],
    offOff: ['꺼짐', 'オフ', 'Off', '关'],
    // ---- 출시 전 UX 점검(2026-11-18)에서 더한 문구: 한곳에 모아 둔다 ----
    waitSelf: ['10초 넘게 응답이 없습니다. 내 인터넷 연결을 확인하세요.', '10秒以上応答がありません。通信状況を確認してください。', 'No response for over 10 seconds. Check your own connection.', '超过10秒没有响应，请检查自己的网络。'],
    roomLeave: ['방 나가기', 'ルームを出る', 'Leave room', '退出房间'],
    langLater: ['로비로 돌아가면 바뀝니다', 'ロビーへ戻ると切り替わります', 'Applies when you return to the lobby', '返回大厅后生效'],
    sendingResult: ['결과를 보내는 중…', '結果を送信中…', 'Sending result…', '正在提交结果…'],
    overwriteSave: ['이어하기 기록이 지워집니다 · 한 번 더', '「続きから」の記録が消えます・もう一度', 'Saved game will be erased · tap again', '将清除“继续游戏”的存档 · 再按一次'],
    lockedInShop: ['잠김 · 상점 › 장수 해금에서 열 수 있습니다', 'ロック中・ショップ › 武将解放で開けます', 'Locked · open it in Shop › Unlock generals', '未解锁 · 可在商店 › 解锁武将中开启'],
    goalHead: ['다음 목표', '次の目標', 'Next goals', '下一个目标'],
    goalDiff: ['{a} 난이도가 열렸습니다', '難易度「{a}」が開放されました', '{a} difficulty unlocked', '已开放“{a}”难度'],
    goalMut: ['악몽 +{n}이 열렸습니다', '悪夢+{n}が開放されました', 'Nightmare +{n} unlocked', '已开放噩梦+{n}'],
    goalShop: ['상점이 열렸습니다. 상점에서 신화·불멸 장수를 해금할 수 있습니다', 'ショップが開きました。ショップで神話・不滅の武将を解放できます', 'The Shop is open. Unlock Myth and Immortal generals there', '商店已开放，可在商店解锁神话·不灭武将'],
    goalRank: ['다음 관직 {a}까지 경험치 {n}', '次の官職「{a}」まで経験値あと{n}', '{n} XP to the next rank: {a}', '距下一官职“{a}”还需经验{n}'],
    goalCoins: ['동전 {n}개를 더 모으면 {r} 장수를 해금할 수 있습니다', '銅銭があと{n}で{r}の武将を解放できます', '{n} more coins to unlock a {r} general', '再攒{n}铜钱即可解锁{r}武将'],
    goalCoinsOk: ['지금 가진 동전으로 {r} 장수를 해금할 수 있습니다 (상점 › 장수 해금)', '今の銅銭で{r}の武将を解放できます（ショップ › 武将解放）', 'You have enough coins to unlock a {r} general (Shop › Unlock generals)', '现有铜钱可解锁{r}武将（商店 › 解锁武将）'],
    goalLostBoss: ['{r}라운드 보스 {a}에게 패배', 'ラウンド{r}のボス「{a}」に敗北', 'Lost to {a}, the round {r} boss', '第{r}回合败给首领{a}'],
    goalLostBossHp: ['{r}라운드 보스 {a}에게 패배 (보스 체력 {p}% 남음)', 'ラウンド{r}のボス「{a}」に敗北（ボスの残り体力{p}%）', 'Lost to {a}, the round {r} boss ({p}% HP left)', '第{r}回合败给首领{a}（首领剩余{p}%体力）'],
    goalLostLane: ['{r}라운드에서 라이프가 0이 되어 패배', 'ラウンド{r}でライフが0になり敗北', 'Lost on round {r}: lives reached 0', '第{r}回合生命归零，战败'],
    goalLost: ['{r}라운드에서 패배', 'ラウンド{r}で敗北', 'Lost on round {r}', '第{r}回合战败'],
    // ---- 완성도 다듬기(2026-11-18): AI 동맹 이름, 결과창 조언·보상 칸, 판 안 첫 힌트·전선 경고, 계정 창 ----
    ai_wei: ['AI 위 정예', 'AI 魏の精鋭', 'AI Wei Elite', 'AI 魏之精锐'], ai_shu: ['AI 촉 정예', 'AI 蜀の精鋭', 'AI Shu Elite', 'AI 蜀之精锐'], ai_wu: ['AI 오 정예', 'AI 呉の精鋭', 'AI Wu Elite', 'AI 吴之精锐'],
    ai_etc: ['AI 군웅 할거', 'AI 群雄割拠', 'AI Warlords', 'AI 群雄割据'], ai_econ: ['AI 내정 우선', 'AI 内政優先', 'AI Economy', 'AI 内政优先'], ai_rush: ['AI 물량 속공', 'AI 物量速攻', 'AI Swarm Rush', 'AI 人海速攻'],
    tipUpgrade: ['금화로 강화하면 모든 유닛이 강해집니다 (오른쪽 강화 버튼)', '金貨で強化すると全ユニットが強くなります（右の強化ボタン）', 'Spend gold on upgrades to strengthen every unit (Upgrade button on the right)', '用金币强化可让所有单位变强（右侧强化按钮）'],
    tipCombine: ['같은 유닛 3기를 모아 합성하면 한 단계 높은 유닛이 됩니다', '同じユニットを3体集めて合成すると、ひとつ上のユニットになります', 'Combine 3 of the same unit to get a higher-tier one', '集齐3个相同单位合成，可得到更高一级的单位'],
    back: ['뒤로', '戻る', 'Back', '返回'], newsLbl: ['업데이트 내역', 'アップデート情報', 'Update notes', '更新内容'], settingsLbl: ['설정', '設定', 'Settings', '设置'],
    rewardHead: ['받은 보상', '獲得報酬', 'Rewards', '获得奖励'],
    laneHint: ['유닛을 눌러 고른 뒤 옮겨 배치하세요', 'ユニットをタップして選び、移動させて配置しましょう', 'Tap a unit to select it, then move it into place', '点击单位选中后，移动到合适位置'],
    frontWarn: ['전선이 가득 차 갑니다. 가득 차면 라이프가 줄어듭니다', '戦線が埋まりつつあります。満杯になるとライフが減ります', 'The front is filling up. When full, you lose lives', '防线即将挤满，满了会扣除生命'],
    waitPz: ['{a}의 연결을 기다리는 중입니다.', '{a}の接続を待っています。', 'Waiting for {a} to reconnect.', '正在等待{a}重新连接。'],
    // 선택 정보 바·상세 카드(2026-11-23 안 A)
    sellAgain: ['한 번 더', 'もう一度', 'Tap again', '再按一次'],
    noRecipeS: ['관련 조합식 없음', '関連レシピなし', 'No recipes', '无相关配方'],
    cardRecipe: ['조합식', 'レシピ', 'Recipes', '配方'],
    cardStats: ['능력치', 'ステータス', 'Stats', '属性'],
    cardSkills: ['스킬·패시브', 'スキル・パッシブ', 'Skills & passives', '技能・被动'],
  };
  const idx = { ko: 0, ja: 1, en: 2, zh: 3 }[lang];
  function t(key, vars) {
    const row = S[key];
    let s = row ? row[idx] || row[0] : key;
    if (vars) Object.keys(vars).forEach((k) => (s = s.split('{' + k + '}').join(vars[k])));
    return s;
  }

  // ---- 인연 단계 설명: 테마 데이터(synergies[].tiers[].lane·boss)에서 4개 언어로 만든다(인연을 더할 때 문구를 따로 쓰지 않아도 된다) ----
  // 칸: [한국어, 日本語, English, 中文]. {m} 배수, {v} 퍼센트, {n} 수, {d} 초
  const SP = {
    members: ['구성원', '構成員', 'Members', '成员'], all: ['모든 적', '全ての敵', 'All enemies', '全体敌人'],
    atk: ['공격력 +{v}', '攻撃力+{v}', 'ATK +{v}', '攻击+{v}'], haste: ['공격 속도 +{v}', '攻撃速度+{v}', 'attack speed +{v}', '攻速+{v}'], range: ['사거리 +{v}', '射程+{v}', 'range +{v}', '射程+{v}'],
    splashR: ['범위 반경 +{v}', '範囲半径+{v}', 'splash radius +{v}', '范围半径+{v}'], burn: ['화상 피해 +{v}', '炎上ダメージ+{v}', 'burn +{v}', '燃烧伤害+{v}'], grantBurn: ['화상 부여({v})', '炎上付与({v})', 'gains burn ({v})', '附加燃烧({v})'],
    burnSlow: ['화상 입은 적 이동 -{v}', '炎上中の敵の移動-{v}', 'burning enemies -{v} speed', '燃烧敌人移速-{v}'], pierce: ['방어 무시 +{v}', '防御無視+{v}', 'armor pierce +{v}', '无视防御+{v}'],
    multi: ['추가 타격 +{n}', '追加攻撃+{n}', '+{n} extra target', '额外攻击+{n}'], slowAdd: ['감속 +{v}', '減速+{v}', 'slow +{v}', '减速+{v}'], stunAdd: ['기절 확률 +{v}', '気絶確率+{v}', 'stun chance +{v}', '眩晕几率+{v}'],
    auraR: ['오라 반경 +{n}', 'オーラ半径+{n}', 'aura radius +{n}', '光环半径+{n}'], auraPct: ['오라 {v}', 'オーラ{v}', 'aura {v}', '光环{v}'], crit: ['{c} 확률로 {m}배', '{c}の確率で{m}倍', '{c} chance of ×{m}', '{c}几率{m}倍'],
    fieldSlow: ['이동 속도 -{v}(플레이어 중 최대)', '移動速度-{v}（プレイヤー中最大）', '-{v} speed (best of the party)', '移速-{v}（取玩家最大值）'], upMax: ['모든 강화 최대 단계 +{n}', '全強化の最大段階+{n}', 'All upgrade caps +{n}', '全部强化上限+{n}'],
    facAtk: ['{f} 유닛 전체 공격력 +{v}', '{f}の全ユニット攻撃力+{v}', 'All {f} units ATK +{v}', '{f}全体单位攻击+{v}'],
    // 보스전 상시
    bdmg: ['피해 +{v}', 'ダメージ+{v}', 'damage +{v}', '伤害+{v}'], guard: ['받는 피해 -{v}', '被ダメージ-{v}', 'damage taken -{v}', '受伤-{v}'], hpPct: ['체력 +{v}', '体力+{v}', 'HP +{v}', '生命+{v}'],
    skillAmp: ['스킬 피해 +{v}', 'スキルダメージ+{v}', 'skill damage +{v}', '技能伤害+{v}'], dashCdr: ['대시 재사용 -{v}', 'ダッシュ再使用-{v}', 'dash cooldown -{v}', '冲刺冷却-{v}'], burnAmp: ['화상 +{v}', '炎上+{v}', 'burn +{v}', '燃烧+{v}'],
    healUses: ['회복 버튼 +{n}회', '回復ボタン+{n}回', 'heal button +{n}', '回复按钮+{n}次'], healAmp: ['치료량 +{v}', '治療量+{v}', 'healing +{v}', '治疗量+{v}'], regen: ['매초 체력 {v} 회복', '毎秒体力{v}回復', 'regen {v}/s', '每秒回复{v}生命'],
    lowHp: ['체력 {t} 이하: {x}', '体力{t}以下: {x}', 'HP ≤{t}: {x}', '生命≤{t}: {x}'], highHp: ['체력 {t} 이상: {x}', '体力{t}以上: {x}', 'HP ≥{t}: {x}', '生命≥{t}: {x}'], bossLow: ['보스 체력 {t} 이하: {x}', 'ボス体力{t}以下: {x}', 'boss HP ≤{t}: {x}', '首领生命≤{t}: {x}'],
    revive: ['1회 부활(체력 {v})', '1回復活（体力{v}）', 'revive once ({v} HP)', '复活1次（生命{v}）'], reviveD: ['1회 {d}초 뒤 부활(체력 {v})', '1回{d}秒後に復活（体力{v}）', 'revive once after {d}s ({v} HP)', '{d}秒后复活1次（生命{v}）'],
    endure: ['버팀 {n}회', '踏ん張り{n}回', 'endure ×{n}', '坚守{n}次'], endureN: ['쓰러질 피해 무효 {n}회', '致命ダメージ無効{n}回', 'negate a lethal hit ×{n}', '免疫致命伤{n}次'],
    rotate: ['{d}초마다 지휘 교대: {x}', '{d}秒ごとに指揮交代: {x}', 'command rotates every {d}s: {x}', '每{d}秒轮换指挥: {x}'], pairBdmg: ['맞수 둘 다 출전하면 둘 다 피해 +{v}', '好敵手が揃って出陣すると両者ダメージ+{v}', 'both rivals deployed: both +{v} damage', '宿敌同时出战：两人伤害+{v}'],
    // 트리거
    t_start: ['시작', '開始時', 'At start', '开场'], t_timer: ['{d}초마다', '{d}秒ごと', 'Every {d}s', '每{d}秒'], t_hitN: ['평타 {n}번째마다', '通常攻撃{n}回ごと', 'Every {n}th hit', '每第{n}次普攻'], t_hit1: ['평타 때', '通常攻撃時', 'On hit', '普攻时'],
    t_crit: ['치명 때', '会心時', 'On crit', '暴击时'], t_skill: ['스킬을 쓰면', 'スキル使用時', 'On skill', '使用技能时'], t_heal_skill: ['치료 스킬을 쓰면', '治療スキル使用時', 'On healing skill', '使用治疗技能时'],
    t_skillHit: ['스킬 적중 때', 'スキル命中時', 'On skill hit', '技能命中时'], t_anyHit: ['적중마다', '命中ごと', 'On every hit', '每次命中'], t_dash: ['대시하면', 'ダッシュ時', 'On dash', '冲刺时'],
    t_dashGraze: ['대시 무적 중 피격 때', 'ダッシュ無敵中の被弾時', 'Hit while dashing', '冲刺无敌中被击时'], t_pattern: ['보스 패턴마다', 'ボスの技ごと', 'Each boss pattern', '首领每次出招'], t_bigDodge: ['큰 공격을 피하면', '大技を回避すると', 'Dodge a big attack', '躲过大招时'],
    t_lowHp: ['체력이 처음 {t} 아래면', '体力が初めて{t}未満になると', 'First time below {t} HP', '首次生命低于{t}时'], t_heal: ['넘친 회복', 'あふれた回復', 'Overflow healing', '溢出治疗'], t_hurt: ['피격 때', '被弾時', 'When hit', '受击时'], t_stackMax: ['중첩이 차면', 'スタック最大時', 'At max stacks', '叠满时'],
    c_cd: ['{d}초 쿨', 'CT{d}秒', '{d}s CD', '冷却{d}秒'], c_lane: ['라인에 구성원이 있을 때', 'ラインに構成員がいる時', 'needs a member on the lane', '战线有成员时'], c_need: ['라인에 {a}', 'ラインに{a}', 'needs {a} on the lane', '战线有{a}'],
    c_first: ['첫 직선 스킬', '最初の直線スキル', 'first line skill', '首个直线技能'], c_max: ['최대일 때', '最大時', 'when maxed', '满时'], c_nth: ['{n}번마다', '{n}回ごと', 'every {n}', '每{n}次'], c_field: ['진 안에서', '陣の中で', 'inside a circle', '阵内'],
    // 행동
    a_dmg: ['{m}배 피해', '{m}倍ダメージ', '×{m} damage', '{m}倍伤害'], a_stun: ['기절 {d}초', '気絶{d}秒', 'stun {d}s', '眩晕{d}秒'], a_volley: ['라인 원군 1명당 {m}배 사격', 'ライン援軍1人ごとに{m}倍射撃', 'lane allies fire ×{m} each', '战线援军每人{m}倍射击'],
    a_volleyN: ['원군 {n}발({m}배)', '援軍{n}発（{m}倍）', '{n} ally shots (×{m})', '援军{n}发（{m}倍）'], a_ally: ['호위 {n}명 {d}초(1초마다 {m}배)', '護衛{n}人{d}秒（毎秒{m}倍）', '{n} guard(s) for {d}s (×{m}/s)', '护卫{n}名{d}秒（每秒{m}倍）'],
    a_allyF: ['호위 {n}명 끝까지(1초마다 {m}배)', '護衛{n}人 最後まで（毎秒{m}倍）', '{n} guard(s) all fight (×{m}/s)', '护卫{n}名全程（每秒{m}倍）'], a_allyG: ['그동안 받는 피해 -{v}', 'その間 被ダメージ-{v}', 'damage taken -{v} meanwhile', '期间受伤-{v}'],
    a_ship: ['화선 {n}척({m}배)', '火船{n}隻（{m}倍）', '{n} fire ship(s) (×{m})', '火船{n}艘（{m}倍）'], a_riders: ['기병 {n}기 돌격(1기 {m}배)', '騎兵{n}騎突撃（1騎{m}倍）', '{n} riders charge (×{m} each)', '骑兵{n}骑冲锋（每骑{m}倍）'],
    a_echo: ['스킬 메아리 {n}번({v})', 'スキル反響{n}回（{v}）', 'skill echoes ×{n} ({v})', '技能回响{n}次（{v}）'], a_field: ['법진 {d}초(초당 {m}배)', '法陣{d}秒（毎秒{m}倍）', 'circle {d}s (×{m}/s)', '法阵{d}秒（每秒{m}倍）'],
    a_fire: ['불 장판 {d}초(초당 {m}배)', '炎の床{d}秒（毎秒{m}倍）', 'fire ground {d}s (×{m}/s)', '火地{d}秒（每秒{m}倍）'], a_buff: ['{d}초 {x}', '{d}秒 {x}', '{x} for {d}s', '{d}秒{x}'],
    a_stack: ['중첩(최대 {n})', 'スタック（最大{n}）', 'stack (max {n})', '叠层（最多{n}）'], a_stackPer: ['중첩당 {x}', '1スタックごとに{x}', '{x} per stack', '每层{x}'], a_shield: ['보호막 {v}', 'シールド{v}', 'shield {v}', '护盾{v}'],
    a_shieldO: ['보호막으로(최대 {v})', 'シールドに（最大{v}）', 'becomes a shield (max {v})', '化为护盾（最多{v}）'], a_refund: ['스킬 재사용 {d}초 환급', 'スキル再使用{d}秒短縮', 'skill cooldowns -{d}s', '技能冷却-{d}秒'],
    a_samp: ['보스 받는 피해 +{v} {d}초(팀)', 'ボス被ダメージ+{v} {d}秒（チーム）', 'boss takes +{v} for {d}s (team)', '首领受伤+{v} {d}秒（全队）'], a_rally: ['아군 전체 공격력 +{v} {d}초', '味方全体攻撃力+{v} {d}秒', 'party ATK +{v} for {d}s', '全队攻击+{v} {d}秒'],
    a_pshield: ['아군 전체 보호 {d}초', '味方全体を{d}秒守る', 'party shield {d}s', '全队保护{d}秒'], a_weaken: ['보스 공격력 -{v} {d}초', 'ボス攻撃力-{v} {d}秒', 'boss ATK -{v} for {d}s', '首领攻击-{v} {d}秒'],
    a_delay: ['보스 다음 패턴 {d}초 지연', 'ボスの次の技を{d}秒遅らせる', 'delay boss pattern {d}s', '首领下一招延迟{d}秒'], a_next: ['다음 스킬 피해 +{v}', '次のスキルダメージ+{v}', 'next skill +{v}', '下一技能伤害+{v}'],
    a_heal: ['체력 {v} 회복', '体力{v}回復', 'heal {v}', '回复{v}生命'], a_arrows: ['화살 {n}발(그 평타의 {v})', '矢{n}本（その攻撃の{v}）', '{n} arrows ({v} of the hit)', '箭{n}支（该次普攻的{v}）'], a_dashHit: ['함께 돌진 {m}배', '共に突撃{m}倍', 'joint charge ×{m}', '一同冲锋{m}倍'],
  };
  const pc = (v) => Math.round(v * 1000) / 10 + '%';
  const sp = (k, v) => { const r = SP[k]; let s = r ? r[idx] || r[0] : k; Object.keys(v || {}).forEach((x) => (s = s.split('{' + x + '}').join(v[x]))); return s; };
  const SEP = idx === 1 || idx === 3 ? '、' : ', ';
  // 상시 수치 한 덩어리를 글로 (라인·보스전 같이 씀)
  function statText(T, o) {
    const out = [];
    Object.keys(o || {}).forEach((k) => {
      const v = o[k];
      if (v == null || k === 'only' || k === 'per' || k === 'needCore') return;
      if (k === 'crit') (Array.isArray(v) ? v : [v]).forEach((x) => out.push(sp('crit', { c: pc(x.ch), m: x.mult })));
      else if (k === 'multi' || k === 'auraR' || k === 'upMax' || k === 'healUses') out.push(sp(k, { n: v }));
      else if (k === 'regen') out.push(sp(k, { v: pc(v) }));
      else if (k === 'facAtk') out.push(sp(k, { f: (T.factions[v.fac] || {}).name || v.fac, v: pc(v.pct) }));
      else if (k === 'lowHp' || k === 'highHp' || k === 'bossLow') out.push(sp(k, { t: pc(v.th), x: statText(T, { guard: v.guard, bdmg: v.bdmg }) }));
      else if (k === 'revive') out.push(v.delay ? sp('reviveD', { d: v.delay, v: pc(v.pct) }) : sp('revive', { v: pc(v.pct) }));
      else if (k === 'endure') out.push(sp(v.negate ? 'endureN' : 'endure', { n: v.n || 1 }));
      else if (k === 'rotate') out.push(sp('rotate', { d: v.every, x: v.list.map((x, i) => (unitName(T, v.ids[i]) + ' ' + statText(T, x))).join(' → ') }));
      else if (k === 'pairBdmg') out.push(sp(k, { v: pc(v) }));
      else if (typeof v === 'number' && v && SP[k]) out.push(sp(k, { v: pc(v) }));
    });
    return out.join(SEP);
  }
  function unitName(T, id) { const d = T.units.find((x) => x.id === id); return d ? d.name : id; }
  function actText(T, a) {
    const st = a.stun ? SEP + sp('a_stun', { d: a.stun }) : '';
    switch (a.k) {
      case 'dmg': return (a.ids && !a.partner ? unitName(T, a.ids[0]) + ' ' : '') + sp('a_dmg', { m: a.m }) + st;
      case 'volley': return a.n ? sp('a_volleyN', { n: a.n, m: a.m }) : sp('a_volley', { m: a.m });
      case 'ally': return sp(a.dur === 'fight' ? 'a_allyF' : 'a_ally', { n: a.n || 1, d: a.dur, m: a.m }) + (a.guard ? SEP + sp('a_allyG', { v: pc(a.guard) }) : '');
      case 'ship': return sp('a_ship', { n: a.n || 1, m: a.m });
      case 'riders': return sp('a_riders', { n: a.n || 5, m: a.m });
      case 'echo': return sp('a_echo', { n: a.n || 1, v: pc(a.pct) });
      case 'field': return sp(a.vis === 'fire' ? 'a_fire' : 'a_field', { d: a.dur, m: a.m });
      case 'buff': return sp('a_buff', { d: a.dur, x: statText(T, { [a.stat]: a.v }) });
      case 'stack': return sp('a_stack', { n: a.max }) + (a.per ? SEP + sp('a_stackPer', { x: statText(T, a.per) }) : '');
      case 'shield': return a.over ? sp('a_shieldO', { v: pc(a.cap) }) : sp('a_shield', { v: pc(a.pct) });
      case 'refund': return sp('a_refund', { d: a.s });
      case 'samp': return sp('a_samp', { v: pc(a.v), d: a.dur });
      case 'rally': return sp('a_rally', { v: pc(a.v), d: a.dur });
      case 'pshield': return sp('a_pshield', { d: a.dur });
      case 'weaken': return sp('a_weaken', { v: pc(a.v), d: a.dur });
      case 'delay': return sp('a_delay', { d: a.v });
      case 'nextSkill': return sp('a_next', { v: pc(a.x) });
      case 'heal': return sp('a_heal', { v: pc(a.pct) });
      case 'dmgHit': return sp('a_arrows', { n: a.n, v: pc(a.pct) });
      case 'dashHit': return sp('a_dashHit', { m: a.m });
      default: return '';
    }
  }
  function ruleText(T, r) {
    let tr;
    if (r.on === 'timer') tr = sp('t_timer', { d: r.every });
    else if (r.on === 'hitN') tr = r.n > 1 ? sp('t_hitN', { n: r.n }) : sp('t_hit1');
    else if (r.on === 'skill' && r.skillK === 'heal') tr = sp('t_heal_skill');
    else if (r.on === 'lowHp') tr = sp('t_lowHp', { t: pc(r.th) });
    else tr = sp('t_' + r.on);
    const cond = [];
    if (r.first) cond.push(sp('c_first'));
    if (r.atMax) cond.push(sp('c_max'));
    if (r.inField) cond.push(sp('c_field'));
    if (r.lane) cond.push(sp('c_lane'));
    if (r.need) cond.push(sp('c_need', { a: r.need.map((id) => unitName(T, id)).join('/') }));
    if (r.nth) cond.push(sp('c_nth', { n: r.nth }));
    if (r.cd) cond.push(sp('c_cd', { d: r.cd }));
    const acts = r.do.map((a) => actText(T, a)).filter(Boolean).join(SEP);
    return tr + (cond.length ? '(' + cond.join(SEP) + ')' : '') + ': ' + acts;
  }
  // 한 단계의 { lane, boss } 설명. 비어 있으면 ''
  function synTierText(T, s, tier) {
    const L = tier.lane || {}, lane = [];
    const gl = {}, mem = {};
    Object.keys(L).forEach((k) => { if (k === 'fieldSlow' || k === 'upMax' || k === 'facAtk') gl[k] = L[k]; else if (k !== 'only' && k !== 'per') mem[k] = L[k]; });
    const m = statText(T, mem);
    if (m) lane.push((L.only ? L.only.map((id) => unitName(T, id)).join('·') : sp('members')) + ' ' + m);
    if (gl.fieldSlow) lane.push(sp('all') + ' ' + sp('fieldSlow', { v: pc(gl.fieldSlow) }));
    if (gl.upMax || gl.facAtk) lane.push(statText(T, { upMax: gl.upMax, facAtk: gl.facAtk }));
    Object.keys(L.per || {}).forEach((id) => { const x = statText(T, L.per[id]); if (x) lane.push(unitName(T, id) + ' ' + x); });
    const B = tier.boss, boss = [];
    if (B && B.stat) { const x = statText(T, B.stat); if (x) boss.push(x); }
    if (B && B.rules) B.rules.forEach((r) => boss.push(ruleText(T, r)));
    return { lane: lane.join(' / '), boss: boss.join(' / ') };
  }

  // ---- 고유명사 ----
  const N = {
    ja: 'cav:騎兵 shd:盾兵 arc:弓兵 swd:剣兵 spr:槍兵 yujin:于禁 akjin:楽進 juchang:周倉 jutae:周泰 neungtong:凌統 hwawoong:華雄 hayeon:夏侯淵 janghap:張郃 wiyeon:魏延 hwanggae:黄蓋 munchu:文醜 anryang:顔良 seohwang:徐晃 heojeo:許褚 hwangchung:黄忠 gamnyeong:甘寧 gongson:公孫瓚 hadon:夏侯惇 macho:馬超 madae:馬岱 nosuk:魯粛 wonso:袁紹 jangryo:張遼 ganguy:姜維 yeomong:呂蒙 sunyu:荀攸 deungae:鄧艾 seoseo:徐庶 gwanpyeong:関平 jeongbo:程普 jegalgeun:諸葛瑾 gahu:賈詡 maenghoek:孟獲 jeonwi:典韋 munang:文鴦 hwangwol:黄月英 bangtong:龐統 songyeon:孫堅 sonhyang:孫尚香 yeoryeong:呂玲綺 chugyung:祝融 gwakga:郭嘉 join:曹仁 sunuk:荀彧 jangbi:張飛 joun:趙雲 sonchaek:孫策 yukson:陸遜 dongtak:董卓 choseon:貂蝉 jojo:曹操 samaui:司馬懿 yubi:劉備 gwanu:関羽 jegal:諸葛亮 songwon:孫権 juyu:周瑜 taesaja:太史慈 janggak:張角 yeopo:呂布 jwaja:左慈 mijuk:糜竺 songeon:孫乾 chaemunhui:蔡文姫 samahwi:司馬徽 ganong:簡雍 ugil:于吉 jingung:陳宮 gyeonhui:甄姫 daegyo:大喬 sogyo:小喬 hwata:華佗',
    zh: 'cav:骑兵 shd:盾兵 arc:弓兵 swd:剑兵 spr:枪兵 yujin:于禁 akjin:乐进 juchang:周仓 jutae:周泰 neungtong:凌统 hwawoong:华雄 hayeon:夏侯渊 janghap:张郃 wiyeon:魏延 hwanggae:黄盖 munchu:文丑 anryang:颜良 seohwang:徐晃 heojeo:许褚 hwangchung:黄忠 gamnyeong:甘宁 gongson:公孙瓒 hadon:夏侯惇 macho:马超 madae:马岱 nosuk:鲁肃 wonso:袁绍 jangryo:张辽 ganguy:姜维 yeomong:吕蒙 sunyu:荀攸 deungae:邓艾 seoseo:徐庶 gwanpyeong:关平 jeongbo:程普 jegalgeun:诸葛瑾 gahu:贾诩 maenghoek:孟获 jeonwi:典韦 munang:文鸯 hwangwol:黄月英 bangtong:庞统 songyeon:孙坚 sonhyang:孙尚香 yeoryeong:吕玲绮 chugyung:祝融 gwakga:郭嘉 join:曹仁 sunuk:荀彧 jangbi:张飞 joun:赵云 sonchaek:孙策 yukson:陆逊 dongtak:董卓 choseon:貂蝉 jojo:曹操 samaui:司马懿 yubi:刘备 gwanu:关羽 jegal:诸葛亮 songwon:孙权 juyu:周瑜 taesaja:太史慈 janggak:张角 yeopo:吕布 jwaja:左慈 mijuk:糜竺 songeon:孙乾 chaemunhui:蔡文姬 samahwi:司马徽 ganong:简雍 ugil:于吉 jingung:陈宫 gyeonhui:甄姬 daegyo:大乔 sogyo:小乔 hwata:华佗',
    en: 'cav:Cavalry shd:Shieldman arc:Archer swd:Swordsman spr:Spearman yujin:Yu_Jin akjin:Yue_Jin juchang:Zhou_Cang jutae:Zhou_Tai neungtong:Ling_Tong hwawoong:Hua_Xiong hayeon:Xiahou_Yuan janghap:Zhang_He wiyeon:Wei_Yan hwanggae:Huang_Gai munchu:Wen_Chou anryang:Yan_Liang seohwang:Xu_Huang heojeo:Xu_Chu hwangchung:Huang_Zhong gamnyeong:Gan_Ning gongson:Gongsun_Zan hadon:Xiahou_Dun macho:Ma_Chao madae:Ma_Dai nosuk:Lu_Su wonso:Yuan_Shao jangryo:Zhang_Liao ganguy:Jiang_Wei yeomong:Lu_Meng sunyu:Xun_You deungae:Deng_Ai seoseo:Xu_Shu gwanpyeong:Guan_Ping jeongbo:Cheng_Pu jegalgeun:Zhuge_Jin gahu:Jia_Xu maenghoek:Meng_Huo jeonwi:Dian_Wei munang:Wen_Yang hwangwol:Huang_Yueying bangtong:Pang_Tong songyeon:Sun_Jian sonhyang:Sun_Shangxiang yeoryeong:Lu_Lingqi chugyung:Lady_Zhurong gwakga:Guo_Jia join:Cao_Ren sunuk:Xun_Yu jangbi:Zhang_Fei joun:Zhao_Yun sonchaek:Sun_Ce yukson:Lu_Xun dongtak:Dong_Zhuo choseon:Diaochan jojo:Cao_Cao samaui:Sima_Yi yubi:Liu_Bei gwanu:Guan_Yu jegal:Zhuge_Liang songwon:Sun_Quan juyu:Zhou_Yu taesaja:Taishi_Ci janggak:Zhang_Jiao yeopo:Lu_Bu jwaja:Zuo_Ci mijuk:Mi_Zhu songeon:Sun_Qian chaemunhui:Cai_Wenji samahwi:Sima_Hui ganong:Jian_Yong ugil:Yu_Ji jingung:Chen_Gong gyeonhui:Lady_Zhen daegyo:Da_Qiao sogyo:Xiao_Qiao hwata:Hua_Tuo',
  };
  // 중간보스(한국어 이름 → 번역)
  const MID = {
    ja: '정원지:程遠志 장량:張梁 장양:張譲 서영:徐栄 이각:李傕 곽사:郭汜 안량:顔良 문추:文醜 하후돈:夏侯惇 채모:蔡瑁 하후연:夏侯淵 방덕:龐徳 맹획:孟獲 왕쌍:王双 종회:鍾会',
    zh: '정원지:程远志 장량:张梁 장양:张让 서영:徐荣 이각:李傕 곽사:郭汜 안량:颜良 문추:文丑 하후돈:夏侯惇 채모:蔡瑁 하후연:夏侯渊 방덕:庞德 맹획:孟获 왕쌍:王双 종회:钟会',
    en: '정원지:Cheng_Yuanzhi 장량:Zhang_Liang 장양:Zhang_Rang 서영:Xu_Rong 이각:Li_Jue 곽사:Guo_Si 안량:Yan_Liang 문추:Wen_Chou 하후돈:Xiahou_Dun 채모:Cai_Mao 하후연:Xiahou_Yuan 방덕:Pang_De 맹획:Meng_Huo 왕쌍:Wang_Shuang 종회:Zhong_Hui',
  };
  const BOSS_T = {
    ja: ['黄巾の乱', '汜水関の戦い', '長安遷都', '官渡の戦い', '虎牢関の戦い', '赤壁の戦い', '夷陵の戦い', '祁山北伐', '陰平奇襲', '天下統一'],
    zh: ['黄巾之乱', '汜水关之战', '长安迁都', '官渡之战', '虎牢关之战', '赤壁之战', '夷陵之战', '祁山北伐', '阴平奇袭', '天下统一'],
    en: ['Yellow Turban Rebellion', 'Battle of Sishui Gate', 'Move to Chang\'an', 'Battle of Guandu', 'Battle of Hulao Gate', 'Battle of Red Cliffs', 'Battle of Yiling', 'Qishan Expedition', 'Raid through Yinping', 'Unification'],
  };
  const FAC = { ja: { wei: '魏', shu: '蜀', wu: '呉', etc: '群雄', none: '一般兵', free: '無所属' }, zh: { wei: '魏', shu: '蜀', wu: '吴', etc: '其他', none: '普通兵', free: '无所属' }, en: { wei: 'Wei', shu: 'Shu', wu: 'Wu', etc: 'Others', none: 'Soldiers', free: 'Free' } };
  const DIFF = { ja: { easy: 'かんたん', normal: 'ふつう', hard: 'むずかしい', nightmare: '悪夢' }, zh: { easy: '简单', normal: '普通', hard: '困难', nightmare: '噩梦' }, en: { easy: 'Easy', normal: 'Normal', hard: 'Hard', nightmare: 'Nightmare' } };
  const HIGH = { ja: ['伝説', '神話', '不滅'], zh: ['传说', '神话', '不灭'], en: ['Legend', 'Myth', 'Immortal'] };
  const ROLE = { ja: { tank: 'タンク', healer: 'ヒーラー', debuff: 'デバッファー', skill: 'スキル火力', auto: '通常攻撃火力', support: 'バッファー' }, zh: { tank: '坦克', healer: '治疗', debuff: '减益', skill: '技能输出', auto: '普攻输出', support: '增益' }, en: { tank: 'Tank', healer: 'Healer', debuff: 'Debuffer', skill: 'Skill DPS', auto: 'Auto DPS', support: 'Buffer' } };
  const CUR = { ja: '金貨', zh: '金币', en: 'Gold' };
  const parse = (s) => { const o = {}; s.split(' ').forEach((p) => { const i = p.indexOf(':'); o[p.slice(0, i)] = p.slice(i + 1).replace(/_/g, ' '); }); return o; };

  // 테마 데이터의 표시 이름을 고른 언어로 바꾼다(게임 규칙은 id만 쓰므로 안전)
  function localizeTheme(T) {
    T.title = t('title');
    T.L = t; // 엔진 알림 문구
    if (lang === 'ko') return;
    const names = parse(N[lang]), mids = parse(MID[lang]);
    T.units.forEach((d) => { if (names[d.id]) d.name = names[d.id]; });
    T.bosses.forEach((b, i) => { const id = b.id.slice(2); if (names[id]) b.name = names[id]; if (BOSS_T[lang][i]) b.title = BOSS_T[lang][i]; });
    const ml = {};
    T.midbosses.forEach((m) => { const n = mids[m.name] || m.name; if (T.midLooks[m.name]) ml[n] = T.midLooks[m.name]; m.name = n; });
    Object.assign(T.midLooks, ml);
    Object.keys(T.factions).forEach((k) => { if (FAC[lang][k]) T.factions[k].name = FAC[lang][k]; });
    T.difficulties.forEach((d) => { if (DIFF[lang][d.id]) d.name = DIFF[lang][d.id]; });
    T.ranks.forEach((r) => { r.name = r.t <= 7 ? '★' + r.t : HIGH[lang][r.t - 8]; });
    Object.keys(T.roles).forEach((k) => { if (ROLE[lang][k]) T.roles[k].name = ROLE[lang][k]; });
    T.upgrades.forEach((u) => { u.name = u.name.replace(/(\d)~(\d)성/, lang === 'ja' ? '★$1〜$2' : '★$1~$2').replace(/7성\+ (.+)$/, (m, f) => '★7+ ' + (Object.values(FAC[lang])[['위', '촉', '오', '그 외'].indexOf(f)] || f)); });
    T.currency = CUR[lang];
    // 스킬·패시브·칭호·명대사·보스 기술·인연·규칙·업적(i18n-data.js)
    const D = root.RTD_I18N_DATA;
    if (!D) return;
    const tr = (s) => (D.names[s] && D.names[s][lang]) || s, ln = (s) => (D.lines[s] && D.lines[s][lang]) || s;
    T.units.forEach((d) => {
      (d.p || []).forEach((p) => { p.name = tr(p.name); if (D.PD[lang][p.k]) p.desc = D.PD[lang][p.k](p); });
      (d.sk || []).forEach((s) => (s.n = tr(s.n)));
      if (d.title) d.title = tr(d.title);
      if (d.quote) d.quote = lang === 'zh' ? '' : ln(d.quote); // 중국어는 한문 원문(qc)만 보여 준다
    });
    T.items.forEach((x) => (x.name = tr(x.name)));
    // 명사 꼬리표·보스전 장소·상자 이름·역할 설명
    T.units.forEach((d) => { if (d.build) d.build = tr(d.build); });
    T.bosses.forEach((b) => { if (b.place) b.place = tr(b.place); });
    if (T.chestName) T.chestName = tr(T.chestName);
    if (D.roles) Object.values(T.roles).forEach((r) => { const x = D.roles[r.desc]; if (x && x[lang]) r.desc = x[lang]; });
    Object.values(T.consumables).forEach((c) => { c.name = tr(c.name); c.desc = (D.cons[c.desc] && D.cons[c.desc][lang]) || c.desc; });
    T.midbosses.forEach((m) => (m.story = tr(m.story)));
    T.bosses.forEach((b) => { b.line = ln(b.line); b.patterns.forEach((p) => (p.n = tr(p.n))); (b.phases || []).forEach((p) => (p.n = tr(p.n))); });
    T.mutators.forEach((m) => { const x = D.mut[m.name]; if (m.eff.extraPat) m.eff.extraPat.n = tr(m.eff.extraPat.n); if (x) { m.name = x[0][lang]; m.good = x[1][lang]; m.bad = x[2][lang]; } });
    (T.synergies || []).forEach((s) => { const x = D.syn[s.name]; if (x) { s.name = x[0][lang]; s.desc = x[1][lang]; } });
    T.achievements.forEach((a) => { const x = D.ach[a.name]; if (x) { a.name = x[0][lang]; a.desc = x[1][lang]; } });
  }
  // 정적 화면 글자: data-i18n="키"는 글자, data-i18n-ph="키"는 입력칸 안내
  function applyDom(rootEl) {
    (rootEl || document).querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    (rootEl || document).querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    (rootEl || document).querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria))); // 화면 낭독기용
    document.documentElement.lang = lang;
    document.title = t('title');
  }
  function setLang(k) { try { localStorage.setItem('rtd-lang', k); } catch (e) { /* 저장 불가 */ } location.reload(); }
  const skillText = lang !== 'ko' && root.RTD_I18N_DATA ? root.RTD_I18N_DATA.SK[lang] : null;
  // 일본어: 한국어 글꼴에는 가나·일본 한자가 없어 밋밋한 기본 글꼴로 나온다. 같은 글꼴 이름에 일본어 글꼴(가나·한자 범위만)을 덧붙여
  // 굵은 제목·붓글씨·명조가 일본어에서도 같은 분위기로 나오게 한다. 파일은 fonts/ja-*.woff2 (scripts/build-jafont.py, 모두 OFL).
  if (lang === 'ja' && typeof document !== 'undefined') {
    // 굵기는 원래 글꼴에 있는 굵기와 똑같이 적어야 한다(범위로 적으면 브라우저가 원래 글꼴만 골라 덧붙인 쪽을 안 쓴다)
    const map = [['Black Han Sans', 'ja-display', 400], ['East Sea Dokdo', 'ja-brush', 400], ['Gowun Batang', 'ja-serif', 400], ['Gowun Batang', 'ja-serif', 700], ['Noto Serif KR', 'ja-serif', 700], ['Noto Serif KR', 'ja-serif', 900]];
    const st = document.createElement('style');
    st.textContent = map.map(([fam, f, w]) => `@font-face{font-family:"${fam}";src:url(fonts/${f}.woff2) format("woff2");font-weight:${w};font-display:swap;unicode-range:U+3000-30FF,U+4E00-9FFF,U+FF00-FFEF}`).join('');
    document.head.appendChild(st);
    // 캔버스는 글꼴을 기다려 주지 않으므로 미리 불러 둔다
    if (document.fonts && document.fonts.load) map.forEach(([fam, f, w]) => document.fonts.load(`${w} 20px "${fam}"`, 'あ三').catch(() => {}));
  }
  root.RTD_I18N = { lang, LANGS, t, localizeTheme, applyDom, setLang, skillText, synTierText };
  if (root.RTD_THEME) localizeTheme(root.RTD_THEME);
})(typeof window !== 'undefined' ? window : globalThis);
