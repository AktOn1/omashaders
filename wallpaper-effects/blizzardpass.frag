// label: Blizzard pass
// hint: a snowstorm in a mountain pass, layers of wind-driven snow streak across dark rock walls that fade into white, a tiny hut shows one warm lantern window; the gusts bend around the pointer
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
float bz_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bz_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bz_hash(i), bz_hash(i + vec2(1, 0)), f.x), mix(bz_hash(i + vec2(0, 1)), bz_hash(i + vec2(1, 1)), f.x), f.y);
}
float bz_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * bz_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float bz_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * bz_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float bz_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float bz_ridge(float x, float s) {
  float v = 0.0, a = 0.50, fr = 1.0;
  for (int i = 0; i < 5; i++) {
    float n = bz_noise(vec2(x * fr, s + float(i) * 3.7));
    v += a * (1.0 - abs(2.0 * n - 1.0));
    fr *= 2.3; a *= 0.58;
  }
  return v * 0.9;
}
// pass envelope: low in the middle (the pass itself), tall rock walls to both sides
float bz_env(float x, float cx, float wid, float low) {
  return low + (1.0 - low) * smoothstep(0.02, 1.0, abs(x - cx) / wid);
}
float bz_top(float x, float cx, float base, float amp, float freq, float seed, float wid, float low) {
  return base - amp * bz_ridge(x * freq, seed) * bz_env(x, cx, wid, low);
}
// a dark rock wall: returns rgb + coverage; haze pulls it into the white
vec4 bz_wall(vec2 p, float uvy, float cx, float base, float amp, float freq, float seed, float wid, float low, vec3 fogc, float haze, float pix) {
  float top = bz_top(p.x, cx, base, amp, freq, seed, wid, low);
  float below = uvy - top;
  float cov = smoothstep(0.0, pix, below);
  if (cov <= 0.0) return vec4(0.0);
  float depth = below / amp;
  float e = 0.012;
  float g0 = bz_ridge((p.x + e) * freq, seed) - bz_ridge((p.x - e) * freq, seed);
  float xs = p.x + below * 0.5 * clamp(g0 * 90.0, -1.0, 1.0);
  float g = (bz_ridge((xs + e) * freq, seed) - bz_ridge((xs - e) * freq, seed)) / (2.0 * e * freq);
  float gul = bz_fbm3(vec2(xs * freq * 6.0, uvy * freq * 2.0) + seed);
  float ledge = bz_noise(vec2(xs * freq * 16.0, uvy * freq * 1.4 + seed)) * 0.65 + 0.35 * bz_noise(vec2(xs * freq * 40.0, uvy * freq * 5.0));
  float lit = smoothstep(-0.3, 0.5, g + (gul - 0.5) * 0.8);
  vec3 rock = mix(vec3(0.07, 0.09, 0.14), vec3(0.30, 0.36, 0.46), lit * 0.8 + 0.2 * gul);
  float snow = smoothstep(0.50, 0.66, ledge + (gul - 0.5) * 0.45 + 0.30 * (1.0 - smoothstep(0.0, 0.20, depth)) - 0.12 * depth);
  vec3 col = mix(rock, vec3(0.86, 0.90, 0.95) * (0.82 + 0.25 * lit), snow);
  col = mix(col, fogc, clamp(haze + 0.22 * smoothstep(0.25, 1.0, depth), 0.0, 0.95));
  return vec4(col, cov);
}
// wind-driven snow streaks in the flow frame (U along the wind, V across it)
float bz_flakes(vec2 uvf, float cells, float speed, float len, float thick, float dens, float seed, float t) {
  vec2 g = vec2((uvf.x - t * speed) * cells * 0.2, uvf.y * cells);
  vec2 id = floor(g), f = fract(g);
  float h1 = bz_hash(id + seed), h2 = bz_hash(id + seed + 7.3), h3 = bz_hash(id + seed + 3.1);
  vec2 d = (f - vec2(0.2 + 0.6 * h1, 0.2 + 0.6 * h2)) / vec2(len, thick);
  return exp(-dot(d, d)) * step(h3, dens) * (0.55 + 0.45 * h3 / max(dens, 0.01));
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
  float pl = bz_luma(pic);
  const float HZ = 0.60;
  float cx = asp * 0.5;
  float gustT = 0.85 + 0.15 * sin(t * 0.37) + 0.08 * sin(t * 0.91 + 2.0);

  // ---- wind frame: flow runs left to right and slightly down; around the pointer it is deflected like air around a stone
  vec2 wd = normalize(vec2(1.0, 0.26));
  vec2 wp = vec2(-wd.y, wd.x);
  float R = 0.085;
  float eye = 1.0;
  vec2 uvf = vec2(dot(p, wd), dot(p, wp));
  if (onScr) {
    vec2 d = p - mp;
    vec2 dl = vec2(dot(d, wd), dot(d, wp));
    float r2 = dot(dl, dl);
    float r2c = max(r2, R * R);
    uvf = vec2(dot(mp, wd) + dl.x * (1.0 + R * R / r2c), dot(mp, wp) + dl.y * (1.0 - R * R / r2c));
    eye = smoothstep(R * 0.75, R * 1.25, sqrt(r2));
  }

  // ---- fog and sky: a pale storm grey-blue overhead, near white at the horizon
  vec3 fogC = vec3(0.84, 0.88, 0.94);
  vec3 skyTop = vec3(0.50, 0.58, 0.72);
  vec3 col = mix(skyTop, fogC, smoothstep(0.0, HZ + 0.05, uv.y));
  float cl = bz_fbm3(vec2(uvf.x * 1.4 - t * 0.05, uvf.y * 6.0));
  col = mix(col, fogC, smoothstep(0.35, 0.8, cl) * 0.5 * (1.0 - uv.y));

  // ---- far wall, almost swallowed by white
  vec4 w1 = bz_wall(p, uv.y, cx, 0.68, 0.50, 1.15, 14.0, asp * 0.55, 0.22, fogC, 0.74, pix);
  col = mix(col, w1.rgb, w1.a);
  float f1 = bz_flakes(uvf, 110.0, 0.30 * gustT, 0.14, 0.14, 0.70, 1.0, t) * eye;
  col = mix(col, vec3(1.0), clamp(f1 * 0.40, 0.0, 1.0));

  // ---- the snowy floor of the pass
  float dz = max(uv.y - HZ, 0.0);
  float gm = smoothstep(0.0, 0.02, uv.y - HZ);
  vec2 gq = vec2((p.x - cx) * 0.8 / (dz + 0.06) - t * 0.03, 0.30 / (dz + 0.06));
  float drift = bz_fbm3(gq * vec2(0.5, 2.0) + 3.0);
  vec3 snowC = mix(vec3(0.60, 0.69, 0.82), vec3(0.96, 0.98, 1.0), smoothstep(0.25, 0.75, drift));
  snowC = mix(snowC, fogC, exp(-dz * 9.0) * 0.85);
  col = mix(col, snowC, gm);

  // ---- middle wall with the hut on its shoulder
  vec4 w2 = bz_wall(p, uv.y, cx, 0.84, 0.95, 0.95, 5.0, asp * 0.50, 0.08, fogC, 0.38, pix);
  col = mix(col, w2.rgb, w2.a);
  {
    float hx = asp * 0.655;
    float hb = bz_top(hx, cx, 0.84, 0.95, 0.95, 5.0, asp * 0.50, 0.08) + 0.006;
    vec2 hp = vec2(p.x - hx, uv.y - hb);                                   // hp.y < 0 is above the ground
    float bw = 0.021, bh = 0.024;
    float body = step(abs(hp.x), bw) * step(-bh, hp.y) * step(hp.y, 0.002);
    float roofY = -bh - (0.016 - abs(hp.x) * 0.80);
    float roof = step(abs(hp.x), bw + 0.004) * step(roofY, hp.y) * step(hp.y, -bh + 0.001);
    float chim = step(abs(hp.x - 0.012), 0.0027) * step(-bh - 0.024, hp.y) * step(hp.y, -bh - 0.004);
    float mound = smoothstep(1.0, 0.7, length(vec2(hp.x / 0.050, (hp.y + 0.001) / 0.007)));
    float roofSnow = roof * smoothstep(roofY + 0.0035, roofY + 0.001, hp.y);
    vec3 hutC = vec3(0.10, 0.085, 0.10);
    vec3 hcol = mix(hutC, fogC, 0.10);
    float flick = 0.86 + 0.14 * sin(t * 5.3 + sin(t * 2.1) * 2.0);
    vec2 wc = hp - vec2(-0.004, -0.0125);
    float win = step(abs(wc.x), 0.0052) * step(abs(wc.y), 0.0052);
    float glowD = length(hp - vec2(-0.004, -0.0125));
    vec3 lant = vec3(1.0, 0.68, 0.28);
    col = mix(col, vec3(0.90, 0.94, 0.99), mound * 0.9);
    col = mix(col, hcol, max(body, max(roof, chim)));
    col = mix(col, vec3(0.92, 0.95, 1.0), roofSnow * 0.9);
    col += lant * (exp(-glowD * glowD / 0.00055) * 0.55 + exp(-glowD * glowD / 0.0090) * 0.20) * flick;
    col = mix(col, lant * 1.15 * flick, win);
    // a warm patch of light lying on the snow in front of the hut
    float pool = exp(-pow((hp.x + 0.016) / 0.045, 2.0)) * exp(-pow((hp.y - 0.003) / 0.006, 2.0));
    col += lant * pool * 0.22 * flick;
  }
  float f2 = bz_flakes(uvf, 70.0, 0.52 * gustT, 0.14, 0.13, 0.60, 2.0, t) * eye;
  col = mix(col, vec3(1.0), clamp(f2 * 0.55, 0.0, 1.0));
  // the hut's light catches the snow around it
  col += vec3(1.0, 0.62, 0.25) * f2 * exp(-pow(length((p - vec2(asp * 0.651, 0.69)) * vec2(1.0, 1.4)) / 0.055, 2.0)) * 0.45;

  // ---- gust sheets: soft white veils sweeping through
  float gv = bz_fbm3(vec2((uvf.x - t * 0.42 * gustT) * 0.9, uvf.y * 4.2));
  float gust = smoothstep(0.42, 0.80, gv) * (0.35 + 0.35 * smoothstep(HZ - 0.2, 1.0, uv.y)) * (0.4 + 0.6 * eye);
  col = mix(col, fogC * vec3(1.02), clamp(gust, 0.0, 0.75));
  float gv2 = bz_fbm3(vec2((uvf.x - t * 0.7 * gustT) * 1.6 + 9.0, uvf.y * 9.0));
  col = mix(col, vec3(0.97, 0.985, 1.0), smoothstep(0.50, 0.85, gv2) * 0.30 * (0.4 + 0.6 * eye));

  // ---- near wall, the darkest rock framing both sides
  vec4 w3 = bz_wall(p, uv.y, cx, 1.04, 1.45, 0.80, 21.0, asp * 0.50, 0.07, fogC, 0.05, pix);
  col = mix(col, w3.rgb * vec3(0.78, 0.82, 0.90), w3.a);

  // ---- front snow: big fast streaks that cross everything
  float f3 = bz_flakes(uvf, 36.0, 0.95 * gustT, 0.14, 0.14, 0.50, 3.0, t) * eye;
  float f4 = bz_flakes(uvf, 52.0, 0.75 * gustT, 0.14, 0.13, 0.55, 4.0, t) * eye;
  col = mix(col, vec3(1.0), clamp(f3 * 0.75 + f4 * 0.55, 0.0, 0.9));

  // let the user's picture tint the scene a little, and a soft vignette
  col *= 0.95 + 0.07 * pl;
  col *= 1.0 - 0.22 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
