"""Custom (AI-made) effects inside share codes: read them from the state folder to share, and bring someone else's in only through
the same safety gate (bin/aigen.py) that checks what an AI writes. Nothing from a code is trusted: ids are replaced by fresh local
ones, names are cleaned, no path ever comes from a code, and an effect that fails the gate is left out.

Sharing stores the AI's own function body (the part aigen.build wraps in the fixed template), recovered from the installed file and
checked by rebuilding it, so the importer's template and gate decide what runs. If the file cannot be matched to a body (edited by
hand), that effect is left out of the code with a note. Frames are settings, not code, and go through aigen.frame_text.
"""
import sys
sys.dont_write_bytecode = True
import hashlib
import json
import os
import re
import time

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import omslib as L  # noqa: E402
import omscode2 as C  # noqa: E402
import aigen as G  # noqa: E402

IMPORT_PREFIX = "Imported: "
IMPORTS = os.path.join(L.STATE, "imports")   # one small record per import, for Undo
SLOT_KINDS = {"s": {"screen"}, "wf": {"window", "screen"}, "w": {"wallpaper"}, "m": {"cursor"}, "c": {"color"}, "wc": {"color"}, "wr": {"frame"}}
SLOT_LABEL = {"s": "screen", "w": "wallpaper", "m": "cursor", "c": "colour", "wf": "window", "wc": "window colour", "wr": "frame"}
SLOT_ORDER = ("s", "w", "m", "c", "wf", "wc", "wr")
KIND_WORD = {"screen": "screen", "window": "window", "color": "color", "wallpaper": "wallpaper", "cursor": "cursor", "frame": "frame"}
_HEAD_LINE = re.compile(r"^(?://|#) (?:category|label|hint|desc|strength|motion|ai-generated|target):.*$", re.M)
SCREEN_KINDS = ("screen", "window", "color")


def made_ids(theme):
    """{id: [slots]} of the ai- effects a theme uses"""
    out = {}
    for k in SLOT_ORDER:
        v = str(theme.get(k) or "")
        if v.startswith(G.PREFIX):
            out.setdefault(v, []).append(k)
    return out


# ---------------------------------------------------------------- share side
def _norm(frag):
    return _HEAD_LINE.sub("", frag)


def recover_body(kind, frag, desc, start, name):
    """-> (body, rich) such that aigen.build gives back this file, or None"""
    cands = []
    if kind in SCREEN_KINDS:
        mark = "layout(location = 0) out vec4 fragColor;\n"
        i = frag.find(mark)
        if i < 0:
            return None
        tail = frag[i + len(mark):]
        for rich in (False, True):
            t = tail
            for _n, _d, src, _k in G.helper_table(rich):
                if t.startswith(src):
                    t = t[len(src):]
            cands.append((t, rich))
        cands.append((tail, False))  # the helpers stay in as the code's own functions
    elif kind in ("wallpaper", "cursor"):
        funcs, main_ = (G.WALL_FUNCS, G.WALL_MAIN) if kind == "wallpaper" else (G.MOUSE_FUNCS, G.MOUSE_MAIN)
        i = frag.find(funcs)
        if i < 0 or not frag.endswith("\n" + main_):
            return None
        body = frag[i + len(funcs) + 1:len(frag) - len(main_) - 1]
        cands = [(body, False), (body, True)]
    for body, rich in cands:
        try:
            if _norm(G.build(kind, body, desc, start, name, rich)["frag"]) == _norm(frag):
                return body, rich
        except (G.GateFail, ValueError):
            continue
    return None


def _frame_settings(text):
    s = {}
    for line in text.splitlines():
        if line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k in G.FRAME_KEYS:
            try:
                s[k] = int(v)
            except ValueError:
                pass
        elif k in ("border_colors", "shadow_offset") or k in G.FRAME_COLOR_KEYS:
            s[k] = v.strip()
    return s


def local_entry(eid, slots):
    """the entry for an installed ai- effect; raises L.Bad with the reason when it cannot be shared"""
    try:
        meta = json.load(open(G.meta_path(eid)))
    except (OSError, ValueError):
        meta = {}
    kind = meta.get("kind")
    if kind not in G.KINDS:
        kind = sorted(SLOT_KINDS[slots[0]])[0] if slots else ""
    if kind not in G.KINDS:
        raise L.Bad("unknown kind")
    ext = ".frame" if kind == "frame" else ".frag"
    path = os.path.join(G.GEN, G.SUBDIR[kind], eid + ext)
    try:
        text = open(path, encoding="utf-8").read()
    except OSError:
        raise L.Bad("the file is missing")
    name = L.clean_name(re.sub(r"^%s" % re.escape(IMPORT_PREFIX), "", str(meta.get("name") or eid)), 60)
    desc = G.one_line(meta.get("desc"), 140)
    e = {"id": eid, "k": kind, "name": name, "desc": desc}
    if kind == "frame":
        e["set"] = _frame_settings(text)
        try:
            G.frame_text(e["set"], desc)
        except G.GateFail as ex:
            raise L.Bad(str(ex))
        return e
    m = re.search(r"^// strength: (\d+)$", text, re.M)
    start = int(m.group(1)) if m else 70
    rec = recover_body(kind, text, desc, start, name)
    if rec is None:
        raise L.Bad("its file was changed by hand, so its code cannot be shared")
    body, rich = rec
    try:
        e["code"] = C.minify(body)
    except ValueError as ex:
        raise L.Bad(str(ex))
    if kind in SCREEN_KINDS and start != 70:
        e["st"] = start
    if rich:
        e["p"] = "rich"
    return e


def collect(clean, notes):
    """entries for every ai- effect the cleaned theme uses; a part that cannot be shared is taken out of the theme (and noted)"""
    out = []
    for eid, slots in made_ids(clean).items():
        try:
            e = local_entry(eid, slots)
            if not all(e["k"] in SLOT_KINDS[s] for s in slots):
                raise L.Bad("it is the wrong kind of effect for that part")
            out.append(e)
        except L.Bad as ex:
            for s in slots:
                clean[s] = ""
            notes.append("%s: %s was left out of the code (%s)" % (SLOT_LABEL[slots[0]], eid, ex))
    return out


# ---------------------------------------------------------------- import side
def content_hash(e):
    body = {"k": e["k"], "p": e.get("p", "")}
    if e["k"] == "frame":
        body["set"] = e["set"]
    else:
        body["code"] = e["code"]
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()[:16]


def clean_entry(e):
    """-> (entry, None) with only the known fields and checked types, or (None, reason)"""
    if not isinstance(e, dict):
        return None, "not an effect"
    eid, kind = e.get("id"), e.get("k")
    if not isinstance(eid, str) or not L.ID_RE.match(eid) or not eid.startswith(G.PREFIX):
        return None, "it has no valid id"
    if kind not in G.KINDS:
        return None, "it is a kind of effect this version does not know"
    name = L.clean_name(e.get("name") if isinstance(e.get("name"), str) else "", 28) or "Effect"
    desc = G.one_line(e.get("desc") if isinstance(e.get("desc"), str) else "", 140)
    out = {"id": eid, "k": kind, "name": name, "desc": desc}
    if kind == "frame":
        s = e.get("set")
        if not isinstance(s, dict) or len(json.dumps(s)) > 1000:
            return None, "the frame settings are missing"
        out["set"] = s
    else:
        code = e.get("code")
        if not isinstance(code, str) or not code.strip():
            return None, "it has no code"
        if len(code) > G.limits("rich", kind)["code"]:
            return None, "its code is too long"
        if kind == "color":  # compose-shader only accepts the picture read in exactly this spelling, the shortener removed the space
            code = re.sub(r"texture\s*\(\s*tex\s*,\s*v_texcoord\s*\)", "texture(tex, v_texcoord)", code)
        out["code"] = code
        st = e.get("st")
        if isinstance(st, int) and not isinstance(st, bool):
            out["st"] = max(5, min(100, st))
        if e.get("p") == "rich":
            out["p"] = "rich"
    return out, None


def _profile(e):
    return "rich" if e.get("p") == "rich" else "quick"


def static_problems(e):
    """the cheap parts of the gate (text and cost rules), no compiler and no render"""
    if e["k"] == "frame":
        try:
            G.frame_text(e["set"], e["desc"])
            return []
        except G.GateFail as ex:
            return [str(ex)]
    try:
        built = G.build(e["k"], e["code"], e["desc"], e.get("st", 70), e["name"], rich=(_profile(e) == "rich"))
    except (G.GateFail, ValueError) as ex:
        return [str(ex)]
    probs, _cost = G.static_rules(e["k"], e["code"], built, G.limits(_profile(e), e["k"]))
    return probs


def full_gate(e, name):
    return G.gate(e["k"], e.get("code", ""), name, e["desc"], e.get("st", 70), settings=e.get("set"), profile=_profile(e))


def find_installed(h):
    """the local effect an earlier import of the same code made, or None"""
    for m in G.listing():
        if m.get("import_hash") == h and m.get("id") and G.files_of(m["id"]):
            return m["id"]
    return None


def relabel(built):
    frag = built["frag"].replace("category: %s\n" % G.CATEGORY, "category: Imported\n", 1)
    return dict(built, frag=frag)


def install_entry(e, built, h):
    return G.install(e["k"], relabel(built), IMPORT_PREFIX + e["name"], e["desc"], kept=True,
                     extra={"name": IMPORT_PREFIX + e["name"], "imported": True, "import_hash": h, "imported_at": int(time.time())})


def short_problem(probs):
    first = (probs or ["it did not pass"])[0]
    return first if len(probs) < 2 else "%s (and %d more)" % (first, len(probs) - 1)


def bring_in(entries, theme, tv, notes, install=True):
    """Install the entries the theme uses (install=False: only the cheap checks, nothing is written). Rewrites theme so every
    ai- id is a local one, or empty when the effect was left out. -> (reports, added)
    reports = [{id (local or ''), name, kind, status imported|reused|ok|skipped, message}]"""
    by_id, reports, added, keep = {}, [], [], set()
    for raw in entries:
        e, why = clean_entry(raw)
        if e is None:
            notes.append("a custom effect in the code was left out: %s" % why)
            continue
        if e["id"] in by_id:
            notes.append("a custom effect appeared twice in the code, the first one is used")
            continue
        by_id[e["id"]] = e
    local = {}
    for src_id, slots in made_ids(theme).items():
        e = by_id.get(src_id)
        label = SLOT_LABEL[slots[0]]
        size = C.entry_size(e) if e else 0
        if e is None:
            for s in slots:
                theme[s] = ""
            notes.append("%s: %s is not in the code, left out" % (label, src_id[:40]))
            continue
        if not all(e["k"] in SLOT_KINDS[s] for s in slots):
            for s in slots:
                theme[s] = ""
            notes.append("%s: the custom effect “%s” is the wrong kind of effect for that part, left out" % (label, e["name"]))
            reports.append({"id": "", "name": e["name"], "kind": e["k"], "bytes": size, "status": "skipped", "message": "wrong kind for that part"})
            continue
        h = content_hash(e)
        have = find_installed(h)
        if have:
            local[src_id] = have
            reports.append({"id": have, "name": e["name"], "kind": e["k"], "bytes": size, "status": "reused", "message": ""})
            continue
        name = IMPORT_PREFIX + e["name"]
        probs = static_problems(e)
        built = None
        if not probs and install:
            res = full_gate(e, name)
            probs, built = res["problems"], res["built"]
        elif not probs:
            keep.add(src_id)
            reports.append({"id": "", "name": e["name"], "kind": e["k"], "bytes": size, "status": "ok", "message": ""})
            continue
        if probs:
            msg = short_problem(probs)
            if tv > C.TEMPLATE_VERSION:
                msg += " (made for a newer OmaShaders, update the plugin)"
            for s in slots:
                theme[s] = ""
            notes.append("%s: the custom effect “%s” was not imported, it did not pass the safety check: %s" % (label, e["name"], msg))
            reports.append({"id": "", "name": e["name"], "kind": e["k"], "bytes": size, "status": "skipped", "message": msg})
            continue
        try:
            eid = install_entry(e, built, h)
        except (G.GateFail, OSError) as ex:
            for s in slots:
                theme[s] = ""
            notes.append("%s: the custom effect “%s” could not be installed (%s)" % (label, e["name"], str(ex)[:120]))
            reports.append({"id": "", "name": e["name"], "kind": e["k"], "bytes": size, "status": "skipped", "message": "could not be installed"})
            continue
        local[src_id] = eid
        added.append(eid)
        reports.append({"id": eid, "name": e["name"], "kind": e["k"], "bytes": size, "status": "imported", "message": ""})
    for src_id, slots in made_ids(theme).items():
        if src_id in keep:
            continue
        for s in slots:
            theme[s] = local.get(src_id, "")
    return reports, added


# ---------------------------------------------------------------- undo
def write_record(line, theme_added, effects):
    """-> token, or '' when this import changed nothing"""
    if not theme_added and not effects:
        return ""
    token = hashlib.sha1(("%s|%s|%s" % (line, effects, time.time())).encode("utf-8")).hexdigest()[:10]
    os.makedirs(IMPORTS, exist_ok=True)
    kinds = {}
    for m in G.listing():
        if m.get("id") in effects:
            kinds[m["id"]] = m.get("kind", "")
    rec = {"token": token, "line": line, "theme_added": bool(theme_added), "effects": [{"id": i, "kind": kinds.get(i, "")} for i in effects], "created": int(time.time())}
    p = os.path.join(IMPORTS, token + ".json")
    with open(p + ".tmp", "w") as f:
        json.dump(rec, f)
    os.replace(p + ".tmp", p)
    old = sorted(os.listdir(IMPORTS))
    for fn in old[:-40] if len(old) > 40 else []:
        try:
            os.remove(os.path.join(IMPORTS, fn))
        except OSError:
            pass
    return token


def read_records():
    out = []
    try:
        names = os.listdir(IMPORTS)
    except OSError:
        return out
    for fn in names:
        try:
            r = json.load(open(os.path.join(IMPORTS, fn)))
            if isinstance(r, dict) and r.get("token") and fn == r["token"] + ".json":
                out.append(r)
        except (OSError, ValueError):
            continue
    return sorted(out, key=lambda r: r.get("created", 0))
