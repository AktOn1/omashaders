#!/usr/bin/env python3
"""Pointer path of the share GIF: a path that starts upward from the bottom left, runs flat through the centre (never above it before), then only goes up to the top right."""
import importlib.machinery, importlib.util, os, sys

here = os.path.dirname(os.path.realpath(__file__))
loader = importlib.machinery.SourceFileLoader("gif_capture", os.path.join(here, "gif-capture"))
spec = importlib.util.spec_from_loader("gif_capture", loader)
g = importlib.util.module_from_spec(spec)
loader.exec_module(g)

mon = {"x": 0, "y": 0, "lw": 1000, "lh": 1000}
n = 800
pts = [tuple(v / 1000 for v in g.sweep_point(mon, i / n)) for i in range(n + 1)]
c = min(range(n + 1), key=lambda i: abs(pts[i][0] - 0.5) + abs(pts[i][1] - 0.5))
fails = []
if abs(pts[c][0] - 0.5) > 0.01 or abs(pts[c][1] - 0.5) > 0.01:
    fails.append("path does not pass the centre: %s" % (pts[c],))
if min(y for _, y in pts[:c + 1]) < pts[c][1] - 2e-3:
    fails.append("first bow goes above the centre")
if any(pts[i + 1][1] > pts[i][1] + 1e-4 for i in range(c, n)):
    fails.append("second bow goes down again")
if not (pts[0][0] < 0.15 and pts[0][1] > 0.8):
    fails.append("does not start bottom left: %s" % (pts[0],))
if not (pts[-1][0] > 0.85 and pts[-1][1] < 0.2):
    fails.append("does not end top right: %s" % (pts[-1],))
if any(pts[i + 1][0] < pts[i][0] - 1e-9 for i in range(n)):
    fails.append("goes back to the left")
p = g.progress_at_x(g.DEMO_SHOW_X)
if abs(g.sweep_point(mon, p)[0] / 1000 - g.DEMO_SHOW_X) > 0.005:
    fails.append("terminal does not open a third in from the left: %s" % (g.sweep_point(mon, p),))
print("FAIL: " + "; ".join(fails) if fails else "ok: path checks pass")
sys.exit(1 if fails else 0)
