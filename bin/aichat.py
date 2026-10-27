"""aichat: building a theme as a chat (bin/ai-theme chat ...).

One session lives in <state>/chat.json (or <state>/jobs/<id>/chat.json for a background job, see bin/aijobs.py): the picture, the mode (pick or invent), the theme as it is now, the
history and the ids of the effects the chat generated. Every turn goes to the AI with the current theme and the history, the AI answers with
only what changes, the answer goes through the same checks as a first theme (ids must exist, new effects pass the safety gate) and the
result is returned as a theme line to apply live. Nothing is added to the themes list until `chat keep`; `chat discard` removes what the chat
generated. Effects a later turn replaced stay on disk until then (the user may ask to go back), then they are deleted.

Three more things work on the same session (v1.50.0):
  load     `chat load N` opens a saved theme (the user's own or a built-in one; `--line` = the look on now) as a session with no history, flagged
           "loaded": its parts and strengths are the session theme, the base picture is the current wallpaper, the origin number/name is remembered.
  regen    `chat regen SLOTS ["direction"]` makes only the chosen parts again, as a different take (bin/airegen.py, Pick / Quick / Rich); every other
           part comes back byte for byte. The replaced versions go on a per-part stack (`slot_hist`); `chat regen-undo SLOT` takes the last one back.
  keep     a loaded theme is saved either in place (`--replace`, only the user's own themes) or as a new theme (default); a built-in one never in place.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import aigen as G  # noqa: E402
import aiprov as P  # noqa: E402
import aitheme as T  # noqa: E402
import omslib as L  # noqa: E402

MAX_TURNS = 40


def chat_dir():
    """where this session lives: the state folder, or one background job's own folder (OMASHADERS_CHAT_DIR, bin/aijobs.py)"""
    return os.environ.get("OMASHADERS_CHAT_DIR") or L.STATE


def session_path():
    return os.path.join(chat_dir(), "chat.json")


def load():
    try:
        d = json.load(open(session_path()))
        return d if isinstance(d, dict) and d.get("v") == 1 else None
    except (OSError, ValueError):
        return None


def store(s):
    os.makedirs(chat_dir(), exist_ok=True)
    with open(session_path() + ".tmp", "w") as f:
        json.dump(s, f)
    os.replace(session_path() + ".tmp", session_path())


def clear():
    import shutil
    shutil.rmtree(os.path.join(chat_dir(), "rich"), ignore_errors=True)
    try:
        os.remove(session_path())
    except OSError:
        pass


def desc_of(eid):
    try:
        return json.load(open(G.meta_path(eid))).get("desc", "")
    except (OSError, ValueError):
        return ""


def pick_turn(request, s, path, wh, ch, cat):
    """Pick existing: the AI chooses among the effects that exist; a follow-up names only what changes"""
    jpg, facts = T.picture_facts(path) if path else (None, "")
    tags = T.wallhaven_tags(wh) if wh else []
    follow = s.get("theme") is not None   # a loaded theme has no history but is a follow-up all the same
    img_ok = bool(jpg) and P.can_see(ch) and not follow
    if follow:
        prompt = "\n".join([T.catalog_text(cat), "# MODE", T.FOLLOWUP_RULES, T.current_text(s["theme"], desc_of), T.history_text(s["history"]),
                            "# REQUEST", request.strip()] + (["# BASE PICTURE", facts] if facts else []) + ["\nAnswer with the one JSON object only."])
        mode = "follow"
    else:
        mode = "subtle" if s.get("subtle") else "full"
        prompt = T.user_prompt(cat, request, facts, tags, bool(img_ok), mode)
    text, usage = P.call(ch, T.guide_text(), prompt, jpg if img_ok else None)
    answer = T.extract_json(text)
    d = T.merge_answer(T.theme_as_answer(s["theme"]), answer) if follow else answer
    clean, notes = T.finish(d, cat, wh, mode)
    u = {"tokens_in": 0, "tokens_out": 0, "cost_usd": None, "calls": 1, "estimated": False}
    for k in ("tokens_in", "tokens_out", "cost_usd", "estimated"):
        if usage and usage.get(k) is not None:
            u[k] = usage[k]
    return {"ok": True, "mode": "pick", "clean": clean, "notes": notes, "idea": T.sentence(answer.get("idea"), 300), "note": T.sentence(answer.get("note"), 300),
            "usage": u, "new": [], "fell_back": []}


def turn(message, invent=False, wh="", current=False, progress=lambda m: None, new=False, subtle=False, parts=None, rich=False, rounds=None, genre="", surprise=False, sprites=False, only=""):
    """one chat turn -> result dict (line, changes, reply, ...); raises L.Bad for a plain-language failure"""
    message = " ".join(str(message or "").split())[:400]
    if new:
        discard()
    s = load()
    if s is None and only:
        rich, invent = False, True
        if not message:
            raise L.Bad("Describe the effect you want, for example: a slow green pulse")
    if s is None:
        if not message and not wh and not current and not (rich and surprise):
            raise L.Bad("Describe the theme you want, for example: a rainy neon night")
        path = ""
        if wh:
            progress("Setting the Wallhaven picture as the wallpaper…")
            path = T.wallhaven_use(wh)
        elif current:
            path = T.current_background()
            if not path:
                raise L.Bad("I cannot find the current wallpaper")
            import re
            m = re.match(r"wallhaven-([a-z0-9]{6})\.", os.path.basename(path))
            if m:
                wh = m.group(1)
        s = {"v": 1, "mode": "rich" if rich else ("invent" if invent else "pick"), "wh": wh, "path": path, "theme": None, "history": [], "made": [], "turns": 0,
             "usage": {"tokens_in": 0, "tokens_out": 0, "cost_usd": None, "calls": 0}, "subtle": bool(subtle), "parts": parts or {}, "rich": None, "only": only or ""}
    elif not message:
        raise L.Bad("Say what to change, for example: less fog")
    if s["turns"] >= MAX_TURNS:
        raise L.Bad("This chat is long enough; save the theme or start a new one")
    ch = P.choice()
    av = P.availability(ch)
    if not av["available"]:
        raise L.Bad("AI needed. " + av["hint"])
    cat = L.catalog()
    first = s.get("theme") is None   # not "no history": a loaded theme has none and is still a follow-up
    request = message or ("Surprise me" if s["mode"] == "rich" and first and (surprise or not s["path"]) else "(no words; design from the picture)")
    if s["mode"] == "rich":
        import airich
        if first:
            res = airich.run(message, (s.get("parts") or {}), s["path"], s["wh"], ch, rounds=airich.DEFAULT_ROUNDS if rounds is None else rounds,
                             genre=genre, surprise=surprise, progress=progress, save=False, sprites=sprites)
        else:
            res = airich.follow(request, rich_state(s, cat), s["theme"], s["history"], s["path"], s["wh"], ch, progress=progress)
        s["rich"] = res["rich_state"]
    elif s["mode"] == "invent":  # only the first turn paints sprites; a follow-up never sends anything to the image model
        import aiinvent
        chat = None if first else {"theme": s["theme"], "history": s["history"], "desc_of": desc_of}
        res = aiinvent.run(request, (s.get("parts") or {}) if first else {}, s["path"], s["wh"], ch, progress=progress, chat=chat, save=False, sprites=sprites and first,
                           only=s.get("only", ""))
    else:
        progress("Asking the AI…")
        res = pick_turn(request, s, s["path"], s["wh"], ch, cat)
        if sprites and first:
            res["notes"] = list(res.get("notes", [])) + ["Painted sprites: Pick existing uses ready-made effects, so nothing was painted and nothing was sent to your image model. Use Quick or Rich for painted sprites."]
    if first and "clean" not in res:
        raise L.Bad("The AI did not answer with a theme")
    clean = res["clean"]
    changes = T.describe_changes(s["theme"], clean, cat)
    reply = res.get("idea") or res.get("note") or ""
    s["history"] += [{"role": "user", "text": request}, {"role": "ai", "text": reply, "changes": changes}]
    s["theme"] = clean
    s["turns"] += 1
    s["made"] = sorted(set(s["made"]) | {m["id"] for m in res.get("new", [])})
    for k in ("tokens_in", "tokens_out", "calls"):
        s["usage"][k] += res["usage"].get(k) or 0
    if res["usage"].get("cost_usd") is not None:
        s["usage"]["cost_usd"] = round((s["usage"]["cost_usd"] or 0) + res["usage"]["cost_usd"], 4)
    store(s)
    out = {"ok": True, "turn": s["turns"], "mode": s["mode"], "name": clean["n"], "line": L.theme_line(clean), "changes": changes, "reply": reply,
           "note": res.get("note", ""), "notes": res.get("notes", []), "new": res.get("new", []), "fell_back": res.get("fell_back", []),
           "usage": res["usage"], "total": s["usage"], "wh": s["wh"], "provider": ch["provider"], "model": ch.get("model", "")}
    if s.get("only"):
        key = next(k for sl, k, _ in T.CHAT_SLOTS if sl == s["only"])
        out.update(only=s["only"], effect=clean.get(key, ""), name=effect_name(clean.get(key, "")) or clean["n"])
    if s["mode"] == "rich":
        out.update(concept=s["rich"]["concept"], sheet=res.get("sheet", ""), steps=res.get("steps", []), scores=res.get("scores", {}), review=res.get("review", ""),
                   rounds_done=res.get("rounds_done", 0))
    return out


def effect_name(eid):
    try:
        return json.load(open(G.meta_path(eid))).get("name", "")
    except (OSError, ValueError):
        return ""


def used_ids(clean):
    return {clean.get(k, "") for _, k, _ in T.CHAT_SLOTS}


def rich_state(s, cat):
    """the Rich state of the session; a loaded theme has none (nobody planned it), so a stand-in concept is built from the theme and the picture, without an AI call"""
    if s.get("rich"):
        return s["rich"]
    import airich
    import aiinvent
    return {"concept": airich.minimal_concept(s["theme"], cat, aiinvent.palette(s["path"]), desc_of), "pieces": {}, "sheet": ""}


def unused_generated(eid):
    """delete a generated effect the chat made, but never one a saved theme uses"""
    try:
        if G.used_by(eid) == 0:
            G.delete(eid)
            return True
    except L.Bad:
        pass
    return False


def edited_name(name):
    """a name for 'save as a new theme' when the user typed none: the old name with (edited), numbered when that is taken"""
    have = {L.parse_line(l)["n"] for l in L.read_themes()}
    base = (L.clean_name(name, 30) or "Theme") + " (edited)"
    out, k = base, 2
    while out in have:
        out = "%s %d" % (base, k)
        k += 1
    return out


def keep(name="", replace=False):
    """save the chat's theme into the list and keep the generated effects it uses; the others the chat made are deleted (never one a saved theme uses).
    A loaded theme is saved as a NEW theme unless replace=True (its own line is rewritten in place; a built-in theme refuses)."""
    s = load()
    if not s or not s.get("theme"):
        raise L.Bad("There is no theme in this chat yet")
    clean = dict(s["theme"])
    if s.get("only"):
        return keep_effect(s, clean)
    origin = s.get("origin") or {}
    in_place = bool(replace and s.get("loaded"))
    if replace and not s.get("loaded"):
        raise L.Bad("Only a theme opened for editing can be saved in place")
    if in_place and not origin.get("number"):
        raise L.Bad("The look you opened is not a saved theme; save it as a new theme")
    if name:
        clean["n"] = L.clean_name(name) or clean["n"]
    elif s.get("loaded") and not in_place and clean.get("n") == origin.get("name"):
        clean["n"] = edited_name(clean["n"])
    if in_place:
        line, num = L.replace_theme(origin["number"], origin["line"], clean)   # raises for a built-in theme before anything is touched
        existed = False
    else:
        line, num, existed = L.save_theme(clean)
    use = used_ids(clean)
    for eid in s["made"]:
        if eid in use:
            G.keep(eid)
        else:
            unused_generated(eid)
    clear()
    return {"ok": True, "name": clean["n"], "line": line, "number": num, "existed": existed, "kept": sorted(e for e in s["made"] if e in use),
            "replaced": in_place, "origin": origin.get("number", 0)}


def keep_effect(s, clean):
    """a "Create with AI" chat for one effect: the effect is kept as the user's own, no theme is added to the list"""
    key = next(k for sl, k, _ in T.CHAT_SLOTS if sl == s["only"])
    eid = clean.get(key, "")
    if not eid:
        raise L.Bad("There is no effect in this chat yet")
    for made in s["made"]:
        if made == eid:
            G.keep(made)
        else:
            unused_generated(made)
    clear()
    return {"ok": True, "only": s["only"], "effect": eid, "name": effect_name(eid) or eid, "line": "", "number": 0, "existed": False,
            "strength": (clean.get("o") or {}), "new": eid in s["made"]}


def keep_effect(s, clean):
    """a "Create with AI" chat for one effect: the effect is kept as the user's own, no theme is added to the list"""
    key = next(k for sl, k, _ in T.CHAT_SLOTS if sl == s["only"])
    eid = clean.get(key, "")
    if not eid:
        raise L.Bad("There is no effect in this chat yet")
    for made in s["made"]:
        if made == eid:
            G.keep(made)
        else:
            try:
                G.delete(made)
            except L.Bad:
                pass
    clear()
    return {"ok": True, "only": s["only"], "effect": eid, "name": effect_name(eid) or eid, "line": "", "number": 0, "existed": False,
            "strength": (clean.get("o") or {}), "new": eid in s["made"]}


def discard():
    """throw the chat away and delete every effect it generated (nothing was added to the list)"""
    s = load()
    gone = 0
    for eid in (s or {}).get("made", []):
        if unused_generated(eid):
            gone += 1
    clear()
    return {"ok": True, "deleted": gone}


def previous_parts(s):
    """the parts (as the dialog names them) that have an earlier version to go back to"""
    import airegen as RG
    h = s.get("slot_hist") or {}
    return [k for k, _, ss in RG.UI_PARTS if any(h.get(x) for x in ss)]


def status():
    s = load()
    if not s:
        return {"ok": True, "active": False}
    return {"ok": True, "active": True, "mode": s["mode"], "concept": (s.get("rich") or {}).get("concept"), "sheet": (s.get("rich") or {}).get("sheet", ""), "turns": s["turns"], "name": (s["theme"] or {}).get("n", ""), "line": L.theme_line(s["theme"]) if s["theme"] else "",
            "history": s["history"], "made": s["made"], "wh": s["wh"], "loaded": bool(s.get("loaded")), "origin": s.get("origin"), "previous": previous_parts(s)}


# ------------------------------------------------------------------ opening a saved theme
def result_of(s, ch, clean, changes=(), reply="", notes=(), usage=None, new=(), fell_back=(), extra=None):
    """the result dict the dialog and the job runner read (the same keys a chat turn gives)"""
    u = usage or {"tokens_in": 0, "tokens_out": 0, "cost_usd": None, "calls": 0, "estimated": False}
    out = {"ok": True, "turn": s["turns"], "mode": s["mode"], "name": clean["n"], "line": L.theme_line(clean), "changes": list(changes), "reply": reply, "note": "",
           "notes": list(notes), "new": list(new), "fell_back": list(fell_back), "usage": u, "total": s["usage"], "wh": s["wh"], "provider": ch["provider"],
           "model": ch.get("model", ""), "loaded": bool(s.get("loaded")), "origin": s.get("origin"), "previous": previous_parts(s)}
    if s["mode"] == "rich" and s.get("rich"):
        out.update(concept=s["rich"]["concept"], sheet=s["rich"].get("sheet", ""))
    if extra:
        out.update(extra)
    return out


def load_theme(which="", line="", invent=False, rich=False):
    """open a saved theme (`which` = its number in the list) or the look on now (`line`) as a chat session that is flagged loaded: no history, the parts and
    strengths of the theme are the session theme, the picture is the current wallpaper. Replaces an earlier session in this folder."""
    import re
    cat = L.catalog()
    if line:
        src, number = line, 0
    else:
        have = L.read_themes()
        try:
            number = int(which)
        except (TypeError, ValueError):
            raise L.Bad("Name the theme by its number in the list, or give the look on now with --line")
        if not 1 <= number <= len(have):
            raise L.Bad("There is no theme number %s (the list has %d)" % (which, len(have)))
        src = have[number - 1]
    notes = []
    raw = L.parse_line(src)
    clean = L.validate(raw, cat, notes, fuzzy=False)
    if not clean["n"]:
        clean["n"] = L.theme_label(src)[:40]
    if not any(clean[k] for k in ("s", "w", "m", "c", "wf", "wc", "wr")):
        raise L.Bad("That theme has no effects that exist in this version")
    discard()
    path = T.current_background()
    wh = clean["o"].get("wh", "")
    m = re.match(r"wallhaven-([a-z0-9]{6})\.", os.path.basename(path or ""))
    if m:
        wh = m.group(1)
    builtin = bool(number) and L.is_builtin_theme(src) and not L.dev_switch()
    s = {"v": 1, "mode": "rich" if rich else ("invent" if invent else "pick"), "wh": wh, "path": path, "theme": clean, "history": [], "made": [], "turns": 0,
         "usage": {"tokens_in": 0, "tokens_out": 0, "cost_usd": None, "calls": 0}, "subtle": False, "parts": {}, "rich": None, "only": "",
         "loaded": True, "origin": {"number": number, "name": clean["n"], "line": src, "own": bool(number) and not builtin, "builtin": builtin}, "slot_hist": {}}
    store(s)
    ch = P.choice()
    return result_of(s, ch, clean, notes=notes)


# ------------------------------------------------------------------ regenerate chosen parts
def regen(slots_text, direction="", progress=lambda m: None, rounds=None):
    """make only the chosen parts again, as a different take; the rest comes back byte for byte (bin/airegen.py). -> the result dict of a turn"""
    import airegen as RG
    s = load()
    if not s or not s.get("theme"):
        raise L.Bad("There is no theme to regenerate yet")
    if s.get("only"):
        raise L.Bad("Regenerate works on a theme, not on a single new effect")
    if s["turns"] >= MAX_TURNS:
        raise L.Bad("This chat is long enough; save the theme or start a new one")
    slots = RG.parse_slots(slots_text)
    direction = RG.direction_text(direction)
    ch = P.choice()
    av = P.availability(ch)
    if not av["available"]:
        raise L.Bad("AI needed. " + av["hint"])
    cat = L.catalog()
    old = json.loads(json.dumps(s["theme"]))
    hist = s.setdefault("slot_hist", {})
    avoid, exclude = {}, {}
    for slot in slots:
        ids = [old.get(RG.key_of(slot), "")] + [e["id"] for e in reversed(hist.get(slot, []))]
        avoid[slot] = [x for i, x in enumerate(ids) if x and x not in ids[:i]]
        exclude[slot] = list(avoid[slot])
    prior_pieces = json.loads(json.dumps((s.get("rich") or {}).get("pieces", {})))
    mode = s["mode"]
    if mode == "rich":
        import airich
        res = airich.regen(slots, direction, s.get("rich"), s["theme"], s["history"], s["path"], s["wh"], ch, avoid,
                           rounds=airich.DEFAULT_ROUNDS if rounds is None else rounds, progress=progress, desc_of=desc_of)
        s["rich"] = res["rich_state"]
    elif mode == "invent":
        import aiinvent
        chat = {"theme": s["theme"], "history": s["history"], "desc_of": desc_of}
        said = {sl: ["%s (%s)" % (x, desc_of(x)) if desc_of(x) else x for x in avoid[sl]] for sl in slots}
        res = aiinvent.run(direction or "(a different take)", {}, s["path"], s["wh"], ch, progress=progress, chat=chat, save=False,
                           regen={"slots": slots, "avoid": said, "direction": direction, "exclude": exclude})
    else:
        res = RG.pick(s["theme"], s["history"], slots, direction, avoid, s["path"], s["wh"], ch, cat, desc_of, progress=progress)
    clean, lnotes = RG.lock(old, res["clean"], slots)
    changes = T.describe_changes(old, clean, cat)
    for slot in slots:
        key = RG.key_of(slot)
        if clean.get(key, "") != old.get(key, ""):
            e = {"id": old.get(key, ""), "o": (old.get("o") or {}).get(RG.OPT_OF.get(slot, ""))}
            if prior_pieces.get(slot):
                e["piece"] = prior_pieces[slot]
            hist.setdefault(slot, []).append(e)
            del hist[slot][:-RG.MAX_HISTORY]
    if s.get("rich"):  # a stand-in for a part that did not change must not claim a piece that is not on screen
        s["rich"]["pieces"] = {sl: e for sl, e in s["rich"]["pieces"].items() if clean.get(RG.key_of(sl)) == e.get("id")}
    reply = res.get("idea") or res.get("note") or ""
    label = RG.label_of(slots)
    s["history"] += [{"role": "user", "text": "Regenerate: " + label + ((" (" + direction + ")") if direction else ""), "changes": []}, {"role": "ai", "text": reply, "changes": changes}]
    s["theme"] = clean
    s["turns"] += 1
    s["made"] = sorted(set(s["made"]) | {m["id"] for m in res.get("new", [])})
    for k in ("tokens_in", "tokens_out", "calls"):
        s["usage"][k] += res["usage"].get(k) or 0
    if res["usage"].get("cost_usd") is not None:
        s["usage"]["cost_usd"] = round((s["usage"]["cost_usd"] or 0) + res["usage"]["cost_usd"], 4)
    store(s)
    extra = {"regen": {"slots": slots, "label": label, "direction": direction}}
    if mode == "rich":
        extra.update(steps=res.get("steps", []), scores=res.get("scores", {}), review=res.get("review", ""), rounds_done=res.get("rounds_done", 0))
    return result_of(s, ch, clean, changes, reply, list(res.get("notes", [])) + lnotes, res["usage"], res.get("new", []), res.get("fell_back", []), extra)


def regen_undo(slots_text):
    """take back the last regenerated version of the chosen parts (no AI call); the version that is taken away stays on disk until Keep or Discard"""
    import airegen as RG
    s = load()
    if not s or not s.get("theme"):
        raise L.Bad("There is no theme in this chat yet")
    slots = RG.parse_slots(slots_text)
    old = json.loads(json.dumps(s["theme"]))
    clean = json.loads(json.dumps(old))
    hist = s.setdefault("slot_hist", {})
    done = []
    for slot in slots:
        if not hist.get(slot):
            continue
        e = hist[slot].pop()
        key, opt = RG.key_of(slot), RG.OPT_OF.get(slot)
        clean[key] = e["id"]
        if opt:
            if e.get("o") is None:
                clean["o"].pop(opt, None)
            else:
                clean["o"][opt] = e["o"]
        if s.get("rich"):
            if e.get("piece"):
                s["rich"]["pieces"][slot] = e["piece"]
            else:
                s["rich"]["pieces"].pop(slot, None)
        done.append(slot)
    if not done:
        raise L.Bad("There is no earlier version of that part to go back to")
    changes = T.describe_changes(old, clean, L.catalog())
    s["history"] += [{"role": "user", "text": "Previous: " + RG.label_of(done), "changes": []}, {"role": "ai", "text": "Went back to the earlier version.", "changes": changes}]
    s["theme"] = clean
    s["turns"] += 1
    store(s)
    return result_of(s, P.choice(), clean, changes, "Went back to the earlier version of: " + RG.label_of(done) + ".", extra={"regen_undo": done})
