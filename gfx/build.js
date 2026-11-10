// 생성 이미지(흰 배경 PNG)를 게임용 그림으로 바꾼다: 가장자리에서 이어진 흰 배경을 투명하게 하고 여백을 잘라 낸다.
// node gfx/build.js <생성 이미지 폴더>   map.txt의 "파일이름조각 아이디" 줄마다 gfx/<아이디>.png를 만들고 gfx/index.js를 쓴다.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const dir = __dirname, src = process.argv[2];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function decode(buf) {
  let p = 8, w, h, bd, ct; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error('지원하지 않는 PNG 형식 ' + bd + '/' + ct);
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * 4), stride = w * bpp;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      if (f === 1) line[i] = (line[i] + a) & 255;
      else if (f === 2) line[i] = (line[i] + b) & 255;
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; out[o] = line[x * bpp]; out[o + 1] = line[x * bpp + 1]; out[o + 2] = line[x * bpp + 2]; out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255; }
    prev = line;
  }
  return { w, h, px: out };
}
function encode(w, h, px) {
  // 줄마다 PNG 필터(없음·왼쪽·위·평균·Paeth) 중 압축이 잘될 것을 골라 크기를 줄인다
  const st = w * 4, raw = Buffer.alloc((st + 1) * h), cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(st));
  for (let y = 0; y < h; y++) {
    const o = y * st;
    let best = 0, bs = Infinity;
    for (let f = 0; f < 5; f++) {
      const out = cand[f]; let sum = 0;
      for (let i = 0; i < st; i++) {
        const x = px[o + i], a = i >= 4 ? px[o + i - 4] : 0, b = y ? px[o - st + i] : 0, c = i >= 4 && y ? px[o - st + i - 4] : 0;
        let v = x;
        if (f === 1) v = x - a; else if (f === 2) v = x - b; else if (f === 3) v = x - ((a + b) >> 1);
        else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = x - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
        v &= 255; out[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bs) { bs = sum; best = f; }
    }
    raw[y * (st + 1)] = best; cand[best].copy(raw, y * (st + 1) + 1);
  }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// 가장자리에서 이어진 밝고 채도 낮은 픽셀을 배경으로 본다
function cutout(img) {
  const { w, h, px } = img, bg = new Uint8Array(w * h), q = [];
  const light = (i) => { const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]; return Math.min(r, g, b) > 226 && Math.max(r, g, b) - Math.min(r, g, b) < 28; };
  for (let x = 0; x < w; x++) q.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) q.push(y * w, y * w + w - 1);
  while (q.length) {
    const i = q.pop();
    if (bg[i] || !light(i)) continue;
    bg[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) q.push(i - 1); if (x < w - 1) q.push(i + 1); if (y > 0) q.push(i - w); if (y < h - 1) q.push(i + w);
  }
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = (i / w) | 0;
    if (bg[i]) { px[i * 4 + 3] = 0; continue; }
    // 배경과 맞닿은 밝은 가장자리는 반투명하게 다듬는다
    const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (edge) { const m = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); if (m > 180) px[i * 4 + 3] = Math.round(255 * (1 - (m - 180) / 75) * 0.9 + 25); }
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const cw = x1 - x0 + 1, chh = y1 - y0 + 1, out = Buffer.alloc(cw * chh * 4);
  for (let y = 0; y < chh; y++) px.copy(out, y * cw * 4, ((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4);
  return { w: cw, h: chh, px: out };
}

// 이펙트(fx_)는 검은 배경에 빛으로 그린 그림이라 밝기를 투명도로 바꾼다
function glow(img) {
  const { w, h, px } = img;
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = Math.max(r, g, b);
    const k = a < 24 ? 0 : Math.min(255, (a - 24) * 1.15);
    if (a) { px[i * 4] = Math.min(255, (r * 255) / a); px[i * 4 + 1] = Math.min(255, (g * 255) / a); px[i * 4 + 2] = Math.min(255, (b * 255) / a); }
    px[i * 4 + 3] = k;
  }
  return img;
}

const map = fs.readFileSync(path.join(dir, 'map.txt'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.trim().split(/\s+/));
const files = fs.readdirSync(src), index = {}, imgs = {};
// 보스 그림으로도 크게 쓰이는 장수
const BIG = new Set(['janggak', 'hwawoong', 'dongtak', 'wonso', 'yeopo', 'jojo', 'yukson', 'jegal', 'deungae', 'samaui']);
// 면적 평균으로 줄이기(알파 가중)
function shrink(img, k) {
  const { w, h, px } = img, nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k)), out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const x0 = Math.floor(x / k), x1 = Math.min(w, Math.ceil((x + 1) / k)), y0 = Math.floor(y / k), y1 = Math.min(h, Math.ceil((y + 1) / k));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const o = (yy * w + xx) * 4, al = px[o + 3]; r += px[o] * al; g += px[o + 1] * al; b += px[o + 2] * al; a += al; n++; }
    const o = (y * nw + x) * 4;
    if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    out[o + 3] = a / n;
  }
  return { w: nw, h: nh, px: out };
}
// 색 단계를 살짝 줄여(채널당 64단계) 압축이 잘되게 한다. 눈으로는 차이가 거의 없다.
function posterize(img) {
  const px = Buffer.from(img.px);
  for (let i = 0; i < px.length; i++) px[i] = i % 4 === 3 ? (px[i] > 250 ? 255 : px[i] < 5 ? 0 : px[i]) : Math.min(255, Math.round(px[i] / 4) * 4);
  return { w: img.w, h: img.h, px };
}
// 그림 하나를 좌우로 뒤집는다(방향이 반대로 나온 생성 그림용, map.txt에서 "!" 표시)
function mirror(img) {
  const { w, h, px } = img, out = Buffer.alloc(px.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.copy(out, (y * w + (w - 1 - x)) * 4, (y * w + x) * 4, (y * w + x) * 4 + 4);
  return { w, h, px: out };
}
for (const [frag, id, flag] of map) {
  const f = files.find((x) => x.includes(frag));
  if (!f) { console.log('없음', frag, id); continue; }
  const raw = decode(fs.readFileSync(path.join(src, f)));
  // fx_: 빛 이펙트, tex_: 타일 텍스처(그대로), 나머지: 흰 배경 오려 내기
  let img = id.startsWith('fx_') ? glow(raw) : id.startsWith('tex_') ? raw : cutout(raw);
  if (flag === '!') img = mirror(img);
  fs.writeFileSync(path.join(dir, id + '.png'), encode(img.w, img.h, img.px));
  // 화면에 그리는 크기에 맞춰 줄인다(보스로도 쓰는 장수·이펙트·텍스처는 그대로)
  const base = id.replace(/_[bs]$/, '');
  if (!BIG.has(base) && !/^(fx_|tex_|prop_castle)/.test(id) && img.h > 150) img = shrink(img, 150 / img.h);
  imgs[id] = posterize(img);
}
// 그림 하나하나를 따로 받으면 느리므로 큰 시트(아틀라스) 몇 장에 줄줄이 채워 넣는다
const SHEET = 2048, PAD = 2, sheets = [];
let sx = 0, sy = 0, rowH = 0, cur = null;
const newSheet = () => { cur = Buffer.alloc(SHEET * SHEET * 4); sheets.push(cur); sx = 0; sy = 0; rowH = 0; };
newSheet();
Object.keys(imgs).sort((a, b) => imgs[b].h - imgs[a].h).forEach((id) => {
  const im = imgs[id];
  if (sx + im.w > SHEET) { sx = 0; sy += rowH + PAD; rowH = 0; }
  if (sy + im.h > SHEET) newSheet();
  for (let y = 0; y < im.h; y++) im.px.copy(cur, ((sy + y) * SHEET + sx) * 4, y * im.w * 4, (y + 1) * im.w * 4);
  index[id] = [im.w, im.h, sheets.length - 1, sx, sy];
  sx += im.w + PAD; rowH = Math.max(rowH, im.h);
});
// 마지막 시트는 쓴 높이만큼만 잘라 저장한다
let ver = 0;
sheets.forEach((buf, i) => {
  const h = i === sheets.length - 1 ? sy + rowH : SHEET, png = encode(SHEET, h, buf.slice(0, SHEET * h * 4));
  fs.writeFileSync(path.join(dir, 'atlas' + i + '.png'), png);
  ver = (ver * 31 + png.length) >>> 0;
});
// 브라우저가 읽는 목록(아이디: [너비, 높이, 시트, x, y]). 버전이 바뀌면 브라우저 캐시를 새로 받는다.
fs.writeFileSync(path.join(dir, 'index.js'), '// 생성 이미지 목록. gfx/build.js가 만든다.\nwindow.RTD_GFX = ' + JSON.stringify(index) + ';\nwindow.RTD_GFX_SHEETS = ' + sheets.length + ';\nwindow.RTD_GFX_VER = "' + ver.toString(36) + '";\n');
console.log(Object.keys(index).length, '장,', sheets.length, '시트');
