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
  const VER = 5;
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
  // 조각을 한 장으로 합친 뒤 기존 그림처럼 진한 외곽선을 두른다(작업용 캔버스 2장을 돌려 쓴다)
  const PAD = 90;
  let work = null, sil = null;
  function canv(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  // c: 캔버스, x,y: 기존 그림과 같은 기준점, size: 기존 그림 크기(r*3.7과 같은 기준), flip: 좌우 반전, st.view: 'f' 앞 / 's' 옆(기본)
  function draw(c, id, x, y, size, flip, st) {
    st = st || {}; id = res(id);
    const v = st.view || 's', RG = RIGS[id], R = RG && RG.views[v];
    if (!R || !has(id, v) || typeof document === 'undefined') return false;
    const key = id + '_' + v, P = poseFor(R, Object.assign({}, st, { view: v }), RG.kind);
    const W = R.w + PAD * 2, H = R.h + PAD * 2;
    if (!work || work.width < W || work.height < H) { work = canv(Math.max(W, work ? work.width : 0), Math.max(H, work ? work.height : 0)); sil = canv(work.width, work.height); }
    const w = work.getContext('2d');
    w.setTransform(1, 0, 0, 1, 0, 0); w.clearRect(0, 0, work.width, work.height);
    w.translate(PAD + P.bx, PAD + P.by);
    // 몸 전체: 발 기준으로 숨쉬기, 엉덩이 기준으로 기울이기
    const fx = R.w / 2, fy = R.h;
    w.translate(fx, fy); w.scale(1, P.bsy); w.translate(-fx, -fy);
    w.translate(R.hip[0], R.hip[1]); w.rotate(P.body); w.translate(-R.hip[0], -R.hip[1]);
    const order = [{ id: 'body', z: 0 }].concat(R.parts).sort((a, b) => a.z - b.z);
    for (const pt of order) {
      const im = img[key + '_' + pt.id];
      if (!im || !im.complete) continue;
      const a = pt.role ? (P[pt.role] || 0) * (pt.dir || 1) : 0, dy = pt.role ? P[pt.role + 'Y'] || 0 : 0;
      w.save();
      if (dy) w.translate(0, dy);
      if (a) { w.translate(pt.pivot[0], pt.pivot[1]); w.rotate(a); w.translate(-pt.pivot[0], -pt.pivot[1]); }
      w.drawImage(im, 0, 0);
      // 기술: 무기가 빛난다
      if (pt.role === 'weapon' && P.glow > 0.05) { w.globalCompositeOperation = 'lighter'; w.globalAlpha = P.glow * 0.55; w.drawImage(im, 0, 0); }
      w.restore();
    }
    // 외곽선용 실루엣
    const sc = sil.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, sil.width, sil.height);
    sc.drawImage(work, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#140c06'; sc.fillRect(0, 0, sil.width, sil.height);
    // 기존 그림과 같은 배치: 152칸에 높이 122(또는 폭 144)로 맞추고 발끝을 134에 둔다
    const k = Math.min(122 / R.h, 144 / R.w), s = (k * size) / 152, ol = 3 / k;
    c.save();
    c.translate(x, y + size * (134 / 152 - 0.6));
    if (st.state === 'dead') { const d = ease(st.k || 0); c.globalAlpha *= 1 - d * 0.6; c.rotate((flip ? 1 : -1) * d * 1.35); }
    c.scale(flip ? -s : s, s);
    c.translate(-fx - PAD, -fy - PAD);
    for (let a = 0; a < 8; a++) c.drawImage(sil, Math.cos((a * Math.PI) / 4) * ol, Math.sin((a * Math.PI) / 4) * ol);
    c.drawImage(work, 0, 0);
    c.restore();
    return true;
  }
  // 보스 기술 종류(gen) → 동작
  const ACT = { nova: 'omni', rings: 'omni', spread: 'omni', safe: 'omni', gates: 'omni', gaze: 'omni',
    fan: 'aim', cross: 'aim', sweep: 'aim', charge: 'aim', line: 'aim', dash: 'aim' };
  const actOf = (gen) => ACT[gen] || 'raise';
  root.RTD_RIG = { has, draw, actOf, list: () => Object.keys(RIGS) };
})(typeof window !== 'undefined' ? window : globalThis);
