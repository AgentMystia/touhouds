// main.js — 游戏主循环与交互调度。
import { keys, mouse, onKey, initInput, endFrame, dist, dist2, clamp } from './engine/engine.js';
import { State } from './game/state.js';
import * as S from './game/systems.js';
import { ITEMS, RECIPES, PLAYER, DAY_LEN, PHASES, NATURALS, CREATURES } from './game/defs.js';
import { drawWorld, drawLighting } from './render/render.js';
import { updateParticles } from './render/particles.js';
import * as HUD from './ui/hud.js';
import { ui, hit, clearHit, drawHUD, drawTitle, drawDeath, drawPause, loadFont, interactLabel } from './ui/hud.js';
import { sfx, unlockAudio, probeBgm, updateBgm } from './audio/sfx.js';
import { getSprite, setAtlas } from './render/assets.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const st = new State();
window.__st = st; // 测试钩子
const cam = { x: 0, y: 0 };

// 测试模式
const TEST = new URLSearchParams(location.search).get('test') === '1';
if (TEST) { st.speedMul = 8; window.__test = { logs: [] }; }

// ---------- 图集加载（可选，占位先行） ----------
fetch('assets/atlas.json').then(r => r.ok ? r.json() : null).then(fr => {
  if (!fr) return;
  const img = new Image();
  img.onload = () => { setAtlas(img, fr.frames); console.log('atlas loaded:', Object.keys(fr.frames).length, 'frames'); };
  img.src = 'assets/atlas.png';
}).catch(() => {});

// ---------- 输入 ----------
initInput(canvas);
addEventListener('mousedown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });

onKey((code, ev) => {
  if (ui.mode === 'game') {
    if (code === 'Tab') {                 // TAB 开关制作栏
      ev.preventDefault();
      ui.craftOpen = !ui.craftOpen;
      sfx('ui');
      return;
    }
    if (code === 'Escape') {
      if (ui.chestTarget || ui.yataiTarget) { ui.chestTarget = ui.yataiTarget = null; }
      else if (ui.craftOpen) ui.craftOpen = false;
      else if (st.pendingPlace) st.pendingPlace = null;
      else { ui.mode = 'paused'; }
      sfx('ui');
    }
    if (code === 'KeyE') {
      if (ui.chestTarget || ui.yataiTarget) { ui.chestTarget = ui.yataiTarget = null; sfx('ui'); }
    }
    if (code === 'KeyC') { S.castSong(st); }       // C = 夜雀之歌
    if (code === 'KeyF') {                         // F = 攻击（取消手中动作）
      st.player.action = null;
      S.playerAttack(st);
    }
    if (code === 'Space') {                        // 空格 = 采集/互动
      ev.preventDefault();
      smartInteract();
    }
    if (code === 'KeyQ') quickEat();
    if (code === 'F5') { st.save(); st.msg('存档完成', '#a0e0ff'); }
    if (code.startsWith('Digit')) {
      const i = +code.slice(5) - 1;
      if (i >= 0 && i < 8) { st.uiSel = st.uiSel === i ? -1 : i; sfx('ui'); }
    }
  } else if (ui.mode === 'paused' && code === 'Escape') {
    ui.mode = 'game';
  } else if (ui.mode === 'paused' && code === 'Tab') {
    ev.preventDefault();
  }
});

// 空格智能互动：拾取 > 出锅/陷阱 > 采集/砍/挖 > 容器/添柴
function smartInteract() {
  const p = st.player;
  if (p.dead || p.action || p.fishing) return;
  if (ui.chestTarget || ui.yataiTarget) { ui.chestTarget = ui.yataiTarget = null; return; }
  let best = null;
  for (const e of st.entities) {
    if (e.dead || e === p || e.hidden) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > 100) continue;
    let pri = -1, verb = null;
    if (e.kind === 'drop') { pri = 100; verb = 'pickup'; }
    else if (e.kind === 'natural' && !e.picked) {
      const tool = p.equip.hand ? ITEMS[p.equip.hand.id].tool : null;
      if (e.def.tool === 'chop') { if (tool === 'chop') { pri = 50; verb = 'chop'; } }
      else if (e.def.tool === 'mine') { if (tool === 'mine') { pri = 50; verb = 'mine'; } }
      else {
        if (e.def.nightOnly && st.phase() !== PHASES.NIGHT) continue;  // 夜里才能采的静默跳过
        pri = 60; verb = 'pick';
      }
    }
    else if (e.kind === 'building') {
      if (e.id === 'yatai') { pri = e.readyDish ? 95 : 40; verb = 'open_yatai'; }
      else if (e.id === 'chest') { pri = 40; verb = 'open_chest'; }
      else if ((e.id === 'campfire' || e.id === 'fire_pit') && !e.lit) { pri = 45; verb = 'fuel'; }
      else if (e.id === 'trap' && e.trapCaught) { pri = 90; verb = 'trap_harvest'; }
    }
    if (verb && (!best || pri > best.pri || (pri === best.pri && d < best.d))) best = { e, pri, verb, d };
  }
  if (best) executeVerb({ entity: best.e, verb: best.verb });
}

function quickEat() {
  const p = st.player;
  for (const inv of [p.inv, p.packInv]) {
    for (const s of inv) {
      if (s && (ITEMS[s.id].kind === 'food' || ITEMS[s.id].kind === 'dish')) {
        S.eat(st, s);
        return;
      }
    }
  }
  st.msg('没有能吃的东西', '#ffb0a0');
}

// ---------- 主循环 ----------
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsAvg = 60;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsAcc += 1 / Math.max(dt, 1e-4); fpsN++;
  if (fpsN >= 30) { fpsAvg = fpsAcc / fpsN; fpsAcc = fpsN = 0; window.__fps = fpsAvg; }

  const tNow = now / 1000;
  clearHit();
  ui.tooltip = null;

  if (ui.mode === 'title') {
    drawTitle(ctx, W, H, tNow, State.hasSave());
    handleTitleClick();
  } else if (ui.mode === 'dead') {
    drawDeath(ctx, st, W, H, tNow);
    handleDeathClick();
  } else if (ui.mode === 'paused') {
    renderGame(tNow, 0);
    drawPause(ctx, st, W, H);
    handlePauseClick();
  } else {
    const simDt = dt * st.speedMul;
    if (st.running) update(simDt, tNow);
    renderGame(tNow, simDt);
    if (st.player.dead && ui.mode === 'game') {
      localStorage.removeItem('touhouds_save_v1');
      ui.mode = 'dead';
    }
  }
  endFrame();
}

function update(dt, tNow) {
  const p = st.player;
  // 时间
  const prevPhase = st.phase();
  st.time.t += dt;
  if (st.time.t >= DAY_LEN) {
    st.time.t -= DAY_LEN;
    st.time.day++;
    st.save();
    st.msg(`—— 第 ${st.time.day} 天 ——`, '#ffe0a0');
  }
  const ph = st.phase();
  if (ph !== prevPhase) {
    if (ph === PHASES.DUSK) st.msg('黄昏了……夜雀的时间到了', '#e0b0ff');
    if (ph === PHASES.NIGHT) { st.msg('夜幕降临 ♪', '#c0a0ff'); sfx('rumia'); }
    if (ph === PHASES.DAY) st.msg('天亮了', '#ffe0a0');
    updateBgm(ph, false);
  }

  // 移动
  if (!p.dead) {
    let mx = 0, my = 0;
    if (keys.KeyW || keys.ArrowUp) my -= 1;
    if (keys.KeyS || keys.ArrowDown) my += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    const moving = mx || my;
    let speed = PLAYER.walk * (ph === PHASES.NIGHT ? PLAYER.nightWalkBonus : 1);
    if (p.action || p.fishing) speed = 0;
    if (moving) {
      const l = Math.hypot(mx, my);
      mx /= l; my /= l;
      const nx = p.x + mx * speed * dt, ny = p.y + my * speed * dt;
      if (!st.world.isWater(nx, p.y)) p.x = nx;
      if (!st.world.isWater(p.x, ny)) p.y = ny;
      // 实体碰撞（树/石/建筑/生物软推开）
      pushOut(st, p);
      p.walkPh += dt * 10;
      p.moving = true;
      p.dir = my < -0.3 ? 'back' : my > 0.3 ? 'front' : 'side';
      if (Math.abs(mx) > 0.3) { p.dir = 'side'; p.face = mx > 0 ? 1 : -1; }
      if ((p.stepT = (p.stepT || 0) + dt) > 0.32) { p.stepT = 0; sfx('step'); }
    } else p.moving = false;
    // 按住空格连续互动（砍树/采集自动续）、按住 F 连续攻击
    if (keys.Space && !p.action && !p.fishing && !moving) smartInteract();
    if (keys.KeyF) S.playerAttack(st);
  }

  // 点击目标自动寻路
  if (ui.craftOpen) {
    // 制作栏打开时也允许移动（不阻塞），但点击穿透已防
  }
  updateClickMove(dt);

  st.rebuildGrid();
  S.updateStats(st, dt);
  S.updateAction(st, dt);
  S.updateNaturals(st, dt);
  if (!st.debugFreeze) {  // 测试钩子：手动驱动 AI 时冻结
    S.updateCreatures(st, dt);
    S.updatePendingHits(st, dt);
    S.updateSpawner(st, dt);
  }
  S.updateFishing(st, dt);
  S.updateBuildings(st, dt);
  S.updateProjectiles(st, dt);
  updateParticles(dt);

  // 事件衰减
  for (let i = st.events.length - 1; i >= 0; i--) {
    st.events[i].t -= dt;
    if (st.events[i].t <= 0) st.events.splice(i, 1);
  }

  // 相机
  cam.x = clamp(p.x - W / 2, -2800, 2800 - 0);
  cam.y = clamp(p.y - H / 2, -2800, 2800 - 0);

  // hover 目标
  updateHover();

  // 危险 BGM
  const danger = st.creatures.some(c => !c.dead && (c.state === 'chase' || c.state === 'combat') && c.target === p && dist(c.x, c.y, p.x, p.y) < 500);
  updateBgm(st.phase(), danger);
}

function pushOut(st, p) {
  for (const arr of [st.naturals, st.buildings, st.creatures]) {
    for (const e of arr) {
      if (e.dead || e.picked && !e.stumpSprite) continue;
      if (e.kind === 'creature' && (e.def.friendly || e.def.passive)) continue;
      // 战斗中的大型生物不被玩家推开（Boss 要能贴身）
      if (e.kind === 'creature' && (e.state === 'combat' || e.state === 'chase' || e.def.boss || e.def.miniboss)) continue;
      const rr = (e.r || 10) + p.r - 4;
      const d2 = dist2(p.x, p.y, e.x, e.y);
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (rr - d);
        p.x += (p.x - e.x) / d * push * 0.7;
        p.y += (p.y - e.y) / d * push * 0.7;
      }
    }
  }
}

// ---------- 点击交互 ----------
let clickTarget = null; // {x,y,entity,verb}

function updateHover() {
  const p = st.player;
  const wx = mouse.x + cam.x, wy = mouse.y + cam.y;
  mouse.wx = wx; mouse.wy = wy;
  st.hoverTarget = null;
  if (ui.chestTarget || ui.yataiTarget) return;
  // 找鼠标下最近的实体
  let best = null, bd = 40 * 40;
  const arr = st.grid.query(wx, wy, 80, st._hq || (st._hq = []));
  for (const e of arr) {
    if (e.dead || e === p || e.hidden) continue;
    const rr = Math.max(24, (e.r || 12) + 14);
    const d = dist2(wx, wy, e.x, e.y - ((e.kind === 'natural' && e.def.r > 18) ? 30 : 0));
    if (d < rr * rr && d < bd) {
      if (e.kind === 'natural' && e.picked && !e.stumpSprite) continue;
      if (e.kind === 'projectile') continue;
      bd = d; best = e;
    }
  }
  st.hoverTarget = best;
}

function updateClickMove(dt) {
  const p = st.player;
  if (!clickTarget || p.dead) return;
  if (mouse.down && !clickTarget.entity) {
    // 持续移动到点
  }
  const t = clickTarget;
  const tx = t.entity ? t.entity.x : t.x, ty = t.entity ? t.entity.y : t.y;
  const d = dist(p.x, p.y, tx, ty);
  const arriveR = t.verb === 'attack' ? 60 : (t.entity && t.entity.kind === 'building' ? 70 : 55);
  if (t.entity && (t.entity.dead || (t.entity.picked && !t.entity.stumpSprite))) { clickTarget = null; return; }
  if (d > arriveR) {
    let speed = PLAYER.walk * (st.phase() === PHASES.NIGHT ? PLAYER.nightWalkBonus : 1);
    const nx = p.x + (tx - p.x) / d * speed * dt, ny = p.y + (ty - p.y) / d * speed * dt;
    if (!st.world.isWater(nx, p.y)) p.x = nx;
    if (!st.world.isWater(p.x, ny)) p.y = ny;
    pushOut(st, p);
    p.moving = true;
    p.walkPh += dt * 10;
    p.dir = Math.abs(ty - p.y) > Math.abs(tx - p.x) ? (ty > p.y ? 'front' : 'back') : 'side';
    if (Math.abs(tx - p.x) > 10) p.face = tx > p.x ? 1 : -1;
  } else {
    p.moving = false;
    executeVerb(t);
    if (t.verb !== 'chop' && t.verb !== 'mine') clickTarget = null;
    else if (!p.action) clickTarget = null;
  }
}

function executeVerb(t) {
  const p = st.player;
  const e = t.entity;
  if (!e) return;
  if (t.verb === 'chop' || t.verb === 'mine') {
    if (!p.action) S.startAction(st, t.verb, e);
  } else if (t.verb === 'pick') {
    if (e.def.nightOnly && st.phase() !== 'night') { st.msg('灯蘑菇只在夜里发光可采', '#c0c0e0'); return; }
    S.startAction(st, 'pick', e);
  } else if (t.verb === 'pickup') {
    S.giveItem(st, p, e.id, e.n);
    sfx('pick');
    st.removeEntity(e);
  } else if (t.verb === 'attack') {
    S.playerAttack(st);
    clickTarget = null;
  } else if (t.verb === 'open_chest') {
    ui.chestTarget = e; sfx('ui_open');
  } else if (t.verb === 'open_yatai') {
    if (e.readyDish) {
      const dish = e.readyDish; e.readyDish = null;
      S.giveItem(st, p, dish, 1);
      const s = p.inv.find(x => x && x.id === dish) || p.packInv.find(x => x && x.id === dish);
      if (s) s.cookedByMe = true;
      sfx('dish');
    } else { ui.yataiTarget = e; sfx('ui_open'); }
  } else if (t.verb === 'fuel') {
    const held = selectedSlot(p);
    if (held && (held.id === 'log' || held.id === 'grass' || held.id === 'twigs' || held.id === 'bamboo_piece')) {
      const add = { log: 90, grass: 15, twigs: 20, bamboo_piece: 40 }[held.id];
      e.fuel = Math.min(e.maxFuel, e.fuel + add);
      e.lit = true; e.burnout = false;
      S.consumeItem(p, held.id, 1);
      sfx('fuel');
      st.msg('添了把柴', '#ffd0a0');
    } else {
      e.lit = true; e.burnout = false;
      if (e.fuel <= 0) e.fuel = 30;
      sfx('fuel');
    }
  } else if (t.verb === 'trap_harvest') {
    if (e.trapCaught === 'kedama') { S.giveItem(st, p, 'raw_meat', 1); }
    if (e.trapCaught === 'sparrow') { S.giveItem(st, p, 'egg', 1); }
    e.trapCaught = null; e.trapArmed = true;
    sfx('pick');
  } else if (t.verb === 'fish') {
    if (!p.fishing) {
      p.fishing = { x: e.x, y: e.y, t: 2 + Math.random() * 3 };
      sfx('splash');
    }
  }
}

function selectedSlot(p) {
  if (st.uiSel >= 0 && p.inv[st.uiSel]) return p.inv[st.uiSel];
  return null;
}

// 世界点击
canvas.addEventListener('mousedown', ev => {
  if (ui.mode !== 'game' || ev.button === 2) {
    if (ev.button === 2 && st) { st.pendingPlace = null; clickTarget = null; }
    return;
  }
});
canvas.addEventListener('click', ev => {
  if (ui.mode !== 'game') return;
  unlockAudio();
  // UI 命中优先
  if (handleUIClick()) return;
  if (ui.chestTarget || ui.yataiTarget) return;
  const p = st.player;
  const wx = mouse.x + cam.x, wy = mouse.y + cam.y;

  // 放置模式
  if (st.pendingPlace) {
    const pid = st.pendingPlace;
    const d = dist(p.x, p.y, wx, wy);
    if (d > 180) { st.msg('太远了，放不到那里', '#ffb0a0'); return; }
    if (st.world.isWater(wx, wy)) { st.msg('不能放在水面上', '#ffb0a0'); return; }
    if (pid === 'trap') {
      const b = st.addBuilding('trap', wx, wy);
    } else {
      st.addBuilding(pid, wx, wy);
    }
    st.pendingPlace = null;
    sfx('place');
    return;
  }

  const t = st.hoverTarget;
  if (t) {
    const verb = verbFor(st, t);
    if (verb) {
      clickTarget = { entity: t, verb };
      if (dist(p.x, p.y, t.x, t.y) < 60) executeVerb({ entity: t, verb });
      return;
    }
  }
  // 水边钓鱼
  if (st.world.isWater(wx, wy) && p.equip.hand && p.equip.hand.id === 'fishing_rod' && dist(p.x, p.y, wx, wy) < 200) {
    executeVerb({ entity: { x: wx, y: wy }, verb: 'fish' });
    return;
  }
  clickTarget = { x: wx, y: wy, entity: null, verb: 'move' };
});

function verbFor(st, e) {
  const p = st.player;
  if (e.kind === 'natural') {
    if (e.def.tool === 'chop') return 'chop';
    if (e.def.tool === 'mine') return 'mine';
    return 'pick';
  }
  if (e.kind === 'drop') return 'pickup';
  if (e.kind === 'creature') {
    if (e.def.friendly || e.def.passive) return null;
    return 'attack';
  }
  if (e.kind === 'building') {
    if (e.id === 'chest') return 'open_chest';
    if (e.id === 'yatai') return 'open_yatai';
    if (e.id === 'campfire' || e.id === 'fire_pit') return 'fuel';
    if (e.id === 'trap' && e.trapCaught) return 'trap_harvest';
  }
  return null;
}

// ---------- UI 点击 ----------
function handleUIClick() {
  if (!mouse.clicked) return false;
  const p = st.player;
  for (let i = hit.length - 1; i >= 0; i--) {
    const h = hit[i];
    if (mouse.x < h.x || mouse.x >= h.x + h.w || mouse.y < h.y || mouse.y >= h.y + h.h) continue;
    const d = h.data;
    sfx('ui');
    if (d.type === 'panel') return true;   // 面板区域吞掉点击，防穿透
    if (d.type === 'craft_toggle') { ui.craftOpen = !ui.craftOpen; return true; }
    if (d.type === 'craft_tab') { ui.craftTab = d.tab; return true; }
    if (d.type === 'craft') {
      const r = d.recipe;
      if (S.craft(st, r)) { }
      return true;
    }
    if (d.type === 'song') { S.castSong(st); return true; }
    if (d.type === 'slot') {
      const inv = d.tag === 'hotbar' ? p.inv : p.packInv;
      const s = inv[d.i];
      // Shift: 存入容器/屋台
      if (keys.ShiftLeft || keys.ShiftRight) {
        if (s && ui.chestTarget) { moveToChest(s); return true; }
        if (s && ui.yataiTarget && (ITEMS[s.id].kind === 'food')) { moveToYatai(s); return true; }
      }
      if (s) {
        const def = ITEMS[s.id];
        if (def.kind === 'food' || def.kind === 'dish') { S.eat(st, s); return true; }
        if (def.kind === 'tool' || def.kind === 'weapon') { equipSwap(p, 'hand', s); return true; }
        if (def.kind === 'armor') { equipSwap(p, 'body', s); return true; }
        if (def.kind === 'hat') { equipSwap(p, 'head', s); return true; }
        if (def.kind === 'charm') { p.equip.charm = true; removeStack(p, s); st.msg('护符已佩戴', '#e0ffe0'); return true; }
        if (def.kind === 'placeable') {
          st.pendingPlace = def.place;
          removeStack(p, s);
          st.msg('选择放置位置', '#c0e0ff');
          return true;
        }
      }
      st.uiSel = st.uiSel === d.i ? -1 : d.i;
      return true;
    }
    if (d.type === 'equip') {
      const cur = p.equip[d.slot];
      if (cur) {
        p.equip[d.slot] = d.slot === 'charm' ? false : null;
        if (d.slot !== 'charm') S.giveItem(st, p, cur.id, 1);
      }
      return true;
    }
    if (d.type === 'chest_slot') {
      const s = ui.chestTarget.chestInv[d.i];
      if (s) {
        S.giveItem(st, p, s.id, s.n);
        ui.chestTarget.chestInv[d.i] = null;
      }
      return true;
    }
    if (d.type === 'yatai_slot') {
      const s = ui.yataiTarget.cookSlots[d.i];
      if (s) {
        S.giveItem(st, p, s.id, 1);
        ui.yataiTarget.cookSlots[d.i] = null;
      }
      return true;
    }
    if (d.type === 'yatai_cook') {
      S.startCooking(st, ui.yataiTarget);
      return true;
    }
    return true;
  }
  // 任何面板/容器打开时，点击不穿透到世界（绝不因点 UI 而移动）
  if (ui.craftOpen || ui.chestTarget || ui.yataiTarget) return true;
  return false;
}

function equipSwap(p, slotKey, stack) {
  const cur = p.equip[slotKey];
  p.equip[slotKey] = { id: stack.id, dur: stack.dur ?? ITEMS[stack.id].dur, fresh: stack.fresh };
  removeStack(p, stack);
  if (cur) S.giveItem(st, p, cur.id, 1);
  sfx('craft');
}

function removeStack(p, s) {
  for (const inv of [p.inv, p.packInv]) {
    const i = inv.indexOf(s);
    if (i >= 0) { inv[i] = null; return; }
  }
}

function moveToChest(s) {
  const b = ui.chestTarget;
  for (let i = 0; i < b.chestInv.length; i++) {
    if (!b.chestInv[i]) { b.chestInv[i] = { id: s.id, n: s.n, fresh: s.fresh }; removeStack(st.player, s); return; }
    if (b.chestInv[i].id === s.id && ITEMS[s.id].stack > 1) {
      const add = Math.min(s.n, ITEMS[s.id].stack - b.chestInv[i].n);
      b.chestInv[i].n += add; s.n -= add;
      if (s.n <= 0) { removeStack(st.player, s); return; }
    }
  }
  st.msg('箱子满了', '#ffb0a0');
}

function moveToYatai(s) {
  const b = ui.yataiTarget;
  for (let i = 0; i < 4; i++) {
    if (!b.cookSlots[i]) {
      b.cookSlots[i] = { id: s.id };
      S.consumeItem(st.player, s.id, 1);
      return;
    }
  }
  st.msg('锅里放满了（4份）', '#ffb0a0');
}

// ---------- 标题/死亡/暂停点击 ----------
function handleTitleClick() {
  if (!mouse.clicked) return;
  if (ui.helpOpen) { ui.helpOpen = false; return; }
  for (const h of hit) {
    if (mouse.x < h.x || mouse.x >= h.x + h.w || mouse.y < h.y || mouse.y >= h.y + h.h) continue;
    if (h.data.type === 'title_btn') {
      sfx('ui_open');
      const id = h.data.id;
      if (id === '操作说明' || id === 'help') { ui.helpOpen = true; return; }
      if (id === '继续游戏' || id === 'continue') {
        if (st.load()) { ui.mode = 'game'; probeBgm().then(() => updateBgm(st.phase(), false)); return; }
      }
      if (id === '新的轮回' || id === 'new') {
        localStorage.removeItem('touhouds_save_v1');
        st.newGame();
        ui.mode = 'game';
        st.msg('欢迎来到幻想乡。夜里……请小心脚下（笑）', '#e0c0ff');
        probeBgm().then(() => updateBgm(st.phase(), false));
        return;
      }
    }
  }
}

function handleDeathClick() {
  if (!mouse.clicked) return;
  for (const h of hit) {
    if (mouse.x < h.x || mouse.x >= h.x + h.w || mouse.y < h.y || mouse.y >= h.y + h.h) continue;
    if (h.data.type === 'title_btn') { ui.mode = 'title'; sfx('ui'); return; }
  }
}

function handlePauseClick() {
  if (!mouse.clicked) return;
  for (const h of hit) {
    if (mouse.x < h.x || mouse.x >= h.x + h.w || mouse.y < h.y || mouse.y >= h.y + h.h) continue;
    if (h.data.type === 'title_btn') {
      sfx('ui');
      if (h.data.id === 'resume') ui.mode = 'game';
      if (h.data.id === 'save_title') { st.save(); ui.mode = 'title'; }
      return;
    }
  }
}

// ---------- 渲染 ----------
function renderGame(tNow, dt) {
  drawWorld(ctx, st, cam, W, H, tNow);
  drawLighting(ctx, st, cam, W, H, tNow);
  drawHUD(ctx, st, W, H, tNow);
  if (TEST) {
    ctx.fillStyle = '#0f0'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`FPS ${fpsAvg.toFixed(0)} day${st.time.day} ${st.phase()} t${st.time.t.toFixed(0)}`, 8, 16);
  }
}

// ---------- 启动 ----------
loadFont().then(() => requestAnimationFrame(frame));
probeBgm();
if (TEST) {
  // 测试钩子：跳过关卡直接进游戏
  st.newGame(12345);
  ui.mode = 'game';
}
requestAnimationFrame(frame);
