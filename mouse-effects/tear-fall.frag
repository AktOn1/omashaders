#version 440
// category: Trail
// desc: Tear fall: slow pale-blue drops let go of the places the pointer has been and sink down the screen, each with a short soft tail, a faint cold glow at the pointer
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

float tf_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 tf_P(int i) {
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

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 pale = vec3(0.62, 0.76, 1.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i < 9; i++) {
    float behind = smoothstep(4.0, 40.0, distance(tf_P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    float h = tf_hash(float(i) * 3.3);
    // the drop sinks, slowing as it ages; its start is the trail point, nudged by a hash
    vec2 o = tf_P(i) + vec2((h - 0.5) * 10.0, age * (26.0 + 30.0 * h) + 6.0 * sin(time * 0.8 + h * 20.0));
    vec2 d = p - o;
    float r = 3.6 + 2.4 * (1.0 - age);
    float body = smoothstep(r, r * 0.35, length(d * vec2(1.0, 0.8)));
    float up = smoothstep(r * 0.9, 0.0, abs(d.x) * (1.0 + (-d.y) * 0.06)) * step(d.y, 0.0) * smoothstep(-34.0, 0.0, d.y) * 0.6;
    float a = (body + up) * pow(1.0 - age, 0.9) * 0.95 * behind;
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
