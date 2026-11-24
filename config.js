// 온라인 서버 주소. 게임 서버에서 직접 열면 그 주소를 쓰고, 앱(또는 다른 곳)에서 열면 아래 주소로 붙는다.
(function () {
  const SERVER = 'https://34-146-124-57.sslip.io'; // 도쿄 온라인 서버(로컬 시험은 window.RTD_API로 덮어쓴다)
  const same = /^https?:$/.test(location.protocol) && (location.port === '8300' || /sslip\.io$/.test(location.hostname));
  window.RTD_API = window.RTD_API || (same ? location.origin : SERVER);
  window.RTD_SERVER = window.RTD_API.replace(/^http/, 'ws');
  // 스토어 주소(앱 강제 업데이트 화면의 '스토어로 가기' 버튼). 비어 있으면 버튼을 숨긴다. 출시해서 주소가 생기면 여기만 채운다
  window.RTD_STORE = { ios: '', android: '' };
})();
