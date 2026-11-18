// 구글 플레이 결제 검증 시험: 가짜 구글 서버(토큰 발급 + purchases.products.get)를 띄우고, 우리 서버가
// 구매 완료 토큰만 해금하고 취소·대기·모르는 토큰·같은 주문 재사용을 막는지 본다.
// 쓰는 법: node tests/server-gplay.js   (DATABASE_URL은 비우고 띄운다. 운영 DB를 건드리지 않는다)
'use strict';
const { spawn } = require('child_process');
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const PORT = 19000 + ((Math.random() * 500) | 0), GPORT = PORT + 600;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-gp-'));
const PKG = 'com.hongsungjae.sangokurtd';

// 가짜 서비스 계정 키
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = path.join(DATA, 'sa.json');
fs.writeFileSync(SA, JSON.stringify({ client_email: 'test@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: `http://127.0.0.1:${GPORT}/token` }));

// 가짜 구글: 토큰 → 구매 상태
const PURCHASES = {
  'tok-good-0001': { purchaseState: 0, orderId: 'GPA.1111-0001', purchaseTimeMillis: '1700000000000' },
  'tok-good-0002': { purchaseState: 0, orderId: 'GPA.1111-0002', purchaseTimeMillis: '1700000000000' },
  'tok-cancel-01': { purchaseState: 1, orderId: 'GPA.1111-0003' },
  'tok-pending-1': { purchaseState: 2, orderId: 'GPA.1111-0004' },
};
let tokenCalls = 0, badAuth = 0;
const g = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (req.url === '/token') {
      // 서비스 계정 JWT 서명을 실제로 확인한다
      const a = new URLSearchParams(body).get('assertion') || '', p = a.split('.');
      const okSig = p.length === 3 && crypto.verify('RSA-SHA256', Buffer.from(p[0] + '.' + p[1]), publicKey, Buffer.from(p[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
      tokenCalls++;
      if (!okSig) { badAuth++; res.writeHead(400); res.end('{}'); return; }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ access_token: 'AT', expires_in: 3600 })); return;
    }
    const m = req.url.match(/^\/androidpublisher\/v3\/applications\/([^/]+)\/purchases\/products\/([^/]+)\/tokens\/([^/]+)$/);
    if (!m || req.headers.authorization !== 'Bearer AT' || decodeURIComponent(m[1]) !== PKG) { res.writeHead(401); res.end('{}'); return; }
    const p = PURCHASES[decodeURIComponent(m[3])];
    if (!p) { res.writeHead(404); res.end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(p));
  });
});

const env = Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '', GOOGLE_PLAY_SA: SA, GOOGLE_PLAY_API: `http://127.0.0.1:${GPORT}` });
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const api = async (p, body, tok) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) });
  let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
  return Object.assign({ status: r.status }, j);
};
async function waitUp() { for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/api/me`); return; } catch (e) { await new Promise((r) => setTimeout(r, 200)); } } throw new Error('서버가 뜨지 않음'); }

g.listen(GPORT, '127.0.0.1', () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'app.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  (async () => {
    try {
      await waitUp();
      const a = (await api('/api/register', { id: 'gpa' + PORT, password: 'password123', nick: 'gp1', agree: true })).token;
      const b = (await api('/api/register', { id: 'gpb' + PORT, password: 'password123', nick: 'gp2', agree: true })).token;
      const gp = (pid, token) => ({ store: 'google', productId: pid, token });

      const st = await (await fetch(`http://127.0.0.1:${PORT}/api/iap/status`)).json();
      ok(st.google === true && st.apple === false, '결제 준비 상태: 구글만 켜짐(앱은 이걸 보고 버튼을 보인다)');
      let r = await api('/api/iap/verify', gp('remove_ads', 'tok-good-0001'), a);
      ok(r.status === 200 && r.me.owned.includes('noads'), '구매 완료 토큰: 광고 제거 열쇠를 받음');
      ok(tokenCalls === 1 && badAuth === 0, '서비스 계정 JWT 서명이 가짜 구글에서 검증됨');
      r = await api('/api/iap/verify', gp('remove_ads', 'tok-good-0001'), a);
      ok(r.status === 200, '같은 계정이 같은 구매를 다시 보내면(복원) 그대로 성공');
      r = await api('/api/iap/verify', gp('remove_ads', 'tok-good-0001'), b);
      ok(r.status === 409 && r.error === 'other_account', '같은 주문을 다른 계정이 쓰면 409(other_account)');
      r = await api('/api/iap/verify', gp('unlock_myth_gwakga', 'tok-good-0002'), a);
      ok(r.status === 200 && r.me.owned.includes('unl_gwakga'), '신화 해금 상품: 곽가 열쇠를 받음');
      r = await api('/api/iap/verify', gp('remove_ads', 'tok-cancel-01'), b);
      ok(r.status === 400 && r.error === 'bad_receipt', '취소(환불)된 구매는 거절');
      r = await api('/api/iap/verify', gp('remove_ads', 'tok-pending-1'), b);
      ok(r.status === 400 && r.error === 'bad_receipt', '결제 대기 중인 구매는 거절');
      r = await api('/api/iap/verify', gp('remove_ads', 'tok-unknown-1'), b);
      ok(r.status === 400 && r.error === 'bad_receipt', '구글이 모르는 토큰은 거절');
      r = await api('/api/iap/verify', gp('../x', 'tok-good-0001'), b);
      ok(r.status === 400 && r.error === 'bad_receipt', '이상한 상품 ID는 구글에 묻기 전에 거절');
      r = await api('/api/iap/verify', { signed: 'a.b.c' }, b);
      ok(r.status === 503 && r.error === 'not_configured', 'App Store 영수증은 애플 설정이 없으면 여전히 503');
      ok(tokenCalls === 1, `접근 토큰은 한 번 받아 재사용(${tokenCalls}번 발급)`);
    } catch (e) { ok(false, '예외 ' + e.message); }
    srv.kill(); g.close();
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 무시 */ }
    console.log(`RESULT server-gplay ok=${okN} fail=${fail}`);
    process.exit(fail ? 1 : 0);
  })();
});
