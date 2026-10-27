#version 440
// category: Trail
// desc: Board build: a printed circuit builds up on the screen in fixed places as the pointer comes near. The board is the same grid as the Circuit trace wallpaper effect, so the copper traces, vias, chips, resistors and LEDs that light up sit exactly on the wallpaper's own: each one grows out from its middle while the pointer is close, current ripples outward from a small solder-pad pointer along them, and the board powers down again shortly after the pointer leaves
// motion: yes
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec4 h0;
  vec4 h1;
  vec4 h2;
  vec4 h3;
  vec4 h4;
  vec4 h5;
  vec4 h6;
  vec4 h7;
  vec4 hs;
};

vec2 P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  if (i == 8) return h3.zw;
  if (i == 9) return h4.xy;
  if (i == 10) return h4.zw;
  if (i == 11) return h5.xy;
  if (i == 12) return h5.zw;
  if (i == 13) return h6.xy;
  if (i == 14) return h6.zw;
  if (i == 15) return h7.xy;
  return h7.zw;
}

// the board: one cell grid, shared with the circuit-trace wallpaper effect (same hash, same cell size, same routing rules)
float bb_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float bb_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float bb_seg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float u = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - (a + ab * u));
}
float bb_box(vec2 r, vec2 hs2) { vec2 d = abs(r) - hs2; return clamp(0.5 - max(d.x, d.y), 0.0, 1.0); }
float bb_pick(vec4 v, int i) { return i == 0 ? v.x : (i == 1 ? v.y : (i == 2 ? v.z : v.w)); }
vec2 bb_mid(int i) { return i == 0 ? vec2(0.0, 0.5) : (i == 1 ? vec2(1.0, 0.5) : (i == 2 ? vec2(0.5, 0.0) : vec2(0.5, 1.0))); }
vec2 bb_in(int i) { return i == 0 ? vec2(1.0, 0.0) : (i == 1 ? vec2(-1.0, 0.0) : (i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0))); }
float bb_kind(vec2 c) {
  float r = bb_h(c + 0.37);
  if (r < 0.05) return 1.0;
  if (r < 0.085) return 2.0;
  if (r < 0.115) return 3.0;
  if (r < 0.135) return 4.0;
  if (r < 0.165) return 5.0;
  return 0.0;
}
float bb_allow(float k, float horiz) {
  if (k < 0.5) return 1.0;
  if (k > 4.5) return 1.0;
  if (k > 2.5 && k < 3.5) return horiz < 0.5 ? 1.0 : 0.0;
  return horiz > 0.5 ? 1.0 : 0.0;
}
float bb_edge(vec2 c, float kA, float kB, float horiz) {
  if (bb_allow(kA, horiz) < 0.5 || bb_allow(kB, horiz) < 0.5) return 0.0;
  float comp = (kA > 0.5 || kB > 0.5) ? 0.88 : 0.47;
  if (bb_h(c * 1.31 + horiz * 17.3 + 5.1) > comp) return 0.0;
  bool two = (kA > 1.5 && kA < 4.5) || (kB > 1.5 && kB < 4.5);
  return (bb_h(c * 0.77 + horiz * 9.1 + 2.9) < 0.32 && !two) ? 3.0 : 1.0;
}
float bb_ext(float k) { return k < 0.5 ? 0.0 : (k > 4.5 ? 0.21 : 0.27); }

// how powered a place is: 1 right at the pointer, fading to 0 at distance R; older pointer positions keep it lit a little longer
float bb_wake(vec2 s, float R, float hy) {
  float w = smoothstep(R, R * 0.25, length(s - mouse));
  for (int k = 1; k <= 4; k++) {
    int slot = k * 4;
    float age = (float(slot) - 1.0 + hy) / 16.0;
    float f = (1.0 - age) * (1.0 - 0.5 * age);
    w = max(w, smoothstep(R * 0.85, R * 0.25, length(s - P(slot))) * f);
  }
  return w;
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float C = 80.0 * sc;
  float R = 330.0 * sc;
  float hy = hs.y;

  vec3 copper = vec3(1.00, 0.62, 0.26);
  vec3 gold = vec3(1.00, 0.86, 0.48);
  vec3 cold = vec3(0.88, 0.97, 1.00);
  vec3 amber = vec3(1.00, 0.60, 0.14);
  vec3 ink = vec3(0.006, 0.030, 0.020);
  vec3 acc = vec3(0.0);
  float shade = 0.0;

  // the pointer: a small solder pad with a ring that breathes and four fine ticks
  vec2 dm = p - mouse;
  float rm = length(dm);
  float br = 0.5 + 0.5 * sin(time * 2.4);
  float pad = bb_aa(rm, 2.0 * sc) + bb_aa(abs(rm - 6.0 * sc), 0.65 * sc) * 0.9
            + bb_aa(abs(rm - (8.5 + 3.0 * br) * sc), 0.5 * sc) * (1.0 - br) * 0.6;
  float tick = max(bb_aa(abs(dm.x), 0.45 * sc) * step(9.0 * sc, abs(dm.y)) * step(abs(dm.y), 14.0 * sc),
                   bb_aa(abs(dm.y), 0.45 * sc) * step(9.0 * sc, abs(dm.x)) * step(abs(dm.x), 14.0 * sc));
  float phalo = exp(-rm * rm / (16.0 * sc * 16.0 * sc)) * 0.30;
  acc += gold * (pad + tick * 0.8) + amber * phalo;
  shade += (bb_aa(rm, 7.5 * sc) * 0.55 + phalo * 1.4) * 0.75;

  float dmin = rm;
  for (int k = 1; k <= 4; k++) dmin = min(dmin, length(p - P(k * 4)));
  if (dmin < R + C) {
    vec2 g = p / C;
    vec2 c = floor(g);
    vec2 q = g - c;
    vec2 r = (q - 0.5) * C;
    float hw = 1.1 * sc;
    float Pp = 0.075 * C;
    float kd = bb_kind(c);
    float kL = bb_kind(c - vec2(1.0, 0.0)); float kR = bb_kind(c + vec2(1.0, 0.0));
    float kU = bb_kind(c - vec2(0.0, 1.0)); float kD = bb_kind(c + vec2(0.0, 1.0));
    vec4 nv = vec4(bb_edge(c - vec2(1.0, 0.0), kL, kd, 1.0), bb_edge(c, kd, kR, 1.0), bb_edge(c - vec2(0.0, 1.0), kU, kd, 0.0), bb_edge(c, kd, kD, 0.0));
    float deg = step(0.5, nv.x) + step(0.5, nv.y) + step(0.5, nv.z) + step(0.5, nv.w);

    // this cell powers up when the pointer is near, each at its own moment, and grows out from its middle
    float wk = bb_wake((c + 0.5) * C, R, hy);
    float thr = 0.10 + 0.42 * bb_h(c + 3.3);
    float span = clamp((wk - thr) / 0.30, 0.0, 1.0);
    float rl = length(r);
    float reach = span * 0.74 * C;
    float rev = span > 0.0 ? 1.0 - smoothstep(reach - 5.0 * sc, reach, rl) : 0.0;
    float tipg = span > 0.0 && span < 1.0 ? exp(-(rl - reach) * (rl - reach) / (7.0 * sc * 7.0 * sc)) : 0.0;

    float dm2 = 1e4; float nn = 1.0;
    vec2 viaAt = vec2(0.5); float viaR = 0.0;
    if (kd < 0.5 && deg > 1.5 && deg < 2.5) {
      int i1 = -1; int i2 = -1; float n1 = 0.0; float n2 = 0.0;
      for (int i = 0; i < 4; i++) {
        float n = bb_pick(nv, i);
        if (n > 0.5) { if (i1 < 0) { i1 = i; n1 = n; } else { i2 = i; n2 = n; } }
      }
      vec2 M1 = bb_mid(i1); vec2 M2 = bb_mid(i2);
      vec2 Q1 = M1 + bb_in(i1) * 0.25; vec2 Q2 = M2 + bb_in(i2) * 0.25;
      dm2 = min(min(bb_seg(q, M1, Q1), bb_seg(q, Q1, Q2)), bb_seg(q, Q2, M2)) * C;
      nn = length(q - M1) < length(q - M2) ? n1 : n2;
      if (bb_h(c + 31.7) < 0.24) { viaAt = (Q1 + Q2) * 0.5; viaR = 0.058 * C; }
    } else if (deg > 0.5) {
      float e = bb_ext(kd);
      for (int i = 0; i < 4; i++) {
        float n = bb_pick(nv, i);
        if (n > 0.5) {
          vec2 M = bb_mid(i);
          float di = bb_seg(q, M, M + bb_in(i) * (0.5 - e));
          if (di * C < dm2) { dm2 = di * C; nn = n; }
        }
      }
      if (kd < 0.5) { viaR = (deg > 2.5 ? 0.075 : 0.062) * C; }
    }

    // current ripples outward from the pointer along whatever is lit
    float ph = rm / (150.0 * sc) - time * 0.75;
    float rip = exp(-fract(ph) * 7.0) * smoothstep(0.0, 0.08, fract(ph));
    float near = smoothstep(R, R * 0.2, rm);
    float cu = 0.0; float au = 0.0; float dk = 0.0; float ho = 0.0; float led = 0.0;

    if (dm2 < 1e3) {
      float cv = bb_aa(dm2, hw);
      if (nn > 2.0) cv = max(cv, bb_aa(abs(dm2 - Pp), hw));
      cu = cv;
    }
    if (viaR > 0.0) {
      float rv = length(r - (viaAt - 0.5) * C);
      au = max(au, bb_aa(abs(rv - viaR * 0.72), viaR * 0.34));
      ho = max(ho, bb_aa(rv, viaR * 0.38));
    }
    float sk = 0.0;
    if (kd > 0.5) {
      vec2 rr = (kd > 2.5 && kd < 3.5) ? r.yx : r;
      if (kd < 1.5) {
        vec2 bs = vec2(0.20 * C, 2.6 * Pp);
        dk = bb_box(rr, bs);
        float row = clamp(floor(rr.y / Pp + 0.5), -2.0, 2.0);
        au = bb_box(vec2(abs(rr.x) - 0.23 * C, rr.y - row * Pp), vec2(0.04 * C, 0.28 * Pp));
        vec2 so = abs(rr) - bs;
        sk = bb_aa(abs(max(so.x, so.y)), 0.9 * sc);
      } else if (kd < 4.5) {
        au = bb_box(vec2(abs(rr.x) - 0.205 * C, rr.y), vec2(0.065 * C, 0.085 * C));
        dk = bb_box(rr, vec2(0.14 * C, 0.055 * C));
        vec2 so = abs(rr) - vec2(0.14 * C, 0.055 * C);
        sk = bb_aa(abs(max(so.x, so.y)), 0.9 * sc);
        if (kd > 3.5) {
          float per = 1.5 + 2.6 * bb_h(c + 4.4);
          float on = step(fract(time / per + bb_h(c + 6.1)), 0.50);
          led = (0.45 + 0.55 * on) * exp(-dot(rr, rr) / (0.2 * C * 0.2 * C));
        }
      } else {
        dk = bb_box(rr, vec2(0.15 * C));
        vec2 a = abs(rr);
        float rowy = clamp(floor(rr.y / Pp + 0.5), -1.0, 1.0);
        float rowx = clamp(floor(rr.x / Pp + 0.5), -1.0, 1.0);
        au = max(bb_box(vec2(a.x - 0.18 * C, rr.y - rowy * Pp), vec2(0.03 * C, 0.28 * Pp)),
                 bb_box(vec2(rr.x - rowx * Pp, a.y - 0.18 * C), vec2(0.28 * Pp, 0.03 * C)));
        vec2 so = a - vec2(0.15 * C);
        sk = bb_aa(abs(max(so.x, so.y)), 0.9 * sc);
      }
    }

    float live = rev;
    float cuL = cu * live;
    float auL = au * live;
    float dkL = dk * live;
    float hoL = ho * live;
    float skL = sk * live;
    float solid = max(max(cuL, auL), dkL);

    // light: copper with a ripple of current, gold pads and vias, the growing tip of each trace in white
    float lump = 0.55 + 0.45 * near;
    acc += copper * cuL * lump * (0.72 + 0.55 * rip);
    acc += cold * cuL * rip * rip * 0.6;
    acc += gold * auL * (0.85 + 0.3 * rip);
    acc += vec3(0.62, 0.90, 0.78) * skL * 0.55;
    acc += amber * led * live * (0.7 + 0.5 * near);
    acc += mix(gold, cold, 0.5) * tipg * (cuL + auL) * 0.9;
    shade += solid * 0.30 + bb_aa(dm2, hw + 2.0 * sc) * live * 0.32;
    shade += dkL * 0.80;
    acc *= 1.0 - dkL * 0.55 * (1.0 - skL);
    acc -= acc * hoL * 0.8;
    acc = max(acc, vec3(0.0));
  }

  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  float sa = clamp(shade, 0.0, 0.62);
  vec3 rgb = min(acc, vec3(la)) + ink * sa * (1.0 - la);
  float a = la + sa * (1.0 - la);
  fragColor = vec4(rgb, a) * qt_Opacity;
}
