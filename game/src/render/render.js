// render.js — 世界渲染：地面缓存块、实体 y 排序、光照、天气氛围。
import { getSprite } from './assets.js';
import { paintGroundTile } from '../world/world.js';
import { BIOME_INFO, PHASES, PLAYER } from '../game/defs.js';
import { drawParticles } from './particles.js';
import { lightAt } from '../game/systems.js';
import { clamp } from '../engine/engine.js';

const TILE = 512;
const tileCache = new Map(); // "tx,ty" -> canvas

window.__defs_cache = { BIOME_INFO }; // paintGroundTile 用

function groundTile(world, tx, ty) {
  const k = tx + ',' + ty;
  let c = tileCache.get(k);
  if (c) {
    tileCache.delete(k); tileCache.set(k, c); // 触碰刷新 LRU 序（Map 保持插入序）
    return c;
  }
  if (tileCache.size >= 64) { // 逐出最久未用的一块，而不是全清（全清会引发重绘风暴）；64 块 ≈ 64MB 上限
    const oldest = tileCache.keys().next().value;
    tileCache.delete(oldest);
  }
  c = document.createElement('canvas');
  c.width = TILE; c.height = TILE;
  paintGroundTile(world, c, tx, ty, TILE);
  tileCache.set(k, c);
  return c;
}

export function drawWorld(ctx, st, cam, W, H, tNow) {
  // 地面
  const x0 = Math.floor((cam.x) / TILE) * TILE, x1 = cam.x + W;
  const y0 = Math.floor((cam.y) / TILE) * TILE, y1 = cam.y + H;
  for (let ty = y0; ty < y1; ty += TILE) {
    for (let tx = x0; tx < x1; tx += TILE) {
      ctx.drawImage(groundTile(st.world, tx, ty), tx - cam.x, ty - cam.y);
    }
  }

  // 收集可见实体并按 y 排序
  const vis = [];
  for (const e of st.entities) {
    if (e.dead) continue;
    if (e.x < cam.x - 200 || e.x > cam.x + W + 200 || e.y < cam.y - 260 || e.y > cam.y + H + 120) continue;
    vis.push(e);
  }
  vis.sort((a, b) => (a.y + (a.footOff || 0)) - (b.y + (b.footOff || 0)));

  for (const e of vis) drawEntity(ctx, st, e, cam, tNow);
  drawParticles(ctx, cam);

  // 幽香领地花瓣飘落（氛围）
  const g = st.world.garden;
  if (g && Math.hypot(st.player.x - g.x, st.player.y - g.y) < 900) {
    ctx.fillStyle = '#ffd860';
    for (let i = 0; i < 12; i++) {
      const px = cam.x + ((i * 271 + tNow * 30) % (W + 80)) - 40;
      const py = cam.y + ((i * 173 + tNow * 45 + Math.sin(tNow + i) * 20) % (H + 60)) - 30;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(px - cam.x, py - cam.y, 4, 2.4, tNow * 2 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawEntity(ctx, st, e, cam, tNow) {
  const sx = e.x - cam.x, sy = e.y - cam.y;
  if (e.kind === 'natural') return drawNatural(ctx, e, sx, sy, tNow);
  if (e.kind === 'building') return drawBuilding(ctx, st, e, sx, sy, tNow);
  if (e.kind === 'creature') return drawCreature(ctx, st, e, sx, sy, tNow);
  if (e.kind === 'player') return drawPlayer(ctx, st, e, sx, sy, tNow);
  if (e.kind === 'drop') return drawDrop(ctx, e, sx, sy, tNow);
  if (e.kind === 'projectile') return drawProjectile(ctx, e, sx, sy);
}

function drawShadow(ctx, sx, sy, rx, ry) {
  ctx.fillStyle = 'rgba(20,20,30,0.28)';
  ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function drawNatural(ctx, e, sx, sy, tNow) {
  const key = e.stumpSprite || e.def.sprite || e.id;
  if (e.picked && !e.stumpSprite) return; // 采完无桩→不画
  const spr = getSprite(key);
  const sc = scaleFor(e.id);
  const w = spr.width * sc, h = spr.height * sc;
  drawShadow(ctx, sx, sy, w * 0.3, w * 0.12);
  const shake = e.shakeT ? Math.sin(tNow * 60) * e.shakeT * 10 : 0;
  const sway = isTree(e.id) && !e.picked ? Math.sin(tNow * 1.2 + e.sway) * 0.02 : 0;
  ctx.save();
  ctx.translate(sx + shake, sy);
  ctx.rotate(sway);
  ctx.drawImage(spr, -w / 2, -h, w, h);
  ctx.restore();
  if (e.id === 'glowshrooms' && !e.picked) {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(tNow * 2 + e.sway) * 0.15;
    ctx.fillStyle = '#60e8ff';
    ctx.beginPath(); ctx.arc(sx, sy - 14, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (e.id === 'berry_bush' && !e.picked) { // 与树苗共用精灵，点上浆果作区分
    ctx.fillStyle = '#7a5a9a';
    ctx.beginPath();
    ctx.arc(sx - 10, sy - 52, 4, 0, Math.PI * 2);
    ctx.arc(sx + 11, sy - 58, 4, 0, Math.PI * 2);
    ctx.arc(sx + 1, sy - 70, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
function isTree(id) { return id === 'magic_tree' || id === 'pine' || id === 'bamboo' || id === 'sunflower'; }
function scaleFor(id) {
  switch (id) {
    case 'magic_tree': case 'pine': return 1.5;
    case 'bamboo': return 1.3;
    case 'treeguard': return 1.4;
    case 'magic_tree_stump': case 'pine_stump': case 'bamboo_stump': return 1.0;
    case 'boulder': case 'gold_boulder': return 1.1;
    case 'sunflower': return 0.9;
    case 'flint_stone': return 0.34;        // 图集帧是图标尺寸，地面燧石要小
    case 'red_mushroom_patch': case 'ginseng_plant': return 0.5;
    default: return 1.0;
  }
}

function drawBuilding(ctx, st, e, sx, sy, tNow) {
  let key = e.id;
  if (e.id === 'campfire' && !e.lit) key = 'campfire_out';
  const spr = getSprite(key);
  const sc = e.id === 'yatai' ? 1.3 : 1.0;
  const w = spr.width * sc, h = spr.height * sc;
  drawShadow(ctx, sx, sy, w * 0.36, w * 0.14);
  ctx.drawImage(spr, sx - w / 2, sy - h, w, h);
  // 火焰光晕动画
  if (e.lit && (e.id === 'campfire' || e.id === 'fire_pit')) {
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(tNow * 9 + e.sway) * 0.08;
    const g = ctx.createRadialGradient(sx, sy - 16, 4, sx, sy - 16, 60);
    g.addColorStop(0, '#ffb040'); g.addColorStop(1, 'rgba(255,128,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy - 16, 60, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 火星
    if (Math.random() < 0.12) {
      ctx.fillStyle = '#ffc860';
      ctx.fillRect(sx + (Math.random() - 0.5) * 20, sy - 30 - Math.random() * 24, 2, 2);
    }
  }
  // 屋台出锅提示
  if (e.id === 'yatai' && e.readyDish) {
    ctx.save();
    ctx.translate(sx, sy - h - 18 + Math.sin(tNow * 3) * 4);
    ctx.fillStyle = '#ffe080';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦ 出锅了!', 0, 0);
    ctx.restore();
  }
  if (e.id === 'trap' && e.trapCaught) {
    ctx.fillStyle = '#ffd0a0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('逮住了!', sx, sy - 40);
  }
  // 血条(烹饪进度)
  if (e.cooking) {
    const p = 1 - e.cookT / 6;
    bar(ctx, sx - 30, sy - h - 10, 60, 6, p, '#ffb040', '#402010');
  }
}

function drawCreature(ctx, st, e, sx, sy, tNow) {
  if (e.hidden) return;
  let key = e.id === 'yuuka' && e.enraged ? e.def.spriteEnraged : e.def.sprite;
  const spr = getSprite(key);
  const sc = e.id === 'yuuka' ? 1.35 : e.id === 'treeguard' ? 1.3 : e.id === 'rumia' ? 1.1 : 1.0;
  const w = spr.width * sc, h = spr.height * sc;
  const bob = Math.sin(e.walkPh) * (e.state === 'chase' || e.state === 'combat' ? 3 : 1.5);
  const floatY = (e.id === 'fairy' || e.id === 'fairy_hostile' || e.id === 'spirit' || e.id === 'kedama' || e.id === 'rumia')
    ? Math.sin(tNow * 2.5 + e.spawnT) * 5 - 6 : 0;
  drawShadow(ctx, sx, sy, w * 0.28, w * 0.1);
  ctx.save();
  ctx.translate(sx, sy + floatY + bob);
  if (e.face < 0) ctx.scale(-1, 1);
  // 受击闪白
  ctx.drawImage(spr, -w / 2, -h, w, h);
  if (e.hitFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = e.hitFlash * 3;
    ctx.drawImage(spr, -w / 2, -h, w, h);
  }
  ctx.restore();
  // 眩晕星星
  if (e.stun > 0) {
    ctx.fillStyle = '#ffe080';
    for (let i = 0; i < 3; i++) {
      const a = tNow * 4 + i * 2.1;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * 16, sy - h - 6 + Math.sin(a) * 5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 血条
  if (e.hp < e.maxHp && !e.def.friendly) {
    bar(ctx, sx - 24, sy - h - 8, 48, 5, e.hp / e.maxHp, '#e04040', '#301010');
  }
  // 幽香 Boss 血条（屏幕顶部，由 HUD 画）
  // 挥击
  if (e.swingT > 0) {
    ctx.save();
    ctx.globalAlpha = e.swingT * 3;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx + e.face * 30, sy - 20, 26, -0.8, 0.8);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlayer(ctx, st, p, sx, sy, tNow) {
  const key = 'mystia_' + (p.dir === 'side' ? 'side' : p.dir);
  const spr = getSprite(key);
  const sc = 1.25;
  const w = spr.width * sc, h = spr.height * sc;
  const bob = p.moving ? Math.abs(Math.sin(p.walkPh)) * -4 : Math.sin(tNow * 2) * 1.5;
  drawShadow(ctx, sx, sy, w * 0.26, w * 0.1);
  ctx.save();
  ctx.translate(sx, sy + bob);
  if (p.dir === 'side' && p.face < 0) ctx.scale(-1, 1);
  ctx.drawImage(spr, -w / 2, -h, w, h);
  if (p.hitFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p.hitFlash * 2.5;
    ctx.drawImage(spr, -w / 2, -h, w, h);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  // 攻击挥击
  if (p.swingT > 0) {
    ctx.save();
    ctx.globalAlpha = p.swingT * 4;
    ctx.strokeStyle = '#fff0c0';
    ctx.lineWidth = 4;
    const fx = p.dir === 'side' ? p.face : 1;
    ctx.beginPath();
    ctx.arc(sx + fx * 34, sy - 24, 30, p.dir === 'side' ? (fx > 0 ? -0.9 : Math.PI - 0.9) : -0.9, p.dir === 'side' ? (fx > 0 ? 0.9 : Math.PI + 0.9) : 0.9);
    ctx.stroke();
    ctx.restore();
  }
  // 行动进度圈
  if (p.action) {
    const pr = p.actionT / p.action.dur;
    ctx.strokeStyle = '#ffe080';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy - h - 8, 10, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2);
    ctx.stroke();
  }
  // 钓鱼浮标
  if (p.fishing) {
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 30);
    ctx.quadraticCurveTo(sx + 40, sy - 50, p.fishing.x - cam0.x, p.fishing.y - cam0.y);
    ctx.stroke();
    ctx.fillStyle = '#e04040';
    ctx.beginPath();
    ctx.arc(p.fishing.x - cam0.x, p.fishing.y - cam0.y + Math.sin(tNow * 4) * 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
let cam0 = { x: 0, y: 0 };

function drawDrop(ctx, e, sx, sy, tNow) {
  const spr = getSprite(e.id);
  const bob = Math.sin(tNow * 3 + e.bobT) * 3;
  drawShadow(ctx, sx, sy, 10, 4);
  ctx.drawImage(spr, sx - 16, sy - 28 + bob, 32, 32);
  if (e.n > 1) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.strokeStyle = '#201018'; ctx.lineWidth = 3;
    ctx.strokeText('×' + e.n, sx + 16, sy + 2);
    ctx.fillText('×' + e.n, sx + 16, sy + 2);
  }
}

function drawProjectile(ctx, e, sx, sy) {
  ctx.save();
  ctx.translate(sx, sy - 6);
  ctx.rotate(e.spin);
  ctx.fillStyle = '#ff7090';
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath(); ctx.ellipse(8, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffd0d8';
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function bar(ctx, x, y, w, h, p, fg, bg) {
  p = clamp(p, 0, 1);
  ctx.fillStyle = bg;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, w * p, h);
}

// ---------- 光照 ----------
let lightCanvas = null, lctx = null;

export function drawLighting(ctx, st, cam, W, H, tNow) {
  cam0 = cam;
  const dark = st.darkness();
  if (dark <= 0.02) return;
  if (!lightCanvas || lightCanvas.width !== W || lightCanvas.height !== H) {
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = W; lightCanvas.height = H;
    lctx = lightCanvas.getContext('2d');
  }
  // 基础黑暗（压低不透明度，让夜晚有氛围但能看清地形）
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, H);
  const phase = st.phase();
  const base = phase === PHASES.DUSK ? 'rgba(24,16,48,' : 'rgba(10,14,36,';
  lctx.fillStyle = base + (dark * 0.58) + ')';
  lctx.fillRect(0, 0, W, H);
  // 挖光洞
  lctx.globalCompositeOperation = 'destination-out';
  const p = st.player;
  punchLight(lctx, p.x - cam.x, p.y - cam.y, phase === PHASES.NIGHT ? PLAYER.nightVision * 2.1 : 110, 0.85 + Math.sin(tNow * 2) * 0.05);
  const onScreen = (x, y, r) => x > cam.x - r && x < cam.x + W + r && y > cam.y - r && y < cam.y + H + r;
  for (const b of st.buildings) {
    if (!b.lit || b.dead || !onScreen(b.x, b.y, 320)) continue;
    const r = (b.id === 'fire_pit' ? 300 : 240) * (0.9 + Math.sin(tNow * 9 + b.sway) * 0.05);
    punchLight(lctx, b.x - cam.x, b.y - cam.y, r, 1);
  }
  const h = p.equip.hand;
  if (h && h.id === 'torch') punchLight(lctx, p.x - cam.x, p.y - cam.y, 270, 0.95);
  if (phase === PHASES.NIGHT) for (const n of st.naturals) {
    if (n.id === 'glowshrooms' && !n.picked && onScreen(n.x, n.y, 100)) {
      punchLight(lctx, n.x - cam.x, n.y - cam.y, 100, 0.5);
    }
  }
  ctx.drawImage(lightCanvas, 0, 0);
  // 黄昏橙色调 / 夜蓝色调
  if (phase === PHASES.DUSK) {
    ctx.fillStyle = `rgba(255,120,40,${0.10 * dark})`;
    ctx.fillRect(0, 0, W, H);
  } else if (phase === PHASES.NIGHT) {
    ctx.fillStyle = 'rgba(40,60,160,0.08)';
    ctx.fillRect(0, 0, W, H);
  }
}

function punchLight(lctx, x, y, r, a) {
  const g = lctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.7, `rgba(0,0,0,${a * 0.6})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = g;
  lctx.beginPath(); lctx.arc(x, y, r, 0, Math.PI * 2); lctx.fill();
}
