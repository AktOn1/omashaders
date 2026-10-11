// label: Midsummer heat
// hint: high summer noon: a white-hot sun, heat shimmer over a golden wheat field with a wind wave, a cloud shadow follows the pointer
// category: Seasons and festivals
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
float nsh_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float nsh_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 nsh_h22(vec2 p) { return vec2(nsh_h2(p), nsh_h2(p + vec2(37.2, 91.7))); }
float nsh_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(nsh_h2(i), nsh_h2(i + vec2(1, 0)), f.x), mix(nsh_h2(i + vec2(0, 1)), nsh_h2(i + vec2(1, 1)), f.x), f.y);
}
float nsh_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * nsh_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float nsh_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  float t = time;
  const float HZ = 0.60;
  float depth = max(uv.y - HZ, 0.0) / (1.0 - HZ);          // 0 at the horizon, 1 at the bottom
  vec2 sunC = vec2(0.30 * asp, 0.16);

  // heat shimmer: the picture wobbles and stretches in thin bands, most of all just above and below the horizon
  float band = exp(-pow((uv.y - HZ) / 0.16, 2.0));
  float wob = (nsh_n(vec2(uv.x * 22.0 + t * 0.25, uv.y * 70.0 - t * 1.1)) - 0.5) + 0.5 * (nsh_n(vec2(uv.x * 55.0, uv.y * 140.0 - t * 1.9)) - 0.5);
  vec2 suv = uv + vec2(wob * 0.0075 * band, wob * 0.0012 * band);
  vec3 base = wall(suv);

  // sky: deep blue overhead bleaching to white at the horizon
  float sk = smoothstep(0.0, HZ, uv.y);
  vec3 sky = mix(vec3(0.10, 0.38, 0.88), vec3(0.50, 0.74, 0.96), pow(sk, 1.1));
  sky = mix(sky, vec3(0.98, 0.93, 0.78), pow(sk, 3.5) * 0.85);
  vec3 col = mix(base * vec3(1.05, 1.0, 0.92), sky, 0.86);

  // the sun: a hot white disc, a big glow and a faint glare veil
  float ds = length(p - sunC);
  col += vec3(1.0, 0.92, 0.65) * (exp(-ds * ds * 9.0) * 0.22 + exp(-ds * ds * 60.0) * 0.30);
  col = mix(col, vec3(1.0, 0.98, 0.90), smoothstep(0.045, 0.036, ds));
  // two soft lens ghosts along the line from the sun through the centre
  vec2 axis = vec2(0.5 * asp, 0.5) - sunC;
  for (int k = 1; k <= 2; k++) {
    vec2 gc = sunC + axis * (0.55 * float(k) + 0.35);
    float gd = length(p - gc);
    col += vec3(1.0, 0.85, 0.55) * smoothstep(0.045 + 0.02 * float(k), 0.0, gd) * 0.05;
  }

  // cumulus: flat bottoms, drifting slowly
  float cd = nsh_fbm(vec2(p.x * 2.2 - t * 0.012, p.y * 5.0 + 3.0)) - 0.50 - 0.25 * uv.y;
  float cloud = smoothstep(0.0, 0.14, cd) * (1.0 - smoothstep(HZ - 0.20, HZ - 0.03, uv.y));
  vec3 cc = mix(vec3(0.88, 0.92, 1.0), vec3(1.0, 0.99, 0.95), smoothstep(0.0, 0.3, cd));
  col = mix(col, cc, cloud * 0.80);

  // far hills in heat haze
  float hl = HZ - 0.035 * nsh_n(vec2(p.x * 2.3, 1.0)) - 0.015 * nsh_n(vec2(p.x * 7.0, 2.0)) - 0.006;
  float hill = smoothstep(hl - 0.002, hl + 0.002, uv.y);
  col = mix(col, vec3(0.74, 0.74, 0.62), hill * 0.55 * (1.0 - smoothstep(HZ - 0.001, HZ + 0.004, uv.y)));

  // the wheat field: perspective rows, a wind wave rolling through, warm gold
  float inField = smoothstep(HZ - 0.001, HZ + 0.003, uv.y);
  if (inField > 0.0) {
    float z = 1.0 / (depth + 0.06);
    float rows = nsh_n(vec2(p.x * z * 6.0, z * 1.5)) * 0.4 + nsh_n(vec2(p.x * z * 22.0 + 4.0, z * 5.0)) * 0.35 + nsh_n(vec2(p.x * z * 70.0 + 9.0, z * 11.0)) * 0.15 + nsh_n(vec2(p.x * 380.0, uv.y * 700.0)) * 0.2;
    float wave = 0.5 + 0.5 * sin(z * 1.1 - t * 1.0 + p.x * 2.0 + 1.5 * nsh_n(vec2(p.x * 2.0, z * 0.3)));
    float wave2 = pow(wave, 2.0);
    vec3 gold0 = vec3(0.62, 0.42, 0.13), gold1 = vec3(0.98, 0.78, 0.34);
    vec3 f = mix(gold0, gold1, clamp(rows * 0.9 + wave2 * 0.55 - 0.1, 0.0, 1.0));
    f = mix(f, vec3(0.92, 0.84, 0.60), exp(-depth * 7.0) * 0.8);           // haze toward the horizon
    f *= 0.78 + 0.22 * smoothstep(0.0, 0.5, depth);
    // wild flowers: a few dots of poppy red and cornflower blue near the front
    vec2 fq = vec2(p.x * z * 2.2, z * 1.4);
    vec2 fi = floor(fq), ff = fract(fq) - 0.5 + (nsh_h22(fi) - 0.5) * 0.3;
    float fh = nsh_h2(fi + 3.0);
    float kk = 0.56 * (depth + 0.06) / 0.4;
    float fd = length(vec2(ff.x, ff.y * kk));
    float flower = smoothstep(0.17, 0.08, fd) * step(0.86, fh) * smoothstep(0.25, 0.5, depth);
    f = mix(f, mix(vec3(0.90, 0.18, 0.12), vec3(0.30, 0.45, 0.95), step(0.95, fh)), flower * 0.85);
    // shimmering mirage glints on the horizon
    f += vec3(1.0, 0.95, 0.8) * smoothstep(0.55, 0.9, nsh_n(vec2(p.x * 40.0 + t * 0.8, depth * 220.0 - t * 0.4))) * exp(-depth * 40.0) * 0.4;
    col = mix(col, f, inField);
  }

  // a cloud's shadow drifts with the pointer and cools what lies under it
  float sh = exp(-dot((p - mp) * vec2(1.0, 1.7), (p - mp) * vec2(1.0, 1.7)) / 0.045);
  col = mix(col, col * vec3(0.62, 0.74, 0.94), sh * 0.85);

  col = mix(col, vec3(nsh_lum(col)), -0.08);                 // a hint more saturation
  col *= 1.0 - 0.18 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
