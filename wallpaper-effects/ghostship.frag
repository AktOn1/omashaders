// label: Ghost ship
// hint: a spectral galleon with torn sails drifts through fog on a black sea, a sickly green glow pulsing along its hull and broken in the waves, green sparks rising; the pointer parts the fog around it
// category: Dark tales
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
float gs_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gs_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gs_hash(i), gs_hash(i + vec2(1, 0)), f.x), mix(gs_hash(i + vec2(0, 1)), gs_hash(i + vec2(1, 1)), f.x), f.y);
}
float gs_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * gs_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float gs_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * gs_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float gs_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float gs_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// one torn square sail: s is ship space (x right, y up from the waterline); the sail hangs from a yard at yt down to yb
float gs_sail(vec2 s, float xm, float yb, float yt, float w, float sd) {
  float k = (s.y - yb) / (yt - yb);                                     // 0 at the foot, 1 at the yard
  if (k < 0.0 || k > 1.0) return 0.0;
  float bil = sin(k * 3.1416) * 0.018 + 0.012;                         // the cloth bellies toward the bow
  float hw = w * (0.46 + 0.12 * (1.0 - k)) + 0.0;
  float dx = s.x - xm + bil * 0.0;
  float edge = smoothstep(hw, hw - 0.004, abs(dx));
  // ragged foot and long tears running up from it
  float rag = (gs_noise(vec2(s.x * 55.0, sd)) - 0.4) * 0.30 + 0.05 * (gs_noise(vec2(s.x * 17.0, sd + 4.0)) - 0.5);
  float tear = smoothstep(0.30, 0.15, gs_noise(vec2(s.x * 38.0 + sd, sd * 3.0))) * 0.65;
  float cut = rag + tear;
  float body = smoothstep(cut - 0.015, cut + 0.015, k);
  // holes
  float holes = smoothstep(0.17, 0.26, gs_noise(vec2(s.x * 42.0 + sd, s.y * 42.0 + 3.0 * sd)));
  return edge * body * holes;
}
// the whole ship: x hull, y sails, z glow (gunports + waterline) , w rigging
vec4 gs_ship(vec2 s, out float gl) {
  float hull = 0.0, sail = 0.0, rig = 0.0;
  gl = 0.0;
  // hull: flared bow on the left, tall stern castle on the right
  float top = 0.050 + 0.075 * smoothstep(0.075, 0.185, s.x) - 0.012 * smoothstep(0.0, -0.20, s.x) + 0.020 * smoothstep(-0.13, -0.19, s.x);
  top += 0.004 * sin(s.x * 70.0) * smoothstep(0.1, 0.2, s.x) * 0.0;
  float xl = -0.225 - 0.55 * max(s.y, 0.0) * (0.55 + 0.45 * s.y * 8.0);
  float xr = 0.205 + 0.18 * max(s.y, 0.0) - 0.30 * max(s.y - 0.08, 0.0);
  float inH = step(0.0, s.y) * step(s.y, top) * step(xl, s.x) * step(s.x, xr);
  // stern castle windows
  hull = inH;
  // a rounded poop deck rail and a forecastle rail
  hull = max(hull, step(abs(s.y - (top + 0.006)), 0.0022) * step(0.075, s.x) * step(s.x, xr));
  // bowsprit
  float bsp = gs_seg(s, vec2(-0.215, 0.06), vec2(-0.34, 0.095));
  hull = max(hull, smoothstep(0.0030, 0.0012, bsp));
  // masts, yards
  float masts = 0.0;
  masts = max(masts, step(abs(s.x + 0.145), 0.0026) * step(0.04, s.y) * step(s.y, 0.315));
  masts = max(masts, step(abs(s.x + 0.015), 0.0030) * step(0.05, s.y) * step(s.y, 0.405));
  masts = max(masts, step(abs(s.x - 0.125), 0.0024) * step(0.08, s.y) * step(s.y, 0.300));
  float yards = 0.0;
  yards = max(yards, step(abs(s.y - 0.155), 0.0016) * step(abs(s.x + 0.015), 0.074));
  yards = max(yards, step(abs(s.y - 0.255), 0.0014) * step(abs(s.x + 0.015), 0.055));
  yards = max(yards, step(abs(s.y - 0.345), 0.0013) * step(abs(s.x + 0.015), 0.040));
  yards = max(yards, step(abs(s.y - 0.140), 0.0014) * step(abs(s.x + 0.145), 0.060));
  yards = max(yards, step(abs(s.y - 0.225), 0.0013) * step(abs(s.x + 0.145), 0.045));
  yards = max(yards, step(abs(s.y - 0.140), 0.0013) * step(abs(s.x - 0.125), 0.046));
  yards = max(yards, step(abs(s.y - 0.215), 0.0012) * step(abs(s.x - 0.125), 0.034));
  hull = max(hull, max(masts, yards));
  // sails
  sail = max(sail, gs_sail(s, -0.015, 0.060, 0.155, 0.150, 1.3));
  sail = max(sail, gs_sail(s, -0.015, 0.165, 0.255, 0.112, 2.7));
  sail = max(sail, gs_sail(s, -0.015, 0.265, 0.345, 0.082, 4.1));
  sail = max(sail, gs_sail(s, -0.145, 0.060, 0.140, 0.125, 6.3));
  sail = max(sail, gs_sail(s, -0.145, 0.150, 0.225, 0.095, 8.9));
  sail = max(sail, gs_sail(s, 0.125, 0.085, 0.140, 0.095, 11.2));
  sail = max(sail, gs_sail(s, 0.125, 0.150, 0.215, 0.070, 13.7));
  // rigging: stays and shrouds
  float rg = 1.0;
  rg = min(rg, gs_seg(s, vec2(-0.015, 0.405), vec2(-0.33, 0.092)));
  rg = min(rg, gs_seg(s, vec2(-0.145, 0.315), vec2(-0.31, 0.090)));
  rg = min(rg, gs_seg(s, vec2(-0.015, 0.40), vec2(0.125, 0.30)));
  rg = min(rg, gs_seg(s, vec2(0.125, 0.30), vec2(0.20, 0.125)));
  rg = min(rg, gs_seg(s, vec2(-0.015, 0.40), vec2(-0.145, 0.315)));
  rg = min(rg, gs_seg(s, vec2(-0.015, 0.20), vec2(-0.06, 0.052)));
  rg = min(rg, gs_seg(s, vec2(-0.015, 0.20), vec2(0.03, 0.052)));
  rg = min(rg, gs_seg(s, vec2(-0.145, 0.18), vec2(-0.18, 0.055)));
  rg = min(rg, gs_seg(s, vec2(-0.145, 0.18), vec2(-0.11, 0.055)));
  rig = smoothstep(0.0016, 0.0005, rg);
  // gunports: a row of small squares along the hull side + the waterline glow
  float gp = step(0.35, fract((s.x + 0.2) / 0.034)) * step(fract((s.x + 0.2) / 0.034), 0.75) * step(abs(s.y - 0.020), 0.0065) * step(-0.19, s.x) * step(s.x, 0.17) * inH;
  float wl = step(s.y, 0.006) * inH;
  float wind = step(abs(s.x - 0.165), 0.008) * step(abs(s.y - 0.082), 0.010) * step(0.0, s.y) ;   // stern windows
  gl = max(max(gp, wl * 0.6), wind);
  return vec4(max(hull, rig * 0.9), sail, rig, 0.0);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = onScr ? vec2(m.x * asp, m.y) : vec2(-9.0);
  float t = time;
  vec3 pic = wall(uv);
  float pl = gs_luma(pic);
  const float HZ = 0.64;
  const float SC = 1.28;

  vec3 glowC = vec3(0.30, 0.95, 0.55);                                     // sickly green
  float pulse = 0.62 + 0.38 * sin(t * 0.65) + 0.08 * sin(t * 1.9 + 1.0);

  // ship placement: it rides the swell
  vec2 shipPos = vec2(asp * 0.56, HZ + 0.020);
  float roll = 0.018 * sin(t * 0.42) + 0.006 * sin(t * 0.97);
  float bob = 0.004 * sin(t * 0.55 + 0.5);
  vec2 sp = p - shipPos;
  sp = vec2(sp.x * cos(roll) - (-sp.y) * sin(roll), -(sp.y * cos(roll) + sp.x * sin(roll))) ;   // x right, y up; small roll
  sp.y -= bob;
  sp /= SC;                                                                 // ship space: waterline at y = 0

  // ---- sky: a cold black-teal gradient, a veiled moon and the picture showing faintly
  float up = clamp((HZ - uv.y) / HZ, 0.0, 1.0);
  vec3 sky = mix(vec3(0.060, 0.115, 0.115), vec3(0.008, 0.020, 0.030), smoothstep(0.0, 0.75, up));
  vec2 mo = (p - vec2(asp * 0.24, 0.20));
  float moonD = length(mo);
  float cloud = gs_fbm(vec2(p.x * 1.6 - t * 0.010, p.y * 3.0) + gs_fbm3(p * 2.0 + t * 0.01) * 1.2);
  sky += vec3(0.30, 0.52, 0.44) * exp(-moonD * moonD / 0.050) * 0.26 * (0.5 + cloud);
  sky += vec3(0.60, 0.80, 0.70) * smoothstep(0.040, 0.020, moonD) * 0.22 * (0.35 + 0.65 * smoothstep(0.35, 0.65, cloud));
  sky *= 0.60 + 0.60 * smoothstep(0.25, 0.75, cloud);
  sky += pic * vec3(0.5, 0.7, 0.65) * 0.14;
  // the glow of the ship lights the fog and the sky around it
  vec2 gd = (p - (shipPos + vec2(0.0, -0.12))) * vec2(0.8, 1.2);
  float aura = exp(-dot(gd, gd) / 0.10) * pulse;
  sky += glowC * aura * 0.20;
  vec3 col = sky;

  // ---- ship above the water
  float glA;
  vec4 sh = gs_ship(sp, glA);
  float sailLit = sh.y;
  // sails: a translucent pale cloth lit from within by the green glow, darker toward the foot
  vec3 sailC = mix(vec3(0.10, 0.20, 0.17), vec3(0.45, 0.78, 0.62), clamp(0.35 + 0.45 * pulse, 0.0, 1.0));
  sailC *= 0.55 + 0.6 * smoothstep(0.02, 0.35, sp.y) + 0.0;
  sailC *= 0.85 + 0.3 * gs_noise(vec2(sp.x * 70.0, sp.y * 12.0));        // cloth weave
  col = mix(col, sailC, sailLit * 0.62);
  vec3 hullC = vec3(0.004, 0.011, 0.012) + glowC * 0.020 * pulse;
  col = mix(col, hullC, sh.x);
  float travel = 0.65 + 0.35 * sin(t * 0.8 - sp.x * 7.0);                   // the glow rolls along the hull
  col += glowC * glA * (0.40 + 0.60 * travel) * sh.x;
  // a halo hugging the hull
  vec2 hb = max(abs(sp - vec2(-0.01, 0.045)) - vec2(0.22, 0.040), 0.0);
  float hd = length(hb);
  col += glowC * exp(-hd / 0.045) * 0.55 * pulse * (1.0 - sh.x) * (1.0 - sailLit * 0.6);
  // glowing edge on the upper side of the hull and deck line
  col += glowC * exp(-pow(sp.y / 0.016, 2.0)) * 0.55 * (0.4 + 0.6 * pulse) * sh.x;

  // ---- the black sea and the broken reflection
  float depth = max(uv.y - HZ, 0.0);
  vec3 sea = mix(vec3(0.020, 0.050, 0.055), vec3(0.002, 0.007, 0.010), smoothstep(0.0, 0.30, depth));
  sea += vec3(0.04, 0.09, 0.08) * exp(-depth * 14.0) * 0.7;
  // swell: long soft lines moving toward us
  float swl = gs_fbm3(vec2(p.x * (1.2 + 6.0 * depth), depth * 90.0 - t * 0.25) * vec2(1.0, 1.0));
  sea *= 0.7 + 0.8 * swl;
  // reflection: the ship mirrored, wobbling more with distance, chopped into streaks
  float dd = depth;
  float wob = (gs_noise(vec2(dd * 110.0, t * 0.35)) - 0.5) * 0.045 * smoothstep(0.0, 0.10, dd) + 0.004 * sin(dd * 160.0 - t * 1.4);
  vec2 rq = vec2(p.x - shipPos.x + wob, uv.y - shipPos.y) / SC;              // mirrored about the ship's waterline
  rq.y = abs(rq.y) * 1.15;
  float glR;
  vec4 rf = gs_ship(rq, glR);
  float streak = 0.35 + 0.65 * smoothstep(0.35, 0.7, gs_noise(vec2(p.x * 3.0 + wob * 30.0, dd * 140.0 + t * 0.2)));
  float rmask = step(0.0, uv.y - shipPos.y) * exp(-dd * 4.0) * streak;
  sea = mix(sea, vec3(0.06, 0.16, 0.13) + glowC * 0.14 * pulse, rf.y * rmask * 0.85);
  sea = mix(sea, vec3(0.0), rf.x * rmask * 0.7);
  sea += glowC * glR * rmask * 0.9 * pulse;
  // the glow spilling on the water, in glints
  vec2 hbw = max(abs(vec2(p.x - shipPos.x, uv.y - shipPos.y) / SC - vec2(-0.01, 0.0)) - vec2(0.22, 0.0), 0.0);
  sea += glowC * exp(-length(hbw) / 0.040) * exp(-dd * 9.0) * 0.28 * pulse * (0.5 + 0.5 * streak);
  float glint = smoothstep(0.55, 0.9, gs_noise(vec2(p.x * 30.0 + wob * 100.0, dd * 220.0 - t * 0.3)));
  sea += glowC * glint * exp(-pow((p.x - shipPos.x) / 0.30, 2.0)) * exp(-dd * 5.0) * 0.20 * pulse;
  float wmask = smoothstep(HZ - 0.002, HZ + 0.003, uv.y);
  col = mix(col, sea, wmask);

  // ---- fog: a far bank at the horizon, a low drifting layer, both parting around the pointer
  vec2 toM = p - mp;
  float dm = length(toM);
  float part = smoothstep(0.04, 0.26, dm);                               // 0 at the pointer: the fog is gone
  vec2 push = toM / max(dm, 0.02) * exp(-dm * 5.0) * 0.12;                // and the wisps are pushed away
  vec2 fq = p + push;
  float f1 = gs_fbm(vec2(fq.x * 1.6 - t * 0.020, fq.y * 5.0) + gs_fbm3(fq * 3.0 + vec2(t * 0.02, 0.0)) * 0.9);
  float bank = exp(-pow((uv.y - (HZ - 0.02)) / 0.12, 2.0));
  float fogA = smoothstep(0.25, 0.72, f1) * (0.35 + 0.80 * bank);
  vec2 fq2 = vec2(fq.x * 2.4 + t * 0.035, fq.y * 8.0 + 3.0);
  float f2 = gs_fbm(fq2 + gs_fbm3(fq2 * 0.7 - t * 0.02) * 1.2);
  float low = smoothstep(HZ + 0.02, 0.95, uv.y) * 0.8 + smoothstep(HZ - 0.12, HZ, uv.y) * 0.3;
  float fogB = smoothstep(0.32, 0.80, f2) * low;
  float fog = clamp(fogA * 0.80 + fogB * 0.75, 0.0, 0.95) * part;
  vec3 fogC = mix(vec3(0.30, 0.42, 0.40), vec3(0.50, 0.72, 0.60), clamp(aura * 1.2, 0.0, 1.0));
  fogC += pic * 0.04;
  col = mix(col, fogC * (0.55 + 0.5 * f1), fog * 0.78);
  // a faint halo where the pointer holds the fog open
  col += glowC * exp(-dm * dm / 0.012) * 0.04 * step(0.0, mp.x);

  // ---- green sparks drifting up from the ship
  float sparks = 0.0;
  for (int k = 0; k < 3; k++) {
    float kf = float(k);
    vec2 g = vec2(p.x * (7.0 + 3.0 * kf) + kf * 4.7, uv.y * (5.0 + 2.0 * kf) + t * (0.20 + 0.07 * kf));
    vec2 gi = floor(g), gf = fract(g);
    float h1 = gs_hash(gi + kf * 13.0), h2 = gs_hash(gi + 7.0 + kf * 5.0), h3 = gs_hash(gi + 3.0 - kf);
    vec2 pos = vec2(0.25 + 0.5 * h1 + 0.18 * sin(t * (0.5 + h3) + h2 * 20.0), 0.25 + 0.5 * h2);
    float d = length((gf - pos) * vec2(1.0, 1.0));
    float tw = 0.5 + 0.5 * sin(t * (1.4 + 2.0 * h3) + h1 * 30.0);
    float near = exp(-pow((p.x - shipPos.x) / 0.55, 2.0)) * smoothstep(0.1, 0.45, uv.y) * smoothstep(0.95, 0.55, uv.y);
    sparks += (exp(-d * d / 0.0014) + 0.25 * exp(-d * d / 0.012)) * tw * step(0.55, h3) * (0.12 + 1.1 * near);
  }
  col += mix(glowC, vec3(0.8, 1.0, 0.9), 0.3) * sparks * 0.55 * (0.7 + 0.3 * pulse);

  // vignette
  col *= 1.0 - 0.55 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
