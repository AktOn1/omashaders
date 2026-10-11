// label: Acropolis dawn
// hint: white marble columns on a hill at dawn, a rose-gold sky, a calm blue sea far below and doves wheeling slowly; the doves swing toward the pointer
// category: Ancient worlds
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

float ad_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// a dove in local units (head toward -x): returns the white mask; the second wing is returned in y (far wing, darker)
vec2 ad_dove(vec2 d, float flap) {
  float body = smoothstep(1.0, 0.82, length((d - vec2(0.05, 0.05)) / vec2(0.88, 0.30)));
  float head = smoothstep(1.0, 0.75, length((d - vec2(-0.88, -0.03)) / vec2(0.22, 0.20)));
  float beak = smoothstep(0.07, 0.02, ad_seg(d, vec2(-1.08, 0.0), vec2(-1.28, 0.04)));
  float tail = smoothstep(1.0, 0.7, length((d - vec2(1.05, 0.12)) / vec2(0.48, 0.13)));
  float w1 = 0.0;
  float w2 = 0.0;
  for (int k = 0; k < 2; k++) {
    float ph = flap - 0.35 * float(k);
    vec2 sh = vec2(-0.12 + 0.12 * float(k), -0.12);
    vec2 dir = normalize(vec2(cos(ph) * 0.55 + 0.35, -sin(ph)));
    vec2 prp = vec2(-dir.y, dir.x);
    vec2 v = d - sh;
    float al = dot(v, dir);
    float ac = dot(v, prp);
    float wd = 0.40 * sin(clamp(al / 2.0, 0.0, 1.0) * 3.14159) * (1.0 - 0.35 * clamp(al / 2.0, 0.0, 1.0)) + 0.02;
    float wm = smoothstep(wd, wd * 0.6, abs(ac)) * step(0.0, al) * step(al, 2.0);
    if (k == 0) w1 = wm; else w2 = wm;
  }
  float m = max(max(body, head), max(tail, max(beak * 0.9, w1)));
  return vec2(m, w2);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);
  float HZ = 0.50;
  vec2 sunP = vec2(0.495 * asp, 0.455);

  // ---- rose-gold dawn sky
  vec3 col = mix(vec3(0.46, 0.52, 0.80), vec3(0.97, 0.66, 0.66), smoothstep(0.0, 0.36, uv.y));
  col = mix(col, vec3(1.0, 0.84, 0.60), smoothstep(0.30, 0.52, uv.y));
  vec2 ds = p - sunP;
  float dd = length(ds);
  col += vec3(1.0, 0.78, 0.50) * exp(-dd * dd / 0.060) * 0.55;
  col += vec3(1.0, 0.90, 0.68) * exp(-dd * dd / 0.006) * 0.55;
  float ang = atan(ds.y, ds.x);
  float rays = 0.5 + 0.5 * sin(ang * 13.0 + ad_noise(vec2(ang * 3.0, 1.0)) * 5.0);
  col += vec3(1.0, 0.84, 0.58) * pow(rays, 3.0) * exp(-dd * 1.5) * 0.12 * smoothstep(0.03, 0.2, dd) * step(ds.y, 0.02);
  col = mix(col, vec3(1.25, 1.18, 1.02), smoothstep(0.040, 0.034, dd) * step(uv.y, HZ + 0.001));
  // long soft cloud streaks lit from below
  float cl = ad_fbm(vec2(p.x * 1.1 - t * 0.006, uv.y * 9.0 + 1.0));
  col = mix(col, mix(vec3(1.0, 0.62, 0.62), vec3(1.0, 0.88, 0.70), smoothstep(0.10, 0.45, uv.y)), smoothstep(0.50, 0.78, cl) * 0.50 * smoothstep(0.0, 0.1, uv.y) * smoothstep(0.52, 0.30, uv.y));

  // ---- far islands on the horizon
  float isl = HZ - 0.020 * smoothstep(0.05, 0.0, abs(p.x - 0.12 * asp) - 0.10) * (0.5 + ad_noise(vec2(p.x * 20.0, 1.0)))
                 - 0.032 * smoothstep(0.16, 0.0, abs(p.x - 0.86 * asp) - 0.05) * (0.5 + ad_noise(vec2(p.x * 17.0, 4.0)));
  col = mix(col, vec3(0.62, 0.56, 0.74), smoothstep(isl - 0.002, isl + 0.002, uv.y) * step(uv.y, HZ + 0.001) * 0.85);

  // ---- calm Aegean sea, glitter path under the sun
  float s = uv.y - HZ;
  if (s > 0.0) {
    float k = clamp(s / 0.26, 0.0, 1.0);
    vec3 sea = mix(vec3(0.62, 0.80, 0.90), vec3(0.06, 0.32, 0.58), pow(k, 0.7));
    float z = 0.012 / (s + 0.006);
    float wv = ad_noise(vec2(p.x * 6.0 + t * 0.05, z * 4.0 - t * 0.1)) * 0.6 + ad_noise(vec2(p.x * 20.0, z * 11.0 + t * 0.15)) * 0.4;
    sea *= 0.90 + 0.22 * wv;
    sea = mix(sea, vec3(1.0, 0.72, 0.62), exp(-pow((p.x - sunP.x) / (0.12 + 0.9 * s), 2.0)) * 0.50 * (1.0 - k * 0.5));
    float path = exp(-pow((p.x - sunP.x) / (0.015 + 0.30 * s), 2.0));
    float gl = smoothstep(0.62, 0.92, ad_noise(vec2(p.x * 90.0 + t * 0.6, z * 40.0 + t * 0.9)) * 0.6 + ad_noise(vec2(p.x * 230.0, z * 90.0 - t * 1.4)) * 0.4);
    sea += vec3(1.0, 0.92, 0.72) * gl * path * 0.9;
    sea += vec3(1.0, 0.80, 0.55) * path * 0.10;
    col = mix(col, sea, smoothstep(0.0, 0.002, s) * step(s, 0.40));
  }

  // ---- hillside scrub falling from the terrace to the shore, with a few white houses
  float shore = 0.655 + 0.012 * ad_fbm3(vec2(p.x * 4.0, 2.0));
  if (uv.y > shore) {
    float dh = uv.y - shore;
    vec3 hc = mix(vec3(0.74, 0.64, 0.50), vec3(0.34, 0.31, 0.24), smoothstep(0.0, 0.12, dh));
    hc *= 0.78 + 0.45 * ad_noise(p * vec2(40.0, 90.0));
    float olive = smoothstep(0.55, 0.78, ad_fbm(p * vec2(26.0, 36.0) + 5.0));
    hc = mix(hc, vec3(0.20, 0.26, 0.14), olive * 0.7);
    hc += vec3(1.0, 0.75, 0.45) * 0.14 * exp(-dh * 14.0);
    col = mix(col, hc, smoothstep(0.0, 0.004, dh));
  }
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 hp = vec2(asp * (0.05 + 0.90 * ad_hash(vec2(fi, 21.0))), 0.675 + 0.05 * ad_hash(vec2(fi, 22.0)));
    vec2 q = p - hp;
    float bx = step(abs(q.x), 0.017) * step(-0.021, q.y) * step(q.y, 0.0);
    float side = step(q.x, 0.0);
    col = mix(col, mix(vec3(0.70, 0.62, 0.72), vec3(1.0, 0.96, 0.90), side), bx);
  }

  // ---- terrace: marble steps and pavement
  float floorY = 0.775;
  col *= 1.0 - 0.30 * smoothstep(0.745, floorY, uv.y) * step(uv.y, floorY);
  if (uv.y > floorY) {
    float df = uv.y - floorY;
    float z = 0.05 / (df + 0.015);
    vec3 fl = mix(vec3(1.0, 0.93, 0.84), vec3(0.88, 0.78, 0.78), smoothstep(0.0, 0.22, df));
    float uu = (p.x - sunP.x) / (df + 0.12);
    float joint = smoothstep(0.02, 0.07, fract(z * 0.8)) * smoothstep(0.015, 0.05, fract(uu * 1.4));
    fl *= 0.84 + 0.16 * joint;
    fl *= 0.94 + 0.10 * ad_noise(p * vec2(30.0, 60.0));
    fl += vec3(1.0, 0.78, 0.50) * exp(-df * 18.0) * 0.18 * exp(-pow((p.x - sunP.x) / 0.9, 2.0));
    fl = mix(fl, vec3(1.0, 0.98, 0.94), smoothstep(0.012, 0.0, df) * 0.8);       // bright edge of the top step
    fl *= mix(0.80, 1.0, step(0.025, df));                                         // the step riser below it is shaded
    col = mix(col, fl, smoothstep(0.0, 0.002, df));
  }

  // ---- six marble columns; light falls through the gaps, their shadows fan out across the floor
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float cxn = asp * (0.07 + 0.172 * fi);
    float yTop = 0.17;
    float yBase = 0.85;
    float tt = clamp((uv.y - yTop) / (yBase - yTop), 0.0, 1.0);
    // cast shadow on the floor
    float sdy = uv.y - yBase;
    if (sdy > 0.0 && sdy < 0.17) {
      float xs = cxn + (cxn - sunP.x) * sdy * 1.2;
      float shw = 0.040 * (1.0 + 3.0 * sdy);
      float sm = smoothstep(shw, shw * 0.55, abs(p.x - xs)) * (1.0 - smoothstep(0.08, 0.17, sdy));
      col = mix(col, col * vec3(0.78, 0.68, 0.82), sm * 0.80);
    }
    // shaft
    float hwc = mix(0.033, 0.043, tt);
    float dxc = p.x - cxn;
    if (abs(dxc) < hwc + 0.01 && uv.y > yTop - 0.04 && uv.y < yBase + 0.012) {
      float u = dxc / hwc;
      float sgn = sunP.x > cxn ? 1.0 : -1.0;
      float lit = smoothstep(-0.6, 1.0, u * sgn);
      float flute = 0.93 + 0.07 * cos(u * 3.14159 * 6.0);
      vec3 cc = mix(vec3(0.74, 0.68, 0.80), vec3(1.0, 0.96, 0.88), 0.35 + 0.65 * lit);
      cc *= flute;
      cc += vec3(1.0, 0.78, 0.48) * smoothstep(0.55, 1.0, u * sgn) * 0.35;
      cc *= 0.92 + 0.10 * ad_noise(p * vec2(120.0, 30.0));
      cc = mix(cc, vec3(1.0, 0.72, 0.60), smoothstep(0.55, 1.0, tt) * 0.10);
      // shaft
      float inShaft = smoothstep(hwc, hwc - 0.004, abs(dxc)) * step(yTop, uv.y) * step(uv.y, yBase);
      col = mix(col, cc, inShaft);
      // capital: echinus then abacus
      float cy = uv.y;
      float echHw = mix(hwc + 0.004, 0.056, smoothstep(yTop, yTop - 0.03, cy));
      float inEch = step(abs(dxc), echHw) * step(yTop - 0.03, cy) * step(cy, yTop);
      float inAb = step(abs(dxc), 0.062) * step(yTop - 0.060, cy) * step(cy, yTop - 0.030);
      vec3 cap = mix(vec3(0.76, 0.70, 0.82), vec3(1.0, 0.97, 0.90), 0.4 + 0.6 * lit) * (0.94 + 0.06 * cos(u * 6.0));
      col = mix(col, cap * 0.96, inEch);
      col = mix(col, mix(cap, vec3(1.0, 0.98, 0.94), 0.35), inAb);
      // base: a low plinth
      float inBase = step(abs(dxc), 0.056) * step(yBase, cy) * step(cy, yBase + 0.012);
      col = mix(col, mix(vec3(0.78, 0.72, 0.84), vec3(1.0, 0.96, 0.90), lit), inBase);
    }
  }
  // architrave and triglyph frieze across the top
  {
    float ya = 0.110;
    float inA = step(uv.y, ya - 0.0);
    vec3 ac = mix(vec3(1.0, 0.95, 0.86), vec3(0.78, 0.70, 0.80), smoothstep(0.0, ya, uv.y));
    float trig = step(0.35, fract(p.x / 0.10)) * step(fract(p.x / 0.10), 0.62) * step(0.020, uv.y) * step(uv.y, 0.075);
    float mete = smoothstep(0.012, 0.0, abs(uv.y - 0.080)) * 0.0;
    ac = mix(ac, vec3(0.62, 0.56, 0.70), trig * 0.55);
    ac = mix(ac, vec3(1.0, 0.98, 0.92), smoothstep(0.008, 0.0, abs(uv.y - ya + 0.004)) * 0.6);
    ac = mix(ac, vec3(0.62, 0.55, 0.70), smoothstep(0.0, 0.04, uv.y - (ya - 0.04)) * 0.25);
    // the architrave sits behind the capitals, so cut it at the abacus tops
    col = mix(col, ac, inA * step(uv.y, 0.110));
  }

  // ---- doves wheeling in slow circles, swinging toward the pointer
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float hsh = ad_hash(vec2(fi, 31.0));
    vec2 c0 = vec2(asp * (0.22 + 0.58 * ad_hash(vec2(fi, 32.0))), 0.30 + 0.16 * ad_hash(vec2(fi, 33.0)));
    float rr = 0.07 + 0.05 * hsh;
    float spd = (0.30 + 0.14 * hsh) * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0);
    float a = t * spd + fi * 1.9;
    vec2 cc = c0;
    if (hasM) { cc = mix(c0, mp + 0.07 * vec2(cos(fi * 2.4 + 0.5), 0.6 * sin(fi * 2.4 + 0.5)), 0.78); rr *= 0.60; }
    vec2 pos = cc + vec2(cos(a) * rr * 1.5, sin(a) * rr * 0.45) + vec2(0.0, 0.004 * sin(t * 2.0 + fi));
    float dirS = (-sin(a) * spd) > 0.0 ? 1.0 : -1.0;
    float sz = 0.030 + 0.008 * hsh;
    vec2 d = (p - pos) / sz;
    d.x *= -dirS;
    if (abs(d.x) < 2.5 && abs(d.y) < 2.5) {
      float flap = sin(t * 6.0 + fi * 2.7) * 0.7 + 0.1;
      vec2 dv = ad_dove(d, flap);
      vec2 dv2 = ad_dove(d * 0.88, flap);
      float shade = 0.82 + 0.18 * smoothstep(-0.5, 0.4, -d.y);
      col = mix(col, vec3(0.55, 0.42, 0.58), clamp(max(dv2.x, dv2.y) * 0.45, 0.0, 0.45));
      col = mix(col, vec3(0.80, 0.74, 0.86), dv.y * 0.9);
      col = mix(col, vec3(1.0, 0.98, 0.95) * shade, dv.x);
    }
  }

  col += (w - ad_luma(w)) * 0.06;
  col *= 0.97 + 0.06 * ad_luma(w);
  col *= 1.0 - 0.20 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
