// label: Blue lull
// hint: layered swells of indigo mist, slow beads of pale light falling, the pointer a lone cold lamp
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

// slow falling beads of light: one layer on a grid, each cell a short soft streak that drifts down
float wl_beads(vec2 p, float cell, float speed, float seed, float t) {
  vec2 q = p / cell;
  q.y -= t * speed;
  vec2 id = floor(q), f = fract(q);
  float h = wl_hash(id + seed);
  if (h < 0.62) return 0.0;
  float x = 0.2 + 0.6 * wl_hash(id + seed + 4.1);
  float y = wl_hash(id + seed + 8.3);
  float dx = abs(f.x - x) * cell;
  float dy = (f.y - y) * cell;
  float len = 3.0 + 5.0 * h;
  float streak = smoothstep(1.3, 0.0, dx) * smoothstep(len, 0.0, abs(dy + len * 0.5)) ;
  return streak * (0.35 + 0.65 * wl_hash(id + seed + 2.2));
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;

  // the picture, reduced to one cold indigo tone
  vec3 w = wall(uv);
  float l = wl_luma(w);
  vec3 deep = vec3(0.020, 0.032, 0.085);
  vec3 midc = vec3(0.075, 0.130, 0.270);
  vec3 hic = vec3(0.420, 0.540, 0.740);
  vec3 col = mix(deep, midc, smoothstep(0.0, 0.5, l));
  col = mix(col, hic, smoothstep(0.45, 1.0, l) * 0.55);

  // an overcast pale glow high on the left, as if the sky were still faintly lit
  vec2 gd = (p - vec2(0.25 * asp, -0.05)) * vec2(0.8, 1.2);
  col += vec3(0.16, 0.22, 0.34) * exp(-dot(gd, gd) * 3.0) * 0.8;

  // the pointer: a lone pale lamp; the swell around it lifts a little
  float dm = length(p - mp);
  float lamp = exp(-dm * dm / (2.0 * 0.07 * 0.07));
  float lampWide = exp(-dm * dm / (2.0 * 0.30 * 0.30));

  // four layered swells of blue mist, each lower and darker, each drifting at its own slow speed
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float y0 = 0.40 + 0.16 * fk;
    float ph = fk * 2.1 + 1.0;
    float edge = y0
      + 0.045 * sin(p.x * (1.7 + 0.45 * fk) + t * (0.045 + 0.012 * fk) + ph)
      + 0.060 * (wl_fbm(vec2(p.x * 1.1 + t * 0.012 * (1.0 + fk) + ph * 3.0, fk * 5.0)) - 0.5)
      - 0.05 * lampWide * m.y;
    float a = smoothstep(edge - 0.01, edge + 0.20, uv.y);
    vec3 lc = mix(vec3(0.22, 0.32, 0.52), vec3(0.035, 0.055, 0.130), fk / 3.0);
    // a pale rim where each swell crests
    float rim = smoothstep(0.05, 0.0, abs(uv.y - edge - 0.01)) * (0.5 - 0.1 * fk);
    col = mix(col, lc, a * (0.50 + 0.10 * fk));
    col += vec3(0.20, 0.30, 0.48) * rim * 0.32;
  }

  // slow falling beads of pale light, two depths, brighter around the lamp
  vec2 pp = vec2(uv.x * res.x, uv.y * res.y);
  float b1 = wl_beads(pp, 58.0, 22.0, 3.0, t);
  float b2 = wl_beads(pp * 0.7 + 31.0, 40.0, 11.0, 7.0, t) * 0.6;
  col += vec3(0.55, 0.70, 0.95) * (b1 + b2) * (0.28 + 0.6 * lampWide);

  col += vec3(0.50, 0.65, 0.95) * lamp * 0.35 + vec3(0.30, 0.42, 0.70) * lampWide * 0.07;

  col *= 1.0 - 0.50 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
