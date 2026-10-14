"""Offline self-test of the Rich flow (bin/airich.py, bin/aisheet.py): a stub Planner, Builders, Adjuster and Reviewer stand in for the AI.
Everything runs in a scratch state folder with a scratch HOME. Run: python3 bin/ai-theme selftest (this part takes about two minutes:
the gate and the contact sheets render on the CPU)."""
import sys
sys.dont_write_bytecode = True
import glob
import json
import os
import re
import shutil
import tempfile

HERE = os.path.dirname(os.path.realpath(__file__))
ROOT = os.path.dirname(HERE)
TMP = tempfile.mkdtemp(prefix="omashaders-rich-selftest-")
os.environ["OMASHADERS_STATE_DIR"] = os.path.join(TMP, "state")
os.environ["HOME"] = TMP
sys.path.insert(0, HERE)
import airich as R  # noqa: E402
import aigen as G  # noqa: E402
import aiinvent as I  # noqa: E402
import aiprov as P  # noqa: E402
import omslib as L  # noqa: E402

OK = FAIL = 0


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("FAIL %s %s" % (name, detail))


def example(kind, which=0):
    f = sorted(glob.glob(os.path.join(ROOT, "rich-examples", kind + "-*.glsl")))[which]
    return open(f).read()


def concept(title="Lantern Harbor"):
    return {"title": title, "biome": "a small harbour", "time_of_day": "blue hour", "mood": "warm and calm", "story": "Lanterns come on along a quiet quay.",
            "layout": "sky above y 0.4, water below", "palette": [{"hex": "0e1b33", "role": "water"}, {"hex": "ffb457", "role": "lantern"}, {"hex": "f6e7c8", "role": "light"}],
            "motion": "slow swell", "pointer": "rings", "playful_detail": "a lantern flares", "why_you_would_keep_it_on_all_day": "dim and warm",
            "tags": ["harbour", "water", "dusk"],
            "briefs": {"wallpaper": "two layers of light on the water, rings at the pointer", "screen": "evening haze", "color": "navy shadows, cream highlights",
                       "cursor": "a small lantern with a wake", "window": "a warm glow at the lower edge", "frame": "thin warm border"},
            "strength": {"screen": 65, "color": 75, "wallpaper": 90, "cursor": 85}}


class Stub:
    def __init__(self, scores, bad_slot=None, dup_title=False):
        self.scores, self.bad_slot, self.dup = scores, bad_slot, dup_title
        self.calls = []
        self.looks = 0
        self.build_n = {}

    def __call__(self, ch, system, prompt, jpg=None, timeout=None):
        u = {"tokens_in": 1000, "tokens_out": 500, "cost_usd": 0.01, "estimated": False}
        if "# CURRENT PARTS" in prompt:
            self.calls.append("adjuster")
            return json.dumps(self.adjuster), u
        if "(Planner)" in system:
            self.calls.append("planner")
            return json.dumps(concept("Koi Pond" if self.dup else "Lantern Harbor")), u
        if "(Builder)" in system:
            slot = re.search(r"# YOUR PART: (\w+)", prompt).group(1)
            self.calls.append("builder:" + slot)
            n = self.build_n[slot] = self.build_n.get(slot, 0) + 1
            if slot == "frame":
                return json.dumps({"name": "Warm Edge", "desc": "A thin warm border.", "start": 70, "fallback": "", "settings": R.FRAME_EXAMPLES[0][1]}), u
            if slot == self.bad_slot:
                return json.dumps({"name": "Loop", "desc": "bad", "start": 70, "fallback": "", "code": "void main() { for (int i = 0; i < 100000000; i++) { } }"}), u
            kind = I.SLOTS[slot][0]
            code = example(kind, (n - 1) % 2 if kind in ("wallpaper", "cursor", "screen", "window", "color") else 0)
            return json.dumps({"name": "%s %d" % (slot.title(), n), "desc": "a test %s" % slot, "start": 75, "fallback": "", "code": code}), u
        if "(Reviewer)" in system:
            self.calls.append("reviewer")
            self.looks += 1
            parts = {}
            for slot in re.findall(r"^- (\w+): brief:", prompt, re.M):
                sc = self.scores(slot, self.looks, self.build_n.get(slot, 1))
                parts[slot] = {"score": sc, "seen": "stub saw it", "fixes": ["make it brighter"] if sc < 8 else []}
            check("reviewer gets two sheets", isinstance(jpg, list) and len(jpg) == 2, repr(type(jpg)))
            return json.dumps({"summary": "stub summary", "parts": parts}), u
        raise AssertionError("unknown call: " + system[:80])


def main():
    from PIL import Image
    pic = os.path.join(TMP, "pic.png")
    im = Image.new("RGB", (640, 360))
    px = im.load()
    for y in range(360):
        for x in range(640):
            px[x, y] = (20 + y // 6, 40 + x // 12, 90 + y // 4) if y > 140 else (200 - y // 2, 150 - y // 3, 120 + y // 3)
    im.save(pic)
    P.availability = lambda ch=None: {"available": True, "backend": "stub", "hint": ""}
    ch = {"provider": "claude", "model": "sonnet", "custom": "", "mode": "rich", "remembered": False}
    os.makedirs(L.STATE, exist_ok=True)
    with open(L.THEMES, "w") as f:
        f.write("")

    # 1. a full run: one weak wallpaper is revised once, then passes
    stub = Stub(lambda slot, look, n: 5 if (slot == "wallpaper" and look == 1) else 8)
    R.P.call = stub
    res = R.run("a quiet harbour at dusk", {}, pic, "", ch, rounds=2, save=False)
    got = {m["slot"]: m for m in res["new"]}
    check("rich: every part was made", set(got) == {"wallpaper", "screen", "color", "cursor", "window", "frame"}, str(sorted(got)))
    check("rich: the weak wallpaper was revised once, the others never", got["wallpaper"]["revisions"] == 1 and all(m["revisions"] == 0 for s, m in got.items() if s != "wallpaper"))
    check("rich: calls are Planner, 6 Builders, Reviewer, 1 revision, Reviewer", stub.calls.count("planner") == 1 and stub.calls.count("reviewer") == 2 and
          sum(1 for c in stub.calls if c.startswith("builder:")) == 7, str(stub.calls))
    check("rich: the revised wallpaper scored 8 on the second look", got["wallpaper"]["score"] == 8)
    check("rich: piece sizes are reported", all(m["bytes_code"] > 0 and m["bytes_file"] >= m["bytes_code"] for m in got.values() if m["slot"] != "frame"))
    check("rich: the sheet exists", res["sheet"] and os.path.getsize(res["sheet"]) > 20000, res["sheet"])
    check("rich: usage is summed over the steps", res["usage"]["calls"] == len(res["steps"]) == 10 and abs(res["usage"]["cost_usd"] - 0.1) < 1e-6, str(res["usage"]))
    cl = res["clean"]
    check("rich: the theme uses the new effects", all(cl[k].startswith("ai-") for k in ("s", "c", "w", "m", "wf", "wr")), str(cl))
    check("rich: nothing was saved when save=False", open(L.THEMES).read() == "" and res["number"] == 0, repr(open(L.THEMES).read()[:200]) + str(res["number"]))
    check("rich: the strength is the tested start", cl["o"].get("wall") == 75, str(cl["o"]))
    meta = json.load(open(G.meta_path(got["cursor"]["id"])))
    check("rich: the meta says rich and has the sizes", meta.get("rich") and meta.get("bytes_code") == got["cursor"]["bytes_code"], str(meta))
    rs = res["rich_state"]
    check("rich_state holds the concept and the pieces", rs["concept"]["title"] == "Lantern Harbor" and set(rs["pieces"]) == set(got))

    # 2. a follow-up edits ONE part with its own Builder
    stub.adjuster = {"reply": "More shimmer on the water.", "part": "wallpaper", "action": "rewrite", "brief": "stronger glints and brighter rings"}
    stub.calls.clear()
    seen_spec = {}
    real_build = R.S.build
    R.S.build = lambda spec, *a, **k: (seen_spec.update(spec), real_build(spec, *a, **k))[1]
    fres = R.follow("make the water shimmer more", rs, cl, [], pic, "", ch)
    R.S.build = real_build
    check("follow: the rebuilt sheet can render the wallpaper and cursor (needs the ES twin)", all(seen_spec.get(k, {}).get("built", {}).get("es") for k in ("wallpaper", "cursor")), str({k: sorted(v["built"]) for k, v in seen_spec.items()}))
    check("follow: one Adjuster and one Builder, nothing else", stub.calls == ["adjuster", "builder:wallpaper"], str(stub.calls))
    check("follow: only the wallpaper changed", fres["clean"]["w"] != cl["w"] and all(fres["clean"][k] == cl[k] for k in ("s", "c", "m", "wf", "wr")), str(fres["clean"]) + str(cl) + str(fres["notes"]))
    check("follow: the contact sheet was rebuilt without a Reviewer", fres["sheet"] and os.path.exists(fres["sheet"]) and "reviewer" not in stub.calls)
    check("follow: the concept brief was updated", fres["rich_state"]["concept"]["briefs"]["wallpaper"].startswith("stronger"))
    stub.adjuster = {"reply": "Calmer.", "part": "screen", "action": "strength", "strength": 40}
    stub.calls.clear()
    f2 = R.follow("calmer screen", fres["rich_state"], fres["clean"], [], pic, "", ch)
    check("follow: a strength change makes no Builder call", stub.calls == ["adjuster"] and f2["clean"]["o"]["fx"] == 40, str(stub.calls) + str(f2["clean"]["o"]))
    stub.adjuster = {"reply": "Gone.", "part": "cursor", "action": "remove"}
    f3 = R.follow("no cursor", f2["rich_state"], f2["clean"], [], pic, "", ch)
    check("follow: remove empties the part", f3["clean"]["m"] == "")
    for m in res["new"]:
        G.delete(m["id"])

    # 3. a part the Reviewer scores very low and a part the gate refuses are replaced by shipped effects; a duplicate title is renamed
    stub = Stub(lambda slot, look, n: 2 if slot == "cursor" else 8, bad_slot="color", dup_title=True)
    R.P.call = stub
    res = R.run("", {}, "", "", ch, rounds=1, surprise=True, save=False)
    got = {m["slot"] for m in res["new"]}
    fb = {f["slot"]: f for f in res["fell_back"]}
    check("fallback: cursor (score 2) and color (refused by the gate) are shipped effects", set(fb) == {"cursor", "color"} and not (got & {"cursor", "color"}), str(fb.keys()) + str(got))
    check("fallback: the replacements exist and the dialog is told", fb["color"]["used"] and not fb["color"]["used"].startswith("ai-") and not fb["cursor"]["used"].startswith("ai-") and
          sum("shipped" in n or "instead" in n for n in res["notes"]) >= 2, str(res["notes"]))
    check("fallback: the gate-refused Builder was asked 3 times", stub.build_n["color"] == 3, str(stub.build_n))
    check("surprise without a picture runs over a gradient", res["surprise"] and res["sheet"] and os.path.exists(res["sheet"]))
    check("a title the user already has is renamed", res["concept"]["title"] != "Koi Pond" and res["name"] != "Koi Pond", res["name"])
    for m in res["new"]:
        G.delete(m["id"])

    # 4. rounds 0 = no Reviewer; the estimate
    stub = Stub(lambda *a: 8)
    R.P.call = stub
    res = R.run("x", {}, pic, "", ch, rounds=0, save=False)
    check("rounds 0: no Reviewer call", "reviewer" not in stub.calls and res["rounds_done"] == 0 and all(m["score"] is None for m in res["new"]))
    for m in res["new"]:
        G.delete(m["id"])
    e = R.estimate("a harbour", pic, ch, L.catalog(), 2)
    check("estimate: tokens, cost and a one-line summary", e["tokens_in"] > 10000 and e["tokens_out"] > 4000 and e["cost_usd"] and e["summary"].startswith("Rich: about"), str(e))
    e0 = R.estimate("a harbour", pic, ch, L.catalog(), 0)
    check("estimate: fewer calls without the Reviewer", e0["calls"] < e["calls"])

    # 5. the chat integration
    import aichat
    R.P.call = Stub(lambda *a: 8)
    P.choice = lambda: ch
    out = aichat.turn("a quiet harbour", rich=True, wh="", current=False)  # no picture: the chat cannot find one, so this must be a plain refusal or a surprise run
    check("chat rich first turn returns the concept and the sheet", out["mode"] == "rich" and out["concept"]["title"] and out["sheet"], str(out)[:200])
    aichat.discard()
    check("chat discard removes the sheet folder", not os.path.exists(R.rich_dir()))


try:
    main()
finally:
    shutil.rmtree(TMP, ignore_errors=True)
print("airich selftest: %d ok, %d failed" % (OK, FAIL))
sys.exit(1 if FAIL else 0)
