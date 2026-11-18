// SD 캐릭터와 무기별 평타 이펙트. 외형 데이터는 테마의 looks에 있고, 여기는 그리는 방법만 안다.
(function (root) {
  const T = root.RTD_THEME;
  const SKIN = { n: '#f6d3b0', r: '#c8452e', k: '#7a5236', p: '#fbe2cc', w: '#e8d8c8' };
  const cache = {};

  function round(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function line(c, a, b, x, y, col, wd) { c.strokeStyle = col; c.lineWidth = wd; c.lineCap = 'round'; c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); }

  function weapon(c, w) {
    const steel = '#dfe6ee', wood = '#7a4f28', gold = '#e8c15a';
    if (w === 'bow' || w === 'crossbow') {
      c.strokeStyle = wood; c.lineWidth = 2.4; c.beginPath(); c.arc(32, 32, 13, -1.25, 1.25); c.stroke();
      line(c, 36.5, 19.8, 36.5, 44.2, '#eee', 0.8);
      if (w === 'crossbow') line(c, 28, 32, 46, 32, wood, 2.6);
    } else if (w === 'sword' || w === 'twin') {
      line(c, 38, 34, 45, 12, steel, 2.8); line(c, 35, 32, 41, 35, gold, 2.2);
      if (w === 'twin') { line(c, 10, 34, 3, 12, steel, 2.8); line(c, 13, 32, 7, 35, gold, 2.2); }
    } else if (w === 'spear' || w === 'lance' || w === 'serpent') {
      line(c, 40, 50, 43, 6, wood, 2.2);
      if (w === 'serpent') { c.strokeStyle = steel; c.lineWidth = 2.6; c.beginPath(); c.moveTo(43, 12); c.quadraticCurveTo(47, 8, 43, 5); c.quadraticCurveTo(39, 2, 44, -1); c.stroke(); }
      else { c.fillStyle = steel; c.beginPath(); c.moveTo(43, 0); c.lineTo(46, 9); c.lineTo(40, 9); c.fill(); }
      if (w === 'lance') { c.fillStyle = '#c33'; c.fillRect(40, 9, 7, 3); }
    } else if (w === 'halberd') {
      line(c, 40, 50, 43, 4, wood, 2.4); c.fillStyle = steel;
      c.beginPath(); c.moveTo(43, 0); c.lineTo(46, 8); c.lineTo(40, 8); c.fill();
      c.beginPath(); c.arc(43, 13, 7, -1.5, 1.5); c.fill(); c.beginPath(); c.arc(43, 13, 7, 1.6, 4.7); c.fill();
    } else if (w === 'guandao') {
      line(c, 40, 50, 42, 8, '#2f6b4a', 2.6); c.fillStyle = steel;
      c.beginPath(); c.moveTo(42, 12); c.quadraticCurveTo(52, 6, 46, -2); c.quadraticCurveTo(44, 6, 40, 8); c.fill();
    } else if (w === 'axe' || w === 'mace') {
      line(c, 38, 44, 42, 14, wood, 2.8); c.fillStyle = steel;
      if (w === 'axe') { c.beginPath(); c.moveTo(42, 10); c.quadraticCurveTo(52, 12, 48, 22); c.lineTo(41, 18); c.fill(); }
      else { c.beginPath(); c.arc(42, 12, 6, 0, 7); c.fill(); }
    } else if (w === 'shield') {
      c.fillStyle = '#8a5a2c'; round(c, 30, 24, 16, 22, 5); c.fill(); c.strokeStyle = gold; c.lineWidth = 1.6; c.stroke();
      c.fillStyle = gold; c.beginPath(); c.arc(38, 35, 3, 0, 7); c.fill();
    } else if (w === 'fan') {
      c.fillStyle = '#f7f3e8'; c.beginPath(); c.moveTo(38, 36); c.arc(38, 36, 15, -1.9, -0.5); c.closePath(); c.fill();
      c.strokeStyle = '#b9a98a'; c.lineWidth = 0.8; c.stroke();
    } else if (w === 'thunder' || w === 'staff') {
      line(c, 39, 50, 41, 8, wood, 2.4); c.fillStyle = w === 'thunder' ? '#f2dd5c' : '#a8d8ff'; c.beginPath(); c.arc(41, 7, 4.5, 0, 7); c.fill();
    } else if (w === 'flame') {
      c.fillStyle = '#ff7a2a'; c.beginPath(); c.arc(40, 30, 6, 0, 7); c.fill(); c.fillStyle = '#ffd86a'; c.beginPath(); c.arc(40, 31, 3, 0, 7); c.fill();
    } else if (w === 'dagger') {
      line(c, 38, 34, 44, 24, steel, 2.4); line(c, 36, 30, 42, 20, steel, 2.4);
    } else if (w === 'scroll') {
      c.fillStyle = '#efe2b5'; round(c, 33, 26, 12, 16, 3); c.fill(); line(c, 33, 26, 45, 26, wood, 2); line(c, 33, 42, 45, 42, wood, 2);
    } else if (w === 'lute') {
      c.fillStyle = '#9a5f2e'; c.beginPath(); c.ellipse(38, 34, 7, 10, 0.4, 0, 7); c.fill(); line(c, 41, 25, 46, 12, '#6b3f1c', 2);
    } else if (w === 'needle') {
      c.fillStyle = '#6d8a4a'; round(c, 33, 30, 13, 13, 3); c.fill(); c.fillStyle = '#fff'; c.fillRect(38, 33, 3, 8); c.fillRect(35.5, 35.5, 8, 3);
    } else if (w === 'ribbon') {
      c.strokeStyle = '#ff9ec4'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(36, 34); c.bezierCurveTo(50, 26, 36, 18, 46, 8); c.stroke();
    }
  }
  function hat(c, h, col, hair) {
    const dark = hair;
    if (h === 'helm' || h === 'feather') {
      c.fillStyle = '#b8c0c8'; c.beginPath(); c.arc(24, 15, 14.6, Math.PI, 0); c.lineTo(38, 18); c.lineTo(10, 18); c.closePath(); c.fill();
      c.fillStyle = col; c.fillRect(9.5, 15, 29, 3.5); c.beginPath(); c.moveTo(24, -2); c.lineTo(27.5, 6); c.lineTo(20.5, 6); c.fill();
      if (h === 'feather') {
        c.strokeStyle = '#c0392b'; c.lineWidth = 2.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(19, 3); c.bezierCurveTo(10, -14, -6, -10, -6, 8); c.stroke();
        c.beginPath(); c.moveTo(29, 3); c.bezierCurveTo(38, -14, 54, -10, 54, 8); c.stroke();
      }
    } else if (h === 'crown') {
      c.fillStyle = dark; c.beginPath(); c.arc(24, 14, 14.4, Math.PI, 0); c.fill();
      c.fillStyle = '#e8c15a'; c.fillRect(14, 0, 20, 7); c.fillStyle = '#1b130c'; c.fillRect(8, -3, 32, 3.4);
      c.fillStyle = '#e8c15a'; for (let i = 0; i < 5; i++) c.fillRect(11 + i * 6, 0, 1.4, 6);
    } else if (h === 'turban') {
      c.fillStyle = '#e8c74a'; c.beginPath(); c.arc(24, 14, 15, Math.PI, 0); c.fill(); c.fillRect(9, 12, 30, 5);
      c.fillStyle = '#c89a2a'; c.fillRect(9, 15, 30, 2);
    } else if (h === 'scholar') {
      c.fillStyle = dark; c.beginPath(); c.arc(24, 14, 14.4, Math.PI, 0); c.fill();
      c.fillStyle = '#23262e'; round(c, 14, -2, 20, 11, 3); c.fill(); c.fillStyle = col; c.fillRect(14, 6, 20, 2.4);
    } else if (h === 'hood') {
      c.fillStyle = '#ddd5c2'; c.beginPath(); c.arc(24, 14, 15.4, Math.PI, 0); c.lineTo(40, 26); c.lineTo(36, 18); c.lineTo(12, 18); c.lineTo(8, 26); c.closePath(); c.fill();
    } else if (h === 'bun') {
      c.fillStyle = dark; c.beginPath(); c.arc(24, 15, 14.8, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(12, 4, 6, 0, 7); c.fill(); c.beginPath(); c.arc(36, 4, 6, 0, 7); c.fill();
      c.fillRect(9, 13, 4, 15); c.fillRect(35, 13, 4, 15);
      c.fillStyle = '#ff9ec4'; c.beginPath(); c.arc(14, 9, 2.6, 0, 7); c.arc(34, 9, 2.6, 0, 7); c.fill();
    } else if (h === 'fur') {
      c.fillStyle = '#6b4a2a'; c.beginPath(); c.arc(24, 14, 15.2, Math.PI, 0); c.fill(); c.fillRect(9, 12, 30, 5);
      c.fillStyle = '#efe2b5'; c.beginPath(); c.moveTo(11, 8); c.lineTo(4, -5); c.lineTo(15, 3); c.fill(); c.beginPath(); c.moveTo(37, 8); c.lineTo(44, -5); c.lineTo(33, 3); c.fill();
    } else if (h === 'guard') {
      c.fillStyle = col; c.beginPath(); c.arc(24, 15, 14.8, Math.PI, 0); c.lineTo(38, 18); c.lineTo(10, 18); c.closePath(); c.fill();
      c.fillStyle = '#e8c15a'; c.fillRect(21.5, 4, 5, 5);
    } else {
      c.fillStyle = dark; c.beginPath(); c.arc(24, 15, 14.8, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(24, 0, 4.6, 0, 7); c.fill(); c.fillStyle = col; c.fillRect(21, 3, 6, 2);
    }
  }
  // 8방향: 정면(0) 앞대각(1) 측면(2) 뒤대각(3) 뒷면(4)을 그리고 왼쪽은 좌우 반전으로 얻는다.
  // frame 0은 서기, 1과 2는 걷는 두 발.
  function draw(c, L, col, dark, frame) {
    const skin = SKIN[L.s] || SKIN.n, hair = L.c || '#2a1c14', v = L.v || 0;
    const fx = [0, 3.5, 7, 0, 0][v], wide = [1, 0.94, 0.8, 0.94, 1][v], back = v >= 3, step = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    if (back) weapon(c, L.w);
    // 다리
    c.fillStyle = '#2b2118';
    if (v === 2) { round(c, 20 + step * 4, 44, 8, 7, 2); c.fill(); round(c, 21 - step * 4, 44, 8, 7, 2); c.fill(); }
    else { round(c, 16, 44 - Math.max(0, -step) * 2, 7, 7, 2); c.fill(); round(c, 25, 44 - Math.max(0, step) * 2, 7, 7, 2); c.fill(); }
    // 몸통
    c.save(); c.translate(24, 0); c.scale(wide, 1); c.translate(-24, 0);
    c.fillStyle = col; c.strokeStyle = dark; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(16, 30); c.lineTo(32, 30); c.lineTo(36, 47); c.lineTo(12, 47); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e8c15a'; c.fillRect(14.6, 37, 18.8, 2.6);
    if (!back) { c.fillStyle = dark; c.beginPath(); c.moveTo(24 + fx * 0.6, 30); c.lineTo(19 + fx * 0.6, 30); c.lineTo(24 + fx * 0.6, 37); c.lineTo(29 + fx * 0.6, 30); c.fill(); }
    else { c.fillStyle = dark; c.globalAlpha = 0.28; c.fillRect(16, 30, 16, 16); c.globalAlpha = 1; }
    c.restore();
    // 팔
    c.fillStyle = col; c.strokeStyle = dark; c.lineWidth = 1.4;
    if (v === 2) { c.beginPath(); c.arc(26 + step * 3, 35, 4.4, 0, 7); c.fill(); c.stroke(); }
    else { c.beginPath(); c.arc(13 + (v === 1 ? 2 : 0), 34 + step, 4.2, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.arc(35, 34 - step, 4.2, 0, 7); c.fill(); c.stroke(); }
    if (!back) { weapon(c, L.w); c.fillStyle = skin; c.beginPath(); c.arc(36, 35, 2.8, 0, 7); c.fill(); }
    // 머리
    c.fillStyle = skin; c.beginPath(); c.arc(24, 18, 14, 0, 7); c.fill();
    c.strokeStyle = 'rgba(40,20,10,.35)'; c.lineWidth = 0.8; c.stroke();
    if (back) {
      c.save(); c.beginPath(); c.arc(24, 18, 14, 0, 7); c.clip();
      c.fillStyle = hair;
      if (v === 4) c.fillRect(8, 2, 32, 32); else { c.beginPath(); c.arc(20, 17, 15.5, 0, 7); c.fill(); }
      c.restore();
    }
    c.save(); c.translate(fx * 0.25 * (back ? 0 : 1), 0); hat(c, L.h, col, hair); c.restore();
    if (back) return;
    // 얼굴: 보는 쪽으로 이목구비가 돈다
    c.save(); c.translate(fx, 0);
    c.fillStyle = '#17110c';
    c.beginPath();
    if (v !== 2) c.ellipse(18.6 + (v === 1 ? 0.8 : 0), 21, v === 1 ? 1.9 : 2.3, 2.9, 0, 0, 7);
    c.ellipse(29.4 - (v === 2 ? 5 : 0), 21, 2.3, 2.9, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(30.2 - (v === 2 ? 5 : 0), 20, 0.9, 0, 7); if (v !== 2) c.arc(19.4, 20, 0.9, 0, 7); c.fill();
    if (v === 2) { c.fillStyle = skin; c.beginPath(); c.arc(31.5, 23, 2, 0, 7); c.fill(); }
    if (L.b !== 'long' && L.b !== 'full') { c.strokeStyle = '#6b3a22'; c.lineWidth = 1; c.beginPath(); c.arc(24 - (v === 2 ? 1 : 0), 26, 2, 0.2, 2.9); c.stroke(); }
    if (L.f) { c.fillStyle = 'rgba(255,120,130,.5)'; c.beginPath(); if (v !== 2) c.arc(15, 26, 2.4, 0, 7); c.arc(33 - (v === 2 ? 7 : 0), 26, 2.4, 0, 7); c.fill(); }
    else { if (v !== 2) line(c, 15.5, 16.4, 21, 17.2, hair, 1.5); line(c, 32.5 - (v === 2 ? 5 : 0), 16.4, 27 - (v === 2 ? 5 : 0), 17.2, hair, 1.5); }
    const bc = L.b === 'white' ? '#e8e4da' : hair;
    if (L.b === 'long' || L.b === 'white') { c.fillStyle = bc; c.beginPath(); c.moveTo(16, 27); c.quadraticCurveTo(24, 31, 32, 27); c.quadraticCurveTo(30, 40, 24, 46); c.quadraticCurveTo(18, 40, 16, 27); c.fill(); }
    else if (L.b === 'full') { c.fillStyle = bc; c.beginPath(); c.moveTo(11, 22); c.quadraticCurveTo(24, 40, 37, 22); c.quadraticCurveTo(38, 36, 24, 38); c.quadraticCurveTo(10, 36, 11, 22); c.fill(); }
    else if (L.b === 'short') { c.fillStyle = bc; c.beginPath(); c.moveTo(20, 28); c.lineTo(28, 28); c.lineTo(24, 34); c.fill(); }
    c.restore();
    if (v >= 1) { c.fillStyle = hair; c.beginPath(); c.arc(11, 19, 3.2 + v, 0, 7); c.fill(); }
  }
  const PAD = 12;
  function sprite(key, look, col, dark) {
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = 76 * 2; cv.height = 76 * 2;
    const c = cv.getContext('2d');
    c.scale(2, 2); c.translate(14, PAD + 8);
    draw(c, look, col, dark, look.frame || 0);
    cache[key] = cv;
    return cv;
  }
  // 생성 이미지(gfx/)가 있으면 도형 그림 대신 쓴다. 한 방향 그림이라 좌우 반전만 하고, 걸음·공격 동작은 지금처럼 코드로 준다.
  const GFX = root.RTD_GFX || {}, gimg = {};
  // 그림은 한 장짜리 묶음(gfx/atlas*.png)으로 받아 조각마다 캔버스로 잘라 둔다. 판이 바뀌면 ?v= 값이 달라져 새로 받는다.
  const sheets = [];
  if (typeof Image !== 'undefined') for (let i = 0; i < (root.RTD_GFX_SHEETS || 0); i++) {
    const im = new Image();
    sheets.push(new Promise((res) => {
      im.onload = () => {
        Object.keys(GFX).forEach((id) => {
          const [w, h, s, x, y] = GFX[id];
          if (s !== i) return;
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(im, x, y, w, h, 0, 0, w, h);
          gimg[id] = cv;
        });
        res();
      };
      im.onerror = res;
    }));
    im.src = 'gfx/atlas' + i + '.png?v=' + (root.RTD_GFX_VER || '');
  }
  const ok = (im) => im && im.width;
  // 방향 그림: v 0·1 앞(3/4), 2 옆(오른쪽 보기), 3·4 뒤(오른쪽 위 보기). 왼쪽은 좌우 반전.
  function gfxSprite(id, v) {
    const key = v >= 3 && ok(gimg[id + '_b']) ? id + '_b' : v === 2 && ok(gimg[id + '_s']) ? id + '_s' : id;
    const im = gimg[key];
    if (!ok(im)) return null;
    if (cache['g' + key]) return cache['g' + key];
    // 도형 그림과 같은 칸(152×152)에 발끝을 맞춰 넣는다
    const cv = document.createElement('canvas'); cv.width = 152; cv.height = 152;
    const c = cv.getContext('2d'), [w, h] = GFX[key], s = Math.min(GFX_H / h, 144 / w);
    const dw = w * s, dh = h * s, dx = 76 - dw / 2, dy = GFX_FOOT - dh;
    // 배경과 구분되도록 진한 외곽선(실루엣을 사방으로 밀어 그린 뒤 원본을 얹는다)
    const sil = document.createElement('canvas'); sil.width = 152; sil.height = 152;
    const sc = sil.getContext('2d');
    sc.drawImage(im, dx, dy, dw, dh); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#140c06'; sc.fillRect(0, 0, 152, 152);
    for (let a = 0; a < 8; a++) c.drawImage(sil, Math.cos((a * Math.PI) / 4) * 3, Math.sin((a * Math.PI) / 4) * 3);
    c.drawImage(im, dx, dy, dw, dh);
    return (cache['g' + key] = cv);
  }
  // 지도·경기장 텍스처와 소품(없으면 null)
  const img = (name) => (ok(gimg[name]) ? gimg[name] : null);
  // 모든 생성 그림을 다 불러오면 알려 준다(지도를 다시 그릴 때 쓴다)
  const ready = Promise.all(sheets);
  const GFX_H = 122, GFX_FOOT = 134; // 발끝이 발밑 원판 가운데쯤 오도록
  // 생성 이펙트(빛 그림)를 가운데 기준으로 덧그린다. 없으면 false를 돌려 도형 이펙트를 쓰게 한다.
  // 프레임 애니메이션 이펙트(gfx/fxa_*.png): OpenGameArt CC0 이펙트(Sinestesia 타격·폭발, wreaderror 번개, Grahhhhh 충격파 고리)를
  // 게임 크기로 줄여 묶은 시트. [칸 수, 줄 수, 프레임 수, 프레임 폭, 프레임 높이]. 더하기 합성으로 그린다.
  // 흰 시트(물들여 쓰는 것): wave 충격파 고리(para, CC0), burst 빛살 터짐(Esthar, CC0), smoke 연기(Beast, CC0). art_src/build-vfx.py로 가공.
  const FXA_META = { hit: [4, 4, 16, 256, 256], hit2: [4, 4, 16, 256, 256], boom: [8, 4, 32, 192, 192], boom2: [8, 4, 32, 192, 192], ring: [5, 4, 19, 200, 200], bolt: [1, 4, 4, 1024, 256],
    wave: [5, 5, 25, 96, 96], burst: [6, 5, 30, 128, 128], smoke: [6, 5, 30, 96, 96] };
  const FXA = {};
  if (typeof Image !== 'undefined') Object.keys(FXA_META).forEach((n) => { const im = new Image(); im.onload = () => { FXA[n] = im; }; im.src = 'gfx/fxa_' + n + '.png?v=1'; });
  // 낱장 그림(흰색, 물들여 쓴다): mc_rune1~3 법진(Luke.RUSTLTD, CC0), ray_sun 빛살(simranzenov, CC0), pic_star 별(alexander123, CC0)
  const PIC = {};
  if (typeof Image !== 'undefined') ['mc_rune1', 'mc_rune2', 'mc_rune3', 'ray_sun', 'pic_star'].forEach((n) => { const im = new Image(); im.onload = () => { PIC[n] = im; }; im.src = 'gfx/' + n + '.png?v=1'; });
  // 흰 그림을 색으로 물들인 캔버스(그림·색마다 한 번 만든다). 최근 32개만 남기고 오래 안 쓴 것은 버린다.
  // 낱장 그림은 256px로 줄여 물들인다(스킬 색이 많아 자주 새로 만들어도 가볍게. 빛살·법진은 흐린 그림이라 키워도 티가 덜 난다).
  const TNT = {}; let tntN = 0;
  function tinted(key, im, col) {
    const k = key + '|' + col; let cv = TNT[k];
    if (cv) { delete TNT[k]; TNT[k] = cv; return cv; }
    const s = key[0] === 'p' ? Math.min(1, 256 / Math.max(im.width, im.height)) : 1;
    cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0, cv.width, cv.height);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0, cv.width, cv.height);
    if (++tntN > 32) { const old = Object.keys(TNT)[0]; TNT[old].width = TNT[old].height = 0; delete TNT[old]; tntN--; }
    return (TNT[k] = cv);
  }
  // o(선택): { col 물들일 색, sy 세로 납작함(바닥에 눕힐 때), op 합성 모드(기본 더하기) }
  function blit(c, im, sx, sy0, sw, sh, x, y, w, h, rot, alpha, o) {
    c.save(); c.globalCompositeOperation = (o && o.op) || 'lighter'; c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.translate(x, y); if (o && o.sy) c.scale(1, o.sy); if (rot) c.rotate(rot);
    c.drawImage(im, sx, sy0, sw, sh, -w / 2, -h / 2, w, h);
    c.restore();
  }
  // p: 진행(0→1)로 프레임을 고른다(frame을 주면 그 프레임). w·h: 그릴 크기. 시트가 없으면 false.
  function fxAnim(c, name, p, x, y, w, h, rot, alpha, frame, o) {
    let im = FXA[name]; const m = FXA_META[name];
    if (!im || !(alpha > 0.01)) return !!im;
    if (o && o.col) im = tinted('a' + name, im, o.col);
    const [cols, , n, fw, fh] = m, i = frame != null ? ((frame % n) + n) % n : Math.min(n - 1, Math.max(0, Math.floor(p * n)));
    blit(c, im, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh, x, y, w, h, rot, alpha, o);
    return true;
  }
  // 낱장 그림을 가운데 기준으로 그린다. 없으면 false.
  function fxPic(c, name, x, y, w, h, rot, alpha, o) {
    let im = PIC[name];
    if (!im || !(alpha > 0.01)) return !!im;
    if (o && o.col) im = tinted('p' + name, im, o.col);
    blit(c, im, 0, 0, im.width, im.height, x, y, w, h, rot, alpha, o);
    return true;
  }
  // 화면 장식 낱장 그림(gfx/이름.png): 보스 체력 막대 틀·경고 띠·선택 표시·아레나 테두리와 바닥 문양·먹 띠 등.
  // 처음 부를 때 받고, 아직 없거나 못 받았으면 null(부른 쪽은 예전 모양으로 그린다). 받기 실패는 다시 시도하지 않는다.
  const UIP = {};
  function pic(name) {
    let o = UIP[name];
    if (!o) {
      if (typeof Image === 'undefined') return null;
      o = UIP[name] = { im: new Image(), ok: false };
      o.im.onload = () => { o.ok = true; }; o.im.src = 'gfx/' + name + '.png?v=1';
    }
    return o.ok && o.im.width ? o.im : null;
  }
  // 보스전 전에 다 받아지도록 판을 시작할 때 미리 부른다
  ['ui_bossbar', 'vs_warn', 'ui_select', 'arena_rim', 'arena_mark', 'ui_ink', 'ui_title', 'ui_tab', 'defeat_plank'].forEach(pic);
  // 낱장 그림을 색으로 물들인 것(원본 크기 그대로. 없으면 null)
  function picTint(name, col) { const im = pic(name); return im ? tinted('u' + name, im, col) : null; }
  // 9조각 그리기: 원본 가장자리 sl px을 굵기 b로 고정하고 변·가운데만 늘인다(틀 그림을 어떤 크기에도 모서리가 찌그러지지 않게).
  // slx·sly를 따로 줄 수 있다(가로로 긴 막대 틀). hollow면 가운데 칸은 그리지 않는다.
  function nine(c, im, x, y, w, h, sl, b, o) {
    const iw = im.width, ih = im.height, slx = Math.min(iw / 2 - 1, (o && o.slx) || sl), sly = Math.min(ih / 2 - 1, (o && o.sly) || sl);
    const bx = Math.min(w / 2, (o && o.bx) || b), by = Math.min(h / 2, (o && o.by) || b);
    const sx = [0, slx, iw - slx, iw], sy = [0, sly, ih - sly, ih], dx = [x, x + bx, x + w - bx, x + w], dy = [y, y + by, y + h - by, y + h];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      if (o && o.hollow && i === 1 && j === 1) continue;
      const dw = dx[i + 1] - dx[i], dh = dy[j + 1] - dy[j];
      if (dw > 0.5 && dh > 0.5) c.drawImage(im, sx[i], sy[j], sx[i + 1] - sx[i], sy[j + 1] - sy[j], dx[i], dy[j], dw, dh);
    }
  }
  function fxImg(c, name, x, y, size, rot, alpha, sy) {
    const im = gimg['fx_' + name];
    if (!ok(im)) return false;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.translate(x, y); if (rot) c.rotate(rot); if (sy) c.scale(1, sy);
    c.drawImage(im, -size / 2, -size / 2, size, size);
    c.restore();
    return true;
  }
  const lookOf = (id) => (T.looks[id] ? { w: T.looks[id][0], h: T.looks[id][1], b: T.looks[id][2], s: T.looks[id][3], c: T.looks[id][4], f: T.looks[id][5] } : { w: 'spear', h: 'guard' });
  const unitSprite = (d, v, frame) => { const f = T.factions[d.fac]; return gfxSprite(d.id, v) || sprite(`u${d.id}_${v || 0}_${frame || 0}`, Object.assign(lookOf(d.id), { v, frame }), f.color, f.dark); };
  const namedSprite = (key, unitId, col, v, frame) => gfxSprite(unitId, v) || sprite(`n${key}_${v || 0}_${frame || 0}`, Object.assign(lookOf(unitId), { v, frame }), col, '#1b130c');
  const soldierSprite = (w, v, frame) => gfxSprite('wave' + T.waves.indexOf(w), v) || sprite(`w${w.name}_${v || 0}_${frame || 0}`, { w: w.weapon || 'spear', h: w.hat || 'guard', c: '#2a1c14', v, frame }, w.color, '#1b130c');
  const urls = {};
  // 생성 이미지가 아직 안 불러졌으면 초상화를 저장해 두지 않는다
  // (그림판이 아직 안 불러졌을 때 옛 도형 그림이 저장돼 계속 보이던 문제: 생성 그림이 있는 장수는 불러진 뒤에만 저장)
  const portrait = (d) => urls[d.id] || ((GFX[d.id] && !ok(gimg[d.id])) ? unitSprite(d).toDataURL() : (urls[d.id] = unitSprite(d).toDataURL()));
  function drawSprite(c, img, x, y, size, flip, rot, sy) {
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); if (sy) c.scale(1 / sy, sy);
    c.drawImage(img, -size / 2, -size * 0.6, size, size);
    c.restore();
  }

  // ---- 무기별 평타 ----
  function ang(f) { return Math.atan2(f.y1 - f.y0, f.x1 - f.x0); }
  const at = (f, p) => [f.x0 + (f.x1 - f.x0) * p, f.y0 + (f.y1 - f.y0) * p];
  const MELEE = { sword: 1, twin: 1, halberd: 1, guandao: 1, axe: 1, mace: 1, serpent: 1, dagger: 1 };
  // 평타 투사체·궤적 그림(gfx/vs_*.png, Higgsfield 생성). [그림, 폭, 더하기 합성, 좌우 반전, 날아가며 도는 속도]
  const VSI = {};
  const SHOT_PIC = { bow: ['arrow', 36], crossbow: ['arrow', 36], sword: ['slash', 34, 1, 1], twin: ['slash', 34, 1, 1], spear: ['spear', 52], lance: ['spear', 52], serpent: ['spear', 56],
    halberd: ['slash', 58, 1, 1], guandao: ['slash', 58, 1, 1], axe: ['axe', 20, 0, 0, 18], mace: ['axe', 20, 0, 0, 18], shield: ['shield', 24, 0, 0, 18], fan: ['wind', 46, 1], dagger: ['dagger', 26, 0, 0, 14], staff: ['orb', 24, 1] };
  if (typeof Image !== 'undefined') ['arrow', 'slash', 'spear', 'axe', 'shield', 'wind', 'dagger', 'orb'].forEach((n) => { const im = new Image(); im.onload = () => { VSI[n] = im; }; im.src = 'gfx/vs_' + n + '.png?v=1'; });
  function shot(c, f) {
    const p = f.t / f.life, a = ang(f), [x, y] = at(f, p), s = f.big ? 1.5 : 1, col = f.c, wp = f.wp;
    // 생성 이펙트: 화염은 불덩이가 날아가고, 근접 무기는 맞는 자리에 베기 궤적이 남는다
    if (wp === 'flame' && fxImg(c, 'fire', x, y, 64 * s, a, 1)) return;
    if (MELEE[wp] && p > 0.45) fxImg(c, 'slash', f.x1, f.y1, 70 * s, a + Math.PI / 2, (1 - p) * 2.2);
    const sp = SHOT_PIC[wp], pim = sp && VSI[sp[0]];
    if (pim) {
      // 그림으로 그린다(못 불러왔으면 아래의 예전 도형)
      const w = sp[1], hh = (w * pim.height) / pim.width;
      c.save(); c.translate(x, y); c.rotate(a + (sp[4] ? p * sp[4] : 0)); c.scale(sp[3] ? -s : s, s);
      if (sp[2]) c.globalCompositeOperation = 'lighter';
      c.drawImage(pim, -w / 2, -hh / 2, w, hh);
      if (wp === 'twin') c.drawImage(pim, -w / 2 + 11, -hh / 2, w, hh);
      c.restore();
      return;
    }
    c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
    c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round';
    if (wp === 'bow' || wp === 'crossbow') {
      c.strokeStyle = '#6b4a22'; c.lineWidth = 2; c.beginPath(); c.moveTo(-20, 0); c.lineTo(8, 0); c.stroke();
      c.fillStyle = '#dfe6ee'; c.beginPath(); c.moveTo(13, 0); c.lineTo(5, -3.5); c.lineTo(5, 3.5); c.fill();
      c.fillStyle = '#f4f0e0'; c.fillRect(-21, -3, 6, 2); c.fillRect(-21, 1, 6, 2);
    } else if (wp === 'sword' || wp === 'twin') {
      c.lineWidth = 4; c.strokeStyle = '#f2f6fa'; c.beginPath(); c.arc(-6, 0, 15, -1.1, 1.1); c.stroke();
      c.lineWidth = 2; c.strokeStyle = col; c.beginPath(); c.arc(-10, 0, 15, -1, 1); c.stroke();
      if (wp === 'twin') { c.strokeStyle = '#f2f6fa'; c.lineWidth = 3; c.beginPath(); c.arc(-20, 0, 12, -1, 1); c.stroke(); }
    } else if (wp === 'spear' || wp === 'lance' || wp === 'serpent') {
      c.strokeStyle = '#7a4f28'; c.lineWidth = 3; c.beginPath(); c.moveTo(-30, 0); c.lineTo(6, 0); c.stroke();
      c.fillStyle = '#e6edf4'; c.beginPath(); c.moveTo(18, 0); c.lineTo(5, -5); c.lineTo(5, 5); c.fill();
      if (wp === 'serpent') { c.strokeStyle = '#e6edf4'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, 0); c.quadraticCurveTo(10, -7, 16, 0); c.quadraticCurveTo(22, 7, 28, 0); c.stroke(); }
    } else if (wp === 'halberd' || wp === 'guandao') {
      c.fillStyle = col; c.globalAlpha *= 0.9; c.beginPath(); c.arc(-14, 0, 30, -1.25, 1.25); c.arc(-24, 0, 27, 1.1, -1.1, true); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-14, 0, 30, -0.9, 0.9); c.arc(-18, 0, 28, 0.85, -0.85, true); c.closePath(); c.fill();
    } else if (wp === 'axe' || wp === 'mace' || wp === 'shield') {
      c.rotate(p * 18);
      if (wp === 'shield') { c.fillStyle = '#8a5a2c'; c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill(); c.strokeStyle = '#e8c15a'; c.lineWidth = 2; c.stroke(); }
      else { c.strokeStyle = '#7a4f28'; c.lineWidth = 3; c.beginPath(); c.moveTo(-12, 0); c.lineTo(10, 0); c.stroke(); c.fillStyle = '#dfe6ee'; c.beginPath(); c.arc(10, 0, 8, 0, 7); c.fill(); }
    } else if (wp === 'fan') {
      c.strokeStyle = '#d8f4ff'; c.lineWidth = 2.5; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-i * 9, 0, 8 + i * 4, -1.2 + p * 3, 2 + p * 3); c.stroke(); }
    } else if (wp === 'thunder') {
      c.restore(); c.save();
      c.strokeStyle = '#fff6a8'; c.lineWidth = 3; c.beginPath(); c.moveTo(f.x0, f.y0);
      for (let i = 1; i < 6; i++) { const [a1, b1] = at(f, i / 6), j = (i % 2 ? 1 : -1) * 13; c.lineTo(a1 + Math.sin(a) * j, b1 - Math.cos(a) * j); }
      c.lineTo(f.x1, f.y1); c.stroke(); c.strokeStyle = '#f2c23c'; c.lineWidth = 1.2; c.stroke();
    } else if (wp === 'flame') {
      const g = c.createRadialGradient(0, 0, 1, 0, 0, 14); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#ff8a2a'); g.addColorStop(1, 'rgba(255,60,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 14, 0, 7); c.fill(); c.beginPath(); c.moveTo(-26, 0); c.lineTo(-3, -6); c.lineTo(-3, 6); c.fill();
    } else if (wp === 'dagger') {
      c.rotate(p * 14); c.fillStyle = '#e6edf4'; c.beginPath(); c.moveTo(12, 0); c.lineTo(-3, -4); c.lineTo(-3, 4); c.fill(); c.fillStyle = '#7a4f28'; c.fillRect(-9, -2, 6, 4);
    } else if (wp === 'staff') {
      c.fillStyle = col; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill();
    } else {
      c.lineWidth = 2; c.beginPath(); c.moveTo(-14, 0); c.lineTo(6, 0); c.stroke();
    }
    c.restore();
  }
  // 화면 각도를 8방향 그림 번호와 좌우 반전으로 바꾼다
  function facing(a) {
    const o = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    return [{ v: 2 }, { v: 1 }, { v: 0 }, { v: 1, flip: true }, { v: 2, flip: true }, { v: 3, flip: true }, { v: 4 }, { v: 3 }][o];
  }
  root.RTD_ART = { facing, unitSprite, namedSprite, soldierSprite, portrait, drawSprite, shot, fxImg, fxAnim, fxPic, img, ready, pic, picTint, nine };
})(typeof window !== 'undefined' ? window : globalThis);
