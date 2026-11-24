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
    { v: '0.3.9', d: '2026-11-24', items: [
      ['보물 상자에서 이미 해금한 장수의 아이템이 훨씬 잘 나옵니다(해금한 장수가 없으면 등급 상승권).', '宝箱から解放済みの武将のアイテムがずっと出やすくなりました（解放済みがない場合は昇格券）。', 'Chests now favor items for heroes you have unlocked (or give an upgrade ticket if none).', '宝箱现在更容易掉落已解锁武将的道具（若没有则给晋级券）。'],
      ['협동에서 라이프가 다한 사람만 탈락하고, 남은 사람은 계속 싸웁니다. 탈락한 사람은 관전합니다.', '協力プレイでライフが尽きた人だけが脱落し、残りの仲間は戦い続けます。脱落した人は観戦できます。', 'In co-op, only players who run out of lives are eliminated; the rest fight on while the eliminated watch.', '合作模式中只有生命耗尽的玩家会出局，其他人继续战斗，出局者可观战。'],
      ['악몽 +N의 변칙 규칙은 불리한 효과가 커져서, 단계가 높을수록 더 어려워집니다. 「배수진」과 「군웅할거」는 함께 나오지 않습니다.', '悪夢+Nの変則ルールは不利な効果が大きくなり、段階が上がるほど難しくなりました。「背水の陣」と「群雄割拠」は同時に出ません。', 'Nightmare +N rules now carry heavier drawbacks, so higher levels are harder. Last Stand and Warlords Rise no longer appear together.', '噩梦+N变则规则的不利效果加强，等级越高越难。「背水阵」与「群雄割据」不会同时出现。'],
    ] },
    { v: '0.3.8', d: '2026-11-24', items: [
      ['오늘의 미션 3개가 생겼습니다(일본 시간 0시에 바뀜). 관직이 오르거나 업적을 처음 달성하면 동전을 받고, 관직 2단계까지 훨씬 빨리 오릅니다.', '今日のミッションが3つ追加されました（日本時間0時に更新）。官職が上がったときや実績を初めて達成したときに銅銭がもらえ、官職2段階目まで早く上がれるようになりました。', 'Added 3 daily missions (reset at midnight JST). Rank-ups and first-time achievements now give coins, and the second rank comes much sooner.', '新增3个每日任务（日本时间0点刷新）。官职晋升和首次达成成就可获得铜钱，官职第2阶也更快达到。'],
      ['악몽 +N의 변칙 규칙은 이제 판을 시작할 때 정해지고, 하나씩 도장 찍히듯 공개됩니다.', '悪夢+Nの変則ルールはバトル開始時に決まり、ひとつずつ判を押すように発表されます。', 'Nightmare +N rules are now drawn when the battle starts and revealed one by one like stamps.', '噩梦+N的变则规则改为开局时决定，并逐条盖章般揭晓。'],
      ['보물 상자에서 아직 해금하지 않은 장수의 아이템도 나옵니다. 해금하면 합성할 수 있습니다.', '宝箱から未解放の武将のアイテムも出るようになりました。解放すると合成できます。', 'Chests can now drop items for heroes you have not unlocked yet; unlock them to combine.', '宝箱现在也会掉落尚未解锁武将的道具，解锁后即可合成。'],
      ['90Hz·144Hz 화면에서도 60프레임으로 매끄럽게 움직이고, 로비에서 발열과 배터리 소모를 줄였습니다. 협동 판의 안정성을 높였습니다.', '90Hz・144Hz画面でも60fpsでなめらかに動き、ロビーでの発熱とバッテリー消費を抑えました。協力プレイの安定性も高めました。', 'Smooth 60 fps on 90 Hz and 144 Hz screens, less heat and battery drain in the lobby, and more stable co-op.', '90Hz和144Hz屏幕也能流畅运行60帧，降低大厅发热和耗电，并提升了合作模式的稳定性。'],
    ] },
    { v: '0.3.7', d: '2026-11-23', items: [
      ['함께하는 동료 목록을 「동맹 n명」 버튼 하나로 접었습니다. 누르면 펼쳐지고, 동료 전장을 고르면 그곳으로 이동합니다. 동료 전선이 위험하면 버튼에 붉은 표시가 뜹니다. 덕분에 조이스틱이 왼쪽 아래 끝에 놓입니다.', '仲間の一覧を「同盟 n人」ボタンひとつにまとめました。押すと開き、仲間の戦場を選ぶとそこへ移動します。仲間の戦線が危ないとボタンに赤い印が出ます。そのぶんジョイスティックが左下の端に置かれます。', 'Allies are now folded into one "Allies (n)" button. Tap to open the list and pick an ally to view their lane; a red mark warns when an ally’s front is in danger. The joystick now sits in the bottom-left corner.', '队友列表收进一个「同盟 n人」按钮。点开后选择队友即可查看其战场；队友战线危急时按钮上会出现红色标记。摇杆因此回到左下角。'],
      ['업적 깃발을 화면 아래쪽에 붙이고, 깃발마다 같은 칸·같은 바닥선에 맞춰 가지런히 세웠습니다.', '実績の旗を画面下側に寄せ、どの旗も同じ枠・同じ高さにそろえて並べました。', 'Achievement flags now sit at the bottom of their area, evenly aligned in a tidy grid.', '成就旗帜靠下排列，并按统一格子和底线对齐。'],
    ] },
    { v: '0.3.6', d: '2026-11-23', items: [
      ['유닛 정보 창을 새로 꾸몄습니다. 등급 테두리 초상, 핵심 능력치, 속한 인연(n/m), 이름이 붙은 스킬을 한눈에 보고, 합성·해산은 오른쪽 큰 버튼으로 합니다. 「상세」를 누르면 조합식과 스킬 설명 전체가 보입니다.', 'ユニット情報画面を一新しました。等級枠の肖像・主要能力値・所属する縁(n/m)・名前付きのスキルがひと目で分かり、合成・解散は右の大きなボタンで行えます。「詳細」で全レシピとスキル説明を確認できます。', 'Redesigned the unit info panel: a rank-framed portrait, key stats, the bonds it belongs to (n/m) and named skills at a glance, with combine/disband on a big button at the right. Tap "Details" for all recipes and full skill descriptions.', '全新设计了单位信息面板：带等级边框的头像、主要属性、所属羁绊(n/m)和带名称的技能一目了然，合成与解散使用右侧的大按钮。点击「详细」可查看全部配方和技能说明。'],
      ['해산은 받을 금화를 보여 주고 두 번 눌러야 실행됩니다. 스킬 설명은 다른 곳을 누를 때까지 떠 있습니다.', '解散は受け取る金貨を表示し、2回押すと実行されます。スキル説明はほかの場所を押すまで表示されたままになります。', 'Disband now shows the gold you will get and needs two taps. Skill descriptions stay open until you tap elsewhere.', '解散会显示可获得的金币，需要点击两次才会执行。技能说明会一直显示，直到点击其他位置。'],
    ] },
    { v: '0.3.5', d: '2026-11-23', items: [
      ['업적 깃발이 화면 크기에 맞춰 오른쪽 버튼 옆 빈 자리에 놓여, 버튼에 가려지지 않고 누를 수 있습니다.', '実績の旗が画面サイズに合わせて右側ボタンの横の空きスペースに並び、ボタンに隠れずに押せるようになりました。', 'Achievement flags now line up in the free space beside the right-side buttons, so they are never hidden and can always be tapped.', '成就旗帜会根据画面大小排列在右侧按钮旁的空白处，不再被按钮遮挡，可以点击。'],
      ['전투 화면 그리기를 가볍게 해 휴대폰에서 프레임이 더 잘 나옵니다.', '戦闘画面の描画を軽くし、スマートフォンでのフレームレートが上がりました。', 'Battle rendering is lighter, giving smoother frame rates on phones.', '减轻了战斗画面的绘制负担，手机上的帧率更流畅。'],
      ['안드로이드: 버튼을 누를 때 파란 강조가 나오지 않고, 게임 중에는 아래 내비게이션 막대를 숨깁니다(가장자리를 쓸면 잠깐 나타남).', 'Android：ボタンを押したときの青いハイライトをなくし、ゲーム中は下のナビゲーションバーを隠します(端をスワイプすると一時的に表示)。', 'Android: no more blue tap highlight on buttons, and the bottom navigation bar is hidden during play (swipe from the edge to show it briefly).', 'Android：点击按钮时不再出现蓝色高亮，游戏中隐藏底部导航栏(从边缘滑动可暂时显示)。'],
    ] },
    { v: '0.3.4', d: '2026-11-23', items: [
      ['AI 동맹·협동 판에서 안내 말풍선이 떠 있는 동안 화면 전체가 어둡게 덮여 유닛이 흐려 보이던 문제를 고쳤습니다. 이제 안내할 곳만 금빛 테두리로 비춥니다.', 'AI同盟・協力プレイで案内の吹き出しが出ている間、画面全体が暗くなりユニットがぼやけて見えた問題を修正しました。案内する場所だけを金色の枠で示します。', 'Fixed the whole screen being darkened while a tip was shown in AI-ally and co-op games, which made units look blurry. Tips now just highlight the spot with a gold ring.', '修复了在AI同盟和合作模式中显示提示时整个画面变暗、单位看起来模糊的问题。现在只用金色边框标出提示位置。'],
    ] },
    { v: '0.3.3', d: '2026-11-22', items: [
      ['選択券 창을 연 채로도 다른 탭·버튼·유닛 선택·조이스틱을 쓸 수 있습니다. 창 밖을 누르면 자동으로 닫히고, 선택권은 그대로 남습니다.', '選択券の画面を開いたままでも、ほかのタブ・ボタン・ユニット選択・スティックを操作できるようになりました。画面の外を押すと自動で閉じ、選択券はそのまま残ります。', 'You can now use other tabs, buttons, unit selection and the joystick while the selection-ticket window is open. Tapping outside closes it automatically, and your tickets are kept.', '选择券窗口打开时也可以操作其他标签、按钮、单位选择和摇杆。点击窗口外会自动关闭，选择券会保留。'],
      ['전장 화면에서 간헐적으로 유닛이 흐려지며 잔상이 남을 수 있던 문제를 막도록 그리기 상태를 매 프레임 초기화합니다.', '戦場で時々ユニットがぼやけて残像が出ることがある問題を防ぐため、描画状態を毎フレーム初期化するようにしました。', 'The drawing state is now reset every frame to prevent units occasionally turning blurry with afterimages.', '为防止战场上单位偶尔变模糊并留下残影，现在每帧都会重置绘制状态。'],
    ] },
    { v: '0.3.2', d: '2026-11-21', items: [
      ['협력 대기방을 새로 꾸몄습니다. 방 코드가 크게 보이고, 참가자 카드에 관직과 레벨, 방장·나 표시가 붙으며, 입장 대기 화면에서 준비한 인원을 한눈에 볼 수 있습니다.', '協力ルームを一新しました。ルームコードが大きく表示され、参加者カードに官職・レベルとホスト・自分の表示が付き、入場待ち画面では準備済みの人数がひと目で分かります。', 'The co-op room has been redesigned: a large room code, player cards with rank, level and host/you tags, and a clear ready count on the waiting screen.', '合作房间全新改版：房间代码更醒目，参与者卡片显示官职、等级以及房主/自己标记，入场等待画面可一眼看出已准备人数。'],
      ['보스 출진 카드가 위쪽으로 정렬되어 이름이 잘리지 않고, 장수를 골라도 목록이 맨 위로 튀지 않습니다.', 'ボス戦の出陣カードを上揃えにし、名前が切れないようにしました。武将を選んでも一覧が先頭に戻らなくなりました。', 'Boss sortie cards are now top-aligned so names are no longer cut off, and the list no longer jumps back to the top when you pick a general.', 'Boss出阵卡片改为顶部对齐，名称不再被截断；选择武将时列表也不会跳回顶部。'],
      ['왼쪽 정보칸에서 병력 표시를 빼고, 인연은 발동 중이거나 곧 켜질 것만 보이게 했습니다. 전체 인연은 「縁一覧」 버튼으로 볼 수 있습니다.', '左の情報欄から兵力表示をなくし、縁は発動中やもうすぐ発動するものだけを表示するようにしました。すべての縁は「縁一覧」ボタンで確認できます。', 'The troop count was removed from the left panel, and only active or nearly complete bonds are listed there. Tap “All bonds” to see every bond.', '左侧信息栏移除了兵力显示，羁绊只显示已激活或即将激活的项目；全部羁绊可通过「羁绊一览」按钮查看。'],
    ] },
    { v: '0.3.1', d: '2026-11-20', items: [
      ['Apple로 로그인할 때 이름과 메일 주소를 묻지 않습니다. Apple로 만든 계정을 지우면 Apple 쪽 연결도 함께 해제됩니다.', 'Appleでサインインするとき、名前とメールアドレスを求めなくなりました。Appleで作成したアカウントを削除すると、Apple側の連携も解除されます。', 'Sign in with Apple no longer asks for your name or email, and deleting an Apple-linked account now also disconnects it on Apple’s side.', '使用Apple登录时不再请求姓名和邮箱；删除通过Apple创建的账号时，也会同时解除Apple端的关联。'],
    ] },
    { v: '0.3.0', d: '2026-11-19', items: [
      ['인연 시너지를 새로 만들었습니다. 58개의 인연이 모인 인원에 따라 단계(2·3·4명…)와 등급(하~극+)으로 켜지고, 불멸·신화 장수마다 대표 인연이 있습니다.', '縁のシナジーを一新しました。58の縁が集まった人数に応じて段階（2・3・4人…）と等級（下〜極+）で発動し、不滅・神話の武将にはそれぞれ代表の縁があります。', 'Bond synergies have been rebuilt: 58 bonds now activate in tiers by member count (2, 3, 4…) with grades from Low to Supreme+, and every Immortal and Mythic general has a signature bond.', '羁绊协同全面重做：58个羁绊按集齐人数分阶段（2、3、4人…）和等级（下~极+）激活，每位不灭、神话武将都有专属羁绊。'],
      ['인연은 보스전에 나가는 장수 한 명을 키웁니다. 동료의 원군 사격, 화선 돌격, 표식 폭발, 부활 같은 효과가 생기고, 협동에서는 다른 사람의 원군도 이름표와 함께 보입니다.', '縁はボス戦に出陣する武将一人を強化します。仲間の援軍射撃、火船突撃、印の爆発、復活などの効果が加わり、協力プレイでは他の人の援軍も名札付きで表示されます。', 'Bonds empower the one general you send into the boss fight, with effects such as reinforcement volleys, fire ships, exploding marks and revives. In co-op, other players’ reinforcements appear with name tags.', '羁绊强化出战Boss战的那一位武将，新增援军射击、火船突击、印记爆炸、复活等效果；合作模式中也会显示其他玩家的援军并附带名牌。'],
      ['인연이 꺼지는 조합에는 확인 창이 뜨고, 설정에서 자동 조합이 켜진 인연을 지키게 할 수 있습니다.', '縁が解除される合成では確認画面が出ます。設定で自動合成が発動中の縁を維持するようにできます。', 'Combines that would break a bond now ask for confirmation, and a setting lets auto-combine keep active bonds.', '会解除羁绊的合成会弹出确认，并可在设置中让自动合成保留已激活的羁绊。'],
      ['라인에 공격 버튼이 생겼습니다. 유닛을 움직이며 누르면 사거리 안의 중간보스를 먼저 때립니다.', 'ラインに攻撃ボタンを追加しました。ユニットを動かしながら押すと、射程内の中ボスを優先して攻撃します。', 'Added an attack button in the lane: hold it while moving units to hit mid-bosses in range first.', '线路新增攻击按钮：移动单位时按住即可优先攻击射程内的中Boss。'],
      ['보스 범위 공격 예고를 알아보기 쉽게 바꿨습니다. 범위 경계가 또렷하고, 안쪽이 다 차오르는 순간 터집니다. 보스전 사거리 표시도 라인과 같게 맞췄습니다.', 'ボスの範囲攻撃の予告を見やすくしました。範囲の境目がはっきりし、内側が満ちた瞬間に発動します。ボス戦の射程表示もラインと同じにしました。', 'Boss area-attack warnings are now easy to read: clear edges, and they detonate the moment the fill reaches the edge. The boss-fight range circle now matches the lane.', 'Boss范围攻击预警更易辨认：边界清晰，内部填满的瞬间触发。Boss战射程显示也与线路一致。'],
    ] },
    { v: '0.2.38', d: '2026-11-19', items: [
      ['장각·제갈량·사마의 경기장 바닥에 팔괘 문양이 돌아왔습니다. 조조전과 여포전의 바닥 색을 다듬었습니다.', '張角・諸葛亮・司馬懿の闘技場の床に八卦の紋様が戻りました。曹操戦と呂布戦の床の色を調整しました。', 'The bagua emblem is back on the floors of the Zhang Jiao, Zhuge Liang and Sima Yi arenas, and the Cao Cao and Lu Bu arena floor colors were adjusted.', '张角、诸葛亮、司马懿的场地地面重新加入了八卦纹样，并调整了曹操战和吕布战的地面颜色。'],
      ['보스전에서 장수가 1명일 때는 왼쪽 아래 장수 전환 카드를 숨겨 보스와 조이스틱을 가리지 않게 했습니다.', 'ボス戦で武将が1人のときは左下の武将切り替えカードを隠し、ボスやスティックの邪魔にならないようにしました。', 'In boss fights with a single general, the general-switch card in the lower left is now hidden so it no longer covers the boss or the joystick.', 'Boss战中只有1名武将时，隐藏左下角的武将切换卡片，不再遮挡Boss和摇杆。'],
    ] },
    { v: '0.2.37', d: '2026-11-19', items: [
      ['보스전 경기장을 다시 만들었습니다. 바닥이 화면 끝까지 이어지고, 난간과 바닥 그림이 늘어나 보이지 않게 고해상도로 바꿨으며, 보스마다 바닥 재질과 색이 다릅니다. 카메라가 조금 가까이에서 내 장수를 따라갑니다.', 'ボス戦の闘技場を作り直しました。床が画面の端まで広がり、柵と床の絵が引き伸ばされないよう高解像度にし、ボスごとに床の質感と色が変わります。カメラが少し寄って自分の武将を追いかけます。', 'Rebuilt the boss arena: the floor now extends to the screen edges, the railing and floor art are high-resolution so nothing looks stretched, and each boss has its own floor texture and color. The camera now follows your general a little closer.', '重做了Boss战场地：地面延伸到屏幕边缘，栏杆和地面换成高清图不再拉伸，每个Boss的地面材质和颜色各不相同。镜头稍微拉近并跟随自己的武将。'],
      ['보스전 조작이 가벼워졌습니다. 조이스틱과 버튼이 작아지고 평소에는 반투명하며, 화면 왼쪽 아래 아무 곳이나 누르면 그 자리에 조이스틱이 나타납니다.', 'ボス戦の操作を軽くしました。スティックとボタンを小さく、普段は半透明にし、画面左下のどこを押してもその場所にスティックが出ます。', 'Lighter boss controls: the joystick and buttons are smaller and semi-transparent when idle, and the joystick appears wherever you touch in the lower left.', 'Boss战操作更轻快：摇杆和按钮变小，平时半透明，按下屏幕左下任意位置摇杆就会出现在那里。'],
      ['보스전 화면을 정리했습니다. 보스 체력 막대·남은 시간·기술 이름·기믹 안내가 화면 위에 고정돼 서로 겹치지 않고, 왼쪽 정보와 피해 순위는 접혀서 필요할 때 눌러 펼칩니다.', 'ボス戦の画面を整理しました。ボスの体力ゲージ・残り時間・技名・ギミック案内が画面上部に固定され重ならず、左側の情報とダメージ順位は折りたたまれ、タップで開けます。', 'Cleaner boss screen: the boss health bar, timer, skill names and mechanic hints are pinned to the top without overlapping, and the side info and damage ranking are collapsed until you tap them.', '整理了Boss战画面：Boss血条、剩余时间、技能名和机制提示固定在屏幕上方互不重叠，左侧信息和伤害排名折叠起来，点击即可展开。'],
    ] },
    { v: '0.2.36', d: '2026-11-18', items: [
      ['화면 전체를 다듬었습니다. 제목 현판, 창 틀·버튼·아이콘을 한 가지 화풍으로 맞추고, 창이 열릴 때와 버튼을 누를 때 움직임을 넣었습니다.', '画面全体を磨き上げました。タイトルの扁額、ウィンドウの枠・ボタン・アイコンを一つの画風にそろえ、ウィンドウが開くときやボタンを押したときの動きを加えました。', 'Polished the whole interface: a title plaque, and window frames, buttons and icons in one consistent style, with motion when windows open and buttons are pressed.', '全面打磨了画面：标题匾额、窗口边框、按钮和图标统一为同一画风，并为打开窗口和按下按钮加入了动效。'],
      ['보스전이 새로워졌습니다. 보스 체력 막대·조이스틱·공격 버튼·경기장 테두리와 바닥 문양을 새 그림으로 바꾸고, 장판 예고와 낙뢰 같은 기술 연출을 그림으로 다시 만들었습니다.', 'ボス戦を一新しました。ボスの体力ゲージ・スティック・攻撃ボタン・闘技場の縁と床の紋様を新しい絵にし、範囲予告や落雷などの技の演出を描き直しました。', 'Boss fights got a makeover: new art for the boss health bar, joystick, attack button and arena border and floor, and redrawn warning zones and lightning effects.', 'Boss战焕然一新：Boss血条、摇杆、攻击按钮、场地边框和地面纹样换成新图，范围预警和落雷等技能演出也重新绘制。'],
      ['라운드 전환, 목숨을 잃을 때, 보스 처치, 패배 순간에 연출이 생겼고, 판 화면의 작은 글자와 체력 막대가 휴대폰에서 잘 보이게 커졌습니다.', 'ラウンドの切り替え、ライフを失ったとき、ボス討伐、敗北の瞬間に演出が付き、戦場の小さな文字や体力ゲージがスマホで見やすくなりました。', 'Added effects for new rounds, losing a life, defeating a boss and defeat, and enlarged small battlefield text and health bars for phones.', '回合切换、失去生命、击败Boss和失败时加入了演出，战场上的小字和血条在手机上更清晰。'],
      ['결과 화면에 「같은 설정으로 다시」 버튼이 생기고, 받은 경험치·동전이 맨 앞에 나옵니다. AI 동맹 이름이 각 언어로 나오고, 싱글 판에서는 내 닉네임이 보입니다.', '結果画面に「同じ設定でもう一度」ボタンを追加し、獲得した経験値・銅銭を先頭に表示します。AI同盟の名前が各言語で表示され、シングルプレイでは自分のニックネームが表示されます。', 'The results screen now has a "Play again with same settings" button and shows XP and coins earned first. AI ally names are translated, and your nickname appears in single-player games.', '结算画面新增「相同设置再来一局」按钮，并优先显示获得的经验和铜钱。AI同盟名称按语言显示，单人模式显示自己的昵称。'],
    ] },
    { v: '0.2.35', d: '2026-11-18', items: [
      ['최단 클리어 랭킹이 「온라인 협동」(2인 이상)과 「솔로」(혼자·AI 동맹)로 나뉘었습니다.', '最速クリアランキングを「オンライン協力」（2人以上）と「ソロ」（ひとり・AI同盟）に分けました。', 'The Fastest clear ranking is now split into Online co-op (2+ players) and Solo (alone or with AI allies).', '最快通关排行榜分为“在线协作”（2人以上）和“单人”（独自或AI同盟）。'],
      ['보스전에서 AI 동맹의 장수들이 한 점에 겹쳐 움직이지 않고, 서로 자리를 벌려 싸웁니다.', 'ボス戦でAI同盟の武将が一か所に重ならず、間隔をあけて戦うようになりました。', 'In boss fights, AI allies no longer stack on one spot; they spread out around the boss.', 'Boss战中AI同盟的武将不再重叠在一点，而是分散站位作战。'],
    ] },
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
