// label: Speed lines
// hint: thin streaks of light rush left, thicker at the edges, clear in the middle
// category: Speed and motion
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


// one layer of speed streaks: rows of thin lines, each row carries a streak that rushes left
// edge = 0 in the middle, 1 at the sides/corners: more and longer streaks outward
float sp_layer(vec2 uv, float asp, float rows, float seed, float edge, float spdMul, float thick, out float shade) {
  float r = uv.y * rows;
  float row = floor(r);
  float h0 = hash(vec2(row, seed));
  float h1 = hash(vec2(row + 7.3, seed + 1.7));
  float h2 = hash(vec2(row + 3.1, seed + 5.9));
  float h3 = hash(vec2(row + 11.7, seed + 9.3));
  // the line's vertical position inside its row and its (hair) thickness
  float lineY = 0.25 + 0.5 * h1;
  float k = res.y / 1080.0;
  float w = thick * k * (0.6 + 0.9 * h2);                    // half thickness in pixels
  float dy = abs(fract(r) - lineY) * res.y / rows;
  float body = smoothstep(w + 1.0, w * 0.4, dy) + 0.22 * smoothstep(w * 5.0 + 2.0, 0.0, dy);
  // along the row: periodic streaks, each row with its own speed, period and phase
  float P = 1.8 + 1.8 * h0;
  float spd = (0.55 + 0.9 * h3) * spdMul;
  float x = uv.x * asp + time * spd + h2 * 20.0;
  float c = x / P;
  float cid = floor(c);
  float f = fract(c);
  float hc = hash(vec2(row * 1.37 + cid * 0.71, seed + 21.0));
  float on = step(1.0 - (0.10 + 0.85 * edge) * 0.9, hc) * smoothstep(0.03, 0.25, edge);   // fewer streaks in the clear middle
  float len = (0.14 + 0.34 * hc) * (0.4 + 0.9 * edge);           // in cell fractions: longer toward the edges
  float st = fract(hc * 7.1) * (1.0 - len);
  float s = (f - st) / max(len, 0.001);                            // 0 = head (left end), 1 = tail
  float env = (s > 0.0 && s < 1.0) ? smoothstep(0.0, 0.08, s) * pow(1.0 - s, 1.6) : 0.0;
  shade = step(0.8, h1 * 0.5 + h0 * 0.5 + 0.30);                   // a few rows are faint shadows, the rest light
  return body * env * on;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  // distance from the clear middle: elliptic, so the sides get the streaks, the top/bottom edges fewer
  vec2 q = abs(uv - 0.5) * 2.0;
  float edge = smoothstep(0.22, 0.95, q.x * 0.9 + q.y * 0.28);
  // the pointer keeps a clear patch round itself
  vec2 dm = (uv - m) * vec2(asp, 1.0);
  float clear = 1.0 - 0.9 * exp(-dot(dm, dm) / (2.0 * 0.16 * 0.16));
  float sh1, sh2, sh3;
  float a = sp_layer(uv, asp, 38.0, 1.0, edge, 1.0, 1.8, sh1);
  float b = sp_layer(uv, asp, 84.0, 4.0, edge, 1.35, 1.1, sh2);
  float c = sp_layer(uv, asp, 130.0, 9.0, edge, 0.8, 0.8, sh3);
  float lightAmt = (a * (1.0 - sh1) + 0.8 * b * (1.0 - sh2) + 0.6 * c * (1.0 - sh3)) * clear;
  float shadeAmt = (a * sh1 + 0.8 * b * sh2 + 0.6 * c * sh3) * clear;
  // light takes its colour from the picture a little way to the right (where the streak came from), brightened
  vec3 side = wall(vec2(clamp(uv.x + 0.07, 0.0, 1.0), uv.y));
  float sm = max(max(side.r, side.g), max(side.b, 0.12));
  vec3 tint = mix(vec3(1.0, 0.98, 0.94), side / sm, 0.30);
  col = 1.0 - (1.0 - col) * (1.0 - tint * clamp(lightAmt, 0.0, 1.0) * 0.80);   // screen: never blows out
  col *= 1.0 - 0.20 * clamp(shadeAmt, 0.0, 1.0);
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
