// label: Winter market
// hint: an evening Christmas market: stalls with striped roofs in silhouette, strings of lights, steam rising from a mulled-wine pot, light snow and warm bokeh that brightens near the pointer
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

float wm_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 wm_h2(vec2 p) { return vec2(wm_h(p), wm_h(p + 19.19)); }
float wm_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wm_h(i), wm_h(i + vec2(1.0, 0.0)), f.x), mix(wm_h(i + vec2(0.0, 1.0)), wm_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wm_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * wm_n(p); p = p * 2.03 + 11.0; a *= 0.5; }
  return v;
}
float wm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float WM_HY = 0.80;      // where the market square meets the backdrop

// a market stall: striped peaked roof with a scalloped fringe, a glowing opening full of goods, a dark counter with a garland.
// cx = centre (aspect space), base = ground line, w = half width, h = height, haze = how much the night air has eaten it
vec3 wm_stall(vec3 col, vec2 p, float cx, float base, float w, float h, float seed, float haze, float t) {
  float hx = (p.x - cx) / w;
  float y = p.y;
  float eave = base - h * 0.80;
  float apex = base - h * 1.28;
  float counterY = base - h * 0.30;
  vec3 hazeC = vec3(0.13, 0.16, 0.32);
  vec3 outc = col;

  // warm light on the snow in front of the opening
  if (y > base) {
    float gp = exp(-hx * hx / 1.1) * exp(-(y - base) / (h * 0.55));
    outc += vec3(1.0, 0.58, 0.24) * gp * 0.30 * (1.0 - haze * 0.5);
  }
  // a warm halo around the opening that spills into the cold air
  {
    vec2 hd = vec2(hx * 0.9, (y - (eave + counterY) * 0.5) / (h * 0.9));
    outc += vec3(1.0, 0.55, 0.22) * exp(-dot(hd, hd) * 1.6) * 0.07 * (1.0 - haze * 0.5);
  }

  float roofLine = apex + (eave - apex) * clamp(abs(hx) / 1.10, 0.0, 1.0);
  float sc = 1.0 - abs(2.0 * fract(hx * 4.4) - 1.0);
  float eaveB = eave + h * 0.075 * sc;
  float inRoof = step(abs(hx), 1.10) * step(roofLine, y) * step(y, eaveB);
  float inOpen = step(abs(hx), 0.93) * step(eaveB, y) * step(y, counterY);
  float inFront = step(abs(hx), 1.0) * step(counterY, y) * step(y, base);
  float inPost = step(abs(abs(hx) - 0.96), 0.045) * step(eave, y) * step(y, base);

  // opening: glowing interior with shelves and small goods in silhouette
  if (inOpen > 0.0) {
    float yy = (y - eave) / (counterY - eave);
    vec3 glow = mix(vec3(0.42, 0.18, 0.07), vec3(1.0, 0.66, 0.30), smoothstep(0.0, 1.0, yy));
    glow *= 0.94 + 0.06 * sin(t * 2.1 + seed * 9.0);
    vec2 g = vec2(hx * 6.5, yy * 3.0);
    vec2 id = floor(g);
    vec2 f = fract(g);
    float hh = wm_h(id + seed);
    float item = step(0.50, hh) * smoothstep(0.34, 0.26, length((f - vec2(0.5, 0.36)) * vec2(1.0, 1.15)));
    vec3 itemC = mix(vec3(0.20, 0.08, 0.05), vec3(0.55, 0.22, 0.10), wm_h(id + seed + 4.0));
    if (wm_h(id + seed + 8.0) > 0.86) itemC = vec3(1.0, 0.90, 0.62);              // a few bright mugs and candles
    float shelf = smoothstep(0.10, 0.04, f.y) * 0.7;
    vec3 c = mix(glow, itemC, item);
    c = mix(c, vec3(0.16, 0.07, 0.04), shelf);
    // light falls off toward the posts
    c *= 0.70 + 0.30 * smoothstep(1.0, 0.2, abs(hx));
    outc = mix(outc, c, inOpen);
  }
  // counter front: dark cloth under a pine garland dotted with tiny lights
  if (inFront > 0.0) {
    vec3 c = vec3(0.075, 0.035, 0.050) + vec3(0.18, 0.08, 0.04) * exp(-(y - counterY) / (h * 0.18)) * 0.8;
    float gar = smoothstep(h * 0.085, h * 0.03, y - counterY - 0.004 * sin(hx * 22.0));
    c = mix(c, vec3(0.04, 0.20, 0.09) * (0.7 + 0.6 * wm_n(p * 120.0)), gar);
    float dots = step(0.82, wm_h(vec2(floor(hx * 14.0), seed))) * smoothstep(0.018, 0.0, length(vec2(fract(hx * 14.0) - 0.5, (y - counterY - h * 0.045) / (h * 0.30))));
    c += vec3(1.0, 0.45, 0.30) * dots * gar;
    outc = mix(outc, c, inFront);
  }
  outc = mix(outc, vec3(0.070, 0.040, 0.045), inPost * (1.0 - inOpen));
  // striped roof, lit from the lights under its eave, with snow on top
  if (inRoof > 0.0) {
    float stripe = mod(floor((hx + 1.1) * 5.0), 2.0);
    vec3 rc = mix(vec3(0.60, 0.075, 0.09), vec3(0.80, 0.62, 0.44), stripe);
    float under = smoothstep(h * 0.45, 0.0, eaveB - y);
    float lightRoof = 0.30 + 0.55 * under;
    rc *= lightRoof;
    rc += vec3(1.0, 0.55, 0.25) * under * 0.10;
    float snowTop = smoothstep(h * 0.12, h * 0.04, y - roofLine + 0.012 * (wm_n(vec2(p.x * 30.0, seed)) - 0.5));
    rc = mix(rc, vec3(0.62, 0.72, 0.92) * 0.85, snowTop * 0.92);
    outc = mix(outc, rc, inRoof);
  }
  // the haze only veils the stall itself, not the snow and glow around it
  float body = clamp(inRoof + inOpen + inFront + inPost, 0.0, 1.0);
  return mix(outc, mix(outc, hazeC, haze), body);
}

// bokeh: big soft out-of-focus lamps, one per cell, brighter near the pointer
vec3 wm_bokeh(vec2 p, vec2 mp, bool hasM, float cs, float seed, float keep, float t) {
  vec2 g = p / cs;
  vec2 id = floor(g);
  float h = wm_h(id + seed);
  if (h > keep) return vec3(0.0);
  vec2 hh = wm_h2(id + seed + 5.0);
  vec2 c = (id + 0.5 + (hh - 0.5) * 0.30) * cs;
  float r = cs * (0.20 + 0.17 * wm_h(id + seed + 9.0));
  float d = length(p - c);
  float cc = wm_h(id + seed + 2.0);
  vec3 lc = cc < 0.40 ? vec3(1.0, 0.62, 0.18) : (cc < 0.65 ? vec3(1.0, 0.36, 0.10) : (cc < 0.82 ? vec3(1.0, 0.18, 0.16) : vec3(1.0, 0.80, 0.45)));
  float near = hasM ? exp(-dot(c - mp, c - mp) / 0.05) : 0.0;
  float pulse = 0.65 + 0.35 * sin(t * (0.25 + 0.4 * hh.x) + h * 40.0);
  float disc = smoothstep(r, r * 0.80, d) * 0.55 + smoothstep(r * 1.0, r * 0.88, d) * smoothstep(r * 0.70, r * 0.94, d) * 0.45;
  float amt = pulse * (1.0 + 3.0 * near);
  return lc * lc * disc * amt * 0.42 * smoothstep(0.80, 0.50, c.y) * smoothstep(0.05, 0.30, c.y);
}

// one depth of light snowfall
float wm_snow(vec2 p, float sc, float fall, float rad, float seed, float keep) {
  vec2 g = p * sc;
  g.y -= time * fall;
  g.x += sin(time * 0.17 + seed) * 0.8 + time * fall * 0.10;
  vec2 id = floor(g);
  float acc = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = id + vec2(float(i), float(j));
      float h = wm_h(cell + seed);
      if (h > keep) continue;
      vec2 hh = wm_h2(cell + seed + 4.7);
      vec2 c = cell + 0.5 + (hh - 0.5) * 0.62;
      c.x += 0.28 * sin(time * (0.35 + 0.4 * hh.x) + h * 60.0 + c.y * 0.9);
      float d = length(g - c);
      float rr = rad * (0.65 + 0.7 * hh.y);
      acc += (smoothstep(rr, rr * 0.4, d) + 0.12 * smoothstep(rr * 3.0, 0.0, d)) * (0.55 + 0.45 * wm_h(cell + seed + 9.1));
    }
  }
  return acc;
}

// height of a string of lights (aspect space): shallow sags between invisible posts
float wm_wire(float x, float y0, float seg, float sag, float ph) {
  float f = fract(x / seg + ph);
  return y0 + sag * 4.0 * f * (1.0 - f);
}
vec3 wm_string(vec2 p, vec2 mp, bool hasM, float y0, float seg, float sag, float ph, float sp, float seed, float t) {
  float wy = wm_wire(p.x, y0, seg, sag, ph);
  vec3 acc = vec3(0.0);
  float idx = floor(p.x / sp);
  for (int i = -1; i <= 1; i++) {
    float bi = idx + float(i);
    float bx = (bi + 0.5) * sp;
    float by = wm_wire(bx, y0, seg, sag, ph) + 0.010;
    float h = wm_h(vec2(bi, seed));
    vec3 lc = h < 0.42 ? vec3(1.0, 0.76, 0.34) : (h < 0.66 ? vec3(1.0, 0.52, 0.20) : (h < 0.84 ? vec3(1.0, 0.30, 0.22) : vec3(1.0, 0.92, 0.72)));
    float near = hasM ? exp(-dot(vec2(bx, by) - mp, vec2(bx, by) - mp) / 0.045) : 0.0;
    vec2 d = p - vec2(bx, by);
    float tw = 0.85 + 0.15 * sin(t * (0.8 + h * 1.6) + h * 50.0);
    float v = exp(-dot(d, d) / 0.000030) * 1.4 + exp(-dot(d, d) / 0.00040) * 0.40 + exp(-dot(d, d) / 0.0050) * 0.05;
    acc += lc * v * tw * (1.0 + 1.8 * near);
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
  float wl = wm_luma(w);

  // ---- dusk sky: ink blue overhead, a violet-rose afterglow low down; the picture shows faintly through
  vec3 skyTop = vec3(0.035, 0.050, 0.160);
  vec3 skyMid = vec3(0.150, 0.150, 0.340);
  vec3 skyLow = vec3(0.560, 0.330, 0.400);
  float sy = smoothstep(0.0, 0.70, uv.y);
  vec3 sky = mix(skyTop, skyMid, smoothstep(0.0, 0.7, sy));
  sky = mix(sky, skyLow, pow(smoothstep(0.5, 1.0, sy), 1.8) * 0.8);
  sky = mix(sky, vec3(wl) * vec3(0.55, 0.60, 1.0) * 1.1 + w * 0.15, 0.28);
  vec3 col = sky;

  // ---- town behind the market: a church tower and gabled roofs, a few lit windows
  {
    float cx = p.x * 7.5;
    float cid = floor(cx);
    float hh = wm_h(vec2(cid, 11.0));
    float tri = 1.0 - abs(2.0 * fract(cx) - 1.0);
    float top = 0.665 - 0.040 * hh - 0.030 * tri * (0.5 + hh);
    float roofs = step(top, uv.y) * step(uv.y, WM_HY);
    // church tower with a spire
    float tx = asp * 0.30;
    float tw = abs(p.x - tx);
    float tower = step(tw, 0.040) * step(0.40, uv.y);
    float spire = step(tw, 0.044 * (uv.y - 0.29) / 0.11) * step(0.29, uv.y) * step(uv.y, 0.40);
    float town = max(roofs, max(tower, spire));
    vec3 tc = vec3(0.060, 0.070, 0.150) + vec3(0.12, 0.08, 0.14) * smoothstep(0.55, 0.80, uv.y);
    // lit windows
    vec2 wg = vec2(p.x * 22.0, uv.y * 30.0);
    vec2 wi = floor(wg);
    float lit = step(0.80, wm_h(wi + 3.0)) * step(0.20, fract(wg.x)) * step(fract(wg.x), 0.65) * step(0.25, fract(wg.y)) * step(fract(wg.y), 0.70) * roofs * step(top + 0.025, uv.y);
    tc = mix(tc, vec3(1.0, 0.68, 0.32) * 0.85, lit);
    // the clock face on the tower glows too
    tc += vec3(1.0, 0.85, 0.55) * smoothstep(0.012, 0.007, length(vec2(p.x - tx, uv.y - 0.43))) * 0.8;
    col = mix(col, tc, town);
  }

  // ---- the square: snow, cobbles blue in the dark, warm pools added by the stalls
  {
    float gm = smoothstep(WM_HY - 0.002, WM_HY + 0.004, uv.y);
    float depth = clamp((uv.y - WM_HY) / (1.0 - WM_HY), 0.0, 1.0);
    vec3 sn = mix(vec3(0.30, 0.36, 0.60), vec3(0.14, 0.18, 0.34), pow(depth, 0.7));
    float cob = wm_n(vec2(p.x * 40.0, uv.y * 70.0 / (0.3 + depth)));
    sn *= 0.86 + 0.28 * wm_fbm(vec2(p.x * 4.0, uv.y * 16.0)) + 0.06 * cob;
    col = mix(col, sn, gm);
  }

  // ---- far row of stalls, hazy and small
  col = wm_stall(col, p, 0.18, 0.80, 0.115, 0.145, 1.0, 0.55, t);
  col = wm_stall(col, p, 0.66, 0.79, 0.105, 0.135, 2.0, 0.58, t);
  col = wm_stall(col, p, 1.12, 0.805, 0.120, 0.150, 3.0, 0.52, t);
  col = wm_stall(col, p, 1.62, 0.795, 0.110, 0.140, 4.0, 0.56, t);

  // ---- warm bokeh in two depths, over the far row
  col += wm_bokeh(p, mp, hasM, 0.17, 1.0, 0.70, t) + wm_bokeh(p + 0.31, mp, hasM, 0.105, 7.0, 0.55, t);

  // ---- near stalls: a big one at the right with the mulled-wine pot, another cut off at the left edge
  vec2 pot = vec2(asp * 0.745 - 0.105, 0.0);
  col = wm_stall(col, p, 0.02, 0.97, 0.30, 0.37, 5.0, 0.0, t);
  col = wm_stall(col, p, asp * 0.745, 0.93, 0.30, 0.37, 6.0, 0.0, t);
  {
    float counterY = 0.93 - 0.37 * 0.30;
    vec2 pc = vec2(pot.x, counterY - 0.040);
    vec2 q = (p - pc) / vec2(0.042, 0.040);
    vec2 qa = max(abs(q) - vec2(0.55, 0.60), 0.0);
    float body = smoothstep(0.42, 0.32, length(qa)) * step(abs(q.y), 1.0);
    vec3 copper = mix(vec3(0.42, 0.17, 0.07), vec3(0.95, 0.52, 0.22), smoothstep(0.6, -0.6, q.x) * 0.7 + 0.2 * (0.5 - 0.5 * q.y));
    col = mix(col, copper, body);
    // the wine surface at the rim, glowing red
    float rim = step(abs(q.x), 0.80) * step(abs(q.y + 0.92), 0.12);
    col = mix(col, vec3(0.65, 0.10, 0.16), rim);
    col += vec3(1.0, 0.50, 0.30) * exp(-dot(p - pc + vec2(0.0, 0.03), p - pc + vec2(0.0, 0.03)) / 0.0016) * 0.12;
    // a ladle leaning on the pot
    float ladle = step(abs((p.x - pc.x - 0.040) + (p.y - pc.y) * 0.35), 0.0022) * step(pc.y - 0.075, p.y) * step(p.y, pc.y + 0.01);
    col = mix(col, vec3(0.78, 0.60, 0.36), ladle);
    // steam: pale wisps curling up and out, thinning with height
    float steam = 0.0;
    for (int k = 0; k < 3; k++) {
      float kf = float(k);
      float s = (pc.y - 0.040 - p.y) / 0.30;
      if (s > 0.0 && s < 1.0) {
        float cxk = pc.x + (kf - 1.0) * 0.012 + sin(s * 6.0 + t * 0.8 + kf * 2.1) * (0.004 + 0.018 * s) + s * 0.015;
        float wd = 0.009 + 0.032 * s;
        float dn = exp(-pow((p.x - cxk) / wd, 2.0));
        float nz = wm_n(vec2((p.x - cxk) * 55.0 + kf * 5.0, s * 5.5 - t * 0.55 + kf * 3.7));
        steam += dn * (0.35 + 0.9 * nz) * pow(1.0 - s, 1.3) * smoothstep(0.0, 0.08, s);
      }
    }
    col = mix(col, vec3(1.0, 0.92, 0.84), clamp(steam * 0.95, 0.0, 0.80));
  }

  // ---- strings of lights across the square
  col += wm_string(p, mp, hasM, 0.34, 0.55, 0.050, 0.00, 0.075, 2.0, t) + wm_string(p, mp, hasM, 0.21, 0.48, 0.040, 0.37, 0.085, 5.0, t) * 0.8;
  // the wires themselves, thin and dark
  {
    float wy1 = wm_wire(p.x, 0.34, 0.55, 0.050, 0.00);
    float wy2 = wm_wire(p.x, 0.21, 0.48, 0.040, 0.37);
    float wire = smoothstep(0.0017, 0.0005, abs(p.y - wy1)) + smoothstep(0.0017, 0.0005, abs(p.y - wy2));
    col = mix(col, vec3(0.03, 0.03, 0.06), clamp(wire, 0.0, 1.0) * 0.6);
  }

  // ---- light snowfall, two depths
  {
    float s1 = wm_snow(p, 24.0, 0.45, 0.080, 3.0, 0.45);
    float s2 = wm_snow(p + 0.29, 10.0, 0.85, 0.130, 17.0, 0.40);
    vec3 sc = mix(vec3(0.80, 0.88, 1.0), vec3(1.0, 0.86, 0.66), exp(-pow(abs(p.y - 0.60) * 2.0, 2.0)) * 0.3);
    col += sc * (s1 * 0.38 + s2 * 0.55);
  }

  col *= 1.0 - 0.30 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
