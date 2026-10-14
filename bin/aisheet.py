"""aisheet: the offscreen renders of a Rich theme's pieces and the contact sheet the Reviewer looks at (and the result card shows).

Every piece is rendered with bin/shader-preview on the CPU over the user's own picture (a plain gradient when there is none), at its own
strength. Wallpaper overlay: time A, time B, and time A again with the pointer somewhere else. Cursor: the area around the pointer at
those three moments, with a made-up trail behind the pointer. Screen and Window: two times (window: also inactive). Color: before and after.
Frame: a drawn mock-up from its settings. Nothing here touches the live desktop.
"""
import sys
sys.dont_write_bytecode = True  # a __pycache__ in the plugin folder would make the shell reload the plugin
import concurrent.futures
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import aigen as G  # noqa: E402

TILE_W, TILE_H = 500, 281
GAP = 10
LABEL_H = 30
TA, TB = 2.0, 9.0                    # seconds into the effect
PTR_A, PTR_B = (0.68, 0.62), (0.30, 0.40)   # pointer positions (0-1)
BUDGET = 60.0
FONTS = ("/usr/share/fonts/TTF/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/noto/NotoSans-Regular.ttf")
ROW_NAMES = {"wallpaper": "WALLPAPER OVERLAY", "cursor": "CURSOR", "screen": "SCREEN", "color": "COLOR", "window": "WINDOWS", "frame": "FRAME"}


def font(size):
    from PIL import ImageFont
    for f in FONTS:
        if os.path.isfile(f):
            return ImageFont.truetype(f, size)
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def fit(im, w=TILE_W, h=TILE_H):
    from PIL import Image
    return im.convert("RGB").resize((w, h), Image.LANCZOS)


def marker(im, xy, scale=1.0):
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    r = 14 * scale
    x, y = xy
    d.ellipse((x - r - 2, y - r - 2, x + r + 2, y + r + 2), outline=(0, 0, 0), width=3)
    d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255), width=2)


def mock_window(path):
    """a stand-in for an app window (title bar, side list, text lines), 960x600"""
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (960, 600), (32, 34, 44))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 960, 44), fill=(22, 23, 31))
    d.rectangle((0, 44, 220, 600), fill=(26, 28, 37))
    f = font(22)
    d.text((18, 9), "Terminal  -  readable text", font=f, fill=(235, 235, 235))
    for i in range(8):
        d.text((24, 64 + i * 40), "item %d" % (i + 1), font=f, fill=(190, 192, 205))
    for i in range(11):
        d.text((250, 66 + i * 40), "The quick brown fox jumps over %d lazy dogs" % (i + 1), font=f, fill=(228, 230, 238) if i % 3 else (150, 220, 160))
    im.save(path)
    return im


def run_render(frag, base_png, out_png, uniforms=None, alpha=False, t=TA, sprites=""):
    dt, err = G.render(frag, base_png, out_png, uniforms, alpha=alpha, t=t, budget=BUDGET, sprites=sprites)
    if err:
        raise RuntimeError(err[:300])
    return dt


def render_full(slot, piece, base_png, tmp, t, tag, active=1):
    """screen / window / color over base_png at the piece's strength -> PIL image"""
    from PIL import Image
    frag = os.path.join(tmp, "%s-%s.frag" % (slot, tag))
    open(frag, "w").write(piece["built"]["frag"])
    comp = os.path.join(tmp, "%s-%s.comp.frag" % (slot, tag))
    args = ["--col" if slot == "color" else "--fx", frag, str(int(piece["start"]))]
    if slot == "window":
        args = ["--window"] + args
    r = subprocess.run([sys.executable, os.path.join(G.HERE, "compose-shader"), comp] + args, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(G.clean_log(r.stderr, 300))
    out = os.path.join(tmp, "%s-%s.png" % (slot, tag))
    env_uni = {"is_active": str(active)} if slot == "window" else None
    run_render(comp, base_png, out, env_uni, t=t)
    return Image.open(out).convert("RGB")


def render_wall(piece, base_png, tmp, t, m, tag):
    import numpy as np
    from PIL import Image
    frag = os.path.join(tmp, "wall-%s.es.frag" % tag)
    open(frag, "w").write(piece["built"]["es"])
    out = os.path.join(tmp, "wall-%s.png" % tag)
    uni = {"mouse": "%d,%d" % (m[0] * G.W, m[1] * G.H), "res": "%d,%d" % (G.W, G.H), "imgSize": "%d,%d" % (G.W, G.H), "time": str(t)}
    run_render(frag, base_png, out, uni, t=t, sprites=piece.get("atlas") or "")   # piece["atlas"]: the painted sprites of this effect, when it has them
    base = np.asarray(Image.open(base_png).convert("RGB"), dtype=np.float32) / 255.0
    ren = np.asarray(Image.open(out).convert("RGB"), dtype=np.float32) / 255.0
    k = piece["start"] / 100.0
    mixed = np.clip(base + (ren - base) * k, 0, 1)
    im = Image.fromarray((mixed * 255).astype("uint8"))
    marker(im, (m[0] * G.W, m[1] * G.H), 1.6)
    return im


def render_cursor(piece, base_png, tmp, t, m, direction, tag):
    from PIL import Image
    import math
    frag = os.path.join(tmp, "cur-%s.es.frag" % tag)
    open(frag, "w").write(piece["built"]["es"])
    out = os.path.join(tmp, "cur-%s.png" % tag)
    mx, my = m[0] * G.W, m[1] * G.H
    dx, dy = direction
    n = math.hypot(dx, dy) or 1.0
    dx, dy = dx / n, dy / n
    pts = []
    for i in range(1, 9):
        back = i * 12 + i * i * 2.5
        curve = math.sin(i * 0.5) * 7 * i / 4
        pts.append((mx - dx * back - dy * curve, my - dy * back + dx * curve))
    uni = {"mouse": "%d,%d" % (mx, my), "res": "%d,%d" % (G.W, G.H)}
    for k in range(4):
        a, b = pts[2 * k], pts[2 * k + 1]
        uni["h%d" % k] = "%.1f,%.1f,%.1f,%.1f" % (a[0], a[1], b[0], b[1])
    run_render(frag, base_png, out, uni, alpha=True, t=t)
    layer = Image.open(out).convert("RGBA")
    bg = Image.open(base_png).convert("RGBA")
    comp = Image.alpha_composite(bg, layer).convert("RGB")
    cw, ch = 640, 360
    x0 = int(max(0, min(G.W - cw, mx - cw * 0.58)))
    y0 = int(max(0, min(G.H - ch, my - ch * 0.5)))
    return comp.crop((x0, y0, x0 + cw, y0 + ch))


def hex_rgb(h, dflt=(200, 200, 200)):
    h = str(h or "").strip().lstrip("#")
    if re.fullmatch(r"[0-9a-fA-F]{6}([0-9a-fA-F]{2})?", h):
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    return dflt


def render_frame(settings, base_png):
    """a drawn mock-up of the border and shadow: two windows, the left one active"""
    from PIL import Image, ImageDraw, ImageFilter
    s = settings or {}
    im = Image.open(base_png).convert("RGB").resize((960, 540))
    cols = s.get("border_colors") or ["ffffff"]
    cols = cols if isinstance(cols, list) else str(cols).split(",")
    cols = [hex_rgb(c) for c in cols][:6] or [(255, 255, 255)]
    rad = int(float(s.get("rounding", 10) or 0))
    bw = max(1, int(float(s.get("border_size", 2) or 2)))
    sh = int(float(s.get("shadow_range", 0) or 0))
    scol = hex_rgb(s.get("shadow_color", "000000"), (0, 0, 0))
    for box, active in (((60, 90, 460, 450), True), ((520, 130, 900, 420), False)):
        if sh and active:
            glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
            gd = ImageDraw.Draw(glow)
            gd.rounded_rectangle((box[0] - 4, box[1] - 4, box[2] + 4, box[3] + 4), rad + 4, fill=scol + (200,))
            glow = glow.filter(ImageFilter.GaussianBlur(max(2, sh // 2)))
            im = Image.alpha_composite(im.convert("RGBA"), glow).convert("RGB")
        d = ImageDraw.Draw(im)
        d.rounded_rectangle(box, rad, fill=(30, 32, 42))
        d.rounded_rectangle(box, rad, outline=cols[0] if active else (90, 90, 100), width=bw if active else 1)
        if active and len(cols) > 1:
            for k in range(1, len(cols)):
                d.rounded_rectangle((box[0] + k, box[1] + k, box[2] - k, box[3] - k), rad, outline=cols[k], width=1) if bw > 1 and k < bw else None
        f = font(20)
        d.text((box[0] + 22, box[1] + 22), "Active window" if active else "Other window", font=f, fill=(235, 235, 240))
        for i in range(5):
            d.rectangle((box[0] + 22, box[1] + 70 + i * 34, box[0] + 22 + (180 + 40 * (i % 3)) * (1 if active else 0.7), box[1] + 82 + i * 34), fill=(70, 74, 92))
    return im


def label_row(draw, y, text, width, f):
    draw.rectangle((0, y, width, y + LABEL_H - 4), fill=(26, 28, 36))
    draw.text((8, y + 3), text, font=f, fill=(238, 238, 244))


def assemble(rows, width=None):
    """rows = [(label, [(caption, PIL image or None)])] -> one PIL image"""
    from PIL import Image, ImageDraw
    width = width or 3 * TILE_W + 4 * GAP
    height = GAP + sum(LABEL_H + TILE_H + 22 + GAP for _ in rows)
    sheet = Image.new("RGB", (width, height), (12, 12, 16))
    d = ImageDraw.Draw(sheet)
    f, fs = font(17), font(14)
    y = GAP
    for label, tiles in rows:
        label_row(d, y, label, width, f)
        y += LABEL_H
        for i, (cap, im) in enumerate(tiles):
            x = GAP + i * (TILE_W + GAP)
            if im is not None:
                sheet.paste(fit(im), (x, y))
            else:
                d.rectangle((x, y, x + TILE_W, y + TILE_H), fill=(40, 20, 20))
                d.text((x + 10, y + 10), "render failed", font=fs, fill=(255, 160, 160))
            d.text((x + 2, y + TILE_H + 3), cap, font=fs, fill=(190, 192, 205))
        y += TILE_H + 22 + GAP
    return sheet


def jpeg_bytes(im, q=82):
    b = io.BytesIO()
    im.save(b, "JPEG", quality=q)
    return b.getvalue()


def build(pieces, image, out_dir, progress=lambda m: None):
    """pieces = {slot: {"built", "start", "settings", "atlas" (a wallpaper effect with painted sprites)}} for the pieces that passed the gate.
    Returns {"sheet": path of the whole sheet, "images": [JPEG bytes of the two sheets], "whole": JPEG bytes of both, "contents": [[slots on sheet 1], [slots on sheet 2]], "failed": {slot: reason}}"""
    from PIL import Image
    os.makedirs(out_dir, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="omashaders-sheet-")
    failed = {}
    try:
        plain_png = os.path.join(tmp, "plain.png")
        G.cover_image(image).save(plain_png)
        panels_png = os.path.join(tmp, "panels.png")
        G.test_image(image, panels_png)
        win_png = os.path.join(tmp, "window.png")
        mock_window(win_png)
        plain = Image.open(plain_png).convert("RGB")
        panels = Image.open(panels_png).convert("RGB")
        tasks = {}
        if "wallpaper" in pieces:
            p = pieces["wallpaper"]
            tasks[("wallpaper", 0)] = lambda p=p: render_wall(p, plain_png, tmp, TA, PTR_A, "a")
            tasks[("wallpaper", 1)] = lambda p=p: render_wall(p, plain_png, tmp, TB, PTR_A, "b")
            tasks[("wallpaper", 2)] = lambda p=p: render_wall(p, plain_png, tmp, TA, PTR_B, "c")
        if "cursor" in pieces:
            p = pieces["cursor"]
            tasks[("cursor", 0)] = lambda p=p: render_cursor(p, plain_png, tmp, TA, PTR_A, (1.0, -0.35), "a")
            tasks[("cursor", 1)] = lambda p=p: render_cursor(p, plain_png, tmp, TB, PTR_A, (1.0, -0.35), "b")
            tasks[("cursor", 2)] = lambda p=p: render_cursor(p, plain_png, tmp, TA, PTR_B, (-0.8, 0.6), "c")
        if "screen" in pieces:
            p = pieces["screen"]
            tasks[("screen", 0)] = lambda p=p: render_full("screen", p, panels_png, tmp, TA, "a")
            tasks[("screen", 1)] = lambda p=p: render_full("screen", p, panels_png, tmp, TB, "b")
        if "color" in pieces:
            p = pieces["color"]
            tasks[("color", 0)] = lambda p=p: render_full("color", p, panels_png, tmp, TA, "a")
        if "window" in pieces:
            p = pieces["window"]
            tasks[("window", 0)] = lambda p=p: render_full("window", p, win_png, tmp, TA, "a", 1)
            tasks[("window", 1)] = lambda p=p: render_full("window", p, win_png, tmp, TB, "b", 1)
            tasks[("window", 2)] = lambda p=p: render_full("window", p, win_png, tmp, TA, "c", 0)
        got = {}
        progress("Rendering the pieces over your picture for the review…")
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
            futs = {k: ex.submit(fn) for k, fn in tasks.items()}
            for k, f in futs.items():
                try:
                    got[k] = f.result()
                except Exception as e:  # a failed render is shown as such, never fatal
                    got[k] = None
                    failed[k[0]] = str(e)

        def tile(slot, i):
            return got.get((slot, i))

        rows1, rows2 = [], []
        if "wallpaper" in pieces:
            rows1.append((ROW_NAMES["wallpaper"] + "  (pointer = white ring)", [("A: %.0f s, pointer here" % TA, tile("wallpaper", 0)), ("B: %.0f s later, same pointer" % TB, tile("wallpaper", 1)),
                                                                              ("C: %.0f s, pointer moved" % TA, tile("wallpaper", 2))]))
        if "cursor" in pieces:
            rows1.append((ROW_NAMES["cursor"] + "  (the area around the pointer, a trail behind it)", [("A: %.0f s" % TA, tile("cursor", 0)), ("B: %.0f s" % TB, tile("cursor", 1)),
                                                                                               ("C: pointer moved elsewhere", tile("cursor", 2))]))
        if "screen" in pieces:
            rows1.append((ROW_NAMES["screen"] + "  (over two test text panels)", [("A: %.0f s" % TA, tile("screen", 0)), ("B: %.0f s" % TB, tile("screen", 1)), ("without the effect", panels)]))
        if "color" in pieces:
            rows2.append((ROW_NAMES["color"], [("before", panels), ("after", tile("color", 0)), ("the picture", plain)]))
        if "window" in pieces:
            rows2.append((ROW_NAMES["window"] + "  (a stand-in app window)", [("A: active, %.0f s" % TA, tile("window", 0)), ("B: active, %.0f s" % TB, tile("window", 1)), ("C: inactive", tile("window", 2))]))
        if "frame" in pieces:
            try:
                rows2.append((ROW_NAMES["frame"] + "  (a drawn mock-up of the border)", [("active window (left) and another", render_frame(pieces["frame"].get("settings"), plain_png))]))
            except Exception as e:
                failed["frame"] = str(e)
        sheets = [assemble(r) for r in (rows1, rows2) if r]
        contents = [[k for k in ROW_NAMES if any(lab.startswith(ROW_NAMES[k]) for lab, _ in r)] for r in (rows1, rows2) if r]
        if not sheets:
            return {"sheet": "", "images": [], "failed": failed, "contents": []}
        whole = Image.new("RGB", (sheets[0].width, sum(s.height for s in sheets)), (12, 12, 16))
        y = 0
        for s in sheets:
            whole.paste(s, (0, y))
            y += s.height
        path = os.path.join(out_dir, "sheet.jpg")
        whole.save(path, "JPEG", quality=88)
        return {"sheet": path, "images": [jpeg_bytes(s) for s in sheets], "whole": jpeg_bytes(whole), "failed": failed, "contents": contents}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
