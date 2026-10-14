"""imgprov: which image model OmaShaders uses to paint sprites, and exactly how each one is called (used by bin/aisprites.py).

  providers()             comfyui, endpoint, custom (the dropdown); choice()/save_choice() = the remembered pick in <state>/img.json
  generate(ch, prompt, ...) -> (png bytes, mime)   one picture; raises Bad with a plain message
  checkpoints(ch)         the checkpoint names the user's ComfyUI has (for the dropdown)
  test(ch)                a free check for the "Test connection" button (no picture is made, nothing is billed)

ComfyUI: URL (default http://127.0.0.1:8188) + a workflow in API format with {prompt} {negative} {width} {height} {seed} {checkpoint}
placeholders (txt2img-api.json is the plain SDXL/SD1.5 one; the user may point at their own, e.g. a Flux export).
OpenAI-compatible: base URL + model (+ size), POST <base>/images/generations; the key comes from an environment variable or a chmod 600 file.
Custom command: argv with {prompt} {out} {width} {height} {seed}; run WITHOUT a shell, the prompt also on stdin, must write an image to {out}.
Nothing is sent until the user presses a button. The model's output is only ever treated as image bytes (checked by magic number), never run.
No other module is needed.
"""
import base64
import ipaddress
import json
import os
import random
import re
import shlex
import stat
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

import sys  # noqa: E402
sys.dont_write_bytecode = True  # a __pycache__ in the plugin folder would make the shell reload the plugin
APP = "omashaders"  # used for the env names below (OMASHADERS_STATE_DIR, OMASHADERS_COMFY_URL, OMASHADERS_IMG_TIMEOUT)
# the same state folder bin/omslib.py and bin/aiprov.py use
STATE = os.environ.get(APP.upper() + "_STATE_DIR") or os.path.join(
    os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state"), "omarchy", "io.github.akton1.omashaders")
CHOICE_FILE = os.path.join(STATE, "img.json")
HERE = os.path.dirname(os.path.realpath(__file__))
DEFAULT_WORKFLOW = os.path.join(HERE, "txt2img-api.json")
TIMEOUT = int(os.environ.get(APP.upper() + "_IMG_TIMEOUT") or 300)
MAX_BYTES = 25_000_000
COMFY_URL = "http://127.0.0.1:8188"

PROVIDERS = [
    {"id": "comfyui", "label": "ComfyUI (your own server)"},
    {"id": "endpoint", "label": "OpenAI-compatible images endpoint…"},
    {"id": "custom", "label": "Custom command…"},
]
MAGIC = ((b"\x89PNG\r\n\x1a\n", "image/png"), (b"\xff\xd8\xff", "image/jpeg"))


class Bad(Exception):
    """a problem the user can read and act on"""


def providers():
    return [dict(p) for p in PROVIDERS]


def load_choice():
    try:
        d = json.load(open(CHOICE_FILE))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def save_choice(**kw):
    d = load_choice()
    d.update({k: v for k, v in kw.items() if v is not None})
    os.makedirs(STATE, exist_ok=True)
    tmp = CHOICE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(d, f)
    os.replace(tmp, CHOICE_FILE)
    return d


def choice():
    """{provider, comfy:{url,workflow,checkpoint}, endpoint:{url,model,key_env,key_file,size}, custom}; remembered pick, else ComfyUI"""
    s = load_choice()
    prov = s.get("provider") if s.get("provider") in {p["id"] for p in PROVIDERS} else "comfyui"
    sub = lambda k, keys: {x: str((s.get(k) or {}).get(x) or "").strip() for x in keys}  # noqa: E731
    comfy = sub("comfy", ("url", "workflow", "checkpoint"))
    comfy["url"] = comfy["url"] or os.environ.get(APP.upper() + "_COMFY_URL") or COMFY_URL
    return {"provider": prov, "comfy": comfy, "endpoint": sub("endpoint", ("url", "model", "key_env", "key_file", "size")),
            "custom": str(s.get("custom") or "").strip()}


# ------------------------------------------------------------------ shared safety helpers
def _private_host(host):
    h = host.lower().strip("[]")
    if h == "localhost" or h.endswith((".local", ".lan", ".home.arpa", ".internal")) or ("." not in h and ":" not in h):
        return True
    try:
        ip = ipaddress.ip_address(h)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private or ip.is_link_local


def _base_url(raw, what):
    raw = (raw or "").strip().rstrip("/")
    if not raw:
        raise Bad("Type the %s URL." % what)
    u = urllib.parse.urlparse(raw)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise Bad("The %s URL must start with https:// (or http:// for a server on this computer or your home network)." % what)
    if u.scheme == "http" and not _private_host(u.hostname):
        raise Bad("A server on the internet must use https:// so keys and prompts are not sent in the clear.")
    return urllib.parse.urlunparse((u.scheme, u.netloc, u.path.rstrip("/"), "", "", ""))


def _key(ep):
    env, path = (ep.get("key_env") or "").strip(), (ep.get("key_file") or "").strip()
    if env:
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", env):
            raise Bad("“%s” is not a valid environment variable name." % env)
        v = (os.environ.get(env) or "").strip()
        if not v:
            raise Bad("The key variable %s is not set where the shell runs. Put the key in a private file instead and type its path, or export %s in your session." % (env, env))
        return v
    if path:
        path = os.path.expanduser(path)
        try:
            st = os.stat(path)
        except OSError:
            raise Bad("The key file %s was not found." % path)
        if not stat.S_ISREG(st.st_mode):
            raise Bad("The key file %s is not a file." % path)
        if st.st_mode & 0o077:
            raise Bad("The key file must be private: run  chmod 600 %s" % path)
        try:
            return (open(path).readline() or "").strip()
        except OSError:
            raise Bad("The key file %s could not be read." % path)
    return ""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def _http(method, url, body=None, headers=None, timeout=30, secret="", what="The server", limit=MAX_BYTES):
    scrub = lambda t: str(t).replace(secret, "***") if secret else str(t)  # noqa: E731
    data = json.dumps(body).encode() if body is not None else None
    hdr = {"User-Agent": APP}
    if data is not None:
        hdr["Content-Type"] = "application/json"
    hdr.update(headers or {})
    try:
        with urllib.request.build_opener(_NoRedirect).open(urllib.request.Request(url, data=data, headers=hdr, method=method), timeout=timeout) as r:
            data = r.read(limit + 1)
        if len(data) > limit:
            raise Bad("%s sent more data than I will read." % what)
        return data
    except urllib.error.HTTPError as e:
        try:
            detail = e.read(600).decode("utf-8", "replace")
            m = (json.loads(detail).get("error") or {}).get("message")
            detail = m if isinstance(m, str) else detail
        except Exception:
            detail = ""
        raise Bad("%s answered %d%s" % (what, e.code, (": " + re.sub(r"\s+", " ", scrub(detail))[:200]) if detail else "."))
    except urllib.error.URLError as e:
        r = getattr(e, "reason", e)
        raise Bad("%s took longer than %d seconds." % (what, timeout) if isinstance(r, TimeoutError) else "Could not reach %s: %s" % (what.lower(), scrub(r)[:160]))
    except (TimeoutError, OSError) as e:
        raise Bad("%s took longer than %d seconds." % (what, timeout) if isinstance(e, TimeoutError) else "Could not reach %s: %s" % (what.lower(), scrub(e)[:160]))


def _json(raw, what):
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        raise Bad("%s sent an answer in a format I could not read." % what)


def _checked(data):
    """-> (bytes, mime) when data really is a PNG or JPEG of a sane size, else raise"""
    if not data or len(data) > MAX_BYTES:
        raise Bad("The image model returned no picture, or one that is too large.")
    for magic, mime in MAGIC:
        if data.startswith(magic):
            return bytes(data), mime
    raise Bad("The image model answered with something that is not a PNG or JPEG picture.")


def _dims(w, h):
    return max(64, min(4096, int(w or 1024))), max(64, min(4096, int(h or 1024)))


# ------------------------------------------------------------------ ComfyUI
def fill(node, vals):
    """replace {placeholders} inside a parsed workflow; a value that is exactly one placeholder keeps its type (numbers stay numbers).
    Works on the parsed structure, so quotes in a prompt can never break the JSON."""
    if isinstance(node, str):
        m = re.fullmatch(r"\{(\w+)\}", node)
        if m and m.group(1) in vals:
            return vals[m.group(1)]
        return re.sub(r"\{(\w+)\}", lambda k: str(vals[k.group(1)]) if k.group(1) in vals else k.group(0), node)
    if isinstance(node, list):
        return [fill(x, vals) for x in node]
    if isinstance(node, dict):
        return {k: fill(v, vals) for k, v in node.items()}
    return node


def _comfy_base(ch):
    return _base_url(ch["comfy"]["url"] or COMFY_URL, "ComfyUI")


def checkpoints(ch):
    raw = _http("GET", _comfy_base(ch) + "/object_info/CheckpointLoaderSimple", timeout=15, what="ComfyUI", limit=2_000_000)
    try:
        names = _json(raw, "ComfyUI")["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
        return [n for n in names if isinstance(n, str)]
    except (KeyError, IndexError, TypeError):
        raise Bad("ComfyUI did not list its checkpoints.")


def _comfy(ch, prompt, negative, width, height, seed, timeout):
    base = _comfy_base(ch)
    cfg = ch["comfy"]
    path = os.path.expanduser(cfg["workflow"]) if cfg["workflow"] else DEFAULT_WORKFLOW
    try:
        flow = json.load(open(path))
    except OSError:
        raise Bad("The workflow file %s could not be read." % path)
    except ValueError:
        raise Bad("The workflow file %s is not JSON. Export it from ComfyUI with “Save (API Format)”." % path)
    if not isinstance(flow, dict) or not all(isinstance(v, dict) and "class_type" in v for v in flow.values()):
        raise Bad("That workflow is not in API format. In ComfyUI use “Save (API Format)”.")
    if "{checkpoint}" in json.dumps(flow) and not cfg["checkpoint"]:
        raise Bad("Pick a checkpoint (the list comes from your ComfyUI).")
    vals = {"prompt": prompt, "negative": negative, "width": width, "height": height, "seed": seed, "checkpoint": cfg["checkpoint"]}
    pid = _json(_http("POST", base + "/prompt", {"prompt": fill(flow, vals), "client_id": APP}, timeout=30, what="ComfyUI"), "ComfyUI").get("prompt_id")
    if not isinstance(pid, str) or not re.fullmatch(r"[\w-]{1,80}", pid):
        raise Bad("ComfyUI did not accept the workflow.")
    end = time.time() + timeout
    while time.time() < end:
        hist = _json(_http("GET", base + "/history/" + pid, timeout=30, what="ComfyUI", limit=2_000_000), "ComfyUI").get(pid)
        if hist:
            st = hist.get("status") or {}
            if st.get("status_str") == "error":
                raise Bad("ComfyUI reported an error while drawing. Check the workflow and checkpoint in ComfyUI.")
            for out in (hist.get("outputs") or {}).values():
                for im in (out.get("images") or []):
                    if im.get("type", "output") != "output":
                        continue
                    q = urllib.parse.urlencode({"filename": im.get("filename", ""), "subfolder": im.get("subfolder", ""), "type": "output"})
                    return _checked(_http("GET", base + "/view?" + q, timeout=60, what="ComfyUI"))
            if st.get("completed"):
                raise Bad("ComfyUI finished but the workflow saved no picture (it needs a SaveImage node).")
        time.sleep(1.0)
    raise Bad("ComfyUI took longer than %d seconds." % timeout)


# ------------------------------------------------------------------ OpenAI-compatible images endpoint
def _endpoint(ch, prompt, width, height, timeout):
    ep = ch["endpoint"]
    base = _base_url(ep["url"], "endpoint")
    model = re.sub(r"[^\w.:/@-]", "", ep["model"])[:80]
    if not model:
        raise Bad("Type the model name the endpoint expects (for example gpt-image-1 or its model-list name).")
    key = _key(ep)
    body = {"model": model, "prompt": prompt, "n": 1, "size": ep["size"] if re.fullmatch(r"\d{2,4}x\d{2,4}|auto", ep["size"]) else "%dx%d" % (width, height)}
    hdr = {"Authorization": "Bearer " + key} if key else {}
    d = _json(_http("POST", base + "/images/generations", body, hdr, timeout, key, "The endpoint"), "The endpoint")
    try:
        item = d["data"][0]
    except (KeyError, IndexError, TypeError):
        raise Bad("The endpoint answered with no picture (it must be OpenAI-compatible /images/generations).")
    if isinstance(item.get("b64_json"), str):
        try:
            return _checked(base64.b64decode(item["b64_json"], validate=False))
        except ValueError:
            raise Bad("The endpoint sent a picture I could not decode.")
    if isinstance(item.get("url"), str):
        u = urllib.parse.urlparse(item["url"])
        if u.scheme != "https" and not (u.scheme == "http" and u.hostname and _private_host(u.hostname)):
            raise Bad("The endpoint pointed to a picture at an address I will not fetch (it must be https).")
        return _checked(_http("GET", item["url"], timeout=60, what="The picture server"))
    raise Bad("The endpoint answered with no picture.")


# ------------------------------------------------------------------ Custom command
def _custom(ch, prompt, width, height, seed, timeout):
    try:
        argv = shlex.split(ch["custom"])
    except ValueError:
        raise Bad("The custom command has an unbalanced quote.")
    if not argv:
        raise Bad("Type the custom command, e.g.  my-image-tool --prompt {prompt} --out {out}")
    if not any("{out}" in a for a in argv):
        raise Bad("The custom command must contain {out}: the file it writes the picture to.")
    with tempfile.TemporaryDirectory(prefix=APP + "-img-") as tmp:
        out = os.path.join(tmp, "out.png")
        vals = {"prompt": prompt, "out": out, "width": str(width), "height": str(height), "seed": str(seed)}
        args = [re.sub(r"\{(\w+)\}", lambda m: vals.get(m.group(1), m.group(0)), a) for a in argv]
        try:
            r = subprocess.run(args, input=prompt, capture_output=True, text=True, timeout=timeout, cwd=tmp)
        except FileNotFoundError:
            raise Bad("The command %s was not found." % argv[0])
        except subprocess.TimeoutExpired:
            raise Bad("The custom command took longer than %d seconds." % timeout)
        if r.returncode != 0:
            raise Bad("The custom command failed (%d): %s" % (r.returncode, re.sub(r"\s+", " ", r.stderr)[:200]))
        try:
            return _checked(open(out, "rb").read(MAX_BYTES + 1))
        except OSError:
            raise Bad("The custom command finished but wrote no file to {out}.")


# ------------------------------------------------------------------ public
def generate(ch, prompt, negative="", width=1024, height=1024, seed=None, timeout=None):
    """-> (image bytes, mime). One picture per call; nothing is cached or kept."""
    prompt = str(prompt or "").strip()
    if not prompt:
        raise Bad("Describe the picture first.")
    width, height = _dims(width, height)
    seed = int(seed) if seed is not None else random.randrange(2**32)
    timeout = timeout or TIMEOUT
    p = ch["provider"]
    if p == "comfyui":
        return _comfy(ch, prompt, negative or "", width, height, seed, timeout)
    if p == "endpoint":
        return _endpoint(ch, prompt, width, height, timeout)
    if p == "custom":
        return _custom(ch, prompt, width, height, seed, timeout)
    raise Bad("Unknown image provider.")


def test(ch):
    """free check, no picture made -> a one-line OK message"""
    p = ch["provider"]
    if p == "comfyui":
        n = len(checkpoints(ch))
        return "ComfyUI answers, %d checkpoint%s found." % (n, "" if n == 1 else "s")
    if p == "endpoint":
        base = _base_url(ch["endpoint"]["url"], "endpoint")
        key = _key(ch["endpoint"])
        _http("GET", base + "/models", headers={"Authorization": "Bearer " + key} if key else {}, timeout=20, secret=key, what="The endpoint", limit=2_000_000)
        return "The endpoint answers and accepts the key."
    try:
        argv = shlex.split(ch["custom"])
    except ValueError:
        raise Bad("The custom command has an unbalanced quote.")
    if not argv:
        raise Bad("Type the custom command first.")
    from shutil import which
    if not which(argv[0]):
        raise Bad("The command %s was not found." % argv[0])
    return "Command found. It runs when you press Make a picture."
