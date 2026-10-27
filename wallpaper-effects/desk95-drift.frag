// label: Desktop 95 drift
// hint: a mid-nineties desktop mood laid over your picture, all hard little pixels and no pictures: a faint teal ordered dither that breathes across the screen, a few empty outlined windows with navy title strips bouncing slowly like a screensaver, a pixel starfield streaming out of the middle, and a marching-ants selection with a pale-yellow tip that follows the pointer. Calm, your picture stays the wallpaper
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
float dw_h(float n) { return fract(sin(n * 127.1 + 17.3) * 43758.5453); }
float dw_h2(vec2 v) { return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }
float dw_n(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dw_h2(i), dw_h2(i + vec2(1.0, 0.0)), f.x), mix(dw_h2(i + vec2(0.0, 1.0)), dw_h2(i + vec2(1.0, 1.0)), f.x), f.y);
}

// palette of the theme
const vec3 dw_teal = vec3(0.0, 0.502, 0.502);
const vec3 dw_silver = vec3(0.753, 0.753, 0.753);
const vec3 dw_navy = vec3(0.0, 0.0, 0.502);
const vec3 dw_tip = vec3(1.0, 1.0, 0.882);

// 4x4 ordered-dither threshold from a cell position (no tables)
float dw_idx2(vec2 c) {
  float a = mod(floor(c.x), 2.0);
  float b = mod(floor(c.y), 2.0);
  return mod(a + b, 2.0) * 2.0 + b;
}
float dw_bayer(vec2 c) { return (dw_idx2(c) * 4.0 + dw_idx2(floor(c * 0.5)) + 0.5) / 16.0; }

// the bouncing windows: x0, y0 (start 0..1), speed x, speed y (cells per second), then width, height (cells)
vec4 dw_wdyn(int i) {
  if (i == 0) return vec4(0.12, 0.20, 3.4, 2.1);
  if (i == 1) return vec4(0.61, 0.70, -2.6, 2.9);
  if (i == 2) return vec4(0.35, 0.48, 2.2, -3.1);
  return vec4(0.83, 0.12, -3.0, -1.8);
}
vec2 dw_wsize(int i) {
  if (i == 0) return vec2(50.0, 32.0);
  if (i == 1) return vec2(38.0, 26.0);
  if (i == 2) return vec2(62.0, 40.0);
  return vec2(32.0, 22.0);
}
float dw_tri(float u) { return abs(fract(u * 0.5) * 2.0 - 1.0); }

// one empty window at cell q: returns (rgb, alpha); border bevel, navy title strip, three small buttons
vec4 dw_window(vec2 q, vec2 o, vec2 sz, float act) {
  vec2 d = q - o;
  if (d.x < -1.0 || d.y < -1.0 || d.x > sz.x + 1.0 || d.y > sz.y + 1.0) return vec4(0.0);
  if (d.x >= sz.x || d.y >= sz.y) {
    // hard one-cell drop shadow on the bottom and right
    if (d.x >= 0.0 && d.y >= 0.0 && d.x < sz.x + 1.0 && d.y < sz.y + 1.0 && (d.x >= 1.0 || d.y >= 1.0)) return vec4(0.0, 0.0, 0.0, 0.16);
    return vec4(0.0);
  }
  if (d.x < 0.0 || d.y < 0.0) return vec4(0.0);
  // outer edge: white top-left, dark bottom-right
  if (d.y < 1.0 || d.x < 1.0) return vec4(1.0, 1.0, 1.0, 0.62);
  if (d.y >= sz.y - 1.0 || d.x >= sz.x - 1.0) return vec4(0.08, 0.08, 0.12, 0.62);
  // inner edge: silver / mid grey
  if (d.y < 2.0 || d.x < 2.0) return vec4(dw_silver, 0.50);
  if (d.y >= sz.y - 2.0 || d.x >= sz.x - 2.0) return vec4(0.50, 0.50, 0.50, 0.50);
  // title strip: navy (grey when not the lead window) with a lighter blue end
  if (d.y < 8.0) {
    float gx = clamp((d.x - 2.0) / max(sz.x - 4.0, 1.0), 0.0, 1.0);
    vec3 tc = mix(dw_navy, vec3(0.06, 0.52, 0.82), gx * gx);
    tc = mix(vec3(0.42, 0.42, 0.50), tc, act);
    // three tiny square buttons at the right end
    if (d.y >= 3.0 && d.y < 7.0 && d.x >= sz.x - 15.0 && d.x < sz.x - 3.0) {
      float bx = mod(d.x - (sz.x - 15.0), 4.0);
      if (bx < 3.0) return vec4(dw_silver, 0.60);
    }
    return vec4(tc, 0.58);
  }
  // body: empty, a whisper of silver so it still reads on a dark picture
  return vec4(dw_silver, 0.07);
}

vec4 fxMain(vec2 mpx) {
  float asp = res.x / res.y;
  vec2 uv = qt_TexCoord0;
  bool has = mpx.x > -5000.0;
  float t = time;
  float ps = max(2.0, floor(res.y / 360.0 + 0.5));             // one "screen pixel" of the effect, in real pixels
  vec2 cells = res / ps;
  vec2 q = floor(uv * res / ps);                               // integer cell of this fragment
  vec2 mc = has ? floor(mpx / ps) : vec2(-9999.0);             // pointer cell
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  // ---- teal ordered dither that breathes across the screen: pixels of a Bayer pattern light up where a slow field is high ----
  vec2 g = q / cells;
  float field = 0.5 + 0.5 * sin((g.x * 1.6 + g.y * 2.4) * 2.2 + t * 0.11 + 6.0 * dw_n(g * 2.5 + vec2(t * 0.006, 1.0)));
  float edge = smoothstep(0.30, 1.0, length((uv - 0.5) * vec2(asp * 0.75, 1.0)));
  float cov = clamp(field * 0.42 + edge * 0.40, 0.0, 0.85);
  float on = step(dw_bayer(q), cov);
  col = mix(col, mix(dw_teal, vec3(0.75, 0.95, 0.95), 0.25 * field), on * 0.13);

  // ---- starfield streaming out of the middle (the pointer tilts the vanishing point a little) ----
  vec2 vp = cells * 0.5;
  if (has) vp += (mpx / res - 0.5) * cells * 0.10;
  vec3 starc = vec3(0.0);
  float starA = 0.0;
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float spd = 0.020 + 0.016 * dw_h(fi + 3.0);
    float ph = t * spd + dw_h(fi * 2.7);
    float life = fract(ph);
    float sd = floor(ph) * 7.0 + fi;
    float ang = dw_h(sd + 11.0) * 6.2832;
    float r = (0.04 + life * life * 0.95) * cells.y * 0.62;
    vec2 sp = floor(vp + vec2(cos(ang) * asp * 0.85, sin(ang)) * r);
    float sz = life > 0.62 ? 2.0 : 1.0;
    vec2 ds = q - sp;
    if (ds.x >= 0.0 && ds.y >= 0.0 && ds.x < sz && ds.y < sz) {
      float fade = smoothstep(0.0, 0.10, life) * smoothstep(1.0, 0.86, life);
      starc = mix(vec3(1.0), vec3(0.62, 1.0, 1.0), step(0.5, dw_h(sd + 5.0)));
      starA = max(starA, fade * 0.62);
    }
  }
  col = mix(col, starc, starA);

  // ---- four empty windows bounce slowly about like a screensaver, and shy away from the pointer ----
  for (int i = 0; i < 4; i++) {
    vec4 dyn = dw_wdyn(i);
    vec2 sz = dw_wsize(i);
    vec2 span = max(cells - sz, vec2(1.0));
    vec2 o = vec2(dw_tri(dyn.x + dyn.z * t / span.x), dw_tri(dyn.y + dyn.w * t / span.y)) * span;
    vec2 dm = (o + sz * 0.5) - mc;
    float dl = length(dm);
    o += dm / (dl + 0.5) * 9.0 * exp(-pow(dl / 55.0, 2.0));
    o = floor(o);
    vec4 w = dw_window(q, o, sz, i == 2 ? 1.0 : 0.0);
    col = mix(col, w.rgb, w.a);
  }

  // ---- a few tiny pixel sparkles that blink in steps ----
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 sp = floor(vec2(0.07 + 0.86 * dw_h(fi * 4.3 + 1.0), 0.08 + 0.84 * dw_h(fi * 6.1 + 2.0)) * cells);
    float step4 = mod(floor(t * 0.9 + fi * 1.7), 4.0);
    vec2 dd = q - sp;
    float arm = step4 > 1.5 ? 2.0 : 1.0;
    bool plus = (abs(dd.x) < 0.5 && abs(dd.y) <= arm) || (abs(dd.y) < 0.5 && abs(dd.x) <= arm);
    if (plus && step4 < 3.5) col = mix(col, vec3(1.0), 0.50);
  }

  // ---- the pointer: marching-ants selection ending at the pointer, with a pale-yellow tip ----
  if (has) {
    float sw = 30.0 + 7.0 * sin(t * 0.35);
    float shh = sw * 0.62;
    vec2 a0 = mc - vec2(sw, shh);
    vec2 dq = q - a0;
    if (dq.x >= 0.0 && dq.y >= 0.0 && dq.x <= sw && dq.y <= shh) {
      bool ring = dq.x < 1.0 || dq.y < 1.0 || dq.x > sw - 1.0 || dq.y > shh - 1.0;
      if (ring) {
        float along = (dq.y < 1.0 || dq.y > shh - 1.0) ? dq.x : dq.y;
        float dir = (dq.y < 1.0 || dq.x > sw - 1.0) ? 1.0 : -1.0;
        float dash = mod(floor(along + dir * t * 2.5), 4.0);
        col = mix(col, dash < 2.0 ? vec3(0.0) : vec3(1.0), 0.78);
      } else {
        col = mix(col, dw_navy, 0.12);
      }
    }
    // a small pale-yellow tip hanging under the pointer, with two lines of grey "text"
    vec2 tp = q - (mc + vec2(5.0, 7.0));
    if (tp.x >= 0.0 && tp.y >= 0.0 && tp.x < 26.0 && tp.y < 10.0) {
      bool border = tp.x < 1.0 || tp.y < 1.0 || tp.x >= 25.0 || tp.y >= 9.0;
      vec3 tc = dw_tip;
      if (border) tc = vec3(0.0);
      else if (tp.y >= 3.0 && tp.y < 4.0 && tp.x >= 3.0 && tp.x < 20.0 && mod(tp.x, 4.0) < 3.0) tc = vec3(0.35);
      else if (tp.y >= 6.0 && tp.y < 7.0 && tp.x >= 3.0 && tp.x < 14.0 && mod(tp.x, 4.0) < 3.0) tc = vec3(0.35);
      col = mix(col, tc, 0.70);
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
