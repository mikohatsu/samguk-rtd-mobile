// 운영 제재용 저장소 함수 시험(pg-mem, PostgreSQL판): 채팅 금지·계정 정지 걸기/풀기/조회, 지금 걸린 제재 목록, 제재 이력, 신고 열람, 계정 찾기.
// 스키마(schema.sql 끝의 운영 제재 블록)를 두 번 적용해도 되는지도 본다.
'use strict';
const fs = require('fs'), path = require('path');
const { newDb } = require('pg-mem');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const mem = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const { Pool } = mem.adapters.createPg();
  const { openStore } = require('../store');
  const pool = new Pool();
  const s = await openStore({ pool });
  let twice = true; try { await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')); } catch (e) { twice = false; console.log('     ' + e.message); }
  ok(twice, '스키마를 두 번 적용해도 된다(ADD COLUMN IF NOT EXISTS)');
  let mig = true; try { await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'migrate-2026-11-18-moderation.sql'), 'utf8')); } catch (e) { mig = false; console.log('     ' + e.message); }
  ok(mig, '운영 DB용 SQL(migrate-2026-11-18-moderation.sql)도 그 위에 돌려도 된다');

  const mk = (nick) => s.createUser('g', { nick, gsalt: 'a', gsec: 'b', agreed: { terms: 1, at: Date.now() } });
  const u = await mk('조조'), v = await mk('Yubi');
  const HOUR = 3600000, PERM = Date.UTC(9999, 11, 31), now = Date.now();
  let x = await s.getSanction(u.id);
  ok(x.mutedUntil === 0 && x.bannedUntil === 0 && x.muteReason === '' && (await s.activeSanctions()).length === 0, '처음에는 제재 없음');

  ok((await s.setSanction(u.id, 'mute', now + HOUR, '욕설', 'tester')) === true, '채팅 금지 걸기');
  x = await s.getSanction(u.id);
  ok(x.mutedUntil === now + HOUR && x.muteReason === '욕설' && x.bannedUntil === 0, '조회: 채팅 금지 시각·사유');
  ok((await s.setSanction(u.id, 'ban', PERM, '부정행위', 'tester')) === true, '영구 정지 걸기');
  let act = await s.activeSanctions();
  ok(act.length === 1 && act[0].id === u.id && act[0].mutedUntil === now + HOUR && act[0].bannedUntil === PERM, '지금 걸린 제재 목록(한 계정에 두 가지)');
  ok((await s.setSanction('g_nobody', 'ban', now + HOUR, 'x', 'tester')) === false && (await s.clearSanction('g_nobody', 'ban', 'tester')) === false, '없는 계정은 false');
  ok((await s.setSanction(v.id, 'ban', now - 1000, 'x', 'tester')) === false && (await s.setSanction(v.id, 'kick', now + HOUR, 'x', 'tester')) === false, '지난 시각·모르는 종류는 false');
  ok((await s.getUser(u.id)).nick === '조조' && (await s.getUser(u.id)).coins === 0, '제재를 걸어도 계정의 다른 값은 그대로');

  ok((await s.clearSanction(u.id, 'mute', 'tester')) === true, '채팅 금지 풀기');
  act = await s.activeSanctions();
  ok(act.length === 1 && act[0].mutedUntil === 0 && act[0].bannedUntil === PERM, '풀면 목록에서 그 제재만 빠진다');
  await s.clearSanction(u.id, 'ban', 'tester');
  x = await s.getSanction(u.id);
  ok((await s.activeSanctions()).length === 0 && x.bannedUntil === 0 && x.banReason === '', '정지도 풀면 제재 없음');

  const log = await s.modLog(10);
  ok(log.length === 4 && log.map((l) => l.action).join() === 'unban,unmute,ban,mute' && log[3].reason === '욕설' && log[3].by === 'tester' && log[3].target === u.id && log[2].until === PERM && log[0].until === 0, `제재 이력: 새것부터 4줄 (${log.map((l) => l.action).join()})`);

  // 신고
  const w = await mk('손권');
  await s.report({ by: v.id, target: u.id, nick: '조조', text: '욕을 했다', room: '#lobby' });
  await s.report({ by: v.id, target: u.id, nick: '조조', text: '또 했다', room: 'abcd' });
  await s.report({ by: w.id, target: u.id, nick: '조조', text: '광고', room: 'abcd' });
  await s.report({ by: u.id, target: u.id, nick: '조조', text: '자기 신고', room: 'abcd' });
  await s.report({ by: w.id, target: null, nick: '누구', text: '대상을 못 찾음', room: 'zzzz' });
  ok((await s.countReports(u.id)) === 4 && (await s.reportersSince(u.id, now - HOUR)) === 2 && (await s.reportersSince(u.id, Date.now() + HOUR)) === 0, '받은 신고 4건, 서로 다른 신고자 2명(자기 신고는 세지 않음)');
  let list = await s.listReports({ since: now - HOUR });
  ok(list.length === 5 && list.filter((r) => r.target === u.id).every((r) => r.targetNick === '조조') && list.some((r) => r.target === null && r.targetNick === null && r.text === '대상을 못 찾음') && list.every((r) => r.at > now - HOUR), '신고 목록: 5건, 대상 닉네임은 계정에서');
  list = await s.listReports({ since: now - HOUR, target: u.id, limit: 2 });
  ok(list.length === 2 && list.every((r) => r.target === u.id), '신고 목록: 대상으로 거르기·개수 제한');
  ok((await s.listReports({ since: Date.now() + HOUR })).length === 0, '신고 목록: 기간 밖은 없음');

  // 계정 찾기
  ok((await s.findUsers(v.id)).map((a) => a.id).join() === v.id && (await s.findUsers('yubi')).map((a) => a.id).join() === v.id && (await s.findUsers('없는사람')).length === 0, '계정 찾기: 계정 ID 또는 닉네임(대소문자 무시)');

  // 탈퇴: 제재는 계정과 함께 사라지고 이력은 남는다
  await s.setSanction(w.id, 'ban', now + HOUR, '시험', 'tester');
  await s.deleteUser(w.id);
  ok((await s.activeSanctions()).length === 0 && (await s.modLog(10)).some((l) => l.target === w.id), '계정을 지우면 제재는 사라지고 이력은 남는다');
  await s.close();
})().catch((e) => { console.log('FAIL 예외 ' + (e && e.stack || e)); process.exitCode = 1; });
