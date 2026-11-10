'use strict';
const crypto = require('crypto');
const DIFFS = ['easy', 'normal', 'hard', 'nightmare'];
const TOKEN_MS = 60 * 86400000; // 로그인 토큰 60일
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');
module.exports = { DIFFS, TOKEN_MS, sha, newToken };
