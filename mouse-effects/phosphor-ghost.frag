#version 440
// category: Trail
// desc: Phosphor ghost: the pointer sits in a blinking green terminal cell and the cells it leaves glow for a moment and fade, like the afterglow of an old mainframe tube
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
};

vec2 pg_P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  return h3.zw;
}
// one terminal cell, as a block with a brighter rim
float pg_block(vec2 p, vec2 cellId, vec2 cell) {
  vec2 q = (p - cellId * cell) / cell;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0;
  vec2 e = min(q, 1.0 - q) * cell;
  float rim = 1.0 - smoothstep(0.6, 1.8, min(e.x, e.y));
  return 0.30 + 0.70 * rim;
}
void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec2 cell = vec2(10.0, 20.0);
  vec2 mc = floor(mouse / cell);
  vec3 ph = vec3(0.32, 1.0, 0.45);
  float a = 0.0;
  // phosphor persistence: the cells the pointer has left glow and fade like an old tube
  for (int i = 1; i < 9; i++) {
    vec2 c = floor(pg_P(i) / cell);
    if (c == mc) continue;
    float age = float(i) / 8.0;
    a = max(a, pg_block(p, c, cell) * pow(1.0 - age, 1.6) * 0.9);
  }
  // the cell under the pointer: a blinking block
  float blink = 0.55 + 0.45 * step(0.4, fract(time * 1.1));
  a = max(a, pg_block(p, mc, cell) * 0.75 * blink);
  fragColor = vec4(ph * a, a) * qt_Opacity;
}
