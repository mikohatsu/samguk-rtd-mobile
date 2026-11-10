// 삼국 랜덤 디펜스 온라인 서버(모바일판).
// - 게임 파일 제공(정적)
// - 계정: Apple·Google·게스트 로그인(게스트는 나중에 Apple/Google로 연결), 탈퇴, 등급(경험치) 기록, 순위
// - 협동 방 중계(WebSocket). 로그인한 사람만 들어온다. 앱을 내려 연결이 끊겨도 60초 동안 자리를 지킨다.
// 계정은 저장소(store/)에 둔다: DATABASE_URL이 있으면 PostgreSQL(db/schema.sql), 없으면 JSON 파일.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const SHOP = require('../shop.js');
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

const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
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

// 판 보고를 검사해 전적 한 줄로 만든다(숫자만, 크기 제한). 저장은 store가 한다.
function histOf(b, online) {
  const diff = DIFFS.includes(b.diff) ? b.diff : 'easy', mut = Math.min(5, Math.max(0, b.mutLv | 0));
  const myth = {}; if (b.myth && typeof b.myth === 'object') Object.keys(b.myth).slice(0, 30).forEach((id) => { if (/^[a-z]{2,16}$/.test(id)) myth[id] = Math.min(50, b.myth[id] | 0); });
  const st = {}; if (b.st && typeof b.st === 'object') ['kills', 'midKill', 'midMiss', 'lifeLost', 'goldIn', 'goldUp', 'goldHire', 'combines', 'crafts', 'best', 'tickets', 'chests', 'bosses', 'bossWins', 'fast'].forEach((k) => { if (typeof b.st[k] === 'number') st[k] = Math.round(b.st[k]); });
  return { at: Date.now(), diff, mut, round: Math.min(200, Math.max(0, b.round | 0)), win: !!b.win, time: Math.max(0, Math.round(+b.time || 0)), online: !!online, mode: String(b.mode || '').slice(0, 8), myth, st };
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
const pub = (u) => ({ nick: shownNick(u.nick), icon: iconOf(u), level: levelOf(u.xp), grade: gradeOf(u) });
// 금칙어(채팅은 *** 로 가리고, 닉네임은 거절). 운영하며 늘린다.
const BAD = ['씨발', '시발', 'ㅅㅂ', '병신', 'ㅂㅅ', '좆', '개새끼', '느금', '니애미', '섹스', '자지', '보지', '씹', '창녀', '걸레년', 'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot', 'porn', 'pussy', 'dick', '死ね', 'しね', 'ころす', 'きちがい', 'ちんこ', 'まんこ', 'セックス', '傻逼', '操你', '他妈的', '去死', '鸡巴', '做爱', '婊子'];
// 닉네임: 띄어쓰기·기호·숫자를 빼고 소문자로 바꿔 검사한다('섹 스', 's.e.x' 같은 우회도 잡는다)
const squash = (s) => String(s || '').toLowerCase().replace(/[\s\d_\-.·,!?~*'"`^()[\]{}|/\\+=:;@#$%&]/g, '');
const nickBad = (n) => { const q = squash(n); return BAD.some((w) => q.includes(w.toLowerCase())); };
// 이미 쓰고 있는 나쁜 닉네임은 다른 사람에게 *** 로 보인다(본인은 바꾸라는 안내를 받는다)
const shownNick = (n) => (nickBad(n) ? '***' : n);
const clean = (txt) => { let o = String(txt || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 80); BAD.forEach((w) => { const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); o = o.replace(re, '*'.repeat(w.length)); }); return o; };

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
  handle(req, res, url, query).catch((e) => { console.error('api', url, e); if (!res.headersSent) json(res, 500, { error: 'server' }); });
}
async function handle(req, res, url, query) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (url === '/api/rank' && req.method === 'GET') {
    // type=level | clear(&diff=) | imm(&id=)
    const q = new URLSearchParams(query || ''), type = q.get('type');
    if (type === 'clear') {
      const list = (await store.rankClear(String(q.get('diff') || ''), 30)).map((c) => ({ time: c.time, mut: c.mut, at: c.at, members: c.members.map((m) => (m.user ? pub(m.user) : { nick: shownNick(m.nick), icon: m.icon })) }));
      return json(res, 200, { list });
    }
    if (type === 'imm') {
      const list = (await store.rankImm(String(q.get('id') || ''), 30)).map((x) => Object.assign(pub(x.user), { n: x.n }));
      return json(res, 200, { list });
    }
    const list = (await store.rankLevel(50)).map((u) => Object.assign(pub(u), { xp: u.xp, games: u.games }));
    return json(res, 200, { list });
  }
  if (url === '/api/ranking' && req.method === 'GET') {
    return json(res, 200, { top: (await store.rankLevel(50)).map(profile) });
  }
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
    const u = await store.createUser('g', { nick, gsalt: salt, gsec: hashPw(secret, salt), agreed: { terms: b.termsVer || 1, at: Date.now() } });
    return json(res, 200, { token: await issue(u), me: profile(u), guest: { id: u.id, secret } });
  }
  if (url === '/api/guest/login') {
    if (limited(ip, 'glogin', 30, 600000)) return json(res, 429, { error: 'slow_down' });
    const u = await store.getUser(String(b.id || ''));
    if (!u || !u.gsec || hashPw(String(b.secret || ''), u.gsalt) !== u.gsec) return json(res, 401, { error: 'wrong' });
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
    const u = await store.createUser(prov[0], { nick, prov, sub, agreed: { terms: b.termsVer || 1, at: Date.now() } });
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
    const u = await store.createUser('', { id, nick, salt, pw: hashPw(pw, salt), agreed: { terms: b.termsVer || 1, at: Date.now() } });
    return json(res, 200, { token: await issue(u), me: profile(u) });
  }
  if (url === '/api/login') {
    if (limited(ip, 'login', 20, 600000)) return json(res, 429, { error: 'slow_down' });
    const u = await store.getUser(String(b.id || '').toLowerCase());
    if (!u || !u.pw || hashPw(String(b.password || ''), u.salt) !== u.pw) return json(res, 401, { error: 'wrong' });
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
    await store.report({ by: u.id, target: p ? p.uid : null, nick: String(b.nick || '').slice(0, 12), text: String(b.text || '').slice(0, 120), room: String(b.room || '').slice(0, 12) });
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
    if (limited(ip + u.id, 'res', 6, 600000)) return json(res, 429, { error: 'slow_down' });
    const key = String(b.key || '').slice(0, 40);
    if (!key) return json(res, 200, { me: profile(u), gained: 0 });
    const gained = xpFor(b), coins = Math.round(gained / 5) + (b.win ? 20 : 0); // 동전: 경험치의 1/5 + 클리어 20
    // 불멸 장수를 이번 판에 몇 번 소환했는지(장수별로 쌓는다)
    const imm = {}; if (b.imm && typeof b.imm === 'object') Object.keys(b.imm).slice(0, 12).forEach((id) => { const n = Math.min(20, b.imm[id] | 0); if (/^[a-z]{2,16}$/.test(id) && n > 0) imm[id] = n; });
    // 클리어 시간: 같은 판(같은 열쇠)을 마친 파티원을 한 줄에 모은다
    const diff = String(b.diff || ''), time = Math.round(+b.time || 0);
    const clear = b.win && DIFF_MUL[diff] && time > 60 ? { diff, party: String(b.party || key).slice(0, 40), time, mut: Math.min(5, Math.max(0, b.mutLv | 0)) } : null;
    const done = await store.recordResult(u.id, { key, xp: gained, coins, win: !!b.win, round: Math.min(200, Math.max(0, b.round | 0)), hist: histOf(b, true), imm, clear });
    if (!done) return json(res, 200, { me: profile(u), gained: 0 });
    return json(res, 200, { me: profile(await store.getUser(u.id)), gained, coins });
  }
  if (url === '/api/delete') {
    // 탈퇴: 비밀번호 계정은 비밀번호를, Apple·Google·게스트는 '삭제' 확인 문자를 받고 계정·연결·토큰·기록을 모두 지운다
    if (u.pw ? hashPw(String(b.password || ''), u.salt) !== u.pw : b.confirm !== 'DELETE') return json(res, 401, { error: 'wrong' });
    await store.deleteUser(u.id);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'not_found' });
}

// ---------- 정적 파일 ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.css': 'text/css; charset=utf-8' };
const PAGES = { '/': 'samguk-rtd.html', '/privacy': 'legal/privacy.html', '/terms': 'legal/terms.html' };
const SAFE = /^\/(samguk-rtd\.html|[a-z0-9-]+\.js|gfx\/[A-Za-z0-9_]+\.(png|jpg|js)|fonts\/[A-Za-z0-9_-]+\.woff2|fonts\/fonts\.css|legal\/[a-z-]+\.html|i18n\/[a-z]{2}\.js)$/;
const fileCache = new Map();
function load(file, cb) {
  const full = path.join(ROOT, file);
  fs.stat(full, (err, st) => {
    if (err) return cb(err);
    const hit = fileCache.get(file);
    if (hit && hit.mtime === st.mtimeMs) return cb(null, hit);
    fs.readFile(full, (err2, data) => {
      if (err2) return cb(err2);
      const ent = { mtime: st.mtimeMs, data, gz: /\.(png|jpg|woff2)$/.test(file) ? null : zlib.gzipSync(data), etag: '"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"' };
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
wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  // 인증은 저장소 조회가 끝난 뒤. 그 사이에 온 메시지는 잃지 않게 모아 둔다.
  const early = []; const keep = (raw) => early.push(raw); ws.on('message', keep);
  store.userByToken(q.get('t') || '').then((u) => { ws.off('message', keep); joinRoom(ws, q, u, early); })
    .catch(() => { send(ws, { k: 'error', code: 'auth' }); ws.close(); });
});
function joinRoom(ws, q, u, early) {
  const code = (q.get('room') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  if (!u) { send(ws, { k: 'error', code: 'auth' }); ws.close(); return; }
  if (!code) { send(ws, { k: 'error', code: 'bad_room' }); ws.close(); return; }
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
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.k === 'pres' && m.p && typeof m.p === 'object') {
      delete m.p.name; delete m.p.lv; delete m.p.gr; delete m.p.ic; delete m.p.away;
      Object.assign(me.state, m.p); broadcast(room, id, { k: 'pres', id, p: m.p });
    } else if (m.k === 'msg' && m.t === 'chat') {
      // 채팅: 1초에 1번, 80자, 금칙어 가림. 보낸 사람에게도 가린 글을 돌려준다.
      const now = Date.now(); if (now - (me.chatT || 0) < 1000) return; me.chatT = now;
      const txt = clean(m.d && m.d.x); if (!txt.trim()) return;
      const out = { k: 'msg', from: id, t: 'chat', d: { x: txt, n: shownNick(u.nick) } };
      broadcast(room, id, out); send(ws, Object.assign({}, out, { self: 1 }));
    } else if (m.k === 'msg' && typeof m.t === 'string') broadcast(room, id, { k: 'msg', from: id, t: m.t, d: m.d });
  };
  ws.on('message', onMsg);
  (early || []).forEach(onMsg);
  ws.on('close', () => {
    if (me.ws !== ws) return; // 새 연결로 바뀐 뒤 옛 연결이 닫힌 것
    me.ws = null; me.awayT = Date.now(); me.state.away = 1;
    broadcast(room, id, { k: 'pres', id, p: { away: 1 } });
  });
}
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
if (require.main === module) start().catch((e) => { console.error(e); process.exit(1); });
module.exports = { start };
