// Sign in with Apple 토큰 철회 시험(지침 5.1.1(v)): 가짜 Apple 서버(/auth/token, /auth/revoke)와 시험용 키로 server/app.js를 띄운다.
// 확인: 코드 → refresh token 교환(client_secret JWT의 서명·내용), 계정 삭제 때 철회, 철회 실패 시 토큰을 남김, 설정이 없으면 건너뜀(삭제는 됨),
//       Apple 로그인 계정이 아니면 철회하지 않음, /app-ads.txt 제공.
// 쓰는 법: node tests/server-apple-revoke.js   (DATABASE_URL은 비우고 JSON 저장소로 띄운다. 운영 DB·실제 Apple에 닿지 않는다)
'use strict';
const { spawn } = require('child_process');
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
let fail = 0, okN = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (c) okN++; else fail++; };
const AUD = 'com.test.rtd', TEAM = 'TEAM123456', KID = 'KEY1234567';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-apple-'));
const b64u = (x) => Buffer.from(x).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64 = (x) => Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// Apple ID 토큰 서명용 RSA 키(JWKS는 file:로 넘긴다)
const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = Object.assign(rsa.publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256', use: 'sig' });
fs.writeFileSync(path.join(TMP, 'jwks.json'), JSON.stringify({ keys: [jwk] }));
const idToken = (sub) => {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' })), now = Math.floor(Date.now() / 1000);
  const b = b64u(JSON.stringify({ iss: 'https://appleid.apple.com', aud: AUD, sub, iat: now, exp: now + 600 }));
  return h + '.' + b + '.' + b64u(crypto.sign('RSA-SHA256', Buffer.from(h + '.' + b), rsa.privateKey));
};
// Sign in with Apple 키(.p8과 같은 PKCS#8 EC P-256)
const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const P8 = path.join(TMP, 'AuthKey_test.p8');
fs.writeFileSync(P8, ec.privateKey.export({ format: 'pem', type: 'pkcs8' }));

// 가짜 Apple
const seen = []; let revokeStatus = 200;
const apple = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const f = Object.fromEntries(new URLSearchParams(body)); seen.push({ path: req.url, f });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/token') {
      if (f.code && f.code.startsWith('good')) { res.end(JSON.stringify({ access_token: 'at', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rt-' + f.code, id_token: 'x' })); return; }
      res.statusCode = 400; res.end(JSON.stringify({ error: 'invalid_grant' })); return;
    }
    if (req.url === '/auth/revoke') { res.statusCode = revokeStatus; res.end(revokeStatus === 200 ? '' : JSON.stringify({ error: 'server' })); return; }
    res.statusCode = 404; res.end('{}');
  });
});

function boot(extra) {
  const port = 19000 + ((Math.random() * 1000) | 0), data = fs.mkdtempSync(path.join(TMP, 'data-'));
  const env = Object.assign({}, process.env, { PORT: String(port), DATA_DIR: data, DATABASE_URL: '', APPLE_IAP_ROOT_CA: '', APPLE_AUDS: AUD, APPLE_JWKS_URL: 'file:' + path.join(TMP, 'jwks.json'),
    APPLE_SIGNIN_KEY_PATH: '', APPLE_SIGNIN_KEY_ID: '', APPLE_TEAM_ID: '', APPLE_SIGNIN_CLIENT_ID: '', APPLE_AUTH_URL: '' }, extra);
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'app.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; proc.stdout.on('data', (d) => (log += d)); proc.stderr.on('data', (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  const post = async (u, body, tok) => {
    const r = await fetch(base + u, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, tok ? { authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch (e) { /* 빈 응답 */ }
    return Object.assign({ status: r.status }, j);
  };
  const up = async () => { for (let i = 0; i < 50; i++) { try { await fetch(base + '/health'); return; } catch (e) { await new Promise((r) => setTimeout(r, 200)); } } throw new Error('서버가 뜨지 않음'); };
  // JSON 저장소는 3초마다 파일에 쓴다
  const db = async () => { await new Promise((r) => setTimeout(r, 3300)); try { return JSON.parse(fs.readFileSync(path.join(data, 'accounts.json'), 'utf8')); } catch (e) { return {}; } };
  return { proc, base, post, up, db, log: () => log };
}
const signUp = (s, sub) => s.post('/api/auth/apple', { idToken: idToken(sub), agree: true, termsVer: 1, nick: 'Tester' });

(async () => {
  await new Promise((r) => apple.listen(0, r));
  const APPLE_URL = `http://127.0.0.1:${apple.address().port}`;
  const on = boot({ APPLE_SIGNIN_KEY_PATH: P8, APPLE_SIGNIN_KEY_ID: KID, APPLE_TEAM_ID: TEAM, APPLE_AUTH_URL: APPLE_URL });
  const off = boot({});
  try {
    await on.up(); await off.up();

    // --- 설정된 서버 ---
    let r = await on.post('/api/auth/apple/code', { idToken: 'x.y.z', code: 'good1' });
    ok(r.status === 401 && seen.length === 0, '가짜 ID 토큰이면 401, Apple에 묻지 않는다');
    r = await on.post('/api/auth/apple/code', { idToken: idToken('sub.bad'), code: 'nope' });
    ok(r.status === 400 && r.error === 'bad_token', 'Apple이 거절한 코드는 400 bad_token');
    seen.length = 0;
    r = await on.post('/api/auth/apple/code', { idToken: idToken('sub.A'), code: 'goodA' });
    ok(r.status === 200 && r.ok === true, '코드 교환 성공(계정이 생기기 전이어도 된다)');
    const ex = seen.find((x) => x.path === '/auth/token');
    ok(ex && ex.f.grant_type === 'authorization_code' && ex.f.code === 'goodA' && ex.f.client_id === AUD, 'token 요청: grant_type·code·client_id(=APPLE_AUDS 첫 값)');
    const parts = String(ex && ex.f.client_secret).split('.');
    const head = JSON.parse(unb64(parts[0] || '') + ''), claim = JSON.parse(unb64(parts[1] || '') + '');
    const sigOk = parts.length === 3 && crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, unb64(parts[2]));
    ok(sigOk && head.alg === 'ES256' && head.kid === KID, 'client_secret: ES256, kid = 키 ID, .p8 키 서명이 맞다');
    ok(claim.iss === TEAM && claim.sub === AUD && claim.aud === 'https://appleid.apple.com' && claim.exp > claim.iat && claim.exp - claim.iat <= 15777000, 'client_secret 내용: iss=팀 ID, sub=client_id, aud=appleid.apple.com, 만료 6개월 이내');

    const a = await signUp(on, 'sub.A');
    ok(a.status === 200 && a.token, 'Apple 계정 만들기');
    let d = await on.db();
    ok(d.apple && d.apple['sub.A'] && d.apple['sub.A'].t === 'rt-goodA', 'refresh token을 저장했다');
    seen.length = 0;
    r = await on.post('/api/delete', { confirm: 'DELETE' }, a.token);
    const rv = seen.find((x) => x.path === '/auth/revoke');
    ok(r.status === 200 && rv && rv.f.token === 'rt-goodA' && rv.f.token_type_hint === 'refresh_token' && rv.f.client_id === AUD && rv.f.client_secret, '계정 삭제 → Apple /auth/revoke에 refresh token 철회');
    d = await on.db();
    ok(!(d.apple && d.apple['sub.A']), '철회한 토큰은 지운다');

    // 철회 실패: 삭제는 끝내고 토큰은 남긴다(나중에 다시 시도)
    await on.post('/api/auth/apple/code', { idToken: idToken('sub.B'), code: 'goodB' });
    const bAcc = await signUp(on, 'sub.B');
    revokeStatus = 500;
    r = await on.post('/api/delete', { confirm: 'DELETE' }, bAcc.token);
    revokeStatus = 200;
    d = await on.db();
    ok(r.status === 200 && d.apple && d.apple['sub.B'] && !Object.values(d.users || {}).some((u) => u.sub === 'sub.B'), 'Apple 철회 실패: 계정은 지워지고 토큰은 남는다(재시도용)');

    // 게스트 계정 삭제는 Apple에 묻지 않는다
    const g = await on.post('/api/guest/new', { agree: true, nick: 'Guest1' });
    seen.length = 0;
    r = await on.post('/api/delete', { confirm: 'DELETE' }, g.token);
    ok(r.status === 200 && !seen.some((x) => x.path === '/auth/revoke'), '게스트 계정 삭제는 Apple 철회를 부르지 않는다');

    // app-ads.txt
    const t = await fetch(on.base + '/app-ads.txt');
    const txt = await t.text();
    ok(t.status === 200 && /text\/plain/.test(t.headers.get('content-type') || '') && txt === fs.readFileSync(path.join(__dirname, '..', 'app-ads.txt'), 'utf8'), '/app-ads.txt를 저장소 맨 위 파일 그대로 text/plain으로 낸다');

    // --- 설정이 없는 서버 ---
    ok(/\[apple\].*꺼짐/.test(off.log()), '설정이 없으면 켤 때 "꺼짐" 로그');
    seen.length = 0;
    r = await off.post('/api/auth/apple/code', { idToken: idToken('sub.C'), code: 'goodC' });
    ok(r.status === 503 && r.error === 'not_configured' && seen.length === 0, '설정이 없으면 코드 교환은 503 not_configured(Apple에 묻지 않음)');
    const c = await signUp(off, 'sub.C');
    r = await off.post('/api/delete', { confirm: 'DELETE' }, c.token);
    ok(r.status === 200 && seen.length === 0 && /\[apple\] 계정 삭제: 저장된 Apple 토큰이 없어/.test(off.log()), '설정이 없어도 계정 삭제는 되고, 철회 못 함을 로그로 남긴다');
  } catch (e) { ok(false, '예외 ' + (e && e.stack)); }
  on.proc.kill(); off.proc.kill(); apple.close();
  await new Promise((r) => setTimeout(r, 300));
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 무시 */ }
  console.log(`RESULT server-apple-revoke ok=${okN} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})();
