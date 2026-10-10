#version 440
// category: Trail
// desc: Firefly trail: a few tiny soft green-gold lights linger behind the pointer, drift a little and fade out slowly
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

float ft_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 ft_P(int i) {
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
  vec3 col = vec3(0.0);   // premultiplied
  float alpha = 0.0;
  for (int i = 1; i < 9; i++) {
    float behind = smoothstep(5.0, 36.0, distance(ft_P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    float seed = float(i) * 5.3;
    // not every history point carries a light: most do, each at its own spot beside the path
    if (ft_h(seed + 1.0) > 0.85) continue;
    // each light wanders on a slow little loop and rises a touch as it ages
    vec2 pc = ft_P(i) + (vec2(ft_h(seed + 2.0), ft_h(seed + 3.0)) - 0.5) * 26.0
            + vec2(sin(time * (0.9 + ft_h(seed)) + seed) * 6.0, cos(time * (0.8 + ft_h(seed + 4.0)) + seed * 2.0) * 5.0 - age * 14.0);
    float d2 = dot(p - pc, p - pc);
    // a slow, soft pulse; older lights are dimmer
    float pulse = 0.65 + 0.35 * sin(time * (1.3 + ft_h(seed + 6.0) * 0.8) + seed * 3.0);
    float fade = (1.0 - age * 0.85) * behind * pulse;
    float core = exp(-d2 / 9.0);
    float halo = exp(-d2 / 170.0);
    vec3 tint = mix(vec3(0.62, 0.95, 0.35), vec3(1.0, 0.86, 0.42), ft_h(seed + 7.0));
    float a = clamp((core * 1.2 + halo * 0.50) * fade, 0.0, 1.0);
    vec3 c = mix(tint, vec3(1.0, 0.97, 0.75), core * 0.8);
    col += c * a;
    alpha += a;
  }
  // a very faint warm glow at the tip so the pointer feels carried by the lights (the pointer itself stays clear)
  float dm = length(p - mouse);
  float tip = smoothstep(18.0, 6.0, dm) * 0.10;
  col += vec3(0.8, 0.95, 0.45) * tip;
  alpha += tip;
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
