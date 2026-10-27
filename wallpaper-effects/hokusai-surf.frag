// label: Great wave
// hint: indigo ink wells up from the bottom edge and soaks through cream washi paper in a slow tide, pooling dark before it dries; your picture stays visible through the wash like a watermark and the pointer drips ink that blooms into the fibres
// category: Art studio
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
  vec4 tr0;
  vec4 tr1;
  vec4 tr2;
  vec4 tr3;
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
float hk_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hk_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hk_hash(i), hk_hash(i + vec2(1, 0)), f.x), mix(hk_hash(i + vec2(0, 1)), hk_hash(i + vec2(1, 1)), f.x), f.y);
}
float hk_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * hk_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float hk_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// seigaiha: overlapping scales drawn back to front; returns the radius inside the front-most circle (9 = none)
float hk_scale_r(vec2 q) {
  float row0 = floor(q.y / 0.5);
  float best = -1.0e3;
  float out_r = 9.0;
  for (int k = -2; k <= 2; k++) {
    float j = row0 + float(k);
    float cy = j * 0.5;
    float cx = 2.0 * floor((q.x - mod(j, 2.0)) / 2.0 + 0.5) + mod(j, 2.0);
    float r = length(q - vec2(cx, cy));
    if (r < 1.0 && cy > best) { best = cy; out_r = r; }
  }
  return out_r;
}

// the eight most recent pointer positions in pixels, newest first
vec2 hk_tp(int i) {
  if (i == 0) return tr0.xy;
  if (i == 1) return tr0.zw;
  if (i == 2) return tr1.xy;
  if (i == 3) return tr1.zw;
  if (i == 4) return tr2.xy;
  if (i == 5) return tr2.zw;
  if (i == 6) return tr3.xy;
  return tr3.zw;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float b = 1.0 - uv.y;                                   // height above the bottom edge of the sheet
  float t = time;
  vec3 base = wall(uv);
  float L = hk_luma(base);

  // ---------- 1. the sheet: the picture becomes a print on cream washi ----------
  float fib = hk_noise(vec2(p.x * 430.0, p.y * 50.0)) * 0.6 + hk_noise(vec2(p.x * 50.0, p.y * 430.0)) * 0.4;
  float tooth = hk_noise(p * 240.0);
  float bok = smoothstep(-0.05, 0.62, uv.y);              // bokashi: the wipe leaves the top band deeper
  vec3 cream = vec3(0.950, 0.912, 0.796);
  vec3 paper = cream * mix(0.90, 1.0, bok);
  paper *= 0.975 + 0.055 * tooth - 0.045 * (fib - 0.5);
  vec3 printed = base * paper * 1.06 + paper * (0.030 + 0.034 * (1.0 - L));
  vec3 col = mix(base, printed, 0.55);

  // ---------- 2. the wetness field: several wells, all soaking through the same sheet ----------
  float per = 46.0;
  float cy = fract(t / per);
  // the tide: wells up, spreads, pools, dries back, rests for a moment
  float rise = smoothstep(0.00, 0.14, cy) * (1.0 - smoothstep(0.80, 0.98, cy));
  float spread = smoothstep(0.03, 0.34, cy) * (1.0 - smoothstep(0.74, 0.97, cy));
  float wet = max(0.20, rise);                                               // a faint tide stain never dries out

  // the sheet's grain bends the water twice: broad lobes, then capillary fingering
  vec2 wp = vec2(p.x, b);
  float w1 = hk_fbm(wp * 1.6 + vec2(3.1, t * 0.010));
  float w2 = hk_fbm(wp * 1.6 + vec2(9.7, 5.4 + t * 0.008));
  vec2 wm = wp + (vec2(w1, w2) - 0.5) * 0.10;                                // a gentler warp for the side wells
  vec2 wq = wp + (vec2(w1, w2) - 0.5) * 0.26;
  float f1 = hk_noise(wq * 6.4 + 21.0);
  float f2 = hk_noise(wq * 6.4 + 41.0);
  wq += (vec2(f1, f2) - 0.5) * 0.090;                                        // fingers creeping along the fibres
  wq.y -= (hk_noise(vec2(wq.x * 62.0, wq.y * 2.8)) - 0.5) * 0.034 * wet;     // single threads run ahead of the front

  // every source is "how far the water has reached minus how far away you are"
  float lobeB = 0.15 + 1.85 * hk_fbm(vec2(wq.x * 2.10 + 21.0, t * 0.011));   // the bottom edge, the main well
  float Wb = (0.030 + 0.108 * spread) * lobeB - wq.y;
  float lobeL = -0.80 + 2.50 * hk_fbm(vec2(wm.y * 2.1 + 51.0, t * 0.009));   // the left edge drinks only in stretches
  float Wl = (0.008 + 0.090 * spread) * lobeL - wm.x;
  float lobeR = -0.90 + 2.50 * hk_fbm(vec2(wm.y * 2.4 + 77.0, 3.0 + t * 0.008));
  float Wr = (0.006 + 0.084 * spread) * lobeR - (asp - wm.x);                // and so does the right
  // two blots dropped into the middle of the sheet, each breathing at its own pace
  float r1 = (0.030 + 0.098 * smoothstep(0.08, 0.58, cy)) * (1.0 - smoothstep(0.66, 0.93, cy));
  float Wc1 = r1 - length((wq - vec2(asp * 0.735, 0.430)) * vec2(1.0, 1.30));
  float r2 = (0.022 + 0.070 * smoothstep(0.20, 0.70, cy)) * (1.0 - smoothstep(0.72, 0.95, cy));
  float Wc2 = r2 - length((wq - vec2(asp * 0.155, 0.545)) * vec2(1.25, 1.0));

  // ---------- 3. how the ink sits in the paper ----------
  // the front frays: two scales of noise bend the whole wet line, so it lobes, forks and sheds islands
  float blotch = hk_fbm(wq * 3.6 + 8.0);
  float grain2 = hk_fbm(wq * 8.2 + 60.0);
  float pert = ((blotch - 0.5) * 0.090 + (grain2 - 0.5) * 0.034) * wet;
  float W = max(max(Wb, max(Wl, Wr)) + pert, max(Wc1, Wc2) + pert * 0.20);  // a blot keeps its round shape better than a front
  // the wet line is fairly definite, with a faint damp halo ahead of it that the fibres carried further
  float a = smoothstep(-0.013, 0.013, W);
  float halo = smoothstep(-0.090, -0.004, W) * (1.0 - a);
  float dep = smoothstep(0.004, 0.068, W + (blotch - 0.5) * 0.050);
  float island = smoothstep(0.50, 0.68, grain2);                             // dry islands the ink skipped
  float pooled = smoothstep(0.47, 0.29, grain2);                             // hollows where the pigment settled
  a *= 1.0 - 0.60 * island * smoothstep(0.015, 0.090, W);
  // threads of washi lying across the sheet that the ink runs along instead of into
  float foam = smoothstep(0.66, 0.96, hk_noise(vec2(wq.x * 22.0, wq.y * 170.0)));
  a *= 1.0 - 0.13 * foam * smoothstep(0.0, 0.05, W);

  float mottle = 0.66 + 0.34 * hk_fbm(vec2(p.x * 4.0, b * 5.5) + 2.0);       // the wash is never even
  mottle *= 1.0 - 0.20 * (fib - 0.35);                                       // fibres drink unevenly
  float ink = (a * (0.22 + 0.70 * dep + 0.45 * pooled * dep) + halo * 0.17) * mottle;

  // ---------- 4. the pointer drips ink that blooms into the fibres ----------
  float drop = 0.0, dropRim = 0.0;
  if (mpx.x > -5000.0) {
    for (int i = 0; i < 8; i++) {
      vec2 q = hk_tp(i);
      if (q.x < 1.0 || q.y < 1.0) continue;                                  // slot not fed yet
      vec2 d = p - q / res.y;
      float rad = 0.016 + 0.0105 * float(i);                                 // older drops have bled further out
      if (dot(d, d) > (rad * 2.2) * (rad * 2.2)) continue;
      float dd = length(d) + (hk_noise(d * 26.0 + float(i) * 7.0) - 0.5) * 0.013;
      float fade = 1.0 - 0.090 * float(i);
      float core = 1.0 - smoothstep(rad * 0.30, rad, dd);
      float halo = 1.0 - smoothstep(rad * 0.75, rad * 2.1, dd);              // the bloom creeping into the fibres
      drop = max(drop, (core * 0.80 + halo * 0.30) * fade);
      dropRim = max(dropRim, exp(-pow((dd - rad * 1.10) / (rad * 0.60), 2.0)) * fade * 0.45);
    }
    vec2 dm = p - mpx / res.y;                                               // the fresh drop under the pointer
    float dmd = length(dm) + (hk_noise(dm * 34.0 + 13.0) - 0.5) * 0.010;
    drop = max(drop, (1.0 - smoothstep(0.006, 0.017, dmd)) * 0.88
                     + (1.0 - smoothstep(0.013, 0.036, dmd)) * 0.26);
    dropRim = max(dropRim, exp(-pow((dmd - 0.019) / 0.011, 2.0)) * 0.45);
  }
  ink = max(ink, drop * 0.72 * mottle);

  // seigaiha scales: faint dry-paper arcs the wash reserves where it lies thickest
  vec2 sq = vec2(wp.x * 7.0 + (w1 - 0.5) * 1.1, wp.y * 7.0 - t * 0.012);
  float sr = hk_scale_r(sq);
  float ring = sr < 1.0 ? 1.0 - smoothstep(0.0, 0.34, abs(fract(sr * 3.0 + 0.5) - 0.5) * 2.0) : 0.0;
  float scales = ring * smoothstep(0.62, 0.95, dep) * spread;
  ink *= 1.0 - 0.30 * scales;

  // ---------- 5. colour: the ink is a glaze, so the print keeps showing through it ----------
  vec3 indigo = vec3(0.062, 0.130, 0.330);
  float inkA = clamp(ink, 0.0, 0.88);
  col = col * mix(vec3(1.0), vec3(0.14, 0.27, 0.74), inkA) + indigo * (inkA * (0.30 + 0.60 * (1.0 - L)));

  // where the water stopped it left its pigment behind, but only along some stretches of the front
  float rimMask = smoothstep(0.38, 0.78, hk_fbm(wq * 2.6 + 15.0));
  float rimA = (exp(-pow((W - 0.013) / 0.017, 2.0)) * a * rimMask * rise) * 0.80 + dropRim * 0.40;
  col = col * mix(vec3(1.0), vec3(0.26, 0.40, 0.80), rimA) + indigo * (0.26 * rimA);

  // the foam speckle reads as bare washi, lit the way the picture under it is lit
  col = mix(col, paper * (0.30 + 0.70 * L), foam * a * 0.05);

  // ---------- 6. print finish ----------
  col *= 0.985 + 0.030 * tooth - 0.022 * (fib - 0.5);
  col *= 1.0 - 0.10 * pow(length((uv - 0.5) * vec2(1.0, 1.06)), 2.6);
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
