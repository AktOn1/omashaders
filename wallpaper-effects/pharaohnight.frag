// label: Pharaoh's night
// hint: three pyramids and a torch-lit stone avenue under the Milky Way, now and then a slow shooting star, wind-blown sand ribbons on the dune crests and a small camp fire far away; the sand ribbons stir and lift near the pointer
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
float pn_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pn_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pn_hash(i), pn_hash(i + vec2(1, 0)), f.x), mix(pn_hash(i + vec2(0, 1)), pn_hash(i + vec2(1, 1)), f.x), f.y);
}
float pn_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * pn_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float pn_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * pn_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float pn_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// pyramid mask: x = inside, y = 1 on the lit (left) face
vec2 pn_pyr(vec2 p, float cx, float hw, float h, float base) {
  float dx = p.x - cx;
  float edge = base - h * (1.0 - abs(dx) / hw);
  float m = smoothstep(edge - 0.0015, edge + 0.0015, p.y) * step(p.y, base + 0.01) * step(abs(dx), hw);
  return vec2(m, dx < 0.0 ? 1.0 : 0.0);
}

float pn_stars(vec2 p, float scale, float thr, float rad, float t) {
  vec2 g = p * scale;
  vec2 c = floor(g);
  float h = pn_hash(c);
  if (h < thr) return 0.0;
  vec2 o = vec2(pn_hash(c + 7.0), pn_hash(c + 13.0)) * 0.6 + 0.2;
  float d = length(fract(g) - o);
  float tw = 0.65 + 0.35 * sin(t * (0.8 + h * 2.5) + h * 60.0);
  return smoothstep(rad, 0.0, d) * tw * (0.4 + 0.9 * fract(h * 37.0));
}

float pn_crest(float x, float fi, float vpx) {
  float gD = smoothstep(0.08, 0.50, abs(x - vpx));
  float base = fi < 0.5 ? 0.80 : 0.91;
  float amp = fi < 0.5 ? 0.075 : 0.10;
  return base - amp * gD * (0.55 + 0.45 * sin(x * (2.6 + 1.3 * fi) + fi * 2.0)) - 0.012 * pn_noise(vec2(x * 5.0, fi));
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
  float HZ = 0.70;

  // ---- sky: lapis dark to deep blue, a faint gold-rose breath of far light on the horizon
  vec3 col = mix(vec3(0.015, 0.025, 0.10), vec3(0.07, 0.10, 0.28), smoothstep(0.0, HZ, uv.y));
  col += vec3(0.40, 0.26, 0.20) * exp(-pow((uv.y - HZ) / 0.07, 2.0)) * 0.50;
  // Milky Way: a broad diagonal band with dust lanes and a bright core
  vec2 mc = p - vec2(0.50 * asp, 0.34);
  vec2 wp = mc + 0.10 * vec2(pn_fbm3(p * 2.5 + 3.0), pn_fbm3(p * 2.5 + 8.0)) - 0.05;
  float sb = dot(wp, normalize(vec2(0.62, 0.78)));
  float band = exp(-sb * sb / 0.016);
  float core = exp(-pow(dot(wp, normalize(vec2(0.78, -0.62))) / 0.40, 2.0));
  float cloud = pn_fbm(p * vec2(5.0, 5.0) + 2.0);
  float lane = smoothstep(0.52, 0.72, pn_fbm(p * vec2(6.0, 9.0) + 14.0));
  float mw = band * (0.45 + 0.9 * cloud) * (1.0 - 0.7 * lane * band);
  col += mix(vec3(0.20, 0.26, 0.55), vec3(0.78, 0.72, 0.62), core * 0.8) * mw * 0.55;
  // stars, denser inside the band
  float sd = pn_stars(p, 110.0, 0.945 - 0.05 * band, 0.30, t) + 1.4 * pn_stars(p + 3.1, 52.0, 0.972 - 0.02 * band, 0.26, t) + 0.9 * pn_stars(p * 1.0 + 9.0, 220.0, 0.965 - 0.05 * band, 0.34, t);
  col += vec3(0.85, 0.88, 1.0) * sd * 0.85;
  // a slow shooting star every eleven seconds
  {
    float cyc = floor(t / 11.0);
    float k = fract(t / 11.0) / 0.12;
    if (k < 1.0) {
      vec2 st0 = vec2(asp * (0.45 + 0.4 * pn_hash(vec2(cyc, 1.0))), 0.08 + 0.12 * pn_hash(vec2(cyc, 2.0)));
      vec2 dir = normalize(vec2(-0.85, 0.42));
      vec2 head = st0 + dir * k * 0.50;
      vec2 tl = p - head;
      float al = dot(tl, -dir);
      float dd = length(tl + dir * al);
      float trail = exp(-dd * dd / 0.000012) * smoothstep(0.0, 0.02, al) * smoothstep(0.26, 0.0, al);
      trail += exp(-dot(tl, tl) / 0.00012) * 1.5;
      col += vec3(1.0, 0.92, 0.72) * trail * sin(k * 3.14159) * 0.9;
    }
  }

  // ---- the three pyramids, the farthest first and hazier
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float pcx = asp * (0.40 + 0.0 * fi);
    float hw = 0.07;
    float ph = 0.07;
    if (i == 0) { pcx = asp * 0.47; hw = 0.10; ph = 0.11; }
    if (i == 1) { pcx = asp * 0.58; hw = 0.17; ph = 0.19; }
    if (i == 2) { pcx = asp * 0.69; hw = 0.24; ph = 0.27; }
    vec2 pm = pn_pyr(p, pcx, hw, ph, HZ + 0.004 + 0.0 * fi);
    if (pm.x > 0.0) {
      float hgt = (HZ - p.y) / ph;
      vec3 lit = vec3(0.26, 0.29, 0.52);
      vec3 shd = vec3(0.05, 0.06, 0.16);
      vec3 pc = mix(shd, lit, pm.y);
      pc *= 0.82 + 0.28 * pn_noise(vec2(p.x * 160.0, p.y * 300.0));
      pc *= 0.90 + 0.12 * step(0.5, fract(p.y * 70.0));                           // stone courses
      pc = mix(pc, vec3(0.28, 0.20, 0.26), (1.0 - smoothstep(0.0, 0.35, hgt)) * 0.35);    // horizon haze at the base
      pc += vec3(0.50, 0.46, 0.60) * smoothstep(0.012, 0.0, abs(p.x - pcx)) * 0.25 * smoothstep(0.0, 0.9, hgt);   // lit ridge edge
      pc += vec3(0.90, 0.72, 0.35) * smoothstep(0.82, 1.0, hgt) * 0.18 * pm.y;           // star-gold at the tips
      col = mix(col, pc * (0.65 + 0.12 * fi), pm.x);
    }
  }

  // ---- the desert plane
  float s = uv.y - HZ;
  if (s > 0.0) {
    vec3 sand = mix(vec3(0.12, 0.12, 0.26), vec3(0.04, 0.05, 0.13), smoothstep(0.0, 0.30, s));
    float rip = pn_noise(vec2(p.x * 40.0, s * 400.0)) * 0.4 + pn_noise(vec2(p.x * 9.0, s * 90.0)) * 0.6;
    sand *= 0.75 + 0.55 * rip;
    sand += vec3(0.48, 0.34, 0.28) * exp(-s * 24.0) * 0.30;                                  // horizon glow on the sand
    col = mix(col, sand, smoothstep(0.0, 0.002, s));
  }

  // ---- the long stone avenue to the great pyramid, torch-lit pillars along it
  float vpx = asp * 0.69;
  {
    float dxA = p.x - vpx;
    float hwA = 0.012 + 0.78 * s;
    if (s > 0.0 && abs(dxA) < hwA) {
      float z = 0.045 / (s + 0.003);
      float u = dxA / hwA;
      vec3 road = vec3(0.34, 0.35, 0.52) * (0.80 + 0.30 * pn_noise(vec2(u * 8.0, floor(z * 1.2) * 3.0)));
      float seam = smoothstep(0.03, 0.10, fract(z * 1.2)) * smoothstep(0.02, 0.07, fract(u * 2.0 + 0.5));
      road *= 0.45 + 0.55 * seam;
      road *= 0.35 + 0.95 * exp(-s * 3.5);
      road += vec3(0.55, 0.40, 0.20) * exp(-s * 35.0) * 0.30;
      col = mix(col, road, smoothstep(hwA, hwA - 0.004 - s * 0.02, abs(dxA)));
    }
    for (int i = 0; i < 8; i++) {
      float sk = 0.30 * pow(0.62, float(i));
      float sc = sk / 0.30;
      float yk = HZ + sk;
      for (int j = 0; j < 2; j++) {
        float sg = j == 0 ? -1.0 : 1.0;
        float px = vpx + sg * (0.012 + 0.78 * sk) * 1.22;
        float wk = 0.020 * sc + 0.0015;
        float hk = 0.15 * sc + 0.004;
        vec2 q = vec2(p.x - px, p.y - yk);
        if (abs(q.x) < wk && q.y < 0.0 && q.y > -hk) {
          float side = q.x / wk;
          vec3 pc = mix(vec3(0.36, 0.38, 0.60), vec3(0.08, 0.09, 0.20), smoothstep(-0.9, 0.9, side));
          pc *= 0.85 + 0.2 * pn_noise(p * 120.0);
          pc *= 0.4 + 0.6 * smoothstep(0.0, 0.2, -q.y / hk + 0.2);
          col = pc * (0.5 + 0.5 * exp(-sk * 2.0));
        }
        // torch flame on top of each pillar
        vec2 tq = vec2(p.x - px, p.y - (yk - hk - 0.008 * sc));
        float fl = exp(-(tq.x * tq.x / (0.00008 * sc * sc + 0.0000015) + tq.y * tq.y / (0.00020 * sc * sc + 0.000003)));
        col += vec3(1.0, 0.62, 0.20) * fl * (0.9 + 0.1 * sin(t * 8.0 + float(i) * 2.0 + sg));
        col += vec3(0.80, 0.45, 0.12) * exp(-dot(tq, tq) / (0.0030 * sc * sc + 0.00002)) * 0.22;
      }
    }
  }

  // ---- dune crests left and right of the avenue, with sand ribbons blowing off them
  float gD = smoothstep(0.08, 0.50, abs(p.x - vpx));
  float gp = hasM ? exp(-dot(p - mp, p - mp) / 0.035) : 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float crest = pn_crest(p.x, fi, vpx);
    float sl = (pn_crest(p.x + 0.02, fi, vpx) - crest) / 0.02;
    float dc = uv.y - crest;
    if (dc > -0.002) {
      vec3 dn = mix(vec3(0.32, 0.27, 0.38), vec3(0.06, 0.07, 0.17), smoothstep(0.0, 0.10 + 0.04 * fi, dc));
      dn *= (0.62 + 0.75 * clamp(0.5 - sl * 2.5, 0.0, 1.0)) * (0.85 + 0.30 * pn_noise(vec2(p.x * 30.0, dc * 300.0 + fi)));
      dn += vec3(0.20, 0.17, 0.30) * clamp(0.5 - sl * 2.5, 0.0, 1.0) * exp(-dc * 14.0) * 0.5;
      dn += vec3(0.90, 0.68, 0.34) * exp(-dc * 70.0) * 0.30;                              // gold rim on the crest
      col = mix(col, dn, smoothstep(-0.002, 0.002, dc) * smoothstep(0.0, 0.02, gD * 3.0));
    }
    // sand ribbons: thin pale streaks that stream off the crest with the wind, stirred up by the pointer
    float lift = 0.014 * gp * sin(p.x * 38.0 - t * 5.0 + fi) + 0.045 * gp;
    float yy = uv.y - crest + lift;
    float up = -yy;
    float flow = p.x * 5.0 - t * (0.55 + 0.25 * fi) + fi * 4.0;
    float haze = pn_noise(vec2(flow * 2.0, up * 70.0 + 1.0)) * 0.6 + pn_noise(vec2(flow * 6.0 + 4.0, up * 180.0)) * 0.4;
    float rib = smoothstep(0.52, 0.80, haze) * smoothstep(-0.004, 0.006, up) * exp(-up * 55.0) * 0.45;
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float line = up - (0.007 + 0.016 * fj) - 0.005 * sin(flow * (3.0 + fj) + fj * 2.0 + t * 0.6) - 0.012 * gp * sin(p.x * 25.0 + t * 4.0 + fj);
      float dens = smoothstep(0.38, 0.72, pn_noise(vec2(flow * 1.4 + fj * 7.0 + fi * 3.0, fj + 2.0)));
      rib += smoothstep(0.0020, 0.0004, abs(line)) * dens * (1.0 - 0.15 * fj);
    }
    rib *= smoothstep(0.02, 0.18, gD) * (0.60 + 0.80 * pn_noise(vec2(flow * 0.9, fi * 5.0)));
    col += vec3(1.0, 0.84, 0.60) * rib * (0.70 + 1.1 * gp) * 0.85;
    col += vec3(1.0, 0.82, 0.50) * gp * exp(-abs(up) * 40.0) * 0.10 * smoothstep(0.05, 0.2, gD);
  }

  // ---- a small camp fire on a far dune, its glow warming the sand around
  {
    vec2 cp = vec2(0.20 * asp, HZ + 0.020);
    vec2 d = p - cp;
    float flick = 0.85 + 0.15 * sin(t * 9.0) * sin(t * 5.3 + 1.0);
    col += vec3(1.0, 0.52, 0.18) * exp(-dot(d * vec2(0.7, 1.4), d * vec2(0.7, 1.4)) / 0.0045) * 0.28 * flick;
    col += vec3(1.0, 0.60, 0.22) * exp(-(d.x * d.x / 0.000010 + pow((d.y + 0.004) / 0.008, 2.0))) * flick;
    // a tiny tent and the dark of two figures beside it
    float tent = step(abs(d.x + 0.020), 0.011 * (1.0 - (d.y + 0.020) / 0.020 * 1.0)) * step(-0.020, d.y) * step(d.y, 0.000) * step(0.0, -d.y - 0.0 + 0.020);
    float tent2 = step(abs(d.x + 0.022), 0.012 * clamp(1.0 + d.y / 0.018, 0.0, 1.0)) * step(-0.018, d.y) * step(d.y, 0.002);
    col = mix(col, vec3(0.03, 0.03, 0.07) + vec3(0.30, 0.15, 0.05) * smoothstep(0.0, 0.03, d.x + 0.032), tent2 * 0.9);
  }

  col += (w - pn_luma(w)) * 0.06;
  col *= 0.96 + 0.08 * pn_luma(w);
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
