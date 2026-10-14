#!/usr/bin/env python3
"""Self-test for OMS2 share codes (bin/omscode2.py, bin/omscustom.py, bin/theme-code share/check/import/undo).
Works in scratch state folders, never on the real one. About 2 minutes (every imported shader goes through the real render gate).

  python3 bin/omscode2_selftest.py
  python3 bin/omscode2_selftest.py --write-golden     only once per format version: save tests/golden-oms2-vN.bin (never overwrites)
"""
import sys
sys.dont_write_bytecode = True
import hashlib
import json
import os
import random
import shutil
import subprocess
import tempfile
import time
import zlib

HERE = os.path.dirname(os.path.realpath(__file__))
SRC = os.path.dirname(HERE)
TMP = tempfile.mkdtemp(prefix="omscode2-test-")
S0 = os.path.join(TMP, "state-share")
os.makedirs(S0)
os.environ["OMASHADERS_STATE_DIR"] = S0   # set before the modules read it
os.environ["HOME"] = TMP
sys.path.insert(0, HERE)
import omslib as L  # noqa: E402
import omscode2 as C  # noqa: E402
import omscustom as X  # noqa: E402
import aigen as G  # noqa: E402
import aigen_selftest as T  # noqa: E402  (its good sample shaders)

TC = os.path.join(HERE, "theme-code")
GOLDEN = os.path.join(SRC, "tests", "golden-oms2-v2.bin")
DICT1_SHA256 = "927cdd465063c20a1344ad8006bc7ce4f699526c71119cd352be297f496c19e3"
OMS1_OLD = "OMS1:eNoNyUEKgCAQRuGrxL82sEUt5hQtuoDEJILNgIoF4d2b5fvehw5aHASEPYck08G1waEa9BSFW2PL2_IJjctcksRqcprkEFXFQkEfrhe0eTuaQasf4wcULBu0"
fails = []

GOLDEN_THEME = {"n": "Golden Pond", "s": "ai-golden-glow", "w": "", "m": "water-rings", "c": "lagoon", "wf": "", "wc": "", "wr": "ai-golden-edge",
                "o": {"fx": 65, "col": 60}}
GOLDEN_CUSTOM = [
    {"id": "ai-golden-glow", "k": "screen", "name": "Golden Glow", "desc": "A warm drifting light.", "st": 60,
     "code": "void main(){\nvec3 c=texture(tex,v_texcoord).rgb;\nfloat a=noise(v_texcoord*6.0+time*0.1);\nfragColor=vec4(c+vec3(1.0,0.8,0.5)*a*0.1,1.0);\n}\n"},
    {"id": "ai-golden-edge", "k": "frame", "name": "Golden Edge", "desc": "Round gold border.",
     "set": {"rounding": 12, "border_size": 2, "border_colors": "e0b040ff,a07020ff"}},
]


def check(cond, what):
    print(("PASS: " if cond else "FAIL: ") + what)
    if not cond:
        fails.append(what)


def run(args, state, inp=None):
    env = dict(os.environ, OMASHADERS_STATE_DIR=state, HOME=TMP)
    r = subprocess.run([sys.executable, TC] + args, capture_output=True, text=True, env=env, input=inp)
    return r.returncode, r.stdout, r.stderr


def jrun(args, state, inp=None):
    rc, out, err = run(args + ["--json"], state, inp)
    try:
        d = json.loads(out)
    except ValueError:
        d = {"ok": False, "error": "NOT JSON: " + (out + err)[:300]}
    return rc, d, err


def new_state(name, themes=()):
    p = os.path.join(TMP, name)
    os.makedirs(p)
    if themes:
        open(os.path.join(p, "themes"), "w").write("\n".join(themes) + "\n")
    return p


def themes_of(state):
    try:
        return [l for l in open(os.path.join(state, "themes")).read().split("\n") if l.strip()]
    except OSError:
        return []


def effects_of(state):
    out = {}
    for sub in ("screen", "wall", "color", "mouse", "frame", "meta"):
        d = os.path.join(state, "generated", sub)
        for fn in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            out[sub + "/" + fn] = hashlib.sha1(open(os.path.join(d, fn), "rb").read()).hexdigest()
    return out


def payload_file(theme, custom, name="p.bin"):
    p = os.path.join(TMP, name)
    open(p, "wb").write(C.pack(theme, custom))
    return p


def entry(eid, kind, code, name="Test", desc="A test effect.", **kw):
    return dict({"id": eid, "k": kind, "name": name, "desc": desc, "code": code}, **kw)


def theme(**kw):
    t = {k: "" for k in C.THEME_KEYS}
    t.update({"n": "Test Theme", "o": {}})
    t.update(kw)
    return t


def forge(raw_json, did=1, fmt=C.FORMAT):
    z = zlib.compressobj(9, zlib.DEFLATED, -15, 9, zlib.Z_DEFAULT_STRATEGY, C.dictionary(did) if did == 1 else b"")
    return C.MAGIC + bytes([fmt, did]) + z.compress(raw_json) + z.flush()


def main():
    can_gate = not G.render_ready()
    if not can_gate:
        print("note: glslangValidator or the render tools are missing, the checks that need the full gate are skipped")
    have_qsb = can_gate

    if "--write-golden" in sys.argv:
        if os.path.exists(GOLDEN):
            print("refusing to overwrite " + GOLDEN)
            return 1
        os.makedirs(os.path.dirname(GOLDEN), exist_ok=True)
        open(GOLDEN, "wb").write(C.pack(GOLDEN_THEME, GOLDEN_CUSTOM))
        print("wrote " + GOLDEN)
        return 0

    # ---- (i) the dictionary can not change by accident
    data = open(os.path.join(HERE, "oms2-dict-1.txt"), "rb").read()
    check(hashlib.sha256(data).hexdigest() == DICT1_SHA256 and C.DICT_SHA256[1] == DICT1_SHA256, "dictionary 1 is exactly the committed file (sha256 matches)")
    check(len(data) <= 32768, "dictionary 1 fits the deflate window (%d bytes)" % len(data))
    alt = os.path.join(TMP, "altdict")
    os.makedirs(alt)
    open(os.path.join(alt, "oms2-dict-1.txt"), "wb").write(data + b"x")
    saved, C._dicts, C.HERE = C.HERE, {}, alt
    try:
        C.decode(b"OM\x02\x01abc")
        changed = ""
    except L.Bad as e:
        changed = str(e)
    C.HERE, C._dicts = saved, {}
    check("was changed" in changed, "a dictionary file that was edited is refused: %r" % changed)

    # ---- the shortener keeps every token and never glues "- -" into "--"
    m = C.minify("float x = a - -b; // c\nfloat y = a + +b; /* d */\n")
    check("--" not in m and "++" not in m and C.tokens(m) == C.tokens("float x = a - -b; float y = a + +b;"), "shortening keeps a - -b apart: %r" % m)
    bad_files = 0
    for folder in ("shaders", "colors", "wallpaper-effects", "cursor-shaders", "mouse-effects"):
        d = os.path.join(SRC, folder)
        for fn in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if fn.endswith(".frag"):
                try:
                    C.minify(open(os.path.join(d, fn), encoding="utf-8", errors="replace").read())
                except ValueError:
                    bad_files += 1
    check(bad_files == 0, "the shortener keeps the same tokens in every shipped shader (%d failed)" % bad_files)

    # ---- (h) golden payload of format 2 still decodes
    check(os.path.exists(GOLDEN), "golden payload tests/golden-oms2-v2.bin is committed")
    if os.path.exists(GOLDEN):
        gb = open(GOLDEN, "rb").read()
        th, cu = C.unpack(gb)
        exp = dict({k: "" for k in C.THEME_KEYS}, **GOLDEN_THEME)
        check(th == exp and cu == GOLDEN_CUSTOM, "the golden format-2 payload decodes to the same theme and effects")
        check(gb[:4] == b"OM\x02\x01", "golden header: OM, format 2, dictionary 1")
        rc, d, _e = jrun(["check", "--file", GOLDEN], S0)
        check(rc == 0 and d.get("format") == "OMS2" and [c["name"] for c in d["customs"]] == ["Golden Glow", "Golden Edge"], "theme-code check reads the golden file")

    # ---- fixtures: a share source with custom effects of every kind
    ids = {}
    for kind, name, code in (("screen", "Test Glow", T.SCREEN_OK), ("window", "Test Pane", T.WINDOW_OK), ("color", "Test Tone", T.COLOR_OK),
                             ("wallpaper", "Test Mist", T.WALL_OK), ("cursor", "Test Ring", T.CURSOR_OK)):
        if kind in ("wallpaper", "cursor") and not have_qsb:
            continue
        built = G.build(kind, code, "A test effect.", 65 if kind == "screen" else 70, name)
        ids[kind] = G.install(kind, built, name, "A test effect.", kept=True)
    ids["frame"] = G.install("frame", {"frag": G.frame_text({"rounding": 14, "border_size": 2, "border_colors": "5cc8b5ff,6899edff", "spin": 25}, "A test frame.")},
                             "Test Edge", "A test frame.", kept=True)
    line = "|".join([ids["screen"], ids.get("wallpaper", ""), ids.get("cursor", ""), ids["color"], "Test Look", ids["window"], "", ids["frame"], "fx=60,col=50,wall=70,cur=80"])
    open(os.path.join(S0, "themes"), "w").write(line + "\nvignette||||Plain Look\n")

    # ---- (a) round trip
    rc, d, err = jrun(["share", "1"], S0)
    check(rc == 0 and d.get("format") == "OMS2" and d["code"].startswith("OMS2:") and len(d["customs"]) == len(ids), "share of a theme with custom effects gives an OMS2 code: %s" % (d.get("error") or len(d.get("customs", []))))
    check(not d.get("tooBigForPicture") and d.get("bytes", 99999) < C.PICTURE_LIMIT and d.get("pictureLimit") == C.PICTURE_LIMIT, "it fits the picture (%s bytes)" % d.get("bytes"))
    check(all(set(c) == {"id", "name", "kind", "bytes"} and c["bytes"] > 0 for c in d["customs"]), "every custom effect is listed with name, kind and size")
    clean = L.parse_line(line)
    entries = X.collect(clean, [])
    p = C.pack(clean, entries)
    th2, cu2 = C.unpack(p)
    check(th2 == dict({k: "" for k in C.THEME_KEYS}, **{k: clean[k] for k in C.THEME_KEYS}, o=clean["o"]) and cu2 == entries, "pack then unpack gives back the same theme and the same custom effects")
    check(C.unpack(C.from_text(C.to_text(p)))[1] == entries, "the OMS2: text form decodes to the same effects")
    check(d["code"] == C.to_text(p), "share --json gives exactly that code")
    for e in entries:
        if e["k"] != "frame":
            built = G.build(e["k"], e["code"], e["desc"], e.get("st", 70), e["name"], e.get("p") == "rich")
            kind_file = os.path.join(S0, "generated", G.SUBDIR[e["k"]], e["id"] + ".frag")
            check(C.tokens(built["frag"]) == C.tokens(open(kind_file).read()),
                  "%s: the stored body rebuilds into the installed file" % e["k"])
    check(not any("code" in e for e in entries if e["k"] == "frame") and all(set(e) <= {"id", "k", "name", "desc", "code", "st", "p", "set"} for e in entries), "entries carry only known fields (frames hold settings, not code)")
    rc, d2, _e = jrun(["share", "1", "--format", "bytes", "--out", os.path.join(TMP, "share.bin")], S0)
    check(rc == 0 and open(os.path.join(TMP, "share.bin"), "rb").read() == p and d2.get("path") == os.path.join(TMP, "share.bin") and "code" not in d2, "--format bytes --out writes the raw payload")
    rc, d3, err = jrun(["share", "2"], S0)
    check(d3.get("code", "").startswith("OMS1:") and d3.get("customs") == [] and d3.get("format") == "OMS1", "a theme of built-in effects keeps the short OMS1 code")
    rc, d4, err = jrun(["share", "2", "--oms2"], S0)
    check(d4.get("code", "").startswith("OMS2:"), "--oms2 asks for OMS2 for any theme")
    rc, d5, err = jrun(["share", "1", "--parts", "color"], S0)
    check(rc == 0 and [c["kind"] for c in d5["customs"]] == ["color"], "--parts only carries the custom effects of the parts that are on")

    # ---- full import of that share into an empty state: gate, fresh ids, Imported mark, undo
    S2 = new_state("state-import", ["vignette||||Mine"])
    if can_gate:
        before = effects_of(S2)
        rc, d, err = jrun(["import", "--file", os.path.join(TMP, "share.bin")], S2)
        got = d.get("imported_effects", [])
        check(rc == 0 and d.get("existed") is False and len(got) == len(ids) and all(i.startswith("ai-imported-") for i in got), "import installs every custom effect under a fresh local id: %s" % (d.get("error") or [(c["kind"], c["status"], c["message"][:90]) for c in d["customs"]]))
        check(not set(got) & set(ids.values()) and not any(i in themes_of(S2)[-1] for i in ids.values()), "none of the code's own ids are used")
        metas = [json.load(open(os.path.join(S2, "generated", "meta", i + ".json"))) for i in got]
        check(all(m.get("imported") is True and m["name"].startswith("Imported: ") and m.get("kept") for m in metas), "imported effects are marked imported in their record and named Imported: ...")
        fr = open(os.path.join(S2, "generated", "screen", got[0] + ".frag")).read()
        check("// category: Imported" in fr and "Made by AI" not in fr, "the effect list shows them under the category Imported")
        check(d["number"] == 2 and len(themes_of(S2)) == 2 and d.get("undo"), "the theme is saved as number 2 and an undo token is returned")
        after_first = effects_of(S2)
        # (f) importing twice
        rc, d2, err = jrun(["import", "--file", os.path.join(TMP, "share.bin")], S2)
        check(rc == 0 and d2.get("existed") is True and d2["number"] == 2 and d2["imported_effects"] == [] and sorted(d2["reused_effects"]) == sorted(got) and d2["undo"] == "", "importing the same code twice says existed and installs nothing new")
        check(effects_of(S2) == after_first and len(themes_of(S2)) == 2, "no effect and no theme was duplicated")
        # (g) undo removes exactly what the import added
        rc, u, err = jrun(["undo", "--token", d["undo"]], S2)
        check(rc == 0 and u.get("removed_theme") and sorted(u["removed_effects"]) == sorted(got) and u["kept_effects"] == [], "undo removes the theme and every effect that import added: %s" % (u.get("error") or ""))
        check(effects_of(S2) == before and themes_of(S2) == ["vignette||||Mine"], "after undo the state is exactly as before (your own theme untouched)")
        rc, u, err = jrun(["undo", "--token", d["undo"]], S2)
        check(rc == 1 and not u["ok"], "a second undo with the same token is refused")
    else:
        print("skipped: full import of the shared theme (needs the render gate)")

    # ---- (b) old OMS1 codes still import
    S3 = new_state("state-oms1")
    rc, d, err = jrun(["import", OMS1_OLD], S3)
    check(rc == 0 and d.get("format") == "OMS1" and d["theme"]["s"] == "vignette" and d["theme"]["c"] == "lagoon" and d["theme"]["m"] == "water-rings" and d["imported_effects"] == [], "an old OMS1 code still imports: %s" % d.get("error", ""))
    rc, d, err = jrun(["check", OMS1_OLD], S3)
    check(rc == 0 and d["customs"] == [], "and check reads it")
    forged = "OMS1:" + L.b64e(zlib.compress(json.dumps({"v": 1, "n": "Sneaky", "s": "ai-sneaky", "c": "lagoon"}).encode()))
    rc, d, err = jrun(["import", forged], S3)
    check(rc == 0 and d["theme"]["s"] == "" and any("ai-sneaky" in n for n in d["skipped"]) and not os.path.exists(os.path.join(S3, "generated")), "an OMS1 code naming an ai- effect still has it left out")

    # ---- (c) codes from a newer version
    newer = {
        "format byte 3": b"OM\x03\x01" + b"whatever",
        "dictionary 9": b"OM\x02\x09" + b"whatever",
        "json v 3": forge(json.dumps({"v": 3, "t": {"n": "x"}, "custom": []}).encode()),
    }
    for what, blob in newer.items():
        rc, d, err = jrun(["check", "--file", _w(blob)], S3)
        check(rc == 1 and "newer OmaShaders" in d.get("error", "") and "update the plugin" in d["error"], "a code from a newer version (%s) says to update the plugin" % what)
    rc, d, err = jrun(["check", "OMS1:" + L.b64e(zlib.compress(json.dumps({"v": 2, "n": "x"}).encode()))], S3)
    check(rc == 1 and "newer OmaShaders" in d.get("error", ""), "an OMS1-style code with a newer version number says so too")
    ok_future = forge(json.dumps({"v": 2, "tv": 1, "t": {"n": "Future", "s": "vignette", "newfield": 1}, "custom": [], "extra": {"a": 1}}).encode())
    rc, d, err = jrun(["import", "--file", _w(ok_future)], S3)
    check(rc == 0 and d["theme"]["s"] == "vignette", "unknown optional fields in a code are ignored")

    # ---- (d) the gate refuses unsafe shaders, the rest of the theme still imports
    S4 = new_state("state-gate", ["vignette||||Mine"])
    good = entry("ai-good", "screen", T.SCREEN_OK, "Good One", st=65)
    attacks = (
        ("a banned word (discard)", "void main() { fragColor = vec4(1.0); discard; }", "discard"),
        ("an include", "#include </etc/passwd>\n" + T.SCREEN_OK, "'#'"),
        ("an endless loop", "void main() { for (int i = 0; i < 100000; i++) { } fragColor = vec4(1.0); }", "the most allowed"),
        ("a declared uniform", "uniform float evil;\n" + T.SCREEN_OK, "do not declare any"),
        ("a while loop", "void main() { while (true) { } fragColor = vec4(1.0); }", "'for' loops"),
    )
    for what, code, want in attacks:
        f = payload_file(theme(s="ai-evil", c="lagoon", m="water-rings"), [entry("ai-evil", "screen", code, "Evil")])
        rc, d, err = jrun(["import", "--file", f], S4)
        check(rc == 0 and d["theme"]["s"] == "" and d["theme"]["c"] == "lagoon" and d["imported_effects"] == [] and any(want in n for n in d["skipped"]),
              "%s is refused by the gate and the rest of the theme imports: %s" % (what, (d.get("error") or [n[:100] for n in d.get("skipped", [])])))
    check(not os.path.exists(os.path.join(S4, "generated", "screen")) or os.listdir(os.path.join(S4, "generated", "screen")) == [], "nothing from a refused shader was installed")
    f = payload_file(theme(s="ai-evil"), [entry("ai-evil", "screen", "#include <x>\n" + T.SCREEN_OK, "Evil")])
    n0 = len(themes_of(S4))
    rc, d, err = jrun(["import", "--file", f], S4)
    check(rc == 1 and not d["ok"] and "Nothing in this code can be used" in d["error"] and len(themes_of(S4)) == n0, "a theme with nothing usable left is refused and not saved")
    f = payload_file(theme(s="ai-gone", c="lagoon"), [])
    rc, d, err = jrun(["import", "--file", f], S4)
    check(rc == 0 and d["theme"]["s"] == "" and any("not in the code" in n for n in d["skipped"]), "an ai- id with no effect in the code is left out")
    f = payload_file(theme(s="ai-wrongkind", c="lagoon"), [entry("ai-wrongkind", "cursor", "vec4 cursorFx(vec2 p, vec2 m) { return vec4(0.0); }", "Wrong")])
    rc, d, err = jrun(["import", "--file", f], S4)
    check(rc == 0 and d["theme"]["s"] == "" and any("wrong kind" in n for n in d["skipped"]), "an effect of the wrong kind for its part is left out")
    rc, d, err = jrun(["check", "--file", payload_file(theme(s="ai-evil", c="lagoon"), [entry("ai-evil", "screen", "void main() { discard; }", "Evil")])], S4)
    check(rc == 0 and d["customs"][0]["status"] == "skipped" and "discard" in d["customs"][0]["message"], "check already reports the cheap safety rules")

    # ids, paths and names from the code are never trusted; existing effects are never overwritten
    S5 = new_state("state-trust", ["vignette||||Mine"])
    mine = os.path.join(S5, "generated", "screen")
    os.makedirs(mine)
    os.makedirs(os.path.join(S5, "generated", "meta"))
    open(os.path.join(mine, "ai-good.frag"), "w").write("// my own effect\n")
    open(os.path.join(S5, "generated", "meta", "ai-good.json"), "w").write(json.dumps({"id": "ai-good", "kind": "screen", "name": "Mine"}))
    keep_before = effects_of(S5)
    nasty = entry("ai-good", "screen", T.SCREEN_OK, 'Evil $(rm -rf ~) `x` <b>"q"\\', "line one\n#include <evil>\nline two", st=65)
    f = payload_file(theme(s="ai-good", c="lagoon"), [nasty, entry("ai-../../etc/x", "screen", T.SCREEN_OK, "Path")])
    if can_gate:
        rc, d, err = jrun(["import", "--file", f], S5)
        new = d.get("imported_effects", [])
        check(rc == 0 and len(new) == 1 and new[0] != "ai-good" and effects_of(S5).get("screen/ai-good.frag") == keep_before["screen/ai-good.frag"], "an effect with the same id as one of yours gets a new id and yours is untouched: %s" % (d.get("error") or new))
        if new:
            fr = open(os.path.join(S5, "generated", "screen", new[0] + ".frag")).read()
            m = json.load(open(os.path.join(S5, "generated", "meta", new[0] + ".json")))
            check(not any(l.startswith("#") and not l.startswith("#version") for l in fr.split("\n")) and "$(" not in m["name"] and "`" not in m["name"] and "<" not in m["name"] and "\n" not in m["desc"],
                  "name and description are cleaned: %r" % m["name"])
            check(os.listdir(os.path.join(S5, "generated", "screen")).count(new[0] + ".frag") == 1 and not any(".." in fn for fn in os.listdir(os.path.join(S5, "generated", "screen"))), "no file was placed from a path in the code")

        # (g) undo takes back only what that import added, effects other themes use stay
        S6 = new_state("state-undo", ["vignette||||Mine", "ai-keepme||||Old"])
        shared = entry("ai-shared", "screen", T.SCREEN_OK, "Shared", st=65)
        frame_a = entry("ai-frame-a", "frame", "", "Frame A", set={"rounding": 10, "border_size": 2, "border_colors": "ff2030ff"})
        del frame_a["code"]
        a_file = payload_file(theme(n="Theme A", s="ai-shared", wr="ai-frame-a"), [shared, frame_a], "a.bin")
        b_file = payload_file(theme(n="Theme B", s="ai-shared", c="lagoon"), [shared], "b.bin")
        base = effects_of(S6)
        rc, a, err = jrun(["import", "--file", a_file], S6)
        rc, b, err = jrun(["import", "--file", b_file], S6)
        check(a.get("number") == 3 and b.get("number") == 4 and b["imported_effects"] == [] and b["reused_effects"] == a["imported_effects"][:1] and b["undo"], "a second theme that uses the same shader reuses it: %s" % (a.get("error") or b.get("error") or ""))
        rc, u, err = jrun(["undo", "--number", "3"], S6)
        left = themes_of(S6)
        check(rc == 0 and u["removed_theme"] and len(u["removed_effects"]) == 1 and [k["id"] for k in u["kept_effects"]] == a["imported_effects"][:1], "undo of theme A removes its frame and keeps the shader theme B still uses: %s" % (u.get("error") or u))
        check(len(left) == 3 and left[0] == "vignette||||Mine" and left[1] == "ai-keepme||||Old" and "Theme B" in left[2], "the other themes are untouched")
        check(any(k.startswith("screen/ai-imported") for k in effects_of(S6)) and not any(k.startswith("frame/") for k in effects_of(S6)), "the shared shader is still installed, the frame is gone")
        rc, u, err = jrun(["undo", "--number", "1"], S6)
        check(rc == 1 and not u["ok"] and themes_of(S6) == left, "undo on a theme you made yourself is refused and changes nothing")
        rc, u, err = jrun(["undo", "--token", b["undo"]], S6)
        check(rc == 0 and u["removed_theme"] and len(u["removed_effects"]) == 1, "undo of theme B now removes the shader too: %s" % (u.get("error") or u))
        check(effects_of(S6) == base and themes_of(S6) == ["vignette||||Mine", "ai-keepme||||Old"], "everything is back exactly as before the two imports")
    else:
        print("skipped: the id/name trust checks and the undo checks (need the render gate)")

    # ---- (e) damaged, tampered and bomb payloads give a clean error
    S7 = new_state("state-bad")
    good_blob = C.pack(GOLDEN_THEME, GOLDEN_CUSTOM)
    rnd = random.Random(7)
    cases = {
        "random bytes after a valid header": b"OM\x02\x01" + bytes(rnd.randrange(256) for _ in range(300)),
        "cut in half": good_blob[:len(good_blob) // 2],
        "only the header": b"OM\x02\x01",
        "not a payload at all": b"hello world, this is not a code",
        "unknown dictionary 0": b"OM\x02\x00" + good_blob[4:],
        "empty": b"",
        "json that is not an object": forge(b"[1,2,3]"),
        "custom is not a list": forge(json.dumps({"v": 2, "t": {"n": "x"}, "custom": "nope"}).encode()),
        "theme field is a number": forge(json.dumps({"v": 2, "t": {"n": 5}, "custom": []}).encode()),
        "invalid utf-8": forge(b"\xff\xfe\xfd"),
        "too many effects": forge(json.dumps({"v": 2, "t": {"n": "x", "s": "ai-a"}, "custom": [{}] * 50}).encode()),
    }
    flipped = bytearray(good_blob)
    for i in (10, 20, 30):
        flipped[i] ^= 0x55
    cases["bytes flipped in the middle"] = bytes(flipped)
    bomb_small = forge(b" " * (C.MAX_DECODED * 200))
    bomb_big = forge(b"0" * (60 * 1000 * 1000))
    cases["decompression bomb under the size limit"] = bomb_small
    cases["decompression bomb over the size limit"] = bomb_big
    for what, blob in cases.items():
        t0 = time.time()
        rc, out, err = run(["check", "--json", "--file", _w(blob)], S7)
        try:
            d = json.loads(out)
        except ValueError:
            d = {}
        clean_fail = rc == 1 and d.get("ok") is False and d.get("error") and "Traceback" not in out + err and err.strip() == ""
        check(clean_fail and time.time() - t0 < 20, "%s: a plain error and no traceback (%s)" % (what, (d.get("error") or out + err)[:80]))
    check(len(bomb_small) < C.MAX_PAYLOAD, "the small bomb really is under the payload limit (%d bytes)" % len(bomb_small))
    for what, code in (("text with bad characters", "OMS2:!!!!"), ("not base64 padding", "OMS2:A"), ("a long text", "OMS2:" + "A" * 50000), ("wrong prefix", "OMS9:abcd"), ("empty", "")):
        rc, out, err = run(["check", "--json", code], S7)
        check(rc == 1 and "Traceback" not in out + err and json.loads(out)["ok"] is False, "%s: a plain error" % what)
    rc, out, err = run(["check", "--json", "--file", os.path.join(TMP, "does-not-exist")], S7)
    check(rc == 1 and "Traceback" not in out + err, "a missing file: a plain error")

    shutil.rmtree(TMP, ignore_errors=True)
    print("\n%s" % ("ALL PASSED" if not fails else "%d FAILED" % len(fails)))
    return 1 if fails else 0


_n = [0]


def _w(blob):
    """write bytes to a scratch file, return its path"""
    _n[0] += 1
    p = os.path.join(TMP, "blob%d.bin" % _n[0])
    open(p, "wb").write(blob)
    return p


if __name__ == "__main__":
    sys.exit(main())
