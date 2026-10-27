#version 440
// category: Glow
// desc: Night lamp: a small lantern light with a soft flickering pool of amber at the pointer, followed by a loose string of five tiny lights that lag behind it, shift from amber to cold teal and settle into a slow orbit when the pointer rests. Calm and low-contrast
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
float nl_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float nl_noise(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(nl_hash(i), nl_hash(i + 1.0), f);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 acc = vec3(0.0);
  float shade = 0.0;

  // the lamp: a slow candle flicker on a soft pool, a pale hot core
  float fk = 0.82 + 0.12 * sin(time * 1.7) + 0.10 * (nl_noise(time * 3.1) - 0.5);
  vec2 dl = p - mouse;
  float d2 = dot(dl, dl);
  shade += exp(-d2 / 260.0) * 0.30;
  acc += vec3(1.00, 0.60, 0.22) * exp(-sqrt(d2) / 20.0) * 0.30 * fk;
  acc += vec3(1.00, 0.72, 0.34) * exp(-d2 / 120.0) * 0.30 * fk;
  acc += vec3(1.00, 0.95, 0.80) * exp(-d2 / 9.0) * 0.85;

  // five followers: each sits on an older pointer sample, plus a small orbit so they never pile up
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    int slot = 3 + i * 3;
    float age = (float(slot) - 1.0 + hs.y) / 16.0;
    vec2 q = P(slot);
    float ang = time * (0.7 + 0.25 * nl_hash(fi + 1.0)) + fi * 1.9;
    float rad = 7.0 + 4.0 * fi;
    q += vec2(cos(ang), sin(ang * 1.3)) * rad * (0.55 + 0.45 * sin(time * 0.6 + fi));
    float r = 4.6 - 0.55 * fi;
    float pul = 0.65 + 0.35 * sin(time * (2.0 + fi * 0.7) + fi * 2.7);
    vec3 c = mix(vec3(1.0, 0.70, 0.32), vec3(0.45, 0.82, 0.78), fi / 4.0);
    float d = length(p - q);
    float fade = (1.0 - 0.55 * age);
    shade += exp(-d * d / (r * r * 4.0)) * 0.10 * fade;
    acc += c * (exp(-d * d / (r * r * 1.1)) * 1.05 + exp(-d / (r * 4.0)) * 0.22) * (0.8 + 0.2 * pul) * fade;
  }

  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  float sa = clamp(shade, 0.0, 0.5);
  vec3 ink = vec3(0.03, 0.04, 0.09);
  vec3 rgb = min(acc, vec3(la)) + ink * sa * (1.0 - la);
  float a = la + sa * (1.0 - la);
  fragColor = vec4(rgb, a) * qt_Opacity;
}
