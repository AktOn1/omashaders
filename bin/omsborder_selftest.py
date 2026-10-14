#!/usr/bin/env python3
"""Self-test for bin/omsborder.py: border code roundtrip through the recorder's GIF step, lossy video, scaling and damage.
Works in a temp folder:  python3 bin/omsborder_selftest.py"""
import sys
sys.dont_write_bytecode = True
import io
import json
import os
import random
import shutil
import subprocess
import tempfile
import time

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
import omsborder as ob

if ob.np is None:
    print("FAIL: needs python-pillow and python-numpy")
    sys.exit(1)
if not shutil.which("ffmpeg"):
    print("FAIL: ffmpeg not found")
    sys.exit(1)
np, Image = ob.np, ob.Image
fails = []


def check(cond, what):
    print(("ok: " if cond else "FAIL: ") + what)
    if not cond:
        fails.append(what)


def ff(*args):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + list(args), capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError("ffmpeg failed: " + r.stderr.strip()[-300:])


def payload(n, seed):
    return bytes(random.Random(seed).randrange(256) for _ in range(n))


def attempt(src):
    try:
        return ob.decode(src)
    except ob.BorderError as e:
        return e


def roundtrip(label, src, data):
    r = attempt(src)
    ok = isinstance(r, tuple) and r[0] == data
    check(ok, label + ("" if ok else " (got %s)" % (r if isinstance(r, Exception) else "wrong bytes")))
    return r if ok else None


def frame(path, n):
    with Image.open(path) as im:
        n = min(n if n >= 0 else im.n_frames - 1, im.n_frames - 1)
        im.seek(n)
        return im.convert("RGB")


def stack(video, top, bottom, out):
    """the recorder's step: border above and below the video, 64-colour palette GIF"""
    fc = ("[1:v][0:v][2:v]vstack=inputs=3,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];"
          "[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle")
    ff("-i", video, "-i", top, "-i", bottom, "-filter_complex", fc, out)


def main():
    t0 = time.time()
    tmp = tempfile.mkdtemp(prefix="omsborder-test-")
    try:
        run(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("%d check(s) failed, %.0f s" % (len(fails), time.time() - t0) if fails else "PASS (%.0f s)" % (time.time() - t0))
    return 1 if fails else 0


def run(tmp):
    # plan rules
    print("capacity (payload bytes -> border px)")
    for n in (100, 480, 1000, 1500, 2800, 4000, 5500):
        try:
            p = ob.plan(n)
            print("  %5d B -> %3d px, %d px cells" % (n, p["total_border_px"], p["cs"]))
        except ob.TooBig:
            print("  %5d B -> too big" % n)
    p = ob.plan(480)
    check(p["cs"] == 4 and p["total_border_px"] <= 160, "small payload uses 4 px cells within 160 px of border")
    check(p["top_h"] + p["bottom_h"] == p["total_border_px"], "plan heights add up")
    p = ob.plan(2800)
    check(p["cs"] == 3 and 160 < p["total_border_px"] <= 540, "bigger payload switches to 3 px cells")
    cap = ob.max_payload(3)
    check(5000 <= cap <= 6000, "capacity at 540 px is about 5,500 bytes (%d)" % cap)
    check(ob.plan(cap)["total_border_px"] <= 540, "the largest payload still fits")
    try:
        ob.plan(6000)
        check(False, "6,000 bytes is too big for a picture")
    except ob.TooBig as e:
        check("too big for a picture" in str(e), "6,000 bytes is too big for a picture")
    try:
        ob.render_borders(payload(6000, 1), os.path.join(tmp, "x.png"), os.path.join(tmp, "y.png"))
        check(False, "render refuses a too-big payload")
    except ob.TooBig:
        check(not os.path.exists(os.path.join(tmp, "x.png")), "render refuses a too-big payload and writes nothing")

    # synthetic recording: 960x540 animated GIF of moving gradient and noise
    base = os.path.join(tmp, "base.gif")
    ff("-f", "lavfi", "-i", "gradients=s=960x540:r=10:d=2:speed=0.05,noise=alls=30:allf=t", base)

    for n in (480, 1000, 2800):
        data = payload(n, n)
        d = os.path.join(tmp, str(n))
        os.makedirs(d)
        top, bot, gif = (os.path.join(d, x) for x in ("top.png", "bottom.png", "out.gif"))
        pl = ob.render_borders(data, top, bot)
        check(Image.open(top).size == (960, pl["top_h"]) and Image.open(bot).size == (960, pl["bottom_h"]), "%d B: border PNGs are 960 wide with the planned heights" % n)
        stack(base, top, bot, gif)
        with Image.open(gif) as im:
            check(im.n_frames > 5 and im.size == (960, 540 + pl["total_border_px"]), "%d B: stacked GIF has %d frames, %s" % (n, im.n_frames, im.size))
        roundtrip("%d B: GIF file, first frame" % n, gif, data)
        for label, k in (("first", 0), ("middle", 10), ("last", -1)):
            roundtrip("%d B: %s frame" % (n, label), frame(gif, k), data)

        # clipboard copy of the first frame as PNG bytes
        buf = io.BytesIO()
        frame(gif, 0).save(buf, "PNG")
        roundtrip("%d B: clipboard PNG bytes" % n, buf.getvalue(), data)

        # lossy re-encode as a social site does, then read the video
        for pct in (100, 60):
            vf = "scale=trunc(iw*%d/200)*2:-2" % pct
            mp4 = os.path.join(d, "x%d.mp4" % pct)
            ff("-i", gif, "-vf", vf, "-c:v", "libx264", "-crf", "28", "-pix_fmt", "yuv420p", mp4)
            roundtrip("%d B: lossy mp4 crf 28 at %d%% width" % (n, pct), mp4, data)
        with open(os.path.join(d, "x60.mp4"), "rb") as f:
            roundtrip("%d B: video given as bytes" % n, f.read(), data)

        # screenshot-like copies of one frame
        f0 = frame(gif, 3)
        small = f0.resize((720, round(f0.height * 0.75)), Image.LANCZOS)
        png = os.path.join(d, "s75.png")
        small.save(png)
        roundtrip("%d B: 75%% scaled PNG" % n, png, data)
        pad = Image.new("RGB", (small.width + 120, small.height + 90), (24, 24, 28))
        pad.paste(small, (60, 30))
        roundtrip("%d B: PNG with a plain margin around it" % n, pad, data)

    # bright dots take the tint of the picture, readable contrast stays
    import colorsys
    data = payload(1000, 3)
    for name, tint in (("red", (150, 40, 40)), ("green", (40, 140, 60)), ("blue", (30, 50, 160)),
                       ("orange", (190, 120, 40)), ("grey", (90, 90, 90)), ("near black", (6, 5, 4)), ("white", (250, 250, 250))):
        d = os.path.join(tmp, "tint-" + name.replace(" ", ""))
        os.makedirs(d)
        top, bot, gif = (os.path.join(d, x) for x in ("top.png", "bottom.png", "out.gif"))
        ob.render_borders(data, top, bot, tint=tint)
        f = np.array(Image.open(top).convert("RGB"), dtype=np.float64)[ob.HEAD_PX:]
        grey = f @ [0.299, 0.587, 0.114]
        lit = f[grey > (grey.min() + grey.max()) / 2].mean(0)
        luma = lit @ [0.299, 0.587, 0.114]
        ref = np.array(ob.LIGHT) @ [0.299, 0.587, 0.114]
        check(abs(luma - ref) < 4, "%s tint: bright dots keep the same brightness for reading (%.0f vs %.0f)" % (name, luma, ref))
        hl, hs, _ = colorsys.rgb_to_hsv(*(lit / 255))
        ht, ts, _ = colorsys.rgb_to_hsv(*(np.array(tint) / 255))
        if ts > 0.3 and max(tint) > 40:
            dh = min(abs(hl - ht), 1 - abs(hl - ht)) * 360
            check(dh < 12 and hs > 0.1, "%s tint: bright dots have the picture's colour (hue off by %.0f deg)" % (name, dh))
        if ts < 0.05:
            check(hs < 0.1, "%s tint: grey picture gets grey dots" % name)
        stack(base, top, bot, gif)
        roundtrip("%s tint: GIF reads back" % name, gif, data)
        roundtrip("%s tint: frame reads back" % name, frame(gif, 10), data)
    ob.render_borders(data, os.path.join(tmp, "n1.png"), os.path.join(tmp, "n2.png"))
    ob.render_borders(data, os.path.join(tmp, "m1.png"), os.path.join(tmp, "m2.png"), tint=None)
    check(open(os.path.join(tmp, "n1.png"), "rb").read() == open(os.path.join(tmp, "m1.png"), "rb").read(), "no tint gives the original teal border")

    # damage and corruption, on the 1,000 byte picture
    data = payload(1000, 1000)
    d = os.path.join(tmp, "1000")
    f0 = np.array(frame(os.path.join(d, "out.gif"), 0))
    blank = f0.copy()
    blank[:ob.HEAD_PX] = 0
    check(isinstance(attempt(Image.fromarray(blank)), ob.NoCode), "header corruption gives NoCode")
    check(isinstance(attempt(Image.fromarray(np.zeros_like(f0))), ob.NoCode), "a blank picture gives NoCode")
    check(isinstance(attempt(base), ob.NoCode), "a picture without a code gives NoCode")
    try:
        ob.decode(b"not a picture")
        check(False, "garbage input raises")
    except ob.BorderError:
        check(True, "garbage input raises a plain error")

    p = ob.plan(1000)
    dmg = f0.copy()
    y0 = ob.HEAD_PX + 5 * p["cs"]
    dmg[y0:y0 + 2 * p["cs"]] = (9, 27, 34)
    r = attempt(Image.fromarray(dmg))
    check(isinstance(r, tuple) and r[0] == data and r[1] > 0, "two blanked rows are repaired exactly (%s)" % (r[1] if isinstance(r, tuple) else r))
    gone = f0.copy()
    gone[ob.HEAD_PX:p["top_h"]] = (9, 27, 34)
    gone[-p["bottom_h"]:] = (9, 27, 34)
    check(isinstance(attempt(Image.fromarray(gone)), ob.Damaged), "a wiped border gives Damaged")

    # speed on a 960x800 picture
    big = payload(2800, 7)
    ob.render_borders(big, os.path.join(tmp, "t.png"), os.path.join(tmp, "b.png"))
    pic = Image.new("RGB", (960, 800), (40, 60, 80))
    t, b = Image.open(os.path.join(tmp, "t.png")), Image.open(os.path.join(tmp, "b.png"))
    pic.paste(t, (0, 0))
    pic.paste(b, (0, 800 - b.height))
    s = time.time()
    r = attempt(pic)
    el = time.time() - s
    check(isinstance(r, tuple) and r[0] == big, "960x800 picture decodes exactly")
    check(el < 3, "960x800 decode took %.2f s (under 3 s)" % el)

    # command line
    cp = os.path.join(tmp, "payload.bin")
    open(cp, "wb").write(data)
    me = os.path.join(HERE, "omsborder.py")
    r = subprocess.run([sys.executable, me, "borders", cp, os.path.join(tmp, "ct.png"), os.path.join(tmp, "cb.png")], capture_output=True, text=True)
    check(r.returncode == 0 and json.loads(r.stdout)["cs"] in (3, 4), "cli borders prints the plan")
    outf = os.path.join(tmp, "got.bin")
    r = subprocess.run([sys.executable, me, "decode", os.path.join(d, "out.gif"), "--out", outf], capture_output=True, text=True)
    j = json.loads(r.stdout)
    check(r.returncode == 0 and j["ok"] and j["bytes"] == 1000 and open(outf, "rb").read() == data, "cli decode writes the bytes")
    r = subprocess.run([sys.executable, me, "decode", "-"], input=open(os.path.join(d, "x60.mp4"), "rb").read(), capture_output=True)
    j = json.loads(r.stdout)
    check(r.returncode == 0 and j["ok"] and j["data_b64"], "cli decode reads a video from stdin")
    r = subprocess.run([sys.executable, me, "decode", base], capture_output=True, text=True)
    j = json.loads(r.stdout)
    check(r.returncode == 1 and j["ok"] is False and j["kind"] == "no_code", "cli decode reports a picture without a code")
    check(not os.path.exists(os.path.join(HERE, "__pycache__", "omsborder.cpython-%d%d.pyc" % sys.version_info[:2])), "no bytecode left in the plugin folder")


sys.exit(main())
