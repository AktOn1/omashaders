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
  vec3 col = wall(uv) * 0.62;
  vec2 rp = vec2((uv.x + uv.y * 0.18) * asp * 90.0, uv.y * 3.0);
  float cid = floor(rp.x);
  float sp = 1.1 + hash(vec2(cid, 1.0));
  float y = fract(rp.y - time * sp + hash(vec2(cid, 2.0)));
  float streak = smoothstep(0.08, 0.0, y) * step(0.72, hash(vec2(cid, 3.0))) * smoothstep(0.5, 0.1, abs(fract(rp.x) - 0.5));
  col += cBlue.rgb * streak * 0.35;
  float t = time * 0.33;
  float cyc = floor(t);
  float ph = fract(t);
  float on = step(0.4, hash(vec2(cyc, 4.0)));
  float fl = on * exp(-ph * 14.0) * (0.55 + 0.45 * sin(ph * 70.0));
  float x0 = (0.15 + 0.7 * hash(vec2(cyc, 5.0))) * asp;
  float bx = x0 + (fbm(vec2(uv.y * 7.0, cyc)) - 0.5) * 0.3;
  float bd = abs(uv.x * asp - bx);
  float bolt = (exp(-bd * bd * 90000.0) + 0.35 * exp(-bd * bd * 1500.0)) * smoothstep(0.75, 0.2, uv.y);
  col += (cCream.rgb * 0.18 + cBlue.rgb * 0.12) * fl;
  col += mix(cCream.rgb, vec3(1.0), 0.5) * bolt * fl * 0.9;
  col += cMagenta.rgb * 0.06 * exp(-r * 6.0);
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
