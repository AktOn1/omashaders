"""airich: the "Rich" mode of the AI theme creator (Planner + Builders + Reviewer).

Quick (aiinvent) asks one call for all six parts. Rich works the way a small studio does:
  1. Planner: one call decides the CONCEPT (a place, a moment, a mood, a palette, one playful detail) and writes a BRIEF for every part. It looks at
     the picture. Without words it designs from the picture, or, as "Surprise me", chooses a place of its own.
  2. Builders: one call per part (in parallel where the provider allows), each with the whole concept, its brief, the shared GLSL helper library and
     two finished examples of the same target. Every piece goes through the same mandatory gate as Quick (bin/aigen.py) with the RICH limits.
  3. Reviewer: the passed pieces are rendered offscreen over the user's own picture (bin/aisheet.py: two moments and a moved pointer), the contact sheets
     go to a vision call that scores every part and names concrete fixes. Parts below PASS_SCORE are revised by their Builder; after the last look a part
     below DROP_SCORE is replaced by the closest shipped effect and the user is told.
  4. Follow-ups (Adjuster): one call picks ONE part and what to do with it; only that part's Builder runs again.
Nothing here touches the live desktop. The result carries the concept, the per-part numbers, the cost per step and the path of the contact sheet.
"""
import sys
sys.dont_write_bytecode = True  # a __pycache__ in the plugin folder would make the shell reload the plugin
import concurrent.futures
import glob
import json
import os
import re
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import aigen as G  # noqa: E402
import aiinvent as I  # noqa: E402
import aiprov as P  # noqa: E402
import aisprites as SP  # noqa: E402
import imgprov as IMG  # noqa: E402
import aisheet as S  # noqa: E402
import aitheme as T  # noqa: E402
import omslib as L  # noqa: E402

PASS_SCORE = 7          # a part below this is revised while rounds are left
DROP_SCORE = 4          # a part still below this after the last look is replaced by a shipped effect
DEFAULT_ROUNDS = 2      # revision rounds (each is: Reviewer look, then revise the weak parts); 0 = no Reviewer
MAX_ROUNDS = 3
MAX_REPAIRS = I.MAX_REPAIRS
BUILD_WORKERS = 4
PARTS = ("wallpaper", "screen", "color", "cursor", "window", "frame")
STRENGTH_PARTS = ("screen", "color", "wallpaper", "cursor")
EXAMPLES = os.path.join(L.ROOT, "rich-examples")


def rich_dir():
    """contact sheets of the running piece of work; a background job has its own folder (OMASHADERS_CHAT_DIR) so two jobs never share one"""
    return os.path.join(os.environ.get("OMASHADERS_CHAT_DIR") or L.STATE, "rich")


SHEET_TOKENS = 2000     # one contact sheet as image input
MULTI_IMAGE = ("claude", "codex", "opencode")
FRAME_EXAMPLES = [
    ("quiet warm signature", {"rounding": 14, "border_size": 2, "border_colors": ["ffb457", "ff6a3d"], "border_angle": 45, "shadow_range": 30,
                              "shadow_power": 2, "shadow_color": "ff6a3d66", "border_inactive": "3b6a8f55", "spin": 0}),
    ("cold neon edge", {"rounding": 6, "border_size": 3, "border_colors": ["00e5ff", "7c4dff", "ff4fd8"], "border_angle": 90, "shadow_range": 40,
                        "shadow_power": 3, "shadow_color": "00e5ff55", "border_inactive": "20243a99", "spin": 60}),
]
EXAMPLE_KIND = {"wallpaper": "wallpaper", "cursor": "cursor", "screen": "screen", "window": "window", "color": "color", "window_color": "color"}


def steps_add(steps, usage, step, u):
    I.add_usage(usage, u)
    steps.append({"step": step, "tokens_in": u.get("tokens_in") or 0, "tokens_out": u.get("tokens_out") or 0, "cost_usd": u.get("cost_usd"),
                  "estimated": bool(u.get("estimated"))})


def new_usage():
    return {"tokens_in": 0, "tokens_out": 0, "cost_usd": None, "calls": 0, "estimated": False}


def hex6(v):
    v = str(v or "").strip().lstrip("#").lower()
    return v if re.fullmatch(r"[0-9a-f]{6}", v) else ""


# ------------------------------------------------------------------ 1. the Planner
def titles_in_use(cat):
    out = set()
    for line in L.read_themes() + list(L.starter_lines()):
        try:
            n = L.parse_line(line).get("n")
        except Exception:
            continue
        if n:
            out.add(str(n))
    return out


def planner_prompt(request, genre, surprise, titles, directions, pal, facts, tags, has_image, sprites=False):
    p = ["# REQUEST"]
    if surprise:
        p.append("SURPRISE ME. The user gave no words; choose a specific, vivid, uncommon place and moment of your own."
                 + (" Genre hint (narrows, does not decide): %s." % genre if genre else ""))
        if has_image or pal["main"]:
            p.append("Surprise within what the picture shows.")
    else:
        p.append(request.strip() or "(no words; design from the picture)")
        if genre:
            p.append("Genre hint: %s." % genre)
    if titles:
        p.append("\n# TITLES THE USER ALREADY HAS (never reuse one)\n" + ", ".join(sorted(titles)[:80]))
    d = I.directions_text(directions)
    if d:
        p.append("\n" + d)
    if has_image or pal["main"] or tags or facts:
        p.append("\n# BASE PICTURE (stays the wallpaper)")
        if has_image:
            p.append("The picture is attached. Look at it first and describe where things are in `layout`.")
        if tags:
            p.append("Tags: " + ", ".join(tags))
        if facts:
            p.append(facts)
        if pal["main"]:
            p.append(I.palette_text(pal))
    else:
        p.append("\n# BASE PICTURE\nThere is no picture: invent the place and its palette yourself. The Builders' tests run over a stand-in gradient.")
    if sprites:
        p.append("\n" + SP.planner_text())
    p.append("\nAnswer with the one JSON object only.")
    return "\n".join(p)


def clean_concept(a, pal, titles):
    title = L.clean_name(a.get("title") or a.get("name"), 40) or "Rich theme"
    low = {t.lower() for t in titles}
    n = title
    k = 2
    while n.lower() in low:
        n = "%s %s" % (title, ["II", "III", "IV", "V", "VI"][min(k - 2, 4)])
        k += 1
    c = {"title": n}
    for key, ln in (("biome", 160), ("time_of_day", 120), ("mood", 160), ("story", 420), ("layout", 420), ("motion", 300), ("pointer", 300),
                    ("playful_detail", 300), ("why_you_would_keep_it_on_all_day", 300)):
        c[key] = T.sentence(a.get(key), ln)
    pl = []
    for e in a.get("palette") if isinstance(a.get("palette"), list) else []:
        h = hex6(e.get("hex") if isinstance(e, dict) else e)
        if h and h not in [x["hex"] for x in pl]:
            pl.append({"hex": h, "role": T.sentence(e.get("role") if isinstance(e, dict) else "", 60)})
    if len(pl) < 3:
        for h, _, nm in pal["main"][:5]:
            if h not in [x["hex"] for x in pl]:
                pl.append({"hex": h, "role": nm})
    c["palette"] = pl[:6]
    c["sprites"] = SP.clean_spec(a.get("sprites"))
    c["tags"] = [w for w in (re.sub(r"[^a-z0-9-]", "", str(t).lower()) for t in (a.get("tags") if isinstance(a.get("tags"), list) else [])) if w][:10]
    br = a.get("briefs") if isinstance(a.get("briefs"), dict) else {}
    c["briefs"] = {k: T.sentence(br.get(k), 900) for k in PARTS if T.sentence(br.get(k), 900)}
    st = a.get("strength") if isinstance(a.get("strength"), dict) else {}
    c["strength"] = {}
    for k in STRENGTH_PARTS:
        try:
            c["strength"][k] = max(40, min(100, int(float(st[k]))))
        except (KeyError, TypeError, ValueError):
            pass
    return c


def concept_text(c):
    rows = ["# CONCEPT (the whole theme; all six parts belong to this one place)", "title: " + c["title"]]
    for key in ("biome", "time_of_day", "mood", "story", "layout", "motion", "pointer", "playful_detail", "why_you_would_keep_it_on_all_day"):
        if c.get(key):
            rows.append("%s: %s" % (key, c[key]))
    rows.append("palette (write a colour as C_ followed by the hex): " + ", ".join("C_%s %s" % (e["hex"], e["role"]) for e in c["palette"]))
    return "\n".join(rows)


def run_planner(ch, request, genre, surprise, directions, path, wh, pal, facts, tags, jpg, usage, steps, cat, sprites=False):
    titles = titles_in_use(cat)
    system = T.planner_text()
    has_image = bool(jpg)
    prompt = planner_prompt(request, genre, surprise, titles, directions, pal, facts, tags, has_image, sprites)
    ask = prompt
    for attempt in range(2):
        text, u = P.call(ch, system, ask, jpg if has_image else None)
        steps_add(steps, usage, "Plan", u)
        try:
            a = T.extract_json(text)
            c = clean_concept(a, pal, titles)
            if len(c["briefs"]) < 3:
                raise L.Bad("The plan has fewer than three part briefs")
            return c
        except L.Bad as e:
            if attempt == 1:
                raise
            ask = prompt + "\n\n# PREVIOUS ANSWER WAS REFUSED\n%s. Answer with one JSON object in the exact shape of the guide and nothing else." % e


# ------------------------------------------------------------------ 2. the Builders
def example_files(kind):
    out = []
    for f in sorted(glob.glob(os.path.join(EXAMPLES, kind + "-*.glsl"))):
        t = open(f, encoding="utf-8").read()
        m = re.match(r"// tags: (.*)", t)
        out.append((os.path.basename(f), set((m.group(1) if m else "").split()), t))
    return out


def pick_examples(slot, concept, n=2):
    kind = I.SLOTS[slot][0]
    if kind == "frame":
        return [("frame: " + nm, json.dumps(s)) for nm, s in FRAME_EXAMPLES]
    want = set(concept.get("tags") or []) | set(re.findall(r"[a-z]{4,}", (concept.get("biome", "") + " " + concept["briefs"].get(slot, "")).lower()))
    ranked = sorted(example_files(EXAMPLE_KIND[slot]), key=lambda e: (-len(e[1] & want), e[0]))
    return [(name, text.strip()) for name, _, text in ranked[:n]]


def fallback_ids(slot, cat):
    pool = L.slot_pool(cat, {"screen": "screen", "window": "window", "color": "color", "window_color": "window_color", "wallpaper": "wall", "cursor": "cursor", "frame": "frame"}[slot])
    ids = [k for k in pool if not k.startswith("ai-")]
    if I.SLOTS[slot][0] == "wallpaper":
        light = L.overlay_ids()
        ids = [k for k in ids if k in light]
    return sorted(ids)


def build_prompt(slot, concept, pal, cat, prev=None, fixes=None, sprites=False, different=None, direction=""):
    """different = the version a regenerate replaces ({"code"|"settings"|"desc"}): the Builder is told to make a genuinely other take;
    direction = the user's words for this regenerate (bin/airegen.py)"""
    c = concept
    rows = [concept_text(c), "\n# ALL BRIEFS (what the other parts do, so yours belongs with them)"]
    rows += ["- %s: %s" % (k, v) for k, v in c["briefs"].items()]
    rows.append("\n# YOUR PART: %s (target: %s)\n%s" % (slot, I.SLOTS[slot][0], c["briefs"][slot]))
    if sprites is True and slot == "wallpaper":
        rows.append("\n" + SP.builder_text(c.get("sprites")))
    if slot in c["strength"]:
        rows.append("Test it at `start` %d unless the brief needs a different strength." % c["strength"][slot])
    rows.append("\n# FALLBACK (existing ids of this part; give the closest to your idea as `fallback`)\n" + " ".join(fallback_ids(slot, cat)))
    ex = pick_examples(slot, c)
    if ex:
        rows.append("\n# TWO FINISHED EXAMPLES of this target (they passed the gate; learn the technique and the layering, do not copy their look)")
        for name, code in ex:
            rows.append("## " + name + "\n" + code)
    t = I.palette_text(pal)
    if t:
        rows.append("\n" + t)
    if prev is not None:
        rows.append("\n# YOUR PREVIOUS VERSION (revise it, keep what works)\n" + (prev.get("code") or json.dumps(prev.get("settings") or {})))
    if different:
        rows.append("\n# THE VERSION BEING REPLACED (do not repeat it: make a genuinely different take on the same brief, with another technique, other shapes and another motion)\n"
                    + (different.get("code") or (json.dumps(different["settings"]) if different.get("settings") else "") or different.get("desc") or "(an existing effect)")[:3500])
    if direction:
        rows.append("\n# DIRECTION FROM THE USER (for this piece only)\n" + direction)
    if fixes:
        rows.append("\n# FIXES TO MAKE\n" + "\n".join("- " + f for f in fixes))
    rows.append("\nAnswer with the one JSON object only (the whole piece).")
    return "\n".join(rows)


def refusal_prompt(base, problems, code):
    return (base + "\n\n# THE GATE REFUSED YOUR LAST ANSWER\n" + "\n".join("- " + x for x in problems[:6]) +
            ("\nYour code was:\n" + code[:5000] if code else "") + "\nFix every problem, keep the idea. Answer with the whole piece as one JSON object.")


def make_piece(ch, system, slot, base_prompt, path, keep_out="", repairs=MAX_REPAIRS, sprites=False, atlas="", spec=None):
    """one Builder call + gate + repairs -> (piece or None, [usage], tries, last problems)
    sprites (wallpaper only): True = may draw painted sprites (rendered with `atlas`, or a stand-in when there is none yet); "blank" = sprite() draws nothing"""
    us, ask, last, problems = [], base_prompt, None, []
    for attempt in range(repairs + 1):
        text, u = P.call(ch, system, ask, None)
        us.append(u)
        try:
            kind, val = I.part_of(slot, T.extract_json(text))
        except (L.Bad, ValueError) as e:
            problems = [str(e)]
            ask = base_prompt + "\n\n# YOUR LAST ANSWER WAS NOT USABLE\n%s. Answer with one JSON object in the exact shape." % e
            continue
        if kind != "new":
            problems = ["not a new piece"]
            continue
        last = val
        if slot == "wallpaper" and sprites and not val.get("sprites"):
            val["sprites"] = spec
        r, start = I.gate_part(slot, val, path, keep_out, profile="rich", sprites=sprites, atlas=atlas)
        if r["ok"]:
            return {"slot": slot, "p": val, "built": r["built"], "info": r["info"], "start": start, "tries": attempt + 1,
                    "sprites": sprites if slot == "wallpaper" else False, "atlas": atlas if slot == "wallpaper" else ""}, us, attempt + 1, []
        problems = r["problems"]
        ask = refusal_prompt(base_prompt, problems, val.get("code", ""))
    return None, us, repairs + 1, problems


def pmap(ch, fn, items):
    """run fn over items, in parallel only when the provider allows it"""
    workers = BUILD_WORKERS if P.runs_parallel(ch) else 1
    if workers == 1 or len(items) < 2:
        return [fn(i) for i in items]
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        return list(ex.map(fn, items))


def piece_bytes(piece):
    code = piece["p"].get("code") or json.dumps(piece["p"].get("settings") or {})
    return len(code), len(piece["built"].get("frag") or "")


# ------------------------------------------------------------------ 3. the Reviewer
def reviewer_prompt(concept, pieces, contents, has_picture):
    rows = [concept_text(concept), "\n# BRIEFS AND WHAT WAS BUILT"]
    for slot in PARTS:
        if slot in pieces:
            p = pieces[slot]["p"]
            rows.append("- %s: brief: %s\n  built: %s (%s)" % (slot, concept["briefs"].get(slot, ""), p["name"], p["desc"]))
    rows.append("\nTwo contact sheets are attached. Sheet 1 has: %s. Sheet 2 has: %s." % tuple(", ".join(c) or "nothing" for c in (contents + [[], []])[:2]))
    if not has_picture:
        rows.append("There is no user picture: the renders lie over a stand-in gradient, so judge the pieces, not the picture.")
    rows.append("\nAnswer with the one JSON object only.")
    return "\n".join(rows)


def look(ch, concept, pieces, path, usage, steps, label, progress, out_dir=None):
    """render the contact sheets and ask the Reviewer -> (sheet dict, {slot: {score, seen, fixes}} or {}, summary)"""
    progress("%s: rendering the pieces over your picture…" % label)
    spec = {s: {"built": p["built"], "start": p["start"], "settings": p["p"].get("settings"), "atlas": p.get("atlas") or ""} for s, p in pieces.items()}
    sheet = S.build(spec, path, out_dir or rich_dir(), progress=progress)
    imgs = sheet["images"]
    if not imgs:
        return sheet, {}, ""
    if ch["provider"] not in MULTI_IMAGE:
        imgs = [sheet["whole"]]
    progress("%s: checking the renders…" % label)
    prompt = reviewer_prompt(concept, {s: p for s, p in pieces.items() if s not in sheet["failed"]}, sheet["contents"], bool(path))
    try:
        text, u = P.call(ch, T.reviewer_text(), prompt, imgs)
        steps_add(steps, usage, label + " (review)", u)
        a = T.extract_json(text)
    except L.Bad as e:
        return sheet, {}, "The review did not answer (%s)." % e
    out = {}
    pa = a.get("parts") if isinstance(a.get("parts"), dict) else {}
    for slot in pieces:
        e = pa.get(slot)
        if not isinstance(e, dict):
            continue
        try:
            score = max(0, min(10, int(round(float(e.get("score"))))))
        except (TypeError, ValueError):
            continue
        fixes = [T.sentence(f, 240) for f in (e.get("fixes") if isinstance(e.get("fixes"), list) else []) if T.sentence(f, 240)][:4]
        out[slot] = {"score": score, "seen": T.sentence(e.get("seen"), 240), "fixes": fixes}
    return sheet, out, T.sentence(a.get("summary"), 240)


def reviewer_possible(ch):
    return P.can_see(ch)


# ------------------------------------------------------------------ install + results
def install_piece(slot, piece, request, score=None):
    kind = I.SLOTS[slot][0]
    p = piece["p"]
    eid = G.install(kind, piece["built"], p["name"], p["desc"] or p["name"], request, "", False, atlas=(piece.get("atlas") or None) if piece.get("sprites") is True else None)
    try:
        mp = G.meta_path(eid)
        m = json.load(open(mp))
        cb, fb = piece_bytes(piece)
        m.update({"rich": True, "slot": slot, "bytes_code": cb, "bytes_file": fb})
        if score is not None:
            m["score"] = score
        with open(mp + ".tmp", "w") as f:
            json.dump(m, f)
        os.replace(mp + ".tmp", mp)
    except (OSError, ValueError):
        pass
    return eid


def state_piece(slot, piece, eid, score):
    p = piece["p"]
    return {"id": eid, "name": p["name"], "desc": p["desc"], "start": piece["start"], "fallback": p.get("fallback", ""), "code": p.get("code", ""),
            "settings": p.get("settings"), "score": score, "sprites": piece.get("sprites", False)}


def installed_frag(kind, eid):
    f = os.path.join(G.GEN, G.SUBDIR[kind], eid + (".frame" if kind == "frame" else ".frag"))
    try:
        return open(f, encoding="utf-8").read()
    except OSError:
        return None


def clear_sheet():
    shutil.rmtree(rich_dir(), ignore_errors=True)


def run(request, directions, path, wh, ch, rounds=DEFAULT_ROUNDS, genre="", surprise=False, progress=lambda m: None, keep_out="", save=True, sprites=False):
    """-> result dict; raises L.Bad with a plain reason. save=False (the chat) leaves the theme unsaved; the chat keeps `rich_state`.
    sprites = the user ticked "Painted sprites (uses your image model)": see bin/aisprites.py. The painted atlas lives in a private temporary folder
    for the run and is copied next to the effect when it is installed."""
    sdir = tempfile.mkdtemp(prefix="oms-sprites-") if sprites else ""
    try:
        return _run(request, directions, path, wh, ch, rounds, genre, surprise, progress, keep_out, save, bool(sprites), sdir)
    finally:
        if sdir:
            shutil.rmtree(sdir, ignore_errors=True)


def _run(request, directions, path, wh, ch, rounds, genre, surprise, progress, keep_out, save, sprites, sdir):
    av = P.availability(ch)
    if not av["available"]:
        raise L.Bad("AI needed. " + av["hint"])
    miss = G.render_ready()
    if miss:
        raise L.Bad(miss)
    rounds = max(0, min(MAX_ROUNDS, int(rounds)))
    cat = L.catalog()
    notes = []
    if not P.is_strong(ch):
        notes.append("This AI is marked as not strong enough (a small local model, for example). Rich mode needs a strong model; Quick or Pick existing will work better for it.")
    if not P.runs_parallel(ch):
        notes.append("This AI runs one call at a time, so Rich takes longer.")
    surprise = bool(surprise) or (not request.strip() and not path)
    jpg, facts = T.picture_facts(path) if path else (None, "")
    if jpg and not P.can_see(ch):
        jpg = None
    tags = T.wallhaven_tags(wh) if wh else []
    pal = I.palette(path)
    usage, steps = new_usage(), []
    clear_sheet()

    progress("Planning the place and mood…")
    concept = run_planner(ch, request, genre, surprise, directions, path, wh, pal, facts, tags, jpg, usage, steps, cat, sprites)
    progress("Concept: %s. Making %d parts…" % (concept["title"], len(concept["briefs"])))

    build_sys = T.builder_text()
    slots = [s for s in PARTS if s in concept["briefs"]]
    results = pmap(ch, lambda s: make_piece(ch, build_sys, s, build_prompt(s, concept, pal, cat, sprites=(sprites and s == "wallpaper")), path, keep_out,
                                            sprites=(sprites and s == "wallpaper"), spec=concept.get("sprites")), slots)
    pieces, tries, refused = {}, {}, {}
    for slot, (piece, us, n, problems) in zip(slots, results):
        for u in us:
            steps_add(steps, usage, "Build: " + slot, u)
        tries[slot] = n
        if piece:
            pieces[slot] = piece
        else:
            refused[slot] = problems
    if sprites:
        if "wallpaper" in pieces:   # paint now (once): the Reviewer then sees the real sprites and a revision is gated with them
            wp = pieces["wallpaper"]
            r, atlas, snotes = SP.prepare_wall(wp["p"], IMG.choice(), path, wp["start"], sdir, "rich", os.path.join(keep_out, "wallpaper") if keep_out else "", progress, ch)
            notes += snotes
            if r["ok"]:
                pieces["wallpaper"] = dict(wp, built=r["built"], info=r["info"], sprites=True if atlas else "blank", atlas=atlas)
            else:
                del pieces["wallpaper"]
                refused["wallpaper"] = r["problems"]
        else:
            notes.append(SP.NOT_PAINTED)
    scores, fixes_of, revisions, seen = {}, {}, {s: 0 for s in slots}, {}
    history = {s: [(p, None)] for s, p in pieces.items()}
    rounds_done, review_summary, sheet = 0, "", None
    built_for = None

    if rounds > 0 and pieces and reviewer_possible(ch):
        for rnd in range(rounds + 1):
            label = "Look %d" % (rnd + 1)
            sheet, got, review_summary = look(ch, concept, pieces, path, usage, steps, label, progress)
            built_for = {s: id(p) for s, p in pieces.items()}
            if not got:
                notes.append(review_summary or "The review gave no scores; the pieces are kept as the gate passed them.")
                break
            for slot, e in got.items():
                scores[slot], seen[slot], fixes_of[slot] = e["score"], e["seen"], e["fixes"]
                history[slot][-1] = (history[slot][-1][0], e["score"])
                prev = [sc for _, sc in history[slot][:-1] if sc is not None]
                if prev and e["score"] < max(prev):  # a revision that scored lower: go back to the best earlier version
                    best = max((h for h in history[slot][:-1] if h[1] is not None), key=lambda h: h[1])
                    pieces[slot] = best[0]
                    scores[slot] = best[1]
                    notes.append("%s: the revision scored lower (%d against %d), so I kept the earlier version." % (I.TITLE[slot], e["score"], best[1]))
            weak = [s for s in pieces if scores.get(s, 10) < PASS_SCORE]
            if rnd == rounds or not weak:
                break
            weak = [s for s in weak if history[s][-1][0] is pieces[s]]  # not those just reverted
            if not weak:
                break
            progress("%s: revising %s…" % (label, ", ".join(weak)))
            rounds_done += 1
            outs = pmap(ch, lambda s: make_piece(ch, build_sys, s, build_prompt(s, concept, pal, cat, prev=pieces[s]["p"], fixes=fixes_of.get(s), sprites=pieces[s].get("sprites", False)),
                                                 path, keep_out, 1, sprites=pieces[s].get("sprites", False), atlas=pieces[s].get("atlas", ""), spec=concept.get("sprites")), weak)
            for slot, (piece, us, n, problems) in zip(weak, outs):
                for u in us:
                    steps_add(steps, usage, "Revise: " + slot, u)
                tries[slot] += n
                if piece:
                    pieces[slot] = piece
                    history[slot].append((piece, None))
                    revisions[slot] += 1
                else:
                    notes.append("%s: the revision did not pass the safety check, so I kept the earlier version." % I.TITLE[slot])
    elif rounds > 0 and pieces:
        notes.append("This AI cannot look at pictures, so the renders were not reviewed; the pieces are kept as the gate passed them.")

    # a part the Reviewer still scores very low goes; so does one the gate refused
    fell_back = []
    for slot in list(pieces):
        if scores.get(slot, 10) < DROP_SCORE:
            refused[slot] = ["the review scored it %d of 10: %s" % (scores[slot], seen.get(slot) or "too weak")]
            del pieces[slot]
    chosen, replaced = {}, {}
    for slot in slots:
        if slot in pieces:
            continue
        p = dict(history[slot][-1][0]["p"]) if slot in history else {"name": I.TITLE[slot], "desc": "", "fallback": ""}
        words = " ".join([p.get("desc", ""), concept["briefs"].get(slot, ""), concept.get("biome", ""), concept.get("mood", ""), " ".join(concept["tags"])])
        alt = I.closest_existing(slot, dict(p, desc=words), cat)
        reason = (refused.get(slot) or ["it did not pass"])[0]
        replaced[slot] = alt
        fell_back.append({"slot": slot, "title": I.TITLE[slot], "name": p["name"], "reason": reason, "used": alt, "problems": refused.get(slot, [])})
        notes.append("%s: the new effect “%s” was not good enough (%s)%s." %
                     (I.TITLE[slot], p["name"], reason[:140], (", so I used the shipped “%s” instead" % alt) if alt else ", so that part is left off"))
        if alt:
            chosen[slot] = alt

    if pieces and (sheet is None or built_for != {s: id(p) for s, p in pieces.items()}):
        progress("Rendering the contact sheet…")
        sheet = S.build({s: {"built": p["built"], "start": p["start"], "settings": p["p"].get("settings"), "atlas": p.get("atlas") or ""} for s, p in pieces.items()}, path, rich_dir())

    made, state_pieces = [], {}
    for slot, piece in pieces.items():
        eid = install_piece(slot, piece, request, scores.get(slot))
        chosen[slot] = eid
        cb, fb = piece_bytes(piece)
        p = piece["p"]
        made.append({"slot": slot, "title": I.TITLE[slot], "id": eid, "name": p["name"], "desc": p["desc"], "tries": tries.get(slot, 1), "start": piece["start"],
                     "info": piece["info"], "score": scores.get(slot), "seen": seen.get(slot, ""), "fixes": fixes_of.get(slot, []), "revisions": revisions.get(slot, 0),
                     "bytes_code": cb, "bytes_file": fb})
        state_pieces[slot] = state_piece(slot, piece, eid, scores.get(slot))

    d = {"name": concept["title"], "idea": concept["story"], "note": concept["why_you_would_keep_it_on_all_day"], "strength": {}}
    for slot in I.SLOTS:
        d[slot] = chosen.get(slot, "")
    for slot in STRENGTH_PARTS:
        if slot in pieces:
            d["strength"][slot] = pieces[slot]["start"]
        elif slot in concept["strength"] and chosen.get(slot):
            d["strength"][slot] = concept["strength"][slot]
    cat = L.catalog()
    clean, vnotes = T.finish(d, cat, wh, "full")
    notes += vnotes
    for m in list(made):
        if clean.get(I.SLOTS[m["slot"]][1]) != m["id"]:
            G.delete(m["id"])
            made.remove(m)
            state_pieces.pop(m["slot"], None)
    if save:
        line, num, existed = L.save_theme(clean)
    else:
        line, num, existed = L.theme_line(clean), 0, False
    parts_n = sum(1 for k in ("s", "c", "w", "m", "wr") if clean[k]) + (1 if (clean["wf"] or clean["wc"]) else 0)
    sheet_path = (sheet or {}).get("sheet", "") if pieces else ""
    if (sheet or {}).get("failed"):
        notes += ["The preview of the %s could not be rendered (%s)." % (I.TITLE[k].lower(), v) for k, v in sheet["failed"].items()]
    return {"ok": True, "mode": "rich", "name": clean["n"], "line": line, "number": num, "existed": existed, "notes": notes,
            "note": T.sentence(concept["why_you_would_keep_it_on_all_day"], 300), "idea": T.sentence(concept["story"], 300), "parts": parts_n, "usage": usage,
            "wh": wh, "new": made, "fell_back": fell_back, "clean": clean, "provider": ch["provider"], "model": ch.get("model", ""),
            "concept": concept, "sheet": sheet_path, "scores": scores, "steps": steps, "rounds_done": rounds_done, "review": review_summary, "surprise": surprise,
            "rich_state": {"concept": concept, "pieces": state_pieces, "sheet": sheet_path}}


# ------------------------------------------------------------------ 4. a follow-up changes ONE part
def adjuster_prompt(rs, theme, history, request, cat):
    c = rs["concept"]
    rows = [concept_text(c), "\n# CURRENT PARTS (what is on the user's screen)"]
    for slot, _, _ in T.CHAT_SLOTS:
        key = I.SLOTS[slot][1]
        v = theme.get(key, "")
        if not v:
            continue
        brief = c["briefs"].get(slot, "")
        rows.append("- %s: %s%s" % (slot, v, (" | brief: " + brief) if brief and slot in rs["pieces"] and rs["pieces"][slot]["id"] == v else ""))
    st = {slot: theme["o"][opt] for slot, opt in T.CHAT_STRENGTH if opt in (theme.get("o") or {})}
    rows.append("strengths: " + json.dumps(st))
    rows.append("\n# EXISTING IDS (for action existing)")
    for slot in PARTS:
        rows.append("%s: %s" % (slot, " ".join(fallback_ids(slot, cat))))
    h = T.history_text(history)
    if h:
        rows.append("\n" + h)
    rows.append("\n# REQUEST\n" + request.strip() + "\n\nYou are the Adjuster (see 'Changing one part later'). Answer with the one JSON object only.")
    return "\n".join(rows)


def follow(request, rs, theme, history, path, wh, ch, progress=lambda m: None, keep_out=""):
    """one Adjuster call, then the Builder of ONE part -> result dict with the new theme in `clean` and the updated `rich_state`"""
    cat = L.catalog()
    usage, steps, notes = new_usage(), [], []
    progress("Working out what to change…")
    text, u = P.call(ch, T.planner_text(), adjuster_prompt(rs, theme, history, request, cat), None)
    steps_add(steps, usage, "Adjust", u)
    a = T.extract_json(text)
    slot = str(a.get("part") or "").strip().lower()
    action = str(a.get("action") or "").strip().lower()
    reply = T.sentence(a.get("reply"), 300)
    rs = json.loads(json.dumps(rs))
    d, made, fell_back = {}, [], []
    if slot not in PARTS and slot not in ("window_color",):
        raise L.Bad("I could not tell which part to change. Name one: wallpaper, screen, color, cursor, window or frame")
    if action == "rewrite" and slot in PARTS:
        brief = T.sentence(a.get("brief"), 900) or rs["concept"]["briefs"].get(slot, "")
        rs["concept"]["briefs"][slot] = brief
        old = rs["pieces"].get(slot)
        prev = {"code": old["code"], "settings": old["settings"]} if old else None
        miss = G.render_ready()
        if miss:
            raise L.Bad(miss)
        progress("Rebuilding the %s…" % I.TITLE[slot].lower())
        pal = I.palette(path)
        mode, atlas = (old.get("sprites", False) if (old and slot == "wallpaper") else False), ""   # a rewrite keeps the sprites already painted; it never paints again
        if mode is True:
            atlas = os.path.join(G.GEN, G.SUBDIR["wallpaper"], old["id"] + ".png")
            if not os.path.isfile(atlas):
                mode, atlas = "blank", ""
        piece, us, n, problems = make_piece(ch, T.builder_text(), slot, build_prompt(slot, rs["concept"], pal, cat, prev=prev, fixes=[request.strip()], sprites=mode), path, keep_out,
                                            sprites=mode, atlas=atlas, spec=rs["concept"].get("sprites"))
        for x in us:
            steps_add(steps, usage, "Build: " + slot, x)
        if piece:
            eid = install_piece(slot, piece, request)
            cb, fb = piece_bytes(piece)
            p = piece["p"]
            made.append({"slot": slot, "title": I.TITLE[slot], "id": eid, "name": p["name"], "desc": p["desc"], "tries": n, "start": piece["start"], "info": piece["info"],
                         "score": None, "seen": "", "fixes": [], "revisions": 0, "bytes_code": cb, "bytes_file": fb})
            rs["pieces"][slot] = state_piece(slot, piece, eid, None)
            d = {slot: eid, "strength": {slot: piece["start"]}} if slot in STRENGTH_PARTS else {slot: eid}
        else:
            reason = (problems or ["it did not pass"])[0]
            notes.append("%s: the rebuilt effect did not pass the safety check (%s), so nothing changed." % (I.TITLE[slot], reason[:140]))
            fell_back.append({"slot": slot, "title": I.TITLE[slot], "name": I.TITLE[slot], "reason": reason, "used": theme.get(I.SLOTS[slot][1], ""), "problems": problems})
    elif action == "strength":
        try:
            n = max(30, min(100, int(float(a.get("strength")))))
        except (TypeError, ValueError):
            raise L.Bad("The change step did not give a strength")
        if slot not in STRENGTH_PARTS:
            raise L.Bad("The %s has no strength to change" % slot)
        d = {"strength": {slot: n}}
    elif action == "remove":
        d = {slot: ""}
    elif action == "existing":
        eid = str(a.get("existing") or "").strip()
        d = {slot: eid}
    else:
        raise L.Bad("The change step did not give a usable action")
    cur = T.theme_as_answer(theme)
    clean, vnotes = T.finish(T.merge_answer(cur, d), L.catalog(), wh, "follow")
    notes += vnotes
    for m in list(made):
        if clean.get(I.SLOTS[m["slot"]][1]) != m["id"]:
            G.delete(m["id"])
            made.remove(m)
    pieces = {}
    for s, e in rs["pieces"].items():
        if clean.get(I.SLOTS[s][1]) == e["id"]:
            pieces[s] = e
    rs["pieces"] = pieces
    sheet_path = ""
    if made or pieces:
        spec = {}
        for s, e in pieces.items():
            kind = I.SLOTS[s][0]
            if e.get("code"):
                sp = e.get("sprites", False) if kind == "wallpaper" else False
                built = G.build(kind, e["code"], e.get("desc", ""), e["start"], e.get("name", ""), rich=True, sprites=sp)
            else:
                frag = installed_frag(kind, e["id"])
                built = {"frag": frag} if frag is not None else None
            if built is not None:
                atlas = os.path.join(G.GEN, G.SUBDIR["wallpaper"], e["id"] + ".png") if (s == "wallpaper" and e.get("sprites") is True) else ""
                spec[s] = {"built": built, "start": e["start"], "settings": e.get("settings"), "atlas": atlas if atlas and os.path.isfile(atlas) else ""}
        if spec:
            progress("Rendering the contact sheet…")
            sheet = S.build(spec, path, rich_dir())
            sheet_path = sheet.get("sheet", "")
    rs["sheet"] = sheet_path
    return {"ok": True, "mode": "rich", "name": clean["n"], "clean": clean, "notes": notes, "note": "", "idea": reply, "usage": usage, "new": made,
            "fell_back": fell_back, "sheet": sheet_path, "steps": steps, "rich_state": rs, "part": slot, "action": action}


# ------------------------------------------------------------------ 5. regenerate chosen parts (bin/airegen.py)
BRIEF_FALLBACK = {
    "wallpaper": "a light overlay on the picture that moves with time and reacts to the pointer",
    "screen": "a full-screen effect that suits the mood without hiding text",
    "color": "a colour grade for the whole screen that suits the palette",
    "cursor": "a small cursor effect that suits the story",
    "window": "a window effect (the window surface) that suits the mood",
    "window_color": "a colour grade for the window surfaces that goes with the rest",
    "frame": "a window border (colours, rounding, glow) that suits the palette",
}


def minimal_concept(theme, cat, pal, desc_of=None, title=""):
    """A stand-in Planner result for a theme the AI did not plan (a saved theme opened for editing): the name, what each current part is and
    does (its catalog hint or its description) and the picture's measured palette. No AI call is made for it."""
    names = {"wallpaper": "wall", "screen": "screen", "color": "color", "cursor": "mouse", "window": "winfx", "window_color": "color", "frame": "frame"}
    briefs, have = {}, []
    for slot in ("wallpaper", "screen", "color", "cursor", "window", "window_color", "frame"):
        v = theme.get(I.SLOTS[slot][1], "")
        if not v:
            continue
        hint = (desc_of(v) if desc_of else "") or (cat.get(names[slot], {}).get(v) or cat.get("screen", {}).get(v) or {}).get("hint", "")
        briefs[slot] = T.sentence("keep the spirit of the current %s \"%s\"%s" % (I.TITLE[slot].lower(), v, (": " + hint) if hint else ""), 900)
        have.append("%s %s" % (slot, v))
    pl = [{"hex": h, "role": nm} for h, _, nm in pal["main"][:5]]
    name = title or theme.get("n") or "Edited theme"
    st = {}
    for slot, opt in T.CHAT_STRENGTH:
        if opt in (theme.get("o") or {}):
            st[slot] = max(40, int(theme["o"][opt]))
    return {"title": name, "biome": "", "time_of_day": "", "mood": "", "story": T.sentence("The user's existing theme \"%s\" (%s)." % (name, "; ".join(have) or "no parts"), 420),
            "layout": "", "motion": "", "pointer": "", "playful_detail": "", "why_you_would_keep_it_on_all_day": "", "palette": pl, "sprites": SP.clean_spec(None),
            "tags": [], "briefs": briefs, "strength": st}


def regen(slots, direction, rs, theme, history, path, wh, ch, avoid, rounds=DEFAULT_ROUNDS, progress=lambda m: None, keep_out="", desc_of=None):
    """Make the chosen parts again with their Builders (in parallel where the provider allows), then let the Reviewer look at those pieces only.
    rs = the stored rich_state, or None (a theme opened for editing: the concept is then built by minimal_concept, no Planner call).
    avoid = {slot: [ids of versions not to use again]}. Returns the same shape as follow(); the caller locks every other part."""
    av = P.availability(ch)
    if not av["available"]:
        raise L.Bad("AI needed. " + av["hint"])
    miss = G.render_ready()
    if miss:
        raise L.Bad(miss)
    rounds = max(0, min(MAX_ROUNDS, int(rounds)))
    cat = L.catalog()
    usage, steps, notes = new_usage(), [], []
    pal = I.palette(path)
    rs = json.loads(json.dumps(rs)) if rs else {"concept": minimal_concept(theme, cat, pal, desc_of), "pieces": {}, "sheet": ""}
    concept = rs["concept"]
    direction = T.sentence(direction, 400)
    for slot in slots:
        if slot not in concept["briefs"]:
            concept["briefs"][slot] = BRIEF_FALLBACK[slot]
    build_sys = T.builder_text()

    def different_of(slot):
        old = rs["pieces"].get(slot)
        cur = theme.get(I.SLOTS[slot][1], "")
        if old and old.get("id") == cur and (old.get("code") or old.get("settings")):
            return {"code": old.get("code", ""), "settings": old.get("settings")}
        if cur:
            return {"desc": (desc_of(cur) if desc_of else "") or "the existing effect " + cur}
        return None

    progress("Making %d part%s again…" % (len(slots), "" if len(slots) == 1 else "s"))
    results = pmap(ch, lambda s: make_piece(ch, build_sys, s, build_prompt(s, concept, pal, cat, different=different_of(s), direction=direction), path, keep_out), slots)
    pieces, tries, refused = {}, {}, {}
    for slot, (piece, us, n, problems) in zip(slots, results):
        for u in us:
            steps_add(steps, usage, "Build: " + slot, u)
        tries[slot] = n
        if piece:
            pieces[slot] = piece
        else:
            refused[slot] = problems
    scores, fixes_of, seen, revisions = {}, {}, {}, {s: 0 for s in slots}
    history_of = {s: [(p, None)] for s, p in pieces.items()}
    rounds_done, review_summary, sheet = 0, "", None
    seeable = lambda: {s: p for s, p in pieces.items() if s in S.ROW_NAMES}
    if rounds > 0 and seeable() and reviewer_possible(ch):
        built_for = None
        for rnd in range(rounds + 1):
            label = "Look %d" % (rnd + 1)
            sheet, got, review_summary = look(ch, concept, seeable(), path, usage, steps, label, progress)
            built_for = {s: id(p) for s, p in seeable().items()}
            if not got:
                notes.append(review_summary or "The review gave no scores; the pieces are kept as the gate passed them.")
                break
            for slot, e in got.items():
                scores[slot], seen[slot], fixes_of[slot] = e["score"], e["seen"], e["fixes"]
                history_of[slot][-1] = (history_of[slot][-1][0], e["score"])
                prev = [sc for _, sc in history_of[slot][:-1] if sc is not None]
                if prev and e["score"] < max(prev):
                    best = max((h for h in history_of[slot][:-1] if h[1] is not None), key=lambda h: h[1])
                    pieces[slot] = best[0]
                    scores[slot] = best[1]
            weak = [s for s in seeable() if scores.get(s, 10) < PASS_SCORE and history_of[s][-1][0] is pieces[s]]
            if rnd == rounds or not weak:
                break
            progress("%s: revising %s…" % (label, ", ".join(weak)))
            rounds_done += 1
            outs = pmap(ch, lambda s: make_piece(ch, build_sys, s, build_prompt(s, concept, pal, cat, prev=pieces[s]["p"], fixes=fixes_of.get(s), different=different_of(s), direction=direction),
                                                 path, keep_out, 1), weak)
            for slot, (piece, us, n, problems) in zip(weak, outs):
                for u in us:
                    steps_add(steps, usage, "Revise: " + slot, u)
                tries[slot] += n
                if piece:
                    pieces[slot] = piece
                    history_of[slot].append((piece, None))
                    revisions[slot] += 1
                else:
                    notes.append("%s: the revision did not pass the safety check, so I kept the earlier version." % I.TITLE[slot])
        if sheet is not None and built_for != {s: id(p) for s, p in seeable().items()}:
            sheet = None
    elif rounds > 0 and pieces:
        notes.append("This AI cannot look at pictures, so the renders were not reviewed; the pieces are kept as the gate passed them." if not reviewer_possible(ch)
                     else "These parts have no preview to review; they are kept as the gate passed them.")
    if "window_color" in pieces and rounds > 0:
        notes.append("The window colour has no preview picture, so the Reviewer did not look at it; it passed the safety check.")
    fell_back, d, made = [], {}, []
    for slot in list(pieces):
        if scores.get(slot, 10) < DROP_SCORE:
            refused[slot] = ["the review scored it %d of 10: %s" % (scores[slot], seen.get(slot) or "too weak")]
            del pieces[slot]
            sheet = None
    for slot in slots:
        if slot in pieces:
            continue
        p = dict(history_of[slot][-1][0]["p"]) if slot in history_of else {"name": I.TITLE[slot], "desc": "", "fallback": ""}
        words = " ".join([p.get("desc", ""), concept["briefs"].get(slot, ""), direction])
        alt = I.closest_existing(slot, dict(p, desc=words), cat, set(avoid.get(slot, [])) | {theme.get(I.SLOTS[slot][1], "")})
        reason = (refused.get(slot) or ["it did not pass"])[0]
        fell_back.append({"slot": slot, "title": I.TITLE[slot], "name": p["name"], "reason": reason, "used": alt, "problems": refused.get(slot, [])})
        notes.append("%s: the new effect “%s” was not good enough (%s)%s." % (I.TITLE[slot], p["name"], reason[:140],
                     (", so I used the shipped “%s” instead" % alt) if alt else ", so that part stays as it was"))
        if alt:
            d[slot] = alt
    strength = {}
    for slot, piece in pieces.items():
        eid = install_piece(slot, piece, direction or "regenerate", scores.get(slot))
        d[slot] = eid
        cb, fb = piece_bytes(piece)
        p = piece["p"]
        made.append({"slot": slot, "title": I.TITLE[slot], "id": eid, "name": p["name"], "desc": p["desc"], "tries": tries.get(slot, 1), "start": piece["start"],
                     "info": piece["info"], "score": scores.get(slot), "seen": seen.get(slot, ""), "fixes": fixes_of.get(slot, []), "revisions": revisions.get(slot, 0),
                     "bytes_code": cb, "bytes_file": fb})
        rs["pieces"][slot] = state_piece(slot, piece, eid, scores.get(slot))
        if slot in STRENGTH_PARTS:
            strength[slot] = piece["start"]
    if strength:
        d["strength"] = strength
    cur = T.theme_as_answer(theme)
    clean, vnotes = T.finish(T.merge_answer(cur, d), L.catalog(), wh, "follow")
    notes += vnotes
    for m in list(made):
        if clean.get(I.SLOTS[m["slot"]][1]) != m["id"]:
            G.delete(m["id"])
            made.remove(m)
            rs["pieces"].pop(m["slot"], None)
    keep_pieces = {}
    for s2, e in rs["pieces"].items():
        if clean.get(I.SLOTS[s2][1]) == e["id"]:
            keep_pieces[s2] = e
    rs["pieces"] = keep_pieces
    sheet_path = ""
    shown = {s: p for s, p in pieces.items() if s in S.ROW_NAMES and rs["pieces"].get(s, {}).get("id") == d.get(s)}
    if shown:
        if sheet is None or not sheet.get("sheet"):
            progress("Rendering the contact sheet…")
            sheet = S.build({s: {"built": p["built"], "start": p["start"], "settings": p["p"].get("settings"), "atlas": ""} for s, p in shown.items()}, path, rich_dir())
        sheet_path = sheet.get("sheet", "")
    rs["sheet"] = sheet_path
    return {"ok": True, "mode": "rich", "name": clean["n"], "clean": clean, "notes": notes, "note": "", "idea": T.sentence("New take on: " + ", ".join(I.TITLE[s].lower() for s in slots), 300),
            "usage": usage, "new": made, "fell_back": fell_back, "sheet": sheet_path, "steps": steps, "rich_state": rs, "scores": scores, "review": review_summary,
            "rounds_done": rounds_done, "provider": ch["provider"], "model": ch.get("model", "")}


# ------------------------------------------------------------------ estimate
def estimate(request, path, ch=None, cat=None, rounds=DEFAULT_ROUNDS, genre="", sprites=False):
    """what a Rich run is expected to cost, from the real prompt sizes; the real numbers come back with the result"""
    ch = ch or P.choice()
    cat = cat or L.catalog()
    has_img = bool(path and P.can_see(ch))
    pal = I.palette(path) if path else {"main": [], "accents": []}
    img = I.IMAGE_TOKENS if has_img else 0
    dprompt = planner_prompt(request, genre, not request.strip() and not path, set(), {}, pal, "", [], has_img, sprites)
    d_in = (len(T.planner_text()) + len(dprompt)) // 4 + 500 + img   # + titles in use
    d_out = 2400
    fake = {"title": "x", "tags": [], "briefs": {k: "x" * 500 for k in PARTS}, "palette": [{"hex": "000000", "role": "x"}] * 5, "strength": {}, "biome": "", "layout": "x" * 300}
    m_in = (len(T.builder_text()) + len(build_prompt("wallpaper", fake, pal, cat)) + 1600) // 4 + 2500   # + 2 shipped examples, GLSL helpers
    m_out = 2500
    n_code, n_frame = 6, 1   # 5 code parts + about one repair try
    looks = 0
    cr_in = cr_out = rev = 0
    if rounds > 0 and reviewer_possible(ch):
        looks = rounds + 1
        cr_in = looks * ((len(T.reviewer_text()) + 3500) // 4 + 2 * SHEET_TOKENS)
        cr_out = looks * 1400
        rev = rounds * 3
    t_in = d_in + n_code * m_in + n_frame * (m_in // 2) + cr_in + rev * (m_in + 1500)
    t_out = d_out + n_code * m_out + n_frame * 300 + cr_out + rev * 2800
    calls = 1 + n_code + n_frame + looks + rev
    if sprites:
        t_in += len(SP.builder_text(None)) // 4
    est = {"sprite_images": SP.CELLS if sprites else 0, "tokens_in": t_in, "tokens_out": t_out, "calls": calls, "rounds": rounds, "cost_usd": None, "note": "", "parallel": P.runs_parallel(ch),
           "review": looks > 0}
    pr = I.PRICES.get(ch.get("model")) if ch["provider"] == "claude" else None
    if pr:
        est["cost_usd"] = round((t_in * pr[0] + t_out * pr[1]) / 1e6, 2)
    elif ch["provider"] == "ollama":
        est["note"] = "local: no cost, only time"
    else:
        est["note"] = "price depends on your plan"
    tok = t_in + t_out
    est["summary"] = "Rich: about %dk tokens%s, %d calls" % (round(tok / 1000.0), (", about $%.2f" % est["cost_usd"]) if est["cost_usd"] is not None else "", calls)
    if sprites:
        est["summary"] += ", plus %d pictures from your image model" % SP.CELLS
    return est
