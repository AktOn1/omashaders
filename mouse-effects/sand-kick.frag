#version 440
// category: Trail
// desc: Sand kick: the pointer scuffs up golden dust. Soft ochre puffs billow and fade behind it and glinting sand grains are flung up and back, with a warm sun glint at the pointer
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

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 P(int i) {
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

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 dust = vec3(0.92, 0.62, 0.28);      // ochre dust
  vec3 sand = vec3(1.0, 0.84, 0.54);       // lit grains
  vec3 sun  = vec3(1.0, 0.93, 0.74);       // glint
  vec2 mv = mouse - P(4);                  // recent motion, grains fly the other way
  float spd = length(mv);
  vec2 back = spd > 1.0 ? -mv / spd : vec2(0.0, 0.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float bestA = 0.0;
  vec3 bestC = vec3(0.0);
  for (int i = 1; i < 9; i++) {
    vec2 c = P(i);
    float behind = smoothstep(2.0, 22.0, distance(c, mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    float seed = float(i) * 5.3;
    // dust puff: a ragged soft cloud along the path that grows, drifts up and thins out (capsule between neighbouring trail points, so it is one smooth ribbon)
    vec2 pa0 = P(i - 1), pb0 = P(i);
    vec2 sg = pb0 - pa0;
    float hh = clamp(dot(p - pa0, sg) / max(dot(sg, sg), 1e-4), 0.0, 1.0);
    float sage = (float(i - 1) + hh) / 8.0;
    vec2 pc = mix(pa0, pb0, hh) + vec2(back.x * 10.0 * sage, -26.0 * sage * sage - 3.0);
    vec2 d = p - pc;
    float rad = 13.0 + sage * 54.0;
    float ragged = vnoise(d * 0.09 + seed) * 0.6 + vnoise(d * 0.21 - seed) * 0.4;
    float puff = smoothstep(rad * (0.85 + 0.5 * ragged), 0.0, length(d * vec2(1.0, 1.35)));
    float pa = puff * pow(1.0 - sage, 1.4) * 0.9 * behind;
    if (pa > bestA) {   // neighbouring segments overlap at the joints: keep the strongest instead of adding, so there are no beads
      bestA = pa;
      bestC = mix(vec3(0.66, 0.38, 0.16), mix(dust, sand, 0.25 * (1.0 - sage)), smoothstep(0.0, 0.75, puff));   // darker rim so the cloud reads on bright pictures too
    }
    // flung grains: they rise, drift back and fall under gravity
    for (int k = 0; k < 4; k++) {
      float s = seed + float(k) * 1.7;
      float vx = (hash(s + 1.0) - 0.5) * 60.0 + back.x * 40.0 * hash(s + 4.0);
      float vy = -(20.0 + 44.0 * hash(s + 2.0)) + back.y * 22.0;
      float t = age * 1.0;
      vec2 gp = c + vec2(vx * t, vy * t + 38.0 * t * t) + vec2(sin(time * 3.0 + s * 9.0), cos(time * 2.4 + s * 5.0)) * 1.4 * age;
      float sz = 1.7 + 1.3 * hash(s + 6.0);
      float g = smoothstep(sz, 0.0, length(p - gp));
      float tw = 0.55 + 0.45 * sin(time * 9.0 + s * 11.0);   // glinting in the sun
      float ga = g * pow(1.0 - age, 0.8) * behind * tw;
      col += mix(sand, sun, tw) * ga;
      alpha += ga;
    }
  }
  col += bestC * bestA;
  alpha += bestA;
  // a small fresh puff right at the pointer while it moves, so the cloud joins the pointer
  float fresh = smoothstep(20.0, 0.0, length((p - mouse - back * 9.0) * vec2(1.0, 1.3))) * smoothstep(2.0, 30.0, spd) * 0.35;
  col += dust * fresh;
  alpha += fresh;
  // warm sun glint at the pointer
  float dm = length(p - mouse);
  float core = smoothstep(16.0, 0.0, dm) * 0.28;
  float star = (smoothstep(1.4, 0.0, abs(p.y - mouse.y)) * smoothstep(13.0, 0.0, abs(p.x - mouse.x))
              + smoothstep(1.4, 0.0, abs(p.x - mouse.x)) * smoothstep(13.0, 0.0, abs(p.y - mouse.y))) * 0.22;
  col += mix(sand, sun, 0.5) * (core + star);
  alpha += core + star;
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col / max(alpha, 1e-4), 0.0, 1.0) * a, a) * qt_Opacity;   // col is alpha-weighted: col / alpha is the straight colour
}
