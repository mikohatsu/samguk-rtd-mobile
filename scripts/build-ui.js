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
