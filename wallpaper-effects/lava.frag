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
  vec2 p = vec2(uv.x * asp, uv.y);
  float fld = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2(asp * (0.5 + 0.38 * sin(time * (0.13 + fi * 0.045) + fi * 2.1)),
                  0.5 + 0.38 * sin(time * (0.17 + fi * 0.03) + fi * 3.7));
    float rad = 0.09 + 0.03 * sin(fi * 5.0);
    float dd = length(p - c);
    fld += rad * rad / (dd * dd + 0.0005);
  }
  vec2 mp = vec2(m.x * asp, m.y);
  fld += 0.012 / (dot(p - mp, p - mp) + 0.0005);
  vec3 bg = mix(cBg.rgb, cBlue.rgb * 0.25, uv.y);
  float body = smoothstep(0.9, 1.2, fld);
  vec3 blob = mix(cMagenta.rgb, cPink.rgb, smoothstep(1.0, 2.6, fld));
  blob = mix(blob, cCream.rgb, smoothstep(2.6, 5.0, fld) * 0.6);
  vec3 col = mix(bg, blob, body);
  col += cMagenta.rgb * 0.18 * smoothstep(0.35, 0.9, fld) * (1.0 - body);
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
