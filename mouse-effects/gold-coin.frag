#version 440
// category: Trail
// desc: Gold coin: a tiny gold coin spins beside the pointer, with small four-point gold glints flashing around it and along the path just travelled
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

float gc_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 gc_P(int i) {
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
// a four-point glint of "reach" r pixels
float gc_star(vec2 d, float r) {
  float core = exp(-dot(d, d) / (r * r * 0.18));
  float arms = exp(-abs(d.x) / (r * 0.10)) * exp(-abs(d.y) / (r * 0.85)) + exp(-abs(d.y) / (r * 0.10)) * exp(-abs(d.x) / (r * 0.85));
  return core + 0.7 * arms;
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 gold = vec3(1.0, 0.74, 0.22);
  vec3 pale = vec3(1.0, 0.94, 0.68);
  vec3 deep = vec3(0.62, 0.36, 0.06);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // a soft warm halo around the pointer
  float dm = length(p - mouse);
  float halo = exp(-dm / 16.0) * 0.18;
  col += gold * halo;
  alpha += halo;

  // the coin: it turns about its vertical axis, so it squeezes to a thin edge and back
  vec2 cc = mouse + vec2(11.0, 13.0);
  float ph = time * 4.2;
  float cs = cos(ph);
  float rx = max(abs(cs), 0.16) * 6.5;
  vec2 q = p - cc;
  float e = length(q / vec2(rx, 6.5));
  float body = smoothstep(1.0, 0.82, e);
  float rim = smoothstep(0.62, 0.86, e) * body;                         // the raised rim
  float face = mix(0.65, 1.0, 0.5 + 0.5 * (q.x / max(rx, 1.0)) * sign(cs) * -1.0);   // a sheen sweeping across the face
  vec3 coinC = mix(mix(deep, gold, face), pale, rim * 0.6 + 0.35 * smoothstep(0.35, 0.0, abs(q.x / rx + 0.35 * sign(cs)) + abs(q.y) / 6.5 - 0.1) * abs(cs));
  float stamp = smoothstep(0.30, 0.20, e) * abs(cs);                     // a tiny stamped mark in the middle
  coinC = mix(coinC, deep * 1.2, stamp * 0.55);
  float edgeOn = 1.0 - abs(cs);
  coinC += pale * 0.35 * edgeOn * smoothstep(0.5, 0.0, abs(q.x) / max(rx, 1.0));
  col += coinC * body;
  alpha += body;
  // the flash when the coin shows its face
  float flash = pow(max(cs, 0.0), 24.0);
  col += pale * gc_star(q - vec2(-2.0, -2.0), 9.0) * flash * 0.9;
  alpha += gc_star(q - vec2(-2.0, -2.0), 9.0) * flash * 0.9;

  // glints: around the pointer, and on the path behind it (older points fade out)
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float seed = fi * 5.31;
    vec2 o = gc_P(i);
    float fade = 1.0 - fi / 9.0;
    vec2 off = vec2((gc_hash(seed + 1.0) - 0.5) * 34.0, (gc_hash(seed + 2.0) - 0.5) * 30.0);
    if (i == 0) off = off * 0.9 + vec2(-8.0, -10.0);
    vec2 sp = o + off;
    float rate = 0.7 + 0.9 * gc_hash(seed + 3.0);
    float ph2 = sin(time * rate * 3.0 + gc_hash(seed + 4.0) * 40.0);
    float tw = pow(max(ph2, 0.0), 3.0);
    float sz = 6.0 + 7.0 * gc_hash(seed + 6.0);
    float g = gc_star(p - sp, sz) * tw * (0.35 + 0.65 * fade);
    col += mix(gold, pale, 0.55) * g;
    alpha += g;
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
