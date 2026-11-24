// T10 협동 탈락: 라이프가 다한 사람만 탈락(관전)하고 나머지는 계속한다(2026-11-24 사용자 결정).
// 유형: Integration · 위치: tests/engine/ · 게이트: BLOCKING
// 고치기 전 코드(RTD_ROOT=옛 코드)에서는 한 사람의 라이프 0으로 판 전체가 끝나 [A]·[B]가 실패한다.
'use strict';
const L = require('./lib');
const { ok, info, E, T, AI, NET, DT } = L;

const kill = (g) => g.loseLife(g.lives, 'test');

// [A] 3인: 방장이 아닌 사람이 R3에 탈락 → 나머지가 R12(첫 보스 R10 뒤)까지 간다
(function scenarioA() {
  const tag = '[A] 손님 탈락';
  let el = null, at = null, peek = {}, fakeSent = false;
  const r = L.runParty({
    n: 3, diff: 'easy', seed: 9101, stopRound: 12,
    each(P, step) {
      const ms = P.members;
      if (!el) {
        if (ms[0].g.round < 3 || ms[0].g.phase !== 'wave') return;
        el = ms.find((m) => !m.net.isHost());
        kill(el.g); at = el.g.round;
        peek.afterOver = el.g.over; peek.othersOver = ms.filter((m) => m !== el).map((m) => m.g.over);
        return;
      }
      // 탈락자가 거짓 판 패배 신호를 보낸다(방장은 믿지 않아야 한다)
      if (!fakeSent && step % 60 === 0) { fakeSent = true; el.net.send('phase', { p: 'over', win: false }); }
      if (el.g.enemies.length) peek.enemies = Math.max(peek.enemies || 0, el.g.enemies.length);
      const f = el.g.fight;
      if (f && el.g.phase === 'boss') { peek.boss = true; peek.champs = Math.max(peek.champs || 0, el.g.localChamps().length); }
      const h = L.hostOf(P);
      if (h === el) peek.elHost = true;
      if (h && h.g.fight && h.g.phase === 'boss') {
        peek.party = h.g.party; peek.live = h.g.partyLive;
        peek.ghostEl = peek.ghostEl || Object.keys(h.g.fight.ghosts).includes(el.net.me().id);
      }
    },
  });
  ok(!r.error, `${tag}: 예외 없음` + (r.error ? ' — ' + r.error : ''));
  if (!el) { ok(false, `${tag}: 탈락을 만들지 못함`); return; }
  const others = r.P.members.filter((m) => m !== el);
  info(`${tag}: R${at}에 #${el.i} 탈락, 끝 R${r.P.members.map((m) => m.g.round).join('/')} stopped=${!!r.stopped}`);
  ok(el.g.out === at && !peek.afterOver, `${tag}: 탈락자는 out=R${el.g.out}, 판은 끝나지 않음`);
  ok(peek.othersOver.every((x) => !x), `${tag}: 탈락 순간 다른 사람도 끝나지 않음`);
  ok(r.stopped && others.every((m) => !m.g.over && m.g.round >= 12), `${tag}: 남은 둘이 R12까지 계속함 [${others.map((m) => `R${m.g.round} ${m.g.over || '-'}`).join(' / ')}]`);
  ok(!el.g.over && el.g.round >= 12, `${tag}: 탈락자도 방장 시계를 따라 라운드가 감 (R${el.g.round})`);
  ok(!peek.enemies, `${tag}: 탈락자 라인에 적이 생기지 않음 (최대 ${peek.enemies || 0})`);
  ok(peek.boss && !peek.champs, `${tag}: 보스전에 탈락자 장수가 나가지 않음 (보스전 봄=${!!peek.boss}, 장수 ${peek.champs || 0})`);
  ok(!peek.ghostEl, `${tag}: 방장 보스전에 탈락자 그림자(표적)가 없음`);
  ok(peek.party === 3 && peek.live === 2, `${tag}: 난이도 인원은 처음 그대로 3, 싸우는 인원 2 (party=${peek.party}, live=${peek.live})`);
  ok(!peek.elHost, `${tag}: 탈락자는 방장이 되지 않음`);
  ok(others.every((m) => m.g.stats.bosses.length === 1 && m.g.stats.bosses[0].win) && el.g.round >= 11 && !el.g.over, `${tag}: R10 보스전을 남은 사람이 잡고 탈락자도 다음 라운드로 감 (${L.bossLog(others[0].g)})`);
  ok(el.g.stats.bosses.length === 0, `${tag}: 나가지 않은 보스전은 탈락자의 보스 기록(전적·일일 미션)에 들어가지 않음 (${L.bossLog(el.g)})`);
  const v = L.partyViol(r.P);
  ok(v.length === 0, `${tag}: 불변식` + (v.length ? ' — ' + v.join(' ; ') : ' 통과'));
})();

// [B] 3인: 방장이 탈락 → 다른 사람이 방장이 되고 계속, 이어서 남은 둘도 탈락하면 판 전체 패배.
//     탈락자는 결과가 '패배'이고 도달 라운드는 판이 끝난 라운드
(function scenarioB() {
  const tag = '[B] 방장 탈락 → 모두 탈락';
  let first = null, at = null, nh = null, second = false, lastAt = null;
  const r = L.runParty({
    n: 3, diff: 'easy', seed: 9202,
    each(P) {
      const ms = P.members;
      if (!first) {
        if (ms[0].g.round < 2 || ms[0].g.phase !== 'wave') return;
        first = L.hostOf(P); kill(first.g); at = first.g.round;
        return;
      }
      if (!nh) { const h = L.hostOf(P); if (h && h !== first) nh = h; }
      if (!second && ms[0].g.round >= at + 3 && ms.every((m) => m.g.phase === 'wave')) {
        second = true;
        const rest = ms.filter((m) => m !== first);
        kill(rest[0].g);
        lastAt = rest[1].g.round;
        kill(rest[1].g);
      }
    },
  });
  ok(!r.error, `${tag}: 예외 없음` + (r.error ? ' — ' + r.error : ''));
  if (!first) { ok(false, `${tag}: 탈락을 만들지 못함`); return; }
  const gs = r.P.members.map((m) => m.g);
  info(`${tag}: R${at} 방장 #${first.i} 탈락, 새 방장 #${nh ? nh.i : '-'}, R${lastAt}에 나머지 탈락 → ${gs.map((g) => `R${g.round} ${g.over}/${g.teamOver}`).join(' · ')}`);
  ok(!!nh && nh !== first, `${tag}: 싸우는 사람이 새 방장이 됨`);
  ok(second, `${tag}: 방장 탈락 뒤 3라운드를 더 감 (탈락 R${at} → R${lastAt})`);
  ok(gs.every((g) => g.over === 'lose' && g.teamOver === 'lose'), `${tag}: 모두 탈락하면 모두 패배`);
  ok(gs.every((g) => g.round === lastAt), `${tag}: 끝난 라운드가 같음 [${gs.map((g) => g.round).join(',')}]`);
  ok(first.g.resultRound === at && gs.filter((g) => g !== first.g).every((g) => g.resultRound === lastAt), `${tag}: 결과 라운드는 탈락한 라운드로 고정 (먼저 탈락 R${first.g.resultRound}=R${at}, 나머지 [${gs.filter((g) => g !== first.g).map((g) => g.resultRound).join(',')}])`);
})();

// [C] 탈락자는 팀이 이겨도 패배로 기록(teamOver=win, over=lose). 엔진만 확인
(function scenarioC() {
  const tag = '[C] 팀 승리 때 탈락자 기록';
  const hub = NET.hub(), nets = [0, 1].map((i) => hub.join('AI' + i));
  const gs = nets.map((n, i) => { const g = new E.Game(T, { diff: 'easy', mode: 'multi', seed: 9300 + i, net: n, bot: true }); n.attach(g); return g; });
  hub.flush(); gs.forEach((g, i) => nets[i].tickStatus(DT, g)); hub.flush();
  kill(gs[1]);
  ok(gs[1].out && !gs[1].over, `${tag}: 탈락(out=${gs[1].out})`);
  gs[1].finish(true);
  ok(gs[1].over === 'lose' && gs[1].teamOver === 'win', `${tag}: 내 결과 ${gs[1].over}, 팀 결과 ${gs[1].teamOver}`);
  const ev = gs[1].events.find((e) => e.type === 'over');
  ok(ev && ev.win === false && ev.team === 'win' && ev.out === gs[1].out, `${tag}: over 이벤트 win=false·team=win·out 라운드`);
})();

// [D] AI 동맹: 사람(bot 아님)이 탈락하면 예전처럼 바로 판 패배, AI가 탈락하면 AI만 빠진다
(function scenarioD() {
  const tag = '[D] AI 동맹';
  const run = (who) => {
    L.seedRandom(9400 + who);
    const hub = NET.hub(), ms = [0, 1, 2].map((i) => {
      const net = hub.join(i === 0 ? 'me' : 'AI' + i);
      const g = new E.Game(T, { diff: 'easy', mode: 'multi', seed: 9400 + i, net, bot: i > 0 });
      net.attach(g);
      return { i, g, net, brain: new AI.Brain(g, L.build(i)), active: true, watch: L.makeWatch('#' + i) };
    });
    const P = { hub, members: ms };
    for (let s = 0; s < 900; s++) L.stepParty(P); // 30초
    kill(ms[who].g);
    for (let s = 0; s < 120; s++) L.stepParty(P); // 4초
    return ms.map((m) => m.g);
  };
  const a = run(0);
  ok(a.every((g) => g.over === 'lose'), `${tag}: 사람이 라이프 0 → 모두 패배 [${a.map((g) => g.over).join(',')}]`);
  ok(!a[0].out, `${tag}: 사람은 관전으로 넘어가지 않음`);
  const b = run(1);
  ok(b[1].out && b.every((g) => !g.over), `${tag}: AI가 라이프 0 → AI만 탈락, 판은 계속 [${b.map((g) => (g.out ? 'out' : g.over || '-')).join(',')}]`);
})();

// [E] 남의 라이프 값으로 탈락시키지 않는다: 손님이 presence로 라이프 0·out을 흉내 내도 다른 사람은 그대로
(function scenarioE() {
  const tag = '[E] 거짓 라이프';
  const r = L.runParty({
    n: 3, diff: 'easy', seed: 9505, stopRound: 4,
    each(P, step) {
      if (step !== 200) return;
      const liar = P.members.find((m) => !m.net.isHost());
      liar.net.t.presence({ ln: { s: 1, u: [], e: [], g: 0, l: 0, n: 99 } });
      liar.net.send('phase', { p: 'over', win: false });
    },
  });
  ok(!r.error && r.stopped && r.P.members.every((m) => !m.g.over && !m.g.out), `${tag}: 라이프 0을 알린 손님 때문에 아무도 끝나거나 탈락하지 않음 [${r.P.members.map((m) => `R${m.g.round} ${m.g.over || '-'}`).join(' / ')}]`);
})();

L.done('t10-coop-elim');
