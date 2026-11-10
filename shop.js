// 상점 목록(앱과 서버가 같이 쓴다). 능력치는 바꾸지 않는 꾸미기만 판다.
// 재화: 동전(판을 마치면 받는 게임 재화), 원보(유료 재화, 인앱 결제 준비 전이라 자리만).
// 이름은 [한국어, 일본어, 영어, 중국어].
(function (root) {
  const ICON_FREE = ['cav', 'arc', 'shd', 'spr', 'swd'];
  const ICON_SHOP = [
    ['jangbi', 300], ['joun', 300], ['sonchaek', 300], ['gwakga', 300], ['dongtak', 300],
    ['gwanu', 600], ['yubi', 600], ['jojo', 600], ['songwon', 600], ['juyu', 600],
    ['jegal', 900], ['samaui', 900], ['yeopo', 900], ['choseon', 900], ['janggak', 900],
  ];
  // 장수 외형: 색을 바꾼다(hue 각도, 채도, 밝기)
  const UNIT_SKINS = {
    gwanu_black: { unit: 'gwanu', hue: 150, sat: 0.7, lit: -0.12, price: 1500, name: ['흑룡 관우', '黒龍の関羽', 'Black Dragon Guan Yu', '黑龙关羽'] },
    yeopo_gold: { unit: 'yeopo', hue: 45, sat: 1.25, lit: 0.06, price: 1500, name: ['황금 여포', '黄金の呂布', 'Golden Lu Bu', '黄金吕布'] },
    jojo_azure: { unit: 'jojo', hue: 200, sat: 1.1, lit: 0, price: 1500, name: ['청운 조조', '蒼雲の曹操', 'Azure Cao Cao', '苍云曹操'] },
    choseon_violet: { unit: 'choseon', hue: 60, sat: 1.1, lit: 0, price: 1500, name: ['자월 초선', '紫月の貂蝉', 'Violet Moon Diaochan', '紫月貂蝉'] },
    jegal_jade: { unit: 'jegal', hue: 120, sat: 1.15, lit: 0.02, price: 1500, name: ['비취 제갈량', '翡翠の諸葛亮', 'Jade Zhuge Liang', '翡翠诸葛亮'] },
    songwon_crimson: { unit: 'songwon', hue: -40, sat: 1.25, lit: -0.03, price: 1500, name: ['주홍 손권', '朱紅の孫権', 'Crimson Sun Quan', '朱红孙权'] },
  };
  // 전장 지도: 바닥 색을 바꾼다
  const MAP_SKINS = {
    spring: { hue: 0, sat: 1, lit: 0, price: 0, name: ['봄 들판', '春の野', 'Spring Fields', '春野'] },
    autumn: { hue: -40, sat: 1.3, lit: 0, price: 800, name: ['가을 산하', '秋の山河', 'Autumn Hills', '秋日山河'] },
    snow: { hue: 170, sat: 0.3, lit: 0.18, price: 800, name: ['설원', '雪原', 'Snowfield', '雪原'] },
    desert: { hue: -25, sat: 0.9, lit: 0.08, price: 800, name: ['서량 사막', '西涼の砂漠', 'Liang Desert', '西凉沙漠'] },
  };
  const GEM_PACKS = [['gem60', 60, 160], ['gem300', 300, 800], ['gem980', 980, 2400]]; // [id, 원보, 엔] 인앱 결제 준비 중
  const price = (id) => {
    const ic = ICON_SHOP.find(([u]) => 'icon_' + u === id);
    if (ic) return ic[1];
    if (id.startsWith('skin_') && UNIT_SKINS[id.slice(5)]) return UNIT_SKINS[id.slice(5)].price;
    if (id.startsWith('map_') && MAP_SKINS[id.slice(4)]) return MAP_SKINS[id.slice(4)].price;
    return null;
  };
  const free = (id) => ICON_FREE.some((u) => 'icon_' + u === id) || id === 'map_spring';
  root.RTD_SHOP = { ICON_FREE, ICON_SHOP, UNIT_SKINS, MAP_SKINS, GEM_PACKS, price, free };
  if (typeof module !== 'undefined') module.exports = root.RTD_SHOP;
})(typeof window !== 'undefined' ? window : globalThis);
