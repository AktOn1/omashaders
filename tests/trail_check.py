#!/usr/bin/env python3
"""Offline check of cursor (mouse-effects) shaders: do the Trail effects leave a trail that stays put?

  trail_check.py check [--dir mouse-effects] [NAME...]   numbers per effect (reach behind the pointer, frame-to-frame jumpiness)
  trail_check.py strip OUT.png NAME [--dir D] [--path slow|s]   picture strip of one effect along a stroke

It plays the same history as MouseFx.qml (16 samples every 0.066 s, sequence number, phase), renders the fragment
shader with moderngl (EGL, no desktop needed) and measures. Needs the venv: ~/Work/tools/omashaders-venv/bin/python.
"""
import math, os, re, struct, sys
import moderngl
import numpy as np
from PIL import Image

W, H = 1280, 720
STEP = 0.066
FPS = 30.0
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

VERT = """#version 440
layout(location = 0) in vec2 pos;
layout(location = 0) out vec2 qt_TexCoord0;
void main() { qt_TexCoord0 = vec2(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5); gl_Position = vec4(pos, 0.0, 1.0); }
"""


def path_slow(t):  # steady 200 px/s stroke to the right, then a gentle wave
    return 160.0 + 200.0 * t, 360.0 + 40.0 * math.sin(t * 2.2)


def path_s(t):  # an S-curve at about 450 px/s
    return 140.0 + 450.0 * t, 360.0 + 200.0 * math.sin(t * 2.6)


PATHS = {"slow": path_slow, "s": path_s}


class History:
    """What MouseFx.qml feeds the shader."""

    def __init__(self):
        self.hist, self.seq, self.last, self.phase = [], 0, 0.0, 0.0

    def tick(self, now, mouse):
        since = now - self.last
        if since >= STEP - 1e-9:
            self.last = self.last + STEP if since < STEP * 2 else now
            self.hist = ([mouse] + self.hist)[:16]
            self.seq = (self.seq + 1) % 4096
            since = now - self.last
        self.phase = min(since / STEP, 1.0)

    def pt(self, i, mouse):
        return self.hist[i] if i < len(self.hist) else mouse


def members(src):
    m = re.search(r"uniform\s+buf\s*\{(.*?)\}\s*;", src, re.S)
    out = []
    for line in m.group(1).split(";"):
        line = line.strip()
        if not line:
            continue
        t, n = line.split()[:2]
        out.append((t, n))
    return out


def pack(src, values):
    buf = bytearray()
    for t, n in members(src):
        size, align = {"float": (4, 4), "vec2": (8, 8), "vec3": (12, 16), "vec4": (16, 16), "mat4": (64, 16)}[t]
        while len(buf) % align:
            buf.append(0)
        v = values.get(n)
        if t == "mat4":
            v = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        if v is None:
            v = [0.0] * (size // 4)
        if not isinstance(v, (list, tuple)):
            v = [v]
        buf += struct.pack("%df" % (size // 4), *v)
    while len(buf) % 16:
        buf.append(0)
    return bytes(buf)


class Renderer:
    def __init__(self):
        self.ctx = moderngl.create_standalone_context(backend="egl", require=440)
        self.fbo = self.ctx.simple_framebuffer((W, H), components=4)
        self.vbo = self.ctx.buffer(np.array([-1, -1, 3, -1, -1, 3], dtype="f4").tobytes())
        self.progs = {}

    def program(self, path):
        if path not in self.progs:
            src = open(path).read()
            prog = self.ctx.program(vertex_shader=VERT, fragment_shader=src)
            vao = self.ctx.vertex_array(prog, [(self.vbo, "2f", "pos")])
            ubo = self.ctx.buffer(reserve=1024)
            self.progs[path] = (src, prog, vao, ubo)
        return self.progs[path]

    def render(self, path, values):
        src, prog, vao, ubo = self.program(path)
        data = pack(src, values)
        ubo.write(data)
        ubo.bind_to_uniform_block(0)
        prog["buf"].binding = 0
        self.fbo.use()
        self.fbo.clear(0, 0, 0, 0)
        self.ctx.enable(moderngl.NOTHING)
        vao.render(moderngl.TRIANGLES, vertices=3)
        raw = np.frombuffer(self.fbo.read(components=4), dtype=np.uint8).reshape(H, W, 4)
        return raw[::-1].astype(np.float32) / 255.0


def uniforms(hist, now, mouse):
    v = {"qt_Opacity": 1.0, "time": now, "mouse": list(mouse), "res": [W, H]}
    pts = [hist.pt(i, mouse) for i in range(16)]
    for k in range(8):
        a, b = pts[2 * k], pts[2 * k + 1]
        v["h%d" % k] = [a[0], a[1], b[0], b[1]]
    v["hs"] = [float(hist.seq), hist.phase, STEP, 0.0]
    return v


def play(rend, shader, path_fn, t_from, t_to, every=1):
    """Yield (t, mouse, rgba) for the frames t_from..t_to."""
    hist = History()
    n = int(t_to * FPS)
    for k in range(n + 1):
        t = k / FPS
        mouse = path_fn(t)
        hist.tick(t, mouse)
        if t >= t_from and (k % every == 0):
            yield t, mouse, rend.render(shader, uniforms(hist, t, mouse))


def metrics(rend, shader):
    reach, jumpy = [], []
    prev = None
    for t, mouse, img in play(rend, shader, path_slow, 3.0, 3.6):
        a = img[..., 3]
        yy, xx = np.mgrid[0:H, 0:W]
        dist = np.hypot(xx - mouse[0], yy - mouse[1])
        behind = (xx < mouse[0] - 6) & (a > 0.06)
        reach.append(float(dist[behind].max()) if behind.any() else 0.0)
        far = dist > 70
        if prev is not None:
            pa, pm = prev
            both = far & (dist_prev_far(pm) > 70)
            tot = float(np.maximum(a[both], pa[both]).sum())
            diff = float(np.abs(a[both] - pa[both]).sum())
            if tot > 5:
                jumpy.append(diff / tot)
        prev = (a, mouse)
    return (float(np.mean(reach)), float(np.mean(jumpy)) if jumpy else 0.0)


_grid = None


def dist_prev_far(m):
    global _grid
    if _grid is None:
        _grid = np.mgrid[0:H, 0:W]
    return np.hypot(_grid[1] - m[0], _grid[0] - m[1])


def strip(rend, shader, out, which):
    fn = PATHS[which]
    frames = []
    span = (1.0, 2.0) if which == "slow" else (0.9, 1.9)
    base = np.zeros((H, W, 3), np.float32) + np.array([0.06, 0.07, 0.10], np.float32)
    for t, mouse, img in play(rend, shader, fn, span[0], span[1], every=6):
        a = img[..., 3:4]
        comp = img[..., :3] + base * (1 - a)
        x, y = int(mouse[0]), int(mouse[1])
        crop = comp[max(0, y - 160):y + 160, max(0, x - 420):x + 120]
        pad = np.zeros((320, 540, 3), np.float32)
        pad[:crop.shape[0], :crop.shape[1]] = crop
        frames.append(pad)
    cols = 3
    rows = (len(frames) + cols - 1) // cols
    sheet = np.zeros((rows * 320, cols * 540, 3), np.float32)
    for i, f in enumerate(frames):
        r, c = divmod(i, cols)
        sheet[r * 320:(r + 1) * 320, c * 540:(c + 1) * 540] = f
    Image.fromarray((np.clip(sheet, 0, 1) * 255).astype(np.uint8)).save(out)


def main(argv):
    d = os.path.join(ROOT, "mouse-effects")
    args = []
    i = 0
    while i < len(argv):
        if argv[i] == "--dir":
            d = os.path.abspath(argv[i + 1])
            i += 2
        else:
            args.append(argv[i])
            i += 1
    path = "slow"
    if "--path" in args:
        j = args.index("--path")
        path = args[j + 1]
        del args[j:j + 2]
    rend = Renderer()
    if args and args[0] == "strip":
        strip(rend, os.path.join(d, args[2] + ".frag"), args[1], path)
        return 0
    names = args[1:] if args and args[0] == "check" else args
    if not names:
        for f in sorted(os.listdir(d)):
            if f.endswith(".frag"):
                text = open(os.path.join(d, f)).read()
                if "category: Trail" in text:
                    names.append(f[:-5])
    bad = 0
    print("%-22s %8s %9s" % ("effect", "reach px", "jumpy"))
    for n in names:
        try:
            reach, jumpy = metrics(rend, os.path.join(d, n + ".frag"))
        except Exception as e:
            print("%-22s ERROR %s" % (n, str(e).splitlines()[-1][:70]))
            bad += 1
            continue
        ok = reach >= 120 and jumpy <= 0.45
        bad += 0 if ok else 1
        print("%-22s %8.0f %9.2f  %s" % (n, reach, jumpy, "ok" if ok else "FAIL"))
    print("%d of %d fail" % (bad, len(names)))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
