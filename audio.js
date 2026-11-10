// 무기·타격·스킬 소리는 녹음된 효과음(sfxdata.js), 나머지(알림·북·배경 장단)는 Web Audio 합성. 브라우저 정책상 시작 버튼을 누른 뒤에 켜진다.
(function (root) {
  let ac = null, master = null, sfxBus = null, bgmBus = null, bgmTimer = null, step = 0, noteIdx = 4, boss = false;
  const last = {}, st = { sfx: 0.6, bgm: 0.35 };
  const SCALE = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440, 523.25]; // 라단조 5음계

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createDynamicsCompressor(); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = st.sfx; sfxBus.connect(master);
    bgmBus = ac.createGain(); bgmBus.gain.value = st.bgm; bgmBus.connect(master);
    startBgm();
  }
  function tone(f, dur, type, vol, opt) {
    if (!ac) return;
    opt = opt || {};
    const t = ac.currentTime + (opt.at || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opt.bus || sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  let nb = null;
  function noise(dur, freq, vol, opt) {
    if (!ac) return;
    opt = opt || {};
    if (!nb) { nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ac.currentTime + (opt.at || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nb; f.type = opt.type || 'bandpass'; f.frequency.setValueAtTime(freq, t);
    if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(opt.bus || sfxBus); s.start(t, Math.random() * 0.7); s.stop(t + dur + 0.02);
  }
  // 녹음된 효과음(sfxdata.js, OpenGameArt CC0): 무기 종류별 묶음에서 하나를 골라 높낮이를 조금씩 바꿔 튼다.
  // 데이터가 없거나 아직 준비 전이면 false를 돌려 아래의 합성음을 쓴다.
  const bufs = {};
  function buffers(name) {
    if (bufs[name]) return bufs[name];
    const D = root.RTD_SFX_DATA, list = D && D.clips[name];
    if (!ac || !list) return null;
    return (bufs[name] = list.map((b64) => {
      const bin = atob(b64), n = bin.length >> 1, buf = ac.createBuffer(1, n, D.sr), ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) { const v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8); ch[i] = (v >= 32768 ? v - 65536 : v) / 32768; }
      return buf;
    }));
  }
  function sample(name, vol, opt) {
    const list = buffers(name);
    if (!list || !list.length) return false;
    opt = opt || {};
    const t = ac.currentTime + (opt.at || 0), s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = list[(Math.random() * list.length) | 0];
    s.playbackRate.value = (opt.rate || 1) * (0.93 + Math.random() * 0.14);
    g.gain.value = vol;
    s.connect(g); g.connect(sfxBus); s.start(t);
    return true;
  }
  // 묵직함을 더하는 낮은 '쿵'(큰 무기·타격에 겹친다)
  const thump = (f, vol, at) => tone(f, 0.12, 'sine', vol, { to: f * 0.45, at: at || 0 });
  const SFX = {
    // 활·쇠뇌: 시위 튕기는 소리 + 화살 바람 소리
    bow() { tone(520, 0.08, 'triangle', 0.1, { to: 200 }); if (!sample('bow', 0.55, { rate: 1.15 })) noise(0.09, 2600, 0.06); },
    crossbow() { tone(300, 0.06, 'square', 0.07, { to: 120 }); if (!sample('bow', 0.6, { rate: 0.9 })) noise(0.05, 3000, 0.08); },
    // 검: 날카로운 베기
    sword() { if (!sample('sword', 0.5)) { noise(0.1, 2400, 0.1, { to: 5200 }); tone(1500, 0.05, 'sine', 0.04); } },
    twin() { SFX.sword(); if (!sample('sword', 0.4, { at: 0.07, rate: 1.12 })) noise(0.08, 3000, 0.08, { at: 0.05, to: 6000 }); },
    dagger() { if (!sample('dagger', 0.45, { rate: 1.1 })) noise(0.06, 3800, 0.08, { to: 6500 }); },
    // 창: 찌르는 바람 소리
    spear() { if (!sample('spear', 0.6, { rate: 1.1 })) noise(0.09, 900, 0.12, { to: 2400 }); },
    lance() { SFX.spear(); },
    serpent() { if (!sample('spear', 0.65, { rate: 0.9 })) noise(0.13, 700, 0.14, { to: 2800 }); },
    // 극·언월도: 길고 무거운 베기 + 낮은 울림
    halberd() { if (!sample('heavy', 0.55)) noise(0.16, 500, 0.15, { to: 3000 }); thump(170, 0.1, 0.04); },
    guandao() { if (!sample('heavy', 0.6, { rate: 0.9 })) noise(0.16, 500, 0.15, { to: 3000 }); thump(140, 0.13, 0.05); },
    // 도끼·철퇴: 둔탁한 타격
    axe() { if (!sample('blunt', 0.6)) noise(0.1, 500, 0.13); thump(150, 0.12); },
    mace() { if (!sample('blunt', 0.65, { rate: 0.88 })) noise(0.1, 500, 0.13); thump(120, 0.14); },
    shield() { if (!sample('shield', 0.5)) { tone(190, 0.08, 'square', 0.07, { to: 90 }); noise(0.05, 1200, 0.06); } thump(180, 0.08); },
    // 책사: 주문 소리(부채는 바람, 벼락은 날카롭게, 불은 낮게)
    fan() { if (!sample('magic', 0.32, { rate: 1.25 })) noise(0.2, 700, 0.09, { to: 1800 }); },
    thunder() { if (!sample('magic', 0.34, { rate: 1.5 })) noise(0.16, 3500, 0.13, { to: 500 }); noise(0.1, 3500, 0.06, { to: 600 }); },
    flame() { if (!sample('magic', 0.34, { rate: 0.8 })) noise(0.18, 500, 0.1, { to: 1400 }); },
    staff() { if (!sample('magic', 0.3)) tone(780, 0.12, 'sine', 0.06, { to: 1100 }); },
    // 강타가 꽂힐 때: 쇠 부딪히는 소리 + 낮은 쿵
    hit() { if (!sample('clash', 0.5)) noise(0.06, 2600, 0.1); thump(110, 0.2); },
    round() { for (let i = 0; i < 3; i++) { tone(90, 0.18, 'sine', 0.3, { at: i * 0.16, to: 50 }); noise(0.05, 300, 0.1, { at: i * 0.16 }); } },
    combine() { [440, 554, 659].forEach((f, i) => tone(f, 0.18, 'triangle', 0.13, { at: i * 0.06 })); },
    craft() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15, { at: i * 0.08 })); },
    legend() { [261, 392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.55, 'sawtooth', 0.07, { at: i * 0.09 })); SFX.gong(); },
    slam() { noise(0.14, 260, 0.26, { type: 'lowpass', to: 80 }); tone(120, 0.16, 'sine', 0.26, { to: 45 }); noise(0.05, 2600, 0.08); },
    bigslam() { noise(0.4, 300, 0.4, { type: 'lowpass', to: 50 }); tone(90, 0.5, 'sine', 0.4, { to: 30 }); tone(233, 0.9, 'triangle', 0.09, { to: 220 }); },
    gong() { tone(110, 2.2, 'sine', 0.3, { to: 96 }); tone(233, 1.6, 'triangle', 0.1, { to: 220 }); tone(377, 1.1, 'sine', 0.06); noise(0.3, 500, 0.12); },
    warn() { tone(330, 0.14, 'square', 0.07); tone(330, 0.14, 'square', 0.07, { at: 0.17 }); },
    boom() { noise(0.26, 260, 0.2, { type: 'lowpass', to: 70 }); tone(70, 0.22, 'sine', 0.22, { to: 36 }); },
    hurt() { tone(170, 0.14, 'sawtooth', 0.1, { to: 70 }); },
    dead() { tone(220, 0.5, 'sawtooth', 0.12, { to: 50 }); },
    skill() { if (!sample('skill', 0.5)) { noise(0.28, 900, 0.12, { to: 3400 }); tone(330, 0.3, 'sawtooth', 0.08, { to: 880 }); } },
    dash() { noise(0.16, 1400, 0.1, { to: 400 }); },
    chest() { [587, 698, 880].forEach((f, i) => tone(f, 0.16, 'square', 0.05, { at: i * 0.05 })); },
    life() { tone(247, 0.25, 'square', 0.1, { to: 165 }); },
    midkill() { [330, 440, 587].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, { at: i * 0.07 })); },
    ach() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'sine', 0.13, { at: i * 0.07 })); },
    win() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'triangle', 0.16, { at: i * 0.13 })); },
    lose() { [294, 262, 220, 147].forEach((f, i) => tone(f, 0.6, 'sawtooth', 0.09, { at: i * 0.22 })); },
    click() { tone(900, 0.03, 'square', 0.03); },
  };
  function play(name, gap) {
    if (!ac || !SFX[name] || st.sfx <= 0) return;
    const now = performance.now();
    if (now - (last[name] || 0) < (gap || 60)) return;
    last[name] = now;
    SFX[name]();
  }
  function beat() {
    // 북과 뜯는 현 소리로 만든 단순 반복곡. 보스전에는 빨라진다.
    if (!ac || st.bgm <= 0) return;
    const b = { bus: bgmBus }, s = step++ % 16;
    if (s % 4 === 0) tone(boss ? 70 : 62, 0.3, 'sine', boss ? 0.5 : 0.36, { bus: bgmBus, to: 42 });
    if (boss && s % 4 === 2) noise(0.06, 900, 0.16, b);
    if (s % 8 === 6) noise(0.05, 1800, 0.08, b);
    if (Math.random() < (boss ? 0.62 : 0.42)) {
      noteIdx = Math.max(0, Math.min(SCALE.length - 1, noteIdx + [-2, -1, -1, 1, 1, 2][(Math.random() * 6) | 0]));
      tone(SCALE[noteIdx] * (boss ? 1 : 2), 0.42, 'triangle', 0.14, b);
    }
    if (s === 0) tone(SCALE[boss ? 0 : 3] / 2, 1.7, 'sawtooth', 0.035, b);
  }
  function startBgm() { clearInterval(bgmTimer); bgmTimer = setInterval(beat, boss ? 170 : 270); }
  root.RTD_AUDIO = {
    init, play, state: st,
    setBoss(on) { if (boss !== on) { boss = on; if (ac) startBgm(); } },
    setSfx(v) { st.sfx = v; if (sfxBus) sfxBus.gain.value = v; },
    setBgm(v) { st.bgm = v; if (bgmBus) bgmBus.gain.value = v; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
