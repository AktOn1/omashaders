#!/usr/bin/env python3
"""The left list of every menu (the menulist block in Core.qml): commands pinned first, and a filter shows its matches directly."""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if subprocess.call(["which", "node"], stdout=subprocess.DEVNULL) != 0:
    print("skip: node is not installed")
    sys.exit(0)

CORE = os.path.join(os.path.dirname(HERE), "Core.qml")
src = open(CORE, encoding="utf-8").read()
m = re.search(r"// menulist:begin\n(.*?)// menulist:end", src, re.S)
if not m:
    print("FAIL: no menulist block in Core.qml")
    sys.exit(1)
BLOCK = m.group(1).replace('readonly property string menuAllId: "@all"', 'var menuAllId = "@all"')
prog = """
const src = %s + '\\nmodule.exports = { build: menuBuild, ALL_ID: menuAllId };';
const module = { exports: {} }; new Function('module', src)(module);
const M = module.exports;
const it = (id, label, extra) => Object.assign({ id, label }, extra || {});
const raw = [
  { id: 'fav', label: 'Favorites', items: [it('Aurora', 'Aurora')] },
  { id: 'Lens', label: 'Lens', items: [it('Blue haze', 'Blue haze', { desc: 'soft glow' }), it('Fisheye', 'Fisheye')] },
  { id: '@ai:screen', label: 'Create with AI', action: true },
  { id: 'Retro', label: 'Retro', items: [it('CRT blue', 'CRT blue', { hint: 'heavy' }), it('Amber', 'Amber'), it('@rand:x', 'Blue surprise')] },
  { id: '@delete', label: 'Delete selected', action: true },
  { id: 'Mood', label: 'Mood', items: [it('Dusk', 'Dusk', { desc: 'deep blue evening' })] },
  { id: '@off', label: 'Off', action: true },
];
const names = r => r.cats.map(c => c.id);
const out = {};
out.plain = M.build(raw, '');
out.blank = M.build(raw, '   ');
out.blue = M.build(raw, 'blue');
out.two = M.build(raw, 'crt heavy');
out.catname = M.build(raw, 'retro');
out.none = M.build(raw, 'zzzz');
out.dup = M.build([{ id: 'a', label: 'A', items: [it('x', 'Sun')] }, { id: 'b', label: 'B', items: [it('x', 'Sun')] }], 'sun');
out.onlycmds = M.build([{ id: '@off', label: 'Off', action: true }], 'off');
out.nocmds = M.build([{ id: 'a', label: 'A', items: [it('x', 'Sun')] }], '');
console.log(JSON.stringify(out));
""" % json.dumps(BLOCK)

r = subprocess.run(["node", "-e", prog], capture_output=True, text=True)
if r.returncode != 0:
    print("FAIL: node failed:", r.stderr[-400:])
    sys.exit(1)
o = json.loads(r.stdout)
names = lambda b: [c["id"] for c in b["cats"]]
fails = 0


def check(what, ok, got=None):
    global fails
    if not ok:
        fails += 1
        print("FAIL:", what, "" if got is None else "-> %s" % (got,))


CMDS = ["@ai:screen", "@delete", "@off"]
check("no filter: commands first in their order, categories after in theirs",
      names(o["plain"]) == CMDS + ["fav", "Lens", "Retro", "Mood"] and o["plain"]["nCmd"] == 3, names(o["plain"]))
check("no filter: nothing is flattened", o["plain"]["allIdx"] == -1 and o["plain"]["total"] == 0)
check("blank query is no filter", names(o["blank"]) == names(o["plain"]))
check("filter keeps the command block on top", names(o["blue"])[:3] == CMDS and o["blue"]["nCmd"] == 3, names(o["blue"]))
check("filter: All matches right after the commands", o["blue"]["allIdx"] == 3 and names(o["blue"])[3] == "@all", names(o["blue"]))
flat = [i["id"] for i in o["blue"]["cats"][3]["items"]]
check("flat list holds every match once (label, description, hint; Favorites and @ rows skipped)",
      flat == ["Blue haze", "CRT blue", "Dusk"] and o["blue"]["total"] == 3, flat)
check("only categories with a match follow, in their order", names(o["blue"])[4:] == ["Lens", "Retro", "Mood"], names(o["blue"]))
check("each category row carries its match count", [c["badge"] for c in o["blue"]["cats"][3:]] == ["3", "1", "1", "1"])
check("a flat row knows its category", o["blue"]["catOf"] == {"Blue haze": "Lens", "CRT blue": "Retro", "Dusk": "Mood"}, o["blue"]["catOf"])
check("all words must match (any of label, hint)", o["two"]["total"] == 1 and names(o["two"])[4:] == ["Retro"], names(o["two"]))
check("the category name matches too", o["catname"]["total"] == 2, o["catname"]["total"])
check("no match: only the commands stay, no All matches", names(o["none"]) == CMDS and o["none"]["total"] == 0 and o["none"]["allIdx"] == -1, names(o["none"]))
check("an item in two categories counts once in All matches", o["dup"]["total"] == 1 and len(o["dup"]["cats"][0]["items"]) == 1)
check("commands are never searched", o["onlycmds"]["total"] == 0 and names(o["onlycmds"]) == ["@off"])
check("menu without commands: plain list", names(o["nocmds"]) == ["a"] and o["nocmds"]["nCmd"] == 0)
print("menulist: %d check(s) failed" % fails if fails else "menulist: commands pinned, filter flat")
sys.exit(1 if fails else 0)
