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


const int NB = 8;
vec2 blobPos(int i, float asp, float t) {
  float fi = float(i);
  return vec2(asp * (0.5 + 0.40 * sin(t * (0.11 + fi * 0.037) + fi * 2.1)),
              0.5 + 0.40 * sin(t * (0.15 + fi * 0.027) + fi * 3.7 + 1.0));
}
float blobRad(int i) { return 0.085 + 0.035 * sin(float(i) * 5.3 + 1.0); }
float field(vec2 p, float asp, float t, vec2 mp, out vec2 g) {
  float f = 0.0;
  g = vec2(0.0);
  for (int i = 0; i < NB; i++) {
    vec2 d = p - blobPos(i, asp, t);
    float r = blobRad(i);
    float q = dot(d, d) + 0.0006;
    float k = r * r / q;
    f += k;
    g += -2.0 * k * d / q;
  }
  vec2 d = p - mp;
  float q = dot(d, d) + 0.0006;
  float k = 0.010 / q;
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
  float edge = (f - 1.0) / gl;
  float body = clamp(edge / 0.0012 + 0.5, 0.0, 1.0);
  vec3 base = wall(uv) * 0.78;
  float shadow = smoothstep(0.3, 1.0, f) * (1.0 - body);
  vec3 col = base * (1.0 - 0.45 * shadow);
  float tilt = pow(clamp(1.0 - (f - 1.0) / 2.6, 0.0, 1.0), 1.4);
  vec2 nxy = -g / gl * tilt;
  vec3 n = vec3(nxy, sqrt(max(0.04, 1.0 - tilt * tilt)));
  vec3 env = wall(uv + nxy * 0.22 * vec2(1.0 / asp, 1.0));
  float lum = dot(env, vec3(0.299, 0.587, 0.114));
  env = mix(vec3(lum), env, 0.3);
  env = (env - 0.45) * 1.5 + 0.5;
  env += 0.30 * (0.5 - nxy.y);
  float spec = pow(max(dot(n, normalize(vec3(-0.45, -0.6, 0.75))), 0.0), 36.0) * 1.1;
  float spec2 = pow(max(dot(n, normalize(vec3(0.6, 0.5, 0.6))), 0.0), 18.0) * 0.25;
  float rim = pow(tilt, 3.0);
  vec3 metal = env * (1.0 - 0.55 * rim) + (spec + spec2) * vec3(1.0, 0.98, 0.95) + cBlue.rgb * 0.06;
  col = mix(col, metal, body);
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
