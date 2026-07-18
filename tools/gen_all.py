#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_all.py — 按 manifest 并发生成全部资产，断点续跑 + 绿幕质量校验重试。
用法: python3 tools/gen_all.py [--workers 3] [--only name1,name2]
"""
import argparse, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manifest import TASKS, STYLE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INB = os.path.join(ROOT, "output/imagegen/inb")
IMAGEGEN = os.path.join(ROOT, "tools/imagegen.py")
LOG = os.path.join(INB, "gen.log")

def out_path(t): return os.path.join(INB, t["name"] + ".png")

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f: f.write(line + "\n")

def green_score(path):
    """返回 (绿色像素占比, 主体占比)。绿幕合格: green>0.25 且主体在 3%-85%。"""
    from PIL import Image
    im = Image.open(path).convert("RGB")
    im.thumbnail((256, 256))
    w, h = im.size
    px = im.load()
    green = subject = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if g > 180 and g > r * 1.8 and g > b * 1.8:
                green += 1
            else:
                subject += 1
    total = w * h
    return green / total, subject / total

def build_cmd(t, extra_hint=""):
    cmd = [sys.executable, IMAGEGEN, t["kind"], "--model", "gpt-image-2",
           "--prompt", t["prompt"] + extra_hint,
           "--style", STYLE, "--quality", "high", "--size", t["size"],
           "--out", out_path(t)]
    if t["kind"] == "edit":
        cmd += ["--image", os.path.join(INB, t["ref"] + ".png")]
    else:
        if t.get("composition"): cmd += ["--composition", t["composition"]]
        cmd += ["--use-case", "game-art"]
    if t.get("constraints"): cmd += ["--constraints", t["constraints"]]
    return cmd

def run_task(t):
    name = t["name"]
    if os.path.exists(out_path(t)) and os.path.getsize(out_path(t)) > 30000:
        log(f"SKIP {name} (exists)")
        return name, True
    for attempt in range(3):
        hint = ""
        if attempt > 0 and not t.get("scene"):
            hint = ("\nIMPORTANT: the background MUST be completely filled with uniform flat "
                    "#00FF00 pure green with zero scenery; the subject must be large and centered.")
        try:
            r = subprocess.run(build_cmd(t, hint), capture_output=True, text=True, timeout=900)
            if r.returncode != 0:
                log(f"FAIL {name} attempt{attempt+1}: {r.stderr.strip()[-200:]}")
                time.sleep(10); continue
            if t.get("scene"):
                log(f"OK {name}")
                return name, True
            g, s = green_score(out_path(t))
            if g > 0.25 and 0.03 < s < 0.85:
                log(f"OK {name} (green={g:.2f} subject={s:.2f})")
                return name, True
            log(f"REJECT {name} quality (green={g:.2f} subject={s:.2f}), regenerating")
            os.remove(out_path(t))
        except subprocess.TimeoutExpired:
            log(f"TIMEOUT {name} attempt{attempt+1}")
        except Exception as e:
            log(f"ERROR {name} attempt{attempt+1}: {e}")
        time.sleep(5)
    log(f"GIVEUP {name}")
    return name, False

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--only")
    args = ap.parse_args()
    os.makedirs(INB, exist_ok=True)
    tasks = TASKS
    if args.only:
        wanted = set(args.only.split(","))
        tasks = [t for t in TASKS if t["name"] in wanted]

    done = {}
    pending = list(tasks)
    for round_no in range(6):
        ready = [t for t in pending
                 if t["kind"] == "generate" or
                 (os.path.exists(os.path.join(INB, t["ref"] + ".png")))]
        if not ready:
            break
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = {ex.submit(run_task, t): t for t in ready}
            for f in as_completed(futs):
                name, ok = f.result()
                done[name] = ok
        pending = [t for t in pending if t["name"] not in done]
        if not pending:
            break
        # edit 任务若参考图还没好，下一轮再试
        time.sleep(2)

    failed = [t["name"] for t in tasks if not done.get(t["name"])]
    log(f"=== DONE. ok={sum(1 for v in done.values() if v)} failed={len(failed)} {failed}")
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
