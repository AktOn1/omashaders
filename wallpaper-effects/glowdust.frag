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
  vec3 col = wall(uv) * 0.82;
  vec3 glow = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float sc = 7.0 + float(layer) * 5.0;
    vec2 g = vec2(uv.x * asp, uv.y) * sc;
    g.y += time * (0.06 + 0.04 * float(layer)) * sc * 0.4;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + float(layer) * 13.0);
    if (h > 0.55) {
      vec2 jit = vec2(hash(id + 1.7), hash(id + 9.1)) - 0.5;
      vec2 c = jit * 0.6 + 0.12 * vec2(sin(time * 0.7 + h * 40.0), cos(time * 0.9 + h * 25.0));
      vec2 wp = (id + 0.5 + c) / sc;
      wp.x /= asp;
      vec2 toM = (wp - m) * vec2(asp, 1.0);
      float dm = length(toM);
      c += normalize(toM + 1e-4) * smoothstep(0.22, 0.0, dm) * 0.9;
      float d = length(f - c);
      float tw = 0.5 + 0.5 * sin(time * (1.0 + h * 2.0) + h * 50.0);
      float s = 0.035 / (d * d * sc * 3.0 + 0.012) * tw * 0.12;
      vec3 tint = mix(cCream.rgb, cPink.rgb, hash(id + 3.3));
      glow += tint * s;
    }
  }
  col += glow;
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
