// label: Airship harbour
// hint: a tall mooring tower at copper sunset with an airship tied to its mast and another cruising past, pennants flapping, lamps lighting one by one along the catwalk and a sea of cloud below; the nearest airship drifts toward the pointer and the clouds part around it
// category: Frontier and steam
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
float ah_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ah_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ah_hash(i), ah_hash(i + vec2(1, 0)), f.x), mix(ah_hash(i + vec2(0, 1)), ah_hash(i + vec2(1, 1)), f.x), f.y);
}
float ah_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ah_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ah_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * ah_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ah_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 ah_rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

const float AH_HZ = 0.64;
const float AH_AA = 0.0011;

// a thin line segment
float ah_seg(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  return smoothstep(w + AH_AA, w - 0.0004, d);
}

// a flag in its own frame: l.x runs from the pole along the cloth, l.y across it; shade is a cloth light value
float ah_flag(vec2 l, float len, float w, float amp, float wl, float t, float ph, float taper, out float shade) {
  shade = 1.0;
  if (l.x < 0.0 || l.x > len) return 0.0;
  float s = l.x / len;
  float off = amp * sin(l.x * wl - t * 4.2 + ph) * s;
  float hw = w * mix(1.0, 1.0 - taper, s);
  float d = abs(l.y - off);
  shade = 0.78 + 0.22 * cos(l.x * wl - t * 4.2 + ph);
  return smoothstep(hw, hw - 0.0022, d);
}

// lamp i comes on at its own moment in a 30 second evening, then they all fade and start again
float ah_lamp(float i, float t) {
  float ph = mod(t, 30.0);
  return smoothstep(i * 0.9, i * 0.9 + 0.8, ph) * (1.0 - smoothstep(26.0, 29.0, ph));
}

// an airship in side view; local x runs along the hull, +x is the nose (dir = +1 nose right, -1 nose left); returns coverage, colour in col
float ah_ship(vec2 p, vec2 c, float dir, float sc, float ang, float t, float seed, float lamp, float bl, float fog, vec3 hazeC, inout vec3 glow, out vec3 col) {
  col = vec3(0.0);
  vec2 q = ah_rot(p - c, -ang * dir);
  q.x *= dir;
  q /= sc;
  if (abs(q.x) > 1.25 + bl || abs(q.y) > 1.0) return 0.0;
  float aa = 1.3 / (res.y * sc);
  vec3 Lw = normalize(vec3(-0.85, 0.30, 0.45));
  vec3 cream = vec3(1.0, 0.86, 0.62);
  vec3 copper = vec3(1.0, 0.58, 0.30);
  vec3 teal = vec3(0.045, 0.115, 0.14);

  // streamer banner from the tail
  float bx = -q.x - 1.08;
  float cover = 0.0;
  if (bl > 0.0 && bx > 0.0 && bx < bl) {
    float k = bx / bl;
    float yw = 0.07 * sin(bx * 5.0 - t * 4.2 + seed * 3.0) * min(bx / 0.4, 1.0);
    float hw = 0.075 * (1.0 - 0.15 * k);
    float d = abs(q.y - yw);
    float notch = step(bl - 0.2, bx) * step(d, (bx - (bl - 0.2)) * 0.5);
    float m = smoothstep(hw, hw - aa * 2.0, d) * (1.0 - notch);
    float sh = 0.74 + 0.26 * cos(bx * 5.0 - t * 4.2 + seed * 3.0);
    vec3 bc = mix(copper * vec3(0.95, 0.75, 0.6), cream, step(0.5, fract(bx * 2.6 + seed))) * sh;
    bc = mix(bc, vec3(0.10, 0.20, 0.22) * sh, step(abs(d - 0.0), 0.012) * 0.0);
    col = mix(col, bc, m);
    cover = max(cover, m);
  }

  // tail fins
  float fx = -q.x - 0.60;
  if (fx > 0.0 && fx < 0.55) {
    float fh = 0.10 + fx * 0.64;
    float lim = 0.55 - 0.45 * max(abs(q.y) - 0.20, 0.0);
    float fm = smoothstep(fh, fh - aa * 2.0, abs(q.y)) * step(fx, lim);
    vec3 fc = mix(teal * 1.8, copper * 0.55, smoothstep(0.0, 0.4, fx) * 0.5 * (0.5 - 0.5 * sign(q.y)));
    col = mix(col, fc, fm);
    cover = max(cover, fm);
  }

  // hull
  float tp = mix(0.70, 1.0, smoothstep(-1.0, 0.35, q.x));
  vec2 e = vec2(q.x, q.y / (0.30 * tp));
  float r2 = dot(e, e);
  float ed = sqrt(r2);
  float body = smoothstep(1.0, 1.0 - aa * 1.5, ed);
  if (body > 0.0) {
    float nz = sqrt(max(1.0 - r2, 0.0));
    vec3 n = vec3(e.x * dir, e.y, nz);
    float lit = dot(n, Lw) * 0.5 + 0.5;
    vec3 hc = mix(teal, copper, smoothstep(0.38, 0.92, lit));
    hc = mix(hc, cream, smoothstep(0.78, 1.0, lit) * 0.7);
    hc += vec3(0.08, 0.20, 0.24) * clamp(-n.y, 0.0, 1.0) * 0.8;                   // cool sky fill on the back
    // ribs and the painted band
    float rib = smoothstep(0.035, 0.0, abs(fract(q.x * 5.2 + 0.5) - 0.5) / 5.2 * 5.0);
    hc *= 1.0 - 0.18 * rib * nz;
    float band = smoothstep(0.10, 0.06, abs(e.y - 0.12));
    hc = mix(hc, mix(vec3(0.62, 0.17, 0.10), vec3(0.08, 0.28, 0.30), seed) * (0.35 + 0.8 * lit), band * 0.85);
    // the lower hull is a little darker, the nose a little brighter
    hc *= 0.80 + 0.30 * smoothstep(-0.2, 1.0, q.x * 0.4 + 0.6);
    col = mix(col, hc, body);
    cover = max(cover, body);
  }

  // gondola under the hull
  vec2 pg = q - vec2(0.05, 0.40);
  vec2 dg = abs(pg) - vec2(0.24, 0.045);
  float gd = length(max(dg, 0.0)) + min(max(dg.x, dg.y), 0.0) - 0.045;
  float gm = smoothstep(aa * 2.0, 0.0, gd);
  if (gm > 0.0) {
    vec3 gc = teal * 1.5 + copper * 0.13 * smoothstep(-0.3, 0.2, -pg.x);
    float cell = fract((pg.x + 0.30) / 0.10);
    float win = step(abs(cell - 0.5), 0.30) * step(abs(pg.y + 0.004), 0.024) * step(abs(pg.x), 0.24);
    gc = mix(gc, vec3(1.0, 0.74, 0.38) * 1.15, win * lamp);
    gc = mix(gc, vec3(0.025, 0.06, 0.075), win * (1.0 - lamp));
    col = mix(col, gc, gm);
    cover = max(cover, gm);
    glow += vec3(1.0, 0.60, 0.28) * exp(-length(pg * vec2(0.75, 1.4)) / 0.22) * lamp * 0.12 * (1.0 - fog);
  }
  // the struts that hold it
  float st = (step(abs(q.x + 0.14), 0.014) + step(abs(q.x - 0.24), 0.014)) * step(0.26, q.y) * step(q.y, 0.36);
  col = mix(col, teal, st);
  cover = max(cover, st);
  // propeller: a faint disc at the back of the gondola
  vec2 pp = q - vec2(-0.30, 0.40);
  float prop = smoothstep(0.07, 0.04, length(pp * vec2(0.28, 1.0) * 3.5)) * 0.35;
  col = mix(col, vec3(0.7, 0.8, 0.8), prop);
  cover = max(cover, prop);

  col = mix(col, hazeC, fog);
  return cover;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  // ---- the cast: where everything stands
  float tx = asp * 0.77;
  vec2 sun = vec2(asp * 0.20, AH_HZ - 0.045);
  vec2 armP = vec2(tx - 0.046, 0.185);
  vec2 baseA = vec2(tx - 0.045 - 0.215 - 0.205, 0.255);          // airship A rides at the end of her mooring rope
  float xB = asp * (1.25 - 1.5 * fract(t / 260.0 + 0.42));
  vec2 baseB = vec2(xB, 0.405 + 0.012 * sin(t * 0.31));

  // the pointer pulls the nearer airship toward it
  float dA = length(mp - baseA), dB = length(mp - baseB);
  float wA = hasM ? smoothstep(-0.06, 0.06, dB - dA) : 0.0;
  float wB = hasM ? 1.0 - wA : 0.0;
  vec2 pullA = (mp - baseA); pullA *= min(1.0, 0.11 / max(length(pullA), 0.001)) * 0.46 * wA;
  vec2 pullB = (mp - baseB); pullB *= min(1.0, 0.09 / max(length(pullB), 0.001)) * 0.46 * wB;
  vec2 cA = baseA + pullA + vec2(0.004 * sin(t * 0.37), 0.007 * sin(t * 0.55));
  vec2 cB = baseB + pullB;
  float angA = 0.012 * sin(t * 0.45) - pullA.y * 0.5;
  float angB = 0.010 * sin(t * 0.4 + 1.0) - pullB.y * 0.5;

  // the pointer's hole in the clouds
  vec2 hd = (p - mp) * vec2(1.0, 1.5);
  float hole = hasM ? exp(-dot(hd, hd) / 0.030) : 0.0;
  float holeW = hasM ? exp(-dot(hd, hd) / 0.05) : 0.0;

  // ---- sky: teal dusk at the top, copper and gold toward the sun on the horizon
  float g = clamp(uv.y / AH_HZ, 0.0, 1.0);
  vec3 skyTop = vec3(0.045, 0.115, 0.175);
  vec3 skyMid = vec3(0.19, 0.33, 0.40);
  vec3 skyLow = vec3(0.90, 0.56, 0.34);
  vec3 skyHor = vec3(1.0, 0.76, 0.44);
  vec3 col = mix(skyTop, skyMid, smoothstep(0.0, 0.62, g));
  col = mix(col, skyLow, smoothstep(0.52, 0.93, g));
  col = mix(col, skyHor, smoothstep(0.88, 1.0, g) * 0.8);
  vec2 sd = (p - sun) * vec2(0.8, 1.0);
  col += vec3(1.0, 0.58, 0.28) * exp(-dot(sd, sd) / 0.16) * 0.50;
  col += vec3(1.0, 0.80, 0.52) * exp(-dot(sd, sd) / 0.012) * 0.55;
  col = mix(col, vec3(1.0, 0.94, 0.78), smoothstep(0.046, 0.040, length(p - sun)));        // the sun itself
  // the picture's own stars and glow show faintly in the upper sky
  col += w * 0.22 * smoothstep(0.55, 0.0, uv.y) * vec3(0.8, 0.95, 1.0);
  // high cirrus streaks, copper on their sun side
  float cir = ah_fbm3(vec2(p.x * 1.2 + t * 0.006, p.y * 11.0 + ah_fbm3(vec2(p.x * 2.0, p.y * 3.0)) * 1.2));
  cir = smoothstep(0.52, 0.80, cir) * smoothstep(0.62, 0.12, uv.y) * smoothstep(0.0, 0.10, uv.y);
  cir *= 1.0 - holeW * 0.8;
  float sunSide = exp(-pow((p.x - sun.x) / 1.1, 2.0));
  col = mix(col, mix(vec3(0.55, 0.62, 0.68), vec3(1.0, 0.68, 0.46), sunSide), cir * 0.42);

  // ---- far cloud sea, below the horizon: lit billows, deep teal valleys, drifting slowly
  if (uv.y >= AH_HZ - 0.004) {
    float dy = uv.y - AH_HZ + 0.025;
    float s = 1.0 / dy;
    vec2 q = vec2((p.x - 0.5 * asp) * 0.42 * s + t * 0.030, s * 0.30 + t * 0.006);
    float n = ah_fbm(q * 1.15);
    float n2 = ah_fbm3(q * 1.15 + vec2(-0.17, -0.06));                       // the sunward neighbour, for the lighting
    float lit = smoothstep(-0.05, 0.10, n - n2 * 0.96 - 0.03 + (n - 0.5) * 0.3);
    float dens = smoothstep(0.33, 0.52, n);
    dens *= 1.0 - hole * 0.96;
    vec3 shadowC = vec3(0.075, 0.150, 0.200);
    vec3 litC = vec3(1.0, 0.64, 0.36);
    vec3 cl = mix(shadowC, litC, lit * (0.45 + 0.7 * smoothstep(0.35, 0.8, n)));
    cl = mix(cl, vec3(1.0, 0.88, 0.70), smoothstep(0.62, 0.86, n) * lit * 0.7);
    cl = mix(cl, vec3(0.10, 0.20, 0.25), smoothstep(0.62, 0.0, uv.y - AH_HZ + 0.06) * 0.0);
    // the deep below, seen through valleys and through the pointer's hole: the picture shows
    vec3 deep = mix(vec3(0.045, 0.100, 0.140), w * 0.78 + vec3(0.04, 0.06, 0.07), 0.32 + 0.55 * hole);
    deep += vec3(1.0, 0.5, 0.25) * 0.12 * exp(-(uv.y - AH_HZ) * 6.0);
    vec3 sea = mix(deep, cl, dens);
    // sun glitter on the haze near the horizon and the cool far fog
    sea = mix(sea, skyHor * vec3(1.0, 0.82, 0.62), exp(-(uv.y - AH_HZ) * 11.0) * 0.55 * (0.4 + 0.6 * sunSide));
    // clouds fall away darker toward the bottom edge
    sea *= 1.0 - 0.38 * smoothstep(0.1, 0.45, uv.y - AH_HZ);
    col = mix(col, sea, smoothstep(AH_HZ - 0.004, AH_HZ + 0.006, uv.y));
  }

  vec3 glow = vec3(0.0);
  vec3 sc3;

  // ---- airship B: far, hazy, cruising across; a long streamer behind it
  {
    vec3 hz = mix(col, vec3(0.60, 0.50, 0.46), 0.5);
    float cvB = ah_ship(p, cB, -1.0, 0.105, angB, t, 1.0, ah_lamp(8.0, t), 1.1, 0.42, hz, glow, sc3);
    col = mix(col, sc3, cvB);
  }

  // ---- the mooring tower
  {
    float hw = 0.0105 + max(uv.y - 0.19, 0.0) * 0.032;
    float u = (p.x - tx) / hw;
    float inShaft = step(abs(u), 1.0) * step(0.19, uv.y);
    float leg = step(0.74, abs(u));
    float v = uv.y * 33.0;
    float d1 = min(abs(fract(v + u * 0.5) - 0.5), abs(fract(v - u * 0.5) - 0.5));
    float brace = smoothstep(0.11, 0.055, d1);
    float ring = smoothstep(0.43, 0.48, abs(fract(v) - 0.5)) * 0.9;
    float lat = max(leg, max(brace * 0.9, ring)) * inShaft;
    float tow = lat;
    // decks: the cap, the observation deck and the catwalk root
    float cap = step(abs(p.x - tx), 0.050) * step(abs(uv.y - 0.181), 0.0055);
    float capTop = step(abs(p.x - tx), 0.026) * step(abs(uv.y - 0.160), 0.0065);
    float dome = smoothstep(0.024, 0.020, length((p - vec2(tx, 0.154)) * vec2(1.0, 1.7))) * step(uv.y, 0.154);
    float obs = step(abs(p.x - tx), 0.056) * step(abs(uv.y - 0.395), 0.0042);
    float obsRoom = step(abs(p.x - tx), 0.040) * step(abs(uv.y - 0.370), 0.0150);
    float mast = step(abs(p.x - tx), 0.0014) * step(0.050, uv.y) * step(uv.y, 0.150);
    float arm = step(abs(uv.y - 0.185), 0.0022) * step(tx - 0.050, p.x) * step(p.x, tx);
    arm = max(arm, ah_seg(p, vec2(tx - 0.012, 0.19), armP, 0.0020));
    float deck = step(abs(p.x - tx), 0.050) * step(abs(uv.y - 0.540), 0.0035);
    float solid = max(max(cap, capTop), max(max(dome, obs), max(obsRoom, max(mast, max(arm, deck)))));
    tow = max(tow, solid);
    // catwalk to the left with rail, posts and lower truss
    float cwX0 = tx - 0.46;
    float inCw = step(cwX0, p.x) * step(p.x, tx);
    float plank = inCw * step(abs(uv.y - 0.540), 0.0032);
    float rail = inCw * step(abs(uv.y - 0.514), 0.0013);
    float post = inCw * step(0.514, uv.y) * step(uv.y, 0.540) * step(abs(fract((tx - p.x) / 0.045 + 0.5) - 0.5), 0.0016 / 0.045);
    float truss = ah_seg(p, vec2(cwX0 + 0.01, 0.543), vec2(tx - hw, 0.650), 0.0018);
    float cableA = ah_seg(p, vec2(tx - 0.004, 0.172), vec2(cwX0 + 0.004, 0.516), 0.0011);
    float strut2 = ah_seg(p, vec2(cwX0 + 0.22, 0.543), vec2(tx - hw, 0.60), 0.0014);
    float catw = max(max(plank, rail), max(post, max(truss, strut2)));
    tow = max(tow, catw);

    // colour: dark teal silhouette, a copper rim on the sun side, lit windows on the observation room
    vec3 tc = vec3(0.022, 0.050, 0.064);
    float rim = smoothstep(0.0, 1.0, 0.5 - 0.5 * u) * 0.55 + 0.1;
    float haze = smoothstep(0.55, 1.0, uv.y);                                          // the foot of the tower sinks into mist
    tc += vec3(0.90, 0.42, 0.20) * rim * 0.20 * (1.0 - haze * 0.6);
    tc += vec3(0.50, 0.22, 0.10) * 0.45 * (cap + capTop + obs + dome) * step(p.x, tx + 0.01);
    float obsWin = obsRoom * step(abs(fract((p.x - tx + 0.040) / 0.016) - 0.5), 0.28) * step(abs(uv.y - 0.370), 0.0075);
    tc = mix(tc, vec3(1.0, 0.72, 0.36) * 1.1, obsWin * ah_lamp(7.0, t));
    tc = mix(tc, vec3(0.45, 0.30, 0.22), haze * 0.55);
    col = mix(col, tc, clamp(tow, 0.0, 1.0) * (1.0 - holeW * 0.0));
  }

  // ---- pennants on the mast and a hanging banner on the observation deck
  {
    float sh;
    float f1 = ah_flag(vec2(tx - p.x, uv.y - 0.062), 0.095, 0.0125, 0.007, 36.0, t, 0.0, 0.95, sh);
    col = mix(col, vec3(1.0, 0.55, 0.26) * sh, f1);
    float f2 = ah_flag(vec2(tx - p.x, uv.y - 0.090), 0.065, 0.009, 0.006, 40.0, t, 1.7, 0.95, sh);
    col = mix(col, vec3(0.88, 0.80, 0.62) * sh, f2);
    float f3 = ah_flag(vec2(uv.y - 0.405, p.x - (tx + 0.050)), 0.150, 0.0155, 0.011, 34.0, t, 0.8, 0.0, sh);
    vec3 bc = mix(vec3(0.70, 0.22, 0.12), vec3(0.95, 0.70, 0.30), smoothstep(0.012, 0.0, abs(uv.y - 0.468) - 0.004));
    col = mix(col, bc * sh, f3);
    // a thin gold edge on the banner pole
    col = mix(col, vec3(0.9, 0.6, 0.3), step(abs(p.x - (tx + 0.050)), 0.0013) * step(0.40, uv.y) * step(uv.y, 0.416));
    // bunting along the catwalk rail
    float inCw = step(tx - 0.46, p.x) * step(p.x, tx - 0.03);
    float bu = fract((tx - p.x) / 0.045);
    float bi = floor((tx - p.x) / 0.045);
    float sway = 0.0035 * sin(t * 2.6 + bi * 1.3);
    float flap = (0.012 - 0.012 * abs(bu - 0.5) * 2.0);
    float bun = inCw * step(0.5, 0.0 + 1.0) * smoothstep(0.0, 0.0015, (uv.y - (0.517 + sway * (bu - 0.5))) ) * smoothstep(0.0, 0.0015, (0.517 + sway * (bu - 0.5) + flap) - uv.y) * step(0.001, flap);
    vec3 bunC = mix(vec3(0.85, 0.40, 0.18), vec3(0.88, 0.80, 0.60), step(0.5, fract(bi * 0.5)));
    col = mix(col, bunC * 0.85, bun * 0.9);
  }

  // ---- airship A, tied to the mast by her nose
  vec3 cA3;
  float cvA = ah_ship(p, cA, 1.0, 0.205, angA, t, 0.0, ah_lamp(6.0, t), 0.55, 0.0, vec3(0.0), glow, cA3);
  col = mix(col, cA3, cvA);
  {
    vec2 nose = cA + ah_rot(vec2(0.205, 0.0), angA);
    float stretch = clamp(length(nose - armP) / 0.20, 0.7, 1.4);
    float slack = 0.028 * clamp(1.6 - stretch, 0.0, 1.0);
    vec2 mid = (nose + armP) * 0.5 + vec2(0.0, slack);
    float rope = max(ah_seg(p, nose, mid, 0.0011), ah_seg(p, mid, armP, 0.0011));
    col = mix(col, vec3(0.30, 0.22, 0.17) + vec3(0.5, 0.25, 0.1) * 0.3, rope * 0.9);
  }

  // ---- lamps along the catwalk: they come on one by one
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float on = ah_lamp(fi, t);
    float lx = tx - 0.056 - 0.0675 * fi;
    vec2 lp = vec2(lx, 0.500);
    float flick = 0.94 + 0.06 * sin(t * 7.0 + fi * 2.1) * on;
    float dl = length(p - lp);
    glow += vec3(1.0, 0.62, 0.28) * (exp(-dl / 0.020) * 0.55 + exp(-dl / 0.075) * 0.20) * on * flick;
    float bulb = smoothstep(0.0048, 0.0030, dl);
    col = mix(col, mix(vec3(0.10, 0.07, 0.05), vec3(1.0, 0.86, 0.55), on), bulb);
    // the pole it hangs from
    col = mix(col, vec3(0.03, 0.06, 0.07), step(abs(p.x - lx), 0.0012) * step(0.500, uv.y) * step(uv.y, 0.516));
    // light spilling on the planks
    col += vec3(1.0, 0.6, 0.3) * on * 0.16 * exp(-abs(p.x - lx) / 0.03) * smoothstep(0.006, 0.0, abs(uv.y - 0.546)) * step(tx - 0.46, p.x);
  }
  // the beacon on top of the mast: a slow amber-red pulse
  {
    float bl = 0.5 + 0.5 * sin(t * 1.5);
    bl = bl * bl;
    float db = length(p - vec2(tx, 0.048));
    glow += vec3(1.0, 0.30, 0.16) * (exp(-db / 0.012) * 0.8 + exp(-db / 0.05) * 0.18) * (0.25 + 0.75 * bl);
    col = mix(col, vec3(1.0, 0.45, 0.30), smoothstep(0.0038, 0.0022, db));
  }
  col += glow;

  // ---- a bank of near cloud over the foot of the tower, parted by the pointer
  {
    float nn = ah_fbm(vec2(p.x * 1.6 + t * 0.05, uv.y * 2.2 - t * 0.01));
    float edge = uv.y + (nn - 0.5) * 0.30 - 0.14 * hole;
    float a = smoothstep(0.84, 0.97, edge) * (1.0 - hole * 0.95);
    float n2 = ah_fbm3(vec2(p.x * 1.6 + 0.3 + t * 0.05, uv.y * 2.2 - 0.1));
    float lit = smoothstep(-0.05, 0.12, nn - n2 + 0.04);
    vec3 nc = mix(vec3(0.10, 0.20, 0.25), vec3(1.0, 0.66, 0.40), lit * (0.35 + 0.7 * smoothstep(0.35, 0.75, nn)));
    nc = mix(nc, vec3(0.08, 0.17, 0.22), smoothstep(0.93, 1.0, uv.y) * 0.5);
    col = mix(col, nc, a * 0.92);
  }

  // let the picture breathe through, light vignette
  col *= 0.95 + 0.10 * ah_luma(w);
  col *= 1.0 - 0.34 * pow(length((uv - 0.5) * vec2(1.0, 1.05)), 2.3);
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
