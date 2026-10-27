// label: Drone alley
// hint: a narrow dark alley between tall walls, a surveillance drone hovering with a sweeping searchlight and a red scanner dot over graffiti-like colour patches, steam vents and a wet floor; the drone turns its light toward the pointer
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
float da_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float da_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(da_hash(i), da_hash(i + vec2(1, 0)), f.x), mix(da_hash(i + vec2(0, 1)), da_hash(i + vec2(1, 1)), f.x), f.y);
}
float da_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * da_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float da_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float da_ell(vec2 p, vec2 c, vec2 r, float soft) { return smoothstep(1.0, 1.0 - soft, length((p - c) / r)); }
float da_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// alley cross-section (one point perspective): half width A, floor at +F below the eye, wall tops at -TOPY
const float DA_A = 0.62;
const float DA_F = 0.42;
const float DA_TOPY = 1.00;

// a graffiti-like colour patch: abstract shapes only (blob, stripes, ring, chevron), sprayed with a rough edge
vec4 da_paint(vec2 uv, vec2 cell, float sc) {
  vec2 id = floor(uv / cell);
  vec2 lc = fract(uv / cell) - 0.5;
  float h0 = da_hash(id + sc), h1 = da_hash(id * 1.7 + sc + 3.0), h2 = da_hash(id * 2.3 + sc + 7.0);
  if (h0 < 0.34) return vec4(0.0);
  vec2 c = (vec2(h1, h2) - 0.5) * 0.30;
  vec2 q = lc - c;
  float rough = (da_noise(uv * 26.0 + sc) - 0.5) * 0.06;
  float shape = 0.0;
  float kind = da_hash(id + sc + 11.0);
  if (kind < 0.25) {                                            // a fat blob
    shape = smoothstep(0.22 + rough, 0.18 + rough, length(q * vec2(1.0, 1.25)));
  } else if (kind < 0.50) {                                     // diagonal stripes in a patch
    float inb = smoothstep(0.26, 0.22, max(abs(q.x), abs(q.y) * 1.25) + rough);
    shape = inb * smoothstep(0.30, 0.46, abs(fract((q.x + q.y) * 5.0) - 0.5));
  } else if (kind < 0.75) {                                     // a thick ring with a dot
    float rr = length(q * vec2(1.0, 1.2));
    shape = max(smoothstep(0.06, 0.03, abs(rr - 0.19 + rough)), smoothstep(0.045, 0.02, rr));
  } else {                                                      // chevrons
    float cv = abs(q.y * 1.1) - abs(q.x) * 0.6;
    shape = smoothstep(0.10, 0.07, abs(fract(cv * 3.5 + 0.2) - 0.5) * 0.5 + rough) * smoothstep(0.30, 0.25, abs(q.x)) * smoothstep(0.24, 0.20, abs(q.y));
  }
  float hue = da_hash(id + sc + 19.0);
  vec3 pc = hue < 0.30 ? vec3(1.00, 0.18, 0.55) : (hue < 0.55 ? vec3(0.95, 0.85, 0.15) : (hue < 0.80 ? vec3(0.10, 0.85, 0.90) : vec3(1.0, 0.42, 0.10)));
  return vec4(pc, clamp(shape, 0.0, 1.0) * (0.75 + 0.25 * da_noise(uv * 90.0)));
}

// albedo of a wall point: u = distance along the alley, v = height (down positive), side -1 / +1
vec3 da_wall(float u, float v, float side) {
  float sd = side * 5.0;
  vec3 col = vec3(0.30, 0.29, 0.35) * (0.70 + 0.50 * da_noise(vec2(u * 4.0 + sd, v * 4.0)));
  // brick courses
  float row = floor(v * 9.0);
  float bx = fract(u * 3.6 + 0.5 * mod(row, 2.0));
  float mortar = max(smoothstep(0.05, 0.0, abs(fract(v * 9.0) - 0.5) - 0.44), smoothstep(0.04, 0.0, abs(bx - 0.5) - 0.46));
  col *= 1.0 - 0.38 * mortar;
  col *= 0.75 + 0.45 * da_noise(vec2(floor(u * 3.6 + 0.5 * mod(row, 2.0)) + sd, row));
  // rain stains running down from the top
  col *= 0.70 + 0.35 * smoothstep(0.2, 0.9, da_fbm(vec2(u * 3.0 + sd, v * 0.6)));
  // pipes: two horizontal runs and a drainpipe every few metres
  float pipe1 = smoothstep(0.022, 0.012, abs(v + 0.08)) + smoothstep(0.016, 0.008, abs(v - 0.16));
  float drain = smoothstep(0.050, 0.030, abs(fract(u * 0.55 + 0.17 * side) - 0.5) * 1.0 - 0.38) * 0.0;
  float dp = smoothstep(0.030, 0.018, abs(fract(u * 0.42 + 0.31 * side) - 0.5) - 0.455 + 0.0);
  col = mix(col, vec3(0.30, 0.26, 0.28), clamp(pipe1 * 0.75 + dp * 0.9, 0.0, 1.0));
  // doors low in the wall and a few windows higher up
  vec2 cell = vec2(2.2, 0.9);
  vec2 wid = floor(vec2(u + 0.7 * side, v) / cell);
  float wh = da_hash(wid + sd);
  vec2 wl = fract(vec2(u + 0.7 * side, v) / cell);
  if (v < 0.42 && v > 0.12) {
    float door = step(0.52, wh) * step(abs(wl.x - 0.5), 0.17) * step(0.62, wl.y);
    col = mix(col, vec3(0.02, 0.02, 0.03), door);
  }
  float win = step(0.40, wh) * step(abs(wl.x - 0.5), 0.12) * step(abs(wl.y - 0.45), 0.17) * step(v, -0.12);
  float lit = step(0.78, da_hash(wid + sd + 3.0));
  col = mix(col, mix(vec3(0.03, 0.04, 0.07), vec3(1.0, 0.70, 0.35), lit), win);
  // sprayed paint: two scales, only on the lower wall
  vec4 pa = da_paint(vec2(u + 0.37 * side, v + 0.30), vec2(2.0, 0.85), sd + 1.0);
  float lowWall = smoothstep(-0.50, -0.25, v);
  col = mix(col, pa.rgb * 1.05, pa.a * lowWall * 0.95);
  vec4 pb = da_paint(vec2(u * 1.0 + 1.3 + 0.9 * side, v + 0.35), vec2(1.3, 0.55), sd + 8.0);
  col = mix(col, pb.rgb * 0.95, pb.a * 0.85 * lowWall);
  return col;
}

vec3 da_floor(float x, float z, float wet) {
  vec3 col = vec3(0.10, 0.10, 0.12) * (0.75 + 0.45 * da_noise(vec2(x * 8.0, z * 8.0)));
  // a couple of old paint marks on the asphalt and the odd kerb crack
  vec4 pa = da_paint(vec2(x + 0.2, z * 0.7), vec2(1.1, 1.6), 31.0);
  col = mix(col, pa.rgb * 0.55, pa.a * 0.35);
  col *= 0.8 + 0.3 * smoothstep(0.45, 0.65, da_fbm(vec2(x * 3.0, z * 2.5)));
  return col;
}

// steam plume from a floor vent, p in screen space
float da_steam(vec2 p, vec2 base, float size, float lean, float t, float seed) {
  float h = base.y - p.y;
  if (h < 0.0) return 0.0;
  float hn = h / (0.62 * size);
  float x = p.x - base.x - lean * hn * hn * 0.22 * size - 0.03 * size * sin(h * 7.0 / size - t * 0.7 + seed) * hn;
  float width = (0.034 + 0.17 * hn) * size;
  float core = exp(-x * x / (width * width));
  vec2 q = vec2(x * 7.0 / size, h * 4.2 / size - t * 0.45 + seed * 3.0);
  float n = da_fbm(q + da_fbm(q * 0.6) * 0.8);
  float wisps = smoothstep(0.26, 0.72, n + 0.30 * (1.0 - hn));
  float fade = smoothstep(0.0, 0.03 * size, h) * (1.0 - smoothstep(0.30, 1.0, hn));
  return clamp(core * wisps * fade * 1.1, 0.0, 1.0);
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
  float pl = da_luma(pic);

  vec2 vp = vec2(0.5 * asp, 0.44);
  vec2 r = p - vp;

  // ---- the drone and where its light falls
  vec2 tgt = hasM ? mp : vec2(vp.x + 0.38 * asp * sin(t * 0.33) * (0.75 + 0.25 * sin(t * 0.11)), 0.68 + 0.10 * sin(t * 0.21 + 1.0));
  vec2 drone = vec2(vp.x + 0.10 * sin(t * 0.27) + (hasM ? 0.14 * (mp.x - vp.x) : 0.0), 0.235 + 0.010 * sin(t * 1.1) + 0.008 * sin(t * 0.37));
  vec2 lens = drone + vec2(0.0, 0.024);
  vec2 bdir = tgt - lens;
  float blen = max(length(bdir), 0.05);
  bdir /= blen;
  vec2 bnrm = vec2(-bdir.y, bdir.x);

  // light on the surfaces: a pool on the target, broad enough to wake the painted patches
  vec2 pd = (p - tgt) / vec2(0.150, 0.100);
  float pool = exp(-dot(pd, pd) * 1.0);
  float poolHard = smoothstep(1.0, 0.55, length(pd));
  vec2 rel = p - lens;
  float along = dot(rel, bdir), perp = dot(rel, bnrm);
  float cone = exp(-pow(perp / (0.004 + max(along, 0.0) * 0.105), 2.0)) * smoothstep(0.0, 0.04, along) * smoothstep(blen + 0.04, blen - 0.03, along);

  // ---- surfaces
  vec3 alb;
  float z = 40.0;
  float isFloor = 0.0, isWall = 0.0, isSky = 0.0;
  float zf = r.y > 0.001 ? DA_F / r.y : 1e4;
  float zw = DA_A / max(abs(r.x), 1e-4);
  float side = r.x < 0.0 ? -1.0 : 1.0;
  vec3 sky = vec3(0.07, 0.07, 0.19) + vec3(0.45, 0.20, 0.34) * exp(-max(-r.y, 0.0) * 3.2) * 0.55;
  sky += vec3(0.10, 0.06, 0.14) * da_fbm(p * vec2(3.0, 5.0) + t * 0.01);
  sky += vec3(0.55, 0.62, 1.0) * pl * 0.28;
  float fog = 0.0;
  if (zf < zw) {
    isFloor = 1.0;
    z = zf;
    alb = da_floor(r.x * z, z, 1.0);
  } else {
    float v = r.y * zw;
    if (v < -DA_TOPY) {
      isSky = 1.0;
      alb = sky;
      z = 60.0;
    } else {
      isWall = 1.0;
      z = zw;
      alb = da_wall(z, v, side);
      // rooftop edge: a dark cornice and a lip catching the sky glow
      alb *= 0.65 + 0.35 * smoothstep(-DA_TOPY, -DA_TOPY + 0.10, v);
    }
  }
  fog = 1.0 - exp(-z * 0.10);

  // ---- lighting: cool moonless ambient, a warm lamp over a doorway, red spill from the scanner, the searchlight
  vec3 amb = vec3(0.34, 0.40, 0.58);
  float lampA = 0.0;
  if (isWall > 0.5) {
    float lu = (z - 2.7) / 0.9;
    float lv = (r.y * z - 0.06) / 0.30;
    lampA = exp(-(lu * lu + lv * lv)) * step(side, 0.0);
    float lu2 = (z - 5.4) / 1.2;
    float lv2 = (r.y * z + 0.02) / 0.35;
    lampA += 0.7 * exp(-(lu2 * lu2 + lv2 * lv2)) * step(0.0, side);
  }
  // abstract neon signs hung on the walls: tubes plus the coloured light they throw on the walls and the wet floor
  vec3 neon = vec3(0.0);
  vec3 neonSign = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float sgn = i < 2 ? -1.0 : 1.0;
    float z0 = i == 0 ? 1.9 : (i == 1 ? 4.9 : (i == 2 ? 3.1 : 6.6));
    vec3 nc = i == 0 ? vec3(1.0, 0.16, 0.58) : (i == 1 ? vec3(0.12, 0.90, 0.95) : (i == 2 ? vec3(1.0, 0.80, 0.18) : vec3(1.0, 0.16, 0.58)));
    float v0 = i == 0 ? -0.34 : (i == 1 ? -0.30 : (i == 2 ? -0.40 : -0.26));
    if (isWall > 0.5 && side == sgn) {
      vec2 dn = vec2((z - z0) / 1.0, (r.y * z - v0) / 0.55);
      neon += nc * exp(-dot(dn, dn)) * 0.9;
      vec2 sq = vec2((z - z0) / (0.20 + 0.05 * mod(float(i), 2.0)), (r.y * z - v0) / 0.26);
      float dbox = max(abs(sq.x), abs(sq.y));
      float tubeLine = smoothstep(0.16, 0.0, abs(dbox - 1.0)) + smoothstep(0.12, 0.0, abs(sq.x * 0.5 - sq.y * 0.7)) * step(dbox, 0.95) * 0.7;
      float fk = 1.0 - 0.5 * step(0.95, da_hash(vec2(floor(t * 8.0), float(i))));
      neonSign += nc * tubeLine * 1.5 * fk;
    }
    if (isFloor > 0.5) {
      float xw = r.x * z;
      vec2 df = vec2((z - z0) / 1.3, (DA_A - sgn * xw) / 0.55);
      neon += nc * exp(-dot(df, df)) * 0.35;
    }
  }
  vec3 lampC = vec3(1.0, 0.56, 0.22);
  vec2 dr = (p - drone) / vec2(0.22, 0.20);
  float redSpill = exp(-dot(dr, dr)) * (0.55 + 0.45 * pow(0.5 + 0.5 * sin(t * 3.0), 3.0));
  vec3 light = amb * (0.85 + 0.25 * da_noise(p * 3.0)) + lampC * lampA * 1.3 + neon * 1.1 + vec3(1.0, 0.10, 0.12) * redSpill * 0.55;
  light += vec3(0.80, 0.95, 1.00) * (pool * 1.9 + cone * 0.25);
  vec3 col = alb * light + neonSign * (1.0 - 0.5 * fog);
  if (isFloor > 0.5) {
    // wet asphalt: puddles that throw the searchlight and the glow of the far end back at you
    float puddle = smoothstep(0.42, 0.62, da_fbm(vec2(r.x * z * 2.5, z * 2.0 + 3.0)));
    vec2 rp = vec2(p.x - tgt.x, (p.y - (tgt.y + 0.07)) * 0.35);
    float spec = exp(-(rp.x * rp.x / 0.0016 + rp.y * rp.y / 0.012)) * puddle;
    col += vec3(0.75, 0.90, 1.0) * spec * 0.55 * smoothstep(0.30, 0.55, p.y);
    col += neon * puddle * 0.55;
    // sheen toward the bright far end
    col += vec3(0.30, 0.26, 0.40) * puddle * smoothstep(3.0, 14.0, z) * 0.35;
  }
  // far end of the alley: a hazy glow lit by a street beyond, everything fades into it
  vec3 farC = vec3(0.34, 0.26, 0.44) + vec3(0.2, 0.1, 0.0) * exp(-length(r) * 6.0);
  float glowEnd = exp(-length(r * vec2(1.6, 1.0)) * 7.0);
  col = mix(col, farC, fog * 0.85 * (isSky > 0.5 ? 0.0 : 1.0));
  col += vec3(0.70, 0.52, 0.62) * glowEnd * 0.35 * (isSky > 0.5 ? 0.6 : 1.0);
  if (isSky > 0.5) col = mix(col * (0.5 + 0.5 * pool), vec3(0.08, 0.07, 0.18), 0.0);

  // ---- steam vents on the floor, lit from within by the lamp colours and by the beam
  float stm = 0.0;
  vec3 stmCol = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float vx = i == 0 ? -0.30 : (i == 1 ? 0.24 : -0.14);
    float vz = i == 0 ? 1.2 : (i == 1 ? 2.0 : 3.6);
    vec2 base = vp + vec2(vx / vz, DA_F / vz);
    float size = 1.25 / (0.55 + 0.45 * vz);
    float lean = (hasM ? clamp((mp.x - base.x) / 0.8, -0.8, 0.8) * 0.5 : 0.0) + 0.30 * sin(t * 0.13 + fi * 2.0) - 0.15 * fi;
    float s = da_steam(p, base, size, lean, t + fi * 9.0, fi * 3.7);
    stm = max(stm, s);
    // vent grate glow on the floor
    vec2 gp = (p - base) / vec2(0.060 * size, 0.012 * size);
    col += vec3(0.9, 0.40, 0.25) * exp(-dot(gp, gp)) * 0.35;
  }
  float stmLight = 0.55 + 1.9 * pool + 0.5 * cone + 0.35 * lampA;
  vec3 stmC = mix(vec3(0.50, 0.55, 0.70), vec3(0.95, 0.97, 1.0), clamp(pool + cone, 0.0, 1.0)) * stmLight;
  stmC += vec3(0.85, 0.25, 0.55) * 0.10 + vec3(1.0, 0.45, 0.2) * lampA * 0.4;
  col = mix(col, stmC, clamp(stm * 0.80, 0.0, 0.92));

  // ---- the searchlight beam in the air: dust and steam light it up
  float dust = 0.55 + 0.9 * da_fbm(vec2(along * 8.0, perp * 20.0) + t * vec2(0.05, 0.03));
  col += vec3(0.62, 0.86, 1.0) * cone * dust * (0.30 + 0.5 * stm) * (1.0 - 0.4 * smoothstep(0.0, blen, along));
  col += vec3(0.72, 0.92, 1.0) * poolHard * pool * 0.10;

  // ---- the drone itself
  {
    float ang = 0.25 * clamp((tgt.x - drone.x) / 0.7, -1.0, 1.0);
    float cs = cos(ang), sn = sin(ang);
    vec2 q = (p - drone) * 0.78;
    q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
    float hull = da_ell(q, vec2(0.0, 0.0), vec2(0.040, 0.013), 0.18);
    float dome = da_ell(q, vec2(0.0, -0.007), vec2(0.021, 0.012), 0.2) * step(q.y, -0.002);
    float arm = max(smoothstep(0.0030, 0.0008, da_seg(q, vec2(-0.03, 0.0), vec2(-0.078, -0.012))), smoothstep(0.0030, 0.0008, da_seg(q, vec2(0.03, 0.0), vec2(0.078, -0.012))));
    float pod = da_ell(q, vec2(0.0, 0.017), vec2(0.011, 0.011), 0.2);
    vec3 dc = vec3(0.045, 0.050, 0.065) + vec3(0.28, 0.34, 0.45) * smoothstep(0.012, -0.012, q.y) * 0.45;     // top edge catches the sky glow
    dc += vec3(0.15, 0.20, 0.30) * smoothstep(0.0, 0.016, q.y) * 0.0;
    col = mix(col, dc, max(max(hull, dome), max(arm, pod)));
    // rotors: faint spinning discs
    for (int k = 0; k < 2; k++) {
      float sgn = k == 0 ? -1.0 : 1.0;
      vec2 rc = vec2(sgn * 0.078, -0.013);
      float rot = da_ell(q, rc, vec2(0.036, 0.0055), 0.4);
      float spin = 0.5 + 0.5 * sin(atan(q.y - rc.y, (q.x - rc.x) / 6.0) * 2.0 + t * 38.0 * sgn);
      col = mix(col, vec3(0.20, 0.24, 0.32), rot * (0.28 + 0.14 * spin));
    }
    // lens: the searchlight source, with its glare
    vec2 lq = q - vec2(0.0, 0.017);
    col += vec3(0.85, 0.95, 1.0) * (exp(-dot(lq, lq) / 0.000030) * 1.2 + exp(-dot(lq, lq) / 0.0009) * 0.35);
    // the red scanner dot, pulsing, with a thin red scan ring on the hull
    vec2 sq = q - vec2(0.027, -0.002);
    float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * 3.0), 3.0);
    col += vec3(1.0, 0.07, 0.08) * (exp(-dot(sq, sq) / 0.0000045) * 1.4 + exp(-dot(sq, sq) / 0.00035) * 0.5) * pulse;
    // and the red laser mark that wanders inside the lit patch
    vec2 rd = tgt + vec2(0.030 * cos(t * 1.9), 0.014 * sin(t * 2.7)) - p;
    col += vec3(1.0, 0.10, 0.10) * (exp(-dot(rd, rd) / 0.000012) * 1.1 + exp(-dot(rd, rd) / 0.0004) * 0.18);
  }

  col *= 0.94 + 0.10 * pl;
  col *= 1.0 - 0.50 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
