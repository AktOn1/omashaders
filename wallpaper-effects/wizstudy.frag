// label: Wizard study
// hint: a wizard's tower study at night: floating candles, shelves of old books, an arched window with the moon, golden motes that swirl round the pointer
// category: Fantasy realms
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
float wz_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wz_h1(float n) { return fract(sin(n * 127.1 + 17.3) * 43758.5453); }
float wz_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wz_hash(i), wz_hash(i + vec2(1, 0)), f.x), mix(wz_hash(i + vec2(0, 1)), wz_hash(i + vec2(1, 1)), f.x), f.y);
}
float wz_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * wz_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

vec3 wz_bookcol(float h) {
  if (h < 0.18) return vec3(0.42, 0.07, 0.09);      // oxblood
  if (h < 0.36) return vec3(0.07, 0.24, 0.20);      // deep green
  if (h < 0.52) return vec3(0.12, 0.13, 0.36);      // indigo
  if (h < 0.70) return vec3(0.34, 0.20, 0.09);      // tan leather
  if (h < 0.86) return vec3(0.26, 0.10, 0.30);      // violet
  return vec3(0.45, 0.34, 0.14);                    // gilded
}

float wz_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// a made-up rune: three strokes between random points on a small grid
float wz_rune(vec2 q, float seed) {
  float d = 9.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 a = floor(vec2(wz_hash(vec2(seed, fi)), wz_hash(vec2(seed + 3.0, fi))) * 3.0) / 2.0 - 0.5;
    vec2 b = floor(vec2(wz_hash(vec2(seed + 7.0, fi)), wz_hash(vec2(seed + 11.0, fi))) * 3.0) / 2.0 - 0.5;
    d = min(d, wz_seg(q, a, b));
  }
  return d;
}

vec2 wz_candle(int i, float asp, float t) {
  float fi = float(i);
  float a = wz_h1(fi + 1.0), b = wz_h1(fi + 8.0);
  vec2 base = vec2((0.04 + (fi + 0.2 + 0.6 * a) / 7.0 * 0.92) * asp, 0.10 + 0.52 * b);
  return base + vec2(sin(t * (0.15 + 0.1 * a) + fi * 3.0) * 0.012, sin(t * (0.25 + 0.15 * b) + fi * 5.0) * 0.014);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  float near = (m.x > -1.0 && m.x < 2.0 && m.y > -1.0 && m.y < 2.0) ? 1.0 : 0.0;
  float t = time;
  vec3 pic = wall(uv);

  // candle light everywhere first, so the books and wall can use it
  vec3 light = vec3(0.0);
  vec3 flameCol = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    vec2 c = wz_candle(i, asp, t);
    float fl = 0.75 + 0.25 * sin(t * (3.0 + wz_h1(float(i)) * 3.0) + float(i) * 9.0) * sin(t * 1.3 + float(i));
    vec2 dm = mp - c;
    float flare = 1.0 + 0.9 * near * exp(-dot(dm, dm) / 0.04);        // a candle flares up as the pointer passes
    vec2 d = p - c;
    light += vec3(1.0, 0.62, 0.26) * 0.016 / (dot(d, d) * 6.0 + 0.032) * fl * flare;
  }

  // back wall: dark aubergine stone with a few warm patches from the light
  float stone = wz_fbm(p * vec2(4.0, 5.0));
  vec3 col = mix(vec3(0.030, 0.020, 0.040), vec3(0.075, 0.050, 0.070), stone);
  col += pic * vec3(0.03, 0.02, 0.03);

  // bookshelves on the left: rows of spines
  float shelfX = 0.40 * asp;
  float onShelf = smoothstep(shelfX, shelfX - 0.02, p.x);
  float shelfH = 0.155;
  float row = floor(p.y / shelfH);
  float fy = fract(p.y / shelfH);
  float bx = p.x * 52.0 + row * 7.0;
  float bid = floor(bx), bf = fract(bx);
  float bh = wz_hash(vec2(bid, row));
  float bhgt = 0.50 + 0.46 * wz_hash(vec2(bid + 5.0, row));
  float bwid = 0.72 + 0.28 * wz_hash(vec2(bid + 2.0, row));
  float top = 1.0 - bhgt;                                    // books stand on the shelf at fy = 1
  float inBook = step(top, fy) * step(0.5 - bwid * 0.5, bf) * step(bf, 0.5 + bwid * 0.5) * step(0.07, bh);
  vec3 bcol = wz_bookcol(wz_hash(vec2(bid + 9.0, row))) * (0.7 + 0.5 * wz_hash(vec2(bid, row + 4.0)));
  float band = smoothstep(0.015, 0.0, abs(fy - (top + 0.12))) + smoothstep(0.015, 0.0, abs(fy - (top + 0.40 * bhgt)));
  bcol += vec3(0.50, 0.36, 0.12) * band * 0.7;
  bcol *= 0.55 + 0.45 * smoothstep(0.0, 0.25, bf) * smoothstep(1.0, 0.75, bf);   // round the spine
  float plank = smoothstep(0.96, 1.0, fy) + smoothstep(0.04, 0.0, fy) * 0.0;
  vec3 shelfCol = mix(vec3(0.020, 0.012, 0.012), bcol, inBook);
  shelfCol = mix(shelfCol, vec3(0.16, 0.09, 0.05), plank);
  vec3 lightShelf = shelfCol * (0.20 + 2.2 * light);
  col = mix(col, lightShelf, onShelf * 0.96);

  // the tall arched window on the right with the night outside
  vec2 wc = vec2(0.74 * asp, 0.47);
  vec2 wd = p - wc;
  float ww_ = 0.105, wh = 0.30;
  float arch = wd.y < -wh + ww_ ? length(vec2(wd.x, wd.y + wh - ww_)) - ww_ : abs(wd.x) - ww_;
  float inWin = (wd.y > wh) ? 0.0 : smoothstep(0.003, -0.003, max(arch, wd.y - wh));
  float frameW = smoothstep(0.004, -0.004, max(arch, wd.y - wh) + 0.016) * 0.0;
  vec3 sky = mix(vec3(0.08, 0.07, 0.24), vec3(0.20, 0.14, 0.38), smoothstep(-0.3, 0.3, wd.y));
  vec2 sg = p * 90.0; vec2 sid = floor(sg), sf = fract(sg) - 0.5;
  float sh = wz_hash(sid + 3.0);
  if (sh > 0.93) sky += vec3(1.0, 0.95, 0.85) * smoothstep(0.12, 0.0, length(sf - (vec2(wz_hash(sid), wz_hash(sid + 4.0)) - 0.5) * 0.6)) * (0.5 + 0.5 * sin(t + sh * 80.0));
  vec2 moonC = wc + vec2(-0.02, -0.12);
  float dmn = length(p - moonC);
  float crescent = smoothstep(0.030, 0.026, dmn) * (1.0 - smoothstep(0.030, 0.026, length(p - moonC - vec2(0.018, -0.006))));
  sky += vec3(0.30, 0.34, 0.50) * exp(-dmn * dmn / 0.006) * 0.5 + vec3(1.0, 0.96, 0.82) * crescent;
  // mullions: a cross and a ring of lead
  float mull = smoothstep(0.004, 0.0, abs(wd.x)) + smoothstep(0.004, 0.0, abs(wd.y - 0.03)) + smoothstep(0.004, 0.0, abs(wd.y + 0.10)) * 0.0;
  vec3 wcol = mix(sky, vec3(0.02, 0.015, 0.02), clamp(mull, 0.0, 1.0));
  // stone frame around
  float fr = smoothstep(0.022, 0.0, max(arch, wd.y - wh)) * (1.0 - inWin);
  col = mix(col, vec3(0.10, 0.07, 0.08) * (0.5 + 1.5 * light + 0.4), clamp(fr, 0.0, 1.0) * 0.9);
  col = mix(col, wcol, inWin);
  // moonbeam slanting from the window across the floor: soft, cool
  vec2 bd = p - wc;
  float along = bd.y + bd.x * 0.9;
  float beam = exp(-pow((bd.x * 0.9 - bd.y * 0.5 + 0.18) / 0.10, 2.0)) * smoothstep(0.0, 0.3, bd.y + 0.3) * (1.0 - smoothstep(0.35, 0.65, bd.y)) * (1.0 - inWin);
  col += vec3(0.16, 0.20, 0.34) * beam * 0.55 * (0.6 + 0.4 * wz_fbm(p * 6.0 + vec2(t * 0.02, 0.0)));

  // desk / floor at the bottom: dark wood catching the candle light
  float floorY = 0.93;
  float fl2 = smoothstep(floorY, floorY + 0.01, uv.y);
  col = mix(col, vec3(0.06, 0.035, 0.025) * (0.6 + 2.0 * light), fl2);

  // warm light spill over everything
  col += vec3(1.0, 0.55, 0.20) * light * 0.35 * (1.0 - fl2 * 0.3);

  // floating candles: cream stick, teardrop flame, halo
  for (int i = 0; i < 7; i++) {
    vec2 c = wz_candle(i, asp, t);
    vec2 d = p - c;
    float stick = smoothstep(0.0075, 0.0055, abs(d.x)) * smoothstep(0.0, 0.003, d.y) * smoothstep(0.050, 0.047, d.y);
    col = mix(col, vec3(0.90, 0.80, 0.62) * (0.55 + 0.5 * smoothstep(0.012, -0.012, d.x)), stick);
    float wob = sin(t * 5.0 + float(i) * 3.0) * 0.0015 + sin(t * 2.3 + float(i)) * 0.001;
    vec2 fd = vec2(d.x - wob * (-d.y * 40.0 > 0.0 ? 1.0 : 0.0), d.y + 0.012);
    float flame = smoothstep(1.0, 0.2, length(vec2(fd.x / (0.0065 * (1.0 + 0.9 * fd.y / 0.02)), fd.y / 0.016)));
    float coreF = smoothstep(1.0, 0.0, length(vec2(fd.x / 0.0035, (fd.y + 0.004) / 0.008)));
    col += vec3(1.0, 0.65, 0.20) * flame * 1.1 + vec3(1.0, 0.95, 0.75) * coreF * 0.7;
  }

  // floating golden motes; they swirl in toward the pointer like a wand trailing sparks
  for (int k = 0; k < 2; k++) {
    float cell = (k == 0) ? 0.055 : 0.085;
    vec2 q = p / cell;
    vec2 dpm = p - mp;
    float pull = near * exp(-dot(dpm, dpm) / 0.05);
    q -= vec2(-dpm.y, dpm.x) * pull * 3.0 / cell * 0.04;        // a slow swirl around the pointer
    q += vec2(sin(t * 0.13 + float(k) * 3.0), t * 0.02 * float(k + 1) + cos(t * 0.11)) * 0.9;
    vec2 id = floor(q), f = fract(q) - 0.5;
    float h = wz_hash(id + float(k) * 17.0);
    if (h > 0.45) {
      vec2 o = (vec2(wz_hash(id + 3.0), wz_hash(id + 7.0)) - 0.5) * 0.6;
      float tw = pow(0.5 + 0.5 * sin(t * (0.6 + 1.2 * h) + h * 50.0), 2.0);
      float r = (k == 0 ? 0.045 : 0.07);
      float mote = smoothstep(r, 0.0, length(f - o)) * tw;
      col += mix(vec3(1.0, 0.78, 0.35), vec3(0.75, 0.55, 1.0), step(0.85, h)) * mote * (0.35 + 1.4 * pull);
    }
  }

  // drifting runes in the open air: faint violet, they brighten when the pointer is near
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 rc = vec2((0.42 + 0.58 * wz_h1(fi + 2.0)) * asp, 0.12 + 0.62 * wz_h1(fi + 6.0));
    rc += vec2(sin(t * 0.07 + fi * 2.0) * 0.03, sin(t * 0.09 + fi * 3.0) * 0.025);
    if (abs(rc.x - 0.74 * asp) < 0.12 && abs(rc.y - 0.47) < 0.30) continue;    // not in front of the window
    float sz = 0.034 + 0.018 * wz_h1(fi + 3.0);
    vec2 q = (p - rc) / sz;
    if (abs(q.x) > 1.5 || abs(q.y) > 1.5) continue;
    float seed = floor(t * 0.04 + fi * 5.0) + fi * 13.0;               // glyphs change shape now and then
    float d = wz_rune(q, seed);
    vec2 dm = p - mp;
    float prox = near * exp(-dot(dm, dm) / 0.05);
    float pulse = 0.55 + 0.45 * sin(t * 0.5 + fi * 4.0);
    col += vec3(0.62, 0.45, 1.0) * (smoothstep(0.075, 0.0, d) * 0.9 + smoothstep(0.7, 0.0, d) * 0.12) * (0.26 + 0.26 * pulse + 1.0 * prox);
  }

  col *= 1.0 - 0.55 * pow(length((uv - 0.5) * vec2(1.0, 1.15)), 2.3);
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
