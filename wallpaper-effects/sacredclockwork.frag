// label: Sacred clockwork
// hint: gold Flower of Life circles over your picture, with a small hexagram and a clock hand on every crossing; the hands tick round to point at the pointer, and the rings of circles around it click round like the dial of a safe
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

// distance to the nearest circle edge of a Flower of Life lattice (circles of radius R centred on a hexagonal lattice of spacing R), and the nearest centre
float flower(vec2 p, float R, out vec2 node) {
  vec2 q = vec2(p.x / R - p.y / (1.7320508 * R), p.y / (0.8660254 * R));
  vec2 i = floor(q);
  float best = 1e9, nd = 1e9;
  node = vec2(0.0);
  for (int dy = -1; dy <= 2; dy++) {
    for (int dx = -1; dx <= 2; dx++) {
      vec2 n = i + vec2(float(dx), float(dy));
      vec2 pos = R * vec2(n.x + 0.5 * n.y, 0.8660254 * n.y);
      float l = length(p - pos);
      best = min(best, abs(l - R));
      if (l < nd) { nd = l; node = pos; }
    }
  }
  return best;
}
// outline distance of an equilateral triangle with circumradius r, one point up
float tri(vec2 q, float r) {
  float d = max(max(dot(q, vec2(0.0, -1.0)), dot(q, vec2(0.8660254, 0.5))), dot(q, vec2(-0.8660254, 0.5))) - 0.5 * r;
  return abs(d);
}
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
  float R = 0.17;
  vec3 gold = vec3(1.0, 0.76, 0.32), pale = vec3(1.0, 0.93, 0.72);

  vec3 col = wall(uv) * 0.66 + vec3(0.006, 0.004, 0.022);

  // the whole lattice ticks round the screen centre, 7.5 degrees every few seconds
  vec2 pl = rot(p, -tick(time / 4.0) * PI / 24.0);
  vec2 mpl = rot(mp, -tick(time / 4.0) * PI / 24.0);
  // rings around the pointer click round one after the other, like the dial of a safe
  float dm = hasM ? length(pl - mpl) : 9.0;
  float k = max((0.66 - dm) / 0.082, 0.0);
  if (hasM) {
    pl = mpl + rot(pl - mpl, tick(k) * PI / 30.0);
  }
  float lit = hasM ? exp(-dm * 2.4) : 0.0;

  vec2 node;
  float fd = flower(pl, R, node);
  float circles = ln(fd, 0.0011);
  float glow = exp(-fd / 0.006) * 0.16;

  // safe-dial rings: a thin circle where one ring meets the next
  float ring = 0.0;
  if (hasM) {
    float j = floor(k);
    float rj = 0.66 - j * 0.082;
    ring = ln(dm - (rj - 0.01), 0.0035) * step(0.5, k) * 0.35 + ln(dm - (rj + 0.072), 0.0035) * step(1.5, k) * 0.35;
  }

  // on every crossing: a hexagram that ticks half a point at a time, a small ring and a clock hand
  vec2 q = pl - node;
  float par = mod(floor(node.x / (0.5 * R) + 0.5) + floor(node.y / (0.8660254 * R) + 0.5), 2.0);
  float hsh = hash(floor(node / (0.5 * R) + 0.5));
  float hexa = tick(time / 2.6 + hsh * 3.0) * PI / 6.0 * (par > 0.5 ? 1.0 : -1.0);
  vec2 qh = rot(q, hexa);
  float hr = 0.5 * R;
  float star = ln(min(tri(qh, hr), tri(rot(qh, PI), hr)), 0.0009);
  float hubr = ln(length(q) - 0.07 * R, 0.0009);

  // hand: ticks to the pointer when one is near, otherwise to a time of its own
  float angT = tick(time / 1.7 + hsh * 7.0) * PI / 12.0;
  float angP = angT;
  float infl = 0.0;
  if (hasM) {
    vec2 dd = mpl - node;
    angP = tick(atan(dd.y, dd.x) / (PI / 12.0)) * PI / 12.0;
    infl = smoothstep(1.7, 0.35, length(dd));
  }
  float ang = angT + infl * (mod(angP - angT + PI, 2.0 * PI) - PI);
  vec2 hd = vec2(cos(ang), sin(ang));
  float hand = ln(seg(q, hd * 0.1 * R, hd * 0.42 * R), 0.0014);
  float tipf = 1.0 - smoothstep(0.026 * R, 0.032 * R, length(q - hd * 0.44 * R));

  float a = 0.27 + 0.73 * lit;
  col += gold * (circles * a * 0.85 + glow * (0.5 + 0.5 * lit));
  col += pale * (star * (0.45 + 0.55 * lit) + hubr * 0.5 + hand * (0.6 + 0.4 * infl) + tipf) * (0.55 + 0.45 * lit);
  col += gold * ring * 0.8;
  col += gold * 0.12 * exp(-dm * 5.0);

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
