// label: Alpine dawn
// hint: pink and orange alpenglow on jagged snow peaks above a slowly flowing sea of cloud, thin high cirrus and a bright morning star; the cloud sea swirls under the pointer
// category: Wild weather
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
float ad_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ad_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ad_hash(i), ad_hash(i + vec2(1, 0)), f.x), mix(ad_hash(i + vec2(0, 1)), ad_hash(i + vec2(1, 1)), f.x), f.y);
}
float ad_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ad_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ad_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * ad_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ad_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// one jagged mountain profile: ridged noise, sharp summits and broad saddles (0..1)
float ad_ridge(float x, float s) {
  float v = 0.0, a = 0.50, fr = 1.0;
  for (int i = 0; i < 5; i++) {
    float n = ad_noise(vec2(x * fr, s + float(i) * 3.7));
    v += a * (1.0 - abs(2.0 * n - 1.0));
    fr *= 2.3; a *= 0.58;
  }
  return v * 0.9;
}
// a mountain range: returns rgb + coverage. Sun is low on the left: slopes that face left catch the alpenglow, the rest stay blue-violet.
vec4 ad_range(vec2 p, float uvy, float base, float amp, float freq, float seed, vec3 skyc, float haze, float pix, float calm) {
  float h = ad_ridge(p.x * freq, seed) * (0.50 + 0.80 * ad_noise(vec2(p.x * freq * 0.45, seed + 40.0)));
  float top = base - amp * h;
  float below = uvy - top;
  float cov = smoothstep(0.0, pix, below);
  if (cov <= 0.0) return vec4(0.0);
  float depth = below / amp;
  float e = 0.012;
  float g0 = ad_ridge((p.x + e) * freq, seed) - ad_ridge((p.x - e) * freq, seed);
  float xs = p.x + below * 0.55 * clamp(g0 * 400.0, -1.0, 1.0);                  // arete lines fan down from each summit
  float g = (ad_ridge((xs + e) * freq, seed) - ad_ridge((xs - e) * freq, seed)) / (2.0 * e * freq);
  float gul = ad_fbm3(vec2(xs * freq * 7.0, uvy * freq * 1.6) + seed);
  float lit = smoothstep(-0.25, 0.55, g + (gul - 0.5) * 0.9);
  float glow = exp(-depth * 1.9);
  float snowK = 1.0 - smoothstep(0.30, 0.75, depth * 0.9 + (gul - 0.5) * 1.1 + 0.1 * g);
  vec3 snowSh = vec3(0.40, 0.40, 0.72);
  vec3 rockSh = vec3(0.14, 0.13, 0.30);
  vec3 snowLit = mix(vec3(1.0, 0.56, 0.52), vec3(1.0, 0.80, 0.62), glow);
  vec3 rockLit = vec3(0.80, 0.36, 0.38);
  vec3 sh = mix(rockSh, snowSh, snowK);
  vec3 lt = mix(rockLit, snowLit, snowK);
  vec3 col = mix(sh, lt, lit * (0.25 + 0.75 * glow) * calm);
  col *= 0.62 + 0.72 * gul;
  col = mix(col, skyc * vec3(1.0, 0.92, 1.05), clamp(haze + smoothstep(0.5, 1.6, depth) * 0.35, 0.0, 0.92));    // aerial haze, thicker low down
  return vec4(col, cov);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  float pix = 1.6 / res.y;
  vec3 pic = wall(uv);
  float pl = ad_luma(pic);
  const float HZ = 0.64;

  // ---- sky: indigo overhead, violet, then a rose and gold dawn glow low on the left
  float up = clamp(uv.y / HZ, 0.0, 1.0);
  vec3 zen = vec3(0.07, 0.09, 0.28);
  vec3 midc = vec3(0.40, 0.30, 0.62);
  vec3 low = vec3(1.0, 0.56, 0.48);
  vec3 gold = vec3(1.0, 0.80, 0.55);
  vec3 sky = mix(zen, midc, smoothstep(0.0, 0.72, up));
  sky = mix(sky, low, smoothstep(0.55, 1.0, up));
  float dxs = p.x - asp * 0.12;
  float sg = exp(-dxs * dxs / 0.30) * exp(-pow((uv.y - HZ) / 0.26, 2.0));
  sky = mix(sky, gold, clamp(sg * 0.75, 0.0, 1.0));
  // faint stars still hanging in the upper sky (and the picture's own, shining through)
  vec2 sc = floor(vec2(p.x, uv.y) * 90.0);
  float sr = ad_hash(sc);
  vec2 sf = fract(vec2(p.x, uv.y) * 90.0) - 0.5 - (vec2(ad_hash(sc + 3.0), ad_hash(sc + 8.0)) - 0.5) * 0.5;
  float star = step(0.965, sr) * smoothstep(0.12, 0.0, length(sf)) * (1.0 - smoothstep(0.1, 0.6, up));
  sky += vec3(0.9, 0.9, 1.0) * star * (0.5 + 0.5 * sin(t * 1.3 + sr * 40.0)) * 0.55;
  // thin high cirrus, pink where it faces the sun, drifting slowly
  vec2 cq = vec2(p.x * 0.9 - t * 0.012, uv.y * 9.0 + sin(p.x * 1.4) * 0.9);
  float ci = ad_fbm(cq + ad_fbm3(cq * 0.6 + 4.0) * 1.2);
  float cir = smoothstep(0.50, 0.80, ci) * smoothstep(0.58, 0.10, uv.y) * 0.75;
  vec3 cirC = mix(vec3(0.72, 0.52, 0.86), vec3(1.0, 0.68, 0.52), clamp(sg * 1.6 + 0.25 * up, 0.0, 1.0));
  sky = mix(sky, cirC, cir);
  // the morning star
  vec2 sp = vec2(asp * 0.68, 0.19);
  vec2 sd = p - sp;
  float sdl = length(sd);
  float tw = 0.88 + 0.12 * sin(t * 2.1) * sin(t * 1.3 + 1.0);
  float spike = exp(-abs(sd.x) / 0.0025) * exp(-abs(sd.y) / 0.030) + exp(-abs(sd.y) / 0.0025) * exp(-abs(sd.x) / 0.030);
  sky += vec3(1.0, 0.97, 0.92) * (exp(-sdl * sdl / 0.000030) * 1.3 + exp(-sdl * sdl / 0.0016) * 0.30 + spike * 0.30) * tw;

  vec3 col = sky;
  vec3 skyH = mix(low, gold, 0.5 * sg + 0.2);                                  // haze colour on the horizon

  // ---- far range, pale and hazy
  vec4 r1 = ad_range(p + vec2(0.35, 0.0), uv.y, 0.70, 0.46, 1.25, 11.0, skyH, 0.50, pix, 0.95);
  col = mix(col, r1.rgb, r1.a);
  // ---- middle range, the big glowing peaks
  vec4 r2 = ad_range(p, uv.y, 0.92, 0.88, 1.0, 3.0, skyH, 0.16, pix, 1.0);
  col = mix(col, r2.rgb, r2.a);

  // ---- the sea of cloud filling the valley, swirled around the pointer
  vec2 pw = p;
  float swirl = 0.0;
  if (onScr) {
    vec2 d = p - mp;
    float r2d = dot(d, d);
    swirl = exp(-r2d / 0.045);
    float a = 2.0 * swirl;
    float ca = cos(a), sa = sin(a);
    pw = mp + vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);
  }
  float dy = max(pw.y - 0.50, 0.10);
  vec2 q = vec2((pw.x - 0.5 * asp) * 0.55 / dy, 0.42 / dy) + vec2(t * 0.020, t * 0.006);
  vec2 wq = vec2(ad_fbm3(q * 0.7 + t * 0.010), ad_fbm3(q * 0.7 + 7.0 - t * 0.008));
  float n = ad_fbm(q * 2.4 + wq * 1.8);
  float nL = ad_fbm3(q * 2.4 + wq * 1.8 + vec2(-0.14, 0.0));
  float seaTop = 0.715 + (n - 0.5) * 0.10 - swirl * 0.02;
  float cs = smoothstep(0.0, 0.020, uv.y - seaTop);                           // billowy upper edge
  float wisp = smoothstep(0.075, 0.0, seaTop - uv.y) * smoothstep(0.50, 0.75, ad_fbm3(q * 2.2 + wq)) * 0.5;
  float cd = clamp((uv.y - seaTop) / 0.28, 0.0, 1.0);
  float slope = n - nL;
  vec3 cShade = mix(vec3(0.54, 0.47, 0.78), vec3(0.22, 0.21, 0.48), cd);
  vec3 cLit = mix(vec3(1.0, 0.66, 0.60), vec3(1.0, 0.86, 0.72), smoothstep(0.35, 0.75, n));
  float litAmt = clamp(0.38 + slope * 9.0, 0.0, 1.0) * (0.40 + 0.9 * smoothstep(0.30, 0.70, n)) * (1.0 - 0.65 * cd) * (0.60 + 0.5 * exp(-dxs * dxs / 0.9));
  vec3 cloud = mix(cShade, cLit, clamp(litAmt, 0.0, 1.0));
  cloud += vec3(1.0, 0.75, 0.6) * swirl * 0.10 * smoothstep(0.4, 0.8, n);
  vec3 wispC = mix(vec3(0.85, 0.55, 0.7), vec3(1.0, 0.78, 0.65), clamp(sg + 0.3, 0.0, 1.0));
  col = mix(col, wispC, wisp * (1.0 - cs));
  col = mix(col, cloud, cs);

  // ---- near foreground ridge, a dark blue-violet silhouette with a rim of pink light
  vec4 r3 = ad_range(p + vec2(1.7, 0.0), uv.y, 1.04, 0.34, 0.75, 21.0, skyH, 0.0, pix, 0.55);
  vec3 nearC = mix(vec3(0.05, 0.06, 0.15), vec3(0.14, 0.12, 0.28), smoothstep(0.0, 1.0, r3.r));
  nearC = mix(nearC, r3.rgb * 0.5, 0.5);
  nearC += vec3(0.55, 0.28, 0.30) * exp(-max(uv.y - (1.04 - 0.34 * ad_ridge((p.x + 1.7) * 0.75, 21.0) * (0.50 + 0.80 * ad_noise(vec2((p.x + 1.7) * 0.75 * 0.45, 61.0)))), 0.0) / 0.012) * 0.5;
  col = mix(col, nearC, r3.a);

  // let the user's picture colour the whole scene a little, and vignette
  col *= 0.94 + 0.12 * pl;
  col *= 1.0 - 0.34 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
