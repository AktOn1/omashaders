#version 440
// category: Glow
// desc: Bat flutter: three tiny bats flap in lazy loops around the pointer, each with a thin red rim, over a faint blood-red glow
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

float bf_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 bf_P(int i) {
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
float bf_ell(vec2 q, vec2 r) { return (length(q / r) - 1.0) * min(r.x, r.y); }
float bf_tri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
// a bat from the front, half wingspan = 1, f = flap -1..1 (distance in the same units)
float bf_bat(vec2 q, float f) {
  float d = bf_ell(q - vec2(0.0, 0.06), vec2(0.13, 0.24));
  d = min(d, length(q - vec2(0.0, -0.22)) - 0.09);
  vec2 qa = vec2(abs(q.x), q.y);
  d = min(d, bf_tri(qa, vec2(0.04, -0.24), vec2(0.10, -0.40), vec2(0.13, -0.20)));
  vec2 tip = vec2(1.0 - 0.22 * abs(f), -0.55 * f - 0.20);
  vec2 mid = vec2(0.62 - 0.10 * abs(f), 0.22 - 0.25 * f);
  d = min(d, bf_tri(qa, vec2(0.08, -0.12), tip, mid));
  d = min(d, bf_tri(qa, vec2(0.08, -0.12), mid, vec2(0.12, 0.42)));
  d = min(d, bf_tri(qa, mid, vec2(0.34, 0.48 - 0.12 * f), vec2(0.12, 0.42)));
  return d;
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 red = vec3(0.92, 0.12, 0.20);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // a faint blood-red glow under the pointer
  float dm = length(p - mouse);
  float glow = exp(-dm / 20.0) * 0.20 + exp(-dm * dm / 30.0) * 0.15;
  col += red * glow;
  alpha += glow;

  // three bats on lazy, different loops around the pointer; the older ones lag a little behind it
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float h = bf_hash(fi + 1.0);
    float w = 1.5 + 0.7 * h;                                   // loop speed
    float ang = time * w + fi * 2.094;
    float rad = 24.0 + 12.0 * sin(time * 0.9 + fi * 1.7) + 8.0 * fi;
    vec2 centre = mix(mouse, bf_P(1 + i * 2), 0.5);
    vec2 bp = centre + vec2(cos(ang) * rad * 1.25, sin(ang * 1.3 + fi) * rad * 0.65 - 6.0);
    float size = 10.0 + 3.0 * h;                               // half wingspan in px
    vec2 q = (p - bp) / size;
    if (abs(q.x) > 1.5 || abs(q.y) > 1.3) continue;
    float f = sin(time * (11.0 + 3.0 * h) + fi * 2.3);
    float d = bf_bat(q, f) * size;
    float body = smoothstep(0.8, -0.8, d);
    float rim = smoothstep(-1.2, -0.2, d) * body;
    vec3 fill = vec3(0.04, 0.0, 0.02);
    vec3 bc = fill + red * rim * 0.75;
    // pre-multiplied "over": the bat covers what was there
    col = mix(col, bc, body);
    alpha = mix(alpha, 0.96, body);
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
