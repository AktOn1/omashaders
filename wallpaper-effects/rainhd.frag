// label: Digital rain HD
// hint: sharp glyphs, mouse lights it
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}



// stroke-built katakana-like glyphs: 12 candidate strokes on a 3x3 point grid, antialiased distance fields
float segd(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// stroke i as (x0, y0, x1, y1) on the unit grid (no const arrays: Qt's GLSL targets reject them)
vec4 strokeAt(int i) {
  if (i == 0) return vec4(0.0, 1.0, 1.0, 1.0);
  if (i == 1) return vec4(0.0, 0.5, 1.0, 0.5);
  if (i == 2) return vec4(0.0, 0.0, 1.0, 0.0);
  if (i == 3) return vec4(0.0, 0.0, 0.0, 1.0);
  if (i == 4) return vec4(1.0, 0.0, 1.0, 1.0);
  if (i == 5) return vec4(0.5, 0.0, 0.5, 1.0);
  if (i == 6) return vec4(0.0, 1.0, 1.0, 0.0);
  if (i == 7) return vec4(0.0, 0.0, 1.0, 1.0);
  if (i == 8) return vec4(0.0, 0.5, 0.5, 1.0);
  if (i == 9) return vec4(0.5, 0.5, 1.0, 0.0);
  if (i == 10) return vec4(0.0, 0.0, 0.5, 0.5);
  return vec4(0.5, 1.0, 1.0, 0.5);
}
// q: 0..1 inside the glyph box, ar: box width/height in px (keeps strokes even), returns distance to the nearest stroke in glyph units of height
float glyphDist(vec2 q, float seed, float ar) {
  vec2 p = vec2(q.x * ar, q.y);
  float W = ar;
  float d = 9.0;
  int n = 0;
  for (int i = 0; i < 12; i++) {
    if (hash(vec2(seed, float(i) * 3.17 + 0.5)) < 0.30) {
      vec4 s = strokeAt(i);
      d = min(d, segd(p, vec2(s.x * W, s.y), vec2(s.z * W, s.w)));
      n++;
    }
  }
  if (n < 2) d = min(segd(p, vec2(0.5 * W, 0.0), vec2(0.5 * W, 1.0)), segd(p, vec2(0.0, 0.5), vec2(W, 0.5)));
  return d;
}

// one rain layer: x = glyph light (0..1), y = how much of it is the bright drop head
vec2 rainLayer(vec2 uv, vec2 cellPx, float spd, float seed, vec2 m, float asp) {
  vec2 cells = res / cellPx;
  vec2 cp = uv * cells;
  vec2 id = floor(cp);
  vec2 f = fract(cp);
  float colh = hash(vec2(id.x, seed));
  float sp = (0.30 + colh * 0.55) * spd;
  float light = 0.0, headL = 0.0;
  for (int k = 0; k < 2; k++) {
    float ph = time * sp * 0.30 + colh * 9.0 + float(k) * 0.5;
    float cyc = floor(ph);
    float len = 10.0 + 16.0 * hash(vec2(id.x + cyc * 1.7, seed + 4.0 + float(k)));
    float head = fract(ph) * (cells.y + len + 6.0) - 3.0;
    float dist = head - id.y;
    if (dist > 0.0 && dist < len) {
      float tr = pow(1.0 - dist / len, 1.5);
      // 2-3 glyph rows after the head are fully lit, the tail fades with a slow shimmer
      tr *= 0.75 + 0.25 * sin(time * 2.0 + id.y * 1.3 + colh * 20.0);
      light = max(light, tr);
      if (dist < 1.0) headL = max(headL, 1.0);
    }
  }
  if (light < 0.01) return vec2(0.0);
  vec2 cc = (id + 0.5) / cells;
  float near = exp(-length((cc - m) * vec2(asp, 1.0)) * 7.0);
  float rate = (1.2 + colh * 3.0) * (1.0 + 4.0 * near);
  float tick = floor(time * rate + hash(id) * 8.0);
  float gseed = hash(id + vec2(tick * 0.173, seed));
  // glyph box: 62 percent of the cell width, 78 percent of its height
  vec2 box = cellPx * vec2(0.62, 0.78);
  vec2 q = (f - vec2(0.19, 0.11)) / vec2(0.62, 0.78);
  float inBox = step(-0.35, q.x) * step(q.x, 1.35) * step(-0.25, q.y) * step(q.y, 1.25);
  if (inBox < 0.5) return vec2(0.0);
  float ar = box.x / box.y;
  float d = glyphDist(q, gseed, ar) * box.y;       // pixels
  float aa = 0.6 / max(zoom, 0.05);                 // half a screen pixel, in unzoomed px
  float w = max(0.55, box.y * 0.07);
  float stroke = 1.0 - smoothstep(w - aa, w + aa, d);
  float glow = exp(-d * 0.9) * 0.22;
  float g = clamp(stroke + glow, 0.0, 1.0);
  return vec2(g * light, g * headL);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  float u = res.y / 1080.0;
  float mdist = length((uv - m) * vec2(asp, 1.0));
  float mglow = exp(-mdist * 5.0);
  vec2 near = rainLayer(uv, vec2(10.0, 15.0) * u, 0.7, 3.0, m, asp);      // far, small, slow
  vec2 front = rainLayer(uv, vec2(17.0, 25.0) * u, 1.0, 11.0, m, asp);    // close, larger
  float lf = max(front.x, near.x * 0.55);
  float hf = max(front.y, near.y * 0.6);
  lf *= 1.0 + 1.3 * mglow;
  vec3 base;
  vec3 ink;
  vec3 headc;
  // classic green on near black; a ghost of the wallpaper stays visible
  base = cBg.rgb * 0.7 + wall(uv) * 0.10;
  ink = vec3(0.10, 0.95, 0.38);
  headc = vec3(0.80, 1.0, 0.86);
  vec3 col = base + ink * lf + headc * hf * (1.0 + 0.6 * mglow);
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
