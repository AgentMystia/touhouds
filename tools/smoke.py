#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""smoke.py — Playwright 冒烟测试：加载游戏，收集 console 错误，跑关键路径。"""
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8899"

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE + "/game/index.html?test=1")
        await page.wait_for_timeout(4000)
        state = await page.evaluate("""() => {
          const st = window.__st;
          if (!st || !st.player) return {ok:false};
          return {ok:true, mode: st.player ? 'game' : '?', hp: st.player.hp,
                  day: st.time.day, phase: st.phase(), ents: st.entities.length,
                  naturals: st.naturals.length, fps: window.__fps};
        }""")
        print("STATE:", json.dumps(state, ensure_ascii=False))
        await page.screenshot(path="/tmp/shot_game.png")
        # 模拟移动几秒
        await page.keyboard.down("KeyD")
        await page.wait_for_timeout(1500)
        await page.keyboard.up("KeyD")
        await page.keyboard.down("KeyS")
        await page.wait_for_timeout(1000)
        await page.keyboard.up("KeyS")
        await page.wait_for_timeout(2000)
        state2 = await page.evaluate("""() => {
          const st = window.__st;
          return {x: st.player.x, y: st.player.y, hp: st.player.hp,
                  hunger: st.player.hunger, sanity: st.player.sanity, fps: window.__fps,
                  phase: st.phase(), t: st.time.t};
        }""")
        print("MOVED:", json.dumps(state2, ensure_ascii=False))
        await page.screenshot(path="/tmp/shot_moved.png")
        print("ERRORS:", len(errors))
        for e in errors[:12]: print("  E:", e[:220])
        await browser.close()
        return 1 if errors else 0

sys.exit(asyncio.run(main()))
