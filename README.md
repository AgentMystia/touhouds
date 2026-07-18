# 东方夜雀求生记

> ~ 夜雀的歌谣与永不落幕的屋台 ~

一个东方 Project × Don't Starve 的 2D 生存游戏，纯前端（Canvas 2D + ES Modules），零构建。

**在线玩**：https://agentmystia.github.io/touhouds/

## 本地运行

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/game/
```

## 你是谁

你是**米斯蒂娅·萝蕾拉**——夜雀。白天采集、钓鱼、备料、建屋台；**夜晚是你的主场**：黑暗回复理智、露米娅会来做客、夜雀之歌眩晕敌人。深入太阳花田，挑战四季的鲜花之主**风见幽香**（27500 血，打 6 走 1；血量降至 2750 狂暴，改打 4 走 1 + 花瓣弹幕环）。

## 操作

| 键位 | 作用 |
|---|---|
| WASD / 方向键 | 移动 |
| 空格 | 采集 / 拾取 / 互动（按住自动连续动作） |
| F | 攻击（按住连续攻击） |
| C | 夜雀之歌（眩晕周围敌人 4s，耗 15 理智，冷却 30s） |
| TAB | 打开 / 关闭制作栏 |
| 鼠标左键 | 点哪去哪 / 远程交互 |
| 数字键 1-8 | 选中快捷栏（再点装备/吃） |
| Q | 快速吃快捷栏第一个食物 |
| E / 右键 | 关闭界面 / 取消 |
| F5 | 手动存档（每天黎明自动存档，localStorage） |

## 生存要点

- **三环**：生命 / 饥饿（-75/天）/ 理智（低时刷怨灵、妖精狂化）。
- **夜之特权**：黄昏/夜晚 +5 理智/min，完全黑暗 +10/min；篝火旁 +5/min。
- **招牌**：夜雀屋台做【烤八目鳗】（大回复）；亲手做的菜回复 +25%。
- **武器**：八目鳗串棒 68 伤、无耐久、只随新鲜度衰减（打幽香必备）。
- **朋友**：露米娅夜里游荡，靠近回理智，偶尔送你小礼物。

## BGM（可选，自投）

游戏音效为 WebAudio 程序合成。背景音乐由外部 AI 生成后投放：把文件放到 `game/assets/bgm/`，按时段自动交叉淡入淡出。

| 文件 | 时段 | 提示词（Suno/Stable Audio 风格） |
|---|---|---|
| `day.mp3` | 白天 | `cheerful Japanese folk-pop with koto, shakuhachi and whistling, Touhou-style playful melody, light game BGM loop, 92 BPM, whimsical forest morning` |
| `dusk.mp3` | 黄昏 | `nostalgic Japanese sunset folk, warm acoustic guitar and koto, gentle taiko pulse, Touhou-style wistful melody, game BGM loop, 78 BPM` |
| `night.mp3` | 夜晚 | `quiet magical night, music box and soft strings, crickets ambience, mysterious Touhou-style lullaby, sparrow song motifs, game BGM loop, 66 BPM` |
| `danger.mp3` | 战斗/幽香 | `intense Japanese boss battle, driving taiko drums, urgent strings and bamboo flute, Touhou-style dramatic danmaku energy, game BGM loop, 140 BPM` |

缺文件时对应时段静默，不影响游玩。

## 技术

- **渲染**：Canvas 2D，y 排序公告牌精灵 + 程序化纸偶动画；离屏黑幕 + 径向光洞的动态光照；地面分块缓存。
- **世界**：种子化值噪声 + 角向扇区群系（魔法森林/迷途竹林/太阳花田/妖怪之山麓 + 雾之湖边界 + 太阳花圃）。
- **美术**：全部由 gpt-image-2 生成（绿幕 → 键控抠图 → 图集打包）。
- **架构**：数据驱动（`game/src/game/defs.js` 定义全部物品/配方/生物/菜谱）。

## 目录

```
game/            #  playable 静态站（部署根）
  index.html
  assets/        #  atlas.png/json, title.png, death.png, fonts/, bgm/
  src/           #  engine / world / game / render / ui / audio
tools/           #  美术管线与测试（不部署）
  imagegen.py    #  gpt-image-2 CLI（generate/edit, --dry-run）
  manifest.py    #  全部资产声明式清单
  gen_all.py     #  并发生成 + 绿幕质量校验重试
  postprocess.py #  抠图/切片/打包图集
  keypath.py     #  关键路径测试（Playwright）
  shots.py       #  多场景截图
output/imagegen/ #  原始生成图（gitignore）
```

东方 Project 二次创作。
