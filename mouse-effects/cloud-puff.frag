#version 440
// category: Trail
// desc: Cloud puff: small soft white puffs bloom behind the pointer and slowly dissolve, each a little cluster of round cloud lobes with a blue-lilac underside
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

float cp_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 cp_P(int i) {
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
    float behind = smoothstep(4.0, 34.0, distance(cp_P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    float seed = float(i) * 4.1;
    // the puff blooms (grows fast at first, then slowly) while it fades
    float grow = 1.0 - pow(1.0 - age, 2.0);
    float R = 7.0 + 17.0 * grow;
    vec2 c0 = cp_P(i) + vec2(sin(time * 0.7 + seed) * 2.5, -age * 14.0 + cos(time * 0.6 + seed * 2.0) * 1.5);   // rises a little as it dissolves
    vec2 r0 = p - c0;
    if (dot(r0, r0) > R * R * 4.0) continue;
    // a cluster of lobes: coverage is the smooth union of a few circles
    float field = 0.0;
    float top = 0.0;
    for (int k = 0; k < 8; k++) {
      float kf = float(k);
      vec2 off = vec2(cp_h(seed + kf * 1.7) - 0.5, (cp_h(seed + kf * 2.3) - 0.35) * 0.7) * R * 2.0;
      float rr = R * (0.28 + 0.26 * cp_h(seed + kf * 3.1));
      vec2 dd = r0 - off;
      float v = rr / (length(dd) + 0.001);
      field += v * v * 0.42;
      top += v * v * 0.42 * smoothstep(rr * 1.0, -rr * 1.0, dd.y);     // weight of lobes lying above this pixel: lit from the top
    }
    float cover = smoothstep(0.45, 1.10, field);
    if (cover <= 0.003) continue;
    float lit = clamp(top / max(field, 0.001), 0.0, 1.0);
    vec3 c = mix(vec3(0.74, 0.80, 0.94), vec3(0.99, 0.975, 0.96), 0.10 + 0.90 * lit * lit);          // blue-lilac underside -> creamy white top
    c = mix(c, vec3(1.0, 0.90, 0.78), 0.18 * smoothstep(0.9, 0.2, cover) * lit);                 // a touch of sun on the edge
    float fade = (1.0 - age) * (1.0 - age * 0.35) * behind;
    float a = cover * fade * 0.78;                                // soft and never opaque
    col = col * (1.0 - a) + c * a;
    alpha = alpha * (1.0 - a) + a;
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), clamp(alpha, 0.0, 1.0)) * qt_Opacity;
}
