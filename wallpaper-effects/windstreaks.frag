// label: Wind gusts
// hint: thin pale lines curve slowly across the sky like wind, in layers
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


// one parallax layer of gusts: long thin lines that follow a gentle wave, each tapering to nothing at both ends
float ws_layer(vec2 uv, float asp, vec2 m, float rows, float seed, float spd, float amp, float thick) {
  // the whole layer breathes along a slow wave, so every line curves the same lazy way
  float wv = amp * sin(uv.x * (2.2 + 0.7 * seed) + time * 0.11 * (1.0 + 0.3 * seed) + seed * 3.0)
           + 0.5 * amp * sin(uv.x * 5.1 - time * 0.07 + seed * 7.0);
  // the pointer parts the air a little
  vec2 dm = (uv - m) * vec2(asp, 1.0);
  float near = exp(-dot(dm, dm) / (2.0 * 0.14 * 0.14));
  float yy = uv.y + wv - 0.045 * near * (uv.y - m.y) / (abs(uv.y - m.y) + 0.06);
  float r = yy * rows;
  float row = floor(r);
  float h0 = hash(vec2(row, seed));
  float h1 = hash(vec2(row + 4.7, seed + 2.9));
  float h2 = hash(vec2(row + 9.1, seed + 6.3));
  float lineY = 0.2 + 0.6 * h1;
  float k = res.y / 1080.0;
  float w = thick * k * (0.7 + 0.7 * h2);
  float dy = abs(fract(r) - lineY) * res.y / rows;
  float body = smoothstep(w + 1.0, w * 0.35, dy) + 0.26 * smoothstep(w * 7.0 + 2.0, 0.0, dy);
  float P = 2.2 + 1.6 * h0;                                    // gust repeat length (screen heights)
  float x = uv.x * asp + time * spd * (0.8 + 0.4 * h2) + h1 * 30.0;
  float c = x / P;
  float cid = floor(c);
  float f = fract(c);
  float hc = hash(vec2(row * 1.91 + cid * 0.53, seed + 31.0));
  float on = step(0.52, hc);
  float len = 0.30 + 0.45 * fract(hc * 5.3);
  float st = fract(hc * 11.7) * (1.0 - len);
  float s = (f - st) / len;
  float env = (s > 0.0 && s < 1.0) ? pow(sin(3.14159 * s), 1.4) : 0.0;
  return body * env * on;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  float zone = smoothstep(0.74, 0.40, uv.y);                   // upper two thirds, fading out below
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  // far layer: many fine slow lines; middle and near layers: fewer, larger and quicker (parallax)
  float a = ws_layer(uv, asp, m, 42.0, 1.0, 0.040, 0.020, 1.0);
  float b = ws_layer(uv, asp, m, 24.0, 2.0, 0.080, 0.032, 1.5);
  float c = ws_layer(uv, asp, m, 13.0, 3.0, 0.150, 0.048, 2.2);
  float g = (0.7 * a + 0.9 * b + 1.0 * c) * zone;
  // pale, tinted a touch by the picture, and a little weaker over very bright areas
  vec3 tint = mix(vec3(0.96, 0.98, 1.0), col / max(max(col.r, max(col.g, col.b)), 0.2), 0.22);
  float amt = g * (0.85 - 0.35 * smoothstep(0.55, 0.95, lum));
  col = 1.0 - (1.0 - col) * (1.0 - tint * clamp(amt, 0.0, 1.0) * 0.50);   // screen
  col *= 1.0 - 0.14 * clamp(g, 0.0, 1.0) * smoothstep(0.62, 0.92, lum);   // on very bright skies the lines show as faint shade instead
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
