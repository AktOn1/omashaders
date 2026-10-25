"""Self-test of bin/fx-guard with a stand-in 'shell' process that floods its log. Takes about 40 s. Run: python3 bin/fxguard_selftest.py"""
import sys
sys.dont_write_bytecode = True
import os
import subprocess
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
OK = FAIL = 0


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("FAIL %s %s" % (name, detail))


def child(code):
    return subprocess.Popen([sys.executable, "-c", code])


def start_guard(pid, log, state, restart=None):
    env = dict(os.environ)
    if restart:
        env["FX_GUARD_RESTART"] = restart
    return subprocess.Popen([sys.executable, os.path.join(HERE, "fx-guard"), str(pid), log, state], stdout=subprocess.PIPE, text=True, env=env)


def lines_within(p, seconds):
    import select
    out, end = [], time.time() + seconds
    while time.time() < end:
        r, _, _ = select.select([p.stdout], [], [], 0.3)
        if r:
            ln = p.stdout.readline()
            if not ln:
                break
            out.append(ln.strip())
    return out


def run():
    tmp = tempfile.mkdtemp(prefix="fxguard-test-")
    state = os.path.join(tmp, "state")
    os.makedirs(state)
    for n in ("wp-effect", "wp-effect2", "wp-preview", "mouse"):
        open(os.path.join(state, n), "w").write("some-effect\n")
    marker = os.path.join(tmp, "restarted")

    # 1. a quiet shell: no event
    log = os.path.join(tmp, "quiet.log")
    open(log, "w").write("hello\n")
    c = child("import time; time.sleep(6)")
    g = start_guard(c.pid, log, state)
    ev = lines_within(g, 4)
    check("a quiet shell raises no event", ev == [], str(ev))
    g.terminate(); c.kill(); c.wait()

    # 2. one driver error line: one trip, nothing else
    log = os.path.join(tmp, "one.log")
    open(log, "w").write("hello\n")
    c = child("import time; time.sleep(14)")
    g = start_guard(c.pid, log, state)
    time.sleep(1.2)
    with open(log, "a") as f:
        f.write("WARN scene: Failed to compile shader: 0(5) : error C7573\n")
    ev = lines_within(g, 12)
    check("a shader error line trips once", len(ev) == 1 and ev[0].startswith("trip"), str(ev))
    check("one error alone leaves the settings", open(os.path.join(state, "wp-effect")).read().strip() == "some-effect")
    g.terminate(); c.kill(); c.wait()

    # 3. a flood that does not stop: trip, then the settings are cleared, then the restart command runs
    log = os.path.join(tmp, "flood.log")
    open(log, "w").close()
    code = ("import time\nf=open(%r,'a')\ntime.sleep(1)\nf.write('x'*(25*1024*1024)); f.flush()\n"
            "while True:\n    f.write('y'*(3*1024*1024)); f.flush(); time.sleep(1)\n" % log)
    c = child(code)
    g = start_guard(c.pid, log, state, restart="touch " + marker)
    ev = lines_within(g, 4)
    check("a log flood trips", any(e.startswith("trip") for e in ev), str(ev))
    time.sleep(9)
    check("a flood that goes on clears the effect settings", all(open(os.path.join(state, n)).read().strip() == "" for n in ("wp-effect", "wp-effect2", "wp-preview", "mouse")))
    time.sleep(10)
    check("a flood that still goes on restarts the shell", os.path.exists(marker))
    check("the guard keeps its own log", "trip" in open(os.path.join(state, "guard.log")).read())
    g.terminate(); c.kill(); c.wait()

    # 3b. memory that grows fast (700 MB in 3.5 s, silent log) trips on its own
    log = os.path.join(tmp, "mem.log")
    open(log, "w").close()
    c = child("import time\nb=[]\ntime.sleep(1.5)\nfor i in range(14):\n    b.append(bytearray(b'z'*(50*1024*1024))); time.sleep(0.25)\ntime.sleep(8)")
    g = start_guard(c.pid, log, state)
    ev = lines_within(g, 9)
    check("fast memory growth trips", any(e.startswith("trip") and "memory" in e for e in ev), str(ev))
    g.terminate(); c.kill(); c.wait()

    # 4. the shell ends: the guard ends with it
    c = child("import time; time.sleep(1)")
    g = start_guard(c.pid, os.path.join(tmp, "quiet.log"), state)
    try:
        g.wait(timeout=6)
        check("the guard ends when the shell ends", True)
    except subprocess.TimeoutExpired:
        check("the guard ends when the shell ends", False)
        g.kill()
    print("fx-guard selftest: %d ok, %d failed" % (OK, FAIL))
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(run())
