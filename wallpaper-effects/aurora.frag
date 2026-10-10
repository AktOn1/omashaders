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
  vec3 col = cBg.rgb;
  col += cBlue.rgb * 0.05 * (1.0 - uv.y);
  float t = time * 0.12;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = uv.x * asp * (1.6 + fi * 0.5) + t * (1.0 + fi * 0.4) + (m.x - 0.5) * 0.6 * (fi + 1.0);
    float curtain = fbm(vec2(x, fi * 3.7 + t));
    float edge = 0.18 + 0.30 * curtain + fi * 0.06 + (0.5 - m.y) * 0.08;
    float band = smoothstep(edge + 0.30, edge, uv.y) * smoothstep(edge - 0.35, edge, uv.y);
    float rays = 0.55 + 0.45 * noise(vec2(uv.x * 60.0 * asp, fi * 4.0 + t * 2.0));
    vec3 tint = fi < 1.0 ? cBlue.rgb : (fi < 2.0 ? cMagenta.rgb : cPink.rgb);
    col += tint * band * rays * 0.32;
  }
  vec2 mp = vec2(0.72, 0.22);
  float r = length((uv - mp) * vec2(asp, 1.0));
  col += cCream.rgb * (smoothstep(0.045, 0.030, r) * 0.38 + 0.16 * exp(-r * 8.0));
  float md = length((uv - m) * vec2(asp, 1.0));
  col += cMagenta.rgb * 0.12 * exp(-md * 5.0);
  vec2 sp = uv * vec2(asp, 1.0) * 120.0;
  vec2 sg = floor(sp);
  float star = step(0.9965, hash(sg)) * smoothstep(0.22, 0.0, length(fract(sp) - 0.5)) * (0.5 + 0.5 * sin(time * 1.5 + hash(sg + 1.0) * 30.0));
  col += cCream.rgb * star * (1.0 - smoothstep(0.0, 0.5, uv.y)) * 0.8;
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
