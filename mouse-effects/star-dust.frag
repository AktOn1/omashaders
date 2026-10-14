#version 440
// category: Trail
// desc: Star dust: fine pale stars are dropped along the path while you move, stay where they fell and fade out slowly, nothing is added while you rest
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

// Pointer history: P(0) is the pointer, P(1) the newest sample, P(16) the oldest (about one second back).
// SID(i): stable id of the sample in slot i (it keeps its id as it moves to the next slot), use it to seed hashes.
// AGE(i): 0 at the pointer, 1 when the sample is dropped; it grows continuously, so fade to 0 as AGE -> 1.
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
float SID(int i) { return mod(hs.x - float(i) + 1.0, 4096.0); }
float AGE(int i) { return i == 0 ? 0.0 : (float(i) - 1.0 + hs.y) / 16.0; }

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float fade = pow(1.0 - age, 1.2);
    for (int k = 0; k < 2; k++) {
      float seed = SID(i) * 3.1 + float(k) * 7.7 + 0.5;
      float ang = hash(seed) * 6.28318;
      float rad = 5.0 + 18.0 * hash(seed + 2.0) + 10.0 * age;
      vec2 c = P(i) + vec2(cos(ang), sin(ang)) * rad + vec2(0.0, -14.0 * age);
      vec2 q = p - c;
      float d = length(q);
      if (d > 30.0) continue;
      float tw = 0.8 + 0.2 * sin(time * (0.9 + hash(seed + 4.0)) + seed * 9.0);
      float size = 0.9 + 0.7 * hash(seed + 6.0);
      float core = exp(-d * d / (2.0 * size * size * 0.8));
      float halo = exp(-d / (3.4 * size)) * 0.34;
      float cross = (exp(-abs(q.x) / (3.0 * size)) * exp(-q.y * q.y / 0.4) + exp(-abs(q.y) / (3.0 * size)) * exp(-q.x * q.x / 0.4)) * 0.38;
      float a = (core + halo + cross) * tw * fade * moved * (0.75 + 0.45 * hash(seed + 8.0));
      col += mix(vec3(0.82, 0.92, 1.0), vec3(0.90, 1.0, 0.95), hash(seed + 10.0)) * a;
      alpha += a;
    }
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
