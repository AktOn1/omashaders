"""aitheme: the shared parts of the AI theme creator (bin/ai-theme is the command line, bin/aiinvent.py the Invent flow):
the guide and catalog texts, the picture facts, reading the AI's answer and cleaning it into a theme."""
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import omslib as L  # noqa: E402

GUIDE = os.path.join(L.ROOT, "docs", "theme-instructions.md")
# strengths (percent). Subtle: quiet overlay. Full: effects must be visible at first glance, so weak values from the AI are raised.
WALL_DEFAULT, WALL_MAX = 55, 70           # subtle: overlay opacity when the AI gives none / the most it may give
FULL_WALL_DEFAULT, FULL_WALL_MAX = 85, 100
FULL_CUR_DEFAULT = 85
FULL_FLOOR = {"fx": 60, "col": 65, "wall": 70, "cur": 70}   # full: the least a part that is set may get
FLOOR_ONLY_ABOVE_START = 40               # screen/colour pieces that start below this are delicate (pixel, 3D split): never raised


INVENT_HEAD = "\n## Inventing new effects"
PLAN_HEAD = "\n## Planning a Rich theme"
BUILD_HEAD = "\n## Building the pieces (RICH"
REVIEW_HEAD = "\n## The Reviewer"
MAINT_HEAD = "\n## For maintainers"


def guide_text():
    """the guide for Pick existing: everything except the Inventing chapter and the maintainer notes"""
    t = open(GUIDE, encoding="utf-8").read()
    return t.split(INVENT_HEAD)[0].split(MAINT_HEAD)[0].strip() + "\n"


def invent_text():
    """the Inventing chapter (a small system prompt of its own; the 22k-token catalog is not sent in Invent mode)"""
    t = open(GUIDE, encoding="utf-8").read()
    if INVENT_HEAD not in t:
        raise L.Bad("The theme guide has no Inventing chapter")
    ch = t.split(INVENT_HEAD, 1)[1].split(PLAN_HEAD)[0].split(MAINT_HEAD)[0]
    return ("# OmaShaders theme guide: INVENT mode\n\nYou design desktop themes for OmaShaders, a GPU effects plugin for the Omarchy desktop. "
            "You answer with one JSON object.\n\n## Inventing new effects" + ch).strip() + "\n"


def rich_chapter(head, end, role):
    t = open(GUIDE, encoding="utf-8").read()
    if head not in t:
        raise L.Bad("The theme guide has no chapter %r" % head.strip())
    body = t.split(head, 1)[1].split(end, 1)[0]
    return ("# OmaShaders theme guide: RICH mode (%s)\n\nYou work on desktop themes for OmaShaders, a GPU effects plugin for the Omarchy desktop. "
            "You answer with one JSON object.\n" % role + head + body).strip() + "\n"


def planner_text():
    return rich_chapter(PLAN_HEAD, BUILD_HEAD, "Planner")


def builder_text():
    """the Making chapter + the interface and rules of the Inventing chapter (its numbers are replaced by the Rich ones)"""
    t = open(GUIDE, encoding="utf-8").read()
    base = t.split(INVENT_HEAD, 1)[1].split("### Make it alive", 1)[1].split("### Answer in exactly this shape (INVENT)", 1)[0]
    return (rich_chapter(BUILD_HEAD, REVIEW_HEAD, "Builder") + "\n# Base rules and interface (from the Inventing chapter; the Rich numbers above replace its limits)\n\n"
            "### Make it alive" + base).strip() + "\n"


def reviewer_text():
    return rich_chapter(REVIEW_HEAD, MAINT_HEAD, "Reviewer")


def guide_version():
    m = re.match(r"Theme guide version:\s*(\S+)", open(GUIDE, encoding="utf-8").readline())
    return m.group(1) if m else ""


# ------------------------------------------------------------------ catalog text
def short(s, n=64):
    s = re.sub(r"\s+", " ", s or "").strip().replace("|", "/")
    s = re.sub(r"\s*\[measured:.*$", "", s)
    if len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0]
    return (cut or s[:n]).rstrip(",;:") + "…"


def catalog_text(cat):
    kind = {"static": "s", "animated": "a", "motion": "m"}
    parts = ["# CATALOG (id | s=static a=animated m=moving | category | what it does | start strength)",
             "Use these ids exactly. Screen ids may also fill the window slot."]
    names = [("screen", "Screen"), ("color", "Color"), ("wall", "Wallpaper"), ("mouse", "Cursor"), ("winfx", "Windows (window slot)"), ("frame", "Frames")]
    light = L.overlay_ids()
    for key, title in names:
        parts.append("\n## " + title + (" (light overlays on the user's own picture; nothing else is allowed here)" if key == "wall" else ""))
        for e in sorted(cat[key].values(), key=lambda e: (e["cat"], e["id"])):
            if key == "wall" and e["id"] not in light:
                continue
            row = [e["id"], kind.get(e["kind"], "s"), e["cat"], short(e["hint"])]
            if e["start"]:
                row.append(e["start"])
            parts.append("|".join(row))
    return "\n".join(parts) + "\n"


# ------------------------------------------------------------------ the picture
def current_background():
    base = os.path.join(os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state"), "omarchy", "current", "background")
    p = os.path.realpath(base)
    return p if os.path.isfile(p) else ""


def magick(args, binary=False):
    exe = shutil.which("magick") or shutil.which("convert")
    if not exe:
        return None
    try:
        r = subprocess.run(([exe] if exe.endswith("magick") else [exe]) + args, capture_output=True, timeout=60)
        return r.stdout if r.returncode == 0 else None
    except Exception:
        return None


def picture_facts(path):
    """small JPEG bytes + a text line with dominant colours and brightness (empty when ImageMagick is missing)"""
    jpg = magick([path + "[0]", "-resize", "768x768>", "-strip", "-quality", "80", "jpg:-"])
    pal = magick([path + "[0]", "-resize", "96x96!", "-colors", "6", "-depth", "8", "-format", "%c", "histogram:info:-"])
    mean = magick([path + "[0]", "-resize", "1x1!", "-colorspace", "Gray", "-format", "%[fx:mean*100]", "info:"])
    colours = []
    if pal:
        rows = []
        for line in pal.decode("utf-8", "replace").splitlines():
            m = re.match(r"\s*(\d+):.*(#[0-9A-Fa-f]{6})", line)
            if m:
                rows.append((int(m.group(1)), m.group(2).lower()))
        tot = sum(n for n, _ in rows) or 1
        colours = ["%s (%d%%)" % (h, round(100 * n / tot)) for n, h in sorted(rows, reverse=True)]
    facts = []
    if colours:
        facts.append("dominant colours: " + ", ".join(colours))
    if mean:
        try:
            facts.append("overall brightness: %d%% (0 black, 100 white)" % round(float(mean.decode().strip())))
        except ValueError:
            pass
    return jpg, "; ".join(facts)


def wallhaven_tags(wid):
    try:
        r = subprocess.run([os.path.join(L.HERE, "wallhaven"), "info", wid, "--json"], capture_output=True, text=True, timeout=60)
        d = json.loads(r.stdout)
        return [t for t in d.get("tags", [])][:20]
    except Exception:
        return []


def wallhaven_use(wid):
    """make the Wallhaven picture the wallpaper (same path as 'Use as wallpaper') BEFORE any theme is made; returns its file"""
    r = subprocess.run([os.path.join(L.HERE, "wallhaven"), "use", wid], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        raise L.Bad((r.stderr.strip().splitlines() or ["Could not set the wallpaper"])[-1].replace("wallhaven: ", ""))
    return current_background() or wallhaven_image(wid)


def wallhaven_image(wid):
    if not L.WH_RE.match(wid or ""):
        raise L.Bad("That is not a Wallhaven picture id")
    r = subprocess.run([os.path.join(L.HERE, "wallhaven"), "fetch", wid], capture_output=True, text=True, timeout=300)
    p = r.stdout.strip()
    if r.returncode != 0 or not os.path.isfile(p):
        raise L.Bad((r.stderr.strip().splitlines() or ["Could not download the picture"])[-1].replace("wallhaven: ", ""))
    return p


MODE_TEXT = {
    "full": "FULL theme (the default). Follow the 'Full theme' rules of the guide: first state the idea, then fill Screen, Color, Wallpaper overlay, "
            "Cursor, Windows part and Frame whenever something in the catalog fits, with strengths high enough to be seen at first glance. "
            "Text must stay readable.",
    "subtle": "SUBTLE theme. Follow the 'Subtle theme' rules of the guide: quiet, few parts, start strengths, leave a part empty when it adds nothing.",
}


def user_prompt(cat, request, facts, tags, has_image, mode="full"):
    p = [catalog_text(cat), "# MODE", MODE_TEXT.get(mode, MODE_TEXT["full"]), "# REQUEST", request.strip() or "(no words; design from the picture)"]
    if has_image or facts or tags:
        p.append("\n# BASE PICTURE (stays the wallpaper; read what it shows and the mood, then build the theme around it)")
        if has_image:
            p.append("The picture is attached.")
        if tags:
            p.append("Tags: " + ", ".join(tags))
        if facts:
            p.append(facts)
    p.append("\nAnswer with the one JSON object only.")
    return "\n".join(p)


# ------------------------------------------------------------------ the answer
def sentence(s, n=300):
    """a one-line, printable-ASCII text for the dialog (apostrophes and punctuation kept; it is only ever shown)"""
    t = re.sub(r"\s+", " ", re.sub(r"[^\x20-\x7e]", " ", str(s or ""))).strip()
    if len(t) <= n:
        return t
    cut = t[:n].rsplit(" ", 1)[0].rstrip(" ,;:")
    return cut + "..."


def extract_json(text):
    t = str(text or "").strip()
    t = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", t)
    a, b = t.find("{"), t.rfind("}")
    if a < 0 or b <= a:
        raise L.Bad("The AI did not answer with a theme")
    try:
        d = json.loads(t[a:b + 1], strict=False)
    except ValueError:
        raise L.Bad("The AI answer was not valid JSON")
    if not isinstance(d, dict):
        raise L.Bad("The AI did not answer with a theme")
    return d


def to_theme(d, wh=""):
    st = d.get("strength") if isinstance(d.get("strength"), dict) else {}
    o = {}
    for src, dst in (("screen", "fx"), ("color", "col"), ("wallpaper", "wall"), ("cursor", "cur")):
        if src in st:
            o[dst] = st[src]
    if wh:
        o["wh"] = wh
    return {"n": d.get("name"), "s": d.get("screen"), "c": d.get("color"), "w": d.get("wallpaper"), "m": d.get("cursor"),
            "wf": d.get("window"), "wc": d.get("window_color"), "wr": d.get("frame"), "o": o}


def start_strength(cat, section, pid):
    try:
        return int(cat[section][pid]["start"])
    except (KeyError, ValueError, TypeError):
        return 100


def raise_weak(clean, cat):
    """full theme: a part the AI set too timidly is raised to the floor so it is visible at first glance;
    delicate effects (start strength below FLOOR_ONLY_ABOVE_START: pixel blocks, 3D split) are left alone"""
    o = clean["o"]
    for key, slot, section in (("fx", "s", "screen"), ("col", "c", "color")):
        if not clean[slot]:
            o.pop(key, None)
            continue
        start = start_strength(cat, section, clean[slot])
        if start >= FLOOR_ONLY_ABOVE_START and o.get(key, start) < FULL_FLOOR[key]:
            o[key] = FULL_FLOOR[key]
    if clean["m"]:
        o["cur"] = max(o.get("cur", FULL_CUR_DEFAULT), FULL_FLOOR["cur"])
    else:
        o.pop("cur", None)


def finish(d, cat, wh="", mode="full", only=False):
    """mode: full (first theme, weak strengths raised), subtle (quiet), follow (a chat follow-up: the user's words win, nothing is raised)"""
    notes = []
    full = mode == "full"
    follow = mode == "follow"
    clean = L.validate(to_theme(d, wh), cat, notes)
    # the user's picture stays the wallpaper: only light overlays may layer on it, never a scene that repaints it
    if clean["w"]:
        if clean["w"] not in L.overlay_ids():
            notes.append("wallpaper: %s repaints the picture, left out (the picture you set stays the wallpaper)" % clean["w"])
            clean["w"] = ""
        elif full:
            clean["o"]["wall"] = max(FULL_FLOOR["wall"], min(clean["o"].get("wall", FULL_WALL_DEFAULT), FULL_WALL_MAX))
        elif follow:
            clean["o"]["wall"] = min(clean["o"].get("wall", FULL_WALL_DEFAULT), FULL_WALL_MAX)
        else:
            clean["o"]["wall"] = min(clean["o"].get("wall", WALL_DEFAULT), WALL_MAX)
    if not clean["w"]:
        clean["o"].pop("wall", None)
    if full:
        raise_weak(clean, cat)
        if not clean["w"] and not clean["m"] and not only:
            notes.append("This theme has nothing that moves or answers the pointer (no wallpaper overlay and no cursor), so it is mostly a tint. Ask for beams, ripples or particles to bring it to life.")
    elif follow:
        for key, slot in (("fx", "s"), ("col", "c"), ("cur", "m")):
            if not clean[slot]:
                clean["o"].pop(key, None)
    if not any(clean[k] for k in ("s", "w", "m", "c", "wf", "wc", "wr")):
        raise L.Bad("The AI picked nothing that exists in this version" + ((": " + "; ".join(notes[:3])) if notes else ""))
    if not clean["n"]:
        clean["n"] = "AI theme"
    return clean, notes


# ------------------------------------------------------------------ chat: the theme as an answer, merging a follow-up, what changed
CHAT_SLOTS = (("screen", "s", "Screen"), ("color", "c", "Color"), ("wallpaper", "w", "Wallpaper overlay"), ("cursor", "m", "Cursor"),
              ("window", "wf", "Window shader"), ("window_color", "wc", "Window colour"), ("frame", "wr", "Frame"))
CHAT_STRENGTH = (("screen", "fx"), ("color", "col"), ("wallpaper", "wall"), ("cursor", "cur"))


def theme_as_answer(clean):
    """a cleaned theme in the shape of the AI's answer (what the AI is shown as CURRENT THEME, and what a follow-up changes)"""
    d = {"name": clean.get("n", "")}
    for slot, key, _ in CHAT_SLOTS:
        d[slot] = clean.get(key, "")
    d["strength"] = {slot: clean["o"][opt] for slot, opt in CHAT_STRENGTH if opt in (clean.get("o") or {})}
    return d


def merge_answer(cur, answer):
    """cur (answer shape) + a follow-up that holds only what changes: a missing key stays, "" removes. A part that was swapped and came
    without a strength loses the old one (a different effect starts at its own strength)."""
    d = json.loads(json.dumps(cur))
    st = d.setdefault("strength", {})
    given = answer.get("strength") if isinstance(answer.get("strength"), dict) else {}
    if answer.get("name"):
        d["name"] = answer["name"]
    for slot, _, _ in CHAT_SLOTS:
        if slot in answer:
            new = answer[slot] if answer[slot] is not None else ""
            if new != d.get(slot, "") and slot not in given:
                st.pop(slot, None)
            d[slot] = new
    for slot, v in given.items():
        st[slot] = v
    return d


def describe_changes(old, new, cat=None):
    """plain list of what a turn changed, from two cleaned themes (old may be None for the first turn)"""
    old = old or {"o": {}}
    out = []
    for slot, key, title in CHAT_SLOTS:
        a, b = old.get(key, ""), new.get(key, "")
        if a == b:
            continue
        if not a:
            out.append("%s added: %s" % (title, b))
        elif not b:
            out.append("%s removed (was %s)" % (title, a))
        else:
            out.append("%s: %s -> %s" % (title, a, b))
    for slot, opt in CHAT_STRENGTH:
        key = {"screen": "s", "color": "c", "wallpaper": "w", "cursor": "m"}[slot]
        a, b = (old.get("o") or {}).get(opt), (new.get("o") or {}).get(opt)
        if new.get(key) and old.get(key) == new.get(key) and a != b:
            title = next(t for s2, k2, t in CHAT_SLOTS if s2 == slot)
            out.append("%s strength: %s -> %s" % (title, "start" if a is None else "%d%%" % a, "start" if b is None else "%d%%" % b))
    if old.get("n") and old.get("n") != new.get("n"):
        out.append("Name: %s -> %s" % (old["n"], new["n"]))
    return out


FOLLOWUP_RULES = (
    "This is a FOLLOW-UP in a chat. The user is refining the CURRENT THEME below, live on their screen. Answer with the same one JSON object, "
    "but include ONLY the keys that change: a key you leave out stays exactly as it is, \"\" removes that part, and \"strength\" lists only the "
    "strengths you change. \"idea\" is one short sentence saying what you changed and why. Do what was asked, literally: \"less\" or "
    "\"weaker\" means lower the strength clearly (20 to 40 points), \"more\" means raise it, \"swap the cursor\" means a different cursor "
    "and nothing else. The first-theme rule that every part must be visible at first glance does NOT apply any more, and you must not "
    "touch parts the user did not mention. Never answer with the whole theme again.")


def current_text(clean, desc_of=None):
    """the CURRENT THEME block of a follow-up prompt; desc_of(id) gives the description of a generated effect"""
    d = theme_as_answer(clean)
    rows = ["# CURRENT THEME (what is on the user's screen right now)", json.dumps(d, ensure_ascii=False)]
    gen = []
    for slot, key, title in CHAT_SLOTS:
        v = clean.get(key, "")
        if v.startswith("ai-") and desc_of:
            gen.append("- %s %s (generated this chat): %s" % (slot, v, desc_of(v) or "no description"))
    if gen:
        rows.append("Generated effects in it (to change how one looks, write a new effect for that part):\n" + "\n".join(gen))
    return "\n".join(rows)


def history_text(history, keep=6):
    rows = []
    for h in history[-keep * 2:]:
        if h["role"] == "user":
            rows.append("user: " + sentence(h["text"], 300))
        else:
            rows.append("you: " + sentence(h.get("text", ""), 300) + ((" [changed: " + "; ".join(h["changes"]) + "]") if h.get("changes") else ""))
    return ("# CHAT SO FAR\n" + "\n".join(rows)) if rows else ""
