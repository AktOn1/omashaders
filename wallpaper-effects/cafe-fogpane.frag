// label: Rainy cafe window
// hint: a fogged cafe window on a rainy night, drops run down it and the pointer wipes a clear patch
// category: Places and eras
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
float cf_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cf_h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float cf_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cf_h2(i), cf_h2(i + vec2(1, 0)), f.x), mix(cf_h2(i + vec2(0, 1)), cf_h2(i + vec2(1, 1)), f.x), f.y);
}
float cf_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * cf_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

// the picture, softly defocused: nine taps on a golden-angle disc
vec3 cf_blur(vec2 uv, float rad) {
  vec3 acc = wall(uv);
  for (int i = 0; i < 8; i++) {
    float fi = float(i) + 0.5;
    float a = fi * 2.39996;
    float r = sqrt(fi / 8.0) * rad;
    acc += wall(uv + vec2(cos(a), sin(a) * res.x / res.y) * r);
  }
  return acc / 9.0;
}

// bokeh: out of focus street lights; returns rgb light. soft = edge softness (large = blurry), sc = cell size
vec3 cf_bokeh(vec2 p, float sc, float seed, float t, float soft) {
  vec2 q = p / sc;
  q.x += t * 0.012 * seed;
  vec2 id = floor(q), f = fract(q) - 0.5;
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = id + vec2(float(i), float(j));
      float h = cf_h2(g + seed);
      if (h < 0.42) continue;
      vec2 o = vec2(float(i), float(j)) + (vec2(cf_h2(g + seed + 3.1), cf_h2(g + seed + 7.7)) - 0.5) * 0.7 - f;
      float rad = (0.16 + 0.22 * cf_h2(g + seed + 1.3));
      float d = length(o);
      float disc = smoothstep(rad, rad * (1.0 - soft), d);
      float ring = smoothstep(rad * 0.75, rad, d) * smoothstep(rad * 1.02, rad * 0.9, d) * 0.12;
      float tw = 0.75 + 0.25 * sin(t * (0.3 + cf_h2(g + 5.0)) + h * 30.0);
      float pick = cf_h2(g + seed + 9.9);
      vec3 c = pick < 0.55 ? vec3(1.0, 0.72, 0.34) : (pick < 0.75 ? vec3(1.0, 0.88, 0.62) : (pick < 0.88 ? vec3(0.95, 0.30, 0.20) : vec3(0.45, 0.80, 0.70)));
      acc += c * (disc * 0.55 + ring) * tw * (0.5 + 0.5 * cf_h2(g + seed + 2.2));
    }
  }
  return acc;
}

// one layer of running drops: returns (clear amount in x = trail/drop, lens strength y, highlight z); vertical columns
vec3 cf_drops(vec2 p, float colw, float seed, float t, vec2 lens) {
  float cx = floor(p.x / colw);
  float h = cf_h1(cx + seed * 31.0);
  float fx = (p.x / colw - cx - 0.5);
  float spd = 0.035 + 0.06 * cf_h1(cx + seed * 7.0);
  float per = 1.35;
  float y = fract(t * spd + h * 7.0);                   // drop position as a fraction of the pane height (0 top .. 1 bottom)
  float wob = (cf_noise(vec2(p.y * 9.0, cx + seed)) - 0.5) * 0.35;    // the trail wanders sideways
  float ox = fx - (h - 0.5) * 0.30 - wob * smoothstep(0.0, 0.5, y - p.y);
  float dy = (p.y - y);                                   // positive: below the drop
  float r = colw * (0.17 + 0.10 * cf_h1(cx + seed * 3.0));
  vec2 dd = vec2(ox * colw, dy);
  float drop = smoothstep(r, r * 0.55, length(dd * vec2(1.0, 0.78)));
  float trail = smoothstep(0.0, -0.002, dy) * smoothstep(-0.15 * (0.5 + h), 0.0, dy) * smoothstep(r * 0.8, r * 0.3, abs(ox * colw));
  trail *= 0.8;
  float hi = smoothstep(r * 0.5, 0.0, length(dd - vec2(-r * 0.3, -r * 0.35))) * drop;
  lens += dd / r * drop * 0.0;
  return vec3(max(drop, trail), drop, hi);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  float t = time;

  // how much the glass is wiped here: a soft, slightly ragged patch around the pointer
  float dm = length((p - mp) * vec2(1.0, 1.0));
  float rag = (cf_fbm(p * 9.0 + 3.0) - 0.5) * 0.06;
  float wipe = smoothstep(0.24 + rag, 0.11 + rag, dm);

  // running drops (two sizes) clear the fog and act as little lenses
  vec3 dA = cf_drops(p, 0.075, 1.0, t, vec2(0.0));
  vec3 dB = cf_drops(p + vec2(0.037, 0.2), 0.052, 2.0, t * 0.8, vec2(0.0));
  float clearDrops = max(dA.x, dB.x * 0.9);
  float lensDrop = max(dA.y, dB.y);
  float hiDrops = max(dA.z, dB.z);
  float clear = max(wipe, clearDrops * 0.85);
  // inside a drop the world is upside down and magnified: sample from a flipped spot
  vec2 uvL = uv + vec2(0.0, 0.012) * lensDrop;

  // ---- the street outside, defocused where the glass is fogged
  float defocus = mix(0.016, 0.003, clear);
  vec3 pic = cf_blur(uvL, defocus);
  float lum = dot(pic, vec3(0.299, 0.587, 0.114));
  vec3 scene = mix(vec3(lum), pic, 0.55) * vec3(0.80, 0.90, 1.10) + vec3(0.010, 0.016, 0.030);

  // warm street lamps as bokeh: big and soft through fog, tighter where wiped
  float soft = mix(0.85, 0.25, clear);
  vec3 bk = cf_bokeh(p + vec2(0.0, 0.0), 0.20, 1.0, t, soft) * 0.9 + cf_bokeh(p * 1.15 + 4.0, 0.11, 5.0, t, soft) * 0.7;
  bk *= smoothstep(0.12, 0.55, uv.y);                            // lights sit in the lower two thirds: street level
  scene += bk * vec3(1.0, 0.92, 0.82) * 0.95;

  // ---- the fog on the glass: a cool veil, warmed from below by the cafe's light
  float grain = cf_fbm(p * vec2(60.0, 40.0));
  vec3 fogC = vec3(0.50, 0.58, 0.68);
  vec3 warm = vec3(1.0, 0.72, 0.42);
  float fogAmt = 0.58 - 0.54 * clear;
  vec3 veil = fogC * (0.52 + 0.16 * grain) + warm * 0.26 * smoothstep(0.35, 1.0, uv.y) * (0.6 + 0.4 * grain);
  vec3 col = mix(scene, veil, fogAmt);
  // light caught on the fog edge of the wipe: a thin pale rim
  float rim = smoothstep(0.045, 0.0, abs(dm - 0.115 - rag)) * 0.0;

  // drops: a bright pin highlight and a dark edge
  col = mix(col, col * 1.3 + vec3(0.03, 0.035, 0.04), lensDrop * 0.8);
  col += vec3(0.95, 0.97, 1.0) * hiDrops * 0.5;
  col = mix(col, col * 0.7, smoothstep(0.0, 1.0, lensDrop) * 0.0);

  // a few static tiny beads of condensation, pale, everywhere
  vec2 bq = p * 70.0;
  vec2 bid = floor(bq), bf = fract(bq) - 0.5;
  float bh = cf_h2(bid + 9.0);
  float bead = bh > 0.93 ? smoothstep(0.16, 0.05, length(bf - (vec2(cf_h2(bid + 1.0), cf_h2(bid + 2.0)) - 0.5) * 0.5)) : 0.0;
  col += vec3(0.8, 0.88, 1.0) * bead * 0.08 * (1.0 - clear);

  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
