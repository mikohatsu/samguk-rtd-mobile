// 계정 성장(관직 곡선·관직 승급 보상·업적 첫 달성 보상·일일 미션 목록). 앱과 서버가 같이 쓴다.
// 설계: production/team/2026-11-24/fix-progression.md (2026-11-24 사용자 결정)
// - 관직 곡선: 계급(0 신병 ~ 10 군주)마다 필요한 누적 경험치(RANK_XP)를 표로 정하고, 계급 안의 레벨은 그 사이를 고르게 나눈다.
//   옛 식(40·(레벨-1)²)보다 모든 레벨에서 같거나 적다 → 기존 계정의 경험치는 그대로 두고 단계만 다시 계산해도 내려가는 사람이 없다.
// - 보상 수치는 서버만 믿는다(app.js가 이 표로 판단해 준다). 앱은 화면 표시에만 쓴다.
(function (root) {
  // 계급이 시작되는 레벨(0 신병 = 1, 1 = 9품 … 9 = 1품, 10 군주 = 51). 화면(19-title.js 관직 표)과 같다.
  const RANK_LV = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 51];
  // 계급마다 필요한 누적 경험치. 혼자·쉬움 5판(평균 약 56/판)이면 2단계(270), 그 뒤로는 단계마다 요구량이 약 2배씩 는다. 군주는 옛 곡선과 같은 10만.
  const RANK_XP = [0, 100, 270, 700, 1700, 3800, 7800, 15000, 28000, 52000, 100000];
  const MAX_LV = RANK_LV[RANK_LV.length - 1];
  // 레벨 lv에 닿는 누적 경험치
  function xpAt(lv) {
    lv = Math.max(1, Math.floor(lv));
    if (lv >= MAX_LV) return RANK_XP[RANK_XP.length - 1];
    let i = 0; while (i < RANK_LV.length - 2 && lv >= RANK_LV[i + 1]) i++;
    const a = RANK_LV[i], b = RANK_LV[i + 1];
    return Math.round(RANK_XP[i] + ((lv - a) / (b - a)) * (RANK_XP[i + 1] - RANK_XP[i]));
  }
  // 경험치 → 레벨(1 ~ 51)
  function levelOf(xp) {
    xp = +xp || 0; let lv = 1;
    while (lv < MAX_LV && xpAt(lv + 1) <= xp) lv++;
    return lv;
  }
  const rankOf = (lv) => RANK_LV.reduce((k, min, i) => (lv >= min ? i : k), 0);
  // 관직이 오를 때 한 번씩 주는 동전(계급 번호 → 동전). 한 번 받은 계급은 다시 주지 않는다.
  const RANK_COINS = [0, 100, 150, 200, 250, 300, 400, 500, 600, 800, 1000];
  // 업적(판 안 업적 30여 개)을 이 계정에서 처음 달성했을 때 한 번씩 주는 동전. 목록에 없는 업적은 기본값.
  const ACH_COINS = {
    base: 50,
    small: { coins: 30, ids: ['all1', 'e_muster', 'e_first2', 'e_three2', 'e_twin2'] },
    big: { coins: 100, ids: ['all4', 'all5', 'flash40', 'flash55', 'flash70', 'm_four', 'm_five', 'm_hulao', 'm_redcliff'] },
  };
  const achCoins = (id) => (ACH_COINS.small.ids.includes(id) ? ACH_COINS.small.coins : ACH_COINS.big.ids.includes(id) ? ACH_COINS.big.coins : ACH_COINS.base);
  // 일일 미션(일본 시간 0시 초기화). stat = 판 보고에서 세는 값: games(10라운드 이상 간 판 1), combines(합성 수), bossWins(보스 처치 수)
  const DAILY = [
    { id: 'd_play2', stat: 'games', need: 2, coins: 60, xp: 30 },
    { id: 'd_comb10', stat: 'combines', need: 10, coins: 40, xp: 15 },
    { id: 'd_boss3', stat: 'bossWins', need: 3, coins: 50, xp: 25 },
  ];
  root.RTD_PROG = { RANK_LV, RANK_XP, MAX_LV, xpAt, levelOf, rankOf, RANK_COINS, ACH_COINS, achCoins, DAILY };
  if (typeof module !== 'undefined') module.exports = root.RTD_PROG;
})(typeof window !== 'undefined' ? window : globalThis);
