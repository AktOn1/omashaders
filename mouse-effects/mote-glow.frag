#version 440
// category: Glow
// desc: Mote glow: a small warm glow at the pointer and a few fading golden dust motes drifting up behind it, like dust catching late sun
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

float mg_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 mg_P(int i) {
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
  vec3 amber = vec3(1.0, 0.72, 0.30);
  vec3 gold = vec3(1.0, 0.88, 0.55);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // motes: two per trail point, each rises and spreads a little as it ages, shrinks and fades
  for (int i = 1; i < 9; i++) {
    float behind = smoothstep(3.0, 30.0, distance(mg_P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    for (int k = 0; k < 2; k++) {
      float seed = float(i) * 5.7 + float(k) * 13.3;
      vec2 off = (vec2(mg_hash(seed), mg_hash(seed + 1.7)) - 0.5) * (8.0 + 44.0 * age);
      off += vec2(sin(time * 0.8 + seed) * 4.0 * age, -34.0 * age * age - 6.0 * age);        // lazy drift upward
      float r = (5.0 - 2.4 * age) * (0.7 + 0.6 * mg_hash(seed + 2.9));
      float d = length(p - (mg_P(i) + off));
      float tw = 0.7 + 0.3 * sin(time * 2.1 + seed * 3.0);
      float a = (smoothstep(r, r * 0.15, d) + 0.25 * smoothstep(r * 4.0, 0.0, d)) * pow(1.0 - age, 1.6) * tw * behind * 1.0;
      col += mix(gold, amber, 0.5 + 0.5 * sin(seed)) * a;
      alpha += a;
    }
  }

  // small warm glow at the pointer: a soft halo, a bright little core, breathing very slowly
  float dm = length(p - mouse);
  float breathe = 0.9 + 0.1 * sin(time * 1.4);
  float halo = exp(-dm * dm / (2.0 * 17.0 * 17.0)) * 0.42 * breathe;
  float core = exp(-dm * dm / (2.0 * 4.5 * 4.5)) * 0.40;
  col += amber * halo + gold * core;
  alpha += halo + core;

  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
