// 앱 결제 검증·환불 회수(2026-11-24 보안 수정 SEC-101·SEC-105).
// - App Store: 기기가 보내는 것은 StoreKit 2 서명 거래(JWS, native.js의 jwsRepresentation). App Store Server Notifications V2의 signedPayload도 같은 모양이다.
//   검증 = x5c가 정확히 [잎, 중간, 루트] 3장이고, 루트는 서버에 둔 Apple Root CA G3와 같은 인증서이고, 서명이 이어지고, 날짜가 살아 있고,
//          중간 인증서가 CA이며 OID 1.2.840.113635.100.6.2.1(Apple WWDR 중간)을, 잎 인증서가 OID 1.2.840.113635.100.6.11.1(App Store 영수증 서명)을 가져야 한다.
//   OID를 보지 않으면 Apple 루트 아래의 아무 개발자용 인증서(예: Apple Pay 결제 처리 인증서)로 거래를 꾸밀 수 있다.
// - App Store Server API 키가 있으면 거래를 Apple에 다시 물어 그 답을 믿는다(키가 없으면 건너뛴다).
// - Google Play: 환불·취소된 구매는 Voided Purchases API로 주기적으로 읽는다(Pub/Sub는 쓰지 않는다).
// 환경 변수(운영: /etc/rtd-online.env):
//   APPLE_IAP_ROOT_CA      Apple Root CA - G3 인증서 파일 경로(DER .cer 또는 PEM). 없으면 App Store 결제는 꺼짐(503)
//   APPLE_BUNDLE           번들 ID(기본 com.hongsungjae.sangokurtd)
//   APPLE_IAP_ENVS         받아 줄 환경(기본 Production,Sandbox. 심사는 Sandbox 결제라 Sandbox를 빼면 심사에서 떨어진다)
//   APPLE_IAP_KEY_PATH     App Store Server API(In-App Purchase) 키 .p8 경로 ┐
//   APPLE_IAP_KEY_ID       그 키의 ID(10자)                                  ├ 셋 다 있을 때만 거래 재조회. 하나라도 없으면 건너뜀
//   APPLE_IAP_ISSUER_ID    App Store Connect의 Issuer ID(UUID)               ┘
//   APPLE_IAP_API          (시험용) 재조회 주소를 바꿀 때만
'use strict';
const fs = require('fs'), crypto = require('crypto');

const OID_LEAF = '1.2.840.113635.100.6.11.1', OID_MID = '1.2.840.113635.100.6.2.1';
const b64 = (x) => Buffer.from(String(x).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const b64u = (x) => Buffer.from(x).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

// ---------- 인증서 확장 OID 읽기(DER) ----------
// 인증서 본문(tbsCertificate)의 [3] 확장 목록에서 확장 이름(OID)만 꺼낸다. 이름·주체 문자열 속의 같은 바이트에 속지 않도록 구조를 따라 읽는다.
function tlv(buf, pos) {
  if (pos + 2 > buf.length) throw new Error('der');
  const tag = buf[pos]; let len = buf[pos + 1], hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f; if (n < 1 || n > 4 || pos + 2 + n > buf.length) throw new Error('der');
    len = 0; for (let i = 0; i < n; i++) len = len * 256 + buf[pos + 2 + i];
    hdr = 2 + n;
  }
  const start = pos + hdr, end = start + len;
  if (end > buf.length) throw new Error('der');
  return { tag, start, end };
}
function kids(buf, t) {
  const out = []; let p = t.start;
  while (p < t.end) { const c = tlv(buf, p); out.push(c); p = c.end; }
  if (p !== t.end) throw new Error('der');
  return out;
}
function oidText(b) {
  const out = [Math.floor(b[0] / 40), b[0] % 40]; let v = 0;
  for (let i = 1; i < b.length; i++) { v = v * 128 + (b[i] & 0x7f); if (!(b[i] & 0x80)) { out.push(v); v = 0; } }
  return out.join('.');
}
function extOids(der) {
  const cert = tlv(der, 0); if (cert.tag !== 0x30) throw new Error('der');
  const tbs = kids(der, cert)[0]; if (!tbs || tbs.tag !== 0x30) throw new Error('der');
  const ext = kids(der, tbs).find((f) => f.tag === 0xa3);
  if (!ext) return [];
  const list = kids(der, ext)[0]; if (!list || list.tag !== 0x30) throw new Error('der');
  return kids(der, list).map((e) => { const o = kids(der, e)[0]; if (!o || o.tag !== 0x06) throw new Error('der'); return oidText(der.subarray(o.start, o.end)); });
}

// ---------- App Store ----------
function makeAppleIap(env = process.env, log = console) {
  const C = {
    root: env.APPLE_IAP_ROOT_CA || '',
    bundle: env.APPLE_BUNDLE || 'com.hongsungjae.sangokurtd',
    envs: (env.APPLE_IAP_ENVS || 'Production,Sandbox').split(',').map((s) => s.trim()).filter(Boolean),
    keyPath: env.APPLE_IAP_KEY_PATH || '', keyId: env.APPLE_IAP_KEY_ID || '', issuer: env.APPLE_IAP_ISSUER_ID || '',
    api: (env.APPLE_IAP_API || '').replace(/\/+$/, ''),
  };
  let rootCache = null; // { mtime, cert }
  function rootCert() {
    const st = fs.statSync(C.root);
    if (!rootCache || rootCache.mtime !== st.mtimeMs) rootCache = { mtime: st.mtimeMs, cert: new crypto.X509Certificate(fs.readFileSync(C.root)) };
    return rootCache.cert;
  }
  const on = () => !!C.root && fs.existsSync(C.root);
  let apiKey = null;
  if (C.keyPath && C.keyId && C.issuer) {
    try { apiKey = crypto.createPrivateKey(fs.readFileSync(C.keyPath, 'utf8')); } catch (e) { log.warn('[iap] App Store Server API 키를 읽지 못해 거래 재조회를 건너뛴다: ' + e.message); }
    if (apiKey && apiKey.asymmetricKeyType !== 'ec') { apiKey = null; log.warn('[iap] App Store Server API 키가 EC(P-256) 키가 아니라 재조회를 건너뛴다'); }
  }
  const lookupOn = () => !!apiKey;

  // 서명 검증만(내용 검사는 따로). 맞으면 본문 객체, 아니면 throw.
  function verifyJws(jws, maxLen = 20000) {
    const bad = () => new Error('bad_receipt'), s = String(jws || ''), parts = s.split('.');
    if (parts.length !== 3 || s.length > maxLen) throw bad();
    let head, body; try { head = JSON.parse(b64(parts[0]).toString('utf8')); body = JSON.parse(b64(parts[1]).toString('utf8')); } catch (e) { throw bad(); }
    if (!head || head.alg !== 'ES256' || !Array.isArray(head.x5c) || head.x5c.length !== 3 || !body || typeof body !== 'object') throw bad();
    let certs; try { certs = head.x5c.map((c) => new crypto.X509Certificate(Buffer.from(String(c), 'base64'))); } catch (e) { throw bad(); }
    const [leaf, mid, top] = certs, root = rootCert(), now = Date.now();
    const live = (c) => Date.parse(c.validFrom) <= now && now <= Date.parse(c.validTo);
    if (top.fingerprint256 !== root.fingerprint256 || !live(root)) throw bad(); // 맨 위는 서버가 믿는 루트 그 자체여야 한다
    if (!live(mid) || !live(leaf) || !mid.verify(root.publicKey) || !leaf.verify(mid.publicKey)) throw bad();
    if (mid.issuer !== root.subject || leaf.issuer !== mid.subject) throw bad();
    if (mid.ca !== true || leaf.ca) throw bad();
    let midOids, leafOids; try { midOids = extOids(mid.raw); leafOids = extOids(leaf.raw); } catch (e) { throw bad(); }
    if (!midOids.includes(OID_MID) || !leafOids.includes(OID_LEAF)) throw bad();
    const pk = leaf.publicKey;
    if (pk.asymmetricKeyType !== 'ec' || (pk.asymmetricKeyDetails && pk.asymmetricKeyDetails.namedCurve !== 'prime256v1')) throw bad();
    if (!crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), { key: pk, dsaEncoding: 'ieee-p1363' }, b64(parts[2]))) throw bad();
    return body;
  }
  // 거래 본문 검사: 번들·상품·거래 번호·환경. 돌려주는 값 = 서버가 쓰는 거래 모양
  function txOf(t) {
    const bad = () => new Error('bad_receipt');
    if (!t || t.bundleId !== C.bundle || typeof t.productId !== 'string' || !/^[A-Za-z0-9_.]{1,100}$/.test(t.productId)) throw bad();
    if (t.transactionId == null || !/^[0-9A-Za-z_-]{1,64}$/.test(String(t.transactionId))) throw bad();
    if (!C.envs.includes(t.environment)) throw bad();
    return {
      productId: t.productId,
      transactionId: String(t.transactionId),
      txId: String(t.originalTransactionId || t.transactionId).slice(0, 64), // 같은 비소모성 상품의 복원·재구매는 한 줄
      at: +t.purchaseDate || Date.now(),
      env: t.environment,
      revoked: !!t.revocationDate,
    };
  }
  // App Store Server API: GET /inApps/v1/transactions/{id}. 4xx면 bad_receipt, 연결 실패·5xx면 lookup_fail
  function apiToken() {
    const iat = Math.floor(Date.now() / 1000);
    const un = b64u(JSON.stringify({ alg: 'ES256', kid: C.keyId, typ: 'JWT' })) + '.' + b64u(JSON.stringify({ iss: C.issuer, iat, exp: iat + 300, aud: 'appstoreconnect-v1', bid: C.bundle }));
    return un + '.' + b64u(crypto.sign('sha256', Buffer.from(un), { key: apiKey, dsaEncoding: 'ieee-p1363' }));
  }
  async function lookup(transactionId, environment) {
    const base = C.api || (environment === 'Sandbox' ? 'https://api.storekit-sandbox.itunes.apple.com' : 'https://api.storekit.itunes.apple.com');
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    let r, j;
    try {
      r = await fetch(base + '/inApps/v1/transactions/' + encodeURIComponent(transactionId), { headers: { Authorization: 'Bearer ' + apiToken() }, signal: ctl.signal });
      j = r.ok ? await r.json() : null;
    } catch (e) { throw new Error('lookup_fail'); } finally { clearTimeout(timer); }
    if (r.status >= 400 && r.status < 500) throw new Error('bad_receipt');
    if (!r.ok || !j || !j.signedTransactionInfo) throw new Error('lookup_fail');
    const t = txOf(verifyJws(j.signedTransactionInfo));
    if (t.transactionId !== String(transactionId)) throw new Error('bad_receipt');
    return t;
  }
  // 기기가 보낸 거래 하나를 검증한다(구매·복원). 키가 있으면 Apple에 다시 물어 그 답을 쓴다.
  async function verifyPurchase(jws) {
    let t = txOf(verifyJws(jws));
    if (lookupOn()) {
      try { t = await lookup(t.transactionId, t.env); }
      catch (e) {
        if (e.message !== 'lookup_fail') throw e;
        // Apple 쪽 장애: 이미 사슬·OID까지 확인한 기기 거래로 진행한다(결제는 됐는데 해금이 안 되는 일을 막는다)
        log.warn(`[iap] App Store Server API 조회 실패 — 기기 거래로 진행 tx=${t.transactionId}`);
      }
    }
    if (t.revoked) throw new Error('bad_receipt');
    return t;
  }
  // App Store Server Notifications V2: { signedPayload }. 돌려주는 값 { type, subtype, env, tx(거래 또는 null) }
  function verifyNotification(signedPayload) {
    const p = verifyJws(signedPayload, 64000), d = p.data;
    if (typeof p.notificationType !== 'string' || !d || d.bundleId !== C.bundle || !C.envs.includes(d.environment)) throw new Error('bad_receipt');
    const tx = d.signedTransactionInfo ? txOf(verifyJws(d.signedTransactionInfo)) : null;
    if (tx && tx.env !== d.environment) throw new Error('bad_receipt');
    return { type: p.notificationType, subtype: p.subtype || '', env: d.environment, tx, uuid: String(p.notificationUUID || '').slice(0, 64) };
  }
  return { on, lookupOn, verifyJws, verifyPurchase, verifyNotification, config: C };
}

// ---------- Google Play: 환불·취소된 구매 목록(Voided Purchases API) ----------
// since(ms) 이후 무효가 된 인앱 상품 구매의 orderId 목록. Google은 최근 30일까지만 돌려준다.
async function googleVoided({ api, pkg, token, since }) {
  const out = []; let page = '';
  for (let i = 0; i < 20; i++) {
    const u = api + '/androidpublisher/v3/applications/' + encodeURIComponent(pkg) + '/purchases/voidedpurchases?type=0&maxResults=1000&startTime=' + Math.floor(since) + (page ? '&token=' + encodeURIComponent(page) : '');
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + await token() } });
    if (!r.ok) throw new Error('gplay_voided_' + r.status);
    const j = await r.json();
    (j.voidedPurchases || []).forEach((v) => { if (v && v.orderId) out.push(String(v.orderId)); });
    page = j.tokenPagination && j.tokenPagination.nextPageToken;
    if (!page) break;
  }
  return out;
}

module.exports = { makeAppleIap, googleVoided, extOids, OID_LEAF, OID_MID };
