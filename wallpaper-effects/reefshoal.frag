// label: Reef shallows
// hint: looking down into sunlit turquoise shallows: coral heads on pale sand, dancing caustics, a shoal of small fish that scatters from the pointer
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
float rs_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rs_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rs_hash(i), rs_hash(i + vec2(1, 0)), f.x), mix(rs_hash(i + vec2(0, 1)), rs_hash(i + vec2(1, 1)), f.x), f.y);
}
float rs_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * rs_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float rs_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * rs_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float rs_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 rs_coralCol(float h) {
  if (h < 0.25) return vec3(0.95, 0.42, 0.40);
  if (h < 0.50) return vec3(0.98, 0.62, 0.30);
  if (h < 0.72) return vec3(0.72, 0.42, 0.72);
  return vec3(0.40, 0.72, 0.52);
}

vec2 rs_shoal(float k, float t, vec2 c0) {
  // fish k of the shoal: orbit around a slowly travelling centre
  float a = k * 2.399 + t * (0.25 + 0.04 * sin(k * 1.7));
  float r = 0.05 + 0.05 * rs_hash(vec2(k, 2.0)) + 0.012 * sin(t * 0.9 + k);
  return c0 + vec2(cos(a) * 1.25, sin(a * 0.9)) * r;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);

  // gentle refraction of everything seen through the surface
  vec2 rw = vec2(rs_noise(p * 7.0 + vec2(t * 0.35, 0.0)), rs_noise(p * 7.0 + vec2(5.0, t * 0.3))) - 0.5;
  vec2 q = p + rw * 0.012;

  // ---- the bottom: pale sand with ripples
  float rip = rs_noise(vec2(q.x * 9.0 + rs_noise(q * 4.0) * 3.0, q.y * 34.0));
  vec3 sand = mix(vec3(0.86, 0.80, 0.62), vec3(0.96, 0.91, 0.74), rip);
  sand *= 0.92 + 0.12 * rs_fbm3(q * 22.0);
  sand += vec3(0.02) * rs_luma(pic);

  // ---- coral heads (cellular)
  vec2 cq = q * 4.2 + vec2(3.0, 1.0);
  vec2 ci = floor(cq), cf = fract(cq);
  float best = -1.0; float bid = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = ci + vec2(float(i), float(j));
      float h = rs_hash(id + 1.3);
      if (h < 0.42) continue;
      vec2 c = vec2(float(i), float(j)) + 0.2 + 0.6 * vec2(rs_hash(id + 3.1), rs_hash(id + 7.7));
      float d = length(c - cf);
      float rad = 0.20 + 0.28 * rs_hash(id + 9.9);
      float v = rad - d + (rs_noise(q * 40.0 + id) - 0.5) * 0.10 + (rs_noise(q * 13.0 + id * 3.0) - 0.5) * 0.14;
      if (v > best) { best = v; bid = rs_hash(id + 5.5); }
    }
  }
  float cmask = smoothstep(0.0, 0.025, best);
  float height = clamp(best / 0.4, 0.0, 1.0);
  // ridged brain-coral texture
  float ridge = rs_noise(q * 70.0 + bid * 40.0) * 0.6 + rs_noise(q * 140.0) * 0.4;
  float rd = abs(sin(ridge * 12.0));
  vec3 cc = rs_coralCol(bid);
  vec3 coral = cc * (0.55 + 0.55 * height) * (0.80 + 0.30 * rd);
  coral += vec3(0.20, 0.16, 0.10) * pow(height, 3.0);
  // contact shadow on the sand around each head
  float shadow = smoothstep(-0.10, 0.0, best) * (1.0 - cmask) * 0.40;
  vec3 floorC = sand * (1.0 - shadow);
  floorC = mix(floorC, coral, cmask);

  // ---- the water on top: turquoise tint stronger with depth (deeper toward the top-left)
  float deep = clamp(0.2 + 0.55 * (1.0 - uv.y) + 0.25 * (1.0 - uv.x), 0.0, 1.0);
  vec3 water = mix(vec3(0.10, 0.78, 0.74), vec3(0.02, 0.34, 0.50), smoothstep(0.35, 1.0, deep));
  float absorb = 0.35 + 0.55 * deep;
  vec3 col = mix(floorC * vec3(0.84, 1.0, 1.0), water, absorb * 0.42);
  col = mix(col, coral * vec3(1.0, 1.0, 1.0) * 1.05, cmask * 0.55);

  // ---- caustics: two warped layers of bright lines
  vec2 cp = q * 6.5;
  float cs = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 w = cp + vec2(rs_fbm3(cp * 0.9 + t * 0.12 * (1.0 + float(k))), rs_fbm3(cp * 0.9 + 4.0 - t * 0.10)) * 1.8;
    float a = abs(sin(w.x * 2.4 + t * 0.4) + sin(w.y * 2.6 - t * 0.35) + sin((w.x + w.y) * 1.9));
    cs += pow(max(1.0 - a * 0.45, 0.0), 5.0);
    cp = cp * 1.55 + 3.0;
  }
  col += vec3(0.70, 1.0, 0.95) * cs * 0.22 * (1.0 - 0.45 * deep);

  // ---- the fish shoal: scatters away from the pointer
  vec2 c0 = vec2(asp * (0.5 + 0.28 * sin(t * 0.07)), 0.5 + 0.18 * sin(t * 0.05 + 1.0));
  vec2 flee = vec2(0.0);
  vec2 away = p - mp;
  float fd = length(away);
  for (int k = 0; k < 16; k++) {
    float kf = float(k);
    vec2 f1 = rs_shoal(kf, t, c0);
    vec2 f2 = rs_shoal(kf, t + 0.15, c0);
    vec2 dir = normalize(f2 - f1 + 1e-5);
    // pointer pushes the fish out of its way
    vec2 push = f1 - mp;
    float pr = length(push);
    f1 += normalize(push + 1e-5) * 0.14 * exp(-pr * pr / 0.020);
    vec2 d = (p - f1) / 1.7;
    vec2 lp = vec2(dot(d, dir), dot(d, vec2(-dir.y, dir.x)));
    // body: an ellipse tapering to a tail with a wagging fork
    float wag = sin(t * 7.0 + kf * 1.9) * 0.0035;
    float body = smoothstep(1.0, 0.8, length(vec2(lp.x / 0.016, lp.y / 0.0065)));
    float tl = -lp.x - 0.010;
    float tail = step(0.0, tl) * step(tl, 0.020) * smoothstep(0.0, 0.0015, tl * 0.45 + 0.001 - abs(lp.y - wag * tl * 30.0));
    float fish = max(body, tail * 0.8);
    // soft shadow on the bottom, offset away from the sun
    vec2 ds = d - vec2(0.012, 0.016);
    vec2 lps = vec2(dot(ds, dir), dot(ds, vec2(-dir.y, dir.x)));
    float shd = smoothstep(1.0, 0.5, length(vec2(lps.x / 0.020, lps.y / 0.008)));
    col *= 1.0 - shd * 0.22;
    vec3 fc = mix(vec3(1.0, 0.78, 0.20), vec3(0.95, 0.95, 0.85), step(0.5, rs_hash(vec2(kf, 8.0))));
    col = mix(col, fc * (0.78 + 0.3 * smoothstep(0.0, 0.006, lp.y)), fish * 0.95);
  }

  // surface glare and soft vignette
  col += vec3(0.3, 0.4, 0.35) * smoothstep(0.55, 0.0, length(p - vec2(asp * 0.8, 0.05))) * 0.07;
  col *= 1.0 - 0.32 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
