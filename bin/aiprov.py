"""aiprov: which AI the theme creator talks to, and exactly how each one is called.

  providers()            the table below with "installed" filled in (the dropdown lists only installed ones + Custom)
  choice()/save_choice() the remembered choice: <state>/ai.json {provider, model, custom, mode}
  command(...)           -> Call(argv, stdin, cwd, files): the tested invocation of one provider
  call(...)              run it, return (text, usage)
  test(...)              a tiny round trip for the "Test connection" button

Every provider is run WITHOUT a shell and gets the whole prompt on stdin (or, for the two tools that need it, as an attached
file). Nothing the AI answers is executed. What is sent where is listed in the README (Privacy).
Environment: OMASHADERS_AI_PROVIDER / OMASHADERS_AI_MODEL (the plugin setting, used until a choice is remembered),
OMASHADERS_AI_CMD (the old free-text "aiCommand" setting; it becomes the Custom command), OMASHADERS_AI_TIMEOUT.
"""
import base64
import json
import os
import re
import shlex
import shutil
import subprocess
import tempfile
import time

import omslib as L

TIMEOUT = int(os.environ.get("OMASHADERS_AI_TIMEOUT") or 240)
CHOICE_FILE = os.path.join(L.STATE, "ai.json")
CHEAP_CLAUDE = ["--tools", "", "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence"]
EXTRA_DIRS = [os.path.expanduser(p) for p in ("~/.local/bin", "~/.local/share/mise/shims", "~/.npm-global/bin", "/usr/local/bin", "/usr/bin")]

# id, label, executable, strong enough for "Invent new", can look at the picture, may run several calls at once (Rich Builders), models (id, label)
PROVIDERS = [
    {"id": "claude", "label": "Claude Code (claude)", "exe": "claude", "strong": True, "image": True, "parallel": True,
     "models": [("sonnet", "Sonnet (good and cheap)"), ("opus", "Opus (strongest, dearer)")], "default_model": "sonnet"},
    {"id": "codex", "label": "Codex (codex)", "exe": "codex", "strong": True, "image": True, "parallel": True,
     "models": [("", "Codex default model")], "default_model": ""},
    {"id": "gemini", "label": "Gemini CLI (gemini)", "exe": "gemini", "strong": True, "image": False, "parallel": True,
     "models": [("", "Gemini default model")], "default_model": ""},
    {"id": "opencode", "label": "OpenCode (opencode)", "exe": "opencode", "strong": True, "image": True, "parallel": False,
     "models": [("", "OpenCode default model")], "default_model": ""},
    {"id": "ollama", "label": "Ollama, local (ollama)", "exe": "ollama", "strong": False, "image": False, "parallel": False,
     "models": [], "default_model": ""},
]
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


def choice():
    """{provider, model, custom, mode, remembered}: the remembered pick, else the plugin setting, else the old free-text command, else Claude"""
    saved = load_choice()
    env_p = (os.environ.get("OMASHADERS_AI_PROVIDER") or "").strip().lower()
    env_cmd = (os.environ.get("OMASHADERS_AI_CMD") or "").strip()
    known = {p["id"] for p in PROVIDERS} | {"custom"}
    prov = saved.get("provider") if saved.get("provider") in known else ""
    remembered = bool(prov)
    if not prov:
        prov = env_p if env_p in known else ("custom" if env_cmd else "claude")
    custom = str(saved.get("custom") or env_cmd or "")
    model = clean_model(saved.get("model") if remembered else os.environ.get("OMASHADERS_AI_MODEL"))
    info = next((p for p in PROVIDERS if p["id"] == prov), None)
    if info and not model:
        model = info["default_model"]
    mode = saved.get("mode") if saved.get("mode") in ("pick", "invent", "rich") else ""
    return {"provider": prov, "model": model, "custom": custom, "mode": mode, "remembered": remembered}


def info_of(prov):
    return next((p for p in PROVIDERS if p["id"] == prov), CUSTOM)


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
        argv = [find_exe("claude") or "claude", "-p", "--model", model or "sonnet"] + CHEAP_CLAUDE + ["--system-prompt", system]
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
