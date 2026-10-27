#!/usr/bin/env python3
"""The theme's Wallhaven picture: the capsule above the Wallpaper tab (state logic in the wallcap block of Core.qml, run under node)
and `wallhaven cached` / `wallhaven use` against a scratch state folder with a fake wallpaper command (no network, no desktop)."""
import json, os, re, shutil, stat, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
fails = 0


def check(what, ok, got=None):
    global fails
    if not ok:
        fails += 1
        print("FAIL:", what, "" if got is None else "-> %s" % (got,))


# ---- 1. the pure logic in Core.qml
src = open(os.path.join(ROOT, "Core.qml"), encoding="utf-8").read()
m = re.search(r"// wallcap:begin\n(.*?)// wallcap:end", src, re.S)
if not m:
    print("FAIL: no wallcap block in Core.qml")
    sys.exit(1)
if subprocess.call(["which", "node"], stdout=subprocess.DEVNULL) != 0:
    print("skip: node is not installed (CLI checks only)")
    o = None
else:
    names = "wallCapState lineWh themeRenamed optsWithWh themeCompose themeWallPlan lineWithWh themeSavedPlan settingsEntry"
    prog = """
const src = %s + '\\nmodule.exports = { %s };';
const module = { exports: {} }; new Function('module', src)(module);
const M = module.exports;
const out = {};
const S = (...a) => M.wallCapState(...a);
out.none = S('', false, '', false, '');
out.noneUnset = S('', false, '', false, '', true);
out.noneBusy = S('', false, '', true, '', true);
out.rem = S('', false, 'zzzzzz', false, '', true);
out.remDefault = S('', false, 'zzzzzz', false, '');
out.unsaved = S('', false, 'zzzzzz', false, '', false);
out.noneNoTheme = S('', false, '', false, '', false);
out.stillDl = S('abc123', false, 'zzzzzz', false, '', false);
out.dl = S('abc123', false, '', false, '');
out.set = S('abc123', true, 'zzzzzz', false, '');
out.cur = S('abc123', true, 'abc123', false, '');
out.busyDl = S('abc123', false, '', true, '');
out.busySet = S('abc123', true, '', true, '');
out.err = S('abc123', false, '', false, 'Download failed');
out.errThenCur = S('abc123', true, 'abc123', false, 'Download failed');
const line = 'neonrain|aurora|glow|neon-noir|Night|||frame1|fx=60,wall=65,wh=abc123';
out.whOf = [M.lineWh(line), M.lineWh('a|b|c|d'), M.lineWh('a|b|c|d|n|||||fx=50'), M.lineWh('a|b|c|d|n||||wh=ABCDEF'), M.lineWh('a|b|c|d|n||||fx=5,wh=abc1234')];
out.copy = M.themeRenamed(line, 'Night copy');
out.addWh = [M.lineWithWh(line, 'qqqqqq'), M.lineWithWh('s|w|m|c|Old', 'qqqqqq'), M.lineWithWh('s|w|m|c|Old||||fx=50,wall=60', 'qqqqqq'), M.lineWithWh('s|w|m|c|Old|e|k|f', 'qqqqqq')];
out.copyNoOpts = M.themeRenamed('s|w|m|c|Old', 'New');
out.keep = [M.optsWithWh('fx=60', 'abc123'), M.optsWithWh('fx=60,wh=qqqqqq', 'abc123'), M.optsWithWh('', 'abc123'), M.optsWithWh('fx=60', ''), M.optsWithWh('', '')];
const P = (...a) => M.themeWallPlan(...a);
out.plan = {
  off: P(false, 'abc123', '', ''), offUndef: P(undefined, 'abc123', '', ''), offStr: P('true', 'abc123', '', ''),
  noWh: P(true, '', '', ''), noWhUndef: P(true, undefined, '', ''),
  fetch: P(true, 'abc123', 'zzzzzz', ''), fetchNone: P(true, 'abc123', '', ''),
  have: P(true, 'abc123', 'abc123', ''), wait: P(true, 'abc123', '', 'abc123'), queue: P(true, 'abc123', '', 'qqqqqq'),
};
out.saved = [M.themeSavedPlan('zzzzzz', ''), M.themeSavedPlan('zzzzzz', 'abc123'), M.themeSavedPlan('', ''), M.themeSavedPlan('', 'abc123'), M.themeSavedPlan(undefined, undefined)];
const base = { includeAnimated: true, fps: 60, useThemeWallpaper: false };
out.entry = [M.settingsEntry('x.y', base, 'useThemeWallpaper', true), M.settingsEntry('x.y', { id: 'other', a: 1 }, 'useThemeWallpaper', false), M.settingsEntry('x.y', undefined, 'useThemeWallpaper', true)];
out.entryBaseUntouched = base.useThemeWallpaper;
console.log(JSON.stringify(out));
""" % (json.dumps(m.group(1)), ", ".join(names.split()))
    r = subprocess.run(["node", "-e", prog], capture_output=True, text=True)
    if r.returncode != 0:
        print("FAIL: node failed:", r.stderr[-500:])
        sys.exit(1)
    o = json.loads(r.stdout)
    st = lambda k: o[k]["kind"]
    check("no Wallhaven id, nothing on screen: muted text, no action",
          st("none") == "none" and o["none"]["label"] == "No Wallhaven picture saved for this theme" and o["none"]["enabled"] is False
          and o["noneUnset"] == o["none"] and o["noneNoTheme"]["kind"] == "none" and o["noneBusy"]["kind"] == "none", (o["none"], o["noneNoTheme"]))
    check("no id, a Wallhaven picture on screen: offer to remember it (also when the caller does not say whether a theme is selected)",
          st("rem") == "remember" and o["rem"]["label"] == "Remember Wallhaven zzzzzz for this theme" and o["rem"]["enabled"] is True and o["remDefault"] == o["rem"], o["rem"])
    check("no id, picture on screen, but the look is not a saved theme: nothing to remember yet, points at F",
          st("unsaved") == "unsaved" and o["unsaved"]["enabled"] is False and "F" in o["unsaved"]["label"] and "zzzzzz" in o["unsaved"]["label"], o["unsaved"])
    check("a theme that has an id ignores the remember offer", st("stillDl") == "download", o["stillDl"])
    check("remembering adds wh= to the 9th field (new field, existing numbers, window fields kept) and leaves the rest alone",
          o["addWh"] == ["neonrain|aurora|glow|neon-noir|Night|||frame1|fx=60,wall=65,wh=abc123", "s|w|m|c|Old||||wh=qqqqqq",
                         "s|w|m|c|Old||||fx=50,wall=60,wh=qqqqqq", "s|w|m|c|Old|e|k|f|wh=qqqqqq"], o["addWh"])
    check("id, not on disk: download button", st("dl") == "download" and o["dl"]["label"] == "Download and set", o["dl"])
    check("id, on disk, other picture on screen: Set wallpaper", st("set") == "set" and o["set"]["label"] == "Set wallpaper", o["set"])
    check("id is already the wallpaper: ticked, disabled", st("cur") == "current" and o["cur"]["label"] == "Wallpaper set" and o["cur"]["enabled"] is False, o["cur"])
    check("buttons are enabled when pressing does something", all(o[k]["enabled"] for k in ("dl", "set", "err")))
    check("busy while downloading / while setting", st("busyDl") == "busy" and st("busySet") == "busy" and o["busyDl"]["enabled"] is False, o["busyDl"])
    check("busy label says what is going on", "ownload" in o["busyDl"]["label"] and "etting" in o["busySet"]["label"], (o["busyDl"], o["busySet"]))
    check("error offers a retry", st("err") == "error" and o["err"]["label"] == "Wallhaven did not answer. Retry" and o["err"]["enabled"] is True, o["err"])
    check("an old error does not hide the fact that the picture is now set", st("errThenCur") == "current", o["errThenCur"])
    check("lineWh reads only a well formed id from the 9th field", o["whOf"] == ["abc123", "", "", "", ""], o["whOf"])
    check("duplicate/rename keep the 9th field (wh) and every other field",
          o["copy"] == "neonrain|aurora|glow|neon-noir|Night copy|||frame1|fx=60,wall=65,wh=abc123", o["copy"])
    check("copy of a line without numbers stays short", o["copyNoOpts"] == "s|w|m|c|New", o["copyNoOpts"])
    check("saving keeps the theme's own picture when the screen shows none of Wallhaven's",
          o["keep"] == ["fx=60,wh=abc123", "fx=60,wh=qqqqqq", "wh=abc123", "fx=60", ""], o["keep"])

    check("F on a look that is already a saved theme attaches the Wallhaven picture on screen when the theme has none, else says already saved",
          o["saved"] == ["attach", "already", "already", "already", "already"], o["saved"])
    check("the checkbox writes useThemeWallpaper into the plugin's own entry and keeps its other keys (same entry the settings screen edits)",
          o["entry"] == [{"id": "x.y", "includeAnimated": True, "fps": 60, "useThemeWallpaper": True}, {"id": "x.y", "a": 1, "useThemeWallpaper": False},
                         {"id": "x.y", "useThemeWallpaper": True}] and o["entryBaseUntouched"] is False, o["entry"])
    check("Core.qml: the checkbox (key L) is in the capsule row, listed in the hint strip, and writes through updateEntryInline",
          "id: autoBox" in src and "Use theme wallpapers" in src and 'else if (t === "L") setUseThemeWallpaper(!useThemeWallpaper)' in src
          and src.count('k: ["L"], t: autoHint') == 2 and "updateEntryInline(moduleName, entry)" in src and "setUseThemeWallpaper(!root.useThemeWallpaper)" in src)
    check("Core.qml: F (startSave) and the save command go through alreadySaved, not a bare 'Already saved'",
          src.count("alreadySaved(") >= 3 and 'flash("Already saved: " + themeItem(dup[0])' not in src)

    pl = o["plan"]
    check("setting off (default): applying a theme never fetches, whatever the theme holds",
          pl["off"] == "none" and pl["offUndef"] == "none" and pl["offStr"] == "none", pl)
    check("setting on, theme without a Wallhaven id: the wallpaper is left alone", pl["noWh"] == "none" and pl["noWhUndef"] == "none", pl)
    check("setting on, theme with an id, other picture on screen: fetch and set", pl["fetch"] == "fetch" and pl["fetchNone"] == "fetch", pl)
    check("setting on, the picture is already the wallpaper: nothing to do", pl["have"] == "have", pl)
    check("setting on, same picture already being fetched: wait; another one: queue", pl["wait"] == "wait" and pl["queue"] == "queue", pl)
    check("apply gives the wallpaper only to the callers that ask for it (menu, key/IPC, random), not to restore/undo/revert",
          len(re.findall(r"applyTheme\(.*, (true, true|keep, true)\)", src)) == 4
          and "withWallpaper === true) themeWallpaper(it)" in src and 'setting("useThemeWallpaper", false) === true' in src)
    mf = json.load(open(os.path.join(ROOT, "manifest.json")))["barWidget"]
    sc = [x for x in mf["schema"] if x["key"] == "useThemeWallpaper"]
    check("manifest: useThemeWallpaper is a boolean, off by default", len(sc) == 1 and sc[0]["type"] == "boolean" and sc[0]["defaultValue"] is False
          and mf["defaults"].get("useThemeWallpaper") is False, sc)

# ---- 1b. AI-made themes keep the id of the picture they were made for
sys.path.insert(0, HERE)
import aitheme, omslib  # noqa: E402
t = aitheme.to_theme({"name": "Rain", "screen": "neonrain", "strength": {"screen": 60}}, "abc123")
check("an AI theme made from a Wallhaven picture stores its id", omslib.opts_str(omslib.clean_opts(t["o"], [])) == "fx=60,wh=abc123", t["o"])
check("an AI theme without a Wallhaven picture stores none", "wh" not in aitheme.to_theme({"name": "Rain"}, "")["o"])

# ---- 2. CLI: scratch state, fake wallpaper command
tmp = tempfile.mkdtemp(prefix="wallcap-")
try:
    st_dir = os.path.join(tmp, "state", "omarchy", "io.github.akton1.omashaders")
    fake = os.path.join(tmp, "fakebin")
    os.makedirs(os.path.join(st_dir, "wallhaven", "full"))
    os.makedirs(fake)
    log = os.path.join(tmp, "bg.log")
    with open(os.path.join(fake, "omarchy-theme-bg-set"), "w") as f:
        f.write('#!/bin/bash\necho "$1" >> "%s"\n' % log)
    os.chmod(os.path.join(fake, "omarchy-theme-bg-set"), 0o755)
    env = dict(os.environ, OMASHADERS_STATE_DIR=st_dir, PATH=fake + os.pathsep + os.environ["PATH"])
    wh = lambda *a: subprocess.run([sys.executable, os.path.join(HERE, "wallhaven")] + list(a), capture_output=True, text=True, env=env)
    r = wh("cached", "abc123")
    check("cached: not on disk -> exit 1, prints nothing", r.returncode == 1 and r.stdout.strip() == "", (r.returncode, r.stdout, r.stderr))
    pic = os.path.join(st_dir, "wallhaven", "full", "wallhaven-abc123.jpg")
    with open(pic, "wb") as f:
        f.write(b"\xff\xd8\xff\xe0" + b"0" * 64)
    r = wh("cached", "abc123")
    check("cached: on disk -> exit 0 and the path", r.returncode == 0 and r.stdout.strip() == pic, (r.returncode, r.stdout))
    r = wh("cached", "../../x")
    check("cached: a bad id is simply not cached", r.returncode == 1 and r.stdout.strip() == "", (r.returncode, r.stdout))
    check("cached: no argument is not cached", wh("cached").returncode == 1)
    check("cached did not touch the wallpaper", not os.path.exists(log))
    open(os.path.join(st_dir, "wallhaven", "full", "wallhaven-empty1.jpg"), "w").close()
    check("cached: an empty file does not count", wh("cached", "empty1").returncode == 1)
    r = wh("use", "abc123")
    check("use: a picture on disk is set without any download", r.returncode == 0 and os.path.exists(log), (r.returncode, r.stdout, r.stderr))
    if os.path.exists(log):
        set_to = open(log).read().strip()
        check("use: the wallpaper file is named wallhaven-<id>.<ext>, so the menu can see which one is on screen",
              re.search(r"/wallhaven-abc123\.jpg$", set_to) is not None, set_to)
    r = wh("cached", "abc123")
    check("cached still true after use (copy kept in used/)", r.returncode == 0)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("wallcapsule: %d check(s) failed" % fails if fails else "wallcapsule: capsule states, copies keep wh, wallhaven cached/use")
sys.exit(1 if fails else 0)
