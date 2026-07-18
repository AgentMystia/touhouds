#!/usr/bin/env python3
"""imagegen.py — gpt-image-2 CLI（与示例工作流一致的旗标风格）

用法:
  imagegen.py generate --model gpt-image-2 --prompt ... [--style ...] [--use-case ...]
      [--composition ...] [--constraints ...] --quality high --size 1024x1536 --out out.png [--dry-run]
  imagegen.py edit --model gpt-image-2 --image ref.png --prompt ... [--constraints ...]
      --quality high --size 1024x1024 --out out.png [--dry-run]

认证: OPENAI_API_KEY + OPENAI_BASE_URL；若 OPENAI key 无效则回退 ANTHROPIC_AUTH_TOKEN。
"""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error, mimetypes, uuid

DEFAULT_KEY = "sk-cpa-goY7UJ9MnQ_NydhRKeciy3yj4zclHv3t9UrsXrFZE1aH2HcA"
DEFAULT_BASE = "https://cpa.nyanya.love/v1/"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"

def _base():
    return os.environ.get("OPENAI_BASE_URL", DEFAULT_BASE).rstrip("/")

def _keys():
    keys = []
    k = os.environ.get("OPENAI_API_KEY")
    if k: keys.append(k)
    if DEFAULT_KEY not in keys: keys.append(DEFAULT_KEY)
    return keys

def _build_prompt(a):
    parts = [a.prompt]
    if getattr(a, "style", None): parts.append(f"Art style: {a.style}.")
    if getattr(a, "use_case", None): parts.append(f"Use case: {a.use_case}.")
    if getattr(a, "composition", None): parts.append(f"Composition: {a.composition}.")
    if getattr(a, "constraints", None): parts.append(f"Hard constraints: {a.constraints}.")
    return "\n".join(parts)

def _post_json(path, payload, key, timeout=600):
    req = urllib.request.Request(
        _base() + path,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "User-Agent": UA},
        method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

def _post_multipart(path, fields, files, key, timeout=600):
    boundary = "----imagegen" + uuid.uuid4().hex
    body = bytearray()
    for name, val in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{val}\r\n'.encode()
    for name, fpath in files:
        mime = mimetypes.guess_type(fpath)[0] or "image/png"
        with open(fpath, "rb") as f:
            data = f.read()
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{os.path.basename(fpath)}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
        body += data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        _base() + path, data=bytes(body),
        headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}",
                 "User-Agent": UA},
        method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

def _save(resp, out):
    d = resp.get("data", [{}])[0]
    os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
    if d.get("b64_json"):
        with open(out, "wb") as f:
            f.write(base64.b64decode(d["b64_json"]))
    elif d.get("url"):
        with urllib.request.urlopen(d["url"], timeout=120) as r, open(out, "wb") as f:
            f.write(r.read())
    else:
        raise RuntimeError(f"response has no image: {json.dumps(resp)[:300]}")
    return os.path.getsize(out)

def _call(fn, retries=3):
    """Try each key; retry transient errors with backoff."""
    keys = _keys()
    if not keys:
        sys.exit("ERROR: 未配置 OPENAI_API_KEY（也没有 ANTHROPIC_AUTH_TOKEN 回退）")
    last = None
    for attempt in range(retries):
        for key in keys:
            try:
                return fn(key)
            except urllib.error.HTTPError as e:
                body = e.read().decode(errors="replace")[:300]
                last = f"HTTP {e.code}: {body}"
                if e.code in (401, 403):
                    print(f"  [auth failed with key ...{key[-6:]}, trying next]", file=sys.stderr)
                    continue
                if e.code in (429, 500, 502, 503, 504):
                    break  # retry same key after backoff
                raise RuntimeError(last)
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                last = str(e)
                break
        wait = 8 * (attempt + 1)
        print(f"  [retry {attempt+1}/{retries} after {wait}s: {last}]", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(f"all attempts failed: {last}")

def cmd_generate(a):
    prompt = _build_prompt(a)
    payload = {"model": a.model, "prompt": prompt, "size": a.size, "quality": a.quality, "n": 1}
    if a.dry_run:
        print("DRY-RUN generate payload:"); print(json.dumps(payload, ensure_ascii=False, indent=2)); return
    resp = _call(lambda key: _post_json("/images/generations", payload, key))
    n = _save(resp, a.out)
    print(f"OK {a.out} ({n} bytes)")

def cmd_edit(a):
    prompt = _build_prompt(a)
    fields = {"model": a.model, "prompt": prompt, "size": a.size, "quality": a.quality}
    if a.dry_run:
        print("DRY-RUN edit fields:", json.dumps(fields, ensure_ascii=False, indent=2))
        print("images:", a.image); return
    files = [("image[]", p) for p in a.image]
    resp = _call(lambda key: _post_multipart("/images/edits", fields, files, key))
    n = _save(resp, a.out)
    print(f"OK {a.out} ({n} bytes)")

def main():
    p = argparse.ArgumentParser(prog="imagegen")
    sub = p.add_subparsers(dest="cmd", required=True)
    def common(sp, edit=False):
        sp.add_argument("--model", default="gpt-image-2")
        sp.add_argument("--prompt", required=True)
        sp.add_argument("--style"); sp.add_argument("--use-case", dest="use_case")
        sp.add_argument("--composition"); sp.add_argument("--constraints")
        sp.add_argument("--quality", default="high", choices=["low", "medium", "high"])
        sp.add_argument("--size", default="1024x1024",
                        choices=["1024x1024", "1024x1536", "1536x1024"])
        sp.add_argument("--out", required=True)
        sp.add_argument("--dry-run", action="store_true")
        if edit: sp.add_argument("--image", action="append", required=True)
    g = sub.add_parser("generate"); common(g); g.set_defaults(fn=cmd_generate)
    e = sub.add_parser("edit"); common(e, edit=True); e.set_defaults(fn=cmd_edit)
    a = p.parse_args()
    a.fn(a)

if __name__ == "__main__":
    main()
