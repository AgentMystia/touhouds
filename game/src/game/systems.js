// systems.js — 玩法系统：三值、行动、采集、战斗、AI、露米娅、幽香、毛玉暴走、钓鱼、屋台。
import { PLAYER, ITEMS, CREATURES, NATURALS, RECIPES_YATAI, FOOD_TAGS, DAY_LEN, PHASES, BIOME } from './defs.js';
import { dist, dist2, clamp, angleLerp } from '../engine/engine.js';
import { sfx } from '../audio/sfx.js';
import { burst, noteBurst, petalRing, sparkle } from '../render/particles.js';

// ============ 物品/背包 ============
export function giveItem(st, p, id, n = 1) {
  const def = ITEMS[id];
  const stacks = [p.inv, p.backpack ? p.packInv : null].filter(Boolean);
  for (const inv of stacks) {
    for (const s of inv) {
      if (s && s.id === id && def.stack > 1 && s.n < def.stack) {
        const add = Math.min(n, def.stack - s.n);
        s.n += add; n -= add;
        if (n <= 0) return true;
      }
    }
  }
  for (const inv of stacks) {
    for (let i = 0; i < inv.length; i++) {
      if (!inv[i]) { inv[i] = { id, n, fresh: 1 }; return true; }
    }
  }
  st.addDrop(id, p.x, p.y, n); // 满了掉地上
  st.msg('背包满了！', '#ffb0a0');
  return false;
}

export function countItem(p, id) {
  let n = 0;
  for (const inv of [p.inv, p.packInv]) for (const s of inv) if (s && s.id === id) n += s.n;
  if (p.equip.hand && p.equip.hand.id === id) n += 1;
  return n;
}

export function consumeItem(p, id, n = 1) {
  for (const inv of [p.inv, p.packInv]) {
    for (let i = 0; i < inv.length; i++) {
      const s = inv[i];
      if (s && s.id === id) {
        const take = Math.min(n, s.n);
        s.n -= take; n -= take;
        if (s.n <= 0) inv[i] = null;
        if (n <= 0) return true;
      }
    }
  }
  return n <= 0;
}

export function canAfford(p, cost) {
  for (const k in cost) if (countItem(p, k) < cost[k]) return false;
  return true;
}
export function payCost(p, cost) {
  for (const k in cost) consumeItem(p, k, cost[k]);
}

// 武器当前伤害（串棒随新鲜度衰减）
export function weaponDamage(p) {
  const h = p.equip.hand;
  if (!h) return 10;
  const def = ITEMS[h.id];
  if (def.perish && isFinite(def.perish)) {
    const f = clamp(h.fresh ?? 1, 0, 1);
    return def.dmgSpoiled + (def.dmg - def.dmgSpoiled) * f;
  }
  return def.dmg || 10;
}

// ============ 三值 ============
export function updateStats(st, dt) {
  const p = st.player;
  // 饥饿
  p.hunger = Math.max(0, p.hunger - PLAYER.hungerPerDay / DAY_LEN * dt);
  if (p.hunger <= 0) {
    p.hp -= PLAYER.starveDps * dt;
    if (((p.hp * 2) | 0) % 8 === 0) st.msg('肚子好饿……', '#ffc0a0');
  }
  // 理智：米斯蒂娅夜之特权
  const phase = st.phase();
  const dark = inTotalDarkness(st);
  let sanRate = 0;
  if (phase === PHASES.DUSK) sanRate += PLAYER.mystiaSanity.dusk;
  else if (phase === PHASES.NIGHT) sanRate += PLAYER.mystiaSanity.night;
  if (dark) sanRate += PLAYER.mystiaSanity.darkness;
  // 光环（怪物/露米娅/花环/阳伞）
  sanRate += sanityAuras(st) / 60 * 60; // auras 已按 /min
  p.sanity = clamp(p.sanity + sanRate / 60 * dt, 0, p.maxSanity);
  // 缓慢回血（吃饱时）
  if (p.hunger > p.maxHunger * 0.7 && p.hp < p.maxHp) {
    p.regenT += dt;
    if (p.regenT > 3) { p.hp = Math.min(p.maxHp, p.hp + 1); p.regenT = 0; }
  }
  // 新鲜度衰减
  for (const inv of [p.inv, p.packInv]) for (const s of inv) {
    if (s && s.fresh !== undefined) {
      const def = ITEMS[s.id];
      if (def.perish && isFinite(def.perish)) {
        s.fresh -= dt / def.perish;
        if (s.fresh <= 0) {
          if (s.id === 'lamprey_bat') { s.fresh = 0; } // 串棒不消失
          else { st.msg(`${def.name}坏掉了`, '#c0c0c0'); s.id = 'dark_cuisine'; s.fresh = 1; }
        }
      }
    }
  }
  const h = p.equip.hand;
  if (h && h.fresh !== undefined) {
    const def = ITEMS[h.id];
    if (def.perish && isFinite(def.perish)) h.fresh = Math.max(0, h.fresh - dt / def.perish);
  }
  // 装备耐久（火把/花环随时间）
  if (h && h.id === 'torch') {
    h.dur -= dt * (75 / 120); // 火把 120s
    if (h.dur <= 0) { p.equip.hand = null; st.msg('火把烧完了', '#c0c0c0'); }
  }
  const head = p.equip.head;
  if (head && head.id === 'flower_garland') {
    head.dur -= dt;
    if (head.dur <= 0) { p.equip.head = null; st.msg('花环枯萎了', '#c0c0c0'); }
  }
  p.songCd = Math.max(0, p.songCd - dt);
  p.atkCd = Math.max(0, p.atkCd - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  if (p.hp <= 0 && !p.dead) onPlayerDeath(st);
}

export function inTotalDarkness(st) {
  // 夜晚且不在任何光源范围内（米斯蒂娅自己的夜视不算光源）
  if (st.phase() !== PHASES.NIGHT) return false;
  return lightAt(st, st.player.x, st.player.y) < 0.25;
}

export function lightAt(st, x, y) {
  let l = 0;
  const d = st.darkness();
  if (d <= 0.01) return 1;
  for (const b of st.buildings) {
    if (!b.lit || b.dead) continue;
    const r = b.id === 'fire_pit' ? 300 : 240;
    const dd = dist(x, y, b.x, b.y);
    if (dd < r) l = Math.max(l, 1 - dd / r);
  }
  const h = st.player.equip.hand;
  if (h && h.id === 'torch') {
    const dd = dist(x, y, st.player.x, st.player.y);
    if (dd < 260) l = Math.max(l, 0.9 - dd / 260);
  }
  // 米斯蒂娅夜视：以自己为中心的小光圈（仅夜晚）
  if (st.phase() === PHASES.NIGHT) {
    const dd = dist(x, y, st.player.x, st.player.y);
    if (dd < PLAYER.nightVision) l = Math.max(l, 0.55 * (1 - dd / PLAYER.nightVision));
  }
  return l;
}

function sanityAuras(st) {
  const p = st.player;
  let a = 0;
  for (const c of st.creatures) {
    if (c.dead || !c.def.sanityAura) continue;
    const dd = dist(p.x, p.y, c.x, c.y);
    if (c.id === 'rumia') {
      if (dd < 220) a += c.def.sanityAura * (1 - dd / 220);   // 朋友的光环
    } else if (dd < 260) {
      if (c.id === 'yuuka' && p.equip.head && p.equip.head.id === 'parasol') continue;
      a += c.def.sanityAura * (1 - dd / 260);
    }
  }
  if (p.equip.head) {
    const hd = ITEMS[p.equip.head.id];
    if (hd.sanityAura) a += hd.sanityAura;
    if (hd.nightSanityBonus && st.phase() !== PHASES.DAY) a += 5;
  }
  return a; // /min
}

export function damagePlayer(st, dmg, src) {
  const p = st.player;
  if (p.dead) return;
  let d = dmg;
  const armor = p.equip.body;
  if (armor && ITEMS[armor.id].absorb) {
    const absorbed = d * ITEMS[armor.id].absorb;
    d -= absorbed;
    armor.dur -= absorbed;
    if (armor.dur <= 0) { p.equip.body = null; st.msg('木甲碎了！', '#ffb0a0'); }
  }
  p.hp -= d;
  p.hitFlash = 0.3;
  sfx('hurt');
  burst(st, p.x, p.y, '#ff5050', 8);
  if (p.hp <= 0) onPlayerDeath(st);
}

function onPlayerDeath(st) {
  const p = st.player;
  if (p.dead) return;
  if (p.equip.charm) {
    p.equip.charm = false;
    p.hp = p.maxHp * 0.5; p.hunger = p.maxHunger * 0.5; p.sanity = p.maxSanity * 0.5;
    st.msg('复苏护符碎裂了……夜雀重新睁开了眼睛！', '#a0ffc0');
    sparkle(st, p.x, p.y, 40);
    sfx('charm');
    return;
  }
  p.dead = true;
  st.running = false;
  st.stats.daysSurvived = st.time.day;
  sfx('death');
}

// ============ 进食 ============
export function eat(st, slot) {
  const p = st.player;
  const s = slot;
  if (!s) return;
  const def = ITEMS[s.id];
  if (def.kind !== 'food' && def.kind !== 'dish') return;
  let mul = 1;
  if (def.kind === 'dish') mul = 1.25;          // 屋台之魂
  p.hunger = clamp(p.hunger + (def.hunger || 0) * mul, 0, p.maxHunger);
  p.hp = clamp(p.hp + (def.hp || 0), 0, p.maxHp);
  let san = (def.sanity || 0);
  if (s.cookedByMe) san += 5;
  p.sanity = clamp(p.sanity + san, 0, p.maxSanity);
  st.msg(`吃掉了${def.name}${def.signature ? '，眼睛亮了起来！' : ''}`, '#d0ffc0');
  sfx('eat');
  s.n -= 1;
  if (s.n <= 0) removeSlot(p, s);
  return true;
}

function removeSlot(p, s) {
  for (const inv of [p.inv, p.packInv]) {
    const i = inv.indexOf(s);
    if (i >= 0) { inv[i] = null; return; }
  }
}

// ============ 制作 ============
export function craft(st, recipe) {
  const p = st.player;
  if (!canAfford(p, recipe.cost)) { st.msg('材料不够', '#ffb0a0'); return false; }
  if (recipe.bench === 'kappa' && !nearBench(st)) { st.msg('需要靠近河童工作台', '#ffb0a0'); return false; }
  payCost(p, recipe.cost);
  if (recipe.place) {
    st.pendingPlace = recipe.place;
    st.msg('选择放置位置（点击地面，右键取消）', '#c0e0ff');
  } else {
    giveItem(st, p, recipe.out, recipe.n);
    const def = ITEMS[recipe.out];
    if (def.dur !== undefined && def.dur !== Infinity) {
      // 新装备带耐久
      const inv = p.inv.find(s => s && s.id === recipe.out) || p.packInv.find(s => s && s.id === recipe.out);
      if (inv) inv.dur = def.dur;
    }
    st.msg(`制作了${ITEMS[recipe.out].name}`, '#d0ffc0');
    sfx('craft');
  }
  return true;
}

export function nearBench(st) {
  return st.buildings.some(b => !b.dead && b.id === 'kappa_workbench' && dist(st.player.x, st.player.y, b.x, b.y) < 220);
}

// ============ 玩家行动 ============
export function startAction(st, type, target) {
  const p = st.player;
  const def = target.def;
  let dur = 0.8;
  if (type === 'chop') dur = 0.9;
  if (type === 'mine') dur = 1.0;
  if (type === 'pick') dur = 0.5;
  p.action = { type, target, dur };
  p.actionT = 0;
}

export function updateAction(st, dt) {
  const p = st.player;
  if (!p.action) return;
  const a = p.action, t = a.target;
  if (!t || t.dead || (t.picked && a.type !== 'cook')) { p.action = null; return; }
  if (dist(p.x, p.y, t.x, t.y) > 90) { p.action = null; return; }
  p.actionT += dt;
  if (p.actionT < a.dur) return;
  p.actionT = 0;
  const P = PLAYER;
  if (a.type === 'chop' || a.type === 'mine') {
    const tool = p.equip.hand;
    const needTool = t.def.tool;
    if (!tool || ITEMS[tool.id].tool !== needTool) { st.msg(needTool === 'chop' ? '需要斧' : '需要镐', '#ffb0a0'); p.action = null; return; }
    tool.dur -= 1;
    if (tool.dur <= 0) { p.equip.hand = null; st.msg(`${ITEMS[tool.id].name}用坏了`, '#c0c0c0'); }
    t.hits -= ITEMS[tool.id].power;
    t.shakeT = 0.25;
    sfx(a.type === 'chop' ? 'chop' : 'mine');
    burst(st, t.x, t.y - 10, a.type === 'chop' ? '#8a6a40' : '#909090', 5);
    if (t.hits <= 0) harvestNatural(st, t);
  } else if (a.type === 'pick') {
    sfx('pick');
    burst(st, t.x, t.y, '#a0d080', 4);
    harvestNatural(st, t);
  }
  p.action = null;
}

function harvestNatural(st, t) {
  const p = st.player;
  const y = t.def.yield;
  for (const id in y) {
    const v = y[id];
    const n = v >= 1 ? v : (Math.random() < v ? 1 : 0);
    if (n > 0) giveItem(st, p, id, n);
  }
  if (t.def.sanityPick) p.sanity = clamp(p.sanity + t.def.sanityPick, 0, p.maxSanity);
  if (t.id === 'sunflower') p.sanity = clamp(p.sanity + 5, 0, p.maxSanity);
  // 森之主
  if (t.def.guardChance && Math.random() < t.def.guardChance) {
    const g = st.spawnCreature('treeguard', t.x + 40, t.y);
    g.state = 'chase'; g.target = p;
    st.msg('森林愤怒了！！', '#ff9090');
    sfx('roar');
  }
  if (t.def.stump) {
    t.stumpSprite = t.def.stump;
    t.picked = true;
    t.stumpT = t.def.respawn;
  } else if (isFinite(t.def.respawn)) {
    t.picked = true;
    t.stumpT = t.def.respawn;
  } else {
    st.removeEntity(t);
  }
}

// 自然物重生
export function updateNaturals(st, dt) {
  for (const n of st.naturals) {
    if (n.picked) {
      n.stumpT -= dt;
      if (n.stumpT <= 0) { n.picked = false; n.hits = n.def.hits; n.stumpSprite = null; }
    }
    n.shakeT = Math.max(0, (n.shakeT || 0) - dt);
  }
}

// ============ 战斗 ============
export function playerAttack(st) {
  const p = st.player;
  if (p.atkCd > 0) return;
  p.atkCd = PLAYER.attackPeriod;
  p.swingT = 0.18;
  sfx('swing');
  const range = p.equip.hand && p.equip.hand.id === 'spear' ? 105 : PLAYER.range;
  let best = null, bd = range * range;
  for (const c of st.creatures) {
    if (c.dead || c.def.friendly || c.def.passive) continue;
    const d = dist2(p.x, p.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  // 也可打被动生物（雀鸟）
  if (!best) {
    for (const c of st.creatures) {
      if (c.dead || c.def.friendly) continue;
      const d = dist2(p.x, p.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
  }
  if (best) {
    const dmg = weaponDamage(p);
    damageCreature(st, best, dmg, p);
    p.face = best.x >= p.x ? 1 : -1;
    return best;
  }
}

export function damageCreature(st, c, dmg, src) {
  if (c.dead || c.def.friendly) return;
  c.hp -= dmg;
  c.hitFlash = 0.2;
  burst(st, c.x, c.y - 8, '#ffe0a0', 6);
  sfx('hit');
  if (c.id === 'yuuka') {
    if (!c.enraged && c.hp <= c.def.enrageAt) enrageYuuka(st, c);
    c.regenT = 0;
  }
  if (c.hp <= 0) killCreature(st, c);
  else if (src && src.kind === 'player' && !c.def.neutral) { c.target = src; if (c.state === 'idle' || c.state === 'wander') c.state = 'chase'; }
  else if (src && src.kind === 'player' && c.def.neutral) { c.state = 'flee'; c.target = src; }
}

function killCreature(st, c) {
  st.stats.kills++;
  burst(st, c.x, c.y, '#ffffff', 16);
  for (const d of c.def.drops || []) {
    if (Math.random() < d.p) st.addDrop(d.id, c.x, c.y, d.n);
  }
  if (c.id === 'yuuka') {
    st.msg('幽香收起了伞……「打得不错。」', '#ffd0f0');
    st.msg('获得了【向日葵阳伞】！', '#ffe080');
    sparkle(st, c.x, c.y, 60);
    sfx('bossdown');
  }
  st.removeEntity(c);
}

// 夜雀之歌
export function castSong(st) {
  const p = st.player;
  if (p.songCd > 0) { st.msg(`歌声还在酝酿（${Math.ceil(p.songCd)}s）`, '#c0c0e0'); return; }
  if (p.sanity < PLAYER.songCost) { st.msg('理智不足，唱不出来……', '#ffb0a0'); return; }
  p.songCd = PLAYER.songCooldown;
  p.sanity -= PLAYER.songCost;
  sfx('song');
  noteBurst(st, p.x, p.y);
  let n = 0;
  for (const c of st.creatures) {
    if (c.dead || c.def.friendly || c.def.passive) continue;
    if (dist2(p.x, p.y, c.x, c.y) < PLAYER.songRadius * PLAYER.songRadius) {
      c.stun = PLAYER.songStun;
      c.target = null;
      if (c.state === 'chase') c.state = 'wander';
      n++;
    }
  }
  if (n > 0) st.msg(`♪ 夜雀之歌眩晕了 ${n} 个敌人！`, '#e0c0ff');
  else st.msg('♪ 歌声在夜色中回荡……', '#e0c0ff');
}

// ============ 生物 AI ============
export function updateCreatures(st, dt) {
  const p = st.player;
  for (const c of st.creatures) {
    if (c.dead) continue;
    c.atkCd = Math.max(0, c.atkCd - dt);
    c.hitFlash = Math.max(0, c.hitFlash - dt);
    c.spawnT += dt;
    if (c.stun > 0) { c.stun -= dt; c.walkPh += dt * 2; continue; }
    const d2p = dist(c.x, c.y, p.x, p.y);
    switch (c.id) {
      case 'kedama': aiKedama(st, c, dt, d2p); break;
      case 'fairy': case 'fairy_hostile': aiFairy(st, c, dt, d2p); break;
      case 'spirit': aiSpirit(st, c, dt, d2p); break;
      case 'treeguard': aiTreeguard(st, c, dt, d2p); break;
      case 'yuuka': aiYuuka(st, c, dt, d2p); break;
      case 'rumia': aiRumia(st, c, dt, d2p); break;
      case 'sparrow': aiSparrow(st, c, dt, d2p); break;
    }
    c.face = (c.tx !== undefined && c.tx < c.x) ? -1 : (c.tx > c.x ? 1 : c.face);
  }
}

function moveToward(c, tx, ty, speed, dt) {
  const d = dist(c.x, c.y, tx, ty);
  if (d < 2) return true;
  const vx = (tx - c.x) / d, vy = (ty - c.y) / d;
  c.x += vx * speed * dt; c.y += vy * speed * dt;
  c.walkPh += dt * speed * 0.06;
  return d < 8;
}

function wanderStep(c, dt, speed, radius = 160) {
  if (c.state !== 'wander' || dist(c.x, c.y, c.tx, c.ty) < 10) {
    c.state = 'wander';
    const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
    c.tx = c.home.x + Math.cos(a) * r; c.ty = c.home.y + Math.sin(a) * r;
  }
  moveToward(c, c.tx, c.ty, speed * 0.5, dt);
}

function tryMelee(st, c, target, range, dt) {
  if (c.atkCd > 0) return;
  if (dist(c.x, c.y, target.x, target.y) < range) {
    c.atkCd = c.id === 'yuuka' ? (c.enraged ? 1.15 : 1.55) : 1.2;
    c.swingT = 0.25;
    sfx('enemy_swing');
    // 命中判定延迟到挥击中点; 幽香给足前摇让"打N走1"成立
    c.pendingHit = { t: c.id === 'yuuka' ? 0.32 : 0.18, target, dmg: c.def.dmg };
  }
}

export function updatePendingHits(st, dt) {
  for (const c of st.creatures) {
    if (c.pendingHit) {
      c.pendingHit.t -= dt;
      if (c.pendingHit.t <= 0) {
        const t = c.pendingHit.target;
        const range = c.id === 'yuuka' ? 90 : 70;   // 幽香横扫半径收窄, 配合打6走1
        if (!t.dead && dist(c.x, c.y, t.x, t.y) < range) damagePlayer(st, c.pendingHit.dmg, c);
        c.pendingHit = null;
      }
    }
    c.swingT = Math.max(0, (c.swingT || 0) - dt);
  }
}

function aiKedama(st, c, dt, d2p) {
  const p = st.player;
  if (c.state === 'chase' && c.target && !c.target.dead) {
    if (d2p > 500) { c.state = 'wander'; c.target = null; return; }
    moveToward(c, p.x, p.y, c.def.speed, dt);
    tryMelee(st, c, p, 55, dt);
  } else {
    if (d2p < 140 && !p.dead && Math.random() < 0.01) { c.state = 'chase'; c.target = p; }
    wanderStep(c, dt, c.def.speed);
  }
}

function aiFairy(st, c, dt, d2p) {
  const p = st.player;
  const hostile = c.id === 'fairy_hostile';
  if (hostile && d2p < 400 && !p.dead) {
    c.state = 'chase';
    moveToward(c, p.x, p.y, c.def.speed, dt);
    tryMelee(st, c, p, 55, dt);
  } else if (c.state === 'flee' || d2p < 90) {
    c.state = 'flee';
    const a = Math.atan2(c.y - p.y, c.x - p.x);
    moveToward(c, c.x + Math.cos(a) * 100, c.y + Math.sin(a) * 100, c.def.speed, dt);
    if (d2p > 300) c.state = 'wander';
  } else {
    wanderStep(c, dt, c.def.speed);
  }
}

function aiSpirit(st, c, dt, d2p) {
  const p = st.player;
  // 只在玩家低理智时有攻击性；玩家理智恢复到 50%+ 就消散
  if (p.sanity > p.maxSanity * 0.5) {
    burst(st, c.x, c.y, '#a0c0ff', 10);
    st.removeEntity(c);
    return;
  }
  if (d2p < 500 && !p.dead) {
    moveToward(c, p.x, p.y, c.def.speed, dt);
    tryMelee(st, c, p, 60, dt);
  } else wanderStep(c, dt, c.def.speed);
}

function aiTreeguard(st, c, dt, d2p) {
  const p = st.player;
  if (c.target && !c.target.dead && d2p < 700) {
    moveToward(c, p.x, p.y, c.def.speed, dt);
    tryMelee(st, c, p, 85, dt);
  } else {
    c.target = null;
    if (dist(c.x, c.y, c.home.x, c.home.y) > 60) moveToward(c, c.home.x, c.home.y, c.def.speed * 0.6, dt);
    else c.hp = Math.min(c.maxHp, c.hp + 5 * dt);
  }
}

// ---- 露米娅（友好） ----
function aiRumia(st, c, dt, d2p) {
  const p = st.player;
  if (st.phase() === PHASES.DAY) {
    // 白天躲起来
    c.hidden = true;
    return;
  }
  c.hidden = false;
  // 玩家靠近有光源→飘走；否则友好跟随
  const hasLight = lightAt(st, p.x, p.y) > 0.5 && st.phase() === PHASES.NIGHT;
  if (d2p < 260 && !hasLight) {
    // 慢慢飘向玩家，保持一点距离
    if (d2p > 90) moveToward(c, p.x, p.y, c.def.speed, dt);
    c.chatT = (c.chatT || 0) - dt;
    if (c.chatT <= 0) {
      c.chatT = 14 + Math.random() * 10;
      const lines = ['是这样吗～', '黑夜很温柔哦', '米斯蒂娅，唱歌嘛', '八目鳗……想吃', '天黑请闭眼～'];
      st.events.push({ text: `露米娅：「${lines[(Math.random() * lines.length) | 0]}」`, color: '#c0a0ff', t: 3, bubble: c });
      if (Math.random() < 0.25) {
        st.addDrop(Math.random() < 0.5 ? 'dark_berries' : 'raw_meat', c.x, c.y, 1);
        st.msg('露米娅送来了小礼物！', '#d0b0ff');
      }
    }
  } else if (hasLight && d2p < 200) {
    const a = Math.atan2(c.y - p.y, c.x - p.x);
    moveToward(c, c.x + Math.cos(a) * 120, c.y + Math.sin(a) * 120, c.def.speed * 1.5, dt);
  } else {
    wanderStep(c, dt, c.def.speed, 300);
  }
}

function aiSparrow(st, c, dt, d2p) {
  const p = st.player;
  if (d2p < 80 || c.state === 'flee') {
    c.state = 'flee';
    const a = Math.atan2(c.y - p.y, c.x - p.x);
    c.x += Math.cos(a) * c.def.speed * dt; c.y += Math.sin(a) * c.def.speed * dt;
    c.walkPh += dt * 10;
    if (d2p > 260) { st.removeEntity(c); }
  } else {
    wanderStep(c, dt, c.def.speed * 0.4, 80);
  }
}

// ---- 风见幽香（仿 DST 龙蝇） ----
function aiYuuka(st, c, dt, d2p) {
  const p = st.player;
  const g = st.world.garden;
  const leash = 900;
  // 脱战
  if ((c.state === 'chase' || c.state === 'combat') && (p.dead || dist(c.x, c.y, g.x, g.y) > leash)) {
    c.state = 'return';
    c.target = null;
    c.enraged = false;
  }
  if (c.state === 'return') {
    if (moveToward(c, g.x, g.y, c.def.speed * 0.8, dt)) c.state = 'idle';
    c.hp = Math.min(c.maxHp, c.hp + 200 * dt);
    if (c.hp <= c.def.enrageAt) c.hp = c.def.enrageAt + 500; // 回百合圃后至少脱离狂暴血线
    return;
  }
  // 进入领地 → 敌对
  if (c.state === 'idle' && d2p < 380 && !p.dead) {
    c.state = 'combat'; c.target = p;
    st.msg('幽香：「……踩花的，是你？」', '#ffd0d0');
    sfx('roar');
  }
  if (c.state === 'combat' && c.target && !p.dead) {
    const speedMul = c.enraged ? 1.45 : 1.0;
    const period = c.enraged ? 1.15 : 1.55; // 攻击周期：打6走1 / 打4走1 节奏核心
    c.atkCd = Math.max(0, c.atkCd);
    moveToward(c, p.x, p.y, c.def.speed * speedMul, dt);
    tryMelee(st, c, p, 120, dt);
    // 狂暴花瓣弹幕环
    if (c.enraged) {
      c.ringCd -= dt;
      if (c.ringCd <= 0) {
        c.ringCd = 6;
        petalRing(st, c.x, c.y);
        sfx('ring');
      }
    }
    // 血条提示
    c.regenT += dt;
  } else if (c.state === 'idle') {
    // 领地踱步
    if (Math.random() < 0.005) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 200;
      c.tx = g.x + Math.cos(a) * r; c.ty = g.y + Math.sin(a) * r;
      c.state = 'stroll';
    }
  } else if (c.state === 'stroll') {
    if (moveToward(c, c.tx, c.ty, c.def.speed * 0.3, dt)) c.state = 'idle';
    if (d2p < 380 && !p.dead) c.state = 'idle';
  }
}

function enrageYuuka(st, c) {
  c.enraged = true;
  c.atkCd = 0.5;
  st.msg('幽香的眼神变了！！狂暴化！', '#ff6060');
  sfx('enrage');
  burst(st, c.x, c.y, '#ff4060', 30);
}

// ============ 弹幕（幽香花瓣环） ============
export function updateProjectiles(st, dt) {
  const p = st.player;
  for (const pr of st.projectiles) {
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    pr.life -= dt; pr.spin += dt * 6;
    if (pr.life <= 0) { st.removeEntity(pr); continue; }
    if (!p.dead && dist2(pr.x, pr.y, p.x, p.y) < (p.r + pr.r) * (p.r + pr.r)) {
      damagePlayer(st, pr.dmg, pr);
      st.removeEntity(pr);
    }
  }
}

// ============ 刷新器：妖精/毛玉/怨灵/雀鸟/露米娅 ============
export function updateSpawner(st, dt) {
  const p = st.player;
  st.spawnT = (st.spawnT || 0) - dt;
  if (st.spawnT <= 0) {
    st.spawnT = 4;
    const phase = st.phase();
    const counts = {};
    for (const c of st.creatures) if (!c.dead) counts[c.id] = (counts[c.id] || 0) + 1;
    // 白天妖精
    if (phase === PHASES.DAY && (counts.fairy || 0) < 5 && Math.random() < 0.4) {
      spawnNear(st, p, 'fairy', 500, 800);
    }
    // 雀鸟白天
    if (phase === PHASES.DAY && (counts.sparrow || 0) < 4 && Math.random() < 0.3) spawnNear(st, p, 'sparrow', 400, 700);
    // 毛玉夜晚
    if (phase !== PHASES.DAY && (counts.kedama || 0) < 4 && Math.random() < 0.35) spawnNear(st, p, 'kedama', 500, 800);
    // 怨灵：玩家低理智
    const sanRatio = p.sanity / p.maxSanity;
    if (sanRatio < 0.4 && (counts.spirit || 0) < (sanRatio < 0.2 ? 3 : 1) && Math.random() < 0.5) {
      spawnNear(st, p, 'spirit', 300, 500);
      if (sanRatio < 0.2) st.msg('有什么东西在黑暗里蠕动……', '#a0a0ff');
    }
    // 低理智妖精狂化
    if (sanRatio < 0.3) {
      for (const c of st.creatures) {
        if (c.id === 'fairy' && !c.dead && dist(c.x, c.y, p.x, p.y) < 600) {
          c.id = 'fairy_hostile'; c.def = CREATURES.fairy_hostile;
          st.msg('妖精的眼神变得不对劲了！', '#ffb0ff');
        }
      }
    }
    // 露米娅夜晚
    if (phase !== PHASES.DAY && !(counts.rumia || 0)) spawnNear(st, p, 'rumia', 400, 700);
  }
  // 毛玉暴走（每3-4天，黄昏预警，夜间来袭）
  if (st.time.day >= st.kedamaWaveDay && st.phase() === PHASES.DUSK && !st.waveWarned) {
    st.waveWarned = true;
    st.msg('远处传来窸窸窣窣的声音……（毛玉暴走）', '#ffc0c0');
    sfx('wave_warn');
  }
  if (st.time.day >= st.kedamaWaveDay && st.phase() === PHASES.NIGHT && !st.waveSpawned) {
    st.waveSpawned = true;
    const n = Math.min(3 + (st.time.day / 3 | 0), 8);
    for (let i = 0; i < n; i++) {
      const c = spawnNear(st, p, 'kedama', 600, 800);
      if (c) { c.state = 'chase'; c.target = p; }
    }
    st.msg(`毛玉成群结队地冲过来了！（${n}只）`, '#ff9090');
    sfx('wave');
    st.kedamaWaveDay = st.time.day + 3 + (Math.random() < 0.5 ? 0 : 1);
    st.waveWarned = false; st.waveSpawned = false;
  }
}

function spawnNear(st, p, id, rMin, rMax) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    if (!st.world.isWater(x, y)) return st.spawnCreature(id, x, y);
  }
  return null;
}

// ============ 钓鱼 ============
export function updateFishing(st, dt) {
  const p = st.player;
  if (!p.fishing) return;
  p.fishing.t -= dt;
  if (p.fishing.t <= 0) {
    const f = p.fishing;
    p.fishing = null;
    if (Math.random() < 0.75) {
      const d = st.addDrop('raw_lamprey', f.x, f.y, 1);
      d.vx = (p.x - f.x) * 2; d.vy = (p.y - f.y) * 2;
      st.msg('钓到了八目鳗！', '#a0e0ff');
      sfx('catch');
      const rod = p.equip.hand;
      if (rod && rod.id === 'fishing_rod') { rod.dur -= 1; if (rod.dur <= 0) p.equip.hand = null; }
    } else {
      st.msg('……跑了。', '#c0c0c0');
      sfx('splash');
    }
  }
}

// ============ 建筑：燃料/烹饪/陷阱 ============
export function updateBuildings(st, dt) {
  for (const b of st.buildings) {
    if (b.dead) continue;
    if (b.lit && (b.id === 'campfire' || b.id === 'fire_pit')) {
      b.fuel -= dt;
      if (b.fuel <= 0) {
        b.fuel = 0; b.lit = false;
        if (b.id === 'campfire') { /* 篝火熄灭成灰 */ b.burnout = true; }
      }
    }
    // 屋台烹饪
    if (b.id === 'yatai' && b.cooking) {
      b.cookT -= dt;
      if (b.cookT <= 0) {
        b.cooking = false;
        const dish = judgeDish(b.cookSlots);
        b.readyDish = dish;
        b.cookSlots = [null, null, null, null];
        st.msg(`做好了【${ITEMS[dish].name}】！`, '#ffe0a0');
        sfx('dish');
        st.stats.dishes++;
      }
    }
    // 陷阱
    if (b.id === 'trap' && b.trapArmed && !b.trapCaught) {
      const c = st.nearest(b.x, b.y, 60, e => e.kind === 'creature' && (e.id === 'kedama' || e.id === 'sparrow'));
      if (c) {
        b.trapCaught = c.id;
        st.removeEntity(c);
        b.trapArmed = false;
        st.msg('陷阱逮住了一只' + CREATURES[c.id].name + '！', '#d0ffc0');
        sfx('trap');
      }
    }
  }
}

function judgeDish(slots) {
  const tags = {};
  let n = 0;
  for (const s of slots) {
    if (!s) continue;
    n++;
    for (const t of (FOOD_TAGS[s.id] || [])) tags[t] = (tags[t] || 0) + 1;
  }
  if (n < 4) return 'dark_cuisine';
  // 按优先级匹配
  const sorted = [...RECIPES_YATAI].sort((a, b) => b.priority - a.priority);
  for (const r of sorted) {
    let ok = true;
    for (const tag in r.need) {
      if ((tags[tag] || 0) < r.need[tag]) { ok = false; break; }
    }
    if (ok) {
      if (r.id === 'rice_ball' && Math.random() < 0.5) continue;
      return r.id;
    }
  }
  return 'dark_cuisine';
}

export function startCooking(st, b) {
  const filled = b.cookSlots.filter(Boolean).length;
  if (filled < 4) { st.msg('需要放满4份食材', '#ffb0a0'); return false; }
  b.cooking = true;
  b.cookT = 6;
  sfx('cook');
  return true;
}
