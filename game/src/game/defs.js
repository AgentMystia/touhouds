// defs.js — 全部游戏数据定义（数据驱动）。所有数值按设计文档。
// 一天 = 480s = 16 段 × 30s。白天10段/黄昏4段/夜晚2段。

export const DAY_LEN = 480, SEG = 30;
export const PHASES = { DAY: 'day', DUSK: 'dusk', NIGHT: 'night' };

export const BIOME = { FOREST: 0, BAMBOO: 1, FIELD: 2, HILL: 3, WATER: 4, GARDEN: 5 };
export const BIOME_INFO = [
  { name: '魔法森林', ground: ['#3d5a3f', '#46684a', '#35513a'], fleck: '#527a56' },
  { name: '迷途竹林', ground: ['#4a6b42', '#54784a', '#425e3c'], fleck: '#5f8852' },
  { name: '太阳花田', ground: ['#5d7a3d', '#678545', '#556f38'], fleck: '#74914e' },
  { name: '妖怪之山麓', ground: ['#5f5a52', '#69645b', '#565148'], fleck: '#787268' },
  { name: '雾之湖',   ground: ['#2b4a5e', '#31556b', '#264254'], fleck: '#3b6278' },
  { name: '太阳花圃', ground: ['#6b7c37', '#77873f', '#606f32'], fleck: '#849348' },
];

// ---------------- 物品 ----------------
// kind: material|tool|weapon|armor|food|dish|placeable|charm|hat
export const ITEMS = {
  // 材料
  grass:        { name: '草',       icon: 'grass_blades', kind: 'material', stack: 40, desc: '柔韧的野草，基础材料。' },
  twigs:        { name: '树枝',     icon: 'sapling', kind: 'material', stack: 40, desc: '随手可得的细树枝。' },
  flint:        { name: '燧石',     icon: 'flint', kind: 'material', stack: 40, desc: '边缘锋利的石头。' },
  log:          { name: '木头',     icon: 'log', kind: 'material', stack: 40, desc: '结实的原木。' },
  stone:        { name: '石头',     icon: 'cut_stone', kind: 'material', stack: 40, desc: '开采来的石料。' },
  gold:         { name: '金块',     icon: 'gold_nugget', kind: 'material', stack: 40, desc: '闪闪发光的金子，河童的最爱。' },
  feather:      { name: '暗之羽毛', icon: 'feather', kind: 'material', stack: 40, desc: '不知从哪飘落的黑羽。' },
  bamboo_piece: { name: '竹筒',     icon: 'bamboo_piece', kind: 'material', stack: 40, desc: '截好的竹子，轻便结实。' },
  rope:         { name: '绳',       icon: 'rope', kind: 'material', stack: 40, desc: '用草搓成的结实绳子。' },
  plank:        { name: '木板',     icon: 'plank', kind: 'material', stack: 40, desc: '刨平的木板。' },
  cut_stone:    { name: '切石',     icon: 'cut_stone', kind: 'material', stack: 40, desc: '凿得方方正正的石块。' },
  // 工具（耐久=使用次数）
  axe:         { name: '斧',   icon: 'axe', kind: 'tool', tool: 'chop', power: 1, dur: 100, dmg: 27.2, desc: '砍树的好帮手，也能防身。' },
  pickaxe:     { name: '镐',   icon: 'pickaxe', kind: 'tool', tool: 'mine', power: 1, dur: 100, dmg: 27.2, desc: '开凿岩石与金矿。' },
  fishing_rod: { name: '鱼竿', icon: 'fishing_rod', kind: 'tool', tool: 'fish', power: 1, dur: 9, dmg: 10, desc: '在雾之湖边钓起八目鳗。' },
  torch:       { name: '火把', icon: 'torch', kind: 'tool', tool: 'light', power: 1, dur: 75, dmg: 10, light: 260, desc: '驱散一小片黑暗。' },
  // 武器/装备
  spear:       { name: '长枪', icon: 'spear', kind: 'weapon', dur: 150, dmg: 34, desc: '可靠的武器，攻击距离稍远。' },
  lamprey_bat: { name: '八目鳗串棒', icon: 'lamprey_bat', kind: 'weapon', dur: Infinity, dmg: 68, perish: 6 * DAY_LEN, dmgSpoiled: 34, desc: '招牌烤串绑成的棒子！68伤害、永不磨损，但会随新鲜度流失威力（最低34）。' },
  wood_armor:  { name: '木甲', icon: 'wood_armor', kind: 'armor', dur: 315, absorb: 0.8, desc: '吸收80%伤害。' },
  flower_garland: { name: '花环', icon: 'flower_garland', kind: 'hat', dur: 3 * DAY_LEN, sanityAura: 3, desc: '戴着心情会变好，缓慢恢复理智。' },
  parasol:     { name: '向日葵阳伞', icon: 'parasol', kind: 'hat', dur: Infinity, sanityAura: 8, nightSanityBonus: true, desc: '幽香的阳伞。昼夜都守护心智，幽香的光环不再侵蚀你。' },
  charm:       { name: '复苏护符', icon: 'charm', kind: 'charm', desc: '死亡时破碎，原地满状态复活。一次性。' },
  trap:        { name: '陷阱', icon: 'trap', kind: 'placeable', place: 'trap', stack: 10, desc: '放在地上，能扣住路过的毛玉。' },
  // 生食
  red_mushroom:  { name: '红蘑菇',   icon: 'red_mushroom', kind: 'food', stack: 40, hunger: 12.5, hp: 0, sanity: 0, cook: 'roast_mushrooms', perish: 10 * DAY_LEN, desc: '常见的蘑菇。' },
  blue_mushroom: { name: '蓝蘑菇',   icon: 'blue_mushroom', kind: 'food', stack: 40, hunger: 12.5, hp: 3, sanity: 5, cook: 'roast_mushrooms', perish: 10 * DAY_LEN, nightOnly: true, desc: '夜里发光的蘑菇，提神醒脑。' },
  petals:        { name: '花瓣',     icon: 'petals', kind: 'food', stack: 40, hunger: 3, hp: 1, sanity: 5, perish: 6 * DAY_LEN, desc: '带着太阳的香气。' },
  ginseng:       { name: '野人参',   icon: 'ginseng', kind: 'food', stack: 40, hunger: 12.5, hp: 1, sanity: 0, perish: 15 * DAY_LEN, desc: '埋在土里的滋补根茎。' },
  dark_berries:  { name: '暗之浆果', icon: 'dark_berries', kind: 'food', stack: 40, hunger: 9.375, hp: 0, sanity: -5, perish: 6 * DAY_LEN, desc: '露米娅爱吃的浆果，有点上头。' },
  raw_meat:      { name: '生肉',     icon: 'raw_meat', kind: 'food', stack: 20, hunger: 12.5, hp: -3, sanity: -10, cook: 'roast_meat', perish: 6 * DAY_LEN, desc: '生吃需要勇气。' },
  raw_lamprey:   { name: '八目鳗',   icon: 'raw_lamprey', kind: 'food', stack: 20, hunger: 9.375, hp: 0, sanity: 0, cook: 'grilled_lamprey', perish: 3 * DAY_LEN, desc: '雾之湖的特产，烤着吃是一绝。' },
  egg:           { name: '蛋',       icon: 'egg', kind: 'food', stack: 40, hunger: 9.375, hp: 0, sanity: 0, cook: 'roast_egg', perish: 10 * DAY_LEN, desc: '雀鸟的蛋。' },
  // 熟食/菜品
  roast_mushrooms: { name: '烤蘑菇',   icon: 'roast_mushrooms', kind: 'dish', stack: 40, hunger: 18.75, hp: 1, sanity: 5, perish: 15 * DAY_LEN, desc: '烤得香喷喷的蘑菇。' },
  roast_meat:    { name: '烤肉',     icon: 'roast_meat', kind: 'dish', stack: 20, hunger: 25, hp: 3, sanity: 0, perish: 10 * DAY_LEN, desc: '简单的满足。' },
  roast_egg:     { name: '煎蛋',     icon: 'roast_egg', kind: 'dish', stack: 40, hunger: 12.5, hp: 2, sanity: 0, perish: 10 * DAY_LEN, desc: '湖边风味煎蛋。' },
  grilled_lamprey: { name: '烤八目鳗', icon: 'grilled_lamprey', kind: 'dish', stack: 20, hunger: 37.5, hp: 8, sanity: 15, perish: 6 * DAY_LEN, signature: true, desc: '夜雀的招牌！酱色油亮，吃了眼睛发亮。' },
  fairy_stew:    { name: '妖精浓汤', icon: 'fairy_stew', kind: 'dish', stack: 20, hunger: 50, hp: 12, sanity: 5, perish: 10 * DAY_LEN, desc: '咕嘟咕嘟，是森林的味道。' },
  tsukimi_dango: { name: '月见团子', icon: 'tsukimi_dango', kind: 'dish', stack: 40, hunger: 37.5, hp: 5, sanity: 20, perish: 10 * DAY_LEN, desc: '赏月必备，软软糯糯。' },
  bamboo_rice:   { name: '竹笋饭',   icon: 'bamboo_rice', kind: 'dish', stack: 40, hunger: 62.5, hp: 3, sanity: 0, perish: 8 * DAY_LEN, desc: '竹香四溢的管饱饭。' },
  dark_cuisine:  { name: '黑暗料理', icon: 'dark_cuisine', kind: 'dish', stack: 20, hunger: 18.75, hp: -5, sanity: -15, perish: Infinity, desc: '……某种意义上也是才能。' },
  rice_ball:     { name: '饭团',     icon: 'rice_ball', kind: 'dish', stack: 40, hunger: 25, hp: 5, sanity: 5, perish: 8 * DAY_LEN, desc: '捏得圆圆的饭团。' },
  salve:         { name: '膏药',     icon: 'salve', kind: 'dish', stack: 20, hunger: 0, hp: 20, sanity: 0, perish: Infinity, desc: '草药膏，止血化瘀。' },
};

// ---------------- 配方 ----------------
// bench: null=随身, 'kappa'=河童工作台
export const RECIPES = [
  { id: 'axe',         out: 'axe', n: 1, cost: { twigs: 1, flint: 1 }, bench: null, tab: 'tool' },
  { id: 'pickaxe',     out: 'pickaxe', n: 1, cost: { twigs: 2, flint: 2 }, bench: null, tab: 'tool' },
  { id: 'torch',       out: 'torch', n: 1, cost: { grass: 2, twigs: 2 }, bench: null, tab: 'light' },
  { id: 'campfire',    out: null, place: 'campfire', n: 1, cost: { log: 2, grass: 3 }, bench: null, tab: 'light' },
  { id: 'trap',        out: 'trap', n: 1, cost: { grass: 6, twigs: 2 }, bench: null, tab: 'tool' },
  { id: 'rope',        out: 'rope', n: 1, cost: { grass: 3 }, bench: null, tab: 'refine' },
  { id: 'plank',       out: 'plank', n: 1, cost: { log: 4 }, bench: null, tab: 'refine' },
  { id: 'cut_stone',   out: 'cut_stone', n: 1, cost: { stone: 3 }, bench: null, tab: 'refine' },
  { id: 'salve',       out: 'salve', n: 1, cost: { petals: 4, ginseng: 1 }, bench: null, tab: 'survival' },
  { id: 'kappa_workbench', out: null, place: 'kappa_workbench', n: 1, cost: { log: 4, stone: 4, gold: 2 }, bench: null, tab: 'structure' },
  // 二级（需河童工作台）
  { id: 'fire_pit',    out: null, place: 'fire_pit', n: 1, cost: { log: 2, cut_stone: 2 }, bench: 'kappa', tab: 'light' },
  { id: 'spear',       out: 'spear', n: 1, cost: { twigs: 2, rope: 1, flint: 1 }, bench: 'kappa', tab: 'fight' },
  { id: 'wood_armor',  out: 'wood_armor', n: 1, cost: { log: 8, rope: 2 }, bench: 'kappa', tab: 'fight' },
  { id: 'lamprey_bat', out: 'lamprey_bat', n: 1, cost: { raw_lamprey: 2, twigs: 1, rope: 1 }, bench: 'kappa', tab: 'fight' },
  { id: 'yatai',       out: null, place: 'yatai', n: 1, cost: { plank: 4, rope: 2, gold: 1 }, bench: 'kappa', tab: 'structure' },
  { id: 'chest',       out: null, place: 'chest', n: 1, cost: { plank: 3 }, bench: 'kappa', tab: 'structure' },
  { id: 'flower_garland', out: 'flower_garland', n: 1, cost: { petals: 12 }, bench: null, tab: 'dress' },
  { id: 'charm',       out: 'charm', n: 1, cost: { gold: 3, feather: 3, petals: 6 }, bench: 'kappa', tab: 'dress' },
  { id: 'fishing_rod', out: 'fishing_rod', n: 1, cost: { twigs: 2, rope: 1 }, bench: null, tab: 'tool' },
];
export const TABS = { tool: '工具', light: '照明', refine: '精炼', survival: '生存', fight: '战斗', structure: '建筑', dress: '服饰' };

// ---------------- 屋台菜谱 ----------------
// match: 需要的食材标签组合; tags: 食材→标签
export const FOOD_TAGS = {
  raw_lamprey: ['lamprey', 'fishy'], red_mushroom: ['veggie', 'mushroom'],
  blue_mushroom: ['veggie', 'mushroom', 'glow'], petals: ['sweet', 'flower'],
  ginseng: ['veggie', 'root'], dark_berries: ['fruit', 'dark'], raw_meat: ['meat'],
  egg: ['egg'], bamboo_shoot_item: ['veggie', 'bamboo'],
};
export const RECIPES_YATAI = [
  { id: 'grilled_lamprey', need: { lamprey: 1 }, bonus: '任意3份填充', priority: 10 },
  { id: 'fairy_stew',      need: { veggie: 2 }, bonus: '至少2份蔬菜+任意2份', priority: 5 },
  { id: 'tsukimi_dango',   need: { sweet: 1, egg: 1 }, bonus: '甜+蛋+任意2份', priority: 8 },
  { id: 'bamboo_rice',     need: { bamboo: 1, veggie: 1 }, bonus: '竹+蔬菜+任意2份', priority: 6 },
  { id: 'rice_ball',       need: {}, bonus: '任意不匹配的4份（50%）', priority: 1 },
  // 其余/失败 → dark_cuisine
];

// ---------------- 生物 ----------------
export const CREATURES = {
  fairy: { name: '妖精', hp: 60, dmg: 0, speed: 60, neutral: true, sanityAura: -3,
           drops: [{ id: 'petals', n: 2, p: 1 }], sprite: 'fairy' },
  fairy_hostile: { name: '狂化妖精', hp: 60, dmg: 12, speed: 95, sanityAura: -20,
           drops: [{ id: 'petals', n: 2, p: 1 }, { id: 'feather', n: 1, p: 0.5 }], sprite: 'fairy_hostile' },
  kedama: { name: '毛玉', hp: 40, dmg: 8, speed: 70, sanityAura: -8,
           drops: [{ id: 'raw_meat', n: 1, p: 0.6 }, { id: 'feather', n: 1, p: 0.3 }], sprite: 'kedama' },
  spirit: { name: '怨灵', hp: 90, dmg: 15, speed: 55, sanityAura: -40, shadow: true,
           drops: [{ id: 'feather', n: 1, p: 0.7 }], sprite: 'spirit' },
  treeguard: { name: '森之主', hp: 1400, dmg: 35, speed: 50, sanityAura: -40, miniboss: true,
           drops: [{ id: 'log', n: 6, p: 1 }, { id: 'blue_mushroom', n: 3, p: 1 }, { id: 'feather', n: 2, p: 1 }], sprite: 'treeguard' },
  yuuka: { name: '风见幽香', hp: 27500, dmg: 75, speed: 65, boss: true, sanityAura: -60,
           enrageAt: 2750, sprite: 'yuuka', spriteEnraged: 'yuuka_enraged',
           drops: [{ id: 'parasol', n: 1, p: 1 }, { id: 'petals', n: 20, p: 1 }, { id: 'gold', n: 5, p: 1 }] },
  rumia: { name: '露米娅', hp: Infinity, dmg: 0, speed: 40, friendly: true, sanityAura: 5, sprite: 'rumia' },
  sparrow: { name: '雀鸟', hp: 10, dmg: 0, speed: 90, passive: true,
           drops: [{ id: 'egg', n: 1, p: 0.4 }, { id: 'feather', n: 1, p: 0.2 }], sprite: 'sparrow' },
};

// ---------------- 自然物（可交互实体） ----------------
export const NATURALS = {
  magic_tree: { name: '魔法树', sprite: 'magic_tree', tool: 'chop', hits: 12, yield: { log: 3, feather: 0.5 }, stump: 'magic_tree_stump', respawn: 1.5 * DAY_LEN, guardChance: 0.03, r: 26 },
  pine: { name: '松树', sprite: 'pine', tool: 'chop', hits: 10, yield: { log: 2 }, stump: 'pine_stump', respawn: 1.5 * DAY_LEN, r: 24 },
  bamboo: { name: '竹', sprite: 'bamboo', tool: 'chop', hits: 6, yield: { bamboo_piece: 2 }, stump: 'bamboo_stump', respawn: 2 * DAY_LEN, r: 18 },
  grass_tuft: { name: '草丛', sprite: 'grass_tuft', tool: null, hits: 1, yield: { grass: 1 }, stump: null, respawn: 1 * DAY_LEN, r: 10 },
  sapling: { name: '树苗', sprite: 'sapling', tool: null, hits: 1, yield: { twigs: 1 }, stump: null, respawn: 1 * DAY_LEN, r: 10 },
  glowshrooms: { name: '灯蘑菇丛', sprite: 'glowshrooms', tool: null, hits: 1, yield: { blue_mushroom: 1 }, stump: null, respawn: 1 * DAY_LEN, nightOnly: true, r: 12, glow: 90 },
  red_mushroom_patch: { name: '蘑菇', sprite: 'mushroom_tiny', tool: null, hits: 1, yield: { red_mushroom: 1 }, stump: null, respawn: 1 * DAY_LEN, r: 10 },
  sunflower: { name: '太阳花', sprite: 'sunflower', tool: null, hits: 1, yield: { petals: 2 }, stump: null, respawn: 1.2 * DAY_LEN, r: 12, sanityPick: 5 },
  boulder: { name: '岩石', sprite: 'boulder', tool: 'mine', hits: 8, yield: { stone: 2, flint: 1 }, stump: null, respawn: Infinity, r: 22 },
  gold_boulder: { name: '金矿石', sprite: 'gold_boulder', tool: 'mine', hits: 8, yield: { stone: 1, gold: 2 }, stump: null, respawn: Infinity, r: 22 },
  ginseng_plant: { name: '人参苗', sprite: 'grass_blades', tool: null, hits: 1, yield: { ginseng: 1 }, stump: null, respawn: 2 * DAY_LEN, r: 10 },
  berry_bush: { name: '暗莓丛', sprite: 'sapling', tool: null, hits: 1, yield: { dark_berries: 2 }, stump: null, respawn: 1.5 * DAY_LEN, r: 12, tint: '#7a5a9a' },
};

// 群系 → 散布表 [naturalId, weight]
export const SCATTER = {
  [BIOME.FOREST]: [['magic_tree', 30], ['pine', 12], ['grass_tuft', 14], ['sapling', 10], ['glowshrooms', 8], ['red_mushroom_patch', 8], ['berry_bush', 5], ['ginseng_plant', 4]],
  [BIOME.BAMBOO]: [['bamboo', 34], ['grass_tuft', 10], ['sapling', 10], ['ginseng_plant', 8], ['red_mushroom_patch', 4]],
  [BIOME.FIELD]:  [['sunflower', 26], ['grass_tuft', 16], ['sapling', 8], ['ginseng_plant', 6], ['berry_bush', 4]],
  [BIOME.HILL]:   [['boulder', 22], ['gold_boulder', 10], ['pine', 14], ['grass_tuft', 8], ['sapling', 8], ['red_mushroom_patch', 4]],
  [BIOME.GARDEN]: [['sunflower', 40]],
};

export const PLAYER = {
  hp: 150, hunger: 150, sanity: 200,
  walk: 190, nightWalkBonus: 1.15,
  attackPeriod: 0.45, range: 78,
  hungerPerDay: 75, starveDps: 1.25,
  songCooldown: 30, songCost: 15, songStun: 4, songRadius: 420,
  nightVision: 220,
  mystiaSanity: { dusk: 5, night: 5, darkness: 10 },
};
