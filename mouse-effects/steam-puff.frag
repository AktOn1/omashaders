#version 440
// category: Trail
// desc: Steam puff: round puffs of white steam are left along the path, then rise, billow and thin out behind the pointer for about a second; a tiny brass glint marks the pointer itself
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

float sp_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float sp_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sp_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sp_h2(i), sp_h2(i + vec2(1.0, 0.0)), f.x), mix(sp_h2(i + vec2(0.0, 1.0)), sp_h2(i + vec2(1.0, 1.0)), f.x), f.y);
}

// a cluster of three overlapping billows with a ragged edge; returns density in x and a shade (0 = shadowed underside) in y
vec2 sp_cloud(vec2 d, float rad, float id) {
  float dens = 0.0;
  float shade = 0.0;
  for (int j = 0; j < 3; j++) {
    float jf = float(j);
    vec2 o = vec2(sp_hash(id + jf * 1.9) - 0.5, sp_hash(id + jf * 4.1) - 0.5) * rad * 1.1;
    float r = rad * (0.62 + 0.3 * sp_hash(id + jf * 7.3));
    vec2 q = d - o;
    float n = sp_noise(q * 0.15 + id + jf) * 0.6 + sp_noise(q * 0.36 - id) * 0.3;
    float b = smoothstep(r * (1.0 + 0.5 * n), r * 0.1, length(q));
    if (b > dens) { dens = b; shade = 0.5 + 0.5 * clamp(-q.y / r, -1.0, 1.0); }
  }
  return vec2(dens, shade);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  float bestA = 0.0;
  vec3 bestC = vec3(0.0);
  // every sample leaves a puff that rises, spreads and thins out as it ages
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float id = SID(i) * 3.7;
    float rise = 1.0 - (1.0 - age) * (1.0 - age);                  // quick at first, then slowing
    float rad = 10.0 + 20.0 * pow(age, 0.7);
    vec2 c = P(i) + vec2((sp_hash(id) - 0.5) * 8.0 + sin(time * 1.3 + id) * 5.0 * age, -rise * 60.0);
    vec2 d = p - c;
    if (dot(d, d) > rad * rad * 2.8) continue;
    vec2 cl = sp_cloud(d, rad, id);
    float a = clamp(cl.x * 1.15, 0.0, 1.0) * pow(1.0 - age, 1.2) * 0.8 * moved;
    if (a > bestA) {
      bestA = a;
      bestC = mix(vec3(0.58, 0.62, 0.72), vec3(1.0, 0.99, 0.97), clamp(cl.y * 0.7 + cl.x * 0.4, 0.0, 1.0));   // a grey-blue underside so the puff also reads on bright pictures
    }
  }
  float alpha = bestA;
  vec3 col = bestC * bestA;
  // a small brass glint at the pointer
  float dm = length(p - mouse);
  float core = smoothstep(5.0, 0.0, dm) * 0.55;
  vec3 brass = vec3(1.0, 0.78, 0.42);
  col = col * (1.0 - core) + brass * core;
  alpha = alpha * (1.0 - core) + core;
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col / max(alpha, 1e-4), 0.0, 1.0) * a, a) * qt_Opacity;
}
