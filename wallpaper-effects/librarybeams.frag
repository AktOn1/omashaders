// label: Library light
// hint: your own wallpaper stays the picture; soft out-of-focus shelves of books grow out of its tones, warm sunbeams slant across them with dust turning in the light, the pointer tilts the beams
// category: Cozy corners
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
float lb_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lb_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lb_h(i), lb_h(i + vec2(1, 0)), f.x), mix(lb_h(i + vec2(0, 1)), lb_h(i + vec2(1, 1)), f.x), f.y);
}
float lb_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * lb_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float lb_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 lb_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }


float lb_blur(vec2 uv, float r) {
  return (lb_lum(wall(uv)) * 2.0 + lb_lum(wall(uv + vec2(r, 0.0))) + lb_lum(wall(uv - vec2(r, 0.0))) + lb_lum(wall(uv + vec2(0.0, r))) + lb_lum(wall(uv - vec2(0.0, r)))) / 6.0;
}
// out-of-focus shelves of books that grow out of the wallpaper itself: the books take the picture's own tones, pulled
// toward warm leather and kept soft and low in contrast, so the wallpaper stays the wallpaper; returns (tone factor rgb, strength)
vec3 lb_spine(float h) {
  if (h < 0.16) return vec3(0.66, 0.38, 0.30);     // oxblood
  if (h < 0.32) return vec3(0.46, 0.54, 0.40);     // moss
  if (h < 0.54) return vec3(0.80, 0.60, 0.38);     // tan
  if (h < 0.70) return vec3(0.42, 0.46, 0.58);     // dusty navy
  if (h < 0.86) return vec3(0.62, 0.46, 0.34);     // brown
  return vec3(0.86, 0.76, 0.58);                   // vellum
}
vec4 lb_shelves(vec2 uv, float asp, out vec3 glow) {
  float rows = 3.0;
  float rowH = 1.0 / rows;
  float rid = floor(uv.y * rows);
  float y0 = (rid + 1.0) * rowH - 0.016;               // top of this row's shelf board
  float cw = 0.026;
  float px = uv.x * asp + rid * 0.53;
  float c0 = floor(px / cw);
  float soft = 0.55;                                    // soft edges, as if out of focus (fraction of a cell)
  float best = 0.0, bid = c0;
  vec2 bk = vec2(0.0);
  for (int i = -1; i <= 1; i++) {
    float id = c0 + float(i);
    float hh = lb_h(vec2(id, rid + 1.0));
    float wd = 0.62 + 0.80 * lb_h(vec2(id + 11.0, rid + 4.0));      // book width in cells
    float cx = (id + 0.5) + (lb_h(vec2(id + 5.0, rid + 2.0)) - 0.5) * 0.5;
    float dxn = abs(px / cw - cx);
    float cov = smoothstep(wd * 0.5 + soft * 0.30, wd * 0.5 - soft * 0.30, dxn) * step(0.07, lb_h(vec2(id + 2.0, rid + 7.0)));   // now and then a gap in the row
    if (cov > best) { best = cov; bid = id; bk = vec2(hh, dxn / wd); }
  }
  float h2 = lb_h(vec2(bid + 7.0, rid + 1.0));
  float hgt = rowH * (0.60 + 0.30 * h2 * h2);
  float top = y0 - hgt;
  float sy = 0.012;
  float iny = smoothstep(top - sy, top + sy, uv.y) * smoothstep(y0 + 0.002, y0 - 0.008, uv.y);
  float m = best * iny;
  vec3 spine = lb_spine(bk.x);
  float across = 1.0 - 0.35 * smoothstep(0.1, 0.5, bk.y);                      // the spine rounds off toward its edges
  float vy = (uv.y - top) / max(hgt, 1e-3);
  vec3 tone = spine * across * (0.78 + 0.32 * h2);
  tone *= 1.0 + 0.22 * smoothstep(0.10, 0.0, abs(vy - 0.12)) + 0.18 * smoothstep(0.06, 0.0, abs(vy - 0.82));   // two soft gilt bands
  tone *= 1.0 - 0.30 * smoothstep(0.6, 1.0, vy);                                 // shadow near the board
  // the back of the shelf: a faint warm shade, and a soft dark wooden board under each row
  float back = smoothstep(y0 - rowH * 0.95, y0 - rowH * 0.5, uv.y) * smoothstep(y0 + 0.01, y0 - 0.03, uv.y);
  float board = smoothstep(0.010, 0.0, uv.y - y0) * smoothstep(y0 - 0.002, y0 + 0.002, uv.y);
  float boardShadow = smoothstep(0.045, 0.0, uv.y - (y0 + 0.016)) * step(y0 + 0.016, uv.y);
  vec3 fac = mix(vec3(1.0), vec3(0.80, 0.70, 0.58), back * 0.35);
  fac = mix(fac, tone, m * 0.85);
  fac = mix(fac, vec3(0.34, 0.22, 0.14), board * 0.80);
  fac *= 1.0 - 0.30 * boardShadow;
  // strong at the sides, faint over the middle, so the wallpaper's heart stays clear
  float dx = min(uv.x, 1.0 - uv.x);
  float side = 0.26 + 0.74 * smoothstep(0.40, 0.03, dx);
  float l = lb_blur(uv, 0.02);
  float dark = mix(1.0, smoothstep(0.90, 0.15, l), 0.5);            // the shelves read where the picture is darker
  glow = tone * m * 0.075 * side;                                    // on a dark picture the books still catch a little warm light
  return vec4(fac, 0.62 * side * dark);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = lb_ptr(mpx, vec2(0.5, 0.5));
  float tilt = (m.x - 0.5) * 0.10;

  vec3 base = wall(uv);
  // the picture, warmed and settled a little (never replaced)
  vec3 col = base * mix(vec3(1.0), vec3(0.93, 0.84, 0.72), 0.50);
  vec3 glow;
  vec4 sh = lb_shelves(uv, asp, glow);
  col = col * mix(vec3(1.0), sh.rgb, sh.a) + glow * (1.0 - 0.6 * lb_lum(base));
  // sunbeams: slanted bands that come from the upper right
  float lit = 0.0;
  float shaftAmt = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float slant = 0.58 + tilt;                                   // x shift per unit of y
    float x0 = (1.15 + 0.55 * fi) * asp * 0.5 - uv.y * slant * asp + sin(t * 0.04 + fi) * 0.02;
    float w = 0.105 + 0.030 * lb_h(vec2(fi, 3.0));
    float d = abs(p.x - x0 + 0.0);
    float band = smoothstep(w, w * 0.25, d);
    band *= 0.45 + 0.55 * lb_n(vec2(p.y * 3.0 - t * 0.02, fi * 4.0));
    band *= smoothstep(0.98, 0.25, uv.y) * smoothstep(-0.05, 0.12, uv.y);
    float bars = 0.65 + 0.35 * smoothstep(0.02, 0.06, abs(fract((uv.y + fi * 0.13) * 4.0) - 0.5) - 0.06);
    shaftAmt += band * 0.5;
    lit += band * bars;
  }
  lit = clamp(lit, 0.0, 1.0);
  vec3 sun = vec3(1.0, 0.78, 0.45);
  float lum = lb_lum(col);
  float room = 1.0 - 0.45 * smoothstep(0.35, 0.9, lum);          // on a bright picture the light stays gentle
  col += (col * 0.85 + vec3(0.030, 0.019, 0.007)) * sun * lit * room;   // light on the picture and the spines
  col += sun * (shaftAmt * 0.075 + lit * 0.022) * room;                                  // the light in the air
  // dust in the shafts: drifts away from the pointer
  float dust = 0.0;
  for (int k = 0; k < 2; k++) {
    float cell = k == 0 ? 0.040 : 0.065;
    vec2 q = p / cell;
    q.y -= t * (k == 0 ? 0.04 : 0.025);
    vec2 away = (p - m * vec2(asp, 1.0));
    q += normalize(away + 1e-4) * exp(-dot(away, away) * 14.0) * 1.2 * react;
    q.x += sin(t * 0.12 + q.y * 0.8 + float(k) * 3.0) * 0.4;
    vec2 id = floor(q), f = fract(q) - 0.5;
    float h = lb_h(id + float(k) * 10.0);
    vec2 o = (vec2(lb_h(id + 3.1), lb_h(id + 7.7)) - 0.5) * 0.6;
    float rr = 0.05 + 0.07 * lb_h(id + 1.3);
    float tw = 0.5 + 0.5 * sin(t * (0.4 + lb_h(id + 5.5)) + h * 40.0);
    dust += step(0.5, h) * smoothstep(rr, rr * 0.2, length(f - o)) * tw;
  }
  col += vec3(1.0, 0.86, 0.60) * dust * smoothstep(0.1, 0.8, lit + shaftAmt * 0.6) * 0.50;
  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
