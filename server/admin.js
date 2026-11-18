// 운영 도구(명령줄): 신고 열람, 채팅 금지, 계정 정지. 관리 화면·원격 API는 없다 — 서버에 SSH로 들어온 사람만 쓴다.
// 서버에서:
//   sudo -u rtd env $(sudo cat /etc/rtd-online.env | xargs) node /opt/rtd-online/server/admin.js <명령>
// 저장소는 서버와 같은 것을 쓴다(DATABASE_URL이 있으면 PostgreSQL, 없으면 DATA_DIR의 JSON 파일).
// 제재는 저장소에만 적는다. 돌고 있는 서버가 30초마다 다시 읽어 적용한다(정지된 계정의 열린 연결도 그때 끊는다).
// 기준과 절차는 server/MODERATION.md.
'use strict';
const path = require('path'), os = require('os');
const { openStore } = require('./store');

const DAY = 86400000, HOUR = 3600000;
const PERM = Date.UTC(9999, 11, 31); // 영구 = 먼 미래 날짜
const USAGE = `쓰는 법: node server/admin.js <명령>

  reports [--days N] [--target 계정ID]   최근 신고 목록과 대상별 건수(기본 7일)
  user <계정ID 또는 닉네임>              계정 요약(닉네임·제공자·가입일·판 수·받은 신고·현재 제재)
  mute <계정ID> <기간> <사유>            채팅 금지(게임은 된다)
  unmute <계정ID>                        채팅 금지 풀기
  ban <계정ID> <기간> <사유>             계정 정지(로그인·API·접속 모두 거절)
  unban <계정ID>                         계정 정지 풀기
  log [--n N]                            제재 이력(기본 50줄)

  기간: 1h | 1d | 7d | 30d | perm  (숫자+h 또는 숫자+d, perm = 영구)
  예:   node server/admin.js mute g1a2b3c4d5e6f 1d "욕설"
  걸거나 푼 제재는 서버가 30초 안에 적용한다. 시각은 일본·한국 시간(UTC+9).`;

// 화면에 찍는 글에서 제어 문자를 뺀다(신고 내용·닉네임은 남이 보낸 글이다. 터미널 제어 문자가 섞여 들어오지 않게)
const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\ufeff]/g, ' ');
// 글자 너비: 한글·한자·가나·전각은 두 칸
const wide = (c) => { const n = c.codePointAt(0); return (n >= 0x1100 && n <= 0x115f) || (n >= 0x2e80 && n <= 0xa4cf) || (n >= 0xac00 && n <= 0xd7a3) || (n >= 0xf900 && n <= 0xfaff) || (n >= 0xfe30 && n <= 0xfe4f) || (n >= 0xff00 && n <= 0xff60) || (n >= 0xffe0 && n <= 0xffe6) || n >= 0x1f300; };
const wlen = (s) => Array.from(s).reduce((n, c) => n + (wide(c) ? 2 : 1), 0);
function table(head, rows) {
  const all = [head].concat(rows).map((r) => r.map(clean));
  const w = head.map((_, i) => Math.max(...all.map((r) => wlen(r[i]))));
  const line = (r) => r.map((c, i) => c + ' '.repeat(w[i] - wlen(c))).join('  ').trimEnd();
  return [line(all[0]), w.map((n) => '-'.repeat(n)).join('  ')].concat(all.slice(1).map(line)).join('\n');
}
const p2 = (n) => String(n).padStart(2, '0');
const when = (ms) => { if (!ms) return '-'; if (ms >= PERM - DAY) return '영구'; const d = new Date(ms + 9 * HOUR); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
const say = (s) => process.stdout.write(s + '\n');
class Usage extends Error {}
const usage = (why) => { throw new Usage(why || ''); };

// 인자: --이름 값 꼴은 opts로, 나머지는 순서대로
function parse(argv) {
  const pos = [], opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const k = argv[i].slice(2); if (i + 1 >= argv.length) usage(`--${k} 뒤에 값이 없습니다.`); opts[k] = argv[++i]; }
    else pos.push(argv[i]);
  }
  return { pos, opts };
}
const intOpt = (v, def, min, max, name) => { if (v == null) return def; if (!/^\d{1,6}$/.test(v) || +v < min || +v > max) usage(`--${name}은(는) ${min}~${max} 사이의 숫자입니다.`); return +v; };
const ID_OK = /^[A-Za-z0-9_]{1,32}$/;
const idArg = (v) => { if (!v || !ID_OK.test(v)) usage('계정 ID를 확인하세요(영문·숫자·밑줄, 32자까지). 닉네임으로는 제재할 수 없습니다 — 먼저 user <닉네임>으로 계정 ID를 찾으세요.'); return v; };
// 기간 → 끝나는 시각(ms)
function untilOf(v) {
  if (v === 'perm') return PERM;
  const m = /^(\d{1,4})([hd])$/.exec(v || ''); if (!m) usage('기간은 1h | 1d | 7d | 30d | perm 꼴입니다.');
  const n = +m[1], span = n * (m[2] === 'h' ? HOUR : DAY);
  if (n < 1 || span > 3650 * DAY) usage('기간은 1시간부터 3650일까지입니다. 그보다 길면 perm을 쓰세요.');
  return Date.now() + span;
}
const actor = () => clean(process.env.SUDO_USER || (() => { try { return os.userInfo().username; } catch (e) { return ''; } })() || 'admin').slice(0, 40);
const providerOf = (u) => u.prov || (u.pw ? 'password' : 'guest');
const sanctionText = (s) => {
  const now = Date.now(), out = [];
  if (s.mutedUntil > now) out.push(`채팅 금지 ~ ${when(s.mutedUntil)}${s.muteReason ? ` (${clean(s.muteReason)})` : ''}`);
  if (s.bannedUntil > now) out.push(`계정 정지 ~ ${when(s.bannedUntil)}${s.banReason ? ` (${clean(s.banReason)})` : ''}`);
  return out.length ? out.join(' / ') : '없음';
};

const CMDS = {
  async reports(store, { pos, opts }) {
    if (pos.length) usage();
    const days = intOpt(opts.days, 7, 1, 3650, 'days'), target = opts.target == null ? null : idArg(opts.target);
    const list = await store.listReports({ since: Date.now() - days * DAY, target, limit: 500 });
    say(`최근 ${days}일 신고 ${list.length}건${target ? ` (대상 ${target})` : ''}${list.length >= 500 ? ' — 500건까지만 보인다' : ''}`);
    if (!list.length) return;
    say('');
    say(table(['시각', '신고자', '대상 계정', '대상 닉네임', '방', '내용'], list.map((r) => [when(r.at), r.by || '(탈퇴)', r.target || '(못 찾음)', r.targetNick || r.nick || '', r.room, r.text])));
    // 대상별 건수: 건수와 서로 다른 신고자 수(한 사람이 여러 번 신고한 것과 여러 사람이 신고한 것을 가려 본다)
    const by = new Map();
    list.forEach((r) => { const k = r.target || '(못 찾음)'; const e = by.get(k) || { n: 0, who: new Set(), nick: r.targetNick || r.nick || '' }; e.n++; if (r.by && r.by !== r.target) e.who.add(r.by); by.set(k, e); });
    say('');
    say('대상별 요약');
    say(table(['대상 계정', '닉네임', '건수', '신고자 수'], [...by.entries()].sort((a, b) => b[1].who.size - a[1].who.size || b[1].n - a[1].n).map(([k, e]) => [k, e.nick, String(e.n), String(e.who.size)])));
    say('');
    say('※ 내용·닉네임 칸은 신고한 사람의 기기가 보낸 글이다(서버가 채팅을 따로 저장하지 않는다). 한 사람의 신고만으로 판단하지 않는다.');
  },
  async user(store, { pos }) {
    if (pos.length !== 1) usage();
    const list = await store.findUsers(pos[0]);
    if (!list.length) { say('그런 계정이 없습니다: ' + clean(pos[0])); return 1; }
    for (const u of list) {
      const [s, total, recent] = await Promise.all([store.getSanction(u.id), store.countReports(u.id), store.reportersSince(u.id, Date.now() - DAY)]);
      say(table(['항목', '값'], [
        ['계정 ID', u.id], ['닉네임', u.nick], ['제공자', providerOf(u)], ['가입일', when(u.created)],
        ['판 수', `${u.games || 0}판 (승리 ${u.wins || 0})`],
        ['받은 신고', `${total}건 (최근 24시간 서로 다른 신고자 ${recent}명)`],
        ['현재 제재', sanctionText(s)],
      ]));
      say('');
    }
    if (list.length > 1) say(`같은 닉네임의 계정이 ${list.length}개입니다. 제재는 계정 ID로 겁니다.`);
  },
  mute: (store, a) => setCmd(store, a, 'mute'),
  ban: (store, a) => setCmd(store, a, 'ban'),
  unmute: (store, a) => clearCmd(store, a, 'mute'),
  unban: (store, a) => clearCmd(store, a, 'ban'),
  async log(store, { pos, opts }) {
    if (pos.length) usage();
    const list = await store.modLog(intOpt(opts.n, 50, 1, 5000, 'n'));
    if (!list.length) { say('제재 이력이 없습니다.'); return; }
    const NAME = { mute: '채팅 금지', unmute: '채팅 금지 풀기', ban: '계정 정지', unban: '계정 정지 풀기' };
    say(table(['시각', '운영자', '한 일', '대상 계정', '언제까지', '사유'], list.map((x) => [when(x.at), x.by, NAME[x.action] || x.action, x.target, when(x.until), x.reason])));
  },
};
const KIND = { mute: '채팅 금지', ban: '계정 정지' };
async function setCmd(store, { pos }, kind) {
  if (pos.length < 3) usage('계정 ID, 기간, 사유가 모두 있어야 합니다.');
  const id = idArg(pos[0]), until = untilOf(pos[1]), reason = clean(pos.slice(2).join(' ')).trim().slice(0, 200);
  if (!reason) usage('사유를 적으세요.');
  if (!(await store.setSanction(id, kind, until, reason, actor()))) { say('그런 계정이 없습니다: ' + id); return 1; }
  say(`${KIND[kind]}: ${id} ~ ${when(until)} (사유: ${reason})`);
  say('서버가 30초 안에 적용합니다.');
}
async function clearCmd(store, { pos }, kind) {
  if (pos.length !== 1) usage();
  const id = idArg(pos[0]);
  if (!(await store.clearSanction(id, kind, actor()))) { say('그런 계정이 없습니다: ' + id); return 1; }
  say(`${KIND[kind]} 풀기: ${id}`);
  say('서버가 30초 안에 적용합니다.');
}

async function main(argv) {
  const cmd = argv[0], run = Object.prototype.hasOwnProperty.call(CMDS, cmd || '') ? CMDS[cmd] : null;
  let args;
  try { if (!run) usage(cmd ? '모르는 명령: ' + clean(cmd) : ''); args = parse(argv.slice(1)); } catch (e) { if (e instanceof Usage) { if (e.message) say(e.message + '\n'); say(USAGE); return 2; } throw e; }
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  const store = await openStore({ dataDir, databaseUrl: process.env.DATABASE_URL });
  // 어느 저장소를 보고 있는지 먼저 알린다(환경 변수를 빠뜨려 엉뚱한 곳에 제재를 거는 일을 막는다). 접속 주소는 찍지 않는다(비밀번호가 들어 있다).
  process.stderr.write(`[저장소] ${store.kind === 'pg' ? 'PostgreSQL(DATABASE_URL)' : 'JSON 파일 ' + dataDir}\n`);
  try { return (await run(store, args)) || 0; }
  catch (e) { if (e instanceof Usage) { if (e.message) say(e.message + '\n'); say(USAGE); return 2; } throw e; }
  finally { await store.close(); }
}
if (require.main === module) main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error('오류: ' + (e && e.message)); process.exitCode = 1; });
module.exports = { main };
