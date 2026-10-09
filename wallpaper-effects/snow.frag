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
  vec3 col = wall(uv) * 0.85;
  float glow = 0.0;
  for (int l = 0; l < 4; l++) {
    float sc = 8.0 + float(l) * 6.0;
    vec2 g = vec2(uv.x * asp, uv.y) * sc;
    g.x += sin(time * 0.5 + g.y * 0.6 + float(l)) * 0.4;
    g.y -= time * (0.5 + 0.25 * float(l));
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + float(l) * 17.0);
    if (h > 0.5) {
      vec2 c = vec2(hash(id + 3.0) - 0.5, hash(id + 8.0) - 0.5) * 0.5;
      vec2 wp = (id + 0.5 + c) / sc;
      wp.x /= asp;
      vec2 toM = (wp - m) * vec2(asp, 1.0);
      c += normalize(toM + 1e-4) * smoothstep(0.15, 0.0, length(toM)) * 0.5;
      float d = length(f - c);
      float size = 0.07 + 0.05 * hash(id + 1.0);
      glow += smoothstep(size, size * 0.3, d) * (0.5 + 0.1 * float(l));
    }
  }
  col += mix(cCream.rgb, vec3(1.0), 0.5) * glow * 0.85;
  fragColor = vec4(col, 1.0) * qt_Opacity;
}
