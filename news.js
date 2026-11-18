// 업데이트 내역. 로비 위쪽의 작은 '報' 버튼(data-lp="news")이 연다(lobby.js의 news 창).
// 새 버전을 낼 때 NOTES 맨 위에 한 덩어리를 더한다: { v: 버전, d: 날짜, items: [[한국어, 일본어, 영어, 중국어], ...] }.
// 플레이어가 느끼는 변화만, 한 줄에 하나씩 쉬운 말로 적는다(내부 수치·코드 이야기는 적지 않는다).
(function (root) {
  const LANGS = ['ko', 'ja', 'en', 'zh'];
  const TX = {
    title: ['업데이트 내역', 'アップデート情報', 'Update notes', '更新内容'],
    now: ['지금 버전', '現在のバージョン', 'Current version', '当前版本'],
    latest: ['최신', '最新', 'Latest', '最新'],
    notice: ['공지', 'お知らせ', 'Notice', '公告'],
  };
  const NOTES = [
    { v: '0.2.34', d: '2026-11-18', items: [
      ['협동 판을 시작할 때 참가자의 닉네임과 계급이 나오는 입장 화면이 생겼습니다. 계급이 높을수록 화려합니다.', '協力プレイの開始時に、参加者のニックネームと官職が表示される入場画面を追加しました。官職が高いほど華やかになります。', 'Co-op games now open with an entry screen showing each player’s nickname and rank. The higher the rank, the flashier the card.', '合作对局开始时新增了显示参与者昵称和官职的入场画面。官职越高越华丽。'],
      ['함께하는 인원이 많을수록 판 보상(경험치·동전)이 커집니다. 온라인 5인 협동이 가장 많이 받습니다.', '一緒に遊ぶ人数が多いほど、バトル報酬（経験値・銅銭）が増えます。オンライン5人協力が一番多くもらえます。', 'Game rewards (XP and coins) now grow with party size. A full 5-player online co-op game pays the most.', '一起游玩的人数越多，对局奖励（经验、铜钱）越多。在线5人合作获得最多。'],
      ['오프라인 판(혼자·AI 동맹)도 로그인해 서버에 연결되어 있으면 경험치와 동전을 받습니다.', 'オフラインのバトル（ひとり・AI同盟）も、ログインしてサーバーに接続していれば経験値と銅銭をもらえます。', 'Offline games (solo or with AI allies) now earn XP and coins when you are signed in and connected.', '离线对局（单人、AI同盟）在登录并连接服务器时也能获得经验和铜钱。'],
      ['보통·어려움·악몽과 악몽 +1~+5를 처음 클리어하면 동전 보상을 받습니다. 이미 클리어한 난이도도 받을 수 있습니다.', '「ふつう」「むずかしい」「悪夢」と悪夢+1〜+5を初めてクリアすると、銅銭の報酬をもらえます。すでにクリアした難易度の分も受け取れます。', 'First clears of Normal, Hard, Nightmare and Nightmare +1 to +5 now give coin rewards. Difficulties you already cleared count too.', '首次通关普通、困难、噩梦以及噩梦+1~+5可获得铜钱奖励。已经通关的难度也可以领取。'],
      ['매일 바뀌는 오늘의 미션이 생겼습니다. 로비의 미션 버튼에서 보상을 받으세요(일본 시간 0시에 초기화).', '毎日変わる「今日のミッション」を追加しました。ロビーのミッションボタンから報酬を受け取ってください（日本時間0時にリセット）。', "Added daily missions. Claim rewards from the Missions button in the lobby (resets at midnight Japan time).", '新增了每日更换的今日任务。请在大厅的任务按钮领取奖励（日本时间0点重置）。'],
      ['「결제 복원」 버튼이 설정에도 생겼습니다.', '「購入を復元」ボタンを設定にも追加しました。', 'Added a Restore purchases button to Settings.', '设置中也新增了“恢复购买”按钮。'],
    ] },
    { v: '0.2.33', d: '2026-11-18', items: [
      ['판 도중 선택권을 쓰면 그 판의 보상을 못 받던 문제를 고쳤습니다.', 'バトル中に選択券を使うと、そのバトルの報酬を受け取れなかった不具合を修正しました。', 'Fixed rewards being lost when you used a ticket during a game.', '修复了对局中使用选择券后无法获得该局奖励的问题。'],
      ['결과 화면 맨 위에 다음 목표가 나옵니다(진 곳, 새로 열린 것, 다음 관직까지 경험치).', 'リザルト画面の上部に次の目標が表示されます（敗因、新しく開いたもの、次の官職までの経験値）。', 'The result screen now shows your next goals (where you lost, what unlocked, XP to the next rank).', '结算画面顶部会显示下一个目标（失败原因、新解锁内容、距下一官职的经验）。'],
      ['방에 나가기 버튼이 생겼고, 협동 중 연결이 끊겼을 때도 나갈 수 있습니다.', 'ルームに退出ボタンを追加し、協力プレイ中に接続が切れたときも退出できるようになりました。', 'Rooms now have a Leave button, and you can leave when the connection drops in co-op.', '房间新增了退出按钮，合作中断线时也可以退出。'],
      ['상점 구매와 해금은 한 번 더 눌러 확정합니다. 작은 버튼들을 누르기 쉽게 키웠습니다.', 'ショップの購入と解放は、もう一度押して確定します。小さいボタンを押しやすくしました。', 'Shop purchases and unlocks now need a second tap to confirm. Small buttons are easier to tap.', '商店购买和解锁需要再点一次确认。小按钮更容易点击了。'],
      ['전투 시작 창이 지난번 선택을 기억합니다. 언어를 바꾸면 바로 적용됩니다.', '出陣画面が前回の選択を記憶します。言語を変えるとすぐに反映されます。', 'The battle setup remembers your last choices. Language changes apply immediately.', '出征界面会记住上次的选择。更改语言后立即生效。'],
      ['통신이 끊겨 못 보낸 판 결과는 다음에 접속할 때 다시 보냅니다.', '通信が切れて送れなかったバトル結果は、次回の接続時に再送します。', 'Game results that failed to send are retried the next time you connect.', '因断线未能发送的对局结果会在下次连接时重新发送。'],
      ['일본어 문구와 용어를 다듬었습니다.', '日本語の文言と用語を見直しました。', 'Polished Japanese text and terminology.', '优化了日语文本和用语。'],
    ] },
    { v: '0.2.32', d: '2026-11-18', items: [
      ['업데이트 내역을 볼 수 있는 버튼이 생겼습니다(로비 오른쪽 위).', 'アップデート情報を見られるボタンを追加しました（ロビー右上）。', 'Added a button for update notes (top right of the lobby).', '新增了查看更新内容的按钮（大厅右上角）。'],
      ['계정 창에서 무관·문관의 모든 칭호와 필요한 경험치를 볼 수 있습니다(관직 갈래 옆 ? 버튼).', 'アカウント画面で、武官・文官のすべての称号と必要な経験値を確認できます（官職の系統の横の「?」ボタン）。', 'The account panel now shows every military and civil title with the XP it needs (the ? button next to Career path).', '账号界面可以查看武官、文官的全部称号和所需经验（官职路线旁的"?"按钮）。'],
    ] },
    { v: '0.2.31', d: '2026-11-18', items: [
      ['판 결과를 서버가 더 꼼꼼히 확인합니다. 경험치·동전·순위를 받으려면 앱을 최신 버전으로 올려 주세요.', 'バトル結果をサーバーがより厳しく確認するようになりました。経験値・銅銭・ランキングを受け取るには、アプリを最新版に更新してください。', 'The server now checks game results more strictly. Update the app to keep earning XP, coins and rankings.', '服务器会更严格地核对对局结果。请将应用更新到最新版本以获得经验、铜钱和排名。'],
      ['전투 시작 창, 설정·상점·랭킹 창, 닉네임을 읽기 쉬운 기본 글꼴로 바꿨습니다.', '出陣画面、設定・ショップ・ランキング画面、ニックネームを読みやすい標準フォントに変更しました。', 'The battle setup, settings, shop and ranking panels and nicknames now use a plain, easier-to-read font.', '出征界面、设置、商店、排行榜界面和昵称改用了更易读的普通字体。'],
      ['예전에 소환한 장수를 자동으로 열어 주던 기능을 없앴습니다.', '過去に召喚した武将を自動で解放する機能を廃止しました。', 'Removed the feature that auto-unlocked generals you had summoned before.', '取消了自动解锁曾经召唤过的武将的功能。'],
    ] },
    { v: '0.2.30', d: '2026-11-18', items: [
      ['로딩 화면이 생겼습니다. 처음 시작할 때 로그인, 닉네임, 관직 갈래(무관·문관)를 정합니다.', 'ロード画面を追加しました。初回起動時にログイン、ニックネーム、官職の系統（武官・文官）を決めます。', 'Added a loading screen. On first launch you sign in, choose a nickname and pick a career path (military or civil).', '新增了加载画面。首次启动时登录、设置昵称并选择官职路线（武官或文官）。'],
      ['첫 안내가 게임 소개로 시작하도록 바꿨습니다.', '最初の案内をゲーム紹介から始まるように変更しました。', 'The first tutorial now starts with an introduction to the game.', '新手引导改为从游戏介绍开始。'],
    ] },
    { v: '0.2.29', d: '2026-11-18', items: [
      ['Google 로그인을 쓸 수 있도록 준비했습니다.', 'Googleログインを使えるよう準備しました。', 'Prepared Google sign-in.', '已准备好 Google 登录。'],
      ['계정 삭제 안내 페이지를 만들고 개인정보 처리방침을 고쳤습니다.', 'アカウント削除の案内ページを作成し、プライバシーポリシーを更新しました。', 'Added an account deletion page and updated the privacy policy.', '新增了删除账号说明页面，并更新了隐私政策。'],
    ] },
    { v: '0.2.28', d: '2026-11-18', items: [
      ['자동 정렬·합성이 처음에는 꺼져 있습니다. 한 번 켜면 다음 판에도 켜진 채 시작합니다.', '自動整列・合成は最初はオフです。一度オンにすると次のバトルもオンのまま始まります。', 'Auto sort & combine now starts off. Once you turn it on, it stays on for later games.', '自动整理与合成默认关闭。打开一次后，之后的对局也会保持打开。'],
      ['유닛을 골랐을 때 뜨는 창이 오른쪽 버튼을 가리지 않습니다.', 'ユニットを選んだときの表示が右側のボタンを隠さなくなりました。', 'The selection bar no longer covers the buttons on the right.', '选中单位时的信息栏不再遮住右侧按钮。'],
      ['서랍의 각 탭과 선택권, 배속을 처음 볼 때 설명이 한 번씩 나옵니다.', 'メニューの各タブ、選択券、速度を初めて見るときに説明が一度ずつ表示されます。', 'First-time tips now explain each drawer tab, tickets and game speed.', '首次打开抽屉的各个标签、选择券和速度时会显示一次说明。'],
    ] },
    { v: '0.2.27', d: '2026-11-18', items: [
      ['보통 난이도: 전설 장수를 만들고 강화를 잘하면 클리어할 수 있게 조정했습니다.', '「ふつう」：伝説の武将を作り、強化をしっかり行えばクリアできるよう調整しました。', 'Normal: tuned so that a Legendary general with good upgrades can clear it.', '普通难度：调整为做出传说武将并好好强化即可通关。'],
      ['협동 플레이의 마지막 보스 체력을 인원에 맞게 조정했습니다.', '協力プレイの最終ボスの体力を人数に合わせて調整しました。', 'Adjusted final boss HP in co-op to fit the party size.', '按人数调整了合作模式最终首领的生命值。'],
    ] },
    { v: '0.2.26', d: '2026-11-17', items: [
      ['마초가 신화 장수가 되었습니다(신화 10명). 새 5성 장수 마대가 추가됐습니다.', '馬超が神話武将になりました（神話は10人）。新しい★5武将「馬岱」を追加しました。', 'Ma Chao is now a Myth general (10 Myths in total). Added a new ★5 general, Ma Dai.', '马超成为神话武将（神话共10名）。新增5星武将马岱。'],
      ['쉬움을 처음 클리어하면 상점이 열리고 신화 2명을 무작위로 받습니다.', '「かんたん」を初めてクリアするとショップが開き、神話武将2人をランダムでもらえます。', 'Clearing Easy for the first time opens the Shop and unlocks 2 random Myth generals.', '首次通关简单难度后开放商店，并随机解锁2名神话武将。'],
    ] },
    { v: '0.2.25', d: '2026-11-17', items: [
      ['신화·불멸 장수는 처음에 잠겨 있고, 상점에서 동전이나 광고 보상으로 엽니다.', '神話・不滅の武将は最初はロックされていて、ショップで銅銭や広告視聴で解放します。', 'Myth and Immortal generals start locked; unlock them in the Shop with coins or ad rewards.', '神话和不灭武将一开始是锁定的，可在商店用铜钱或广告奖励解锁。'],
      ['어려움은 불멸, 악몽은 불멸과 시너지가 있어야 클리어할 수 있게 난이도를 다시 맞췄습니다.', '「むずかしい」は不滅、「悪夢」は不滅とシナジーがないとクリアできないよう難易度を見直しました。', 'Rebalanced difficulty: Hard expects an Immortal; Nightmare expects Immortals plus synergies.', '重新调整了难度：困难需要不灭武将，噩梦需要不灭武将和羁绊。'],
      ['안내(튜토리얼)를 직접 해 보며 넘어가는 방식으로 새로 만들었습니다.', 'チュートリアルを、実際に操作しながら進む形式に作り直しました。', 'Rebuilt the tutorial so you learn by doing each step.', '重做了新手引导，改为边操作边学习。'],
    ] },
  ];
  const li = () => { const k = (root.RTD_I18N && root.RTD_I18N.lang) || 'ko'; return Math.max(0, LANGS.indexOf(k)); };
  const t = (k) => TX[k][li()] || TX[k][0];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SEEN = 'rtd-news-seen';
  const latest = () => NOTES[0].v;
  // 아직 안 본 새 내역이 있는지(버튼의 빨간 점)
  // 서버 공지(GET /api/notice의 notice: { id, text: { ko, ja, en, zh } }). 앱을 켤 때 받아 setNotice로 넣는다. 내역 창 맨 위에 보이고, 안 본 id면 빨간 점.
  const NSEEN = 'rtd-notice-seen';
  let notice = null;
  function setNotice(n) { notice = n && typeof n === 'object' && n.id != null && n.text && typeof n.text === 'object' ? { id: String(n.id), text: n.text } : null; }
  const noticeText = () => { if (!notice) return ''; const k = LANGS[li()], v = notice.text[k] || notice.text.en || notice.text.ko || notice.text.ja || notice.text.zh; return typeof v === 'string' ? v : ''; };
  const noticeNew = () => { try { return !!noticeText() && localStorage.getItem(NSEEN) !== notice.id; } catch (e) { return false; } };
  function unseen() { try { return noticeNew() || localStorage.getItem(SEEN) !== latest(); } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN, latest()); if (noticeText()) localStorage.setItem(NSEEN, notice.id); } catch (e) { /* 저장 불가 */ } }
  function html() {
    const i = li();
    return `<div class="news">${noticeText() ? `<section class="news-notice"><h3>${t('notice')}</h3><p>${esc(noticeText())}</p></section>` : ''}<div class="news-now">${t('now')}: v${esc(root.RTD_VERSION || '?')}</div>${NOTES.map((n, k) => `<section><h3>v${esc(n.v)} <small>${esc(n.d)}</small>${k === 0 ? `<i>${t('latest')}</i>` : ''}</h3><ul>${n.items.map((it) => `<li>${esc(it[i] || it[0])}</li>`).join('')}</ul></section>`).join('')}</div>`;
  }
  root.RTD_NEWS = { html, label: () => t('title'), unseen, markSeen, latest, NOTES, setNotice };
})(typeof window !== 'undefined' ? window : globalThis);
