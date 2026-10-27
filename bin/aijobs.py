#!/usr/bin/env python3
"""aijobs: the AI theme creator as background jobs (bin/ai-theme job ...).

A job is one theme chat that runs detached from the dialog, the menu and the shell: closing or reloading any of them does not stop it.
Each job has its own folder <state>/jobs/<id>/ with

  job.json   id, state, mode, request, started, step, progress text, pid, form, the finished result (the draft) or the error
  chat.json  the chat session of this job (OMASHADERS_CHAT_DIR points aichat.py / airich.py here, so jobs never share files)
  rich/      its contact sheets
  runner.log what the runner printed

States: starting, running, done (a draft waits: Save / Discard / Change), failed, interrupted (the runner died: shell kill, reboot, OOM;
Retry), cancelled. The runner is `ai-theme job _run ID`, started with `systemd-run --user --scope` (its own cgroup, so a shell restart
does not take it along; plain setsid when there is no user bus). It runs `ai-theme chat turn ... --json` as its child, reads the
PROGRESS lines and is the only writer of job.json while the job runs. A draft is only a draft: it is added to the themes list by
`job save` (= chat keep) and the effects it generated are deleted by `job discard`.

  aijobs.py list [--json] | show ID [--json] | cancel ID | save ID [--name N] [--replace] | discard ID | dismiss ID | form [get|set JSON]
            | regen-undo ID SLOTS
  (start / change / regen / load / retry are in bin/ai-theme, they need its argument parser)

Regenerate (v1.50.0): `job regen ID SLOTS [direction]` is one more run on a finished draft, like `change`, but only the chosen parts are made again
(the child is `chat regen`; the rest of the theme stays as it was). `job load N|current` opens a saved theme as a draft (no AI call, the job is
"done" at once) so it can be regenerated, changed, and saved: `save ID --replace` rewrites that theme's own line, without it the draft is a new theme.
`job regen-undo ID SLOTS` takes back the last regenerated version of those parts (no AI call).
"""
import sys
sys.dont_write_bytecode = True
import fcntl
import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import time

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import omslib as L  # noqa: E402

MAX_JOBS = 2              # running at once
LIVE = ("starting", "running")
ID_RE = re.compile(r"j[0-9]{6}-[0-9]{6}-[0-9a-f]{4}")
STEPS = {"pick": 2, "invent": 4, "rich": 6}  # typical number of PROGRESS lines; only a guess for "step 3/8", it grows when a run needs more
KEEP_CANCELLED = 3600


def jobs_dir():
    return os.path.join(L.STATE, "jobs")


def job_dir(jid):
    if not ID_RE.fullmatch(jid or ""):
        raise L.Bad("That is not a job id")
    return os.path.join(jobs_dir(), jid)


def now():
    return int(time.time())


# ------------------------------------------------------------------ is the runner alive?
def boot_id():
    try:
        return open("/proc/sys/kernel/random/boot_id").read().strip()
    except OSError:
        return ""


def start_ticks(pid):
    try:
        return int(open("/proc/%d/stat" % pid).read().rsplit(")", 1)[1].split()[19])
    except (OSError, ValueError, IndexError):
        return 0


def alive(job):
    pid = job.get("pid") or 0
    if not pid or job.get("boot") != boot_id():
        return False
    t = start_ticks(pid)
    return bool(t) and t == job.get("ticks")


# ------------------------------------------------------------------ the job file
def read(jid):
    try:
        d = json.load(open(os.path.join(job_dir(jid), "job.json")))
        return d if isinstance(d, dict) and d.get("v") == 1 else None
    except (OSError, ValueError):
        return None


class Lock:
    def __init__(self, jid):
        os.makedirs(job_dir(jid), exist_ok=True)
        self.f = open(os.path.join(job_dir(jid), ".lock"), "w")

    def __enter__(self):
        fcntl.flock(self.f, fcntl.LOCK_EX)
        return self

    def __exit__(self, *a):
        self.f.close()


def write(jid, job):
    p = os.path.join(job_dir(jid), "job.json")
    with open(p + ".tmp", "w") as f:
        json.dump(job, f)
    os.replace(p + ".tmp", p)


def update(jid, **kw):
    """read-change-write under the job's lock; returns the new job (None if it is gone)"""
    with Lock(jid):
        job = read(jid)
        if job is None:
            return None
        job.update(kw)
        job["updated"] = now()
        write(jid, job)
        return job


def view(job):
    """the job as the dialog and the CLI show it: the stored fields plus what is computed now"""
    j = dict(job)
    st = j.get("state")
    if st in LIVE and not alive(j) and now() - (j.get("started") or 0) > 3:
        j["state"] = "interrupted"
    j["alive"] = j["state"] in LIVE
    end = j.get("finished") if j["state"] not in LIVE and j.get("finished") else now()
    j["elapsed"] = max(0, end - (j.get("run_started") or j.get("started") or end))
    j["steps_total"] = max(j.get("steps_total") or 0, (j.get("step") or 0) + 1) if j["alive"] else j.get("steps_total", 0)
    j["name"] = ((j.get("result") or {}).get("name")) or ""
    j["has_result"] = bool(j.get("result"))
    return j


def settle(jid):
    """a job whose runner died while it said running becomes interrupted (once, under the lock so a runner that just finished wins)"""
    with Lock(jid):
        job = read(jid)
        if job is None:
            return None
        if job.get("state") in LIVE and not alive(job) and now() - (job.get("started") or 0) > 3:
            job.update(state="interrupted", finished=now(), updated=now(),
                       error="It stopped before it finished (the computer or the shell was restarted, or it was killed).")
            write(jid, job)
        return job


def ids():
    d = jobs_dir()
    try:
        return sorted(x for x in os.listdir(d) if ID_RE.fullmatch(x) and os.path.isdir(os.path.join(d, x)))
    except OSError:
        return []


def listing():
    out = []
    for jid in ids():
        job = settle(jid)
        if job is None:
            continue
        if job.get("state") == "cancelled" and now() - (job.get("finished") or 0) > KEEP_CANCELLED:
            shutil.rmtree(job_dir(jid), ignore_errors=True)
            continue
        out.append(view(job))
    return out


def get(jid):
    job = settle(jid)
    if job is None:
        raise L.Bad("There is no job %s (it was saved, discarded or dismissed)" % jid)
    return view(job)


# ------------------------------------------------------------------ the form the dialog restores
def form_get():
    try:
        d = json.load(open(os.path.join(jobs_dir(), "form.json")))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def form_set(d):
    if not isinstance(d, dict):
        raise L.Bad("The form must be a JSON object")
    s = json.dumps(d)
    if len(s) > 8000:
        raise L.Bad("The form is too big")
    os.makedirs(jobs_dir(), exist_ok=True)
    p = os.path.join(jobs_dir(), "form.json")
    with open(p + ".tmp", "w") as f:
        f.write(s)
    os.replace(p + ".tmp", p)
    return {"ok": True}


# ------------------------------------------------------------------ starting
def new_id():
    return "j%s-%04x" % (time.strftime("%y%m%d-%H%M%S"), int.from_bytes(os.urandom(2), "big"))


def estimate_steps(mode, argv, follow, verb="turn"):
    if verb == "regen":
        try:
            import airegen
            n = len(airegen.parse_slots(argv[0] if argv else ""))
        except (L.Bad, ImportError):
            n = 1
        if mode == "rich":
            try:
                r = int(argv[argv.index("--rounds") + 1]) if "--rounds" in argv else 2
            except (ValueError, IndexError):
                r = 2
            return 2 + n + 2 * max(0, min(3, r))
        return 2 + (n if mode == "invent" else 0)
    n = STEPS.get(mode, 3)
    if mode == "rich":
        try:
            r = int(argv[argv.index("--rounds") + 1]) if "--rounds" in argv else 2
        except (ValueError, IndexError):
            r = 2
        n += 3 * max(0, min(3, r))
    if "--sprites" in argv and not follow:
        n += 9   # eight painted sprites and the check after them
    return max(2, n // 2) if follow else n


def live_count():
    return sum(1 for j in listing() if j["state"] in LIVE)


def start(request, mode, argv, form=None, est=""):
    """a new job running a first chat turn; argv are the `chat turn` flags (without --new and --json)"""
    if live_count() >= MAX_JOBS:
        raise L.Bad("%d themes are already being made. Wait for one to finish, or cancel one." % MAX_JOBS)
    jid = new_id()
    job = {"v": 1, "id": jid, "state": "starting", "mode": mode, "request": request[:400], "started": now(), "run_started": now(), "updated": now(), "finished": 0,
           "step": 0, "steps_total": estimate_steps(mode, argv, False), "progress": "Starting…", "pid": 0, "boot": "", "ticks": 0, "scope": "",
           "form": form or {}, "est": est, "turn": 0, "history": [], "run": {"argv": list(argv), "new": True, "message": request}, "result": None, "error": ""}
    with Lock(jid):
        write(jid, job)
    if form:
        form_set(form)
    spawn(jid)
    return view(read(jid))


def change(jid, message, est=""):
    """one more chat turn on a finished draft"""
    job = settle(jid)
    if job is None:
        raise L.Bad("There is no job %s" % jid)
    if job["state"] in LIVE:
        raise L.Bad("That theme is still being made")
    if not job.get("result"):
        raise L.Bad("There is no draft to change; use retry")
    message = " ".join(str(message or "").split())[:400]
    if not message:
        raise L.Bad("Say what to change, for example: less fog")
    if live_count() >= MAX_JOBS:
        raise L.Bad("%d themes are already being made. Wait for one to finish, or cancel one." % MAX_JOBS)
    update(jid, state="starting", started=now(), run_started=now(), finished=0, step=0, steps_total=estimate_steps(job["mode"], job["run"]["argv"], True),
           progress="Starting…", error="", est=est or job.get("est", ""), run={"argv": [message], "new": False, "message": message}, pid=0, ticks=0)
    spawn(jid)
    return view(read(jid))


def regen(jid, slots_text, direction="", rounds=None, est=""):
    """make the chosen parts of the draft again (a different take); everything else stays. Runs in the background like a change."""
    import airegen
    job = settle(jid)
    if job is None:
        raise L.Bad("There is no job %s" % jid)
    if job["state"] in LIVE:
        raise L.Bad("That theme is still being made")
    if not job.get("result"):
        raise L.Bad("There is no draft to regenerate; use retry")
    slots = airegen.parse_slots(slots_text)
    direction = airegen.direction_text(direction)
    argv = [",".join(slots)] + ([direction] if direction else []) + (["--rounds", str(int(rounds))] if rounds is not None else [])
    if live_count() >= MAX_JOBS:
        raise L.Bad("%d themes are already being made. Wait for one to finish, or cancel one." % MAX_JOBS)
    words = "Regenerate: " + airegen.label_of(slots) + ((" (" + direction + ")") if direction else "")
    update(jid, state="starting", started=now(), run_started=now(), finished=0, step=0, steps_total=estimate_steps(job["mode"], argv, True, "regen"),
           progress="Starting…", error="", est=est or job.get("est", ""), run={"verb": "regen", "argv": argv, "new": False, "message": words}, pid=0, ticks=0)
    spawn(jid)
    return view(read(jid))


def load(which="", line="", mode="pick"):
    """open a saved theme (or the look on now) as a draft: no AI call, the job is done at once"""
    if mode not in STEPS:
        raise L.Bad("Unknown mode %r" % mode)
    jid = new_id()
    with Lock(jid):
        pass
    try:
        ai = with_chat(jid)
        res = ai.load_theme(which, line, invent=(mode == "invent"), rich=(mode == "rich"))
    except Exception:
        shutil.rmtree(job_dir(jid), ignore_errors=True)
        raise
    job = {"v": 1, "id": jid, "state": "done", "mode": mode, "request": ("Edit: " + res["name"])[:400], "started": now(), "run_started": now(), "updated": now(), "finished": now(),
           "step": 1, "steps_total": 1, "progress": "Done", "pid": 0, "boot": "", "ticks": 0, "scope": "", "form": {}, "est": "", "turn": 0, "history": [],
           "run": {"argv": [], "new": False, "message": ""}, "result": res, "error": "", "loaded": True}
    with Lock(jid):
        write(jid, job)
    return view(read(jid))


def regen_undo(jid, slots_text):
    """take back the last regenerated version of the chosen parts (no AI call)"""
    job = get(jid)
    if job["state"] in LIVE:
        raise L.Bad("That theme is still being made")
    if not job["has_result"]:
        raise L.Bad("There is no draft")
    res = with_chat(jid).regen_undo(slots_text)
    hist = list(job.get("history") or [])
    hist += [{"role": "user", "text": "Previous: " + res.get("reply", "").split(": ", 1)[-1].rstrip("."), "changes": []},
             {"role": "ai", "text": res.get("reply") or "Went back to the earlier version.", "changes": list(res.get("changes") or [])}]
    update(jid, result=res, history=hist, turn=res.get("turn", job.get("turn", 0)))
    return view(read(jid))


def retry(jid):
    """run the last request again (a failed or interrupted job)"""
    job = get(jid)
    if job["state"] in LIVE:
        raise L.Bad("That theme is still being made")
    if live_count() >= MAX_JOBS:
        raise L.Bad("%d themes are already being made. Wait for one to finish, or cancel one." % MAX_JOBS)
    run = job["run"]
    update(jid, state="starting", started=now(), run_started=now(), finished=0, step=0, steps_total=estimate_steps(job["mode"], run["argv"], not run["new"], run.get("verb", "turn")),
           progress="Starting…", error="", pid=0, ticks=0)
    spawn(jid)
    return view(read(jid))


def ai_theme_path():
    return os.path.join(L.HERE, "ai-theme")


def scope_ok():
    rt = os.environ.get("XDG_RUNTIME_DIR") or ""
    return bool(shutil.which("systemd-run")) and bool(rt) and os.path.exists(os.path.join(rt, "bus")) and not os.environ.get("OMASHADERS_JOBS_NO_SCOPE")


def spawn(jid):
    """start the runner detached: systemd-run --user --scope when there is a user bus, else plain setsid"""
    d = job_dir(jid)
    env = dict(os.environ, OMASHADERS_CHAT_DIR=d)
    cmd = [sys.executable, ai_theme_path(), "job", "_run", jid]
    log = open(os.path.join(d, "runner.log"), "ab")
    variants = ([True] if scope_ok() else []) + [False]
    for scoped in variants:
        unit = "omashaders-job-" + jid
        argv = (["systemd-run", "--user", "--scope", "--quiet", "--collect", "--unit=" + unit, "--description=OmaShaders theme creator"] if scoped else []) + cmd
        p = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=log, stderr=log, env=env, start_new_session=True, close_fds=True)
        update(jid, pid=p.pid, boot=boot_id(), ticks=start_ticks(p.pid), scope=(unit + ".scope") if scoped else "")
        end = time.time() + 4
        while time.time() < end:
            time.sleep(0.05)
            job = read(jid) or {}
            if job.get("state") == "running":
                return
            if p.poll() is not None:
                break
        if p.poll() is None:
            return
        job = read(jid) or {}
        if job.get("state") not in ("starting", "running"):
            return
    tail = ""
    try:
        tail = open(os.path.join(d, "runner.log"), errors="replace").read()[-300:].strip()
    except OSError:
        pass
    update(jid, state="failed", finished=now(), error="The background runner did not start. " + tail)


# ------------------------------------------------------------------ the runner (ai-theme job _run ID)
def pdeathsig():
    import ctypes
    ctypes.CDLL("libc.so.6", use_errno=True).prctl(1, signal.SIGKILL)  # PR_SET_PDEATHSIG: the turn dies with its runner


def notify(title, body):
    cmd = shlex.split(os.environ.get("OMASHADERS_NOTIFY_CMD") or "notify-send -a OmaShaders -i applications-graphics")
    try:
        subprocess.run(cmd + [title, body], timeout=8, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        pass


def run(jid):
    job = read(jid)
    if job is None:
        return 1
    d = job_dir(jid)
    run_ = job["run"]
    update(jid, state="running", pid=os.getpid(), boot=boot_id(), ticks=start_ticks(os.getpid()))
    verb = run_.get("verb", "turn")
    cmd = [sys.executable, ai_theme_path(), "chat", verb] + list(run_["argv"]) + (["--new"] if run_.get("new") else []) + ["--json"]
    child = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors="replace",
                             env=dict(os.environ, OMASHADERS_CHAT_DIR=d), preexec_fn=pdeathsig)

    def stop(*_):
        try:
            child.terminate()
        except OSError:
            pass
        os._exit(143)  # a stop (cancel, shutdown) leaves the state as it was: nobody reports success for a killed job
    signal.signal(signal.SIGTERM, stop)
    import threading
    out = []
    threading.Thread(target=lambda: out.append(child.stdout.read()), daemon=True).start()
    tail = []
    step = 0
    for line in child.stderr:
        line = line.rstrip("\n")
        if line.startswith("PROGRESS "):
            step += 1
            update(jid, step=step, progress=line[9:][:200])
        elif line.strip():
            tail = (tail + [line])[-6:]
    child.wait()
    time.sleep(0.05)
    text = "".join(out).strip().splitlines()
    res = {}
    for ln in reversed(text):
        try:
            res = json.loads(ln)
            break
        except ValueError:
            continue
    if os.path.exists(os.path.join(d, "cancel")):
        return 0
    cur = read(jid) or {}
    if child.returncode == 0 and res.get("ok"):
        hist = list(cur.get("history") or [])
        words = run_.get("message") or ("Surprise me" if "--surprise" in run_["argv"] else "(design it from the picture)")
        changes = list(res.get("changes") or []) + ["Made by the AI, passed the safety check: %s “%s”" % (m.get("title", ""), m.get("name", "")) for m in res.get("new") or []]
        hist += [{"role": "user", "text": words, "changes": []}, {"role": "ai", "text": res.get("reply") or res.get("note") or "Done.", "changes": changes}]
        update(jid, state="done", finished=now(), result=res, history=hist, turn=res.get("turn", cur.get("turn", 0) + 1), progress="Done", error="", step=max(step, 1),
               steps_total=max(cur.get("steps_total", 0), step))
        name = res.get("name") or "Your theme"
        if res.get("only"):
            notify("OmaShaders: your effect is ready", "“%s” is ready. Open OmaShaders to keep, change or discard it." % name)
        else:
            notify("OmaShaders: your theme is ready", "“%s” is ready. Open OmaShaders, Themes, to save, change or discard it." % name)
    else:
        msg = (res.get("error") or " ".join(tail) or "The AI run failed").strip()[:400]
        update(jid, state="failed", finished=now(), error=msg, progress="Failed")
        notify("OmaShaders: the theme did not work out", "%s Open OmaShaders, Themes, to try again." % msg[:160])
    return 0


# ------------------------------------------------------------------ cancel, save, discard
def kill_job(job):
    """stop the runner and everything it started (scope stop, else the process group), then wait until it is gone"""
    pid = job.get("pid") or 0
    if job.get("scope"):
        subprocess.run(["systemctl", "--user", "stop", job["scope"]], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
    for sig, wait in ((signal.SIGTERM, 3.0), (signal.SIGKILL, 3.0)):
        if not alive(job):
            break
        try:
            os.killpg(os.getpgid(pid), sig)
        except OSError:
            pass
        end = time.time() + wait
        while alive(job) and time.time() < end:
            time.sleep(0.05)
    return not alive(job)


def cancel(jid):
    """the explicit cancel: stop the run. A first turn leaves nothing; a Change turn leaves the draft as it was before"""
    job = settle(jid)
    if job is None:
        raise L.Bad("There is no job %s" % jid)
    if job["state"] not in LIVE:
        raise L.Bad("That job is not running (it is %s)" % job["state"])
    open(os.path.join(job_dir(jid), "cancel"), "w").close()
    if not kill_job(job):
        os.remove(os.path.join(job_dir(jid), "cancel"))
        raise L.Bad("I could not stop that job")
    with Lock(jid):
        cur = read(jid) or job
        if cur.get("result"):
            cur.update(state="done", finished=now(), error="The change was cancelled.", progress="Done", updated=now())
        else:
            cur.update(state="cancelled", finished=now(), error="", progress="Cancelled", updated=now())
        write(jid, cur)
        try:
            os.remove(os.path.join(job_dir(jid), "cancel"))
        except OSError:
            pass
    return view(read(jid))


def with_chat(jid):
    """run aichat against this job's own session folder"""
    os.environ["OMASHADERS_CHAT_DIR"] = job_dir(jid)
    import aichat
    return aichat


def save(jid, name="", replace=False):
    job = get(jid)
    if job["state"] in LIVE:
        raise L.Bad("That theme is still being made")
    if not job["has_result"]:
        raise L.Bad("There is no theme to save yet")
    res = with_chat(jid).keep(name, replace=replace)
    shutil.rmtree(job_dir(jid), ignore_errors=True)
    return res


def discard(jid):
    job = get(jid)
    if job["state"] in LIVE:
        raise L.Bad("That theme is still being made; cancel the job first")
    res = with_chat(jid).discard()
    shutil.rmtree(job_dir(jid), ignore_errors=True)
    return res


def dismiss(jid):
    """remove a failed, interrupted or cancelled job (it has no draft); a job with a draft must be saved or discarded"""
    job = get(jid)
    if job["state"] in LIVE:
        raise L.Bad("That theme is still being made; cancel the job first")
    if job["has_result"]:
        raise L.Bad("That job has a draft: save it or discard it")
    shutil.rmtree(job_dir(jid), ignore_errors=True)
    return {"ok": True}


# ------------------------------------------------------------------ text for people
def clock(s):
    return "%d:%02d" % (s // 60, s % 60)


def line(j):
    st = j["state"]
    what = {"starting": "starting", "running": "step %d/%d, %s" % (j["step"], j["steps_total"], clock(j["elapsed"])), "done": "ready to review",
            "failed": "failed", "interrupted": "interrupted", "cancelled": "cancelled"}.get(st, st)
    if st == "running":
        what += ", " + j.get("progress", "")
    return "%s  %-11s %-6s %s  %s" % (j["id"], st, j["mode"], (j.get("name") or j["request"] or "(surprise)")[:40], what)


def show_text(j):
    out = ["job %s: %s (%s)" % (j["id"], j["state"], j["mode"]), "request: %s" % (j["request"] or "(surprise)")]
    if j["state"] in LIVE:
        out.append("step %d/%d, running %s, now: %s" % (j["step"], j["steps_total"], clock(j["elapsed"]), j.get("progress", "")))
    if j.get("est"):
        out.append("estimate: %s" % j["est"])
    if j["has_result"]:
        r = j["result"]
        out.append("draft: %s (turn %s), %s" % (r.get("name", ""), r.get("turn", ""), (r.get("reply") or "")[:200]))
    if j.get("error"):
        out.append("note: %s" % j["error"])
    return "\n".join(out)


def main(a):
    if not a or a[0] in ("-h", "--help", "help"):
        print(__doc__.strip())
        return 0
    js = "--json" in a
    rest = [x for x in a[1:] if x != "--json"]
    try:
        sub = a[0]
        if sub == "list":
            lst = listing()
            if js:
                print(json.dumps({"ok": True, "jobs": lst, "form": form_get(), "max": MAX_JOBS}))
            else:
                print("\n".join(line(j) for j in lst) if lst else "no jobs")
            return 0
        if sub == "form":
            if rest[:1] == ["set"]:
                print(json.dumps(form_set(json.loads(rest[1] if len(rest) > 1 else "{}"))))
            else:
                print(json.dumps(form_get()))
            return 0
        if sub in ("show", "cancel", "save", "discard", "dismiss", "_run", "retry", "regen-undo"):
            if not rest:
                raise L.Bad("%s needs a job id" % sub)
            jid = rest[0]
            if sub == "_run":
                return run(jid)
            if sub == "show":
                res = get(jid)
                print(json.dumps({"ok": True, "job": res}) if js else show_text(res))
                return 0
            if sub == "cancel":
                res = cancel(jid)
            elif sub == "retry":
                res = retry(jid)
            elif sub == "save":
                res = save(jid, rest[rest.index("--name") + 1] if "--name" in rest and rest.index("--name") + 1 < len(rest) else "", replace="--replace" in rest)
            elif sub == "regen-undo":
                res = regen_undo(jid, rest[1] if len(rest) > 1 else "")
            elif sub == "discard":
                res = discard(jid)
            else:
                res = dismiss(jid)
            if js:
                print(json.dumps({"ok": True, "job": res} if sub in ("cancel", "retry", "regen-undo") else res))
            else:
                print(("job %s: %s" % (jid, res["state"])) if sub in ("cancel", "retry", "regen-undo") else json.dumps(res))
            return 0
        print(__doc__.strip(), file=sys.stderr)
        return 2
    except L.Bad as e:
        print(json.dumps({"ok": False, "error": str(e)}) if js else "ai-theme job: %s" % e, file=sys.stdout if js else sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
