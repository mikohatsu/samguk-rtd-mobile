// Sign in with Apple 연결 끊기(App Store 심사 지침 5.1.1(v): 계정을 지우면 Apple 토큰도 철회해야 한다).
// 흐름: 앱이 로그인 때 받은 authorization code를 서버에 보낸다 → 서버가 Apple /auth/token에서 refresh token으로 바꿔 둔다
//       → 계정을 지울 때 /auth/revoke로 그 refresh token을 철회한다.
// Apple에 보내는 client_secret은 Sign in with Apple 키(.p8, ES256)로 서명한 JWT다. 키는 저장소에 넣지 않는다.
// 환경 변수(서버 /etc/rtd-online.env):
//   APPLE_SIGNIN_KEY_PATH  .p8 파일 경로(예: /etc/rtd-online/AuthKey_XXXXXXXXXX.p8, 권한 600, 소유자 rtd)
//   APPLE_SIGNIN_KEY_ID    키 ID(10자)
//   APPLE_TEAM_ID          팀 ID(10자)
//   APPLE_SIGNIN_CLIENT_ID client_id. 앱 로그인이면 번들 ID(없으면 APPLE_AUDS의 첫 값, 그것도 없으면 com.hongsungjae.sangokurtd)
//   APPLE_AUTH_URL         (시험용) Apple 주소를 바꿀 때만. 기본 https://appleid.apple.com
// 셋(키 경로·키 ID·팀 ID) 중 하나라도 없거나 키 파일을 못 읽으면 꺼진 상태: 교환·철회를 건너뛰고 로그만 남긴다.
'use strict';
const fs = require('fs'), crypto = require('crypto');

function config(env = process.env) {
  const keyPath = env.APPLE_SIGNIN_KEY_PATH || '', keyId = env.APPLE_SIGNIN_KEY_ID || '', teamId = env.APPLE_TEAM_ID || '';
  const clientId = env.APPLE_SIGNIN_CLIENT_ID || (env.APPLE_AUDS || '').split(',').filter(Boolean)[0] || 'com.hongsungjae.sangokurtd';
  const base = (env.APPLE_AUTH_URL || 'https://appleid.apple.com').replace(/\/+$/, '');
  return { keyPath, keyId, teamId, clientId, base };
}

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function makeRevoker(env = process.env, log = console) {
  const C = config(env);
  let key = null, why = '';
  if (!C.keyPath || !C.keyId || !C.teamId) why = 'APPLE_SIGNIN_KEY_PATH·APPLE_SIGNIN_KEY_ID·APPLE_TEAM_ID 중 비어 있는 값이 있다';
  else {
    try { key = crypto.createPrivateKey(fs.readFileSync(C.keyPath, 'utf8')); } catch (e) { why = '키 파일을 읽지 못했다: ' + e.message; }
    if (key && key.asymmetricKeyType !== 'ec') { key = null; why = '키가 EC(P-256) 키가 아니다'; }
  }
  if (!key) log.warn('[apple] Sign in with Apple 토큰 교환·철회 꺼짐 — ' + why);

  // client_secret: 유효 기간은 최대 6개월. 요청마다 5분짜리를 새로 만든다(만료 관리가 필요 없게).
  function clientSecret(now = Date.now()) {
    const iat = Math.floor(now / 1000);
    const head = b64u(JSON.stringify({ alg: 'ES256', kid: C.keyId, typ: 'JWT' }));
    const body = b64u(JSON.stringify({ iss: C.teamId, iat, exp: iat + 300, aud: 'https://appleid.apple.com', sub: C.clientId }));
    const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' });
    return head + '.' + body + '.' + b64u(sig);
  }
  async function post(path, fields) {
    const body = new URLSearchParams(Object.assign({ client_id: C.clientId, client_secret: clientSecret() }, fields)).toString();
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(C.base + path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: ctl.signal });
      let j = null; try { j = await r.json(); } catch (e) { /* 철회 응답은 본문이 비어 있다 */ }
      return { status: r.status, json: j };
    } finally { clearTimeout(t); }
  }
  return {
    on: () => !!key,
    clientSecret,
    // authorization code(5분 유효, 한 번만) → refresh token. 실패하면 null
    async exchange(code) {
      if (!key) return null;
      if (typeof code !== 'string' || !code || code.length > 2048) return null;
      try {
        const r = await post('/auth/token', { code, grant_type: 'authorization_code' });
        const rt = r.json && typeof r.json.refresh_token === 'string' ? r.json.refresh_token : null;
        if (!rt) log.warn('[apple] 코드 교환 실패', r.status, r.json && r.json.error);
        return rt;
      } catch (e) { log.warn('[apple] 코드 교환 오류', e.message); return null; }
    },
    // 'ok' = 철회됨, 'gone' = Apple이 이미 무효라고 함(다시 시도할 필요 없음), 'off' = 설정 없음, 'fail' = 나중에 다시
    async revoke(refreshToken) {
      if (!key) { log.warn('[apple] 설정이 없어 Apple 토큰 철회를 건너뜀'); return 'off'; }
      try {
        const r = await post('/auth/revoke', { token: refreshToken, token_type_hint: 'refresh_token' });
        if (r.status === 200) return 'ok';
        if (r.status === 400 && r.json && (r.json.error === 'invalid_grant' || r.json.error === 'invalid_request')) { log.warn('[apple] 이미 무효인 토큰', r.json.error); return 'gone'; }
        log.warn('[apple] 철회 실패', r.status, r.json && r.json.error); return 'fail';
      } catch (e) { log.warn('[apple] 철회 오류', e.message); return 'fail'; }
    },
  };
}

module.exports = { makeRevoker, config };
