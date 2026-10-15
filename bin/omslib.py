"""Shared helpers for bin/ai-theme and bin/theme-code: the effect catalog, theme validation and theme lines.

Nothing here runs anything an outside source sent: ids are only ever compared against the catalog built from
the plugin's own folders, and numbers are clamped.
"""
import base64
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import zlib

HERE = os.path.dirname(os.path.realpath(__file__))
ROOT = os.path.dirname(HERE)
STATE = os.environ.get("OMASHADERS_STATE_DIR") or os.path.join(
    os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state"), "omarchy", "io.github.akton1.omashaders")
THEMES = os.path.join(STATE, "themes")
GENERATED = os.path.join(STATE, "generated")


def _migrate_combos():
    """1.31: saved looks were called "combos", now "themes": move the user's file once (a copy stays as combos.pre-themes)"""
    old, new = os.path.join(STATE, "combos"), THEMES
    try:
        if os.path.getsize(old) > 0 and not (os.path.exists(new) and os.path.getsize(new) > 0):
            tmp = os.path.join(STATE, ".themes.%d" % os.getpid())
            shutil.copy2(old, tmp)
            os.replace(tmp, new)
            os.replace(old, old + ".pre-themes")
    except OSError:
        pass


_migrate_combos()

CODE_PREFIX = "OMS1:"
MAX_CODE = 6000          # characters of a share code we accept
MAX_JSON = 8192          # bytes after decompression
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.+-]{0,63}$")
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import omspalette  # noqa: E402
CUSTOM_RE = re.compile(r"^custom-[0-9a-f]{6}$")
WH_RE = re.compile(r"^[a-z0-9]{6}$")
# optional per-theme numbers (the 9th field of a theme line): key -> (low, high)
OPT_RANGES = {"fx": (0, 100), "col": (0, 100), "wall": (0, 100), "cur": (0, 100), "wspeed": (0, 300), "wzoom": (25, 300)}
SLOTS = ("screen", "color", "wall", "mouse", "winfx", "frame")


def wh_cached(wid):
    """True when this Wallhaven picture is already in the cache (full/ or used/) of the state folder."""
    if not WH_RE.match(wid or ""):
        return False
    for d in ("full", "used"):
        for ext in (".jpg", ".png"):
            try:
                if os.path.getsize(os.path.join(STATE, "wallhaven", d, "wallhaven-%s%s" % (wid, ext))) > 0:
                    return True
            except OSError:
                pass
    return False


class Bad(Exception):
    pass


def version():
    try:
        return json.load(open(os.path.join(ROOT, "manifest.json")))["version"]
    except Exception:
        return "0"


def core_wall_info():
    """{id: (group label, label, hint)} for the wallpaper effects built into Core.qml's wallBase list (older ones have no // header in the .frag)"""
    try:
        text = open(os.path.join(ROOT, "Core.qml"), encoding="utf-8").read()
    except OSError:
        return {}
    text = text.split("readonly property var wallBase", 1)[-1].split("readonly property var wallAll", 1)[0]
    out, group = {}, ""
    for line in text.splitlines():
        g = re.match(r'\s*\{ id: "[\w-]+", label: "([^"]+)", items: \[', line)
        if g:
            group = g.group(1)
            continue
        m = re.match(r'\s*\{ id: "([\w-]+)",\s+label: "([^"]*)",\s+hint: "([^"]*)"', line)
        if m and not m.group(1).startswith("@"):
            out[m.group(1)] = (group, m.group(2), m.group(3))
    return out


def _catalog_signature():
    h = hashlib.sha1()
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d != ".git")
        for f in sorted(files):
            try:
                st = os.stat(os.path.join(base, f))
            except OSError:
                continue
            h.update(("%s/%s %d %d\n" % (base, f, st.st_mtime_ns, st.st_size)).encode())
    try:
        st = os.stat(os.path.join(STATE, "perf-summary.tsv"))
        h.update(("perf %d %d" % (st.st_mtime_ns, st.st_size)).encode())
    except OSError:
        pass
    for sub in ("screen", "color", "wall", "mouse", "frame"):  # effects an AI invented (bin/aigen)
        d = os.path.join(GENERATED, sub)
        try:
            for f in sorted(os.listdir(d)):
                st = os.stat(os.path.join(d, f))
                h.update(("gen %s/%s %d %d\n" % (sub, f, st.st_mtime_ns, st.st_size)).encode())
        except OSError:
            pass
    return h.hexdigest()


def catalog():
    """{section: {id: {id, kind, cat, hint, start}}} for screen, color, wall, mouse, winfx, frame, built from the plugin folders.
    `omashaders listall` takes seconds (one process per effect file), so the result is cached until a plugin file changes."""
    sig = _catalog_signature()
    cache = os.path.join(STATE, "catalog-cache.json")
    try:
        d = json.load(open(cache))
        if d.get("sig") == sig:
            return d["cat"]
    except (OSError, ValueError, KeyError):
        pass
    cat = _build_catalog()
    try:
        os.makedirs(STATE, exist_ok=True)
        tmp = "%s.%d.tmp" % (cache, os.getpid())
        with open(tmp, "w") as fh:
            json.dump({"sig": sig, "cat": cat}, fh)
        os.replace(tmp, cache)
    except OSError:
        pass
    return cat


def _build_catalog():
    try:
        out = subprocess.run([os.path.join(HERE, "omashaders"), "listall"], capture_output=True, text=True, timeout=60).stdout
    except Exception as e:
        raise Bad("cannot list the effects: %s" % e)
    cat = {s: {} for s in SLOTS}
    builtin = core_wall_info()
    for line in out.splitlines():
        f = line.split("\t")
        if len(f) < 5:
            continue
        name, kind, category, hint, sec = f[0], f[1], f[2], f[3], f[4]
        if sec == "wall":
            category = (f[6] if len(f) > 6 and f[6] else "") or "Wallpaper"
            title = f[2]
            if name in builtin and (not hint or hint == name or title == name):
                category, title, hint = builtin[name][0] or category, builtin[name][1] or title, builtin[name][2] or hint
            hint = (title + ": " + hint) if hint and title != name else (hint or title)
        if sec not in cat or not ID_RE.match(name):
            continue
        start = f[5] if len(f) > 5 and sec in ("screen", "color", "winfx") else ""
        cat[sec][name] = {"id": name, "kind": kind, "cat": category, "hint": hint.strip(), "start": start}
    return cat


def slot_pool(cat, slot):
    """ids allowed in a theme slot"""
    if slot == "window":
        d = dict(cat["screen"])
        d.update(cat["winfx"])
        return d
    if slot == "window_color":
        return cat["color"]
    return cat[{"screen": "screen", "color": "color", "wall": "wall", "wallpaper": "wall", "cursor": "mouse", "mouse": "mouse", "frame": "frame"}[slot]]


def overlay_ids():
    """wallpaper effects that only touch the user's picture (light overlays); measured by bin/wallpaper-overlay-scan"""
    out = set()
    try:
        for line in open(os.path.join(ROOT, "wallpaper-effects", "overlay.tsv")):
            f = line.rstrip("\n").split("\t")
            if len(f) >= 4 and f[3] == "overlay":
                out.add(f[0])
    except OSError:
        pass
    try:  # an AI-made wallpaper effect only gets installed after bin/aigen proved it is a light overlay
        for fn in os.listdir(os.path.join(GENERATED, "wall")):
            if fn.startswith("ai-") and fn.endswith(".frag"):
                out.add(fn[:-5])
    except OSError:
        pass
    return out


def clean_name(n, limit=40):
    n = re.sub(r"[|\r\n\t\"'\\]", " ", str(n or ""))
    n = re.sub(r"[^\w .,&+()-]", "", n, flags=re.UNICODE)
    return re.sub(r"\s+", " ", n).strip()[:limit].strip()


def pick_id(value, pool, slot, notes, allow_animated=True, fuzzy=True, allow_custom=False):
    """validated id or ''. Unknown ids are replaced by a very close real one (typos) or dropped, with a note."""
    v = str(value or "").strip()
    if v == "" or v.lower() in ("off", "none", "null"):
        return ""
    if allow_custom:
        low = v.lower()
        if CUSTOM_RE.match(low):
            return low
        if omspalette.is_palette_id(low):
            return low
        m = re.fullmatch(r"custom-#?([0-9a-fA-F]{6})", v)
        if m:
            return "custom-" + m.group(1).lower()
    if not ID_RE.match(v):
        notes.append("%s: dropped an invalid id" % slot)
        return ""
    if v not in pool and v.lower() in pool:
        v = v.lower()
    if v in pool:
        if not allow_animated and pool[v].get("kind") == "animated":
            notes.append("%s: %s is animated, left out" % (slot, v))
            return ""
        return v
    if fuzzy:
        close = difflib.get_close_matches(v.lower(), list(pool), n=1, cutoff=0.85)
        if close:
            notes.append("%s: %s is not known, used %s" % (slot, v, close[0]))
            return close[0]
    if fuzzy:
        notes.append("%s: %s is not known here, left out" % (slot, v))
    else:
        notes.append("this theme needs the %s effect “%s”, which this version does not have (a newer OmaShaders may); left out" % (slot, v))
    return ""


def clean_opts(o, notes):
    out = {}
    if not isinstance(o, dict):
        return out
    for k, (lo, hi) in OPT_RANGES.items():
        if k in o:
            try:
                n = int(round(float(o[k])))
            except (TypeError, ValueError):
                continue
            out[k] = max(lo, min(hi, n))
    wh = o.get("wh")
    if isinstance(wh, str) and WH_RE.match(wh):
        out["wh"] = wh
    return out


def opts_str(o):
    return ",".join("%s=%s" % (k, o[k]) for k in (*OPT_RANGES, "wh") if k in o)


def parse_opts(s):
    o = {}
    for part in (s or "").split(","):
        k, _, v = part.partition("=")
        if k in OPT_RANGES and re.fullmatch(r"\d{1,3}", v or ""):
            o[k] = int(v)
        elif k == "wh" and WH_RE.match(v or ""):
            o["wh"] = v
    return clean_opts(o, [])


def theme_line(c):
    """screen|wall|mouse|color|name|winEffect|winColor|winFrame[|opts]  from a cleaned theme dict"""
    parts = [c.get("s", ""), c.get("w", ""), c.get("m", ""), c.get("c", ""), c.get("n", ""), c.get("wf", ""), c.get("wc", ""), c.get("wr", "")]
    o = opts_str(c.get("o") or {})
    if o:
        return "|".join(parts + [o])
    if parts[5] or parts[6] or parts[7]:
        return "|".join(parts)
    return "|".join(parts[:5]) if parts[4] else "|".join(parts[:4])


def parse_line(line):
    p = line.rstrip("\n").split("|")
    p += [""] * (9 - len(p))
    return {"s": p[0], "w": p[1], "m": p[2], "c": p[3], "n": p[4], "wf": p[5], "wc": p[6], "wr": p[7], "o": parse_opts(p[8])}


def identity(c):
    """what makes two themes 'the same' (matches Core.qml themeBase): the parts, not the name or numbers"""
    return "|".join([c.get("s", ""), c.get("w", ""), c.get("m", ""), c.get("c", ""), c.get("wf", ""), c.get("wc", ""), c.get("wr", "")])


def validate(c, cat, notes, allow_animated=True, fuzzy=True):
    """c uses the short keys n s w m c wf wc wr o; returns a clean copy with only real ids"""
    out = {
        "n": clean_name(c.get("n")),
        "s": pick_id(c.get("s"), slot_pool(cat, "screen"), "screen", notes, allow_animated, fuzzy=fuzzy),
        "c": pick_id(c.get("c"), slot_pool(cat, "color"), "color", notes, allow_custom=True, fuzzy=fuzzy),
        "w": pick_id(c.get("w"), slot_pool(cat, "wall"), "wallpaper", notes, fuzzy=fuzzy),
        "m": pick_id(c.get("m"), slot_pool(cat, "cursor"), "cursor", notes, fuzzy=fuzzy),
        "wf": pick_id(c.get("wf"), slot_pool(cat, "window"), "window", notes, fuzzy=fuzzy),
        "wc": pick_id(c.get("wc"), slot_pool(cat, "window_color"), "window colour", notes, allow_custom=True, fuzzy=fuzzy),
        "wr": pick_id(c.get("wr"), slot_pool(cat, "frame"), "frame", notes, fuzzy=fuzzy),
        "o": clean_opts(c.get("o"), notes),
    }
    return out


def read_themes():
    try:
        return [l for l in open(THEMES).read().split("\n") if l.strip()]
    except OSError:
        return []


def save_theme(c):
    """append to the themes file unless the same parts are already there; returns (line, number, existed)"""
    line = theme_line(c)
    have = read_themes()
    for i, l in enumerate(have):
        if identity(parse_line(l)) == identity(c):
            return l, i + 1, True
    os.makedirs(STATE, exist_ok=True)
    with open(THEMES, "w") as f:
        f.write("\n".join(have + [line]) + "\n")
    if line in starter_lines():
        mark_own(line)  # saved/imported by this user: theirs, even when it equals a shipped line
    return line, len(have) + 1, False


# ---- built-in themes and effects (what other users may not delete)
# A theme is built in when its whole line is in the shipped `starter-themes` file (its id is a short hash of that line). Nothing
# else marks it: no author, no user id, and a share code never carries the tag. Edit or rename it and the line changes, so the
# result is the user's own copy. The state file `themes-own` (hashes) only covers a user who saves or imports a line that equals
# a shipped one. The developer's switch is the empty file `dev-export` in the state folder (it also mirrors saves into starter-themes).
STARTER = os.path.join(ROOT, "starter-themes")
OWN = os.path.join(STATE, "themes-own")


def dev_switch():
    return os.path.exists(os.path.join(STATE, "dev-export"))


def theme_uid(line):
    return hashlib.sha1(line.encode("utf-8")).hexdigest()[:8]


def starter_lines():
    try:
        return {l for l in open(STARTER, encoding="utf-8").read().split("\n") if l.strip()}
    except OSError:
        return set()


def own_uids():
    try:
        return {l.strip() for l in open(OWN).read().split("\n") if l.strip()}
    except OSError:
        return set()


def mark_own(line):
    u = theme_uid(line)
    if u in own_uids():
        return
    try:
        os.makedirs(STATE, exist_ok=True)
        with open(OWN, "a") as f:
            f.write(u + "\n")
    except OSError:
        pass


def is_builtin_theme(line):
    return line in starter_lines() and theme_uid(line) not in own_uids()


def theme_label(line):
    c = parse_line(line)
    if c["n"]:
        return c["n"]
    return " + ".join(x for x in (c["s"], c["c"], c["w"], c["m"], c["wf"], c["wc"], c["wr"]) if x) or "empty theme"


def write_themes(lines):
    """rewrite the themes file; with the dev switch the shipped starter list follows (the same mirror Core.qml's writeThemes does)"""
    os.makedirs(STATE, exist_ok=True)
    tmp = "%s.%d.tmp" % (THEMES, os.getpid())
    with open(tmp, "w") as f:
        f.write("\n".join(lines) + ("\n" if lines else ""))
    os.replace(tmp, THEMES)
    if dev_switch():
        with open(STARTER, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))


# ---- share codes
def b64e(b):
    return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")


def b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def encode_code(c):
    d = {"v": 1, "n": c.get("n", ""), "s": c.get("s", ""), "w": c.get("w", ""), "m": c.get("m", ""), "c": c.get("c", ""),
         "wf": c.get("wf", ""), "wc": c.get("wc", ""), "wr": c.get("wr", "")}
    if c.get("o"):
        d["o"] = c["o"]
    raw = json.dumps({k: v for k, v in d.items() if v != "" or k in ("v", "n")}, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return CODE_PREFIX + b64e(zlib.compress(raw, 9))


def decode_code(code):
    code = "".join(str(code).split())
    if not code.startswith(CODE_PREFIX):
        raise Bad("This is not an OmaShaders code (it should start with %s)" % CODE_PREFIX)
    if len(code) > MAX_CODE:
        raise Bad("This code is too long to be a theme")
    body = code[len(CODE_PREFIX):]
    if not re.fullmatch(r"[A-Za-z0-9_-]+", body):
        raise Bad("This code has characters that do not belong in it")
    try:
        z = zlib.decompressobj()
        raw = z.decompress(b64d(body), MAX_JSON)
        if z.unconsumed_tail or not z.eof:
            raise Bad("This code is damaged or too big")
        d = json.loads(raw.decode("utf-8"))
    except Bad:
        raise
    except Exception:
        raise Bad("This code is damaged (could not read it)")
    if not isinstance(d, dict) or d.get("v") != 1:
        raise Bad("This code was made by a newer OmaShaders (version %s); update the plugin to import it" % (d.get("v") if isinstance(d, dict) else "?"))
    for k in ("n", "s", "w", "m", "c", "wf", "wc", "wr"):
        if k in d and not isinstance(d[k], str):
            raise Bad("This code is damaged (%s is not text)" % k)
    return d
