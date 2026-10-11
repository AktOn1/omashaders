// label: Bunker light
// hint: a concrete bunker corridor in perspective, green emergency lamps flickering softly, pipes on the ceiling, a control panel of blinking lamps and a slow radar sweep on the wall; the lamp nearest the pointer brightens
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

float bl_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bl_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bl_hash(i), bl_hash(i + vec2(1, 0)), f.x), mix(bl_hash(i + vec2(0, 1)), bl_hash(i + vec2(1, 1)), f.x), f.y);
}
float bl_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * bl_noise(p); p = p * 2.03 + 11.0; a *= 0.5; }
  return v;
}
float bl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float BL_W = 0.62;    // corridor half width
const float BL_H = 0.40;    // half height
const float BL_ZM = 6.0;    // depth of the blast door at the far end
const vec3 BL_LG = vec3(0.30, 1.0, 0.42);

float bl_lampZ(int i) { return 0.9 + 0.8 * float(i); }
float bl_lampSide(int i) { return (i - (i / 2) * 2 == 0) ? -1.0 : 1.0; }
// soft flicker: a slow wobble and now and then a short dip, no hard blackouts
float bl_flick(int i, float t) {
  float f = float(i);
  float n = bl_noise(vec2(t * 1.6 + f * 5.3, f * 1.7));
  float soft = 0.80 + 0.34 * (n - 0.5);
  float ph = fract(t / (6.0 + f * 1.1) + bl_hash(vec2(f, 3.0)));
  float dip = ph < 0.07 ? sin(ph / 0.07 * 3.14159) : 0.0;
  return soft * (1.0 - 0.38 * dip);
}
float bl_line(float dist, float hw, float px) { return 1.0 - smoothstep(max(hw - px, 0.0), hw + px, dist); }

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);

  vec2 vp = vec2(0.5 * asp, 0.47);
  vec2 d = p - vp;
  float ax = abs(d.x) / BL_W;
  float ay = abs(d.y) / BL_H;
  float z = 1.0 / max(max(ax, ay), 0.0001);
  int surf = 0;                       // 0 left wall, 1 right wall, 2 ceiling, 3 floor, 4 back door
  vec3 P;
  vec3 n;
  if (z > BL_ZM) {
    surf = 4; z = BL_ZM;
    P = vec3(d.x * BL_ZM, d.y * BL_ZM, BL_ZM); n = vec3(0.0, 0.0, -1.0);
  } else if (ax > ay) {
    surf = d.x < 0.0 ? 0 : 1;
    P = vec3(d.x < 0.0 ? -BL_W : BL_W, d.y * z, z); n = vec3(d.x < 0.0 ? 1.0 : -1.0, 0.0, 0.0);
  } else {
    surf = d.y < 0.0 ? 2 : 3;
    P = vec3(d.x * z, d.y < 0.0 ? -BL_H : BL_H, z); n = vec3(0.0, d.y < 0.0 ? 1.0 : -1.0, 0.0);
  }
  float px = z * 0.0012;               // one screen pixel in world units at this depth
  float a = P.z;
  float b = (surf <= 1 || surf == 4) ? P.y : P.x;

  // ---------- surface colour ----------
  float sf = float(surf);
  float cn = bl_fbm(vec2(a * 1.5, b * 1.5) + sf * 7.3);
  float fine = bl_noise(vec2(a, b) * 22.0);
  vec3 conc = vec3(0.50, 0.53, 0.50) * (0.60 + 0.62 * cn) * (0.90 + 0.18 * fine);
  vec3 alb = conc;
  vec3 emis = vec3(0.0);
  float spill = 0.0;                   // light thrown by the screens onto their wall
  float glossy = 0.0;                  // pipes: broad highlight
  float wet = 0.0;                     // puddles: sharp mirror of the lamps

  if (surf <= 1) {
    // wall panels, a worn ochre safety stripe, grime streaks and damp at the foot
    float sd = min(fract(a * 0.8), 1.0 - fract(a * 0.8)) / 0.8;
    float seam = bl_line(sd, 0.006, px * 1.2);
    alb *= 1.0 - 0.55 * seam;
    float hd = abs(P.y - 0.17);
    float stripe = bl_line(hd, 0.025, px) * smoothstep(0.30, 0.62, bl_noise(vec2(a * 3.0, b * 9.0) + 4.0));
    alb = mix(alb, vec3(0.55, 0.46, 0.14) * (0.7 + 0.5 * cn), stripe * 0.85);
    float streak = bl_noise(vec2(a * 9.0, P.y * 0.7 + sf * 3.0));
    alb *= 0.78 + 0.34 * streak * smoothstep(-0.4, 0.1, P.y);
    alb *= 1.0 - 0.45 * smoothstep(0.26, 0.40, P.y);                // wet dark foot
    // a pipe run along the upper wall
    float pc = (surf == 0 ? -0.255 : -0.285);
    float pr = (surf == 0 ? 0.05 : 0.04);
    float ph = (P.y - pc) / pr;
    if (abs(ph) < 1.0) {
      float cyl = sqrt(1.0 - ph * ph);
      vec3 steel = vec3(0.30, 0.34, 0.33) * (0.10 + 0.95 * cyl * cyl) * (0.8 + 0.4 * bl_noise(vec2(a * 5.0, b * 40.0)));
      float cr = min(fract(a / 1.6), 1.0 - fract(a / 1.6)) * 1.6;
      steel *= 1.0 - 0.7 * bl_line(cr, 0.035, px);
      alb = steel;
      glossy = 0.5 * cyl;
    }
    // cable risers on the left wall, a steel side door on the right wall
    if (surf == 0) {
      float rz = abs(a - 3.1);
      float rz2 = abs(a - 4.7);
      float riser = bl_line(min(rz, rz2), 0.022, px) * step(P.y, 0.40) * step(-0.25, P.y);
      alb = mix(alb, vec3(0.05, 0.055, 0.05), riser * 0.9);
    } else {
      float du = abs(a - 4.15);
      if (du < 0.42 && P.y > -0.10) {
        vec3 dc = vec3(0.24, 0.27, 0.26) * (0.75 + 0.4 * fine);
        dc *= 0.55 + 0.45 * smoothstep(0.0, 0.05, 0.42 - du);
        dc *= 1.0 - 0.5 * bl_line(abs(P.y - 0.14), 0.012, px);
        dc = mix(dc, vec3(0.5, 0.4, 0.1) * 0.8, bl_line(abs(P.y - 0.36), 0.016, px) * 0.6);
        alb = dc;
        float hl = length(vec2((a - 4.40) * 1.4, P.y - 0.14));
        alb = mix(alb, vec3(0.5), smoothstep(0.03, 0.02, hl));
      }
      // small red status lamp over the door
      float rl2 = length(vec2((a - 4.15) * 1.5, P.y + 0.16));
      emis += vec3(1.0, 0.14, 0.08) * (smoothstep(0.022, 0.010, rl2) * 1.2 + exp(-rl2 * rl2 / 0.0012) * 0.25);
    }
    // control panel on the left wall, wall screen with a radar on the right wall
    if (surf == 0) {
      float pu = (a - 1.0) / 1.3;
      float pv = (P.y + 0.12) / 0.42;
      if (pu > -0.03 && pu < 1.03 && pv > -0.05 && pv < 1.05) {
        float edge = min(min(pu + 0.03, 1.03 - pu), min((pv + 0.05) * 0.6, (1.05 - pv) * 0.6));
        vec3 body = vec3(0.07, 0.09, 0.085) * (0.8 + 0.4 * fine);
        body = mix(vec3(0.20, 0.23, 0.22), body, smoothstep(0.0, 0.025, edge));
        alb = body;
        spill = 1.0;
        // small screen with scrolling green text
        if (pv > 0.05 && pv < 0.38 && pu > 0.05 && pu < 0.95) {
          float su = (pu - 0.05) / 0.90;
          float sv = (pv - 0.05) / 0.33;
          float row = floor(sv * 7.0);
          float shift = floor(t * 0.9);
          float colx = floor(su * 38.0);
          float blk = step(0.38, bl_hash(vec2(floor(colx / 4.0) + row * 13.0, row + shift * 0.0 + floor((row + t * 0.9) * 0.5))));
          float glyph = step(0.25, bl_hash(vec2(colx, row + shift)));
          float lineY = smoothstep(0.35, 0.25, abs(fract(sv * 7.0) - 0.5));
          float txt = blk * glyph * lineY * step(0.15, fract(su * 38.0)) * step(fract(su * 38.0), 0.85);
          float head = step(sv, 0.12) * 0.35;
          emis += BL_LG * (0.05 + 0.55 * txt + head) * (0.8 + 0.2 * sin(t * 40.0 + sv * 3.0));
          alb = vec3(0.02, 0.05, 0.03);
        } else if (pv > 0.45 && pv < 0.95 && pu > 0.04 && pu < 0.96) {
          // grid of tiny lamps
          float gu = (pu - 0.04) / 0.92 * 12.0;
          float gv = (pv - 0.45) / 0.50 * 4.0;
          vec2 cell = vec2(floor(gu), floor(gv));
          float h = bl_hash(cell + 3.0);
          float h2 = bl_hash(cell + 11.0);
          float h3 = bl_hash(cell + 23.0);
          vec2 lf = vec2(fract(gu) - 0.5, fract(gv) - 0.5) * vec2(0.108 * 0.92, 0.0525 * 1.0);
          float dr = length(lf);
          vec3 lc = h < 0.55 ? vec3(0.25, 1.0, 0.35) : (h < 0.82 ? vec3(1.0, 0.62, 0.10) : vec3(1.0, 0.16, 0.10));
          float blink = step(0.5, fract(t * (0.25 + h3 * 0.9) + h3 * 9.0));
          float on = h2 < 0.45 ? 1.0 : (h2 < 0.80 ? blink : 0.0);
          float disc = smoothstep(0.0165, 0.0105, dr);
          float halo = exp(-dr * dr / 0.00018);
          emis += lc * (disc * (0.08 + 1.5 * on) + halo * 0.18 * on);
          // a few rocker switches between the lamps
          alb = vec3(0.04, 0.05, 0.05);
        }
      }
    } else {
      float lu = (a - 2.3) / 0.85;
      float lv = (P.y - 0.02) / 0.29;
      if (abs(lu) < 1.06 && abs(lv) < 1.08) {
        float edge = min(1.06 - abs(lu), (1.08 - abs(lv)) * 0.7);
        vec3 body = mix(vec3(0.20, 0.23, 0.22), vec3(0.03, 0.05, 0.04), smoothstep(0.0, 0.03, edge));
        alb = body;
        spill = 1.0;
        float rr = length(vec2(lu, lv));
        if (rr < 0.95) {
          vec3 scr = vec3(0.01, 0.045, 0.02);
          float rings = bl_line(abs(rr - 0.32), 0.012, 0.01) + bl_line(abs(rr - 0.64), 0.012, 0.01) + bl_line(abs(rr - 0.94), 0.02, 0.01) * 1.5;
          float cross = max(bl_line(abs(lu), 0.008, 0.008), bl_line(abs(lv), 0.008, 0.008)) * step(rr, 0.94);
          float ang = atan(lv, lu);
          float sw = fract(t * 0.11) * 6.2832 - 3.1416;
          float dl = mod(sw - ang + 12.5664, 6.2832);
          float trail = exp(-dl * 1.6) * step(rr, 0.94);
          float arm = smoothstep(0.045, 0.0, dl) * step(rr, 0.94);
          float blips = 0.0;
          for (int k = 0; k < 4; k++) {
            float kf = float(k);
            float ba = (bl_hash(vec2(kf, 5.0)) - 0.5) * 6.2;
            float br = 0.2 + 0.65 * bl_hash(vec2(kf, 9.0));
            vec2 bp = vec2(cos(ba), sin(ba)) * br;
            float bd = length(vec2(lu, lv) - bp);
            float fade = exp(-mod(sw - ba + 12.5664, 6.2832) * 0.7);
            blips += smoothstep(0.075, 0.0, bd) * fade;
          }
          float scan = 0.88 + 0.12 * sin(P.y * 900.0);
          vec3 rc = scr + BL_LG * ((rings * 0.32 + cross * 0.16) * (0.5 + trail) + trail * 0.40 + arm * 0.9 + blips * 1.1) * scan;
          emis += rc * (1.0 - 0.35 * rr * rr);
          alb = vec3(0.02, 0.04, 0.03);
        }
      }
    }
  } else if (surf == 2) {
    // ceiling: darker concrete, bracketed pipes, a cable tray
    alb *= 0.50;
    float k0 = fract(a / 1.6), kd = min(k0, 1.0 - k0) * 1.6;
    float strap = bl_line(kd, 0.04, px);
    // pipes at fixed X with radius
    for (int q = 0; q < 5; q++) {
      float qf = float(q);
      float pcx = q == 0 ? -0.40 : (q == 1 ? -0.20 : (q == 2 ? 0.16 : (q == 3 ? 0.36 : 0.0)));
      float prr = q == 0 ? 0.075 : (q == 1 ? 0.034 : (q == 2 ? 0.05 : (q == 3 ? 0.07 : 0.0)));
      if (q < 4) {
        float hh = (P.x - pcx) / prr;
        if (abs(hh) < 1.0) {
          float cyl = sqrt(1.0 - hh * hh);
          vec3 steel = (q == 3 ? vec3(0.30, 0.34, 0.38) : vec3(0.36, 0.38, 0.35)) * (0.06 + 1.1 * cyl * cyl);
          steel *= 0.85 + 0.3 * bl_noise(vec2(a * 4.0 + qf * 9.0, P.x * 45.0));
          float joint = bl_line(min(fract(a / 2.4 + qf * 0.3), 1.0 - fract(a / 2.4 + qf * 0.3)) * 2.4, 0.02, px);
          steel *= 1.0 - 0.6 * joint;
          steel *= 1.0 - 0.75 * strap;
          alb = steel;
          glossy = 0.6 * cyl;
        }
      }
    }
    // cable tray: two rails and rungs
    float tx = abs(P.x - 0.0);
    if (tx < 0.10) {
      float rail = bl_line(abs(tx - 0.09), 0.008, px);
      float rung = bl_line(min(fract(a / 0.18), 1.0 - fract(a / 0.18)) * 0.18, 0.012, px) * step(tx, 0.09);
      float cable = step(tx, 0.085) * (0.5 + 0.5 * bl_noise(vec2(a * 2.0, P.x * 60.0)));
      alb = mix(alb * 0.5, vec3(0.20, 0.22, 0.20), max(rail, rung));
      alb = mix(alb, vec3(0.05, 0.05, 0.05) * (0.6 + cable), step(tx, 0.07) * 0.35);
    }
    // a few dripping stains
    alb *= 0.8 + 0.3 * bl_noise(vec2(a * 0.6, P.x * 3.0));
  } else if (surf == 3) {
    // floor: dark damp concrete, hazard centre dashes, puddles that mirror the lamps
    alb *= 0.38;
    float dash = step(abs(P.x), 0.018) * step(fract(a / 0.9), 0.55);
    alb = mix(alb, vec3(0.55, 0.45, 0.12) * (0.6 + 0.6 * cn), dash * 0.8);
    float edgeL = bl_line(abs(abs(P.x) - 0.52), 0.012, px);
    alb = mix(alb, vec3(0.50, 0.42, 0.12) * 0.8, edgeL * 0.5);
    float pud = smoothstep(0.60, 0.66, bl_fbm(vec2(a * 0.9, P.x * 2.4) + 20.0));
    wet = pud;
    glossy = 0.0;
    alb *= 1.0 - 0.55 * pud;
    float grate = bl_line(abs(P.x - 0.30), 0.06, px) * step(abs(fract(a / 3.0) - 0.5), 0.08);
    alb = mix(alb, vec3(0.03, 0.035, 0.035), grate);
  } else {
    // blast door at the far end
    alb = vec3(0.30, 0.33, 0.32) * (0.6 + 0.6 * cn);
    float dx = abs(P.x), dy = P.y;
    if (dx < 0.32 && dy > -0.12) {
      float fr = bl_line(dx - 0.32 + 0.025, 0.025, px) + bl_line(dy + 0.12 - 0.025, 0.025, px);
      alb = vec3(0.22, 0.25, 0.24) * (0.7 + 0.5 * fine);
      alb *= 1.0 - 0.4 * bl_line(dx, 0.008, px);
      float wr = length(vec2(P.x, dy - 0.14));
      alb = mix(alb, vec3(0.45, 0.48, 0.45), bl_line(abs(wr - 0.09), 0.012, px));
      float spoke = bl_line(abs(sin(atan(dy - 0.14, P.x) * 1.5 + 0.6)) * wr, 0.008, px) * step(wr, 0.09);
      alb = mix(alb, vec3(0.45, 0.48, 0.45), spoke);
      float wd = length(vec2(P.x, dy + 0.02) * vec2(1.0, 1.4));
      emis += BL_LG * 0.05 * smoothstep(0.045, 0.02, wd);
    }
    // exit lamp over the door
    float ed = length(vec2(P.x, dy + 0.22));
    emis += BL_LG * (smoothstep(0.035, 0.015, ed) * 1.4 + exp(-ed * ed / 0.004) * 0.35);
  }
  // let the user's picture tint the concrete a little
  alb *= mix(vec3(1.0), 0.55 + 0.95 * pic, 0.30);

  // ---------- lighting from the emergency lamps ----------
  vec3 lit = vec3(0.030, 0.055, 0.042);                                   // faint ambient
  lit += vec3(0.04, 0.12, 0.06) * smoothstep(1.0, 0.0, abs(z - BL_ZM) * 0.30) * 0.5;
  lit += BL_LG * 0.35 * spill;
  vec3 spec = vec3(0.0);
  vec3 glow = vec3(0.0);
  float haze = 0.0;
  vec3 V = normalize(P);
  for (int i = 0; i < 7; i++) {
    float zi = bl_lampZ(i);
    float sd = bl_lampSide(i);
    vec3 Lp = vec3(sd * BL_W * 0.94, -BL_H * 0.68, zi);
    vec2 ls = vp + vec2(Lp.x, Lp.y) / zi;
    float boost = 1.0;
    if (hasM) boost += 1.5 * smoothstep(0.34, 0.0, length(mp - ls));
    float Li = bl_flick(i, t) * boost;
    vec3 r = Lp - P;
    float d2 = dot(r, r);
    float rl = sqrt(d2) + 0.0001;
    float ndl = dot(n, r) / rl;
    float lamb = 0.22 + 0.78 * max(ndl, 0.0);
    lit += BL_LG * (0.30 / (0.14 + d2)) * lamb * Li * (surf == 2 ? 0.8 : 1.0);
    if (glossy + wet > 0.0) {
      vec3 Rr = reflect(-r / rl, n);
      float rd = max(dot(Rr, -V), 0.0);
      spec += BL_LG * (pow(rd, 12.0) * glossy * 0.05 + pow(rd, 260.0) * wet * 1.0) * Li;
    }
    // the lamp itself, in screen space: bright core, a dark cage rim, a soft halo
    float rs = length(p - ls);
    float sz = 0.040 / zi + 0.004;
    float core = exp(-rs * rs / (sz * sz * 0.45));
    float halo = exp(-rs / (sz * 6.0)) * 0.55 + exp(-rs * rs / (sz * sz * 90.0)) * 0.5;
    float rim = smoothstep(sz * 1.9, sz * 1.5, rs) * smoothstep(sz * 1.0, sz * 1.4, rs);
    float cage = 0.82 + 0.18 * step(0.5, fract(rs / (sz * 0.55)));
    glow += BL_LG * (core * 1.7 * cage * (1.0 - 0.5 * rim) + halo * 0.26) * Li;
    haze += halo * Li;
  }
  vec3 col = alb * lit + emis + spec;
  // the green fog lit by the lamps thickens with distance
  float fogA = 1.0 - exp(-(z - 0.4) * 0.11);
  vec3 fogc = vec3(0.03, 0.08, 0.05) * (0.4 + 1.2 * haze) + vec3(0.008, 0.02, 0.012);
  col = mix(col, fogc * (0.9 + 0.5 * bl_fbm(p * 3.0 + t * 0.02)), fogA * 0.42);
  col += glow;

  // ---------- drifting dust, lit near the lamps ----------
  float dust = 0.0;
  for (int k = 0; k < 3; k++) {
    float kf = float(k);
    float sc = 22.0 + 18.0 * kf;
    vec2 q = p * sc + vec2(t * (0.35 + 0.25 * kf), -t * (0.10 + 0.08 * kf)) + kf * 31.0;
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    vec2 off = (vec2(bl_hash(cell + 1.0), bl_hash(cell + 5.0)) - 0.5) * 0.6;
    float dd = length(f - off);
    float on = step(0.55, bl_hash(cell + 9.0 + kf));
    float tw = 0.6 + 0.4 * sin(t * (0.6 + bl_hash(cell) * 1.4) + bl_hash(cell + 2.0) * 6.28);
    dust += smoothstep(0.075 + 0.02 * (2.0 - kf), 0.0, dd) * on * tw * (0.6 + 0.3 * kf);
  }
  col += vec3(0.60, 0.95, 0.66) * dust * (0.05 + 0.55 * min(haze, 1.6));

  // tone: keep the dark parts alive, roll off the lamps
  col = col / (1.0 + 0.38 * col);
  col = pow(max(col, 0.0), vec3(0.92));
  col *= 1.0 - 0.34 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
