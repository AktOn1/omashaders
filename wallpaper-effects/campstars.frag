// label: Campfire stars
// hint: a deep starry night with a milky way, dark pines and a small fire whose flames lean away from the pointer, embers drifting up
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
float cf_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cf_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cf_h(i), cf_h(i + vec2(1, 0)), f.x), mix(cf_h(i + vec2(0, 1)), cf_h(i + vec2(1, 1)), f.x), f.y);
}
float cf_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * cf_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float cf_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 cf_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }

// a campfire under the stars: a deep night sky with a milky way, dark pines on a ridge, a fire whose flames lean away from
// the pointer like a breeze, embers drifting up into the dark
float cf_tri(vec2 p, vec2 c, float w, float h) {   // a pine: stacked triangles, returns mask
  vec2 d = p - c;
  if (d.y < 0.0 || d.y > h) return 0.0;
  float u = d.y / h;                               // 0 at the tip, 1 at the base
  float wid = w * (0.12 + 0.88 * u) * (0.75 + 0.25 * step(0.5, fract(u * 3.0)));
  return smoothstep(wid, wid * 0.8, abs(d.x));
}
vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = cf_ptr(mpx, vec2(0.5, 0.5));
  vec3 base = wall(uv);
  // sky
  vec3 sky = mix(vec3(0.010, 0.016, 0.050), vec3(0.050, 0.060, 0.130), smoothstep(0.0, 0.85, uv.y));
  sky += base * vec3(0.03, 0.03, 0.05);
  // milky way: a diagonal band of fine cloud and dust
  float dband = (uv.x * asp * 0.55 + uv.y * 0.9) - 0.75;
  float mw = exp(-dband * dband / (2.0 * 0.12 * 0.12)) * (0.45 + 0.9 * cf_fbm(p * 3.2 + 3.0));
  sky += vec3(0.20, 0.22, 0.38) * mw * 0.28;
  // stars: dense, two sizes, slow shallow twinkle
  vec3 st = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 70.0 : 34.0;
    vec2 q = p * sc;
    vec2 id = floor(q), f = fract(q) - 0.5;
    float h = cf_h(id + float(k) * 13.0);
    if (h > (k == 0 ? 0.80 : 0.90)) {
      vec2 o = (vec2(cf_h(id + 1.7), cf_h(id + 6.1)) - 0.5) * 0.6;
      float tw = 0.75 + 0.25 * sin(t * (0.4 + h) + h * 80.0);
      float s = smoothstep(k == 0 ? 0.10 : 0.14, 0.0, length(f - o)) * tw * (0.3 + 0.7 * cf_h(id + 4.0));
      st += mix(vec3(0.85, 0.90, 1.0), vec3(1.0, 0.88, 0.70), cf_h(id + 8.0)) * s;
    }
  }
  sky += st * (0.4 + 0.6 * smoothstep(0.85, 0.15, uv.y)) * (1.0 + 0.7 * mw);
  vec3 col = sky;
  // the fire: lower left of the middle
  vec2 fc = vec2(0.30 * asp, 0.86);
  float lean = clamp((m.x * asp - fc.x) * 0.25, -0.1, 0.1) * -1.0 * react;
  // distant ridge and pines
  float ridgeY = 0.74 + 0.03 * sin(p.x * 2.3 + 1.0) + 0.02 * (cf_fbm(vec2(p.x * 2.0, 1.0)) - 0.5);
  float ridge = smoothstep(ridgeY, ridgeY + 0.004, uv.y);
  float pines = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float px = (0.04 + fi * 0.115 + 0.05 * cf_h(vec2(fi, 3.0))) * asp / 1.0;
    float ph = 0.10 + 0.08 * cf_h(vec2(fi, 5.0));
    float base_y = 0.76 + 0.04 * cf_h(vec2(fi, 8.0));
    pines = max(pines, cf_tri(p, vec2(px, base_y - ph), 0.032 + 0.012 * cf_h(vec2(fi, 2.0)), ph));
  }
  col = mix(col, vec3(0.012, 0.016, 0.026), max(ridge, pines * step(uv.y, 0.84)));
  // fire glow on everything: flicker as the sum of slow noise
  float fl = 0.80 + 0.20 * cf_n(vec2(t * 2.1, 3.0)) + 0.10 * sin(t * 6.0 + cf_n(vec2(t, 1.0)) * 4.0);
  vec2 fd = (p - fc) * vec2(1.0, 1.3);
  float glow = exp(-dot(fd, fd) / (2.0 * 0.25 * 0.25)) * fl;
  col += vec3(1.0, 0.45, 0.12) * glow * 0.32;
  col += vec3(1.0, 0.65, 0.30) * exp(-dot(fd, fd) / (2.0 * 0.07 * 0.07)) * fl * 0.35;
  // the ground
  float ground = smoothstep(0.84, 0.855, uv.y);
  col = mix(col, vec3(0.020, 0.018, 0.020) + vec3(0.30, 0.12, 0.04) * glow * 0.55, ground);
  // logs: two crossed bars
  vec2 ld = p - fc - vec2(0.0, 0.0);
  float logA = smoothstep(0.012, 0.007, abs(ld.y * 1.0 + ld.x * 0.45 - 0.004)) * step(abs(ld.x), 0.075);
  float logB = smoothstep(0.012, 0.007, abs(ld.y * 1.0 - ld.x * 0.45 - 0.004)) * step(abs(ld.x), 0.075);
  col = mix(col, vec3(0.10, 0.05, 0.03) + vec3(0.5, 0.2, 0.04) * glow * 0.3, max(logA, logB) * step(uv.y, 0.89));
  // flames: noisy tongues rising from the logs, leaning with the breeze
  vec2 q = vec2(p.x - fc.x - lean * (fc.y - uv.y) * 2.0, fc.y - uv.y);
  float hgt = 0.23;
  float h01 = q.y / hgt;
  float wobble = (cf_fbm(vec2(q.x * 12.0, q.y * 6.0 - t * 2.4)) - 0.5) * 0.06 * (0.3 + h01);
  float widthF = 0.078 * (1.0 - h01) * smoothstep(-0.01, 0.03, q.y);
  float fx = abs(q.x + wobble) / max(widthF, 0.001);
  float flame = smoothstep(1.0, 0.2, fx) * step(0.0, h01) * step(h01, 1.0);
  flame *= 0.8 + 0.4 * cf_n(vec2(q.x * 20.0, q.y * 10.0 - t * 4.0));
  vec3 fcol = mix(vec3(1.0, 0.35, 0.06), vec3(1.0, 0.85, 0.45), smoothstep(0.9, 0.0, h01 + fx * 0.5));
  col = mix(col, fcol, clamp(flame, 0.0, 1.0) * 0.92);
  // embers and sparks drifting up
  float em = 0.0;
  for (int k = 0; k < 2; k++) {
    float cell = 0.05 + 0.03 * float(k);
    vec2 q2 = vec2((p.x - fc.x) / cell, (p.y - fc.y) / cell + t * (0.5 + 0.2 * float(k)) * 0.5);
    q2.x += sin(q2.y * 0.7 + float(k) * 3.0) * 0.8 + lean * 25.0 * (fc.y - uv.y);
    vec2 id = floor(q2), f = fract(q2) - 0.5;
    float h = cf_h(id + float(k) * 9.0);
    vec2 o = (vec2(cf_h(id + 3.1), cf_h(id + 7.7)) - 0.5) * 0.5;
    float fade = smoothstep(0.55, 0.05, fc.y - uv.y) * smoothstep(0.0, 0.05, fc.y - uv.y);
    em += step(0.80, h) * smoothstep(0.07, 0.0, length(f - o)) * fade * (0.5 + 0.5 * sin(t * 3.0 + h * 50.0));
  }
  col += vec3(1.0, 0.55, 0.18) * em * 0.9 * step(abs(p.x - fc.x), 0.4);
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
