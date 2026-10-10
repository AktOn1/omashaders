#version 440
// category: Trail
// desc: Ink brush: the pointer paints a calligraphy stroke in sumi ink that thins when you move fast, goes dry-brush and fades like drying ink; a drop of vermilion marks the tip
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

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
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
// brush width at trail point j: wide and loaded when slow, thin when fast, tapering with age
float nodeWidth(int j) {
  int k = j < 8 ? j : 7;
  float len = distance(P(k), P(k + 1));
  float age = float(j) / 8.0;
  float w = clamp(13.0 - len * 0.14, 3.0, 13.0);
  return w * (1.0 - 0.75 * pow(age, 1.6)) * smoothstep(0.0, 1.5, len + 0.6 * (1.0 - age));
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 inkCol = vec3(0.045, 0.047, 0.058);
  vec3 washi = vec3(0.93, 0.89, 0.79);
  vec3 shu = vec3(0.88, 0.22, 0.12);
  float aInk = 0.0, aHalo = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 a = P(i), b = P(i + 1);
    vec2 ab = b - a;
    float L = length(ab);
    if (L < 0.4) continue;
    vec2 dir = ab / L;
    vec2 pa = p - a;
    float h = clamp(dot(pa, ab) / (L * L), 0.0, 1.0);
    float d = length(pa - ab * h);
    float side = dir.x * pa.y - dir.y * pa.x;
    float age = (float(i) + h) / 8.0;
    float w = mix(nodeWidth(i), nodeWidth(i + 1), h);
    if (d > w + 11.0) continue;
    float fade = pow(1.0 - age, 0.75);
    // dry brush: bristle streaks along the stroke open up as the ink dries and when the brush moves fast
    float t = side / max(w, 0.5);
    float speed = clamp(L / 90.0, 0.0, 1.0);
    float dry = clamp(age * 1.1 + speed * 0.35 - 0.12, 0.0, 1.0);
    float bristle = noise(vec2(t * 4.5 + float(i) * 11.0, (float(i) + h) * 3.0));
    float body = smoothstep(dry * 0.85 - 0.05, dry * 0.85 + 0.25, bristle);
    float cover = smoothstep(w + 0.8, w - 0.8, d);
    float rough = 1.0 - 0.25 * smoothstep(0.55, 1.0, abs(t)) * noise(p * 0.5 + float(i));
    aInk = max(aInk, cover * body * rough * fade * 0.95);
    // wet feathering: a soft pale bleed around the fresh ink so it also reads on dark screens
    aHalo = max(aHalo, smoothstep(w + 9.0, w, d) * fade * (1.0 - 0.5 * dry) * 0.48);
  }
  // the brush tip: a drop of vermilion in a dot of ink at the pointer
  float dm = length(p - mouse);
  float dropInk = smoothstep(6.0, 4.0, dm) * 0.9;
  float dropRed = smoothstep(3.4, 2.0, dm);
  aHalo = max(aHalo, smoothstep(16.0, 6.0, dm) * 0.3);
  aInk = max(aInk, dropInk);

  vec3 col = inkCol * aInk + washi * aHalo * (1.0 - aInk);
  float alpha = aInk + aHalo * (1.0 - aInk);
  col = mix(col, shu * 1.0, dropRed);
  alpha = max(alpha, dropRed);
  alpha = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(col * 1.0, alpha) * qt_Opacity;
}
