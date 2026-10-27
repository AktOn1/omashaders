// label: Hollow eve
// hint: a quiet autumn night laid over your picture, all soft shapes and no pictures: slow cold moonlight shafts, a low mist that parts around the pointer, two faint treeline silhouettes with a few far-off lamps, dark leaves tumbling slowly, and warm motes that drift and gather near the pointer. Calm, your picture stays the wallpaper
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
float he_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float he_h2(vec2 v) { return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }
float he_n(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(he_h2(i), he_h2(i + vec2(1.0, 0.0)), f.x), mix(he_h2(i + vec2(0.0, 1.0)), he_h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float he_fbm(vec2 x) { return (0.5 * he_n(x) + 0.25 * he_n(x * 2.03 + 7.1) + 0.125 * he_n(x * 4.1 + 3.7)) / 0.875; }
float he_glow(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }

// a treeline: clumps of pine tops with ragged spikes; returns the top edge (0 = top of screen, 1 = bottom)
float he_line(float x, float base, float amp, float teeth, float seed, float sway) {
  float clump = he_fbm(vec2(x * 2.6 + seed * 3.1, seed));
  float u = x * teeth;
  float i = floor(u), f = fract(u);
  float hgt = 0.35 + 0.65 * he_h(i + seed);
  float spike = pow(1.0 - abs(f - 0.5) * 2.0, 1.7) * hgt;
  float u2 = x * teeth * 2.3 + 0.37;
  float spike2 = pow(1.0 - abs(fract(u2) - 0.5) * 2.0, 2.4) * (0.3 + 0.7 * he_h(floor(u2) + seed * 1.7));
  return base - amp * (clump * 0.95 + spike * 0.55 + spike2 * 0.25) - sway * spike * 0.0012;
}

// the far-off lamps on the back treeline: x (screen fraction), vertical offset below the ridge, pulse phase
vec3 he_lamp(int i) {
  if (i == 0) return vec3(0.118, 0.016, 0.3);
  if (i == 1) return vec3(0.287, 0.012, 1.7);
  if (i == 2) return vec3(0.461, 0.020, 2.9);
  if (i == 3) return vec3(0.634, 0.014, 4.1);
  if (i == 4) return vec3(0.806, 0.018, 5.3);
  return vec3(0.934, 0.013, 0.9);
}

vec4 fxMain(vec2 mpx) {
  float asp = res.x / res.y;
  vec2 uv = qt_TexCoord0;
  vec2 p = vec2(uv.x * asp, uv.y);
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? vec2(mpx.x / res.y, mpx.y / res.y) : vec2(-10.0);
  vec2 par = has ? (vec2(mpx.x / res.x, mpx.y / res.y) - vec2(0.5, 0.5)) : vec2(0.0);
  float t = time;
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  // cold dusk wash at the corners; the middle of the picture is left alone
  float vig = smoothstep(0.45, 1.15, length((uv - 0.5) * vec2(asp, 1.0)));
  col = mix(col, col * vec3(0.80, 0.88, 0.98) + vec3(0.0, 0.012, 0.03), 0.30 * vig);

  // slow moonlight shafts from the upper right, and cloud shade sliding over the picture
  float diag = uv.x * 0.9 + uv.y * 0.5;
  float sh = he_fbm(vec2(diag * 5.5 + t * 0.012, uv.y * 1.2 - t * 0.006));
  sh = smoothstep(0.52, 0.86, sh) * smoothstep(1.0, 0.05, uv.y) * smoothstep(0.1, 0.9, uv.x);
  col += vec3(0.30, 0.42, 0.55) * sh * 0.085 * (1.0 - 0.5 * lum0);
  float cloud = he_fbm(p * 0.9 + vec2(t * 0.010, 3.0));
  col *= 1.0 - 0.07 * smoothstep(0.45, 0.75, cloud);

  // ---- back treeline with a few far-off lamps ----
  float yB = he_line(p.x + par.x * 0.020, 0.925, 0.055, 30.0, 3.0, sin(t * 0.4));
  float aB = smoothstep(-0.004, 0.004, uv.y - yB);
  float lampGlow = 0.0;
  for (int i = 0; i < 6; i++) {
    vec3 L = he_lamp(i);
    vec2 lc = vec2(L.x * asp - par.x * 0.020 * asp, he_line(L.x * asp, 0.925, 0.055, 30.0, 3.0, 0.0) + L.y);
    float fl = 0.72 + 0.20 * sin(t * 0.9 + L.z) + 0.08 * sin(t * 3.1 + L.z * 3.0);
    float near = has ? exp(-length(lc - mp) * 4.0) : 0.0;
    lampGlow += he_glow(p, lc, 0.011) * (fl + near * 0.5);
    lampGlow += he_glow(p, lc, 0.045) * 0.20 * (fl + near * 0.5);
  }
  vec3 inkB = vec3(0.045, 0.060, 0.090);
  col = mix(col, mix(inkB, col * 0.20 + vec3(0.02, 0.03, 0.05), 0.35), aB * 0.62);
  col += vec3(1.0, 0.62, 0.28) * lampGlow * 0.32;

  // ---- low mist between the treelines: parts around the pointer, drifts both ways ----
  float wake = 1.0 - 0.80 * he_glow(p, mp, 0.17);
  float m1 = smoothstep(0.36, 0.78, he_fbm(p * vec2(1.35, 2.7) + vec2(t * 0.022, 1.0)));
  float m2 = smoothstep(0.46, 0.82, he_fbm(p * vec2(0.85, 2.0) + vec2(-t * 0.015, 8.0)));
  float band = smoothstep(0.45, 0.88, uv.y) * smoothstep(1.02, 0.93, uv.y);
  vec3 mistc = mix(vec3(0.18, 0.23, 0.33), vec3(0.56, 0.62, 0.74), he_fbm(p * 2.5 + t * 0.015));
  col = mix(col, mistc + vec3(1.0, 0.6, 0.3) * lampGlow * 0.12, clamp((m1 * 0.70 + m2 * 0.45) * band, 0.0, 0.80) * wake);

  // ---- front treeline, nearer and darker, shifting a little more with the pointer ----
  float yF = he_line(p.x * 0.9 + par.x * 0.045 + 5.0, 0.985, 0.050, 20.0, 8.0, sin(t * 0.55 + 1.0));
  float aF = smoothstep(-0.0040, 0.0040, uv.y - yF);
  col = mix(col, vec3(0.020, 0.028, 0.050), aF * 0.82);

  // ---- leaves: dark, slow, each turning over as it falls; the pointer nudges them aside ----
  for (int k = 0; k < 14; k++) {
    float fk = float(k);
    float spd = 0.020 + 0.022 * he_h(fk + 2.0);
    float ph = t * spd + he_h(fk * 5.3);
    float seed = floor(ph) + fk * 17.0;
    float life = fract(ph);
    float cx = (0.03 + 0.94 * he_h(seed + 1.0)) * asp;
    vec2 o = vec2(cx + 0.045 * sin(life * 9.0 + fk * 1.9) + 0.02 * sin(life * 23.0 + fk), -0.04 + life * 1.08);
    vec2 dmv = o - mp;
    float dl = length(dmv);
    o += dmv / (dl + 0.04) * 0.07 * exp(-pow(dl / 0.18, 2.0));
    float sz = 0.014 + 0.012 * he_h(seed + 4.0);
    float rot = t * (0.35 + 0.6 * he_h(seed + 6.0)) * (he_h(seed + 7.0) > 0.5 ? 1.0 : -1.0) + he_h(seed + 8.0) * 6.28;
    float flip = abs(cos(t * (0.5 + he_h(seed + 3.0)) + fk));
    vec2 d = p - o;
    if (dot(d, d) < sz * sz * 6.0) {
      float cs = cos(rot), sn = sin(rot);
      vec2 q = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y) / sz;
      q.y /= max(flip, 0.18);
      float hw = 0.46 * pow(max(1.0 - q.x * q.x, 0.0), 0.8);
      float a = smoothstep(0.10, -0.05, abs(q.y) - hw) * step(abs(q.x), 1.0);
      float fade = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.90, life);
      vec3 lc = mix(vec3(0.20, 0.07, 0.03), vec3(0.45, 0.20, 0.07), he_h(seed + 9.0));
      lc += vec3(0.30, 0.15, 0.05) * smoothstep(0.1, 0.0, abs(q.y)) * 0.6; // a faint vein along the leaf
      col = mix(col, lc, a * fade * 0.78);
    }
  }

  // ---- warm motes: wander in the dark air, pulse, and drift toward the pointer when it is near ----
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    vec2 base = vec2((0.05 + 0.90 * he_h(fi * 3.7 + 1.0)) * asp, 0.28 + 0.62 * he_h(fi * 5.1 + 2.0));
    vec2 w = vec2(0.045 * sin(t * (0.10 + 0.07 * he_h(fi)) + fi * 2.3) + 0.02 * sin(t * 0.31 + fi),
                  0.035 * cos(t * (0.09 + 0.06 * he_h(fi + 4.0)) + fi * 1.7));
    vec2 mpos = base + w;
    vec2 dm = mp - mpos;
    float dmL = length(dm);
    mpos += dm / (dmL + 0.001) * min(dmL, 0.07) * smoothstep(0.35, 0.10, dmL);
    float pul = 0.5 + 0.5 * sin(t * (0.5 + 0.6 * he_h(fi + 7.0)) + fi * 4.1);
    float r = 0.0022 + 0.0016 * he_h(fi + 9.0);
    col += vec3(1.0, 0.72, 0.38) * he_glow(p, mpos, r) * (0.30 + 0.45 * pul);
    col += vec3(0.9, 0.55, 0.25) * he_glow(p, mpos, r * 7.0) * 0.045 * (0.4 + pul);
  }

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
