"""OMS2: a theme together with the custom (AI-made) shaders it uses, as a small byte string.

Pure codec, no state folder and nothing is run here. Layout of a payload:
  b"OM" + format byte (2) + dictionary id byte + raw deflate of JSON, compressed with a preset dictionary.
The JSON is {"v": 2, "tv": template version, "t": theme, "custom": [entry, ...]}. An entry is
  {"id", "k" kind, "name", "desc", "code"}  for GLSL kinds (screen window color wallpaper cursor), "code" = the AI's function body
  {"id", "k": "frame", "name", "desc", "set": {frame settings}}
plus optional "st" (start strength) and "p": "rich" (needs the rich limits). Unknown optional fields are ignored by readers; a
change that older readers must not ignore bumps the format byte and "v". The text form is "OMS2:" + base64url(payload).

The dictionaries are frozen files (bin/oms2-dict-<id>.txt, made once by bin/oms2-make-dict.py). Shipped shaders change over time,
so an old code must keep decoding with its own dictionary: never edit a dictionary file, add a new id instead (the hashes below
are checked on every load).
"""
import sys
sys.dont_write_bytecode = True
import hashlib
import json
import os
import re
import zlib

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import omslib as L  # noqa: E402

HERE = os.path.dirname(os.path.realpath(__file__))
TEXT_PREFIX = "OMS2:"
MAGIC = b"OM"
FORMAT = 2                 # the byte after OM; also "v" in the JSON
TEMPLATE_VERSION = 1       # bump when the shader template or its helper functions in aigen.py change meaning
PICTURE_LIMIT = 5400       # bytes that fit in the data border of the share picture
MAX_PAYLOAD = 24000        # bytes we accept
MAX_DECODED = 65536        # bytes after decompression (bomb guard)
MAX_CUSTOMS = 12
MAX_TEXT = (MAX_PAYLOAD * 4) // 3 + 16
NEWER = "This code was made by a newer OmaShaders; update the plugin to import it"
DICT_SHA256 = {1: "927cdd465063c20a1344ad8006bc7ce4f699526c71119cd352be297f496c19e3"}  # id -> sha256 of bin/oms2-dict-<id>.txt
THEME_KEYS = ("n", "s", "w", "m", "c", "wf", "wc", "wr")


# ---------------------------------------------------------------- GLSL minifier (comments and whitespace out, same tokens)
_TOK = re.compile(r"/\*.*?\*/|//[^\n]*|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[uUfF]?|[A-Za-z_]\w*|<<=|>>=|&&|\|\||\^\^|[-+*/%&|^<>=!]=|<<|>>|\+\+|--|\S", re.S)
_PAIRS = {"++", "--", "<<", ">>", "&&", "||", "^^", "<=", ">=", "==", "!=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "//", "/*", "*/"}


def tokens(src):
    return [t for t in _TOK.findall(src) if not t.startswith(("//", "/*"))]


def minify(src):
    """one statement per line, no comments, no spare spaces; raises ValueError if the result would not be the same tokens"""
    toks = tokens(src)
    out, depth, prev = [], 0, ""
    for t in toks:
        if prev and not out[-1].endswith("\n"):
            a, b = prev[-1], t[0]
            if (a.isalnum() or a == "_") and (b.isalnum() or b == "_") or a + b in _PAIRS:
                out.append(" ")
        out.append(t)
        prev = t
        if t == "(":
            depth += 1
        elif t == ")":
            depth = max(0, depth - 1)
        if t in ("{", "}") or (t == ";" and depth == 0):
            out.append("\n")
    text = "".join(out).strip() + "\n"
    if tokens(text) != toks:
        raise ValueError("could not shorten the shader safely")
    return text


# ---------------------------------------------------------------- dictionaries
_dicts = {}


def dictionary(did):
    if did in _dicts:
        return _dicts[did]
    path = os.path.join(HERE, "oms2-dict-%d.txt" % did)
    try:
        data = open(path, "rb").read()
    except OSError:
        raise L.Bad(NEWER if did > max(DICT_SHA256) else "This code is damaged (unknown dictionary)")
    if hashlib.sha256(data).hexdigest() != DICT_SHA256.get(did):
        raise L.Bad("The dictionary file bin/oms2-dict-%d.txt was changed; reinstall the plugin" % did)
    _dicts[did] = data
    return data


LATEST_DICT = 1


def entry_size(entry):
    """compressed bytes of one entry on its own (about what it adds to a code)"""
    c = zlib.compressobj(9, zlib.DEFLATED, -15, 9, zlib.Z_DEFAULT_STRATEGY, dictionary(LATEST_DICT))
    return len(c.compress(json.dumps(entry, separators=(",", ":"), ensure_ascii=False).encode("utf-8")) + c.flush())


# ---------------------------------------------------------------- pack / unpack
def pack(theme, custom, dict_id=LATEST_DICT):
    t = {k: theme[k] for k in THEME_KEYS if theme.get(k, "") != ""}
    t.setdefault("n", "")
    if theme.get("o"):
        t["o"] = theme["o"]
    doc = {"v": FORMAT, "tv": TEMPLATE_VERSION, "t": t, "custom": list(custom)}
    raw = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    c = zlib.compressobj(9, zlib.DEFLATED, -15, 9, zlib.Z_DEFAULT_STRATEGY, dictionary(dict_id))
    return MAGIC + bytes([FORMAT, dict_id]) + c.compress(raw) + c.flush()


def decode(b):
    """-> {"v", "tv", "theme", "custom"}; raises L.Bad with a plain message for anything wrong"""
    if not isinstance(b, (bytes, bytearray)) or b[:2] != MAGIC or len(b) < 5:
        raise L.Bad("This is not an OmaShaders code")
    if len(b) > MAX_PAYLOAD:
        raise L.Bad("This code is too big to be a theme")
    if b[2] > FORMAT:
        raise L.Bad(NEWER)
    if b[2] != FORMAT:
        raise L.Bad("This code is damaged (unknown format)")
    zdict = dictionary(b[3])
    try:
        z = zlib.decompressobj(-15, zdict)
        raw = z.decompress(bytes(b[4:]), MAX_DECODED + 1)
        if len(raw) > MAX_DECODED or z.unconsumed_tail or not z.eof:
            raise L.Bad("This code is damaged or too big")
        doc = json.loads(raw.decode("utf-8"))
    except L.Bad:
        raise
    except Exception:
        raise L.Bad("This code is damaged (could not read it)")
    if not isinstance(doc, dict) or not isinstance(doc.get("v"), int) or isinstance(doc.get("v"), bool):
        raise L.Bad("This code is damaged (could not read it)")
    if doc["v"] > FORMAT:
        raise L.Bad(NEWER)
    if doc["v"] != FORMAT:
        raise L.Bad("This code is damaged (unknown format)")
    t, custom = doc.get("t"), doc.get("custom", [])
    if not isinstance(t, dict) or not isinstance(custom, list):
        raise L.Bad("This code is damaged (wrong layout)")
    if len(custom) > MAX_CUSTOMS:
        raise L.Bad("This code carries too many custom shaders (the limit is %d)" % MAX_CUSTOMS)
    for k in THEME_KEYS:
        if k in t and not isinstance(t[k], str):
            raise L.Bad("This code is damaged (%s is not text)" % k)
    theme = {k: t.get(k, "") for k in THEME_KEYS}
    theme["o"] = t["o"] if isinstance(t.get("o"), dict) else {}
    tv = doc.get("tv", 1)
    return {"v": doc["v"], "tv": tv if isinstance(tv, int) and not isinstance(tv, bool) else 1, "theme": theme, "custom": custom,
            "unknown_theme_keys": sorted(str(k)[:20] for k in t if k not in THEME_KEYS and k != "o")}


def unpack(b):
    d = decode(b)
    return d["theme"], d["custom"]


# ---------------------------------------------------------------- text form and any-input reader
def to_text(payload):
    return TEXT_PREFIX + L.b64e(payload)


def from_text(code):
    code = "".join(str(code).split())
    if not code.startswith(TEXT_PREFIX):
        raise L.Bad("This is not an OmaShaders code (it should start with %s or %s)" % (L.CODE_PREFIX, TEXT_PREFIX))
    if len(code) > MAX_TEXT:
        raise L.Bad("This code is too long to be a theme")
    body = code[len(TEXT_PREFIX):]
    if not re.fullmatch(r"[A-Za-z0-9_-]+", body):
        raise L.Bad("This code has characters that do not belong in it")
    try:
        return L.b64d(body)
    except Exception:
        raise L.Bad("This code is damaged (could not read it)")


def looks_binary(b):
    return bytes(b[:2]) == MAGIC and len(b) > 2 and b[2] < 32
