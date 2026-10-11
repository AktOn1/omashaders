// label: Haunted manor
// hint: a gothic manor on a hill under a cloudy moon, one warm window flickering, ground fog rolling, bats crossing the moon now and then and far lightning lighting the clouds; the pointer parts the fog and brightens the window
// category: Dark tales
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
float hm_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hm_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hm_hash(i), hm_hash(i + vec2(1, 0)), f.x), mix(hm_hash(i + vec2(0, 1)), hm_hash(i + vec2(1, 1)), f.x), f.y);
}
float hm_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * hm_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float hm_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * hm_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float hm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// ---- shape helpers (masks, 1 inside)
float hm_box(vec2 p, vec2 c, vec2 h, float aa) {
  vec2 d = abs(p - c) - h;
  return smoothstep(aa, -aa, max(d.x, d.y));
}
float hm_tri(vec2 p, float cx, float apex, float base, float hw, float aa) {
  float t = clamp((p.y - apex) / (base - apex), 0.0, 1.0);
  return smoothstep(aa, -aa, abs(p.x - cx) - hw * t) * smoothstep(aa, -aa, max(apex - p.y, p.y - base));
}
float hm_arch(vec2 p, vec2 c, vec2 h, float aa) {            // pointed-top window: a box with a round cap
  float b = hm_box(p, c, h, aa);
  float cap = smoothstep(aa, -aa, length(p - (c - vec2(0.0, h.y))) - h.x);
  return max(b, cap);
}
// a bat: q in units of half wingspan, flap -1..1
float hm_bat(vec2 q, float flap, float aa) {
  float ax = abs(q.x);
  float yc = 0.20 * ax - 0.55 * flap * ax * ax;
  float dy = q.y - yc;
  float tt = 0.11 * (1.0 - ax) + 0.025;
  float tb = 0.36 * (1.0 - ax * 0.78) * (0.62 + 0.38 * abs(cos(ax * 8.6)));
  float wing = smoothstep(-tt - aa, -tt + aa, dy) * smoothstep(tb + aa, tb - aa, dy) * smoothstep(1.0 + aa, 1.0 - aa, ax);
  float body = smoothstep(aa, -aa, length(q * vec2(1.0, 0.5) - vec2(0.0, 0.02)) - 0.095);
  float head = smoothstep(aa, -aa, length(q - vec2(0.0, -0.17)) - 0.07);
  float ears = smoothstep(aa, -aa, abs(q.x) - 0.075 * clamp((q.y + 0.14) / 0.10, 0.0, 1.0)) * step(-0.28, q.y) * step(q.y, -0.14) * 0.0;
  return clamp(max(wing, max(body, head)) + ears, 0.0, 1.0);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  float aa = 1.5 / res.y;
  vec3 pic = wall(uv);
  float pl = hm_luma(pic);

  // ---- layout
  vec2 moonP = vec2(0.50 * asp, 0.27);
  float moonR = 0.058;
  float cx = 0.335 * asp;                                       // the manor's axis
  vec2 winP = vec2(cx + 0.028, 0.560);                          // the warm window

  // ---- the pointer: how close it is to the window brightens it; it also pushes the fog aside
  float winNear = hasM ? exp(-distance(mp, vec2(cx, 0.625) + (winP - vec2(cx, 0.625)) * 1.28) / 0.30) : 0.0;
  vec2 dmv = p - mp;
  float dmd = length(dmv);
  vec2 push = hasM ? dmv / max(dmd, 0.001) * 0.10 * exp(-dmd / 0.20) : vec2(0.0);
  float part = hasM ? exp(-dmd * dmd / 0.030) : 0.0;

  // ---- lightning, far away: one every ~9 s, a double pulse that only lights the clouds
  float ph = fract(t / 9.0 + 0.21);
  float flash = exp(-abs(ph - 0.020) * 75.0) * 0.9 + exp(-abs(ph - 0.075) * 50.0) * 0.55;
  flash *= step(ph, 0.18);
  float fx = asp * (0.08 + 0.34 * hm_hash(vec2(floor(t / 9.0 + 0.21), 5.0)));
  float fy = 0.12 + 0.18 * hm_hash(vec2(floor(t / 9.0 + 0.21), 8.0));

  // ---- sky: blue-black at the top, a cold teal haze toward the horizon
  float up = clamp(uv.y / 0.70, 0.0, 1.0);
  vec3 skyTop = vec3(0.008, 0.020, 0.040);
  vec3 skyLow = vec3(0.105, 0.180, 0.205);
  vec3 sky = mix(skyTop, skyLow, pow(up, 1.7));

  // clouds: a drifting deck, lit silver along the edges that face the moon
  vec2 cq = vec2(p.x * 1.5 + t * 0.012, p.y * 3.0);
  vec2 cwarp = vec2(hm_fbm3(cq * 0.7 + t * 0.006), hm_fbm3(cq * 0.7 + 9.0 - t * 0.004));
  float dens = hm_fbm(cq + cwarp * 1.2);
  vec2 toMoon = normalize(moonP - p + vec2(0.0001));
  vec2 cq2 = vec2((p.x + toMoon.x * 0.03) * 1.5 + t * 0.012, (p.y + toMoon.y * 0.03) * 3.0);
  float dens2 = hm_fbm(cq2 + cwarp * 1.2);
  float thick = smoothstep(0.40, 0.70, dens);
  float edge = clamp((dens - dens2) * 5.0 + 0.1, 0.0, 1.0) * thick;
  float mprox = exp(-distance(p, moonP) / 0.55);
  vec3 cloudBody = mix(vec3(0.020, 0.040, 0.055), vec3(0.085, 0.135, 0.155), smoothstep(0.35, 0.75, dens) * (0.5 + 0.7 * up));
  cloudBody += vec3(0.55, 0.72, 0.78) * edge * (0.25 + mprox) * 0.80;
  cloudBody += vec3(0.04, 0.07, 0.08) * mprox * thick;
  // lightning inside the clouds
  float lg = exp(-pow(distance(p * vec2(0.7, 1.2), vec2(fx, fy) * vec2(0.7, 1.2)) / 0.50, 2.0));
  cloudBody += vec3(0.60, 0.68, 1.00) * flash * lg * (0.30 + 1.10 * smoothstep(0.30, 0.75, dens));
  vec3 skyHit = sky + vec3(0.14, 0.18, 0.34) * flash * (0.35 * lg + 0.12);

  // the moon, veiled by whatever cloud is in front of it
  float dm = distance(p, moonP);
  float clear = 1.0 - 0.80 * thick;
  vec2 mq = (p - moonP) / moonR;
  float disc = smoothstep(moonR, moonR - 0.003, dm);
  float mare = 0.80 + 0.22 * hm_fbm3(mq * 2.6 + 3.0);
  vec3 moonC = vec3(0.86, 0.94, 0.95) * mare;
  vec3 col = skyHit;
  col += vec3(0.30, 0.46, 0.52) * exp(-dm / 0.10) * 0.45 * (0.35 + 0.65 * clear);
  col += vec3(0.12, 0.20, 0.24) * exp(-dm / 0.40) * 0.55;
  col = mix(col, cloudBody, thick * 0.92);
  col = mix(col, moonC * (0.55 + 0.45 * clear), disc * (0.30 + 0.70 * clear));
  // the picture shows faintly through the sky
  col += pic * 0.10 * (1.0 - 0.7 * thick) * smoothstep(0.80, 0.30, uv.y);

  // ---- bats, three of them, crossing in front of the moon every ~16 s
  {
    float bk = fract(t / 16.0);
    float prog0 = (bk - 0.04) / 0.44;
    float batMask = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float prog = prog0 - fi * 0.045;
      if (prog > 0.0 && prog < 1.0) {
        float bx = mix(0.12 * asp, 1.12 * asp, prog);
        float by = 0.255 + 0.045 * sin(prog * 5.0 + fi * 1.7) - 0.012 * fi + 0.010 * sin(t * 2.2 + fi * 2.0);
        float sz = 0.031 - 0.004 * fi;
        float flap = sin(t * (9.0 + fi) + fi * 1.9);
        vec2 q = (p - vec2(bx, by)) / sz;
        q.y += 0.15 * flap * 0.5;
        batMask = max(batMask, hm_bat(q, flap, aa / sz));
      }
    }
    col = mix(col, vec3(0.006, 0.010, 0.014), batMask * 0.95);
  }

  // ---- the land: a far ridge, then the manor's hill
  float farTop = 0.655 + 0.030 * sin(p.x * 3.1 + 1.0) + 0.022 * hm_noise(vec2(p.x * 5.0, 2.0)) - 0.04 * smoothstep(0.9 * asp, asp, p.x);
  vec3 farC = mix(vec3(0.050, 0.092, 0.108), vec3(0.030, 0.060, 0.072), smoothstep(0.64, 0.80, uv.y));
  farC += vec3(0.05, 0.08, 0.09) * exp(-distance(vec2(p.x, 0.0), vec2(moonP.x, 0.0)) / 0.5) * 0.4;
  col = mix(col, farC, smoothstep(aa, -aa, farTop - uv.y) * 0.0 + smoothstep(-aa, aa, uv.y - farTop));

  float hx = (p.x - cx) / 0.40;
  float hillTop = 0.665 - 0.078 * exp(-hx * hx) + 0.010 * (hm_noise(vec2(p.x * 9.0, 4.0)) - 0.5) - 0.02 * smoothstep(0.95 * asp, asp, p.x);
  vec3 darkC = vec3(0.010, 0.016, 0.021);
  float hill = smoothstep(-aa, aa, uv.y - hillTop);
  // a cool rim where the hill meets the sky
  float rim = smoothstep(0.012, 0.0, abs(uv.y - hillTop)) * smoothstep(0.7, 1.4, p.x / asp * 2.0 + 0.3) * 0.0;
  col = mix(col, darkC + vec3(0.02, 0.035, 0.040) * smoothstep(0.30, 0.0, abs(uv.y - hillTop - 0.01)), hill);

  // ---- the manor
  vec2 mb = vec2(cx, 0.625);
  float MS = 1.28;
  vec2 pm = mb + (p - mb) / MS;
  float aam = aa / MS;
  float body = hm_box(pm, vec2(cx, 0.565), vec2(0.142, 0.056), aam);
  float gableA = hm_tri(pm, cx - 0.040, 0.425, 0.512, 0.098, aam);
  float gableB = hm_tri(pm, cx - 0.118, 0.468, 0.512, 0.040, aam);
  float gableC = hm_tri(pm, cx + 0.050, 0.475, 0.512, 0.036, aam);
  float towerR = hm_box(pm, vec2(cx + 0.103, 0.488), vec2(0.024, 0.116), aam);
  float spireR = hm_tri(pm, cx + 0.103, 0.292, 0.372, 0.036, aam);
  float capR = hm_box(pm, vec2(cx + 0.103, 0.372), vec2(0.030, 0.004), aam);
  float towerL = hm_box(pm, vec2(cx - 0.132, 0.505), vec2(0.020, 0.100), aam);
  float spireL = hm_tri(pm, cx - 0.132, 0.350, 0.405, 0.026, aam);
  float chim1 = hm_box(pm, vec2(cx + 0.012, 0.438), vec2(0.007, 0.024), aam);
  float chim2 = hm_box(pm, vec2(cx - 0.094, 0.452), vec2(0.006, 0.020), aam);
  float fin1 = hm_box(pm, vec2(cx + 0.103, 0.282), vec2(0.0009, 0.016), aam);
  float fin2 = hm_box(pm, vec2(cx - 0.132, 0.334), vec2(0.0009, 0.015), aam);
  float sil = max(max(max(body, gableA), max(gableB, gableC)), max(max(towerR, spireR), max(capR, max(towerL, spireL))));
  sil = max(sil, max(max(chim1, chim2), max(fin1, fin2)));
  col = mix(col, darkC, sil);

  // windows: pale panes catch a little moon, one lit from inside
  float panes = 0.0;
  panes = max(panes, hm_arch(pm, vec2(cx - 0.100, 0.560), vec2(0.0075, 0.016), aam));
  panes = max(panes, hm_arch(pm, vec2(cx - 0.060, 0.560), vec2(0.0075, 0.016), aam));
  panes = max(panes, hm_arch(pm, vec2(cx - 0.012, 0.560), vec2(0.0075, 0.016), aam));
  panes = max(panes, hm_arch(pm, vec2(cx + 0.070, 0.560), vec2(0.0075, 0.016), aam));
  panes = max(panes, hm_arch(pm, vec2(cx - 0.060, 0.492), vec2(0.006, 0.013), aam));
  panes = max(panes, hm_arch(pm, vec2(cx - 0.100, 0.492), vec2(0.006, 0.013), aam));
  panes = max(panes, hm_arch(pm, vec2(cx + 0.103, 0.440), vec2(0.0065, 0.016), aam));
  panes = max(panes, hm_arch(pm, vec2(cx - 0.132, 0.470), vec2(0.005, 0.014), aam));
  col = mix(col, vec3(0.030, 0.052, 0.062) + vec3(0.03, 0.05, 0.06) * clear * mprox, panes * sil * 0.85);

  // the warm window: a candle that never quite settles, and sometimes sinks nearly out
  float fl = 0.80 + 0.20 * sin(t * 7.3) * sin(t * 3.1 + 1.0) + 0.14 * (hm_noise(vec2(t * 9.0, 1.0)) - 0.5);
  fl *= 0.70 + 0.30 * smoothstep(0.1, 0.5, hm_noise(vec2(t * 0.6, 7.0)));
  float wlit = clamp(fl + 0.55 * winNear, 0.0, 1.5);
  float wpane = hm_arch(pm, winP, vec2(0.0105, 0.021), aam);
  float mull = max(hm_box(pm, winP + vec2(0.0, 0.004), vec2(0.0010, 0.025), aam), hm_box(pm, winP + vec2(0.0, 0.006), vec2(0.011, 0.0009), aam));
  vec3 warm = vec3(1.0, 0.66, 0.28);
  col = mix(col, warm * (0.55 + 0.55 * wlit), wpane * (1.0 - 0.80 * mull));
  // the second, dim window in the tower breathes more slowly
  float w2 = 0.35 + 0.35 * hm_noise(vec2(t * 0.8, 3.0)) + 0.4 * winNear;
  col = mix(col, warm * w2 * 0.8, hm_arch(pm, vec2(cx + 0.103, 0.440), vec2(0.0045, 0.012), aam) * 0.8);
  // the light spilling out into the night
  vec2 winW = mb + (winP - mb) * MS;
  vec2 wd = (p - winW) * vec2(1.0, 1.1);
  float wglow = exp(-dot(wd, wd) / 0.0018) * 0.55 + exp(-dot(wd, wd) / 0.020) * 0.16;
  col += warm * wglow * wlit * 0.55;

  // ---- fog: a bank lying round the foot of the hill, rolling slowly sideways, parted by the pointer
  float fyA = smoothstep(0.585, 0.70, uv.y) * (1.0 - 0.45 * smoothstep(0.78, 0.98, uv.y));
  vec2 fqA = vec2(p.x * 1.3 - t * 0.030, p.y * 5.5) + push * 3.0;
  float fnA = hm_fbm(fqA + vec2(0.0, 2.0) + 1.5 * hm_fbm3(fqA * 0.6 + t * 0.01));
  float fogA = smoothstep(0.34, 0.72, fnA) * fyA * (1.0 - 0.85 * part);
  vec3 fogCol = mix(vec3(0.20, 0.31, 0.34), vec3(0.70, 0.82, 0.84), clamp(exp(-abs(p.x - moonP.x) / 0.65) * 0.60 + 0.25 * fnA, 0.0, 1.0));
  fogCol += warm * wglow * wlit * 0.9;
  fogCol *= 0.80 + 0.40 * pl;
  col = mix(col, fogCol, clamp(fogA * 0.95, 0.0, 0.90));
  // thin wisps that climb the hill
  float wisp = smoothstep(0.50, 0.85, hm_fbm3(vec2(p.x * 2.4 - t * 0.05, p.y * 9.0 + t * 0.02) + push * 4.0)) * smoothstep(0.52, 0.64, uv.y) * smoothstep(0.80, 0.66, uv.y) * (1.0 - 0.9 * part);
  col = mix(col, fogCol * 0.9, wisp * 0.25);

  // ---- the foreground: an iron fence and a few headstones, black against the pale fog
  vec3 blackC = vec3(0.004, 0.007, 0.009);
  {
    float cell = 0.0245;
    float id = floor(p.x / cell);
    float fxl = (fract(p.x / cell) - 0.5) * cell;
    float top = 0.835 + 0.005 * hm_hash(vec2(id, 1.0));
    float wbar = 0.0022 * clamp((uv.y - top) / 0.016, 0.0, 1.0) * (1.0 + 0.9 * exp(-pow((uv.y - top - 0.020) / 0.006, 2.0)));
    float bar = smoothstep(aa, -aa, abs(fxl) - wbar) * step(top, uv.y);
    float rail = max(hm_box(vec2(p.x, uv.y), vec2(1.0, 0.880), vec2(10.0, 0.0035), aa), hm_box(vec2(p.x, uv.y), vec2(1.0, 0.955), vec2(10.0, 0.0035), aa));
    float fence = max(bar, rail * step(top - 0.02, 0.88)) * smoothstep(0.58 * asp, 0.40 * asp, p.x);
    col = mix(col, blackC, fence * 0.96);
    // headstones on the right
    float stones = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float sx = asp * (0.655 + 0.085 * fi) + 0.02 * hm_hash(vec2(fi, 3.0));
      float sh = 0.075 + 0.03 * hm_hash(vec2(fi, 6.0));
      float sw = 0.020 + 0.006 * hm_hash(vec2(fi, 9.0));
      vec2 sp = p - vec2(sx, 1.0);
      float ang = (hm_hash(vec2(fi, 12.0)) - 0.5) * 0.14;
      sp = vec2(cos(ang) * sp.x - sin(ang) * sp.y, sin(ang) * sp.x + cos(ang) * sp.y);
      float slab = hm_box(sp, vec2(0.0, -sh * 0.5 + 0.02), vec2(sw, sh * 0.5), aa);
      float cap = smoothstep(aa, -aa, length(sp - vec2(0.0, -sh + 0.02)) - sw);
      float stn = max(slab, cap);
      if (i == 2) {                                               // one is a cross
        float cr = max(hm_box(sp, vec2(0.0, -sh * 0.55 + 0.02), vec2(0.0035, sh * 0.55), aa), hm_box(sp, vec2(0.0, -sh * 0.8 + 0.02), vec2(0.016, 0.0035), aa));
        stn = cr;
      }
      stones = max(stones, stn);
    }
    col = mix(col, blackC, stones * 0.96 * smoothstep(0.80, 0.90, uv.y + 0.18));
  }
  // low front mist drifting over the foreground
  float fyB = smoothstep(0.80, 0.97, uv.y);
  float fnB = hm_fbm3(vec2(p.x * 1.1 + t * 0.055, p.y * 4.0 + 5.0) + push * 2.0);
  float fogB = smoothstep(0.30, 0.75, fnB) * fyB * (1.0 - 0.85 * part);
  col = mix(col, mix(fogCol, vec3(0.30, 0.42, 0.45), 0.4) * 0.8, fogB * 0.55);

  // vignette
  col *= 1.0 - 0.42 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
