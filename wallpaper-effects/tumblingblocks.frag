// label: Tumbling blocks
// hint: a field of isometric cubes in neon pink, cyan and violet; the three faces of every cube trade colours with a click, in a slow wave across the screen, and the cubes around the pointer flip faster, one ring after the other
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

float seg(vec2 q, vec2 a, vec2 b) {
  vec2 pa = q - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// distance from q to the ray from the origin along direction a (angle in radians)
float spoke(vec2 q, float a) {
  vec2 d = vec2(cos(a), sin(a));
  float t = dot(q, d);
  return t > 0.0 ? abs(q.x * d.y - q.y * d.x) : length(q);
}
vec3 face(float i) {
  float f = mod(i, 3.0);
  vec3 top = vec3(1.0, 0.22, 0.62), right = vec3(0.10, 0.82, 0.98), left = vec3(0.36, 0.14, 0.80);
  return f < 1.0 ? top : (f < 2.0 ? right : left);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  bool hasM = mpx.x > -5000.0;
  vec2 mp = (mpx / res - 0.5) * vec2(asp, 1.0);
  float H = 0.115;

  // pointy-top hexagon grid: nearest centre of two interleaved rectangles
  vec2 s = vec2(1.7320508 * H, 3.0 * H);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  bool useA = dot(a, a) < dot(b, b);
  vec2 q = useA ? a : b;
  vec2 cen = p - q;
  float hsh = hash(floor(cen / (0.5 * H) + 0.5));

  float dcell = hasM ? length(cen - mp) / (1.7320508 * H) : 99.0;
  float lit = hasM ? exp(-length(p - mp) * 2.4) : 0.0;
  // the faces trade places: a wave across the screen, plus rings of flips around the pointer
  float rot3 = tick(time / 2.6 - (cen.x * 1.1 + cen.y * 0.8) / H * 0.12 - hsh * 0.1) + tick(clamp(4.0 - dcell, 0.0, 4.0));
  float ang = mod(atan(q.y, q.x) + PI * 0.5, 2.0 * PI);
  float sec = floor(ang / (2.0 * PI / 3.0));   // 0 right, 1 top, 2 left
  float fi = sec + rot3;
  float f0 = floor(fi);
  float mixf = smoothstep(0.0, 1.0, fract(fi));
  vec3 fc = mix(face(f0), face(f0 + 1.0), mixf);
  // a gentle shade so the cube looks lit from the top
  float shade = sec == 1.0 ? 1.0 : (sec == 0.0 ? 0.82 : 0.66);

  vec2 k = abs(q);
  float hexd = 0.8660254 * H - max(k.x, dot(k, vec2(0.5, 0.8660254)));
  float spk = min(min(spoke(q, PI / 6.0), spoke(q, 5.0 * PI / 6.0)), spoke(q, 1.5 * PI));
  float outline = ln(hexd, 0.0013);
  float spokes = ln(spk, 0.0011);
  float edgeGlow = exp(-hexd / 0.010) * 0.5 + exp(-spk / 0.008) * 0.35;

  vec3 col = wall(uv) * 0.55 + vec3(0.012, 0.0, 0.03);
  col = mix(col, fc * shade, 0.17 + 0.30 * lit);
  col += fc * edgeGlow * 0.16;
  col += vec3(0.25, 0.95, 1.0) * outline * (0.55 + 0.45 * lit);
  col += vec3(1.0, 0.35, 0.8) * spokes * (0.5 + 0.5 * lit);
  col += vec3(0.6, 0.2, 0.9) * 0.10 * lit;

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
