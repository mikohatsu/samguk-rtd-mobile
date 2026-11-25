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
    const SK = window.RTD_SKFX;
    list.forEach(([k, left, max], i) => {
      const L = BUFF_LOOK[k], rx = 48 + i * 12, ry = rx * 0.45, cy = u.y + 24, frac = Math.max(0, Math.min(1, left / (max || left)));
      if (!SK) return;
      // 바닥 장판: Kenney 빛 그림(물들임)을 눕혀 은은하게 맥동
      SK.spr(c, 'light_02', L.c, u.x, cy, rx * 2.3, rx * 2.3, t * 0.5 + i, 0.55 + Math.sin(t * 6 + i) * 0.15, true, 0.45);
      // 남은 시간: 고리 그림을 남은 비율만큼만 보이게 잘라 그린다(선으로 호를 긋지 않는다)
      c.save();
      c.beginPath(); c.moveTo(u.x, cy); c.ellipse(u.x, cy, rx * 1.3, ry * 1.3, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.closePath(); c.clip();
      ringSpr(c, 'circle_02', L.c, u.x, cy, rx, 0, 0.95, true, 0.45);
      c.restore();
      // 도는 빛 구슬 3개(작은 빛 그림)
      for (let j = 0; j < 3; j++) { const a = t * 2.5 + (j * Math.PI * 2) / 3 + i; SK.spr(c, 'circle_05', '#ffffff', u.x + Math.cos(a) * rx, cy + Math.sin(a) * ry, 16, 16, 0, 0.9); }
      // 방패: 몸을 감싸는 빛 막(고리 그림)
      if (k === 'shield') ringSpr(c, 'circle_03', L.c, u.x, u.y - 10, 40, t, 0.45 + Math.sin(t * 4) * 0.1);
    });
    // 머리 위에 걸린 버프 이름: 어두운 금속 판 그림(gfx/ui_tab) 위에. 휴대폰에서는 키운다.
    if (list.length) {
      const us = uiS(), plate = Art.pic('ui_tab');
      c.save(); c.translate(u.x, u.y - 84); c.scale(us, us);
      c.font = '700 13px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      list.forEach(([k, left], i) => {
        const L = BUFF_LOOK[k], y = -i * 18, txt = `${L.n} ${Math.ceil(left)}s`, w = Math.max(68, c.measureText(txt).width + 14);
        if (plate) Art.nine(c, plate, -w / 2, y - 13, w, 17, 12, 4); else { c.fillStyle = 'rgba(16,10,6,.7)'; c.fillRect(-w / 2, y - 12, w, 15); }
        c.fillStyle = L.c; c.fillText(txt, 0, y);
      });
      c.restore();
    }
  }
  // ---- 몸 위 버프 덧씌움(2026-11-26 사용자 요청 「버프가 걸려 있으면 머리에만 뜨지 말고 몸에도 방패가 반투명하게」) ----
  // 장수 그림 다음에 그린다(07-arena). 종류마다 모양이 다르다:
  //   피해 감소(진영 사수·엄호·반사 중 도발) = 몸 앞 반투명 빛 방패(vs_guard를 버프 색으로, 없으면 vs_shield 원본) / 보호(무적) = 몸을 감싼 빛 막 /
  //   방진(장판 막기) = 몸 둘레에 도는 법진 막 / 반사 = 몸 둘레 바깥으로 솟는 가시 / 공격력 = 어깨 위로 솟는 불꽃 / 공격 속도 = 뒤로 흐르는 바람 줄 /
  //   인연 보호막(syShd) = 옅은 금빛 막. 끝나기 0.4초 전부터 옅어진다. 맞은 순간(hurt)에는 방패·막이 밝게 번쩍여 '막았다'가 보인다.
  // 그림 몇 장만(드로우 2~4개/버프), 화질 낮음에서는 장식(반짝임·불꽃)을 뺀다. 머리 위 글자판·발밑 장판(drawBuffs)은 그대로.
  function drawBuffOver(c, u, t) {
    const SK = window.RTD_SKFX;
    if (!SK || u.dead) return;
    const lo = Q.level === 'low', hit = Math.max(0, (u.hurt || 0) / 0.2), fa = (left) => Math.min(1, left / 0.4), bx = u.x, by = u.y - 18;
    if (u.shieldT > 0) { // 보호: 빛 막
      const a = fa(u.shieldT), L = BUFF_LOOK.shield.c, R = 124;
      SK.spr(c, 'circle_05', L, bx, by, R, R, 0, a * (0.32 + hit * 0.3));
      SK.spr(c, 'circle_03', L, bx, by, R, R, t * 0.7, a * (0.85 + Math.sin(t * 5) * 0.1 + hit * 0.4));
      if (!lo) { const ag = t * 2.4; SK.spr(c, 'star_04', '#ffffff', bx + Math.cos(ag) * R * 0.46, by + Math.sin(ag) * R * 0.46, 26, 26, 0, a * 0.8); }
    }
    if (u.pshT > 0) { // 방진: 몸 둘레를 도는 법진 막(빛 막과 구별되게 무늬가 보인다)
      const a = fa(u.pshT), L = BUFF_LOOK.psh.c;
      SK.spr(c, 'magic_02', '#9fd0ff', bx, by + 4, 136, 136, t * 0.9, a * (0.75 + hit * 0.3));
      if (!lo) SK.spr(c, 'circle_03', L, bx, by + 4, 128, 128, 0, a * 0.5);
      if (!lo && SK.guard) SK.guard(c, '#9fd0ff', bx, by + 2, 70, a * (0.3 + hit * 0.4), 0); // 방진: 법진 가운데 옅은 빛 방패 문양
    }
    if (u.syShd > 0) SK.spr(c, 'circle_03', '#ffe9a6', bx, by, 116, 116, -t * 0.5, 0.5 + hit * 0.3); // 인연 보호막
    if (u.reflT > 0) { // 반사: 가시
      const a = fa(u.reflT), n = lo ? 4 : 6;
      for (let i = 0; i < n; i++) { const ag = i * (6.283 / n) + t * 0.6, d = 50 + Math.sin(t * 6 + i) * 4, h = 62 + hit * 30; const px = bx + Math.cos(ag) * d, py = by + Math.sin(ag) * d * 0.8;
        if (!(SK.spike && SK.spike(c, '#ff7050', px, py, 18, h * 1.1, ag + Math.PI / 2, a * (0.85 + hit * 0.15)))) { SK.spr(c, 'muzzle_01', '#ff7050', px, py, 30, h, ag + Math.PI / 2, a); SK.spr(c, 'muzzle_01', '#ffe0c0', px, py, 14, h * 0.7, ag + Math.PI / 2, a * (0.6 + hit * 0.4)); } }
    }
    if (u.tauntT > 0 || u.coverT > 0) { // 피해 감소: 몸 앞 반투명 방패
      const left = Math.max(u.tauntT || 0, u.coverT || 0), a = fa(left), L = (u.tauntT > 0 ? BUFF_LOOK.taunt : BUFF_LOOK.cover).c;
      const sx = bx + 10, sy = by + 16 + Math.sin(t * 3) * 2, S = 84;
      // 빛 방패(vs_guard)를 버프 색으로 물들여 반투명하게. 없으면 나무 방패 원본
      if (!(SK.guard && SK.guard(c, L, sx, sy - 4, S * 1.1, a * (0.6 + hit * 0.4), 0.4))) {
        SK.spr(c, 'vs_shield', L, sx, sy, S * 1.2, S * 1.18, 0, a * (0.5 + hit * 0.5));
        SK.spr(c, 'vs_shield', null, sx, sy, S, S * 0.98, 0, a * (0.58 + hit * 0.35), false);
      }
    }
    if (!lo && ((u.buffT > 0 && u.buff > 0) || u.pbuffT > 0)) { // 공격력: 어깨 위로 솟는 불꽃
      const L = (u.buffT > 0 && u.buff > 0 ? BUFF_LOOK.buff : BUFF_LOOK.rally).c;
      for (let i = 0; i < 2; i++) { const k = (t * 1.4 + i * 0.5) % 1; SK.spr(c, 'muzzle_04', L, bx + (i ? 22 : -22), by - 20 - k * 34, 22, 46, 0, Math.sin(k * Math.PI) * 0.6); }
    }
    if (!lo && u.hasteT > 0) { // 공격 속도: 뒤로 흐르는 바람 줄
      for (let i = 0; i < 2; i++) { const k = (t * 1.8 + i * 0.5) % 1; SK.spr(c, 'trace_03', BUFF_LOOK.haste.c, bx + (i ? 26 : -26), by + 10 - k * 50, 10, 56, 0, Math.sin(k * Math.PI) * 0.55); }
    }
  }
  // 그 버프를 건 스킬의 원래 지속 시간(남은 시간 비율 계산용)
  function buffMax(u, k) {
    const s = (u.def.sk || []).find((x) => (k === 'buff' ? x.k === 'buff' : k === 'taunt' ? x.k === 'taunt' : x.k === 'shield'));
    return s ? s.dur : 0;
  }
  // 발밑 원판은 색·굵기별로 한 번 그려 두고 찍는다(유닛마다 매 프레임 타원을 채우고 테두리를 긋던 것). 겹쳐 선 유닛이 한 명씩 구분되게 진하게 칠한다.
  const DISC = {};
  function discSprite(col, thick) {
    const key = col + (thick ? 't' : '');
    if (DISC[key]) return DISC[key];
    const cv = document.createElement('canvas'); cv.width = 100; cv.height = 48;
    const x = cv.getContext('2d');
    x.fillStyle = col; x.globalAlpha = 0.86; x.beginPath(); x.ellipse(50, 24, 45, 20, 0, 0, 7); x.fill();
    x.globalAlpha = 1; x.strokeStyle = 'rgba(14,8,4,.9)'; x.lineWidth = thick ? 4 : 2.8; x.stroke();
    return (DISC[key] = cv);
  }
  // ---- 그림을 발밑 원판 가운데에 세우기(2026-11-25 실기 소감 「원판 위 유닛이 정중앙이 아니다」) ----
  // 그림 칸(152)의 발끝 기준선(134)이 원판 가운데(y + r·0.72)보다 r·0.32 아래라 유닛이 원판 앞 가장자리에 서 있었고,
  // 그림마다 무기·자세가 달라 몸(다리) 가운데가 칸 가운데에서 좌우로 최대 r·0.4 비켜 있었다.
  // 그림 한 장마다 한 번 불투명 화소를 재서(아래 끝 줄, 키의 55~95% 높이 띠의 가로 무게중심 = 다리·옷자락) 그만큼 그림을 옮겨 그린다.
  // 원판·선택 문양·버프 장판·사거리는 그대로(위치 판정과 같은 자리). 조각 애니메이션(rig)은 같은 그림에서 잘라 만들어 옆·앞 그림의 값을 쓴다.
  const FOOT = new WeakMap(), FOOT_Y = 0.8, FOOT_DX_MAX = 0.1; // 발끝 = 원판 가운데보다 r·0.08 아래(발바닥 두께), 가로 보정은 그림 폭의 10%까지
  let footCv = null;
  function footOf(im) {
    if (!im || !im.width) return null;
    let f = FOOT.get(im);
    if (f !== undefined) return f;
    f = null;
    try {
      const w = im.width, h = im.height;
      if (!footCv) footCv = document.createElement('canvas');
      if (footCv.width < w || footCv.height < h) { footCv.width = Math.max(w, footCv.width); footCv.height = Math.max(h, footCv.height); }
      const x = footCv.getContext('2d', { willReadFrequently: true });
      x.clearRect(0, 0, footCv.width, footCv.height); x.drawImage(im, 0, 0);
      const px = x.getImageData(0, 0, w, h).data;
      let y0 = -1, y1 = -1;
      for (let y = 0; y < h && y0 < 0; y++) for (let i = 0; i < w; i++) if (px[(y * w + i) * 4 + 3] > 100) { y0 = y; break; }
      for (let y = h - 1; y >= 0 && y1 < 0; y--) for (let i = 0; i < w; i++) if (px[(y * w + i) * 4 + 3] > 100) { y1 = y; break; }
      if (y0 >= 0 && y1 > y0) {
        let sx = 0, n = 0;
        for (let y = Math.floor(y0 + (y1 - y0) * 0.55); y <= y0 + (y1 - y0) * 0.95; y++) for (let i = 0; i < w; i++) if (px[(y * w + i) * 4 + 3] > 100) { sx += i; n++; }
        const dx = n ? (sx / n + 0.5) / w - 0.5 : 0;
        f = { dx: Math.max(-FOOT_DX_MAX, Math.min(FOOT_DX_MAX, dx)), by: (y1 + 1) / h };
      }
    } catch (e) { f = null; } // 읽을 수 없는 그림이면 보정 없이
    FOOT.set(im, f);
    return f;
  }
  // 그림(크기 S, 칸 기준 drawSprite·rig 배치)을 옮길 양: 발끝을 y + r·FOOT_Y에, 다리 가운데를 x에
  function footShift(im, r, S, flip) {
    const f = footOf(im);
    if (!f) return { x: 0, y: 0 };
    return { x: -f.dx * S * (flip ? -1 : 1), y: r * FOOT_Y - (f.by - 0.6) * S };
  }
  // ---- 유닛 발밑 등급 별(2026-11-25 실기 소감 「1성이면 1개, 7성이면 7개」) ----
  // 등급(1~10)만큼 별 그림(gfx/pic_star, CC0)을 등급색으로 물들여 원판 아래에 늘어놓는다. 한 줄에 5개까지, 6성부터 두 줄(위 5 + 아래 나머지)이라 세기 쉽다.
  // 검게 물들인 같은 별을 살짝 크게 깔아 밝은 땅에서도 보이게. 등급별로 한 장을 미리 만들어 두고 유닛마다 drawImage 한 번만 한다.
  const TSTAR = {}, TS_PX = 32, TS_ROW = 5;
  function tierStarSprite(tier) {
    if (TSTAR[tier]) return TSTAR[tier];
    const im = Art.picTint('pic_star', tierColor(tier)), sh = Art.picTint('pic_star', '#140c06');
    if (!im || !sh) return null; // 그림을 아직 못 받았다
    const n1 = Math.min(TS_ROW, tier), n2 = tier - n1, step = TS_PX * 0.92, rowH = TS_PX * 0.84, pad = 3;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(TS_PX + (n1 - 1) * step + pad * 2); cv.height = Math.ceil(TS_PX + (n2 ? rowH : 0) + pad * 2);
    const x = cv.getContext('2d');
    const row = (n, y) => { const x0 = (cv.width - (TS_PX + (n - 1) * step)) / 2; for (let i = 0; i < n; i++) { const cx = x0 + i * step; x.globalAlpha = 0.9; x.drawImage(sh, cx - 2, y - 1, TS_PX + 4, TS_PX + 4); x.globalAlpha = 1; x.drawImage(im, cx, y, TS_PX, TS_PX); } };
    row(n1, pad); if (n2) row(n2, pad + rowH);
    return (TSTAR[tier] = cv);
  }
  // y = 별 묶음의 위 끝, size = 별 하나의 크기(전장 단위)
  function tierStars(c, x, y, tier, size) {
    if (!(tier >= 1)) return;
    const sp = tierStarSprite(Math.min(10, tier));
    if (!sp) return;
    const k = size / TS_PX;
    c.drawImage(sp, x - (sp.width * k) / 2, y, sp.width * k, sp.height * k);
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
    if (ownerAI) allyMark(c, x, y, r);
    // 발밑 원판: 등급 색으로 멀리서도 구별된다
    { const sp = discSprite(col, tier >= 6), k = (r * 0.95) / 46; c.drawImage(sp, x - 50 * k, y + r * 0.72 - 24 * k, 100 * k, 48 * k); }
    const p = opt.pose || { x: 0, y: 0 };
    if (p.cast) Art.fxImg(c, 'magic', x, y + r * 0.7, r * 2.6 * (0.7 + p.cast * 0.4), t * 2, p.cast, 0.45);
    // 조각 애니메이션이 있는 장수는 조각으로 그린다(동작 상태는 보스전이 넘겨 주고, 라인에서는 옆모습일 때만 걷기·대기 + 기존 자세 흔들림)
    const RG = window.RTD_RIG;
    // 화질 '낮음'에서는 라인의 조각 그리기를 끈다(유닛이 많을 때 느려지는 기기 보호. 보스전은 그대로)
    const SZ = r * 3.7 * (p.bornS || 1);
    if (RG && (opt.rig || (p.v === 2 && Q.level !== 'low')) && RG.has(d.id)) {
      const st = opt.rig || { state: p.frame ? 'walk' : 'idle', t }, fs = footShift(Art.unitSprite(d, st.view === 'f' ? 0 : 2, 0), r, SZ, p.flip);
      c.save(); c.translate(x + fs.x + (opt.rig ? 0 : p.x), y + fs.y + (opt.rig ? 0 : p.y)); if (!opt.rig && p.rot) c.rotate(p.rot);
      RG.draw(c, d.id, 0, 0, SZ, p.flip, st); c.restore();
    } else {
      const im = Art.unitSprite(d, p.v, p.frame), fs = footShift(im, r, SZ, p.flip);
      Art.drawSprite(c, im, x + fs.x + p.x, y + fs.y + p.y + Math.sin(t * 3 + x) * 0.6, SZ, p.flip, p.rot, p.sy);
    }
    if (pb) birthFx(c, x, y, r, tier, col, pb.born, true);
  }
  // Kenney 고리 그림에서 고리가 지나는 반지름(그림 폭의 절반에 대한 비율). 고리를 반지름 R에 맞춰 그릴 때 쓴다.
  const RING_R = { circle_01: 0.68, circle_02: 0.58, circle_03: 0.73, light_02: 0.63 };
  function ringSpr(c, n, col, x, y, R, rot, a, add, sy) {
    const SK = window.RTD_SKFX, s = (2 * R) / (RING_R[n] || 1);
    return SK ? SK.spr(c, n, col, x, y, s, s, rot || 0, a, add, sy) : false;
  }
  // 두 점 사이에 빛줄기 그림(Kenney trace_06)을 늘여 깐다. thick·len은 눈에 보이는 굵기·길이(그림의 빈 여백을 셈에 넣었다).
  function streak(c, col, x0, y0, x1, y1, thick, a) {
    const SK = window.RTD_SKFX, L = Math.hypot(x1 - x0, y1 - y0);
    if (!SK || L < 1) return false;
    return SK.spr(c, 'trace_06', col, (x0 + x1) / 2, (y0 + y1) / 2, thick / 0.15, L / 0.54, Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2, a);
  }
  // AI·동료 장수 표시: 머리 위 선 대신 발밑에 하늘색 빛 고리(그림)를 깐다(piece 안에서 원판보다 먼저).
  function allyMark(c, x, y, r) {
    ringSpr(c, 'circle_02', '#7fd4ff', x, y + r * 0.72, r * 1.05, 0, 0.85, true, 0.42);
  }
  // 고른 유닛 발밑 표시(gfx/ui_select, 위에서 본 금색 원 문양). 살짝 맥동한다. 그림이 없으면 초록 법진 그림.
  function selMark(c, x, y, r, t, col) {
    const im = Art.pic('ui_select'), us = uiS(), s = r * 3.2 * (0.85 + 0.15 * us) * (1 + Math.sin(t * 5) * 0.05);
    if (im) {
      c.save(); c.globalAlpha = 0.95; c.translate(x, y); c.scale(1, 0.42); c.rotate(t * 0.25);
      c.drawImage(im, -s / 2, -s / 2, s, s); c.restore();
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45 + Math.sin(t * 5) * 0.2; c.translate(x, y); c.scale(1, 0.42); c.rotate(t * 0.25); c.drawImage(im, -s / 2, -s / 2, s, s); c.restore();
      return;
    }
    Art.fxPic(c, 'mc_rune2', x, y, s, s, t * 0.6, 0.9, { col: col || '#7dff8e', sy: 0.45 });
  }
  // 사거리: 선 대신 옅게 빛나는 원판 그림(Kenney circle_01)
  function rangeMark(c, x, y, R, col, a) {
    ringSpr(c, 'circle_01', col, x, y, R, 0, a);
  }
  // 그림자: 부드러운 점 그림을 검게 물들여 눕힌다(적·떨어진 물건 발밑)
  function blobShadow(c, x, y, w, a) {
    const SK = window.RTD_SKFX;
    if (SK) SK.spr(c, 'circle_05', '#000000', x, y, w * 1.5, w * 1.5, 0, a, false, 0.36);
  }
  // 적 병사: 발밑 그림자와 몸 그림을 그림·크기별로 한 장에 합쳐 두고 한 번에 찍는다(blobShadow + drawSprite와 같은 모양, 그리기 호출 절반).
  // 맞아서 기우는 순간과 정예(사이에 후광을 그린다)는 부른 쪽이 따로 그린다. 그림자 알파 0.5, 그림자 폭 = 크기×0.7×1.5, 높이는 그 0.36배.
  const SHADOWED = new WeakMap();
  function soldierShadowed(img, sz, dy) {
    let m = SHADOWED.get(img); if (!m) SHADOWED.set(img, (m = {}));
    const key = sz + ',' + dy; if (m[key]) return m[key];
    const SK = window.RTD_SKFX, sh = SK && SK.tint ? SK.tint('circle_05', '#000000') : null;
    if (!sh || !img.width) return null;
    const r = img.width / sz, s = sz * 1.05, hx = Math.max(sz / 2, s / 2), y0 = -0.6 * sz, y1 = Math.max(0.4 * sz, dy + s * 0.18);
    const ox = 1 + hx * r, oy = 1 - y0 * r, cv = document.createElement('canvas');
    cv.width = Math.ceil(hx * 2 * r) + 2; cv.height = Math.ceil((y1 - y0) * r) + 2;
    const x = cv.getContext('2d');
    x.setTransform(r, 0, 0, r, ox, oy);
    x.globalAlpha = 0.5; x.drawImage(sh, -s / 2, dy - s * 0.18, s, s * 0.36);
    x.globalAlpha = 1; x.drawImage(img, -sz / 2, -0.6 * sz, sz, sz);
    return (m[key] = { cv, ox: ox / r, oy: oy / r, w: cv.width / r, h: cv.height / r });
  }
  function drawShadowed(c, o, x, y, flip) {
    if (!flip) { c.drawImage(o.cv, x - o.ox, y - o.oy, o.w, o.h); return; }
    c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(o.cv, -o.ox, -o.oy, o.w, o.h); c.restore();
  }
  // 체력·게이지 막대: 틀은 어두운 금속 판 그림(gfx/ui_tab, 9조각으로 늘임), 채움만 사각형. 그림이 없으면 예전 막대.
  // 틀(9조각)과 어두운 바탕은 크기·화면 배율별로 한 번 그려 두고 한 장으로 찍는다.
  // 적 60명이면 매 프레임 틀 조각만 540번 그리던 것(라인 전체 그리기 호출의 2/3)이 60번이 된다. 모양은 같다.
  const BARC = new Map();
  function barFrame(fr, w, h, p, k) {
    const key = ((w * 64) | 0) + ',' + ((h * 64) | 0) + ',' + k;
    let cv = BARC.get(key);
    if (cv) return cv;
    if (BARC.size > 48) { BARC.forEach((v) => { v.width = v.height = 0; }); BARC.clear(); }
    const fw = w + p * 2, fh = h + p * 2;
    cv = document.createElement('canvas'); cv.width = Math.ceil(fw * k) + 2; cv.height = Math.ceil(fh * k) + 2;
    const x = cv.getContext('2d');
    x.setTransform(k, 0, 0, k, 1, 1);
    Art.nine(x, fr, 0, 0, fw, fh, 12, Math.max(2, p * 1.4));
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(p, p, w, h);
    BARC.set(key, cv);
    return cv;
  }
  function bar(c, x, y, w, h, f, col) {
    const fr = Art.pic('ui_tab');
    if (fr) {
      const p = Math.max(1.5, h * 0.4), m = c.getTransform(), k = Math.max(0.25, Math.round(Math.hypot(m.a, m.b) * 100) / 100);
      const cv = barFrame(fr, w, h, p, k);
      c.drawImage(cv, x - w / 2 - p - 1 / k, y - p - 1 / k, cv.width / k, cv.height / k);
      // 채움(색 + 위쪽 40% 밝은 줄)도 색·높이별 한 장을 가로로 늘여 찍는다(사각형 두 번 → 그림 한 번)
      const fw = w * Math.max(0, Math.min(1, f));
      if (fw > 0) { const st = barFill(col, h, k); c.drawImage(st, x - w / 2, y, fw, h); }
      return;
    }
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - w / 2, y, w, h);
    c.fillStyle = col; c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, f)), h);
    // 위쪽 절반을 밝게 한 줄 덮어 납작한 띠가 아니라 둥근 막대처럼 보이게
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, f)), h * 0.4);
  }
  const BARF = new Map();
  function barFill(col, h, k) {
    const key = col + ',' + ((h * 64) | 0) + ',' + k;
    let cv = BARF.get(key);
    if (cv) return cv;
    if (BARF.size > 48) { BARF.forEach((v) => { v.width = v.height = 0; }); BARF.clear(); }
    cv = document.createElement('canvas'); cv.width = 4; cv.height = Math.max(1, Math.round(h * k));
    const x = cv.getContext('2d'), sy = cv.height / h;
    x.setTransform(1, 0, 0, sy, 0, 0);
    x.fillStyle = col; x.fillRect(0, 0, 4, h);
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 0, 4, h * 0.4);
    BARF.set(key, cv);
    return cv;
  }
