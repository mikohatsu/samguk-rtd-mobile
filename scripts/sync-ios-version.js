// iOS 버전을 package.json 한 곳에서 가져온다(안드로이드 android/app/build.gradle과 같은 규칙).
//   MARKETING_VERSION      = package.json version (a.b.c)          → CFBundleShortVersionString
//   CURRENT_PROJECT_VERSION = a*10000 + b*100 + c (안드로이드 versionCode와 같은 수) → CFBundleVersion
// 배포마다 version을 올리므로(CLAUDE.md) 빌드 번호도 저절로 커진다. 같은 버전을 App Store Connect에 두 번 올려야 할 때만
// IOS_BUILD_SUFFIX=1 처럼 주면 빌드 번호 끝에 ".1"을 붙인다(CFBundleVersion은 점으로 나눈 숫자 3개까지 허용).
// npm run build(그래서 npm run sync·npm run ios)가 부른다. 값이 같으면 파일을 건드리지 않는다.
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const version = require(path.join(root, 'package.json')).version;
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!m) { console.error('package.json version이 a.b.c 모양이 아니다:', version); process.exit(1); }
const [a, b, c] = m.slice(1).map(Number);
if (b > 99 || c > 99) { console.error('b·c는 99 이하여야 한다(빌드 번호 a*10000+b*100+c가 겹치지 않게):', version); process.exit(1); }
const suffix = process.env.IOS_BUILD_SUFFIX || '';
if (suffix && !/^\d{1,4}$/.test(suffix)) { console.error('IOS_BUILD_SUFFIX는 숫자만:', suffix); process.exit(1); }
const build = String(a * 10000 + b * 100 + c) + (suffix ? '.' + suffix : '');
const file = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
if (!fs.existsSync(file)) { console.log('iOS 프로젝트 없음 — 버전 맞추기 건너뜀'); process.exit(0); }
const src = fs.readFileSync(file, 'utf8');
const n1 = (src.match(/MARKETING_VERSION = [^;]+;/g) || []).length, n2 = (src.match(/CURRENT_PROJECT_VERSION = [^;]+;/g) || []).length;
if (!n1 || !n2) { console.error('project.pbxproj에서 MARKETING_VERSION·CURRENT_PROJECT_VERSION을 찾지 못했다'); process.exit(1); }
const out = src.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`).replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
if (out !== src) fs.writeFileSync(file, out);
console.log(`iOS 버전 ${version} (빌드 ${build})${out === src ? ' — 이미 같음' : ''}`);
