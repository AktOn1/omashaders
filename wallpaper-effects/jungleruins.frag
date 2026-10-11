// label: Jungle ruins
// hint: overgrown stone steps and a half-buried carved face in a jungle clearing, sun shafts through the leaves, drifting mist, swaying vines and butterflies that flutter toward the pointer
// category: Ancient worlds
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
float jr_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float jr_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(jr_hash(i), jr_hash(i + vec2(1, 0)), f.x), mix(jr_hash(i + vec2(0, 1)), jr_hash(i + vec2(1, 1)), f.x), f.y);
}
float jr_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * jr_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float jr_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * jr_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float jr_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// carved face height field, q in head units (x right, y down)
float jr_face(vec2 q) {
  vec2 e = vec2(q.x / 0.92, q.y);
  float dome = sqrt(max(1.0 - dot(e, e), 0.0));
  float h = dome * 0.8;
  h += 0.10 * exp(-pow((q.y + 0.26) / 0.07, 2.0)) * smoothstep(0.85, 0.30, abs(q.x));
  vec2 ee = vec2(abs(q.x) - 0.36, q.y + 0.10);
  h -= 0.17 * exp(-(ee.x * ee.x / 0.012 + ee.y * ee.y / 0.004));
  h += 0.16 * exp(-(q.x * q.x / 0.015)) * smoothstep(-0.2, 0.05, q.y) * smoothstep(0.38, 0.20, q.y);
  h += 0.07 * exp(-(pow(abs(q.x) - 0.14, 2.0) / 0.004 + pow(q.y - 0.26, 2.0) / 0.006));
  h -= 0.13 * exp(-pow((q.y - 0.52) / 0.035, 2.0)) * smoothstep(0.50, 0.28, abs(q.x));
  h += 0.06 * exp(-pow((q.y - 0.44) / 0.06, 2.0)) * smoothstep(0.5, 0.2, abs(q.x));
  h += 0.05 * exp(-(pow(abs(q.x) - 0.5, 2.0) / 0.03 + pow(q.y - 0.2, 2.0) / 0.05));
  h += 0.05 * smoothstep(0.03, 0.0, abs(q.y + 0.58));
  return h;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  // light shafts: diagonal beams from the upper right, broken up by drifting leaf shadow
  vec2 bo = p - vec2(asp * 0.95, -0.15);
  vec2 bd = normalize(vec2(-0.42, 1.0));
  float along = dot(bo, bd);
  float perp = dot(bo, vec2(bd.y, -bd.x));
  float shaft = smoothstep(0.46, 0.76, 0.62 * jr_noise(vec2(perp * 6.0, 1.0)) + 0.38 * jr_noise(vec2(perp * 17.0, 5.0)));
  shaft *= smoothstep(0.05, 0.30, along) * exp(-along * 0.35) * 1.5;
  shaft *= 0.65 + 0.35 * sin(t * 0.45 + perp * 6.0 + jr_fbm3(vec2(p.x * 2.0, t * 0.05)) * 4.0);
  float shaftL = clamp(shaft, 0.0, 1.0);

  // ---- back wall of the jungle: hazy and green, brighter around the clearing
  float glow = exp(-dot((p - vec2(0.55 * asp, 0.46)) * vec2(0.8, 1.0), (p - vec2(0.55 * asp, 0.46)) * vec2(0.8, 1.0)) / 0.30);
  vec3 col = mix(vec3(0.04, 0.10, 0.08), vec3(0.20, 0.34, 0.22), smoothstep(1.0, 0.1, uv.y) * 0.8);
  col += vec3(0.62, 0.72, 0.40) * glow * 0.40 + vec3(1.0, 0.85, 0.5) * shaftL * 0.10;
  float lf = jr_fbm(p * vec2(3.0, 3.6) + vec2(3.0, t * 0.01));
  float lf2 = jr_fbm(p * vec2(9.0, 10.0) + 20.0);
  col *= 0.42 + 0.95 * smoothstep(0.28, 0.74, lf) * (0.75 + 0.5 * lf2);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float tx = asp * (0.06 + 0.31 * fi) + 0.05 * jr_hash(vec2(fi, 2.0));
    float tw = 0.016 + 0.026 * jr_hash(vec2(fi, 7.0));
    float dxT = abs(p.x - tx - 0.01 * sin(p.y * 4.0 + fi * 3.0));
    float trunk = smoothstep(tw, tw * 0.55, dxT);
    float lit = smoothstep(tw, -tw, p.x - tx - 0.01 * sin(p.y * 4.0 + fi * 3.0));
    col = mix(col, vec3(0.03, 0.05, 0.04) + vec3(0.30, 0.34, 0.14) * lit * 0.4 * (0.4 + shaftL), trunk * 0.9 * smoothstep(0.0, 0.06, uv.y + 0.1));
  }

  // ---- long ruined wall with a doorway, then the stairs climbing to it
  float cxs = 0.34 * asp;
  {
    float topY = 0.33 + 0.045 * jr_fbm3(vec2(p.x * 5.0, 7.0)) + 0.030 * jr_noise(vec2(p.x * 31.0, 1.0)) + 0.05 * smoothstep(0.30, 0.0, abs(p.x - cxs) - 0.16) * -1.0 + 0.05 * smoothstep(0.34, 0.14, abs(p.x - cxs)) * 0.0;
    float botY = 0.50;
    float wallM = smoothstep(topY - 0.003, topY + 0.003, uv.y) * step(uv.y, botY);
    vec2 bq = vec2(p.x * 16.0 + floor(uv.y * 13.0) * 0.5, uv.y * 13.0);
    float blocks = 0.80 + 0.36 * jr_hash(floor(bq));
    float joint = smoothstep(0.03, 0.10, fract(bq.x)) * smoothstep(0.03, 0.10, fract(bq.y));
    vec3 wc = vec3(0.40, 0.40, 0.32) * blocks * (0.55 + 0.45 * joint);
    float mossW = smoothstep(0.42, 0.74, jr_fbm(p * vec2(7.0, 11.0) + 4.0) + (0.34 - uv.y) * 1.6 * -1.0 * 0.0 + smoothstep(topY + 0.06, topY, uv.y) * 0.45);
    wc = mix(wc, vec3(0.16, 0.32, 0.09), clamp(mossW, 0.0, 0.85));
    wc += vec3(1.0, 0.82, 0.45) * shaftL * 0.42 * blocks;
    wc *= 0.70 + 0.30 * smoothstep(botY, topY, uv.y) ;
    float door = step(abs(p.x - cxs), 0.060) * smoothstep(0.372, 0.376, uv.y) * step(uv.y, botY);
    float lintel = step(abs(p.x - cxs), 0.085) * step(0.352, uv.y) * step(uv.y, 0.376);
    wc = mix(wc, vec3(0.20, 0.20, 0.16) * (0.7 + 0.5 * blocks) + vec3(1.0, 0.82, 0.45) * shaftL * 0.2, lintel);
    wc = mix(wc, vec3(0.01, 0.025, 0.02) + vec3(0.12, 0.2, 0.1) * smoothstep(0.50, 0.40, uv.y), door);
    col = mix(col, wc, wallM);
  }
  if (uv.y > 0.495) {
    float df = uv.y - 0.50;
    vec3 fl = mix(vec3(0.20, 0.30, 0.13), vec3(0.06, 0.12, 0.07), smoothstep(0.0, 0.40, df));
    fl *= 0.70 + 0.65 * smoothstep(0.30, 0.75, jr_fbm(p * vec2(6.0, 14.0) + 5.0));
    fl += vec3(1.0, 0.84, 0.46) * shaftL * 0.30;
    fl *= 0.55 + 0.45 * smoothstep(0.0, 0.03, df);                         // contact shadow under the wall
    col = mix(col, fl, smoothstep(0.495, 0.502, uv.y));
  }
  float ys = uv.y - 0.50;
  if (ys > 0.0) {
    float hwS = 0.075 + 0.36 * ys + 0.014 * (jr_noise(vec2(p.y * 30.0, 3.0)) - 0.5);
    float dxS = p.x - cxs;
    float inside = smoothstep(hwS, hwS - 0.010, abs(dxS));
    float z = 0.30 / (ys + 0.03);
    float fz = fract(z);
    float tread = smoothstep(0.38, 0.46, fz);
    vec3 base = vec3(0.46, 0.44, 0.34) * (0.84 + 0.30 * jr_noise(vec2(p.x * 22.0, floor(z) * 7.0)));
    vec3 riser = base * 0.46;
    vec3 st = mix(riser, base * (0.90 + 0.25 * tread), tread);
    float moss = smoothstep(0.46, 0.72, jr_fbm(p * vec2(7.0, 8.0) + vec2(1.0, 6.0)) + 0.35 * smoothstep(hwS * 0.55, hwS, abs(dxS)) - 0.12 * tread);
    st = mix(st, vec3(0.17, 0.33, 0.10) * (0.7 + 0.6 * tread), clamp(moss, 0.0, 0.80));
    st += vec3(1.0, 0.84, 0.46) * shaftL * (0.22 + 0.50 * tread);
    st *= 0.60 + 0.40 * smoothstep(0.0, 0.06, ys);
    col = mix(col, st, inside);
  }

  // ---- mist lying on the clearing
  float ms = smoothstep(0.40, 0.78, jr_fbm(vec2(p.x * 1.6 - t * 0.018, uv.y * 5.0 + 2.0))) * exp(-pow((uv.y - 0.68) / 0.12, 2.0));
  col = mix(col, vec3(0.74, 0.84, 0.64), clamp(ms * 0.50, 0.0, 0.55));

  col += vec3(1.0, 0.86, 0.52) * shaftL * 0.16 * smoothstep(0.25, 0.55, uv.y) * (0.5 + ms);

  // ---- the half-buried carved face on a mound at the right
  vec2 fc = vec2(0.74 * asp, 0.66);
  float FR = 0.27;
  float groundY = 0.83 + 0.020 * (jr_fbm3(vec2(p.x * 6.0, 2.0)) - 0.5) - 0.030 * exp(-pow((p.x - fc.x) / 0.40, 2.0));
  {
    vec2 q = (p - fc) / FR;
    float eps = 0.012;
    float h0 = jr_face(q);
    vec2 g = vec2(jr_face(q + vec2(eps, 0.0)) - h0, jr_face(q + vec2(0.0, eps)) - h0) / eps;
    vec3 nrm = normalize(vec3(-g.x * 1.3, -g.y * 1.3, 1.0));
    vec3 Ld = normalize(vec3(0.55, -0.60, 0.65));
    float dif = clamp(dot(nrm, Ld), 0.0, 1.0);
    vec2 e = vec2(q.x / 0.92, q.y);
    float fm = smoothstep(1.0, 0.94, length(e));
    float dome = sqrt(max(1.0 - dot(e, e), 0.0)) * 0.8;
    float crev = clamp((dome - h0) * 6.0, 0.0, 1.0);
    vec3 fc3 = vec3(0.52, 0.49, 0.38) * (0.90 + 0.20 * jr_noise(p * 110.0));
    fc3 *= 0.18 + 1.10 * dif;
    float mossF = smoothstep(0.50, 0.80, jr_fbm(q * 4.0 + 9.0) * 0.8 + crev * 0.35 + smoothstep(-0.45, -0.95, q.y) * 0.45 + smoothstep(0.65, 1.0, q.y) * 0.4);
    fc3 = mix(fc3, vec3(0.16, 0.32, 0.09) * (0.45 + 0.9 * dif), clamp(mossF, 0.0, 0.75));
    fc3 += vec3(1.0, 0.84, 0.46) * shaftL * 0.30 * dif + vec3(1.0, 0.72, 0.36) * pow(dif, 3.0) * 0.22;
    fc3 += vec3(0.55, 0.40, 0.18) * 0.20 * smoothstep(0.0, 1.0, dif) * crev * 0.0;
    float buried = smoothstep(groundY + 0.004, groundY - 0.004, uv.y);       // only the part above the ground
    col = mix(col, fc3, fm * buried);
  }
  // ground in front: damp earth, fern and moss, light patches from the shafts
  if (uv.y > groundY - 0.006) {
    float dg = uv.y - groundY;
    vec3 gc = mix(vec3(0.18, 0.27, 0.10), vec3(0.03, 0.07, 0.05), smoothstep(0.0, 0.18, dg));
    gc *= 0.75 + 0.5 * jr_noise(p * vec2(22.0, 30.0));
    gc += vec3(1.0, 0.84, 0.45) * shaftL * 0.20;
    gc += vec3(0.50, 0.65, 0.20) * exp(-dg * 60.0) * 0.20;
    col = mix(col, gc, smoothstep(-0.006, 0.004, dg));
  }

  // ---- canopy at the top: dark leaves, bright holes
  float cov = smoothstep(0.42, 0.0, uv.y) * 1.0 + (jr_fbm(p * vec2(3.2, 4.5) + 11.0) - 0.45) * 1.5 + 0.5 * smoothstep(0.35, 0.0, uv.x) * 0.0;
  float leaf = smoothstep(0.50, 0.62, cov);
  vec3 lc = mix(vec3(0.02, 0.07, 0.04), vec3(0.15, 0.34, 0.09), smoothstep(0.35, 0.8, jr_noise(p * vec2(14.0, 18.0))));
  lc += vec3(0.55, 0.70, 0.15) * smoothstep(0.62, 0.9, jr_noise(p * vec2(30.0, 38.0) + 3.0)) * (0.3 + shaftL) * 0.7;
  lc += vec3(0.90, 0.85, 0.40) * smoothstep(0.62, 0.50, cov) * 0.45 * smoothstep(0.50, 0.62, cov + 0.06) ;
  col = mix(col, lc, leaf);
  col += vec3(1.0, 0.92, 0.62) * (1.0 - leaf) * smoothstep(0.50, 0.30, cov) * smoothstep(0.30, 0.0, uv.y) * 0.5;

  // ---- hanging vines, swaying
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float x0 = asp * (0.05 + 0.90 * jr_hash(vec2(fi, 3.7)));
    float ln = 0.17 + 0.24 * jr_hash(vec2(fi, 5.1));
    if (p.y < ln) {
      float k = p.y / ln;
      float sway = (0.010 + 0.012 * jr_hash(vec2(fi, 9.0))) * sin(t * 0.8 + fi * 1.7 + p.y * 4.0) * k + 0.008 * sin(p.y * 17.0 + fi);
      float dv = abs(p.x - x0 - sway);
      float core = smoothstep(0.0035, 0.0012, dv) * smoothstep(ln, ln - 0.05, p.y);
      float lp = floor(p.y * 38.0);
      float hasLeaf = step(0.55, jr_hash(vec2(lp, fi + 1.0)));
      float side = jr_hash(vec2(lp, fi + 4.0)) > 0.5 ? 1.0 : -1.0;
      float lw = 0.015 * (1.0 - abs(fract(p.y * 38.0) - 0.5) * 2.0);
      float dl = abs((p.x - x0 - sway) * side - 0.009 - lw * 0.5);
      float leafM = smoothstep(lw * 0.5, lw * 0.2, dl) * hasLeaf * smoothstep(ln, ln - 0.04, p.y) * step(0.0, (p.x - x0 - sway) * side);
      vec3 vc = mix(vec3(0.05, 0.14, 0.05), vec3(0.30, 0.52, 0.14), 0.5 * jr_noise(p * 40.0) + 0.4 * shaftL);
      col = mix(col, vc, max(core * 0.9, leafM * 0.9));
    }
  }

  // ---- butterflies that flutter toward the pointer
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ph = fi * 1.618;
    vec2 bp = vec2(asp * (0.22 + 0.55 * fract(ph * 0.7)) + 0.18 * sin(t * 0.13 + ph * 3.0), 0.44 + 0.14 * sin(t * 0.17 + ph * 2.0) + 0.07 * sin(t * 0.31 + ph));
    if (hasM) {
      vec2 tgt = mp + (0.035 + 0.022 * fi) * vec2(cos(t * 1.3 + ph * 2.0 + fi), sin(t * 1.7 + ph * 3.0));
      bp = mix(bp, tgt, 0.72);
    }
    bp += 0.005 * vec2(sin(t * 9.0 + ph), cos(t * 7.0 + ph * 1.3));
    float sz = 0.025 + 0.004 * jr_hash(vec2(fi, 11.0));
    vec2 d = (p - bp) / sz;
    if (abs(d.x) < 2.0 && abs(d.y) < 2.0) {
      float sx = 0.25 + 0.75 * abs(sin(t * 11.0 + ph * 5.0));
      vec2 ad = vec2(abs(d.x), d.y);
      float up = length(vec2((ad.x - 0.55 * sx) / (0.55 * sx + 0.02), (ad.y + 0.35) / 0.55));
      float lo = length(vec2((ad.x - 0.40 * sx) / (0.35 * sx + 0.02), (ad.y - 0.35) / 0.38));
      float wing = max(smoothstep(1.0, 0.8, up), smoothstep(1.0, 0.8, lo));
      float tp = mod(fi, 3.0);
      vec3 wc = tp < 0.5 ? vec3(0.15, 0.55, 1.0) : (tp < 1.5 ? vec3(1.0, 0.55, 0.12) : vec3(1.0, 0.88, 0.25));
      float edge = smoothstep(0.55, 1.0, min(up, max(lo, 0.0)));
      wc = mix(wc, vec3(0.05, 0.04, 0.06), edge * 0.7);
      float body = smoothstep(0.10, 0.04, ad.x) * step(abs(d.y), 0.6);
      col += wc * wing * 0.25 * exp(-dot(d, d) * 0.4);
      col = mix(col, wc * 1.1, wing * 0.95);
      col = mix(col, vec3(0.05, 0.04, 0.04), body);
    }
  }

  // ---- foreground ferns, dark at the corners
  float yF = 1.02 - 0.10 * jr_fbm3(vec2(p.x * 4.0 + 1.0, 5.0)) - 0.34 * smoothstep(asp - 0.30, asp, p.x) * jr_fbm3(vec2(p.x * 3.0, 9.0)) - 0.30 * smoothstep(0.30, 0.0, p.x) * jr_fbm3(vec2(p.x * 4.0 + 6.0, 2.0)) - 0.02 * jr_noise(vec2(p.x * 60.0, 4.0));
  if (uv.y > yF) {
    vec3 fg = vec3(0.015, 0.045, 0.03) + vec3(0.25, 0.40, 0.10) * exp(-(uv.y - yF) * 55.0) * 0.5 * (0.4 + shaftL);
    col = mix(col, fg, smoothstep(0.0, 0.004, uv.y - yF));
  }

  col += (w - jr_luma(w)) * 0.08;
  col *= 0.96 + 0.08 * jr_luma(w);
  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
  fragColor = vec4(col, 1.0) * qt_Opacity;
  return fragColor;
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
