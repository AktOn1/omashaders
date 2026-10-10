#version 440
// category: Trail
// desc: Bioluminescent wake: soft blue-green plankton glow left behind a moving pointer, drifting and fading like disturbed deep water
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
    float behind = smoothstep(4.0, 50.0, distance(P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    for (int k = 0; k < 4; k++) {
      float seed = float(k) * 4.1 + 2.3;
      float ang = hash(seed) * 6.28318 + time * (0.3 + 0.5 * hash(seed + 1.0));
      float rad = (4.0 + 20.0 * hash(seed + 3.0)) * (0.4 + age * 1.5);
      vec2 c = P(i) + vec2(cos(ang), sin(ang)) * rad + vec2(0.0, -10.0 * age);
      float pulse = 0.55 + 0.45 * sin(time * (3.0 + 3.0 * hash(seed + 5.0)) + hash(seed + 7.0) * 6.28318);
      float r = (5.0 + 7.0 * hash(seed + 9.0)) * (1.0 - 0.4 * age);
      float d = length(p - c);
      float glow = pow(max(0.0, 1.0 - d / (r * 2.2)), 2.0) * 0.55 + exp(-d * d / (r * r * 0.12)) * 0.8;
      float a = glow * pulse * behind * (1.0 - age * 0.9);
      vec3 tint = mix(vec3(0.10, 0.55, 1.0), vec3(0.15, 1.0, 0.8), hash(seed + 11.0));
      col += mix(tint, vec3(0.8, 1.0, 1.0), exp(-d * d / (r * r * 0.12)) * 0.6) * a;
      alpha += a;
    }
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
