// label: Heat shimmer
// hint: heat haze wavering over the horizon with a warm glow and rising light ripples
// category: Sun and sky
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



vec3 hs_bright() {
  vec3 b = vec3(0.0); float bl = -1.0;
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      vec3 s = wall(vec2(0.2 + 0.3 * float(i), 0.15 + 0.3 * float(j)));
      float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
      if (l > bl) { bl = l; b = s; }
    }
  }
  return b;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);

  // the haze band lies low in the picture; hot air shows as a lazy wobble that rises
  float hy = 0.68;
  float dy = (uv.y - hy);
  float band = exp(-(dy * dy) / (2.0 * 0.075 * 0.075));          // distortion band
  float wide = exp(-(dy * dy) / (2.0 * 0.17 * 0.17));            // glow band
  // wavering: noise stretched along x, scrolling upward, 1-3 px at the strongest
  vec2 q = vec2(p.x * 7.0, uv.y * 38.0 + time * 0.9);
  float nx = noise(q) - 0.5;
  float ny = noise(q * vec2(1.3, 1.0) + 31.7 + vec2(time * 0.15, 0.0)) - 0.5;
  float wob = 0.5 + 0.5 * sin(time * 0.6 + p.x * 3.0);
  vec2 off = vec2(nx * 2.0 * (0.7 + 0.5 * wob), ny * 1.0) * band * 3.0 / res;
  vec3 col = wall(uv + off);

  vec3 b = hs_bright();
  vec3 tn = mix(vec3(1.0), b / max(max(b.r, max(b.g, b.b)), 0.05), 0.4);
  vec3 warm = mix(vec3(1.0, 0.72, 0.42), tn, 0.25);

  // soft warm glow band, brightest just above the horizon line
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float glow = wide * (0.8 + 0.2 * noise(vec2(p.x * 2.0 + time * 0.04, time * 0.08)));
  glow *= 0.75 + 0.25 * smoothstep(0.0, -0.2, dy);
  vec3 add = warm * glow * 0.42;

  // rising faint light ripples: soft wisps of light that climb up out of the band
  float up = -dy;
  float gate = smoothstep(-0.10, 0.04, up) * smoothstep(0.42, 0.06, up);
  vec2 rq = vec2(p.x * 2.3 + 0.7 * (noise(vec2(p.x * 1.5, uv.y * 4.0 - time * 0.10)) - 0.5), uv.y * 26.0 + time * 0.9);
  float rn = noise(rq) * 0.65 + noise(rq * 2.1 + 9.0) * 0.35;
  float wisp = smoothstep(0.45, 0.80, rn);
  add += mix(vec3(1.0), warm, 0.6) * wisp * gate * 0.34;

  col = col + add * (1.0 - col * 0.7);
  col += warm * 0.04 * band;                                      // a little warm lift in the hot air
  return vec4(col, 1.0) * qt_Opacity;
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
