// 테마 데이터. 엔진은 이 객체의 id와 구조만 참조하므로, 같은 구조의 파일로 교체하면 세계관 전체가 바뀐다.
(function (root) {
  const pct = (name, k, extra) => Object.assign({ name, k }, extra);
  const u = (id, name, mark, fac, tier, extra) => Object.assign({ id, name, mark, fac, tier }, extra || {});

  const factions = {
    wei: { name: '위', color: '#4d7fc9', dark: '#1d3560' },
    shu: { name: '촉', color: '#46a868', dark: '#1b4a30' },
    wu: { name: '오', color: '#d0563f', dark: '#62201a' },
    etc: { name: '그 외', color: '#a58fc4', dark: '#3f3358' },
    none: { name: '일반병', color: '#b7a988', dark: '#46402f' },
    free: { name: '무소속', color: '#d9c27c', dark: '#544720' },
  };

  // tier: 1~7, 8 전설, 9 신화, 10 불멸, 0 특수
  const ranks = [
    { t: 1, name: '1성', atk: 10, hp: 100, value: 1 },
    { t: 2, name: '2성', atk: 34, hp: 150, value: 4 },
    { t: 3, name: '3성', atk: 115, hp: 225, value: 16 },
    { t: 4, name: '4성', atk: 390, hp: 340, value: 48 },
    { t: 5, name: '5성', atk: 1300, hp: 510, value: 144 },
    { t: 6, name: '6성', atk: 4400, hp: 765, value: 288 },
    { t: 7, name: '7성', atk: 7500, hp: 1150, value: 420 },
    { t: 8, name: '전설', atk: 7700, hp: 1200, value: 480 },
    { t: 9, name: '신화', atk: 16000, hp: 2500, value: 900 },
    { t: 10, name: '불멸', atk: 23000, hp: 3400, value: 1500 },
  ];
  // 다음 등급으로 동일 유닛을 합칠 때 필요한 수
  const combineNeed = { 1: 4, 2: 4, 3: 3, 4: 3, 5: 2 };

  const units = [
    // 1성: 능력치 완전 동일
    u('cav', '기병', '騎', 'none', 1), u('shd', '방패병', '盾', 'none', 1), u('arc', '궁병', '弓', 'none', 1),
    u('swd', '검병', '劍', 'none', 1), u('spr', '창병', '槍', 'none', 1),
    // 2성
    u('yujin', '우금', '禁', 'wei', 2), u('akjin', '악진', '進', 'wei', 2), u('juchang', '주창', '倉', 'shu', 2),
    u('jutae', '주태', '泰', 'wu', 2), u('neungtong', '능통', '統', 'wu', 2), u('hwawoong', '화웅', '雄', 'etc', 2),
    // 3성
    u('hayeon', '하후연', '淵', 'wei', 3), u('janghap', '장합', '郃', 'wei', 3), u('wiyeon', '위연', '延', 'shu', 3),
    u('hwanggae', '황개', '蓋', 'wu', 3), u('munchu', '문추', '醜', 'etc', 3), u('anryang', '안량', '良', 'etc', 3),
    // 4성
    u('seohwang', '서황', '晃', 'wei', 4), u('heojeo', '허저', '褚', 'wei', 4), u('hwangchung', '황충', '忠', 'shu', 4),
    u('gamnyeong', '감녕', '寧', 'wu', 4), u('gongson', '공손찬', '瓚', 'etc', 4),
    // 5성
    u('hadon', '하후돈', '惇', 'wei', 5), u('madae', '마대', '岱', 'shu', 5), u('nosuk', '노숙', '肅', 'wu', 5), u('wonso', '원소', '紹', 'etc', 5),
    // 6성: 패시브 1개, 보스전 이동기 사용 가능
    u('jangryo', '장료', '遼', 'wei', 6, { rng: 170, as: 0.85, title: '합비의 맹장', p: [pct('요래 공포', 'slow', { pct: 0.25, dur: 1.5, desc: '공격한 적의 이동속도 25% 감소' })] }),
    u('ganguy', '강유', '維', 'shu', 6, { rng: 230, as: 1.0, title: '천수의 기린아', p: [pct('구벌 정신', 'bossPct', { pct: 0.2, desc: '보스·중간보스 피해 20% 증가' })] }),
    u('yeomong', '여몽', '蒙', 'wu', 6, { rng: 200, as: 0.95, title: '오하아몽', p: [pct('백의도강', 'crit', { ch: 0.2, mult: 2, desc: '20% 확률로 2배 피해' })] }),
    // 7성: 고유 패시브
    u('sunyu', '순유', '攸', 'wei', 7, { rng: 260, as: 1.1, title: '조조의 모주', p: [pct('기책 십이', 'everyN', { n: 4, mult: 3, desc: '4번째 공격마다 3배 피해' })],
      sk: [{ n: '성동격서', k: 'circle', r: 120, range: 440, mult: 4, delay: 0.5, cd: 16, fx: '#8db8ec' }] }),
    u('deungae', '등애', '艾', 'wei', 7, { rng: 240, as: 1.05, title: '음평의 기습가', p: [pct('음평 기습', 'pierce', { pct: 0.5, desc: '적 방어력 50% 무시' })],
      sk: [{ n: '음평 강행', k: 'line', len: 420, w: 80, mult: 4, cd: 16, fx: '#7fb1e8' }] }),
    u('seoseo', '서서', '庶', 'shu', 7, { rng: 250, as: 1.1, title: '단복', p: [pct('격검의 기예', 'everyN', { n: 5, mult: 3, desc: '5번째 공격마다 3배 피해' })],
      sk: [{ n: '팔문금쇄 파쇄', k: 'circle', r: 110, range: 420, mult: 4, delay: 0.5, cd: 16, fx: '#7fe0a0' }] }),
    u('gwanpyeong', '관평', '平', 'shu', 7, { rng: 130, as: 0.9, title: '관우의 양자', p: [pct('부자의 의', 'aura', { pct: 0.1, r: 170, fac: 'shu', desc: '주변 촉 유닛 공격력 10% 증가' })] }),
    u('jeongbo', '정보', '普', 'wu', 7, { rng: 200, as: 1.0, title: '강동의 숙장', p: [pct('노장의 지휘', 'aura', { pct: 0.1, r: 170, fac: 'wu', desc: '주변 오 유닛 공격력 10% 증가' })] }),
    u('jegalgeun', '제갈근', '瑾', 'wu', 7, { rng: 260, as: 1.15, title: '오의 외교가', p: [pct('중재의 언변', 'slow', { pct: 0.3, dur: 2, desc: '공격한 적의 이동속도 30% 감소' })] }),
    u('gahu', '가후', '詡', 'etc', 7, { rng: 260, as: 1.1, title: '난세의 독사', p: [pct('완성의 독계', 'burn', { pct: 0.3, dur: 3, desc: '공격력 30%의 독 피해 3초' })],
      sk: [{ n: '이간계', k: 'circle', r: 130, range: 460, mult: 4, delay: 0.6, cd: 15, fx: '#9ad070' }] }),
    u('maenghoek', '맹획', '獲', 'etc', 7, { rng: 140, as: 0.85, title: '남만왕', p: [pct('칠종칠금', 'hpPct', { pct: 0.5, desc: '보스전 체력 50% 증가' })],
      sk: [{ n: '맹수 돌격', k: 'cone', r: 240, arc: 1.2, mult: 3.5, cd: 14, fx: '#e09a4d' }] }),
    // 전설: 7성과 같은 능력치 + 고유 패시브 1개 추가
    u('jeonwi', '전위', '韋', 'wei', 8, { rng: 140, as: 0.8, title: '고대의 악래', p: [pct('쌍철극', 'splash', { r: 100, pct: 0.6, desc: '주변 적에게 60% 범위 피해' }), pct('완성의 사수', 'hpPct', { pct: 0.6, desc: '보스전 체력 60% 증가' })],
      sk: [{ n: '단극 투척', k: 'line', len: 400, w: 100, mult: 4.5, cd: 14, fx: '#9ec0f0' }] }),
    u('munang', '문앙', '鴦', 'wei', 8, { rng: 170, as: 0.75, title: '단기 칠진', p: [pct('단기 돌파', 'everyN', { n: 5, mult: 4, desc: '5번째 공격마다 4배 피해' }), pct('맹장의 피', 'crit', { ch: 0.2, mult: 2, desc: '20% 확률로 2배 피해' })],
      sk: [{ n: '낙가 돌격', k: 'line', len: 460, w: 100, mult: 4.5, cd: 13, dashThrough: true, fx: '#a8c8ff' }] }),
    u('hwangwol', '황월영', '英', 'shu', 8, { rng: 240, as: 0.9, title: '목우유마의 장인', p: [pct('목우유마', 'aura', { pct: 0.1, r: 170, fac: 'shu', desc: '주변 촉 유닛 공격력 10% 증가' }), pct('연노 개량', 'multi', { n: 1, desc: '적 1기를 추가 타격' })],
      sk: [{ n: '연노 일제사', k: 'cone', r: 340, arc: 0.7, mult: 4, cd: 14, fx: '#8ae8a8' }] }),
    u('bangtong', '방통', '統', 'shu', 8, { rng: 270, as: 1.15, title: '봉추', p: [pct('연환계', 'splash', { r: 110, pct: 0.4, desc: '주변 적에게 40% 범위 피해' }), pct('봉추의 불길', 'burn', { pct: 0.3, dur: 3, desc: '공격력 30%의 화상 3초' })],
      sk: [{ n: '연환 화염', k: 'circle', r: 150, range: 460, mult: 4.5, delay: 0.7, cd: 16, fx: '#f09a4a' }] }),
    u('songyeon', '손견', '堅', 'wu', 8, { rng: 170, as: 0.9, title: '강동의 호랑이', p: [pct('고정도', 'crit', { ch: 0.25, mult: 2.2, desc: '25% 확률로 2.2배 피해' }), pct('호랑이의 기세', 'globalAtk', { pct: 0.08, fac: 'wu', desc: '모든 오 유닛 공격력 8% 증가' })],
      sk: [{ n: '강동 호령', k: 'buff', atk: 0.6, dur: 5, cd: 20, fx: '#f09070' }] }),
    u('sonhyang', '손상향', '香', 'wu', 8, { rng: 250, as: 0.7, title: '궁요희', p: [pct('궁요희의 속사', 'everyN', { n: 4, mult: 2.5, desc: '4번째 공격마다 2.5배 피해' }), pct('호걸의 혈통', 'bossPct', { pct: 0.15, desc: '보스·중간보스 피해 15% 증가' })],
      sk: [{ n: '연환궁', k: 'cone', r: 320, arc: 0.9, mult: 3.5, cd: 12, fx: '#f4a7a0' }, { n: '비연보', k: 'buff', atk: 0.3, dur: 4, cd: 18, fx: '#f4c7a0' }] }),
    u('yeoryeong', '여령기', '綺', 'etc', 8, { rng: 180, as: 0.75, title: '여포의 딸', p: [pct('비장의 혈통', 'crit', { ch: 0.3, mult: 2, desc: '30% 확률로 2배 피해' }), pct('소화극술', 'multi', { n: 1, desc: '적 1기를 추가 타격' })],
      sk: [{ n: '소화극 난무', k: 'cone', r: 220, arc: 1.6, mult: 4, cd: 12, fx: '#e47cae' }] }),
    u('chugyung', '축융부인', '融', 'etc', 8, { rng: 230, as: 0.9, title: '불의 신의 후예', p: [pct('비도 투척', 'burn', { pct: 0.35, dur: 3, desc: '공격력 35%의 화상 3초' }), pct('남만의 여걸', 'stun', { ch: 0.08, dur: 0.6, desc: '8% 확률로 기절' })],
      sk: [{ n: '비도 연속 투척', k: 'line', len: 460, w: 70, mult: 4.5, cd: 13, fx: '#f07a3e' }] }),
    // 신화: 등장 컷씬, 아이템 조합
    u('gwakga', '곽가', '嘉', 'wei', 9, { rng: 280, as: 1.15, title: '귀재', hz: '郭嘉', qc: '兵貴神速', quote: '군사는 신속함이 생명입니다.', p: [pct('십승십패론', 'globalAtk', { pct: 0.15, fac: 'wei', desc: '모든 위 유닛 공격력 15% 증가' }), pct('간파', 'crit', { ch: 0.3, mult: 2.5, desc: '30% 확률로 2.5배 피해' })],
      sk: [{ n: '유계', k: 'circle', r: 170, range: 520, mult: 6, delay: 0.8, cd: 16, fx: '#a8c8ff' }, { n: '요절의 예지', k: 'shield', dur: 1.6, cd: 24, fx: '#d4e4ff' }] }),
    u('join', '조인', '仁', 'wei', 9, { rng: 150, as: 0.95, title: '위의 방패', hz: '曹仁', qc: '吾當死守此城', quote: '이 성은 내가 죽어서라도 지킨다.', p: [pct('철옹성', 'hpPct', { pct: 0.8, desc: '보스전 체력 80% 증가' }), pct('사수의 의지', 'aura', { pct: 0.18, r: 200, fac: 'wei', desc: '주변 위 유닛 공격력 18% 증가' })],
      sk: [{ n: '팔문금쇄진', k: 'shield', dur: 2.2, cd: 20, fx: '#7da7e8' }, { n: '철기 반격', k: 'cone', r: 240, arc: 1.5, mult: 5, cd: 12, fx: '#9ec0f0' }] }),
    u('sunuk', '순욱', '彧', 'wei', 9, { rng: 260, as: 1.1, title: '왕좌지재', hz: '荀彧', qc: '奉主上以從民望', quote: '천자를 받들어 백성의 바람을 따르는 것, 그것이 대의입니다.', p: [pct('왕좌의 계책', 'globalAtk', { pct: 0.12, fac: 'wei', desc: '모든 위 유닛 공격력 12% 증가' }), pct('왕좌의 안목', 'crit', { ch: 0.3, mult: 2.3, desc: '30% 확률로 2.3배 피해' })],
      sk: [{ n: '구호탄랑', k: 'buff', atk: 0.5, dur: 6, cd: 22, fx: '#8db8ec' }, { n: '이호경식', k: 'circle', r: 170, range: 500, mult: 5.5, delay: 0.6, cd: 15, fx: '#a8c8ff' }] }),
    u('jangbi', '장비', '飛', 'shu', 9, { rng: 170, as: 0.95, title: '만인지적', hz: '張飛', qc: '燕人張翼德在此', quote: '연인 장익덕이 여기 있다!', p: [pct('장판교의 일갈', 'stun', { ch: 0.15, dur: 0.8, desc: '15% 확률로 기절' }), pct('장팔사모', 'splash', { r: 120, pct: 0.7, desc: '주변 적에게 70% 범위 피해' })],
      sk: [{ n: '장판교 대갈', k: 'circle', r: 220, range: 0, mult: 4, delay: 0.2, stun: 1.2, cd: 18, fx: '#f0d060' }, { n: '사모 돌격', k: 'line', len: 420, w: 100, mult: 6, cd: 13, fx: '#88d8a8' }] }),
    u('joun', '조운', '雲', 'shu', 9, { rng: 170, as: 0.7, title: '상산의 일신시담', hz: '趙雲', qc: '吾乃常山趙子龍也', quote: '나는 상산의 조자룡이다!', p: [pct('칠진칠출', 'everyN', { n: 7, mult: 7, desc: '7번째 공격마다 7배 피해' }), pct('장판파의 기적', 'bossPct', { pct: 0.2, desc: '보스·중간보스 피해 20% 증가' })],
      sk: [{ n: '단기 돌파', k: 'line', len: 520, w: 90, mult: 5.5, cd: 11, dashThrough: true, fx: '#d4f4e0' }, { n: '용담', k: 'shield', dur: 1.4, cd: 22, fx: '#e8fff0' }] }),
    // 마초: 2026-11-17 사용자 결정으로 5성에서 신화로 승격(신화 10명). 5성 촉 자리는 마대.
    u('macho', '마초', '超', 'shu', 9, { rng: 170, as: 0.75, title: '금마초', hz: '馬超', qc: '誓殺曹賊 以報父仇', quote: '아버지의 원수, 조조를 반드시 베리라!', p: [pct('서량 돌격', 'everyN', { n: 6, mult: 5, desc: '6번째 공격마다 5배 피해' }), pct('신위천장군', 'crit', { ch: 0.25, mult: 2.4, desc: '25% 확률로 2.4배 피해' })],
      sk: [{ n: '서량 철기 돌격', k: 'line', len: 500, w: 110, mult: 5.5, cd: 12, dashThrough: true, fx: '#e8d27a' }, { n: '금마초의 위용', k: 'buff', atk: 0.5, dur: 5, cd: 22, fx: '#ffe8a0' }] }),
    u('sonchaek', '손책', '策', 'wu', 9, { rng: 170, as: 0.75, title: '소패왕', hz: '孫策', qc: '決機於兩陣之間 與天下爭衡', quote: '두 진 사이에서 승부를 내고, 천하와 겨루는 일은 내가 한다.', p: [pct('소패왕의 기세', 'crit', { ch: 0.35, mult: 2.3, desc: '35% 확률로 2.3배 피해' }), pct('강동 평정', 'globalAtk', { pct: 0.12, fac: 'wu', desc: '모든 오 유닛 공격력 12% 증가' })],
      sk: [{ n: '패왕 돌격', k: 'line', len: 460, w: 110, mult: 6, cd: 12, dashThrough: true, fx: '#f09070' }] }),
    u('yukson', '육손', '遜', 'wu', 9, { rng: 280, as: 1.1, title: '서생 대도독', hz: '陸遜', qc: '火燒連營七百里', quote: '칠백 리 영채를 불길로 태우리라.', p: [pct('화공 연영', 'burn', { pct: 0.6, dur: 4, desc: '공격력 60%의 화상 4초' }), pct('화염 번짐', 'splash', { r: 130, pct: 0.5, desc: '주변 적에게 50% 범위 피해' })],
      sk: [{ n: '칠백리 화공', k: 'line', len: 700, w: 130, mult: 6, cd: 15, fx: '#ff8a3c' }, { n: '인내의 진', k: 'buff', atk: 0.5, dur: 6, cd: 22, fx: '#ffc08a' }] }),
    u('dongtak', '동탁', '卓', 'etc', 9, { rng: 170, as: 1.05, title: '상국', hz: '董卓', qc: '天下之事 豈不在我', quote: '천하의 일이 내 손에 달려 있지 않더냐!', p: [pct('서량 철기', 'globalAtk', { pct: 0.15, fac: 'etc', desc: '모든 그 외 소속 유닛 공격력 15% 증가' }), pct('포악', 'hpPct', { pct: 0.6, desc: '보스전 체력 60% 증가' })],
      sk: [{ n: '폭정의 압살', k: 'circle', r: 200, range: 300, mult: 5.5, delay: 0.5, cd: 14, fx: '#d05050' }] }),
    u('choseon', '초선', '蟬', 'etc', 9, { rng: 230, as: 0.9, title: '폐월의 미인', hz: '貂蟬', qc: '月亦羞而避於雲後', quote: '달도 부끄러워 구름 뒤에 숨는다지요.', p: [pct('폐월', 'stun', { ch: 0.12, dur: 0.6, desc: '12% 확률로 기절' }), pct('경국의 춤', 'bossPct', { pct: 0.2, desc: '보스·중간보스 피해 20% 증가' })],
      sk: [{ n: '미인계', k: 'charm', dur: 3, amp: 0.3, cd: 30, fx: '#ff9ad0' }, { n: '연무', k: 'circle', r: 170, range: 460, mult: 5.5, delay: 0.5, cd: 14, fx: '#ffb0e0' }] }),
    // 불멸: 최중요 인물, 화려한 이펙트, 액티브 최대 3개
    u('jojo', '조조', '操', 'wei', 10, { rng: 240, as: 0.95, title: '난세의 간웅', hz: '曹操', qc: '寧我負天下人 休教天下人負我', quote: '내가 천하를 버릴지언정, 천하가 나를 버리게 두지 않겠다.', p: [pct('치세의 능신', 'globalAtk', { pct: 0.25, fac: 'wei', desc: '모든 위 유닛 공격력 25% 증가' }), pct('호표기', 'aura', { pct: 0.2, r: 240, desc: '주변 모든 아군 공격력 20% 증가' }), pct('적벽의 교훈', 'bossPct', { pct: 0.25, desc: '보스·중간보스 피해 25% 증가' })],
      sk: [{ n: '의천검', k: 'line', len: 520, w: 110, mult: 8, cd: 11, fx: '#7ab0ff' }, { n: '호표기 돌격', k: 'cone', r: 340, arc: 1.2, mult: 7, cd: 15, fx: '#a8c8ff' }, { n: '위무의 호령', k: 'buff', atk: 0.8, dur: 6, cd: 26, fx: '#d0e0ff' }] }),
    u('samaui', '사마의', '懿', 'wei', 10, { rng: 290, as: 1.2, title: '총달', hz: '司馬懿', qc: '能戰當戰 不能戰當守', quote: '싸울 수 있으면 싸우고, 싸울 수 없으면 지킨다.', p: [pct('고평릉의 인내', 'bossPct', { pct: 0.4, desc: '보스·중간보스 피해 40% 증가' }), pct('낭고의 계략', 'pierce', { pct: 0.8, desc: '적 방어력 80% 무시' }), pct('간파의 눈', 'crit', { ch: 0.3, mult: 3, desc: '30% 확률로 3배 피해' })],
      sk: [{ n: '낭고상', k: 'circle', r: 200, range: 560, mult: 8, delay: 0.7, cd: 13, fx: '#c0a0ff' }, { n: '농성 대기', k: 'shield', dur: 2, cd: 22, fx: '#e0d0ff' }, { n: '고평릉의 변', k: 'buff', atk: 1, dur: 5, cd: 30, fx: '#d0b0ff' }] }),
    u('yubi', '유비', '備', 'shu', 10, { rng: 200, as: 0.95, title: '인의의 군주', hz: '劉備', qc: '夫濟大事必以人為本', quote: '큰일을 이루려면 반드시 사람을 근본으로 삼아야 한다.', p: [pct('인덕', 'globalAtk', { pct: 0.3, fac: 'shu', desc: '모든 촉 유닛 공격력 30% 증가' }), pct('도원결의', 'aura', { pct: 0.25, r: 260, desc: '주변 모든 아군 공격력 25% 증가' })],
      sk: [{ n: '쌍고검', k: 'cone', r: 300, arc: 1.3, mult: 7.5, cd: 11, fx: '#90f0b0' }, { n: '인덕의 빛', k: 'heal', pct: 0.45, cd: 20, fx: '#c0ffd8' }, { n: '오호 소집', k: 'buff', atk: 0.8, dur: 7, cd: 28, fx: '#a8ffc8' }] }),
    u('gwanu', '관우', '羽', 'shu', 10, { rng: 170, as: 0.95, title: '무성', hz: '關羽', qc: '酒且斟下 某去便來', quote: '술은 잠시 따라 두시오. 금방 다녀오겠소.', p: [pct('청룡언월도', 'splash', { r: 150, pct: 1, desc: '주변 적에게 100% 범위 피해' }), pct('오관참장', 'everyN', { n: 5, mult: 6, desc: '5번째 공격마다 6배 피해' }), pct('무성의 위엄', 'pierce', { pct: 0.6, desc: '적 방어력 60% 무시' })],
      sk: [{ n: '청룡언월참', k: 'line', len: 620, w: 130, mult: 10, cd: 12, fx: '#4fe0a0' }, { n: '수엄칠군', k: 'circle', r: 230, range: 460, mult: 8, delay: 0.8, cd: 17, fx: '#5fc8f0' }, { n: '단도부회', k: 'shield', dur: 1.5, cd: 22, fx: '#a0ffd0' }] }),
    u('jegal', '제갈량', '亮', 'shu', 10, { rng: 300, as: 1.15, title: '와룡', hz: '諸葛亮', qc: '鞠躬盡瘁 死而後已', quote: '몸을 굽혀 온 힘을 다하고, 죽은 뒤에야 그치리라.', p: [pct('천하삼분지계', 'globalAtk', { pct: 0.2, fac: 'all', desc: '모든 아군 공격력 20% 증가' }), pct('화공', 'burn', { pct: 0.8, dur: 4, desc: '공격력 80%의 화상 4초' }), pct('공명의 혜안', 'splash', { r: 150, pct: 0.8, desc: '주변 적에게 80% 범위 피해' })],
      sk: [{ n: '동남풍', k: 'line', len: 900, w: 150, mult: 8, cd: 13, fx: '#ffb060' }, { n: '팔진도', k: 'circle', r: 240, range: 520, mult: 6, delay: 0.6, stun: 1.5, cd: 20, fx: '#a0d8ff' }, { n: '칠성단', k: 'heal', pct: 0.35, cd: 24, fx: '#e0f0ff' }] }),
    u('songwon', '손권', '權', 'wu', 10, { rng: 230, as: 0.95, title: '자수성가의 오왕', hz: '孫權', qc: '孤與老賊 勢不兩立', quote: '나와 늙은 역적은 결코 함께 설 수 없다.', p: [pct('삼대의 기업', 'globalAtk', { pct: 0.3, fac: 'wu', desc: '모든 오 유닛 공격력 30% 증가' }), pct('제왕의 눈', 'bossPct', { pct: 0.3, desc: '보스·중간보스 피해 30% 증가' }), pct('강동의 수성', 'hpPct', { pct: 0.5, desc: '보스전 체력 50% 증가' })],
      sk: [{ n: '합비의 일격', k: 'line', len: 480, w: 120, mult: 8, cd: 11, fx: '#ff9080' }, { n: '용인술', k: 'buff', atk: 0.9, dur: 6, cd: 26, fx: '#ffc0b0' }] }),
    u('juyu', '주유', '瑜', 'wu', 10, { rng: 290, as: 1.05, title: '미주랑', hz: '周瑜', qc: '操自送死 而可迎之邪', quote: '조조가 제 발로 죽으러 오는데, 어찌 맞아들이겠습니까!', p: [pct('적벽의 불길', 'burn', { pct: 1, dur: 4, desc: '공격력 100%의 화상 4초' }), pct('연환 화공', 'splash', { r: 170, pct: 0.9, desc: '주변 적에게 90% 범위 피해' }), pct('수군 대도독', 'aura', { pct: 0.2, r: 240, fac: 'wu', desc: '주변 오 유닛 공격력 20% 증가' })],
      sk: [{ n: '적벽 화공', k: 'line', len: 820, w: 170, mult: 9, cd: 13, fx: '#ff6a2a' }, { n: '연환선 폭발', k: 'circle', r: 250, range: 520, mult: 7, delay: 0.8, cd: 16, fx: '#ffa040' }, { n: '곡조 비기', k: 'buff', atk: 0.7, dur: 7, cd: 26, fx: '#ffd0a0' }] }),
    u('taesaja', '태사자', '慈', 'wu', 10, { rng: 250, as: 0.7, title: '신의의 궁장', hz: '太史慈', qc: '大丈夫生於亂世 當帶三尺劍立不世之功', quote: '대장부가 난세에 났으면 삼척 검을 차고 불세출의 공을 세워야 한다!', p: [pct('백발백중', 'crit', { ch: 0.4, mult: 2.8, desc: '40% 확률로 2.8배 피해' }), pct('신정의 결투', 'bossPct', { pct: 0.35, desc: '보스·중간보스 피해 35% 증가' }), pct('쌍극', 'multi', { n: 2, desc: '적 2기를 추가 타격' })],
      sk: [{ n: '신궁 연사', k: 'cone', r: 380, arc: 0.6, mult: 8, cd: 11, fx: '#ffb080' }, { n: '단기 포위 돌파', k: 'line', len: 560, w: 110, mult: 8, cd: 13, dashThrough: true, fx: '#ff9a70' }, { n: '신의의 맹세', k: 'buff', atk: 0.9, dur: 6, cd: 26, fx: '#ffd0b0' }] }),
    u('janggak', '장각', '角', 'etc', 10, { rng: 290, as: 1.15, title: '천공장군', hz: '張角', qc: '蒼天已死 黃天當立', quote: '창천은 이미 죽었고, 황천이 일어나리라.', p: [pct('태평요술', 'multi', { n: 3, desc: '번개가 적 3기를 추가 타격' }), pct('황천의 뇌운', 'stun', { ch: 0.12, dur: 0.7, desc: '12% 확률로 기절' }), pct('부적수', 'bossPct', { pct: 0.3, desc: '보스·중간보스 피해 30% 증가' })],
      sk: [{ n: '황천 낙뢰', k: 'circle', r: 220, range: 540, mult: 8, delay: 0.6, cd: 12, fx: '#f2dd5c' }, { n: '천공 뇌진', k: 'line', len: 760, w: 140, mult: 8, cd: 14, fx: '#ffe880' }, { n: '부적수', k: 'heal', pct: 0.45, cd: 22, fx: '#fff0a0' }] }),
    u('yeopo', '여포', '布', 'etc', 10, { rng: 190, as: 0.65, title: '비장', hz: '呂布', qc: '人中呂布 馬中赤兔', quote: '사람 중엔 여포, 말 중엔 적토.', p: [pct('무쌍', 'crit', { ch: 0.4, mult: 3, desc: '40% 확률로 3배 피해' }), pct('방천화극', 'splash', { r: 170, pct: 1, desc: '주변 적에게 100% 범위 피해' }), pct('적토마', 'hpPct', { pct: 0.5, desc: '보스전 체력 50% 증가' })],
      sk: [{ n: '무쌍 난무', k: 'circle', r: 260, range: 0, mult: 9, delay: 0.25, cd: 11, fx: '#ff5a5a' }, { n: '적토 돌진', k: 'line', len: 620, w: 120, mult: 8, cd: 12, dashThrough: true, fx: '#ff8a5a' }, { n: '천하무쌍', k: 'buff', atk: 1, dur: 5, cd: 28, fx: '#ffb0b0' }] }),
    // 특수: 무소속 유틸. 공격하지 않고 금화로 초빙한다.
    // 명사: 이름난 인물, 비용은 효과에 맞춘다(돈 명사는 30라운드 안팎에 본전)
    u('jwaja', '좌자', '慈', 'free', 0, { cost: 500, build: '금화', title: '오각선인', p: [pct('둔갑술', 'roundGold', { n: 25, desc: '라운드 종료 시 금화 +25' })] }),
    u('mijuk', '미축', '竺', 'free', 0, { cost: 400, build: '금화', title: '서주의 거부', p: [pct('가산 헌납', 'interest', { pct: 0.03, max: 100, desc: '라운드 종료 시 보유 금화의 3% 이자(최대 100)' })] }),
    u('songeon', '손건', '乾', 'free', 0, { cost: 600, build: '금화', title: '유비의 사신', p: [pct('사신 외교', 'midGold', { n: 150, desc: '중간보스 토벌마다 금화 +150' })] }),
    u('chaemunhui', '채문희', '琰', 'free', 0, { cost: 1300, build: '금화', title: '호가십팔박', p: [pct('호가십팔박', 'bossGold', { pct: 0.25, desc: '보스 토벌 금화 25% 증가' })] }),
    u('samahwi', '사마휘', '徽', 'free', 0, { cost: 1100, build: '강화', title: '수경선생', p: [pct('수경의 안목', 'discount', { pct: 0.15, desc: '업그레이드 비용 15% 감소' })] }),
    u('ganong', '간옹', '簡', 'free', 0, { cost: 500, build: '유닛', title: '유비의 죽마고우', p: [pct('담소', 'roundT1', { n: 1, desc: '라운드 보상 1성 +1기' })] }),
    u('ugil', '우길', '吉', 'free', 0, { cost: 900, build: '유닛', title: '강동의 신선', p: [pct('선술', 'combineT1', { n: 1, desc: '유닛을 합성할 때마다 랜덤 1성 1기(선택권 제외)' })] }),
    u('jingung', '진궁', '宮', 'free', 0, { cost: 1800, build: '유닛', title: '여포의 군사', p: [pct('하비의 계책', 'midReward', { n: 2, desc: '중간보스 토벌 보상(선택권·유닛·상자·금화) 2배' })] }),
    u('gyeonhui', '견희', '宓', 'free', 0, { cost: 1000, build: '보스전', title: '낙신', p: [pct('낙신부', 'tierHaste', { pct: 0.2, tier: 6, desc: '6성 이상 공격 속도 20% 증가' })] }),
    u('daegyo', '대교', '喬', 'free', 0, { cost: 900, build: '보스전', title: '강동이교', p: [pct('국색', 'sageCdr', { pct: 0.15, desc: '보스전 출전 장수 스킬 재사용 15% 단축' })] }),
    u('sogyo', '소교', '喬', 'free', 0, { cost: 1100, build: '보스전', title: '강동이교', p: [pct('동작대의 노래', 'staggerEase', { pct: 0.25, desc: '무력화·반격에 필요한 피해 25% 감소' })] }),
    u('hwata', '화타', '佗', 'free', 0, { cost: 700, build: '보스전', title: '신의', p: [pct('마비산', 'activeHeal', { pct: 0.2, uses: 2, desc: '보스전마다 2번, 회복 버튼으로 내 출전 장수 체력 20% 회복' })] }),
  ];
  const sageMax = 4; // 명사는 동시에 4명까지(해임 가능, 환불 없음)

  // ---- 보스전 역할(7성 이상) ----
  // 장수마다 고유 패시브·스킬은 그대로 두고, 역할에 맞는 패시브와 스킬을 더한다. 등급이 높을수록 역할 효과가 세다.
  const roles = {
    tank: { name: '탱커', color: '#8fb0d8', desc: '보스의 공격을 끌어오고 받는 피해가 줄어듭니다' },
    healer: { name: '힐러', color: '#8ee6a0', desc: '아군 전체(다른 사령관 포함)의 체력을 회복합니다' },
    debuff: { name: '디버퍼', color: '#c99cf0', desc: '보스가 받는 피해를 늘리고 무력화 게이지를 더 깎습니다' },
    skill: { name: '스킬 딜러', color: '#ffb35c', desc: '스킬 재사용이 빠르고 스킬 피해가 큽니다' },
    auto: { name: '평타 딜러', color: '#ff7a6a', desc: '평타가 빠르고 강타가 자주 터집니다' },
    support: { name: '버퍼', color: '#ffe07a', desc: '아군 전체(다른 사령관 포함)의 공격력을 올립니다' },
  };
  const roleOf = {
    sunyu: 'skill', deungae: 'skill', seoseo: 'auto', gwanpyeong: 'support', jeongbo: 'auto', jegalgeun: 'debuff', gahu: 'debuff', maenghoek: 'tank',
    jeonwi: 'tank', munang: 'auto', hwangwol: 'healer', bangtong: 'skill', songyeon: 'auto', sonhyang: 'auto', yeoryeong: 'skill', chugyung: 'debuff',
    gwakga: 'debuff', join: 'tank', sunuk: 'support', choseon: 'debuff', jangbi: 'tank', joun: 'auto', macho: 'auto', sonchaek: 'skill', yukson: 'skill', dongtak: 'auto',
    jojo: 'support', samaui: 'debuff', yubi: 'healer', gwanu: 'auto', jegal: 'skill', songwon: 'tank', juyu: 'skill', yeopo: 'auto', taesaja: 'auto', janggak: 'healer',
  };
  // 역할 키트: 같은 역할이라도 장수마다 패시브·스킬이 다르다. s = 등급 단계(7성 0 ~ 불멸 3).
  const P = (name, k, x, desc) => Object.assign({ name, k, desc }, x);
  const per = (v) => Math.round(v * 100) + '%';
  const guard = (v) => P('철벽', 'guard', { pct: v }, `보스전 받는 피해 ${per(v)} 감소`);
  const tough = P('강건', 'hpPct', { pct: 0.6 }, '보스전 체력 60% 증가');
  const regen = (v) => P('구호', 'regen', { pct: v }, `보스전 아군 전체 매초 체력 ${(v * 100).toFixed(1)}% 회복`);
  const partyAtk = (name, v) => P(name, 'partyAtk', { pct: v }, `보스전 아군 전체(다른 사령관 포함) 공격력 ${per(v)} 증가`);
  const expose = (v) => P('약점 간파', 'expose', { pct: v, dur: 4 }, `평타를 맞은 보스가 4초간 받는 피해 ${per(v)} 증가`);
  const breaker = (name, v) => P(name, 'breaker', { pct: v }, `무력화 게이지에 넣는 피해 ${per(1 + v)}`);
  const weaken = (n, v, cd) => ({ n, k: 'weaken', amp: v, dur: 6, cd, fx: '#c99cf0' });
  const heal = (n, v, cd, extra) => Object.assign({ n, k: 'heal', pct: v, cd, fx: '#8ee6a0' }, extra);
  const cdr = (v) => P('연환 계책', 'cdr', { pct: v }, `스킬 재사용 ${per(v)} 단축`);
  const skillPct = (v) => P('필살', 'skillPct', { pct: v }, `스킬 피해 ${per(v)} 증가`);
  const aoe = (v) => P('광역 계책', 'aoe', { pct: v }, `원형 스킬 범위 ${per(v)} 증가`);
  const chain = (v) => P('연쇄 시전', 'chain', { n: v }, `스킬을 쓰면 다른 스킬 재사용 ${v}초 단축`);
  const haste = (v) => P('연격', 'haste', { pct: v }, `보스전 공격 속도 ${per(v)} 증가`);
  const leech = (v) => P('흡혈', 'lifesteal', { pct: v }, `보스를 때릴 때마다 체력 ${(v * 100).toFixed(1)}% 회복`);
  const execute = (v) => P('처형', 'execute', { pct: v }, `보스 체력 30% 이하일 때 주는 피해 ${per(v)} 증가`);
  const pierce = (v) => P('관통', 'pierce', { pct: v }, `적 방어력 ${per(v)} 무시`);
  const smash = P('강타', 'everyN', { n: 4, mult: 3 }, '4번째 공격마다 3배 피해');
  const kits = {
    // 탱커
    maenghoek: (s) => ({ p: [P('칠종칠금', 'lastStand', {}, '보스전마다 한 번, 쓰러질 피해를 체력 1로 버팀'), guard(0.3), tough], sk: { n: '진영 사수', k: 'taunt', dur: 3 + s * 0.5, cd: 16, fx: '#8fb0d8' } }),
    jeonwi: (s) => ({ p: [P('악래', 'lowGuard', { pct: 0.5 }, '체력 30% 이하일 때 받는 피해 50% 추가 감소'), guard(0.3 + s * 0.05), tough], sk: { n: '엄호', k: 'cover', v: 0.3, dur: 4, cd: 18, fx: '#9ec0f0' } }),
    join: (s) => ({ p: [P('철옹성 진형', 'auraGuard', { pct: 0.1 }, '출전한 아군 전체(다른 사령관 포함) 받는 피해 10% 감소'), guard(0.3 + s * 0.05)], sk: { n: '팔문금쇄 방진', k: 'pshield', dur: 3, cd: 20, fx: '#7da7e8' } }),
    jangbi: (s) => ({ p: [P('장판교 위압', 'taunt', {}, '보스가 이 장수를 먼저 노림'), guard(0.3 + s * 0.05), tough], sk: { n: '장판교 호통', k: 'roar', v: 0.2, dur: 5, cd: 18, fx: '#f0d060' } }),
    songwon: (s) => ({ p: [guard(0.4)], sk: { n: '합비 사수', k: 'reflect', mult: 3, dur: 4, cd: 18, fx: '#ff9080' } }),
    // 힐러(모두 전군 치료, 수치와 덧붙는 효과가 다르다)
    hwangwol: (s) => ({ p: [P('목우 보급', 'regen', { pct: 0.012 + s * 0.004 }, `보스전 아군 전체 매초 체력 ${((0.012 + s * 0.004) * 100).toFixed(1)}% 회복`)], sk: heal('전군 치료', 0.3 + s * 0.05, 18) }),
    yubi: (s) => ({ p: [P('인덕의 손길', 'healLow', { pct: 0.1 }, '3초마다 체력 50% 이하인 아군(다른 사령관 포함) 체력 10% 회복')], sk: heal('인덕의 전군 치료', 0.45, 20) }),
    janggak: (s) => ({ p: [P('부적수 축복', 'healBuff', { pct: 0.15 }, '전군 치료 때 아군 전체 3초간 공격력 15% 증가')], sk: heal('태평 전군 치료', 0.35, 20, { hot: 0.03, hotDur: 5 }) }),
    // 버퍼
    gwanpyeong: (s) => ({ p: [partyAtk('부자의 기세', 0.08 + s * 0.03)], sk: { n: '공격 호령', k: 'rally', atk: 0.3 + s * 0.1, dur: 6, cd: 22, fx: '#ffe07a' } }),
    sunuk: (s) => ({ p: [P('왕좌의 보좌', 'partyCdr', { pct: 0.08 + s * 0.03 }, `보스전 아군 전체 스킬 재사용 ${per(0.08 + s * 0.03)} 단축`)], sk: { n: '철벽 진형', k: 'pshield', dur: 3, cd: 22, fx: '#ffe07a' } }),
    jojo: (s) => ({ p: [partyAtk('위무의 사기', 0.08 + s * 0.03)], sk: { n: '사기 진작', k: 'hasteAll', v: 0.3 + s * 0.05, dur: 6, cd: 24, fx: '#ffd27a' } }),
    // 디버퍼
    jegalgeun: (s) => ({ p: [expose(0.08), breaker('기세 꺾기', 0.5)], sk: weaken('허점 노출', 0.2, 20) }),
    gahu: (s) => ({ p: [breaker('독계', 0.6)], sk: { n: '반간계', k: 'delay', v: 3, cd: 18, fx: '#9ad070' } }),
    chugyung: (s) => ({ p: [expose(0.1), breaker('비도 견제', 0.7)], sk: { n: '비도 난사', k: 'roar', v: 0.15, dur: 6, cd: 18, fx: '#f07a3e' } }),
    gwakga: (s) => ({ p: [expose(0.12), breaker('기책 간파', 1.2)], sk: weaken('유계 간파', 0.3, 20) }),
    choseon: (s) => ({ p: [P('경국지색', 'bossWeak', { pct: 0.1 }, '출전 중 보스 공격력 10% 감소')] }),
    samaui: (s) => ({ p: [expose(0.2), breaker('낭고', 1)], sk: weaken('고평릉의 함정', 0.4, 22) }),
    // 스킬 딜러
    // 순유·여령기(스킬 1개)의 연쇄 시전, 등애·육손(원형 스킬 없음)의 광역 계책은 효과가 0이어서 실제로 듣는 패시브로 바꿨다
    sunyu: (s) => ({ p: [cdr(0.25 + s * 0.05), skillPct(0.3 + s * 0.1)] }),
    deungae: (s) => ({ p: [skillPct(0.4 + s * 0.15), cdr(0.2 + s * 0.05)] }),
    bangtong: (s) => ({ p: [aoe(0.3 + s * 0.05), cdr(0.25 + s * 0.05)] }),
    yeoryeong: (s) => ({ p: [cdr(0.25 + s * 0.05), skillPct(0.4 + s * 0.15)] }),
    sonchaek: (s) => ({ p: [cdr(0.25 + s * 0.05), skillPct(0.3 + s * 0.1)] }),
    yukson: (s) => ({ p: [cdr(0.2 + s * 0.05), skillPct(0.4 + s * 0.15)] }),
    jegal: (s) => ({ p: [cdr(0.25 + s * 0.05), chain(1.5 + s * 0.25)] }),
    juyu: (s) => ({ p: [aoe(0.3 + s * 0.05), skillPct(0.4 + s * 0.15)] }),
    // 평타 딜러
    seoseo: (s) => ({ p: [haste(0.35)] }),
    jeongbo: (s) => ({ p: [haste(0.35), leech(0.015), smash] }),
    munang: (s) => ({ p: [haste(0.4), execute(0.3)] }),
    songyeon: (s) => ({ p: [haste(0.4), pierce(0.4)] }),
    sonhyang: (s) => ({ p: [haste(0.45), leech(0.015)] }),
    joun: (s) => ({ p: [haste(0.45), execute(0.4)] }),
    macho: (s) => ({ p: [haste(0.45), pierce(0.4)] }),
    dongtak: (s) => ({ p: [haste(0.35), leech(0.02), smash] }),
    gwanu: (s) => ({ p: [haste(0.5), execute(0.5)] }),
    taesaja: (s) => ({ p: [haste(0.5), pierce(0.5)] }),
    yeopo: (s) => ({ p: [haste(0.5), leech(0.02)] }),
  };
  units.forEach((d) => {
    const r = roleOf[d.id];
    if (!r) return;
    d.role = r;
    const kit = kits[d.id] ? kits[d.id](d.tier - 7) : { p: [] };
    d.p = (d.p || []).concat(kit.p);
    // 역할 스킬은 최대 3칸, 넘치면 마지막을 바꾼다. 아군 호령이 있는 장수의 기존 자기 강화는 뺀다.
    if (kit.sk) {
      d.sk = (d.sk || []).slice();
      const same = d.sk.findIndex((x) => x.k === kit.sk.k);
      if (same >= 0) d.sk[same] = kit.sk; else if (d.sk.length >= 3) d.sk[2] = kit.sk; else d.sk.push(kit.sk);
    }
    if (kit.sk && kit.sk.k === 'rally') d.sk = d.sk.filter((x) => x.k !== 'buff');
  });

  // 스킬 연출(skillfx.js): 이름에 맞는 모양을 고른다. 표에 없는 역할 스킬은 종류(k)별 기본값.
  const SKILL_VX = {
    '성동격서': 'feint', '음평 강행': 'thrust', '팔문금쇄 파쇄': 'rune', '공격 호령': 'rally', '허점 노출': 'curse', '이간계': 'miasma', '반간계': 'scheme',
    '맹수 돌격': 'claw', '진영 사수': 'taunt', '단극 투척': 'throw', '엄호': 'barrier', '낙가 돌격': 'thrust', '연노 일제사': 'arrows', '전군 치료': 'heal',
    '연환 화염': 'fireblast', '강동 호령': 'rally', '연환궁': 'arrows', '비연보': 'wind', '소화극 난무': 'blades', '비도 연속 투척': 'throw', '비도 난사': 'knives',
    '유계': 'rune', '요절의 예지': 'guard', '유계 간파': 'curse', '팔문금쇄진': 'guard', '철기 반격': 'blades', '팔문금쇄 방진': 'barrier',
    '구호탄랑': 'power', '이호경식': 'rune', '철벽 진형': 'barrier', '장판교 대갈': 'shock', '사모 돌격': 'thrust', '장판교 호통': 'roar',
    '단기 돌파': 'thrust', '용담': 'guard', '서량 철기 돌격': 'charge', '금마초의 위용': 'power', '패왕 돌격': 'thrust', '칠백리 화공': 'fireline', '인내의 진': 'guard', '폭정의 압살': 'quake',
    '미인계': 'hearts', '연무': 'petals', '의천검': 'sword', '호표기 돌격': 'charge', '사기 진작': 'wind', '낭고상': 'rune', '농성 대기': 'guard', '고평릉의 함정': 'curse',
    '쌍고검': 'blades', '인덕의 전군 치료': 'heal', '오호 소집': 'rally', '청룡언월참': 'crescent', '수엄칠군': 'flood', '단도부회': 'guard',
    '동남풍': 'windfire', '팔진도': 'rune', '칠성단': 'heal', '합비의 일격': 'thrust', '용인술': 'rally', '합비 사수': 'reflect',
    '적벽 화공': 'fireline', '연환선 폭발': 'fireblast', '곡조 비기': 'power', '신궁 연사': 'arrows', '단기 포위 돌파': 'thrust', '신의의 맹세': 'power',
    '황천 낙뢰': 'lightning', '천공 뇌진': 'thunderline', '태평 전군 치료': 'heal', '무쌍 난무': 'storm', '적토 돌진': 'thrust', '천하무쌍': 'power',
  };
  const SKILL_VX_K = { line: 'thrust', cone: 'blades', circle: 'burst', buff: 'power', shield: 'guard', heal: 'heal', rally: 'rally', taunt: 'taunt', cover: 'barrier', pshield: 'barrier', hasteAll: 'wind', roar: 'roar', delay: 'scheme', reflect: 'reflect', charm: 'hearts', weaken: 'curse' };
  units.forEach((d) => (d.sk || []).forEach((s) => { s.vx = SKILL_VX[s.n] || SKILL_VX_K[s.k]; }));
  // 7성 이상 사거리 개성: 기본(200)에서 벌어진 만큼을 키운다. 근접은 1.5배 더 짧게, 원거리는 1.8배 더 멀리(기본 200은 그대로).
  // 예) 관평 130 → 95, 관우 170 → 155, 조조 240 → 272, 제갈량 300 → 380
  units.forEach((d) => { if (d.tier >= 7 && d.rng && d.rng !== 200) d.rng = Math.round(d.rng < 200 ? 200 - (200 - d.rng) * 1.5 : 200 + (d.rng - 200) * 1.8); });

  // 7성 이상은 동일 유닛이 아니라 인연 있는 장수로 조합한다. 2026-11-09: 고등급 등장을 늦추려고 모두 같은 세력 5성 1기를 더 넣음(위 하후돈·촉 마대·오 노숙·군웅 원소. 2026-11-17 마초가 신화로 올라가 촉 5성은 마대), 조조는 등애 대신 전위. 7성은 가치 합 432(5성 3개) 이상, 전설은 576(5성 4개) 이상.
  // 신화·불멸에는 인연이 분명한 전설만 재료로 넣는다(제갈량-황월영, 유비-방통, 손책·손권-손견).
  const recipes = {
    sunyu: ['hadon', 'hadon', 'heojeo', 'heojeo', 'seohwang', 'hayeon', 'janghap', 'akjin', 'hadon'],
    deungae: ['ganguy', 'hadon', 'janghap', 'hayeon', 'swd', 'swd', 'hadon'],
    seoseo: ['madae', 'hadon', 'heojeo', 'hwangchung', 'hwangchung', 'wiyeon', 'janghap', 'juchang', 'spr', 'madae'],
    gwanpyeong: ['yeomong', 'hwangchung', 'hwangchung', 'juchang', 'juchang', 'seohwang', 'wiyeon', 'wiyeon', 'madae'],
    jeongbo: ['nosuk', 'nosuk', 'gamnyeong', 'gamnyeong', 'gamnyeong', 'hwanggae', 'hwanggae', 'jutae', 'nosuk'],
    jegalgeun: ['yeomong', 'nosuk', 'neungtong', 'jutae', 'arc', 'nosuk'],
    gahu: ['wonso', 'hadon', 'gongson', 'gongson', 'hwawoong', 'hwawoong', 'munchu', 'munchu', 'anryang', 'wonso'],
    maenghoek: ['madae', 'madae', 'wiyeon', 'wiyeon', 'wiyeon', 'hwangchung', 'gongson', 'hwawoong', 'cav', 'wonso'],
    jeonwi: ['jangryo', 'heojeo', 'heojeo', 'hadon', 'seohwang', 'akjin', 'hadon'],
    munang: ['jangryo', 'hadon', 'hadon', 'janghap', 'hayeon', 'cav', 'cav', 'hadon'],
    hwangwol: ['seoseo', 'madae', 'hwangchung', 'juchang', 'arc', 'arc', 'madae'],
    bangtong: ['seoseo', 'wiyeon', 'wiyeon', 'hwangchung', 'hwangchung', 'hwangchung', 'juchang', 'madae'],
    songyeon: ['jeongbo', 'hwanggae', 'hwanggae', 'hwawoong', 'wonso', 'nosuk'],
    sonhyang: ['yeomong', 'gamnyeong', 'gamnyeong', 'gamnyeong', 'nosuk', 'neungtong', 'nosuk'],
    yeoryeong: ['jangryo', 'wonso', 'wonso', 'hwawoong', 'gongson', 'wonso'],
    chugyung: ['maenghoek', 'gongson', 'gongson', 'wiyeon', 'wiyeon', 'anryang', 'hwawoong', 'juchang', 'juchang', 'wonso'],
    gwakga: { parts: ['deungae', 'sunyu', 'jangryo', 'hadon'], item: 'yugye' },
    join: { parts: ['sunyu', 'jangryo', 'hadon', 'hadon'], item: 'geumswae' },
    sunuk: { parts: ['sunyu', 'deungae', 'hadon', 'hadon'], item: 'chanhap' },
    jangbi: { parts: ['gwanpyeong', 'seoseo', 'madae', 'madae'], item: 'sapa' },
    joun: { parts: ['seoseo', 'ganguy', 'madae', 'hwangchung', 'madae'], item: 'cheonggang' },
    macho: { parts: ['gwanpyeong', 'ganguy', 'madae', 'madae', 'gongson'], item: 'hodu' },
    sonchaek: { parts: ['jeongbo', 'songyeon', 'yeomong', 'nosuk'], item: 'gojeong' },
    yukson: { parts: ['jegalgeun', 'jeongbo', 'nosuk', 'nosuk'], item: 'hwagong' },
    dongtak: { parts: ['gahu', 'maenghoek', 'wonso', 'wonso'], item: 'seoryang' },
    choseon: { parts: ['gahu', 'jangryo', 'wonso', 'wonso'], item: 'pyewol' },
    jojo: { parts: ['jeonwi', 'sunyu', 'jangryo', 'hadon', 'hadon'], item: 'uicheon' },
    samaui: { parts: ['deungae', 'sunyu', 'jangryo', 'janghap', 'hadon'], item: 'nanggo' },
    yubi: { parts: ['gwanpyeong', 'seoseo', 'bangtong', 'madae', 'madae'], item: 'ssanggo' },
    gwanu: { parts: ['gwanpyeong', 'seoseo', 'madae', 'hwangchung', 'juchang', 'madae'], item: 'cheongryong' },
    jegal: { parts: ['seoseo', 'maenghoek', 'ganguy', 'hwangwol', 'madae'], item: 'baekwoo' },
    songwon: { parts: ['jeongbo', 'jegalgeun', 'yeomong', 'nosuk', 'songyeon', 'nosuk'], item: 'obwang' },
    juyu: { parts: ['jegalgeun', 'jeongbo', 'yeomong', 'gamnyeong', 'hwanggae', 'nosuk'], item: 'jeokbyeok' },
    yeopo: { parts: ['gahu', 'maenghoek', 'wonso', 'hwawoong', 'wonso'], item: 'bangcheon' },
    taesaja: { parts: ['jeongbo', 'yeomong', 'gamnyeong', 'hwanggae', 'nosuk', 'nosuk'], item: 'sinjeong' },
    janggak: { parts: ['gahu', 'maenghoek', 'wonso', 'gongson', 'juchang', 'wonso'], item: 'taepyeong' },
  };

  const items = [
    { id: 'yugye', name: '곽가의 유계', tier: 9 }, { id: 'geumswae', name: '팔문금쇄진도', tier: 9 }, { id: 'chanhap', name: '빈 찬합', tier: 9 },
    { id: 'sapa', name: '장팔사모', tier: 9 }, { id: 'cheonggang', name: '청강검', tier: 9 }, { id: 'gojeong', name: '고정도', tier: 9 },
    { id: 'hwagong', name: '이릉 화공서', tier: 9 }, { id: 'seoryang', name: '서량 철기 병부', tier: 9 }, { id: 'pyewol', name: '폐월의 거울', tier: 9 },
    { id: 'hodu', name: '호두잠금창', tier: 9 },
    { id: 'uicheon', name: '의천검', tier: 10 }, { id: 'nanggo', name: '낭고의 부절', tier: 10 }, { id: 'ssanggo', name: '쌍고검', tier: 10 },
    { id: 'cheongryong', name: '청룡언월도', tier: 10 }, { id: 'baekwoo', name: '백우선', tier: 10 }, { id: 'obwang', name: '오왕의 인수', tier: 10 },
    { id: 'jeokbyeok', name: '적벽 화공도', tier: 10 }, { id: 'bangcheon', name: '방천화극', tier: 10 }, { id: 'sinjeong', name: '신정의 단극', tier: 10 }, { id: 'taepyeong', name: '태평요술서', tier: 10 },
  ];
  // 상자에서 나오는 소모품. 상자와 아이템은 모두 게임판 위의 말로 등장한다.
  const chestMark = '箱', itemMark = '寶';
  const consumables = {
    rankUp: { name: '랜덤 등급 상승권', mark: '昇', desc: '1~5성 유닛 1기를 다음 등급의 랜덤 유닛으로 바꿉니다.' },
    factionReroll: { name: '다른 세력 리롤권', mark: '替', desc: '2~7성 유닛 1기를 같은 등급의 다른 세력 유닛으로 바꿉니다.' },
    generalSwap: { name: '장수 교체권', mark: '換', desc: '7성 이상 장수 1기를 같은 등급의 다른 장수로 바꿉니다(세력 무관, 랜덤).' },
  };
  // 전리품 상자 확률
  // 보스 상자: 신화·불멸 조합 아이템만 나온다(등급 상승권·리롤권은 중간보스 보상으로)
  const chestTable = [
    { w: 27, kind: 'item', tier: 10 }, { w: 73, kind: 'item', tier: 9 },
  ];

  // ---- 장수 해금(2026-11-17 사용자 결정: 불멸 전부 잠금, 신화 일부 잠금) ----
  // 잠긴 장수는 조합·선택권·교체권에서 막는다. 상자는 등급 확률을 그대로 두고, 그 등급 안에서 해금한 장수 아이템 chestOpenShare · 잠긴 장수 아이템 나머지로 준다(2026-11-24).
  // 처음부터 열린 신화: 세력마다 한 명 이상, 조합 재료가 쉬운(7성 1~2기, 전설 불필요) 상징적인 장수.
  //   조인(위, 7성 1기) · 장비·조운(촉, 일본에서 가장 이름난 둘) · 육손(오, 전설 불필요) · 초선(그 외, 7성 1기)
  // 잠긴 신화: 곽가·순욱(7성 2기), 손책(전설 손견 필요), 동탁(7성 2기)
  // 열쇠: 계정 보유 목록(owned)에 'unl_<장수 id>'. 가격: 동전(coins), 결제 상품(iap: [상품 ID, 엔]).
  // 동전 기준: 보통 클리어 1판 = 동전 58(서버 xpFor). 신화 150 ≒ 2~4판, 불멸 700 ≒ 12~20판.
  const unlock = {
    // 2026-11-17 사용자 결정: 신화도 처음엔 전부 잠김. 첫 튜토리얼(로비 안내 + 첫 판)을 마치거나 건너뛰면 신화 2명을 랜덤으로 연다(starterMyth).
    freeMyth: [],
    starterMyth: 2, starterKey: 'starter',
    tiers: [9, 10], // 이 등급에서 freeMyth에 없는 장수는 잠근다
    coins: { 9: 150, 10: 700 },
    ad: { coins: 30, daily: 5 }, // 보상형 광고 1회 = 동전 30, 하루 5회(서버가 막는다)
    iap: { 9: ['unlock_myth_', 160], 10: ['unlock_imm_', 320], all10: ['unlock_imm_all', 1200], noads: ['remove_ads', 480] },
    noAdsKey: 'noads', // 광고 제거: 판 끝 전면 광고를 없애고, 동전 광고는 보지 않고 바로 받는다(하루 횟수 상한은 같음)
    key: (id) => 'unl_' + id,
    provider: null, // 화면(lobby.js)이 지금 이용자의 열린 목록을 돌려주는 함수를 넣는다. 엔진은 opt.unlocked가 없을 때 이것을 쓴다.
    // 상자(2026-11-24 사용자 결정): 등급을 정한 뒤 이 몫은 해금한 장수의 아이템, 나머지는 잠긴 장수의 아이템(engine.js openChest).
    chestOpenShare: 0.7,
  };
  unlock.lockedIds = () => units.filter((d) => unlock.tiers.includes(d.tier) && !unlock.freeMyth.includes(d.id)).map((d) => d.id);
  unlock.price = (id) => { const d = units.find((x) => x.id === id); return d && unlock.lockedIds().includes(id) ? unlock.coins[d.tier] : null; };

  // 2026-11-17 밸런스: 보통·어려움을 올렸다(보통 mult 0.75→0.85·lane 1.4→1.55·bossAtk 0.65→0.72, 어려움 mult 1→1.1·lane 1.75→1.9·bossAtk 0.85→0.92). 쉬움·악몽은 그대로. 측정: tests/balance/sim.js
  // 2026-11-17 3차(최고 등급 기준): 보통 bossHpx 80 1.3→3.9·90 0.95→4.0(신화 없으면 R80~90에서 막힘), 어려움 90 1.1→4.4·100 1.05→4.2(불멸 없으면 R90~100에서 막힘). 근거: production/team/2026-11-17/balance-tiers.md
  // 2026-11-17 2차(지렛대): 보통·어려움에만 선택 항목을 둔다(없으면 엔진 기본값 → 쉬움·악몽은 코드상 그대로).
  //   upPct 강화 1단계당 공격력(기본 0.2), sellGold 1성 해산 금화 배율, bossGold 보스 토벌 금화 배율,
  //   laneBump [시작R, 끝R, 배율] 라인 몹 체력 구간 보정, bossHpx {라운드: 배율} 보스 체력 보정. 근거: production/team/2026-11-17/balance-levers.md
  const difficulties = [
    { id: 'easy', name: '쉬움', rounds: 70, mult: 0.4, lane: 1, bossAtk: 0.45, startUnits: 6, level: 0 },
    { id: 'normal', name: '보통', rounds: 90, mult: 0.85, lane: 1.55, bossAtk: 0.72, startUnits: 7, level: 1,
      upPct: 0.22, sellGold: 0.7, bossGold: 1.2, laneBump: [[31, 80, 1.1]], bossHpx: { 55: 1.25, 70: 1.3, 80: 2.0, 90: 1.6 } },
    { id: 'hard', name: '어려움', rounds: 100, mult: 1.1, lane: 1.9, bossAtk: 0.92, startUnits: 8, level: 2,
      upPct: 0.22, sellGold: 0.7, bossGold: 1.2, bossHpx: { 55: 1.1, 70: 1.2, 80: 1.2, 90: 4.4, 100: 4.2 } },
    // 악몽: 사용자 '악몽도 지금 쉬움'(2026-11-17). 불멸이 있으면 R55~110이 거의 공짜라(balance-tiers.md) R90~110 보스 체력 ×2. 사람 시험으로 다시 맞출 것
    { id: 'nightmare', name: '악몽', rounds: 120, mult: 1.4, lane: 2.2, bossAtk: 1.05, startUnits: 10, level: 3, bossHpx: { 90: 2, 100: 2, 110: 2 } },
  ];

  const upgrades = [
    { id: 'g34', name: '3~4성', test: (d) => d.tier === 3 || d.tier === 4, max: 12, base: 10 },
    { id: 'g56', name: '5~6성', test: (d) => d.tier === 5 || d.tier === 6, max: 12, base: 25 },
    { id: 'g7wei', name: '7성+ 위', test: (d) => d.tier >= 7 && d.fac === 'wei', max: 20, base: 20 },
    { id: 'g7shu', name: '7성+ 촉', test: (d) => d.tier >= 7 && d.fac === 'shu', max: 20, base: 20 },
    { id: 'g7wu', name: '7성+ 오', test: (d) => d.tier >= 7 && d.fac === 'wu', max: 20, base: 20 },
    { id: 'g7etc', name: '7성+ 그 외', test: (d) => d.tier >= 7 && d.fac === 'etc', max: 20, base: 20 },
  ];

  // 라인 웨이브 편성. from 라운드부터 해당 병력이 나온다.
  const waves = [
    { from: 1, name: '황건적', mark: '黃', color: '#c9a93f', hat: 'turban', weapon: 'spear' },
    { from: 11, name: '십상시 금군', mark: '宦', color: '#9a6fb0', hat: 'scholar', weapon: 'sword' },
    { from: 26, name: '서량 기병', mark: '涼', color: '#b5583f', hat: 'fur', weapon: 'lance' },
    { from: 41, name: '원소군', mark: '袁', color: '#7f8f3f', hat: 'guard', weapon: 'bow' },
    { from: 56, name: '조조군 청주병', mark: '靑', color: '#3f7f9a', hat: 'helm', weapon: 'spear' },
    { from: 71, name: '수군', mark: '水', color: '#3f9a8f', hat: 'bare', weapon: 'axe' },
    { from: 91, name: '남만병', mark: '蠻', color: '#a5703a', hat: 'fur', weapon: 'mace' },
    { from: 101, name: '위 북방군', mark: '魏', color: '#5f6fa8', hat: 'helm', weapon: 'halberd' },
  ];

  // 패턴 gen: 엔진·raid.js의 hazard 생성기 이름. min: 추가되는 난이도 단계(0 쉬움~3 악몽). ctr: 반격 창.
  // style caster: 붙지 않고 순간이동하며 원거리로 친다. phases: 체력 비율(at)에서 시작하는 고유 기믹(raid.js mechs).
  const bosses = [
    { round: 10, id: 'b_janggak', name: '장각', mark: '角', title: '황건의 난', place: '광종', fx: '#f2dd5c', reqDps: 48, hitTier: 2, time: 120,
      arena: { sky: '#3a2f14', ground: '#6b5a2c', motif: 'altar' }, line: '창천은 이미 죽었고, 황천이 일어나리라.',
      style: 'caster', phases: [{ at: 0.7, m: 'altars', n: '태평요술 제단' }, { at: 0.4, m: 'clones', n: '황천 분신술' }],
      patterns: [{ n: '태평요술 낙뢰', gen: 'rain', vis: 'bolt', p: { n: 5, r: 80 } }, { n: '부적 살포', gen: 'fan', vis: 'talisman', p: { n: 3 } }, { n: '황천 뇌진', gen: 'nova', vis: 'thunder', p: { r: 220 } }, { n: '구절장 강령', gen: 'bullet', vis: 'spirit', p: { n: 12, waves: 2 }, min: 2 }] },
     { round: 25, id: 'b_hwawoong', name: '화웅', mark: '雄', title: '사수관 전투', place: '사수관', fx: '#e0704a', reqDps: 224, hpx: 2.3, hitTier: 3, time: 130,
      arena: { sky: '#3b2018', ground: '#5c4030', motif: 'gate' }, line: '내 칼을 받아낼 자, 연합군에 있느냐!',
      phases: [{ at: 0.6, m: 'domino', n: '사수관 낙석' }, { at: 0.3, m: 'domino', n: '사수관 붕괴' }],
      patterns: [{ n: '관문 돌격', gen: 'charge', vis: 'charge', p: { w: 110, ctr: 1 } }, { n: '대도 횡소', gen: 'sweep', vis: 'blade', p: { n: 3, arc: 1.3 } }, { n: '낙석', gen: 'rain', vis: 'rock', p: { n: 6, r: 90 } }, { n: '서량의 호통', gen: 'nova', vis: 'roar', p: { r: 260 }, min: 2 }] },
     { round: 40, id: 'b_dongtak', name: '동탁', mark: '卓', title: '장안 천도', place: '낙양 대화재', fx: '#d0503c', reqDps: 650, hpx: 2.3, hitTier: 4, time: 140,
      arena: { sky: '#3e1612', ground: '#57261c', motif: 'city' }, line: '낙양을 불태워라. 천하는 내 손 안이다.',
      phases: [{ at: 0.7, m: 'crush', n: '폭정의 압살' }, { at: 0.4, m: 'crush', n: '폭정의 압살' }],
      patterns: [{ n: '낙양 방화', gen: 'fire', vis: 'flame', p: { n: 6, r: 95 } }, { n: '철기 짓밟기', gen: 'charge', vis: 'charge', p: { w: 130, ctr: 1 } }, { n: '화염 나선', gen: 'bullet', vis: 'fireball', p: { n: 14, waves: 3 } }, { n: '폭군의 일갈', gen: 'nova', vis: 'roar', p: { r: 240 }, min: 1 }] },
     { round: 55, id: 'b_wonso', name: '원소', mark: '紹', title: '관도대전', place: '관도', fx: '#c9c04a', reqDps: 1320, hpx: 2.3, hitTier: 5, time: 150,
      arena: { sky: '#2f3018', ground: '#555026', motif: 'wagon' }, line: '사세삼공의 위엄 앞에 무릎 꿇어라.',
      style: 'caster', speed: 90, phases: [{ at: 1, m: 'towers', n: '궁루 설치' }, { at: 0.5, m: 'towers', n: '궁루 재건' }],
      patterns: [{ n: '벽력거 투석', gen: 'rain', vis: 'rock', p: { n: 9, r: 110 } }, { n: '대군 진격', gen: 'cross', vis: 'army', p: { n: 4 } }, { n: '하북 병력 포위', gen: 'rings', vis: 'army', p: { n: 3 } }, { n: '궁노 일제사', gen: 'fan', vis: 'arrow', p: { n: 7 }, min: 2 }] },
     { round: 70, id: 'b_yeopo', name: '여포', mark: '布', title: '호로관 전투', place: '호로관', fx: '#ff4a4a', reqDps: 3000, hpx: 6.9, fhpx: 13.8, hitTier: 6, time: 160,
      arena: { sky: '#34121a', ground: '#4a2830', motif: 'gate' }, line: '셋이 덤벼도 좋다. 천하무쌍이 누구인지 보여주마.',
      speed: 165, phases: [{ at: 0.3, m: 'awaken', n: '천하무쌍 각성' }],
      patterns: [{ n: '적토 돌진', gen: 'chain', vis: 'redhare', p: { w: 130, times: 3 } }, { n: '방천화극 횡소', gen: 'sweep', vis: 'halberd', p: { n: 4, arc: 1.4 } }, { n: '무쌍 난무', gen: 'combo', vis: 'halberd', p: {} }, { n: '천하무쌍', gen: 'rings', vis: 'roar', p: { n: 4 } }] },
     { round: 80, id: 'b_jojo', name: '조조', mark: '操', title: '적벽대전', place: '적벽', fx: '#ff8a3c', reqDps: 6000, hpx: 9.5, hitTier: 7, time: 170,
      arena: { sky: '#1a2230', ground: '#223a4a', motif: 'river' }, line: '술을 앞에 두고 노래하세. 인생이 얼마나 되겠는가.',
      phases: [{ at: 0.7, m: 'huarong', n: '화용도 퇴로' }, { at: 0.35, m: 'huarong', n: '화용도 퇴로' }],
      patterns: [{ n: '연환선 화공', gen: 'deck', vis: 'flame', p: {} }, { n: '화선 낙하', gen: 'rain', vis: 'fireship', p: { n: 11, r: 110 } }, { n: '호표기', gen: 'charge', vis: 'charge', p: { w: 140, ctr: 1 } }, { n: '동남풍', gen: 'fan', vis: 'wind', p: { n: 9 } }] },
     { round: 90, id: 'b_yukson', name: '육손', mark: '遜', title: '이릉대전', place: '이릉', fx: '#ff6a2a', reqDps: 11000, hpx: 4.5, fhpx: 7.36, hitTier: 8, time: 180,
      arena: { sky: '#2a1a10', ground: '#403020', motif: 'forest' }, line: '칠백 리 영채여, 이제 불타거라.',
      phases: [{ at: 0.6, m: 'pillars', n: '석병팔진' }, { at: 0.3, m: 'pillars', n: '석병팔진' }],
      patterns: [{ n: '칠백리 연영 방화', gen: 'spread', vis: 'flame', p: { bands: 5 } }, { n: '화공 나선', gen: 'bullet', vis: 'fireball', p: { n: 18, waves: 3 } }, { n: '불화살 비', gen: 'rain', vis: 'firearrow', p: { n: 12, r: 110 } }, { n: '서생의 인내', gen: 'rings', vis: 'flame', p: { n: 4 } }] },
     { round: 100, id: 'b_jegal', name: '제갈량', mark: '亮', title: '기산 북벌', place: '기산', fx: '#7fd0ff', reqDps: 18000, hpx: 4.02, fhpx: 4.6, hitTier: 9, time: 190,
      arena: { sky: '#14222a', ground: '#2a3f40', motif: 'bagua' }, line: '팔문이 열렸습니다. 생문은 어디일까요.',
      style: 'caster', phases: [{ at: 0.7, m: 'unify', n: '칠성등 기도' }, { at: 0.35, m: 'unify', n: '칠성등 기도' }],
      patterns: [{ n: '팔진도', gen: 'gates', vis: 'bagua', p: {} }, { n: '연노 일제사', gen: 'fan', vis: 'arrow', p: { n: 11 } }, { n: '목우유마 돌격', gen: 'cross', vis: 'ox', p: { n: 8 } }, { n: '동남풍', gen: 'bullet', vis: 'wind', p: { n: 22, waves: 3 } }] },
     { round: 110, id: 'b_deungae', name: '등애', mark: '艾', title: '음평 강습', place: '면죽관', fx: '#9fb4e0', reqDps: 26000, hpx: 4.02, hitTier: 9, time: 200,
      arena: { sky: '#1c2230', ground: '#39404a', motif: 'cliff' }, line: '절벽도 길이 된다. 촉의 끝이 왔다.',
      phases: [{ at: 0.65, m: 'cliff', n: '음평 절벽' }, { at: 0.35, m: 'ambush', n: '담중의 복병' }],
      patterns: [{ n: '음평 절벽 낙하', gen: 'rain', vis: 'rock', p: { n: 15, r: 120 } }, { n: '면죽관 돌파', gen: 'charge', vis: 'charge', p: { w: 160, ctr: 1 } }, { n: '잠행', gen: 'burrow', vis: 'quake', p: {} }, { n: '성도 함락', gen: 'rows', vis: 'army', p: { n: 6 } }] },
     { round: 120, id: 'b_samaui', name: '사마의', mark: '懿', title: '천하통일', place: '고평릉', fx: '#b07aff', reqDps: 36000, hpx: 3.4, fhpx: 10, hitTier: 10, time: 220,
      arena: { sky: '#17102a', ground: '#2c2240', motif: 'palace' }, line: '삼국의 영웅은 모두 갔다. 천하는 사마씨의 것이다.',
      style: 'caster', phases: [{ at: 0.75, m: 'pillars', n: '석병의 그림자' }, { at: 0.5, m: 'clones', n: '사마의 분신' }, { at: 0.25, m: 'unify', n: '천하통일' }],
      patterns: [{ n: '낭고의 시선', gen: 'gaze', vis: 'gaze', p: {} }, { n: '고평릉의 변', gen: 'gates', vis: 'bagua', p: {} }, { n: '농성의 끝', gen: 'rings', vis: 'army', p: { n: 6 } }, { n: '사마씨 삼대', gen: 'cross', vis: 'shadow', p: { n: 10 } }, { n: '진의 건국', gen: 'bullet', vis: 'shadow', p: { n: 28, waves: 4 } }] },
  ];

  // 중간보스는 해당 라운드 시작과 함께 등장하고, 토벌하거나 놓치면 6분 뒤 다시 나온다.
  const midbosses = [
    { round: 3, name: '정원지', mark: '程', story: '탁현의 황건 선봉', reward: { randomT1: 3 } },
    { round: 5, name: '장량', mark: '梁', story: '인공장군', reward: { randomT1: 4 } },
    { round: 15, name: '장양', mark: '讓', story: '십상시의 난', reward: { randomT: [[2, 1]] } },
    { round: 20, name: '서영', mark: '榮', story: '형양의 매복', reward: { tickets: [[2, 3]] } },
    { round: 30, name: '이각', mark: '傕', story: '장안의 난', reward: { randomT: [[2, 3]], gold: 200 } },
    { round: 35, name: '곽사', mark: '汜', story: '장안의 난', reward: { tickets: [[3, 2]] } },
    { round: 45, name: '안량', mark: '良', story: '백마 전투', reward: { randomT: [[3, 2]], cons: { factionReroll: 1 } } },
    { round: 50, name: '문추', mark: '醜', story: '연진 전투', reward: { tickets: [[3, 3]] } },
    { round: 60, name: '하후돈', mark: '惇', story: '박망파 전투', reward: { randomT: [[4, 2]], gold: 500 } },
    { round: 65, name: '채모', mark: '瑁', story: '형주 수군', reward: { tickets: [[4, 3]] } },
    { round: 75, name: '하후연', mark: '淵', story: '정군산 전투', reward: { randomT: [[4, 3]], cons: { rankUp: 1 } } },
    { round: 85, name: '방덕', mark: '德', story: '번성 전투', reward: { tickets: [[5, 2]] } },
    { round: 95, name: '맹획', mark: '獲', story: '칠종칠금', reward: { randomT: [[5, 2]], gold: 1200 } },
    { round: 105, name: '왕쌍', mark: '雙', story: '진창 전투', reward: { tickets: [[6, 1]], cons: { generalSwap: 1 } } },
    { round: 115, name: '종회', mark: '會', story: '성도의 변', reward: { randomT: [[6, 2]], gold: 1800 } },
  ];

  // 보스 토벌 보상. tickets의 첫 항목이 빠른 클리어 보상의 기준 등급이다.
  // 재등장 대기: 초반 중간보스 5분에서 하나마다 30초씩 늘어 마지막(종회) 12분
  midbosses.forEach((m, i) => (m.respawn = Math.min(720, 300 + 30 * i)));
  const bossRewards = {
    10: { tickets: [[2, 2]], gold: 150 }, 25: { tickets: [[3, 1], [2, 2]], gold: 300 },
    40: { tickets: [[3, 2], [2, 1]], gold: 500 }, 55: { tickets: [[4, 1]], gold: 800, chest: 1 },
    70: { tickets: [[5, 1]], gold: 1200, chest: 1 }, 80: { tickets: [[5, 1]], gold: 1600, chest: 1 },
    // 후반 보스 선택권은 줄였다(조합 아이템보다 선택권이 남아돌아서, 2026-11-07)
    90: { tickets: [[5, 2]], gold: 2000, chest: 2 }, 100: { tickets: [[6, 1]], gold: 2600, chest: 2 },
    110: { tickets: [[6, 2]], gold: 3200, chest: 1 }, 120: { gold: 5000 },
  };
  const fastClearRemain = 0.35; // 남은 시간 비율이 이 이상이면 빠른 클리어

  // SD 외형: [무기, 머리, 수염, 피부, 머리색, 여성]. 무기는 평타 이펙트와 소리도 결정한다.
  const G = '#8a8a88', W = '#e8e4da', B = '#6b3a1e';
  const looks = {
    cav: ['lance', 'helm'], shd: ['shield', 'guard'], arc: ['bow', 'bare'], swd: ['sword', 'guard'], spr: ['spear', 'helm'],
    yujin: ['sword', 'helm', 'short'], akjin: ['spear', 'guard'], juchang: ['guandao', 'bare', 'full', 'k'], jutae: ['sword', 'guard'], neungtong: ['twin', 'bare'], hwawoong: ['guandao', 'helm', 'full'],
    hayeon: ['bow', 'helm', 'short'], janghap: ['spear', 'helm'], wiyeon: ['guandao', 'helm', 'short', 'r'], hwanggae: ['flame', 'helm', 'white', null, W], munchu: ['spear', 'helm', 'full'], anryang: ['guandao', 'helm', 'short'],
    seohwang: ['axe', 'helm', 'short'], gamnyeong: ['twin', 'feather', 'short'], jeonwi: ['twin', 'bare', 'full', 'k'], heojeo: ['mace', 'bare', 'short'], hwangchung: ['bow', 'helm', 'white', null, W], taesaja: ['twin', 'helm', 'short'], gongson: ['lance', 'helm'],
    hadon: ['spear', 'helm', 'short'], madae: ['guandao', 'helm', 'short'], nosuk: ['scroll', 'scholar', 'short'], wonso: ['sword', 'crown', 'long'],
    jangryo: ['halberd', 'helm', 'short'], ganguy: ['spear', 'helm'], yeomong: ['sword', 'scholar'],
    sunyu: ['scroll', 'scholar', 'short'], gahu: ['fan', 'scholar', 'long'], munang: ['spear', 'helm'], deungae: ['spear', 'helm', 'short'], seoseo: ['sword', 'scholar'], gwanpyeong: ['guandao', 'bare'], jeongbo: ['spear', 'helm', 'white', null, W], jegalgeun: ['scroll', 'scholar', 'long'], janggak: ['thunder', 'turban', 'long'], maenghoek: ['mace', 'fur', 'full', 'k'],
    sunuk: ['scroll', 'scholar', 'short'], hwangwol: ['crossbow', 'bun', null, 'p', B, 1], bangtong: ['flame', 'scholar', 'short', 'k'], songyeon: ['sword', 'helm', 'short'], sonhyang: ['bow', 'bun', null, 'p', B, 1], yeoryeong: ['halberd', 'feather', null, 'p', '#3a1c2a', 1], chugyung: ['dagger', 'fur', null, 'k', '#3a1c14', 1],
    gwakga: ['staff', 'scholar'], join: ['sword', 'helm', 'short'], jangbi: ['serpent', 'bare', 'full', 'k'], joun: ['spear', 'helm'], macho: ['lance', 'feather'], sonchaek: ['spear', 'feather'], yukson: ['flame', 'scholar'], dongtak: ['sword', 'crown', 'full', 'r'],
    jojo: ['sword', 'crown', 'short'], samaui: ['staff', 'scholar', 'long'], yubi: ['twin', 'crown', 'short'], gwanu: ['guandao', 'guard', 'long', 'r'], jegal: ['fan', 'scholar', 'long'], songwon: ['sword', 'crown', 'long', null, B], juyu: ['flame', 'scholar'], yeopo: ['halberd', 'feather'],
    choseon: ['ribbon', 'bun', null, 'p', '#2a1c14', 1], hwata: ['needle', 'hood', 'white', null, W], samahwi: ['fan', 'hood', 'white', null, W], jwaja: ['staff', 'hood', 'white', null, W], ganong: ['fan', 'scholar', 'short'], songeon: ['scroll', 'scholar', 'long'], chaemunhui: ['lute', 'bun', null, 'p', '#2a1c14', 1],
    mijuk: ['scroll', 'scholar', 'short'], jingung: ['sword', 'scholar', 'long'], ugil: ['staff', 'hood', 'white', null, W], gyeonhui: ['ribbon', 'bun', null, 'p', '#1c1410', 1], daegyo: ['fan', 'bun', null, 'p', '#2a1c14', 1], sogyo: ['lute', 'bun', null, 'p', '#2a1c14', 1],
  };
  const midLooks = { 정원지: 'janggak', 장량: 'janggak', 안량: 'anryang', 문추: 'munchu', 하후돈: 'hadon', 하후연: 'hayeon', 맹획: 'maenghoek', 방덕: 'macho', 종회: 'deungae', 왕쌍: 'hwawoong', 채모: 'hwanggae', 이각: 'hwawoong', 곽사: 'anryang', 서영: 'hadon', 장양: 'sunuk' };
  // ---- 신화·불멸 체험(2026-11-25 사용자 결정, production/team/2026-11-25/trial-mode.md) ----
  // 상점 > 장수 해금의 잠긴 장수 카드 「체험」: 그 장수 1명이 더미 보스 마속과 60초 보스전. 보상·기록·서버 통신 없음. 횟수 무제한·광고 없음.
  // upLv: 체험 장수 강화 단계(화면에 「강화 10단계 기준」으로 적는다), killT·uptime: 마속 체력 공식(체력 = 등급 공격력 × 강화 배율 × (1+보스 피해 특성) × uptime × killT),
  // hitPct: 마속 공격력 = 그 장수 등급 체력 × hitPct, limit: 보스전 시간(초)
  // hpx: 장수별 마속 체력 보정(tests/balance/trial-calib.js, 자동 조작 처치 약 24초에 맞춤. 사람은 더 느리므로 60초 안에 여유). 공식은 평타 기준이라 스킬 배율이 큰 장수는 보정 없이 2~15초에 끝났다.
  const trial = { upLv: 10, killT: 30, uptime: 0.6, hitPct: 0.03, limit: 60,
    hpx: { gwakga: 3.4, join: 1.5, sunuk: 3.2, jangbi: 1.7, joun: 4, macho: 5.3, sonchaek: 3.2, yukson: 4.2, dongtak: 3.3, choseon: 1.6, jojo: 3.4, samaui: 3.9, yubi: 2.9, gwanu: 6, jegal: 6.5, songwon: 2.5, juyu: 7.5, taesaja: 6.2, janggak: 2.8, yeopo: 6.3 } };
  // 체험 보스(bosses 배열에 넣지 않는다: 넣으면 bossByRound에 잡혀 일반 판에 나온다). 기믹(phases) 없음, 아주 느림, 기존 장판 그림만.
  // pace: 장판 예고 시간 배율(1보다 크면 길게). lines: 체력 문턱에서 배너 한 줄(at = 남은 체력 비율). 문구는 i18n.js tb_* 열쇠로 4개 언어.
  const trialBoss = { round: 0, id: 'b_masok', name: '마속', mark: '謖', title: '산정의 병법가', place: '가정', fx: '#c8a86a', reqDps: 1, hitTier: 9, time: 60, def: 0, speed: 60, pace: 1.5,
    arena: { sky: '#8a9ab0', ground: '#9a8460', motif: 'cliff' }, line: '병법에 이르길, 높은 곳에 오르면 반드시 이긴다 하였소!',
    patterns: [{ n: '고지 선점', gen: 'rain', vis: 'rock', p: { n: 3, r: 90 } }, { n: '병법서 낭독', gen: 'fan', vis: 'talisman', p: { n: 3 } }],
    lines: [{ at: 0.7, k: 'tb_l70' }, { at: 0.3, k: 'tb_l30' }] };
  const bossLooks = { b_masok: 'masok', b_janggak: 'janggak', b_hwawoong: 'hwawoong', b_dongtak: 'dongtak', b_wonso: 'wonso', b_yeopo: 'yeopo', b_jojo: 'jojo', b_yukson: 'yukson', b_jegal: 'jegal', b_deungae: 'deungae', b_samaui: 'samaui' };

  // 인연 시너지 v0.3(2026-11-19, production/team/2026-11-19/synergy-v03-design.md): 단계형. 판 위의 서로 다른 구성원 수(명사 포함)로 단계를 센다.
  // tiers[]: n 필요 인원, g 등급(1 하·2 중·3 상·4 극), lane 라인 효과(구성원 유닛에. only가 있으면 그 장수만, per는 장수별 추가),
  //   boss 보스전 효과(출전한 구성원 중 칸 번호가 가장 앞선 장수 = 주장 한 명에게만): stat 상시 수치, rules 트리거→행동(synergy.js). 단계 설명 문구는 i18n.js synTierText가 이 데이터에서 4개 언어로 만든다.
  //   core: 시그니처 중심 장수(없으면 단계 0, 보스전 효과는 core만, needCore: false 단계는 core 없이도). g 5 = 극+(신화·불멸 4명 이상)
  // 보스전 효과는 라인 중간보스에 걸리지 않는다(synergy.js는 보스전 함수에서만 읽는다). 보스전 효과에는 난수가 없다.
  // 사용자 결정(2026-11-19): 계승 규칙은 넣지 않는다. 남만왕 부부는 남긴다.
  const synergies = [
    { id: 'peach', name: '도원결의', units: ['yubi', 'gwanu', 'jangbi'], desc: '형제가 곁에 나타나 함께 베고, 보스전마다 한 번 쓰러져도 다시 일어난다.',
      tiers: [
        { n: 2, g: 3, lane: { atk: 0.1 },
          boss: { stat: { bdmg: 0.15, revive: { pct: 0.3, inv: 2 } }, rules: [{ on: 'timer', every: 6, do: [{ k: 'volley', m: 4, pos: 'side', look: 'skill' }] }] } },
        { n: 3, g: 4, lane: { atk: 0.2 },
          boss: { stat: { bdmg: 0.25, revive: { pct: 0.5, inv: 3, buff: { bdmg: 0.5, dur: 10 } } }, rules: [{ on: 'timer', every: 5, do: [{ k: 'volley', m: 4, pos: 'side', look: 'skill' }] }] } },
      ] },
    { id: 'tigers', name: '오호대장군', units: ['hwangchung', 'gwanu', 'jangbi', 'joun', 'macho'], desc: '라인에 남은 오호장군이 결투장 밖에서 보스를 쏜다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.08 },
          boss: { rules: [{ on: 'timer', every: 4, do: [{ k: 'volley', m: 2.4 }] }] } },
        { n: 3, g: 3, lane: { atk: 0.15 },
          boss: { rules: [{ on: 'timer', every: 3.5, lane: 1, do: [{ k: 'volley', m: 2 }, { k: 'samp', v: 0.08, dur: 3 }] }] } },
        { n: 4, g: 4, lane: { atk: 0.25 },
          boss: { rules: [{ on: 'timer', every: 3, lane: 1, do: [{ k: 'volley', m: 2 }, { k: 'samp', v: 0.12, dur: 3 }] }] } },
      ] },
    { id: 'guanfam', name: '관씨 부자', units: ['juchang', 'gwanpyeong', 'gwanu'], desc: '청룡언월참이 아들과 함께 두세 번 몰아친다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.1, per: { gwanpyeong: { auraR: 40 } } },
          boss: { rules: [{ on: 'skill', first: 1, do: [{ k: 'echo', n: 1, pct: 0.6, gap: 0.35 }] }] } },
        { n: 3, g: 2, lane: { atk: 0.2, per: { gwanpyeong: { auraR: 40, auraPct: 0.15 } } },
          boss: { rules: [{ on: 'skill', first: 1, do: [{ k: 'echo', n: 2, pct: 0.6, gap: 0.35, ally: 'gwanpyeong' }] }] } },
      ] },
    { id: 'shuijing', name: '수경문하', units: ['samahwi', 'seoseo', 'bangtong', 'jegal'], desc: '스킬 자리에 수경의 법진이 남아 보스를 계속 깎는다.',
      tiers: [
        { n: 2, g: 1, lane: { splashR: 0.15 },
          boss: { rules: [{ on: 'skill', dmgSkill: 1, do: [{ k: 'field', m: 0.8, dur: 4, max: 2 }] }] } },
        { n: 3, g: 2, lane: { splashR: 0.25, per: { bangtong: { burn: 0.2 } } },
          boss: { rules: [{ on: 'skill', dmgSkill: 1, do: [{ k: 'field', m: 1.3, dur: 4, max: 2 }] }] } },
        { n: 4, g: 2, lane: { splashR: 0.35, per: { bangtong: { burn: 0.3 } } },
          boss: { rules: [{ on: 'skill', inField: 1, do: [{ k: 'refund', s: 1, which: 'others' }] }, { on: 'skill', dmgSkill: 1, do: [{ k: 'field', m: 1.8, dur: 4, max: 2 }] }] } },
      ] },
    { id: 'redcliff', name: '적벽대전', units: ['hwanggae', 'nosuk', 'bangtong', 'juyu', 'yukson'], desc: '황개의 화선이 보스를 들이받는다. 주유·육손이 모두 있으면 화선이 겹친다.',
      tiers: [
        { n: 3, g: 1, lane: { burn: 0.2, per: { hwanggae: { grantBurn: 0.3 } } }, boss: { rules: [{ on: 'timer', every: 9, do: [{ k: 'ship', m: 5, n: 1 }] }] } },
        { n: 4, g: 2, lane: { burn: 0.3, per: { hwanggae: { grantBurn: 0.3 } } }, boss: { rules: [{ on: 'timer', every: 7, do: [{ k: 'ship', m: 7, n: 1 }] }] } },
        { n: 5, g: 3, lane: { burn: 0.4, burnSlow: 0.1, per: { hwanggae: { grantBurn: 0.3 } } }, boss: { stat: { burnAmp: 0.2 }, rules: [{ on: 'timer', every: 6, do: [{ k: 'ship', m: 5, n: 2 }] }] } },
      ] },
    { id: 'chushi', name: '출사표', units: ['wiyeon', 'madae', 'ganguy', 'joun', 'jegal'], desc: '오래 싸울수록 북벌의 기세가 쌓인다.',
      tiers: [
        { n: 3, g: 1, lane: { haste: 0.08 },
          boss: { rules: [{ on: 'timer', every: 10, do: [{ k: 'stack', key: 'chushi', add: 1, max: 5, per: { bdmg: 0.03 }, vx: 'power' }] }] } },
        { n: 4, g: 2, lane: { haste: 0.12 },
          boss: { rules: [{ on: 'timer', every: 10, do: [{ k: 'stack', key: 'chushi', add: 1, max: 5, per: { bdmg: 0.05 }, vx: 'power' }] }, { on: 'timer', every: 15, atMax: 'chushi', do: [{ k: 'dmg', m: 4, ids: ['ganguy'], look: 'skill' }] }] } },
        { n: 5, g: 3, lane: { haste: 0.18 },
          boss: { rules: [{ on: 'timer', every: 8, do: [{ k: 'stack', key: 'chushi', add: 1, max: 6, per: { bdmg: 0.06 }, vx: 'power' }] }, { on: 'timer', every: 20, atMax: 'chushi', do: [{ k: 'nextSkill', x: 1, win: 20 }] }] } },
      ] },
    { id: 'wuzhang', name: '오장원', units: ['wiyeon', 'janghap', 'ganguy', 'samaui', 'jegal'], desc: '큰 공격을 피하면 반격 계책이 터진다. 와룡과 총달이 함께면 칠성등이 목숨을 잇는다.',
      tiers: [
        { n: 3, g: 1, lane: { range: 0.1 },
          boss: { stat: { guard: 0.1 }, rules: [{ on: 'bigDodge', do: [{ k: 'nextSkill', x: 1, win: 8 }] }] } },
        { n: 5, g: 4, lane: { range: 0.2 },
          boss: { stat: { guard: 0.15, revive: { pct: 0.6, delay: 4, inv: 1 } }, rules: [{ on: 'bigDodge', do: [{ k: 'nextSkill', x: 2, win: 8 }, { k: 'samp', v: 0.15, dur: 6 }] }] } },
      ] },
    { id: 'changban', name: '장판파', units: ['ganong', 'mijuk', 'jangbi', 'joun', 'yubi'], desc: '대시로 파고들 때마다 강해진다. 장비가 있으면 장판교에서 일갈한다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.08 },
          boss: { stat: { dashCdr: 0.3 }, rules: [{ on: 'dash', do: [{ k: 'buff', stat: 'bdmg', v: 0.4, dur: 3, vx: 'wind' }] }] } },
        { n: 3, g: 2, lane: { atk: 0.12 },
          boss: { stat: { dashCdr: 0.4 }, rules: [{ on: 'dash', do: [{ k: 'buff', stat: 'bdmg', v: 0.5, dur: 3, vx: 'wind' }] }, { on: 'dashGraze', do: [{ k: 'refund', s: 2, which: 'all' }] }] } },
        { n: 4, g: 3, lane: { atk: 0.18 },
          boss: { stat: { dashCdr: 0.4 }, rules: [{ on: 'dash', do: [{ k: 'buff', stat: 'bdmg', v: 0.5, dur: 3, vx: 'wind' }] }, { on: 'dashGraze', do: [{ k: 'refund', s: 2, which: 'all' }] },
            { on: 'timer', every: 20, need: ['jangbi', 'yubi'], do: [{ k: 'cameo', ids: ['jangbi', 'yubi'], vx: 'roar', at: 'boss' }, { k: 'weaken', v: 0.2, dur: 5 }, { k: 'samp', v: 0.15, dur: 5 }] }] } },
      ] },
    { id: 'rushu', name: '입촉', units: ['wiyeon', 'hwangchung', 'bangtong', 'macho'], desc: '스킬을 쓸 때마다 서천의 장수들이 함께 쏜다.',
      tiers: [
        { n: 3, g: 1, lane: { atk: 0.08 }, boss: { rules: [{ on: 'skill', lane: 1, do: [{ k: 'volley', m: 1.5, n: 2 }] }] } },
        { n: 4, g: 2, lane: { atk: 0.12 }, boss: { rules: [{ on: 'skill', lane: 1, do: [{ k: 'volley', m: 2, n: 3 }] }, { on: 'skill', lane: 1, nth: 3, do: [{ k: 'dmg', m: 4, ids: ['macho'], look: 'charge' }] }] } },
      ] },
    { id: 'renshu', name: '인술', units: ['hwata', 'hwangwol', 'janggak'], desc: '넘치는 치료가 보호막이 되고, 건강할수록 세게 친다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.08 }, boss: { rules: [{ on: 'heal', do: [{ k: 'shield', over: 1, cap: 0.25, dur: 8 }] }] } },
        { n: 3, g: 2, lane: { atk: 0.12 }, boss: { stat: { highHp: { th: 0.7, bdmg: 0.2 } }, rules: [{ on: 'heal', do: [{ k: 'shield', over: 1, cap: 0.35, dur: 8 }] }] } },
      ] },
    { id: 'jin', name: '진의 기틀', units: ['janghap', 'deungae', 'samaui'], desc: '때릴수록 표식이 쌓이고, 다 차면 터진다.',
      tiers: [
        { n: 2, g: 1, lane: { pierce: 0.15 },
          boss: { rules: [{ on: 'anyHit', do: [{ k: 'stack', key: 'jin', add: 1, max: 8, mark: '#c89aff' }] }, { on: 'stackMax', key: 'jin', do: [{ k: 'dmg', m: 4, anim: 'boom2', col: '#c89aff' }, { k: 'stackReset', key: 'jin' }] }] } },
        { n: 3, g: 2, lane: { pierce: 0.25 },
          boss: { rules: [{ on: 'anyHit', do: [{ k: 'stack', key: 'jin', add: 1, max: 6, mark: '#c89aff' }] }, { on: 'stackMax', key: 'jin', do: [{ k: 'dmg', m: 6, anim: 'boom2', col: '#c89aff' }, { k: 'samp', v: 0.1, dur: 4 }, { k: 'stackReset', key: 'jin' }] }] } },
      ] },
    { id: 'weimou', name: '위의 모신', units: ['sunyu', 'gahu', 'gwakga', 'sunuk', 'samaui'], desc: '모사들의 계책으로 보스가 받는 피해가 늘고 다음 공격이 늦어진다.',
      tiers: [
        { n: 3, g: 2, lane: { atk: 0.08, per: { gahu: { burn: 0.2 } } },
          boss: { rules: [{ on: 'skill', do: [{ k: 'samp', v: 0.2, dur: 5, vx: 'curse' }] }] } },
        { n: 4, g: 3, lane: { atk: 0.12, per: { gahu: { burn: 0.2 } } },
          boss: { rules: [{ on: 'skill', do: [{ k: 'samp', v: 0.28, dur: 6, vx: 'curse' }] }, { on: 'skill', cd: 12, do: [{ k: 'delay', v: 0.8, vx: 'scheme' }] }] } },
        { n: 5, g: 4, lane: { atk: 0.18, per: { gahu: { burn: 0.2 } } },
          boss: { rules: [{ on: 'skill', do: [{ k: 'samp', v: 0.4, dur: 6, vx: 'curse' }] }, { on: 'skill', cd: 10, do: [{ k: 'delay', v: 1.2, vx: 'scheme' }] }] } },
      ] },
    { id: 'wancheng', name: '호치와 악래', units: ['heojeo', 'jeonwi', 'jojo'], desc: '호위 무사가 곁에 서서 같이 싸우고 공격을 막는다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.1, splashR: 0.2 },
          boss: { rules: [{ on: 'start', do: [{ k: 'ally', dur: 8, m: 1.4, n: 1, guard: 0.15 }] }, { on: 'timer', every: 20, do: [{ k: 'ally', dur: 8, m: 1.4, n: 1, guard: 0.15 }] }] } },
        { n: 3, g: 2, lane: { atk: 0.2, splashR: 0.2 },
          boss: { rules: [{ on: 'start', do: [{ k: 'ally', dur: 10, m: 1.2, n: 2, guard: 0.25 }] }, { on: 'timer', every: 15, do: [{ k: 'ally', dur: 10, m: 1.2, n: 2, guard: 0.25 }] }] } },
      ] },
    { id: 'wenji', name: '문희귀한', units: ['chaemunhui', 'jojo', 'sunuk'], desc: '호가십팔박의 노래가 군을 북돋운다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.1, only: ['jojo', 'sunuk'] }, boss: { rules: [{ on: 'timer', every: 15, do: [{ k: 'cameo', ids: ['chaemunhui'], vx: 'rally' }, { k: 'refund', s: 2, which: 'all' }, { k: 'rally', v: 0.15, dur: 6 }] }] } },
        { n: 3, g: 3, lane: { atk: 0.15, only: ['jojo', 'sunuk'] }, boss: { rules: [{ on: 'timer', every: 12, do: [{ k: 'cameo', ids: ['chaemunhui'], vx: 'rally' }, { k: 'refund', s: 3, which: 'all' }, { k: 'rally', v: 0.2, dur: 6 }, { k: 'samp', v: 0.1, dur: 6 }] }] } },
      ] },
    { id: 'zongqin', name: '조씨·하후씨 종친', units: ['hayeon', 'hadon', 'join', 'jojo'], desc: '일족이 지키는 주장은 몰릴수록 강해진다.',
      tiers: [
        { n: 3, g: 1, lane: { atk: 0.1 },
          boss: { stat: { hpPct: 0.2, guard: 0.1, lowHp: { th: 0.5, bdmg: 0.2 } } } },
        { n: 4, g: 3, lane: { atk: 0.2 },
          boss: { stat: { hpPct: 0.35, guard: 0.15, lowHp: { th: 0.5, bdmg: 0.35 }, endure: { n: 1, inv: 3, negate: 1, vx: 'barrier' } } } },
      ] },
    // 사용자 결정(2026-11-19, 확장 문서 1-5절): 손씨 삼대 2 중 / 3 상 / 4 극(악몽 후반 신화·불멸을 여럿 모은 판의 보상)
    { id: 'sonfamily', name: '손씨 삼대', units: ['songyeon', 'sonhyang', 'sonchaek', 'songwon'], desc: '치명이 터질수록 손가의 기세가 빨라진다.',
      tiers: [
        { n: 2, g: 2, lane: { atk: 0.1 }, boss: { rules: [{ on: 'crit', do: [{ k: 'stack', key: 'tiger', add: 1, max: 10, dur: 5, per: { haste: 0.03 } }] }, { on: 'skillHit', do: [{ k: 'stack', key: 'tiger', add: 1, max: 10, dur: 5, per: { haste: 0.03 } }] }] } },
        { n: 3, g: 3, lane: { atk: 0.15 }, boss: { stat: { bdmg: 0.1 }, rules: [{ on: 'crit', do: [{ k: 'stack', key: 'tiger', add: 1, max: 10, dur: 5, per: { haste: 0.035 } }] }, { on: 'skillHit', do: [{ k: 'stack', key: 'tiger', add: 1, max: 10, dur: 5, per: { haste: 0.035 } }] },
          { on: 'stackMax', key: 'tiger', cd: 10, do: [{ k: 'dmg', m: 4, ids: ['sonhyang'], look: 'skill' }] }] } },
        { n: 4, g: 4, lane: { atk: 0.2 }, boss: { stat: { bdmg: 0.15, endure: { n: 1, inv: 2 } }, rules: [{ on: 'crit', do: [{ k: 'stack', key: 'tiger', add: 1, max: 10, dur: 5, per: { haste: 0.04 } }] }, { on: 'skillHit', do: [{ k: 'stack', key: 'tiger', add: 1, max: 10, dur: 5, per: { haste: 0.04 } }] },
          { on: 'stackMax', key: 'tiger', cd: 8, do: [{ k: 'dmg', m: 5, ids: ['sonhyang'], look: 'skill' }] }, { on: 'stackMax', key: 'tiger', cd: 18, do: [{ k: 'cameo', ids: ['songyeon'], vx: 'rally' }, { k: 'rally', v: 0.2, dur: 6 }] }] } },
      ] },
    { id: 'shenting', name: '신정의 결투', units: ['sonchaek', 'taesaja'], desc: '평생의 맞수가 결투장 건너편에서 함께 싸운다.',
      tiers: [
        { n: 2, g: 3, lane: { crit: { ch: 0.1, mult: 2 } },
          boss: { stat: { crit: [{ ch: 0.1, mult: 2 }], pairBdmg: 0.2 }, rules: [{ on: 'timer', every: 1, lane: 1, do: [{ k: 'volley', m: 1.4, pos: 'far' }] }] } },
      ] },
    { id: 'erqiao', name: '강동이교', units: ['daegyo', 'sogyo', 'sonchaek', 'juyu'], desc: '이교의 노래가 스킬을 키운다. 손책과 주유가 함께면 단금지교로 이어 친다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.1, only: ['sonchaek', 'juyu'] },
          boss: { stat: { skillAmp: 0.2, regen: 0.008 } } },
        { n: 3, g: 2, lane: { atk: 0.15, only: ['sonchaek', 'juyu'] },
          boss: { stat: { skillAmp: 0.3, regen: 0.008 }, rules: [{ on: 'skill', do: [{ k: 'shield', pct: 0.1, dur: 6 }] }] } },
        { n: 4, g: 3, lane: { atk: 0.2, only: ['sonchaek', 'juyu'] },
          boss: { stat: { skillAmp: 0.35, regen: 0.008 }, rules: [{ on: 'skill', do: [{ k: 'shield', pct: 0.1, dur: 6 }] }, { on: 'skillHit', cd: 8, do: [{ k: 'dmg', m: 4, ids: ['juyu', 'sonchaek'], partner: 1, look: 'skill', delay: 0.5 }] }] } },
      ] },
    { id: 'wududu', name: '동오 대도독', units: ['nosuk', 'yeomong', 'yukson', 'juyu', 'songwon'], desc: '대도독이 차례로 지휘한다. 오왕이 함께면 넷이 한꺼번에.',
      tiers: [
        { n: 3, g: 1, lane: { atk: 0.1 },
          boss: { stat: { rotate: { every: 20, ids: ['nosuk', 'yeomong', 'yukson', 'juyu'], list: [{ guard: 0.15 }, { crit: [{ ch: 0.15, mult: 2 }] }, { skillAmp: 0.25 }, { bdmg: 0.12 }] } } } },
        { n: 4, g: 3, lane: { atk: 0.15, burn: 0.2 },
          boss: { stat: { rotate: { every: 20, ids: ['nosuk', 'yeomong', 'yukson', 'juyu'], list: [{ guard: 0.25 }, { crit: [{ ch: 0.25, mult: 2 }] }, { skillAmp: 0.45 }, { bdmg: 0.25 }] } } } },
        { n: 5, g: 4, lane: { atk: 0.2, burn: 0.3 },
          boss: { stat: { guard: 0.25, crit: [{ ch: 0.25, mult: 2 }], skillAmp: 0.45, bdmg: 0.25 } } },
      ] },
    { id: 'hefei', name: '합비 공방', units: ['neungtong', 'gamnyeong', 'jangryo', 'yeomong', 'songwon'], desc: '감녕의 백기가 야습해 보스를 흔든다.',
      tiers: [
        { n: 3, g: 1, lane: { haste: 0.1 },
          boss: { rules: [{ on: 'timer', every: 25, do: [{ k: 'riders', n: 5, m: 2, ids: ['gamnyeong', 'neungtong'] }, { k: 'delay', v: 1 }] }] } },
        { n: 5, g: 2, lane: { haste: 0.2 },
          boss: { rules: [{ on: 'timer', every: 18, do: [{ k: 'riders', n: 5, m: 2.5, ids: ['gamnyeong', 'neungtong'] }, { k: 'delay', v: 1.5 }, { k: 'shield', pct: 0.2, dur: 8 }, { k: 'weaken', v: 0.15, dur: 6 }] }] } },
      ] },
    { id: 'father', name: '비장의 피', units: ['yeoryeong', 'yeopo', 'dongtak'], desc: '치명이 터질 때마다 딸이 뒤를 찌른다. 양부까지 함께면 더 매섭다.',
      tiers: [
        { n: 2, g: 2, lane: { crit: { ch: 0.1, mult: 2 } }, boss: { stat: { crit: [{ ch: 0.1, mult: 2 }] }, rules: [{ on: 'crit', cd: 0.5, do: [{ k: 'dmg', m: 1, ids: ['yeoryeong'], pos: 'behind' }] }] } },
        { n: 3, g: 3, lane: { crit: { ch: 0.1, mult: 2 } }, boss: { stat: { crit: [{ ch: 0.15, mult: 2 }], hpPct: 0.2 }, rules: [{ on: 'crit', cd: 0.4, do: [{ k: 'dmg', m: 1.3, ids: ['yeoryeong'], pos: 'behind' }] }] } },
      ] },
    { id: 'chain', name: '연환지계', units: ['hwawoong', 'gahu', 'choseon', 'dongtak', 'yeopo'], desc: '보스가 공격할 때마다 사슬이 감기고, 다 감기면 끊어 터뜨린다.',
      tiers: [
        { n: 2, g: 1, lane: { fieldSlow: 0.03, atk: 0.08 },
          boss: { rules: [{ on: 'pattern', do: [{ k: 'stack', key: 'chain', add: 1, max: 5, per: { bdmg: 0.03 }, mark: '#ff6a5a' }] }] } },
        { n: 3, g: 2, lane: { fieldSlow: 0.05, atk: 0.12 },
          boss: { rules: [{ on: 'pattern', do: [{ k: 'stack', key: 'chain', add: 1, max: 5, per: { bdmg: 0.04 }, mark: '#ff6a5a' }] }, { on: 'hitN', n: 1, atMax: 'chain', do: [{ k: 'dmg', m: 5, vx: 'storm', anim: 'boom' }, { k: 'stackReset', key: 'chain' }] }] } },
        { n: 4, g: 3, lane: { fieldSlow: 0.07, atk: 0.15 },
          boss: { rules: [{ on: 'pattern', do: [{ k: 'stack', key: 'chain', add: 1, max: 5, per: { bdmg: 0.05 }, mark: '#ff6a5a' }] }, { on: 'hitN', n: 1, atMax: 'chain', do: [{ k: 'dmg', m: 6, vx: 'storm', anim: 'boom', stun: 1 }, { k: 'stackReset', key: 'chain' }] }] } },
        { n: 5, g: 4, lane: { fieldSlow: 0.1, atk: 0.2 },
          boss: { rules: [{ on: 'pattern', do: [{ k: 'stack', key: 'chain', add: 1, max: 5, per: { bdmg: 0.06 }, mark: '#ff6a5a' }] }, { on: 'hitN', n: 1, atMax: 'chain', do: [{ k: 'dmg', m: 10, vx: 'storm', anim: 'boom', stun: 1.5 }, { k: 'cameo', ids: ['choseon'], vx: 'hearts', at: 'boss' }, { k: 'samp', v: 0.15, dur: 5 }, { k: 'stackReset', key: 'chain' }] }] } },
      ] },
    { id: 'xiapi', name: '하비의 책사', units: ['jingung', 'jangryo', 'yeopo', 'gwakga', 'choseon'], desc: '대시하면 장료가 함께 돌진한다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.1, per: { jangryo: { slowAdd: 0.1 } } }, boss: { stat: { dashCdr: 0.3 }, rules: [{ on: 'dash', do: [{ k: 'dashHit', m: 4, ids: ['jangryo'] }] }] } },
        { n: 3, g: 2, lane: { atk: 0.15, per: { jangryo: { slowAdd: 0.1 } } }, boss: { stat: { dashCdr: 0.4 }, rules: [{ on: 'dash', do: [{ k: 'dashHit', m: 6, ids: ['jangryo'] }, { k: 'buff', stat: 'guard', v: 0.3, dur: 2 }] }] } },
        { n: 4, g: 3, lane: { atk: 0.15, per: { jangryo: { slowAdd: 0.1 } } }, boss: { stat: { dashCdr: 0.4 }, rules: [{ on: 'dash', do: [{ k: 'dashHit', m: 7, ids: ['jangryo'] }, { k: 'buff', stat: 'guard', v: 0.3, dur: 2 }] }, { on: 'timer', every: 20, do: [{ k: 'delay', v: 1.5, vx: 'scheme' }, { k: 'samp', v: 0.1, dur: 4 }] }] } },
        { n: 5, g: 4, lane: { atk: 0.15, per: { jangryo: { slowAdd: 0.1 } } }, boss: { stat: { dashCdr: 0.4 }, rules: [{ on: 'dash', do: [{ k: 'dashHit', m: 8, ids: ['jangryo'] }, { k: 'buff', stat: 'guard', v: 0.3, dur: 2 }, { k: 'weaken', v: 0.15, dur: 3 }, { k: 'samp', v: 0.15, dur: 4 }] }, { on: 'timer', every: 20, do: [{ k: 'delay', v: 1.5, vx: 'scheme' }, { k: 'samp', v: 0.1, dur: 4 }] }] } },
      ] },
    { id: 'archers', name: '백보천양', units: ['hayeon', 'hwangchung', 'sonhyang', 'hwangwol', 'taesaja'], desc: '활 쏘는 장수가 모일수록 화살이 쏟아진다.',
      tiers: [
        { n: 3, g: 1, lane: { range: 0.15 },
          boss: { rules: [{ on: 'hitN', n: 4, do: [{ k: 'dmgHit', n: 2, pct: 0.6 }] }] } },
        { n: 4, g: 2, lane: { range: 0.25 },
          boss: { rules: [{ on: 'hitN', n: 3, do: [{ k: 'dmgHit', n: 3, pct: 0.5 }] }] } },
        { n: 5, g: 3, lane: { range: 0.3, multi: 1 },
          boss: { rules: [{ on: 'hitN', n: 3, do: [{ k: 'dmgHit', n: 3, pct: 0.5 }] }, { on: 'timer', every: 5, do: [{ k: 'volley', m: 1 }] }] } },
      ] },
    { id: 'zhongyi', name: '충의', units: ['jutae', 'jeonwi', 'join', 'taesaja'], desc: '몰릴수록 버티고 더 세게 친다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.08 }, boss: { stat: { lowHp: { th: 0.35, guard: 0.25, bdmg: 0.25 } } } },
        { n: 3, g: 2, lane: { atk: 0.12 }, boss: { stat: { lowHp: { th: 0.35, guard: 0.25, bdmg: 0.25 }, endure: { n: 1, inv: 3, buff: { bdmg: 0.5, dur: 10 } } } } },
        { n: 4, g: 3, lane: { atk: 0.18 }, boss: { stat: { lowHp: { th: 0.35, guard: 0.3, bdmg: 0.4 }, endure: { n: 2, inv: 3, buff: { bdmg: 0.5, dur: 10 } } } } },
      ] },
    { id: 'taiping', name: '태평도', units: ['jwaja', 'ugil', 'janggak'], desc: '도술로 낙뢰를 부른다. 치료할 때도 벼락이 친다.',
      tiers: [
        { n: 2, g: 1, lane: { per: { janggak: { multi: 1 } } },
          boss: { rules: [{ on: 'hitN', n: 5, do: [{ k: 'dmg', m: 3.5, vx: 'lightning', anim: 'bolt' }] }] } },
        { n: 3, g: 2, lane: { per: { janggak: { multi: 2 } } },
          boss: { rules: [{ on: 'hitN', n: 4, do: [{ k: 'dmg', m: 3.5, vx: 'lightning', anim: 'bolt' }] }, { on: 'skill', skillK: 'heal', do: [{ k: 'dmg', m: 2, vx: 'lightning', anim: 'bolt' }, { k: 'dmg', m: 2, vx: 'lightning', anim: 'bolt', delay: 0.25 }, { k: 'dmg', m: 2, vx: 'lightning', anim: 'bolt', delay: 0.5 }] }] } },
      ] },
    { id: 'huangjin', core: 'janggak', name: '황건 봉기', units: ['cav', 'shd', 'arc', 'swd', 'spr', 'janggak', 'dongtak'], desc: '1성 다섯 종을 남겨 두면 황건이 일어선다. 동탁마저 있으면 황천의 기세가 하늘을 덮는다.',
      tiers: [
        { n: 3, g: 1, needCore: false, lane: { atk: 0.3, only: ['cav', 'shd', 'arc', 'swd', 'spr'] } },
        { n: 5, g: 1, needCore: false, lane: { atk: 0.6, haste: 0.15, only: ['cav', 'shd', 'arc', 'swd', 'spr'] } },
        { n: 6, g: 1, lane: { atk: 0.6, haste: 0.15, only: ['cav', 'shd', 'arc', 'swd', 'spr'] }, boss: { stat: { healAmp: 0.2 }, rules: [{ on: 'timer', every: 10, do: [{ k: 'riders', n: 5, m: 1, soldier: 1 }] }] } },
        { n: 7, g: 3, lane: { atk: 0.8, haste: 0.2, only: ['cav', 'shd', 'arc', 'swd', 'spr'] }, boss: { stat: { healAmp: 0.3 }, rules: [{ on: 'timer', every: 8, do: [{ k: 'riders', n: 8, m: 1.2, soldier: 1 }, { k: 'samp', v: 0.1, dur: 4 }] }] } },
      ] },
    // 사용자 결정(2026-11-19): 남만왕 부부는 남긴다(확장 문서 L6 형식). 축융의 비도 + 맹획이 맞을수록 반격
    { id: 'nanman', name: '남만왕 부부', units: ['maenghoek', 'chugyung'], desc: '축융의 비도가 날아들고, 맹획은 맞을수록 사납게 되받아친다.',
      tiers: [
        { n: 2, g: 2, lane: { atk: 0.1, per: { chugyung: { burn: 0.3 }, maenghoek: { splashR: 0.2 } } },
          boss: { stat: { hpPct: 0.25 }, rules: [{ on: 'hurt', do: [{ k: 'stack', key: 'nm', add: 1, max: 6, mark: '#e09a4d' }] }, { on: 'stackMax', key: 'nm', do: [{ k: 'dmg', m: 3, ids: ['maenghoek'], look: 'skill' }, { k: 'stackReset', key: 'nm' }] },
            { on: 'hitN', n: 5, do: [{ k: 'dmg', m: 1.5, ids: ['chugyung'], wp: 'dagger' }] }] } },
      ] },
    // ---- 확장(2026-11-19, production/team/2026-11-19/synergy-v03-expansion.md) ----
    // 불멸 시그니처: core 장수가 없으면 단계 0, 보스전 효과는 core가 출전했을 때만
    { id: 'wuguan', core: 'gwanu', name: '오관참장', units: ['hwawoong', 'anryang', 'munchu', 'gwanu', 'jojo'], desc: '베어 넘긴 장수들의 이름을 걸고, 보스가 약해질수록 더 세게 벤다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.08, per: { gwanu: { splashR: 0.1 } } }, boss: { stat: { bossLow: { th: 0.3, bdmg: 0.1 } }, rules: [{ on: 'hitN', n: 8, do: [{ k: 'dmg', m: 2, beam: 'crescent', col: '#4fe0a0' }] }] } },
        { n: 4, g: 2, lane: { atk: 0.12, per: { gwanu: { splashR: 0.2 } } }, boss: { stat: { bossLow: { th: 0.4, bdmg: 0.2 } }, rules: [{ on: 'hitN', n: 6, do: [{ k: 'dmg', m: 3, beam: 'crescent', col: '#4fe0a0' }] }] } },
        { n: 5, g: 3, lane: { atk: 0.18, per: { gwanu: { splashR: 0.3 } } }, boss: { stat: { bossLow: { th: 0.4, bdmg: 0.25 } }, rules: [{ on: 'hitN', n: 5, do: [{ k: 'dmg', m: 3.5, beam: 'crescent', col: '#4fe0a0' }, { k: 'samp', v: 0.1, dur: 3 }] }, { on: 'start', do: [{ k: 'cameo', ids: ['jojo'], vx: 'guard' }, { k: 'shield', pct: 0.2, dur: 10 }] }] } },
      ] },
    { id: 'wolong', core: 'jegal', name: '와룡', units: ['maenghoek', 'jegalgeun', 'hwangwol', 'jegal'], desc: '계책 세 번이 모이면 팔진이 터진다.',
      tiers: [
        { n: 2, g: 1, lane: { range: 0.1 }, boss: { rules: [{ on: 'skill', do: [{ k: 'stack', key: 'wl', add: 1, max: 4, mark: '#a0d8ff' }] }, { on: 'stackMax', key: 'wl', do: [{ k: 'dmg', m: 5, vx: 'rune', col: '#a0d8ff' }, { k: 'stackReset', key: 'wl' }] }] } },
        { n: 3, g: 2, lane: { range: 0.15 }, boss: { rules: [{ on: 'skill', do: [{ k: 'stack', key: 'wl', add: 1, max: 3, mark: '#a0d8ff' }] }, { on: 'stackMax', key: 'wl', do: [{ k: 'dmg', m: 6, vx: 'rune', col: '#a0d8ff', stun: 1 }, { k: 'stackReset', key: 'wl' }] }] } },
        { n: 4, g: 3, lane: { range: 0.2 }, boss: { rules: [{ on: 'skill', do: [{ k: 'stack', key: 'wl', add: 1, max: 3, mark: '#a0d8ff' }] }, { on: 'stackMax', key: 'wl', do: [{ k: 'dmg', m: 8, vx: 'rune', col: '#a0d8ff', stun: 1.5 }, { k: 'samp', v: 0.15, dur: 5 }, { k: 'stackReset', key: 'wl' }] }] } },
      ] },
    { id: 'meizhou', core: 'juyu', name: '미주랑', units: ['neungtong', 'gamnyeong', 'jeongbo', 'yukson', 'juyu'], desc: '곡이 틀리면 돌아보는 주랑 — 화공이 두 번 세 번 몰아친다.',
      tiers: [
        { n: 3, g: 1, lane: { atk: 0.08, burn: 0.1 }, boss: { stat: { burnAmp: 0.2 }, rules: [{ on: 'skill', first: 1, do: [{ k: 'echo', n: 1, pct: 0.4, gap: 0.35 }] }] } },
        { n: 4, g: 2, lane: { atk: 0.12, burn: 0.2 }, boss: { stat: { burnAmp: 0.3 }, rules: [{ on: 'skill', first: 1, do: [{ k: 'echo', n: 1, pct: 0.6, gap: 0.35 }] }] } },
        { n: 5, g: 3, lane: { atk: 0.18, burn: 0.3 }, boss: { stat: { burnAmp: 0.4 }, rules: [{ on: 'skill', first: 1, do: [{ k: 'echo', n: 2, pct: 0.6, gap: 0.35 }] }, { on: 'skillHit', cd: 6, do: [{ k: 'dmg', m: 3, ids: ['yukson'], look: 'skill' }] }] } },
      ] },
    { id: 'sanying', core: 'yeopo', name: '삼영전', units: ['jangbi', 'gwanu', 'yubi', 'yeopo'], desc: '셋이 덤벼도 좋다. 맞수가 많을수록 무쌍이 깨어난다.',
      tiers: [
        { n: 2, g: 3, lane: { atk: 0.1 }, boss: { stat: { bdmg: 0.2 }, rules: [{ on: 'hitN', n: 4, do: [{ k: 'dmg', m: 2, anim: 'hit2' }] }] } },
        { n: 3, g: 4, lane: { atk: 0.15 }, boss: { stat: { bdmg: 0.3 }, rules: [{ on: 'hitN', n: 3, do: [{ k: 'dmg', m: 2.5, anim: 'hit2' }] }, { on: 'start', do: [{ k: 'shield', pct: 0.3, dur: 12 }] }] } },
        { n: 4, g: 5, lane: { atk: 0.2 }, boss: { stat: { bdmg: 0.4, crit: [{ ch: 0.1, mult: 3 }], endure: { n: 1, inv: 2 } }, rules: [{ on: 'hitN', n: 3, do: [{ k: 'dmg', m: 3, anim: 'hit2', vx: 'storm', col: '#ff5a5a' }] }, { on: 'start', do: [{ k: 'shield', pct: 0.3, dur: 12 }] }] } },
      ] },
    { id: 'gaoping', core: 'samaui', name: '고평릉의 변', units: ['gyeonhui', 'hadon', 'jangryo', 'join', 'samaui'], desc: '참고 기다리다 빈틈에 찌른다.',
      tiers: [
        { n: 2, g: 1, lane: { pierce: 0.1 }, boss: { stat: { guard: 0.1 }, rules: [{ on: 'bigDodge', do: [{ k: 'refund', s: 2, which: 'all' }] }] } },
        { n: 4, g: 2, lane: { pierce: 0.15 }, boss: { stat: { guard: 0.1 }, rules: [{ on: 'bigDodge', do: [{ k: 'refund', s: 2, which: 'all' }] }, { on: 'timer', every: 30, do: [{ k: 'delay', v: 2, vx: 'curse' }, { k: 'shield', pct: 0.15, dur: 8 }] }] } },
        { n: 5, g: 3, lane: { pierce: 0.2 }, boss: { stat: { guard: 0.1 }, rules: [{ on: 'bigDodge', do: [{ k: 'refund', s: 2, which: 'all' }, { k: 'dmg', m: 6, vx: 'curse', col: '#b08aff' }, { k: 'samp', v: 0.15, dur: 4 }] }, { on: 'timer', every: 30, do: [{ k: 'delay', v: 2, vx: 'curse' }, { k: 'shield', pct: 0.15, dur: 8 }] }] } },
      ] },
    { id: 'wuzi', core: 'jojo', name: '오자양장', units: ['akjin', 'yujin', 'janghap', 'seohwang', 'jangryo', 'jojo'], desc: '위의 다섯 명장이 라인을 지키고, 보스전에선 주군 곁에 선다.',
      tiers: [
        { n: 3, g: 1, lane: { atk: 0.12, splashR: 0.15 }, boss: { rules: [{ on: 'timer', every: 15, do: [{ k: 'ally', n: 1, dur: 6, m: 1.2 }] }] } },
        { n: 5, g: 2, lane: { atk: 0.2, splashR: 0.25 }, boss: { rules: [{ on: 'timer', every: 15, do: [{ k: 'ally', n: 2, dur: 6, m: 1.2 }] }] } },
        { n: 6, g: 3, lane: { atk: 0.3, splashR: 0.35, per: { jangryo: { slowAdd: 0.1 } } }, boss: { rules: [{ on: 'timer', every: 15, do: [{ k: 'ally', n: 3, dur: 6, m: 1 }, { k: 'rally', v: 0.15, dur: 6 }] }] } },
      ] },
    { id: 'rende', core: 'yubi', name: '인덕의 군주', units: ['songeon', 'juchang', 'gwanpyeong', 'joun', 'yubi'], desc: '치료할 때마다 따르는 이들이 기세를 올린다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.08 }, boss: { rules: [{ on: 'skill', skillK: 'heal', do: [{ k: 'rally', v: 0.12, dur: 6 }] }] } },
        { n: 3, g: 2, lane: { atk: 0.12 }, boss: { rules: [{ on: 'skill', skillK: 'heal', do: [{ k: 'rally', v: 0.18, dur: 6 }, { k: 'refund', s: 2, which: 'others' }] }] } },
        { n: 4, g: 3, lane: { atk: 0.18 }, boss: { rules: [{ on: 'skill', skillK: 'heal', do: [{ k: 'rally', v: 0.18, dur: 6 }, { k: 'refund', s: 2, which: 'others' }, { k: 'pshield', dur: 2 }] }, { on: 'skill', skillK: 'heal', cd: 10, do: [{ k: 'dmg', m: 4, ids: ['joun'], look: 'skill' }] }] } },
      ] },
    { id: 'shoucheng', core: 'songwon', name: '오왕의 수성', units: ['jutae', 'nosuk', 'jegalgeun', 'yukson', 'songwon'], desc: '맞을수록 반격이 쌓이는 탱커 주장.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.08 }, boss: { rules: [{ on: 'hurt', do: [{ k: 'stack', key: 'sc', add: 1, max: 8, mark: '#9ad0ff' }] }, { on: 'stackMax', key: 'sc', do: [{ k: 'dmg', m: 4, beam: 'thrust' }, { k: 'stackReset', key: 'sc' }] }] } },
        { n: 4, g: 2, lane: { atk: 0.12 }, boss: { rules: [{ on: 'start', do: [{ k: 'shield', pct: 0.2, dur: 10 }] }, { on: 'hurt', do: [{ k: 'stack', key: 'sc', add: 1, max: 6, mark: '#9ad0ff' }] }, { on: 'stackMax', key: 'sc', do: [{ k: 'dmg', m: 6, beam: 'thrust' }, { k: 'weaken', v: 0.1, dur: 4 }, { k: 'stackReset', key: 'sc' }] }] } },
        { n: 5, g: 3, lane: { atk: 0.18 }, boss: { stat: { endure: { n: 1, inv: 2, vx: 'barrier' } }, rules: [{ on: 'start', do: [{ k: 'shield', pct: 0.2, dur: 10 }] }, { on: 'hurt', do: [{ k: 'stack', key: 'sc', add: 1, max: 6, mark: '#9ad0ff' }] }, { on: 'stackMax', key: 'sc', do: [{ k: 'dmg', m: 6, beam: 'thrust' }, { k: 'dmg', m: 5, ids: ['yukson'], look: 'skill' }, { k: 'weaken', v: 0.1, dur: 4 }, { k: 'stackReset', key: 'sc' }] }] } },
      ] },
    { id: 'tupo', core: 'taesaja', name: '단기 포위 돌파', units: ['cav', 'arc', 'jeongbo', 'sonchaek', 'taesaja'], desc: '스킬을 쓰면 포위를 뚫던 기병과 궁병이 함께 쏜다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.2, only: ['cav', 'arc'], per: { jeongbo: { auraR: 30 } } }, boss: { rules: [{ on: 'skill', lane: 1, do: [{ k: 'volley', m: 1.2, n: 2 }] }] } },
        { n: 4, g: 2, lane: { atk: 0.3, only: ['cav', 'arc'], per: { jeongbo: { auraR: 30 } } }, boss: { rules: [{ on: 'skill', lane: 1, do: [{ k: 'volley', m: 1.8, n: 3 }] }, { on: 'skill', first: 1, do: [{ k: 'echo', n: 1, pct: 0.4, gap: 0.35 }] }] } },
        { n: 5, g: 3, lane: { atk: 0.4, only: ['cav', 'arc'], per: { jeongbo: { auraR: 30 } } }, boss: { stat: { bdmg: 0.15, crit: [{ ch: 0.1, mult: 2.8 }] }, rules: [{ on: 'skill', lane: 1, do: [{ k: 'volley', m: 1.8, n: 3 }] }, { on: 'skill', first: 1, do: [{ k: 'echo', n: 1, pct: 0.4, gap: 0.35 }] }] } },
      ] },
    // 신화 시그니처
    { id: 'guicai', core: 'gwakga', name: '귀재', units: ['wonso', 'sunyu', 'gwakga', 'jojo'], desc: '짧고 굵게 — 첫 1분에 판을 끝낸다.',
      tiers: [
        { n: 2, g: 1, lane: { crit: { ch: 0.05, mult: 2 } }, boss: { rules: [{ on: 'start', do: [{ k: 'buff', stat: 'bdmg', v: 0.4, dur: 45, vx: 'power' }] }, { on: 'bigDodge', do: [{ k: 'refund', s: 1, which: 'all' }] }] } },
        { n: 3, g: 2, lane: { crit: { ch: 0.08, mult: 2 } }, boss: { rules: [{ on: 'start', do: [{ k: 'buff', stat: 'bdmg', v: 0.6, dur: 60, vx: 'power' }] }, { on: 'bigDodge', do: [{ k: 'refund', s: 1, which: 'all' }] }] } },
        { n: 4, g: 3, lane: { crit: { ch: 0.1, mult: 2 } }, boss: { stat: { revive: { pct: 0.4, inv: 2 } }, rules: [{ on: 'start', do: [{ k: 'buff', stat: 'bdmg', v: 0.8, dur: 60, vx: 'power' }] }, { on: 'bigDodge', do: [{ k: 'refund', s: 1, which: 'all' }] }] } },
      ] },
    { id: 'fancheng', core: 'join', name: '번성 사수', units: ['yujin', 'seohwang', 'join', 'gwanu'], desc: '관우의 수공에도 성을 지킨다. 라인의 적이 느려진다.',
      tiers: [
        { n: 2, g: 1, lane: { fieldSlow: 0.03, atk: 0.08 }, boss: { stat: { guard: 0.1 }, rules: [{ on: 'start', do: [{ k: 'shield', pct: 0.2, dur: 10 }] }] } },
        { n: 3, g: 1, lane: { fieldSlow: 0.05, atk: 0.12 }, boss: { stat: { guard: 0.1 }, rules: [{ on: 'start', do: [{ k: 'shield', pct: 0.2, dur: 10 }] }, { on: 'hurt', do: [{ k: 'stack', key: 'fc', add: 1, max: 8, mark: '#d8ecff' }] }, { on: 'stackMax', key: 'fc', do: [{ k: 'dmg', m: 4, vx: 'shock' }, { k: 'weaken', v: 0.1, dur: 4 }, { k: 'stackReset', key: 'fc' }] }] } },
        { n: 4, g: 3, lane: { fieldSlow: 0.08, atk: 0.15 }, boss: { stat: { guard: 0.15, endure: { n: 1, inv: 2, vx: 'barrier' } }, rules: [{ on: 'start', do: [{ k: 'shield', pct: 0.2, dur: 10 }] }, { on: 'hurt', do: [{ k: 'stack', key: 'fc', add: 1, max: 8, mark: '#d8ecff' }] }, { on: 'stackMax', key: 'fc', do: [{ k: 'dmg', m: 4, vx: 'shock' }, { k: 'weaken', v: 0.1, dur: 4 }, { k: 'stackReset', key: 'fc' }] }] } },
      ] },
    { id: 'wangzuo', core: 'sunuk', name: '왕좌지재', units: ['sunyu', 'gwakga', 'jojo', 'sunuk'], desc: '왕을 보좌하는 재능 — 같이 싸우는 모두가 강해진다.',
      tiers: [
        { n: 2, g: 2, lane: { atk: 0.08 }, boss: { rules: [{ on: 'timer', every: 20, do: [{ k: 'rally', v: 0.15, dur: 6 }, { k: 'refund', s: 1, which: 'all' }] }] } },
        { n: 3, g: 3, lane: { atk: 0.12 }, boss: { rules: [{ on: 'timer', every: 18, do: [{ k: 'rally', v: 0.22, dur: 6 }, { k: 'pshield', dur: 2 }, { k: 'samp', v: 0.1, dur: 6, vx: 'scheme' }] }] } },
        { n: 4, g: 4, lane: { atk: 0.15 }, boss: { rules: [{ on: 'timer', every: 15, do: [{ k: 'rally', v: 0.3, dur: 6 }, { k: 'pshield', dur: 2 }, { k: 'samp', v: 0.2, dur: 6, vx: 'scheme' }] }] } },
      ] },
    { id: 'wanren', core: 'jangbi', name: '만인지적', units: ['janghap', 'wiyeon', 'macho', 'jangbi'], desc: '일갈로 보스를 꺾고, 마초와 밤새 겨룬다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.08, per: { jangbi: { stunAdd: 0.05 } } }, boss: { rules: [{ on: 'timer', every: 15, do: [{ k: 'weaken', v: 0.15, dur: 4 }, { k: 'dmg', m: 2, vx: 'roar', col: '#ff6a5a' }] }] } },
        { n: 3, g: 1, lane: { atk: 0.12, per: { jangbi: { stunAdd: 0.08 } } }, boss: { rules: [{ on: 'timer', every: 15, do: [{ k: 'weaken', v: 0.15, dur: 4 }, { k: 'dmg', m: 2, vx: 'roar', col: '#ff6a5a' }] }, { on: 'hurt', do: [{ k: 'stack', key: 'wr', add: 1, max: 6, mark: '#ff9a5a' }] }, { on: 'stackMax', key: 'wr', do: [{ k: 'dmg', m: 4, vx: 'shock' }, { k: 'stackReset', key: 'wr' }] }] } },
        { n: 4, g: 3, lane: { atk: 0.15, per: { jangbi: { stunAdd: 0.1 } } }, boss: { rules: [{ on: 'timer', every: 15, do: [{ k: 'weaken', v: 0.15, dur: 4 }, { k: 'dmg', m: 2, vx: 'roar', col: '#ff6a5a' }] }, { on: 'hurt', do: [{ k: 'stack', key: 'wr', add: 1, max: 6, mark: '#ff9a5a' }] }, { on: 'stackMax', key: 'wr', do: [{ k: 'dmg', m: 4, vx: 'shock' }, { k: 'stackReset', key: 'wr' }] }, { on: 'start', do: [{ k: 'ally', ids: ['macho'], n: 1, dur: 'fight', m: 1 }] }] } },
      ] },
    { id: 'changshan', core: 'joun', name: '상산 조자룡', units: ['spr', 'gongson', 'madae', 'joun', 'yubi'], desc: '일곱 번째 창마다 칠진칠출.',
      tiers: [
        { n: 3, g: 1, lane: { haste: 0.08 }, boss: { rules: [{ on: 'hitN', n: 7, do: [{ k: 'dmg', m: 1.5, beam: 'thrust' }] }] } },
        { n: 4, g: 1, lane: { haste: 0.12 }, boss: { rules: [{ on: 'hitN', n: 7, do: [{ k: 'dmg', m: 2, beam: 'thrust' }, { k: 'refund', s: 1.5, which: 'all' }] }] } },
        { n: 5, g: 3, lane: { haste: 0.18 }, boss: { stat: { bdmg: 0.15, endure: { n: 1, inv: 2, vx: 'guard' } }, rules: [{ on: 'hitN', n: 7, do: [{ k: 'dmg', m: 2.5, beam: 'thrust' }, { k: 'refund', s: 1.5, which: 'all' }] }] } },
      ] },
    { id: 'xiliang', core: 'macho', name: '서량 철기', units: ['cav', 'madae', 'dongtak', 'macho'], desc: '서량의 철기가 라인도 보스도 짓밟는다.',
      tiers: [
        { n: 2, g: 1, lane: { haste: 0.15, per: { cav: { atk: 0.3 } } }, boss: { stat: { dashCdr: 0.2 }, rules: [{ on: 'timer', every: 20, do: [{ k: 'riders', n: 3, m: 2, ids: ['cav', 'madae'] }] }] } },
        { n: 3, g: 1, lane: { haste: 0.2, per: { cav: { atk: 0.5 } } }, boss: { stat: { dashCdr: 0.2 }, rules: [{ on: 'timer', every: 15, do: [{ k: 'riders', n: 5, m: 2, ids: ['cav', 'madae'] }] }] } },
        { n: 4, g: 3, lane: { haste: 0.3, per: { cav: { atk: 0.7 } } }, boss: { stat: { dashCdr: 0.2, bdmg: 0.1 }, rules: [{ on: 'timer', every: 12, do: [{ k: 'riders', n: 7, m: 2, ids: ['cav', 'madae'] }, { k: 'weaken', v: 0.1, dur: 4 }] }] } },
      ] },
    { id: 'xiaobawang', core: 'sonchaek', name: '소패왕', units: ['jutae', 'hwanggae', 'jeongbo', 'taesaja', 'sonchaek'], desc: '강동을 평정한 기세가 스킬마다 쌓인다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.08 }, boss: { rules: [{ on: 'skillHit', do: [{ k: 'stack', key: 'xb', add: 1, max: 5, dur: 6, per: { bdmg: 0.03 }, vx: 'power' }] }] } },
        { n: 4, g: 2, lane: { atk: 0.12 }, boss: { rules: [{ on: 'skillHit', do: [{ k: 'stack', key: 'xb', add: 1, max: 5, dur: 6, per: { bdmg: 0.04 }, vx: 'power' }] }, { on: 'stackMax', key: 'xb', cd: 6, do: [{ k: 'volley', m: 2, n: 3, ids: ['jutae', 'hwanggae', 'jeongbo', 'taesaja'], any: 1 }] }] } },
        { n: 5, g: 3, lane: { atk: 0.18 }, boss: { rules: [{ on: 'skillHit', do: [{ k: 'stack', key: 'xb', add: 1, max: 5, dur: 6, per: { bdmg: 0.05 }, vx: 'power' }] }, { on: 'stackMax', key: 'xb', cd: 6, do: [{ k: 'volley', m: 2, n: 3, ids: ['jutae', 'hwanggae', 'jeongbo', 'taesaja'], any: 1 }, { k: 'dmg', m: 4, ids: ['taesaja'], wp: 'twin' }] }] } },
      ] },
    { id: 'yiling', core: 'yukson', name: '이릉대전', units: ['nosuk', 'jegalgeun', 'yubi', 'yukson'], desc: '칠백 리 영채를 태우듯 스킬 자리에 불이 남는다.',
      tiers: [
        { n: 2, g: 1, lane: { burn: 0.15 }, boss: { rules: [{ on: 'skillHit', do: [{ k: 'field', m: 0.8, dur: 4, max: 2, vis: 'fire' }] }] } },
        { n: 3, g: 2, lane: { burn: 0.25 }, boss: { stat: { burnAmp: 0.3 }, rules: [{ on: 'skillHit', do: [{ k: 'field', m: 1.2, dur: 4, max: 2, vis: 'fire' }] }] } },
        { n: 4, g: 3, lane: { burn: 0.35 }, boss: { stat: { burnAmp: 0.3 }, rules: [{ on: 'skillHit', do: [{ k: 'field', m: 1.6, dur: 4, max: 2, vis: 'fire' }, { k: 'samp', v: 0.15, dur: 5 }] }] } },
      ] },
    { id: 'xiangguo', core: 'dongtak', name: '상국의 폭정', units: ['hwawoong', 'wonso', 'gahu', 'dongtak'], desc: '폭군은 쉽게 쓰러지지 않는다.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.1 }, boss: { stat: { hpPct: 0.2 }, rules: [{ on: 'hitN', n: 5, do: [{ k: 'heal', pct: 0.02 }] }] } },
        { n: 3, g: 1, lane: { atk: 0.15, per: { hwawoong: { grantBurn: 0.2 } } }, boss: { stat: { hpPct: 0.2, lowHp: { th: 0.5, bdmg: 0.2 } }, rules: [{ on: 'hitN', n: 5, do: [{ k: 'heal', pct: 0.02 }] }] } },
        { n: 4, g: 2, lane: { atk: 0.25, per: { hwawoong: { grantBurn: 0.2 }, gahu: { burn: 0.3 } } }, boss: { stat: { hpPct: 0.4, lowHp: { th: 0.5, bdmg: 0.3 } }, rules: [{ on: 'hitN', n: 5, do: [{ k: 'heal', pct: 0.02 }] }, { on: 'timer', every: 20, do: [{ k: 'weaken', v: 0.15, dur: 5 }, { k: 'cameo', vx: 'quake', at: 'boss' }] }] } },
      ] },
    { id: 'biyue', core: 'choseon', name: '폐월수화', units: ['gyeonhui', 'daegyo', 'sogyo', 'choseon'], desc: '미인들의 곁에서 경국지색이 빛난다.',
      tiers: [
        { n: 2, g: 1, lane: { per: { choseon: { stunAdd: 0.04 } } }, boss: { rules: [{ on: 'skill', do: [{ k: 'samp', v: 0.12, dur: 4, vx: 'hearts' }] }] } },
        { n: 3, g: 2, lane: { per: { choseon: { stunAdd: 0.06 } } }, boss: { rules: [{ on: 'skill', do: [{ k: 'samp', v: 0.18, dur: 4, vx: 'hearts' }, { k: 'weaken', v: 0.1, dur: 4 }] }] } },
        { n: 4, g: 2, lane: { per: { choseon: { stunAdd: 0.08 } } }, boss: { rules: [{ on: 'skill', do: [{ k: 'samp', v: 0.22, dur: 5, vx: 'hearts' }, { k: 'weaken', v: 0.15, dur: 4 }] }, { on: 'skill', cd: 12, do: [{ k: 'delay', v: 0.8, vx: 'petals' }] }] } },
      ] },
    // 후반 올스타(core 없음, 구성원이면 누구든 주장). 등급 5 = 극+
    { id: 'dingli', name: '삼국정립', units: ['jojo', 'yubi', 'songwon'], desc: '세 군주가 한 판에 모이면 천하가 셋으로 선다.',
      tiers: [
        { n: 2, g: 3, lane: { atk: 0.15 }, boss: { stat: { bdmg: 0.25, hpPct: 0.2 }, rules: [{ on: 'start', do: [{ k: 'cameo', ids: ['jojo', 'yubi', 'songwon'], vx: 'rally' }] }] } },
        { n: 3, g: 5, lane: { atk: 0.25 }, boss: { stat: { bdmg: 0.45, hpPct: 0.3, revive: { pct: 0.5, inv: 2 } }, rules: [{ on: 'start', do: [{ k: 'cameo', ids: ['jojo', 'yubi', 'songwon'], vx: 'rally' }, { k: 'samp', v: 0.15, dur: 10 }] }, { on: 'timer', every: 10, do: [{ k: 'samp', v: 0.15, dur: 10 }] }] } },
      ] },
    { id: 'weiba', name: '위무의 패업', units: ['gwakga', 'sunuk', 'join', 'samaui'], desc: '위의 모신·명장이 한 판에 모여 패업을 이룬다.',
      tiers: [
        { n: 2, g: 3, lane: { atk: 0.1 }, boss: { stat: { bdmg: 0.15 }, rules: [{ on: 'skill', do: [{ k: 'samp', v: 0.1, dur: 4, vx: 'curse' }] }] } },
        { n: 3, g: 4, lane: { atk: 0.15 }, boss: { stat: { bdmg: 0.25 }, rules: [{ on: 'skill', do: [{ k: 'samp', v: 0.15, dur: 4, vx: 'curse' }] }] } },
        { n: 4, g: 5, lane: { atk: 0.25 }, boss: { stat: { bdmg: 0.45, guard: 0.2, revive: { pct: 0.5, inv: 2 } }, rules: [{ on: 'skill', do: [{ k: 'samp', v: 0.25, dur: 4, vx: 'curse' }] }] } },
      ] },
    { id: 'shuhan', name: '촉한의 영웅', units: ['jangbi', 'joun', 'macho', 'gwanu', 'jegal'], desc: '촉의 영웅들이 결투장 밖에서 함께 싸운다.',
      tiers: [
        { n: 2, g: 3, lane: { atk: 0.1 }, boss: { stat: { bdmg: 0.15 }, rules: [{ on: 'timer', every: 4, lane: 1, do: [{ k: 'volley', m: 2 }] }] } },
        { n: 3, g: 4, lane: { atk: 0.15 }, boss: { stat: { bdmg: 0.2 }, rules: [{ on: 'timer', every: 3.5, lane: 1, do: [{ k: 'volley', m: 2.2 }] }] } },
        { n: 4, g: 5, lane: { atk: 0.2 }, boss: { stat: { bdmg: 0.25 }, rules: [{ on: 'timer', every: 3, lane: 1, do: [{ k: 'volley', m: 2.4 }, { k: 'samp', v: 0.1, dur: 3 }] }] } },
        { n: 5, g: 5, lane: { atk: 0.3 }, boss: { stat: { bdmg: 0.25, revive: { pct: 0.5, inv: 2 } }, rules: [{ on: 'timer', every: 3, lane: 1, do: [{ k: 'volley', m: 2.4 }, { k: 'samp', v: 0.1, dur: 3 }] }, { on: 'timer', every: 15, do: [{ k: 'dmg', m: 6, ids: ['jegal', 'gwanu'], partner: 1, look: 'skill' }] }] } },
      ] },
    { id: 'jiangdong', name: '강동의 영걸', units: ['sonchaek', 'yukson', 'juyu', 'taesaja'], desc: '강동의 영걸들이 모이면 장강에 화선이 끊이지 않는다.',
      tiers: [
        { n: 2, g: 3, lane: { atk: 0.1 }, boss: { stat: { bdmg: 0.15 }, rules: [{ on: 'timer', every: 8, do: [{ k: 'ship', m: 5, n: 1 }] }] } },
        { n: 3, g: 4, lane: { atk: 0.15 }, boss: { stat: { bdmg: 0.2 }, rules: [{ on: 'timer', every: 6, do: [{ k: 'ship', m: 6, n: 1 }] }] } },
        { n: 4, g: 5, lane: { atk: 0.25 }, boss: { stat: { bdmg: 0.25, burnAmp: 0.5, revive: { pct: 0.5, inv: 2 } }, rules: [{ on: 'timer', every: 5, do: [{ k: 'ship', m: 6, n: 2 }] }] } },
      ] },
    { id: 'qunxiong', name: '군웅할거', units: ['yeoryeong', 'choseon', 'dongtak', 'janggak', 'yeopo'], desc: '천하의 군웅이 모여 보스가 공격할 때마다 기세를 모은다.',
      tiers: [
        { n: 3, g: 3, lane: { atk: 0.1 }, boss: { rules: [{ on: 'pattern', do: [{ k: 'stack', key: 'qx', add: 1, max: 5, per: { bdmg: 0.05 }, mark: '#ff6a5a' }] }, { on: 'hitN', n: 1, atMax: 'qx', do: [{ k: 'dmg', m: 6, vx: 'storm', anim: 'boom', stun: 1 }, { k: 'stackReset', key: 'qx' }] }] } },
        { n: 4, g: 4, lane: { atk: 0.18 }, boss: { rules: [{ on: 'pattern', do: [{ k: 'stack', key: 'qx', add: 1, max: 5, per: { bdmg: 0.07 }, mark: '#ff6a5a' }] }, { on: 'hitN', n: 1, atMax: 'qx', do: [{ k: 'dmg', m: 8, vx: 'storm', anim: 'boom', stun: 1.2 }, { k: 'samp', v: 0.15, dur: 5 }, { k: 'stackReset', key: 'qx' }] }] } },
        { n: 5, g: 5, lane: { atk: 0.25 }, boss: { stat: { revive: { pct: 0.4, inv: 2 } }, rules: [{ on: 'pattern', do: [{ k: 'stack', key: 'qx', add: 1, max: 5, per: { bdmg: 0.09 }, mark: '#ff6a5a' }] }, { on: 'hitN', n: 1, atMax: 'qx', do: [{ k: 'dmg', m: 12, vx: 'storm', anim: 'boom', stun: 1.5 }, { k: 'samp', v: 0.15, dur: 5 }, { k: 'stackReset', key: 'qx' }] }] } },
      ] },
    // 전설·라인 중심
    { id: 'danqi', name: '단기의 맹장', units: ['cav', 'gamnyeong', 'jangryo', 'munang'], desc: '대시로 홀로 적진을 가르는 맹장들.',
      tiers: [
        { n: 2, g: 1, lane: { haste: 0.1, per: { cav: { atk: 0.3 } } }, boss: { stat: { dashCdr: 0.3 }, rules: [{ on: 'dash', do: [{ k: 'dmg', m: 3, beam: 'thrust' }] }] } },
        { n: 3, g: 1, lane: { haste: 0.15, per: { cav: { atk: 0.3 } } }, boss: { stat: { dashCdr: 0.3 }, rules: [{ on: 'dash', do: [{ k: 'dmg', m: 4.5, beam: 'thrust' }, { k: 'buff', stat: 'bdmg', v: 0.3, dur: 3, vx: 'wind' }] }] } },
        { n: 4, g: 2, lane: { haste: 0.2, per: { cav: { atk: 0.3 } } }, boss: { stat: { dashCdr: 0.3, endure: { n: 1, inv: 2 } }, rules: [{ on: 'dash', do: [{ k: 'dmg', m: 4.5, beam: 'thrust' }, { k: 'buff', stat: 'bdmg', v: 0.3, dur: 3, vx: 'wind' }] }, { on: 'dashGraze', do: [{ k: 'refund', s: 2, which: 'all' }] }] } },
      ] },
    { id: 'sishui', core: 'songyeon', name: '사수관', units: ['hwawoong', 'hwanggae', 'jeongbo', 'songyeon'], desc: '강동의 호랑이가 사수관을 두드리니 오의 군세가 오른다.',
      tiers: [
        { n: 2, g: 1, lane: { facAtk: { fac: 'wu', pct: 0.05 }, per: { songyeon: { crit: { ch: 0.05, mult: 2 } } } }, boss: { stat: { crit: [{ ch: 0.1, mult: 2 }] }, rules: [{ on: 'start', do: [{ k: 'rally', v: 0.1, dur: 20 }] }] } },
        { n: 3, g: 1, lane: { facAtk: { fac: 'wu', pct: 0.08 }, per: { songyeon: { crit: { ch: 0.05, mult: 2 } } } }, boss: { stat: { crit: [{ ch: 0.1, mult: 2 }] }, rules: [{ on: 'start', do: [{ k: 'rally', v: 0.1, dur: 20 }] }, { on: 'timer', every: 20, do: [{ k: 'rally', v: 0.15, dur: 6 }] }] } },
        { n: 4, g: 2, lane: { facAtk: { fac: 'wu', pct: 0.12 }, per: { songyeon: { crit: { ch: 0.05, mult: 2 } } } }, boss: { stat: { crit: [{ ch: 0.1, mult: 2 }] }, rules: [{ on: 'start', do: [{ k: 'rally', v: 0.1, dur: 20 }] }, { on: 'timer', every: 15, do: [{ k: 'rally', v: 0.2, dur: 6 }, { k: 'volley', m: 2, ids: ['hwanggae', 'jeongbo', 'hwawoong'], any: 1 }] }] } },
      ] },
    { id: 'muniu', core: 'hwangwol', name: '목우유마', units: ['arc', 'shd', 'madae', 'hwangwol'], desc: '목우와 연노가 라인을 받치고 보스전에선 보급이 끊이지 않는다.',
      tiers: [
        { n: 2, g: 1, lane: { haste: 0.2, per: { hwangwol: { multi: 1, auraR: 50 } } }, boss: { stat: { regen: 0.005 }, rules: [{ on: 'timer', every: 6, do: [{ k: 'volley', m: 1.2, n: 2, ids: ['arc', 'shd', 'madae'], any: 1, wp: 'crossbow' }] }] } },
        { n: 3, g: 1, lane: { haste: 0.3, per: { hwangwol: { multi: 1, auraR: 50 } } }, boss: { stat: { regen: 0.008 }, rules: [{ on: 'timer', every: 6, do: [{ k: 'volley', m: 1.2, n: 3, ids: ['arc', 'shd', 'madae'], any: 1, wp: 'crossbow' }] }] } },
        { n: 4, g: 1, lane: { haste: 0.4, per: { hwangwol: { multi: 2, auraR: 50 } } }, boss: { stat: { regen: 0.008 }, rules: [{ on: 'timer', every: 6, do: [{ k: 'volley', m: 1.4, n: 4, ids: ['arc', 'shd', 'madae'], any: 1, wp: 'crossbow' }] }, { on: 'timer', every: 25, do: [{ k: 'pshield', dur: 2 }] }] } },
      ] },
    { id: 'baima', name: '백마의종', units: ['cav', 'arc', 'gongson'], desc: '초반 라인을 버티는 백마 기병대.',
      tiers: [
        { n: 2, g: 1, lane: { atk: 0.4, only: ['cav', 'arc'], per: { gongson: { multi: 1 } } } },
        { n: 3, g: 1, lane: { atk: 0.8, only: ['cav', 'arc'], per: { gongson: { multi: 1, splashR: 0.3 }, cav: { haste: 0.2 } } } },
      ] },
    { id: 'qingzhou', name: '청주병', units: ['spr', 'shd', 'yujin', 'akjin', 'hayeon'], desc: '조조가 거둔 황건의 무리가 라인을 메운다.',
      tiers: [
        { n: 3, g: 1, lane: { atk: 0.3, fieldSlow: 0.03 } },
        { n: 5, g: 1, lane: { atk: 0.6, fieldSlow: 0.05, range: 0.15 } },
      ] },
    { id: 'jiansunmi', name: '간손미', units: ['ganong', 'songeon', 'mijuk'], hidden: true, desc: '모든 강화 최대 단계 +5',
      tiers: [{ n: 3, g: 1, lane: { upMax: 5 } }] },
  ];
  // 판 변형 규칙(악몽 +1 ~ +5): 이득과 손해가 한 묶음. 단계마다 하나씩 무작위로 붙는다. 수치만이 아니라 판의 성격이 바뀌는 것으로(2026-11-07 교체).
  // 2026-11-24: +N이 높을수록 쉬워지던 역전을 고침 — 이득은 그대로 두고 손해만 키움(production/team/2026-11-24/fix-mutators.md).
  // excl: 같은 판에 함께 뽑지 않는 규칙(19-title rollMuts). 배수진+군웅할거는 R15~23 라인에서 거의 무조건 짐(sim-difficulty.md 2-6).
  const mutators = [
    { id: 'laststand', name: '배수진', good: '라이프가 1 이하면 모든 유닛 공격력 +50%', bad: '전선 한도 60 → 30', excl: ['warlords'], eff: { lowLifeAtk: 0.5, limit: 30 } },
    { id: 'general', name: '명장의 귀순', good: '무작위 4성 1기로 시작', bad: '라이프 1로 시작, 보스 공격력 +35%', eff: { startTier: 4, lives: 1, bossAtk: 1.35 } },
    { id: 'single', name: '일기토', good: '보스전 출전 장수 공격력·체력 +60%', bad: '보스전에서 팀 전체가 한 명씩 순서대로 싸움(출전 전에 선봉 신청, 쓰러지면 다음 장수, 대체 출전 없음), 보스 공격력 +50%', eff: { champAtk: 1.6, champHp: 1.6, relay: 1, bossAtk: 1.5 } },
    { id: 'swift', name: '속전속결', good: '남은 시간 20%만 남겨도 빠른 클리어(원래 35%)', bad: '보스전 제한 시간 -30%', eff: { fastNeed: 0.2, bossTime: 0.7 } },
    { id: 'wrath', name: '하늘의 분노', good: '보스전 스킬 재사용 대기 -25%', bad: '모든 보스가 「천벌 낙뢰」를 추가로 씀, 보스 기술 피해 +60%', eff: { bossCdr: 0.25, hazDmg: 1.6, extraPat: { n: '천벌 낙뢰', gen: 'rain', vis: 'bolt', p: { n: 10, r: 110 } } } },
    { id: 'horde', name: '대군 쇄도', good: '전선의 적 10마리마다 모든 유닛 공격력 +5%', bad: '라운드당 적 수 +30%', eff: { hordeAtk: 0.05, spawn: 1.3 } },
    { id: 'isolated', name: '고립무원', good: '모든 유닛 공격력 +15%', bad: '명사를 영입할 수 없음', eff: { atk: 0.15, noSage: 1 } },
    { id: 'heroes', name: '영웅의 시대', good: '보스 토벌마다 랜덤 등급 상승권 1장', bad: '보스 체력 +50%', eff: { bossRankUp: 1, bossHp: 1.5 } },
    { id: 'treasure', name: '보물 사냥', good: '보스 토벌마다 상자 +1', bad: '보스 공격력 +50%', eff: { bossChest: 1, bossAtk: 1.5 } },
    { id: 'hwata', name: '명의의 동행', good: '화타를 영입한 채 시작', bad: '보스 공격력 +40%', eff: { startHire: 'hwata', bossAtk: 1.4 } },
    { id: 'siege', name: '포위망', good: '보스전 제한 시간 +15%', bad: '모든 보스가 「사방 포위」를 추가로 씀, 보스 기술 피해 +25%', eff: { bossTime: 1.15, hazDmg: 1.25, extraPat: { n: '사방 포위', gen: 'rings', vis: 'army', p: { n: 6 } } } },
    { id: 'storm', name: '폭풍 전야', good: '보스 토벌 금화 +50%', bad: '보스 패턴 간격 30% 단축', eff: { bossGold: 1.5, bossGap: 0.7 } },
    { id: 'famine', name: '군량 부족', good: '시작 금화 +800', bad: '라인 몹 체력 +35%', eff: { startGold: 800, laneHp: 1.35 } },
    { id: 'firerain', name: '화공 경보', good: '상자에서 불멸 아이템이 2배로 잘 나옴', bad: '모든 보스가 「화염 낙하」를 추가로 씀, 보스 기술 피해 +40%', eff: { itemLuck: 2, hazDmg: 1.4, extraPat: { n: '화염 낙하', gen: 'rain', vis: 'flame', p: { n: 12, r: 110 } } } },
    { id: 'warlords', name: '군웅할거', good: '정예 적을 잡을 때마다 금화 15', bad: '라운드마다 체력이 매우 높은 금빛 정예 적 1기가 섞여 나와, 잡을 때까지 라인을 계속 돈다', excl: ['laststand'], eff: { elite: 1 } },
    { id: 'night', name: '야습', good: '중간보스 보상 2배', bad: '밤이라 내 유닛 주변만 보이고 나머지는 어둡다(보스전도 내 장수·보스 둘레만 밝다)', eff: { night: 1, midDouble: 1 } },
  ];
  const allOf = (t) => units.filter((d) => d.tier === t).map((d) => d.id);
  const ach = (id, name, desc, cond, reward) => ({ id, name, desc, cond, reward });
  const bond = (id, name, desc, list, reward) => ach(id, name, desc, { type: 'have', units: list }, reward);
  const pair = (id, name, list, reward) => ach(id, name, list.map((u) => units.find((d) => d.id === u).name).join('·') + ' 각 2기 동시 보유', { type: 'haveEach', units: list, n: 2 }, reward);
  const form = (id, name, need, reward) => ach(id, name, Object.keys(need).map((u) => units.find((d) => d.id === u).name + (need[u] > 1 ? ' ' + need[u] + '기' : '')).join('·') + ' 동시 보유', { type: 'haveSet', need, units: Object.keys(need) }, reward);
  // 4성 이상 선택권은 업적마다 1장(2026-11-08: 48라운드에 불멸이 나올 만큼 선택권이 쌓여서 줄임)
  const achievements = [
    // 등급별 수집: 해당 등급 선택권
    ach('all1', '오병 편성', '1성 5종을 2기씩 동시 보유', { type: 'haveEach', units: allOf(1), n: 2 }, { randomT1: 2 }),
    // 초반 업적: 10라운드 보스 전에 3성을 노려볼 수 있게 2성 선택권을 준다
    ach('e_muster', '의병 모집', '1성 12기 동시 보유', { type: 'tierHave', tier: 1, n: 12 }, { randomT1: 3 }),
    ach('e_first2', '첫 부장', '2성 첫 획득', { type: 'tierEver', tier: 2, n: 1 }, { randomT1: 2 }),
    ach('e_three2', '군웅 등용', '서로 다른 2성 3종 획득', { type: 'tierEver', tier: 2, n: 3 }, { randomT1: 3 }),
    ach('e_twin2', '한 깃발 아래', '같은 2성 2기 동시 보유', { type: 'sameHave', tier: 2, n: 2 }, { randomT1: 3 }),
    ach('all2', '이름 있는 장수들', '2성 전원 획득', { type: 'ever', units: allOf(2) }, { tickets: [[2, 2]] }),
    ach('all3', '군웅의 부장', '3성 전원 획득', { type: 'ever', units: allOf(3) }, { tickets: [[3, 2]] }),
    ach('all4', '맹장 집결', '4성 전원 획득', { type: 'ever', units: allOf(4) }, { tickets: [[4, 1]] }),
    ach('all5', '일당백', '5성 전원 획득', { type: 'ever', units: allOf(5) }, { tickets: [[5, 1]] }),
    // 전광석화: 유닛으로 보상
    ach('flash10', '전광석화: 황건', '10라운드 보스 전에 3성 제작', { type: 'speed', tier: 3, before: 10 }, { tickets: [[2, 3]] }),
    ach('flash25', '전광석화: 사수관', '25라운드 보스 전에 4성 제작', { type: 'speed', tier: 4, before: 25 }, { tickets: [[3, 3]] }),
    ach('flash40', '전광석화: 낙양', '40라운드 보스 전에 5성 제작', { type: 'speed', tier: 5, before: 40 }, { tickets: [[4, 1]] }),
    ach('flash55', '전광석화: 관도', '55라운드 보스 전에 6~7성 제작', { type: 'speed', tier: 6, before: 55 }, { tickets: [[5, 1]] }),
    ach('flash70', '전광석화: 호로관', '70라운드 보스 전에 전설~신화 제작', { type: 'speed', tier: 8, before: 70 }, { tickets: [[5, 1]] }),
    // 편성 업적: 1성을 섞어 5기를 동시에 갖춘다
    form('f_bow', '궁노 사수대', { arc: 3, hayeon: 1, hwangchung: 1 }, { tickets: [[3, 2]] }),
    form('f_cav', '철기 돌격대', { cav: 3, gongson: 1, madae: 1 }, { tickets: [[4, 1]] }),
    form('f_shield', '방패 철벽진', { shd: 3, yujin: 1, seohwang: 1 }, { tickets: [[3, 2]] }),
    form('f_sword', '검술 결사대', { swd: 3, jutae: 1, neungtong: 1 }, { tickets: [[2, 2]] }),
    form('f_spear', '장창 방진', { spr: 3, janghap: 1, wiyeon: 1 }, { tickets: [[3, 2]] }),
    form('f_hebei', '하북 대군', { hwawoong: 2, anryang: 1, munchu: 1, wonso: 1 }, { tickets: [[4, 1]] }),
    form('f_wuarmy', '강동 수군', { jutae: 2, neungtong: 1, hwanggae: 1, nosuk: 1 }, { tickets: [[4, 1]] }),
    form('f_weipillar', '위의 기둥', { yujin: 1, akjin: 1, janghap: 1, hayeon: 1, hadon: 1 }, { tickets: [[4, 1]] }),
    // 멀티플레이 전용: 보스전 출전 조합
    // 2인 이상에서만 열린다. 필요한 수는 인원에 맞춘다(모두 출전 / 인원 절반 이상, 최소 2).
    ach('m_two', '[협동] 황건 토벌대', '10라운드에 모두가 서로 다른 2성으로 출전', { type: 'party', round: 10, sameTierDistinct: 2, min: 2 }, { tickets: [[2, 2]] }),
    ach('m_diverse', '[협동] 군웅 할거', '25라운드에 모두가 서로 다른 3성으로 출전', { type: 'party', round: 25, sameTierDistinct: 3, min: 2 }, { tickets: [[3, 2]] }),
    ach('m_four', '[협동] 낙양 진격', '40라운드에 모두가 서로 다른 4성으로 출전', { type: 'party', round: 40, sameTierDistinct: 4, min: 2 }, { tickets: [[4, 1]] }),
    ach('m_five', '[협동] 관도 대전', '55라운드에 모두가 서로 다른 5성으로 출전', { type: 'party', round: 55, sameTierDistinct: 5, min: 2 }, { tickets: [[5, 1]] }),
    ach('m_hulao', '[협동] 반동탁 연합', '호로관에 공손찬·원소·하후돈·황개를 인원 절반 이상(최소 2명) 출전', { type: 'party', round: 70, anyOf: ['gongson', 'wonso', 'hadon', 'hwanggae'], min: 2 }, { tickets: [[4, 1]] }),
    ach('m_redcliff', '[협동] 손유 동맹', '적벽에 황개·노숙·주태·위연을 인원 절반 이상(최소 2명) 출전', { type: 'party', round: 80, anyOf: ['hwanggae', 'nosuk', 'jutae', 'wiyeon'], min: 2 }, { tickets: [[5, 1]] }),
  ];

  root.RTD_THEME = {
    looks, midLooks, bossLooks,
    id: 'samguk', title: '삼국지 랜덤 디펜스', subtitle: '천하를 다투는 협동 전략 디펜스',
    currency: '금화', chestName: '전리품 상자',
    // 등장 연출용 고해상도 일러스트가 있는 장수(gfx/il_<id>.jpg). 값은 그림 버전(바꾸면 브라우저가 새로 받는다).
    illusts: { jojo: 3, gwanu: 1, yeopo: 1, jegal: 1, yubi: 1, samaui: 1, juyu: 1, songwon: 1, taesaja: 1, janggak: 1, jangbi: 1, joun: 1, choseon: 1, gwakga: 1, join: 1, sunuk: 1, sonchaek: 1, yukson: 1, dongtak: 1 },
    factions, ranks, combineNeed, units, sageMax, roles, synergies, mutators, recipes, items, consumables, chestMark, itemMark, chestTable, unlock, difficulties, upgrades,
    waves, bosses, midbosses, bossRewards, fastClearRemain, achievements, trial, trialBoss,
    rules: {
      // 라인 몹 체력(쉬움 기준). 초반은 높게 시작해 완만하게, 이후 성장 속도에 맞춰 오른다. 15라운드부터는 제대로 뽑지 않으면 밀리게 1.2배.
      laneHp: [[1, 18], [5, 35], [10, 70], [15, 168], [20, 312], [25, 504], [30, 840], [35, 1260], [40, 1800], [45, 2520], [50, 3480], [55, 4680], [60, 6720], [65, 9360], [70, 12600], [80, 25200], [90, 46200], [100, 75600], [110, 109200], [120, 151200]],
      // 중간보스 체력 = 그 라운드 몹 체력 × 이 배율. 초반은 높고, 후반에도 무시되지 않게 45라운드부터 다시 올린다.
      midHpMul: [[3, 20], [5, 20], [15, 10], [20, 7], [30, 5.3], [45, 5], [60, 5], [75, 6], [120, 7]],
      roundTime: 45, spawnCount: 40, spawnInterval: 1, enemyLimit: 60, lives: 20, bossUptime: 0.3, midSpeed: 250, midLimit: 45, midRespawn: 360, midLifeLoss: 1, startGold: 0, disbandGold: [3, 12],
      pickTime: 25, dashCd: 10, dashMinTier: 6,
      baseRange: 200, baseAttackTime: 1, partyBossScale: [1, 1.05, 1.7, 2.4, 3.2],
      // 협동(2인 이상) 전용 보스 체력 보정 {난이도: {라운드: 배율}}(없으면 1). 혼자 판에는 걸리지 않는다(engine.js bossStats).
      // 2026-11-18 5인 기준: 보통은 전설(강화 잘 함) 3명, 어려움은 불멸 2명 또는 신화 4명이면 클리어. 근거: production/team/2026-11-17/balance-coop.md
      partyHpx: { normal: { 90: 1.2 }, hard: { 100: 0.85 } },
      // 무력화(시전 끊기·반격)에 필요한 화력: 제한 시간에 겨우 잡는 화력의 몇 배를 그 시간 동안 넣어야 하는지
      staggerK: 4.5,
      itemBias: 3, // 들고 있는 신화·불멸 아이템과 관련된 장수가 랜덤으로 나올 가중치
    },
  };
  if (typeof module !== 'undefined') module.exports = root.RTD_THEME;
})(typeof window !== 'undefined' ? window : globalThis);
