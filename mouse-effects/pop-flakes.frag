#version 440
// category: Trail
// desc: Pop flakes: little confetti flakes in bright colours pop off the places the pointer has been, spin and flutter down behind it as they fade
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

float pf_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec3 pf_col(int k) {
  if (k == 0) return vec3(1.00, 0.42, 0.38);
  if (k == 1) return vec3(1.00, 0.80, 0.22);
  if (k == 2) return vec3(0.30, 0.82, 0.62);
  if (k == 3) return vec3(0.28, 0.66, 1.00);
  return vec3(0.98, 0.52, 0.80);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float sid = SID(i);
    float h = pf_hash(sid * 5.7);
    float h2 = pf_hash(sid * 2.3 + 1.0);
    if (pf_hash(sid * 3.3 + 7.0) > 0.7) continue;                       // not every sample pops a flake
    // the flake pops out quickly, then flutters down and sideways
    float pop = 1.0 - exp(-age * 6.0);
    vec2 o = P(i) + vec2((h - 0.5) * 40.0 * pop + 8.0 * sin(time * 1.5 + h * 30.0) * age, 8.0 * pop + age * 36.0);
    vec2 d = p - o;
    if (dot(d, d) > 90.0) continue;
    float ang = (time * (0.8 + 1.0 * h2) + age * 6.0) * (h > 0.5 ? 1.0 : -1.0) + h * 20.0;
    float ca = cos(ang), sa = sin(ang);
    vec2 r = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
    float flip = 0.3 + 0.7 * abs(sin(time * 1.6 + h2 * 30.0));
    float k = smoothstep(1.2, 0.0, max(abs(r.x) - 8.0, abs(r.y) - 4.0 * flip));
    float a = k * pow(1.0 - age, 0.8) * 0.95 * moved * smoothstep(0.0, 0.04, age);
    col += pf_col(int(floor(pf_hash(sid * 13.7 + 2.0) * 5.0))) * a;
    alpha += a;
  }
  float dm = length(p - mouse);
  float core = smoothstep(14.0, 0.0, dm) * 0.10;
  col += vec3(1.0, 0.86, 0.5) * core;
  alpha += core;
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
