#!/usr/bin/env python3
"""palette.js (used by PaletteDialog.qml) and bin/omspalette.py must write and read the same ids."""
import json, os, subprocess, sys, random

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import omspalette as P

if subprocess.call(["which", "node"], stdout=subprocess.DEVNULL) != 0:
    print("skip: node is not installed")
    sys.exit(0)

JS = os.path.join(os.path.dirname(HERE), "palette.js")
prog = """
const src = require('fs').readFileSync(%r, 'utf8').replace(/^\\.pragma library\\n/, '');
const module = { exports: {} }; new Function('module', src)(module);
const P = module.exports;
const ids = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(ids.map(id => ({ id, valid: P.isId(id), again: P.isId(id) ? P.encode(P.decode(id)) : null }))));
console.log(JSON.stringify(P.starters.map(s => s.id)));
const sur = [];
for (let i = 0; i < 400; i++) { const q = P.surprise(); sur.push({ id: P.encode(q), title: q.title, stops: q.stops }); }
console.log(JSON.stringify(sur));
""" % JS

random.seed(7)
ids = []
for _ in range(60):
    n = random.choice([0, 2, 3, 4, 5])
    stops = [(random.random(), "%06x" % random.randrange(1 << 24)) for _ in range(n)]
    ids.append(P.encode(P.make(stops=stops, keep=random.random(), sat=random.uniform(0, 1.9), con=random.uniform(0, 1.9), gam=random.uniform(0.2, 1.9),
                               shadow=("%06x" % random.randrange(1 << 24), random.random()), light=("%06x" % random.randrange(1 << 24), random.random()),
                               steps=random.choice([0] + list(range(2, 16))))))
ids += ["pal-", "pal-zz", "pal-" + "0" * 27, "custom-ff8800", ""]
r = subprocess.run(["node", "-e", prog], input=json.dumps(ids), capture_output=True, text=True)
if r.returncode != 0:
    print("FAIL: node failed:", r.stderr[-300:])
    sys.exit(1)
res, starters, sur = (json.loads(l) for l in r.stdout.strip().split("\n"))
fails = 0
for x in res:
    want = P.is_palette_id(x["id"])
    ok = x["valid"] == want and (not want or x["again"] == P.encode(P.decode(x["id"])) == x["id"])
    if not ok:
        fails += 1
        print("FAIL: %r js=%r again=%r py=%r" % (x["id"], x["valid"], x["again"], want))
for s in starters:
    if not P.is_palette_id(s):
        fails += 1
        print("FAIL: starter is not a valid id:", s)
def luma(h):
    return 0.2126 * int(h[0:2], 16) + 0.7152 * int(h[2:4], 16) + 0.0722 * int(h[4:6], 16)
seen = set()
for x in sur:
    seen.add(x["id"])
    if not P.is_palette_id(x["id"]) or not x["title"]:
        fails += 1
        print("FAIL: surprise gave a bad palette:", x["id"])
    st = sorted(x["stops"], key=lambda s: s[0])
    if st and (luma(st[0][1]) > 0.45 * 255 or luma(st[-1][1]) < 0.55 * 255 or any(luma(a[1]) > luma(b[1]) + 1 for a, b in zip(st, st[1:]))):
        fails += 1
        print("FAIL: surprise ramp is not dark to bright:", x["id"])
if len(seen) < 380:
    fails += 1
    print("FAIL: surprise repeats too much (%d different of 400)" % len(seen))
print("palette.js agrees with omspalette.py on %d ids and %d starters" % (len(ids), len(starters)) if not fails else "%d mismatch(es)" % fails)
sys.exit(1 if fails else 0)
