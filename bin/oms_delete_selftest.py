#!/usr/bin/env python3
"""Self-test for bin/oms-delete and the share-code rules around built-in themes. Works on a scratch copy of the plugin and a
scratch state folder, never on the real ones:  python3 bin/oms_delete_selftest.py"""
import sys
sys.dont_write_bytecode = True
import base64
import json
import os
import shutil
import subprocess
import tempfile
import zlib

HERE = os.path.dirname(os.path.realpath(__file__))
SRC = os.path.dirname(HERE)
fails = []


def check(cond, what):
    print(("ok: " if cond else "FAIL: ") + what)
    if not cond:
        fails.append(what)


def run(cmd, env, inp=None):
    r = subprocess.run(cmd, capture_output=True, text=True, env=env, input=inp)
    return r.returncode, (r.stdout + r.stderr).strip()


def main():
    tmp = tempfile.mkdtemp(prefix="oms-delete-test-")
    plug, state = os.path.join(tmp, "plugin"), os.path.join(tmp, "state")
    shutil.copytree(SRC, plug, ignore=shutil.ignore_patterns(".git", "__pycache__", "*.bak*"))
    os.makedirs(state)
    env = dict(os.environ, OMASHADERS_STATE_DIR=state, HOME=tmp)
    om = os.path.join(plug, "bin", "omashaders")
    themes = os.path.join(state, "themes")
    starter = os.path.join(plug, "starter-themes")
    lines = [l for l in open(starter).read().split("\n") if l.strip()]
    abyss = next(l for l in lines if "|Abyss" in l)
    own = "vignette||||My look"
    open(themes, "w").write("\n".join(lines + [own]) + "\n")
    n_own = len(lines) + 1
    n_abyss = lines.index(abyss) + 1
    before = open(themes).read()

    # themes: built in
    rc, t = run([om, "theme", "list"], env)
    check(rc == 0 and "Abyss" in t and "[built-in]" in t and "My look" in t and t.count("[built-in]") == len(lines), "theme list marks the shipped themes and not mine")
    for extra in ([], ["--yes"]):
        rc, t = run([om, "theme", "rm", str(n_abyss)] + extra, env)
        check(rc == 1 and t == "Built-in theme, cannot be deleted" and open(themes).read() == before, "built-in theme refused %s" % " ".join(extra))
    rc, t = run([sys.executable, os.path.join(plug, "bin", "oms-delete"), "rm", "theme", "--line", abyss, "--yes", "--json"], env)
    check(rc == 1 and json.loads(t)["refused"] and open(themes).read() == before, "built-in theme refused by line (the menu's call)")

    # themes: my own
    rc, t = run([om, "theme", "rm", str(n_own)], env)
    check(rc == 2 and "Delete theme My look?" in t and "--yes" in t and open(themes).read() == before, "own theme without --yes only prompts")
    rc, t = run([om, "theme", "rm", str(n_own), "--yes"], env)
    check(rc == 0 and own not in open(themes).read() and abyss in open(themes).read(), "own theme deleted with --yes, the others stay")

    # a renamed built-in is my own copy; the original stays
    renamed = abyss.replace("|Abyss", "|My Abyss", 1)
    open(themes, "a").write(renamed + "\n")
    rc, t = run([sys.executable, os.path.join(plug, "bin", "oms-delete"), "check", "theme", "--line", renamed, "--json"], env)
    d = json.loads(t)
    check(d["can_delete"] and not d["builtin"], "a renamed built-in theme is the user's own copy")
    rc, t = run([sys.executable, os.path.join(plug, "bin", "oms-delete"), "check", "theme", "--line", abyss, "--json"], env)
    check(not json.loads(t)["can_delete"], "the built-in original is still protected")
    open(themes, "w").write("\n".join(lines) + "\n")

    # elements: built in
    rc, t = run([om, "element", "rm", "screen", "vignette", "--yes"], env)
    check(rc == 1 and t == "Built-in effect, cannot be deleted" and os.path.exists(os.path.join(plug, "shaders", "vignette.frag")), "built-in effect refused, file kept")
    rc, t = run([om, "element", "rm", "wallpaper", "aurora", "--yes"], env)
    check(rc == 1 and os.path.exists(os.path.join(plug, "wallpaper-effects", "aurora.frag")), "built-in wallpaper effect refused")
    rc, t = run([om, "element", "rm", "frame", "no-such-frame", "--yes"], env)
    check(rc == 1 and "No frame named" in t, "unknown element is an error")

    # elements: my own (AI-made), used by two themes
    gen = os.path.join(state, "generated")
    for sub, fn in (("screen", "ai-test-glow.frag"), ("wall", "ai-test-glow.frag"), ("wall", "ai-test-glow.frag.qsb"), ("meta", "ai-test-glow.json")):
        os.makedirs(os.path.join(gen, sub), exist_ok=True)
        open(os.path.join(gen, sub, fn), "w").write("x")
    open(themes, "w").write("\n".join(lines + ["ai-test-glow|||blue|Moon Lake", "ai-test-glow||vignette||"]) + "\n")
    rc, t = run([om, "element", "rm", "screen", "ai-test-glow"], env)
    check(rc == 2 and t.startswith("Used by theme: Moon Lake, ai-test-glow + vignette. Delete anyway?") and "--yes" in t, "prompt names the themes: %r" % t.split("\n")[0])
    check(os.path.exists(os.path.join(gen, "screen", "ai-test-glow.frag")), "nothing deleted without --yes")
    mine = open(themes).read()
    rc, t = run([om, "element", "rm", "screen", "ai-test-glow", "--yes"], env)
    check(rc == 0 and not os.path.exists(os.path.join(gen, "screen", "ai-test-glow.frag")) and not os.path.exists(os.path.join(gen, "meta", "ai-test-glow.json")), "own effect deleted with its record")
    check(os.path.exists(os.path.join(gen, "wall", "ai-test-glow.frag")), "the wallpaper effect of the same name is a different element and stays")
    check(open(themes).read() == mine, "themes that used it are untouched (that part is just empty)")
    rc, t = run([om, "element", "rm", "wallpaper", "ai-test-glow"], env)
    check(rc == 2 and t.startswith("Delete ai-test-glow?"), "plain confirm when no theme uses it: %r" % t.split("\n")[0])
    open(os.path.join(state, "wp-effect"), "w").write("ai-test-glow")
    rc, t = run([om, "element", "rm", "wallpaper", "ai-test-glow", "--yes"], env)
    check(rc == 0 and not os.path.exists(os.path.join(gen, "wall", "ai-test-glow.frag.qsb")) and open(os.path.join(state, "wp-effect")).read() == "", "running wallpaper effect is switched off, both files gone")

    # developer switch: built-ins can go and starter-themes follows
    open(os.path.join(state, "dev-export"), "w").close()
    open(themes, "w").write("\n".join(lines) + "\n")
    rc, t = run([om, "element", "rm", "color", "abyss"], env)
    check(rc == 2 and t.startswith("Used by theme: Abyss, ") and "built in" in t, "dev switch: built-in element asks first, names the theme: %r" % t.split("\n")[0])
    rc, t = run([om, "element", "rm", "color", "abyss", "--yes"], env)
    check(rc == 0 and not os.path.exists(os.path.join(plug, "colors", "abyss.frag")), "dev switch: built-in element deleted")
    rc, t = run([om, "theme", "rm", str(n_abyss), "--yes"], env)
    check(rc == 0 and abyss not in open(themes).read() and abyss not in open(starter).read().split("\n"), "dev switch: built-in theme deleted and the shipped list follows")
    check(len(open(starter).read().split("\n")) == len(lines) - 1, "starter-themes lost exactly that line")
    os.remove(os.path.join(state, "dev-export"))

    # share codes carry nothing but the theme
    shared = lines[0]
    open(themes, "w").write(shared + "\n")
    rc, code = run([om, "theme", "share", "1"], env)
    raw = json.loads(zlib.decompress(base64.urlsafe_b64decode(code[5:] + "=" * (-len(code[5:]) % 4))))
    check(rc == 0 and set(raw) <= {"v", "n", "s", "w", "m", "c", "wf", "wc", "wr", "o"} and not any(k in raw for k in ("b", "id", "builtin", "author", "user", "uid", "owner")),
          "share code of a built-in theme has no extra fields: %s" % sorted(raw))
    for bad in ({"builtin": True}, {"b": 1}, {"id": "99c50373"}, {"author": "x"}, {"uid": "1000"}):
        forged = dict(raw, **bad)
        c = "OMS1:" + base64.urlsafe_b64encode(zlib.compress(json.dumps(forged).encode())).decode().rstrip("=")
        rc, t = run([om, "theme", "check", c], env)
        check(rc == 1 and "unknown fields" in t, "import refuses a code with the field %s" % list(bad))

    # an imported theme is the importer's own, even when its line equals a shipped one
    open(themes, "w").write("")
    rc, t = run([om, "theme", "import", code], env)
    check(rc == 0 and shared in open(themes).read().split("\n"), "import saved the theme (same line as the shipped one)")
    rc, t = run([om, "theme", "list"], env)
    check("whiteout" in t and "[built-in]" not in t, "the imported theme is not built in")
    rc, t = run([om, "theme", "rm", "1", "--yes"], env)
    check(rc == 0 and open(themes).read().strip() == "", "the imported theme can be deleted")

    shutil.rmtree(tmp, ignore_errors=True)
    print("\n%s" % ("ALL PASSED" if not fails else "%d FAILED" % len(fails)))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
