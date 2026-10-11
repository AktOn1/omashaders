// label: Alien garden
// hint: a bioluminescent alien meadow at night: giant glowing mushrooms and ferns in teal, violet and coral, two moons and a rippling pond that mirrors them, floating spores; plants near the pointer glow brighter and the spores lift
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
float ag_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ag_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ag_hash(i), ag_hash(i + vec2(1, 0)), f.x), mix(ag_hash(i + vec2(0, 1)), ag_hash(i + vec2(1, 1)), f.x), f.y);
}
float ag_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ag_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ag_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * ag_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ag_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float AG_PI = 3.14159265;
const float AG_SHORE = 0.690;                       // far shore of the pond: the mirror line
const vec3 AG_TEAL = vec3(0.10, 0.95, 0.78);
const vec3 AG_VIOLET = vec3(0.64, 0.36, 1.0);
const vec3 AG_CORAL = vec3(1.0, 0.43, 0.38);

// mushroom parameters: (base x as a fraction of the aspect, base y, stalk height, cap radius); no arrays
vec4 ag_mp(int i, float asp) {
  if (i == 0) return vec4(asp * 0.21, 0.672, 0.100, 0.042);
  if (i == 1) return vec4(asp * 0.73, 0.670, 0.085, 0.036);
  if (i == 2) return vec4(asp * 0.58, 0.682, 0.120, 0.047);
  if (i == 3) return vec4(asp * 0.38, 0.684, 0.070, 0.031);
  if (i == 4) return vec4(asp * 0.18, 0.790, 0.100, 0.036);
  if (i == 5) return vec4(asp * 0.925, 0.805, 0.310, 0.115);
  if (i == 6) return vec4(asp * 0.085, 0.835, 0.400, 0.150);
  return vec4(asp * 0.835, 0.865, 0.085, 0.032);
}
vec3 ag_mc(int i) {
  if (i == 0) return AG_TEAL;
  if (i == 1) return AG_VIOLET;
  if (i == 2) return AG_CORAL;
  if (i == 3) return AG_TEAL;
  if (i == 4) return AG_CORAL;
  if (i == 5) return AG_CORAL;
  if (i == 6) return AG_VIOLET;
  return AG_TEAL;
}

// one glowing mushroom; returns colour (rgb) and body opacity (a); 'add' gets halo and light that is added on top
vec4 ag_mush(vec2 p, vec4 prm, vec3 gc, float seed, float boost, float t, out vec3 add) {
  vec2 q = p - prm.xy;
  float h = prm.z, r = prm.w;
  float pulse = 0.88 + 0.12 * sin(t * 0.7 + seed * 9.0);
  vec2 cc = q - vec2(0.0, -h);
  add = gc * exp(-dot(cc, cc) / (r * r * 2.4)) * 0.16 * boost * pulse;
  add += gc * exp(-pow(q.x / (r * 1.5), 2.0) - pow((q.y + 0.004) / 0.022, 2.0)) * 0.22 * boost * pulse;   // light pooling on the ground
  vec4 res0 = vec4(0.0);
  if (abs(q.x) > r * 1.6 || q.y > 0.012 || q.y < -(h + r * 1.1)) return res0;
  // stalk
  float s = clamp(-q.y / h, 0.0, 1.0);
  float bend = 0.012 * sin(s * 2.5 + seed * 6.0) * (h / 0.1);
  float w = r * 0.17 * (1.0 + 1.1 * (1.0 - s) * (1.0 - s)) + 0.0015;
  float sx = q.x - bend;
  float nx = sx / w;
  float stalkM = smoothstep(1.0, 0.82, abs(nx)) * smoothstep(0.004, -0.014, q.y) * step(-q.y, h * 1.02);
  vec3 stalkC = mix(vec3(0.030, 0.035, 0.07), gc * 0.20, 0.5 + 0.5 * nx * -0.6) * (0.7 + 0.3 * sin(q.y * 90.0 + seed * 5.0));
  stalkC += gc * 0.30 * pow(abs(nx), 3.0) * pulse;
  stalkC += gc * 0.12 * smoothstep(0.35, 1.0, s);                                // brighter toward the cap
  // cap
  float dx = q.x / r;
  float dyc = (q.y + h) / (r * 0.58);
  float e2 = dx * dx + dyc * dyc;
  float ce = sqrt(e2);
  float under = 0.22 - 0.30 * dx * dx;
  float capM = smoothstep(1.0, 0.94, ce) * smoothstep(under + 0.05, under - 0.02, dyc);
  float nz = sqrt(max(1.0 - e2, 0.0));
  vec3 capC = gc * (0.10 + 0.20 * nz) * pulse + gc * 0.75 * pow(1.0 - nz, 2.0) * pulse;
  capC += vec3(0.04, 0.03, 0.07) * (1.0 - nz);
  // spots
  vec2 sp = vec2(dx, dyc) * 5.5 + seed * 13.0;
  vec2 sc = floor(sp);
  float spot = smoothstep(0.30, 0.18, length(fract(sp) - vec2(0.3 + 0.4 * ag_hash(sc), 0.3 + 0.4 * ag_hash(sc + 5.0)))) * step(0.5, ag_hash(sc + 2.0));
  capC = mix(capC, mix(gc, vec3(1.0), 0.5) * 0.95, spot * 0.75 * smoothstep(0.1, 0.5, nz));
  // underside: glowing gills
  float ug = smoothstep(under - 0.03, under + 0.02, dyc) * smoothstep(under + 0.28, under + 0.02, dyc) * smoothstep(1.05, 0.9, abs(dx) + abs(dyc) * 0.25);
  vec3 gill = gc * (0.7 + 0.5 * sin(dx * 42.0 + seed * 3.0)) * 1.1 * pulse;
  vec3 col = mix(stalkC, vec3(0.0), 0.0);
  float a = stalkM;
  col = mix(col, gill, ug * (1.0 - capM) * 0.9);
  a = max(a, ug * (1.0 - capM) * 0.9);
  col = mix(col, capC, capM);
  a = max(a, capM);
  // curtain of light falling from the gills onto the stalk and ground
  add += gc * ug * 0.0;
  add += gc * smoothstep(0.7, 0.0, abs(dx)) * smoothstep(0.30, 0.0, -q.y / max(h, 0.01) + 0.0) * 0.0;
  add += gc * smoothstep(r * 0.9, 0.0, abs(q.x)) * smoothstep(0.0, 0.06, -q.y - 0.0) * smoothstep(h * 0.95, h * 0.3, -q.y) * 0.05 * boost;
  return vec4(col * boost, a);
}

// one fern: several arching fronds with pinnae; prm = (base x, base y, frond length)
vec4 ag_fern(vec2 p, vec3 prm, vec3 gc, float seed, float boost, float t) {
  vec2 d = p - prm.xy;
  float L = prm.z;
  if (length(d) > L * 1.5 || d.y > 0.01) return vec4(0.0);
  vec3 col = vec3(0.0);
  float a = 0.0;
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float ang = (fk / 5.0 - 0.5) * 2.5 + 0.10 * sin(t * 0.45 + fk * 1.7 + seed * 5.0);
    vec2 dir = vec2(sin(ang), -cos(ang));
    vec2 nrm = vec2(cos(ang), sin(ang));
    float al0 = dot(d, dir);
    float droop = 0.55 * (0.4 + 0.6 * abs(sin(ang)));
    vec2 d2 = d - vec2(0.0, droop * al0 * al0 / L);
    float al = dot(d2, dir);
    float pp = dot(d2, nrm);
    float Lk = L * (0.75 + 0.25 * ag_hash(vec2(fk, seed)));
    if (al > 0.0 && al < Lk) {
      float s = al / Lk;
      float wdt = 0.115 * Lk * pow(sin(AG_PI * pow(s, 0.8)), 0.8) + 0.0008;
      float pin = 0.5 + 0.5 * cos(s * 36.0 - abs(pp) / wdt * 4.5);
      float leaf = smoothstep(wdt, wdt * 0.70, abs(pp)) * (0.40 + 0.60 * pin);
      float rib = smoothstep(0.0016, 0.0004, abs(pp));
      float m = max(leaf, rib);
      vec3 lc = mix(gc * 0.10, gc * 0.55, pow(s, 1.5)) * (0.7 + 0.3 * pin);
      lc += gc * rib * 0.25;
      lc += gc * pow(s, 4.0) * 0.5 * leaf;
      col = mix(col, lc, m);
      a = max(a, m);
    }
  }
  return vec4(col * boost, a);
}

// the sky: indigo to teal haze, faint clouds, stars, two moons
vec3 ag_sky(vec2 p, float asp, float t, vec3 pic) {
  float hz = smoothstep(0.0, AG_SHORE, p.y);
  vec3 col = mix(vec3(0.016, 0.014, 0.060), vec3(0.020, 0.150, 0.170), pow(hz, 1.7));
  col += mix(vec3(ag_luma(pic)), pic, 0.4) * 0.22;
  float cl = ag_fbm3(vec2(p.x * 2.0 + t * 0.004, p.y * 5.0));
  col += vec3(0.20, 0.07, 0.30) * smoothstep(0.45, 0.85, cl) * 0.18 * (1.0 - hz * 0.5);
  vec2 sq = p * 90.0;
  vec2 sid = floor(sq);
  float sh = ag_hash(sid);
  vec2 jc = vec2(ag_hash(sid + 3.1), ag_hash(sid + 8.7));
  float star = smoothstep(0.95, 1.0, sh) * exp(-dot(fract(sq) - jc, fract(sq) - jc) * 90.0);
  star *= 0.5 + 0.5 * sin(t * (0.4 + sh * 1.2) + sh * 50.0);
  col += vec3(0.9, 0.95, 1.0) * star * 0.7 * (1.0 - hz * 0.7);
  // big pale-violet moon, banded and cratered, lit from the right
  vec2 m1 = vec2(asp * 0.40, 0.235);
  vec2 d1 = (p - m1) / 0.090;
  float r1 = length(d1);
  if (r1 < 1.1) {
    float disk = smoothstep(1.0, 0.985, r1);
    float z1 = sqrt(max(1.0 - r1 * r1, 0.0));
    vec3 n1 = vec3(d1, z1);
    float lam = clamp(dot(n1, normalize(vec3(0.7, -0.35, 0.6))) * 1.0 + 0.18, 0.0, 1.0);
    float mar = ag_fbm3(d1 * 2.4 + 3.0);
    vec3 mc = mix(vec3(0.62, 0.55, 0.86), vec3(0.88, 0.84, 1.0), smoothstep(0.35, 0.65, mar));
    mc *= 0.85 + 0.25 * ag_noise(d1 * 9.0);
    col = mix(col, mc * (0.12 + 0.95 * lam), disk);
  }
  col += vec3(0.55, 0.45, 0.90) * exp(-max(r1 - 1.0, 0.0) * 3.2) * 0.30 * (1.0 - smoothstep(1.0, 0.985, r1)) + vec3(0.40, 0.35, 0.70) * exp(-r1 * r1 * 0.35) * 0.06;
  // small coral moon
  vec2 m2 = vec2(asp * 0.60, 0.345);
  vec2 d2 = (p - m2) / 0.036;
  float r2 = length(d2);
  if (r2 < 1.1) {
    float disk2 = smoothstep(1.0, 0.97, r2);
    float z2 = sqrt(max(1.0 - r2 * r2, 0.0));
    float lam2 = clamp(dot(vec3(d2, z2), normalize(vec3(-0.6, -0.3, 0.7))) + 0.15, 0.0, 1.0);
    vec3 c2 = mix(vec3(0.95, 0.45, 0.38), vec3(1.0, 0.78, 0.60), ag_fbm3(d2 * 2.0 + 9.0));
    col = mix(col, c2 * (0.14 + 0.95 * lam2), disk2);
  }
  col += vec3(1.0, 0.45, 0.35) * exp(-max(r2 - 1.0, 0.0) * 2.0) * 0.16 * (1.0 - smoothstep(1.0, 0.97, r2));
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

  // pointer: plants close to it glow brighter
  float nearP = onScr ? exp(-dot(p - mp, p - mp) / 0.060) : 0.0;
  float boost = 1.0 + 2.2 * nearP;

  // the pond
  vec2 pcn = vec2(asp * 0.5, 0.812);
  vec2 pq = (p - pcn) / vec2(asp * 0.285, 0.122);
  float pwob = 0.07 * (ag_fbm3(vec2(atan(pq.y, pq.x) * 1.6 + 4.0, 1.0)) - 0.5);
  float pr = length(pq) + pwob;
  float pond = smoothstep(1.0, 0.97, pr);

  // ripples: three drops at random places, now and then, plus a faint wake around the pointer
  vec2 disp = vec2(0.0);
  float ripGlint = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float per = 5.5 + 1.7 * fk;
    float xk = t / per + fk * 0.31;
    float id = floor(xk);
    float age = fract(xk) * per;
    vec2 rc = pcn + (vec2(ag_hash(vec2(id, fk + 1.0)), ag_hash(vec2(id, fk + 5.0))) - 0.5) * vec2(asp * 0.40, 0.14);
    vec2 rv = (p - rc) * vec2(1.0, 2.4);
    float rd = length(rv);
    float ring = exp(-pow((rd - age * 0.055) / 0.014, 2.0)) * exp(-age * 0.55);
    float wave = sin((rd - age * 0.055) * 190.0);
    disp += normalize(rv + 1e-5) * ring * wave * 0.0040;
    ripGlint += ring * (0.5 + 0.5 * wave);
  }
  if (onScr) {
    vec2 rv = (p - mp) * vec2(1.0, 2.4);
    float rd = length(rv);
    float ring = exp(-rd * 6.0) * smoothstep(0.0, 0.03, rd);
    float wave = sin(rd * 150.0 - t * 4.0);
    disp += normalize(rv + 1e-5) * ring * wave * 0.0030;
    ripGlint += ring * (0.5 + 0.5 * wave) * 0.6;
  }
  disp += vec2(ag_noise(p * vec2(30.0, 90.0) + vec2(t * 0.3, 0.0)) - 0.5, ag_noise(p * vec2(40.0, 70.0) - vec2(0.0, t * 0.2)) - 0.5) * 0.0045;

  // ---------- sky
  vec3 col = ag_sky(p, asp, t, pic);

  // ---------- far hills with teal mist
  float h1 = 0.605 - 0.050 * ag_fbm3(vec2(p.x * 1.7 + 2.0, 1.0)) - 0.012 * ag_noise(vec2(p.x * 9.0, 3.0));
  float h2 = 0.640 - 0.035 * ag_fbm3(vec2(p.x * 2.6 + 7.0, 4.0));
  float hm1 = smoothstep(h1 - 0.002, h1 + 0.002, p.y);
  col = mix(col, mix(vec3(0.020, 0.050, 0.090), vec3(0.035, 0.12, 0.13), smoothstep(h1, h1 + 0.08, p.y)), hm1);
  float hm2 = smoothstep(h2 - 0.002, h2 + 0.002, p.y);
  col = mix(col, mix(vec3(0.016, 0.030, 0.070), vec3(0.03, 0.08, 0.10), smoothstep(h2, h2 + 0.06, p.y)), hm2);
  col += vec3(0.05, 0.32, 0.30) * exp(-pow((p.y - 0.665) / 0.05, 2.0)) * 0.12;                          // low mist
  // tiny far glowing trees on the first ridge
  {
    vec2 gq = vec2(p.x * 38.0, 0.0);
    float gid = floor(gq.x);
    float gh = ag_hash(vec2(gid, 7.0));
    float on = step(0.80, gh);
    float gx = abs(fract(gq.x) - 0.5);
    float ty = h1 + 0.004;
    float tree = on * smoothstep(0.0, 0.01, ty - p.y) * smoothstep(0.045 * gh, 0.0, ty - p.y - 0.0) * smoothstep(0.30 * (1.0 - (ty - p.y) / (0.045 * gh + 0.001)) + 0.04, 0.0, gx - 0.0);
    vec3 tc = gh < 0.9 ? AG_VIOLET : AG_TEAL;
    col += tc * tree * 0.10 * hm1 * (1.0 - hm2);
  }

  // ---------- the ground: dark, with soft bioluminescent patches
  float gnd = smoothstep(0.650, 0.690, p.y);
  float gp = ag_fbm(vec2(p.x * 7.0, p.y * 14.0));
  vec3 gcol = mix(vec3(0.014, 0.020, 0.045), vec3(0.020, 0.045, 0.060), gp);
  gcol += AG_TEAL * smoothstep(0.62, 0.8, ag_fbm3(vec2(p.x * 9.0 + 1.0, p.y * 22.0))) * 0.05;
  gcol += AG_VIOLET * smoothstep(0.62, 0.8, ag_fbm3(vec2(p.x * 8.0 + 20.0, p.y * 20.0))) * 0.04;
  col = mix(col, gcol, gnd);

  // ---------- the pond: a mirror, wobbling with the ripples
  if (pond > 0.0) {
    vec2 pm = vec2(p.x, AG_SHORE - (p.y - AG_SHORE) * 2.6) + disp * vec2(3.0, 1.5);
    vec3 refl = ag_sky(pm, asp, t, pic);
    float hr = AG_SHORE - 0.085 * ag_fbm3(vec2(pm.x * 1.7 + 2.0, 1.0));
    // far hills and ground reflected
    refl = mix(refl, vec3(0.020, 0.06, 0.09), smoothstep(h1 + 0.0, h1 + 0.01, pm.y));
    vec3 water = mix(vec3(0.006, 0.030, 0.050), vec3(0.020, 0.060, 0.090), smoothstep(0.69, 0.93, p.y));
    float fres = 0.42 + 0.5 * smoothstep(0.69, 0.80, p.y);
    vec3 wcol = water + refl * 0.70 * fres;
    // plants mirrored in the water
    for (int i = 0; i < 8; i++) {
      vec4 prm = ag_mp(i, asp);
      vec3 gcI = ag_mc(i);
      float seed = float(i) * 0.37 + 0.11;
      vec2 mq = vec2(p.x + disp.x * 2.0, 2.0 * prm.y - p.y + disp.y);
      if (p.y > prm.y) {
        vec3 addR;
        vec4 mr = ag_mush(mq, prm, gcI, seed, boost, t, addR);
        wcol = mix(wcol, mr.rgb * 0.60, mr.a * 0.60);
        wcol += addR * 0.5;
      }
    }
    wcol += vec3(0.5, 0.9, 0.9) * ripGlint * 0.04;
    // shore: a thin bright lip, darker toward the middle
    float lip = smoothstep(0.93, 1.0, pr) * pond;
    wcol += AG_TEAL * lip * 0.28 * (0.5 + 0.5 * ag_noise(vec2(p.x * 60.0, 2.0)));
    col = mix(col, wcol, pond);
  }

  // ---------- small glowing blooms scattered over the meadow
  {
    float depth = clamp((p.y - 0.69) / 0.31, 0.0, 1.0);
    float scl = 40.0;
    vec2 fq = vec2(p.x * scl, (p.y - 0.69) * scl * 2.0);
    vec2 fid = floor(fq);
    float fh = ag_hash(fid + 40.0);
    vec2 fj = vec2(0.5 + 0.34 * (ag_hash(fid + 3.0) - 0.5), 0.5 + 0.34 * (ag_hash(fid + 8.0) - 0.5));
    vec2 fd = (fract(fq) - fj) * vec2(1.0, 0.5);
    float fon = step(0.80, fh) * step(0.0, p.y - 0.70) * (1.0 - pond);
    float bsz = 0.010 + 0.010 * depth;
    float bsc = 0.55 + 0.9 * depth;
    float bloom = smoothstep(0.30 * bsc, 0.0, length(fd)) * fon;
    float stem = smoothstep(0.045, 0.0, abs(fd.x)) * step(0.0, fd.y) * step(fd.y, 0.35) * fon * 0.35;
    vec3 fc = fh < 0.82 ? AG_TEAL : (fh < 0.92 ? AG_VIOLET : AG_CORAL);
    float fpulse = 0.7 + 0.3 * sin(t * 0.8 + fh * 60.0);
    col += fc * (bloom * 0.55 + exp(-dot(fd, fd) * 40.0 / (bsc * bsc)) * fon * 0.18) * fpulse * boost * (0.5 + 0.8 * depth);
    col = mix(col, vec3(0.010, 0.040, 0.050), stem * 0.0);
  }

  // ---------- plants: far to near
  for (int i = 0; i < 8; i++) {
    vec4 prm = ag_mp(i, asp);
    vec3 gcI = ag_mc(i);
    float seed = float(i) * 0.37 + 0.11;
    vec3 addC;
    vec4 mc = ag_mush(p, prm, gcI, seed, boost, t, addC);
    col = mix(col, mc.rgb, mc.a);
    col += addC * (1.0 - 0.5 * pond);
    if (i == 3) {
      // mid ferns, on the far bank
      vec4 f0 = ag_fern(p, vec3(asp * 0.46, 0.700, 0.060), AG_TEAL, 1.3, boost, t);
      col = mix(col, f0.rgb, f0.a);
      vec4 f1 = ag_fern(p, vec3(asp * 0.67, 0.695, 0.070), AG_VIOLET, 2.1, boost, t);
      col = mix(col, f1.rgb, f1.a);
    }
  }
  // big foreground ferns
  vec4 fa = ag_fern(p, vec3(asp * 0.255, 0.915, 0.250), AG_TEAL, 3.7, boost, t);
  col = mix(col, fa.rgb, fa.a);
  vec4 fb = ag_fern(p, vec3(asp * 0.785, 0.935, 0.230), AG_VIOLET, 5.3, boost, t);
  col = mix(col, fb.rgb, fb.a);

  // ---------- grass and low tufts along the bottom, tips glowing
  {
    float gx = p.x * 26.0 + (1.0 - p.y) * 3.0 * sin(t * 0.5 + p.x * 3.0) + (1.0 - p.y) * 2.0;
    float gcell = floor(gx);
    float gtri = 1.0 - abs(fract(gx) - 0.5) * 2.0;
    float gh = ag_hash(vec2(gcell, 11.0));
    float edge = abs(p.x - asp * 0.5) / (asp * 0.5);                // taller toward the sides of the screen
    float hh = (0.020 + 0.085 * gh * gh) * (0.40 + 1.4 * edge * edge);
    hh *= 0.75 + 0.25 * sin(t * 0.6 + gcell * 0.7);
    float ytop = 1.0 - hh * pow(gtri, 2.3);
    float blade = smoothstep(ytop - 0.0015, ytop + 0.002, p.y);
    float tipd = (p.y - ytop);
    vec3 tipC = gh < 0.35 ? AG_TEAL : (gh < 0.7 ? AG_VIOLET : AG_CORAL);
    vec3 gc2 = vec3(0.008, 0.012, 0.025) + tipC * smoothstep(0.016, 0.0, tipd) * 0.6 * boost;
    col = mix(col, gc2, blade);
  }

  // ---------- floating spores, lifted where the pointer is
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    float lift = onScr ? exp(-dot(p - mp, p - mp) / 0.050) : 0.0;
    vec2 sp = p + vec2(0.0, 0.07 * lift * (1.0 - 0.4 * fl));
    float scl = 16.0 + 14.0 * fl;
    vec2 sq = sp * scl + vec2(t * (0.10 + 0.05 * fl) + fl * 7.0, t * (0.22 + 0.10 * fl) + fl * 3.0);
    vec2 sid = floor(sq);
    float sh = ag_hash(sid + fl * 31.0);
    vec2 jc = 0.5 + 0.30 * vec2(sin(t * 0.5 + sh * 40.0), cos(t * 0.43 + sh * 25.0)) + 0.25 * (vec2(ag_hash(sid + 3.3), ag_hash(sid + 9.1)) - 0.5);
    float dd = length(fract(sq) - jc);
    float on = step(0.76, sh);
    float tw = 0.55 + 0.45 * sin(t * (0.9 + sh * 1.4) + sh * 70.0);
    float spore = on * (exp(-dd * dd * (320.0 - 90.0 * fl)) + exp(-dd * dd * 30.0) * 0.22) * tw;
    vec3 sc = sh < 0.82 ? AG_TEAL : (sh < 0.90 ? AG_VIOLET : (sh < 0.96 ? AG_CORAL : vec3(1.0, 0.95, 0.85)));
    col += sc * spore * (0.45 + 0.9 * lift) * (0.6 + 0.4 * smoothstep(0.30, 0.9, p.y));
  }

  // vignette
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
  col = col / (1.0 + col * 0.22);
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
