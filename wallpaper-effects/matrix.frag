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
  vec2 cells = vec2(res.x / 14.0, res.y / 18.0);
  vec2 cp = uv * cells;
  vec2 id = floor(cp);
  vec2 f = fract(cp);
  float colh = hash(vec2(id.x, 1.0));
  float sp = 0.25 + colh * 0.5;
  float head = fract(time * sp * 0.4 + colh * 7.0) * (cells.y + 24.0) - 12.0;
  float dist = head - id.y;
  float trail = (dist > 0.0 && dist < 22.0) ? pow(1.0 - dist / 22.0, 1.6) : 0.0;
  vec2 gp = floor(f * vec2(3.0, 5.0));
  float tick = floor(time * (3.0 + colh * 4.0));
  float bit = step(0.5, hash(id + gp * 0.37 + tick * 0.13 * step(0.5, hash(id))));
  vec2 inner = abs(f - 0.5);
  float inside = step(inner.x, 0.36) * step(inner.y, 0.4);
  float on = bit * inside * trail;
  float headc = (dist > 0.0 && dist < 1.2) ? 1.0 : 0.0;
  vec3 col = cBg.rgb;
  col += mix(cBlue.rgb, cMagenta.rgb, hash(vec2(id.x, 9.0)) * 0.5) * on * 0.9;
  col += cCream.rgb * headc * bit * inside * 0.9;
  float mdist = length((uv - m) * vec2(asp, 1.0));
  col *= 1.0 + 0.9 * exp(-mdist * 6.0);
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
