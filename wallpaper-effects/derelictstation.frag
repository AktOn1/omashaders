// label: Derelict station
// hint: a dark broken station corridor ends in a big frosted viewport with a dead ship and slow debris beyond it, loose cables sway, an amber warning light pulses on the wall and brightens when the pointer comes near
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
float ds_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ds_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ds_hash(i), ds_hash(i + vec2(1, 0)), f.x), mix(ds_hash(i + vec2(0, 1)), ds_hash(i + vec2(1, 1)), f.x), f.y);
}
float ds_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ds_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ds_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * ds_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ds_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float ds_box(vec2 q, vec2 h) {
  vec2 d = abs(q) - h;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float ds_rbox(vec2 q, vec2 h, float r) { return ds_box(q, h - r) - r; }
vec2 ds_rot(vec2 q, float a) { float c = cos(a), s = sin(a); return vec2(c * q.x - s * q.y, s * q.x + c * q.y); }

// the dead ship (local coordinates, nose to the right)
float ds_ship(vec2 s) {
  float hull = ds_box(s - vec2(-0.02, 0.0), vec2(0.115, 0.017));
  float nose = (length((s - vec2(0.095, 0.0)) / vec2(0.05, 0.017)) - 1.0) * 0.017;
  float eng = ds_box(s - vec2(-0.155, 0.0), vec2(0.028, 0.026));
  float noz = ds_box(vec2(s.x + 0.19, abs(s.y) - 0.014), vec2(0.010, 0.007));
  float bridge = ds_box(s - vec2(0.03, -0.027), vec2(0.035, 0.012));
  float mast = ds_box(s - vec2(0.065, -0.050), vec2(0.0012, 0.024));
  float panel = ds_box(ds_rot(s - vec2(-0.07, 0.05), 0.12), vec2(0.030, 0.0025));
  float strut = ds_box(s - vec2(-0.07, 0.032), vec2(0.0015, 0.018));
  float d = min(min(min(hull, nose), min(eng, noz)), min(min(bridge, mast), min(panel, strut)));
  d = max(d, -ds_box(ds_rot(s - vec2(-0.075, 0.012), 0.55), vec2(0.007, 0.022)));   // the gash in the hull
  return d;
}

const float DS_PI = 3.14159265;

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);
  float pl = ds_luma(pic);

  vec2 q = vec2(p.x - asp * 0.5, uv.y - 0.5);
  vec2 hw = vec2(0.58, 0.32);                           // the end wall of the corridor
  float rx = abs(q.x) / hw.x, ry = abs(q.y) / hw.y;
  float r = max(rx, ry);

  // the amber warning light on the left wall
  vec2 lp = vec2(asp * 0.5 - 0.775, 0.45);
  float pulse = 0.5 + 0.5 * sin(t * 1.55);
  pulse = 0.16 + 0.84 * pulse * pulse;
  float nearM = onScr ? exp(-dot(mp - lp, mp - lp) / 0.075) : 0.0;
  float lampI = pulse * (1.0 + 1.5 * nearM) + 0.30 * nearM;
  vec3 amber = vec3(1.0, 0.55, 0.12);
  vec2 lq = p - lp;
  float spillW = exp(-dot(lq * vec2(0.8, 1.1), lq * vec2(0.8, 1.1)) / 0.20);   // how far the amber reaches over the walls

  vec3 col = vec3(0.0);
  vec3 cool = vec3(0.45, 0.62, 0.85);

  if (r >= 1.0) {
    // ---------- the corridor: walls, ceiling, floor in one-point perspective
    float z = 1.0 / r;
    bool sideWall = rx >= ry;
    float w1 = sideWall ? (q.y / hw.y) / rx : (q.x / hw.x) / ry;               // across the surface, -1..1
    float u = z * 8.0;
    float fu = fract(u);
    float seam = smoothstep(0.07, 0.0, min(fu, 1.0 - fu));
    float cell = floor(u);
    float grime = ds_fbm(vec2(z * 5.0 + (sideWall ? 3.0 : 9.0), w1 * 2.2 + cell * 1.7));
    float sgn = sideWall ? sign(q.x) : sign(q.y);
    vec3 base = vec3(0.060, 0.070, 0.085) * (0.65 + 0.7 * grime);
    base *= 1.0 - 0.55 * seam;
    // panel variety: some panels darker, a few scorched
    float pv = ds_hash(vec2(cell, sgn + (sideWall ? 0.0 : 5.0)));
    base *= 0.75 + 0.5 * pv;
    // long horizontal seams
    float hs = smoothstep(0.03, 0.0, abs(abs(w1) - 0.55)) + smoothstep(0.025, 0.0, abs(w1));
    base *= 1.0 - 0.45 * hs;
    // a conduit pipe along the upper wall and one along the floor
    float pipeS = (w1 * (sideWall ? 1.0 : 1.0) - (sideWall ? -0.80 : -0.80 * sgn)) / 0.07;
    if (sideWall) pipeS = (w1 + 0.80) / 0.07;
    float pipe = smoothstep(1.0, 0.85, abs(pipeS));
    float pipeShade = sqrt(max(1.0 - pipeS * pipeS, 0.0));
    base = mix(base, vec3(0.10, 0.11, 0.13) * (0.4 + 0.9 * pipeShade * pipeShade), pipe * 0.9);
    // floor grating
    if (!sideWall && q.y > 0.0) {
      float gx = abs(fract(w1 * 9.0) - 0.5), gz = abs(fract(u * 3.0) - 0.5);
      base *= 0.55 + 0.7 * smoothstep(0.30, 0.38, max(gx, gz) * 0.0 + min(gx, gz) + 0.18);
      base += vec3(0.02, 0.03, 0.04) * smoothstep(0.42, 0.5, gz);
    }
    // hazard stripe along the foot of both walls (faded)
    if (sideWall) {
      float hz = smoothstep(0.88, 0.9, w1) * smoothstep(1.0, 0.96, w1);
      float stripe = step(0.5, fract((z * 8.0 + w1 * 8.0) * 0.5));
      base = mix(base, mix(vec3(0.025, 0.025, 0.02), vec3(0.20, 0.15, 0.04), stripe), hz * 0.8);
    }
    // light: cold glow from the window at the far end, dying quickly toward the viewer
    float fall = pow(smoothstep(0.52, 1.0, z), 1.8);
    float centre = exp(-w1 * w1 * 0.7);
    vec3 lit = base * (0.12 + 3.2 * fall * (0.4 + 0.6 * centre)) * cool;
    // the dead ceiling lights; one is flickering rarely
    if (!sideWall && q.y < 0.0) {
      float lamp = smoothstep(0.30, 0.2, abs(w1)) * step(0.35, fu) * step(fu, 0.65);
      float fl = 0.0;
      if (cell == 3.0) { float ph = fract(t / 9.0); fl = step(ph, 0.09) * (0.4 + 0.6 * step(0.5, fract(t * 17.0))) * 0.5; }
      lit = mix(lit, vec3(0.10, 0.11, 0.12) + vec3(0.8, 0.9, 1.0) * fl, lamp * 0.9);
    }
    // amber spill
    lit += base * amber * spillW * lampI * 13.0 * (0.45 + 0.55 * smoothstep(0.5, 1.0, z));
    col = lit;
    // a ring of glow in the air near the far window
    col += cool * 0.012 * pow(fall, 1.5);
  } else {
    // ---------- the end wall: bezel, glass, space
    vec2 gh = vec2(0.50, 0.245);
    float dg = ds_rbox(q, gh, 0.035);
    // the wall plate around the window
    float seamX = smoothstep(0.004, 0.0, abs(fract(q.x * 4.3 + 0.2) - 0.5) - 0.495) * 0.0;
    float plate = ds_fbm3(vec2(q.x * 9.0, q.y * 9.0));
    vec3 wallC = vec3(0.050, 0.058, 0.072) * (0.7 + 0.6 * plate);
    wallC *= 0.65 + 0.5 * smoothstep(0.0, 0.3, abs(q.y) - 0.2);
    float pseam = smoothstep(0.003, 0.0, abs(abs(q.x) - 0.56)) + smoothstep(0.003, 0.0, abs(abs(q.y) - 0.30));
    wallC *= 1.0 - 0.6 * pseam;
    vec3 outc = wallC * (1.2 + 0.0) * cool * 1.6;
    // the bezel: bevelled frame
    float bz = smoothstep(0.065, 0.0, dg);
    float bev = smoothstep(0.0, 0.065, dg);
    vec3 frameC = vec3(0.12, 0.13, 0.15) * (0.55 + 0.7 * (1.0 - bev)) * (0.7 + 0.5 * ds_noise(q * 60.0));
    frameC += cool * 0.04 * (1.0 - bev) * step(0.0, -q.y + 0.1);
    // bolts
    bool horiz = (abs(q.y) - gh.y) > (abs(q.x) - gh.x);
    vec2 bc = horiz ? vec2((floor(q.x / 0.07) + 0.5) * 0.07, sign(q.y) * (gh.y + 0.032)) : vec2(sign(q.x) * (gh.x + 0.032), (floor(q.y / 0.07) + 0.5) * 0.07);
    float bolt = smoothstep(0.0075, 0.005, length(q - bc));
    frameC = mix(frameC, vec3(0.20, 0.21, 0.23) * (0.8 + 0.4 * dot(normalize(q - bc + 0.0001), vec2(-0.7, -0.7))), bolt * 0.85);
    vec3 cc = mix(outc, frameC, bz * step(0.0, dg) * 0.0 + smoothstep(0.065, 0.058, dg) * step(0.0, dg));
    cc = mix(outc, frameC, smoothstep(0.066, 0.058, dg) * smoothstep(-0.002, 0.002, dg));
    col = cc;

    if (dg < 0.002) {
      // ---- space beyond the glass
      vec2 gq = q;
      vec3 sp = mix(vec3(0.005, 0.006, 0.016), vec3(0.012, 0.016, 0.034), smoothstep(-0.3, 0.3, gq.y));
      sp += mix(vec3(pl), pic, 0.5) * 0.42;                                         // the picture's own sky shows through
      // a far cold sun low in the upper right lights everything from that side
      vec2 sunq = gq - vec2(0.40, -0.20);
      sp += vec3(0.55, 0.70, 1.0) * exp(-dot(sunq, sunq) / 0.0035) * 0.55 + vec3(0.30, 0.42, 0.65) * exp(-dot(sunq, sunq) / 0.07) * 0.22;
      vec2 sq = gq * 120.0 + 31.0;
      vec2 sid = floor(sq);
      float sh = ds_hash(sid);
      vec2 jc = vec2(ds_hash(sid + 3.1), ds_hash(sid + 8.7));
      float star = smoothstep(0.93, 1.0, sh) * exp(-dot(fract(sq) - jc, fract(sq) - jc) * 80.0);
      sp += vec3(0.9, 0.93, 1.0) * star * 0.8 * (0.5 + 0.5 * sin(t * (0.3 + sh) + sh * 40.0));

      // the dead ship, tumbling very slowly
      vec2 sPos = vec2(0.12 + 0.015 * sin(t * 0.03), -0.015 + 0.01 * sin(t * 0.021));
      float sAng = 0.38 + 0.12 * sin(t * 0.045) + t * 0.0;
      vec2 sl = ds_rot(gq - sPos, -sAng) * 1.0;
      float sd = ds_ship(sl);
      if (sd < 0.03) {
        float body = smoothstep(0.0012, -0.0006, sd);
        vec2 ldir = ds_rot(vec2(0.8, -0.6), -sAng) * 0.0035;
        float rim = body * smoothstep(-0.0002, 0.0014, ds_ship(sl + ldir));
        vec3 hullC = vec3(0.020, 0.026, 0.036) * (0.7 + 0.6 * ds_noise(sl * 160.0));
        hullC += vec3(0.007, 0.009, 0.014) * smoothstep(0.02, -0.02, sl.y);
        hullC += vec3(0.55, 0.72, 1.0) * rim * 0.65;
        // dead portholes and one dying amber lamp
        float port = 0.0;
        for (int k = 0; k < 4; k++) {
          vec2 pc = vec2(0.075 - float(k) * 0.036, 0.0);
          port += smoothstep(0.0035, 0.002, length(sl - pc));
        }
        hullC = mix(hullC, vec3(0.006, 0.008, 0.012), clamp(port, 0.0, 1.0) * body);
        float dying = smoothstep(0.78, 1.0, sin(t * 0.9 + 1.0)) * 0.9 + 0.08;
        hullC += amber * smoothstep(0.0034, 0.0, length(sl - vec2(0.03, -0.040))) * dying * 0.9;
        sp = mix(sp, hullC, body);
        sp += amber * exp(-dot(sl - vec2(0.03, -0.040), sl - vec2(0.03, -0.040)) / 0.0006) * dying * 0.08;
      }
      // slow drifting debris, tumbling shards that catch the far sun now and then
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float h1 = ds_hash(vec2(fi, 1.0)), h2 = ds_hash(vec2(fi, 2.0)), h3 = ds_hash(vec2(fi, 3.0)), h4 = ds_hash(vec2(fi, 4.0));
        vec2 vel = vec2(-0.004 - 0.010 * h3, 0.0015 * (h4 - 0.5) + 0.0016) * (0.6 + 0.8 * h2);
        vec2 span = vec2(1.5, 0.8);
        vec2 dp = vec2(h1 * span.x, h2 * span.y) + vel * t;
        dp = mod(dp, span) - span * 0.5;
        float sz = 0.005 + 0.016 * h3 * h3;
        float ang = t * (0.05 + 0.20 * h4) * (h1 > 0.5 ? 1.0 : -1.0) + fi * 2.3;
        vec2 dq = ds_rot(gq - dp, ang);
        float dd = ds_box(dq, vec2(sz, sz * (0.25 + 0.6 * h2)));
        if (dd < 0.004) {
          float bm = smoothstep(0.0007, -0.0003, dd);
          float glint = pow(0.5 + 0.5 * sin(ang * 2.0 + fi), 6.0);
          vec3 dc = vec3(0.045, 0.052, 0.068) + vec3(0.60, 0.74, 1.0) * glint * 0.65;
          sp = mix(sp, dc, bm);
        }
      }
      // frost creeping in from the edges of the glass: crystalline ridges and a milky haze
      float inner = -dg;
      float fr = 0.0;
      if (inner < 0.16) {
        float n1 = ds_fbm(q * 14.0);
        float edgeW = 0.045 + 0.075 * ds_fbm3(q * 4.0 + 5.0);
        float body = smoothstep(edgeW + 0.02 * (n1 - 0.5), 0.0, inner);
        float ridge = pow(1.0 - abs(2.0 * ds_noise(q * 70.0 + n1 * 3.0) - 1.0), 5.0);
        float ridge2 = pow(1.0 - abs(2.0 * ds_noise(q * 150.0 + 7.0) - 1.0), 6.0);
        fr = body * (0.38 + 0.42 * ridge + 0.28 * ridge2) + smoothstep(0.012, 0.0, inner) * 0.4;
        fr *= 0.75 + 0.25 * n1;
        vec3 frost = vec3(0.64, 0.78, 0.90) * (0.30 + 0.55 * ds_noise(q * 40.0)) + cool * 0.08;
        sp = mix(sp, frost, clamp(fr, 0.0, 0.82));
        // the corners and the lower edge frost over more thickly
        sp += cool * 0.05 * body * smoothstep(0.0, 0.2, q.y + 0.1);
      }
      // glass sheen
      float sheen = smoothstep(0.05, 0.0, abs(q.x * 0.6 + q.y - 0.12)) * 0.05 + smoothstep(0.03, 0.0, abs(q.x * 0.6 + q.y + 0.22)) * 0.03;
      sp += cool * sheen;
      col = mix(col, sp, smoothstep(0.002, -0.002, dg));
      // a thin glass edge highlight
      col += cool * 0.05 * smoothstep(0.012, 0.0, abs(dg + 0.008));
    }
    // dim cool light on the end wall, and the amber spill creeping across
    col += wallC * amber * spillW * lampI * 6.0 * 0.5 * step(0.0, dg);
  }

  // ---------- the amber warning light itself
  {
    vec2 d1 = (p - lp) / vec2(0.030, 0.044);
    float dome = smoothstep(1.0, 0.85, length(d1)) * step(-0.4, -(p.x - lp.x) / 0.03 + 1.0);
    vec3 lampC = mix(vec3(0.20, 0.07, 0.02), amber * 1.6, clamp(lampI * 0.7, 0.0, 1.0));
    float cage = smoothstep(0.03, 0.0, abs(fract(d1.y * 1.6) - 0.5) - 0.44) * 0.35;
    col = mix(col, lampC * (1.0 - cage), dome);
    float glow = exp(-dot(lq, lq) / 0.0012) * 0.8 + exp(-dot(lq, lq) / 0.020) * 0.30;
    col += amber * glow * lampI * 0.55;
    // a soft sweep of the beacon cone, over the floor and the far wall
    float cone = exp(-pow((p.y - lp.y - (p.x - lp.x) * 0.10) / (0.04 + (p.x - lp.x) * 0.20), 2.0)) * smoothstep(0.0, 0.2, p.x - lp.x) * exp(-(p.x - lp.x) * 1.3);
    col += amber * cone * lampI * 0.06 * (0.5 + 0.5 * pulse);
  }

  // ---------- loose cables from the ceiling, swaying slowly in the still air
  {
    float cab = 0.0;
    float amberOnCab = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float cx = asp * (0.20 + 0.33 * fi) + 0.04 * ds_hash(vec2(fi, 8.0));
      float len = 0.17 + 0.13 * ds_hash(vec2(fi, 4.0));
      float y = p.y;
      float sway = (0.012 + 0.010 * fi) * sin(t * 0.55 + fi * 2.0 + y * 6.0) * smoothstep(0.0, len, y) + 0.006 * sin(t * 0.31 + fi);
      float dx = abs(p.x - (cx + sway));
      float w = 0.0022 + 0.0006 * fi;
      float line = smoothstep(w, w * 0.4, dx) * step(y, len) * step(0.0, y);
      float tip = smoothstep(0.009, 0.005, length(vec2(p.x - (cx + sway * 1.0), y - len)));
      cab = max(cab, max(line, tip));
    }
    // a looser cable hangs across in a slack curve
    {
      float xa = asp * 0.62, xb = asp * 0.88;
      float xm = (xa + xb) * 0.5;
      float tt = clamp((p.x - xa) / (xb - xa), 0.0, 1.0);
      float sag = 0.10 + 0.012 * sin(t * 0.45);
      float cy = 0.02 + sag * 4.0 * tt * (1.0 - tt) + 0.003 * sin(tt * 18.0 + t * 0.7);
      float dy = abs(p.y - cy);
      cab = max(cab, smoothstep(0.0028, 0.001, dy) * step(xa, p.x) * step(p.x, xb));
    }
    vec3 cabC = vec3(0.012, 0.014, 0.018) + amber * spillW * lampI * 0.10 + cool * 0.02;
    col = mix(col, cabC, cab * 0.95);
  }

  // ---------- zero-g dust drifting in the dim air
  {
    vec2 dq2 = p * 55.0 + vec2(t * 0.15, -t * 0.08);
    vec2 did = floor(dq2);
    float dh = ds_hash(did);
    vec2 dj = vec2(ds_hash(did + 4.0), ds_hash(did + 9.0));
    float mote = step(0.965, dh) * exp(-dot(fract(dq2) - dj, fract(dq2) - dj) * 160.0);
    col += (amber * spillW * lampI * 0.6 + cool * 0.08) * mote * 0.8;
  }

  // vignette and a touch of grain-free depth
  col *= 1.0 - 0.55 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
  col = col / (1.0 + col * 0.25);
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
