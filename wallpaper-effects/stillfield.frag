// label: Still field
// hint: deep focus: a calm graphite field with one thin horizon line, a soft light that leans toward the pointer and one slow band of light
// category: Cozy corners
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
float sf_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sf_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sf_h(i), sf_h(i + vec2(1, 0)), f.x), mix(sf_h(i + vec2(0, 1)), sf_h(i + vec2(1, 1)), f.x), f.y);
}
float sf_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sf_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sf_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 sf_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }

// deep focus: almost nothing. A calm graphite field, one thin horizon line with the faintest glow, a very large soft light
// that follows the pointer a little and a slow band of light that crosses once a minute
vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = sf_ptr(mpx, vec2(0.5, 0.45));
  vec3 base = wall(uv);
  vec3 top = vec3(0.060, 0.070, 0.085);
  vec3 bot = vec3(0.105, 0.115, 0.130);
  vec3 col = mix(top, bot, smoothstep(0.0, 1.0, uv.y));
  col = mix(col, vec3(sf_lum(base)) * vec3(0.14, 0.15, 0.17), 0.18);     // the wallpaper only whispers
  // the horizon: one thin line a bit below the middle, with a glow that is stronger toward the pointer
  float hy = 0.64;
  float hx = exp(-pow((uv.x - mix(0.5, m.x, 0.35)) / 0.55, 2.0));
  float line = smoothstep(0.0016, 0.0, abs(uv.y - hy));
  col += vec3(0.46, 0.60, 0.62) * line * (0.10 + 0.20 * hx);
  col += vec3(0.20, 0.28, 0.30) * exp(-pow((uv.y - hy) / 0.10, 2.0)) * (0.06 + 0.06 * hx);
  // below the line: slightly darker, like still water
  col *= 1.0 - 0.18 * smoothstep(hy, hy + 0.02, uv.y);
  // a soft light that leans toward the pointer
  vec2 lc = mix(vec2(0.5, 0.45), m, 0.30) * vec2(asp, 1.0);
  float lg = exp(-dot((p - lc) * vec2(1.0, 1.2), (p - lc) * vec2(1.0, 1.2)) / (2.0 * 0.33 * 0.33));
  col += vec3(0.12, 0.14, 0.17) * lg * (0.55 + 0.45 * react);
  // a very slow band of light that crosses diagonally once every ~two minutes
  float ph = fract(t * 0.008);
  float bandPos = mix(-0.3, 1.5, ph);
  float diag = (p.x / asp * 0.8 + uv.y * 0.35);
  col += vec3(0.07, 0.08, 0.09) * exp(-pow((diag - bandPos) / 0.12, 2.0)) * 0.55;
  // fine dithering so the gradient has no banding
  col += (sf_h(uv * res) - 0.5) / 255.0 * 1.5;
  col *= 1.0 - 0.25 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
