#version 440
// category: Trail
// desc: Breath mist: small puffs of cold breath bloom where the pointer has been, swell, drift upward and melt away, with a faint frost haze clinging to the pointer itself
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
// SID(i): stable id of the sample in slot i (it keeps its id as it moves on), use it to seed hashes.
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

float bm_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bm_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bm_h(i), bm_h(i + vec2(1.0, 0.0)), f.x), mix(bm_h(i + vec2(0.0, 1.0)), bm_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 cold = vec3(0.80, 0.88, 1.00);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float seed = SID(i) * 7.31;
    float sx = bm_h(vec2(seed, 3.1)) - 0.5;
    // the puff swells quickly, then widens and thins out as it dies
    float grow = smoothstep(0.0, 0.10, age);
    float rad = 9.0 + 34.0 * pow(age, 0.60) + 5.0 * bm_h(vec2(seed, 7.7));
    // it lifts and leans a little as cold breath does
    vec2 c = P(i) + vec2(sx * 16.0 * age, -26.0 * age * age - 5.0 * age);
    vec2 d = p - c;
    if (dot(d, d) > (rad + rad * 0.9) * (rad + rad * 0.9)) continue;
    float dist = length(d);
    // ragged edge: two turns of cheap noise in the puff's own frame
    vec2 q = d / rad;
    float wob = bm_n(q * 2.3 + vec2(seed, -seed * 0.7) + vec2(0.0, -age * 1.1)) - 0.5;
    float wob2 = bm_n(q * 5.1 + vec2(seed * 1.9, seed)) - 0.5;
    float body = exp(-pow(dist / (rad * (0.74 + 0.46 * wob + 0.22 * wob2)), 2.2));
    // a hollow middle once it is old, so the puff reads as vapour and not a dot
    float hollow = 1.0 - 0.55 * smoothstep(0.35, 0.95, age) * exp(-pow(dist / (rad * 0.45), 2.0));
    float fade = grow * pow(1.0 - age, 1.4);
    float a = body * hollow * fade * 0.50 * moved;
    col += mix(cold, vec3(0.96, 0.99, 1.0), 0.30 * (1.0 - age)) * a;
    alpha += a;
  }

  // a thin frost haze right at the pointer, with a few tiny glints in it
  float dm = length(p - mouse);
  float haze = exp(-pow(dm / 15.0, 2.0)) * 0.13;
  float gl = bm_h(floor((p - mouse) * 0.5) + floor(vec2(time * 4.0, 0.0)));
  haze += step(0.992, gl) * exp(-pow(dm / 22.0, 2.0)) * 0.35;
  col += cold * haze;
  alpha += haze;

  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
