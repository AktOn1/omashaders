// label: Ramen skyline
// hint: a high rooftop noodle bar at night: a steaming bowl under a lantern-hung awning and a glowing sign, megacity towers behind with slowly blinking red aircraft lights, and the steam curls toward the pointer
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
float rs_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rs_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rs_hash(i), rs_hash(i + vec2(1, 0)), f.x), mix(rs_hash(i + vec2(0, 1)), rs_hash(i + vec2(1, 1)), f.x), f.y);
}
float rs_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * rs_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float rs_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float rs_ell(vec2 p, vec2 c, vec2 r, float soft) { return smoothstep(1.0, 1.0 - soft, length((p - c) / r)); }
float rs_box(vec2 p, vec2 c, vec2 h, float soft) {
  vec2 d = abs(p - c) - h;
  return 1.0 - smoothstep(0.0, soft, max(d.x, d.y));
}
// distance to a segment
float rs_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// a neon tube: bright core plus a halo from a distance
vec2 rs_tube(float d) { return vec2(smoothstep(0.0042, 0.0012, d), exp(-d * 95.0) * 0.45); }

const float RS_BASE = 0.80;     // street level of the megacity far below the roof
const float RS_PARA = 0.757;    // top of the roof parapet

// one ring of towers: returns (mask, window light, window hue, rim light); lamp = blinking aircraft light
vec4 rs_tower(vec2 p, float sc, float seed, float hmin, float hmax, float pitch, float t, out float lamp) {
  float x = p.x * sc + seed * 13.7;
  float id = floor(x), fx = fract(x);
  float hh = rs_hash(vec2(id, seed));
  float tall = step(0.74, rs_hash(vec2(id, seed + 5.0)));
  float height = hmin + hmax * hh * hh + 0.10 * tall;
  float gl = 0.03 + 0.10 * rs_hash(vec2(id, seed + 2.0));
  float gr = 0.03 + 0.10 * rs_hash(vec2(id, seed + 3.0));
  float hy = RS_BASE - p.y;
  float bodyH = height * 0.68;
  float body = step(gl, fx) * step(fx, 1.0 - gr) * step(hy, bodyH);
  float up = step(gl + 0.16, fx) * step(fx, 1.0 - gr - 0.16) * step(hy, height);
  float mastH = height + 0.075 * tall;
  float mast = step(abs(fx - 0.5), 0.010) * step(hy, mastH);
  float m = max(max(body, up), mast) * step(0.0, hy);
  vec2 wg = vec2((fx - gl) / sc / pitch, hy / (pitch * 1.55));
  vec2 wi = floor(wg), wf = fract(wg);
  float on = step(0.58 + 0.28 * rs_hash(vec2(id, seed + 13.0)), rs_hash(wi + id * 7.3 + seed));
  on *= 0.75 + 0.25 * sin(t * 0.25 + rs_hash(wi + id) * 40.0);
  float cell = smoothstep(0.12, 0.28, wf.x) * smoothstep(0.88, 0.72, wf.x) * smoothstep(0.18, 0.34, wf.y) * smoothstep(0.84, 0.70, wf.y);
  float win = on * cell * m;
  float hue = rs_hash(wi + id + seed * 3.0);
  float rimSide = rs_hash(vec2(id, seed + 9.0));
  float edge = rimSide > 0.5 ? (fx - gl) : (1.0 - gr - fx);
  float rim = smoothstep(0.030, 0.0, edge) * m * step(0.60, rs_hash(vec2(id, seed + 11.0)));
  // the aircraft lamp on the mast of the tall ones: a slow red pulse, each tower on its own beat
  vec2 lp = vec2((fx - 0.5) / sc, hy - mastH);
  float beat = 0.5 + 0.5 * sin(t * 2.4 + rs_hash(vec2(id, seed + 17.0)) * 6.28);
  beat = pow(beat, 5.0);
  lamp = tall * (exp(-dot(lp, lp) / 0.000012) * 1.0 + exp(-dot(lp, lp) / 0.00045) * 0.30) * (0.12 + 0.88 * beat);
  return vec4(m, win, hue, rim);
}

// steam: a plume rising from base, leaning by 'lean', returns density 0..1
float rs_steam(vec2 p, vec2 base, float lean, float t, float size) {
  float h = base.y - p.y;
  if (h < 0.0) return 0.0;
  float hn = h / (0.42 * size);
  float off = lean * hn * hn * 0.34 * size + 0.018 * size * sin(h * 11.0 / size - t * 0.8) * hn;
  float x = p.x - base.x - off;
  float width = (0.030 + 0.105 * hn) * size;
  float core = exp(-x * x / (width * width));
  vec2 q = vec2(x * 9.0 / size + 0.3 * sin(h * 6.0 / size + t * 0.5), h * 5.0 / size - t * 0.55);
  float n = rs_fbm(q);
  float wisps = smoothstep(0.24, 0.66, n + 0.34 * (1.0 - hn));
  float fade = smoothstep(0.0, 0.025 * size, h) * (1.0 - smoothstep(0.35, 1.0, hn));
  return clamp(core * wisps * fade * 1.15, 0.0, 1.0);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);
  float pl = rs_luma(pic);

  // ---- stall geometry (everything is relative to the width, so it works on any aspect)
  float sx0 = asp * 0.57, sx1 = asp * 0.93;
  float cx = 0.5 * (sx0 + sx1), sw = sx1 - sx0;
  float roofBot = 0.335;
  float counterY = 0.668;
  vec2 bowlC = vec2(sx0 + sw * 0.70, counterY - 0.020);
  vec2 potC = vec2(sx0 + sw * 0.24, counterY - 0.030);

  // ---- the city: indigo sky going sodium-pink at the roofline, towers fading into smog
  float hy = max(RS_BASE - p.y, 0.0);
  vec3 col = mix(vec3(0.70, 0.22, 0.30), vec3(0.075, 0.045, 0.20), pow(smoothstep(0.0, 0.62, hy), 0.5));
  col = mix(col, vec3(0.012, 0.012, 0.06), smoothstep(0.35, 0.80, hy) * 0.8);
  float fog = 0.55 + 0.9 * rs_fbm(vec2(p.x * 2.0 - t * 0.01, p.y * 3.4 + t * 0.005));
  col += vec3(0.40, 0.12, 0.28) * 0.20 * fog * exp(-hy * 3.2);
  col += vec3(0.55, 0.62, 1.00) * pl * 0.30 * smoothstep(0.10, 0.45, hy);          // the picture's own stars through the haze
  vec3 smog = vec3(0.52, 0.20, 0.34);
  float lampSum = 0.0;
  for (int l = 0; l < 3; l++) {
    float lf = float(l);
    float sc = l == 0 ? 15.0 : (l == 1 ? 8.5 : 5.2);
    float hmin = l == 0 ? 0.20 : (l == 1 ? 0.12 : 0.05);
    float hmax = l == 0 ? 0.40 : (l == 1 ? 0.40 : 0.30);
    float pitch = l == 0 ? 0.0046 : (l == 1 ? 0.0082 : 0.0130);
    float lamp;
    vec4 tw = rs_tower(p, sc, lf * 1.7 + 0.4, hmin, hmax, pitch, t, lamp);
    float depthFog = l == 0 ? 0.74 : (l == 1 ? 0.46 : 0.20);
    float haze = clamp(depthFog * (0.75 + 0.5 * fog) + smoothstep(0.16, 0.0, hy) * 0.35, 0.0, 0.92);
    vec3 body = mix(vec3(0.018, 0.016, 0.050), vec3(0.07, 0.04, 0.12), smoothstep(0.0, 0.35, hy) * 0.6);
    vec3 lsm = l == 0 ? vec3(0.44, 0.18, 0.38) : (l == 1 ? vec3(0.30, 0.11, 0.30) : vec3(0.18, 0.06, 0.22));
    body = mix(body, lsm, haze);
    float hu = tw.z;
    vec3 wcol = hu < 0.55 ? vec3(1.0, 0.62, 0.28) : (hu < 0.86 ? vec3(1.0, 0.36, 0.45) : vec3(0.35, 0.85, 1.0));
    body += wcol * tw.y * (0.80 - 0.5 * haze);
    body += vec3(1.0, 0.35, 0.55) * tw.w * (0.5 - 0.3 * haze) * (1.0 - 0.5 * pl);
    col = mix(col, body, tw.x);
    lampSum += lamp * (l == 2 ? 0.0 : 1.0);
  }
  col += vec3(1.0, 0.12, 0.10) * lampSum * 1.1;
  col = mix(col, smog, exp(-hy * 9.0) * 0.45 * (0.6 + 0.6 * fog));

  // two far aircraft crossing the sky: a red and white strobe pair, very slow
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float ax = mod(t * (0.012 + 0.006 * fi) + 0.37 * fi, 1.3) * asp * 1.1 - 0.1;
    if (i == 1) ax = asp - ax;
    vec2 ap = vec2(ax, 0.20 + 0.12 * fi);
    float d2 = dot(p - ap, p - ap);
    float bl = 0.5 + 0.5 * sin(t * (4.0 + fi) + fi * 2.0);
    col += vec3(1.0, 0.2, 0.2) * exp(-d2 / 0.000006) * (0.4 + 0.6 * step(0.7, bl));
    col += vec3(0.9, 0.95, 1.0) * exp(-dot(p - ap - vec2(0.011, 0.0), p - ap - vec2(0.011, 0.0)) / 0.000004) * step(0.93, fract(t * 0.7 + fi * 0.3));
  }

  // ---- water tank on the left of the roof, a dark silhouette against the glow, with its own red lamp
  {
    float tx = asp * 0.27;
    float tank = rs_box(p, vec2(tx, 0.485), vec2(0.075, 0.062), 0.003);
    float topC = rs_ell(p, vec2(tx, 0.425), vec2(0.082, 0.020), 0.15) * step(p.y, 0.43);
    float cone = step(abs(p.x - tx), 0.082 * clamp((0.425 - p.y) / 0.045 * -1.0 + 1.0, 0.0, 1.0)) * step(0.385, p.y) * step(p.y, 0.425);
    float legs = (step(abs(abs(p.x - tx) - 0.060), 0.003) + step(abs(abs(p.x - tx) - 0.020), 0.0022)) * step(0.545, p.y) * step(p.y, RS_PARA + 0.004);
    float brace = smoothstep(0.003, 0.0, rs_seg(p, vec2(tx - 0.06, 0.56), vec2(tx + 0.02, 0.70))) + smoothstep(0.003, 0.0, rs_seg(p, vec2(tx + 0.06, 0.56), vec2(tx - 0.02, 0.70)));
    float band = step(abs(p.y - 0.47), 0.0018) + step(abs(p.y - 0.51), 0.0018);
    float ant = step(abs(p.x - tx), 0.0014) * step(0.31, p.y) * step(p.y, 0.39);
    float ts = clamp(max(max(tank, topC), max(max(cone, legs), max(brace, ant))), 0.0, 1.0);
    vec3 tcol = vec3(0.012, 0.010, 0.030) + vec3(0.30, 0.10, 0.25) * 0.10 * smoothstep(0.55, 0.40, abs(p.x - tx) * 6.0 - 0.0) * (1.0 - smoothstep(0.38, 0.58, p.y));
    tcol += vec3(0.30, 0.10, 0.25) * band * tank * 0.25;
    col = mix(col, tcol, ts);
    float beat = pow(0.5 + 0.5 * sin(t * 2.4 + 1.3), 5.0);
    vec2 lp = p - vec2(tx, 0.31);
    col += vec3(1.0, 0.12, 0.10) * (exp(-dot(lp, lp) / 0.000012) + exp(-dot(lp, lp) / 0.0006) * 0.3) * (0.12 + 0.88 * beat);
  }

  // ---- parapet and rooftop: dark concrete, a lit rim on the edge
  float para = smoothstep(RS_PARA - 0.002, RS_PARA + 0.001, p.y);
  vec3 roofC = mix(vec3(0.05, 0.035, 0.09), vec3(0.015, 0.012, 0.035), smoothstep(RS_PARA, 1.0, p.y));
  float slab = smoothstep(0.015, 0.0, abs(fract((p.x - asp * 0.5) * 3.2 / (p.y - 0.62) * 0.35) - 0.5) * 2.0 - 0.96) * smoothstep(RS_PARA + 0.05, 1.0, p.y) * 0.0;
  roofC += vec3(0.22, 0.10, 0.20) * smoothstep(RS_PARA + 0.012, RS_PARA, p.y) * 0.9;      // lit top edge of the parapet
  roofC += 0.025 * (rs_noise(vec2(p.x * 40.0, p.y * 40.0)) - 0.5);
  // warm light spilling from the stall onto the roof, pink spill from the sign
  float pool = exp(-pow((p.x - cx) / (sw * 0.62), 2.0) - pow((p.y - 0.84) / 0.075, 2.0));
  roofC += vec3(0.95, 0.42, 0.14) * pool * 0.30;
  float spool = exp(-pow((p.x - (sx0 - 0.18)) / 0.18, 2.0) - pow((p.y - 0.86) / 0.06, 2.0));
  roofC += vec3(1.0, 0.18, 0.50) * spool * 0.18;
  col = mix(col, roofC, para);

  // ---- the stall
  float inStall = step(sx0, p.x) * step(p.x, sx1);
  // back wall inside the stall: lit amber, shelves of bowls and bottles, a hanging bulb
  float backM = rs_box(p, vec2(cx, 0.5 * (roofBot + counterY)), vec2(sw * 0.5, 0.5 * (counterY - roofBot)), 0.002);
  vec3 back = mix(vec3(1.0, 0.62, 0.24), vec3(0.82, 0.26, 0.12), smoothstep(roofBot, counterY, p.y)) * 0.50;
  back *= 0.86 + 0.20 * rs_noise(vec2(p.x * 30.0, p.y * 30.0));
  {
    float sh1 = step(abs(p.y - 0.465), 0.0028);
    float sh2 = step(abs(p.y - 0.555), 0.0028);
    float it1 = step(0.42, rs_hash(vec2(floor(p.x * 30.0), 1.0))) * step(p.y, 0.465) * step(0.465 - (0.014 + 0.022 * rs_hash(vec2(floor(p.x * 30.0), 2.0))), p.y);
    float it2 = step(0.30, rs_hash(vec2(floor(p.x * 24.0), 5.0))) * step(p.y, 0.555) * step(0.555 - (0.012 + 0.020 * rs_hash(vec2(floor(p.x * 24.0), 6.0))), p.y);
    back = mix(back, vec3(0.06, 0.025, 0.03), clamp(sh1 + sh2 + it1 * 0.9 + it2 * 0.9, 0.0, 1.0));
    // the bulb
    vec2 bp = p - vec2(cx - sw * 0.04, 0.395);
    back += vec3(1.0, 0.82, 0.5) * (exp(-dot(bp, bp) / 0.00012) * 1.6 + exp(-dot(bp, bp) / 0.012) * 0.55);
  }
  col = mix(col, back, backM);
  // the pot on the stove (left), and the cook's stool
  {
    float pot = rs_box(p, vec2(potC.x, counterY - 0.016), vec2(0.050, 0.020), 0.002);
    float potTop = rs_ell(p, vec2(potC.x, counterY - 0.036), vec2(0.050, 0.010), 0.2);
    col = mix(col, vec3(0.05, 0.03, 0.04) + vec3(0.30, 0.12, 0.06) * smoothstep(0.55, 1.0, (p.x - potC.x) / 0.05 * 0.5 + 0.5), pot);
    col = mix(col, vec3(0.75, 0.50, 0.30), potTop * 0.9);
  }
  // counter: warm wooden top, dark front panel with a pink LED strip
  {
    float topS = rs_box(p, vec2(cx, counterY + 0.007), vec2(sw * 0.5 + 0.03, 0.0085), 0.0015);
    float front = rs_box(p, vec2(cx, 0.5 * (counterY + 0.015 + RS_PARA + 0.045)), vec2(sw * 0.5 + 0.02, 0.5 * (RS_PARA + 0.045 - counterY - 0.015)), 0.0015);
    vec3 wood = vec3(0.62, 0.28, 0.12) * (0.8 + 0.4 * rs_noise(vec2(p.x * 80.0, p.y * 4.0)));
    col = mix(col, vec3(0.05, 0.022, 0.035) + vec3(0.12, 0.04, 0.05) * smoothstep(0.80, 0.70, p.y), front);
    float led = step(abs(p.y - 0.795), 0.0022) * inStall;
    col += vec3(1.0, 0.25, 0.55) * (led * 0.9 + exp(-abs(p.y - 0.795) * 55.0) * inStall * 0.22);
    col = mix(col, wood, topS);
  }
  // posts
  {
    float post = max(step(abs(p.x - sx0), 0.0065), step(abs(p.x - sx1), 0.0065)) * step(roofBot, p.y) * step(p.y, RS_PARA + 0.045);
    col = mix(col, vec3(0.03, 0.015, 0.03) + vec3(0.30, 0.10, 0.12) * step(p.x, sx0 + 0.001) * 0.0, post);
  }
  // the bowl: porcelain body, broth surface, egg, greens, chopsticks
  {
    vec2 q = p - bowlC;
    float body = step(0.0, q.y) * smoothstep(1.0, 0.94, length(q / vec2(0.054, 0.040)));
    float surf = rs_ell(p, bowlC, vec2(0.054, 0.0105), 0.18);
    vec3 por = mix(vec3(0.78, 0.76, 0.84), vec3(0.20, 0.12, 0.30), smoothstep(0.0, 0.040, q.y));
    por += vec3(0.95, 0.35, 0.20) * 0.45 * smoothstep(0.045, 0.0, abs(q.y - 0.016)) * 0.5;   // a painted ring
    por += vec3(1.0, 0.6, 0.3) * 0.25 * smoothstep(0.7, 0.0, abs(q.x / 0.054 - 0.5));            // warm light from the bulb side
    col = mix(col, por, clamp(body, 0.0, 1.0));
    vec3 broth = mix(vec3(0.95, 0.46, 0.14), vec3(1.0, 0.72, 0.30), rs_noise(q * vec2(120.0, 260.0)));
    col = mix(col, broth, surf);
    float egg = rs_ell(p, bowlC + vec2(-0.020, -0.001), vec2(0.011, 0.0055), 0.2);
    col = mix(col, vec3(1.0, 0.94, 0.82), egg);
    col = mix(col, vec3(1.0, 0.70, 0.12), rs_ell(p, bowlC + vec2(-0.020, -0.001), vec2(0.0044, 0.0028), 0.3));
    float gr = 0.0;
    for (int i = 0; i < 5; i++) {
      vec2 gp = bowlC + vec2(0.006 + 0.0095 * float(i) - 0.003 * float(i % 2), -0.003 + 0.0035 * float(i % 3) * 0.5);
      gr = max(gr, rs_ell(p, gp, vec2(0.0034, 0.0026), 0.3));
    }
    col = mix(col, vec3(0.30, 0.85, 0.35), gr * surf);
    float cs = max(smoothstep(0.0019, 0.0006, rs_seg(p, bowlC + vec2(0.008, -0.002), bowlC + vec2(0.086, -0.040))),
                   smoothstep(0.0019, 0.0006, rs_seg(p, bowlC + vec2(0.017, 0.001), bowlC + vec2(0.092, -0.034))));
    col = mix(col, vec3(0.78, 0.50, 0.28), cs);
    // warm light the bowl gives to the counter
    col += vec3(1.0, 0.5, 0.2) * exp(-pow((p.x - bowlC.x) / 0.07, 2.0) - pow((p.y - counterY) / 0.012, 2.0)) * 0.18;
  }
  // stools in front of the counter: dark seats on thin poles, warm rim light
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float sx = sx0 + sw * (0.18 + 0.30 * fi);
    float seat = rs_ell(p, vec2(sx, 0.915), vec2(0.046, 0.0125), 0.15);
    float pole = step(abs(p.x - sx), 0.0045) * step(0.915, p.y) * step(p.y, 1.01);
    float seatSide = rs_box(p, vec2(sx, 0.9265), vec2(0.046, 0.0075), 0.002) * step(0.915, p.y);
    vec3 sc = vec3(0.025, 0.012, 0.03);
    col = mix(col, sc, max(max(seat, pole), seatSide));
    col += vec3(1.0, 0.45, 0.18) * smoothstep(0.012, 0.0, abs(p.y - 0.9035)) * seat * 0.35;
  }
  // awning roof: dark red cloth, scalloped edge, lit from the city above and from the lanterns below
  {
    float slope = (p.x - cx) * 0.020;
    float sc2 = 0.014 * (1.0 - pow(abs(sin(p.x * 34.0)), 0.6));
    float rTop = 0.262 + slope, rBot = roofBot + slope + sc2;
    float roof = step(abs(p.x - cx), sw * 0.5 + 0.055) * step(rTop, p.y) * smoothstep(rBot + 0.002, rBot - 0.001, p.y);
    vec3 cloth = vec3(0.17, 0.025, 0.05);
    cloth += vec3(0.45, 0.12, 0.28) * smoothstep(0.012, 0.0, p.y - rTop) * 0.5;            // pink rim light along the top edge
    cloth += vec3(0.95, 0.30, 0.10) * smoothstep(rBot - 0.035, rBot, p.y) * 0.55;           // glow from the lanterns below
    float stripe = step(0.5, fract(p.x * 17.0));
    cloth *= 0.88 + 0.22 * stripe;
    col = mix(col, cloth, roof);
  }
  // hanging paper lanterns along the awning's edge, each swaying on its own
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float lx = sx0 + sw * (0.09 + 0.205 * fi) ;
    float sway = sin(t * 0.8 + fi * 1.9) * 0.006 + sin(t * 1.3 + fi * 0.7) * 0.002;
    float hang = 0.045 + 0.012 * rs_hash(vec2(fi, 3.0));
    vec2 lc = vec2(lx + sway, roofBot + 0.020 + hang + 0.034);
    float string = step(abs(p.x - mix(lx, lc.x, (p.y - roofBot) / (hang + 0.04))), 0.0011) * step(roofBot, p.y) * step(p.y, lc.y - 0.03);
    vec2 d = (p - lc) / vec2(0.027, 0.037);
    float lan = smoothstep(1.0, 0.92, length(d));
    float ribs = 0.5 + 0.5 * smoothstep(0.06, 0.14, abs(fract(d.y * 3.2 + 0.5) - 0.5));
    float cap = step(abs(p.x - lc.x), 0.012) * step(abs(p.y - (lc.y - 0.0365)), 0.0026) + step(abs(p.x - lc.x), 0.010) * step(abs(p.y - (lc.y + 0.0365)), 0.0026);
    vec3 lcol = mix(vec3(1.0, 0.42, 0.14), vec3(1.0, 0.18, 0.08), length(d)) * (1.1 - 0.35 * ribs * 0.5);
    float fl = 0.92 + 0.08 * sin(t * 2.7 + fi * 3.0);
    col += vec3(1.0, 0.38, 0.12) * exp(-dot(p - lc, p - lc) / 0.0026) * 0.50 * fl;
    col = mix(col, vec3(0.03, 0.01, 0.02), string);
    col = mix(col, lcol * fl, lan * 0.97);
    col = mix(col, vec3(0.04, 0.015, 0.02), clamp(cap, 0.0, 1.0));
  }

  // ---- the blade sign: a dark panel on a bracket, pink tubes, abstract pictograms and a neon bowl
  {
    vec2 sc0 = vec2(sx0 - 0.17, 0.455);
    vec2 sh = vec2(0.058, 0.145);
    float panel = rs_box(p, sc0, sh, 0.002);
    float bracket = step(abs(p.y - (sc0.y - sh.y - 0.008)), 0.0028) * step(abs(p.x - (sc0.x + 0.030)), 0.032) + step(abs(p.x - (sc0.x + 0.030)), 0.0028) * step(sc0.y - sh.y - 0.04, p.y) * step(p.y, sc0.y - sh.y);
    float fk = 1.0 - 0.45 * step(0.965, rs_hash(vec2(floor(t * 9.0), 1.0)));
    float fk2 = 1.0 - 0.8 * step(0.90, rs_hash(vec2(floor(t * 7.0), 4.0)));
    col = mix(col, vec3(0.012, 0.008, 0.03) + vec3(0.35, 0.08, 0.20) * 0.18, panel * 0.96);
    col = mix(col, vec3(0.03, 0.02, 0.04), clamp(bracket, 0.0, 1.0));
    vec2 q = p - sc0;
    vec2 tube = vec2(0.0);
    // frame
    float df = abs(max(abs(q.x) / (sh.x - 0.008), abs(q.y) / (sh.y - 0.008)) - 1.0) * 0.05;
    tube += rs_tube(df) * vec2(1.0, 1.0) * fk * 0.9;
    vec3 tcolP = vec3(1.0, 0.22, 0.52), tcolC = vec3(0.35, 0.92, 1.0);
    vec3 acc = tcolP * (tube.x + tube.y) * panel;
    // pictogram 1: a boxed seal with a slash
    vec2 g1 = q - vec2(0.0, -0.095);
    float d1 = min(min(rs_seg(g1, vec2(-0.028, -0.022), vec2(0.028, -0.022)), rs_seg(g1, vec2(0.028, -0.022), vec2(0.028, 0.022))),
                   min(rs_seg(g1, vec2(0.028, 0.022), vec2(-0.028, 0.022)), rs_seg(g1, vec2(-0.028, 0.022), vec2(-0.028, -0.022))));
    d1 = min(d1, min(rs_seg(g1, vec2(-0.018, 0.012), vec2(0.018, -0.012)), rs_seg(g1, vec2(0.0, -0.022), vec2(0.0, 0.022))));
    vec2 t1 = rs_tube(d1);
    acc += tcolC * (t1.x + t1.y) * fk * panel;
    // pictogram 2: stacked zig-zag waves (flickers now and then)
    vec2 g2 = q - vec2(0.0, -0.020);
    float d2 = 1.0;
    for (int i = 0; i < 3; i++) {
      float yy = -0.026 + 0.026 * float(i);
      d2 = min(d2, rs_seg(g2, vec2(-0.030, yy), vec2(-0.015, yy - 0.009)));
      d2 = min(d2, rs_seg(g2, vec2(-0.015, yy - 0.009), vec2(0.0, yy + 0.009)));
      d2 = min(d2, rs_seg(g2, vec2(0.0, yy + 0.009), vec2(0.015, yy - 0.009)));
      d2 = min(d2, rs_seg(g2, vec2(0.015, yy - 0.009), vec2(0.030, yy)));
    }
    vec2 t2 = rs_tube(d2);
    acc += tcolP * (t2.x + t2.y) * fk2 * panel;
    // pictogram 3: a neon bowl with chopsticks and two steam curls
    vec2 g3 = q - vec2(0.0, 0.085);
    float bowlD = abs(length(g3 * vec2(1.0, 1.15) - vec2(0.0, -0.010)) - 0.034);
    bowlD = bowlD + step(g3.y, -0.010) * 0.0 + (1.0 - step(-0.010, g3.y)) * 1.0 + 0.0;
    bowlD = min(bowlD, rs_seg(g3, vec2(-0.040, -0.010), vec2(0.040, -0.010)));
    bowlD = min(bowlD, min(rs_seg(g3, vec2(0.006, -0.012), vec2(0.040, -0.044)), rs_seg(g3, vec2(0.014, -0.008), vec2(0.044, -0.036))));
    float curl = 1.0;
    for (int k = 0; k < 2; k++) {
      float xo = -0.012 + 0.024 * float(k);
      float cy = g3.y + 0.026;
      float cxo = xo + 0.006 * sin(cy * 260.0 + float(k) * 2.0);
      curl = min(curl, abs(g3.x - cxo) + step(0.032, abs(cy - 0.016)) * 1.0);
    }
    vec2 t3 = rs_tube(min(bowlD, curl));
    acc += tcolC * (t3.x + t3.y) * fk * panel;
    col += acc * 0.95;
    // the sign's glow spills past the panel
    float halo = exp(-pow(max(abs(q.x) - sh.x, 0.0) / 0.05, 2.0) - pow(max(abs(q.y) - sh.y, 0.0) / 0.05, 2.0));
    col += vec3(1.0, 0.18, 0.50) * halo * 0.14 * fk * (1.0 - panel);
  }

  // ---- steam: from the bowl (leans toward the pointer) and from the pot (leans a little)
  {
    float leanB = hasM ? clamp((mp.x - bowlC.x) / 0.35, -1.5, 1.5) : (-0.20 + 0.10 * sin(t * 0.21));
    float up = hasM ? clamp((bowlC.y - mp.y) / 0.45, 0.5, 1.4) : 1.0;
    float sB = rs_steam(p, bowlC + vec2(0.0, -0.006), leanB, t, 1.15 * up);
    float leanP = hasM ? clamp((mp.x - potC.x) / 0.6, -1.0, 1.0) * 0.8 : (-0.12 + 0.08 * sin(t * 0.17 + 1.0));
    float sP = rs_steam(p, potC + vec2(0.0, -0.040), leanP, t + 7.0, 0.80);
    float s = max(sB, sP);
    float hAbove = clamp((bowlC.y - p.y) / 0.5, 0.0, 1.0);
    vec3 scol = mix(vec3(1.0, 0.82, 0.62), vec3(0.78, 0.58, 0.82), hAbove);
    scol = mix(scol, vec3(1.0, 0.60, 0.40), exp(-hAbove * 5.0) * 0.5);
    col = mix(col, scol, s * 0.80);
    // a ghost of warm light lingers in the plume
    col += vec3(1.0, 0.45, 0.20) * s * exp(-hAbove * 6.0) * 0.12;
  }

  col *= 0.95 + 0.10 * pl;
  col *= 1.0 - 0.42 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
