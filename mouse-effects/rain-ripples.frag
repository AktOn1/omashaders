#version 440
// category: Trail
// desc: Rain ripples: neon pink and cyan rings spread out and fade where the pointer has been, like raindrops on a night puddle, with a few tiny splash dots
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
  vec3 pink = vec3(1.0, 0.18, 0.62);
  vec3 cyan = vec3(0.16, 0.88, 1.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float seed = SID(i) * 3.7;
    float fade = pow(1.0 - age, 1.4) * moved;
    vec3 tint = mix(pink, cyan, 0.5 + 0.5 * sin(seed + time * 0.8));
    vec2 d = (p - P(i)) * vec2(1.0, 1.9);               // squashed: rings lie flat on a puddle
    float dist = length(d);
    float radius = 8.0 + age * 36.0;
    if (dist < radius + 5.0) {
      float w = 1.8 + 1.8 * age;
      float ring = exp(-pow((dist - radius) / w, 2.0));
      float ring2 = exp(-pow((dist - radius * 0.62) / (w * 0.8), 2.0)) * 0.6;   // inner second wave
      float a = (ring + ring2) * fade * 1.1;
      col += tint * a;
      alpha += a;
    }
    // splash dot: jumps up from the drop and falls back during the first part of its life
    float ph = clamp(age * 4.0, 0.0, 1.0);
    vec2 sp = P(i) + vec2((hash(seed + 1.0) - 0.5) * 18.0, -14.0 * sin(ph * 3.14159) - 2.0);
    float ds = length(p - sp);
    if (ds < 4.0) {
      float dot_ = smoothstep(3.2, 0.0, ds) * fade * (1.0 - ph) * 1.1;
      col += mix(cyan, vec3(1.0), 0.5) * dot_;
      alpha += dot_;
    }
  }
  // soft neon spot at the pointer itself
  float dm = length(p - mouse);
  float core = smoothstep(14.0, 0.0, dm) * 0.35;
  col += mix(pink, cyan, 0.5) * core;
  alpha += core;
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
