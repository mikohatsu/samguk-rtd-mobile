// 스킬 이펙트와 6성 이상 후광. Kenney Particle Pack(CC0, gfx/kn_*.png)의 흰 그림을 스킬 색으로 물들여 겹쳐 그린다.
// 스킬마다 이름에 맞는 연출(vx)을 theme-samguk.js에서 붙인다. 그림이 아직 안 받아졌으면 false를 돌려 기존 연출로 그린다.
(function (root) {
  const KN = {}, TINT = {};
  const NAMES = ('circle_01 circle_02 circle_03 circle_05 light_01 light_02 light_03 magic_01 magic_02 magic_03 magic_04 magic_05 twirl_01 twirl_02 twirl_03 '
    + 'smoke_04 smoke_07 smoke_09 smoke_10 spark_01 spark_02 spark_05 spark_06 spark_07 slash_01 slash_03 slash_04 flame_01 flame_03 flame_05 flame_06 scratch_01 '
    + 'dirt_01 dirt_03 fire_01 fire_02 flare_01 muzzle_01 muzzle_02 muzzle_04 scorch_01 scorch_02 star_01 star_02 star_04 star_06 star_07 star_08 star_09 symbol_01 '
    + 'trace_01 trace_03 trace_05 trace_06').split(' ');
  let loaded = 0;
  function img(n) {
    let o = KN[n];
    if (!o) { o = KN[n] = { im: new Image(), ok: false }; o.im.onload = () => { o.ok = true; loaded++; }; o.im.src = 'gfx/kn_' + n + '.png?v=1'; }
    return o.ok ? o.im : null;
  }
  if (typeof document !== 'undefined') NAMES.forEach(img);
  // 흰 그림을 색으로 물들인 캔버스(색마다 한 번만 만든다)
  function tint(n, col) {
    const k = n + col; if (TINT[k]) return TINT[k];
    const im = img(n); if (!im) return null;
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
    return (TINT[k] = cv);
  }
  // 가운데 기준으로 그린다. col이 없으면 흰색 그대로, add면 빛처럼 더한다, sy는 바닥에 눕히는 납작함
  function spr(c, n, col, x, y, w, h, rot, a, add, sy) {
    if (!(a > 0.01)) return true;
    const im = col ? tint(n, col) : img(n); if (!im) return false;
    c.save(); if (add !== false) c.globalCompositeOperation = 'lighter';
    c.globalAlpha = Math.min(1, a); c.translate(x, y); if (sy) c.scale(1, sy); if (rot) c.rotate(rot);
    c.drawImage(im, -w / 2, -h / 2, w, h); c.restore(); return true;
  }
  const ready = (list) => list.every((n) => img(n));
  const ease = (p) => 1 - (1 - p) * (1 - p), cl = (v) => Math.max(0, Math.min(1, v)), bell = (p) => Math.sin(cl(p) * Math.PI);
  const WHITE = '#ffffff';
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
        if (!i) spr(c, 'slash_03', WHITE, d, 0, s * 0.6, s * 1.2, 0, a * 0.8);
      }
      c.restore(); return true;
    },
    throw(c, f, p) { // 단극·비도 투척: 여러 개가 줄지어 날아가 꽂힌다
      c.save(); c.translate(f.x, f.y); c.rotate(f.a);
      for (let i = 0; i < N(6); i++) {
        const q = cl(p * 2.2 - i * 0.14), d = ease(q) * f.len, y = ((i * 37) % 7 - 3) * f.w * 0.09;
        spr(c, 'trace_01', f.c, d, y, f.w * 0.5, f.w * 2.6, Math.PI / 2, q < 1 ? 1 : 0);
        if (q >= 1) spr(c, 'star_04', WHITE, f.len, y, f.w * 1.8, f.w * 1.8, i, 1 - cl((p - 0.45 - i * 0.06) * 3));
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
      spr(c, 'magic_01', f.c, f.x, f.y, s, s, p * 3, 1 - p, true, 0.7);
      spr(c, 'magic_02', f.c, f.x, f.y, s * 0.75, s * 0.75, -p * 4, 1 - p, true, 0.7);
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
    petals(c, f, p) { // 연무: 꽃잎 같은 하트와 반짝임이 춤춘다
      for (let i = 0; i < N(10); i++) { const a = i * 0.63 + p * 3, d = f.r * (0.3 + ease(p) * 1.1); spr(c, i % 2 ? 'symbol_01' : 'star_06', i % 2 ? f.c : WHITE, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - p * 30, 30, 30, a, 1 - p); }
      spr(c, 'light_02', f.c, f.x, f.y, f.r * 2.2, f.r * 2.2, p, bell(p) * 0.8);
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
      spr(c, 'magic_02', f.c, f.x, f.y, f.r * 2.2, f.r * 2.2, -p * 4, 1 - p, true, 0.6);
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
      spr(c, 'magic_01', f.c, f.x, f.y, f.r * 2.4 * (1 - p * 0.3), f.r * 2.4 * (1 - p * 0.3), p * 5, 1 - p, true, 0.6);
      spr(c, 'light_02', f.c, f.x, f.y, f.r * 1.8, f.r * 1.8, 0, bell(p) * 0.7);
      return true;
    },
    knives(c, f, p) { // 비도 난사: 사방에서 날붙이가 보스에 꽂힌다
      for (let i = 0; i < N(10); i++) {
        const a = i * 0.63, q = cl(p * 2 - (i % 4) * 0.1), d = f.r * 1.8 * (1 - ease(q));
        if (q < 1) spr(c, 'trace_01', f.c, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 10, 50, a + Math.PI / 2, 1);
        else spr(c, 'star_04', WHITE, f.x + Math.cos(a) * 20, f.y + Math.sin(a) * 20, 40, 40, i, 1 - cl((p - 0.5) * 3));
      }
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
      spr(c, 'magic_03', f.c, f.x, f.y - 10, f.r * 1.6, f.r * 1.6, p * 2, bell(p) * 0.8);
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
      spr(c, 'magic_02', f.c, f.x, f.y + 20, f.r * 2.2, f.r * 2.2, p * 2, bell(cl(p * 1.2)), true, 0.45);
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
      spr(c, 'magic_03', f.c, f.x, f.y - 10, f.r * 1.8, f.r * 1.8, p * 4, bell(p));
      spr(c, 'circle_02', f.c, f.x, f.y - 10, f.r * 1.5, f.r * 1.5, 0, bell(p) * 0.8);
      for (let i = 0; i < N(4); i++) spr(c, i % 2 ? 'spark_01' : 'spark_02', WHITE, f.x + Math.cos(i * 1.57) * f.r * 0.6, f.y - 10 + Math.sin(i * 1.57) * f.r * 0.6, 60, 60, i, Math.random() < 0.6 ? bell(p) : 0);
      return true;
    },
  };

  // g.fx 한 개를 그린다(그렸으면 true)
  function fx(c, f, p) {
    const tab = f.k === 'beam' ? BEAM : f.k === 'cone' ? CONE : f.k === 'blast' ? BLAST : f.k === 'aura' ? AURA : null;
    const fn = tab && (tab[f.vx] || (f.k === 'blast' ? BLAST.burst : null));
    if (!fn || !ready(['circle_02', 'light_01', 'star_09'])) return false;
    return fn(c, f, p) !== false;
  }
  // 원 스킬(내 장판)이 터지기 전 표시: 바닥에 도는 법진과 차오르는 고리
  function tele(c, h, p, fired) {
    if (!ready(['magic_02', 'circle_01'])) return false;
    if (fired) return true;
    spr(c, 'magic_02', h.c, h.x, h.y, h.r * 2.2, h.r * 2.2, p * 3, 0.5 + p * 0.4, true, 0.75);
    spr(c, 'circle_01', h.c, h.x, h.y, h.r * 2 * p, h.r * 2 * p, 0, 0.9, true, 0.75);
    return true;
  }

  // ---- 6성 이상 후광 ----
  function tierAura(c, x, y, r, tier, col, t, seed, low) {
    if (!ready(['light_02', 'magic_02', 'magic_01', 'twirl_01', 'trace_06', 'flare_01', 'star_04', 'magic_03'])) return false;
    const fy = y + r * 0.72, pulse = 1 + Math.sin(t * 3 + seed) * 0.08;
    spr(c, 'light_02', col, x, fy, r * (tier >= 9 ? 4.4 : tier >= 8 ? 3.8 : 3.2) * pulse, r * 3.2 * pulse, t * 0.4, tier >= 8 ? 0.7 : 0.55, true, 0.45);
    if (tier >= 7) spr(c, 'magic_02', col, x, fy, r * 3, r * 3, t * 0.9, 0.75, true, 0.42);
    if (tier >= 8) {
      spr(c, 'twirl_01', col, x, y, r * 3, r * 3, t * 2.2, 0.6);
      if (!low) for (let i = 0; i < (tier >= 10 ? 6 : 4); i++) {
        const k = (t * 0.6 + i / 4 + seed) % 1, px = x + Math.sin(i * 2.3 + seed) * r * 0.9;
        spr(c, 'star_04', i % 2 ? '#ffffff' : col, px, fy - k * r * 2.6, 16, 16, 0, 1 - k);
      }
    }
    if (tier >= 9) {
      spr(c, 'magic_01', col, x, fy, r * 4, r * 4, -t * 0.6, 0.7, true, 0.42);
      if (!low) for (let i = 0; i < (tier >= 10 ? 6 : 4); i++) {
        const a = -t * 1.6 + (i * Math.PI * 2) / (tier >= 10 ? 6 : 4), rr = r * 1.9;
        spr(c, 'star_04', i % 2 ? '#ffffff' : col, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, 22, 22, 0, 0.95);
      }
    }
    if (tier >= 10) {
      spr(c, 'trace_06', col, x, y - r * 1.2, r * 2.2, r * 5, 0, 0.55 + Math.sin(t * 4 + seed) * 0.2);
      spr(c, 'flare_01', '#fff0c8', x, y - r * 3.4, r * 2.4, r * 2.4, t, 0.6);
      spr(c, 'magic_03', '#fff0c8', x, fy, r * 2.6, r * 2.6, t * 1.4, 0.5, true, 0.42);
    }
    return true;
  }

  root.RTD_SKFX = { fx, tele, tierAura, setQuality: (q) => (Q = q), spr, ready: () => loaded >= NAMES.length };
})(typeof window !== 'undefined' ? window : globalThis);
