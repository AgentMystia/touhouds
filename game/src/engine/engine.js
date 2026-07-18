// engine.js — 输入、循环辅助、随机数、几何工具。
export const keys = Object.create(null);
export const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, rdown: false, clicked: false, rclicked: false, hover: null };

export function initInput(canvas) {
  addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    for (const f of keyHandlers) f(e.code, e);
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = mouse.rdown = false; });
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (e.button === 2) { mouse.rdown = true; mouse.rclicked = true; }
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.rdown = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

const keyHandlers = [];
export function onKey(f) { keyHandlers.push(f); }
export function endFrame() { mouse.clicked = false; mouse.rclicked = false; }

// 确定性随机（世界生成用）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 值噪声（双线性 + 平滑插值）
export function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  function noise2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return lerp(v, lerp(u, grad(aa, x, y), grad(ba, x - 1, y)),
                lerp(u, grad(ab, x, y - 1), grad(bb, x - 1, y - 1)));
  }
  return function fbm(x, y, oct = 4) {
    let v = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f); amp *= 0.5; f *= 2; }
    return v;
  };
}

export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const angleLerp = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// 空间哈希网格
export class Grid {
  constructor(cell = 128) { this.cell = cell; this.map = new Map(); }
  key(x, y) { return ((x / this.cell) | 0) * 100000 + ((y / this.cell) | 0); }
  // 复用格子数组（每帧重建时避免整批数组重分配造成 GC 抖动）
  clear() { for (const arr of this.map.values()) arr.length = 0; }
  insert(e) {
    const k = this.key(e.x, e.y);
    let arr = this.map.get(k);
    if (!arr) { arr = []; this.map.set(k, arr); }
    arr.push(e);
  }
  query(x, y, r, out = []) {
    out.length = 0;
    const c = this.cell;
    const x0 = ((x - r) / c) | 0, x1 = ((x + r) / c) | 0;
    const y0 = ((y - r) / c) | 0, y1 = ((y + r) / c) | 0;
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const arr = this.map.get(gx * 100000 + gy);
      if (arr) for (const e of arr) out.push(e);
    }
    return out;
  }
}
