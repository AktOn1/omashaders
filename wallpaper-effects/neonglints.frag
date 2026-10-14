// label: Neon glints
// hint: cross-shaped star glints and soft flickering light pulses on the brightest, most saturated spots (signs, lamps, sun), in their own hue
// category: Night and water
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



// score of a picture sample: bright and saturated wins, plain bright is allowed but weaker
float ng_score(vec3 c) {
  float v = max(c.r, max(c.g, c.b));
  float s = (v - min(c.r, min(c.g, c.b))) / max(v, 0.04);
  return v * v * (0.35 + 0.65 * s);
}
vec3 ng_hue(vec3 c) {            // the pixel's own hue at full brightness
  float v = max(c.r, max(c.g, c.b));
  vec3 h = c / max(v, 0.05);
  return mix(vec3(dot(h, vec3(0.3333))), h, 1.2);
}

// one layer of glints: every cell looks at n taps of the picture, keeps the brightest one and, if it stands out from the rest of the cell, puts a star there
vec3 ng_layer(vec2 p, float asp, float sc, float size, float seed, int n, vec2 mp, float nearPtr, float boost) {
  vec2 g = p * sc;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float smax = 0.0, ssum = 0.0;
  vec2 bpos = vec2(0.5);
  vec3 bcol = vec3(0.0);
  vec2 off = vec2(hash(id + seed), hash(id + seed + 5.5));
  for (int k = 0; k < 8; k++) {
    if (k >= n) break;
    vec2 r2 = fract(vec2(0.5 + float(k) * 0.7548777, 0.5 + float(k) * 0.5698403) + off);
    vec2 pos = 0.2 + 0.6 * r2;
    vec2 q = (id + pos) / sc;
    vec3 c = wall(vec2(q.x / asp, q.y));
    float s = ng_score(c);
    ssum += s;
    if (s > smax) { smax = s; bpos = pos; bcol = c; }
  }
  float contrast = smax - ssum / float(n);
  float gate = smoothstep(0.045, 0.17, contrast * boost) * smoothstep(0.15, 0.4, smax);
  if (gate <= 0.001) return vec3(0.0);
  float h = hash(id + seed + 2.2), h2 = hash(id + seed + 7.7);
  // slow flicker (well under 2 Hz) and a slow come-and-go envelope
  float fl = 0.72 + 0.28 * sin(time * (1.3 + 1.5 * h) + h2 * 60.0) * (0.6 + 0.4 * sin(time * 0.7 + h * 20.0));
  float env = smoothstep(-0.55, 0.35, sin(time * (0.28 + 0.25 * h2) + h * 50.0));
  float pt = 1.0 + nearPtr * exp(-dot((id + bpos) / sc - mp, (id + bpos) / sc - mp) / (2.0 * 0.16 * 0.16));
  vec2 d = (f - bpos) / sc / (size * (0.8 + 0.5 * smoothstep(0.1, 0.6, smax)) * (1.0 + 0.35 * (pt - 1.0)));
  vec2 ad = abs(d);
  float r2d = dot(d, d);
  float core = exp(-r2d * 5.0);
  vec2 dr = vec2(d.x + d.y, d.x - d.y) * 0.7071;
  float cross = exp(-ad.x * 1.5 - ad.y * 16.0) + exp(-ad.y * 1.5 - ad.x * 16.0);
  float diag = exp(-abs(dr.x) * 3.0 - abs(dr.y) * 18.0) + exp(-abs(dr.y) * 3.0 - abs(dr.x) * 18.0);
  float halo = exp(-sqrt(r2d) * 1.5) * 0.55;
  // fade at the cell border so a star near the edge does not get cut off
  vec2 w2 = smoothstep(0.0, 0.14, f) * smoothstep(1.0, 0.86, f);
  float win = w2.x * w2.y;
  vec3 tint = ng_hue(bcol);
  vec3 lightc = mix(tint, vec3(1.0), 0.5);
  vec3 o = lightc * (core * 1.1 + cross * 0.9 + diag * 0.28) + tint * halo;
  return o * win * gate * fl * env * pt;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  // how much the picture varies overall: a dull, low-contrast picture gets a proportionally lower bar, so it still shows a few glints
  float lo = 9.0, hi = 0.0;
  for (int k = 0; k < 6; k++) {
    float s = ng_score(wall(vec2(0.17 + 0.33 * float(k - 3 * (k / 3)), 0.25 + 0.5 * float(k / 3))));
    lo = min(lo, s); hi = max(hi, s);
  }
  float boost = clamp(0.3 / max(hi - lo, 0.001), 1.0, 2.2);
  vec3 add = ng_layer(p, asp, 3.4, 0.055, 3.0, 4, mp, 0.8, boost) * 0.95
           + ng_layer(p, asp, 8.0, 0.026, 11.0, 8, mp, 0.8, boost) * 0.75;
  col = 1.0 - (1.0 - col) * (1.0 - clamp(add, 0.0, 1.0));
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
