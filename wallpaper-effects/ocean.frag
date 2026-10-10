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
  vec2 d = (uv - m) * vec2(asp, 1.0);
  float r = length(d);
  vec2 dir = d / max(r, 0.0001);
  float hz = 0.55;
  float mx = 0.72 + (m.x - 0.5) * 0.12;
  vec3 col;
  if (uv.y < hz) {
    float s = uv.y / hz;
    col = mix(cBlue.rgb * 0.28, cBg.rgb, 1.0 - s * 0.5);
    col = mix(col, cMagenta.rgb * 0.35, smoothstep(0.55, 1.0, s));
    vec2 sp = vec2(uv.x * asp, uv.y) * 120.0;
    vec2 sg = floor(sp);
    col += cCream.rgb * step(0.994, hash(sg)) * smoothstep(0.3, 0.0, length(fract(sp) - 0.5)) * (1.0 - s) * 0.7;
    float mr = length((uv - vec2(mx, 0.26)) * vec2(asp, 1.0));
    col += cCream.rgb * (smoothstep(0.05, 0.04, mr) * 0.9 + 0.2 * exp(-mr * 7.0));
  } else {
    float dp = (uv.y - hz) / (1.0 - hz);
    float n = noise(vec2(uv.x * asp * (6.0 + 40.0 * dp), (uv.y - hz) * (70.0 * dp + 18.0) + time * 0.8));
    float n2 = noise(vec2(uv.x * asp * (3.0 + 20.0 * dp) - time * 0.2, dp * 30.0 + time * 0.4));
    col = mix(cMagenta.rgb * 0.2, cBlue.rgb * 0.22, dp) * (0.6 + 0.6 * n2);
    col = mix(col, cBg.rgb, 0.35 * (1.0 - dp));
    float w = (uv.x - mx) * asp / (0.015 + 0.14 * dp);
    float refl = exp(-w * w) * smoothstep(0.45, 0.8, n) * (1.0 - dp * 0.5);
    col += cCream.rgb * refl * 0.9;
    col += cPink.rgb * 0.07 * n * (1.0 - dp);
  }
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
