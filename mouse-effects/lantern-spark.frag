#version 440
// category: Trail
// desc: Lantern spark: a tiny warm paper lantern at the pointer; embers are shed along the path, stay where they fell, rise a little and fade out
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

float ls_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 warm = vec3(1.0, 0.62, 0.24);
  vec3 cream = vec3(1.0, 0.88, 0.58);
  vec3 col = vec3(0.0);   // premultiplied
  float alpha = 0.0;

  // the lantern: a soft halo and a small glowing paper body that breathes slowly (the pointer itself stays clear)
  float breathe = 0.92 + 0.08 * sin(time * 1.6) + 0.04 * sin(time * 0.7 + 1.0);
  vec2 q = (p - mouse) / vec2(1.0, 1.18);
  float dm = length(q);
  float halo = exp(-dm / 24.0) * 0.30 * breathe;
  float body = smoothstep(8.5, 4.5, length(vec2(q.x, q.y + 0.5) / vec2(0.82, 1.0))) * 0.70 * breathe;
  col += warm * halo + mix(warm, cream, 0.6) * body;
  alpha += halo + body;

  // embers: shed from samples that moved, stay where they fell, drift up with a lazy sway and fade out
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float seed = SID(i) * 4.7;
    if (ls_h(seed + 1.0) > 0.7) continue;
    vec2 pc = P(i) + vec2((ls_h(seed + 2.0) - 0.5) * 14.0 + sin(age * 6.0 + seed) * (2.0 + 6.0 * age),
                          -3.0 - age * (22.0 + 26.0 * ls_h(seed + 3.0)));
    vec2 dv = p - pc;
    float d2 = dot(dv, dv);
    if (d2 > 900.0) continue;
    float r = 1.6 + 1.0 * ls_h(seed + 4.0);
    float fade = (1.0 - age) * (1.0 - age) * smoothstep(0.0, 0.05, age) * moved;
    float spark = exp(-d2 / (r * r)) * fade;
    float glow = exp(-sqrt(d2) / 5.0) * 0.18 * fade;
    vec3 sc = mix(cream, warm, age);
    col += sc * (spark * 1.1 + glow);
    alpha += spark * 1.1 + glow;
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
