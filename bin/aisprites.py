"""aisprites: painted sprites for an AI-made wallpaper effect, made with the user's OWN image model (bin/imgprov.py).

  aisprites selftest             offline checks (a stand-in image server, no real model)

The optional step of the AI theme dialog "Painted sprites (uses your image model)". The text AI writes the wallpaper effect AND eight short
sprite prompts (one per cell). The effect is gated as always (bin/aigen.py) against a stand-in atlas. Only after it passed, and only when the
user pressed create with the box ticked, one picture per cell is asked from the image model; the plain background is cut away, the
object is centred in its cell and the eight cells are packed into one atlas:

  1024 x 512 pixels, RGBA PNG, 4 x 2 cells of 256 px, cell N = column N % 4, row N // 4, the object centred and at most 232 px wide
  (the same layout as wallpaper-effects/pumpkin-night.png). The effect reads it with the template's `vec4 sprite(int cell, vec2 q)`.

Sprites are DATA: nothing the image model or the text AI writes is ever run. A picture from the image model is only read by Pillow after its
magic number was checked (imgprov), the atlas is checked again before it is installed (validate_atlas), and an atlas is never taken from a
share code. If the image model is down or its pictures are junk the theme is made WITHOUT sprites and the user is told in plain words.
"""
import sys
sys.dont_write_bytecode = True  # a __pycache__ in the plugin folder would make the shell reload the plugin
import io
import os
import re

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import imgprov as I  # noqa: E402
import omslib as L  # noqa: E402

CELL = 256
COLS, ROWS = 4, 2
CELLS = COLS * ROWS
ATLAS_SIZE = (COLS * CELL, ROWS * CELL)
FIT = 232                    # the object is scaled to fit this box in the middle of its cell (the shader draws q in -1..1 as 232 px)
PAINT_SIZE = 768             # what the image model is asked for
MAX_ATLAS_BYTES = 3_000_000
MIN_GOOD = 6                 # fewer usable cells than this and the whole atlas is dropped
CANDIDATES = 3               # pictures painted per cell; the one that scores best is kept (OMS_SPRITE_CANDIDATES overrides, 1 = paint once)
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
PREFIX_STYLE = "painted game sprite, soft rim light, vivid colours"
SUFFIX = "single object, centred, whole object in view, isolated on a plain solid black background, no text, no border, nothing else"
NEGATIVE = "text, letters, watermark, signature, frame, border, multiple objects, scenery, landscape, background, ground, floor, table, cropped, blurry, low quality"


# ------------------------------------------------------------------ what the text AI is told
def builder_text(spec):
    """the part of the Builder prompt (wallpaper only) that explains the eight sprite cells"""
    rows = ["# PAINTED SPRITES (this wallpaper effect only)",
            "The user's own image model will paint eight small pictures (sprites) for this effect, one per cell 0..7. Cell N shows what sprite prompt N says:"]
    if spec:
        rows += ["  cell %d: %s" % (i, c) for i, c in enumerate(spec["cells"])]
    else:
        rows.append("  (you choose them: see the `sprites` key at the end)")
    rows += ["Draw them with the function `vec4 sprite(int cell, vec2 q)` that the template offers: q is the place inside the sprite from -1.0 to 1.0 "
             "(0,0 is the middle; outside that square it returns transparent). It returns the colour and the alpha, so draw one like this:",
             "  vec4 s = sprite(3, q); c = mix(c, s.rgb, s.a);   // c = the colour your overlay() returns so far",
             "`q` is yours to compute: take the place on the screen, subtract where the sprite sits, divide by its size, and rotate or mirror it as you like "
             "(sprites that lean away from the pointer m, bob, drift and sway are what makes this good). Make a sprite small: 3 to 12 percent of the screen height. "
             "Keep them near the edges and corners so the picture stays the picture, and use the cell that fits each place.",
             "Do not declare a sampler and do not call texture(): sprite() is the only way to read the sprites. A sprite() call counts as a texture sample "
             "(at most 40 calls per pixel, loops counted). Use sprite() at least once. The effect must still look alive and light without any sprite "
             "(some glints, glow or motion of your own), because the sprites may be missing."]
    if not spec:
        rows.append("Also answer with the sprite prompts, as one more key of the wallpaper's \"new\" object, next to \"code\": \"sprites\": {\"style\": \"one short phrase every sprite shares, e.g. hand-painted storybook, warm light\", "
                    "\"cells\": [exactly 8 short prompts, one object each, plain nouns like \"a glowing paper lantern\"; no background, no scene, no text]}.")
    return "\n".join(rows)


def planner_text():
    return ("# PAINTED SPRITES (optional; the user turned them on)\n"
            "The wallpaper part will get eight painted sprites from the user's image model. In the JSON add \"sprites\": {\"style\": \"one short phrase every sprite shares\", "
            "\"cells\": [exactly 8 short prompts, one object each (plain nouns like \"a glowing paper lantern\"), no background, no scene, no text]}. "
            "Pick objects that belong to the idea and that look good small, floating over a picture; mix a few sizes and poses.")


def clean_spec(raw):
    """{"style", "cells": [8 str]} from what the AI wrote, or None when it is not usable"""
    style, cells = "", None
    if isinstance(raw, dict):
        style = raw.get("style") if isinstance(raw.get("style"), str) else ""
        cells = raw.get("cells") if isinstance(raw.get("cells"), list) else raw.get("prompts")
    elif isinstance(raw, list):
        cells = raw
    if not isinstance(cells, list):
        return None
    out = []
    for c in cells:
        if not isinstance(c, str):
            return None
        c = re.sub(r"\s+", " ", re.sub(r"[^\x20-\x7e]", " ", c)).strip().strip(".")
        c = re.sub(r"[{}\[\]<>|\\`]", " ", c).strip()[:140]
        if len(c) < 3:
            return None
        out.append(c)
    if len(out) < CELLS:
        return None
    style = re.sub(r"[{}\[\]<>|\\`]", " ", re.sub(r"\s+", " ", re.sub(r"[^\x20-\x7e]", " ", style))).strip()[:100]
    return {"style": style, "cells": out[:CELLS]}


def ask_spec(ch, name, desc):
    """a small extra call to the text AI for the eight prompts, used when the main answer had none -> spec or None"""
    import aiprov as P
    import aitheme as T
    system = "You write short prompts for an image model. Answer with one JSON object only."
    prompt = ("A wallpaper effect called \"%s\" (%s) will draw eight small painted sprites over the user's picture.\nAnswer with {\"style\": \"one short phrase every sprite shares\", "
              "\"cells\": [exactly 8 short prompts, one object each, plain nouns like \"a glowing paper lantern\", no background, no scene, no text]}." % (name, desc))
    try:
        text, _usage = P.call(ch, system, prompt, None)
        return clean_spec(T.extract_json(text))
    except L.Bad:
        return None


def cell_prompt(spec, i):
    style = spec.get("style") or PREFIX_STYLE
    return "%s, %s, %s" % (spec["cells"][i], style, SUFFIX)


# ------------------------------------------------------------------ cutting an object out of its plain background
WORK = 384
NEIGH = ((1, 0), (-1, 0), (0, 1), (0, -1))


class Junk(Exception):
    pass


def _shift(a, dy, dx):
    import numpy as np
    out = np.zeros_like(a)
    h, w = a.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = a[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def _grow(a):
    return a | _shift(a, 1, 0) | _shift(a, -1, 0) | _shift(a, 0, 1) | _shift(a, 0, -1)


def cut_out(im):
    """a picture of ONE object on a plain background -> RGBA cut-out (straight alpha, colours un-mixed from the background); raises Junk"""
    return _cut(im)[0]


def _cut(im):
    """cut_out plus the numbers score() judges the picture by -> (RGBA cut-out, stats)"""
    import numpy as np
    from PIL import Image
    im = im.convert("RGB")
    if max(im.size) > WORK:      # a cell is CELL px on screen, so a smaller working copy loses nothing and keeps the flood fill fast
        k = WORK / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    rgb = np.asarray(im, dtype=np.float32) / 255.0
    h, w = rgb.shape[:2]
    m = max(4, h // 64)
    edge = np.concatenate([rgb[:m].reshape(-1, 3), rgb[-m:].reshape(-1, 3), rgb[:, :m].reshape(-1, 3), rgb[:, -m:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    if float(edge.std(axis=0).mean()) > 0.16 or float(bg.mean()) > 0.55:
        raise Junk("the background is not plain and dark")
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    bg_like = dist < 0.10
    seed = np.zeros((h, w), dtype=bool)
    seed[:m], seed[-m:], seed[:, :m], seed[:, -m:] = True, True, True, True
    outside = seed & bg_like
    for _ in range(h + w):           # the background is what touches the border; a dark hole inside the object stays part of it
        nxt = _grow(outside) & bg_like
        if (nxt == outside).all():
            break
        outside = nxt
    near = outside
    for _ in range(4):
        near = _grow(near)
    soft = np.clip((dist - 0.07) / 0.22, 0.0, 1.0)
    alpha = np.where(near, soft, 1.0).astype(np.float32)
    alpha[outside & (dist < 0.05)] = 0.0
    if (alpha > 0.5).mean() > 0.80:
        raise Junk("the background could not be told from the object")
    ys, xs = np.where(alpha > 0.2)
    if len(ys) < 0.02 * h * w:
        raise Junk("there is hardly any object in the picture")
    a3 = np.maximum(alpha, 0.04)[..., None]
    col = np.clip((rgb - bg * (1.0 - alpha[..., None])) / a3, 0.0, 1.0)
    out = np.dstack([col, alpha[..., None]])
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    pil = Image.fromarray((out * 255 + 0.5).astype("uint8"), "RGBA").crop(box)
    obj = alpha > 0.5
    bw, bh = box[2] - box[0], box[3] - box[1]
    lum = (rgb * np.array([0.299, 0.587, 0.114], np.float32)).sum(axis=2)
    edge_a = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
    stats = {"cropped": float((edge_a > 0.3).mean()),                                  # the object touches the border of the picture
             "solid": float(obj[box[1]:box[3], box[0]:box[2]].mean()),                 # how much of its bounding box it fills
             "fuzz": float(((alpha > 0.1) & (alpha < 0.9)).sum() / max(1, (alpha > 0.1).sum())),   # ragged, half-cut edges
             "detail": float(lum[obj].std()) if obj.any() else 0.0,
             "colour": float((rgb.max(axis=2) - rgb.min(axis=2))[obj].mean()) if obj.any() else 0.0,
             "size": (bw, bh), "area": float(obj.sum())}
    return pil, stats


def score(stats):
    """0..1, how good a cut-out sprite is likely to look small on a picture: whole (not cropped by the border), crisp edges, big enough once
    fitted into its cell, with some shading and colour. A plain heuristic; it only has to tell a good try from a bad one of the same prompt."""
    bw, bh = stats["size"]
    k = min(FIT / bw, FIT / bh)
    fill = min(1.0, stats["area"] * k * k / (CELL * CELL) / 0.15)
    crisp = 1.0 - min(1.0, stats["fuzz"] * 3.0)
    body = min(1.0, stats["solid"] / 0.45)
    s = 0.30 * fill + 0.20 * crisp + 0.20 * min(1.0, stats["detail"] / 0.18) + 0.15 * min(1.0, stats["colour"] / 0.35) + 0.15 * body
    return max(0.0, s - 1.5 * stats["cropped"])


def _bleed(rgba):
    """colour for the see-through pixels (taken from the nearest opaque ones), so smooth scaling on the screen does not show dark rims"""
    import numpy as np
    a = np.asarray(rgba, dtype=np.float32) / 255.0
    rgb, al = a[..., :3].copy(), a[..., 3]
    known = al > 0.02
    if not known.any():
        return rgba
    mean = rgb[known].mean(axis=0)
    for _ in range(24):
        if known.all():
            break
        k = known.astype(np.float32)
        cnt = sum(_shift(k, dy, dx) for dy, dx in NEIGH)
        fill = ~known & (cnt > 0)
        for c in range(3):
            tot = sum(_shift(rgb[..., c] * k, dy, dx) for dy, dx in NEIGH)
            rgb[..., c][fill] = tot[fill] / cnt[fill]
        known = known | fill
    for c in range(3):
        rgb[..., c][~known] = mean[c]
    a[..., :3] = rgb
    from PIL import Image
    return Image.fromarray((a * 255 + 0.5).astype("uint8"), "RGBA")


def to_cell(cut):
    """a cut-out -> one 256 px cell, the object centred and fitted into FIT px; raises Junk when it is too small to be a sprite"""
    from PIL import Image
    s = min(FIT / cut.width, FIT / cut.height)
    nw, nh = max(1, round(cut.width * s)), max(1, round(cut.height * s))
    obj = cut.convert("RGBa").resize((nw, nh), Image.LANCZOS).convert("RGBA")
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.paste(obj, ((CELL - nw) // 2, (CELL - nh) // 2))
    import numpy as np
    if (np.asarray(cell)[..., 3] > 128).mean() < 0.04:
        raise Junk("the object is too small")
    return _bleed(cell)


def pack(cells):
    """list of 8 cells (a PIL image or None for an empty one) -> PNG bytes of the atlas"""
    from PIL import Image
    atlas = Image.new("RGBA", ATLAS_SIZE, (0, 0, 0, 0))
    for i, c in enumerate(cells[:CELLS]):
        if c is not None:
            atlas.paste(c, ((i % COLS) * CELL, (i // COLS) * CELL))
    buf = io.BytesIO()
    atlas.save(buf, "PNG", optimize=True)
    return buf.getvalue()


# ------------------------------------------------------------------ checking an atlas
def validate_atlas(data):
    """data = PNG bytes or a file path. Raises L.Bad with the reason; returns the number of cells that have a picture in them"""
    from PIL import Image
    import numpy as np
    if isinstance(data, (str, os.PathLike)):
        try:
            if os.path.getsize(data) > MAX_ATLAS_BYTES:
                raise L.Bad("The sprite atlas is larger than %d MB" % (MAX_ATLAS_BYTES // 1_000_000))
            data = open(data, "rb").read()
        except OSError:
            raise L.Bad("The sprite atlas cannot be read")
    if len(data) > MAX_ATLAS_BYTES:
        raise L.Bad("The sprite atlas is larger than %d MB" % (MAX_ATLAS_BYTES // 1_000_000))
    if not data.startswith(PNG_MAGIC):
        raise L.Bad("The sprite atlas is not a PNG picture")
    try:
        im = Image.open(io.BytesIO(data))
        im.verify()
        im = Image.open(io.BytesIO(data))
        if im.format != "PNG" or im.size != ATLAS_SIZE:
            raise L.Bad("The sprite atlas must be a PNG of %dx%d pixels" % ATLAS_SIZE)
        a = np.asarray(im.convert("RGBA"))[..., 3]
    except L.Bad:
        raise
    except Exception:
        raise L.Bad("The sprite atlas is not a readable PNG picture")
    n = 0
    for i in range(CELLS):
        c = a[(i // COLS) * CELL:(i // COLS + 1) * CELL, (i % COLS) * CELL:(i % COLS + 1) * CELL]
        if (c > 128).mean() >= 0.02:
            n += 1
    if n < MIN_GOOD:
        raise L.Bad("The sprite atlas has only %d usable pictures" % n)
    return n


def stand_in(path):
    """a deterministic atlas for the safety check: eight different soft blobs, so the effect is judged with sprites of a normal size and
    colour but without any image model having run"""
    import numpy as np
    from PIL import Image
    yy, xx = np.mgrid[0:CELL, 0:CELL].astype(np.float32)
    cols = [(1.0, 0.55, 0.15), (0.35, 0.8, 1.0), (0.9, 0.35, 0.8), (0.55, 1.0, 0.45), (1.0, 0.9, 0.3), (0.6, 0.5, 1.0), (1.0, 0.4, 0.35), (0.8, 0.95, 0.9)]
    atlas = np.zeros((ATLAS_SIZE[1], ATLAS_SIZE[0], 4), dtype=np.float32)
    for i in range(CELLS):
        rx, ry = 100 + 12 * (i % 3), 92 + 14 * (i % 2)
        d = np.sqrt(((xx - 128) / rx) ** 2 + ((yy - 128 - 4 * (i % 3)) / ry) ** 2)
        a = np.clip((1.0 - d) / 0.12, 0.0, 1.0)
        shade = 0.75 + 0.25 * np.clip(1.0 - d, 0, 1) + 0.12 * np.sin(xx / 17.0 + i)
        cell = np.dstack([c * shade for c in cols[i]] + [a])
        atlas[(i // COLS) * CELL:(i // COLS + 1) * CELL, (i % COLS) * CELL:(i % COLS + 1) * CELL] = cell
    Image.fromarray((np.clip(atlas, 0, 1) * 255 + 0.5).astype("uint8"), "RGBA").save(path, "PNG")


def preview(atlas_path, out_png):
    """the atlas on a dark chequerboard, for looking at (and for the contact sheet in the tests)"""
    import numpy as np
    from PIL import Image
    im = Image.open(atlas_path).convert("RGBA")
    yy, xx = np.mgrid[0:im.height, 0:im.width]
    chk = (((xx // 16) + (yy // 16)) % 2 * 24 + 40).astype("uint8")
    bg = Image.fromarray(np.dstack([chk, chk, chk, np.full_like(chk, 255)]), "RGBA")
    bg.alpha_composite(im)
    bg.convert("RGB").save(out_png)


# ------------------------------------------------------------------ painting
def candidates_wanted():
    try:
        return max(1, min(5, int(os.environ.get("OMS_SPRITE_CANDIDATES", CANDIDATES))))
    except ValueError:
        return CANDIDATES


def paint(spec, ch, progress=lambda m: None, timeout=240, candidates=None):
    """`candidates` pictures per cell from the image model (default CANDIDATES), the best-scoring cut-out is kept -> (atlas PNG bytes, [notes]);
    raises L.Bad (plain words) when no usable atlas can be made.
    A connection problem stops at once (the theme is then made without sprites); a picture that is not an object on a plain background
    does not count as a candidate, one extra try is allowed for it, and a cell without any usable picture stays empty."""
    from PIL import Image
    progress = progress or (lambda m: None)
    want = candidates or candidates_wanted()
    cells, bad = [], []
    for i in range(CELLS):
        best, best_score, got = None, -1.0, 0
        for attempt in range(want + 1):
            if got >= want:
                break
            progress("Painting sprite %d of %d with your image model…" % (i + 1, CELLS) + (" (try %d of %d)" % (got + 1, want) if want > 1 else ""))
            try:
                data, _mime = I.generate(ch, cell_prompt(spec, i), NEGATIVE, PAINT_SIZE, PAINT_SIZE, None, timeout)
            except I.Bad as e:
                raise L.Bad("The image model did not answer (%s)" % str(e).rstrip(".")[:200])
            try:
                im = Image.open(io.BytesIO(data))
                im.load()
                cut, st = _cut(im)
                cell = to_cell(cut)
            except Exception:    # Junk, or a picture Pillow cannot read
                continue
            got += 1
            sc = score(st)
            if sc > best_score:
                best, best_score = cell, sc
        if best is None:
            bad.append(i)
        cells.append(best)
    if CELLS - len(bad) < MIN_GOOD:
        raise L.Bad("%d of %d pictures from the image model were not usable (an object on a plain dark background)" % (len(bad), CELLS))
    png = pack(cells)
    validate_atlas(png)
    notes = ["Painted sprites: %d of %d were painted by your image model and the effect draws them%s." % (
        CELLS - len(bad), CELLS, " (best of %d tries each)" % want if want > 1 else "")]
    if bad:
        notes.append("%d of the %d sprites could not be painted (cell%s %s stay empty)." % (len(bad), CELLS, "" if len(bad) == 1 else "s", ", ".join(map(str, bad))))
    return png, notes


NOT_PAINTED = "Painted sprites: this theme has no new wallpaper effect to draw them, so nothing was painted and nothing was sent to your image model."


def plain_failure(e):
    """the sentence the user reads when the theme was made without sprites"""
    return "Painted sprites: %s, so the theme was made without sprites. Your other settings were not changed." % str(e).rstrip(".")


def prepare_wall(p, ch_img, image, start, tmp, profile="quick", keep_out="", progress=lambda m: None, ch_text=None):
    """The wallpaper effect p ({name, desc, code, sprites: spec or None}) passed the gate with the stand-in atlas and the user asked for painted sprites.
    Get the eight prompts (a small extra call when the main answer had none), paint, and gate again WITH the real atlas (written into the folder tmp).
    Anything that goes wrong on the sprite side builds the same code WITHOUT sprites (sprite() draws nothing) and says so in plain words.
    -> (gate result, atlas path or "", [notes]); the gate result is not ok only when even the build without sprites fails."""
    import aigen as G
    progress = progress or (lambda m: None)
    notes = []
    spec = p.get("sprites")
    if not spec and ch_text is not None:
        progress("Asking the AI for the sprite prompts…")
        spec = ask_spec(ch_text, p["name"], p.get("desc") or p["name"])
    desc = p.get("desc") or p["name"]
    if not spec:
        notes.append(plain_failure(L.Bad("the AI did not write usable sprite prompts")))
    else:
        try:
            png, pn = paint(spec, ch_img, progress)
            path = os.path.join(tmp, "atlas.png")
            with open(path, "wb") as f:
                f.write(png)
            progress("Checking the effect again with the painted sprites…")
            r = G.gate("wallpaper", p["code"], p["name"], desc, start, image, None, keep_out, profile, sprites=True, atlas=path)
            if r["ok"]:
                return r, path, pn
            notes.append(plain_failure(L.Bad("the effect did not pass the safety check with the painted sprites (%s)" % (r["problems"] or ["?"])[0][:120])))
        except L.Bad as e:
            notes.append(plain_failure(e))
    r = G.gate("wallpaper", p["code"], p["name"], desc, start, image, None, keep_out, profile, sprites="blank")
    return r, "", notes


def finish_wall(p, ch_img, image, start, inst, profile="quick", keep_out="", progress=lambda m: None, ch_text=None):
    """prepare_wall, then install through inst(built, atlas_path_or_None) -> id. -> (id or None, problems, [notes], info)"""
    import tempfile
    with tempfile.TemporaryDirectory(prefix="oms-sprites-") as tmp:
        r, atlas, notes = prepare_wall(p, ch_img, image, start, tmp, profile, keep_out, progress, ch_text)
        if not r["ok"]:
            return None, r["problems"], notes, r["info"]
        return inst(r["built"], atlas or None), [], notes, r["info"]


# ------------------------------------------------------------------ cli
def main():
    a = sys.argv[1:]
    if a[:1] == ["selftest"]:
        # a fresh interpreter: the self-test points the state folder at a scratch dir, which only works before omslib is imported
        os.execv(sys.executable, [sys.executable, os.path.join(os.path.dirname(os.path.realpath(__file__)), "aisprites_selftest.py")])
    print(__doc__.strip())
    return 0


if __name__ == "__main__":
    sys.exit(main())
