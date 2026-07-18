#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""keypath.py — 完整关键路径测试：采集→制作→建造→烹饪→战斗→幽香战。"""
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8899"

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "404" not in m.text and "Failed to load resource" not in m.text else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE + "/game/index.html?test=1")
        await page.wait_for_timeout(3500)

        # 1) 采集：直接调用系统函数砍树
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const p = st.player;
          // 给玩家一把斧
          S.giveItem(st, p, 'axe', 1);
          const inv = p.inv.find(s => s && s.id === 'axe');
          inv.dur = 100;
          p.equip.hand = {id:'axe', dur:100};
          // 找最近的魔法树
          let best=null, bd=1e9;
          for (const n of st.naturals) {
            if (n.id !== 'magic_tree' || n.picked) continue;
            const d = (n.x-p.x)**2 + (n.y-p.y)**2;
            if (d < bd) { bd=d; best=n; }
          }
          if (!best) return {fail:'no tree'};
          // 传送过去砍
          p.x = best.x + 40; p.y = best.y;
          for (let i=0;i<14;i++) {
            S.startAction(st, 'chop', best);
            for (let j=0;j<30;j++) S.updateAction(st, 0.1);
          }
          const logs = p.inv.filter(s=>s&&s.id==='log').reduce((a,s)=>a+s.n,0);
          return {logs, treePicked: best.picked};
        }""")
        print("1 CHOP:", json.dumps(r, ensure_ascii=False))

        # 2) 制作
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const {RECIPES} = await import('./src/game/defs.js');
          const p = st.player;
          S.giveItem(st, p, 'twigs', 10); S.giveItem(st, p, 'flint', 10);
          S.giveItem(st, p, 'grass', 20); S.giveItem(st, p, 'stone', 10); S.giveItem(st, p, 'gold', 5);
          const r1 = RECIPES.find(r=>r.id==='rope');
          const ok1 = S.craft(st, r1);
          const rope = p.inv.filter(s=>s&&s.id==='rope').reduce((a,s)=>a+s.n,0);
          return {ok1, rope};
        }""")
        print("2 CRAFT:", json.dumps(r, ensure_ascii=False))

        # 3) 建造篝火+工作台+屋台
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const p = st.player;
          const fire = st.addBuilding('campfire', p.x+100, p.y);
          const bench = st.addBuilding('kappa_workbench', p.x+200, p.y);
          const yatai = st.addBuilding('yatai', p.x-150, p.y);
          return {buildings: st.buildings.length, nearBench: S.nearBench(st)};
        }""")
        print("3 BUILD:", json.dumps(r, ensure_ascii=False))

        # 4) 屋台烹饪烤八目鳗
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const p = st.player;
          const yatai = st.buildings.find(b=>b.id==='yatai');
          yatai.cookSlots = [{id:'raw_lamprey'},{id:'red_mushroom'},{id:'petals'},{id:'ginseng'}];
          S.startCooking(st, yatai);
          for (let i=0;i<80;i++) S.updateBuildings(st, 0.1);
          return {readyDish: yatai.readyDish, cooking: yatai.cooking};
        }""")
        print("4 COOK:", json.dumps(r, ensure_ascii=False))

        # 5) 吃 + 战斗
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const p = st.player;
          p.hunger = 50;
          const yatai = st.buildings.find(b=>b.id==='yatai');
          S.giveItem(st, p, yatai.readyDish, 1);
          const food = p.inv.find(s=>s&&(s.id==='grilled_lamprey'||s.id==='fairy_stew'||s.id==='tsukimi_dango'));
          if (food) S.eat(st, food);
          const hungerAfter = p.hunger;
          // 战斗：招一只毛玉打
          const k = st.spawnCreature('kedama', p.x+50, p.y);
          p.equip.hand = {id:'spear', dur:150};
          let eatOk = false;
          const food2 = p.inv.find(s=>s&&(s.id==='grilled_lamprey'));
          if (food2) eatOk = !!S.eat(st, food2);
          const hungerAfter2 = p.hunger;
          for (let i=0;i<40;i++) {
            S.playerAttack(st);
            p.atkCd = 0;
          }
          return {hungerBefore: 50, hungerAfter: hungerAfter2, eatOk, kedamaDead: k.dead, kills: st.stats.kills};
        }""")
        print("5 EAT+FIGHT:", json.dumps(r, ensure_ascii=False))

        # 6) 夜雀之歌
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const p = st.player;
          p.songCd = 0; p.sanity = 100;
          st.spawnCreature('spirit', p.x+100, p.y);
          S.castSong(st);
          const spirit = st.creatures.find(c=>c.id==='spirit');
          return {songCd: p.songCd, spiritStun: spirit ? spirit.stun : null};
        }""")
        print("6 SONG:", json.dumps(r, ensure_ascii=False))

        # 7) 幽香战：打6走1 无伤验证（用 debugFreeze 冻结游戏内建 AI，手动驱动）
        await page.evaluate("() => { window.__st.debugFreeze = true; }")
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const p = st.player;
          const y = st.creatures.find(c=>c.id==='yuuka');
          if (!y) return {fail:'no yuuka'};
          // 传送到花园
          const g = st.world.garden;
          p.x = g.x + 300; p.y = g.y;
          p.hp = 150;
          p.sanity = 200;           // 满理智，防怨灵骚扰
          p.atkCd = 0;
          // 清掉测试残留生物，只留幽香
          for (const c of st.creatures.slice()) if (c.id !== 'yuuka') st.removeEntity(c);
          p.equip.hand = {id:'lamprey_bat', fresh:1};
          p.equip.body = {id:'wood_armor', dur:315};
          // 拉仇恨
          y.state = 'combat'; y.target = p;
          let hits = 0, playerHurt = 0, ticks = 0;
          const startHp = y.hp;
          const dbg = [];
          // 模拟 30 秒打6走1
          let yuukaAtkCount = 0, playerDodged = 0;
          for (let t=0; t<30; t+=0.05) {
            ticks++;
            // 玩家逻辑：靠近→打→在幽香攻击前摇时后撤
            const d = Math.hypot(p.x-y.x, p.y-y.y);
            const yuukaAttacking = y.pendingHit != null;
            if (ticks < 10 || ticks % 60 === 0) dbg.push({tk: ticks, d: +d.toFixed(1), atkCd: +p.atkCd.toFixed(2), hits, yPh: y.pendingHit ? +y.pendingHit.t.toFixed(2) : null, yState: y.state});
            if (yuukaAttacking) {
              // 后撤（打 N 走 1 的"走"）—— 玩家 260 > 狂暴幽香 94, 轻松甩开
              const a = Math.atan2(p.y-y.y, p.x-y.x);
              p.x += Math.cos(a) * 260 * 0.05;
              p.y += Math.sin(a) * 260 * 0.05;
            } else if (d > 55) {
              const a = Math.atan2(y.y-p.y, y.x-p.x);
              p.x += Math.cos(a) * 260 * 0.05;
              p.y += Math.sin(a) * 260 * 0.05;
            }
            // 站定输出（只要没在躲就能打）
            if (p.atkCd <= 0 && !yuukaAttacking) {
              const r = S.playerAttack(st);
              if (r) hits++;
            }
            p.atkCd = Math.max(0, p.atkCd - 0.05);
            // 幽香 AI
            const hpBefore = p.hp;
            const d2p = Math.hypot(p.x-y.x, p.y-y.y);
            // 手动驱动 yuuka AI（绕过 updateCreatures 的 switch）
            y.atkCd = Math.max(0, y.atkCd - 0.05);
            const speedMul = y.enraged ? 1.45 : 1.0;
            const dd = Math.hypot(p.x-y.x, p.y-y.y);
            if (dd > 100) {
              y.x += (p.x-y.x)/dd * y.def.speed * speedMul * 0.05;
              y.y += (p.y-y.y)/dd * y.def.speed * speedMul * 0.05;
            }
            if (y.atkCd <= 0 && dd < 120) {
              y.atkCd = y.enraged ? 1.15 : 1.55;
              y.pendingHit = {t:0.32, target:p, dmg:75};
              yuukaAtkCount++;
            }
            if (y.pendingHit) {
              y.pendingHit.t -= 0.05;
              if (y.pendingHit.t <= 0) {
                if (Math.hypot(p.x-y.x,p.y-y.y) < 90) S.damagePlayer(st, 75, y);
                else playerDodged++;
                y.pendingHit = null;
              }
            }
            if (p.hp < hpBefore) playerHurt++;
            if (y.hp <= 0) break;
          }
          return {ticks, hits, playerHurt, yuukaAtkCount, playerDodged, yuukaHpLost: startHp - y.hp, playerHp: p.hp, enraged: y.enraged, dbg: dbg.slice(0, 20)};
        }""")
        print("7 YUUKA 6-1:", json.dumps(r, ensure_ascii=False))
        await page.evaluate("() => { window.__st.debugFreeze = false; }")

        # 8) 狂暴阶段打4走1
        await page.evaluate("() => { window.__st.debugFreeze = true; }")
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const p = st.player;
          const y = st.creatures.find(c=>c.id==='yuuka');
          y.hp = 2800; // 压到狂暴线附近
          p.hp = 150;
          p.x = y.x + 300; p.y = y.y;
          let hits = 0, playerHurt = 0;
          for (let t=0; t<20; t+=0.05) {
            const d = Math.hypot(p.x-y.x, p.y-y.y);
            const yuukaAttacking = y.pendingHit != null;
            if (yuukaAttacking) {
              const a = Math.atan2(p.y-y.y, p.x-y.x);
              p.x += Math.cos(a) * 260 * 0.05; p.y += Math.sin(a) * 260 * 0.05;
            } else if (d > 55) {
              const a = Math.atan2(y.y-p.y, y.x-p.x);
              p.x += Math.cos(a) * 260 * 0.05; p.y += Math.sin(a) * 260 * 0.05;
            }
            if (p.atkCd <= 0 && !yuukaAttacking) { const r2 = S.playerAttack(st); if (r2) hits++; }
            p.atkCd = Math.max(0, p.atkCd - 0.05);
            y.atkCd = Math.max(0, y.atkCd - 0.05);
            const speedMul = y.enraged ? 1.45 : 1.0;
            const dd = Math.hypot(p.x-y.x, p.y-y.y);
            if (dd > 100) { y.x += (p.x-y.x)/dd*y.def.speed*speedMul*0.05; y.y += (p.y-y.y)/dd*y.def.speed*speedMul*0.05; }
            if (y.atkCd <= 0 && dd < 120) { y.atkCd = y.enraged ? 1.15 : 1.55; y.pendingHit = {t:0.32, target:p, dmg:75}; }
            if (y.pendingHit) { y.pendingHit.t -= 0.05; if (y.pendingHit.t <= 0) { if (Math.hypot(p.x-y.x,p.y-y.y)<90) { S.damagePlayer(st, 75, y); } y.pendingHit=null; } }
            // 狂暴检查
            if (!y.enraged && y.hp <= y.def.enrageAt) { y.enraged = true; }
          }
          return {hits, playerHp: p.hp, enraged: y.enraged, yuukaHp: y.hp};
        }""")
        print("8 YUUKA ENRAGE 4-1:", json.dumps(r, ensure_ascii=False))
        await page.evaluate("() => { window.__st.debugFreeze = false; }")

        # 9) 存活第一夜（露米娅不袭击 + 黑暗回理智）
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const p = st.player;
          // 传送到无光源黑暗处, 夜晚
          st.time.t = 15*30 + 10; // 夜晚
          p.x = 0; p.y = 0;
          // 清掉附近建筑光源
          for (const b of st.buildings) b.lit = false;
          p.sanity = 100; p.hp = 150;
          const dark = S.inTotalDarkness(st);
          for (let i=0;i<600;i++) S.updateStats(st, 0.1); // 60 秒
          return {inDark: dark, sanityAfter: p.sanity, hpAfter: p.hp, phase: st.phase()};
        }""")
        print("9 NIGHT:", json.dumps(r, ensure_ascii=False))

        # 10) 露米娅来访
        r = await page.evaluate("""async () => {
          const st = window.__st;
          const S = await import('./src/game/systems.js');
          const p = st.player;
          const rumia = st.spawnCreature('rumia', p.x+150, p.y);
          const sanBefore = p.sanity;
          for (let i=0;i<200;i++) { S.updateCreatures(st, 0.1); S.updateStats(st, 0.1); }
          return {sanBefore, sanAfter: p.sanity, rumiaHidden: rumia.hidden, rumiaAlive: !rumia.dead};
        }""")
        print("10 RUMIA:", json.dumps(r, ensure_ascii=False))

        # 11) 存档往返
        r = await page.evaluate("""() => {
          const st = window.__st;
          st.player.hp = 123; st.time.day = 5;
          st.save();
          const day = st.time.day, hp = st.player.hp;
          const ok = st.load();
          return {saved: {day, hp}, loaded: {day: st.time.day, hp: st.player.hp}, ok};
        }""")
        print("11 SAVE:", json.dumps(r, ensure_ascii=False))

        await page.screenshot(path="/tmp/shot_final.png")
        print("ERRORS:", len(errors))
        for e in errors[:10]: print("  E:", e[:200])
        await browser.close()

asyncio.run(main())
