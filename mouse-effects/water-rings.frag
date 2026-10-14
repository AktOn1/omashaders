#version 440
// category: Trail
// desc: Water rings: calm, soft pale rings widen and fade where the pointer has been, like a fingertip drawn across still water (no neon)
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
  vec3 pale = vec3(0.80, 0.97, 0.90);       // sky-light on water
  vec3 deep = vec3(0.45, 0.80, 0.72);       // jade where the ring is shadowed
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    vec2 d = (p - P(i)) * vec2(1.0, 1.55);              // rings lie a little flat on the surface
    float dist = length(d);
    float radius = 10.0 + age * 40.0;
    float w = 2.4 + age * 3.0;                          // older rings are wider and softer
    if (dist > radius + 3.0 * w) continue;
    float ring = exp(-pow((dist - radius) / w, 2.0));
    float ring2 = exp(-pow((dist - radius * 0.66) / (w * 0.9), 2.0)) * 0.5;
    // a dark flank just inside each crest, so the ring reads as a wave and not a drawn circle
    float flank = exp(-pow((dist - radius + w * 1.6) / (w * 1.1), 2.0)) * 0.35;
    float fade = pow(1.0 - age, 1.5) * moved;
    float a = (ring + ring2) * fade * 0.5;
    col += mix(deep, pale, ring) * a;
    alpha += a;
    alpha += flank * fade * 0.16;
  }
  // a very faint dimple where the pointer touches the water
  float dm = length((p - mouse) * vec2(1.0, 1.55));
  float core = exp(-pow((dm - 9.0) / 3.0, 2.0)) * 0.22 + smoothstep(14.0, 0.0, dm) * 0.06;
  col += pale * core;
  alpha += core;
  float a = clamp(alpha, 0.0, 0.85);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
