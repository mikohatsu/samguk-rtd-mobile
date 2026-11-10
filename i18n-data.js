// 다국어 데이터(일본어·영어·중국어). 한 줄에 "한국어|日本語|English|中文". i18n.js가 테마를 바꿀 때 쓴다.
(function (root) {
  const NAMES = `
요래 공포|遼来来の恐怖|Liao Is Coming|辽来止啼
구벌 정신|九伐の志|Nine Campaigns|九伐之志
백의도강|白衣渡江|White-Robed Crossing|白衣渡江
기책 십이|奇策十二|Twelve Stratagems|奇策十二
연환 계책|連環の計略|Chained Schemes|连环计策
연쇄 시전|連鎖詠唱|Chain Casting|连锁施法
음평 기습|陰平奇襲|Yinping Raid|阴平奇袭
필살|必殺|Finisher|必杀
광역 계책|広域の計|Sweeping Plan|广域计策
격검의 기예|撃剣の技|Swordsmanship|击剑之技
연격|連撃|Flurry|连击
부자의 의|父子の義|Bond of Father and Son|父子之义
부자의 기세|父子の気勢|Father and Son's Spirit|父子之势
노장의 지휘|老将の指揮|Veteran's Command|老将指挥
흡혈|吸血|Lifesteal|吸血
강타|強打|Heavy Blow|重击
중재의 언변|仲裁の弁舌|Mediator's Tongue|斡旋之辩
약점 간파|弱点看破|Spot Weakness|看破弱点
기세 꺾기|気勢くじき|Break Momentum|挫其锐气
완성의 독계|宛城の毒計|Poison Plot of Wancheng|宛城毒计
독계|毒計|Poison Plot|毒计
칠종칠금|七縦七擒|Seven Captures|七擒七纵
철벽|鉄壁|Iron Wall|铁壁
강건|強健|Sturdy|强健
쌍철극|双鉄戟|Twin Iron Halberds|双铁戟
완성의 사수|宛城の死守|Last Stand at Wancheng|死守宛城
악래|悪来|E Lai|恶来
단기 돌파|単騎突破|Lone Breakthrough|单骑突破
맹장의 피|猛将の血|Blood of a Warrior|猛将之血
처형|処刑|Execute|处决
목우유마|木牛流馬|Wooden Ox|木牛流马
연노 개량|連弩改良|Improved Repeater|改良连弩
목우 보급|木牛の補給|Ox Supply Line|木牛补给
연환계|連環計|Chain Strategy|连环计
봉추의 불길|鳳雛の炎|Phoenix Flames|凤雏之火
고정도|古錠刀|Old Ding Blade|古锭刀
호랑이의 기세|虎の気勢|Tiger's Might|猛虎之势
관통|貫通|Pierce|贯通
궁요희의 속사|弓腰姫の速射|Bow Princess's Volley|弓腰姬速射
호걸의 혈통|豪傑の血統|Heroic Lineage|豪杰血统
비장의 혈통|飛将の血統|Blood of the Flying General|飞将血统
소화극술|小戟術|Small Halberd Arts|小戟之术
비도 투척|飛刀投げ|Thrown Daggers|飞刀投掷
남만의 여걸|南蛮の女傑|Heroine of Nanman|南蛮女杰
비도 견제|飛刀牽制|Dagger Harass|飞刀牵制
십승십패론|十勝十敗論|Ten Victories Ten Defeats|十胜十败论
간파|看破|Insight|看破
기책 간파|奇策看破|Strategic Insight|奇策看破
철옹성|鉄壁の城|Impregnable Fort|铁瓮城
사수의 의지|死守の意志|Will to Hold|死守之志
철옹성 진형|鉄壁の陣形|Fortress Formation|铁瓮阵形
왕좌의 계책|王佐の計|Counsel of the Throne|王佐之策
왕좌의 안목|王佐の眼力|Eye of the Throne|王佐之眼
왕좌의 보좌|王佐の補佐|Aide of the Throne|王佐辅佐
장판교의 일갈|長坂橋の一喝|Roar at Changban Bridge|长坂桥一喝
장팔사모|丈八蛇矛|Serpent Spear|丈八蛇矛
장판교 위압|長坂橋の威圧|Changban Intimidation|长坂桥威压
칠진칠출|七進七出|Seven In, Seven Out|七进七出
장판파의 기적|長坂の奇跡|Miracle at Changban|长坂奇迹
소패왕의 기세|小覇王の気勢|Little Conqueror's Spirit|小霸王之势
강동 평정|江東平定|Pacify Jiangdong|平定江东
화공 연영|火攻連営|Burning Camps|火攻连营
화염 번짐|延焼|Spreading Fire|火势蔓延
서량 철기|西涼鉄騎|Xiliang Cavalry|西凉铁骑
포악|暴虐|Tyranny|暴虐
폐월|閉月|Moon-Hiding Beauty|闭月
경국의 춤|傾国の舞|Dance of Ruin|倾国之舞
경국지색|傾国の美|Beauty That Topples States|倾国之色
치세의 능신|治世の能臣|Able Minister|治世能臣
호표기|虎豹騎|Tiger and Leopard Cavalry|虎豹骑
적벽의 교훈|赤壁の教訓|Lesson of Red Cliffs|赤壁之训
위무의 사기|魏武の士気|Wei Martial Spirit|魏武士气
고평릉의 인내|高平陵の忍耐|Patience of Gaopingling|高平陵之忍
낭고의 계략|狼顧の計略|Wolf's Glance Scheme|狼顾之谋
간파의 눈|看破の眼|Discerning Eye|看破之眼
낭고|狼顧|Wolf's Glance|狼顾
인덕|仁徳|Benevolence|仁德
도원결의|桃園の誓い|Oath of the Peach Garden|桃园结义
인덕의 손길|仁徳の手|Benevolent Hand|仁德之手
청룡언월도|青龍偃月刀|Green Dragon Blade|青龙偃月刀
오관참장|五関突破|Five Passes|过五关斩六将
무성의 위엄|武聖の威厳|Saint of War|武圣之威
천하삼분지계|天下三分の計|Three Kingdoms Plan|天下三分之计
화공|火攻|Fire Attack|火攻
공명의 혜안|孔明の慧眼|Kongming's Insight|孔明慧眼
삼대의 기업|三代の基業|Legacy of Three Generations|三代基业
제왕의 눈|帝王の眼|Emperor's Eye|帝王之眼
강동의 수성|江東の守城|Defense of Jiangdong|江东守城
적벽의 불길|赤壁の炎|Flames of Red Cliffs|赤壁之火
연환 화공|連環火攻|Chained Fire Attack|连环火攻
수군 대도독|水軍大都督|Grand Admiral|水军大都督
백발백중|百発百中|Never Misses|百发百中
신정의 결투|神亭の一騎打ち|Duel at Shenting|神亭之斗
쌍극|双戟|Twin Halberds|双戟
태평요술|太平要術|Way of Peace|太平要术
황천의 뇌운|黄天の雷雲|Thunderclouds of Yellow Heaven|黄天雷云
부적수|符水|Talisman Water|符水
부적수 축복|符水の祝福|Talisman Blessing|符水祝福
무쌍|無双|Peerless|无双
방천화극|方天画戟|Sky Piercer|方天画戟
적토마|赤兎馬|Red Hare|赤兔马
둔갑술|遁甲術|Art of Concealment|遁甲术
가산 헌납|家財献納|Family Fortune|献纳家财
사신 외교|使者の外交|Envoy Diplomacy|使者外交
호가십팔박|胡笳十八拍|Eighteen Songs of a Nomad Flute|胡笳十八拍
수경의 안목|水鏡の眼力|Water Mirror's Eye|水镜之眼
담소|談笑|Small Talk|谈笑
선술|仙術|Immortal Arts|仙术
하비의 계책|下邳の計|Xiapi Strategy|下邳之计
낙신부|洛神賦|Ode to the Luo Goddess|洛神赋
국색|国色|National Beauty|国色
동작대의 노래|銅雀台の歌|Song of the Bronze Sparrow|铜雀台之歌
마비산|麻沸散|Mafeisan|麻沸散
성동격서|声東撃西|Feint East, Strike West|声东击西
음평 강행|陰平強行|Yinping March|阴平强行
팔문금쇄 파쇄|八門金鎖破り|Break the Eight Gates|破八门金锁
공격 호령|攻撃号令|Call to Attack|进攻号令
허점 노출|隙を晒す|Expose|暴露破绽
이간계|離間の計|Sow Discord|离间计
반간계|反間の計|Double Agent|反间计
맹수 돌격|猛獣突撃|Beast Charge|猛兽冲锋
진영 사수|陣地死守|Hold the Line|死守阵地
단극 투척|短戟投げ|Halberd Throw|投掷短戟
엄호|援護|Cover|掩护
낙가 돌격|楽嘉突撃|Lejia Charge|乐嘉突击
연노 일제사|連弩一斉射撃|Repeater Volley|连弩齐射
전군 치료|全軍治療|Heal All|全军治疗
연환 화염|連環の炎|Chained Flames|连环烈焰
강동 호령|江東号令|Jiangdong Command|江东号令
연환궁|連環弓|Chain Arrows|连环弓
비연보|飛燕歩|Swallow Step|飞燕步
소화극 난무|小戟乱舞|Halberd Dance|小戟乱舞
비도 연속 투척|飛刀連投|Dagger Barrage|飞刀连投
비도 난사|飛刀乱射|Dagger Storm|飞刀乱射
유계|遺計|Final Stratagem|遗计
요절의 예지|夭折の予知|Foresight|夭折之预知
유계 간파|遺計看破|Read the Final Plan|看破遗计
팔문금쇄진|八門金鎖の陣|Eight Gates Formation|八门金锁阵
철기 반격|鉄騎反撃|Cavalry Counter|铁骑反击
팔문금쇄 방진|八門金鎖の方陣|Eight Gates Bulwark|八门金锁方阵
구호탄랑|駆虎呑狼|Tiger Devours Wolf|驱虎吞狼
이호경식|二虎競食|Two Tigers Feud|二虎竞食
철벽 진형|鉄壁の陣形|Iron Wall Formation|铁壁阵形
장판교 대갈|長坂橋の大喝|Changban Bellow|长坂桥大喝
사모 돌격|蛇矛突撃|Serpent Spear Charge|蛇矛突击
장판교 호통|長坂橋の怒号|Changban Roar|长坂桥怒吼
용담|一身是胆|Dragon's Courage|一身是胆
패왕 돌격|覇王突撃|Conqueror's Charge|霸王突击
칠백리 화공|七百里の火攻|Burning 700 Li|火烧七百里
인내의 진|忍耐の陣|Formation of Patience|隐忍之阵
폭정의 압살|暴政の圧殺|Tyrant's Crush|暴政压杀
미인계|美人計|Honey Trap|美人计
연무|演舞|Sword Dance|演舞
의천검|倚天剣|Heaven Sword|倚天剑
호표기 돌격|虎豹騎突撃|Tiger Cavalry Charge|虎豹骑突击
사기 진작|士気高揚|Raise Morale|振奋士气
낭고상|狼顧相|Wolf Gaze|狼顾之相
농성 대기|籠城待機|Siege Patience|固守待机
고평릉의 함정|高平陵の罠|Gaopingling Trap|高平陵之陷阱
쌍고검|雙股剣|Twin Swords|双股剑
인덕의 빛|仁徳の光|Light of Benevolence|仁德之光
인덕의 전군 치료|仁徳の全軍治療|Benevolent Heal All|仁德全军治疗
청룡언월참|青龍偃月斬|Green Dragon Slash|青龙偃月斩
수엄칠군|水淹七軍|Flood the Seven Armies|水淹七军
단도부회|単刀赴会|Lone Blade Banquet|单刀赴会
동남풍|東南の風|Southeast Wind|东南风
팔진도|八陣図|Eight Formations|八阵图
칠성단|七星壇|Seven Stars Altar|七星坛
합비의 일격|合肥の一撃|Strike of Hefei|合肥一击
용인술|用人術|Art of Leadership|用人之术
합비 사수|合肥死守|Hold Hefei|死守合肥
적벽 화공|赤壁の火攻|Red Cliffs Fire|赤壁火攻
연환선 폭발|連環船爆破|Chained Ships Blast|连环船爆破
곡조 비기|曲の奥義|Melody Secret|曲调秘技
신궁 연사|神弓連射|Divine Bow Volley|神弓连射
단기 포위 돌파|単騎包囲突破|Break the Siege Alone|单骑突围
신의의 맹세|信義の誓い|Oath of Honor|信义之誓
황천 낙뢰|黄天落雷|Yellow Heaven Lightning|黄天落雷
천공 뇌진|天公雷震|Heavenly Thunder|天公雷震
태평 전군 치료|太平全軍治療|Taiping Heal All|太平全军治疗
무쌍 난무|無双乱舞|Peerless Frenzy|无双乱舞
적토 돌진|赤兎突進|Red Hare Charge|赤兔突进
천하무쌍|天下無双|Unrivaled Under Heaven|天下无双
합비의 맹장|合肥の猛将|Hero of Hefei|合肥猛将
천수의 기린아|天水の麒麟児|Qilin of Tianshui|天水麒麟儿
오하아몽|呉下の阿蒙|No Longer Wu's Fool|吴下阿蒙
조조의 모주|曹操の謀主|Cao Cao's Strategist|曹操谋主
음평의 기습가|陰平の奇襲者|Raider of Yinping|阴平奇袭者
단복|単福|Shan Fu|单福
관우의 양자|関羽の養子|Adopted Son of Guan Yu|关羽养子
강동의 숙장|江東の宿将|Veteran of Jiangdong|江东宿将
오의 외교가|呉の外交官|Diplomat of Wu|吴之外交家
난세의 독사|乱世の毒蛇|Viper of Chaos|乱世毒蛇
남만왕|南蛮王|King of Nanman|南蛮王
고대의 악래|古の悪来|E Lai Reborn|古之恶来
단기 칠진|単騎七陣|Lone Rider|单骑七阵
목우유마의 장인|木牛流馬の匠|Inventor of the Wooden Ox|木牛流马工匠
봉추|鳳雛|Young Phoenix|凤雏
강동의 호랑이|江東の虎|Tiger of Jiangdong|江东猛虎
궁요희|弓腰姫|Bow Princess|弓腰姬
여포의 딸|呂布の娘|Daughter of Lu Bu|吕布之女
불의 신의 후예|火神の末裔|Heir of the Fire God|火神后裔
귀재|鬼才|Demonic Genius|鬼才
위의 방패|魏の盾|Shield of Wei|魏之盾
왕좌지재|王佐の才|Talent to Aid a King|王佐之才
만인지적|万人の敵|Match for Ten Thousand|万人敌
상산의 일신시담|常山の一身是胆|All Courage of Changshan|常山一身是胆
소패왕|小覇王|Little Conqueror|小霸王
서생 대도독|書生の大都督|Scholar Commander|书生大都督
상국|相国|Chancellor|相国
폐월의 미인|閉月の美女|Beauty Who Hides the Moon|闭月美人
난세의 간웅|乱世の奸雄|Hero of Chaos|乱世奸雄
총달|冢虎|Crouching Tiger|冢虎
인의의 군주|仁義の君主|Lord of Benevolence|仁义之主
무성|武聖|Saint of War|武圣
와룡|臥龍|Sleeping Dragon|卧龙
자수성가의 오왕|呉の王|King of Wu|吴王
미주랑|美周郎|Handsome Zhou|美周郎
신의의 궁장|信義の弓将|Honorable Archer|信义弓将
천공장군|天公将軍|General of Heaven|天公将军
비장|飛将|Flying General|飞将
오각선인|烏角先生|Black Horn Sage|乌角先生
서주의 거부|徐州の豪商|Tycoon of Xuzhou|徐州巨富
유비의 사신|劉備の使者|Liu Bei's Envoy|刘备使者
수경선생|水鏡先生|Master Water Mirror|水镜先生
유비의 죽마고우|劉備の幼なじみ|Liu Bei's Old Friend|刘备旧友
강동의 신선|江東の仙人|Immortal of Jiangdong|江东仙人
여포의 군사|呂布の軍師|Lu Bu's Advisor|吕布军师
낙신|洛神|Luo Goddess|洛神
강동이교|江東の二喬|Two Qiaos of Jiangdong|江东二乔
신의|神医|Divine Physician|神医
곽가의 유계|郭嘉の遺計|Guo Jia's Last Plan|郭嘉遗计
팔문금쇄진도|八門金鎖陣図|Eight Gates Chart|八门金锁阵图
빈 찬합|空の食盒|Empty Food Box|空食盒
청강검|青釭剣|Qinggang Sword|青釭剑
이릉 화공서|夷陵火攻書|Yiling Fire Manual|夷陵火攻书
서량 철기 병부|西涼鉄騎の兵符|Xiliang Cavalry Seal|西凉铁骑兵符
폐월의 거울|閉月の鏡|Moon-Hiding Mirror|闭月之镜
낭고의 부절|狼顧の割符|Wolf's Tally|狼顾符节
백우선|白羽扇|White Feather Fan|白羽扇
오왕의 인수|呉王の印綬|Seal of the King of Wu|吴王印绶
적벽 화공도|赤壁火攻図|Red Cliffs Fire Plan|赤壁火攻图
신정의 단극|神亭の短戟|Shenting Halberd|神亭短戟
태평요술서|太平要術の書|Book of Taiping|太平要术书
랜덤 등급 상승권|ランダム昇格券|Random Promotion|随机升阶券
다른 세력 리롤권|勢力変更券|Faction Reroll|阵营重抽券
장수 교체권|武将交代券|General Swap|武将更换券
탁현의 황건 선봉|涿県の黄巾先鋒|Yellow Turban vanguard at Zhuo|涿县黄巾先锋
인공장군|人公将軍|General of Men|人公将军
십상시의 난|十常侍の乱|Revolt of the Ten Attendants|十常侍之乱
형양의 매복|滎陽の伏兵|Ambush at Xingyang|荥阳伏兵
장안의 난|長安の乱|Chaos in Chang'an|长安之乱
백마 전투|白馬の戦い|Battle of Baima|白马之战
연진 전투|延津の戦い|Battle of Yanjin|延津之战
박망파 전투|博望坡の戦い|Battle of Bowang|博望坡之战
형주 수군|荊州水軍|Jingzhou Navy|荆州水军
정군산 전투|定軍山の戦い|Battle of Mount Dingjun|定军山之战
번성 전투|樊城の戦い|Battle of Fancheng|樊城之战
진창 전투|陳倉の戦い|Battle of Chencang|陈仓之战
성도의 변|成都の変|Turmoil in Chengdu|成都之变
태평요술 낙뢰|太平要術・落雷|Taiping Lightning|太平要术落雷
부적 살포|護符散布|Talisman Spread|符咒散布
황천 뇌진|黄天雷震|Yellow Heaven Quake|黄天雷震
구절장 강령|九節杖降霊|Nine-Section Staff Summon|九节杖降灵
태평요술 제단|太平要術の祭壇|Taiping Altars|太平要术祭坛
황천 분신술|黄天分身術|Yellow Heaven Clones|黄天分身术
관문 돌격|関門突撃|Gate Charge|关门突击
대도 횡소|大刀薙ぎ払い|Great Blade Sweep|大刀横扫
낙석|落石|Rockfall|落石
서량의 호통|西涼の怒号|Xiliang Roar|西凉怒吼
사수관 낙석|汜水関の落石|Sishui Rockfall|汜水关落石
사수관 붕괴|汜水関崩壊|Sishui Collapse|汜水关崩塌
낙양 방화|洛陽放火|Burn Luoyang|火烧洛阳
철기 짓밟기|鉄騎の蹂躙|Cavalry Trample|铁骑践踏
화염 나선|炎の螺旋|Fire Spiral|火焰螺旋
폭군의 일갈|暴君の一喝|Tyrant's Bellow|暴君一喝
벽력거 투석|霹靂車の投石|Thunder Catapult|霹雳车投石
대군 진격|大軍進撃|Grand Army Advance|大军进击
하북 병력 포위|河北軍包囲|Hebei Encirclement|河北军包围
궁노 일제사|弓弩一斉射撃|Crossbow Volley|弓弩齐射
궁루 설치|櫓の設置|Raise Archer Towers|设置箭楼
궁루 재건|櫓の再建|Rebuild Archer Towers|重建箭楼
방천화극 횡소|方天画戟薙ぎ払い|Halberd Sweep|方天画戟横扫
천하무쌍 각성|天下無双・覚醒|Unrivaled Awakening|天下无双觉醒
연환선 화공|連環船火攻|Chained Ships Fire|连环船火攻
화선 낙하|火船落下|Fire Ships Fall|火船坠落
화용도 퇴로|華容道の退路|Retreat by Huarong|华容道退路
칠백리 연영 방화|七百里連営焼き|Burning the 700 Li Camps|火烧七百里连营
화공 나선|火攻螺旋|Fire Attack Spiral|火攻螺旋
불화살 비|火矢の雨|Rain of Fire Arrows|火箭雨
서생의 인내|書生の忍耐|Scholar's Patience|书生之忍
석병팔진|石兵八陣|Stone Sentinel Maze|石兵八阵
목우유마 돌격|木牛流馬突撃|Wooden Ox Charge|木牛流马突击
칠성등 기도|七星灯の祈り|Seven Lamps Prayer|七星灯祈祷
음평 절벽 낙하|陰平断崖落とし|Yinping Cliff Drop|阴平崖落
면죽관 돌파|綿竹関突破|Break Mianzhu Pass|突破绵竹关
잠행|潜行|Stealth|潜行
성도 함락|成都陥落|Fall of Chengdu|成都陷落
음평 절벽|陰平の断崖|Yinping Cliffs|阴平断崖
담중의 복병|沓中の伏兵|Tazhong Ambush|沓中伏兵
낭고의 시선|狼顧の視線|Wolf's Gaze|狼顾之视
고평릉의 변|高平陵の変|Gaopingling Coup|高平陵之变
농성의 끝|籠城の終わり|End of the Siege|固守之终
사마씨 삼대|司馬氏三代|Three Sima Generations|司马氏三代
진의 건국|晋の建国|Founding of Jin|晋之建国
석병의 그림자|石兵の影|Stone Sentinel Shadows|石兵之影
사마의 분신|司馬懿の分身|Sima Yi Clones|司马懿分身
천하통일|天下統一|Unification|天下统一
천벌 낙뢰|天罰の落雷|Heaven's Wrath|天罚落雷
사방 포위|四方包囲|Total Encirclement|四面包围
화염 낙하|火炎落下|Falling Flames|火焰坠落
`;
  // 이야기 문구(보스 대사·명대사)
  const LINES = `
창천은 이미 죽었고, 황천이 일어나리라.|蒼天已に死す、黄天当に立つべし。|The Blue Sky is dead; the Yellow Sky shall rise.|苍天已死，黄天当立。
내 칼을 받아낼 자, 연합군에 있느냐!|我が刀を受けられる者が連合軍にいるか！|Is there anyone in the coalition who can stop my blade?|联军之中，可有人接得住我这一刀！
낙양을 불태워라. 천하는 내 손 안이다.|洛陽を焼き払え。天下は我が手の内だ。|Burn Luoyang. The realm is in my hands.|烧了洛阳。天下尽在我手。
사세삼공의 위엄 앞에 무릎 꿇어라.|四世三公の威光にひれ伏せ。|Kneel before four generations of dukes.|在四世三公的威严前跪下吧。
셋이 덤벼도 좋다. 천하무쌍이 누구인지 보여주마.|三人がかりでも構わん。天下無双が誰か見せてやろう。|Come at me all three. I'll show you who is unrivaled.|三人一起上也无妨，让你们见识谁才是天下无双。
술을 앞에 두고 노래하세. 인생이 얼마나 되겠는가.|酒に対して当に歌うべし、人生幾何ぞ。|Sing before the wine; how long is a life?|对酒当歌，人生几何。
칠백 리 영채여, 이제 불타거라.|七百里の陣営よ、今こそ燃え尽きよ。|Seven hundred li of camps, burn now.|七百里连营，烧吧。
팔문이 열렸습니다. 생문은 어디일까요.|八門は開かれました。生門はどこでしょう。|The Eight Gates are open. Where is the Gate of Life?|八门已开，生门何在？
절벽도 길이 된다. 촉의 끝이 왔다.|断崖も道となる。蜀の終わりが来た。|Even cliffs become roads. Shu's end has come.|悬崖亦可成路，蜀之末日已至。
삼국의 영웅은 모두 갔다. 천하는 사마씨의 것이다.|三国の英雄は皆去った。天下は司馬氏のものだ。|The heroes of the Three Kingdoms are gone. The realm belongs to the Sima.|三国英雄皆已逝去，天下归司马氏。
군사는 신속함이 생명입니다.|兵は神速を貴ぶ。|Speed is the essence of war.|兵贵神速。
이 성은 내가 죽어서라도 지킨다.|この城は死んでも守り抜く。|I will hold this castle even if it costs my life.|此城，我死守到底。
천자를 받들어 백성의 바람을 따르는 것, 그것이 대의입니다.|主上を奉じて民望に従う、これこそ大義です。|Serve the Emperor and follow the people's hopes; that is the great cause.|奉主上以从民望，此乃大义。
연인 장익덕이 여기 있다!|燕人張翼徳、ここにあり！|Zhang Yide of Yan is here!|燕人张翼德在此！
나는 상산의 조자룡이다!|我こそは常山の趙子龍！|I am Zhao Zilong of Changshan!|吾乃常山赵子龙！
두 진 사이에서 승부를 내고, 천하와 겨루는 일은 내가 한다.|両陣の間で勝負を決し、天下と争うのは我が役目。|Deciding battles between armies and contending for the realm is my task.|决机于两阵之间，与天下争衡，由我来。
칠백 리 영채를 불길로 태우리라.|七百里の陣営を炎で焼き尽くそう。|I'll burn seven hundred li of camps.|火烧连营七百里。
천하의 일이 내 손에 달려 있지 않더냐!|天下の事、我にあらずや！|Does not the fate of the realm rest with me?|天下之事，岂不在我！
달도 부끄러워 구름 뒤에 숨는다지요.|月も恥じらい雲に隠れるとか。|They say even the moon hides behind the clouds in shame.|连月亮也羞得躲进云里。
내가 천하를 버릴지언정, 천하가 나를 버리게 두지 않겠다.|我が天下に背くとも、天下が我に背くことは許さぬ。|I would rather betray the world than let the world betray me.|宁我负天下人，休教天下人负我。
싸울 수 있으면 싸우고, 싸울 수 없으면 지킨다.|戦えるなら戦い、戦えぬなら守る。|Fight when you can; defend when you cannot.|能战当战，不能战当守。
큰일을 이루려면 반드시 사람을 근본으로 삼아야 한다.|大事を成すには必ず人を本とすべし。|Great deeds must be built on people.|夫济大事必以人为本。
술은 잠시 따라 두시오. 금방 다녀오겠소.|酒は注いでおいてくれ。すぐに戻る。|Pour the wine and leave it. I shall be right back.|酒且斟下，某去便来。
몸을 굽혀 온 힘을 다하고, 죽은 뒤에야 그치리라.|鞠躬尽瘁、死して後已む。|I will give my all until death.|鞠躬尽瘁，死而后已。
나와 늙은 역적은 결코 함께 설 수 없다.|孤と老賊とは両立せず。|The old traitor and I cannot both stand.|孤与老贼，势不两立。
조조가 제 발로 죽으러 오는데, 어찌 맞아들이겠습니까!|曹操は自ら死にに来るのです、迎え入れる理由などありません！|Cao Cao comes to his death; why would we welcome him?|曹操自来送死，岂可迎之！
대장부가 난세에 났으면 삼척 검을 차고 불세출의 공을 세워야 한다!|大丈夫が乱世に生まれたなら、三尺の剣で不世出の功を立てるべし！|A man born in chaos should take up his sword and win undying glory!|大丈夫生于乱世，当带三尺剑立不世之功！
사람 중엔 여포, 말 중엔 적토.|人中に呂布あり、馬中に赤兎あり。|Lu Bu among men, Red Hare among horses.|人中吕布，马中赤兔。
`;
  // 인연 시너지(이름·설명), 변형 규칙(이름·이득·손해), 업적(이름·조건), 소모품 설명
  const SYN = `
도원결의|桃園の誓い|Oath of the Peach Garden|桃园结义||3武将の攻撃力+12%、ボス戦の被ダメージ-10%|3 generals: ATK +12%, boss damage taken -10%|三人攻击+12%，首领战受伤-10%
손씨 삼대|孫家三代|Three Generations of Sun|孙氏三代||呉の全ユニット攻撃力+6%、3武将のスキル再使用-10%|All Wu units ATK +6%; 3 generals' skill cooldown -10%|吴国全体攻击+6%，三人技能冷却-10%
비장의 피|飛将の血|Blood of the Flying General|飞将之血||2武将が10%の確率で2倍ダメージ|Both deal double damage 10% of the time|两人10%几率造成2倍伤害
연환지계|連環の計|Chain Stratagem|连环之计||全敵の移動速度-5%、呂布・董卓の攻撃力+10%|All enemies -5% speed; Lu Bu and Dong Zhuo ATK +10%|全体敌人移速-5%，吕布·董卓攻击+10%
적벽대전|赤壁の戦い|Battle of Red Cliffs|赤壁之战||周瑜の攻撃力+20%・炎上+40%、諸葛亮・黄蓋の炎上+20%|Zhou Yu ATK +20% and burn +40%; Zhuge Liang and Huang Gai burn +20%|周瑜攻击+20%·燃烧+40%，诸葛亮·黄盖燃烧+20%
와룡봉추|臥龍鳳雛|Sleeping Dragon and Young Phoenix|卧龙凤雏||2武将のスキル再使用-10%、スキルダメージ+15%|Both: skill cooldown -10%, skill damage +15%|两人技能冷却-10%，技能伤害+15%
오호대장군|五虎大将軍|Five Tiger Generals|五虎上将||5武将の攻撃力+12%|5 generals: ATK +12%|五人攻击+12%
영천의 모사|潁川の謀士|Strategists of Yingchuan|颍川谋士||魏の全ユニット攻撃力+6%、3武将のスキル再使用-10%|All Wei units ATK +6%; 3 generals' skill cooldown -10%|魏国全体攻击+6%，三人技能冷却-10%
관씨 부자|関家父子|Guan Father and Son|关氏父子||関平の攻撃力+25%、関羽の攻撃力+10%|Guan Ping ATK +25%, Guan Yu ATK +10%|关平攻击+25%，关羽攻击+10%
장판파|長坂の戦い|Changban|长坂坡||2武将の攻撃力+8%、趙雲の被ダメージ-15%|Both ATK +8%; Zhao Yun damage taken -15%|两人攻击+8%，赵云受伤-15%
신정의 결투|神亭の一騎打ち|Duel at Shenting|神亭之斗||2武将が10%の確率で2倍ダメージ|Both deal double damage 10% of the time|两人10%几率造成2倍伤害
동오 대도독|東呉の大都督|Grand Commanders of Wu|东吴大都督||呉の全ユニット攻撃力+6%、4武将のスキルダメージ+15%|All Wu units ATK +6%; 4 generals' skill damage +15%|吴国全体攻击+6%，四人技能伤害+15%
남만왕 부부|南蛮王夫妻|King and Queen of Nanman|南蛮王夫妇||2武将の攻撃力+10%、ボス戦の体力+25%|Both ATK +10%, boss HP +25%|两人攻击+10%，首领战生命+25%
완성의 악래|宛城の悪来|E Lai of Wancheng|宛城恶来||典韋のボス戦体力+30%、曹操の被ダメージ-15%|Dian Wei boss HP +30%; Cao Cao damage taken -15%|典韦首领战生命+30%，曹操受伤-15%
천수의 기린아|天水の麒麟児|Qilin of Tianshui|天水麒麟儿||姜維の攻撃力+25%、諸葛亮のスキル再使用-8%|Jiang Wei ATK +25%; Zhuge Liang skill cooldown -8%|姜维攻击+25%，诸葛亮技能冷却-8%
진의 기틀|晋の礎|Foundation of Jin|晋之基业||2武将のボスへのダメージ+12%|Both deal +12% boss damage|两人对首领伤害+12%
하비의 책사|下邳の策士|Strategist of Xiapi|下邳谋士||呂布の攻撃力+15%、被ダメージ-10%|Lu Bu ATK +15%, damage taken -10%|吕布攻击+15%，受伤-10%
수경문하|水鏡門下|Students of Water Mirror|水镜门下||諸葛亮・龐統のスキルダメージ+20%、スキル再使用-10%|Zhuge Liang and Pang Tong: skill damage +20%, cooldown -10%|诸葛亮·庞统技能伤害+20%，冷却-10%
괄골요독|刮骨療毒|Scraping the Bone|刮骨疗毒||関羽のボス戦体力+30%、被ダメージ-10%|Guan Yu boss HP +30%, damage taken -10%|关羽首领战生命+30%，受伤-10%
소패왕의 반려|小覇王の伴侶|Little Conqueror's Wife|小霸王之妻||孫策の攻撃力+15%、ボスへのダメージ+10%|Sun Ce ATK +15%, boss damage +10%|孙策攻击+15%，对首领伤害+10%
미주랑의 반려|美周郎の伴侶|Handsome Zhou's Wife|美周郎之妻||周瑜の攻撃力+15%、炎上ダメージ+30%|Zhou Yu ATK +15%, burn damage +30%|周瑜攻击+15%，燃烧伤害+30%
문희귀한|文姫帰漢|Wenji Returns to Han|文姬归汉||魏の全ユニット攻撃力+5%、曹操のスキル再使用-10%|All Wei units ATK +5%; Cao Cao skill cooldown -10%|魏国全体攻击+5%，曹操技能冷却-10%
간손미|簡孫糜|Jian, Sun and Mi|简孙糜||全強化の最大段階+5|All upgrade caps +5|全部强化上限+5
`;
  const MUT = `
배수진|背水の陣|Last Stand|背水阵||ライフ1以下で全ユニットの攻撃力+50%|All units +50% ATK at 1 life or less|生命≤1时全体单位攻击+50%||戦線上限 60 → 30|Front limit 60 → 30|战线上限 60 → 30
명장의 귀순|名将の帰順|A General Defects|名将归顺||ランダムな★4を1体持って開始|Start with a random ★4|开局获得随机4星1个||ライフ1で開始|Start with 1 life|以1条生命开局
일기토|一騎討ち|Single Combat|单挑||ボス戦の出陣武将の攻撃力・体力+60%|Boss champions +60% ATK and HP|首领战出战武将攻击·生命+60%||ボス戦はチーム全体で1人ずつ順番に戦う（出陣前に先鋒を志願、倒れたら次、交代出陣なし）|In boss fights the whole team fights one champion at a time (volunteer for vanguard before deploying, next one when a champion falls, no substitutes)|首领战全队按顺序一次只上一名武将（出战前可自荐先锋，倒下后换下一名，不可替补）
속전속결|速戦即決|Swift Victory|速战速决||残り時間20%で速攻扱い（通常35%）|Fast clear with only 20% time left (normally 35%)|剩余20%时间即算速通（原35%）||ボス戦の制限時間-20%|Boss time limit -20%|首领战时限-20%
하늘의 분노|天の怒り|Wrath of Heaven|天之怒||ボス戦のスキル再使用-25%|Boss-fight skill cooldowns -25%|首领战技能冷却-25%||全ボスが「天罰の落雷」を追加で使う|Every boss also casts Heaven's Wrath|所有首领追加使用「天罚落雷」
대군 쇄도|大軍殺到|Endless Horde|大军涌来||戦線の敵10体ごとに全ユニットの攻撃力+5%|+5% ATK for all units per 10 enemies on the front|战线上每10个敌人全体攻击+5%||1ラウンドの敵の数+30%|+30% enemies per round|每回合敌人数量+30%
고립무원|孤立無援|Isolated|孤立无援||全ユニットの攻撃力+15%|All units ATK +15%|全体单位攻击+15%||名士を招けない|Can't hire sages|无法招募名士
영웅의 시대|英雄の時代|Age of Heroes|英雄时代||ボス討伐ごとにランダム等級上昇券1枚|A rank-up ticket per boss defeated|每次讨伐首领获得随机升级券1张||ボスの体力+20%|Boss HP +20%|首领生命+20%
보물 사냥|宝探し|Treasure Hunt|寻宝||ボス討伐ごとに宝箱+1|+1 chest per boss|每次讨伐首领宝箱+1||ボスの攻撃力+30%|Boss ATK +30%|首领攻击+30%
명의의 동행|名医の同行|Physician Joins|名医同行||華佗を招いた状態で開始|Start with Hua Tuo hired|开局已招募华佗||ボスの攻撃力+25%|Boss ATK +25%|首领攻击+25%
포위망|包囲網|Encirclement|包围网||ボス戦の制限時間+15%|Boss time limit +15%|首领战时限+15%||全ボスが「四方包囲」を追加で使う|Every boss also casts Total Encirclement|所有首领追加使用「四面包围」
폭풍 전야|嵐の前夜|Calm Before the Storm|暴风前夜||ボス討伐の金貨+50%|Boss gold +50%|首领奖励金币+50%||ボスの技の間隔20%短縮|Boss attacks 20% more often|首领招式间隔缩短20%
군량 부족|兵糧不足|Short on Rations|军粮不足||開始時の金貨+800|+800 starting gold|初始金币+800||ラインの敵の体力+15%|Lane enemy HP +15%|防线敌人生命+15%
화공 경보|火攻警報|Fire Alert|火攻警报||宝箱から不滅アイテムが2倍出やすい|Immortal items drop twice as often from chests|宝箱中不灭道具概率加倍||全ボスが「火炎落下」を追加で使う|Every boss also casts Falling Flames|所有首领追加使用「火焰坠落」
군웅할거|群雄割拠|Warlords Rise|群雄割据||精鋭の敵を倒すたびに金貨15|15 gold for each elite enemy defeated|每击败一个精锐敌人获得金币15||毎ラウンド体力の高い金色の精鋭が1体混じり、倒すまでラインを回り続ける|Each round a gold elite with huge HP joins the wave and keeps circling until defeated|每回合混入1个高生命的金色精锐，被击败前一直绕线移动
야습|夜襲|Night Raid|夜袭||中ボスの報酬2倍|Double mid-boss rewards|中首领奖励翻倍||夜で自分のユニットの周りしか見えない（ボス戦も自分の武将とボスの周りだけ明るい）|It's night: you can only see around your units (in boss fights, only around your champion and the boss)|夜晚只能看到己方单位周围（首领战也只照亮己方武将与首领周围）
`;
  const ACH = `
오병 편성|五兵編成|Five Soldiers|五兵编成||★1を5種類2体ずつ同時に所持|Hold 2 of each of the 5 ★1 units|同时持有5种1星各2个
의병 모집|義兵募集|Raise Volunteers|招募义兵||★1を12体同時に所持|Hold 12 ★1 units|同时持有12个1星
첫 부장|初の副将|First Officer|首位副将||★2を初めて入手|Get your first ★2|首次获得2星
군웅 등용|群雄登用|Recruit Warlords|群雄登用||異なる★2を3種類入手|Get 3 different ★2 units|获得3种不同的2星
한 깃발 아래|同じ旗の下|Under One Banner|同一面旗下||同じ★2を2体同時に所持|Hold 2 of the same ★2|同时持有2个相同的2星
이름 있는 장수들|名のある将たち|Named Officers|有名之将||★2を全種類入手|Get every ★2|获得全部2星
군웅의 부장|群雄の副将|Warlords' Officers|群雄副将||★3を全種類入手|Get every ★3|获得全部3星
맹장 집결|猛将集結|Gather the Warriors|猛将集结||★4を全種類入手|Get every ★4|获得全部4星
일당백|一騎当千|One Against a Hundred|以一当百||★5を全種類入手|Get every ★5|获得全部5星
전광석화: 황건|電光石火：黄巾|Lightning: Yellow Turbans|电光石火：黄巾||10ラウンドのボス前に★3を作る|Make a ★3 before the R10 boss|第10回合首领前制作3星
전광석화: 사수관|電光石火：汜水関|Lightning: Sishui|电光石火：汜水关||25ラウンドのボス前に★4を作る|Make a ★4 before the R25 boss|第25回合首领前制作4星
전광석화: 낙양|電光石火：洛陽|Lightning: Luoyang|电光石火：洛阳||40ラウンドのボス前に★5を作る|Make a ★5 before the R40 boss|第40回合首领前制作5星
전광석화: 관도|電光石火：官渡|Lightning: Guandu|电光石火：官渡||55ラウンドのボス前に★6〜7を作る|Make a ★6–7 before the R55 boss|第55回合首领前制作6~7星
전광석화: 호로관|電光石火：虎牢関|Lightning: Hulao|电光石火：虎牢关||70ラウンドのボス前に伝説〜神話を作る|Make a Legend–Myth before the R70 boss|第70回合首领前制作传说~神话
궁노 사수대|弓弩射手隊|Crossbow Squad|弓弩射手队||弓兵3体・夏侯淵・黄忠を同時に所持|Hold 3 Archers, Xiahou Yuan, Huang Zhong|同时持有弓兵3个·夏侯渊·黄忠
철기 돌격대|鉄騎突撃隊|Iron Cavalry|铁骑突击队||騎兵3体・公孫瓚・馬超を同時に所持|Hold 3 Cavalry, Gongsun Zan, Ma Chao|同时持有骑兵3个·公孙瓒·马超
방패 철벽진|盾の鉄壁陣|Shield Wall|盾牌铁壁阵||盾兵3体・于禁・徐晃を同時に所持|Hold 3 Shieldmen, Yu Jin, Xu Huang|同时持有盾兵3个·于禁·徐晃
검술 결사대|剣術決死隊|Sword Vanguard|剑术敢死队||剣兵3体・周泰・凌統を同時に所持|Hold 3 Swordsmen, Zhou Tai, Ling Tong|同时持有剑兵3个·周泰·凌统
장창 방진|長槍方陣|Pike Square|长枪方阵||槍兵3体・張郃・魏延を同時に所持|Hold 3 Spearmen, Zhang He, Wei Yan|同时持有枪兵3个·张郃·魏延
하북 대군|河北の大軍|Army of Hebei|河北大军||華雄2体・顔良・文醜・袁紹を同時に所持|Hold 2 Hua Xiong, Yan Liang, Wen Chou, Yuan Shao|同时持有华雄2个·颜良·文丑·袁绍
강동 수군|江東水軍|Jiangdong Navy|江东水军||周泰2体・凌統・黄蓋・魯粛を同時に所持|Hold 2 Zhou Tai, Ling Tong, Huang Gai, Lu Su|同时持有周泰2个·凌统·黄盖·鲁肃
위의 기둥|魏の柱|Pillars of Wei|魏之栋梁||于禁・楽進・張郃・夏侯淵・夏侯惇を同時に所持|Hold Yu Jin, Yue Jin, Zhang He, Xiahou Yuan, Xiahou Dun|同时持有于禁·乐进·张郃·夏侯渊·夏侯惇
[협동] 황건 토벌대|［協力］黄巾討伐隊|[Co-op] Yellow Turban Hunters|［合作］黄巾讨伐队||10ラウンドに全員が異なる★2で出陣|At R10, everyone deploys a different ★2|第10回合全员以不同的2星出战
[협동] 군웅 할거|［協力］群雄割拠|[Co-op] Rival Warlords|［合作］群雄割据||25ラウンドに全員が異なる★3で出陣|At R25, everyone deploys a different ★3|第25回合全员以不同的3星出战
[협동] 낙양 진격|［協力］洛陽進撃|[Co-op] March on Luoyang|［合作］进击洛阳||40ラウンドに全員が異なる★4で出陣|At R40, everyone deploys a different ★4|第40回合全员以不同的4星出战
[협동] 관도 대전|［協力］官渡の大戦|[Co-op] Battle of Guandu|［合作］官渡大战||55ラウンドに全員が異なる★5で出陣|At R55, everyone deploys a different ★5|第55回合全员以不同的5星出战
[협동] 반동탁 연합|［協力］反董卓連合|[Co-op] Coalition Against Dong Zhuo|［合作］反董卓联盟||虎牢関に公孫瓚・袁紹・夏侯惇・黄蓋を半数以上（最低2人）出陣|At Hulao, half the party (min 2) deploys Gongsun Zan, Yuan Shao, Xiahou Dun or Huang Gai|虎牢关时半数以上（至少2人）出战公孙瓒·袁绍·夏侯惇·黄盖
[협동] 손유 동맹|［協力］孫劉同盟|[Co-op] Sun-Liu Alliance|［合作］孙刘联盟||赤壁に黄蓋・魯粛・周泰・魏延を半数以上（最低2人）出陣|At Red Cliffs, half the party (min 2) deploys Huang Gai, Lu Su, Zhou Tai or Wei Yan|赤壁时半数以上（至少2人）出战黄盖·鲁肃·周泰·魏延
`;
  const CONS = `
1~5성 유닛 1기를 다음 등급의 랜덤 유닛으로 바꿉니다.|★1〜5のユニット1体を次の等級のランダムなユニットに変えます。|Turns one ★1–5 unit into a random unit of the next tier.|将1个1~5星单位变为下一等级的随机单位。
2~7성 유닛 1기를 같은 등급의 다른 세력 유닛으로 바꿉니다.|★2〜★7のユニット1体を同じ等級の別勢力ユニットに変えます。|Turns one ★2–★7 unit into a unit of another faction at the same tier.|将1个2~7星单位变为同等级的其他阵营单位。
7성 이상 장수 1기를 같은 등급의 다른 장수로 바꿉니다(세력 무관, 랜덤).|★7以上の武将1体を同じ等級の別の武将に変えます（勢力問わず、ランダム）。|Turns one ★7+ general into a different general of the same tier (any faction, random).|将1名7星以上武将随机变为同等级的其他武将（不限阵营）。
`;
  const rows = (s) => s.trim().split('\n').map((l) => l.split('|'));
  const map = (s) => { const m = {}; rows(s).forEach(([ko, ja, en, zh]) => (m[ko] = { ja, en, zh })); return m; };
  const pairs = (s) => { const m = {}; s.trim().split('\n').forEach((l) => { const parts = l.split('||').map((x) => x.split('|')); const ko = parts[0][0]; m[ko] = parts.map((p, i) => (i === 0 ? { ja: p[1], en: p[2], zh: p[3] } : { ja: p[0], en: p[1], zh: p[2] })); }); return m; };

  // ---- 설명 틀: 패시브 종류별 ----
  const pc = (v) => Math.round(v * 100) + '%';
  const facN = { ja: { wei: '魏', shu: '蜀', wu: '呉', etc: 'その他', all: '全' }, en: { wei: 'Wei', shu: 'Shu', wu: 'Wu', etc: 'Others', all: 'all' }, zh: { wei: '魏', shu: '蜀', wu: '吴', etc: '其他', all: '全体' } };
  const PD = {
    ja: {
      slow: (p) => `攻撃した敵の移動速度${pc(p.pct)}低下`, bossPct: (p) => `ボス・中ボスへのダメージ${pc(p.pct)}増加`, crit: (p) => `${pc(p.ch)}の確率で${p.mult}倍ダメージ`, everyN: (p) => `${p.n}回目の攻撃ごとに${p.mult}倍ダメージ`,
      cdr: (p) => `スキル再使用${pc(p.pct)}短縮`, chain: (p) => `スキル使用時、他のスキル再使用${p.n}秒短縮`, pierce: (p) => `敵の防御力${pc(p.pct)}無視`, skillPct: (p) => `スキルダメージ${pc(p.pct)}増加`, aoe: (p) => `円形スキルの範囲${pc(p.pct)}拡大`,
      haste: (p) => `ボス戦の攻撃速度${pc(p.pct)}上昇`, aura: (p) => `周囲の${p.fac ? facN.ja[p.fac] + 'の' : '味方'}ユニット攻撃力${pc(p.pct)}上昇`, partyAtk: (p) => `ボス戦で味方全体（他の司令官含む）の攻撃力${pc(p.pct)}上昇`,
      lifesteal: (p) => `ボスを攻撃するたび体力${(p.pct * 100).toFixed(1)}%回復`, expose: (p) => `通常攻撃を受けたボスの被ダメージ${p.dur}秒間${pc(p.pct)}増加`, breaker: (p) => `ブレイクゲージへのダメージ${pc(1 + p.pct)}`,
      burn: (p) => `攻撃力${pc(p.pct)}の継続ダメージ${p.dur}秒`, hpPct: (p) => `ボス戦の体力${pc(p.pct)}増加`, lastStand: () => 'ボス戦ごとに一度、致死ダメージを体力1で耐える', guard: (p) => `ボス戦の被ダメージ${pc(p.pct)}軽減`,
      splash: (p) => `周囲の敵に${pc(p.pct)}の範囲ダメージ`, lowGuard: (p) => `体力30%以下で被ダメージをさらに${pc(p.pct)}軽減`, execute: (p) => `ボスの体力30%以下で与ダメージ${pc(p.pct)}増加`, multi: (p) => `敵${p.n}体を追加で攻撃`,
      regen: (p) => `ボス戦で味方全体の体力を毎秒${(p.pct * 100).toFixed(1)}%回復`, globalAtk: (p) => `${p.fac === 'all' ? '味方全体' : facN.ja[p.fac] + 'の全ユニット'}の攻撃力${pc(p.pct)}上昇`, stun: (p) => `${pc(p.ch)}の確率で気絶`,
      auraGuard: (p) => `出陣した味方全体（他の司令官含む）の被ダメージ${pc(p.pct)}軽減`, partyCdr: (p) => `ボス戦で味方全体のスキル再使用${pc(p.pct)}短縮`, taunt: () => 'ボスがこの武将を優先して狙う', bossWeak: (p) => `出陣中、ボスの攻撃力${pc(p.pct)}低下`,
      healLow: (p) => `3秒ごとに体力50%以下の味方（他の司令官含む）の体力${pc(p.pct)}回復`, healBuff: (p) => `全軍治療の時、味方全体の攻撃力3秒間${pc(p.pct)}上昇`,
      roundGold: (p) => `ラウンド終了時に金貨+${p.n}`, interest: (p) => `ラウンド終了時に所持金貨の${pc(p.pct)}の利息（最大${p.max}）`, midGold: (p) => `中ボス討伐ごとに金貨+${p.n}`, bossGold: (p) => `ボス討伐の金貨${pc(p.pct)}増加`, discount: (p) => `強化費用${pc(p.pct)}割引`,
      roundT1: (p) => `ラウンド報酬の★1 +${p.n}体`, combineT1: () => '合成するたびにランダム★1を1体（選択券は除く）', midReward: (p) => `中ボス討伐の報酬${p.n}倍`, tierHaste: (p) => `★${p.tier}以上の攻撃速度${pc(p.pct)}上昇`, sageCdr: (p) => `ボス戦の出陣武将のスキル再使用${pc(p.pct)}短縮`,
      staggerEase: (p) => `ブレイク・反撃に必要なダメージ${pc(p.pct)}減少`, activeHeal: (p) => `ボス戦ごとに${p.uses}回、Fで自分の出陣武将の体力${pc(p.pct)}回復`, upMax: (p) => `全強化の最大段階+${p.n}`, fieldSlow: (p) => `全敵の移動速度${pc(p.pct)}低下`,
    },
    en: {
      slow: (p) => `Hit enemies slowed by ${pc(p.pct)}`, bossPct: (p) => `+${pc(p.pct)} damage to bosses and mid-bosses`, crit: (p) => `${pc(p.ch)} chance to deal ×${p.mult} damage`, everyN: (p) => `Every ${p.n}th attack deals ×${p.mult} damage`,
      cdr: (p) => `Skill cooldown -${pc(p.pct)}`, chain: (p) => `Using a skill cuts other skills' cooldown by ${p.n}s`, pierce: (p) => `Ignores ${pc(p.pct)} of enemy defense`, skillPct: (p) => `Skill damage +${pc(p.pct)}`, aoe: (p) => `Circle skill area +${pc(p.pct)}`,
      haste: (p) => `Boss fight attack speed +${pc(p.pct)}`, aura: (p) => `Nearby ${p.fac ? facN.en[p.fac] + ' ' : 'allied '}units ATK +${pc(p.pct)}`, partyAtk: (p) => `Boss fights: whole party (incl. other commanders) ATK +${pc(p.pct)}`,
      lifesteal: (p) => `Heals ${(p.pct * 100).toFixed(1)}% HP per hit on the boss`, expose: (p) => `Bosses hit by attacks take +${pc(p.pct)} damage for ${p.dur}s`, breaker: (p) => `Deals ${pc(1 + p.pct)} to the break gauge`,
      burn: (p) => `Burns for ${pc(p.pct)} ATK over ${p.dur}s`, hpPct: (p) => `Boss fight HP +${pc(p.pct)}`, lastStand: () => 'Once per boss fight, survives a lethal hit with 1 HP', guard: (p) => `Boss fight damage taken -${pc(p.pct)}`,
      splash: (p) => `${pc(p.pct)} splash damage to nearby enemies`, lowGuard: (p) => `Below 30% HP, damage taken -${pc(p.pct)} more`, execute: (p) => `+${pc(p.pct)} damage when the boss is below 30% HP`, multi: (p) => `Hits ${p.n} extra enemies`,
      regen: (p) => `Boss fights: heals the party ${(p.pct * 100).toFixed(1)}% HP per second`, globalAtk: (p) => `${p.fac === 'all' ? 'All allies' : 'All ' + facN.en[p.fac] + ' units'} ATK +${pc(p.pct)}`, stun: (p) => `${pc(p.ch)} chance to stun`,
      auraGuard: (p) => `Deployed party (incl. other commanders) damage taken -${pc(p.pct)}`, partyCdr: (p) => `Boss fights: party skill cooldown -${pc(p.pct)}`, taunt: () => 'Bosses target this general first', bossWeak: (p) => `While deployed, boss ATK -${pc(p.pct)}`,
      healLow: (p) => `Every 3s heals allies below 50% HP (incl. other commanders) by ${pc(p.pct)}`, healBuff: (p) => `Heal All also gives the party +${pc(p.pct)} ATK for 3s`,
      roundGold: (p) => `+${p.n} gold at round end`, interest: (p) => `${pc(p.pct)} interest on your gold each round (max ${p.max})`, midGold: (p) => `+${p.n} gold per mid-boss`, bossGold: (p) => `Boss gold +${pc(p.pct)}`, discount: (p) => `Upgrades cost -${pc(p.pct)}`,
      roundT1: (p) => `+${p.n} ★1 unit per round`, combineT1: () => 'Each combine gives a random ★1 (not tickets)', midReward: (p) => `Mid-boss rewards ×${p.n}`, tierHaste: (p) => `★${p.tier}+ units attack ${pc(p.pct)} faster`, sageCdr: (p) => `Champions' skill cooldown -${pc(p.pct)} in boss fights`,
      staggerEase: (p) => `Break and counter need ${pc(p.pct)} less damage`, activeHeal: (p) => `${p.uses}× per boss fight, press F to heal your champions ${pc(p.pct)}`, upMax: (p) => `All upgrade caps +${p.n}`, fieldSlow: (p) => `All enemies slowed by ${pc(p.pct)}`,
    },
    zh: {
      slow: (p) => `被攻击的敌人移速降低${pc(p.pct)}`, bossPct: (p) => `对首领·中首领伤害+${pc(p.pct)}`, crit: (p) => `${pc(p.ch)}几率造成${p.mult}倍伤害`, everyN: (p) => `每第${p.n}次攻击造成${p.mult}倍伤害`,
      cdr: (p) => `技能冷却-${pc(p.pct)}`, chain: (p) => `使用技能时其他技能冷却缩短${p.n}秒`, pierce: (p) => `无视敌人${pc(p.pct)}防御`, skillPct: (p) => `技能伤害+${pc(p.pct)}`, aoe: (p) => `圆形技能范围+${pc(p.pct)}`,
      haste: (p) => `首领战攻速+${pc(p.pct)}`, aura: (p) => `周围${p.fac ? facN.zh[p.fac] : '友方'}单位攻击+${pc(p.pct)}`, partyAtk: (p) => `首领战全队（含其他指挥官）攻击+${pc(p.pct)}`,
      lifesteal: (p) => `每次攻击首领回复${(p.pct * 100).toFixed(1)}%生命`, expose: (p) => `被普攻命中的首领${p.dur}秒内受伤+${pc(p.pct)}`, breaker: (p) => `对破防槽造成${pc(1 + p.pct)}伤害`,
      burn: (p) => `${p.dur}秒内造成攻击${pc(p.pct)}的持续伤害`, hpPct: (p) => `首领战生命+${pc(p.pct)}`, lastStand: () => '每场首领战一次，以1点生命挺过致命伤', guard: (p) => `首领战受伤-${pc(p.pct)}`,
      splash: (p) => `对周围敌人造成${pc(p.pct)}范围伤害`, lowGuard: (p) => `生命低于30%时受伤再-${pc(p.pct)}`, execute: (p) => `首领生命低于30%时伤害+${pc(p.pct)}`, multi: (p) => `额外攻击${p.n}个敌人`,
      regen: (p) => `首领战全队每秒回复${(p.pct * 100).toFixed(1)}%生命`, globalAtk: (p) => `${p.fac === 'all' ? '全体友方' : facN.zh[p.fac] + '全体单位'}攻击+${pc(p.pct)}`, stun: (p) => `${pc(p.ch)}几率眩晕`,
      auraGuard: (p) => `出战全队（含其他指挥官）受伤-${pc(p.pct)}`, partyCdr: (p) => `首领战全队技能冷却-${pc(p.pct)}`, taunt: () => '首领优先攻击此武将', bossWeak: (p) => `出战时首领攻击-${pc(p.pct)}`,
      healLow: (p) => `每3秒为生命低于50%的友方（含其他指挥官）回复${pc(p.pct)}`, healBuff: (p) => `全军治疗时全队3秒攻击+${pc(p.pct)}`,
      roundGold: (p) => `回合结束时金币+${p.n}`, interest: (p) => `回合结束时获得持有金币${pc(p.pct)}的利息（最多${p.max}）`, midGold: (p) => `每讨伐中首领金币+${p.n}`, bossGold: (p) => `首领金币+${pc(p.pct)}`, discount: (p) => `强化费用-${pc(p.pct)}`,
      roundT1: (p) => `每回合奖励1星+${p.n}个`, combineT1: () => '每次合成获得随机1星1个（选择券除外）', midReward: (p) => `中首领奖励×${p.n}`, tierHaste: (p) => `${p.tier}星以上攻速+${pc(p.pct)}`, sageCdr: (p) => `首领战出战武将技能冷却-${pc(p.pct)}`,
      staggerEase: (p) => `破防·反击所需伤害-${pc(p.pct)}`, activeHeal: (p) => `每场首领战${p.uses}次，按F为己方出战武将回复${pc(p.pct)}生命`, upMax: (p) => `全部强化上限+${p.n}`, fieldSlow: (p) => `全体敌人移速-${pc(p.pct)}`,
    },
  };
  // ---- 스킬 설명 틀 ----
  const SK = {
    ja: { line: (s) => `直線${s.len}の範囲、攻撃力${s.mult}倍`, cone: (s) => `扇形${s.r}の範囲、攻撃力${s.mult}倍`, circle: (s) => `指定地点の半径${s.r}、攻撃力${s.mult}倍${s.stun ? `、気絶${s.stun}秒` : ''}`, buff: (s) => `${s.dur}秒間 攻撃力+${pc(s.atk)}`, shield: (s) => `${s.dur}秒間 無敵`, heal: (s) => `味方全体（他の司令官含む）の体力${pc(s.pct)}回復${s.hot ? `、${s.hotDur}秒間 毎秒${pc(s.hot)}` : ''}`, rally: (s) => `${s.dur}秒間 味方全体の攻撃力+${pc(s.atk)}`, taunt: (s) => `${s.dur}秒間 ボスを引きつけ被ダメージ軽減`, weaken: (s) => `${s.dur}秒間 ボスの被ダメージ+${pc(s.amp)}`, cover: (s) => `ボスを引きつけ、${s.dur}秒間 味方全体の被ダメージ-${pc(s.v)}`, pshield: (s) => `${s.dur}秒間 味方全体の飛び道具を防ぐ`, hasteAll: (s) => `${s.dur}秒間 味方全体の攻撃速度+${pc(s.v)}`, roar: (s) => `${s.dur}秒間 ボスの攻撃力-${pc(s.v)}`, delay: (s) => `ボスの次の技を${s.v}秒遅らせる`, reflect: (s) => `${s.dur}秒間 ボスを引きつけ、被弾ごとに攻撃力${s.mult}倍で反撃`, charm: (s) => `ボスを${s.dur}秒間 魅了して止め、被ダメージ+${pc(s.amp)}（ブレイク詠唱は止められない）` },
    en: { line: (s) => `Line ${s.len}, ×${s.mult} ATK`, cone: (s) => `Cone ${s.r}, ×${s.mult} ATK`, circle: (s) => `Radius ${s.r} at target, ×${s.mult} ATK${s.stun ? `, stun ${s.stun}s` : ''}`, buff: (s) => `ATK +${pc(s.atk)} for ${s.dur}s`, shield: (s) => `Invincible for ${s.dur}s`, heal: (s) => `Heals the whole party (incl. other commanders) ${pc(s.pct)}${s.hot ? `, then ${pc(s.hot)}/s for ${s.hotDur}s` : ''}`, rally: (s) => `Party ATK +${pc(s.atk)} for ${s.dur}s`, taunt: (s) => `Draws the boss and reduces damage taken for ${s.dur}s`, weaken: (s) => `Boss takes +${pc(s.amp)} damage for ${s.dur}s`, cover: (s) => `Draws the boss; party damage taken -${pc(s.v)} for ${s.dur}s`, pshield: (s) => `Blocks projectiles for the party for ${s.dur}s`, hasteAll: (s) => `Party attack speed +${pc(s.v)} for ${s.dur}s`, roar: (s) => `Boss ATK -${pc(s.v)} for ${s.dur}s`, delay: (s) => `Delays the boss's next attack by ${s.v}s`, reflect: (s) => `Draws the boss for ${s.dur}s; counters each hit at ×${s.mult} ATK`, charm: (s) => `Charms the boss for ${s.dur}s; it takes +${pc(s.amp)} damage (cannot interrupt break casts)` },
    zh: { line: (s) => `直线${s.len}范围，攻击${s.mult}倍`, cone: (s) => `扇形${s.r}范围，攻击${s.mult}倍`, circle: (s) => `指定位置半径${s.r}，攻击${s.mult}倍${s.stun ? `，眩晕${s.stun}秒` : ''}`, buff: (s) => `${s.dur}秒内攻击+${pc(s.atk)}`, shield: (s) => `${s.dur}秒无敌`, heal: (s) => `全队（含其他指挥官）回复${pc(s.pct)}生命${s.hot ? `，之后${s.hotDur}秒每秒${pc(s.hot)}` : ''}`, rally: (s) => `${s.dur}秒内全队攻击+${pc(s.atk)}`, taunt: (s) => `${s.dur}秒内吸引首领并减伤`, weaken: (s) => `${s.dur}秒内首领受伤+${pc(s.amp)}`, cover: (s) => `吸引首领，${s.dur}秒内全队受伤-${pc(s.v)}`, pshield: (s) => `${s.dur}秒内为全队挡下飞行物`, hasteAll: (s) => `${s.dur}秒内全队攻速+${pc(s.v)}`, roar: (s) => `${s.dur}秒内首领攻击-${pc(s.v)}`, delay: (s) => `将首领下一招推迟${s.v}秒`, reflect: (s) => `${s.dur}秒内吸引首领，每次受击以攻击${s.mult}倍反击`, charm: (s) => `魅惑首领${s.dur}秒使其停止，受伤+${pc(s.amp)}（无法打断破防咏唱）` },
  };
  root.RTD_I18N_DATA = { names: map(NAMES), lines: map(LINES), syn: pairs(SYN), mut: pairs(MUT), ach: pairs(ACH), cons: map(CONS), PD, SK };
})(typeof window !== 'undefined' ? window : globalThis);
