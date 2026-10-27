#version 440
// category: Glow
// desc: Moth flutter: three furry grey moths with feathered antennae and swept-back wings flutter in uneven loops around the pointer, shedding wing dust, drawn to a small lantern glow that follows it
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

float mf_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float mf_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mf_hash(i.x + i.y * 57.0), b = mf_hash(i.x + 1.0 + i.y * 57.0);
  float c = mf_hash(i.x + (i.y + 1.0) * 57.0), d = mf_hash(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
vec2 mf_P(int i) {
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
float mf_ell(vec2 q, vec2 r) { return (length(q / r) - 1.0) * min(r.x, r.y); }
float mf_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// unsigned distance to the outline of a triangle, signed by inside test
float mf_tri(vec2 p, vec2 a, vec2 b, vec2 c) {
  float d = min(min(mf_seg(p, a, b), mf_seg(p, b, c)), mf_seg(p, c, a));
  vec2 e0 = b - a, e1 = c - b, e2 = a - c;
  float s0 = e0.x * (p.y - a.y) - e0.y * (p.x - a.x);
  float s1 = e1.x * (p.y - b.y) - e1.y * (p.x - b.x);
  float s2 = e2.x * (p.y - c.y) - e2.y * (p.x - c.x);
  bool inside = (s0 >= 0.0 && s1 >= 0.0 && s2 >= 0.0) || (s0 <= 0.0 && s1 <= 0.0 && s2 <= 0.0);
  return inside ? -d : d;
}
// moth seen from above, head toward -y, half wingspan about 1; w = wing opening 0.3..1
float mf_wings(vec2 a, float w) {
  // forewing: broad swept-back triangle with a rounded tip
  vec2 sh = vec2(0.07, -0.20);
  vec2 tip = vec2(0.14 + 0.86 * w, -0.12 + 0.30 * (1.0 - w));
  vec2 hind = vec2(0.10 + 0.42 * w, 0.52);
  float d = mf_tri(a, sh, tip, hind) - 0.07;
  // small hindwing tucked behind it
  d = min(d, mf_tri(a, vec2(0.06, 0.05), vec2(0.10 + 0.40 * w, 0.32), vec2(0.06 + 0.22 * w, 0.62)) - 0.05);
  return d;
}
float mf_body(vec2 a) {
  float d = mf_ell(a - vec2(0.0, -0.10), vec2(0.17, 0.22));
  d = min(d, mf_ell(a - vec2(0.0, 0.30), vec2(0.12, 0.36)));
  d = min(d, length(a - vec2(0.0, -0.36)) - 0.09);
  return d;
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 warm = vec3(1.0, 0.62, 0.20);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // a small lantern glow under the pointer
  float dm = length(p - mouse);
  float glow = exp(-dm / 18.0) * 0.22 + exp(-dm * dm / 26.0) * 0.16;
  col += warm * glow;
  alpha += glow;

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float h = mf_hash(fi + 3.0);
    float ang = time * (1.3 + 0.8 * h) + fi * 2.094 + 0.7 * sin(time * 2.3 + fi * 4.0);
    float rad = 22.0 + 12.0 * sin(time * 1.1 + fi * 1.9) + 9.0 * fi;
    vec2 centre = mix(mouse, mf_P(1 + i * 2), 0.5);
    vec2 bp = centre + vec2(cos(ang) * rad * 1.2, sin(ang * 1.4 + fi) * rad * 0.7 - 4.0);
    float size = 20.0 + 5.0 * h;

    // wing dust: three specks per moth drift down and fade
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float ph = fract(time * 0.7 + fk / 3.0 + h);
      vec2 dp = bp + vec2(sin(time * 2.0 + fk * 2.1 + fi) * 6.0 + (fk - 1.0) * 5.0, 4.0 + ph * 20.0);
      float dd = length(p - dp);
      float da = smoothstep(1.6, 0.3, dd) * (1.0 - ph) * 0.8;
      col += vec3(0.95, 0.88, 0.75) * da;
      alpha += da;
    }

    vec2 q = (p - bp) / size;
    // head toward the direction of travel
    vec2 vel = vec2(-sin(ang) * 1.2, cos(ang * 1.4 + fi) * 0.7 * 1.4);
    float ca = vel.y / max(length(vel), 1e-3), sa = vel.x / max(length(vel), 1e-3);
    q = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
    if (length(q) > 1.9) continue;
    float w = 0.30 + 0.70 * abs(cos(time * (9.0 + 3.0 * h) + fi * 2.3));
    vec2 a = vec2(abs(q.x), q.y);

    // pale halo: the moth is lit by the lantern
    float halo = exp(-length(q) * 2.6) * 0.20;
    col += vec3(1.0, 0.80, 0.55) * halo;
    alpha += halo;

    // feathered antennae: a curved stalk with short barbs
    vec2 a0 = vec2(0.03, -0.43), a1 = vec2(0.30, -0.95);
    vec2 ap = a - a0, ab = a1 - a0;
    float at = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
    vec2 cp = a0 + ab * at + vec2(0.10 * sin(at * 3.1416), 0.0);
    float ad = length(a - cp) - (0.020 + 0.06 * abs(fract(at * 9.0) - 0.5) * (1.0 - at));
    float ant = smoothstep(0.6 / size, -0.2 / size, ad);

    float dw = mf_wings(a, w);
    dw += 0.020 * (mf_noise(q * 9.0 + fi) - 0.5) + 0.010 * sin(a.y * 18.0 + a.x * 6.0);
    float db = mf_body(a) + 0.012 * (mf_noise(q * 16.0) - 0.5);
    float wingA = smoothstep(0.9 / size, -0.9 / size, dw);
    float bodyA = smoothstep(0.7 / size, -0.7 / size, db);
    float edge = smoothstep(2.0 / size, 0.2 / size, abs(dw + 1.1 / size)) * wingA;

    // dusty wing colour with two wavy bands and a dark kidney mark
    float rr = length(a - vec2(0.0, -0.05)) + 0.04 * sin(a.y * 14.0 + 1.3 * fi);
    vec3 wing = mix(vec3(0.76, 0.70, 0.66), vec3(0.44, 0.36, 0.44), smoothstep(0.25, 1.0, rr));
    float bands = exp(-pow((rr - 0.52) / 0.035, 2.0)) + exp(-pow((rr - 0.84) / 0.04, 2.0));
    wing = mix(wing, vec3(0.30, 0.22, 0.30), clamp(bands, 0.0, 1.0) * 0.7);
    wing *= 0.94 + 0.10 * mf_noise(q * 22.0 + fi * 7.0);
    float km = length((a - vec2(0.15 + 0.38 * w, 0.0)) * vec2(1.0, 1.7));
    wing = mix(wing, vec3(0.22, 0.14, 0.22), smoothstep(0.075, 0.04, km));
    wing = mix(wing, vec3(0.92, 0.86, 0.74), smoothstep(0.04, 0.02, km) * 0.6);
    vec3 fur = mix(vec3(0.62, 0.54, 0.50), vec3(0.38, 0.30, 0.32), mf_noise(q * 20.0));
    fur = mix(fur, vec3(0.80, 0.72, 0.62), smoothstep(0.17, 0.05, length(a - vec2(0.0, -0.10))) * 0.6);

    vec3 mc = mix(wing, vec3(0.18, 0.08, 0.22), edge * 0.55);
    col = mix(col, mc, wingA);
    alpha = mix(alpha, 0.97, wingA);
    col = mix(col, fur, bodyA);
    alpha = mix(alpha, 0.98, bodyA);
    col = mix(col, vec3(0.30, 0.22, 0.28), ant);
    alpha = mix(alpha, 0.95, ant);
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
