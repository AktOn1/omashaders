#!/usr/bin/env python3
"""fxcheck: is a compiled Qt shader (.frag.qsb) safe to hand to the shell? Standard library only.

  fxcheck.py check FILE.frag.qsb [--png FILE.png] [--name ID --state DIR]   prints "ok" or "bad: REASON" (exit 0 / 1)
  fxcheck.py block STATE_DIR ID FILE.frag.qsb WHY   remember that the GPU driver rejected this build of an effect
  fxcheck.py bad GENERATED_DIR                      prints the ids of generated effects that cannot be used
  fxcheck.py repair GENERATED_DIR                   rebuilds generated .qsb files that are bad (needs qsb from qt6-shadertools)
  fxcheck.py selftest

A .qsb that is missing, cut off, not a Qt shader pack or built for the wrong stage makes the GPU driver reject it on
every frame; that floods the shell log and memory. The shell asks this tool before it draws an effect."""
import sys
sys.dont_write_bytecode = True  # a __pycache__ in the plugin folder would make the shell reload the plugin
import os
import json
import shutil
import struct
import subprocess
import tempfile
import zlib

FRAGMENT, VERTEX = 4, 0       # QShader::Stage as stored in the pack
MAX_BYTES = 4 * 1024 * 1024
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def qsb_problem(path, stage=FRAGMENT):
    """'' when the pack looks usable, else one short sentence saying why not"""
    try:
        if not os.path.isfile(path):
            return "the compiled shader file is missing"
        size = os.path.getsize(path)
        if size < 64:
            return "the compiled shader file is empty"
        if size > MAX_BYTES:
            return "the compiled shader file is far too large"
        with open(path, "rb") as f:
            raw = f.read()
    except OSError as e:
        return "the compiled shader file cannot be read (%s)" % e.strerror
    try:
        want = struct.unpack(">I", raw[:4])[0]
        data = zlib.decompress(raw[4:])
    except (struct.error, zlib.error):
        return "the compiled shader file is damaged"
    if want != len(data) or len(data) < 16:
        return "the compiled shader file is cut off"
    version, got = struct.unpack(">ii", data[:8])
    if version < 6 or version > 64:
        return "the compiled shader file is not a Qt shader pack"
    if got != stage:
        return "the compiled shader was built for the wrong stage (%s instead of %s)" % (
            {FRAGMENT: "fragment", VERTEX: "vertex"}.get(got, str(got)), {FRAGMENT: "fragment", VERTEX: "vertex"}[stage])
    return ""


def driver_problem(qsb):
    """'' when the GLSL ES 100 text inside the pack passes glslangValidator (or the tools are missing), else one sentence.
    The GL ES driver compiles that variant on many machines and is stricter than the tool that built the pack
    (for example clamp() on integers builds fine and is then refused on every frame)."""
    tool = shutil.which("qsb") or "/usr/lib/qt6/bin/qsb"
    glslang = shutil.which("glslangValidator")
    if not (os.access(tool, os.X_OK) and glslang):
        return ""
    d = tempfile.mkdtemp(prefix="fxdrv-")
    try:
        src = os.path.join(d, "es100.frag")
        r = subprocess.run([tool, "-x", "glsl,100es", "-o", src, qsb], capture_output=True, timeout=30)
        if r.returncode != 0 or not os.path.isfile(src):
            return ""
        g = subprocess.run([glslang, "-S", "frag", src], capture_output=True, text=True, timeout=30)
        if g.returncode == 0:
            return ""
        first = next((ln for ln in g.stdout.splitlines() if ln.startswith("ERROR")), "")
        return "the graphics driver would reject its shader (%s)" % first.replace("ERROR: ", "")[:110]
    except (OSError, subprocess.SubprocessError):
        return ""
    finally:
        shutil.rmtree(d, ignore_errors=True)


def png_problem(path):
    try:
        with open(path, "rb") as f:
            head = f.read(8)
    except OSError:
        return "its picture file is missing"
    return "" if head == PNG_MAGIC else "its picture file is not a PNG"


def _blockfile(state_dir):
    return os.path.join(state_dir, "fx-blocked.json")


def _stamp(qsb):
    try:
        return int(os.stat(qsb).st_mtime_ns)
    except OSError:
        return 0


def blocked(state_dir, name, qsb):
    """the reason this exact build of the effect failed to draw before, else ''"""
    try:
        with open(_blockfile(state_dir)) as f:
            e = json.load(f).get(name)
    except (OSError, ValueError, AttributeError):
        return ""
    if isinstance(e, dict) and e.get("stamp") == _stamp(qsb):
        return "it failed to draw on this computer before (%s)" % e.get("why", "driver error")
    return ""


def block(state_dir, name, qsb, why):
    try:
        os.makedirs(state_dir, exist_ok=True)
        try:
            with open(_blockfile(state_dir)) as f:
                m = json.load(f)
            if not isinstance(m, dict):
                m = {}
        except (OSError, ValueError):
            m = {}
        m[name] = {"stamp": _stamp(qsb), "why": str(why)[:120]}
        if len(m) > 200:
            m = dict(list(m.items())[-200:])
        tmp = _blockfile(state_dir) + ".new"
        with open(tmp, "w") as f:
            json.dump(m, f)
        os.replace(tmp, _blockfile(state_dir))
    except OSError:
        pass


def check(qsb, png="", state_dir="", name=""):
    if state_dir and os.path.exists(os.path.join(state_dir, "fx-check-off")):
        return ""  # test hook: lets the VM test hand a bad pack to the renderer to prove the later safety nets
    why = qsb_problem(qsb) or (png_problem(png) if png else "")
    if not why and name.startswith("ai-"):
        why = driver_problem(qsb)
    if not why and state_dir and name:
        why = blocked(state_dir, name, qsb)
    return why


def bad_ids(gen_dir, state_dir=""):
    """ids of generated wallpaper/cursor effects whose compiled file cannot be used"""
    out = []
    for sub in ("wall", "mouse"):
        d = os.path.join(gen_dir, sub)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if fn.endswith(".frag") and check(os.path.join(d, fn + ".qsb"), "", state_dir, fn[:-5]):
                out.append(fn[:-5])
    return out


def build_qsb(frag_text, out, qsb_tool=None):
    """compile GLSL text to a pack at `out`; '' on success else the tool's message. The temp file keeps the .frag
    extension on purpose: qsb takes the shader stage from it (a .tmp name silently gives a vertex shader)."""
    tool = qsb_tool or shutil.which("qsb") or "/usr/lib/qt6/bin/qsb"
    if not os.access(tool, os.X_OK):
        return "qsb (qt6-shadertools) is not installed"
    d = tempfile.mkdtemp(prefix="fxbuild-")
    try:
        src = os.path.join(d, "effect.frag")
        with open(src, "w") as f:
            f.write(frag_text)
        r = subprocess.run([tool, "--qt6", "-o", os.path.join(d, "effect.frag.qsb"), src], capture_output=True, text=True)
        if r.returncode != 0:
            return (r.stderr or r.stdout or "qsb failed").strip()[:300]
        tmp = out + ".new"
        shutil.copyfile(os.path.join(d, "effect.frag.qsb"), tmp)
        os.replace(tmp, out)
        return ""
    finally:
        shutil.rmtree(d, ignore_errors=True)


def repair(gen_dir):
    """rebuild every generated wallpaper/cursor .qsb that is bad from its .frag; returns [(id, "fixed"|reason)]"""
    out = []
    for sub in ("wall", "mouse"):
        d = os.path.join(gen_dir, sub)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not (fn.startswith("ai-") and fn.endswith(".frag")):
                continue
            qsb = os.path.join(d, fn + ".qsb")
            if qsb_problem(qsb):
                try:
                    with open(os.path.join(d, fn)) as f:
                        text = f.read()
                except OSError:
                    continue
                why = build_qsb(text, qsb)
                out.append((fn[:-5], "fixed" if not why and not qsb_problem(qsb) else (why or qsb_problem(qsb))))
    return out


def main(argv):
    if len(argv) >= 3 and argv[1] == "check":
        def opt(k):
            return argv[argv.index(k) + 1] if k in argv and argv.index(k) + 1 < len(argv) else ""
        why = check(argv[2], opt("--png"), opt("--state"), opt("--name"))
        print("bad: " + why if why else "ok")
        return 1 if why else 0
    if len(argv) == 3 and argv[1] == "repair":
        for eid, res in repair(argv[2]):
            print("%s: %s" % (eid, res))
        return 0
    if len(argv) >= 6 and argv[1] == "block":
        block(argv[2], argv[3], argv[4], " ".join(argv[5:]))
        return 0
    if len(argv) >= 3 and argv[1] == "bad":
        for eid in bad_ids(argv[2], argv[3] if len(argv) > 3 else ""):
            print(eid)
        return 0
    if len(argv) == 2 and argv[1] == "selftest":
        import fxcheck_selftest
        return fxcheck_selftest.run()
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
