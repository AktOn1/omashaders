// label: Cumulus sunset
// hint: a towering thunderhead lit gold and rose by a low sun, slowly boiling upward; the pointer slides the sun along the horizon and relights the cloud
// category: Sea and sky
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
float cu_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cu_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cu_hash(i), cu_hash(i + vec2(1, 0)), f.x), mix(cu_hash(i + vec2(0, 1)), cu_hash(i + vec2(1, 1)), f.x), f.y);
}
float cu_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * cu_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float cu_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * cu_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float cu_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
const float CU_HZ = 0.80;

// the tower is a heap of round billows, painted top to bottom; every billow is shaded like a sphere lit from the sun
vec4 cu_tower(vec2 p, float asp, float t, vec3 L3, vec3 litC, vec3 shC) {
  vec3 col = vec3(0.0);
  float a = 0.0;
  float cx = asp * 0.62;
  for (int i = 0; i < 14; i++) {
    float k = 1.0 - float(i) / 13.0;
    for (int j = 0; j < 3; j++) {
      vec2 id = vec2(float(i), float(j));
      float hs = cu_hash(id + 1.7);
      float ny = 0.03 + 0.67 * k + (hs - 0.5) * 0.05;
      float w = 0.12 + 0.12 * sqrt(ny) + 0.24 * smoothstep(0.45, 0.62, ny);
      float off = (float(j) - 1.0) * 0.85 + (cu_hash(id + 4.1) - 0.5) * 0.5;
      float r = (0.050 + 0.055 * cu_hash(id + 9.3)) * (0.8 + 0.9 * sqrt(ny));
      r *= 1.0 + 0.04 * sin(t * 0.35 + float(i) * 1.3 + float(j));
      vec2 c = vec2(cx + off * w + 0.006 * sin(t * 0.2 + hs * 9.0), CU_HZ - ny + 0.012 * sin(t * 0.25 + hs * 7.0));
      vec2 dd = p - c;
      float flat_ = smoothstep(0.50, 0.64, ny);
      dd.y *= mix(1.0, 1.9, flat_);
      float d = length(dd) / r;
      if (d > 1.5) continue;
      float ang = atan(dd.y, dd.x);
      d *= 1.0 + 0.16 * (cu_noise(vec2(ang * 2.2 + hs * 11.0, hs * 5.0 + t * 0.05)) - 0.5);
      d += (cu_fbm3(p * 16.0 + hs * 13.0 + vec2(0.0, t * 0.03)) - 0.5) * 0.55;
      float cov = smoothstep(1.0, 0.62, d) * smoothstep(CU_HZ + 0.002, CU_HZ - 0.012, p.y);
      if (cov <= 0.0) continue;
      vec3 n3 = vec3(dd / r, sqrt(max(1.0 - min(d * d, 1.0), 0.0)));
      float lit = dot(n3, L3) * 0.55 + 0.45 + (cu_fbm3(p * 30.0 + hs * 20.0) - 0.5) * 0.30;
      lit = clamp(lit, 0.0, 1.0);
      vec3 cc = mix(shC, litC, lit);
      cc *= 0.78 + 0.22 * smoothstep(0.0, 0.22, ny);
      col = mix(col, cc, cov * (0.55 + 0.45 * cov));
      a = a + cov * (1.0 - a);
    }
  }
  return vec4(col, a);
}

float cu_low(vec2 p, float t) {
  // scattered cumulus on the horizon, flat bottoms
  float n = cu_fbm(vec2(p.x * 3.4 + t * 0.006, p.y * 9.0));
  float base = smoothstep(CU_HZ - 0.02, CU_HZ - 0.07, p.y);
  float band = smoothstep(CU_HZ - 0.30, CU_HZ - 0.12, p.y);
  return smoothstep(0.52, 0.72, n + (1.0 - band) * 0.25) * base * band;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  float t = time;
  vec3 pic = wall(uv);

  float sx = (m.x > 0.0 && m.x < 1.0) ? mix(0.12, 0.88, m.x) : 0.22;           // the sun slides along the horizon
  vec2 sun = vec2(asp * sx, CU_HZ - 0.05);
  vec2 toSun = sun - p;
  float ds = length(toSun);
  vec2 ldir = toSun / max(ds, 1e-4);

  // ---- sky
  float h = clamp((CU_HZ - uv.y) / CU_HZ, 0.0, 1.0);                           // 0 at the horizon, 1 at the top
  vec3 sky = mix(vec3(1.0, 0.58, 0.28), vec3(0.95, 0.36, 0.40), smoothstep(0.0, 0.25, h));
  sky = mix(sky, vec3(0.50, 0.26, 0.52), smoothstep(0.18, 0.52, h));
  sky = mix(sky, vec3(0.12, 0.13, 0.34), smoothstep(0.42, 1.0, h));
  sky += vec3(0.02) * cu_luma(pic);
  sky += vec3(1.0, 0.55, 0.20) * exp(-ds * ds / 0.06) * 0.55 + vec3(1.0, 0.82, 0.55) * exp(-ds * ds / 0.006) * 0.55;
  sky = mix(sky, vec3(1.0, 0.95, 0.82), smoothstep(0.034, 0.028, ds));

  // ---- the tower: self-shadowed by sampling the density a step toward the sun
  vec3 shadowC = vec3(0.26, 0.12, 0.34);
  vec3 litC = mix(vec3(1.0, 0.60, 0.36), vec3(1.0, 0.84, 0.62), exp(-ds * 1.3));
  vec3 L3 = normalize(vec3(ldir, 0.45));
  vec4 tw = cu_tower(p, asp, t, L3, litC, shadowC);
  float d0 = tw.a;
  vec3 cloud = tw.rgb;
  // cooler, darker top that is already in the dusk
  cloud = mix(cloud, cloud * vec3(0.72, 0.70, 0.95), smoothstep(0.35, 0.75, h) * 0.6);
  vec3 col = mix(sky, cloud, d0);
  float lit = 0.6;

  // ---- low cumulus along the horizon
  float lw = cu_low(p, t);
  float lw1 = cu_low(p + ldir * 0.03, t);
  vec3 lowC = mix(vec3(0.42, 0.20, 0.38), vec3(1.0, 0.60, 0.34), clamp(0.55 + (lw - lw1) * 3.0, 0.0, 1.0));
  col = mix(col, lowC, lw * 0.85 * (1.0 - d0));

  // ---- ground: a dark plain with the sun's long reflection in a lake
  float gy = uv.y - CU_HZ;
  float gmask = smoothstep(0.0, 0.004, gy);
  vec3 ground = mix(vec3(0.18, 0.08, 0.16), vec3(0.04, 0.03, 0.08), smoothstep(0.0, 0.18, gy));
  float ripx = cu_noise(vec2(p.x * 60.0, gy * 220.0 - t * 0.6));
  float pd = (p.x - sun.x + (cu_noise(vec2(gy * 40.0 - t * 0.2, 1.0)) - 0.5) * 0.04);
  float path = exp(-pd * pd / (2.0 * (0.03 + 0.5 * gy) * (0.03 + 0.5 * gy)));
  ground += vec3(1.0, 0.55, 0.25) * path * smoothstep(0.45, 0.8, ripx) * 0.7 + vec3(0.9, 0.4, 0.3) * path * 0.12;
  // a tower reflection hint on the water: the cloud colour smeared down
  ground += cloud * 0.18 * smoothstep(0.12, 0.0, gy) * smoothstep(0.35, 0.9, cu_noise(vec2(p.x * 9.0, gy * 120.0)))  * exp(-pow((p.x - asp * 0.62) / 0.3, 2.0));
  col = mix(col, ground, gmask);
  // tiny treeline silhouette on the horizon
  float tl = cu_fbm3(vec2(p.x * 38.0, 2.0)) * 0.012 + 0.003;
  col = mix(col, vec3(0.05, 0.03, 0.08), smoothstep(CU_HZ + 0.001, CU_HZ - 0.001, uv.y + tl * 0.0) * smoothstep(CU_HZ - tl - 0.002, CU_HZ - tl + 0.001, uv.y) * 0.9);

  col *= 1.0 - 0.34 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
