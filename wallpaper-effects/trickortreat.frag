// label: Trick or treat
// hint: a haunted Halloween night laid over your picture: moonlight with a few drifting clouds, low fog that parts around the pointer, painted ghosts that wander, leave a faint trail and shy away from the pointer, bats crossing in flocks, floating candles, a lantern that swings when you brush it, glowing jack-o'-lanterns and a black cat at the bottom edge, a spider on its thread, will-o'-the-wisps that gather round the pointer, rising embers and a few sweets tumbling down. Your picture stays
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
layout(binding = 2) uniform sampler2D sprites; // trickortreat.png: 4 x 4 cells of 256 px: 0-2 ghosts, 3 jack-o'-lantern, 4 pail, 5 candy corn, 6 wrapped sweet, 7 lollipop, 8-9 bat (wings out / raised), 10 candle, 11 spider, 12 black cat, 13 hanging lantern, 14 wisp, 15 moon

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
float tt_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float tt_h2(vec2 v) { return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }
float tt_n(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tt_h2(i), tt_h2(i + vec2(1.0, 0.0)), f.x), mix(tt_h2(i + vec2(0.0, 1.0)), tt_h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float tt_fbm(vec2 x) { return (0.5 * tt_n(x) + 0.25 * tt_n(x * 2.03 + 7.1) + 0.125 * tt_n(x * 4.1 + 3.7)) / 0.875; }

// sample one sprite cell; q in -1..1 across the cell
vec4 tt_cell(float cell, vec2 q) {
  vec2 cuv = (vec2(mod(cell, 4.0), floor(cell / 4.0)) + 0.5 + q * 0.453) / vec2(4.0, 4.0);
  return texture(sprites, cuv);
}
// a sprite centred at c with half-size r, rotated by rot, mirrored when flip < 0; returns the straight-alpha texel or 0
vec4 tt_spr(float cell, vec2 p, vec2 c, float r, float rot, float flip) {
  vec2 d = p - c;
  if (dot(d, d) > r * r * 2.0) return vec4(0.0);
  float cs = cos(rot), sn = sin(rot);
  vec2 q = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y) / r;
  q.x *= flip;
  if (abs(q.x) >= 1.0 || abs(q.y) >= 1.0) return vec4(0.0);
  return tt_cell(cell, q);
}
float tt_emis(vec4 s) {
  float lum = dot(s.rgb, vec3(0.299, 0.587, 0.114));
  return smoothstep(0.55, 0.90, lum) * smoothstep(0.10, 0.45, s.r - s.b);
}
float tt_glow(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }

// jack-o'-lanterns and pails on the bottom edge: x (screen fraction), y, size, cell
vec4 tt_jack(int i) {
  if (i == 0) return vec4(0.060, 0.955, 0.215, 3.0);
  if (i == 1) return vec4(0.290, 0.985, 0.130, 3.0);
  if (i == 2) return vec4(0.640, 0.975, 0.150, 3.0);
  if (i == 3) return vec4(0.965, 0.955, 0.200, 3.0);
  if (i == 4) return vec4(0.170, 0.985, 0.105, 4.0);
  return vec4(0.520, 0.990, 0.095, 4.0);
}
vec2 tt_candle(int i, float t) {
  float fi = float(i);
  vec2 b = i == 0 ? vec2(0.285, 0.165) : (i == 1 ? vec2(0.385, 0.090) : vec2(0.215, 0.085));
  return b + vec2(0.012 * sin(t * 0.7 + fi * 2.0), 0.018 * sin(t * 1.1 + fi * 1.7));
}
vec2 tt_gpos(int i, float t, float asp) {
  float fi = float(i);
  vec2 b = i == 0 ? vec2(0.11, 0.60) : (i == 1 ? vec2(0.40, 0.40) : (i == 2 ? vec2(0.66, 0.64) : vec2(0.90, 0.50)));
  b.x *= asp;
  vec2 a = vec2((0.05 + 0.03 * tt_h(fi + 3.0)) * asp, 0.07 + 0.04 * tt_h(fi + 5.0));
  return b + a * vec2(sin(t * (0.13 + 0.035 * fi) + fi * 2.1), sin(t * (0.19 + 0.03 * fi) + fi * 1.3 + 1.0));
}
vec2 tt_bat(int i, float t, float asp, out float flapSeed, out float dir, out float size) {
  int g = i / 3; int m = i - g * 3;
  float fg = float(g), fm = float(m);
  float period = 19.0 + 11.0 * fract(fg * 0.7 + 0.3);
  float life = fract((t - fm * 0.8) / period + fg * 0.37);
  dir = g == 0 ? 1.0 : -1.0;
  float x = mix(-0.14, asp + 0.14, dir > 0.0 ? life : 1.0 - life);
  float y = (g == 0 ? 0.20 : 0.46) + 0.10 * sin(life * 14.0 + fg * 2.0 + fm) + 0.045 * sin(life * 33.0 + fm * 2.0) + 0.03 * fm;
  flapSeed = fm * 2.0 + fg;
  size = g == 0 ? 0.050 : 0.068;
  return vec2(x, y);
}
vec2 tt_wisp(int i, float t, float asp) {
  float fi = float(i);
  vec2 b = vec2((0.2 + 0.3 * fi) * asp, 0.62 + 0.10 * fi);
  return b + vec2(0.16 * asp * sin(t * (0.10 + 0.03 * fi) + fi * 2.6), 0.07 * sin(t * (0.23 + 0.04 * fi) + fi));
}

vec4 fxMain(vec2 mpx) {
  float asp = res.x / res.y;
  vec2 uv = qt_TexCoord0;
  vec2 p = vec2(uv.x * asp, uv.y);
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? vec2(mpx.x / res.y, mpx.y / res.y) : vec2(-10.0);
  vec2 par = has ? (vec2(mpx.x / res.x, mpx.y / res.y) - vec2(0.5, 0.5)) : vec2(0.0);
  float t = time;
  vec3 col = wall(uv);

  // dusk wash toward the corners; the middle of the picture is left alone
  float vig = smoothstep(0.50, 1.15, length((uv - 0.5) * vec2(asp, 1.0)));
  col = mix(col, col * vec3(0.78, 0.66, 0.92) + vec3(0.025, 0.0, 0.05), 0.34 * vig);

  // ---- light sources: jack-o'-lanterns, pails, candles, the lantern ----
  float lanternA = 0.07 * sin(t * 1.1);
  vec2 lanternAnchor = vec2(0.60 * asp, -0.02);
  float lanternLen = 0.27;
  if (has) {
    vec2 lb = lanternAnchor + lanternLen * vec2(sin(lanternA), cos(lanternA));
    vec2 dl = lb - mp;
    lanternA += (dl.x >= 0.0 ? 1.0 : -1.0) * 0.40 * exp(-pow(length(dl) / 0.22, 2.0));
  }
  vec2 lanternPos = lanternAnchor + lanternLen * vec2(sin(lanternA), cos(lanternA));
  float lflick = 0.85 + 0.15 * sin(t * 6.3) * sin(t * 3.1) + 0.05 * sin(t * 13.0);
  vec3 light = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    vec4 j = tt_jack(i);
    vec2 jc = vec2(j.x * asp, j.y - j.z * 0.12);
    float see = exp(-pow(length(jc - mp) / (0.55 + j.z), 2.0));
    float fl = 0.80 + 0.20 * sin(t * (5.0 + float(i) * 0.9) + float(i) * 2.0) * sin(t * 2.3 + float(i)) + 0.05 * sin(t * 11.0 + float(i) * 4.0);
    light += vec3(1.0, 0.46, 0.10) * tt_glow(p, jc, j.z * 1.6) * 0.42 * fl * (0.7 + 0.8 * see) * (j.w > 3.5 ? 0.6 : 1.0);
  }
  for (int i = 0; i < 3; i++) light += vec3(1.0, 0.62, 0.22) * tt_glow(p, tt_candle(i, t) - vec2(0.0, 0.02), 0.11) * 0.30 * (0.8 + 0.2 * sin(t * (7.0 + float(i)) + float(i) * 3.0));
  light += vec3(1.0, 0.55, 0.18) * tt_glow(p, lanternPos, 0.20) * 0.38 * lflick;
  col = col * (1.0 + light * 0.55) + light * vec3(0.22, 0.10, 0.03);

  // ---- moon with a halo, faint rays and a passing cloud ----
  vec2 moonC = vec2(0.90 * asp, 0.14) - par * 0.012;
  vec2 dm = p - moonC;
  float dmoon = length(dm);
  float ang = atan(dm.y, dm.x);
  float rays = pow(0.5 + 0.5 * sin(ang * 11.0 + tt_fbm(vec2(ang * 3.0, t * 0.05)) * 6.0 + t * 0.05), 4.0);
  col += vec3(0.30, 0.36, 0.58) * (exp(-dmoon * dmoon / 0.06) * 0.30 + exp(-dmoon / 0.35) * rays * 0.10);
  vec4 ms = tt_spr(15.0, p, moonC, 0.095, 0.0, 1.0);
  if (ms.a > 0.0) {
    float cl = smoothstep(0.58, 0.85, tt_fbm(vec2(p.x * 2.2 - t * 0.05, p.y * 5.0 + 3.0)));
    col = mix(col, ms.rgb * (1.0 - 0.55 * cl) + vec3(0.04, 0.05, 0.09), ms.a * 0.95);
  }

  // ---- back fog bank: parts around the pointer, lit by the pumpkins ----
  float dens = smoothstep(0.30, 0.72, tt_fbm(p * vec2(1.25, 2.4) + vec2(t * 0.03, 0.0)));
  dens *= smoothstep(0.42, 0.95, uv.y);
  float d2 = tt_fbm(p * vec2(0.9, 1.8) + vec2(-t * 0.02, 9.0));
  float dens2 = smoothstep(0.55, 0.85, d2) * smoothstep(0.15, 0.40, uv.y) * smoothstep(0.80, 0.55, uv.y) * 0.45;
  float wake = 1.0 - 0.85 * tt_glow(p, mp, 0.15);
  vec3 fogc = mix(vec3(0.18, 0.13, 0.30), vec3(0.60, 0.54, 0.80), tt_fbm(p * 3.0 + t * 0.02));
  col = mix(col, fogc + light * vec3(1.0, 0.62, 0.30) * 0.9, clamp((dens * 0.85 + dens2 * 0.50) * wake, 0.0, 0.85));

  // ---- will-o'-the-wisps: wander, gather near the pointer ----
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      float tj = t - float(j) * 0.22;
      vec2 wp = tt_wisp(i, tj, asp);
      if (has) {
        vec2 dw = wp - mp;
        float dd = length(dw);
        vec2 target = mp + dw / (dd + 0.001) * 0.13 + vec2(0.02 * sin(tj * 2.1 + float(i)), 0.02 * cos(tj * 1.7 + float(i)));
        wp = mix(wp, target, 0.85 * smoothstep(0.7, 0.25, dd));
      }
      float rr = 0.080 - 0.012 * float(j);
      float fadeJ = j == 0 ? 1.0 : (j == 1 ? 0.45 : 0.20);
      col += vec3(0.20, 0.75, 0.70) * tt_glow(p, wp, rr * 2.2) * 0.16 * fadeJ;
      vec4 s = tt_spr(14.0, p, wp, rr, 0.12 * sin(tj * 2.0 + float(i)), 1.0);
      col = mix(col, s.rgb * 1.08 + vec3(0.0, 0.05, 0.05), s.a * fadeJ * 0.9);
    }
  }

  // ---- sweets tumbling down; the pointer scatters them ----
  for (int k = 0; k < 12; k++) {
    float fk = float(k);
    float spd = 0.030 + 0.030 * tt_h(fk + 2.0);
    float ph = t * spd + tt_h(fk * 5.3);
    float seed = floor(ph) + fk * 17.0;
    float life = fract(ph);
    float cx = (0.04 + 0.92 * tt_h(seed + 1.0)) * asp;
    vec2 o = vec2(cx + 0.03 * sin(life * 7.0 + fk * 1.9), -0.05 + life * 1.1);
    vec2 dmv = o - mp;
    float dl = length(dmv);
    o += dmv / (dl + 0.04) * 0.09 * exp(-pow(dl / 0.20, 2.0));
    float s = 0.030 + 0.016 * tt_h(seed + 4.0);
    float rot = t * (0.5 + tt_h(seed + 6.0)) * (tt_h(seed + 7.0) > 0.5 ? 1.0 : -1.0) + tt_h(seed + 8.0) * 6.28;
    float fade = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.92, life);
    float kind = tt_h(seed + 9.0);
    vec4 sp = tt_spr(kind < 0.4 ? 5.0 : (kind < 0.75 ? 6.0 : 7.0), p, o, s, rot, 1.0);
    col = mix(col, sp.rgb, sp.a * fade);
  }

  // ---- ghosts: wander in slow loops, leave a faint trail, drift away from the pointer ----
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float h = i == 3 ? 0.14 : 0.17 + 0.07 * fract(fi * 0.7 + 0.2);
    float r = h * 0.56;
    for (int j = 2; j >= 0; j--) {
      float tj = t - float(j) * 0.30;
      vec2 gp = tt_gpos(i, tj, asp);
      vec2 vel = tt_gpos(i, tj + 0.2, asp) - gp;
      vec2 dg = gp - mp;
      float dist = length(dg);
      float push = exp(-pow(dist / (0.20 + h * 0.8), 2.0));
      float see = exp(-pow(dist / (0.55 + h), 2.0));
      gp += dg / (dist + 0.04) * push * (0.04 + h * 0.8);
      gp.y -= push * h * 0.25 * (0.6 + 0.4 * sin(t * 6.0 + fi));
      float tilt = clamp(vel.x * 25.0, -0.3, 0.3) + (dg.x >= 0.0 ? 1.0 : -1.0) * 0.35 * push;
      float flip = vel.x > 0.0 ? 1.0 : -1.0;
      float fadeJ = j == 0 ? 0.93 : (j == 1 ? 0.30 : 0.13);
      if (j == 0) col += vec3(0.45, 0.50, 0.95) * tt_glow(p, gp, h * 0.85) * 0.16 * (0.7 + 0.5 * see);
      vec2 gq = gp + vec2(0.0, 0.012 * sin(t * 1.3 + fi));
      vec4 s = tt_spr(mod(fi, 3.0), p, gq, r, tilt, flip);
      vec3 gc = s.rgb * (0.92 + 0.10 * see) + vec3(0.10, 0.12, 0.25) * 0.4;
      gc = mix(gc, gc * vec3(1.0, 0.88, 0.76) + light * 0.5, clamp(length(light), 0.0, 0.5));
      col = mix(col, gc, s.a * fadeJ);
    }
  }

  // ---- bats crossing in flocks; they veer away from the pointer ----
  for (int i = 0; i < 6; i++) {
    float fs, dir, sz;
    vec2 bp = tt_bat(i, t, asp, fs, dir, sz);
    vec2 db = bp - mp;
    float dist = length(db);
    bp += db / (dist + 0.04) * 0.20 * exp(-pow(dist / 0.20, 2.0));
    float flapUp = sin(t * 11.0 + fs * 2.3);
    vec4 s = tt_spr(flapUp > 0.0 ? 8.0 : 9.0, p, bp, sz, 0.18 * cos(t * 3.0 + fs) * dir, dir);
    vec3 bc = s.rgb * 0.95 + vec3(0.05, 0.03, 0.08);
    col = mix(col, bc, s.a * 0.95);
  }

  // ---- floating candles ----
  for (int i = 0; i < 3; i++) {
    vec2 cp = tt_candle(i, t);
    vec4 s = tt_spr(10.0, p, cp, 0.058, 0.05 * sin(t * 0.9 + float(i)), 1.0);
    float em = tt_emis(s);
    vec3 cc = s.rgb * (0.85 + 0.20 * lflick) + vec3(1.0, 0.7, 0.3) * em * 0.35 * lflick;
    col = mix(col, cc, s.a);
  }

  // ---- hanging lantern on its rope ----
  {
    vec2 ba = lanternPos - lanternAnchor;
    float L = length(ba);
    vec2 u = ba / L;
    vec2 ap = p - lanternAnchor;
    float along = dot(ap, u);
    float perp = abs(dot(ap, vec2(-u.y, u.x)));
    if (along > 0.0 && along < L - 0.045 && perp < 0.0014) col = mix(col, vec3(0.10, 0.07, 0.06), 0.9);
    vec4 s = tt_spr(13.0, p, lanternPos + u * 0.015, 0.078, -lanternA, 1.0);
    float em = tt_emis(s);
    vec3 lc = s.rgb * (0.85 + 0.2 * lflick) + vec3(1.0, 0.65, 0.25) * em * 0.45 * lflick;
    col = mix(col, lc, s.a);
  }

  // ---- jack-o'-lanterns and pails: flare when the pointer is near ----
  for (int i = 0; i < 6; i++) {
    vec4 j = tt_jack(i);
    float fi = float(i);
    vec2 jc = vec2(j.x * asp, j.y);
    vec2 dj = jc - mp;
    float dist = length(dj);
    float push = exp(-pow(dist / (0.12 + j.z), 2.0));
    float see = exp(-pow(dist / (0.55 + j.z), 2.0));
    float fl = 0.82 + 0.18 * sin(t * (5.0 + fi * 0.9) + fi * 2.0) * sin(t * 2.3 + fi) + 0.05 * sin(t * 11.0 + fi * 4.0);
    float tilt = 0.04 * sin(t * 1.2 + fi * 2.0) - (dj.x >= 0.0 ? 1.0 : -1.0) * 0.12 * push;
    vec4 s = tt_spr(j.w, p, jc + vec2(0.0, -push * j.z * 0.06 * abs(sin(t * 7.0 + fi))), j.z * 0.56, tilt, mod(fi, 2.0) < 0.5 ? 1.0 : -1.0);
    float em = tt_emis(s);
    vec3 jcol = s.rgb * (0.82 + 0.12 * fl) * (1.0 + 0.45 * see + 0.30 * push);
    jcol += vec3(1.0, 0.62, 0.20) * em * (0.25 + 0.55 * see + 0.30 * push) * fl;
    col = mix(col, jcol, s.a);
  }

  // ---- black cat on the bottom edge: turns toward the pointer, eyes glint ----
  {
    vec2 cc = vec2(0.79 * asp, 0.945);
    float face = (has && mp.x > cc.x) ? -1.0 : 1.0;
    vec4 s = tt_spr(12.0, p, cc, 0.150, 0.0, face);
    float eyes = smoothstep(0.55, 0.9, s.g) * smoothstep(0.35, 0.05, s.b) * (0.5 + 0.5 * sin(t * 0.7) * sin(t * 0.7));
    vec3 ccol = s.rgb * 0.95 + vec3(0.8, 0.9, 0.2) * eyes * 0.5;
    col = mix(col, ccol, s.a);
    col += vec3(0.9, 0.9, 0.2) * eyes * s.a * 0.25;
  }

  // ---- spider on a thread: drops and climbs, scurries up when the pointer comes near ----
  {
    float sx = 0.035 * asp;
    float sy = 0.09 + 0.10 * (0.5 + 0.5 * sin(t * 0.45));
    float dsp = length(vec2(sx, sy) - mp);
    sy *= 1.0 - 0.85 * exp(-pow(dsp / 0.30, 2.0));
    vec2 sc = vec2(sx + 0.004 * sin(t * 1.3), sy);
    if (abs(p.x - sc.x) < 0.0012 && p.y < sc.y - 0.02) col = mix(col, vec3(0.75, 0.75, 0.85), 0.5);
    vec4 s = tt_spr(11.0, p, sc, 0.045, 0.25 * sin(t * 1.3), 1.0);
    col = mix(col, s.rgb, s.a);
  }

  // ---- front fog, thin and quick; the pointer parts it ----
  float f2 = smoothstep(0.42, 0.80, tt_fbm(p * vec2(1.6, 3.5) + vec2(t * 0.06, 4.0)));
  f2 *= smoothstep(0.82, 1.02, uv.y);
  col = mix(col, vec3(0.50, 0.46, 0.68) + light * 0.5, clamp(f2 * 0.60 * wake, 0.0, 0.6));

  // ---- embers rising from the pumpkins ----
  for (int k = 0; k < 18; k++) {
    float fk = float(k);
    float ph = t * (0.05 + 0.04 * tt_h(fk + 11.0)) + tt_h(fk * 3.7);
    float seed = floor(ph) + fk * 13.0;
    float life = fract(ph);
    vec4 j = tt_jack(int(mod(fk, 4.0)));
    vec2 o = vec2(j.x * asp + (tt_h(seed + 2.0) - 0.5) * 0.12 + 0.03 * sin(life * 9.0 + fk), j.y - 0.04 - life * (0.35 + 0.3 * tt_h(seed + 3.0)));
    float d = length(p - o);
    if (d < 0.02) col += vec3(1.0, 0.55, 0.15) * exp(-d * d / (0.0025 * 0.0025)) * smoothstep(0.0, 0.1, life) * smoothstep(1.0, 0.4, life) * 0.9;
  }
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
