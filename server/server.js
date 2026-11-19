// 삼국지 랜덤 디펜스 협동 서버. 게임 파일을 제공하고 WebSocket으로 방별 메시지를 중계한다.
// 게임 판정은 방장 클라이언트가 하므로 서버는 방 관리와 중계만 맡는다.
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8200, ROOT = path.join(__dirname, '..'), MAX_PLAYERS = 5, MAX_MESSAGE = 16 * 1024;
const FILES = { '/': 'samguk-rtd.html', '/samguk-rtd.html': 'samguk-rtd.html', '/theme-samguk.js': 'theme-samguk.js', '/engine.js': 'engine.js', '/raid.js': 'raid.js', '/synergy.js': 'synergy.js', '/art.js': 'art.js', '/audio.js': 'audio.js', '/net.js': 'net.js', '/ai.js': 'ai.js', '/ui.js': 'ui.js', '/gfx/index.js': 'gfx/index.js' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };

// 파일은 처음 한 번만 읽어 메모리에 두고(글자 파일은 gzip본도 함께), 바뀌면 다시 읽는다
const store = new Map();
function load(file, cb) {
  const full = path.join(ROOT, file);
  fs.stat(full, (err, st) => {
    if (err) return cb(err);
    const hit = store.get(file);
    if (hit && hit.mtime === st.mtimeMs) return cb(null, hit);
    fs.readFile(full, (err2, data) => {
      if (err2) return cb(err2);
      const ent = { mtime: st.mtimeMs, data, gz: /\.(png|jpg)$/.test(file) ? null : zlib.gzipSync(data), etag: '"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"' };
      store.set(file, ent);
      cb(null, ent);
    });
  });
}

const server = http.createServer((req, res) => {
  const [url, query] = req.url.split('?');
  if (url === '/health') { res.writeHead(200); res.end('ok'); return; }
  // 생성 그림은 gfx/ 아래 이름이 단순한 png·jpg만 내준다(경로 조작 방지)
  const file = FILES[url] || (/^\/gfx\/[A-Za-z0-9_]+\.(png|jpg)$/.test(url) ? url.slice(1) : null);
  if (!file) { res.writeHead(404); res.end('not found'); return; }
  load(file, (err, ent) => {
    if (err) { res.writeHead(500); res.end('read error'); return; }
    // 판 번호(?v=)가 붙은 그림 묶음은 브라우저가 오래 보관하고, 나머지는 바뀌었는지만 확인한다
    const head = { 'Content-Type': TYPES[path.extname(file)], 'Cache-Control': query && /(^|&)v=/.test(query) ? 'public, max-age=31536000, immutable' : 'no-cache', ETag: ent.etag, Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === ent.etag) { res.writeHead(304, head); res.end(); return; }
    if (ent.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { head['Content-Encoding'] = 'gzip'; res.writeHead(200, head); res.end(ent.gz); return; }
    res.writeHead(200, head);
    res.end(ent.data);
  });
});

const rooms = new Map(); // 방 코드 → Map(플레이어 id → { ws, state })
let nextId = 1;
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const broadcast = (room, from, msg) => room.forEach((p, id) => { if (id !== from) send(p.ws, msg); });

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE });
wss.on('connection', (ws, req) => {
  const code = (new URL(req.url, 'http://x').searchParams.get('room') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  if (!code) { send(ws, { k: 'error', code: 'bad_room' }); ws.close(); return; }
  const room = rooms.get(code) || new Map();
  if (room.size >= MAX_PLAYERS) { send(ws, { k: 'error', code: 'full' }); ws.close(); return; }
  rooms.set(code, room);
  const id = 'p' + String(nextId++).padStart(6, '0'), me = { ws, state: {} };
  const peers = {}; room.forEach((p, pid) => (peers[pid] = p.state));
  room.set(id, me);
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  send(ws, { k: 'hello', id, peers });
  broadcast(room, id, { k: 'pres', id, p: {} });
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.k === 'pres' && m.p && typeof m.p === 'object') { Object.assign(me.state, m.p); broadcast(room, id, { k: 'pres', id, p: m.p }); }
    else if (m.k === 'msg' && typeof m.t === 'string') broadcast(room, id, { k: 'msg', from: id, t: m.t, d: m.d });
  });
  ws.on('close', () => {
    room.delete(id);
    broadcast(room, id, { k: 'left', id });
    if (!room.size) rooms.delete(code);
  });
});
// 끊긴 연결 정리
setInterval(() => wss.clients.forEach((ws) => { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } }), 30000);

server.listen(PORT, () => console.log(`삼국지 랜덤 디펜스 서버: http://localhost:${PORT}`));
