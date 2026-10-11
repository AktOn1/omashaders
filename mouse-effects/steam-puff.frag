#version 440
// category: Trail
// desc: Steam puff: small round puffs of white steam keep rising off the pointer, billowing and thinning as they go. When the pointer moves it leaves a drifting trail of older puffs behind. A tiny brass glint marks the pointer itself
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

float sp_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float sp_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sp_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sp_h2(i), sp_h2(i + vec2(1.0, 0.0)), f.x), mix(sp_h2(i + vec2(0.0, 1.0)), sp_h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 sp_P(int i) {
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
  float rimGrey = 0.0;
  // puffs that leave the pointer and rise on their own
  for (int k = 0; k < 7; k++) {
    float kf = float(k);
    float sp = 0.55 + 0.15 * sp_hash(kf + 1.0);
    float life = fract(time * sp + kf / 7.0);
    float id = floor(time * sp + kf / 7.0) * 7.0 + kf;
    float sway = sin(time * 1.7 + id * 2.3) * 5.0 * life + (sp_hash(id) - 0.5) * 8.0 * life;
    vec2 c = mouse + vec2(sway, -6.0 - life * 62.0);
    float rad = 6.0 + 17.0 * pow(life, 0.7);
    vec2 d = p - c;
    vec2 cl = sp_cloud(d, rad, id);
    float a = clamp(cl.x * 1.15, 0.0, 1.0) * pow(1.0 - life, 1.1) * smoothstep(0.0, 0.1, life) * 0.95;
    if (a > bestA) {
      bestA = a;
      bestC = mix(vec3(0.58, 0.62, 0.72), vec3(1.0, 0.99, 0.97), clamp(cl.y * 0.7 + cl.x * 0.4, 0.0, 1.0));   // a grey-blue underside so the puff also reads on bright pictures
    }
  }
  // older puffs left along the path, rising and spreading
  for (int i = 1; i < 9; i++) {
    float age = float(i) / 8.0;
    vec2 c0 = sp_P(i);
    float away = smoothstep(6.0, 40.0, distance(c0, mouse));
    if (away <= 0.0) continue;
    float id = float(i) * 3.7;
    vec2 c = c0 + vec2(sin(time * 1.3 + id) * 6.0 * age, -age * 34.0);
    float rad = 8.0 + 16.0 * age;
    vec2 d = p - c;
    vec2 cl = sp_cloud(d, rad, id);
    float a = clamp(cl.x * 1.15, 0.0, 1.0) * pow(1.0 - age, 1.3) * 0.85 * away;
    if (a > bestA) {
      bestA = a;
      bestC = mix(vec3(0.58, 0.62, 0.72), vec3(1.0, 0.99, 0.97), clamp(cl.y * 0.7 + cl.x * 0.4, 0.0, 1.0));
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
