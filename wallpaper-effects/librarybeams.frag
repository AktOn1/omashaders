// label: Library light
// hint: tall windows throw slanted sunbeams across rows of old spines with dust turning in the light, the pointer tilts the beams
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

// an old library: tall windows throw slanted sunbeams across rows of leather spines, dust turns in the light;
// the pointer tilts the light and the dust drifts away from it
vec3 lb_spine(float h, float h2) {
  if (h < 0.17) return vec3(0.34, 0.12, 0.10);   // oxblood
  if (h < 0.34) return vec3(0.16, 0.24, 0.17);   // bottle green
  if (h < 0.50) return vec3(0.40, 0.27, 0.13);   // tan
  if (h < 0.66) return vec3(0.12, 0.17, 0.27);   // navy
  if (h < 0.82) return vec3(0.27, 0.15, 0.09);   // brown
  return vec3(0.46, 0.38, 0.25);                  // vellum
}
// one row of books standing on shelf line y0: returns colour in rgb, mask in a
vec4 lb_books(vec2 p, float y0, float seedr) {
  float cw = 0.030;
  float cid = floor(p.x / cw);
  float f = fract(p.x / cw);
  float h = lb_h(vec2(cid, seedr));
  float h2 = lb_h(vec2(cid + 7.0, seedr));
  float hgt = 0.15 + 0.08 * h2;
  float wdt = 0.55 + 0.45 * lb_h(vec2(cid, seedr + 3.0));
  float top = y0 - hgt;
  float inx = smoothstep(0.0, 0.08, f) * smoothstep(1.0, 0.92, f);
  float iny = step(top, p.y) * step(p.y, y0);
  float m = inx * iny * step(f, wdt + 0.40);
  vec3 c = lb_spine(h, h2) * (0.75 + 0.5 * f);
  float band = smoothstep(0.012, 0.0, abs(p.y - (top + 0.025))) + smoothstep(0.012, 0.0, abs(p.y - (y0 - 0.03)));
  c += vec3(0.50, 0.38, 0.16) * band * 0.45;       // gilt bands
  return vec4(c, m);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = lb_ptr(mpx, vec2(0.5, 0.5));
  float tilt = (m.x - 0.5) * 0.10;

  vec3 base = wall(uv);
  vec3 col = vec3(0.065, 0.042, 0.028) + base * vec3(0.10, 0.075, 0.05);
  // three shelves of books across the whole wall
  for (int r = 0; r < 3; r++) {
    float y0 = 0.30 + 0.30 * float(r);
    vec4 b = lb_books(p + vec2(float(r) * 0.37, 0.0), y0, float(r) * 5.0 + 1.0);
    col = mix(col, b.rgb * 0.58, b.a);
    // shelf board
    float board = smoothstep(0.012, 0.0, y0 + 0.006 - uv.y) * smoothstep(y0 - 0.002, y0 + 0.008, uv.y);
    col = mix(col, vec3(0.10, 0.06, 0.035), board);
  }
  // sunbeams: slanted bands that come from the upper right
  float lit = 0.0;
  float shaftAmt = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float slant = 0.58 + tilt;                                   // x shift per unit of y
    float x0 = (1.15 + 0.55 * fi) * asp * 0.5 - uv.y * slant * asp + sin(t * 0.04 + fi) * 0.02;
    float w = 0.105 + 0.030 * lb_h(vec2(fi, 3.0));
    float d = abs(p.x - x0 + 0.0);
    // soft band, fading toward the bottom and the source
    float band = smoothstep(w, w * 0.25, d);
    band *= 0.45 + 0.55 * lb_n(vec2(p.y * 3.0 - t * 0.02, fi * 4.0));
    band *= smoothstep(0.98, 0.25, uv.y) * smoothstep(-0.05, 0.12, uv.y);
    // the window cross bar shadows the beam in squares
    float bars = 0.65 + 0.35 * smoothstep(0.02, 0.06, abs(fract((uv.y + fi * 0.13) * 4.0) - 0.5) - 0.06);
    shaftAmt += band * 0.5;
    lit += band * bars;
  }
  lit = clamp(lit, 0.0, 1.0);
  vec3 sun = vec3(1.0, 0.78, 0.45);
  col += (col * 2.3 + vec3(0.050, 0.032, 0.012)) * sun * lit * 1.0;   // light on the spines and boards
  col += sun * shaftAmt * 0.075;                                       // the light in the air
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
  col += vec3(1.0, 0.86, 0.60) * dust * smoothstep(0.1, 0.8, lit + shaftAmt * 0.6) * 0.55;
  col *= 1.0 - 0.60 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
