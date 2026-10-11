// label: Spring meadow
// hint: a bright meadow just after a light shower: wildflowers sway in the breeze, bees and butterflies wander, drops sparkle in the soft sun and a faint rainbow hangs in the mist; petals drift toward the pointer
// category: Holidays
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

float sm_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 sm_h2(vec2 p) { return vec2(sm_h(p), sm_h(p + 19.19)); }
float sm_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sm_h(i), sm_h(i + vec2(1.0, 0.0)), f.x), mix(sm_h(i + vec2(0.0, 1.0)), sm_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sm_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sm_n(p); p = p * 2.03 + 11.0; a *= 0.5; }
  return v;
}
float sm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 sm_rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

float sm_hill1(float x) { return 0.505 + 0.030 * sin(x * 1.3 + 0.5) + 0.014 * sin(x * 3.1 + 1.0); }
float sm_hill2(float x) { return 0.565 + 0.040 * sin(x * 1.0 + 2.0) + 0.012 * sin(x * 2.7 + 1.0); }
float sm_hill3(float x) { return 0.640 + 0.045 * sin(x * 0.8 + 4.0) + 0.014 * sin(x * 2.3 + 3.0); }

// a gust runs across the field now and then: 0..1 at aspect-space x
float sm_gust(float x, float t) { return 0.5 + 0.5 * sin(t * 0.9 - x * 1.7) * (0.6 + 0.4 * sin(t * 0.31 + x * 0.6)); }

// one layer of wildflowers: cell size cs, nothing above yTop. Returns rgb in .rgb and coverage in .a
vec4 sm_flowers(vec2 p, float cs, float yTop, float dens, float headR, float seed, float t, vec2 sun) {
  vec2 g = p / cs;
  vec2 id = floor(g);
  float h = sm_h(id + seed);
  vec4 o = vec4(0.0);
  if (h > dens) return o;
  vec2 hh = sm_h2(id + seed + 6.1);
  float sway = sm_gust(p.x, t) * 0.30 + 0.08 * sin(t * 1.3 + h * 60.0);
  vec2 c = (id + vec2(0.5 + (hh.x - 0.5) * 0.4, 0.22 + 0.2 * hh.y)) * cs;
  float fade = smoothstep(yTop, yTop + 0.05, c.y);
  if (fade <= 0.0) return o;
  float bend = sway * cs * 0.30;
  vec2 hp = c + vec2(bend, 0.0);
  // stem: from the head down to the bottom of the cell, leaning with the wind
  float sy = (p.y - hp.y) / max((id.y + 1.0) * cs - hp.y, 1e-4);
  float stemX = hp.x - bend * (1.0 - clamp(sy, 0.0, 1.0)) * 1.0;
  float stem = smoothstep(headR * 0.12, headR * 0.04, abs(p.x - stemX)) * step(0.0, sy) * step(sy, 1.0);
  vec3 sc = vec3(0.16, 0.45, 0.12) * (0.8 + 0.4 * sy);
  // little leaf halfway down
  float leaf = smoothstep(0.55, 0.25, length((p - vec2(stemX + headR * 0.7, hp.y + (c.y + 0.5 * cs - hp.y) * 0.5)) / vec2(headR * 0.9, headR * 0.35))) * step(0.0, sy) * step(sy, 1.0);
  sc = mix(sc, vec3(0.28, 0.65, 0.18), leaf);
  o = vec4(sc, clamp(stem + leaf, 0.0, 1.0) * fade);
  // the flower head
  vec2 d = p - hp;
  float dl = length(d);
  if (dl < headR * 1.5) {
    float ang = atan(d.y, d.x) + sway * 0.4;
    float kind = sm_h(id + seed + 2.0);
    float np = 5.0 + floor(hh.x * 4.0);
    vec3 pet;
    float shapeR;
    vec3 ctr = vec3(1.0, 0.80, 0.20);
    float ctrR = 0.34;
    if (kind < 0.28) {                    // daisy: many narrow white petals
      pet = vec3(0.98, 0.98, 0.95);
      np = 9.0;
      shapeR = headR * (0.78 + 0.22 * abs(cos(np * 0.5 * ang)));
    } else if (kind < 0.50) {             // buttercup: round yellow cup
      pet = vec3(1.0, 0.84, 0.18);
      shapeR = headR * (0.88 + 0.12 * cos(5.0 * ang));
      ctrR = 0.22;
      ctr = vec3(1.0, 0.95, 0.55);
    } else if (kind < 0.66) {             // pink blossom
      pet = vec3(0.98, 0.50, 0.72);
      shapeR = headR * (0.72 + 0.28 * abs(cos(np * 0.5 * ang)));
      ctr = vec3(1.0, 0.90, 0.40);
    } else if (kind < 0.80) {             // violet
      pet = vec3(0.62, 0.42, 0.95);
      shapeR = headR * (0.74 + 0.26 * abs(cos(2.5 * ang)));
      ctr = vec3(1.0, 0.92, 0.45);
    } else if (kind < 0.91) {             // poppy
      pet = vec3(0.96, 0.24, 0.14);
      shapeR = headR * (0.86 + 0.14 * cos(4.0 * ang));
      ctr = vec3(0.14, 0.08, 0.06);
      ctrR = 0.28;
    } else {                              // cornflower
      pet = vec3(0.34, 0.52, 0.98);
      shapeR = headR * (0.70 + 0.30 * abs(cos(np * 0.5 * ang)));
      ctr = vec3(0.90, 0.92, 1.0);
      ctrR = 0.24;
    }
    float inside = smoothstep(shapeR, shapeR * 0.82, dl);
    vec3 fc = pet;
    // light from the sun side, soft shade on the far side
    float lit = dot(d / max(dl, 1e-4), normalize(sun - hp)) * 0.5 + 0.5;
    fc *= 0.78 + 0.34 * lit;
    fc = mix(fc, ctr, smoothstep(headR * ctrR, headR * ctrR * 0.7, dl));
    // a bead of rain on some petals
    vec2 dd = d - vec2(0.35, -0.30) * headR;
    float drop = step(0.70, hh.y) * smoothstep(headR * 0.20, headR * 0.06, length(dd));
    fc = mix(fc, vec3(1.0), drop * 0.75);
    o.rgb = mix(o.rgb, fc, inside);
    o.a = max(o.a, inside * fade);
  }
  return o;
}

vec3 sm_bee(vec3 col, vec2 p, vec2 c0, vec2 amp, float sp, float ph, float t) {
  vec2 pos = c0 + vec2(cos(t * sp + ph) * amp.x + sin(t * sp * 2.7 + ph) * amp.x * 0.15, sin(t * sp * 1.3 + ph * 2.0) * amp.y + sin(t * 6.0) * 0.003);
  vec2 q = p - pos;
  float dirx = -sin(t * sp + ph);            // faces where it is flying
  q.x *= dirx >= 0.0 ? 1.0 : -1.0;
  float flap = 0.5 + 0.5 * sin(t * 70.0);
  vec2 wq = (q - vec2(-0.002, -0.0065)) / vec2(0.0070, 0.0042 + 0.0018 * flap);
  float wing = smoothstep(1.0, 0.3, length(wq)) * 0.55;
  vec2 bq = q / vec2(0.0105, 0.0070);
  float body = smoothstep(1.0, 0.75, length(bq));
  float stripe = step(0.5, fract(q.x * 190.0 + 0.3));
  vec3 bc = mix(vec3(1.0, 0.82, 0.12), vec3(0.10, 0.07, 0.04), stripe);
  bc = mix(bc, vec3(0.10, 0.07, 0.04), smoothstep(0.50, 0.38, length(bq - vec2(0.8, 0.0))));
  col = mix(col, vec3(0.95, 0.98, 1.0), wing);
  col = mix(col, bc, body);
  return col;
}

vec3 sm_butterfly(vec3 col, vec2 p, vec2 c0, vec2 amp, float sp, float ph, vec3 c1, vec3 c2, float t) {
  vec2 pos = c0 + vec2(sin(t * sp + ph) * amp.x + sin(t * sp * 3.1) * 0.02, sin(t * sp * 1.7 + ph) * amp.y + sin(t * 2.4 + ph) * 0.012);
  float s = 0.020;
  vec2 q = (p - pos) / s;
  float flap = 0.25 + 0.75 * abs(cos(t * 6.5 + ph));
  vec2 a = vec2(abs(q.x) / flap, q.y);
  float up = smoothstep(1.0, 0.8, length((a - vec2(0.62, -0.40)) / vec2(0.62, 0.52)));
  float lo = smoothstep(1.0, 0.8, length((a - vec2(0.45, 0.38)) / vec2(0.40, 0.36)));
  float wing = max(up, lo);
  float edge = smoothstep(0.55, 0.95, max(length((a - vec2(0.62, -0.40)) / vec2(0.62, 0.52)), length((a - vec2(0.45, 0.38)) / vec2(0.40, 0.36))));
  vec3 wc = mix(c1, c2, edge);
  float spots = smoothstep(0.14, 0.08, length(a - vec2(0.80, -0.50))) + smoothstep(0.10, 0.05, length(a - vec2(0.50, 0.42)));
  wc = mix(wc, vec3(1.0), spots * 0.9);
  float body = smoothstep(0.12, 0.06, abs(q.x)) * step(abs(q.y), 0.62);
  col = mix(col, wc, wing * 0.95);
  col = mix(col, vec3(0.10, 0.07, 0.06), body);
  return col;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);
  float wl = sm_luma(w);
  vec2 sun = vec2(asp * 0.20, 0.10);

  // ---- sky: washed clean by the shower, pale blue, thin clouds clearing; the picture lightly shows through
  vec3 skyTop = vec3(0.34, 0.62, 0.92);
  vec3 skyLow = vec3(0.82, 0.93, 0.98);
  vec3 sky = mix(skyTop, skyLow, pow(smoothstep(0.0, 0.62, uv.y), 0.8));
  sky = mix(sky, mix(w, vec3(0.80, 0.90, 1.0), 0.55), 0.18);
  float cl = sm_fbm(vec2(p.x * 1.3 + t * 0.010, uv.y * 3.2) + 4.0);
  float cloud = smoothstep(0.52, 0.80, cl) * smoothstep(0.55, 0.05, uv.y);
  sky = mix(sky, vec3(0.97, 0.98, 1.0), cloud * 0.60);
  // faint rainbow opposite the sun
  {
    vec2 rc = vec2(asp * 0.86, 0.95);
    float rd = length(p - rc);
    float band = (rd - 0.70) / 0.075;
    float rb = smoothstep(1.0, 0.0, abs(band));
    vec3 spec = 0.5 + 0.5 * cos(6.2832 * (band * 0.30 + 0.5 + vec3(0.0, 0.33, 0.67)));
    sky = mix(sky, sky + spec * 0.35, rb * 0.30 * smoothstep(0.62, 0.30, uv.y) * smoothstep(0.1, 0.35, uv.y));
  }
  // the sun and its soft light
  vec2 sd = p - sun;
  float sl = length(sd);
  sky += vec3(1.0, 0.94, 0.72) * (exp(-sl * sl / 0.0016) * 0.9 + exp(-sl * sl / 0.025) * 0.28 + exp(-sl / 0.8) * 0.08);
  float rays = pow(0.5 + 0.5 * sin(atan(sd.y, sd.x) * 11.0 + t * 0.04 + 1.0 * sin(t * 0.05)), 3.0);
  sky += vec3(1.0, 0.95, 0.75) * rays * exp(-sl * 1.6) * 0.10 * smoothstep(0.0, 0.2, sl);
  vec3 col = sky;

  // ---- three rolling hills in blue-green haze, mist lying in the folds
  float y1 = sm_hill1(p.x), y2 = sm_hill2(p.x), y3 = sm_hill3(p.x);
  col = mix(col, mix(vec3(0.46, 0.70, 0.78), vec3(0.40, 0.72, 0.46), smoothstep(y1, y1 + 0.08, uv.y)), smoothstep(y1 - 0.002, y1 + 0.003, uv.y));
  float mist1 = exp(-pow((uv.y - (y1 + 0.045)) / 0.04, 2.0)) * (0.45 + 0.8 * sm_fbm(vec2(p.x * 2.0 + t * 0.012, uv.y * 8.0)));
  col = mix(col, vec3(0.92, 0.97, 0.96), clamp(mist1 * 0.22, 0.0, 0.35));
  col = mix(col, mix(vec3(0.34, 0.66, 0.30), vec3(0.28, 0.62, 0.20), smoothstep(y2, y2 + 0.08, uv.y)), smoothstep(y2 - 0.002, y2 + 0.003, uv.y));
  float mist2 = exp(-pow((uv.y - (y2 + 0.040)) / 0.035, 2.0)) * (0.45 + 0.8 * sm_fbm(vec2(p.x * 2.4 - t * 0.010, uv.y * 9.0 + 3.0)));
  col = mix(col, vec3(0.92, 0.97, 0.94), clamp(mist2 * 0.22, 0.0, 0.35));

  // ---- the meadow: fresh grass, sunlit from the upper left, gusts rolling over it
  float mm = smoothstep(y3 - 0.002, y3 + 0.003, uv.y);
  {
    float depth = clamp((uv.y - 0.60) / 0.40, 0.0, 1.0);
    vec3 gf = vec3(0.46, 0.80, 0.24);
    vec3 gn = vec3(0.13, 0.46, 0.09);
    vec3 gr = mix(gf, gn, pow(depth, 0.75));
    float gust = sm_gust(p.x * 1.0 + uv.y * 0.6, t);
    float tex = sm_n(vec2(p.x * (50.0 + 160.0 * depth), uv.y * (80.0 + 80.0 * depth)));
    float broad = sm_fbm(vec2(p.x * 2.2 - t * 0.05, uv.y * 4.0));
    gr *= 0.80 + 0.30 * tex + 0.30 * gust * (0.5 + 0.7 * broad);
    float sunLit = exp(-length((p - vec2(sun.x, 0.62)) * vec2(0.55, 1.4)) * 1.2);
    gr += vec3(0.30, 0.26, 0.05) * sunLit * 0.55;
    col = mix(col, gr, mm);
    // mist rising from the grass in the middle distance
    float mist3 = exp(-pow((uv.y - (y3 + 0.045)) / 0.05, 2.0)) * (0.4 + 0.8 * sm_fbm(vec2(p.x * 2.6 + t * 0.014, uv.y * 7.0 + 8.0)));
    col = mix(col, vec3(0.92, 0.98, 0.93), clamp(mist3 * 0.26, 0.0, 0.40));
  }

  // ---- wildflowers in three depths, painted far to near
  {
    vec4 f0 = sm_flowers(p, 0.034, 0.655, 0.40, 0.0080, 1.0, t, sun);
    col = mix(col, f0.rgb, f0.a);
    vec4 f1 = sm_flowers(p + 0.013, 0.062, 0.700, 0.34, 0.0150, 5.0, t, sun);
    col = mix(col, f1.rgb, f1.a);
    vec4 f2 = sm_flowers(p + 0.041, 0.115, 0.790, 0.27, 0.0280, 9.0, t, sun);
    col = mix(col, f2.rgb, f2.a);
  }

  // ---- foreground grass blades swaying along the bottom edge
  {
    float N = 38.0;
    float idx = floor(p.x * N);
    float bl = 0.0;
    vec3 bcol = vec3(0.0);
    for (int i = -1; i <= 1; i++) {
      float bi = idx + float(i);
      vec2 hh = sm_h2(vec2(bi, 3.0));
      float cx = (bi + 0.2 + 0.6 * hh.x) / N;
      float ht = 0.07 + 0.11 * hh.y;
      float tip = 1.0 - ht;
      float s = clamp((uv.y - tip) / ht, 0.0, 1.0);                    // 0 at the tip, 1 at the root
      float lean = (sm_gust(cx, t) * 0.7 + (hh.x - 0.5) * 0.8) * 0.030 * (1.0 - s) * (1.0 - s);
      float wd = 0.0060 * s + 0.0006;
      float inb = smoothstep(wd, wd * 0.5, abs(p.x - cx - lean)) * step(tip, uv.y);
      if (inb > bl) {
        bl = inb;
        bcol = mix(vec3(0.46, 0.80, 0.20), vec3(0.06, 0.30, 0.06), s) * (0.8 + 0.4 * hh.y);
        bcol += vec3(0.25, 0.22, 0.05) * exp(-length(vec2(cx, uv.y) - vec2(sun.x, 0.80)) * 1.0) * 0.4;
      }
    }
    col = mix(col, bcol, bl);
  }

  // ---- bees and butterflies
  col = sm_bee(col, p, vec2(asp * 0.55, 0.66), vec2(0.20, 0.045), 0.62, 0.0, t);
  col = sm_bee(col, p, vec2(asp * 0.30, 0.74), vec2(0.15, 0.040), 0.48, 2.5, t);
  col = sm_butterfly(col, p, vec2(asp * 0.64, 0.56), vec2(0.40, 0.065), 0.19, 0.5, vec3(1.0, 0.62, 0.12), vec3(0.20, 0.10, 0.06), t);
  col = sm_butterfly(col, p, vec2(asp * 0.40, 0.67), vec2(0.30, 0.05), 0.23, 3.0, vec3(0.55, 0.78, 1.0), vec3(0.14, 0.18, 0.40), t);

  // ---- raindrops sparkling on the grass in the sun
  {
    vec2 g = p / 0.032;
    vec2 id = floor(g);
    float h = sm_h(id + 40.0);
    vec2 c = id + 0.2 + 0.6 * sm_h2(id + 43.0);
    vec2 d = (g - c) * 0.032;
    float tw = pow(max(0.0, sin(t * (0.6 + 1.8 * h) + h * 90.0)), 10.0);
    float core = exp(-dot(d, d) / 0.0000045);
    float cross = (exp(-abs(d.x) * 500.0) * exp(-abs(d.y) * 60.0) + exp(-abs(d.y) * 500.0) * exp(-abs(d.x) * 60.0));
    float zone = smoothstep(y3 + 0.01, y3 + 0.07, uv.y);
    col += vec3(1.0, 0.98, 0.88) * step(0.80, h) * (core * 1.4 + cross * 0.7) * (0.25 + 0.75 * tw) * zone;
  }

  // ---- petals blowing across the meadow; with the pointer they sail toward it
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    vec2 hh = sm_h2(vec2(fi, 77.0));
    float ph = fract(t * (0.030 + 0.020 * hh.y) + hh.x * 3.7 + fi * 0.1);
    float env = smoothstep(0.0, 0.10, ph) * smoothstep(1.0, 0.82, ph);
    vec2 start = vec2(sm_h(vec2(fi, 3.0)) * asp, 0.30 + 0.65 * sm_h(vec2(fi, 8.0)));
    vec2 pos = start + vec2(ph * 0.55 + sin(ph * 9.0 + fi) * 0.03, ph * 0.10 + cos(ph * 7.0 + fi * 1.7) * 0.03);
    if (hasM) {
      vec2 hover = mp + 0.045 * vec2(cos(t * 0.8 + fi * 2.1), sin(t * 0.9 + fi * 1.3));
      float pull = smoothstep(0.0, 0.62, ph);
      pos = mix(pos, hover, pull * 0.92);
    }
    vec2 q = sm_rot(p - pos, t * (0.9 + hh.x) + fi * 1.7);
    q.y *= 0.8 + 0.5 * sin(t * 2.3 + fi);                     // tumbling edge-on and flat
    float pet = smoothstep(1.0, 0.7, length(q / vec2(0.0165, 0.0090)));
    float tip = smoothstep(0.0, 1.0, q.x / 0.0165 * 0.5 + 0.5);
    vec3 pc = hh.y < 0.40 ? vec3(1.0, 0.72, 0.84) : (hh.y < 0.75 ? vec3(1.0, 0.97, 0.97) : vec3(1.0, 0.90, 0.55));
    pc = mix(pc, pc * vec3(1.0, 0.82, 0.88), tip * 0.5);
    col = mix(col, pc, pet * env * 0.92);
  }

  // a warm, clear light over everything, a whisper of the picture's own tone
  col *= 0.95 + 0.10 * wl;
  col += vec3(0.020, 0.018, 0.0) * (1.0 - uv.y);
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
