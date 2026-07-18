// assets.js — 资产加载：图集（可选）+ 程序化占位渲染。
// 图集就绪后 setAtlas(atlasImg, frames) 替换占位。
const cache = new Map();     // key -> canvas
let atlas = null, frames = null;

export function setAtlas(img, fr) { atlas = img; frames = fr; cache.clear(); }
export function hasAtlas() { return !!atlas; }

// ---------- 场景图（直接整图加载，不进图集） ----------
const sceneCache = new Map();
function sceneImage(url) {
  if (sceneCache.has(url)) return sceneCache.get(url);
  const c = document.createElement('canvas');
  c.width = 4; c.height = 4;  // 未加载完成前的小占位
  const img = new Image();
  img.onload = () => {
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
  };
  img.src = url;
  sceneCache.set(url, c);
  return c;
}

export function getSprite(key) {
  // 场景图
  if (key === 'title_bg') return sceneImage('assets/title.png');
  if (key === 'death_bg') return sceneImage('assets/death.png');
  if (cache.has(key)) return cache.get(key);
  let c = null;
  if (atlas && frames && frames[key]) {
    const f = frames[key];
    c = document.createElement('canvas');
    c.width = f.w; c.height = f.h;
    c.getContext('2d').drawImage(atlas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  } else {
    c = placeholder(key);
  }
  cache.set(key, c);
  return c;
}

// ---------- 占位图形（风格统一的剪影+色块） ----------
function P(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.lineWidth = 3; x.lineJoin = 'round';
  fn(x, w, h);
  return c;
}
function body(x, cx, cy, r, fill, stroke = '#2a2030') {
  x.fillStyle = fill; x.strokeStyle = stroke;
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.stroke();
}
function tri(x, pts, fill, stroke = '#2a2030') {
  x.fillStyle = fill; x.strokeStyle = stroke;
  x.beginPath(); x.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
  x.closePath(); x.fill(); x.stroke();
}
function ellipse(x, cx, cy, rx, ry, fill, stroke = '#2a2030') {
  x.fillStyle = fill; x.strokeStyle = stroke;
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); x.stroke();
}

const PH = {
  // 米斯蒂娅（粉发棕裙、帽、翅膀）
  mystia_front: () => P(96, 96, x => {
    ellipse(x, 30, 55, 16, 10, '#f0c0d8'); ellipse(x, 66, 55, 16, 10, '#f0c0d8'); // 翅膀
    ellipse(x, 48, 60, 16, 20, '#8a6248');                       // 裙
    body(x, 48, 38, 14, '#ffd8c8');                              // 脸
    x.fillStyle = '#f8a8c0'; x.beginPath(); x.arc(48, 32, 14, Math.PI, 0); x.fill(); x.stroke(); // 粉发
    tri(x, [38, 26, 58, 26, 48, 10], '#7a5238');                 // 帽
    x.fillStyle = '#2a2030';
    x.beginPath(); x.arc(43, 40, 2, 0, 7); x.arc(53, 40, 2, 0, 7); x.fill();
    x.strokeStyle = '#2a2030'; x.beginPath(); x.arc(48, 46, 4, 0.2, Math.PI - 0.2); x.stroke();
  }),
  mystia_side: () => P(96, 96, x => {
    ellipse(x, 60, 52, 18, 10, '#f0c0d8');
    ellipse(x, 48, 60, 14, 20, '#8a6248');
    body(x, 44, 38, 14, '#ffd8c8');
    x.fillStyle = '#f8a8c0'; x.beginPath(); x.arc(46, 32, 14, Math.PI * 0.8, Math.PI * 2.05); x.fill(); x.stroke();
    tri(x, [34, 26, 54, 26, 42, 10], '#7a5238');
    x.fillStyle = '#2a2030'; x.beginPath(); x.arc(38, 40, 2, 0, 7); x.fill();
  }),
  mystia_back: () => P(96, 96, x => {
    ellipse(x, 26, 52, 18, 10, '#f0c0d8'); ellipse(x, 70, 52, 18, 10, '#f0c0d8');
    ellipse(x, 48, 60, 16, 20, '#8a6248');
    body(x, 48, 36, 14, '#f8a8c0');
    tri(x, [38, 26, 58, 26, 48, 10], '#7a5238');
  }),
  // 生物
  fairy: () => P(80, 80, x => {
    ellipse(x, 22, 30, 12, 18, '#cfe8ff'); ellipse(x, 58, 30, 12, 18, '#cfe8ff');
    ellipse(x, 40, 52, 12, 16, '#7ab8f0');
    body(x, 40, 34, 12, '#ffe0d0');
    x.fillStyle = '#68a0e0'; x.beginPath(); x.arc(40, 28, 12, Math.PI, 0); x.fill(); x.stroke();
    x.fillStyle = '#2a2030'; x.beginPath(); x.arc(36, 36, 1.8, 0, 7); x.arc(44, 36, 1.8, 0, 7); x.fill();
  }),
  fairy_hostile: () => P(80, 80, x => {
    ellipse(x, 22, 30, 12, 18, '#a090c0'); ellipse(x, 58, 30, 12, 18, '#a090c0');
    ellipse(x, 40, 52, 12, 16, '#584878');
    body(x, 40, 34, 12, '#e8d0d0');
    x.fillStyle = '#483858'; x.beginPath(); x.arc(40, 28, 12, Math.PI, 0); x.fill(); x.stroke();
    x.fillStyle = '#ff3050'; x.beginPath(); x.arc(36, 36, 2.5, 0, 7); x.arc(44, 36, 2.5, 0, 7); x.fill();
  }),
  kedama: () => P(72, 72, x => {
    body(x, 36, 40, 22, '#f4f0e8');
    x.fillStyle = '#2a2030';
    x.beginPath(); x.arc(29, 36, 2.5, 0, 7); x.arc(43, 36, 2.5, 0, 7); x.fill();
    x.beginPath(); x.arc(36, 44, 3, 0, Math.PI); x.stroke();
  }),
  spirit: () => P(80, 96, x => {
    x.fillStyle = '#cfe0ff'; x.strokeStyle = '#4a5a8a';
    x.beginPath();
    x.moveTo(22, 40); x.arc(40, 40, 18, Math.PI, 0); x.lineTo(58, 70);
    x.quadraticCurveTo(50, 62, 46, 72); x.quadraticCurveTo(40, 62, 34, 72);
    x.quadraticCurveTo(28, 62, 22, 70); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#22304a';
    x.beginPath(); x.ellipse(34, 40, 3, 5, 0, 0, 7); x.ellipse(46, 40, 3, 5, 0, 0, 7); x.fill();
  }),
  sparrow: () => P(56, 56, x => {
    ellipse(x, 28, 34, 14, 11, '#a88050');
    body(x, 36, 24, 8, '#c09868');
    tri(x, [44, 22, 52, 25, 44, 28], '#e8b060');
    x.fillStyle = '#2a2030'; x.beginPath(); x.arc(38, 22, 1.6, 0, 7); x.fill();
    tri(x, [14, 32, 8, 26, 16, 26], '#8a6840');
  }),
  lamprey: () => P(90, 48, x => {
    x.strokeStyle = '#2a2030'; x.fillStyle = '#6a5a48';
    x.beginPath(); x.ellipse(45, 24, 34, 9, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#8a7a60'; x.beginPath(); x.arc(16, 24, 6, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#2a2030'; x.beginPath(); x.arc(16, 24, 3, 0, 7); x.fill();
  }),
  treeguard: () => P(140, 160, x => {
    x.fillStyle = '#5a4632'; x.strokeStyle = '#2a2030';
    x.beginPath(); x.moveTo(50, 150); x.quadraticCurveTo(46, 90, 52, 40);
    x.quadraticCurveTo(70, 20, 88, 40); x.quadraticCurveTo(94, 90, 90, 150);
    x.lineTo(78, 150); x.lineTo(74, 132); x.lineTo(66, 132); x.lineTo(62, 150); x.closePath();
    x.fill(); x.stroke();
    tri(x, [40, 60, 14, 44, 44, 44], '#5a4632');   // 左臂
    tri(x, [100, 60, 126, 44, 96, 44], '#5a4632'); // 右臂
    ellipse(x, 58, 34, 16, 12, '#3d5a3f'); ellipse(x, 84, 30, 18, 13, '#46684a');
    x.fillStyle = '#ffb030';
    x.beginPath(); x.arc(62, 58, 3.5, 0, 7); x.arc(78, 58, 3.5, 0, 7); x.fill();
    x.strokeStyle = '#2a2030'; x.beginPath(); x.arc(70, 72, 7, 0.3, Math.PI - 0.3); x.stroke();
  }),
  rumia: () => P(88, 96, x => {
    x.globalAlpha = 0.35; x.fillStyle = '#1a1030';
    x.beginPath(); x.arc(44, 48, 38, 0, 7); x.fill(); x.globalAlpha = 1;
    ellipse(x, 44, 62, 14, 18, '#2a2438');                 // 黑裙
    body(x, 44, 38, 13, '#ffe0d0');
    x.fillStyle = '#f8e088'; x.beginPath(); x.arc(44, 32, 13, Math.PI, 0); x.fill(); x.stroke(); // 金发
    ellipse(x, 33, 26, 5, 7, '#e03040');                   // 缎带
    x.fillStyle = '#b02838';
    x.beginPath(); x.arc(39, 40, 2, 0, 7); x.arc(49, 40, 2, 0, 7); x.fill();
    // 张开的手臂
    x.strokeStyle = '#2a2030'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(30, 52); x.lineTo(14, 44); x.moveTo(58, 52); x.lineTo(74, 44); x.stroke();
  }),
  yuuka: () => P(140, 190, x => {
    // 阳伞
    x.fillStyle = '#f0a0b8'; x.strokeStyle = '#2a2030';
    x.beginPath(); x.moveTo(70, 6); x.arc(70, 66, 62, -Math.PI * 0.85, -Math.PI * 0.15); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(70, 10); x.lineTo(70, 96); x.stroke();
    ellipse(x, 70, 120, 20, 34, '#b03048');                 // 裙
    x.fillStyle = '#d0e0c0';
    x.fillRect(58, 84, 24, 20); x.strokeRect(58, 84, 24, 20); // 上身
    body(x, 70, 66, 15, '#ffe0d0');
    x.fillStyle = '#78b060'; x.beginPath(); x.arc(70, 58, 15, Math.PI, 0); x.fill(); x.stroke(); // 绿发
    x.fillStyle = '#a02838';
    x.beginPath(); x.arc(64, 68, 2.4, 0, 7); x.arc(76, 68, 2.4, 0, 7); x.fill();
    x.strokeStyle = '#2a2030'; x.beginPath(); x.arc(70, 74, 5, 0.2, Math.PI - 0.2); x.stroke();
  }),
  yuuka_enraged: () => P(140, 190, x => {
    x.globalAlpha = 0.25; x.fillStyle = '#ff2050';
    x.beginPath(); x.arc(70, 100, 80, 0, 7); x.fill(); x.globalAlpha = 1;
    // 收起的伞当枪
    x.strokeStyle = '#2a2030'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(20, 150); x.lineTo(110, 90); x.stroke();
    tri(x, [110, 90, 124, 82, 112, 78], '#f0a0b8');
    x.lineWidth = 3;
    ellipse(x, 70, 120, 20, 34, '#982838');
    x.fillStyle = '#c8d8b8'; x.fillRect(58, 84, 24, 20); x.strokeRect(58, 84, 24, 20);
    body(x, 70, 66, 15, '#ffe0d0');
    x.fillStyle = '#68a050';
    x.beginPath(); x.moveTo(55, 60);
    for (let i = 0; i <= 6; i++) x.lineTo(55 + i * 5, 42 + (i % 2) * 10);
    x.lineTo(85, 60); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#ff1030';
    x.beginPath(); x.arc(64, 68, 3.2, 0, 7); x.arc(76, 68, 3.2, 0, 7); x.fill();
    x.strokeStyle = '#2a2030'; x.beginPath(); x.moveTo(60, 78); x.lineTo(80, 78); x.stroke();
  }),
  // 植被
  magic_tree: () => P(150, 190, x => {
    x.fillStyle = '#4a3a30'; x.strokeStyle = '#241a20';
    x.beginPath(); x.moveTo(62, 188); x.quadraticCurveTo(70, 120, 64, 88);
    x.lineTo(86, 88); x.quadraticCurveTo(80, 120, 88, 188); x.closePath(); x.fill(); x.stroke();
    ellipse(x, 75, 60, 52, 38, '#5a4a78');
    ellipse(x, 42, 76, 28, 20, '#4e3e68'); ellipse(x, 108, 76, 28, 20, '#665485');
    // 发光蘑菇
    for (const [mx, my] of [[60, 130], [84, 148], [70, 162]]) {
      x.fillStyle = '#60d8e8';
      x.beginPath(); x.arc(mx, my, 5, Math.PI, 0); x.fill();
      x.fillRect(mx - 2, my, 4, 5);
    }
  }),
  magic_tree_stump: () => P(90, 60, x => {
    x.fillStyle = '#4a3a30'; x.strokeStyle = '#241a20';
    x.beginPath(); x.moveTo(22, 58); x.lineTo(28, 22); x.lineTo(62, 22); x.lineTo(68, 58); x.closePath(); x.fill(); x.stroke();
    ellipse(x, 45, 22, 17, 7, '#c0a880');
    x.fillStyle = '#60d8e8'; x.beginPath(); x.arc(30, 40, 4, Math.PI, 0); x.fill();
  }),
  pine: () => P(130, 180, x => {
    x.fillStyle = '#4a3a30'; x.fillRect(58, 150, 14, 28); x.strokeRect(58, 150, 14, 28);
    tri(x, [65, 12, 22, 90, 108, 90], '#2e5238');
    tri(x, [65, 52, 16, 130, 114, 130], '#386142');
    tri(x, [65, 96, 24, 162, 106, 162], '#42704c');
  }),
  pine_stump: () => P(70, 44, x => {
    x.fillStyle = '#4a3a30'; x.strokeStyle = '#241a20';
    x.beginPath(); x.moveTo(18, 42); x.lineTo(23, 16); x.lineTo(47, 16); x.lineTo(52, 42); x.closePath(); x.fill(); x.stroke();
    ellipse(x, 35, 16, 12, 5, '#c0a880');
  }),
  bamboo: () => P(110, 190, x => {
    x.strokeStyle = '#24502a';
    for (const [bx, w] of [[35, 10], [55, 12], [75, 9]]) {
      x.fillStyle = '#58a848';
      x.fillRect(bx, 20, w, 168); x.strokeRect(bx, 20, w, 168);
      x.fillStyle = '#24502a';
      for (let y = 48; y < 180; y += 32) x.fillRect(bx, y, w, 3);
    }
    tri(x, [20, 40, 46, 30, 22, 52], '#6cb858'); tri(x, [88, 36, 64, 28, 86, 48], '#6cb858');
  }),
  bamboo_stump: () => P(90, 40, x => {
    x.strokeStyle = '#24502a';
    for (const [bx, h] of [[24, 22], [44, 30], [62, 18]]) {
      x.fillStyle = '#58a848'; x.fillRect(bx, 38 - h, 9, h); x.strokeRect(bx, 38 - h, 9, h);
    }
  }),
  grass_tuft: () => P(60, 54, x => {
    x.strokeStyle = '#3d6a34'; x.lineWidth = 4;
    for (const [x0, bend, h] of [[14, -6, 40], [26, -2, 48], [38, 2, 44], [48, 6, 36]]) {
      x.beginPath(); x.moveTo(x0, 52);
      x.quadraticCurveTo(x0 + bend, 52 - h * 0.6, x0 + bend * 2, 52 - h); x.stroke();
    }
    x.lineWidth = 3;
  }),
  sapling: () => P(56, 66, x => {
    x.strokeStyle = '#4a3a28'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(28, 64); x.lineTo(28, 26); x.stroke();
    x.lineWidth = 4;
    x.beginPath(); x.moveTo(28, 44); x.lineTo(14, 30); x.moveTo(28, 38); x.lineTo(42, 24); x.stroke();
    x.fillStyle = '#68a848';
    x.beginPath(); x.arc(14, 28, 6, 0, 7); x.arc(42, 22, 6, 0, 7); x.arc(28, 20, 7, 0, 7); x.fill(); x.stroke();
    x.lineWidth = 3;
  }),
  glowshrooms: () => P(80, 70, x => {
    for (const [mx, mh, mr] of [[24, 30, 12], [48, 44, 15], [62, 24, 9]]) {
      x.fillStyle = '#d8f8f8'; x.fillRect(mx - 3, 68 - mh, 6, mh); x.strokeRect(mx - 3, 68 - mh, 6, mh);
      x.fillStyle = '#40c8e0';
      x.beginPath(); x.arc(mx, 68 - mh, mr, Math.PI, 0); x.fill(); x.stroke();
      x.fillStyle = '#bff8ff';
      x.beginPath(); x.arc(mx - mr * 0.3, 68 - mh - mr * 0.4, 2.4, 0, 7); x.fill();
    }
  }),
  mushroom_tiny: () => P(50, 44, x => {
    x.fillStyle = '#f0e0c8'; x.fillRect(21, 22, 8, 18); x.strokeRect(21, 22, 8, 18);
    x.fillStyle = '#d83838';
    x.beginPath(); x.arc(25, 22, 14, Math.PI, 0); x.fill(); x.stroke();
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(19, 16, 2.4, 0, 7); x.arc(29, 12, 2, 0, 7); x.fill();
  }),
  sunflower: () => P(70, 120, x => {
    x.strokeStyle = '#3d6a34'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(35, 118); x.lineTo(35, 46); x.stroke();
    tri(x, [35, 90, 18, 78, 35, 80], '#4a7a40'); tri(x, [35, 100, 52, 88, 35, 90], '#4a7a40');
    x.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ellipse(x, 35 + Math.cos(a) * 16, 34 + Math.sin(a) * 16, 7, 4, '#f8c830');
    }
    body(x, 35, 34, 12, '#8a5a28');
  }),
  boulder: () => P(100, 80, x => {
    x.fillStyle = '#8a8a8a'; x.strokeStyle = '#3a3a42';
    x.beginPath(); x.moveTo(10, 70); x.lineTo(20, 30); x.lineTo(48, 14);
    x.lineTo(80, 26); x.lineTo(92, 62); x.lineTo(70, 74); x.closePath(); x.fill(); x.stroke();
    x.strokeStyle = '#6a6a72'; x.beginPath(); x.moveTo(30, 40); x.lineTo(50, 34); x.moveTo(56, 52); x.lineTo(74, 48); x.stroke();
    ellipse(x, 30, 26, 10, 5, '#6a8a5a');
  }),
  gold_boulder: () => P(100, 80, x => {
    x.fillStyle = '#8a8a8a'; x.strokeStyle = '#3a3a42';
    x.beginPath(); x.moveTo(10, 70); x.lineTo(20, 30); x.lineTo(48, 14);
    x.lineTo(80, 26); x.lineTo(92, 62); x.lineTo(70, 74); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#f8c830'; x.strokeStyle = '#8a6a10';
    x.beginPath(); x.moveTo(28, 44) ; x.lineTo(40, 34); x.lineTo(48, 44); x.lineTo(38, 54); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(58, 28); x.lineTo(70, 24); x.lineTo(74, 36); x.lineTo(62, 38); x.closePath(); x.fill(); x.stroke();
  }),
  grass_blades: () => P(40, 30, x => {
    x.strokeStyle = '#4a7a40'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(8, 28); x.lineTo(12, 8); x.moveTo(18, 28); x.lineTo(20, 4);
    x.moveTo(28, 28); x.lineTo(26, 10); x.stroke();
  }),
  // 建筑
  campfire_lit: () => P(90, 80, x => {
    ellipse(x, 45, 66, 34, 10, '#5a5a62');
    x.strokeStyle = '#4a3a28'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(26, 66); x.lineTo(64, 56); x.moveTo(26, 56); x.lineTo(64, 66); x.stroke();
    x.lineWidth = 3;
    x.fillStyle = '#f88030'; x.strokeStyle = '#a03810';
    x.beginPath(); x.moveTo(45, 12); x.quadraticCurveTo(62, 34, 52, 50);
    x.quadraticCurveTo(45, 58, 38, 50); x.quadraticCurveTo(28, 34, 45, 12); x.fill(); x.stroke();
    x.fillStyle = '#ffd040';
    x.beginPath(); x.moveTo(45, 28); x.quadraticCurveTo(54, 40, 45, 50); x.quadraticCurveTo(36, 40, 45, 28); x.fill();
  }),
  campfire_out: () => P(90, 60, x => {
    ellipse(x, 45, 48, 32, 9, '#5a5a62');
    x.strokeStyle = '#2a2018'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(26, 48); x.lineTo(64, 40); x.moveTo(26, 40); x.lineTo(64, 48); x.stroke();
  }),
  fire_pit: () => P(110, 80, x => {
    ellipse(x, 55, 62, 44, 13, '#6a6a72');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      body(x, 55 + Math.cos(a) * 40, 62 + Math.sin(a) * 11, 6, '#9a9aa2');
    }
    x.fillStyle = '#f88030'; x.strokeStyle = '#a03810';
    x.beginPath(); x.moveTo(55, 22); x.quadraticCurveTo(70, 40, 58, 54);
    x.quadraticCurveTo(50, 60, 46, 52); x.quadraticCurveTo(40, 40, 55, 22); x.fill(); x.stroke();
  }),
  kappa_workbench: () => P(130, 100, x => {
    x.fillStyle = '#8a6a48'; x.strokeStyle = '#2a2030';
    x.fillRect(14, 40, 102, 14); x.strokeRect(14, 40, 102, 14);
    x.fillRect(22, 54, 12, 40); x.strokeRect(22, 54, 12, 40);
    x.fillRect(96, 54, 12, 40); x.strokeRect(96, 54, 12, 40);
    // 齿轮
    x.fillStyle = '#58a8a0';
    for (const [gx, gy, gr] of [[44, 28, 12], [66, 24, 9]]) {
      x.beginPath(); x.arc(gx, gy, gr, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#2a2030'; x.beginPath(); x.arc(gx, gy, gr * 0.35, 0, 7); x.fill();
      x.fillStyle = '#58a8a0';
    }
    x.strokeStyle = '#b8b8c0'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(86, 38); x.lineTo(86, 18); x.moveTo(80, 22); x.lineTo(92, 22); x.stroke();
    x.lineWidth = 3;
  }),
  yatai: () => P(170, 150, x => {
    x.fillStyle = '#8a6248'; x.strokeStyle = '#2a2030';
    x.fillRect(20, 60, 130, 60); x.strokeRect(20, 60, 130, 60);     // 车体
    x.fillStyle = '#6a4a38';
    x.fillRect(14, 44, 142, 16); x.strokeRect(14, 44, 142, 16);     // 台面
    x.fillStyle = '#7a5238';
    x.beginPath(); x.moveTo(10, 44); x.lineTo(30, 16); x.lineTo(140, 16); x.lineTo(160, 44); x.closePath(); x.fill(); x.stroke(); // 顶
    // 红灯笼
    for (const lx of [40, 130]) {
      x.strokeStyle = '#2a2030'; x.beginPath(); x.moveTo(lx, 44); x.lineTo(lx, 52); x.stroke();
      ellipse(x, lx, 62, 10, 12, '#e04040');
      x.fillStyle = '#ffd890'; x.fillRect(lx - 4, 52, 8, 3);
    }
    // 车轮
    body(x, 50, 126, 12, '#5a4632'); body(x, 120, 126, 12, '#5a4632');
    // 烤串
    x.strokeStyle = '#d8b880'; x.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      x.beginPath(); x.moveTo(70 + i * 12, 44); x.lineTo(70 + i * 12, 30); x.stroke();
      x.fillStyle = '#b08050'; x.beginPath(); x.arc(70 + i * 12, 36, 4, 0, 7); x.fill();
    }
  }),
  chest: () => P(90, 70, x => {
    x.fillStyle = '#8a6248'; x.strokeStyle = '#2a2030';
    x.fillRect(12, 26, 66, 38); x.strokeRect(12, 26, 66, 38);
    x.fillStyle = '#9a7258';
    x.beginPath(); x.moveTo(12, 26); x.quadraticCurveTo(45, 4, 78, 26); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#4a4a52'; x.fillRect(40, 24, 10, 12); x.strokeRect(40, 24, 10, 12);
  }),
  trap: () => P(70, 40, x => {
    x.strokeStyle = '#6a5a38'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(8, 36); x.lineTo(35, 6); x.lineTo(62, 36); x.stroke();
    x.beginPath(); x.moveTo(20, 36); x.lineTo(35, 18); x.lineTo(50, 36); x.stroke();
    x.lineWidth = 3;
  }),
  // 图标（占位：直接画符号）
  _icon: (label, bg) => P(56, 56, x => {
    x.fillStyle = bg; x.strokeStyle = '#2a2030';
    x.beginPath(); x.arc(28, 28, 22, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 20px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(label, 28, 29);
  }),
};

const ICON_STYLE = {
  grass: ['草', '#6a9a50'], twigs: ['枝', '#9a7a50'], flint: ['燧', '#8a8a92'], log: ['木', '#a8763e'],
  stone: ['石', '#9a9aa2'], gold: ['金', '#f0c040'], feather: ['羽', '#5a4a7a'], bamboo_piece: ['竹', '#58a848'],
  rope: ['绳', '#c8a860'], plank: ['板', '#b08a58'], cut_stone: ['切', '#aaaab2'],
  axe: ['斧', '#b08040'], pickaxe: ['镐', '#909098'], fishing_rod: ['竿', '#a89060'], torch: ['火', '#f08030'],
  spear: ['枪', '#a8a8b0'], lamprey_bat: ['串', '#b08050'], wood_armor: ['甲', '#9a7a50'],
  flower_garland: ['环', '#f0a0c0'], parasol: ['伞', '#f0a0b8'], charm: ['符', '#f0e0a0'], trap: ['阱', '#8a7a48'],
  red_mushroom: ['菇', '#d83838'], blue_mushroom: ['菇', '#40c8e0'], petals: ['瓣', '#f0a0c0'],
  ginseng: ['参', '#d8c8a0'], dark_berries: ['莓', '#7a5a9a'], raw_meat: ['肉', '#e08080'],
  raw_lamprey: ['鳗', '#6a5a48'], egg: ['蛋', '#f0ead8'],
  roast_mushrooms: ['烤', '#c88840'], roast_meat: ['肉', '#b06040'], roast_egg: ['蛋', '#f0c860'],
  grilled_lamprey: ['鳗', '#c87830'], fairy_stew: ['汤', '#90c060'], tsukimi_dango: ['团', '#f0e0e0'],
  bamboo_rice: ['饭', '#78b060'], dark_cuisine: ['暗', '#3a3040'], rice_ball: ['团', '#e8e8e0'], salve: ['药', '#80c0a0'],
  grass_blades: ['·', '#6a9a50'], sapling_icon: ['苗', '#68a848'], ginseng_plant: ['参', '#d8c8a0'],
  red_mushroom_patch: ['菇', '#d83838'],
};

function placeholder(key) {
  // 图标键
  if (ICON_STYLE[key]) return PH._icon(...ICON_STYLE[key]);
  if (PH[key]) return PH[key]();
  // 默认
  return PH._icon(key.slice(0, 1), '#666');
}
