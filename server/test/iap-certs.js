// 시험용 인증서·서명 거래(JWS) 만들기: 가짜 루트 CA 아래에 Apple과 같은 모양의 [잎, 중간, 루트] 사슬을 만든다.
// OID·CA 여부·만료·다른 루트를 골라 위조 사슬도 만든다. 외부 도구(openssl) 없이 Node crypto와 손으로 짠 DER로 만든다.
'use strict';
const crypto = require('crypto');

const len = (n) => (n < 128 ? Buffer.from([n]) : n < 256 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 255]));
const T = (tag, ...parts) => { const c = Buffer.concat(parts); return Buffer.concat([Buffer.from([tag]), len(c.length), c]); };
const SEQ = (...p) => T(0x30, ...p), SET = (...p) => T(0x31, ...p);
function OID(s) {
  const a = s.split('.').map(Number), out = [a[0] * 40 + a[1]];
  for (const v of a.slice(2)) { const st = [v & 0x7f]; let x = Math.floor(v / 128); while (x > 0) { st.unshift((x & 0x7f) | 0x80); x = Math.floor(x / 128); } out.push(...st); }
  return T(0x06, Buffer.from(out));
}
const INT = (n) => T(0x02, Buffer.from([n & 0x7f]));
const name = (cn) => SEQ(SET(SEQ(OID('2.5.4.3'), T(0x0c, Buffer.from(cn)))));
const utc = (d) => T(0x17, Buffer.from(d.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z'));
const EXT = (oid, critical, value) => SEQ(OID(oid), critical ? T(0x01, Buffer.from([0xff])) : Buffer.alloc(0), T(0x04, value));
const ECDSA_SHA256 = '1.2.840.10045.4.3.2';
const LEAF_OID = '1.2.840.113635.100.6.11.1', MID_OID = '1.2.840.113635.100.6.2.1';
const newKey = () => crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

let serial = 1;
// 인증서 하나(DER). issuer = { cn, privateKey } (없으면 자기 서명)
function cert({ cn, key, issuer, ca = false, oids = [], expired = false }) {
  const now = Date.now(), nb = new Date(now - (expired ? 400 : 1) * 86400000), na = new Date(expired ? now - 86400000 : now + 3650 * 86400000);
  const exts = [EXT('2.5.29.19', true, ca ? SEQ(T(0x01, Buffer.from([0xff]))) : SEQ())].concat(oids.map((o) => EXT(o, false, T(0x05))));
  const iss = issuer || { cn, privateKey: key.privateKey };
  const tbs = SEQ(T(0xa0, INT(2)), INT(serial++), SEQ(OID(ECDSA_SHA256)), name(iss.cn), SEQ(utc(nb), utc(na)), name(cn),
    key.publicKey.export({ type: 'spki', format: 'der' }), T(0xa3, SEQ(...exts)));
  const sig = crypto.sign('sha256', tbs, iss.privateKey);
  return SEQ(tbs, SEQ(OID(ECDSA_SHA256)), T(0x03, Buffer.concat([Buffer.from([0]), sig])));
}
// 루트 CA
function makeRoot(cn = 'Test Apple Root CA - G3') {
  const key = newKey();
  return { cn, key, privateKey: key.privateKey, der: cert({ cn, key, ca: true }) };
}
// [잎, 중간, 루트] 사슬. opts: leafOid, midOid, midCa, leafExpired, leafCa
function makeChain(root, opts = {}) {
  const o = Object.assign({ leafOid: true, midOid: true, midCa: true, leafExpired: false, leafCa: false }, opts);
  const midKey = newKey(), leafKey = newKey();
  const mid = cert({ cn: 'Test WWDR G6', key: midKey, issuer: root, ca: o.midCa, oids: o.midOid ? [MID_OID] : [] });
  const leaf = cert({ cn: 'Test Prod ECC Mac App Store and iTunes Store Receipt Signing', key: leafKey, issuer: { cn: 'Test WWDR G6', privateKey: midKey.privateKey }, ca: o.leafCa, oids: o.leafOid ? [LEAF_OID] : [], expired: o.leafExpired });
  return { leafKey, x5c: [leaf, mid, root.der].map((d) => d.toString('base64')) };
}
const b64u = (x) => Buffer.from(x).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
// ES256 JWS(StoreKit 2 모양). x5c를 바꿔 넣을 수 있다.
function signJws(payload, chain, x5c) {
  const un = b64u(JSON.stringify({ alg: 'ES256', x5c: x5c || chain.x5c })) + '.' + b64u(JSON.stringify(payload));
  return un + '.' + b64u(crypto.sign('sha256', Buffer.from(un), { key: chain.leafKey.privateKey, dsaEncoding: 'ieee-p1363' }));
}
module.exports = { makeRoot, makeChain, signJws, newKey, b64u };
