#version 440
// category: Trail
// desc: Star weave: stars sit at fixed places across the screen and light up as the pointer comes near; the lit ones link into small constellations, each line growing out from the star that woke first, and a few dashed threads reach from the pointer to the closest stars. Stars and lines fade out again soon after the pointer leaves
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

// the star field: one jittered cell grid, shared with the star-chart wallpaper effect
float sw_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
bool sw_has(vec2 c) { return sw_h(c + 41.7) < 0.80; }
vec2 sw_pos(vec2 c, float C) { return (c + 0.14 + 0.72 * vec2(sw_h(c), sw_h(c + 17.3))) * C; }
vec2 sw_off(int o) { return o == 0 ? vec2(1.0, 0.0) : (o == 1 ? vec2(0.0, 1.0) : (o == 2 ? vec2(1.0, 1.0) : vec2(1.0, -1.0))); }
// does this cell's star link to the star at cell offset o (0..3 = right, down, down-right, up-right)?
bool sw_link(vec2 c, int o) {
  vec2 off = sw_off(o);
  return sw_h(c * 1.7 + off * 3.1 + 9.2) < (o < 2 ? 0.58 : 0.40) && sw_has(c + off);
}

// how awake a star is: 1 right next to the pointer, fading to 0 at distance R; older pointer positions keep stars lit a little longer
float sw_wake(vec2 s, float R, float hy) {
  float w = smoothstep(R, R * 0.30, length(s - mouse));
  for (int k = 1; k <= 4; k++) {
    int slot = k * 4;
    float age = (float(slot) - 1.0 + hy) / 16.0;
    float f = (1.0 - age) * (1.0 - 0.5 * age);
    w = max(w, smoothstep(R * 0.80, R * 0.28, length(s - P(slot))) * f);
  }
  return w;
}

float sw_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float C = 92.0 * sc;
  float R = 230.0 * sc;
  float hy = hs.y;

  float dmin = length(p - mouse);
  for (int k = 1; k <= 4; k++) dmin = min(dmin, length(p - P(k * 4)));
  if (dmin > R + 24.0 * sc) { fragColor = vec4(0.0); return; }

  vec3 ice = vec3(0.70, 0.84, 1.00);
  vec3 white = vec3(0.90, 0.95, 1.00);
  vec3 gold = vec3(1.00, 0.84, 0.50);
  vec3 cream = vec3(1.00, 0.95, 0.82);
  vec3 acc = vec3(0.0);
  float shade = 0.0;
  vec2 c0 = floor(p / C);

  // constellations: stars around this pixel and the lines that start at them
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 ca = c0 + vec2(float(i), float(j));
      if (!sw_has(ca)) continue;
      vec2 sa = sw_pos(ca, C);
      float wa = sw_wake(sa, R, hy);
      if (wa < 0.01) continue;
      float ma = sw_h(ca + 5.9);

      // the star: bright core, soft halo, and a thin four-point cross on the brighter ones; a ring bursts out as it wakes
      vec2 d = p - sa;
      float r2 = dot(d, d);
      float wv = pow(wa, 0.6);
      float rad = (2.0 + 2.0 * ma) * sc * (0.6 + 0.7 * wv);
      float tw = 0.84 + 0.16 * sin(time * (1.3 + 2.5 * ma) + ma * 60.0);
      float core = exp(-r2 / (rad * rad));
      float halo = exp(-r2 / (rad * rad * 16.0)) * 0.26;
      float spike = 0.0;
      if (ma > 0.52) {
        spike = (exp(-abs(d.x) / (0.8 * sc)) * exp(-abs(d.y) / (rad * 7.0))
               + exp(-abs(d.y) / (0.8 * sc)) * exp(-abs(d.x) / (rad * 7.0))) * 0.65 * wv;
      }
      float rr = 4.0 * sc + 15.0 * sc * wa;
      float ring = sw_aa(abs(length(d) - rr), 0.5) * (1.0 - wa) * smoothstep(0.0, 0.18, wa) * 0.35;
      vec3 scol = sw_h(ca + 77.7) < 0.18 ? gold : white;
      float sA = (core + halo + spike) * wv * tw;
      acc += scol * sA + ice * ring;
      shade += (core * 0.5 + halo) * wv * 0.55;

      // the lines from this star to its fixed neighbours
      for (int o = 0; o < 4; o++) {
        if (!sw_link(ca, o)) continue;
        vec2 cb = ca + sw_off(o);
        vec2 sb = sw_pos(cb, C);
        float wb = sw_wake(sb, R, hy);
        if (wb < 0.01) continue;
        vec2 s0 = wa >= wb ? sa : sb;
        vec2 s1 = wa >= wb ? sb : sa;
        float wl = min(wa, wb);
        vec2 ab = s1 - s0;
        float L2 = dot(ab, ab);
        float u = clamp(dot(p - s0, ab) / L2, 0.0, 1.0);
        float dl = length(p - (s0 + ab * u));
        float g = clamp(wl * 2.2, 0.0, 1.0);
        float vis = 1.0 - smoothstep(g * 1.08 - 0.04, g * 1.08 + 0.04, u);
        float line = sw_aa(dl, 0.80 * sc) * vis * (0.55 + 0.45 * wl);
        float glow = exp(-dl * dl / (12.0 * sc * sc)) * vis * wl * 0.16;
        vec2 dt = p - (s0 + ab * g);
        float tip = exp(-dot(dt, dt) / (10.0 * sc * sc)) * (1.0 - g) * 0.9;
        acc += ice * (line * 1.0 + glow) + white * tip;
        shade += line * 0.30 + glow;
      }
    }
  }

  // dashed threads from the pointer to the nearest stars
  vec2 cm = floor(mouse / C);
  float rl = 0.42 * R;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 cs = cm + vec2(float(i), float(j));
      if (!sw_has(cs)) continue;
      vec2 s = sw_pos(cs, C);
      float dS = length(s - mouse);
      if (dS > rl || dS < 3.0 * sc) continue;
      vec2 ab = s - mouse;
      float u = clamp(dot(p - mouse, ab) / dot(ab, ab), 0.0, 1.0);
      float dl = length(p - (mouse + ab * u));
      float dash = step(fract(u * dS / (8.0 * sc) - time * 0.3), 0.58);
      float fade = smoothstep(rl, rl * 0.35, dS);
      float th = sw_aa(dl, 0.55 * sc) * dash * fade * 0.60;
      acc += cream * th;
      shade += th * 0.20;
    }
  }

  // the pointer itself: a small warm four-point star
  vec2 dm = p - mouse;
  float rm2 = dot(dm, dm);
  float pt = 0.80 + 0.20 * sin(time * 2.4);
  float pcore = exp(-rm2 / (2.3 * sc * 2.3 * sc));
  float phalo = exp(-rm2 / (11.0 * sc * 11.0 * sc)) * 0.34;
  float pspike = (exp(-abs(dm.x) / (0.9 * sc)) * exp(-abs(dm.y) / (10.0 * sc))
                + exp(-abs(dm.y) / (0.9 * sc)) * exp(-abs(dm.x) / (10.0 * sc))) * 0.70;
  acc += cream * (pcore + phalo + pspike) * pt;
  shade += (pcore * 0.4 + phalo * 1.2) * 0.8;

  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  float sa2 = clamp(shade, 0.0, 0.50);
  vec3 ink = vec3(0.02, 0.03, 0.10);
  vec3 rgb = min(acc, vec3(la)) + ink * sa2 * (1.0 - la);
  float a = la + sa2 * (1.0 - la);
  fragColor = vec4(rgb, a) * qt_Opacity;
}
