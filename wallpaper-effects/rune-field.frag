// label: Rune field
// hint: faint carved runes scattered over your own picture, engraved with a dark groove and a pale bevel. They glow ember-gold when the pointer comes near and when a slow ring of light crosses the screen every ten seconds. A very faint interlaced knotwork band runs along the bottom and a little gold dust drifts up. Cold slate at the corners, your picture stays the wallpaper
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

float rf_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float rf_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float rf_noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rf_h(i), rf_h(i + vec2(1.0, 0.0)), f.x), mix(rf_h(i + vec2(0.0, 1.0)), rf_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

// one stroke of a glyph: keeps the nearest distance and the direction away from the stroke
void rf_s(vec2 p, vec2 a, vec2 b, inout vec3 best) {
  vec2 ab = b - a;
  float u = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  vec2 v = p - (a + ab * u);
  float d = length(v);
  if (d < best.x) best = vec3(d, v / max(d, 0.0001));
}
// the carved signs, drawn from straight strokes in a box x -0.6..0.6, y -1..1 (y up)
vec3 rf_glyph(vec2 p, int g) {
  vec3 b = vec3(9.0, 0.0, 0.0);
  if (g == 0) { // fehu: a stem with two upward branches
    rf_s(p, vec2(-0.2, -1.0), vec2(-0.2, 1.0), b);
    rf_s(p, vec2(-0.2, 0.45), vec2(0.45, 1.0), b);
    rf_s(p, vec2(-0.2, -0.1), vec2(0.45, 0.45), b);
  } else if (g == 1) { // uruz: a tall arch
    rf_s(p, vec2(-0.4, -1.0), vec2(-0.4, 1.0), b);
    rf_s(p, vec2(-0.4, 1.0), vec2(0.4, 0.35), b);
    rf_s(p, vec2(0.4, 0.35), vec2(0.4, -1.0), b);
  } else if (g == 2) { // thurisaz: stem and a thorn
    rf_s(p, vec2(-0.2, -1.0), vec2(-0.2, 1.0), b);
    rf_s(p, vec2(-0.2, 0.55), vec2(0.45, 0.1), b);
    rf_s(p, vec2(0.45, 0.1), vec2(-0.2, -0.35), b);
  } else if (g == 3) { // ansuz: two slanted branches
    rf_s(p, vec2(-0.25, -1.0), vec2(-0.25, 1.0), b);
    rf_s(p, vec2(-0.25, 1.0), vec2(0.45, 0.35), b);
    rf_s(p, vec2(-0.25, 0.3), vec2(0.45, -0.35), b);
  } else if (g == 4) { // raido: a bowl and a leg
    rf_s(p, vec2(-0.3, -1.0), vec2(-0.3, 1.0), b);
    rf_s(p, vec2(-0.3, 1.0), vec2(0.4, 0.5), b);
    rf_s(p, vec2(0.4, 0.5), vec2(-0.3, 0.0), b);
    rf_s(p, vec2(-0.3, 0.0), vec2(0.45, -1.0), b);
  } else if (g == 5) { // kenaz: an open wedge
    rf_s(p, vec2(0.4, 0.7), vec2(-0.3, 0.0), b);
    rf_s(p, vec2(-0.3, 0.0), vec2(0.4, -0.7), b);
  } else if (g == 6) { // gebo: a gift cross
    rf_s(p, vec2(-0.45, -0.8), vec2(0.45, 0.8), b);
    rf_s(p, vec2(-0.45, 0.8), vec2(0.45, -0.8), b);
  } else if (g == 7) { // hagalaz: two stems and a bar
    rf_s(p, vec2(-0.4, -1.0), vec2(-0.4, 1.0), b);
    rf_s(p, vec2(0.4, -1.0), vec2(0.4, 1.0), b);
    rf_s(p, vec2(-0.4, 0.3), vec2(0.4, -0.3), b);
  } else if (g == 8) { // nauthiz: a stem crossed by a slash
    rf_s(p, vec2(0.0, -1.0), vec2(0.0, 1.0), b);
    rf_s(p, vec2(-0.4, -0.35), vec2(0.4, 0.45), b);
  } else if (g == 9) { // sowilo: the lightning bolt
    rf_s(p, vec2(-0.35, 1.0), vec2(0.3, 0.3), b);
    rf_s(p, vec2(0.3, 0.3), vec2(-0.3, -0.3), b);
    rf_s(p, vec2(-0.3, -0.3), vec2(0.35, -1.0), b);
  } else if (g == 10) { // tiwaz: the spear
    rf_s(p, vec2(0.0, -1.0), vec2(0.0, 1.0), b);
    rf_s(p, vec2(-0.45, 0.45), vec2(0.0, 1.0), b);
    rf_s(p, vec2(0.45, 0.45), vec2(0.0, 1.0), b);
  } else if (g == 11) { // berkano: two bowls
    rf_s(p, vec2(-0.3, -1.0), vec2(-0.3, 1.0), b);
    rf_s(p, vec2(-0.3, 1.0), vec2(0.35, 0.5), b);
    rf_s(p, vec2(0.35, 0.5), vec2(-0.3, 0.0), b);
    rf_s(p, vec2(-0.3, 0.0), vec2(0.4, -0.5), b);
    rf_s(p, vec2(0.4, -0.5), vec2(-0.3, -1.0), b);
  } else if (g == 12) { // othala: a diamond on two feet
    rf_s(p, vec2(0.0, 1.0), vec2(0.45, 0.4), b);
    rf_s(p, vec2(0.45, 0.4), vec2(0.0, -0.2), b);
    rf_s(p, vec2(0.0, -0.2), vec2(-0.45, 0.4), b);
    rf_s(p, vec2(-0.45, 0.4), vec2(0.0, 1.0), b);
    rf_s(p, vec2(0.0, -0.2), vec2(-0.45, -1.0), b);
    rf_s(p, vec2(0.0, -0.2), vec2(0.45, -1.0), b);
  } else { // a sun wheel: ring with a cross
    float r = length(p);
    float dr = abs(r - 0.62);
    if (dr < b.x) b = vec3(dr, p / max(r, 0.0001) * sign(r - 0.62));
    rf_s(p, vec2(-0.62, 0.0), vec2(0.62, 0.0), b);
    rf_s(p, vec2(0.0, -0.62), vec2(0.0, 0.62), b);
  }
  return b;
}


// a big sun-wheel medallion: double ring, a wave scroll, a cross, a three-armed spiral in the hub and a ring of ticks (p in units of the outer radius)
vec3 rf_medal(vec2 p) {
  vec3 b = vec3(9.0, 0.0, 0.0);
  float r = length(p);
  vec2 rad = p / max(r, 0.0001);
  vec2 tan2 = vec2(-rad.y, rad.x);
  float ang = atan(p.y, p.x);
  float dr = abs(r - 1.0);
  if (dr < b.x) b = vec3(dr, rad * sign(r - 1.0));
  dr = abs(r - 0.90);
  if (dr < b.x) b = vec3(dr, rad * sign(r - 0.90));
  dr = abs(r - 0.36);
  if (dr < b.x) b = vec3(dr, rad * sign(r - 0.36));
  float rw = 0.64 + 0.04 * sin(ang * 16.0);   // a running wave
  dr = abs(r - rw) * 0.85;
  if (dr < b.x) b = vec3(dr, rad * sign(r - rw));
  float f = fract(ang * 0.63662 + 0.5) - 0.5;  // four arms of the cross
  float ds = abs(f) * 1.5708 * r + max(max(0.36 - r, r - 0.90), 0.0);
  if (ds < b.x) b = vec3(ds, tan2 * sign(f));
  for (int k = 0; k < 3; k++) {                // the triskele: three arms curling out of the hub
    float u = mod(ang - float(k) * 2.0944, 6.2832) / 6.2832;
    float rk = 0.03 + 0.26 * u;
    float ds2 = abs(r - rk) * 0.80;
    if (ds2 < b.x && r < 0.36) b = vec3(ds2, rad * sign(r - rk));
  }
  float ft = fract(ang * 7.6394 + 0.5) - 0.5;  // 48 ticks outside the ring
  float dt = length(vec2(abs(ft) * 0.1309 * r, max(max(1.0 - r, r - 1.09), 0.0)));
  if (dt < b.x) b = vec3(dt, tan2 * sign(ft));
  return b;
}

// add an overlay colour; on bright pictures it is darkened so it still reads
vec3 rf_ov(vec3 col, vec3 c, float a, float lum) {
  vec3 ec = c * (1.0 - 0.70 * smoothstep(0.45, 0.85, lum));
  return mix(col, ec, clamp(a, 0.0, 1.0));
}

// lit runes: on bright pictures they turn a deeper, saturated ember so they still glow
vec3 rf_lit(vec3 col, vec3 c, float a, float lum) {
  float b = smoothstep(0.40, 0.80, lum);
  vec3 ec = mix(c, vec3(0.80, 0.26, 0.04), 0.65 * b) * (1.0 - 0.30 * b);
  return mix(col, ec, clamp(a, 0.0, 1.0));
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  vec2 pp = uv * res;
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? mpx : vec2(-10000.0);
  float t = time;
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  vec3 gold = vec3(1.00, 0.78, 0.36);
  vec3 ember = vec3(1.00, 0.46, 0.14);
  vec3 teal = vec3(0.30, 0.86, 0.80);
  vec3 bone = vec3(0.94, 0.91, 0.82);
  vec3 slate = vec3(0.11, 0.15, 0.22);

  // cold basalt wash: the corners close in blue-grey, the centre stays clear
  vec2 q = (uv - 0.5) * vec2(res.x / res.y, 1.0);
  float vig = smoothstep(0.30, 1.05, length(q));
  float grain = rf_noise(pp / (9.0 * sc)) * 0.6 + rf_noise(pp / (3.0 * sc) + 7.0) * 0.4;
  col = mix(col, col * vec3(0.78, 0.86, 1.00) + slate * 0.16, 0.55 * vig);
  col *= 0.94 + 0.10 * grain * (0.4 + 0.6 * vig);

  // the slow ring of light: one wave every ten seconds, from a different place each time
  float per = 10.0;
  float wn = floor(t / per);
  float ph = t / per - wn;
  vec2 wc = res * vec2(0.18 + 0.64 * rf_h(vec2(wn, 2.3)), 0.25 + 0.5 * rf_h(vec2(wn, 7.1)));
  float Rmax = length(res) * 1.05;
  float Rw = ph * Rmax;
  float dw = length(pp - wc);
  float wavePx = 120.0 * sc;
  float ahead = (dw - Rw) / wavePx;             // < 0 behind the ring
  float ring = exp(-ahead * ahead * 2.2) * smoothstep(1.0, 0.8, ph) * (0.35 + 0.65 * smoothstep(0.0, 0.08, ph));
  col = rf_ov(col, teal, ring * 0.16, lum0);

  // carved runes on a jittered grid, three sizes
  float C = 168.0 * sc;
  float Rn = 240.0 * sc;
  vec2 c0 = floor(pp / C);
  vec2 mc = res * vec2(0.78, 0.49);
  float Rm = 0.30 * res.y;
  float groove = 0.0; float lit = 0.0; float halo = 0.0; float bevL = 0.0; float bevD = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 ca = c0 + vec2(float(i), float(j));
      if (rf_h(ca + 3.1) > 0.60) continue;
      float hs = rf_h(ca + 11.7);
      float s = (hs < 0.45 ? 15.0 : (hs < 0.82 ? 24.0 : 38.0)) * sc;
      vec2 cp = (ca + 0.20 + 0.60 * vec2(rf_h(ca), rf_h(ca + 17.3))) * C;
      vec2 d = pp - cp;
      if (abs(cp.y - (res.y - 56.0 * sc)) < 70.0 * sc || length(cp - mc) < Rm * 1.16) continue;
      if (abs(d.x) > s * 1.0 + 20.0 * sc || abs(d.y) > s * 1.2 + 20.0 * sc) continue;
      int g = int(floor(rf_h(ca + 29.9) * 13.99));
      float wk = has ? smoothstep(Rn, Rn * 0.25, length(cp - mp)) : 0.0;
      float dwr = (length(cp - wc) - Rw) / wavePx;
      float wv = dwr < 0.0 ? exp(dwr * 0.45) : exp(-dwr * dwr * 1.6);
      wv *= smoothstep(1.0, 0.7, ph);
      float glow = clamp(max(wk, wv), 0.0, 1.0);
      glow = glow * glow * (3.0 - 2.0 * glow);
      vec3 gd = rf_glyph(vec2(d.x, -d.y) / s, g);
      float dist = gd.x * s;
      vec2 nrm = vec2(gd.y, -gd.z);              // back to screen directions (y down)
      float w = max(1.05 * sc, 0.070 * s);
      float bw = 1.5 * sc;
      float gr = rf_aa(dist, w);
      float lightSide = dot(nrm, vec2(0.7071, 0.7071));
      float rim = smoothstep(w - 0.3 * sc, w + 0.4 * sc, dist) * (1.0 - smoothstep(w + bw * 0.6, w + bw * 1.7, dist));
      groove = max(groove, gr);
      bevL += rim * max(lightSide, 0.0);
      bevD += rim * max(-lightSide, 0.0) * 0.6;
      float inner = rf_aa(dist, w * 0.80);
      lit += inner * glow;
      halo += exp(-dist * dist / (s * s * 0.07 + 6.0 * sc * sc)) * glow * 0.50;
      // the faint warmth that stays in the groove all the time
      halo += exp(-dist * dist / (4.0 * sc * sc)) * 0.06;
    }
  }
  // the sun-wheel: the same carving, lit where the pointer or the ring of light is near that part of it
  vec2 pm = pp - mc;
  if (length(pm) < Rm * 1.14) {
    vec3 gd = rf_medal(pm / Rm);
    float dist = gd.x * Rm;
    vec2 nrm = gd.yz;
    float w = 1.5 * sc;
    float wkm = has ? smoothstep(Rn, Rn * 0.2, length(pp - mp)) : 0.0;
    float wvm = exp(-pow((dw - Rw) / wavePx, 2.0)) * smoothstep(1.0, 0.7, ph);
    float mglow = max(wkm, wvm);
    float lightSide = dot(nrm, vec2(0.7071, 0.7071));
    float rim = smoothstep(w - 0.3 * sc, w + 0.4 * sc, dist) * (1.0 - smoothstep(w + 0.9 * sc, w + 2.6 * sc, dist));
    groove = max(groove, rf_aa(dist, w) * 0.80);
    bevL += rim * max(lightSide, 0.0) * 0.8;
    bevD += rim * max(-lightSide, 0.0) * 0.5;
    lit += rf_aa(dist, w * 0.6) * mglow * 0.9;
    halo += exp(-dist * dist / (30.0 * sc * sc)) * mglow * 0.45;
  }
  // engraved: dark groove, pale lip on the lit side, a shadow lip on the other
  col = mix(col, col * 0.48 + slate * 0.22, groove * 0.72);
  col = mix(col, rf_ov(col, bone, 1.0, lum0), clamp(bevL, 0.0, 1.0) * (0.30 + 0.20 * (1.0 - lum0)));
  col = mix(col, col * 0.62, clamp(bevD, 0.0, 1.0) * 0.30);
  vec3 hot = mix(ember, gold, 0.30 + 0.5 * smoothstep(0.55, 1.0, clamp(lit, 0.0, 1.0)));
  col = rf_lit(col, hot, clamp(halo, 0.0, 1.0) * 0.34, lum0);
  col = rf_lit(col, mix(hot, bone, 0.30), clamp(lit, 0.0, 1.0) * 0.92, lum0);

  // an interlaced band along the bottom: two strands, over and under at every crossing
  float yb = res.y - 56.0 * sc;
  float A = 13.0 * sc;
  float kx = 6.2832 / (96.0 * sc);
  float bandFade = smoothstep(32.0 * sc, 6.0 * sc, abs(pp.y - yb));
  if (bandFade > 0.001) {
    float sx = sin(pp.x * kx);
    float y1 = yb + A * sx;
    float y2 = yb - A * sx;
    float wd = 3.8 * sc;
    float d1 = abs(pp.y - y1) / sqrt(1.0 + A * kx * A * kx * (1.0 - sx * sx));
    float d2 = abs(pp.y - y2) / sqrt(1.0 + A * kx * A * kx * (1.0 - sx * sx));
    float nx = floor(pp.x * kx / 3.14159 + 0.5);
    bool firstOver = mod(nx, 2.0) < 0.5;
    float a1 = rf_aa(d1, wd); float a2 = rf_aa(d2, wd);
    float e1 = rf_aa(d1, wd + 2.0 * sc); float e2 = rf_aa(d2, wd + 2.0 * sc);
    float topA = firstOver ? a1 : a2;
    float topE = firstOver ? e1 : e2;
    float botA = firstOver ? a2 : a1;
    float botD = firstOver ? d2 : d1;
    float topD = firstOver ? d1 : d2;
    float band = botA * (1.0 - topE) + topA;
    float edge = max(rf_aa(abs(botD - wd), 0.6 * sc) * (1.0 - topE), rf_aa(abs(topD - wd), 0.6 * sc));
    float wl = exp(-pow((dw - Rw) / (260.0 * sc), 2.0)) * (1.0 - smoothstep(0.7, 1.0, ph));
    float lamp = has ? exp(-pow((pp.x - mp.x) / (320.0 * sc), 2.0)) : 0.0;
    float shine = 0.30 + 0.9 * max(wl, lamp * 0.8);
    float xfade = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
    col = mix(col, col * 0.55 + slate * 0.12, edge * 0.30 * bandFade * xfade);
    col = rf_ov(col, mix(gold, bone, 0.15), band * (1.0 - 0.55 * edge) * 0.22 * shine * bandFade * xfade, lum0);
  }

  // gold dust drifting up, a little brighter when the ring passes or the pointer is near
  float dust = 0.0;
  for (int L = 0; L < 2; L++) {
    float fL = float(L);
    float Cd = (64.0 + 40.0 * fL) * sc;
    vec2 cd = floor(pp / Cd);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cc = cd + vec2(float(i), float(j));
        vec2 ca = cc + fL * 31.0;
        if (rf_h(ca + 5.5) > 0.38) continue;
        float m = rf_h(ca + 1.9);
        float sp = (5.0 + 5.0 * m) * (1.0 + 0.5 * fL) * sc;
        vec2 base = vec2(rf_h(ca), rf_h(ca + 17.3));
        float py = fract(base.y - t * sp / Cd);
        float px = base.x + 0.12 * sin(t * (0.2 + 0.3 * m) + m * 40.0);
        vec2 pos = (cc + vec2(px, py)) * Cd;
        vec2 dd = pp - pos;
        float r = (0.9 + 0.8 * m + 0.5 * fL) * sc;
        float tw = 0.55 + 0.45 * sin(t * (0.6 + 1.5 * m) + m * 70.0);
        float edgeF = smoothstep(0.0, 0.15, py) * smoothstep(1.0, 0.85, py);
        float near = has ? smoothstep(260.0 * sc, 40.0 * sc, length(pos - mp)) : 0.0;
        float wf = exp(-pow((length(pos - wc) - Rw) / wavePx, 2.0)) * smoothstep(1.0, 0.8, ph);
        dust += (exp(-dot(dd, dd) / (r * r)) + 0.18 * exp(-dot(dd, dd) / (r * r * 14.0))) * tw * edgeF * (0.50 + 0.9 * max(near, wf));
      }
    }
  }
  col = rf_ov(col, gold, clamp(dust * 0.55, 0.0, 1.0), lum0);

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
