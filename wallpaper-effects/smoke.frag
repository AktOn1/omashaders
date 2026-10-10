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
  vec4 tr0;
  vec4 tr1;
  vec4 tr2;
  vec4 tr3;
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



// distance to segment a-b and the position along it
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - (a + ab * h));
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 A = vec2(asp, 1.0);
  vec2 p = uv * A;

  // mouse path: tr0.xy is the live pointer, then older samples (newest first); pixels -> uv * aspect
  vec2 t[8];
  t[0] = tr0.xy; t[1] = tr0.zw; t[2] = tr1.xy; t[3] = tr1.zw;
  t[4] = tr2.xy; t[5] = tr2.zw; t[6] = tr3.xy; t[7] = tr3.zw;
  for (int i = 0; i < 8; i++) t[i] = t[i] / res * A;
  if (mpx.x < -5000.0) { for (int i = 1; i < 8; i++) t[i] = t[0]; }

  // every path segment drags the smoke along with it (stronger for newer segments)
  vec2 pull = vec2(0.0);
  float stir = 0.0;
  for (int i = 0; i < 7; i++) {
    vec2 v = t[i] - t[i + 1];
    float d = segDist(p, t[i + 1], t[i]);
    float w = exp(-d * d / 0.045) * (1.0 - float(i) / 8.0);
    pull += (v + vec2(-v.y, v.x) * 0.25) * w;
    stir += w * min(length(v) * 6.0, 1.0);
  }
  float pl = length(pull);
  pull *= min(pl, 0.4) / max(pl, 1e-4);

  // smoke density: rising, domain-warped noise, advected by the pull
  vec2 q = p - pull * 0.8;
  vec2 rise = vec2(0.0, time * 0.05);
  vec2 w1 = vec2(fbm(q * 1.4 + rise + 3.1), fbm(q * 1.4 + rise * 1.3 + 8.7));
  vec2 s = q * 1.9 + (w1 - 0.5) * 1.1 + rise * vec2(0.4, 1.0);
  float dens = fbm(s);
  float dens2 = fbm(s + vec2(0.03, 0.05));
  dens = smoothstep(0.36, 0.72, dens);
  dens *= 1.0 - (1.0 - uv.y) * 0.33;
  dens = clamp(dens + stir * 0.22 * (0.4 + dens), 0.0, 1.0);

  vec3 base = wall(uv - pull * 0.05 / A);
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  vec3 light = mix(cCream.rgb, vec3(0.9), 0.5);
  vec3 dark = mix(cBg.rgb, cBlue.rgb, 0.25) * 0.8;
  vec3 smokeCol = mix(light, dark, smoothstep(0.35, 0.65, lum));
  // soft self-shading so the wisps look volumetric
  smokeCol *= 1.0 + clamp((dens2 - dens) * 2.5, -0.25, 0.25);
  vec3 col = mix(base, smokeCol, dens * 0.8);
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
