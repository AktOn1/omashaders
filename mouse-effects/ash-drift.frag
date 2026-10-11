#version 440
// category: Trail
// desc: Ash drift: small grey flakes of ash shake loose from the pointer and sink away from it, turning slowly and fading to nothing
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

float ad_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 ad_P(int i) {
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
  for (int i = 0; i < 9; i++) {
    vec2 P = ad_P(i);
    float age = float(i) / 8.0;
    float live = i == 0 ? 1.0 : smoothstep(2.0, 22.0, distance(P, mouse));    // only a moving pointer sheds ash
    // a resting pointer keeps a faint slow shedding of its own
    float rest = i == 0 ? 0.55 : 0.0;
    if (live + rest <= 0.0) continue;
    for (int k = 0; k < 3; k++) {
      float seed = float(i) * 7.3 + float(k) * 2.9 + 1.0;
      // each flake falls on the pointer's own clock: it is born at the point, then drifts off and down
      float life = fract(time * (0.30 + 0.12 * ad_h(seed)) + ad_h(seed + 3.0));
      float T = (i == 0) ? life : age * 0.6 + life * 0.3;
      float away = (ad_h(seed + 5.0) - 0.5) * 2.0;                              // sideways, away from the pointer's line
      vec2 dir = vec2(away, 0.0);
      vec2 pos = P + vec2(away * 34.0 * T + sin(time * 1.3 + seed * 3.0) * 4.0 * T,
                          6.0 + 46.0 * T * T + 26.0 * T) + (ad_h(seed + 9.0) - 0.5) * 8.0;
      vec2 d = p - pos;
      if (dot(d, d) > 160.0) continue;
      float ang = seed * 2.7 + time * (0.6 + ad_h(seed + 1.0)) * (ad_h(seed + 8.0) - 0.5) * 3.0;
      float c = cos(ang), s = sin(ang);
      d = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
      float r = 2.6 + 3.2 * ad_h(seed + 11.0);
      d.x *= 0.55 + 0.9 * ad_h(seed + 13.0);                                    // flat, uneven flakes
      float shape = smoothstep(r, r * 0.45, length(d));
      float fade = (1.0 - T) * smoothstep(0.0, 0.06, T);
      float a = shape * fade * 1.0 * (i == 0 ? rest * 1.5 : live) * (0.55 + 0.45 * ad_h(seed + 15.0));
      if (a <= 0.003) continue;
      vec3 g = mix(vec3(0.42, 0.41, 0.41), vec3(0.78, 0.75, 0.72), ad_h(seed + 17.0));    // greys, a little warm
      g = mix(g, vec3(1.0, 0.62, 0.30), 0.22 * (1.0 - T) * (1.0 - T));                    // a dying ember at the very start
      col = col * (1.0 - a) + g * a;
      alpha = alpha * (1.0 - a) + a;
    }
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), clamp(alpha, 0.0, 1.0)) * qt_Opacity;
}
