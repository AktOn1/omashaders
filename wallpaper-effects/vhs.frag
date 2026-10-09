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
  vec2 d = (uv - m) * vec2(asp, 1.0);
  float r = length(d);
  vec2 dir = d / max(r, 0.0001);
  float band = fract(time * 0.12);
  float inb = smoothstep(0.06, 0.0, abs(uv.y - band));
  float wob = sin(uv.y * 45.0 + time * 3.0) * 0.0012 + inb * 0.02 * sin(time * 20.0 + uv.y * 90.0);
  float cs = 0.003 + inb * 0.01;
  vec3 col;
  col.r = wall(uv + vec2(wob + cs, 0.0)).r;
  col.g = wall(uv + vec2(wob, 0.0)).g;
  col.b = wall(uv + vec2(wob - cs, 0.0)).b;
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(vec3(lum), col, 0.85) * vec3(0.95, 0.98, 1.06);
  col *= 0.94 + 0.06 * sin(uv.y * res.y * 1.2);
  float nz = hash(vec2(floor(uv.x * res.x / 2.0), floor(uv.y * res.y / 2.0) + floor(time * 24.0)));
  col += (nz - 0.5) * 0.07 + inb * nz * 0.25;
  col += cBlue.rgb * 0.04;
  fragColor = vec4(col, 1.0) * qt_Opacity;
}
