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

// ---- Surprise me: a random palette that stays readable (dark end dark, bright end bright, lightness rising along the ramp)
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360
  var a = s * Math.min(l, 1 - l)
  function f(n) { var k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return h2(byte(f(0), 255)) + h2(byte(f(8), 255)) + h2(byte(f(4), 255))
}
// the colour of this hue and saturation whose brightness (luma) is y, so a ramp really goes dark to bright whatever the hue
function hslY(h, s, y) {
  var lo = 0, hi = 1, c = ""
  for (var i = 0; i < 14; i++) {
    var l = (lo + hi) / 2
    c = hsl(h, s, l)
    var v = rgb(c)
    if (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] < y) lo = l; else hi = l
  }
  return c
}
function pick(list) { return list[Math.floor(Math.random() * list.length)] }
function between(a, b) { return a + Math.random() * (b - a) }

var moods = [
  { name: "soft and milky", sat: [0.35, 0.65], dark: [0.22, 0.38], light: [0.93, 0.98], keep: [0, 0.2], con: [0.9, 1.05] },
  { name: "rich", sat: [0.6, 0.9], dark: [0.07, 0.2], light: [0.82, 0.95], keep: [0, 0.1], con: [1, 1.2] },
  { name: "deep and dark", sat: [0.5, 0.85], dark: [0.03, 0.1], light: [0.6, 0.8], keep: [0, 0.1], con: [1, 1.15] },
  { name: "neon", sat: [0.85, 1], dark: [0.05, 0.14], light: [0.78, 0.92], keep: [0, 0], con: [1.05, 1.25] },
  { name: "faded", sat: [0.2, 0.45], dark: [0.15, 0.3], light: [0.85, 0.95], keep: [0.1, 0.3], con: [0.9, 1] }
]
var schemes = [
  { name: "one hue", spread: function() { return between(-12, 12) } },
  { name: "neighbouring hues", spread: function() { return between(25, 55) * pick([-1, 1]) } },
  { name: "opposite hues", spread: function() { return between(150, 200) } },
  { name: "three hues", spread: function() { return pick([-1, 1]) * between(100, 130) } }
]

function surprise() {
  var mood = pick(moods), scheme = pick(schemes), h0 = Math.random() * 360
  var span = scheme.spread(), sat = between(mood.sat[0], mood.sat[1])
  var p = neutral(), title = scheme.name + ", " + mood.name
  if (Math.random() < 0.15) {
    // no ramp: keep the picture's colours and push the dark and bright parts toward two hues
    p.shadow = [hsl(h0, between(0.55, 0.9), between(0.25, 0.4)), between(0.35, 0.6)]
    p.light = [hsl(h0 + (Math.abs(span) < 40 ? 180 : span), between(0.6, 1), between(0.55, 0.7)), between(0.3, 0.55)]
    p.sat = between(1, 1.3)
    p.con = between(1, 1.15)
    p.title = "Two tints on your own colours"
    return p
  }
  var n = pick([2, 3, 3, 4, 4, 5])
  var lo = between(mood.dark[0], mood.dark[1]), hi = between(mood.light[0], mood.light[1])
  for (var i = 0; i < n; i++) {
    var t = i / (n - 1)
    var pos = i === 0 ? 0 : (i === n - 1 ? 1 : clamp(t + between(-0.08, 0.08), 0.12, 0.88))
    var l = lo + (hi - lo) * Math.pow(t, between(0.85, 1.2))
    var s = sat * (t > 0.85 ? between(0.3, 0.8) : 1)
    p.stops.push([pos, hslY(h0 + span * t, clamp(s, 0, 1), l)])
  }
  p.stops.sort(function(a, b) { return a[0] - b[0] })
  p.keep = between(mood.keep[0], mood.keep[1])
  p.con = between(mood.con[0], mood.con[1])
  p.sat = between(0.95, 1.2)
  p.gam = between(0.9, 1.08)
  if (Math.random() < 0.3) p.shadow = [hsl(h0 + 180, 0.7, 0.3), between(0.15, 0.35)]
  if (Math.random() < 0.3) p.light = [hsl(h0 + span, 0.8, 0.65), between(0.15, 0.35)]
  if (Math.random() < 0.08) p.steps = pick([4, 5, 6, 8])
  p.title = title.charAt(0).toUpperCase() + title.substring(1)
  return p
}

if (typeof module !== "undefined") module.exports = { encode: encode, decode: decode, isId: isId, neutral: neutral, rampAt: rampAt, starters: starters, label: label, surprise: surprise }
