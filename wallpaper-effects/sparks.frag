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
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp(uv, 0.0, 1.0))).rgb; }
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


float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  vec3 col = wall(uv) * 0.72;
  float bottom = smoothstep(0.55, 1.05, uv.y);
  col += vec3(1.0, 0.38, 0.10) * 0.10 * bottom * (0.8 + 0.2 * sin(time * 3.1) * sin(time * 1.7));
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    float fi = float(i);
    float life = 2.0 + 1.8 * hash(vec2(fi, 3.1));
    float u = time / life + hash(vec2(fi, 9.7));
    float ph = fract(u);
    float seed = floor(u) * 1.731 + fi * 5.17;
    float x0 = asp * (0.5 + 0.34 * (hash(vec2(seed, 1.3)) * 2.0 - 1.0) * (0.4 + 0.6 * hash(vec2(seed, 2.9))));
    float vx = (hash(vec2(seed, 4.1)) - 0.5) * 0.34 + 0.05 * sin(time * 0.4 + fi);
    float vy = 0.30 + 0.55 * hash(vec2(seed, 5.7));
    float g = 0.42;
    float age = ph * life;
    float age2 = max(age - 0.10, 0.0);
    vec2 a = vec2(x0 + vx * age + 0.03 * sin(age * 6.0 + fi), 1.04 - vy * age + 0.5 * g * age * age);
    vec2 b = vec2(x0 + vx * age2 + 0.03 * sin(age2 * 6.0 + fi), 1.04 - vy * age2 + 0.5 * g * age2 * age2);
    vec2 pushA = (a - mp), pushB = (b - mp);
    a += normalize(pushA + 1e-4) * smoothstep(0.25, 0.0, length(pushA)) * 0.12;
    b += normalize(pushB + 1e-4) * smoothstep(0.25, 0.0, length(pushB)) * 0.12;
    float d = seg(p, a, b);
    float fade = pow(1.0 - ph, 1.4) * smoothstep(0.0, 0.04, ph);
    float flick = 0.7 + 0.3 * sin(time * (14.0 + 10.0 * hash(vec2(fi, 6.6))) + fi * 11.0);
    float w = 0.0021 + 0.0008 * hash(vec2(seed, 7.3));
    float s = exp(-d * d / (w * w)) + 0.30 * exp(-d * d / (w * w * 16.0));
    vec3 hot = mix(vec3(1.0, 0.95, 0.72), vec3(1.0, 0.42, 0.08), smoothstep(0.0, 0.45, ph));
    hot = mix(hot, vec3(0.85, 0.12, 0.03), smoothstep(0.45, 1.0, ph));
    glow += hot * s * fade * flick;
  }
  col += glow * 1.5;
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
