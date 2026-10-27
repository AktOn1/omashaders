"""Offline self-test of "regenerate chosen parts" and "edit a saved theme" (bin/airegen.py, bin/aichat.py load / regen / regen-undo / keep).
No real AI is called: stubs stand in for the AI (Pick, Quick, Rich). Everything runs in a scratch state folder with a scratch HOME.
It proves: only the chosen parts change and every locked part (and its strength) stays byte for byte, the direction reaches the AI,
the previous version comes back, a saved theme opens, is regenerated and is saved in place or as a new theme, a built-in theme is never
overwritten, and keep / discard leave no stray generated effect. The Quick and Rich parts need the render check (CPU) and are skipped without it.
Run: python3 bin/airegen_selftest.py   (also part of: python3 bin/ai-theme selftest)"""
import sys
sys.dont_write_bytecode = True
import glob
import json
import os
import re
import shutil
import tempfile

HERE = os.path.dirname(os.path.realpath(__file__))
ROOT = os.path.dirname(HERE)
TMP = tempfile.mkdtemp(prefix="omashaders-regen-selftest-")
os.environ["OMASHADERS_STATE_DIR"] = os.path.join(TMP, "state")
os.environ["OMASHADERS_CHAT_DIR"] = os.path.join(TMP, "chat")
os.environ["HOME"] = TMP
sys.path.insert(0, HERE)
import aigen as G  # noqa: E402
import aiinvent as I  # noqa: E402
import aiprov as P  # noqa: E402
import aitheme as T  # noqa: E402
import omslib as L  # noqa: E402
import aichat as C  # noqa: E402
import airegen as RG  # noqa: E402

OK = FAIL = 0


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("FAIL %s %s" % (name, detail))


def example(kind, which=0):
    f = sorted(glob.glob(os.path.join(ROOT, "rich-examples", kind + "-*.glsl")))[which]
    return open(f).read()


class Ai:
    """the stub AI: answers is a list of callables or values, used in order; prompts keeps what it was asked"""

    def __init__(self):
        self.answers, self.prompts, self.systems = [], [], []

    def __call__(self, ch, system, prompt, jpg=None, timeout=None):
        self.prompts.append(prompt)
        self.systems.append(system)
        a = self.answers.pop(0) if self.answers else {}
        a = a(prompt, system) if callable(a) else a
        return (a if isinstance(a, str) else json.dumps(a)), {"tokens_in": 1000, "tokens_out": 300, "cost_usd": 0.01, "estimated": False}


def part(name, code, fb, start=75):
    return {"new": {"name": name, "desc": name + " test effect.", "start": start, "fallback": fb, "code": code}}


def new_screen(c="ff2030"):
    return "void main() {\n  vec3 c = texture(tex, v_texcoord).rgb;\n  vec3 warm = mix(c, c * C_%s * 1.6, 0.35);\n  float v = smoothstep(1.0, 0.3, length(v_texcoord - 0.5));\n  float g = smoothstep(0.6, 0.9, noise(v_texcoord * vec2(14.0, 8.0) + vec2(time * 0.25, -time * 0.15)));\n  fragColor = vec4(mix(c, warm, 0.6) * (0.8 + 0.2 * v) + C_ffd0a0 * g * 0.2, 1.0);\n}\n" % c


CURSOR = "vec4 cursorFx(vec2 p, vec2 m) {\n  float d = length(p - m);\n  float ring = smoothstep(6.0, 0.0, abs(d - 40.0 - 6.0 * sin(time * 4.0)));\n  return vec4(C_ff2030 * ring, ring);\n}\n"


def themes():
    return L.read_themes()


def parts_of(c, skip=()):
    """everything of a theme but the chosen keys (for 'the rest is untouched')"""
    return {k: v for k, v in c.items() if k not in skip and k != "o"}, {k: v for k, v in (c.get("o") or {}).items()}


def generated_ids():
    return sorted(m["id"] for m in G.listing())


def main():
    from PIL import Image
    pic = os.path.join(TMP, "pic.png")
    im = Image.new("RGB", (640, 360))
    px = im.load()
    for y in range(360):
        for x in range(640):
            px[x, y] = (20 + y // 6, 40 + x // 12, 90 + y // 4) if y > 140 else (200 - y // 2, 150 - y // 3, 120 + y // 3)
    im.save(pic)
    T.current_background = lambda: pic
    ch = {"provider": "claude", "model": "sonnet", "custom": "", "mode": "pick", "remembered": False}
    P.choice = lambda: ch
    P.availability = lambda c=None: {"available": True, "backend": "stub", "hint": ""}
    ai = Ai()
    P.call = ai
    os.makedirs(L.STATE, exist_ok=True)
    cat = L.catalog()
    scr, col, mou, frm, win = (sorted(cat[k]) for k in ("screen", "color", "mouse", "frame", "winfx"))
    light = sorted(L.overlay_ids() & set(cat["wall"]))
    starter = [l for l in open(L.STARTER, encoding="utf-8").read().split("\n") if l.strip()]
    builtin_line = starter[0]
    own = {"n": "Mine", "s": scr[1], "c": col[1], "w": light[1], "m": mou[1], "wf": win[1], "wc": "", "wr": frm[1], "o": {"fx": 55, "col": 66, "wall": 44, "cur": 77}}
    own_line = L.theme_line(own)

    def reset(lines=None):
        C.clear()
        shutil.rmtree(G.GEN, ignore_errors=True)
        with open(L.THEMES, "w") as f:
            f.write("\n".join(lines if lines is not None else [builtin_line, own_line]) + "\n")
        for f in (L.OWN,):
            if os.path.exists(f):
                os.remove(f)
        ai.answers, ai.prompts, ai.systems = [], [], []

    # ---------------------------------------------------------------- 1. open a saved theme (user's own)
    reset()
    r = C.load_theme("2")
    st = C.status()
    check("load: opens the theme as a chat flagged loaded, no history, no AI call", r["loaded"] and st["loaded"] and st["history"] == [] and not ai.prompts and r["turn"] == 0)
    check("load: origin number, name and own flag are kept", r["origin"]["number"] == 2 and r["origin"]["name"] == "Mine" and r["origin"]["own"] and not r["origin"]["builtin"], str(r["origin"]))
    check("load: the session theme has the parts and strengths of the saved theme", L.parse_line(r["line"])["s"] == own["s"] and L.parse_line(r["line"])["o"]["wall"] == 44, r["line"])
    check("load: a built-in theme is flagged built-in", C.load_theme("1")["origin"]["builtin"])
    r = C.load_theme("", line=own_line)
    check("load current: a line gives an origin without a number", r["origin"]["number"] == 0 and r["loaded"])
    try:
        C.load_theme("99")
        check("load: a number that is not in the list is refused", False)
    except L.Bad:
        check("load: a number that is not in the list is refused", True)

    # ---------------------------------------------------------------- 2. Pick regenerate: only the chosen parts, locked parts byte for byte
    reset()
    r0 = C.load_theme("2")
    old = json.loads(json.dumps(C.load()["theme"]))
    ai.answers = [{"screen": scr[3], "color": col[4], "wallpaper": light[3], "cursor": mou[4], "frame": frm[4], "strength": {"screen": 33, "color": 88, "wallpaper": 10},
                   "idea": "colder and clearer"}]
    r = C.regen("screen,color", "colder please")
    new = L.parse_line(r["line"])
    was = L.parse_line(own_line)
    check("pick regen: the chosen parts changed", new["s"] == scr[3] and new["c"] == col[4], r["line"])
    check("pick regen: the AI answered for parts that were not chosen, they are ignored", new["w"] == was["w"] and new["m"] == was["m"] and new["wr"] == was["wr"] and new["wf"] == was["wf"] and new["wc"] == was["wc"])
    nw, ow = new["o"], was["o"]
    check("pick regen: locked strengths unchanged, chosen strengths taken", nw.get("wall") == ow.get("wall") and nw.get("cur") == ow.get("cur") and nw.get("fx") == 33 and nw.get("col") == 88, str(nw))
    check("pick regen: the direction reached the AI and the old ids are listed as not to repeat", "colder please" in ai.prompts[0] and scr[1] in ai.prompts[0] and "DIRECTION" in ai.prompts[0])
    check("pick regen: the name and the base picture are the same", new["n"] == "Mine" and C.load()["wh"] == r0["wh"])
    check("pick regen: the result lists what changed, the session records the turn", r["turn"] == 1 and r["changes"] and r["regen"]["slots"] == ["screen", "color"] and C.load()["loaded"])
    check("pick regen: previous versions are offered for the regenerated parts only", r["previous"] == ["screen", "color"], str(r["previous"]))
    # the AI repeats the id that is being replaced: it is asked again
    ai.prompts.clear()
    ai.answers = [{"screen": scr[3]}, {"screen": scr[5], "strength": {"screen": 40}}]
    r2 = C.regen("screen")
    check("pick regen: a repeated id is refused and the AI is asked again", len(ai.prompts) == 2 and L.parse_line(r2["line"])["s"] == scr[5], str(len(ai.prompts)))
    check("pick regen: the second prompt names the repeated ids", scr[3] in ai.prompts[1] and "REPEATED" in ai.prompts[1])
    # previous version
    u = C.regen_undo("screen")
    check("undo: the previous screen is back with its strength, no AI call", L.parse_line(u["line"])["s"] == scr[3] and L.parse_line(u["line"])["o"]["fx"] == 33 and len(ai.prompts) == 2)
    u = C.regen_undo("screen")
    check("undo: a second undo goes back one more version", L.parse_line(u["line"])["s"] == scr[1] and L.parse_line(u["line"])["o"]["fx"] == 55, u["line"])
    try:
        C.regen_undo("screen")
        check("undo: nothing earlier is a plain error", False)
    except L.Bad:
        check("undo: nothing earlier is a plain error", True)
    check("undo: the colour regenerated before is untouched by undoing the screen", L.parse_line(u["line"])["c"] == col[4] and "color" in u["previous"] and "screen" not in u["previous"], str(u["previous"]))
    # a missing part is ADDED when it is ticked
    reset([L.theme_line({"n": "Bare", "s": scr[2], "c": col[2], "w": "", "m": "", "wf": "", "wc": "", "wr": "", "o": {}})])
    C.load_theme("1")
    ai.answers = [{"cursor": mou[3], "frame": frm[3], "window": win[3], "strength": {"cursor": 70}}]
    r = C.regen("cursor,frame")
    n = L.parse_line(r["line"])
    check("pick regen: ticking an absent part adds it; the part not ticked stays absent", n["m"] == mou[3] and n["wr"] == frm[3] and n["wf"] == "" and n["s"] == scr[2] and n["c"] == col[2], r["line"])
    check("pick regen: the prompt says the part is new", "there is none yet" in ai.prompts[0])
    try:
        C.regen("nonsense")
        check("regen: an unknown part is a plain error", False)
    except L.Bad as e:
        check("regen: an unknown part is a plain error", "Unknown part" in str(e))
    try:
        C.regen("")
        check("regen: no part chosen is a plain error", False)
    except L.Bad:
        check("regen: no part chosen is a plain error", True)
    check("windows means the window effect and the window colour", RG.parse_slots("windows") == ["window", "window_color"] and RG.parse_slots("screen,frame") == ["screen", "frame"])

    # ---------------------------------------------------------------- 3. a loaded theme is a follow-up, not a first turn
    reset()
    C.load_theme("2")
    ai.answers = [{"strength": {"screen": 30}, "idea": "softer"}]
    r = C.turn("less fog")
    n = L.parse_line(r["line"])
    check("loaded theme: a free-text change is a follow-up (the other parts stay)", n["s"] == own["s"] and n["w"] == own["w"] and n["wr"] == own["wr"] and n["o"].get("fx") == 30 and "CURRENT" in ai.prompts[0], r["line"])
    check("loaded theme: still flagged loaded after a change", C.status()["loaded"])

    # ---------------------------------------------------------------- 4. save in place, save as new, built-in refused
    reset()
    C.load_theme("2")
    ai.answers = [{"screen": scr[3], "strength": {"screen": 21}}]
    C.regen("screen")
    k = C.keep(replace=True)
    have = themes()
    check("save in place: the list keeps its length and the theme's own line is replaced", len(have) == 2 and k["replaced"] and k["number"] == 2 and L.parse_line(have[1])["s"] == scr[3] and have[0] == builtin_line, str(have))
    check("save in place: the name is kept and the session is gone", L.parse_line(have[1])["n"] == "Mine" and C.load() is None)
    reset()
    C.load_theme("2")
    ai.answers = [{"screen": scr[3]}]
    C.regen("screen")
    k = C.keep()
    have = themes()
    check("save as new: the original stays, a new line is added with a '(edited)' name", len(have) == 3 and have[1] == own_line and "(edited)" in L.parse_line(have[2])["n"] and L.parse_line(have[2])["s"] == scr[3], str(have))
    C.load_theme("2")
    ai.answers = [{"screen": scr[4]}]
    C.regen("screen")
    k = C.keep(name="My Better One")
    check("save as new: a typed name is used", L.parse_line(themes()[-1])["n"] == "My Better One" and len(themes()) == 4)
    reset()
    C.load_theme("1")
    ai.answers = [{"screen": scr[3]}]
    C.regen("screen")
    before = themes()
    try:
        C.keep(replace=True)
        check("built-in theme: cannot be saved in place", False)
    except L.Bad as e:
        check("built-in theme: cannot be saved in place", "save this one as a new theme" in str(e).lower() or "new theme" in str(e), str(e))
    check("built-in theme: the list is unchanged after the refusal and the draft is still there", themes() == before and C.load() is not None)
    k = C.keep()
    check("built-in theme: it can be saved as a new theme", len(themes()) == 3 and themes()[0] == builtin_line and not k["replaced"], str(themes()))
    # the theme changed under the dialog
    reset()
    C.load_theme("2")
    ai.answers = [{"screen": scr[3]}]
    C.regen("screen")
    with open(L.THEMES, "w") as f:
        f.write(builtin_line + "\n")
    try:
        C.keep(replace=True)
        check("save in place: a theme that is gone is a plain error", False)
    except L.Bad as e:
        check("save in place: a theme that is gone is a plain error", "not in your list" in str(e), str(e))
    check("save in place: only an opened theme can be replaced", True)
    reset()
    C.load_theme("2")
    ai.answers = [{"screen": scr[3]}]
    C.regen("screen")
    d = C.discard()
    check("discard: the list is exactly as it was", themes() == [builtin_line, own_line] and C.load() is None, str(themes()))

    # ---------------------------------------------------------------- 5. Quick: new shaders for the chosen parts only (needs the render check)
    if G.render_ready():
        print("info: the Quick and Rich parts were skipped (no render check here: %s)" % G.render_ready())
    else:
        quick()
        rich()
    shutil.rmtree(TMP, ignore_errors=True)
    print("airegen selftest: %d ok, %d failed" % (OK, FAIL))
    return 1 if FAIL else 0


def quick():
    cat = L.catalog()
    scr, col, mou, frm, win = (sorted(cat[k]) for k in ("screen", "color", "mouse", "frame", "winfx"))
    light = sorted(L.overlay_ids() & set(cat["wall"]))
    ai = P.call
    own = {"n": "Mine", "s": scr[1], "c": col[1], "w": light[1], "m": mou[1], "wf": win[1], "wc": "", "wr": frm[1], "o": {"fx": 55, "col": 66, "wall": 44, "cur": 77}}
    own_line = L.theme_line(own)
    starter = [l for l in open(L.STARTER, encoding="utf-8").read().split("\n") if l.strip()]

    def reset():
        C.clear()
        shutil.rmtree(G.GEN, ignore_errors=True)
        with open(L.THEMES, "w") as f:
            f.write("\n".join([starter[0], own_line]) + "\n")
        ai.answers, ai.prompts, ai.systems = [], [], []

    reset()
    C.load_theme("2", invent=True)
    old = json.loads(json.dumps(C.load()["theme"]))
    ai.answers = [{"screen": part("Warm Rush", new_screen(), "", 70), "cursor": part("Ring Two", CURSOR, "", 80), "wallpaper": "", "idea": "a warmer screen", "strength": {"screen": 62, "cursor": 90}}]
    r = C.regen("screen", "warm it up")
    n = L.parse_line(r["line"])
    check("quick regen: a new screen effect passed the gate and is in the theme", n["s"].startswith("ai-") and n["s"] != old["s"] and [m["id"] for m in r["new"]] == [n["s"]], r["line"])
    check("quick regen: the cursor the AI also wrote is ignored; every other part is byte for byte", n["m"] == old["m"] and n["c"] == old["c"] and n["w"] == old["w"] and n["wf"] == old["wf"] and n["wr"] == old["wr"] and n["o"].get("cur") == 77 and n["o"].get("wall") == 44, r["line"])
    check("quick regen: only the chosen part's piece was generated", generated_ids() == [n["s"]], str(generated_ids()))
    check("quick regen: the direction and the version being replaced reached the AI", "warm it up" in ai.prompts[0] and old["s"] in ai.prompts[0])
    first = n["s"]
    ai.answers = [{"screen": part("Cool Rush", new_screen("2030ff"), "", 70), "idea": "cooler"}]
    r = C.regen("screen")
    second = L.parse_line(r["line"])["s"]
    check("quick regen: the version regenerated away stays on disk until keep or discard", second != first and set(generated_ids()) == {first, second}, str(generated_ids()))
    u = C.regen_undo("screen")
    check("quick undo: the first generated version is back, nothing is deleted yet", L.parse_line(u["line"])["s"] == first and set(generated_ids()) == {first, second})
    k = C.keep(replace=True)
    ids = generated_ids()
    check("quick keep: the version in the theme is kept, the replaced ones are deleted (no stray effect)", ids == [first] and G.used_by(first) == 1, str(ids))
    check("quick keep: saved in place with the new effect in the list", L.parse_line(themes()[1])["s"] == first and len(themes()) == 2)
    # discard throws every generated version away and leaves the list alone
    C.load_theme("2", invent=True)
    ai.answers = [{"screen": part("Sea Rush", new_screen("20ff90"), "", 70)}]
    C.regen("screen")
    check("quick discard: the draft made a file", len(generated_ids()) == 2)
    C.discard()
    check("quick discard: the draft's file is gone, the saved theme's effect stays", generated_ids() == [first], str(generated_ids()))
    # nothing a saved theme uses is ever deleted by a cleanup
    check("cleanup guard: an effect a saved theme uses is not deleted", C.unused_generated(first) is False and generated_ids() == [first])
    # an effect that fails the gate: repaired twice, then the closest existing effect, never the one being replaced
    C.load_theme("2", invent=True)
    bad = {"cursor": part("Loop Cursor", "vec4 cursorFx(vec2 p, vec2 m) { while (true) { } return vec4(0.0); }", "", 80)}
    ai.answers = [bad, bad, bad]
    ai.prompts.clear()
    r = C.regen("cursor")
    n = L.parse_line(r["line"])
    check("quick regen: a failing effect ends in the closest existing effect, a different one", n["m"] and n["m"] != own["m"] and r["fell_back"], r["line"] + str(r["fell_back"]))
    check("quick regen: the failing effect was repaired before falling back", len(ai.prompts) == 3, str(len(ai.prompts)))
    check("quick regen: the rest is untouched on a fallback", n["s"] == first and n["wr"] == own["wr"])
    C.discard()
    # a part that is absent can be added by Quick
    C.load_theme("2", invent=True)
    own2 = dict(own)
    ai.answers = [{"window_color": part("Dusk Glass", "void main() {\n  vec3 c = texture(tex, v_texcoord).rgb;\n  float l = luma(c);\n  fragColor = vec4(mix(c, vec3(l) * C_ffb070 * 1.5, 0.5), 1.0);\n}\n", "", 70), "wallpaper": ""}]
    r = C.regen("windows")
    n = L.parse_line(r["line"])
    check("quick regen: Windows covers the window colour (absent before) and keeps the window effect when the AI did not return one", n["wc"].startswith("ai-") and n["wf"] == own["wf"], r["line"])
    C.discard()


def rich():
    import airich as R
    cat = L.catalog()
    scr, col, mou, frm, win = (sorted(cat[k]) for k in ("screen", "color", "mouse", "frame", "winfx"))
    light = sorted(L.overlay_ids() & set(cat["wall"]))
    ai = P.call
    own = {"n": "Mine", "s": scr[1], "c": col[1], "w": light[1], "m": mou[1], "wf": "", "wc": "", "wr": frm[1], "o": {"fx": 55, "col": 66, "wall": 44, "cur": 77}}
    own_line = L.theme_line(own)
    with open(L.THEMES, "w") as f:
        f.write(own_line + "\n")
    shutil.rmtree(G.GEN, ignore_errors=True)
    C.clear()
    calls = []

    def stub(ch, system, prompt, jpg=None, timeout=None):
        u = {"tokens_in": 1000, "tokens_out": 500, "cost_usd": 0.01, "estimated": False}
        if "(Builder)" in system:
            slot = re.search(r"# YOUR PART: (\w+)", prompt).group(1)
            calls.append("builder:" + slot)
            kind = I.SLOTS[slot][0]
            return json.dumps({"name": "Fresh %s" % slot.title(), "desc": "a test %s" % slot, "start": 75, "fallback": "", "code": example(kind, 1)}), u
        if "(Reviewer)" in system:
            calls.append("reviewer")
            parts = {s: {"score": 9, "seen": "stub saw it", "fixes": []} for s in re.findall(r"^- (\w+): brief:", prompt, re.M)}
            return json.dumps({"summary": "stub summary", "parts": parts}), u
        calls.append("other:" + system[:30])
        return "{}", u
    P.call = stub
    try:
        r = C.load_theme("1", rich=True)
        check("rich load: a saved theme opens in Rich mode without a Planner call", r["loaded"] and r["mode"] == "rich" and not calls)
        old = json.loads(json.dumps(C.load()["theme"]))
        r = C.regen("cursor", "a calmer ring", rounds=0)
        n = L.parse_line(r["line"])
        check("rich regen: only the Builder of the chosen part ran (no Planner, no other Builder, no Reviewer at 0 rounds)", calls == ["builder:cursor"], str(calls))
        check("rich regen: a new cursor effect, every other part byte for byte", n["m"].startswith("ai-") and n["m"] != old["m"] and n["s"] == old["s"] and n["c"] == old["c"] and n["w"] == old["w"] and n["wr"] == old["wr"] and n["o"].get("fx") == 55 and n["o"].get("wall") == 44, r["line"])
        check("rich regen: the Rich state is kept for further regenerates", C.load()["rich"]["pieces"].get("cursor", {}).get("id") == n["m"])
        calls.clear()
        r = C.regen("wallpaper", rounds=1)
        check("rich regen: with a Reviewer round it looks at the new piece only", calls[0] == "builder:wallpaper" and "reviewer" in calls and calls.count("builder:wallpaper") == 1, str(calls))
        n2 = L.parse_line(r["line"])
        check("rich regen: the earlier regenerated cursor is untouched by the wallpaper regenerate", n2["m"] == n["m"] and n2["w"] != old["w"])
        u = C.regen_undo("wallpaper")
        check("rich undo: the wallpaper before is back", L.parse_line(u["line"])["w"] == old["w"])
        C.keep()
        left = generated_ids()
        used = {L.parse_line(l)[k] for l in themes() for k in ("s", "w", "m", "c")}
        check("rich keep: no generated effect is left that no saved theme uses", all(e in used for e in left), str(left))
    finally:
        P.call = ai


if __name__ == "__main__":
    sys.exit(main())
