#version 440
// category: Trail
// desc: Mist trail: the pointer leaves a soft, pale wisp of morning mist that stays where it was left, drifts slowly up and sideways and thins out over about a second
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

float mt_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mt_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mt_hash(i), mt_hash(i + vec2(1.0, 0.0)), f.x), mix(mt_hash(i + vec2(0.0, 1.0)), mt_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// distance from p to segment a-b, and the position along it
vec2 mt_seg(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return vec2(length(p - a - ba * h), h);
}
// how far sample i has drifted: a little upward and sideways, more as it ages
vec2 mt_drift(int i) {
  float age = AGE(i);
  return vec2(sin(time * 0.35 + SID(i) * 0.9) * 12.0 * age, -40.0 * age * age - 4.0 * age);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 mist = vec3(0.80, 0.90, 0.92);
  float acc = 0.0, bage = 0.0;
  vec2 pa = P(0) + mt_drift(0);
  for (int i = 0; i < 16; i++) {
    vec2 pb = P(i + 1) + mt_drift(i + 1);
    // mist is only emitted where the pointer actually moved
    float moved = smoothstep(0.3, 4.0, distance(P(i), P(i + 1)));
    if (moved > 0.0) {
      vec2 s = mt_seg(p, pa, pb);
      float age = mix(AGE(i), AGE(i + 1), s.y);
      float w = 14.0 + 40.0 * age;                       // the wisp spreads wider as it ages
      if (s.x < w) {
        float body = smoothstep(w, 0.0, s.x);
        body = body * body * (3.0 - 2.0 * body);
        float v = body * pow(1.0 - age, 1.3) * 0.42 * moved;
        if (v > acc) { acc = v; bage = age; }
      }
    }
    pa = pb;
  }
  if (acc > 0.0) {
    // wispy texture: slowly sliding noise breaks the cloud up, more so as it thins out
    float n = mt_noise(p * 0.028 + vec2(time * 0.07, -time * 0.05)) * 0.65
            + mt_noise(p * 0.065 + vec2(-time * 0.06, time * 0.04)) * 0.35;
    acc *= mix(1.0, smoothstep(0.22, 0.72, n), 0.30 + 0.55 * bage);
  }
  float dm = length(p - mouse);
  float halo = exp(-dm * dm / (2.0 * 12.0 * 12.0)) * 0.10;
  float a = clamp(acc + halo, 0.0, 0.7);
  fragColor = vec4(mist * a, a) * qt_Opacity;
}
