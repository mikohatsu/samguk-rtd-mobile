// 엔진 묶음 보관: 지금 판 결과를 정하는 파일(server/replay-core.js BUNDLE_FILES)을 server/engines/<해시>/에 복사한다.
// 앱 버전마다 엔진이 다르므로, 옛 앱이 보낸 판도 그 버전 엔진으로 재연산하려면 배포(또는 앱 출시) 때마다 한 번 돌린다.
// 서버는 기록의 eh가 지금 폴더의 해시와 같으면 지금 파일을, 아니면 server/engines/<eh>/를 쓴다(server/replay.js engineDir). 없으면 그 판은 norec.
// 쓰는 법: node scripts/engine-pack.js   → "server/engines/caedfa86a087b0d9 (9 파일)"
// 보관 폴더는 배포 묶음에 넣는다(tar에 server/engines 포함). 오래된 버전(그 앱을 쓰는 사람이 없어진 버전)은 지워도 된다.
'use strict';
const fs = require('fs'), path = require('path');
const RC = require('../server/replay-core.js');
const root = path.join(__dirname, '..'), eh = RC.engineHash(root), dir = path.join(root, 'server', 'engines', eh);
fs.mkdirSync(dir, { recursive: true });
RC.BUNDLE_FILES.forEach((f) => fs.copyFileSync(path.join(root, f), path.join(dir, f)));
if (RC.engineHash(dir) !== eh) { console.error('보관본 해시가 다르다(복사 실패?)'); process.exit(1); }
console.log(`server/engines/${eh} (${RC.BUNDLE_FILES.length} 파일)`);
