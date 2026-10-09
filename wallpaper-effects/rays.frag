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
  vec3 col = wall(uv) * 0.85;
  vec2 lo = vec2(0.88, -0.12) + (m - 0.5) * vec2(-0.1, -0.06);
  vec2 q = (uv - lo) * vec2(asp, 1.0);
  float a = atan(q.y, q.x);
  float l = length(q);
  float rays = noise(vec2(a * 16.0 + time * 0.12, 1.0)) * 0.6 + noise(vec2(a * 34.0 - time * 0.2, 7.0)) * 0.4;
  rays = smoothstep(0.35, 0.95, rays);
  float fall = exp(-l * 1.2);
  col += mix(cCream.rgb, cPink.rgb, 0.25) * rays * fall * 0.38;
  col += cCream.rgb * 0.12 * exp(-l * 3.0);
  vec2 dp = vec2(uv.x * asp, uv.y) * 40.0;
  dp += vec2(time * 0.4, time * 0.25);
  vec2 di = floor(dp);
  float dust = step(0.93, hash(di)) * smoothstep(0.3, 0.0, length(fract(dp) - 0.5)) * (0.5 + 0.5 * sin(time + hash(di) * 20.0));
  col += cCream.rgb * dust * rays * fall * 1.2;
  fragColor = vec4(col, 1.0) * qt_Opacity;
}
