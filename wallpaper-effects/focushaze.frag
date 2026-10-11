// label: Focus haze
// hint: a pale grey-blue fog bank with thin slow wisps of haze and a soft pool of light that drifts by itself and follows the pointer; the middle stays clear
// category: Quiet and focus
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

float fh_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fh_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fh_h(i), fh_h(i + vec2(1.0, 0.0)), f.x), mix(fh_h(i + vec2(0.0, 1.0)), fh_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fh_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * fh_n(p); p = p * 2.03 + 11.0; a *= 0.5; }
  return v;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  float t = time;
  vec3 w = wall(uv);

  // ---- the pool of light: wanders on its own, settles near the pointer when there is one
  vec2 drift = vec2(0.50 + 0.24 * sin(t * 0.090) + 0.07 * sin(t * 0.23 + 1.0), 0.44 + 0.10 * sin(t * 0.071 + 2.0));
  vec2 pc = hasM ? m + 0.035 * vec2(sin(t * 0.31), cos(t * 0.23)) : drift;
  vec2 dp = (p - vec2(pc.x * asp, pc.y)) * vec2(1.0, 1.25);
  float pool = exp(-dot(dp, dp) / 0.16);
  float poolWide = exp(-dot(dp, dp) / 0.60);

  // ---- the fog bank: very low detail, thicker low down and as a thin veil on top, the middle left clear
  vec2 q = vec2(p.x * 0.55 + t * 0.006, uv.y * 1.1);
  vec2 warp = vec2(fh_fbm(q + 3.0 + t * 0.004), fh_fbm(q + 9.0 - t * 0.003));
  float dens = fh_fbm(q * vec2(1.0, 1.5) + warp * 0.9);
  float bank = smoothstep(0.38, 1.0, uv.y + (dens - 0.5) * 0.30);
  float veil = smoothstep(0.62, 0.0, uv.y) * 0.45;
  vec2 cq = vec2((uv.x - 0.5) * asp * 0.55, (uv.y - 0.47) * 1.1);
  float cmask = mix(0.10, 1.0, smoothstep(0.12, 0.60, length(cq)));
  float alpha = clamp((bank * 1.0 + veil * 1.3) * (0.70 + 0.7 * dens), 0.0, 0.92) * cmask;
  alpha = max(alpha, 0.18 * cmask);                                  // a faint grey-blue breath everywhere

  vec3 fogLo = vec3(0.60, 0.69, 0.78);
  vec3 fogHi = vec3(0.80, 0.86, 0.92);
  vec3 fog = mix(fogLo, fogHi, clamp(0.35 + 0.65 * dens + 0.5 * poolWide, 0.0, 1.0));
  fog += vec3(1.00, 0.97, 0.90) * pool * 0.34;
  vec3 col = mix(w * vec3(0.92, 0.97, 1.02), fog, alpha);

  // ---- thin slow wisps of haze: long pale lines drifting sideways at different speeds
  float wisp = 0.0;
  for (int k = 0; k < 3; k++) {
    float kf = float(k);
    float yy = (uv.y + 0.006 * sin(p.x * 2.4 + kf * 2.0 + t * 0.07)) * (30.0 + 13.0 * kf) + kf * 7.3;
    float id = floor(yy);
    float rh = fh_h(vec2(id, kf + 5.0));
    float dir = rh > 0.5 ? 1.0 : -1.0;
    float line = smoothstep(0.07, 0.0, abs(fract(yy) - 0.5));
    float along = fh_n(vec2(p.x * (0.9 + 0.5 * rh) + dir * t * (0.010 + 0.012 * rh) + rh * 40.0, id * 1.7));
    along = smoothstep(0.52, 0.86, along);
    float zone = smoothstep(0.05, 0.55, uv.y) * (0.35 + 0.65 * smoothstep(0.1, 0.5, length(cq)));
    wisp += line * along * zone * step(0.45, fh_h(vec2(id, kf + 17.0))) * (0.55 + 0.45 * rh);
  }
  col += vec3(0.78, 0.86, 0.94) * wisp * 0.13;
  col += vec3(0.05, 0.055, 0.06) * poolWide + vec3(0.95, 0.93, 0.86) * pool * 0.22 * (1.0 - 0.5 * dot(col, vec3(0.333)));

  // a whisper of dither against banding in the smooth fog
  col += (fh_h(uv * res) - 0.5) / 160.0;
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
