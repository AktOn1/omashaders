"""aiinvent: the "Invent new" mode of the AI theme creator.

The AI gets a small prompt (the Inventing chapter of docs/theme-instructions.md, the NAMES of the existing effects, the exact
palette of the user's picture, the picture itself when the provider can look at it) and answers with a theme in which each part is
an existing id, empty, or a NEW effect (shader code for a fixed template). Every new effect goes through the mandatory gate in
bin/aigen.py with the user's own picture; a refusal goes back to the AI with the reason (two repairs at most); what still fails is
replaced by the closest existing effect and the user is told. Passed effects are installed as "pending" in <state>/generated;
the dialog then asks Keep or Discard.
"""
import colorsys
import concurrent.futures
import difflib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import aigen as G  # noqa: E402
import aisprites as SP  # noqa: E402
import imgprov as I  # noqa: E402
import aiprov as P  # noqa: E402
import aitheme as T  # noqa: E402
import omslib as L  # noqa: E402

MAX_REPAIRS = 2
# slot -> (aigen kind, theme key, strength key, floor)
SLOTS = {
    "screen": ("screen", "s", "screen", T.FULL_FLOOR["fx"]),
    "color": ("color", "c", "color", T.FULL_FLOOR["col"]),
    "wallpaper": ("wallpaper", "w", "wallpaper", T.FULL_FLOOR["wall"]),
    "cursor": ("cursor", "m", "cursor", T.FULL_FLOOR["cur"]),
    "window": ("window", "wf", "", T.FULL_FLOOR["fx"]),
    "window_color": ("color", "wc", "", T.FULL_FLOOR["col"]),
    "frame": ("frame", "wr", "", 0),
}
TITLE = {"screen": "Screen", "color": "Color", "wallpaper": "Wallpaper overlay", "cursor": "Cursor", "window": "Window shader",
         "window_color": "Window colour", "frame": "Frame"}
DIRECTION_KEYS = tuple(SLOTS)
# rough list prices in USD per million tokens (in, out); only used for the estimate shown before a run
PRICES = {"sonnet": (3.0, 15.0), "opus": (15.0, 75.0)}
IMAGE_TOKENS = 1200
OUT_TOKENS_PER_PART = 450


# ------------------------------------------------------------------ the picture's palette
HUE_NAMES = [(15, "red"), (45, "orange"), (70, "yellow"), (160, "green"), (200, "cyan"), (255, "blue"), (290, "purple"), (335, "pink"), (361, "red")]


def hue_name(h, s, v):
    if v < 0.18:
        return "black"
    if s < 0.12:
        return "white" if v > 0.85 else ("grey" if v > 0.3 else "dark grey")
    deg = h * 360
    for lim, name in HUE_NAMES:
        if deg < lim:
            return name if v > 0.45 else "dark " + name
    return "red"


def hexof(rgb):
    return "%02x%02x%02x" % tuple(int(round(max(0, min(255, c)))) for c in rgb)


def palette(path):
    """{'main': [(hex, percent, name)], 'accents': [(hex, percent, name)]} measured from the picture; empty without a picture"""
    if not path or not os.path.isfile(path):
        return {"main": [], "accents": []}
    from PIL import Image
    im = Image.open(path).convert("RGB")
    im.thumbnail((160, 160))
    q = im.quantize(8, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    total = float(im.size[0] * im.size[1])
    main = []
    for n, idx in sorted(q.getcolors(), reverse=True):
        rgb = pal[idx * 3: idx * 3 + 3]
        h, s, v = colorsys.rgb_to_hsv(*(c / 255.0 for c in rgb))
        main.append((hexof(rgb), round(100 * n / total), hue_name(h, s, v)))
    buckets = {}
    for r, g, b in im.getdata():
        h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
        if s > 0.45 and v > 0.3:
            k = int(h * 12) % 12
            e = buckets.setdefault(k, [0, 0, 0, 0])
            e[0] += 1
            e[1] += r
            e[2] += g
            e[3] += b
    acc = []
    for k, (n, r, g, b) in sorted(buckets.items(), key=lambda kv: -kv[1][0]):
        if n / total < 0.004 or len(acc) >= 3:
            continue
        rgb = (r / n, g / n, b / n)
        h, s, v = colorsys.rgb_to_hsv(*(c / 255.0 for c in rgb))
        acc.append((hexof(rgb), round(100.0 * n / total, 1), hue_name(h, s, v)))
    return {"main": main, "accents": acc}


def palette_text(pal):
    if not pal["main"]:
        return ""
    rows = ["PALETTE measured from the picture (write a colour as C_ followed by the hex digits):",
            "main colours: " + ", ".join("C_%s %s (%d%%)" % (h, nm, pc) for h, pc, nm in pal["main"])]
    if pal["accents"]:
        rows.append("vivid accents (small but characteristic; use them for what the user calls 'the colour of the object'): "
                    + ", ".join("C_%s %s (%s%% of the picture)" % (h, nm, pc) for h, pc, nm in pal["accents"]))
    return "\n".join(rows)


# ------------------------------------------------------------------ the prompt
def names_text(cat):
    light = L.overlay_ids()
    out = ["# EXISTING EFFECTS (names only; use an id exactly as spelled, or write a new effect)"]
    for key, title in (("screen", "screen (also usable as window)"), ("color", "color (also window_color)"), ("wall", "wallpaper"),
                       ("mouse", "cursor"), ("winfx", "window"), ("frame", "frame")):
        ids = sorted(i for i in cat[key] if not i.startswith("ai-") and (key != "wall" or i in light))
        out.append("%s: %s" % (title, " ".join(ids)))
    return "\n".join(out)


def directions_text(directions):
    rows = []
    for k in DIRECTION_KEYS:
        v = re.sub(r"[\x00-\x1f]+", " ", str((directions or {}).get(k) or "")).strip()[:200]
        if v:
            rows.append("- %s: %s" % (k, v))
    return ("# DIRECTIONS FOR PARTS (orders from the user)\n" + "\n".join(rows)) if rows else ""


def only_rule(only):
    return ("ONE EFFECT ONLY: the user asked for a single %s effect, not a theme. Answer with the key \"%s\" (and \"name\", \"idea\", \"note\", \"strength\" for it) "
            "and leave out every other part. Write it as a NEW effect (shader code) unless an existing one already is exactly what was asked." % (TITLE[only].lower(), only))


def regen_rule(regen):
    """the REGENERATE block of a prompt: which parts are made again, which version they replace, what is locked (bin/airegen.py)"""
    sl = list(regen["slots"])
    rows = ["REGENERATE. The user pressed \"regenerate\" for some parts of the CURRENT THEME below. Write a genuinely DIFFERENT take for exactly these parts: %s. "
            "For each one write a NEW effect (shader code, or a \"settings\" object for a frame), not an existing id, unless nothing new can fit. "
            "Do not repeat the look, the idea or the code of the version being replaced. Every other part is LOCKED: leave its key out of your answer, "
            "and list in \"strength\" only the parts you regenerate. \"idea\" is one short sentence about what is new." % ", ".join(sl)]
    for slot in sl:
        old = (regen.get("avoid") or {}).get(slot) or []
        rows.append("- %s: %s" % (slot, ("replaces " + "; ".join(old[:4]) + " (do not repeat)") if old else "there is no %s yet: ADD one that suits the theme" % TITLE[slot].lower()))
    if regen.get("direction"):
        rows.append("Direction from the user (applies ONLY to the parts above): " + regen["direction"])
    return "\n".join(rows)


def user_prompt(cat, request, directions, pal, facts, tags, has_image, chat=None, sprites=False, only="", regen=None):
    p = [names_text(cat), "# MODE"]
    if chat and regen:
        p += [regen_rule(regen), T.current_text(chat["theme"], chat.get("desc_of")), T.history_text(chat["history"])]
    elif chat:
        p += ["INVENT. " + T.FOLLOWUP_RULES + " Write a new effect only for a part the request needs something that does not exist yet for; "
              "reuse an existing id where it is already right.", T.current_text(chat["theme"], chat.get("desc_of")), T.history_text(chat["history"]),
              "# REQUEST", request.strip()]
    else:
        p += ["INVENT. Write new effects for the parts where the idea needs something that does not exist yet; "
              "reuse an existing id where it is already right. Full theme: fill every part that helps the idea, visible at first glance, text readable.",
              "# REQUEST", request.strip() or "(no words; design from the picture)"]
    if only:
        p.append(only_rule(only))
    d = directions_text(directions)
    if d:
        p.append(d)
    if has_image or pal["main"] or tags or facts:
        p.append("\n# BASE PICTURE (stays the wallpaper; read what it shows and the mood)")
        if has_image:
            p.append("The picture is attached.")
        if tags:
            p.append("Tags: " + ", ".join(tags))
        if facts:
            p.append(facts)
        if pal["main"]:
            p.append(palette_text(pal))
    if sprites and not chat:
        p.append("\n" + SP.builder_text(None))
    p.append("\nAnswer with the one JSON object only.")
    return "\n".join(p)


def repair_prompt(failed, pal, sprites=False):
    rows = ["# REPAIR", "The safety gate refused these new effects. Fix every one so it passes; keep the idea and the colours. "
            "Answer with one JSON object that has ONLY these keys, each as {\"new\": {...}} in the same shape as before: %s." % ", ".join(failed)]
    for slot, f in failed.items():
        rows.append("\n## %s \"%s\" was refused:" % (slot, f["name"]))
        rows += ["- " + x for x in f["problems"][:6]]
        if f.get("code"):
            rows.append("your code was:\n" + f["code"][:4000])
    t = palette_text(pal)
    if t:
        rows.append("\n" + t)
    if sprites and "wallpaper" in failed:
        rows.append("\n" + SP.builder_text(failed["wallpaper"].get("sprites")))
    return "\n".join(rows)


# ------------------------------------------------------------------ a theme must live
def uses(code, word):
    return re.search(r"\b%s\b" % word, G.strip_comments(code or "")) is not None


def life_gaps(parts):
    """what the theme lacks, judged from the parts the AI wrote (before the gate): 'alive' = nothing animated on the wallpaper or at the
    cursor, 'pointer' = nothing answers the pointer. An existing overlay or cursor counts as both (they all have the pointer reaction)."""
    wk, w = parts.get("wallpaper", ("none", ""))
    ck, c = parts.get("cursor", ("none", ""))
    wall_alive = (wk == "id" and w in L.overlay_ids()) or (wk == "new" and uses(w["code"], "time"))
    wall_ptr = (wk == "id" and w in L.overlay_ids()) or (wk == "new" and (uses(w["code"], "m") or uses(w["code"], "mouse")))
    cursor_alive = ck == "id" or (ck == "new" and uses(c["code"], "time"))
    gaps = []
    if not (wall_alive or cursor_alive):
        gaps.append("alive")
    if not (ck != "none" or wall_ptr):
        gaps.append("pointer")
    return gaps


LIFE_TEXT = {
    "alive": "Nothing in the theme is alive: it has no moving wallpaper overlay (and no animated cursor), so it only recolours the picture. "
             "Add a `wallpaper` overlay that moves with `time`: light on the water or the scene (drifting caustic light, slanting sun beams with dust, glints that twinkle), "
             "floating particles (pollen, seeds, petals, snow, embers), mist, streaks. Put the colour in `color`, not in the overlay.",
    "pointer": "Nothing answers the pointer. Add a `cursor` effect (an existing id or a new one that suits the story), or make the wallpaper overlay use `m` "
               "(ripples that spread from `m` on water, particles or beams that part and drift away from it, a light that follows it).",
}


def life_prompt(gaps, parts, pal, sprites=False):
    rows = ["# REPAIR (THE THEME DOES NOT LIVE)",
            "The theme you wrote would look like a plain tint. Fix it without changing the idea or the colours. Answer with one JSON object that has ONLY the keys you change, "
            "from: wallpaper, cursor. Each is an existing id from the lists, or {\"new\": {...}} in the same shape as before. Keep the playful, slight and soft feel."]
    rows += ["- " + LIFE_TEXT[g] for g in gaps]
    wk, w = parts.get("wallpaper", ("none", ""))
    if wk == "new" and w.get("code"):
        rows.append("\nyour wallpaper code was:\n" + w["code"][:3000])
    t = palette_text(pal)
    if t:
        rows.append("\n" + t)
    if sprites:
        rows.append("\n" + SP.builder_text(None))
    return "\n".join(rows)


# ------------------------------------------------------------------ reading the answer
def part_of(slot, v):
    """-> ('none', '') | ('id', 'name') | ('new', {name, desc, start, fallback, code|settings}); raises ValueError with a plain reason"""
    if v is None or v == "":
        return ("none", "")
    if isinstance(v, str):
        return ("id", v.strip())
    if not isinstance(v, dict):
        raise ValueError("%s: expected an id, \"\" or {\"new\": {...}}" % slot)
    n = v.get("new") if isinstance(v.get("new"), dict) else (v if "code" in v or "settings" in v else None)
    if n is None:
        raise ValueError("%s: expected {\"new\": {...}}" % slot)
    kind = SLOTS[slot][0]
    out = {"name": L.clean_name(n.get("name"), 40) or TITLE[slot], "desc": G.one_line(n.get("desc"), 140), "fallback": str(n.get("fallback") or "").strip(),
           "start": 70}
    try:
        out["start"] = int(float(n.get("start", 70)))
    except (TypeError, ValueError):
        pass
    if kind == "frame":
        if not isinstance(n.get("settings"), dict):
            raise ValueError("%s: a new frame needs a \"settings\" object" % slot)
        out["settings"] = n["settings"]
        out["code"] = ""
    else:
        if not isinstance(n.get("code"), str) or not n["code"].strip():
            raise ValueError("%s: a new effect needs its \"code\" as one string" % slot)
        out["code"] = n["code"]
        if slot == "wallpaper":
            out["sprites"] = SP.clean_spec(n.get("sprites"))
    return ("new", out)


def gated_start(slot, p):
    floor = SLOTS[slot][3]
    return max(floor, min(100, max(5, p["start"])))


def gate_part(slot, p, image, keep_out="", profile="quick", sprites=False, atlas=""):
    """sprites: the user asked for painted sprites; a new wallpaper effect is then built with the sprite atlas bound (rendered with a stand-in atlas here)"""
    kind = SLOTS[slot][0]
    start = gated_start(slot, p)
    r = G.gate(kind, p["code"], p["name"], p["desc"] or p["name"], start, image, p.get("settings"),
               os.path.join(keep_out, slot) if keep_out else "", profile=profile, sprites=(sprites if slot == "wallpaper" else False), atlas=atlas)
    return r, start


def closest_existing(slot, p, cat, exclude=()):
    """the AI's own fallback when it is valid, else the closest by words in the description; '' when nothing fits. exclude = ids not to use
    (a regenerate must not fall back to the version it replaces)"""
    kind = SLOTS[slot][0]
    pool = L.slot_pool(cat, {"screen": "screen", "window": "window", "color": "color", "window_color": "window_color", "wallpaper": "wall",
                             "cursor": "cursor", "frame": "frame"}[slot])
    pool = {k: v for k, v in pool.items() if not k.startswith("ai-") and k not in exclude}
    if kind == "wallpaper":
        light = L.overlay_ids()
        pool = {k: v for k, v in pool.items() if k in light}
    fb = p.get("fallback", "")
    if fb in pool:
        return fb
    if fb:
        close = difflib.get_close_matches(fb, list(pool), n=1, cutoff=0.8)
        if close:
            return close[0]
    words = set(re.findall(r"[a-z]{4,}", (p.get("name", "") + " " + p.get("desc", "")).lower()))
    best, score = "", 0
    for k, e in pool.items():
        s = len(words & set(re.findall(r"[a-z]{4,}", (k.replace("-", " ") + " " + e.get("hint", "") + " " + e.get("cat", "")).lower())))
        if s > score:
            best, score = k, s
    if not best and exclude and pool:   # a regenerate must still give a different effect: no word matched, so take one by the name's letters
        names = sorted(pool)
        best = names[sum(ord(c) for c in (p.get("name") or slot)) % len(names)]
    return best


# ------------------------------------------------------------------ estimate
def estimate(request, directions, path, ch=None, cat=None, sprites=False, only=""):
    ch = ch or P.choice()
    cat = cat or L.catalog()
    pal = palette(path) if path else {"main": [], "accents": []}
    prompt = user_prompt(cat, request, directions, pal, "", [], bool(path), None, sprites, only)
    system = T.invent_text()
    img = IMAGE_TOKENS if (path and P.can_see(ch)) else 0
    t_in = (len(system) + len(prompt)) // 4 + img
    wanted = sum(1 for k in DIRECTION_KEYS if (directions or {}).get(k)) or 4
    t_out = 400 + OUT_TOKENS_PER_PART * (1 if only else max(wanted, 4))
    est = {"tokens_in": t_in, "tokens_out": t_out, "repair_tokens_in": 900 + OUT_TOKENS_PER_PART * 2, "repair_tokens_out": OUT_TOKENS_PER_PART * 2,
           "image_tokens": img, "cost_usd": None, "note": ""}
    pr = PRICES.get(ch.get("model")) if ch["provider"] == "claude" else None
    if pr:
        est["cost_usd"] = round((t_in * pr[0] + t_out * pr[1]) / 1e6, 3)
    elif ch["provider"] == "ollama":
        est["note"] = "local: no cost, only time"
    else:
        est["note"] = "price depends on your plan"
    est["sprite_images"] = SP.CELLS if sprites else 0
    est["pick_tokens_in"] = (len(T.guide_text()) + len(T.catalog_text(cat))) // 4 + img
    return est


# ------------------------------------------------------------------ the whole flow
def add_usage(total, u):
    total["tokens_in"] += u.get("tokens_in") or 0
    total["tokens_out"] += u.get("tokens_out") or 0
    if u.get("cost_usd") is not None:
        total["cost_usd"] = round((total["cost_usd"] or 0) + u["cost_usd"], 4)
    total["calls"] += 1
    total["estimated"] = total["estimated"] or bool(u.get("estimated"))


def run(request, directions, path, wh, ch, progress=lambda m: None, keep_out="", chat=None, save=True, sprites=False, only="", regen=None):
    """-> result dict (see the keys at the end); raises L.Bad for a plain-language failure.
    chat = {"theme": cleaned current theme, "history": [...], "desc_of": fn} makes this a follow-up turn: only what the answer names changes,
    the theme is not saved (the chat does that on Keep) and the picture is not sent again (its palette still is).
    sprites = the user ticked "Painted sprites (uses your image model)": the new wallpaper effect gets eight sprites painted by the image model
    (bin/aisprites.py). Only the first build paints; a follow-up turn never sends anything to the image model.
    regen = {"slots": [...], "avoid": {slot: [descriptions of the versions being replaced]}, "direction": text, "exclude": {slot: [ids]}} (needs chat): only those parts
    are written again, as genuinely different new effects; whatever else the answer holds is thrown away (bin/airegen.py locks the rest)."""
    av = P.availability(ch)
    if not av["available"]:
        raise L.Bad("AI needed. " + av["hint"])
    miss = G.render_ready()
    if miss:
        raise L.Bad(miss)
    cat = L.catalog()
    notes = []
    if sprites and chat:
        sprites = False
    if only and only not in SLOTS:
        raise L.Bad("Unknown part " + only)
    if only and only != "wallpaper":
        sprites = False
    if not P.is_strong(ch):
        notes.append("This is a small local model. Writing new effects usually fails the safety check with these; Pick existing works better for it.")
    jpg, facts = T.picture_facts(path) if path else (None, "")
    tags = T.wallhaven_tags(wh) if wh else []
    pal = palette(path)
    system = T.invent_text()
    if chat:
        jpg = None
    if regen and not chat:
        raise L.Bad("A regenerate needs a theme")
    prompt = user_prompt(cat, request, directions, pal, facts, tags, bool(jpg) and P.can_see(ch), chat, sprites, only, regen)
    usage = {"tokens_in": 0, "tokens_out": 0, "cost_usd": None, "calls": 0, "estimated": False}

    progress("Asking the AI to invent the theme…")
    answer = None
    ask = prompt
    for attempt in range(2):
        text, u = P.call(ch, system, ask, jpg)
        add_usage(usage, u)
        try:
            answer = T.extract_json(text)
            break
        except L.Bad as e:
            if attempt == 1:
                raise
            ask = prompt + "\n\n# PREVIOUS ANSWER WAS REFUSED\n%s. Answer with one JSON object and nothing else." % e
    if regen:  # the locked parts are not the AI's to touch, whatever it wrote
        sel = set(regen["slots"])
        st_in = answer.get("strength") if isinstance(answer.get("strength"), dict) else {}
        answer = dict({k: v for k, v in answer.items() if k in sel or k in ("name", "idea", "note")}, strength={k: v for k, v in st_in.items() if k in sel})
    parts, bad = {}, []
    for slot in SLOTS:
        if only and slot != only:
            parts[slot] = ("none", "")
            continue
        if chat and slot not in answer:
            cur = chat["theme"].get(SLOTS[slot][1], "")
            parts[slot] = ("id", cur) if cur else ("none", "")
            continue
        try:
            parts[slot] = part_of(slot, answer.get(slot))
        except ValueError as e:
            parts[slot] = ("none", "")
            bad.append(str(e))
    notes += ["The AI's answer for %s was not usable and was left out." % b.split(":")[0] for b in bad]

    # a theme that only recolours the picture gets one round to add something that moves and answers the pointer
    if not chat and not only:
        gaps = life_gaps(parts)
        if gaps:
            progress("The theme has nothing that moves or answers the pointer; asking the AI to add it…")
            try:
                text, u = P.call(ch, system, life_prompt(gaps, parts, pal, sprites), None)
                add_usage(usage, u)
                fix = T.extract_json(text)
                for slot in ("wallpaper", "cursor"):
                    if slot not in fix:
                        continue
                    try:
                        kind, val = part_of(slot, fix.get(slot))
                    except ValueError:
                        continue
                    if kind == "none":
                        continue
                    if kind == "new":
                        val["fallback"] = val["fallback"] or (parts[slot][1].get("fallback", "") if parts[slot][0] == "new" else "")
                    parts[slot] = (kind, val)
            except L.Bad as e:
                notes.append("Asking the AI for more life failed (%s)." % e)
            for g in life_gaps(parts):
                notes.append("The theme still has %s." % ("nothing moving on the wallpaper or at the cursor" if g == "alive" else "nothing that answers the pointer"))

    # gate every new part with the user's picture, repair what fails
    state = {s: {"tries": 0, "ok": False, "problems": [], "info": {}, "built": None, "start": 0} for s, (k, _) in parts.items() if k == "new"}
    todo = list(state)
    for rnd in range(MAX_REPAIRS + 1):
        if not todo:
            break
        progress("Checking %d new effect%s with the safety gate…" % (len(todo), "" if len(todo) == 1 else "s") if rnd == 0 else
                 "Repair round %d: checking %d effect%s again…" % (rnd, len(todo), "" if len(todo) == 1 else "s"))
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
            futs = {s: ex.submit(gate_part, s, parts[s][1], path, keep_out, "quick", sprites) for s in todo}
            for s, f in futs.items():
                r, start = f.result()
                st = state[s]
                st.update(tries=st["tries"] + 1, ok=r["ok"], problems=r["problems"], info=r["info"], built=r["built"], start=start)
        failed = {s: {"name": parts[s][1]["name"], "problems": state[s]["problems"], "code": parts[s][1].get("code", ""), "sprites": parts[s][1].get("sprites")}
                  for s in todo if not state[s]["ok"]}
        if not failed or rnd == MAX_REPAIRS:
            break
        progress("%d effect%s refused by the gate; asking the AI to repair %s…" % (len(failed), "" if len(failed) == 1 else "s", "it" if len(failed) == 1 else "them"))
        try:
            text, u = P.call(ch, system, repair_prompt(failed, pal, sprites), None)
            add_usage(usage, u)
            fix = T.extract_json(text)
        except L.Bad as e:
            notes.append("The repair round failed (%s)." % e)
            break
        todo = []
        for slot in failed:
            try:
                kind, val = part_of(slot, fix.get(slot))
            except ValueError:
                continue
            if kind == "new":
                val.setdefault("fallback", "")
                if not val["fallback"]:
                    val["fallback"] = parts[slot][1].get("fallback", "")
                if slot == "wallpaper" and not val.get("sprites"):
                    val["sprites"] = parts[slot][1].get("sprites")
                parts[slot] = ("new", val)
                todo.append(slot)
    # install what passed, replace what did not
    chosen, fell_back, made = {}, [], []
    for slot, (kind, val) in parts.items():
        if kind == "none":
            continue
        if kind == "id":
            chosen[slot] = val
            continue
        st = state[slot]
        if st["ok"]:
            if sprites and slot == "wallpaper":
                eid, sprob, snotes, sinfo = SP.finish_wall(
                    val, I.choice(), path, st["start"],
                    lambda built, atlas: G.install("wallpaper", built, val["name"], val["desc"] or val["name"], request, "", False, atlas=atlas),
                    keep_out=os.path.join(keep_out, slot) if keep_out else "", progress=progress, ch_text=ch)
                notes += snotes
                if eid is None:
                    st.update(ok=False, problems=sprob or ["it did not pass"])
                    # fall through to the "did not pass" branch below
                else:
                    st["info"] = sinfo or st["info"]
            else:
                eid = G.install(SLOTS[slot][0], st["built"], val["name"], val["desc"] or val["name"], request, "", False)
        if st["ok"]:
            chosen[slot] = eid
            made.append({"slot": slot, "title": TITLE[slot], "id": eid, "name": val["name"], "desc": val["desc"], "tries": st["tries"],
                         "start": st["start"], "info": st["info"]})
            if st["tries"] > 1:
                notes.append("%s “%s” needed %d tries to pass the safety check." % (TITLE[slot], val["name"], st["tries"]))
        else:
            alt = closest_existing(slot, val, cat, (regen or {}).get("exclude", {}).get(slot, ()))
            reason = (st["problems"] or ["it did not pass"])[0]
            fell_back.append({"slot": slot, "title": TITLE[slot], "name": val["name"], "reason": reason, "used": alt, "problems": st["problems"]})
            notes.append("%s: the new effect “%s” did not pass the safety check (%s)%s." %
                         (TITLE[slot], val["name"], reason[:140], (", so I used the existing “%s” instead" % alt) if alt else ", so that part is left off"))
            if alt:
                chosen[slot] = alt
            elif chat and chat["theme"].get(SLOTS[slot][1]):
                chosen[slot] = chat["theme"][SLOTS[slot][1]]
    if sprites and not any(m["slot"] == "wallpaper" for m in made):
        notes.append(SP.NOT_PAINTED)
    d = {"name": answer.get("name"), "idea": answer.get("idea"), "note": answer.get("note"), "strength": {}}
    for slot in SLOTS:
        d[slot] = chosen.get(slot, "")
    ans_strength = answer.get("strength") if isinstance(answer.get("strength"), dict) else {}
    for slot in ("screen", "color", "wallpaper", "cursor"):
        mine = next((m for m in made if m["slot"] == slot), None)
        if mine:
            d["strength"][slot] = mine["start"]
        elif slot in ans_strength:
            d["strength"][slot] = ans_strength[slot]
    cat = L.catalog()
    if chat:
        d = dict(T.merge_answer(T.theme_as_answer(chat["theme"]), d), idea=d["idea"], note=d["note"])
    clean, vnotes = T.finish(d, cat, wh, "follow" if chat else "full", bool(only))
    notes += vnotes
    for m in made:  # a generated part must survive the cleaning, or its files would be orphans
        key = SLOTS[m["slot"]][1]
        if clean.get(key) != m["id"]:
            G.delete(m["id"])
    made = [m for m in made if clean.get(SLOTS[m["slot"]][1]) == m["id"]]
    if chat or not save:
        line, num, existed = L.theme_line(clean), 0, False
    else:
        line, num, existed = L.save_theme(clean)
    parts_n = sum(1 for k in ("s", "c", "w", "m", "wr") if clean[k]) + (1 if (clean["wf"] or clean["wc"]) else 0)
    return {"ok": True, "mode": "invent", "name": clean["n"], "line": line, "number": num, "existed": existed, "notes": notes,
            "note": T.sentence(answer.get("note"), 300), "idea": T.sentence(answer.get("idea"), 300), "parts": parts_n, "usage": usage, "wh": wh,
            "new": made, "fell_back": fell_back, "clean": clean, "provider": ch["provider"], "model": ch.get("model", "")}
