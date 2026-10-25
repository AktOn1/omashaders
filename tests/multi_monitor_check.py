#!/usr/bin/env python3
"""Offline check of the cursor effects on two side by side monitors (no desktop needed).

Plays what MouseFx.qml does: one overlay per monitor, the pointer passed relative to that monitor's top-left corner.
Dimming effects (flashlight, spotlight, reading-line) must keep the whole desktop dark with a lit spot only around the pointer;
glow effects (crosshair, lamp, aura, halo) must still draw only around the pointer.
Needs the venv: ~/Work/tools/omashaders-venv/bin/python tests/multi_monitor_check.py
"""
import os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import trail_check as tc

W, H = tc.W, tc.H
MONITORS = {"A": (0, 0), "B": (W, 0)}
DIM = {"flashlight": 0.88, "spotlight": 0.55, "reading-line": 0.5}
HOLE = {"flashlight": 90.0, "spotlight": 200.0, "reading-line": 36.0}  # radius (half height) that is fully lit
fails = []


def check(ok, msg):
    print(("ok: " if ok else "FAIL: ") + msg)
    if not ok:
        fails.append(msg)


rend = tc.Renderer()


def frame(effect, cursor, monitor, size=1.0):
    ox, oy = MONITORS[monitor]
    hist = tc.History()
    v = tc.uniforms(hist, 1.0, (cursor[0] - ox, cursor[1] - oy))
    v["size"] = size
    return rend.render(os.path.join(ROOT, "mouse-effects", effect + ".frag"), v)[..., 3]


def frames(effect, cursor, size=1.0):
    return {m: frame(effect, cursor, m, size) for m in MONITORS}


for fx, full in DIM.items():
    # (1) cursor well inside A: B is dark at every pixel
    a = frames(fx, (W / 2, H / 2))
    check(np.allclose(a["B"], full, atol=0.004), "%s: cursor on A, B has the full dim %.2f at every pixel (min %.3f max %.3f)" % (fx, full, a["B"].min(), a["B"].max()))
    # (2) on A the hole is around the cursor, the rest is dark
    cx, cy = int(W / 2), int(H / 2)
    check(a["A"][cy, cx] < 0.02, "%s: lit hole at the cursor on A (%.3f)" % (fx, a["A"][cy, cx]))
    far = (0, 0) if fx != "reading-line" else (0, H - 1)
    check(abs(a["A"][far[1], far[0]] - full) < 0.004, "%s: far from the cursor on A is dark" % fx)
    # same from the other side
    b = frames(fx, (W + W / 2, H / 2))
    check(np.allclose(b["A"], full, atol=0.004), "%s: cursor on B, A has the full dim at every pixel" % fx)
    # (3) on the shared edge and just outside both monitors: no monitor loses its dim
    for x, y in [(W, H / 2), (W - 0.5, H / 2), (W + 0.5, H / 2), (W, 3), (W, H - 1), (-3, H / 2), (2 * W + 3, H / 2), (W / 2, -3), (W / 2, H + 3)]:
        f = frames(fx, (x, y))
        for m in MONITORS:
            # the dim covers the monitor except the spot: the corner farthest from the cursor is dark, and the monitor is mostly dark
            check(f[m].mean() > 0.5 * full * (0.55 if fx != "reading-line" else 0.9),
                  "%s: cursor (%g,%g): monitor %s keeps its dim (mean %.3f)" % (fx, x, y, m, f[m].mean()))
        check(max(f["A"].max(), f["B"].max()) > full - 0.004, "%s: cursor (%g,%g): some pixel has the full dim" % (fx, x, y))
    # crossing the edge: a lit circle does not jump (flashlight and spotlight)
    if fx != "reading-line":
        l, r = frames(fx, (W - 0.5, H / 2)), frames(fx, (W + 0.5, H / 2))
        jump = max(np.abs(l[m] - r[m]).max() for m in MONITORS)
        check(jump < 0.02, "%s: crossing the edge changes no pixel by more than 0.02 (%.4f)" % (fx, jump))
    # the lit spot follows the size setting and the other monitor stays dark
    for size in (0.25, 1.6):
        s = frames(fx, (W / 2, H / 2), size)
        check(np.allclose(s["B"], full, atol=0.004), "%s: size %g: B has the full dim" % (fx, size))
        if fx != "reading-line":
            r = HOLE[fx] * size
            ring = int(W / 2 + r * 0.8), int(W / 2 + r * 2.6)
            check(s["A"][int(H / 2), ring[0]] < 0.02 and abs(s["A"][int(H / 2), min(ring[1], W - 1)] - full) < 0.004,
                  "%s: size %g: hole radius follows the size" % (fx, size))
        else:
            band = HOLE[fx] * size
            check(s["A"][int(H / 2 + band * 0.8), 5] < 0.02 and abs(s["A"][int(H / 2 + band * 2.6), 5] - full) < 0.004,
                  "%s: size %g: band height follows the size" % (fx, size))

# (4) glow effects draw only near the pointer and are not dimmed copies
for fx in ("crosshair", "lamp", "aura", "halo"):
    a = frames(fx, (W / 2, H / 2))
    check(a["A"][int(H / 2), int(W / 2)] > 0.0 or a["A"].max() > 0.0, "%s: draws on the cursor's monitor" % fx)
    check(a["B"].max() < 0.1, "%s: far monitor shows no more than a faint glow (max %.3f)" % (fx, a["B"].max()))
    check(a["A"].mean() < 0.3, "%s: not a full-screen cover (mean %.3f)" % (fx, a["A"].mean()))

print("FAILED %d" % len(fails) if fails else "all ok")
sys.exit(1 if fails else 0)
