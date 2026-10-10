#version 440
// category: Trail
// desc: Petal trail: a short stream of pink cherry-blossom petals tumbles and drifts down behind the pointer, with a soft blossom glow at the tip
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

const vec3 PALE = vec3(1.00, 0.91, 0.95);
const vec3 PINK = vec3(1.00, 0.72, 0.83);
const vec3 DEEP = vec3(0.93, 0.44, 0.65);
const vec3 BACK = vec3(0.84, 0.72, 0.95);
const vec3 RIM = vec3(0.58, 0.20, 0.46);   // darker rose outline so petals read on pink and on dark pictures alike

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);   // premultiplied
  float alpha = 0.0;
  for (int i = 1; i < 9; i++) {
    float behind = smoothstep(4.0, 40.0, distance(P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    float seed = float(i) * 3.7;
    float size = 15.0 * (1.0 - 0.35 * age) * (0.85 + 0.3 * hash(seed));
    // each petal drifts down and sideways as it ages, wobbling on the way
    vec2 pc = P(i) + vec2(sin(time * 2.2 + seed) * 10.0 * age + (hash(seed + 1.0) - 0.5) * 16.0, age * 40.0 + 6.0 * sin(time * 3.0 + seed));
    vec2 r = p - pc;
    if (dot(r, r) > size * size * 2.6) continue;
    float a = seed + time * (1.6 + hash(seed + 2.0) * 1.4) * (hash(seed + 3.0) < 0.5 ? -1.0 : 1.0);
    float ca = cos(a), sa = sin(a);
    vec2 u = vec2(ca * r.x + sa * r.y, -sa * r.x + ca * r.y) / size;
    float tx = cos(time * (3.0 + hash(seed + 4.0) * 2.0) + seed * 5.0);   // turning edge-on and back
    u.x /= 0.25 + 0.75 * abs(tx);
    float w = max(0.55 + 0.22 * u.y, 0.2);
    float e = length(vec2(u.x / w, u.y)) - 1.0;
    float aa = 0.10;
    float cover = smoothstep(aa, -aa, e);
    cover *= smoothstep(0.12, 0.3, length(u - vec2(0.0, 1.0)));          // notch at the tip
    if (cover <= 0.003) continue;
    vec3 c = mix(DEEP, PINK, smoothstep(-1.0, 0.0, u.y));
    c = mix(c, PALE, smoothstep(0.1, 1.0, u.y) * 0.5);
    c = mix(c, DEEP, 0.25 * smoothstep(0.14, 0.0, abs(u.x)) * smoothstep(0.7, -0.6, u.y));
    c = mix(BACK * (0.8 + 0.2 * c), c, smoothstep(-0.25, 0.25, tx));
    c = mix(c, RIM, 0.75 * smoothstep(-0.38, -0.02, e));
    c = mix(c, vec3(1.0, 0.95, 0.97), 0.25 * smoothstep(-0.2, -0.45, e));
    float fade = (1.0 - age * 0.7) * behind;
    float al = cover * fade;
    col = col * (1.0 - al) + c * al;
    alpha = alpha * (1.0 - al) + al;
  }
  // a thin blossom-shaped ring around the pointer tip (five soft lobes, slowly turning), the pointer itself stays clear
  vec2 q = p - mouse;
  float dm = length(q);
  float ang = atan(q.y, q.x);
  float sec = fract(ang / 1.2566 + time * 0.05);                       // five scalloped petals with a notch between them
  float ringR = 10.5 + 5.5 * pow(sin(sec * 3.14159), 0.55);
  float rd = abs(dm - ringR);
  vec3 hc = mix(RIM, vec3(1.0, 0.86, 0.92), smoothstep(3.5, 0.8, rd));
  float ha = smoothstep(5.5, 3.0, rd) * 0.55 + smoothstep(2.2, 0.6, rd) * 0.45;
  col = col * (1.0 - ha) + hc * ha;
  alpha = alpha * (1.0 - ha) + ha;
  fragColor = vec4(clamp(col, 0.0, 1.0), clamp(alpha, 0.0, 1.0)) * qt_Opacity;
}
