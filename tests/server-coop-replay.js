// 협동 방 판 재연산 검증(C1, 2026-11-28) 시험 — 사용자 결정: 협동도 검증한다(방장 판 재연산 + 손님은 팀 결과 맞춰 보기).
// 유형: Integration · 게이트: BLOCKING. 서버를 이 프로세스 안에서 띄우고(json 저장소, 임시 DATA_DIR, 재연산 일꾼 켬)
// Node 기기 여럿이 진짜 WebSocket으로 방에 들어가 판을 한다(tests/coop-sim.js, 조작은 tests/engine/driver.js — g.input만).
// 표의 발급 시각만 앞당겨 다시 서명한다(벽시계 검사 — 흉내 판은 실제보다 수백 배 빨리 돈다). WS_RATE도 시험에서만 올린다.
// 시나리오 → 기대
//  1) 정직한 2인 판(조작기) → 방장(기준 판) verify ok, 손님 팀 결과 ok, 레벨 순위 값(rankXp)에 들어감, 방 기록 파일 있음
//  2) 방장 보고 조작(처치 수 +5) → 방장 bad·회수, 손님은 다른 기준 판(손님 자신)으로 재연산 → ok
//  3) 3인 판, 손님1 라운드 +1·손님2 승패 뒤집기 → 둘 다 bad(coop_team), 방장 ok
//  4) 방장 소식 위조(판에 없는 pattern 소식을 보냄) → 방장 bad(out.msg.pattern), 손님은 ok
//  5) 방장 바뀜: 판 도중 방장이 나감 → 새 방장(손님) 보고가 기준 판 → ok
//  6) 다시 붙기: 방장 연결을 끊었다가 다시 붙음(J 기록) → 둘 다 ok
//  7) 예전 앱(기록 없음) → norec(coop_norec), 보상 유지
//  8) 아이폰(pf jsc) 방장 조작 → 회수하지 않고 norec(would_revoke:jsc:)
//  방 판 씨앗을 서버가 정한다(2026-11-28, production/team/2026-11-28/coop-seed.md):
// 10) 서버 씨앗 정직한 판(악몽 +2) → 모두 서버가 준 씨앗·규칙(Game.rollMuts(서버 씨앗))으로 시작, 기록 머리 v2 ss = 그 씨앗, 표 씨앗도 같음, 둘 다 ok
// 11) 방장이 서버 씨앗을 무시하고 자기 씨앗으로 판을 만듦(조작) → 방장 bad(replay:seed)·회수, 손님 ok
// 12) 방장이 예전 방식(자기 씨앗)으로 시작 신호를 보내면서 새 앱 기록을 냄(조작) → 방장 bad(replay:seed), 손님 norec(coop_hostseed)
// 13) 예전 앱 방장(기록 없음·자기 씨앗) + 새 앱 손님 → 둘 다 norec(coop_norec·coop_hostseed), 보상 유지
// 14) 다시 시작: 같은 방에서 판을 버리고 다시 시작하면 새 씨앗, 머리에 시작 번호 n·버린 판 ab·계정 시작 수 hs, 늦은 표 요청은 자기 판 시작에 묶임,
//     다시 들어온 새 화면은 앞 판 시작을 받지 않음, 같은 자리의 빠른 다시 요청은 앞 시작을 되돌려 줌, 연결이 없으면 start()가 false
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-coop-'));
Object.assign(process.env, { DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '', REPLAY_MODE: 'enforce', WS_RATE: '1000000' });
const ROOT = process.env.RTD_ROOT ? path.resolve(process.env.RTD_ROOT) : path.join(__dirname, '..');
const SIM = require('./coop-sim');
const app = require(path.join(ROOT, 'server', 'app.js'));
const REPLAY = require(path.join(ROOT, 'server', 'replay.js'));
const RC = require(path.join(ROOT, 'server', 'replay-core.js'));
let RLOG = null; try { RLOG = require(path.join(ROOT, 'server', 'room-log.js')); } catch (e) { RLOG = null; }
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const info = (m) => console.log('     ' + m);
let PORT = 0, store = null;
const api = async (p, body, tok, hdr) => {
  const go = () => fetch(`http://127.0.0.1:${PORT}${p}`, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}, hdr || {}), body: body === undefined ? undefined : JSON.stringify(body) });
  let r; try { r = await go(); } catch (e) { r = await go(); }
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
const key = () => fs.readFileSync(path.join(DATA, 'ticket.key'));
const sign = (o) => { const body = Buffer.from(JSON.stringify(o)).toString('base64url'); return body + '.' + crypto.createHmac('sha256', key()).update(body).digest('base64url'); };
const decode = (tk) => JSON.parse(Buffer.from(String(tk).split('.')[0], 'base64url').toString('utf8'));
const aged = (tk, sec) => sign(Object.assign(decode(tk), { t: Date.now() - sec * 1000 }));
// 게스트 계정 만들기는 주소당 1시간 20개(app.js) → 시험은 계정 10개마다 다른 주소로(서버는 앞단 프록시 127.0.0.1의 X-Forwarded-For를 믿는다)
let guestN = 0;
const guest = async (nick) => { const r = await api('/api/guest/new', { nick, agree: true }, null, { 'x-forwarded-for': '10.9.' + Math.floor(guestN++ / 10) + '.1' }); return { tok: r.token, uid: r.me.id }; };
let roomN = 0;
const O = () => ({ port: PORT, api });

// 판 하나: 기기 n개(앞 = 방장). opt: { passive, hooks: [기기별 훅], onFrame }
async function game(tag, n, opt) {
  const users = []; for (let i = 0; i < n; i++) users.push(await guest(tag.slice(0, 6) + i));
  const cs = users.map((u, i) => SIM.makeClient(O(), 'P' + i, u.tok, 100 * (roomN + 1) + i, Object.assign({ passive: !!(opt && opt.passive) }, (opt && opt.hooks && opt.hooks[i]) || {})));
  const code = 'cr' + (++roomN) + crypto.randomBytes(2).toString('hex');
  const t = await SIM.playRoom(O(), cs, Object.assign({ code, diff: 'easy', onFrame: opt && opt.onFrame ? (f) => opt.onFrame(f, cs) : null }, (opt && opt.room) || {}));
  cs.forEach((c, i) => { c.uid = users[i].uid; });
  cs.code = code;
  info(`${tag}: ${n}인 판 ${t.frames}프레임 ${t.ms}ms — ${cs.map((c) => `${c.name} ${c.active ? '' : '(나감)'}R${c.g.round} ${c.g.over || '-'} out=${c.g.out | 0} 걸음 ${c.g.stepN}`).join(' / ')}`);
  return cs;
}
// 보고(앱 reportResult와 같은 본문 + gzip 기록). edit(body)로 조작
async function report(c, edit) {
  const body = c.body(), rec = c.rec();
  if (rec) body.rec = RC.encodeRec(rec);
  if (edit) edit(body);
  body.ticket = aged(c.ticket, Math.max(body.round, 1) * 15 + 60);
  const r = await api('/api/result', body, c.tok);
  return Object.assign(r, { recLen: body.rec ? body.rec.length : 0 });
}
async function settleAll() {
  if (RLOG) await RLOG.flushAll('test'); // 판이 끝난 방 기록을 바로 닫는다(운영에서는 방장 over 15초 뒤·방이 빔 등)
  await SIM.sleep(100);
  if (REPLAY.retryNow) REPLAY.retryNow();
  await REPLAY.drain(60000);
}
const V = async (r) => store.result(r.id);
// 방 기록 머리 파일들(시작 순서)
const headsOf = (code) => { const d = path.join(DATA, 'replay', 'rooms'); let l = []; try { l = fs.readdirSync(d); } catch (e) { l = []; } return l.filter((f) => f.startsWith(code + '-') && f.endsWith('.head.json')).map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))).sort((a, b) => a.startAt - b.startAt); };
// 예전 방식 시작 신호(방장이 씨앗을 고름 — 예전 앱 net.start와 같은 모양)
const oldStart = (seed) => (host, o) => host.net.t.send('start', { diff: o.diff || 'easy', seed, muts: o.muts || [], mutLv: o.mutLv || 0 });
const xpOf = async (c) => (await api('/api/me', undefined, c.tok)).me.xp;

(async () => {
  try {
    const s = await app.start({ port: 0, replay: true });
    PORT = s.server.address().port; store = s.store;
    if (REPLAY.COOP) { REPLAY.COOP.retryMs = 30; REPLAY.COOP.anchorWaitMs = 300; }

    // 1) 정직한 2인 판
    {
      const [h, g] = await game('정직', 2);
      const rh = await report(h), rg = await report(g);
      ok(!rh.rejected && rh.gained > 0 && !rg.rejected && rg.gained > 0, `판 끝에 바로 보상(방장 ${rh.gained}, 손님 ${rg.gained}, 기록 gzip+base64 ${rh.recLen}/${rg.recLen}B)`);
      const t0 = Date.now(); await settleAll();
      const vh = await V(rh), vg = await V(rg);
      ok(vh && vh.verify === 'ok', `방장 판 재연산 → ok (${vh && vh.verify} ${vh && vh.note}, ${Date.now() - t0}ms)`);
      ok(vg && vg.verify === 'ok', `손님 보고 = 팀 결과 → ok (${vg && vg.verify} ${vg && vg.note})`);
      const uh = await store.getUser(h.uid), ug = await store.getUser(g.uid);
      ok(uh.rankXp === rh.gained && ug.rankXp === rg.gained, `레벨 순위 값에 들어감(${uh.rankXp}/${rh.gained}, ${ug.rankXp}/${rg.gained})`);
      const rooms = fs.existsSync(path.join(DATA, 'replay', 'rooms')) ? fs.readdirSync(path.join(DATA, 'replay', 'rooms')) : [];
      ok(rooms.some((f) => f.endsWith('.json.gz')) && rooms.some((f) => f.endsWith('.head.json')), `방 중계 기록 파일(${rooms.filter((f) => f.endsWith('.gz')).map((f) => f + ' ' + fs.statSync(path.join(DATA, 'replay', 'rooms', f)).size + 'B').join(', ')})`);
    }
    // 2) 방장 보고 조작
    {
      const [h, g] = await game('방장조작', 2, { passive: true });
      const rh = await report(h, (b) => { b.st.kills += 5; }), rg = await report(g);
      const x0 = await xpOf(h);
      await settleAll();
      const vh = await V(rh), vg = await V(rg), x1 = await xpOf(h);
      ok(vh && vh.verify === 'bad' && /coop_mismatch:.*st\.kills/.test(vh.note || ''), `방장 처치 수 조작 → bad (${vh && vh.note})`);
      ok(x1 === x0 - rh.gained, `방장 경험치 회수(${x0} → ${x1})`);
      ok(vg && vg.verify === 'ok' && /coop_anchor/.test(vg.note || ''), `손님 판이 대신 기준 판으로 재연산 → ok (${vg && vg.note})`);
    }
    // 3) 3인, 손님 보고 조작(라운드 +1, 승패 뒤집기)
    {
      const [h, g1, g2] = await game('손님조작', 3, { passive: true });
      const rh = await report(h), r1 = await report(g1, (b) => { b.round += 1; }), r2 = await report(g2, (b) => { b.win = !b.win; });
      await settleAll();
      const vh = await V(rh), v1 = await V(r1), v2 = await V(r2);
      ok(vh && vh.verify === 'ok', `방장 ok (${vh && vh.note})`);
      ok(v1 && v1.verify === 'bad' && /coop_team:.*round/.test(v1.note || ''), `손님 라운드 +1 → bad (${v1 && v1.note})`);
      ok(!r2.rejected ? v2 && v2.verify === 'bad' && /coop_team:.*win/.test(v2.note || '') : true, `손님 승패 뒤집기 → bad (${r2.rejected ? '서버가 바로 거절' : v2 && v2.note})`);
    }
    // 4) 방장 소식 위조: 판이 내지 않은 pattern 소식을 방장이 보낸다
    {
      let sent = false;
      const [h, g] = await game('소식위조', 2, { passive: true, onFrame: (f, cs) => { if (!sent && f === 200) { sent = true; cs[0].net.send('pattern', { n: 'fake' }); } } });
      const rh = await report(h), rg = await report(g);
      await settleAll();
      const vh = await V(rh), vg = await V(rg);
      ok(sent && vh && vh.verify === 'bad' && /out\.msg\.pattern/.test(vh.note || ''), `방장 소식 위조 → bad (${vh && vh.note})`);
      ok(vg && vg.verify === 'ok', `손님은 ok (${vg && vg.note})`);
    }
    // 5) 방장 바뀜: 판 도중 방장이 나감
    {
      let left = false;
      const [h, g] = await game('방장바뀜', 2, { passive: true, onFrame: (f, cs) => { if (!left && cs[0].g && cs[0].g.round >= 2) { left = true; cs[0].active = false; cs[0].net.leave(); } } });
      ok(left && g.g.over && g.net.isHost(), `방장이 나간 뒤 손님이 방장이 되어 판을 끝냄(${g.g.over} R${g.g.round})`);
      const rg = await report(g);
      await settleAll();
      const vg = await V(rg);
      ok(vg && vg.verify === 'ok' && /coop_anchor/.test(vg.note || ''), `새 방장(손님) 판이 기준 판 → ok (${vg && vg.note})`);
      void h;
    }
    // 6) 다시 붙기: 방장 연결을 끊었다가 다시 붙음
    {
      let dropped = false, back = false;
      const [h, g] = await game('다시붙기', 2, { passive: true, onFrame: (f, cs) => {
        if (!dropped && cs[0].g && cs[0].g.round >= 2) { dropped = true; cs[0].drop(); }
        if (dropped && !back && cs[0].net.sync) back = true;
      } });
      const recH = h.rec(), js = recH ? recH.c.filter((x) => x[1] === 'J').length : 0;
      ok(dropped && js >= 1, `방장 기록에 다시 붙음(J) ${js}번, 따라잡기(sync)=${back}`);
      const rh = await report(h), rg = await report(g);
      await settleAll();
      const vh = await V(rh), vg = await V(rg);
      ok(vh && vh.verify === 'ok', `다시 붙은 방장 판 재연산 → ok (${vh && vh.note})`);
      ok(vg && vg.verify === 'ok', `손님 ok (${vg && vg.note})`);
    }
    // 7) 예전 앱: 기록 없음
    {
      const [h, g] = await game('예전앱', 2, { passive: true, hooks: [{ noRec: true }, { noRec: true }] });
      const rh = await report(h), rg = await report(g);
      await settleAll();
      const vh = await V(rh), vg = await V(rg), xh = await xpOf(h);
      ok(vh && vh.verify === 'norec' && vh.note === 'coop_norec' && vg && vg.verify === 'norec', `예전 앱 협동 판 → norec (${vh && vh.note}, ${vg && vg.note})`);
      ok(xh >= rh.gained && rh.gained > 0, `보상 유지(경험치 ${xh})`);
    }
    // 8) 아이폰(jsc) 방장 조작 → 회수하지 않고 기록만
    {
      const [h, g] = await game('아이폰', 2, { passive: true, hooks: [{ pf: 'jsc' }, {}] });
      const rh = await report(h, (b) => { b.st.kills += 5; }), rg = await report(g);
      const x0 = await xpOf(h);
      await settleAll();
      const vh = await V(rh), vg = await V(rg), x1 = await xpOf(h);
      ok(vh && vh.verify === 'norec' && /^would_revoke:jsc:coop_mismatch/.test(vh.note || '') && x1 === x0, `JSC 방장 불일치 → norec·회수 없음 (${vh && vh.note}, 경험치 ${x0} → ${x1})`);
      ok(vg && vg.verify === 'ok', `손님은 다른 기준 판으로 ok (${vg && vg.note})`);
    }
    // 9) 큰 기록은 따로: 결과에 recLater만 싣고 기록은 /api/result/rec로(앱 18-account: gzip 60KB 넘는 협동 기록)
    {
      const [h, g] = await game('따로기록', 2, { passive: true });
      const rec = RC.encodeRec(h.rec());
      const rh = await report(h, (b) => { delete b.rec; b.recLater = 1; }), rg = await report(g);
      const bad = await api('/api/result/rec', { ticket: g.ticket, rec }, h.tok); // 남의 표로 붙이기 → 거절
      const att = await api('/api/result/rec', { ticket: h.ticket, rec }, h.tok);
      const again = await api('/api/result/rec', { ticket: h.ticket, rec: rec + 'x' }, h.tok); // 이미 붙음 → 바꾸지 않음
      ok(bad.status === 400 && att.ok === true && again.ok === false, `따로 보낸 기록: 남의 표 거절(${bad.status}), 내 표 붙음(${att.ok}), 두 번째는 안 바뀜(${again.ok})`);
      await settleAll();
      const vh = await V(rh), vg = await V(rg);
      ok(vh && vh.verify === 'ok' && vg && vg.verify === 'ok', `따로 온 기록으로 재연산 → ok (${vh && vh.note}, ${vg && vg.note})`);
      const big = 'A'.repeat(500 * 1024);
      const rb = await api('/api/result/rec', { ticket: h.ticket, rec: big }, h.tok);
      ok(rb.status === 200, `기록 주소는 500KB 본문을 읽음(${rb.status})`);
    }
    // ---- 방 판 씨앗을 서버가 정한다(2026-11-28) ----
    const E0 = require(path.join(ROOT, 'engine.js')), T0 = require(path.join(ROOT, 'theme-samguk.js'));
    const waitStart = async (cs) => { for (let i = 0; i < 200 && cs.some((c) => !c.startD); i++) await SIM.sleep(10); return cs.every((c) => c.startD); };
    // 10) 서버 씨앗 정직한 판: 방장이 실어 보낸 규칙(muts)은 쓰지 않는다(쉬움이라 규칙 없음)
    {
      const cs = await game('서버씨앗', 2, { passive: true, room: { muts: ['x_host_pick'] } });
      const [h, g] = cs;
      if (RLOG) await RLOG.flushAll('test'); // 판 기록 머리를 바로 쓴다
      const hd = headsOf(cs.code)[0] || {}, ss = hd.ss >>> 0;
      ok(hd.v === 2 && ss > 0 && h.startD.seed >>> 0 === ss && g.startD.seed >>> 0 === ss && h.g.seed === ss && g.g.seed === ss, `모두 서버 씨앗으로 시작(머리 v${hd.v} ss ${ss}, 방장 ${h.startD.seed}, 손님 ${g.startD.seed})`);
      ok(h.startD.muts.length === 0 && g.startD.muts.length === 0 && JSON.stringify(hd.muts) === '[]', `방장이 고른 규칙은 버려짐(방장 ${JSON.stringify(h.startD.muts)}, 머리 ${JSON.stringify(hd.muts)})`);
      ok(decode(h.ticket).s >>> 0 === ss && decode(g.ticket).s >>> 0 === ss && decode(h.ticket).g === hd.startAt, `표 씨앗 = 서버 씨앗, 표 판 시각 = 그 시작(${decode(h.ticket).s}, ${decode(h.ticket).g}/${hd.startAt})`);
      const rh = await report(h), rg = await report(g);
      await settleAll();
      const vh = await V(rh), vg = await V(rg);
      ok(vh && vh.verify === 'ok' && vg && vg.verify === 'ok', `서버 씨앗 정직한 판 → ok (${vh && vh.verify} ${vh && vh.note}, ${vg && vg.verify} ${vg && vg.note})`);
    }
    // 10b) 악몽 +2 시작: 규칙 = Game.rollMuts(테마, 2, 서버 씨앗)(혼자 판이 표 씨앗으로 정하는 것과 같은 함수), 모두 같은 규칙
    {
      const us = [await guest('악몽0'), await guest('악몽1')], code = 'nm' + crypto.randomBytes(3).toString('hex');
      const cs = us.map((u, i) => SIM.makeClient(O(), 'N' + i, u.tok, 700 + i, { passive: true }));
      for (const c of cs) { await c.connect(code); await SIM.sleep(30); }
      await SIM.sleep(100);
      cs[0].net.start('nightmare', { muts: ['x_host_pick'], mutLv: 2 });
      const got = await waitStart(cs), sd = got ? cs[0].startD : {}, want = got ? E0.Game.rollMuts(T0, 2, sd.seed >>> 0) : null;
      ok(got && want.length === 2 && JSON.stringify(sd.muts) === JSON.stringify(want) && JSON.stringify(cs[1].startD.muts) === JSON.stringify(want) && sd.mutLv === 2, `악몽 +2 규칙 = rollMuts(서버 씨앗 ${sd.seed}) ${JSON.stringify(want)} (방장 ${JSON.stringify(sd.muts)}, 손님 ${JSON.stringify(got && cs[1].startD.muts)})`);
      cs.forEach((c) => c.net.leave());
    }
    // 11) 방장이 서버 씨앗을 무시하고 자기 씨앗으로 판을 만든다
    {
      const [h, g] = await game('씨앗조작', 2, { passive: true, hooks: [{ startEdit: (s) => Object.assign(s, { seed: 4242 }) }, {}] });
      const rh = await report(h), rg = await report(g);
      const x0 = await xpOf(h);
      await settleAll();
      const vh = await V(rh), vg = await V(rg), x1 = await xpOf(h);
      ok(h.g.seed === 4242 && vh && vh.verify === 'bad' && vh.note === 'replay:seed', `방장이 서버 씨앗이 아닌 씨앗 → bad (${vh && vh.verify} ${vh && vh.note})`);
      ok(rh.gained > 0 && x1 === x0 - rh.gained, `방장 경험치 회수(${x0} → ${x1})`);
      ok(vg && vg.verify === 'ok', `손님은 ok (${vg && vg.note})`);
    }
    // 12) 방장이 예전 방식 시작 신호(자기 씨앗)를 보내면서 새 앱 기록을 낸다
    {
      const cs = await game('예전신호', 2, { passive: true, room: { startFn: oldStart(777) } });
      const [h, g] = cs;
      const rh = await report(h), rg = await report(g);
      const xg0 = await xpOf(g);
      await settleAll();
      const hd = headsOf(cs.code)[0] || {};
      const vh = await V(rh), vg = await V(rg), xg1 = await xpOf(g);
      ok(hd.v === 2 && hd.ss === 0 && h.g.seed === 777 && g.g.seed === 777, `예전 방식 시작은 머리에 ss 0(방장이 고른 씨앗 ${g.g.seed}, v${hd.v} ss ${hd.ss})`);
      ok(vh && vh.verify === 'bad' && vh.note === 'replay:seed', `그 시작을 보낸 새 앱 방장 → bad (${vh && vh.verify} ${vh && vh.note})`);
      ok(vg && vg.verify === 'norec' && vg.note === 'coop_hostseed' && rg.gained > 0 && xg1 === xg0, `손님 → norec·보상 유지 (${vg && vg.verify} ${vg && vg.note}, 경험치 ${xg0} → ${xg1})`);
    }
    // 13) 예전 앱 방장(기록 없음, 자기 씨앗, 표 요청에 씨앗 없음) + 새 앱 손님
    {
      const [h, g] = await game('예전방장', 2, { passive: true, hooks: [{ noRec: true, oldTk: true }, {}], room: { startFn: oldStart(31337) } });
      const rh = await report(h), rg = await report(g);
      await settleAll();
      const vh = await V(rh), vg = await V(rg), xh = await xpOf(h), xg = await xpOf(g);
      ok(vh && vh.verify === 'norec' && vh.note === 'coop_norec' && vg && vg.verify === 'norec' && vg.note === 'coop_hostseed', `예전 앱 방장 방 → norec (${vh && vh.note}, ${vg && vg.note})`);
      ok(rh.gained > 0 && rg.gained > 0 && xh >= rh.gained && xg >= rg.gained, `보상 유지(방장 ${xh}/${rh.gained}, 손님 ${xg}/${rg.gained})`);
    }
    // 14) 다시 시작
    {
      if (app.SEEDCFG) app.SEEDCFG.dupMs = 300; // 같은 자리의 빠른 다시 요청 묶음(운영 15초)을 이 시험만 줄인다
      const users = [await guest('다시0'), await guest('다시1')], code = 'rs' + crypto.randomBytes(3).toString('hex');
      const mk = (i, tag) => SIM.makeClient(O(), 'P' + i + tag, users[i].tok, 900 + i, { passive: true });
      const a = [mk(0, 'a'), mk(1, 'a')];
      for (const c of a) { await c.connect(code); await SIM.sleep(30); }
      await SIM.sleep(100);
      const sent1 = a[0].net.start('easy', { muts: [], mutLv: 0 });
      ok(sent1 === true && (await waitStart(a)), `첫 시작: 서버 답을 받아 모두 시작(${a.map((c) => c.startD && c.startD.seed).join('/')})`);
      const seed1 = a[0].startD ? a[0].startD.seed >>> 0 : 0;
      for (const c of a) if (c.startD) await c.begin(); // 판을 만들고 표를 받는다(버리는 판)
      a.forEach((c) => c.net.leave()); await SIM.sleep(150);
      // 다시 들어온 새 화면: 서버가 앞 시작을 다시 보내도(방장 자리, 30초 안) 이 Net은 요청하지 않았으므로 받지 않는다
      const b = [mk(0, 'b'), mk(1, 'b')];
      for (const c of b) { await c.connect(code); await SIM.sleep(30); }
      await SIM.sleep(300);
      // 새 화면의 연결이 한 번 끊겼다 다시 붙음(hello 뒤 서버가 앞 시작을 다시 보낸다 — 이미 있는 Net이 받는 경우)
      b[0].drop();
      let relinked = false, cut = false;
      for (let i = 0; i < 400 && !relinked; i++) { await SIM.sleep(10); const L = !!(b[0].net.t.linked && b[0].net.t.linked()); if (!L) cut = true; else if (cut) relinked = true; }
      await SIM.sleep(200);
      ok(relinked && !b[0].startD && !b[1].startD, `다시 들어온 화면은 다시 붙어도 앞 판 시작을 받지 않음(다시 붙음 ${relinked}, ${b[0].startD ? 'got ' + b[0].startD.seed : '없음'})`);
      await SIM.sleep(350); // dupMs 지남
      b[0].net.start('easy', { muts: [], mutLv: 0 });
      const got2 = await waitStart(b), seed2 = got2 ? b[0].startD.seed >>> 0 : 0;
      ok(got2 && seed2 > 0 && seed2 !== seed1 && b[1].startD.seed >>> 0 === seed2, `다시 시작하면 새 씨앗(${seed1} → ${seed2})`);
      // 같은 자리의 빠른 다시 요청(답이 늦어 다시 누름): 새 씨앗 없이 앞 시작을 되돌려 준다
      if (app.SEEDCFG) app.SEEDCFG.dupMs = 15000;
      let echo = null;
      const pinned0 = RLOG ? RLOG.stats().pinned : 0;
      if (b[0].net.t.ask) { b[0].net.t.on('start', (d) => { echo = d; }); b[0].net.t.ask('start', { diff: 'easy', mutLv: 0, ss: 1 }); }
      await SIM.sleep(200);
      ok(!!echo && echo.seed >>> 0 === seed2 && !!RLOG && RLOG.stats().pinned === pinned0, `빠른 다시 요청 → 앞 시작(${echo && echo.seed}) 그대로, 새 판 기록 없음`);
      // 늦은 표 요청: 앞 판 씨앗을 실으면 앞 시작에, 없으면 마지막 시작에 묶인다
      const t1 = decode((await api('/api/game/start', { diff: 'easy', room: code, seed: seed1, save: false }, users[1].tok)).ticket);
      const t2 = decode((await api('/api/game/start', { diff: 'easy', room: code, save: false }, users[1].tok)).ticket);
      ok(t1.s >>> 0 === seed1 && t2.s >>> 0 === seed2 && t1.g < t2.g, `표가 자기 판 시작에 묶임(앞 판 ${t1.s}@${t1.g}, 새 판 ${t2.s}@${t2.g})`);
      // 연결이 없으면 start()가 false(화면이 '서버에 연결할 수 없음'을 알린다)
      const d0 = mk(0, 'd'); await d0.connect(code + 'x'); await SIM.sleep(50);
      d0.drop(); await SIM.sleep(20);
      const sentOff = d0.net.start('easy', { muts: [], mutLv: 0 });
      ok(sentOff === false && !(d0.net.startPending && d0.net.startPending()), `연결이 끊긴 동안 시작 → false(${sentOff})`);
      d0.net.leave();
      b.forEach((c) => c.net.leave());
      if (RLOG) await RLOG.flushAll('test');
      const hs = headsOf(code);
      info(`머리: ${JSON.stringify(hs.map((x) => ({ n: x.n, ss: x.ss, ab: x.ab, hs: x.hs, fin: x.fin })))}`);
      ok(hs.length === 2 && hs[0].n === 1 && hs[1].n === 2 && hs[0].ss === seed1 && hs[1].ss === seed2 && hs[0].fin === 'restart' && hs[1].ab === 1 && hs[1].hs >= 2 && hs[0].byUid === users[0].uid, '방 기록 머리: 시작 번호 n 1·2, 앞 판 fin restart, 새 판 ab 1(버리고 다시 시작), 계정 시작 수 hs ≥ 2, 시작한 계정');
    }
    const st = REPLAY.stats();
    info(`일꾼 통계: ok ${st.ok}, bad ${st.bad}, norec ${st.norec}, 재연산 ${st.n}판 평균 ${st.n ? Math.round(st.ms / st.n) : 0}ms` + (RLOG ? `, 방 기록 ${JSON.stringify(RLOG.stats())}` : ''));
  } catch (e) { ok(false, '예외: ' + (e && String(e.stack).split('\n').slice(0, 6).join(' | '))); }
  REPLAY.stop();
  console.log(`RESULT server-coop-replay ok=${okN} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
