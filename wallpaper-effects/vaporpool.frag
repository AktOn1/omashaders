// label: Vapor pool
// hint: an empty tiled swimming pool under a pink-to-cyan sky with a wireframe sun, a marble bust and a palm on the rim, light ripples crawling over the tiles; the pointer sends ripples across the floor
// category: Neon nights
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
float vp_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vp_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vp_hash(i), vp_hash(i + vec2(1, 0)), f.x), mix(vp_hash(i + vec2(0, 1)), vp_hash(i + vec2(1, 1)), f.x), f.y);
}
float vp_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vp_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float vp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float vp_ell(vec2 q, vec2 r) { return (length(q / r) - 1.0) * min(r.x, r.y); }
float vp_box(vec2 q, vec2 r) { vec2 d = abs(q) - r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

const float VP_HZ = 0.52;

// marble bust on a fluted plinth; q = position relative to the foot, y up. returns signed distance (negative inside)
float vp_bust(vec2 q0) {
  vec2 q = q0 / 1.25;
  float d = vp_box(q - vec2(0.0, 0.006), vec2(0.056, 0.006));                    // plinth foot
  d = min(d, vp_box(q - vec2(0.0, 0.050), vec2(0.040, 0.044)));                    // column
  d = min(d, vp_box(q - vec2(0.0, 0.098), vec2(0.050, 0.007)));                    // capital
  vec2 s = q - vec2(0.0, 0.105);
  float sh = (pow(pow(abs(s.x / 0.080), 3.0) + pow(max(s.y, 0.0) / 0.088, 3.0), 1.0 / 3.0) - 1.0) * 0.08;
  d = min(d, max(sh, -s.y));                                                       // chest and shoulders
  d = min(d, vp_box(q - vec2(0.004, 0.196), vec2(0.019, 0.026)));                  // neck
  d = min(d, vp_ell(q - vec2(-0.003, 0.250), vec2(0.034, 0.046)));                 // skull
  d = min(d, vp_ell(q - vec2(0.010, 0.238), vec2(0.027, 0.040)));                  // face
  vec2 nq = q - vec2(0.034, 0.243);
  nq = vec2(nq.x * 0.80 - nq.y * 0.60, nq.x * 0.60 + nq.y * 0.80);
  d = min(d, vp_ell(nq, vec2(0.0115, 0.0055)));                                    // nose, tilted
  d = min(d, vp_ell(q - vec2(0.025, 0.214), vec2(0.012, 0.011)));                  // chin
  d = min(d, vp_ell(q - vec2(-0.030, 0.264), vec2(0.017, 0.022)));                 // hair bun
  d = min(d, vp_ell(q - vec2(-0.006, 0.286), vec2(0.030, 0.012)));                 // hair crest
  return d * 1.25;
}

// wireframe sun: a sphere drawn as turning meridians and even latitude lines; returns (fill, lines)
vec2 vp_sun(vec2 p, vec2 c, float r, float t) {
  vec2 q = (p - c) / r;
  float rr = length(q);
  if (rr > 1.04) return vec2(0.0);
  float fill = smoothstep(1.0, 0.985, rr);
  float edge = smoothstep(0.03, 0.006, abs(rr - 1.0));
  float yn = clamp(q.y, -0.999, 0.999);
  float cw = sqrt(1.0 - yn * yn);
  float sx = clamp(q.x / max(cw, 0.001), -1.0, 1.0);
  float ph = asin(sx);
  float N = 7.0;
  float f = ph * N / 3.14159 + t * 0.12;
  float dm = abs(f - floor(f + 0.5)) * (3.14159 / N) * cw * cos(ph) * r;
  float meri = smoothstep(0.0030, 0.0012, dm) * fill;
  float lat = asin(yn) * 9.0 / 3.14159 + 0.5;
  float dl = abs(lat - floor(lat + 0.5)) * (3.14159 / 9.0) * cw * r;
  float latl = smoothstep(0.0030, 0.0012, dl) * fill;
  return vec2(fill, clamp(max(meri, latl) + edge, 0.0, 1.0));
}

// one palm frond fanning from the crown (straight in a gravity-warped space, so it arches over and droops): u along, v across
float vp_frond(vec2 q, float ang, float len) {
  vec2 d = vec2(cos(ang), -sin(ang));
  float u = dot(q, d);
  float v = q.x * -d.y + q.y * d.x;
  if (u < 0.0 || u > len) return 0.0;
  float k = u / len;
  float w = 0.024 * sin(3.14159 * pow(k, 0.5)) * (0.60 + 0.40 * abs(sin(u * 230.0)));  // leaflet comb
  return smoothstep(w, w * 0.6, abs(v));
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  float t = time;
  vec3 w = wall(uv);
  vec2 sunC = vec2(0.52 * asp, 0.31);
  float sunR = 0.19;

  vec3 col;
  if (uv.y < VP_HZ) {
    // ---- sky: cyan zenith, violet middle, pink horizon, thin pastel cloud bands
    float s = uv.y / VP_HZ;
    vec3 top = vec3(0.16, 0.66, 0.90);
    vec3 mid = vec3(0.60, 0.42, 0.90);
    vec3 low = vec3(1.0, 0.50, 0.76);
    vec3 hor = vec3(1.0, 0.80, 0.86);
    col = mix(top, mid, smoothstep(0.0, 0.52, s));
    col = mix(col, low, smoothstep(0.42, 0.92, s));
    col = mix(col, hor, smoothstep(0.86, 1.0, s) * 0.8);
    float band = vp_fbm(vec2(p.x * 1.1 + t * 0.012, uv.y * 17.0 + 3.0)) ;
    float cl = smoothstep(0.50, 0.78, band) * smoothstep(0.12, 0.45, s) * (0.5 + 0.5 * sin(uv.y * 46.0));
    col = mix(col, vec3(1.0, 0.82, 0.92), cl * 0.38);
    // halo around the sun
    float hd = length(p - sunC);
    col += vec3(1.0, 0.55, 0.70) * exp(-hd * hd / 0.055) * 0.30;
    // the wireframe sun
    vec2 sn = vp_sun(p, sunC, sunR, t);
    vec3 sfill = mix(vec3(1.0, 0.86, 0.45), vec3(1.0, 0.30, 0.65), smoothstep(0.12, 0.47, uv.y));
    col = mix(col, sfill, sn.x * 0.70);
    col = mix(col, vec3(1.0, 0.98, 0.86), sn.y * 0.95);
    col += vec3(1.0, 0.6, 0.8) * sn.y * 0.1;

    // ---- the palm on the right rim, leaning toward the sun
    {
      vec2 base = vec2(0.86 * asp, VP_HZ);
      float hgt = (VP_HZ - uv.y) / 0.28;
      float sway = 0.012 * sin(t * 0.5);
      float cx = base.x - 0.075 * hgt * hgt + sway * hgt * hgt;
      float tw = mix(0.012, 0.0065, hgt);
      float trunk = smoothstep(tw, tw * 0.6, abs(p.x - cx)) * step(0.0, hgt) * step(hgt, 1.02);
      trunk *= 0.82 + 0.18 * sin(uv.y * 260.0);
      vec2 crown = vec2(base.x - 0.075 + sway, VP_HZ - 0.28);
      vec2 cq = p - crown;
      cq.y -= 4.6 * cq.x * cq.x;
      float fr = 0.0;
      for (int i = 0; i < 8; i++) {
        float a = 0.10 + float(i) * 0.43 + 0.04 * sin(t * 0.6 + float(i) * 1.7);
        fr = max(fr, vp_frond(cq, a, 0.20 + 0.03 * sin(float(i) * 2.3)));
      }
      float palm = max(trunk, fr);
      vec3 pc = mix(vec3(0.20, 0.07, 0.36), vec3(0.42, 0.14, 0.50), clamp(-cq.x * 4.0 + 0.4, 0.0, 1.0) * 0.8);
      col = mix(col, pc, palm * 0.94);
    }

    // ---- the marble bust on the left rim, lit from the sun's side
    {
      vec2 q = vec2(p.x - 0.25 * asp, VP_HZ - 0.004 - uv.y);
      q.y = VP_HZ - 0.006 - uv.y;
      float d = vp_bust(q);
      float a = smoothstep(0.0012, -0.0012, d);
      float lit = smoothstep(-0.09, 0.075, q.x);
      vec3 shade = vec3(0.34, 0.28, 0.68);
      vec3 light = vec3(1.0, 0.92, 0.97);
      vec3 mc = mix(shade, light, lit * 0.85 + 0.1);
      float vein = vp_fbm(vec2(q.x * 11.0, q.y * 11.0) + 5.0);
      mc *= 0.90 + 0.14 * smoothstep(0.4, 0.45, abs(vein - 0.5) + 0.0) ;
      mc = mix(mc, vec3(0.50, 0.46, 0.72), smoothstep(0.035, 0.0, abs(vein - 0.50)) * 0.30);
      // column flutes
      float colm = step(q.y, 0.094) * step(0.006, q.y) * step(abs(q.x), 0.040);
      mc *= 1.0 - colm * 0.12 * (0.5 + 0.5 * sin(q.x * 360.0));
      mc *= 1.0 - 0.18 * smoothstep(0.0, 0.03, -d) * 0.0;
      col = mix(col, mc, a);
      // a glint on the brow
      col += vec3(1.0, 0.95, 0.9) * a * exp(-length((q - vec2(0.018, 0.268)) / vec2(0.012, 0.018))) * 0.25;
    }

    // coping stone along the far rim
    float cop = smoothstep(VP_HZ - 0.013, VP_HZ - 0.012, uv.y);
    vec3 cc = mix(vec3(0.96, 0.92, 1.0), vec3(0.74, 0.62, 0.92), smoothstep(VP_HZ - 0.012, VP_HZ, uv.y));
    cc *= 0.94 + 0.06 * step(0.5, fract(p.x * 14.0));
    col = mix(col, cc, cop);
  } else {
    // ---- the pool floor: perspective checker tiles, slow caustic ripples, pointer ripples
    float dy = uv.y - VP_HZ;
    float gz = dy + 0.02;
    vec2 floorP = vec2((p.x - 0.5 * asp) * 3.0 / gz, 1.1 / gz);
    float aspf = asp;
    vec2 dm = (uv - m) * vec2(aspf, 1.0);
    float dd = length(dm);
    float wave = 0.0;
    if (hasM) {
      wave = sin(dd * 46.0 - t * 4.2) * exp(-dd * 3.0) * smoothstep(0.0, 0.05, dd);
      floorP += (dm / max(dd, 0.001)) * wave * vec2(0.5, 0.35) * 0.20 * (1.0 / (0.4 + gz * 2.0));
    }
    vec2 tile = floorP;
    float chk = mod(floor(tile.x) + floor(tile.y), 2.0);
    vec2 ft = abs(fract(tile) - 0.5);
    float grout = smoothstep(0.455, 0.5, max(ft.x, ft.y));
    float aa = smoothstep(0.015, 0.16, dy);
    vec3 tA = vec3(0.42, 0.88, 0.94);
    vec3 tB = vec3(0.70, 0.50, 0.94);
    vec3 tc = mix(tA, tB, chk);
    tc = mix(mix(tA, tB, 0.5), tc, aa);
    tc = mix(tc, vec3(0.92, 0.96, 1.0), grout * 0.55 * aa);
    // depth: the far end of the pool is lit pink, the near end sinks into teal-violet
    float dn = dy / (1.0 - VP_HZ);
    tc = mix(vec3(1.0, 0.66, 0.84), tc, smoothstep(0.0, 0.34, dn) * 0.85 + 0.15);
    tc *= 1.0 - 0.34 * smoothstep(0.35, 1.0, dn);
    // caustics
    vec2 cp = floorP * 0.55;
    float c1 = sin(cp.x * 3.1 + sin(cp.y * 2.3 + t * 0.5) * 1.6 + t * 0.35);
    float c2 = sin(cp.y * 3.7 + sin(cp.x * 2.7 - t * 0.4) * 1.5 - t * 0.28);
    float cau = pow(1.0 - abs(sin((c1 + c2) * 1.6)), 6.0);
    float under = 0.55 + 0.9 * exp(-pow((p.x - 0.52 * asp) / 0.5, 2.0));
    tc += vec3(0.85, 1.0, 1.0) * cau * 0.24 * aa * under;
    tc += vec3(1.0, 0.85, 1.0) * pow(max(wave, 0.0), 1.5) * 0.55;
    // soft reflection of the sun on the glossy tiles
    float rs = exp(-pow((p.x - 0.52 * asp) / 0.12, 2.0)) * exp(-dn * 5.0);
    tc += vec3(1.0, 0.75, 0.80) * rs * 0.20 * (0.6 + 0.4 * cau);
    col = tc;
    // near edge of the rim: a thin shadow line under the coping
    col *= 1.0 - 0.45 * smoothstep(0.012, 0.0, dy);
  }

  // let the user's own wallpaper show through the dream
  vec3 wt = mix(vec3(vp_luma(w)), w, 0.7) * vec3(1.0, 0.92, 1.05);
  col = col * (0.90 + 0.2 * vp_luma(w)) + wt * 0.05;
  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
