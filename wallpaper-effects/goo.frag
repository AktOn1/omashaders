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
  return vec2(asp * (0.5 + 0.40 * sin(t * (0.10 + fi * 0.029) + fi * 1.9)),
              0.5 + 0.38 * sin(t * (0.14 + fi * 0.021) + fi * 3.3 + 2.0));
}
float blobRad(int i) { return 0.095 + 0.03 * sin(float(i) * 4.7); }

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec3 f = vec3(0.0);
  for (int i = 0; i < NB; i++) {
    vec2 d = p - blobPos(i, asp, time);
    float r = blobRad(i);
    float k = r * r / (dot(d, d) + 0.0006);
    int s = i - (i / 3) * 3;
    if (s == 0) f.x += k;
    else if (s == 1) f.y += k;
    else f.z += k;
  }
  vec2 dm = p - vec2(m.x * asp, m.y);
  f.x += 0.010 / (dot(dm, dm) + 0.0006);
  vec3 body = smoothstep(vec3(0.92), vec3(1.08), f);
  vec3 core = smoothstep(vec3(1.6), vec3(3.2), f);
  vec3 col = wall(uv) * 0.55;
  vec3 ca = cMagenta.rgb, cb = cBlue.rgb, cc = cPink.rgb;
  col += (ca * (0.45 + 0.45 * core.x) * body.x
        + cb * (0.45 + 0.45 * core.y) * body.y
        + cc * (0.45 + 0.45 * core.z) * body.z);
  col += cCream.rgb * 0.10 * (core.x + core.y + core.z);
  col += (ca * smoothstep(0.35, 0.9, f.x) * (1.0 - body.x)
        + cb * smoothstep(0.35, 0.9, f.y) * (1.0 - body.y)
        + cc * smoothstep(0.35, 0.9, f.z) * (1.0 - body.z)) * 0.12;
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
