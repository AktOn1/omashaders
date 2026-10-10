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


vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 d = (uv - m) * vec2(asp, 1.0);
  float r = length(d);
  vec2 dir = d / max(r, 0.0001);
  float hz = 0.56;
  float vx = 0.5 + (m.x - 0.5) * 0.2;
  vec3 col;
  if (uv.y < hz) {
    float s = uv.y / hz;
    col = mix(cBg.rgb, cMagenta.rgb * 0.5, smoothstep(0.3, 1.0, s));
    vec2 sc = (uv - vec2(vx, 0.36)) * vec2(asp, 1.0);
    float sr = length(sc);
    float sun = smoothstep(0.205, 0.2, sr);
    float cut = step(0.0, sc.y) * step(0.5, fract(sc.y * 28.0 - time * 0.2)) * smoothstep(-0.02, 0.18, sc.y);
    sun *= 1.0 - cut;
    vec3 sc3 = mix(cCream.rgb, cPink.rgb, smoothstep(-0.2, 0.2, sc.y));
    col = mix(col, sc3, sun);
    col += cPink.rgb * 0.15 * exp(-sr * 4.0);
  } else {
    float dy = uv.y - hz;
    float z = 1.0 / (dy + 0.02);
    float gx = (uv.x - vx) * asp * z * 0.9;
    float gz = z * 0.6 + time * 1.2;
    float lx = smoothstep(0.0, 0.08, abs(fract(gx) - 0.5) - 0.40);
    float lz = smoothstep(0.0, 0.08, abs(fract(gz) - 0.5) - 0.40);
    float fade = smoothstep(0.0, 0.12, dy);
    col = mix(cBg.rgb, cBlue.rgb * 0.15, dy);
    col += mix(cBlue.rgb, cMagenta.rgb, 0.5) * max(lx, lz) * fade * 0.8;
    col += cPink.rgb * 0.2 * exp(-dy * 18.0);
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
