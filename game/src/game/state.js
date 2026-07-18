// state.js — 全局游戏状态、实体管理、存档。
import { PLAYER, DAY_LEN, SEG, PHASES, CREATURES, NATURALS, ITEMS, BIOME } from './defs.js';
import { Grid, dist2, clamp } from '../engine/engine.js';
import { World } from '../world/world.js';

export const SAVE_KEY = 'touhouds_save_v1';

export class State {
  constructor() {
    this.world = null;
    this.player = null;
    this.entities = [];      // 全部实体（含玩家）
    this.naturals = [];      // 自然物（树/石/草…）
    this.buildings = [];     // 建筑
    this.creatures = [];     // 生物
    this.drops = [];         // 掉落物
    this.projectiles = [];   // 弹幕
    this.grid = new Grid(160);
    this.time = { t: DAY_LEN * 0.1, day: 1 };  // t: 当天已过秒数
    this.running = true;
    this.speedMul = 1;       // 测试钩子用
    this.events = [];        // UI 消息队列
    this.yuukaSpawned = false;
    this.kedamaWaveDay = 3;  // 下次毛玉暴走
    this.rng = Math.random;
    this.stats = { kills: 0, dishes: 0, daysSurvived: 0 };
  }

  newGame(seed) {
    this.world = new World(seed);
    this.world.placeGarden();
    const sp = this.world.spawnPoint();
    this.player = makePlayer(sp.x, sp.y);
    this.entities.length = 0;
    this.naturals.length = 0; this.buildings.length = 0; this.creatures.length = 0;
    this.drops.length = 0; this.projectiles.length = 0;
    this.entities.push(this.player);
    this.world.scatterAll((id, x, y, r) => this.addNatural(id, x, y, r));
    // 开局保底：出生点周围一圈必有燧石/树枝/草（防止种子不佳导致做不出斧镐）
    const rnd = this.world.rnd;
    const starter = ['flint_stone', 'flint_stone', 'flint_stone', 'sapling', 'sapling', 'grass_tuft', 'grass_tuft', 'boulder'];
    starter.forEach((id, i) => {
      const a = (i / starter.length) * Math.PI * 2 + rnd() * 0.5;
      const d = 120 + rnd() * 160;
      const x = sp.x + Math.cos(a) * d, y = sp.y + Math.sin(a) * d;
      if (!this.world.isWater(x, y)) this.addNatural(id, x, y, rnd());
    });
    // 幽香常驻花园
    this.spawnCreature('yuuka', this.world.garden.x, this.world.garden.y);
    this.yuukaSpawned = true;
    this.time = { t: DAY_LEN * 0.08, day: 1 };
  }

  addNatural(id, x, y, r = Math.random()) {
    const def = NATURALS[id];
    const e = {
      kind: 'natural', id, def, x, y, r: def.r,
      hits: def.hits, state: 'idle', stumpT: 0, sway: r * Math.PI * 2,
      picked: false, dead: false,
    };
    this.naturals.push(e); this.entities.push(e);
    return e;
  }

  addBuilding(placeId, x, y) {
    const e = {
      kind: 'building', id: placeId, x, y, r: 34,
      fuel: placeId === 'campfire' ? 120 : (placeId === 'fire_pit' ? 240 : 0),
      maxFuel: placeId === 'fire_pit' ? 360 : 240,
      lit: placeId === 'campfire' || placeId === 'fire_pit',
      cookSlots: placeId === 'yatai' ? [null, null, null, null] : undefined,
      cookT: 0, chestInv: placeId === 'chest' ? new Array(9).fill(null) : undefined,
      trapArmed: placeId === 'trap', trapCaught: null,
      sway: Math.random() * 6, dead: false,
    };
    this.buildings.push(e); this.entities.push(e);
    return e;
  }

  spawnCreature(cid, x, y) {
    const def = CREATURES[cid];
    const e = {
      kind: 'creature', id: cid, def, x, y, r: cid === 'yuuka' ? 40 : (cid === 'treeguard' ? 34 : 16),
      hp: def.hp, maxHp: def.hp, state: 'idle', tx: x, ty: y,
      atkCd: 0, stun: 0, target: null, face: 1, walkPh: 0,
      enraged: false, home: { x, y }, leash: 700, regenT: 0,
      spawnT: 0, dead: false, hitFlash: 0, ringCd: 0,
    };
    this.creatures.push(e); this.entities.push(e);
    return e;
  }

  addDrop(itemId, x, y, n = 1) {
    const d = { kind: 'drop', id: itemId, n, x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, r: 12, bobT: Math.random() * 6, dead: false, fresh: 1 };
    this.drops.push(d); this.entities.push(d);
    return d;
  }

  msg(text, color = '#fff') { this.events.push({ text, color, t: 4 }); }

  // ---- 时间/相位 ----
  phase() {
    const seg = (this.time.t / SEG) | 0;
    if (seg < 10) return PHASES.DAY;
    if (seg < 14) return PHASES.DUSK;
    return PHASES.NIGHT;
  }
  // 0=正午 1=子夜 的"黑暗度" 0..1
  darkness() {
    const p = this.phase(), t = this.time.t;
    if (p === PHASES.DAY) return 0;
    if (p === PHASES.NIGHT) return 1;
    return (t - 10 * SEG) / (4 * SEG); // 黄昏渐变
  }

  rebuildGrid() {
    this.grid.clear();
    for (const e of this.entities) if (!e.dead) this.grid.insert(e);
  }

  nearest(x, y, r, filter) {
    let best = null, bd = r * r;
    const arr = this.grid.query(x, y, r, this._q || (this._q = []));
    for (const e of arr) {
      if (e.dead || (filter && !filter(e))) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  save() {
    const p = this.player;
    const data = {
      v: 1, seed: this.world.seed, day: this.time.day, t: this.time.t,
      player: {
        x: p.x, y: p.y, hp: p.hp, hunger: p.hunger, sanity: p.sanity,
        inv: p.inv, equip: p.equip, fresh: p.fresh, songCd: p.songCd,
      },
      buildings: this.buildings.filter(b => !b.dead).map(b => ({
        id: b.id, x: b.x, y: b.y, fuel: b.fuel, lit: b.lit,
        cookSlots: b.cookSlots, cookT: b.cookT, chestInv: b.chestInv,
        trapArmed: b.trapArmed, trapCaught: b.trapCaught,
      })),
      naturals: this.naturals.filter(n => n.picked || n.hits < n.def.hits).map(n => ({
        id: n.id, x: n.x, y: n.y, hits: n.hits, picked: n.picked, stumpT: n.stumpT,
      })),
      stats: this.stats, kedamaWaveDay: this.kedamaWaveDay,
      yuukaDead: !this.creatures.some(c => c.id === 'yuuka' && !c.dead),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  static hasSave() { return !!localStorage.getItem(SAVE_KEY); }

  load() {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data || data.v !== 1) return false;
    this.newGame(data.seed);
    this.time.day = data.day; this.time.t = data.t;
    const p = this.player, s = data.player;
    p.x = s.x; p.y = s.y; p.hp = s.hp; p.hunger = s.hunger; p.sanity = s.sanity;
    p.inv = s.inv; p.equip = s.equip; p.fresh = s.fresh || {}; p.songCd = s.songCd || 0;
    // 建筑
    for (const b of this.buildings.slice()) this.removeEntity(b);
    for (const bd of data.buildings) {
      const b = this.addBuilding(bd.id, bd.x, bd.y);
      Object.assign(b, { fuel: bd.fuel, lit: bd.lit, cookT: bd.cookT || 0, trapArmed: bd.trapArmed, trapCaught: bd.trapCaught });
      if (bd.cookSlots) b.cookSlots = bd.cookSlots;
      if (bd.chestInv) b.chestInv = bd.chestInv;
    }
    // 采集状态
    for (const nd of data.naturals) {
      const n = this.naturals.find(e => e.id === nd.id && Math.abs(e.x - nd.x) < 2 && Math.abs(e.y - nd.y) < 2);
      if (n) Object.assign(n, { hits: nd.hits, picked: nd.picked, stumpT: nd.stumpT });
    }
    this.stats = data.stats || this.stats;
    this.kedamaWaveDay = data.kedamaWaveDay || 3;
    if (data.yuukaDead) {
      const y = this.creatures.find(c => c.id === 'yuuka');
      if (y) this.removeEntity(y);
    }
    return true;
  }

  removeEntity(e) {
    e.dead = true;
    for (const arr of [this.entities, this.naturals, this.buildings, this.creatures, this.drops, this.projectiles]) {
      const i = arr.indexOf(e);
      if (i >= 0) arr.splice(i, 1);
    }
  }
}

export function makePlayer(x, y) {
  return {
    kind: 'player', x, y, r: 16,
    hp: PLAYER.hp, maxHp: PLAYER.hp,
    hunger: PLAYER.hunger, maxHunger: PLAYER.hunger,
    sanity: PLAYER.sanity, maxSanity: PLAYER.sanity,
    inv: new Array(8).fill(null),        // [{id,n,fresh}]
    backpack: false, packInv: new Array(4).fill(null),
    equip: { hand: null, body: null, head: null, charm: false },
    fresh: {},                            // itemUid -> 剩余新鲜度
    face: 1, dir: 'front', walkPh: 0, moving: false,
    atkCd: 0, action: null, actionT: 0,   // action: {type, target, dur}
    songCd: 0, hitFlash: 0, dead: false, vx: 0, vy: 0,
    regenT: 0,
  };
}
