// label: Arcade night
// hint: a dark arcade at night: a row of neon-lit cabinets with little pixel games running on their screens, a confetti carpet and spinning pixel coins drifting up; the cabinet nearest the pointer lights up
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
float an_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float an_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(an_hash(i), an_hash(i + vec2(1, 0)), f.x), mix(an_hash(i + vec2(0, 1)), an_hash(i + vec2(1, 1)), f.x), f.y);
}
float an_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float AN_FLOOR = 0.74;   // where the cabinets stand
const float AN_S = 0.30;       // spacing between cabinets (in height units)

vec3 an_pal(float k) {
  float m = mod(k, 6.0);
  if (m < 0.5) return vec3(1.0, 0.22, 0.62);
  if (m < 1.5) return vec3(0.15, 0.82, 1.0);
  if (m < 2.5) return vec3(1.0, 0.82, 0.18);
  if (m < 3.5) return vec3(0.62, 0.38, 1.0);
  if (m < 4.5) return vec3(0.25, 1.0, 0.50);
  return vec3(1.0, 0.45, 0.16);
}
vec3 an_acc(float k) {   // second colour of a cabinet's art
  float m = mod(k, 6.0);
  if (m < 0.5) return vec3(0.30, 0.90, 1.0);
  if (m < 1.5) return vec3(1.0, 0.35, 0.75);
  if (m < 2.5) return vec3(0.35, 0.65, 1.0);
  if (m < 3.5) return vec3(1.0, 0.85, 0.30);
  if (m < 4.5) return vec3(1.0, 0.95, 0.40);
  return vec3(0.35, 0.85, 1.0);
}

// the little pixel games on the cabinet screens; g = (column 0..14, row 0..12), row 0 at the bottom
vec3 an_game(float ty, vec2 g, float t, float k, vec3 c, vec3 a) {
  vec3 o = vec3(0.010, 0.012, 0.030) + c * 0.035;
  if (ty < 0.5) {
    // falling blocks
    float sh = 1.0 + floor(an_hash(vec2(g.x, k)) * 4.0);
    if (g.y < sh) o = c * (0.50 + 0.5 * an_hash(g + k));
    float ph = t * 1.5 + k * 3.0;
    float st = floor(ph);
    float py = 10.0 - mod(st, 10.0);
    float px = floor(an_hash(vec2(floor(st / 10.0), k)) * 12.0) + 1.0;
    if (g.x >= px && g.x <= px + 1.0 && g.y >= py && g.y <= py + 1.0) o = a;
  } else if (ty < 1.5) {
    // marching invaders, a ship and a shot
    float ox = floor(abs(mod(t * 1.0 + k, 8.0) - 4.0));
    float rowA = (g.y == 8.0 || g.y == 9.0) ? 1.0 : 0.0;
    float rowB = (g.y == 11.0 || g.y == 12.0) ? 1.0 : 0.0;
    float mx = mod(g.x - ox, 3.0);
    if ((rowA + rowB) > 0.5 && g.x >= 1.0 && g.x <= 13.0 && mx < 2.0) o = (rowA > 0.5) ? c : a;
    if (g.y == 3.0 && mod(g.x, 4.0) < 2.0 && g.x > 0.0 && g.x < 14.0) o = c * 0.35;
    float sx = 2.0 + floor(abs(mod(t * 0.7 + k * 2.0, 20.0) - 10.0));
    if (g.y == 0.0 && abs(g.x - sx) <= 2.0) o = vec3(0.9, 1.0, 0.9);
    if (g.y == 1.0 && abs(g.x - sx) < 1.0) o = vec3(0.9, 1.0, 0.9);
    if (g.x == sx && g.y == 2.0 + mod(floor(t * 5.0), 6.0)) o = vec3(1.0, 1.0, 0.7);
  } else if (ty < 2.5) {
    // maze, dots, a hungry yellow disc and a ghost
    float pcx = mod(floor(t * 2.2 + k * 5.0), 13.0) + 1.0;
    bool wall = g.x == 0.0 || g.x == 14.0 || g.y == 0.0 || g.y == 12.0
      || (g.y == 4.0 && ((g.x >= 2.0 && g.x <= 5.0) || (g.x >= 9.0 && g.x <= 12.0)))
      || (g.y == 8.0 && g.x >= 2.0 && g.x <= 12.0 && g.x != 7.0);
    if (wall) o = mix(c, vec3(0.25, 0.35, 1.0), 0.65) * 0.8;
    if ((g.y == 2.0 || g.y == 6.0 || g.y == 10.0) && mod(g.x, 2.0) == 1.0 && !(g.y == 6.0 && g.x < pcx)) o = vec3(1.0, 0.85, 0.7) * 0.8;
    if (abs(g.x - pcx) <= 1.0 && abs(g.y - 6.0) <= 1.0 && !(abs(g.x - pcx) == 1.0 && abs(g.y - 6.0) == 1.0 && g.x > pcx - 0.5)) o = vec3(1.0, 0.88, 0.1);
    float gx = mod(pcx - 5.0 + 13.0, 13.0) + 1.0;
    if (abs(g.x - gx) <= 1.0 && g.y >= 5.0 && g.y <= 7.0 && !(g.y == 5.0 && g.x == gx)) o = a;
  } else if (ty < 3.5) {
    // a road to the horizon
    if (g.y >= 7.0) {
      o = mix(vec3(0.02, 0.02, 0.07), c * 0.55, (g.y - 6.0) / 6.0);
      if (abs(g.x - 7.0) <= 2.0 && g.y <= 9.0) o = a;            // low sun
    } else {
      float cx = 7.0 + sin(t * 0.5 + k) * (7.0 - g.y) * 0.4;
      float hw = 1.5 + (7.0 - g.y) * 0.85;
      float z = 1.0 / (7.5 - g.y);
      float band = step(mod(z * 5.0 - t * 3.0, 1.0), 0.5);
      float dx = abs(g.x - cx);
      o = c * 0.10 + vec3(0.0, 0.05, 0.02);
      if (dx < hw) o = vec3(0.10, 0.09, 0.16);
      if (dx < hw && dx > hw - 1.1) o = mix(vec3(0.9, 0.9, 0.95), vec3(1.0, 0.2, 0.25), band);
      if (dx < 0.7 && band > 0.5) o = vec3(0.95, 0.9, 0.6);
    }
    float cs = 7.0 + sin(t * 0.9 + k * 2.0) * 2.0;
    if (g.y <= 1.0 && abs(g.x - cs) <= 1.0) o = (g.y == 1.0 && abs(g.x - cs) > 0.5) ? vec3(0.1, 0.1, 0.15) : mix(a, vec3(1.0), 0.3);
  } else {
    // bricks and a bouncing ball
    if (g.y >= 9.0 && g.y <= 11.0 && g.x >= 1.0 && g.x <= 13.0 && an_hash(g + floor(t / 14.0) + k) < 0.88) {
      o = (g.y == 11.0) ? a : ((g.y == 10.0) ? c : vec3(1.0, 0.85, 0.3));
      o *= 0.55 + 0.45 * mod(g.x, 2.0);
    }
    float bx = floor(abs(mod(t * 4.0 + k * 3.0, 24.0) - 12.0) + 1.0);
    float by = floor(abs(mod(t * 3.0 + k * 2.0, 16.0) - 8.0) + 1.0);
    if (g.x == bx && g.y == by) o = vec3(1.0);
    if (g.y == 0.0 && abs(g.x - bx) <= 1.0) o = c;
  }
  return o;
}

// one cabinet: lp = (x from its centre, height above the floor); returns rgb and coverage
vec4 an_cabinet(vec2 lp, float k, float act, float t, vec2 sp) {
  float hs = an_hash(vec2(k, 3.1));
  float H = 0.40 + 0.03 * hs;
  vec3 c = an_pal(k);
  vec3 a = an_acc(k);
  float lit = 0.55 + 0.55 * act;
  float x = lp.x, h = lp.y;
  if (abs(x) > 0.105 || h < 0.0 || h > H) return vec4(0.0);
  // the body, a dark moulded cabinet with its side art
  vec3 col = vec3(0.020, 0.022, 0.045) + c * 0.030;
  float side = smoothstep(0.086, 0.088, abs(x));
  float chev = step(0.5, fract((h * 7.0 + abs(x) * 7.0) * 1.7));
  col = mix(col, mix(c, a, chev) * (0.30 + 0.35 * lit), side);
  col += c * 0.09 * smoothstep(0.012, 0.0, abs(abs(x) - 0.104)) * lit;       // glowing edge
  // marquee
  float mq0 = H - 0.062, mq1 = H - 0.008;
  if (h > mq0 && h < mq1 && abs(x) < 0.086) {
    vec2 mc = vec2(x + 0.086, h - mq0) / 0.0115;
    vec2 mi = floor(mc);
    float letter = step(0.45, an_hash(mi + k * 7.0)) * step(1.0, mi.y) * step(mi.y, 3.0) * step(1.0, mi.x) * step(mi.x, 13.0);
    vec3 mcol = mix(c, vec3(1.0), 0.15) * (0.45 + 0.35 * lit);
    mcol = mix(mcol, vec3(1.0, 0.97, 0.9) * (0.9 + 0.3 * act), letter * 0.8 * smoothstep(0.5, 0.15, abs(fract(mc.x) - 0.5)) );
    col = mcol;
    // chase bulbs along the marquee edge, only while it is the active cabinet
    float bulb = step(0.5, fract(x * 22.0 - t * 2.0)) * smoothstep(0.012, 0.004, abs(h - (mq1 - 0.004)));
    col += vec3(1.0, 0.9, 0.5) * bulb * act * 0.8;
  }
  // screen: bezel and a 15x13 pixel game
  float s0 = H - 0.215, s1 = H - 0.090;
  if (h > s0 - 0.014 && h < s1 + 0.014 && abs(x) < 0.088) {
    col = vec3(0.012, 0.012, 0.022);
    if (h > s0 && h < s1 && abs(x) < 0.0724) {
      vec2 gp = vec2((x + 0.0724) / 0.00965, (h - s0) / 0.00965);
      vec2 g = floor(gp);
      vec2 f = fract(gp);
      float ty = mod(floor(k * 2.0 + 1.0), 5.0);
      vec3 px = an_game(ty, g, t, k, c, a);
      float cell = smoothstep(0.0, 0.14, f.x) * smoothstep(0.0, 0.14, f.y) * smoothstep(1.0, 0.86, f.x) * smoothstep(1.0, 0.86, f.y);
      col = px * (0.30 + 0.70 * cell) * (0.78 + 0.85 * act);
      // glass sheen
      col += vec3(0.5, 0.6, 0.8) * 0.06 * smoothstep(0.6, 1.0, 1.0 - (x + 0.07) * 4.0 - (h - s0) * 1.5) * 0.0;
      col *= 0.82 + 0.18 * sin(gp.y * 6.2832);
    }
  }
  // control panel with a stick and buttons
  float p0 = H - 0.270, p1 = H - 0.222;
  if (h > p0 && h < p1 && abs(x) < 0.102) {
    col = vec3(0.045, 0.045, 0.075) + c * 0.07 * lit;
    col = mix(col, a * 0.5 * lit, smoothstep(0.003, 0.0, abs(h - (p1 - 0.004))));
    vec2 jq = vec2(x + 0.052, h - (p0 + 0.026));
    float stick = smoothstep(0.0075, 0.005, length(jq - vec2(0.0, 0.010)));
    float rod = smoothstep(0.0022, 0.0012, abs(jq.x)) * step(0.0, jq.y) * step(jq.y, 0.010);
    col = mix(col, vec3(0.9, 0.15, 0.2) * (0.65 + 0.4 * lit), max(stick, rod));
    vec2 b1 = vec2(x - 0.012, h - (p0 + 0.024));
    vec2 b2 = vec2(x - 0.042, h - (p0 + 0.028));
    vec2 b3 = vec2(x - 0.072, h - (p0 + 0.024));
    float pulse = 0.65 + 0.35 * step(0.0, sin(t * 6.0 + k)) * act;
    col = mix(col, vec3(1.0, 0.85, 0.2) * pulse, smoothstep(0.0072, 0.005, length(b1)));
    col = mix(col, a * pulse, smoothstep(0.0072, 0.005, length(b2)));
    col = mix(col, c * pulse, smoothstep(0.0072, 0.005, length(b3)));
  }
  // coin door
  float d0 = 0.040, d1 = 0.100;
  if (h > d0 && h < d1 && abs(x) < 0.040) {
    col = vec3(0.030, 0.030, 0.050);
    float slot = smoothstep(0.0035, 0.0015, abs(h - 0.082)) * step(abs(x - 0.020), 0.012);
    float slot2 = smoothstep(0.0035, 0.0015, abs(h - 0.082)) * step(abs(x + 0.020), 0.012);
    col += vec3(1.0, 0.8, 0.2) * (slot + slot2) * (0.5 + 0.6 * lit);
    col += c * 0.5 * smoothstep(0.0015, 0.0, abs(h - 0.056)) * step(abs(x), 0.026) * lit;
    col += vec3(0.5, 0.5, 0.6) * smoothstep(0.0012, 0.0, abs(abs(x) - 0.040)) * 0.2;
  }
  if (h < 0.018) col = vec3(0.012, 0.012, 0.024);
  // light from the screen falls onto the panel and body below it
  col += c * 0.10 * lit * smoothstep(s0, s0 - 0.12, h) * step(h, s0);
  return vec4(col, 1.0);
}

// confetti carpet cell: returns neon intensity of the shape in the cell, colour index in .y
vec3 an_carpet(vec2 fp) {
  vec2 cell = floor(fp);
  vec2 c = fract(fp) - 0.5;
  float h1 = an_hash(cell + 1.3);
  float h2 = an_hash(cell + 7.7);
  float h3 = an_hash(cell + 3.9);
  if (h1 < 0.30) return vec3(0.0);
  float ang = h3 * 6.2832;
  float ca = cos(ang), sa = sin(ang);
  vec2 q = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca);
  float s = floor((h1 - 0.30) / 0.70 * 5.0);
  float d = 0.0;
  if (s < 0.5) {
    d = abs(length(q) - 0.26) - 0.045;
  } else if (s < 1.5) {
    float k3 = 1.7320508;
    vec2 pp = q * 1.15;
    pp.x = abs(pp.x) - 0.28;
    pp.y = pp.y + 0.28 / k3;
    if (pp.x + k3 * pp.y > 0.0) pp = vec2(pp.x - k3 * pp.y, -k3 * pp.x - pp.y) * 0.5;
    pp.x -= clamp(pp.x, -0.56, 0.0);
    d = abs(-length(pp) * sign(pp.y)) - 0.045;
  } else if (s < 2.5) {
    d = max(abs(q.y - 0.11 * sin(q.x * 17.0)) - 0.040, abs(q.x) - 0.34);
  } else if (s < 3.5) {
    d = min(max(abs(q.x) - 0.035, abs(q.y) - 0.24), max(abs(q.y) - 0.035, abs(q.x) - 0.24));
  } else {
    d = min(length(q - vec2(-0.2, 0.0)) - 0.07, min(length(q) - 0.07, length(q - vec2(0.2, 0.0)) - 0.07));
  }
  float shape = smoothstep(0.012, -0.008, d) + 0.35 * exp(-max(d, 0.0) * 22.0);
  return vec3(shape, h2, 1.0);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = m * vec2(asp, 1.0);
  float t = time;
  vec3 w = wall(uv);

  float kf = floor((p.x - 0.5 * asp) / AN_S + 0.5);
  float cx = 0.5 * asp + kf * AN_S;
  vec3 col;

  // glow reaching this pixel from the nearest three cabinets (screens light the wall and the carpet)
  vec3 glowW = vec3(0.0);
  vec3 glowF = vec3(0.0);
  float actHere = 0.0;
  for (int j = -1; j <= 1; j++) {
    float kk = kf + float(j);
    float ccx = 0.5 * asp + kk * AN_S;
    float ac = hasM ? smoothstep(0.62 * AN_S, 0.16 * AN_S, abs(ccx - mp.x)) : 0.0;
    if (j == 0) actHere = ac;
    float ddx = p.x - ccx;
    vec3 cc = an_pal(kk) * (0.55 + 0.9 * ac);
    float up = AN_FLOOR - 0.25;
    glowW += cc * exp(-(ddx * ddx) / 0.030) * exp(-pow((uv.y - up) / 0.30, 2.0)) * 0.34;
    glowF += cc * exp(-(ddx * ddx) / 0.022) * exp(-max(uv.y - AN_FLOOR, 0.0) * 5.5);
  }

  if (uv.y < AN_FLOOR) {
    // ---- the wall: deep blue-black, panel seams, two neon tubes under the ceiling and a zigzag border
    col = mix(vec3(0.020, 0.018, 0.060), vec3(0.030, 0.035, 0.090), smoothstep(0.0, 0.74, uv.y));
    col += vec3(0.02, 0.02, 0.05) * smoothstep(0.012, 0.0, abs(fract(p.x * 3.3) - 0.5) - 0.495 + 0.012) * 0.0;
    col += 0.018 * an_noise(p * vec2(60.0, 8.0));
    // neon tubes
    float tube1 = exp(-pow((uv.y - 0.075) / 0.0045, 2.0));
    float tube2 = exp(-pow((uv.y - 0.108) / 0.0045, 2.0));
    float tg1 = exp(-pow((uv.y - 0.075) / 0.05, 2.0));
    float tg2 = exp(-pow((uv.y - 0.108) / 0.05, 2.0));
    float hum = 0.94 + 0.06 * sin(t * 1.3 + p.x * 3.0);
    col += vec3(1.0, 0.25, 0.65) * (tube1 * 0.9 + tg1 * 0.14) * hum;
    col += vec3(0.20, 0.85, 1.0) * (tube2 * 0.9 + tg2 * 0.12) * hum;
    // zigzag frieze
    float zz = abs(fract(p.x * 9.0) - 0.5) * 2.0;
    float zl = smoothstep(0.012, 0.003, abs(uv.y - (0.185 + zz * 0.035)));
    col += vec3(1.0, 0.82, 0.25) * zl * 0.35;
    // skirting board catching the carpet light
    col += vec3(0.16, 0.26, 0.55) * smoothstep(0.03, 0.0, AN_FLOOR - uv.y) * 0.5;
    col += glowW;

    // cabinet row
    float act = actHere;
    vec2 lp = vec2(p.x - cx, AN_FLOOR - uv.y);
    vec4 cab = an_cabinet(lp, kf, act, t, p);
    // a darker second row of cabinets behind, shown between the front ones
    col = mix(col, cab.rgb, cab.a);
    col += glowW * 0.0;
  } else {
    // ---- carpet: dark violet with neon confetti shapes, lit by the cabinet screens
    float dy = uv.y - AN_FLOOR;
    float gz = dy + 0.05;
    vec2 fp = vec2((p.x - 0.5 * asp) * 1.25 / gz, 0.36 / gz);
    vec3 cr = an_carpet(fp);
    float aa = smoothstep(0.015, 0.14, dy);
    col = vec3(0.016, 0.012, 0.050) + 0.018 * an_noise(fp * 9.0);
    // neon shape colour
    float ci = floor(cr.y * 4.0);
    vec3 nc = vec3(0.15, 0.85, 1.0);
    if (ci < 0.5) nc = vec3(1.0, 0.25, 0.65);
    else if (ci < 1.5) nc = vec3(1.0, 0.85, 0.2);
    else if (ci < 2.5) nc = vec3(0.35, 1.0, 0.55);
    col += nc * cr.x * 0.55 * aa * (0.55 + 0.7 * smoothstep(0.0, 0.3, dy));
    // reflections of the screens on the floor, and rim light at the baseboard
    col += glowF * 0.22 * (0.7 + 0.8 * aa) * (0.4 + 0.9 * cr.x * 0.0 + 0.6);
    col += glowF * nc * cr.x * 0.20 * aa;
    col *= 1.0 - 0.28 * smoothstep(0.12, 0.26, dy);
    col += vec3(0.3, 0.7, 1.0) * smoothstep(0.012, 0.0, dy) * 0.22;
  }

  // ---- pixel coins drifting up through the room, spinning, with a twinkle
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float sd = fi * 7.13 + 1.0;
    float spd = 0.018 + 0.012 * an_hash(vec2(sd, 1.0));
    float ph = fract(an_hash(vec2(sd, 2.0)) + t * spd);
    vec2 cpos = vec2(an_hash(vec2(sd, 3.0)) * asp, 1.02 - ph * 1.1);
    cpos.x += 0.02 * sin(t * 0.7 + sd);
    float px = 0.0072;
    vec2 q = (p - cpos) / px;
    float spin = abs(cos(t * 1.8 + sd));
    vec2 cq = floor(q + 0.5);
    float sx = max(spin, 0.40);
    float rr = length(vec2(cq.x / sx, cq.y));
    float coin = step(rr, 3.4) * step(abs(q.x - cq.x), 0.5) ;
    float rim = step(2.4, rr);
    float fade = smoothstep(0.0, 0.1, ph) * smoothstep(1.0, 0.85, ph);
    vec3 cc = mix(vec3(1.0, 0.82, 0.20), vec3(1.0, 0.95, 0.55), rim);
    cc = mix(cc, vec3(0.75, 0.50, 0.08), step(abs(cq.x), 0.5 * sx) * step(abs(cq.y), 1.5) * (1.0 - rim) * 0.9);
    col = mix(col, cc, coin * fade * 0.85);
    // a plus-shaped twinkle
    float tw = max(0.0, sin(t * 2.3 + sd * 2.0));
    vec2 tq = abs(p - (cpos + vec2(0.012, 0.012)));
    float star = exp(-tq.x / 0.0016 - tq.y / 0.0160) + exp(-tq.y / 0.0016 - tq.x / 0.0160);
    col += vec3(1.0, 0.95, 0.7) * star * tw * fade * 0.8;
  }

  // the picture underneath shows through very faintly, with a gentle vignette
  col += w * 0.05;
  col *= 0.96 + 0.08 * an_luma(w);
  col *= 1.0 - 0.34 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
