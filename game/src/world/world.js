// world.js — 世界生成：椭圆岛 + 角向群系扇区 + 确定性散布。
import { BIOME, SCATTER, NATURALS, DAY_LEN } from '../game/defs.js';
import { makeNoise, mulberry32, dist } from '../engine/engine.js';

export const WORLD_R = 2500;          // 岛半径
export const LAKE_BAND = 380;         // 湖带宽

export class World {
  constructor(seed = (Math.random() * 1e9) | 0) {
    this.seed = seed;
    this.fbm = makeNoise(seed);
    this.rnd = mulberry32(seed ^ 0x9e3779b9);
    // 花园中心（幽香领地）：扇区(Field)内一点
    this.garden = null;
    this.tiles = null; // 地面离屏 canvas
    this.scatterSeed = seed ^ 0x51ab;
  }

  // 群系判定：角度扇区 + 噪声扰动；超出岛界=水
  biomeAt(x, y) {
    const d = dist(x, y, 0, 0);
    const edgeNoise = this.fbm(x * 0.001, y * 0.001, 3) * 260;
    if (d > WORLD_R + edgeNoise) return BIOME.WATER;
    // 花园优先判定（幽香领地，位于花田扇区深处）
    if (this.garden && dist(x, y, this.garden.x, this.garden.y) < 420) return BIOME.GARDEN;
    // 中心 700 半径固定为森林（出生区稳定）
    if (d < 700) return BIOME.FOREST;
    const ang = Math.atan2(y, x) + Math.PI;          // 0..2π
    const wobble = this.fbm(x * 0.0006 + 7.3, y * 0.0006 - 2.1, 3) * 1.2;
    const sector = Math.floor(((ang + wobble + Math.PI / 4) % (Math.PI * 2)) / (Math.PI / 2));
    // 扇区顺序: 0 森林, 1 竹林, 2 花田, 3 山麓
    return [BIOME.FOREST, BIOME.BAMBOO, BIOME.FIELD, BIOME.HILL][sector & 3];
  }

  isWater(x, y) { return this.biomeAt(x, y) === BIOME.WATER; }

  // 找花园位置：花田扇区里离岸较远的点
  placeGarden() {
    const ang = (2 + 0.5) * (Math.PI / 2); // 花田扇区中心角
    for (let r = WORLD_R * 0.62; r < WORLD_R * 0.9; r += 40) {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (this.biomeAt(x, y) === BIOME.FIELD || dist(x, y, 0, 0) < WORLD_R - 500) {
        this.garden = { x, y };
        return;
      }
    }
    this.garden = { x: Math.cos(ang) * WORLD_R * 0.7, y: Math.sin(ang) * WORLD_R * 0.7 };
  }

  // 出生点：森林扇区近中心
  spawnPoint() {
    for (let i = 0; i < 200; i++) {
      const a = 0.5 * (Math.PI / 2) + (this.rnd() - 0.5) * 0.8;
      const r = 150 + this.rnd() * 400;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (this.biomeAt(x, y) === BIOME.FOREST) return { x, y };
    }
    return { x: 0, y: 0 };
  }

  // 生成自然物实体（交给 state.addNatural）
  scatterAll(addNatural) {
    const rnd = mulberry32(this.scatterSeed);
    const R = WORLD_R + 100, step = 92;
    let n = 0;
    for (let gy = -R; gy < R; gy += step) {
      for (let gx = -R; gx < R; gx += step) {
        const jx = gx + (rnd() - 0.5) * step * 1.4, jy = gy + (rnd() - 0.5) * step * 1.4;
        const b = this.biomeAt(jx, jy);
        if (b === BIOME.WATER) continue;
        const table = SCATTER[b];
        if (!table) continue;
        // 密度噪声：疏密有致
        const density = this.fbm(jx * 0.002 + 31, jy * 0.002 - 17, 3) + 0.62;
        if (rnd() > density * 0.55) continue;
        let sum = 0; for (const [, w] of table) sum += w;
        let pick = rnd() * sum, id = table[0][0];
        for (const [nid, w] of table) { pick -= w; if (pick <= 0) { id = nid; break; } }
        const def = NATURALS[id];
        // 花园内不许砍太阳花以外的东西
        if (b === BIOME.GARDEN && id !== 'sunflower') continue;
        // 出生点附近不刷大树（保证开局视野）
        addNatural(id, jx, jy, rnd());
        n++;
      }
    }
    return n;
  }
}

// 群系地面渲染到离屏 canvas（一次绘制，切块缓存）
export function paintGroundTile(world, canvas, tx, ty, size) {
  const ctx = canvas.getContext('2d');
  const { BIOME_INFO } = window.__defs_cache;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const cell = 8;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const wx = tx + px, wy = ty + py;
      const b = world.biomeAt(wx, wy);
      const info = BIOME_INFO[b];
      const n = world.fbm(wx * 0.02, wy * 0.02, 2);       // 细颗粒
      const n2 = world.fbm(wx * 0.006 + 11, wy * 0.006 - 5, 3); // 大块色斑
      let ci = n2 > 0.12 ? 1 : (n2 < -0.12 ? 2 : 0);
      let hex = info.ground[ci];
      let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), bl = parseInt(hex.slice(5, 7), 16);
      const fleck = (((wx / cell) | 0) * 73856093 ^ ((wy / cell) | 0) * 19349663) >>> 0;
      if ((fleck % 97) < 5) { // 碎花斑
        const fh = info.fleck;
        r = parseInt(fh.slice(1, 3), 16); g = parseInt(fh.slice(3, 5), 16); bl = parseInt(fh.slice(5, 7), 16);
      }
      const v = 1 + n * 0.08;
      const i = (py * size + px) * 4;
      d[i] = Math.min(255, r * v); d[i + 1] = Math.min(255, g * v); d[i + 2] = Math.min(255, bl * v); d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
