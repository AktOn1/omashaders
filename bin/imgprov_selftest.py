"""Offline self-test of imgprov.py: ComfyUI, the OpenAI-compatible images endpoint and the Custom command, against a stand-in
local web server. Nothing leaves this computer and no real image model runs. Run: python3 imgprov_selftest.py"""
import sys
sys.dont_write_bytecode = True
import base64
import http.server
import json
import os
import shutil
import tempfile
import threading
import urllib.parse

HERE = os.path.dirname(os.path.realpath(__file__))
TMP = tempfile.mkdtemp(prefix="imgprov-selftest-")
sys.path.insert(0, HERE)
import imgprov as P  # noqa: E402

P.STATE = os.path.join(TMP, "state")
P.CHOICE_FILE = os.path.join(P.STATE, "img.json")
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
SEEN = {}
OK = FAIL = 0


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
    else:
        FAIL += 1
        print("FAIL", name, detail)


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, body, ctype="application/json", extra=None):
        raw = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/object_info/CheckpointLoaderSimple":
            return self.reply(200, {"CheckpointLoaderSimple": {"input": {"required": {"ckpt_name": [["a.safetensors", "b.safetensors"]]}}}})
        if u.path == "/history/pid1":
            return self.reply(200, {"pid1": {"status": {"completed": True, "status_str": "success"}, "outputs": {"9": {"images": [{"filename": "x.png", "subfolder": "", "type": "output"}]}}}})
        if u.path == "/history/pidbad":
            return self.reply(200, {"pidbad": {"status": {"completed": True, "status_str": "error"}, "outputs": {}}})
        if u.path == "/view":
            return self.reply(200, PNG, "image/png")
        if u.path == "/v1/models":
            SEEN["auth_models"] = self.headers.get("Authorization")
            return self.reply(200, {"data": []})
        if u.path == "/pic.png":
            return self.reply(200, PNG, "image/png")
        if u.path == "/redir":
            return self.reply(302, b"", extra={"Location": "/pic.png"})
        if u.path == "/v1/redirect/models":
            return self.reply(302, b"", extra={"Location": "http://example.invalid/"})
        self.reply(404, {})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        if self.path == "/prompt":
            SEEN["prompt"] = body
            bad = "FAILME" in json.dumps(body)
            return self.reply(200, {"prompt_id": "pidbad" if bad else "pid1"})
        if self.path == "/v1/images/generations":
            SEEN["gen"] = body
            SEEN["auth"] = self.headers.get("Authorization")
            if SEEN["auth"] != "Bearer sk-secret-123":
                return self.reply(401, {"error": {"message": "bad key " + str(SEEN["auth"])}})
            if body.get("prompt") == "url":
                return self.reply(200, {"data": [{"url": "http://127.0.0.1:%d/pic.png" % PORT}]})
            if body.get("prompt") == "junk":
                return self.reply(200, {"data": [{"b64_json": base64.b64encode(b"not a picture").decode()}]})
            return self.reply(200, {"data": [{"b64_json": base64.b64encode(PNG).decode()}]})
        self.reply(404, {})


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d" % PORT


def ch(**kw):
    c = {"provider": "comfyui", "comfy": {"url": BASE, "workflow": "", "checkpoint": "a.safetensors"},
         "endpoint": {"url": BASE + "/v1", "model": "gpt-image-1", "key_env": "", "key_file": "", "size": ""}, "custom": ""}
    c.update(kw)
    return c


def bad(fn, *needles):
    try:
        fn()
    except P.Bad as e:
        return all(n.lower() in str(e).lower() for n in needles), str(e)
    return False, "no error"


# --- choice and placeholders
check("default provider", P.choice()["provider"] == "comfyui")
P.save_choice(provider="endpoint", endpoint={"url": "http://x/v1", "model": "m"})
check("remembered pick", P.choice()["provider"] == "endpoint" and P.choice()["endpoint"]["model"] == "m")
check("unknown provider falls back", (P.save_choice(provider="zzz"), P.choice()["provider"])[1] == "comfyui")
f = P.fill({"a": "{width}", "b": "x {prompt} y", "c": ["{seed}", "keep {unknown}"]}, {"width": 512, "prompt": 'a "quoted" \\ prompt', "seed": 7})
check("typed placeholder", f["a"] == 512 and f["c"][0] == 7)
check("embedded placeholder and unknown kept", f["b"] == 'x a "quoted" \\ prompt y' and f["c"][1] == "keep {unknown}")

# --- ComfyUI
check("checkpoints listed", P.checkpoints(ch()) == ["a.safetensors", "b.safetensors"])
img, mime = P.generate(ch(), 'a "cat" \\ {width}', "blurry", 640, 480, seed=42)
check("comfy picture", img == PNG and mime == "image/png")
w = SEEN["prompt"]["prompt"]
check("workflow filled", w["5"]["inputs"]["width"] == 640 and w["3"]["inputs"]["seed"] == 42 and w["4"]["inputs"]["ckpt_name"] == "a.safetensors")
check("prompt text exact", w["6"]["inputs"]["text"] == 'a "cat" \\ {width}' and w["7"]["inputs"]["text"] == "blurry")
check("comfy error reported", bad(lambda: P.generate(ch(), "FAILME", "", 512, 512))[0])
c = ch(); c["comfy"]["checkpoint"] = ""
check("checkpoint required", bad(lambda: P.generate(c, "x"), "checkpoint")[0])
c = ch(); c["comfy"]["url"] = "http://8.8.8.8:8188"
check("public http refused", bad(lambda: P.generate(c, "x"), "https")[0])
c = ch(); c["comfy"]["workflow"] = os.path.join(TMP, "nope.json")
check("missing workflow", bad(lambda: P.generate(c, "x"), "workflow")[0])
open(os.path.join(TMP, "ui.json"), "w").write(json.dumps({"nodes": [], "links": []}))
c = ch(); c["comfy"]["workflow"] = os.path.join(TMP, "ui.json")
check("non-API workflow", bad(lambda: P.generate(c, "x"), "api format")[0])
check("comfy test", "2 checkpoints" in P.test(ch()))
check("empty prompt", bad(lambda: P.generate(ch(), "  "), "describe")[0])

# --- endpoint
kf = os.path.join(TMP, "key")
open(kf, "w").write("sk-secret-123\n")
os.chmod(kf, 0o644)
e = ch(provider="endpoint"); e["endpoint"]["key_file"] = kf
check("loose key file refused", bad(lambda: P.generate(e, "x"), "chmod 600")[0])
os.chmod(kf, 0o600)
img, mime = P.generate(e, "x", width=512, height=256)
check("endpoint picture", img == PNG and SEEN["auth"] == "Bearer sk-secret-123")
check("size sent", SEEN["gen"]["size"] == "512x256" and SEEN["gen"]["model"] == "gpt-image-1")
e["endpoint"]["size"] = "1024x1024"
P.generate(e, "x")
check("explicit size wins", SEEN["gen"]["size"] == "1024x1024")
check("image url fetched", P.generate(e, "url")[0] == PNG)
check("junk refused", bad(lambda: P.generate(e, "junk"), "png or jpeg")[0])
e2 = ch(provider="endpoint"); e2["endpoint"]["key_file"] = kf
open(kf, "w").write("sk-secret-123\n")
os.environ["IMG_TEST_KEY"] = "sk-wrong"
e3 = ch(provider="endpoint"); e3["endpoint"]["key_env"] = "IMG_TEST_KEY"
ok, msg = bad(lambda: P.generate(e3, "x"), "401")
check("401 reported", ok, msg)
os.environ["IMG_TEST_KEY"] = "sk-secret-123"
e3["endpoint"]["key_env"] = "IMG_TEST_KEY"
check("key from env", P.generate(e3, "x")[0] == PNG)
e4 = ch(provider="endpoint"); e4["endpoint"]["key_env"] = "IMG_TEST_UNSET"
check("unset env named", bad(lambda: P.generate(e4, "x"), "IMG_TEST_UNSET")[0])
e5 = ch(provider="endpoint"); e5["endpoint"]["model"] = ""
check("model required", bad(lambda: P.generate(e5, "x"), "model name")[0])
e6 = ch(provider="endpoint"); e6["endpoint"]["url"] = "http://api.example.com/v1"
check("endpoint public http refused", bad(lambda: P.generate(e6, "x"), "https")[0])
e3["endpoint"]["url"] = BASE + "/v1"
check("endpoint test", "accepts" in P.test(e3) and SEEN["auth_models"] == "Bearer sk-secret-123")
e7 = ch(provider="endpoint"); e7["endpoint"]["url"] = BASE + "/v1/redirect"; e7["endpoint"]["key_env"] = "IMG_TEST_KEY"
check("redirect not followed", bad(lambda: P.test(e7), "302")[0])
e8 = ch(provider="endpoint"); e8["endpoint"]["key_env"] = "IMG_TEST_KEY"; os.environ["IMG_TEST_KEY"] = "sk-wrong"
ok, msg = bad(lambda: P.generate(e8, "x"))
check("key never in error", "sk-wrong" not in msg and "sk-secret-123" not in msg, msg)

# --- custom command
tool = os.path.join(TMP, "tool.py")
open(tool, "w").write("import sys,base64\nout=sys.argv[sys.argv.index('--out')+1]\nopen(out,'wb').write(base64.b64decode(%r))\nopen(out+'.args','w').write(sys.argv[sys.argv.index('--p')+1])\n" % base64.b64encode(PNG).decode())
cu = ch(provider="custom", custom="%s %s --p {prompt} --out {out}" % (sys.executable, tool))
img, mime = P.generate(cu, "a; rm -rf ~ $(whoami) 'q'")
check("custom picture", img == PNG)
cu = ch(provider="custom", custom="%s -c 'print(1)' {out}" % sys.executable)
check("custom wrote nothing", bad(lambda: P.generate(cu, "x"), "wrote no file")[0])
cu = ch(provider="custom", custom="%s -c 'open(\"{out}\",\"w\").write(\"hi\")'" % sys.executable)
check("custom non-image refused", bad(lambda: P.generate(cu, "x"), "png or jpeg")[0])
check("custom needs {out}", bad(lambda: P.generate(ch(provider="custom", custom="echo hi"), "x"), "{out}")[0])
check("custom missing exe", bad(lambda: P.generate(ch(provider="custom", custom="no-such-img-tool-xyz {out}"), "x"), "not found")[0])
check("custom test", "found" in P.test(ch(provider="custom", custom="python3 {out}")))

shutil.rmtree(TMP, ignore_errors=True)
print("%d ok, %d failed" % (OK, FAIL))
sys.exit(1 if FAIL else 0)
