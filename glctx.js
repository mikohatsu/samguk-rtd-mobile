// 메인 화면(#view) 전용 WebGL 그리기 층.
// 안드로이드 WebView는 Canvas 2D를 CPU로 그려 보스전이 12~14fps까지 떨어진다(같은 기기 WebGL은 117fps, production/team/2026-11-25/device-perf-tabs7.md).
// 화면 코드(src/ui, rig.js, art.js, skillfx.js)는 그대로 두고, #view의 ctx만 CanvasRenderingContext2D와 같은 모양의 이 객체로 바꾼다.
//
//  - 그림(drawImage): 원본(이미지·캔버스·ImageBitmap)을 텍스처로 한 번 올려 두고 사각형 두 삼각형으로 찍는다. 같은 텍스처·합성·자르기가 이어지면 한 번에 그린다.
//    오프스크린 캔버스는 2D 그리기 메서드를 감싸 버전을 세고(canvas.__glv), 버전이 바뀌면 다시 올린다.
//  - 단색 fillRect/clearRect: 바로 사각형.
//  - 그 밖의 도형·경로·글자: 진짜 2D 보조 캔버스(CPU)에 그 명령이 덮는 화면 영역만 그려 한 장짜리 아틀라스(2048²)에 올리고 사각형으로 찍는다.
//    같은 모양(화면 화소 기준 상대 좌표·색·글꼴…)이면 다시 그리지 않는다. 그리는 순서는 원래와 같다.
//  - clip: 축에 맞는 사각형은 시저, 그 밖은 자르기 모양을 아틀라스에 그려(가장자리 부드러움 포함) 그리는 화소마다 곱한다.
//  - 합성: source-over, lighter(더하기)는 정확. multiply·screen·destination-out·source-atop·destination-over·xor는 블렌드 함수(불투명 바탕 기준 정확).
//    copy·source-in·destination-in 등 그린 곳 밖까지 바꾸는 모드와 soft-light·overlay 같은 대상 읽기 모드는 메인 화면에서 쓰지 않아 근사(첫 사용 때 unsupported에 적는다).
//  - shadowBlur·filter: 터치 기기는 01-setup이 번짐을 0으로 막는다. 켜져 있으면 그 명령을 보조 캔버스에서 그대로 그려 올린다(느리지만 같은 모습).
//
// 켜기: RTD_GLCTX.want()(안드로이드 앱 기본, localStorage 'rtd-gl' '1' 강제 켬 / '0' 강제 끔) → RTD_GLCTX.create(view). 실패하면 null(그때는 2D).
// 예:
//   const ctx = (RTD_GLCTX.want() && RTD_GLCTX.create(view)) || view.getContext('2d');
//   ctx.drawImage(img, 10, 10); ctx.isGL // true
// 측정·비교용: RTD_GLCTX.patch(ctx2d)는 이미 2D 컨텍스트가 있는 캔버스 위에 WebGL 캔버스를 겹치고 그 2D 객체의 메서드만 바꿔 끼운다(되돌리기: g.unpatch()).
// 스레드: 메인 스레드 전용(DOM·WebGL).
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  const P2D = root.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;

  // ---- 오프스크린 캔버스 버전: 그 캔버스에 그리는 2D 메서드·크기 바꾸기가 불리면 canvas.__glv를 올린다 ----
  let tracking = false;
  function track() {
    if (tracking || !P2D) return;
    tracking = true;
    ['clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke', 'drawImage', 'putImageData', 'fillText', 'strokeText', 'reset'].forEach((n) => {
      const f = P2D[n];
      if (typeof f !== 'function') return;
      P2D[n] = function () { const cv = this.canvas; if (cv) cv.__glv = (cv.__glv || 0) + 1; return f.apply(this, arguments); };
    });
    const CP = root.HTMLCanvasElement && HTMLCanvasElement.prototype;
    if (CP) ['width', 'height'].forEach((p) => {
      const d = Object.getOwnPropertyDescriptor(CP, p);
      if (!d || !d.set) return;
      Object.defineProperty(CP, p, { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { this.__glv = (this.__glv || 0) + 1; d.set.call(this, v); } });
    });
  }

  function want() {
    let v = null;
    try { v = localStorage.getItem('rtd-gl'); } catch (e) { /* 저장소 없음 */ }
    if (v === '1') return true;
    if (v === '0') return false;
    const C = root.Capacitor;
    try { return !!(C && C.getPlatform && C.getPlatform() === 'android'); } catch (e) { return false; }
  }

  // GL 상수(WebGL1)
  const ZERO = 0, ONE = 1, SRC_COLOR_1M = 0x0301, SRC_A = 0x0302, SRC_A_1M = 0x0303, DST_A = 0x0304, DST_A_1M = 0x0305, DST_C = 0x0306;
  // 합성 모드 → [srcRGB, dstRGB, srcA, dstA](미리 곱한 알파). approx: 그린 곳 밖은 2D와 다르다(메인에서 안 씀)
  const BLENDS = [
    ['source-over', ONE, SRC_A_1M, ONE, SRC_A_1M],
    ['lighter', ONE, ONE, ONE, ONE],
    ['multiply', DST_C, SRC_A_1M, ONE, SRC_A_1M],
    ['screen', ONE, SRC_COLOR_1M, ONE, SRC_A_1M],
    ['destination-out', ZERO, SRC_A_1M, ZERO, SRC_A_1M],
    ['source-atop', DST_A, SRC_A_1M, DST_A, SRC_A_1M],
    ['destination-over', DST_A_1M, ONE, DST_A_1M, ONE],
    ['xor', DST_A_1M, SRC_A_1M, DST_A_1M, SRC_A_1M],
    ['copy', ONE, ZERO, ONE, ZERO, 1],
    ['source-in', DST_A, ZERO, DST_A, ZERO, 1],
    ['destination-in', ZERO, SRC_A, ZERO, SRC_A, 1],
    ['source-out', DST_A_1M, ZERO, DST_A_1M, ZERO, 1],
    ['destination-atop', DST_A_1M, SRC_A, DST_A_1M, SRC_A, 1],
  ];
  const BL_IDX = {}; BLENDS.forEach((b, i) => (BL_IDX[b[0]] = i));
  // 2D가 받는 나머지 이름(대상 읽기 블렌드): source-over로 근사
  const BL_OTHER = new Set(['multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']);
  const unsupported = new Set();

  const VS = `attribute vec2 aP; attribute vec2 aT; attribute vec4 aC; attribute vec2 aMU; attribute vec4 aMR;
uniform vec2 uR;
varying highp vec2 vT; varying lowp vec4 vC; varying highp vec2 vM; varying highp vec4 vMR;
void main() { vT = aT; vC = aC; vM = aMU; vMR = aMR; gl_Position = vec4(aP.x / uR.x * 2.0 - 1.0, 1.0 - aP.y / uR.y * 2.0, 0.0, 1.0); }`;
  const FS = `precision highp float;
uniform sampler2D uT; uniform sampler2D uM;
varying highp vec2 vT; varying lowp vec4 vC; varying highp vec2 vM; varying highp vec4 vMR;
void main() { gl_FragColor = texture2D(uT, vT) * vC * texture2D(uM, clamp(vM, vMR.xy, vMR.zw)).a; }`;

  // ---- 색 문자열 해석(2D가 정규화한 값으로) ----
  let probe = null;
  function probeCtx() { if (!probe) { const c = document.createElement('canvas'); c.width = c.height = 1; probe = c.getContext('2d'); } return probe; }
  const colCache = new Map();
  function parseCol(s) {
    let c = colCache.get(s);
    if (c !== undefined) return c;
    const p = probeCtx();
    p.fillStyle = '#010203'; p.fillStyle = s; let n = p.fillStyle;
    if (n === '#010203') { p.fillStyle = '#030201'; p.fillStyle = s; if (p.fillStyle === '#030201') n = null; }
    if (n === null) c = null;
    else if (n[0] === '#') c = [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16), 1];
    else { const m = n.match(/[\d.]+/g); c = m ? [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]] : null; }
    if (colCache.size > 4096) colCache.clear();
    colCache.set(s, c);
    return c;
  }
  const fontOk = new Map();
  function validFont(v) {
    let ok = fontOk.get(v);
    if (ok !== undefined) return ok;
    const p = probeCtx();
    p.font = '10px __glx'; p.font = v; ok = p.font !== '10px __glx';
    if (!ok) { p.font = '11px __gly'; p.font = v; ok = p.font !== '11px __gly'; }
    if (fontOk.size > 512) fontOk.clear();
    fontOk.set(v, ok);
    return ok;
  }
  const objIds = new WeakMap(); let objN = 0;
  function objKey(o) { let k = objIds.get(o); if (!k) { k = 'o' + ++objN; objIds.set(o, k); } return k; }
  function styleKey(s) { return typeof s === 'string' ? s : s && s.__k ? s.__k : objKey(s); }
  // 그라디언트: 같은 내용이면 같은 키(매 프레임 새로 만들어도 캐시가 맞는다)
  function keyed(g, k) {
    if (!g) return g;
    g.__k = k;
    const add = g.addColorStop;
    g.addColorStop = function (o, c) { add.call(g, o, c); g.__k += '|' + o + ':' + c; };
    return g;
  }

  const ALIGN = new Set(['start', 'end', 'left', 'right', 'center']);
  const BASE = new Set(['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom']);
  const CAPS = new Set(['butt', 'round', 'square']), JOINS = new Set(['round', 'bevel', 'miter']);
  const EMPTY = Object.freeze([]);
  const r4 = (v) => Math.round(v * 4), r3 = (v) => Math.round(v * 1000), r2 = (v) => Math.round(v * 100);

  function newState() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, ga: 1, op: 'source-over', bl: 0, fill: '#000000', stroke: '#000000', lw: 1, cap: 'butt', join: 'miter', miter: 10, dash: EMPTY, dashOff: 0,
      font: '10px sans-serif', align: 'start', base: 'alphabetic', dir: 'inherit', ls: '0px', shBlur: 0, shCol: 'rgba(0, 0, 0, 0)', shA: 0, shX: 0, shY: 0, filter: 'none', smooth: true, smq: 'low', sc: null, clip: null, sd: 0 };
  }
  function copyState(t, s) {
    t.a = s.a; t.b = s.b; t.c = s.c; t.d = s.d; t.e = s.e; t.f = s.f; t.ga = s.ga; t.op = s.op; t.bl = s.bl; t.fill = s.fill; t.stroke = s.stroke; t.lw = s.lw; t.cap = s.cap; t.join = s.join;
    t.miter = s.miter; t.dash = s.dash; t.dashOff = s.dashOff; t.font = s.font; t.align = s.align; t.base = s.base; t.dir = s.dir; t.ls = s.ls; t.shBlur = s.shBlur; t.shCol = s.shCol; t.shA = s.shA;
    t.shX = s.shX; t.shY = s.shY; t.filter = s.filter; t.smooth = s.smooth; t.smq = s.smq; t.sc = s.sc; t.clip = s.clip; t.sd = s.sd;
  }

  // view: 그릴 캔버스(WebGL 컨텍스트를 얻는다). opt.sizeFrom: 크기를 따라갈 캔버스(겹쳐 그릴 때), opt.canvasProp: ctx.canvas로 보일 캔버스
  function create(view, opt) {
    opt = opt || {};
    if (!P2D || typeof root.WebGLRenderingContext === 'undefined') return null;
    let gl = null;
    try { gl = view.getContext('webgl', { alpha: true, antialias: true, depth: false, stencil: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return null;
    const sizeFrom = opt.sizeFrom || view;
    // ---- 셰이더·버퍼 ----
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    let prog;
    try {
      const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      const fs = hp && hp.precision > 0 ? FS : FS.replace(/highp/g, 'mediump');
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
      ['aP', 'aT', 'aC', 'aMU', 'aMR'].forEach((n, i) => gl.bindAttribLocation(prog, i, n));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.warn('[glctx] shader', e); return null; }
    gl.useProgram(prog);
    const uR = gl.getUniformLocation(prog, 'uR');
    gl.uniform1i(gl.getUniformLocation(prog, 'uT'), 0); gl.uniform1i(gl.getUniformLocation(prog, 'uM'), 1);
    const MAXQ = 8192, STRIDE = 36, FPV = 9, FPQ = FPV * 4; // 정점: x y u v(f32) 색(u8×4) 자르기 모양 uv(f32×2) 자르기 모양 범위(u16×4)
    const vbuf = new ArrayBuffer(MAXQ * 4 * STRIDE), vf = new Float32Array(vbuf), vu = new Uint32Array(vbuf);
    const idx = new Uint16Array(MAXQ * 6);
    for (let i = 0; i < MAXQ; i++) { const v = i * 4, o = i * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
    const vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, vbuf.byteLength, gl.STREAM_DRAW);
    for (let i = 0; i < 5; i++) gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 8);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, STRIDE, 16);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, STRIDE, 20);
    gl.vertexAttribPointer(4, 4, gl.UNSIGNED_SHORT, true, STRIDE, 28);
    gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;

    // ---- 그리기 상태 ----
    let st = newState();
    const stack = [], pool = [];
    let W = view.width, H = view.height, inFrame = false, frame = 0, gen = 1, lost = false, fb = null;
    const stats = { frames: 0, quads: 0, draws: 0, flushes: 0, up: 0, upPx: 0, rHit: 0, rFam: 0, rMiss: 0, rPx: 0, resets: 0, masks: 0 };
    const S1 = { quads: 0, draws: 0, flushes: 0, up: 0, upPx: 0, rHit: 0, rFam: 0, rMiss: 0, rPx: 0, resets: 0, masks: 0 };

    // ---- 텍스처 ----
    const texMap = new WeakMap(), texAll = new Set();
    let texBytes = 0;
    const TEX_BUDGET = 192e6;
    const WR = root.WeakRef ? (o) => new root.WeakRef(o) : (o) => ({ deref: () => o });
    function newTex(nearest) {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); bound0 = null;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = nearest ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      return t;
    }
    let bound0 = null; // 0번 유닛에 묶인 텍스처 기록
    function texFor(src, w, h) {
      let r = texMap.get(src);
      const img = src instanceof HTMLImageElement, ver = img ? src.currentSrc || src.src : src.__glv | 0;
      if (r && r.ver === ver && r.w === w && r.h === h) { r.used = frame; return r; }
      if (w > maxTex || h > maxTex) { unsupported.add('texture>' + maxTex); return null; }
      if (!r) { r = { tex: newTex(false), ref: WR(src), w: 0, h: 0, ver: null, used: 0, gen: 0, nr: false, bytes: 0, cv: !img }; texMap.set(src, r); texAll.add(r); }
      if (r.gen === gen) flush(); // 이번에 쌓인 사각형이 옛 내용을 쓰고 있다
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.tex); bound0 = r;
      try {
        if (r.w === w && r.h === h) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      } catch (e) { unsupported.add('upload:' + (e && e.name)); return null; }
      texBytes += w * h * 4 - r.bytes; r.bytes = w * h * 4; r.w = w; r.h = h; r.ver = ver; r.used = frame;
      S1.up++; S1.upPx += w * h;
      return r;
    }
    function dropTex(r) { gl.deleteTexture(r.tex); texAll.delete(r); texBytes -= r.bytes; const s = r.ref.deref(); if (s) texMap.delete(s); if (bound0 === r) bound0 = null; }
    function housekeep() {
      for (const r of texAll) { const s = r.ref.deref(); if (!s || (r.cv && (!s.width || !s.height)) || frame - r.used > 1800) dropTex(r); }
      if (texBytes > TEX_BUDGET) {
        const l = [...texAll].filter((r) => r.used < frame - 1).sort((x, y) => x.used - y.used);
        for (const r of l) { if (texBytes < TEX_BUDGET * 0.75) break; dropTex(r); }
      }
    }

    // ---- 아틀라스(도형·글자·자르기 모양). (0,0)~(4,4)는 흰 칸(단색·자르기 없음에 쓴다) ----
    // 선형 보간: 같은 칸을 1:1(정수 화소)로 찍으면 원본 그대로, 배율이 조금 다른 캐시를 늘여 쓸 때는 부드럽게.
    const AW = 2048;
    const atlas = { tex: newTex(false), w: AW, h: AW, gen: 0, nr: false, used: 0 };
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, AW, AW, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const white = new Uint8Array(16 * 4).fill(255);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, white);
    const WU = 2 / AW; // 흰 칸 가운데
    let rows = [], nextY = 4, repoch = 1;
    // exact: 정확히 같은 것(화면 배율·1/4 화소 위치까지), fam: 배율·위치를 뺀 모양 키 → 가장 최근 것(늘여 쓴다)
    const exact = new Map(), fam = new Map();
    function alloc(w, h) {
      const hh = (h + 3) & ~3;
      let best = null;
      for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (r.h >= hh && r.h <= hh * 1.5 + 4 && r.x + w <= AW && (!best || r.h < best.h)) best = r; }
      if (!best) { if (nextY + hh > AW) return null; best = { y: nextY, h: hh, x: 0 }; rows.push(best); nextY += hh; }
      const x = best.x; best.x += w;
      return [x, best.y];
    }
    function resetAtlas() { flush(); rows = []; nextY = 4; exact.clear(); fam.clear(); repoch++; S1.resets++; }
    // 따로 올리는 큰 것(아틀라스에 안 들어가는 것): 키가 있으면 최근 6개, 없으면 돌려 쓰는 3장
    const solo = new Map(); const soloPool = [];
    // 보조 2D 캔버스(CPU): 도형·글자를 그 영역만 그린다
    const scv = document.createElement('canvas'); scv.width = 256; scv.height = 256;
    const sx = scv.getContext('2d', { willReadFrequently: true });
    function scratch(w, h) {
      if (scv.width < w || scv.height < h) { scv.width = Math.max(scv.width, Math.min(4096, 1 << Math.ceil(Math.log2(w)))); scv.height = Math.max(scv.height, Math.min(4096, 1 << Math.ceil(Math.log2(h)))); }
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalAlpha = 1; sx.globalCompositeOperation = 'source-over'; sx.filter = 'none'; sx.shadowBlur = 0; sx.shadowColor = 'rgba(0,0,0,0)'; sx.shadowOffsetX = sx.shadowOffsetY = 0;
      sx.clearRect(0, 0, w, h);
      return sx;
    }
    // 새로 그려 올린다. key가 있으면 exact에 둔다. paint(x)는 영역 왼쪽 위가 (0,0). 돌려주는 것: { tr, x, y, w, h, ep }(부른 쪽이 keep으로 s0·rx·ry를 적는다)
    function raster(key, w, h, paint) {
      if (w > 4096 || h > 4096) { unsupported.add('raster>4096'); return null; }
      S1.rMiss++; S1.rPx += w * h;
      if (dbg) dbg.push([key === null ? null : key.slice(0, 80), w, h]);
      const x = scratch(w, h);
      x.save(); paint(x); x.restore();
      const data = x.getImageData(0, 0, w, h);
      let e;
      if (w > 1024 || h > 640 || w * h > 300000) {
        let r = null;
        if (key !== null && solo.size >= 6) { const k0 = solo.keys().next().value; r = solo.get(k0).tr; solo.delete(k0); }
        else if (key === null) { r = soloPool.find((t) => t.gen !== gen) || null; if (!r && soloPool.length < 3) { r = { tex: newTex(false), w: 0, h: 0, gen: 0, nr: false, used: 0 }; soloPool.push(r); } if (!r) { flush(); r = soloPool[0]; } }
        if (!r) r = { tex: newTex(false), w: 0, h: 0, gen: 0, nr: false, used: 0 };
        if (r.gen === gen) flush();
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.tex); bound0 = null;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
        r.w = w; r.h = h;
        e = { tr: r, x: 0, y: 0, w, h, ep: 0 }; r.owner = e;
        if (key !== null) solo.set(key, e);
      } else {
        let p = alloc(w + 1, h + 1);
        if (!p) { resetAtlas(); p = alloc(w + 1, h + 1); }
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlas.tex); bound0 = null;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, p[0], p[1], gl.RGBA, gl.UNSIGNED_BYTE, data);
        e = { tr: atlas, x: p[0], y: p[1], w, h, ep: repoch };
        if (key !== null) exact.set(key, e);
      }
      S1.up++; S1.upPx += w * h;
      return e;
    }
    const valid = (e) => !!e && (e.tr === atlas ? e.ep === repoch : e.tr.owner === e);
    function look(k) { const e = exact.get(k) || solo.get(k); if (!valid(e)) return null; if (e.tr !== atlas) { solo.delete(k); solo.set(k, e); } return e; }
    // 이번 프레임에 '선명하게 다시 그리기'에 쓸 수 있는 화소 수(늘여 쓸 캐시가 있을 때만 따진다)
    let rBudget = 0;
    // 캐시 고르기: 정확히 같은 것(선명) → 모양이 같고 배율이 ±4.5% 안인 것(배율이 움직이는 중이거나 이번 프레임 여유가 없으면 늘여 쓴다) → 없으면 null(새로 그린다)
    function pick(ek, fk, s, need) {
      const e = look(ek);
      if (e) { S1.rHit++; return e; }
      if (fk === null) return null;
      const f = fam.get(fk);
      if (!valid(f)) return null;
      const r = s / f.s0;
      if (r < 0.955 || r > 1.045) return null;
      if (Math.abs(r - 1) > 1e-4 || rBudget < need) { S1.rFam++; return f; }
      return null;
    }
    // 새로 그린 것을 적어 둔다(s0: 그린 배율, (rx, ry): 기준점이 영역 안에서 놓인 곳)
    function keep(e, fk, s, rx, ry) { e.s0 = s; e.rx = rx; e.ry = ry; if (fk !== null) fam.set(fk, e); rBudget -= e.w * e.h; return e; }

    // ---- 자르기(clip) ----
    // 축에 맞는 사각형: st.sc = [x0, y0, x1, y1](정수 화소, 시저). 그 밖: st.clip = { up, cmds, rule, s, bb(화면 범위, 위 자르기와 겹친 곳), e(모양) }
    // 모양은 화면 범위 전체를 그린다(화면 밖으로 잘라 내지 않는다: 카메라가 움직여도 같은 모양을 다시 쓴다). 넓으면 낮은 해상도로(가장자리는 선형 보간).
    // 지금 그리는 사각형의 자르기 모양: 텍스처 MT, 화면 (MX0, MY0)가 텍스처 uv (MU0, MV0), 화소당 uv (MSX, MSY), 범위 MR0~3(u16 정규화)
    let MT = null, MX0 = 0, MY0 = 0, MU0 = 0, MV0 = 0, MSX = 0, MSY = 0, MR0 = 0, MR1 = 0, MR2 = 0, MR3 = 0;
    function setNoMask() { MT = atlas; MX0 = MY0 = 0; MU0 = MV0 = WU; MSX = MSY = 0; MR0 = MR2 = (WU * 65535) | 0; MR1 = MR3 = MR0; }
    setNoMask();
    function maskReady() {
      const m = st.clip;
      if (!m) { setNoMask(); return true; }
      if (m.empty) return false;
      let e = m.e;
      const x0 = m.bb[0], y0 = m.bb[1];
      if (!valid(e)) {
        const bw = m.bb[2] - x0, bh = m.bb[3] - y0, area = bw * bh, inv = 1 / m.s;
        const q = area <= 65536 ? 1 : Math.min(0.5, 600 / bw, 600 / bh, Math.sqrt(250000 / area));
        const chain = [];
        for (let n = m; n; n = n.up) chain.unshift(n);
        let key = 'K' + r3(q) + '|' + r2(bw * inv) + ',' + r2(bh * inv);
        for (const n of chain) { const pk = n.p2d ? null : pathKey(n.cmds, x0, y0, inv); if (pk === null) { key = null; break; } key += '>' + n.rule + pk; }
        const s0 = m.s * q;
        e = key === null ? null : fam.get(key);
        if (e && (!valid(e) || Math.abs(s0 / e.s0 - 1) > 0.08)) e = null;
        if (!e) {
          const w = Math.ceil(bw * q) + 2, h = Math.ceil(bh * q) + 2;
          e = raster(null, w, h, (x) => {
            for (const n of chain) {
              x.setTransform(1, 0, 0, 1, 0, 0); x.beginPath();
              if (n.p2d) { x.setTransform(q * n.m[0], q * n.m[1], q * n.m[2], q * n.m[3], q * (n.m[4] - x0) + 1, q * (n.m[5] - y0) + 1); x.clip(n.p2d, n.rule); } else { replay(x, n.cmds, q, 1 - x0 * q, 1 - y0 * q); x.clip(n.rule); }
            }
            x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
          });
          if (!e) return false;
          e.s0 = s0; e.rx = 1; e.ry = 1; if (key !== null) fam.set(key, e);
          S1.masks++;
        }
        m.e = e;
      }
      // 화면 D → 모양 안 R = (rx, ry) + (D - (x0, y0)) × (그린 배율 / 지금 배율)
      const tw = e.tr.w, th = e.tr.h, k = e.s0 / m.s;
      MT = e.tr; MX0 = x0; MY0 = y0; MU0 = (e.x + e.rx) / tw; MV0 = (e.y + e.ry) / th; MSX = k / tw; MSY = k / th;
      MR0 = (((e.x + 0.5) / tw) * 65535) | 0; MR1 = (((e.y + 0.5) / th) * 65535) | 0; MR2 = (((e.x + e.w - 0.5) / tw) * 65535) | 0; MR3 = (((e.y + e.h - 0.5) / th) * 65535) | 0;
      return true;
    }
    // 지금 그릴 수 있는 화면 범위(캔버스 ∩ 시저 ∩ 자르기 모양 범위)
    function vis() {
      let x0 = 0, y0 = 0, x1 = W, y1 = H;
      const s = st.sc; if (s) { x0 = Math.max(x0, s[0]); y0 = Math.max(y0, s[1]); x1 = Math.min(x1, s[2]); y1 = Math.min(y1, s[3]); }
      const m = st.clip; if (m) { const b = m.bb; x0 = Math.max(x0, b[0]); y0 = Math.max(y0, b[1]); x1 = Math.min(x1, b[2]); y1 = Math.min(y1, b[3]); }
      VX0 = x0; VY0 = y0; VX1 = x1; VY1 = y1;
      return x1 > x0 && y1 > y0;
    }
    let VX0 = 0, VY0 = 0, VX1 = 0, VY1 = 0;

    // ---- 스텐실 자르기(사각형이 아닌 clip): 경로를 화면 좌표 다각형으로 펴서 스텐실에 칠한다(stencil-then-cover). CPU로 그리지 않는다 ----
    // 스텐실 값: 위 4비트 = 자르기 깊이 n(그 안이면 n), 아래 4비트 = 칠하는 동안의 감김 수(16으로 나눈 나머지). 깊이 15까지.
    // 가장자리는 MSAA(antialias: true)로 부드럽다.
    const sBB = []; // sBB[n] = 깊이 n 자르기의 화면 범위(되돌릴 때 그 범위만 지운다)
    let sdLeft = false;
    // 경로 → 다각형들(화면 좌표 [x0, y0, x1, y1, ...]). 못 펴면 null
    function flatten(cmds) {
      const polys = []; let cur = null, sx0 = 0, sy0 = 0, px = 0, py = 0, has = false;
      const start = (x, y) => { cur = [x, y]; polys.push(cur); sx0 = px = x; sy0 = py = y; has = true; };
      // 끊긴 뒤(closePath·rect 뒤) 다음 점은 지금 점에서 새 조각을 시작한다
      const to = (x, y) => { if (!cur) { if (!has) return start(x, y); start(px, py); } cur.push(x, y); px = x; py = y; };
      const cut = (x, y) => { cur = null; px = x; py = y; has = true; };
      const segs = (len) => Math.max(2, Math.min(64, Math.ceil(len / 6)));
      // 타원 호: 중심 (X, Y), 선형 (a, b, c, d), 반지름 rx, ry, 회전 rot, 각 s0→s1
      const ell = (a, b, c, d, X, Y, rx, ry, rot, s0, s1, ccw) => {
        let sweep = s1 - s0;
        const T = Math.PI * 2;
        if (!ccw && sweep >= T) sweep = T; else if (ccw && -sweep >= T) sweep = -T;
        else { if (!ccw) { sweep = ((sweep % T) + T) % T; } else { sweep = -((((-sweep) % T) + T) % T); } }
        const rmax = Math.max(rx, ry) * Math.max(Math.hypot(a, b), Math.hypot(c, d));
        const step = rmax > 0.5 ? 2 * Math.acos(Math.max(-1, 1 - 0.2 / rmax)) : Math.PI / 2;
        const n = Math.max(1, Math.min(256, Math.ceil(Math.abs(sweep) / Math.max(0.01, step))));
        const cr = Math.cos(rot), sr = Math.sin(rot);
        for (let i = 0; i <= n; i++) {
          const t = s0 + (sweep * i) / n, lx = rx * Math.cos(t), ly = ry * Math.sin(t), ux = lx * cr - ly * sr, uy = lx * sr + ly * cr;
          to(a * ux + c * uy + X, b * ux + d * uy + Y);
        }
      };
      for (let i = 0; i < cmds.length; i++) {
        const k = cmds[i], t = k[0];
        if (t === 'M') start(k[1], k[2]);
        else if (t === 'L') to(k[1], k[2]);
        else if (t === 'Q') { const n = segs(Math.hypot(k[1] - px, k[2] - py) + Math.hypot(k[3] - k[1], k[4] - k[2])), x0 = px, y0 = py; for (let j = 1; j <= n; j++) { const u = j / n, v = 1 - u; to(v * v * x0 + 2 * v * u * k[1] + u * u * k[3], v * v * y0 + 2 * v * u * k[2] + u * u * k[4]); } }
        else if (t === 'C') { const n = segs(Math.hypot(k[1] - px, k[2] - py) + Math.hypot(k[3] - k[1], k[4] - k[2]) + Math.hypot(k[5] - k[3], k[6] - k[4])), x0 = px, y0 = py; for (let j = 1; j <= n; j++) { const u = j / n, v = 1 - u; to(v * v * v * x0 + 3 * v * v * u * k[1] + 3 * v * u * u * k[3] + u * u * u * k[5], v * v * v * y0 + 3 * v * v * u * k[2] + 3 * v * u * u * k[4] + u * u * u * k[6]); } }
        else if (t === 'A') ell(k[1], k[2], k[3], k[4], k[5], k[6], k[7], k[7], 0, k[8], k[9], k[10]);
        else if (t === 'E') ell(k[1], k[2], k[3], k[4], k[5], k[6], k[7], k[8], k[9], k[10], k[11], k[12]);
        else if (t === 'Z') { if (cur) cut(sx0, sy0); }
        else if (t === 'R') {
          const a = k[1], b = k[2], c = k[3], d = k[4], X = k[5], Y = k[6], w = k[7], h = k[8];
          polys.push([X, Y, X + a * w, Y + b * w, X + a * w + c * h, Y + b * w + d * h, X + c * h, Y + d * h]);
          cut(X, Y);
        } else if (t === 'O') {
          const a = k[1], b = k[2], c = k[3], d = k[4], X = k[5], Y = k[6];
          let w = k[7], h = k[8], rr = k[9];
          let r = Array.isArray(rr) ? rr.map((v) => (typeof v === 'number' ? v : v && v.x) || 0) : [typeof rr === 'number' ? rr : (rr && rr.x) || 0];
          if (r.length === 1) r = [r[0], r[0], r[0], r[0]]; else if (r.length === 2) r = [r[0], r[1], r[0], r[1]]; else if (r.length === 3) r = [r[0], r[1], r[2], r[1]];
          let ox = 0, oy = 0; if (w < 0) { ox = w; w = -w; } if (h < 0) { oy = h; h = -h; }
          const f = Math.min(1, w / Math.max(1e-9, r[0] + r[1]), w / Math.max(1e-9, r[2] + r[3]), h / Math.max(1e-9, r[0] + r[3]), h / Math.max(1e-9, r[1] + r[2]));
          r = r.map((v) => Math.max(0, v) * f);
          const H2 = Math.PI / 2;
          const corner = (cx2, cy2, rad, a0) => { if (rad > 0) ell(a, b, c, d, a * cx2 + c * cy2 + X, b * cx2 + d * cy2 + Y, rad, rad, 0, a0, a0 + H2, false); else to(a * (cx2) + c * cy2 + X, b * cx2 + d * cy2 + Y); };
          start(a * (ox + r[0]) + c * oy + X, b * (ox + r[0]) + d * oy + Y);
          corner(ox + w - r[1], oy + r[1], r[1], -H2); corner(ox + w - r[2], oy + h - r[2], r[2], 0); corner(ox + r[3], oy + h - r[3], r[3], H2); corner(ox + r[0], oy + r[0], r[0], Math.PI);
          cut(X, Y);
        } else if (t === 'T') {
          // arcTo: 사용자 좌표에서 접점을 구해 화면 좌표로
          const a = k[1], b = k[2], c = k[3], d = k[4], e = k[10], f = k[11], det = a * d - b * c;
          if (!det) return null;
          const ux = (d * (px - e) - c * (py - f)) / det, uy = (-b * (px - e) + a * (py - f)) / det;
          const x1 = k[5], y1 = k[6], x2 = k[7], y2 = k[8], r = k[9];
          const v1x = ux - x1, v1y = uy - y1, v2x = x2 - x1, v2y = y2 - y1, l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y), cr = v1x * v2y - v1y * v2x;
          if (!r || !l1 || !l2 || Math.abs(cr) < 1e-9) { to(a * x1 + c * y1 + e, b * x1 + d * y1 + f); continue; }
          const th = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)))), dist = r / Math.tan(th / 2);
          const t1x = x1 + (v1x / l1) * dist, t1y = y1 + (v1y / l1) * dist, t2x = x1 + (v2x / l2) * dist, t2y = y1 + (v2y / l2) * dist;
          const bx = v1x / l1 + v2x / l2, by = v1y / l1 + v2y / l2, bl = Math.hypot(bx, by), cd = r / Math.sin(th / 2);
          const ccx = x1 + (bx / bl) * cd, ccy = y1 + (by / bl) * cd;
          to(a * t1x + c * t1y + e, b * t1x + d * t1y + f);
          ell(a, b, c, d, a * ccx + c * ccy + e, b * ccx + d * ccy + f, r, r, 0, Math.atan2(t1y - ccy, t1x - ccx), Math.atan2(t2y - ccy, t2x - ccx), cr > 0);
        } else return null;
      }
      return polys.filter((p) => p.length >= 6);
    }
    // 스텐실용 정점 묶음(같은 정점 형식, 삼각형으로 펼침)
    let sv = new Float32Array(9 * 3 * 256);
    const sbuf = gl.createBuffer();
    function pointers() {
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 8);
      gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, STRIDE, 16); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, STRIDE, 20); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_SHORT, true, STRIDE, 28);
    }
    // 삼각형들(화면 좌표 x,y 목록, 3개씩)을 색 없이 그린다(스텐실만 바뀐다)
    function stencilTris(xy) {
      const n = xy.length / 2;
      if (sv.length < n * 9) sv = new Float32Array(n * 9 * 2);
      const su = new Uint32Array(sv.buffer), w = (WU * 65535) | 0, m = (w | (w << 16)) >>> 0;
      for (let i = 0; i < n; i++) { const o = i * 9; sv[o] = xy[i * 2]; sv[o + 1] = xy[i * 2 + 1]; sv[o + 2] = WU; sv[o + 3] = WU; su[o + 4] = 0xffffffff; sv[o + 5] = WU; sv[o + 6] = WU; su[o + 7] = m; su[o + 8] = m; }
      gl.bindBuffer(gl.ARRAY_BUFFER, sbuf); gl.bufferData(gl.ARRAY_BUFFER, sv.subarray(0, n * 9), gl.STREAM_DRAW); pointers();
      if (bound0 !== atlas) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlas.tex); bound0 = atlas; }
      if (bound1 !== atlas) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlas.tex); gl.activeTexture(gl.TEXTURE0); bound1 = atlas; }
      gl.drawArrays(gl.TRIANGLES, 0, n);
      gl.bindBuffer(gl.ARRAY_BUFFER, vb); pointers();
      S1.draws++;
    }
    const rectTris = (r) => [r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[1], r[2], r[3], r[0], r[3]];
    // 깊이 n 안쪽(위 자르기 안)에 이 경로를 더 자른다 → 깊이 n+1
    function stencilPush(polys, rule) {
      flush();
      const n = st.sd;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const tris = [];
      for (const p of polys) {
        for (let i = 0; i < p.length; i += 2) { const x = p[i], y = p[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        for (let i = 2; i + 3 < p.length; i += 2) tris.push(p[0], p[1], p[i], p[i + 1], p[i + 2], p[i + 3]);
      }
      const r = [Math.max(0, Math.floor(x0) - 1), Math.max(0, Math.floor(y0) - 1), Math.min(W, Math.ceil(x1) + 1), Math.min(H, Math.ceil(y1) + 1)];
      if (n >= 15) { unsupported.add('clip-depth>15'); return; }
      gl.disable(gl.SCISSOR_TEST); glSc = undefined;
      gl.enable(gl.STENCIL_TEST); glSd = -1;
      gl.colorMask(false, false, false, false);
      if (tris.length && r[2] > r[0] && r[3] > r[1]) {
        gl.stencilFunc(gl.EQUAL, n << 4, 0xf0);
        if (rule === 'evenodd') { gl.stencilMask(0x01); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT); }
        else { gl.stencilMask(0x0f); gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP); }
        stencilTris(tris);
        // 감김 수가 0이 아닌 곳(=위 자르기 안이면서 경로 안) → 깊이 n+1, 감김 수 0
        gl.stencilMask(0xff); gl.stencilFunc(gl.NOTEQUAL, (n + 1) << 4, 0x0f); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        stencilTris(rectTris(r));
      }
      gl.colorMask(true, true, true, true); gl.stencilMask(0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      sBB[n + 1] = r;
      st.sd = n + 1; sdLeft = true;
    }
    // 깊이를 to로 되돌린다(그 위 깊이들이 칠한 범위만)
    function stencilPop(from, to) {
      flush();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = to + 1; i <= from; i++) { const r = sBB[i]; if (!r) continue; x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
      if (x1 > x0 && y1 > y0) {
        gl.disable(gl.SCISSOR_TEST); glSc = undefined;
        gl.enable(gl.STENCIL_TEST); glSd = -1;
        gl.colorMask(false, false, false, false); gl.stencilMask(0xff);
        gl.stencilFunc(gl.LESS, to << 4, 0xf0); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        stencilTris(rectTris([x0, y0, x1, y1]));
        gl.colorMask(true, true, true, true); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      }
    }

    // ---- 쌓기·그리기 ----
    let nq = 0, nb = 0, cb = null;
    const B = [];
    function begin() {
      if (inFrame) return;
      inFrame = true; frame++; stats.frames++;
      if (lost || gl.isContextLost()) { toFallback(); return; }
      if (sizeFrom !== view && (view.width !== sizeFrom.width || view.height !== sizeFrom.height)) { view.width = sizeFrom.width; view.height = sizeFrom.height; }
      W = view.width; H = view.height;
      rBudget = 60000;
      if (st.sd) { unsupported.add('clip-across-frames'); st.sd = 0; }
      if (sdLeft) { gl.stencilMask(0xff); gl.clearStencil(0); gl.clear(gl.STENCIL_BUFFER_BIT); sdLeft = false; }
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uR, W, H);
      (root.queueMicrotask || ((f) => Promise.resolve().then(f)))(endFrame);
    }
    function endFrame() {
      if (!inFrame) return;
      flush();
      inFrame = false;
      for (const k in S1) { stats[k] += S1[k]; last[k] = S1[k]; S1[k] = 0; }
      if (frame % 120 === 0) housekeep();
    }
    const last = {};
    let dbg = null; // 디버그: 이번 프레임에 새로 그린 것 [키 앞부분, 폭, 높이]
    function batch(tr, nr) {
      const bl = st.bl, sc = st.sc, sd = st.sd;
      if (cb && cb.tr === tr && cb.bl === bl && cb.nr === nr && cb.sc === sc && cb.mt === MT && cb.sd === sd) return;
      cb = B[nb] || (B[nb] = {}); nb++;
      cb.tr = tr; cb.bl = bl; cb.nr = nr; cb.sc = sc; cb.mt = MT; cb.sd = sd; cb.q0 = nq; cb.n = 0;
      tr.gen = gen; MT.gen = gen;
    }
    function quad(tr, nr, x0, y0, x1, y1, x2, y2, x3, y3, u0, v0, u1, v1, col) {
      if (nq >= MAXQ) flush();
      batch(tr, nr);
      const o = nq * FPQ, m01 = MR0 | (MR1 << 16), m23 = MR2 | (MR3 << 16);
      vf[o] = x0; vf[o + 1] = y0; vf[o + 2] = u0; vf[o + 3] = v0; vu[o + 4] = col; vf[o + 5] = MU0 + (x0 - MX0) * MSX; vf[o + 6] = MV0 + (y0 - MY0) * MSY; vu[o + 7] = m01; vu[o + 8] = m23;
      vf[o + 9] = x1; vf[o + 10] = y1; vf[o + 11] = u1; vf[o + 12] = v0; vu[o + 13] = col; vf[o + 14] = MU0 + (x1 - MX0) * MSX; vf[o + 15] = MV0 + (y1 - MY0) * MSY; vu[o + 16] = m01; vu[o + 17] = m23;
      vf[o + 18] = x2; vf[o + 19] = y2; vf[o + 20] = u1; vf[o + 21] = v1; vu[o + 22] = col; vf[o + 23] = MU0 + (x2 - MX0) * MSX; vf[o + 24] = MV0 + (y2 - MY0) * MSY; vu[o + 25] = m01; vu[o + 26] = m23;
      vf[o + 27] = x3; vf[o + 28] = y3; vf[o + 29] = u0; vf[o + 30] = v1; vu[o + 31] = col; vf[o + 32] = MU0 + (x3 - MX0) * MSX; vf[o + 33] = MV0 + (y3 - MY0) * MSY; vu[o + 34] = m01; vu[o + 35] = m23;
      nq++; cb.n++;
    }
    let glBl = -1, glSc = undefined, bound1 = null, glSd = -1;
    function flush() {
      if (!nq) { nb = 0; cb = null; return; }
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, vbuf.byteLength, gl.STREAM_DRAW); // 버리고 새로(앞 그리기와 기다림 없이)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vf.subarray(0, nq * FPQ));
      for (let i = 0; i < nb; i++) {
        const b = B[i];
        if (!b.n) continue;
        if (b.mt !== bound1) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b.mt.tex); gl.activeTexture(gl.TEXTURE0); bound1 = b.mt; }
        if (b.bl !== glBl) { const m = BLENDS[b.bl]; gl.blendFuncSeparate(m[1], m[2], m[3], m[4]); glBl = b.bl; }
        if (b.sd !== glSd) {
          if (b.sd) { gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, b.sd << 4, 0xf0); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); } else gl.disable(gl.STENCIL_TEST);
          glSd = b.sd;
        }
        if (b.sc !== glSc) {
          if (b.sc) { gl.enable(gl.SCISSOR_TEST); const s = b.sc, dh = gl.drawingBufferHeight, k = dh / H; gl.scissor(Math.round(s[0] * k), Math.round(dh - s[3] * k), Math.max(0, Math.round((s[2] - s[0]) * k)), Math.max(0, Math.round((s[3] - s[1]) * k))); } else gl.disable(gl.SCISSOR_TEST);
          glSc = b.sc;
        }
        const tr = b.tr;
        if (bound0 !== tr) { gl.bindTexture(gl.TEXTURE_2D, tr.tex); bound0 = tr; }
        if (tr.nr !== b.nr && tr !== atlas) { const f = b.nr ? gl.NEAREST : gl.LINEAR; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); tr.nr = b.nr; }
        gl.drawElements(gl.TRIANGLES, b.n * 6, gl.UNSIGNED_SHORT, b.q0 * 12);
        S1.draws++;
      }
      S1.quads += nq; S1.flushes++;
      nq = 0; nb = 0; cb = null; gen++;
    }

    // 미리 곱한 색(0~1 알파 곱)
    function packCol(c, ga) {
      const A = c[3] * ga;
      return (((c[0] * A + 0.5) | 0) | (((c[1] * A + 0.5) | 0) << 8) | (((c[2] * A + 0.5) | 0) << 16) | (((A * 255 + 0.5) | 0) << 24)) >>> 0;
    }
    const packA = (ga) => { const a = (ga * 255 + 0.5) | 0; return (a | (a << 8) | (a << 16) | (a << 24)) >>> 0; };
    const shadowOn = () => st.shA > 0 && (st.shBlur > 0 || st.shX !== 0 || st.shY !== 0);
    const shadowKey = () => (shadowOn() ? '|sh' + st.shCol + ',' + st.shBlur + ',' + st.shX + ',' + st.shY : '') + (st.filter !== 'none' ? '|fi' + st.filter : '');
    const shadowPad = () => (shadowOn() ? Math.ceil(st.shBlur * 1.5 + Math.abs(st.shX) + Math.abs(st.shY)) + 2 : 0);
    function applyShadow(x) {
      if (shadowOn()) { x.shadowColor = st.shCol; x.shadowBlur = st.shBlur; x.shadowOffsetX = st.shX; x.shadowOffsetY = st.shY; }
      if (st.filter !== 'none') x.filter = st.filter;
    }
    // 캐시 한 칸을 찍는다: 기준점 (ax, ay)에 지금 배율 s로(배율이 같으면 정수 화소에 1:1로 맞춰 원본 그대로)
    function drawEntry(e, s, ax, ay) {
      if (!maskReady() || !valid(e)) return; // 자르기 모양을 그리다 아틀라스가 비워졌다(드묾): 이번 한 번 빠진다
      let k = s / e.s0, X0 = ax - e.rx * k, Y0 = ay - e.ry * k;
      if (k > 0.9999 && k < 1.0001) { k = 1; X0 = Math.round(X0); Y0 = Math.round(Y0); }
      const x0 = X0 + 0.5 * k, y0 = Y0 + 0.5 * k, x1 = X0 + (e.w - 0.5) * k, y1 = Y0 + (e.h - 0.5) * k;
      if (x1 <= VX0 || x0 >= VX1 || y1 <= VY0 || y0 >= VY1) return;
      const tw = e.tr.w, th = e.tr.h;
      quad(e.tr, false, x0, y0, x1, y0, x1, y1, x0, y1, (e.x + 0.5) / tw, (e.y + 0.5) / th, (e.x + e.w - 0.5) / tw, (e.y + e.h - 0.5) / th, packA(st.ga));
    }

    // ---- 경로 기록: 화면 화소 좌표로 적는다(원·타원·모서리 둥근 사각형은 그때의 선형 변환과 함께) ----
    let pc = [], bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, pJoin = false, cx = 0, cy = 0, hasCur = false;
    const fin = (...a) => { for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; };
    function bb(x, y) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    const tx = (x, y) => st.a * x + st.c * y + st.e, ty = (x, y) => st.b * x + st.d * y + st.f;
    function bbBox(lx0, ly0, lx1, ly1) { bb(tx(lx0, ly0), ty(lx0, ly0)); bb(tx(lx1, ly0), ty(lx1, ly0)); bb(tx(lx1, ly1), ty(lx1, ly1)); bb(tx(lx0, ly1), ty(lx0, ly1)); }
    function beginPath() { pc = []; bx0 = by0 = Infinity; bx1 = by1 = -Infinity; pJoin = false; hasCur = false; }
    function moveTo(x, y) { if (!fin(x, y)) return; const X = tx(x, y), Y = ty(x, y); pc.push(['M', X, Y]); bb(X, Y); cx = X; cy = Y; hasCur = true; }
    function lineTo(x, y) { if (!fin(x, y)) return; if (!hasCur) return moveTo(x, y); const X = tx(x, y), Y = ty(x, y); pc.push(['L', X, Y]); bb(X, Y); pJoin = true; cx = X; cy = Y; }
    function quadraticCurveTo(qx, qy, x, y) { if (!fin(qx, qy, x, y)) return; if (!hasCur) moveTo(qx, qy); const a = tx(qx, qy), b = ty(qx, qy), X = tx(x, y), Y = ty(x, y); pc.push(['Q', a, b, X, Y]); bb(a, b); bb(X, Y); pJoin = true; cx = X; cy = Y; }
    function bezierCurveTo(ax, ay, bx, by, x, y) { if (!fin(ax, ay, bx, by, x, y)) return; if (!hasCur) moveTo(ax, ay); const p = [tx(ax, ay), ty(ax, ay), tx(bx, by), ty(bx, by), tx(x, y), ty(x, y)]; pc.push(['C', ...p]); bb(p[0], p[1]); bb(p[2], p[3]); bb(p[4], p[5]); pJoin = true; cx = p[4]; cy = p[5]; }
    function radErr() { throw new DOMException('The radius provided is negative.', 'IndexSizeError'); }
    function arc(x, y, r, s0, s1, ccw) {
      if (!fin(x, y, r, s0, s1)) return; if (r < 0) radErr();
      const X = tx(x, y), Y = ty(x, y);
      pc.push(['A', st.a, st.b, st.c, st.d, X, Y, r, s0, s1, !!ccw]);
      const ex = r * (Math.abs(st.a) + Math.abs(st.c)), ey = r * (Math.abs(st.b) + Math.abs(st.d));
      bb(X - ex, Y - ey); bb(X + ex, Y + ey); if (hasCur) bb(cx, cy); hasCur = true; cx = X; cy = Y;
    }
    function ellipse(x, y, rx, ry, rot, s0, s1, ccw) {
      if (!fin(x, y, rx, ry, rot, s0, s1)) return; if (rx < 0 || ry < 0) radErr();
      const X = tx(x, y), Y = ty(x, y), r = Math.max(rx, ry);
      pc.push(['E', st.a, st.b, st.c, st.d, X, Y, rx, ry, rot, s0, s1, !!ccw]);
      const ex = r * (Math.abs(st.a) + Math.abs(st.c)), ey = r * (Math.abs(st.b) + Math.abs(st.d));
      bb(X - ex, Y - ey); bb(X + ex, Y + ey); if (hasCur) bb(cx, cy); hasCur = true; cx = X; cy = Y;
    }
    function arcTo(x1, y1, x2, y2, r) {
      if (!fin(x1, y1, x2, y2, r)) return; if (r < 0) radErr(); if (!hasCur) moveTo(x1, y1);
      pc.push(['T', st.a, st.b, st.c, st.d, x1, y1, x2, y2, r, st.e, st.f]);
      bb(tx(x1, y1), ty(x1, y1)); bb(tx(x2, y2), ty(x2, y2)); pJoin = true; hasCur = true; cx = tx(x2, y2); cy = ty(x2, y2);
    }
    function rect(x, y, w, h) {
      if (!fin(x, y, w, h)) return;
      const X = tx(x, y), Y = ty(x, y);
      pc.push(['R', st.a, st.b, st.c, st.d, X, Y, w, h]);
      bbBox(x, y, x + w, y + h); pJoin = true; hasCur = true; cx = X; cy = Y;
    }
    function roundRect(x, y, w, h, rr) {
      if (!fin(x, y, w, h)) return;
      const X = tx(x, y), Y = ty(x, y);
      pc.push(['O', st.a, st.b, st.c, st.d, X, Y, w, h, rr === undefined ? 0 : rr]);
      bbBox(x, y, x + w, y + h); pJoin = true; hasCur = true; cx = X; cy = Y;
    }
    function closePath() { if (pc.length) pc.push(['Z']); }
    // 보조 캔버스에 다시 그린다: 화면 좌표 D를 p·D + (ox, oy)로 옮겨서
    function replay(x, cmds, p, ox, oy) {
      let id = false;
      for (let i = 0; i < cmds.length; i++) {
        const k = cmds[i], t = k[0];
        if (t === 'M' || t === 'L' || t === 'Q' || t === 'C') {
          if (!id) { x.setTransform(1, 0, 0, 1, 0, 0); id = true; }
          if (t === 'M') x.moveTo(p * k[1] + ox, p * k[2] + oy);
          else if (t === 'L') x.lineTo(p * k[1] + ox, p * k[2] + oy);
          else if (t === 'Q') x.quadraticCurveTo(p * k[1] + ox, p * k[2] + oy, p * k[3] + ox, p * k[4] + oy);
          else x.bezierCurveTo(p * k[1] + ox, p * k[2] + oy, p * k[3] + ox, p * k[4] + oy, p * k[5] + ox, p * k[6] + oy);
        } else if (t === 'Z') x.closePath();
        else {
          id = false;
          if (t === 'T') { x.setTransform(p * k[1], p * k[2], p * k[3], p * k[4], p * k[10] + ox, p * k[11] + oy); x.arcTo(k[5], k[6], k[7], k[8], k[9]); continue; }
          x.setTransform(p * k[1], p * k[2], p * k[3], p * k[4], p * k[5] + ox, p * k[6] + oy);
          if (t === 'A') x.arc(0, 0, k[7], k[8], k[9], k[10]);
          else if (t === 'E') x.ellipse(0, 0, k[7], k[8], k[9], k[10], k[11], k[12]);
          else if (t === 'R') x.rect(0, 0, k[7], k[8]);
          else if (t === 'O') x.roundRect(0, 0, k[7], k[8], k[9]);
        }
      }
    }
    // 경로 모양 키: 기준점 (ax, ay)에서 떨어진 거리를 배율로 나눠(inv = 1/배율) 1/4 단위로. 배율·위치가 달라도 모양이 같으면 같은 키. 너무 길면 null(캐시 안 함)
    function pathKey(cmds, ax, ay, inv) {
      if (cmds.length > 96) return null;
      let s = '';
      for (let i = 0; i < cmds.length; i++) {
        const k = cmds[i], t = k[0];
        s += t;
        if (t === 'Z') continue;
        if (t === 'M' || t === 'L' || t === 'Q' || t === 'C') { for (let j = 1; j < k.length; j += 2) s += r4((k[j] - ax) * inv) + ',' + r4((k[j + 1] - ay) * inv) + ','; continue; }
        s += r3(k[1] * inv) + ',' + r3(k[2] * inv) + ',' + r3(k[3] * inv) + ',' + r3(k[4] * inv) + ',';
        if (t === 'T') { s += r4((k[10] - ax) * inv) + ',' + r4((k[11] - ay) * inv) + ',' + r2(k[5]) + ',' + r2(k[6]) + ',' + r2(k[7]) + ',' + r2(k[8]) + ',' + r2(k[9]) + ';'; continue; }
        s += r4((k[5] - ax) * inv) + ',' + r4((k[6] - ay) * inv);
        for (let j = 7; j < k.length; j++) s += ',' + (typeof k[j] === 'number' ? r3(k[j]) : String(k[j]));
        s += ';';
      }
      return s;
    }
    function strokeKey() { return '|' + st.lw + ',' + st.cap + ',' + st.join + ',' + st.miter + ',' + st.dash.join('/') + ',' + st.dashOff; }
    function applyStroke(x) { x.lineWidth = st.lw; x.lineCap = st.cap; x.lineJoin = st.join; x.miterLimit = st.miter; x.setLineDash(st.dash); x.lineDashOffset = st.dashOff; }

    // fill/stroke: 경로가 덮는 화면 영역을 보조 캔버스에 그려 찍는다
    function paintPath(isStroke, rule, p2d) {
      begin(); if (fb) return fb[isStroke ? 'stroke' : 'fill'](...(p2d ? [p2d] : []).concat(rule ? [rule] : []));
      if (!(st.ga > 0) || !vis() || !maskReady()) return;
      const style = isStroke ? st.stroke : st.fill;
      const a = st.a, b = st.b, c = st.c, d = st.d, E = st.e, F = st.f;
      const draw = (x) => { applyShadow(x); if (isStroke) { applyStroke(x); x.strokeStyle = style; p2d ? x.stroke(p2d) : x.stroke(); } else { x.fillStyle = style; p2d ? x.fill(p2d, rule || 'nonzero') : x.fill(rule || 'nonzero'); } };
      if (p2d) {
        // Path2D는 안을 읽을 수 없다: 보이는 범위 전체를 캐시 없이 그린다
        const ox = Math.floor(VX0), oy = Math.floor(VY0), ow = Math.ceil(VX1) - ox, oh = Math.ceil(VY1) - oy;
        const e = raster(null, ow, oh, (x) => { x.setTransform(a, b, c, d, E - ox, F - oy); draw(x); });
        if (e) drawEntry(keep(e, null, 1, 0, 0), 1, ox, oy);
        return;
      }
      if (!pc.length || !(bx1 >= bx0)) return;
      const s = Math.sqrt(Math.abs(a * d - b * c)) || 1e-9, inv = 1 / s;
      let ex = 1.5 + shadowPad();
      if (isStroke) { let hw = (st.lw / 2) * Math.max(Math.hypot(a, b), Math.hypot(c, d)); if (st.join === 'miter' && pJoin) hw *= Math.max(1, st.miter); if (st.cap === 'square') hw *= 1.42; ex += hw; }
      const fx0 = bx0 - ex, fy0 = by0 - ex, fx1 = bx1 + ex, fy1 = by1 + ex;
      if (fx1 <= VX0 || fx0 >= VX1 || fy1 <= VY0 || fy0 >= VY1) return;
      let ox = Math.floor(fx0), oy = Math.floor(fy0), ow = Math.ceil(fx1) - ox, oh = Math.ceil(fy1) - oy;
      // 넓고 화면 밖으로 나가는 것은 보이는 곳만(그때는 그 자리 그대로만 캐시)
      const cut = ow * oh > 262144 && (fx0 < VX0 || fy0 < VY0 || fx1 > VX1 || fy1 > VY1);
      if (cut) { const x1 = Math.min(ox + ow, Math.ceil(VX1)), y1 = Math.min(oy + oh, Math.ceil(VY1)); ox = Math.max(ox, Math.floor(VX0)); oy = Math.max(oy, Math.floor(VY0)); ow = x1 - ox; oh = y1 - oy; if (ow <= 0 || oh <= 0) return; }
      const pk = pathKey(pc, bx0, by0, inv);
      let fk = null, ek = null;
      if (pk !== null) {
        const solid = typeof style === 'string';
        const base = (isStroke ? 'S' : 'F') + (rule || '') + styleKey(style) + (isStroke ? strokeKey() : '') + '|' + (solid && !isStroke ? '' : r3(a * inv) + ',' + r3(b * inv) + ',' + r3(c * inv) + ',' + r3(d * inv)) + (solid ? '' : ',' + r4((E - bx0) * inv) + ',' + r4((F - by0) * inv)) + '|' + pk + shadowKey();
        if (cut) ek = base + '|cut' + ox + ',' + oy + ',' + ow + ',' + oh + '|' + Math.round(s * 4096) + '|' + r4(bx0) + ',' + r4(by0);
        else { fk = base; ek = base + '|' + Math.round(s * 4096) + '|' + r4(bx0 - ox) + ',' + r4(by0 - oy); }
      }
      let e = ek === null ? null : pick(ek, fk, s, ow * oh);
      if (!e) {
        const cmds = pc;
        e = raster(ek, ow, oh, (x) => { x.beginPath(); replay(x, cmds, 1, -ox, -oy); x.setTransform(a, b, c, d, E - ox, F - oy); draw(x); });
        if (!e) return;
        keep(e, fk, s, bx0 - ox, by0 - oy);
      }
      drawEntry(e, s, bx0, by0);
    }

    // 사각형(단색이면 바로, 그 밖은 경로로)
    function solidQuad(x, y, w, h, col) {
      const a = st.a, b = st.b, c = st.c, d = st.d;
      const X0 = a * x + c * y + st.e, Y0 = b * x + d * y + st.f, ax = a * w, ay = b * w, cx2 = c * h, cy2 = d * h;
      const mnx = Math.min(X0, X0 + ax, X0 + cx2, X0 + ax + cx2), mxx = Math.max(X0, X0 + ax, X0 + cx2, X0 + ax + cx2);
      const mny = Math.min(Y0, Y0 + ay, Y0 + cy2, Y0 + ay + cy2), mxy = Math.max(Y0, Y0 + ay, Y0 + cy2, Y0 + ay + cy2);
      if (mxx <= VX0 || mnx >= VX1 || mxy <= VY0 || mny >= VY1) return;
      if (!maskReady()) return;
      quad(atlas, false, X0, Y0, X0 + ax, Y0 + ay, X0 + ax + cx2, Y0 + ay + cy2, X0 + cx2, Y0 + cy2, WU, WU, WU, WU, col);
    }
    function fillRect(x, y, w, h) {
      begin(); if (fb) return fb.fillRect(x, y, w, h);
      if (!fin(x, y, w, h) || !w || !h || !(st.ga > 0) || !vis()) return;
      const s = st.fill;
      if (typeof s === 'string' && !shadowOn() && st.filter === 'none') { const c = parseCol(s); if (c && c[3] > 0) solidQuad(x, y, w, h, packCol(c, st.ga)); return; }
      const keep = [pc, bx0, by0, bx1, by1, pJoin, hasCur, cx, cy];
      beginPath(); rect(x, y, w, h); paintPath(false, null);
      [pc, bx0, by0, bx1, by1, pJoin, hasCur, cx, cy] = keep;
    }
    function clearRect(x, y, w, h) {
      begin(); if (fb) return fb.clearRect(x, y, w, h);
      if (!fin(x, y, w, h) || !w || !h || !vis()) return;
      // 자르기 모양 안만 지우도록 destination-out(흰색 불투명)으로 뺀다
      const bl = st.bl; st.bl = BL_IDX['destination-out'];
      solidQuad(x, y, w, h, 0xffffffff);
      st.bl = bl;
    }
    function strokeRect(x, y, w, h) {
      begin(); if (fb) return fb.strokeRect(x, y, w, h);
      if (!fin(x, y, w, h)) return;
      const keep = [pc, bx0, by0, bx1, by1, pJoin, hasCur, cx, cy];
      beginPath(); rect(x, y, w, h); paintPath(true, null);
      [pc, bx0, by0, bx1, by1, pJoin, hasCur, cx, cy] = keep;
    }

    // ---- 그림 ----
    function drawImage(img, a1, a2, a3, a4, a5, a6, a7, a8) {
      begin(); if (fb) return fb.drawImage.apply(fb, arguments);
      const n = arguments.length;
      let iw, ih;
      if (img instanceof HTMLImageElement) { if (!img.complete || !img.naturalWidth) return; iw = img.naturalWidth; ih = img.naturalHeight; }
      else if (img && img.videoWidth !== undefined) { iw = img.videoWidth; ih = img.videoHeight; }
      else if (img) { iw = img.width; ih = img.height; }
      if (!iw || !ih) return;
      let sx0 = 0, sy0 = 0, sw = iw, sh = ih, dx, dy, dw, dh;
      if (n === 3) { dx = a1; dy = a2; dw = iw; dh = ih; } else if (n === 5) { dx = a1; dy = a2; dw = a3; dh = a4; } else { sx0 = a1; sy0 = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8; }
      if (!(dw && dh && sw && sh) || !fin(dx, dy, sx0, sy0)) return;
      if (sw < 0) { sx0 += sw; sw = -sw; } if (sh < 0) { sy0 += sh; sh = -sh; }
      if (dw < 0) { dx += dw; dw = -dw; } if (dh < 0) { dy += dh; dh = -dh; }
      if (sx0 < 0 || sy0 < 0 || sx0 + sw > iw || sy0 + sh > ih) {
        const kx = dw / sw, ky = dh / sh, x0 = Math.max(0, sx0), y0 = Math.max(0, sy0), x1 = Math.min(iw, sx0 + sw), y1 = Math.min(ih, sy0 + sh);
        if (x1 <= x0 || y1 <= y0) return;
        dx += (x0 - sx0) * kx; dy += (y0 - sy0) * ky; dw = (x1 - x0) * kx; dh = (y1 - y0) * ky; sx0 = x0; sy0 = y0; sw = x1 - x0; sh = y1 - y0;
      }
      if (!(st.ga > 0) || !vis()) return;
      const a = st.a, b = st.b, c = st.c, d = st.d;
      const X0 = a * dx + c * dy + st.e, Y0 = b * dx + d * dy + st.f, ax = a * dw, ay = b * dw, cx2 = c * dh, cy2 = d * dh;
      const mnx = Math.min(X0, X0 + ax, X0 + cx2, X0 + ax + cx2), mxx = Math.max(X0, X0 + ax, X0 + cx2, X0 + ax + cx2);
      const mny = Math.min(Y0, Y0 + ay, Y0 + cy2, Y0 + ay + cy2), mxy = Math.max(Y0, Y0 + ay, Y0 + cy2, Y0 + ay + cy2);
      const sp = shadowPad();
      if (mxx + sp <= VX0 || mnx - sp >= VX1 || mxy + sp <= VY0 || mny - sp >= VY1) return;
      if (sp || st.filter !== 'none') {
        // 그림자·필터: 보조 캔버스에서 2D 그대로(캐시 없음)
        const ox = Math.max(VX0, Math.floor(mnx - sp - 1)), oy = Math.max(VY0, Math.floor(mny - sp - 1)), ow = Math.min(VX1, Math.ceil(mxx + sp + 1)) - ox, oh = Math.min(VY1, Math.ceil(mxy + sp + 1)) - oy;
        if (ow <= 0 || oh <= 0 || !maskReady()) return;
        const e = raster(null, ow, oh, (x) => { x.setTransform(a, b, c, d, st.e - ox, st.f - oy); applyShadow(x); x.imageSmoothingEnabled = st.smooth; x.drawImage(img, sx0, sy0, sw, sh, dx, dy, dw, dh); });
        if (e) drawEntry(keep(e, null, 1, 0, 0), 1, ox, oy);
        return;
      }
      const tr = texFor(img, iw, ih);
      if (!tr || !maskReady()) return;
      quad(tr, !st.smooth, X0, Y0, X0 + ax, Y0 + ay, X0 + ax + cx2, Y0 + ay + cy2, X0 + cx2, Y0 + cy2, sx0 / iw, sy0 / ih, (sx0 + sw) / iw, (sy0 + sh) / ih, packA(st.ga));
    }

    // ---- 글자: 글꼴·글자·색·정렬·변환(배율을 뺀 선형 부분)으로 모양 키, 여기에 배율·소수 위치(1/4 화소)를 더해 정확 키 ----
    function paintText(isStroke, s, x, y, maxW) {
      begin(); if (fb) return maxW === undefined ? fb[isStroke ? 'strokeText' : 'fillText'](s, x, y) : fb[isStroke ? 'strokeText' : 'fillText'](s, x, y, maxW);
      s = String(s);
      if (!s || !fin(x, y) || !(st.ga > 0) || !vis() || !maskReady()) return;
      if (maxW !== undefined && !(maxW > 0)) return;
      const style = isStroke ? st.stroke : st.fill;
      const a = st.a, b = st.b, c = st.c, d = st.d;
      const AX = a * x + c * y + st.e, AY = b * x + d * y + st.f;
      const sc = Math.sqrt(Math.abs(a * d - b * c)) || 1e-9, inv = 1 / sc;
      let ix = Math.floor(AX), iy = Math.floor(AY), fx = Math.round((AX - ix) * 4) / 4, fy = Math.round((AY - iy) * 4) / 4;
      if (fx >= 1) { ix++; fx = 0; } if (fy >= 1) { iy++; fy = 0; }
      const fk = (isStroke ? 's' : 'f') + st.font + '\u0001' + s + '\u0001' + styleKey(style) + '|' + st.align + st.base + st.dir + st.ls + (isStroke ? strokeKey() : '') + '|' + (maxW === undefined ? '' : r2(maxW)) + '|' + r3(a * inv) + ',' + r3(b * inv) + ',' + r3(c * inv) + ',' + r3(d * inv) + (typeof style === 'string' ? '' : '|' + r2(x) + ',' + r2(y)) + shadowKey();
      const ek = fk + '|' + Math.round(sc * 4096) + '|' + fx + ',' + fy;
      let e = pick(ek, fk, sc, 3000);
      if (!e) {
        sx.font = st.font; sx.textAlign = st.align; sx.textBaseline = st.base; sx.direction = st.dir; if ('letterSpacing' in sx) sx.letterSpacing = st.ls;
        const m = sx.measureText(s);
        const ex = isStroke ? (st.lw / 2) * (st.join === 'miter' ? 2 : 1) : 0;
        const l = -m.actualBoundingBoxLeft - ex, r = m.actualBoundingBoxRight + ex, t = -m.actualBoundingBoxAscent - ex, bt = m.actualBoundingBoxDescent + ex;
        const xs = [a * l + c * t, a * r + c * t, a * r + c * bt, a * l + c * bt], ys = [b * l + d * t, b * r + d * t, b * r + d * bt, b * l + d * bt];
        const pad = 2 + shadowPad();
        const dx = Math.floor(fx + Math.min(...xs)) - pad, dy = Math.floor(fy + Math.min(...ys)) - pad;
        const w = Math.ceil(fx + Math.max(...xs)) + pad - dx, h = Math.ceil(fy + Math.max(...ys)) + pad - dy;
        if (!(w > 0 && h > 0)) return;
        e = raster(ek, w, h, (X) => {
          X.font = st.font; X.textAlign = st.align; X.textBaseline = st.base; X.direction = st.dir; if ('letterSpacing' in X) X.letterSpacing = st.ls;
          // (x, y)가 영역 안 (fx - dx, fy - dy)에 오도록(그라디언트·패턴은 원래 사용자 좌표 그대로)
          X.setTransform(a, b, c, d, fx - dx - (AX - st.e), fy - dy - (AY - st.f)); applyShadow(X);
          if (isStroke) { applyStroke(X); X.strokeStyle = style; maxW === undefined ? X.strokeText(s, x, y) : X.strokeText(s, x, y, maxW); } else { X.fillStyle = style; maxW === undefined ? X.fillText(s, x, y) : X.fillText(s, x, y, maxW); }
        });
        if (!e) return;
        keep(e, fk, sc, fx - dx, fy - dy);
      }
      drawEntry(e, sc, AX, AY);
    }
    function measureText(s) { if (fb) return fb.measureText(s); sx.font = st.font; sx.textAlign = st.align; sx.textBaseline = st.base; sx.direction = st.dir; if ('letterSpacing' in sx) sx.letterSpacing = st.ls; return sx.measureText(String(s)); }

    // ---- 자르기 ----
    function clip(a1, a2) {
      begin(); if (fb) return fb.clip.apply(fb, arguments);
      const p2d = a1 && typeof a1 === 'object' ? a1 : null, rule = (p2d ? a2 : a1) || 'nonzero';
      if (!p2d && pc.length === 1 && pc[0][0] === 'R' && pc[0][2] === 0 && pc[0][3] === 0) {
        // 축에 맞는 사각형 하나: 시저(화소 경계로 반올림)
        const k = pc[0], x0 = k[5], y0 = k[6], x1 = k[5] + k[1] * k[7], y1 = k[6] + k[4] * k[8];
        const r = [Math.round(Math.min(x0, x1)), Math.round(Math.min(y0, y1)), Math.round(Math.max(x0, x1)), Math.round(Math.max(y0, y1))];
        const s = st.sc;
        st.sc = s ? [Math.max(s[0], r[0]), Math.max(s[1], r[1]), Math.min(s[2], r[2]), Math.min(s[3], r[3])] : r;
        if (st.sc[2] < st.sc[0]) st.sc[2] = st.sc[0];
        if (st.sc[3] < st.sc[1]) st.sc[3] = st.sc[1];
        return;
      }
      // 펼 수 있는 경로는 스텐실(GPU). Path2D만 자르기 모양 텍스처(CPU)
      if (!p2d) { const polys = flatten(pc); if (polys) { stencilPush(polys, rule); return; } }
      const up = st.clip;
      let bbx;
      if (p2d) bbx = [0, 0, W, H];
      else if (!pc.length || !(bx1 >= bx0)) bbx = [0, 0, 0, 0];
      else bbx = [bx0 - 1.5, by0 - 1.5, bx1 + 1.5, by1 + 1.5];
      if (up) { const u = up.bb; bbx = [Math.max(bbx[0], u[0]), Math.max(bbx[1], u[1]), Math.min(bbx[2], u[2]), Math.min(bbx[3], u[3])]; }
      const empty = !(bbx[2] > bbx[0] && bbx[3] > bbx[1]) || !!(up && up.empty);
      st.clip = { up, cmds: pc.slice(), rule, p2d, m: p2d ? [st.a, st.b, st.c, st.d, st.e, st.f] : null, s: Math.sqrt(Math.abs(st.a * st.d - st.b * st.c)) || 1e-9, bb: bbx, empty, e: null };
    }

    // ---- 변환 ----
    function setT(a, b, c, d, e, f) { st.a = a; st.b = b; st.c = c; st.d = d; st.e = e; st.f = f; }
    function transform(a, b, c, d, e, f) {
      if (fb) return fb.transform(a, b, c, d, e, f);
      if (!fin(a, b, c, d, e, f)) return;
      const A = st.a, B2 = st.b, C = st.c, D = st.d;
      setT(A * a + C * b, B2 * a + D * b, A * c + C * d, B2 * c + D * d, A * e + C * f + st.e, B2 * e + D * f + st.f);
    }
    function setTransform(a, b, c, d, e, f) {
      if (fb) { fbSync(); return fb.setTransform.apply(fb, arguments); }
      if (a && typeof a === 'object') { const m = a; return setT(m.a ?? m.m11 ?? 1, m.b ?? m.m12 ?? 0, m.c ?? m.m21 ?? 0, m.d ?? m.m22 ?? 1, m.e ?? m.m41 ?? 0, m.f ?? m.m42 ?? 0); }
      if (arguments.length === 0) return setT(1, 0, 0, 1, 0, 0);
      if (!fin(a, b, c, d, e, f)) return;
      setT(a, b, c, d, e, f);
    }
    function translate(x, y) { if (fb) return fb.translate(x, y); if (!fin(x, y)) return; st.e += st.a * x + st.c * y; st.f += st.b * x + st.d * y; }
    function scale(x, y) { if (fb) return fb.scale(x, y); if (!fin(x, y)) return; st.a *= x; st.b *= x; st.c *= y; st.d *= y; }
    function rotate(r) {
      if (fb) return fb.rotate(r); if (!fin(r)) return;
      const cs = Math.cos(r), sn = Math.sin(r), A = st.a, B2 = st.b, C = st.c, D = st.d;
      st.a = A * cs + C * sn; st.b = B2 * cs + D * sn; st.c = C * cs - A * sn; st.d = D * cs - B2 * sn;
    }
    function save() { if (fb) return fb.save(); const s = pool.pop() || newState(); copyState(s, st); stack.push(s); }
    function restore() { if (fb) return fb.restore(); const s = stack.pop(); if (!s) return; const from = st.sd; copyState(st, s); pool.push(s); if (st.sd < from) stencilPop(from, st.sd); }
    function reset() { if (fb) return fb.reset && fb.reset(); while (stack.length) pool.push(stack.pop()); st = newState(); beginPath(); begin(); flush(); gl.disable(gl.SCISSOR_TEST); glSc = null; gl.clearColor(0, 0, 0, 0); gl.stencilMask(0xff); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); glSd = -1; }

    // ---- 2D로 되돌리기(WebGL 컨텍스트 분실) ----
    let onFallback = opt.onFallback || null, fbSync = () => {};
    function toFallback() {
      if (fb) return;
      lost = true;
      if (opt.patched) { if (onFallback) onFallback(); return; }
      // #view에는 이미 WebGL이 묶여 있어 2D를 못 얻는다: 같은 자리에 2D 캔버스를 겹친다(입력은 아래 #view가 그대로 받는다)
      const c2 = document.createElement('canvas');
      c2.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
      c2.width = view.width; c2.height = view.height;
      view.parentNode.insertBefore(c2, view.nextSibling);
      const x2 = c2.getContext('2d');
      // 크기는 render가 매 프레임 부르는 setTransform에서 맞춘다(아래 setTransform)
      fbSync = () => { if (c2.width !== view.width || c2.height !== view.height) { c2.width = view.width; c2.height = view.height; } };
      fb = x2;
      // 지금 상태를 옮긴다
      x2.setTransform(st.a, st.b, st.c, st.d, st.e, st.f); x2.globalAlpha = st.ga; x2.globalCompositeOperation = st.op;
      console.warn('[glctx] WebGL 분실: 2D로 되돌림');
      if (onFallback) onFallback();
    }
    view.addEventListener('webglcontextlost', () => { lost = true; toFallback(); });

    // ---- 겉모습: CanvasRenderingContext2D와 같은 이름 ----
    const api = {
      isGL: true, save, restore, reset, transform, setTransform, translate, scale, rotate,
      resetTransform() { if (fb) return fb.resetTransform(); setT(1, 0, 0, 1, 0, 0); },
      getTransform() { if (fb) return fb.getTransform(); return new DOMMatrix([st.a, st.b, st.c, st.d, st.e, st.f]); },
      beginPath() { if (fb) return fb.beginPath(); beginPath(); }, closePath() { if (fb) return fb.closePath(); closePath(); },
      moveTo(x, y) { if (fb) return fb.moveTo(x, y); moveTo(x, y); }, lineTo(x, y) { if (fb) return fb.lineTo(x, y); lineTo(x, y); },
      quadraticCurveTo(a, b, c, d) { if (fb) return fb.quadraticCurveTo(a, b, c, d); quadraticCurveTo(a, b, c, d); },
      bezierCurveTo(a, b, c, d, e, f) { if (fb) return fb.bezierCurveTo(a, b, c, d, e, f); bezierCurveTo(a, b, c, d, e, f); },
      arc(x, y, r, s0, s1, ccw) { if (fb) return fb.arc(x, y, r, s0, s1, ccw); arc(x, y, r, s0, s1, ccw); },
      arcTo(a, b, c, d, r) { if (fb) return fb.arcTo(a, b, c, d, r); arcTo(a, b, c, d, r); },
      ellipse(x, y, rx, ry, rot, s0, s1, ccw) { if (fb) return fb.ellipse(x, y, rx, ry, rot, s0, s1, ccw); ellipse(x, y, rx, ry, rot, s0, s1, ccw); },
      rect(x, y, w, h) { if (fb) return fb.rect(x, y, w, h); rect(x, y, w, h); },
      roundRect(x, y, w, h, r) { if (fb) return fb.roundRect(x, y, w, h, r); roundRect(x, y, w, h, r); },
      fill(a1, a2) { if (a1 && typeof a1 === 'object') paintPath(false, a2 || 'nonzero', a1); else paintPath(false, a1 || null); },
      stroke(p) { paintPath(true, null, p && typeof p === 'object' ? p : null); },
      clip, fillRect, clearRect, strokeRect, drawImage,
      fillText(s, x, y, m) { paintText(false, s, x, y, m); }, strokeText(s, x, y, m) { paintText(true, s, x, y, m); }, measureText,
      setLineDash(a) { if (fb) return fb.setLineDash(a); if (!Array.isArray(a) || a.some((v) => !(v >= 0) || !Number.isFinite(v))) return; st.dash = a.length % 2 ? a.concat(a) : a.slice(); },
      getLineDash() { return fb ? fb.getLineDash() : st.dash.slice(); },
      createLinearGradient(x0, y0, x1, y1) { return keyed(probeCtx().createLinearGradient(x0, y0, x1, y1), 'L' + [x0, y0, x1, y1].join(',')); },
      createRadialGradient(x0, y0, r0, x1, y1, r1) { return keyed(probeCtx().createRadialGradient(x0, y0, r0, x1, y1, r1), 'G' + [x0, y0, r0, x1, y1, r1].join(',')); },
      createConicGradient(a, x, y) { return keyed(probeCtx().createConicGradient(a, x, y), 'N' + [a, x, y].join(',')); },
      createPattern(img, rep) { return probeCtx().createPattern(img, rep); },
      createImageData(a, b) { return probeCtx().createImageData(a, b); },
      getImageData(x, y, w, h) {
        if (fb) return fb.getImageData(x, y, w, h);
        begin(); flush();
        const out = new ImageData(w, h), buf = new Uint8Array(w * h * 4);
        gl.readPixels(x, H - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let r = 0; r < h; r++) for (let i = 0; i < w; i++) {
          const s = ((h - 1 - r) * w + i) * 4, o = (r * w + i) * 4, al = buf[s + 3];
          out.data[o + 3] = al; for (let k = 0; k < 3; k++) out.data[o + k] = al ? Math.min(255, Math.round((buf[s + k] * 255) / al)) : 0;
        }
        return out;
      },
      putImageData() { if (fb) return fb.putImageData.apply(fb, arguments); unsupported.add('putImageData'); },
      isPointInPath() { unsupported.add('isPointInPath'); return false; }, isPointInStroke() { unsupported.add('isPointInStroke'); return false; },
      drawFocusIfNeeded() {}, getContextAttributes() { return { alpha: true, desynchronized: false, colorSpace: 'srgb', willReadFrequently: false }; },
      // GL 전용
      flush() { if (!fb) { flush(); } },
      endFrame() { if (!fb) endFrame(); },
      glDebug(on) { const r = dbg; dbg = on ? [] : null; return r; },
      glStats() { return { ...stats, last: { ...last }, tex: texAll.size, texMB: +(texBytes / 1e6).toFixed(1), atlasRows: rows.length, atlasY: nextY, exact: exact.size, fam: fam.size, solo: solo.size, unsupported: [...unsupported], fallback: !!fb }; },
      glCanvas: view,
      blurCap: Infinity,
    };
    const prop = (name, get, set) => Object.defineProperty(api, name, { enumerable: true, configurable: true, get() { return fb ? fb[name] : get(); }, set(v) { if (fb) { fb[name] = name === 'shadowBlur' ? Math.min(v, api.blurCap) : v; return; } set(v); } });
    prop('canvas', () => opt.canvasProp || view, () => {});
    prop('globalAlpha', () => st.ga, (v) => { v = +v; if (v >= 0 && v <= 1) st.ga = v; });
    prop('globalCompositeOperation', () => st.op, (v) => {
      v = String(v);
      if (v in BL_IDX && !BLENDS[BL_IDX[v]][5]) { st.op = v; st.bl = BL_IDX[v]; return; }
      if (v in BL_IDX || BL_OTHER.has(v)) { if (!unsupported.has('gco:' + v)) unsupported.add('gco:' + v); st.op = v; st.bl = v in BL_IDX ? BL_IDX[v] : 0; }
    });
    prop('fillStyle', () => st.fill, (v) => { if (typeof v === 'string') { if (parseCol(v)) st.fill = v; } else if (v && typeof v === 'object' && (v instanceof CanvasGradient || v instanceof CanvasPattern)) st.fill = v; });
    prop('strokeStyle', () => st.stroke, (v) => { if (typeof v === 'string') { if (parseCol(v)) st.stroke = v; } else if (v && typeof v === 'object' && (v instanceof CanvasGradient || v instanceof CanvasPattern)) st.stroke = v; });
    prop('lineWidth', () => st.lw, (v) => { v = +v; if (v > 0 && Number.isFinite(v)) st.lw = v; });
    prop('lineCap', () => st.cap, (v) => { if (CAPS.has(v)) st.cap = v; });
    prop('lineJoin', () => st.join, (v) => { if (JOINS.has(v)) st.join = v; });
    prop('miterLimit', () => st.miter, (v) => { v = +v; if (v > 0 && Number.isFinite(v)) st.miter = v; });
    prop('lineDashOffset', () => st.dashOff, (v) => { v = +v; if (Number.isFinite(v)) st.dashOff = v; });
    prop('font', () => st.font, (v) => { v = String(v); if (validFont(v)) st.font = v; });
    prop('textAlign', () => st.align, (v) => { if (ALIGN.has(v)) st.align = v; });
    prop('textBaseline', () => st.base, (v) => { if (BASE.has(v)) st.base = v; });
    prop('direction', () => st.dir, (v) => { if (v === 'ltr' || v === 'rtl' || v === 'inherit') st.dir = v; });
    prop('letterSpacing', () => st.ls, (v) => { st.ls = String(v); });
    prop('shadowBlur', () => st.shBlur, (v) => { v = +v; if (v >= 0 && Number.isFinite(v)) st.shBlur = Math.min(v, api.blurCap); });
    prop('shadowColor', () => st.shCol, (v) => { if (typeof v !== 'string') return; const c = parseCol(v); if (c) { st.shCol = v; st.shA = c[3]; } });
    prop('shadowOffsetX', () => st.shX, (v) => { v = +v; if (Number.isFinite(v)) st.shX = v; });
    prop('shadowOffsetY', () => st.shY, (v) => { v = +v; if (Number.isFinite(v)) st.shY = v; });
    prop('filter', () => st.filter, (v) => { st.filter = String(v) || 'none'; });
    prop('imageSmoothingEnabled', () => st.smooth, (v) => { st.smooth = !!v; });
    prop('imageSmoothingQuality', () => st.smq, (v) => { if (v === 'low' || v === 'medium' || v === 'high') st.smq = v; });
    prop('fontKerning', () => 'auto', () => {});
    prop('textRendering', () => 'auto', () => {});
    prop('wordSpacing', () => '0px', () => {});
    track();
    return api;
  }

  // 이미 2D 컨텍스트가 있는 캔버스(ctx2d.canvas) 위에 WebGL 캔버스를 겹치고, ctx2d의 메서드·속성만 GL 쪽으로 바꿔 끼운다(측정·비교용).
  // 되돌리기: 돌려준 객체의 unpatch(). 실패하면 null.
  function patch(ctx2d, opt) {
    opt = opt || {};
    const base = ctx2d.canvas, gcv = document.createElement('canvas');
    gcv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    gcv.width = base.width; gcv.height = base.height;
    base.parentNode.insertBefore(gcv, base.nextSibling);
    let G = null;
    const unpatch = () => { Object.keys(G || {}).forEach((k) => { try { delete ctx2d[k]; } catch (e) { /* 없음 */ } }); gcv.remove(); };
    G = create(gcv, { sizeFrom: base, canvasProp: base, patched: true, onFallback: () => unpatch() });
    if (!G) { gcv.remove(); return null; }
    if (opt.blurCap !== undefined) G.blurCap = opt.blurCap;
    const desc = Object.getOwnPropertyDescriptors(G), own = {};
    for (const k in desc) if (k !== 'canvas') { const d = Object.getOwnPropertyDescriptor(ctx2d, k); if (d) own[k] = d; }
    // on(false): 2D로 잠시 되돌린다(GL 캔버스는 숨김), on(true): 다시 GL
    G.on = (v) => {
      for (const k in desc) {
        if (k === 'canvas') continue;
        if (v) Object.defineProperty(ctx2d, k, { ...desc[k], configurable: true });
        else { delete ctx2d[k]; if (own[k]) Object.defineProperty(ctx2d, k, own[k]); }
      }
      gcv.style.display = v ? '' : 'none';
      if (v) P2D.clearRect.call(ctx2d, 0, 0, base.width, base.height);
    };
    G.on(true);
    G.unpatch = () => { G.on(false); gcv.remove(); };
    return G;
  }

  root.RTD_GLCTX = { want, create, patch, unsupported };
})(typeof window !== 'undefined' ? window : globalThis);
