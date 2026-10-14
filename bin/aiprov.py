"""aiprov: which AI the theme creator talks to, and exactly how each one is called.

  providers()            the table below with "installed" filled in (the dropdown lists only installed ones + Custom)
  choice()/save_choice() the remembered choice: <state>/ai.json {provider, model, custom, mode}
  command(...)           -> Call(argv, stdin, cwd, files): the tested invocation of one provider
  call(...)              run it, return (text, usage); the OpenAI-compatible endpoint is an HTTP request, not a command
  can_see/is_strong/runs_parallel(ch)  what the chosen AI can do (tick-boxes for Custom command and endpoint)
  test(...)              a tiny round trip for the "Test connection" button

Every provider is run WITHOUT a shell and gets the whole prompt on stdin (or, for the two tools that need it, as an attached
file). Nothing the AI answers is executed. What is sent where is listed in the README (Privacy).
Which AI is preselected: the remembered pick, else the plugin setting, else Omarchy's default agent (`omarchy default agent`), else the first
installed tool. No model is ever named unless the user types one: an empty model means "that tool's own default".
Environment: OMASHADERS_AI_PROVIDER / OMASHADERS_AI_MODEL (the plugin setting, used until a choice is remembered),
OMASHADERS_AI_CMD (the old free-text "aiCommand" setting; it becomes the Custom command), OMASHADERS_AI_TIMEOUT.
"""
import base64
import ipaddress
import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

import omslib as L

TIMEOUT = int(os.environ.get("OMASHADERS_AI_TIMEOUT") or 240)
CHOICE_FILE = os.path.join(L.STATE, "ai.json")
AGENT_FILE = os.path.expanduser("~/.config/omarchy/defaults/agent")
CHEAP_CLAUDE = ["--tools", "", "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence"]
EXTRA_DIRS = [os.path.expanduser(p) for p in ("~/.local/bin", "~/.local/share/mise/shims", "~/.npm-global/bin", "/usr/local/bin", "/usr/bin")]

# id, label, executable, strong enough for "Invent new", can look at the picture, may run several calls at once (Rich Builders), models (id, label)
PROVIDERS = [
    {"id": "claude", "label": "Claude Code (claude)", "exe": "claude", "strong": True, "image": True, "parallel": True,
     "models": [("", "Claude Code default model"), ("sonnet", "Sonnet (good and cheap)"), ("opus", "Opus (strongest, dearer)")], "default_model": ""},
    {"id": "codex", "label": "Codex (codex)", "exe": "codex", "strong": True, "image": True, "parallel": True,
     "models": [("", "Codex default model")], "default_model": ""},
    {"id": "gemini", "label": "Gemini CLI (gemini)", "exe": "gemini", "strong": True, "image": False, "parallel": True,
     "models": [("", "Gemini default model")], "default_model": ""},
    {"id": "opencode", "label": "OpenCode (opencode)", "exe": "opencode", "strong": True, "image": True, "parallel": False,
     "models": [("", "OpenCode default model")], "default_model": ""},
    {"id": "ollama", "label": "Ollama, local (ollama)", "exe": "ollama", "strong": False, "image": False, "parallel": False,
     "models": [], "default_model": ""},
]
ENDPOINT = {"id": "endpoint", "label": "OpenAI-compatible endpoint…", "exe": "", "strong": None, "image": None, "parallel": None, "models": [], "default_model": ""}
CUSTOM = {"id": "custom", "label": "Custom command…", "exe": "", "strong": None, "image": None, "parallel": False, "models": [], "default_model": ""}


class Call:
    def __init__(self, argv, stdin, cwd=None, files=(), parse="text"):
        self.argv, self.stdin, self.cwd, self.files, self.parse = argv, stdin, cwd, list(files), parse


def find_exe(name):
    p = shutil.which(name)
    if p:
        return p
    home = os.path.expanduser("~/.local/share/mise/installs/%s/latest" % name)
    for d in EXTRA_DIRS + [home, os.path.join(home, "bin"), os.path.join(home, "node_modules", ".bin")]:
        c = os.path.join(d, name)
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return ""


def ollama_models(exe):
    try:
        r = subprocess.run([exe, "list"], capture_output=True, text=True, timeout=8, stdin=subprocess.DEVNULL)
    except Exception:
        return []
    rows = [l.split()[0] for l in r.stdout.splitlines()[1:] if l.split()]
    return [(m, m) for m in rows if re.fullmatch(r"[\w.:/@-]{1,80}", m)]


def providers(with_models=True):
    """installed providers first in the table order; Custom is always last"""
    out = []
    for p in PROVIDERS:
        exe = find_exe(p["exe"])
        if not exe:
            continue
        q = dict(p, exe_path=exe, installed=True)
        if p["id"] == "ollama" and with_models:
            q["models"] = ollama_models(exe)
            q["default_model"] = q["models"][0][0] if q["models"] else ""
        out.append(q)
    out.append(dict(ENDPOINT, installed=True, exe_path=""))
    out.append(dict(CUSTOM, installed=True, exe_path=""))
    return out


def load_choice():
    try:
        d = json.load(open(CHOICE_FILE))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def save_choice(**kw):
    d = load_choice()
    d.update({k: v for k, v in kw.items() if v is not None})
    os.makedirs(L.STATE, exist_ok=True)
    tmp = CHOICE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(d, f)
    os.replace(tmp, CHOICE_FILE)
    return d


def clean_model(m):
    m = str(m or "").strip()
    return m if re.fullmatch(r"[\w.:/@-]{0,80}", m) else ""


def omarchy_default():
    """the id of the agent set with `omarchy default agent` when we support it, else ''"""
    try:
        a = open(AGENT_FILE).readline().strip().lower()
    except OSError:
        return ""
    return a if any(p["id"] == a for p in PROVIDERS) else ""


def choice():
    """{provider, model, custom, caps, endpoint, mode, remembered}: the remembered pick, else the plugin setting, else the old free-text command,
    else Omarchy's default agent, else the first installed tool, else Claude"""
    saved = load_choice()
    env_p = (os.environ.get("OMASHADERS_AI_PROVIDER") or "").strip().lower()
    env_cmd = (os.environ.get("OMASHADERS_AI_CMD") or "").strip()
    known = {p["id"] for p in PROVIDERS} | {"custom", "endpoint"}
    prov = saved.get("provider") if saved.get("provider") in known else ""
    remembered = bool(prov)
    if not prov:
        if env_p in known:
            prov = env_p
        elif env_cmd:
            prov = "custom"
        else:
            od = omarchy_default()
            first = next((p["id"] for p in PROVIDERS if find_exe(p["exe"])), "")
            prov = od if od and find_exe(info_of(od)["exe"]) else (first or "claude")
    custom = str(saved.get("custom") or env_cmd or "")
    model = clean_model(saved.get("model") if remembered else os.environ.get("OMASHADERS_AI_MODEL"))
    info = next((p for p in PROVIDERS if p["id"] == prov), None)
    if info and not model:
        model = info["default_model"]
    mode = saved.get("mode") if saved.get("mode") in ("pick", "invent", "rich") else ""
    caps = {k: bool(v) for k, v in (saved.get("caps") or {}).items() if k in ("strong", "image") and isinstance(v, bool)}
    ep = saved.get("endpoint") if isinstance(saved.get("endpoint"), dict) else {}
    endpoint = {k: str(ep.get(k) or "").strip() for k in ("url", "key_env", "key_file")}
    return {"provider": prov, "model": model, "custom": custom, "caps": caps, "endpoint": endpoint, "mode": mode, "remembered": remembered}


def info_of(prov):
    if prov == "endpoint":
        return ENDPOINT
    return next((p for p in PROVIDERS if p["id"] == prov), CUSTOM)


def can_see(ch):
    """can the chosen AI look at a picture? Custom command and endpoint: the user's tick-box, else a guess from the command"""
    caps = ch.get("caps") or {}
    if isinstance(caps.get("image"), bool):
        return caps["image"]
    if ch["provider"] == "custom":
        return "{image}" in (ch.get("custom") or "")
    if ch["provider"] == "endpoint":
        return False
    return bool(info_of(ch["provider"]).get("image"))


def is_strong(ch):
    """strong enough to invent shaders? Small local models are not; Custom command and endpoint: the user's tick-box, default yes"""
    caps = ch.get("caps") or {}
    if isinstance(caps.get("strong"), bool):
        return caps["strong"]
    s = info_of(ch["provider"]).get("strong")
    return True if s is None else bool(s)


def runs_parallel(ch):
    if ch["provider"] == "endpoint":
        return (ch.get("endpoint") or {}).get("url", "").lower().startswith("https://")
    return bool(info_of(ch["provider"]).get("parallel"))


# ------------------------------------------------------------------ the OpenAI-compatible endpoint
def _private_host(host):
    h = host.lower().strip("[]")
    if h == "localhost" or h.endswith((".local", ".lan", ".home.arpa", ".internal")) or ("." not in h and ":" not in h):
        return True
    try:
        ip = ipaddress.ip_address(h)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private or ip.is_link_local


def _endpoint_url(ch):
    """-> (chat completions URL, '') or ('', plain reason)"""
    ep = ch.get("endpoint") or {}
    raw = (ep.get("url") or "").strip()
    if not raw:
        return "", "Type the endpoint URL, e.g. http://localhost:11434/v1 (Ollama), http://localhost:1234/v1 (LM Studio) or https://openrouter.ai/api/v1."
    u = urllib.parse.urlparse(raw)
    if u.scheme not in ("http", "https") or not u.hostname:
        return "", "The endpoint URL must start with https:// (or http:// for a server on this computer or your home network)."
    if u.scheme == "http" and not _private_host(u.hostname):
        return "", "A server on the internet must use https:// so the key and your prompts are not sent in the clear."
    path = u.path.rstrip("/")
    if not path.endswith("/chat/completions"):
        path += "/chat/completions"
    return urllib.parse.urlunparse((u.scheme, u.netloc, path, "", "", "")), ""


def _endpoint_key(ch):
    """-> the key or '' (no key is fine for local servers). Raises L.Bad when a named source is wrong."""
    ep = ch.get("endpoint") or {}
    env, path = (ep.get("key_env") or "").strip(), (ep.get("key_file") or "").strip()
    if env:
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", env):
            raise L.Bad("“%s” is not a valid environment variable name." % env)
        v = (os.environ.get(env) or "").strip()
        if not v:
            raise L.Bad("The key variable %s is not set where the shell runs. Put the key in a private file instead and type its path, or export %s in your session." % (env, env))
        return v
    if path:
        path = os.path.expanduser(path)
        try:
            st = os.stat(path)
        except OSError:
            raise L.Bad("The key file %s was not found." % path)
        if not stat.S_ISREG(st.st_mode):
            raise L.Bad("The key file %s is not a file." % path)
        if st.st_mode & 0o077:
            raise L.Bad("The key file must be private: run  chmod 600 %s" % path)
        try:
            return (open(path).readline() or "").strip()
        except OSError:
            raise L.Bad("The key file %s could not be read." % path)
    return ""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def _post_endpoint(ch, system, prompt, jpgs, timeout):
    url, why = _endpoint_url(ch)
    if why:
        raise L.Bad(why)
    model = clean_model(ch.get("model"))
    if not model:
        raise L.Bad("Type the model name the endpoint expects (for example the one listed in its model list).")
    key = _endpoint_key(ch)
    user = prompt
    if jpgs and can_see(ch):
        user = [{"type": "text", "text": prompt}] + [{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(j).decode("ascii")}} for j in jpgs]
    body = json.dumps({"model": model, "stream": False, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}).encode()
    hdr = {"Content-Type": "application/json", "User-Agent": "omashaders"}
    if key:
        hdr["Authorization"] = "Bearer " + key
    scrub = lambda t: str(t).replace(key, "***") if key else str(t)  # noqa: E731
    try:
        with urllib.request.build_opener(_NoRedirect).open(urllib.request.Request(url, data=body, headers=hdr, method="POST"), timeout=timeout) as r:
            raw = r.read(8_000_000)
    except urllib.error.HTTPError as e:
        try:
            detail = e.read(600).decode("utf-8", "replace")
            m = (json.loads(detail).get("error") or {}).get("message")
            detail = m if isinstance(m, str) else detail
        except Exception:
            detail = ""
        raise L.Bad("The endpoint answered %d%s" % (e.code, (": " + re.sub(r"\s+", " ", scrub(detail))[:200]) if detail else "."))
    except urllib.error.URLError as e:
        if isinstance(getattr(e, "reason", None), TimeoutError):
            raise L.Bad("The endpoint took longer than %d seconds. Try again." % timeout)
        raise L.Bad("Could not reach the endpoint: %s" % scrub(getattr(e, "reason", e))[:160])
    except (TimeoutError, OSError) as e:
        raise L.Bad("The endpoint took longer than %d seconds. Try again." % timeout if isinstance(e, TimeoutError) else "Could not reach the endpoint: %s" % scrub(e)[:160])
    try:
        d = json.loads(raw)
        msg = d["choices"][0]["message"]["content"]
        if isinstance(msg, list):
            msg = "".join(p.get("text", "") for p in msg if isinstance(p, dict))
        text = str(msg or "")
    except (ValueError, KeyError, IndexError, TypeError, AttributeError):
        raise L.Bad("The endpoint sent an answer in a format I could not read (it must be OpenAI-compatible /chat/completions).")
    if not text.strip():
        raise L.Bad("The endpoint answered with no text.")
    u = d.get("usage") or {}
    if u.get("prompt_tokens") is not None or u.get("completion_tokens") is not None:
        return text, {"tokens_in": u.get("prompt_tokens") or 0, "tokens_out": u.get("completion_tokens") or 0, "cost_usd": None, "estimated": False}
    return text, {"tokens_in": (len(system) + len(prompt)) // 4, "tokens_out": len(text) // 4, "cost_usd": None, "estimated": True}


def availability(ch=None):
    ch = ch or choice()
    if ch["provider"] == "custom":
        try:
            argv = shlex.split(ch["custom"])
        except ValueError as e:
            return {"available": False, "backend": "", "hint": "The custom command cannot be read (%s)." % e}
        if not argv:
            return {"available": False, "backend": "", "hint": "Type the custom command in the theme dialog or in the plugin settings (it gets the prompt on stdin and prints text containing one JSON object)."}
        exe = argv[0] if os.sep in argv[0] else find_exe(argv[0])
        if not exe or not os.access(exe, os.X_OK):
            return {"available": False, "backend": argv[0], "hint": "The custom command “%s” was not found." % argv[0]}
        return {"available": True, "backend": argv[0], "hint": ""}
    if ch["provider"] == "endpoint":
        _, why = _endpoint_url(ch)
        if not why and not clean_model(ch.get("model")):
            why = "Type the model name the endpoint expects."
        if not why:
            try:
                _endpoint_key(ch)
            except L.Bad as e:
                why = str(e)
        return {"available": not why, "backend": "OpenAI-compatible endpoint", "hint": why}
    p = info_of(ch["provider"])
    if not find_exe(p["exe"]):
        return {"available": False, "backend": p["exe"], "hint": "%s is not installed. Pick another AI in the dropdown, or install it." % p["label"]}
    return {"available": True, "backend": p["label"], "hint": ""}


# ------------------------------------------------------------------ the tested invocations
def command(ch, system, prompt, jpg=None):
    """-> Call. jpg = bytes of a small JPEG of the base picture, a list of such (the Reviewer gets two sheets) or None. Nothing is started here."""
    prov, model = ch["provider"], clean_model(ch.get("model"))
    files = []
    jpgs = [jpg] if isinstance(jpg, (bytes, bytearray)) else list(jpg or [])
    jpg = jpgs[0] if jpgs else None

    def tmpfile(suffix, data, mode="wb"):
        f = tempfile.NamedTemporaryFile(prefix="omashaders-ai-", suffix=suffix, delete=False, mode=mode)
        f.write(data)
        f.close()
        files.append(f.name)
        return f.name

    if prov == "claude":
        argv = [find_exe("claude") or "claude", "-p"] + (["--model", model] if model else []) + CHEAP_CLAUDE + ["--system-prompt", system]
        if jpg:
            msg = {"type": "user", "message": {"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(j).decode("ascii")}} for j in jpgs
            ] + [{"type": "text", "text": prompt}]}}
            return Call(argv + ["--input-format", "stream-json", "--output-format", "stream-json", "--verbose"], json.dumps(msg) + "\n", parse="claude")
        return Call(argv + ["--output-format", "json"], prompt, parse="claude")
    cwd = tempfile.mkdtemp(prefix="omashaders-ai-cwd-")
    files.append(cwd)
    both = system + "\n\n---\n\n" + prompt
    if prov == "codex":
        argv = [find_exe("codex") or "codex", "exec", "--skip-git-repo-check", "--ephemeral", "-s", "read-only", "--color", "never", "-C", cwd]
        if model:
            argv += ["-m", model]
        for j in jpgs:
            argv += ["-i", tmpfile(".jpg", j)]
        return Call(argv + ["-"], both, cwd, files)
    if prov == "gemini":
        argv = [find_exe("gemini") or "gemini", "-p", "Follow the instructions on stdin. Answer with the requested JSON object only.", "-o", "text", "--skip-trust", "--approval-mode", "plan"]
        if model:
            argv += ["-m", model]
        return Call(argv, both, cwd, files)
    if prov == "opencode":
        argv = [find_exe("opencode") or "opencode", "run"]
        if model:
            argv += ["-m", model]
        argv += ["-f", tmpfile(".txt", both, "w")]
        for j in jpgs:
            argv += ["-f", tmpfile(".jpg", j)]
        return Call(argv + ["--", "Follow the instructions in the attached prompt file. Answer with the requested JSON object only."], "", cwd, files)
    if prov == "ollama":
        return Call([find_exe("ollama") or "ollama", "run", model or "llama3"], both, cwd, files)
    if prov == "endpoint":
        raise L.Bad("The endpoint is an HTTP request, not a command.")
    # custom command: no shell, prompt on stdin, {image} = a JPEG file
    try:
        argv = shlex.split(ch.get("custom") or "")
    except ValueError as e:
        raise L.Bad("The custom command cannot be read (%s)." % e)
    if not argv:
        raise L.Bad("The custom command is empty.")
    if any("{image}" in a for a in argv):
        path = tmpfile(".jpg", jpg) if jpg else ""
        argv = [a.replace("{image}", path) for a in argv]
    if os.sep not in argv[0]:
        argv[0] = find_exe(argv[0]) or argv[0]
    return Call(argv, both, cwd, files)


def cleanup(c):
    for f in c.files:
        try:
            shutil.rmtree(f) if os.path.isdir(f) else os.remove(f)
        except OSError:
            pass


def parse_claude(out):
    res = None
    for line in out.splitlines():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if isinstance(d, dict) and d.get("type") == "result":
            res = d
    if res is None:
        try:
            res = json.loads(out)
        except ValueError:
            raise L.Bad("The AI sent an answer in a format I could not read")
    if res.get("is_error"):
        raise L.Bad("The AI reported an error: %s" % str(res.get("result", ""))[:200])
    u = res.get("usage") or {}
    usage = {"tokens_in": (u.get("input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0) + (u.get("cache_read_input_tokens") or 0),
             "tokens_out": u.get("output_tokens") or 0, "cost_usd": res.get("total_cost_usd"), "estimated": False}
    return str(res.get("result") or ""), usage


def call(ch, system, prompt, jpg=None, timeout=None):
    """-> (text, usage). Raises L.Bad with a plain message."""
    if ch["provider"] == "endpoint":
        return _post_endpoint(ch, system, prompt, [jpg] if isinstance(jpg, (bytes, bytearray)) else list(jpg or []), timeout or TIMEOUT)
    c = command(ch, system, prompt, jpg)
    try:
        r = subprocess.run(c.argv, input=c.stdin, capture_output=True, text=True, timeout=timeout or TIMEOUT, cwd=c.cwd, env=dict(os.environ))
    except subprocess.TimeoutExpired:
        raise L.Bad("The AI took longer than %d seconds. Try again." % (timeout or TIMEOUT))
    except (FileNotFoundError, PermissionError):
        raise L.Bad("The AI command was not found. Pick another AI in the dropdown.")
    finally:
        cleanup(c)
    if r.returncode != 0:
        err = (r.stderr or r.stdout).strip().splitlines()
        raise L.Bad("The AI command failed: %s" % (err[-1][:200] if err else "exit %d" % r.returncode))
    if c.parse == "claude":
        return parse_claude(r.stdout)
    text = r.stdout
    return text, {"tokens_in": (len(system) + len(prompt)) // 4, "tokens_out": len(text) // 4, "cost_usd": None, "estimated": True}


def test(ch=None):
    """a tiny round trip; never raises"""
    ch = ch or choice()
    av = availability(ch)
    if not av["available"]:
        return {"ok": False, "error": av["hint"], "provider": ch["provider"]}
    t0 = time.time()
    try:
        text, usage = call(ch, "This is a connection test for a desktop theme tool.", 'Answer with exactly this JSON and nothing else: {"ok": true}', None, timeout=min(TIMEOUT, 90))
    except L.Bad as e:
        return {"ok": False, "error": str(e), "provider": ch["provider"], "seconds": round(time.time() - t0, 1)}
    good = re.search(r'"ok"\s*:\s*true', text) is not None
    return {"ok": good, "provider": ch["provider"], "model": ch.get("model", ""), "seconds": round(time.time() - t0, 1), "usage": usage,
            "error": "" if good else "The AI answered, but not in the expected form: %s" % re.sub(r"\s+", " ", text)[:120]}
