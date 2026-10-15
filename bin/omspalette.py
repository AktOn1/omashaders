#!/usr/bin/env python3
"""omspalette: a Palette is a colour grade you describe with a few numbers instead of writing a shader.

A palette id is "pal-" plus hex digits, so it can be a colour name like any shipped grade (favourites, themes, share codes,
strength, per-app windows all just see another name). bin/compose-shader turns the id into a generated shader on first use.

What a palette does to each pixel, in this order:
  1. saturation and contrast of the original colours
  2. shadow tint and light tint: the original colours are pushed toward a hue in the dark / the bright parts (brightness is kept)
  3. ramp: the pixel's brightness is looked up on 2 to 5 colour stops (a gradient map); "gamma" bends the lookup
  4. keep original: 0 = fully recoloured by the ramp, 1 = the (tinted) original colours; no ramp = always the original
  5. steps: 2 to 15 flat levels per colour channel (posterize; 2 = each channel fully on or off)

Id layout after "pal-" (all lowercase hex):  N  STOPS  KEEP SAT CON GAM  SHADOW_RGB SHADOW_AMT  LIGHT_RGB LIGHT_AMT  STEPS
  N      1 digit, number of ramp stops (0 = no ramp, 2..5)
  STOPS  N times POS(2 digits, 00..ff = 0..1) RGB(6 digits)
  KEEP, SAT, CON, GAM  2 digits each: KEEP/255, SAT/128, CON/128, GAM/128   (neutral: 00 80 80 80)
  *_AMT  2 digits, /255 (00 = tint off)
  STEPS  1 digit, 0 = off, else 2..f levels

Command line:  omspalette.py id [key=value ...]   print an id (stops=pos:rrggbb,pos:rrggbb  keep=0.3 ...)
               omspalette.py show ID              print the parameters
               omspalette.py glsl ID              print the shader
"""
import re, sys

PREFIX = "pal-"
ID_RE = re.compile(r"^pal-[0-9a-f]{26,66}$")
MAX_STOPS = 5
LUMA = (0.2126, 0.7152, 0.0722)
NEUTRAL = {"keep": 0.0, "sat": 1.0, "con": 1.0, "gam": 1.0}


def is_palette_id(name):
    return isinstance(name, str) and ID_RE.match(name) is not None and _length_ok(name)


def _length_ok(name):
    h = name[len(PREFIX):]
    n = int(h[0], 16)
    return n in (0, 2, 3, 4, 5) and len(h) == 26 + 8 * n


def _byte(v, scale, hi=255):
    return max(0, min(hi, int(round(float(v) * scale))))


def make(stops=(), keep=0.0, sat=1.0, con=1.0, gam=1.0, shadow=("808080", 0.0), light=("808080", 0.0), steps=0):
    """-> palette dict. stops: [(pos 0..1, 'rrggbb'), ...] (sorted by position); colours are 'rrggbb' strings."""
    stops = sorted(((max(0.0, min(1.0, float(p))), _hex6(c)) for p, c in stops), key=lambda s: s[0])
    if len(stops) == 1:
        stops = [(0.0, stops[0][1]), (1.0, stops[0][1])]
    if len(stops) > MAX_STOPS:
        raise ValueError("a palette has at most %d colour stops" % MAX_STOPS)
    steps = int(steps)
    if steps not in (0,) + tuple(range(2, 16)):
        raise ValueError("steps must be 0 (off) or 2 to 15")
    return {"stops": stops, "keep": _clamp(keep, 0, 1), "sat": _clamp(sat, 0, 1.99), "con": _clamp(con, 0, 1.99),
            "gam": _clamp(gam, 0.1, 1.99), "shadow": (_hex6(shadow[0]), _clamp(shadow[1], 0, 1)),
            "light": (_hex6(light[0]), _clamp(light[1], 0, 1)), "steps": steps}


def _clamp(v, lo, hi):
    return max(lo, min(hi, float(v)))


def _hex6(c):
    c = str(c).lstrip("#").lower()
    if not re.fullmatch(r"[0-9a-f]{6}", c):
        raise ValueError("not a colour: %r (use rrggbb)" % c)
    return c


def encode(p):
    out = "%x" % len(p["stops"])
    for pos, c in p["stops"]:
        out += "%02x%s" % (_byte(pos, 255), c)
    out += "%02x%02x%02x%02x" % (_byte(p["keep"], 255), _byte(p["sat"], 128), _byte(p["con"], 128), _byte(p["gam"], 128))
    out += "%s%02x%s%02x" % (p["shadow"][0], _byte(p["shadow"][1], 255), p["light"][0], _byte(p["light"][1], 255))
    out += "%x" % p["steps"]
    return PREFIX + out


def decode(name):
    """palette id -> palette dict; ValueError for anything that is not a well-formed id"""
    if not is_palette_id(name):
        raise ValueError("not a palette id")
    h = name[len(PREFIX):]
    n = int(h[0], 16)
    i = 1
    stops = []
    for _ in range(n):
        stops.append((int(h[i:i + 2], 16) / 255.0, h[i + 2:i + 8]))
        i += 8
    keep, sat, con, gam = (int(h[i + 2 * k:i + 2 * k + 2], 16) for k in range(4))
    i += 8
    sh, sa, li, la = h[i:i + 6], int(h[i + 6:i + 8], 16), h[i + 8:i + 14], int(h[i + 14:i + 16], 16)
    i += 16
    gam_v = max(gam, 13) / 128.0
    return {"stops": stops, "keep": keep / 255.0, "sat": sat / 128.0, "con": con / 128.0, "gam": gam_v,
            "shadow": (sh, sa / 255.0), "light": (li, la / 255.0), "steps": int(h[i], 16)}


def normalise(name):
    """round-trip through decode/encode so the name is exactly what the editor would write"""
    return encode(decode(name))


def _f3(c):
    return "vec3(%.4f, %.4f, %.4f)" % tuple(int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def glsl(name):
    p = decode(name)
    stops = p["stops"]
    ramp = len(stops) >= 2
    L = []
    L.append("#version 300 es")
    L.append("// category: Custom")
    L.append("// strength: 100")
    L.append("// desc: Your own palette: %s" % describe(p))
    L.append("precision highp float;")
    L.append("in vec2 v_texcoord;")
    L.append("uniform sampler2D tex;")
    L.append("layout(location = 0) out vec4 fragColor;")
    L.append("float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }")
    if ramp:
        L.append("vec3 ramp(float l) {")
        L.append("    vec3 g = %s;" % _f3(stops[0][1]))
        for k in range(1, len(stops)):
            a, b = stops[k - 1][0], stops[k][0]
            if b - a < 1.0 / 255.0:
                L.append("    g = l >= %.4f ? %s : g;" % (b, _f3(stops[k][1])))
            else:
                L.append("    g = mix(g, %s, clamp((l - %.4f) / %.4f, 0.0, 1.0));" % (_f3(stops[k][1]), a, b - a))
        L.append("    return g;")
        L.append("}")
    L.append("void main() {")
    L.append("    vec4 s = texture(tex, v_texcoord);")
    L.append("    vec3 o = s.rgb;")
    if abs(p["sat"] - 1.0) > 1e-3:
        L.append("    o = mix(vec3(luma(o)), o, %.4f);" % p["sat"])
    if abs(p["con"] - 1.0) > 1e-3:
        L.append("    o = clamp((o - 0.5) * %.4f + 0.5, 0.0, 1.0);" % p["con"])
    L.append("    float l = clamp(luma(o), 0.0, 1.0);")
    tints = []
    if p["shadow"][1] > 0.002:
        tints.append("mix(vec3(1.0), %s / max(luma(%s), 0.05), %.4f * (1.0 - w))" % (_f3(p["shadow"][0]), _f3(p["shadow"][0]), p["shadow"][1]))
    if p["light"][1] > 0.002:
        tints.append("mix(vec3(1.0), %s / max(luma(%s), 0.05), %.4f * w)" % (_f3(p["light"][0]), _f3(p["light"][0]), p["light"][1]))
    if tints:
        L.append("    float w = smoothstep(0.25, 0.75, l);")
        L.append("    o = clamp(o * %s, 0.0, 1.0);" % " * ".join(tints))
    if ramp:
        lk = "l" if abs(p["gam"] - 1.0) < 1e-3 else "pow(l, %.4f)" % p["gam"]
        L.append("    vec3 g = ramp(%s);" % lk)
        L.append("    o = %s;" % ("mix(g, o, %.4f)" % p["keep"] if p["keep"] > 0.002 else "g"))
    if p["steps"] >= 2:
        L.append("    o = floor(o * %d.0 + 0.5) / %d.0;" % (p["steps"] - 1, p["steps"] - 1))
    L.append("    fragColor = vec4(clamp(o, 0.0, 1.0), s.a);")
    L.append("}")
    return "\n".join(L) + "\n"


def describe(p):
    bits = []
    if len(p["stops"]) >= 2:
        bits.append("%d-colour ramp #%s to #%s" % (len(p["stops"]), p["stops"][0][1], p["stops"][-1][1]))
    if p["keep"] > 0.002:
        bits.append("%d%% original colour" % round(p["keep"] * 100))
    if p["shadow"][1] > 0.002 or p["light"][1] > 0.002:
        bits.append("tinted shadows and lights")
    if p["steps"] >= 2:
        bits.append("%d levels" % p["steps"])
    return ", ".join(bits) or "unchanged colours"


def render(p, rgb):
    """The same maths as glsl() on a numpy array (..., 3) of 0..1 floats; used by the fitter and the self-test."""
    import numpy as np
    o = np.array(rgb, dtype=float)
    luma = lambda c: c @ np.array(LUMA)
    if abs(p["sat"] - 1) > 1e-3:
        o = luma(o)[..., None] + (o - luma(o)[..., None]) * p["sat"]
    if abs(p["con"] - 1) > 1e-3:
        o = np.clip((o - 0.5) * p["con"] + 0.5, 0, 1)
    l = np.clip(luma(o), 0, 1)
    w = np.clip((l - 0.25) / 0.5, 0, 1)
    w = w * w * (3 - 2 * w)
    mult = np.ones_like(o)
    for key, wt in (("shadow", 1 - w), ("light", w)):
        col, amt = p[key]
        if amt > 0.002:
            c = np.array([int(col[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])
            m = c / max(float(c @ np.array(LUMA)), 0.05)
            mult = mult * (1 + (m - 1) * (amt * wt)[..., None])
    if (p["shadow"][1] > 0.002) or (p["light"][1] > 0.002):
        o = np.clip(o * mult, 0, 1)
    stops = p["stops"]
    if len(stops) >= 2:
        lk = l ** p["gam"] if abs(p["gam"] - 1) > 1e-3 else l
        g = np.zeros_like(o)
        g[...] = [int(stops[0][1][i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
        for k in range(1, len(stops)):
            a, b = stops[k - 1][0], stops[k][0]
            c = np.array([int(stops[k][1][i:i + 2], 16) / 255.0 for i in (0, 2, 4)])
            t = np.clip((lk - a) / (b - a), 0, 1) if b - a >= 1 / 255.0 else (lk >= b).astype(float)
            g = g + (c - g) * t[..., None]
        o = g + (o - g) * p["keep"] if p["keep"] > 0.002 else g
    if p["steps"] >= 2:
        k = p["steps"] - 1
        o = np.floor(o * k + 0.5) / k
    return np.clip(o, 0, 1)


def _kv(args):
    kw = {}
    for a in args:
        k, _, v = a.partition("=")
        if k == "stops":
            kw["stops"] = [(float(x.split(":")[0]), x.split(":")[1]) for x in v.split(",") if x]
        elif k in ("shadow", "light"):
            c, _, amt = v.partition(":")
            kw[k] = (c, float(amt or 0.5))
        else:
            kw[k] = float(v)
    return kw


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "id":
        print(encode(make(**_kv(a[1:]))))
    elif a[0] == "show":
        print(decode(a[1]))
    elif a[0] == "glsl":
        sys.stdout.write(glsl(a[1]))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
