  function poseOf(u, t, r) {
    const f = u.face == null ? Math.PI / 2 : u.face, dir = Art.facing(f), p = { flip: !!dir.flip, v: dir.v, frame: 0, x: 0, y: 0, rot: 0, sy: 1 };
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
    if (tier >= 7 && !kAura) {
      // 발밑에서 도는 점선 고리
      c.save(); c.strokeStyle = col; c.lineWidth = 2; c.globalAlpha = 0.8; c.setLineDash([6, 6]); c.lineDashOffset = -t * 30;
      c.beginPath(); c.ellipse(x, y + r * 0.72, r * 1.35, r * 0.6, 0, 0, 7); c.stroke(); c.restore();
    }
    if (tier >= 9 && !kAura) Art.fxImg(c, 'magic', x, y + r * 0.72, r * 3.4, t * 0.8, 0.55, 0.42);
    if (tier >= 8 && !kAura) {
      c.strokeStyle = col; c.lineWidth = tier >= 9 ? 3 : 2;
      const n = tier >= 9 ? 3 : 2;
      for (let i = 0; i < n; i++) { const a = t * 2.2 + (i * Math.PI * 2) / n; c.beginPath(); c.arc(x, y, r * 1.5, a, a + 1); c.stroke(); }
      // 위로 떠오르는 불티(낮음 화질은 생략)
      c.fillStyle = col;
      for (let i = 0; i < (Q.level === 'low' ? 0 : tier >= 10 ? 7 : 4); i++) {
        const k = ((t * 0.6 + i / 4 + seed) % 1), px = x + Math.sin(i * 2.3 + seed) * r * 0.9;
        c.globalAlpha = 1 - k; c.beginPath(); c.arc(px, y + r * 0.6 - k * r * 2.4, 2.2 + (1 - k) * 1.5, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    }
    if (tier >= 9 && !kAura && Q.level !== 'low') for (let i = 0; i < (tier >= 10 ? 8 : 5); i++) {
      // 궤도를 도는 빛 구슬
      const a = -t * 1.6 + (i * Math.PI * 2) / (tier >= 10 ? 8 : 5), rr = r * (1.85 + Math.sin(t * 2 + i) * 0.2);
      c.fillStyle = i % 2 ? '#ffffff' : col; c.beginPath(); c.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, 3, 0, 7); c.fill();
    }
    if (tier >= 10 && !kAura) {
      // 불멸: 솟는 빛기둥과 바깥 이중 고리
      c.globalAlpha = 0.55 + Math.sin(t * 4 + seed) * 0.2; c.drawImage(pillarSprite(col), x - r * 0.7, y - r * 3.2, r * 1.4, r * 4.2); c.globalAlpha = 1;
      c.save(); c.strokeStyle = '#fff0c8'; c.lineWidth = 1.5; c.globalAlpha = 0.7; c.setLineDash([3, 9]); c.lineDashOffset = t * 40;
      c.beginPath(); c.ellipse(x, y + r * 0.72, r * 1.7, r * 0.78, 0, 0, 7); c.stroke(); c.restore();
    }
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
      RG.draw(c, d.id, 0, 0, r * 3.7, p.flip, st); c.restore();
    } else Art.drawSprite(c, Art.unitSprite(d, p.v, p.frame), x + p.x, y + p.y + Math.sin(t * 3 + x) * 0.6, r * 3.7, p.flip, p.rot, p.sy);
    if (ownerAI) { c.fillStyle = '#7fd4ff'; c.fillRect(x - r, y - r * 1.5, r * 2, 2.5); }
  }
  function bar(c, x, y, w, h, f, col) {
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - w / 2, y, w, h);
    c.fillStyle = col; c.fillRect(x - w / 2, y, w * Math.max(0, f), h);
  }
