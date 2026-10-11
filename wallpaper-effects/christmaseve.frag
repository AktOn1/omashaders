// label: Christmas Eve
// hint: a snowy night seen through a frosted window frame: a fir tree with warm fairy lights, a glowing house window, a twinkling star and soft snow; the pointer swirls the snowflakes and makes the tree lights twinkle near it
// category: Holidays
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

float ce_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 ce_h2(vec2 p) { return vec2(ce_h(p), ce_h(p + 19.19)); }
float ce_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ce_h(i), ce_h(i + vec2(1.0, 0.0)), f.x), mix(ce_h(i + vec2(0.0, 1.0)), ce_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ce_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * ce_n(p); p = p * 2.03 + 11.0; a *= 0.5; }
  return v;
}
float ce_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// the snowy ground line (in uv.y) at aspect-space x
float ce_hill(float x) { return 0.77 + 0.025 * sin(x * 1.6 + 1.0) + 0.012 * sin(x * 4.1 + 2.0); }

// half width of the fir tree at height y (aspect space); 0 outside the tree
const float CE_TOP = 0.27;
const float CE_BASE = 0.80;
float ce_treeHW(float y, float seed) {
  if (y < CE_TOP || y > CE_BASE) return 0.0;
  float k = (y - CE_TOP) / (CE_BASE - CE_TOP);
  float f = fract(k * 6.0 + 0.2);
  float tier = 0.62 + 0.38 * f;                      // each tier flares out toward its lower edge, then steps in
  return 0.185 * pow(k, 0.92) * tier + 0.004;
}

// one depth of falling snow, sampled in swirled aspect-space coordinates
float ce_snow(vec2 p, float sc, float fall, float rad, float seed, float keep) {
  vec2 g = p * sc;
  g.y -= time * fall;
  g.x += sin(time * 0.17 + seed) * 0.8 + time * fall * 0.10;
  vec2 id = floor(g);
  float acc = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = id + vec2(float(i), float(j));
      float h = ce_h(cell + seed);
      if (h > keep) continue;
      vec2 hh = ce_h2(cell + seed + 4.7);
      vec2 c = cell + 0.5 + (hh - 0.5) * 0.62;
      c.x += 0.28 * sin(time * (0.35 + 0.4 * hh.x) + h * 60.0 + c.y * 0.9);
      float d = length(g - c);
      float rr = rad * (0.65 + 0.7 * hh.y);
      float a = smoothstep(rr, rr * 0.4, d) + 0.12 * smoothstep(rr * 3.0, 0.0, d);
      acc += a * (0.55 + 0.45 * ce_h(cell + seed + 9.1));
    }
  }
  return acc;
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
  float wl = ce_luma(w);

  float hy = ce_hill(p.x);
  vec2 tree = vec2(asp * 0.35, 0.0);
  vec2 house = vec2(asp * 0.745, 0.0);

  // ---- night sky: deep blue, the picture tinted blue shows faintly through
  vec3 skyTop = vec3(0.020, 0.035, 0.125);
  vec3 skyLow = vec3(0.115, 0.170, 0.360);
  vec3 sky = mix(skyTop, skyLow, pow(smoothstep(0.0, 0.80, uv.y), 1.4));
  vec3 wb = vec3(wl) * vec3(0.45, 0.62, 1.0) * 1.1 + w * 0.15;
  sky = mix(sky, wb, 0.30);
  // snow-laden clouds lit from below, barely there
  sky += vec3(0.05, 0.07, 0.12) * smoothstep(0.45, 0.85, ce_fbm(vec2(p.x * 1.1 + t * 0.004, uv.y * 2.4))) * (1.0 - uv.y);
  vec3 col = sky;

  // small faint stars
  {
    vec2 g = p / 0.055;
    vec2 id = floor(g);
    float h = ce_h(id);
    vec2 c = id + 0.2 + 0.6 * ce_h2(id + 3.0);
    float d = length((g - c));
    float tw = 0.6 + 0.4 * sin(t * (0.8 + 2.0 * h) + h * 50.0);
    col += vec3(0.75, 0.85, 1.0) * step(0.78, h) * exp(-d * d / 0.0035) * tw * 0.8 * smoothstep(0.55, 0.15, uv.y);
  }
  // the big star above the house and tree: soft cross of light, twinkling
  {
    vec2 sp = vec2(asp * 0.53, 0.155);
    vec2 d = p - sp;
    float tw = 0.78 + 0.22 * sin(t * 1.9) * sin(t * 0.7 + 1.0) + 0.12 * sin(t * 3.1);
    float core = exp(-dot(d, d) / 0.00005);
    float glow = exp(-dot(d, d) / 0.0016);
    float cross1 = exp(-abs(d.x) * 220.0) * exp(-abs(d.y) * 11.0);
    float cross2 = exp(-abs(d.y) * 220.0) * exp(-abs(d.x) * 11.0);
    vec2 r = vec2(d.x + d.y, d.x - d.y) * 0.7071;
    float diag = exp(-abs(r.x) * 260.0) * exp(-abs(r.y) * 24.0) + exp(-abs(r.y) * 260.0) * exp(-abs(r.x) * 24.0);
    col += vec3(1.0, 0.95, 0.80) * (core * 1.6 + glow * 0.22 + (cross1 + cross2) * 0.9 + diag * 0.35) * tw;
  }

  // ---- far treeline: little firs along the horizon, hazy blue-black
  {
    float cx = p.x * 11.0;
    float cid = floor(cx);
    float hh = ce_h(vec2(cid, 2.0));
    float tri = 1.0 - abs(2.0 * fract(cx) - 1.0);
    float top = hy - 0.012 - (0.015 + 0.045 * hh) * tri - 0.012 * ce_n(vec2(p.x * 3.0, 4.0));
    float far = smoothstep(top, top + 0.004, uv.y);
    vec3 fc = vec3(0.025, 0.055, 0.105) + vec3(0.03, 0.05, 0.09) * smoothstep(top, top + 0.10, uv.y);
    col = mix(col, fc, far);
  }

  // ---- snowy ground: blue-white drifts under the night, warm pools from the window and the tree
  float gm = smoothstep(hy - 0.002, hy + 0.004, uv.y);
  if (gm > 0.0) {
    float depth = clamp((uv.y - hy) / (1.0 - hy), 0.0, 1.0);
    vec3 sn = mix(vec3(0.36, 0.46, 0.68), vec3(0.20, 0.27, 0.46), pow(depth, 0.7));
    float drift = ce_fbm(vec2(p.x * 3.0, uv.y * 14.0) + 5.0);
    sn *= 0.80 + 0.40 * drift;
    sn += vec3(0.05, 0.07, 0.10) * smoothstep(0.55, 0.9, ce_n(vec2(p.x * 20.0, uv.y * 60.0)));      // faint wind ripples
    // warm window spill in front of the house
    vec2 wd = (p - vec2(house.x - 0.04, hy + 0.055)) * vec2(1.0, 2.6);
    sn += vec3(1.0, 0.62, 0.26) * exp(-dot(wd, wd) / 0.030) * 0.34;
    // fairy light pool around the tree's foot, red and gold
    vec2 td = (p - vec2(tree.x, CE_BASE + 0.015)) * vec2(1.0, 3.0);
    sn += vec3(1.0, 0.60, 0.28) * exp(-dot(td, td) / 0.055) * 0.30;
    sn += vec3(0.9, 0.18, 0.14) * exp(-dot(td - vec2(0.10, 0.0), td - vec2(0.10, 0.0)) / 0.015) * 0.10;
    // glints of snow
    vec2 g = vec2(p.x, uv.y) * vec2(70.0, 90.0);
    vec2 gi = floor(g);
    float gh = ce_h(gi + 8.0);
    float glint = step(0.93, gh) * exp(-dot(g - gi - 0.5, g - gi - 0.5) * 18.0) * pow(max(0.0, sin(t * (1.0 + gh * 3.0) + gh * 80.0)), 8.0);
    sn += vec3(0.9, 0.95, 1.0) * glint * 0.6;
    col = mix(col, sn, gm);
  }

  // ---- the house: dark body, snowy gable, one glowing window with a wreath on the door
  {
    float hx = p.x - house.x;
    float apex = 0.455;
    float eave = 0.585;
    float wallTop = eave;
    float body = step(abs(hx), 0.165) * step(wallTop, uv.y) * step(uv.y, 0.795);
    float roofLine = apex + (eave + 0.012 - apex) * clamp(abs(hx) / 0.205, 0.0, 1.0);
    float roof = step(abs(hx), 0.205) * step(roofLine, uv.y) * step(uv.y, eave + 0.012);
    float chim = step(abs(p.x - (house.x + 0.095)), 0.016) * step(0.43, uv.y) * step(uv.y, 0.545);
    vec3 wallC = vec3(0.080, 0.070, 0.120);
    vec3 roofC = vec3(0.045, 0.050, 0.095);
    // warm light from the window falls on the wall
    vec2 wc = vec2(house.x - 0.045, 0.675);
    vec2 wd = (p - wc) * vec2(1.0, 1.1);
    float wg = exp(-dot(wd, wd) / 0.012);
    wallC += vec3(0.50, 0.28, 0.10) * wg * 0.55;
    // log-ish horizontal courses
    wallC *= 0.88 + 0.12 * step(0.5, fract(uv.y * 38.0));
    col = mix(col, wallC, body);
    col = mix(col, roofC, max(roof, chim));
    // snow on the roof and on the chimney top
    float snowRoof = roof * smoothstep(0.034, 0.012, uv.y - roofLine) + chim * step(uv.y, 0.445);
    col = mix(col, vec3(0.62, 0.72, 0.92) * (0.85 + 0.15 * ce_n(p * 90.0)), clamp(snowRoof, 0.0, 1.0) * 0.95);
    // the window
    vec2 q = (p - wc) / vec2(0.040, 0.034);
    float pane = step(abs(q.x), 1.0) * step(abs(q.y), 1.0);
    float mull = max(step(abs(q.x), 0.07), step(abs(q.y), 0.08));
    vec3 lit = mix(vec3(1.0, 0.70, 0.30), vec3(1.0, 0.88, 0.55), exp(-dot(q, q) * 0.8));
    lit *= 0.92 + 0.08 * sin(t * 2.3 + 1.0) * sin(t * 0.9);        // a candle breathes behind the glass
    col = mix(col, lit, pane * (1.0 - 0.9 * mull));
    col = mix(col, vec3(0.05, 0.035, 0.05), pane * mull * 0.8);
    float sill = step(abs(q.x), 1.25) * step(abs(q.y - 1.10), 0.16);
    col = mix(col, vec3(0.70, 0.78, 0.95), sill * 0.9);             // snow on the sill
    col += vec3(1.0, 0.62, 0.26) * wg * 0.18 * (1.0 - body) * step(uv.y, hy);   // halo in the air
    // door with a wreath
    vec2 dc = vec2(house.x + 0.095, 0.742);
    vec2 dq = (p - dc) / vec2(0.026, 0.050);
    float door = step(abs(dq.x), 1.0) * step(abs(dq.y), 1.0);
    col = mix(col, vec3(0.30, 0.055, 0.06) + vec3(0.25, 0.13, 0.05) * wg * 0.5, door * 0.95);
    vec2 wr = p - (dc + vec2(0.0, -0.020));
    float wrr = abs(length(wr) - 0.0145);
    float ring = smoothstep(0.0055, 0.002, wrr);
    float berries = smoothstep(0.003, 0.0012, length(wr - vec2(0.0110, 0.006))) + smoothstep(0.003, 0.0012, length(wr - vec2(-0.008, 0.011)))
                  + smoothstep(0.003, 0.0012, length(wr - vec2(0.002, -0.0145)));
    col = mix(col, vec3(0.06, 0.28, 0.12), ring * 0.95);
    col = mix(col, vec3(1.0, 0.22, 0.18), clamp(berries, 0.0, 1.0));
    float bow = smoothstep(0.005, 0.002, length((wr - vec2(0.0, 0.0155)) * vec2(0.7, 1.0)));
    col = mix(col, vec3(0.95, 0.15, 0.15), bow);
  }

  // ---- the fir tree: layered dark green tiers, snow on the edges, warm fairy lights
  {
    float y = uv.y;
    float hw = ce_treeHW(y, 0.0);
    float edge = ce_n(vec2(y * 70.0, 3.0)) * 0.012 + ce_n(vec2(y * 190.0, 9.0)) * 0.006;
    float dx = abs(p.x - tree.x);
    float inside = step(dx, hw + edge) * step(CE_TOP, y) * step(y, CE_BASE);
    float trunk = step(abs(p.x - tree.x), 0.018) * step(CE_BASE - 0.005, y) * step(y, CE_BASE + 0.030);
    float k = clamp((y - CE_TOP) / (CE_BASE - CE_TOP), 0.0, 1.0);
    float f = fract(k * 6.0 + 0.2);
    // needles: fine bristly noise, darker toward the middle, brighter at the tier edges
    float needles = ce_n(vec2(p.x * 120.0, y * 90.0)) * 0.6 + ce_n(vec2(p.x * 260.0 + y * 40.0, y * 200.0)) * 0.4;
    vec3 g1 = vec3(0.010, 0.060, 0.040);
    vec3 g2 = vec3(0.045, 0.190, 0.100);
    vec3 tc = mix(g1, g2, needles * (0.4 + 0.8 * smoothstep(0.55, 1.0, f)) * (0.5 + 0.8 * dx / max(hw, 0.01)));
    // the pointer side: warm light from the fairy lights spills over the needles
    vec2 lg = p - vec2(tree.x, 0.55);
    tc += vec3(0.45, 0.28, 0.08) * exp(-dot(lg * vec2(1.8, 0.9), lg * vec2(1.8, 0.9)) / 0.12) * needles * 0.9;
    // snow resting on the tier tops
    float snowTier = smoothstep(0.14, 0.0, f) * step(0.45, ce_n(vec2(p.x * 40.0, floor(k * 6.0 + 0.2))));
    tc = mix(tc, vec3(0.62, 0.72, 0.92), snowTier * 0.55 * smoothstep(CE_TOP + 0.05, CE_TOP + 0.12, y));
    col = mix(col, tc, inside);
    col = mix(col, vec3(0.06, 0.035, 0.03), trunk * (1.0 - inside));

    // fairy lights: jittered cells, only those inside the tree glow; a few colours, each twinkles; the pointer excites the ones near it
    if (abs(p.x - tree.x) < 0.24 && y > CE_TOP - 0.05 && y < CE_BASE + 0.02) {
      float cs = 0.036;
      vec2 g = p / cs;
      vec2 id = floor(g);
      vec3 acc = vec3(0.0);
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 cell = id + vec2(float(i), float(j));
          float h = ce_h(cell + 31.0);
          vec2 hh = ce_h2(cell + 7.7);
          vec2 c = (cell + 0.5 + (hh - 0.5) * 0.65) * cs;
          float chw = ce_treeHW(c.y, 0.0);
          float ok = step(abs(c.x - tree.x), chw * 0.86) * step(CE_TOP + 0.03, c.y) * step(h, 0.62);
          if (ok < 0.5) continue;
          vec3 lc;
          float hc = ce_h(cell + 5.0);
          if (hc < 0.46) lc = vec3(1.0, 0.76, 0.34);
          else if (hc < 0.70) lc = vec3(1.0, 0.22, 0.16);
          else if (hc < 0.84) lc = vec3(0.50, 1.0, 0.55);
          else lc = vec3(1.0, 0.92, 0.78);
          float near = hasM ? exp(-dot(c - mp, c - mp) / 0.030) : 0.0;
          float tw0 = 0.62 + 0.38 * sin(t * (0.9 + 1.4 * hh.x) + h * 60.0);
          float tw1 = 0.45 + 0.55 * sin(t * (5.0 + 3.0 * hh.y) + h * 90.0);
          float tw = mix(tw0, tw1, near);
          float boost = 1.0 + 1.3 * near;
          float d2 = dot(g * cs - c, g * cs - c);
          float v = exp(-d2 / 0.000016) * 1.3 + exp(-d2 / 0.00024) * 0.42 + exp(-d2 / 0.0016) * 0.07;
          acc += lc * v * tw * boost;
        }
      }
      col += acc;
    }
    // star on top
    {
      vec2 d = p - vec2(tree.x, CE_TOP - 0.004);
      float tw = 0.85 + 0.15 * sin(t * 2.6);
      float core = exp(-dot(d, d) / 0.000028);
      float cr = (exp(-abs(d.x) * 330.0) * exp(-abs(d.y) * 38.0) + exp(-abs(d.y) * 330.0) * exp(-abs(d.x) * 38.0));
      col += vec3(1.0, 0.86, 0.45) * (core * 1.5 + cr * 0.8 + exp(-dot(d, d) / 0.0007) * 0.22) * tw;
    }
  }

  // ---- snow in three depths; near the pointer the whole field is twisted into a swirl
  {
    vec2 pq = p;
    if (hasM) {
      vec2 dd = p - mp;
      float dl = length(dd);
      float ang = 1.25 * exp(-dl * dl / 0.090);
      float cs2 = cos(ang), sn2 = sin(ang);
      pq = mp + vec2(cs2 * dd.x - sn2 * dd.y, sn2 * dd.x + cs2 * dd.y);
    }
    float s1 = ce_snow(pq, 28.0, 0.50, 0.085, 3.0, 0.55);
    float s2 = ce_snow(pq + 0.17, 16.0, 0.80, 0.110, 11.0, 0.50);
    float s3 = ce_snow(pq + 0.43, 8.0, 1.15, 0.150, 23.0, 0.42);
    float snow = s1 * 0.40 + s2 * 0.62 + s3 * 0.60;
    col += vec3(0.82, 0.90, 1.0) * snow;
  }

  // ---- frost on the window pane: feathery ice growing in from the edges and corners, the middle stays clear
  {
    float ex = min(uv.x * asp, (1.0 - uv.x) * asp);
    float ey = min(uv.y, 1.0 - uv.y);
    float fd = ex * ey / (ex + ey + 0.0001);
    float n1 = ce_fbm(p * 5.0);
    float n2 = ce_fbm(p * 14.0 + 7.0);
    float thick = 0.040 + 0.060 * n1;
    float fa = smoothstep(thick, thick * 0.10, fd + (n2 - 0.5) * 0.040);
    // ice ferns: ridged noise at two scales, stretched away from the edge
    float rid = 1.0 - abs(2.0 * ce_n(p * vec2(60.0, 60.0) + n1 * 6.0) - 1.0);
    float rid2 = 1.0 - abs(2.0 * ce_n(p * 150.0 + 2.0) - 1.0);
    float fern = smoothstep(0.84, 0.985, rid) * 0.55 + smoothstep(0.90, 0.995, rid2) * 0.40;
    vec3 ice = vec3(0.66, 0.82, 0.98) * (0.50 + 0.45 * n2) * (1.0 + 0.5 * smoothstep(0.05, 0.0, fd)) + vec3(0.9, 0.96, 1.0) * fern * 0.45;
    col = mix(col, ice, fa * 0.70);
    // thin bright rim where the frost ends
    col += vec3(0.5, 0.7, 0.95) * smoothstep(0.03, 0.0, abs(fd + (n2 - 0.5) * 0.045 - thick * 0.62)) * 0.10 * smoothstep(0.0, 0.15, fd);
    // the glow of the window and tree shows through the frost as a warm blur
    vec2 tw = (p - vec2(tree.x, 0.55)) * vec2(1.0, 0.8);
    col += vec3(1.0, 0.65, 0.30) * fa * exp(-dot(tw, tw) / 0.20) * 0.06;
  }

  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
