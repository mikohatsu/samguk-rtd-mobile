// ui.js 만들기: src/ui/*.js 조각을 이름 순서로 이어 붙인다(조각들은 하나의 함수 안에서 변수를 같이 쓴다).
// 화면 코드를 고칠 때는 ui.js가 아니라 src/ui/의 조각을 고치고 `npm run ui`를 돌린다.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'src', 'ui');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
const head = '// [자동 생성] 이 파일을 직접 고치지 말 것. src/ui/*.js를 고친 뒤 `npm run ui`로 다시 만든다.\n';
const body = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
fs.writeFileSync(path.join(root, 'ui.js'), head + body);
// 문법 검사: 깨진 채로 배포되지 않게 한다
try { new Function(body); } catch (e) { console.error('ui.js 문법 오류:', e.message); process.exit(1); }
console.log(`ui.js 생성: 조각 ${files.length}개, ${(head + body).split('\n').length - 1}줄`);

// 버전 파일: package.json의 version을 게임이 읽을 수 있게 한다(설정 화면에 표시). 안드로이드 APK 버전도 같은 값을 쓴다.
// RTD_ENGINE_HASH: 판 결과를 정하는 파일 묶음(server/replay-core.js BUNDLE_FILES)의 해시. 판 보고의 입력 기록에 들어가고, 서버는 같은 해시의 엔진으로 재연산한다(2026-11-26).
const engineHash = require('../server/replay-core.js').engineHash(root);
require('fs').writeFileSync(require('path').join(__dirname, '..', 'version.js'), '// 자동 생성(scripts/build-ui.js). 버전은 package.json에서 바꾼다.\nwindow.RTD_VERSION = ' + JSON.stringify(require('../package.json').version) + ';\nwindow.RTD_ENGINE_HASH = ' + JSON.stringify(engineHash) + ';\n');
console.log('엔진 묶음 해시: ' + engineHash);
