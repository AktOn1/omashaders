#version 440
// category: Trail
// desc: Tear fall: pale-blue drops let go of every place the pointer has been and slowly sink down the screen, each with a short soft tail, so the path hangs behind the pointer and dissolves; a faint cold glow marks the pointer
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

float tf_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 pale = vec3(0.62, 0.76, 1.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float h = tf_hash(SID(i) * 3.3);
    // the drop sinks, slowing as it ages; it starts at the sample, nudged by a hash
    float sink = (1.0 - (1.0 - age) * (1.0 - age)) * (30.0 + 34.0 * h);
    vec2 o = P(i) + vec2((h - 0.5) * 10.0, sink + 2.0 * sin(time * 0.8 + h * 20.0));
    vec2 d = p - o;
    if (d.y > 12.0 || d.y < -42.0 || abs(d.x) > 12.0) continue;
    float r = 3.4 + 2.4 * (1.0 - age);
    float body = smoothstep(r, r * 0.35, length(d * vec2(1.0, 0.8)));
    float up = smoothstep(r * 0.9, 0.0, abs(d.x) * (1.0 + (-d.y) * 0.06)) * step(d.y, 0.0) * smoothstep(-34.0, 0.0, d.y) * 0.6;
    float a = (body + up) * pow(1.0 - age, 1.1) * 0.95 * moved;
    col += pale * a;
    alpha += a;
  }
  float dm = length(p - mouse);
  float core = smoothstep(18.0, 0.0, dm) * 0.14;
  col += pale * core;
  alpha += core;
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
