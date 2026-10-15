.pragma library
// Palette ids in JavaScript: the same layout as bin/omspalette.py (see its header). palette_selftest.js checks both agree.
var MAX_STOPS = 5

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function byte(v, scale) { return clamp(Math.round(v * scale), 0, 255) }
function h2(n) { var s = n.toString(16); return s.length < 2 ? "0" + s : s }
function isHex6(c) { return /^[0-9a-f]{6}$/.test(c) }

function neutral() {
  return { stops: [], keep: 0, sat: 1, con: 1, gam: 1, shadow: ["808080", 0], light: ["808080", 0], steps: 0 }
}

function isId(name) {
  if (typeof name !== "string" || !/^pal-[0-9a-f]{26,66}$/.test(name)) return false
  var n = parseInt(name.charAt(4), 16)
  return (n === 0 || (n >= 2 && n <= 5)) && name.length - 4 === 26 + 8 * n
}

function encode(p) {
  var stops = p.stops.slice().sort(function(a, b) { return a[0] - b[0] })
  var out = "pal-" + stops.length.toString(16)
  stops.forEach(function(s) { out += h2(byte(s[0], 255)) + s[1] })
  out += h2(byte(p.keep, 255)) + h2(byte(p.sat, 128)) + h2(byte(p.con, 128)) + h2(byte(p.gam, 128))
  out += p.shadow[0] + h2(byte(p.shadow[1], 255)) + p.light[0] + h2(byte(p.light[1], 255))
  return out + p.steps.toString(16)
}

function decode(name) {
  if (!isId(name)) return null
  var h = name.substring(4), n = parseInt(h.charAt(0), 16), i = 1, stops = []
  for (var k = 0; k < n; k++) { stops.push([parseInt(h.substr(i, 2), 16) / 255, h.substr(i + 2, 6)]); i += 8 }
  var b = []
  for (k = 0; k < 4; k++) b.push(parseInt(h.substr(i + 2 * k, 2), 16))
  i += 8
  var sh = h.substr(i, 6), sa = parseInt(h.substr(i + 6, 2), 16), li = h.substr(i + 8, 6), la = parseInt(h.substr(i + 14, 2), 16)
  i += 16
  return { stops: stops, keep: b[0] / 255, sat: b[1] / 128, con: b[2] / 128, gam: Math.max(b[3], 13) / 128,
           shadow: [sh, sa / 255], light: [li, la / 255], steps: parseInt(h.charAt(i), 16) }
}

// the colour the ramp gives at brightness t (0..1); "" when there is no ramp
function rampAt(p, t) {
  var s = p.stops
  if (s.length < 2) return ""
  var g = rgb(s[0][1])
  for (var k = 1; k < s.length; k++) {
    var a = s[k - 1][0], b = s[k][0], c = rgb(s[k][1])
    var w = b - a < 1 / 255 ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a), 0, 1)
    g = [g[0] + (c[0] - g[0]) * w, g[1] + (c[1] - g[1]) * w, g[2] + (c[2] - g[2]) * w]
  }
  return "#" + h2(byte(g[0], 255)) + h2(byte(g[1], 255)) + h2(byte(g[2], 255))
}
function rgb(c) { return [parseInt(c.substr(0, 2), 16) / 255, parseInt(c.substr(2, 2), 16) / 255, parseInt(c.substr(4, 2), 16) / 255] }

// a short name for lists and chips
function label(name) {
  var q = decode(name)
  if (!q) return name
  if (q.stops.length < 2) return "Palette (original colours)"
  return "Palette #" + q.stops[0][1] + " to #" + q.stops[q.stops.length - 1][1]
}

function normHex(t) {
  t = String(t).replace(/^#/, "").toLowerCase()
  return isHex6(t) ? t : ""
}

// a few starting points (the fitted copies of the shipped grades come from palettes/presets.tsv)
var starters = [
  { label: "Pastel pink", id: encode({ stops: [[0, "c21770"], [0.5, "ff8fc4"], [1, "fff5fa"]], keep: 0.15, sat: 1, con: 1, gam: 1, shadow: ["808080", 0], light: ["808080", 0], steps: 0 }) },
  { label: "Two colours: navy and peach", id: encode({ stops: [[0, "10204a"], [1, "ffc9a0"]], keep: 0, sat: 1, con: 1, gam: 1, shadow: ["808080", 0], light: ["808080", 0], steps: 0 }) },
  { label: "Warm sepia", id: encode({ stops: [[0, "2b1a0e"], [0.55, "b98a5a"], [1, "f6e6c8"]], keep: 0, sat: 1, con: 1, gam: 1, shadow: ["808080", 0], light: ["808080", 0], steps: 0 }) },
  { label: "Original colours, teal shadows and orange lights", id: encode({ stops: [], keep: 0, sat: 1.1, con: 1, gam: 1, shadow: ["0c6a7a", 0.55], light: ["ff9a40", 0.45], steps: 0 }) },
  { label: "Poster: 4 levels", id: encode({ stops: [], keep: 0, sat: 1.3, con: 1, gam: 1, shadow: ["808080", 0], light: ["808080", 0], steps: 4 }) }
]

if (typeof module !== "undefined") module.exports = { encode: encode, decode: decode, isId: isId, neutral: neutral, rampAt: rampAt, starters: starters, label: label }
