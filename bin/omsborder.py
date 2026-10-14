#!/usr/bin/env python3
"""omsborder: hide a theme code in the top and bottom border of a picture, and read it back.

The code is drawn as dark/light square cells (Reed-Solomon protected), so it survives GIF palettes, lossy video,
scaling and screenshots. The reader works on any uniformly scaled copy of the picture.

  python3 bin/omsborder.py borders PAYLOAD_FILE TOP.png BOTTOM.png     (prints the plan as JSON)
  python3 bin/omsborder.py decode IMAGE_OR_VIDEO|- [--out FILE]        (prints JSON, - reads stdin)
"""
import sys
sys.dont_write_bytecode = True
import base64
import io
import json
import math
import os
import shutil
import subprocess
import tempfile

try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # reported by _need() when the feature is used
    np = Image = ImageDraw = ImageFont = None

WIDTH = 960                  # width of the picture the code is drawn for
NSYM, K = 48, 207            # Reed-Solomon parity and data bytes per block
VERSION = 1
HEAD_REP = 3                 # each header bit is drawn this many cells wide
HEAD_PX = 4                  # header row: 240 cells of 4 px, always
SMALL_LIMIT = 160            # 4 px cells up to this much border in total
MAX_BORDER = 540             # never taller than the 540 px recording itself
MIN_SIDE_PX = 60
MAX_PAYLOAD = (1 << 24) - 1

CAPTION = "Right-click > Copy image, open OmaShaders > Import theme"
STRIPE_W, STRIPE_H = 488, 28
DARK, LIGHT, BG, STRIPE = (14, 38, 46), (96, 148, 158), (9, 27, 34), (4, 8, 10)
CAPTION_COLOR = (226, 240, 243)


class BorderError(Exception):
    pass


class TooBig(BorderError):
    pass


class NoCode(BorderError):
    pass


class Damaged(BorderError):
    pass


class MissingTools(BorderError):
    pass


def _need():
    if np is None or Image is None:
        raise MissingTools("needs python-pillow and python-numpy")


# ---- Reed-Solomon over GF(256), polynomial 0x11d ----
EXP, LOG = [0] * 512, [0] * 256
_x = 1
for _i in range(255):
    EXP[_i], LOG[_x] = _x, _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    EXP[_i] = EXP[_i - 255]


def _mul(a, b):
    return 0 if a == 0 or b == 0 else EXP[LOG[a] + LOG[b]]


def _inv(a):
    return EXP[255 - LOG[a]]


def _generator(nsym):
    g = [1]
    for i in range(nsym):
        r = [0] * (len(g) + 1)
        for j, a in enumerate(g):
            r[j] ^= a
            r[j + 1] ^= _mul(a, EXP[i])
        g = r
    return g


_GEN = _generator(NSYM)


def _rs_encode(data):
    buf = list(data) + [0] * NSYM
    for i in range(len(data)):
        c = buf[i]
        if c:
            for j in range(1, len(_GEN)):
                buf[i + j] ^= _mul(_GEN[j], c)
    return bytes(data) + bytes(buf[len(data):])


def _peval(p, x):
    y = p[0]
    for c in p[1:]:
        y = _mul(y, x) ^ c
    return y


def _eval_asc(p, x):
    y, xp = 0, 1
    for c in p:
        y ^= _mul(c, xp)
        xp = _mul(xp, x)
    return y


def _rs_decode(msg):
    """returns (data, corrected symbol count); raises ValueError when beyond repair"""
    msg = list(msg)
    n = len(msg)
    S = [_peval(msg, EXP[j]) for j in range(NSYM)]
    if not any(S):
        return bytes(msg[:-NSYM]), 0
    C, B, L, m, b = [1], [1], 0, 1, 1
    for k in range(NSYM):  # Berlekamp-Massey
        d = S[k]
        for i in range(1, L + 1):
            if i < len(C):
                d ^= _mul(C[i], S[k - i])
        if d == 0:
            m += 1
            continue
        coef = _mul(d, _inv(b))
        T = list(C)
        C = C + [0] * (len(B) + m - len(C))
        for i, c in enumerate(B):
            C[i + m] ^= _mul(coef, c)
        if 2 * L <= k:
            L, B, b, m = k + 1 - L, T, d, 1
        else:
            m += 1
    while len(C) > 1 and C[-1] == 0:
        C.pop()
    if len(C) - 1 != L or L * 2 > NSYM:
        raise ValueError("too many errors")
    degs = [i for i in range(n) if _eval_asc(C, EXP[(255 - i) % 255]) == 0]
    if len(degs) != L:
        raise ValueError("cannot locate errors")
    omega = [0] * NSYM
    for i, s in enumerate(S):
        for j, c in enumerate(C):
            if i + j < NSYM:
                omega[i + j] ^= _mul(s, c)
    X = [EXP[d] for d in degs]
    for k, d in enumerate(degs):
        xinv = _inv(X[k])
        den = 1
        for j, xj in enumerate(X):
            if j != k:
                den = _mul(den, 1 ^ _mul(xj, xinv))
        msg[n - 1 - d] ^= _mul(_eval_asc(omega, xinv), _inv(den))
    if any(_peval(msg, EXP[j]) for j in range(NSYM)):
        raise ValueError("uncorrectable")
    return bytes(msg[:-NSYM]), L


def _crc16(data):
    c = 0xFFFF
    for byte in data:
        c ^= byte << 8
        for _ in range(8):
            c = ((c << 1) ^ 0x1021) & 0xFFFF if c & 0x8000 else (c << 1) & 0xFFFF
    return c


# ---- stream layout ----
def _whiten(stream):
    """XOR with a fixed pseudo-random sequence: balances dark/light, and a flat or wiped border is no valid codeword"""
    x, out = 0x4F4D53, bytearray()
    for b in stream:
        x = (x * 1103515245 + 12345) & 0x7FFFFFFF
        out.append(b ^ ((x >> 16) & 255))
    return bytes(out)


def _filler_bits(n, seed=0x5EED5):
    """pseudo-random dark/light cells for the unused rest of the border, so it looks like data and has no stripes"""
    x, out = seed, np.empty(n, np.uint8)
    for i in range(n):
        x = (x * 1103515245 + 12345) & 0x7FFFFFFF
        out[i] = (x >> 16) & 1
    return out


def _block_lens(length):
    n = math.ceil(length / K)
    return [min(K, length - i * K) + NSYM for i in range(n)]


def _interleave(blocks):
    out = bytearray()
    for i in range(max(len(b) for b in blocks)):
        for b in blocks:
            if i < len(b):
                out.append(b[i])
    return bytes(out)


def _deinterleave(stream, lens):
    out = [bytearray() for _ in lens]
    i = 0
    for k in range(max(lens)):
        for bi, ln in enumerate(lens):
            if k < ln:
                out[bi].append(stream[i])
                i += 1
    return out


def _stripe_rows(cs):
    return math.ceil(STRIPE_H / cs)


def _stripe_cols(cs):
    n = math.ceil(STRIPE_W / cs)
    c0 = (WIDTH // cs - n) // 2
    return c0, c0 + n


def _cell_masks(cs, rt, rb):
    """True where a data cell sits: top rows, then bottom rows minus the caption stripe"""
    cols = WIDTH // cs
    top = np.ones((rt, cols), bool)
    bot = np.ones((rb, cols), bool)
    sr, (c0, c1) = _stripe_rows(cs), _stripe_cols(cs)
    sa = (rb - sr) // 2
    bot[sa:sa + sr, c0:c1] = False
    return top, bot


def _data_cells(cs, rt, rb):
    t, b = _cell_masks(cs, rt, rb)
    return int(t.sum() + b.sum())


def _side_rows(cs):
    return max(math.ceil(MIN_SIDE_PX / cs), _stripe_rows(cs) + 1)


def plan(payload_len):
    """Pick cell size and border rows for a payload; raises TooBig when it would not fit in 540 px of border."""
    _need()
    if payload_len < 1 or payload_len > MAX_PAYLOAD:
        raise ValueError("payload must be 1 byte or more")
    need = sum(_block_lens(payload_len)) * 8
    for cs in (4, 3):
        r = _side_rows(cs)
        while HEAD_PX + 2 * r * cs <= (SMALL_LIMIT if cs == 4 else MAX_BORDER):
            if _data_cells(cs, r, r) >= need:
                return {"cs": cs, "rt": r, "rb": r, "top_h": HEAD_PX + r * cs, "bottom_h": r * cs,
                        "total_border_px": HEAD_PX + 2 * r * cs}
            r += 1
    raise TooBig("This theme is too big for a picture")


def max_payload(cs=3, border_px=MAX_BORDER):
    """Largest payload that fits in border_px of border with the given cell size."""
    _need()
    r = (border_px - HEAD_PX) // (2 * cs)
    cells = _data_cells(cs, r, r)
    lo, hi = 0, MAX_PAYLOAD
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if sum(_block_lens(mid)) * 8 <= cells:
            lo = mid
        else:
            hi = mid - 1
    return lo


# ---- drawing ----
def _font(size):
    paths = []
    try:
        out = subprocess.run(["fc-match", "-f", "%{file}", "sans"], capture_output=True, text=True, timeout=5).stdout.strip()
        if out:
            paths.append(out)
    except (OSError, subprocess.SubprocessError):
        pass
    paths += ["/usr/share/fonts/TTF/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVuSans.ttf"]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except (OSError, ValueError):
            continue
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def _caption_font():
    size = 16
    while True:  # one size for every picture, shrunk only if this font is wider than the stripe allows
        f = _font(size)
        if size <= 11 or not hasattr(f, "getlength") or f.getlength(CAPTION) <= STRIPE_W - 24:
            return f
        size -= 1


def _paint(cells, cs):
    pal = np.array([DARK, LIGHT], np.uint8)
    return np.repeat(np.repeat(pal[cells.astype(np.intp)], cs, axis=0), cs, axis=1)


def render_borders(payload, out_top_png, out_bottom_png):
    """Write the two border PNGs (960 px wide) to stack above and below the picture. Returns the plan."""
    _need()
    payload = bytes(payload)
    p = plan(len(payload))
    cs, rt, rb = p["cs"], p["rt"], p["rb"]
    lens = _block_lens(len(payload))
    stream = _whiten(_interleave([_rs_encode(payload[i * K:(i + 1) * K]) for i in range(len(lens))]))
    bits = np.unpackbits(np.frombuffer(stream, np.uint8))
    tmask, bmask = _cell_masks(cs, rt, rb)
    valid = np.concatenate([tmask.ravel(), bmask.ravel()])
    vals = _filler_bits(int(valid.sum()))  # pseudo-random filler after the data
    vals[:len(bits)] = bits
    flat = np.zeros(valid.size, np.uint8)
    flat[valid] = vals
    cols = WIDTH // cs
    tcells = flat[:rt * cols].reshape(rt, cols)
    bcells = flat[rt * cols:].reshape(rb, cols)

    head = (VERSION << 4 | cs).to_bytes(1, "big") + len(payload).to_bytes(3, "big") + \
        (rt << 12 | rb).to_bytes(3, "big")
    head += _crc16(head).to_bytes(2, "big")
    hbits = np.repeat(np.unpackbits(np.frombuffer(head, np.uint8)), HEAD_REP)
    hcells = _filler_bits(WIDTH // HEAD_PX, 0xBEEF1)
    hcells[:len(hbits)] = hbits
    top = np.concatenate([_paint(hcells[None, :], HEAD_PX), _paint(tcells, cs)])
    bot = _paint(bcells, cs)

    img = Image.fromarray(bot)
    d = ImageDraw.Draw(img)
    sr, (c0, c1) = _stripe_rows(cs), _stripe_cols(cs)
    sa = (rb - sr) // 2 * cs
    area_w, area_h = (c1 - c0) * cs, sr * cs
    d.rectangle([c0 * cs, sa, c0 * cs + area_w - 1, sa + area_h - 1], fill=BG)
    ox, oy = c0 * cs + (area_w - STRIPE_W) // 2, sa + (area_h - STRIPE_H) // 2
    d.rectangle([ox, oy, ox + STRIPE_W - 1, oy + STRIPE_H - 1], fill=STRIPE)
    for cx in (ox, ox + STRIPE_W - cs):
        for cy in (oy, oy + STRIPE_H - cs):
            d.rectangle([cx, cy, cx + cs - 1, cy + cs - 1], fill=LIGHT)
    d.text(((c0 + c1) * cs // 2, sa + area_h // 2), CAPTION, font=_caption_font(), fill=CAPTION_COLOR, anchor="mm")

    Image.fromarray(top).save(out_top_png)
    img.save(out_bottom_png)
    return p


# ---- reading ----
def _two_means(v):
    lo, hi = float(v.min()), float(v.max())
    for _ in range(12):
        t = (lo + hi) / 2
        a, b = v[v <= t], v[v > t]
        if not len(a) or not len(b):
            break
        lo, hi = float(a.mean()), float(b.mean())
    return lo, hi


def _cell_means(ii, s, x, y, w, h, shape):
    """Mean grey level of the middle half of every cell, using an integral image. x, y, w, h in unscaled px."""
    H, W = ii.shape[0] - 1, ii.shape[1] - 1
    rows, cols = shape
    xs = (x + np.arange(cols) * w) * s
    ys = (y + np.arange(rows) * h) * s
    xa = np.rint(xs + w * s * 0.25).astype(np.intp)
    xb = np.maximum(xa + 1, np.rint(xs + w * s * 0.75).astype(np.intp))
    ya = np.rint(ys + h * s * 0.25).astype(np.intp)
    yb = np.maximum(ya + 1, np.rint(ys + h * s * 0.75).astype(np.intp))
    xa = np.clip(xa, 0, W - 1)
    xb = np.clip(xb, xa + 1, W)
    ya = np.clip(ya, 0, H - 1)
    yb = np.clip(yb, ya + 1, H)
    YA, YB, XA, XB = ya[:, None], yb[:, None], xa[None, :], xb[None, :]
    tot = ii[YB, XB] - ii[YA, XB] - ii[YB, XA] + ii[YA, XA]
    return tot / ((YB - YA) * (XB - XA))


def _read_grey(a):
    H, W = a.shape
    if W < 240 or H < 40:
        raise NoCode("No theme code found in this picture")
    ii = np.zeros((H + 1, W + 1))
    ii[1:, 1:] = a.cumsum(0).cumsum(1)
    s = W / WIDTH
    hv = _cell_means(ii, s, 0, 0, HEAD_PX, HEAD_PX, (1, WIDTH // HEAD_PX))[0]
    lo, hi = _two_means(hv)
    if hi - lo < 12:
        raise NoCode("No theme code found in this picture")
    soft = hv[:72 * HEAD_REP].reshape(72, HEAD_REP).mean(1)
    hbytes = np.packbits((soft > (lo + hi) / 2).astype(np.uint8)).tobytes()
    if _crc16(hbytes[:7]) != int.from_bytes(hbytes[7:], "big"):
        raise NoCode("No theme code found in this picture")
    ver, cs = hbytes[0] >> 4, hbytes[0] & 15
    length = int.from_bytes(hbytes[1:4], "big")
    rows = int.from_bytes(hbytes[4:7], "big")
    rt, rb = rows >> 12, rows & 0xFFF
    if ver != VERSION or cs not in (3, 4) or length < 1 or rt < 1 or rb < _stripe_rows(cs) + 1 \
            or (HEAD_PX + (rt + rb) * cs) * s > H + 1:
        raise NoCode("No theme code found in this picture")
    lens = _block_lens(length)
    tmask, bmask = _cell_masks(cs, rt, rb)
    if sum(lens) * 8 > tmask.sum() + bmask.sum():
        raise NoCode("No theme code found in this picture")
    top = _cell_means(ii, s, 0, HEAD_PX, cs, cs, tmask.shape)
    # the bottom rows are placed from the bottom edge of the picture
    ybot = H / s - rb * cs
    bot = _cell_means(ii, s, 0, ybot, cs, cs, bmask.shape)
    v = np.concatenate([top[tmask], bot[bmask]])[:sum(lens) * 8]
    lo2, hi2 = _two_means(v)
    thr = (lo2 + hi2) / 2 if hi2 - lo2 >= 12 else (lo + hi) / 2
    stream = _whiten(np.packbits((v > thr).astype(np.uint8)).tobytes())
    out, fixed = bytearray(), 0
    for blk in _deinterleave(stream, lens):
        try:
            d, n = _rs_decode(blk)
        except ValueError:
            raise Damaged("The theme code in this picture is too damaged to read")
        out += d
        fixed += n
    return bytes(out), fixed


def _crop_plain_margins(a):
    """Cut away a margin of one flat colour around the picture (a screenshot with a page background)."""
    bg = a[0, 0]
    diff = np.abs(a - bg) > 6
    rows, cols = np.where(diff.any(1))[0], np.where(diff.any(0))[0]
    if not len(rows) or not len(cols):
        return a
    return a[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]


def _decode_grey(a):
    try:
        return _read_grey(a)
    except NoCode:
        cropped = _crop_plain_margins(a)
        if cropped.shape == a.shape:
            raise
        return _read_grey(cropped)


def _grey(im):
    return np.asarray(im.convert("L"), dtype=np.float64)


def _ffmpeg_frames(path):
    ff = shutil.which("ffmpeg")
    if not ff:
        raise MissingTools("needs ffmpeg to read a video")
    for t in ("0", "0.4", "1"):
        r = subprocess.run([ff, "-v", "error", "-ss", t, "-i", path, "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "-"],
                           capture_output=True)
        if r.returncode == 0 and r.stdout:
            yield Image.open(io.BytesIO(r.stdout))


def _candidates(source):
    """Yield grey pictures to try: the image itself, or a few early frames of a video."""
    if Image is not None and isinstance(source, Image.Image):
        yield _grey(source)
        return
    tmp = None
    try:
        if isinstance(source, (bytes, bytearray, memoryview)):
            data = bytes(source)
            try:
                im = Image.open(io.BytesIO(data))
                im.load()
                yield _grey(im)
                return
            except (OSError, ValueError):
                fd, tmp = tempfile.mkstemp(prefix="omsborder-", suffix=".bin")
                with os.fdopen(fd, "wb") as f:
                    f.write(data)
                path = tmp
        else:
            path = os.fspath(source)
            if not os.path.exists(path):
                raise BorderError("File not found: " + path)
            try:
                with Image.open(path) as im:
                    im.load()
                    g = _grey(im)
                yield g
                return
            except (OSError, ValueError):
                pass
        for fr in _ffmpeg_frames(path):
            yield _grey(fr)
    finally:
        if tmp:
            os.unlink(tmp)


def decode(source):
    """Read the theme code from a picture (path, bytes or PIL image of a GIF/PNG/JPEG/WebP, or an mp4/webm video).
    Returns (payload_bytes, corrected_byte_count). Raises NoCode or Damaged."""
    _need()
    err = None
    tried = False
    for g in _candidates(source):
        tried = True
        try:
            return _decode_grey(g)
        except Damaged as e:
            err = e
        except NoCode as e:
            err = err or e
    if not tried:
        raise NoCode("This file is not a picture or video that can be read")
    raise err


# ---- command line ----
def _cli(argv):
    if len(argv) >= 5 and argv[1] == "borders":
        data = open(argv[2], "rb").read()
        print(json.dumps(render_borders(data, argv[3], argv[4])))
        return 0
    if len(argv) >= 3 and argv[1] == "decode":
        out = None
        if "--out" in argv:
            out = argv[argv.index("--out") + 1]
        src = sys.stdin.buffer.read() if argv[2] == "-" else argv[2]
        data, repaired = decode(src)
        res = {"ok": True, "bytes": len(data), "repaired": repaired}
        if out:
            with open(out, "wb") as f:
                f.write(data)
        else:
            res["data_b64"] = base64.b64encode(data).decode()
        print(json.dumps(res))
        return 0
    sys.stderr.write(__doc__)
    return 2


def main():
    try:
        return _cli(sys.argv)
    except BorderError as e:
        kind = {TooBig: "too_big", NoCode: "no_code", Damaged: "damaged", MissingTools: "missing_tools"}.get(type(e), "error")
        print(json.dumps({"ok": False, "error": str(e), "kind": kind}))
        return 1
    except (OSError, ValueError, IndexError) as e:
        print(json.dumps({"ok": False, "error": str(e), "kind": "error"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
