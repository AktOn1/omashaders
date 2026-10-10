#version 440
// category: Trail
// desc: Bubble trail: a few small translucent bubbles drift up and away from the pointer's path, each with a tiny bright highlight, like air rising from a diver in clear shallow water
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

float bt_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
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
  vec3 water = vec3(0.62, 0.95, 1.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i < 9; i++) {
    float behind = smoothstep(3.0, 36.0, distance(P(i), mouse));       // no bubbles while the pointer rests
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    for (int k = 0; k < 2; k++) {
      float seed = float(i) * 5.3 + float(k) * 11.7;
      float hs = bt_h(seed);
      if (k == 1 && hs < 0.5) continue;                                 // a smaller second bubble only at some points
      if (k == 0 && hs < 0.12) continue;
      float r = (k == 0 ? 5.5 + 3.5 * bt_h(seed + 2.0) : 3.0 + 1.8 * bt_h(seed + 2.0)) * (0.9 + 0.35 * age);
      // rises and wobbles sideways as it ages; each bubble has its own speed
      float rise = (14.0 + 110.0 * age) * (0.75 + 0.5 * bt_h(seed + 4.0));
      float wob = 6.0 * sin(time * (1.1 + hs) + hs * 40.0) * (0.3 + age);
      vec2 c = P(i) + vec2((bt_h(seed + 7.0) - 0.5) * 16.0 + wob, -rise);
      vec2 d = p - c;
      float dist = length(d);
      if (dist > r + 3.0) continue;
      float fade = (1.0 - age) * (1.0 - age * 0.4) * behind;
      float body = smoothstep(r, r - 1.2, dist);                        // faint watery fill
      float rim = smoothstep(1.7, 0.0, abs(dist - r + 0.7));             // thin bright edge
      vec2 n = d / max(dist, 1e-3);
      float lowerlight = 0.45 + 0.55 * smoothstep(-0.3, 0.9, n.x * 0.5 + n.y * 0.85);   // a little extra light on the lower rim: light through the bubble
      vec2 hp = c + vec2(-0.38, -0.40) * r;
      float hl = smoothstep(max(r * 0.32, 1.0), 0.0, length(p - hp));      // tiny highlight, upper left
      float hl2 = smoothstep(max(r * 0.12, 0.6), 0.0, length(p - (c + vec2(0.35, 0.42) * r))) * 0.5;
      float a = (body * 0.13 + rim * 0.80 * lowerlight) * fade;
      vec3 tint = mix(water, vec3(1.0), 0.25);
      col += tint * a + vec3(1.0) * (hl + hl2) * 0.85 * fade * body;
      alpha += a + (hl + hl2) * 0.85 * fade * body;
    }
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
