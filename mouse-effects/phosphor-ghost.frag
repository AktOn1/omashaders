#version 440
// category: Trail
// desc: Phosphor ghost: the pointer sits in a blinking green terminal cell and every cell it passes through keeps glowing and fades over about a second, like the afterglow of an old mainframe tube
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

// one terminal cell, as a block with a brighter rim
float pg_block(vec2 p, vec2 cellId, vec2 cell) {
  vec2 q = (p - cellId * cell) / cell;
  vec2 e = min(q, 1.0 - q) * cell;
  float rim = 1.0 - smoothstep(0.6, 1.8, min(e.x, e.y));
  return 0.30 + 0.70 * rim;
}
void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec2 cell = vec2(10.0, 20.0);
  vec2 mc = floor(mouse / cell);
  vec2 pc = floor(p / cell);
  vec3 ph = vec3(0.32, 1.0, 0.45);
  float a = 0.0;
  // phosphor persistence: a cell lights up when the path crosses it and then fades with the age of that part of the path
  if (pc != mc) {
    vec2 cc = pc + 0.5;
    float best = 1.0;
    for (int i = 0; i < 16; i++) {
      vec2 A = P(i) / cell, B = P(i + 1) / cell;
      vec2 ba = B - A;
      float h = clamp(dot(cc - A, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      vec2 dv = abs(cc - A - ba * h);
      if (max(dv.x, dv.y) > 0.5) continue;
      best = min(best, mix(AGE(i), AGE(i + 1), h));
    }
    a = pg_block(p, pc, cell) * pow(1.0 - best, 1.6) * 0.9;
  }
  // the cell under the pointer: a blinking block
  float blink = 0.55 + 0.45 * step(0.4, fract(time * 1.1));
  if (pc == mc) a = pg_block(p, mc, cell) * 0.75 * blink;
  fragColor = vec4(ph * a, a) * qt_Opacity;
}
