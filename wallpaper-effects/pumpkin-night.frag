// label: Pumpkin night
// hint: Halloween: a huge low orange moon, a dead tree, bats that swerve around the pointer and a row of glowing jack-o-lanterns in the fog
// category: Seasons and festivals
#version 440
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec2 imgSize;
  vec4 cBg;
  vec4 cBlue;
  vec4 cMagenta;
  vec4 cPink;
  vec4 cCream;
  vec4 cTarget;
  float react;
  float range;
  float zoom;
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
float pkn_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float pkn_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 pkn_h22(vec2 p) { return vec2(pkn_h2(p), pkn_h2(p + vec2(37.2, 91.7))); }
float pkn_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pkn_h2(i), pkn_h2(i + vec2(1, 0)), f.x), mix(pkn_h2(i + vec2(0, 1)), pkn_h2(i + vec2(1, 1)), f.x), f.y);
}
float pkn_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * pkn_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float pkn_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float pkn_seg(vec2 p, vec2 a, vec2 b, float w0, float w1) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float w = mix(w0, w1, h);
  return smoothstep(w, w * 0.6, length(pa - ba * h));
}

// a jack-o-lantern: x right, y down, in units of its radius. returns shade in .x (0 = not pumpkin), face cutout in .y
vec2 pkn_pumpkin(vec2 q) {
  float body = 0.0;
  float sh = 0.0;
  // three ribs: a wide centre lobe and two side lobes
  float e0 = length(vec2(q.x / 0.78, q.y / 0.86));
  float e1 = length(vec2((q.x - 0.46) / 0.62, q.y / 0.84));
  float e2 = length(vec2((q.x + 0.46) / 0.62, q.y / 0.84));
  float e = min(e0, min(e1, e2));
  body = smoothstep(1.0, 0.96, e);
  float rib = max(smoothstep(0.80, 1.0, e0) * 0.0, 0.0);
  sh = 0.55 + 0.45 * (1.0 - clamp(length(q - vec2(-0.25, -0.3)) / 1.3, 0.0, 1.0));
  sh *= 0.78 + 0.22 * smoothstep(0.0, 0.18, abs(e1 - e0) + 0.10) * smoothstep(0.0, 0.18, abs(e2 - e0) + 0.10);
  // stem
  float stem = step(abs(q.x - 0.05 - 0.1 * q.y), 0.11 + 0.05 * (q.y + 0.96)) * step(-1.12, q.y) * step(q.y, -0.74);
  body = max(body, stem);
  // face
  vec2 el = vec2(abs(q.x) - 0.36, q.y + 0.18);                       // eyes: two triangles pointing up
  float eye = step(el.y, 0.22) * step(-0.20, el.y) * step(abs(el.x), (0.22 - el.y) * 0.62);
  float nose = step(abs(q.x), (q.y + 0.04 - 0.0) * 0.0 + 0.10 * (1.0 - (q.y - 0.10) * 3.0)) * step(0.10, q.y) * step(q.y, 0.30) * 0.0;
  float mx = abs(q.x);
  float zig = abs(fract(q.x * 2.6) - 0.5) * 0.34;
  float mouth = step(mx, 0.64) * step(0.30 + zig * 0.7, q.y) * step(q.y, 0.72 - zig * 1.0);
  float face = max(eye, mouth);
  return vec2(body * (stem > 0.5 && e > 1.0 ? 0.45 : sh), face * body);
}

vec4 pkn_bat(vec2 p, vec2 c, float size, float ph) {
  vec2 l = (p - c) / size;
  float aw = abs(l.x);
  float fl = sin(ph) * 0.8 + 0.1;
  float top = -(0.05 + 0.55 * aw) * fl - 0.10 * aw;
  float bot = 0.10 * aw + 0.20 * pow(abs(sin(aw * 7.0 + 0.8)), 0.7) * smoothstep(0.1, 0.5, aw) + 0.04;
  float wing = step(0.12, aw) * step(aw, 1.15 - 0.15 * fl) * step(top, l.y) * step(l.y, bot + 0.0);
  float tip = smoothstep(1.2, 0.2, aw);
  float body = step(length(vec2(l.x * 2.6, (l.y - 0.02) * 1.2)), 0.30) + step(length(vec2((abs(l.x) - 0.07) * 4.0, (l.y + 0.26) * 2.2)), 0.14);
  return vec4(0.0, 0.0, 0.0, clamp(wing * 0.95 + body, 0.0, 1.0));
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  float t = time;
  vec3 base = wall(uv);

  // night sky: black-violet overhead, bruised purple toward the horizon
  float sk = smoothstep(0.0, 0.8, uv.y);
  vec3 sky = mix(vec3(0.030, 0.015, 0.065), vec3(0.26, 0.09, 0.26), pow(sk, 1.5));
  vec3 col = mix(base * vec3(0.38, 0.22, 0.50), sky, 0.82);
  float stp = pkn_h2(floor(p * 260.0));
  col += vec3(1.0, 0.9, 0.8) * step(0.9985, stp) * (1.0 - sk) * 0.5;

  // a huge low orange moon
  vec2 moonC = vec2(0.64 * asp, 0.40);
  float R = 0.17;
  float dm = length(p - moonC);
  col += vec3(0.90, 0.40, 0.10) * (exp(-dm * dm / (2.0 * 0.20 * 0.20)) * 0.30 + exp(-dm * dm / (2.0 * 0.45 * 0.45)) * 0.12);
  vec2 mq = (p - moonC) / R;
  float maria = pkn_fbm(mq * 1.6 + 2.0) * 0.6 + pkn_fbm(mq * 4.0 + 5.0) * 0.4;
  vec3 disc = mix(vec3(1.0, 0.72, 0.30), vec3(0.85, 0.42, 0.14), smoothstep(0.42, 0.7, maria) * 0.7);
  disc *= 0.84 + 0.16 * sqrt(max(1.0 - dot(mq, mq), 0.0));
  col = mix(col, disc, smoothstep(R, R * 0.985, dm));

  // thin drifting clouds across the moon
  float cl = pkn_fbm(vec2(p.x * 2.5 - t * 0.015, p.y * 14.0 + 3.0));
  col = mix(col, vec3(0.12, 0.05, 0.16), smoothstep(0.52, 0.72, cl) * 0.55 * exp(-pow((uv.y - 0.38) / 0.22, 2.0)));

  // the distant hill and a crooked dead tree
  float hy = 0.70 + 0.04 * pkn_n(vec2(p.x * 2.2 + 3.0, 1.0));
  col = mix(col, vec3(0.06, 0.02, 0.09), smoothstep(hy - 0.002, hy + 0.002, uv.y));
  float tr = 0.0;
  vec2 tb = vec2(0.22 * asp, 0.78);
  tr = max(tr, pkn_seg(p, tb, tb + vec2(0.01, -0.28), 0.020, 0.010));
  tr = max(tr, pkn_seg(p, tb + vec2(0.01, -0.28), tb + vec2(-0.10, -0.44), 0.010, 0.004));
  tr = max(tr, pkn_seg(p, tb + vec2(0.01, -0.28), tb + vec2(0.13, -0.46), 0.010, 0.004));
  tr = max(tr, pkn_seg(p, tb + vec2(0.005, -0.20), tb + vec2(-0.12, -0.30), 0.008, 0.003));
  tr = max(tr, pkn_seg(p, tb + vec2(0.005, -0.16), tb + vec2(0.14, -0.27), 0.008, 0.003));
  tr = max(tr, pkn_seg(p, tb + vec2(-0.10, -0.44), tb + vec2(-0.17, -0.47), 0.004, 0.0015));
  tr = max(tr, pkn_seg(p, tb + vec2(-0.10, -0.44), tb + vec2(-0.12, -0.54), 0.004, 0.0015));
  tr = max(tr, pkn_seg(p, tb + vec2(0.13, -0.46), tb + vec2(0.20, -0.44), 0.004, 0.0015));
  tr = max(tr, pkn_seg(p, tb + vec2(0.13, -0.46), tb + vec2(0.11, -0.56), 0.004, 0.0015));
  tr = max(tr, pkn_seg(p, tb + vec2(-0.12, -0.30), tb + vec2(-0.20, -0.29), 0.003, 0.001));
  tr = max(tr, pkn_seg(p, tb + vec2(0.14, -0.27), tb + vec2(0.22, -0.30), 0.003, 0.001));
  col = mix(col, vec3(0.02, 0.008, 0.035), tr);

  // bats: three of them cross the sky; they swerve away from the pointer
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float sp = 0.020 + 0.006 * fi;
    float ph = fract(t * sp + fi * 0.37);
    vec2 bc = vec2((-0.1 + ph * 1.25) * asp, 0.12 + 0.12 * fi + 0.05 * sin(t * 0.7 + fi * 2.0) + 0.03 * sin(ph * 40.0));
    vec2 away = bc - mp;
    float da = length(away);
    bc += normalize(away + 0.001) * 0.16 * exp(-da * da / 0.05);
    vec4 b = pkn_bat(p, bc, 0.050 + 0.010 * fi, t * (7.0 + fi * 1.3) + fi);
    col = mix(col, vec3(0.01, 0.0, 0.02), b.a);
  }

  // ground, fog, and a row of pumpkins
  float gy = 0.86 + 0.02 * pkn_n(vec2(p.x * 3.0, 4.0));
  col = mix(col, vec3(0.04, 0.02, 0.06), smoothstep(gy - 0.002, gy + 0.002, uv.y));
  float fog = pkn_fbm(vec2(p.x * 2.2 - t * 0.02, uv.y * 9.0 + 4.0));
  float fogMask = exp(-pow((uv.y - 0.86) / 0.07, 2.0));
  col = mix(col, vec3(0.30, 0.18, 0.38), smoothstep(0.35, 0.8, fog) * fogMask * 0.55);

  vec3 glowAcc = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float cx = (0.12 + 0.19 * fi + 0.03 * sin(fi * 3.1)) * asp * (i == 4 ? 0.98 : 1.0);
    float r = 0.050 + 0.040 * pkn_h(fi * 5.3 + 1.0) + (i == 2 ? 0.02 : 0.0);
    vec2 c = vec2(cx * 0.95 + 0.03, 0.915 + 0.06 * pkn_h(fi + 2.0) - r * 0.35);
    float near = exp(-pow(length(vec2(c.x, c.y) - mp) / 0.30, 2.0));
    float flick = 0.80 + 0.20 * sin(t * (5.0 + fi) + fi * 3.0) * sin(t * 2.3 + fi) + 0.12 * near;
    float dq = length(p - c);
    glowAcc += vec3(1.0, 0.50, 0.12) * exp(-dq * dq / (2.0 * r * r * 6.0)) * 0.20 * flick * (1.0 + 0.8 * near);
    vec2 pq = (p - c) / r;
    if (abs(pq.x) < 1.6 && pq.y > -1.3 && pq.y < 1.2) {
      vec2 pk = pkn_pumpkin(pq);
      vec3 skin = mix(vec3(0.30, 0.08, 0.02), vec3(0.86, 0.38, 0.06), pk.x) * (0.50 + 0.5 * flick);
      vec3 inner = mix(vec3(1.0, 0.62, 0.10), vec3(1.0, 0.95, 0.50), 0.55 * flick) * (1.1 + 0.5 * near);
      vec3 pc = mix(skin, inner, step(0.5, pk.y));
      col = mix(col, pc, step(0.01, pk.x));
    }
  }
  col += glowAcc;

  col *= 1.0 - 0.36 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
  return vec4(col, 1.0) * qt_Opacity;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored, above 1 = exaggerated (extrapolated from the no-pointer look)
void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
