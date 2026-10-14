// label: Birds in flight
// hint: small flocks of flapping bird silhouettes crossing the sky, scattering from the pointer
// category: Sun and sky
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}



float sk_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// one bird in local units (half wing span = 1, y down): two bent wings from a small body, flapping with phase ph
float sk_bird(vec2 p, float ph, float aa) {
  float fl = sin(ph) + 0.25 * sin(ph * 2.0 + 1.0);               // flap: wing tips up and down, with a quicker upstroke
  p.x = abs(p.x);
  vec2 el = vec2(0.46, -0.30 * fl - 0.04);                          // elbow
  vec2 tp = vec2(1.0 - 0.10 * abs(fl), -0.62 * fl + 0.10);          // wing tip
  float d1 = sk_seg(p, vec2(0.0, 0.02), el) - 0.115;
  float d2 = sk_seg(p, el, tp) - 0.05;
  float body = length(p * vec2(1.0, 0.8) - vec2(0.0, 0.04)) - 0.15;
  float d = min(min(d1, d2), body);
  return smoothstep(aa, -aa, d);
}

// one flock: up to six birds in a loose V, crossing the screen slowly; returns the colour with the birds drawn in
vec3 sk_flock(vec3 col, vec2 p, vec2 mp, float seed, float sz, float v, float y0, float dir) {
  float asp = res.x / res.y;
  float L = asp + 0.9;
  float x = mod(time * v + seed * 7.31, L) - 0.45;
  x = dir > 0.0 ? x : asp - x;
  float y = y0 + 0.018 * sin(time * 0.17 + seed * 5.0 + x * 2.0);
  vec2 fc = vec2(x, y);
  if (length(p - fc) > sz * 14.0) return col;                       // far from this flock: nothing to draw
  float aa = 1.0 / (sz * res.y);
  int n = 4 + int(hash(vec2(seed, 1.7)) * 3.0);
  vec3 outc = col;
  for (int i = 0; i < 7; i++) {
    if (i >= n) break;
    float fi = float(i);
    float h1 = hash(vec2(fi, seed)), h2 = hash(vec2(fi + 7.0, seed));
    float k = floor((fi + 1.0) * 0.5);
    float side = mod(fi, 2.0) < 0.5 ? -1.0 : 1.0;
    vec2 o = vec2(-dir * k * 2.9 * sz, side * k * 1.9 * sz);
    o += (vec2(h1, h2) - 0.5) * sz * 1.8;
    o.y += sz * 0.35 * sin(time * 0.6 + h1 * 6.0);
    vec2 bp = fc + o;
    vec2 dv = bp - mp;                                              // the pointer scatters the birds a little
    float w = exp(-dot(dv, dv) / (2.0 * 0.13 * 0.13));
    bp += dv / max(length(dv), 0.001) * w * 0.07;
    float ph = time * (5.2 + h2 * 1.6) + h1 * 20.0;                 // about 1 flap per second
    float cov = sk_bird((p - bp) / sz, ph, aa);
    if (cov > 0.002) {
      vec3 under = wall(clamp(bp / vec2(asp, 1.0), 0.0, 1.0));
      float lum = dot(under, vec3(0.2126, 0.7152, 0.0722));
      float dark = smoothstep(0.34, 0.52, lum);                     // dark birds on a bright sky, pale ones on a dark sky
      vec3 ink = mix(mix(under, vec3(0.96, 0.97, 1.0), 0.80), under * 0.14 + vec3(0.012, 0.010, 0.014), dark);
      outc = mix(outc, ink, cov * 0.9);
    }
  }
  return outc;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  col = sk_flock(col, p, mp, 1.0, 0.044, 0.034, 0.21, 1.0);
  col = sk_flock(col, p, mp, 2.0, 0.030, 0.027, 0.33, -1.0);
  col = sk_flock(col, p, mp, 3.0, 0.020, 0.023, 0.11, 1.0);
  col = sk_flock(col, p, mp, 4.0, 0.025, 0.030, 0.41, 1.0);
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
