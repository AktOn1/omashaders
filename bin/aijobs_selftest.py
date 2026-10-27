"""Offline self-test of the background theme jobs (bin/aijobs.py). A fake AI command stands in for the AI; everything runs in a scratch state
folder and a scratch notify command, nothing touches the real state or desktop. It proves: the job survives the process that started it,
the finished theme waits as a draft (not in the list) until saved, a killed runner shows as interrupted and can be retried, cancel only
happens through `job cancel` and kills the whole run, two jobs at most, the draft can be changed, chosen parts can be regenerated and a saved theme opened, saved in place or as new, and the form is restored.
Run: python3 bin/aijobs_selftest.py   (also part of: python3 bin/ai-theme selftest)"""
import sys
sys.dont_write_bytecode = True
import glob
import json
import os
import shutil
import signal
import subprocess
import tempfile
import time

HERE = os.path.dirname(os.path.realpath(__file__))
TMP = tempfile.mkdtemp(prefix="omashaders-jobs-selftest-")
STATE = os.path.join(TMP, "state")
os.makedirs(STATE)
os.environ["OMASHADERS_STATE_DIR"] = STATE
sys.path.insert(0, HERE)
import omslib as L  # noqa: E402
import aijobs as J  # noqa: E402

OK = FAIL = 0


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("FAIL %s %s" % (name, detail))


def setup():
    cat = L.catalog()
    first = {k: next(iter(cat[k])) for k in ("screen", "color", "mouse", "frame")}
    light = sorted(L.overlay_ids() & set(cat["wall"]))
    fake = os.path.join(TMP, "fake-ai")
    with open(fake, "w") as f:
        f.write("#!/bin/sh\ncat >/dev/null\necho $$ >> '%s/pids'\nsleep \"$(cat '%s/delay' 2>/dev/null || echo 0)\"\n" % (TMP, TMP))
        f.write("echo '{\"name\":\"Fake Night\",\"screen\":\"%s\",\"color\":\"%s\",\"wallpaper\":\"%s\",\"cursor\":\"\",\"window\":\"\",\"window_color\":\"\",\"frame\":\"%s\","
                "\"strength\":{\"wallpaper\":60},\"idea\":\"a test idea\",\"note\":\"fine\"}'\n" % (first["screen"], first["color"], light[0], first["frame"]))
    os.chmod(fake, 0o755)
    notify = os.path.join(TMP, "fake-notify")
    with open(notify, "w") as f:
        f.write("#!/bin/sh\necho \"$1 | $2\" >> '%s/notes'\n" % TMP)
    os.chmod(notify, 0o755)
    return fake, notify


def delay(sec):
    open(os.path.join(TMP, "delay"), "w").write(str(sec))


def cli(*a, env=None):
    r = subprocess.run([sys.executable, os.path.join(HERE, "ai-theme"), "job"] + list(a) + ["--json"], capture_output=True, text=True, env=env or ENV, timeout=60)
    try:
        return json.loads(r.stdout), r
    except ValueError:
        return {"ok": False, "error": "no json: " + r.stdout[:200] + r.stderr[:300]}, r


def wait(jid, states, secs=40):
    end = time.time() + secs
    j = {}
    while time.time() < end:
        res, _ = cli("show", jid)
        j = res.get("job", {})
        if j.get("state") in states:
            return j
        time.sleep(0.3)
    return j


def pids_alive(pattern):
    return subprocess.run(["pgrep", "-f", pattern], capture_output=True, text=True).stdout.split()


def themes():
    try:
        return open(os.path.join(STATE, "themes")).read()
    except OSError:
        return ""


def scenarios(label):
    delay(2)
    res, r = cli("start", "a test night")
    check(label + ": start returns a running job", res.get("ok") and res["job"]["state"] in ("starting", "running"), r.stdout + r.stderr)
    jid = res["job"]["id"]
    # the starter process is gone already (it exited); the job is not tied to it
    j = wait(jid, ("running",), 10)
    check(label + ": the job is running without the starter", j.get("state") == "running" and J.alive(j), str(j)[:300])
    check(label + ": progress text is stored", bool(j.get("progress")) and j.get("steps_total", 0) >= 1, str(j)[:300])
    j = wait(jid, ("done", "failed"), 60)
    check(label + ": the job finished by itself as a draft", j.get("state") == "done" and j.get("name") == "Fake Night", str(j)[:400])
    check(label + ": the draft is not in the themes list yet", "Fake Night" not in themes())
    notes = open(os.path.join(TMP, "notes")).read() if os.path.exists(os.path.join(TMP, "notes")) else ""
    check(label + ": a desktop notification said where to find it", "Fake Night" in notes and "Themes" in notes, notes[-200:])
    listing = cli("list")[0]
    check(label + ": list shows the draft", any(x["id"] == jid and x["has_result"] for x in listing.get("jobs", [])))
    # change the draft (a second turn in the same job)
    res, r = cli("change", jid, "less fog")
    check(label + ": a change starts on the draft", res.get("ok"), r.stdout + r.stderr)
    j = wait(jid, ("done", "failed"), 60)
    check(label + ": the change finished (turn 2)", j.get("state") == "done" and j.get("turn") == 2, str(j)[:300])
    res, _ = cli("save", jid)
    check(label + ": save puts the theme in the list", res.get("ok") and "Fake Night" in themes(), str(res)[:200])
    check(label + ": a saved job is gone", not os.path.exists(os.path.join(STATE, "jobs", jid)))
    shutil.rmtree(os.path.join(STATE, "generated"), ignore_errors=True)
    open(os.path.join(STATE, "themes"), "w").close()

    # a killed runner: interrupted, then retry
    delay(31.7)
    res, _ = cli("start", "a killed night")
    jid = res["job"]["id"]
    j = wait(jid, ("running",), 10)
    pid = j.get("pid", 0)
    check(label + ": the runner has a pid of its own", pid > 0 and J.alive(j), str(j)[:200])
    time.sleep(1.0)
    try:
        os.killpg(os.getpgid(pid), signal.SIGKILL)
    except OSError:
        pass
    if j.get("scope"):
        subprocess.run(["systemctl", "--user", "stop", j["scope"]], capture_output=True)
    time.sleep(0.5)
    j = wait(jid, ("interrupted",), 10)
    check(label + ": a killed job shows as interrupted", j.get("state") == "interrupted" and not j.get("has_result") and j.get("error"), str(j)[:300])
    check(label + ": its fake AI died with it", not pids_alive("sleep 31.7"))
    delay(0)
    res, r = cli("retry", jid)
    j = wait(jid, ("done", "failed"), 60)
    check(label + ": retry runs it again and it finishes", res.get("ok") and j.get("state") == "done", str(j)[:300] + r.stderr[-200:])
    res, _ = cli("discard", jid)
    check(label + ": discard removes the draft and its folder", res.get("ok") and not os.path.exists(os.path.join(STATE, "jobs", jid)) and "Fake Night" not in themes())

    # cancel: only through job cancel; two jobs at most
    delay(31.7)
    a, _ = cli("start", "first slow")
    b, _ = cli("start", "second slow")
    c, _ = cli("start", "third slow")
    check(label + ": two jobs run at once", a.get("ok") and b.get("ok"))
    check(label + ": a third one is refused with a plain message", not c.get("ok") and "already being made" in c.get("error", ""), str(c)[:200])
    ja, jb = a["job"]["id"], b["job"]["id"]
    wait(ja, ("running",), 10)
    wait(jb, ("running",), 10)
    time.sleep(1)
    for jid in (ja, jb):  # the dialog dying or being closed is no cancel: the starter is long gone and the jobs run on
        check(label + ": %s still runs" % jid[-4:], J.alive(J.get(jid)))
    res, _ = cli("cancel", ja)
    check(label + ": cancel stops that job", res.get("ok") and res["job"]["state"] == "cancelled", str(res)[:200])
    check(label + ": the other job is not touched", J.alive(J.get(jb)))
    check(label + ": one fake AI is left running", len(pids_alive("sleep 31.7")) == 1, str(pids_alive("sleep 31.7")))
    res, _ = cli("cancel", jb)
    time.sleep(0.5)
    check(label + ": cancel kills the whole run (the AI child too)", res.get("ok") and not pids_alive("sleep 31.7"), str(pids_alive("sleep 31.7")))
    res, _ = cli("cancel", jb)
    check(label + ": cancelling a finished job is a plain error", not res.get("ok"))
    for jid in (ja, jb):
        cli("dismiss", jid)
    delay(0)
    regen_scenarios(label)


def regen_scenarios(label):
    """open a saved theme as a job, regenerate chosen parts in the background, go back, save in place / as new; a built-in theme is never overwritten"""
    cat = L.catalog()
    pick = {k: next(iter(cat[k])) for k in ("screen", "color")}   # what the fake AI answers
    ids = {k: sorted(v for v in cat[k] if v != pick.get(k))[-1] for k in ("screen", "color", "mouse", "frame")}
    light = sorted(L.overlay_ids() & set(cat["wall"]))
    own = {"n": "Mine", "s": ids["screen"], "c": ids["color"], "w": light[-1], "m": ids["mouse"], "wf": "", "wc": "", "wr": ids["frame"], "o": {"fx": 55, "col": 66, "wall": 44, "cur": 77}}
    own_line = L.theme_line(own)
    builtin = [l for l in open(L.STARTER, encoding="utf-8").read().split("\n") if l.strip()][0]
    shutil.rmtree(os.path.join(STATE, "generated"), ignore_errors=True)
    with open(os.path.join(STATE, "themes"), "w") as f:
        f.write(builtin + "\n" + own_line + "\n")
    res, r = cli("load", "2")
    jid = res.get("job", {}).get("id", "")
    j = res.get("job", {})
    check(label + ": load opens a saved theme as a finished draft without an AI call", res.get("ok") and j.get("state") == "done" and j.get("has_result") and j["result"].get("loaded") and j["result"]["origin"]["number"] == 2, r.stdout[:300] + r.stderr[-200:])
    check(label + ": the loaded draft is not a new line in the list", len(themes().split()) == 2)
    delay(2)
    res, r = cli("regen", jid, "screen,color", "colder please")
    check(label + ": regen starts a background job on the draft", res.get("ok") and res["job"]["state"] in ("starting", "running"), r.stdout[:300] + r.stderr[-200:])
    j = wait(jid, ("running",), 10)
    check(label + ": the regenerate runs without the starter", j.get("state") == "running" and J.alive(j) and j.get("steps_total", 0) >= 2, str(j)[:300])
    j = wait(jid, ("done", "failed"), 60)
    n = L.parse_line(j["result"]["line"]) if j.get("result") else {}
    check(label + ": the regenerate finished and changed only the chosen parts", j.get("state") == "done" and n.get("s") == pick["screen"] and n.get("c") == pick["color"]
          and n.get("w") == own["w"] and n.get("m") == own["m"] and n.get("wr") == own["wr"] and n["o"].get("wall") == 44 and n["o"].get("cur") == 77, str(j)[:500])
    check(label + ": the history says what was regenerated", any("Regenerate: Screen, Color" in h.get("text", "") for h in j.get("history", [])), str(j.get("history"))[:300])
    delay(0)
    res, r = cli("regen-undo", jid, "screen")
    n = L.parse_line(res["job"]["result"]["line"]) if res.get("ok") else {}
    check(label + ": regen-undo brings back the earlier screen and keeps the colour", n.get("s") == own["s"] and n.get("c") == pick["color"] and n["o"].get("fx") == 55, r.stdout[:300])
    res, r = cli("regen", jid, "screen")
    j = wait(jid, ("done", "failed"), 60)
    check(label + ": a second regenerate works on the same job", j.get("state") == "done" and L.parse_line(j["result"]["line"])["s"] == pick["screen"], str(j)[:300])
    res, r = cli("save", jid, "--replace")
    have = themes().split("\n")
    check(label + ": save --replace rewrites the opened theme in place", res.get("ok") and res.get("replaced") and len([x for x in have if x]) == 2 and have[0] == builtin and L.parse_line(have[1])["s"] == pick["screen"] and L.parse_line(have[1])["n"] == "Mine", r.stdout[:200] + themes())
    check(label + ": a saved job is gone", not os.path.exists(os.path.join(STATE, "jobs", jid)))
    # as a new theme
    with open(os.path.join(STATE, "themes"), "w") as f:
        f.write(builtin + "\n" + own_line + "\n")
    res, _ = cli("load", "2")
    jid = res["job"]["id"]
    cli("regen", jid, "color")
    wait(jid, ("done", "failed"), 60)
    res, r = cli("save", jid)
    have = [x for x in themes().split("\n") if x]
    check(label + ": save without --replace adds a new theme and leaves the original", res.get("ok") and len(have) == 3 and "(edited)" in L.parse_line(have[2])["n"], r.stdout[:200] + themes())
    # built-in
    res, _ = cli("load", "1")
    jid = res["job"]["id"]
    check(label + ": a built-in theme opens as flagged built-in", res["job"]["result"]["origin"]["builtin"])
    cli("regen", jid, "screen")
    wait(jid, ("done", "failed"), 60)
    before = themes()
    res, r = cli("save", jid, "--replace")
    check(label + ": a built-in theme cannot be saved in place; nothing changed and the draft stays", not res.get("ok") and themes() == before and os.path.isdir(os.path.join(STATE, "jobs", jid)), r.stdout[:300])
    res, _ = cli("discard", jid)
    check(label + ": discard leaves the list as it was and no stray generated effect", res.get("ok") and themes() == before and not glob.glob(os.path.join(STATE, "generated", "*")))
    open(os.path.join(STATE, "themes"), "w").close()


def main():
    global ENV
    fake, notify = setup()
    ENV = dict(os.environ, OMASHADERS_AI_CMD=fake, OMASHADERS_NOTIFY_CMD=notify)
    ENV.pop("OMASHADERS_CHAT_DIR", None)
    try:
        res, _ = cli("form", "set", json.dumps({"text": "a rainy neon night", "mode": "rich", "rounds": 1}))
        res, _ = cli("form")
        check("form: the typed prompt and mode come back", res.get("text") == "a rainy neon night" and res.get("mode") == "rich" and res.get("rounds") == 1, str(res))
        check("job ids are checked", not cli("show", "../../etc")[0].get("ok"))
        saved = dict(ENV)
        ENV["OMASHADERS_JOBS_NO_SCOPE"] = "1"
        scenarios("setsid")
        if J.scope_ok():
            ENV = saved
            scenarios("scope")
        else:
            print("info: no user bus here, the systemd-run scope variant was not tested")
    finally:
        for p in pids_alive(TMP):
            try:
                os.kill(int(p), signal.SIGKILL)
            except OSError:
                pass
        shutil.rmtree(TMP, ignore_errors=True)
    print("aijobs selftest: %d ok, %d failed" % (OK, FAIL))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
