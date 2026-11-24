  // ---- 악몽 +N 변형 규칙 등장 연출 ----
  // 판이 시작될 때 이번 판의 규칙을 검은 반투명 막 위에 하나씩 도장 찍듯 보여 준다(규칙은 시작 버튼을 누를 때 정해진다. 19-title rollMuts).
  // 연출 동안 S.mutHold로 계산을 멈춘다(협동 통신 tickStatus는 계속 돈다 — 17-loop tick). 화면을 누르거나 키를 누르면 건너뛴다.
  // 그림: 판 틀 gfx/ui_c_tablet.png, 제목 붓자국 gfx/ui_ink.png(기존 UI 그림). 쾅 소리는 audio.js의 둔기 타격음 'mace'.
  // 시간(초): 막이 깔리고 첫 도장까지, 도장 간격, 찍힘이 닿는 순간(애니메이션 길이 .34초의 70%), 다 찍힌 뒤 머무름, 걷힘
  const MI = { first: 0.65, gap: 0.55, hit: 0.24, hold: 1.4, out: 0.4, skipOut: 0.18 };
  let miRun = null;
  function mutIntro(game) {
    if (miRun) miRun.end(true);
    const muts = (game && game.muts) || [];
    if (!muts.length) return;
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let el = $('mutintro');
    if (!el) { el = document.createElement('div'); el.id = 'mutintro'; el.setAttribute('role', 'dialog'); document.body.appendChild(el); }
    el.className = muts.length > 2 ? 'two' : '';
    el.innerHTML = `<div class="mi-box"><div class="mi-head"><b>${esc(I.t('mutHead', { n: game.mutLv || muts.length }))}</b></div>`
      + `<div class="mi-list">${muts.map((m, i) => `<div class="mi-card"><span class="n">${i + 1}</span><b>${esc(m.name)}</b><div class="gb"><span class="g">＋ ${esc(m.good)}</span><span class="bd">－ ${esc(m.bad)}</span></div></div>`).join('')}</div></div>`
      + `<div class="mi-skip">${esc(I.t('mutSkip'))}</div>`;
    el.hidden = false; el.classList.remove('out');
    S.mutHold = true;
    // '같은 설정으로 다시'는 로딩 화면(#boot)이 걷히는 동안(.45초) 판이 시작되므로, 첫 도장을 그만큼 늦춘다
    const B = $('boot'), d0 = B && !B.hidden ? 0.45 : 0;
    const cards = el.querySelectorAll('.mi-card'), timers = [];
    const later = (sec, fn) => timers.push(setTimeout(fn, sec * 1000));
    const run = {
      end(now) {
        if (miRun !== run) return;
        miRun = null; timers.forEach(clearTimeout);
        window.removeEventListener('keydown', onKey, true); el.removeEventListener('pointerdown', onTap);
        S.mutHold = false; last = performance.now(); acc = 0; // 멈춘 시간을 한꺼번에 따라잡지 않게
        $('app').classList.remove('mi-shake');
        el.classList.add('out');
        setTimeout(() => { if (!miRun) { el.hidden = true; el.innerHTML = ''; } }, (now ? MI.skipOut : MI.out) * 1000);
        dirty();
      },
    };
    const onTap = (e) => { e.preventDefault(); e.stopPropagation(); run.end(true); };
    const onKey = (e) => { e.preventDefault(); e.stopPropagation(); run.end(true); };
    el.addEventListener('pointerdown', onTap);
    window.addEventListener('keydown', onKey, true);
    miRun = run;
    cards.forEach((c, i) => {
      const at = d0 + MI.first + i * MI.gap;
      later(at, () => { c.classList.add('on'); });
      later(at + (reduce ? 0 : MI.hit), () => {
        Snd.play('mace', 0);
        if (reduce) return;
        const a = $('app'); a.classList.remove('mi-shake'); void a.offsetWidth; a.classList.add('mi-shake');
      });
    });
    later(d0 + MI.first + (cards.length - 1) * MI.gap + MI.hit + MI.hold, () => run.end(false));
  }
