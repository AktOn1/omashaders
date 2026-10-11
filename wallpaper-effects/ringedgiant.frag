// label: Ringed giant
// hint: a gas giant with glittering gold rings fills the sky above a quiet grey moon plain with a few boulders, tiny meteors cross now and then, the pointer sends a glint around the rings
// category: Deep space
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
float rg_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rg_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rg_hash(i), rg_hash(i + vec2(1, 0)), f.x), mix(rg_hash(i + vec2(0, 1)), rg_hash(i + vec2(1, 1)), f.x), f.y);
}
float rg_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * rg_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float rg_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * rg_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float rg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float RG_HZ = 0.745;      // horizon of the moon plain
const float RG_R = 0.285;       // planet radius (screen height = 1)
const float RG_E = 0.21;        // how flat the ring ellipse is
const float RG_A = -0.19;       // tilt of the ring plane
const float RG_PI = 3.14159265;

// one tiny meteor slot: returns brightness at p
float rg_meteor(vec2 p, float t, float slot, float asp) {
  float period = 6.5 + 2.7 * slot;
  float x = t / period + slot * 0.37;
  float k = floor(x);
  float u = fract(x) / 0.11;
  if (u > 1.0) return 0.0;
  float h1 = rg_hash(vec2(k, slot + 1.0)), h2 = rg_hash(vec2(k, slot + 7.0)), h3 = rg_hash(vec2(k, slot + 13.0));
  vec2 s0 = vec2(h1 * asp, 0.03 + h2 * 0.30);
  float sg = h3 > 0.5 ? 1.0 : -1.0;
  vec2 dir = normalize(vec2(sg * 0.85, 0.42));
  vec2 head = s0 + dir * 0.34 * u;
  vec2 rel = p - head;
  float along = dot(rel, dir);
  float perp = dot(rel, vec2(-dir.y, dir.x));
  float life = sin(u * RG_PI);
  float tail = smoothstep(-0.11, 0.0, along) * step(along, 0.0015);
  float line = exp(-pow(perp / 0.0011, 2.0)) * tail * (0.35 + 0.65 * smoothstep(-0.11, 0.0, along));
  float hd = exp(-dot(rel, rel) / 0.000012);
  return (line * 0.9 + hd * 0.8) * life;
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
  float pl = rg_luma(pic);

  vec3 sunL = normalize(vec3(-0.85, -0.35, 0.55));
  vec2 sunP = normalize(vec2(-1.0, 0.45));                  // sun direction inside the ring plane

  // planet frame
  vec2 pc = vec2(asp * 0.46, 0.305);
  float ca = cos(RG_A), sa = sin(RG_A);
  vec2 U = vec2(ca, sa), V = vec2(-sa, ca);
  vec2 d = p - pc;
  vec2 pu = vec2(dot(d, U), dot(d, V));
  vec2 P = vec2(pu.x, pu.y / RG_E) / RG_R;                   // ring-plane coordinates in planet radii
  float rr = length(P);
  float th = atan(P.y, P.x);

  // ---- sky: deep brown-violet, a few fine stars, the picture's own stars and glow shine faintly through
  float hz = smoothstep(0.0, RG_HZ, uv.y);
  vec3 col = mix(vec3(0.012, 0.010, 0.028), vec3(0.050, 0.034, 0.052), hz * hz);
  col += mix(vec3(pl), pic, 0.35) * 0.26;
  float neb = rg_fbm3(p * 2.2 + 4.0);
  col += vec3(0.060, 0.030, 0.055) * smoothstep(0.45, 0.85, neb) * 0.6;
  vec2 sq = p * 95.0;
  vec2 sid = floor(sq);
  float sh = rg_hash(sid);
  vec2 sc2 = vec2(rg_hash(sid + 3.1), rg_hash(sid + 8.7));
  float star = smoothstep(0.945, 1.0, sh) * exp(-dot(fract(sq) - sc2, fract(sq) - sc2) * 90.0);
  star *= 0.45 + 0.55 * sin(t * (0.4 + sh * 1.3) + sh * 60.0);
  col += vec3(1.0, 0.93, 0.82) * star * 0.75;

  // soft gold glow around the giant
  float pr = length(d) / RG_R;
  col += vec3(0.24, 0.15, 0.08) * exp(-max(pr - 1.0, 0.0) * 2.4) * 0.30 * (0.5 + 0.5 * smoothstep(0.0, -0.8, dot(d / RG_R, sunP)));

  // meteors
  float met = rg_meteor(p, t, 0.0, asp) + rg_meteor(p, t, 1.0, asp) + rg_meteor(p, t, 2.0, asp);
  col += vec3(0.95, 0.90, 0.80) * met * 0.85;

  // ---- ring (shared pieces)
  // glint: the point of the ring closest to the pointer, in ring-plane coordinates
  vec2 Pg = vec2(0.0);
  float glintAmt = 0.0;
  vec2 gscr = vec2(-10.0);
  if (onScr) {
    vec2 dm = mp - pc;
    vec2 pm = vec2(dot(dm, U), dot(dm, V) / RG_E) / RG_R;
    float lm = max(length(pm), 0.001);
    float rg = clamp(lm, 1.50, 2.22);
    Pg = pm / lm * rg;
    gscr = pc + RG_R * (Pg.x * U + Pg.y * RG_E * V);
    glintAmt = 0.75 + 0.25 * exp(-length(mp - gscr) * 2.0);
  }

  // ring texture: returns rgb in xyz and opacity in w
  float dens = mix(0.20, 0.90, smoothstep(1.44, 1.56, rr));
  dens = mix(dens, 0.06, smoothstep(0.050, 0.020, abs(rr - 1.885)));
  dens *= mix(1.0, 0.78, smoothstep(1.90, 1.96, rr));
  dens *= 1.0 - 0.85 * smoothstep(0.013, 0.004, abs(rr - 2.125));
  float fine = rg_noise(vec2(rr * 34.0, 1.0)) * 0.55 + rg_noise(vec2(rr * 85.0, 5.0)) * 0.30 + rg_noise(vec2(rr * 6.0, 8.0)) * 0.15;
  dens *= 0.50 + 1.0 * fine;
  dens = clamp(dens, 0.0, 1.0);
  float inRing = smoothstep(1.28, 1.34, rr) * smoothstep(2.30, 2.25, rr);
  // the planet's shadow falls across the far side of the rings
  float cr = P.x * sunP.y - P.y * sunP.x;
  float rshadow = smoothstep(0.0, 0.25, -dot(P, sunP)) * smoothstep(1.06, 0.88, abs(cr));
  float shimmer = 0.5 + 0.5 * sin(th * 5.0 - t * 0.33 + rg_noise(vec2(rr * 11.0, 2.0)) * 9.0);
  float glit = pow(rg_noise(vec2(rr * 70.0, th * 16.0 + t * 0.18)), 5.0) * 1.5;
  vec3 ringC = mix(vec3(0.46, 0.30, 0.22), vec3(1.0, 0.86, 0.58), smoothstep(0.25, 0.9, fine + 0.15 * shimmer));
  ringC *= 0.82 + 0.28 * shimmer + glit * (0.5 + 0.5 * shimmer);
  ringC *= mix(1.0, 0.10, rshadow);
  vec2 gdv = P - Pg;
  float gdist = dot(gdv, gdv);
  float gl = (exp(-gdist / 0.025) * 1.7 + exp(-gdist / 0.30) * 0.45) * glintAmt * dens;
  ringC += vec3(1.0, 0.93, 0.74) * gl * (0.8 + 0.4 * shimmer) * (1.0 - 0.8 * rshadow);
  float ringA = dens * inRing * 0.92;

  // far half of the ring (behind the planet)
  float backM = step(pu.y, 0.0);
  col = mix(col, ringC, ringA * backM);

  // ---- the planet
  if (pr < 1.0) {
    float edge = smoothstep(1.0, 0.992, pr);
    vec2 q = d / RG_R;
    float z = sqrt(max(1.0 - pr * pr, 0.0));
    vec3 n = vec3(q, z);
    float lam = dot(n, sunL);
    float light = smoothstep(-0.30, 0.62, lam);
    float yb = pu.y / RG_R + 0.10 * (1.0 - (pu.x / RG_R) * (pu.x / RG_R)) * 0.5;
    float px = pu.x / RG_R;
    float wv = rg_fbm3(vec2(px * 1.4 + t * 0.010, yb * 3.2));
    float bv = yb * 6.5 + wv * 1.9 + 0.8 * rg_noise(vec2(px * 0.9 + 3.0, yb * 1.6));
    float m1 = 0.5 + 0.5 * sin(bv);
    float m2 = 0.5 + 0.5 * sin(bv * 2.3 + 1.7);
    vec3 pcol = mix(mix(vec3(0.60, 0.38, 0.26), vec3(0.88, 0.70, 0.45), m1), mix(vec3(0.38, 0.24, 0.24), vec3(0.96, 0.84, 0.60), m2), 0.38);
    pcol *= 0.92 + 0.16 * rg_noise(vec2(px * 5.0 + t * 0.02, yb * 46.0));
    // a small oval storm
    vec2 sv = vec2(px - 0.30, (yb + 0.34) * 1.9);
    float storm = smoothstep(0.17, 0.05, length(sv));
    pcol = mix(pcol, vec3(0.74, 0.40, 0.28), storm * 0.7);
    pcol = mix(pcol, vec3(0.90, 0.72, 0.52), smoothstep(0.10, 0.17, length(sv)) * smoothstep(0.24, 0.17, length(sv)) * 0.35);
    // the ring's own shadow draws a thin dark band
    float rb = smoothstep(0.04, 0.10, yb) * smoothstep(0.40, 0.32, yb) * (0.55 + 0.45 * rg_noise(vec2(yb * 55.0, 2.0)));
    vec3 lit = pcol * (0.10 + 1.05 * light) * vec3(1.0, 0.96, 0.92);
    lit += vec3(0.05, 0.035, 0.07) * (1.0 - light) * 0.8;                         // cool violet ambient on the night side
    lit *= 1.0 - 0.60 * rb * smoothstep(0.0, 0.5, light);
    lit *= 0.70 + 0.30 * pow(z, 0.35);                                              // limb darkening
    lit += vec3(1.0, 0.80, 0.52) * pow(1.0 - z, 3.0) * light * 0.28;                // sunlit rim haze
    col = mix(col, lit, edge);
  }

  // near half of the ring (in front of the planet)
  col = mix(col, ringC, ringA * (1.0 - backM));
  // the flare where the glint sits (a tiny cross)
  if (onScr) {
    vec2 gq = p - gscr;
    float gs = exp(-dot(gq, gq) / 0.00006) * 0.9
             + exp(-pow(gq.y / 0.0016, 2.0)) * exp(-abs(gq.x) / 0.035) * 0.5
             + exp(-pow(gq.x / 0.0016, 2.0)) * exp(-abs(gq.y) / 0.035) * 0.5;
    float visible = (length(gscr - pc) < RG_R && dot(gscr - pc, V) < 0.0) ? 0.0 : 1.0;
    col += vec3(1.0, 0.92, 0.74) * gs * 0.55 * glintAmt * visible;
  }

  // ---- the moon plain
  float hx = RG_HZ - 0.020 * rg_fbm3(vec2(p.x * 2.4 + 3.0, 1.0)) - 0.007 * rg_noise(vec2(p.x * 11.0, 4.0));
  float gm = smoothstep(hx - 0.0015, hx + 0.0015, uv.y);
  if (gm > 0.0) {
    float depth = max(uv.y - RG_HZ, 0.0);
    float sc = 1.0 / (depth + 0.035);
    vec2 w = vec2((p.x - pc.x) * sc * 0.75, sc * 1.1);
    float fade = smoothstep(0.0, 0.14, depth);
    float reg = rg_fbm(w * vec2(1.3, 1.6) + 9.0);
    float grain = rg_noise(w * vec2(26.0, 30.0));
    vec3 ground = vec3(0.26, 0.25, 0.255) * (0.55 + 0.85 * reg);
    ground *= 1.0 + (grain - 0.5) * 0.35 * fade;
    // craters on a jittered grid in ground space
    vec2 cw = w * vec2(0.65, 0.55);
    vec2 ci = floor(cw);
    float shade = 0.0;
    {
      float h1 = rg_hash(ci + 3.0), h2 = rg_hash(ci + 11.0), h3 = rg_hash(ci + 21.0);
      vec2 cen = ci + vec2(0.5 + 0.35 * (h1 - 0.5), 0.5 + 0.35 * (h2 - 0.5));
      float rad = 0.14 + 0.18 * h1;
      vec2 dc = (cw - cen) / rad;
      float dr = length(dc);
      float on = step(0.5, h3);
      float bowl = smoothstep(1.0, 0.85, dr);
      float rim = exp(-pow((dr - 1.0) / 0.13, 2.0));
      shade += on * (rim * (0.55 - 0.54 * dc.x) * 0.30 + bowl * (0.20 * dc.x - 0.07));
    }
    ground *= 1.0 + shade * fade;
    // low light from the left; the giant's glow warms it, and it dims toward the right edge
    float side = 0.78 + 0.45 * exp(-pow((p.x - asp * 0.15) / (asp * 0.62), 2.0));
    ground *= side;
    ground += vec3(0.07, 0.045, 0.025) * exp(-pow((p.x - pc.x) / 0.65, 2.0)) * (0.4 + 0.6 * fade);
    // the far rim and low hills sit darker
    ground *= mix(0.45, 1.0, smoothstep(0.0, 0.06, depth));
    // boulders and their long shadows
    float bshadow = 0.0;
    vec3 boul = vec3(0.0);
    float bmask = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float bx = pc.x + (rg_hash(vec2(fi, 3.0)) * 2.0 - 1.0) * asp * 0.50;
      float by = RG_HZ + 0.045 + pow(rg_hash(vec2(fi, 9.0)), 0.8) * 0.21;
      float bs = 0.010 + (by - RG_HZ) * 0.115 + 0.006 * rg_hash(vec2(fi, 5.0));
      vec2 bq = (p - vec2(bx, by)) / vec2(bs * 1.35, bs);
      // shadow cast to the right
      vec2 sq2 = (p - vec2(bx + bs * 2.1, by + bs * 0.05)) / vec2(bs * 2.6, bs * 0.30);
      bshadow = max(bshadow, smoothstep(1.0, 0.55, length(sq2)));
      float ang = atan(bq.y - 0.15, bq.x);
      float lump = 1.0 + 0.20 * sin(ang * 3.0 + fi * 2.1) + 0.12 * sin(ang * 5.0 + fi * 4.3) + 0.10 * (rg_noise(vec2(ang * 2.0 + fi * 9.0, 1.0)) - 0.5);
      float rb = length(vec2(bq.x, bq.y - 0.15)) / lump;
      if (bq.y < 0.38 && rb < 1.0) {
        float bz = sqrt(max(1.0 - rb * rb, 0.0));
        vec3 bn = normalize(vec3(bq.x + 0.5 * (rg_noise(bq * 3.0 + fi * 5.0) - 0.5), bq.y - 0.15 + 0.5 * (rg_noise(bq * 3.0 + fi * 8.0 + 4.0) - 0.5), bz));
        float bl = clamp(dot(bn, sunL) * 0.8 + 0.30, 0.0, 1.0);
        float tex = 0.85 + 0.30 * rg_noise(bq * 5.0 + fi * 7.0);
        vec3 bc = vec3(0.26, 0.245, 0.25) * tex * (0.14 + 1.00 * bl);
        bc += vec3(0.05, 0.03, 0.02) * bl;
        float am = smoothstep(1.0, 0.93, rb);
        boul = mix(boul, bc, am);
        bmask = max(bmask, am);
      }
    }
    ground *= 1.0 - 0.58 * bshadow * fade;
    ground = mix(ground, boul, bmask);
    // a hard line of far, dark mountains right at the horizon
    col = mix(col, ground, gm);
  }

  // gentle vignette
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
