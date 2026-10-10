#version 440
// category: Trail
// desc: Soft twinkling stars dragged behind a moving pointer; they drift, shrink and fade, nothing shows while you rest
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

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i < 9; i++) {
    float behind = smoothstep(5.0, 60.0, distance(P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    for (int k = 0; k < 5; k++) {
      float seed = float(k) * 5.3 + 1.7;
      float ang = hash(seed) * 6.28318 + time * (0.4 + hash(seed + 2.0));
      float rad = (6.0 + 22.0 * hash(seed + 4.0)) * (0.5 + age * 1.4);
      vec2 c = P(i) + vec2(cos(ang), sin(ang)) * rad + vec2(0.0, -14.0 * age);
      vec2 q = p - c;
      float tw = pow(0.5 + 0.5 * sin(time * (7.0 + 5.0 * hash(seed + 6.0)) + hash(seed + 8.0) * 6.28318 + age * 3.0), 2.0);
      float L = (9.0 + 12.0 * hash(seed + 10.0)) * (1.0 - 0.55 * age) * (0.3 + 0.7 * tw);
      float arm = max(0.0, 1.0 - abs(q.x) / L) * max(0.0, 1.0 - abs(q.y) / 1.3) + max(0.0, 1.0 - abs(q.y) / L) * max(0.0, 1.0 - abs(q.x) / 1.3);
      float glow = pow(max(0.0, 1.0 - length(q) / (L * 0.6)), 2.0);
      float a = (arm * 1.0 + glow * 1.0) * behind * (1.0 - age * 0.85);
      vec3 tint = mix(vec3(1.0, 0.95, 0.75), hue(hash(seed + 12.0) * 0.35 + age * 0.55 + time * 0.05), 0.45);
      col += tint * a;
      alpha += a;
    }
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
