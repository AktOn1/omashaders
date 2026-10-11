// label: Blood moon castle
// hint: a castle on a jagged crag under a huge red moon, thin clouds crossing the moon, one tower window lit and a flock of bats streaming past; the bats veer around the pointer
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
float bm_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bm_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bm_hash(i), bm_hash(i + vec2(1, 0)), f.x), mix(bm_hash(i + vec2(0, 1)), bm_hash(i + vec2(1, 1)), f.x), f.y);
}
float bm_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * bm_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float bm_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * bm_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float bm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float bm_box(vec2 q, vec2 h) { vec2 d = abs(q) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float bm_ell(vec2 q, vec2 r) { return (length(q / r) - 1.0) * min(r.x, r.y); }
float bm_tri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
// a bat seen from the front, local units: half wingspan = 1, f = flap -1..1
float bm_bat(vec2 q, float f) {
  float d = bm_ell(q - vec2(0.0, 0.06), vec2(0.13, 0.24));
  d = min(d, length(q - vec2(0.0, -0.22)) - 0.09);
  vec2 qa = vec2(abs(q.x), q.y);
  d = min(d, bm_tri(qa, vec2(0.04, -0.24), vec2(0.10, -0.40), vec2(0.13, -0.20)));
  vec2 tip = vec2(1.0 - 0.22 * abs(f), -0.55 * f - 0.20);
  vec2 mid = vec2(0.62 - 0.10 * abs(f), 0.22 - 0.25 * f);
  d = min(d, bm_tri(qa, vec2(0.08, -0.12), tip, mid));
  d = min(d, bm_tri(qa, vec2(0.08, -0.12), mid, vec2(0.12, 0.42)));
  d = min(d, bm_tri(qa, mid, vec2(0.34, 0.48 - 0.12 * f), vec2(0.12, 0.42)));
  return d;
}

// ---- the castle: local unit s, y grows downward, origin = base centre on the crag
float bm_castle(vec2 p, vec2 base, float s) {
  vec2 q = (p - base) / s;
  float mer = step(0.5, fract(q.x * 14.0));
  // curtain wall with merlons
  float wall1 = bm_box(q - vec2(0.0, -0.075), vec2(0.62, 0.105));
  float wm = bm_box(q - vec2(0.0, -0.205 + 0.0), vec2(0.62, 0.025 * mer + 0.001));
  // keep
  float keep = bm_box(q - vec2(0.02, -0.23), vec2(0.20, 0.17));
  float km = bm_box(q - vec2(0.02, -0.41), vec2(0.20, 0.028 * step(0.5, fract(q.x * 9.0)) + 0.001));
  // central spire tower with a cone roof
  float t1 = bm_box(q - vec2(0.06, -0.50), vec2(0.075, 0.32));
  float r1 = bm_tri(q, vec2(-0.035, -0.82), vec2(0.155, -0.82), vec2(0.06, -1.06));
  // left tower
  float t2 = bm_box(q - vec2(-0.31, -0.37), vec2(0.062, 0.28));
  float r2 = bm_tri(q, vec2(-0.385, -0.65), vec2(-0.235, -0.65), vec2(-0.31, -0.84));
  // right tower (the one with the lit window), thicker, flat battlement top
  float t3 = bm_box(q - vec2(0.30, -0.33), vec2(0.075, 0.26));
  float t3m = bm_box(q - vec2(0.30, -0.605), vec2(0.095, 0.018 + 0.026 * step(0.5, fract(q.x * 16.0))));
  float r3 = bm_tri(q, vec2(0.215, -0.585), vec2(0.385, -0.585), vec2(0.30, -0.80));
  // far left stub
  float t4 = bm_box(q - vec2(-0.56, -0.20), vec2(0.045, 0.16));
  float r4 = bm_tri(q, vec2(-0.61, -0.36), vec2(-0.51, -0.36), vec2(-0.56, -0.50));
  // flag pole
  float pole = bm_box(q - vec2(0.06, -1.14), vec2(0.004, 0.09));
  float d = min(min(wall1, wm), min(keep, km));
  d = min(d, min(min(t1, r1), min(t2, r2)));
  d = min(d, min(min(t3, min(t3m, r3)), min(t4, r4)));
  d = min(d, pole);
  return d * s;
}
// the crag: top edge height at x (y grows downward)
float bm_crag(float x, float cx) {
  float dx = abs(x - cx);
  float base = 0.625 + 0.80 * pow(smoothstep(0.33, 0.86, dx), 0.75);
  float plat = smoothstep(0.30, 0.38, dx);
  float rid = 1.0 - abs(2.0 * bm_noise(vec2(x * 9.0, 4.0)) - 1.0);
  float rid2 = 1.0 - abs(2.0 * bm_noise(vec2(x * 27.0, 6.0)) - 1.0);
  float jag = plat * (0.16 * rid * rid - 0.07 + 0.045 * rid2 + 0.012 * bm_noise(vec2(x * 80.0, 2.0)));
  float steep = 0.0;
  return base + jag + steep;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  float aa = 1.4 / res.y;
  vec3 pic = wall(uv);
  float pl = bm_luma(pic);

  // ---- sky: dark wine to a smouldering red low down; the picture's stars show a little
  float up = 1.0 - clamp(uv.y / 0.78, 0.0, 1.0);
  vec3 skyHi = vec3(0.030, 0.010, 0.040);
  vec3 skyLo = vec3(0.30, 0.060, 0.080);
  vec3 sky = mix(skyLo, skyHi, smoothstep(0.0, 1.0, pow(up, 0.6)));
  sky += vec3(0.16, 0.07, 0.09) * min(pl, 0.55) * (0.4 + 0.6 * up);

  // the moon: huge, blood red, big halo
  vec2 moon = vec2(asp * 0.60, 0.31);
  float mr = 0.20;
  vec2 md = p - moon;
  float dm = length(md);
  vec3 halo = vec3(0.95, 0.20, 0.12);
  sky += halo * (exp(-dm / 0.10) * 0.22 + exp(-dm / 0.38) * 0.20);
  float disc = smoothstep(mr + aa, mr - aa, dm);
  float rr = dm / mr;
  float mar = bm_fbm((md / mr) * 3.2 + 4.0);
  float mar2 = bm_fbm3((md / mr) * 9.0 + 9.0);
  vec3 moonC = mix(vec3(0.96, 0.30, 0.20), vec3(0.46, 0.08, 0.09), smoothstep(0.42, 0.68, mar) * 0.8);
  moonC *= 0.88 + 0.22 * mar2;
  moonC *= 0.60 + 0.50 * sqrt(max(1.0 - rr * rr, 0.0));            // round limb
  moonC += vec3(0.20, 0.05, 0.02) * smoothstep(0.6, 1.0, rr);      // red rim glow
  vec3 col = mix(sky, moonC, disc);

  // thin clouds crossing the moon: dark, lit red on their edges
  vec2 cq = vec2(p.x * 1.2 - t * 0.016, p.y * 7.0);
  float cl = bm_fbm(cq + bm_fbm3(cq * 0.7 + t * 0.012) * 1.2);
  float cband = exp(-pow((p.y - 0.33 - 0.07 * sin(p.x * 2.4 + t * 0.02)) / 0.11, 2.0));
  float cd = smoothstep(0.50, 0.72, cl) * (0.35 + 0.65 * cband);
  vec3 cloudC = vec3(0.10, 0.025, 0.045) + halo * 0.22 * exp(-dm / 0.30);
  col = mix(col, cloudC, cd * (0.55 + 0.35 * disc));
  col += halo * 0.20 * smoothstep(0.50, 0.58, cl) * (1.0 - smoothstep(0.58, 0.72, cl)) * exp(-dm / 0.35);

  // far ranges
  float r1 = 0.66 - 0.05 * bm_fbm3(vec2(p.x * 2.3 + 1.0, 3.0)) - 0.02 * sin(p.x * 3.0);
  float r2 = 0.72 - 0.06 * bm_fbm3(vec2(p.x * 3.6 + 8.0, 5.0));
  col = mix(col, vec3(0.17, 0.035, 0.065) + halo * 0.07 * exp(-dm / 0.5), smoothstep(r1 - aa, r1 + aa, uv.y));
  col = mix(col, vec3(0.095, 0.020, 0.045), smoothstep(r2 - aa, r2 + aa, uv.y));

  // mist low between the ranges, tinted by the moon
  float mist = smoothstep(0.35, 0.78, bm_fbm(vec2(p.x * 2.4 - t * 0.03, p.y * 9.0 + 3.0))) * exp(-pow((uv.y - 0.74) / 0.07, 2.0));
  col = mix(col, vec3(0.34, 0.08, 0.12), mist * 0.40);

  // ---- the crag and castle
  vec2 bc = vec2(asp * 0.34, 0.60);
  float topY = bm_crag(p.x, bc.x);
  float cragM = smoothstep(topY - aa, topY + aa, uv.y);
  vec3 stone = vec3(0.012, 0.004, 0.010);
  // moon-facing light on the crag: a faint red sheen along the top edge and cracks of lighter rock
  float crk = bm_fbm3(vec2(p.x * 22.0, uv.y * 9.0));
  vec3 cragC = stone + vec3(0.05, 0.012, 0.016) * smoothstep(0.45, 0.8, crk) * smoothstep(topY + 0.20, topY, uv.y);
  cragC += halo * 0.10 * smoothstep(0.03, 0.0, uv.y - topY) * smoothstep(-0.003, 0.0, uv.y - topY);
  col = mix(col, cragC, cragM);

  float dC = bm_castle(p, vec2(bc.x, 0.625), 0.50);
  float mC = smoothstep(aa, -aa, dC);
  vec3 castC = stone * 0.8;
  float rimC = smoothstep(-0.006, 0.0, dC);
  castC += halo * 0.16 * rimC * smoothstep(0.55, 0.15, dm) ;
  col = mix(col, castC, mC);
  col += halo * 0.35 * mC * rimC * exp(-dm / 0.25) * 0.5;

  // the lit tower window (right tower) and a dim one in the keep, both with a flickering candle glow
  vec2 w1 = vec2(bc.x + 0.30 * 0.50, 0.625 - 0.44 * 0.50);
  vec2 wq = (p - w1) / 0.50;
  float flick = 0.85 + 0.15 * sin(t * 9.0) * sin(t * 5.3 + 1.0) + 0.05 * sin(t * 17.0);
  float arch = min(bm_box(wq + vec2(0.0, -0.012), vec2(0.020, 0.032)), length(wq + vec2(0.0, 0.040)) - 0.020);
  float win1 = smoothstep(aa * 2.0, -aa * 2.0, arch * 0.50);
  vec3 candle = vec3(1.0, 0.70, 0.28);
  col += candle * exp(-dot(p - w1, p - w1) / 0.0012) * 0.40 * flick;
  col = mix(col, candle * 1.05 * flick, win1 * mC);
  vec2 w2 = vec2(bc.x + 0.02 * 0.50, 0.625 - 0.22 * 0.50);
  vec2 wq2 = (p - w2) / 0.50;
  float win2 = smoothstep(aa * 2.0, -aa * 2.0, bm_box(wq2, vec2(0.012, 0.024)) * 0.50);
  col = mix(col, vec3(0.80, 0.35, 0.16) * (0.65 + 0.3 * sin(t * 2.3 + 2.0)), win2 * mC * 0.8);

  // wind-torn mist around the foot of the crag
  float mist2 = smoothstep(0.38, 0.80, bm_fbm(vec2(p.x * 2.0 - t * 0.04, p.y * 7.0 + 12.0))) * exp(-pow((uv.y - 0.86) / 0.09, 2.0));
  col = mix(col, vec3(0.30, 0.07, 0.11), mist2 * 0.30);

  // dark pines along the bottom edge
  float tx = p.x * 15.0;
  float tcell = floor(tx);
  float tri = 1.0 - abs(2.0 * fract(tx) - 1.0);
  float tline = 0.965 - (0.045 + 0.035 * bm_hash(vec2(tcell, 7.0))) * tri;
  col = mix(col, vec3(0.008, 0.003, 0.008), smoothstep(tline - aa, tline + aa, uv.y));

  // ---- the flock: bats stream from the right past the moon and the castle; the pointer scatters them
  float bats = 0.0;
  float batRim = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float hh = bm_hash(vec2(fi, 2.0));
    float h2 = bm_hash(vec2(fi, 5.0));
    float h3 = bm_hash(vec2(fi, 9.0));
    float spd = 0.030 + 0.012 * h2;
    float ph = fract(t * spd + float(i) / 14.0 + 0.05 * hh);
    float x = asp * (1.15 - ph * 1.45) + (h3 - 0.5) * 0.10;
    float lane = 0.34 - 0.20 * sin(ph * 2.6 + 0.4) + (hh - 0.5) * 0.24 + 0.04 * sin(ph * 9.0 + fi);
    float y = lane + 0.05 * sin(t * 0.9 + fi * 1.7) + 0.02 * sin(t * 2.7 + fi);
    vec2 bp = vec2(x, y);
    if (onScr) {
      vec2 dd = bp - mp;
      float dl = length(dd) + 1e-4;
      float push = exp(-dl * dl / 0.030);
      bp += dd / dl * push * 0.17;
    }
    float sc = 0.020 + 0.022 * h3;
    vec2 q = (p - bp) / sc;
    if (abs(q.x) > 1.3 || abs(q.y) > 1.0) continue;
    float f = sin(t * (8.0 + 3.0 * h2) + fi * 2.1);
    float d = bm_bat(q, f) * sc;
    float mk = smoothstep(aa, -aa, d);
    bats = max(bats, mk);
    batRim = max(batRim, mk * smoothstep(-0.0025, 0.0, d));
  }
  col = mix(col, vec3(0.010, 0.003, 0.008), bats);
  col += halo * 0.28 * batRim * (0.3 + 1.2 * exp(-dm / 0.28));

  // vignette, a little red-black
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
