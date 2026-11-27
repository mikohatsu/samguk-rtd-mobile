// 채팅 걸러내기: 욕설 가림, 광고 차단, 도배 방지. 방 채팅과 로비 채팅이 같이 쓴다.
'use strict';

// ---------- 욕설 ----------
// 어디에 들어 있어도 가리는 말. 글자 사이에 기호·숫자를 끼워 넣은 우회('시1발', 's.h.i.t')도 잡는다.
// 세 글자 이상이면 띄어 쓴 것('개 새 끼', 'f u c k')도 잡는다. 두 글자는 띄어쓰기를 허용하면 '다시 발사' 같은 멀쩡한 말이 걸려서 뺐다.
const BAD = ['씨발', '시발', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '좆', '개새끼', '느금', '니애미', '니미', '지랄', 'ㅈㄹ', '염병', '섹스', '창녀', '걸레년', '미친년', '미친놈',
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'porn', 'pussy', 'asshole', 'bastard', 'whore', 'slut',
  '死ね', 'ころす', '殺す', 'きちがい', 'ちんこ', 'まんこ', 'セックス', 'くたばれ', 'クソ野郎',
  '傻逼', '操你', '他妈的', '去死', '鸡巴', '做爱', '婊子', '草泥马', '妈的'];
// 다른 말 속에 흔히 들어가는 말은 혼자 쓰였을 때만 가린다('해보지 않았다', '혼자지만'을 가리지 않게).
const BAD_WORD = ['자지', '보지', '씹', 'dick', 'cock', 'sex', 'しね'];
// 욕이 들어 있지만 욕이 아닌 말
const OK = ['시발점', '시발역', '시바견', '시바이누'];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SEP = '[\\d_\\-.·,!?~*^\'"`]', SEPW = '[\\s\\d_\\-.·,!?~*^\'"`]';
const badRes = BAD.map((w) => { const ch = Array.from(w); return new RegExp(ch.map(escRe).join((ch.length >= 3 ? SEPW : SEP) + '{0,3}'), 'gi'); });
const LETTER = 'A-Za-z0-9\\uAC00-\\uD7A3\\u3040-\\u30FF\\u4E00-\\u9FFF';
const wordRes = BAD_WORD.map((w) => new RegExp('(^|[^' + LETTER + '])(' + escRe(w) + ')(?![' + LETTER + '])', 'gi'));
const okRe = new RegExp(OK.map(escRe).join('|'), 'g');
const stars = (m) => '*'.repeat(Array.from(m).length);
// 닉네임 검사용(기존 규칙 그대로): 띄어쓰기·기호·숫자를 빼고 어디든 들어 있으면 나쁜 닉네임
const squash = (s) => String(s || '').toLowerCase().replace(/[\s\d_\-.·,!?~*'"`^()[\]{}|/\\+=:;@#$%&]/g, '');
// 닉네임에만 막는 말: 채팅에서는 평범한 말일 수 있지만 랭킹·협동 화면에 이름으로 걸리면 곤란한 것(성적 은어, 혐오).
// 닉네임은 '고추장'처럼 걸리는 것이 생겨도 다른 이름을 고르면 되므로 넓게 막는다.
const NICK_ONLY = ['고추', '꼬추', '젖꼭지', '딸딸이', '자위', '야동', '성기', '음경', '똥꼬', '항문', '강간', '보빨', '자빨', '일베', '운지', '틀딱', '한남충', '김치녀', '쪽바리', '짱깨', '나치', '히틀러',
  'penis', 'vagina', 'boobs', 'hitler', 'nazi', // 'rape'·'cum'·'anal'은 grape·document·banal 같은 말에 걸려서 뺐다
  'ちんちん', 'おっぱい', 'レイプ', 'うんこ', 'ヒトラー', 'ナチス', 'シナ人',
  '强奸', '奶子', '阴茎', '希特勒'];
const nickBad = (n) => { const q = squash(n); return BAD.concat(BAD_WORD, NICK_ONLY).some((w) => q.includes(w.toLowerCase())); };

// 글을 다듬는다: 제어 문자·꺾쇠 제거, 80자, 같은 글자 늘이기 줄임, 욕설 가림
function mask(txt) {
  let o = String(txt || '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202f\ufeff<>]/g, '').replace(/\s+/g, ' ').trim();
  o = Array.from(o).slice(0, 80).join('');
  o = o.replace(/(.)\1{7,}/gu, (m, c) => c.repeat(8)); // ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ → 8개까지
  // 욕이 아닌 말은 잠깐 빼 두었다가 되돌린다
  const kept = []; o = o.replace(okRe, (m) => { kept.push(m); return '\u0001'; });
  badRes.forEach((re) => { o = o.replace(re, stars); });
  wordRes.forEach((re) => { o = o.replace(re, (m, pre, w) => pre + stars(w)); });
  return o.replace(/\u0001/g, () => kept.shift());
}

// ---------- 광고 ----------
// 주소, 메신저 아이디 유도, 전화번호, 현금 거래·대리 홍보. 걸리면 가리지 않고 통째로 막는다.
const AD = [
  /https?:\/\/|www\s*[.,]\s*\w/i,
  /[a-z0-9-]{2,}\s*(?:\.|\(dot\)|닷|점)\s*(?:com|net|org|kr|jp|cn|io|xyz|shop|site|club|link|info|biz|tv|cc|vip|online)(?![a-z])/i,
  /discord\s*\.?\s*gg|t\s*\.\s*me\/|open\s*\.?\s*kakao|bit\s*\.\s*ly/i,
  /(?:카\s*톡|카카오\s*톡|ㅋㅌ|오픈\s*채팅|오픈\s*톡|옾챗|텔레\s*그램|텔\s*레|디스코드|디코|위챗)\s*(?:아이디|id|아디|:|=|@|문의|추가|주소|링크)/i,
  /라인\s*(?:아이디|id|아디)|line\s*id/i,
  /(?:kakao|telegram|tele|wechat|weixin|discord|qq|skype|whatsapp)\s*(?:id)?\s*[:=@]/i,
  /(?:微信|薇信|威信|加\s*[qQ]|[qQ]{2}\s*群|扣扣|電報|电报)/,
  /(?:LINE|ライン|カカオ|テレグラム|ディスコ)\s*(?:ID|アイディー|交換)|(?:カカオ|テレグラム|ディスコ)\s*(?:追加|[:：=@])/i,
  /현\s*거\s*래|현금\s*거래|계정\s*(?:판매|팝니다|삽니다|거래)|(?:대리|부주)\s*(?:해\s*드|합니다|문의|기사|육성)|작업\s*장|(?:골드|원보|젬|다이아)\s*(?:판매|팝니다|삽니다|싸게)|최저가\s*(?:판매|문의)|무료\s*충전|환전\s*(?:문의|해)|(?:토토|카지노|바카라|슬롯)\s*(?:사이트|추천|가입|주소)/,
  /\bRMT\b|アカウント\s*(?:販売|売ります|買います)|代行\s*(?:します|承り|業者)|業者\s*価格|アカ\s*売/i,
  /(?:cheap|buy|sell(?:ing)?)\s+(?:gold|gems?|coins?|accounts?|ingots?)|boost(?:ing)?\s+service|free\s+(?:gems|ingots|coins)\s+(?:at|here|visit|click)/i,
  /代练|代充|卖号|出售账号|低价(?:元宝|充值|金币)|外挂|私服|加群/,
];
function isAd(txt) {
  const s = String(txt || '');
  if (AD.some((re) => re.test(s))) return true;
  // 전화번호: 기호·띄어쓰기를 빼고 숫자가 9개 넘게 이어지면 연락처로 본다
  const d = s.replace(/[\s\-.()_+]/g, '').replace(/[공영]/g, '0').replace(/[일]/g, '1').match(/\d{9,}/);
  return !!d;
}

// ---------- 도배 방지 ----------
// 계정별로 기억한다(다시 접속해도 풀리지 않게). 규칙을 어기면 벌점이 쌓이고, 3점이 되면 한동안 채팅이 막힌다.
const MIN_GAP = 1000;          // 한 번 보내고 1초 안에는 못 보낸다
const BURST = 5, BURST_MS = 10000; // 10초에 5번까지
const DUP_MS = 30000;          // 30초 안에 같은 말을 다시 못 보낸다
const MUTES = [30, 120, 600];  // 입막음 길이(초): 처음 30초, 다음 2분, 그 뒤 10분
const STRIKE_MS = 60000;       // 벌점은 1분 지나면 한 점씩 사라진다
const MUTE_KEEP = 3600000;     // 한 시간 동안 조용하면 입막음 단계가 처음으로 돌아간다
const gates = new Map();
const norm = (s) => String(s).toLowerCase().replace(/[\s\d_\-.·,!?~*^'"`]/g, '').replace(/(.)\1+/gu, '$1');
function gateOf(uid) {
  let g = gates.get(uid);
  if (!g) { g = { last: 0, times: [], lastTxt: '', lastTxtT: 0, strikes: 0, strikeT: 0, mutedUntil: 0, level: 0, levelT: 0 }; gates.set(uid, g); }
  return g;
}
function strike(g, now, n) {
  // 지난 시간만큼 벌점을 깎고 새로 더한다
  g.strikes = Math.max(0, g.strikes - Math.floor((now - g.strikeT) / STRIKE_MS)) + n; g.strikeT = now;
  if (g.strikes < 3) return 0;
  if (now - g.levelT > MUTE_KEEP) g.level = 0;
  const sec = MUTES[Math.min(g.level, MUTES.length - 1)];
  g.level++; g.levelT = now; g.strikes = 0; g.mutedUntil = now + sec * 1000;
  return sec;
}
// 채팅 한 줄을 검사한다. { ok, text } 또는 { ok:false, why, s } (why: mute·fast·dup·ad·empty, s: 남은 입막음 초)
function check(uid, raw, now = Date.now()) {
  const g = gateOf(uid);
  if (g.mutedUntil > now) return { ok: false, why: 'mute', s: Math.ceil((g.mutedUntil - now) / 1000) };
  const muted = (sec, why) => (sec ? { ok: false, why: 'mute', s: sec } : { ok: false, why });
  if (now - g.last < MIN_GAP) return muted(strike(g, now, 1), 'fast');
  g.times = g.times.filter((t) => now - t < BURST_MS);
  if (g.times.length >= BURST) return muted(strike(g, now, 1), 'fast');
  const text = mask(raw);
  if (!text) return { ok: false, why: 'empty' };
  if (isAd(String(raw || '')) || isAd(text)) { g.last = now; return muted(strike(g, now, 2), 'ad'); }
  const key = norm(text);
  if (key && key === g.lastTxt && now - g.lastTxtT < DUP_MS) { g.last = now; return muted(strike(g, now, 1), 'dup'); }
  g.last = now; g.times.push(now); g.lastTxt = key; g.lastTxtT = now;
  return { ok: true, text };
}
// ---- 이모티콘(협동 판 게임 중, 2026-11-28) ----
// 정해진 그림 8개(gfx/emo_<id>.png)만 보낸다. net.js EMOS와 같은 목록(tests/server-emo.js가 맞는지 본다).
const EMOS = ['laugh', 'cry', 'angry', 'wow', 'good', 'help', 'thanks', 'think'];
const EMO_GAP = 1000, EMO_BURST = 5, EMO_BURST_MS = 10000; // 1초에 1개, 10초에 5개까지
const emoGates = new Map(); // 계정 → 보낸 시각들(채팅 도배 기록과 따로 센다: 이모티콘을 많이 눌러도 채팅 벌점은 쌓이지 않는다)
// 이모티콘 하나를 검사한다. { ok, e } 또는 { ok:false, why, s } (why: bad = 목록에 없는 id, fast = 너무 잦음, mute = 채팅 도배로 막힌 동안)
function emo(uid, id, now = Date.now()) {
  if (typeof id !== 'string' || !EMOS.includes(id)) return { ok: false, why: 'bad' };
  const g = gates.get(uid);
  if (g && g.mutedUntil > now) return { ok: false, why: 'mute', s: Math.ceil((g.mutedUntil - now) / 1000) };
  const ts = (emoGates.get(uid) || []).filter((t) => now - t < EMO_BURST_MS);
  if ((ts.length && now - ts[ts.length - 1] < EMO_GAP) || ts.length >= EMO_BURST) { emoGates.set(uid, ts); return { ok: false, why: 'fast' }; }
  ts.push(now); emoGates.set(uid, ts);
  return { ok: true, e: id };
}

// 오래 조용한 계정의 기록은 지운다
const timer = setInterval(() => {
  const now = Date.now();
  gates.forEach((g, k) => { if (now - g.last > MUTE_KEEP && g.mutedUntil < now) gates.delete(k); });
  emoGates.forEach((ts, k) => { if (!ts.length || now - ts[ts.length - 1] > EMO_BURST_MS) emoGates.delete(k); });
}, 600000);
if (timer.unref) timer.unref();

module.exports = { mask, isAd, check, nickBad, BAD, EMOS, emo, _gates: gates, _emoGates: emoGates };
