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


vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 off = vec2(0.0);
  float sh = 0.0;
  for (int l = 0; l < 3; l++) {
    float sc = 6.0 + float(l) * 4.0;
    vec2 g = vec2(uv.x * asp, uv.y) * sc;
    float speed = 0.25 + hash(vec2(floor(g.x), float(l))) * 0.4;
    g.y -= time * speed * (1.0 + float(l) * 0.3);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + float(l) * 7.0);
    if (h > 0.6) {
      vec2 c = vec2(hash(id + 2.0) - 0.5, hash(id + 5.0) - 0.5) * 0.5;
      vec2 dd = f - c;
      float d = length(vec2(dd.x, dd.y * 0.6));
      float drop = smoothstep(0.16, 0.0, d);
      off += dd * drop * 0.03;
      sh += drop * smoothstep(0.0, 0.2, -dd.y + 0.1) * 0.08;
    }
  }
  float wipe = smoothstep(0.25, 0.05, length((uv - m) * vec2(asp, 1.0)));
  off *= 1.0 - wipe;
  sh *= 1.0 - wipe;
  vec3 col = wall(uv + off) * 0.9 + cCream.rgb * sh;
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
