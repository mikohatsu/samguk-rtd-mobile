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
// 등급: 경험치로 레벨, 레벨 구간으로 계급
// 레벨은 51(군주)에서 멈춘다. 경험치 10만(대략 1000판)이면 군주.
const MAX_LV = 51;
const levelOf = (xp) => Math.min(MAX_LV, Math.floor(Math.sqrt(xp / 40)) + 1);
// 계급: 0 신병, 1~9 = 9품~1품, 10 군주. 문관(civ)·무관(mil) 중 고른 쪽 칭호로 보인다(화면에서 rk_<갈래><단계>로 번역).
const RANK_LV = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, MAX_LV];
const rankOf = (lv) => RANK_LV.reduce((k, min, i) => (lv >= min ? i : k), 0);
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
// App Store 서명 거래(StoreKit 2 JWS) 검증. APPLE_IAP_ROOT_CA(애플 루트 인증서 G3 파일 경로)가 없으면 결제는 꺼져 있다(503).
const IAP = { root: process.env.APPLE_IAP_ROOT_CA || '', bundle: (process.env.APPLE_BUNDLE || 'com.hongsungjae.sangokurtd') };
const iapOn = () => !!IAP.root && fs.existsSync(IAP.root);
function verifySignedTx(jws) {
  const bad = () => new Error('bad_receipt'), parts = String(jws || '').split('.');
  if (parts.length !== 3 || jws.length > 20000) throw bad();
  let head, body; try { head = JSON.parse(b64(parts[0]).toString('utf8')); body = JSON.parse(b64(parts[1]).toString('utf8')); } catch (e) { throw bad(); }
  if (head.alg !== 'ES256' || !Array.isArray(head.x5c) || head.x5c.length < 2 || head.x5c.length > 4) throw bad();
  const certs = head.x5c.map((c) => new crypto.X509Certificate(Buffer.from(String(c), 'base64'))), root = new crypto.X509Certificate(fs.readFileSync(IAP.root));
  const now = Date.now(), live = (c) => Date.parse(c.validFrom) <= now && now <= Date.parse(c.validTo);
  for (let i = 0; i < certs.length - 1; i++) if (!live(certs[i]) || !certs[i].verify(certs[i + 1].publicKey)) throw bad();
  const last = certs[certs.length - 1];
  if (!(last.fingerprint256 === root.fingerprint256 || last.verify(root.publicKey))) throw bad();
  // [확인 필요] 애플 권장: 잎 인증서 OID 1.2.840.113635.100.6.11.1, 중간 1.2.840.113635.100.6.2.1 확인. 지금은 체인·서명·번들만 본다.
  if (!crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), { key: certs[0].publicKey, dsaEncoding: 'ieee-p1363' }, b64(parts[2]))) throw bad();
  if (body.bundleId !== IAP.bundle || body.revocationDate || !body.productId || !body.transactionId) throw bad();
  return body;
}

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
// 돌려주는 값: { productId, txId, at } (구매 완료 상태일 때만). 아니면 bad_receipt
async function verifyGooglePurchase(productId, token) {
  const bad = () => new Error('bad_receipt'), pid = String(productId || ''), t = String(token || '');
  if (!/^[a-z0-9_.]{1,100}$/.test(pid) || !/^[A-Za-z0-9._-]{10,1000}$/.test(t)) throw bad();
  const u = GPLAY.api + '/androidpublisher/v3/applications/' + encodeURIComponent(GPLAY.pkg) + '/purchases/products/' + encodeURIComponent(pid) + '/tokens/' + encodeURIComponent(t);
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + await gplayToken() } });
  if (!r.ok) throw bad();
  const p = await r.json();
  // purchaseState: 0 구매 완료, 1 취소(환불), 2 대기
  if (p.purchaseState !== 0 || !p.orderId) throw bad();
  return { productId: pid, txId: 'g:' + String(p.orderId).slice(0, 60), at: +p.purchaseTimeMillis || Date.now() };
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

// 판 결과 → 경험치. 온라인 판만 센다. 난이도·도달 라운드·승리에 따라 준다.
const DIFF_MUL = { easy: 1, normal: 1.3, hard: 1.6, nightmare: 2 };
function xpFor(r) {
  const mul = (DIFF_MUL[r.diff] || 1) * (1 + Math.min(5, Math.max(0, r.mutLv | 0)) * 0.15);
  return Math.round((15 + Math.min(120, Math.max(0, r.round | 0)) * 0.8 + (r.win ? 60 : 0)) * mul);
}

function readBody(req, cb) {
  let n = 0; const parts = [];
  req.on('data', (c) => { n += c.length; if (n > 8192) { req.destroy(); return; } parts.push(c); });
  req.on('end', () => { try { cb(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch (e) { cb(null); } });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
  res.end(JSON.stringify(obj));
}
const ID_RE = /^[a-z0-9_]{4,16}$/;
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
      const list = await cached(rankCache, 'clear:' + diff, async () => (await store.rankClear(diff, 30)).map((c) => ({ time: c.time, mut: c.mut, at: c.at, members: c.members.map((m) => (m.user ? pub(m.user) : { nick: shownNick(m.nick), icon: m.icon })) })));
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
  if (url === '/api/me' && req.method === 'GET') {
    const u = await userOf(req);
    return u ? json(res, 200, { me: profile(u) }) : json(res, 401, { error: 'auth' });
  }
  if (req.method !== 'POST') return json(res, 404, { error: 'not_found' });
  const b = await new Promise((r) => readBody(req, r));
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
    return json(res, 200, { token: await issue(u), me: profile(u) });
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
    if (have) return json(res, 200, { token: await issue(have), me: profile(have), linked: false, existed: true });
    const cur = await userOf(req);
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
    return json(res, 200, { token: await issue(u), me: profile(u) });
  }
  const u = await userOf(req);
  if (!u) return json(res, 401, { error: 'auth' });
  if (url === '/api/logout') {
    await store.revokeToken(bearer(req));
    return json(res, 200, { ok: true });
  }
  if (url === '/api/history') {
    // 오프라인 판도 로그인해 있으면 전적에 남긴다(경험치·동전·랭킹은 없음)
    if (limited(ip + u.id, 'hist', 20, 600000)) return json(res, 429, { error: 'slow_down' });
    return json(res, 200, { me: profile(await store.addHistory(u.id, histOf(b, false))) });
  }
  if (url === '/api/hist') return json(res, 200, { hist: await store.history(u.id), prog: progOf(u) });
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
  // 소급 해금: 이미 소환한 적 있는 잠금 장수(판 기록·불멸 소환 수)를 연다. 여러 번 불러도 같다.
  if (url === '/api/unlock/claim') {
    if (limited('u:' + u.id, 'unlc', 10, 600000)) return json(res, 429, { error: 'slow_down' });
    const locked = UNL.lockedIds(), ever = (await store.everMyth(u.id)).filter((id) => locked.includes(id) && !(u.owned || []).includes(unlockKey(id)));
    const me = ever.length ? await store.grantItems(u.id, ever.map(unlockKey)) : u;
    return json(res, 200, { me: profile(me), granted: ever });
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
      let t; try { t = verifySignedTx(b.signed); } catch (e) { return json(res, 400, { error: 'bad_receipt' }); }
      tx = { productId: String(t.productId), txId: String(t.originalTransactionId || t.transactionId).slice(0, 64), at: +t.purchaseDate || Date.now() };
    }
    const pid = tx.productId, items = iapItems(pid);
    if (!items || !items.length) return json(res, 400, { error: 'bad_item' });
    const r = await store.grantIap(u.id, tx.txId, pid, items, tx.at);
    if (r === 'other') return json(res, 409, { error: 'other_account' });
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
    // 판 하나에 한 번만: 같은 방·판 열쇠로 두 번 보내면 무시
    if (limited('u:' + u.id, 'res', 6, 600000)) return json(res, 429, { error: 'slow_down' }); // 계정 기준(주소를 바꿔도 같은 한도)
    const key = String(b.key || '').slice(0, 40);
    if (!key) return json(res, 200, { me: profile(u), gained: 0 });
    const gained = xpFor(b), coins = Math.round(gained / 5) + (b.win ? 20 : 0); // 동전: 경험치의 1/5 + 클리어 20
    // 불멸 장수를 이번 판에 몇 번 소환했는지(장수별로 쌓는다)
    const imm = {}; if (b.imm && typeof b.imm === 'object') Object.keys(b.imm).slice(0, 12).forEach((id) => { const n = Math.min(20, b.imm[id] | 0); if (/^[a-z]{2,16}$/.test(id) && n > 0) imm[id] = n; });
    // 클리어 시간: 같은 판(같은 열쇠)을 마친 파티원을 한 줄에 모은다
    const diff = String(b.diff || ''), time = timeOf(b), round = Math.min(200, Math.max(0, b.round | 0));
    // 시간이 라운드 수에 비해 불가능하게 짧은 보고는 아무것도 주지 않는다(경험치·동전·순위·전적). 까닭은 알려 주지 않고 기록만 남긴다.
    // 시간이 없는 보고는 전처럼 클리어 순위에서만 뺀다(아래 time > 60).
    if (tooFast(round, time)) {
      warnSome('result_fast', 20, `uid=${u.id} round=${round} time=${time} diff=${diff.slice(0, 12)} win=${!!b.win}`);
      return json(res, 200, { me: profile(u), gained: 0 });
    }
    const clear = b.win && DIFF_MUL[diff] && time > 60 ? { diff, party: String(b.party || key).slice(0, 40), time, mut: Math.min(5, Math.max(0, b.mutLv | 0)) } : null;
    const done = await store.recordResult(u.id, { key, xp: gained, coins, win: !!b.win, round, hist: histOf(b, true), imm, clear });
    if (!done) return json(res, 200, { me: profile(u), gained: 0 });
    return json(res, 200, { me: profile(await store.getUser(u.id)), gained, coins });
  }
  if (url === '/api/delete') {
    // 탈퇴: 비밀번호 계정은 비밀번호를, Apple·Google·게스트는 '삭제' 확인 문자를 받고 계정·연결·토큰·기록을 모두 지운다
    if (limited('u:' + u.id, 'del', 10, 600000)) return json(res, 429, { error: 'slow_down' });
    if (u.pw ? !sameHex(await hashPw(String(b.password || ''), u.salt), u.pw) : b.confirm !== 'DELETE') return json(res, 401, { error: 'wrong' });
    await store.deleteUser(u.id);
    dropConns(u.id); // 열려 있는 방·로비 연결도 닫는다
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'not_found' });
}

// ---------- 정적 파일 ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg' };
const PAGES = { '/': 'samguk-rtd.html', '/privacy': 'legal/privacy.html', '/terms': 'legal/terms.html', '/delete-account': 'legal/delete-account.html' };
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
    const head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': query && /(^|&)v=/.test(query) ? 'public, max-age=31536000, immutable' : 'no-cache', ETag: ent.etag, Vary: 'Accept-Encoding' };
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
const HOST_ONLY = new Set(['phase', 'clk', 'bs', 'hz', 'start', 'pattern']);
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
  store.userByToken(q.get('t') || '').then((u) => { ws.off('message', keep); if (q.get('lobby')) joinLobby(ws, u, early); else joinRoom(ws, q, u, early); })
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
      const c = CHAT.check(u.id, m.d && m.d.x);
      if (!c.ok) { if (c.why !== 'empty') send(ws, { k: 'msg', from: id, t: 'chatno', d: { why: c.why, s: c.s || 0 }, self: 1 }); return; }
      const out = { k: 'msg', from: id, t: 'chat', d: { x: c.text, n: shownNick(u.nick) } };
      broadcast(room, id, out); send(ws, Object.assign({}, out, { self: 1 }));
    } else if (m.k === 'msg' && typeof m.t === 'string') {
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
  await new Promise((r) => server.listen(opts.port != null ? opts.port : PORT, r));
  console.log(`삼국 랜덤 디펜스 온라인 서버(${store.kind}): http://localhost:${server.address().port}`);
  return { server, store };
}
// 처리하지 못한 오류 하나로 서버 전체(모든 방)가 내려가지 않게 기록만 남긴다
if (require.main === module) { process.on('uncaughtException', (e) => console.error('uncaught', e)); process.on('unhandledRejection', (e) => console.error('unhandled', e)); }
if (require.main === module) start().catch((e) => { console.error(e); process.exit(1); });
module.exports = { start };
