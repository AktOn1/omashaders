"""Offline self-test of the AI provider picker and the Invent flow (bin/aiprov.py, bin/aiinvent.py, bin/ai-theme).
No real AI is called: stub programs stand in for every provider. Everything runs in a scratch state folder with a scratch HOME.
Run: python3 bin/ai-theme selftest   (the Invent part takes about a minute: the gate renders every new effect on the CPU)"""
import sys
sys.dont_write_bytecode = True  # a __pycache__ in the plugin folder would make the shell reload the plugin (and close the open dialog)
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.realpath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
OK = FAIL = 0


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("FAIL %s %s" % (name, detail))


STUB = '''#!/usr/bin/env python3
import json, os, sys
name = os.path.basename(sys.argv[0])
log = os.environ["STUB_LOG"]
args = sys.argv[1:]
files = {}
for i, a in enumerate(args):
    if a == "-f" and i + 1 < len(args) and os.path.isfile(args[i + 1]) and not args[i + 1].endswith(".jpg"):
        files[args[i + 1]] = open(args[i + 1]).read()
data = sys.stdin.read()
with open(os.path.join(log, name + ".calls"), "a") as f:
    f.write(json.dumps({"argv": args, "stdin": data[:200000], "files": files, "cwd": os.getcwd()}) + "\\n")
if name == "ollama" and args[:1] == ["list"]:
    print("NAME ID SIZE MODIFIED")
    print("qwen2.5-coder:7b abc 4GB now")
    sys.exit(0)
if name == "claude":
    print(json.dumps({"type": "result", "is_error": False, "result": '{"ok": true}', "usage": {"input_tokens": 10, "output_tokens": 5}, "total_cost_usd": 0.0001}))
else:
    print('{"ok": true}')
'''

# the custom "AI" of the Invent run: call N prints answers/N.json and keeps what it was asked
FAKE = '''#!/usr/bin/env python3
import os, sys
log = os.environ["STUB_LOG"]
n = len([x for x in os.listdir(log) if x.startswith("prompt-")]) + 1
open(os.path.join(log, "prompt-%d.txt" % n), "w").write(sys.stdin.read())
print(open(os.path.join(log, "answer-%d.json" % n)).read())
'''


def new_screen(c="ff2030"):
    return "void main() {\n  vec3 c = texture(tex, v_texcoord).rgb;\n  vec3 warm = mix(c, c * C_%s * 1.6, 0.35);\n  float v = smoothstep(1.0, 0.3, length(v_texcoord - 0.5));\n  float g = smoothstep(0.6, 0.9, noise(v_texcoord * vec2(14.0, 8.0) + vec2(time * 0.25, -time * 0.15)));\n  fragColor = vec4(mix(c, warm, 0.6) * (0.8 + 0.2 * v) + C_ffd0a0 * g * 0.2, 1.0);\n}\n" % c


WALL = "vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {\n  float streak = noise(vec2(uv.x * 4.0 - time * 1.5, uv.y * 80.0));\n  float band = smoothstep(0.6, 1.0, streak) * smoothstep(0.0, 0.5, uv.y) * 0.25;\n  return base + C_ffd2a0 * band;\n}\n"
CURSOR = "vec4 cursorFx(vec2 p, vec2 m) {\n  float d = length(p - m);\n  float ring = smoothstep(6.0, 0.0, abs(d - 40.0 - 6.0 * sin(time * 4.0)));\n  return vec4(C_ff2030 * ring, ring);\n}\n"
COLOR = "void main() {\n  vec3 c = texture(tex, v_texcoord).rgb;\n  float l = luma(c);\n  fragColor = vec4(mix(c, vec3(l) * C_ffb070 * 1.5, 0.5), 1.0);\n}\n"


def part(name, code, fb, start=75, **kw):
    d = {"name": name, "desc": name + " test effect.", "start": start, "fallback": fb, "code": code}
    d.update(kw)
    return {"new": d}


class SkipInvent(Exception):
    pass


def run():
    tmp = tempfile.mkdtemp(prefix="aiinvent-selftest-")
    try:
        stubs = os.path.join(tmp, "stubs")
        log = os.path.join(tmp, "log")
        home = os.path.join(tmp, "home")
        state = os.path.join(tmp, "state")
        for d in (stubs, log, home, state):
            os.makedirs(d)
        stub = os.path.join(stubs, "stub-ai")
        open(stub, "w").write(STUB)
        os.chmod(stub, 0o755)

        def env(extra=None, path_names=()):
            bin_ = os.path.join(tmp, "bin-" + "-".join(sorted(path_names)) if path_names else "bin-none")
            os.makedirs(bin_, exist_ok=True)
            for n in path_names:
                link = os.path.join(bin_, n)
                if not os.path.lexists(link):
                    os.symlink(stub, link)
            e = {"HOME": home, "PATH": bin_ + ":/usr/bin:/bin", "OMASHADERS_STATE_DIR": state, "STUB_LOG": log, "XDG_STATE_HOME": os.path.join(tmp, "xdg"),
                 "OMARCHY_PATH": os.environ.get("OMARCHY_PATH", "/usr/share/omarchy"), "LANG": "C.UTF-8"}
            e.update(extra or {})
            return e

        def cli(args, e, timeout=600):
            r = subprocess.run([sys.executable, os.path.join(HERE, "ai-theme")] + args, capture_output=True, text=True, env=e, timeout=timeout)
            return r

        def calls(name):
            p = os.path.join(log, name + ".calls")
            return [json.loads(l) for l in open(p).read().splitlines()] if os.path.exists(p) else []

        # ---------------------------------------------------------- 1) the provider dropdown lists only what is installed
        e = env(path_names=("claude", "codex"))
        r = cli(["providers", "--json"], e)
        d = json.loads(r.stdout)
        ids = [p["id"] for p in d["providers"]]
        check("providers: only installed ones + custom", ids == ["claude", "codex", "endpoint", "custom"], str(ids))
        check("providers: Claude is the default choice and uses its own default model", d["choice"]["provider"] == "claude" and d["choice"]["model"] == "", str(d["choice"]))
        check("providers: Claude offers sonnet and opus", [m["id"] for m in d["providers"][0]["models"]] == ["", "sonnet", "opus"])
        e_all = env(path_names=("claude", "codex", "gemini", "opencode", "ollama"))
        ids = [p["id"] for p in json.loads(cli(["providers", "--json"], e_all).stdout)["providers"]]
        check("providers: all five + custom when all are installed", ids == ["claude", "codex", "gemini", "opencode", "ollama", "endpoint", "custom"], str(ids))
        ol = [p for p in json.loads(cli(["providers", "--json"], e_all).stdout)["providers"] if p["id"] == "ollama"][0]
        check("providers: ollama models come from `ollama list`", [m["id"] for m in ol["models"]] == ["qwen2.5-coder:7b"], str(ol["models"]))
        r = cli(["check", "--json"], env(path_names=()))
        check("check: no claude installed -> not available with a hint", json.loads(r.stdout)["available"] is False and "not installed" in json.loads(r.stdout)["hint"])

        # ---------------------------------------------------------- 2) choosing a provider changes the command (stub proof)
        want = {
            "claude": lambda c: c["argv"][:1] == ["-p"] and "--model" in c["argv"] and c["argv"][c["argv"].index("--model") + 1] == "opus" and "--tools" in c["argv"],
            "codex": lambda c: c["argv"][:1] == ["exec"] and "read-only" in c["argv"] and c["argv"][-1] == "-" and "Answer with exactly this JSON" in c["stdin"],
            "gemini": lambda c: "-p" in c["argv"] and "--approval-mode" in c["argv"] and "plan" in c["argv"] and "Answer with exactly this JSON" in c["stdin"],
            "opencode": lambda c: c["argv"][:1] == ["run"] and "-f" in c["argv"] and any("Answer with exactly this JSON" in v for v in c["files"].values()),
            "ollama": lambda c: c["argv"][:2] == ["run", "qwen2.5-coder:7b"] and "Answer with exactly this JSON" in c["stdin"],
        }
        for prov in ("claude", "codex", "gemini", "opencode", "ollama"):
            args = ["use", prov] + (["--model", "opus"] if prov == "claude" else (["--model", "qwen2.5-coder:7b"] if prov == "ollama" else []))
            u = cli(args + ["--json"], e_all)
            check("use %s remembered" % prov, u.returncode == 0 and json.loads(u.stdout)["choice"]["provider"] == prov, u.stdout + u.stderr)
            if os.path.exists(os.path.join(log, prov + ".calls")):
                os.remove(os.path.join(log, prov + ".calls"))
            t = cli(["test", "--json"], e_all)
            res = json.loads(t.stdout) if t.stdout.strip() else {}
            cs = calls(prov)
            check("test connection through %s works" % prov, t.returncode == 0 and res.get("ok") is True, t.stdout + t.stderr)
            check("%s was called with its own tested command line" % prov, len(cs) == 1 and want[prov](cs[0]), json.dumps(cs)[:300])
        r = cli(["use", "custom", "--custom", os.path.join(stubs, "stub-ai") + " --flag", "--json"], e_all)
        os.path.exists(os.path.join(log, "stub-ai.calls")) and os.remove(os.path.join(log, "stub-ai.calls"))
        t = cli(["test", "--json"], e_all)
        cs = calls("stub-ai")
        check("custom command: prompt on stdin, own flag passed", t.returncode == 0 and cs and cs[0]["argv"] == ["--flag"], t.stdout + t.stderr)
        r = cli(["use", "custom", "--custom", "no-such-command-zzz", "--json"], e_all)
        t = cli(["test", "--json"], e_all)
        check("custom command that does not exist -> plain error, no crash", t.returncode == 1 and "not found" in json.loads(t.stdout)["error"], t.stdout + t.stderr)
        r = cli(["use", "nonsense"], e_all)
        check("unknown provider refused", r.returncode == 1)
        check("the choice is remembered in ai.json", json.load(open(os.path.join(state, "ai.json")))["provider"] == "custom")
        # the plugin setting is the start value until a choice is remembered; the old free-text command still works as Custom
        os.remove(os.path.join(state, "ai.json"))
        r = cli(["providers", "--json"], dict(e_all, OMASHADERS_AI_PROVIDER="codex"))
        check("plugin setting picks the provider before anything is remembered", json.loads(r.stdout)["choice"]["provider"] == "codex")
        r = cli(["providers", "--json"], dict(e_all, OMASHADERS_AI_CMD="my-ai --x"))
        check("old aiCommand becomes the Custom command", json.loads(r.stdout)["choice"]["provider"] == "custom" and json.loads(r.stdout)["choice"]["custom"] == "my-ai --x")

        # running the scripts must not write a __pycache__ into the plugin folder (the shell would reload the plugin and close the open dialog)
        cp = os.path.join(tmp, "bincopy")
        shutil.copytree(HERE, cp, ignore=shutil.ignore_patterns("__pycache__"))
        for args in (["ai-theme", "providers", "--json"], ["ai-theme", "estimate", "a test", "--invent", "--json"], ["aigen.py", "list"]):
            subprocess.run([sys.executable, os.path.join(cp, args[0])] + args[1:], capture_output=True, text=True, env=e_all)
        check("running the scripts leaves no __pycache__ behind", not os.path.exists(os.path.join(cp, "__pycache__")), str(os.listdir(cp)))
        # without python-pillow the safety check cannot run: Invent is refused before the AI is called (nothing is spent)
        nopil = os.path.join(tmp, "nopil")
        os.makedirs(os.path.join(nopil, "PIL"))
        open(os.path.join(nopil, "PIL", "__init__.py"), "w").write("raise ImportError('No module named PIL')\n")
        e_nopil = dict(e_all, PYTHONPATH=nopil)
        for f in os.listdir(log):
            os.remove(os.path.join(log, f))
        r = cli(["use", "custom", "--custom", os.path.join(stubs, "stub-ai"), "--json"], e_nopil)
        r = cli(["providers", "--json"], e_nopil)
        d = json.loads(r.stdout)
        check("without python-pillow the providers list says Invent is not ready, with an install hint", d["invent_ready"] is False and "python-pillow" in d["invent_hint"] and "Pick existing" in d["invent_hint"], r.stdout[-300:])
        r = cli(["make", "a test", "--invent", "--json"], e_nopil)
        check("Invent without the safety check is refused before any AI call", r.returncode == 1 and "python-pillow" in r.stdout and not calls("stub-ai"), r.stdout + r.stderr)
        os.remove(os.path.join(state, "ai.json"))

        # ---------------------------------------------------------- 2b) the theme chat in Pick mode (fake AI, scratch state)
        import omslib as OL
        ocat = OL.catalog()
        ids = {k: sorted(i for i in ocat[k] if not i.startswith("ai-"))[0] for k in ("screen", "color", "mouse")}
        light0 = sorted(OL.overlay_ids() & set(ocat["wall"]))[0]
        chatfake = os.path.join(stubs, "chat-fake")
        open(chatfake, "w").write(FAKE)
        os.chmod(chatfake, 0o755)
        e_chat = env(extra={"OMASHADERS_AI_CMD": chatfake})
        for f in os.listdir(log):
            os.remove(os.path.join(log, f))
        t1 = {"name": "Chat Night", "screen": ids["screen"], "color": ids["color"], "wallpaper": light0, "cursor": ids["mouse"], "strength": {"screen": 80, "wallpaper": 80}, "idea": "A first idea."}
        t2 = {"cursor": "", "strength": {"screen": 30}, "idea": "Less of the screen effect, no cursor effect."}
        for i, a in enumerate((t1, t2), 1):
            open(os.path.join(log, "answer-%d.json" % i), "w").write(json.dumps(a))
        themes_file = os.path.join(state, "themes")
        before = open(themes_file).read() if os.path.exists(themes_file) else ""
        r = cli(["chat", "turn", "a night drive", "--new", "--json"], e_chat)
        c1 = json.loads(r.stdout) if r.stdout.strip().startswith("{") else {}
        check("chat turn 1 builds the theme and returns its line", r.returncode == 0 and c1.get("ok") and ids["screen"] in c1.get("line", "") and c1.get("turn") == 1, r.stdout[-300:] + r.stderr[-300:])
        check("chat turn 1 does not touch the themes list", (open(themes_file).read() if os.path.exists(themes_file) else "") == before)
        r = cli(["chat", "turn", "less screen effect and no cursor", "--json"], e_chat)
        c2 = json.loads(r.stdout) if r.stdout.strip().startswith("{") else {}
        p2c = open(os.path.join(log, "prompt-2.txt")).read() if os.path.exists(os.path.join(log, "prompt-2.txt")) else ""
        check("chat follow-up prompt has the current theme, the history and the new words", "# CURRENT THEME" in p2c and "# CHAT SO FAR" in p2c and "a night drive" in p2c and "less screen effect" in p2c)
        l2 = OL.parse_line(c2.get("line", "||||")) if c2.get("line") else {}
        check("follow-up changes only what was asked (cursor gone, screen strength 30 not raised, rest kept)",
              l2.get("m") == "" and l2.get("o", {}).get("fx") == 30 and l2.get("s") == ids["screen"] and l2.get("w") == light0 and l2.get("c") == ids["color"] and l2.get("o", {}).get("wall") == 80, c2.get("line", r.stderr[-300:]))
        check("follow-up lists what changed", any("Cursor removed" in x for x in c2.get("changes", [])) and any("Screen strength: 80% -> 30%" in x for x in c2.get("changes", [])), str(c2.get("changes")))
        r = cli(["chat", "status"], e_chat)
        check("chat status holds both turns", len(json.loads(r.stdout)["history"]) == 4, r.stdout[-200:])
        r = cli(["chat", "keep", "--name", "Night Drive", "--json"], e_chat)
        k = json.loads(r.stdout) if r.stdout.strip().startswith("{") else {}
        saved = open(themes_file).read()
        check("chat keep saves the theme once, under the new name, and ends the chat", k.get("ok") and saved.count("Night Drive") == 1 and "fx=30" in saved and not os.path.exists(os.path.join(state, "chat.json")), r.stdout[-300:] + saved[-300:])
        for f in os.listdir(log):
            os.remove(os.path.join(log, f))
        open(os.path.join(log, "answer-1.json"), "w").write(json.dumps(t1))
        cli(["chat", "turn", "again", "--new", "--json"], e_chat)
        r = cli(["chat", "discard", "--json"], e_chat)
        check("chat discard leaves the themes list as it was", json.loads(r.stdout)["ok"] and open(themes_file).read() == saved and not os.path.exists(os.path.join(state, "chat.json")))
        r = cli(["chat", "turn", "x", "--json"], dict(e_chat, OMASHADERS_AI_CMD=os.path.join(tmp, "missing-cmd")))
        check("chat without an AI gives the 'AI needed' message", r.returncode == 1 and "AI needed" in r.stdout, r.stdout)

        # ---------------------------------------------------------- 3) Invent end to end: repair, fallback, pending store
        import aigen
        if aigen.render_ready():
            print("skipped: the Invent flow and the guide examples need the render check (%s)" % aigen.render_ready())
            raise SkipInvent()
        from PIL import Image, ImageDraw
        pic = os.path.join(tmp, "car.png")
        im = Image.new("RGB", (640, 360), (70, 110, 170))
        dr = ImageDraw.Draw(im)
        dr.rectangle((0, 250, 640, 360), fill=(50, 50, 55))
        dr.rectangle((200, 200, 440, 270), fill=(200, 30, 40))
        im.save(pic)
        os.makedirs(os.path.join(tmp, "xdg", "omarchy", "current"), exist_ok=True)
        os.symlink(pic, os.path.join(tmp, "xdg", "omarchy", "current", "background"))
        fake = os.path.join(stubs, "fake-ai")
        open(fake, "w").write(FAKE)
        os.chmod(fake, 0o755)
        for f in os.listdir(log):
            os.remove(os.path.join(log, f))
        a1 = {"idea": "A fast ride in the sun.", "name": "Red Rush Test",
              "screen": part("Warm Rush", new_screen(), "sunlit", 70),
              "color": "", "wallpaper": part("Road Streaks", WALL, "lensflare", 85),
              "cursor": part("Big Red", "vec4 cursorFx(vec2 p, vec2 m) { return vec4(1.0, 0.0, 0.0, 1.0); }", "comet", 85),
              "window": part("Loop Glass", "void main() { while (true) { } }", "sun-patch", 70),
              "window_color": part("Dusk Glass", COLOR, "", 70),
              "frame": {"new": {"name": "Red Edge", "desc": "A slim red border.", "fallback": "soft-round", "settings": {"rounding": 14, "border_size": 2, "border_colors": ["d4202a", "ff8a3a"], "shadow_range": 24}}},
              "strength": {}, "note": "test"}
        a2 = {"cursor": part("Red Ring", CURSOR, "comet", 85), "window": part("Loop Glass", "void main() { for (;;) { } }", "sun-patch", 70)}
        a3 = {"window": part("Loop Glass", "void main() { discard; }", "sun-patch", 70)}
        for i, a in enumerate((a1, a2, a3), 1):
            open(os.path.join(log, "answer-%d.json" % i), "w").write("Here you go:\n```json\n" + json.dumps(a) + "\n```")
        e_inv = env(extra={"OMASHADERS_AI_CMD": fake})
        r = cli(["make", "a great day, a fast ride, like the car in the picture", "--invent", "--current", "--part", "window=in the car's red", "--json"], e_inv)
        try:
            res = json.loads(r.stdout.strip().splitlines()[-1])
        except (ValueError, IndexError):
            res = {}
        check("invent run finished", r.returncode == 0 and res.get("ok"), r.stdout[-400:] + r.stderr[-600:])
        made = {m["slot"]: m for m in res.get("new", [])}
        check("new screen, wallpaper, cursor, window colour and frame were made", sorted(made) == ["cursor", "frame", "screen", "wallpaper", "window_color"], str(sorted(made)))
        check("the cursor needed a repair (2 tries)", made.get("cursor", {}).get("tries") == 2, str(made.get("cursor")))
        fb = res.get("fell_back", [])
        check("the window shader never passed -> closest existing effect + message", len(fb) == 1 and fb[0]["slot"] == "window" and fb[0]["used"] == "sun-patch"
              and any("Window shader" in n and "did not pass the safety check" in n for n in res.get("notes", [])), str(fb))
        line = res.get("line", "")
        check("the theme line has the new ids and the fallback", all(m["id"] in line for m in made.values()) and "sun-patch" in line, line)
        check("the AI was called three times (answer + 2 repairs)", len([f for f in os.listdir(log) if f.startswith("prompt-")]) == 3)
        p1 = open(os.path.join(log, "prompt-1.txt")).read()
        check("prompt: palette hex colours, the part direction and the names list are in", "C_c81e28" in p1 or re.search(r"C_[c-d][0-9a-f]{1}[0-2][0-9a-f]{3}", p1) is not None, p1[-900:])
        check("prompt: direction for the window is passed on", "window: in the car's red" in p1)
        check("prompt: stays small (no catalog hints)", len(p1) < 22000, "%d chars" % len(p1))
        p2 = open(os.path.join(log, "prompt-2.txt")).read()
        check("repair prompt carries the gate's reason and the code", "# REPAIR" in p2 and "only 'for' loops" in p2 and "while (true)" in p2, p2[-600:])
        import aigen
        aigen.GEN = os.path.join(state, "generated")
        lst = aigen.listing()
        check("the new effects wait as pending in the state folder", len(lst) == 5 and all(not m["kept"] for m in lst), str(lst))
        check("nothing was written into the plugin folder", not [f for f in os.listdir(os.path.join(ROOT, "shaders")) if f.startswith("ai-")])
        check("themes file has the new theme", "ai-" in open(os.path.join(state, "themes")).read())
        r = cli(["keep"] + [m["id"] for m in lst[:1]] + ["--json"], e_inv)
        check("keep marks an effect as kept", r.returncode == 0 and [m["kept"] for m in aigen.listing()].count(True) == 1, r.stdout + r.stderr)
        cl = open(os.path.join(state, "themes")).read().split("\n")
        cl = [x for x in cl if x.strip()]
        keep_n = len(cl) - 1
        r = cli(["discard", "--theme", cl[-1]] + [m["id"] for m in lst] + ["--json"], e_inv)
        left = [x for x in open(os.path.join(state, "themes")).read().split("\n") if x.strip()]
        check("discard --theme removes exactly that theme line", r.returncode == 0 and left == cl[:-1] and len(left) == keep_n, str(left))
        check("discard deletes them all", r.returncode == 0 and aigen.listing() == [] and not any(f.startswith("ai-") for sd in os.listdir(aigen.GEN) if os.path.isdir(os.path.join(aigen.GEN, sd)) for f in os.listdir(os.path.join(aigen.GEN, sd))), r.stdout + r.stderr)
        # a weak local model gets a warning
        for f in os.listdir(log):
            os.remove(os.path.join(log, f))
        open(os.path.join(log, "answer-1.json"), "w").write("I cannot do that")
        open(os.path.join(log, "answer-2.json"), "w").write("still no")
        r = cli(["make", "a test", "--invent", "--json"], e_inv)
        check("an AI that does not answer with JSON gives a plain error", r.returncode == 1 and "did not answer" in r.stdout, r.stdout + r.stderr)
        # ---------------------------------------------------------- 3a) a theme that only recolours gets one round to come alive
        for f in os.listdir(log):
            os.remove(os.path.join(log, f))
        l1 = {"idea": "A calm pond.", "name": "Tint Pond", "screen": part("Warm Rush", new_screen(), "sunlit", 70), "wallpaper": "", "cursor": "", "strength": {}}
        l2 = {"wallpaper": part("Road Streaks", WALL, "lensflare", 85), "cursor": "comet"}
        for i, a in enumerate((l1, l2), 1):
            open(os.path.join(log, "answer-%d.json" % i), "w").write(json.dumps(a))
        r = cli(["make", "a calm pond", "--invent", "--current", "--json"], e_inv)
        try:
            res = json.loads(r.stdout.strip().splitlines()[-1])
        except (ValueError, IndexError):
            res = {}
        made = {m["slot"]: m for m in res.get("new", [])}
        check("tint-only theme: one repair round asked for life", len([f for f in os.listdir(log) if f.startswith("prompt-")]) == 2
              and "THE THEME DOES NOT LIVE" in open(os.path.join(log, "prompt-2.txt")).read(), r.stdout[-300:] + r.stderr[-300:])
        check("tint-only theme: the answer's wallpaper and cursor are in the theme", res.get("ok") and "wallpaper" in made and "comet" in res.get("line", ""), res.get("line", "") + r.stderr[-300:])
        r = cli(["discard", "--theme", res.get("line", "x")] + [m["id"] for m in res.get("new", [])] + ["--json"], e_inv)
        check("tint-only theme: cleaned up", r.returncode == 0, r.stdout + r.stderr)

        # ---------------------------------------------------------- 3b) the theme chat in Invent mode: strength-only follow-up, swapped effect cleanup
        for f in os.listdir(log):
            os.remove(os.path.join(log, f))
        c_a = {"idea": "Warm.", "name": "Chat Warm", "screen": part("Warm Rush", new_screen(), "sunlit", 70), "cursor": "comet", "strength": {"screen": 80}}
        c_b = {"strength": {"screen": 35}, "idea": "Less warm."}
        c_c = {"screen": part("Cool Rush", new_screen("2060ff"), "sunlit", 70), "idea": "Cooler."}
        for i, a in enumerate((c_a, c_b, c_c), 1):
            open(os.path.join(log, "answer-%d.json" % i), "w").write(json.dumps(a))
        r = cli(["chat", "turn", "a warm day", "--invent", "--new", "--json"], e_chat)
        i1 = json.loads(r.stdout) if r.stdout.strip().startswith("{") else {}
        check("invent chat turn 1 generated a screen effect, not in the list yet", i1.get("ok") and len(i1.get("new", [])) == 1 and "ai-" in i1.get("line", ""), r.stdout[-300:] + r.stderr[-300:])
        gen1 = i1["new"][0]["id"] if i1.get("new") else ""
        r = cli(["chat", "turn", "less warm", "--json"], e_chat)
        i2 = json.loads(r.stdout) if r.stdout.strip().startswith("{") else {}
        check("invent chat strength-only follow-up keeps the generated effect and writes nothing new", gen1 in i2.get("line", "") and "fx=35" in i2.get("line", "") and not i2.get("new"), str(i2)[:400] + r.stderr[-300:])
        pr2 = open(os.path.join(log, "prompt-2.txt")).read()
        check("invent follow-up prompt names the generated effect and does not resend the picture rules", gen1 in pr2 and "generated this chat" in pr2 and "# CURRENT THEME" in pr2)
        r = cli(["chat", "turn", "make it cooler", "--json"], e_chat)
        i3 = json.loads(r.stdout) if r.stdout.strip().startswith("{") else {}
        gen2 = i3["new"][0]["id"] if i3.get("new") else ""
        check("a swapped effect is a new one in the line", gen2 and gen2 != gen1 and gen2 in i3.get("line", "") and gen1 not in i3.get("line", ""), str(i3)[:400] + r.stderr[-300:])
        aigen.GEN = os.path.join(state, "generated")
        check("both generated effects exist while the chat is open", len(aigen.listing()) == 2)
        r = cli(["chat", "keep", "--json"], e_chat)
        aigen.GEN = os.path.join(state, "generated")
        left = aigen.listing()
        check("keep: the effect in the theme is kept, the replaced one is deleted", [m["id"] for m in left] == [gen2] and left[0]["kept"] is True, str(left) + r.stdout[-200:])

        # ---------------------------------------------------------- 3c) "Create with AI" in an effect category: one new effect, no theme
        for f in os.listdir(log):
            os.remove(os.path.join(log, f))
        themes_before = open(themes_file).read() if os.path.exists(themes_file) else ""
        o_a = {"idea": "A green pulse.", "name": "Only Pulse", "screen": part("Green Pulse", new_screen("30ff60"), "sunlit", 70), "cursor": "comet", "color": "warm", "strength": {"screen": 60}}
        o_b = {"idea": "Slower.", "screen": part("Slow Pulse", new_screen("20e050"), "sunlit", 70)}
        for i, a_ in enumerate((o_a, o_b), 1):
            open(os.path.join(log, "answer-%d.json" % i), "w").write(json.dumps(a_))
        r = cli(["chat", "turn", "a slow green pulse", "--invent", "--only", "screen", "--new", "--json"], e_chat)
        d1 = json.loads(r.stdout) if r.stdout.strip().startswith("{") else {}
        check("only: one screen effect is made, the other slots stay empty", d1.get("ok") and d1.get("only") == "screen" and len(d1.get("new", [])) == 1
              and d1.get("line", "").split("|")[1:4] == ["", "", ""] and d1["line"].split("|")[0] == d1.get("effect"), str(d1)[:400] + r.stderr[-300:])
        p1 = open(os.path.join(log, "prompt-1.txt")).read()
        check("only: the prompt asks for that one effect", "ONLY" in p1.upper() and "screen" in p1.lower(), p1[:300])
        r = cli(["chat", "turn", "slower", "--json"], e_chat)
        d2 = json.loads(r.stdout) if r.stdout.strip().startswith("{") else {}
        check("only: a follow-up changes the same effect", d2.get("ok") and d2.get("only") == "screen" and d2.get("effect") != d1.get("effect"), str(d2)[:400] + r.stderr[-300:])
        r = cli(["chat", "keep", "--json"], e_chat)
        k = json.loads(r.stdout) if r.stdout.strip().startswith("{") else {}
        aigen.GEN = os.path.join(state, "generated")
        left = aigen.listing()
        check("only: keep saves the effect as mine, deletes the replaced one and adds no theme", k.get("ok") and k.get("only") == "screen" and k.get("line") == ""
              and sorted(m["id"] for m in left) == sorted([gen2, d2.get("effect")]) and all(m["kept"] for m in left) and d1.get("effect") not in [m["id"] for m in left] and (open(themes_file).read() if os.path.exists(themes_file) else "") == themes_before, str(k)[:300] + str(left))
        r = cli(["chat", "turn", "x", "--only", "nonsense", "--new", "--json"], e_chat)
        check("only: an unknown slot is refused", r.returncode != 0, r.stdout[-200:])
    except SkipInvent:
        pass
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # ---------------------------------------------------------- 4) the examples in the guide pass the gate
    import aigen
    import aitheme
    guide = open(os.path.join(ROOT, "docs", "theme-instructions.md"), encoding="utf-8").read()
    blocks = re.findall(r"```glsl (\w+)\n(.*?)```", guide, re.S)
    check("the guide has an example for screen, window, color, wallpaper and cursor", sorted(k for k, _ in blocks) == ["color", "cursor", "screen", "wallpaper", "window"], str([k for k, _ in blocks]))
    for kind, code in (blocks if not aigen.render_ready() else []):
        r = aigen.gate(kind, code, "guide", "guide example", 70)
        check("guide example %s passes the gate" % kind, r["ok"], " | ".join(r["problems"]))
    ex = re.search(r"### Answer in exactly this shape \(INVENT\).*?```\n(\{.*?\})\n```", guide, re.S)
    try:
        d = json.loads(ex.group(1), strict=False)
        check("the Invent answer example is valid JSON with every key", all(k in d for k in ("idea", "name", "screen", "color", "wallpaper", "cursor", "window", "window_color", "frame", "strength", "note")))
        for slot in ("screen", "wallpaper"):
            check("invent example %s parses as a new effect" % slot, __import__("aiinvent").part_of(slot, d[slot])[0] == "new")
    except Exception as e:
        check("the Invent answer example is valid JSON", False, str(e))
    check("Pick prompt does not contain the Inventing chapter", "Inventing new effects" not in aitheme.guide_text() and "For maintainers" not in aitheme.guide_text())
    check("Invent prompt is the chapter only and small", "Inventing new effects" in aitheme.invent_text() and len(aitheme.invent_text()) < 14000, str(len(aitheme.invent_text())))
    print("ai provider/invent selftest: %d ok, %d failed" % (OK, FAIL))
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(run())
