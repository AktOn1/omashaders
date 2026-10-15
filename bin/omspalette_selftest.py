#!/usr/bin/env python3
"""Self-test for omspalette.py: ids, the shader text, and (when Mesa/glslang are installed) that the shader draws what the numpy reference says."""
import os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import omspalette as P

fails = 0


def check(ok, what):
    global fails
    print(("ok: " if ok else "FAIL: ") + what)
    fails += 0 if ok else 1


PINK = [(0.0, "c21770"), (0.5, "ff8fc4"), (1.0, "fff5fa")]
p = P.make(stops=PINK)
pid = P.encode(p)
check(P.is_palette_id(pid) and pid.startswith("pal-"), "an id is made: " + pid)
check(P.encode(P.decode(pid)) == pid, "decode then encode gives the same id")
q = P.make(stops=PINK + [(0.9, "ffffff")], keep=0.3, sat=1.4, con=0.9, gam=0.8, shadow=("0c4a60", 0.6), light=("ffa040", 0.5), steps=6)
check(P.encode(P.decode(P.encode(q))) == P.encode(q), "a palette with every control survives the round trip")
check(P.decode(P.encode(q))["steps"] == 6 and len(P.decode(P.encode(q))["stops"]) == 4, "steps and stops come back")
d = P.decode(P.encode(P.make(keep=0.5, steps=0)))
check(d["stops"] == [] and abs(d["keep"] - 0.5) < 0.01, "a palette without a ramp is allowed")
for bad in ("pal-", "pal-zz", "pal-" + "0" * 25, "pal-" + "0" * 27, "pal-3" + "0" * 26, "pal-1" + "0" * 34, "PAL-" + "0" * 26, "custom-ff8800", "pal-0" + "0" * 25 + "\n", "pal-0" + "0" * 25 + "; rm", ""):
    check(not P.is_palette_id(bad), "refused: %r" % bad[:40])
check(P.is_palette_id("pal-0" + "00808080" + "808080" + "00" + "808080" + "00" + "0"), "the shortest well-formed id (no ramp, nothing on) is accepted")
try:
    P.make(stops=[(0, "zzzzzz"), (1, "ffffff")])
    check(False, "a bad colour is refused")
except ValueError:
    check(True, "a bad colour is refused")
try:
    P.make(stops=[(i / 6.0, "ffffff") for i in range(6)])
    check(False, "more than 5 stops refused")
except ValueError:
    check(True, "more than 5 stops refused")

try:
    import numpy as np
except ImportError:
    np = None

if np is not None:
    g = np.linspace(0, 1, 11)[:, None] * np.ones((1, 3))
    out = P.render(p, g)
    check(np.allclose(out[0], [0xc2 / 255, 0x17 / 255, 0x70 / 255], atol=0.01), "black becomes the first stop colour (pink screen)")
    check(np.allclose(out[-1], [1, 0xf5 / 255, 0xfa / 255], atol=0.01), "white becomes the last stop colour")
    r = np.array([[0.9, 0.1, 0.1]])
    check(np.allclose(P.render(P.make(stops=PINK, keep=1.0), r), P.render(P.make(), r), atol=0.01) and np.allclose(P.render(P.make(), r), r, atol=0.01),
          "keep original = 1 gives the original colours back")
    check(np.allclose(P.render(P.make(steps=2), np.array([[0.2, 0.7, 0.45]])), [[0, 1, 0]], atol=0.01), "2 steps: every channel is 0 or 1")

if subprocess.call(["which", "glslangValidator"], stdout=subprocess.DEVNULL) == 0:
    with tempfile.TemporaryDirectory() as t:
        for name, pal in (("pink", p), ("full", q), ("none", P.make(keep=0.4, sat=1.5)), ("tintonly", P.make(shadow=("0c4a60", 0.6)))):
            f = os.path.join(t, name + ".frag")
            open(f, "w").write(P.glsl(P.encode(pal)))
            r = subprocess.run(["glslangValidator", "-S", "frag", f], capture_output=True, text=True)
            check(r.returncode == 0, "the %s shader compiles %s" % (name, r.stdout.strip()[:80] if r.returncode else ""))
            comp = os.path.join(t, name + ".composed.frag")
            subprocess.run([sys.executable, os.path.join(HERE, "compose-shader"), comp, "--col", f, "60"], check=True)
            r = subprocess.run(["glslangValidator", "-S", "frag", comp], capture_output=True, text=True)
            check(r.returncode == 0, "the %s shader composes with a strength %s" % (name, r.stdout.strip()[:80] if r.returncode else ""))

# the shader and the reference agree on a picture (CPU render with Mesa)
try:
    from PIL import Image
    have_pil = np is not None
except ImportError:
    have_pil = False
if have_pil and os.path.exists("/usr/share/glvnd/egl_vendor.d/50_mesa.json"):
    with tempfile.TemporaryDirectory() as t:
        rng = np.random.default_rng(3)
        arr = (rng.random((24, 32, 3)) * 255).astype("uint8")
        arr[0, :, :] = (np.linspace(0, 255, 32)[:, None] * np.ones((1, 3))).astype("uint8")
        src = os.path.join(t, "in.png")
        Image.fromarray(arr).save(src)
        for name, pal in (("pink", p), ("full", q)):
            frag = os.path.join(t, name + ".frag")
            open(frag, "w").write(P.glsl(P.encode(pal)))
            outp = os.path.join(t, name + ".png")
            r = subprocess.run([sys.executable, os.path.join(HERE, "shader-preview"), src, frag, outp], capture_output=True, text=True)
            if r.returncode != 0:
                check(False, "shader-preview ran: " + (r.stderr or r.stdout)[-200:])
                continue
            got = np.asarray(Image.open(outp).convert("RGB")).astype(float) / 255.0
            want = P.render(P.decode(P.encode(pal)), arr.astype(float) / 255.0)
            err = np.abs(got - want).max()
            check(err < 0.03, "the %s shader matches the reference render (largest difference %.3f)" % (name, err))
else:
    print("skip: picture comparison needs numpy, Pillow and Mesa")

print("all palette checks ok" if not fails else "%d palette check(s) failed" % fails)
sys.exit(1 if fails else 0)
