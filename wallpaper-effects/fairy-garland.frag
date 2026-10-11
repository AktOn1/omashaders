// label: Fairy lights
// hint: deep winter evening: strings of warm fairy lights glow over snowy pines while snow falls; the pointer makes the nearest bulbs shine brighter
// category: Seasons and festivals
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
float frg_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float frg_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 frg_h22(vec2 p) { return vec2(frg_h2(p), frg_h2(p + vec2(37.2, 91.7))); }
float frg_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(frg_h2(i), frg_h2(i + vec2(1, 0)), f.x), mix(frg_h2(i + vec2(0, 1)), frg_h2(i + vec2(1, 1)), f.x), f.y);
}
float frg_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * frg_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float frg_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// one string of fairy lights: swags between hooks, bulbs along it. returns glow (xyz = colour, w = wire shadow)
vec3 frg_string(vec2 p, float y0, float sag, float swagLen, float spacing, float seed, float t, vec2 m, float S, out float wire) {
  vec3 acc = vec3(0.0);
  wire = 0.0;
  float sw = swagLen * S;
  float u = fract((p.x + seed * 97.0 * S) / sw);
  float yy = y0 * res.y + sag * S * 4.0 * u * (1.0 - u) + 3.0 * S * sin(t * 0.5 + p.x * 0.004 + seed);
  wire = smoothstep(1.6 * S, 0.4 * S, abs(p.y - yy));
  float sp = spacing * S;
  float bi = floor((p.x + seed * 97.0 * S) / sp);
  for (int k = -2; k <= 2; k++) {
    float i = bi + float(k);
    float bx = (i + 0.5) * sp - seed * 97.0 * S;
    float bu = fract((bx + seed * 97.0 * S) / sw);
    float by = y0 * res.y + sag * S * 4.0 * bu * (1.0 - bu) + 3.0 * S * sin(t * 0.5 + bx * 0.004 + seed) + 6.0 * S;
    float h = frg_h(i * 3.7 + seed * 11.0);
    vec3 c = h < 0.55 ? vec3(1.0, 0.76, 0.40) : (h < 0.80 ? vec3(1.0, 0.88, 0.62) : (h < 0.92 ? vec3(1.0, 0.55, 0.45) : vec3(0.60, 0.80, 1.0)));
    float tw = 0.65 + 0.35 * sin(t * (0.8 + 1.5 * h) + h * 50.0);
    float near = exp(-pow(length(vec2(bx, by) - m) / (210.0 * S), 2.0));
    float d = length(vec2(p.x - bx, (p.y - by) * 0.92));
    float core = smoothstep(4.5 * S, 1.2 * S, d);
    float glow = exp(-d * d / (2.0 * pow(13.0 * S, 2.0))) * 0.50 + exp(-d * d / (2.0 * pow(32.0 * S, 2.0))) * 0.16;
    acc += c * (core * 1.4 + glow) * tw * (1.0 + 0.9 * near);
  }
  return acc;
}

float frg_pine(vec2 p, float cx, float baseY, float hgt, float wid) {
  float u = (baseY - p.y) / hgt;                      // 0 at the foot, 1 at the tip
  if (u < 0.0 || u > 1.0) return 0.0;
  float tiers = fract(u * 8.0 + 0.3);
  float w = wid * (1.0 - u) * (0.50 + 0.50 * tiers) * (1.0 - 0.0 * u);
  return smoothstep(w, w - 2.0, abs(p.x - cx)) * step(0.0, u);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  vec2 p = uv * res;
  float S = res.y / 1080.0;
  float t = time;
  vec3 base = wall(uv);

  // winter evening sky: ink blue overhead, a pale teal glow where the sun has just gone
  vec3 sky = mix(vec3(0.020, 0.040, 0.120), vec3(0.17, 0.27, 0.42), pow(smoothstep(0.0, 0.85, uv.y), 1.6));
  vec3 col = mix(base * vec3(0.30, 0.42, 0.65), sky, 0.78);
  float st = frg_h2(floor(p / (7.0 * S)));
  col += vec3(0.8, 0.9, 1.0) * step(0.9975, st) * (1.0 - uv.y) * 0.5 * (0.6 + 0.4 * sin(t + st * 90.0));

  // soft out-of-focus lights in the distance
  vec2 bq = p / (230.0 * S) + vec2(t * 0.004, 0.0);
  vec2 bi = floor(bq), bf = fract(bq) - 0.5;
  float bh = frg_h2(bi + 11.0);
  vec2 bo = (frg_h22(bi) - 0.5) * 0.5;
  float bd = length(bf - bo);
  float bok = smoothstep(0.30, 0.18, bd) * step(0.72, bh) * (0.35 + 0.35 * sin(t * 0.3 + bh * 30.0));
  col += mix(vec3(1.0, 0.65, 0.30), vec3(1.0, 0.85, 0.55), frg_h(bh * 9.0)) * bok * 0.12 * smoothstep(0.1, 0.5, uv.y);

  // snowy hills
  float hy1 = 0.80 + 0.035 * frg_n(vec2(uv.x * 2.5, 2.0)) + 0.012 * frg_n(vec2(uv.x * 9.0, 7.0));
  float hy2 = 0.88 + 0.030 * frg_n(vec2(uv.x * 2.0 + 5.0, 4.0));
  col = mix(col, vec3(0.16, 0.24, 0.40), smoothstep(hy1 - 0.002, hy1 + 0.002, uv.y));
  col = mix(col, mix(vec3(0.22, 0.31, 0.48), vec3(0.36, 0.46, 0.64), frg_fbm(vec2(uv.x * 4.0, uv.y * 30.0))), smoothstep(hy2 - 0.002, hy2 + 0.002, uv.y));
  col += vec3(0.10, 0.10, 0.08) * smoothstep(hy2, 1.0, uv.y) * 0.3;

  // pine silhouettes at both sides, each with a dim string of lights spiralling up
  float pn = 0.0;
  pn = max(pn, frg_pine(p, 0.08 * res.x, 1.02 * res.y, 0.80 * res.y, 150.0 * S));
  pn = max(pn, frg_pine(p, 0.17 * res.x, 1.02 * res.y, 0.56 * res.y, 105.0 * S));
  pn = max(pn, frg_pine(p, 0.93 * res.x, 1.02 * res.y, 0.70 * res.y, 135.0 * S));
  pn = max(pn, frg_pine(p, 0.84 * res.x, 1.02 * res.y, 0.46 * res.y, 90.0 * S));
  pn = max(pn, frg_pine(p, 0.74 * res.x, 1.02 * res.y, 0.30 * res.y, 62.0 * S));
  col = mix(col, vec3(0.012, 0.030, 0.045), pn * 0.93);
  // snow dusting on the tiers
  col += vec3(0.20, 0.26, 0.34) * pn * smoothstep(0.62, 0.9, frg_n(p / (14.0 * S))) * 0.30;

  // three strings of fairy lights hung across the top
  float w1, w2, w3;
  vec3 g = frg_string(p, 0.07, 80.0, 560.0, 64.0, 0.0, t, mpx, S, w1);
  g += frg_string(p, 0.165, 100.0, 460.0, 58.0, 1.3, t, mpx, S, w2);
  g += frg_string(p, 0.26, 70.0, 640.0, 72.0, 2.6, t, mpx, S, w3);
  col = mix(col, vec3(0.02, 0.025, 0.04), max(w1, max(w2, w3)) * 0.65);
  col += g * 0.62;
  // warm light falls on everything near the strings, very softly
  col += vec3(1.0, 0.62, 0.30) * 0.02 * smoothstep(0.35, 0.0, uv.y);

  // gently falling snow, two layers
  for (int L = 0; L < 2; L++) {
    float cs = (L == 0 ? 46.0 : 90.0) * S;
    vec2 q = p / cs + vec2(sin(t * 0.3 + float(L)) * 0.6, -t * (L == 0 ? 0.22 : 0.12));
    vec2 id = floor(q), f = fract(q) - 0.5;
    float h = frg_h2(id + float(L) * 7.0);
    vec2 o = (frg_h22(id + float(L)) - 0.5) * 0.5 + vec2(sin(t * 0.7 + h * 20.0) * 0.12, 0.0);
    float fl = smoothstep(L == 0 ? 0.075 : 0.045, 0.01, length(f - o)) * step(0.5, h);
    col += vec3(0.85, 0.92, 1.0) * fl * (L == 0 ? 0.55 : 0.30);
  }

  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
