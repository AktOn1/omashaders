// label: Pirate cove
// hint: a moonlit hidden cove: palm silhouettes, a skull-shaped rock, waves lapping the sand and a half-open treasure chest glowing gold at the water line, a boat's lantern far out; the pointer makes coins glint and draws the chest glow toward it
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
float pc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pc_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pc_hash(i), pc_hash(i + vec2(1, 0)), f.x), mix(pc_hash(i + vec2(0, 1)), pc_hash(i + vec2(1, 1)), f.x), f.y);
}
float pc_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * pc_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float pc_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * pc_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float pc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float pc_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float pc_box(vec2 q, vec2 h, float r) {
  vec2 d = abs(q) - h + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
// the skull-shaped rock: q is relative to the middle of the cranium (y down); cut = the sockets, nose and teeth gaps
float pc_rock(vec2 q, out float cut) {
  float rough = pc_fbm3(q * 17.0 + 3.0) - 0.5;
  float big = pc_fbm3(q * 6.0 + 9.0) - 0.5;
  float cran = length(q / vec2(0.094, 0.100)) - 1.0 + 0.40 * rough + 0.20 * big;
  float cheek = length((q - vec2(0.0, 0.072)) / vec2(0.074, 0.046)) - 1.0 + 0.35 * rough;
  float jaw = pc_box(q - vec2(0.0, 0.118), vec2(0.046, 0.034), 0.008) + 0.020 * rough;
  float neck = length((q - vec2(0.0, 0.215)) / vec2(0.115, 0.075)) - 1.0 + 0.30 * rough + 0.2 * big;
  float bl = length((q - vec2(-0.150, 0.300)) / vec2(0.090, 0.058)) - 1.0 + 0.35 * rough;
  float br = length((q - vec2(0.150, 0.295)) / vec2(0.100, 0.066)) - 1.0 + 0.35 * rough;
  float bm = length((q - vec2(0.0, 0.335)) / vec2(0.250, 0.052)) - 1.0 + 0.30 * rough;
  float d = min(min(min(cran, cheek * 0.8), min(jaw, neck)), min(min(bl, br), bm));
  float m = smoothstep(0.012, -0.004, d);
  float eyeL = length(((q - vec2(-0.037, 0.006)) * mat2(1.0, 0.18, -0.18, 1.0)) / vec2(0.023, 0.028)) - 1.0 + 0.45 * rough;
  float eyeR = length(((q - vec2(0.038, 0.006)) * mat2(1.0, -0.18, 0.18, 1.0)) / vec2(0.023, 0.028)) - 1.0 + 0.45 * rough;
  float nose = max(abs(q.x) - (q.y - 0.046) * 0.34, 0.0) + max(0.046 - q.y, q.y - 0.080) * 0.5 + 0.3 * rough * 0.02;
  float s1 = smoothstep(0.003, 0.001, abs(q.x + 0.030)) * step(q.y, 0.118 + 0.026 * pc_hash(vec2(1.0, 3.0)));
  float s2 = smoothstep(0.003, 0.001, abs(q.x + 0.010)) * step(q.y, 0.118 + 0.032);
  float s3 = smoothstep(0.003, 0.001, abs(q.x - 0.012)) * step(q.y, 0.118 + 0.022);
  float s4 = smoothstep(0.003, 0.001, abs(q.x - 0.033)) * step(q.y, 0.118 + 0.030);
  float slit = (s1 + s2 + s3 + s4) * step(0.108, q.y);
  cut = max(max(smoothstep(0.008, -0.004, eyeL), smoothstep(0.008, -0.004, eyeR)), max(smoothstep(0.004, 0.0, nose) * step(0.046, q.y) * step(q.y, 0.084), clamp(slit, 0.0, 1.0)));
  return m;
}
vec2 pc_segh(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}
// a palm: trunk and fronds, silhouette mask
float pc_palm(vec2 p, vec2 crown, vec2 base, float sc, float sd, float t) {
  float m = 0.0;
  float u = (p.y - crown.y) / (base.y - crown.y);
  float cx = mix(crown.x, base.x, u) + 0.05 * sc * sin(u * 2.4) * sign(base.x - crown.x + 0.0001);
  float w = (0.0095 + 0.010 * u) * sc;
  float rings = 0.8 + 0.2 * step(0.5, fract(u * 26.0));
  m = step(0.0, u) * step(u, 1.0) * smoothstep(w * rings, w * rings * 0.7, abs(p.x - cx));
  m = max(m, smoothstep(0.022 * sc, 0.012 * sc, length(p - crown - vec2(0.0, 0.008 * sc))));
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float a = -3.00 + fi * 0.355 + (pc_hash(vec2(fi, sd)) - 0.5) * 0.18;
    a += 0.035 * sin(t * 0.55 + fi * 1.3 + sd);
    float len = (0.185 + 0.060 * pc_hash(vec2(fi, sd + 3.0))) * sc;
    float side = abs(a + 1.5708);
    float drop = (0.035 + 0.15 * side) * sc;
    vec2 dir = vec2(cos(a), sin(a));
    vec2 prev = crown;
    for (int j = 1; j <= 4; j++) {
      float s = float(j) * 0.25;
      vec2 pt = crown + dir * len * s + vec2(0.0, 1.0) * drop * s * s;
      vec2 dh = pc_segh(p, prev, pt);
      float st = s - 0.25 + dh.y * 0.25;
      float wd = 0.0125 * sc * (1.0 - st * 0.78) * (0.62 + 0.38 * abs(sin(st * 40.0 + fi)));
      m = max(m, smoothstep(wd, wd * 0.6, dh.x));
      prev = pt;
    }
  }
  return m;
}
// a four-point glint
float pc_star(vec2 d, float r) {
  float core = exp(-dot(d, d) / (r * r));
  float cross = exp(-abs(d.x) / (r * 0.28)) * exp(-abs(d.y) / (r * 5.0)) + exp(-abs(d.y) / (r * 0.28)) * exp(-abs(d.x) / (r * 5.0));
  return core + 0.6 * cross;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = onScr ? vec2(m.x * asp, m.y) : vec2(-9.0);
  float t = time;
  vec3 pic = wall(uv);
  float pl = pc_luma(pic);
  const float HZ = 0.47;
  vec3 moonC = vec3(0.70, 0.84, 1.0);
  vec3 goldC = vec3(1.0, 0.70, 0.22);

  vec2 MO = vec2(asp * 0.72, 0.17);
  // ---- sky
  float upS = clamp((HZ - uv.y) / HZ, 0.0, 1.0);
  vec3 sky = mix(vec3(0.075, 0.180, 0.215), vec3(0.012, 0.030, 0.075), pow(upS, 0.7));
  float cloud = pc_fbm(vec2(p.x * 1.3 - t * 0.008, p.y * 3.4) + pc_fbm3(p * 2.2 + t * 0.006) * 1.1);
  float mD = length(p - MO);
  vec3 skyCol = sky * (0.75 + 0.5 * smoothstep(0.30, 0.75, cloud));
  skyCol += moonC * exp(-mD * mD / 0.030) * 0.30 * (0.6 + 0.6 * cloud);
  skyCol += moonC * exp(-mD * mD / 0.35) * 0.10;
  skyCol += pic * vec3(0.55, 0.75, 0.9) * 0.13;                                 // the picture shows through
  float disc = smoothstep(0.0300, 0.0275, mD);
  skyCol = mix(skyCol, vec3(0.90, 0.96, 1.0) * (0.92 + 0.08 * pc_noise(p * 90.0)), disc);
  vec3 col = skyCol;

  // ---- the sea
  float depth = max(uv.y - HZ, 0.0);
  vec3 sea = mix(vec3(0.060, 0.170, 0.200), vec3(0.008, 0.050, 0.070), smoothstep(0.0, 0.30, depth));
  float ws = pc_fbm3(vec2(p.x * (2.0 + 8.0 * depth), depth * 70.0 - t * 0.12));
  sea *= 0.65 + 0.75 * ws;
  sea += moonC * exp(-pow((p.x - MO.x) / (0.12 + 0.55 * depth), 2.0)) * 0.05;
  float gn = pc_noise(vec2(p.x * 55.0, depth * 120.0 - t * 0.35)) * 0.6 + pc_noise(vec2(p.x * 21.0, depth * 60.0 + t * 0.2)) * 0.4;
  float glit = smoothstep(0.58, 0.82, gn) * exp(-pow((p.x - MO.x) / (0.035 + 0.30 * depth), 2.0)) * smoothstep(0.0, 0.02, depth);
  sea += moonC * glit * 0.60;
  float rip = smoothstep(0.62, 0.85, pc_noise(vec2(p.x * 7.0 + t * 0.03, depth * 130.0 - t * 0.15))) * smoothstep(0.0, 0.03, depth);
  sea += moonC * rip * 0.045 * (0.4 + 3.0 * exp(-pow((p.x - MO.x) / 0.5, 2.0)));
  col = mix(col, sea, smoothstep(HZ - 0.002, HZ + 0.002, uv.y));
  // horizon haze
  col += vec3(0.10, 0.22, 0.25) * exp(-pow((uv.y - HZ) / 0.012, 2.0)) * 0.35;

  // ---- the far boat with its lantern
  vec2 bp = vec2(asp * 0.585, HZ);
  float hullB = step(abs(p.x - bp.x), 0.020 - (bp.y - uv.y) * 1.6) * step(bp.y - 0.0075, uv.y) * step(uv.y, bp.y + 0.001);
  float mast = step(abs(p.x - (bp.x - 0.002)), 0.0009) * step(bp.y - 0.040, uv.y) * step(uv.y, bp.y);
  float sailB = step(bp.y - 0.036, uv.y) * step(uv.y, bp.y - 0.008) * step(p.x, bp.x + 0.001 + (uv.y - (bp.y - 0.036)) * 0.0) * step(bp.x - 0.002 - (uv.y - (bp.y - 0.036)) * 0.55, p.x);
  float boat = max(max(hullB, mast), sailB * 0.9);
  col = mix(col, vec3(0.006, 0.012, 0.018), boat);
  vec2 lp = vec2(bp.x + 0.013, bp.y - 0.009);
  float lf = 0.80 + 0.20 * pc_noise(vec2(t * 6.0, 2.0)) + 0.05 * sin(t * 2.3);
  float ld = length(p - lp);
  col += goldC * (exp(-ld * ld / 0.000012) * 0.9 + exp(-ld * ld / 0.00035) * 0.55 + exp(-ld * ld / 0.006) * 0.08) * lf;
  float lrefl = exp(-pow((p.x - lp.x + (pc_noise(vec2(depth * 200.0, t * 0.5)) - 0.5) * 0.01) / (0.003 + 0.01 * depth), 2.0)) * smoothstep(0.0, 0.01, depth) * exp(-depth * 20.0);
  lrefl *= 0.4 + 0.6 * smoothstep(0.4, 0.8, pc_noise(vec2(depth * 260.0, t * 0.6)));
  col += goldC * lrefl * lf * 0.55 * step(HZ, uv.y);

  // ---- shoreline: the swash comes and goes
  float swash = 0.5 + 0.5 * sin(t * 0.55 + p.x * 0.8);
  float sy = 0.775 + 0.012 * sin(p.x * 2.6 + 0.7) + 0.025 * swash + 0.004 * sin(p.x * 11.0 + t * 0.4);
  float inSand = smoothstep(sy - 0.002, sy + 0.002, uv.y);
  float wetD = clamp((uv.y - sy) / 0.07, 0.0, 1.0);
  float grain = 0.92 + 0.16 * pc_noise(p * vec2(120.0, 160.0));
  vec3 sand = mix(vec3(0.24, 0.30, 0.30), vec3(0.34, 0.37, 0.34), smoothstep(0.0, 0.8, wetD));   // wet sand is darker nearer the water
  sand *= grain * (0.8 + 0.5 * pc_fbm3(p * 5.0));
  sand += moonC * exp(-pow((p.x - MO.x) / 0.45, 2.0)) * 0.09;
  sand += moonC * smoothstep(0.03, 0.0, uv.y - sy) * 0.10 * (0.5 + 0.5 * pc_noise(vec2(p.x * 20.0, 1.0)));   // wet sheen
  // lines left by earlier waves
  float rl = smoothstep(0.003, 0.0, abs(uv.y - (sy + 0.032 + 0.012 * sin(p.x * 3.1)))) * 0.10;
  sand += moonC * rl * smoothstep(0.35, 0.65, pc_noise(vec2(p.x * 14.0, 4.0)));
  col = mix(col, sand, inSand);
  // moonlit foam at the water's edge, with a lace of bubbles left behind
  float edge = uv.y - sy;
  float foam = exp(-pow(edge / 0.0045, 2.0)) * (0.55 + 0.45 * pc_noise(vec2(p.x * 38.0 - t * 0.3, t * 0.5)));
  float lace = smoothstep(0.62, 0.9, pc_noise(vec2(p.x * 60.0, uv.y * 150.0 + t * 0.1))) * smoothstep(0.0, 0.004, edge) * smoothstep(0.045, 0.004, edge) * (0.3 + 0.7 * swash);
  float lace2 = smoothstep(0.55, 0.85, pc_noise(vec2(p.x * 40.0 - t * 0.4, uv.y * 90.0))) * smoothstep(-0.05, -0.004, edge) * smoothstep(0.0, -0.004, edge) * 0.4;
  col += vec3(0.65, 0.82, 0.90) * (foam * 0.65 + lace * 0.35 + lace2 * 0.3);

  // ---- skull rock, on the left, standing in the shallows
  vec2 sk = vec2(asp * 0.19, 0.395);
  float cut;
  float rock = pc_rock(p - sk, cut);
  float cutB;
  float rockOff = pc_rock(p - sk + vec2(0.0095, -0.0095), cutB);               // toward the moon
  float rockM = rock * (1.0 - cut);
  float rockOffM = rockOff * (1.0 - cutB);
  float strata = 0.7 + 0.5 * pc_noise(vec2(p.x * 45.0, p.y * 14.0));
  vec3 rockC = vec3(0.045, 0.065, 0.085) * strata;
  float rim = clamp(rockM - rockOffM, 0.0, 1.0);
  rockC += moonC * rim * (0.16 + 0.30 * pc_noise(p * 60.0)) + moonC * 0.16 * strata * smoothstep(-0.06, 0.12, (p.x - sk.x)) * smoothstep(0.78, 0.30, uv.y);
  rockC += moonC * 0.04 * pc_fbm3((p - sk) * 24.0);
  col = mix(col, rockC, rockM);
  col = mix(col, col * 0.40 + vec3(0.003, 0.008, 0.012), rock * cut);          // the sockets are deep shadow with the night behind
  // the sea tucked around its foot, and a dark smear of its reflection

  // ---- the treasure chest, half open, at the water line
  vec2 cp = vec2(asp * 0.505, 0.845);
  float near = exp(-length(mp - (cp + vec2(0.0, -0.05))) * 2.4) * step(0.0, mp.x);
  float flick = 0.88 + 0.12 * sin(t * 1.3) + 0.06 * pc_noise(vec2(t * 5.0, 7.0));
  float gl = flick * (1.0 + 0.8 * near);
  vec2 oc = cp + vec2(0.0, -0.070);                                              // the opening
  vec2 c = (p - cp) / 1.25;
  // light shaft from the opening, leaning toward the pointer
  vec2 up = vec2(0.0, -1.0);
  vec2 toP = mp - oc;
  vec2 shaftD = normalize(mix(up, toP / max(length(toP), 0.05), 0.55 * near * 1.6 * step(0.0, mp.x)) + vec2(0.0, 0.0001));
  vec2 rel = p - oc;
  float along = dot(rel, shaftD);
  float perp = dot(rel, vec2(-shaftD.y, shaftD.x));
  float shaft = exp(-pow(perp / (0.018 + 0.20 * max(along, 0.0)), 2.0)) * smoothstep(0.0, 0.03, along) * exp(-max(along, 0.0) * 4.2);
  shaft *= 0.6 + 0.8 * pc_fbm3(vec2(perp * 18.0, along * 6.0 - t * 0.3));
  col += goldC * shaft * 0.38 * gl;
  float od = length(rel * vec2(1.0, 1.25));
  col += goldC * (exp(-od * od / 0.0035) * 0.55 + exp(-od * od / 0.030) * 0.30 + exp(-od * od / 0.20) * 0.07) * gl;
  // gold on the wet sand and the foam in front of the chest
  col += goldC * exp(-pow((p.x - cp.x) / 0.16, 2.0)) * exp(-abs(uv.y - (cp.y + 0.010)) / 0.030) * 0.22 * gl * inSand;
  // body
  float body = smoothstep(0.003, -0.002, pc_box(c - vec2(0.0, -0.026), vec2(0.056, 0.026), 0.004));
  vec2 lc = vec2(c.x + (c.y + 0.058) * 0.20, c.y + 0.092);
  float lid = smoothstep(0.003, -0.002, pc_box(lc, vec2(0.054, 0.034), 0.010));
  float lidIn = smoothstep(0.003, -0.002, pc_box(lc, vec2(0.046, 0.027), 0.006));
  vec3 woodC = vec3(0.060, 0.034, 0.022) * (0.7 + 0.6 * pc_noise(vec2(c.x * 90.0, c.y * 20.0)));
  woodC += goldC * 0.10 * gl * smoothstep(-0.05, -0.02, c.y);
  float straps = step(abs(abs(c.x) - 0.034), 0.0042) + step(abs(c.x), 0.0040) * 0.0;
  vec3 bodyC = mix(woodC, vec3(0.025, 0.026, 0.030), clamp(straps, 0.0, 1.0));
  bodyC += goldC * 0.60 * gl * smoothstep(0.004, 0.0, abs(c.y + 0.051)) ;      // lit top edge
  col = mix(col, vec3(0.020, 0.012, 0.010), lid);
  vec3 lidC = mix(goldC * vec3(0.55, 0.30, 0.10), goldC * vec3(0.95, 0.60, 0.20), smoothstep(-0.12, -0.065, c.y)) * gl;
  col = mix(col, lidC * (0.7 + 0.3 * pc_noise(lc * 80.0)), lidIn);
  col = mix(col, bodyC, body);
  // the heap of coins in the opening
  float heapTop = -0.050 - 0.017 * (1.0 - pow(abs(c.x) / 0.050, 2.0));
  float heap = step(abs(c.x), 0.050) * step(heapTop, c.y) * step(c.y, -0.046);
  float cn = pc_noise(vec2(c.x * 120.0, c.y * 120.0));
  vec3 heapC = mix(vec3(0.70, 0.42, 0.10), vec3(1.0, 0.86, 0.45), smoothstep(0.25, 0.85, cn)) * (0.9 + 0.3 * gl);
  col = mix(col, heapC, heap);
  // gold lock plate
  float lock = smoothstep(0.003, -0.001, pc_box(c - vec2(0.0, -0.034), vec2(0.007, 0.0085), 0.002));
  col = mix(col, vec3(0.95, 0.72, 0.28) * (0.7 + 0.4 * gl), lock);
  // twinkles on the heap
  float tw = 0.0;
  for (int k = 0; k < 4; k++) {
    float kf = float(k);
    vec2 gp = oc + vec2((pc_hash(vec2(kf, 1.0)) - 0.5) * 0.110, -0.002 - 0.016 * pc_hash(vec2(kf, 2.0)));
    float ph = max(sin(t * (0.9 + 0.3 * kf) + kf * 2.4), 0.0);
    tw += pc_star(p - gp, 0.0045) * pow(ph, 6.0);
  }
  col += vec3(1.0, 0.95, 0.75) * tw * 0.7;

  // ---- coins glint near the pointer
  float glints = 0.0;
  for (int k = 0; k < 2; k++) {
    float kf = float(k);
    vec2 g = p * vec2(26.0 + 10.0 * kf, 26.0 + 10.0 * kf) + vec2(kf * 5.3, kf * 2.1);
    vec2 gi = floor(g), gf = fract(g);
    float h1 = pc_hash(gi + kf * 17.0), h2 = pc_hash(gi + 5.0 + kf * 3.0), h3 = pc_hash(gi + 11.0);
    vec2 gpos = (gi + vec2(0.2 + 0.6 * h1, 0.2 + 0.6 * h2)) / (26.0 + 10.0 * kf);
    float dmp = length(gpos - mp);
    float pres = exp(-dmp * dmp / 0.012);
    float ph = pow(max(sin(t * (1.0 + h3 * 1.6) + h1 * 40.0), 0.0), 8.0);
    glints += pc_star(p - gpos, 0.0060) * pres * ph * step(0.45, h3);
  }
  col += vec3(1.0, 0.90, 0.55) * glints * 1.1 * step(0.0, mp.x);

  // ---- palms in the foreground (silhouettes), the moon rims their fronds
  float palmA = pc_palm(p, vec2(asp * 0.905, 0.270), vec2(asp * 0.955, 1.04), 1.35, 1.0, t);
  float palmB = pc_palm(p, vec2(asp * 0.815, 0.470), vec2(asp * 0.775, 1.05), 0.95, 4.0, t);
  float palmC = pc_palm(p, vec2(asp * 0.030, 0.330), vec2(asp * 0.000, 0.98), 1.2, 7.0, t);
  float palm = max(max(palmA, palmB), palmC);
  vec3 palmCol = vec3(0.004, 0.009, 0.013) + moonC * 0.035 * pc_noise(p * 40.0) * smoothstep(0.7, 0.1, uv.y);
  col = mix(col, palmCol, palm);

  // vignette
  col *= 1.0 - 0.48 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
