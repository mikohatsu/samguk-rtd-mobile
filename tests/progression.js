// 관직 곡선·판 보상 식·보상 표 시험(progression.js, 2026-11-25 economy-v2.md). 서버·네트워크 없이 표만 본다.
// 쓰는 법: node tests/progression.js
'use strict';
const P = require('../progression.js');
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const SOLO = 0.5; // 오프라인(혼자·AI 동맹) 판 인원 배율(server/app.js SEAT_MUL[0])
const g = (diff, round, win, mutLv) => P.gameReward({ diff, round, win, mutLv: mutLv || 0 }, SOLO);
const dayMissionXp = P.DAILY.reduce((s, m) => s + m.xp, 0);
// 하루 n판(같은 판) + 일일 미션 전부로 경험치 target에 닿는 날 수
const daysTo = (target, perGame, n = 3) => { let xp = 0, d = 0; while (xp < target) { d++; xp += perGame * n + dayMissionXp; } return d; };
const gamesTo = (target, perGame) => Math.ceil(target / perGame);

// 1. 구조: 계급 11개(신병 ~ 군주), 계급마다 등급 1~5(2026-11-25 사용자 결정), 레벨 = 계급×5 + 등급, 군주 = 51
ok(P.STEPS === 5 && P.RANK_LV.length === 11 && P.RANK_LV.every((lv, r) => lv === r * 5 + 1) && P.MAX_LV === 51, `계급 시작 레벨 = 계급×5+1, 군주 51 (${P.RANK_LV.join(',')})`);
ok(P.stepOf(1) === 1 && P.stepOf(5) === 5 && P.stepOf(6) === 1 && P.stepOf(50) === 5 && P.stepOf(51) === 0, '등급: 레벨 1→1, 5→5, 6→1(백인대장 1), 50→5, 51(군주)→0');
ok(P.rankOf(5) === 0 && P.rankOf(6) === 1 && P.rankOf(50) === 9 && P.rankOf(51) === 10, '계급: 레벨 5 신병, 6 백인대장, 50 대장군, 51 군주');
const tr = (k, v) => (k === 'rankStep' ? `${v.a} ${v.n}` : { rk_mil1: '백인대장', rk_mil10: '군주' }[k] || k);
ok(P.label(tr, 'rk_mil1', 8) === '백인대장 3' && P.label(tr, 'rk_mil10', 51) === '군주', `표기: 레벨 8 → "${P.label(tr, 'rk_mil1', 8)}", 군주는 이름만`);

// 2. 곡선 모양: 레벨마다 필요 경험치가 늘고, 계급 사이 요구량도 계급마다 는다. 계급 시작 = 표 값
let mono = true; for (let lv = 2; lv <= P.MAX_LV; lv++) if (P.xpAt(lv) <= P.xpAt(lv - 1)) mono = false;
ok(mono, '레벨마다 필요 누적 경험치가 늘어남');
const inc = P.RANK_XP.slice(1).map((x, i) => x - P.RANK_XP[i]);
ok(inc.every((d, i) => i === 0 || d > inc[i - 1]), `계급 사이 요구량이 계급마다 늘어남 (${inc.join(' → ')})`);
ok(P.RANK_LV.every((lv, i) => P.xpAt(lv) === P.RANK_XP[i] && P.rankOf(P.levelOf(P.RANK_XP[i])) === i), '계급 시작 레벨의 경험치 = 표 값, 그 경험치면 그 계급');
ok(P.levelOf(1e9) === 51 && P.xpAt(51) === 175000, '군주(레벨 51) = 17만 5천, 그 위로는 오르지 않음');
let roundTrip = true; for (let xp = 0; xp <= 200000; xp += 13) { const lv = P.levelOf(xp); if (P.xpAt(lv) > xp || (lv < P.MAX_LV && P.xpAt(lv + 1) <= xp)) roundTrip = false; }
ok(roundTrip, 'levelOf·xpAt 왕복: xpAt(레벨) ≤ 경험치 < xpAt(레벨+1)');

// 3. 판 경험치: 난이도 배율이 크다(혼자 기준)
const E = g('easy', 70, true).xp, N = g('normal', 90, true).xp, H = g('hard', 100, true).xp, M = g('nightmare', 120, true).xp;
ok(E === 43 && N === 119 && H === 200 && M === 330, `혼자 클리어 경험치: 쉬움 ${E} · 보통 ${N} · 어려움 ${H} · 악몽 ${M}`);
ok(N / E >= 2.5 && H / E >= 4.5 && M / E >= 7, `쉬움 대비: 보통 ×${(N / E).toFixed(1)}, 어려움 ×${(H / E).toFixed(1)}, 악몽 ×${(M / E).toFixed(1)}`);
ok(g('easy', 50, false).xp === 18 && g('normal', 80, false).xp === 63, `패배: 쉬움 R50 ${g('easy', 50, false).xp}, 보통 R80 ${g('normal', 80, false).xp}`);

// 4. 목표 표(economy-v2.md 2-2절). 사용자 지적(일일 미션 한 번 + 한두 판 = 백인대장)이 다시 생기지 않게
const day1 = E * 2 + dayMissionXp;
ok(P.rankOf(P.levelOf(day1)) === 0, `쉬움 2판 + 일일 미션 전부 = ${day1} XP → 아직 신병(${P.stepOf(P.levelOf(day1))}등급)`);
ok(P.levelOf(E) >= 2, `첫 판(쉬움 클리어 ${E} XP)에 신병 2 이상`);
const dE = daysTo(P.RANK_XP[1], E), gN = gamesTo(P.RANK_XP[1], N);
ok(dE >= 4 && dE <= 6, `쉬움만(하루 3판+미션): 백인대장까지 ${dE}일 (4~6일)`);
ok(gN >= 4 && gN <= 6, `보통 클리어만: 백인대장까지 ${gN}판 (4~6판)`);
const dN3 = daysTo(P.RANK_XP[3], N), dH5 = daysTo(P.RANK_XP[5], H), dM10 = daysTo(P.RANK_XP[10], M);
ok(dN3 >= 8 && dN3 <= 12, `보통 클리어(하루 3판): 군사마(3계급)까지 ${dN3}일 (8~12일)`);
ok(dH5 >= 18 && dH5 <= 24, `어려움 클리어(하루 3판): 중랑장(5계급)까지 ${dH5}일 (18~24일)`);
ok(dM10 >= 150 && dM10 <= 200, `악몽 클리어(하루 3판): 군주까지 ${dM10}일 (150~200일)`);

// 5. 판 동전은 v1(2026-11-24) 식과 같다
const v1Coins = (diff, round, win, mut, mul) => { const dm = { easy: 1, normal: 1.3, hard: 1.6, nightmare: 2 }[diff] * (1 + mut * 0.15); const xp = Math.round((15 + Math.min(120, round) * 0.8 + (win ? 60 : 0)) * dm); return Math.round((Math.round(xp / 5) + (win ? 20 : 0)) * mul); };
let same = true;
for (const d of ['easy', 'normal', 'hard', 'nightmare']) for (const r of [0, 9, 33, 70, 90, 120, 130]) for (const w of [false, true]) for (const m of [0, 3, 5]) for (const mul of [0.5, 0.6, 1, 1.7]) if (P.gameReward({ diff: d, round: r, win: w, mutLv: m }, mul).coins !== v1Coins(d, r, w, d === 'nightmare' ? m : m, mul)) same = false;
ok(same, '판 동전 = v1 식(난이도·라운드·승패·악몽 +N·인원 배율 표본 전부)');

// 6. 보상 표
ok(P.RANK_COINS.length === 11 && P.RANK_COINS[0] === 0 && P.RANK_COINS.slice(1).every((c, i, a) => c > 0 && (i === 0 || c >= a[i - 1])), `관직 승급 동전: 계급마다 같거나 늘어남 (${P.RANK_COINS.slice(1).join(',')}, 합 ${P.RANK_COINS.reduce((a, b) => a + b, 0)})`);
const THEME = require('../theme-samguk.js');
const achIds = THEME.achievements.map((a) => a.id), achSum = achIds.reduce((s, id) => s + P.achCoins(id), 0);
ok(P.ACH_COINS.small.ids.concat(P.ACH_COINS.big.ids).every((id) => achIds.includes(id)), '업적 보상 표의 id가 모두 실제 업적');
ok(achSum <= 500, `업적 첫 달성 보상 합 ${achSum} (${achIds.length}개) ≤ 500 (v1 1,750)`);
ok(achSum < THEME.unlock.coins[10], `업적 보상 전부(${achSum}) < 불멸 1명(${THEME.unlock.coins[10]})`);
ok(P.DAILY.length === 3 && P.DAILY.every((m) => m.need > 0 && m.coins > 0 && m.xp > 0), `일일 미션 3개 (${P.DAILY.map((m) => m.id).join(', ')})`);
ok(P.DAILY.reduce((s, m) => s + m.coins, 0) === 100, `일일 미션 동전 하루 최대 ${P.DAILY.reduce((s, m) => s + m.coins, 0)} = 100(사용자 결정)`);
ok(dayMissionXp <= E / 2, `일일 미션 경험치 하루 ${dayMissionXp} ≤ 쉬움 클리어 한 판의 절반(${E / 2})`);
ok(P.FIRSTS.length === 8 && P.FIRSTS.every((f) => f.coins > 0), `난이도 첫 클리어 8개 (합 ${P.FIRSTS.reduce((s, f) => s + f.coins, 0)})`);

console.log(`RESULT progression ok=${okN} fail=${fail}`);
process.exit(fail ? 1 : 0);
