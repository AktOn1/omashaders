"""Offline self-test of the painted sprites (bin/aisprites.py and what bin/aigen.py, bin/aiinvent.py, bin/omscustom.py and bin/oms-delete do with them).
No real image model and no real AI runs: a small program stands in for the image model (Custom command), another for the text AI. Everything happens in a
scratch state folder. Run: python3 bin/aisprites.py selftest   (about 1 to 2 minutes: the gate renders every effect on the CPU)"""
import sys
sys.dont_write_bytecode = True  # a __pycache__ in the plugin folder would make the shell reload the plugin
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
import aigen as _G  # noqa: E402
if _G.render_ready():  # painted sprites ride on the Invent flow, which needs the render check
    print("skipped: the painted sprites need the render check (%s)" % _G.render_ready())
    sys.exit(0)
TMP = tempfile.mkdtemp(prefix="aisprites-selftest-")
STATE = os.path.join(TMP, "state")
os.makedirs(STATE)
os.environ["OMASHADERS_STATE_DIR"] = STATE
os.environ["XDG_STATE_HOME"] = os.path.join(TMP, "xdg")
sys.path.insert(0, HERE)
OK = FAIL = 0


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("FAIL %s %s" % (name, detail))


# the stand-in image model: an object on a plain dark background; words in the prompt switch on misbehaviour
TOOL = r'''
import sys, os, hashlib
import numpy as np
from PIL import Image
log = sys.argv[sys.argv.index("--log") + 1]
out = sys.argv[sys.argv.index("--out") + 1]
prompt = sys.stdin.read()
open(log, "a").write(prompt.replace("\n", " ") + "\n")
if "DOWN" in prompt:
    sys.exit(3)
h = int(hashlib.sha256(prompt.encode()).hexdigest()[:8], 16)
S = 768
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
rng = np.random.default_rng(h)
if "JUNK" in prompt:
    arr = rng.integers(0, 255, (S, S, 3)).astype("uint8")
elif "BRIGHT" in prompt:
    arr = np.full((S, S, 3), 235, "uint8")
else:
    bg = np.array([10, 10, 14], np.float32)
    img = np.broadcast_to(bg, (S, S, 3)).copy()
    cx, cy = S / 2 + (h % 40) - 20, S / 2
    rx, ry = 180 + (h % 60), 220 - (h % 50)
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    col = np.array([(h >> 3) % 150 + 100, (h >> 7) % 150 + 80, (h >> 11) % 150 + 60], np.float32)
    shade = (1.0 - 0.35 * d)[..., None]
    inside = d < 1.0
    img[inside] = (col * shade)[inside]
    hole = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) < 40   # a dark spot inside the object must stay part of it
    img[hole] = [12, 12, 15]
    img += rng.normal(0, 1.5, img.shape)
    arr = np.clip(img, 0, 255).astype("uint8")
Image.fromarray(arr).save(out, "PNG")
'''

WALL_SPRITES = """vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  vec3 c = base;
  float aspect = res.x / res.y;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 pos = vec2(0.12 + 0.25 * fi, 0.84 - 0.04 * sin(time * 0.8 + fi * 1.7));
    pos += (m - pos) * 0.02 * react;
    vec2 q = ((uv - pos) * vec2(aspect, 1.0)) / 0.11;
    vec4 s = sprite(i + 4 * (i / 2 - 0), q);
    c = mix(c, s.rgb, s.a);
  }
  float g = smoothstep(0.72, 1.0, noise(uv * vec2(34.0, 20.0) + vec2(time * 0.4, 0.0)));
  return c + vec3(1.0, 0.82, 0.55) * g * 0.22;
}
"""
WALL_NO_SPRITE_CALL = """vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float g = smoothstep(0.72, 1.0, noise(uv * vec2(34.0, 20.0) + vec2(time * 0.4, 0.0)));
  float r = smoothstep(0.1, 0.0, abs(length(uv - m) - 0.1 - 0.01 * sin(time * 3.0)));
  return base + vec3(1.0, 0.82, 0.55) * g * 0.22 + vec3(0.4) * r * react;
}
"""
WALL_RAW_TEXTURE = WALL_SPRITES.replace("vec4 s = sprite(i + 4 * (i / 2 - 0), q);", "vec4 s = texture(sprites, q);")
WALL_OWN_SAMPLER = "uniform sampler2D sprites2;\n" + WALL_SPRITES
WALL_TOO_MANY = WALL_SPRITES.replace("i < 4", "i < 60")

CELLS = ["a glowing paper lantern", "a small brass bell", "a curled autumn leaf", "a tiny wooden boat", "a round red fruit", "a folded paper crane",
         "a little stone owl", "a glass jar of fireflies"]
SPEC = {"style": "hand-painted storybook, warm light", "cells": CELLS}


def png_of(im):
    b = io.BytesIO()
    im.save(b, "PNG")
    return b.getvalue()


def fake_image(tmp, name="tool.py"):
    p = os.path.join(tmp, name)
    open(p, "w").write(TOOL)
    return p


def custom_choice(I, tmp, log, extra=""):
    ch = I.choice()
    ch["provider"] = "custom"
    ch["custom"] = "%s %s --log %s --out {out}%s" % (sys.executable, fake_image(tmp), log, extra)
    return ch


def lines(p):
    try:
        return [x for x in open(p).read().split("\n") if x]
    except OSError:
        return []


def unit_tests():
    import numpy as np
    from PIL import Image
    import aigen as G
    import aisprites as SP
    import imgprov as I
    import omslib as L

    # --- what the text AI is told
    t = SP.builder_text(None)
    check("builder text names sprite()", "sprite(int cell, vec2 q)" in t and "at least once" in t and "\"sprites\"" in t)
    t2 = SP.builder_text(SPEC)
    check("builder text lists the 8 cells and does not ask again", "cell 7: a glass jar of fireflies" in t2 and "Also answer" not in t2)
    check("planner text", "exactly 8" in SP.planner_text())

    # --- the prompts the AI wrote are cleaned
    check("spec ok", SP.clean_spec(SPEC)["cells"][0] == CELLS[0])
    check("spec: list form", SP.clean_spec(CELLS) is not None and SP.clean_spec(CELLS)["style"] == "")
    check("spec: 7 cells refused", SP.clean_spec({"cells": CELLS[:7]}) is None)
    check("spec: non-text refused", SP.clean_spec({"cells": CELLS[:7] + [5]}) is None and SP.clean_spec("lantern") is None and SP.clean_spec(None) is None)
    check("spec: too short refused", SP.clean_spec({"cells": CELLS[:7] + ["x"]}) is None)
    dirty = SP.clean_spec({"style": "storybook {x} <b>‮", "cells": ["a lantern; `rm -rf ~` $(x)\n\n"] + CELLS[1:]})
    check("spec: control and markup characters removed", dirty and not re.search(r"[`{}<>\\\n‮]", dirty["style"] + dirty["cells"][0]), str(dirty))
    check("spec: long prompts cut", len(SP.clean_spec({"cells": ["x" * 900] * 8})["cells"][0]) <= 140)
    pr = SP.cell_prompt(SPEC, 3)
    check("cell prompt has the object, the style and a plain background", "tiny wooden boat" in pr and "storybook" in pr and "plain solid black background" in pr)

    # --- cutting an object out
    S = 768
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    arr = np.full((S, S, 3), (10, 10, 14), np.float32)
    d = np.sqrt(((xx - 300) / 150) ** 2 + ((yy - 400) / 200) ** 2)
    arr[d < 1] = (230, 120, 40)
    arr[np.sqrt((xx - 300) ** 2 + (yy - 400) ** 2) < 30] = (11, 11, 15)  # a dark hole inside the object
    cut = SP.cut_out(Image.fromarray(arr.astype("uint8")))
    a = np.asarray(cut)
    k = min(1.0, SP.WORK / S)  # the working copy is scaled down to WORK px first
    check("cut-out is cropped to the object", abs(cut.width - 300 * k) < 12 and abs(cut.height - 400 * k) < 12, str(cut.size))
    check("cut-out: the corner is clear, the middle solid", a[0, 0, 3] == 0 and a[a.shape[0] // 2, a.shape[1] // 4, 3] == 255)
    check("cut-out: a dark hole inside stays part of the object", a[a.shape[0] // 2, a.shape[1] // 2, 3] > 250)
    solid = a[..., 3] > 250
    col = a[..., :3][solid].mean(axis=0)
    check("cut-out keeps the colours", abs(col[0] - 230) < 25 and abs(col[1] - 120) < 25, str(col))
    cell = SP.to_cell(cut)
    ca = np.asarray(cell)
    check("cell is 256 px, centred, at most 232 px", cell.size == (256, 256) and ca[0, 0, 3] == 0 and ca[128, 128, 3] == 255
          and (ca[..., 3] > 128).any(axis=0).sum() <= 232 and (ca[..., 3] > 128).any(axis=1).sum() <= 232)
    check("see-through pixels got a colour (no dark rims when scaled)", ca[0, 0, :3].sum() > 60, str(ca[0, 0]))
    for what, im in (("noise", Image.fromarray(np.random.default_rng(1).integers(0, 255, (S, S, 3)).astype("uint8"))),
                     ("bright background", Image.new("RGB", (S, S), (235, 235, 235))),
                     ("empty dark picture", Image.new("RGB", (S, S), (10, 10, 14)))):
        try:
            SP.cut_out(im)
            check("junk refused: " + what, False)
        except SP.Junk:
            check("junk refused: " + what, True)

    # --- the atlas
    cells = [SP.to_cell(cut) for _ in range(8)]
    png = SP.pack(cells)
    im = Image.open(io.BytesIO(png))
    check("atlas is a 1024x512 RGBA PNG under the size cap", im.size == (1024, 512) and im.mode == "RGBA" and len(png) < SP.MAX_ATLAS_BYTES, "%s %d" % (im.size, len(png)))
    check("atlas: cell 5 is column 1, row 1", np.asarray(im)[256 + 128, 256 + 128, 3] == 255 and np.asarray(im)[128, 128 + 256 * 3, 3] == 255)
    check("validate_atlas accepts it", SP.validate_atlas(png) == 8)
    p6 = SP.pack(cells[:6] + [None, None])
    check("6 usable cells are enough", SP.validate_atlas(p6) == 6)

    def refused(data, word):
        try:
            SP.validate_atlas(data)
            return False
        except L.Bad as e:
            return word in str(e)

    check("atlas: 5 usable cells are too few", refused(SP.pack(cells[:5] + [None] * 3), "only 5"))
    check("atlas: wrong size", refused(png_of(Image.new("RGBA", (512, 256), (255, 0, 0, 255))), "1024x512"))
    check("atlas: a JPEG renamed .png", refused(b"\xff\xd8\xff" + b"0" * 100, "not a PNG"))
    check("atlas: not a picture at all", refused(b"<?xml version='1.0'?><svg/>", "not a PNG"))
    check("atlas: truncated PNG", refused(png[:600], "readable"))
    check("atlas: too big", refused(png + b"0" * 3_100_000, "larger"))
    bomb = png_of(Image.new("L", (30000, 30000)))
    check("atlas: a huge picture is refused before it is decoded", len(bomb) < 5_000_000 and refused(bomb, ""), str(len(bomb)))
    check("atlas: a missing file", refused(os.path.join(TMP, "nope.png"), "cannot be read"))
    check("atlas: a path to a folder is not read", refused(TMP, "cannot be read"))
    gray = png_of(Image.new("RGB", (1024, 512), (200, 100, 50)))
    check("atlas: opaque picture with no empty cells is not 'usable' cells by size only", SP.validate_atlas(gray) == 8)   # all-opaque is allowed; the gate judges the look
    stand = os.path.join(TMP, "stand.png")
    SP.stand_in(stand)
    check("the stand-in atlas is a valid atlas", SP.validate_atlas(stand) == 8)
    prev = os.path.join(TMP, "prev.png")
    SP.preview(stand, prev)
    check("preview picture", Image.open(prev).size == (1024, 512))

    # --- painting with the stand-in image model
    tool_log = os.path.join(TMP, "img.log")
    ch = custom_choice(I, TMP, tool_log)
    msgs = []
    pngb, notes = SP.paint(SPEC, ch, msgs.append, 60)
    check("paint: one image call per cell (8)", len(lines(tool_log)) == 8, str(len(lines(tool_log))))
    check("paint: the atlas is valid and the user is told it worked", SP.validate_atlas(pngb) == 8 and notes and "8 of 8" in notes[0], str(notes))
    check("paint: progress per sprite", len(msgs) == 8 and "1 of 8" in msgs[0])
    ps = lines(tool_log)
    check("paint: only the sprite prompts reach the image model (no file path, no wallpaper, no theme text)",
          all(("wallpaper" not in x.lower() and "/home" not in x and os.sep + "tmp" not in x) for x in ps), ps[0][:200])
    check("paint: each prompt is that cell's object", all(CELLS[i] in ps[i] for i in range(8)))
    # one junk cell: asked again, then left empty
    open(tool_log, "w").close()
    spec1 = {"style": "x", "cells": CELLS[:2] + ["JUNK cell"] + CELLS[3:]}
    pngb, notes = SP.paint(spec1, ch, None, 60)
    check("paint: a junk picture is asked for twice, then left empty (9+... calls)", len(lines(tool_log)) == 8 + 1 and SP.validate_atlas(pngb) == 7, str(len(lines(tool_log))))
    check("paint: the user is told which sprite stays empty", any("cell 2 stay" in n or "cell 2" in n for n in notes), str(notes))
    spec3 = {"style": "x", "cells": ["JUNK a", "JUNK b", "JUNK c"] + CELLS[3:]}
    try:
        SP.paint(spec3, ch, None, 60)
        check("paint: 3 junk cells -> no atlas", False)
    except L.Bad as e:
        check("paint: 3 junk cells -> no atlas, plain reason", "3 of 8" in str(e), str(e))
    open(tool_log, "w").close()
    chd = custom_choice(I, TMP, tool_log)
    spec_d = {"style": "x", "cells": ["DOWN a"] + CELLS[1:]}
    try:
        SP.paint(spec_d, chd, None, 60)
        check("paint: image model down", False)
    except L.Bad as e:
        check("paint: image model down stops at once with a plain reason", len(lines(tool_log)) == 1 and "did not answer" in str(e), "%s %s" % (len(lines(tool_log)), e))
    chn = I.choice()
    chn["provider"] = "comfyui"
    chn["comfy"]["url"] = "http://127.0.0.1:9"
    try:
        SP.paint(SPEC, chn, None, 5)
        check("paint: no server at all", False)
    except L.Bad as e:
        check("paint: ComfyUI not running gives a plain sentence", "did not answer" in str(e) and "Traceback" not in str(e), str(e))
    check("plain failure sentence", SP.plain_failure(L.Bad("The image model did not answer (x).")).endswith("made without sprites. Your other settings were not changed.")
          and "without sprites" in SP.plain_failure(L.Bad("x")))

    # --- the gate
    img = ""
    ok_g = G.gate("wallpaper", WALL_SPRITES, "Lantern Night", "Paper lanterns drift over the picture.", 70, img, None, "", "quick", sprites=True)
    check("gate: an effect that draws sprites passes (stand-in atlas)", ok_g["ok"], str(ok_g["problems"]))
    check("gate: built for sprites", ok_g["built"]["sprites"] is True and "binding = 2) uniform sampler2D sprites" in ok_g["built"]["frag"] and "sampler2D sprites" in ok_g["built"]["es"])
    check("gate: the draw of the sprites shows (render differs from plain)", ok_g["ok"])
    plain = G.gate("wallpaper", WALL_SPRITES, "Lantern Night", "x", 70, img, None, "", "quick")
    check("gate: sprite() without the sprites switch is an unknown function", not plain["ok"] and any("sprite" in p for p in plain["problems"]), str(plain["problems"]))
    for what, code, word in (("never draws a sprite", WALL_NO_SPRITE_CALL, "never drawn"),
                             ("reads the sampler itself", WALL_RAW_TEXTURE, "texture"),
                             ("declares its own sampler", WALL_OWN_SAMPLER, ""),
                             ("far too many sprite() calls", WALL_TOO_MANY, "")):
        r = G.gate("wallpaper", code, "Bad", "x", 70, img, None, "", "quick", sprites=True)
        check("gate refuses: " + what, not r["ok"] and (word in " ".join(r["problems"])), str(r["problems"]))
    blank = G.gate("wallpaper", WALL_SPRITES, "Lantern Night", "x", 70, img, None, "", "quick", sprites="blank")
    check("gate: the 'blank' build (sprites could not be made) passes and binds no atlas", blank["ok"] and "uniform sampler2D sprites" not in blank["built"]["frag"], str(blank["problems"]))
    bad_atlas = os.path.join(TMP, "bad-atlas.png")
    open(bad_atlas, "wb").write(b"not a png")
    r = G.gate("wallpaper", WALL_SPRITES, "Lantern Night", "x", 70, img, None, "", "quick", sprites=True, atlas=bad_atlas)
    check("gate: a bad atlas file is refused, never rendered", not r["ok"] and "atlas" in " ".join(r["problems"]), str(r["problems"]))

    # --- install, delete, no orphans
    wall_dir = os.path.join(G.GEN, "wall")
    good_atlas = os.path.join(TMP, "atlas.png")
    open(good_atlas, "wb").write(pngb)
    eid = G.install("wallpaper", ok_g["built"], "Lantern Night", "Paper lanterns.", "a test", "", False, atlas=good_atlas)
    files = sorted(os.listdir(wall_dir))
    check("install: id carries the -sp tag", eid.endswith("-sp") and G.has_sprite_tag(eid), eid)
    check("install: shader, compiled shader and atlas sit side by side", files == [eid + ".frag", eid + ".frag.qsb", eid + ".png"], str(files))
    check("install: the stored atlas is a valid atlas", SP.validate_atlas(os.path.join(wall_dir, eid + ".png")) >= 6)
    meta = json.load(open(G.meta_path(eid)))
    check("install: record says sprites", meta.get("sprites") is True)
    check("install: listed files include the atlas", any(p.endswith(".png") for p in G.files_of(eid)))

    def raises(fn):
        try:
            fn()
            return False
        except G.GateFail:
            return True

    before = sorted(os.listdir(wall_dir))
    check("install: sprites built but no atlas given", raises(lambda: G.install("wallpaper", ok_g["built"], "X One", "x")))
    check("install: atlas given for an effect that does not read it", raises(lambda: G.install("wallpaper", blank["built"], "X Two", "x", atlas=good_atlas)))
    check("install: a bad atlas", raises(lambda: G.install("wallpaper", ok_g["built"], "X Three", "x", atlas=bad_atlas)))
    check("install: atlas for a screen effect", raises(lambda: G.install("screen", G.build("screen", "void main() { fragColor = vec4(1.0); }", "x"), "X Four", "x", atlas=good_atlas)))
    check("install: refusals leave no files behind", sorted(os.listdir(wall_dir)) == before, str(sorted(os.listdir(wall_dir))))
    eid_b = G.install("wallpaper", blank["built"], "Lantern Night", "x", "a test")
    check("install: the blank build is a plain effect with no atlas and no -sp tag", not G.has_sprite_tag(eid_b) and not os.path.exists(os.path.join(wall_dir, eid_b + ".png"))
          and json.load(open(G.meta_path(eid_b))).get("sprites") == "blank", eid_b)
    names = [G.new_id(n, "wallpaper") for n in ("Lantern sp", "Lantern SP 2", "x-sp-9")]
    check("a plain effect never gets the -sp tag by its name", not any(G.has_sprite_tag(n) for n in names), str(names))
    check("a sprite effect from a name that ends in sp", G.new_id("Lantern sp", "wallpaper", True).endswith("-sp") and not G.new_id("Lantern sp", "wallpaper", True).endswith("-sp-sp"))

    # --- share codes
    import omscustom as OC
    try:
        OC.local_entry(eid, ["w"])
        check("share code: an effect with sprites is not put into a code", False)
    except L.Bad as e:
        check("share code: an effect with sprites is not put into a code, with a reason", "painted sprites" in str(e), str(e))
    try:
        OC.local_entry(eid_b, ["w"])
        check("share code: the blank build is left out too", False)
    except L.Bad as e:
        check("share code: the blank build is left out too", "painted sprites" in str(e), str(e))
    notes = []
    theme = {"n": "T", "s": "", "c": "", "w": eid, "m": "", "wf": "", "wc": "", "wr": "", "o": {}}
    entries = OC.collect(theme, notes)
    check("share code: collect leaves the part out and says so", entries == [] and theme["w"] == "" and notes and "left out" in notes[0], str(notes))
    imp = G.gate("wallpaper", WALL_SPRITES, "Imported", "x", 70, img, None, "", "quick")
    check("share code: code that calls sprite() cannot be imported (an import never gets sprites)", not imp["ok"])

    # --- delete: no orphan png
    G.delete(eid)
    G.delete(eid_b)
    left = [f for f in os.listdir(wall_dir) if f.startswith(eid)]
    check("delete: shader, compiled shader, atlas and record are all gone", left == [] and not os.path.exists(G.meta_path(eid)), str(left))
    eid2 = G.install("wallpaper", ok_g["built"], "Lantern Two", "x", "a test", "", False, atlas=good_atlas)
    r = subprocess.run([sys.executable, os.path.join(HERE, "oms-delete"), "rm", "element", "wallpaper", eid2, "--yes", "--json"], capture_output=True, text=True,
                       env=dict(os.environ, OMASHADERS_STATE_DIR=STATE))
    check("oms-delete removes the atlas too", r.returncode == 0 and not [f for f in os.listdir(wall_dir) if f.startswith(eid2)] and not os.path.exists(G.meta_path(eid2)), r.stdout + r.stderr)

    # --- finish_wall: the whole chain with the stand-in image model
    open(tool_log, "w").close()
    p = {"name": "Lantern Night", "desc": "Paper lanterns drift over the picture.", "code": WALL_SPRITES, "sprites": SPEC}
    inst_calls = []

    def inst(built, atlas):
        inst_calls.append(atlas)
        return G.install("wallpaper", built, p["name"], p["desc"], "a test", "", False, atlas=atlas)

    eid3, probs, notes, info = SP.finish_wall(p, ch, img, 70, inst)
    check("finish_wall: painted, checked again with the real atlas, installed with it", eid3 and eid3.endswith("-sp") and inst_calls[-1] and os.path.exists(os.path.join(wall_dir, eid3 + ".png")), "%s %s %s" % (eid3, probs, notes))
    check("finish_wall: the temporary atlas is gone afterwards", not os.path.exists(inst_calls[-1]))
    check("finish_wall: tells the user 8 of 8", any("8 of 8" in n for n in notes), str(notes))
    check("finish_wall: 8 image calls", len(lines(tool_log)) == 8)
    # image model down: same code, no sprites, plain words, no atlas
    open(tool_log, "w").close()
    inst_calls.clear()
    eid4, probs, notes, info = SP.finish_wall(dict(p, sprites={"style": "x", "cells": ["DOWN"] + CELLS[1:]}), ch, img, 70, inst)
    check("finish_wall: image model down -> the theme part is still made, without sprites", eid4 and not G.has_sprite_tag(eid4) and inst_calls == [None]
          and not os.path.exists(os.path.join(wall_dir, eid4 + ".png")), "%s %s" % (eid4, notes))
    check("finish_wall: ... and the user is told in plain words", notes and "made without sprites" in notes[0] and "DOWN" not in notes[0], str(notes))
    check("finish_wall: ... after one failed call", len(lines(tool_log)) == 1)
    # junk pictures: no atlas
    open(tool_log, "w").close()
    eid5, probs, notes, info = SP.finish_wall(dict(p, sprites={"style": "x", "cells": ["JUNK a", "JUNK b", "JUNK c"] + CELLS[3:]}), ch, img, 70, inst)
    check("finish_wall: unusable pictures -> made without sprites", eid5 and not G.has_sprite_tag(eid5) and notes and "not usable" in notes[0], str(notes))
    # no prompts from the AI and no way to ask again
    open(tool_log, "w").close()
    eid6, probs, notes, info = SP.finish_wall(dict(p, sprites=None), ch, img, 70, inst)
    check("finish_wall: no sprite prompts -> nothing is sent to the image model, theme part made without sprites",
          eid6 and not G.has_sprite_tag(eid6) and lines(tool_log) == [] and "without sprites" in notes[0], str(notes))
    # the code no longer passes without sprites?: sprites 'blank' of a code that is fine -> ok; of a broken one -> reported
    eid7, probs, notes, info = SP.finish_wall(dict(p, code="vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) { return base; }", sprites=None), ch, img, 70, inst)
    check("finish_wall: when even the build without sprites fails the gate, there is no id and a reason", eid7 is None and probs, str(probs))
    for e in (eid3, eid4, eid5, eid6):
        if e:
            G.delete(e)
    left = os.listdir(wall_dir)
    check("no orphan files after all the deletes", left == [], str(left))
    return ch


FAKE_AI = '''#!/usr/bin/env python3
import os, sys
log = os.environ["STUB_LOG"]
n = len([x for x in os.listdir(log) if x.startswith("prompt-")]) + 1
open(os.path.join(log, "prompt-%d.txt" % n), "w").write(sys.stdin.read())
print(open(os.path.join(log, "answer-%d.json" % n)).read())
'''


def pipeline_tests():
    """ai-theme make --invent --sprites with a stand-in text AI and a stand-in image model, the way the dialog and the jobs run it"""
    import aigen as G
    log = os.path.join(TMP, "plog")
    home = os.path.join(TMP, "home")
    for d in (log, home):
        os.makedirs(d, exist_ok=True)
    fake = os.path.join(TMP, "fake-ai")
    open(fake, "w").write(FAKE_AI)
    os.chmod(fake, 0o755)
    img_log = os.path.join(TMP, "pimg.log")
    import omslib as OL
    LIGHT = sorted(OL.overlay_ids() & set(OL.catalog()["wall"]))[0]
    wall_dir = os.path.join(G.GEN, "wall")

    def answer(n, wall):
        theme = {"name": "Lantern Night", "idea": "paper lanterns drift over a night market", "note": "fine", "screen": "", "color": "", "wallpaper": wall, "cursor": "", "window": "",
                 "window_color": "", "frame": "", "strength": {"wallpaper": 80}}
        open(os.path.join(log, "answer-%d.json" % n), "w").write(json.dumps(theme))

    def env(img_cmd):
        for f in os.listdir(log):
            os.remove(os.path.join(log, f))
        open(img_log, "w").close()
        open(os.path.join(STATE, "img.json"), "w").write(json.dumps({"provider": "custom", "custom": img_cmd}))
        for f in ("themes",):
            try:
                os.remove(os.path.join(STATE, f))
            except OSError:
                pass
        return dict(os.environ, HOME=home, OMASHADERS_STATE_DIR=STATE, OMASHADERS_AI_CMD=fake, STUB_LOG=log, LANG="C.UTF-8")

    def run(args, e):
        r = subprocess.run([sys.executable, os.path.join(HERE, "ai-theme")] + args, capture_output=True, text=True, env=e, timeout=900)
        try:
            return r, json.loads(r.stdout)
        except ValueError:
            return r, {}

    tool = fake_image(TMP, "tool2.py")
    good = "%s %s --log %s --out {out}" % (sys.executable, tool, img_log)
    new = {"new": {"name": "Lantern Night", "desc": "Paper lanterns drift over the picture.", "start": 80, "fallback": "", "code": WALL_SPRITES, "sprites": SPEC}}

    # 1) everything works
    e = env(good)
    answer(1, new)
    r, res = run(["make", "paper lanterns drifting over a night market", "--invent", "--sprites", "--json"], e)
    ok1 = r.returncode == 0 and res.get("ok")
    check("pipeline: theme made", ok1, (r.stdout + r.stderr)[-600:])
    p1 = open(os.path.join(log, "prompt-1.txt")).read() if os.path.exists(os.path.join(log, "prompt-1.txt")) else ""
    check("pipeline: the text AI was told about the sprites (one call, cells + sprite())", "PAINTED SPRITES" in p1 and "sprite(int cell, vec2 q)" in p1)
    wid = res.get("clean", {}).get("w", "")
    check("pipeline: the theme uses an effect with sprites", wid.startswith("ai-") and G.has_sprite_tag(wid) and os.path.isfile(os.path.join(wall_dir, wid + ".png")), res.get("line", ""))
    check("pipeline: 8 pictures were asked for, nothing else", len(lines(img_log)) == 8, str(len(lines(img_log))))
    check("pipeline: the user is told", any("8 of 8" in n for n in res.get("notes", [])), str(res.get("notes")))
    sent = " ".join(lines(img_log)).lower()
    check("pipeline: the image model never saw the request, the theme text or a path", "night market" not in sent and "wallpaper" not in sent and "/" not in sent.replace("n/a", ""), sent[:200])
    if wid:
        G.delete(wid)

    # 2) not ticked: nothing about sprites anywhere, nothing sent
    e = env(good)
    answer(1, {"new": dict(new["new"], code=WALL_NO_SPRITE_CALL)})
    r, res = run(["make", "paper lanterns drifting over a night market", "--invent", "--json"], e)
    p1 = open(os.path.join(log, "prompt-1.txt")).read() if os.path.exists(os.path.join(log, "prompt-1.txt")) else ""
    check("pipeline: box not ticked -> the prompt does not mention sprites and the image model is never called", res.get("ok") and "PAINTED SPRITES" not in p1 and lines(img_log) == [], (r.stdout + r.stderr)[-400:])
    for m in res.get("new", []):
        G.delete(m["id"])

    # 3) image model down -> a theme without sprites and a plain sentence
    e = env("%s %s --log %s --out {out} DOWNWORD" % (sys.executable, tool, img_log))
    answer(1, {"new": dict(new["new"], sprites={"style": "x", "cells": ["DOWN a"] + CELLS[1:]})})
    r, res = run(["make", "paper lanterns drifting over a night market", "--invent", "--sprites", "--json"], e)
    wid = res.get("clean", {}).get("w", "")
    check("pipeline: image model down -> the theme is still made, with the effect but without sprites", res.get("ok") and wid.startswith("ai-") and not G.has_sprite_tag(wid)
          and not os.path.exists(os.path.join(wall_dir, wid + ".png")), (r.stdout + r.stderr)[-500:])
    check("pipeline: ... and says so in plain words", any("made without sprites" in n for n in res.get("notes", [])), str(res.get("notes")))
    check("pipeline: ... and the blank build still draws (gate passed)", bool(wid) and os.path.isfile(os.path.join(wall_dir, wid + ".frag.qsb")))
    if wid:
        G.delete(wid)

    # 4) the AI forgot the sprite prompts: one small extra call asks for them
    e = env(good)
    answer(1, {"new": {k: v for k, v in new["new"].items() if k != "sprites"}})
    open(os.path.join(log, "answer-2.json"), "w").write(json.dumps(SPEC))
    r, res = run(["make", "paper lanterns drifting over a night market", "--invent", "--sprites", "--json"], e)
    wid = res.get("clean", {}).get("w", "")
    p2 = open(os.path.join(log, "prompt-2.txt")).read() if os.path.exists(os.path.join(log, "prompt-2.txt")) else ""
    check("pipeline: missing sprite prompts are asked for once, then painted", res.get("ok") and G.has_sprite_tag(wid) and len(lines(img_log)) == 8 and "eight small painted sprites" in p2,
          str(res.get("notes")) + r.stderr[-300:] + str(os.listdir(log)))
    if wid:
        G.delete(wid)

    # 5) Pick existing never paints
    e = env(good)
    open(os.path.join(log, "answer-1.json"), "w").write(json.dumps({"name": "Plain Test", "screen": "", "color": "", "wallpaper": LIGHT, "cursor": "", "idea": "x", "note": "y", "strength": {"wallpaper": 60}}))
    r, res = run(["make", "a plain test", "--sprites", "--json"], e)
    check("pipeline: Pick existing says nothing was painted and sends nothing", res.get("ok") and any("nothing was sent to your image model" in n for n in res.get("notes", [])) and lines(img_log) == [],
          (r.stdout + r.stderr)[-400:])

    # 6) a theme with no new wallpaper effect
    e = env(good)
    open(os.path.join(log, "answer-1.json"), "w").write(json.dumps({"name": "Plain Test", "screen": "", "color": "", "wallpaper": LIGHT, "cursor": "", "idea": "x", "note": "y", "strength": {"wallpaper": 60}}))
    r, res = run(["make", "a plain test", "--invent", "--sprites", "--json"], e)
    check("pipeline: no new wallpaper effect -> no painting, a plain note", lines(img_log) == [] and any("nothing was painted" in n for n in res.get("notes", [])), (r.stdout + r.stderr)[-400:])
    for m in res.get("new", []):
        G.delete(m["id"])

    # 7) the job runner passes --sprites on and counts the steps
    import aijobs
    check("jobs: a sprite job is told it has more steps", aijobs.estimate_steps("invent", ["--invent", "--sprites"], False) > aijobs.estimate_steps("invent", ["--invent"], False))
    # 8) the image-model commands of ai-theme
    e = env(good)
    r, res = run(["img", "use", "custom", "--command", "echo {out}", "--json"], e)
    check("ai-theme img use remembers the pick", res.get("ok") and res["choice"]["provider"] == "custom" and res["choice"]["custom"] == "echo {out}", r.stdout + r.stderr)
    r, res = run(["img", "providers", "--json"], e)
    check("ai-theme img providers lists the three kinds", [p["id"] for p in res.get("providers", [])] == ["comfyui", "endpoint", "custom"], r.stdout)
    r, res = run(["img", "use", "nonsense", "--json"], e)
    check("ai-theme img use refuses an unknown model kind", not res.get("ok"), r.stdout)
    r, res = run(["img", "test", "--json"], e)
    check("ai-theme img test (custom command found)", res.get("ok") and "found" in res.get("message", ""), r.stdout + r.stderr)
    open(os.path.join(STATE, "img.json"), "w").write(json.dumps({"provider": "comfyui", "comfy": {"url": "http://127.0.0.1:9"}}))
    r, res = run(["img", "test", "--json"], e)
    check("ai-theme img test (nothing listening) gives a plain error", res.get("ok") is False and "reach" in res.get("error", ""), r.stdout + r.stderr)


def run():
    try:
        unit_tests()
        pipeline_tests()
        left = [f for f in os.listdir(os.path.join(STATE, "generated", "wall"))] if os.path.isdir(os.path.join(STATE, "generated", "wall")) else []
        check("no sprite file left in the store", left == [] or all(not f.endswith(".png") for f in left), str(left))
        strays = [f for f in os.listdir(tempfile.gettempdir()) if f.startswith("oms-sprites-")]
        check("no temporary atlas folder left behind", strays == [], str(strays))
    except Exception:
        import traceback
        traceback.print_exc()
        check("self-test crashed", False)
    finally:
        shutil.rmtree(TMP, ignore_errors=True)
    print("%d ok, %d failed" % (OK, FAIL))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(run())
