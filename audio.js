// 배경음은 녹음된 곡(bgm/*.mp3, Kevin MacLeod CC BY 4.0), 무기·타격·스킬 소리는 녹음된 효과음(sfxdata.js), 알림·북 소리는 Web Audio 합성. 브라우저 정책상 시작 버튼을 누른 뒤에 켜진다.
(function (root) {
  let ac = null, master = null, sfxBus = null, bgmBus = null, bgmTimer = null, step = 0, noteIdx = 4, boss = false;
  // atkBus: 평타 무기음·일반 타격음만 지나는 버스. 스킬이 맞는 순간 잠깐 줄여(덕킹) 스킬 타격이 덮이지 않게 한다.
  let atkBus = null;
  // play()가 소리 하나를 만드는 동안만 쓰는 값: 시작 지연(초, 연출 명중 시점에 맞추기)과 출력 버스. 끝나면 0/null로 돌린다.
  let curAt = 0, curBus = null;
  const last = {}, st = { sfx: 0.6, bgm: 0.35 };
  const SCALE = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440, 523.25]; // 라단조 5음계

  function init() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume();
      // 처음 재생이 막혔으면(자동 재생 제한) 화면을 누를 때 다시 튼다
      const m = mus[boss ? 'boss' : 'lane'];
      if (m && m.el.paused && st.bgm > 0 && !hiddenNow) { const pr = m.el.play(); if (pr && pr.catch) pr.catch(() => {}); }
      return;
    }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createDynamicsCompressor(); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = st.sfx; sfxBus.connect(master);
    atkBus = ac.createGain(); atkBus.gain.value = 1; atkBus.connect(sfxBus);
    bgmBus = ac.createGain(); bgmBus.gain.value = st.bgm; bgmBus.connect(master);
    startBgm();
  }
  function tone(f, dur, type, vol, opt) {
    if (!ac) return;
    opt = opt || {};
    const t = ac.currentTime + curAt + (opt.at || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(opt.bus || curBus || sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  let nb = null;
  function noise(dur, freq, vol, opt) {
    if (!ac) return;
    opt = opt || {};
    if (!nb) { nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ac.currentTime + curAt + (opt.at || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nb; f.type = opt.type || 'bandpass'; f.frequency.setValueAtTime(freq, t);
    if (opt.q) f.Q.value = opt.q;
    if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(opt.bus || curBus || sfxBus); s.start(t, Math.random() * 0.7); s.stop(t + dur + 0.02);
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
  // 같은 소리의 동시 재생 상한. 유닛이 많으면 같은 무기 소리가 수십 개 겹쳐 오디오 노드만 늘고 귀로는 구분되지 않는다.
  // 같은 이름의 소리가 VOICE_MAX개 울리는 중이면 새 소리는 건너뛴다(다른 소리는 영향 없음). 끝나는 시각으로 세므로 콜백이 필요 없다.
  // max를 주면 그 수가 상한(평타 전체 'atk*', 스킬 층별 키 등).
  const VOICE_MAX = 4, voices = {};
  function voiceFull(key, end, max) {
    const now = ac.currentTime, v = (voices[key] || (voices[key] = [])).filter((e) => e > now);
    voices[key] = v;
    if (v.length >= (max || VOICE_MAX)) return true;
    v.push(end); return false;
  }
  // opt: at(지연) rate(재생 속도) jit(속도 흔들기, 기본 ±7%) dur(이 길이에서 30ms 페이드로 자름 — 긴 꼬리 제거)
  //      off(앞부분 건너뛰기, 초) lp/hp(저역·고역 통과 Hz) key·max(동시 재생 상한을 이름 대신 이 키로) bus
  //      pick(묶음 안의 몇 번째 녹음을 쓸지. 없으면 무작위 — 예: blunt 2 = 나무 찍는 소리 chop, shield 0 = 작은 나무 소리)
  function sample(name, vol, opt) {
    const list = buffers(name);
    if (!list || !list.length) return false;
    opt = opt || {};
    const t = ac.currentTime + curAt + (opt.at || 0), buf = list[opt.pick != null ? Math.min(opt.pick, list.length - 1) : (Math.random() * list.length) | 0];
    const j = opt.jit != null ? opt.jit : 0.07, rate = (opt.rate || 1) * (1 - j + Math.random() * j * 2);
    const off = Math.min(opt.off || 0, buf.duration * 0.5), len = Math.min(buf.duration - off, opt.dur || 99) / rate;
    if (voiceFull(opt.key || name, t + len, opt.max)) return true; // 건너뛰어도 true: 대신 합성음을 내지 않게
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = buf;
    s.playbackRate.value = rate;
    let node = s;
    if (opt.lp || opt.hp) { const f = ac.createBiquadFilter(); f.type = opt.lp ? 'lowpass' : 'highpass'; f.frequency.value = opt.lp || opt.hp; node.connect(f); node = f; }
    if (opt.dur) { g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + Math.max(0, len - 0.03)); g.gain.linearRampToValueAtTime(0.0001, t + len); }
    else g.gain.value = vol;
    node.connect(g); g.connect(opt.bus || curBus || sfxBus); s.start(t, off);
    if (opt.dur) s.stop(t + len + 0.01);
    return true;
  }
  // 묵직함을 더하는 낮은 '쿵'(큰 무기·타격에 겹친다). 이것도 같은 상한을 둔다
  const thump = (f, vol, at) => { if (ac && voiceFull('thump', ac.currentTime + curAt + (at || 0) + 0.14)) return; tone(f, 0.12, 'sine', vol, { to: f * 0.45, at: at || 0 }); };
  // 점점 커지는 소리(연출의 '뜸'): 음량이 0에서 vol까지 올라가다 끝에서 끊긴다. at: 시작 지연(초)
  function swell(dur, f0, f1, vol, kind, at) {
    if (!ac) return;
    const t = ac.currentTime + curAt + (at || 0), g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    g.connect(curBus || sfxBus);
    let src;
    if (kind === 'noise') {
      noise(0.001, 1000, 0.0001); // 잡음 버퍼 준비
      src = ac.createBufferSource(); src.buffer = nb; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      src.connect(f); f.connect(g);
    } else {
      src = ac.createOscillator(); src.type = kind || 'sawtooth'; src.frequency.setValueAtTime(f0, t); src.frequency.exponentialRampToValueAtTime(f1, t + dur);
      src.connect(g);
    }
    src.start(t); src.stop(t + dur + 0.1);
  }
  // 반짝이는 높은 음 몇 개(획득 순간의 '반짝')
  const sparkle = (n, base, vol, at) => { for (let i = 0; i < n; i++) tone(base * [1, 1.26, 1.5, 2, 2.52, 3][i % 6] * (1 + Math.random() * 0.02), 0.25, 'sine', vol, { at: (at || 0) + i * 0.035 }); };
  // 별이 박힐 때마다 한 음씩 올라간다(6·7성 등장)
  const STAR_NOTES = [523, 587, 659, 784, 880, 1046, 1175];
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
    // 책사·불 무기(2026-11-26 황개 소감 반영, skill-sfx.md 10절). 예전에는 넷 다 주문 녹음(magic1.wav 0.57초)을 속도만 바꿔 틀었다:
    // 불 0.8배속 = 0.71초짜리 음정 있는 주문 소리가 1초마다, 무작위 높낮이(±7%)로 최대 4개 겹쳐 음이 어긋난 화음처럼 울렸다.
    // 이제 다른 무기처럼 0.15초 안의 짧은 녹음(휘두름·나무)으로 만들고, 고역은 저역 통과로 깎는다. 동시 상한은 무기마다 따로(4개).
    // 부채: 가벼운 바람(검 휘두름을 조금 느리게, 3.5kHz 아래)
    // 렌더(2026-11-26): 0.4에서 −18.8dB → 창 평타(−13.8)에 맞춰 +4.5dB
    fan() { if (!sample('sword', 0.67, { rate: 0.85, lp: 3500, key: 'wFan' })) noise(0.1, 700, 0.12, { to: 1400 }); },
    // 벼락: 나무 '딱'(chop 녹음을 빠르게, 0.07초) + 짧게 내려가는 잡음(0.08초, 2kHz→600Hz)
    // 렌더(2026-11-26): 0.36에서 −19.9dB → +5.5dB
    thunder() { if (!sample('blunt', 0.68, { pick: 2, rate: 1.45, dur: 0.1, key: 'wThunder' })) noise(0.04, 2500, 0.15); noise(0.08, 2000, 0.09, { to: 600, q: 1 }); },
    // 불: 확 붙는 '후'(무거운 휘두름을 느리게, 1.8kHz 아래) + 저역 불기운 0.1초 + 두 번에 한 번 작은 나무 터짐
    flame() {
      if (!sample('heavy', 0.42, { rate: 0.78, lp: 1800, key: 'wFlame' })) noise(0.12, 500, 0.08, { type: 'lowpass', to: 200 });
      noise(0.1, 700, 0.05, { type: 'lowpass', to: 220, at: 0.01 });
      if (Math.random() < 0.5) sample('blunt', 0.16, { pick: 2, rate: 1.6, dur: 0.06, lp: 3500, at: 0.05, key: 'wPop', max: 3 });
    },
    // 지팡이: 휘두름 + 작은 나무 '톡'(3kHz 아래)
    // 렌더(2026-11-26): 0.42에서 −15.9dB → +1.5dB
    staff() { if (!sample('spear', 0.5, { rate: 0.9, lp: 3000, key: 'wStaff' })) noise(0.1, 800, 0.08, { to: 1600 }); sample('shield', 0.21, { pick: 0, rate: 1.1, dur: 0.08, lp: 3000, at: 0.03, key: 'wTap', max: 3 }); },
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
    // ---- 획득 연출 ----
    pop45() { tone(880, 0.12, 'triangle', 0.09); tone(1318, 0.16, 'triangle', 0.08, { at: 0.06 }); },
    gather() { swell(0.34, 220, 880, 0.12, 'triangle'); swell(0.34, 600, 4000, 0.1, 'noise'); },
    legendHit() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.9, 'triangle', 0.1, { at: i * 0.015 })); sparkle(6, 1568, 0.04, 0.05); noise(0.5, 6000, 0.05, { to: 2500 }); },
    rise() { swell(2.4, 300, 3800, 0.13, 'noise'); swell(2.4, 98, 392, 0.05, 'sawtooth'); },
    jackpot() {
      [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 1.6, 'triangle', 0.08, { at: i * 0.012 }));
      tone(65, 1.2, 'sine', 0.35, { to: 40 }); sparkle(12, 1318, 0.04, 0.08); noise(0.9, 7000, 0.06, { to: 3000 });
    },
    shimmer() { sparkle(4, 1046, 0.05); },
    pillar() { swell(0.32, 200, 1400, 0.16, 'noise'); thump(90, 0.3, 0.3); sparkle(6, 1318, 0.05, 0.3); },
    // 예전 신화·불멸 스킬 무게(2026-11-25부터 호출하는 곳 없음 — 등급 무게는 아래 스킬 소리 L.body가 명중 순간에 싣는다). 비교 듣기용으로 남김
    // 'skill'(주문 녹음 spell.wav)·'magic'(magic1.wav)은 2026-11-26부터 아무 데서도 안 쓴다(평타·스킬 모두 휘두름·나무 녹음으로 바꿈, skill-sfx.md 10절).
    // 아래 skill()은 비교 듣기용으로만 남김. sfxdata.js에서 두 묶음을 빼면 약 100KB 줄어든다(build-sfx.py GROUPS — 사용자 확인 뒤)
    skillHi() { thump(85, 0.32); noise(0.22, 400, 0.18, { type: 'lowpass', to: 80 }); },
    skillMax() { SFX.skillHi(); tone(70, 0.5, 'sine', 0.25, { to: 35, at: 0.02 }); tone(1245, 0.5, 'sine', 0.03, { at: 0.03 }); tone(622, 0.6, 'triangle', 0.05, { at: 0.03 }); },
  };
  STAR_NOTES.forEach((f, i) => { SFX['star' + i] = () => { tone(f, 0.22, 'triangle', 0.12); tone(f * 2, 0.14, 'sine', 0.04); thump(160, 0.12); }; });

  // ---- 장수 스킬 소리(2026-11-25, production/team/2026-11-25/skill-sfx.md) ----
  // 예전에는 모든 스킬이 'skill' 한 소리(주문 녹음 1.2초)였다. 이제 연출 이름(vx, theme-samguk.js SKILL_VX)마다 다른 소리를 낸다.
  // engine.js가 내는 이벤트: { s:'sk', vx, k, tier, fr, hit, dl }(시전 순간) · { s:'skb', vx, tier, hit }(원형 스킬이 터질 때).
  // 한 스킬 = 시전음(무기·손짓·기운) + 명중음(연출이 보스에 닿는 순간). 명중음은 앞 몇 ms 안에 가장 큰 타격(녹음 clash·blunt)과
  // 낮은 쿵(사인 하강)으로 시작하고 성격 층(불·번개·물·바람…)이 뒤에 붙는다. 꼬리는 0.6초 안으로 자른다.
  // 등급 무게 w: 7·8성 1, 신화 1.3, 불멸 1.6 — 쿵이 더 낮고 크고 길어진다. 치료·방어·강화에는 쿵을 넣지 않는다.
  const J = () => 0.97 + Math.random() * 0.06; // 합성음 높낮이를 조금씩 흔든다(같은 스킬을 반복해도 똑같지 않게)
  // 덕킹: 스킬이 맞는 순간(at초 뒤) 평타·일반 타격음 버스를 depth배로 줄였다가 len초에 걸쳐 되돌린다
  function duck(at, depth, len) {
    if (!atkBus) return;
    const now = ac.currentTime, t = now + curAt + Math.max(0, at), p = atkBus.gain, v = p.value;
    p.cancelScheduledValues(now); p.setValueAtTime(v, now);
    if (t > now) p.setValueAtTime(v, t);
    p.linearRampToValueAtTime(depth, t + 0.012); p.setValueAtTime(depth, t + len * 0.4); p.linearRampToValueAtTime(1, t + len);
  }
  // 소리 층(재료)
  const L = {
    // 명중 몸통: 녹음 타격 + 사인 쿵 + 저역 잡음. 신화는 더 낮은 울림, 불멸은 긴 땅울림을 더한다
    body(w, at) {
      sample('clash', 0.42 + 0.12 * w, { at, rate: 1.05 - 0.15 * w, dur: 0.28, key: 'skHit', max: 3 });
      tone(110 * J() / w, 0.12 + 0.08 * w, 'sine', 0.2 + 0.08 * w, { to: 40 / w, at });
      noise(0.07 + 0.05 * w, 300, 0.1 + 0.05 * w, { type: 'lowpass', to: 70, at });
      if (w > 1.1) tone(55 * J(), 0.25 + 0.2 * (w - 1), 'sine', 0.16 * w, { to: 28, at: at + 0.01 });
      if (w > 1.5) noise(0.5, 180, 0.1, { type: 'lowpass', to: 40, at: at + 0.02 });
    },
    // 바람 가르는 녹음(무기 휘두름). dur로 꼬리를 자른다
    whoosh(name, vol, at, rate, dur) { sample(name, vol, { at, rate, dur: dur || 0.3, key: 'skW', max: 4 }); },
    // 벼락 한 줄기: 아주 짧은 고역 '딱' + 찢어지며 내려가는 잡음
    crack(vol, at) { noise(0.025, 5000, vol, { type: 'highpass', at }); noise(0.14, 4200, vol * 0.7, { to: 700, at: at + 0.004 }); },
    rumble(dur, vol, at) { noise(dur, 160, vol, { type: 'lowpass', to: 45, at }); },
    // 불길(2026-11-26 황개 소감 반영): 확 붙는 '화륵'(무거운 휘두름 녹음을 느리게·1.6kHz 아래) + 짧은 저역 불기운(0.3초 안)
    // + 나무 터지는 '탁'(chop 녹음을 빠르게·3.5kHz 아래) 2~3번. 꼬리 0.35초 안.
    // 예전: 380→1400Hz 대역 잡음을 dur(최대 0.6초) 내내 + 2.5~6kHz 좁은 대역 '틱' 5번(긴 쉿 소리와 날카로운 고역)
    fire(dur, vol, at) {
      sample('heavy', Math.min(0.6, vol * 1.2), { at, rate: 0.62, lp: 1600, key: 'skF', max: 4 });
      const span = Math.min(0.3, dur * 0.6), n = dur > 0.4 ? 3 : 2;
      noise(span, 900, vol * 0.7, { type: 'lowpass', to: 180, at });
      for (let i = 0; i < n; i++) sample('blunt', Math.min(0.32, vol * 0.9), { pick: 2, at: at + 0.04 + (i + Math.random() * 0.6) * span / n, rate: 1.35 + Math.random() * 0.35, dur: 0.07, lp: 3500, key: 'skC', max: 6, jit: 0.04 });
    },
    // 물: 덮치는 물살(대역 잡음이 아래로) + 튀는 물(위로) + 낮은 출렁임
    water(vol, at) { noise(0.4, 1800, vol, { to: 300, at, q: 1.2 }); noise(0.3, 700, vol * 0.6, { to: 1500, at: at + 0.05 }); tone(150 * J(), 0.3, 'sine', vol * 0.8, { to: 70, at }); },
    // 바람: 좁은 대역 잡음이 f0에서 f1로 지나간다
    gust(dur, vol, at, f0, f1) { noise(dur, f0, vol, { to: f1, at, q: 2.5 }); },
    // 종 같은 울림(비정수 배음, 짧게)
    bell(f, vol, at, dur) { f *= J(); dur = dur || 0.5; tone(f, dur, 'sine', vol, { at }); tone(f * 2.76, dur * 0.55, 'sine', vol * 0.35, { at }); tone(f * 5.4, dur * 0.3, 'sine', vol * 0.15, { at }); },
    // 어두운 기운: 조금 어긋난 낮은 두 음이 미끄러져 내려가고 쉿 소리
    dark(vol, at, dur) { dur = dur || 0.45; tone(98, dur, 'triangle', vol, { to: 62, at }); tone(104, dur, 'triangle', vol * 0.8, { to: 58, at }); noise(dur * 0.8, 500, vol * 0.5, { to: 220, at }); },
    // 책사 기운(2026-11-26 황개 소감 반영). 예전: 주문 녹음(magic1.wav)을 0.6~1.3배속으로 0.4초(0.6배속이면 0.67초) — 평타 '불'과 같은 재료.
    // 이제: 부드러운 휘감김(무거운 휘두름 녹음, 저역 통과) + 밝은 쪽(rate ≥ 0.85)은 맑은 종 한 번(G4 또는 D5), 어두운 쪽은 낮은 삼각파 한 음. 0.35초 안
    magic(vol, at, rate) {
      const r = rate || 1, dk = r < 0.85;
      sample('heavy', vol * 1.1, { at, rate: dk ? 0.62 : 0.8, lp: dk ? 1400 : 2400, key: 'skM', max: 3 });
      if (dk) tone(147 * J(), 0.3, 'triangle', vol * 0.35, { to: 110, at });
      else L.bell(r > 1.1 ? 587 : 392, vol * 0.2, at + 0.02, 0.35);
    },
    // 말발굽(돌격): 낮은 쿵 n번
    hooves(n, vol, at) { for (let i = 0; i < n; i++) { tone(85 * J(), 0.07, 'sine', vol, { to: 50, at: at + i * 0.065 }); noise(0.03, 600, vol * 0.4, { at: at + i * 0.065 }); } },
    // 여러 개가 꽂힘(투척·화살): 짧은 타격 n번
    thunks(n, gapS, vol, at, rate) { for (let i = 0; i < n; i++) sample('blunt', vol, { at: at + i * gapS, rate: rate || 1.5, dur: 0.12, key: 'skT', max: 6 }); },
    // ---- 지원·버프용 재료(2026-11-25 음량 보정) ----
    // 렌더 측정(art_src/sfx_preview/index.md): 낮은 사인(100Hz 아래)·좁은 대역 잡음은 마스터 압축기에 눌려 설계값보다 8~10dB 작게 나왔고,
    // 녹음 샘플·중음(200Hz~1kHz) 음은 설계값 ±3dB로 나왔다. 그래서 지원 소리의 크기는 녹음과 중음으로 만든다.
    // 큰북: 둔탁한 녹음을 느리게(낮고 두껍게) + 짧은 저음
    drum(vol, at, rate) { sample('blunt', vol, { at, rate: rate || 0.6, dur: 0.35, key: 'skD', max: 4 }); tone(88 * J(), 0.22, 'sine', vol * 0.5, { to: 48, at }); },
    // 징: 비정수 배음이 길게 울림 + 채 치는 소리
    gong(f, vol, at, dur) { f *= J(); dur = dur || 0.9; tone(f, dur, 'triangle', vol, { to: f * 0.985, at }); tone(f * 2.41, dur * 0.7, 'sine', vol * 0.45, { at }); tone(f * 3.93, dur * 0.45, 'sine', vol * 0.25, { at }); noise(0.08, 900, vol * 0.6, { at }); },
    // 합창 비슷한 화음: 음마다 조금 어긋난 두 겹(삼각파)
    choir(fs, vol, at, dur) { dur = dur || 0.7; fs.forEach((f, i) => { tone(f, dur, 'triangle', vol, { at: at + i * 0.012 }); tone(f * 1.006, dur, 'triangle', vol * 0.7, { at: at + 0.01 + i * 0.012 }); }); },
  };
  // 연출이 보스 자리에 닿는 시각(초). fr = 보스까지 거리 / 스킬 길이(0~1). skillfx.js의 식(ease = 1-(1-q)², q = k·p)을 푼 값이다.
  // 연출 식이 바뀌면 같이 고친다(기준: production/team/2026-11-25/skill-fx-map.md, skill-sfx.md의 시점 표).
  const ez = (fr, k, life) => (1 - Math.sqrt(1 - Math.min(0.99, Math.max(0, fr)))) / k * life;
  // 새 연출(skill-fx-map.md)은 그 표의 '박자 검증' 값을 쓴다(앞머리가 나아가는 것은 ez, 정해진 박자는 그 값).
  const HIT_AT = {
    thrust: (fr) => ez(fr, 2.2, 0.5), sword: (fr) => ez(fr, 1.5, 0.5), crescent: (fr) => ez(fr, 1.3, 0.5), throw: (fr) => ez(fr, 2.2, 0.5),
    fireline: (fr) => ez(fr, 1.8, 0.5), windfire: (fr) => ez(fr, 1.4, 0.5), thunderline: (fr) => (0.3 * Math.min(3, Math.floor(fr * 4)) + 0.3) / 3 * 0.5,
    arrows: (fr) => ez(fr, 1.8, 0.42), charge: (fr) => ez(fr, 1.5, 0.42), claw: () => 0.06, blades: () => 0.05,
    // 아래는 skill-fx-map.md "박자 검증"(연출 담당이 skillfx.js 식에서 계산, 2026-11-25 저녁) 권장값
    heavensword: (fr) => ez(fr, 2.6, 0.5), royalstrike: () => 0.18, fireship: (fr) => ez(fr, 1.7, 0.5), breakout: () => 0.06, redhare: (fr) => ez(fr, 2.4, 0.5),
    snakespear: (fr) => ez(fr, 2.3, 0.5), comet: (fr) => ez(fr, 2.6, 0.5), ironcav: (fr) => ez(fr, 2, 0.5), surge: (fr) => ez(fr, 2.2, 0.5),
    halberds: (fr) => ez(fr, 2.2, 0.5), mountain: (fr) => ez(fr, 2, 0.5),
    tigercav: () => 0.25, twinsword: () => 0.07, divinebow: (fr) => ez(fr, 2.86, 0.42), spearfan: () => 0.15, repeater: (fr) => ez(fr, 2.22, 0.42),
  };
  // 원형(터진 순간 기준)·보스 대상 연출에서 가장 크게 터지는 시각(초). 없으면 0(터지는 순간). 박자 검증 표 기준
  const BLAST_AT = { wolfgaze: 0.3, flood: 0.2, bagua: 0.3, ghostplan: 0.3, twotigers: 0.25, snare: 0.18, expose: 0.27 };
  const HS = 0.03; // 혼자 할 때 스킬 명중 히트스톱(0.06초) 동안 연출이 멈추는 몫의 절반(협동은 멈춤이 없다)
  // vx별 소리. c = 시전음(직선·부채꼴·강화류), h(w, at) = 명중·폭발의 성격 층(몸통 L.body는 보스가 맞았을 때 따로 더한다)
  const SKS = {
    // 직선
    thrust: { c: () => { L.whoosh('spear', 0.6, 0, 0.85); noise(0.18, 900, 0.08, { to: 2600 }); }, h: (w, at) => sample('blunt', 0.4, { at, rate: 0.9, dur: 0.25, key: 'skT', max: 6 }) },
    sword: { c: () => { L.whoosh('sword', 0.55, 0, 1); L.whoosh('sword', 0.45, 0.07, 1.15); L.whoosh('sword', 0.4, 0.14, 1.3); }, h: (w, at) => { noise(0.06, 6000, 0.07, { type: 'highpass', at }); L.whoosh('sword', 0.35, at + 0.07, 1.2, 0.2); } },
    crescent: { c: () => { L.whoosh('heavy', 0.75, 0, 0.72, 0.45); noise(0.3, 260, 0.14, { to: 900 }); }, h: (w, at) => L.rumble(0.35, 0.16, at) },
    throw: { c: () => { L.whoosh('dagger', 0.5, 0, 1); L.whoosh('dagger', 0.42, 0.05, 1.12); L.whoosh('dagger', 0.36, 0.1, 1.25); }, h: (w, at) => L.thunks(5, 0.032, 0.32, at, 1.45) },
    fireline: { c: () => { L.whoosh('heavy', 0.4, 0, 0.8); noise(0.22, 180, 0.22, { type: 'lowpass', to: 900 }); }, h: (w, at) => L.fire(0.5, 0.15, at) },
    windfire: { c: () => swell(0.18, 500, 1800, 0.1, 'noise'), h: (w, at) => { L.gust(0.45, 0.16, at, 1600, 450); L.fire(0.35, 0.09, at + 0.05); } },
    thunderline: { c: () => noise(0.1, 5000, 0.05, { q: 3 }), h: (w, at) => { L.crack(0.22, at); L.crack(0.15, at + 0.1); L.crack(0.11, at + 0.2); L.rumble(0.55, 0.2, at); } },
    // 부채꼴
    arrows: { c: () => { L.whoosh('bow', 0.5, 0, 1.1); L.whoosh('bow', 0.42, 0.035, 1.2); L.whoosh('bow', 0.36, 0.07, 1); }, h: (w, at) => L.thunks(4, 0.035, 0.28, at, 1.7) },
    claw: { c: () => { L.whoosh('heavy', 0.6, 0, 0.7); tone(72, 0.28, 'sawtooth', 0.05, { to: 50 }); }, h: (w, at) => { noise(0.12, 2600, 0.1, { to: 1100, at }); sample('blunt', 0.45, { at, rate: 0.8, dur: 0.25, key: 'skT', max: 6 }); } },
    blades: { c: () => { L.whoosh('sword', 0.5, 0, 1); L.whoosh('heavy', 0.45, 0.06, 1.1); L.whoosh('sword', 0.4, 0.12, 1.2); }, h: (w, at) => sample('clash', 0.3, { at: at + 0.08, rate: 1.2, dur: 0.15, key: 'skHit', max: 3 }) },
    charge: { c: () => { L.hooves(4, 0.16, 0); noise(0.35, 220, 0.12, { type: 'lowpass', to: 90 }); }, h: (w, at) => { L.rumble(0.3, 0.15, at); sample('blunt', 0.5, { at, rate: 0.75, dur: 0.3, key: 'skT', max: 6 }); } },
    // 지점 폭발: 원형 스킬이 터질 때(skb), 보스에게 바로 거는 스킬(호통·이간·미인계·약화)
    burst: { h: (w, at) => L.magic(0.3, at, 0.9) },
    feint: { h: (w, at) => { noise(0.3, 900, 0.14, { to: 280, at }); L.crack(0.08, at); } },
    rune: { h: (w, at) => { L.magic(0.32, at, 0.8); L.bell(330, 0.07, at, 0.6); } },
    miasma: { h: (w, at) => { L.dark(0.1, at); noise(0.45, 650, 0.1, { to: 240, at }); } },
    fireblast: { h: (w, at) => { L.rumble(0.45, 0.28, at); L.fire(0.45, 0.14, at + 0.02); } },
    shock: { h: (w, at) => { tone(62, 0.35, 'sine', 0.32, { to: 30, at }); noise(0.16, 900, 0.16, { to: 200, at }); } },
    quake: { h: (w, at) => { tone(48, 0.5, 'sine', 0.36, { to: 26, at }); L.rumble(0.6, 0.32, at); sample('blunt', 0.5, { at, rate: 0.6, dur: 0.35, key: 'skT', max: 6 }); } },
    petals: { h: (w, at) => { sparkle(6, 1318, 0.04, at); L.magic(0.22, at, 1.3, 0.3); } },
    flood: { h: (w, at) => L.water(0.18, Math.max(0, at - 0.1)) }, // 물살이 0.1초 먼저 밀려오고 물기둥(at)에 몸통이 꽂힌다
    lightning: { h: (w, at) => { L.crack(0.26, at); L.crack(0.14, at + 0.08); L.rumble(0.6, 0.24, at + 0.02); } },
    storm: { h: (w, at) => { for (let i = 0; i < 5; i++) L.whoosh(i % 2 ? 'heavy' : 'sword', 0.42, at + i * 0.045, 1 + i * 0.06, 0.22); sample('clash', 0.35, { at: at + 0.14, rate: 1.1, dur: 0.18, key: 'skHit', max: 3 }); } },
    // 장비 장판교 호통(상징 기술, 목표 −7.5dB): 함성(넓은 대역 잡음 + 톱니 목소리) + 큰북 + 징
    roar: { h: (w, at) => { noise(0.45, 380, 0.9, { to: 170, at, q: 1.2 }); tone(190, 0.45, 'sawtooth', 0.08, { to: 150, at }); L.drum(0.5, at); L.gong(110, 0.2, at + 0.02, 0.9); } },
    // 렌더(2026-11-26): −16.0dB → +3dB(기운 0.36→0.51, 어두운 음 0.1→0.14)
    scheme: { h: (w, at) => { L.magic(0.51, at, 0.7); L.dark(0.14, at, 0.35); } },
    hearts: { h: (w, at) => { sparkle(6, 1175, 0.12, at); [784, 988, 1175].forEach((f, i) => tone(f, 0.35, 'triangle', 0.14, { at: at + i * 0.05 })); L.bell(1175, 0.1, at, 0.5); } },
    // 렌더(2026-11-26): −14.4dB → +1dB
    curse: { h: (w, at) => { L.dark(0.22, at, 0.5); L.magic(0.39, at, 0.6); } },
    knives: { h: (w, at) => L.thunks(6, 0.03, 0.45, at, 1.6) },
    // 자기·아군 강화: 시전 한 번, 폭발 쿵 없음. 목표 최대: 지원 −11dB(−10~−14), 신화·불멸의 버프 −7.5dB(−6~−9) — skill-sfx.md 9절 표
    // 순욱 구호탄랑(신화 버프): 차오름 + 오르는 음 → 0.2초 큰북·종
    power: { c: () => { swell(0.22, 300, 1800, 0.25, 'noise'); tone(160, 0.35, 'triangle', 0.22, { to: 320 }); L.drum(0.6, 0.2); L.bell(523, 0.16, 0.2, 0.5); } },
    guard: { c: () => { L.bell(523, 0.15, 0, 0.6); tone(196, 0.4, 'triangle', 0.15); } },
    heal: { c: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.5, 'sine', 0.21, { at: i * 0.06 })); sparkle(4, 1568, 0.07, 0.12); } },
    rally: { c: () => { [0, 0.16].forEach((a) => { tone(92, 0.22, 'sine', 0.35, { to: 50, at: a }); noise(0.06, 400, 0.2, { at: a }); sample('blunt', 0.3, { at: a, rate: 0.7, dur: 0.2, key: 'skD', max: 4 }); }); tone(220, 0.45, 'sawtooth', 0.07, { to: 233, at: 0.04 }); } },
    // 맹획 진영 사수: 고함(넓은 대역 잡음 + 톱니 목소리) + 북
    taunt: { c: () => { noise(0.35, 420, 0.7, { to: 200, q: 1.2 }); tone(160, 0.4, 'sawtooth', 0.1, { to: 120 }); L.drum(0.4, 0); } },
    // 조인 팔문금쇄 방진: 종 + 낮은 음 + 방패 세우는 소리(쿵 대신)
    barrier: { c: () => { L.bell(392, 0.2, 0, 0.7); tone(131, 0.5, 'triangle', 0.22); sample('shield', 0.5, { rate: 0.85, dur: 0.25, key: 'skT', max: 8 }); } },
    // 조조 사기 진작(불멸 버프): 큰 바람 녹음 + 돌풍 + 북
    wind: { c: () => { L.whoosh('heavy', 0.6, 0, 0.7, 0.45); L.gust(0.45, 0.5, 0, 600, 2400); L.drum(0.4, 0); } },
    // 손권 합비 사수: 종 + 방패 + 튀는 전류
    reflect: { c: () => { L.bell(659, 0.27, 0, 0.4); sample('shield', 0.65, { rate: 1.2, dur: 0.2, key: 'skT', max: 8 }); L.crack(0.2, 0.04); for (let i = 0; i < 3; i++) noise(0.03, 4500, 0.3, { at: 0.04 + i * 0.05, q: 3 }); } },
    // 장각 태평 전군 치료(새 vx talisman): 부적 펄럭임 + 맑은 종 둘 + 화음, 아주 작은 전기 '딱'
    talisman: { c: () => { noise(0.3, 3000, 0.25, { to: 1500, q: 1.5 }); L.bell(659, 0.14, 0, 0.6); L.bell(880, 0.1, 0.12, 0.5); [440, 554, 659].forEach((f) => tone(f, 0.5, 'triangle', 0.1, { at: 0.2 })); L.crack(0.1, 0.15); } },

    // ---- 새 연출 이름(skill-fx-map.md 확정본). 박자는 그 표의 '연출 박자' ----
    // 직선
    heavensword: { c: () => { L.whoosh('heavy', 0.6, 0, 0.8, 0.35); L.whoosh('sword', 0.4, 0.03, 1.1); }, h: (w, at) => { noise(0.05, 6500, 0.08, { type: 'highpass', at }); L.bell(880, 0.04, at + 0.02, 0.35); } },
    royalstrike: { c: () => L.whoosh('spear', 0.5, 0, 0.9), h: (w, at) => { [at - 0.18, at - 0.09].forEach((t) => { tone(95 * J(), 0.1, 'sine', 0.2, { to: 50, at: Math.max(0, t) }); sample('blunt', 0.3, { at: Math.max(0, t), rate: 1.1, dur: 0.15, key: 'skT', max: 6 }); }); noise(0.2, 1200, 0.1, { to: 400, at }); } },
    fireship: { c: () => { noise(0.3, 220, 0.12, { type: 'lowpass', to: 600 }); swell(0.3, 200, 900, 0.08, 'noise'); }, h: (w, at) => { L.fire(0.5, 0.16, at); L.rumble(0.3, 0.14, at); } },
    breakout: { c: () => { L.whoosh('spear', 0.55, 0, 0.95); L.hooves(2, 0.12, 0); }, h: (w, at) => { for (let i = 0; i < 3; i++) { sample('blunt', 0.38 - i * 0.05, { at: at + i * 0.065, rate: 1 + i * 0.1, dur: 0.18, key: 'skT', max: 6 }); L.whoosh('sword', 0.3, Math.max(0, at + i * 0.065 - 0.03), 1.1 + i * 0.05, 0.15); } } },
    redhare: { c: () => { L.hooves(4, 0.16, 0); L.fire(0.3, 0.08, 0.05); }, h: (w, at) => { L.rumble(0.25, 0.14, at); sample('blunt', 0.45, { at, rate: 0.8, dur: 0.25, key: 'skT', max: 6 }); } },
    snakespear: { c: () => { L.whoosh('spear', 0.65, 0, 0.8); noise(0.15, 700, 0.08, { to: 2000 }); }, h: (w, at) => sample('blunt', 0.45, { at, rate: 0.85, dur: 0.25, key: 'skT', max: 6 }) },
    comet: { c: () => { L.whoosh('spear', 0.5, 0, 1.1); noise(0.25, 3000, 0.06, { to: 7000, q: 2 }); }, h: (w, at) => { sparkle(5, 1568, 0.035, at); sample('blunt', 0.35, { at, rate: 1, dur: 0.2, key: 'skT', max: 6 }); } },
    ironcav: { c: () => { L.hooves(5, 0.18, 0); noise(0.4, 200, 0.12, { type: 'lowpass', to: 80 }); }, h: (w, at) => { sample('blunt', 0.5, { at, rate: 0.75, dur: 0.3, key: 'skT', max: 6 }); L.rumble(0.3, 0.15, at); } },
    surge: { c: () => L.gust(0.35, 0.12, 0, 900, 300), h: (w, at) => L.water(0.14, at) },
    halberds: { c: () => { for (let i = 0; i < 3; i++) L.whoosh('heavy', 0.45, i * 0.07, 0.95 + i * 0.05, 0.25); }, h: (w, at) => L.thunks(3, 0.07, 0.38, at, 1.1) },
    mountain: { c: () => { noise(0.3, 400, 0.12, { to: 1200 }); L.whoosh('spear', 0.4, 0, 0.9); }, h: (w, at) => { L.rumble(0.3, 0.16, at); L.thunks(4, 0.03, 0.2, at, 1.3); } },
    // 부채꼴
    tigercav: { c: () => { L.hooves(4, 0.18, 0); noise(0.3, 220, 0.12, { type: 'lowpass', to: 90 }); }, h: (w, at) => { L.rumble(0.3, 0.18, at); sample('blunt', 0.5, { at, rate: 0.7, dur: 0.3, key: 'skT', max: 6 }); } },
    twinsword: { c: () => { L.whoosh('sword', 0.5, 0, 1); L.whoosh('sword', 0.45, 0.04, 1.15); }, h: (w, at) => sample('clash', 0.3, { at: at + 0.04, rate: 1.15, dur: 0.15, key: 'skHit', max: 3 }) },
    divinebow: { c: () => { for (let i = 0; i < 5; i++) L.whoosh('bow', 0.4, i * 0.042, 1.15 + i * 0.03, 0.2); }, h: (w, at) => { L.thunks(5, 0.042, 0.25, at, 1.8); sparkle(3, 1760, 0.025, at); } },
    // 조인 철기 반격: 창이 0.15초에 가장 뻗으므로 내찌르는 쓸림을 0.05초부터 작게(0.25) 시작해 명중(몸통)으로 이어지게 한다(2차 렌더 off −100 보정)
    spearfan: { c: () => { for (let i = 0; i < 3; i++) L.whoosh('spear', 0.25, 0.05 + i * 0.015, 0.9 + i * 0.08, 0.2); }, h: (w, at) => L.thunks(3, 0.015, 0.3, at, 1.2) },
    repeater: { c: () => { [0, 0.063, 0.126].forEach((t) => L.whoosh('bow', 0.42, t, 1.25, 0.2)); }, h: (w, at) => { [0, 0.063, 0.126].forEach((t) => L.thunks(2, 0.02, 0.24, at + t, 1.7)); } },
    // 원형이 터진 뒤(at = BLAST_AT, 그 전은 빨려듦·차오름)
    wolfgaze: { h: (w, at) => { swell(at, 1800, 300, 0.08, 'noise'); L.dark(0.08, 0, at); tone(55, 0.45, 'sine', 0.3, { to: 28, at }); noise(0.35, 400, 0.14, { to: 150, at }); } },
    bagua: { h: (w, at) => { for (let i = 0; i < 8; i++) L.bell(523 * [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5][i], 0.035, i * 0.021, 0.25); noise(0.12, 5000, 0.07, { type: 'highpass', at: Math.max(0, at - 0.12) }); L.bell(262, 0.06, at, 0.6); } },
    chainblast: { h: (w, at) => { [0, 0.12, 0.24].forEach((t, i) => { L.rumble(0.35, 0.22 - i * 0.03, at + t); L.fire(0.25, 0.1, at + t); tone(70, 0.25, 'sine', 0.25, { to: 35, at: at + t }); }); } },
    ghostplan: { h: (w, at) => { [0, 0.08, 0.16].forEach((t) => tone((680 + Math.random() * 80), 0.25, 'sine', 0.03, { to: 1100, at: t })); swell(Math.max(0.1, at - 0.02), 400, 1600, 0.05, 'noise'); L.magic(0.3, at, 0.85); noise(0.2, 2500, 0.08, { to: 600, at }); } },
    twotigers: { h: (w, at) => { swell(at, 300, 1200, 0.06, 'noise'); swell(at, 500, 1500, 0.05, 'noise'); tone(80, 0.3, 'sine', 0.3, { to: 40, at }); noise(0.2, 1200, 0.14, { to: 300, at }); tone(110, 0.25, 'sawtooth', 0.04, { to: 70, at }); } },
    bellow: { h: (w, at) => { noise(0.45, 380, 0.18, { to: 170, at, q: 1.5 }); [0, 0.1, 0.2].forEach((t, i) => tone(62, 0.3, 'sine', 0.3 - i * 0.07, { to: 30, at: at + t })); } },
    musang: { h: (w, at) => { for (let i = 0; i < 8; i++) L.whoosh(i % 2 ? 'heavy' : 'sword', 0.4, at + i * 0.055, 0.95 + (i % 4) * 0.06, 0.2); [0.2, 0.42].forEach((t) => sample('clash', 0.28, { at: at + t, rate: 1.15, dur: 0.15, key: 'skHit', max: 3 })); } },
    // 보스에 거는 것(at = BLAST_AT)
    snare: { h: (w, at) => { [0, 0.06].forEach((t) => { noise(0.06, 4200, 0.2, { at: t, q: 3 }); L.crack(0.14, t); }); sample('blunt', 0.4, { at, rate: 0.9, dur: 0.2, key: 'skT', max: 6 }); noise(0.15, 2500, 0.15, { to: 900, at }); } },
    expose: { h: (w, at) => { swell(Math.max(0.1, at - 0.05), 600, 2400, 0.05, 'noise'); [0.1, 0.2].forEach((t) => tone(1200, 0.05, 'sine', 0.04, { at: t })); sample('blunt', 0.4, { at, rate: 1.3, dur: 0.15, key: 'skT', max: 6 }); tone(1568, 0.2, 'sine', 0.04, { at }); } },
    // 자기·아군 강화
    // 사마의 농성 대기: 연기 휘감는 녹음(느리게) + 어두운 두 음 + 숨결
    shroud: { c: () => { L.whoosh('heavy', 0.5, 0, 0.6, 0.5); noise(0.6, 500, 0.3, { to: 250, q: 0.7 }); L.dark(0.12, 0, 0.5); } },
    // 유비 인덕의 전군 치료: 밝은 화음(G·B·D) + 반짝임
    virtue: { c: () => { [392, 494, 587].forEach((f, i) => tone(f, 0.7, 'triangle', 0.2, { at: i * 0.04 })); sparkle(5, 1760, 0.06, 0.1); } },
    // 유비 오호 소집(불멸 버프): 다섯 음 차례로 → 0.5초 큰북·징·화음
    fivetigers: { c: () => { [392, 440, 523, 587, 659].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, { at: i * 0.09 })); L.drum(0.5, 0.5); L.gong(131, 0.12, 0.5, 0.9); [523, 659, 784].forEach((f) => tone(f, 0.5, 'sine', 0.08, { at: 0.5 })); } },
    lonesword: { c: () => { L.whoosh('heavy', 0.75, 0, 0.85, 0.4); tone(147, 0.4, 'triangle', 0.12); } },
    // 제갈량 칠성단: 종 일곱 → 0.5초 화음
    sevenstar: { c: () => { for (let i = 0; i < 7; i++) L.bell(784 * [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25][i], 0.07, i * 0.065, 0.3); [523, 659, 784].forEach((f) => tone(f, 0.6, 'sine', 0.1, { at: 0.5 })); } },
    // 손권 용인술(불멸 버프): 인장 찍는 큰북 + 징 + 인장 넷 날아감
    dispatch: { c: () => { L.drum(0.45, 0); L.gong(165, 0.12, 0.02, 0.7); noise(0.05, 600, 0.15); for (let i = 0; i < 4; i++) L.whoosh('dagger', 0.45, 0.1 + i * 0.02, 1.2 + i * 0.05, 0.2); } },
    // 주유 곡조 비기(불멸 버프): 현 뜯는 세 박(낮은 현 + 높은 현 + 뜯는 소리)
    melody: { c: () => { [0, 0.25, 0.5].forEach((t, i) => { const f = [220, 262, 330][i]; tone(f, 0.5, 'triangle', 0.25, { at: t }); tone(f / 2, 0.6, 'triangle', 0.15, { at: t }); tone(f * 2, 0.3, 'sine', 0.08, { at: t }); noise(0.12, 2500, 0.08, { at: t + 0.02 }); }); } },
    // 태사자 신의의 맹세(불멸 버프): 빛기둥 차오름 → 0.3초 큰북·종·합창
    oath: { c: () => { swell(0.3, 300, 2200, 0.25, 'noise'); tone(196, 0.45, 'triangle', 0.2, { to: 392 }); L.bell(784, 0.15, 0.3, 0.5); L.drum(0.45, 0.3); L.choir([392, 494, 587], 0.06, 0.3, 0.6); } },
    // 여포 천하무쌍(상징 기술): 큰 불길 + 큰북 + 낮은 징 + 으르렁
    // 2026-11-26: 불길이 녹음 휘두름을 품어 커졌으므로 0.45→0.38, 으르렁은 톱니파 → 삼각파(0.1→0.14)
    peerless: { c: () => { L.fire(0.6, 0.38, 0); L.drum(0.5, 0); L.gong(98, 0.22, 0.03, 1); tone(82, 0.5, 'triangle', 0.14, { to: 60 }); } },
    // 곽가 요절의 예지: 안개 쓸림 녹음(빠르게) + 숨결 + 반짝 + 종
    // 렌더(2026-11-26): −14.4dB → +1dB(휘두름 녹음 0.7→0.8, 종 0.14→0.16. 숨결 잡음은 안 키움)
    mist: { c: () => { L.whoosh('heavy', 0.8, 0, 1.2, 0.4); noise(0.6, 1200, 0.35, { to: 600, q: 0.6 }); sparkle(3, 1568, 0.1, 0.15); L.bell(1046, 0.16, 0.1, 0.5); } },
    eightlock: { c: () => { for (let i = 0; i < 8; i++) sample('shield', 0.3, { at: i * 0.035, rate: 0.9 + i * 0.03, dur: 0.15, key: 'skT', max: 8 }); thump(120, 0.2, 0.3); } },
    imperial: { c: () => { [0, 0.1, 0.2, 0.3].forEach((t) => tone(110, 0.25, 'sine', 0.32, { to: 70, at: t })); L.bell(392, 0.11, 0.4, 0.6); } },
    spearspin: { c: () => { [0, 0.13, 0.26].forEach((t, i) => L.whoosh('spear', 0.38, t, 1 + i * 0.08, 0.2)); tone(196, 0.4, 'triangle', 0.05); } },
    // 마초 금마초의 위용(신화 버프): 밝은 합창 + 포효 + 큰북 + 반짝
    goldlion: { c: () => { L.choir([392, 494, 587], 0.09, 0, 0.7); noise(0.35, 380, 0.5, { to: 170, q: 1.2 }); L.drum(0.45, 0); sparkle(4, 1568, 0.05, 0.1); } },
    // 육손 인내의 진(신화 버프): 불길 + 불고리 쓸림 녹음 + 돌풍 + 북
    // 2026-11-26: 불길 안에 휘두름 녹음(0.6)이 들어가서 따로 겹치던 휘두름(0.55)은 뺐다(크기 그대로 유지)
    firering: { c: () => { L.fire(0.5, 0.5, 0); L.gust(0.4, 0.3, 0, 400, 1200); L.drum(0.35, 0); } },
    bulwark: { c: () => { sample('shield', 0.65, { rate: 0.75, dur: 0.3, key: 'skT', max: 8 }); thump(95, 0.3); noise(0.3, 300, 0.12, { type: 'lowpass', to: 90 }); } },
    // 손견 강동 호령: 발톱 셋 + 쓸림 녹음 + 으르렁
    tiger: { c: () => { [0, 0.1, 0.2].forEach((t) => noise(0.1, 2600, 0.7, { to: 1000, at: t })); L.whoosh('heavy', 0.5, 0, 0.8, 0.3); tone(85, 0.4, 'sawtooth', 0.16, { to: 60 }); noise(0.4, 300, 0.6, { to: 160, q: 1.5 }); } },
    // 손상향 비연보: 활 쓸림 + 칼 쓸림(빠르게) + 높은 바람
    swallow: { c: () => { L.gust(0.25, 0.55, 0, 1500, 4500); L.whoosh('bow', 0.95, 0, 1.3, 0.2); L.whoosh('sword', 0.65, 0.05, 1.4, 0.2); } },
  };
  const skW = (tier) => (tier >= 10 ? 1.6 : tier >= 9 ? 1.3 : 1);
  const AT_BOSS = { roar: 1, delay: 1, charm: 1, weaken: 1 };
  // 스킬이 맞았을 때: 몸통을 더하고 평타를 잠깐 줄이고, 같은 순간 피해 숫자가 내는 일반 'hit'은 150ms 동안 막는다(겹쳐 뭉개지지 않게)
  function skLand(w, at) { L.body(w, at); duck(at, 0.35, 0.32); last.hit = performance.now() + 150 + at * 1000; }
  SFX.sk = (o) => {
    const r = SKS[o.vx] || {}, w = skW(o.tier || 0);
    if (o.k === 'line' || o.k === 'cone') {
      const dflt = SKS[o.k === 'line' ? 'thrust' : 'blades'];
      (r.c || dflt.c)();
      // 빗나가면 연출 끝(fr 1)에 성격 층만 낸다
      const at = (HIT_AT[o.vx] || HIT_AT.thrust)(o.hit ? o.fr || 0 : 1) + (o.hit ? HS : 0);
      (r.h || dflt.h)(w, at);
      if (o.hit) skLand(w, at);
    } else if (o.k === 'circle') {
      // 원형: 짧은 손짓 + 터질 때까지 차오르는 소리. 터지는 소리는 skb가 낸다
      // 2026-11-26: 손짓을 주문 녹음(spell.wav, 평타 '불'과 같은 주문 계열)에서 휘두름 녹음으로, 차오름 끝 높이를 2.2~2.6kHz → 1.3~1.5kHz로 낮춤(쉿 소리 줄임)
      sample('heavy', 0.3, { rate: 0.85, lp: 2400, key: 'skM', max: 3 });
      swell(Math.max(0.15, (o.dl || 0.5) * 0.9), 300, 1000 + 300 * w, 0.05 + 0.02 * w, 'noise');
    } else if (AT_BOSS[o.k]) (r.h || SKS.burst.h)(w, BLAST_AT[o.vx] || 0);
    else (r.c || SKS.guard.c)(); // 표에 없는 지원 연출은 지원 크기(−11dB)의 기본 소리
  };
  SFX.skb = (o) => {
    const r = SKS[o.vx] || SKS.burst, w = skW(o.tier || 0), at = BLAST_AT[o.vx] || 0;
    (r.h || SKS.burst.h)(w, at);
    if (o.hit) skLand(w, at);
  };
  // 평타 무기음은 atkBus로 보내고(일반 타격음 'hit'도), 무기 종류를 다 합쳐 동시 ATK_MAX개까지만 낸다(무기별 4개 상한은 그대로).
  const ATK = { bow: 1, crossbow: 1, sword: 1, twin: 1, dagger: 1, spear: 1, lance: 1, serpent: 1, halberd: 1, guandao: 1, axe: 1, mace: 1, shield: 1, fan: 1, thunder: 1, flame: 1, staff: 1 }, ATK_MAX = 8;
  // o: 소리에 넘길 값(스킬 이벤트). o.at이 있으면 그만큼 늦게 시작한다(최대 2초).
  function play(name, gap, o) {
    if (!ac || !SFX[name] || st.sfx <= 0) return;
    const now = performance.now();
    if (now - (last[name] || 0) < (gap || 60)) return;
    if (ATK[name] && voiceFull('atk*', ac.currentTime + 0.3, ATK_MAX)) return;
    last[name] = now;
    curAt = Math.max(0, Math.min(2, (o && o.at) || 0)); curBus = ATK[name] || name === 'hit' ? atkBus : null;
    try { SFX[name](o || {}); } catch (e) { /* 소리 하나가 실패해도 게임은 이어진다 */ } finally { curAt = 0; curBus = null; }
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
  // ---- 녹음된 배경음 ----
  // 라인: 5곡을 섞어 차례로 튼다(한 바퀴 돌 때까지 같은 곡이 다시 나오지 않는다). 보스전: 2곡을 번갈아 튼다.
  // 보스전이 끝나면 라인 곡은 멈췄던 자리에서 이어진다. 곡 파일을 못 읽으면 예전 합성 장단으로 대신한다.
  const LIST = { lane: ['lane_shenyang', 'lane_eastminster', 'lane_tearoots', 'lane_opium', 'lane_dragon'], boss: ['boss_lord', 'boss_drums'] };
  const MUS_GAIN = 1.6, queue = { lane: [], boss: [] }, lastOf = {};
  let mus = { lane: null, boss: null }, musOk = typeof Audio !== 'undefined';
  function nextName(kind) {
    if (!queue[kind].length) {
      const q = LIST[kind].slice();
      for (let i = q.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [q[i], q[j]] = [q[j], q[i]]; }
      if (q.length > 1 && q[0] === lastOf[kind]) q.push(q.shift());
      queue[kind] = q;
    }
    return (lastOf[kind] = queue[kind].shift());
  }
  function fade(m, to, sec) {
    const t = ac.currentTime;
    m.g.gain.cancelScheduledValues(t); m.g.gain.setValueAtTime(m.g.gain.value, t); m.g.gain.linearRampToValueAtTime(to, t + sec);
  }
  function dropTrack(m) {
    try { m.el.pause(); m.src.disconnect(); m.g.disconnect(); } catch (e) { /* 이미 끊김 */ }
    m.el.removeAttribute('src'); try { m.el.load(); } catch (e) { /* 무시 */ }
  }
  function newTrack(kind) {
    const el = new Audio('bgm/' + nextName(kind) + '.mp3'), g = ac.createGain(), m = { el, g, kind };
    el.preload = 'auto'; g.gain.value = 0;
    m.src = ac.createMediaElementSource(el); m.src.connect(g); g.connect(bgmBus);
    // 곡이 끝나면 다음 곡으로. 끝난 곡은 오디오 연결을 끊고 파일을 놓는다(한 판에 10곡쯤 쌓이던 누수)
    el.addEventListener('ended', () => { if (mus[kind] === m) { mus[kind] = null; dropTrack(m); if ((boss ? 'boss' : 'lane') === kind) music(); } });
    el.addEventListener('error', () => { if (mus[kind] === m) { mus[kind] = null; dropTrack(m); musOk = false; startBgm(); } });
    return m;
  }
  // 지금 상황(라인/보스전)에 맞는 곡을 틀고, 다른 쪽 곡은 서서히 줄여 멈춘다
  function music() {
    if (!ac || !musOk) return false;
    const kind = boss ? 'boss' : 'lane', other = boss ? 'lane' : 'boss';
    const o = mus[other];
    if (o) {
      fade(o, 0, 0.8);
      // 보스 곡은 끝내고(다음 보스전은 다른 곡), 라인 곡은 멈춰 두었다가 이어 튼다
      setTimeout(() => { if (mus[other] !== o || (boss ? 'boss' : 'lane') === other) return; o.el.pause(); if (other === 'boss') { mus.boss = null; dropTrack(o); } }, 900);
    }
    let m = mus[kind];
    if (!m) m = mus[kind] = newTrack(kind);
    if (st.bgm > 0 && !hiddenNow) { const pr = m.el.play(); if (pr && pr.catch) pr.catch(() => {}); }
    fade(m, MUS_GAIN, 1.5);
    return true;
  }
  let hiddenNow = false;
  function startBgm() {
    clearInterval(bgmTimer); bgmTimer = null;
    if (music()) return;
    bgmTimer = setInterval(beat, boss ? 170 : 270);
  }
  // 앱을 내리면 소리를 멈추고, 돌아오면 이어 튼다
  // 브라우저의 visibilitychange와 앱의 appStateChange(native.js가 'rtd-appstate'로 넘긴다) 둘 다 받는다. 겹쳐 와도 한 번만 처리한다.
  function setHidden(h) {
    if (hiddenNow === h) return;
    hiddenNow = h;
    if (!ac) return;
    const m = mus[boss ? 'boss' : 'lane'];
    if (hiddenNow) { if (m) m.el.pause(); if (ac.suspend) ac.suspend(); }
    else { if (ac.resume) ac.resume(); if (m && st.bgm > 0) { const pr = m.el.play(); if (pr && pr.catch) pr.catch(() => {}); } }
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => setHidden(document.hidden));
  if (typeof window !== 'undefined') window.addEventListener('rtd-appstate', (e) => setHidden(!(e.detail && e.detail.active)));
  root.RTD_AUDIO = {
    init, play, state: st,
    // 지금 나오는 곡(확인용)
    nowPlaying() { const m = mus[boss ? 'boss' : 'lane']; return m ? { src: m.el.src.split('/').pop(), t: m.el.currentTime, paused: m.el.paused, gain: m.g.gain.value } : null; },
    setBoss(on) { if (boss !== on) { boss = on; if (ac) startBgm(); } },
    setSfx(v) { st.sfx = v; if (sfxBus) sfxBus.gain.value = v; },
    setBgm(v) {
      st.bgm = v; if (bgmBus) bgmBus.gain.value = v;
      // 음량 0이면 곡을 멈춰 두고(배터리), 다시 올리면 이어 튼다
      const m = mus[boss ? 'boss' : 'lane'];
      if (m) { if (v <= 0) m.el.pause(); else { const pr = m.el.play(); if (pr && pr.catch) pr.catch(() => {}); } }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
