#version 440
// category: Focus
// desc: Quarantine locator: one small holographic targeting mark fixed to the pointer, thin cyan corner brackets that breathe and tighten a little with speed, a hair-thin segmented ring that turns slowly, tiny data ticks and a three-pip readout that flicker, a short scan line that sweeps over the ring every few seconds, an occasional amber glitch slice, and a faint scan-lined afterimage that lags behind the movement and stays within a small radius; a dark shade under the light keeps it readable on bright pictures
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

// Pointer history: P(0) is the pointer, P(1) the newest sample, P(16) the oldest (about one second back).
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

float ql_h(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }

float ql_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// distance to the four corner brackets: B half-size of the frame, A arm length
float ql_brackets(vec2 d, float B, float A) {
  vec2 q = abs(d);
  return min(ql_seg(q, vec2(B, B - A), vec2(B, B)), ql_seg(q, vec2(B - A, B), vec2(B, B)));
}

// a point `lag` samples back, smoothly interpolated between history samples, and pulled in so it never wanders far from the pointer
vec2 ql_ghost(int k, float lim) {
  vec2 v = mix(P(k + 1), P(k), hs.y) - mouse;
  float l = length(v);
  return l < 1e-3 ? vec2(0.0) : v / (1.0 + l / lim);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec2 d = p - mouse;
  float r = length(d);
  if (r > 64.0) { fragColor = vec4(0.0); return; }

  const vec3 cy = vec3(0.45, 0.92, 1.0);      // machine light
  const vec3 wh = vec3(0.82, 0.98, 1.0);      // the hot end of it
  const vec3 am = vec3(1.0, 0.66, 0.25);      // warning amber
  const vec3 bl = vec3(0.20, 0.58, 0.85);     // cold blue of the afterimage

  float v = distance(mouse, P(4)) / max(4.0 * hs.z, 0.01);        // pointer speed, px/s
  float sp = smoothstep(150.0, 1800.0, v);
  float breath = 0.5 + 0.5 * sin(time * 1.3);
  float shimmer = 0.92 + 0.08 * ql_h(floor(time * 24.0));          // a hologram never holds perfectly still

  const float R = 15.0;                                            // ring radius
  float B = 26.0 + 1.1 * breath + 2.2 * sp;                       // bracket half-size: breathes, opens a touch with speed
  const float A = 8.5;                                             // bracket arm length

  vec3 acc = vec3(0.0);
  float shade = 0.0;

  // ---------------- the glitch window: now and then, for a fifth of a second, a slice of the frame slips sideways in amber
  float gp = time / 6.7;
  float gg = fract(gp + 0.31);
  float gk = floor(gp + 0.31);
  float gon = step(gg, 0.03);
  float gy = (ql_h(gk) - 0.5) * 2.0 * B * 0.8;
  float inBand = gon * (1.0 - smoothstep(4.0, 5.0, abs(d.y - gy)));
  float gdir = ql_h(gk + 7.0) > 0.5 ? 1.0 : -1.0;

  // ---------------- the brackets
  vec2 dc = vec2(d.x - 4.0 * gdir * inBand, d.y);
  float db = ql_brackets(dc, B, A);
  // each corner is its own bulb: now and then one dims for a moment
  vec2 qs = step(0.0, dc);
  float cid = qs.x + 2.0 * qs.y;
  float cdim = 1.0 - 0.7 * step(ql_h(cid * 3.7 + floor(time * 2.5) * 1.3), 0.06);
  float lineC = (1.0 - smoothstep(0.30, 1.0, db)) + 0.16 * exp(-db / 3.2);
  vec2 qa = abs(dc);
  float vtx = exp(-dot(qa - vec2(B), qa - vec2(B)) / 2.2);        // bright pip at each corner vertex
  acc += mix(cy, wh, 0.25) * lineC * 0.95 * cdim + wh * vtx * 0.55 * cdim;
  shade += (exp(-db * db / 6.5) * 0.58 + exp(-db / 6.0) * 0.16) * cdim;
  if (inBand > 0.0) {
    float da = ql_brackets(vec2(d.x + 3.0 * gdir, d.y), B, A);
    acc += am * ((1.0 - smoothstep(0.30, 1.1, da)) + 0.2 * exp(-da / 3.0)) * inBand * 0.9;
  }

  // ---------------- the ring: a hair-thin whole circle and a brighter, slowly turning segmented one
  float ang = atan(d.y, d.x);
  float dr = abs(r - R);
  float seg = fract((ang + time * 0.35) / 2.0943951);              // three arcs
  float arcm = smoothstep(0.04, 0.09, seg) * (1.0 - smoothstep(0.86, 0.91, seg));
  float ringL = (1.0 - smoothstep(0.25, 0.95, dr)) * (0.20 + 0.62 * arcm) + 0.10 * exp(-dr / 2.6) * arcm;
  acc += mix(cy, wh, 0.15) * ringL * 0.92;
  shade += exp(-dr * dr / 5.0) * 0.26;

  // ---------------- the scan line: a short bright bar that sweeps down across the ring every 4.6 s
  float sph = fract(time / 4.6);
  float sa = sph / 0.30;
  if (sa < 1.0) {
    float sy = mix(-R - 5.0, R + 5.0, sa);
    float hw = sqrt(max(R * R - sy * sy, 0.0)) + 5.0;
    float sfade = sin(3.14159 * sa);
    float along = 1.0 - smoothstep(hw - 5.0, hw, abs(d.x));
    float dy = d.y - sy;
    float bar = (exp(-dy * dy / 0.9) + 0.30 * exp(-abs(dy) / 5.0)) * along;
    float wake = exp(-max(-dy, 0.0) / 9.0) * step(dy, 0.0) * along * 0.12;   // a faint dying afterglow above it
    acc += (wh * bar * 0.9 + cy * wake) * sfade;
    shade += bar * 0.18 * sfade;
    // the ring catches the light where the bar crosses it
    acc += wh * exp(-dy * dy / 14.0) * exp(-dr * dr / 1.6) * 0.5 * sfade;
  }

  // ---------------- data ticks around the ring, each switching on and off at about two beats per second
  if (r > R + 2.0 && r < R + 11.0) {
    float u = (ang + 3.14159265) / 6.2831853 * 24.0;
    float ai = floor(u);
    float f = fract(u) - 0.5;
    float major = step(fract(ai / 6.0), 0.01);
    float on = max(major, step(ql_h(ai * 1.7 + floor(time * 2.0 + ql_h(ai) * 3.0) * 7.3), 0.30));
    float rin = R + 3.5, rout = R + 5.8 + 3.2 * major;
    float rad = smoothstep(rin - 0.6, rin, r) * (1.0 - smoothstep(rout, rout + 0.6, r));
    float tk = rad * (1.0 - smoothstep(0.30, 0.55, abs(f) * r * 0.2618 * 2.0)) * on;
    acc += cy * tk * (0.55 + 0.35 * major);
    shade += tk * 0.12;
  }
  // a three-pip readout under the lower right bracket, a short rule on each side
  {
    vec2 q = d - vec2(B - 15.0, B + 6.5);
    float pips = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float lvl = step(ql_h(fi * 5.1 + floor(time * 1.6 + fi * 0.7) * 3.3), 0.62);
      vec2 e = abs(q - vec2(fi * 5.5, 0.0)) - vec2(1.2);
      pips += (1.0 - smoothstep(0.0, 0.8, max(e.x, e.y))) * (0.30 + 0.70 * lvl);
    }
    acc += cy * pips * 0.7;
    shade += pips * 0.10;
    vec2 rl = abs(d) - vec2(B + 6.5, 0.0);
    float rr = (1.0 - smoothstep(0.35, 0.95, abs(rl.y))) * (1.0 - smoothstep(2.4, 3.2, abs(abs(d.x) - (B + 6.5))));
    acc += cy * rr * 0.55;
    shade += rr * 0.08;
  }

  // ---------------- the afterimage: three older copies of the frame trail the pointer, scan-lined and cold, closer in the older they are
  {
    float lines = 0.55 + 0.45 * step(0.9, fract(p.y / 3.0 + time * 0.8));   // moving hologram line pattern
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      int idx = k == 0 ? 3 : (k == 1 ? 7 : 11);
      vec2 g = ql_ghost(idx, 13.0 + 8.0 * fk);
      float gl = length(g);
      float gate = smoothstep(1.5, 9.0, gl);
      if (gate > 0.0) {
        float scl = 0.86 - 0.08 * fk;
        vec2 e = d - g;
        float dg = ql_brackets(e, B * scl, A * scl);
        float rg = abs(length(e) - R * scl);
        float wgt = (0.52 - 0.14 * fk) * gate * lines;
        float li = (1.0 - smoothstep(0.3, 1.1, dg)) + 0.5 * (1.0 - smoothstep(0.3, 1.0, rg)) * (1.0 - 0.4 * fk) + 0.14 * exp(-dg / 3.0);
        acc += mix(bl, cy, 0.25) * li * wgt;
        shade += exp(-dg * dg / 5.0) * 0.12 * gate * (1.0 - 0.3 * fk);
      }
    }
  }

  // ---------------- compose: ink underneath so the light reads on bright pictures, light on top, premultiplied
  acc *= shimmer;
  float fadeR = 1.0 - smoothstep(52.0, 62.0, r);
  acc *= fadeR; shade *= fadeR;
  vec3 ink = vec3(0.012, 0.035, 0.07);
  float sh = clamp(shade, 0.0, 0.66);
  float la = clamp(max(acc.r, max(acc.g, acc.b)) * 0.95, 0.0, 1.0);
  vec3 col = min(acc, vec3(la)) + ink * sh * (1.0 - la);
  float a = la + sh * (1.0 - la);
  fragColor = vec4(col, a) * qt_Opacity;
}
