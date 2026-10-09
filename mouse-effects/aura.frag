#version 440
// category: Glow
// desc: Colour-cycling ring that pulses around the mouse
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
  vec2 q = p - mouse;
  float r = 38.0 + 6.0 * sin(time * 3.0);
  float ring = smoothstep(3.0, 0.0, abs(d - r));
  float glow = 0.15 * exp(-abs(d - r) / 14.0);
  vec3 c = hue(time * 0.15 + atan(q.y, q.x) / 6.28318);
  float a = clamp(ring * 0.8 + glow, 0.0, 1.0);
  fragColor = vec4(c * a, a) * qt_Opacity;
}
