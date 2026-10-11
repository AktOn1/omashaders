// label: Zen sand
// hint: a dry zen garden from above, raked sand lines curling around two stones, a slow band of light and now and then one maple leaf; the pointer draws a faint rake line behind it
// category: Quiet and focus
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
float zs_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float zs_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(zs_h(i), zs_h(i + vec2(1, 0)), f.x), mix(zs_h(i + vec2(0, 1)), zs_h(i + vec2(1, 1)), f.x), f.y);
}
float zs_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * zs_n(p); p = p * 2.03 + 11.0; a *= 0.5; }
  return v;
}
float zs_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float zs_smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// the two stones (aspect-corrected screen units, y grows downward): signed distance to an irregular rounded stone
vec2 zs_cA(float asp) { return vec2(0.60 * asp, 0.47); }
vec2 zs_cB(float asp) { return vec2(0.715 * asp, 0.625); }
float zs_stone(vec2 p, vec2 c, float r, float seed) {
  vec2 q = p - c;
  float a = atan(q.y, q.x);
  float rr = r * (1.0 + 0.09 * sin(2.0 * a + seed) + 0.05 * sin(3.0 * a + seed * 2.1) + 0.02 * sin(7.0 * a + seed));
  return length(q * vec2(1.0, 1.16)) - rr;
}
float zs_dmin(vec2 p, float asp) {
  return min(zs_stone(p, zs_cA(asp), 0.090, 1.3), zs_stone(p, zs_cB(asp), 0.054, 4.1));
}

// raked sand: height of the grooves at p; straight soft curves far away, concentric rings round the stones
float zs_height(vec2 p, float asp) {
  float dA = zs_stone(p, zs_cA(asp), 0.090, 1.3);
  float dB = zs_stone(p, zs_cB(asp), 0.054, 4.1);
  float ds = zs_smin(dA, dB, 0.07);
  float F = 1.0 / 0.026;
  float wob = 0.075 * sin(p.x * 1.5 + 0.6) + 0.030 * sin(p.x * 3.7 + 2.0 + p.y * 2.0) + 0.010 * sin(p.x * 9.0 + p.y * 3.0);
  float Ps = (p.y + wob) * F + 2.4 * exp(-max(ds, 0.0) * max(ds, 0.0) / 0.05);
  float Pr = ds * F;
  float m = smoothstep(0.17, 0.145, ds);
  float h = mix(cos(6.2831853 * Ps), cos(6.2831853 * Pr), m);
  return h * smoothstep(0.0, 0.025, min(dA, dB) + 0.002 - 0.0) ;
}

// a maple leaf in leaf units (q in units of the leaf radius, pointing up): returns coverage in x, vein light in y, stem in z
vec3 zs_leaf(vec2 q) {
  float a = atan(q.x, -q.y);
  float r = length(q);
  float sa = abs(sin(2.5 * a));
  float edge = (0.46 + 0.54 * (1.0 - 0.62 * pow(sa, 0.85))) * (1.0 + 0.08 * cos(a * 18.0)) * (1.0 + 0.12 * cos(a));
  float body = smoothstep(edge, edge - 0.07, r);
  float vein = smoothstep(0.13, 0.0, sa) * smoothstep(0.05, 0.25, r) * smoothstep(edge, edge * 0.5, r);
  float stem = smoothstep(0.045, 0.02, abs(q.x)) * step(0.0, q.y) * step(q.y, 1.30);
  return vec3(max(body, stem), vein, stem * (1.0 - body));
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  // ---- raked sand, lit from the upper left
  vec2 L = normalize(vec2(-1.0, -0.8));
  float e = 0.0032;
  float h0 = zs_height(p, asp);
  float h1 = zs_height(p + L * e, asp);
  float lit = h0 - h1;                                         // grooves facing the light are bright
  float grain = zs_n(p * 520.0) * 0.6 + zs_n(p * 1300.0 + 4.0) * 0.4;
  vec3 sand = vec3(0.835, 0.790, 0.690);
  sand *= 0.985 + 0.030 * (zs_n(p * 3.0 + 7.0) - 0.5) * 2.0;     // slow mottling of the sand itself
  vec3 col = sand * (1.0 + 0.045 * lit - 0.020 * (1.0 - h0) * 0.5);
  col *= 0.975 + 0.05 * grain;

  // ---- the stones, with a soft shadow falling down and to the right
  vec2 shOff = vec2(0.020, 0.026);
  float dShadow = zs_dmin(p - shOff, asp);
  float shadow = smoothstep(0.035, -0.020, dShadow);
  float dS = zs_dmin(p, asp);
  col *= 1.0 - 0.17 * shadow * smoothstep(0.0, 0.01, dS);
  float inside = smoothstep(0.003, -0.003, dS);
  if (inside > 0.0) {
    float dA = zs_stone(p, zs_cA(asp), 0.090, 1.3);
    vec2 cc = dA < zs_stone(p, zs_cB(asp), 0.054, 4.1) ? zs_cA(asp) : zs_cB(asp);
    float rad = dA < zs_stone(p, zs_cB(asp), 0.054, 4.1) ? 0.090 : 0.054;
    vec2 q = (p - cc) / rad;
    float dome = clamp(1.0 - dot(q, q) * 0.6, 0.0, 1.0);
    float light = clamp(0.30 + dot(q, L) * 0.40 + 0.40 * dome, 0.0, 1.0);
    vec3 stone = mix(vec3(0.215, 0.208, 0.200), vec3(0.560, 0.545, 0.520), light);
    stone *= 0.88 + 0.24 * zs_fbm(p * 70.0);                   // speckle
    col = mix(col, stone, inside);
  }
  // a thin sand lip around each stone
  col += vec3(0.05, 0.045, 0.035) * smoothstep(0.02, 0.0, abs(dS - 0.010)) * 0.5;

  // ---- very slow light: a broad warm band drifting across, plus faint cloud-light mottling
  float u = p.x * 0.8 + p.y * 0.6;
  float c0 = -0.7 + 3.4 * fract(t / 220.0);
  float band = exp(-pow((u - c0) / 0.34, 2.0));
  col += vec3(0.060, 0.045, 0.020) * band;
  col *= 0.97 + 0.06 * zs_fbm(p * 0.55 + vec2(t * 0.004, t * 0.002));

  // ---- one maple leaf, now and then: it drifts across, turns slowly, and is gone again
  float Tc = 34.0;
  float cyc = floor(t / Tc);
  float k = fract(t / Tc);
  float vis = smoothstep(0.06, 0.20, k) * smoothstep(0.96, 0.80, k);
  if (vis > 0.001) {
    float sx = (0.12 + 0.55 * zs_h(vec2(cyc, 1.0))) * asp;
    float sy = 0.12 + 0.70 * zs_h(vec2(cyc, 2.0));
    float dir = zs_h(vec2(cyc, 3.0)) > 0.5 ? 1.0 : -1.0;
    vec2 lc = vec2(sx + dir * 0.30 * (k - 0.5) + 0.012 * sin(k * 17.0), sy + 0.10 * (k - 0.5) + 0.010 * sin(k * 11.0 + 1.0));
    float rot = 6.2831853 * zs_h(vec2(cyc, 4.0)) + k * 1.3 + 0.35 * sin(k * 8.0);
    float cr = cos(rot), sr = sin(rot);
    float sz = 0.042;
    vec2 d = p - lc;
    // shadow on the sand, offset away from the light
    vec2 ds2 = d - vec2(0.006, 0.008);
    vec2 qs = vec2(cr * ds2.x + sr * ds2.y, -sr * ds2.x + cr * ds2.y) / sz;
    vec3 lsh = zs_leaf(qs);
    col *= 1.0 - 0.14 * lsh.x * vis;
    vec2 ql = vec2(cr * d.x + sr * d.y, -sr * d.x + cr * d.y) / sz;
    ql.x /= 0.82 + 0.18 * cos(k * 6.0 + cyc);                  // a slight tumble
    vec3 lf = zs_leaf(ql);
    float r = length(ql);
    vec3 lcol = mix(vec3(0.66, 0.20, 0.08), vec3(0.84, 0.44, 0.14), smoothstep(0.1, 0.95, r));
    lcol = mix(lcol, vec3(0.93, 0.62, 0.24), lf.y * 0.55);
    lcol = mix(lcol, vec3(0.48, 0.20, 0.09), lf.z);
    lcol *= 0.92 + 0.12 * zs_n(p * 90.0);
    col = mix(col, lcol, lf.x * vis * 0.94);
  }

  // ---- the pointer's rake: three faint tines drawn behind it, fading away to the left
  if (hasM) {
    float dx = p.x - mp.x;
    float tail = 0.34;
    float along = smoothstep(-tail, -0.02, dx) * smoothstep(0.012, -0.012, dx);
    float lineA = 0.0;
    for (int i = 0; i < 3; i++) {
      float off = (float(i) - 1.0) * 0.016;
      float yc = mp.y + off + 0.016 * sin(dx * 9.0 + 0.5) * (1.0 + dx * 1.5);
      float dd = abs(p.y - yc);
      lineA += exp(-dd * dd / (2.0 * 0.0034 * 0.0034));
    }
    lineA = clamp(lineA, 0.0, 1.0) * along;
    float dTip = length((p - mp) * vec2(1.0, 1.0));
    col *= 1.0 - 0.085 * lineA;
    col += vec3(0.035, 0.030, 0.020) * lineA * smoothstep(0.0, -0.3, dx) * 0.0;
    col += vec3(0.05, 0.042, 0.03) * exp(-dTip * dTip / 0.0012) * 0.45;   // a faint glint at the tip
  }

  // ---- the user's picture stays faintly present
  col *= 0.965 + 0.07 * zs_luma(w);
  col *= 1.0 - 0.14 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
  fragColor = vec4(col, 1.0) * qt_Opacity;
  return fragColor;
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
