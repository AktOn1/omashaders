// label: Graveyard mist
// hint: an old cemetery at night with leaning crosses, a weeping angel statue and a dead tree under a veiled moon, low mist drifting between the stones, green-white wisps rising; the pointer calls the wisps to gather around it
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
float gm_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gm_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gm_hash(i), gm_hash(i + vec2(1, 0)), f.x), mix(gm_hash(i + vec2(0, 1)), gm_hash(i + vec2(1, 1)), f.x), f.y);
}
float gm_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * gm_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float gm_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * gm_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float gm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 gm_rot(vec2 q, float a) { float c = cos(a), s = sin(a); return vec2(c * q.x - s * q.y, s * q.x + c * q.y); }
float gm_box(vec2 q, vec2 h) { vec2 d = abs(q) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float gm_ell(vec2 q, vec2 r) { return (length(q / r) - 1.0) * min(r.x, r.y); }
float gm_seg(vec2 p, vec2 a, vec2 b, float w0, float w1) {
  vec2 ba = b - a;
  float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(p - a - ba * h) - mix(w0, w1, h);
}

const float GM_HZ = 0.66;                       // horizon

// a cross, leaning: base point, size, lean angle. y grows downward so "up" is -y
float gm_cross(vec2 p, vec2 base, float s, float lean) {
  vec2 q = gm_rot(p - base, -lean) / s;
  float d1 = gm_box(q + vec2(0.0, 0.50), vec2(0.075, 0.50));
  float d2 = gm_box(q + vec2(0.0, 0.74), vec2(0.27, 0.07));
  return min(d1, d2) * s;
}
// a headstone with a rounded top
float gm_stone(vec2 p, vec2 base, float s, float lean, float wd) {
  vec2 q = gm_rot(p - base, -lean) / s;
  float d1 = gm_box(q + vec2(0.0, 0.40), vec2(wd, 0.40));
  float d2 = length(q + vec2(0.0, 0.80)) - wd;
  return min(d1, d2) * s;
}
// an obelisk
float gm_obel(vec2 p, vec2 base, float s, float lean) {
  vec2 q = gm_rot(p - base, -lean) / s;
  float h = -q.y;
  float hw = mix(0.17, 0.09, clamp(h / 1.0, 0.0, 1.0));
  float d = max(abs(q.x) - hw, max(-h, h - 1.0));
  float cap = max(abs(q.x) - (1.0 - clamp((h - 1.0) / 0.14, 0.0, 1.0)) * 0.09, max(1.0 - h, h - 1.14));
  return min(d, cap) * s;
}
// one row of grave markers (cells along x, a marker per cell, three neighbours checked)
float gm_row(vec2 p, float baseY, float s, float dens, float seed, float cover) {
  float cell = floor(p.x * dens);
  float d = 1.0;
  for (int k = -1; k <= 1; k++) {
    float id = cell + float(k);
    float h1 = gm_hash(vec2(id, seed));
    float h2 = gm_hash(vec2(id, seed + 5.0));
    float h3 = gm_hash(vec2(id, seed + 9.0));
    if (h1 > cover) continue;
    vec2 base = vec2((id + 0.2 + 0.6 * h2) / dens, baseY + (h3 - 0.5) * 0.02 * s / 0.1);
    float ss = s * (0.7 + 0.6 * h3);
    float lean = (h2 - 0.5) * 0.36;
    float dd;
    float typ = gm_hash(vec2(id, seed + 13.0));
    if (typ < 0.38) dd = gm_cross(p, base, ss * 1.1, lean);
    else if (typ < 0.80) dd = gm_stone(p, base, ss, lean, 0.22 + 0.12 * h1);
    else dd = gm_obel(p, base, ss * 1.2, lean * 0.4);
    d = min(d, dd);
  }
  return d;
}
// the angel statue on its plinth: local unit s = statue height; y grows downward
float gm_angel(vec2 p, vec2 base, float s) {
  vec2 q = (p - base) / s;
  float h = -q.y;
  float plinth = min(gm_box(q + vec2(0.0, 0.07), vec2(0.21, 0.07)), gm_box(q + vec2(0.0, 0.17), vec2(0.155, 0.035)));
  float t = clamp((h - 0.20) / 0.50, 0.0, 1.0);
  float hw = mix(0.185, 0.075, pow(t, 0.7));
  float robe = max(abs(q.x - 0.01 * t) - hw, max(0.20 - h, h - 0.70));
  float shoulder = gm_ell(q + vec2(-0.01, 0.69), vec2(0.115, 0.06));
  float head = length(q - vec2(0.035, -0.785)) - 0.060;
  float neck = gm_box(q + vec2(-0.02, 0.72), vec2(0.026, 0.04));
  float armL = gm_seg(q, vec2(-0.085, -0.66), vec2(-0.02, -0.50), 0.042, 0.036);
  float armR = gm_seg(q, vec2(0.105, -0.66), vec2(0.04, -0.50), 0.042, 0.036);
  vec2 wl = gm_rot(q - vec2(-0.185, -0.80), 0.45);
  vec2 wr = gm_rot(q - vec2(0.205, -0.80), -0.45);
  float wingL = gm_ell(wl, vec2(0.075, 0.27 + 0.012 * sin(wl.y * 40.0)));
  float wingR = gm_ell(wr, vec2(0.075, 0.27 + 0.012 * sin(wr.y * 40.0)));
  vec2 wl2 = gm_rot(q - vec2(-0.125, -0.75), 0.12);
  vec2 wr2 = gm_rot(q - vec2(0.145, -0.75), -0.12);
  wingL = min(wingL, gm_ell(wl2, vec2(0.055, 0.22)));
  wingR = min(wingR, gm_ell(wr2, vec2(0.055, 0.22)));
  float d = min(min(plinth, robe), min(shoulder, min(head, neck)));
  d = min(d, min(min(wingL, wingR), min(armL, armR)));
  return d * s;
}
float gm_dtree(vec2 p, vec2 base, float s) {
  vec2 q = (p - base) / s;
  q += 0.035 * vec2(gm_noise(q * 8.0), gm_noise(q * 8.0 + 5.0)) - 0.0175;
  float d = gm_seg(q, vec2(0.0, 0.0), vec2(0.015, -0.95), 0.040, 0.014);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float hh = gm_hash(vec2(fi, 3.0));
    float sd = (mod(fi, 2.0) < 0.5) ? -1.0 : 1.0;
    float y0 = -0.28 - 0.11 * fi;
    vec2 a = vec2(0.012 * (-y0), y0);
    float ang = sd * (0.55 + 0.55 * hh);
    float len = 0.30 - 0.025 * fi + 0.06 * hh;
    vec2 b = a + vec2(sin(ang), -cos(ang)) * len;
    d = min(d, gm_seg(q, a, b, 0.016, 0.004));
    vec2 c1 = b + vec2(sin(ang + sd * 0.7), -cos(ang + sd * 0.7)) * len * 0.55;
    vec2 c2 = b + vec2(sin(ang - sd * 0.5), -cos(ang - sd * 0.5)) * len * 0.45;
    d = min(d, gm_seg(q, b, c1, 0.006, 0.0015));
    d = min(d, gm_seg(q, b, c2, 0.005, 0.0012));
  }
  d = min(d, gm_seg(q, vec2(0.015, -0.95), vec2(0.07, -1.12), 0.012, 0.003));
  d = min(d, gm_seg(q, vec2(0.015, -0.95), vec2(-0.08, -1.08), 0.011, 0.003));
  d = min(d, gm_seg(q, vec2(0.0, 0.0), vec2(-0.09, 0.03), 0.040, 0.012));
  d = min(d, gm_seg(q, vec2(0.0, 0.0), vec2(0.09, 0.03), 0.040, 0.012));
  return d * s;
}
float gm_mistl(vec2 p, float yc, float th, float sc, float sp, float seed, float t) {
  float n = gm_fbm(vec2(p.x * sc - t * sp, p.y * sc * 2.6) + seed);
  float prof = exp(-pow((p.y - yc) / th, 2.0));
  return prof * smoothstep(0.28, 0.78, n);
}
float gm_m(float sd, float aa) { return smoothstep(aa, -aa, sd); }

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
  float pl = gm_luma(pic);

  // ---- sky: cold blue-green, brighter low down, the picture's stars show faintly through
  float up = 1.0 - clamp(uv.y / GM_HZ, 0.0, 1.0);
  vec3 skyHi = vec3(0.012, 0.028, 0.045);
  vec3 skyLo = vec3(0.11, 0.18, 0.19);
  vec3 sky = mix(skyLo, skyHi, smoothstep(0.0, 1.0, pow(up, 0.55)));
  sky += vec3(0.10, 0.15, 0.15) * min(pl, 0.55) * (0.5 + 0.5 * up);
  // moon and its veil of thin cloud
  vec2 moon = vec2(asp * 0.27, 0.22);
  float dmn = length(p - moon);
  float disc = smoothstep(0.050 + aa, 0.050 - aa, dmn);
  float crater = 0.85 + 0.15 * gm_fbm3((p - moon) * 26.0);
  vec3 moonC = vec3(0.86, 0.93, 0.90);
  vec2 cq = vec2(p.x * 1.3 - t * 0.014, p.y * 7.0);
  float cl = gm_fbm(cq + gm_fbm3(cq * 0.8 + t * 0.01) * 1.3);
  float veil = smoothstep(0.42, 0.74, cl) * smoothstep(0.02, 0.45, up);
  sky += moonC * (exp(-dmn / 0.06) * 0.26 + exp(-dmn / 0.30) * 0.13) * (1.0 - 0.25 * veil);
  sky = mix(sky, vec3(0.07, 0.11, 0.13) + moonC * 0.10 * exp(-dmn / 0.2), veil * 0.45);
  float shade = 0.86 - 0.18 * smoothstep(-0.05, 0.05, p.x - moon.x + (p.y - moon.y) * 0.4);   // the lit limb
  sky = mix(sky, moonC * crater * shade, disc);
  // a thin cloud crossing the moon, lit along its edge
  float by = p.y - moon.y - 0.006 - 0.010 * sin(p.x * 6.0 + t * 0.03) - 0.02 * (gm_fbm3(vec2(p.x * 5.0 - t * 0.02, 1.0)) - 0.5);
  float band = exp(-pow(by / 0.013, 2.0)) * smoothstep(0.30, 0.65, gm_fbm3(vec2(p.x * 9.0 - t * 0.035, p.y * 30.0)));
  vec3 cloudC = vec3(0.10, 0.15, 0.17) + moonC * 0.22 * exp(-dmn / 0.10);
  sky = mix(sky, cloudC, band * 0.75);

  // ---- distant hills and ground
  float hill = 0.640 + 0.028 * gm_fbm3(vec2(p.x * 2.2 + 3.0, 2.0)) - 0.012 * sin(p.x * 3.1);
  vec3 col = sky;
  col = mix(col, vec3(0.030, 0.050, 0.058), smoothstep(hill + aa, hill - aa, uv.y) * 0.0 + smoothstep(hill - aa, hill + aa, uv.y));
  float gdepth = clamp((uv.y - hill) / (1.0 - hill), 0.0, 1.0);
  vec3 ground = mix(vec3(0.045, 0.072, 0.078), vec3(0.008, 0.014, 0.016), pow(gdepth, 0.55));
  float grass = gm_noise(vec2(p.x * 90.0, uv.y * 26.0)) * gm_noise(vec2(p.x * 17.0, uv.y * 40.0));
  ground += vec3(0.02, 0.035, 0.03) * grass * (1.0 - gdepth);
  ground += vec3(0.04, 0.06, 0.06) * exp(-abs(p.x - moon.x) / 0.5) * (1.0 - gdepth) * 0.6;
  col = mix(col, ground, smoothstep(hill - aa, hill + aa, uv.y));

  // pointer: gently stirs the mist near it (shifts the noise)
  float stir = onScr ? exp(-dot(p - mp, p - mp) / 0.05) : 0.0;
  vec2 pm = p + vec2(0.05 * stir * sin(t * 0.6), -0.015 * stir);

  vec3 mistC = vec3(0.34, 0.47, 0.46);
  vec3 sil = vec3(0.007, 0.013, 0.016);
  vec3 rimC = vec3(0.22, 0.30, 0.30);

  // far mist behind the first markers
  float m0 = gm_mistl(pm, 0.665, 0.050, 3.2, 0.045, 1.0, t);
  col = mix(col, mistC * 0.85, m0 * 0.62);

  // ---- far row of markers
  float dFar = gm_row(p, 0.690, 0.055, 9.0, 21.0, 0.75);
  float mFar = gm_m(dFar, aa);
  col = mix(col, mix(vec3(0.020, 0.036, 0.042), sil, 0.5), mFar);

  // dead tree on the left, against the sky
  float dT = gm_dtree(p, vec2(asp * 0.115, 0.745), 0.46);
  float mT = gm_m(dT, aa);
  float tr = smoothstep(0.50, 0.20, uv.y);
  col = mix(col, sil + rimC * 0.07 * tr, mT);

  // the little owl's perch is elsewhere; here, mist rolls between the rows
  float m1 = gm_mistl(pm, 0.735, 0.060, 2.4, 0.060, 7.0, t);
  col = mix(col, mistC, m1 * 0.66);

  // ---- middle row and the angel
  float dMid = gm_row(p, 0.775, 0.095, 5.2, 41.0, 0.82);
  float mMid = gm_m(dMid, aa);
  float rimMid = smoothstep(-0.006, 0.0, dMid) * (1.0 - smoothstep(0.0, 0.05, uv.y - (0.775 - 0.09)));
  col = mix(col, sil + vec3(0.02, 0.03, 0.03), mMid);
  col += rimC * 0.25 * mMid * smoothstep(-0.007, 0.0, dMid);

  vec2 ab = vec2(asp * 0.665, 0.815);
  float sA = 0.44;
  if (abs(p.x - ab.x) < 0.42 * sA && p.y > ab.y - 1.12 * sA && p.y < ab.y + 0.01) {
    float dA = gm_angel(p, ab, sA);
    float e = 0.004;
    vec2 g = vec2(gm_angel(p + vec2(e, 0.0), ab, sA) - gm_angel(p - vec2(e, 0.0), ab, sA),
                  gm_angel(p + vec2(0.0, e), ab, sA) - gm_angel(p - vec2(0.0, e), ab, sA));
    vec2 nrm = normalize(g + 1e-6);
    vec2 toMoon = normalize(moon - ab);
    float facing = max(dot(-nrm, toMoon) * -1.0 + 0.0, 0.0);
    float mA = gm_m(dA, aa);
    float band = smoothstep(-0.010, 0.0, dA);
    vec3 stat = sil + vec3(0.025, 0.04, 0.042) * smoothstep(ab.y - 0.45, ab.y - 0.1, uv.y) * 0.0;
    col = mix(col, stat, mA);
    col += vec3(0.50, 0.64, 0.62) * mA * band * (0.04 + 0.42 * max(dot(nrm, -toMoon), 0.0));
  }

  // the mist in front of the angel's plinth, thicker in the middle ground
  float m2 = gm_mistl(pm, 0.805, 0.055, 2.0, 0.075, 13.0, t);
  col = mix(col, mistC * 1.05, m2 * 0.66);

  // ---- near row (dark, big, cropped) with moonlit tops
  float dNear = gm_row(p, 0.985, 0.30, 2.6, 61.0, 0.70);
  float mNear = gm_m(dNear, aa);
  vec3 nearC = sil * 0.9;
  col = mix(col, nearC, mNear);
  col += rimC * 0.22 * mNear * smoothstep(-0.010, 0.0, dNear);

  // ---- wisps: green-white lights that rise from the graves; near the pointer they gather around it
  vec3 wispC = vec3(0.66, 1.0, 0.82);
  float wsum = 0.0;
  float wglow = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float hx = gm_hash(vec2(fi, 11.0));
    float hy = gm_hash(vec2(fi, 17.0));
    float hs = gm_hash(vec2(fi, 23.0));
    float per = 11.0 + 6.0 * hs;
    float ph = fract(t / per + hy);
    float cyc = floor(t / per + hy);
    float x0 = asp * (0.06 + 0.88 * gm_hash(vec2(fi, cyc + 31.0)));
    float rise = ph;
    vec2 h = vec2(x0 + 0.035 * sin(ph * 7.0 + fi * 2.0) , mix(0.80, 0.30, rise));
    float fade = smoothstep(0.0, 0.16, ph) * (1.0 - smoothstep(0.65, 1.0, ph));
    float on = 1.0;
    if (i >= 6) {                                               // three extra wisps exist only while the pointer is here
      float ang = fi * 2.4 + t * 0.35;
      h = mp + vec2(cos(ang), 0.7 * sin(ang * 1.3)) * (0.07 + 0.035 * hs);
      on = onScr ? 1.0 : 0.0;
      fade = 0.55 + 0.45 * sin(t * 0.9 + fi);
    } else if (onScr) {                                         // the others lean in
      vec2 dd = mp - h;
      float pull = exp(-dot(dd, dd) / 0.20);
      h += dd * 0.72 * pull;
    }
    vec2 d = p - h;
    float head = exp(-dot(d, d) / 0.00011);
    float dy = max(d.y, 0.0);                                   // tail trails below the head
    float sway = 0.010 * sin(dy * 16.0 - t * 1.6 + fi * 1.7) * min(dy * 6.0, 1.0);
    float wdt = 0.0030 + 0.012 * dy;
    float tail = exp(-pow((d.x - sway) / wdt, 2.0)) * exp(-dy / 0.085) * step(0.0, d.y) * smoothstep(0.0, 0.01, d.y);
    float halo = exp(-dot(d, d) / 0.0030);
    wsum += (head * 1.0 + tail * 0.50) * fade * on;
    wglow += halo * fade * on;
  }
  col += wispC * wglow * 0.18;                                  // greenish light on the mist and the stones
  col = mix(col, wispC * 1.15, clamp(wsum, 0.0, 1.0) * 0.55 * 0.0);
  col += wispC * wsum * 0.55;

  // low ground mist in front of everything, lit faintly by the wisps
  float m3 = gm_mistl(pm, 0.965, 0.090, 1.5, 0.090, 29.0, t);
  col = mix(col, mistC * 0.95 + wispC * wglow * 0.2, m3 * 0.42);

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
