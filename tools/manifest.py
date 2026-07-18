# -*- coding: utf-8 -*-
"""manifest.py — 全部美术资产生成任务清单（声明式）。
每条: dict(name, kind='generate'|'edit', out, size, prompt, ref=None, grid=False, scene=False)
ref: edit 任务的参考图输出名（自动补 inb 路径）。
"""
STYLE = ("Touhou Project doujin style 2D anime game art, clean cel shading, "
         "crisp dark outline, vivid saturated colors")
GREEN = ("solid uniform pure green background #00FF00 covering every empty area; "
         "single subject only; no text; no watermark; no logo; no drop shadow; no background scenery")
GREEN_MULTI = ("solid uniform pure green background #00FF00 covering every empty area; "
               "no text; no watermark; no logo; no drop shadow; no background scenery")
EDIT_KEEP = ("keep the exact same character design, colors and outfit as Image 1; "
             "solid uniform pure green background #00FF00; single subject; no text; no watermark")

MYSTIA = ("Mystia Lorelei the night sparrow youkai: petite girl with short pink hair, grey eyes, "
          "pointed owl ears, small brown winged hat, brown dress with white apron layer and "
          "bird-shaped ornaments, light pink feathered wings with purple tips on her back, "
          "red claw-like long nails, cheerful mischievous smile")
RUMIA = ("Rumia the youkai of darkness: small girl with short blonde hair, red eyes, red ribbon "
         "on the left side of her head, black vest and long skirt over white long-sleeved blouse "
         "with red necktie, arms spread out to her sides, wisps of black darkness floating around her")
YUUKA = ("Yuuka Kazami the flower master: tall elegant woman with shoulder-length wavy green hair, "
         "red eyes, red and dark-pink plaid vest and long plaid skirt over white long-sleeved shirt "
         "with yellow neckerchief, holding an open pink parasol over her shoulder, "
         "gentle but menacing smile")

TASKS = [
    # ---------- 场景（非绿幕） ----------
    dict(name="title", kind="generate", size="1536x1024", scene=True,
         prompt=("Night scene at a Japanese forest clearing: " + MYSTIA +
                 ", cheerfully grilling skewers at her small wooden yatai food cart with glowing "
                 "red paper lanterns (blank, no writing); " + RUMIA +
                 " floating playfully nearby; fireflies and pale ghost-lights in the air, "
                 "starry night sky, warm cozy lantern light"),
         composition="wide cinematic scene, food cart on the right, open sky space at top for title",
         constraints="no text; no watermark; no logo"),
    dict(name="death", kind="generate", size="1024x1024", scene=True,
         prompt=("Somber melancholic night scene: " + RUMIA +
                 ", kneeling down and gently holding a small brown winged hat in her hands, "
                 "head bowed in sadness; soft feathers and glowing fading music notes drifting "
                 "away into the deep blue-black darkness, single beam of moonlight"),
         composition="centered intimate scene, lots of dark negative space",
         constraints="no text; no watermark; no logo"),

    # ---------- 米斯蒂娅 ----------
    dict(name="mystia_portrait", kind="generate", size="1024x1536",
         prompt=MYSTIA + ". Full-body cut-in illustration.",
         composition="single centered full-body character, 12% margin", constraints=GREEN),
    dict(name="mystia_front", kind="edit", ref="mystia_portrait", size="1024x1024",
         prompt=("Image 1 is the character reference. Create a tiny top-down 3/4 view game sprite "
                 "of the same character: full body facing the camera, wings slightly spread, "
                 "chibi proportions, readable at 96 pixels."),
         constraints=EDIT_KEEP),
    dict(name="mystia_side", kind="edit", ref="mystia_portrait", size="1024x1024",
         prompt=("Image 1 is the character reference. Create a tiny top-down 3/4 view game sprite "
                 "of the same character: full body in left-facing profile, walking pose, "
                 "chibi proportions, readable at 96 pixels."),
         constraints=EDIT_KEEP),
    dict(name="mystia_back", kind="edit", ref="mystia_portrait", size="1024x1024",
         prompt=("Image 1 is the character reference. Create a tiny top-down 3/4 view game sprite "
                 "of the same character: full body seen from behind, back view, wings folded, "
                 "chibi proportions, readable at 96 pixels."),
         constraints=EDIT_KEEP),

    # ---------- 生物 ----------
    dict(name="fairy", kind="generate", size="1024x1024",
         prompt=("Small cute Touhou fairy: tiny girl with transparent insect wings, frilly "
                 "light-blue dress, short hair with a ribbon, mischievous smile, floating pose"),
         composition="single centered character, 10% margin", constraints=GREEN),
    dict(name="fairy_hostile", kind="edit", ref="fairy", size="1024x1024",
         prompt=("Image 1 is the character reference. The same fairy but angry and hostile: "
                 "red glowing eyes, dark aura, bared fangs, aggressive lunging attack pose."),
         constraints=EDIT_KEEP),
    dict(name="kedama", kind="generate", size="1024x1024",
         prompt=("Kedama fluff-ball youkai: a round ball of soft white fur with two simple black "
                 "eyes and a tiny mouth, no limbs, slightly floating, fluffy texture"),
         composition="single centered creature, 15% margin", constraints=GREEN),
    dict(name="spirit", kind="generate", size="1024x1024",
         prompt=("Vengeful ghost spirit: pale blue-white wispy ghost with a trailing tail instead "
                 "of legs, hollow dark eyes, tattered burial kimono, eerie cold glow"),
         composition="single centered creature, 10% margin", constraints=GREEN),
    dict(name="sparrow", kind="generate", size="1024x1024",
         prompt=("Small cute plump brown sparrow bird standing, side view, simple and charming"),
         composition="single centered bird, 20% margin", constraints=GREEN),
    dict(name="lamprey", kind="generate", size="1024x1024",
         prompt=("A lamprey eel: long cylindrical dark-brown eel-like fish with a round sucker "
                 "mouth and small fins, gently curved, side view"),
         composition="single centered fish, 12% margin", constraints=GREEN),
    dict(name="treeguard", kind="generate", size="1024x1024",
         prompt=("Giant tree guardian monster: massive gnarled walking tree with a grimacing face "
                 "in the bark, glowing amber eyes, long branch arms with leafy claws, thick roots "
                 "as legs, dark fantasy"),
         composition="single centered creature, 8% margin", constraints=GREEN),
    dict(name="rumia", kind="generate", size="1024x1024",
         prompt=RUMIA,
         composition="single centered full-body character, 10% margin", constraints=GREEN),
    dict(name="yuuka", kind="generate", size="1024x1536",
         prompt=YUUKA + ". Full-body boss illustration.",
         composition="single centered full-body character, 8% margin", constraints=GREEN),
    dict(name="yuuka_enraged", kind="edit", ref="yuuka", size="1024x1536",
         prompt=("Image 1 is the character reference. The same woman now enraged: parasol closed "
                 "and held low like a lance, fierce glowing red eyes, hair whipping upward, "
                 "dark red battle aura, sunflower petals swirling around her, menacing battle stance."),
         constraints=EDIT_KEEP),

    # ---------- 植被/资源 ----------
    dict(name="magic_tree", kind="generate", size="1024x1024",
         prompt=("Tall gnarled fantasy tree with dark purple-green leaves and small glowing blue "
                 "mushrooms growing on its trunk"),
         composition="single centered tree, full height, 8% margin", constraints=GREEN),
    dict(name="magic_tree_stump", kind="edit", ref="magic_tree", size="1024x1024",
         prompt=("Image 1 shows a tree. Create the same tree cut down: only a short gnarled stump "
                 "with visible roots remains, fresh cut surface on top, a few glowing mushrooms "
                 "still on it."),
         constraints=EDIT_KEEP),
    dict(name="bamboo", kind="generate", size="1024x1024",
         prompt="Cluster of tall green bamboo stalks with slender leaves, fresh and dense",
         composition="single centered bamboo cluster, full height, 8% margin", constraints=GREEN),
    dict(name="bamboo_stump", kind="edit", ref="bamboo", size="1024x1024",
         prompt=("Image 1 shows a bamboo cluster. Create the same cluster harvested: only short "
                 "cut bamboo stubs close to the ground remain, clean diagonal cuts."),
         constraints=EDIT_KEEP),
    dict(name="pine", kind="generate", size="1024x1024",
         prompt="Stylized evergreen pine tree with layered dark-green foliage and short trunk",
         composition="single centered tree, full height, 8% margin", constraints=GREEN),
    dict(name="grass_tuft", kind="generate", size="1024x1024",
         prompt="Tuft of tall wild grass with a few seed heads swaying",
         composition="single centered plant, 15% margin", constraints=GREEN),
    dict(name="sapling", kind="generate", size="1024x1024",
         prompt="Small woody sapling with a few thin bare branches and sparse young leaves",
         composition="single centered plant, 15% margin", constraints=GREEN),
    dict(name="glowshrooms", kind="generate", size="1024x1024",
         prompt=("Cluster of glowing blue-cyan bioluminescent mushrooms of different heights, "
                 "soft magical glow"),
         composition="single centered cluster, 12% margin", constraints=GREEN),
    dict(name="sunflower", kind="generate", size="1024x1024",
         prompt="Single tall sunflower with a large golden flower head facing slightly forward",
         composition="single centered flower, full height, 10% margin", constraints=GREEN),
    dict(name="boulder", kind="generate", size="1024x1024",
         prompt="Large grey mossy boulder with cracks, sitting on the ground",
         composition="single centered rock, 15% margin", constraints=GREEN),
    dict(name="gold_boulder", kind="edit", ref="boulder", size="1024x1024",
         prompt=("Image 1 shows a boulder. Create the same boulder but with visible gold veins "
                 "and shiny gold chunks embedded in the rock."),
         constraints=EDIT_KEEP),

    # ---------- 建筑 ----------
    dict(name="campfire_lit", kind="generate", size="1024x1024",
         prompt="Small campfire: burning logs with lively orange flames and tiny rising sparks",
         composition="single centered campfire, 18% margin", constraints=GREEN),
    dict(name="campfire_out", kind="edit", ref="campfire_lit", size="1024x1024",
         prompt=("Image 1 shows a burning campfire. Create the same campfire completely "
                 "extinguished: charred black logs only, no flames, no smoke, cold ashes."),
         constraints=EDIT_KEEP),
    dict(name="fire_pit", kind="generate", size="1024x1024",
         prompt="Stone fire pit: neat ring of grey stones with a burning fire and logs inside",
         composition="single centered fire pit, 15% margin", constraints=GREEN),
    dict(name="kappa_workbench", kind="generate", size="1024x1024",
         prompt=("Kappa engineering workbench: sturdy wooden workbench with brass gears, "
                 "blue-green metal gadgets, hanging tools and a small hand crank, quirky "
                 "fantasy steampunk"),
         composition="single centered workbench, 10% margin", constraints=GREEN),
    dict(name="yatai", kind="generate", size="1024x1024",
         prompt=("Traditional Japanese night food cart (yatai): small wooden street food stall "
                 "on wheels with glowing red paper lanterns (completely blank, no writing), plain "
                 "noren curtain, charcoal grill with skewers, cozy warm light"),
         composition="single centered cart, 8% margin", constraints=GREEN),
    dict(name="chest", kind="generate", size="1024x1024",
         prompt="Small wooden storage chest with dark iron bands and a latch, closed lid",
         composition="single centered chest, 15% margin", constraints=GREEN),

    # ---------- 图标 3x3 网格 ----------
    dict(name="icons_tools", kind="generate", size="1024x1024", grid=True,
         prompt=("9 game item icons in a strict 3x3 grid, evenly spaced, each icon centered in "
                 "its own cell: 1 wood axe, 2 iron pickaxe, 3 bamboo fishing rod, 4 burning "
                 "wooden torch, 5 wooden spear with stone tip, 6 wooden armor vest, 7 grilled "
                 "lamprey skewer shaped like a club (weapon), 8 coiled rope, 9 small box trap "
                 "made of sticks"),
         composition="strict 3x3 grid, generous green gutters between cells", constraints=GREEN_MULTI),
    dict(name="icons_materials", kind="generate", size="1024x1024", grid=True,
         prompt=("9 game item icons in a strict 3x3 grid, evenly spaced, each icon centered in "
                 "its own cell: 1 wooden log, 2 cut grey stone block, 3 wooden plank, 4 grey "
                 "flint stone, 5 shiny gold nugget, 6 dark feather, 7 piece of green bamboo, "
                 "8 flower garland crown, 9 paper charm talisman with a red knot (blank, no writing)"),
         composition="strict 3x3 grid, generous green gutters between cells", constraints=GREEN_MULTI),
    dict(name="icons_food_raw", kind="generate", size="1024x1024", grid=True,
         prompt=("9 game item icons in a strict 3x3 grid, evenly spaced, each icon centered in "
                 "its own cell: 1 red mushroom with white spots, 2 glowing blue mushroom, 3 pink "
                 "flower petals, 4 wild ginseng root, 5 raw lamprey eel, 6 dark purple berries, "
                 "7 chunk of raw meat, 8 bamboo shoot, 9 small white egg"),
         composition="strict 3x3 grid, generous green gutters between cells", constraints=GREEN_MULTI),
    dict(name="icons_dishes", kind="generate", size="1024x1024", grid=True,
         prompt=("9 game item icons in a strict 3x3 grid, evenly spaced, each icon centered in "
                 "its own cell: 1 grilled lamprey skewer glazed with sauce, 2 roasted mushrooms "
                 "on a stick, 3 bowl of hearty vegetable stew, 4 three tsukimi dango dumplings on "
                 "a skewer, 5 bamboo shoot rice in a bamboo tube, 6 ominous black sludge dish, "
                 "7 roasted meat on the bone, 8 small healing salve jar, 9 wrapped rice ball bento"),
         composition="strict 3x3 grid, generous green gutters between cells", constraints=GREEN_MULTI),
    dict(name="scatter", kind="generate", size="1024x1024", grid=True,
         prompt=("9 tiny ground decoration sprites in a strict 3x3 grid, evenly spaced, each "
                 "centered in its own cell: 1 small grey pebble, 2 tiny white wildflower, 3 tiny "
                 "pink wildflower, 4 short grass blades, 5 tiny red mushroom, 6 fallen brown leaf, "
                 "7 small butterfly, 8 single pink petal, 9 tiny blue wildflower"),
         composition="strict 3x3 grid, generous green gutters between cells", constraints=GREEN_MULTI),
]

# 网格图标切片顺序（3x3 行优先），供 postprocess 与游戏 defs 对齐
GRID_CELLS = {
    "icons_tools": ["axe", "pickaxe", "fishing_rod", "torch", "spear", "wood_armor",
                    "lamprey_bat", "rope", "trap"],
    "icons_materials": ["log", "cut_stone", "plank", "flint", "gold_nugget", "feather",
                        "bamboo_piece", "flower_garland", "charm"],
    "icons_food_raw": ["red_mushroom", "blue_mushroom", "petals", "ginseng", "raw_lamprey",
                       "dark_berries", "raw_meat", "bamboo_shoot", "egg"],
    "icons_dishes": ["grilled_lamprey", "roast_mushrooms", "fairy_stew", "tsukimi_dango",
                     "bamboo_rice", "dark_cuisine", "roast_meat", "salve", "rice_ball"],
    "scatter": ["pebble", "flower_white", "flower_pink", "grass_blades", "mushroom_tiny",
                "leaf", "butterfly", "petal", "flower_blue"],
}
