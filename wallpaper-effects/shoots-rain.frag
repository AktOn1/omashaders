// label: Green shoots
// hint: first day of spring: a soft rain over a meadow of new green shoots, light breaking through the clouds, the pointer is a gust that bends grass and rain
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
float sr_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float sr_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 sr_h22(vec2 p) { return vec2(sr_h2(p), sr_h2(p + vec2(37.2, 91.7))); }
float sr_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sr_h2(i), sr_h2(i + vec2(1, 0)), f.x), mix(sr_h2(i + vec2(0, 1)), sr_h2(i + vec2(1, 1)), f.x), f.y);
}
float sr_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sr_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sr_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// fine rain streaks on one layer: cells across a slightly tilted axis, each column has one drop that falls
float sr_rain(vec2 p, float cell, float speed, float len, float seed, float t, float tilt) {
  vec2 q = vec2(p.x + p.y * tilt, p.y);
  float cx = floor(q.x / cell);
  float fx = q.x / cell - cx - 0.5;
  float h = sr_h(cx * 1.7 + seed);
  float cyc = 1.0 + h * 0.8;
  float y = fract((q.y / (cell * 9.0)) * 0.6 + t * speed * (0.7 + 0.6 * h) / cyc + h * 9.0);
  float line = smoothstep(0.16, 0.0, abs(fx - (h - 0.5) * 0.5));
  float head = smoothstep(0.0, 0.03, y) * smoothstep(len, 0.0, y);
  return line * head * step(0.35, sr_h(cx + seed * 3.1));
}

// one grass layer: blades that grow out of the ground line, lean with the wind and the pointer's gust
float sr_blades(vec2 p, float ground, float w, float hmax, float seed, float t, float gust, vec2 m, out float tipGlint, out float shade) {
  tipGlint = 0.0; shade = 0.0;
  float cov = 0.0;
  float ci = floor(p.x / w);
  for (int k = -2; k <= 2; k++) {
    float i = ci + float(k);
    float h1 = sr_h(i * 3.17 + seed), h2 = sr_h(i * 7.31 + seed + 4.0);
    float H = hmax * (0.25 + 0.75 * h1 * h1 + 0.2 * h2);
    float cx = (i + 0.5) * w + (h2 - 0.5) * w * 0.8;
    float tt = (ground - p.y) / H;
    if (tt < 0.0 || tt > 1.0) continue;
    float wind = sin(t * 0.7 + i * 0.35 + seed) * 0.25 + sin(t * 0.31 + i * 0.11) * 0.2 + gust * 0.9;
    // pointer gust: blades near the pointer lean away from it
    float dm = (cx - m.x) / 150.0;
    float push = dm * exp(-dm * dm) * exp(-pow((p.y - m.y) / 260.0, 2.0)) * 1.4;
    float lean = (wind + push + (h1 - 0.5) * 0.5) * H * 0.55;
    float xc = cx + lean * tt * tt;
    float hw = w * (0.30 + 0.12 * h2) * (1.0 - tt * 0.92);
    float d = abs(p.x - xc);
    float a = smoothstep(hw, hw * 0.55, d);
    if (a > cov) { cov = a; shade = tt * 0.8 + 0.2 * h1 - 0.2 * abs((p.x - xc) / max(hw, 0.5)); }
    tipGlint = max(tipGlint, smoothstep(0.10, 0.0, length(vec2(p.x - xc, p.y - (ground - H * 0.97))) / w) * step(0.55, h2));
  }
  return cov;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  vec2 p = uv * res;
  float S = res.y / 1080.0;
  float t = time;
  vec3 base = wall(uv);

  // misty spring morning: the wallpaper washed pale green-grey, light breaking through at the upper right
  vec3 sky = mix(vec3(0.46, 0.60, 0.60), vec3(0.78, 0.88, 0.80), smoothstep(0.0, 0.75, 1.0 - uv.y));
  vec3 col = mix(base * vec3(0.80, 0.95, 0.88), sky, 0.62);
  vec2 sunP = vec2(0.78 * res.x, -0.05 * res.y);
  float ds = length((p - sunP) / res.y);
  col += vec3(1.0, 0.95, 0.70) * (exp(-ds * ds * 1.6) * 0.20 + exp(-ds * ds * 7.0) * 0.12);
  // slow clouds
  float cl = sr_fbm(vec2(uv.x * 3.0 - t * 0.01, uv.y * 4.0) + 3.0);
  col = mix(col, vec3(0.58, 0.68, 0.68), smoothstep(0.45, 0.8, cl) * 0.25 * (1.0 - uv.y));

  // distant soft hills (two layers, hazy)
  float hz1 = res.y * (0.70 + 0.05 * sr_n(vec2(uv.x * 2.6, 1.0)) + 0.03 * sin(uv.x * 5.0 + 1.0));
  float hz2 = res.y * (0.77 + 0.04 * sr_n(vec2(uv.x * 3.5 + 7.0, 2.0)));
  col = mix(col, vec3(0.45, 0.60, 0.52), smoothstep(hz1 - 2.0, hz1 + 2.0, p.y) * 0.55);
  col = mix(col, vec3(0.30, 0.47, 0.34), smoothstep(hz2 - 2.0, hz2 + 2.0, p.y) * 0.75);
  float mistB = exp(-pow((p.y - hz1 - 20.0 * S) / (45.0 * S), 2.0));
  col = mix(col, vec3(0.80, 0.88, 0.82), mistB * 0.35 * (0.6 + 0.4 * sr_fbm(vec2(uv.x * 5.0 - t * 0.02, 5.0))));

  // meadow with growing shoots: three rows, far to near
  float g1 = res.y * (0.86 + 0.012 * sin(uv.x * 6.0 + 2.0));
  float g2 = res.y * (0.93 + 0.010 * sin(uv.x * 4.0));
  float g3 = res.y * 1.01;
  float grow = 0.82 + 0.18 * sin(t * 0.15);                 // the shoots very slowly keep growing
  float gust = 0.0;
  float tg, sh;
  vec3 meadow = vec3(0.22, 0.40, 0.18);
  if (p.y > g1 - 90.0 * S) {
    float c1 = sr_blades(p, g1, 9.0 * S, 55.0 * S * grow, 1.0, t, gust, mpx, tg, sh);
    col = mix(col, mix(vec3(0.20, 0.38, 0.22), vec3(0.58, 0.78, 0.38), clamp(sh, 0.0, 1.0)), c1);
    col = mix(col, vec3(0.16, 0.30, 0.18), smoothstep(g1 - 1.0, g1 + 1.0, p.y) * 0.85);
  }
  if (p.y > g2 - 130.0 * S) {
    float c2 = sr_blades(p, g2, 13.0 * S, 100.0 * S * grow, 5.0, t, gust, mpx, tg, sh);
    col = mix(col, mix(vec3(0.16, 0.34, 0.16), vec3(0.50, 0.76, 0.30), clamp(sh, 0.0, 1.0)), c2);
    col += vec3(0.8, 0.95, 0.9) * tg * 0.55;
    col = mix(col, vec3(0.12, 0.25, 0.12), smoothstep(g2 - 1.0, g2 + 1.0, p.y) * 0.9);
  }
  if (p.y > g3 - 200.0 * S) {
    float c3 = sr_blades(p, g3, 20.0 * S, 190.0 * S * grow, 9.0, t, gust, mpx, tg, sh);
    col = mix(col, mix(vec3(0.10, 0.26, 0.12), vec3(0.62, 0.86, 0.34), clamp(sh, 0.0, 1.0)), c3);
    col += vec3(0.9, 1.0, 0.9) * tg * 0.7;
  }

  // rain: three depth layers; it bends away from the pointer's gust
  vec2 rp = p / S;
  float gx = (rp.x - mpx.x / S) / 220.0;
  float bend = gx * exp(-gx * gx) * exp(-pow((rp.y - mpx.y / S) / 400.0, 2.0)) * 90.0;
  rp.x += bend * 0.0 + bend;
  float r = 0.0;
  r += sr_rain(rp, 38.0, 1.30, 0.22, 1.0, t, 0.10) * 0.30;
  r += sr_rain(rp * 1.0 + 17.0, 24.0, 1.55, 0.18, 4.0, t, 0.10) * 0.22;
  r += sr_rain(rp + 53.0, 60.0, 1.0, 0.30, 7.0, t, 0.10) * 0.30;
  col += vec3(0.80, 0.92, 0.95) * r * 0.55;

  // little splashes on the grass tops are skipped; a cool rain haze near the bottom lifts the meadow slightly
  col = mix(col, col * vec3(0.95, 1.02, 1.0) + vec3(0.02, 0.03, 0.03), 0.4);
  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
