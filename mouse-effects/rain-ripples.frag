#version 440
// category: Trail
// desc: Rain ripples: neon pink and cyan rings spread out from where the pointer has been, like raindrops on a night puddle, with a few tiny splash dots
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
  vec3 pink = vec3(1.0, 0.18, 0.62);
  vec3 cyan = vec3(0.16, 0.88, 1.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i < 9; i++) {
    float behind = smoothstep(4.0, 40.0, distance(P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    vec2 d = (p - P(i)) * vec2(1.0, 1.9);               // squashed: rings lie flat on a puddle
    float dist = length(d);
    float seed = float(i) * 3.7;
    float radius = 8.0 + age * 46.0;
    float ring = smoothstep(2.4, 0.0, abs(dist - radius));
    float ring2 = smoothstep(1.8, 0.0, abs(dist - radius * 0.62)) * 0.6;   // inner second wave
    vec3 tint = mix(pink, cyan, 0.5 + 0.5 * sin(seed + time * 0.8));
    float a = (ring + ring2) * (1.0 - age) * (1.0 - age) * 0.9 * behind;
    col += tint * a;
    alpha += a;
    // splash dot flying up from the drop
    float ph = fract(time * 2.5 + hash(seed));
    vec2 sp = P(i) + vec2((hash(seed + 1.0) - 0.5) * 18.0, -10.0 * sin(ph * 3.14159) - 2.0);
    float dot_ = smoothstep(2.2, 0.0, length(p - sp)) * (1.0 - age) * behind * 0.7;
    col += mix(cyan, vec3(1.0), 0.5) * dot_;
    alpha += dot_;
  }
  // soft neon spot at the pointer itself
  float dm = length(p - mouse);
  float core = smoothstep(14.0, 0.0, dm) * 0.35;
  col += mix(pink, cyan, 0.5) * core;
  alpha += core;
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
