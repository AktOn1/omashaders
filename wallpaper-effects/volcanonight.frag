// label: Volcano night
// hint: a volcano against a starry night, glowing lava streams on its flanks, an ash plume lit from below with faint lightning inside, all mirrored in a dark lake; embers rise from the crater and curve toward the pointer
// category: Wild weather
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
float vo_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vo_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vo_hash(i), vo_hash(i + vec2(1, 0)), f.x), mix(vo_hash(i + vec2(0, 1)), vo_hash(i + vec2(1, 1)), f.x), f.y);
}
float vo_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vo_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float vo_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * vo_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float vo_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
const float VO_WL = 0.72;
const float VO_CY = 0.36;

// the whole mountain scene (sky, stars, plume, hills, cone, lava) as seen at p; the lake samples it mirrored
vec3 vo_scene(vec2 p, float asp, float t) {
  float cx = asp * 0.56;
  vec2 cp = vec2(cx, VO_CY);
  float y = p.y;
  // lightning clock: a double flicker every 8 s, somewhere inside the plume
  float cyc = floor(t / 8.0 + 0.4);
  float ph = fract(t / 8.0 + 0.4);
  float fl = exp(-pow((ph - 0.03) / 0.010, 2.0)) + 0.7 * exp(-pow((ph - 0.085) / 0.016, 2.0));
  float fh = 0.07 + 0.16 * vo_hash(vec2(cyc, 1.0));
  vec2 fpos = vec2(cp.x + 0.30 * fh + (vo_hash(vec2(cyc, 2.0)) - 0.5) * 0.14, cp.y - fh);

  // sky
  vec3 col = mix(vec3(0.012, 0.016, 0.055), vec3(0.085, 0.040, 0.095), smoothstep(0.0, VO_WL, y));
  vec2 dgl = (p - cp) * vec2(1.0, 0.8);
  col += vec3(0.30, 0.06, 0.02) * exp(-dot(dgl, dgl) / 0.12) * 0.55;
  col += vec3(0.20, 0.04, 0.02) * exp(-pow((y - VO_WL) / 0.18, 2.0)) * 0.55;
  // stars
  vec2 sc = floor(vec2(p.x, y) * 110.0);
  float sr = vo_hash(sc);
  vec2 sf = fract(vec2(p.x, y) * 110.0) - 0.5 - (vec2(vo_hash(sc + 3.0), vo_hash(sc + 8.0)) - 0.5) * 0.5;
  float star = step(0.955, sr) * smoothstep(0.14, 0.0, length(sf)) * (1.0 - smoothstep(0.2, 0.75, y));
  col += vec3(0.85, 0.88, 1.0) * star * (0.45 + 0.55 * sin(t * 1.1 + sr * 50.0)) * 0.9 * (1.0 - exp(-dot(dgl, dgl) / 0.06) * 0.8);

  // ash plume: lit from below by the lava, leaning with the wind, billowing wider as it climbs
  float h = cp.y - y;
  if (h > 0.0) {
    float shift = 0.55 * h + 0.03 * sin(h * 9.0 - t * 0.25);
    float wP = 0.06 + 0.72 * pow(h, 0.72);
    float dx = (p.x - cp.x - shift) / wP;
    vec2 q = vec2(dx * 1.5 + 5.0, h * 3.4 - t * 0.10);
    float n = vo_fbm(q + vo_fbm3(q * 0.7 + 3.0) * 1.3);
    float thr = 0.20 + 0.22 * pow(abs(dx), 1.5);
    float dens = smoothstep(thr, thr + 0.30, n) * (1.0 - smoothstep(0.75, 1.15, abs(dx))) * smoothstep(0.0, 0.05, h) * (1.0 - smoothstep(0.30, 0.46, h));
    float lowLit = exp(-h * 3.8) * (0.30 + 0.9 * n);
    vec3 ash = mix(vec3(0.075, 0.055, 0.070), vec3(0.28, 0.07, 0.03), exp(-h * 2.6) * 0.6) * (0.55 + 0.8 * n);
    ash += vec3(1.0, 0.36, 0.08) * lowLit * 0.80;
    ash += vec3(0.70, 0.24, 0.09) * smoothstep(0.62, 0.34, n) * exp(-h * 3.0) * 0.45;    // glowing underside of the billows
    // lightning inside the cloud
    vec2 df = (p - fpos) * vec2(1.0, 1.3);
    float inner = exp(-dot(df, df) / 0.012);
    float boltY = (y - (fpos.y - 0.05)) / 0.10;
    float bx = fpos.x + (vo_noise(vec2(clamp(boltY, 0.0, 1.0) * 14.0, cyc)) - 0.5) * 0.05 + (vo_noise(vec2(clamp(boltY, 0.0, 1.0) * 40.0, cyc + 5.0)) - 0.5) * 0.012;
    float bolt = exp(-pow((p.x - bx) / 0.0020, 2.0)) * step(0.0, boltY) * step(boltY, 1.0) * step(ph, 0.06);
    ash = mix(ash, vec3(0.55, 0.62, 1.0) * (0.45 + 0.7 * n), clamp(fl * inner * 0.42, 0.0, 0.55));
    ash += vec3(0.80, 0.86, 1.0) * bolt * fl * 0.45;
    col = mix(col, ash, clamp(dens, 0.0, 1.0) * 0.96);
  }

  // distant dark hills on both sides
  float hill = VO_WL - 0.045 - 0.05 * vo_fbm3(vec2(p.x * 2.6, 2.0)) - 0.02 * smoothstep(0.9, 1.9, abs(p.x - cx));
  float hm = smoothstep(0.0, 0.0025, y - hill);
  vec3 hillC = vec3(0.012, 0.012, 0.028) + vec3(0.12, 0.025, 0.012) * exp(-pow((p.x - cx) / 0.9, 2.0)) * smoothstep(hill - 0.01, hill + 0.03, y) * 0.8;
  col = mix(col, hillC, hm);

  // the cone
  float dy = y - VO_CY;
  float wd = 0.024 + 1.30 * pow(max(dy, 0.0), 1.18);
  wd *= 1.0 + 0.10 * (vo_noise(vec2(y * 28.0, 1.0)) - 0.5) + 0.06 * (vo_noise(vec2(y * 7.0, 5.0)) - 0.5);
  float rim = VO_CY + 0.006 * vo_noise(vec2(p.x * 90.0, 2.0)) - 0.012 * exp(-pow((p.x - cx) / 0.016, 2.0));   // the crater notch
  float s = (p.x - cx) / max(wd, 0.001);
  float cone = step(abs(s), 1.0) * smoothstep(0.0, 0.003, y - rim) * step(y, VO_WL + 0.01);
  if (cone > 0.0) {
    float fac = vo_fbm3(vec2(s * 5.0 + 3.0, dy * 9.0));
    vec3 rock = vec3(0.040, 0.030, 0.050) * (0.55 + 1.3 * fac) + vec3(0.02, 0.025, 0.05) * smoothstep(0.55, 0.3, abs(s)) * 0.8;
    // lava rivulets down the flank
    float lava = 0.0, blur = 0.0;
    for (int k = 0; k < 5; k++) {
      float kf = float(k);
      float hk = vo_hash(vec2(kf, 9.0));
      float s0 = -0.78 + 0.39 * kf + 0.14 * (hk - 0.5);
      float sc2 = s0 + 0.10 * sin(dy * (18.0 + 6.0 * hk) + kf * 5.0) + 0.06 * (vo_noise(vec2(dy * 14.0, kf)) - 0.5);
      float lenK = 0.20 + 0.26 * vo_hash(vec2(kf, 3.0));
      float on = smoothstep(0.0, 0.012, dy) * (1.0 - smoothstep(lenK * 0.7, lenK * 1.05, dy));
      float wk = 0.012 + 0.030 * smoothstep(0.0, lenK, dy);
      float msk = exp(-pow((s - sc2) / wk, 2.0));
      float pulse = 0.60 + 0.40 * sin(dy * 48.0 - t * 1.3 + kf * 2.1);
      float cool = 1.0 - 0.6 * smoothstep(0.0, lenK, dy);
      lava += msk * on * pulse * (0.55 + 0.6 * cool);
      blur += exp(-pow((s - sc2) / (wk * 5.0), 2.0)) * on * 0.5;
    }
    lava = clamp(lava, 0.0, 1.3);
    rock += vec3(0.50, 0.11, 0.03) * clamp(blur, 0.0, 1.0) * (0.35 + fac) * 0.55;          // flanks glow around the streams
    vec3 lc = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.42, 0.05), clamp(lava, 0.0, 1.0));
    lc = mix(lc, vec3(1.0, 0.86, 0.45), smoothstep(0.85, 1.25, lava));
    rock = mix(rock, lc, clamp(lava, 0.0, 1.0));
    rock += vec3(1.0, 0.5, 0.15) * exp(-pow(dy / 0.03, 2.0)) * exp(-pow(s / 0.45, 2.0)) * 0.55;     // the crater lip glows
    rock *= 0.8 + 0.2 * smoothstep(0.0, 0.25, dy);
    col = mix(col, rock, cone);
  }
  // glow of the crater itself
  vec2 dc = (p - cp) * vec2(1.0, 1.2);
  col += vec3(1.0, 0.45, 0.10) * (exp(-dot(dc, dc) / 0.0007) * 0.9 + exp(-dot(dc, dc) / 0.012) * 0.28);
  return col;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);
  float pl = vo_luma(pic);
  float cx = asp * 0.56;
  vec2 cp = vec2(cx, VO_CY);

  vec3 col;
  if (uv.y < VO_WL) {
    col = vo_scene(p, asp, t);
  } else {
    // ---- the lake: the scene mirrored, broken up by ripples that grow toward the viewer
    float dd = uv.y - VO_WL;
    float wob = (vo_noise(vec2(uv.y * 90.0, t * 0.5)) - 0.5) * 0.010 + (vo_noise(vec2(uv.y * 25.0 + 3.0, t * 0.25)) - 0.5) * 0.014;
    vec2 rp = vec2(p.x + wob * (0.4 + 3.0 * dd), VO_WL - dd * 0.80);
    vec3 refl = vo_scene(rp, asp, t);
    float band = 0.70 + 0.55 * vo_noise(vec2(p.x * 28.0 + t * 0.15, dd * 140.0));
    vec3 water = vec3(0.006, 0.008, 0.020) + vec3(0.02, 0.012, 0.03) * (1.0 - dd * 2.0);
    col = mix(water, refl * 0.80 * band, 0.90);
    col += vec3(1.0, 0.40, 0.08) * 0.05 * exp(-pow((p.x - cx) / 0.18, 2.0)) * exp(-dd * 9.0) * band;
    float glit = pow(vo_noise(vec2(p.x * 22.0 + t * 0.3, dd * 230.0 - t * 0.5)), 3.0);
    col += vec3(1.0, 0.45, 0.10) * glit * exp(-pow((p.x - cx - 0.03) / (0.025 + dd * 0.35), 2.0)) * exp(-dd * 3.5) * 0.9;
    // the near shore: a dark bank with a warm rim
    float bank = 0.955 + 0.020 * vo_fbm3(vec2(p.x * 5.0, 7.0)) - 0.04 * exp(-pow((p.x - 0.12 * asp) / 0.25, 2.0));
    float bm = smoothstep(0.0, 0.004, uv.y - bank);
    col = mix(col, vec3(0.006, 0.005, 0.010) + vec3(0.18, 0.05, 0.02) * exp(-(uv.y - bank) / 0.004) * 0.35, bm);
    col = mix(col, vec3(0.04, 0.02, 0.03), smoothstep(0.012, 0.0, abs(uv.y - VO_WL)) * 0.25);
  }

  // ---- embers: lift off the crater and curve toward the pointer
  vec3 emb = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float hi = vo_hash(vec2(fi, 4.0));
    float spd = 0.06 + 0.04 * hi;
    float cyc = floor(t * spd + hi * 9.0);
    float phs = fract(t * spd + hi * 9.0);
    float r1 = vo_hash(vec2(fi + 0.1, cyc)), r2 = vo_hash(vec2(fi + 0.2, cyc + 3.0)), r3 = vo_hash(vec2(fi + 0.3, cyc + 6.0));
    vec2 st = cp + vec2((r1 - 0.5) * 0.04, 0.0);
    vec2 en = st + vec2(0.04 + 0.30 * r2, -(0.18 + 0.30 * r3));
    if (onScr) en = mix(en, mp + (vec2(r1, r2) - 0.5) * 0.05, 0.85);
    for (int k = 0; k < 3; k++) {
      float ph2 = clamp(phs - float(k) * 0.018, 0.0, 1.0);
      float ez = 1.0 - (1.0 - ph2) * (1.0 - ph2);                              // fast at first, slowing as it cools
      vec2 pos = mix(st, en, vec2(mix(ph2, ez, 0.35), ez)) + vec2(sin(ph2 * 11.0 + fi) * 0.012 * ph2, 0.0);
      float dl = length(p - pos);
      float sz = 0.0040 - float(k) * 0.0009;
      float fade = smoothstep(0.0, 0.05, ph2) * (1.0 - smoothstep(0.55, 1.0, ph2));
      float fk = 0.35 + 0.65 * (1.0 - float(k) * 0.4);
      float tw = 0.75 + 0.25 * sin(t * 9.0 + fi * 3.0);
      emb += mix(vec3(1.0, 0.80, 0.35), vec3(0.95, 0.20, 0.03), ph2) * (exp(-dl * dl / (sz * sz)) + 0.12 * exp(-dl * dl / (sz * sz * 30.0))) * fade * fk * tw;
    }
  }
  col += emb * 1.1;

  col *= 0.95 + 0.07 * pl;
  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
