#version 440
// category: Trail
// desc: Thick glowing colour trail behind the mouse
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

float onScreen() {
  vec2 q = step(vec2(0.0), mouse) * step(mouse, res);
  return q.x * q.y;
}
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec3 hue(float h) { return 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67))); }
vec2 P(int i) {
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
vec2 segment(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return vec2(length(p - a - ba * h), h);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  float d = length(p - mouse);
  float on = onScreen();
  float best = 0.0, bt = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 s = segment(p, P(i), P(i + 1));
    float t = (float(i) + s.y) / 8.0;
    float w = mix(12.0, 2.0, t);
    float core = smoothstep(w * 0.5, w * 0.15, s.x);
    float glow = 0.35 * smoothstep(w * 2.5, 0.0, s.x);
    float a = (core + glow) * (1.0 - t);
    if (a > best) { best = a; bt = t; }
  }
  vec3 c = hue(bt * 0.6 + time * 0.2);
  float a = clamp(best, 0.0, 1.0);
  fragColor = vec4(c * a, a) * qt_Opacity;
}
