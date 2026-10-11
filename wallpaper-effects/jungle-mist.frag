// label: Jungle mist
// hint: layers of rainforest canopy dissolving into drifting mist with shafts of light and big wet leaves in the corners, the pointer parts the fog
// category: Wild places
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
float jm_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float jm_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(jm_hash(i), jm_hash(i + vec2(1, 0)), f.x), mix(jm_hash(i + vec2(0, 1)), jm_hash(i + vec2(1, 1)), f.x), f.y);
}
float jm_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * jm_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float jm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// crown line of one tree layer (y of the tree tops)
float jm_top(float x, float seed, float base, float amp, float fq) {
  return base - amp * jm_fbm(vec2(x * fq + seed, seed * 1.7)) - 0.012 * jm_noise(vec2(x * fq * 14.0 + seed, 2.0)) - 0.005 * jm_noise(vec2(x * fq * 40.0, seed));
}

// a big tropical leaf from a root point: axis angle, length, half width; returns (coverage, vein light)
vec2 jm_leaf(vec2 p, vec2 root, float ang, float len, float wid) {
  vec2 d = p - root;
  vec2 ax = vec2(cos(ang), sin(ang));
  float a = dot(d, ax) / len;
  float c = dot(d, vec2(-ax.y, ax.x));
  if (a < 0.0 || a > 1.0) return vec2(0.0);
  float hw = wid * pow(sin(3.14159 * pow(a, 0.8)), 0.8);
  float cov = smoothstep(hw, hw * 0.92, abs(c));
  float rib = smoothstep(0.003, 0.0, abs(c)) * 0.9;
  float vein = smoothstep(0.5, 0.95, abs(sin(a * 38.0 + abs(c) / max(hw, 0.001) * 3.0 * 3.14159 * 0.35))) * (0.25 + 0.0) * step(0.004, abs(c));
  return vec2(cov, rib + vein);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);
  float near = exp(-dot((p - mp) * vec2(1.0, 1.2), (p - mp) * vec2(1.0, 1.2)) / 0.05);       // the pointer parts the mist

  // ---- the sky above the canopy: a pale, warm, wet glow
  vec3 fog = vec3(0.70, 0.84, 0.78);
  vec3 col = mix(vec3(0.55, 0.74, 0.74), vec3(0.93, 0.96, 0.84), smoothstep(0.0, 0.55, uv.y));
  // a pearly sun disc behind the cloud, upper left
  vec2 sunC = vec2(0.26 * asp, 0.06);
  float ds = length(p - sunC);
  col += vec3(1.0, 0.95, 0.75) * (exp(-ds * ds / 0.003) * 0.45 + exp(-ds * ds / 0.08) * 0.22);

  // ---- five layers of rainforest, far to near; each is bluer, paler and lower-contrast the farther it is
  for (int l = 0; l < 5; l++) {
    float fl = float(l);
    float base = 0.40 + 0.125 * fl;
    float amp = 0.15 + 0.01 * fl;
    float fq = 0.9 + 0.45 * fl;
    float seed = 3.0 + 7.0 * fl;
    float drift = t * (0.0015 + 0.0005 * fl) * 0.0;
    float top = jm_top(p.x + drift, seed, base, amp, fq);
    if (uv.y > top) {
      float depth = (uv.y - top);                                // how far below the crown line
      float far01 = 1.0 - fl / 4.0;                              // 1 far .. 0 near
      vec3 deepC = mix(vec3(0.02, 0.12, 0.07), vec3(0.20, 0.38, 0.24), far01);
      vec3 litC = mix(vec3(0.20, 0.45, 0.18), vec3(0.50, 0.70, 0.52), far01);
      // mottled foliage: bumps catch the light on top, shadow between them
      float leaf = jm_noise(vec2(p.x * (60.0 + 25.0 * fl), uv.y * (90.0 + 40.0 * fl)) + seed);
      float topLit = exp(-depth / (0.030 + 0.01 * fl)) * (0.5 + 0.7 * leaf);
      vec3 lc = mix(deepC, litC, clamp(topLit, 0.0, 1.0));
      lc *= 0.86 + 0.24 * leaf;
      // trunks and shadows reading through lower down
      float trunk = smoothstep(0.80, 0.97, jm_noise(vec2(p.x * (24.0 + 8.0 * fl), seed))) * smoothstep(0.05, 0.14, depth) * (1.0 - far01 * 0.6);
      lc = mix(lc, deepC * 0.5, trunk * 0.5);
      // aerial perspective: the far layers dissolve into the fog
      float haze = mix(0.06, 0.78, pow(far01, 0.8));
      lc = mix(lc, fog * (0.92 + 0.1 * uv.y), haze);
      col = lc;
    }
    // a bank of mist rolling in the valley in front of each layer (not for the nearest)
    float mb = jm_fbm(vec2(p.x * 1.4 - t * (0.010 + 0.004 * fl) + fl * 7.0, uv.y * 7.0 + fl)) ;
    float bandY = base + 0.045;
    float mist = exp(-pow((uv.y - bandY) / (0.04 + 0.01 * fl), 2.0)) * smoothstep(0.38, 0.72, mb);
    mist *= 1.0 - 0.8 * near;
    col = mix(col, fog * 1.02, clamp(mist * (0.75 - 0.10 * fl), 0.0, 0.85));
  }

  // ---- god rays from the upper left, strongest where the mist is
  vec2 rd = p - sunC;
  float ang = atan(rd.x, rd.y);
  float rays = pow(jm_noise(vec2(ang * 14.0, t * 0.03)), 2.0) * 0.6 + pow(jm_noise(vec2(ang * 33.0 + 5.0, -t * 0.02)), 2.0) * 0.4;
  float rayFall = exp(-length(rd) * 0.9);
  col += vec3(1.0, 0.96, 0.74) * rays * rayFall * 0.14 * (1.0 - 0.7 * near);

  // ---- foreground leaves in two corners, the pointer pushes them gently
  float push = (mp.x - 0.5 * asp) * 0.04;
  float cov = 0.0, vein = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    // lower left cluster
    float a0 = -0.75 + fi * 0.32 + 0.03 * sin(t * 0.5 + fi) + push;
    vec2 lf = jm_leaf(p, vec2(-0.03, 1.02), a0, 0.45 + 0.07 * fi, 0.075);
    cov = max(cov, lf.x); vein = max(vein, lf.y * lf.x);
    // upper right cluster, hanging down-left
    float a1 = 2.45 - fi * 0.30 + 0.03 * sin(t * 0.45 + fi * 1.7) + push;
    vec2 lr = jm_leaf(p, vec2(asp + 0.03, -0.03), a1, 0.40 + 0.06 * fi, 0.07);
    cov = max(cov, lr.x); vein = max(vein, lr.y * lr.x);
  }
  vec3 lcol = mix(vec3(0.015, 0.09, 0.05), vec3(0.08, 0.30, 0.12), vein);
  lcol += vec3(0.05, 0.10, 0.03) * jm_noise(p * 14.0);
  col = mix(col, lcol, cov * 0.97);
  // droplets on the leaves
  float dr = jm_noise(p * 150.0);
  col += vec3(0.7, 1.0, 0.85) * smoothstep(0.93, 0.99, dr) * cov * 0.25;

  col *= 0.985 + 0.03 * jm_luma(w);
  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
