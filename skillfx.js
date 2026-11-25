// 스킬 이펙트와 6성 이상 후광. Kenney Particle Pack(CC0, gfx/kn_*.png)의 흰 그림을 스킬 색으로 물들여 겹쳐 그린다.
// 스킬마다 이름에 맞는 연출(vx)을 theme-samguk.js에서 붙인다. 그림이 아직 안 받아졌으면 false를 돌려 기존 연출로 그린다.
(function (root) {
  const KN = {}, TINT = {};
  const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const TMAX = COARSE ? 160 : 256, TINT_MAX = 90; let tintN = 0;
  const NAMES = ('circle_01 circle_02 circle_03 circle_05 light_01 light_02 light_03 magic_01 magic_02 magic_03 magic_04 magic_05 twirl_01 twirl_02 twirl_03 '
    + 'smoke_04 smoke_07 smoke_09 smoke_10 spark_01 spark_02 spark_05 spark_06 spark_07 slash_01 slash_03 slash_04 flame_01 flame_03 flame_05 flame_06 scratch_01 '
    + 'dirt_01 dirt_03 fire_01 fire_02 flare_01 muzzle_01 muzzle_02 muzzle_04 scorch_01 scorch_02 star_01 star_02 star_04 star_06 star_07 star_08 star_09 symbol_01 '
    + 'trace_01 trace_03 trace_05 trace_06').split(' ');
  // 장수 고유 연출에 쓰는 그림(2026-11-25): 무기·물건 그림(gfx/vs_*, Higgsfield 생성 — 평타 투사체·보스 연출과 같은 그림)은
  // 물들여 '기운으로 된 무기 그림자'로 쓰고(보스 연출의 칠한 그림과 구별), Kenney 폭발 프레임(kn_exp*)·연기 불길(kn_flame_02·04)도 쓴다.
  // 이것들은 없어도 연출이 깨지지 않게(그림이 아직 없으면 그 겹만 빠진다) 준비 확인(ready)에는 넣지 않는다.
  const EXTRA = ('vs_dagger vs_dao vs_ji vs_spear vs_spears vs_chev vs_shield vs_arrow vs_wisp vs_talisman vs_fireship vs_ring flame_02 flame_04 '
    + 'vs_streak vs_wind vs_crack vs_jian vs_guandao vs_fangtian vs_shemao vs_seal vs_lamp vs_chain vs_petal exp0 exp1 exp2 exp3 exp4 exp5 exp6 exp7 exp8').split(' ');
  const BASE = new Set(NAMES);
  let loaded = 0;
  function img(n) {
    let o = KN[n];
    if (!o) {
      o = KN[n] = { im: new Image(), ok: false }; o.im.onload = () => { o.ok = true; if (BASE.has(n)) loaded++; };
      o.im.src = n.startsWith('vs_') ? 'gfx/' + n + '.png?v=1' : 'gfx/kn_' + n + '.png?v=1';
    }
    return o.ok ? o.im : null;
  }
  if (typeof document !== 'undefined') { NAMES.forEach(img); EXTRA.forEach(img); }
  // 흰 그림을 색으로 물들인 캔버스(색마다 한 번만 만든다)
  function tint(n, col) {
    const k = n + col; if (TINT[k]) { const hit = TINT[k]; delete TINT[k]; TINT[k] = hit; return hit; } // 다시 넣어 최근 것으로
    const im = img(n); if (!im) return null;
    // 색마다 원본 크기로 저장하면 한 장에 1MB씩 끝없이 쌓여(스킬 색 × 입자 종류) 판이 길어질수록 그래픽 메모리가 차고 느려진다.
    // 화면에는 작게 그려지므로 줄여서 저장하고, 오래 안 쓴 것은 버린다.
    const s = Math.min(1, TMAX / Math.max(im.width, im.height));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * s)); cv.height = Math.max(1, Math.round(im.height * s));
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0, cv.width, cv.height); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
    if (++tintN > TINT_MAX) { const old = Object.keys(TINT)[0]; TINT[old].width = TINT[old].height = 0; delete TINT[old]; tintN--; }
    return (TINT[k] = cv);
  }
  // 가운데 기준으로 그린다. col이 없으면 흰색 그대로, add면 빛처럼 더한다, sy는 바닥에 눕히는 납작함
  function spr(c, n, col, x, y, w, h, rot, a, add, sy) {
    if (!(a > 0.01)) return true;
    const im = col ? tint(n, col) : img(n); if (!im) return false;
    // 돌리지 않는 그림(그림자·바닥 빛 등)은 상태 저장·변환 없이 바로 찍는다(같은 결과, 호출 수만 준다)
    if (!rot) {
      const ga = c.globalAlpha, go = c.globalCompositeOperation, k = sy || 1;
      if (add !== false) c.globalCompositeOperation = 'lighter';
      c.globalAlpha = Math.min(1, a); c.drawImage(im, x - w / 2, y - (h * k) / 2, w, h * k);
      c.globalAlpha = ga; c.globalCompositeOperation = go; return true;
    }
    c.save(); if (add !== false) c.globalCompositeOperation = 'lighter';
    c.globalAlpha = Math.min(1, a); c.translate(x, y); if (sy) c.scale(1, sy); if (rot) c.rotate(rot);
    c.drawImage(im, -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  const ready = (list) => list.every((n) => img(n));
  const ease = (p) => 1 - (1 - p) * (1 - p), cl = (v) => Math.max(0, Math.min(1, v)), bell = (p) => Math.sin(cl(p) * Math.PI);
  const WHITE = '#ffffff';
  // 지금 그리는 연출의 장수 등급(fx()가 정한다). 불멸(10)은 각 연출 안에서 재료를 키운다(공통 덧층은 두지 않는다).
  let TIER = 0;
  const IMM = () => TIER >= 10;
  // 무기·물건 그림(2026-11-25 art-director 검토 5-1): 칠한 원본을 앞에, 스킬 색으로 물들인 빛을 1.15배·투명도 0.5로 뒤에 깐다.
  // 흰 심(WHITE) 층은 두지 않는다(원본 디테일이 지워져 빛나는 막대가 된다). h를 비우면 그림 비율대로.
  function weap(c, n, col, x, y, w, h, rot, a) {
    if (!(a > 0.01)) return true;
    const im = img(n); if (!im) return false;
    if (h == null) h = w * im.height / im.width;
    if (col) spr(c, n, col, x, y, w * 1.15, h * 1.15, rot, a * 0.5);
    return spr(c, n, null, x, y, w, h, rot, a, false);
  }
  // 새 그림(vs_jian·vs_guandao·vs_fangtian·vs_shemao·vs_seal·vs_lamp, 2026-11-25 Canva)이 받아졌으면 그것을, 아직이면 기존 그림을 쓴다
  const pick = (a, b) => (img(a) ? a : b);
  // art.js의 그림: 법진(mc_rune1~3)·충격파(fxa_wave)·빛살 터짐(fxa_burst). 아직 없으면 Kenney 그림으로 대신한다.
  const ART = () => root.RTD_ART;
  function rune(c, n, col, x, y, s, rot, a, sy, fb) {
    const A = ART();
    if (A && A.fxPic(c, 'mc_rune' + n, x, y, s, s, rot, a, { col, sy })) return;
    if (fb) spr(c, fb, col, x, y, s, s, rot, a, true, sy);
  }
  function wave(c, col, x, y, s, q, a, sy) {
    if (q <= 0 || q >= 1) return;
    const A = ART();
    if (A && A.fxAnim(c, 'wave', q, x, y, s, s, 0, a, null, { col, sy })) return;
    spr(c, 'circle_02', col, x, y, s * q, s * q, 0, (1 - q) * a, true, sy);
  }
  let Q = 1; // 화질(낮음 0.5): 입자 수를 줄인다
  const N = (n) => Math.max(1, Math.round(n * Q));

  // ---- 직선 스킬(beam): x,y에서 a 방향으로 len, 폭 w ----
  const BEAM = {
    thrust(c, f, p) { // 창·돌격: 빛줄기가 뻗고 앞머리에 충격
      const head = ease(cl(p * 2.2)) * f.len, tail = cl((p - 0.35) / 0.65) * f.len, mid = (head + tail) / 2, L = Math.max(4, head - tail), fa = 1 - cl((p - 0.5) / 0.5);
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'trace_06', f.c, mid, 0, f.w * 1.8, L * 1.1, Math.PI / 2, fa);
      spr(c, 'trace_06', WHITE, mid, 0, f.w * 0.7, L, Math.PI / 2, fa * 0.8);
      spr(c, 'muzzle_02', f.c, head, 0, f.w * 2.2, f.w * 3.4, Math.PI / 2, fa);
      spr(c, 'star_08', WHITE, head, 0, f.w * 2.4, f.w * 2.4, p * 4, fa * 0.9);
      for (let i = 0; i < N(4); i++) spr(c, 'smoke_04', '#b8a890', tail + (head - tail) * (i / 4), (i % 2 ? 1 : -1) * f.w * 0.5, f.w * 1.6, f.w * 1.6, i, fa * 0.35, false);
      c.restore(); return true;
    },
    sword(c, f, p) { // 검기: 초승달 검기가 연달아 날아간다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let i = 0; i < 3; i++) {
        const q = cl(p * 1.5 - i * 0.18), d = ease(q) * f.len, a = bell(q);
        spr(c, 'slash_04', f.c, d, 0, f.w * 4, f.w * 4, Math.PI / 2, a);
        spr(c, 'slash_04', WHITE, d, 0, f.w * 3, f.w * 3, Math.PI / 2, a * 0.7);
      }
      spr(c, 'star_09', WHITE, f.len * ease(cl(p * 1.5)), 0, f.w * 3, f.w * 3, p * 3, bell(p) * 0.8);
      c.restore(); return true;
    },
    crescent(c, f, p) { // 청룡언월참: 커다란 초승달이 잔상을 끌며 나아간다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let i = 0; i < 5; i++) {
        const q = cl(p * 1.3 - i * 0.06), d = ease(q) * f.len, s = f.w * (3 + q * 2.2), a = bell(q) * (1 - i * 0.18);
        spr(c, 'slash_03', f.c, d, 0, s * 0.8, s * 1.4, 0, a);
        if (!i) {
          spr(c, 'slash_03', WHITE, d, 0, s * 0.6, s * 1.2, 0, a * 0.8);
          // 관우만의 표식: 초승달 참격 안쪽에 청룡언월도 그림자가 내려 긋는다
          weap(c, pick('vs_guandao', 'vs_dao'), f.c, d - s * 0.3, 0, s * 1.5, null, -Math.PI / 2 + q * 1.4, a * (1 - cl((p - 0.3) / 0.3)));
        }
      }
      c.restore(); return true;
    },
    throw(c, f, p) { // 축융부인 비도 연속 투척: 비도 그림이 불꼬리를 달고 줄지어 날아가 꽂히면 불씨가 튄다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let i = 0; i < N(6); i++) {
        const q = cl(p * 2.2 - i * 0.14), d = ease(q) * f.len, y = ((i * 37) % 7 - 3) * f.w * 0.09;
        if (q > 0 && q < 1) {
          spr(c, 'trace_01', '#ffb050', d - f.w * 0.6, y, f.w * 0.35, f.w * 1.6, Math.PI / 2, 0.9);
          if (!spr(c, 'vs_dagger', null, d, y, f.w * 1.1, f.w * 0.22, 0, 1, false)) spr(c, 'trace_01', f.c, d, y, f.w * 0.5, f.w * 2.6, Math.PI / 2, 1);
        } else if (q >= 1) spr(c, 'flame_05', f.c, f.len, y - 10, f.w * 0.6, f.w * 1.1, 0, 1 - cl((p - 0.45 - i * 0.06) * 3));
      }
      c.restore(); return true;
    },
    fireline(c, f, p) { // 화공: 길을 따라 불길이 차례로 솟는다
      const n = Math.max(4, Math.round(f.len / 70)), head = ease(cl(p * 1.8)) * f.len;
      for (let i = 0; i < N(n); i++) {
        const d = (i + 0.5) * (f.len / N(n)); if (d > head) break;
        const age = cl((p - (d / f.len) / 1.8) / 0.6), x = f.x + Math.cos(f.a) * d, y = f.y + Math.sin(f.a) * d, s = f.w * (1.1 + bell(age) * 0.9);
        spr(c, 'fire_01', f.c, x, y, s * 1.6, s * 1.6, i, bell(age) * 0.8);
        spr(c, i % 2 ? 'flame_05' : 'flame_06', '#ffd080', x, y - s * 0.7, s * 0.9, s * 1.8, 0, bell(age));
        spr(c, 'smoke_04', '#3a2418', x, y - s * 1.5 - age * 40, s * 1.5, s * 1.5, i, age * 0.4, false);
      }
      return true;
    },
    windfire(c, f, p) { // 동남풍: 소용돌이 바람이 불씨를 싣고 나아간다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let i = 0; i < N(4); i++) {
        const q = cl(p * 1.4 - i * 0.1), d = ease(q) * f.len, a = bell(q);
        spr(c, ['twirl_01', 'twirl_02', 'twirl_03'][i % 3], f.c, d, 0, f.w * 3.2, f.w * 3.2, -p * 14 - i, a);
        spr(c, 'flame_05', '#ffb050', d - f.w * 0.6, (i % 2 ? 1 : -1) * f.w * 0.5, f.w * 0.6, f.w * 1.1, -Math.PI / 2, a * 0.8);
      }
      c.restore(); return true;
    },
    thunderline(c, f, p) { // 천공 뇌진: 번개가 길을 따라 내리꽂힌다
      const fl = Math.random() < 0.5, fa = 1 - cl((p - 0.4) / 0.6);
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'spark_07', f.c, f.len / 2, 0, f.len, f.w * 2.2, 0, fa);
      spr(c, 'spark_07', WHITE, f.len / 2, 0, f.len, f.w * 1.1, fl ? Math.PI : 0, fa * 0.9);
      c.restore();
      for (let i = 0; i < N(4); i++) {
        const d = f.len * (i + 0.5) / 4, x = f.x + Math.cos(f.a) * d, y = f.y + Math.sin(f.a) * d, q = cl(p * 3 - i * 0.3);
        spr(c, (i + (fl ? 1 : 0)) % 2 ? 'spark_05' : 'spark_06', '#fff8c0', x, y - 110, 80, 240, 0, bell(q));
        spr(c, 'flare_01', WHITE, x, y, 120, 120, 0, bell(q));
      }
      return true;
    },
    // ---- 장수 고유(2026-11-25). 무기 그림(vs_*)은 물들인 그림자로 그린다: 칠한 그림은 보스 연출에 쓰여 위험 표시와 헷갈린다 ----
    heavensword(c, f, p) { // 조조 의천검: 거대한 검 그림자가 곧게 찔러 나가고 끝에서 십자 별이 번쩍
      const q = ease(cl(p * 2.6)), d = q * f.len, fa = 1 - cl((p - 0.55) / 0.45), L = f.w * 4.2;
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'trace_06', f.c, d * 0.5, 0, f.w * 1.1, Math.max(4, d), Math.PI / 2, fa * 0.6);
      weap(c, pick('vs_jian', 'vs_dagger'), f.c, d - L * 0.4, 0, L, null, 0, fa);
      const im = IMM() ? 1.3 : 1; // 불멸: 착탄 재료(십자 별)만 키운다(검토 4-2)
      spr(c, 'star_08', WHITE, d, 0, f.w * 2.6 * im, f.w * 2.6 * im, p * 2, bell(cl((p - 0.25) / 0.6)));
      c.restore(); return true;
    },
    ironcav(c, f, p) { // 마초 서량 철기 돌격: 창 대열 세 줄이 흙먼지를 끌고 달려 나간다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let i = 0; i < 3; i++) {
        const q = cl(p * 2 - i * 0.12), d = ease(q) * f.len, al = Math.min(1, bell(q) * 1.3), y = (i - 1) * f.w * 0.42, L = f.w * 1.7;
        spr(c, 'smoke_04', '#d8c090', d - L * 0.9, y, f.w * 0.9, f.w * 0.9, i + p * 2, al * 0.45, false);
        weap(c, 'vs_spears', f.c, d - L * 0.3, y, L, null, 0, al);
      }
      c.restore(); return true;
    },
    royalstrike(c, f, p) { // 손권 합비의 일격: 세 번 끊어 내딛는 붉은 충격, 마지막이 가장 크다
      const A = ART();
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'trace_06', f.c, f.len * 0.5, 0, f.w * 0.8, f.len, Math.PI / 2, (1 - p) * 0.4);
      for (let i = 0; i < 3; i++) {
        const q = cl((p - i * 0.18) / 0.42); if (q <= 0 || q >= 1) continue;
        const d = f.len * (0.4 + i * 0.3), s = f.w * (1.4 + i * 0.8) * (IMM() && i === 2 ? 1.3 : 1);
        spr(c, 'muzzle_02', f.c, d - s * 0.3, 0, s * 0.9, s * 1.5, Math.PI / 2, 1 - q);
        // 내딛는 자리마다 작은 폭발(kn_exp 2~4번 프레임)과 금빛 불티(검토 1-2: 손권 = 진홍과 금)
        if (!spr(c, 'exp' + (2 + Math.min(2, Math.floor(q * 3))), null, d, 0, s * 1.1, s * 1.1, 0, (1 - q) * 1.2)) { if (!(A && A.fxAnim(c, 'hit', q, d, 0, s * 1.7, s * 1.7, 0, 1))) spr(c, 'star_08', WHITE, d, 0, s, s, q * 2, 1 - q); }
        for (let j = 0; j < N(4); j++) { const a = j * 1.6 + i; spr(c, 'star_04', '#ffd060', d + Math.cos(a) * s * 0.5 * q, Math.sin(a) * s * 0.5 * q, s * 0.3, s * 0.3, 0, 1 - q); }
      }
      c.restore(); return true;
    },
    breakout(c, f, p) { // 태사자 단기 포위 돌파: 쌍극이 앞장서고 길 위 세 곳에서 차례로 타격이 터진다
      const A = ART(), head = ease(cl(p * 2.4)) * f.len, fa = 1 - cl((p - 0.45) / 0.3), L = f.w * 1.5;
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'trace_06', f.c, head / 2, 0, f.w * 1.1, Math.max(4, head), Math.PI / 2, 1 - cl((p - 0.4) / 0.6));
      for (let i = 0; i < 3; i++) {
        const d = f.len * (0.3 + i * 0.3), q = cl((p - d / f.len / 2.4) / 0.35); if (q <= 0 || q >= 1) continue;
        const y = (i % 2 ? 1 : -1) * f.w * 0.35, s = f.w * 2 * (IMM() ? 1.3 : 1);
        if (!(A && A.fxAnim(c, 'hit2', q, d, y, s, s, i, 1))) spr(c, 'star_04', WHITE, d, y, s, s, i, 1 - q);
      }
      weap(c, 'vs_spear', f.c, head - L * 0.3, -f.w * 0.18, L, null, 0.12, fa);
      weap(c, 'vs_spear', f.c, head - L * 0.3, f.w * 0.18, L, null, -0.12, fa);
      c.restore(); return true;
    },
    surge(c, f, p) { // 손책 패왕 돌격: 창끝이 물살을 가르며 지나간 자리에 물결 고리가 남는다
      const head = ease(cl(p * 2.2)) * f.len, n = N(5), fa = 1 - cl((p - 0.5) / 0.4), L = f.w * 2;
      for (let i = 0; i < n; i++) {
        const d = f.len * (i + 0.5) / n; if (d > head) break;
        const wq = cl(p * 1.6 - (d / f.len) / 1.4), wx = f.x + Math.cos(f.a) * d, wy = f.y + Math.sin(f.a) * d;
        wave(c, f.c, wx, wy + 10, f.w * (2.2 + i * 0.25), wq, 0.9, 0.45);
        spr(c, 'smoke_04', WHITE, wx, wy - wq * 24, f.w * 1.2, f.w * 1.2, i + p, bell(wq) * 0.5, false); // 흰 물보라(강동의 강)
      }
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'muzzle_02', f.c, head, 0, f.w * 1.6, f.w * 2.6, Math.PI / 2, fa);
      weap(c, 'vs_spear', f.c, head - L * 0.4, 0, L, null, 0, fa);
      c.restore(); return true;
    },
    redhare(c, f, p) { // 여포 적토 돌진: 붉은 질주 자국 위로 말발굽 흙먼지가 박자 맞춰 튄다
      const head = ease(cl(p * 2.4)) * f.len, fa = 1 - cl((p - 0.45) / 0.5);
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'trace_06', f.c, head / 2, 0, f.w * 1.6, Math.max(4, head), Math.PI / 2, fa * 0.8);
      spr(c, 'scorch_02', '#2a0a04', head * 0.5, 0, f.w * 0.8, Math.max(4, head), Math.PI / 2, fa * 0.4, false);
      // 불티(보스 여포의 흙먼지 dustline과 구별, 검토 3-3f)
      for (let i = 0; i < N(6); i++) { const d = head * (i + 0.5) / 6, k = cl(p * 2.4 - (d / f.len)); spr(c, 'flame_05', '#ffb060', d, (i % 2 ? 1 : -1) * f.w * 0.3 - k * 20, f.w * 0.35, f.w * 0.6, -Math.PI / 2, fa * bell(k) * 0.9); }
      // 적토마 불꼬리: vs_streak 원본을 굵게(f.w×2)
      const Ls = Math.min(head, f.w * 4.5); if (Ls > 8) spr(c, 'vs_streak', null, head - Ls / 2, 0, Ls, f.w * 2, 0, fa, true);
      const im = IMM() ? 1.3 : 1;
      spr(c, 'flare_01', '#ffd0b0', head, 0, f.w * 2.2 * im, f.w * 2.2 * im, 0, fa);
      c.restore(); return true;
    },
    comet(c, f, p) { // 조운 단기 돌파: 은빛 혜성 머리와 일곱 잔상 별(칠진칠출)
      const head = ease(cl(p * 2.6)) * f.len, fa = 1 - cl((p - 0.4) / 0.6);
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'trace_05', f.c, head / 2, 0, f.w * 0.9, Math.max(4, head), Math.PI / 2, fa * 0.9);
      for (let i = 0; i < N(7); i++) { const d = head * (1 - (i + 1) / 8), s = f.w * (0.9 - i * 0.08); spr(c, 'star_04', i % 2 ? WHITE : f.c, d, Math.sin(i * 1.7) * f.w * 0.25, s, s, 0, fa * (1 - i / 8)); }
      spr(c, 'light_01', f.c, head, 0, f.w * 2.2, f.w * 2.2, 0, fa * 0.8);
      spr(c, 'star_08', WHITE, head, 0, f.w * 2.6, f.w * 2.6, p * 6, fa);
      c.restore(); return true;
    },
    snakespear(c, f, p) { // 장비 사모 돌격: 장팔사모 그림자가 구불구불한 뱀 꼬리를 끌고 찌른다
      const head = ease(cl(p * 2.3)) * f.len, fa = 1 - cl((p - 0.45) / 0.5), L = f.w * 2.6;
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let i = 0; i < N(8); i++) { const d = head * (i + 0.5) / 8, ph = i * 1.3 - p * 12; spr(c, 'trace_03', f.c, d, Math.sin(ph) * f.w * 0.35, f.w * 0.5, Math.max(4, head / 6), Math.PI / 2 + Math.cos(ph) * 0.5, fa * 0.8); }
      const sm = img('vs_shemao'), SL = sm ? L * 1.3 : L; // 장팔사모 그림은 아주 가늘어(380×20) 길이 1.3배·두께 1.4배로
      weap(c, sm ? 'vs_shemao' : 'vs_spear', f.c, head - SL * 0.35, 0, SL, sm ? SL * sm.height / sm.width * 1.4 : null, 0, fa);
      c.restore(); return true;
    },
    fireship(c, f, p) { // 주유 적벽 화공: 불붙은 배가 불꼬리를 끌며 나아간다(배는 뒤집히지 않게 좌우만 돌린다)
      const head = ease(cl(p * 1.7)) * f.len, fa = 1 - cl((p - 0.6) / 0.4), ca = Math.cos(f.a), sa = Math.sin(f.a), S = f.w * 1.9;
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'trace_06', f.c, head / 2, 0, f.w * 1.2, Math.max(4, head), Math.PI / 2, fa * 0.7);
      for (let i = 0; i < N(5); i++) { const d = head - S * 0.3 - i * S * 0.35; if (d < 0) break; spr(c, i % 2 ? 'flame_05' : 'flame_06', '#ffc060', d, (i % 2 ? 1 : -1) * f.w * 0.25, f.w * 0.5, f.w, -Math.PI / 2, fa * (1 - i * 0.15)); }
      c.restore();
      const x = f.x + ca * head, y = f.y + sa * head;
      spr(c, 'light_01', f.c, x, y + 10, S * 1.7, S * 1.7, 0, fa * 0.7);
      const im = img('vs_fireship');
      if (im && fa > 0.01) {
        const ga = c.globalAlpha; c.save(); c.globalAlpha = fa; c.translate(x, y - S * 0.2); if (ca < 0) c.scale(-1, 1);
        c.drawImage(im, -S / 2, -S * 0.35, S, S * 0.7); c.restore(); c.globalAlpha = ga;
      }
      spr(c, 'fire_01', '#ffb050', x, y - S * 0.35, S * 0.8 * (IMM() ? 1.3 : 1), S * 0.8 * (IMM() ? 1.3 : 1), p * 3, fa * 0.8);
      return true;
    },
    halberds(c, f, p) { // 전위 단극 투척: 짧은 극 세 자루가 돌며 날아가 꽂힌다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let i = 0; i < N(3); i++) {
        const q = cl((p - i * 0.12) / 0.45), d = ease(q) * f.len, y = (i - 1) * f.w * 0.3, L = f.w * 1.2;
        if (q > 0 && q < 1) weap(c, 'vs_ji', f.c, d, y, L, null, q * 14, 1);
        else if (q >= 1) spr(c, 'star_04', WHITE, f.len, y, f.w * 1.6, f.w * 1.6, i, 1 - cl((p - i * 0.12 - 0.45) * 4));
      }
      c.restore(); return true;
    },
    mountain(c, f, p) { // 등애 음평 강행: 험한 산길을 뚫고 가는 흙·돌가루 줄
      const head = ease(cl(p * 2)) * f.len, n = N(6), ca = Math.cos(f.a), sa = Math.sin(f.a), fa = 1 - cl((p - 0.5) / 0.5);
      for (let i = 0; i < n; i++) {
        const d = (i + 0.5) * f.len / n; if (d > head) break;
        const age = cl((p - (d / f.len) / 2) / 0.6), x = f.x + ca * d, y = f.y + sa * d;
        spr(c, 'smoke_04', '#a89a88', x, y - age * 30, f.w * 1.4, f.w * 1.4, i + p, bell(age) * 0.5, false);
        spr(c, 'dirt_01', '#8a7a68', x, y - age * 20, f.w * 1.3, f.w * 1.3, i, bell(age), false);
      }
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      spr(c, 'trace_06', f.c, head / 2, 0, f.w * 0.8, Math.max(4, head), Math.PI / 2, fa);
      spr(c, 'muzzle_02', f.c, head, 0, f.w * 1.4, f.w * 2.2, Math.PI / 2, fa);
      c.restore(); return true;
    },
  };

  // ---- 부채꼴(cone): x,y에서 a 방향, 반지름 r, 각도 arc ----
  const CONE = {
    arrows(c, f, p) { // 화살 일제사
      const n = N(10);
      for (let i = 0; i < n; i++) {
        const ai = f.a - f.arc / 2 + f.arc * (i + 0.5) / n, q = cl(p * 1.8 - (i % 3) * 0.1), d = ease(q) * f.r;
        const x = f.x + Math.cos(ai) * d, y = f.y + Math.sin(ai) * d;
        if (q < 1) spr(c, 'trace_05', f.c, x, y, 10, 60, ai + Math.PI / 2, 1);
        else spr(c, 'star_04', WHITE, x, y, 40, 40, i, 1 - cl((p - 0.55) * 3));
      }
      return true;
    },
    claw(c, f, p) { // 맹수 돌격: 커다란 할퀸 자국과 흙먼지
      const x = f.x + Math.cos(f.a) * f.r * 0.55, y = f.y + Math.sin(f.a) * f.r * 0.55, s = f.r * (0.8 + ease(cl(p * 2)) * 0.5);
      spr(c, 'scratch_01', f.c, x, y, s, s, f.a, bell(cl(p * 1.4)));
      spr(c, 'scratch_01', WHITE, x, y, s * 0.8, s * 0.8, f.a, bell(cl(p * 1.4)) * 0.6);
      for (let i = 0; i < N(3); i++) spr(c, 'dirt_01', '#9a7a5a', x + Math.cos(f.a + i) * 40, y + Math.sin(f.a + i) * 40, s * 0.5, s * 0.5, i, (1 - p) * 0.6, false);
      return true;
    },
    blades(c, f, p) { // 난무: 검·창의 호가 겹겹이 휩쓴다
      for (let i = 0; i < N(4); i++) {
        const q = cl(p * 1.6 - i * 0.12), rr = f.r * (0.35 + i * 0.18), sw = (q - 0.5) * f.arc * 0.8 * (i % 2 ? -1 : 1);
        const x = f.x + Math.cos(f.a + sw) * rr, y = f.y + Math.sin(f.a + sw) * rr;
        spr(c, 'slash_01', f.c, x, y, rr * 1.2, rr * 0.8, f.a + sw - Math.PI / 2, bell(q));
        spr(c, 'slash_01', WHITE, x, y, rr * 0.9, rr * 0.55, f.a + sw - Math.PI / 2, bell(q) * 0.6);
      }
      return true;
    },
    charge(c, f, p) { // 기병 돌격: 흙먼지가 부채꼴로 퍼지고 앞줄에 충격
      for (let i = 0; i < N(6); i++) {
        const ai = f.a - f.arc / 2 + f.arc * (i + 0.5) / 6, d = ease(cl(p * 1.5)) * f.r * (0.6 + (i % 2) * 0.3);
        spr(c, 'smoke_04', '#c8b090', f.x + Math.cos(ai) * d, f.y + Math.sin(ai) * d, f.r * 0.45, f.r * 0.45, i + p, (1 - p) * 0.55, false);
      }
      const x = f.x + Math.cos(f.a) * f.r * ease(cl(p * 1.5)), y = f.y + Math.sin(f.a) * f.r * ease(cl(p * 1.5));
      spr(c, 'slash_04', f.c, x, y, f.r * 0.9, f.r * 0.9, f.a + Math.PI / 2, bell(p));
      return true;
    },
    // ---- 장수 고유(2026-11-25) ----
    tigercav(c, f, p) { // 조조 호표기 돌격: 쐐기 대형(1·3·5) 화살촉 무늬가 차례로 밀고 나간다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let i = 0; i < 3; i++) {
        const q = cl(p * 1.7 - i * 0.12), d = ease(q) * f.r * (0.9 - i * 0.18), al = bell(q), m = i * 2 + 1, s = f.r * 0.16;
        spr(c, 'smoke_04', '#c8b090', d - s * 1.2, 0, s * (2 + i), s * (2 + i), i + p, al * 0.4, false);
        for (let j = 0; j < m; j++) { const off = (j - (m - 1) / 2) * s * 0.9; spr(c, 'vs_chev', f.c, d - Math.abs(off) * 0.6, off, s, s, 0, al); }
      }
      c.restore(); return true;
    },
    twinsword(c, f, p) { // 유비 쌍고검: 검 그림자 두 자루가 엇갈려 X자로 벤다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let k = 0; k < 2; k++) {
        const sg = k ? -1 : 1, q = cl((p - k * 0.1) / 0.55), sw = (0.5 - ease(q)) * f.arc * 1.2 * sg, L = f.r * 0.75, d = f.r * 0.45, al = bell(q);
        spr(c, 'slash_01', f.c, Math.cos(sw) * f.r * 0.6, Math.sin(sw) * f.r * 0.6, f.r * 0.9, f.r * 0.55, sw - Math.PI / 2, al * 0.8);
        weap(c, pick('vs_jian', 'vs_dagger'), f.c, Math.cos(sw) * d, Math.sin(sw) * d, L, null, sw, al);
      }
      spr(c, 'star_08', WHITE, f.r * 0.6, 0, f.r * 0.6 * (IMM() ? 1.3 : 1), f.r * 0.6 * (IMM() ? 1.3 : 1), p * 3, bell(cl((p - 0.25) / 0.4)));
      c.restore(); return true;
    },
    spearfan(c, f, p) { // 조인 철기 반격: 창 다섯 자루가 부채꼴로 한꺼번에 내질렀다 거둔다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      const n = N(5), k = bell(cl(p * 1.4)), L = f.r * 0.55;
      for (let i = 0; i < n; i++) {
        const ai = -f.arc / 2 + f.arc * (i + 0.5) / n, d = f.r * (0.25 + k * 0.5);
        weap(c, 'vs_spear', f.c, Math.cos(ai) * d, Math.sin(ai) * d, L, null, ai, k);
        spr(c, 'muzzle_02', f.c, Math.cos(ai) * (d + L * 0.5), Math.sin(ai) * (d + L * 0.5), 30, 50, ai + Math.PI / 2, k * 0.8);
      }
      c.restore(); return true;
    },
    divinebow(c, f, p) { // 태사자 신궁 연사: 빛 화살 다섯 발이 좁게 차례로 날아가 꽂힌다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      const n = N(5);
      for (let i = 0; i < n; i++) {
        const q = cl((p - i * 0.1) / 0.35), ai = (i - (n - 1) / 2) * f.arc * 0.12, d = ease(q) * f.r, ca = Math.cos(ai), sa = Math.sin(ai);
        if (q > 0 && q < 1) {
          spr(c, 'trace_06', f.c, ca * (d - 60), sa * (d - 60), 14, 120, ai + Math.PI / 2, 0.8);
          weap(c, 'vs_arrow', f.c, ca * d, sa * d, 110, null, ai, 1);
        } else if (q >= 1) spr(c, 'star_08', WHITE, ca * f.r, sa * f.r, 60 * (IMM() ? 1.3 : 1), 60 * (IMM() ? 1.3 : 1), i, 1 - cl((p - i * 0.1 - 0.35) * 4));
      }
      c.restore(); return true;
    },
    repeater(c, f, p) { // 황월영 연노 일제사: 평행한 화살 줄이 세 물결로 나간다(연노 톱니 법진)
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let w = 0; w < 3; w++) {
        const q = cl((p - w * 0.15) / 0.45); if (q <= 0) continue;
        for (let j = 0; j < N(4); j++) {
          const y = (j - 1.5) * f.r * 0.09;
          if (q < 1) spr(c, 'trace_01', f.c, ease(q) * f.r, y, 8, 46, Math.PI / 2, 1);
          else spr(c, 'star_04', WHITE, f.r, y, 30, 30, j, 1 - cl((p - w * 0.15 - 0.45) * 4));
        }
      }
      rune(c, 2, f.c, 0, 0, 80, p * 6, bell(p) * 0.8, 0, 'magic_03');
      c.restore(); return true;
    },
  };

  // ---- 지점 폭발(blast): 원 스킬이 터질 때, 보스에게 거는 스킬 ----
  const rings = (c, f, p, n, col, w) => { for (let i = 0; i < n; i++) { const q = cl(p * 1.4 - i * 0.15); spr(c, 'circle_02', col, f.x, f.y, f.r * (0.5 + ease(q) * 1.6) * 2, f.r * (0.5 + ease(q) * 1.6) * 2 * (w || 1), 0, (1 - q) * 0.9); } };
  const BLAST = {
    burst(c, f, p) { spr(c, 'light_01', f.c, f.x, f.y, f.r * 2.4, f.r * 2.4, 0, 1 - p); spr(c, 'star_09', WHITE, f.x, f.y, f.r * 1.6, f.r * 1.6, p, bell(cl(p * 2))); rings(c, f, p, 2, f.c); return true; },
    feint(c, f, p) { // 성동격서: 연막이 터지고 빛이 번쩍
      spr(c, 'smoke_09', '#c8c8d8', f.x, f.y, f.r * (1.4 + p * 1.2) * 2, f.r * (1.4 + p * 1.2) * 2, p, (1 - p) * 0.7, false);
      spr(c, 'star_09', f.c, f.x, f.y, f.r * 1.8, f.r * 1.8, 0, bell(cl(p * 2.5)));
      rings(c, f, p, 1, f.c); return true;
    },
    rune(c, f, p) { // 진법·계략: 법진이 돌며 조여 들고 빛이 터진다
      const s = f.r * 2.4 * (1.2 - ease(cl(p * 1.5)) * 0.3);
      rune(c, 1, f.c, f.x, f.y, s, p * 3, 1 - p, 0.7, 'magic_01');
      rune(c, 3, f.c, f.x, f.y, s * 0.75, -p * 4, 1 - p, 0.7, 'magic_02');
      spr(c, 'light_03', f.c, f.x, f.y, f.r * 2.6, f.r * 2.6, 0, bell(cl(p * 2)) * 0.9);
      spr(c, 'star_07', WHITE, f.x, f.y, f.r * 1.4, f.r * 1.4, 0, bell(cl(p * 3)));
      return true;
    },
    miasma(c, f, p) { // 이간계: 독기 어린 연기가 소용돌이친다
      for (let i = 0; i < N(3); i++) spr(c, 'smoke_07', f.c, f.x + Math.cos(i * 2.1 + p * 3) * f.r * 0.4, f.y + Math.sin(i * 2.1 + p * 3) * f.r * 0.3, f.r * (1.4 + p), f.r * (1.4 + p), p * 2 + i, (1 - p) * 0.75);
      spr(c, 'twirl_02', f.c, f.x, f.y, f.r * 2, f.r * 2, -p * 8, bell(p));
      return true;
    },
    fireblast(c, f, p) { // 화염 폭발: 불덩이, 그을음, 검은 연기
      spr(c, 'scorch_01', '#2a1408', f.x, f.y, f.r * 2.2, f.r * 2.2, 0, (1 - p) * 0.6, false);
      spr(c, 'fire_01', f.c, f.x, f.y, f.r * (1.6 + p * 1.2) * 1.4, f.r * (1.6 + p * 1.2) * 1.4, p, 1 - p);
      spr(c, 'fire_02', '#fff0a0', f.x, f.y, f.r * (1 + p) * 1.2, f.r * (1 + p) * 1.2, -p, (1 - p) * 0.9);
      spr(c, 'smoke_10', '#3a2a20', f.x, f.y - p * 40, f.r * (2 + p * 1.5), f.r * (2 + p * 1.5), p, p * (1 - p) * 1.6, false);
      for (let i = 0; i < N(6); i++) { const a = i * 1.05, d = f.r * (0.4 + p * 1.1); spr(c, 'flame_05', '#ffc060', f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - p * 30, 26, 46, 0, 1 - p); }
      return true;
    },
    shock(c, f, p) { // 대갈·호통: 충격파 고리와 흙먼지
      rings(c, f, p, 3, f.c);
      spr(c, 'dirt_03', '#a08060', f.x, f.y, f.r * 2.2, f.r * 2.2, 0, (1 - p) * 0.6, false);
      spr(c, 'light_01', WHITE, f.x, f.y, f.r * 1.4, f.r * 1.4, 0, bell(cl(p * 3)) * 0.7);
      return true;
    },
    quake(c, f, p) { // 압살: 땅이 꺼지고 흙먼지 고리
      spr(c, 'scorch_02', '#1a0c08', f.x, f.y, f.r * 2.4, f.r * 2.4, 0, (1 - p) * 0.8, false);
      spr(c, 'dirt_03', '#7a5a3a', f.x, f.y, f.r * (1.6 + p) * 1.4, f.r * (1.6 + p) * 1.4, p, 1 - p, false);
      spr(c, 'smoke_10', '#8a6a50', f.x, f.y, f.r * (2 + p * 1.6), f.r * (2 + p * 1.6), 0, (1 - p) * 0.7, false);
      rings(c, f, p, 2, f.c, 0.6); return true;
    },
    petals(c, f, p) { // 초선 연무: 꽃잎(vs_petal 원본)이 소용돌이치며 흩날리고 연분홍 비단 궤적 네 줄이 춤춘다(하트 없음, 미인계와 구별 — 검토 1-10)
      const out = 1 - cl((p - 0.6) / 0.4);
      for (let i = 0; i < 4; i++) { // 비단 궤적
        const a = p * 7 + i * Math.PI / 2, rr = f.r * (0.55 + 0.25 * Math.sin(p * 5 + i));
        spr(c, 'slash_01', f.c, f.x + Math.cos(a) * rr, f.y - 20 + Math.sin(a) * rr * 0.55, f.r * 1.1, f.r * 0.5, a + Math.PI / 2, bell(cl(p * 1.3 - i * 0.06)) * 0.9);
      }
      for (let i = 0; i < N(9); i++) { // 꽃잎 묶음
        const a = i * 0.7 + p * 4 * (i % 2 ? 1 : -1), d = f.r * (0.2 + ease(p) * (0.8 + (i % 3) * 0.2)), S = 44 + (i % 3) * 14;
        const x = f.x + Math.cos(a) * d, y = f.y - 20 + Math.sin(a) * d * 0.6 - p * 40 + Math.sin(p * 9 + i) * 10;
        if (!weap(c, 'vs_petal', null, x, y, S, null, a * 0.8, out * Math.min(1, p * 8))) spr(c, 'star_06', f.c, x, y, 26, 26, a, out);
      }
      return true;
    },
    flood(c, f, p) { // 수엄칠군: 물기둥과 물결 고리
      spr(c, 'light_03', f.c, f.x, f.y, f.r * 2.6, f.r * 2.6, 0, bell(cl(p * 1.5)));
      for (let i = 0; i < 3; i++) { const q = cl(p * 1.3 - i * 0.15); spr(c, 'circle_03', f.c, f.x, f.y, f.r * (0.6 + q * 1.8) * 2, f.r * (0.6 + q * 1.8) * 2, 0, (1 - q) * 0.8, true, 0.55); }
      for (let i = 0; i < N(5); i++) spr(c, 'smoke_07', '#d8f0ff', f.x + (i - 2) * f.r * 0.35, f.y - bell(p) * f.r * 0.8, f.r * 0.7, f.r * 1.2, 0, bell(p) * 0.5);
      return true;
    },
    lightning(c, f, p) { // 낙뢰: 하늘에서 벼락이 내리꽂힌다
      const fl = Math.random() < 0.5;
      for (let i = 0; i < N(3); i++) { const ox = (i - 1) * f.r * 0.5, q = cl(p * 3 - i * 0.25); spr(c, (i + (fl ? 1 : 0)) % 2 ? 'spark_05' : 'spark_06', '#fff8c0', f.x + ox, f.y - f.r * 1.2, f.r * 0.7, f.r * 2.6, 0, bell(q)); }
      spr(c, 'flare_01', WHITE, f.x, f.y, f.r * 2.4, f.r * 2.4, 0, bell(cl(p * 2)));
      spr(c, 'spark_02', f.c, f.x, f.y, f.r * 1.8, f.r * 1.8, fl ? 1 : 0, 1 - p);
      rings(c, f, p, 1, f.c); return true;
    },
    storm(c, f, p) { // 무쌍 난무: 사방으로 휘두르는 참격
      for (let i = 0; i < N(8); i++) { const a = i * 0.785 + p * 6, d = f.r * (0.4 + (i % 2) * 0.3); spr(c, 'slash_01', f.c, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, f.r * 1.1, f.r * 0.7, a - Math.PI / 2, bell(cl(p * 1.4 - (i % 3) * 0.1))); }
      spr(c, 'star_09', WHITE, f.x, f.y, f.r * 1.6, f.r * 1.6, p * 2, bell(cl(p * 2)));
      return true;
    },
    roar(c, f, p) { // 호통: 음파 고리와 사방으로 뻗는 기세
      rings(c, f, p, 3, f.c);
      for (let i = 0; i < N(8); i++) { const a = i * 0.785, d = f.r * (0.6 + ease(p)); spr(c, 'muzzle_01', f.c, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 40, 80, a + Math.PI / 2, (1 - p) * 0.9); }
      return true;
    },
    scheme(c, f, p) { // 반간계: 보스 위로 계략의 법진이 감긴다
      rune(c, 3, f.c, f.x, f.y, f.r * 2.2, -p * 4, 1 - p, 0.6, 'magic_02');
      spr(c, 'twirl_03', f.c, f.x, f.y - 40, f.r * 1.6, f.r * 1.6, p * 9, bell(p));
      spr(c, 'magic_04', WHITE, f.x, f.y - 60, f.r, f.r, p * 3, bell(cl(p * 2)) * 0.8);
      return true;
    },
    hearts(c, f, p) { // 미인계: 하트가 쏟아지고 분홍빛이 감싼다
      spr(c, 'light_02', f.c, f.x, f.y, f.r * 2.6, f.r * 2.6, p, bell(p));
      for (let i = 0; i < N(12); i++) { const a = i * 0.52, d = f.r * (1.4 - ease(p) * 0.9), s = 28 + (i % 3) * 10; spr(c, 'symbol_01', i % 2 ? f.c : '#ffd0ea', f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.8 - 30, s, s, 0, bell(cl(p * 1.3 - (i % 4) * 0.05))); }
      return true;
    },
    curse(c, f, p) { // 약화: 보랏빛 저주 법진과 어두운 기운
      spr(c, 'smoke_09', '#40205a', f.x, f.y, f.r * 2.4, f.r * 2.4, p * 2, (1 - p) * 0.7, false);
      rune(c, 1, f.c, f.x, f.y, f.r * 2.4 * (1 - p * 0.3), p * 5, 1 - p, 0.6, 'magic_01');
      spr(c, 'light_02', f.c, f.x, f.y, f.r * 1.8, f.r * 1.8, 0, bell(p) * 0.7);
      return true;
    },
    knives(c, f, p) { // 비도 난사: 사방에서 날붙이가 보스에 꽂힌다
      for (let i = 0; i < N(10); i++) {
        const a = i * 0.63, q = cl(p * 2 - (i % 4) * 0.1), d = f.r * 1.8 * (1 - ease(q));
        if (q < 1) { if (!spr(c, 'vs_dagger', null, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 56, 11, a + Math.PI, 1, false)) spr(c, 'trace_01', f.c, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 10, 50, a + Math.PI / 2, 1); }
        else spr(c, 'flame_05', f.c, f.x + Math.cos(a) * 20, f.y + Math.sin(a) * 20 - 10, 22, 40, 0, 1 - cl((p - 0.5) * 3));
      }
      return true;
    },
    // ---- 장수 고유(2026-11-25) ----
    wolfgaze(c, f, p) { // 사마의 낭고상: 보랏빛 소용돌이가 엇갈려 돌며 조여 들다 어둠이 터진다
      const k = cl(p / 0.45), s = f.r * 2.6 * (1 - ease(k) * 0.75);
      if (k < 1) for (let i = 0; i < 3; i++) spr(c, ['twirl_01', 'twirl_02', 'twirl_03'][i], f.c, f.x, f.y, s * (1 - i * 0.15), s * (1 - i * 0.15), p * (i % 2 ? -12 : 12), bell(k) * 0.9, true, 0.6);
      const q = cl((p - 0.4) / 0.6);
      if (q > 0) {
        spr(c, 'smoke_09', '#2a1440', f.x, f.y, f.r * (1.2 + q * 1.6) * 2, f.r * (1.2 + q * 1.6) * 2, q, (1 - q) * 0.75, false);
        spr(c, 'magic_05', f.c, f.x, f.y - 20, f.r * 1.6, f.r * 1.6, 0, bell(cl(q * 2)));
        wave(c, f.c, f.x, f.y, f.r * 3.4, q, 0.8, 0.5);
      }
      return true;
    },
    snare(c, f, p) { // 사마의 고평릉의 함정: 쇠사슬 두 줄(원본)이 X자로 보스를 감고 조인다. 보라 번개가 사슬을 따라 흐른다(검토 5-3)
      rune(c, 3, f.c, f.x, f.y + 30, f.r * 2.4, -p * 2, 1 - p, 0.45, 'magic_02');
      const L = f.r * 2.6 * (1 - ease(cl((p - 0.3) / 0.5)) * 0.35), out = 1 - cl((p - 0.75) / 0.25);
      for (let i = 0; i < 2; i++) {
        const q = cl((p - i * 0.1) / 0.2) * out, r = i ? 0.7 : -0.7, sh = Math.random() < 0.5;
        spr(c, 'spark_07', f.c, f.x, f.y - 30, L * 1.05, f.r * 0.45, r + (sh ? Math.PI : 0), q * 0.7);
        if (!weap(c, 'vs_chain', f.c, f.x, f.y - 30, L, null, r, q)) spr(c, 'spark_07', WHITE, f.x, f.y - 30, L, f.r * 0.25, r, q * 0.7);
      }
      return true;
    },
    expose(c, f, p) { // 곽가 유계 간파: 조준 표식이 조여 들어 꽂히고 약점이 갈라진다
      const k = ease(cl(p / 0.45)), s = f.r * (3.4 - k * 2);
      spr(c, 'magic_03', f.c, f.x, f.y - 30, s, s, (1 - k) * 1.5, cl(p * 4) * (1 - cl((p - 0.7) / 0.3)));
      const q = cl((p - 0.4) / 0.5);
      // 꽂히는 순간 작은 빛, 이어서 약점이 갈라짐(vs_crack 원본, 0.25~0.5초) — 검토 1-4
      if (q > 0) { spr(c, 'star_08', WHITE, f.x, f.y - 30, f.r * 0.8, f.r * 0.8, 0, bell(cl(q * 2.5))); weap(c, 'vs_crack', null, f.x, f.y - 30, f.r * 1.6, f.r * 1.6, 0, cl(q * 4) * (1 - cl((p - 0.75) / 0.25))); }
      return true;
    },
    twotigers(c, f, p) { // 순욱 이호경식: 두 소용돌이가 서로 돌며 다가가 부딪쳐 터진다
      const k = ease(cl(p / 0.4)), rr = f.r * (1 - k);
      if (p < 0.45) for (let i = 0; i < 2; i++) {
        const a = p * 9 + i * Math.PI, x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.6, col = i ? f.c : WHITE;
        spr(c, 'twirl_01', col, x, y, f.r * 0.9, f.r * 0.9, a * 2 * (i ? -1 : 1), 0.95);
        spr(c, 'light_01', f.c, x, y, f.r * 0.8, f.r * 0.8, 0, 0.6);
      }
      const q = cl((p - 0.38) / 0.6), A = ART();
      if (q > 0) {
        // 부딪친 자리에 호랑이 발톱 자국 둘(검토 1-3), 끝 섬광은 주황 빛살 터짐
        for (let i = 0; i < 2; i++) spr(c, 'scratch_01', i ? f.c : WHITE, f.x + (i ? 1 : -1) * f.r * 0.25, f.y - 20, f.r * 1.4, f.r * 1.4, i ? 0.5 : -0.4, bell(cl(q * 1.6)) * 0.9);
        if (!(A && A.fxAnim(c, 'burst', q, f.x, f.y - 10, f.r * 2.2, f.r * 2.2, 0, 1, null, { col: f.c }))) spr(c, 'star_09', f.c, f.x, f.y, f.r * 2, f.r * 2, q, bell(cl(q * 2)));
      }
      return true;
    },
    ghostplan(c, f, p) { // 곽가 유계: 푸른 혼불 셋이 나선으로 내려와 한 점에서 터진다
      const k = cl(p / 0.45);
      if (k < 1) for (let i = 0; i < 3; i++) {
        const a = i * 2.09 + k * 4, rr = f.r * 1.5 * (1 - ease(k)), x = f.x + Math.cos(a) * rr, y = f.y - 40 - (1 - k) * f.r * 0.8 + Math.sin(a) * rr * 0.5;
        spr(c, 'vs_wisp', f.c, x, y, 110, 35, a + Math.PI / 2, 0.95);
        spr(c, 'circle_05', WHITE, x, y, 26, 26, 0, 0.9);
      }
      const q = cl((p - 0.4) / 0.6);
      // 끝 섬광은 작게(f.r×1.2) — 혼불 셋이 주인공(검토 1-3)
      if (q > 0) { spr(c, 'light_03', f.c, f.x, f.y, f.r * 1.2, f.r * 1.2, 0, bell(cl(q * 1.5))); spr(c, 'star_07', WHITE, f.x, f.y - 20, f.r * 0.8, f.r * 0.8, 0, bell(cl(q * 2))); wave(c, f.c, f.x, f.y, f.r * 2, q, 0.7, 0.5); }
      return true;
    },
    bagua(c, f, p) { // 제갈량 팔진도: 팔방의 별이 차례로 켜져 진을 이루고 가운데가 번쩍인다
      // 법진은 투명도 최고 0.55(보스 그림·보스 팔문 표식을 덮지 않게, 검토 3-2·3-3d), 별 8개만 밝게
      rune(c, 1, f.c, f.x, f.y, f.r * 2.4, p * 1.2, (1 - cl((p - 0.5) / 0.5)) * 0.55, 0.55, 'magic_01');
      const out = 1 - cl((p - 0.6) / 0.4);
      for (let i = 0; i < 8; i++) {
        const on = cl((p - i * 0.035) / 0.15), a = i * Math.PI / 4;
        spr(c, 'star_07', i % 2 ? WHITE : f.c, f.x + Math.cos(a) * f.r * 1.05, f.y + Math.sin(a) * f.r * 0.58, f.r * 0.5, f.r * 0.5, 0, on * out);
      }
      spr(c, 'light_03', f.c, f.x, f.y, f.r * 2.2, f.r * 2.2, 0, bell(cl((p - 0.3) / 0.5)) * 0.5, true, 0.55);
      spr(c, 'star_09', WHITE, f.x, f.y - 20, f.r * 1.4 * (IMM() ? 1.3 : 1), f.r * 1.4 * (IMM() ? 1.3 : 1), p, bell(cl((p - 0.3) / 0.4)));
      return true;
    },
    chainblast(c, f, p) { // 주유 연환선 폭발: 사슬로 묶인 배처럼 폭발 셋이 차례로 번진다(Kenney 폭발 프레임)
      const P3 = [[0, 0], [-0.55, -0.25], [0.55, 0.2]];
      spr(c, 'scorch_01', '#2a1408', f.x, f.y, f.r * 2.4, f.r * 1.6, 0, (1 - p) * 0.6, false);
      for (let i = 0; i < 3; i++) {
        const q = cl((p - i * 0.2) / 0.55); if (q <= 0 || q >= 1) continue;
        const x = f.x + P3[i][0] * f.r, y = f.y + P3[i][1] * f.r, s = f.r * (i ? 1.3 : 1.7) * (0.7 + q * 0.6);
        if (!spr(c, 'exp' + Math.min(8, Math.floor(q * 9)), null, x, y - s * 0.15, s, s, 0, (1 - q) * 1.3)) spr(c, 'fire_01', f.c, x, y, s, s, q, 1 - q);
        spr(c, 'flare_01', '#fff0c0', x, y, s * 0.9, s * 0.9, 0, bell(cl(q * 2.5)));
      }
      return true;
    },
    bellow(c, f, p) { // 장비 장판교 대갈: 발밑에서 충격파 세 겹이 퍼지고 기절 별이 돈다
      for (let i = 0; i < 3; i++) wave(c, f.c, f.x, f.y + 10, f.r * 3.2, cl((p - i * 0.12) / 0.55), 1, 0.5);
      spr(c, 'dirt_03', '#a08060', f.x, f.y + 10, f.r * 2.4, f.r * 2.4, 0, (1 - p) * 0.6, false, 0.5);
      spr(c, 'muzzle_01', f.c, f.x, f.y - f.r * 0.4, f.r * 0.7, f.r * 1.4, 0, bell(cl(p * 2.2)));
      for (let i = 0; i < N(5); i++) { const a = i * 1.256 + p * 8; spr(c, 'star_04', '#fff6a0', f.x + Math.cos(a) * f.r * 0.5, f.y - f.r * 0.3 + Math.sin(a) * f.r * 0.18, 26, 26, 0, bell(cl((p - 0.2) / 0.8))); }
      return true;
    },
    musang(c, f, p) { // 여포 무쌍 난무: 방천화극 그림자가 두 바퀴 휘돌며 붉은 참격을 남긴다
      const a = ease(cl(p * 1.4)) * Math.PI * 4, fa = 1 - cl((p - 0.6) / 0.4), L = f.r * 1.7;
      for (let i = 0; i < N(6); i++) { const ai = a - i * 0.5; spr(c, 'slash_01', f.c, f.x + Math.cos(ai) * f.r * 0.6, f.y + Math.sin(ai) * f.r * 0.45, f.r * 1.1, f.r * 0.7, ai - Math.PI / 2, fa * (1 - i * 0.14)); }
      weap(c, pick('vs_fangtian', 'vs_ji'), f.c, f.x, f.y, L, null, a, fa);
      spr(c, 'star_09', WHITE, f.x, f.y, f.r * 1.2, f.r * 1.2, p * 2, bell(cl(p * 2.5)));
      return true;
    },
  };

  // ---- 자기·아군 강화(aura): 장수 발밑과 몸 주위 ----
  const AURA = {
    power(c, f, p) { // 강화: 불꽃 같은 기운이 솟는다
      spr(c, 'light_02', f.c, f.x, f.y + 20, f.r * 1.8, f.r * 1.8, p, bell(p), true, 0.45);
      for (let i = 0; i < N(7); i++) { const a = i * 0.9, d = f.r * 0.45, q = cl(p * 1.4 - (i % 3) * 0.1); spr(c, 'muzzle_04', f.c, f.x + Math.cos(a) * d, f.y + 20 + Math.sin(a) * d * 0.4 - q * 70, 36, 80, 0, bell(q)); }
      spr(c, 'star_09', WHITE, f.x, f.y - 20, 110, 110, p * 2, bell(cl(p * 2.5)));
      return true;
    },
    guard(c, f, p) { // 보호·무적: 빛의 막과 반짝이는 십자성
      spr(c, 'circle_03', f.c, f.x, f.y - 10, f.r * 1.5, f.r * 1.5, 0, bell(cl(p * 1.3)));
      rune(c, 2, f.c, f.x, f.y - 10, f.r * 1.6, p * 2, bell(p) * 0.8, 0, 'magic_03');
      for (let i = 0; i < N(5); i++) spr(c, 'star_02', WHITE, f.x + Math.cos(i * 1.26 + p * 4) * f.r * 0.6, f.y - 10 + Math.sin(i * 1.26 + p * 4) * f.r * 0.6, 40, 40, 0, bell(cl(p * 1.5 - i * 0.08)));
      return true;
    },
    heal(c, f, p) { // 치료: 초록빛 고리와 위로 오르는 빛 알갱이
      spr(c, 'light_01', f.c, f.x, f.y + 20, f.r * 2, f.r * 2, 0, bell(p), true, 0.45);
      spr(c, 'circle_05', f.c, f.x, f.y - 10, f.r, f.r, 0, bell(p) * 0.6);
      for (let i = 0; i < N(12); i++) { const a = i * 0.52, d = f.r * (0.3 + (i % 3) * 0.2), q = cl(p * 1.3 - (i % 4) * 0.08); spr(c, 'star_06', i % 3 ? f.c : WHITE, f.x + Math.cos(a) * d, f.y + 10 - q * 130, 26, 26, 0, bell(q)); }
      return true;
    },
    rally(c, f, p) { // 호령: 황금빛 폭발과 퍼지는 고리
      spr(c, 'star_09', f.c, f.x, f.y - 20, f.r * 1.4, f.r * 1.4, p, bell(cl(p * 2)));
      spr(c, 'magic_04', WHITE, f.x, f.y - 20, f.r * 1.1, f.r * 1.1, -p * 2, bell(cl(p * 2)) * 0.7);
      for (let i = 0; i < 3; i++) { const q = cl(p * 1.3 - i * 0.15); spr(c, 'circle_02', f.c, f.x, f.y + 20, f.r * (0.4 + q * 1.4) * 2, f.r * (0.4 + q * 1.4) * 2, 0, (1 - q) * 0.8, true, 0.45); }
      return true;
    },
    taunt(c, f, p) { // 진영 사수: 붉은 도발 고리가 맥동
      for (let i = 0; i < 3; i++) { const q = cl(p * 1.4 - i * 0.18); spr(c, 'circle_01', f.c, f.x, f.y + 10, f.r * (0.6 + q) * 2, f.r * (0.6 + q) * 2, 0, (1 - q), true, 0.5); }
      for (let i = 0; i < N(6); i++) { const a = i * 1.05; spr(c, 'muzzle_01', f.c, f.x + Math.cos(a) * f.r * 0.5, f.y + Math.sin(a) * f.r * 0.5, 30, 60, a + Math.PI / 2, bell(p) * 0.8); }
      return true;
    },
    barrier(c, f, p) { // 방진·엄호: 바닥에 큰 법진, 둥근 빛의 막
      rune(c, 3, f.c, f.x, f.y + 20, f.r * 2.2, p * 2, bell(cl(p * 1.2)), 0.45, 'magic_02');
      spr(c, 'circle_03', f.c, f.x, f.y - 10, f.r * 1.7, f.r * 1.7, 0, bell(p) * 0.8);
      spr(c, 'light_03', WHITE, f.x, f.y - 10, f.r * 1.2, f.r * 1.2, 0, bell(cl(p * 2)) * 0.5);
      return true;
    },
    wind(c, f, p) { // 사기 진작·비연보: 소용돌이 바람
      for (let i = 0; i < 3; i++) spr(c, ['twirl_01', 'twirl_02', 'twirl_03'][i], f.c, f.x, f.y - 10, f.r * (1 + i * 0.35), f.r * (1 + i * 0.35), -p * (8 + i * 3) - i * 2, bell(cl(p * 1.3 - i * 0.08)));
      for (let i = 0; i < N(6); i++) spr(c, 'trace_03', WHITE, f.x + (i - 2.5) * 22, f.y + 20 - cl(p * 1.5 - i * 0.05) * 120, 10, 50, 0, bell(cl(p * 1.5 - i * 0.05)) * 0.7);
      return true;
    },
    reflect(c, f, p) { // 반격 태세: 날 선 법진과 튀는 전류
      rune(c, 2, f.c, f.x, f.y - 10, f.r * 1.8, p * 4, bell(p), 0, 'magic_03');
      spr(c, 'circle_02', f.c, f.x, f.y - 10, f.r * 1.5, f.r * 1.5, 0, bell(p) * 0.8);
      for (let i = 0; i < N(4); i++) spr(c, i % 2 ? 'spark_01' : 'spark_02', WHITE, f.x + Math.cos(i * 1.57) * f.r * 0.6, f.y - 10 + Math.sin(i * 1.57) * f.r * 0.6, 60, 60, i, Math.random() < 0.6 ? bell(p) : 0);
      return true;
    },
    // ---- 장수 고유(2026-11-25) ----
    virtue(c, f, p) { // 유비 인덕의 전군 치료: 머리 위 빛살 후광이 돌고 따뜻한 흰 금빛 빛줄기 다섯이 내려와 초록 빛 알갱이가 내려앉는다
      // 불멸 aura(검토 4-1): 바닥 빛 · 몸 위 빛줄기 · 머리 위 빛살 후광 세 층. 초록은 치료 알갱이에만(검토 1-6)
      const A = ART(), q = bell(cl(p * 1.2)), G = '#8ee6a0';
      spr(c, 'light_01', f.c, f.x, f.y + 20, f.r * 2.2, f.r * 2.2, 0, q, true, 0.45);
      if (!(A && A.fxPic(c, 'ray_sun', f.x, f.y - f.r * 1.1, f.r * 3, f.r * 3, p * 0.8, q * 0.9, { col: f.c }))) spr(c, 'star_09', f.c, f.x, f.y - f.r * 1.1, f.r * 2, f.r * 2, p, q * 0.8);
      for (let i = 0; i < 5; i++) { const k = cl((p - i * 0.06) / 0.35), x = f.x + (i - 2) * f.r * 0.32, H = f.r * 2.2 * ease(k); spr(c, 'trace_06', f.c, x, f.y + 20 - f.r * 2.2 + H / 2, f.r * 0.28, H, 0, q); }
      for (let i = 0; i < N(12); i++) { const k = cl(p * 1.4 - (i % 3) * 0.12), x = f.x + Math.sin(i * 2.1) * f.r * 0.7 + Math.sin(k * 6 + i) * 10, y = f.y - f.r * 1.3 + k * f.r * 1.4; spr(c, 'star_06', i % 3 ? G : WHITE, x, y, 28, 28, k * 3, bell(k)); }
      return true;
    },
    sevenstar(c, f, p) { // 제갈량 칠성단: 앞에 일곱 잔 등불대(vs_lamp)가 서고, 머리 위에 일곱 등불이 북두 모양으로 차례로 켜져 빛이 내려온다(검토 2-8)
      const D = [[-1, 0.1], [-0.6, 0.15], [-0.22, 0.05], [0.12, 0.12], [0.3, 0.5], [0.8, 0.58], [0.92, 0.18]], L = '#ffe8b0';
      const cy = f.y - f.r * 1.0, sc = f.r * 0.95, s = Math.max(60, f.r * 0.36), out = 1 - cl((p - 0.8) / 0.2);
      rune(c, 1, L, f.x, f.y + 20, f.r * 2.4, p * 0.8, bell(cl(p * 1.1)) * 0.8, 0.45, 'magic_01'); // 바닥: 단(壇)의 법진
      const st = cl(p / 0.15) * out, LW = f.r * 0.55; // 몸: 등불대(원본)가 장수 앞 오른쪽에 선다
      if (weap(c, 'vs_lamp', '#ffb050', f.x + f.r * 0.6, f.y + 20 - LW * 0.5, LW, null, 0, st)) spr(c, 'light_01', '#ffb050', f.x + f.r * 0.6, f.y + 20 - LW * 0.85, LW * 0.9, LW * 0.9, 0, st * 0.6);
      for (let i = 0; i < 7; i++) { // 위: 북두 모양 일곱 불꽃
        const on = cl((p - i * 0.06) / 0.12) * out, x = f.x + D[i][0] * sc, y = cy + D[i][1] * sc * 0.8, fl = 1 + Math.sin(p * 40 + i * 2) * 0.08;
        spr(c, 'light_01', '#ffb050', x, y, s, s, 0, on * 0.55); // 등불 빛은 작게(겹치면 흰 덩어리가 된다)
        spr(c, 'flame_05', '#ffb040', x, y - s * 0.1, s * 0.42 * fl, s * 0.8 * fl, 0, on);
        spr(c, 'star_04', '#fff4d0', x, y, s * 0.35, s * 0.35, 0, on * 0.9); // 심지
      }
      const q = bell(cl((p - 0.45) / 0.5));
      spr(c, 'trace_06', L, f.x, (cy + f.y + 20) / 2, f.r * 1.1, f.y + 20 - cy, 0, q);
      spr(c, 'light_01', '#8ee6a0', f.x, f.y + 20, f.r * 1.8, f.r * 1.8, 0, q, true, 0.45);
      return true;
    },
    talisman(c, f, p) { // 장각 태평 전군 치료: 누런 부적 여덟 장(원본)이 몸 둘레를 돌며 떠오르고 초록 치유 알갱이가 오른다(검토 1-6·3-3g)
      spr(c, 'light_02', f.c, f.x, f.y + 20, f.r * 1.9, f.r * 1.9, p, bell(p), true, 0.45);
      const W = IMM() ? 46 : 40;
      for (let i = 0; i < N(8); i++) {
        const a = i * 0.785 + p * 5, k = cl(p * 1.3 - i * 0.04), x = f.x + Math.cos(a) * f.r * 0.7, y = f.y + 10 + Math.sin(a) * f.r * 0.25 - k * f.r * 1.3, r = Math.sin(a * 2) * 0.4;
        weap(c, 'vs_talisman', f.c, x, y, W, W * 3.25, r, bell(k));
      }
      for (let i = 0; i < N(8); i++) { const k = cl(p * 1.4 - (i % 4) * 0.08); spr(c, 'star_06', '#8ee6a0', f.x + Math.cos(i * 0.8) * f.r * 0.45, f.y + 10 - k * f.r * 1.1, 24, 24, 0, bell(k)); }
      return true;
    },
    fivetigers(c, f, p) { // 유비 오호 소집: 오호대장의 다섯 빛(관우·장비·조운·마초·태사자 스킬 색)이 오각으로 나타나 가운데로 모여 터진다
      const A = ART(), C5 = ['#4fe0a0', '#f0d060', '#d4f4e0', '#e8d27a', '#e8eef8'], m = ease(cl((p - 0.45) / 0.3));
      spr(c, 'light_02', f.c, f.x, f.y + 20, f.r * 2.2, f.r * 2.2, p, bell(cl(p * 1.1)), true, 0.45);
      for (let i = 0; i < 5; i++) {
        const on = cl((p - i * 0.07) / 0.15), a = -Math.PI / 2 + i * 1.2566, rr = f.r * 0.95 * (1 - m), x = f.x + Math.cos(a) * rr, y = f.y - 20 + Math.sin(a) * rr * 0.7;
        spr(c, 'light_01', C5[i], x, y, 130, 130, 0, on * 0.7 * (1 - m));
        spr(c, 'star_09', C5[i], x, y, 100, 100, p * 3, on * (1 - cl((p - 0.8) / 0.2)));
      }
      const bq = cl((p - 0.6) / 0.35);
      if (!(A && bq > 0 && A.fxAnim(c, 'burst', bq, f.x, f.y - 20, f.r * 2, f.r * 2, 0, 1, null, { col: f.c }))) spr(c, 'magic_05', WHITE, f.x, f.y - 20, f.r * 1.4, f.r * 1.4, 0, bell(cl((p - 0.65) / 0.35)));
      return true;
    },
    dispatch(c, f, p) { // 손권 용인술: 인장 넷이 몸에서 사방으로 날아가 닿는 곳에서 반짝인다(장수들에게 맡긴다). 인장 그림 vs_seal이 없으면 인장 빛(magic_04)
      const q = bell(cl(p * 1.1));
      rune(c, 2, f.c, f.x, f.y + 20, f.r * 2.4, p * 1.5, q * 0.9, 0.45, 'magic_03'); // 바닥
      spr(c, 'magic_04', f.c, f.x, f.y - 20, f.r * 2, f.r * 2, p * 2, bell(cl(p * 2))); // 몸
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2, k = ease(cl((p - 0.08) / 0.55)), d = k * f.r * 2.2, x = f.x + Math.cos(a) * d, y = f.y - 20 + Math.sin(a) * d * 0.6, al = 1 - cl((p - 0.7) / 0.3);
        if (!weap(c, 'vs_seal', f.c, x, y, 64, null, 0, al)) { spr(c, 'magic_04', f.c, x, y, 80, 80, p * 4, al); spr(c, 'light_01', f.c, x, y, 90, 90, 0, al * 0.6); }
        spr(c, 'star_08', WHITE, x, y, 110, 110, p * 3, bell(cl((p - 0.55) / 0.3))); // 닿는 곳에서 반짝
      }
      return true;
    },
    oath(c, f, p) { // 태사자 신의의 맹세: 땅에 X자로 꽂힌 쌍극(원본)에서 금빛 빛기둥이 솟고 끝에 십자 별(검토 2-5)
      const k = ease(cl(p * 2.5)), H = f.r * 2.6 * k, fa = 1 - cl((p - 0.6) / 0.4), L = f.r * 1.6, dr = 1 - ease(cl(p * 4));
      spr(c, 'light_01', f.c, f.x, f.y + 20, f.r * 2, f.r * 2, 0, fa, true, 0.45);
      for (let i = 0; i < 2; i++) weap(c, 'vs_ji', f.c, f.x + (i ? 1 : -1) * L * 0.12, f.y + 20 - L * 0.32 - dr * 60, L, null, Math.PI / 2 + (i ? 0.45 : -0.45), fa);
      spr(c, 'trace_06', f.c, f.x, f.y + 20 - H / 2, f.r * 1.4, Math.max(4, H), 0, fa);
      spr(c, 'light_03', f.c, f.x, f.y + 20 - H, f.r * 1.2, f.r * 1.2, 0, fa * k);
      spr(c, 'star_07', WHITE, f.x, f.y + 20 - H, f.r * 1.2, f.r * 1.2, 0, fa * bell(cl(p * 1.5)));
      return true;
    },
    peerless(c, f, p) { // 여포 천하무쌍: 발밑이 터져 오르며 검붉은 큰 불길이 치솟고 방천화극이 몸 뒤에 서서 붉게 빛난다(검토 2-7·4-1)
      const k0 = cl(p / 0.3), up = ease(cl(p * 2)), fa = 1 - cl((p - 0.7) / 0.3), H = f.r * 3 * (0.5 + up * 0.5);
      spr(c, 'scorch_02', '#1a0404', f.x, f.y + 22, f.r * 2.6, f.r * 2.6, 0, fa * 0.7, false, 0.45); // 바닥
      spr(c, 'light_01', '#ff3020', f.x, f.y + 20, f.r * 2.4, f.r * 2.4, 0, fa, true, 0.45);
      if (k0 < 1) spr(c, 'exp' + Math.min(8, Math.floor(k0 * 9)), null, f.x, f.y - f.r * 0.3, f.r * 1.6, f.r * 1.6, 0, (1 - k0) * 1.3); // 터져 오르는 시작
      weap(c, pick('vs_fangtian', 'vs_ji'), '#ff3020', f.x + f.r * 0.35, f.y - f.r * 0.7, f.r * 2.2, null, -Math.PI / 2 + 0.15, fa); // 몸
      const FC = ['#ff3020', '#ff6a30', '#ffb060'];
      for (let i = 0; i < 3; i++) { const w = f.r * (1.5 - i * 0.25), h = H * (1 - i * 0.18), fl = 1 + Math.sin(p * 30 + i) * 0.05; spr(c, ['flame_01', 'flame_02', 'flame_03'][i], FC[i], f.x + (i - 1) * f.r * 0.3, f.y + 20 - h / 2, w * fl, h, 0, fa); }
      for (let i = 0; i < N(10); i++) { const k = cl(p * 1.4 - (i % 5) * 0.08); spr(c, 'flame_05', '#ffb060', f.x + Math.sin(i * 2.3) * f.r * 0.7, f.y - k * f.r * 2.6, 20, 36, 0, bell(k)); } // 위: 솟는 불티
      return true;
    },
    goldlion(c, f, p) { // 마초 금마초의 위용: 등 뒤로 금빛 빛살 후광이 돈다
      const A = ART(), q = bell(cl(p * 1.2));
      if (!(A && A.fxPic(c, 'ray_sun', f.x, f.y - 30, f.r * 3, f.r * 3, p * 1.5, q, { col: f.c }))) spr(c, 'star_09', f.c, f.x, f.y - 30, f.r * 2.4, f.r * 2.4, p, q);
      spr(c, 'light_01', f.c, f.x, f.y - 30, f.r * 1.6, f.r * 1.6, 0, q * 0.8);
      spr(c, 'star_08', WHITE, f.x, f.y - 30, f.r * 1.2, f.r * 1.2, p * 2, bell(cl(p * 2.5)));
      return true;
    },
    melody(c, f, p) { // 주유 곡조 비기: 바람 리본(vs_wind 원본) 세 줄이 박자(0·0.25·0.5초)마다 물결치며 떠오르고 불티가 오른다(검토 1-9·4-1)
      spr(c, 'light_02', f.c, f.x, f.y + 20, f.r * 2.2, f.r * 2.2, p, bell(cl(p * 1.1)), true, 0.45); // 바닥
      const T = (f.life || 0.8) + (IMM() ? 0.2 : 0);
      for (let i = 0; i < 3; i++) {
        const q = cl((p * T - i * 0.25) / 0.5); if (q <= 0 || q >= 1) continue;
        weap(c, 'vs_wind', f.c, f.x + Math.sin(q * 6 + i) * f.r * 0.25, f.y - 10 - q * f.r * 0.9 - i * f.r * 0.15, f.r * 3 * (0.7 + q * 0.3), null, Math.sin(q * 5 + i) * 0.12, bell(q));
        for (let j = 0; j < N(4); j++) { const e = cl(q * 1.3 - j * 0.08); spr(c, 'flame_05', '#ffb050', f.x + (j - 1.5) * f.r * 0.4 + Math.sin(e * 9 + j) * 12, f.y + 10 - e * f.r * 1.5, 18, 32, 0, bell(e)); }
      }
      return true;
    },
    firering(c, f, p) { // 육손 인내의 진: 발밑에 불고리가 눕고 둘레에 불꽃이 선다
      const q = bell(cl(p * 1.2)), s = f.r * 2.4 * (0.8 + ease(cl(p * 2)) * 0.2);
      if (!spr(c, 'vs_ring', null, f.x, f.y + 20, s, s, 0, q, true, 0.42)) spr(c, 'circle_03', f.c, f.x, f.y + 20, s, s, 0, q, true, 0.42);
      for (let i = 0; i < N(6); i++) { const a = i * 1.047 + p * 2; spr(c, 'flame_05', '#ffb060', f.x + Math.cos(a) * s * 0.48, f.y + 8 + Math.sin(a) * s * 0.2, 18, 34, 0, q * 0.9); }
      return true;
    },
    shroud(c, f, p) { // 사마의 농성 대기: 보랏빛 연기 장막이 몸을 감싸고 큰 법진이 천천히 돈다(불멸 aura 세 층, 검토 4-1)
      const A = ART(), q = bell(cl(p * 1.1));
      rune(c, 3, f.c, f.x, f.y + 20, f.r * 2.6, p * 0.8, q * 0.8, 0.42, 'magic_02'); // 바닥
      for (let i = 0; i < N(3); i++) { // 몸: 감기는 연기
        const a = i * 2.09 + p * 2.5, x = f.x + Math.cos(a) * f.r * 0.5, y = f.y - 10 + Math.sin(a) * f.r * 0.25;
        if (!(A && A.fxAnim(c, 'smoke', cl(p * 0.9 + i * 0.05), x, y, f.r * 2.6, f.r * 2.6, 0, q, null, { col: f.c }))) spr(c, 'smoke_07', f.c, x, y, f.r * 2.2, f.r * 2.2, a, q * 0.8);
      }
      spr(c, 'magic_05', f.c, f.x, f.y - f.r * 0.9, f.r * 1.2, f.r * 1.2, -p * 2, q * 0.9); // 위
      return true;
    },
    mist(c, f, p) { // 곽가 요절의 예지: 옅은 안개 속에 앞일을 내다보는 반짝임
      const A = ART(), q = bell(cl(p * 1.2));
      if (!(A && A.fxAnim(c, 'smoke', p, f.x, f.y - 10, f.r * 2.4, f.r * 2.4, 0, q * 0.6, null, { col: f.c }))) spr(c, 'smoke_07', f.c, f.x, f.y - 10, f.r * 2, f.r * 2, p, q * 0.5);
      for (let i = 0; i < N(5); i++) { const k = cl((p - i * 0.1) / 0.3); spr(c, 'star_02', WHITE, f.x + Math.cos(i * 2.4) * f.r * 0.6, f.y - 10 + Math.sin(i * 2.4) * f.r * 0.5, 34, 34, 0, bell(k)); }
      spr(c, 'magic_05', f.c, f.x, f.y - 30, f.r * 0.9, f.r * 0.9, 0, bell(cl((p - 0.2) / 0.5)));
      return true;
    },
    eightlock(c, f, p) { // 조인 팔문금쇄진: 방패 여덟 장(원본)이 밖에서 날아와 서로 맞닿게 둘러서고 '쿵' 흙먼지(검토 1-5·3-1)
      const k = ease(cl(p / 0.43)), fa = 1 - cl((p - 0.7) / 0.3), al = fa * Math.min(1, k * 1.5);
      if (p > 0.4) spr(c, 'dirt_03', '#a08868', f.x, f.y + 20, f.r * 3.2, f.r * 3.2, 0, (1 - cl((p - 0.4) / 0.6)) * 0.7, false, 0.45);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.3, rr = f.r * (2.4 - k), x = f.x + Math.cos(a) * rr, y = f.y - 10 + Math.sin(a) * rr * 0.6;
        weap(c, 'vs_shield', f.c, x, y, 90, 90, 0, al);
      }
      return true;
    },
    bulwark(c, f, p) { // 전위 엄호: 큰 방패가 앞에 내리꽂히고 흙먼지와 충격파
      const drop = 1 - ease(cl(p * 3)), fa = 1 - cl((p - 0.7) / 0.3), S = f.r * 0.5, y = f.y + S * 0.35 - drop * 60;
      weap(c, 'vs_shield', f.c, f.x, y, S, S, 0, fa);
      if (p > 0.3) { spr(c, 'dirt_03', '#9a7a5a', f.x, f.y + S * 0.8, S * 3, S * 3, 0, (1 - p) * 0.6, false, 0.45); wave(c, f.c, f.x, f.y + S * 0.8, S * 5, cl((p - 0.3) / 0.6), 1, 0.45); }
      return true;
    },
    spearspin(c, f, p) { // 조운 용담: 창 세 자루(원본)가 120°씩 바람개비처럼 돌며 막고, 창끝에 바람 자국(검토 1-5)
      const fa = 1 - cl((p - 0.6) / 0.4), L = f.r * 2.4, rot = ease(cl(p * 1.6)) * Math.PI * 3, cy = f.y - 10;
      spr(c, 'light_01', f.c, f.x, f.y + 20, f.r * 2, f.r * 2, 0, fa * 0.8, true, 0.45);
      for (let i = 0; i < 3; i++) {
        const a = rot + i * 2.094, ca = Math.cos(a), sa = Math.sin(a) * 0.6;
        weap(c, 'vs_spear', f.c, f.x + ca * L * 0.3, cy + sa * L * 0.3, L * 0.75, null, Math.atan2(sa, ca), fa);
        weap(c, 'vs_wind', null, f.x + ca * L * 0.62, cy + sa * L * 0.62, L * 0.45, null, Math.atan2(sa, ca) + Math.PI / 2, fa * 0.8);
      }
      return true;
    },
    lonesword(c, f, p) { // 관우 단도부회: 청룡언월도(원본, 없으면 vs_dao)가 크게 한 바퀴 휘돌고 초록 초승달 자국이 따른다(검토 1-5)
      const fa = 1 - cl((p - 0.55) / 0.45), a = -Math.PI / 2 + ease(cl(p * 1.8)) * Math.PI * 2, L = f.r * 2.6, rr = f.r * 0.55, cy = f.y - 10;
      spr(c, 'light_01', f.c, f.x, f.y + 20, f.r * 2.2, f.r * 2.2, 0, fa * 0.9, true, 0.45); // 바닥
      for (let i = 0; i < 3; i++) { const ai = a - i * 0.35; spr(c, 'slash_03', f.c, f.x + Math.cos(ai) * rr, cy + Math.sin(ai) * rr * 0.6, f.r * 1.8 * 0.55, f.r * 1.8, ai, fa * (1 - i * 0.3)); }
      const ca = Math.cos(a), sa = Math.sin(a) * 0.6, ang = Math.atan2(sa, ca);
      weap(c, pick('vs_guandao', 'vs_dao'), f.c, f.x + ca * L * 0.25, cy + sa * L * 0.25, L, null, ang, fa);
      spr(c, 'star_04', WHITE, f.x + ca * L * 0.72, cy + sa * L * 0.72, 50, 50, 0, fa * 0.9); // 위: 날 끝의 빛
      return true;
    },
    swallow(c, f, p) { // 손상향 비연보: 제비처럼 비스듬히 스치는 빛줄기
      for (let i = 0; i < N(6); i++) { const k = cl(p * 2 - i * 0.12), x = f.x - f.r * 0.9 + k * f.r * 1.8 + (i % 3 - 1) * 14, y = f.y - f.r * 0.6 + k * f.r * 0.5 + (i % 2) * 30; spr(c, 'trace_01', i % 2 ? WHITE : f.c, x, y, 10, 70, -1.1, bell(k)); }
      spr(c, 'twirl_02', f.c, f.x, f.y - 10, f.r * 1.3, f.r * 1.3, -p * 10, bell(cl(p * 1.4)) * 0.7);
      return true;
    },
    tiger(c, f, p) { // 손견 강동 호령: 호랑이 발톱 자국 셋과 솟는 기운
      spr(c, 'light_02', f.c, f.x, f.y + 20, f.r * 1.8, f.r * 1.8, p, bell(p), true, 0.45);
      for (let i = 0; i < 3; i++) { const q = cl((p - i * 0.08) / 0.4), a = -2.2 + i * 0.6; spr(c, 'scratch_01', f.c, f.x + Math.cos(a) * f.r * 0.55, f.y - 20 + Math.sin(a) * f.r * 0.4, f.r * 0.9, f.r * 0.9, a + 0.8, bell(q)); }
      spr(c, 'muzzle_04', f.c, f.x, f.y - f.r * 0.3, f.r * 0.6, f.r * 1.4, 0, bell(cl(p * 1.5)));
      return true;
    },
    imperial(c, f, p) { // 순욱 철벽 진형: 금빛 법진의 네 귀퉁이에서 빛기둥이 솟는다
      const q = bell(cl(p * 1.1));
      rune(c, 2, f.c, f.x, f.y + 20, f.r * 2.2, p * 1.5, q, 0.42, 'magic_03');
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2, x = f.x + Math.cos(a) * f.r * 0.85, y = f.y + 20 + Math.sin(a) * f.r * 0.38, k = ease(cl((p - i * 0.06) / 0.35)), H = f.r * 1.2 * k;
        spr(c, 'trace_06', f.c, x, y - H / 2, 46, Math.max(4, H), 0, q);
        spr(c, 'flare_01', WHITE, x, y - H, 60, 60, 0, q * k);
      }
      return true;
    },
  };

  // 신화·불멸 장수 스킬의 무게: 착탄 지점의 짧은 섬광 한 장. 스킬 모양 자체(판정 크기)는 그대로 둔다.
  // 2026-11-25: 예전 착탄 충격파는 R×6.4~8(직선이면 지름 1800px 안팎)이라 신화·불멸 스킬이 모두 같은 흰 원으로 보였다.
  // 검토(art-director 1-1·3-3b·5-5)에 따라 바닥 충격파(wave)를 없애고 섬광은 0.6배·0.12초만. 착탄의 무게는 각 연출이 불멸일 때 재료를 키워서 낸다.
  // 자기 강화(aura)에는 붙이지 않는다(불멸 aura는 AURA 함수 안에서 반지름 1.5배·세 층으로 키운다).
  function heavy(c, f, p, tier) {
    if (tier < 9 || f.k === 'aura' || !ready(['flare_01'])) return;
    const k = p * (f.life || 0.5) / 0.12; if (k >= 1) return;
    const big = tier >= 10, hp = f.k === 'beam' ? Math.min(1, p * 2.2) : 1;
    const ix = f.k === 'beam' ? f.x + Math.cos(f.a) * f.len * hp : f.k === 'cone' ? f.x + Math.cos(f.a) * f.r * 0.6 : f.x;
    const iy = f.k === 'beam' ? f.y + Math.sin(f.a) * f.len * hp : f.k === 'cone' ? f.y + Math.sin(f.a) * f.r * 0.6 : f.y;
    const R = (f.k === 'beam' ? f.w * 1.6 : f.k === 'cone' ? f.r * 0.5 : f.r || 120) * (big ? 1.2 : 0.96);
    spr(c, 'flare_01', WHITE, ix, iy, R, R, p * 2, bell(k) * 0.85);
  }
  // 불멸 강화류(aura)는 반지름 1.5배(엔진의 r은 그대로, 그리는 사본만). 연출 길이 +0.2초는 그리는 쪽(04-fx-text drawFx)이 extra()로 늘린다.
  const BIGR = new WeakMap();
  function bigR(f) { let o = BIGR.get(f); if (!o) { o = Object.create(f); o.r = (f.r || 100) * 1.5; BIGR.set(f, o); } return o; }
  const extra = (f, tier) => (f.k === 'aura' && tier >= 10 ? 0.2 : 0);
  // g.fx 한 개를 그린다(그렸으면 true)
  function fx(c, f, p, tier) {
    const tab = f.k === 'beam' ? BEAM : f.k === 'cone' ? CONE : f.k === 'blast' ? BLAST : f.k === 'aura' ? AURA : null;
    const fn = tab && (tab[f.vx] || (f.k === 'blast' ? BLAST.burst : null));
    if (!fn || !ready(['circle_02', 'light_01', 'star_09'])) return false;
    TIER = tier || 0;
    const ok = fn(c, f.k === 'aura' && TIER >= 10 ? bigR(f) : f, p) !== false;
    if (ok && TIER >= 9) heavy(c, f, p, TIER);
    TIER = 0;
    return ok;
  }
  // 원 스킬(내 장판)이 터지기 전 표시(검토 3-3a): 스킬 색과 상관없이 차가운 흰 파랑 법진 하나만 그린다.
  // 보스 장판 예고는 '가운데에서 붉은 채움이 차오름'이므로, 내 것은 채움 고리를 쓰지 않고 법진 회전이 빨라지는 것으로 터질 때를 알린다
  // (붉은 채움 = 보스, 파란 법진 = 나). 스킬 색은 터지는 연출에만 쓴다.
  const TELE_COL = '#bfe8ff';
  function tele(c, h, p, fired) {
    if (!ready(['magic_02'])) return false;
    if (fired) return true;
    rune(c, 3, TELE_COL, h.x, h.y, h.r * 2.2, p * 3 + p * p * p * 9, 0.5 + p * 0.4, 0.75, 'magic_02');
    return true;
  }

  // ---- 6성 이상 후광 ----
  // lod: 2 전부 · 1 떠다니는 별 생략 · 0 바닥 빛과 법진 하나만(후광 유닛이 많을 때. 유닛마다 최대 19번 더하기 합성을 하던 것이 2~3번이 된다)
  function tierAura(c, x, y, r, tier, col, t, seed, low, lod) {
    if (lod == null) lod = 2;
    if (low) lod = Math.min(lod, 1);
    if (!ready(['light_02', 'magic_02', 'magic_01', 'twirl_01', 'trace_06', 'flare_01', 'star_04', 'magic_03'])) return false;
    const fy = y + r * 0.72, pulse = 1 + Math.sin(t * 3 + seed) * 0.08;
    spr(c, 'light_02', col, x, fy, r * (tier >= 9 ? 4.4 : tier >= 8 ? 3.8 : 3.2) * pulse, r * 3.2 * pulse, t * 0.4, tier >= 8 ? 0.7 : 0.55, true, 0.45);
    if (tier >= 7) rune(c, 3, col, x, fy, r * 3, t * 0.9, 0.75, 0.42, 'magic_02');
    // 전설 이상: 몇 초마다 몸에서 십자 반짝임이 한 번 번쩍인다(멀리서도 '좋은 유닛'이 눈에 띄게). 등급이 높을수록 자주.
    if (tier >= 8) { const ph = (t * (tier >= 10 ? 0.45 : tier >= 9 ? 0.35 : 0.25) + seed * 0.159) % 1; if (ph < 0.1) { const A = ART(), s = r * (tier >= 10 ? 4.4 : 3.4); if (!(A && A.fxAnim(c, 'burst', ph / 0.1, x, y - r * 0.7, s, s, 0, 0.95))) spr(c, 'star_09', '#ffffff', x, y - r * 0.7, s * 0.8, s * 0.8, ph * 8, Math.sin((ph / 0.1) * Math.PI) * 0.9); } }
    if (lod === 0) { if (tier >= 10) spr(c, 'trace_06', col, x, y - r * 1.2, r * 2.2, r * 5, 0, 0.6); return true; }
    if (tier >= 8) {
      spr(c, 'twirl_01', col, x, y, r * 3, r * 3, t * 2.2, 0.6);
      if (lod >= 2) for (let i = 0; i < (tier >= 10 ? 6 : 4); i++) {
        const k = (t * 0.6 + i / 4 + seed) % 1, px = x + Math.sin(i * 2.3 + seed) * r * 0.9;
        spr(c, 'star_04', i % 2 ? '#ffffff' : col, px, fy - k * r * 2.6, 16, 16, 0, 1 - k);
      }
    }
    if (tier >= 9) {
      rune(c, 1, col, x, fy, r * 4, -t * 0.6, 0.7, 0.42, 'magic_01');
      if (lod >= 2) for (let i = 0; i < (tier >= 10 ? 6 : 4); i++) {
        const a = -t * 1.6 + (i * Math.PI * 2) / (tier >= 10 ? 6 : 4), rr = r * 1.9;
        spr(c, 'star_04', i % 2 ? '#ffffff' : col, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, 22, 22, 0, 0.95);
      }
    }
    if (tier >= 10) {
      spr(c, 'trace_06', col, x, y - r * 1.2, r * 2.2, r * 5, 0, 0.55 + Math.sin(t * 4 + seed) * 0.2);
      spr(c, 'flare_01', '#fff0c8', x, y - r * 3.4, r * 2.4, r * 2.4, t, 0.6);
      rune(c, 2, '#fff0c8', x, fy, r * 2.6, t * 1.4, 0.5, 0.42, 'magic_03');
    }
    return true;
  }

  root.RTD_SKFX = { fx, extra, tele, tierAura, setQuality: (q) => (Q = q), spr, tint, ready: () => loaded >= NAMES.length };
})(typeof window !== 'undefined' ? window : globalThis);
