// label: Steam foundry
// hint: a brass workshop: riveted pipes, slowly turning gears, hanging gauges, a glowing furnace door and valves that puff white steam; near the pointer the valves puff harder and the gears surge
// category: Frontier and steam
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
float sf_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sf_h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float sf_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sf_hash(i), sf_hash(i + vec2(1, 0)), f.x), mix(sf_hash(i + vec2(0, 1)), sf_hash(i + vec2(1, 1)), f.x), f.y);
}
float sf_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * sf_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sf_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * sf_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sf_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float sf_box(vec2 p, vec2 c, vec2 h, float aa) {
  vec2 d = abs(p - c) - h;
  return 1.0 - smoothstep(-aa, aa, max(d.x, d.y));
}
float sf_disc(vec2 p, vec2 c, float r) { return 1.0 - smoothstep(r - 0.0012, r + 0.0012, length(p - c)); }
float sf_ring(vec2 p, vec2 c, float r, float w) { return 1.0 - smoothstep(w * 0.55, w, abs(length(p - c) - r)); }
float sf_seg(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return 1.0 - smoothstep(r - 0.0004, r + 0.0006, length(pa - ba * h));
}
// a rivet: round head with a small highlight
vec3 sf_rivet(vec2 p, vec2 c, float r, vec3 base) {
  float d = length(p - c);
  float m = 1.0 - smoothstep(r - 0.0008, r + 0.0008, d);
  float hi = smoothstep(r * 0.6, 0.0, length(p - c - vec2(-r * 0.35, -r * 0.35)));
  return mix(base, base * 0.55 + vec3(0.9, 0.7, 0.4) * hi * 0.55, m) * 1.0 + vec3(0.0);
}

const float SF_FLOOR = 0.88;

// ---- gears: toothed rim, spoked web and hub; returns a mask in x and a bevel shade in y
vec2 sf_gear(vec2 p, vec2 c, float R, float teeth, float ang, float spokes) {
  vec2 q = p - c;
  float r = length(q);
  if (r > R * 1.25) return vec2(0.0);
  float a = atan(q.y, q.x) - ang;
  float k = fract(a * teeth / 6.28318);
  float tr = smoothstep(0.02, 0.16, k) * smoothstep(0.52, 0.38, k);
  float edge = R * (0.88 + 0.13 * tr);
  float body = 1.0 - smoothstep(edge - 0.0015, edge + 0.0015, r);
  float inner = R * 0.64;
  float web = smoothstep(inner - 0.0015, inner + 0.0015, r);              // 1 on the rim band
  float sp = abs(sin(a * spokes * 0.5));
  float spoke = smoothstep(0.20, 0.05, sp * r / R);                       // spokes of constant width
  float hub = 1.0 - smoothstep(R * 0.17 - 0.0015, R * 0.17 + 0.0015, r);
  float m = body * max(max(web, spoke * step(R * 0.17, r + 0.001)), hub);
  // bevel: bright edge toward the top-left, dark toward the bottom-right, and a rim ring line
  float u = r / R;
  float lightd = dot(normalize(q + 1e-5), normalize(vec2(-0.6, -0.8)));
  float bev = smoothstep(edge - 0.012, edge, r) * (0.5 + 0.5 * lightd) + smoothstep(inner + 0.012, inner, r) * smoothstep(inner - 0.014, inner, r) * (0.5 - 0.5 * lightd) * 0.0;
  float groove = smoothstep(0.006, 0.0, abs(r - R * 0.76)) * 0.35 * web;
  float hubd = smoothstep(R * 0.075, R * 0.04, r);
  return vec2(m, clamp(0.35 + 0.35 * lightd * smoothstep(0.55, 0.88, u) + 0.2 * bev - groove + 0.25 * hubd, 0.0, 1.0));
}

// pipe shading for a cylinder: s in [-1, 1] across the pipe
vec3 sf_brass(float s, float t) {
  float z = sqrt(max(1.0 - s * s, 0.0));
  vec3 n = vec3(0.0, s, z);
  vec3 L = normalize(vec3(-0.25, -0.65, 0.72));
  float dif = max(dot(n, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 28.0);
  vec3 base = vec3(0.74, 0.46, 0.17);
  return base * (0.16 + 0.95 * dif) + vec3(1.0, 0.82, 0.55) * spec * 0.55 + vec3(0.30, 0.10, 0.04) * pow(max(s, 0.0), 3.0) * 0.5;
}

// one steam jet: soft puffs that drift out of the nozzle and billow
float sf_jet(vec2 p, vec2 v, vec2 dir, float t, float seed, float env) {
  float acc = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float life = fract(t * 0.30 + fi / 7.0 + seed * 0.37);
    float id = floor(t * 0.30 + fi / 7.0 + seed * 0.37) * 7.0 + fi + seed * 13.0;
    float spreadv = (sf_h1(id) - 0.5);
    vec2 pos = v + dir * (0.015 + life * 0.26 * (0.7 + 0.3 * sf_h1(id + 1.0))) + vec2(spreadv * 0.05 * life + sin(t * 1.3 + id) * 0.012 * life, -life * life * 0.12);
    float rad = 0.010 + 0.075 * pow(life, 0.75);
    vec2 d = p - pos;
    float n = sf_noise(d * 38.0 + id) * 0.55 + sf_noise(d * 85.0 - id) * 0.30;
    float body = smoothstep(rad * (1.0 + 0.5 * n), rad * 0.15, length(d));
    acc += body * pow(1.0 - life, 1.1) * smoothstep(0.0, 0.07, life) * env * 1.05;
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
  vec3 pic = wall(uv);
  float flick = 0.88 + 0.08 * sin(t * 7.0) * sin(t * 3.1 + 1.0) + 0.05 * sin(t * 13.0);
  vec2 FC = vec2(asp * 0.255, 0.655);                                // the furnace door
  vec3 col;

  // proximity of the pointer to each feature (stateless: pure functions of the pointer position)
  float nearAny = hasM ? 1.0 : 0.0;

  // ---- back wall: dark riveted iron plates with soot
  {
    vec2 g = vec2(p.x / 0.36, p.y / 0.26);
    float row = floor(g.y);
    g.x += 0.5 * mod(row, 2.0);
    vec2 cid = floor(g);
    vec2 f = fract(g);
    float seam = max(smoothstep(0.012, 0.0, f.x) + smoothstep(0.988, 1.0, f.x), smoothstep(0.02, 0.0, f.y) + smoothstep(0.980, 1.0, f.y));
    float tone = 0.8 + 0.4 * sf_hash(cid);
    col = vec3(0.115, 0.075, 0.055) * tone;
    col *= 0.75 + 0.5 * sf_fbm(p * vec2(7.0, 4.0) + cid);
    col *= 1.0 - 0.55 * clamp(seam, 0.0, 1.0);
    col += vec3(0.05, 0.03, 0.02) * smoothstep(0.88, 1.0, f.y) * 0.5;
    // rivets at the plate corners and along the seams
    vec2 pc = vec2(0.36, 0.26) * (floor(vec2(g.x - 0.5 * mod(row, 2.0) + 0.5, g.y + 0.5)) - vec2(0.5, 0.5)) + vec2(0.18 * mod(row, 2.0) * 0.0, 0.0);
    // soot streaks running down from the top
    col *= 1.0 - 0.35 * smoothstep(0.55, 0.9, sf_fbm3(vec2(p.x * 9.0, p.y * 1.2))) * smoothstep(0.7, 0.0, p.y);
  }
  // rows of rivets on the wall seams (computed per plate cell, no arrays)
  {
    vec2 g = vec2(p.x / 0.36, p.y / 0.26);
    float row = floor(g.y);
    g.x += 0.5 * mod(row, 2.0);
    vec2 f = fract(g);
    for (int k = 0; k < 4; k++) {
      vec2 c = vec2((k == 0 || k == 2) ? 0.07 : 0.93, (k < 2) ? 0.10 : 0.90);
      vec2 d = (f - c) * vec2(0.36, 0.26);
      float rr = 1.0 - smoothstep(0.0055, 0.0075, length(d));
      float hi = smoothstep(0.004, 0.0, length(d + vec2(0.0018, 0.0018)));
      col = mix(col, vec3(0.20, 0.13, 0.09) + vec3(0.45, 0.30, 0.18) * hi, rr);
    }
  }

  // ---- gears behind the pipes: three meshing wheels of different sizes
  {
    float prox = hasM ? smoothstep(1.1, 0.0, length(mp - vec2(asp * 0.62, 0.55))) : 0.0;
    // the speed-up is a surge: stateless, so a pure change of speed would jump the angle; a zero-mean bonus is used
    float surge = 0.9 * prox * sin(t * 0.8);
    float w1 = 0.16;
    float a1 = w1 * (t + surge * 2.2);
    vec2 c1 = vec2(asp * 0.66, 0.80);
    vec2 c2 = c1 + vec2(-0.78, -0.62) * 0.95 * (0.23 + 0.125);
    vec2 c3 = c2 + vec2(0.30, -0.95) * 0.95 * (0.125 + 0.072);
    vec2 g1 = sf_gear(p, c1, 0.23, 18.0, a1, 6.0);
    vec2 g2 = sf_gear(p, c2, 0.125, 10.0, -a1 * 1.8 + 0.2618, 5.0);
    vec2 g3 = sf_gear(p, c3, 0.072, 6.0, a1 * 3.0 * 1.0 + 0.5, 4.0);
    vec3 brass = vec3(0.60, 0.38, 0.14);
    vec3 dk = vec3(0.30, 0.18, 0.07);
    // each gear gets its own darkness from depth: big one in front, the smallest farthest
    vec3 c;
    c = mix(dk, brass * 1.5, g3.y);  col = mix(col, c * 0.85, g3.x);
    c = mix(dk, brass * 1.5, g2.y);  col = mix(col, c * 0.95, g2.x);
    c = mix(dk, brass * 1.5, g1.y);  col = mix(col, c, g1.x);
    // dark gaps behind the spokes read as shadow on the wall
    float sh1 = sf_disc(p, c1 + vec2(0.012, 0.014), 0.20);
    col *= 1.0 - 0.0 * sh1;
  }

  // ---- the furnace: a brick block with a riveted iron door and a glowing grate
  {
    vec2 bc = vec2(FC.x, 0.665);
    float block = sf_box(p, bc, vec2(0.205, 0.235), 0.002);
    vec2 bg = p * vec2(30.0, 62.0);
    float bf = fract(bg.y);
    vec2 bid = floor(bg + vec2(0.5 * mod(floor(bg.y), 2.0), 0.0));
    float mortar = max(smoothstep(0.10, 0.0, bf), smoothstep(0.90, 1.0, bf));
    mortar = max(mortar, smoothstep(0.06, 0.0, abs(fract(bg.x + 0.5 * mod(floor(bg.y), 2.0)) - 0.0)));
    vec3 brick = mix(vec3(0.20, 0.08, 0.05), vec3(0.34, 0.15, 0.08), sf_hash(bid)) * (0.8 + 0.3 * sf_noise(p * 90.0));
    brick = mix(brick, vec3(0.09, 0.06, 0.05), mortar * 0.8);
    col = mix(col, brick, block);
    // door
    vec2 dc = FC;
    float door = sf_box(p, dc, vec2(0.125, 0.150), 0.002) * (1.0 - smoothstep(0.0, 0.002, p.y - dc.y - 0.150 + 0.0));
    float arch = 1.0 - smoothstep(0.0, 0.003, length((p - (dc + vec2(0.0, -0.150))) * vec2(1.0, 1.0)) - 0.125);
    door = max(door, arch * step(p.y, dc.y - 0.150));
    float dsh = sf_box(p, dc, vec2(0.125, 0.150), 0.01);
    vec3 iron = vec3(0.075, 0.07, 0.07) * (0.8 + 0.5 * sf_fbm3(p * vec2(30.0, 40.0)));
    float ds = (p.y - dc.y) / 0.15;
    iron += vec3(0.10, 0.07, 0.05) * smoothstep(0.7, -1.0, ds) * 0.4;
    col = mix(col, iron, door);
    // glowing grate (an opening with bars)
    vec2 oc = dc + vec2(0.0, 0.015);
    float open = sf_box(p, oc, vec2(0.078, 0.092), 0.0015);
    float arch2 = 1.0 - smoothstep(0.0, 0.002, length(p - (oc + vec2(0.0, -0.092))) - 0.078);
    open = max(open, arch2 * step(p.y, oc.y - 0.092));
    vec2 gq = (p - oc) / vec2(0.078, 0.10);
    float hot = 0.55 + 0.45 * sf_fbm3(vec2(gq.x * 3.0 + t * 0.3, gq.y * 3.0 - t * 1.8));
    vec3 fire = mix(vec3(0.70, 0.12, 0.03), vec3(1.0, 0.50, 0.10), hot * (0.5 + 0.5 * smoothstep(0.6, -0.8, gq.y)));
    fire = mix(fire, vec3(1.0, 0.82, 0.38), smoothstep(0.6, 0.0, length((gq - vec2(0.0, 0.35)) * vec2(1.0, 1.2))) * 0.55 * hot);
    float bars = smoothstep(0.050, 0.020, abs(fract(gq.x * 4.5 + 0.5) - 0.5) * 0.5) ;
    col = mix(col, fire * flick, open);
    col = mix(col, vec3(0.04, 0.03, 0.03), open * bars * 0.9);
    // door frame rim and big rivets round the door
    float frame = max(sf_ring(p, oc, 0.0, 0.0), 0.0);
    float fr = max(sf_box(p, oc, vec2(0.084, 0.098), 0.0015) - sf_box(p, oc, vec2(0.078, 0.092), 0.0015), 0.0);
    col = mix(col, vec3(0.35, 0.22, 0.10) * (0.7 + 0.3 * flick), fr * door);
    for (int k = 0; k < 10; k++) {
      float kf = float(k);
      vec2 rc = (k < 5) ? dc + vec2(-0.112 + 0.056 * kf, 0.135) : dc + vec2(((kf < 7.5) ? -0.112 : 0.112), -0.115 + 0.062 * (kf - 5.0 - ((kf < 7.5) ? 0.0 : 2.5)));
      float rr = 1.0 - smoothstep(0.0055, 0.0075, length(p - rc));
      float hi = smoothstep(0.0045, 0.0, length(p - rc + vec2(0.002, 0.002)));
      col = mix(col, vec3(0.28, 0.19, 0.11) + vec3(0.5, 0.35, 0.2) * hi, rr * door);
    }
    // handle
    float handle = sf_box(p, dc + vec2(0.105, 0.012), vec2(0.007, 0.045), 0.0012) + sf_box(p, dc + vec2(0.097, 0.0), vec2(0.016, 0.006), 0.0012);
    col = mix(col, vec3(0.45, 0.30, 0.14), clamp(handle, 0.0, 1.0) * door);
    // a little chimney plate on top of the block
    float cap = sf_box(p, bc + vec2(0.0, -0.246), vec2(0.215, 0.012), 0.0015);
    col = mix(col, vec3(0.14, 0.10, 0.08), cap);
  }

  // ---- warm light: the furnace colours the whole workshop
  {
    float fd = length((p - FC - vec2(0.0, 0.02)) * vec2(1.0, 1.1));
    float L = flick / (1.0 + fd * fd * 9.0);
    col = col * (0.68 + L * 1.15) + vec3(1.0, 0.42, 0.10) * L * L * 0.12;
  }

  // ---- the floor: iron plates with a pool of light
  if (p.y > SF_FLOOR) {
    float dgf = p.y - SF_FLOOR;
    float fy = dgf / (1.0 - SF_FLOOR);
    vec2 fg = vec2((p.x - asp * 0.5) / (0.2 + fy * 0.35), 0.06 / (dgf + 0.03));
    float gseam = max(smoothstep(0.03, 0.0, abs(fract(fg.x * 1.2) - 0.5) - 0.47), smoothstep(0.04, 0.0, abs(fract(fg.y * 1.6) - 0.5) - 0.46));
    vec3 fl = vec3(0.065, 0.045, 0.035) * (0.8 + 0.5 * sf_fbm(vec2(p.x * 10.0, p.y * 30.0)));
    float pool = flick / (1.0 + pow(length((p - vec2(FC.x, 0.89)) * vec2(0.7, 3.2)), 2.0) * 9.0);
    fl += vec3(0.95, 0.40, 0.12) * pool * 0.35;
    fl *= 1.0 - 0.45 * gseam;
    col = mix(col, fl, smoothstep(0.0, 0.004, dgf));
    col += vec3(0.20, 0.08, 0.03) * smoothstep(0.010, 0.0, dgf) * 0.5;
  }

  // ---- pipes: the big horizontal main, two verticals; brass cylinders with flanges and bolts
  vec3 V1 = vec3(0.0); 
  {
    float py = 0.27;
    float PR = 0.058;
    float s = (p.y - py) / PR;
    float inP = 1.0 - smoothstep(0.96, 1.01, abs(s));
    vec3 pc = sf_brass(clamp(s, -1.0, 1.0), t) * (0.8 + 0.3 * sf_fbm3(vec2(p.x * 20.0, p.y * 4.0)));
    // seams every so often and flanges
    float fl = 0.0;
    float bolt = 0.0;
    for (int k = 0; k < 5; k++) {
      float fx = asp * (0.08 + 0.21 * float(k));
      float inFl = sf_box(p, vec2(fx, py), vec2(0.020, PR * 1.20), 0.0012);
      fl = max(fl, inFl);
      for (int b = 0; b < 4; b++) {
        float by = py + PR * (-0.82 + 0.55 * float(b));
        float rr = 1.0 - smoothstep(0.0048, 0.0065, length(p - vec2(fx, by)));
        bolt = max(bolt, rr);
      }
    }
    vec3 flc = sf_brass(clamp(s / 1.20, -1.0, 1.0), t) * 0.78;
    col = mix(col, pc, inP);
    col = mix(col, flc, fl);
    col = mix(col, vec3(0.95, 0.72, 0.40) * 0.8, bolt * 0.9);
    // shadow cast on the wall below the pipe
    float dsh = smoothstep(0.045, 0.0, p.y - (py + PR)) * step(py + PR, p.y) * 0.45;
    col *= 1.0 - dsh * (1.0 - inP);
    // vertical pipes
    for (int v = 0; v < 2; v++) {
      float vx = asp * ((v == 0) ? 0.915 : 0.04);
      float vr = (v == 0) ? 0.046 : 0.034;
      float sv = (p.x - vx) / vr;
      float inV = (1.0 - smoothstep(0.96, 1.01, abs(sv))) * step(py - PR * 0.5, p.y) * (1.0 - smoothstep(SF_FLOOR - 0.001, SF_FLOOR + 0.004, p.y));
      vec3 vc = sf_brass(clamp(sv, -1.0, 1.0), t);
      // the lit side is the left: rotate the shading
      vc = sf_brass(clamp(-0.0 + (sv * 0.8 + 0.0), -1.0, 1.0), t);
      vc *= 0.8 + 0.3 * sf_fbm3(vec2(p.x * 4.0, p.y * 20.0));
      float vfl = 0.0;
      float vb = 0.0;
      for (int k = 0; k < 3; k++) {
        float fy = 0.38 + 0.19 * float(k);
        vfl = max(vfl, sf_box(p, vec2(vx, fy), vec2(vr * 1.22, 0.016), 0.0012));
        for (int b = 0; b < 4; b++) {
          float bx = vx + vr * (-0.85 + 0.57 * float(b));
          vb = max(vb, 1.0 - smoothstep(0.0045, 0.0062, length(p - vec2(bx, fy))));
        }
      }
      col = mix(col, vc, inV);
      col = mix(col, sf_brass(clamp(sv / 1.22, -1.0, 1.0), t) * 0.78, vfl * step(py, p.y) * step(p.y, SF_FLOOR));
      col = mix(col, vec3(0.95, 0.72, 0.40) * 0.8, vb * 0.9 * step(py, p.y));
    }
  }

  // ---- hanging gauges: rod from the main pipe, brass bezel, cream face, needle that trembles
  {
    for (int k = 0; k < 3; k++) {
      float kf = float(k);
      vec2 gc = (k == 0) ? vec2(asp * 0.42, 0.50) : ((k == 1) ? vec2(asp * 0.62, 0.44) : vec2(asp * 0.50, 0.40));
      float gr = (k == 0) ? 0.052 : ((k == 1) ? 0.038 : 0.035);
      float sway = sin(t * 0.7 + kf * 2.0) * 0.004;
      gc.x += sway;
      float rod = sf_seg(p, vec2(gc.x - sway * 0.5, 0.27 + 0.058), vec2(gc.x, gc.y - gr * 1.18), 0.0032);
      col = mix(col, sf_brass(clamp((p.x - gc.x) / 0.0032, -1.0, 1.0), t) * 0.7, rod);
      vec2 d = p - gc;
      float rr = length(d);
      float bezel = 1.0 - smoothstep(gr * 1.15 - 0.0015, gr * 1.15 + 0.0015, rr);
      float face = 1.0 - smoothstep(gr * 0.92 - 0.0015, gr * 0.92 + 0.0015, rr);
      float lightd = dot(normalize(d + 1e-5), normalize(vec2(-0.6, -0.8)));
      vec3 bz = vec3(0.70, 0.44, 0.16) * (0.6 + 0.5 * lightd * smoothstep(gr * 0.9, gr * 1.15, rr));
      col = mix(col, bz, bezel);
      vec3 fc = vec3(0.93, 0.86, 0.68) * (0.85 + 0.15 * smoothstep(gr, 0.0, rr));
      fc *= 0.7 + 0.3 * smoothstep(0.0, 1.0, 0.4 + 0.6 * (1.0 - smoothstep(0.0, gr, rr)));
      // tick marks over 270 degrees, red zone at the end
      float ang = atan(d.y, d.x);
      float a0 = 2.356;                                       // 135 deg = start (lower left)
      float rel = mod(ang - a0 + 6.28318, 6.28318) / 4.712;    // 0..1 along the 270 degree sweep
      float inSweep = step(rel, 1.0);
      float ticks = smoothstep(0.045, 0.0, abs(fract(rel * 10.0 + 0.5) - 0.5)) * smoothstep(gr * 0.62, gr * 0.7, rr) * smoothstep(gr * 0.9, gr * 0.82, rr) * inSweep;
      float redzone = step(0.78, rel) * inSweep * smoothstep(gr * 0.66, gr * 0.72, rr) * smoothstep(gr * 0.78, gr * 0.72, rr);
      fc = mix(fc, vec3(0.70, 0.12, 0.08), redzone * 0.8);
      fc = mix(fc, vec3(0.12, 0.08, 0.06), ticks);
      // needle
      float prox = hasM ? smoothstep(0.7, 0.0, length(mp - gc)) : 0.0;
      float val = 0.50 + 0.28 * sin(t * 0.35 + kf * 1.7) + 0.012 * sin(t * 9.0 + kf * 3.0) + 0.22 * prox;
      float na = a0 + clamp(val, 0.04, 0.98) * 4.712;
      vec2 nd = vec2(cos(na), sin(na));
      float needle = sf_seg(p, gc, gc + nd * gr * 0.74, 0.0016) + sf_seg(p, gc, gc - nd * gr * 0.2, 0.0022);
      fc = mix(fc, vec3(0.75, 0.10, 0.06), clamp(needle, 0.0, 1.0));
      fc = mix(fc, vec3(0.20, 0.14, 0.10), sf_disc(p, gc, gr * 0.09));
      // glass glint
      float gl = smoothstep(gr * 0.45, 0.0, length(d - vec2(-gr * 0.35, -gr * 0.4))) * 0.28;
      fc += vec3(1.0, 0.95, 0.85) * gl;
      col = mix(col, fc, face);
      // contact shadow on the wall
      col *= 1.0 - 0.35 * smoothstep(gr * 1.4, gr * 1.15, length(d - vec2(0.008, 0.012))) * (1.0 - bezel);
    }
  }

  // ---- valves: short stubs with hand wheels (drawn before the steam so steam sits in front)
  vec2 VA = vec2(asp * 0.30, 0.27 - 0.058);            // top of the main pipe, steam goes up
  vec2 VB = vec2(asp * 0.715, 0.27 - 0.058);
  vec2 VC = vec2(asp * 0.915 - 0.046, 0.52);           // side of the vertical pipe, steam goes left
  {
    for (int k = 0; k < 3; k++) {
      vec2 v = (k == 0) ? VA : ((k == 1) ? VB : VC);
      vec2 dr = (k == 2) ? vec2(-1.0, 0.0) : vec2(0.0, -1.0);
      vec2 nd = v + dr * 0.035;
      float stub = sf_seg(p, v - dr * 0.004, nd, 0.012);
      float nozzle = sf_seg(p, nd, nd + dr * 0.012, 0.0165);
      col = mix(col, sf_brass(clamp(dot(p - v, vec2(-dr.y, dr.x)) / 0.012, -1.0, 1.0), t) * 0.85, stub);
      col = mix(col, sf_brass(clamp(dot(p - v, vec2(-dr.y, dr.x)) / 0.0165, -1.0, 1.0), t) * 0.9, nozzle);
      // hand wheel on a stem next to the stub
      vec2 wc = v + vec2(-dr.y, dr.x) * 0.045 + dr * 0.012;
      float wring = sf_ring(p, wc, 0.020, 0.0034);
      float sp1 = sf_seg(p, wc - vec2(0.020, 0.0), wc + vec2(0.020, 0.0), 0.0016);
      float sp2 = sf_seg(p, wc - vec2(0.0, 0.020), wc + vec2(0.0, 0.020), 0.0016);
      float stem = sf_seg(p, v + vec2(-dr.y, dr.x) * 0.012, wc, 0.0035);
      vec3 rc = vec3(0.62, 0.10, 0.07) * (0.7 + 0.5 * flick);
      col = mix(col, rc * 0.6, stem);
      col = mix(col, rc, clamp(wring + sp1 + sp2, 0.0, 1.0));
      col = mix(col, vec3(0.8, 0.55, 0.25), sf_disc(p, wc, 0.0045));
    }
  }

  // ---- steam: three jets; they puff in slow bursts and a lot harder when the pointer is near the valve
  {
    float steam = 0.0;
    for (int k = 0; k < 3; k++) {
      vec2 v = (k == 0) ? VA : ((k == 1) ? VB : VC);
      vec2 dr = (k == 2) ? vec2(-1.0, 0.0) : vec2(0.0, -1.0);
      float nr = hasM ? smoothstep(0.65, 0.05, length(mp - v)) : 0.0;
      float burst = pow(0.5 + 0.5 * sin(t * 0.55 + float(k) * 2.4), 2.0);
      float env = 0.30 + 0.55 * burst + 1.0 * nr;
      steam += sf_jet(p, v + dr * 0.045, dr, t, float(k) + 0.5, env);
    }
    // faint steam hangs near the ceiling so the room feels full of it
    float haze = sf_fbm3(vec2(p.x * 3.0 + t * 0.03, p.y * 2.0 - t * 0.02));
    steam += smoothstep(0.45, 0.8, haze) * smoothstep(0.55, 0.0, p.y) * 0.10;
    float sa = clamp(steam, 0.0, 0.95);
    float lightS = 0.80 + 0.30 * flick / (1.0 + pow(length(p - FC), 2.0) * 3.0);
    vec3 sc = vec3(1.0, 0.98, 0.95) * lightS * 1.1 + vec3(1.0, 0.60, 0.30) * 0.10 * flick / (1.0 + pow(length(p - FC), 2.0) * 6.0);
    col = mix(col, sc, sa);
  }

  // ---- finish: the picture only as a faint trace, soft vignette
  col *= 0.97 + 0.06 * sf_luma(pic);
  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
