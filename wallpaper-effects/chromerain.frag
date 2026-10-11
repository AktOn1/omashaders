// label: Chrome rain
// hint: a cyberpunk street in heavy rain: wet asphalt mirrors huge magenta and teal hologram ads, flying cars slide across the smog, and near the pointer a hologram ad flickers up while ripples ring on the road
// category: Neon nights
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
float cr_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cr_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cr_hash(i), cr_hash(i + vec2(1, 0)), f.x), mix(cr_hash(i + vec2(0, 1)), cr_hash(i + vec2(1, 1)), f.x), f.y);
}
float cr_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * cr_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float cr_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float CR_HZ = 0.60;
const vec3 CR_MAG = vec3(1.0, 0.18, 0.62);
const vec3 CR_TEAL = vec3(0.10, 0.90, 0.88);

// one ring of towers: returns (mask, window light, window hue, rim light)
vec4 cr_tower(vec2 p, float sc, float seed, float hmin, float hmax, float pitch, float t) {
  float x = p.x * sc + seed * 13.7;
  float id = floor(x), fx = fract(x);
  float hh = cr_hash(vec2(id, seed));
  float tall = step(0.82, cr_hash(vec2(id, seed + 5.0)));
  float height = hmin + hmax * hh * hh + 0.12 * tall;
  float gl = 0.03 + 0.10 * cr_hash(vec2(id, seed + 2.0));
  float gr = 0.03 + 0.10 * cr_hash(vec2(id, seed + 3.0));
  float hy = CR_HZ - p.y;                                   // height above the street line
  // wide lower body and a narrower upper block, a mast on the tallest
  float bodyH = height * 0.70;
  float body = step(gl, fx) * step(fx, 1.0 - gr) * step(hy, bodyH);
  float up = step(gl + 0.18, fx) * step(fx, 1.0 - gr - 0.18) * step(hy, height);
  float mast = step(abs(fx - 0.5), 0.012) * step(hy, height + 0.07 * tall);
  float m = max(max(body, up), mast) * step(0.0, hy);
  // windows in a grid, some lit
  vec2 wg = vec2((fx - gl) / sc / pitch, hy / (pitch * 1.55));
  vec2 wi = floor(wg), wf = fract(wg);
  float on = step(0.60 + 0.25 * cr_hash(vec2(id, seed + 13.0)), cr_hash(wi + id * 7.3 + seed));
  on *= 0.75 + 0.25 * sin(t * 0.3 + cr_hash(wi + id) * 40.0);
  float cell = smoothstep(0.12, 0.28, wf.x) * smoothstep(0.88, 0.72, wf.x) * smoothstep(0.18, 0.34, wf.y) * smoothstep(0.84, 0.70, wf.y);
  float win = on * cell * m;
  float hue = cr_hash(wi + id + seed * 3.0);
  // neon rim on the left or right edge
  float rimSide = cr_hash(vec2(id, seed + 9.0));
  float edge = rimSide > 0.5 ? (fx - gl) : (1.0 - gr - fx);
  float rim = smoothstep(0.035, 0.0, edge) * m * step(0.55, cr_hash(vec2(id, seed + 11.0)));
  return vec4(m, win, hue, rim);
}

// a huge translucent hologram ad: returns rgb (premultiplied-ish light) and alpha
vec4 cr_ad(vec2 p, vec2 c, vec2 hs, float kind, float t, float seed, float pwr) {
  vec2 d0 = p - c;
  float drop = step(0.93, cr_hash(vec2(floor(t * 5.0), seed)));        // now and then the projection hiccups
  float band = step(0.5, cr_hash(vec2(floor(d0.y * 40.0), floor(t * 14.0) + seed))) * drop;
  vec2 q = vec2(d0.x + band * 0.012, d0.y) / hs;
  float box = max(abs(q.x), abs(q.y));
  float inside = smoothstep(1.0, 0.97, box);
  vec3 base = mix(CR_TEAL, CR_MAG, kind);
  vec3 alt = mix(CR_MAG, CR_TEAL, kind);
  float sweep = fract(t * 0.12 + seed * 0.37);
  // content: a big ring emblem with an inner disc, a column of bars, a diagonal slash
  vec2 q2 = vec2(q.x, (q.y + 0.22) * hs.y / hs.x);
  float rr = length(q2);
  float ring = smoothstep(0.045, 0.0, abs(rr - 0.62));
  float disc = smoothstep(0.34, 0.30, rr) * (0.45 + 0.55 * smoothstep(-0.35, 0.35, q2.y));
  float arcCut = smoothstep(0.0, 0.05, abs(q2.x - q2.y * 0.6 - 0.1) - 0.03);
  float bars = 0.0;
  if (q.y > 0.55) {
    float rowi = floor((q.y - 0.55) * 14.0);
    float bw = 0.25 + 0.7 * cr_hash(vec2(rowi, seed));
    bars = step(abs(q.y - 0.55 - (rowi + 0.5) / 14.0) * 14.0, 0.28) * step(q.x + 0.9, bw * 1.8);
  }
  float slash = smoothstep(0.04, 0.0, abs(q.x + q.y * 0.5 - 0.62)) * step(0.15, q.y) * step(abs(q.x), 0.95);
  float scan = 0.72 + 0.28 * sin(p.y * 520.0 - t * 14.0);
  float swp = exp(-pow((q.y * 0.5 + 0.5 - sweep) / 0.05, 2.0)) * 0.35;
  float frame = smoothstep(0.94, 0.97, box) * inside;
  float core = (disc * arcCut * 0.9 + ring * 0.95 + bars * 0.85 + slash * 0.8) * inside;
  vec3 col = base * (0.30 + 0.55 * (q.y * 0.5 + 0.5)) * inside;                      // body of light, brighter toward the top
  col = mix(col, alt * 1.15, clamp(core, 0.0, 1.0) * 0.8);
  col += vec3(1.0) * (frame * 0.5 + swp * inside) * 0.8;
  col *= scan * (drop > 0.5 ? 0.45 : 1.0) * pwr;
  float al = inside * (0.42 + 0.30 * core) * pwr;
  // a halo of light bleeding into the smog
  vec2 dd = max(abs(d0) - hs, vec2(0.0));
  float halo = exp(-dot(dd, dd) / 0.0035) * 0.30 * pwr;
  col += base * halo;
  return vec4(col, clamp(al + halo * 0.5, 0.0, 1.0));
}

// the whole skyline, from the street line upwards; p.y < CR_HZ
vec3 cr_scene(vec2 p, float t, float asp, vec2 hm, float hmOn, float hmPwr, vec3 pic, float pl) {
  float hy = max(CR_HZ - p.y, 0.0);
  float fog = 0.55 + 0.9 * cr_fbm(vec2(p.x * 2.2 - t * 0.012, p.y * 4.0 + t * 0.006));
  // sky: sodium-violet smog, magenta glow low, teal wash higher, the picture's stars faintly through the haze
  vec3 sky = mix(vec3(0.34, 0.07, 0.30), vec3(0.015, 0.02, 0.075), pow(smoothstep(0.0, 0.58, hy), 0.55));
  sky = mix(sky, vec3(0.03, 0.30, 0.34), smoothstep(0.30, 0.0, abs(hy - 0.21 - 0.05 * sin(p.x * 1.7))) * 0.30 * fog);
  sky += mix(CR_TEAL, CR_MAG, 0.5 + 0.5 * sin(p.x * 1.3 + 1.0)) * 0.10 * fog * exp(-hy * 3.0);
  sky += vec3(0.55, 0.65, 0.95) * pl * 0.34 * smoothstep(0.05, 0.35, hy);
  vec3 col = sky;
  vec3 smog = vec3(0.33, 0.12, 0.34) + vec3(0.0, 0.10, 0.10) * smoothstep(0.1, 0.4, hy);

  // far towers, then ads in the middle distance, then nearer towers
  for (int l = 0; l < 3; l++) {
    float lf = float(l);
    float sc = l == 0 ? 15.0 : (l == 1 ? 8.5 : 5.0);
    float hmin = l == 0 ? 0.20 : (l == 1 ? 0.12 : 0.07);
    float hmax = l == 0 ? 0.34 : (l == 1 ? 0.42 : 0.44);
    float pitch = l == 0 ? 0.0048 : (l == 1 ? 0.0085 : 0.0135);
    vec4 tw = cr_tower(p, sc, lf * 1.9 + 0.7, hmin, hmax, pitch, t);
    float depthFog = l == 0 ? 0.80 : (l == 1 ? 0.55 : 0.25);
    float haze = depthFog + (1.0 - depthFog) * 0.0;
    haze = clamp(haze * (0.75 + 0.5 * fog) + smoothstep(0.12, 0.0, hy) * 0.35, 0.0, 0.95);
    vec3 body = mix(vec3(0.020, 0.018, 0.045), vec3(0.06, 0.04, 0.10), smoothstep(0.0, 0.3, hy) * 0.6);
    vec3 lsmog = l == 0 ? vec3(0.07, 0.24, 0.33) : (l == 1 ? vec3(0.26, 0.10, 0.36) : vec3(0.20, 0.06, 0.26));
    lsmog += (smog - lsmog) * smoothstep(0.12, 0.0, hy) * 0.6;
    body = mix(body, lsmog, haze);
    vec3 wcol = mix(mix(CR_TEAL, vec3(1.0, 0.62, 0.30), step(0.5, tw.z)), CR_MAG, step(0.8, tw.z));
    body += wcol * tw.y * (0.75 - 0.5 * haze);
    body += mix(CR_MAG, CR_TEAL, step(0.5, fract(tw.z * 7.0 + lf * 0.3))) * tw.w * (0.55 - 0.3 * haze) * (1.0 - 0.5 * pl);
    col = mix(col, body, tw.x);
    if (l == 1) {
      // the hologram ads: tall projections between the tower rows
      vec4 a1 = cr_ad(p, vec2(asp * 0.17, CR_HZ - 0.30), vec2(0.075, 0.26), 1.0, t, 1.3, 1.0);
      vec4 a2 = cr_ad(p, vec2(asp * 0.50, CR_HZ - 0.36), vec2(0.105, 0.20), 0.0, t, 4.1, 1.0);
      vec4 a3 = cr_ad(p, vec2(asp * 0.84, CR_HZ - 0.28), vec2(0.07, 0.24), 1.0, t, 7.7, 1.0);
      col = mix(col, a1.rgb, a1.a * 0.85) + a1.rgb * a1.a * 0.12;
      col = mix(col, a2.rgb, a2.a * 0.85) + a2.rgb * a2.a * 0.12;
      col = mix(col, a3.rgb, a3.a * 0.85) + a3.rgb * a3.a * 0.12;
    }
  }

  // the pointer's own ad: a flicker-up hologram in front of the towers
  if (hmOn > 0.0) {
    float fl = 0.60 + 0.40 * step(0.35, cr_hash(vec2(floor(t * 11.0), 3.0)));
    vec4 ah = cr_ad(p, vec2(hm.x, clamp(hm.y, 0.20, CR_HZ - 0.14)), vec2(0.060, 0.15), step(0.5, fract(floor(t * 0.25) * 0.5 + hm.x)), t, 9.9, fl * hmPwr);
    col = mix(col, ah.rgb * 1.2, ah.a * 0.95) + ah.rgb * ah.a * 0.2;
  }

  // flying cars: dark hulls with tail lights and a streak of glow behind them
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float r1 = cr_hash(vec2(fi, 21.0)), r2 = cr_hash(vec2(fi, 22.0)), r3 = cr_hash(vec2(fi, 23.0));
    float dir = r1 > 0.5 ? 1.0 : -1.0;
    float span = asp + 0.5;
    float sp = 0.035 + 0.040 * r2;
    float cx = mod(t * sp * dir + r3 * span, span) - 0.25;
    if (dir < 0.0) cx = asp + 0.25 - (cx + 0.25);
    float cy = CR_HZ - 0.12 - 0.34 * fract(r1 * 7.0 + r2 * 3.0 + 0.2 * fi);
    float s = 1.5 + 1.0 * (CR_HZ - cy) / 0.5;                     // higher = nearer = bigger
    vec2 d = vec2((p.x - cx) * dir, p.y - cy);                    // d.x > 0 : in front of the car
    float hull = smoothstep(1.0, 0.7, length(d / vec2(0.016, 0.0040) / s));
    float tail = exp(-dot(d + vec2(0.017 * s, 0.0), d + vec2(0.017 * s, 0.0)) / (0.000018 * s * s));
    float head = exp(-dot(d - vec2(0.017 * s, 0.0), d - vec2(0.017 * s, 0.0)) / (0.000012 * s * s));
    float streak = exp(-pow(d.y / (0.0016 * s), 2.0)) * smoothstep(0.0, -0.20 * s, d.x) * step(d.x, -0.015 * s) * 0.0;
    float trail = exp(-pow(d.y / (0.0013 * s), 2.0)) * exp(-max(-d.x - 0.017 * s, 0.0) / (0.045 * s)) * step(d.x, -0.016 * s);
    col = mix(col, vec3(0.02, 0.02, 0.05), hull * 0.92);
    col += vec3(1.0, 0.12, 0.20) * (tail * 1.1 + trail * 0.7);
    col += vec3(0.85, 0.95, 1.0) * head * 0.9 + vec3(0.2, 0.7, 1.0) * exp(-pow(d.y / 0.006, 2.0)) * exp(-pow(d.x / 0.025, 2.0)) * 0.12;
  }

  // smog lying on the street line
  col = mix(col, smog * 1.25, exp(-hy * 10.0) * 0.55 * (0.6 + 0.6 * fog));
  col += CR_MAG * exp(-hy * 40.0) * 0.18;
  return col;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);
  float pl = cr_luma(pic);
  float hmOn = hasM ? 1.0 : 0.0;
  float hmPwr = 1.0;
  vec3 col;

  if (uv.y < CR_HZ) {
    col = cr_scene(p, t, asp, mp, hmOn, hmPwr, pic, pl);
  } else {
    float gz = uv.y - CR_HZ;
    float s = 1.0 / (gz + 0.045);
    // puddles: patches of near-mirror in the asphalt, laid out in perspective
    vec2 pq = vec2((p.x - asp * 0.5) * s * 0.55, s * 0.55);
    float pd = smoothstep(0.38, 0.62, cr_fbm(pq * 1.1 + 4.0));
    pd = max(pd, smoothstep(0.35, 0.0, gz) * 0.35);              // the road far away is always a shiny sheet
    // raindrop ripples: two cells grids in road space
    vec2 rip = vec2(0.0);
    float ringLight = 0.0;
    for (int k = 0; k < 2; k++) {
      float kf = float(k);
      vec2 g = vec2((p.x - asp * 0.5) * s * 0.6 + kf * 3.1, s * 0.6 + kf * 1.7) * (3.2 + 1.6 * kf);
      vec2 ci = floor(g);
      vec2 lc = fract(g) - 0.5;
      float h0 = cr_hash(ci + kf * 11.0);
      vec2 jit = (vec2(cr_hash(ci + 3.7), cr_hash(ci + 8.1)) - 0.5) * 0.5;
      float ph = fract(t * (0.55 + 0.25 * h0) + h0 * 9.0);
      vec2 dv = lc - jit;
      float rr = length(dv);
      float rg = exp(-pow((rr - ph * 0.42) / 0.035, 2.0)) * (1.0 - ph) * step(0.45, h0);
      rip += normalize(dv + 1e-4) * rg * 0.012;
      ringLight += rg;
    }
    // the pointer's ripples, expanding rings in road space around where it is
    float pr = 0.0;
    if (hasM) {
      vec2 pc = vec2(mp.x, max(mp.y, CR_HZ + 0.07));
      vec2 dd = vec2(p.x - pc.x, (p.y - pc.y) * 2.8);
      float dl = length(dd);
      for (int k = 0; k < 3; k++) {
        float ph = fract(t * 0.45 + float(k) / 3.0);
        float rg = exp(-pow((dl - 0.02 - ph * 0.30) / 0.010, 2.0)) * (1.0 - ph) * (1.0 - ph);
        pr += rg;
        rip += normalize(dd + 1e-4) * rg * 0.014;
      }
      pd = max(pd, exp(-dl * dl / 0.05));
    }
    // reflection: sample the skyline mirrored about the street line, wobbled by the ripples and by rain-roughness
    float rough = (cr_noise(vec2(p.x * 90.0, gz * 30.0 + t * 0.4)) - 0.5) * (0.004 + 0.012 * (1.0 - pd));
    vec2 rq = vec2(p.x + rip.x + rough * 2.0, CR_HZ - gz * 0.95 - rip.y * 0.8 - 0.002);
    rq.y = max(rq.y, 0.001);
    vec3 refl = cr_scene(rq, t, asp, mp, hmOn, hmPwr, pic, pl);
    refl = 0.5 * (refl + cr_scene(vec2(rq.x + rough * 3.0, max(rq.y - 0.012 - 0.03 * gz, 0.001)), t, asp, mp, hmOn, hmPwr, pic, pl));   // a little vertical smear
    // road base: wet black asphalt with a cold sheen from the picture
    vec3 road = vec3(0.012, 0.012, 0.024) + vec3(0.03, 0.04, 0.08) * pl * 0.45;
    float fres = 0.55 + 0.45 * pow(1.0 - smoothstep(0.0, 0.40, gz), 1.5);
    float rstr = mix(0.45, 1.30, pd) * fres * (1.0 - 0.30 * smoothstep(0.0, 0.4, gz));
    col = road + refl * rstr * vec3(0.95, 0.95, 1.0);
    // a faint lane line and the kerb glow at the far end
    float lane = smoothstep(0.012 * (gz + 0.02) * 3.0, 0.0, abs(p.x - asp * 0.5)) * step(0.5, fract(s * 0.9 - t * 0.0)) * 0.0;
    col += vec3(0.30, 0.22, 0.34) * smoothstep(0.012, 0.0, gz) * 0.5;
    col += mix(CR_TEAL, CR_MAG, 0.5 + 0.5 * sin(p.x * 3.0)) * (ringLight * 0.07 * pd + 0.0);
    col += mix(CR_MAG, CR_TEAL, 0.5 + 0.5 * sin(t * 0.7)) * pr * 0.42;
  }

  // rain in front of everything: thin slanted streaks, two depths
  float rain = 0.0;
  for (int k = 0; k < 2; k++) {
    float kf = float(k);
    vec2 rq = vec2(p.x * (70.0 + 38.0 * kf) + uv.y * (9.0 + 5.0 * kf), uv.y * (5.0 + 2.0 * kf) - t * (3.2 + 1.1 * kf));
    rq.y += cr_hash(vec2(floor(rq.x), kf)) * 20.0;
    float rid = floor(rq.x);
    float rh = cr_hash(vec2(rid, kf + 3.0));
    float streak = smoothstep(0.88, 1.0, fract(rq.y + rh)) * smoothstep(0.35, 0.0, abs(fract(rq.x) - 0.5)) * step(0.5, rh);
    rain += streak * (0.55 - 0.2 * kf);
  }
  col += vec3(0.55, 0.65, 0.85) * rain * 0.14;

  // the user's picture stays faintly present, vignette closes the corners
  col *= 0.94 + 0.12 * pl;
  col *= 1.0 - 0.42 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
