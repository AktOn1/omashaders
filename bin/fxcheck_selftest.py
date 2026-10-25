"""Self-test of bin/fxcheck.py: a good pack passes; missing, empty, cut-off, garbage and wrong-stage packs are refused;
repair rebuilds a wrong-stage pack from its source. Run: python3 bin/fxcheck.py selftest"""
import sys
sys.dont_write_bytecode = True
import os
import time
import shutil
import struct
import subprocess
import tempfile
import zlib

import fxcheck as F

OK = FAIL = 0
FRAG = """#version 440
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf { mat4 qt_Matrix; float qt_Opacity; float time; };
layout(binding = 1) uniform sampler2D src;
void main() { fragColor = texture(src, qt_TexCoord0) * (0.5 + 0.5 * sin(time)) * qt_Opacity; }
"""
# builds fine with qsb, but the GLSL ES 100 text has clamp() on integers, which the GL ES driver refuses on every frame
INT_CLAMP = FRAG.replace("void main() {", "float cell(int c) { int k = clamp(c, 0, 7); return float(k); }\nvoid main() { float z = cell(int(time)) * 0.0;").replace("qt_Opacity; }", "qt_Opacity + z; }")


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("FAIL %s %s" % (name, detail))


def run():
    tmp = tempfile.mkdtemp(prefix="fxcheck-test-")
    try:
        tool = shutil.which("qsb") or "/usr/lib/qt6/bin/qsb"
        have_qsb = os.access(tool, os.X_OK)
        good = os.path.join(tmp, "good.frag.qsb")
        if have_qsb:
            check("builds a pack", F.build_qsb(FRAG, good) == "")
            check("good pack passes", F.check(good) == "", F.check(good))
            # the wrong-stage pack that the old installer made: the compiler read the stage from a ".tmp" extension
            bad_src = os.path.join(tmp, "x.frag.tmp")
            open(bad_src, "w").write(FRAG)
            wrong = os.path.join(tmp, "wrong.frag.qsb")
            subprocess.run([tool, "--qt6", "-o", wrong, bad_src], capture_output=True)
            check("wrong-stage pack is refused", "wrong stage" in F.check(wrong), F.check(wrong))
            if shutil.which("glslangValidator"):
                badint = os.path.join(tmp, "ai-intclamp.frag.qsb")
                check("integer-clamp shader still builds", F.build_qsb(INT_CLAMP, badint) == "")
                check("integer-clamp shader is refused for the driver", "driver would reject" in F.check(badint, "", "", "ai-intclamp"), F.check(badint, "", "", "ai-intclamp"))
                check("the good pack passes the driver check", F.check(good, "", "", "ai-good") == "")
        else:
            print("fxcheck selftest: qsb not installed, skipping the build checks")
        check("missing file is refused", "missing" in F.check(os.path.join(tmp, "nope.qsb")))
        empty = os.path.join(tmp, "empty.qsb")
        open(empty, "w").close()
        check("empty file is refused", "empty" in F.check(empty))
        junk = os.path.join(tmp, "junk.qsb")
        open(junk, "wb").write(os.urandom(4000))
        check("random bytes are refused", F.check(junk) != "")
        data = struct.pack(">ii", 9, 4) + os.urandom(300)
        okpack = os.path.join(tmp, "synthetic.qsb")
        open(okpack, "wb").write(struct.pack(">I", len(data)) + zlib.compress(data))
        check("synthetic fragment header passes", F.check(okpack) == "", F.check(okpack))
        if have_qsb:
            raw = open(good, "rb").read()
            cut = os.path.join(tmp, "cut.qsb")
            open(cut, "wb").write(raw[:len(raw) // 2])
            check("cut-off pack is refused", F.check(cut) != "")
        text = os.path.join(tmp, "notpng.png")
        open(text, "w").write("hello")
        check("sprite picture that is not a PNG is refused", "PNG" in F.check(okpack, text))
        check("missing sprite picture is refused", "missing" in F.check(okpack, os.path.join(tmp, "none.png")))
        if have_qsb:
            gen = os.path.join(tmp, "generated")
            os.makedirs(os.path.join(gen, "wall"))
            shutil.copyfile(wrong, os.path.join(gen, "wall", "ai-broken.frag.qsb"))
            open(os.path.join(gen, "wall", "ai-broken.frag"), "w").write(FRAG)
            shutil.copyfile(good, os.path.join(gen, "wall", "ai-fine.frag.qsb"))
            open(os.path.join(gen, "wall", "ai-fine.frag"), "w").write(FRAG)
            open(os.path.join(gen, "wall", "ai-gone.frag"), "w").write(FRAG)
            res = dict(F.repair(gen))
            check("repair fixes the wrong-stage pack", res.get("ai-broken") == "fixed" and F.check(os.path.join(gen, "wall", "ai-broken.frag.qsb")) == "", str(res))
            check("repair builds a missing pack", res.get("ai-gone") == "fixed", str(res))
            check("repair leaves a good pack alone", "ai-fine" not in res, str(res))
        st = os.path.join(tmp, "state")
        check("an unblocked effect passes with a name", F.check(okpack, "", st, "fx1") == "")
        F.block(st, "fx1", okpack, "driver said no")
        check("a blocked build is refused", "failed to draw" in F.check(okpack, "", st, "fx1"), F.check(okpack, "", st, "fx1"))
        check("a block is per effect", F.check(okpack, "", st, "fx2") == "")
        time.sleep(0.01)
        os.utime(okpack, None)
        check("a rebuilt pack is unblocked", F.check(okpack, "", st, "fx1") == "")
        gdir = os.path.join(tmp, "g2")
        os.makedirs(os.path.join(gdir, "mouse"))
        open(os.path.join(gdir, "mouse", "ai-nopack.frag"), "w").write("x")
        shutil.copyfile(okpack, os.path.join(gdir, "mouse", "ai-fine.frag.qsb"))
        open(os.path.join(gdir, "mouse", "ai-fine.frag"), "w").write("x")
        check("bad_ids lists the effect without a pack only", F.bad_ids(gdir) == ["ai-nopack"], str(F.bad_ids(gdir)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("fxcheck selftest: %d ok, %d failed" % (OK, FAIL))
    return 0 if FAIL == 0 else 1
