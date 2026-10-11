// label: Baroque hall
// hint: a candle-lit baroque hall: a grand chandelier of many flames, gilded scrolls on burgundy walls, a checker floor mirroring the light and warm dust motes drifting; the flames lean toward the pointer
// category: Style studies
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
float bh_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bh_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bh_hash(i), bh_hash(i + vec2(1, 0)), f.x), mix(bh_hash(i + vec2(0, 1)), bh_hash(i + vec2(1, 1)), f.x), f.y);
}
float bh_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float BH_FL = 0.76;                       // floor line
const vec3 BH_GOLD = vec3(0.88, 0.66, 0.30);    // antique gilding

float bh_ln(float d, float w) { return 1.0 - smoothstep(w * 0.35, w, d); }
float bh_rbox(vec2 q, vec2 hs, float rad) {
  vec2 d = abs(q) - (hs - rad);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - rad;
}
float bh_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// a gilded volute: a logarithmic spiral arm, thick on the outside and thinning to a bead in the middle
float bh_volute(vec2 q, float R, float dir) {
  float r = length(q);
  if (r > R) return 0.0;
  float a = atan(q.y, q.x) * dir;
  float s = a / 6.28318 + log(max(r, 0.0005) / R) * 1.30;
  float arm = smoothstep(0.34, 0.26, fract(s)) * smoothstep(R, R * 0.90, r) * smoothstep(0.004, 0.009, r);
  float bead = 1.0 - smoothstep(0.0045, 0.0075, r);
  return max(arm, bead);
}
// a rosette: petals round a centre
float bh_rosette(vec2 q, float R) {
  float r = length(q);
  float a = atan(q.y, q.x);
  float edge = R * (0.62 + 0.38 * abs(cos(a * 4.0)));
  float rim = bh_ln(abs(r - edge), 0.0024);
  float dot0 = 1.0 - smoothstep(R * 0.16, R * 0.24, r);
  return max(rim, dot0) * step(r, R * 1.05);
}

// one candle with a flame that sways, and leans toward the pointer
void bh_candle(vec2 q, float xj, float yb, float ph, float lean, float t, inout vec3 col) {
  float H = 0.046;
  float sway = 0.10 * sin(t * 4.7 + ph * 6.283) + 0.06 * sin(t * 8.9 + ph * 19.0);
  float hs = 1.0 + 0.10 * sin(t * 6.1 + ph * 11.0);
  float y0 = yb - 0.034;
  float dx = q.x - xj;
  // the glow the flame throws
  vec2 fcn = vec2(xj + (lean + sway) * H * 0.25, y0 - 0.42 * H);
  vec2 dd = q - fcn;
  float d2 = dot(dd, dd);
  col += vec3(1.0, 0.56, 0.20) * exp(-d2 / 0.0016) * 0.34;
  // wax and a little gilt cup
  if (abs(dx) < 0.0042 && q.y < yb && q.y > y0) col = vec3(0.86, 0.74, 0.52) * (0.70 + 0.30 * smoothstep(-0.0042, 0.0042, dx)) + vec3(0.25, 0.14, 0.05);
  if (q.y >= yb && q.y < yb + 0.009 && abs(dx) < 0.0078 - (q.y - yb) * 0.45) col = BH_GOLD * 0.85 + vec3(0.2, 0.1, 0.0);
  // the flame
  float h = (y0 - q.y) / (H * hs);
  if (h > 0.0 && h < 1.0) {
    float off = (lean + sway) * H * h * h;
    float hw = 0.0098 * 3.2 * h * pow(1.0 - h, 1.3);
    float e = abs(dx - off);
    float cov = clamp((hw - e) / 0.0012, 0.0, 1.0);
    float core = clamp((hw * 0.6 - e) / (hw * 0.5 + 0.0005), 0.0, 1.0) * (1.0 - h * 0.55);
    vec3 fc = mix(vec3(1.0, 0.48, 0.08), vec3(1.0, 0.94, 0.64), core);
    fc = mix(fc, vec3(1.0, 0.36, 0.06), smoothstep(0.72, 1.0, h) * 0.6);
    col = mix(col, fc * 1.2, cov);
  }
}

// one ring of the chandelier with its candles on the front and back arcs
void bh_tier(vec2 q, float ty, float rx, float ry, float sp, float nh, float seedv, float mpx, vec2 mpc, bool hasM, float t, inout vec3 col, inout float gold) {
  if (abs(q.x) > rx + 0.06 || q.y < ty - ry - 0.09 || q.y > ty + ry + 0.15) return;
  float e = length(vec2(q.x / rx, (q.y - ty) / ry));
  gold = max(gold, bh_ln(abs(e - 1.0) * ry * 0.9, 0.0034));
  float cur = floor(q.x / sp + 0.5);
  for (int di = -1; di <= 1; di++) {
    float j = clamp(cur + float(di), -nh, nh);
    if (abs(cur + float(di)) > nh) continue;
    float xj = j * sp;
    float xr = xj / rx;
    if (abs(xr) > 1.0) continue;
    float yo = ry * sqrt(1.0 - xr * xr);
    float ph1 = bh_hash(vec2(j, seedv));
    float ph2 = bh_hash(vec2(j, seedv + 5.0));
    vec2 b1 = vec2(xj, ty - yo);
    vec2 b2 = vec2(xj, ty + yo);
    float l1 = 0.0, l2 = 0.0;
    if (hasM) {
      vec2 d1 = mpc - b1;
      vec2 d2 = mpc - b2;
      l1 = clamp(d1.x * 2.5, -1.0, 1.0) * (0.30 + 0.70 * exp(-dot(d1, d1) / 0.5)) * 0.95;
      l2 = clamp(d2.x * 2.5, -1.0, 1.0) * (0.30 + 0.70 * exp(-dot(d2, d2) / 0.5)) * 0.95;
    }
    bh_candle(q, xj, b1.y, ph1, l1, t, col);
    bh_candle(q, xj, b2.y, ph2, l2, t, col);
  }
}

// warm dust motes drifting up through the light
float bh_motes(vec2 p, float t) {
  float acc = 0.0;
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    float sc = 10.0 + 7.0 * fl;
    vec2 q = p * sc + vec2(t * (0.05 + 0.03 * fl), -t * (0.10 + 0.05 * fl)) + fl * 13.0;
    vec2 c = floor(q);
    vec2 f = fract(q) - 0.5;
    float hh = bh_hash(c + fl * 7.3);
    vec2 off = (vec2(bh_hash(c + 3.1), bh_hash(c + 7.7)) - 0.5) * 0.55 + 0.12 * vec2(sin(t * 0.4 + hh * 30.0), cos(t * 0.33 + hh * 20.0));
    float d = length(f - off);
    float sz = 0.06 + 0.05 * bh_hash(c + 1.7);
    float tw = 0.45 + 0.55 * sin(t * (0.5 + hh) + hh * 40.0);
    acc += step(0.50, hh) * smoothstep(sz, sz * 0.2, d) * max(tw, 0.0) * (1.0 - 0.3 * fl);
  }
  return acc;
}

// the hall: p in aspect-corrected units, mpc = pointer with the x origin at the middle
vec3 bh_scene(vec2 p, float asp, vec2 mpc, bool hasM, float t) {
  float x = p.x - 0.5 * asp;
  float y = p.y;
  float ax = abs(x);
  vec2 L = vec2(0.0, 0.34);                      // the light of the chandelier
  vec2 dl = vec2(x * 0.9, y - L.y);
  float lt = 0.34 + 0.85 * exp(-dot(dl, dl) / 0.30);
  float gold = 0.0;                              // gilded line coverage
  float gs = 0.0;                                // dim gilding (texture)

  // burgundy brocade with a faint diamond damask
  float dm = cos((x + y) * 34.0) * cos((x - y) * 34.0);
  vec3 wallc = vec3(0.36, 0.030, 0.062) * (1.0 + 0.30 * smoothstep(0.55, 0.9, dm));
  vec3 col = wallc * lt;

  // bays: stepped pilasters and framed panels
  float Pb = 0.34;
  float u = x / Pb;
  float wx = (u - floor(u + 0.5)) * Pb;
  float awx = abs(wx);
  float pil = smoothstep(0.138, 0.142, awx);
  // pilasters: gilded shafts with flutes
  col = mix(col, vec3(0.30, 0.17, 0.06) * (0.25 + lt * 0.9), pil * step(y, BH_FL));
  float flute = 1.0 - smoothstep(0.03, 0.10, abs(fract((awx - 0.14) * 140.0) - 0.5));
  gs = max(gs, 0.45 * flute * pil * smoothstep(0.075, 0.095, y));
  gold = max(gold, bh_ln(abs(awx - 0.145), 0.0026) * smoothstep(0.075, 0.09, y));
  gold = max(gold, 0.8 * bh_ln(abs(awx - 0.168), 0.0022) * smoothstep(0.075, 0.09, y));
  // framed panel with an inset moulding
  float py = y - 0.40;
  float sd = bh_rbox(vec2(wx, py), vec2(0.126, 0.265), 0.045);
  col = mix(col, wallc * vec3(0.62, 0.60, 0.70) * lt, step(sd, 0.0) * 0.8);
  gold = max(gold, bh_ln(abs(sd), 0.0032));
  gold = max(gold, 0.8 * bh_ln(abs(sd + 0.011), 0.0024));
  gs = max(gs, 0.55 * bh_ln(abs(sd + 0.022), 0.0020));
  // scroll work in the panel: volutes at the four corners, a rosette between them
  float inner = 1.0 - smoothstep(-0.020, -0.012, sd);
  float sc = 0.0;
  sc = max(sc, bh_volute(vec2(awx - 0.062, py + 0.200), 0.050, wx > 0.0 ? 1.0 : -1.0));
  sc = max(sc, bh_volute(vec2(awx - 0.062, -(py - 0.200)), 0.050, wx > 0.0 ? -1.0 : 1.0));
  sc = max(sc, bh_rosette(vec2(wx, py + 0.205), 0.030));
  sc = max(sc, bh_rosette(vec2(wx, py - 0.215), 0.030));
  // a pair of facing C-scrolls up the side of the panel
  sc = max(sc, bh_ln(bh_seg(vec2(awx, py), vec2(0.088, -0.130), vec2(0.088, 0.130)), 0.0022) * 0.9);
  gold = max(gold, sc * inner);
  // medallion
  float med = length(vec2(wx, (py - 0.02) * 1.5));
  gold = max(gold, bh_ln(abs(med - 0.060), 0.0026) * inner * smoothstep(0.30, 0.40, y));
  gs = max(gs, 0.7 * bh_ln(abs(med - 0.050), 0.0020) * inner * smoothstep(0.30, 0.40, y));

  // cornice with dentils, ceiling cove
  float cy = abs(y - 0.088);
  gold = max(gold, bh_ln(cy, 0.0030));
  gold = max(gold, bh_ln(abs(y - 0.070), 0.0022));
  float dent = step(0.5, fract(x * 55.0)) * step(0.097, y) * step(y, 0.112);
  col = mix(col, vec3(0.34, 0.20, 0.07) * (0.3 + lt), dent * 0.85);
  gold = max(gold, bh_ln(abs(y - 0.115), 0.0024));
  col = mix(col, vec3(0.020, 0.008, 0.012) * (0.4 + lt), step(y, 0.065));
  // dado rail and base
  gold = max(gold, bh_ln(abs(y - 0.682), 0.0030));
  gold = max(gold, 0.8 * bh_ln(abs(y - 0.696), 0.0022));
  float dsd = bh_rbox(vec2(wx, y - 0.724), vec2(0.100, 0.020), 0.008);
  gs = max(gs, 0.7 * bh_ln(abs(dsd), 0.0022));
  col = mix(col, vec3(0.06, 0.012, 0.022) * (0.3 + lt), step(0.69, y) * step(y, BH_FL));
  // skirting
  gold = max(gold, bh_ln(abs(y - BH_FL + 0.006), 0.0026));

  // gilding takes the light: brighter near the chandelier, with a travelling shimmer
  float shim = 0.5 + 0.5 * sin(x * 9.0 - y * 5.0 - t * 0.35 + bh_noise(vec2(x, y) * 4.0) * 3.0);
  vec3 gcol = BH_GOLD * (0.30 + 1.15 * lt * (0.75 + 0.25 * shim));
  col = mix(col, gcol * 0.55, clamp(gs, 0.0, 1.0) * 0.8);
  col = mix(col, gcol, clamp(gold, 0.0, 1.0));

  // ---- the chandelier
  float cg = 0.0;
  vec2 q = vec2(x, y);
  // chain and stem
  float lw = 0.0021 + 0.0016 * step(0.5, fract(y * 36.0));
  cg = max(cg, (1.0 - smoothstep(lw * 0.8, lw, ax)) * step(y, 0.13));
  cg = max(cg, (1.0 - smoothstep(0.0045, 0.0060, ax)) * step(0.13, y) * step(y, 0.60));
  // stepped arms linking the rings
  float arm = 1.0;
  vec2 ap = vec2(ax, y);
  for (int k = 0; k < 3; k++) {
    vec2 A = k == 0 ? vec2(0.0, 0.13) : (k == 1 ? vec2(0.11, 0.17) : vec2(0.19, 0.29));
    vec2 B = k == 0 ? vec2(0.11, 0.17) : (k == 1 ? vec2(0.19, 0.29) : vec2(0.28, 0.43));
    for (int j = 0; j < 3; j++) {
      float s0 = float(j) / 3.0, s1 = float(j + 1) / 3.0;
      vec2 P0 = mix(A, B, s0) + vec2(0.0, 0.0) + vec2(0.030 * sin(3.14159 * s0), -0.010 * sin(3.14159 * s0));
      vec2 P1 = mix(A, B, s1) + vec2(0.030 * sin(3.14159 * s1), -0.010 * sin(3.14159 * s1));
      arm = min(arm, bh_seg(ap, P0, P1));
    }
  }
  cg = max(cg, bh_ln(arm, 0.0036));
  // beads on the stem and a finial
  float b1 = length(vec2(x, (y - 0.17) * 1.4)); float b2 = length(vec2(x, (y - 0.29) * 1.4));
  float b3 = length(vec2(x, (y - 0.43) * 1.4)); float b4 = length(vec2(x * 1.2, (y - 0.54) * 0.8));
  cg = max(cg, 1.0 - smoothstep(0.0115, 0.0145, min(min(b1, b2), min(b3, b4))));
  vec3 ccol = col;
  // crystals under the lowest two rings, twinkling
  float cr = 0.0;
  for (int k = 0; k < 2; k++) {
    float rx = k == 0 ? 0.28 : 0.19;
    float ty = k == 0 ? 0.43 : 0.29;
    float ry = k == 0 ? 0.045 : 0.032;
    float sp = k == 0 ? 0.034 : 0.038;
    float j = clamp(floor(x / sp + 0.5), -floor(rx / sp), floor(rx / sp));
    float xj = j * sp;
    float yr = ty + ry * sqrt(max(1.0 - (xj / rx) * (xj / rx), 0.0));
    float len = 0.03 + 0.04 * bh_hash(vec2(j, 2.0 + float(k)));
    vec2 cd = vec2((x - xj) * 1.0, (y - (yr + 0.012 + len)) * 0.55);
    float tw = 0.5 + 0.5 * sin(t * (1.1 + bh_hash(vec2(j, 9.0))) + j * 5.0);
    float dia = 1.0 - smoothstep(0.0042, 0.0062, length(cd));
    float thread = (1.0 - smoothstep(0.0006, 0.0014, abs(x - xj))) * step(yr, y) * step(y, yr + 0.012 + len);
    cr = max(cr, max(dia * (0.55 + 0.7 * tw), thread * 0.5));
  }
  col = mix(col, BH_GOLD * (0.70 + 0.9 * lt) + vec3(0.2, 0.1, 0.0), clamp(cg, 0.0, 1.0));
  col = mix(col, vec3(1.0, 0.92, 0.78), clamp(cr, 0.0, 1.0));
  // rings and candles
  float rg = 0.0;
  bh_tier(q, 0.43, 0.28, 0.045, 0.040, 7.0, 3.0, 0.0, mpc, hasM, t, col, rg);
  bh_tier(q, 0.29, 0.19, 0.032, 0.038, 5.0, 11.0, 0.0, mpc, hasM, t, col, rg);
  bh_tier(q, 0.17, 0.11, 0.020, 0.040, 2.0, 23.0, 0.0, mpc, hasM, t, col, rg);
  col = mix(col, BH_GOLD * 1.1 + vec3(0.1), clamp(rg, 0.0, 1.0) * 0.9);
  // soft halo round the whole chandelier
  col += vec3(1.0, 0.55, 0.18) * 0.10 * exp(-dot(vec2(x * 0.7, y - 0.33), vec2(x * 0.7, y - 0.33)) / 0.06);
  return col;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mpc = vec2((m.x - 0.5) * asp, m.y);
  float t = time;
  vec3 w = wall(uv);
  float x = p.x - 0.5 * asp;

  vec3 col;
  if (uv.y < BH_FL) {
    col = bh_scene(p, asp, mpc, hasM, t);
  } else {
    // ---- polished checker floor, ivory and black, with the chandelier mirrored in it
    float depth = uv.y - BH_FL;
    float dn = depth / (1.0 - BH_FL);
    float gz = depth + 0.035;
    vec2 fp = vec2(x / gz * 2.2, 0.50 / gz);
    float chk = mod(floor(fp.x) + floor(fp.y), 2.0);
    chk = mix(0.5, chk, smoothstep(0.03, 0.10, depth));
    vec3 tile = mix(vec3(0.030, 0.012, 0.016), vec3(0.50, 0.37, 0.25), chk);
    tile *= 0.85 + 0.30 * bh_noise(fp * 1.5);
    float flit = 0.14 + 0.95 * exp(-x * x / 0.30) * exp(-depth * 2.5);
    vec3 fl = tile * flit;
    float wob = (bh_noise(vec2(x * 70.0, depth * 6.0)) - 0.5) * 0.003 * (0.3 + dn);
    vec3 refl = bh_scene(vec2(p.x + wob, BH_FL - depth * 0.95), asp, mpc, hasM, t);
    col = fl + refl * 0.52 * (1.0 - 0.55 * dn);
    col += vec3(0.5, 0.3, 0.1) * 0.05 * exp(-depth * 40.0);
  }

  // dust motes over everything, brightest in the light of the flames
  float lm = 0.25 + 0.9 * exp(-dot(vec2(x * 0.8, uv.y - 0.40), vec2(x * 0.8, uv.y - 0.40)) / 0.35);
  col += vec3(1.0, 0.78, 0.45) * bh_motes(vec2(p.x, uv.y), t) * 0.85 * lm;

  // the user's picture shows faintly through the darkness
  col += w * 0.05 * (1.0 - clamp(bh_luma(col) * 3.0, 0.0, 1.0));
  col *= 0.97 + 0.06 * bh_luma(w);
  col *= 1.0 - 0.40 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
