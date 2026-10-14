#version 440
// category: Trail
// desc: Bubble trail: small translucent bubbles are left along the pointer path and drift slowly upward, each with a tiny bright highlight, like air rising from a diver in clear shallow water
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
  vec4 h4;
  vec4 h5;
  vec4 h6;
  vec4 h7;
  vec4 hs;
};

// Pointer history: P(0) is the pointer, P(1) the newest sample, P(16) the oldest (about one second back).
// SID(i): stable id of the sample in slot i (it keeps its id as it moves to the next slot), use it to seed hashes.
// AGE(i): 0 at the pointer, 1 when the sample is dropped; it grows continuously, so fade to 0 as AGE -> 1.
vec2 P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  if (i == 8) return h3.zw;
  if (i == 9) return h4.xy;
  if (i == 10) return h4.zw;
  if (i == 11) return h5.xy;
  if (i == 12) return h5.zw;
  if (i == 13) return h6.xy;
  if (i == 14) return h6.zw;
  if (i == 15) return h7.xy;
  return h7.zw;
}
float SID(int i) { return mod(hs.x - float(i) + 1.0, 4096.0); }
float AGE(int i) { return i == 0 ? 0.0 : (float(i) - 1.0 + hs.y) / 16.0; }

float bt_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 water = vec3(0.62, 0.95, 1.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));   // no bubbles while the pointer rests
    if (moved <= 0.0) continue;
    float age = AGE(i);
    for (int k = 0; k < 2; k++) {
      float seed = SID(i) * 5.3 + float(k) * 11.7;
      float sh = bt_h(seed);
      if (k == 1 && sh < 0.75) continue;                                // a smaller second bubble only at some points
      if (k == 0 && sh < 0.35) continue;
      float r = (k == 0 ? 5.5 + 3.5 * bt_h(seed + 2.0) : 3.0 + 1.8 * bt_h(seed + 2.0)) * (0.9 + 0.35 * age);
      // rises and wobbles sideways as it ages; each bubble has its own speed
      float rise = (6.0 + 26.0 * age) * (0.75 + 0.5 * bt_h(seed + 4.0));
      float wob = 4.0 * sin(time * (0.5 + 0.7 * sh) + sh * 40.0) * (0.3 + age);
      vec2 c = P(i) + vec2((bt_h(seed + 7.0) - 0.5) * 16.0 + wob, -rise);
      vec2 d = p - c;
      float dist = length(d);
      if (dist > r + 3.0) continue;
      float fade = pow(1.0 - age, 1.3) * smoothstep(0.0, 0.05, age) * moved;
      float body = smoothstep(r, r - 1.2, dist);                        // faint watery fill
      float rim = smoothstep(2.1, 0.0, abs(dist - r + 0.8));             // thin bright edge
      vec2 n = d / max(dist, 1e-3);
      float lowerlight = 0.45 + 0.55 * smoothstep(-0.3, 0.9, n.x * 0.5 + n.y * 0.85);   // a little extra light on the lower rim
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
