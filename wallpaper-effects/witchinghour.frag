// label: Witching hour
// hint: a witch's crooked hut in a swamp at midnight, a green-glowing cauldron in front with bubbles and purple smoke curling up, an owl blinking in a dead tree and fireflies; the smoke leans toward the pointer and bubbles pop near it
// category: Dark tales
#version 440
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec2 imgSize;
  vec4 cBg;
  vec4 cBlue;
  vec4 cMagenta;
  vec4 cPink;
  vec4 cCream;
  vec4 cTarget;
  float react;
  float range;
  float zoom;
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
float wh_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wh_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh_hash(i), wh_hash(i + vec2(1, 0)), f.x), mix(wh_hash(i + vec2(0, 1)), wh_hash(i + vec2(1, 1)), f.x), f.y);
}
float wh_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * wh_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float wh_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * wh_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float wh_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float wh_box(vec2 q, vec2 h) { vec2 d = abs(q) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float wh_ell(vec2 q, vec2 r) { return (length(q / r) - 1.0) * min(r.x, r.y); }
float wh_seg(vec2 p, vec2 a, vec2 b, float w0, float w1) {
  vec2 ba = b - a;
  float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(p - a - ba * h) - mix(w0, w1, h);
}
float wh_tri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
const float WH_WATER = 0.715;                 // far shore / waterline

// the crooked hut on stilts: local unit s, y grows downward, origin = centre of the floor
float wh_hut(vec2 p, vec2 base, float s) {
  vec2 q = (p - base) / s;
  vec2 b = q; b.x += b.y * 0.12;                                       // walls lean
  float body = wh_box(b - vec2(0.0, -0.20), vec2(0.23, 0.20));
  vec2 r = q; r.x += r.y * 0.04 + 0.03 * sin(q.x * 9.0);              // sagging roof line
  float roof = wh_tri(r, vec2(-0.34, -0.38), vec2(0.36, -0.34), vec2(0.07, -0.80));
  vec2 ch = q - vec2(0.15, -0.66); ch.x += ch.y * 0.35;               // bent chimney
  float chim = wh_box(ch, vec2(0.040, 0.11));
  float porch = wh_box(q - vec2(0.0, 0.0), vec2(0.30, 0.020));
  float leg = min(wh_box(q - vec2(-0.20, 0.10), vec2(0.014, 0.10)), wh_box(q - vec2(0.18, 0.10), vec2(0.014, 0.10)));
  leg = min(leg, wh_box(q - vec2(0.0, 0.10), vec2(0.012, 0.10)));
  return min(min(min(body, roof), min(chim, porch)), leg) * s;
}
float wh_tree(vec2 p, vec2 base, float s) {
  vec2 q = (p - base) / s;
  q += 0.035 * vec2(wh_noise(q * 8.0), wh_noise(q * 8.0 + 5.0)) - 0.0175;
  float d = wh_seg(q, vec2(0.0, 0.0), vec2(-0.015, -0.95), 0.040, 0.014);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float hh = wh_hash(vec2(fi, 3.0));
    float sd = (mod(fi, 2.0) < 0.5) ? -1.0 : 1.0;
    float y0 = -0.26 - 0.11 * fi;
    vec2 a = vec2(0.0, y0);
    float ang = sd * (0.60 + 0.55 * hh);
    float len = 0.30 - 0.025 * fi + 0.06 * hh;
    vec2 b = a + vec2(sin(ang), -cos(ang)) * len;
    d = min(d, wh_seg(q, a, b, 0.016, 0.004));
    vec2 c1 = b + vec2(sin(ang + sd * 0.7), -cos(ang + sd * 0.7)) * len * 0.55;
    vec2 c2 = b + vec2(sin(ang - sd * 0.5), -cos(ang - sd * 0.5)) * len * 0.45;
    d = min(d, wh_seg(q, b, c1, 0.006, 0.0015));
    d = min(d, wh_seg(q, b, c2, 0.005, 0.0012));
  }
  d = min(d, wh_seg(q, vec2(0.0, 0.0), vec2(-0.10, 0.03), 0.040, 0.012));
  d = min(d, wh_seg(q, vec2(0.0, 0.0), vec2(0.10, 0.03), 0.040, 0.012));
  return d * s;
}
// owl: local unit = body height; head with ear tufts, y grows downward
float wh_owl(vec2 q) {
  float d = wh_ell(q - vec2(0.0, 0.10), vec2(0.30, 0.46));
  d = min(d, length(q - vec2(0.0, -0.38)) - 0.30);
  d = min(d, wh_tri(q, vec2(-0.26, -0.50), vec2(-0.12, -0.60), vec2(-0.08, -0.46)) - 0.0);
  d = min(d, wh_tri(q, vec2(0.26, -0.50), vec2(0.12, -0.60), vec2(0.08, -0.46)) - 0.0);
  return d;
}
// cauldron: local unit s = pot height (feet at y=0, rim at y=-0.64)
float wh_pot(vec2 q) {
  float body = max(wh_ell(q - vec2(0.0, -0.36), vec2(0.50, 0.38)), -0.62 - q.y);
  float rim = wh_ell(q - vec2(0.0, -0.64), vec2(0.52, 0.10));
  float lip = max(rim, -(wh_ell(q - vec2(0.0, -0.645), vec2(0.455, 0.075))));
  float legs = min(wh_box(q - vec2(-0.30, 0.0), vec2(0.045, 0.07)), wh_box(q - vec2(0.30, 0.0), vec2(0.045, 0.07)));
  legs = min(legs, wh_box(q - vec2(0.0, 0.01), vec2(0.04, 0.06)));
  float handle = min(abs(length(q - vec2(-0.55, -0.50)) - 0.075) - 0.014, abs(length(q - vec2(0.55, -0.50)) - 0.075) - 0.014);
  return min(min(body, lip), min(legs, handle));
}
float wh_m(float sd, float aa) { return smoothstep(aa, -aa, sd); }

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  float aa = 1.4 / res.y;
  vec3 pic = wall(uv);
  float pl = wh_luma(pic);
  vec3 green = vec3(0.45, 1.0, 0.34);
  vec3 violet = vec3(0.50, 0.18, 0.72);
  vec3 sil = vec3(0.012, 0.010, 0.022);

  // the cauldron's place (needed for light everywhere)
  vec2 cb = vec2(asp * 0.57, 0.955);
  float cs = 0.30;
  vec2 mouth = cb + vec2(0.0, -0.64 * cs);
  float flick = 0.88 + 0.08 * sin(t * 3.1) + 0.04 * sin(t * 7.3 + 1.0);

  // ---- sky: deep violet-black, a faint green sheen near the horizon, the picture's stars faintly through
  float up = 1.0 - clamp(uv.y / WH_WATER, 0.0, 1.0);
  vec3 sky = mix(vec3(0.150, 0.130, 0.240), vec3(0.018, 0.014, 0.060), pow(up, 0.55));
  sky += vec3(0.07, 0.04, 0.12) * min(pl, 0.55) * (0.4 + 0.6 * up);
  // a thin crescent moon veiled by cloud
  vec2 moon = vec2(asp * 0.43, 0.17);
  float dmn = length(p - moon);
  float cres = smoothstep(0.036 + aa, 0.036 - aa, dmn) * smoothstep(0.030 - aa, 0.030 + aa, length(p - moon - vec2(0.020, -0.008)));
  sky += vec3(0.62, 0.66, 0.86) * (exp(-dmn / 0.05) * 0.14 + exp(-dmn / 0.25) * 0.07);
  vec2 cq = vec2(p.x * 1.3 - t * 0.012, p.y * 6.0);
  float cl = wh_fbm(cq + wh_fbm3(cq * 0.7 + t * 0.01) * 1.2);
  float veil = smoothstep(0.42, 0.74, cl) * smoothstep(0.02, 0.5, up);
  sky = mix(sky, vec3(0.07, 0.06, 0.15) + vec3(0.25, 0.28, 0.40) * exp(-dmn / 0.18) * 0.4, veil * 0.55);
  sky = mix(sky, vec3(0.86, 0.88, 0.97) * (1.0 - 0.5 * veil), cres);
  vec3 col = sky;

  // far swamp trees: a ragged dark line with hanging moss
  float ft = WH_WATER - 0.035 - 0.05 * wh_fbm3(vec2(p.x * 5.0 + 2.0, 1.0)) - 0.02 * pow(wh_noise(vec2(p.x * 36.0, 5.0)), 2.0);
  float fm = smoothstep(ft - aa, ft + aa, uv.y);
  col = mix(col, vec3(0.032, 0.030, 0.062), fm);

  // ---- water: dark glass, a green reflection of the cauldron glow, ripples
  float wm = smoothstep(WH_WATER - aa, WH_WATER + aa, uv.y);
  float dw = max(uv.y - WH_WATER, 0.0);
  vec3 water = mix(vec3(0.050, 0.060, 0.110), vec3(0.010, 0.014, 0.030), smoothstep(0.0, 0.3, dw));
  float rip = wh_fbm3(vec2(p.x * 22.0 + sin(uv.y * 40.0 + t * 0.5) * 0.3, uv.y * 90.0 - t * 0.35));
  water += vec3(0.06, 0.08, 0.12) * smoothstep(0.5, 0.8, rip) * (1.0 - smoothstep(0.0, 0.25, dw));
  // reflection of the moon / sky glow
  water += vec3(0.10, 0.12, 0.20) * exp(-abs(p.x - moon.x) / 0.05) * smoothstep(0.3, 0.0, dw) * (0.4 + 0.6 * rip);
  col = mix(col, water, wm);

  // ---- the hut (left) and its reflection
  vec2 hb = vec2(asp * 0.255, 0.700);
  float hs = 0.40;
  float dH = wh_hut(p, hb, hs);
  float mH = wh_m(dH, aa);
  col = mix(col, sil, mH);
  // windows and door: sickly green-yellow light
  vec2 hq = (p - hb) / hs;
  vec2 hqs = hq; hqs.x += hqs.y * 0.12;
  float win = wh_box(hqs - vec2(-0.08, -0.22), vec2(0.045, 0.055));
  float win2 = length(hqs - vec2(0.10, -0.31)) - 0.034;
  float door = min(wh_box(hqs - vec2(0.10, -0.095), vec2(0.040, 0.075)), length(hqs - vec2(0.10, -0.17)) - 0.040);
  vec3 lamp = vec3(0.80, 1.0, 0.38);
  float fk = 0.85 + 0.15 * sin(t * 6.7 + 2.0) * sin(t * 3.9);
  float lit = max(max(wh_m(win * hs, aa * 1.5), wh_m(win2 * hs, aa * 1.5)), wh_m(door * hs, aa * 1.5) * 0.6);
  col = mix(col, lamp * fk, lit * mH);
  col += lamp * 0.11 * exp(-dot(p - (hb + vec2(-0.08, -0.22) * hs), p - (hb + vec2(-0.08, -0.22) * hs)) / 0.0025) * fk;
  // reflection in the water: the hut mirrored, wobbling
  vec2 rp = vec2(p.x + 0.004 * sin(uv.y * 130.0 + t * 1.5), 2.0 * hb.y - p.y + 0.06 * hs);
  float dR = wh_hut(rp, hb, hs);
  col += vec3(0.02, 0.02, 0.05) * wh_m(dR, 0.01) * wm * (1.0 - smoothstep(0.0, 0.14, dw)) * 0.0;
  col = mix(col, sil * 1.2, wh_m(dR, 0.004) * wm * 0.55 * (1.0 - smoothstep(0.0, 0.16, dw)) * smoothstep(0.0, 0.01, dw));

  // ---- dead tree on the right, with the owl
  vec2 tb = vec2(asp * 0.875, 0.785);
  float dT = wh_tree(p, tb, 0.60);
  vec2 owlPos = vec2(asp * 0.805, 0.485);
  float dBr = wh_seg(p, vec2(tb.x - 0.002, 0.555), vec2(asp * 0.755, 0.490), 0.010, 0.0035);
  float dTree = min(dT, dBr);
  float mTree = wh_m(dTree, aa);
  col = mix(col, sil, mTree);
  // owl
  float os = 0.105;
  vec2 oq = (p - owlPos) / os;
  float dO = wh_owl(oq) * os;
  float mO = wh_m(dO, aa);
  col = mix(col, sil * 1.4, mO);
  float blinkPh = fract(t / 5.7);
  float open = 1.0 - smoothstep(0.955, 0.965, blinkPh) * (1.0 - smoothstep(0.975, 0.99, blinkPh));
  open *= 1.0 - 0.9 * (smoothstep(0.50, 0.505, fract(t / 9.3)) * (1.0 - smoothstep(0.515, 0.52, fract(t / 9.3))));
  vec2 look = onScr ? normalize(mp - owlPos + 1e-5) * min(length(mp - owlPos) * 2.0, 1.0) : vec2(0.0);
  vec3 eyeC = vec3(1.0, 0.82, 0.18);
  for (int k = 0; k < 2; k++) {
    float sx = (k == 0) ? -1.0 : 1.0;
    vec2 ec = owlPos + vec2(sx * 0.115, -0.395) * os;
    vec2 de = (p - ec) / (0.075 * os / 0.105 * 0.0 + 0.0085);
    de.y /= max(open, 0.08);
    float eye = smoothstep(1.0, 0.6, length(de));
    float pup = smoothstep(0.42, 0.28, length(de - look * 0.30));
    col += eyeC * exp(-dot(p - ec, p - ec) / 0.0006) * 0.30 * open;
    col = mix(col, eyeC * 1.1, eye * mO);
    col = mix(col, vec3(0.03, 0.01, 0.0), pup * eye * mO * 0.9);
  }

  // ---- purple smoke curling up from the cauldron; it leans toward the pointer
  float h = max(mouth.y - p.y, 0.0);
  float lean = onScr ? clamp((mp.x - mouth.x) * 0.9, -0.55, 0.55) : 0.0;
  float smokeA = 0.0;
  for (int k = 0; k < 2; k++) {
    float fk2 = float(k);
    float curl = 0.050 * sin(h * 9.0 - t * 0.9 + fk2 * 2.7) * smoothstep(0.0, 0.25, h) + 0.025 * sin(h * 20.0 - t * 1.7 + fk2);
    float xc = mouth.x + (fk2 - 0.5) * 0.04 + curl + lean * h * h / (h + 0.25) * 1.6;
    float w = 0.020 + 0.115 * h;
    float dx = (p.x - xc) / w;
    float nn = wh_fbm(vec2(dx * 1.6 + fk2 * 5.0, h * 7.0 - t * 0.55));
    float dens = exp(-dx * dx) * smoothstep(0.22, 0.66, nn + 0.20 * (1.0 - smoothstep(0.0, 0.2, h)));
    dens *= smoothstep(0.0, 0.03, mouth.y - p.y) * (1.0 - smoothstep(0.35, 0.80, h));
    smokeA += dens * (0.85 - 0.25 * fk2);
  }
  smokeA = clamp(smokeA, 0.0, 0.85);
  vec3 smokeC = mix(green * 0.50 + violet * 0.45, vec3(0.62, 0.22, 0.90) * 0.85, smoothstep(0.0, 0.22, h));
  smokeC *= 0.7 + 0.5 * exp(-h / 0.25);
  col = mix(col, smokeC, smokeA);

  // ---- the near bank, reeds and the cauldron
  float bank = 0.905 - 0.045 * exp(-pow((p.x - cb.x) / 0.30, 2.0)) + 0.02 * wh_fbm3(vec2(p.x * 4.0, 9.0));
  float bm = smoothstep(bank - aa, bank + aa, uv.y);
  vec3 mud = vec3(0.075, 0.062, 0.095) * (1.0 - 0.6 * smoothstep(bank, 1.0, uv.y)) * (0.8 + 0.4 * wh_fbm3(vec2(p.x * 30.0, uv.y * 60.0))) + green * 0.045 * exp(-abs(p.x - cb.x) / 0.30) * (1.0 - smoothstep(bank, 1.0, uv.y)) * flick;
  col = mix(col, mud, bm);
  col += vec3(0.20, 0.24, 0.36) * 0.35 * smoothstep(0.012, 0.0, abs(uv.y - bank)) + green * 0.12 * smoothstep(0.02, 0.0, abs(uv.y - bank)) * exp(-abs(p.x - cb.x) / 0.25);
  // reeds and cattails at the sides
  float rcell = floor(p.x * 34.0);
  float rh = wh_hash(vec2(rcell, 3.0));
  float rx = fract(p.x * 34.0) - 0.5 + 0.18 * sin(uv.y * 7.0 + rh * 6.0);
  float side = smoothstep(0.30, 0.55, abs(uv.x - 0.5));
  float rtop = 0.95 - 0.34 * rh * side - 0.05;
  float reed = smoothstep(0.13, 0.03, abs(rx) * (1.0 + 4.0 * (uv.y - rtop))) * step(rtop, uv.y) * step(0.30, rh) * step(0.15, side);
  float cat = smoothstep(0.16, 0.06, abs(rx)) * step(rtop, uv.y) * step(uv.y, rtop + 0.045) * step(0.6, rh) * step(0.15, side);
  col = mix(col, sil, clamp(reed + cat, 0.0, 1.0));
  // the pot
  vec2 pq = (p - cb) / cs;
  float dP = wh_pot(pq) * cs;
  float mP = wh_m(dP, aa);
  float rimLight = smoothstep(-0.012, 0.0, dP) * mP;
  vec3 potC = sil + green * 0.07 * smoothstep(-0.1, -0.62, pq.y) + vec3(0.5, 0.25, 0.1) * 0.04 * smoothstep(-0.2, 0.0, pq.y);
  col = mix(col, potC, mP);
  col += green * rimLight * 0.30 * flick * smoothstep(0.1, -0.6, pq.y);
  // the brew: a bright glowing surface with slow swirls
  vec2 bq = (p - mouth) / cs;
  float surf = wh_ell(bq, vec2(0.455, 0.075));
  float mB = wh_m(surf * cs, aa);
  float sw = wh_fbm3(vec2(bq.x * 6.0 + sin(t * 0.5) * 0.4, bq.y * 22.0) + t * 0.25);
  vec3 brew = mix(vec3(0.20, 0.70, 0.18), vec3(0.78, 1.0, 0.55), smoothstep(0.35, 0.8, sw));
  brew *= 0.9 + 0.2 * flick;
  col = mix(col, brew, mB);
  // little flames licking the legs (warm, tiny)
  float fl = exp(-pow((p.x - cb.x) / (0.11 * (0.8 + 0.2 * sin(t * 5.0))), 2.0)) * exp(-pow((uv.y - (cb.y + 0.005)) / 0.014, 2.0));
  col += vec3(1.0, 0.45, 0.12) * fl * 0.22;

  // green light spilling around the pot, onto the smoke, the water and the mud
  vec2 gd = p - mouth;
  col += green * (exp(-dot(gd * vec2(0.8, 1.2), gd * vec2(0.8, 1.2)) / 0.030) * 0.34 + exp(-length(gd) / 0.35) * 0.10) * flick * (1.0 - 0.7 * mP * (1.0 - mB));
  // its reflection streak in the water above the near bank
  col += green * 0.07 * exp(-pow((p.x - cb.x) / 0.07, 2.0)) * wm * (1.0 - bm) * (0.4 + rip) * smoothstep(WH_WATER, 0.80, uv.y);

  // ---- bubbles: rise from the brew and drift out; they pop by themselves, and sooner when the pointer comes near
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float hh = wh_hash(vec2(fi, 4.0));
    float h2 = wh_hash(vec2(fi, 8.0));
    float per = 4.0 + 3.0 * h2;
    float ph = fract(t / per + hh);
    float cy = floor(t / per + hh);
    float bx = (wh_hash(vec2(fi, cy + 5.0)) - 0.5) * 0.80 * 0.45;
    vec2 bp = mouth + vec2(bx * cs * 2.0 * (0.3 + ph), -ph * (0.10 + 0.20 * h2) - 0.015) + vec2(0.012 * sin(ph * 11.0 + fi), 0.0);
    float br = cs * (0.028 + 0.030 * h2) * (0.6 + 0.4 * ph);
    float pop = 0.0;
    float life = 1.0;
    if (onScr) {
      float dp = length(bp - mp);
      float near = smoothstep(0.20, 0.05, dp);
      life = 1.0 - near * 0.0;
      pop = near;
    }
    float endPh = 0.92 - 0.45 * pop * h2;                      // the pointer shortens their life
    float live = step(ph, endPh) * smoothstep(0.0, 0.08, ph);
    float rb = length(p - bp);
    float ring = smoothstep(1.4 * aa, 0.0, abs(rb - br)) * 0.9 + smoothstep(br, 0.0, rb) * 0.18;
    float hi = smoothstep(br * 0.38, 0.0, length(p - bp + vec2(br * 0.35, br * 0.35))) * 0.8;
    col += (green * (ring + 0.35 * hi) + vec3(0.8, 1.0, 0.8) * hi * 0.4) * live;
    // the pop: a quick burst of droplets and a fading ring
    float pa = clamp((ph - endPh) / 0.07, 0.0, 1.0);
    float burst = step(endPh, ph) * step(ph, endPh + 0.07) * (1.0 - pa);
    float rr = br * (1.0 + 2.6 * pa);
    float pr = smoothstep(2.0 * aa, 0.0, abs(rb - rr)) * burst;
    float sp = 0.0;
    for (int k = 0; k < 4; k++) {
      float a = float(k) * 1.5708 + 0.6 + fi;
      sp += smoothstep(1.8 * aa, 0.0, length(p - bp - vec2(cos(a), sin(a)) * br * (1.2 + 3.0 * pa)));
    }
    col += (green * 1.0 + 0.2) * (pr * 0.8 + sp * 0.7 * burst);
  }
  // pointer in the water: marsh bubbles rise and pop around it
  if (onScr && mp.y > WH_WATER - 0.02) {
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float per = 2.2 + 0.6 * fi;
      float ph = fract(t / per + fi * 0.27);
      float cy = floor(t / per + fi * 0.27);
      vec2 o = vec2((wh_hash(vec2(fi, cy)) - 0.5) * 0.16, (wh_hash(vec2(fi + 7.0, cy)) - 0.5) * 0.05);
      vec2 bp = mp + o;
      float rb = length((p - bp) * vec2(1.0, 2.2));
      float grow = smoothstep(0.0, 0.7, ph);
      float ring = smoothstep(2.0 * aa, 0.0, abs(rb - 0.006 - 0.028 * grow)) * (1.0 - smoothstep(0.6, 1.0, ph));
      float dot0 = smoothstep(0.007, 0.0, rb) * smoothstep(0.55, 0.0, ph);
      col += (green * 0.7 + 0.1) * (ring * 0.7 + dot0 * 0.7);
    }
  }

  // ---- fireflies over the water and the reeds
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float hx = wh_hash(vec2(fi, 31.0));
    float hy = wh_hash(vec2(fi, 37.0));
    float hs2 = wh_hash(vec2(fi, 41.0));
    vec2 fp = vec2(asp * (0.05 + 0.90 * hx) + 0.05 * sin(t * 0.3 * (0.5 + hs2) + fi * 3.0), 0.55 + 0.38 * hy + 0.035 * sin(t * 0.4 + fi * 2.0));
    if (onScr) { vec2 dd = fp - mp; float dl = length(dd) + 1e-4; fp += dd / dl * exp(-dl * dl / 0.02) * 0.06; }  // they shy away a little
    float blink = smoothstep(0.35, 0.9, 0.5 + 0.5 * sin(t * (0.9 + hs2) + fi * 5.0));
    float d2 = dot(p - fp, p - fp);
    col += vec3(0.78, 1.0, 0.40) * (exp(-d2 / 0.000035) * 0.9 + exp(-d2 / 0.0012) * 0.16) * blink;
  }

  // ground mist over the water
  float mist = smoothstep(0.35, 0.8, wh_fbm(vec2(p.x * 2.2 - t * 0.03, p.y * 9.0 + 5.0))) * exp(-pow((uv.y - 0.77) / 0.07, 2.0));
  col = mix(col, vec3(0.20, 0.22, 0.34) + green * 0.05, mist * 0.32);

  // vignette
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
  return vec4(col, 1.0) * qt_Opacity;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored, above 1 = exaggerated (extrapolated from the no-pointer look)
void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
