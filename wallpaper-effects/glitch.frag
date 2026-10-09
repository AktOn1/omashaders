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
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp(uv, 0.0, 1.0))).rgb; }
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
  float asp = res.x / res.y;
  vec2 m = mouse / res;
  float t = floor(time * 8.0);
  float near = smoothstep(0.2, 0.0, length((uv - m) * vec2(asp, 1.0)));
  float burst = max(step(0.93, hash(vec2(t, 1.0))), near * step(0.5, hash(vec2(t, 3.0))));
  float band = floor(uv.y * 24.0);
  float act = burst * step(0.55, hash(vec2(band, t)));
  float shift = (hash(vec2(band, t + 7.0)) - 0.5) * 0.12 * act;
  vec3 col;
  col.r = wall(uv + vec2(shift + 0.004 * act, 0.0)).r;
  col.g = wall(uv + vec2(shift, 0.0)).g;
  col.b = wall(uv + vec2(shift - 0.004 * act, 0.0)).b;
  col += cMagenta.rgb * 0.08 * act;
  fragColor = vec4(col, 1.0) * qt_Opacity;
}
