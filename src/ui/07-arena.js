  function drawBossAt(c, x, y, t, flash) {
    const f = g.fight, bd = Art.facing(S.bossFace ?? Math.PI / 2), bMove = S.bossMove;
    const im = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, bd.v, bMove ? (Math.sin(t * 10) > 0 ? 1 : 2) : 0);
    Art.drawSprite(c, im, x, y - 56 * (BOSS_S - 1), 200 * BOSS_S, bd.flip, 0, flash ? 0.96 : 1);
    // 번쩍임은 캔버스 필터(brightness) 대신 같은 그림을 한 번 더 밝게 얹는다(필터는 휴대폰에서 매우 느리다)
    if (flash) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; Art.drawSprite(c, im, x, y - 56 * (BOSS_S - 1), 200 * BOSS_S, bd.flip, 0, 0.96); c.restore(); }
  }
  // 전장 바닥은 판마다 한 번만 그려 두고 찍는다(매 프레임 화면 전체에 그라디언트·무늬·그라디언트를 세 번 덧칠하던 것)
  // 저장 범위는 보스전 카메라가 볼 수 있는 곳(경기장 둘레)만: 지도 전체(3900×2210)의 45% 넓이라, 같은 메모리로 해상도를 1.45배 올린다
  // (보통 0.55→0.8, 낮음 0.4→0.58, 휴대폰 높음 0.7→1.0, PC 1.0→1.28 px/단위. 1.28 = 바닥 타일 원본 해상도).
  const AR = { x: (ARENA.x0 + ARENA.x1) / 2 - 1250, y: -330, w: 2500, h: 1540 };
  // 난간 배율과, 난간 가운데 줄이 경기장 경계선(ARENA)에서 바깥으로 나간 거리(아래 arenaRim). ARENA는 장수의 가운데 점이 갈 수 있는 끝이라,
  // 끝에 선 장수의 몸(발은 가운데에서 35단위 아래, 몸 반폭 35단위)이 난간 그림에 올라타지 않게 변마다 다르게 띄운다:
  // 위 40(기둥 아래 끝이 발보다 50단위 위) / 아래 65(난간 위 끝이 발 바로 밑) / 좌우 56(기둥 안쪽 끝이 몸 옆).
  const RIM_K = 70 / 104, RIM_D = { t: 40, b: 65, l: 56, r: 56 };
  const qArena = () => Math.min(1.28, qMap() * 1.45);
  let arenaCv = null, arenaKey = '';
  // 바닥 색(아트 디렉터 검수 2026-11-19): 경기장 색(theme의 ground·sky)의 색상은 살리되 채도는 28% 이하, 밝기는 가운데 32~38%로 맞춘다
  // (장수·보스 채도가 60~80%라 바닥이 탁해야 캐릭터가 뜬다). 색상은 보스별 지정값(FLOOR_HUE)을 쓴다.
  const hexHsl = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g2 = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g2, b), mn = Math.min(r, g2, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const h = mx === r ? ((g2 - b) / d + 6) % 6 : mx === g2 ? (b - r) / d + 2 : (r - g2) / d + 4;
    return [h * 60, d / (1 - Math.abs(2 * l - 1)), l];
  };
  const hslCss = (h, s, l) => `hsl(${Math.round(h)},${Math.round(s * 100)}%,${Math.round(l * 100)}%)`;
  // 보스(경기장)별 바닥 색상(도)과 밝기: 아트 디렉터 지정값(재검수 2026-11-19 art-review-v37b). 표에 없는 보스는 theme의 원래 색상.
  const FLOOR_HUE = { b_janggak: 200, b_hwawoong: 30, b_dongtak: 15, b_wonso: 75, b_yeopo: 280, b_jojo: 215, b_yukson: 140, b_jegal: 235, b_deungae: 15, b_samaui: 335 };
  const FLOOR_LUM = { b_dongtak: 0.31 };
  // 채도 상한을 따로 낮춘 경기장(기본 28%). 여포: 보라 갑옷과 바닥 색상이 가까워 바닥 채도를 낮춰 갑옷이 뜨게(2026-11-19 QA).
  // (조조 바닥 색상은 204 → 215: 장각 200과 거의 같은 색이라는 QA 지적, 아트 디렉터 제안값)
  const FLOOR_SAT = { b_yeopo: 0.14 };
  // 가운데 팔괘 문양을 넣는 경기장 무늬(flr_slab), 문양 지름(단위), 곱하기 투명도(그늘색 밝기 22%와 함께 먹선 자리를 약 40% 어둡게)
  const MARK_MOTIF = { altar: 1, bagua: 1, palace: 1 }, MARK_D = 600, MARK_A = 0.52;
  function floorCols(a, id) {
    const G = hexHsl(a.ground), K = hexHsl(a.sky), h = FLOOR_HUE[id] != null ? FLOOR_HUE[id] : G[0];
    const sm = FLOOR_SAT[id] || 0.28, s = Math.min(sm, G[1]), l = FLOOR_LUM[id] || Math.max(0.32, Math.min(0.38, G[2]));
    return { ground: hslCss(h, s, l), mark: hslCss(h, Math.min(0.35, s + 0.08), 0.22), sky: hslCss(h, Math.min(sm, K[1]), l * Math.max(0.5, Math.min(0.8, K[2] / Math.max(0.01, G[2])))) };
  }
  function arenaFloor(c, a, id) {
    const flr = Art.floorTex(a.motif), old = !flr && Art.img('tex_' + a.motif), col = floorCols(a, id);
    const mark = flr && MARK_MOTIF[a.motif] ? Art.pic('arena_mark') : null;
    const key = a.motif + col.ground + col.sky + qArena() + (flr ? 'f' : old ? 't' : '') + (mark ? 'm' : '');
    if (arenaKey !== key) {
      arenaKey = key;
      if (!arenaCv) arenaCv = document.createElement('canvas');
      const q = qArena(), w = AR.w, h = AR.h;
      arenaCv.width = Math.round(w * q); arenaCv.height = Math.round(h * q);
      const x = arenaCv.getContext('2d');
      x.setTransform(q, 0, 0, q, -AR.x * q, -AR.y * q);
      const gr = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1300);
      gr.addColorStop(0, col.ground); gr.addColorStop(1, col.sky);
      x.fillStyle = gr; x.fillRect(AR.x, AR.y, w, h);
      // 판마다 같은 배치가 되게 고정 난수
      let sd = 0; for (let i = 0; i < a.motif.length; i++) sd = (sd * 31 + a.motif.charCodeAt(i)) >>> 0;
      const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
      arenaCv._tex = !!(flr || old);
      if (flr) {
        // 바닥 무늬: 1024px 이음매 없는 타일(gfx/flr_*)을 재질별 크기(art.js floorUnit: 기본 800단위, 전돌 480단위)마다 그대로 반복한다(돌리거나 뒤집지 않는다).
        // 타일은 평균 밝기 128인 밝기 무늬라 overlay 한 번이면 경기장 색은 그대로 두고 결만 얹힌다(예전: 반투명 + 색 덮기 + 곱하기 세 번).
        const k = Art.floorUnit(a.motif) / flr.width;
        x.save(); x.scale(k, k); x.globalCompositeOperation = 'overlay'; x.fillStyle = x.createPattern(flr, 'repeat');
        x.fillRect(AR.x / k, AR.y / k, w / k, h / k); x.restore();
      } else if (old) {
        // 새 타일을 아직 못 받았을 때만: 예전 200px 무늬를 2배로(방향이 있는 무늬가 눕지 않게 돌리지 않는다)
        const ts = old.width * 2.0;
        x.save(); x.globalAlpha = 0.5;
        for (let row = 0, ty = AR.y - ts / 2; ty < AR.y + h; row++, ty += ts) for (let tx = AR.x - ts + (row % 2 ? ts / 2 : 0); tx < AR.x + w; tx += ts) x.drawImage(old, tx - 0.5, ty - 0.5, ts + 1, ts + 1);
        x.restore();
        x.fillStyle = gr; x.globalAlpha = 0.35; x.fillRect(AR.x, AR.y, w, h);
        x.globalAlpha = 1; x.globalCompositeOperation = 'multiply'; x.fillStyle = '#9a9288'; x.fillRect(AR.x, AR.y, w, h);
        x.globalCompositeOperation = 'source-over';
      }
      // 가운데 팔괘 문양(gfx/arena_mark, 1024px 먹선, art_src/build-arena-mark.py): 무늬가 flr_slab인 경기장(altar·bagua·palace)에만,
      // 지름 MARK_D단위로 경기장 가운데에 새김처럼 찍는다. 검정을 그대로 찍지 않고 이 경기장 바닥 색의 깊은 그늘색으로 물들여 곱하기로 얹어
      // 먹선 자리가 바닥보다 약 40% 어두워진다(바닥 결은 그대로 비친다. 장판 예고보다 눈에 띄지 않게). 저장본에 한 번만 그린다.
      if (mark) {
        const mc = document.createElement('canvas'); mc.width = mark.width; mc.height = mark.height;
        const m = mc.getContext('2d'); m.drawImage(mark, 0, 0);
        m.globalCompositeOperation = 'source-in'; m.fillStyle = col.mark; m.fillRect(0, 0, mc.width, mc.height);
        const mx = (ARENA.x0 + ARENA.x1) / 2, my = (ARENA.y0 + ARENA.y1) / 2;
        x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = MARK_A;
        x.drawImage(mc, mx - MARK_D / 2, my - MARK_D / 2, MARK_D, MARK_D); x.restore();
        mc.width = mc.height = 0; // 한 번 쓰고 버리는 1024px 판: GC를 기다리지 않고 바로 놓는다
      }
      // 큰 명암 층: 무늬 몇 칸을 덮는 크기의 얼룩이라 같은 무늬가 같은 밝기로 반복되는 게 덜 보인다
      const blobs = Q.level === 'low' ? 5 : 9;
      for (let i = 0; i < blobs; i++) {
        const bx = ARENA.x0 + rnd() * (ARENA.x1 - ARENA.x0), by = ARENA.y0 + rnd() * (ARENA.y1 - ARENA.y0), r = 260 + rnd() * 280, dark = i % 3 !== 2;
        const bg = x.createRadialGradient(bx, by, 0, bx, by, r);
        bg.addColorStop(0, dark ? 'rgba(20,14,8,.22)' : 'rgba(255,236,200,.07)'); bg.addColorStop(1, dark ? 'rgba(20,14,8,0)' : 'rgba(255,236,200,0)');
        x.fillStyle = bg; x.fillRect(bx - r, by - r, r * 2, r * 2);
      }
      // 무대 조명: 경기장 가운데를 밝게(screen)
      const cx = (ARENA.x0 + ARENA.x1) / 2, cy = (ARENA.y0 + ARENA.y1) / 2, sr = Math.max(ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0) * 0.62;
      const lg = x.createRadialGradient(cx, cy, 0, cx, cy, sr);
      lg.addColorStop(0, 'rgba(255,235,190,.16)'); lg.addColorStop(0.55, 'rgba(255,235,190,.06)'); lg.addColorStop(1, 'rgba(255,235,190,0)');
      x.globalCompositeOperation = 'screen'; x.fillStyle = lg; x.fillRect(cx - sr, cy - sr, sr * 2, sr * 2);
      x.globalCompositeOperation = 'source-over';
      // 난간 밖은 같은 바닥을 45% 어둡게(바닥 결은 그대로 보인다. 예전의 58% 덮개 + 흐린 경계가 아니라 난간 가운데 줄에서 딱 끊는다),
      // 거기서 바깥으로 520단위에 걸쳐 50%까지 더 어두워진다(화면 가장자리 쪽이 가장 어둡다. 모서리는 두 변이 겹쳐 더 어둡다)
      {
        const X0 = ARENA.x0 - RIM_D.l, X1 = ARENA.x1 + RIM_D.r, Y0 = ARENA.y0 - RIM_D.t, Y1 = ARENA.y1 + RIM_D.b, V = 520, D0 = 'rgba(6,5,4,0)', D1 = 'rgba(6,5,4,.5)';
        x.fillStyle = 'rgba(6,5,4,.45)'; x.beginPath(); x.rect(AR.x, AR.y, w, h); x.rect(X0, Y0, X1 - X0, Y1 - Y0); x.fill('evenodd');
        const fade = (gx0, gy0, gx1, gy1, rx, ry, rw, rh) => { const eg = x.createLinearGradient(gx0, gy0, gx1, gy1); eg.addColorStop(0, D0); eg.addColorStop(1, D1); x.fillStyle = eg; x.fillRect(rx, ry, rw, rh); };
        fade(0, Y0, 0, Y0 - V, AR.x, AR.y, w, Y0 - AR.y); fade(0, Y1, 0, Y1 + V, AR.x, Y1, w, AR.y + h - Y1);
        fade(X0, 0, X0 - V, 0, AR.x, AR.y, X0 - AR.x, h); fade(X1, 0, X1 + V, 0, X1, AR.y, AR.x + w - X1, h);
      }
    }
    // 아주 넓은 화면(32:9 등)에서 저장 범위 밖이 보이면 그 자리만 바깥 색으로 메운다
    if (S.base) { const s = S.base.s0 * S.cam.z; if (S.base.sw / s > AR.w - 120 || S.base.sh / s > AR.h - 120) { c.fillStyle = '#0c0a08'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); } }
    blitBg(c, arenaCv, 'arena', arenaKey, AR);
    return arenaCv._tex;
  }
  // 경기장 경계 난간(gfx/arena_rim: 정사각 틀 그림, 한 변에 기둥 3개). 늘이지 않는다: 모서리 4개는 원본 비율 그대로,
  // 변은 "기둥 하나 + 양옆 난간 반 칸"(원본 167px)을 같은 배율로 되풀이해 깐다(칸 수를 반올림해 칸 폭만 몇 % 맞춘다).
  // 배율은 원본 1px = 0.673단위(두께 104px → 70단위). 난간 가운데 줄은 경기장 경계선에서 RIM_D만큼 바깥.
  // 매 프레임 50번쯤 찍지 않게 네 변을 띠 4장으로 한 번 그려 두고 찍는다. 그림이 아직 없으면 예전 경계선.
  let rimCv = null, rimKey = '';
  function rimPaint(x, im) {
    const k = RIM_K, X0 = ARENA.x0 - RIM_D.l, X1 = ARENA.x1 + RIM_D.r, Y0 = ARENA.y0 - RIM_D.t, Y1 = ARENA.y1 + RIM_D.b;
    // 원본(800×802)에서 잰 자리: 위 난간 가운데 y 65.5, 아래 735.5, 왼쪽 x 56.5, 오른쪽 747. 변의 한 칸은 x(또는 y) 317~484.
    const run = (a0, a1, cell, put) => { const n = Math.max(1, Math.round((a1 - a0) / (cell * k))), d = (a1 - a0) / n; for (let i = 0; i < n; i++) put(a0 + i * d, d); };
    run(X0 + 51.5 * k, X1 - 55 * k, 167, (p, d) => x.drawImage(im, 317, 0, 167, 112, p - 0.3, Y0 - 65.5 * k, d + 0.6, 112 * k));
    run(X0 + 47.5 * k, X1 - 51 * k, 167, (p, d) => x.drawImage(im, 317, 690, 167, 112, p - 0.3, Y1 - 45.5 * k, d + 0.6, 112 * k));
    run(Y0 + 58.5 * k, Y1 - 51.5 * k, 168, (p, d) => x.drawImage(im, 0, 328, 100, 168, X0 - 56.5 * k, p - 0.3, 100 * k, d + 0.6));
    run(Y0 + 64.5 * k, Y1 - 51.5 * k, 168, (p, d) => x.drawImage(im, 700, 328, 100, 168, X1 - 47 * k, p - 0.3, 100 * k, d + 0.6));
    x.drawImage(im, 0, 0, 108, 124, X0 - 56.5 * k, Y0 - 65.5 * k, 108 * k, 124 * k);
    x.drawImage(im, 692, 0, 108, 130, X1 - 55 * k, Y0 - 65.5 * k, 108 * k, 130 * k);
    x.drawImage(im, 0, 684, 104, 118, X0 - 56.5 * k, Y1 - 51.5 * k, 104 * k, 118 * k);
    x.drawImage(im, 696, 684, 104, 118, X1 - 51 * k, Y1 - 51.5 * k, 104 * k, 118 * k);
  }
  function arenaRim(c, f, a) {
    const im = Art.pic('arena_rim'), aw = ARENA.x1 - ARENA.x0, ah = ARENA.y1 - ARENA.y0;
    c.save(); c.globalAlpha = a;
    if (im) {
      const q = qArena(), key = q + '|' + im.width;
      if (rimKey !== key) {
        rimKey = key;
        const k = RIM_K, P = 4, X0 = ARENA.x0 - RIM_D.l, X1 = ARENA.x1 + RIM_D.r, Y0 = ARENA.y0 - RIM_D.t, Y1 = ARENA.y1 + RIM_D.b;
        const xl = X0 - 57 * k - P, xr = X1 + 54 * k + P, yt = Y0 - 66 * k - P, y1 = Y0 + 66 * k + P, y2 = Y1 - 52 * k - P, yb = Y1 + 68 * k + P;
        rimCv = [{ x: xl, y: yt, w: xr - xl, h: y1 - yt }, { x: xl, y: y2, w: xr - xl, h: yb - y2 }, { x: xl, y: y1, w: X0 + 45 * k + P - xl, h: y2 - y1 }, { x: X1 - 48 * k - P, y: y1, w: xr - (X1 - 48 * k - P), h: y2 - y1 }].map((R) => {
          const cv = document.createElement('canvas'); cv.width = Math.ceil(R.w * q); cv.height = Math.ceil(R.h * q);
          const x = cv.getContext('2d'); x.setTransform(cv.width / R.w, 0, 0, cv.height / R.h, (-R.x * cv.width) / R.w, (-R.y * cv.height) / R.h); rimPaint(x, im);
          return { cv, R };
        });
      }
      rimCv.forEach((o) => c.drawImage(o.cv, o.R.x, o.R.y, o.R.w, o.R.h));
    } else {
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 4; c.strokeRect(ARENA.x0 - 2, ARENA.y0 - 2, aw + 4, ah + 4);
      c.strokeStyle = f.def.fx + '88'; c.lineWidth = 1.5; c.strokeRect(ARENA.x0, ARENA.y0, aw, ah);
    }
    c.restore();
  }
  // 보스전이 끝나면(처치 연출까지 끝나 라인으로 돌아온 뒤) 결투장 전용 캔버스를 비운다(2026-11-25 통합. 보스 그림 2배 뒤 첫 보스 후 캔버스 메모리가
  // 52 → 141MB로 뛰고 라인에서도 그대로 남았다). 바닥 저장본(arenaCv)과 그 화면 크기 사본(blitBg 'arena'), 난간 띠, rig 작업 캔버스,
  // 지난 보스·출전 장수의 rig 프레임과 실루엣, 보스 고해상도 그림(hb)과 실루엣. 다음 보스전(또는 게임에 남기의 결투장)에서 처음 그릴 때 다시 만든다.
  // 09-render-camera가 결투장 화면이 끝난 프레임에 한 번 부르고, 17-loop begin이 새 판을 시작할 때 부른다.
  function arenaFree(f) {
    if (arenaCv) { arenaCv.width = arenaCv.height = 0; arenaCv = null; }
    arenaKey = '';
    if (rimCv) { rimCv.forEach((o) => { o.cv.width = o.cv.height = 0; }); rimCv = null; }
    rimKey = '';
    const bg = BGC.arena;
    if (bg) { if (bg.cv) bg.cv.width = bg.cv.height = 0; bg.cv = null; bg.key = ''; bg.last = ''; }
    const ids = f && f.def ? [f.def.id].concat((f.champs || []).map((u) => u.def && u.def.id).filter(Boolean)) : [];
    if (window.RTD_RIG && RTD_RIG.free) RTD_RIG.free(ids);
    if (Art.hbFree) Art.hbFree();
  }
  // ---- 보스 등장 연출의 진행값(그림만. 판정·카메라 값은 건드리지 않는다). e = 지난 시간(초, 0~4.2) ----
  // 0~0.5 레터박스(감속) / 0.2~1.6 보스 쪽으로 천천히 확대 / 1.6 내려찍기(흔들림·번쩍임·제목) / 3.6~4.2 원래대로
  const INTRO_LEN = 4.2, INTRO_HIT = 1.6;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const outCubic = (v) => 1 - Math.pow(1 - clamp01(v), 3);
  const inOutSine = (v) => 0.5 - Math.cos(Math.PI * clamp01(v)) / 2;
  function introState() {
    const f = g && g.fight;
    if (!f || g.phase !== 'bossIntro') return null;
    const e = Math.max(0, INTRO_LEN - f.introT), out = 1 - inOutSine((e - 3.6) / 0.6);
    const push = inOutSine((e - 0.2) / (INTRO_HIT - 0.2));
    // 내려찍는 순간 1.30 → 1.42로 튀었다가 1.34로 가라앉는다
    const kick = e >= INTRO_HIT ? Math.exp(-(e - INTRO_HIT) * 9) * Math.sin(Math.min(Math.PI, (e - INTRO_HIT) * 14)) : 0;
    // 보스전 카메라가 이미 1.2배라 등장 확대는 그만큼 줄여 얹는다(합쳐서 최대 1.62배. 그대로 곱하면 1.70배, 예전은 1.42배)
    const zk = 1 / Math.max(1, S.cam.z), zoom = (Q.level === 'low' ? 0.22 : 0.3) * zk;
    return {
      e, f, out,
      z: 1 + (zoom * push + (e >= INTRO_HIT ? 0.04 * zk * clamp01((e - INTRO_HIT) / 0.25) : 0) + kick * 0.12 * zk) * out,
      m: 0.55 * push * out, // 확대 중심이 화면 가운데에서 보스 쪽으로 옮겨 가는 정도
      big: 1 + 0.28 * push * out, // 보스 그림만 키운다(판정 크기는 그대로)
      dark: 0.62 * outCubic((e - 0.1) / 1.2) * out,
      lb: Math.min(1, outCubic(e / 0.5)) * (1 - outCubic((e - 3.7) / 0.5)),
    };
  }
  // 09-render-camera에서 부른다: 펀치처럼 그리기 변환만 덧씌운다
  function introCam(c, s) {
    if (!s || s.z <= 1.0005 && s.m <= 0.0005) return;
    const b = s.f.boss, cx = S.cam.x, cy = S.cam.y, px = cx + (b.x - cx) * s.m, py = cy + (b.y - 40 - cy) * s.m;
    c.translate(cx, cy); c.scale(s.z, s.z); c.translate(-px, -py);
  }
  // ---- 인연 시너지 보스전 연출(synergy.js가 넣은 fx·상태를 기존 그림으로만 그린다: 장수 그림·병사 그림·vs_fireship·fxa_*·mc_rune·pic_star·ray_sun·fx_fire) ----
  // 남의 원군(협동 presence sv로 받은 것, f.who = 주인 닉네임)은 0.6 투명도로 그리고 머리 위에 주인 이름표를 붙인다
  function synSprite(id) { const d = defOf[id]; return d ? Art.unitSprite(d, 0, 0) : Art.soldierSprite(T.waves[0]); }
  // 바닥 장판(수경 법진·이릉 불 장판): 보스·장수 아래에 그린다
  function drawSynFields(c, t, f) {
    (f.synF || []).forEach((o) => {
      const a = Math.min(1, o.t / 0.4, (o.max - o.t) / 0.25 + 0.2) * 0.85;
      if (o.vis === 'fire') { for (let k = 0; k < 5; k++) { const ang = k * 1.257 + t * 0.6; Art.fxImg(c, 'fire', o.x + Math.cos(ang) * o.r * 0.55, o.y + Math.sin(ang) * o.r * 0.32, o.r * 0.9, 0, a * 0.8); } }
      else Art.fxPic(c, 'mc_rune' + (1 + (Math.round(o.x + o.y) % 3)), o.x, o.y, o.r * 2.1, o.r * 2.1, t * 0.5, a, { col: '#a0d8ff', sy: 0.5 });
    });
  }
  function drawSyn(c, t, f, b) {
    const ease = (p) => (p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1);
    for (const o of g.fx) {
      if (o.t < 0) continue;
      const p = Math.min(1, o.t / o.life), al = o.who ? 0.6 : 1;
      if (o.k === 'synAlly') {
        // 원군 장수: 나타나 보스 쪽으로 살짝 내딛었다가 사라진다
        const dx = (o.tx || b.x) - o.x, dy = (o.ty || b.y) - o.y, dd = Math.hypot(dx, dy) || 1, lunge = Math.sin(Math.min(1, p * 2) * Math.PI) * 16;
        const x = o.x + (dx / dd) * lunge, y = o.y + (dy / dd) * lunge;
        c.globalAlpha = ease(p) * al; Art.drawSprite(c, synSprite(o.id), x, y, 70, dx < 0); c.globalAlpha = 1;
        if (o.who) bossTag(c, o.who, x, y - 52, '500 13px "IBM Plex Sans KR", sans-serif', '#d8f0ff');
      } else if (o.k === 'synShip') {
        const x = o.x0 + (o.x1 - o.x0) * p, y = o.y0 + (o.y1 - o.y0) * p;
        vs(c, 'fireship', x, y - 26, 150, Math.sin(t * 6 + o.y0) * 0.06, al * Math.min(1, (1 - p) * 6 + 0.2), false, o.x1 < o.x0);
        Art.fxAnim(c, 'smoke', (t * 1.3) % 1, x - 60, y - 10, 70, 70, 0, 0.5 * al, null, { col: '#ff9a5a' });
        if (o.who) bossTag(c, o.who, x, y - 70, '500 13px "IBM Plex Sans KR", sans-serif', '#d8f0ff');
      } else if (o.k === 'synRider') {
        // 기병 돌격: 그림을 왼쪽에서 오른쪽으로 옮기고 흙먼지를 남긴다
        const x = o.x0 + (o.x1 - o.x0) * p;
        c.globalAlpha = al * Math.min(1, (1 - p) * 8); Art.drawSprite(c, synSprite(o.id), x, o.y, 58, false); c.globalAlpha = 1;
        Art.fxAnim(c, 'smoke', (p * 3) % 1, x - 34, o.y + 8, 56, 56, 0, 0.45 * al, null, { col: '#d8c8a8' });
        if (o.who && p < 0.2) bossTag(c, o.who, x, o.y - 46, '500 13px "IBM Plex Sans KR", sans-serif', '#d8f0ff');
      } else if (o.k === 'synAnim') Art.fxAnim(c, o.name, p, o.x, o.y, o.r * 2, o.r * 2, 0, 1, null, o.col ? { col: o.col } : undefined);
      else if (o.k === 'synStars') {
        // 칠성등: 일곱 별이 주장 둘레를 돌다가 하나씩 꺼진다
        const u = f.champs.find((x) => x.uid === o.uid) || o;
        for (let k = 0; k < 7; k++) { if (k / 7 < p) continue; const a = t * 1.6 + k * 0.898; Art.fxPic(c, 'pic_star', u.x + Math.cos(a) * 62, u.y - 30 + Math.sin(a) * 30, 26, 26, a, 0.9, { col: '#ffe9a6' }); }
      }
    }
    // 내 장수 상태: 호위 원군(곁을 따라다님), 다음 스킬 강화(빛살), 쌓인 표식·연환(보스 머리 위 별)
    let row = 0;
    f.champs.forEach((u) => {
      if (u.dead || u.bench) return;
      (u.syAl || []).forEach((al2) => {
        if (!g.synAlPos) return;
        const [x, y] = g.synAlPos(u, al2), a = Math.min(1, al2.t / 0.5, (al2.max - al2.t) / 0.3);
        c.globalAlpha = Math.max(0, a); Art.drawSprite(c, synSprite(al2.id), x, y, 62, b.x < x); c.globalAlpha = 1;
      });
      if (u.syNext && u.syNext.t > 0) Art.fxPic(c, 'ray_sun', u.x, u.y - 70, 96, 96, t * 0.8, 0.55 + Math.sin(t * 5) * 0.15, { col: '#ffd86a' });
      Object.keys(u.syS || {}).forEach((key) => {
        const st = u.syS[key];
        if (!st.mark || !(st.n > 0)) return;
        const w = 20, x0 = b.x - ((st.max - 1) * w) / 2, y = b.y - 150 - row * 22;
        for (let k = 0; k < st.max; k++) Art.fxPic(c, 'pic_star', x0 + k * w, y, 22, 22, 0, k < st.n ? 1 : 0.22, { col: st.mark });
        row++;
      });
    });
  }
  // ---- 보스 타격감(그리기만): 움찔이 생길 때마다 타격 프레임 애니메이션(gfx/fxa_hit·hit2)·흰 번쩍·카메라 미세 흔들림·타격음,
  // 내 장수가 친 것이면 짧은 히트스톱(혼자 할 때만. 계산을 멈추는 것은 16-hud의 강타 멈칫과 같은 방식).
  // 강한 공격(16-hud가 강타·치명타·스킬에 S.punch = 1)이나 큰 피해(최대 체력 1.5% 이상)는 더 세게.
  const BHIT_LEN = 0.3;
  function bossHitFx(f, b, hr) {
    const ac = g.active(), mine = !!(ac && ac.atkT > 0), big = (S.punch || 0) > 0.6 || hr.pend > b.mhp * 0.015;
    hr.fl = 1; hr.big = big;
    const L = S.bhits || (S.bhits = []);
    if (L.length >= 4) L.shift();
    // 맞은 자리: 보스 몸 가운데에서 친 쪽으로 조금(장수와 보스 사이 방향 hr.ax·ay의 반대)
    L.push({ t: 0, big, x: b.x - hr.ax * 34 + (Math.random() - 0.5) * 40, y: b.y - 50 - hr.ay * 16 + (Math.random() - 0.5) * 40, r: Math.random() * 6.28, n: Math.random() < 0.5 ? 'hit' : 'hit2' });
    if (!mine && !big) return;
    S.shake = Math.max(S.shake || 0, big ? 0.42 : 0.16);
    Snd.play('hit', big ? 60 : 110);
    if (!net && mine) { const nowMs = performance.now(); if (nowMs - (S.hitStopAt || 0) > 140) { S.hitStop = Math.max(S.hitStop || 0, big ? 0.07 : 0.03); S.hitStopAt = nowMs; } }
  }
  // 내 장수 피격: 엔진이 이미 흔들림 0.5와 'hurt' 소리를 낸다. 여기서는 둔탁한 타격음(녹음 샘플)·짧은 진동·화면 가장자리 붉은 기운(S.phit, drawBossHud가 그림)을 더한다
  function champHurt(u, t) {
    u._hurtT = t;
    S.phit = { t: 0 };
    S.shake = Math.max(S.shake || 0, 0.65);
    Snd.play('mace', 90);
    if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) { /* 진동 없음 */ } }
  }
  function drawBossHits(c) {
    const L = S.bhits;
    if (!L || !L.length) return;
    for (let i = L.length - 1; i >= 0; i--) {
      const h = L[i];
      h.t += S.fdt;
      if (h.t >= BHIT_LEN) { L.splice(i, 1); continue; }
      const p = h.t / BHIT_LEN, sz = (h.big ? 300 : 170) * (0.85 + p * 0.3);
      Art.fxAnim(c, h.big ? 'hit2' : h.n, p, h.x, h.y, sz, sz, h.r, 1);
      if (h.big && p < 0.7) Art.fxAnim(c, 'boom', p / 0.7, h.x, h.y, 220, 220, 0, 0.8);
    }
  }
  function drawArena(t) {
    const c = ctx, f = g.fight, a = f.def.arena, b = f.boss, IS = introState();
    if (!arenaFloor(c, a, f.def.id)) drawMotif(c, a.motif, '#f0e0c0', t);
    // 경계 난간: 등장 연출 중에도 그린다(난간 밖 바닥이 어두워져서, 난간을 숨기면 밝기가 끊기는 줄이 그대로 드러난다)
    arenaRim(c, f, 1);
    f.hazards.forEach((h) => drawHazard(c, h));
    drawSynFields(c, t, f); // 인연 바닥 장판
    drawRaid(c, t);
    // 보스(잠행 중에는 보이지 않는다. 분신 기믹에서는 그림자가 있는 쪽이 진짜)
    const M = f.mech;
    if (!M.hide) {
    // 기 모으기·반격 태세 표시: Kenney 빛 그림(도형 원 대신)
    const SKF = window.RTD_SKFX;
    if (b.charge && SKF) SKF.spr(c, 'light_01', f.def.fx, b.x, b.y, 230, 230, t * 2, 0.75);
    if (M.ctr > 0 && SKF) SKF.spr(c, 'light_02', '#4aa8ff', b.x, b.y, 290, 290, -t * 3, 0.6 + Math.sin(t * 20) * 0.3);
    const BIG = IS ? IS.big : 1;
    // 등장 연출: 보스 뒤 보스색 후광(낮음 화질은 생략)
    if (IS && Q.level !== 'low' && IS.dark > 0.02 && SKF) { const gr2 = 520 * BIG; SKF.spr(c, 'light_01', f.def.fx, b.x, b.y - 40, gr2, gr2, t * 0.2, 0.45 * IS.dark / 0.62); }
    blobShadow(c, b.x, b.y + 62, 124 * BOSS_S * BIG, 0.7);
    // 보스 발밑: 보스 색 법진 그림(gfx/mc_rune1)이 천천히 돈다(받기 전에는 예전 고리)
    if (!IS && !Art.fxPic(c, 'mc_rune1', b.x, b.y + 62, 150 * BOSS_S, 150 * BOSS_S, t * 0.3, 0.7, { col: f.def.fx, sy: 20 / 62 })) { c.strokeStyle = f.def.fx; c.lineWidth = 4; c.beginPath(); c.ellipse(b.x, b.y + 62, 62 * BOSS_S, 20 * BOSS_S, 0, 0, 7); c.stroke(); }
    // 게임은 1초에 30번 움직이고 화면은 그보다 자주 그려서, 프레임마다 '움직임'만 보면 걷기·서기가 번갈아 덜덜 떨린다.
    // 마지막으로 움직인 뒤 0.15초까지는 걷는 중으로 본다.
    const bdx = b.x - (S.bossX ?? b.x), bdy = b.y - (S.bossY ?? b.y), moved = Math.hypot(bdx, bdy) > 0.3;
    if (moved) { S.bossFace = Math.atan2(bdy, bdx); S.bossMovedAt = t; }
    const bMove = S.bossMovedAt != null && t - S.bossMovedAt < 0.15 && t >= S.bossMovedAt;
    S.bossX = b.x; S.bossY = b.y;
    S.bossMove = bMove;
    const bd = Art.facing(S.bossFace ?? Math.PI / 2);
    // ---- 타격감: 맞으면 공격한 쪽 반대로 밀리고 움찔(찌그러졌다 펴짐), 하얗게 번쩍. 패턴 전에는 힘을 모으고(솟으며 부풂) 터질 때 내리찍는다 ----
    // 움찔은 프레임마다가 아니라 시간 기준으로 쌓는다: 마지막 움찔에서 FLINCH_GAP초가 지나야 다음 움찔을 더하고,
    // 그 사이에 들어온 피해는 모아 두었다가 다음 움찔의 세기에 넣는다(60fps·30fps·협동 계산 주기와 상관없이 같은 세기).
    const FLINCH_GAP = 0.08;
    const hr = S.bhr && S.bhr.f === f ? S.bhr : (S.bhr = { f, k: 0, ax: 0, ay: 1, hp: b.hp, num: 0, numT: 0, wind: 0, slam: 0, pend: 0, kt: 1 });
    hr.kt += S.fdt;
    if (b.hp < hr.hp - 0.5) {
      const ac = g.active(), dmg = hr.hp - b.hp;
      if (ac) { const a = Math.atan2(b.y - ac.y, b.x - ac.x); hr.ax = Math.cos(a); hr.ay = Math.sin(a); }
      hr.pend += dmg; hr.num += dmg;
    }
    if (hr.pend > 0 && hr.kt >= FLINCH_GAP) { hr.k = Math.min(1.4, hr.k + 0.55 + Math.min(0.6, hr.pend / (b.mhp * 0.02))); bossHitFx(f, b, hr); hr.pend = 0; hr.kt = 0; }
    // 히트스톱 동안은 움찔·번쩍임을 붙잡아 둔다(멈춘 순간이 보이게)
    const held = S.hitStop > 0;
    hr.hp = b.hp; if (!held) { hr.k *= Math.pow(0.8, S.f60); hr.fl = Math.max(0, (hr.fl || 0) - S.fdt / 0.13); }
    hr.numT += S.fdt;
    if (hr.num > 0 && hr.numT > 0.14) { if (S.dmg.length < 50) S.dmg.push({ x: b.x + (Math.random() - 0.5) * 70, y: b.y - 96, v: Math.round(hr.num), t: 0, hit: true }); hr.num = 0; hr.numT = 0; }
    let wind = 0;
    f.hazards.forEach((h) => { if (!h.own && h.t < h.delay) wind = Math.max(wind, h.t / Math.max(0.01, h.delay)); });
    if (hr.wind > 0.85 && wind < 0.2) { hr.slam = 1; S.shake = Math.max(S.shake || 0, 0.55); }
    hr.wind = wind; hr.slam *= Math.pow(0.86, S.f60);
    const wk = Math.pow(wind, 1.5), push = hr.k * 16;
    // BIG: 등장 연출 동안만 그림을 키운다(발 위치는 그대로 두고 위로 커진다)
    const bx = b.x + hr.ax * push, by = b.y + hr.ay * push * 0.6 - wk * 18 + hr.slam * 10 - 56 * (BOSS_S * BIG - 1);
    const sy = (1 - hr.k * 0.08) * (1 + wk * 0.08) * (1 - hr.slam * 0.1), sc = 200 * BOSS_S * BIG * (1 + hr.k * 0.04 + wk * 0.06 + hr.slam * 0.05);
    const bImg = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, bd.v, bMove ? (Math.sin(t * 10) > 0 ? 1 : 2) : 0);
    // 힘 모으기: 붉은 기운이 몸에 맺힌다
    if (wk > 0.05 && SKF) SKF.spr(c, 'light_01', f.def.fx, bx, by - 20, 330, 330, t * 3, wk * 0.65);
    const RG = window.RTD_RIG;
    // 조각 애니메이션 보스: 기술 전 힘 모으기 → 터질 때 내지르기. 기술 종류에 따라 전방위(정면에서 두 팔 벌리기)·소환(무기 치켜들기)은 앞모습,
    // 겨누기는 옆모습으로 상대를 본다. 평소에는 이동 방향의 그림(앞·옆)을 쓰고, 조각이 없는 방향(뒷모습)은 기존 그림.
    const casting = wind > 0.05 || hr.slam > 0.1, act = S.bossAct || 'raise';
    const rView = casting ? (act === 'aim' ? 's' : 'f') : bd.v === 2 ? 's' : bd.v <= 1 ? 'f' : null;
    const rv = RG && rView && (RG.has(f.def.id, rView) ? rView : casting && RG.has(f.def.id, 's') ? 's' : null);
    if (rv) {
      const st = wind > 0.05 ? { state: 'skill', act, p: wind * 0.45, t } : hr.slam > 0.1 ? { state: 'skill', act, p: 0.45 + (1 - hr.slam) * 0.55, t } : hr.k > 0.15 ? { state: 'hurt', k: Math.min(1, hr.k), t } : { state: bMove ? 'walk' : 'idle', t };
      st.view = rv;
      const tgt = g.active(), flipR = rv === 'f' ? bd.flip : casting ? (tgt ? tgt.x < b.x : false) : bMove ? Math.cos(S.bossFace ?? 0) < 0 : tgt ? tgt.x < b.x : false; // 옆모습은 멈춰 있거나 기술을 쓰면 내 장수 쪽을 본다
      const drawR = () => { c.save(); c.translate(bx, by); c.scale(1, sy); RG.draw(c, f.def.id, 0, 0, sc, flipR, st); c.restore(); };
      // 맞은 순간 흰 실루엣으로 번쩍(rig.js가 프레임마다 실루엣을 한 번 만들어 둔다. 예전 '더하기로 한 번 더 그리기'는 어두운 갑옷에서 거의 안 보였다)
      if (hr.fl > 0.02) { st.tint = '#ffffff'; st.tintA = hr.fl * (hr.big ? 0.95 : 0.75); }
      drawR();
    } else {
      if (hr.fl > 0.02) Art.setTint('#ffffff', hr.fl * (hr.big ? 0.95 : 0.75));
      Art.drawSprite(c, bImg, bx, by, sc, bd.flip, hr.ax * hr.k * 0.06 * (bd.flip ? -1 : 1), sy);
      Art.setTint(null);
    }
    if (hr.slam > 0.1) { Art.fxAnim(c, 'ring', 1 - hr.slam, b.x, b.y + 62, 420, 170, 0, 1); Art.fxAnim(c, 'boom2', Math.min(0.99, (1 - hr.slam) * 1.3), b.x, b.y + 40, 260, 260, 0, 0.9); }
    if (hr.slam > 0.1) Art.fxAnim(c, 'wave', 1 - hr.slam, b.x, b.y + 62, 380, 380, 0, 0.9, null, { col: '#fff2d0', sy: 0.4 });
    drawBossHits(c, t);
    c.filter = 'none';
    c.textAlign = 'center';
    // 판이 끝나면(시간 초과·전멸 패배 연출) 보스 머리 위 기믹 안내 글은 지운다(연출 위에 남아 장수와 겹쳤다)
    const tags = !g.over;
    if (!tags) { /* 안내 없음 */ } else if (M.charmT > 0) {
      // 매혹: 하트 그림(Kenney symbol_01)이 떠오른다
      if (SKF) for (let i = 0; i < 5; i++) {
        const ph = (t * 0.8 + i / 5) % 1, hx = b.x + Math.sin(i * 2.3 + t * 2) * 46, hy = b.y - 70 - ph * 90, s = (14 + Math.sin(ph * Math.PI) * 10) * 3.2;
        SKF.spr(c, 'symbol_01', i % 2 ? '#ff7ac0' : '#ffb0dc', hx, hy, s, s, 0, Math.sin(ph * Math.PI) * 0.95);
      }
      bossTag(c, I.t('e_charm'), b.x, b.y - 84, '400 28px "Black Han Sans", sans-serif', '#ff9ad0');
    } else if (b.stun > 0) bossTag(c, I.t('stun'), b.x, b.y - 84, '400 22px "Black Han Sans", sans-serif', '#ffe27a');
    if (tags && M.gr > 0) bossTag(c, I.t('groggy'), b.x, b.y - 96, '400 30px "Black Han Sans", sans-serif', '#7fd4ff');
    if (tags && M.ctr > 0) {
      bossTag(c, I.t('counter'), b.x, b.y - 112, '400 28px "Black Han Sans", sans-serif', '#bfe2ff');
      // 반격 게이지: 정면에서 넣은 피해
      bar(c, b.x, b.y - 92, 150, 8, Math.min(1, (M.ctrGot || 0) / (M.ctrNeed || 1)), '#4aa8ff');
    }
    if (tags && M.ampT > 0) bossTag(c, I.t('weakened', { n: Math.round(M.amp * 100) }), b.x, b.y + 98, '700 18px "IBM Plex Sans KR", sans-serif', '#d8b4ff');
    // 팔진도: 보스 머리 위 문양과 같은 문이 생문(어두운 금속 판 그림 위에)
    if (M.objs.some((o) => o.k === 'gate')) { const pl = Art.pic('ui_tab'); if (pl) Art.nine(c, pl, b.x - 50, b.y - 174, 100, 78, 12, 10); else { c.fillStyle = 'rgba(16,11,8,.7)'; c.fillRect(b.x - 46, b.y - 170, 92, 70); } c.fillStyle = '#d8ecff'; drawSym(c, b.x, b.y - 135, M.sym, 30); }
    }
    // 출전 무장
    const act = g.phase === 'boss' ? g.active() : null, SKF0 = window.RTD_SKFX;
    // 일기토 대기 장수: 결투장 왼쪽 아래에 흐리게 줄 세운다
    f.champs.filter((u) => u.bench).forEach((u, i) => {
      c.globalAlpha = 0.45; Art.drawSprite(c, Art.unitSprite(u.def, 0, 0), ARENA.x0 + 40 + i * 60, ARENA.y1 - 40, 60, false); c.globalAlpha = 1;
      c.fillStyle = '#ffd86a'; c.font = '700 13px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(I.t('waiting'), ARENA.x0 + 40 + i * 60, ARENA.y1 - 78);
    });
    // 겹쳐 선 장수는 아래쪽을 나중에 그린다(그리는 순서만)
    const champOrder = f.champs.length > 1 ? f.champs.slice().sort((p, q) => p.y - q.y) : f.champs;
    champOrder.forEach((u) => {
      if (u.bench) return;
      if (u.dead) { drawFallen(c, u, b, t); return; }
      FALLEN.delete(u);
      if (u === act) {
        // 내 장수: 발밑 금색 문양 그림 + 옅은 사거리 원판 그림 + 이동 목표까지 빛줄기 그림
        // 사거리 표시: 라인과 같은 연두색 원판(rangeMark). 반지름은 engine 보스전 타격 판정(d <= rng + 40)과 맞춘다
        rangeMark(c, u.x, u.y, g.range(u.def) + 40, '#7dff8e', 0.22);
        selMark(c, u.x, u.y + CHAMP_R * 0.72, CHAMP_R, t);
        if (u.move) streak(c, '#7dff8e', u.x, u.y, u.tx, u.ty, 5, 0.55);
      }
      drawBuffs(c, u, t);
      // 맞으면 보스 반대쪽으로 튕겨 밀린다(그림만, 위치는 그대로). 피격 빛은 붉은 빛 그림.
      // 내 장수가 맞은 순간(엔진이 hurt를 0.2로 세운다): 화면 가장자리 붉은 기운·흔들림·피격음·진동, 체력 막대 깜빡임(champHurt)
      if (u.owner === g.me.idx && (u.hurt || 0) > (u._hurtPrev || 0) + 0.05) champHurt(u, t);
      u._hurtPrev = u.hurt || 0;
      const kb = Math.max(0, (u.hurt || 0) / 0.2), ka = Math.atan2(u.y - b.y, u.x - b.x), kx = u.x + Math.cos(ka) * kb * 24, ky = u.y + Math.sin(ka) * kb * 14;
      if (u.hurt > 0 && SKF0) SKF0.spr(c, 'light_01', '#ff3c28', kx, ky - 10, 130, 130, 0, 0.7 * kb);
      // 조각 애니메이션 동작 상태: 공격(atkT 0.24)·스킬(0.36 이상)은 시작할 때의 길이로 구분, 맞으면 피격, 움직이면 걷기
      if ((u.atkT || 0) > (u._atkPrev || 0) + 0.01) u._atkMax = u.atkT;
      u._atkPrev = u.atkT || 0;
      const rs = u.atkT > 0 ? { state: (u._atkMax || 0) >= 0.3 ? 'skill' : 'attack', p: 1 - u.atkT / (u._atkMax || 0.24), t } : kb > 0.05 ? { state: 'hurt', k: kb, t } : { state: u.move || u.moveT > 0 ? 'walk' : 'idle', t };
      // 맞으면 몸이 빨갛게 번쩍(빨간 실루엣: 조각 그림은 rig.js, 한 장 그림은 Art.setTint)
      const red = kb > 0.05 ? kb * 0.6 : 0;
      if (red) { rs.tint = '#ff2a1a'; rs.tintA = red; Art.setTint('#ff2a1a', red); }
      piece(c, kx, ky, CHAMP_R, u.def, t, u.owner === 1, { pose: poseOf(u, t, CHAMP_R), rig: rs });
      tierStars(c, kx, ky + CHAMP_R * 1.15, u.def.tier, 10 * uiS()); // 원판 아래 등급 별(라인과 같은 규칙, 03-unit)
      if (red) Art.setTint(null);
      // 체력 막대: 맞은 뒤 0.45초 동안 흰색·빨간색으로 깜빡인다
      const blink = u._hurtT != null && t - u._hurtT >= 0 && t - u._hurtT < 0.45;
      bar(c, u.x, u.y - 80, 76 * uiS(), 7 * uiS(), u.hp / u.mhp, blink ? (Math.floor((t - u._hurtT) * 14) % 2 ? '#ff3c28' : '#ffffff') : u.hp / u.mhp < 0.3 ? '#ff6a50' : '#7ed08c');
    });
    drawAim(c);
    drawSyn(c, t, f, b); // 인연 원군·화선·기병·표식
    Object.values(f.ghosts).forEach((o) => {
      if (!o.def) return;
      // 동료 장수는 받은 위치를 0.1초 늦게 이어 그린다(net.ghostAt). 판정 좌표 o.x, o.y는 그대로 둔다
      const gp = net && net.ghostAt && o.id ? net.ghostAt(o.id, performance.now()) : null;
      const ox = gp ? Math.max(ARENA.x0, Math.min(ARENA.x1, gp.x)) : o.x, oy = gp ? Math.max(ARENA.y0, Math.min(ARENA.y1, gp.y)) : o.y;
      // 자세 기억은 자리 id로(같은 닉네임 두 명이 서로 덮어쓰지 않게)
      const key = o.id || o.name, pv = (S.ghostPos = S.ghostPos || {})[key] || { x: ox, y: oy, moveT: 0, face: Math.PI / 2, def: o.def, id: 1 };
      if (gp) {
        // 보간한 속도(px/ms)로 방향과 걷기를 정한다. 초속 20px 아래는 서 있는 것으로 본다
        if (Math.hypot(gp.vx, gp.vy) > 0.02) { pv.face = Math.atan2(gp.vy, gp.vx); pv.moveT = 0.15; } else pv.moveT = Math.max(0, pv.moveT - S.fdt);
      } else if (Math.hypot(ox - pv.x, oy - pv.y) > 0.3) { pv.face = Math.atan2(oy - pv.y, ox - pv.x); pv.moveT = 0.15; } else pv.moveT = Math.max(0, pv.moveT - S.fdt);
      pv.x = ox; pv.y = oy; pv.def = o.def; S.ghostPos[key] = pv;
      c.globalAlpha = 0.85; piece(c, ox, oy, CHAMP_R, o.def, t, true, { pose: poseOf(pv, t, CHAMP_R) }); c.globalAlpha = 1;
      bar(c, ox, oy - 78, 72 * uiS(), 6 * uiS(), o.hpf, '#7fd4ff');
      bossTag(c, o.name || '', ox, oy + 52, '500 14px "IBM Plex Sans KR", sans-serif', '#d8f0ff');
    });
    drawVfx(c);
    drawFx(c);
    if (g.mut.night) drawNight(c, true);
    // 기를 모으는 기술의 "서야 할 자리"는 전장 좌표라 여기서 그린다. 체력 막대·남은 시간·기술 이름·안내는 화면 고정이라 drawBossHud가 카메라를 풀고 그린다
    if (g.phase === 'boss' && !g.over && M.cast && M.cast.spots) M.cast.spots.forEach((s) => { Art.fxPic(c, 'mc_rune3', s[0], s[1], s[2] * 2.1, s[2] * 2.1, t * 0.6, 0.85, { col: '#a8ffb8' }); ringSpr(c, 'circle_02', '#a8ffb8', s[0], s[1], s[2], 0, 0.9); });
    // 등장 연출: 보스 주변만 밝게(바깥을 둥글게 누른다). 전장 좌표라 확대와 함께 움직인다
    if (IS && IS.dark > 0.01) {
      const r0 = 150 * IS.big, sg = c.createRadialGradient(b.x, b.y - 40, r0, b.x, b.y - 40, r0 + 520);
      sg.addColorStop(0, 'rgba(6,4,3,0)'); sg.addColorStop(1, `rgba(6,4,3,${IS.dark.toFixed(3)})`);
      c.fillStyle = sg; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
    }
  }
  // ---- 보스전 화면 고정 표시(09-render-camera가 카메라 변환을 풀고 부른다: hudCam). 카메라를 확대하거나 장수를 따라가도 제자리에 있다 ----
  // 좌표는 화면 위 가운데가 (W/2, top)이고 us배 한 칸 안. 위에서부터 고정 자리:
  //   체력 막대 12~26 / 이름·남은 시간·체력 숫자 44 / 속공 문구 66(기술 이름·안내가 뜨는 동안은 숨김) / 피해 순위 접힌 줄 74~98(오른쪽, 05-lane drawMeter)
  //   / 기술 이름 띠 104~156(가운데, 순위 줄 아래) / 기믹 안내(기 모으기 막대, 분신 안내) 162~ / 알림 띠(08-pop drawBanner)는 이 중 떠 있는 것의 아래(S.hudBottom, 09 render가 내려 그린다)
  function drawBossHud(c, t) {
    const f = g.fight, b = f.boss, M = f.mech, us = hudS(), top = hudTop();
    // 내 장수가 맞으면 화면 가장자리가 붉게(0.5초. 목숨 잃음과 같은 가장자리 판 그림을 09-render-camera drawEdge로)
    if (S.phit) { const k = (S.phit.t += S.fdt); if (k >= 0.5 || g.over) S.phit = null; else drawEdge(c, '230,30,20', (k < 0.05 ? k / 0.05 : 1 - (k - 0.05) / 0.45) * 0.7); }
    c.save(); c.translate(W - 56, top + 66); c.scale(Math.min(us, 1.3), Math.min(us, 1.3)); c.translate(-(W - 56), -66);
    drawMeter(c, meterRows(f.dealt, f.total));
    c.restore();
    c.save(); c.translate(W / 2, top); c.scale(us, us); c.translate(-W / 2, 0);
    const BW = bossBar(c, f, b, us), x0 = W / 2 - BW / 2;
    const txt = (s, x, y, col) => { c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineJoin = 'round'; c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y); };
    c.textBaseline = 'middle'; c.font = '700 15px "IBM Plex Sans KR", sans-serif';
    c.textAlign = 'left'; txt(f.def.name, x0, 44, '#fff');
    c.textAlign = 'right'; txt(`${fmt(b.hp)} / ${fmt(b.mhp)}`, x0 + BW, 44, '#fff');
    if (M.vuln > 0) { c.font = '700 13px "IBM Plex Sans KR", sans-serif'; txt(I.t('vuln', { n: Math.round(M.vuln * 100) }), x0 + BW, 63, '#ffb070'); }
    const left = Math.max(0, f.limit - f.t), fast = f.t / f.limit <= 1 - g.fastNeed();
    c.textAlign = 'center'; c.font = '400 26px "Black Han Sans", sans-serif'; txt(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, W / 2, 46, left < 20 ? '#ff7a60' : '#fff');
    // 판이 끝나면(패배 연출) 기술 이름 띠·기믹 안내는 지운다. 체력 막대·이름·남은 시간은 남긴다
    if (g.over) S.pattern = null;
    const pat = S.pattern && S.pattern.t > 0, live = !g.over, clone = live && M.objs.some((o) => o.k === 'clone'), cast = live && M.cast;
    // 알림 띠가 비켜야 할 아래 끝(화면 고정 좌표). 띠·안내가 없으면 0(알림 띠는 제자리)
    S.hudBottom = cast ? top + 224 * us : clone ? top + 200 * us : pat ? top + 156 * us : 0;
    if (g.trial) {
      // 체험 피해 계기(trial-mode.md 4-2): 속공 문구 자리에 「총 피해 · 초당」(0.5초마다 갱신), 그 아래 「강화 10단계 기준」. 기술 이름 띠(104~)보다 위라 늘 보인다
      const R = g.trialRes, now = performance.now();
      if (!S.trialFx || now - S.trialFx.at > 500 || R) { const tot = R ? R.total : f.total, sec = R ? R.t : f.t; S.trialFx = { at: now, s: I.t('trMeter', { a: fmt(tot), b: fmt(tot / Math.max(1, sec)) }) }; }
      c.font = '700 16px "IBM Plex Sans KR", sans-serif'; txt(S.trialFx.s, W / 2, 68, '#ffd86a');
      c.font = '500 12px "IBM Plex Sans KR", sans-serif'; txt(I.t('trBasis', { n: g.trial.upLv }), W / 2, 88, '#d8c8a8');
    } else if (live && !pat && !cast && !clone) { c.font = '500 13px "IBM Plex Sans KR", sans-serif'; txt(I.t(fast ? 'fastOk' : 'fastNo'), W / 2, 66, fast ? '#ffd86a' : '#a8987f'); }
    if (pat) {
      S.pattern.t -= S.fdt;
      // 기술 이름: 어두운 금속 판 그림(gfx/ui_title) 위에. 나타날 때는 위아래로 펼쳐지고 사라질 때는 접힌다(투명하게 흐려지며 뒤 그림과 섞이지 않게).
      const open = Math.min(1, (1.6 - S.pattern.t) / 0.12), close = Math.min(1, S.pattern.t / 0.22), fy = Math.max(0.02, Math.min(open, close));
      c.font = '400 34px "Black Han Sans", sans-serif';
      const pw = Math.min(900, c.measureText(S.pattern.name).width + 84), pl = Art.pic('ui_title');
      c.save(); c.translate(W / 2, 130); c.scale(1, fy);
      if (pl) Art.nine(c, pl, -pw / 2, -26, pw, 52, 26, 22);
      else { c.fillStyle = 'rgba(16,11,8,.72)'; c.fillRect(-pw / 2, -21, pw, 42); c.fillStyle = f.def.fx; c.fillRect(-pw / 2, -21, pw, 2); c.fillRect(-pw / 2, 19, pw, 2); }
      c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineJoin = 'round'; c.strokeText(S.pattern.name, 0, 0);
      c.fillStyle = f.def.fx; c.fillText(S.pattern.name, 0, 0); c.restore();
    }
    // 기믹 안내: 기술 이름 띠 아래 고정 자리. 뒤의 보스·장수와 섞이지 않게 어두운 금속 판을 깐다
    const plate = (w, y, h) => { const pl = Art.pic('ui_title'); if (pl) Art.nine(c, pl, W / 2 - w / 2, y, w, h, 24, 18); else { c.fillStyle = 'rgba(16,11,8,.75)'; c.fillRect(W / 2 - w / 2 + 14, y + 4, w - 28, h - 8); } };
    if (cast) {
      const fr = Math.min(1, M.cast.got / M.cast.need), cl = Math.max(0, M.cast.dur - M.cast.t), cw = Math.min(700, 1100 / us);
      plate(cw, 162, 62);
      c.font = '700 16px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(I.t('castLine', { a: M.cast.n, p: Math.round(fr * 100), s: cl.toFixed(1) }) + I.t(M.cast.spots ? 'castSpots' : 'castAll'), W / 2, 180, cw - 60);
      bar(c, W / 2, 196, cw - 80, 12, fr, '#7fd4ff');
    } else if (clone) {
      c.font = '700 16px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const s = I.t('clones'), cw = Math.min(900, c.measureText(s).width + 76);
      plate(cw, 162, 38); c.fillStyle = '#fff'; c.fillText(s, W / 2, 181);
    }
    c.restore();
  }
  // 보스·장수 머리 위 글자: 휴대폰 배율을 곱하고 먹 테두리를 두른다
  function bossTag(c, txt, x, y, font, col) {
    if (!txt) return;
    const us = uiS();
    c.save(); c.translate(x, y); c.scale(us, us); c.font = font; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    c.lineWidth = 5; c.strokeStyle = 'rgba(16,10,6,.9)'; c.strokeText(txt, 0, 0); c.fillStyle = col; c.fillText(txt, 0, 0); c.restore();
  }
  // 보스 체력 막대(얇게: 높이 14, 예전 28): 장식 틀 그림(gfx/ui_bossbar) 안쪽에 채움. 줄어든 만큼 잠깐 남았다가 뒤따라 줄어드는 잔상 띠.
  // 폭은 휴대폰 배율을 곱해도 오른쪽 위 버튼 밑으로 들어가지 않게 줄인다. 그림이 없으면 어두운 금속 판(ui_title) 틀.
  // (호출하는 쪽이 화면 위 가운데를 기준으로 us배 해 두었다. 막대 폭을 돌려준다)
  function bossBar(c, f, b, us) {
    const BW = Math.min(760, 900 / us), BH = 14, x0 = W / 2 - BW / 2, y = 12, fr = Math.max(0, Math.min(1, b.hp / b.mhp));
    let gh = S.bossGhost;
    if (!gh || gh.f !== f) gh = S.bossGhost = { f, v: fr, last: fr, hold: 0 };
    if (fr < gh.last - 1e-6) gh.hold = 0.45; // 맞은 순간: 잔상은 잠깐 그대로 있다가
    gh.last = fr; gh.hold -= S.fdt;
    if (gh.hold <= 0) gh.v = Math.max(fr, gh.v - S.fdt * 0.5); // 뒤따라 줄어든다
    if (gh.v < fr) gh.v = fr;
    const im = Art.pic('ui_bossbar');
    if (im) {
      // 틀 그림(1200×203): 안쪽 검은 칸이 y 68~165. 막대가 얇아져 용머리·구름·가운데 꾸밈은 너무 작아 읽히지 않으므로 뺐다(아트 디렉터 검수).
      // 장식이 없는 민 테두리 구간(x 240~510: 위아래 금 선 + 검은 속)만 막대 길이로 늘여 선만 남긴다.
      const k = BH / 97, ih = im.height;
      c.drawImage(im, 240, 0, 270, ih, x0 - 3, y - 68 * k, BW + 6, ih * k);
    } else { const pl = Art.pic('ui_title'); if (pl) Art.nine(c, pl, x0 - 26, y - 9, BW + 52, BH + 18, 26, 20); c.fillStyle = 'rgba(8,5,3,.82)'; c.fillRect(x0, y, BW, BH); }
    // 채움: 틀 안쪽 둥근 끝에 걸리지 않게 양끝·위아래를 조금 들인다
    const ix = x0 + 2, iy = y + 1.5, iw = BW - 4, ih2 = BH - 3;
    c.fillStyle = 'rgba(255,240,210,.7)'; c.fillRect(ix, iy, iw * gh.v, ih2);
    c.fillStyle = f.def.fx; c.fillRect(ix, iy, iw * fr, ih2);
    c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(ix, iy, iw * fr, ih2 * 0.4);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(ix, iy + ih2 * 0.75, iw * fr, ih2 * 0.25);
    // 보스 얼굴: 틀 그림이 없을 때만 왼쪽 끝에(틀 그림은 왼쪽 끝이 용머리 장식이라 겹치지 않게 생략)
    const face = !im && Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, 0, 0);
    if (face) { c.save(); c.beginPath(); c.rect(x0 - 96, y - 40, 92, BH + 46); c.clip(); Art.drawSprite(c, face, x0 - 48, y + 36, 116, false); c.restore(); }
    return BW;
  }
  // 쓰러진 장수: 1.1초 동안 조각 애니메이션의 쓰러짐 동작(없으면 그림을 눕힘)으로 넘어지며 흐려지고, 발밑에 흙먼지가 인다
  const FALLEN = new WeakMap(), FALL_LEN = 1.1;
  function drawFallen(c, u, b, t) {
    let d = FALLEN.get(u);
    if (!d) { d = { t0: t, flip: u.x > b.x }; FALLEN.set(u, d); if (u.owner === g.me.idx) S.shake = Math.max(S.shake || 0, 0.45); }
    const k = (t - d.t0) / FALL_LEN;
    if (k >= 1 || k < 0) return;
    const e = 1 - Math.pow(1 - Math.min(1, k / 0.45), 3), fade = 1 - Math.max(0, (k - 0.55) / 0.45);
    if (k < 0.9) Art.fxAnim(c, 'smoke', Math.min(0.99, k / 0.9), u.x, u.y + 18, 170, 170, 0, 0.55 * fade, null, { col: '#8a7c66', op: 'source-over' });
    c.save(); c.globalAlpha = fade;
    piece(c, u.x, u.y + e * 10, CHAMP_R, u.def, t, false, { pose: { x: 0, y: e * CHAMP_R * 0.5, rot: (d.flip ? 1 : -1) * e * 1.35, flip: d.flip, v: 2, frame: 0, sy: 1 }, rig: { state: 'dead', k: e, t } });
    c.restore();
  }
  // ---- 보스 처치 연출(그리기만. 판정·시간은 그대로): 이긴 직후 마지막 아레나를 붙잡고 약 4.2초 동안 보스가 무너진다 ----
  // 시간은 '연출 시간' K.t(0→KILL_LEN)로 재고, 앞부분은 느리게 흐른다(슬로모션): 0~0.12 ×0.3(번쩍이며 멎음) · 0.12~1.0 ×0.5(비틀거리며 연쇄 폭발) · 그 뒤 ×1.
  //   1.0 부서짐: 조각 애니메이션 보스는 무기·빈손 조각이 튕겨 나가고 몸이 넘어지며 흐려진다(rig.js drawBreak). 조각이 없으면 그림이 발끝 기준으로 넘어진다.
  //   1.0~3.0 「撃破!」 글자(i18n bossDown), 1.55 땅에 닿는 충격파·흙먼지.
  // 그동안 라인은 엔진 규칙으로 멈춰 있다(engine.js KILL_HOLD = KILL_REAL, applyBossEnd가 g.killHold를 세운다). 혼자·AI 동맹·방 협동 모두 같다(2026-11-25 실기 소감 「처치 연출 뒤에서 라인이 돈다」).
  // 판의 마지막 보스면 결과 창을 연출이 끝날 때까지 미룬다(S.endHoldUntil: 16-hud가 결과 창을, 17-loop가 쉬는 화면 전환을 이 시각까지 미룬다).
  const KILL_LEN = 3.0, KILL_REAL = 4.3;
  const killSpeed = (k) => (k < 0.12 ? 0.3 : k < 1 ? 0.5 : 1);
  // 연쇄 폭발: [연출 시각, 보스 기준 x, y]
  const KILL_BOOMS = [[0.1, -50, -95], [0.3, 48, -40], [0.5, -34, -8], [0.68, 58, -118], [0.86, 0, -64]];
  function watchKill() {
    if (g.fight && g.phase === 'boss') { S.lastFight = g.fight; return; }
    const f = S.lastFight;
    if (!f) return;
    S.lastFight = null;
    if (g.fight === f) return; // 실패로 판이 끝난 경우(보스전이 그대로 남는다)
    const bs = g.stats && g.stats.bosses, lb = bs && bs[bs.length - 1];
    // 체험은 보스 기록을 남기지 않으므로 체험 결과(g.trialRes)로 처치를 안다
    if (g.trial ? !(g.trialRes && g.trialRes.win) : !lb || !lb.win || lb.round !== f.def.round) return;
    const ac = f.champs.find((u) => !u.dead && !u.bench);
    S.pattern = null; // 처치 연출에는 기술 이름 띠를 남기지 않는다(다음 보스전에 묵은 띠가 뜨지 않게)
    S.bhits = []; S.phit = null;
    S.kill = { f, t: 0, flip: ac ? ac.x > f.boss.x : false, hit: 0, boom: 0, brk: 0 };
    S.shake = Math.max(S.shake || 0, 1);
    Snd.play('hit');
    if (g.over) S.endHoldUntil = Math.max(S.endHoldUntil || 0, performance.now() + KILL_REAL * 1000);
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* 진동 없음 */ } }
  }
  const killOn = () => !!(S.kill && S.kill.t < KILL_LEN);
  function drawKillCam(t) {
    const K = S.kill, f = K.f, b = f.boss, c = ctx, SK = window.RTD_SKFX;
    K.t += S.fdt * killSpeed(K.t);
    const k = K.t;
    arenaFloor(c, f.def.arena, f.def.id); arenaRim(c, f, 1);
    // 이긴 장수들은 보스 쪽을 보고 선다
    f.champs.forEach((u) => { if (u.dead || u.bench) return; piece(c, u.x, u.y, CHAMP_R, u.def, t, u.owner === 1, { pose: poseOf({ face: Math.atan2(b.y - u.y, b.x - u.x), def: u.def, id: 1 }, t, CHAMP_R), rig: { state: 'idle', t } }); tierStars(c, u.x, u.y + CHAMP_R * 1.15, u.def.tier, 10 * uiS()); });
    Object.values(f.ghosts || {}).forEach((o) => { if (o.def) piece(c, o.x, o.y, CHAMP_R, o.def, t, true, { pose: poseOf({ face: Math.atan2(b.y - o.y, b.x - o.x), def: o.def, id: 1 }, t, CHAMP_R) }); });
    const by = b.y - 56 * (BOSS_S - 1), sc = 200 * BOSS_S, RG = window.RTD_RIG;
    const rv = RG && (RG.has(f.def.id, 'f') ? 'f' : RG.has(f.def.id, 's') ? 's' : null);
    const brk = Math.max(0, (k - 1) / 1.2), fade = Math.max(0, 1 - Math.max(0, (k - 2.2) / (KILL_LEN - 2.2)));
    if (SK && k < 1) SK.spr(c, 'light_01', f.def.fx, b.x, b.y - 40, 560, 560, k, (1 - k) * 0.9);
    blobShadow(c, b.x, b.y + 62, 124 * BOSS_S, 0.7 * (1 - Math.min(1, brk)));
    // 연쇄 폭발이 터질 때마다 흰 번쩍임이 되살아난다
    let flash = k < 0.12 ? 1 : Math.max(0, 1 - (k - 0.12) / 0.3) * 0.9;
    KILL_BOOMS.forEach(([k0]) => { if (k >= k0 && k < k0 + 0.1) flash = Math.max(flash, 0.6 * (1 - (k - k0) / 0.1)); });
    if (k < 1) {
      // 비틀거림: 피격 자세로 떨린다(점점 잦아든다)
      const jx = Math.sin(k * 95) * 7 * (1 - k), jy = Math.sin(k * 71) * 3 * (1 - k);
      if (rv) { c.save(); c.translate(b.x + jx, by + jy); RG.draw(c, f.def.id, 0, 0, sc, K.flip, { state: 'hurt', k: 1, view: rv, t, tint: '#ffffff', tintA: flash }); c.restore(); }
      else { const im = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, 0, 0); Art.setTint('#ffffff', flash); Art.drawSprite(c, im, b.x + jx, by + jy, sc, K.flip); Art.setTint(null); }
    } else {
      if (!K.brk) { K.brk = 1; S.shake = Math.max(S.shake || 0, 1); Snd.play('bigslam'); if (navigator.vibrate) { try { navigator.vibrate([20, 30, 50]); } catch (e) { /* 진동 없음 */ } } }
      const white = Math.max(0, 1 - (k - 1) / 0.25);
      if (!(rv && RG.drawBreak(c, f.def.id, b.x, by, sc, K.flip, rv, Math.min(1, brk), white))) {
        const im = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, 0, 0), foot = by + sc * 0.34, e = 1 - Math.pow(1 - Math.min(1, brk / 0.6), 3);
        c.save(); c.globalAlpha = 1 - Math.max(0, (brk - 0.5) / 0.5); c.translate(b.x, foot); c.rotate((K.flip ? 1 : -1) * e * 1.35);
        Art.setTint('#ffffff', white); Art.drawSprite(c, im, 0, -sc * 0.34, sc, K.flip); Art.setTint(null); c.restore();
      }
    }
    // 빛살 터짐(처음) → 연쇄 폭발(gfx/fxa_boom) → 부서질 때 큰 폭발(fxa_boom2)·빛살
    if (k < 0.6) Art.fxAnim(c, 'burst', k / 0.6, b.x, b.y - 60, 640, 640, 0, 1, null, { col: f.def.fx });
    KILL_BOOMS.forEach(([k0, ox, oy], i) => {
      if (k < k0) return;
      if (K.boom <= i) { K.boom = i + 1; Snd.play('boom', 40); S.shake = Math.max(S.shake || 0, 0.4); }
      const q = (k - k0) / 0.3;
      if (q < 1) Art.fxAnim(c, i % 2 ? 'boom2' : 'boom', q, b.x + ox, b.y + oy, 250, 250, 0, 1);
    });
    if (k >= 1 && k < 1.6) { const q = (k - 1) / 0.6; Art.fxAnim(c, 'boom2', q, b.x, b.y - 50, 560, 560, 0, 1); Art.fxAnim(c, 'burst', q, b.x, b.y - 60, 760, 760, 0, 0.9, null, { col: f.def.fx }); }
    // 땅에 닿는 순간: 충격파·흙먼지·흔들림
    if (k >= 1.55 && !K.hit) { K.hit = 1; S.shake = Math.max(S.shake || 0, 0.7); Snd.play('slam'); }
    if (K.hit) {
      const q = Math.min(0.99, (k - 1.55) / 0.6);
      Art.fxAnim(c, 'wave', q, b.x, b.y + 62, 560, 560, 0, 0.9, null, { col: '#fff2d0', sy: 0.4 });
      for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.4, rr = 60 + q * 120; vs(c, 'dust', b.x + Math.cos(a) * rr, b.y + 50 + Math.sin(a) * rr * 0.4 - q * 30, 150 * (0.7 + q * 0.6), a, 0.6 * (1 - q)); }
    }
    drawVfx(c);
    // 처음 0.12초 흰 섬광(화면 덮개)
    if (k < 0.12) { c.save(); c.globalAlpha = 0.5 * (1 - k / 0.12); c.fillStyle = '#fff'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); c.restore(); }
    // 「撃破!」: 화면 고정 좌표(카메라를 풀고). 09-render-camera가 다음에 변환을 다시 세운다
    if (k >= 1 && fade > 0.01) {
      const q = Math.min(1, (k - 1) / 0.15), s0 = 1.7 - 0.7 * outCubic(q), a = Math.min(1, q * 1.5) * fade, us = hudS(), y = hudTop() + 190 * us, txt = I.t('bossDown');
      hudCam(c, 0, 0);
      c.save(); c.globalAlpha = 1;
      popBand(c, y - 70 * us, 140 * us, a * 0.9);
      c.translate(W / 2, y); c.scale(s0 * us, s0 * us); c.globalAlpha = a;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      fitFont(c, txt, 400, 88, '"Black Han Sans", sans-serif', W * 0.8);
      const tg = c.createLinearGradient(0, -44, 0, 44); tg.addColorStop(0, '#fff6e0'); tg.addColorStop(0.5, '#ffd27a'); tg.addColorStop(1, f.def.fx);
      c.lineWidth = 9; c.strokeStyle = 'rgba(14,9,6,.92)'; c.strokeText(txt, 0, 0); c.fillStyle = tg; c.fillText(txt, 0, 0);
      c.restore();
    }
  }
  // 등장 연출의 글씨·레터박스·번쩍임. 확대 변환을 풀고 화면 좌표로 그린다(09-render-camera에서 부른다)
  function drawBossIntro(c) {
    const s = introState();
    if (!s) return;
    const f = s.f, e = s.e, fo = 1 - clamp01((e - 3.7) / 0.4);
    // 내려찍는 순간 한 번: 흔들림
    if (e >= INTRO_HIT && S.introHit !== f) { S.introHit = f; S.shake = Math.max(S.shake || 0, Q.level === 'low' ? 0.55 : 0.8); }
    // 위 장소 글씨와 아래 대사는 휴대폰 배율(hudS, 최대 1.7)만큼 키운다(휴대폰에서 9~10pt로 작았다)
    const bh = 120 * s.lb, cs = hudS();
    c.save();
    c.fillStyle = '#000'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, OVER.y + bh); c.fillRect(-OVER.x, H - bh, W + OVER.x * 2, OVER.y + bh);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    // 0.3초: 장소(위 레터박스)
    const aPlace = clamp01((e - 0.3) / 0.35) * fo;
    if (aPlace > 0) { c.globalAlpha = aPlace; c.fillStyle = '#e8dcc0'; c.font = `700 ${Math.round(26 * cs)}px "Gowun Batang", serif`; c.fillText(g.trial ? I.t('trPlace', { p: f.def.place }) : I.t('roundPlace', { r: f.def.round, p: f.def.place }), W / 2, bh / 2); }
    const TY = H - 275, NY = H - 196;
    // 1.85초: 이름 뒤 먹 띠(신화 등장과 같은 띠)
    const aBand = clamp01((e - 1.85) / 0.25) * fo;
    if (aBand > 0) popBand(c, TY - 80, 245, aBand);
    // 1.6초: 제목이 1.6배에서 1배로 박힌다
    if (e >= INTRO_HIT) {
      const k = clamp01((e - INTRO_HIT) / 0.18), sc = 1.6 - 0.6 * outCubic(k);
      const sz = fitFont(c, f.def.title, 400, 84, '"Black Han Sans", sans-serif', W - 260), tw = c.measureText(f.def.title).width;
      // 양옆 가는 줄이 가운데서 바깥으로 자란다
      const lk = outCubic((e - INTRO_HIT - 0.05) / 0.4);
      if (lk > 0) { c.globalAlpha = fo * 0.85; c.fillStyle = f.def.fx; const L = 220 * lk; c.fillRect(W / 2 - tw / 2 - 24 - L, TY - 1.5, L, 3); c.fillRect(W / 2 + tw / 2 + 24, TY - 1.5, L, 3); }
      c.save(); c.translate(W / 2, TY); c.scale(sc, sc);
      c.globalAlpha = (0.35 + 0.65 * k) * fo;
      const tg = c.createLinearGradient(0, -sz / 2, 0, sz / 2); tg.addColorStop(0, '#fff6e0'); tg.addColorStop(0.45, f.def.fx); tg.addColorStop(1, f.def.fx);
      c.lineWidth = 8; c.strokeStyle = 'rgba(14,9,6,.9)'; c.strokeText(f.def.title, 0, 0);
      c.fillStyle = tg; c.fillText(f.def.title, 0, 0);
      c.restore();
    }
    // 1.9초: 보스 이름(살짝 올라오며)
    const aName = clamp01((e - 1.9) / 0.25) * fo;
    if (aName > 0) {
      c.globalAlpha = aName; fitFont(c, f.def.name, 400, 46, '"Black Han Sans", sans-serif', W - 300);
      c.lineWidth = 6; c.strokeStyle = 'rgba(14,9,6,.85)'; const ny = NY + (1 - aName) * 14;
      c.strokeText(f.def.name, W / 2, ny); c.fillStyle = '#fff'; c.fillText(f.def.name, W / 2, ny);
    }
    // 2.3초: 대사(아래 레터박스)
    const aLine = clamp01((e - 2.3) / 0.35) * fo;
    if (aLine > 0) { c.globalAlpha = aLine; c.fillStyle = '#e8dcc0'; fitFont(c, `“${f.def.line}”`, 400, Math.round(23 * cs), '"Gowun Batang", serif', W - 160); c.fillText(`“${f.def.line}”`, W / 2, H - bh / 2); }
    // 1.6~1.75초: 흰 번쩍임
    if (e >= INTRO_HIT && e < INTRO_HIT + 0.15) { c.globalAlpha = 0.35 * (1 - (e - INTRO_HIT) / 0.15); c.fillStyle = '#fff'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); }
    c.restore();
  }
  const popQ = [];
  const POP_DUR = { 4: 2.4, 5: 2.4, 6: 3.2, 7: 3.8, 8: 3.4, 9: 6.6, 10: 7.2 };
