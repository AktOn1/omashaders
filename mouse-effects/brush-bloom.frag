#version 440
// category: Trail
// desc: Brush bloom: soft watercolour blots in rose, ochre and teal are left behind the pointer, each with a darker pooled rim, and stay where they fell, slowly spreading and fading over about a second
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

float bb_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec3 bb_pig(int k) {
  int m = k - (k / 3) * 3;
  if (m == 0) return vec3(0.93, 0.42, 0.56);
  if (m == 1) return vec3(0.96, 0.70, 0.25);
  return vec3(0.22, 0.68, 0.72);
}
void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    // every second sample drops a blot, and only where the pointer moved
    float sid = SID(i);
    if (mod(sid, 2.0) > 0.5) continue;
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    vec2 d = p - P(i);
    float dist = length(d);
    if (dist > 50.0) continue;
    float age = AGE(i);
    float ang = atan(d.y, d.x);
    float wob = 1.0 + 0.16 * sin(ang * 3.0 + sid * 2.1 + time * 0.3) + 0.08 * sin(ang * 5.0 + sid * 4.3);
    float r = (13.0 + age * 24.0) * wob;
    float fill = smoothstep(r, r * 0.55, dist);
    float rim = smoothstep(3.0, 0.5, abs(dist - r * 0.97));
    float a = (fill * 0.38 + rim * 0.50) * pow(1.0 - age, 1.4) * moved;
    vec3 pg = bb_pig(int(floor(sid * 0.5)));
    col += mix(pg, pg * 0.55, rim) * a;
    alpha += a;
  }
  // a clear drop of water at the pointer
  float dm = length(p - mouse);
  float drop = smoothstep(2.0, 0.0, abs(dm - 7.0)) * 0.20;
  col += vec3(0.95, 0.92, 0.88) * drop;
  alpha += drop;
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
