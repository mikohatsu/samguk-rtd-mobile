  function drawBossAt(c, x, y, t, flash) {
    const f = g.fight, bd = Art.facing(S.bossFace ?? Math.PI / 2), bMove = S.bossMove;
    const im = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, bd.v, bMove ? (Math.sin(t * 10) > 0 ? 1 : 2) : 0);
    Art.drawSprite(c, im, x, y - 56 * (BOSS_S - 1), 200 * BOSS_S, bd.flip, 0, flash ? 0.96 : 1);
    // 번쩍임은 캔버스 필터(brightness) 대신 같은 그림을 한 번 더 밝게 얹는다(필터는 휴대폰에서 매우 느리다)
    if (flash) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; Art.drawSprite(c, im, x, y - 56 * (BOSS_S - 1), 200 * BOSS_S, bd.flip, 0, 0.96); c.restore(); }
  }
  // 전장 바닥은 판마다 한 번만 그려 두고 찍는다(매 프레임 화면 전체에 그라디언트·무늬·그라디언트를 세 번 덧칠하던 것)
  let arenaCv = null, arenaKey = '';
  function arenaFloor(c, a) {
    const key = a.motif + a.ground + a.sky + qMap() + (Art.img('tex_' + a.motif) ? 1 : 0) + (Art.pic('arena_mark') ? 'm' : '');
    if (arenaKey !== key) {
      arenaKey = key;
      if (!arenaCv) arenaCv = document.createElement('canvas');
      const q = qMap(), w = W + OVER.x * 2, h = H + OVER.y * 2;
      arenaCv.width = Math.round(w * q); arenaCv.height = Math.round(h * q);
      const x = arenaCv.getContext('2d');
      x.setTransform(q, 0, 0, q, OVER.x * q, OVER.y * q);
      const gr = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1300);
      gr.addColorStop(0, a.ground); gr.addColorStop(1, a.sky);
      x.fillStyle = gr; x.fillRect(-OVER.x, -OVER.y, w, h);
      // 판마다 같은 배치가 되게 고정 난수
      let sd = 0; for (let i = 0; i < a.motif.length; i++) sd = (sd * 31 + a.motif.charCodeAt(i)) >>> 0;
      const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
      // 바닥 무늬는 크게(2.0배) 깐다. 같은 무늬가 바둑판처럼 반복돼 보이지 않게 칸마다 90° 단위로 돌리고·뒤집고, 줄마다 반 칸씩 어긋나게 놓는다.
      // 캔버스 필터(iOS Safari 지원 미확인) 대신 합성 모드로 누른다: 반투명으로 얹어 대비를 줄이고 → 경기장 색을 얇게 덮고 → 어두운 색을 곱해 밝기를 낮춘다
      const tex = Art.img('tex_' + a.motif);
      arenaCv._tex = !!tex;
      if (tex) {
        const ts = tex.width * 2.0;
        x.save(); x.globalAlpha = 0.5;
        for (let row = 0, ty = -OVER.y - ts / 2; ty < H + OVER.y; row++, ty += ts) {
          for (let tx = -OVER.x - ts + (row % 2 ? ts / 2 : 0); tx < W + OVER.x; tx += ts) {
            const r = Math.floor(rnd() * 8);
            x.save(); x.translate(tx + ts / 2, ty + ts / 2); x.rotate((r & 3) * Math.PI / 2); if (r & 4) x.scale(-1, 1);
            x.drawImage(tex, -ts / 2 - 0.5, -ts / 2 - 0.5, ts + 1, ts + 1); x.restore();
          }
        }
        x.restore();
        x.fillStyle = gr; x.globalAlpha = 0.35; x.fillRect(-OVER.x, -OVER.y, w, h);
        x.globalAlpha = 1; x.globalCompositeOperation = 'multiply'; x.fillStyle = '#9a9288'; x.fillRect(-OVER.x, -OVER.y, w, h);
        x.globalCompositeOperation = 'source-over';
      }
      // 경기장 가운데 바닥 문양(gfx/arena_mark, 팔괘 원판): 바닥에 새긴 것처럼 곱하기로 얹어 타일 반복에서 시선을 뗀다
      const mk = Art.pic('arena_mark');
      if (mk) {
        const mcx = (ARENA.x0 + ARENA.x1) / 2, mcy = (ARENA.y0 + ARENA.y1) / 2, ms = Math.min(ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0) * 0.86;
        x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.4; x.drawImage(mk, mcx - ms / 2, mcy - ms / 2, ms, ms);
        x.globalCompositeOperation = 'soft-light'; x.globalAlpha = 0.25; x.drawImage(mk, mcx - ms / 2, mcy - ms / 2, ms, ms); x.restore();
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
      // 경기장 밖 어둡게: 바깥은 한 번에 덮고, 경계 32px은 그라디언트로 부드럽게 이어 준다
      const E0 = 32, OUT = 'rgba(8,6,4,.58)', NONE = 'rgba(8,6,4,0)';
      x.fillStyle = OUT; x.beginPath(); x.rect(-OVER.x, -OVER.y, w, h);
      x.rect(ARENA.x0 - E0, ARENA.y0 - E0, ARENA.x1 - ARENA.x0 + E0 * 2, ARENA.y1 - ARENA.y0 + E0 * 2); x.fill('evenodd');
      const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => { const eg = x.createLinearGradient(x0, y0, x1, y1); eg.addColorStop(0, NONE); eg.addColorStop(1, OUT); x.fillStyle = eg; x.fillRect(rx, ry, rw, rh); };
      edge(0, ARENA.y0, 0, ARENA.y0 - E0, ARENA.x0 - E0, ARENA.y0 - E0, ARENA.x1 - ARENA.x0 + E0 * 2, E0);
      edge(0, ARENA.y1, 0, ARENA.y1 + E0, ARENA.x0 - E0, ARENA.y1, ARENA.x1 - ARENA.x0 + E0 * 2, E0);
      edge(ARENA.x0, 0, ARENA.x0 - E0, 0, ARENA.x0 - E0, ARENA.y0, E0, ARENA.y1 - ARENA.y0);
      edge(ARENA.x1, 0, ARENA.x1 + E0, 0, ARENA.x1, ARENA.y0, E0, ARENA.y1 - ARENA.y0);
    }
    blitBg(c, arenaCv, 'arena', arenaKey);
    return arenaCv._tex;
  }
  // 경기장 경계 장식(gfx/arena_rim: 네 변에 돌·나무 난간, 가운데 투명). 9조각으로 늘여 모서리가 찌그러지지 않게 두른다.
  // 그림이 아직 없으면 예전 경계선(바깥 어두운 4px + 안쪽 보스색 1.5px).
  function arenaRim(c, f, a) {
    const im = Art.pic('arena_rim'), aw = ARENA.x1 - ARENA.x0, ah = ARENA.y1 - ARENA.y0;
    c.save(); c.globalAlpha = a;
    if (im) {
      // 난간 두께는 그림의 11%(약 88px). 잘라 쓰는 너비는 모서리 기둥까지 들어가게 13%, 그릴 굵기 54. 경기장 경계선 바깥쪽에 대부분 걸치게 둔다.
      const e = 54, sl = Math.round(Math.min(im.width, im.height) * 0.13);
      Art.nine(c, im, ARENA.x0 - e * 0.75, ARENA.y0 - e * 0.75, aw + e * 1.5, ah + e * 1.5, sl, e, { hollow: true });
    } else {
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 4; c.strokeRect(ARENA.x0 - 2, ARENA.y0 - 2, aw + 4, ah + 4);
      c.strokeStyle = f.def.fx + '88'; c.lineWidth = 1.5; c.strokeRect(ARENA.x0, ARENA.y0, aw, ah);
    }
    c.restore();
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
    const zoom = Q.level === 'low' ? 0.22 : 0.3;
    return {
      e, f, out,
      z: 1 + (zoom * push + (e >= INTRO_HIT ? 0.04 * clamp01((e - INTRO_HIT) / 0.25) : 0) + kick * 0.12) * out,
      m: 0.55 * push * out, // 확대 중심이 화면 가운데에서 보스 쪽으로 옮겨 가는 정도
      big: 1 + 0.28 * push * out, // 보스 그림만 키운다(판정 크기는 그대로)
      dark: 0.62 * outCubic((e - 0.1) / 1.2) * out,
      lb: Math.min(1, outCubic(e / 0.5)) * (1 - outCubic((e - 3.7) / 0.5)),
    };
  }
  // 09-render-camera에서 부른다: 펀치처럼 그리기 변환만 덧씌운다
  function introCam(c, s) {
    if (!s || s.z <= 1.0005 && s.m <= 0.0005) return;
    const b = s.f.boss, px = W / 2 + (b.x - W / 2) * s.m, py = H / 2 + (b.y - 40 - H / 2) * s.m;
    c.translate(W / 2, H / 2); c.scale(s.z, s.z); c.translate(-px, -py);
  }
  function drawArena(t) {
    const c = ctx, f = g.fight, a = f.def.arena, b = f.boss, IS = introState();
    if (!arenaFloor(c, a)) drawMotif(c, a.motif, '#f0e0c0', t);
    // 경계: 등장 연출 중에는 숨기고 끝나기 0.5초 전부터 다시 보인다
    const edgeA = IS ? clamp01((IS.e - 3.7) / 0.5) : 1;
    if (edgeA > 0) arenaRim(c, f, edgeA);
    f.hazards.forEach((h) => drawHazard(c, h));
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
    if (hr.pend > 0 && hr.kt >= FLINCH_GAP) { hr.k = Math.min(1.4, hr.k + 0.55 + Math.min(0.6, hr.pend / (b.mhp * 0.02))); hr.pend = 0; hr.kt = 0; }
    hr.hp = b.hp; hr.k *= Math.pow(0.8, S.f60);
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
      drawR();
      if (hr.k > 0.08) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(0.85, hr.k * 0.7); drawR(); c.restore(); }
    } else {
      Art.drawSprite(c, bImg, bx, by, sc, bd.flip, hr.ax * hr.k * 0.06 * (bd.flip ? -1 : 1), sy);
      if (hr.k > 0.08) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(0.85, hr.k * 0.7); Art.drawSprite(c, bImg, bx, by, sc, bd.flip, 0, sy); c.restore(); }
    }
    if (hr.slam > 0.1) { Art.fxAnim(c, 'ring', 1 - hr.slam, b.x, b.y + 62, 420, 170, 0, 1); Art.fxAnim(c, 'boom2', Math.min(0.99, (1 - hr.slam) * 1.3), b.x, b.y + 40, 260, 260, 0, 0.9); }
    if (hr.slam > 0.1) Art.fxAnim(c, 'wave', 1 - hr.slam, b.x, b.y + 62, 380, 380, 0, 0.9, null, { col: '#fff2d0', sy: 0.4 });
    c.filter = 'none';
    c.textAlign = 'center';
    if (M.charmT > 0) {
      // 매혹: 하트 그림(Kenney symbol_01)이 떠오른다
      if (SKF) for (let i = 0; i < 5; i++) {
        const ph = (t * 0.8 + i / 5) % 1, hx = b.x + Math.sin(i * 2.3 + t * 2) * 46, hy = b.y - 70 - ph * 90, s = (14 + Math.sin(ph * Math.PI) * 10) * 3.2;
        SKF.spr(c, 'symbol_01', i % 2 ? '#ff7ac0' : '#ffb0dc', hx, hy, s, s, 0, Math.sin(ph * Math.PI) * 0.95);
      }
      bossTag(c, I.t('e_charm'), b.x, b.y - 84, '400 28px "Black Han Sans", sans-serif', '#ff9ad0');
    } else if (b.stun > 0) bossTag(c, I.t('stun'), b.x, b.y - 84, '400 22px "Black Han Sans", sans-serif', '#ffe27a');
    if (M.gr > 0) bossTag(c, I.t('groggy'), b.x, b.y - 96, '400 30px "Black Han Sans", sans-serif', '#7fd4ff');
    if (M.ctr > 0) {
      bossTag(c, I.t('counter'), b.x, b.y - 112, '400 28px "Black Han Sans", sans-serif', '#bfe2ff');
      // 반격 게이지: 정면에서 넣은 피해
      bar(c, b.x, b.y - 92, 150, 8, Math.min(1, (M.ctrGot || 0) / (M.ctrNeed || 1)), '#4aa8ff');
    }
    if (M.ampT > 0) bossTag(c, I.t('weakened', { n: Math.round(M.amp * 100) }), b.x, b.y + 98, '700 18px "IBM Plex Sans KR", sans-serif', '#d8b4ff');
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
        rangeMark(c, u.x, u.y, g.range(u.def) + 40, '#7dff8e', 0.13);
        selMark(c, u.x, u.y + CHAMP_R * 0.72, CHAMP_R, t);
        if (u.move) streak(c, '#7dff8e', u.x, u.y, u.tx, u.ty, 5, 0.55);
      }
      drawBuffs(c, u, t);
      // 맞으면 보스 반대쪽으로 튕겨 밀린다(그림만, 위치는 그대로). 피격 빛은 붉은 빛 그림.
      const kb = Math.max(0, (u.hurt || 0) / 0.2), ka = Math.atan2(u.y - b.y, u.x - b.x), kx = u.x + Math.cos(ka) * kb * 12, ky = u.y + Math.sin(ka) * kb * 8;
      if (u.hurt > 0 && SKF0) SKF0.spr(c, 'light_01', '#ff3c28', kx, ky - 10, 130, 130, 0, 0.7 * kb);
      // 조각 애니메이션 동작 상태: 공격(atkT 0.24)·스킬(0.36 이상)은 시작할 때의 길이로 구분, 맞으면 피격, 움직이면 걷기
      if ((u.atkT || 0) > (u._atkPrev || 0) + 0.01) u._atkMax = u.atkT;
      u._atkPrev = u.atkT || 0;
      const rs = u.atkT > 0 ? { state: (u._atkMax || 0) >= 0.3 ? 'skill' : 'attack', p: 1 - u.atkT / (u._atkMax || 0.24), t } : kb > 0.05 ? { state: 'hurt', k: kb, t } : { state: u.move || u.moveT > 0 ? 'walk' : 'idle', t };
      piece(c, kx, ky, CHAMP_R, u.def, t, u.owner === 1, { pose: poseOf(u, t, CHAMP_R), rig: rs });
      bar(c, u.x, u.y - 80, 76 * uiS(), 7 * uiS(), u.hp / u.mhp, u.hp / u.mhp < 0.3 ? '#ff6a50' : '#7ed08c');
    });
    drawAim(c);
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
    if (g.phase === 'boss') {
      // 휴대폰에서는 보스 체력·남은 시간·기술 이름·딜미터를 키워 그린다(위 가운데 / 오른쪽 위 기준)
      const us = uiS();
      c.save(); c.translate(W - 56, 66); c.scale(Math.min(us, 1.3), Math.min(us, 1.3)); c.translate(-(W - 56), -66);
      drawMeter(c, meterRows(f.dealt, f.total));
      c.restore();
      c.save(); c.translate(W / 2, 0); c.scale(us, us); c.translate(-W / 2, 0);
      bossBar(c, f, b, us);
      c.fillStyle = '#fff'; c.font = '700 18px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineJoin = 'round'; c.strokeText(`${f.def.name}  ${fmt(b.hp)} / ${fmt(b.mhp)}`, W / 2, 34);
      c.fillText(`${f.def.name}  ${fmt(b.hp)} / ${fmt(b.mhp)}`, W / 2, 34);
      const left = Math.max(0, f.limit - f.t), fast = f.t / f.limit <= 1 - g.fastNeed();
      c.fillStyle = left < 20 ? '#ff7a60' : '#fff'; c.font = '400 28px "Black Han Sans", sans-serif'; c.fillText(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, W / 2, 68);
      c.fillStyle = fast ? '#ffd86a' : '#a8987f'; c.font = '500 13px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t(fast ? 'fastOk' : 'fastNo'), W / 2, 90);
      const M = f.mech;
      if (M.vuln > 0) { c.fillStyle = '#ffb070'; c.font = '700 14px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('vuln', { n: Math.round(M.vuln * 100) }), W / 2 + 560, 34); }
      if (M.cast) {
        const fr = Math.min(1, M.cast.got / M.cast.need), left = Math.max(0, M.cast.dur - M.cast.t);
        { const pl = Art.pic('ui_title'); if (pl) Art.nine(c, pl, W / 2 - 350, 146, 700, 66, 24, 22); else { c.fillStyle = 'rgba(16,11,8,.75)'; c.fillRect(W / 2 - 330, 150, 660, 58); } }
        bar(c, W / 2, 190, 620, 16, fr, '#7fd4ff');
        c.fillStyle = '#fff'; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('castLine', { a: M.cast.n, p: Math.round(fr * 100), s: left.toFixed(1) }) + I.t(M.cast.spots ? 'castSpots' : 'castAll'), W / 2, 166);
        // 서야 할 자리는 실제 전장 좌표라서 글씨 확대를 잠시 풀고 그린다
        if (M.cast.spots) { c.save(); c.translate(W / 2, 0); c.scale(1 / us, 1 / us); c.translate(-W / 2, 0); M.cast.spots.forEach((s) => { Art.fxPic(c, 'mc_rune3', s[0], s[1], s[2] * 2.1, s[2] * 2.1, t * 0.6, 0.85, { col: '#a8ffb8' }); ringSpr(c, 'circle_02', '#a8ffb8', s[0], s[1], s[2], 0, 0.9); }); c.restore(); }
      }
      if (M.objs.some((o) => o.k === 'clone')) { c.fillStyle = '#fff'; c.font = '700 17px "IBM Plex Sans KR", sans-serif'; c.fillText(I.t('clones'), W / 2, 176); }
      if (S.pattern && S.pattern.t > 0) {
        S.pattern.t -= S.fdt;
        // 기술 이름: 체력바 밑 고정 자리에 어두운 금속 판 그림(gfx/ui_title)을 깔아 제단·장판 그림과 겹쳐도 읽히게 한다.
        // 나타날 때는 위아래로 펼쳐지고 사라질 때는 접힌다(투명하게 흐려지며 뒤 그림과 섞이지 않게).
        const open = Math.min(1, (1.6 - S.pattern.t) / 0.12), close = Math.min(1, S.pattern.t / 0.22), fy = Math.max(0.02, Math.min(open, close));
        c.font = '400 38px "Black Han Sans", sans-serif';
        const pw = Math.min(900, c.measureText(S.pattern.name).width + 90), pl = Art.pic('ui_title');
        c.save(); c.translate(W / 2, 132); c.scale(1, fy);
        if (pl) Art.nine(c, pl, -pw / 2, -29, pw, 58, 26, 24);
        else { c.fillStyle = 'rgba(16,11,8,.72)'; c.fillRect(-pw / 2, -23, pw, 46); c.fillStyle = f.def.fx; c.fillRect(-pw / 2, -23, pw, 2); c.fillRect(-pw / 2, 21, pw, 2); }
        c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineJoin = 'round'; c.strokeText(S.pattern.name, 0, 0);
        c.fillStyle = f.def.fx; c.fillText(S.pattern.name, 0, 0); c.restore();
      }
      c.restore();
    }
    // 등장 연출: 보스 주변만 밝게(바깥을 둥글게 누른다). 전장 좌표라 확대와 함께 움직인다
    if (IS && IS.dark > 0.01) {
      const r0 = 150 * IS.big, sg = c.createRadialGradient(b.x, b.y - 40, r0, b.x, b.y - 40, r0 + 520);
      sg.addColorStop(0, 'rgba(6,4,3,0)'); sg.addColorStop(1, `rgba(6,4,3,${IS.dark.toFixed(3)})`);
      c.fillStyle = sg; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
    }
  }
  // 보스·장수 머리 위 글자: 휴대폰 배율을 곱하고 먹 테두리를 두른다
  function bossTag(c, txt, x, y, font, col) {
    if (!txt) return;
    const us = uiS();
    c.save(); c.translate(x, y); c.scale(us, us); c.font = font; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    c.lineWidth = 5; c.strokeStyle = 'rgba(16,10,6,.9)'; c.strokeText(txt, 0, 0); c.fillStyle = col; c.fillText(txt, 0, 0); c.restore();
  }
  // 보스 체력 막대: 장식 틀 그림(gfx/ui_bossbar) 안쪽에 채움. 줄어든 만큼 잠깐 남았다가 뒤따라 줄어드는 잔상 띠, 왼쪽 끝에 보스 얼굴(기존 SD 그림).
  // 폭은 휴대폰 배율을 곱해도 오른쪽 위 버튼 밑으로 들어가지 않게 줄인다. 그림이 없으면 어두운 금속 판(ui_title) 틀.
  // (호출하는 쪽이 화면 위 가운데를 기준으로 us배 해 두었다)
  function bossBar(c, f, b, us) {
    const BW = Math.min(820, 1000 / us), BH = 28, x0 = W / 2 - BW / 2, y = 20, fr = Math.max(0, Math.min(1, b.hp / b.mhp));
    let gh = S.bossGhost;
    if (!gh || gh.f !== f) gh = S.bossGhost = { f, v: fr, last: fr, hold: 0 };
    if (fr < gh.last - 1e-6) gh.hold = 0.45; // 맞은 순간: 잔상은 잠깐 그대로 있다가
    gh.last = fr; gh.hold -= S.fdt;
    if (gh.hold <= 0) gh.v = Math.max(fr, gh.v - S.fdt * 0.5); // 뒤따라 줄어든다
    if (gh.v < fr) gh.v = fr;
    const im = Art.pic('ui_bossbar');
    if (im) {
      // 틀 그림(1200×203): 안쪽 검은 칸이 x 205~1095, y 68~165. 왼쪽 용머리(0~230)·오른쪽 구름(1070~1200)은 세로 배율 그대로 두고 가운데만 가로로 늘인다(3조각).
      const k = BH / 97, L = 230, R = 1070, fx0 = x0 - 205 * k, fw = BW + (205 + 105) * k, fy = y - 68 * k, fh = im.height * k;
      c.drawImage(im, 0, 0, L, im.height, fx0, fy, L * k, fh);
      c.drawImage(im, L, 0, R - L, im.height, fx0 + L * k, fy, fw - (L + im.width - R) * k, fh);
      c.drawImage(im, R, 0, im.width - R, im.height, fx0 + fw - (im.width - R) * k, fy, (im.width - R) * k, fh);
    } else { const pl = Art.pic('ui_title'); if (pl) Art.nine(c, pl, x0 - 26, y - 9, BW + 52, BH + 18, 26, 20); c.fillStyle = 'rgba(8,5,3,.82)'; c.fillRect(x0, y, BW, BH); }
    // 채움: 틀 안쪽 둥근 끝에 걸리지 않게 양끝·위아래를 조금 들인다
    const ix = x0 + 4, iy = y + 3, iw = BW - 8, ih = BH - 6;
    c.fillStyle = 'rgba(255,240,210,.7)'; c.fillRect(ix, iy, iw * gh.v, ih);
    c.fillStyle = f.def.fx; c.fillRect(ix, iy, iw * fr, ih);
    c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(ix, iy, iw * fr, ih * 0.4);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(ix, iy + ih * 0.75, iw * fr, ih * 0.25);
    // 보스 얼굴: 틀 그림이 없을 때만 왼쪽 끝에(틀 그림은 왼쪽 끝이 용머리 장식이라 겹치지 않게 생략)
    const face = !im && Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, 0, 0);
    if (face) { c.save(); c.beginPath(); c.rect(x0 - 96, y - 40, 92, BH + 46); c.clip(); Art.drawSprite(c, face, x0 - 48, y + 36, 116, false); c.restore(); }
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
  // ---- 보스 처치 순간(그리기만. 판정·시간은 그대로): 이긴 직후 KILL_LEN초 동안 마지막 아레나를 붙잡고 보스가 쓰러진다 ----
  // 혼자 할 때만 그동안 계산을 멈추고(히트스톱과 같은 방식), 협동은 시계를 맞춰야 해서 멈추지 않는다(화면만 붙잡는다).
  const KILL_LEN = 1.3;
  function watchKill() {
    if (g.fight && g.phase === 'boss') { S.lastFight = g.fight; return; }
    const f = S.lastFight;
    if (!f) return;
    S.lastFight = null;
    if (g.fight === f) return; // 실패로 판이 끝난 경우(보스전이 그대로 남는다)
    const bs = g.stats && g.stats.bosses, lb = bs && bs[bs.length - 1];
    if (!lb || !lb.win || lb.round !== f.def.round) return;
    const ac = f.champs.find((u) => !u.dead && !u.bench);
    S.kill = { f, t: 0, flip: ac ? ac.x > f.boss.x : false, hit: 0 };
    S.shake = Math.max(S.shake || 0, 1);
    if (!net) S.hitStop = Math.max(S.hitStop || 0, KILL_LEN);
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* 진동 없음 */ } }
  }
  const killOn = () => !!(S.kill && S.kill.t < KILL_LEN);
  function drawKillCam(t) {
    const K = S.kill, f = K.f, b = f.boss, c = ctx, SK = window.RTD_SKFX;
    K.t += S.fdt;
    const k = K.t;
    arenaFloor(c, f.def.arena); arenaRim(c, f, 1);
    // 이긴 장수들은 보스 쪽을 보고 선다
    f.champs.forEach((u) => { if (u.dead || u.bench) return; piece(c, u.x, u.y, CHAMP_R, u.def, t, u.owner === 1, { pose: poseOf({ face: Math.atan2(b.y - u.y, b.x - u.x), def: u.def, id: 1 }, t, CHAMP_R), rig: { state: 'idle', t } }); });
    Object.values(f.ghosts || {}).forEach((o) => { if (o.def) piece(c, o.x, o.y, CHAMP_R, o.def, t, true, { pose: poseOf({ face: Math.atan2(b.y - o.y, b.x - o.x), def: o.def, id: 1 }, t, CHAMP_R) }); });
    // 보스: 0.12초 하얗게 번쩍 → 쓰러짐 동작(조각 애니메이션 'dead', 없으면 그림을 발끝 기준으로 눕힘) → 흐려진다
    const fall = Math.min(1, Math.max(0, (k - 0.12) / 0.7)), e = 1 - Math.pow(1 - fall, 3), fade = 1 - Math.max(0, (k - 0.85) / (KILL_LEN - 0.85));
    const by = b.y - 56 * (BOSS_S - 1), sc = 200 * BOSS_S, RG = window.RTD_RIG;
    const rv = RG && (RG.has(f.def.id, 'f') ? 'f' : RG.has(f.def.id, 's') ? 's' : null);
    if (SK && k < 0.6) SK.spr(c, 'light_01', f.def.fx, b.x, b.y - 40, 560, 560, k, (1 - k / 0.6) * 0.9);
    blobShadow(c, b.x, b.y + 62, 124 * BOSS_S, 0.7 * fade);
    const drawB = () => {
      if (rv) { c.save(); c.translate(b.x, by); RG.draw(c, f.def.id, 0, 0, sc, K.flip, { state: 'dead', k: e, view: rv, t }); c.restore(); return; }
      const im = Art.namedSprite(f.def.id, T.bossLooks[f.def.id], f.def.fx, 0, 0), foot = by + sc * 0.34;
      c.save(); c.translate(b.x, foot); c.rotate((K.flip ? 1 : -1) * e * 1.35); Art.drawSprite(c, im, 0, -sc * 0.34, sc, K.flip); c.restore();
    };
    c.save(); c.globalAlpha = fade; drawB();
    if (k < 0.3) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k / 0.3) * 0.9; drawB(); }
    c.restore();
    // 빛살 터짐(처음) → 땅에 닿는 순간 충격파·흙먼지·흔들림
    if (k < 0.6) Art.fxAnim(c, 'burst', k / 0.6, b.x, b.y - 60, 640, 640, 0, 1, null, { col: f.def.fx });
    if (fall >= 1 && !K.hit) { K.hit = 1; S.shake = Math.max(S.shake || 0, 0.7); }
    if (K.hit) {
      const q = Math.min(0.99, (k - 0.82) / 0.45);
      Art.fxAnim(c, 'wave', q, b.x, b.y + 62, 520, 520, 0, 0.9, null, { col: '#fff2d0', sy: 0.4 });
      for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.4, rr = 60 + q * 120; vs(c, 'dust', b.x + Math.cos(a) * rr, b.y + 50 + Math.sin(a) * rr * 0.4 - q * 30, 150 * (0.7 + q * 0.6), a, 0.6 * (1 - q)); }
    }
    drawVfx(c);
    // 처음 0.12초 흰 섬광(화면 덮개)
    if (k < 0.12) { c.save(); c.globalAlpha = 0.5 * (1 - k / 0.12); c.fillStyle = '#fff'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); c.restore(); }
  }
  // 등장 연출의 글씨·레터박스·번쩍임. 확대 변환을 풀고 화면 좌표로 그린다(09-render-camera에서 부른다)
  function drawBossIntro(c) {
    const s = introState();
    if (!s) return;
    const f = s.f, e = s.e, fo = 1 - clamp01((e - 3.7) / 0.4);
    // 내려찍는 순간 한 번: 흔들림
    if (e >= INTRO_HIT && S.introHit !== f) { S.introHit = f; S.shake = Math.max(S.shake || 0, Q.level === 'low' ? 0.55 : 0.8); }
    const bh = 120 * s.lb;
    c.save();
    c.fillStyle = '#000'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, OVER.y + bh); c.fillRect(-OVER.x, H - bh, W + OVER.x * 2, OVER.y + bh);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    // 0.3초: 장소(위 레터박스)
    const aPlace = clamp01((e - 0.3) / 0.35) * fo;
    if (aPlace > 0) { c.globalAlpha = aPlace; c.fillStyle = '#e8dcc0'; c.font = '700 26px "Gowun Batang", serif'; c.fillText(I.t('roundPlace', { r: f.def.round, p: f.def.place }), W / 2, bh / 2); }
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
    if (aLine > 0) { c.globalAlpha = aLine; c.fillStyle = '#e8dcc0'; fitFont(c, `“${f.def.line}”`, 400, 23, '"Gowun Batang", serif', W - 160); c.fillText(`“${f.def.line}”`, W / 2, H - bh / 2); }
    // 1.6~1.75초: 흰 번쩍임
    if (e >= INTRO_HIT && e < INTRO_HIT + 0.15) { c.globalAlpha = 0.35 * (1 - (e - INTRO_HIT) / 0.15); c.fillStyle = '#fff'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); }
    c.restore();
  }
  const popQ = [];
  const POP_DUR = { 4: 2.4, 5: 2.4, 6: 3.2, 7: 3.8, 8: 3.4, 9: 6.6, 10: 7.2 };
