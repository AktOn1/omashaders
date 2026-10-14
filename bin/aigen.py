#!/usr/bin/env python3
"""aigen: the safety gate and the store for effects an AI invented ("Invent new" mode of bin/ai-theme).

  aigen check KIND [FILE|-] [--name N] [--desc D] [--start N] [--image PNG] [--keep-out DIR] [--profile quick|rich] [--json]
        run the whole gate on the code in FILE (stdin when -). KIND: screen | window | color | wallpaper | cursor | frame
  aigen analyze FILE...            static cost of finished shader files (used to calibrate the caps)
  aigen list [--json]              the generated effects in the state folder (Made by AI)
  aigen keep ID | aigen delete ID  keep a pending effect / delete one (files and notes)
  aigen selftest                   offline checks of the gate, including attacks that must be refused

What the AI writes is only a function body for a fixed template (docs/theme-instructions.md, chapter Inventing):
the template owns the #version line, every uniform, every input and output, so the AI cannot add any of them.
The gate is mandatory and has four parts, run in this order:
  a) text rules: no # lines (no #include, #extension, #define), only plain ASCII, size limit, no uniform/layout/discard/while,
     no arrays or [ ], only GLSL built-in functions and the functions the code defines, texture() only on the given picture
  b) cost rules: every for loop has constant bounds, braces and a loop variable nobody else writes; the product of the loops,
     the texture() samples and the amount of work per pixel (counted through the call graph) are capped
  c) compile: the real tools (compose-shader + glslangValidator for screen/colour/window, qsb for Qt wallpaper/cursor shaders,
     and Mesa when it is rendered)
  d) a 1920x1080 offscreen render on the CPU (Mesa llvmpipe, bin/shader-preview) within a time budget: not blank, not one
     colour, visible, text still readable at the start strength; wallpaper overlays must stay light (the picture survives);
     cursor effects must stay local; screen, window and wallpaper effects must not be only a colour tint (low-res renders at a
     second moment and, for wallpapers, a second pointer place, see tint_check)
Generated effects live in <state>/generated/, never in the plugin folder.
"""
import sys
sys.dont_write_bytecode = True  # a __pycache__ in the plugin folder would make the shell reload the plugin (and close the open dialog)
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import omslib as L  # noqa: E402

HERE = L.HERE
ROOT = L.ROOT
GEN = os.path.join(L.STATE, "generated")
CATEGORY = "Made by AI"
KINDS = ("screen", "window", "color", "wallpaper", "cursor", "frame")
SUBDIR = {"screen": "screen", "window": "screen", "color": "color", "wallpaper": "wall", "cursor": "mouse", "frame": "frame"}
PREFIX = "ai-"

# ---- limits (calibrated with `aigen analyze` over every shipped effect; see docs/DEVELOPMENT.md)
MAX_CODE = 9000          # characters of AI code per part
MAX_LINES = 320
MAX_LOOP = 64            # iterations of one loop
MAX_SAMPLES = 48         # texture() samples per pixel, loops and calls counted
MAX_ITERS = 500          # loop iterations per pixel, nested loops and calls counted
MAX_WORK = 40000         # tokens executed per pixel (a rough ALU cost), loops and calls counted
RENDER_BUDGET_S = 25.0   # one 1920x1080 frame on the CPU (llvmpipe)
# The Rich profile (bin/airich.py: Planner, Builders, Reviewer) lets a part be as big as the best shipped pieces; every safety rule stays,
# only the numbers grow. Calibration (aigen analyze over the shipped files, see docs/DEVELOPMENT.md): the 36 light overlays use work p90 34000,
# max 104324, iterations p90 80 / max 144, samples p90 40 / max 116, files 4-6 KB; shipped screens work p90 4192 / max 16346; cursors p90 20179 / max 36340.
RICH_WORK = {"wallpaper": 100000, "cursor": 40000, "screen": 24000, "window": 24000, "color": 4000}
RICH = {"code": 18000, "lines": 520, "samples": 64, "iters": 800, "render_s": 45.0}
PROFILES = ("quick", "rich")


def limits(profile, kind):
    """the numbers one gate run uses; read at call time so tests can lower a limit"""
    if profile == "rich":
        return {"code": RICH["code"], "lines": RICH["lines"], "samples": RICH["samples"], "iters": RICH["iters"],
                "work": RICH_WORK.get(kind, MAX_WORK), "render_s": max(RICH["render_s"], RENDER_BUDGET_S)}
    return {"code": MAX_CODE, "lines": MAX_LINES, "samples": MAX_SAMPLES, "iters": MAX_ITERS, "work": MAX_WORK, "render_s": RENDER_BUDGET_S}


W, H = 1920, 1080
MEAN_MAX, FRAC_MAX = 20.0, 40.0   # wallpaper overlay: same limits as bin/wallpaper-overlay-scan

BUILTINS = set("""radians degrees sin cos tan asin acos atan sinh cosh tanh pow exp log exp2 log2 sqrt inversesqrt abs sign floor ceil
fract mod min max clamp mix step smoothstep length distance dot cross normalize reflect refract faceforward round roundEven trunc
isnan isinf lessThan lessThanEqual greaterThan greaterThanEqual equal notEqual any all not matrixCompMult outerProduct transpose
determinant texture textureSize fma
float int uint bool vec2 vec3 vec4 ivec2 ivec3 ivec4 uvec2 uvec3 uvec4 bvec2 bvec3 bvec4 mat2 mat3 mat4""".split())
CONTROL = {"if", "for", "while", "switch", "return", "else"}
BANNED_WORDS = ("discard", "uniform", "layout", "attribute", "varying", "buffer", "shared", "image2D", "sampler2D", "sampler3D", "samplerCube",
                "atomic", "while", "do", "goto", "switch", "case", "default", "struct", "precision", "extension", "patch", "subroutine", "asm")
TYPE_RE = r"(?:const\s+)?(?:float|int|uint|bool|void|[ib]?vec[234]|uvec[234]|mat[234])"
FUNC_RE = re.compile(r"(?<![\w.])(?:%s)\s+(\w+)\s*\(([^()]*)\)\s*\{" % TYPE_RE)
CONST_INT_RE = re.compile(r"\bconst\s+int\s+(\w+)\s*=\s*(\d+)\s*;")
TOKEN_RE = re.compile(r"\w+|[^\s\w]")


class GateFail(Exception):
    pass


# ------------------------------------------------------------------ templates
# uniforms of the Qt wallpaper shaders (same list as the shipped wallpaper-effects)
WALL_MEMBERS = [("float", "time"), ("vec2", "mouse"), ("vec2", "res"), ("vec2", "imgSize"), ("vec4", "cBg"), ("vec4", "cBlue"),
                ("vec4", "cMagenta"), ("vec4", "cPink"), ("vec4", "cCream"), ("vec4", "cTarget"), ("float", "react"), ("float", "range"), ("float", "zoom")]
MOUSE_MEMBERS = [("float", "time"), ("vec2", "mouse"), ("vec2", "res"), ("vec4", "h0"), ("vec4", "h1"), ("vec4", "h2"), ("vec4", "h3")]

# helper functions every template offers (a helper is only added when the code calls it and does not define its own)
HELPERS = [
    ("hash", (), "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n"),
    ("noise", ("hash",), """float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
"""),
    ("fbm", ("noise",), """float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
"""),
    ("luma", (), "float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }\n"),
]


# The shared library the Rich Builders are given (docs/theme-instructions.md, chapter "The helper library"). Same rule as above: a helper is
# only added when the code calls it and does not define its own. (name, needs, source, kinds or None for every kind)
RICH_HELPERS = [
    ("hash2", ("hash",), "vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }\n", None),
    ("gnoise", ("hash2",), """float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash2(i) * 2.0 - 1.0, f);
  float b = dot(hash2(i + vec2(1, 0)) * 2.0 - 1.0, f - vec2(1, 0));
  float c = dot(hash2(i + vec2(0, 1)) * 2.0 - 1.0, f - vec2(0, 1));
  float d = dot(hash2(i + vec2(1, 1)) * 2.0 - 1.0, f - vec2(1, 1));
  return clamp(0.5 + 0.9 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y), 0.0, 1.0);
}
""", None),
    ("ridge", ("gnoise",), """float ridge(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * (1.0 - abs(2.0 * gnoise(p) - 1.0)); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
""", None),
    ("warp", ("fbm",), """vec2 warp(vec2 p, float t) {
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.10)), fbm(p + vec2(5.2, 1.3 - t * 0.10)));
  return p + 1.6 * (q - 0.5);
}
""", None),
    ("rot", (), "vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }\n", None),
    ("disc", (), "float disc(vec2 p, float r, float soft) { return 1.0 - smoothstep(r - soft, r + max(soft, 0.0001), length(p)); }\n", None),
    ("ring", (), "float ring(vec2 p, float r, float w, float soft) { return 1.0 - smoothstep(w, w + max(soft, 0.0001), abs(length(p) - r)); }\n", None),
    ("seg", (), """float seg(vec2 p, vec2 a, vec2 b, float w, float soft) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
  return 1.0 - smoothstep(w, w + max(soft, 0.0001), length(pa - ba * h));
}
""", None),
    ("rbox", (), """float rbox(vec2 p, vec2 b, float r, float soft) {
  vec2 q = abs(p) - b + r;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return 1.0 - smoothstep(0.0, max(soft, 0.0001), d);
}
""", None),
    ("caustic", (), """float caustic(vec2 p, float t) {
  vec2 q = mod(p * 6.28318, 6.28318) - 250.0, i = q;
  float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / max(length(vec2(q.x / (sin(i.x + tt) / 0.005), q.y / (cos(i.y + tt) / 0.005))), 0.0001);
  }
  c = 1.17 - pow(max(c / 4.0, 0.0), 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}
""", None),
    ("rays", ("noise",), """float rays(vec2 p, vec2 src, float t) {
  vec2 d = p - src;
  float r = length(d);
  vec2 u = d / max(r, 0.0001);
  float b = noise(u * 3.0 + vec2(t * 0.15, -t * 0.11)) * 0.6 + noise(u * 7.0 + vec2(-t * 0.2, t * 0.09)) * 0.4;
  return smoothstep(0.35, 0.95, b) * exp(-r * 1.6);
}
""", None),
    ("sparks", ("hash", "hash2"), """float sparks(vec2 p, float t, float cells, vec2 dir) {
  vec2 g = p * cells, id = floor(g), f = fract(g) - 0.5;
  vec2 h = hash2(id);
  float life = fract(t * (0.06 + 0.12 * h.x) + h.y);
  vec2 d2 = dir / max(1.0, length(dir));
  vec2 pos = (h - 0.5) * 0.24 + d2 * (life - 0.5) * 0.5 + vec2(0.04 * sin(t * 0.9 + h.y * 6.2832), 0.0);
  float fade = sin(3.14159 * life);
  float tw = 0.65 + 0.35 * sin(t * (2.0 + 5.0 * h.x) + h.y * 20.0);
  float size = 0.025 + 0.03 * hash(id + 7.7);
  return smoothstep(size * 1.6, 0.0, length(f - pos)) * fade * fade * tw * step(0.3, hash(id + 3.3));
}
""", None),
    ("streaks", ("hash",), """float streaks(vec2 p, float t, float rows, float speed) {
  float row = floor(p.y * rows);
  float h1 = hash(vec2(row, 3.0)), h2 = hash(vec2(row, 7.0));
  float x = fract(p.x * 0.6 + t * speed * (0.4 + h1) + h1 * 9.0);
  float len = 0.12 + 0.3 * h2;
  float lane = 1.0 - smoothstep(0.25, 0.5, abs(fract(p.y * rows) - 0.5));
  return smoothstep(0.0, 0.04, x) * smoothstep(len, 0.04, x) * step(0.55, hash(vec2(row, 11.0))) * lane;
}
""", None),
    ("mist", ("fbm",), """float mist(vec2 p, float t) {
  return fbm(p * vec2(1.6, 2.6) + vec2(t * 0.03, 0.0)) * 0.6 + fbm(p * 3.1 - vec2(t * 0.055, t * 0.01)) * 0.4;
}
""", None),
    ("vig", (), "float vig(vec2 uv, float s) { return 1.0 - s * smoothstep(0.3, 0.95, length((uv - 0.5) * 1.4)); }\n", None),
    ("ramp", (), """vec3 ramp(float x, vec3 a, vec3 b, vec3 c) {
  x = clamp(x, 0.0, 1.0);
  return mix(mix(a, b, clamp(x * 2.0, 0.0, 1.0)), c, clamp(x * 2.0 - 1.0, 0.0, 1.0));
}
""", None),
    ("ptr", (), """float ptr(vec2 p, vec2 m, float r) {
  float k = 1.0 - smoothstep(0.0, 1.0, length(p - m) / max(r, 0.0001));
  return k * k;
}
""", None),
    ("asp", (), "float asp() { return res.x / res.y; }\n", ("wallpaper",)),
]


def helper_table(rich=False):
    return [(n, d, src, None) for n, d, src in HELPERS] + (RICH_HELPERS if rich else [])


def helpers_for(code, kind="", rich=False):
    """the helper functions the code calls, dependencies first"""
    table = helper_table(rich)
    plain = strip_comments(code)
    own = set(functions_of(plain))
    ok = {n for n, _, _, ks in table if ks is None or kind in ks}
    want = set()
    def need(n):
        if n in want or n in own:
            return
        want.add(n)
        for h, deps, _, _ in table:
            if h == n:
                for d in deps:
                    need(d)
    for h, _, _, _ in table:
        if h in ok and re.search(r"(?<![\w.])%s\s*\(" % h, plain):
            need(h)
    return "".join(src for h, _, src, _ in table if h in want)

WALL_FUNCS = """vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; }
"""

WALL_MAIN = """void main() {
  vec2 uv = qt_TexCoord0;
  vec3 base = wall(uv);
  vec3 c = overlay(uv, base, mouse / res, react);
  fragColor = clamp(vec4(c, 1.0) * qt_Opacity, 0.0, 1.0);
}
"""

MOUSE_FUNCS = """vec2 P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  return h3.zw;
}
vec3 hue(float h) { return 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67))); }
"""

MOUSE_MAIN = """void main() {
  vec2 q = step(vec2(0.0), mouse) * step(mouse, res);
  vec4 c = cursorFx(qt_TexCoord0 * res, mouse) * (q.x * q.y);
  fragColor = clamp(c * qt_Opacity, 0.0, 1.0);
}
"""

SCREEN_HEAD = """#version 300 es
// category: %(cat)s
// desc: %(desc)s
// strength: %(start)d
// ai-generated: yes
%(target)sprecision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
%(uniforms)slayout(location = 0) out vec4 fragColor;
"""

WINDOW_UNIFORMS = {"is_active": "float", "seed": "float", "surface_size": "vec2"}
HEX_RE = re.compile(r"\bC_([0-9a-fA-F]{6})\b")


def hex_colors(code):
    """C_ff2030 -> vec3(1.0, 0.1255, 0.1882): the AI names a colour by its hex code, no arithmetic of its own"""
    def sub(m):
        h = m.group(1)
        return "vec3(%.4f, %.4f, %.4f)" % tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return HEX_RE.sub(sub, code)


def one_line(s, n=120):
    return re.sub(r"\s+", " ", re.sub(r"[^\x20-\x7e]", " ", str(s or ""))).strip()[:n]


def build(kind, code, desc="", start=70, name="", rich=False):
    """-> {'frag': text of the shipped-style file, 'es': an ES 3.00 twin for the offscreen render (wallpaper/cursor), 'animated': bool}
    code is the AI's code after the colour shorthand is expanded."""
    code = hex_colors(code).strip() + "\n"
    desc = one_line(desc, 140) or "Made by AI"
    start = max(5, min(100, int(start)))
    animated = re.search(r"\btime\b", code) is not None
    helpers = helpers_for(code, kind, rich)
    if kind in ("screen", "window", "color"):
        uniforms = ""
        if animated and kind != "color":
            uniforms += "uniform float time;\n"
        if kind == "window":
            for u, t in WINDOW_UNIFORMS.items():
                if re.search(r"\b%s\b" % u, code):
                    uniforms += "uniform %s %s;\n" % (t, u)
        head = SCREEN_HEAD % {"cat": CATEGORY, "desc": desc, "start": start, "target": "// target: window\n" if kind == "window" else "", "uniforms": uniforms}
        return {"frag": head + helpers + code, "es": "", "animated": animated and kind != "color", "code": code, "rich": rich}
    if kind == "wallpaper":
        members, funcs, main_ = WALL_MEMBERS, helpers + WALL_FUNCS, WALL_MAIN
        extra = "layout(binding = 1) uniform sampler2D src;\n"
        meta = "// category: %s\n// label: %s\n// hint: %s\n// ai-generated: yes\n" % (CATEGORY, one_line(name, 40) or "Made by AI", desc)
        members_q = "  mat4 qt_Matrix;\n  float qt_Opacity;\n"
    elif kind == "cursor":
        members, funcs, main_ = MOUSE_MEMBERS, helpers + MOUSE_FUNCS, MOUSE_MAIN
        extra = ""
        meta = "// category: %s\n// desc: %s\n// motion: %s\n// ai-generated: yes\n" % (CATEGORY, desc, "yes" if animated else "no")
        members_q = "  mat4 qt_Matrix;\n  float qt_Opacity;\n"
    else:
        raise GateFail("unknown kind " + kind)
    ubo = "".join("  %s %s;\n" % m for m in members)
    qt = ("#version 440\n" + meta + "layout(location = 0) in vec2 qt_TexCoord0;\nlayout(location = 0) out vec4 fragColor;\n"
          "layout(std140, binding = 0) uniform buf {\n" + members_q + ubo + "};\n" + extra + "\n" + funcs + "\n" + code + "\n" + main_)
    es = ("#version 300 es\nprecision highp float;\nin vec2 qt_TexCoord0;\nout vec4 fragColor;\nconst float qt_Opacity = 1.0;\n"
          + "".join("uniform %s %s;\n" % m for m in members) + ("uniform sampler2D src;\n" if kind == "wallpaper" else "")
          + "\n" + funcs + "\n" + code + "\n" + main_)
    return {"frag": qt, "es": es, "animated": animated, "code": code, "rich": rich}


# ------------------------------------------------------------------ a) text rules
def strip_comments(s):
    s = re.sub(r"/\*.*?\*/", " ", s, flags=re.S)
    return re.sub(r"//[^\n]*", "", s)


def text_rules(kind, code, lim=None):
    """problems found in the raw AI code (before the colour shorthand is expanded)"""
    lim = lim or limits("quick", kind)
    p = []
    if not code.strip():
        return ["the code is empty"]
    if len(code) > lim["code"]:
        p.append("the code is %d characters long; the limit is %d. Make it shorter and simpler" % (len(code), lim["code"]))
    if code.count("\n") > lim["lines"]:
        p.append("the code has more than %d lines" % lim["lines"])
    bad = re.search(r"[^\x09\x0a\x20-\x7e]", code)
    if bad:
        p.append("the code contains a character that is not plain ASCII (%r); use plain ASCII only, also in comments" % bad.group(0))
    if "#" in code:
        p.append("the code contains a '#'. No preprocessor lines at all (#include, #extension, #define, #version are not allowed); write constants as 'const float NAME = 1.0;'")
    plain = strip_comments(code)
    for w in BANNED_WORDS:
        if re.search(r"\b%s\b" % w, plain):
            why = {"discard": "discard is not allowed", "uniform": "the template already declares every uniform; do not declare any",
                   "layout": "do not declare inputs or outputs; the template does", "while": "only 'for' loops with constant bounds are allowed",
                   "do": "only 'for' loops with constant bounds are allowed", "switch": "use if/else instead of switch", "struct": "structs are not allowed",
                   "precision": "do not set the precision; the template does"}.get(w, "'%s' is not allowed" % w)
            p.append(why)
    if "[" in plain or "]" in plain:
        p.append("no arrays and no [ ] indexing at all (they break on some graphics drivers); use if-chains or .x .y .z .w")
    if re.search(r"\bgl_(?!FragCoord\b)", plain):
        p.append("only gl_FragCoord may be used from the gl_ names")
    if re.search(r"\b(?:tex|src)\s*=|\b(?:in|out)\s+(?:float|vec|int)\w*\s+\w+\s*;", plain):
        p.append("do not declare or assign inputs and outputs; the template does")
    if kind == "color":
        rest = re.sub(r"texture\s*\(\s*tex\s*,\s*v_texcoord\s*\)", "", plain)
        if re.search(r"v_texcoord|gl_FragCoord|\btex\b|\btime\b", rest):
            p.append("a colour grade may only read the picture as texture(tex, v_texcoord) and may not use time or the position")
    if kind in ("screen", "window", "color") and not re.search(r"\bvoid\s+main\s*\(\s*\)", plain):
        p.append("define 'void main()' and write fragColor")
    if kind == "wallpaper" and not re.search(r"\bvec3\s+overlay\s*\(\s*vec2\s+\w+\s*,\s*vec3\s+\w+\s*,\s*vec2\s+\w+\s*,\s*float\s+\w+\s*\)", plain):
        p.append("define 'vec3 overlay(vec2 uv, vec3 base, vec2 m, float react)'")
    if kind == "cursor" and not re.search(r"\bvec4\s+cursorFx\s*\(\s*vec2\s+\w+\s*,\s*vec2\s+\w+\s*\)", plain):
        p.append("define 'vec4 cursorFx(vec2 p, vec2 m)'")
    if kind in ("wallpaper", "cursor") and re.search(r"\bvoid\s+main\s*\(", plain):
        p.append("do not define main(); the template has it")
    return p


# ------------------------------------------------------------------ b) cost rules
def match_end(text, i, open_c, close_c):
    """index just after the bracket that closes the one at text[i]"""
    depth = 0
    for j in range(i, len(text)):
        c = text[j]
        if c == open_c:
            depth += 1
        elif c == close_c:
            depth -= 1
            if depth == 0:
                return j + 1
    return -1


def functions_of(text):
    """{name: (params, body)} for the functions defined at the top level"""
    depth_at = []
    d = 0
    for c in text:
        if c == "}":
            d -= 1
        depth_at.append(d)
        if c == "{":
            d += 1
    funcs = {}
    for m in FUNC_RE.finditer(text):
        if depth_at[m.start()] != 0:
            continue
        open_i = m.end() - 1
        end = match_end(text, open_i, "{", "}")
        if end < 0:
            continue
        funcs[m.group(1)] = (m.group(2), text[open_i + 1:end - 1])
    return funcs


def const_value(tok, consts):
    tok = tok.strip()
    if re.fullmatch(r"-?\d+", tok):
        return int(tok)
    return consts.get(tok)


def parse_for(header, body, consts):
    """(trip count, loop variable) for 'int i = A; i < B; i++' with constant A and B, else raises GateFail"""
    parts = header.split(";")
    if len(parts) != 3:
        raise GateFail("a for loop must have three parts: 'for (int i = 0; i < 8; i++)'")
    m = re.fullmatch(r"\s*int\s+(\w+)\s*=\s*(-?\w+)\s*", parts[0])
    if not m:
        raise GateFail("a for loop must start with 'int i = <constant>'")
    var, a = m.group(1), const_value(m.group(2), consts)
    c = re.fullmatch(r"\s*%s\s*(<=|<|>=|>|!=)\s*(-?\w+)\s*" % re.escape(var), parts[1])
    if a is None or not c:
        raise GateFail("a for loop needs constant bounds: 'int i = 0; i < 8' with whole numbers or 'const int' names, nothing computed and no uniforms")
    op, b = c.group(1), const_value(c.group(2), consts)
    if b is None:
        raise GateFail("a for loop needs constant bounds: the end value must be a whole number or a 'const int' name")
    s = re.fullmatch(r"\s*(?:%s\s*(\+\+|--)|(\+\+|--)\s*%s|%s\s*(\+=|-=)\s*(\d+))\s*" % ((re.escape(var),) * 3), parts[2])
    if not s:
        raise GateFail("a for loop must step its variable with i++, i--, i += N or i -= N")
    step = 1
    up = True
    if s.group(1) or s.group(2):
        up = (s.group(1) or s.group(2)) == "++"
    else:
        step = int(s.group(4))
        up = s.group(3) == "+="
        if step < 1:
            raise GateFail("a for loop must step by at least 1")
    if re.search(r"(?<![\w.])%s\s*(?:\+\+|--|[-+*/%%]?=(?!=))|(?:\+\+|--)\s*%s\b" % (re.escape(var), re.escape(var)), body):
        raise GateFail("the loop variable '%s' is changed inside its loop; only the for header may change it" % var)
    if up and op in ("<", "<="):
        trip = max(0, (b - a + (1 if op == "<=" else 0) + step - 1) // step)
    elif not up and op in (">", ">="):
        trip = max(0, (a - b + (1 if op == ">=" else 0) + step - 1) // step)
    else:
        raise GateFail("the for loop never ends cleanly: its comparison and its step must go the same way (i < N with i++, i > N with i--)")
    return trip, var


def analyze_text(text):
    """static cost of a finished shader text: dict(samples, iters, work, max_loop) for main(); raises GateFail for forbidden shapes"""
    text = strip_comments(text)
    consts = {n: int(v) for n, v in CONST_INT_RE.findall(text)}
    funcs = functions_of(text)
    if "main" not in funcs:
        raise GateFail("no main() function")
    memo, stack = {}, []
    stats = {"max_loop": 0}

    def calls_cost(chunk):
        samples = iters = 0
        work = len(TOKEN_RE.findall(chunk))
        for m in re.finditer(r"(?<![\w.])(\w+)\s*\(", chunk):
            name = m.group(1)
            if name == "texture":
                samples += 1
            elif name in funcs:
                s2, i2, w2 = func_cost(name)
                samples, iters, work = samples + s2, iters + i2, work + w2
        return samples, iters, work

    def region(txt):
        samples = iters = work = 0
        i = 0
        while True:
            m = re.compile(r"(?<![\w.])for\s*\(").search(txt, i)
            if not m:
                break
            s0, i0, w0 = calls_cost(txt[i:m.start()])
            samples, iters, work = samples + s0, iters + i0, work + w0
            hend = match_end(txt, m.end() - 1, "(", ")")
            if hend < 0:
                raise GateFail("unbalanced parentheses in a for loop")
            j = hend
            while j < len(txt) and txt[j].isspace():
                j += 1
            if j >= len(txt) or txt[j] != "{":
                raise GateFail("a for loop body must be inside { }")
            bend = match_end(txt, j, "{", "}")
            if bend < 0:
                raise GateFail("unbalanced braces in a for loop")
            body = txt[j + 1:bend - 1]
            trip, _ = parse_for(txt[m.end():hend - 1], body, consts)
            if trip > MAX_LOOP:
                raise GateFail("a loop runs %d times; the most allowed is %d" % (trip, MAX_LOOP))
            stats["max_loop"] = max(stats["max_loop"], trip)
            s1, i1, w1 = region(body)
            samples += trip * s1
            iters += trip * (i1 + 1)
            work += trip * (w1 + 8)
            i = bend
        s0, i0, w0 = calls_cost(txt[i:])
        return samples + s0, iters + i0, work + w0

    def func_cost(name):
        if name in memo:
            return memo[name]
        if name in stack:
            raise GateFail("function %s calls itself (recursion is not allowed)" % name)
        stack.append(name)
        memo[name] = region(funcs[name][1])
        stack.pop()
        return memo[name]

    s, i, w = func_cost("main")
    return {"samples": s, "iters": i, "work": w, "max_loop": stats["max_loop"]}


def call_rules(kind, built):
    """every name the AI code calls is a GLSL built-in or defined in the file; texture() reads only the given picture"""
    p = []
    code = strip_comments(built["code"])
    declared = set(functions_of(strip_comments(built["frag"])))
    for m in re.finditer(r"(?<![\w.])(\w+)\s*\(", code):
        n = m.group(1)
        if n in CONTROL or n in BUILTINS or n in declared:
            continue
        p.append("unknown function '%s'. Only GLSL built-ins and functions you define in the code may be called (helpers offered: %s%s)" %
                 (n, ", ".join(h for h, _, _, ks in helper_table(built.get("rich")) if ks is None or kind in ks), ", wall(uv)" if kind == "wallpaper" else ""))
    for m in re.finditer(r"\btexture(?:Size)?\s*\(\s*(\w*)", code):
        if kind in ("screen", "window", "color"):
            if m.group(1) != "tex":
                p.append("texture() may only read the picture 'tex'")
        else:
            p.append("do not call texture(): the picture is read with wall(uv)" if kind == "wallpaper" else "a cursor effect has no picture to read; do not call texture()")
    return sorted(set(p))


def static_rules(kind, raw_code, built, lim=None):
    lim = lim or limits("rich" if built.get("rich") else "quick", kind)
    problems = text_rules(kind, raw_code, lim)
    if problems:
        return problems, None
    # a fully assembled file is analysed: template helpers count towards the cost too
    full = built["frag"]
    probs = call_rules(kind, built)
    try:
        cost = analyze_text(full)
    except GateFail as e:
        return probs + [str(e)], None
    if cost["samples"] > lim["samples"]:
        probs.append("%d texture() samples per pixel; the limit is %d" % (cost["samples"], lim["samples"]))
    if cost["iters"] > lim["iters"]:
        probs.append("%d loop iterations per pixel (nested loops and called functions counted); the limit is %d" % (cost["iters"], lim["iters"]))
    if cost["work"] > lim["work"]:
        probs.append("about %d operations per pixel; the limit is %d. Use fewer loops or simpler maths" % (cost["work"], lim["work"]))
    return probs, cost


# ------------------------------------------------------------------ c) compile
def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def clean_log(s, n=700):
    lines = [l for l in s.splitlines() if l.strip() and not l.startswith(("Warning", "WARNING"))]
    return "\n".join(lines)[:n]


def compile_gate(kind, built, tmp):
    """the real compilers; returns problems"""
    probs = []
    frag = os.path.join(tmp, "gen.frag")
    open(frag, "w").write(built["frag"])
    if kind in ("screen", "window", "color"):
        glslang = shutil.which("glslangValidator")
        base = [sys.executable, os.path.join(HERE, "compose-shader"), os.path.join(tmp, "c.frag")]
        vivid = os.path.join(ROOT, "colors", "vivid.frag")
        swirl = os.path.join(ROOT, "cursor-shaders", "swirl.frag")
        crt = os.path.join(ROOT, "shaders", "crt.frag")
        variants = []
        if kind == "color":
            variants = [("alone", ["--col", frag, "50"]), ("as the window colour", ["--window", "--col", frag, "50"]),
                        ("mixed as a second colour", ["--fx", crt, "50", "--col", vivid, "50", "--col2", frag, "50", "blend", "50"])]
        else:
            variants = [("alone", ["--fx", frag, "50"]), ("with a colour grade", ["--fx", frag, "50", "--col", vivid, "50"]),
                        ("as a window shader", ["--window", "--fx", frag, "50"]),
                        ("stacked as the second effect", ["--fx", crt, "50", "--fx2", frag, "50", "stack", "50"]),
                        ("blended as the second effect", ["--fx", crt, "50", "--fx2", frag, "50", "blend", "50"])]
            if kind == "screen":
                variants.append(("with the cursor bend", ["--fx", frag, "50", "--cur", swirl]))
            if kind == "window":  # window shaders only ever run as a window shader
                variants = [("as a window shader", ["--window", "--fx", frag, "50"]),
                            ("as a window shader with a colour grade", ["--window", "--fx", frag, "50", "--col", vivid, "50"])]
        for label, args in variants:
            r = run(base + args)
            if r.returncode != 0:
                probs.append("it cannot be combined (%s): %s" % (label, clean_log(r.stderr or r.stdout, 300)))
                break
            if glslang:
                g = run([glslang, "-S", "frag", os.path.join(tmp, "c.frag")])
                if g.returncode != 0 or re.search(r"^ERROR", g.stdout, re.M):
                    probs.append("GLSL compile error (%s): %s" % (label, clean_log(g.stdout, 700)))
                    break
    else:
        qsb = shutil.which("qsb") or "/usr/lib/qt6/bin/qsb"
        if not os.access(qsb, os.X_OK):
            return ["qsb (qt6-shadertools) is missing, so wallpaper and cursor shaders cannot be built here"]
        out = os.path.join(tmp, "gen.frag.qsb")
        r = run([qsb, "--qt6", "-o", out, frag])
        if r.returncode != 0:
            probs.append("GLSL compile error (Qt shader tool): %s" % clean_log(r.stderr or r.stdout, 700))
        else:
            # arrays in the old GLSL variant break on the NVIDIA GL path; the build script checks the same
            g = run([qsb, "-x", "glsl,100es", "-o", "/dev/stdout", out])
            if re.search(r"^(const )?[a-z0-9]+ _[0-9]+\[[0-9]+\] *=", g.stdout, re.M):
                probs.append("the shader contains an array after compiling; avoid constant arrays")
    return probs


# ------------------------------------------------------------------ d) render
def render_ready():
    """'' when the safety check can run here, else a plain sentence saying what to install"""
    missing = []
    for mod, pkg in (("PIL", "python-pillow"), ("numpy", "python-numpy")):
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)
    if not shutil.which("glslangValidator"):
        missing.append("glslang")
    if not (shutil.which("qsb") or os.access("/usr/lib/qt6/bin/qsb", os.X_OK)):
        missing.append("qt6-shadertools")
    if not missing:
        return ""
    return "Inventing new effects needs the safety check, which needs %s. Install them with your package manager. Until then use Pick existing." % ", ".join(missing)


def cover_image(path):
    """the user's picture covered to 1920x1080 (a gradient when there is none), no text panels"""
    from PIL import Image
    import numpy as np
    if path and os.path.isfile(path):
        im = Image.open(path).convert("RGB")
        s = max(W / im.width, H / im.height)
        im = im.resize((max(W, round(im.width * s)), max(H, round(im.height * s))), Image.LANCZOS)
        x, y = (im.width - W) // 2, (im.height - H) // 2
        im = im.crop((x, y, x + W, y + H))
    else:
        gx = np.linspace(0, 1, W)[None, :, None]
        gy = np.linspace(0, 1, H)[:, None, None]
        arr = (np.concatenate([0.25 + 0.5 * gx + 0 * gy, 0.2 + 0.4 * gy + 0 * gx, 0.5 - 0.3 * gx + 0.2 * gy], axis=2) * 255).astype("uint8")
        im = Image.fromarray(arr)
    return im


def test_image(path, out_png):
    """the user's picture covered to 1920x1080 with two text panels (white on dark, black on light); returns the text masks"""
    from PIL import ImageDraw, ImageFont
    import numpy as np
    im = cover_image(path)
    draw = ImageDraw.Draw(im)
    font = None
    for cand in ("/usr/share/fonts/TTF/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/noto/NotoSans-Regular.ttf"):
        if os.path.isfile(cand):
            font = ImageFont.truetype(cand, 64)
            break
    if font is None:
        try:
            font = ImageFont.load_default(64)
        except TypeError:
            font = ImageFont.load_default()
    panels = []
    for i, (bg, fg, x0) in enumerate((((16, 16, 24), (245, 245, 245), 120), ((236, 236, 228), (12, 12, 12), 1010))):
        box = (x0, 380, x0 + 790, 640)
        draw.rectangle(box, fill=bg)
        draw.text((x0 + 36, 440), "Readable text", font=font, fill=fg)
        draw.text((x0 + 36, 530), "0123 abc ABC", font=font, fill=fg)
        panels.append((box, bg, fg))
    im.save(out_png)
    masks = []
    for box, bg, fg in panels:
        a = np.asarray(im, dtype=np.float32)
        sub = np.zeros((H, W), dtype=bool)
        sub[box[1]:box[3], box[0]:box[2]] = True
        d_fg = np.abs(a - np.array(fg, dtype=np.float32)).sum(axis=2) < 60
        d_bg = np.abs(a - np.array(bg, dtype=np.float32)).sum(axis=2) < 60
        masks.append((sub & d_fg, sub & d_bg))
    return masks


def luma_of(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def render(frag, base_png, out_png, uniforms=None, alpha=False, t=1.5, budget=None):
    """run bin/shader-preview; returns (seconds, error text)"""
    env = dict(os.environ)
    for k, v in (uniforms or {}).items():
        env["U_" + k] = v
    if alpha:
        env["SP_ALPHA"] = "1"
    budget = budget or RENDER_BUDGET_S
    t0 = time.time()
    try:
        r = run([sys.executable, os.path.join(HERE, "shader-preview"), base_png, frag, out_png, str(t)], env=env, timeout=budget * 2)
    except subprocess.TimeoutExpired:
        return budget * 2, "the render took more than %d seconds" % int(budget * 2)
    dt = time.time() - t0
    if r.returncode != 0 or not os.path.isfile(out_png):
        return dt, clean_log(r.stderr or r.stdout, 700) or "the offscreen render failed"
    return dt, ""


def read_rgb(path):
    from PIL import Image
    import numpy as np
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0


def readable(base, out, masks):
    """text contrast after the effect compared with before, per panel; returns problems"""
    p = []
    lb, lo = luma_of(base), luma_of(out)
    for i, (mt, mb) in enumerate(masks):
        if mt.sum() < 200 or mb.sum() < 200:
            continue
        cin = abs(lb[mt].mean() - lb[mb].mean())
        cout = abs(lo[mt].mean() - lo[mb].mean())
        if cout < 0.5 * cin or cout < 0.22:
            p.append("text is not readable at the start strength (%s text contrast fell from %.0f%% to %.0f%%; it must stay above half and above 22%%). Make the effect lighter or lower its start strength" %
                     ("white-on-dark" if i == 0 else "black-on-light", cin * 100, cout * 100))
    return p


# A colour mix that only changes smoothly over the frame (vignette, gradient, a function of the picture's own colour) and does not move
# is a tint. It is measured as the rms of what a smooth model (constant, radial and linear terms, the picture's colour and its squares)
# cannot explain, on the render itself and on the difference between two moments (and, for wallpapers, two pointer places).
# Calibrated on the shipped screen/window shaders at start strength 70 and on all light overlays (bin/wallpaper-overlay-scan list).
TINT_W, TINT_H = 480, 270
TINT_STATIC_MAX = 0.025
TINT_TIME_MAX = 0.008
TINT_POINTER_MAX = 0.008


def smooth_design(base):
    import numpy as np
    h, w = base.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    x = (xx / (w - 1) - 0.5) * 2
    y = (yy / (h - 1) - 0.5) * 2
    r2 = (x * x + y * y) * 0.5
    r_, g_, b_ = base[..., 0], base[..., 1], base[..., 2]
    cols = [np.ones_like(r_), r2, r2 * r2, x, y, r_, g_, b_, r_ * r_, g_ * g_, b_ * b_, r_ * g_, r_ * b_, g_ * b_, r_ * r2, g_ * r2, b_ * r2]
    return np.stack([c.ravel() for c in cols], 1)


def unexplained(design, y):
    import numpy as np
    y = y.reshape(-1, 3)
    coef = np.linalg.lstsq(design, y, rcond=None)[0]
    return float(np.sqrt(((y - design @ coef) ** 2).mean()))


def tint_check(kind, start, tmp, image, budget=None):
    """-> (problems, info) for screen, window and wallpaper effects that are only a colour mix"""
    import numpy as np
    from PIL import Image
    low_png = os.path.join(tmp, "low.png")
    pic = cover_image(image).resize((TINT_W, TINT_H), Image.LANCZOS)
    pic.save(low_png)
    base = np.asarray(pic, dtype=np.float32) / 255.0
    design = smooth_design(base)
    shots = []
    if kind in ("screen", "window"):
        runs = [(1.5, None), (5.0, None)]
    else:
        runs = [(1.5, (0.5, 0.5)), (5.0, (0.5, 0.5)), (1.5, (0.2, 0.78))]
    for i, (t, m) in enumerate(runs):
        out_png = os.path.join(tmp, "low%d.png" % i)
        if kind == "wallpaper":
            uni = {"mouse": "%d,%d" % (m[0] * TINT_W, m[1] * TINT_H), "res": "%d,%d" % (TINT_W, TINT_H), "imgSize": "%d,%d" % (TINT_W, TINT_H), "time": str(t)}
            dt, err = render(os.path.join(tmp, "gen.es.frag"), low_png, out_png, uni, t=t, budget=budget)
        else:
            dt, err = render(os.path.join(tmp, "render.frag"), low_png, out_png, t=t, budget=budget)
        if err:
            return [], {}
        shots.append(read_rgb(out_png))
    info = {}
    if kind == "wallpaper":
        t_res = unexplained(design, shots[1] - shots[0])
        p_res = unexplained(design, shots[2] - shots[0])
        info.update(tint_time=round(t_res, 4), tint_pointer=round(p_res, 4))
        if t_res < TINT_TIME_MAX and p_res < TINT_POINTER_MAX:
            return ["the overlay is only a colour tint: nothing in it moves with time or answers the pointer m beyond a smooth shading (motion %.3f, pointer %.3f; it needs %.3f in one of them). "
                    "Add light that lives on the picture: drifting caustic or sun-beam light, glints that twinkle, particles that float and are pushed by the pointer, ripples that spread from m. Colour is the grade's job, not the overlay's"
                    % (t_res, p_res, TINT_TIME_MAX)], info
        return [], info
    k = 70.0 / max(float(start), 20.0)
    s_res = unexplained(design, shots[0]) * k
    t_res = unexplained(design, shots[1] - shots[0]) * k
    info.update(tint_static=round(s_res, 4), tint_time=round(t_res, 4))
    if s_res < TINT_STATIC_MAX and t_res < TINT_TIME_MAX:
        return ["the effect is only a colour tint: it is a smooth colour mix that does not move (structure %.3f, motion %.3f; it needs %.3f or %.3f). "
                "Make something in it alive with time: drifting light, caustics, sun beams, glints, haze or grain that moves, so a person sees it live. Colour is the grade's job, not the screen or window effect's"
                % (s_res, t_res, TINT_STATIC_MAX, TINT_TIME_MAX)], info
    return [], info


def render_gate(kind, built, start, tmp, image, lim=None):
    """-> (problems, info)"""
    import numpy as np
    lim = lim or limits("quick", kind)
    base_png = os.path.join(tmp, "base.png")
    masks = test_image(image, base_png)
    base = read_rgb(base_png)
    out_png = os.path.join(tmp, "out.png")
    info = {}
    probs = []
    if kind in ("screen", "window", "color"):
        frag = os.path.join(tmp, "gen.frag")
        comp = os.path.join(tmp, "render.frag")
        args = ["--col" if kind == "color" else "--fx", frag, str(start)]
        if kind == "window":
            args = ["--window"] + args
        r = run([sys.executable, os.path.join(HERE, "compose-shader"), comp] + args)
        if r.returncode != 0:
            return [clean_log(r.stderr, 400)], info
        dt, err = render(comp, base_png, out_png, budget=lim["render_s"])
    elif kind == "wallpaper":
        frag = os.path.join(tmp, "gen.es.frag")
        open(frag, "w").write(built["es"])
        dt, err = render(frag, base_png, out_png, {"mouse": "%d,%d" % (W // 2, H // 2), "res": "%d,%d" % (W, H), "imgSize": "%d,%d" % (W, H), "time": "1.5"}, budget=lim["render_s"])
    else:
        frag = os.path.join(tmp, "gen.es.frag")
        open(frag, "w").write(built["es"])
        dt, err = render(frag, base_png, out_png, {"mouse": "%d,%d" % (W // 2, H // 2), "res": "%d,%d" % (W, H)}, alpha=True, budget=lim["render_s"])
    info["render_s"] = round(dt, 2)
    if err:
        return ["render failed: " + err], info
    if dt > lim["render_s"]:
        return ["one 1920x1080 frame took %.1f s on the CPU; the budget is %d s. Make it cheaper (fewer loops, fewer samples)" % (dt, lim["render_s"])], info
    from PIL import Image
    if kind == "cursor":
        rgba = np.asarray(Image.open(out_png).convert("RGBA"), dtype=np.float32) / 255.0
        a = rgba[..., 3]
        cover = float((a > 0.03).mean() * 100)
        info["cover_pct"] = round(cover, 3)
        if cover < 0.01:
            probs.append("nothing is drawn around the pointer (alpha stays 0); draw something visible within about 300 pixels of m")
        if cover > 25:
            probs.append("the cursor effect covers %.0f%% of the screen; it must stay local around the pointer (under 25%%)" % cover)
        if np.isnan(rgba).any():
            probs.append("the output contains NaN values")
        comp = base * (1 - a[..., None]) + rgba[..., :3]
        Image.fromarray((np.clip(comp, 0, 1) * 255).astype("uint8")).save(os.path.join(tmp, "composite.png"))
        return probs, info
    out = read_rgb(out_png)
    if np.isnan(out).any():
        probs.append("the output contains NaN values")
    diff = np.abs(out - base).mean(axis=2)
    mean_change, frac = float(diff.mean() * 100), float((diff > 0.2).mean() * 100)
    info.update(change_pct=round(mean_change, 2), strong_pct=round(frac, 2))
    lum = luma_of(out)
    if lum.mean() < 0.02:
        probs.append("the result is a black screen")
    if lum.mean() > 0.985:
        probs.append("the result is a white screen")
    if float(lum.std()) < 0.015:
        probs.append("the result is a single flat colour")
    if kind == "wallpaper":
        if mean_change < 0.8:
            probs.append("the overlay does not change the picture visibly (changes %.1f%% of the picture at full strength; it needs at least 0.8%%)" % mean_change)
        if mean_change > MEAN_MAX or frac > FRAC_MAX:
            probs.append("the overlay repaints the picture (mean change %.0f%%, %.0f%% of pixels changed a lot; limits %d%% and %d%%). A wallpaper overlay must be light: add glints, haze or tint on top of 'base' and keep it" %
                         (mean_change, frac, MEAN_MAX, FRAC_MAX))
        mixed = base + (out - base) * (start / 100.0)
        probs += readable(base, mixed, masks)
    else:
        if mean_change < 1.0:
            probs.append("the effect hardly changes the picture at its start strength (%.1f%% change; it needs at least 1%%)" % mean_change)
        probs += readable(base, out, masks)
    Image.fromarray((np.clip(out, 0, 1) * 255).astype("uint8")).save(os.path.join(tmp, "result.png"))
    if kind in ("screen", "window", "wallpaper") and not any("black screen" in q or "white screen" in q or "single flat" in q for q in probs):
        tp, ti = tint_check(kind, start, tmp, image, lim["render_s"])
        probs += tp
        info.update(ti)
    return probs, info


# ------------------------------------------------------------------ frames
FRAME_KEYS = {"rounding": (0, 40), "border_size": (0, 8), "border_angle": (0, 360), "shadow_range": (0, 100), "shadow_power": (1, 4), "spin": (0, 200)}
FRAME_COLOR_KEYS = ("border_inactive", "shadow_color", "shadow_inactive")
HEX8 = re.compile(r"^[0-9a-fA-F]{8}$")


def frame_text(settings, desc):
    """a .frame file from a dict, only known keys with checked values; raises GateFail"""
    if not isinstance(settings, dict):
        raise GateFail("the frame settings must be a JSON object")
    lines = ["# category: %s" % CATEGORY, "# desc: %s" % (one_line(desc, 140) or "Made by AI"), "# ai-generated: yes"]
    unknown = sorted(str(k) for k in settings if k not in FRAME_KEYS and k not in FRAME_COLOR_KEYS and k not in ("border_colors", "shadow_offset"))
    if unknown:
        raise GateFail("unknown frame setting(s): %s" % ", ".join(unknown[:5]))
    for k, (lo, hi) in FRAME_KEYS.items():
        if k in settings:
            try:
                lines.append("%s=%d" % (k, max(lo, min(hi, int(float(settings[k]))))))
            except (TypeError, ValueError):
                raise GateFail("frame setting %s must be a number" % k)
    cols = settings.get("border_colors")
    if cols is not None:
        cl = cols if isinstance(cols, list) else str(cols).split(",")
        cl = [str(c).strip().lstrip("#") for c in cl]
        cl = [c + "ff" if re.fullmatch(r"[0-9a-fA-F]{6}", c) else c for c in cl]
        if not 1 <= len(cl) <= 6 or not all(HEX8.match(c) for c in cl):
            raise GateFail("border_colors must be 1 to 6 colours like 'ff2030' or 'ff2030ff'")
        lines.append("border_colors=" + ",".join(c.lower() for c in cl))
    for k in FRAME_COLOR_KEYS:
        if k in settings:
            c = str(settings[k]).strip().lstrip("#")
            c = c + "ff" if re.fullmatch(r"[0-9a-fA-F]{6}", c) else c
            if not HEX8.match(c):
                raise GateFail("%s must be a colour like 'ff2030' or 'ff203088'" % k)
            lines.append("%s=%s" % (k, c.lower()))
    if "shadow_offset" in settings:
        m = re.fullmatch(r"\s*(-?\d{1,2})\s*,\s*(-?\d{1,2})\s*", str(settings["shadow_offset"]))
        if not m:
            raise GateFail("shadow_offset must look like '0,8'")
        lines.append("shadow_offset=%s,%s" % m.groups())
    if len(lines) <= 3:
        raise GateFail("the frame has no settings")
    return "\n".join(lines) + "\n"


# ------------------------------------------------------------------ the whole gate
def gate(kind, code, name="", desc="", start=70, image="", settings=None, keep_out="", profile="quick"):
    """Run every check. Returns {'ok', 'problems', 'info', 'built'}; never raises for a bad effect."""
    res = {"ok": False, "problems": [], "info": {"kind": kind}, "built": None}
    if kind not in KINDS:
        res["problems"] = ["unknown kind %s" % kind]
        return res
    if kind == "frame":
        try:
            res["built"] = {"frag": frame_text(settings if settings is not None else {}, desc), "es": "", "animated": False}
            res["ok"] = True
        except GateFail as e:
            res["problems"] = [str(e)]
        return res
    try:
        built = build(kind, code, desc, start, name, rich=(profile == "rich"))
    except (GateFail, ValueError) as e:
        res["problems"] = [str(e)]
        return res
    res["built"] = built
    lim = limits(profile, kind)
    probs, cost = static_rules(kind, code, built, lim)
    if cost:
        res["info"]["cost"] = cost
    if probs:
        res["problems"] = probs
        return res
    tmp = tempfile.mkdtemp(prefix="omashaders-gate-")
    try:
        cp = compile_gate(kind, built, tmp)
        if cp:
            res["problems"] = cp
            return res
        try:
            rp, info = render_gate(kind, built, max(5, min(100, int(start))), tmp, image, lim)
        except ImportError as e:
            res["problems"] = ["the render check needs python-pillow and python-numpy (%s)" % e]
            return res
        res["info"].update(info)
        if rp:
            res["problems"] = rp
        else:
            res["ok"] = True
        if keep_out:
            os.makedirs(keep_out, exist_ok=True)
            for f in ("base.png", "result.png", "composite.png"):
                if os.path.isfile(os.path.join(tmp, f)):
                    shutil.copy(os.path.join(tmp, f), os.path.join(keep_out, kind + "-" + f))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return res


# ------------------------------------------------------------------ the store
def slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", L.clean_name(name, 60).lower()).strip("-")
    return (s or "effect")[:30].strip("-")


def new_id(name, kind):
    d = os.path.join(GEN, SUBDIR[kind])
    base = PREFIX + slug(name)
    n, cand = 1, base
    while any(os.path.exists(os.path.join(GEN, sd, cand + ext)) for sd in set(SUBDIR.values()) for ext in (".frag", ".frame")):
        n += 1
        cand = "%s-%d" % (base, n)
    os.makedirs(d, exist_ok=True)
    return cand


def meta_path(eid):
    return os.path.join(GEN, "meta", eid + ".json")


def install(kind, built, name, desc, prompt="", fallback="", kept=False, uses="", extra=None):
    """write the effect into <state>/generated; returns its id. Only call with gate-approved output.
    Locked, because two background jobs can install at the same moment and must not pick the same id."""
    import fcntl
    os.makedirs(GEN, exist_ok=True)
    with open(os.path.join(GEN, ".lock"), "w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        return _install(kind, built, name, desc, prompt, fallback, kept, uses, extra)


def _install(kind, built, name, desc, prompt, fallback, kept, uses, extra=None):
    eid = new_id(name, kind)
    sub = os.path.join(GEN, SUBDIR[kind])
    os.makedirs(sub, exist_ok=True)
    ext = ".frame" if kind == "frame" else ".frag"
    target = os.path.join(sub, eid + ext)
    with open(target + ".tmp", "w") as f:
        f.write(built["frag"])
    if kind in ("wallpaper", "cursor"):
        qsb = shutil.which("qsb") or "/usr/lib/qt6/bin/qsb"
        r = run([qsb, "--qt6", "-o", target + ".qsb.tmp", target + ".tmp"])
        if r.returncode != 0:
            os.remove(target + ".tmp")
            raise GateFail("qsb failed: " + clean_log(r.stderr, 300))
        os.replace(target + ".qsb.tmp", target + ".qsb")
    os.replace(target + ".tmp", target)
    os.makedirs(os.path.join(GEN, "meta"), exist_ok=True)
    meta = {"id": eid, "kind": kind, "name": L.clean_name(name, 40) or eid, "desc": one_line(desc, 140), "prompt": one_line(prompt, 300),
            "created": int(time.time()), "kept": bool(kept), "fallback": fallback}
    if extra:
        meta.update(extra)
    with open(meta_path(eid) + ".tmp", "w") as f:
        json.dump(meta, f)
    os.replace(meta_path(eid) + ".tmp", meta_path(eid))
    return eid


def listing():
    out = []
    d = os.path.join(GEN, "meta")
    for fn in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        try:
            out.append(json.load(open(os.path.join(d, fn))))
        except (OSError, ValueError):
            continue
    return out


def files_of(eid):
    out = []
    for sd in set(SUBDIR.values()):
        for ext in (".frag", ".frag.qsb", ".frame"):
            p = os.path.join(GEN, sd, eid + ext)
            if os.path.exists(p):
                out.append(p)
    return out


def used_by(eid):
    n = 0
    for line in L.read_themes():
        if eid in line.split("|")[:8]:
            n += 1
    return n


def delete(eid):
    if not re.fullmatch(PREFIX + r"[a-z0-9-]{1,40}", eid or ""):
        raise L.Bad("That is not a generated effect")
    fs = files_of(eid)
    if not fs and not os.path.exists(meta_path(eid)):
        raise L.Bad("No generated effect named %s" % eid)
    for p in fs + [meta_path(eid)]:
        try:
            os.remove(p)
        except OSError:
            pass
    return used_by(eid)


def keep(eid):
    p = meta_path(eid)
    try:
        m = json.load(open(p))
    except (OSError, ValueError):
        raise L.Bad("No generated effect named %s" % eid)
    m["kept"] = True
    with open(p + ".tmp", "w") as f:
        json.dump(m, f)
    os.replace(p + ".tmp", p)


# ------------------------------------------------------------------ cli
def cmd_check(a):
    kind, path, opts, it = "", "-", {}, iter(a)
    for x in it:
        if x in ("--name", "--desc", "--start", "--image", "--keep-out", "--profile"):
            opts[x[2:]] = next(it, "")
        elif x == "--json":
            opts["json"] = True
        elif not kind:
            kind = x
        else:
            path = x
    code = sys.stdin.read() if path == "-" else open(path, encoding="utf-8", errors="replace").read()
    settings = None
    if kind == "frame":
        try:
            settings = json.loads(code)
        except ValueError:
            settings = None
    r = gate(kind, code, opts.get("name", ""), opts.get("desc", ""), int(opts.get("start") or 70), opts.get("image", ""), settings, opts.get("keep-out", ""), opts.get("profile") or "quick")
    r.pop("built", None)
    if opts.get("json"):
        print(json.dumps(r))
    else:
        print("PASS" if r["ok"] else "REFUSED")
        for p in r["problems"]:
            print(" - " + p)
        print(" info: " + json.dumps(r["info"]))
    return 0 if r["ok"] else 1


def cmd_analyze(files):
    rows = []
    for f in files:
        try:
            c = analyze_text(open(f, encoding="utf-8", errors="replace").read())
            rows.append((os.path.basename(f), c))
            print("%-32s samples=%-4d iters=%-6d work=%-7d maxloop=%d" % (os.path.basename(f), c["samples"], c["iters"], c["work"], c["max_loop"]))
        except GateFail as e:
            print("%-32s REFUSED: %s" % (os.path.basename(f), e))
    return 0


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0
    try:
        if a[0] == "check":
            return cmd_check(a[1:])
        if a[0] == "analyze":
            return cmd_analyze(a[1:])
        if a[0] == "list":
            items = listing()
            print(json.dumps(items) if "--json" in a else "\n".join("%s\t%s\t%s\t%s" % (m["id"], m["kind"], "kept" if m.get("kept") else "pending", m["name"]) for m in items))
        elif a[0] == "keep":
            keep(a[1])
        elif a[0] == "delete":
            n = delete(a[1])
            print("deleted %s%s" % (a[1], ("; %d saved theme(s) used it and will skip it" % n) if n else ""))
        elif a[0] == "selftest":
            import aigen_selftest
            return aigen_selftest.run()
        else:
            print(__doc__.strip(), file=sys.stderr)
            return 2
    except L.Bad as e:
        print("aigen: %s" % e, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
