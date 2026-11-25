// 계정 성장(관직 곡선·판 보상 식·관직 승급 보상·업적 첫 달성 보상·일일 미션 목록). 앱과 서버가 같이 쓴다.
// 설계: production/team/2026-11-25/economy-v2.md (2026-11-25 경제 v2. 앞 판: 2026-11-24/fix-progression.md)
// - 관직: 계급(0 신병 ~ 9 대장군)마다 1~5 등급이 있다(예: 백인대장 1 → … → 백인대장 5 → 군후 1. 2026-11-25 사용자 결정 "등급은 1~5").
//   10 군주는 등급 없는 마지막 단계. 레벨(1 ~ 51) = 계급×5 + 등급. 화면은 레벨 숫자 대신 "계급명 등급"(label)으로 보인다.
// - 계급마다 필요한 누적 경험치는 RANK_XP 표, 계급 안의 등급은 (k/5)^GRADE_POW로 나눈다(등급이 오를수록 한 칸이 길어진다.
//   1.7 = 쉬움 클리어 한 판(43)이면 신병 1 → 2가 되는 가장 완만한 값 근처).
// - 판 경험치는 난이도 배율을 크게 둔다(높은 난이도 클리어는 빠르게, 쉬움 반복은 조금씩). 판 동전 식은 v1과 같다.
// - 보상 수치는 서버만 믿는다(app.js가 이 표로 판단해 준다). 앱은 화면 표시에만 쓴다.
(function (root) {
  const STEPS = 5; // 계급 하나의 등급 수
  // 계급마다 필요한 누적 경험치(0 신병 … 9 대장군, 10 군주). 목표 표는 economy-v2.md 2절.
  const RANK_XP = [0, 600, 1800, 3800, 7200, 12800, 22000, 37500, 63000, 105000, 175000];
  const GRADE_POW = 1.7;
  // 계급이 시작되는 레벨(0 신병 = 1, 1 백인대장 = 6, … 10 군주 = 51)
  const RANK_LV = RANK_XP.map((_, r) => r * STEPS + 1);
  const MAX_LV = RANK_LV[RANK_LV.length - 1];
  const rankOf = (lv) => Math.max(0, Math.min(RANK_LV.length - 1, Math.floor((Math.max(1, lv) - 1) / STEPS)));
  // 계급 안 등급(1 ~ 5). 군주는 0(등급 없음)
  const stepOf = (lv) => (lv >= MAX_LV ? 0 : ((Math.max(1, Math.floor(lv)) - 1) % STEPS) + 1);
  // 레벨 lv에 닿는 누적 경험치
  function xpAt(lv) {
    lv = Math.max(1, Math.floor(lv));
    if (lv >= MAX_LV) return RANK_XP[RANK_XP.length - 1];
    const r = rankOf(lv), k = lv - RANK_LV[r];
    return RANK_XP[r] + Math.round((RANK_XP[r + 1] - RANK_XP[r]) * Math.pow(k / STEPS, GRADE_POW));
  }
  // 경험치 → 레벨(1 ~ 51)
  function levelOf(xp) {
    xp = +xp || 0; let lv = 1;
    while (lv < MAX_LV && xpAt(lv + 1) <= xp) lv++;
    return lv;
  }
  // 화면 표기 "계급명 등급"(군주는 이름만). tr = 번역 함수(I.t), key = 'rk_mil3' 같은 계급 문구 키
  const label = (tr, key, lv) => { const s = stepOf(lv | 0); return s ? tr('rankStep', { a: tr(key), n: s }) : tr(key); };

  // 판 보상(서버 app.js rewardOf가 쓴다). b = { diff, mutLv, round, win }, seatMul = 판 인원 배율(app.js SEAT_MUL)
  // 경험치 = round((기본 + 라운드×perRound + 승리) × 난이도 배율 × (1 + 악몽 +N × perMut)) × 인원 배율
  // 동전 = round((round(v1 기본 경험치/5) + 승리 동전) × 인원 배율) — v1(2026-11-24)과 같은 값
  const REWARD = {
    xp: { base: 10, perRound: 0.5, maxRound: 120, win: 40, diff: { easy: 1, normal: 2.5, hard: 4, nightmare: 6 }, perMut: 0.15 },
    coin: { base: 15, perRound: 0.8, win: 60, div: 5, winBonus: 20, diff: { easy: 1, normal: 1.3, hard: 1.6, nightmare: 2 } },
  };
  function gameReward(b, seatMul) {
    const X = REWARD.xp, C = REWARD.coin, R = Math.min(X.maxRound, Math.max(0, b.round | 0)), mut = 1 + Math.min(5, Math.max(0, b.mutLv | 0)) * X.perMut;
    const xp = Math.round((X.base + R * X.perRound + (b.win ? X.win : 0)) * (X.diff[b.diff] || 1) * mut);
    const cb = Math.round((C.base + R * C.perRound + (b.win ? C.win : 0)) * (C.diff[b.diff] || 1) * mut);
    return { xp: Math.round(xp * seatMul), coins: Math.round((Math.round(cb / C.div) + (b.win ? C.winBonus : 0)) * seatMul) };
  }

  // 관직(계급)이 오를 때 한 번씩 주는 동전(계급 번호 → 동전). 등급이 오를 때는 주지 않는다. 한 번 받은 계급은 다시 주지 않는다.
  const RANK_COINS = [0, 100, 150, 200, 250, 300, 400, 500, 600, 800, 1000];
  // 업적(판 안 업적 28개)을 이 계정에서 처음 달성했을 때 한 번씩 주는 동전. 목록에 없는 업적은 기본값. v2: 30/50/100 → 5/10/30
  const ACH_COINS = {
    base: 10,
    small: { coins: 5, ids: ['all1', 'e_muster', 'e_first2', 'e_three2', 'e_twin2'] },
    big: { coins: 30, ids: ['all4', 'all5', 'flash40', 'flash55', 'flash70', 'm_four', 'm_five', 'm_hulao', 'm_redcliff'] },
  };
  const achCoins = (id) => (ACH_COINS.small.ids.includes(id) ? ACH_COINS.small.coins : ACH_COINS.big.ids.includes(id) ? ACH_COINS.big.coins : ACH_COINS.base);
  // 일일 미션(일본 시간 0시 초기화). stat = 판 보고에서 세는 값: games(10라운드 이상 간 판 1), combines(합성 수), bossWins(보스 처치 수)
  // v2: 동전 60/40/50 → 40/25/35(하루 100, 2026-11-25 사용자 결정 "하루 100골드까지"), 경험치 30/15/25 → 10/5/5
  const DAILY = [
    { id: 'd_play2', stat: 'games', need: 2, coins: 40, xp: 10 },
    { id: 'd_comb10', stat: 'combines', need: 10, coins: 25, xp: 5 },
    { id: 'd_boss3', stat: 'bossWins', need: 3, coins: 35, xp: 5 },
  ];
  // 난이도 첫 클리어 보상(한 번씩, 미션 창에서 받기). v2: 보통 700 → 300, 어려움 700 → 500
  const FIRSTS = [
    { id: 'f_normal', coins: 300, diff: 'normal' }, { id: 'f_hard', coins: 500, diff: 'hard' }, { id: 'f_nightmare', coins: 700, diff: 'nightmare' },
    { id: 'f_nm1', coins: 200, mut: 1 }, { id: 'f_nm2', coins: 200, mut: 2 }, { id: 'f_nm3', coins: 200, mut: 3 }, { id: 'f_nm4', coins: 200, mut: 4 }, { id: 'f_nm5', coins: 200, mut: 5 },
  ];
  root.RTD_PROG = { STEPS, RANK_LV, RANK_XP, GRADE_POW, MAX_LV, xpAt, levelOf, rankOf, stepOf, label, REWARD, gameReward, RANK_COINS, ACH_COINS, achCoins, DAILY, FIRSTS };
  if (typeof module !== 'undefined') module.exports = root.RTD_PROG;
})(typeof window !== 'undefined' ? window : globalThis);
