// hud.js — 全部 UI：状态表盘、时钟、背包、制作栏、提示、菜单、标题/死亡画面。
import { ITEMS, RECIPES, TABS, DAY_LEN, SEG, PHASES } from '../game/defs.js';
import { getSprite } from '../render/assets.js';
import { bar } from '../render/render.js';
import { canAfford, nearBench, countItem } from '../game/systems.js';
import { clamp } from '../engine/engine.js';
import { sfx } from '../audio/sfx.js';
import { mouse, keys } from '../engine/engine.js';

export const FONT = 'Zpix, "WenQuanYi Zen Hei", sans-serif';
let fontReady = false;
export async function loadFont() {
  try {
    const f = new FontFace('Zpix', 'url(assets/fonts/zpix-subset.woff2)');
    await f.load();
    document.fonts.add(f);
    fontReady = true;
  } catch (e) { fontReady = false; }
}

// UI 命中区域（每帧重建）
export const hit = [];
function region(x, y, w, h, data) {
  hit.push({ x, y, w, h, data });
  return mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
}
export function clearHit() { hit.length = 0; }

export const ui = {
  mode: 'title',          // title | game | dead | paused
  craftOpen: false, craftTab: 'tool',
  invOpen: false,
  chestTarget: null, yataiTarget: null,
  tooltip: null,
  placePreview: null,
  seedInput: '',
};

// ============ 表盘 ============
function dial(ctx, x, y, r, ratio, color, icon, label) {
  ctx.save();
  // 底盘
  ctx.fillStyle = 'rgba(20,14,26,0.85)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a3a50'; ctx.lineWidth = 3; ctx.stroke();
  // 弧形
  ctx.strokeStyle = color; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, r - 5, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
  ctx.stroke();
  // 图标
  const spr = getSprite(icon);
  ctx.drawImage(spr, x - 13, y - 13, 26, 26);
  ctx.restore();
}

export function drawHUD(ctx, st, W, H, tNow) {
  const p = st.player;
  ctx.textBaseline = 'middle';
  // ---- 右上：时钟 ----
  const cx = W - 76, cy = 62, cr = 44;
  ctx.save();
  ctx.fillStyle = 'rgba(20,14,26,0.85)';
  ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a3a50'; ctx.lineWidth = 3; ctx.stroke();
  // 16 段
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 16) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = i < 10 ? '#e8c860' : i < 14 ? '#e08850' : '#484a88';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, cr - 8, a0 + 0.02, a1 - 0.02);
    ctx.closePath(); ctx.fill();
  }
  // 指针
  const pa = (st.time.t / DAY_LEN) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(pa) * (cr - 10), cy + Math.sin(pa) * (cr - 10)); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`第${st.time.day}天`, cx, cy + cr + 18);
  const phaseName = { day: '白天', dusk: '黄昏', night: '夜晚' }[st.phase()];
  ctx.fillStyle = st.phase() === 'night' ? '#a0a0ff' : '#ffe0a0';
  ctx.font = `14px ${FONT}`;
  ctx.fillText(phaseName, cx, cy + cr + 38);
  ctx.restore();

  // ---- 右中：三值表盘 ----
  const dx = W - 70;
  dial(ctx, dx, 175, 34, p.hp / p.maxHp, '#e05050', 'raw_meat', '生命');
  dial(ctx, dx, 250, 34, p.hunger / p.maxHunger, '#e0a050', 'rice_ball', '饥饿');
  dial(ctx, dx, 325, 34, p.sanity / p.maxSanity, '#a070e0', 'petals', '理智');
  ctx.fillStyle = '#fff'; ctx.font = `13px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(p.hp), dx, 175);
  ctx.fillText(Math.ceil(p.hunger), dx, 250);
  ctx.fillText(Math.ceil(p.sanity), dx, 325);
  // 低理智警告
  if (p.sanity < p.maxSanity * 0.3) {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(tNow * 5) * 0.3;
    ctx.fillStyle = '#c080ff';
    ctx.font = `15px ${FONT}`;
    ctx.fillText('心智不稳……', dx, 360);
    ctx.restore();
  }

  // ---- 底部：快捷栏 ----
  const n = 8, slot = 54, gap = 6;
  const bw = n * (slot + gap) - gap;
  const bx = (W - bw) / 2, by = H - slot - 14;
  drawInvRow(ctx, st, p.inv, bx, by, slot, gap, 'hotbar');
  // 背包展开
  if (p.backpack) {
    drawInvRow(ctx, st, p.packInv, bx + (bw - 4 * (slot + gap) + gap) / 2, by - slot - 10, slot, gap, 'pack');
  }
  // 装备栏（左下）
  drawEquip(ctx, st, 16, H - 70);

  // ---- 夜雀之歌按钮 ----
  const sx = bx + bw + 20, sy = by + 6;
  const cd = p.songCd;
  const hover = region(sx, sy, 44, 44, { type: 'song' });
  ctx.fillStyle = hover ? 'rgba(80,60,110,0.95)' : 'rgba(40,30,60,0.9)';
  ctx.beginPath(); ctx.arc(sx + 22, sy + 22, 22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = cd > 0 ? '#555' : '#c0a0ff'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = cd > 0 ? '#888' : '#e0c0ff';
  ctx.font = '22px serif'; ctx.textAlign = 'center';
  ctx.fillText('♪', sx + 22, sy + 24);
  if (cd > 0) {
    ctx.fillStyle = '#fff'; ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(Math.ceil(cd), sx + 22, sy + 22);
  }
  if (hover) setTooltip(ctx, '夜雀之歌 [空格]\n眩晕周围敌人4秒\n消耗15理智 · 冷却30秒');

  // ---- 制作按钮/面板 ----
  const cbx = 16, cby = H - 130;
  const ch = region(cbx, cby, 110, 40, { type: 'craft_toggle' });
  ctx.fillStyle = ch || ui.craftOpen ? 'rgba(70,50,90,0.95)' : 'rgba(35,26,45,0.9)';
  roundRect(ctx, cbx, cby, 110, 40, 8);
  ctx.fillStyle = '#ffe0a0'; ctx.font = `18px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('制 作', cbx + 55, cby + 21);
  if (ui.craftOpen) drawCraftPanel(ctx, st, W, H);

  // ---- 交互提示 ----
  drawInteractHint(ctx, st, W, H);

  // ---- 放置预览提示 ----
  if (st.pendingPlace) {
    ctx.fillStyle = '#d0e0ff'; ctx.font = `16px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('点击地面放置 · 右键取消', W / 2, H - 100);
  }

  // ---- 幽香 Boss 血条 ----
  const yuuka = st.creatures.find(c => c.id === 'yuuka' && !c.dead && (c.state === 'combat' || c.state === 'return') && c.hp < c.maxHp);
  if (yuuka) {
    const bw2 = Math.min(560, W * 0.5);
    const bx2 = (W - bw2) / 2;
    ctx.fillStyle = 'rgba(20,14,26,0.85)';
    roundRect(ctx, bx2 - 10, 16, bw2 + 20, 44, 10);
    ctx.fillStyle = '#ffd0e0'; ctx.font = `bold 17px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(`风见幽香 ${yuuka.enraged ? '【狂暴】' : ''}`, W / 2, 30);
    bar(ctx, bx2, 42, bw2, 10, yuuka.hp / yuuka.maxHp, '#e04060', '#401018');
    // 狂暴刻度线
    const ex = bx2 + bw2 * (yuuka.def.enrageAt / yuuka.maxHp);
    ctx.strokeStyle = '#ffe080'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ex, 40); ctx.lineTo(ex, 54); ctx.stroke();
  }

  // ---- 事件消息 ----
  let my = H - 170;
  ctx.textAlign = 'center';
  for (let i = st.events.length - 1; i >= 0 && i > st.events.length - 5; i--) {
    const ev = st.events[i];
    ctx.globalAlpha = clamp(ev.t, 0, 1);
    ctx.fillStyle = ev.color;
    ctx.font = `16px ${FONT}`;
    ctx.strokeStyle = 'rgba(10,5,15,0.9)'; ctx.lineWidth = 4;
    ctx.strokeText(ev.text, W / 2, my);
    ctx.fillText(ev.text, W / 2, my);
    ctx.globalAlpha = 1;
    my -= 24;
  }

  // ---- 容器界面 ----
  if (ui.chestTarget && !ui.chestTarget.dead) drawChestUI(ctx, st, W, H);
  if (ui.yataiTarget && !ui.yataiTarget.dead) drawYataiUI(ctx, st, W, H);

  // ----  tooltip 最后画 ----
  if (ui.tooltip) drawTooltip(ctx, W, H);
}

function drawInvRow(ctx, st, inv, x, y, slot, gap, tag) {
  for (let i = 0; i < inv.length; i++) {
    const sx = x + i * (slot + gap);
    const hov = region(sx, y, slot, slot, { type: 'slot', tag, i });
    ctx.fillStyle = hov ? 'rgba(90,70,110,0.95)' : 'rgba(30,22,40,0.88)';
    roundRect(ctx, sx, y, slot, slot, 8);
    ctx.strokeStyle = st.uiSel === i && tag === 'hotbar' ? '#ffe080' : '#4a3a50';
    ctx.lineWidth = st.uiSel === i && tag === 'hotbar' ? 3 : 2;
    roundRectStroke(ctx, sx, y, slot, slot, 8);
    const s = inv[i];
    if (s) {
      const spr = getSprite(ITEMS[s.id].icon);
      ctx.drawImage(spr, sx + 7, y + 5, 40, 40);
      if (s.n > 1) {
        ctx.fillStyle = '#fff'; ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'right';
        ctx.strokeStyle = '#100a18'; ctx.lineWidth = 3;
        ctx.strokeText(s.n, sx + slot - 5, y + slot - 8);
        ctx.fillText(s.n, sx + slot - 5, y + slot - 8);
      }
      // 新鲜度/耐久条
      const def = ITEMS[s.id];
      let frac = null, col = '#80e080';
      if (s.fresh !== undefined && def.perish && isFinite(def.perish)) { frac = s.fresh; col = frac > 0.5 ? '#80e080' : frac > 0.25 ? '#e0c040' : '#e05040'; }
      else if (s.dur !== undefined && def.dur && isFinite(def.dur)) { frac = s.dur / def.dur; col = '#80c0e0'; }
      if (frac !== null) bar(ctx, sx + 6, y + slot - 6, slot - 12, 3, frac, col, '#202028');
      if (hov) setTooltip(ctx, itemTooltip(s));
    }
    // 数字键
    if (tag === 'hotbar') {
      ctx.fillStyle = '#8a7a9a'; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(i + 1, sx + 4, y + 9);
    }
  }
}

function itemTooltip(s) {
  const d = ITEMS[s.id];
  let t = d.name;
  if (d.kind === 'food' || d.kind === 'dish') t += `\n饱食+${d.hunger || 0} 生命+${d.hp || 0} 理智${(d.sanity || 0) >= 0 ? '+' : ''}${d.sanity || 0}`;
  if (d.dmg) t += `\n伤害 ${d.dmgSpoiled ? d.dmgSpoiled + '~' : ''}${d.dmg}`;
  if (d.absorb) t += `\n减伤 ${d.absorb * 100}%`;
  if (d.dur && isFinite(d.dur)) t += `\n耐久 ${Math.ceil(s.dur ?? d.dur)}`;
  if (d.perish && isFinite(d.perish)) t += `\n新鲜度 ${Math.round((s.fresh ?? 1) * 100)}%`;
  t += `\n${d.desc}`;
  return t;
}

function drawEquip(ctx, st, x, y) {
  const p = st.player;
  const slots = [['hand', '手'], ['body', '身'], ['head', '头']];
  for (let i = 0; i < 3; i++) {
    const [key, label] = slots[i];
    const sx = x + i * 62;
    const hov = region(sx, y, 54, 54, { type: 'equip', slot: key });
    ctx.fillStyle = hov ? 'rgba(90,70,110,0.95)' : 'rgba(30,22,40,0.88)';
    roundRect(ctx, sx, y, 54, 54, 8);
    ctx.strokeStyle = '#4a3a50'; ctx.lineWidth = 2;
    roundRectStroke(ctx, sx, y, 54, 54, 8);
    const e = p.equip[key];
    if (e) {
      const spr = getSprite(ITEMS[e.id].icon);
      ctx.drawImage(spr, sx + 7, y + 5, 40, 40);
      if (e.dur !== undefined && ITEMS[e.id].dur && isFinite(ITEMS[e.id].dur)) {
        bar(ctx, sx + 6, y + 48, 42, 3, e.dur / ITEMS[e.id].dur, '#80c0e0', '#202028');
      }
      if (hov) setTooltip(ctx, itemTooltip(e));
    } else {
      ctx.fillStyle = '#5a4a6a'; ctx.font = `13px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(label, sx + 27, y + 28);
    }
  }
  // 护符
  const ax = x + 3 * 62;
  const hov = region(ax, y, 54, 54, { type: 'equip', slot: 'charm' });
  ctx.fillStyle = hov ? 'rgba(90,70,110,0.95)' : 'rgba(30,22,40,0.88)';
  roundRect(ctx, ax, y, 54, 54, 8);
  ctx.strokeStyle = p.equip.charm ? '#ffe080' : '#4a3a50'; ctx.lineWidth = 2;
  roundRectStroke(ctx, ax, y, 54, 54, 8);
  const cs = getSprite('charm');
  ctx.globalAlpha = p.equip.charm ? 1 : 0.25;
  ctx.drawImage(cs, ax + 7, y + 5, 40, 40);
  ctx.globalAlpha = 1;
  if (hov) setTooltip(ctx, p.equip.charm ? '复苏护符（已装备）\n死亡时原地复活' : '复苏护符\n携带护符后点击装备');
}

// ---- 制作面板 ----
function drawCraftPanel(ctx, st, W, H) {
  const p = st.player;
  const tabs = Object.keys(TABS);
  const px = 16, py = 110, pw = 300;
  const rowH = 46;
  ctx.fillStyle = 'rgba(25,18,35,0.94)';
  roundRect(ctx, px - 6, py - 40, pw + 12, 420, 10);
  // 页签
  let tx = px;
  ctx.font = `14px ${FONT}`;
  for (const t of tabs) {
    const w = ctx.measureText(TABS[t]).width + 16;
    const hov = region(tx, py - 32, w, 26, { type: 'craft_tab', tab: t });
    ctx.fillStyle = ui.craftTab === t ? 'rgba(90,60,120,0.95)' : hov ? 'rgba(60,45,80,0.9)' : 'rgba(40,30,55,0.9)';
    roundRect(ctx, tx, py - 32, w, 26, 6);
    ctx.fillStyle = ui.craftTab === t ? '#ffe0a0' : '#b0a0c0';
    ctx.textAlign = 'center';
    ctx.fillText(TABS[t], tx + w / 2, py - 18);
    tx += w + 4;
    if (tx > px + pw - 30) break;
  }
  // 配方列表
  const benchOk = nearBench(st);
  const list = RECIPES.filter(r => r.tab === ui.craftTab);
  let ry = py;
  for (const r of list) {
    const def = r.out ? ITEMS[r.out] : { name: placeName(r.place), icon: r.place, desc: '' };
    const locked = r.bench === 'kappa' && !benchOk;
    const afford = canAfford(p, r.cost);
    const hov = region(px, ry, pw, rowH - 4, { type: 'craft', recipe: r });
    ctx.fillStyle = hov ? 'rgba(80,60,100,0.9)' : 'rgba(45,35,60,0.85)';
    roundRect(ctx, px, ry, pw, rowH - 4, 6);
    ctx.globalAlpha = afford && !locked ? 1 : 0.45;
    const spr = getSprite(def.icon || r.place);
    ctx.drawImage(spr, px + 4, ry + 4, 34, 34);
    ctx.fillStyle = '#ffe8c0'; ctx.font = `15px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText(def.name, px + 44, ry + 14);
    // 材料
    ctx.font = `12px ${FONT}`;
    let cx = px + 44;
    ctx.fillStyle = '#b0a0c0';
    const costText = Object.entries(r.cost).map(([k, v]) => `${ITEMS[k].name}×${v}(${countItem(p, k)})`).join(' ');
    ctx.fillText(costText, cx, ry + 32);
    ctx.globalAlpha = 1;
    if (locked) {
      ctx.fillStyle = '#80e0d0'; ctx.font = `11px ${FONT}`; ctx.textAlign = 'right';
      ctx.fillText('需工作台', px + pw - 8, ry + 14);
    }
    if (hov) setTooltip(ctx, (def.desc || '') + (r.bench === 'kappa' ? '\n需在河童工作台旁制作' : ''));
    ry += rowH;
  }
}

function placeName(place) {
  return { campfire: '篝火', fire_pit: '石火坑', kappa_workbench: '河童工作台', yatai: '夜雀屋台', chest: '木箱', trap: '陷阱' }[place] || place;
}
export { placeName };

function drawInteractHint(ctx, st, W, H) {
  const t = st.hoverTarget;
  if (!t || st.pendingPlace) return;
  ctx.fillStyle = '#ffe8c0';
  ctx.font = `15px ${FONT}`;
  ctx.textAlign = 'center';
  const label = interactLabel(st, t);
  if (label) {
    ctx.strokeStyle = 'rgba(10,5,15,0.9)'; ctx.lineWidth = 4;
    ctx.strokeText(label, mouse.x, mouse.y - 24);
    ctx.fillText(label, mouse.x, mouse.y - 24);
  }
}

export function interactLabel(st, t) {
  const p = st.player;
  if (t.kind === 'natural') {
    if (t.picked) return null;
    if (t.def.tool === 'chop') return ITEMS[p.equip.hand?.id]?.tool === 'chop' ? `砍伐 ${t.def.name}` : `${t.def.name}（需要斧）`;
    if (t.def.tool === 'mine') return ITEMS[p.equip.hand?.id]?.tool === 'mine' ? `开采 ${t.def.name}` : `${t.def.name}（需要镐）`;
    if (t.def.nightOnly && st.phase() !== 'night') return `${t.def.name}（只在夜里生长）`;
    return `采集 ${t.def.name}`;
  }
  if (t.kind === 'drop') return `拾取 ${ITEMS[t.id].name}${t.n > 1 ? '×' + t.n : ''}`;
  if (t.kind === 'building') {
    if (t.id === 'yatai') return t.readyDish ? `取餐【${ITEMS[t.readyDish].name}】` : '打开 夜雀屋台';
    if (t.id === 'chest') return '打开 木箱';
    if ((t.id === 'campfire' || t.id === 'fire_pit') && !t.lit) return '添加燃料';
    if (t.id === 'trap' && t.trapCaught) return '收获 陷阱';
    return null;
  }
  if (t.kind === 'creature' && !t.def.friendly && !t.def.passive) return `攻击 ${t.def.name}`;
  if (t.kind === 'creature' && t.id === 'rumia') return '露米娅（朋友）';
  return null;
}

// ---- 容器 ----
function drawChestUI(ctx, st, W, H) {
  const b = ui.chestTarget;
  ctx.fillStyle = 'rgba(25,18,35,0.95)';
  roundRect(ctx, W / 2 - 190, H / 2 - 130, 380, 210, 12);
  ctx.fillStyle = '#ffe0a0'; ctx.font = `18px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('木箱', W / 2, H / 2 - 105);
  const slot = 44, gap = 6;
  const inv = b.chestInv;
  const x0 = W / 2 - (3 * (slot + gap) - gap) / 2, y0 = H / 2 - 80;
  for (let i = 0; i < inv.length; i++) {
    const sx = x0 + (i % 3) * (slot + gap), sy = y0 + ((i / 3) | 0) * (slot + gap);
    const hov = region(sx, sy, slot, slot, { type: 'chest_slot', i });
    ctx.fillStyle = hov ? 'rgba(90,70,110,0.95)' : 'rgba(40,30,55,0.9)';
    roundRect(ctx, sx, sy, slot, slot, 6);
    const s = inv[i];
    if (s) {
      ctx.drawImage(getSprite(ITEMS[s.id].icon), sx + 5, sy + 4, 34, 34);
      if (s.n > 1) {
        ctx.fillStyle = '#fff'; ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'right';
        ctx.fillText(s.n, sx + slot - 4, sy + slot - 7);
      }
      if (hov) setTooltip(ctx, itemTooltip(s) + '\n点击取回');
    }
  }
  ctx.fillStyle = '#b0a0c0'; ctx.font = `13px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('点击物品取回 · Shift+点击背包物品存入 · E 关闭', W / 2, H / 2 + 68);
}

function drawYataiUI(ctx, st, W, H) {
  const b = ui.yataiTarget;
  ctx.fillStyle = 'rgba(25,18,35,0.95)';
  roundRect(ctx, W / 2 - 200, H / 2 - 140, 400, 230, 12);
  ctx.fillStyle = '#ffe0a0'; ctx.font = `bold 19px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('夜雀屋台', W / 2, H / 2 - 112);
  ctx.fillStyle = '#c0b0d0'; ctx.font = `13px ${FONT}`;
  ctx.fillText('放入4份食材开火 · 米斯蒂娅亲手做的菜回复+25%', W / 2, H / 2 - 90);
  const slot = 52, gap = 10;
  const x0 = W / 2 - (4 * (slot + gap) - gap) / 2, y0 = H / 2 - 66;
  for (let i = 0; i < 4; i++) {
    const sx = x0 + i * (slot + gap);
    const hov = region(sx, y0, slot, slot, { type: 'yatai_slot', i });
    ctx.fillStyle = hov ? 'rgba(90,70,110,0.95)' : 'rgba(40,30,55,0.9)';
    roundRect(ctx, sx, y0, slot, slot, 6);
    const s = b.cookSlots[i];
    if (s) {
      ctx.drawImage(getSprite(ITEMS[s.id].icon), sx + 7, y0 + 6, 38, 38);
      if (hov) setTooltip(ctx, ITEMS[s.id].name + '\n点击取回');
    } else {
      ctx.fillStyle = '#5a4a6a'; ctx.font = `12px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('食材', sx + slot / 2, y0 + slot / 2);
    }
  }
  // 开火按钮
  const bw = 120, bh = 40;
  const bx = W / 2 - bw / 2, by = y0 + slot + 18;
  const filled = b.cookSlots.filter(Boolean).length;
  const hov = region(bx, by, bw, bh, { type: 'yatai_cook' });
  ctx.fillStyle = filled >= 4 ? (hov ? '#c06030' : '#a04828') : '#4a3a45';
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fillStyle = filled >= 4 ? '#ffe8c0' : '#8a7a85';
  ctx.font = `bold 17px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(b.cooking ? '烹饪中…' : '开火！', W / 2, by + bh / 2 + 1);
  ctx.fillStyle = '#b0a0c0'; ctx.font = `12px ${FONT}`;
  ctx.fillText('Shift+点击背包食物放入 · E 关闭', W / 2, by + bh + 16);
}

function setTooltip(ctx, text) { ui.tooltip = text; }

function drawTooltip(ctx, W, H) {
  const lines = ui.tooltip.split('\n');
  ctx.font = `13px ${FONT}`;
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  w += 20;
  const h = lines.length * 20 + 14;
  let x = mouse.x + 18, y = mouse.y + 12;
  if (x + w > W) x = mouse.x - w - 8;
  if (y + h > H) y = mouse.y - h - 8;
  ctx.fillStyle = 'rgba(18,12,26,0.96)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.strokeStyle = '#6a5a7a'; ctx.lineWidth = 1.5;
  roundRectStroke(ctx, x, y, w, h, 8);
  ctx.fillStyle = '#ffe8d0';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => {
    if (i === 0) { ctx.fillStyle = '#ffd890'; ctx.font = `bold 13px ${FONT}`; }
    else { ctx.fillStyle = '#e0d0e0'; ctx.font = `13px ${FONT}`; }
    ctx.fillText(l, x + 10, y + 16 + i * 20);
  });
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}
function roundRectStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.stroke();
}

// ============ 标题画面 ============
export function drawTitle(ctx, W, H, tNow, hasSave) {
  // 背景图
  const bg = getSprite('title_bg');
  if (bg.width > 100) {
    const sc = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * sc) / 2, (H - bg.height * sc) / 2, bg.width * sc, bg.height * sc);
    ctx.fillStyle = 'rgba(10,6,20,0.35)';
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1030'); g.addColorStop(0.6, '#2a1a40'); g.addColorStop(1, '#401030');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 星星
    for (let i = 0; i < 80; i++) {
      const sx = (i * 137.5) % W, sy = (i * 89.3) % (H * 0.6);
      ctx.globalAlpha = 0.4 + Math.sin(tNow * 2 + i) * 0.3;
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // 标题
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#ff80c0'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffe8f0';
  ctx.font = `bold ${Math.min(84, W / 11)}px ${FONT}`;
  ctx.fillText('东方夜雀求生记', W / 2, H * 0.26);
  ctx.restore();
  ctx.fillStyle = '#d0b0e0';
  ctx.font = `20px ${FONT}`;
  ctx.fillText('~ 夜雀的歌谣与永不落幕的屋台 ~', W / 2, H * 0.26 + 48);
  // 按钮
  const bw = 240, bh = 52;
  const bx = W / 2 - bw / 2;
  let by = H * 0.52;
  if (hasSave) {
    if (titleButton(ctx, bx, by, bw, bh, '继续游戏')) ui._click = 'continue';
    by += bh + 16;
  }
  if (titleButton(ctx, bx, by, bw, bh, '新的轮回')) ui._click2 = 'new';
  by += bh + 16;
  titleButton(ctx, bx, by, bw, bh, '操作说明', 'help');
  // 底部
  ctx.fillStyle = '#9080a0';
  ctx.font = `14px ${FONT}`;
  ctx.fillText('东方Project 二次创作 · 献给永不毕业的夜雀', W / 2, H - 40);
  if (ui.helpOpen) drawHelp(ctx, W, H);
}

function titleButton(ctx, x, y, w, h, label, id) {
  const hov = mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
  region(x, y, w, h, { type: 'title_btn', id: id || label });
  ctx.fillStyle = hov ? 'rgba(120,60,100,0.95)' : 'rgba(50,30,60,0.9)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.strokeStyle = hov ? '#ffb0d0' : '#7a5a8a'; ctx.lineWidth = 2;
  roundRectStroke(ctx, x, y, w, h, 12);
  ctx.fillStyle = hov ? '#ffe8f0' : '#e0c8e8';
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  return hov && mouse.clicked;
}

function drawHelp(ctx, W, H) {
  ctx.fillStyle = 'rgba(12,8,20,0.96)';
  roundRect(ctx, W / 2 - 300, H / 2 - 200, 600, 400, 14);
  ctx.fillStyle = '#ffe0a0'; ctx.font = `bold 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('操作说明', W / 2, H / 2 - 160);
  ctx.fillStyle = '#e0d0e8'; ctx.font = `16px ${FONT}`; ctx.textAlign = 'left';
  const lines = [
    'WASD / 方向键 —— 移动',
    '鼠标左键 —— 采集 / 砍伐 / 攻击 / 拾取（自动走过去）',
    '鼠标右键 / E —— 取消 / 关闭界面',
    '数字键 1-8 —— 选中快捷栏（再点装备/吃）',
    '空格 —— 夜雀之歌（眩晕敌人）',
    'Q —— 快速吃快捷栏第一个食物',
    'F5 —— 手动存档（每天黎明自动存档）',
    '',
    '目标：在幻想乡的夜里活下去。',
    '白天采集、钓鱼、备料；夜晚是米斯蒂娅的主场——',
    '黑暗回复理智，露米娅会来做客。',
    '深入太阳花田，挑战四季的鲜花之主……',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2 - 260, H / 2 - 118 + i * 26));
  ctx.fillStyle = '#9080a0'; ctx.font = `14px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('点击任意处关闭', W / 2, H / 2 + 176);
}

// ============ 死亡画面 ============
export function drawDeath(ctx, st, W, H, tNow) {
  const bg = getSprite('death_bg');
  if (bg.width > 100) {
    const sc = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * sc) / 2, (H - bg.height * sc) / 2, bg.width * sc, bg.height * sc);
  } else {
    ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(5,2,10,0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#8050c0'; ctx.shadowBlur = 24;
  ctx.fillStyle = '#e8d8f8';
  ctx.font = `bold 60px ${FONT}`;
  ctx.fillText('夜 雀 陨 落', W / 2, H * 0.3);
  ctx.restore();
  ctx.fillStyle = '#c0a8d8';
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`存活了 ${st.stats.daysSurvived} 天 · 击倒了 ${st.stats.kills} 个敌人 · 做了 ${st.stats.dishes} 道菜`, W / 2, H * 0.3 + 52);
  ctx.fillStyle = '#a088b8';
  ctx.font = `17px ${FONT}`;
  ctx.fillText('露米娅捡起了那顶小小的帽子，黑暗久久没有散去。', W / 2, H * 0.3 + 88);
  const bw = 240, bh = 52;
  const bx = W / 2 - bw / 2;
  titleButton(ctx, bx, H * 0.62, bw, bh, '回到标题', 'to_title');
}

// ============ 暂停 ============
export function drawPause(ctx, st, W, H) {
  ctx.fillStyle = 'rgba(8,5,14,0.75)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffe8f0'; ctx.font = `bold 42px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('暂 停', W / 2, H * 0.34);
  const bw = 240, bh = 52;
  const bx = W / 2 - bw / 2;
  titleButton(ctx, bx, H * 0.46, bw, bh, '继续', 'resume');
  titleButton(ctx, bx, H * 0.46 + 68, bw, bh, '保存并回标题', 'save_title');
}
