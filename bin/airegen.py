"""airegen: make chosen parts of a theme again (bin/ai-theme chat regen, job regen).

The user ticks parts (Screen, Color, Wallpaper, Cursor, Windows, Frame), may add a direction, and presses Regenerate. Only the ticked parts are
made again, as a genuinely different take; every other part is LOCKED and comes back exactly as it was. This module holds the pieces that do not
depend on the chat session (bin/aichat.py has the session, the history of replaced versions and the Keep step):

  parse_slots   "screen,windows" -> backend parts          lock       take only the chosen parts from a new theme, keep the rest byte for byte
  pick          Pick existing: the AI picks other existing ids (the same catalog and checks as a first theme)
  estimate      tokens and a rough price for a regenerate of N parts (Pick, Quick or Rich)

Quick calls bin/aiinvent.py run(regen=...), Rich calls bin/airich.py regen(); both go through the same safety gate as a first theme.
"""
import copy
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import aiinvent as I  # noqa: E402
import aiprov as P  # noqa: E402
import aitheme as T  # noqa: E402
import omslib as L  # noqa: E402

# what the dialog shows -> the backend parts behind it ("Windows" is the window effect and the window colour)
UI_PARTS = (("screen", "Screen", ("screen",)), ("color", "Color", ("color",)), ("wallpaper", "Wallpaper", ("wallpaper",)),
            ("cursor", "Cursor", ("cursor",)), ("windows", "Windows", ("window", "window_color")), ("frame", "Frame", ("frame",)))
ORDER = tuple(s for _, _, ss in UI_PARTS for s in ss)
OPT_OF = {"screen": "fx", "color": "col", "wallpaper": "wall", "cursor": "cur"}
MAX_HISTORY = 12


def parse_slots(text):
    """'screen,windows' or ['screen', 'window_color'] -> backend parts in a fixed order; raises L.Bad for an unknown name"""
    items = text if isinstance(text, (list, tuple)) else str(text or "").replace(" ", ",").split(",")
    want = set()
    for x in items:
        x = str(x).strip().lower().replace("-", "_")
        if not x:
            continue
        hit = [ss for k, _, ss in UI_PARTS if k == x]
        if hit:
            want.update(hit[0])
        elif x in ORDER:
            want.add(x)
        else:
            raise L.Bad("Unknown part %r. Use screen, color, wallpaper, cursor, windows or frame" % x)
    if not want:
        raise L.Bad("Choose at least one part to regenerate")
    return [s for s in ORDER if s in want]


def key_of(slot):
    return I.SLOTS[slot][1]


def ui_name(slot):
    for k, _, ss in UI_PARTS:
        if slot in ss:
            return k
    return slot


def label_of(slots):
    """'Screen, Windows' for a list of backend parts"""
    out = []
    for k, label, ss in UI_PARTS:
        if any(s in slots for s in ss):
            out.append(label)
    return ", ".join(out)


def direction_text(text):
    t = " ".join(str(text or "").split())
    while t.startswith("-"):
        t = t[1:].lstrip()
    return t[:400]


# ------------------------------------------------------------------ Pick existing
PICK_RULES = (
    "REGENERATE. The user pressed \"regenerate\" for some parts of the CURRENT THEME below. For exactly these parts pick a DIFFERENT existing id from the catalog "
    "(never the id that is there now, never one listed as replaced before). Every other part is LOCKED: leave its key out of your answer. "
    "Wallpaper ids must come from the catalog's wallpaper list. \"strength\" lists only the parts you regenerate. \"idea\" is one short sentence about what is new. "
    "Answer with the same one JSON object, with only those keys.")


def pick_prompt(theme, history, slots, direction, avoid, facts, cat, desc_of, extra=""):
    rows = [T.catalog_text(cat), "# MODE", PICK_RULES, T.current_text(theme, desc_of), T.history_text(history), "# PARTS TO REGENERATE"]
    for slot in slots:
        old = avoid.get(slot) or []
        rows.append("- %s: %s" % (slot, ("not " + ", ".join(old[:8])) if old else "there is none yet: ADD one that suits the theme"))
    if direction:
        rows.append("# DIRECTION FROM THE USER (applies ONLY to the parts above)\n" + direction)
    if facts:
        rows += ["# BASE PICTURE", facts]
    if extra:
        rows.append(extra)
    rows.append("\nAnswer with the one JSON object only.")
    return "\n".join(r for r in rows if r)


def only_slots(answer, slots):
    st = answer.get("strength") if isinstance(answer.get("strength"), dict) else {}
    out = {k: v for k, v in answer.items() if k in slots or k in ("idea", "note")}
    out["strength"] = {k: v for k, v in st.items() if k in slots}
    return out


def pick(theme, history, slots, direction, avoid, path, wh, ch, cat, desc_of, progress=lambda m: None):
    """-> the same dict pick_turn gives: clean (the whole theme, only the chosen parts differ), notes, idea, usage"""
    jpg, facts = T.picture_facts(path) if path else (None, "")
    u = {"tokens_in": 0, "tokens_out": 0, "cost_usd": None, "calls": 0, "estimated": False}
    answer, extra = {}, ""
    for attempt in range(2):
        progress("Asking the AI for other choices…" if attempt == 0 else "The AI repeated a choice; asking again…")
        text, usage = P.call(ch, T.guide_text(), pick_prompt(theme, history, slots, direction, avoid, facts, cat, desc_of, extra), None)
        I.add_usage(u, usage or {})
        got = only_slots(T.extract_json(text), slots)
        for slot in slots:
            if slot in got:
                answer[slot] = got[slot]
        for k in ("idea", "note"):
            if got.get(k):
                answer[k] = got[k]
        answer["strength"] = dict(answer.get("strength") or {}, **got.get("strength", {}))
        again = [s for s in slots if avoid.get(s) and str(answer.get(s) or "").strip().lower() in [x.lower() for x in avoid[s]]]
        if not again:
            break
        for s in again:
            answer.pop(s, None)
        extra = "# YOUR LAST ANSWER REPEATED A VERSION THAT IS BEING REPLACED\n" + "\n".join("- %s must not be %s" % (s, ", ".join(avoid[s][:8])) for s in again) + "\nPick another id for these."
    d = T.merge_answer(T.theme_as_answer(theme), answer)
    clean, notes = T.finish(d, cat, wh, "follow")
    return {"ok": True, "mode": "pick", "clean": clean, "notes": notes, "idea": T.sentence(answer.get("idea"), 300), "note": T.sentence(answer.get("note"), 300),
            "usage": u, "new": [], "fell_back": []}


# ------------------------------------------------------------------ locking
def lock(old, new, slots):
    """-> (theme, notes): `old` with only the chosen parts taken from `new`. Every other part, its strength, the name and every other number
    (wspeed, wzoom, the Wallhaven id...) stay byte for byte. A chosen part that came back empty keeps what it had (a regenerate never removes a part)."""
    out = copy.deepcopy(old)
    o = dict(out.get("o") or {})
    notes = []
    for slot in slots:
        key = key_of(slot)
        was, now = old.get(key, ""), new.get(key, "")
        if not now:
            if was:
                notes.append("%s: nothing new came back, so it stays as it was." % I.TITLE[slot])
            continue
        out[key] = now
        opt = OPT_OF.get(slot)
        if opt and now != was:
            if opt in (new.get("o") or {}):
                o[opt] = new["o"][opt]
            else:
                o.pop(opt, None)
        if now == was and was:
            notes.append("%s: the AI came back with the same effect, so it is unchanged." % I.TITLE[slot])
    out["o"] = o
    return out, notes


# ------------------------------------------------------------------ estimate
def estimate(mode, slots, direction, path, ch=None, cat=None, rounds=2):
    """what a regenerate of these parts is expected to cost; per part for Quick and Rich"""
    ch = ch or P.choice()
    cat = cat or L.catalog()
    n = max(1, len(slots))
    img = I.IMAGE_TOKENS if (path and P.can_see(ch) and mode == "rich") else 0
    note = ""
    if mode == "pick":
        t_in = (len(T.guide_text()) + len(T.catalog_text(cat))) // 4 + 700
        t_out = 150 + 60 * n
        calls = 1
    elif mode == "invent":
        t_in = (len(T.invent_text()) + len(I.names_text(cat))) // 4 + 900 + 150 * n
        t_out = 300 + I.OUT_TOKENS_PER_PART * n
        calls = 1
    else:
        import airich
        fake = {"title": "x", "tags": [], "briefs": {k: "x" * 500 for k in airich.PARTS}, "palette": [{"hex": "000000", "role": "x"}] * 5, "strength": {}, "biome": "", "layout": "x" * 300}
        m_in = (len(T.builder_text()) + len(airich.build_prompt("wallpaper", fake, {"main": [], "accents": []}, cat)) + 1600) // 4 + 2500
        looks = rounds + 1 if rounds > 0 and airich.reviewer_possible(ch) else 0
        rev = (rounds * min(n, 2)) if looks else 0
        t_in = n * m_in + looks * ((len(T.reviewer_text()) + 3500) // 4 + 2 * airich.SHEET_TOKENS) + rev * (m_in + 1500)
        t_out = n * 2500 + looks * 1400 + rev * 2800
        calls = n + looks + rev
        if not looks and rounds > 0:
            note = "no review: this AI cannot look at pictures"
    est = {"mode": mode, "slots": list(slots), "parts": n, "tokens_in": t_in + img, "tokens_out": t_out, "calls": calls, "cost_usd": None, "note": note}
    pr = I.PRICES.get(ch.get("model")) if ch["provider"] == "claude" else None
    if pr:
        est["cost_usd"] = round((est["tokens_in"] * pr[0] + t_out * pr[1]) / 1e6, 3)
    elif ch["provider"] == "ollama":
        est["note"] = (note + "; " if note else "") + "local: no cost, only time"
    else:
        est["note"] = (note + "; " if note else "") + "price depends on your plan"
    tok = est["tokens_in"] + t_out
    est["summary"] = "Regenerate %d part%s (%s): about %dk tokens%s, %d call%s" % (
        n, "" if n == 1 else "s", {"pick": "Pick", "invent": "Quick", "rich": "Rich"}[mode], max(1, round(tok / 1000.0)),
        (", about $%.2f" % est["cost_usd"]) if est["cost_usd"] is not None else "", calls, "" if calls == 1 else "s")
    return est
