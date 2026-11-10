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
    u('hadon', '하후돈', '惇', 'wei', 5), u('macho', '마초', '超', 'shu', 5), u('nosuk', '노숙', '肅', 'wu', 5), u('wonso', '원소', '紹', 'etc', 5),
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
      sk: [{ n: '동남풍', k: 'line', len: 900, w: 150, mult: 8, cd: 13, fx: '#ffb060' }, { n: '팔진도', k: 'circle', r: 240, range: 520, mult: 6, delay: 0.6, stun: 2, cd: 20, fx: '#a0d8ff' }, { n: '칠성단', k: 'heal', pct: 0.5, cd: 24, fx: '#e0f0ff' }] }),
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
    u('hwata', '화타', '佗', 'free', 0, { cost: 700, build: '보스전', title: '신의', p: [pct('마비산', 'activeHeal', { pct: 0.2, uses: 2, desc: '보스전마다 2번, F로 내 출전 장수 체력 20% 회복' })] }),
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
    gwakga: 'debuff', join: 'tank', sunuk: 'support', choseon: 'debuff', jangbi: 'tank', joun: 'auto', sonchaek: 'skill', yukson: 'skill', dongtak: 'auto',
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
    sunyu: (s) => ({ p: [cdr(0.25 + s * 0.05), chain(1.5 + s * 0.25)] }),
    deungae: (s) => ({ p: [skillPct(0.4 + s * 0.15), aoe(0.3 + s * 0.05)] }),
    bangtong: (s) => ({ p: [aoe(0.3 + s * 0.05), cdr(0.25 + s * 0.05)] }),
    yeoryeong: (s) => ({ p: [chain(1.5 + s * 0.25), skillPct(0.4 + s * 0.15)] }),
    sonchaek: (s) => ({ p: [cdr(0.25 + s * 0.05), skillPct(0.3 + s * 0.1)] }),
    yukson: (s) => ({ p: [aoe(0.3 + s * 0.05), skillPct(0.4 + s * 0.15)] }),
    jegal: (s) => ({ p: [cdr(0.25 + s * 0.05), chain(1.5 + s * 0.25)] }),
    juyu: (s) => ({ p: [aoe(0.3 + s * 0.05), skillPct(0.4 + s * 0.15)] }),
    // 평타 딜러
    seoseo: (s) => ({ p: [haste(0.35)] }),
    jeongbo: (s) => ({ p: [haste(0.35), leech(0.015), smash] }),
    munang: (s) => ({ p: [haste(0.4), execute(0.3)] }),
    songyeon: (s) => ({ p: [haste(0.4), pierce(0.4)] }),
    sonhyang: (s) => ({ p: [haste(0.45), leech(0.015)] }),
    joun: (s) => ({ p: [haste(0.45), execute(0.4)] }),
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
    '단기 돌파': 'thrust', '용담': 'guard', '패왕 돌격': 'thrust', '칠백리 화공': 'fireline', '인내의 진': 'guard', '폭정의 압살': 'quake',
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

  // 7성 이상은 동일 유닛이 아니라 인연 있는 장수로 조합한다. 2026-11-09: 고등급 등장을 늦추려고 모두 같은 세력 5성 1기를 더 넣음(위 하후돈·촉 마초·오 노숙·군웅 원소), 조조는 등애 대신 전위. 7성은 가치 합 432(5성 3개) 이상, 전설은 576(5성 4개) 이상.
  // 신화·불멸에는 인연이 분명한 전설만 재료로 넣는다(제갈량-황월영, 유비-방통, 손책·손권-손견).
  const recipes = {
    sunyu: ['hadon', 'hadon', 'heojeo', 'heojeo', 'seohwang', 'hayeon', 'janghap', 'akjin', 'hadon'],
    deungae: ['ganguy', 'hadon', 'janghap', 'hayeon', 'swd', 'swd', 'hadon'],
    seoseo: ['macho', 'hadon', 'heojeo', 'hwangchung', 'hwangchung', 'wiyeon', 'janghap', 'juchang', 'spr', 'macho'],
    gwanpyeong: ['yeomong', 'hwangchung', 'hwangchung', 'juchang', 'juchang', 'seohwang', 'wiyeon', 'wiyeon', 'macho'],
    jeongbo: ['nosuk', 'nosuk', 'gamnyeong', 'gamnyeong', 'gamnyeong', 'hwanggae', 'hwanggae', 'jutae', 'nosuk'],
    jegalgeun: ['yeomong', 'nosuk', 'neungtong', 'jutae', 'arc', 'nosuk'],
    gahu: ['wonso', 'hadon', 'gongson', 'gongson', 'hwawoong', 'hwawoong', 'munchu', 'munchu', 'anryang', 'wonso'],
    maenghoek: ['macho', 'macho', 'wiyeon', 'wiyeon', 'wiyeon', 'hwangchung', 'gongson', 'hwawoong', 'cav', 'wonso'],
    jeonwi: ['jangryo', 'heojeo', 'heojeo', 'hadon', 'seohwang', 'akjin', 'hadon'],
    munang: ['jangryo', 'hadon', 'hadon', 'janghap', 'hayeon', 'cav', 'cav', 'hadon'],
    hwangwol: ['seoseo', 'macho', 'hwangchung', 'juchang', 'arc', 'arc', 'macho'],
    bangtong: ['seoseo', 'wiyeon', 'wiyeon', 'hwangchung', 'hwangchung', 'hwangchung', 'juchang', 'macho'],
    songyeon: ['jeongbo', 'hwanggae', 'hwanggae', 'hwawoong', 'wonso', 'nosuk'],
    sonhyang: ['yeomong', 'gamnyeong', 'gamnyeong', 'gamnyeong', 'nosuk', 'neungtong', 'nosuk'],
    yeoryeong: ['jangryo', 'wonso', 'wonso', 'hwawoong', 'gongson', 'wonso'],
    chugyung: ['maenghoek', 'gongson', 'gongson', 'wiyeon', 'wiyeon', 'anryang', 'hwawoong', 'juchang', 'juchang', 'wonso'],
    gwakga: { parts: ['deungae', 'sunyu', 'jangryo', 'hadon'], item: 'yugye' },
    join: { parts: ['sunyu', 'jangryo', 'hadon', 'hadon'], item: 'geumswae' },
    sunuk: { parts: ['sunyu', 'deungae', 'hadon', 'hadon'], item: 'chanhap' },
    jangbi: { parts: ['gwanpyeong', 'seoseo', 'macho', 'macho'], item: 'sapa' },
    joun: { parts: ['seoseo', 'ganguy', 'macho', 'hwangchung', 'macho'], item: 'cheonggang' },
    sonchaek: { parts: ['jeongbo', 'songyeon', 'yeomong', 'nosuk'], item: 'gojeong' },
    yukson: { parts: ['jegalgeun', 'jeongbo', 'nosuk', 'nosuk'], item: 'hwagong' },
    dongtak: { parts: ['gahu', 'maenghoek', 'wonso', 'wonso'], item: 'seoryang' },
    choseon: { parts: ['gahu', 'jangryo', 'wonso', 'wonso'], item: 'pyewol' },
    jojo: { parts: ['jeonwi', 'sunyu', 'jangryo', 'hadon', 'hadon'], item: 'uicheon' },
    samaui: { parts: ['deungae', 'sunyu', 'jangryo', 'janghap', 'hadon'], item: 'nanggo' },
    yubi: { parts: ['gwanpyeong', 'seoseo', 'bangtong', 'macho', 'macho'], item: 'ssanggo' },
    gwanu: { parts: ['gwanpyeong', 'seoseo', 'macho', 'hwangchung', 'juchang', 'macho'], item: 'cheongryong' },
    jegal: { parts: ['seoseo', 'maenghoek', 'ganguy', 'hwangwol', 'macho'], item: 'baekwoo' },
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

  const difficulties = [
    { id: 'easy', name: '쉬움', rounds: 70, mult: 0.4, lane: 1, bossAtk: 0.45, startUnits: 6, level: 0 },
    { id: 'normal', name: '보통', rounds: 90, mult: 0.75, lane: 1.4, bossAtk: 0.65, startUnits: 7, level: 1 },
    { id: 'hard', name: '어려움', rounds: 100, mult: 1, lane: 1.75, bossAtk: 0.85, startUnits: 8, level: 2 },
    { id: 'nightmare', name: '악몽', rounds: 120, mult: 1.4, lane: 2.2, bossAtk: 1.05, startUnits: 10, level: 3 },
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
     { round: 80, id: 'b_jojo', name: '조조', mark: '操', title: '적벽대전', place: '적벽', fx: '#ff8a3c', reqDps: 6000, hpx: 13.8, hitTier: 7, time: 170,
      arena: { sky: '#1a2230', ground: '#223a4a', motif: 'river' }, line: '술을 앞에 두고 노래하세. 인생이 얼마나 되겠는가.',
      phases: [{ at: 0.7, m: 'huarong', n: '화용도 퇴로' }, { at: 0.35, m: 'huarong', n: '화용도 퇴로' }],
      patterns: [{ n: '연환선 화공', gen: 'deck', vis: 'flame', p: {} }, { n: '화선 낙하', gen: 'rain', vis: 'fireship', p: { n: 11, r: 110 } }, { n: '호표기', gen: 'charge', vis: 'charge', p: { w: 140, ctr: 1 } }, { n: '동남풍', gen: 'fan', vis: 'wind', p: { n: 9 } }] },
     { round: 90, id: 'b_yukson', name: '육손', mark: '遜', title: '이릉대전', place: '이릉', fx: '#ff6a2a', reqDps: 11000, hpx: 2.99, fhpx: 7.36, hitTier: 8, time: 180,
      arena: { sky: '#2a1a10', ground: '#403020', motif: 'forest' }, line: '칠백 리 영채여, 이제 불타거라.',
      phases: [{ at: 0.6, m: 'pillars', n: '석병팔진' }, { at: 0.3, m: 'pillars', n: '석병팔진' }],
      patterns: [{ n: '칠백리 연영 방화', gen: 'spread', vis: 'flame', p: { bands: 5 } }, { n: '화공 나선', gen: 'bullet', vis: 'fireball', p: { n: 18, waves: 3 } }, { n: '불화살 비', gen: 'rain', vis: 'firearrow', p: { n: 12, r: 110 } }, { n: '서생의 인내', gen: 'rings', vis: 'flame', p: { n: 4 } }] },
     { round: 100, id: 'b_jegal', name: '제갈량', mark: '亮', title: '기산 북벌', place: '기산', fx: '#7fd0ff', reqDps: 18000, hpx: 4.02, fhpx: 3.68, hitTier: 9, time: 190,
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
    hadon: ['spear', 'helm', 'short'], macho: ['lance', 'feather'], nosuk: ['scroll', 'scholar', 'short'], wonso: ['sword', 'crown', 'long'],
    jangryo: ['halberd', 'helm', 'short'], ganguy: ['spear', 'helm'], yeomong: ['sword', 'scholar'],
    sunyu: ['scroll', 'scholar', 'short'], gahu: ['fan', 'scholar', 'long'], munang: ['spear', 'helm'], deungae: ['spear', 'helm', 'short'], seoseo: ['sword', 'scholar'], gwanpyeong: ['guandao', 'bare'], jeongbo: ['spear', 'helm', 'white', null, W], jegalgeun: ['scroll', 'scholar', 'long'], janggak: ['thunder', 'turban', 'long'], maenghoek: ['mace', 'fur', 'full', 'k'],
    sunuk: ['scroll', 'scholar', 'short'], hwangwol: ['crossbow', 'bun', null, 'p', B, 1], bangtong: ['flame', 'scholar', 'short', 'k'], songyeon: ['sword', 'helm', 'short'], sonhyang: ['bow', 'bun', null, 'p', B, 1], yeoryeong: ['halberd', 'feather', null, 'p', '#3a1c2a', 1], chugyung: ['dagger', 'fur', null, 'k', '#3a1c14', 1],
    gwakga: ['staff', 'scholar'], join: ['sword', 'helm', 'short'], jangbi: ['serpent', 'bare', 'full', 'k'], joun: ['spear', 'helm'], sonchaek: ['spear', 'feather'], yukson: ['flame', 'scholar'], dongtak: ['sword', 'crown', 'full', 'r'],
    jojo: ['sword', 'crown', 'short'], samaui: ['staff', 'scholar', 'long'], yubi: ['twin', 'crown', 'short'], gwanu: ['guandao', 'guard', 'long', 'r'], jegal: ['fan', 'scholar', 'long'], songwon: ['sword', 'crown', 'long', null, B], juyu: ['flame', 'scholar'], yeopo: ['halberd', 'feather'],
    choseon: ['ribbon', 'bun', null, 'p', '#2a1c14', 1], hwata: ['needle', 'hood', 'white', null, W], samahwi: ['fan', 'hood', 'white', null, W], jwaja: ['staff', 'hood', 'white', null, W], ganong: ['fan', 'scholar', 'short'], songeon: ['scroll', 'scholar', 'long'], chaemunhui: ['lute', 'bun', null, 'p', '#2a1c14', 1],
    mijuk: ['scroll', 'scholar', 'short'], jingung: ['sword', 'scholar', 'long'], ugil: ['staff', 'hood', 'white', null, W], gyeonhui: ['ribbon', 'bun', null, 'p', '#1c1410', 1], daegyo: ['fan', 'bun', null, 'p', '#2a1c14', 1], sogyo: ['lute', 'bun', null, 'p', '#2a1c14', 1],
  };
  const midLooks = { 정원지: 'janggak', 장량: 'janggak', 안량: 'anryang', 문추: 'munchu', 하후돈: 'hadon', 하후연: 'hayeon', 맹획: 'maenghoek', 방덕: 'macho', 종회: 'deungae', 왕쌍: 'hwawoong', 채모: 'hwanggae', 이각: 'hwawoong', 곽사: 'anryang', 서영: 'hadon', 장양: 'sunuk' };
  const bossLooks = { b_janggak: 'janggak', b_hwawoong: 'hwawoong', b_dongtak: 'dongtak', b_wonso: 'wonso', b_yeopo: 'yeopo', b_jojo: 'jojo', b_yukson: 'yukson', b_jegal: 'jegal', b_deungae: 'deungae', b_samaui: 'samaui' };

  // 인연 시너지: 업적과 따로, 주요 인물이 모두 모이면 켜진다(게임판 왼쪽에 표시). 보스 체력은 그대로라 효과는 작게 둔다.
  // eff: 시너지 인물 전원(only가 있으면 그 인물만), per: 인물별. 키는 atk·guard(받는 피해 감소)·cdr·skill(스킬 피해)·hp·boss(보스 피해)·burn(화상)·crit.
  // 내가 가진 인물이 하나라도 생기면 왼쪽에 보인다. hidden은 완성되어야 보인다.
  const synergies = [
    { id: 'peach', name: '도원결의', units: ['yubi', 'gwanu', 'jangbi'], desc: '세 장수 공격력 +12%, 보스전에서 받는 피해 -10%', eff: { atk: 0.12, guard: 0.1 } },
    { id: 'sonfamily', name: '손씨 삼대', units: ['songyeon', 'sonchaek', 'songwon'], desc: '모든 오 유닛 공격력 +6%, 세 장수 스킬 재사용 -10%', eff: { facAtk: { fac: 'wu', pct: 0.06 }, cdr: 0.1 } },
    { id: 'father', name: '비장의 피', units: ['yeopo', 'yeoryeong'], desc: '두 장수가 10% 확률로 2배 피해', eff: { crit: { ch: 0.1, mult: 2 } } },
    { id: 'chain', name: '연환지계', units: ['choseon', 'yeopo', 'dongtak'], desc: '모든 적 이동속도 -5%, 여포·동탁 공격력 +10%', eff: { fieldSlow: 0.05, atk: 0.1, only: ['yeopo', 'dongtak'] } },
    // 삼국지 주요 장면
    { id: 'redcliff', name: '적벽대전', units: ['juyu', 'jegal', 'hwanggae'], desc: '주유 공격력 +20%·화상 피해 +40%, 제갈량·황개 화상 피해 +20%', eff: { burn: 0.2, only: ['jegal', 'hwanggae'] }, per: { juyu: { atk: 0.2, burn: 0.4 } } },
    { id: 'dragon', name: '와룡봉추', units: ['jegal', 'bangtong'], desc: '두 장수 스킬 재사용 -10%, 스킬 피해 +15%', eff: { cdr: 0.1, skill: 0.15 } },
    { id: 'tigers', name: '오호대장군', units: ['gwanu', 'jangbi', 'joun', 'macho', 'hwangchung'], desc: '다섯 장수 공격력 +12%', eff: { atk: 0.12 } },
    { id: 'yingchuan', name: '영천의 모사', units: ['sunuk', 'sunyu', 'gwakga'], desc: '모든 위 유닛 공격력 +6%, 세 장수 스킬 재사용 -10%', eff: { facAtk: { fac: 'wei', pct: 0.06 }, cdr: 0.1 } },
    { id: 'guanfam', name: '관씨 부자', units: ['gwanu', 'gwanpyeong'], desc: '관평 공격력 +25%, 관우 공격력 +10%', per: { gwanpyeong: { atk: 0.25 }, gwanu: { atk: 0.1 } } },
    { id: 'changban', name: '장판파', units: ['yubi', 'joun'], desc: '두 장수 공격력 +8%, 조운 받는 피해 -15%', eff: { atk: 0.08 }, per: { joun: { guard: 0.15 } } },
    { id: 'shenting', name: '신정의 결투', units: ['sonchaek', 'taesaja'], desc: '두 장수가 10% 확률로 2배 피해', eff: { crit: { ch: 0.1, mult: 2 } } },
    { id: 'wududu', name: '동오 대도독', units: ['juyu', 'nosuk', 'yeomong', 'yukson'], desc: '모든 오 유닛 공격력 +6%, 네 장수 스킬 피해 +15%', eff: { facAtk: { fac: 'wu', pct: 0.06 }, skill: 0.15 } },
    { id: 'nanman', name: '남만왕 부부', units: ['maenghoek', 'chugyung'], desc: '두 장수 공격력 +10%, 보스전 체력 +25%', eff: { atk: 0.1, hp: 0.25 } },
    { id: 'wancheng', name: '완성의 악래', units: ['jojo', 'jeonwi'], desc: '전위 보스전 체력 +30%, 조조 받는 피해 -15%', per: { jeonwi: { hp: 0.3 }, jojo: { guard: 0.15 } } },
    { id: 'tianshui', name: '천수의 기린아', units: ['jegal', 'ganguy'], desc: '강유 공격력 +25%, 제갈량 스킬 재사용 -8%', per: { ganguy: { atk: 0.25 }, jegal: { cdr: 0.08 } } },
    { id: 'jin', name: '진의 기틀', units: ['samaui', 'deungae'], desc: '두 장수 보스 피해 +12%', eff: { boss: 0.12 } },
    // 명사와의 인연
    { id: 'xiapi', name: '하비의 책사', units: ['jingung', 'yeopo'], desc: '여포 공격력 +15%, 받는 피해 -10%', per: { yeopo: { atk: 0.15, guard: 0.1 } } },
    { id: 'shuijing', name: '수경문하', units: ['samahwi', 'jegal', 'bangtong'], desc: '제갈량·방통 스킬 피해 +20%, 스킬 재사용 -10%', eff: { skill: 0.2, cdr: 0.1, only: ['jegal', 'bangtong'] } },
    { id: 'guagu', name: '괄골요독', units: ['hwata', 'gwanu'], desc: '관우 보스전 체력 +30%, 받는 피해 -10%', per: { gwanu: { hp: 0.3, guard: 0.1 } } },
    { id: 'daqiao', name: '소패왕의 반려', units: ['daegyo', 'sonchaek'], desc: '손책 공격력 +15%, 보스 피해 +10%', per: { sonchaek: { atk: 0.15, boss: 0.1 } } },
    { id: 'xiaoqiao', name: '미주랑의 반려', units: ['sogyo', 'juyu'], desc: '주유 공격력 +15%, 화상 피해 +30%', per: { juyu: { atk: 0.15, burn: 0.3 } } },
    { id: 'wenji', name: '문희귀한', units: ['chaemunhui', 'jojo'], desc: '모든 위 유닛 공격력 +5%, 조조 스킬 재사용 -10%', eff: { facAtk: { fac: 'wei', pct: 0.05 } }, per: { jojo: { cdr: 0.1 } } },
    { id: 'jiansunmi', name: '간손미', units: ['ganong', 'songeon', 'mijuk'], hidden: true, desc: '모든 강화 최대 단계 +5', eff: { upMax: 5 } },
  ];
  // 판 변형 규칙(악몽 +1 ~ +5): 이득과 손해가 한 묶음. 단계마다 하나씩 무작위로 붙는다. 수치만이 아니라 판의 성격이 바뀌는 것으로(2026-11-07 교체).
  const mutators = [
    { id: 'laststand', name: '배수진', good: '라이프가 1 이하면 모든 유닛 공격력 +50%', bad: '전선 한도 60 → 30', eff: { lowLifeAtk: 0.5, limit: 30 } },
    { id: 'general', name: '명장의 귀순', good: '무작위 4성 1기로 시작', bad: '라이프 1로 시작', eff: { startTier: 4, lives: 1 } },
    { id: 'single', name: '일기토', good: '보스전 출전 장수 공격력·체력 +60%', bad: '보스전에서 팀 전체가 한 명씩 순서대로 싸움(출전 전에 선봉 신청, 쓰러지면 다음 장수, 대체 출전 없음)', eff: { champAtk: 1.6, champHp: 1.6, relay: 1 } },
    { id: 'swift', name: '속전속결', good: '남은 시간 20%만 남겨도 빠른 클리어(원래 35%)', bad: '보스전 제한 시간 -20%', eff: { fastNeed: 0.2, bossTime: 0.8 } },
    { id: 'wrath', name: '하늘의 분노', good: '보스전 스킬 재사용 대기 -25%', bad: '모든 보스가 「천벌 낙뢰」를 추가로 씀', eff: { bossCdr: 0.25, extraPat: { n: '천벌 낙뢰', gen: 'rain', vis: 'bolt', p: { n: 6, r: 90 } } } },
    { id: 'horde', name: '대군 쇄도', good: '전선의 적 10마리마다 모든 유닛 공격력 +5%', bad: '라운드당 적 수 +30%', eff: { hordeAtk: 0.05, spawn: 1.3 } },
    { id: 'isolated', name: '고립무원', good: '모든 유닛 공격력 +15%', bad: '명사를 영입할 수 없음', eff: { atk: 0.15, noSage: 1 } },
    { id: 'heroes', name: '영웅의 시대', good: '보스 토벌마다 랜덤 등급 상승권 1장', bad: '보스 체력 +20%', eff: { bossRankUp: 1, bossHp: 1.2 } },
    { id: 'treasure', name: '보물 사냥', good: '보스 토벌마다 상자 +1', bad: '보스 공격력 +30%', eff: { bossChest: 1, bossAtk: 1.3 } },
    { id: 'hwata', name: '명의의 동행', good: '화타를 영입한 채 시작', bad: '보스 공격력 +25%', eff: { startHire: 'hwata', bossAtk: 1.25 } },
    { id: 'siege', name: '포위망', good: '보스전 제한 시간 +15%', bad: '모든 보스가 「사방 포위」를 추가로 씀', eff: { bossTime: 1.15, extraPat: { n: '사방 포위', gen: 'rings', vis: 'army', p: { n: 4 } } } },
    { id: 'storm', name: '폭풍 전야', good: '보스 토벌 금화 +50%', bad: '보스 패턴 간격 20% 단축', eff: { bossGold: 1.5, bossGap: 0.8 } },
    { id: 'famine', name: '군량 부족', good: '시작 금화 +800', bad: '라인 몹 체력 +15%', eff: { startGold: 800, laneHp: 1.15 } },
    { id: 'firerain', name: '화공 경보', good: '상자에서 불멸 아이템이 2배로 잘 나옴', bad: '모든 보스가 「화염 낙하」를 추가로 씀', eff: { itemLuck: 2, extraPat: { n: '화염 낙하', gen: 'rain', vis: 'flame', p: { n: 8, r: 100 } } } },
    { id: 'warlords', name: '군웅할거', good: '정예 적을 잡을 때마다 금화 15', bad: '라운드마다 체력이 매우 높은 금빛 정예 적 1기가 섞여 나와, 잡을 때까지 라인을 계속 돈다', eff: { elite: 1 } },
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
    form('f_cav', '철기 돌격대', { cav: 3, gongson: 1, macho: 1 }, { tickets: [[4, 1]] }),
    form('f_shield', '방패 철벽진', { shd: 3, yujin: 1, seohwang: 1 }, { tickets: [[3, 2]] }),
    form('f_sword', '검술 결사대', { swd: 3, jutae: 1, neungtong: 1 }, { tickets: [[2, 2], [3, 1]] }),
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
    factions, ranks, combineNeed, units, sageMax, roles, synergies, mutators, recipes, items, consumables, chestMark, itemMark, chestTable, difficulties, upgrades,
    waves, bosses, midbosses, bossRewards, fastClearRemain, achievements,
    rules: {
      // 라인 몹 체력(쉬움 기준). 초반은 높게 시작해 완만하게, 이후 성장 속도에 맞춰 오른다. 15라운드부터는 제대로 뽑지 않으면 밀리게 1.2배.
      laneHp: [[1, 18], [5, 35], [10, 70], [15, 168], [20, 312], [25, 504], [30, 840], [35, 1260], [40, 1800], [45, 2520], [50, 3480], [55, 4680], [60, 6720], [65, 9360], [70, 12600], [80, 25200], [90, 46200], [100, 75600], [110, 109200], [120, 151200]],
      // 중간보스 체력 = 그 라운드 몹 체력 × 이 배율. 초반은 높고, 후반에도 무시되지 않게 45라운드부터 다시 올린다.
      midHpMul: [[3, 20], [5, 20], [15, 10], [20, 7], [30, 5.3], [45, 5], [60, 5], [75, 6], [120, 7]],
      roundTime: 45, spawnCount: 40, spawnInterval: 1, enemyLimit: 60, lives: 20, bossUptime: 0.3, midSpeed: 250, midLimit: 45, midRespawn: 360, midLifeLoss: 1, startGold: 0, disbandGold: [3, 12],
      pickTime: 25, dashCd: 10, dashMinTier: 6,
      baseRange: 200, baseAttackTime: 1, partyBossScale: [1, 1.05, 1.7, 2.4, 3.2],
      // 무력화(시전 끊기·반격)에 필요한 화력: 제한 시간에 겨우 잡는 화력의 몇 배를 그 시간 동안 넣어야 하는지
      staggerK: 4.5,
      itemBias: 3, // 들고 있는 신화·불멸 아이템과 관련된 장수가 랜덤으로 나올 가중치
    },
  };
  if (typeof module !== 'undefined') module.exports = root.RTD_THEME;
})(typeof window !== 'undefined' ? window : globalThis);
