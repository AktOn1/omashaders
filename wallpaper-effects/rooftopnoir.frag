// label: Rooftop noir
// hint: a rainy city rooftop at night: a water tower and chimney in silhouette, a flickering neon letter behind, a searchlight sweeping the clouds; the pointer swings the beam toward it
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
float rn_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rn_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rn_hash(i), rn_hash(i + vec2(1, 0)), f.x), mix(rn_hash(i + vec2(0, 1)), rn_hash(i + vec2(1, 1)), f.x), f.y);
}
float rn_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * rn_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float rn_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * rn_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float rn_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float rn_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// skyline: returns top edge (y) of the building under x, for a layer
float rn_top(float x, float cw, float base, float var, float seed) {
  float id = floor(x / cw);
  float h = rn_hash(vec2(id, seed));
  float top = base - var * h * h;
  return top;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);
  float pl = rn_luma(pic);

  // ---- neon letter: flickers (an H on a far roof, a rectangular strip of tube light)
  vec2 sgn = vec2(asp * 0.36, 0.45);
  float fa = rn_noise(vec2(t * 7.0, 1.0));
  float fb = rn_noise(vec2(t * 3.0, 9.0));
  float stutter = step(0.78, rn_noise(vec2(floor(t * 2.2), 4.0)));              // now and then it stutters
  float neon = mix(1.0, 0.25 + 0.75 * step(0.45, fa), stutter);
  float leftTube = mix(1.0, step(0.35, fb), stutter);                           // one stroke drops out first
  neon *= 0.92 + 0.08 * sin(t * 50.0) * stutter;

  // ---- searchlight
  vec2 lo = vec2(asp * 0.60, 0.80);                                             // lamp, behind the far roofs
  float ang = -1.5708 + 0.62 * sin(t * 0.33) + 0.12 * sin(t * 0.91 + 1.0);
  if (onScr) {
    vec2 dm = mp - lo;
    float ta = atan(dm.y, dm.x);
    ta = clamp(ta, -2.85, -0.29);
    ang = mix(ang, ta, 0.65);
  }
  vec2 bd = vec2(cos(ang), sin(ang));
  vec2 rel = p - lo;
  float along = dot(rel, bd);
  float perp = dot(rel, vec2(-bd.y, bd.x));

  // ---- sky: slate cloud lit amber from the city below, a beam spot where the light ends in the cloud
  float up = clamp((0.80 - uv.y) / 0.80, 0.0, 1.0);
  vec2 cq = vec2(p.x * 1.1 - t * 0.012, p.y * 2.2);
  vec2 warp = vec2(rn_fbm3(cq + t * 0.01), rn_fbm3(cq + 7.0 - t * 0.008));
  float cl = rn_fbm(cq * 1.2 + warp * 1.3);
  vec3 skyLo = vec3(0.30, 0.20, 0.17);
  vec3 skyMid = vec3(0.075, 0.095, 0.13);
  vec3 skyHi = vec3(0.020, 0.030, 0.050);
  vec3 sky = mix(skyLo, skyMid, smoothstep(0.0, 0.40, up));
  sky = mix(sky, skyHi, smoothstep(0.35, 1.0, up));
  sky *= 0.55 + 0.85 * smoothstep(0.2, 0.8, cl);
  sky += pic * vec3(0.55, 0.6, 0.75) * 0.12 * (0.5 + up);                       // the picture shows through the murk
  // the beam ends in the cloud base
  float Lc = (lo.y - 0.20) / max(-bd.y, 0.2);
  vec2 spotC = lo + bd * Lc;
  vec2 sd = (p - spotC) * vec2(1.0, 1.0 / max(abs(bd.y), 0.3) * 1.0);
  float spot = exp(-dot(sd, sd) / 0.012) * (0.45 + 0.9 * smoothstep(0.25, 0.7, cl));
  sky += vec3(0.85, 0.88, 0.80) * spot * 0.55;
  vec3 col = sky;
  // the beam in rain mist
  float spread = 0.018 + max(along, 0.0) * 0.050;
  float beam = exp(-pow(perp / spread, 2.0)) * smoothstep(0.0, 0.10, along) * smoothstep(Lc + 0.15, Lc - 0.1, along);
  float mist = 0.55 + 0.9 * rn_fbm3(vec2(p.x * 3.0, p.y * 5.0 - t * 0.12));
  col += vec3(0.80, 0.86, 0.80) * beam * mist * 0.30 * (0.4 + 0.6 * smoothstep(0.0, 0.4, 0.80 - uv.y + 0.2));

  // ---- neon halo on the rain haze (behind everything dark)
  vec2 nr = (p - sgn) * vec2(1.0, 0.8);
  float halo = exp(-dot(nr, nr) / 0.02) * 0.34 + exp(-dot(nr, nr) / 0.12) * 0.12;
  vec3 neonC = vec3(1.0, 0.18, 0.40);
  col += neonC * halo * neon * (0.6 + 0.4 * rn_fbm3(p * 6.0));

  // ---- far skyline (hazy, lit from below), a lit window grid
  float cwF = 0.045;
  float topF = rn_top(p.x, cwF, 0.745, 0.13, 1.0);
  float inF = step(topF, uv.y);
  vec3 farC = mix(vec3(0.07, 0.065, 0.085), skyLo * 0.5, 0.35) * (0.8 + 0.4 * rn_noise(p * 40.0));
  vec2 wgF = vec2(p.x / 0.0075, uv.y / 0.011);
  vec2 wiF = floor(wgF);
  float litF = step(0.80, rn_hash(wiF + 3.0)) * step(0.25, fract(wgF.x)) * step(fract(wgF.x), 0.75) * step(0.3, fract(wgF.y)) * step(fract(wgF.y), 0.75);
  litF *= 0.7 + 0.3 * sin(t * 0.4 + rn_hash(wiF) * 40.0);
  farC += vec3(1.0, 0.72, 0.38) * litF * 0.45;
  col = mix(col, farC, inF);
  // the searchlight's own lamp, a little glow at the horizon
  col += vec3(0.9, 0.95, 0.85) * exp(-dot(rel, rel) / 0.0012) * 0.5;

  // ---- the neon building and the sign
  float bx0 = sgn.x - 0.22, bx1 = sgn.x + 0.22;
  float bTop = 0.60;
  float inB = step(bx0, p.x) * step(p.x, bx1) * step(bTop, uv.y);
  vec3 bC = vec3(0.020, 0.022, 0.032);
  // neon spill on the building face
  vec2 sr = (p - sgn) * vec2(1.0, 1.2);
  bC += neonC * exp(-dot(sr, sr) / 0.008) * 0.12 * neon;
  vec2 wgB = vec2(p.x / 0.014, uv.y / 0.020);
  vec2 wiB = floor(wgB);
  float litB = step(0.84, rn_hash(wiB + 11.0)) * step(0.2, fract(wgB.x)) * step(fract(wgB.x), 0.8) * step(0.25, fract(wgB.y)) * step(fract(wgB.y), 0.8);
  bC += vec3(1.0, 0.68, 0.30) * litB * 0.5;
  col = mix(col, bC, inB);
  // the letter H: three tubes, with two small supports
  float hw = 0.060, hh = 0.095;
  vec2 q = p - sgn;
  float dL = rn_seg(q, vec2(-hw, -hh), vec2(-hw, hh));
  float dR = rn_seg(q, vec2(hw, -hh), vec2(hw, hh));
  float dM = rn_seg(q, vec2(-hw, 0.0), vec2(hw, 0.0));
  float tube = 0.0, glow = 0.0;
  float eL = leftTube, eR = 1.0, eM = mix(1.0, step(0.2, fb + 0.2), stutter);
  tube += eL * smoothstep(0.0058, 0.0030, dL) + eR * smoothstep(0.0058, 0.0030, dR) + eM * smoothstep(0.0058, 0.0030, dM);
  glow += eL * exp(-dL / 0.012) + eR * exp(-dR / 0.012) + eM * exp(-dM / 0.012);
  col += neonC * glow * 0.42 * neon;
  col = mix(col, mix(neonC, vec3(1.0, 0.85, 0.88), 0.7), clamp(tube, 0.0, 1.0) * neon);
  // sign frame legs

  // ---- mid roof silhouettes: water tower (right) and chimney (left)
  vec3 silC = vec3(0.006, 0.008, 0.013);
  // the right mid building + water tower
  float wtx = asp * 0.775;
  float roofR = 0.77;
  float inR = step(wtx - 0.16, p.x) * step(p.x, wtx + 0.19) * step(roofR, uv.y);
  float tw = 0.065, tb = 0.60, tt = 0.675;                                          // tank bottom/top
  float tank = step(abs(p.x - wtx), tw) * step(tb, uv.y) * step(uv.y, tt);
  float cy = (tb - uv.y) / 0.050;                                                   // cone above tank
  float cone = step(0.0, cy) * step(cy, 1.0) * step(abs(p.x - wtx), tw * 1.08 * (1.0 - cy));
  float legs2 = 0.0;
  for (int k = 0; k < 3; k++) {
    float lx = wtx + (float(k) - 1.0) * tw * 0.8;
    legs2 += step(abs(p.x - lx - (float(k) - 1.0) * 0.012 * (uv.y - tt) / 0.1), 0.0034) * step(tt, uv.y) * step(uv.y, roofR);
  }
  float hoops = (step(abs(uv.y - 0.628), 0.0016) + step(abs(uv.y - 0.655), 0.0016)) * step(abs(p.x - wtx), tw + 0.004);
  float cross = step(abs(uv.y - (tt + 0.045)), 0.0016) * step(abs(p.x - wtx), tw * 0.8) * step(tt, uv.y);
  float wt = max(max(tank, cone), max(clamp(legs2, 0.0, 1.0), cross));
  wt = max(wt, step(abs(p.x - wtx), 0.0014) * step(tb - 0.062, uv.y) * step(uv.y, tb - 0.05));
  col = mix(col, bC * 0.7, inR);
  // rim light from the neon on the tank's left side
  float rim = smoothstep(0.012, 0.0, p.x - (wtx - tw)) * wt * neon;
  vec3 wtC = silC + neonC * 0.10 * rim;
  col = mix(col, wtC, wt);
  col += vec3(0.03, 0.02, 0.025) * hoops * tank;
  // building body silhouette (darker than the far ones)
  col = mix(col, vec3(0.012, 0.014, 0.022) + neonC * 0.012 * neon, inR);
  float litR = step(0.9, rn_hash(floor(vec2(p.x / 0.018, uv.y / 0.026)) + 5.0)) * step(0.2, fract(p.x / 0.018)) * step(fract(p.x / 0.018), 0.8) * step(0.25, fract(uv.y / 0.026)) * step(fract(uv.y / 0.026), 0.8);
  col += vec3(1.0, 0.7, 0.32) * litR * inR * 0.45;

  // the left chimney, on the near roof, with a thin curl of smoke
  float chx = asp * 0.115;
  float chimney = step(abs(p.x - chx), 0.026) * step(0.50, uv.y) + step(abs(p.x - chx), 0.034) * step(abs(uv.y - 0.50), 0.012);
  chimney = clamp(chimney, 0.0, 1.0);
  float sy = clamp((0.49 - uv.y) / 0.40, 0.0, 1.0);
  float smokeX = chx + sin(sy * 5.0 + t * 0.35) * 0.04 * sy + (rn_noise(vec2(sy * 4.0, t * 0.1)) - 0.5) * 0.05 * sy;
  float smoke = exp(-pow((p.x - smokeX) / (0.018 + 0.07 * sy), 2.0)) * (1.0 - sy) * step(uv.y, 0.49) * (0.4 + 0.8 * rn_fbm3(vec2(p.x * 8.0, uv.y * 6.0 - t * 0.2)));
  col = mix(col, col * 0.55 + vec3(0.05, 0.06, 0.08) * 0.3, clamp(smoke, 0.0, 1.0) * 0.55);
  col = mix(col, silC + neonC * 0.05 * neon * smoothstep(0.7, 0.4, uv.y), chimney);
  // mortar hints on the chimney
  col += vec3(0.02) * chimney * step(0.5, fract(uv.y * 40.0)) * step(abs(p.x - chx), 0.026) * 0.3;

  // ---- the near roof: wet tar, a parapet, neon reflected in puddles
  float roofY = 0.845;
  float onRoof = smoothstep(roofY - 0.002, roofY + 0.002, uv.y);
  float ry = (uv.y - roofY) / (1.0 - roofY);
  vec3 tar = vec3(0.012, 0.014, 0.020) + vec3(0.050, 0.035, 0.030) * (1.0 - ry) * (1.0 - ry);   // sodium haze caught by the wet tar
  float rip = rn_noise(vec2(p.x * 22.0, ry * 14.0 + t * 0.2));
  float pud = smoothstep(0.38, 0.52, rn_fbm3(vec2(p.x * 2.2, ry * 3.0 + 2.0)));
  float refl = exp(-pow((p.x - sgn.x) / (0.10 + 0.07 * ry), 2.0)) * neon * (0.4 + 0.6 * rip) * (0.35 + 0.65 * pud);
  tar += neonC * refl * 0.35 * (1.0 - ry * 0.6);
  tar += vec3(0.70, 0.78, 0.74) * pud * 0.025 * (0.5 + rip);
  col = mix(col, tar, onRoof);
  // parapet edge: a thin cold highlight
  col += vec3(0.30, 0.35, 0.40) * smoothstep(0.003, 0.0, abs(uv.y - roofY)) * 0.18;
  // rain rings on the puddles
  float ringsT = 0.0;
  for (int k = 0; k < 3; k++) {
    float kf = float(k);
    vec2 g = vec2(p.x * (7.0 + kf * 3.0) + kf * 2.3, ry * (3.0 + kf) );
    vec2 gi = floor(g), gf = fract(g) - 0.5;
    float ph = fract(t * (0.5 + 0.2 * kf) + rn_hash(gi + kf * 7.0));
    float rr = ph * 0.45;
    float ring = exp(-pow((length(gf * vec2(1.0, 0.45)) - rr) / 0.025, 2.0)) * (1.0 - ph) * step(0.55, rn_hash(gi + kf));
    ringsT += ring;
  }
  col += vec3(0.55, 0.65, 0.70) * ringsT * onRoof * pud * 0.10;
  // the sign mirrored in the puddles (a compressed, wobbling reflection)
  vec2 rq2 = vec2(p.x + (rn_noise(vec2(p.x * 60.0, ry * 30.0 + t * 0.5)) - 0.5) * 0.012, roofY - (uv.y - roofY) * 4.2);
  vec2 qr = rq2 - sgn;
  float rd = min(min(rn_seg(qr, vec2(-hw, -hh), vec2(-hw, hh)) + (1.0 - eL) * 1.0, rn_seg(qr, vec2(hw, -hh), vec2(hw, hh))), rn_seg(qr, vec2(-hw, 0.0), vec2(hw, 0.0)) + (1.0 - eM) * 1.0);
  float reflL = (smoothstep(0.010, 0.002, rd) * 0.9 + exp(-rd / 0.02) * 0.35) * pud * neon * onRoof * (1.0 - ry * 0.5);
  col += neonC * reflL * 0.9;
  // amber window streaks in the wet roof
  float wstr = rn_noise(vec2(p.x * 90.0, 3.0)) * exp(-pow((p.x - sgn.x) / 0.20, 2.0)) * pud * onRoof * 0.04;
  col += vec3(1.0, 0.65, 0.3) * wstr;
  // a thin railing along the parapet, right half
  float railY = roofY - 0.040;
  float post = step(abs(fract(p.x / 0.055) - 0.5), 0.014) * step(railY, uv.y) * step(uv.y, roofY);
  float bar = step(abs(uv.y - railY), 0.0016) + step(abs(uv.y - (railY + 0.020)), 0.0012);
  float rail = clamp(post + bar, 0.0, 1.0) * smoothstep(asp * 0.50, asp * 0.56, p.x) * step(uv.y, roofY + 0.001);
  col = mix(col, vec3(0.004, 0.005, 0.008) + neonC * 0.02 * neon, rail);

  // ---- rain: slanted streaks, two thin layers; brighter in the beam and near the neon
  float rain = 0.0;
  for (int k = 0; k < 2; k++) {
    float kf = float(k);
    vec2 rq = vec2(p.x * (60.0 + 34.0 * kf) + uv.y * (10.0 + 6.0 * kf), uv.y * (4.0 + 2.0 * kf) - t * (2.2 + 0.8 * kf));
    rq.y += rn_hash(vec2(floor(rq.x), kf)) * 20.0;
    float rid = floor(rq.x);
    float rh = rn_hash(vec2(rid, kf + 3.0));
    float streak = smoothstep(0.9, 1.0, fract(rq.y + rh)) * smoothstep(0.35, 0.0, abs(fract(rq.x) - 0.5)) * step(0.5, rh);
    rain += streak * (0.5 - 0.2 * kf);
  }
  col += vec3(0.55, 0.62, 0.70) * rain * (0.08 + 0.35 * beam + 0.9 * halo * 0.3);

  // vignette
  col *= 1.0 - 0.5 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
