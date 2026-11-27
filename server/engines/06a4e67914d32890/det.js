// 결정적 수학 함수: 게임 규칙 코드(engine·raid·synergy·ai)가 Math.sin 등 대신 쓴다.
// 까닭(2026-11-26 사용자 결정 — 판 결과 전수 재연산 검증): ECMAScript는 sin·cos·atan2·exp·log·hypot의 마지막 자리를 정하지 않는다.
// 서버(Node, V8)와 iOS(JavaScriptCore)·안드로이드(V8 WebView)가 한 비트만 달라도 수만 걸음 뒤에는 처치 순서·승패가 갈린다.
// 그래서 사칙연산(IEEE 754가 정확한 반올림을 보장)과 Math.sqrt·floor·round·abs만 써서 계산한다. 같은 입력이면 모든 엔진에서 같은 비트가 나온다.
// 식은 FreeBSD msun(fdlibm) 그대로 옮겼다(오차 1ulp 안팎). JS는 a*b+c를 하나로 합쳐 계산하지 않으므로(FMA 없음) 순서가 결과를 정한다.
//
// 쓰는 법:
//   const M = RTD_DET;           // 브라우저(전역) / Node: require('./det.js')
//   M.sin(a); M.cos(a); M.atan2(y, x); M.hypot(dx, dy); M.exp(x); M.log(x);
// 스레드: 순수 함수(공유 상태는 log·exp의 비트 변환용 DataView 하나 — JS 한 실행 흐름 안에서만 쓰여 안전. worker마다 따로 생긴다).
(function (root) {
  'use strict';
  const buf = new DataView(new ArrayBuffer(8)); // 비트 변환(빅 엔디언으로 고정 — 기기 바이트 순서와 무관)
  const hiWord = (x) => { buf.setFloat64(0, x); return buf.getUint32(0); };
  const loWord = (x) => { buf.setFloat64(0, x); return buf.getUint32(4); };
  const fromWords = (hi, lo) => { buf.setUint32(0, hi >>> 0); buf.setUint32(4, lo >>> 0); return buf.getFloat64(0); };
  // 2^k(정확). k는 -1022~1023
  const pow2 = (k) => fromWords((k + 1023) << 20, 0);

  // ---- sin·cos ----
  // 커널(|x| ≤ π/4, x + y = 원래 값의 나머지, y는 꼬리)
  const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
    S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
  function ksin(x, y, iy) {
    const z = x * x, w = z * z, r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6), v = z * x;
    if (iy === 0) return x + v * (S1 + z * r);
    return x - ((z * (0.5 * y - v * r) - y) - v * S1);
  }
  const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
    C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
  function kcos(x, y) {
    const z = x * x, w = z * z, r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6)), hz = 0.5 * z, ww = 1.0 - hz;
    return ww + (((1.0 - ww) - hz) + (z * r - x * y));
  }
  // π/2 나머지(Cody-Waite 3단). |x| < 2^20·π/2 정도까지 정확하다(게임의 각도는 수백 rad를 넘지 않는다). 그보다 크면 값이 덜 정확할 뿐 결정적이다.
  const INVPIO2 = 6.36619772367581382433e-01, PIO2_1 = 1.57079632673412561417e+00, PIO2_1T = 6.07710050650619224932e-11,
    PIO2_2 = 6.07710050630396597660e-11, PIO2_2T = 2.02226624879595063154e-21, PIO2_3 = 2.02226624871116645580e-21, PIO2_3T = 8.47842766036889956997e-32;
  const RED = { n: 0, y0: 0, y1: 0 };
  function remPio2(x) {
    const fn = Math.round(x * INVPIO2); // 정수(짝수 쪽 반올림 차이는 결과에 상관없다 — 나머지가 ±π/4 안에 들어가기만 하면 된다)
    let r = x - fn * PIO2_1, w = fn * PIO2_1T, y0 = r - w;
    // 많이 지워졌으면 둘째·셋째 상수로 더 정밀하게(fdlibm medium 경로와 같은 판단을 지수 차이로)
    const ex = (hiWord(x) >>> 20) & 0x7ff;
    if (ex - ((hiWord(y0) >>> 20) & 0x7ff) > 16) {
      let t = r; w = fn * PIO2_2; r = t - w; w = fn * PIO2_2T - ((t - r) - w); y0 = r - w;
      if (ex - ((hiWord(y0) >>> 20) & 0x7ff) > 49) { t = r; w = fn * PIO2_3; r = t - w; w = fn * PIO2_3T - ((t - r) - w); y0 = r - w; }
    }
    RED.n = fn; RED.y0 = y0; RED.y1 = (r - y0) - w;
  }
  const PIO4 = 7.85398163397448278999e-01;
  function sin(x) {
    if (!(x === x) || x === Infinity || x === -Infinity) return NaN;
    if (Math.abs(x) <= PIO4) return Math.abs(x) < 7.450580596923828e-9 ? x : ksin(x, 0, 0);
    remPio2(x);
    switch (RED.n & 3) { // n이 음수여도 2의 보수 & 3은 0~3
      case 0: return ksin(RED.y0, RED.y1, 1);
      case 1: return kcos(RED.y0, RED.y1);
      case 2: return -ksin(RED.y0, RED.y1, 1);
      default: return -kcos(RED.y0, RED.y1);
    }
  }
  function cos(x) {
    if (!(x === x) || x === Infinity || x === -Infinity) return NaN;
    if (Math.abs(x) <= PIO4) return Math.abs(x) < 7.450580596923828e-9 ? 1 : kcos(x, 0);
    remPio2(x);
    switch (RED.n & 3) {
      case 0: return kcos(RED.y0, RED.y1);
      case 1: return -ksin(RED.y0, RED.y1, 1);
      case 2: return -kcos(RED.y0, RED.y1);
      default: return ksin(RED.y0, RED.y1, 1);
    }
  }

  // ---- atan·atan2 ----
  const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
  const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
  const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01, 9.09088713343650656196e-02,
    -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02, 4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
  function atan(x) {
    if (!(x === x)) return x;
    const neg = x < 0 || (x === 0 && 1 / x < 0);
    let a = Math.abs(x), id;
    if (a >= 7.378697629483821e19) return neg ? -ATANHI[3] - ATANLO[3] : ATANHI[3] + ATANLO[3]; // 2^66 이상
    if (a < 0.4375) { if (a < 7.450580596923828e-9) return x; id = -1; }
    else if (a < 1.1875) { if (a < 0.6875) { id = 0; a = (2.0 * a - 1.0) / (2.0 + a); } else { id = 1; a = (a - 1.0) / (a + 1.0); } }
    else if (a < 2.4375) { id = 2; a = (a - 1.5) / (1.0 + 1.5 * a); }
    else { id = 3; a = -1.0 / a; }
    const z = a * a, w = z * z;
    const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
    const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    if (id < 0) return x - x * (s1 + s2);
    const r = ATANHI[id] - ((a * (s1 + s2) - ATANLO[id]) - a);
    return neg ? -r : r;
  }
  const PI = 3.1415926535897931160e+00, PI_O2 = 1.5707963267948965580e+00, PI_O4 = 7.8539816339744827900e-01, PI_LO = 1.2246467991473531772e-16;
  function atan2(y, x) {
    if (!(x === x) || !(y === y)) return NaN;
    if (x === 1) return atan(y);
    const m = (y < 0 || (y === 0 && 1 / y < 0) ? 1 : 0) | (x < 0 || (x === 0 && 1 / x < 0) ? 2 : 0);
    if (y === 0) return m === 2 ? PI : m === 3 ? -PI : y; // atan2(±0, +x) = ±0
    if (x === 0) return m & 1 ? -PI_O2 : PI_O2;
    if (x === Infinity || x === -Infinity) {
      if (y === Infinity || y === -Infinity) return [PI_O4, -PI_O4, 3 * PI_O4, -3 * PI_O4][m];
      return [0, -0, PI, -PI][m];
    }
    if (y === Infinity || y === -Infinity) return m & 1 ? -PI_O2 : PI_O2;
    // |y/x|: 지수 차이가 아주 크면 바로 끝(fdlibm과 같은 문턱 60)
    const k = (((hiWord(y) >>> 20) & 0x7ff) - ((hiWord(x) >>> 20) & 0x7ff));
    let z, mm = m;
    if (k > 60) { z = PI_O2 + 0.5 * PI_LO; mm = m & 1; } // |y/x| > 2^60: x 부호와 상관없이 ±π/2
    else if (x < 0 && k < -60) z = 0.0;
    else z = atan(Math.abs(y / x));
    switch (mm) {
      case 0: return z;
      case 1: return -z;
      case 2: return PI - (z - PI_LO);
      default: return (z - PI_LO) - PI;
    }
  }

  // ---- exp ----
  const LN2HI = 6.93147180369123816490e-01, LN2LO = 1.90821492927058770002e-10, INVLN2 = 1.44269504088896338700e+00;
  const P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05, P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;
  function exp(x) {
    if (!(x === x)) return x;
    if (x > 7.09782712893383973096e+02) return Infinity;
    if (x < -7.45133219101941108420e+02) return 0;
    const ax = Math.abs(x);
    let hi = 0, lo = 0, k = 0;
    if (ax > 0.5 * LN2HI) { // |x| > 0.5 ln2
      if (ax < 1.5 * LN2HI) { k = x < 0 ? -1 : 1; hi = x - k * LN2HI; lo = k * LN2LO; }
      else { k = x < 0 ? Math.ceil(INVLN2 * x - 0.5) : Math.floor(INVLN2 * x + 0.5); hi = x - k * LN2HI; lo = k * LN2LO; } // (int)(invln2*x ± 0.5): 0 쪽으로 자른 값
      x = hi - lo;
    } else if (ax < 3.725290298461914e-9) return 1 + x;
    const t = x * x, c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
    if (k === 0) return 1 - ((x * c) / (c - 2.0) - x);
    const y = 1 - ((lo - (x * c) / (2.0 - c)) - hi);
    if (k >= -1021) return k <= 1023 ? y * pow2(k) : y * 2.0 * pow2(k - 1);
    return y * pow2(k + 1000) * pow2(-1000);
  }

  // ---- log ----
  const LG1 = 6.666666666666735130e-01, LG2 = 3.999999999940941908e-01, LG3 = 2.857142874366239149e-01, LG4 = 2.222219843214978396e-01,
    LG5 = 1.818357216161805012e-01, LG6 = 1.531383769920937332e-01, LG7 = 1.479819860511658591e-01;
  function log(x) {
    if (!(x === x) || x < 0) return NaN;
    if (x === 0) return -Infinity;
    if (x === Infinity) return x;
    let k = 0, hx = hiWord(x);
    if (hx < 0x00100000) { x *= 18014398509481984; k -= 54; hx = hiWord(x); } // 비정규수: 2^54를 곱해 정규수로
    const lx = loWord(x);
    k += (hx >> 20) - 1023;
    hx &= 0x000fffff;
    const i = (hx + 0x95f64) & 0x100000;
    x = fromWords(hx | (i ^ 0x3ff00000), lx); // x 또는 x/2를 [√2/2, √2)로
    k += i >> 20;
    const f = x - 1.0;
    if ((0x000fffff & (2 + hx)) < 3) { // -2^-20 <= f < 2^-20
      if (f === 0) return k === 0 ? 0 : k * LN2HI + k * LN2LO;
      const R = f * f * (0.5 - 0.33333333333333333 * f);
      return k === 0 ? f - R : k * LN2HI - ((R - k * LN2LO) - f);
    }
    const s = f / (2.0 + f), dk = k, z = s * s, w = z * z;
    let ii = hx - 0x6147a;
    const j = 0x6b851 - hx;
    const t1 = w * (LG2 + w * (LG4 + w * LG6)), t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
    ii |= j;
    const R = t2 + t1;
    if (ii > 0) {
      const hfsq = 0.5 * f * f;
      return k === 0 ? f - (hfsq - s * (hfsq + R)) : dk * LN2HI - ((hfsq - (s * (hfsq + R) + dk * LN2LO)) - f);
    }
    return k === 0 ? f - s * (f - R) : dk * LN2HI - ((s * (f - R) - dk * LN2LO) - f);
  }

  // ---- hypot ----
  // 게임 좌표(수천 이하)에서는 넘침이 없으므로 √(a²+b²)로 충분하다. Math.sqrt는 IEEE가 정확한 반올림을 보장한다.
  const hypot = (a, b) => Math.sqrt(a * a + b * b);

  // 조이스틱 방향표: 64방향 단위 벡터(입력 기록이 방향 번호로 남는다. 같은 번호 → 모든 기기에서 같은 벡터)
  const JOY_DIRS = 64, JOY_LV = 8; // 세기 = 단계 / JOY_LV(0~4단계 → 0~0.5, 엔진은 0.5에서 최고 속도)
  const JOY = [];
  for (let d = 0; d < JOY_DIRS; d++) { const a = (d * 2 * PI) / JOY_DIRS; JOY.push([cos(a), sin(a)]); }

  const api = { sin, cos, atan, atan2, exp, log, hypot, PI, JOY, JOY_DIRS, JOY_LV, pow2 };
  root.RTD_DET = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
