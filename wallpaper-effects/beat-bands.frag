// label: Beat bands
// hint: bold diagonal bands in orange, magenta and teal that move in steps on a steady beat, the pointer sends a shockwave through them
// category: Mood scenes
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
float wl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float wl_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wl_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wl_hash(i), wl_hash(i + vec2(1, 0)), f.x), mix(wl_hash(i + vec2(0, 1)), wl_hash(i + vec2(1, 1)), f.x), f.y);
}
float wl_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * wl_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

vec3 wl_hot(float h) {
  h = fract(h) * 4.0;
  if (h < 1.0) return vec3(1.00, 0.35, 0.12);   // hot orange
  if (h < 2.0) return vec3(1.00, 0.16, 0.45);   // magenta
  if (h < 3.0) return vec3(0.08, 0.84, 0.76);   // teal
  return vec3(1.00, 0.80, 0.20);                // yellow
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;

  // the beat: about 112 bpm. the pattern moves in steps, each step eased out hard, like a drum hit
  float bt = t * 1.9;
  float bi = floor(bt);
  float ph = fract(bt);
  float ease = 1.0 - pow(1.0 - ph, 4.0);
  float hit = pow(1.0 - ph, 3.0);                  // 1 on the beat, decays quickly
  float step_ = bi + ease;

  // base: the picture dark and warm, a deep violet-navy
  vec3 w = wall(uv);
  vec3 col = mix(vec3(0.050, 0.030, 0.100), w * vec3(0.55, 0.42, 0.62), 0.55);

  // the pointer: a shockwave ring pushes the bands (a bump in the stripe coordinate) and flashes
  vec2 dm = p - mp;
  float rm = length(dm);
  float ring = exp(-pow((rm - 0.10 - 0.25 * ease) / 0.07, 2.0)) * (m.x > -1.0 ? 1.0 : 0.0);
  float bump = exp(-rm * rm / (2.0 * 0.16 * 0.16)) * (m.x > -1.0 ? 1.0 : 0.0);

  // diagonal bands
  float ang = 0.62;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 per = vec2(-dir.y, dir.x);
  float u = dot(p, dir) * 5.2 + bump * 0.7 * hit - step_ * 0.5;
  float v = dot(p, per) * 2.1;
  float k = floor(u);
  float f = fract(u);
  float hk = wl_hash(vec2(k, 3.0));
  // some bands are gaps, some are wide, some thin
  float width = 0.30 + 0.55 * wl_hash(vec2(k, 8.0));
  width *= 0.80 + 0.35 * hit * step(0.5, wl_hash(vec2(k, 5.0)));       // half of them swell on the beat
  float band = smoothstep(0.02, 0.07, f) * smoothstep(width + 0.07, width, f);
  // dashes along the band: they slide the other way, in steps as well
  float dsh = fract(v * (0.55 + 0.4 * hk) + hk * 9.0 + step_ * 0.35 * (hk > 0.5 ? 1.0 : -1.0));
  float dash = smoothstep(0.02, 0.07, dsh) * smoothstep(0.80, 0.72, dsh);
  float solid = step(0.45, wl_hash(vec2(k, 1.0)));                       // a few bands run unbroken
  band *= mix(dash, 1.0, solid);
  band *= step(0.18, hk);                                                // some gaps
  vec3 bc = wl_hot(hk * 3.7 + 0.1);
  col = mix(col, bc, band * (0.52 + 0.30 * hit));
  // a thin bright edge on the leading side of each band
  col += bc * smoothstep(0.05, 0.0, abs(f - 0.045)) * band * 0.25;

  // quiet equaliser pips along the bottom: a few bars bounce with the beat
  float bx = floor(uv.x * res.x / 22.0);
  float bh = (0.04 + 0.05 * wl_hash(vec2(bx, bi)) ) * (0.35 + 0.65 * hit) ;
  float bar = step(1.0 - bh, uv.y) * step(fract(uv.x * res.x / 22.0), 0.62) * step(0.45, wl_hash(vec2(bx, 2.0)));
  col = mix(col, wl_hot(wl_hash(vec2(bx, 4.0))), bar * 0.40);

  // flash and ring where the pointer is
  col += vec3(1.0, 0.78, 0.55) * ring * 0.20 * (0.5 + hit);

  col *= 1.0 - 0.35 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
