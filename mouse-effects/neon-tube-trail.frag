#version 440
// category: Trail
// desc: Neon tube trail: the pointer draws a thin glowing sign tube that stays behind it for about a second, hot magenta at the head and cyan at the tail, flickering faintly like a shopfront in the rain
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

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 magenta = vec3(1.0, 0.18, 0.64);
  vec3 cyan = vec3(0.15, 0.88, 1.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < 16; i++) {
    vec2 a = P(i), b = P(i + 1);
    vec2 ab = b - a;
    float l2 = dot(ab, ab);
    if (l2 < 0.25) continue;
    float h = clamp(dot(p - a, ab) / l2, 0.0, 1.0);
    float d = length(p - (a + ab * h));
    if (d > 40.0) continue;
    float age = mix(AGE(i), AGE(i + 1), h);
    float fade = 1.0 - age;
    // a tube: bright thin core, wide soft glow, slight flicker like a failing sign (phase follows the sample)
    float flick = 0.88 + 0.12 * sin(time * 17.0 + (SID(i) - h) * 2.3);
    float core = smoothstep(2.2, 0.4, d);
    float glow = exp(-d / 8.0) * 0.6;
    float k = (core * 0.9 + glow) * fade * flick;
    vec3 tc = mix(magenta, cyan, smoothstep(0.0, 0.8, age));
    col += mix(tc, vec3(1.0), core * 0.5) * k;
    alpha += k;
  }
  float a = clamp(alpha * 0.8, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
