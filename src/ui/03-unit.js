  // ---- 전장 위 등장 연출 ----
  // 라인 유닛을 처음 그리는 순간부터 등급별 연출을 띄운다(게임 상태는 건드리지 않고 화면 쪽 WeakMap에만 기록).
  // 1~3성 0.35초 톡, 4·5성 등급색 고리, 6·7성 빛기둥, 전설 금빛 기둥과 빛살, 신화·불멸은 등장 컷신이 끝난 뒤 큰 빛기둥·법진·흔들림.
  const BIRTH_LEN = [0, 0.35, 0.35, 0.35, 0.55, 0.55, 0.9, 0.9, 1.1, 1.3, 1.6];
  const BORN = new WeakMap();
  let bornG = null, bornT0 = 0;
  const bigPopWaiting = () => (S.pop && S.pop.def && S.pop.def.tier >= 9) || popQ.some((q) => q.def && q.def.tier >= 9);
  function bornAge(u, t) {
    // 라인의 실제 유닛만(보스전 장수는 uid가 있고, 남의 전장은 order가 없는 임시 묶음이다)
    if (!u.order || u.uid != null || !u.def || !u.def.tier) return -1;
    if (bornG !== g) { bornG = g; bornT0 = t; }
    let b = BORN.get(u);
    if (!b) { b = { t0: t, done: t - bornT0 < 0.6 }; BORN.set(u, b); } // 판 시작·이어하기 직후 이미 있던 유닛은 연출 없이
    if (b.done) return -1;
    const tier = u.def.tier;
    if (tier >= 9 && bigPopWaiting()) { b.t0 = t; return -1; } // 컷신이 끝나면 터진다
    if (!b.go) {
      b.go = 1;
      if (tier >= 9) { Snd.play('pillar', 200); S.shake = Math.max(S.shake || 0, tier >= 10 ? 0.9 : 0.6); }
      else if (tier >= 6) { Snd.play('shimmer', 120); if (tier >= 7) S.shake = Math.max(S.shake || 0, tier >= 8 ? 0.4 : 0.25); }
    }
    const age = t - b.t0;
    if (age >= BIRTH_LEN[Math.min(10, tier)]) { b.done = true; return -1; }
    return age;
  }
  function birthFx(c, x, y, r, tier, col, age, front) {
    const L = BIRTH_LEN[Math.min(10, tier)], k = age / L, fy = y + r * 0.72, SK = window.RTD_SKFX, low = Q.level === 'low';
    const bell = Math.sin(Math.min(1, k) * Math.PI), quick = Math.max(0, 1 - age / 0.18);
    if (front) {
      // 몸이 하얗게 번쩍했다 빠진다(6성부터) + 위로 튀는 반짝이
      if (tier >= 6 && SK && quick > 0) SK.spr(c, 'light_01', '#ffffff', x, y - r * 0.4, r * 4, r * 4, 0, quick * (tier >= 9 ? 1 : 0.75));
      if (tier >= 4 && SK && !low) {
        const n = Math.round((tier >= 9 ? 10 : tier >= 6 ? 6 : 3) * qPart());
        for (let i = 0; i < n; i++) { const an = i * 2.4 + tier, d = r * (0.6 + k * (tier >= 8 ? 2.4 : 1.6)); SK.spr(c, 'star_04', i % 2 ? '#ffffff' : col, x + Math.cos(an) * d, y - r * 0.3 + Math.sin(an) * d * 0.6 - k * r * 1.2, 14 + tier, 14 + tier, 0, 1 - k); }
      }
      return;
    }
    // 발밑에 퍼지는 충격파 고리(프레임 애니메이션 gfx/fxa_wave.png, 모든 등급). 1~3성은 작고 흰 고리로 가볍게.
    if (k < 1) Art.fxAnim(c, 'wave', k, x, fy, r * (tier <= 3 ? 3 : tier <= 5 ? 4.2 : 5.4), r * (tier <= 3 ? 3 : tier <= 5 ? 4.2 : 5.4), 0, tier <= 3 ? 0.8 : 1, null, { col: tier <= 3 ? '#fff6dc' : col, sy: 0.45 });
    if (tier < 4 || !SK) return;
    if (tier >= 6) {
      // 빛기둥(Kenney 빛줄기 그림): 순식간에 솟았다가 가늘어지며 사라진다
      const hgt = r * (tier >= 9 ? 14 : tier >= 8 ? 10 : 7), wid = r * (tier >= 9 ? 2.4 : tier >= 8 ? 1.8 : 1.3) * (1 - k * 0.6), pa = Math.min(1, age / 0.06) * (1 - k);
      SK.spr(c, 'trace_06', col, x, fy - hgt / 2, wid * 4, hgt, 0, pa);
      SK.spr(c, 'light_03', col, x, fy, wid * 2.2, wid * 2.2, k * 2, pa * 0.7, true, 0.45);
      if (tier >= 8) SK.spr(c, 'trace_06', '#ffffff', x, fy - hgt / 2, wid * 1.6, hgt, 0, pa * 0.8);
    }
    if (tier >= 8) {
      // 빛살 터짐(프레임 애니메이션 gfx/fxa_burst.png)
      Art.fxAnim(c, 'burst', Math.min(0.99, k * 1.4), x, y - r * 0.4, r * 7, r * 7, 0, 1, null, { col: tier === 8 ? '#ffd27a' : col });
      SK.spr(c, 'flare_01', '#fff0c8', x, fy - r * (tier >= 9 ? 12 : 8), r * 3, r * 3, k * 3, bell * 0.8);
    }
    if (tier >= 9) {
      // 바닥 법진(gfx/mc_rune*.png)이 돌며 펼쳐지고, 흰 충격파가 한 겹 더 퍼진다
      Art.fxPic(c, 'mc_rune1', x, fy, r * (2 + ease2(k) * 4), r * (2 + ease2(k) * 4), k * 3, (1 - k) * 0.9, { col, sy: 0.42 });
      if (tier >= 10) Art.fxPic(c, 'mc_rune2', x, fy, r * (1.5 + ease2(k) * 3), r * (1.5 + ease2(k) * 3), -k * 4, 1 - k, { col: '#fff0c8', sy: 0.42 });
      if (k < 1) Art.fxAnim(c, 'wave', k, x, fy, r * 9, r * 9, 0, 0.8, null, { col: '#ffffff', sy: 0.45 });
    }
  }
  const ease2 = (p) => 1 - (1 - p) * (1 - p);
  // 등장 순간 몸이 톡 커졌다 돌아온다(높은 등급일수록 크게)
  function birthScale(tier, age) {
    const up = tier <= 3 ? 0.12 : 0.16, big = tier <= 3 ? 1.12 : tier <= 7 ? 1.2 : 1.3;
    if (age < up) return 0.55 + (big - 0.55) * (age / up);
    return Math.max(1, big - (age - up) * (tier <= 3 ? 1.2 : 0.9));
  }
  function poseOf(u, t, r) {
    const f = u.face == null ? Math.PI / 2 : u.face, dir = Art.facing(f), p = { flip: !!dir.flip, v: dir.v, frame: 0, x: 0, y: 0, rot: 0, sy: 1 };
    const ba = bornAge(u, t);
    if (ba >= 0) { p.born = ba; p.bornS = birthScale(u.def.tier, ba); }
    if (u.moveT > 0) { const w = t * 15 + (u.id || u.uid || 0); p.y -= Math.abs(Math.sin(w)) * r * 0.12; p.frame = Math.sin(w) > 0 ? 1 : 2; p.sy = 1 + Math.abs(Math.cos(w)) * 0.03; }
    if (u.atkT > 0) {
      // 무기 계열마다 다른 공격 동작: q는 동작 진행(0→1)
      const q = 1 - Math.min(1, u.atkT / 0.22), wp = g.weapon(u.def), side = p.flip ? -1 : 1, cx = Math.cos(f), cy = Math.sin(f);
      const kind = ATK_KIND[wp] || 'slash';
      if (kind === 'thrust') {
        // 창: 뒤로 당겼다가 길게 찌른다
        const d = q < 0.3 ? -q / 0.3 * 0.35 : Math.sin(((q - 0.3) / 0.7) * Math.PI) * 1.15;
        p.x += cx * r * d; p.y += cy * r * d; p.sy = 1 - 0.08 * Math.max(0, d);
      } else if (kind === 'slash') {
        // 검: 한 바퀴 휘두르며 살짝 뛰어든다
        p.rot += side * (-0.6 + q * 1.4) * Math.sin(q * Math.PI); const d = Math.sin(q * Math.PI) * 0.45;
        p.x += cx * r * d; p.y += cy * r * d - Math.sin(q * Math.PI) * r * 0.15;
      } else if (kind === 'heavy') {
        // 대도·도끼·철퇴: 크게 들어 올렸다가 내리찍는다
        if (q < 0.5) { const k = q / 0.5; p.rot -= side * 0.45 * k; p.y -= r * 0.35 * k; p.sy = 1 + 0.08 * k; }
        else { const k = (q - 0.5) / 0.5; p.rot += side * (0.55 - 0.55 * k); p.x += cx * r * 0.5 * (1 - k); p.y += cy * r * 0.5 * (1 - k) + r * 0.05; p.sy = 0.86 + 0.14 * k; }
      } else if (kind === 'ranged') {
        // 활: 시위를 놓으며 뒤로 밀린다
        const k = Math.sin(q * Math.PI); p.x -= cx * r * 0.32 * k; p.y -= cy * r * 0.32 * k; p.rot -= side * 0.12 * k; p.sy = 1 + 0.05 * k;
      } else {
        // 술사: 떠오르며 기를 모아 쏜다
        const k = Math.sin(q * Math.PI); p.y -= r * 0.3 * k; p.sy = 1 + 0.12 * k; p.cast = k;
      }
    }
    return p;
  }
  // 보스전 버프 표시: 걸려 있는 동안 발밑에 장판이 깔리고, 남은 시간만큼 테두리 호가 줄어든다
  const BUFF_LOOK = {
    buff: { c: '#ffb347', n: I.t('buff_buff') }, rally: { c: '#ffe07a', n: I.t('buff_rally') }, cover: { c: '#9ec0f0', n: I.t('buff_cover') }, psh: { c: '#d8ecff', n: I.t('buff_psh') }, haste: { c: '#ffd27a', n: I.t('buff_haste') }, taunt: { c: '#8fb0d8', n: I.t('buff_taunt') }, shield: { c: '#d8ecff', n: I.t('buff_shield') },
  };
  function drawBuffs(c, u, t) {
    const list = [];
    if (u.buffT > 0 && u.buff > 0) list.push(['buff', u.buffT, buffMax(u, 'buff')]);
    if (u.pbuffT > 0) list.push(['rally', u.pbuffT, u.pbuffMax || 6]);
    if (u.tauntT > 0) list.push(['taunt', u.tauntT, buffMax(u, 'taunt')]);
    if (u.shieldT > 0) list.push(['shield', u.shieldT, buffMax(u, 'shield')]);
    if (u.coverT > 0) list.push(['cover', u.coverT, u.coverMax || 4]);
    if (u.pshT > 0) list.push(['psh', u.pshT, u.pshMax || 3]);
    if (u.hasteT > 0) list.push(['haste', u.hasteT, u.hasteMax || 6]);
    list.forEach(([k, left, max], i) => {
      const L = BUFF_LOOK[k], rx = 48 + i * 12, ry = rx * 0.45, cy = u.y + 24, frac = Math.max(0, Math.min(1, left / (max || left)));
      c.save();
      // 바닥 장판: 은은하게 맥동
      const spr = glowSprite('b' + L.c, [[0, L.c + '00'], [0.7, L.c + '44'], [0.98, L.c + 'aa'], [1, L.c + '00']]);
      c.globalAlpha = 0.75 + Math.sin(t * 6 + i) * 0.15; c.drawImage(spr, u.x - rx, cy - ry, rx * 2, ry * 2);
      // 남은 시간 호
      c.globalAlpha = 1; c.strokeStyle = L.c; c.lineWidth = 3; c.shadowColor = L.c; c.shadowBlur = 10;
      c.beginPath(); c.ellipse(u.x, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.stroke();
      // 도는 문양 점
      c.fillStyle = '#fff';
      for (let j = 0; j < 3; j++) { const a = t * 2.5 + (j * Math.PI * 2) / 3 + i; c.beginPath(); c.arc(u.x + Math.cos(a) * rx, cy + Math.sin(a) * ry, 2.5, 0, 7); c.fill(); }
      c.restore();
      if (k === 'shield') { c.save(); c.strokeStyle = L.c; c.globalAlpha = 0.6; c.lineWidth = 3; c.beginPath(); c.arc(u.x, u.y - 10, 40, 0, 7); c.stroke(); c.restore(); }
    });
    // 머리 위에 걸린 버프 이름
    if (list.length) {
      c.save(); c.font = '700 13px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center';
      list.forEach(([k, left], i) => { const L = BUFF_LOOK[k]; c.fillStyle = 'rgba(16,10,6,.7)'; c.fillRect(u.x - 34, u.y - 96 - i * 17, 68, 15); c.fillStyle = L.c; c.fillText(`${L.n} ${Math.ceil(left)}s`, u.x, u.y - 84 - i * 17); });
      c.restore();
    }
  }
  // 그 버프를 건 스킬의 원래 지속 시간(남은 시간 비율 계산용)
  function buffMax(u, k) {
    const s = (u.def.sk || []).find((x) => (k === 'buff' ? x.k === 'buff' : k === 'taunt' ? x.k === 'taunt' : x.k === 'shield'));
    return s ? s.dur : 0;
  }
  // 발밑 원판은 색·굵기별로 한 번 그려 두고 찍는다(유닛마다 매 프레임 타원을 채우고 테두리를 긋던 것)
  const DISC = {};
  function discSprite(col, thick) {
    const key = col + (thick ? 't' : '');
    if (DISC[key]) return DISC[key];
    const cv = document.createElement('canvas'); cv.width = 100; cv.height = 48;
    const x = cv.getContext('2d');
    x.fillStyle = col; x.globalAlpha = 0.72; x.beginPath(); x.ellipse(50, 24, 46, 20.3, 0, 0, 7); x.fill();
    x.globalAlpha = 1; x.strokeStyle = 'rgba(20,12,6,.75)'; x.lineWidth = thick ? 3.8 : 1.9; x.stroke();
    return (DISC[key] = cv);
  }
  function piece(c, x, y, r, d, t, ownerAI, opt) {
    const tier = d.tier, col = tierColor(tier), seed = (x * 7 + y * 13) % 6.28;
    opt = opt || {};
    // 등급 후광: 6성부터. 등급이 오를 때마다 한 단계씩 더해진다.
    // 6성 은은한 빛 → 7성 발밑 회전 고리 → 전설 회전 호와 오르는 불티 → 신화 바닥 법진과 궤도 구슬 → 불멸 빛기둥과 이중 고리
    // 후광 유닛이 많아질수록(판 후반) 유닛마다 덧그리는 빛을 줄인다: 지난 프레임에 그린 후광 수로 단계를 정한다
    let lod = 2;
    if (tier >= 6) { S.auraN = (S.auraN || 0) + 1; const n = S.auraPrev || 0; lod = n <= (Q.coarse ? 4 : 10) ? 2 : n <= (Q.coarse ? 10 : 22) ? 1 : 0; }
    const kAura = tier >= 6 && window.RTD_SKFX && window.RTD_SKFX.tierAura(c, x, y, r, tier, col, t, seed, Q.level === 'low', lod);
    if (tier >= 6 && !kAura) {
      const pulse = 1 + Math.sin(t * 3 + seed) * 0.1, big = tier >= 9 ? 2.5 : tier >= 8 ? 2.1 : tier >= 7 ? 1.9 : 1.6;
      const a0 = tier >= 8 ? 'aa' : '88', R = r * big * pulse;
      c.drawImage(glowSprite('a' + col + a0, [[0, col + a0], [0.5 / big, col + a0], [1, col + '00']]), x - R, y - R, R * 2, R * 2);
    }
    // 후광 그림(Kenney·법진)을 받기 전에는 은은한 빛과 생성 법진 그림만 깐다(도형 고리·호·점은 그리지 않는다)
    if (tier >= 9 && !kAura) Art.fxImg(c, 'magic', x, y + r * 0.72, r * 3.4, t * 0.8, 0.55, 0.42);
    const pb = opt.pose && opt.pose.born >= 0 ? opt.pose : null;
    if (pb) birthFx(c, x, y, r, tier, col, pb.born, false);
    // 발밑 원판: 등급 색으로 멀리서도 구별된다
    { const sp = discSprite(col, tier >= 6), k = (r * 0.95) / 46; c.drawImage(sp, x - 50 * k, y + r * 0.72 - 24 * k, 100 * k, 48 * k); }
    const p = opt.pose || { x: 0, y: 0 };
    if (p.cast) Art.fxImg(c, 'magic', x, y + r * 0.7, r * 2.6 * (0.7 + p.cast * 0.4), t * 2, p.cast, 0.45);
    // 조각 애니메이션이 있는 장수는 조각으로 그린다(동작 상태는 보스전이 넘겨 주고, 라인에서는 옆모습일 때만 걷기·대기 + 기존 자세 흔들림)
    const RG = window.RTD_RIG;
    // 화질 '낮음'에서는 라인의 조각 그리기를 끈다(유닛이 많을 때 느려지는 기기 보호. 보스전은 그대로)
    if (RG && (opt.rig || (p.v === 2 && Q.level !== 'low')) && RG.has(d.id)) {
      const st = opt.rig || { state: p.frame ? 'walk' : 'idle', t };
      c.save(); c.translate(x + (opt.rig ? 0 : p.x), y + (opt.rig ? 0 : p.y)); if (!opt.rig && p.rot) c.rotate(p.rot);
      RG.draw(c, d.id, 0, 0, r * 3.7 * (p.bornS || 1), p.flip, st); c.restore();
    } else Art.drawSprite(c, Art.unitSprite(d, p.v, p.frame), x + p.x, y + p.y + Math.sin(t * 3 + x) * 0.6, r * 3.7 * (p.bornS || 1), p.flip, p.rot, p.sy);
    if (pb) birthFx(c, x, y, r, tier, col, pb.born, true);
    if (ownerAI) { c.fillStyle = '#7fd4ff'; c.fillRect(x - r, y - r * 1.5, r * 2, 2.5); }
  }
  function bar(c, x, y, w, h, f, col) {
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - w / 2, y, w, h);
    c.fillStyle = col; c.fillRect(x - w / 2, y, w * Math.max(0, f), h);
  }
