// label: Boreal
// hint: northern lights over a cold night, the curtains lean toward the pointer
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
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

// Polar night palette (fixed, so the scene looks the same under every theme)
const vec3 SKY = vec3(0.012, 0.028, 0.085);
const vec3 AUR_GREEN = vec3(0.22, 1.00, 0.58);
const vec3 AUR_TEAL = vec3(0.12, 0.85, 0.90);
const vec3 AUR_VIOLET = vec3(0.58, 0.32, 1.00);
const vec3 ICE = vec3(0.80, 0.93, 1.00);

// one aurora curtain: sharp bright lower edge, rays rising and fading upward, green at the foot, violet at the top
vec3 curtain(vec2 uv, float asp, float fi, float t, vec2 m, out vec3 glow) {
  float x = uv.x * asp;
  float pull = exp(-pow((uv.x - m.x) * asp * 1.4, 2.0));          // 1 right above/below the pointer
  float xx = x * (1.0 + 0.30 * fi) + t * (0.50 + 0.25 * fi) + fi * 3.7 + (m.x - uv.x) * pull * 0.9;   // curtains shear toward the pointer
  float wave = fbm3(vec2(xx * 1.15, fi * 5.1 + t * 0.45));
  float kink = noise(vec2(xx * 3.1 + 7.0, fi * 2.0 + t * 0.9));
  float base = (fi < 0.5 ? 0.36 : (fi < 1.5 ? 0.50 : 0.24)) + 0.36 * (wave - 0.5) + 0.07 * (kink - 0.5);
  base = mix(base, m.y * 0.9 + 0.1, pull * 0.25);                 // and sag toward its height
  float span = smoothstep(0.30, 0.62, noise(vec2(xx * 0.42 + 2.0, fi * 4.0 + t * 0.2)));   // each ribbon only exists in stretches
  float h = base - uv.y;                                          // above the lower edge (up is positive)
  float ht = 0.15 + 0.12 * noise(vec2(xx * 1.7, fi * 3.3 + t * 0.3));
  float body = smoothstep(-0.010, 0.010, h) * exp(-max(h, 0.0) / ht * 2.8) * span;
  float ray = noise(vec2(xx * 38.0, fi * 7.0 + t * 0.9));
  ray = mix(ray, noise(vec2(xx * 83.0 + 5.0, fi * 2.0 - t * 0.7)), 0.4);
  float rays = 0.25 + 1.5 * smoothstep(0.25, 0.85, ray);
  float gain = (1.0 + 1.0 * pull) * (0.70 + 0.6 * noise(vec2(xx * 0.5, fi * 9.0 + t * 0.2)));
  float k = clamp(h / ht, 0.0, 1.0);
  vec3 tint = mix(mix(AUR_GREEN, AUR_TEAL, smoothstep(0.0, 0.40, k)), AUR_VIOLET, smoothstep(0.40, 1.0, k));
  glow = mix(AUR_GREEN, AUR_TEAL, 0.4 + 0.2 * fi) * gain * span * (0.55 + 0.45 * wave);
  return tint * body * rays * gain * (fi < 0.5 ? 0.62 : (fi < 1.5 ? 0.42 : 0.50));
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 mp = vec2(m.x * asp, m.y);
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time * 0.07;

  // the picture, as seen on a cold, moonless night
  vec3 w = wall(uv);
  float l = dot(w, vec3(0.2126, 0.7152, 0.0722));
  vec3 night = mix(w, vec3(l) * vec3(0.55, 0.78, 1.10), 0.55) * vec3(0.46, 0.60, 0.88);
  vec3 col = mix(night, SKY + night * 0.35, smoothstep(0.55, 0.0, uv.y) * 0.75);   // deep sky toward the top

  // stars, fading toward the horizon
  vec2 sp = p * 140.0;
  vec2 sg = floor(sp);
  float hs = hash(sg);
  float star = step(0.992, hs) * smoothstep(0.30, 0.0, length(fract(sp) - 0.5)) * (0.55 + 0.45 * sin(time * (0.8 + hs * 3.0) + hs * 60.0));
  col += ICE * star * smoothstep(0.75, 0.05, uv.y) * 0.9;

  // aurora curtains and the light they throw on the ground
  vec3 aur = vec3(0.0), lit = vec3(0.0), g;
  for (int i = 0; i < 3; i++) {
    aur += curtain(uv, asp, float(i), t, m, g);
    lit += g * (i == 0 ? 0.50 : (i == 1 ? 0.35 : 0.25));
  }
  aur = 1.0 - exp(-aur * 1.25);                                   // soft tone map, no clipping
  col += night * lit * 0.55 * smoothstep(0.1, 0.8, uv.y);       // curtains tint the scenery below
  col = col * (1.0 - 0.55 * max(aur.g, max(aur.r, aur.b))) + aur * 1.05;
  // low ice mist along the bottom
  col += vec3(0.30, 0.55, 0.65) * smoothstep(0.72, 1.0, uv.y) * 0.07 * (0.6 + 0.4 * noise(vec2(p.x * 3.0 + t * 2.0, 1.0)));

  // the pointer: a cold glint and a few drifting ice motes
  float md = length((p - mp) * vec2(1.0, 1.0));
  col += ICE * (smoothstep(0.012, 0.0, md) * 0.5 + 0.12 * exp(-md * 9.0)) * step(0.0, m.x);
  col += AUR_TEAL * 0.05 * exp(-md * 4.0) * step(0.0, m.x);

  col *= 1.0 - 0.42 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
