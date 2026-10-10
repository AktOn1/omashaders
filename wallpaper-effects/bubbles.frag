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
  vec2 off = vec2(0.0);
  float rim = 0.0;
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float sc = 5.0 + fl * 3.0;
    vec2 g = vec2(uv.x * asp, uv.y) * sc;
    g.y += time * (0.3 + 0.12 * fl);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + fl * 7.0);
    if (h > 0.55) {
      vec2 c = (vec2(hash(id + 2.0), hash(id + 5.0)) - 0.5) * 0.3;
      c.x += 0.08 * sin(time * 0.8 + h * 30.0);
      float rad = 0.12 + 0.13 * hash(id + 8.0);
      vec2 dd = f - c;
      float dl = length(dd);
      float inside = smoothstep(rad, rad - 0.02, dl);
      float ring = smoothstep(rad - 0.05, rad, dl) * inside;
      float hl = smoothstep(0.045, 0.0, length(dd - vec2(-rad * 0.4, -rad * 0.4)));
      off += dd * inside * 0.05 / sc;
      rim += ring * 0.55 + hl * 0.7 + inside * 0.04;
    }
  }
  vec3 col = wall(uv + off);
  col += mix(cCream.rgb, cBlue.rgb, 0.4) * rim * 0.4;
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
