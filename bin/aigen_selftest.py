"""Offline self-test of bin/aigen.py: good effects pass the whole gate, every attack is refused with a reason.
Run: python3 bin/aigen.py selftest   (about 1 min, CPU rendering, no network, no AI call)"""
import sys
sys.dont_write_bytecode = True  # a __pycache__ in the plugin folder would make the shell reload the plugin (and close the open dialog)
import os
import shutil
import sys
import tempfile

import aigen as G

OK = FAIL = 0


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("FAIL %s %s" % (name, detail))


SCREEN_OK = """void main() {
  vec3 c = texture(tex, v_texcoord).rgb;
  vec3 warm = mix(c, c * C_ff2030 * 1.6, 0.35);
  float v = smoothstep(1.0, 0.3, length(v_texcoord - 0.5));
  float glint = smoothstep(0.62, 0.9, noise(v_texcoord * vec2(18.0, 10.0) + vec2(time * 0.3, -time * 0.2)));
  fragColor = vec4(mix(c, warm, 0.6) * (0.8 + 0.2 * v) + C_ffd0a0 * glint * 0.22, 1.0);
}
"""
# the same look as a plain tint with a vignette: must be refused
SCREEN_TINT = """void main() {
  vec3 c = texture(tex, v_texcoord).rgb;
  vec3 warm = mix(c, c * C_ff2030 * 1.6, 0.35);
  float v = smoothstep(1.0, 0.3, length(v_texcoord - 0.5));
  fragColor = vec4(mix(c, warm, 0.6) * (0.8 + 0.2 * v) * (0.97 + 0.03 * sin(time)), 1.0);
}
"""
WINDOW_TINT = """void main() {
  vec3 c = texture(tex, v_texcoord).rgb;
  float edge = smoothstep(0.0, 400.0, min(min(v_texcoord.x, 1.0 - v_texcoord.x) * surface_size.x, min(v_texcoord.y, 1.0 - v_texcoord.y) * surface_size.y));
  fragColor = vec4(mix(c * C_ff2030 * 1.4, c, edge), 1.0);
}
"""
WALL_TINT = """vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float v = smoothstep(1.0, 0.3, length(uv - 0.5));
  return mix(base, base * C_70c0b0 * 1.3, 0.4) + C_204040 * (1.0 - v) * (0.9 + 0.1 * sin(time * 0.5));
}
"""
WALL_OK = """vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float streak = noise(vec2(uv.x * 4.0 - time * 1.5, uv.y * 80.0));
  float band = smoothstep(0.6, 1.0, streak) * smoothstep(0.0, 0.5, uv.y) * 0.25;
  return base + vec3(1.0, 0.85, 0.7) * band;
}
"""
CURSOR_OK = """vec4 cursorFx(vec2 p, vec2 m) {
  float d = length(p - m);
  float ring = smoothstep(6.0, 0.0, abs(d - 40.0 - 6.0 * sin(time * 4.0)));
  return vec4(C_ff2030 * ring, ring);
}
"""
COLOR_OK = """void main() {
  vec3 c = texture(tex, v_texcoord).rgb;
  float l = luma(c);
  fragColor = vec4(mix(c, vec3(l) * C_ffb070 * 1.5, 0.5), 1.0);
}
"""
WINDOW_OK = """void main() {
  vec3 c = texture(tex, v_texcoord).rgb;
  float edge = smoothstep(0.0, 400.0, min(min(v_texcoord.x, 1.0 - v_texcoord.x) * surface_size.x, min(v_texcoord.y, 1.0 - v_texcoord.y) * surface_size.y));
  float dapple = smoothstep(0.55, 0.85, noise(v_texcoord * vec2(9.0, 6.0) + vec2(time * 0.25, time * 0.15)));
  fragColor = vec4(mix(c * C_ff2030 * 1.4, c, edge) + C_ffd0a0 * dapple * 0.2, 1.0);
}
"""

# (kind, code, text that must appear in the refusal)
ATTACKS = [
    ("screen", "#include </etc/passwd>\n" + SCREEN_OK, "'#'"),
    ("screen", "#extension GL_EXT_shader_image_load_store : enable\n" + SCREEN_OK, "'#'"),
    ("screen", "#define N 100000\n" + SCREEN_OK, "'#'"),
    ("screen", "uniform float evil;\n" + SCREEN_OK, "do not declare any"),
    ("screen", "layout(binding = 3) uniform sampler2D other;\n" + SCREEN_OK, "do not declare inputs"),
    ("screen", "void main() { while (true) { } fragColor = vec4(1.0); }", "'for' loops"),
    ("screen", "void main() { for (;;) { } fragColor = vec4(1.0); }", "must start with"),
    ("screen", "void main() { for (int i = 0; i < 100000; i++) { } fragColor = vec4(1.0); }", "the most allowed"),
    ("screen", "void main() { float s = 0.0; for (int i = 0; i < 64; i++) { for (int j = 0; j < 64; j++) { s += texture(tex, v_texcoord + vec2(float(i), float(j)) * 0.001).r; } } fragColor = vec4(vec3(s / 4096.0), 1.0); }", "texture() samples"),
    ("screen", "void main() { int n = int(v_texcoord.x * 50.0); float s = 0.0; for (int i = 0; i < n; i++) { s += 0.1; } fragColor = vec4(vec3(s), 1.0); }", "constant bounds"),
    ("screen", "void main() { float s = 0.0; for (int i = 0; i > -1; i++) { s += 0.1; } fragColor = vec4(vec3(s), 1.0); }", "never ends"),
    ("screen", "void main() { float s = 0.0; for (int i = 0; i < 8; i++) { i -= 1; s += 0.1; } fragColor = vec4(vec3(s), 1.0); }", "changed inside its loop"),
    ("screen", "void main() { float s = 0.0; for (int i = 0; i < 8; i++) s += 0.1; fragColor = vec4(vec3(s), 1.0); }", "inside { }"),
    ("screen", "void main() { fragColor = vec4(1.0); discard; }", "discard"),
    ("screen", "float a[3] = float[3](1.0, 2.0, 3.0);\nvoid main() { fragColor = vec4(a[0]); }", "no arrays"),
    ("screen", "float f(float x) { return f(x - 1.0); }\nvoid main() { fragColor = vec4(f(3.0)); }", "recursion"),
    ("screen", "void main() { fragColor = texelFetch(tex, ivec2(0), 0); }", "unknown function"),
    ("screen", "void main() { fragColor = vec4(imageLoad(evil, ivec2(0))); }", "unknown function"),
    ("screen", "void main() { fragColor = texture(other, v_texcoord); }", "only read the picture"),
    ("screen", "void main() { fragColor = vec4(1.0); } // café", "ASCII"),
    ("screen", "void main() { fragColor = vec4(1.0); }\n" + "// x\n" * 400, "lines"),
    ("screen", "void main() { fragColor = vec4(1.0); }\n/* " + "x" * 9500 + " */", "characters long"),
    ("screen", "", "empty"),
    ("screen", "void main() { fragColor = vec4(gl_Position); }", "gl_FragCoord"),
    ("window", "uniform float is_active;\n" + WINDOW_OK, "do not declare any"),
    ("color", "void main() { fragColor = texture(tex, v_texcoord + 0.1); }", "colour grade may only"),
    ("color", "void main() { fragColor = vec4(sin(time)); }", "colour grade may only"),
    ("wallpaper", "vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) { return texture(src, uv).rgb; }", "texture()"),
    ("wallpaper", "void main() { }", "define 'vec3 overlay"),
    ("wallpaper", "vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) { float s = 0.0; for (int i = 0; i < 64; i++) { for (int j = 0; j < 64; j++) { s += noise(uv * float(i + j)); } } return base + s * 0.0001; }", "loop iterations"),
    ("cursor", "vec4 cursorFx(vec2 p, vec2 m) { return vec4(0.0); } void main() { }", "do not define main"),
    ("cursor", "vec4 cursorFx(vec2 p, vec2 m) { return texture(src, p); }", "do not call texture"),
]

# (kind, code, text that must appear): these pass the text and compile rules and fail the offscreen render
RENDER_ATTACKS = [
    ("screen", "void main() { fragColor = vec4(0.0, 0.0, 0.0, 1.0); }", "not readable"),
    ("screen", "void main() { fragColor = vec4(0.3, 0.5, 0.7, 1.0); }", "not readable"),
    ("screen", "void main() { vec3 c = texture(tex, v_texcoord).rgb; fragColor = vec4(mix(c, vec3(0.5), 0.92), 1.0); }", "not readable"),
    ("wallpaper", "vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) { return vec3(uv.x, 0.2, 1.0 - uv.y); }", "repaints the picture"),
    ("wallpaper", "vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) { return base; }", "does not change"),
    ("screen", SCREEN_TINT, "only a colour tint"),
    ("window", WINDOW_TINT, "only a colour tint"),
    ("wallpaper", WALL_TINT, "only a colour tint"),
    ("cursor", "vec4 cursorFx(vec2 p, vec2 m) { return vec4(1.0, 0.0, 0.0, 1.0); }", "must stay local"),
    ("cursor", "vec4 cursorFx(vec2 p, vec2 m) { return vec4(0.0); }", "nothing is drawn"),
]


def run():
    tmp = tempfile.mkdtemp(prefix="aigen-selftest-")
    try:
        # 1) the attacks (static and compile stage, fast)
        for kind, code, want in ATTACKS:
            r = G.gate(kind, code, "attack", "attack", 60)
            joined = " | ".join(r["problems"])
            check("attack refused: " + code[:50].replace("\n", " "), not r["ok"] and want in joined, "got: %s" % (joined or "PASS"))
        ready = not G.render_ready()
        if not ready:
            print("skipped: the render stage (%s)" % G.render_ready())
        # 2) the good ones pass the whole gate
        for kind, code in (("screen", SCREEN_OK), ("window", WINDOW_OK), ("color", COLOR_OK), ("wallpaper", WALL_OK), ("cursor", CURSOR_OK)) if ready else ():
            r = G.gate(kind, code, "good", "good effect", 60)
            check("good %s passes" % kind, r["ok"], " | ".join(r["problems"]))
        # 3) render-stage attacks
        for kind, code, want in RENDER_ATTACKS if ready else ():
            r = G.gate(kind, code, "attack", "attack", 60)
            joined = " | ".join(r["problems"])
            check("render attack refused: " + code[:50], not r["ok"] and want in joined, "got: %s" % (joined or "PASS"))
        # 3b) the Rich profile: bigger numbers, every safety rule unchanged
        for kind, code, want in ATTACKS:
            if want in ("lines", "characters long"):   # the only attacks that are about the Quick size caps
                continue
            r = G.gate(kind, code, "attack", "attack", 60, profile="rich")
            joined = " | ".join(r["problems"])
            check("rich attack refused: " + code[:50].replace("\n", " "), not r["ok"] and want in joined, "got: %s" % (joined or "PASS"))
        long_ok = SCREEN_OK + "// x\n" * 400
        check("rich allows 400 lines, quick does not", not [p for p in G.gate("screen", long_ok, "x", "x", 60, profile="rich")["problems"] if "lines" in p]
              and any("lines" in p for p in G.gate("screen", long_ok, "x", "x", 60)["problems"]))
        for kind, code, want in RENDER_ATTACKS if ready else ():
            r = G.gate(kind, code, "attack", "attack", 60, profile="rich")
            joined = " | ".join(r["problems"])
            check("rich render attack refused: " + code[:50], not r["ok"] and want in joined, "got: %s" % (joined or "PASS"))
        for kind, code in (("screen", SCREEN_OK), ("window", WINDOW_OK), ("color", COLOR_OK), ("wallpaper", WALL_OK), ("cursor", CURSOR_OK)) if ready else ():
            r = G.gate(kind, code, "good", "good effect", 60, profile="rich")
            check("rich: good %s passes" % kind, r["ok"], " | ".join(r["problems"]))
        # builds with qsb but the old GLSL variant (what many GL ES drivers compile) has clamp() on integers: refused, with advice
        if ready and shutil.which("glslangValidator"):
            code = "vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) { int k = clamp(int(uv.x * 9.0), 0, 7); return base + vec3(float(k) * 0.02); }"
            r = G.gate("wallpaper", code, "intclamp", "int clamp", 60)
            check("integer clamp in a wallpaper shader is refused", not r["ok"] and "graphics driver would reject" in " ".join(r["problems"]), " | ".join(r["problems"]) or "PASS")
        # every Rich helper compiles in every kind that may call it
        call = {"hash2": "hash2(p).x", "gnoise": "gnoise(p)", "ridge": "ridge(p)", "warp": "warp(p, 1.0).x", "rot": "rot(p, 0.3).x",
                "disc": "disc(p, 0.3, 0.1)", "ring": "ring(p, 0.3, 0.05, 0.05)", "seg": "seg(p, vec2(0.0), vec2(1.0), 0.05, 0.05)",
                "rbox": "rbox(p, vec2(0.3), 0.05, 0.05)", "caustic": "caustic(p, time)", "rays": "rays(p, vec2(0.5), time)",
                "sparks": "sparks(p, time, 8.0, vec2(0.0, 1.0))", "streaks": "streaks(p, time, 20.0, 1.0)", "mist": "mist(p, time)",
                "vig": "vig(p, 0.3)", "ramp": "ramp(p.x, vec3(0.0), vec3(0.5), vec3(1.0)).x", "ptr": "ptr(p, p, 0.3)", "asp": "asp()"}
        tmpc = os.path.join(tmp, "helpers")
        os.makedirs(tmpc, exist_ok=True)
        for name, needs, src, kinds in G.RICH_HELPERS:
            for kind in kinds or ("screen", "wallpaper", "cursor"):
                use = call[name]
                if kind == "wallpaper":
                    code = "vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) { vec2 p = uv; return base + vec3(float(%s) * 0.05); }" % use
                elif kind == "cursor":
                    code = "vec4 cursorFx(vec2 q, vec2 m) { vec2 p = q * 0.01; return vec4(vec3(float(%s)), 0.2); }" % use
                else:
                    code = "void main() { vec2 p = v_texcoord; fragColor = vec4(texture(tex, p).rgb * (0.9 + 0.1 * float(%s)), 1.0); }" % use
                probs = G.compile_gate(kind, G.build(kind, code, "x", 60, "x", rich=True), tmpc)
                check("rich helper %s compiles in %s" % (name, kind), not probs, " | ".join(probs)[:300])
        # the shipped Rich examples pass the Rich gate
        edir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rich-examples")
        for fn in sorted(os.listdir(edir)) if ready and os.path.isdir(edir) else ():
            kind = fn.split("-")[0]
            if kind not in ("screen", "window", "color", "wallpaper", "cursor"):
                continue
            r = G.gate(kind, open(os.path.join(edir, fn)).read(), "example", "example", 80, profile="rich")
            check("rich example %s passes" % fn, r["ok"], " | ".join(r["problems"]))
        # 4) the time budget: a legal shader is refused when the budget is tiny
        if ready:
            old = G.RENDER_BUDGET_S
            G.RENDER_BUDGET_S = 0.001
            r = G.gate("screen", SCREEN_OK, "slow", "slow", 60)
            G.RENDER_BUDGET_S = old
            check("render budget", not r["ok"] and "took more than" in " ".join(r["problems"]), " | ".join(r["problems"]))
        # 5) colour shorthand: exactly six hex digits after C_, nothing else is rewritten
        built = G.build("screen", "void main() { fragColor = vec4(C_ff2030, 1.0); }")
        check("hex colour expanded", "C_ff2030" not in built["frag"] and "vec3(1.0000, 0.1255, 0.1882)" in built["frag"])
        r = G.gate("screen", "void main() { fragColor = vec4(C_ff20, 1.0); }", "x", "x", 60)
        check("short hex colour is just an unknown name", not r["ok"])
        # 6) frames: only known keys, clamped values
        try:
            G.frame_text({"rounding": 12, "border_colors": ["ff2030", "ffd000"], "shadow_range": 9999}, "ok")
            ok = True
        except G.GateFail:
            ok = False
        check("frame ok", ok)
        for bad in ({"exec": "rm -rf /"}, {"border_colors": ["zzzzzz"]}, {"rounding": "x"}, {}, "text"):
            try:
                G.frame_text(bad, "x")
                check("frame refused %r" % (bad,), False)
            except G.GateFail:
                check("frame refused %r" % (bad,), True)
        check("frame clamps", "shadow_range=100" in G.frame_text({"shadow_range": 9999}, "x"))
        # 7) the store: install, list, keep, delete (in a scratch state folder)
        G.GEN = os.path.join(tmp, "generated")
        built = G.build("screen", SCREEN_OK, "a test", 60)
        eid = G.install("screen", built, "Test red", "a test", "prompt")
        check("installed id", eid == "ai-test-red", eid)
        check("file in generated/screen", os.path.isfile(os.path.join(G.GEN, "screen", eid + ".frag")))
        eid2 = G.install("screen", built, "Test red", "again")
        check("second id differs", eid2 != eid, eid2)
        check("listed pending", [m["kept"] for m in G.listing() if m["id"] == eid] == [False])
        G.keep(eid)
        check("kept", [m["kept"] for m in G.listing() if m["id"] == eid] == [True])
        G.delete(eid)
        check("deleted", not G.files_of(eid) and eid not in [m["id"] for m in G.listing()])
        for bad in ("../x", "ai-../../x", "crt", "ai-"):
            try:
                G.delete(bad)
                check("delete refuses %s" % bad, False)
            except G.L.Bad:
                check("delete refuses %s" % bad, True)
        wb = G.build("wallpaper", WALL_OK, "w", 60, "Test wall")
        wid = G.install("wallpaper", wb, "Test wall", "w")
        check("wallpaper .qsb built", os.path.isfile(os.path.join(G.GEN, "wall", wid + ".frag.qsb")))
        import fxcheck
        check("wallpaper .qsb is a fragment shader the shell accepts", fxcheck.check(os.path.join(G.GEN, "wall", wid + ".frag.qsb")) == "", fxcheck.check(os.path.join(G.GEN, "wall", wid + ".frag.qsb")))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("aigen selftest: %d ok, %d failed" % (OK, FAIL))
    return 0 if FAIL == 0 else 1
