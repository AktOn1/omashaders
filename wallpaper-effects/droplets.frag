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


const int NB = 9;
vec2 dropPos(int i, float asp, float t) {
  float fi = float(i);
  float sp = 0.020 + 0.016 * fract(fi * 0.618);
  float y = mod(t * sp + fi * 0.37, 1.5) - 0.25;
  float x = asp * (0.08 + 0.84 * fract(fi * 0.382 + 0.1)) + 0.05 * sin(t * 0.3 + fi * 2.0) + 0.02 * sin(t * 0.9 + fi);
  return vec2(x, y);
}
float dropRad(int i) { return 0.052 + 0.045 * fract(float(i) * 0.7548); }
float field(vec2 p, float asp, float t, vec2 mp, out vec2 g) {
  float f = 0.0;
  g = vec2(0.0);
  for (int i = 0; i < NB; i++) {
    vec2 d = p - dropPos(i, asp, t);
    float r = dropRad(i);
    float q = dot(d, d) + 0.0005;
    float k = r * r / q;
    f += k;
    g += -2.0 * k * d / q;
  }
  vec2 d = p - mp;
  float q = dot(d, d) + 0.0005;
  float k = 0.006 / q;
  f += k;
  g += -2.0 * k * d / q;
  return f;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 g;
  float f = field(p, asp, time, vec2(m.x * asp, m.y), g);
  float gl = max(length(g), 1e-3);
  float body = clamp(((f - 1.0) / gl) / 0.0012 + 0.5, 0.0, 1.0);
  vec3 col = wall(uv);
  col *= 1.0 - 0.35 * smoothstep(0.35, 1.0, f) * (1.0 - body);
  float tilt = pow(clamp(1.0 - (f - 1.0) / 2.2, 0.0, 1.0), 1.3);
  vec2 nxy = -g / gl * tilt;
  vec2 k = vec2(1.0 / asp, 1.0);
  vec3 inner;
  inner.r = wall(uv - nxy * 0.060 * k).r;
  inner.g = wall(uv - nxy * 0.052 * k).g;
  inner.b = wall(uv - nxy * 0.044 * k).b;
  inner = mix(inner, cBlue.rgb * 0.5, 0.06);
  float light = dot(nxy, normalize(vec2(-0.6, -0.8)));
  inner *= 1.0 + 0.30 * light * tilt - 0.28 * tilt * tilt;
  float spec = pow(max(light, 0.0), 6.0) * tilt * 0.9;
  float rimGlow = pow(tilt, 5.0) * 0.12;
  inner += (spec + rimGlow) * vec3(1.0);
  col = mix(col, inner, body);
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
