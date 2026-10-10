#version 440
// category: Glow
// desc: Lantern spark: a tiny warm paper-lantern glow at the pointer, with a few embers rising from it and from where it has just been
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
  vec3 warm = vec3(1.0, 0.62, 0.24);
  vec3 cream = vec3(1.0, 0.88, 0.58);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // the lantern: a soft halo and a small glowing paper body that breathes slowly
  float breathe = 0.92 + 0.08 * sin(time * 1.6) + 0.04 * sin(time * 0.7 + 1.0);
  vec2 q = (p - mouse) / vec2(1.0, 1.18);
  float dm = length(q);
  float halo = exp(-dm / 24.0) * 0.30 * breathe;
  float body = smoothstep(8.5, 4.5, length(vec2(q.x, q.y + 0.5) / vec2(0.82, 1.0))) * 0.70 * breathe;
  col += warm * halo + mix(warm, cream, 0.6) * body;
  alpha += halo + body;

  // embers: they leave the pointer one after another and rise with a lazy sideways sway; the older trail points shed a few too
  for (int i = 0; i < 8; i++) {
    float seed = float(i) * 3.17;
    float ph = fract(time * (0.20 + 0.06 * hash(seed)) + hash(seed + 1.0));
    float life = ph;
    vec2 o = P(0);
    if (i >= 3) o = mix(P(0), P(i - 2), 0.8);          // some start from where the pointer was a moment ago
    vec2 sp = o + vec2((hash(seed + 2.0) - 0.5) * 16.0 + sin(ph * 5.0 + seed) * (4.0 + 8.0 * life), -6.0 - life * (34.0 + 22.0 * hash(seed + 3.0)));
    float r = 1.5 + 1.0 * hash(seed + 4.0);
    float spark = exp(-pow(length(p - sp) / r, 2.0)) * smoothstep(0.0, 0.12, life) * (1.0 - life) * (1.0 - life);
    float glow = exp(-length(p - sp) / 5.0) * 0.18 * (1.0 - life);
    vec3 sc = mix(cream, warm, life);
    col += sc * (spark * 1.1 + glow);
    alpha += spark * 1.1 + glow;
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
