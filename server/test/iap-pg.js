// 결제 검증·환불 회수 시험(2026-11-24 SEC-101·SEC-105).
// 1) 저장소(pg-mem·JSON): 환경 기록, 그 거래로 들어간 열쇠만 회수, 다른 유효 결제·동전 구매 열쇠는 남김, 환불 뒤 재사용 거절, 재화 그대로
// 2) 서버(pg-mem, 로컬 8300): 가짜 루트 CA로 Apple 사슬을 만들어 위조 인증서(OID 없음·CA 아님·다른 루트·만료 등) 거절, 정상 구매(샌드박스 포함),
//    App Store Server Notifications V2 REFUND로 회수, 구글 Voided Purchases 주기 조회로 회수, App Store Server API 재조회(키 있을 때)
// 쓰는 법: cd server && node test/iap-pg.js   (외부로 나가는 요청 없음. Apple·Google 주소는 127.0.0.1의 가짜 서버로 바꾼다)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawn } = require('child_process');
const { newDb } = require('pg-mem');
const C = require('./iap-certs');
const TH = require('../../theme-samguk.js');

// 시험 서버 포트: 기본 로컬 8300. 이미 누가 쓰고 있으면(다른 팀원의 개발 서버) 남의 서버에 붙지 않게 비어 있는 로컬 포트를 쓴다.
// 이 시험은 127.0.0.1에만 붙는다(운영 주소로 나가지 않는다).
let PORT = +process.env.TEST_PORT || 8300;
const BUNDLE = 'com.hongsungjae.sangokurtd';
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tier = (id) => (TH.units.find((d) => d.id === id) || {}).tier;
const locked = TH.unlock.lockedIds(), imm = locked.filter((id) => tier(id) === 10), myth = locked.filter((id) => tier(id) === 9);
const KEY = (id) => TH.unlock.key(id);

// ---------- 1) 저장소 ----------
async function storeTests() {
  const itemsOf = (pid) => (pid === 'all10' ? imm.map(KEY) : pid === 'noads' ? ['noads'] : pid.startsWith('one_') ? [KEY(pid.slice(4))] : []);
  const mem = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const { Pool } = mem.adapters.createPg();
  const { openStore } = require('../store');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-iapjs-'));
  for (const [kind, s] of [['pg', await openStore({ pool: new Pool() })], ['json', await openStore({ dataDir: dir })]]) {
    const u = await s.createUser('g', { nick: '조조', gsalt: 'a', gsec: 'b', agreed: { terms: 1, at: Date.now() } });
    const x = imm[0];
    ok((await s.grantIap(u.id, 't1', 'one_' + x, [KEY(x)], Date.now(), 'Sandbox')) === 'ok', `[${kind}] 단품 결제`);
    ok((await s.grantIap(u.id, 't2', 'all10', imm.map(KEY), Date.now(), 'Production')) === 'ok', `[${kind}] 불멸 전체 결제(단품과 겹침)`);
    ok((await s.grantIap(u.id, 't3', 'noads', ['noads'], Date.now(), 'Production')) === 'ok', `[${kind}] 광고 제거 결제`);
    const p1 = await s.purchase('t1'), p2 = await s.purchase('t2');
    ok(p1 && p1.env === 'Sandbox' && p1.items.join() === KEY(x), `[${kind}] 환경 Sandbox·새로 넣은 열쇠 기록 (${p1 && p1.env}, ${p1 && p1.items})`);
    ok(p2 && p2.env === 'Production' && !p2.items.includes(KEY(x)) && p2.items.length === imm.length - 1, `[${kind}] 겹친 열쇠는 뒤 거래의 기록에 없음`);
    const coins0 = (await s.getUser(u.id)).coins || 0;
    let r = await s.revokeIap('t2', itemsOf);
    let me = await s.getUser(u.id);
    ok(r.result === 'ok' && me.owned.includes(KEY(x)) && !me.owned.includes(KEY(imm[1])) && me.owned.includes('noads'), `[${kind}] 전체 결제 환불: 단품으로 산 장수·광고 제거는 남고 나머지 회수 (뺀 ${r.removed.length})`);
    r = await s.revokeIap('t2', itemsOf);
    ok(r.result === 'already', `[${kind}] 같은 환불 두 번 → already`);
    ok((await s.grantIap(u.id, 't2', 'all10', imm.map(KEY), Date.now(), 'Production')) === 'refunded' && !(await s.getUser(u.id)).owned.includes(KEY(imm[1])), `[${kind}] 환불된 거래의 옛 영수증으로 다시 열지 못함`);
    r = await s.revokeIap('t3', itemsOf); me = await s.getUser(u.id);
    ok(r.result === 'ok' && !me.owned.includes('noads') && (me.coins || 0) === coins0, `[${kind}] 광고 제거 환불 → noads 회수, 동전 그대로`);
    ok((await s.revokeIap('nope', itemsOf)).result === 'unknown', `[${kind}] 모르는 거래 → unknown`);
    ok((await s.grantIap(u.id, 't1', 'one_' + x, [KEY(x)], Date.now(), 'Sandbox')) === 'ok' && (await s.revokeIap('t1', itemsOf)).result === 'ok' && !(await s.getUser(u.id)).owned.includes(KEY(x)), `[${kind}] 단품 환불 → 회수`);
    if (kind === 'pg') {
      // 이 기능 전의 결제 줄(items 없음): 상품 열쇠 전체에서 동전으로 산 것만 남긴다
      const v = await s.createUser('g', { nick: '유비', gsalt: 'a', gsec: 'b', agreed: { terms: 1, at: Date.now() } });
      await s.grantItems(v.id, imm.slice(0, 3).map(KEY));
      const pool = new Pool();
      await pool.query("INSERT INTO purchases (transaction_id, account_id, product_id, gems, purchased_at) VALUES ('old1', $1, 'all10', 0, now())", [v.id]);
      await pool.query("INSERT INTO currency_ledger (account_id, currency, delta, balance_after, reason, ref) VALUES ($1, 'coin', -100, 0, 'buy', $2)", [v.id, KEY(imm[0])]);
      r = await s.revokeIap('old1', itemsOf); me = await s.getUser(v.id);
      ok(r.result === 'ok' && me.owned.includes(KEY(imm[0])) && !me.owned.includes(KEY(imm[1])), '[pg] 옛 결제 줄 환불: 동전으로 산 장수는 남김');
    }
    await s.close();
  }
}

// ---------- 2) 서버 ----------
const root = C.makeRoot(), evilRoot = C.makeRoot('Test Apple Root CA - G3'); // 같은 이름의 다른 루트
const good = C.makeChain(root);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-iap-'));
const ROOT_FILE = path.join(TMP, 'AppleRootCA-G3.cer'); fs.writeFileSync(ROOT_FILE, root.der);
const apiKey = C.newKey();
const API_KEY_FILE = path.join(TMP, 'SubscriptionKey_TEST.p8'); fs.writeFileSync(API_KEY_FILE, apiKey.privateKey.export({ type: 'pkcs8', format: 'pem' }));
const ga = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

// 가짜 Apple·Google
const mock = { apple: {}, gp: {}, voided: [], apiAuth: [] };
const fake = http.createServer((req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const u = req.url;
  if (u === '/token') return send(200, { access_token: 'gtok', expires_in: 3600 });
  let m = /^\/inApps\/v1\/transactions\/([^/?]+)$/.exec(u);
  if (m) { mock.apiAuth.push(req.headers.authorization || ''); const a = mock.apple[decodeURIComponent(m[1])]; return a ? send(a.code, a.body) : send(404, { errorCode: 4040010 }); }
  m = /\/purchases\/products\/([^/]+)\/tokens\/([^/?]+)$/.exec(u);
  if (m) { const p = mock.gp[decodeURIComponent(m[2])]; return p ? send(200, p) : send(404, {}); }
  if (/\/purchases\/voidedpurchases\?/.test(u)) return send(200, { voidedPurchases: mock.voided.map((o) => ({ orderId: o, purchaseToken: 'x', voidedTimeMillis: String(Date.now()) })) });
  send(404, {});
});

let GP = 0;
function startServer(extra) {
  const sa = path.join(TMP, 'sa.json');
  fs.writeFileSync(sa, JSON.stringify({ client_email: 't@example.iam.gserviceaccount.com', private_key: ga.privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: `http://127.0.0.1:${GP}/token` }));
  const env = Object.assign({}, process.env, {
    PORT: String(PORT), DATA_DIR: fs.mkdtempSync(path.join(TMP, 'd')), DATABASE_URL: '',
    APPLE_IAP_ROOT_CA: ROOT_FILE, APPLE_IAP_KEY_PATH: '', APPLE_IAP_KEY_ID: '', APPLE_IAP_ISSUER_ID: '', APPLE_IAP_API: `http://127.0.0.1:${GP}`, APPLE_IAP_ENVS: '',
    GOOGLE_PLAY_SA: sa, GOOGLE_PLAY_API: `http://127.0.0.1:${GP}`, GOOGLE_VOID_POLL_MS: '1000',
  }, extra || {});
  const srv = spawn(process.execPath, [path.join(__dirname, 'pgmem-serve.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.log = ''; srv.stdout.on('data', (d) => (srv.log += d)); srv.stderr.on('data', (d) => (srv.log += d));
  return srv;
}
let base = `http://127.0.0.1:${PORT}`;
async function pickPort() {
  const busy = await new Promise((r) => { const t = http.createServer(); t.once('error', () => r(true)); t.listen(PORT, () => t.close(() => r(false))); });
  if (!busy) return;
  const t = http.createServer(); await new Promise((r) => t.listen(0, '127.0.0.1', r)); const p = t.address().port; await new Promise((r) => t.close(r));
  console.log(`     로컬 ${PORT}을 다른 프로세스가 쓰고 있어 ${p}에서 시험한다`); PORT = p; base = `http://127.0.0.1:${PORT}`;
}
async function waitUp() { for (let i = 0; i < 100; i++) { try { await fetch(base + '/health'); return; } catch (e) { await sleep(200); } } throw new Error('서버가 뜨지 않음'); }
async function waitDown() { for (let i = 0; i < 50; i++) { try { await fetch(base + '/health'); await sleep(200); } catch (e) { return; } } }
const api = async (p, body, tok) => {
  const r = await fetch(base + p, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) });
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
const me = async (tok) => (await (await fetch(base + '/api/me', { headers: { authorization: 'Bearer ' + tok } })).json()).me;
const guest = async (nick) => (await api('/api/guest/new', { agree: true, nick })).token;
let txn = 2000000000;
const tx = (productId, o = {}) => Object.assign({ bundleId: BUNDLE, productId, transactionId: String(++txn), originalTransactionId: String(txn), environment: 'Sandbox', purchaseDate: Date.now(), type: 'Non-Consumable' }, o);
const notify = (type, t, chain = good, o = {}) => C.signJws(Object.assign({ notificationType: type, notificationUUID: crypto.randomUUID(), version: '2.0', signedDate: Date.now(),
  data: { bundleId: BUNDLE, environment: t.environment, signedTransactionInfo: C.signJws(Object.assign({}, t, { revocationDate: Date.now(), revocationReason: 0 }), good) } }, o), chain);

async function serverA() {
  const srv = startServer();
  try {
    await waitUp();
    const st = await (await fetch(base + '/api/iap/status')).json();
    ok(st.apple === true && st.google === true, '결제 준비 상태 apple·google 켜짐');
    const a = await guest('결제시험'), b = await guest('결제시험2');
    const X = imm[0], Y = imm[1];
    // 위조 사슬
    const forged = [
      ['잎 인증서에 영수증 OID 없음(개발자용 인증서 악용)', C.makeChain(root, { leafOid: false })],
      ['중간 인증서에 WWDR OID 없음', C.makeChain(root, { midOid: false })],
      ['중간 인증서가 CA 아님', C.makeChain(root, { midCa: false })],
      ['잎 인증서가 CA', C.makeChain(root, { leafCa: true })],
      ['잎 인증서 만료', C.makeChain(root, { leafExpired: true })],
      ['같은 이름의 다른 루트', C.makeChain(evilRoot)],
    ];
    for (const [m, ch] of forged) { const r = await api('/api/iap/verify', { signed: C.signJws(tx('unlock_imm_' + X), ch) }, a); ok(r.status === 400 && r.error === 'bad_receipt', '위조 거절: ' + m); }
    const t0 = tx('unlock_imm_' + X);
    let r = await api('/api/iap/verify', { signed: C.signJws(t0, good, good.x5c.slice(0, 2)) }, a); ok(r.status === 400, '위조 거절: x5c 2장(루트 빠짐)');
    r = await api('/api/iap/verify', { signed: C.signJws(t0, good, [good.x5c[0], good.x5c[1], C.makeChain(evilRoot).x5c[2]]) }, a); ok(r.status === 400, '위조 거절: 맨 위를 다른 루트로 바꿈');
    const parts = C.signJws(t0, good).split('.'); parts[1] = C.b64u(JSON.stringify(Object.assign({}, t0, { productId: 'unlock_imm_all' })));
    r = await api('/api/iap/verify', { signed: parts.join('.') }, a); ok(r.status === 400, '위조 거절: 서명 뒤 본문 바꿈');
    r = await api('/api/iap/verify', { signed: C.signJws(tx('unlock_imm_' + X, { bundleId: 'com.other.app' }), good) }, a); ok(r.status === 400, '거절: 다른 번들 ID');
    r = await api('/api/iap/verify', { signed: C.signJws(tx('unlock_imm_' + X, { environment: 'Xcode' }), good) }, a); ok(r.status === 400, '거절: 환경 Xcode');
    r = await api('/api/iap/verify', { signed: C.signJws(tx('unlock_gems_999'), good) }, a); ok(r.status === 400 && r.error === 'bad_item', '거절: 모르는 상품 ID');
    r = await api('/api/iap/verify', { signed: C.signJws(tx('unlock_imm_' + X, { revocationDate: Date.now() }), good) }, a); ok(r.status === 400, '거절: 이미 회수된 거래');
    ok(!(await me(a)).owned.includes(KEY(X)), '위조 시도 뒤에도 해금 없음');
    // 정상
    const tImm = tx('unlock_imm_' + X), tAds = tx('remove_ads', { environment: 'Production' });
    r = await api('/api/iap/verify', { signed: C.signJws(tImm, good) }, a); ok(r.status === 200 && r.me.owned.includes(KEY(X)), '정상: 샌드박스 결제 받아 줌(심사용) → 불멸 해금');
    r = await api('/api/iap/verify', { signed: C.signJws(tAds, good) }, a); ok(r.status === 200 && r.me.owned.includes('noads'), '정상: 운영 결제 → 광고 제거');
    r = await api('/api/iap/verify', { signed: C.signJws(tImm, good) }, b); ok(r.status === 409 && r.error === 'other_account', '같은 거래를 다른 계정이 쓰면 409');
    ok(/시험 환경 결제 env=Sandbox/.test(srv.log), '샌드박스 결제는 기록에 environment가 남음');
    await api('/api/ad/reward', {}, a);
    const coins = (await me(a)).coins;
    // 알림: 위조·다른 번들은 거절, 정상 REFUND는 회수
    r = await api('/api/iap/apple-notify', { signedPayload: notify('REFUND', tImm, C.makeChain(root, { leafOid: false })) });
    ok(r.status === 400 && (await me(a)).owned.includes(KEY(X)), '위조 알림(OID 없음) 거절, 해금 그대로');
    r = await api('/api/iap/apple-notify', { signedPayload: notify('REFUND', tImm, good, { data: { bundleId: 'com.other.app', environment: 'Sandbox' } }) });
    ok(r.status === 400, '다른 번들 알림 거절');
    r = await api('/api/iap/apple-notify', { signedPayload: notify('CONSUMPTION_REQUEST', tImm) });
    ok(r.status === 200 && (await me(a)).owned.includes(KEY(X)), '환불이 아닌 알림은 200만(해금 그대로)');
    r = await api('/api/iap/apple-notify', { signedPayload: notify('REFUND', tImm) });
    let m = await me(a);
    ok(r.status === 200 && !m.owned.includes(KEY(X)) && m.owned.includes('noads') && m.coins === coins, 'REFUND 알림 → 그 장수만 회수, 광고 제거·동전 그대로');
    r = await api('/api/iap/apple-notify', { signedPayload: notify('REFUND', tImm) }); ok(r.status === 200, '같은 알림 재전송도 200(한 번만 처리)');
    r = await api('/api/iap/verify', { signed: C.signJws(tImm, good) }, a);
    ok(r.status === 409 && r.error === 'refunded' && !(await me(a)).owned.includes(KEY(X)), '환불된 거래의 옛 영수증을 다시 보내도 열리지 않음');
    r = await api('/api/iap/apple-notify', { signedPayload: notify('REVOKE', tAds) }); m = await me(a);
    ok(r.status === 200 && !m.owned.includes('noads'), 'REVOKE 알림 → 광고 제거 회수');
    const tY = tx('unlock_imm_' + Y);
    await api('/api/iap/verify', { signed: C.signJws(tY, good) }, a);
    ok((await me(a)).owned.includes(KEY(Y)), '다른 거래는 영향 없음');
    // 구글: 시험 구매 기록, 환불 목록 주기 조회로 회수
    const M = myth.find((id) => !(m.owned || []).includes(KEY(id))), M2 = myth.find((id) => id !== M && !(m.owned || []).includes(KEY(id)));
    mock.gp.tokenAAAAAAAAAA = { purchaseState: 0, orderId: 'GPA.1111-2222-3333-44444', purchaseTimeMillis: String(Date.now()), purchaseType: 0 };
    mock.gp.tokenBBBBBBBBBB = { purchaseState: 0, orderId: 'GPA.5555-6666-7777-88888', purchaseTimeMillis: String(Date.now()) };
    r = await api('/api/iap/verify', { store: 'google', productId: 'unlock_myth_' + M, token: 'tokenAAAAAAAAAA' }, b);
    ok(r.status === 200 && r.me.owned.includes(KEY(M)) && /env=Test/.test(srv.log), '구글 시험 구매 받아 줌, 기록에 Test');
    r = await api('/api/iap/verify', { store: 'google', productId: 'unlock_myth_' + M2, token: 'tokenBBBBBBBBBB' }, b);
    ok(r.status === 200 && r.me.owned.includes(KEY(M2)), '구글 운영 구매');
    mock.voided = ['GPA.1111-2222-3333-44444', 'GPA.0000-unknown'];
    let gone = false; for (let i = 0; i < 30 && !gone; i++) { await sleep(200); gone = !(await me(b)).owned.includes(KEY(M)); }
    m = await me(b);
    ok(gone && m.owned.includes(KEY(M2)), '구글 Voided Purchases 주기 조회 → 환불된 구매만 회수');
    r = await api('/api/iap/verify', { store: 'google', productId: 'unlock_myth_' + M, token: 'tokenAAAAAAAAAA' }, b);
    ok(r.status === 409 && r.error === 'refunded', '구글 환불된 구매 토큰을 다시 보내도 열리지 않음');
    ok(!/\buncaught|unhandled/.test(srv.log), '서버 예외 없음');
  } finally { srv.kill(); await waitDown(); }
  return srv.log;
}

async function serverB() {
  const srv = startServer({ APPLE_IAP_KEY_PATH: API_KEY_FILE, APPLE_IAP_KEY_ID: 'TESTKEY123', APPLE_IAP_ISSUER_ID: '11111111-2222-3333-4444-555555555555', GOOGLE_PLAY_SA: '' });
  try {
    await waitUp();
    const a = await guest('재조회시험');
    const X = imm[2], Y = imm[3], Z = imm[4] || imm[0];
    // Apple이 같은 거래를 정상으로 답함
    const t1 = tx('unlock_imm_' + X); mock.apple[t1.transactionId] = { code: 200, body: { signedTransactionInfo: C.signJws(t1, good) } };
    let r = await api('/api/iap/verify', { signed: C.signJws(t1, good) }, a);
    ok(r.status === 200 && r.me.owned.includes(KEY(X)), '재조회: Apple 답이 정상이면 해금');
    const jwt = String(mock.apiAuth[mock.apiAuth.length - 1] || '').replace(/^Bearer /, '').split('.');
    const jh = JSON.parse(Buffer.from(jwt[0], 'base64url')), jb = JSON.parse(Buffer.from(jwt[1], 'base64url'));
    ok(jh.alg === 'ES256' && jh.kid === 'TESTKEY123' && jb.aud === 'appstoreconnect-v1' && jb.bid === BUNDLE && jb.iss === '11111111-2222-3333-4444-555555555555'
      && crypto.verify('sha256', Buffer.from(jwt[0] + '.' + jwt[1]), { key: apiKey.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(jwt[2], 'base64url')), '재조회: App Store Server API 토큰(ES256·kid·iss·aud·bid) 서명 맞음');
    // 기기 거래는 깨끗한데 Apple은 회수됐다고 답함
    const t2 = tx('unlock_imm_' + Y); mock.apple[t2.transactionId] = { code: 200, body: { signedTransactionInfo: C.signJws(Object.assign({}, t2, { revocationDate: Date.now() }), good) } };
    r = await api('/api/iap/verify', { signed: C.signJws(t2, good) }, a);
    ok(r.status === 400 && !(await me(a)).owned.includes(KEY(Y)), '재조회: Apple이 회수됐다고 하면 거절');
    // Apple이 모르는 거래(404)
    r = await api('/api/iap/verify', { signed: C.signJws(tx('unlock_imm_' + Y), good) }, a);
    ok(r.status === 400, '재조회: Apple이 모르는 거래(404) 거절');
    // Apple 답이 위조 사슬
    const t3 = tx('unlock_imm_' + Y); mock.apple[t3.transactionId] = { code: 200, body: { signedTransactionInfo: C.signJws(t3, C.makeChain(root, { leafOid: false })) } };
    r = await api('/api/iap/verify', { signed: C.signJws(t3, good) }, a);
    ok(r.status === 400, '재조회: 답의 서명 사슬도 같은 검사');
    // Apple 장애(500) → 이미 검증한 기기 거래로 진행
    const t4 = tx('unlock_imm_' + Z); mock.apple[t4.transactionId] = { code: 500, body: {} };
    r = await api('/api/iap/verify', { signed: C.signJws(t4, good) }, a);
    ok(r.status === 200 && r.me.owned.includes(KEY(Z)) && /조회 실패/.test(srv.log), '재조회: Apple 장애면 검증된 기기 거래로 진행(기록 남김)');
  } finally { srv.kill(); await waitDown(); }
}

(async () => {
  try {
    await storeTests();
    await pickPort();
    await new Promise((r) => fake.listen(0, '127.0.0.1', r)); GP = fake.address().port;
    const log = await serverA();
    if (fail) console.log('--- 서버 기록 ---\n' + log);
    await serverB();
  } catch (e) { ok(false, '예외 ' + (e && e.stack)); }
  fake.close();
  console.log(`\n${okN}개 통과, ${fail}개 실패`);
  process.exit(fail ? 1 : 0);
})();
