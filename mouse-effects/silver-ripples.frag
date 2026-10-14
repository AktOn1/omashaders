#version 440
// category: Trail
// desc: Silver ripples: thin pale silver rings spread out slowly and fade where the pointer has been, like moonlight on still water, with a faint glimmer along each ring
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

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 silver = vec3(0.82, 0.89, 0.98);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    vec2 d = (p - P(i)) * vec2(1.0, 1.7);           // squashed: the rings lie flat on the water
    float dist = length(d);
    float radius = 9.0 + age * 38.0;
    if (dist > radius + 5.0) continue;
    float seed = SID(i) * 3.7;
    float w = 1.7 + 1.6 * age;
    float ring = exp(-pow((dist - radius) / w, 2.0));
    float ring2 = exp(-pow((dist - radius * 0.64) / (w * 0.8), 2.0)) * 0.5;   // fainter inner wave
    // glimmer: the ring is brighter in a few slowly turning spots, as if the moon catches the crests
    float ang = atan(d.y, d.x);
    float gl = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(ang * 3.0 + seed + time * 0.4), 4.0);
    float a = (ring * gl + ring2 * 0.7) * pow(1.0 - age, 1.5) * 0.95 * moved;
    col += mix(silver, vec3(1.0), 0.3 * gl) * a;
    alpha += a;
  }
  // a very soft pale spot at the pointer itself
  float dm = length(p - mouse);
  float core = smoothstep(12.0, 0.0, dm) * 0.12;
  col += silver * core;
  alpha += core;
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
