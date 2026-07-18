#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""postprocess.py — 绿幕抠图 → autocrop → 缩放 → 图标切片 → 打包图集。
输出: game/assets/atlas.png + atlas.json (frames: name -> {x,y,w,h})
场景图(title/death)直接缩放到 game/assets/。
"""
import json, math, os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manifest import TASKS, GRID_CELLS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INB = os.path.join(ROOT, "output/imagegen/inb")
OUT = os.path.join(ROOT, "game/assets")

# 目标显示尺寸（宽，px；高度按比例）。实体按游戏内大小。
TARGET_W = {
    "mystia_front": 96, "mystia_side": 96, "mystia_back": 96,
    "fairy": 64, "fairy_hostile": 64, "kedama": 56, "spirit": 72, "sparrow": 44,
    "lamprey": 80, "treeguard": 150, "rumia": 84, "yuuka": 130, "yuuka_enraged": 140,
    "magic_tree": 150, "magic_tree_stump": 90, "pine": 130, "pine_stump": 70,
    "bamboo": 110, "bamboo_stump": 90, "grass_tuft": 60, "sapling": 56,
    "glowshrooms": 80, "mushroom_tiny": 50, "sunflower": 70,
    "boulder": 100, "gold_boulder": 100,
    "campfire_lit": 90, "campfire_out": 90, "fire_pit": 110,
    "kappa_workbench": 130, "yatai": 170, "chest": 90,
    "parasol": 56,
}
ICON_W = 112   # 网格切片后每格缩放到 112
SCENE_W = {"title": 1536, "death": 1024}

GREEN = np.array([0, 255, 0], dtype=np.float32)

def key_alpha(im):
    """绿幕键控: 返回 RGBA 数组。色距 + 去绿边。"""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # 绿幕判定: g 显著大于 r,b
    greenness = g - np.maximum(r, b)
    mask = (greenness > 60) & (g > 120)
    alpha = np.where(mask, 0, 255).astype(np.uint8)
    # 边缘软化: 对 greenness 在 30~60 之间的像素做半透明
    soft = (greenness > 30) & (greenness <= 60) & (g > 100)
    alpha[soft] = ((60 - greenness[soft]) / 30 * 255 * 0.4).astype(np.uint8)
    # 去绿边: 把残留绿色溢出的像素绿色钳制到 max(r,b)
    spill = (g > np.maximum(r, b)) & (alpha > 0)
    a[..., 1] = np.where(spill, np.maximum(r, b), g)
    rgba = np.dstack([a.astype(np.uint8), alpha])
    return rgba

def autocrop(rgba, pad=4):
    alpha = rgba[..., 3]
    ys, xs = np.where(alpha > 8)
    if len(xs) == 0:
        return None
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(rgba.shape[1], x1 + pad + 1); y1 = min(rgba.shape[0], y1 + pad + 1)
    return rgba[y0:y1, x0:x1]

def to_img(rgba): return Image.fromarray(rgba, "RGBA")

def resize_w(im, w):
    if im.width <= w: return im
    h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)

def process_single(name, path, target_w):
    im = Image.open(path)
    rgba = key_alpha(im)
    cropped = autocrop(rgba)
    if cropped is None:
        print(f"  WARN {name}: empty after keying")
        return None
    img = to_img(cropped)
    img = resize_w(img, target_w)
    return img

def process_grid(name, path):
    """3x3 网格切片: 按整图三等分, 每格内再键控+autocrop。"""
    im = Image.open(path)
    W, H = im.size
    cw, ch = W / 3, H / 3
    cells = GRID_CELLS[name]
    out = {}
    for i, cell_name in enumerate(cells):
        gx, gy = i % 3, i // 3
        box = (round(gx * cw), round(gy * ch), round((gx + 1) * cw), round((gy + 1) * ch))
        cell = im.crop(box)
        rgba = key_alpha(cell)
        cropped = autocrop(rgba, pad=6)
        if cropped is None:
            print(f"  WARN {name}[{cell_name}]: empty cell")
            continue
        img = to_img(cropped)
        # 图标统一到 112 内框
        img.thumbnail((ICON_W, ICON_W), Image.LANCZOS)
        out[cell_name] = img
    return out

def main():
    os.makedirs(OUT, exist_ok=True)
    sprites = {}   # name -> PIL image
    # 1) 场景图直接缩放拷贝
    SCENE_OUT = {"title": "title", "death": "death"}
    for name, w in SCENE_W.items():
        p = os.path.join(INB, name + ".png")
        if not os.path.exists(p):
            print(f"  MISSING scene {name}")
            continue
        im = Image.open(p).convert("RGB")
        im = resize_w(im, w)
        key = SCENE_OUT[name]
        im.save(os.path.join(OUT, key + ".png"), optimize=True)
        print(f"  scene {key}: {im.size}")
    # 2) 单体精灵
    for t in TASKS:
        name = t["name"]
        if t.get("scene") or t.get("grid"): continue
        p = os.path.join(INB, name + ".png")
        if not os.path.exists(p):
            print(f"  MISSING {name}")
            continue
        img = process_single(name, p, TARGET_W.get(name, 100))
        if img: sprites[name] = img
    # 3) 网格切片
    for t in TASKS:
        name = t["name"]
        if not t.get("grid"): continue
        p = os.path.join(INB, name + ".png")
        if not os.path.exists(p):
            print(f"  MISSING grid {name}")
            continue
        for cell_name, img in process_grid(name, p).items():
            sprites[cell_name] = img
    # 4) 打包图集（简单货架算法）
    names = sorted(sprites.keys())
    imgs = [sprites[n] for n in names]
    pad = 2
    total_area = sum((im.width + pad) * (im.height + pad) for im in imgs)
    side = int(math.sqrt(total_area) * 1.15) + 16
    side = 1 << (side - 1).bit_length()  # 2 的幂
    atlas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    frames = {}
    x = y = pad
    row_h = 0
    for n, im in zip(names, imgs):
        if x + im.width + pad > side:
            x = pad; y += row_h + pad; row_h = 0
        if y + im.height + pad > side:
            print("  ATLAS OVERFLOW, please enlarge")
            break
        atlas.paste(im, (x, y), im)
        frames[n] = dict(x=x, y=y, w=im.width, h=im.height)
        x += im.width + pad
        row_h = max(row_h, im.height)
    atlas.save(os.path.join(OUT, "atlas.png"), optimize=True)
    with open(os.path.join(OUT, "atlas.json"), "w") as f:
        json.dump({"frames": frames}, f)
    print(f"atlas: {side}x{side}, {len(frames)} frames, {os.path.getsize(os.path.join(OUT,'atlas.png'))//1024}KB")

if __name__ == "__main__":
    main()
