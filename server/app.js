// 삼국 랜덤 디펜스 온라인 서버(모바일판).
// - 게임 파일 제공(정적)
// - 계정: Apple·Google·게스트 로그인(게스트는 나중에 Apple/Google로 연결), 탈퇴, 등급(경험치) 기록, 순위
// - 협동 방 중계(WebSocket). 로그인한 사람만 들어온다. 앱을 내려 연결이 끊겨도 60초 동안 자리를 지킨다.
// 계정은 저장소(store/)에 둔다: DATABASE_URL이 있으면 PostgreSQL(db/schema.sql), 없으면 JSON 파일.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const SHOP = require('../shop.js');
const THEME = require('../theme-samguk.js'); // 장수 해금 목록·가격(theme.unlock)
const { openStore } = require('./store');

const PORT = +process.env.PORT || 8300;
const ROOT = path.join(__dirname, '..');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const MAX_PLAYERS = 5, MAX_MESSAGE = 16 * 1024, AWAY_MS = 60 * 1000;

// ---------- 계정 저장소 ----------
let store = null; // start()에서 연다
const shutdown = () => { (store ? store.close() : Promise.resolve()).finally(() => process.exit(0)); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// 비밀값 해시: 비동기 scrypt(끝날 때까지 서버 전체를 세우지 않는다). 입력은 128자에서 자른다(비밀번호는 64자, 게스트 비밀값은 48자까지라 기존 해시와 같다).
// 한꺼번에 2개까지만 돌리고 나머지는 줄을 세운다(작업 스레드를 다 차지해 파일 읽기까지 밀리지 않게). 줄이 64개를 넘으면 503.
const scryptAsync = require('util').promisify(crypto.scrypt);
const PW_MAX = 128, HASH_PAR = 2, HASH_QUEUE = 64;
let hashBusy = 0; const hashWait = [];
async function hashPw(pw, salt) {
  if (hashBusy >= HASH_PAR) {
    if (hashWait.length >= HASH_QUEUE) throw Object.assign(new Error('busy'), { busy: true });
    await new Promise((r) => hashWait.push(r)); // 앞사람이 자리를 넘겨준다(hashBusy는 그대로)
  } else hashBusy++;
  try { return (await scryptAsync(String(pw).slice(0, PW_MAX), String(salt || ''), 32)).toString('hex'); }
  finally { const next = hashWait.shift(); if (next) next(); else hashBusy--; }
}
// 해시 비교는 걸리는 시간이 같게
const sameHex = (a, b) => { const x = Buffer.from(String(a || ''), 'hex'), y = Buffer.from(String(b || ''), 'hex'); return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y); };
// 기록을 분당 max줄까지만 남긴다(공격자가 기록을 끝없이 늘리지 못하게). 넘친 수는 다음 분에 한 줄로 적는다.
const logHits = {};
function warnSome(key, max, text) {
  const now = Date.now(), h = logHits[key] || (logHits[key] = { n: 0, skip: 0, t: now });
  if (now - h.t > 60000) { if (h.skip) console.warn(`[sec] ${key}: 앞선 1분 동안 ${h.skip}건을 더 적지 않았다`); h.n = 0; h.skip = 0; h.t = now; }
  if (++h.n > max) { h.skip++; return; }
  console.warn(`[sec] ${key} ${text}`);
}
// 요청한 주소: 앞단 프록시(같은 서버의 Caddy)를 거친 연결일 때만 X-Forwarded-For의 마지막 값(프록시가 붙인 값)을 믿는다
function ipOf(req) {
  const ra = req.socket.remoteAddress || '', viaProxy = /^(::ffff:)?127\.|^::1$/.test(ra);
  return viaProxy ? (String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || ra) : ra;
}
const termsOf = (b) => Math.min(1000000, Math.max(1, b.termsVer | 0)) || 1;
// 등급: 경험치로 레벨, 레벨 구간으로 계급. 곡선은 progression.js(앱과 같이 쓴다, 2026-11-25 economy-v2)
// 레벨 1 ~ 51 = 계급×5 + 등급(1~5), 51 = 군주(경험치 17만 5천). 저장된 경험치는 그대로 두고 레벨만 새 곡선으로 계산한다
// (v2 곡선은 앞 곡선보다 가팔라 표시 계급이 내려가는 계정이 있다. 이미 받은 승급 보상은 그대로, 같은 계급을 다시 올라도 다시 주지 않는다).
// 계급: 0 신병, 1~9 = 9품~1품, 10 군주. 문관(civ)·무관(mil) 중 고른 쪽 칭호로 보인다(화면에서 rk_<갈래><단계>로 번역).
const PROG = require('../progression.js');
const levelOf = PROG.levelOf, rankOf = PROG.rankOf;
const trackOf = (u) => (u.track === 'civ' ? 'civ' : 'mil');
const gradeOf = (u) => 'rk_' + trackOf(u) + rankOf(levelOf(u.xp));
const iconOf = (u) => u.icon || 'cav';
const DIFFS = ['easy', 'normal', 'hard', 'nightmare'];
// 해금: 직전 난이도를 깨야 다음 난이도. 악몽 +N은 악몽 +(N-1)을 깨야 열린다. clr = 깬 가장 높은 난이도 번호(-1 없음), nmx = 깬 악몽 +N 최고(-1 없음)
const progOf = (u) => ({ clr: u.clr == null ? -1 : u.clr, nmx: u.nmx == null ? -1 : u.nmx, plays: u.plays || {}, clears: u.clears || {} });
const profile = (u) => ({ prog: progOf(u), coins: u.coins || 0, gems: u.gems || 0, icon: iconOf(u), owned: u.owned || [], skins: u.skins || {}, mapSkin: u.mapSkin || 'spring', id: u.id, nick: u.nick, xp: u.xp, level: levelOf(u.xp), rank: rankOf(levelOf(u.xp)), track: trackOf(u), grade: gradeOf(u), games: u.games, wins: u.wins, best: u.best || 0, provider: u.prov || (u.pw ? 'password' : 'guest'), nickBad: nickBad(u.nick) });
const bearer = (req) => { const m = /^Bearer ([0-9a-f]{48})$/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
const userOf = (req) => { const t = bearer(req); return t ? store.userByToken(t) : Promise.resolve(null); };
const issue = (u) => store.issueToken(u.id);
// ---------- 운영 제재(채팅 금지·계정 정지) ----------
// 제재는 다른 프로세스(admin.js)가 저장소에 적는다. 서버는 지금 걸려 있는 제재 목록을 MOD_REFRESH_MS(기본 30초)마다 다시 읽어 메모리에 두고,
// 로그인·API·WebSocket 접속·채팅에서 그 목록을 본다(걸거나 푼 뒤 최대 30초 안에 반영). 새로 정지된 계정의 열린 연결은 읽을 때 끊는다.
// 읽기에 실패하면 앞서 읽은 목록을 그대로 쓴다(제재가 풀리는 쪽으로 실패하지 않는다).
const MOD_REFRESH_MS = Math.max(200, +process.env.MOD_REFRESH_MS || 30000);
let sanctions = new Map(); // 계정 → { m: 채팅 금지 끝(ms), b: 정지 끝(ms) }
const bannedUntil = (uid) => { const s = sanctions.get(uid); return s && s.b > Date.now() ? s.b : 0; };
const mutedLeft = (uid) => { const s = sanctions.get(uid); return s && s.m > Date.now() ? Math.ceil((s.m - Date.now()) / 1000) : 0; }; // 남은 초
// 정지된 계정이면 403 { error: 'banned', until }을 보내고 true
const banned = (res, u) => { const t = u ? bannedUntil(u.id) : 0; if (t) json(res, 403, { error: 'banned', until: t }); return !!t; };
async function refreshSanctions() {
  const next = new Map();
  (await store.activeSanctions()).forEach((s) => next.set(s.id, { m: s.mutedUntil || 0, b: s.bannedUntil || 0 }));
  sanctions = next;
  next.forEach((s, uid) => { if (s.b > Date.now()) dropConns(uid); }); // 열려 있는 방·로비 연결을 닫는다
}
// 신고 몰림 알림: 같은 사람이 24시간 안에 서로 다른 REPORT_WARN명 이상에게 신고당하면 기록에 한 줄(계정당 1시간에 한 번). 자동 제재는 하지 않는다.
const REPORT_WARN = 5, reportWarned = new Map();
async function reportWatch(target) {
  const now = Date.now(); if (now - (reportWarned.get(target) || 0) < 3600000) return;
  const n = await store.reportersSince(target, now - 86400000);
  if (n < REPORT_WARN) return;
  if (reportWarned.size > 5000) reportWarned.clear();
  reportWarned.set(target, now);
  console.warn(`[mod] 신고 몰림: 계정 ${target} — 24시간 안에 서로 다른 ${n}명이 신고 (확인: node server/admin.js reports --target ${target})`);
}
const nickOk = (n) => !!n && !/[<>]/.test(n) && !nickBad(n);

// ---------- Apple·Google 로그인: ID 토큰(JWT, RS256)을 공개 키로 검증한다 ----------
// 받는 쪽(aud): Apple은 앱 번들 ID, Google은 OAuth 클라이언트 ID들. 환경 변수로 바꿀 수 있다.
const PROVIDERS = {
  apple: { jwks: process.env.APPLE_JWKS_URL || 'https://appleid.apple.com/auth/keys', iss: ['https://appleid.apple.com'], aud: (process.env.APPLE_AUDS || 'com.hongsungjae.sangokurtd').split(',').filter(Boolean) },
  google: { jwks: process.env.GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs', iss: ['https://accounts.google.com', 'accounts.google.com'], aud: (process.env.GOOGLE_AUDS || '').split(',').filter(Boolean) },
};
const jwksCache = {};
async function keysOf(name) {
  const c = jwksCache[name];
  if (c && Date.now() - c.at < 3600000) return c.keys;
  const url = PROVIDERS[name].jwks;
  const data = url.startsWith('file:') ? JSON.parse(fs.readFileSync(url.slice(5), 'utf8')) : await (await fetch(url)).json();
  jwksCache[name] = { at: Date.now(), keys: data.keys || [] };
  return jwksCache[name].keys;
}
const b64 = (x) => Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
async function verifyIdToken(name, tok) {
  const P = PROVIDERS[name];
  if (!P.aud.length) throw new Error('not_configured');
  const parts = String(tok || '').split('.');
  if (parts.length !== 3) throw new Error('bad_token');
  const head = JSON.parse(b64(parts[0]).toString('utf8')), body = JSON.parse(b64(parts[1]).toString('utf8'));
  if (head.alg !== 'RS256') throw new Error('bad_token');
  let jwk = (await keysOf(name)).find((k) => k.kid === head.kid);
  if (!jwk) { delete jwksCache[name]; jwk = (await keysOf(name)).find((k) => k.kid === head.kid); }
  if (!jwk) throw new Error('bad_token');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64(parts[2]));
  const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (!ok || !P.iss.includes(body.iss) || !aud.some((a) => P.aud.includes(a)) || !(body.exp * 1000 > Date.now()) || !body.sub) throw new Error('bad_token');
  return String(body.sub);
}

// ---------- Sign in with Apple 연결 끊기(계정 삭제 때 Apple refresh token 철회, 지침 5.1.1(v)) ----------
// 설정(APPLE_SIGNIN_KEY_PATH·APPLE_SIGNIN_KEY_ID·APPLE_TEAM_ID)이 없으면 꺼진 채로 돌고 로그만 남긴다. 자세한 것은 apple-revoke.js
const APPLE = require('./apple-revoke').makeRevoker();
const APPLE_ORPHAN_MS = 24 * 3600000;
// 연결된 계정 없이 하루 지난 토큰(가입을 끝내지 않음, 삭제 때 철회 실패)을 철회하고 지운다
async function sweepAppleTokens() {
  if (!APPLE.on() || !store) return;
  for (const x of await store.orphanAppleTokens(Date.now() - APPLE_ORPHAN_MS)) {
    const r = await APPLE.revoke(x.token);
    if (r !== 'fail') await store.dropAppleToken(x.sub, x.token);
  }
}

// ---------- 장수 해금(동전·보상형 광고·앱스토어 결제) ----------
const UNL = THEME.unlock;
const unlockKey = (id) => UNL.key(id);
// 결제 상품 ID → 넣어 줄 열쇠 목록(확정 구매만. 확률형 판매 없음)
function iapItems(pid) {
  const locked = UNL.lockedIds(), tierOf = (id) => (THEME.units.find((d) => d.id === id) || {}).tier;
  if (pid === UNL.iap.noads[0]) return [UNL.noAdsKey];
  if (pid === UNL.iap.all10[0]) return locked.filter((id) => tierOf(id) === 10).map(unlockKey);
  for (const t of [9, 10]) { const pre = UNL.iap[t][0]; if (pid.startsWith(pre)) { const id = pid.slice(pre.length); return locked.includes(id) && tierOf(id) === t ? [unlockKey(id)] : null; } }
  return null;
}
// 광고 하루 = 일본 시간(UTC+9) 0시부터
const jstDayStart = (now = Date.now()) => { const d = new Date(now + 9 * 3600000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 9 * 3600000; };
// App Store 서명 거래(StoreKit 2 JWS)·서버 알림 검증은 iap.js(사슬·OID·번들·환경, 키가 있으면 App Store Server API 재조회).
// APPLE_IAP_ROOT_CA(애플 루트 인증서 G3 파일 경로)가 없으면 결제는 꺼져 있다(503).
const AIAP = require('./iap').makeAppleIap();
const iapOn = () => AIAP.on();

// 구글 플레이 결제 검증: 구매 토큰을 Google Play Developer API(purchases.products.get)로 확인한다.
// GOOGLE_PLAY_SA = 서비스 계정 키(JSON) 파일 경로. 플레이 콘솔 '사용자 및 권한'에서 이 서비스 계정에 '재무 데이터 보기' 권한을 줘야 한다. 없으면 503.
// 구매 확인(acknowledge)은 앱의 결제 플러그인이 한다.
const GPLAY = { sa: process.env.GOOGLE_PLAY_SA || '', pkg: process.env.GOOGLE_PLAY_PACKAGE || 'com.hongsungjae.sangokurtd', api: process.env.GOOGLE_PLAY_API || 'https://androidpublisher.googleapis.com', tok: null };
const gplayOn = () => !!GPLAY.sa && fs.existsSync(GPLAY.sa);
const b64u = (x) => Buffer.from(x).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function gplayToken() {
  if (GPLAY.tok && GPLAY.tok.exp > Date.now() + 60000) return GPLAY.tok.v;
  const k = JSON.parse(fs.readFileSync(GPLAY.sa, 'utf8')), now = Math.floor(Date.now() / 1000), aud = k.token_uri || 'https://oauth2.googleapis.com/token';
  const un = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud, iat: now, exp: now + 3600 }));
  const jwt = un + '.' + b64u(crypto.sign('RSA-SHA256', Buffer.from(un), k.private_key));
  const r = await fetch(aud, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt });
  const j = await r.json(); if (!j.access_token) throw new Error('gplay_auth');
  GPLAY.tok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return GPLAY.tok.v;
}
// 돌려주는 값: { productId, txId, at, env } (구매 완료 상태일 때만). 아니면 bad_receipt
const gplayTxId = (orderId) => 'g:' + String(orderId).slice(0, 60);
async function verifyGooglePurchase(productId, token) {
  const bad = () => new Error('bad_receipt'), pid = String(productId || ''), t = String(token || '');
  if (!/^[a-z0-9_.]{1,100}$/.test(pid) || !/^[A-Za-z0-9._-]{10,1000}$/.test(t)) throw bad();
  const u = GPLAY.api + '/androidpublisher/v3/applications/' + encodeURIComponent(GPLAY.pkg) + '/purchases/products/' + encodeURIComponent(pid) + '/tokens/' + encodeURIComponent(t);
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + await gplayToken() } });
  if (!r.ok) throw bad();
  const p = await r.json();
  // purchaseState: 0 구매 완료, 1 취소(환불), 2 대기
  if (p.purchaseState !== 0 || !p.orderId) throw bad();
  // purchaseType: 0 = 라이선스 테스터의 시험 구매(받아 주되 기록에 Test로 남긴다), 없으면 실제 결제
  return { productId: pid, txId: gplayTxId(p.orderId), at: +p.purchaseTimeMillis || Date.now(), env: p.purchaseType === 0 ? 'Test' : 'Production' };
}

// ---------- 환불 회수(SEC-105) ----------
// 거래 하나를 환불됨으로 표시하고, 그 거래로 새로 들어간 해금 열쇠만 뺀다(같은 계정의 다른 유효 결제가 주는 열쇠는 남긴다).
// 동전·보석·경험치 등 이미 쓴 것은 건드리지 않는다. 같은 거래를 두 번 회수해도 한 번만 처리된다.
async function revokePurchase(txId, why) {
  const r = await store.revokeIap(txId, (pid) => iapItems(pid) || []);
  if (r.result === 'ok') console.log(`[iap] 환불 회수 ${why} tx=${txId} uid=${r.uid || '-'} 뺀 열쇠=${(r.removed || []).join(',') || '없음'}`);
  return r;
}
// 구글 플레이: Voided Purchases API를 GOOGLE_VOID_POLL_MS(기본 6시간)마다 읽어 최근 30일의 환불·취소 구매를 회수한다.
const GVOID_MS = Math.max(1000, +process.env.GOOGLE_VOID_POLL_MS || 6 * 3600000), GVOID_WINDOW = 30 * 24 * 3600000 - 60000;
async function pollGoogleVoided() {
  if (!gplayOn() || !store) return 0;
  const ids = await require('./iap').googleVoided({ api: GPLAY.api, pkg: GPLAY.pkg, token: gplayToken, since: Date.now() - GVOID_WINDOW });
  let n = 0;
  for (const id of ids) if ((await revokePurchase(gplayTxId(id), 'google:voided')).result === 'ok') n++;
  return n;
}

// 판 보고를 검사해 전적 한 줄로 만든다(숫자만, 크기 제한). 저장은 store가 한다.
function histOf(b, online) {
  const diff = DIFFS.includes(b.diff) ? b.diff : 'easy', mut = Math.min(5, Math.max(0, b.mutLv | 0));
  const myth = {}; if (b.myth && typeof b.myth === 'object') Object.keys(b.myth).slice(0, 30).forEach((id) => { if (/^[a-z]{2,16}$/.test(id)) myth[id] = Math.min(50, Math.max(0, b.myth[id] | 0)); });
  // 숫자는 DB 정수 범위 안으로 묶는다(범위를 넘는 값으로 500 오류가 나지 않게)
  const st = {}; if (b.st && typeof b.st === 'object') ['kills', 'midKill', 'midMiss', 'lifeLost', 'goldIn', 'goldUp', 'goldHire', 'combines', 'crafts', 'best', 'tickets', 'chests', 'bosses', 'bossWins', 'fast'].forEach((k) => { if (typeof b.st[k] === 'number' && isFinite(b.st[k])) st[k] = Math.max(-1e9, Math.min(1e9, Math.round(b.st[k]))); });
  return { at: Date.now(), diff, mut, round: Math.min(200, Math.max(0, b.round | 0)), win: !!b.win, time: timeOf(b), online: !!online, mode: String(b.mode || '').slice(0, 8), myth, st };
}
// 판 시간(초): 0 ~ 하루
const timeOf = (b) => Math.min(86400, Math.max(0, Math.round(+b.time || 0)));
// 결과 보고의 시간이 라운드 수에 비해 불가능하게 짧은지. 라인 라운드는 45초 고정, 배속 최대 3 → 벽시계로도 라운드당 약 15초가 바닥.
// 정상 판이 걸리지 않게 그 절반(7초)을 쓴다. round에 닿으려면 그 앞의 (round - 1)개 라운드를 지나야 한다.
const MIN_ROUND_SEC = 7;
const tooFast = (round, time) => time > 0 && time < (round - 1) * MIN_ROUND_SEC;

// ---------- 판 표(ticket): 결과·전적은 서버가 판 시작 때 내준 표로만 받는다 ----------
// 기기가 보낸 난이도·시간을 그대로 믿지 않으려는 것(2026-11-18 보안 점검). 표 = 계정·난이도·악몽 단계·발급 시각·번호를 서버 비밀값으로 서명한 글자.
// - 난이도·악몽 단계는 표의 값만 쓴다. 서버 기록으로 아직 안 열린 난이도는 열린 데까지만 쳐 준다(보상 배율·해금 진행).
// - 걸린 시간은 서버 시계(지금 - 발급 시각)로 잰다: 라운드당 WALL_ROUND_SEC(45초 라운드, 3배속이면 15초, 여유 20%)보다 빠르면 아무것도 주지 않는다.
// - 표 하나에 보고 한 번. 보상 받은 판끼리는 시간이 겹칠 수 없다(표를 여러 장 받아 두고 한꺼번에 내는 것 방지). 하루 동전 상한.
// 비밀값은 DATA_DIR/ticket.key(없으면 만든다). 서버를 다시 켜도 진행 중인 판의 표가 살아 있다.
const WALL_ROUND_SEC = 12, GAME_ROUND_SEC = 40, TICKET_MAX_MS = 24 * 3600000, RESULT_COINS_DAY = 3000;
const ROUNDS = {}; THEME.difficulties.forEach((d) => { ROUNDS[d.id] = d.rounds; });
let ticketKey = null;
function ticketSecret() {
  if (ticketKey) return ticketKey;
  const f = path.join(DATA, 'ticket.key');
  try { ticketKey = fs.readFileSync(f); } catch (e) { ticketKey = null; }
  if (!ticketKey || ticketKey.length < 32) {
    ticketKey = crypto.randomBytes(32);
    try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(f, ticketKey, { mode: 0o600 }); } catch (e) { console.warn('[sec] ticket.key를 저장하지 못했다(다시 켜면 진행 중인 판의 표가 무효가 된다):', e.message); }
  }
  return ticketKey;
}
const tkSign = (body) => crypto.createHmac('sha256', ticketSecret()).update(body).digest('base64url');
// ---------- 판 종류(인원) 보상 배율 (2026-11-18 사용자 결정, production/team/2026-11-18/spec-rewards-missions.md 1절) ----------
// 표의 k = 판 시작 때 서버가 본 방 인원(연결이 살아 있는 자리 수). 0 = 오프라인(방 코드가 없거나, 그런 방이 없거나, 그 방에 앉아 있지 않음).
// SEAT_MUL[k] = 경험치·동전에 곱하는 배율: 오프라인 0.5, 온라인 1인 0.6, 2인 1.0, 3인 1.2, 4인 1.4, 5인 1.7
const SEAT_MUL = [0.5, 0.6, 1.0, 1.2, 1.4, 1.7];
// 이 계정이 그 방에 앉아 있으면 연결된 자리 수(1~5), 아니면 0
function roomSeats(raw, uid) {
  const code = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12), room = code ? rooms.get(code) : null;
  if (!room) return 0;
  let n = 0, mine = false;
  room.forEach((p) => { if (p.uid === uid) mine = true; if (p.ws && p.ws.readyState === 1) n++; });
  return mine ? Math.max(1, Math.min(SEAT_MUL.length - 1, n)) : 0;
}
function makeTicket(uid, diff, mut, seats) {
  const body = Buffer.from(JSON.stringify({ u: uid, d: diff, m: mut, k: seats | 0, t: Date.now(), n: crypto.randomBytes(9).toString('base64url') })).toString('base64url');
  return body + '.' + tkSign(body);
}
function readTicket(raw, uid) {
  const s = String(raw || ''); if (s.length > 400) return null;
  const i = s.indexOf('.'); if (i < 1) return null;
  const body = s.slice(0, i), sig = Buffer.from(s.slice(i + 1)), want = Buffer.from(tkSign(body));
  if (sig.length !== want.length || !crypto.timingSafeEqual(sig, want)) return null;
  let t; try { t = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!t || t.u !== uid || !DIFFS.includes(t.d) || typeof t.t !== 'number' || typeof t.n !== 'string') return null;
  if (Date.now() - t.t > TICKET_MAX_MS || t.t > Date.now() + 60000) return null;
  return t;
}
const usedTickets = new Map(); // 번호 → 쓴 시각(전적 보고의 중복 방지. 결과 보고는 저장소가 열쇠로 한 번 더 막는다)
const lastReward = new Map(); // 계정 → 마지막으로 보상을 준 시각
const dayCoins = new Map(); // 계정 → { day, n }
setInterval(() => { const now = Date.now(); usedTickets.forEach((at, k) => { if (now - at > TICKET_MAX_MS) usedTickets.delete(k); }); lastReward.forEach((at, k) => { if (now - at > TICKET_MAX_MS) lastReward.delete(k); }); }, 3600000);
// 표와 보고를 맞춰 본다. 돌려주는 값: null(받지 않음) 또는 { diff(쳐 주는 난이도), mut, round, time, rankOk, nonce, start, seats(판 인원. 0 = 오프라인) }
function judge(u, b, what) {
  const t = readTicket(b.ticket, u.id);
  if (!t) { if (b.ticket) warnSome('ticket_bad', 20, `uid=${u.id} ${what}`); return null; }
  if (usedTickets.has(t.n)) return null;
  const pg = progOf(u), played = DIFFS.indexOf(t.d), di = Math.min(played, pg.clr + 1), diff = DIFFS[di];
  const mut = diff === 'nightmare' && played === di ? Math.min(Math.max(0, t.m | 0), 5, pg.nmx + 1) : 0;
  const round = Math.min(ROUNDS[t.d] || 200, Math.max(0, b.round | 0)), time = timeOf(b), wall = (Date.now() - t.t) / 1000;
  if (wall < (round - 1) * WALL_ROUND_SEC) { warnSome('result_fast', 20, `uid=${u.id} ${what} round=${round} wall=${Math.round(wall)} diff=${t.d} win=${!!b.win}`); return null; }
  const win = !!b.win && round >= (ROUNDS[t.d] || 0);
  // 순위에 올릴 수 있는 기록: 고른 난이도 그대로 쳐 준 판이고, 판 시간이 라운드 수에 맞고, 벽시계보다 3배속 넘게 빠르지 않다
  const rankOk = win && played === di && (t.m | 0) === mut && time >= (round - 1) * GAME_ROUND_SEC && time <= wall * 3 + 60;
  // 판 종류는 표에 적힌 값만 쓴다(옛 표에는 없다 → 오프라인)
  const seats = Math.min(SEAT_MUL.length - 1, Math.max(0, t.k | 0));
  return { diff, played: t.d, mut, round, time, win, rankOk, nonce: t.n, start: t.t, seats };
}
// 순위 응답을 30초 동안 기억한다(로그인 없이 부르는 주소라, 부를 때마다 DB 질의 수백 개가 나가지 않게).
// 같은 열쇠를 동시에 여러 번 불러도 질의는 한 번만 나간다(약속을 기억한다).
const RANK_MS = 30000;
const rankCache = new Map(), immCache = new Map(); // 불멸 순위는 열쇠(장수 id)가 많아 따로 둔다: 넘쳐서 비워도 다른 순위 캐시는 남는다
function cached(map, key, make) {
  const now = Date.now(), c = map.get(key);
  if (c && now - c.at < RANK_MS) return c.v;
  if (map.size >= 100) map.clear();
  const v = make(); map.set(key, { at: now, v });
  v.catch(() => { const x = map.get(key); if (x && x.v === v) map.delete(key); }); // 실패는 기억하지 않는다
  return v;
}
// 빠른 대전: 같은 난이도를 고른 사람끼리 최대 4명 묶는다. 4명이 모이거나, 2명 이상이 20초 넘게 기다리면 방을 연다.
const MATCH_MAX = 4, MATCH_WAIT = 20000;
const queues = {}; // diff → [{ uid, at }]
const matched = {}; // uid → { room, size, at }
function tryMatch(diff) {
  const q = queues[diff] || []; const now = Date.now();
  q.splice(0, q.length, ...q.filter((e) => now - e.seen < 8000)); // 8초 넘게 확인하지 않은 사람은 뺀다(앱을 닫음)
  if (q.length >= MATCH_MAX || (q.length >= 2 && now - q[0].at >= MATCH_WAIT)) {
    const group = q.splice(0, MATCH_MAX), room = 'q' + crypto.randomBytes(3).toString('hex');
    group.forEach((e, i) => (matched[e.uid] = { room, size: group.length, order: i, diff, at: now }));
  }
}
// 묶인 결과는 2분 뒤 지운다(기기는 2초마다 확인하므로 그 안에 받아 간다). 확인이 끊긴 대기자도 같이 치운다.
setInterval(() => {
  const now = Date.now();
  Object.keys(matched).forEach((uid) => { if (now - matched[uid].at > 120000) delete matched[uid]; });
  Object.keys(queues).forEach((k) => { queues[k] = queues[k].filter((e) => now - e.seen < 8000); if (!queues[k].length) delete queues[k]; });
}, 30000);
const pub = (u) => ({ nick: shownNick(u.nick), icon: iconOf(u), level: levelOf(u.xp), grade: gradeOf(u) });
// 금칙어·광고·도배 검사는 chat.js에 있다(채팅은 가리거나 막고, 닉네임은 거절).
const CHAT = require('./chat');
const nickBad = CHAT.nickBad;
// 이미 쓰고 있는 나쁜 닉네임은 다른 사람에게 *** 로 보인다(본인은 바꾸라는 안내를 받는다)
const shownNick = (n) => (nickBad(n) ? '***' : n);

// 같은 주소에서 너무 자주 부르면 막는다(가입·로그인 무차별 대입 방지)
const hits = new Map();
function limited(ip, key, max, perMs) {
  const k = ip + key, now = Date.now(), h = hits.get(k) || { n: 0, t: now };
  if (now - h.t > perMs) { h.n = 0; h.t = now; }
  h.n++; hits.set(k, h);
  return h.n > max;
}
setInterval(() => { const now = Date.now(); hits.forEach((h, k) => { if (now - h.t > 600000) hits.delete(k); }); }, 600000);

// 판 보상 = 기본 식(난이도·도달 라운드·승리·악몽 +N) × 판 종류 배율(SEAT_MUL, 경험치·동전 모두).
// 식과 수치는 progression.js REWARD·gameReward(2026-11-25 economy-v2: 경험치는 난이도 배율 쉬움 1·보통 2.5·어려움 4·악몽 6, 동전은 v1과 같음)
function rewardOf(b, seats) {
  return PROG.gameReward(b, SEAT_MUL[seats] || SEAT_MUL[0]);
}

// ---------- 미션: 일일 미션 + 난이도 첫 클리어 보상 (spec-rewards-missions.md 2·3절, 일일 미션 목록은 2026-11-24 fix-progression.md) ----------
// 일일 미션은 일본 시간 0시에 초기화. 진행은 표로 검증된 판 보고(settle)에서만 센다. 보상(동전·경험치)은 '받기'를 눌러야 들어온다.
// 목록·수치는 progression.js DAILY. 한 판이 채우는 양(gain)은 서버가 정한다:
// - games: 10라운드 이상 간 판 1
// - combines: 판 보고의 합성 수. 라운드당 COMB_PER_ROUND를 넘을 수 없고, 한 판이 미션 하나의 need를 넘겨 채우지 않는다
// - bossWins: 판 보고의 보스 처치 수. 표로 확인한 도달 라운드까지 나온 보스 수를 넘을 수 없다
// 첫 클리어는 서버 기록(clears·clr·nmx)으로 판단한다(이미 깬 계정도 아직 안 받았으면 받을 수 있다).
const COMB_PER_ROUND = 4;
const BOSS_ROUNDS = (THEME.bosses || []).map((x) => x.round).filter((r) => r > 0);
const stNum = (b, k) => { const v = b && b.st && typeof b.st === 'object' ? +b.st[k] : 0; return isFinite(v) ? Math.max(0, Math.floor(v)) : 0; };
const DAILY_GAIN = {
  games: (j) => (j.round >= 10 ? 1 : 0),
  combines: (j, b) => Math.min(stNum(b, 'combines'), j.round * COMB_PER_ROUND),
  bossWins: (j, b) => Math.min(stNum(b, 'bossWins'), BOSS_ROUNDS.filter((r) => r <= j.round).length),
};
const MISSIONS = {
  daily: PROG.DAILY.map((m) => Object.assign({}, m, { gain: (j, b) => Math.min(m.need, DAILY_GAIN[m.stat](j, b)) })),
  firsts: PROG.FIRSTS, // 난이도 첫 클리어(2026-11-25 economy-v2: 보통 300·어려움 500·악몽 700·악몽 +N 200)
};
const DAY_MS = 86400000;
// 일본 시간 날짜 글자('2026-11-18'): 저장소가 일일 미션의 날을 가르는 열쇠
const jstDayKey = (now = Date.now()) => new Date(jstDayStart(now) + 9 * 3600000).toISOString().slice(0, 10);
const firstDone = (u, f) => { const pg = progOf(u); return f.mut ? pg.nmx >= f.mut : (pg.clears[f.diff] > 0 || pg.clr >= DIFFS.indexOf(f.diff)); };
async function missionView(u) {
  const st = await store.missionState(u.id, jstDayKey());
  return {
    daily: MISSIONS.daily.map((m) => { const s = st.daily[m.id] || { n: 0, claimed: false }, n = Math.min(m.need, s.n | 0); return { id: m.id, n, need: m.need, coins: m.coins, xp: m.xp, done: n >= m.need, claimed: !!s.claimed }; }),
    firsts: MISSIONS.firsts.map((f) => ({ id: f.id, coins: f.coins, done: firstDone(u, f), claimed: st.firsts.includes(f.id) })),
    resetAt: jstDayStart() + DAY_MS,
  };
}

// ---------- 관직 승급 보상·업적 첫 달성 보상 (2026-11-24 fix-progression.md 2절) ----------
// 둘 다 서버가 판단해 자동으로 준다(받은 표시는 mission_claims에 'rk_<계급>'·'a_<업적 id>', 계정마다 한 번). 수치는 progression.js.
// 관직: 지금 경험치로 오른 계급까지 아직 안 받은 것을 모두 준다(곡선을 바꾼 뒤 처음 판을 마친 기존 계정도 오른 단계만큼 받는다).
async function grantRanks(u) {
  const r = rankOf(levelOf(u.xp || 0)), list = [];
  for (let k = 1; k <= r; k++) if (PROG.RANK_COINS[k] > 0) list.push({ id: 'rk_' + k, coins: PROG.RANK_COINS[k], reason: 'rank' });
  if (!list.length) return [];
  const got = await store.grantOnce(u.id, list);
  return list.filter((x) => got.includes(x.id)).map((x) => ({ rank: +x.id.slice(3), coins: x.coins }));
}
// 업적: 판 보고에 적힌 업적 id(ach) 가운데 이 판에서 가능했던 것만 받는다. 업적 달성 판정은 판 안(기기)에서 하므로 서버는 아래만 본다:
// 표로 검증된 판일 것, 아는 업적 id일 것, 협동 업적은 표의 판 인원 2인 이상이고 그 라운드에 닿았을 것. 동전 액수는 서버 표로만 정한다.
const ACHS = new Map((THEME.achievements || []).map((a) => [a.id, a]));
function achOk(id, j) {
  const a = ACHS.get(id); if (!a) return false;
  const c = a.cond || {};
  if (c.type === 'party') return j.seats >= 2 && j.round >= (c.round | 0);
  return j.round >= 1;
}
async function grantAchs(u, b, j) {
  const ids = Array.isArray(b.ach) ? [...new Set(b.ach.slice(0, 60).map(String))].filter((id) => achOk(id, j)) : [];
  if (!ids.length) return [];
  const list = ids.map((id) => ({ id: 'a_' + id, coins: PROG.achCoins(id), reason: 'ach' }));
  const got = await store.grantOnce(u.id, list);
  return list.filter((x) => got.includes(x.id)).map((x) => ({ id: x.id.slice(2), coins: x.coins }));
}

// 판 보고 받기: 온라인 결과(/api/result)와 오프라인 전적(/api/history)이 같이 쓴다. 돌려주는 값: null(받지 않음) 또는 { gained, coins }
// 난이도·악몽 단계·걸린 시간·판 종류는 표와 서버 시계로 정한다(judge). 같은 표는 저장소가 열쇠로 한 번만 받는다(서버를 다시 켜도).
async function settle(u, b, online) {
  const j = judge(u, b, online ? 'result' : 'history');
  if (!j) return null;
  // 보상 받는 판끼리는 시간이 겹칠 수 없다: 이 표가 앞선 보상보다 먼저 발급됐으면 보상은 없다.
  // 온라인 결과는 아예 받지 않고, 오프라인 전적은 전적·난이도 진행만 남긴다(저장해 둔 판을 다른 판 뒤에 이어서 끝낸 경우)
  const overlap = j.start < (lastReward.get(u.id) || 0);
  if (overlap) { warnSome('result_overlap', 20, `uid=${u.id}`); if (online) return null; }
  const key = 'tk-' + j.nonce;
  b = Object.assign({}, b, { diff: j.diff, mutLv: j.mut, round: j.round, win: j.win });
  const rw = overlap ? { xp: 0, coins: 0 } : rewardOf(b, j.seats);
  // 전적 줄에는 실제로 고른 난이도(표의 난이도)를 적는다. 보상·순위·난이도 진행은 위 j.diff(깬 난이도 + 1까지) 그대로(2026-11-26: 보통 판이 쉬움으로 적히던 문제)
  const hb = Object.assign({}, b, { diff: j.played || j.diff, mutLv: j.played && j.played !== j.diff ? 0 : j.mut });
  // 하루(일본 시간) 판 보상 동전 상한을 넘는 만큼은 주지 않는다
  const day = jstDayStart(), dc = dayCoins.get(u.id), had = dc && dc.day === day ? dc.n : 0;
  const coins = Math.max(0, Math.min(rw.coins, RESULT_COINS_DAY - had));
  // 불멸 장수를 이번 판에 몇 번 소환했는지(장수별로 쌓는다. 불멸 순위는 온라인 판만)
  const imm = {}; if (online && b.imm && typeof b.imm === 'object') Object.keys(b.imm).slice(0, 12).forEach((id) => { const n = Math.min(20, b.imm[id] | 0); if (/^[a-z]{2,16}$/.test(id) && n > 0) imm[id] = n; });
  // 클리어 순위: 방이 있는 온라인 판이고 표와 시간이 맞는 판만(judge의 rankOk). 같은 방 사람들은 방 열쇠(party)로 한 줄에 모인다
  // 판(board)은 둘: 온라인 협동(2인 이상, 난이도 이름 그대로)과 솔로(오프라인·혼자 시작한 온라인. 'solo:난이도', 계정마다 가장 빠른 한 줄)
  const clear = !j.rankOk ? null : j.seats >= 2 ? { diff: j.diff, party: String(b.party || key).slice(0, 40), time: j.time, mut: j.mut } : { diff: 'solo:' + j.diff, party: 'solo:' + u.id, time: j.time, mut: j.mut };
  usedTickets.set(j.nonce, Date.now());
  const done = await store.recordResult(u.id, { key, xp: rw.xp, coins, win: !!b.win, round: j.round, hist: histOf(hb, online), imm, clear });
  if (!done) return null;
  if (!overlap) { lastReward.set(u.id, Date.now()); dayCoins.set(u.id, { day, n: had + coins }); }
  // 일일 미션 진행(승패 무관). { 미션 id: 채운 양 }
  const add = {}; MISSIONS.daily.forEach((m) => { const n = m.gain(j, b); if (n > 0) add[m.id] = n; });
  if (Object.keys(add).length) await store.missionProgress(u.id, jstDayKey(), add);
  // 업적 첫 달성·관직 승급 보상(겹친 판은 보상 없음)
  const ach = overlap ? [] : await grantAchs(u, b, j);
  const rankUp = await grantRanks(await store.getUser(u.id));
  return { gained: rw.xp, coins, ach, rankUp };
}

function readBody(req, cb, max = 8192) {
  let n = 0; const parts = [];
  req.on('data', (c) => { n += c.length; if (n > max) { req.destroy(); return; } parts.push(c); });
  req.on('end', () => { try { cb(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch (e) { cb(null); } });
}
// 모든 응답에 붙이는 보안 헤더: HTTPS만 쓰게(HSTS), 내용 종류를 추측하지 않게, 다른 사이트로 나갈 때 주소 전체를 넘기지 않게
const SEC_HEAD = { 'Strict-Transport-Security': 'max-age=31536000', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
function json(res, code, obj) {
  res.writeHead(code, { ...SEC_HEAD, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
  res.end(JSON.stringify(obj));
}
const ID_RE = /^[a-z0-9_]{4,16}$/;
// ---------- 서버 공지 + 최소 버전 (GET /api/notice) ----------
// 내용은 DATA_DIR/notice.json: { "notice": { "id": "2026-11-20a", "text": { "ko": "…", "ja": "…", "en": "…", "zh": "…" } }, "minVersion": "0.2.33" }
// 둘 다 없어도 된다(없으면 null). 파일이 없거나, 8KB를 넘거나, JSON이 깨졌으면 둘 다 null. 파일 수정 시각이 바뀌면 다시 읽는다(서버를 다시 켜지 않아도 된다).
// id를 바꾸면 이미 본 사람에게도 다시 빨간 점이 뜬다. minVersion보다 낮은 앱은 로딩 화면에서 업데이트 안내를 받고 멈춘다.
const NOTICE_FILE = path.join(DATA, 'notice.json'), NOTICE_MAX = 8192, NOTICE_LANGS = ['ko', 'ja', 'en', 'zh'];
const NOTICE_NONE = { notice: null, minVersion: null };
let noticeCache = { mtime: -1, size: -1, val: NOTICE_NONE };
function parseNotice(raw) {
  let j; try { j = JSON.parse(raw); } catch (e) { return NOTICE_NONE; }
  if (!j || typeof j !== 'object') return NOTICE_NONE;
  let notice = null; const n = j.notice;
  if (n && typeof n === 'object' && n.text && typeof n.text === 'object' && (typeof n.id === 'string' || typeof n.id === 'number') && String(n.id)) {
    const text = {}; NOTICE_LANGS.forEach((k) => { if (typeof n.text[k] === 'string' && n.text[k].trim()) text[k] = n.text[k]; });
    if (Object.keys(text).length) notice = { id: String(n.id).slice(0, 40), text };
  }
  const minVersion = typeof j.minVersion === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(j.minVersion) ? j.minVersion : null;
  return { notice, minVersion };
}
function readNotice() {
  let st = null; try { st = fs.statSync(NOTICE_FILE); } catch (e) { /* 파일 없음 */ }
  if (!st || !st.isFile()) noticeCache = { mtime: -1, size: -1, val: NOTICE_NONE };
  else if (st.mtimeMs !== noticeCache.mtime || st.size !== noticeCache.size) {
    let val = NOTICE_NONE;
    if (st.size <= NOTICE_MAX) { try { val = parseNotice(fs.readFileSync(NOTICE_FILE, 'utf8')); } catch (e) { /* 못 읽으면 없는 것으로 */ } }
    else console.warn('[notice] notice.json이 8KB를 넘어 읽지 않았다');
    noticeCache = { mtime: st.mtimeMs, size: st.size, val };
  }
  return noticeCache.val;
}
function api(req, res, url, query) {
  handle(req, res, url, query).catch((e) => {
    if (e && e.busy) { if (!res.headersSent) json(res, 503, { error: 'busy' }); return; }
    console.error('api', url, e); if (!res.headersSent) json(res, 500, { error: 'server' });
  });
}
async function handle(req, res, url, query) {
  const ip = ipOf(req);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if ((url === '/api/rank' || url === '/api/ranking') && req.method === 'GET') {
    // 로그인 없이 부르는 주소: 주소당 분당 120번, 응답은 30초 동안 기억한 것을 준다
    if (limited(ip, 'rank', 120, 60000)) return json(res, 429, { error: 'slow_down' });
    // 옛 화면용(시작 화면의 순위 20줄): 닉네임·아이콘·레벨·계급만 내보낸다(계정 ID·재화·보유 목록은 내보내지 않는다)
    if (url === '/api/ranking') return json(res, 200, { top: await cached(rankCache, 'top', async () => (await store.rankLevel(50)).map(pub)) });
    // type=level | clear(&diff=) | imm(&id=)
    const q = new URLSearchParams(query || ''), type = q.get('type');
    if (type === 'clear') {
      const diff = String(q.get('diff') || '');
      if (!DIFFS.includes(diff)) return json(res, 200, { list: [] });
      const board = (q.get('mode') === 'solo' ? 'solo:' : '') + diff;
      const list = await cached(rankCache, 'clear:' + board, async () => (await store.rankClear(board, 30)).map((c) => ({ time: c.time, mut: c.mut, at: c.at, members: c.members.map((m) => (m.user ? pub(m.user) : { nick: shownNick(m.nick), icon: m.icon })) })));
      return json(res, 200, { list });
    }
    if (type === 'imm') {
      const id = String(q.get('id') || '');
      if (!/^[a-z]{2,16}$/.test(id)) return json(res, 200, { list: [] });
      const list = await cached(immCache, id, async () => (await store.rankImm(id, 30)).map((x) => Object.assign(pub(x.user), { n: x.n })));
      return json(res, 200, { list });
    }
    const list = await cached(rankCache, 'level', async () => (await store.rankLevel(50)).map((u) => Object.assign(pub(u), { xp: u.xp, games: u.games })));
    return json(res, 200, { list });
  }
  // 결제 검증 준비 상태: 앱은 이게 true인 스토어에서만 결제 버튼을 보인다(검증 못 하는데 돈만 나가는 일을 막는다)
  if (url === '/api/iap/status' && req.method === 'GET') return json(res, 200, { apple: iapOn(), google: gplayOn() });
  // 공지·최소 버전: 로그인 없이 부른다(주소당 분당 60번)
  if (url === '/api/notice' && req.method === 'GET') {
    if (limited(ip, 'notice', 60, 60000)) return json(res, 429, { error: 'slow_down' });
    return json(res, 200, readNotice());
  }
  if (url === '/api/me' && req.method === 'GET') {
    const u = await userOf(req);
    if (banned(res, u)) return;
    return u ? json(res, 200, { me: profile(u) }) : json(res, 401, { error: 'auth' });
  }
  if (req.method !== 'POST') return json(res, 404, { error: 'not_found' });
  // App Store Server Notifications V2(Apple이 부른다, 로그인 없음). 서명 검증 뒤 환불·회수면 그 거래의 해금을 뺀다.
  // 본문에 인증서 사슬이 두 벌 들어 있어 8KB를 넘으므로 64KB까지 받는다. 200이 아니면 Apple이 다시 보낸다.
  if (url === '/api/iap/apple-notify') {
    if (limited(ip, 'anotify', 600, 600000)) return json(res, 429, { error: 'slow_down' });
    if (!iapOn()) return json(res, 503, { error: 'not_configured' });
    const nb = await new Promise((r) => readBody(req, r, 65536));
    let n; try { n = AIAP.verifyNotification(nb && nb.signedPayload); } catch (e) { warnSome('apple_notify_bad', 20, 'signedPayload 검증 실패'); return json(res, 400, { error: 'bad_payload' }); }
    if ((n.type === 'REFUND' || n.type === 'REVOKE') && n.tx) await revokePurchase(n.tx.txId, 'apple:' + n.type + ':' + n.env);
    return json(res, 200, { ok: true });
  }
  let b = await new Promise((r) => readBody(req, r));
  if (!b) return json(res, 400, { error: 'bad_body' });
  // 게스트: 기기에만 보관하는 비밀값으로 다시 들어온다(비밀값은 서버에 해시로만 둔다)
  if (url === '/api/guest/new') {
    if (limited(ip, 'guest', 20, 3600000)) return json(res, 429, { error: 'slow_down' });
    if (b.agree !== true) return json(res, 400, { error: 'need_agree' });
    const nick = String(b.nick || '').trim().slice(0, 12);
    if (!nickOk(nick)) return json(res, 400, { error: 'bad_nick' });
    const secret = crypto.randomBytes(24).toString('hex'), salt = crypto.randomBytes(16).toString('hex');
    const u = await store.createUser('g', { nick, gsalt: salt, gsec: await hashPw(secret, salt), agreed: { terms: termsOf(b), at: Date.now() } });
    return json(res, 200, { token: await issue(u), me: profile(u), guest: { id: u.id, secret } });
  }
  if (url === '/api/guest/login') {
    if (limited(ip, 'glogin', 30, 600000)) return json(res, 429, { error: 'slow_down' });
    const u = await store.getUser(String(b.id || '').slice(0, 32));
    if (!u || !u.gsec || !sameHex(await hashPw(String(b.secret || ''), u.gsalt), u.gsec)) return json(res, 401, { error: 'wrong' });
    if (banned(res, u)) return;
    return json(res, 200, { token: await issue(u), me: profile(u) });
  }
  // Apple 로그인 때 받은 authorization code를 refresh token으로 바꿔 둔다(계정 삭제 때 철회용). 앱(native.js)이 로그인 직후 따로 부른다.
  // 계정과 상관없이 Apple ID 토큰으로 본인을 확인한다(이 요청이 /api/auth/apple보다 먼저 올 수 있다).
  if (url === '/api/auth/apple/code') {
    if (limited(ip, 'acode', 30, 600000)) return json(res, 429, { error: 'slow_down' });
    if (!APPLE.on()) return json(res, 503, { error: 'not_configured' });
    let sub;
    try { sub = await verifyIdToken('apple', b.idToken); } catch (e) { return json(res, 401, { error: 'bad_token' }); }
    const rt = await APPLE.exchange(b.code);
    if (!rt) return json(res, 400, { error: 'bad_token' }); // 코드가 틀림·만료(앱은 이 응답을 보여 주지 않는다)
    await store.putAppleToken(sub, rt);
    return json(res, 200, { ok: true });
  }
  // Apple·Google: 이미 연결된 계정이면 로그인. 처음이면 새 계정(약관 동의 필요).
  // 게스트로 로그인한 채 부르면(link) 그 게스트 계정에 연결해 기록을 그대로 옮긴다.
  const prov = url === '/api/auth/apple' ? 'apple' : url === '/api/auth/google' ? 'google' : null;
  if (prov) {
    if (limited(ip, 'sso', 30, 600000)) return json(res, 429, { error: 'slow_down' });
    let sub;
    try { sub = await verifyIdToken(prov, b.idToken); } catch (e) { return json(res, e.message === 'not_configured' ? 503 : 401, { error: e.message === 'not_configured' ? 'not_configured' : 'bad_token' }); }
    const have = await store.findByIdentity(prov, sub);
    // 이미 연결된 계정이 있으면 그 계정으로 들어간다(게스트 기록은 합치지 않는다)
    if (banned(res, have)) return;
    if (have) return json(res, 200, { token: await issue(have), me: profile(have), linked: false, existed: true });
    const cur = await userOf(req);
    if (banned(res, cur)) return;
    if (b.link && cur && !cur.prov) {
      const u = await store.linkIdentity(cur.id, prov, sub);
      return json(res, 200, { token: await issue(u), me: profile(u), linked: true });
    }
    if (b.agree !== true) return json(res, 400, { error: 'need_agree' });
    const nick = String(b.nick || '').trim().slice(0, 12);
    if (!nickOk(nick)) return json(res, 400, { error: 'bad_nick' });
    const u = await store.createUser(prov[0], { nick, prov, sub, agreed: { terms: termsOf(b), at: Date.now() } });
    return json(res, 200, { token: await issue(u), me: profile(u), created: true });
  }
  if (url === '/api/register') {
    if (limited(ip, 'reg', 10, 3600000)) return json(res, 429, { error: 'slow_down' });
    const id = String(b.id || '').toLowerCase(), pw = String(b.password || ''), nick = String(b.nick || '').trim().slice(0, 12);
    if (!ID_RE.test(id)) return json(res, 400, { error: 'bad_id' });
    if (pw.length < 8 || pw.length > 64) return json(res, 400, { error: 'bad_password' });
    if (!nickOk(nick)) return json(res, 400, { error: 'bad_nick' });
    if (b.agree !== true) return json(res, 400, { error: 'need_agree' });
    if (await store.getUser(id)) return json(res, 409, { error: 'taken' });
    const salt = crypto.randomBytes(16).toString('hex');
    const u = await store.createUser('', { id, nick, salt, pw: await hashPw(pw, salt), agreed: { terms: termsOf(b), at: Date.now() } });
    return json(res, 200, { token: await issue(u), me: profile(u) });
  }
  if (url === '/api/login') {
    if (limited(ip, 'login', 20, 600000)) return json(res, 429, { error: 'slow_down' });
    const u = await store.getUser(String(b.id || '').slice(0, 32).toLowerCase());
    if (!u || !u.pw || !sameHex(await hashPw(String(b.password || ''), u.salt), u.pw)) return json(res, 401, { error: 'wrong' });
    if (banned(res, u)) return;
    return json(res, 200, { token: await issue(u), me: profile(u) });
  }
  let u = await userOf(req);
  // 정지된 게스트는 로그인이 막혀 토큰이 없다: 계정 삭제만은 기기에 있는 게스트 ID·비밀값으로 받는다
  if (!u && url === '/api/delete' && b.guest && typeof b.guest === 'object') {
    if (limited(ip, 'gdel', 10, 600000)) return json(res, 429, { error: 'slow_down' });
    const g = await store.getUser(String(b.guest.id || '').slice(0, 32));
    if (g && g.gsec && sameHex(await hashPw(String(b.guest.secret || ''), g.gsalt), g.gsec)) u = g;
  }
  if (!u) return json(res, 401, { error: 'auth' });
  if (url !== '/api/delete' && banned(res, u)) return; // 정지된 계정은 여기서부터 아래 모든 API가 막힌다(계정 삭제만 예외)
  if (url === '/api/logout') {
    await store.revokeToken(bearer(req));
    return json(res, 200, { ok: true });
  }
  if (url === '/api/history') {
    // 오프라인 판(혼자·AI 동맹)도 표가 있으면 전적과 함께 경험치·동전을 받는다(오프라인 배율. 클리어·불멸 순위는 없음)
    // 표가 없거나 맞지 않으면 아무것도 바꾸지 않는다(옛 앱·가짜 보고). 결과 보고와 같은 길(settle)로 받는다
    if (limited(ip + u.id, 'hist', 20, 600000)) return json(res, 429, { error: 'slow_down' });
    const r = await settle(u, b, false);
    if (!r) return json(res, 200, { me: profile(u), gained: 0 });
    return json(res, 200, { me: profile(await store.getUser(u.id)), gained: r.gained, coins: r.coins, rankUp: r.rankUp, ach: r.ach });
  }
  if (url === '/api/hist') return json(res, 200, { hist: await store.history(u.id), prog: progOf(u) });
  // 판 시작: 표를 내준다(계정당 10분에 20장)
  if (url === '/api/game/start') {
    if (limited('u:' + u.id, 'tk', 20, 600000)) return json(res, 429, { error: 'slow_down' });
    if (!DIFFS.includes(b.diff)) return json(res, 400, { error: 'bad_diff' });
    // room(방 코드)을 같이 보내면 그 방에 앉아 있는지와 연결된 인원을 보고 표에 판 종류를 적는다(보상 배율·협동 미션)
    return json(res, 200, { ticket: makeTicket(u.id, b.diff, Math.min(5, Math.max(0, b.mutLv | 0)), roomSeats(b.room, u.id)) });
  }
  // 미션 상태(일일 미션 3개 + 첫 클리어 8개)
  if (url === '/api/missions') {
    if (limited('u:' + u.id, 'ms', 60, 60000)) return json(res, 429, { error: 'slow_down' });
    // 아직 안 받은 관직 승급 보상이 있으면 여기서도 준다(곡선을 바꾼 뒤 로비에 처음 들어온 기존 계정). 줬으면 바뀐 계정(me)도 같이
    const rankUp = await grantRanks(u), nu = rankUp.length ? await store.getUser(u.id) : u;
    return json(res, 200, Object.assign(rankUp.length ? { me: profile(nu), rankUp } : { rankUp }, await missionView(nu)));
  }
  // 미션 보상 받기: 조건을 확인하고 한 번만 동전을 준다
  if (url === '/api/missions/claim') {
    if (limited('u:' + u.id, 'msc', 30, 60000)) return json(res, 429, { error: 'slow_down' });
    const id = String(b.id || ''), dm = MISSIONS.daily.find((m) => m.id === id), fm = MISSIONS.firsts.find((f) => f.id === id);
    if (!dm && !fm) return json(res, 400, { error: 'bad_item' });
    if (fm && !firstDone(u, fm)) return json(res, 409, { error: 'no_claim' });
    const got = await store.missionClaim(u.id, dm ? { id, coins: dm.coins, xp: dm.xp || 0, day: jstDayKey(), need: dm.need } : { id, coins: fm.coins });
    if (got !== 'ok') return json(res, 409, { error: 'no_claim' });
    const rankUp = dm && dm.xp ? await grantRanks(await store.getUser(u.id)) : []; // 미션 경험치로 관직이 오르면 승급 보상도 같이
    const nu = await store.getUser(u.id);
    return json(res, 200, Object.assign({ me: profile(nu), coins: (dm || fm).coins, xp: dm ? dm.xp || 0 : 0, rankUp }, await missionView(nu)));
  }
  // 빠른 대전 주소는 계정당 분당 90번까지(기기는 2초마다 확인한다 = 분당 30번)
  if (url.startsWith('/api/match/') && limited('u:' + u.id, 'match', 90, 60000)) return json(res, 429, { error: 'slow_down' });
  if (url === '/api/match/join') {
    const diff = DIFFS.includes(b.diff) ? b.diff : null, di = DIFFS.indexOf(diff), pg = progOf(u);
    if (!diff || di > pg.clr + 1) return json(res, 400, { error: 'locked' });
    Object.keys(queues).forEach((k) => (queues[k] = queues[k].filter((e) => e.uid !== u.id)));
    delete matched[u.id];
    (queues[diff] = queues[diff] || []).push({ uid: u.id, at: Date.now(), seen: Date.now() });
    tryMatch(diff);
    return json(res, 200, { waiting: (queues[diff] || []).length, match: matched[u.id] || null });
  }
  if (url === '/api/match/poll') {
    let waiting = 0;
    Object.keys(queues).forEach((k) => { const e = queues[k].find((x) => x.uid === u.id); if (e) { e.seen = Date.now(); tryMatch(k); waiting = (queues[k] || []).length; } });
    return json(res, 200, { waiting, match: matched[u.id] || null });
  }
  if (url === '/api/match/leave') {
    Object.keys(queues).forEach((k) => (queues[k] = queues[k].filter((e) => e.uid !== u.id)));
    delete matched[u.id];
    return json(res, 200, { ok: true });
  }
  if (url === '/api/buy') {
    const id = String(b.item || ''), cost = SHOP.price(id);
    if (cost == null || SHOP.free(id)) return json(res, 400, { error: 'bad_item' });
    const r = await store.buy(u.id, id, cost);
    if (r === 'owned') return json(res, 409, { error: 'owned' });
    if (r === 'coins') return json(res, 400, { error: 'coins' });
    return json(res, 200, { me: profile(await store.getUser(u.id)) });
  }
  // 해금: 동전으로 잠긴 장수 하나를 연다(상점 구매와 같은 길, 보유 목록에 'unl_<id>')
  if (url === '/api/unlock') {
    if (limited('u:' + u.id, 'unl', 30, 600000)) return json(res, 429, { error: 'slow_down' });
    const id = String(b.id || ''), cost = /^[a-z]{2,16}$/.test(id) ? UNL.price(id) : null;
    if (cost == null) return json(res, 400, { error: 'bad_item' });
    const r = await store.buy(u.id, unlockKey(id), cost);
    if (r === 'owned') return json(res, 409, { error: 'owned' });
    if (r === 'coins') return json(res, 400, { error: 'coins' });
    return json(res, 200, { me: profile(await store.getUser(u.id)) });
  }
  // 첫 신화 2명(튜토리얼 보상): 계정마다 한 번. want = 이 기기에서 이미 받은 신화(로그인 전 튜토리얼)면 그대로 이어 준다.
  if (url === '/api/unlock/starter') {
    if (limited('u:' + u.id, 'unls', 5, 600000)) return json(res, 429, { error: 'slow_down' });
    const owned = u.owned || [];
    if (owned.includes(UNL.starterKey)) return json(res, 200, { me: profile(u), granted: [] });
    const pool = UNL.lockedIds().filter((id) => (THEME.units.find((d) => d.id === id) || {}).tier === 9 && !owned.includes(unlockKey(id)));
    const want = (Array.isArray(b.want) ? b.want : []).map(String).filter((id) => pool.includes(id));
    const pick = [...new Set(want)].slice(0, UNL.starterMyth);
    const rest = pool.filter((id) => !pick.includes(id));
    while (pick.length < UNL.starterMyth && rest.length) pick.push(rest.splice(crypto.randomInt(rest.length), 1)[0]);
    const me = await store.grantItems(u.id, pick.map(unlockKey).concat([UNL.starterKey]));
    return json(res, 200, { me: profile(me), granted: pick });
  }
  // 소급 해금(없앰)
  if (url === '/api/unlock/claim') {
    if (limited('u:' + u.id, 'unlc', 10, 600000)) return json(res, 429, { error: 'slow_down' });
    // 2026-11-18 닫음: 근거가 기기가 보낸 전적이라, 가짜 전적으로 유료 장수를 전부 열 수 있었다. 옛 앱이 불러도 오류가 나지 않게 빈 답만 준다.
    return json(res, 200, { me: profile(u), granted: [] });
  }
  // 보상형 광고 1회 = 동전. 서버는 시청을 검증할 수 없어(AdMob SSV는 나중) 하루 횟수만 막는다.
  if (url === '/api/ad/reward') {
    if (limited('u:' + u.id, 'ad', 10, 600000)) return json(res, 429, { error: 'slow_down' });
    const r = await store.adReward(u.id, UNL.ad.coins, UNL.ad.daily, jstDayStart());
    if (!r.ok) return json(res, 429, { error: 'ad_cap', left: 0 });
    return json(res, 200, { me: profile(await store.getUser(u.id)), coins: UNL.ad.coins, left: r.left });
  }
  // 앱스토어 결제(구매·복원 모두): 서명 거래를 검증하고 상품의 열쇠를 넣는다. 설정 전이면 503.
  if (url === '/api/iap/verify') {
    if (limited('u:' + u.id, 'iap', 30, 600000)) return json(res, 429, { error: 'slow_down' });
    // 구글 플레이: { store: 'google', productId, token }, App Store: { signed }
    let tx;
    if (b.store === 'google') {
      if (!gplayOn()) return json(res, 503, { error: 'not_configured' });
      try { tx = await verifyGooglePurchase(b.productId, b.token); } catch (e) { return json(res, 400, { error: 'bad_receipt' }); }
    } else {
      if (!iapOn()) return json(res, 503, { error: 'not_configured' });
      try { tx = await AIAP.verifyPurchase(b.signed); } catch (e) { return json(res, 400, { error: 'bad_receipt' }); }
    }
    const pid = tx.productId, items = iapItems(pid);
    if (!items || !items.length) return json(res, 400, { error: 'bad_item' });
    const r = await store.grantIap(u.id, tx.txId, pid, items, tx.at, tx.env);
    if (r === 'other') return json(res, 409, { error: 'other_account' });
    if (r === 'refunded') return json(res, 409, { error: 'refunded' }); // 환불된 거래의 옛 영수증으로 다시 열지 못한다
    if (tx.env !== 'Production') console.log(`[iap] 시험 환경 결제 env=${tx.env} uid=${u.id} product=${pid}`);
    return json(res, 200, { me: profile(await store.getUser(u.id)) });
  }
  if (url === '/api/equip') {
    // kind: icon(id=icon_<장수>) / skin(unit, id=skin_<이름> 또는 '' 해제) / map(id=map_<이름>)
    const id = String(b.id || ''), has = (x) => SHOP.free(x) || (u.owned || []).includes(x);
    let e;
    if (b.kind === 'icon' && id.startsWith('icon_') && has(id)) e = { icon: id.slice(5) };
    else if (b.kind === 'map' && id.startsWith('map_') && has(id)) e = { mapSkin: id.slice(4) };
    else if (b.kind === 'skin') {
      const unit = String(b.unit || ''), sk = SHOP.UNIT_SKINS[id.slice(5)];
      if (!id && /^[a-z]{2,16}$/.test(unit)) e = { unit, skin: null };
      else if (sk && sk.unit === unit && has(id)) e = { unit, skin: id.slice(5) };
      else return json(res, 400, { error: 'bad_item' });
    } else return json(res, 400, { error: 'bad_item' });
    return json(res, 200, { me: profile(await store.equip(u.id, e)) });
  }
  if (url === '/api/report') {
    // 채팅 신고: 방·자리로 상대 계정을 찾아 기록만 남긴다(운영자가 확인)
    if (limited(ip + u.id, 'rep', 10, 3600000)) return json(res, 429, { error: 'slow_down' });
    const room = rooms.get(String(b.room || '').toLowerCase()), p = room && room.get(String(b.slot || ''));
    const target = b.room === '#lobby' ? lobbyUid(String(b.slot || '')) : (p ? p.uid : null);
    await store.report({ by: u.id, target, nick: String(b.nick || '').slice(0, 12), text: String(b.text || '').slice(0, 120), room: String(b.room || '').slice(0, 12) });
    if (target) reportWatch(target).catch((e) => console.error('reportWatch', e && e.message)); // 기록만(자동 제재 없음)
    return json(res, 200, { ok: true });
  }
  if (url === '/api/track') {
    // 계급 칭호 갈래: 무관(mil)·문관(civ). 언제든 바꿀 수 있다.
    return json(res, 200, { me: profile(await store.setFields(u.id, { track: b.track === 'civ' ? 'civ' : 'mil' })) });
  }
  if (url === '/api/nick') {
    const nick = String(b.nick || '').trim().slice(0, 12);
    if (!nickOk(nick)) return json(res, 400, { error: 'bad_nick' });
    return json(res, 200, { me: profile(await store.setFields(u.id, { nick })) });
  }
  if (url === '/api/result') {
    // 판 하나에 한 번만: 같은 표로 두 번 보내면 무시
    if (limited('u:' + u.id, 'res', 6, 600000)) return json(res, 429, { error: 'slow_down' }); // 계정 기준(주소를 바꿔도 같은 한도)
    // 표가 없거나 맞지 않으면 아무것도 주지 않는다(settle)
    const r = await settle(u, b, true);
    if (!r) return json(res, 200, { me: profile(u), gained: 0 });
    return json(res, 200, { me: profile(await store.getUser(u.id)), gained: r.gained, coins: r.coins, rankUp: r.rankUp, ach: r.ach });
  }
  if (url === '/api/delete') {
    // 탈퇴: 비밀번호 계정은 비밀번호를, Apple·Google·게스트는 '삭제' 확인 문자를 받고 계정·연결·토큰·기록을 모두 지운다
    if (limited('u:' + u.id, 'del', 10, 600000)) return json(res, 429, { error: 'slow_down' });
    if (u.pw ? !sameHex(await hashPw(String(b.password || ''), u.salt), u.pw) : b.confirm !== 'DELETE') return json(res, 401, { error: 'wrong' });
    const appleSub = u.prov === 'apple' && u.sub ? u.sub : null, appleRt = appleSub ? await store.appleToken(appleSub) : null;
    await store.deleteUser(u.id);
    dropConns(u.id); // 열려 있는 방·로비 연결도 닫는다
    // Apple로 로그인한 계정: Apple 쪽 연결도 끊는다. 실패하면 토큰을 남겨 두고 sweepAppleTokens가 다시 시도한다(삭제 자체는 끝낸다)
    if (appleSub) {
      if (!appleRt) console.warn('[apple] 계정 삭제: 저장된 Apple 토큰이 없어 철회하지 못함', u.id);
      else { const r = await APPLE.revoke(appleRt); if (r !== 'fail') await store.dropAppleToken(appleSub, appleRt); }
    }
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'not_found' });
}

// ---------- 정적 파일 ----------
const TYPES = { '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg' };
const PAGES = { '/': 'samguk-rtd.html', '/privacy': 'legal/privacy.html', '/terms': 'legal/terms.html', '/delete-account': 'legal/delete-account.html', '/tokushoho': 'legal/tokushoho.html', '/app-ads.txt': 'app-ads.txt' }; // app-ads.txt: AdMob 판매자 확인(저장소 맨 위 파일)
const SAFE = /^\/(samguk-rtd\.html|[a-z0-9-]+\.js|gfx\/[A-Za-z0-9_]+\.(png|jpg|js)|fonts\/[A-Za-z0-9_-]+\.woff2|fonts\/fonts\.css|legal\/[a-z-]+\.html|i18n\/[a-z]{2}\.js|bgm\/[a-z_]+\.mp3)$/;
const fileCache = new Map();
function load(file, cb) {
  const full = path.join(ROOT, file);
  fs.stat(full, (err, st) => {
    if (err) return cb(err);
    const hit = fileCache.get(file);
    if (hit && hit.mtime === st.mtimeMs) return cb(null, hit);
    fs.readFile(full, (err2, data) => {
      if (err2) return cb(err2);
      const ent = { mtime: st.mtimeMs, data, gz: /\.(png|jpg|woff2|mp3)$/.test(file) ? null : zlib.gzipSync(data), etag: '"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"' };
      fileCache.set(file, ent);
      cb(null, ent);
    });
  });
}
const server = http.createServer((req, res) => {
  const [url, query] = req.url.split('?');
  if (url === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (url.startsWith('/api/')) return api(req, res, url, query);
  const file = PAGES[url] || (SAFE.test(url) && !url.includes('..') ? url.slice(1) : null);
  if (!file || file.startsWith('server/')) { res.writeHead(404); res.end('not found'); return; }
  load(file, (err, ent) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const head = { ...SEC_HEAD, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': query && /(^|&)v=/.test(query) ? 'public, max-age=31536000, immutable' : 'no-cache', ETag: ent.etag, Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === ent.etag) { res.writeHead(304, head); res.end(); return; }
    // 배경음(mp3): 구간 요청(Range)에 답한다. 사파리는 구간 요청이 안 되면 소리를 틀지 않는다.
    if (/\.mp3$/.test(file)) {
      head['Accept-Ranges'] = 'bytes';
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || ''), size = ent.data.length;
      if (m && (m[1] || m[2])) {
        const a = m[1] ? +m[1] : Math.max(0, size - +m[2]), b = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
        if (a > b || a >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
        head['Content-Range'] = `bytes ${a}-${b}/${size}`; head['Content-Length'] = b - a + 1;
        res.writeHead(206, head); res.end(ent.data.subarray(a, b + 1)); return;
      }
      head['Content-Length'] = size;
    }
    if (ent.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { head['Content-Encoding'] = 'gzip'; res.writeHead(200, head); res.end(ent.gz); return; }
    res.writeHead(200, head); res.end(ent.data);
  });
});

// ---------- 협동 방 ----------
// 방 코드 → Map(자리 id → { ws, state, uid, awayT })
const rooms = new Map();
let nextId = 1;
const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const broadcast = (room, from, msg) => room.forEach((p, id) => { if (id !== from) send(p.ws, msg); });
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE });
// ---------- WebSocket 한도 ----------
// 연결당: 초당 60개(잠깐 120개까지), 초당 128KB(잠깐 256KB까지). 정상 기기는 위치 초당 10~15번, 다 합쳐 초당 30번 안쪽이다.
// 넘친 메시지는 그것만 버린다(연결은 끊지 않는다).
const WS_RATE = 60, WS_BURST = 120, WS_BYTES = 128 * 1024, WS_BYTES_BURST = 256 * 1024;
// 주소당 동시 연결(한 사람이 방 1 + 로비 1을 쓴다. 통신사·공유기 뒤에서는 여러 사람이 한 주소를 쓰므로 넉넉히), 주소당 접속 시도, 인증 전 모아 두는 메시지 수
const WS_PER_IP = +process.env.WS_PER_IP || 40, WS_TRIES_MIN = 240, WS_EARLY = 20;
// 방 개수, 자리 하나의 상태 크기(열쇠 수·글자 수)
const MAX_ROOMS = 2000, STATE_KEYS = 64, STATE_BYTES = 32 * 1024;
const ipConns = new Map(); // 주소 → 열려 있는 연결 수
function bucketOf() {
  const b = { n: WS_BURST, b: WS_BYTES_BURST, t: Date.now() };
  return (len) => {
    const now = Date.now(), dt = Math.max(0, now - b.t) / 1000; b.t = now;
    b.n = Math.min(WS_BURST, b.n + dt * WS_RATE); b.b = Math.min(WS_BYTES_BURST, b.b + dt * WS_BYTES);
    if (b.n < 1 || b.b < len) return false; // 버리는 메시지는 통에서 빼지 않는다(계속 넘치게 보내도 한도만큼은 통과한다)
    b.n -= 1; b.b -= len; return true;
  };
}
// 방장 전용 신호. 서버가 보는 방장 = 연결이 살아 있는 사람 가운데 자리 번호가 가장 앞인 사람.
// 지금은 방장이 아닌 사람이 보내도 막지 않고 기록만 한다(기기가 보는 방장과 잠깐 어긋날 수 있어, 기록을 보고 나서 막는다).
const HOST_ONLY = new Set(['phase', 'clk', 'bs', 'hz', 'start', 'pattern', 'go']);
// 중계하는 신호 종류(net.js TOPICS에서 chat·chatno를 뺀 것). chat은 아래에서 따로 거르고, chatno는 서버만 보낸다(흉내 금지). 그 밖의 종류는 버린다.
const RELAY_TOPICS = new Set(['phase', 'hz', 'pattern', 'bs', 'dmg', 'wiped', 'start', 'pop', 'clk', 'sup', 'vol', 'go']);
const seatNo = (pid) => +String(pid).slice(1);
function hostOf(room) { let h = null; room.forEach((p, pid) => { if (p.ws && p.ws.readyState === 1 && (h === null || seatNo(pid) < seatNo(h))) h = pid; }); return h; }
// 계정당 방 자리 하나.
// 다른 방에 새로 들어오면 그 계정의 '자리 비움' 자리는 바로 비운다. 연결이 살아 있는 자리는 서버가 끊지 않는다:
// 기기(net.js)는 끊긴 방에 1.5초 뒤 다시 붙으므로, 서버가 끊으면 두 방을 오가며 서로를 밀어내는 일이 생긴다.
// 대신 살아 있던 옛 자리는 닫히는 순간 바로 비우고(아래 close), 살아 있는 다른 방 자리가 이미 2개면 새 방에 들이지 않는다.
const SEAT_LIVE_MAX = 2; // 방을 옮기는 순간에는 옛 방 연결이 아직 닫히지 않았을 수 있어 2까지 둔다
function seatsOf(uid, except) { const out = []; rooms.forEach((r, c) => { if (c !== except) r.forEach((p, pid) => { if (p.uid === uid) out.push({ r, c, p, pid }); }); }); return out; }
function freeSeat(s) { s.r.delete(s.pid); broadcast(s.r, s.pid, { k: 'left', id: s.pid }); if (!s.r.size) rooms.delete(s.c); }
// 계정의 방·로비 연결을 모두 닫고 자리를 비운다(탈퇴)
function dropConns(uid) {
  seatsOf(uid, null).forEach((s) => { const old = s.p.ws; s.p.ws = null; freeSeat(s); if (old) { try { old.close(); } catch (e) { /* 무시 */ } } });
  const lb = lobbyOf.get(uid); if (lb) { try { lb.ws.close(); } catch (e) { /* 무시 */ } }
}
wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  // 주소당 동시 연결 수와 분당 접속 시도 수를 먼저 본다(인증 전에 연결마다 저장소 조회가 한 번 돌기 때문)
  const ip = ipOf(req), open = ipConns.get(ip) || 0;
  if (open >= WS_PER_IP || limited(ip, 'wsc', WS_TRIES_MIN, 60000)) {
    warnSome('ws_conn', 20, `ip=${ip} open=${open}`);
    send(ws, { k: 'error', code: 'busy' }); ws.close(); return;
  }
  ipConns.set(ip, open + 1);
  ws.on('close', () => { const n = (ipConns.get(ip) || 1) - 1; if (n > 0) ipConns.set(ip, n); else ipConns.delete(ip); });
  ws.on('error', () => { /* 잘못된 프레임 등: 닫힘 처리에 맡긴다 */ });
  ws.allow = bucketOf();
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  // 인증은 저장소 조회가 끝난 뒤. 그 사이에 온 메시지는 잃지 않게 모아 둔다(WS_EARLY개까지).
  const early = []; const keep = (raw) => { if (early.length < WS_EARLY) early.push(raw); }; ws.on('message', keep);
  store.userByToken(q.get('t') || '').then((u) => {
    ws.off('message', keep);
    if (u && bannedUntil(u.id)) { send(ws, { k: 'error', code: 'banned', until: bannedUntil(u.id) }); ws.close(); return; } // 정지된 계정
    if (q.get('lobby')) joinLobby(ws, u, early); else joinRoom(ws, q, u, early);
  })
    .catch(() => { send(ws, { k: 'error', code: 'auth' }); ws.close(); });
});
// 방 안에서 남에게 전달되는 값: 화면에 그대로 들어가도 태그가 되지 않게 < > " ` 를 빼고, 모양(깊이·개수·열쇠 이름)을 묶는다.
// cap: 글자 수 상한(0이면 자르지 않는다)
function cleanRelay(v, cap, depth) {
  depth = depth || 0;
  if (v == null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'string') { const s = v.replace(/[<>"`]/g, ''); return cap ? s.slice(0, cap) : s; }
  if (depth >= 6) return null;
  if (Array.isArray(v)) return v.slice(0, 400).map((x) => cleanRelay(x, cap, depth + 1));
  if (typeof v === 'object') {
    const o = {};
    Object.keys(v).slice(0, 80).forEach((k) => { if (/^[A-Za-z0-9_$-]{1,24}$/.test(k) && k !== '__proto__' && k !== 'constructor' && k !== 'prototype') o[k] = cleanRelay(v[k], cap, depth + 1); });
    return o;
  }
  return null;
}
function joinRoom(ws, q, u, early) {
  const code = (q.get('room') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  if (!u) { send(ws, { k: 'error', code: 'auth' }); ws.close(); return; }
  if (!code) { send(ws, { k: 'error', code: 'bad_room' }); ws.close(); return; }
  if (!rooms.has(code) && rooms.size >= MAX_ROOMS) { send(ws, { k: 'error', code: 'full' }); ws.close(); return; }
  // 계정당 방 자리 하나: 다른 방의 '자리 비움' 자리는 비우고, 살아 있는 자리가 이미 많으면 들이지 않는다
  const others = seatsOf(u.id, code);
  if (others.filter((s) => s.p.ws).length >= SEAT_LIVE_MAX) { warnSome('ws_seats', 20, `uid=${u.id} room=${code}`); send(ws, { k: 'error', code: 'busy' }); ws.close(); return; }
  others.filter((s) => !s.p.ws).forEach(freeSeat);
  const room = rooms.get(code) || new Map();
  // 같은 계정이 60초 안에 돌아오면 원래 자리로 다시 붙는다
  let id = null;
  room.forEach((p, pid) => { if (p.uid === u.id) id = pid; });
  let me;
  if (id) {
    me = room.get(id);
    if (me.ws && me.ws !== ws) { try { me.ws.close(); } catch (e) { /* 무시 */ } }
    me.ws = ws; me.awayT = 0;
  } else {
    if (room.size >= MAX_PLAYERS) { send(ws, { k: 'error', code: 'full' }); ws.close(); return; }
    id = 'p' + String(nextId++).padStart(6, '0');
    me = { ws, state: {}, uid: u.id, awayT: 0 };
    room.set(id, me);
  }
  rooms.set(code, room);
  // 이름과 등급은 서버가 계정에서 붙인다(직접 바꿔 보낼 수 없게)
  const pf = profile(u);
  Object.assign(me.state, { name: shownNick(u.nick), lv: pf.level, gr: pf.grade, ic: pf.icon, away: 0 });
  const peers = {}; room.forEach((p, pid) => { if (pid !== id) peers[pid] = p.state; });
  send(ws, { k: 'hello', id, peers, mine: me.state });
  broadcast(room, id, { k: 'pres', id, p: me.state });
  const onMsg = (raw) => {
    if (!ws.allow(raw.length)) { warnSome('ws_rate', 20, `room=${code} from=${id} uid=${u.id}`); return; }
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object' || Array.isArray(m)) return;
    if (m.k === 'pres' && m.p && typeof m.p === 'object') {
      const p = cleanRelay(m.p, 64) || {};
      delete p.name; delete p.lv; delete p.gr; delete p.ic; delete p.away;
      // 자리 상태가 끝없이 불어나지 않게: 합친 뒤의 열쇠 수·크기가 상한을 넘으면 이 메시지는 버린다
      const next = Object.assign({}, me.state, p);
      if (Object.keys(next).length > STATE_KEYS || JSON.stringify(next).length > STATE_BYTES) { warnSome('ws_state', 20, `room=${code} from=${id} uid=${u.id}`); return; }
      Object.assign(me.state, p); broadcast(room, id, { k: 'pres', id, p });
    } else if (m.k === 'msg' && m.t === 'chat') {
      // 채팅: 도배·광고는 막고(보낸 사람에게만 까닭을 알린다), 욕설은 가려서 보낸다. 보낸 사람에게도 가린 글을 돌려준다.
      const ml = mutedLeft(u.id); // 운영자가 건 채팅 금지: 보낸 사람에게만 알리고 전달하지 않는다
      if (ml) { send(ws, { k: 'msg', from: id, t: 'chatno', d: { why: 'muted', s: ml }, self: 1 }); return; }
      const c = CHAT.check(u.id, m.d && m.d.x);
      if (!c.ok) { if (c.why !== 'empty') send(ws, { k: 'msg', from: id, t: 'chatno', d: { why: c.why, s: c.s || 0 }, self: 1 }); return; }
      const out = { k: 'msg', from: id, t: 'chat', d: { x: c.text, n: shownNick(u.nick) } };
      broadcast(room, id, out); send(ws, Object.assign({}, out, { self: 1 }));
    } else if (m.k === 'msg' && typeof m.t === 'string') {
      if (!RELAY_TOPICS.has(m.t)) { warnSome('ws_topic', 20, `room=${code} t=${m.t.slice(0, 24)} from=${id} uid=${u.id}`); return; }
      if (HOST_ONLY.has(m.t)) { const h = hostOf(room); if (h !== id) warnSome('not_host', 30, `room=${code} t=${m.t} from=${id} host=${h} uid=${u.id}`); } // 기록만, 중계는 그대로
      broadcast(room, id, { k: 'msg', from: id, t: m.t.slice(0, 24), d: cleanRelay(m.d, 0) });
    }
  };
  const safeMsg = (raw) => { try { onMsg(raw); } catch (e) { console.error('ws', e && e.message); } };
  ws.on('message', safeMsg);
  (early || []).forEach(safeMsg);
  ws.on('close', () => {
    if (me.ws !== ws) return; // 새 연결로 바뀐 뒤 옛 연결이 닫힌 것
    me.ws = null;
    // 이 계정이 이미 다른 방에 앉아 있으면(방을 옮김) 이 자리는 60초 지키지 않고 바로 비운다
    if (room.get(id) === me && seatsOf(u.id, code).length) { freeSeat({ r: room, c: code, p: me, pid: id }); return; }
    me.awayT = Date.now(); me.state.away = 1;
    broadcast(room, id, { k: 'pres', id, p: { away: 1 } });
  });
}
// ---------- 로비 채팅 ----------
// 로비에 있는 사람끼리의 채팅. 한 채널에 CH_MAX명까지, 넘치면 다음 채널이 생긴다(서버 한 대 안에서 나눈다).
// 채널 번호 → Map(연결 id → { ws, uid, nick })
const CH_MAX = 50, CH_LIMIT = 99;
const channels = new Map(), lobbyOf = new Map(); // lobbyOf: 계정 → 그 계정의 로비 연결(한 계정 한 연결)
const chCount = (n) => (channels.get(n) ? channels.get(n).size : 0);
function chList() {
  // 사람이 있는 채널과, 들어갈 수 있는 빈 채널 하나
  const out = []; let spare = 0;
  for (let n = 1; n <= CH_LIMIT; n++) { const c = chCount(n); if (c) out.push([n, c]); else if (!spare) spare = n; }
  if (spare && out.every(([, c]) => c >= CH_MAX * 0.8)) out.push([spare, 0]);
  return out.sort((a, b) => a[0] - b[0]);
}
function chPick() { for (let n = 1; n <= CH_LIMIT; n++) if (chCount(n) < CH_MAX) return n; return 0; }
function joinLobby(ws, u, early) {
  if (!u) { send(ws, { k: 'error', code: 'auth' }); ws.close(); return; }
  const old = lobbyOf.get(u.id); if (old && old.ws !== ws) { try { old.ws.close(); } catch (e) { /* 무시 */ } old.leave(); }
  const id = 'c' + String(nextId++).padStart(6, '0'), me = { ws, uid: u.id, nick: shownNick(u.nick), ch: 0, id };
  const info = () => send(ws, { k: 'ch', n: me.ch, max: CH_MAX, list: chList() });
  const enter = (n) => {
    if (me.ch === n) return info();
    if (n < 1 || n > CH_LIMIT || chCount(n) >= CH_MAX) { send(ws, { k: 'no', why: 'full' }); return info(); }
    me.leave(); me.ch = n;
    const ch = channels.get(n) || new Map(); ch.set(id, me); channels.set(n, ch); info();
  };
  me.leave = () => { const ch = channels.get(me.ch); if (ch) { ch.delete(id); if (!ch.size) channels.delete(me.ch); } me.ch = 0; };
  lobbyOf.set(u.id, me);
  const first = chPick(); if (!first) { send(ws, { k: 'error', code: 'full' }); ws.close(); return; }
  send(ws, { k: 'hello', id }); enter(first);
  const onMsg = (raw) => {
    if (!ws.allow(raw.length)) { warnSome('ws_rate', 20, `lobby from=${id} uid=${u.id}`); return; }
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object' || Array.isArray(m)) return;
    if (m.k === 'ch') { if (m.n) enter(m.n | 0); else info(); }
    else if (m.k === 'say') {
      const ml = mutedLeft(u.id); // 운영자가 건 채팅 금지
      if (ml) { send(ws, { k: 'no', why: 'muted', s: ml }); return; }
      const c = CHAT.check(u.id, m.x);
      if (!c.ok) { if (c.why !== 'empty') send(ws, { k: 'no', why: c.why, s: c.s || 0 }); return; }
      const ch = channels.get(me.ch); if (!ch) return;
      ch.forEach((p) => send(p.ws, { k: 'say', id, n: me.nick, x: c.text, self: p === me ? 1 : 0 }));
    }
  };
  const safeMsg = (raw) => { try { onMsg(raw); } catch (e) { console.error('ws', e && e.message); } };
  ws.on('message', safeMsg);
  (early || []).forEach(safeMsg);
  ws.on('close', () => { me.leave(); if (lobbyOf.get(u.id) === me) lobbyOf.delete(u.id); });
}
// 채널 인원이 바뀌면 5초마다 로비에 있는 모두에게 알린다
let chSeen = '';
setInterval(() => {
  const list = chList(), key = JSON.stringify(list);
  if (key === chSeen) return; chSeen = key;
  channels.forEach((ch, n) => ch.forEach((p) => send(p.ws, { k: 'ch', n, max: CH_MAX, list })));
}, 5000);
// 신고할 때 로비 연결 id로 상대 계정을 찾는다
function lobbyUid(cid) { let uid = null; channels.forEach((ch) => { const p = ch.get(cid); if (p) uid = p.uid; }); return uid; }

// 60초 넘게 돌아오지 않은 자리는 비운다. 남은 사람은 그 사람 없이 계속한다.
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    room.forEach((p, id) => { if (!p.ws && p.awayT && now - p.awayT > AWAY_MS) { room.delete(id); broadcast(room, id, { k: 'left', id }); } });
    if (!room.size) rooms.delete(code);
  });
}, 2000);
// 5초마다 확인: 앱을 내려 응답이 없는 연결은 10초 안에 끊고 '자리 비움'으로 바꾼다(그래야 방장이 빨리 넘어간다)
setInterval(() => wss.clients.forEach((ws) => { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } }), 5000);

// 저장소를 연 뒤에 듣기 시작한다. 시험에서는 start({ pool })로 다른 DB를 꽂을 수 있다.
async function start(opts = {}) {
  store = await openStore({ dataDir: DATA, databaseUrl: process.env.DATABASE_URL, pool: opts.pool });
  await refreshSanctions(); // 운영 제재 목록(못 읽으면 서버를 띄우지 않는다)
  const modT = setInterval(() => refreshSanctions().catch((e) => console.error('[mod] 제재 목록을 읽지 못함(앞선 목록 유지):', e && e.message)), MOD_REFRESH_MS); if (modT.unref) modT.unref();
  if (gplayOn()) { const gv = () => pollGoogleVoided().catch((e) => console.error('[iap] 구글 환불 목록 조회 실패:', e && e.message)); gv(); const gvT = setInterval(gv, GVOID_MS); if (gvT.unref) gvT.unref(); }
  const appleT = setInterval(() => sweepAppleTokens().catch((e) => console.error('[apple] 남은 토큰 정리 실패:', e && e.message)), 3600000); if (appleT.unref) appleT.unref();
  await new Promise((r) => server.listen(opts.port != null ? opts.port : PORT, r));
  console.log(`삼국 랜덤 디펜스 온라인 서버(${store.kind}): http://localhost:${server.address().port}`);
  return { server, store };
}
// 처리하지 못한 오류 하나로 서버 전체(모든 방)가 내려가지 않게 기록만 남긴다
if (require.main === module) { process.on('uncaughtException', (e) => console.error('uncaught', e)); process.on('unhandledRejection', (e) => console.error('unhandled', e)); }
if (require.main === module) start().catch((e) => { console.error(e); process.exit(1); });
module.exports = { start };
