#version 440
// category: Trail
// desc: Mist trail: the pointer leaves a soft, pale wisp of morning mist that drifts slowly up and sideways and thins out behind it
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

float mt_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mt_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mt_hash(i), mt_hash(i + vec2(1.0, 0.0)), f.x), mix(mt_hash(i + vec2(0.0, 1.0)), mt_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 mt_P(int i) {
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
// distance from p to segment a-b
float mt_seg(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(p - a - ba * h);
}

// how far the i-th piece of the wisp has drifted: a little upward and sideways, more as it ages
vec2 mt_drift(int i) {
  float age = float(i) / 8.0;
  return vec2(sin(time * 0.35 + float(i) * 0.9) * 12.0 * age, -40.0 * age * age - 4.0 * age);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 mist = vec3(0.80, 0.90, 0.92);
  float acc = 0.0;
  for (int i = 1; i < 9; i++) {
    float age = float(i) / 8.0;
    float d = mt_seg(p, mt_P(i - 1) + mt_drift(i - 1), mt_P(i) + mt_drift(i));
    float w = 14.0 + 40.0 * age;                       // the wisp spreads wider as it ages
    float body = smoothstep(w, 0.0, d);
    body = body * body * (3.0 - 2.0 * body);
    // wispy texture: slowly sliding noise breaks the cloud up, more so as it thins out
    float n = mt_noise(p * 0.028 + vec2(time * 0.07, -time * 0.05) + float(i) * 0.7) * 0.65
            + mt_noise(p * 0.065 + vec2(-time * 0.06, time * 0.04)) * 0.35;
    float wisp = mix(1.0, smoothstep(0.22, 0.72, n), 0.30 + 0.55 * age);
    acc += body * wisp * pow(1.0 - age, 1.3) * 0.34;
  }
  // a resting pointer carries no cloud: it appears only while the pointer has moved
  acc *= smoothstep(4.0, 40.0, distance(mt_P(8), mouse));
  float dm = length(p - mouse);
  float halo = exp(-dm * dm / (2.0 * 12.0 * 12.0)) * 0.10;
  float a = clamp(acc + halo, 0.0, 0.7);
  fragColor = vec4(mist * a, a) * qt_Opacity;
}
