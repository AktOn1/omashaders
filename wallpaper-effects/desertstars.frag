// label: Desert stars
// hint: a dune ridge under a dense Milky Way, a lone bush on the crest, thin sand wisps lifting off it and an occasional shooting star; the wisps lean and drift toward the pointer
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
float ds_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ds_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ds_hash(i), ds_hash(i + vec2(1, 0)), f.x), mix(ds_hash(i + vec2(0, 1)), ds_hash(i + vec2(1, 1)), f.x), f.y);
}
float ds_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ds_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ds_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// three dune crests (uv.y of the ridge at uv.x); the middle one carries the bush
float ds_far(float x)  { return 0.730 + 0.026 * sin(x * 2.7 + 1.9) + 0.010 * sin(x * 6.3 + 0.4); }
float ds_mid(float x)  {
  float u = x - 0.66;
  float mound = exp(-pow(u / (u < 0.0 ? 0.40 : 0.15), 2.0));
  float left = exp(-pow((x - 0.14) / 0.22, 2.0));
  return 0.865 - 0.140 * mound - 0.045 * left + 0.005 * sin(x * 11.0);
}
float ds_near(float x) { return 0.925 + 0.040 * sin(x * 2.0 + 3.4) + 0.016 * sin(x * 5.3 + 1.0); }

// one fine-star layer: a jittered star in every cell
float ds_stars(vec2 p, float scale, float seed, float dens, float t) {
  vec2 q = p * scale;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = ds_hash(id + seed);
  float on = step(1.0 - dens, h);
  vec2 j = vec2(ds_hash(id + seed + 3.1), ds_hash(id + seed + 7.7)) - 0.5;
  vec2 d = f - j * 0.7;
  float br = 0.25 + 0.75 * pow(ds_hash(id + seed + 11.3), 2.0);
  float tw = 0.75 + 0.25 * sin(t * (0.6 + 2.4 * ds_hash(id + seed + 5.0)) + h * 60.0);
  float r2 = dot(d, d);
  return on * br * tw * (exp(-r2 * 90.0) + 0.14 * exp(-r2 * 14.0));
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  float t = time;
  vec3 w = wall(uv);
  float wl = ds_luma(w);

  float cF = ds_far(uv.x), cM = ds_mid(uv.x), cN = ds_near(uv.x);

  // ---- night sky: indigo overhead, a cold teal-violet glow along the horizon
  float up = clamp(uv.y / 0.78, 0.0, 1.0);
  vec3 sky = mix(vec3(0.006, 0.010, 0.040), vec3(0.030, 0.058, 0.130), smoothstep(0.0, 1.0, up));
  sky = mix(sky, vec3(0.085, 0.140, 0.260), pow(up, 5.0) * 0.8);
  sky += vec3(0.05, 0.04, 0.12) * exp(-pow((uv.y - 0.72) / 0.08, 2.0)) * 0.6;

  // ---- the Milky Way: a wide diagonal band with a bright core and dark dust lanes
  vec2 c0 = vec2(0.52 * asp, 0.30);
  vec2 ax = normalize(vec2(1.0, -0.62));
  vec2 nr = vec2(-ax.y, ax.x);
  vec2 rp = p - c0;
  float along = dot(rp, ax), perp = dot(rp, nr);
  perp += 0.035 * sin(along * 5.0 + 1.0) + 0.05 * (ds_fbm(vec2(along * 2.5, 4.0)) - 0.5);
  float band = exp(-perp * perp / 0.030);
  float core = exp(-perp * perp / 0.008) * exp(-pow((along + 0.05) / 0.55, 2.0));
  float cl1 = ds_fbm(vec2(along * 4.0, perp * 9.0) + 3.0);
  float cl2 = ds_fbm(vec2(along * 11.0, perp * 24.0) + 21.0);
  float grain = ds_noise(p * 330.0) * 0.6 + ds_noise(p * 700.0) * 0.4;
  float cloud = (0.40 + 0.8 * cl1 + 0.5 * cl2) * (0.55 + 0.9 * grain);
  float lane = smoothstep(0.50, 0.80, ds_fbm(vec2(along * 5.0 + 9.0, perp * 17.0)));
  float lane2 = smoothstep(0.55, 0.85, ds_fbm(vec2(along * 3.0 - 4.0, perp * 7.0 + 2.0)));
  float dust = 1.0 - 0.62 * lane * smoothstep(0.30, 0.0, abs(perp)) - 0.40 * lane2 * band;
  dust = max(dust, 0.22);
  float mw = (band * 0.55 + core * 0.9) * cloud * dust;
  vec3 mwCol = mix(vec3(0.32, 0.42, 0.70), vec3(0.72, 0.74, 0.92), clamp(core * 1.3, 0.0, 1.0));
  mwCol = mix(mwCol, vec3(0.62, 0.50, 0.66), smoothstep(0.55, 1.0, cl2) * band * 0.45);
  sky += mwCol * mw * 0.50 * smoothstep(0.0, 0.5, uv.y + 0.15);

  // ---- stars: three sizes, denser inside the band
  float bandDens = 1.0 + 3.0 * band * dust;
  float st = ds_stars(p, 95.0, 1.0, 0.16 * bandDens, t) * 1.1
           + ds_stars(p, 52.0, 8.0, 0.12 * bandDens, t) * 1.5
           + ds_stars(p, 21.0, 30.0, 0.05, t) * 1.5;
  vec3 starCol = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.95, 0.88), ds_hash(floor(p * 52.0)));
  float horizonFade = smoothstep(cF + 0.01, cF - 0.20, uv.y);
  sky += starCol * st * horizonFade * (0.9 + 0.6 * smoothstep(0.1, 0.0, abs(perp)));

  // ---- a slow shooting star: one every 13 s, crossing the upper sky for about two seconds
  {
    float cyc = floor(t / 13.0);
    float k = (t - cyc * 13.0) / 2.2;
    if (k < 1.0) {
      float hs = ds_hash(vec2(cyc, 3.3));
      vec2 s0 = vec2((0.15 + 0.70 * ds_hash(vec2(cyc, 1.1))) * asp, 0.08 + 0.18 * hs);
      vec2 dir = normalize(vec2(mix(0.9, 0.55, hs) * (ds_hash(vec2(cyc, 9.1)) > 0.5 ? 1.0 : -1.0), 0.38));
      vec2 hd = s0 + dir * (0.42 * k);
      vec2 tl = hd - dir * (0.13 * sin(k * 3.14159) + 0.01);
      vec2 seg = hd - tl;
      float u = clamp(dot(p - tl, seg) / dot(seg, seg), 0.0, 1.0);
      float dd = length(p - (tl + seg * u));
      float env = sin(k * 3.14159);
      float streak = exp(-dd * dd / (0.000012 + 0.000010 * u)) * pow(u, 1.6) * env;
      float head = exp(-dot(p - hd, p - hd) / 0.00004) * env;
      sky += vec3(0.82, 0.90, 1.0) * (streak * 0.85 + head * 0.7);
    }
  }

  // let the user's picture drift faintly through the night, desaturated so it never fights the blue
  sky += mix(w, vec3(wl), 0.7) * vec3(0.55, 0.70, 1.0) * 0.16;
  vec3 col = sky;

  // ---- dunes: cool blue sand under starlight, windward slopes glow, crests catch a thin rim
  float dFar = uv.y - cF;
  if (dFar > 0.0) {
    float slope = (ds_far(uv.x + 0.004) - ds_far(uv.x - 0.004)) / 0.008;
    vec3 sand = mix(vec3(0.090, 0.140, 0.260), vec3(0.045, 0.072, 0.150), smoothstep(0.0, 0.10, dFar));
    sand += vec3(0.05, 0.08, 0.15) * clamp(-slope * 5.0 + 0.4, 0.0, 1.0) * exp(-dFar * 18.0);
    col = mix(col, sand, smoothstep(0.0, 0.003, dFar));
  }
  float dMid = uv.y - cM;
  if (dMid > 0.0) {
    float sl = (ds_mid(uv.x + 0.10) - ds_mid(uv.x - 0.10)) / 0.20;
    float lit = smoothstep(0.0, 1.0, clamp(0.62 - sl * 2.2, 0.0, 1.0));                        // the gentle windward side catches light
    float rip = 0.5 + 0.5 * sin(dMid * 330.0 + ds_noise(vec2(p.x * 5.0, dMid * 9.0)) * 6.0);
    vec3 sand = vec3(0.034, 0.056, 0.125) * (1.0 - 0.45 * smoothstep(0.03, 0.14, dMid));
    sand += vec3(0.240, 0.350, 0.600) * lit * exp(-dMid * 5.5);
    sand *= 1.0 - 0.68 * (1.0 - lit) * exp(-dMid * 11.0);                  // the lee side lies in a shadow wedge under the crest
    sand *= 0.92 + 0.16 * rip * lit * (0.5 + ds_fbm(vec2(p.x * 6.0, dMid * 20.0)));
    float rim = exp(-dMid * 230.0) * (0.4 + 0.9 * lit);
    sand += vec3(0.30, 0.44, 0.74) * rim * 0.8;
    col = mix(col, sand, smoothstep(0.0, 0.0025, dMid));
  }
  float dNear = uv.y - cN;
  if (dNear > 0.0) {
    float sl = (ds_near(uv.x + 0.004) - ds_near(uv.x - 0.004)) / 0.008;
    float lit = clamp(0.5 - sl * 4.0, 0.0, 1.0);
    vec3 sand = mix(vec3(0.010, 0.016, 0.044), vec3(0.090, 0.135, 0.255), lit * exp(-dNear * 14.0));
    sand += vec3(0.20, 0.30, 0.52) * exp(-dNear * 260.0) * 0.45 * (0.4 + lit);
    col = mix(col, sand, smoothstep(0.0, 0.003, dNear));
  }

  // ---- the lone bush on the middle crest: a dark tangle of round tufts and bare twigs
  {
    float bxu = 0.595;
    vec2 bc = vec2(bxu * asp, ds_mid(bxu) + 0.002);
    float bush = 0.0;
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      vec2 o = vec2((ds_hash(vec2(fi, 2.0)) - 0.5) * 0.090, -0.003 - ds_hash(vec2(fi, 5.0)) * 0.020);
      float r = 0.007 + 0.007 * ds_hash(vec2(fi, 8.0));
      vec2 d = (p - bc - o) / vec2(r * 1.15, r);
      bush = max(bush, smoothstep(1.0, 0.75, length(d) + 0.18 * (ds_noise(p * 280.0 + fi) - 0.5)));
    }
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float ang = -1.57 + (fi - 2.0) * 0.50 + (ds_hash(vec2(fi, 1.0)) - 0.5) * 0.3;
      vec2 dr = vec2(cos(ang), sin(ang));
      vec2 rel = p - bc;
      float u = clamp(dot(rel, dr), 0.0, 0.014 + 0.012 * ds_hash(vec2(fi, 4.0)));
      float dd = length(rel - dr * u);
      bush = max(bush, smoothstep(0.0011, 0.0003, dd));
    }
    col = mix(col, vec3(0.004, 0.007, 0.020), bush * step(p.y, bc.y + 0.004) * 0.97);
  }

  // ---- sand wisps: thin veils lifting off the crest; they lean toward the pointer, otherwise drift slowly along the ridge
  {
    float h = cM - uv.y;                                              // height above the middle crest
    float toward = hasM ? clamp((m.x - uv.x) * 2.6, -1.0, 1.0) : 0.0;
    float lean = toward * h * 3.2;
    float xs = p.x - lean;
    float drift = t * 0.026;
    float lift = h + 0.015 * ds_fbm(vec2(xs * 3.0, 8.0));
    vec2 wq = vec2((xs - drift) * 7.0, lift * 55.0);
    float n = ds_fbm(wq * vec2(0.55, 1.0) + vec2(0.0, 2.0)) * 0.7 + ds_fbm(wq * vec2(1.4, 2.1) + 11.0) * 0.3;
    float veil = smoothstep(0.40, 0.66, n) * smoothstep(-0.004, 0.012, lift) * exp(-max(lift, 0.0) * 28.0);
    float gust = 0.55 + 0.9 * ds_fbm(vec2((xs - drift * 1.4) * 2.0, 5.0));
    if (hasM) gust *= 1.0 + 1.6 * exp(-pow((p.x - m.x * asp) / 0.30, 2.0));
    float above = smoothstep(-0.003, 0.006, h);
    vec3 wc = vec3(0.34, 0.45, 0.72);
    col += wc * veil * gust * above * 0.62 * (1.0 - smoothstep(0.0, 0.05, -h) * 0.0);
    // a few single grains flying high
    vec2 gq = vec2((xs - drift * 3.0) * 60.0, lift * 220.0);
    float grain = step(0.985, ds_hash(floor(gq))) * smoothstep(0.28, 0.0, length(fract(gq) - 0.5)) * exp(-max(lift, 0.0) * 14.0) * step(0.0, h);
    col += vec3(0.5, 0.62, 0.9) * grain * 0.35;
  }

  // faint haze on the far horizon and a gentle vignette
  col += vec3(0.05, 0.08, 0.15) * exp(-pow((uv.y - cF) / 0.03, 2.0)) * 0.35;
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
