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
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) * 2.2 + (m - 0.5) * 0.15;
  float t = time * 0.03;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  float f = fbm(p + 2.0 * q + t * 0.5);
  vec3 col = cBg.rgb;
  col = mix(col, cBlue.rgb * 0.7, smoothstep(0.3, 0.8, f));
  col = mix(col, cMagenta.rgb, smoothstep(0.45, 0.9, q.x) * 0.6);
  col += cPink.rgb * pow(f, 3.0) * 0.35 * q.y;
  col *= 0.85;
  vec2 sp = vec2(uv.x * asp, uv.y) * 140.0;
  vec2 sg = floor(sp);
  float star = step(0.992, hash(sg)) * smoothstep(0.3, 0.0, length(fract(sp) - 0.5)) * (0.5 + 0.5 * sin(time * 1.7 + hash(sg + 1.0) * 30.0));
  col += cCream.rgb * star * 0.8;
  col += cCream.rgb * 0.07 * exp(-r * 6.0);
  fragColor = vec4(col, 1.0) * qt_Opacity;
}
