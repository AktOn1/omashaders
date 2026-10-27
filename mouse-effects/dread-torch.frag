#version 440
// category: Glow
// desc: Dread torch: one dim, sickly flashlight pool fixed to the pointer, its core flickering and lagging a little behind the hand, a few dust motes drifting inside the beam and a faint bone-white smear left where the pointer has just been; now and then the torch stutters off for a split second and only a red filament ember is left. Nothing exists outside the pool
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
float AGE(int i) { return i == 0 ? 0.0 : (float(i) - 1.0 + hs.y) / 16.0; }

float dt_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dt_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dt_h(i), dt_h(i + vec2(1.0, 0.0)), f.x), mix(dt_h(i + vec2(0.0, 1.0)), dt_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 dt_seg(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return vec2(length(p - a - ba * h), h);
}
// a window in time: 0 before a, 1 from a to a+len, 0 after, with short soft edges
float dt_win(float x, float a, float len) {
  return smoothstep(a - 0.012, a, x) * (1.0 - smoothstep(a + len, a + len + 0.02, x));
}

// one layer of dust motes: a cell holds at most one, it drifts on a small slow loop and glints
float dt_motes(vec2 p, float cell, float t, float lyr) {
  vec2 g = p / cell;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h = dt_h(id + lyr * 17.0);
  if (h > 0.34) return 0.0;
  float h2 = dt_h(id + 5.3 + lyr * 3.0);
  vec2 m = vec2(0.5 + 0.30 * sin(t * (0.25 + 0.5 * h) + h * 40.0), 0.5 + 0.30 * cos(t * (0.20 + 0.4 * h2) + h2 * 70.0));
  float d = length((f - m) * cell);
  float rad = 0.7 + 0.7 * h2;
  float tw = 0.5 + 0.5 * sin(t * (0.8 + 1.8 * h2) + h * 90.0);
  return (exp(-d * d / (2.0 * rad * rad)) + 0.18 * exp(-d / (2.5 * rad))) * (0.25 + 0.75 * tw * tw);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }

  const vec3 sick = vec3(0.40, 0.66, 0.42);     // the pool: cold, sickly green-grey
  const vec3 pale = vec3(0.74, 0.88, 0.66);     // the hotter middle
  const vec3 bone = vec3(0.88, 0.84, 0.72);     // bone white
  const vec3 blood = vec3(0.85, 0.06, 0.04);    // the ember of the dead filament

  float t = time;

  // ---------------- power: restless flicker, and every few seconds a stutter-off (never more than two blinks in a row)
  float fl = 0.82 + 0.28 * (dt_n(vec2(t * 8.0, 1.7)) - 0.5) + 0.16 * (dt_n(vec2(t * 1.1, 8.3)) - 0.5);
  float slot = floor(t / 6.3);
  float ph = t - slot * 6.3;
  float s0 = 0.5 + 4.6 * dt_h(vec2(slot, 3.7));
  float on = step(0.20, dt_h(vec2(slot, 9.1)));                 // a few slots have no stutter at all
  float dbl = step(0.5, dt_h(vec2(slot, 5.5)));                 // some stutters blink twice
  float off = on * max(dt_win(ph, s0, 0.11), dbl * dt_win(ph, s0 + 0.24, 0.05));
  // a sputtering warning just before it goes
  float warn = on * dt_win(ph, s0 - 0.30, 0.26) * (0.5 + 0.5 * sin(ph * 90.0));
  float power = fl * (1.0 - off) * (1.0 - 0.45 * warn);
  float emb = clamp(off + 0.55 * on * dt_win(ph, s0 + 0.11, 0.35) * (1.0 - smoothstep(0.0, 0.35, ph - s0 - 0.11)), 0.0, 1.0);

  // pointer speed (px/s over the last four samples)
  float v = distance(mouse, P(4)) / max(4.0 * hs.z, 0.01);

  // ---------------- the pool: centre lags the hand, the hot core lags a little less
  vec2 pc = mix(mouse, P(3), 0.55);
  vec2 cc = mix(mouse, P(2), 0.45);
  vec2 d = p - pc;
  float r = length(d);
  float ang = atan(d.y, d.x);
  float R = 108.0;
  // the rim of a torch beam is never a circle
  float wob = 1.0 + 0.07 * sin(ang * 3.0 + t * 0.7) + 0.05 * sin(ang * 5.0 - t * 1.1 + 1.3) + 0.03 * sin(ang * 9.0 + t * 2.3);
  float u = r / (R * wob);
  float u2 = u * u;
  float pool = 0.80 / (1.0 + u2 * u2 * 2.6 + u2 * 0.8) + exp(-u2 * 12.0) * 0.45;   // a soft plateau with a falling rim, like a torch beam on a wall
  pool -= 0.05 * exp(-pow((u - 0.62) / 0.14, 2.0));                     // the dark ring of a cheap lens
  pool += 0.06 * exp(-pow((u - 0.96) / 0.06, 2.0));                     // and the hard edge of the housing
  pool = max(pool, 0.0);
  // dirty lens: slow blotches and a fine crawl
  float dirt = 0.72 + 0.56 * dt_n(p / 13.0 + vec2(t * 0.35, -t * 0.2)) * (0.6 + 0.4 * dt_n(p / 4.0 - t * 1.7));
  pool *= dirt;
  pool *= smoothstep(1.55, 1.10, u);                                    // hard zero outside, so nothing leaks

  // ---------------- the core: a small hot spot, jumpier than the pool
  vec2 dc = p - cc;
  float rc = length(dc);
  float cf = 0.70 + 0.30 * dt_n(vec2(t * 19.0, 4.1));
  float core = (exp(-rc * rc / (2.0 * 5.0 * 5.0)) * 0.55 + exp(-rc / 20.0) * 0.20) * cf;

  // ---------------- dust motes in the beam only
  float dust = 0.0;
  if (pool > 0.015) {
    dust = dt_motes(p, 26.0, t, 0.0) * 0.9 + dt_motes(p + vec2(13.0, 7.0), 15.0, t * 1.3, 1.0) * 0.7;
    dust *= smoothstep(0.02, 0.35, pool);
  }

  // ---------------- the smear: a faint bone-white streak along where the pointer has been
  float sm = 0.0;
  {
    vec2 lo = mouse, hi = mouse;
    for (int i = 1; i <= 16; i++) { vec2 q = P(i); lo = min(lo, q); hi = max(hi, q); }
    if (p.x > lo.x - 20.0 && p.x < hi.x + 20.0 && p.y > lo.y - 20.0 && p.y < hi.y + 20.0) {
      float Lmax = 330.0;
      float cum = 0.0;
      for (int i = 0; i < 16; i++) {
        vec2 a = P(i), b = P(i + 1);
        float len = distance(a, b);
        if (cum > Lmax) break;
        vec2 sg = dt_seg(p, a, b);
        float s = cum + len * sg.y;
        float age = mix(AGE(i), AGE(i + 1), sg.y);
        float uu = clamp(s / Lmax, 0.0, 1.0);
        float w = mix(7.0, 1.3, pow(uu, 0.6));
        float fade = pow(1.0 - uu, 1.5) * pow(1.0 - age, 1.2) * smoothstep(1.0, 12.0, len) * smoothstep(8.0, 48.0, s);
        float shape = exp(-sg.x * sg.x / (2.0 * w * w)) + 0.25 * exp(-sg.x / (w * 2.5));
        // torn film: the smear breaks up into streaks that follow the stroke
        float tear = 0.18 + 1.20 * smoothstep(0.28, 0.72, dt_n(vec2(s * 0.07 + 3.0, sg.x * 0.20)));
        sm = max(sm, shape * fade * tear);
        cum += len;
      }
    }
  }

  // ---------------- compose (premultiplied): light, with a faint green-black ink under it so it also reads on bright pictures
  float pw = pool * power;
  vec3 acc = sick * pw * 0.46 + pale * core * power * 0.34 + bone * dust * pw * 0.42 + bone * sm * 0.30;
  acc += blood * emb * (exp(-rc * rc / (2.0 * 2.2 * 2.2)) * 0.40 + exp(-rc / 10.0) * 0.07);
  float shade = pw * 0.30 + core * power * 0.10 + sm * 0.20 + emb * exp(-rc / 14.0) * 0.20
              + 0.08 * exp(-pow((u - 1.10) / 0.20, 2.0)) * power * smoothstep(1.55, 1.2, u);   // a ring of shadow just outside the lit disc
  vec3 ink = vec3(0.01, 0.035, 0.025);
  float sa = clamp(shade, 0.0, 0.55);
  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  vec3 col = min(acc, vec3(la)) + ink * sa * (1.0 - la);
  float a = clamp(sa * (1.0 - 0.4 * la), 0.0, 0.8);
  fragColor = vec4(col, a) * qt_Opacity;
}
