// label: Dial-up hearts
// hint: late-nineties chat romance laid over your picture, all tiny shapes and no pictures: little pixel hearts that rise slowly and twinkle near the edges, a few soft "typing..." bubbles that fade in and out, pixel sparkle stars and a faint scanline shimmer. Hearts drift toward the pointer. Calm, your picture stays the wallpaper
// category: Retro machines
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
float dl_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float dl_n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(dl_h(i), dl_h(i + 1.0), f); }
float dl_glow(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }

// the palette of the theme
const vec3 dl_pink = vec3(1.00, 0.34, 0.66);
const vec3 dl_lav  = vec3(0.72, 0.64, 1.00);
const vec3 dl_cyan = vec3(0.24, 0.94, 1.00);
const vec3 dl_plum = vec3(0.13, 0.04, 0.24);

// a 7 x 6 bitmap heart on the integer grid g (x 0..6, y 0 = top row): 1 inside, 0 outside
float dl_heart(vec2 g) {
  if (g.x < 0.0 || g.x > 6.0 || g.y < 0.0 || g.y > 5.0) return 0.0;
  float ax = abs(g.x - 3.0);
  if (g.y < 0.5) return (ax > 0.5 && ax < 2.5) ? 1.0 : 0.0;
  if (g.y < 2.5) return 1.0;
  if (g.y < 3.5) return ax < 2.5 ? 1.0 : 0.0;
  if (g.y < 4.5) return ax < 1.5 ? 1.0 : 0.0;
  return ax < 0.5 ? 1.0 : 0.0;
}

// the four little rising-heart tracks: x side (0 left edge, 1 right edge, 2 anywhere), seed
vec2 dl_track(int i) {
  if (i == 0) return vec2(0.0, 1.0);
  if (i == 1) return vec2(1.0, 2.0);
  if (i == 2) return vec2(0.0, 3.0);
  if (i == 3) return vec2(1.0, 4.0);
  if (i == 4) return vec2(0.0, 5.0);
  if (i == 5) return vec2(1.0, 6.0);
  if (i == 6) return vec2(2.0, 7.0);
  if (i == 7) return vec2(0.0, 8.0);
  if (i == 8) return vec2(1.0, 9.0);
  if (i == 9) return vec2(2.0, 10.0);
  if (i == 10) return vec2(0.0, 11.0);
  return vec2(1.0, 12.0);
}

// the typing bubbles: x, y (screen fractions), phase
vec3 dl_bub(int i) {
  if (i == 0) return vec3(0.115, 0.30, 0.0);
  if (i == 1) return vec3(0.885, 0.62, 3.4);
  return vec3(0.80, 0.14, 6.1);
}

// rounded box distance
float dl_box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

vec4 fxMain(vec2 mpx) {
  float asp = res.x / res.y;
  vec2 uv = qt_TexCoord0;
  vec2 p = vec2(uv.x * asp, uv.y);
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? vec2(mpx.x / res.y, mpx.y / res.y) : vec2(-10.0);
  float t = time;
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  // soft pink light low left, cyan high right, plum in the corners; the middle of the picture is left alone
  float vig = smoothstep(0.42, 1.15, length((uv - 0.5) * vec2(asp, 1.0)));
  col = mix(col, col * vec3(0.84, 0.82, 0.96) + vec3(0.018, 0.006, 0.038), 0.28 * vig);
  col += dl_pink * dl_glow(uv * vec2(asp, 1.0), vec2(0.0, 1.0), 0.55) * 0.070;
  col += dl_cyan * dl_glow(uv * vec2(asp, 1.0), vec2(asp, 0.0), 0.55) * 0.055;

  // faint scanline shimmer: fine rows, plus a slow soft band travelling down the picture
  float rowp = floor(uv.y * res.y * 0.5);
  float band = exp(-pow((fract(uv.y * 0.9 - t * 0.018) - 0.5) * 7.0, 2.0));
  col *= 1.0 - 0.014 * mod(rowp, 2.0);
  col += dl_lav * band * 0.020 * (1.0 - 0.6 * lum0);

  // pixel size of the whole theme, snapped to whole screen pixels so the bitmaps stay crisp
  float ps = max(floor(res.y * 0.0047 + 0.5), 2.0) / res.y;

  // ---- typing bubbles: a soft chat bubble with three bouncing dots, fading in and out here and there ----
  for (int i = 0; i < 3; i++) {
    vec3 B = dl_bub(i);
    float cyc = t * 0.085 + B.z;
    float life = fract(cyc);
    float sid = floor(cyc) + float(i) * 7.0;
    float fade = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.82, life);
    vec2 bc = vec2((B.x + (dl_h(sid + 1.0) - 0.5) * 0.05) * asp, B.y + (dl_h(sid + 2.0) - 0.5) * 0.2 - life * 0.02);
    vec2 d = p - bc;
    if (fade > 0.01 && abs(d.x) < 0.07 && abs(d.y) < 0.05) {
      vec2 q = floor(d / ps + 0.5) * ps;                  // bitmap-style coarse grid
      float sd = dl_box(q, vec2(7.0 * ps, 3.0 * ps), 2.0 * ps);
      sd = min(sd, dl_box(q - vec2(-5.0 * ps, 4.0 * ps), vec2(0.6 * ps), 0.0));   // little stepped tail at the lower left
      sd = min(sd, dl_box(q - vec2(-6.0 * ps, 5.0 * ps), vec2(0.6 * ps), 0.0));
      float fill = step(sd, 0.0);
      float edge = step(sd, ps * 1.01) * (1.0 - fill);
      float dots = 0.0;
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float bounce = max(sin(t * 3.6 - fk * 1.1), 0.0);
        vec2 dc = q - vec2((fk - 1.0) * 4.0 * ps, -step(0.6, bounce) * ps);
        dots += step(abs(dc.x), 0.8 * ps) * step(abs(dc.y), 0.8 * ps) * (0.45 + 0.55 * bounce);
      }
      float near = has ? exp(-length(bc - mp) * 3.0) : 0.0;
      float al = fade * (0.85 + 0.3 * near);
      col = mix(col, dl_plum, edge * 0.40 * al);
      col = mix(col, mix(vec3(0.96, 0.92, 1.0), dl_lav, 0.30), fill * 0.46 * al);
      col = mix(col, dl_cyan, edge * 0.30 * al);
      col = mix(col, vec3(0.92, 0.20, 0.52), clamp(dots, 0.0, 1.0) * fill * 0.85 * al);
    }
  }

  // ---- rising pixel hearts along the edges; each steps up one pixel at a time, twinkles, and drifts toward the pointer ----
  for (int i = 0; i < 12; i++) {
    vec2 T = dl_track(i);
    float fi = float(i);
    float spd = 0.016 + 0.014 * dl_h(fi + 3.0);
    float ph = t * spd + dl_h(fi * 5.3 + 1.0);
    float sid = floor(ph) * 13.0 + fi * 31.0;
    float life = fract(ph);
    float er = 0.17 * pow(dl_h(sid + 1.0), 1.4);
    float x01 = T.x < 0.5 ? er : (T.x < 1.5 ? 1.0 - er : 0.06 + 0.88 * dl_h(sid + 1.0));
    float mag = T.x > 1.5 ? 0.55 : 1.0;
    vec2 o = vec2(x01 * asp + 0.012 * sin(life * 11.0 + fi * 1.7), 1.06 - life * 1.12);
    vec2 dm = mp - o;
    float dml = length(dm);
    o += dm / (dml + 0.001) * min(dml, 0.07) * smoothstep(0.34, 0.08, dml);
    float sz = 1.0 + floor(dl_h(sid + 4.0) * 1.99);       // pixel scale 1 or 2 (in theme pixels)
    float cs = ps * (0.75 + 0.5 * sz);
    cs = max(floor(cs * res.y + 0.5), 2.0) / res.y;
    o = (floor(o / cs) + 0.5) * cs;                       // steps on the pixel grid
    vec2 d = p - o;
    if (abs(d.x) < cs * 5.0 && abs(d.y) < cs * 4.5) {
      vec2 g = floor(d / cs + vec2(3.5, 3.0));
      float body = dl_heart(g);
      float ring = max(max(dl_heart(g + vec2(1.0, 0.0)), dl_heart(g - vec2(1.0, 0.0))), max(dl_heart(g + vec2(0.0, 1.0)), dl_heart(g - vec2(0.0, 1.0)))) * (1.0 - body);
      float tw = step(0.18, dl_h(floor(t * 1.6 + fi * 3.1) + fi * 9.0));   // an occasional blink
      float fade = smoothstep(0.0, 0.10, life) * smoothstep(1.0, 0.86, life) * (0.55 + 0.45 * tw) * mag;
      float pick = dl_h(sid + 6.0);
      vec3 hc = pick < 0.55 ? dl_pink : (pick < 0.80 ? dl_lav : dl_cyan);
      float hi = step(abs(g.x - 1.0), 0.5) * step(abs(g.y - 1.0), 0.5);   // one white pixel of shine
      vec3 hcol = mix(hc, vec3(1.0), hi * 0.85);
      hcol *= 1.0 - 0.18 * step(3.5, g.y) * body;                         // the lower rows a touch deeper
      col = mix(col, dl_plum, ring * 0.38 * fade);
      col = mix(col, hcol, body * 0.60 * fade);
    }
  }

  // ---- sparkle stars: tiny pixel crosses that grow and shrink in place, larger near the pointer ----
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float cyc = t * 0.16 + dl_h(fi * 4.7 + 1.0) * 5.0;
    float sid = floor(cyc) * 7.0 + fi * 19.0;
    float life = fract(cyc);
    vec2 c = vec2((0.04 + 0.92 * dl_h(sid + 1.0)) * asp, 0.05 + 0.90 * dl_h(sid + 2.0));
    float near = has ? exp(-length(c - mp) * 5.0) : 0.0;
    float grow = sin(life * 3.14159);
    float arm = floor(grow * (2.2 + 2.0 * near) + 0.2);
    vec2 d = p - c;
    if (arm > 0.5 && abs(d.x) < 0.04 && abs(d.y) < 0.04) {
      float cs = ps * 0.7;
      cs = max(floor(cs * res.y + 0.5), 2.0) / res.y;
      vec2 g = floor(d / cs + 0.5);
      float on = (g.x == 0.0 && abs(g.y) <= arm) || (g.y == 0.0 && abs(g.x) <= arm) ? 1.0 : 0.0;
      float tip = step(arm - 0.5, max(abs(g.x), abs(g.y))) * step(1.5, arm);
      vec3 sc = mix(vec3(1.0, 0.96, 1.0), dl_cyan, tip * 0.7);
      col = mix(col, sc, on * 0.62);
    }
  }

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
