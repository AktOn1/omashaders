"""aichat: building a theme as a chat (bin/ai-theme chat ...).

One session lives in <state>/chat.json (or <state>/jobs/<id>/chat.json for a background job, see bin/aijobs.py): the picture, the mode (pick or invent), the theme as it is now, the
history and the ids of the effects the chat generated. Every turn goes to the AI with the current theme and the history, the AI answers with
only what changes, the answer goes through the same checks as a first theme (ids must exist, new effects pass the safety gate) and the
result is returned as a theme line to apply live. Nothing is added to the themes list until `chat keep`; `chat discard` removes what the chat
generated. Effects a later turn replaced stay on disk until then (the user may ask to go back), then they are deleted.
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
    img_ok = bool(jpg) and (P.info_of(ch["provider"]).get("image") or ch["provider"] == "custom") and not s["history"]
    if s["history"]:
        prompt = "\n".join([T.catalog_text(cat), "# MODE", T.FOLLOWUP_RULES, T.current_text(s["theme"], desc_of), T.history_text(s["history"]),
                            "# REQUEST", request.strip()] + (["# BASE PICTURE", facts] if facts else []) + ["\nAnswer with the one JSON object only."])
        mode = "follow"
    else:
        mode = "subtle" if s.get("subtle") else "full"
        prompt = T.user_prompt(cat, request, facts, tags, bool(img_ok), mode)
    text, usage = P.call(ch, T.guide_text(), prompt, jpg if img_ok else None)
    answer = T.extract_json(text)
    d = T.merge_answer(T.theme_as_answer(s["theme"]), answer) if s["history"] else answer
    clean, notes = T.finish(d, cat, wh, mode)
    u = {"tokens_in": 0, "tokens_out": 0, "cost_usd": None, "calls": 1, "estimated": False}
    for k in ("tokens_in", "tokens_out", "cost_usd", "estimated"):
        if usage and usage.get(k) is not None:
            u[k] = usage[k]
    return {"ok": True, "mode": "pick", "clean": clean, "notes": notes, "idea": T.sentence(answer.get("idea"), 300), "note": T.sentence(answer.get("note"), 300),
            "usage": u, "new": [], "fell_back": []}


def turn(message, invent=False, wh="", current=False, progress=lambda m: None, new=False, subtle=False, parts=None, rich=False, rounds=None, genre="", surprise=False):
    """one chat turn -> result dict (line, changes, reply, ...); raises L.Bad for a plain-language failure"""
    message = " ".join(str(message or "").split())[:400]
    if new:
        discard()
    s = load()
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
             "usage": {"tokens_in": 0, "tokens_out": 0, "cost_usd": None, "calls": 0}, "subtle": bool(subtle), "parts": parts or {}, "rich": None}
    elif not message:
        raise L.Bad("Say what to change, for example: less fog")
    if s["turns"] >= MAX_TURNS:
        raise L.Bad("This chat is long enough; save the theme or start a new one")
    ch = P.choice()
    av = P.availability(ch)
    if not av["available"]:
        raise L.Bad("AI needed. " + av["hint"])
    cat = L.catalog()
    first = not s["history"]
    request = message or ("Surprise me" if s["mode"] == "rich" and first and (surprise or not s["path"]) else "(no words; design from the picture)")
    if s["mode"] == "rich":
        import airich
        if first:
            res = airich.run(message, (s.get("parts") or {}), s["path"], s["wh"], ch, rounds=airich.DEFAULT_ROUNDS if rounds is None else rounds,
                             genre=genre, surprise=surprise, progress=progress, save=False)
        else:
            if not s.get("rich"):
                raise L.Bad("This Rich chat has no theme yet")
            res = airich.follow(request, s["rich"], s["theme"], s["history"], s["path"], s["wh"], ch, progress=progress)
        s["rich"] = res["rich_state"]
    elif s["mode"] == "invent":
        import aiinvent
        chat = None if first else {"theme": s["theme"], "history": s["history"], "desc_of": desc_of}
        res = aiinvent.run(request, (s.get("parts") or {}) if first else {}, s["path"], s["wh"], ch, progress=progress, chat=chat, save=False)
    else:
        progress("Asking the AI…")
        res = pick_turn(request, s, s["path"], s["wh"], ch, cat)
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
    if s["mode"] == "rich":
        out.update(concept=s["rich"]["concept"], sheet=res.get("sheet", ""), steps=res.get("steps", []), scores=res.get("scores", {}), review=res.get("review", ""),
                   rounds_done=res.get("rounds_done", 0))
    return out


def used_ids(clean):
    return {clean.get(k, "") for _, k, _ in T.CHAT_SLOTS}


def keep(name=""):
    """save the chat's theme into the list and keep the generated effects it uses; the others the chat made are deleted"""
    s = load()
    if not s or not s.get("theme"):
        raise L.Bad("There is no theme in this chat yet")
    clean = dict(s["theme"])
    if name:
        clean["n"] = L.clean_name(name) or clean["n"]
    use = used_ids(clean)
    for eid in s["made"]:
        if eid in use:
            G.keep(eid)
        else:
            try:
                G.delete(eid)
            except L.Bad:
                pass
    line, num, existed = L.save_theme(clean)
    clear()
    return {"ok": True, "name": clean["n"], "line": line, "number": num, "existed": existed, "kept": sorted(e for e in s["made"] if e in use)}


def discard():
    """throw the chat away and delete every effect it generated (nothing was added to the list)"""
    s = load()
    gone = 0
    for eid in (s or {}).get("made", []):
        try:
            G.delete(eid)
            gone += 1
        except L.Bad:
            pass
    clear()
    return {"ok": True, "deleted": gone}


def status():
    s = load()
    if not s:
        return {"ok": True, "active": False}
    return {"ok": True, "active": True, "mode": s["mode"], "concept": (s.get("rich") or {}).get("concept"), "sheet": (s.get("rich") or {}).get("sheet", ""), "turns": s["turns"], "name": (s["theme"] or {}).get("n", ""), "line": L.theme_line(s["theme"]) if s["theme"] else "",
            "history": s["history"], "made": s["made"], "wh": s["wh"]}
