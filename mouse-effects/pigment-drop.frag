#version 440
// category: Trail
// desc: Pigment drop: every move lets a bead of watercolour fall into the water; it blooms outward, its edge frays into threads, it drifts and fades, and each bead carries its own pigment (viridian, alizarin, ultramarine or ochre)
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

float pd_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pd_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pd_hash(i), pd_hash(i + vec2(1.0, 0.0)), f.x), mix(pd_hash(i + vec2(0.0, 1.0)), pd_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// four pigments off the palette
vec3 pd_pigment(float k) {
  if (k < 0.25) return vec3(0.105, 0.640, 0.610);     // viridian
  if (k < 0.50) return vec3(0.880, 0.270, 0.360);     // alizarin
  if (k < 0.75) return vec3(0.310, 0.400, 0.920);     // ultramarine
  return vec3(0.910, 0.690, 0.260);                   // raw ochre
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float seed = SID(i) * 1.37;
    if (mod(SID(i), 3.0) > 0.5) continue;                                   // a bead falls every third sample, not every one
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    // the bead drifts a little as it blooms, each one its own way
    vec2 drift = vec2(pd_hash(vec2(seed, 3.0)) - 0.5, pd_hash(vec2(seed, 9.0)) - 0.75) * (34.0 * age * age);
    vec2 d = p - P(i) - drift;
    float r = length(d);
    float rad = 7.0 + (40.0 + 22.0 * pd_hash(vec2(seed, 1.0))) * pow(age, 0.62);
    if (r > rad * 1.5) continue;
    // the rim frays into threads as the pigment finds its way through the water
    float ang = atan(d.y, d.x);
    float frill = 1.0 + 0.26 * (pd_noise(vec2(ang * 2.3 + seed, 1.0 + age * 1.6)) - 0.5)
                      + 0.12 * (pd_noise(vec2(ang * 6.0 + seed * 2.0, 4.0)) - 0.5);
    float rr = r / max(rad * frill, 1.0);
    float body = 1.0 - smoothstep(0.35, 1.0, rr);
    float ring = exp(-pow((rr - 0.84) / 0.21, 2.0)) * 0.48;                 // the bloom is darkest at its edge
    float a = (body * 0.34 + ring * 0.85) * pow(1.0 - age, 1.5) * moved;
    col += pd_pigment(fract(seed * 0.173)) * a;
    alpha += a;
  }
  // the fresh bead hanging at the pointer
  float dm = length(p - mouse);
  float core = smoothstep(7.0, 2.0, dm) * 0.85 + smoothstep(13.0, 6.0, dm) * 0.22;
  col += pd_pigment(fract(hs.x * 0.0131)) * core;
  alpha += core;
  float A = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (A / max(alpha, 1e-4)), A) * qt_Opacity;
}
