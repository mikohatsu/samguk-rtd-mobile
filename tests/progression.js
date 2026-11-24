// 관직 곡선·보상 표 시험(progression.js, 2026-11-24 fix-progression.md). 서버·네트워크 없이 표만 본다.
// 쓰는 법: node tests/progression.js
'use strict';
const P = require('../progression.js');
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const oldXp = (lv) => 40 * (lv - 1) * (lv - 1); // 2026-11-24 전 곡선
const oldLevel = (xp) => Math.min(51, Math.floor(Math.sqrt(xp / 40)) + 1);
// 판 경험치(server/app.js xpFor × 오프라인 0.5): 쉬움
const easySolo = (round, win) => Math.round(Math.round(15 + round * 0.8 + (win ? 60 : 0)) * 0.5);

// 1. 기존 계정은 단계가 내려가지 않는다: 모든 레벨의 필요 경험치가 옛 곡선 이하, 경험치 표본마다 새 레벨 ≥ 옛 레벨
let worse = []; for (let lv = 1; lv <= 51; lv++) if (P.xpAt(lv) > oldXp(lv)) worse.push(lv);
ok(!worse.length, `모든 레벨에서 새 필요 경험치 ≤ 옛 곡선 (${worse.join(',') || '없음'})`);
let down = 0; for (let xp = 0; xp <= 120000; xp += 7) if (P.levelOf(xp) < oldLevel(xp)) down++;
ok(down === 0, `경험치 0~12만 표본에서 새 레벨이 옛 레벨보다 낮은 곳 없음 (${down})`);

// 2. 곡선 모양: 레벨이 오를수록 필요 경험치가 늘고, 계급 사이 요구량도 단계마다 는다
let mono = true; for (let lv = 2; lv <= 51; lv++) if (P.xpAt(lv) <= P.xpAt(lv - 1)) mono = false;
ok(mono, '레벨마다 필요 누적 경험치가 늘어남');
const inc = P.RANK_XP.slice(1).map((x, i) => x - P.RANK_XP[i]);
ok(inc.every((d, i) => i === 0 || d > inc[i - 1]), `계급 사이 요구량이 단계마다 늘어남 (${inc.join(' → ')})`);
ok(P.RANK_LV.every((lv, i) => P.xpAt(lv) === P.RANK_XP[i] && P.rankOf(P.levelOf(P.RANK_XP[i])) === i), '계급 시작 레벨의 경험치 = 표 값, 그 경험치면 그 계급');
ok(P.levelOf(1e9) === 51 && P.xpAt(51) === 100000, '군주(레벨 51) = 10만, 그 위로는 오르지 않음');

// 3. 혼자·쉬움 5판(클리어 75% 가정: 4승 1패, 패배는 R70 여포에서)이면 2단계(8품), 4판으로는 못 감
const five = 4 * easySolo(70, true) + easySolo(70, false), four = 4 * easySolo(70, true);
ok(P.rankOf(P.levelOf(five)) === 2, `쉬움 혼자 4승 1패(R70) = ${five} XP → 2단계`);
ok(P.rankOf(P.levelOf(four)) === 1, `쉬움 혼자 4승 = ${four} XP → 아직 1단계`);
const avg = 0.75 * easySolo(70, true) + 0.25 * easySolo(50, false);
ok(P.rankOf(P.levelOf(Math.round(avg * 5))) === 2, `평균(75% 클리어, 패배 R50) 판당 ${avg.toFixed(1)} × 5 = ${Math.round(avg * 5)} → 2단계`);

// 4. 보상 표
ok(P.RANK_COINS.length === 11 && P.RANK_COINS[0] === 0 && P.RANK_COINS.slice(1).every((c, i, a) => c > 0 && (i === 0 || c >= a[i - 1])), `관직 승급 동전: 단계마다 같거나 늘어남 (${P.RANK_COINS.slice(1).join(',')}, 합 ${P.RANK_COINS.reduce((a, b) => a + b, 0)})`);
const THEME = require('../theme-samguk.js');
const achIds = THEME.achievements.map((a) => a.id), achSum = achIds.reduce((s, id) => s + P.achCoins(id), 0);
ok(P.ACH_COINS.small.ids.concat(P.ACH_COINS.big.ids).every((id) => achIds.includes(id)), '업적 보상 표의 id가 모두 실제 업적');
ok(achSum <= 2000, `업적 첫 달성 보상 합 ${achSum} (${achIds.length}개) ≤ 2,000`);
ok(P.DAILY.length === 3 && P.DAILY.every((m) => m.need > 0 && m.coins > 0 && m.xp > 0), `일일 미션 3개 (${P.DAILY.map((m) => m.id).join(', ')})`);
ok(P.DAILY.reduce((s, m) => s + m.coins, 0) <= 200, `일일 미션 동전 하루 최대 ${P.DAILY.reduce((s, m) => s + m.coins, 0)} ≤ 200`);

console.log(`RESULT progression ok=${okN} fail=${fail}`);
process.exit(fail ? 1 : 0);
