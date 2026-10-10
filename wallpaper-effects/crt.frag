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


void main() {
  vec2 uv = qt_TexCoord0;
  vec2 c = uv * 2.0 - 1.0;
  c *= 1.0 + dot(c, c) * 0.04;
  vec2 u2 = c * 0.5 + 0.5;
  vec3 col;
  col.r = wall(u2 + vec2(0.0015, 0.0)).r;
  col.g = wall(u2).g;
  col.b = wall(u2 - vec2(0.0015, 0.0)).b;
  float scan = 0.86 + 0.14 * sin(u2.y * res.y * 3.14159);
  float bar = exp(-pow(fract(u2.y - time * 0.07) * 8.0, 2.0)) * 0.06;
  float flick = 0.975 + 0.025 * sin(time * 55.0);
  float vig = 1.0 - 0.45 * dot(c, c) * 0.5;
  col = (col * scan + cBlue.rgb * bar) * flick * vig;
  if (u2.x < 0.0 || u2.x > 1.0 || u2.y < 0.0 || u2.y > 1.0) col = vec3(0.0);
  fragColor = vec4(col, 1.0) * qt_Opacity;
}
