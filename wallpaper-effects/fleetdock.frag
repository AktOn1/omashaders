// label: Star fleet dock
// hint: a huge orbital dock seen through a viewport: a capital ship with rows of tiny lights, shuttles with engine glow, scaffolding girders and the limb of a planet; a shuttle slides over toward the pointer
// category: Deep space
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
float fd_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fd_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fd_hash(i), fd_hash(i + vec2(1, 0)), f.x), mix(fd_hash(i + vec2(0, 1)), fd_hash(i + vec2(1, 1)), f.x), f.y);
}
float fd_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * fd_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float fd_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// ---- the capital ship: a long slender lens-shaped hull lying across the viewport (u along it 0..1, stern at 0)
float fd_half(float u) {
  float taper = smoothstep(0.0, 0.07, u) * 0.85 + 0.15;
  return 0.072 * taper * pow(max(1.0 - u, 0.0), 0.55);
}
float fd_top(float u) {
  float g = floor(u * 26.0);
  float bump = 0.007 * floor(fd_hash(vec2(g, 4.0)) * 3.0) * step(0.08, u) * step(u, 0.93);
  float tower = 0.115 * smoothstep(0.215, 0.205, abs(u - 0.215) * 2.0 + 0.1) * step(abs(u - 0.215), 0.032);
  float step2 = 0.034 * step(abs(u - 0.215), 0.07);
  float mast = 0.06 * step(abs(u - 0.215), 0.004);
  return fd_half(u) + bump + max(tower, step2) + mast;
}

// ---- a shuttle: q is the position in its own frame (x forward). returns rgb in xyz, coverage in w; glow is added separately
vec4 fd_shuttle(vec2 q, float t, float sd) {
  vec2 a = vec2(q.x / 0.026, q.y / 0.0095);
  float body = smoothstep(1.0, 0.82, length(a));
  float wing = step(-0.016, q.x) * step(q.x, 0.004) * step(abs(q.y), 0.004 + (0.004 - q.x) * 0.9);
  float fin = step(-0.024, q.x) * step(q.x, -0.010) * step(0.0, q.y) * step(q.y, 0.004 + (q.x + 0.024) * 0.8);
  float cov = max(body, max(wing, fin));
  vec3 col = mix(vec3(0.20, 0.24, 0.32), vec3(0.62, 0.70, 0.82), smoothstep(-0.006, 0.008, q.y));
  col = mix(col, vec3(0.09, 0.11, 0.16), wing * 0.6);
  float cock = smoothstep(0.0045, 0.0025, length(q - vec2(0.014, 0.002)));
  col = mix(col, vec3(0.7, 0.9, 1.0), cock * 0.9);
  float row = step(abs(q.y + 0.0005), 0.0007) * step(abs(q.x + 0.002), 0.011) * step(0.5, fract(q.x * 300.0));
  col = mix(col, vec3(1.0, 0.85, 0.55), row * 0.9);
  float blink = step(0.5, fract(t * 0.9 + sd));
  col = mix(col, mix(vec3(1.0, 0.15, 0.1), vec3(0.2, 1.0, 0.3), step(0.0, q.y)), smoothstep(0.003, 0.0015, length(vec2(q.x + 0.014, abs(q.y) - 0.0085))) * (0.4 + 0.6 * blink));
  return vec4(col, cov);
}
vec2 fd_shuttle_path(float id, float t, vec2 mp, bool hasM, float asp) {
  float span = asp + 0.5;
  vec2 pos;
  if (id < 0.5) {
    pos = vec2(span - mod(t * 0.030 + 0.30, 1.0) * span - 0.25, 0.79 + 0.015 * sin(t * 0.3));
  } else if (id < 1.5) {
    pos = vec2(mod(t * 0.012 + 0.55, 1.0) * span - 0.25, 0.20 + 0.01 * sin(t * 0.2 + 1.0));
  } else {
    float xp = mod(t * 0.016 + 0.1, 1.0) * span - 0.25;
    pos = vec2(xp, 0.60 + 0.02 * sin(t * 0.25));
    if (hasM) {
      float g = smoothstep(0.75, 0.0, abs(xp - mp.x)) ;
      vec2 hover = mp + vec2(-0.075, -0.04);
      pos = mix(pos, hover, g * 0.92);
    }
  }
  return pos;
}

// ---- scaffolding: a lattice girder between a and b; returns (metal, rim-light, work-light)
vec3 fd_truss(vec2 p, vec2 a, vec2 b, float hw, float seedv) {
  vec2 e = b - a;
  float L = length(e);
  vec2 d = e / L;
  vec2 n = vec2(-d.y, d.x);
  vec2 q = p - a;
  float u = dot(q, d);
  float v = dot(q, n);
  if (u < -hw * 0.5 || u > L + hw * 0.5 || abs(v) > hw * 1.3) return vec3(0.0);
  float rt = hw * 0.16;
  float rail = smoothstep(rt, rt * 0.6, abs(abs(v) - hw));
  float cl = hw * 2.4;
  float zig = (abs(fract(u / cl) - 0.5) * 4.0 - 1.0) * hw;
  float br = max(smoothstep(rt * 0.55, rt * 0.3, abs(v - zig)), smoothstep(rt * 0.55, rt * 0.3, abs(v + zig))) * step(abs(v), hw);
  float plate = smoothstep(rt * 1.2, rt * 0.7, abs(fract(u / (cl * 2.0)) - 0.5) * cl * 2.0 - cl + rt) * 0.0;
  float metal = max(rail, br) * step(-hw * 0.2, u) * step(u, L + hw * 0.2);
  float rim = metal * smoothstep(0.0, hw, v) * step(hw * 0.5, abs(v));
  // a work lamp at every fourth node
  float node = u / (cl * 2.0);
  vec2 lc = vec2(node - floor(node + 0.5), v - hw * 1.18) ;
  float lamp = smoothstep(0.012, 0.0, length(vec2(lc.x * cl * 2.0, lc.y))) * step(0.5, fd_hash(vec2(floor(node + 0.5), seedv)));
  return vec3(metal, rim, lamp);
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

  // ---- deep space: navy gradient, our own stars, a whisper of the user's picture
  vec3 col = mix(vec3(0.006, 0.012, 0.040), vec3(0.020, 0.040, 0.100), smoothstep(0.0, 0.9, uv.y));
  col += vec3(0.25, 0.4, 0.7) * fd_luma(w) * 0.16 + w * vec3(0.4, 0.5, 0.8) * 0.06;
  {
    vec2 sp = p * 110.0;
    vec2 sc = floor(sp);
    float hh = fd_hash(sc);
    vec2 sf = fract(sp) - vec2(0.3 + 0.4 * fd_hash(sc + 3.0), 0.3 + 0.4 * fd_hash(sc + 5.0));
    float star = step(0.975, hh) * exp(-dot(sf, sf) * 60.0);
    float tw = 0.7 + 0.3 * sin(t * (0.8 + 2.0 * fd_hash(sc + 9.0)) + hh * 40.0);
    col += mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.8), fd_hash(sc + 1.0)) * star * tw * (0.5 + 0.9 * hh);
  }

  // ---- the planet's limb at the bottom, day side on the left, city lights on the night side
  {
    float R = 1.5;
    vec2 C = vec2(0.58 * asp, 1.0 + R - 0.19);
    vec2 dv = p - C;
    float d = length(dv);
    float over = d - R;
    // atmosphere glow above the limb
    float lit0 = smoothstep(0.55, -0.45, (p.x - 0.5 * asp) / asp * 1.4);
    vec3 atm = mix(vec3(0.10, 0.28, 0.65), vec3(0.35, 0.80, 1.0), lit0);
    col += atm * exp(-max(over, 0.0) / 0.010) * 0.55 * (0.35 + 0.65 * lit0) * step(0.0, over);
    col += atm * exp(-max(over, 0.0) / 0.060) * 0.14 * (0.25 + 0.75 * lit0) * step(0.0, over);
    if (over < 0.0) {
      vec2 n = dv / R;
      float nz = sqrt(max(1.0 - dot(n, n), 0.0));
      vec2 sq = n / (nz * 0.8 + 0.12);
      float land = fd_fbm(sq * vec2(9.0, 4.0) + vec2(3.0, 1.0) + t * 0.002);
      float cloud = fd_fbm(sq * vec2(14.0, 5.0) + vec2(t * 0.012, 11.0));
      vec3 sea = vec3(0.020, 0.10, 0.26);
      vec3 grn = vec3(0.10, 0.30, 0.22);
      vec3 srf = mix(sea, grn, smoothstep(0.52, 0.60, land));
      float cl = smoothstep(0.52, 0.78, cloud);
      float lit = smoothstep(0.28, -0.10, n.x);
      vec3 day = mix(srf, vec3(0.75, 0.85, 0.95), cl * 0.5) * (0.22 + 0.80 * lit);
      vec3 night = srf * 0.12 + vec3(0.02, 0.03, 0.07);
      vec3 sc = mix(night, day, lit);
      // the thin bright rim of air at the very edge
      float rim = pow(1.0 - nz, 2.0);
      sc += atm * rim * (0.35 + 0.8 * lit0) * 0.8;
      // city lights over the dark land
      vec2 cg = floor(sq * vec2(95.0, 38.0));
      float city = step(0.90, fd_hash(cg)) * smoothstep(0.50, 0.62, land) * (1.0 - lit) * (0.5 + 0.5 * sin(t * 0.7 + fd_hash(cg + 4.0) * 30.0));
      sc += vec3(1.0, 0.75, 0.4) * city * 0.65;
      col = sc;
    }
  }

  // ---- dock gantries behind the ship: dim girders holding it in its cradle
  {
    vec3 g1 = fd_truss(p, vec2(0.40 * asp, -0.05), vec2(0.40 * asp, 0.60), 0.016, 5.0);
    vec3 g2 = fd_truss(p, vec2(0.66 * asp, -0.05), vec2(0.66 * asp, 0.60), 0.016, 6.0);
    float gm = max(g1.x, g2.x);
    float gl = max(g1.z, g2.z);
    col = mix(col, vec3(0.045, 0.065, 0.11) + vec3(0.12, 0.17, 0.26) * max(g1.y, g2.y), gm * 0.85);
    col += vec3(0.5, 0.8, 1.0) * gl * 0.8;
  }

  // ---- the capital ship, lying slightly tilted across the middle of the viewport
  {
    float ang = -0.045;
    float ca = cos(ang), sa = sin(ang);
    vec2 O = vec2(0.115 * asp, 0.40);
    float L = 0.80 * asp;
    vec2 pq = p - O;
    vec2 s = vec2(pq.x * ca + pq.y * sa, -pq.x * sa + pq.y * ca);
    float u = s.x / L;
    float v = -s.y;                // up is positive
    float ht = fd_top(clamp(u, 0.0, 1.0));
    float hb = -fd_half(clamp(u, 0.0, 1.0)) * 0.85;
    // engine glow first (behind the stern)
    float engv = 0.0;
    {
      float ex = (s.x + 0.012);
      float ey = abs(abs(v) - 0.022);
      float en = exp(-ex * ex * 2000.0) * exp(-ey * ey * 6500.0);
      engv = en;
      float plume = exp(-max(-ex, 0.0) / 0.20) * exp(-ey * ey / 0.0007) * step(ex, 0.0) * 0.55;
      col += vec3(0.35, 0.65, 1.0) * (en * 1.6 + plume * 0.5);
      col += vec3(0.7, 0.9, 1.0) * en * 0.6;
    }
    if (u > 0.0 && u < 1.0 && v < ht && v > hb) {
      float tv = (v - hb) / (ht - hb);
      vec3 steel = mix(vec3(0.060, 0.080, 0.125), vec3(0.34, 0.42, 0.56), pow(tv, 1.5));
      float seam = smoothstep(0.012, 0.0, abs(fract(u * 70.0) - 0.5) - 0.485);
      float band1 = smoothstep(0.004, 0.0, abs(tv - 0.58)) + smoothstep(0.004, 0.0, abs(tv - 0.30));
      steel *= 1.0 - 0.45 * seam - 0.4 * band1;
      steel *= 0.85 + 0.30 * fd_noise(vec2(u * 400.0, v * 220.0));
      // sunlit top edge
      float topLit = smoothstep(0.045, 0.0, ht - v) * 0.55;
      steel += vec3(0.50, 0.65, 0.95) * topLit * (0.4 + 0.6 * smoothstep(0.0, 0.7, u));
      // rows of tiny lights: warm windows and a cooler row
      float rowA = 0.0;
      for (int r = 0; r < 4; r++) {
        float rv = 0.16 + float(r) * 0.12;
        float cell = floor(u * (260.0 + 20.0 * float(r)));
        float cu = fract(u * (260.0 + 20.0 * float(r))) - 0.5;
        float cv = (tv - rv) * (ht - hb) / 0.0030;
        float on = step(0.42, fd_hash(vec2(cell, float(r) + 2.0)));
        float dot_ = exp(-(cu * cu * 6.0 + cv * cv * 1.6));
        vec3 wc = (r == 1) ? vec3(0.55, 0.88, 1.0) : vec3(1.0, 0.82, 0.52);
        steel += wc * on * dot_ * 0.95 * step(0.06, u);
      }
      // the bridge tower's lit strip
      float tw = step(abs(u - 0.215), 0.032) * smoothstep(0.012, 0.0, abs(v - 0.138)) ;
      steel += vec3(1.0, 0.9, 0.7) * tw * 0.7;
      // glowing hangar mouth at the middle of the hull
      float hang = step(abs(u - 0.58), 0.045) * smoothstep(0.014, 0.004, abs(v + 0.012 - 0.0)) ;
      steel += vec3(0.4, 0.8, 1.0) * hang * (0.5 + 0.1 * sin(t * 2.0));
      // stern engine nozzles
      float nz1 = smoothstep(0.012, 0.004, length(vec2(s.x - 0.002, abs(v) - 0.022)) ) * step(u, 0.02);
      steel = mix(steel, vec3(0.8, 0.9, 1.0), nz1);
      float edge = smoothstep(0.0, 0.0022, min(ht - v, v - hb));
      steel *= 0.55 + 0.45 * edge;
      col = steel;
    }
    // running lights: red on the mast, green at the bow, a white strobe aft
    float strobe = step(0.9, fract(t * 0.5));
    vec2 mastp = vec2(0.215 * L, -(fd_top(0.215)));
    float lm = exp(-dot(s - mastp, s - mastp) * 90000.0);
    col += vec3(1.0, 0.15, 0.10) * lm * (0.5 + 0.5 * step(0.5, fract(t * 0.7))) * 1.5;
    vec2 bowp = vec2(0.965 * L, 0.0);
    col += vec3(0.2, 1.0, 0.4) * exp(-dot(s - bowp, s - bowp) * 90000.0) * 0.9;
    vec2 aftp = vec2(0.05 * L, -(fd_half(0.05)) + 0.0);
    col += vec3(1.0) * exp(-dot(s - aftp, s - aftp) * 120000.0) * (0.2 + 0.8 * strobe);
  }

  // ---- shuttles with engine glow; the third one slides toward the pointer
  for (int i = 0; i < 3; i++) {
    float id = float(i);
    vec2 pos = fd_shuttle_path(id, t, mp, hasM, asp);
    vec2 prev = fd_shuttle_path(id, t - 0.4, mp, hasM, asp);
    vec2 dir = pos - prev;
    float dl = length(dir);
    dir = dl > 1e-5 ? dir / dl : vec2(1.0, 0.0);
    // mirror so the shuttle always faces where it is going, keep it level-ish
    float sc = (i == 1) ? 0.8 : ((i == 0) ? 1.7 : 1.35);
    vec2 rel = p - pos;
    vec2 qd = vec2(dot(rel, dir), dot(rel, vec2(-dir.y, dir.x)));
    vec2 q = qd / sc;
    // keep the sprite upright: flip the vertical axis so "up" is always up on screen
    if (dir.x < 0.0) { q.x = -q.x; q.y = -q.y; }
    vec2 qs = vec2(dot(rel, dir), dot(rel, vec2(-dir.y, dir.x)));
    float glowx = -qs.x / sc;
    float eng = exp(-max(glowx - 0.02, 0.0) / 0.05) * exp(-pow(qs.y / sc / 0.004, 2.0)) * step(0.02, glowx) * smoothstep(0.34, 0.0, glowx);
    float halo = exp(-dot(qs - vec2(-0.027 * sc, 0.0), qs - vec2(-0.027 * sc, 0.0)) / (0.0004 * sc * sc));
    col += vec3(0.45, 0.75, 1.0) * (eng * 1.0 + halo * 0.6);
    vec4 sh = fd_shuttle(q, t, id * 1.7);
    col = mix(col, sh.rgb, sh.a);
  }

  // ---- scaffolding in the foreground: dark lattice girders with work lamps
  {
    vec3 t1 = fd_truss(p, vec2(-0.1, 1.06), vec2(0.50 * asp, 0.74), 0.034, 1.0);
    vec3 t2 = fd_truss(p, vec2(0.925 * asp, 1.1), vec2(0.925 * asp, 0.22), 0.026, 2.0);
    vec3 t3 = fd_truss(p, vec2(-0.1, 0.30), vec2(0.20 * asp, -0.1), 0.020, 3.0);
    vec3 t4 = fd_truss(p, vec2(0.925 * asp - 0.30, 0.50), vec2(0.925 * asp, 0.46), 0.016, 4.0);
    float metal = max(max(t1.x, t2.x), max(t3.x, t4.x));
    float rim = max(max(t1.y, t2.y), max(t3.y, t4.y));
    float lamp = max(max(t1.z, t2.z), max(t3.z, t4.z));
    vec3 mcol = vec3(0.020, 0.028, 0.050) + vec3(0.30, 0.40, 0.55) * rim * 0.9;
    col = mix(col, mcol, metal * 0.96);
    col += vec3(1.0, 0.78, 0.45) * lamp * 0.9;
    // glow of the work lamps on nearby metal and space
    col += vec3(1.0, 0.7, 0.4) * lamp * 0.0;
  }

  // ---- the viewport frame: a dark bevel with a thin steel edge and a faint glass sheen
  {
    float e = min(min(uv.x * asp, (1.0 - uv.x) * asp), min(uv.y, 1.0 - uv.y));
    float bez = smoothstep(0.020, 0.017, e);
    float edge = smoothstep(0.0025, 0.0, abs(e - 0.0185));
    col = mix(col, vec3(0.012, 0.016, 0.028), bez * 0.95);
    col += vec3(0.30, 0.40, 0.55) * edge * 0.45;
    col += vec3(0.5, 0.65, 1.0) * 0.035 * smoothstep(0.03, 0.0, abs(uv.x * asp * 0.7 + uv.y - 0.55 - 0.0)) * 0.0;
    col += vec3(0.5, 0.65, 1.0) * 0.018 * smoothstep(0.05, 0.0, abs((p.x * 0.8 + p.y * 0.5) - 1.15));
  }
  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
