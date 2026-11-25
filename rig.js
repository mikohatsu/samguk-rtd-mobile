// 조각 애니메이션(2D 컷아웃): 기존 SD 그림(앞모습 <id>, 옆모습 <id>_s)을 몸통과 팔·무기 조각으로 잘라(gfx/rig_<id>_<f|s>_*.png),
// 손·어깨를 축으로 팔과 무기를 움직이고 몸 전체를 기울이고 들썩여 움직인다. 그림체는 기존 그림 그대로다.
// 동작: 대기(숨쉬기)·걷기·공격·스킬·피격·쓰러짐 + 보스 기술 동작(act):
//   omni  전방위 — 정면에서 두 팔을 벌려 기를 모았다가 터뜨린다
//   raise 소환·낙뢰 — 무기를 하늘로 치켜들고 다른 손을 펼쳤다가 내리찍는다
//   aim   겨누기 — 옆모습으로 상대를 향해 내지른다
// 조각 그림이 없는 방향은 기존 한 장 그림을 쓴다.
(function (root) {
  // 뼈대 정보(원본 그림 픽셀 기준). 옆모습은 오른쪽을 본다.
  // role: weapon = 무기 든 손(무기 포함), off = 빈손. 각도 −는 반시계(앞모습에서는 두 팔 모두 바깥·위로 벌어짐)
  const RIGS = {
    gwanu: { kind: 'heavy', views: {
      s: { w: 162, h: 175, hip: [72, 140], parts: [{ id: 'arm', role: 'weapon', pivot: [89, 123], z: 3 }] } } },
    b_janggak: { kind: 'staff', views: {
      s: { w: 145, h: 169, hip: [70, 130], parts: [{ id: 'arm', role: 'weapon', pivot: [98, 97], z: 3 }] },
      f: { w: 167, h: 176, hip: [80, 140], parts: [{ id: 'arm', role: 'off', pivot: [106, 96], z: 2 }, { id: 'staff', role: 'weapon', pivot: [46, 96], z: 3 }] } } },
    // 나머지 보스(옆모습이 없는 화웅·원소는 앞모습만). dir −1: 칼끝이 아래를 향해 들고 있어 회전 방향을 뒤집는다.
    // 제갈량은 깃털 부채가 얼굴·가슴을 덮고 있어 떼어 내지 않고 몸 전체 움직임만 쓴다.
    b_hwawoong: { kind: 'heavy', views: {
      f: { w: 174, h: 183, hip: [95, 150], parts: [{ id: 'off', role: 'off', pivot: [145, 98], z: 2 }, { id: 'weapon', role: 'weapon', pivot: [38, 110], z: 3 }] } } },
    b_wonso: { kind: 'heavy', views: {
      f: { w: 177, h: 189, hip: [95, 160], parts: [{ id: 'weapon', role: 'weapon', pivot: [48, 128], z: 3, dir: -1 }] } } },
    b_dongtak: { kind: 'heavy', views: {
      f: { w: 158, h: 170, hip: [80, 140], parts: [{ id: 'off', role: 'off', pivot: [116, 78], z: 2 }, { id: 'weapon', role: 'weapon', pivot: [18, 90], z: 3 }] },
      s: { w: 149, h: 169, hip: [75, 140], parts: [{ id: 'weapon', role: 'weapon', pivot: [22, 90], z: 3 }] } } },
    b_yeopo: { kind: 'heavy', views: {
      f: { w: 188, h: 170, hip: [100, 140], parts: [{ id: 'off', role: 'off', pivot: [104, 100], z: 2 }, { id: 'weapon', role: 'weapon', pivot: [52, 110], z: 3 }] },
      s: { w: 191, h: 169, hip: [100, 140], parts: [{ id: 'weapon', role: 'weapon', pivot: [138, 127], z: 3 }] } } },
    b_jojo: { kind: 'heavy', views: {
      f: { w: 188, h: 187, hip: [95, 160], parts: [{ id: 'off', role: 'off', pivot: [122, 100], z: 2 }, { id: 'weapon', role: 'weapon', pivot: [44, 124], z: 3, dir: -1 }] },
      s: { w: 93, h: 180, hip: [50, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [30, 124], z: 3 }] } } },
    b_yukson: { kind: 'heavy', views: {
      f: { w: 173, h: 180, hip: [95, 150], parts: [{ id: 'off', role: 'off', pivot: [128, 104], z: 2 }, { id: 'weapon', role: 'weapon', pivot: [54, 105], z: 3 }] },
      s: { w: 179, h: 182, hip: [85, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [142, 108], z: 3 }] } } },
    b_jegal: { kind: 'staff', views: {
      f: { w: 94, h: 181, hip: [47, 150], parts: [] },
      s: { w: 112, h: 182, hip: [50, 150], parts: [] } } },
    b_deungae: { kind: 'heavy', views: {
      f: { w: 131, h: 187, hip: [70, 150], parts: [{ id: 'off', role: 'off', pivot: [78, 98], z: 2 }, { id: 'weapon', role: 'weapon', pivot: [16, 100], z: 3 }] },
      s: { w: 128, h: 185, hip: [60, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [102, 103], z: 3 }] } } },
    b_samaui: { kind: 'staff', views: {
      f: { w: 115, h: 186, hip: [60, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [20, 103], z: 3 }] },
      s: { w: 109, h: 184, hip: [60, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [32, 104], z: 3 }] } } },
    // 장수(옆모습 그림이 있는 장수). 보스와 같은 그림을 쓰는 장수(조조·여포 등)는 아래 res()가 보스 조각을 그대로 쓴다.
    seohwang: { kind: 'heavy', views: { s: { w: 131, h: 161, hip: [55, 130], parts: [{ id: 'weapon', role: 'weapon', pivot: [90, 96], z: 3 }] } } },
    seoseo: { kind: 'heavy', views: { s: { w: 119, h: 182, hip: [70, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [48, 128], z: 3, dir: -1 }] } } },
    jeongbo: { kind: 'heavy', views: { s: { w: 111, h: 179, hip: [50, 145], parts: [{ id: 'weapon', role: 'weapon', pivot: [96, 110], z: 3 }] } } },
    jegalgeun: { kind: 'staff', views: { s: { w: 96, h: 184, hip: [45, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [68, 108], z: 3 }] } } },
    hwangwol: { kind: 'staff', views: { s: { w: 147, h: 181, hip: [60, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [88, 108], z: 3 }] } } },
    bangtong: { kind: 'staff', views: { s: { w: 97, h: 186, hip: [55, 155], parts: [{ id: 'weapon', role: 'weapon', pivot: [22, 108], z: 3 }] } } },
    songyeon: { kind: 'heavy', views: { s: { w: 141, h: 174, hip: [60, 140], parts: [{ id: 'weapon', role: 'weapon', pivot: [110, 108], z: 3 }] } } },
    sonhyang: { kind: 'staff', views: { s: { w: 132, h: 181, hip: [60, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [106, 106], z: 3 }] } } },
    yeoryeong: { kind: 'heavy', views: { s: { w: 179, h: 194, hip: [80, 160], parts: [{ id: 'weapon', role: 'weapon', pivot: [106, 136], z: 3 }] } } },
    chugyung: { kind: 'heavy', views: { s: { w: 128, h: 184, hip: [65, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [108, 100], z: 3 }] } } },
    gwakga: { kind: 'staff', views: { s: { w: 106, h: 177, hip: [60, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [32, 104], z: 3 }] } } },
    join: { kind: 'heavy', views: { s: { w: 135, h: 182, hip: [60, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [104, 118], z: 3 }] } } },
    sunuk: { kind: 'staff', views: { s: { w: 85, h: 173, hip: [42, 145], parts: [{ id: 'weapon', role: 'weapon', pivot: [64, 100], z: 3 }] } } },
    jangbi: { kind: 'heavy', views: { s: { w: 117, h: 182, hip: [70, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [61, 116], z: 3 }] } } },
    joun: { kind: 'heavy', views: { s: { w: 160, h: 184, hip: [60, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [94, 114], z: 3 }] } } },
    sonchaek: { kind: 'heavy', views: { s: { w: 130, h: 186, hip: [70, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [67, 116], z: 3 }] } } },
    yubi: { kind: 'heavy', views: { s: { w: 95, h: 183, hip: [50, 145], parts: [{ id: 'weapon', role: 'weapon', pivot: [36, 130], z: 3 }] } } },
    songwon: { kind: 'heavy', views: { s: { w: 190, h: 180, hip: [90, 145], parts: [{ id: 'weapon', role: 'weapon', pivot: [136, 124], z: 3 }] } } },
    juyu: { kind: 'heavy', views: { s: { w: 136, h: 188, hip: [65, 150], parts: [{ id: 'weapon', role: 'weapon', pivot: [108, 96], z: 3 }] } } },
  };
  // 장수 id → 조각 이름(보스와 같은 그림을 쓰는 장수는 보스 조각)
  const res = (id) => (RIGS[id] ? id : RIGS['b_' + id] ? 'b_' + id : id);
  const VER = 6; // 6: 보스 조각 2배 해상도(art_src/build-boss-hires.py). 조각은 원래 크기(R.w×R.h)로 줄여 그리므로 좌표·관절은 그대로
  const img = {}, ready = {};
  function load(id, v) {
    const key = id + '_' + v;
    if (ready[key] !== undefined || typeof Image === 'undefined') return;
    ready[key] = false;
    const R = RIGS[id].views[v], names = ['body'].concat(R.parts.map((p) => p.id));
    let left = names.length;
    names.forEach((n) => {
      const im = new Image();
      im.onload = () => { if (--left === 0) ready[key] = true; };
      im.onerror = () => { ready[key] = null; };
      im.src = `gfx/rig_${key}_${n}.png?v=${VER}`;
      img[key + '_' + n] = im;
    });
  }
  // has(id) = 옆모습이 있나, has(id, 'f') = 그 방향 조각이 준비됐나
  const has = (id, v) => { id = res(id); v = v || 's'; const R = RIGS[id]; if (!R || !R.views[v]) return false; load(id, v); return ready[id + '_' + v] === true; };
  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const lerp = (a, b, k) => a + (b - a) * k;
  // 세 단계(모으기 → 터뜨리기 → 돌아오기) 사이를 이어 준다. A: 모은 자세, B: 터뜨린 자세
  function phase(P, p, wind, hit, A, B) {
    let k, from, to;
    if (p < wind) { k = ease(p / wind); from = null; to = A; }
    else if (p < hit) { k = ease((p - wind) / (hit - wind)); from = A; to = B; }
    else { k = ease((p - hit) / (1 - hit)); from = B; to = null; }
    for (const n in Object.assign({}, A, B)) {
      const base = n === 'bsy' ? 1 : n === 'glow' ? 0 : P[n] || 0;
      const a = from ? (from[n] ?? (n === 'bsy' ? 1 : 0)) : base, b = to ? (to[n] ?? (n === 'bsy' ? 1 : 0)) : base;
      P[n] = lerp(a, b, k);
    }
  }
  // 동작마다 조각 각도·위치와 몸 기울기·위치
  function poseFor(R, st, kind) {
    const t = st.t || 0, P = { body: 0, bx: 0, by: 0, bsy: 1, weapon: 0, weaponY: 0, off: 0, offY: 0, glow: 0 };
    const breath = Math.sin(t * 2.6);
    P.bsy = 1 + breath * 0.015; P.weapon = Math.sin(t * 2.6 + 1.1) * 0.04; P.off = Math.sin(t * 2.6 + 2) * 0.05;
    const p = st.p || 0, sk = st.state === 'skill';
    if (st.state === 'walk') {
      const w = t * 9;
      P.by = -Math.abs(Math.sin(w)) * 6; P.body = (st.view === 'f' ? 0 : 0.05) + Math.sin(w) * 0.03; P.weapon = Math.sin(w + 0.5) * 0.08; P.off = -Math.sin(w + 0.5) * 0.1; P.bsy = 1 - Math.abs(Math.cos(w)) * 0.03;
    } else if ((st.state === 'attack' || sk) && (st.act === 'omni' || (st.view === 'f' && st.act !== 'raise'))) {
      // 전방위: 두 팔을 활짝 벌리며 솟아 기를 모으고, 터질 때 아래로 내뻗으며 웅크린다
      phase(P, p, 0.45, 0.6,
        { weapon: -0.4, weaponY: -10, off: -0.75, offY: -4, by: -9, bsy: 1.06, glow: 1 },
        { weapon: 0.18, weaponY: 3, off: 0.25, offY: 2, by: 4, bsy: 0.9, glow: 1 });
    } else if ((st.state === 'attack' || sk) && st.act === 'raise') {
      // 소환·낙뢰: 무기를 하늘로 치켜들고 빈손을 펼쳤다가, 무기를 내리꽂는다
      phase(P, p, 0.45, 0.6,
        { weapon: st.view === 'f' ? -0.12 : -0.75, weaponY: -20, off: -0.85, offY: -6, by: -6, bsy: 1.05, glow: 1 },
        { weapon: st.view === 'f' ? 0.05 : 0.3, weaponY: 6, off: -0.25, by: 3, bsy: 0.92, glow: 1 });
    } else if (st.state === 'attack' || sk) {
      // 겨누기(기본 공격·스킬): 무기를 들었다가 앞으로 내지른다
      const staff = kind === 'staff';
      const up = staff ? (sk ? -0.7 : -0.45) : sk ? -1.3 : -0.9, down = staff ? (sk ? 0.4 : 0.3) : sk ? 0.9 : 0.65;
      phase(P, p, sk ? 0.45 : 0.32, sk ? 0.62 : 0.55,
        { weapon: up, body: -0.12, bx: -6, by: -3, bsy: 1.04, glow: sk ? 1 : 0 },
        { weapon: down, body: 0.16, bx: sk ? 22 : 14, bsy: 0.94, glow: sk ? 1 : 0 });
    } else if (st.state === 'hurt') {
      const k = st.k || 0;
      if (st.view === 'f') { P.by = -4 * k; P.bsy = 1 - 0.07 * k; P.weapon = -0.25 * k; P.off = -0.4 * k; }
      else { P.body = -0.18 * k; P.bx = -8 * k; P.weapon = -0.3 * k; P.bsy = 1 - 0.05 * k; }
    }
    return P;
  }
  // 조각을 한 장으로 합친 뒤 기존 그림처럼 진한 외곽선을 두른다.
  // 합성은 무겁다(캔버스 3장을 오가며 10번 넘게 그림). 그래서 동작을 몇 장의 프레임으로 끊어(대기 12·걷기 10·공격/스킬 12·피격 4)
  // 한 번 만든 프레임은 저장해 두고, 그 뒤로는 그림 한 장 찍는 값으로 그린다. 저장량이 넘치면 오래 안 쓴 것부터 버린다.
  const PAD = 90;
  let work = null, sil = null;
  function canv(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  const cache = new Map(); let cachePx = 0;
  const CACHE_MAX = 16e6; // 저장할 픽셀 수 상한(약 64MB). 보스 조각이 2배 해상도라 프레임 하나가 최대 4배 커져 10e6에서 올렸다
  const TAU = Math.PI * 2;
  // 동작 상태를 프레임 번호로 끊는다: [저장 키, 그 프레임의 상태]
  function quant(st, v) {
    const s = st.state || 'idle';
    if (s === 'walk') { const n = 10, i = Math.floor((((st.t || 0) * 9) / TAU % 1 + 1) % 1 * n); return ['w' + i, { state: 'walk', view: v, t: (i / n) * TAU / 9 }]; }
    if (s === 'attack' || s === 'skill') { const n = 12, i = Math.max(0, Math.min(n, Math.round((st.p || 0) * n))); return [s[0] + (st.act || '') + i, { state: s, act: st.act, view: v, p: i / n, t: 0 }]; }
    if (s === 'hurt') { const n = 4, i = Math.max(1, Math.min(n, Math.round((st.k || 0) * n))); return ['h' + i, { state: 'hurt', view: v, k: i / n, t: 0 }]; }
    const n = 12, i = Math.floor((((st.t || 0) * 2.6) / TAU % 1 + 1) % 1 * n);
    return ['i' + i, { state: 'idle', view: v, t: (i / n) * TAU / 2.6 }];
  }
  // 한 프레임 합성: q = 해상도 배율(화면에 그려질 크기에 맞춰 0.2~1)
  function compose(key, R, kind, st, q) {
    const P = poseFor(R, st, kind);
    const W = R.w + PAD * 2, H = R.h + PAD * 2, wp = Math.ceil(W * q), hp = Math.ceil(H * q);
    if (!work || work.width < wp || work.height < hp) { work = canv(Math.max(wp, work ? work.width : 0), Math.max(hp, work ? work.height : 0)); sil = canv(work.width, work.height); }
    const w = work.getContext('2d');
    w.setTransform(1, 0, 0, 1, 0, 0); w.globalCompositeOperation = 'source-over'; w.globalAlpha = 1; w.clearRect(0, 0, work.width, work.height);
    w.setTransform(q, 0, 0, q, 0, 0);
    w.translate(PAD + P.bx, PAD + P.by);
    // 몸 전체: 발 기준으로 숨쉬기, 엉덩이 기준으로 기울이기
    const fx = R.w / 2, fy = R.h;
    w.translate(fx, fy); w.scale(1, P.bsy); w.translate(-fx, -fy);
    w.translate(R.hip[0], R.hip[1]); w.rotate(P.body); w.translate(-R.hip[0], -R.hip[1]);
    const order = [{ id: 'body', z: 0 }].concat(R.parts).sort((a, b) => a.z - b.z);
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity; // 조각이 실제로 덮는 범위(작업 캔버스 화소)
    for (const pt of order) {
      const im = img[key + '_' + pt.id];
      if (!im || !im.complete) continue;
      const a = pt.role ? (P[pt.role] || 0) * (pt.dir || 1) : 0, dy = pt.role ? P[pt.role + 'Y'] || 0 : 0;
      w.save();
      if (dy) w.translate(0, dy);
      if (a) { w.translate(pt.pivot[0], pt.pivot[1]); w.rotate(a); w.translate(-pt.pivot[0], -pt.pivot[1]); }
      w.drawImage(im, 0, 0, R.w, R.h);
      { const m = w.getTransform(); for (const [px, py] of [[0, 0], [R.w, 0], [0, R.h], [R.w, R.h]]) { const X = m.a * px + m.c * py + m.e, Y = m.b * px + m.d * py + m.f; if (X < bx0) bx0 = X; if (X > bx1) bx1 = X; if (Y < by0) by0 = Y; if (Y > by1) by1 = Y; } }
      // 기술: 무기가 빛난다
      if (pt.role === 'weapon' && P.glow > 0.05) { w.globalCompositeOperation = 'lighter'; w.globalAlpha = P.glow * 0.55; w.drawImage(im, 0, 0, R.w, R.h); }
      w.restore();
    }
    // 외곽선용 실루엣
    const sc = sil.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, sil.width, sil.height);
    sc.drawImage(work, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#140c06'; sc.fillRect(0, 0, wp, hp);
    // 기존 그림과 같은 외곽선: 152칸 기준 3px
    const k = Math.min(122 / R.h, 144 / R.w), ol = (3 / k) * q;
    // 성능: 저장 캔버스는 여백(PAD)을 뺀 실제 그림 범위(+외곽선)만 남긴다. 여백이 넓이의 절반 이상이라 같은 캐시 상한에 프레임이 2~3배 들어간다
    // (보스전에서 캐시가 넘쳐 초당 약 10번 다시 합성하던 것). 위치·배율은 그대로라 그려지는 모습은 같다.
    const e = Math.ceil(ol) + 2, cx0 = Math.max(0, Math.floor(bx0) - e), cy0 = Math.max(0, Math.floor(by0) - e);
    const cx1 = Math.min(wp, Math.ceil(bx1) + e), cy1 = Math.min(hp, Math.ceil(by1) + e);
    const trim = isFinite(bx0) && cx1 > cx0 && cy1 > cy0, ox = trim ? cx0 : 0, oy = trim ? cy0 : 0, ow = trim ? cx1 - cx0 : wp, oh = trim ? cy1 - cy0 : hp;
    const out = canv(ow, oh), o = out.getContext('2d');
    o.translate(-ox, -oy);
    for (let a = 0; a < 8; a++) o.drawImage(sil, 0, 0, wp, hp, Math.cos((a * Math.PI) / 4) * ol, Math.sin((a * Math.PI) / 4) * ol, wp, hp);
    o.drawImage(work, 0, 0, wp, hp, 0, 0, wp, hp);
    // 원래 캔버스(wp×hp)가 (W×H) 단위에 대응하던 배율 그대로 자른 조각의 자리를 적어 둔다
    const ux = W / wp, uy = H / hp;
    out._r = [ox * ux, oy * uy, ow * ux, oh * uy];
    return out;
  }
  // c: 캔버스, x,y: 기존 그림과 같은 기준점, size: 기존 그림 크기(r*3.7과 같은 기준), flip: 좌우 반전, st.view: 'f' 앞 / 's' 옆(기본)
  function draw(c, id, x, y, size, flip, st) {
    st = st || {}; id = res(id);
    const v = st.view || 's', RG = RIGS[id], R = RG && RG.views[v];
    if (!R || !has(id, v) || typeof document === 'undefined') return false;
    // 기존 그림과 같은 배치: 152칸에 높이 122(또는 폭 144)로 맞추고 발끝을 134에 둔다
    const k = Math.min(122 / R.h, 144 / R.w), s = (k * size) / 152, fx = R.w / 2, fy = R.h;
    // 화면에 실제로 그려질 배율에 맞춰 저장 해상도를 고른다(작게 그릴 유닛을 크게 저장하지 않는다)
    const m = c.getTransform ? c.getTransform() : null, eff = s * (m ? Math.hypot(m.a, m.b) : 1);
    // 원본보다 크게 저장하지 않는다: 2배 해상도 조각(보스)은 2까지, 나머지는 1까지
    const bim = img[id + '_' + v + '_body'], qMax = bim && bim.naturalWidth ? Math.max(1, Math.min(2, Math.round((bim.naturalWidth / R.w) * 5) / 5)) : 1;
    const q = Math.max(0.2, Math.min(qMax, Math.ceil(eff * 5) / 5));
    const [fk, qs] = quant(st, v), ck = id + '_' + v + '|' + fk + '|' + q;
    let cv = cache.get(ck);
    if (cv) { cache.delete(ck); cache.set(ck, cv); }
    else {
      cv = compose(id + '_' + v, R, RG.kind, qs, q);
      cache.set(ck, cv); cachePx += cv.width * cv.height;
      while (cachePx > CACHE_MAX && cache.size > 1) { const old = cache.keys().next().value, oc = cache.get(old); cachePx -= oc.width * oc.height; oc.width = oc.height = 0; if (oc._sil) { for (const k in oc._sil) oc._sil[k].width = oc._sil[k].height = 0; oc._sil = null; } cache.delete(old); }
    }
    c.save();
    c.translate(x, y + size * (134 / 152 - 0.6));
    if (st.state === 'dead') { const d = ease(st.k || 0); c.globalAlpha *= 1 - d * 0.6; c.rotate((flip ? 1 : -1) * d * 1.35); }
    c.scale(flip ? -s : s, s);
    const rr = cv._r || [0, 0, R.w + PAD * 2, R.h + PAD * 2];
    c.drawImage(cv, -fx - PAD + rr[0], -fy - PAD + rr[1], rr[2], rr[3]);
    // 맞았을 때 번쩍임: st.tint 색 실루엣을 st.tintA만큼 덮는다(흰색 = 보스 피격, 빨강 = 장수 피격). 프레임마다 한 번 만들어 둔다(ctx.filter는 느리다)
    if (st.tint && st.tintA > 0.01) { c.globalAlpha *= Math.min(1, st.tintA); c.drawImage(silOf(cv, st.tint), -fx - PAD + rr[0], -fy - PAD + rr[1], rr[2], rr[3]); }
    c.restore();
    return true;
  }
  // 그림 한 장의 한 색 실루엣(그림에 붙여 저장. 그림이 캐시에서 빠지면 같이 버린다)
  function silOf(im, col) {
    const m = im._sil || (im._sil = {});
    let s = m[col];
    if (s) return s;
    s = canv(im.width, im.height);
    const x = s.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, s.width, s.height);
    return (m[col] = s);
  }
  // 보스 처치: 조각이 몸에서 떨어져 나간다. 무기·빈손 조각은 바깥 위로 튕겨 돌며 떨어지고, 몸은 발끝을 축으로 넘어지며 가라앉고 흐려진다.
  // k: 0→1 진행, white: 흰 실루엣을 덮는 정도(부서지는 순간). 조각 그림 그대로라 외곽선은 없다(흰 번쩍임이 걷힐 때쯤엔 흐려지고 있다).
  function drawBreak(c, id, x, y, size, flip, v, k, white) {
    id = res(id);
    const RG = RIGS[id], R = RG && RG.views[v];
    if (!R || !has(id, v) || typeof document === 'undefined') return false;
    const key = id + '_' + v, s = (Math.min(122 / R.h, 144 / R.w) * size) / 152, fx = R.w / 2, fy = R.h, e = ease(k);
    c.save();
    c.translate(x, y + size * (134 / 152 - 0.6)); c.scale(flip ? -s : s, s);
    const ga = c.globalAlpha, order = [{ id: 'body', z: 0 }].concat(R.parts).sort((a, b) => a.z - b.z);
    order.forEach((pt, i) => {
      const im = img[key + '_' + pt.id];
      if (!im || !im.complete) return;
      c.save();
      if (pt.id === 'body') {
        c.translate(0, e * 14); c.rotate(-e * 1.3);
        c.globalAlpha = ga * (1 - Math.max(0, (k - 0.5) / 0.5));
      } else {
        // 조각마다 몸 가운데에서 바깥쪽으로(관절이 몸 가운데 어느 쪽에 있나) 튕긴다. 위로 솟았다가 떨어지며 돈다(그림 픽셀 단위)
        const px = pt.pivot[0] - fx, py = pt.pivot[1] - fy, dir = px < 0 ? -1 : 1, sp = 1 + i * 0.25;
        const dx = dir * (70 + 40 * i) * k, dy = -150 * sp * k + 260 * k * k;
        c.translate(px + dx, py + dy); c.rotate(dir * k * (2.6 + i)); c.translate(-px, -py);
        c.globalAlpha = ga * (1 - Math.max(0, (k - 0.6) / 0.4));
      }
      c.drawImage(im, -fx, -fy, R.w, R.h);
      if (white > 0.01) { c.globalAlpha *= Math.min(1, white); c.drawImage(silOf(im, '#ffffff'), -fx, -fy, R.w, R.h); }
      c.restore();
    });
    c.restore();
    return true;
  }
  // 보스전이 끝난 뒤 결투장 몫을 비운다(07-arena arenaFree): 작업 캔버스 2장(보스 2배 조각이라 각 약 10MB), 넘긴 id(지난 보스·출전 장수)의
  // 프레임 캐시와 그 실루엣, 조각 그림에 붙은 부서짐 실루엣. 다음에 그릴 때 다시 만든다(라인의 같은 장수는 작은 프레임만 다시 합성한다).
  function free(ids) {
    if (work) { work.width = work.height = 0; work = null; }
    if (sil) { sil.width = sil.height = 0; sil = null; }
    const keys = new Set((ids || []).map(res));
    if (!keys.size) return;
    const zap = (cv) => { if (cv._sil) { for (const k in cv._sil) cv._sil[k].width = cv._sil[k].height = 0; cv._sil = null; } };
    for (const [ck, cv] of [...cache]) {
      const k0 = ck.slice(0, ck.indexOf('|')), id = k0.slice(0, k0.lastIndexOf('_'));
      if (!keys.has(id)) continue;
      cachePx -= cv.width * cv.height; zap(cv); cv.width = cv.height = 0; cache.delete(ck);
    }
    for (const k in img) { const im = img[k]; if (im && im._sil && [...keys].some((id) => k.startsWith(id + '_'))) zap(im); }
  }
  // 보스 기술 종류(gen) → 동작
  const ACT = { nova: 'omni', rings: 'omni', spread: 'omni', safe: 'omni', gates: 'omni', gaze: 'omni',
    fan: 'aim', cross: 'aim', sweep: 'aim', charge: 'aim', line: 'aim', dash: 'aim' };
  const actOf = (gen) => ACT[gen] || 'raise';
  root.RTD_RIG = { has, draw, drawBreak, actOf, list: () => Object.keys(RIGS), cacheInfo: () => ({ n: cache.size, px: cachePx }), free };
})(typeof window !== 'undefined' ? window : globalThis);
