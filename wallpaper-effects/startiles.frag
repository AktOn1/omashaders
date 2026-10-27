// label: Star tiles
// hint: an eight-pointed star tiling in turquoise and ivory, every star in its own square; neighbouring stars turn against each other like meshing gears, and the stars around the pointer click round one quarter step per ring, a wave of ratchets
// category: Sacred geometry
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
const float PI = 3.14159265;
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// clockwork step: rests on a whole number, then swings to the next one in a quarter of the unit, with a small overshoot (an escapement)
float tick(float x) { float t = clamp(fract(x) * 4.0, 0.0, 1.0) - 1.0; return floor(x) + 1.0 + 2.70158 * t * t * t + 1.70158 * t * t; }
// 1 on a line of half-width w around distance d = 0
float ln(float d, float w) { float aa = 0.8 / res.y; return 1.0 - smoothstep(w - aa, w + aa, abs(d)); }

float box(vec2 q, float r) { return max(abs(q.x), abs(q.y)) - r; }
float seg(vec2 q, vec2 a, vec2 b) {
  vec2 pa = q - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  bool hasM = mpx.x > -5000.0;
  vec2 mp = (mpx / res - 0.5) * vec2(asp, 1.0);
  float S = 0.15;

  vec3 aqua = vec3(0.22, 0.88, 0.80), ivory = vec3(0.96, 0.98, 0.90), cobalt = vec3(0.16, 0.38, 0.95);
  vec3 col = wall(uv) * 0.5 + vec3(0.0, 0.018, 0.03);

  // stars: one in the middle of every square
  vec2 g = p / S;
  vec2 c = floor(g);
  vec2 q = g - c - 0.5;
  vec2 cw = (c + 0.5) * S;
  float chk = mod(c.x + c.y, 2.0) > 0.5 ? 1.0 : -1.0;
  float dc = hasM ? length(cw - mp) / S : 99.0;
  float wave = tick(time / 2.4 - 0.16 * (c.x + c.y));
  float step1 = tick(clamp(5.0 - dc, 0.0, 5.0));
  float th = chk * (wave * PI / 8.0 + step1 * PI / 8.0);
  vec2 qs = rot(q, th);
  float sq1 = abs(box(qs, 0.33));
  float sq2 = abs(box(rot(qs, PI / 4.0), 0.33));
  float starIn = max(1.0 - smoothstep(0.0, 0.01, box(qs, 0.33)), 1.0 - smoothstep(0.0, 0.01, box(rot(qs, PI / 4.0), 0.33)));
  float sOutline = ln(min(sq1, sq2) * S, 0.0014);
  float ring = ln((length(q) - 0.47) * S, 0.0010);
  // a small square and a hand (one corner is marked) say which way the star faces
  vec2 qi = rot(qs, PI / 4.0);
  float inner = ln(abs(box(qi, 0.10)) * S, 0.0010);
  float dot1 = 1.0 - smoothstep(0.02, 0.026, length(qs - vec2(0.33, 0.33)));
  float hand = ln(seg(qs, vec2(0.0), vec2(0.33)) * S, 0.0011);

  // diamonds: one on every corner, turning a quarter at a time against the stars
  vec2 g2 = p / S + 0.5;
  vec2 c2 = floor(g2);
  vec2 q2 = g2 - c2 - 0.5;
  vec2 cw2 = (c2) * S;
  float dc2 = hasM ? length(cw2 - mp) / S : 99.0;
  float th2 = -(tick(time / 2.4 - 0.16 * (c2.x + c2.y) - 0.5) + tick(clamp(5.0 - dc2, 0.0, 5.0))) * PI / 4.0;
  vec2 qd = rot(q2, th2);
  float dd = abs(qd.x) + abs(qd.y) * 1.0;
  float dmd = ln((dd - 0.16) * S * 0.7071, 0.0012);
  float dmf = 1.0 - smoothstep(0.0, 0.012, (dd - 0.16) * 0.7071);

  float lit = hasM ? exp(-length(p - mp) * 2.6) : 0.0;
  col = mix(col, cobalt * 0.5, starIn * (0.28 + 0.2 * lit));
  col += ivory * dmf * (0.10 + 0.2 * lit);
  col += (aqua * (0.55 + 0.9 * lit)) * (sOutline + ring * 0.6) * 0.9;
  col += ivory * (dmd * 0.8 + inner * 0.6 + dot1 + hand * 0.5) * (0.5 + 0.5 * lit);
  col += aqua * 0.10 * exp(-length(p - mp) * 5.0) * (hasM ? 1.0 : 0.0);

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
