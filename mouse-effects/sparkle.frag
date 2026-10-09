#version 440
// category: Trail
// desc: Twinkling sparks around and behind the mouse
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
  float s = 0.0;
  for (int i = 0; i < 9; i++) {
    for (int k = 0; k < 3; k++) {
      float seed = float(i) * 7.3 + float(k) * 3.1 + floor(time * 6.0 + float(i));
      vec2 off = (vec2(hash(seed), hash(seed + 1.7)) - 0.5) * 56.0;
      vec2 q = p - (P(i) + off);
      float dot_ = pow(max(0.0, 1.0 - length(q) / 9.0), 2.0);
      float cross = max(0.0, 1.0 - abs(q.x) / 14.0) * max(0.0, 1.0 - abs(q.y) / 1.2)
                  + max(0.0, 1.0 - abs(q.y) / 14.0) * max(0.0, 1.0 - abs(q.x) / 1.2);
      float tw = 0.5 + 0.5 * sin(time * 10.0 + float(i) * 4.0 + float(k) * 2.0);
      s += (dot_ + 0.6 * cross) * (1.0 - float(i) / 9.0) * tw;
    }
  }
  float a = clamp(s, 0.0, 1.0);
  fragColor = vec4(vec3(1.0, 0.95, 0.75) * a, a) * qt_Opacity;
}
