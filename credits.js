// 크레딧·라이선스 화면. 설정의 '크레딧' 버튼(data-act="credits")이 연다.
// 출처 표기가 의무인 것(CC BY 음악·아이콘, OFL 글꼴, MIT·MPL 라이브러리)을 앱 안에서 볼 수 있게 한다. 내용의 기준은 CREDITS.md.
(function (root) {
  const L = ['ko', 'ja', 'en', 'zh'];
  const TX = {
    title: ['크레딧 · 라이선스', 'クレジット・ライセンス', 'Credits & Licenses', '制作名单与许可'],
    close: ['닫기', '閉じる', 'Close', '关闭'],
    music: ['음악', '音楽', 'Music', '音乐'],
    musicNote: ['게임에 맞게 길이를 줄이고 음량을 조정했습니다.', 'ゲームに合わせて長さと音量を調整しています。', 'Tracks were shortened and level-matched for the game.', '已根据游戏需要剪短并调整音量。'],
    icons: ['스킬 아이콘', 'スキルアイコン', 'Skill icons', '技能图标'],
    iconsNote: ['단색으로 칠해 버튼에 맞게 크기를 조정했습니다.', '単色で着色し、ボタンに合わせてサイズを調整しています。', 'Recolored and resized for the buttons.', '已改为单色并调整尺寸。'],
    fonts: ['글꼴', 'フォント', 'Fonts', '字体'],
    sfx: ['효과음 · 이펙트 (CC0, 감사합니다)', '効果音・エフェクト（CC0、ありがとうございます）', 'Sound effects & VFX (CC0, with thanks)', '音效与特效（CC0，致谢）'],
    oss: ['오픈소스 소프트웨어', 'オープンソースソフトウェア', 'Open-source software', '开源软件'],
    art: ['그림', 'イラスト', 'Artwork', '美术'],
    artNote: ['장수·보스·배경·UI 그림은 이 게임을 위해 이미지 생성 도구로 제작했습니다.', '武将・ボス・背景・UIの画像は、本作のために画像生成ツールで制作しました。', 'Character, boss, background and UI art was made for this game with image-generation tools.', '武将、首领、背景与界面图像均为本作使用图像生成工具制作。'],
    disc: ['이 게임은 삼국 시대의 역사와 고전 「삼국지연의」를 소재로 한 독립 창작물이며, 다른 회사의 삼국지 게임·상표와 관련이 없습니다.', '本作は三国時代の歴史と古典「三国志演義」を題材にした独立した創作物であり、他社の三国志関連ゲーム・商標とは関係ありません。', 'This game is an independent work based on Three Kingdoms history and the classic novel "Romance of the Three Kingdoms". It is not affiliated with any other company\'s games or trademarks.', '本作是以三国历史与古典小说《三国演义》为题材的独立创作，与其他公司的三国题材游戏及商标无关。'],
    full: ['라이선스 전문', 'ライセンス全文', 'Full license text', '许可全文'],
  };
  const lang = () => { const k = (root.RTD_I18N && root.RTD_I18N.lang) || 'ko'; return Math.max(0, L.indexOf(k)); };
  const t = (k) => TX[k][lang()] || TX[k][0];
  const BY4 = 'Licensed under Creative Commons: By Attribution 4.0 License — http://creativecommons.org/licenses/by/4.0/';
  const MUSIC = ['Shenyang', 'Eastminster', 'Tea Roots', 'Opium', 'Dragon and Toast', 'Lord of the Land', 'Asian Drums'];
  const FONTS = [
    ['Black Han Sans', 'Copyright 2015 The Black Han Sans Project Authors (https://github.com/zesstype/Black-Han-Sans)'],
    ['East Sea Dokdo', 'Copyright (c) YoonDesign Inc. All Rights Reserved.'],
    ['Gowun Batang', 'Copyright 2021 The Gowun Batang Project Authors (https://github.com/yangheeryu/Gowun-Batang)'],
    ['IBM Plex Sans KR', 'Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"'],
    ['Noto Serif KR', 'Copyright 2012 Google Inc. All Rights Reserved.'],
    ['Yuji Boku', 'Copyright 2021 The Yuji Project Authors (https://github.com/Kinutafontfactory/Yuji)'],
    ['Dela Gothic One', 'Copyright 2020 The Dela Gothic Project Authors (https://github.com/syakuzen/DelaGothic)'],
    ['Zen Antique', 'Copyright 2021 The Zen Antique Project Authors (https://github.com/googlefonts/zen-antique)'],
  ];
  // OFL이 아닌 무료 글꼴(일본어 붓글씨)
  const FONT_FREE = '衡山毛筆フォント — 青柳衡山 (https://opentype.jp/kouzanmouhitufont.htm)';
  const CC0 = [
    'artisticdude — Swishes Sound Pack, RPG Sound Pack (OpenGameArt.org)',
    'remaxim — 3 Melee sounds (OpenGameArt.org)',
    'Kenney (kenney.nl) — RPG Audio, Particle Pack',
    'Sinestesia — Hit Animation 1·2, 2D Explosion Animations 1·2 (OpenGameArt.org)',
    'wreaderror — lightning (OpenGameArt.org)',
    'Grahhhhh — Animated Blue Ring Explosion (OpenGameArt.org)',
    'para — Animated particle effects #1 (OpenGameArt.org)',
    'Esthar — Item popup starburst (OpenGameArt.org)',
    'Beast — Smoke Aura (OpenGameArt.org)',
    'Luke.RUSTLTD — 4 summoning circles (OpenGameArt.org)',
    'simranzenov — Sunbursts / 2D Rays (OpenGameArt.org)',
    'alexander123 — Stars Icon for UI (OpenGameArt.org)',
    'Rob Tuytel — Large Floor Tiles 02, Floor Bricks 02, Rock Ground, Brown Mud Leaves 01, Dry Ground 01 (Poly Haven, polyhaven.com)',
  ];
  const OSS = [
    ['Capacitor (@capacitor/core, android, ios, app, browser, screen-orientation, splash-screen, status-bar)', 'MIT License — Copyright (c) 2017-present Drifty Co. / Copyright 2020-present Ionic'],
    ['@capacitor-community/admob', 'MIT License — Copyright (c) 2021 Capacitor Community'],
    ['@capgo/capacitor-social-login', 'Mozilla Public License 2.0 — https://github.com/Cap-go/capacitor-social-login'],
    ['@capgo/native-purchases', 'Mozilla Public License 2.0 — https://github.com/Cap-go/capacitor-native-purchases'],
  ];
  const MIT = 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';
  const OFL = 'SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007\n\nPREAMBLE\nThe goals of the Open Font License (OFL) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others.\n\nThe OFL allows the licensed fonts to be used, studied, modified and redistributed freely as long as they are not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that any reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives.\n\nDEFINITIONS\n"Font Software" refers to the set of files released by the Copyright Holder(s) under this license and clearly marked as such. This may include source files, build scripts and documentation.\n\n"Reserved Font Name" refers to any names specified as such after the copyright statement(s).\n\n"Original Version" refers to the collection of Font Software components as distributed by the Copyright Holder(s).\n\n"Modified Version" refers to any derivative made by adding to, deleting, or substituting -- in part or in whole -- any of the components of the Original Version, by changing formats or by porting the Font Software to a new environment.\n\n"Author" refers to any designer, engineer, programmer, technical writer or other person who contributed to the Font Software.\n\nPERMISSION & CONDITIONS\nPermission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:\n\n1) Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.\n\n2) Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields within text or binary files as long as those fields can be easily viewed by the user.\n\n3) No Modified Version of the Font Software may use the Reserved Font Name(s) unless explicit written permission is granted by the corresponding Copyright Holder. This restriction only applies to the primary font name as presented to the users.\n\n4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution(s) of the Copyright Holder(s) and the Author(s) or with their explicit written permission.\n\n5) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the Font Software.\n\nTERMINATION\nThis license becomes null and void if any of the above conditions are not met.\n\nDISCLAIMER\nTHE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CSS = '#credits{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:max(10px,env(safe-area-inset-top,0px)) max(10px,env(safe-area-inset-right,0px)) max(10px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px));background:rgba(13,9,7,.8)}'
    + '#credits .cr-box{width:min(640px,100%);max-height:100%;display:flex;flex-direction:column;background:#1d120c;border:2px solid #8a6a3a;border-radius:10px;color:#e9dcc3;box-shadow:0 10px 30px rgba(0,0,0,.7)}'
    + '#credits .cr-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid #5a432a;font-weight:700;color:#e8b860}'
    + '#credits .cr-head button{min-width:64px;min-height:36px;padding:4px 12px;background:#3b2c21;border:1px solid #8a6a3a;border-radius:6px;color:#e9dcc3;font:inherit}'
    + '#credits .cr-body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 14px 14px;font-size:13px;line-height:1.55;user-select:text;-webkit-user-select:text}'
    + '#credits h3{margin:14px 0 4px;font-size:14px;color:#e8b860}'
    + '#credits p,#credits ul{margin:2px 0}#credits ul{padding-left:18px}#credits small{color:#b7a584}'
    + '#credits details{margin-top:6px}#credits summary{color:#b7a584;cursor:pointer;padding:6px 0}'
    + '#credits pre{white-space:pre-wrap;word-break:break-word;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#b7a584;margin:0}';
  function html() {
    let h = `<h3>${t('music')}</h3><ul>` + MUSIC.map((m) => `<li>"${esc(m)}" Kevin MacLeod (incompetech.com)</li>`).join('') + `</ul><p><small>${esc(BY4)}<br>${t('musicNote')}</small></p>`;
    h += `<h3>${t('icons')}</h3><p>Lorc, Delapouite — game-icons.net</p><p><small>Licensed under CC BY 3.0 — https://creativecommons.org/licenses/by/3.0/<br>${t('iconsNote')}</small></p>`;
    h += `<h3>${t('fonts')}</h3><ul>` + FONTS.map(([n, c]) => `<li>${esc(n)}<br><small>${esc(c)}</small></li>`).join('') + `</ul><p><small>SIL Open Font License, Version 1.1 — https://openfontlicense.org</small></p><p>${esc(FONT_FREE)}</p><details><summary>${t('full')} (OFL 1.1)</summary><pre>${esc(OFL)}</pre></details>`;
    h += `<h3>${t('oss')}</h3><ul>` + OSS.map(([n, c]) => `<li>${esc(n)}<br><small>${esc(c)}</small></li>`).join('') + `</ul><details><summary>${t('full')} (MIT)</summary><pre>${esc(MIT)}</pre></details>`;
    h += `<h3>${t('sfx')}</h3><ul>` + CC0.map((s) => `<li>${esc(s)}</li>`).join('') + '</ul>';
    h += `<h3>${t('art')}</h3><p>${t('artNote')}</p><p>Canva AI · Higgsfield (Z Image)</p><p><small>${t('disc')}</small></p>`;
    return h;
  }
  let openedAt = 0;
  function close() { const el = document.getElementById('credits'); if (el) el.remove(); }
  function open() {
    close(); openedAt = Date.now();
    if (!document.getElementById('credits-css')) { const st = document.createElement('style'); st.id = 'credits-css'; st.textContent = CSS; document.head.appendChild(st); }
    const el = document.createElement('div');
    el.id = 'credits';
    el.innerHTML = `<div class="cr-box" role="dialog" aria-modal="true"><div class="cr-head"><span>${t('title')}</span><button type="button" id="credits-x">${t('close')}</button></div><div class="cr-body">${html()}</div></div>`;
    // 게임 쪽 입력(유닛 선택·조이스틱)으로 새지 않게 여기서 막는다
    ['pointerdown', 'pointerup', 'click', 'touchstart', 'wheel'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation()));
    el.addEventListener('click', (e) => { if (Date.now() - openedAt > 350 && (e.target === el || e.target.id === 'credits-x')) close(); });
    document.body.appendChild(el);
  }
  root.RTD_CREDITS = { open, close, label: () => t('title') };
})(typeof window !== 'undefined' ? window : globalThis);
