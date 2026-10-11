// label: Wasteland dusk
// hint: the ruins of a city against a dust-orange sunset, a radio tower with a slowly blinking red light, grey ash drifting down like snow and a long cracked highway in front; ash swirls around the pointer
// category: Wastelands
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
float wd_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 wd_hash2(vec2 p) { return vec2(wd_hash(p), wd_hash(p + 41.7)); }
float wd_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wd_hash(i), wd_hash(i + vec2(1, 0)), f.x), mix(wd_hash(i + vec2(0, 1)), wd_hash(i + vec2(1, 1)), f.x), f.y);
}
float wd_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * wd_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float wd_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * wd_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float wd_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 wd_rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

const float WD_HZ = 0.66;

float wd_seg(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  return smoothstep(w + 0.0011, w - 0.0004, d);
}

// height of the ruined skyline at x (0 = nothing): towers of different widths, broken tops, rubble gaps, a few stubs of upper floors
float wd_skyline(float x, float scale, float seed, float tallest) {
  float cell = floor(x * scale);
  float f = fract(x * scale);
  float hs = wd_hash(vec2(cell, seed));
  float h = 0.035 + tallest * pow(hs, 1.7);
  float rub = wd_hash(vec2(cell * 1.7, seed + 5.0));
  if (rub < 0.13) h *= 0.18;                                                  // collapsed into rubble
  float slope = (wd_hash(vec2(cell, seed + 9.0)) - 0.5) * 2.4;
  h += slope * (f - 0.5) * 0.045 * step(0.3, hs);                            // a sheared, broken roof line
  float up = step(0.62, wd_hash(vec2(cell, seed + 13.0)));
  h += up * step(0.22, f) * step(f, 0.72) * (0.03 + 0.05 * wd_hash(vec2(cell, seed + 17.0)));   // a surviving upper block
  h += (wd_noise(vec2(x * scale * 11.0, seed)) - 0.5) * 0.012;               // chipped edge
  // a notch torn out of some of the taller towers
  float notch = step(0.72, wd_hash(vec2(cell, seed + 21.0))) * smoothstep(0.30, 0.34, f) * smoothstep(0.62, 0.58, f);
  return max(h - notch * 0.06, 0.0);
}

// one layer of ash in the sky: soft flakes falling with a sway, near layers bigger and quicker
float wd_ash(vec2 p, float sc, float spd, float seed, float t, float thr) {
  vec2 q = vec2(p.x * sc, p.y * sc - t * spd);
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 h = wd_hash2(cell + seed);
  float on = step(thr, h.x);
  vec2 off = (wd_hash2(cell + seed + 7.0) - 0.5) * 0.36;
  off.x += 0.10 * sin(t * (0.5 + h.y) + h.x * 20.0);
  off.y += 0.06 * sin(t * (0.7 + h.x) + h.y * 11.0);
  vec2 d = f - off;
  float ang = h.y * 6.283 + t * 0.2 * (h.x - 0.5);
  d = wd_rot(d, ang);
  d.x *= 0.65 + 0.9 * h.y;                                                     // flakes are not round
  float rad = 0.08 + 0.08 * wd_hash(cell + seed + 3.0);
  return on * smoothstep(rad, rad * 0.25, length(d)) * (0.45 + 0.55 * wd_hash(cell + seed + 5.0));
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  vec2 sun = vec2(asp * 0.30, WD_HZ - 0.035);
  float tx = asp * 0.74;
  float towerTop = 0.12;
  vec3 horC = vec3(1.0, 0.56, 0.24);

  // ---- sky: brown-grey dust overhead, burning orange at the horizon, the sun a dim disc in the murk
  float g = clamp(uv.y / WD_HZ, 0.0, 1.0);
  vec3 col = mix(vec3(0.16, 0.115, 0.105), vec3(0.50, 0.27, 0.16), smoothstep(0.0, 0.62, g));
  col = mix(col, horC, smoothstep(0.55, 1.0, g) * 0.92);
  vec2 sd = (p - sun) * vec2(0.65, 1.0);
  col += vec3(1.0, 0.50, 0.20) * exp(-dot(sd, sd) / 0.10) * 0.45;
  col += vec3(1.0, 0.70, 0.40) * exp(-dot(sd, sd) / 0.006) * 0.30;
  // dust bands, thick streaks laid flat, drifting slowly sideways
  vec2 dq = vec2(p.x * 1.1 + t * 0.012, uv.y * 7.0);
  float dust = wd_fbm(dq + wd_fbm3(dq * 0.7) * 1.3);
  float band = smoothstep(0.40, 0.75, dust) * smoothstep(0.02, 0.35, uv.y) * smoothstep(WD_HZ + 0.02, 0.45, uv.y);
  col = mix(col, vec3(0.34, 0.20, 0.14) + horC * 0.20 * smoothstep(0.3, 0.66, uv.y), band * 0.50);
  col = mix(col, vec3(0.96, 0.62, 0.34), band * 0.18 * exp(-pow((p.x - sun.x) / 0.8, 2.0)) * smoothstep(0.3, 0.66, uv.y));
  col += w * 0.05;                                                                // the picture, as a faint ghost in the murk
  // sun disc: a flat dull coin in the haze
  col = mix(col, vec3(1.0, 0.80, 0.55), smoothstep(0.052, 0.042, length(p - sun)) * 0.55);

  // ---- far ruins (hazy), then the radio tower, then the near ruins (dark)
  float baseY = WD_HZ + 0.012;
  float hF = wd_skyline(p.x, 17.0, 3.0, 0.30);
  float inF = smoothstep(baseY - hF - 0.0012, baseY - hF + 0.0012, uv.y) * step(uv.y, baseY + 0.004);
  vec3 farC = mix(vec3(0.34, 0.17, 0.12), horC * 0.75, 0.35 + 0.35 * smoothstep(baseY - 0.25, baseY, uv.y));
  col = mix(col, farC, inF * 0.92);

  // radio tower: a thin lattice mast with guy wires, leaning a little, standing on the horizon
  float lean = (uv.y - towerTop) * 0.018;
  float hwT = mix(0.0030, 0.0200, clamp((uv.y - towerTop) / (baseY - towerTop), 0.0, 1.0));
  float ux = (p.x - tx - lean) / hwT;
  float inT = step(abs(ux), 1.0) * step(towerTop, uv.y) * step(uv.y, baseY + 0.004);
  float v = uv.y * 46.0;
  float dT = min(abs(fract(v + ux * 0.5) - 0.5), abs(fract(v - ux * 0.5) - 0.5));
  float lat = max(step(0.78, abs(ux)), max(smoothstep(0.12, 0.07, dT) * 0.95, smoothstep(0.43, 0.48, abs(fract(v) - 0.5)) * 0.7)) * inT;
  float spike = step(abs(p.x - tx - lean * 0.2), 0.0012) * step(0.07, uv.y) * step(uv.y, towerTop + 0.002);
  float arm1 = step(abs(p.x - tx - lean), 0.020) * step(abs(uv.y - 0.205), 0.0022);
  float arm2 = step(abs(p.x - tx - lean), 0.034) * step(abs(uv.y - 0.300), 0.0022);
  float dish = smoothstep(0.011, 0.008, length((p - vec2(tx + 0.038, 0.300)) * vec2(1.0, 1.6)));
  float guy = max(wd_seg(p, vec2(tx, 0.16), vec2(tx - 0.30, baseY + 0.02), 0.0009), wd_seg(p, vec2(tx, 0.16), vec2(tx + 0.30, baseY + 0.02), 0.0009));
  guy = max(guy, max(wd_seg(p, vec2(tx, 0.34), vec2(tx - 0.20, baseY + 0.02), 0.0008), wd_seg(p, vec2(tx, 0.34), vec2(tx + 0.20, baseY + 0.02), 0.0008)));
  float tow = max(max(lat, spike), max(max(arm1, arm2), max(dish, guy * 0.55)));
  vec3 towC = mix(vec3(0.060, 0.030, 0.026), vec3(0.20, 0.09, 0.06), smoothstep(0.30, 0.66, uv.y));
  towC += horC * 0.18 * smoothstep(0.0, -1.0, ux) * 0.5;                          // sun-side rim light
  col = mix(col, towC, tow);

  float hN = wd_skyline(p.x + 3.3, 9.5, 11.0, 0.19);
  float inN = smoothstep(baseY + 0.012 - hN - 0.0012, baseY + 0.012 - hN + 0.0012, uv.y) * step(uv.y, baseY + 0.03);
  vec3 nearC = mix(vec3(0.045, 0.028, 0.026), vec3(0.12, 0.060, 0.045), smoothstep(baseY - 0.2, baseY + 0.01, uv.y));
  // light on the broken west edges of the near towers
  float cellN = floor((p.x + 3.3) * 9.5);
  float fN = fract((p.x + 3.3) * 9.5);
  nearC += horC * 0.22 * smoothstep(0.10, 0.0, fN) * smoothstep(baseY + 0.012 - hN, baseY + 0.012 - hN + 0.05, uv.y);
  col = mix(col, nearC, inN);

  // the blinking red light on the tower's tip, and a smaller one half way down
  float pulse = fract(t / 2.8);
  float blink = exp(-pow((pulse - 0.12) / 0.06, 2.0)) + 0.55 * exp(-pow((pulse - 0.30) / 0.05, 2.0));
  float blink2 = exp(-pow((fract(t / 2.8 + 0.5) - 0.12) / 0.06, 2.0));
  vec2 lampT = vec2(tx + lean * 0.2, 0.074);
  vec2 lampM = vec2(tx + (0.30 - towerTop) * 0.018, 0.30);
  float dL = length(p - lampT), dL2 = length(p - lampM);
  vec3 red = vec3(1.0, 0.18, 0.10);
  col += red * (0.05 + 0.95 * blink) * (exp(-dL / 0.010) * 0.9 + exp(-dL / 0.060) * 0.30 + exp(-dL / 0.22) * 0.07);
  col += red * blink2 * 0.5 * (exp(-dL2 / 0.007) * 0.8 + exp(-dL2 / 0.035) * 0.15);
  col = mix(col, vec3(1.0, 0.55, 0.45), smoothstep(0.0034, 0.0020, dL) * (0.35 + 0.65 * blink));

  // ---- the ground: ochre dust to the horizon, the long highway in perspective, cracked and faded
  if (uv.y > baseY + 0.002) {
    float z = max(uv.y - baseY, 0.0005);
    float dn = z / (1.0 - baseY);
    vec3 gr = mix(vec3(0.46, 0.25, 0.13), vec3(0.13, 0.085, 0.07), pow(dn, 0.55));
    float gn = wd_fbm3(vec2((p.x - 0.5 * asp) * 2.0 / (z + 0.02) * 0.30 + 3.0, 0.20 / (z + 0.02)));
    gr *= 0.70 + 0.55 * gn;
    gr += horC * 0.10 * exp(-dn * 9.0) * (0.4 + 0.6 * exp(-pow((p.x - sun.x) / 0.9, 2.0)));
    // the road
    float cx = asp * 0.46 - z * 0.42;
    float hw = 0.010 + z * 1.45;
    float uu = (p.x - cx) / hw;
    float vv = 1.0 / (z + 0.015);
    float edgeN = (wd_noise(vec2(vv * 1.5, 3.0)) - 0.5) * 0.16;
    float onRoad = smoothstep(1.0 + edgeN + 0.02, 1.0 + edgeN - 0.02, abs(uu));
    vec3 asph = mix(vec3(0.30, 0.20, 0.15), vec3(0.16, 0.115, 0.10), pow(dn, 0.6));
    asph *= 0.75 + 0.5 * wd_fbm3(vec2(uu * 6.0, vv * 1.2));
    // the western sheen of the dusk on the asphalt
    asph += horC * 0.38 * exp(-dn * 6.0) * (0.3 + 0.7 * exp(-pow((p.x - sun.x) / 1.0, 2.0)));
    // cracks: Voronoi edges in road space, plus one long fissure running down the lane
    vec2 cq = vec2(uu * 2.6, vv * 0.34 + 1.0);
    vec2 ci = floor(cq), cf = fract(cq);
    float d1 = 8.0, d2 = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = 0; i < 3; i++) {
        vec2 gcell = vec2(float(i - 1), float(j));
        vec2 pt = gcell + wd_hash2(ci + gcell) * 0.85 + 0.075;
        float dd = length(cf - pt);
        if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
      }
    }
    float crack = smoothstep(0.075, 0.015, d2 - d1) * step(0.55, wd_hash(ci + 5.0 + floor(vv * 0.05)));
    float fis = abs(uu - 0.30 - 0.22 * (wd_noise(vec2(vv * 0.5, 9.0)) - 0.5) - 0.06 * wd_noise(vec2(vv * 4.0, 2.0)));
    float fissure = smoothstep(0.022, 0.004, fis) * smoothstep(0.0, 0.2, dn);
    float crackFade = smoothstep(0.01, 0.12, dn);                                // too fine to see near the horizon
    asph *= 1.0 - 0.80 * max(crack * 0.8, fissure) * crackFade;
    // faded lane markings: dashes down the middle, solid lines near both edges, mostly worn away
    float wear = smoothstep(0.15, 0.55, wd_fbm3(vec2(uu * 9.0, vv * 2.0)));
    float dash = smoothstep(0.030, 0.012, abs(uu + 0.02)) * step(fract(vv * 0.16), 0.45);
    float edgeL = smoothstep(0.024, 0.008, abs(abs(uu) - 0.86));
    asph = mix(asph, vec3(0.70, 0.52, 0.22) * (0.42 + 0.60 * exp(-dn * 4.0)), (dash + edgeL * 0.8) * wear * 0.85);
    // rubble and drifted dust on the shoulders: the edge of the tarmac is ragged
    gr = mix(gr, gr * 0.6, smoothstep(0.55, 0.70, wd_fbm3(vec2(p.x * 25.0, uu * 0.0 + vv * 1.5))) * 0.4);
    vec3 grd = mix(gr, asph, onRoad);
    col = mix(col, grd, smoothstep(baseY + 0.001, baseY + 0.006, uv.y));
  }
  // a low line of dust haze lying on the horizon
  col = mix(col, horC * 0.9, smoothstep(0.045, 0.0, abs(uv.y - baseY)) * 0.30);

  // ---- a bent street lamp in the foreground, a dark silhouette against the road
  {
    vec2 b0 = vec2(asp * 0.075, 1.02), b1 = vec2(asp * 0.082, 0.62), b2 = vec2(asp * 0.090, 0.50), b3 = vec2(asp * 0.125, 0.455), b4 = vec2(asp * 0.157, 0.48);
    float pole = max(wd_seg(p, b0, b1, 0.0060), max(wd_seg(p, b1, b2, 0.0042), max(wd_seg(p, b2, b3, 0.0030), wd_seg(p, b3, b4, 0.0026))));
    float head = smoothstep(0.016, 0.010, length((p - (b4 + vec2(0.006, 0.010))) * vec2(0.75, 1.5)));
    vec3 lc = vec3(0.020, 0.014, 0.012) + horC * 0.12 * step(p.x, asp * 0.082) * 0.0;
    col = mix(col, lc, max(pole, head));
    col += horC * 0.10 * smoothstep(0.0, 0.01, 0.0) * 0.0;
  }

  // ---- ash: three layers of grey flakes falling like snow, swirled around the pointer
  vec2 pa = p;
  if (hasM) {
    vec2 dm = p - mp;
    float fall = exp(-dot(dm, dm) / 0.060);
    float a = 2.4 * fall * (0.85 + 0.15 * sin(t * 0.6));
    pa = mp + wd_rot(dm, a);
    pa += vec2(0.0, -0.06 * fall * sin(t * 0.8));                                  // a little uplift in the eddy
  }
  float ash = wd_ash(pa, 8.0, 0.55, 1.0, t, 0.84) * 0.9 + wd_ash(pa, 15.0, 0.38, 2.0, t, 0.72) * 0.7 + wd_ash(pa, 28.0, 0.26, 3.0, t, 0.66) * 0.5;
  ash = clamp(ash, 0.0, 1.0);
  vec3 ashC = mix(vec3(0.66, 0.64, 0.62), horC, 0.18 * smoothstep(0.25, 0.66, uv.y));
  ashC *= 0.62 + 0.45 * smoothstep(0.1, 0.8, uv.y);
  ashC += red * 0.35 * blink * exp(-dL / 0.25);                                    // the red flash catches the flakes near the tower
  col = mix(col, ashC, ash * 0.68);

  // let the picture show faintly, darken the corners gently
  col *= 0.97 + 0.06 * wd_luma(w);
  col *= 1.0 - 0.36 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
