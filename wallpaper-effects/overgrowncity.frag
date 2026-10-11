// label: Overgrown city
// hint: skyscrapers swallowed by vines and trees over a flooded street, long sun shafts, drifting pollen and a few birds; the pollen drifts toward the pointer and the shafts brighten near it
// category: Wastelands
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

float oc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float oc_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(oc_hash(i), oc_hash(i + vec2(1, 0)), f.x), mix(oc_hash(i + vec2(0, 1)), oc_hash(i + vec2(1, 1)), f.x), f.y);
}
float oc_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * oc_noise(p); p = p * 2.03 + 13.0; a *= 0.5; }
  return v;
}
float oc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float OC_W = 0.72;     // half width of the street canyon
const float OC_H = 0.40;     // camera height above the water
const float OC_ZF = 12.0;    // haze swallows everything beyond this depth
const vec3 OC_SUN = vec3(1.0, 0.88, 0.58);
const vec3 OC_HAZE = vec3(0.70, 0.84, 0.88);

// height of the skyline on one side at depth z (up is positive); some roofs carry a tree crown
float oc_base(float z, float sd) {
  float idx = floor(z / 1.25 + sd * 0.5);
  return 0.85 + 0.95 * oc_hash(vec2(idx, sd * 5.0 + 1.0));
}
float oc_crown(float z, float sd) {
  float idx = floor(z / 1.25 + sd * 0.5);
  return step(0.35, oc_hash(vec2(idx, sd * 3.0 + 9.0))) * (0.05 + 0.22 * smoothstep(0.25, 0.75, oc_fbm(vec2(z * 3.4, sd * 4.0 + 2.0))));
}

vec3 oc_sky(vec2 d, float t) {
  float el = clamp(-d.y * 1.3, 0.0, 1.0);
  vec3 c = mix(vec3(0.80, 0.91, 0.96), vec3(0.22, 0.50, 0.92), pow(el, 0.65));
  float cl = oc_fbm(vec2(d.x * 1.6 + t * 0.006, d.y * 4.0 + 3.0));
  c = mix(c, vec3(1.0, 0.99, 0.96), smoothstep(0.52, 0.80, cl) * 0.55 * (0.4 + 0.6 * el));
  float sg = exp(-length(d - vec2(0.55, -0.80)) * 1.8);
  c += OC_SUN * sg * 0.25;
  return c;
}

// one side of the canyon: a concrete tower with window grid, broken storeys and a coat of vines
vec3 oc_facade(float Z, float Y, float sd, float t, out float seeThrough) {
  float lit = sd < 0.0 ? 1.0 : 0.0;                  // the left wall faces the sun
  float bi = floor(Z / 1.25 + sd * 0.5);
  float bh = oc_hash(vec2(bi, sd * 5.0));
  vec3 conc = mix(vec3(0.58, 0.58, 0.54), vec3(0.42, 0.50, 0.56), bh);
  vec2 g = vec2(Z / 0.30, Y / 0.26);
  vec2 cid = floor(g);
  vec2 f = fract(g);
  float h1 = oc_hash(cid + bi * 13.0);
  float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.20, f.y) * step(f.y, 0.86);
  vec3 glass = mix(vec3(0.24, 0.40, 0.46), vec3(0.50, 0.70, 0.78), h1) * (0.65 + 0.55 * f.y);
  glass = h1 > 0.80 ? vec3(0.03, 0.06, 0.06) : glass;
  vec3 col = mix(conc * (0.90 + 0.18 * smoothstep(0.0, 0.12, f.y)), glass, win);
  col *= 0.62 + 0.60 * oc_fbm(vec2(Z * 1.3, Y * 0.5) + sd * 7.0);           // weather stains
  // broken storeys: the facade is gone, you look into dark floors full of green, sometimes straight through to the sky
  float brk = smoothstep(0.66, 0.72, oc_noise(vec2(Z * 0.55 + bi * 3.0, Y * 0.45 + sd * 3.0)));
  col = mix(col, vec3(0.025, 0.055, 0.045) * (0.7 + 0.6 * oc_noise(vec2(Z * 5.0, Y * 5.0))), brk);
  seeThrough = brk * smoothstep(0.52, 0.60, oc_noise(vec2(Z * 0.9 + 5.0, Y * 0.7 + bi)));
  // vines and moss
  float alt = -Y;
  float vn = oc_fbm(vec2(Z * 2.1, Y * 1.5) + sd * 5.0);
  float strand = oc_noise(vec2(Z * 11.0, Y * 0.22 + bi)) * (0.45 + 0.9 * oc_noise(vec2(Z * 1.6, Y * 1.1 + 4.0)));
  float vpatch = smoothstep(0.68, 0.78, vn + 0.22 * smoothstep(0.9, -0.3, alt) + 0.20 * brk);
  float vine = smoothstep(0.50, 0.58, strand) * smoothstep(0.0, -0.9, Y + 0.0) ;
  float veg = max(vpatch, max(vine * 0.9, 0.0));
  float leaf = 0.30 + 0.45 * oc_noise(vec2(Z * 38.0, Y * 38.0)) + 0.25 * oc_noise(vec2(Z * 90.0, Y * 90.0));
  vec3 lc = mix(vec3(0.04, 0.14, 0.05), vec3(0.40, 0.60, 0.16), leaf * leaf);
  lc = mix(lc, vec3(0.80, 0.82, 0.30), 0.12 * step(0.93, oc_hash(floor(vec2(Z, Y) * 17.0))));   // a few yellow blossoms
  col = mix(col, lc, veg);
  // sun on the left wall, cool shade on the right
  vec3 lighting = mix(vec3(0.42, 0.55, 0.62), vec3(1.15, 1.02, 0.80), lit);
  col *= lighting * (0.78 + 0.38 * lit);
  return col;
}

// the canyon seen from a camera at height y0 (up is negative): walls, skyline and sky
vec3 oc_world(float dx, float dy, float y0, float t) {
  float z = OC_W / max(abs(dx), 0.0005);
  float sd = dx < 0.0 ? -1.0 : 1.0;
  float Zc = z;
  if (z > OC_ZF) { z = OC_ZF; Zc = 5.0 + dx * OC_ZF * 4.0; }          // the far end of the street: a hazy tower seen head-on
  float Y = y0 + dy * z;
  vec3 hz = OC_HAZE;
  float base = oc_base(Zc, sd);
  float top = base + oc_crown(Zc, sd);
  float st = 0.0;
  vec3 c;
  if (Y > -top) {
    if (Y < -base) {
      // tree crown on the roof
      float lf = 0.6 * oc_noise(vec2(Zc * 40.0, Y * 40.0)) + 0.4 * oc_noise(vec2(Zc * 95.0, Y * 95.0));
      c = mix(vec3(0.04, 0.15, 0.05), vec3(0.42, 0.64, 0.16), lf * lf * (sd < 0.0 ? 1.0 : 0.45)) * (sd < 0.0 ? 1.0 : 0.7);
    } else {
      c = oc_facade(Zc, Y, sd, t, st);
      if (st > 0.0) c = mix(c, oc_sky(vec2(dx, dy), t), st);
    }
    // air full of pollen and light thickens with distance
    float fog = 1.0 - exp(-z * 0.17);
    c = mix(c, hz * (sd < 0.0 ? 1.0 : 0.9), fog * 0.80);
  } else {
    c = oc_sky(vec2(dx, dy), t);
  }
  return c;
}

// slanting sun shafts from a sun above the right edge, broken into patches as if falling through holes in the floors
float oc_shafts(vec2 p, float asp, float t) {
  vec2 S = vec2(asp * 0.92, -0.38);
  vec2 r = p - S;
  float rl = length(r);
  float ang = atan(r.y, r.x);
  float b1 = smoothstep(0.38, 0.92, oc_noise(vec2(ang * 17.0 + 0.4 * sin(t * 0.05), 3.0)));
  float b2 = 0.50 + 0.50 * oc_noise(vec2(ang * 60.0, 7.0));
  float seg = smoothstep(0.30, 0.65, oc_fbm(vec2(ang * 4.5 + 2.0, rl * 1.6 - t * 0.01)));
  return b1 * b2 * (0.35 + 0.65 * seg) * exp(-rl * 0.95);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);

  vec2 vp = vec2(0.5 * asp, 0.50);
  vec2 d = p - vp;
  float ax = abs(d.x) / OC_W;
  float ay = d.y / OC_H;
  vec3 col;
  float shaftMul = 1.0;
  vec2 pm = p;                                     // position used for the shafts (mirrored in the water)
  if (d.y > 0.0 && ay > ax) {
    // ---------- flooded street ----------
    float zf = OC_H / d.y;
    float X = d.x * zf;
    float rip = (oc_noise(vec2(X * 11.0 + t * 0.12, zf * 6.0 - t * 0.35)) - 0.5) + (oc_noise(vec2(X * 27.0 - t * 0.2, zf * 14.0 + t * 0.5)) - 0.5) * 0.5;
    float rs = 0.006 / (0.5 + zf * 0.5);
    vec3 refl = oc_world(d.x + rip * rs * 0.7, -d.y + rip * rs * 0.7, 2.0 * OC_H, t);
    vec3 deep = vec3(0.05, 0.17, 0.18);
    float fres = 0.50 + 0.45 * smoothstep(0.45, 0.0, d.y);
    col = mix(deep, refl, fres) * (0.92 + 0.25 * rip);
    // glitter where the sun mirrors on the ripples
    float gl = exp(-pow((d.x - 0.12) / 0.22, 2.0)) * smoothstep(0.55, 0.9, oc_noise(vec2(X * 22.0, zf * 20.0 + t * 0.5) + rip));
    col += OC_SUN * gl * 0.35 * smoothstep(0.0, 0.05, d.y);
    // islands of rubble and grass, plus a bank of moss along each wall
    float isl = smoothstep(0.62, 0.67, oc_fbm(vec2(X * 1.6, zf * 0.7) + 3.0));
    float bank = smoothstep(0.62, 0.86, abs(X) / OC_W) * smoothstep(0.40, 0.58, oc_fbm(vec2(X * 3.0, zf * 1.2) + 8.0));
    float land = max(isl, bank);
    float lf = oc_noise(vec2(X * 60.0, zf * 60.0) / (0.4 + zf * 0.15));
    vec3 ground = mix(vec3(0.20, 0.22, 0.17), mix(vec3(0.07, 0.20, 0.06), vec3(0.42, 0.62, 0.17), lf * lf), 0.78);
    ground *= mix(0.55, 1.15, smoothstep(0.55, -0.1, X / OC_W * 0.7 + 0.2 * sin(zf * 1.2)));
    col = mix(col, ground * (1.0 - 0.45 * smoothstep(0.0, 6.0, zf)) , land);
    col = mix(col, OC_HAZE * 0.9, (1.0 - exp(-zf * 0.12)) * 0.55);
    pm = vec2(p.x, 2.0 * vp.y - p.y);
    shaftMul = 0.6;
  } else {
    col = oc_world(d.x, d.y, 0.0, t);
  }

  // ---------- birds in the open sky (small dark Vs, wings beating) ----------
  for (int i = 0; i < 3; i++) {
    float f = float(i);
    float bx = fract(t * (0.010 + 0.002 * f) + f * 0.37) * (asp + 0.4) - 0.2;
    float by = 0.10 + 0.10 * f + 0.02 * sin(t * 0.5 + f * 2.0);
    vec2 q = (p - vec2(bx, by)) / (0.016 - 0.002 * f);
    float flap = sin(t * 5.5 + f * 1.7);
    float wing = abs(q.y + abs(q.x) * (0.55 * flap - 0.15)) ;
    float bird = smoothstep(0.28, 0.05, wing) * step(abs(q.x), 1.3) * smoothstep(1.4, 1.0, abs(q.x));
    col = mix(col, vec3(0.06, 0.09, 0.12), bird * 0.75 * step(d.y, 0.02));
  }

  // ---------- sun shafts, brighter near the pointer ----------
  float boost = 1.0;
  if (hasM) boost += 1.6 * exp(-dot(p - mp, p - mp) / 0.16);
  float sh = oc_shafts(pm, asp, t) * boost * shaftMul;
  col += OC_SUN * sh * 0.62 * (1.0 - 0.75 * col);
  col = mix(col, col * vec3(1.06, 1.03, 0.92), 0.5);

  // ---------- foliage hanging into the frame from the top corners ----------
  {
    vec2 sw = vec2(sin(t * 0.35 + p.y * 3.0), cos(t * 0.30 + p.x * 4.0)) * 0.012;
    float cw = exp(-length(vec2(uv.x * 0.8, uv.y * 1.3)) * 4.0) + exp(-length(vec2((1.0 - uv.x) * 0.8, uv.y * 1.3)) * 4.0) * 0.9;
    float lm = oc_fbm((p + sw) * vec2(7.0, 8.0) + 4.0);
    float mask = smoothstep(0.52, 0.60, lm + cw * 0.9 - 0.45) * smoothstep(0.12, 0.40, cw);
    float lite = oc_noise((p + sw) * 31.0);
    vec3 fl = mix(vec3(0.03, 0.12, 0.04), vec3(0.34, 0.55, 0.12), lite * lite * (0.4 + 0.6 * smoothstep(0.1, 0.9, lm)));
    col = mix(col, fl, mask * 0.96);
  }

  // ---------- pollen: pulled toward the pointer ----------
  vec2 pp = p;
  if (hasM) {
    vec2 toM = mp - p;
    float g = exp(-dot(toM, toM) / 0.32);
    pp = p - toM * 0.85 * g;
  }
  float pol = 0.0;
  for (int k = 0; k < 3; k++) {
    float kf = float(k);
    float sc = 26.0 + 20.0 * kf;
    vec2 q = pp * sc + vec2(t * (0.30 + 0.20 * kf), -t * (0.12 + 0.06 * kf)) + vec2(sin(t * 0.3 + kf * 2.0) * 0.8, 0.0) + kf * 17.0;
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    vec2 off = (vec2(oc_hash(cell + 1.0), oc_hash(cell + 5.0)) - 0.5) * 0.6;
    float dd = length(f - off);
    float on = step(0.52, oc_hash(cell + 9.0 + kf));
    float tw = 0.55 + 0.45 * sin(t * (0.7 + oc_hash(cell) * 1.3) + oc_hash(cell + 2.0) * 6.28);
    pol += smoothstep(0.115 + 0.02 * (2.0 - kf), 0.0, dd) * on * tw * (0.55 + 0.30 * kf);
  }
  col += vec3(1.0, 0.92, 0.55) * pol * (0.35 + 0.9 * min(sh * 3.0 + 0.25, 1.4)) * 0.9;

  // let the user's picture tint the light a little
  col *= mix(vec3(1.0), 0.70 + 0.65 * pic, 0.18);
  col = col / (1.0 + 0.10 * col);
  col *= 1.0 - 0.30 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
  return vec4(clamp(col, 0.0, 1.0), 1.0) * qt_Opacity;
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
