// label: Savanna dust
// hint: a huge low sun through the dust of an African savanna, acacia and giraffe silhouettes, warm motes the pointer scatters
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
float sv_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sv_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sv_hash(i), sv_hash(i + vec2(1, 0)), f.x), mix(sv_hash(i + vec2(0, 1)), sv_hash(i + vec2(1, 1)), f.x), f.y);
}
float sv_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sv_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sv_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// distance to a capsule (segment a-b with radius r)
float sv_cap(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

const float SV_HZ = 0.66;

// a flat-topped acacia: umbrella crown of three noisy ellipses on a forked trunk; returns coverage
float sv_acacia(vec2 p, vec2 b, float s, float sd) {
  vec2 q = (p - b) / s;                                        // local, y up is negative
  float cov = 0.0;
  // trunk with a fork
  float tr = sv_cap(q, vec2(0.0, 0.0), vec2(0.03, -0.22), 0.012);
  tr = min(tr, sv_cap(q, vec2(0.03, -0.22), vec2(-0.12, -0.34), 0.008));
  tr = min(tr, sv_cap(q, vec2(0.03, -0.22), vec2(0.17, -0.33), 0.008));
  cov = max(cov, smoothstep(0.003, -0.003, tr));
  // crown: flat layered discs, ragged edge
  float rag = (sv_noise(q * 24.0 + sd) - 0.5) * 0.05 + (sv_noise(q * 60.0 + sd) - 0.5) * 0.02;
  vec2 c1 = (q - vec2(0.02, -0.40)) / vec2(0.36, 0.060);
  vec2 c2 = (q - vec2(-0.16, -0.355)) / vec2(0.22, 0.045);
  vec2 c3 = (q - vec2(0.21, -0.365)) / vec2(0.20, 0.050);
  float cr = min(length(c1), min(length(c2), length(c3)));
  cov = max(cov, smoothstep(1.0 + rag * 6.0, 0.88 + rag * 6.0, cr));
  return cov;
}

// a giraffe walking by, silhouette from capsules; s = height scale
float sv_giraffe(vec2 p, vec2 b, float s, float legPhase) {
  vec2 q = (p - b) / s;
  float d = 1e3;
  d = min(d, sv_cap(q, vec2(-0.10, -0.58), vec2(0.10, -0.60), 0.085));           // body
  d = min(d, sv_cap(q, vec2(0.10, -0.62), vec2(0.20, -1.05), 0.032));            // neck
  d = min(d, sv_cap(q, vec2(0.20, -1.05), vec2(0.27, -1.09), 0.030));            // head
  float sw = sin(legPhase) * 0.07;
  d = min(d, sv_cap(q, vec2(-0.14, -0.56), vec2(-0.14 + sw, 0.0), 0.014));
  d = min(d, sv_cap(q, vec2(-0.08, -0.56), vec2(-0.08 - sw, 0.0), 0.014));
  d = min(d, sv_cap(q, vec2(0.08, -0.56), vec2(0.08 - sw, 0.0), 0.014));
  d = min(d, sv_cap(q, vec2(0.14, -0.56), vec2(0.14 + sw, 0.0), 0.014));
  d = min(d, sv_cap(q, vec2(-0.18, -0.62), vec2(-0.27, -0.44), 0.006));          // tail
  return smoothstep(0.004, -0.002, d);
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

  vec2 sunC = vec2(0.62 * asp, 0.585);
  float ds = length((p - sunC) * vec2(1.0, 1.0));

  // ---- sky: indigo high up, burning down through magenta and orange to a dusty gold
  float h = uv.y / SV_HZ;
  vec3 sky = mix(vec3(0.10, 0.07, 0.24), vec3(0.55, 0.16, 0.34), smoothstep(0.0, 0.55, h));
  sky = mix(sky, vec3(0.97, 0.42, 0.18), smoothstep(0.45, 0.88, h));
  sky = mix(sky, vec3(1.0, 0.78, 0.38), smoothstep(0.82, 1.0, h));
  // long streaky cloud bars catching the last light
  float cb = sv_fbm(vec2(p.x * 1.6 + t * 0.004, uv.y * 11.0));
  sky += vec3(0.55, 0.20, 0.10) * smoothstep(0.50, 0.80, cb) * smoothstep(0.1, 0.5, h) * smoothstep(1.0, 0.7, h) * 0.55;
  // the sun and a wide halo
  float disc = smoothstep(0.068, 0.062, ds);
  sky += vec3(1.0, 0.55, 0.20) * exp(-ds * ds / 0.035) * 0.7 + vec3(1.0, 0.40, 0.15) * exp(-ds * ds / 0.30) * 0.30;
  sky = mix(sky, vec3(1.0, 0.86, 0.50), disc);
  vec3 col = sky;

  // ---- dust hanging in the low air: bands of brown-gold that dim the sun and soften the horizon
  float dust = sv_fbm(vec2(p.x * 2.2 - t * 0.008, uv.y * 14.0 + t * 0.003));
  float dband = exp(-pow((uv.y - (SV_HZ - 0.055)) / 0.075, 2.0));
  col = mix(col, vec3(0.85, 0.42, 0.20) * (0.8 + 0.3 * dust), clamp(dband * (0.35 + 0.55 * dust), 0.0, 0.8));

  // ---- the plain: dark red earth with a long golden path of light under the sun
  if (uv.y >= SV_HZ) {
    float dn = (uv.y - SV_HZ) / (1.0 - SV_HZ);
    vec3 earth = mix(vec3(0.62, 0.26, 0.12), vec3(0.10, 0.04, 0.04), pow(dn, 0.5));
    float gx = exp(-pow((p.x - sunC.x) / (0.05 + 0.40 * dn), 2.0));
    earth += vec3(1.0, 0.55, 0.20) * gx * exp(-dn * 3.5) * 0.45;
    float gr = sv_noise(vec2(p.x * 80.0 / (dn + 0.1) * 0.12, dn * 60.0));
    earth *= 0.82 + 0.35 * gr;
    col = earth;
    col = mix(col, vec3(0.85, 0.42, 0.20), smoothstep(0.10, 0.0, dn) * 0.4);
  }

  // ---- silhouettes: two acacias and a pair of giraffes on the skyline
  vec3 sil = vec3(0.045, 0.020, 0.035);
  float tree = sv_acacia(p, vec2(0.24 * asp, SV_HZ + 0.065), 0.30, 3.0);
  tree = max(tree, sv_acacia(p, vec2(0.86 * asp, SV_HZ + 0.015), 0.15, 9.0) * 0.97);
  float gif = sv_giraffe(p, vec2(0.45 * asp, SV_HZ + 0.012), 0.090, t * 1.1);
  gif = max(gif, sv_giraffe(p, vec2(0.40 * asp, SV_HZ + 0.020), 0.075, t * 1.1 + 2.0));
  float far = max(tree, gif);
  col = mix(col, sil + vec3(0.18, 0.07, 0.03) * smoothstep(0.1, 1.0, ds) * 0.0, far);

  // ---- warm motes of dust glowing in the backlight; the pointer scatters them
  vec3 glow = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    float cell = 0.085 - 0.03 * fl;
    vec2 q = p;
    vec2 away = q - mp;
    float push = exp(-dot(away, away) / 0.02) * 0.05;
    q += normalize(away + 1e-4) * push;
    q += vec2(t * (0.012 + 0.01 * fl), -t * 0.004);
    q.y += sin(q.x * 6.0 + fl * 3.0 + t * 0.5) * 0.01;
    vec2 id = floor(q / cell), f = fract(q / cell) - 0.5;
    float hh = sv_hash(id + fl * 31.0);
    vec2 off = (vec2(sv_hash(id + 3.1), sv_hash(id + 8.7)) - 0.5) * 0.6;
    float r = (0.05 + 0.08 * sv_hash(id + 1.3));
    float tw = 0.6 + 0.4 * sin(t * (0.5 + hh) + hh * 50.0);
    float mt = smoothstep(r, r * 0.2, length(f - off)) * step(0.55, hh) * tw;
    float lightness = smoothstep(0.9, 0.1, ds) * 0.8 + 0.25;
    glow += vec3(1.0, 0.72, 0.38) * mt * lightness * (0.45 - 0.15 * fl);
  }
  col += glow * smoothstep(0.1, SV_HZ, uv.y + 0.2) ;

  // ---- grass tufts in the very front, black against the glow
  float gcell = uv.x * 150.0 * asp * 0.56;
  float gid = floor(gcell);
  float gf = fract(gcell);
  float gh = 0.015 + 0.05 * sv_hash(vec2(gid, 4.0)) + 0.02 * sv_noise(vec2(gid * 0.1, 1.0));
  float sway = sin(t * 0.9 + gid * 0.3) * 0.004 * (gh * 20.0);
  float tri = 1.0 - abs(gf * 2.0 - 1.0 + sway * 30.0);
  float topY = 1.005 - gh * pow(clamp(tri, 0.0, 1.0), 0.6);
  float tuft = smoothstep(topY - 0.002, topY + 0.002, uv.y);
  col = mix(col, sil, tuft * 0.97);

  col *= 0.985 + 0.03 * sv_luma(w);
  col *= 1.0 - 0.30 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
