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
vec2 blobPos(int i, float asp, float t) {
  float fi = float(i);
  return vec2(asp * (0.5 + 0.42 * sin(t * (0.09 + fi * 0.031) + fi * 2.7)),
              0.5 + 0.42 * sin(t * (0.12 + fi * 0.023) + fi * 4.1 + 0.5));
}
float blobRad(int i) { return 0.065 + 0.045 * sin(float(i) * 3.9 + 0.7); }
float field(vec2 p, float asp, float t, vec2 mp, out vec2 g, out float nuc) {
  float f = 0.0;
  nuc = 0.0;
  g = vec2(0.0);
  for (int i = 0; i < NB; i++) {
    vec2 d = p - blobPos(i, asp, t);
    float r = blobRad(i);
    float q = dot(d, d) + 0.0006;
    float k = r * r / q;
    f += k;
    g += -2.0 * k * d / q;
    nuc += exp(-dot(d, d) / (r * r * 0.10));
  }
  vec2 d = p - mp;
  float q = dot(d, d) + 0.0006;
  float k = 0.008 / q;
  f += k;
  g += -2.0 * k * d / q;
  nuc += exp(-dot(d, d) / 0.0006);
  return f;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 g;
  float nuc;
  float f = field(p, asp, time, vec2(m.x * asp, m.y), g, nuc);
  float gl = max(length(g), 1e-3);
  float d1 = abs(f - 1.0) / gl;
  float d2 = abs(f - 0.5) / gl;
  float d3 = abs(f - 2.2) / gl;
  float inside = clamp(((f - 1.0) / gl) / 0.0012 + 0.5, 0.0, 1.0);
  vec3 col = wall(uv) * mix(0.62, 0.42, inside);
  col += cMagenta.rgb * 0.10 * inside * (0.5 + 0.5 * smoothstep(1.0, 3.0, f));
  float wob = 0.75 + 0.25 * sin(time * 0.8 + f * 3.0);
  col += cBlue.rgb * 0.40 * exp(-pow(d1 / 0.0016, 2.0));
  col += cBlue.rgb * 0.10 * exp(-pow(d1 / 0.010, 2.0)) * wob;
  col += cCream.rgb * 0.16 * exp(-pow(d2 / 0.0011, 2.0));
  col += cPink.rgb * 0.16 * exp(-pow(d3 / 0.0011, 2.0)) * inside;
  col += cCream.rgb * 0.22 * clamp(nuc, 0.0, 1.0) * inside;
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
