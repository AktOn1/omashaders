"""Offline self-test of bin/aiprov.py: which AI is preselected, which model is passed, and the OpenAI-compatible endpoint.
A tiny local web server stands in for the endpoint; nothing leaves this computer and no real AI is called.
Run: python3 bin/aiprov_selftest.py   (also part of: python3 bin/ai-theme selftest)"""
import sys
sys.dont_write_bytecode = True
import http.server
import json
import os
import shutil
import stat
import tempfile
import threading

HERE = os.path.dirname(os.path.realpath(__file__))
TMP = tempfile.mkdtemp(prefix="omashaders-prov-selftest-")
os.environ["OMASHADERS_STATE_DIR"] = os.path.join(TMP, "state")
for k in ("OMASHADERS_AI_PROVIDER", "OMASHADERS_AI_MODEL", "OMASHADERS_AI_CMD"):
    os.environ.pop(k, None)
sys.path.insert(0, HERE)
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


def reset(agent=None, installed=("claude", "codex", "gemini")):
    shutil.rmtree(os.environ["OMASHADERS_STATE_DIR"], ignore_errors=True)
    for k in ("OMASHADERS_AI_PROVIDER", "OMASHADERS_AI_MODEL", "OMASHADERS_AI_CMD"):
        os.environ.pop(k, None)
    f = os.path.join(TMP, "agent")
    if agent is None:
        if os.path.exists(f):
            os.remove(f)
    else:
        open(f, "w").write(agent + "\n")
    P.AGENT_FILE = f
    P.find_exe = lambda name: ("/fake/" + name) if name in installed else ""


# ---- 1. Which AI is preselected: remembered > plugin setting > Omarchy's default agent > first installed
reset("codex")
check("omarchy default is preselected", P.choice()["provider"] == "codex", P.choice())
check("omarchy default is not 'remembered' (user has not chosen yet)", not P.choice()["remembered"])
reset("opencode")
check("omarchy default that is not installed falls to the first installed", P.choice()["provider"] == "claude", P.choice())
reset(None, installed=("gemini", "codex"))
check("nothing set: first installed", P.choice()["provider"] == "codex" or P.choice()["provider"] == "gemini", P.choice())
check("nothing set: follows table order (claude, codex, gemini...)", P.choice()["provider"] == "codex", P.choice())
reset("codex")
os.environ["OMASHADERS_AI_PROVIDER"] = "gemini"
check("plugin setting beats omarchy default", P.choice()["provider"] == "gemini", P.choice())
reset("codex")
P.save_choice(provider="claude", model="")
check("remembered choice beats omarchy default", P.choice()["provider"] == "claude" and P.choice()["remembered"], P.choice())
reset(None, installed=())
check("no AI installed: still answers (claude), availability says what to do", P.choice()["provider"] == "claude" and not P.availability()["available"])

# ---- 2. Which model: the tool's own default unless the user types one
reset(None)
ch = P.choice()
check("claude default model is empty (tool's own default)", ch["provider"] == "claude" and ch["model"] == "", ch)
c = P.command(ch, "SYS", "ASK")
check("claude without model gets no --model flag", "--model" not in c.argv, c.argv)
c = P.command(dict(ch, model="opus"), "SYS", "ASK")
check("claude with a typed model passes it", c.argv[c.argv.index("--model") + 1] == "opus", c.argv)
c = P.command(dict(ch, model="claude-sonnet-4-5"), "SYS", "ASK")
check("a free-text model id passes for claude", "claude-sonnet-4-5" in c.argv)
c = P.command({"provider": "codex", "model": "o4-mini"}, "SYS", "ASK")
check("a free-text model passes for codex", c.argv[c.argv.index("-m") + 1] == "o4-mini", c.argv)
P.cleanup(c)
check("clean_model keeps provider/id:tag ids", P.clean_model("anthropic/claude-3.5-sonnet:beta") == "anthropic/claude-3.5-sonnet:beta")
check("clean_model drops shell tricks", P.clean_model("a; rm -rf /") == "")

# ---- 3. Capabilities are tick-boxes for custom and endpoint
reset(None)
check("claude can see pictures, is strong", P.can_see({"provider": "claude"}) and P.is_strong({"provider": "claude"}))
check("gemini cli cannot see pictures", not P.can_see({"provider": "gemini"}))
check("custom without {image} cannot see pictures by default", not P.can_see({"provider": "custom", "custom": "my-ai"}))
check("custom with {image} sees pictures by default", P.can_see({"provider": "custom", "custom": "my-ai {image}"}))
check("ticking 'sees pictures' on a custom command is honoured", P.can_see({"provider": "custom", "custom": "my-ai", "caps": {"image": True}}))
check("unticking is honoured too", not P.can_see({"provider": "custom", "custom": "my-ai {image}", "caps": {"image": False}}))
check("endpoint is strong unless unticked", P.is_strong({"provider": "endpoint"}) and not P.is_strong({"provider": "endpoint", "caps": {"strong": False}}))
check("ollama is not strong", not P.is_strong({"provider": "ollama"}))
P.save_choice(provider="endpoint", model="m", caps={"image": True, "strong": False})
check("capabilities are remembered", P.choice()["caps"] == {"image": True, "strong": False}, P.choice())

# ---- 4. The OpenAI-compatible endpoint
SEEN = []
REPLY = {"code": 200, "body": {"choices": [{"message": {"content": '{"ok": true}'}}], "usage": {"prompt_tokens": 11, "completion_tokens": 3}}}


class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        SEEN.append({"path": self.path, "auth": self.headers.get("Authorization"), "body": json.loads(self.rfile.read(n) or b"{}")})
        data = json.dumps(REPLY["body"]).encode()
        self.send_response(REPLY["code"])
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


srv = http.server.HTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:%d/v1" % srv.server_address[1]
keyfile = os.path.join(TMP, "key.txt")
open(keyfile, "w").write("sk-from-file\n")
os.chmod(keyfile, 0o600)


def ep(**kw):
    d = {"provider": "endpoint", "model": "my/model:free", "caps": {}, "endpoint": {"url": URL, "key_env": "", "key_file": ""}}
    d["endpoint"].update(kw.pop("endpoint", {}))
    d.update(kw)
    return d


reset(None)
text, usage = P.call(ep(endpoint={"key_file": keyfile}), "SYSTEM", "HELLO")
req = SEEN[-1]
check("endpoint posts to /chat/completions", req["path"] == "/v1/chat/completions", req["path"])
check("endpoint sends the model and both messages", req["body"]["model"] == "my/model:free" and [m["role"] for m in req["body"]["messages"]] == ["system", "user"], req["body"])
check("endpoint key from a private file", req["auth"] == "Bearer sk-from-file", req["auth"])
check("endpoint returns the answer and real token counts", text == '{"ok": true}' and usage["tokens_in"] == 11 and usage["tokens_out"] == 3 and not usage["estimated"], (text, usage))
os.environ["OMASHADERS_TEST_KEY"] = "sk-from-env"
P.call(ep(endpoint={"key_env": "OMASHADERS_TEST_KEY"}), "S", "U")
check("endpoint key from an environment variable", SEEN[-1]["auth"] == "Bearer sk-from-env", SEEN[-1]["auth"])
P.call(ep(), "S", "U")
check("endpoint without any key sends no Authorization header (local servers)", SEEN[-1]["auth"] is None)
os.chmod(keyfile, 0o644)
try:
    P.call(ep(endpoint={"key_file": keyfile}), "S", "U")
    check("a key file others can read is refused", False)
except L.Bad as e:
    check("a key file others can read is refused", "private" in str(e) or "chmod" in str(e), str(e))
os.chmod(keyfile, 0o600)
P.call(ep(caps={"image": True}), "S", "U", b"\xff\xd8JPEGDATA")
content = SEEN[-1]["body"]["messages"][-1]["content"]
check("a picture goes as an image_url part when the model can see", isinstance(content, list) and any(p.get("type") == "image_url" and p["image_url"]["url"].startswith("data:image/jpeg;base64,") for p in content), content)
P.call(ep(), "S", "U", b"\xff\xd8JPEGDATA")
check("no picture is sent when the model cannot see", isinstance(SEEN[-1]["body"]["messages"][-1]["content"], str))
REPLY.update(code=401, body={"error": {"message": "bad key sk-from-env"}})
os.environ["OMASHADERS_TEST_KEY"] = "sk-from-env"
try:
    P.call(ep(endpoint={"key_env": "OMASHADERS_TEST_KEY"}), "S", "U")
    check("a 401 is an error", False)
except L.Bad as e:
    check("a 401 is an error that never prints the key", "401" in str(e) and "sk-from-env" not in str(e), str(e))
REPLY.update(code=200, body={"choices": [{"message": {"content": '{"ok": true}'}}], "usage": {"prompt_tokens": 1, "completion_tokens": 1}})
av = P.availability(ep(endpoint={"url": ""}))
check("endpoint without URL is not available and says what to type", not av["available"] and "URL" in av["hint"], av)
av = P.availability(ep(model=""))
check("endpoint without a model is not available", not av["available"] and "model" in av["hint"].lower(), av)
av = P.availability(ep(endpoint={"url": "http://example.com/v1"}))
check("plain http to another computer is refused", not av["available"] and "https" in av["hint"], av)
av = P.availability(ep(endpoint={"url": "http://192.168.1.20:1234/v1"}))
check("plain http inside the home network is allowed", av["available"], av)
av = P.availability(ep(endpoint={"url": "file:///etc/passwd"}))
check("other URL schemes are refused", not av["available"], av)
av = P.availability(ep(endpoint={"key_env": "OMASHADERS_NO_SUCH_VAR"}))
check("a named key variable that is not set is reported", not av["available"] and "OMASHADERS_NO_SUCH_VAR" in av["hint"], av)
check("endpoint test round trip works", P.test(ep())["ok"] is True)
srv.shutdown()

# ---- 5. The dropdown lists every installed tool, endpoint and custom last
reset(None, installed=("claude", "codex"))
ids = [p["id"] for p in P.providers()]
check("providers: installed tools, then endpoint, then custom", ids == ["claude", "codex", "endpoint", "custom"], ids)

# ---- 6. `ai-theme use`: the dialog's way to remember a pick; each tool keeps its own model text
import subprocess  # noqa: E402


def use(*a):
    r = subprocess.run([sys.executable, os.path.join(HERE, "ai-theme"), "use"] + list(a) + ["--json"], capture_output=True, text=True, env=dict(os.environ, HOME=TMP))
    return json.loads(r.stdout.strip().splitlines()[-1]) if r.stdout.strip() else {"error": r.stderr}


reset(None)
use("endpoint", "--url", "https://openrouter.ai/api/v1", "--model", "anthropic/claude-3.5-sonnet", "--key-file", "~/k")
use("claude", "--model", "opus")
r = use("endpoint")["choice"]
check("switching back to the endpoint restores its model and URL", r["model"] == "anthropic/claude-3.5-sonnet" and r["endpoint"]["url"] == "https://openrouter.ai/api/v1" and r["endpoint"]["key_file"] == "~/k", r)
r = use("claude")["choice"]
check("switching back to claude restores the typed model", r["model"] == "opus", r)
r = use("codex")["choice"]
check("a tool never used before starts on its own default (empty)", r["model"] == "", r)
r = use("custom", "--can-see", "1", "--strong", "0")["choice"]
check("tick-boxes are saved", r["caps"] == {"image": True, "strong": False}, r)
rows = json.loads(subprocess.run([sys.executable, os.path.join(HERE, "ai-theme"), "providers", "--json"], capture_output=True, text=True, env=dict(os.environ, HOME=TMP)).stdout)
cu = next(x for x in rows["providers"] if x["id"] == "custom")
check("the dropdown rows carry the ticked capabilities", cu["image"] is True and cu["strong"] is False, cu)

shutil.rmtree(TMP, ignore_errors=True)
print("%d ok, %d failed" % (OK, FAIL))
sys.exit(1 if FAIL else 0)
