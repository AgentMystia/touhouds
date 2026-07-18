#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""shots.py — 多场景截图验收。"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8899"
OUT = "/tmp/shots"
import os; os.makedirs(OUT, exist_ok=True)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # 1) 标题画面
        await page.goto(BASE + "/game/index.html")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=f"{OUT}/01_title.png")

        # 进游戏（白天森林）
        await page.goto(BASE + "/game/index.html?test=1")
        await page.wait_for_timeout(3000)
        # 传送到森林茂密处
        await page.evaluate("""() => {
          const st = window.__st;
          // 找一片魔法树多的地方
          let bx=0, by=0, bn=0;
          for (const n of st.naturals) {
            if (n.id === 'magic_tree') {
              let c = 0;
              for (const m of st.naturals) if (m.id==='magic_tree' && (m.x-n.x)**2+(m.y-n.y)**2 < 300*300) c++;
              if (c > bn) { bn = c; bx = n.x; by = n.y; }
            }
          }
          st.player.x = bx; st.player.y = by;
        }""")
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{OUT}/02_forest_day.png")

        # 3) 夜晚篝火
        await page.evaluate("""() => {
          const st = window.__st;
          st.time.t = 15.2 * 30;  // 夜
          const p = st.player;
          st.addBuilding('campfire', p.x + 80, p.y + 30);
          st.addBuilding('fire_pit', p.x - 100, p.y - 20);
        }""")
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{OUT}/03_night_fire.png")

        # 4) 制作菜单
        await page.evaluate("() => { window.__st.uiSel = -1; }")
        await page.mouse.click(70, 800 - 110)
        await page.wait_for_timeout(500)
        await page.screenshot(path=f"{OUT}/04_craft.png")
        await page.mouse.click(70, 800 - 110)  # 关

        # 5) 屋台烹饪
        await page.evaluate("""async () => {
          const st = window.__st;
          const p = st.player;
          const yatai = st.addBuilding('yatai', p.x + 60, p.y - 40);
          yatai.cookSlots = [{id:'raw_lamprey'},{id:'red_mushroom'},{id:'petals'},{id:'ginseng'}];
          const ui = (await import('./src/ui/hud.js')).ui;
          ui.yataiTarget = yatai;
        }""")
        await page.wait_for_timeout(500)
        await page.screenshot(path=f"{OUT}/05_yatai.png")
        await page.evaluate("""async () => {
          const ui = (await import('./src/ui/hud.js')).ui;
          ui.yataiTarget = null;
        }""")

        # 6) 低理智怨灵 + 黑暗（冻结战斗 AI，只摆拍）
        await page.evaluate("""() => {
          const st = window.__st;
          const p = st.player;
          p.sanity = 30;
          st.time.t = 15.5 * 30;
          for (const b of st.buildings) b.lit = false;
          st.debugFreeze = true;  // 摆拍，别让怨灵真的打死
          st.spawnCreature('spirit', p.x + 120, p.y);
          st.spawnCreature('spirit', p.x - 100, p.y + 60);
          st.spawnCreature('spirit', p.x + 40, p.y - 120);
        }""")
        await page.wait_for_timeout(600)
        await page.screenshot(path=f"{OUT}/06_spirits.png")

        # 7) 露米娅夜访
        await page.evaluate("""() => {
          const st = window.__st;
          const p = st.player;
          p.sanity = 200;
          p.hp = 150;
          for (const c of st.creatures.slice()) if (c.id === 'spirit') st.removeEntity(c);
          st.spawnCreature('rumia', p.x + 130, p.y - 40);
        }""")
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{OUT}/07_rumia.png")

        # 8) 幽香领地（白天）
        await page.evaluate("""() => {
          const st = window.__st;
          st.time.t = 3 * 30;  // 白天
          const g = st.world.garden;
          st.player.x = g.x + 100; st.player.y = g.y + 60;
          const y = st.creatures.find(c=>c.id==='yuuka');
          if (y) { y.state = 'combat'; y.target = st.player; y.hp = 8000; }
        }""")
        await page.wait_for_timeout(600)
        await page.screenshot(path=f"{OUT}/08_yuuka.png")

        # 9) 幽香狂暴
        await page.evaluate("""() => {
          const st = window.__st;
          const y = st.creatures.find(c=>c.id==='yuuka');
          if (y) { y.hp = 2000; y.enraged = true; }
        }""")
        await page.wait_for_timeout(500)
        await page.screenshot(path=f"{OUT}/09_yuuka_enraged.png")
        await page.evaluate("() => { window.__st.debugFreeze = false; }")

        # 10) 死亡画面
        await page.evaluate("""async () => {
          const ui = (await import('./src/ui/hud.js')).ui;
          const st = window.__st;
          st.stats.daysSurvived = 7; st.stats.kills = 23; st.stats.dishes = 11;
          ui.mode = 'dead';
        }""")
        await page.wait_for_timeout(600)
        await page.screenshot(path=f"{OUT}/10_death.png")

        print("shots done. errors:", len(errors))
        for e in errors[:6]: print(" E:", e[:180])
        await browser.close()

asyncio.run(main())
