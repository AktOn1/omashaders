#version 440
// category: Trail
// desc: Ash drift: small grey flakes of ash are shaken loose along the path while you move, then sink and turn slowly where they fell, fading to nothing
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

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);   // premultiplied
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));   // only a moving pointer sheds ash
    if (moved <= 0.0) continue;
    float T = AGE(i);
    float fade = pow(1.0 - T, 1.1) * smoothstep(0.0, 0.05, T) * moved;
    for (int k = 0; k < 2; k++) {
      float seed = SID(i) * 7.3 + float(k) * 2.9 + 1.0;
      float away = (hash(seed + 5.0) - 0.5) * 2.0;                              // sideways, away from the pointer's line
      vec2 pos = P(i) + vec2(away * 26.0 * T + sin(time * 0.7 + seed * 3.0) * 4.0 * T,
                             6.0 + 18.0 * T * T + 14.0 * T) + (vec2(hash(seed + 9.0), hash(seed + 10.0)) - 0.5) * 12.0;
      vec2 d = p - pos;
      if (dot(d, d) > 160.0) continue;
      float ang = seed * 2.7 + T * 1.2 * (hash(seed + 8.0) - 0.5) * 3.0 + time * (hash(seed + 1.0) - 0.5) * 0.8;
      float c = cos(ang), s = sin(ang);
      d = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
      float r = 2.6 + 3.2 * hash(seed + 11.0);
      d.x *= 0.55 + 0.9 * hash(seed + 13.0);                                    // flat, uneven flakes
      float shape = smoothstep(r, r * 0.45, length(d));
      float a = shape * fade * (0.8 + 0.2 * hash(seed + 15.0));
      if (a <= 0.003) continue;
      vec3 g = mix(vec3(0.42, 0.41, 0.41), vec3(0.78, 0.75, 0.72), hash(seed + 17.0));    // greys, a little warm
      g = mix(g, vec3(1.0, 0.62, 0.30), 0.22 * (1.0 - T) * (1.0 - T) * (1.0 - T));        // a dying ember at the start
      col = col * (1.0 - a) + g * a;
      alpha = alpha * (1.0 - a) + a;
    }
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), clamp(alpha, 0.0, 1.0)) * qt_Opacity;
}
