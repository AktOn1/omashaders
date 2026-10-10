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
  float asp = res.x / res.y;
  vec3 col = wall(uv);
  for (int l = 0; l < 3; l++) {
    float sc = 5.0 + float(l) * 3.0;
    vec2 g = vec2(uv.x * asp, uv.y) * sc;
    g.x += sin(time * 0.8 + g.y * 0.7 + float(l)) * 0.35;
    g.y -= time * (0.30 + 0.12 * float(l));
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + float(l) * 11.0);
    if (h > 0.5) {
      vec2 c = vec2(hash(id + 2.0) - 0.5, hash(id + 6.0) - 0.5) * 0.4;
      vec2 p = f - c;
      float a = time * (0.5 + h) + h * 6.28318;
      p = vec2(cos(a) * p.x - sin(a) * p.y, sin(a) * p.x + cos(a) * p.y);
      float flip = 0.4 + 0.6 * abs(sin(time * 1.3 + h * 20.0));
      float d = length(vec2(p.x / 0.12, p.y / (0.06 * flip)));
      float al = smoothstep(1.0, 0.8, d);
      vec3 tint = mix(cPink.rgb, cCream.rgb, 0.35 * hash(id + 4.0));
      col = mix(col, tint, al * 0.85);
    }
  }
  fragColor = vec4(col, 1.0) * qt_Opacity;
}
