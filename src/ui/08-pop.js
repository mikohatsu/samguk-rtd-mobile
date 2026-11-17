  function queuePop(def, who) { if (def.tier >= 9) { illust(def); try { document.fonts.load('400 200px "Yuji Boku"', '不滅神話'); } catch (e) {} vx('ring'); vx(def.tier === 10 ? 'burst_imm' : 'burst_myth'); ['flame_01', 'flame_02', 'flame_03', 'flame_04', 'flame_05', 'flame_06', 'smoke_04', 'smoke_07', 'exp0', 'exp1', 'exp2', 'exp3', 'exp4', 'exp5', 'exp6', 'exp7', 'exp8', 'bsm0', 'bsm4', 'bsm8', 'bsm12', 'bsm16', 'bsm20'].forEach((n) => kn(n, '255,255,255')); } popQ.push({ def, who, t: 0, dur: (def.tier <= 8 && POP_LO[def.tier]) || POP_DUR[def.tier] || 2.4, hits: {}, fire: [], shake: 0 }); }
  // 신화 아래 등급의 알림 길이: 흔한 4·5성은 짧고 빠르게, 등급이 오를수록 길게(신화·불멸은 POP_DUR 그대로: 시간 멈춤과 맞춘다)
  const POP_LO = { 4: 1.4, 5: 1.6, 6: 2.3, 7: 2.8, 8: 3.0 };
  // 쾅 하는 순간: 흔들림 + 짧은 멈칫(혼자 할 때만, 협동은 계산 시계를 맞춰야 해서 멈추지 않는다) + 진동
  function impact(p, shake, stop, buzz) {
    p.shake = Math.max(p.shake, shake);
    if (stop && !net && g && g.phase === 'wave') S.hitStop = Math.max(S.hitStop || 0, stop);
    if (buzz && navigator.vibrate) { try { navigator.vibrate(buzz); } catch (e) { /* 진동 없음 */ } }
  }
  // 빛살: 가운데에서 뻗는 가는 삼각형들이 천천히 돈다(더하기 합성, 그라디언트 없음)
  // 딱딱한 삼각형이 그대로 보이지 않게: 작은 캔버스에 한 번 그려 가운데서 바깥으로 사라지게 지우고, 키워 그려 가장자리를 흐린다(색·개수별로 한 번만 만든다).
  const rayCache = {};
  function raySheet(col, n) {
    const key = col + n; if (rayCache[key]) return rayCache[key];
    const S2 = 160, cv = document.createElement('canvas'); cv.width = cv.height = S2 * 2; const x = cv.getContext('2d');
    x.translate(S2, S2); x.fillStyle = col;
    for (let i = 0; i < n; i++) { const t0 = (i / n) * Math.PI * 2 + (i % 4) * 0.06, w = 0.035 + (i % 3) * 0.02, rr = S2 * (0.6 + ((i * 7) % 5) * 0.1); x.globalAlpha = i % 2 ? 0.5 : 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(t0 - w) * rr, Math.sin(t0 - w) * rr); x.lineTo(Math.cos(t0 + w) * rr, Math.sin(t0 + w) * rr); x.closePath(); x.fill(); }
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in';
    const fg = x.createRadialGradient(S2, S2, 0, S2, S2, S2); fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(0.35, 'rgba(0,0,0,0.75)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = fg; x.fillRect(0, 0, S2 * 2, S2 * 2);
    return (rayCache[key] = cv);
  }
  function rays(c, x, y, R, col, a, rot, n) {
    if (!(a > 0.01)) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, a * 1.3); c.translate(x, y); c.rotate(rot);
    c.drawImage(raySheet(col, n), -R, -R, R * 2, R * 2);
    c.restore();
  }
  // 다음 알림 꺼내기: 신화·불멸을 먼저(시간 멈춤과 어긋나지 않게), 이어 쌓인 7성 이하 알림은 하나로 묶어 가장 높은 것을 보여 주고 나머지는 +N
  function nextPop() {
    let i = popQ.findIndex((q) => q.def && q.def.tier >= 9);
    if (i < 0) i = 0;
    let p = popQ.splice(i, 1)[0];
    if (p.def && p.def.tier <= 7) {
      const all = [p];
      while (popQ.length && popQ[0].def && popQ[0].def.tier <= 7) all.push(popQ.shift());
      if (all.length > 1) { p = all.reduce((m, q) => (q.def.tier >= m.def.tier ? q : m)); p.more = all.length - 1; }
    }
    return p;
  }
  function star(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.44 : r; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }
  // 별이 반투명하게 커졌다가 작아지며 박힌다
  function slamStar(c, p, key, x, y, r, col, at, big) {
    const tt = p.t - at;
    if (tt < 0) return;
    const f = Math.min(1, tt / 0.18), s = 3.2 - 2.2 * f;
    if (f >= 1 && !p.hits[key]) { p.hits[key] = 1; p.shake = Math.max(p.shake, big ? 1 : 0.35); Snd.play(big ? 'bigslam' : 'star' + Math.min(6, key), 20); }
    c.globalAlpha = 0.4 + 0.6 * f; c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 2;
    star(c, x, y, r * s); c.fill(); c.stroke();
    if (f >= 1 && tt < 0.55) { c.globalAlpha = 1 - (tt - 0.18) / 0.37; c.lineWidth = 4; c.strokeStyle = col; c.beginPath(); c.arc(x, y, r * (1 + (tt - 0.18) * 6), 0, 7); c.stroke(); }
    c.globalAlpha = 1;
  }
  function popBand(c, y, h, a) {
    const g2 = c.createLinearGradient(0, y, 0, y + h);
    g2.addColorStop(0, 'rgba(10,6,4,0)'); g2.addColorStop(0.2, 'rgba(10,6,4,.86)'); g2.addColorStop(0.8, 'rgba(10,6,4,.86)'); g2.addColorStop(1, 'rgba(10,6,4,0)');
    c.globalAlpha = a; c.fillStyle = g2; c.fillRect(-OVER.x, y, W + OVER.x * 2, h); c.globalAlpha = 1;
  }
  function popName(c, p, y, size, a) {
    c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff'; c.font = `400 ${size}px "Black Han Sans", sans-serif`;
    c.fillText(I.t('appears', { a: (p.who ? I.t('whose', { w: p.who }) : '') + p.def.name }), W / 2, y); c.globalAlpha = 1;
  }
  // 묶인 알림 수(+N): 등급 색 작은 글자
  function popMore(c, txt, y, col, a) { c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.font = '400 30px "Black Han Sans", sans-serif'; c.fillText(txt, W / 2, y); c.globalAlpha = 1; }
  const glowCache = {};
  function softGlow(rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.4, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return (glowCache[rgb] = cv);
  }
  // 신화·불멸 등장: 빛줄기 → 한문 명대사와 번역 → 등급 글자가 불타며 박힘 → 그림·한자 이름·한글 이름
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const HZ_FONT = '"Noto Serif KR", "Noto Serif SC", "Noto Serif TC", "SimSun", serif';
  function fitFont(c, text, weight, size, family, maxW) {
    let sz = size; c.font = `${weight} ${sz}px ${family}`;
    while (sz > 20 && c.measureText(text).width > maxW) { sz -= 4; c.font = `${weight} ${sz}px ${family}`; }
    return sz;
  }
  // 고해상도 일러스트: 처음 필요할 때 받고, 가장자리를 어둡게 흐려 연출 화면에 녹인다.
  // 메모리: 화면에 그릴 크기로 줄여 담고 원본은 바로 놓는다. 최근 2장만 남기고 나머지는 캔버스를 돌려준다(iOS 캔버스 한도).
  const ILL = {}, ILL_ORDER = [], ILL_KEEP = 2;
  function illEvict() {
    while (ILL_ORDER.length > ILL_KEEP) {
      const cur = S.pop && S.pop.def && S.pop.def.id;
      const i = ILL_ORDER.findIndex((id) => id !== cur);
      if (i < 0) return;
      const id = ILL_ORDER.splice(i, 1)[0], e = ILL[id];
      delete ILL[id];
      if (!e) continue;
      e.im.onload = null; e.im.removeAttribute('src');
      if (e.cv) e.cv.width = 0;
      if (e.bg) e.bg.width = 0;
    }
  }
  function illust(d) {
    if (!(T.illusts || {})[d.id]) return null;
    let e = ILL[d.id];
    if (e) { const i = ILL_ORDER.indexOf(d.id); if (i !== ILL_ORDER.length - 1) { ILL_ORDER.splice(i, 1); ILL_ORDER.push(d.id); } }
    if (!e) {
      e = ILL[d.id] = { im: new Image(), cv: null, bg: null };
      ILL_ORDER.push(d.id); illEvict();
      e.im.onload = () => {
        if (ILL[d.id] !== e) return; // 받는 사이에 밀려났다
        const nw = e.im.naturalWidth, nh = e.im.naturalHeight;
        // 연출은 화면 높이보다 조금 크게 그린다: 화면 짧은 변(기기 픽셀, 배율 최대 2) 정도면 충분하다
        const scr = Math.min(screen.width || 0, screen.height || 0) || 768, th = Math.max(720, Math.ceil(scr * Math.min(2, window.devicePixelRatio || 1) * 1.1));
        const sc = Math.min(1, th / nh), w = Math.max(1, Math.round(nw * sc)), h = Math.max(1, Math.round(nh * sc)), cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const x = cv.getContext('2d');
        x.drawImage(e.im, 0, 0, w, h);
        x.globalCompositeOperation = 'destination-in';
        const gx = x.createLinearGradient(0, 0, w, 0);
        gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.18, '#000'); gx.addColorStop(0.82, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gx; x.fillRect(0, 0, w, h);
        const gy = x.createLinearGradient(0, 0, 0, h);
        gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.08, '#000'); gy.addColorStop(0.8, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gy; x.fillRect(0, 0, w, h);
        // 흐린 배경도 원본이 있을 때 미리 만들어 둔다(원본을 놓은 뒤에는 만들 수 없다)
        const bg = document.createElement('canvas'); bg.width = 480; bg.height = 270;
        const bx = bg.getContext('2d'), bs = Math.max(bg.width / nw, bg.height / nh) * 1.25;
        bx.filter = 'blur(14px) saturate(1.3) brightness(0.55)';
        bx.drawImage(e.im, (bg.width - nw * bs) / 2, (bg.height - nh * bs) / 2 - 20, nw * bs, nh * bs);
        e.cv = cv; e.bg = bg;
        e.im.onload = null; e.im.removeAttribute('src'); // 풀어 놓은 원본(수 MB)을 놓는다
      };
      e.im.src = 'gfx/il_' + d.id + '.jpg?v=' + T.illusts[d.id];
    }
    return e.cv;
  }
  // 생성 이펙트(검은 배경 jpg, 더하기 합성으로 쓴다)
  const VX = {};
  function vx(name) {
    let e = VX[name];
    if (!e) { e = VX[name] = new Image(); e.src = 'gfx/vx_' + name + '.jpg?v=1'; }
    return e.complete && e.naturalWidth ? e : null;
  }
  // 일러스트를 크게 흐려 깔아 연출 배경 색을 그림과 맞춘다(그림을 받을 때 illust()에서 같이 만든다)
  function illustBg(d) {
    const il = illust(d), e = ILL[d.id];
    return il && e ? e.bg : null;
  }
  // Kenney 입자 텍스처(CC0, gfx/kn_*.png): 흰색 그림을 원하는 색으로 물들여 캐시한다
  const KN = {};
  function kn(name, rgb) {
    const key = name + '|' + rgb;
    if (KN[key]) return KN[key].cv;
    let base = KN[name];
    if (!base) { base = KN[name] = { im: new Image() }; base.im.src = 'gfx/kn_' + name + '.png?v=1'; }
    if (!(base.im.complete && base.im.naturalWidth)) return null;
    const cv = document.createElement('canvas'); cv.width = base.im.naturalWidth; cv.height = base.im.naturalHeight;
    // 곱하기로 물들여 텍스처 안의 명암(결)을 살리고, 원래 투명도로 다시 잘라 낸다
    const x = cv.getContext('2d'); x.drawImage(base.im, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${rgb})`; x.fillRect(0, 0, cv.width, cv.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(base.im, 0, 0);
    KN[key] = { cv };
    return cv;
  }
  // 연기 뭉치 그림(한 번 만들어 둔다): 옅은 덩어리 여러 개를 겹친 불규칙한 연기
  let puffCv = null;
  function smokePuff() {
    if (puffCv) return puffCv;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, d = 18 + (i * 37 % 23), px = 64 + Math.cos(a) * d * 0.9, py = 64 + Math.sin(a) * d * 0.7, r = 22 + (i * 13 % 18);
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(232,222,255,.55)'); g.addColorStop(1, 'rgba(232,222,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    return (puffCv = cv);
  }
  function slamOnce(p, key, big) { if (!p.hits[key]) { p.hits[key] = 1; p.shake = big ? 1.3 : 0.7; Snd.play(big ? 'bigslam' : 'slam', 20); } }
  function drawCutscene(c, p, t, dt) {
    // 입자는 실제 흐른 시간으로 움직인다(30fps 모드에서 절반 속도·절반 생성이 되던 문제). 60fps면 예전과 같다.
    const DT = Math.min(0.1, dt > 0 ? dt : 1 / 60), FR = DT * 60;
    const d = p.def, imm = d.tier === 10, T0 = p.t, fade = Math.min(1, T0 * 5) * Math.min(1, (p.dur - T0) * 2.5);
    // 불멸은 붉은 불꽃, 신화는 보랏빛 불꽃과 번개
    const C = imm ? { core: '255,240,170', mid: '255,110,30', out: '190,20,10', hex: '#ff5a2a', soft: '#ffd27a' } : { core: '255,235,255', mid: '210,110,255', out: '90,30,200', hex: '#d070ff', soft: '#f0c8ff' };
    c.save();
    if (p.shake > 0) c.translate((Math.random() - 0.5) * 26 * p.shake, (Math.random() - 0.5) * 26 * p.shake);
    c.globalAlpha = fade; c.fillStyle = '#050304'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
    // 뜸: 처음 0.35초는 금빛(전설인 줄 알게)으로 지나가다 진짜 등급 색으로 바뀐다. 명대사가 찍히는 동안 소리가 차오르고 섬광에서 터진다.
    const tease = T0 < 0.35;
    if (!tease && !p.hits.tease) { p.hits.tease = 1; Snd.play('shimmer'); }
    if (T0 > 0.5 && !p.hits.rise) { p.hits.rise = 1; Snd.play('rise'); }
    // 1) 빛줄기가 화면을 가로지른다
    if (T0 < 0.95) {
      const q = Math.min(1, T0 / 0.8), k = q * q * (3 - 2 * q), x = -500 + (W + 1000) * k;
      c.globalCompositeOperation = 'lighter';
      c.save(); c.translate(x, H / 2); c.rotate(-0.32);
      const gr = c.createLinearGradient(-160, 0, 160, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); const sc = tease ? '255,190,80' : C.mid; gr.addColorStop(0.45, `rgba(${sc},.5)`); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, `rgba(${sc},.5)`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalAlpha = fade * (1 - Math.max(0, T0 - 0.75) / 0.2); c.fillStyle = gr; c.fillRect(-160, -H * 1.4, 320, H * 2.8);
      c.restore();
      // 가로 섬광선
      const lg = c.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(Math.min(1, Math.max(0, x / W)), 'rgba(255,255,255,.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalAlpha = fade * 0.8 * (1 - T0 / 0.95); c.fillStyle = lg; c.fillRect(-OVER.x, H / 2 - 2, W + OVER.x * 2, 4);
      c.globalCompositeOperation = 'source-over';
    }
    // 2) 한문 명대사 → 번역
    const qc = d.qc || '', qk = d.quote || '';
    if (T0 > 0.45 && T0 < 3.05) {
      const out = 1 - Math.max(0, (T0 - 2.7) / 0.35), chars = Array.from(qc), cnt = Math.min(chars.length, Math.floor((T0 - 0.5) * 16) + 1);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const sz = fitFont(c, qc, 900, 76, HZ_FONT, W - 180);
      // 한 글자씩 빛나며 찍힌다(전체 폭 기준으로 위치를 잡는다)
      const full = c.measureText(qc).width; let cx = W / 2 - full / 2;
      chars.forEach((ch, i) => {
        const w = c.measureText(ch).width;
        if (i < cnt) {
          const age = (T0 - 0.5) - i / 16, pop = 1 + Math.max(0, 0.25 - age) * 2.4;
          c.save(); c.translate(cx + w / 2, H / 2 - 50); c.scale(pop, pop);
          c.globalAlpha = fade * out; c.shadowColor = C.hex; c.shadowBlur = 26; c.fillStyle = '#fff6e6'; c.font = `900 ${sz}px ${HZ_FONT}`; c.fillText(ch, 0, 0);
          c.restore();
        }
        cx += w;
      });
      if (T0 > 0.5 + chars.length / 16) {
        const ka = Math.min(1, (T0 - 0.5 - chars.length / 16) * 3) * out;
        c.globalAlpha = fade * ka; c.shadowBlur = 0; c.fillStyle = '#e8d8b8';
        fitFont(c, qk, 700, 36, '"Gowun Batang", serif', W - 220); c.fillText(qk, W / 2, H / 2 + 40);
        c.strokeStyle = C.hex; c.lineWidth = 1.5; c.globalAlpha = fade * ka * 0.7; c.beginPath(); c.moveTo(W / 2 - 260 * ka, H / 2 + 4); c.lineTo(W / 2 + 260 * ka, H / 2 + 4); c.stroke();
      }
    }
    // 3) 섬광
    if (T0 >= 2.95 && T0 < 3.5 && !p.hits.flash) { slamOnce(p, 'flash', true); Snd.play('jackpot'); p.shake = 1.6; if (navigator.vibrate) { try { navigator.vibrate([30, 40, 60]); } catch (e) { /* 진동 없음 */ } } }
    if (T0 >= 2.95) {
      const rx = W * 0.3, ry = H * 0.36, rank = rankName(d.tier);
      const pulse = 0.8 + Math.sin(t * (imm ? 9 : 6)) * 0.12;
      const hx = W * 0.7, hy = H * 0.56, ga = ease((T0 - 3.2) / 0.5), bga = ease((T0 - 2.95) / 0.7);
      // 흐린 일러스트 배경 + 가장자리 어둡게
      const bg = illustBg(d);
      if (bg) { c.globalAlpha = fade * bga; c.drawImage(bg, -OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); }
      const vg = c.createRadialGradient(W * 0.55, H * 0.5, H * 0.25, W * 0.55, H * 0.5, W * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)');
      c.globalAlpha = fade; c.fillStyle = vg; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
      c.globalCompositeOperation = 'lighter';
      // 인물 뒤 은은한 등급 빛
      const gl = c.createRadialGradient(hx, hy - 40, 20, hx, hy - 40, 460);
      gl.addColorStop(0, `rgba(${C.mid},${0.45 * ga})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = fade; c.fillStyle = gl; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
      // 소환진: 인물 뒤에서 천천히 돈다(바깥 큰 고리, 안쪽 반대로 도는 고리)
      const ring = vx('ring');
      if (ring) {
        const rs0 = 760 * (0.85 + 0.15 * ga);
        c.save(); c.translate(hx, hy - 60); c.rotate(t * 0.12); c.globalAlpha = fade * ga * 0.55; c.drawImage(ring, -rs0 / 2, -rs0 / 2, rs0, rs0); c.restore();
        c.save(); c.translate(hx, hy - 60); c.rotate(-t * 0.2); c.globalAlpha = fade * ga * 0.3; c.drawImage(ring, -rs0 * 0.33, -rs0 * 0.33, rs0 * 0.66, rs0 * 0.66); c.restore();
      }
      // 빛 폭발: 섬광 순간 등급 글자 자리에서 크게 터지고, 인물 뒤에는 약하게 맥동한다
      const burst = vx(imm ? 'burst_imm' : 'burst_myth');
      if (burst) {
        const bk = (T0 - 2.95) / 0.9;
        if (bk < 1) { const bs = 300 + 1500 * ease(bk); c.save(); c.translate(rx, ry); c.rotate(bk * 0.6); c.globalAlpha = fade * (1 - bk); c.drawImage(burst, -bs / 2, -bs / 2, bs, bs); c.restore(); }
        const ps = 980 * (0.95 + Math.sin(t * 2.2) * 0.05);
        c.save(); c.translate(hx, hy - 40); c.rotate(t * 0.05); c.globalAlpha = fade * ga * 0.32; c.drawImage(burst, -ps / 2, -ps / 2, ps, ps); c.restore();
      }
      // 불티: 작고 밝은 불씨가 흩날린다(불멸만). 신화는 바닥에 깔린 연기가 낮게 피어오른다.
      if (!imm) {
        c.globalCompositeOperation = 'source-over';
        p.fog = p.fog || [];
        if (Math.random() < 0.5 * qPart() * FR) p.fog.push({ x: Math.random() * W, y: H + 30, vx: (Math.random() - 0.5) * 14, vy: -(14 + Math.random() * 22), l: 0, m: 5 + Math.random() * 3, r: 90 + Math.random() * 90, a: Math.random() * 6 });
        const fa = fade * Math.min(1, Math.max(0, (T0 - 2.95) / 1));
        for (let i = p.fog.length - 1; i >= 0; i--) {
          const q = p.fog[i]; q.l += DT; q.x += (q.vx + Math.sin(q.l * 0.6 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 10) * DT; q.y += q.vy * DT;
          const k = q.l / q.m;
          if (k >= 1) { p.fog.splice(i, 1); continue; }
          const rr = q.r * (0.8 + k * 0.9);
          const fog = kn((q.alt == null ? (q.alt = Math.random() < 0.5) : q.alt) ? 'smoke_07' : 'smoke_04', '190,175,230') || smokePuff();
          c.save(); c.translate(q.x, q.y); c.rotate(q.a + q.l * 0.08); c.globalAlpha = fa * Math.sin(k * Math.PI) * 0.2;
          c.drawImage(fog, -rr, -rr * 0.7, rr * 2, rr * 1.4); c.restore();
        }
        c.globalCompositeOperation = 'lighter';
      }
      const n = Math.ceil((imm ? 6 : 0) * qPart() * FR);
      for (let i = 0; i < n; i++) {
        const nearText = Math.random() < 0.5;
        p.fire.push({ x: nearText ? rx + (Math.random() - 0.5) * 420 : Math.random() * W, y: nearText ? ry + 40 + Math.random() * 60 : H + 20, vx: (Math.random() - 0.5) * 40, vy: -(60 + Math.random() * 200), l: 0, m: 0.9 + Math.random() * 1.6, r: 2 + Math.random() * 5 });
      }
      for (let i = p.fire.length - 1; i >= 0; i--) {
        const q = p.fire[i]; q.l += DT; q.x += (q.vx + Math.sin(q.l * 4 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 30) * DT; q.y += q.vy * DT;
        const k = q.l / q.m;
        if (k >= 1) { p.fire.splice(i, 1); continue; }
        const rr = q.r * (1 - k * 0.5) * 3;
        c.globalAlpha = fade * (1 - k) * Math.min(1, k * 6) * 0.9; c.drawImage(softGlow(k < 0.4 ? C.core : C.mid), q.x - rr, q.y - rr, rr * 2, rr * 2);
      }
      // 글자 주변: 불멸은 큰 불꽃이 거세게 타오르고, 신화는 보랏빛 아지랑이가 느릿하게 피어오른다
      p.flame = p.flame || [];
      if (imm) {
        // 영겁의 화마: 화면 아래에서 불구름이 굽이치며 치솟고, 그 위로 검은 연기가 피어오른다(Kenney 텍스처)
        const ia = fade * Math.min(1, Math.max(0, (T0 - 2.95) / 0.5));
        p.hell = p.hell || []; p.ash = p.ash || [];
        if (Math.random() < 0.8 * qPart() * FR) p.hell.push({ x: Math.random() * (W + 200) - 100, y: H + 90, vx: (Math.random() - 0.5) * 30, vy: -(90 + Math.random() * 140), l: 0, m: 1.1 + Math.random() * 0.9, r: 110 + Math.random() * 120, a: Math.random() * 6, sp: (Math.random() - 0.5) * 1.2, f: (Math.random() * 9) | 0 });
        if (Math.random() < 0.7 * qPart() * FR) p.ash.push({ x: Math.random() * W, y: H * 0.62 + Math.random() * 80, vx: (Math.random() - 0.5) * 20, vy: -(40 + Math.random() * 50), l: 0, m: 3 + Math.random() * 2, r: 150 + Math.random() * 120, a: Math.random() * 6, f: [0, 4, 8, 12, 16, 20][(Math.random() * 6) | 0] });
        c.globalCompositeOperation = 'source-over';
        for (let i = p.ash.length - 1; i >= 0; i--) {
          const q = p.ash[i]; q.l += DT; q.x += q.vx * DT; q.y += q.vy * DT;
          const k = q.l / q.m;
          if (k >= 1) { p.ash.splice(i, 1); continue; }
          const tex = kn('bsm' + q.f, '40,14,8');
          if (!tex) continue;
          const rr = q.r * (0.7 + k * 0.9);
          c.save(); c.translate(q.x, q.y); c.rotate(q.a + q.l * 0.12); c.globalAlpha = ia * Math.sin(k * Math.PI) * 0.55; c.drawImage(tex, -rr, -rr, rr * 2, rr * 2); c.restore();
        }
        c.globalCompositeOperation = 'lighter';
        for (let i = p.hell.length - 1; i >= 0; i--) {
          const q = p.hell[i]; q.l += DT; q.x += (q.vx + Math.sin(q.l * 3 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 30) * DT; q.y += q.vy * DT;
          const k = q.l / q.m;
          if (k >= 1) { p.hell.splice(i, 1); continue; }
          const tex = kn('exp' + q.f, k < 0.3 ? '255,200,120' : k < 0.65 ? '255,110,40' : '170,30,10');
          if (!tex) continue;
          const rr = q.r * (0.6 + k * 0.8);
          c.save(); c.translate(q.x, q.y); c.rotate(q.a + q.sp * q.l); c.globalAlpha = ia * (1 - k) * Math.min(1, k * 5) * 0.32; c.drawImage(tex, -rr, -rr, rr * 2, rr * 2); c.restore();
        }
        // 화면 테두리가 맥동하는 붉은 열기
        const hv = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
        hv.addColorStop(0, 'rgba(0,0,0,0)'); hv.addColorStop(1, `rgba(255,60,10,${0.22 + Math.sin(t * 3) * 0.06})`);
        c.globalAlpha = ia; c.fillStyle = hv; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2);
        for (let i = 0, n = Math.ceil(16 * qPart() * FR); i < n; i++) p.flame.push({ x: rx + (Math.random() - 0.5) * 380, y: ry + 30 + Math.random() * 70, vx: (Math.random() - 0.5) * 40, vy: -(220 + Math.random() * 360), l: 0, m: 0.45 + Math.random() * 0.8, r: 16 + Math.random() * 42 });
        for (let i = p.flame.length - 1; i >= 0; i--) {
          const q = p.flame[i]; q.l += DT;
          q.x += (q.vx + Math.sin(q.l * 9 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 70) * DT; q.y += q.vy * DT;
          const k = q.l / q.m;
          if (k >= 1) { p.flame.splice(i, 1); continue; }
          const col = k < 0.25 ? C.core : k < 0.6 ? C.mid : C.out, rr = q.r * (1 - k * 0.6), fa2 = fade * (1 - k) * Math.min(1, k * 8);
          c.globalAlpha = fa2 * 0.3; c.drawImage(softGlow(col), q.x - rr, q.y - rr * 1.9, rr * 2, rr * 3.8);
          // 불꽃 혀(Kenney 텍스처): 위로 날름거리며 타오른다
          const tongue = kn((q.alt == null ? (q.alt = Math.random() < 0.5) : q.alt) ? 'flame_05' : 'flame_06', k < 0.3 ? '255,220,140' : '255,110,30');
          if (tongue) { c.globalAlpha = fa2 * 0.65; c.drawImage(tongue, q.x - rr * 0.9, q.y - rr * 3, rr * 1.8, rr * 3.4); }
        }
      } else {
        // 신화: 향 연기처럼 가는 연기 줄기와 옅은 연기 뭉치가 솔솔 피어오른다(빛이 아니라 연기라 더하기 합성을 쓰지 않는다)
        c.globalCompositeOperation = 'source-over';
        const sa = fade * Math.min(1, Math.max(0, (T0 - 2.95) / 0.8));
        // 연기 갈래(Kenney 텍스처): 글자 아래에서 휘감기며 천천히 솔솔 올라가 퍼진다
        p.smoke = p.smoke || [];
        if (Math.random() < 0.45 * qPart() * FR) p.smoke.push({ x: rx + (Math.random() - 0.5) * 360, y: ry + 80 + Math.random() * 30, vx: (Math.random() - 0.5) * 12, vy: -(28 + Math.random() * 30), l: 0, m: 3.2 + Math.random() * 2, r: 70 + Math.random() * 60, a: (Math.random() - 0.5) * 0.6, sp: (Math.random() - 0.5) * 0.25, tex: 'flame_0' + (1 + ((Math.random() * 4) | 0)), fl: Math.random() < 0.5 });
        for (let i = p.smoke.length - 1; i >= 0; i--) {
          const q = p.smoke[i]; q.l += DT; q.x += (q.vx + Math.sin(q.l * 0.8 + (q.ph == null ? (q.ph = Math.random() * 7) : q.ph)) * 10) * DT; q.y += q.vy * DT;
          const k = q.l / q.m;
          if (k >= 1) { p.smoke.splice(i, 1); continue; }
          const wisp = kn(q.tex, k < 0.4 ? '235,225,255' : '185,160,235') || smokePuff();
          const rr = q.r * (0.8 + k * 0.9);
          c.save(); c.translate(q.x, q.y); c.rotate(q.a + q.sp * q.l); if (q.fl) c.scale(-1, 1);
          c.globalAlpha = sa * Math.sin(k * Math.PI) * 0.5;
          c.drawImage(wisp, -rr, -rr * 1.3, rr * 2, rr * 2.6); c.restore();
        }
        c.globalCompositeOperation = 'lighter';
      }
      c.globalCompositeOperation = 'source-over';
      // 4) 그림이 빛과 함께 들어온다
      if (T0 > 3.2) {
        const k = ease((T0 - 3.2) / 0.45), il = illust(d);
        if (il) {
          // 화면 높이보다 조금 크게, 천천히 다가오는 느낌으로
          const ih = (H + 60) * (1.08 - 0.08 * k) * (1 + Math.min(0.04, (T0 - 3.6) * 0.008)), iw = ih * il.width / il.height;
          c.globalAlpha = fade * k; c.drawImage(il, hx - iw / 2 + (1 - k) * 140, H / 2 - ih / 2 + 10, iw, ih);
          // 일러스트 위로 다시 빛을 얹어 등급 색과 섞는다
          c.globalCompositeOperation = 'lighter'; c.globalAlpha = fade * k * (0.25 + Math.sin(t * 3) * 0.06);
          c.drawImage(softGlow(C.mid), hx - iw * 0.6, H * 0.15, iw * 1.2, H * 0.9);
          c.globalCompositeOperation = 'source-over';
        } else {
          const sz = 780 * (0.7 + 0.3 * k);
          c.globalAlpha = fade * k; Art.drawSprite(c, Art.unitSprite(d), hx + (1 - k) * 160, hy + 150 + Math.sin(t * 2) * 6, sz);
        }
      }
      // 5) 등급 글자: 굵은 붓글씨 한자(不滅·神話)가 박히고 아래에 한글
      const rk = ease((T0 - 2.95) / 0.22), rs = 2.4 - 1.4 * rk;
      if (rk >= 1) slamOnce(p, 'rank', true);
      const hzRank = imm ? '不滅' : '神話';
      if (imm) {
        c.save(); c.translate(rx, ry - 14); c.scale(rs, rs); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = `400 210px "Yuji Boku", ${HZ_FONT}`;
        const ink = c.createLinearGradient(0, -110, 0, 100);
        ink.addColorStop(0, '#fff3c8'); ink.addColorStop(0.35, '#ffb040'); ink.addColorStop(0.7, '#e2361a'); ink.addColorStop(1, '#6a0c00');
        c.globalAlpha = fade * rk; c.lineJoin = 'round';
        // 먹 번짐 같은 어두운 테두리 → 불빛 → 붓글씨
        c.shadowColor = 'rgba(255,90,30,.9)'; c.shadowBlur = 40 + Math.sin(t * 7) * 12;
        c.lineWidth = 12; c.strokeStyle = 'rgba(30,4,0,.92)'; c.strokeText(hzRank, 0, 0);
        c.shadowBlur = 0; c.fillStyle = ink; c.fillText(hzRank, 0, 0);
        // 주기적으로 훑는 광택
        const sh = ((t * 0.5) % 1.6) - 0.3, shine = c.createLinearGradient(-240, -110, 240, 110);
        shine.addColorStop(0, 'rgba(255,255,255,0)'); shine.addColorStop(Math.max(0, Math.min(1, sh - 0.07)), 'rgba(255,255,255,0)');
        shine.addColorStop(Math.max(0, Math.min(1, sh)), 'rgba(255,255,255,.7)'); shine.addColorStop(Math.max(0, Math.min(1, sh + 0.07)), 'rgba(255,255,255,0)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = fade * rk * 0.6; c.fillStyle = shine; c.fillText(hzRank, 0, 0);
        c.globalCompositeOperation = 'source-over';
        c.restore();
      } else {
        // 신화: 글자는 고정. 은빛·보랏빛 먹으로 차분하게, 불멸보다 빛을 덜 쓴다.
        c.save(); c.translate(rx, ry - 14); c.scale(rs, rs); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = `400 210px "Yuji Boku", ${HZ_FONT}`; c.lineJoin = 'round';
        const ink = c.createLinearGradient(0, -110, 0, 100);
        ink.addColorStop(0, '#ffffff'); ink.addColorStop(0.4, '#e6d6ff'); ink.addColorStop(0.75, '#9a70ff'); ink.addColorStop(1, '#3a1a7a');
        c.globalAlpha = fade * rk;
        c.shadowColor = 'rgba(180,140,255,.7)'; c.shadowBlur = 22;
        c.lineWidth = 10; c.strokeStyle = 'rgba(14,4,32,.88)'; c.strokeText(hzRank, 0, 0);
        c.shadowBlur = 0; c.fillStyle = ink; c.fillText(hzRank, 0, 0);
        c.restore();
      }
      // 한글 부제: 양옆 선과 함께
      const kr = Math.min(1, Math.max(0, (T0 - 3.2) * 3));
      if (kr > 0 && I.lang !== 'ja') { // 일본어는 위의 큰 한자(神話·不滅)와 같은 글자라 생략
        c.save(); c.translate(rx, ry + 112); c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = fade * kr;
        c.font = '700 50px "Gowun Batang", serif'; const label = rank.split('').join('  ');
        c.shadowColor = '#000'; c.shadowBlur = 8; c.fillStyle = C.soft; c.fillText(label, 0, 0); c.shadowBlur = 0;
        const lw = c.measureText(label).width / 2 + 18;
        c.strokeStyle = C.hex; c.lineWidth = 2; c.beginPath(); c.moveTo(-lw - 90 * kr, 0); c.lineTo(-lw, 0); c.moveTo(lw, 0); c.lineTo(lw + 90 * kr, 0); c.stroke();
        c.restore();
      }
      // 6) 한자 이름, 한글 이름이 차례로 박힌다
      const hz = d.hz || d.mark;
      const k1 = ease((T0 - 3.75) / 0.18);
      if (T0 > 3.75) {
        if (k1 >= 1) slamOnce(p, 'hz', false);
        const s1 = 1.8 - 0.8 * k1;
        c.save(); c.translate(rx, ry + 205); c.scale(s1, s1); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.globalAlpha = fade * k1; c.shadowColor = C.hex; c.shadowBlur = 24; c.fillStyle = '#fff3dc'; c.font = `900 104px ${HZ_FONT}`; c.fillText(hz, 0, 0);
        c.restore();
      }
      const k2 = ease((T0 - 4.2) / 0.18);
      if (T0 > 4.2) {
        // 일본어는 한자 이름이 곧 이름이라 아래에 한 번 더 쓰지 않는다
        const dup = I.lang === 'ja' || d.name === hz;
        if (k2 >= 1 && !dup) slamOnce(p, 'ko', true);
        const s2 = 1.9 - 0.9 * k2;
        if (!dup) {
        c.save(); c.translate(rx, ry + 308); c.scale(s2, s2); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.globalAlpha = fade * k2; c.shadowColor = '#000'; c.shadowBlur = 12; c.fillStyle = C.soft; c.font = '400 76px "Black Han Sans", sans-serif'; c.fillText(d.name, 0, 0);
        c.restore();
        }
        const k3 = Math.min(1, (T0 - 4.45) * 3);
        if (k3 > 0) {
          c.globalAlpha = fade * k3; c.textAlign = 'center'; c.fillStyle = '#d8c8a8'; c.font = '700 26px "Gowun Batang", serif';
          c.fillText(`${d.title || ''}${p.who ? '  ·  ' + I.t('whoseGeneral', { w: p.who }) : ''}`, rx, ry + (dup ? 300 : 378));
        }
      }
    }
    // 잭팟 충격파: 등급 글자 자리에서 화면 밖까지 두 겹 고리가 퍼진다
    if (T0 >= 2.95 && T0 < 3.85) {
      for (let i = 0; i < 2; i++) { const q = (T0 - 2.95 - i * 0.12) / 0.75; if (q <= 0 || q >= 1) continue; c.globalAlpha = fade * (1 - q); c.strokeStyle = i ? '#fff' : C.hex; c.lineWidth = 26 * (1 - q) + 2; c.beginPath(); c.arc(W * 0.3, H * 0.36, 80 + ease(q) * W * 1.1, 0, 7); c.stroke(); }
    }
    // 섬광은 맨 위에 덮는다
    if (T0 >= 2.95 && T0 < 3.5) { c.globalAlpha = fade * Math.pow(1 - (T0 - 2.95) / 0.55, 2); c.fillStyle = '#fff'; c.fillRect(-OVER.x, -OVER.y, W + OVER.x * 2, H + OVER.y * 2); }
    c.globalAlpha = 1; c.shadowBlur = 0; c.restore();
  }
  function drawVictory(c, p, t) {
    const e = p.vic, b = e.boss, a = Math.min(1, p.t * 4) * Math.min(1, (p.dur - p.t) * 3), cx = W / 2 - 16;
    const rows = p.rows.slice(0, 5), y0 = 120;
    popBand(c, y0, 640 + rows.length * 40, a);
    c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeStyle = b.fx; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 420, y0 + 192); c.lineTo(cx + 420, y0 + 192); c.stroke();
    c.shadowColor = '#ffb347'; c.shadowBlur = 30 + Math.sin(t * 6) * 10; c.fillStyle = '#ffe2a8';
    const s = 1 + Math.max(0, 0.4 - p.t) * 1.5;
    c.font = `400 ${Math.round(130 * s)}px "East Sea Dokdo", "Black Han Sans", serif`; c.fillText(I.t('bossDown'), cx, y0 + 90); c.shadowBlur = 0;
    c.fillStyle = '#fff'; c.font = '400 38px "Black Han Sans", sans-serif'; c.fillText(`${b.title} · ${b.name}`, cx, y0 + 162);
    c.font = '700 24px "IBM Plex Sans KR", sans-serif'; c.fillStyle = '#d8c8a8'; c.fillText(I.t('timeTaken', { t: clock(e.time) }) + (e.fast ? '  ·  ' : ''), cx - (e.fast ? 90 : 0), y0 + 226);
    if (e.fast) { c.fillStyle = '#ffd86a'; c.fillText(I.t('fastBonus'), cx + 110, y0 + 226); }
    c.fillStyle = '#e6c578'; c.font = '700 22px "Gowun Batang", serif'; c.fillText(I.t('rewardsGot'), cx, y0 + 272);
    c.fillStyle = '#fff'; c.font = '700 26px "IBM Plex Sans KR", sans-serif'; c.fillText(rwText(e.reward), cx, y0 + 308);
    // 피해 순위: 순위 · 이름 · 피해량 · 비율 막대
    if (rows.length) {
      const sum = p.rows.reduce((q, r) => q + r.v, 0) || 1, top = rows[0].v || 1, bx = cx - 330, bw = 660;
      c.fillStyle = '#e6c578'; c.font = '700 22px "Gowun Batang", serif'; c.fillText(I.t('dmgRank'), cx, y0 + 360);
      rows.forEach((r, i) => {
        const y = y0 + 392 + i * 40, pctv = r.v / sum;
        c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(bx, y, bw, 32);
        c.fillStyle = i === 0 ? 'rgba(255,200,90,.55)' : r.me ? 'rgba(125,255,142,.4)' : 'rgba(255,190,90,.3)'; c.fillRect(bx, y, bw * (r.v / top), 32);
        c.textAlign = 'left'; c.fillStyle = i === 0 ? '#ffd86a' : '#fff'; c.font = '400 22px "Black Han Sans", sans-serif'; c.fillText(`${i + 1}`, bx + 12, y + 17);
        c.font = '700 19px "IBM Plex Sans KR", sans-serif'; c.fillText(r.name + (r.me ? I.t('meTag') : ''), bx + 44, y + 17);
        c.textAlign = 'right'; c.fillText(`${fmt(r.v)}  ·  ${Math.round(pctv * 100)}%`, bx + bw - 12, y + 17);
      });
      c.textAlign = 'center';
    }
    c.globalAlpha = 1;
  }
  function drawPop(c, t, dt) {
    // 보스 등장 중에는 유닛 등장 알림을 꺼내지 않고(끝난 뒤 이어서 보여 준다), 이미 떠 있는 알림은 0.3초 안에 닫는다
    const inIntro = g && g.phase === 'bossIntro';
    if (inIntro && S.pop && !S.pop.vic && !S.pop.cut) { S.pop.cut = 1; S.pop.dur = Math.min(S.pop.dur, S.pop.t + 0.3); }
    // 신화·불멸이 기다리면 지금 떠 있는 낮은 알림은 0.25초 안에 닫는다
    if (S.pop && S.pop.def && S.pop.def.tier < 9 && !S.pop.cut2 && popQ.some((q) => q.def && q.def.tier >= 9)) { S.pop.cut2 = 1; S.pop.dur = Math.min(S.pop.dur, S.pop.t + 0.25); }
    if (!S.pop && popQ.length && !inIntro) {
      S.pop = nextPop();
      const tier = S.pop.def ? S.pop.def.tier : 0;
      if (tier >= 9) Snd.play('legend'); else if (tier === 8) Snd.play('gather');
      else if (tier === 4 || tier === 5) Snd.play('pop45');
    }
    const p = S.pop;
    if (!p) return;
    p.t += dt; p.shake = Math.max(0, p.shake - dt * 3);
    if (p.t >= p.dur) { S.pop = null; return; }
    if (p.vic) return drawVictory(c, p, t);
    const d = p.def, col = tierColor(d.tier), a = Math.min(1, p.t * 5) * Math.min(1, (p.dur - p.t) * 3);
    if (d.tier >= 9) return drawCutscene(c, p, t, dt);
    c.save();
    if (p.shake > 0) c.translate((Math.random() - 0.5) * 22 * p.shake, (Math.random() - 0.5) * 22 * p.shake);
    const T0 = p.t, more = p.more ? '+' + p.more : '';
    if (d.tier <= 5) {
      // 4·5성: 가볍고 빠르게. 별이 0.05초 간격으로 톡톡 튀어나온다.
      popBand(c, 150, 200, a);
      for (let i = 0; i < d.tier; i++) {
        const k = Math.min(1, Math.max(0, (T0 - i * 0.05) / 0.12)), s = k < 1 ? 0.4 + k * 0.9 : 1.3 - Math.min(0.3, (T0 - i * 0.05 - 0.12) * 3);
        if (k <= 0) continue;
        c.globalAlpha = a; c.fillStyle = col; star(c, W / 2 + (i - (d.tier - 1) / 2) * 62, 220, 25 * s); c.fill();
      }
      c.globalAlpha = 1; popName(c, p, 292, 46, a);
      if (more) popMore(c, more, 330, col, a);
    } else if (d.tier === 6) {
      // 6성: 별 여섯이 음을 올리며 빠르게 박힌다
      popBand(c, 150, 340, a);
      for (let i = 0; i < 6; i++) slamStar(c, p, i, W / 2 + (i - 2.5) * 96, 260, 40, col, 0.08 + i * 0.12);
      popName(c, p, 390, 62, Math.min(1, Math.max(0, (T0 - 0.95) * 4)) * a);
      if (more) popMore(c, more, 440, col, a);
    } else if (d.tier === 7) {
      // 7성: 별 여섯 → 큰 별이 떨어져 쾅(빛살·섬광·멈칫)
      popBand(c, 90, 420, a);
      const land = 1.2, fall = Math.min(1, Math.max(0, (T0 - 0.95) / (land - 0.95)));
      if (T0 > land) rays(c, W / 2, 225, 520, col, a * 0.3 * Math.min(1, (T0 - land) * 4), T0 * 0.25, 18);
      [-310, -215, -120, 120, 215, 310].forEach((o, i) => slamStar(c, p, i, W / 2 + o, 290, 40, col, 0.08 + i * 0.13));
      if (fall > 0) {
        const y = -160 + (225 + 160) * fall * fall;
        if (fall >= 1 && !p.hits.big) { p.hits.big = 1; impact(p, 1.3, 0.08, 18); Snd.play('bigslam', 20); Snd.play('shimmer'); }
        c.globalAlpha = a; c.fillStyle = '#fff'; c.shadowColor = col; c.shadowBlur = 40; star(c, W / 2, y, 86); c.fill(); c.fillStyle = col; star(c, W / 2, y, 76); c.fill(); c.shadowBlur = 0; c.globalAlpha = 1;
        if (fall >= 1 && T0 < land + 0.5) { const q = (T0 - land) / 0.5; c.globalAlpha = a * (1 - q); c.strokeStyle = col; c.lineWidth = 6 * (1 - q) + 1; c.beginPath(); c.arc(W / 2, 225, 90 + q * 360, 0, 7); c.stroke(); }
      }
      if (T0 > land && T0 < land + 0.18) { c.globalAlpha = a * (1 - (T0 - land) / 0.18) * 0.7; c.fillStyle = '#fff'; c.fillRect(-OVER.x, 90, W + OVER.x * 2, 420); }
      c.globalAlpha = 1;
      popName(c, p, 420, 66, Math.min(1, Math.max(0, (T0 - 1.35) * 4)) * a);
      if (more) popMore(c, more, 470, col, a);
    } else {
      // 전설: 금빛이 모여들고(뜸 0.35초) → 이름이 쾅 박히며 섬광·빛살·흔들림·멈칫 → 광택이 훑는다
      const HIT = 0.35, cy = 300;
      popBand(c, 130, 400, a);
      if (T0 < HIT) {
        const k = T0 / HIT;
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 16; i++) { const an = i * 0.39 + i * i * 0.07, rr = (1 - k * k) * (260 + (i % 4) * 70); c.globalAlpha = a * k; c.drawImage(softGlow('255,190,90'), W / 2 + Math.cos(an) * rr * 1.6 - 12, cy + Math.sin(an) * rr * 0.6 - 12, 24, 24); }
        const gs = 60 + k * 160; c.globalAlpha = a * k * 0.8; c.drawImage(softGlow('255,220,140'), W / 2 - gs, cy - gs, gs * 2, gs * 2);
        c.restore();
      } else {
        if (!p.hits.lg) { p.hits.lg = 1; impact(p, 1.3, 0.09, 22); Snd.play('bigslam', 20); Snd.play('legendHit'); }
        const k = T0 - HIT;
        rays(c, W / 2, cy, 700, '#ffb347', a * 0.28 * Math.min(1, k * 5), T0 * 0.18, 22);
        // 퍼지는 충격 고리와 튀는 불티
        if (k < 0.6) {
          const q = k / 0.6; c.globalAlpha = a * (1 - q) * (1 - q) * 0.6; c.strokeStyle = '#ffe2a8'; c.lineWidth = 14 * (1 - q) + 1;
          c.beginPath(); c.ellipse(W / 2, cy, 120 + q * 640, 60 + q * 220, 0, 0, 7); c.stroke();
          c.save(); c.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 18; i++) { const an = i * 0.349 + 0.2, rr = 60 + q * (300 + (i % 3) * 120); c.globalAlpha = a * (1 - q); c.drawImage(softGlow(i % 3 ? '255,180,80' : '255,245,210'), W / 2 + Math.cos(an) * rr * 1.5 - 10, cy + Math.sin(an) * rr * 0.55 - 10, 20, 20); }
          c.restore();
        }
        const sk = Math.min(1, k / 0.14), ns = sk < 1 ? 2.1 - 1.1 * ease(sk) : 1;
        const sweep = (T0 * 1.1) % 1.6 - 0.3, gr = c.createLinearGradient(W / 2 - 320, 0, W / 2 + 320, 0);
        gr.addColorStop(0, '#d98a1e'); gr.addColorStop(Math.max(0, Math.min(1, sweep)), '#fff6c8'); gr.addColorStop(1, '#ffb347');
        c.save(); c.translate(W / 2, cy); c.scale(ns, ns);
        c.globalAlpha = a * Math.min(1, sk * 2); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = '#ffb347'; c.shadowBlur = 34 + Math.sin(t * 7) * 14; c.fillStyle = gr;
        c.font = '400 150px "East Sea Dokdo", "Black Han Sans", serif'; c.fillText(d.name, 0, 0);
        c.restore(); c.shadowBlur = 0;
        const ka = Math.min(1, Math.max(0, (k - 0.25) * 4));
        c.globalAlpha = a * ka; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffe2a8'; c.font = '700 32px "Gowun Batang", serif'; c.fillText((p.who ? I.t('whose', { w: p.who }) : '') + I.t('legendAppear', { title: d.title ? '· ' + d.title + ' ' : '' }), W / 2, 410);
        // 섬광(띠 안쪽만)
        if (k < 0.2) { c.globalAlpha = a * Math.pow(1 - k / 0.2, 2) * 0.85; c.fillStyle = '#fff'; c.fillRect(-OVER.x, 130, W + OVER.x * 2, 400); }
        c.globalAlpha = 1;
      }
    }
    c.restore();
  }
  function drawBanner() {
    const b = S.banner, c = ctx;
    if (!b) return;
    b.t -= S.fdt;
    if (b.t <= 0) { S.banner = null; return; }
    c.globalAlpha = Math.min(1, b.t * 2); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(15,10,8,.7)'; c.fillRect(W / 2 - 300, 170, 600, 86);
    c.fillStyle = '#ffd86a'; c.font = '400 40px "Black Han Sans", sans-serif'; c.fillText(b.text, W / 2, 200);
    c.fillStyle = '#e8dcc0'; c.font = '400 20px "Gowun Batang", serif'; c.fillText(b.sub || '', W / 2, 236);
    c.globalAlpha = 1;
  }
