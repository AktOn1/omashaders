#version 440
// category: Trail
// desc: Star dust: a very few fine pale stars hang in the air behind the pointer and fade out slowly, nothing shows while you rest
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

float sd_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 sd_P(int i) {
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
    float behind = smoothstep(6.0, 70.0, distance(sd_P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    for (int k = 0; k < 2; k++) {
      float seed = float(i) * 3.1 + float(k) * 7.7 + 0.5;
      float ang = sd_hash(seed) * 6.28318;
      float rad = 5.0 + 20.0 * sd_hash(seed + 2.0) + 12.0 * age;
      vec2 c = sd_P(i) + vec2(cos(ang), sin(ang)) * rad + vec2(sin(time * 0.4 + seed) * 2.0, -9.0 * age);   // drifts up a little as it fades
      vec2 q = p - c;
      float d = length(q);
      float tw = 0.8 + 0.2 * sin(time * (0.9 + sd_hash(seed + 4.0)) + seed * 9.0);     // slow and shallow, never flashes
      float size = 0.8 + 0.6 * sd_hash(seed + 6.0);
      float core = exp(-d * d / (2.0 * size * size * 0.8));
      float halo = exp(-d / (3.4 * size)) * 0.34;
      float cross = (exp(-abs(q.x) / (3.0 * size)) * exp(-q.y * q.y / 0.4) + exp(-abs(q.y) / (3.0 * size)) * exp(-q.x * q.x / 0.4)) * 0.38;
      float fade = pow(1.0 - age, 1.1);
      float a = (core + halo + cross) * tw * fade * behind * (0.75 + 0.45 * sd_hash(seed + 8.0));
      col += mix(vec3(0.82, 0.92, 1.0), vec3(0.90, 1.0, 0.95), sd_hash(seed + 10.0)) * a;
      alpha += a;
    }
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
