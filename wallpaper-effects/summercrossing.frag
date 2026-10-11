// label: Summer crossing
// hint: a summer afternoon at a railway crossing, red lights blinking, the barrier lowering, a slow train passing as a silhouette with lit windows under huge white clouds; the clouds drift toward the pointer
// category: Anime and play
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
float sc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sc_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sc_hash(i), sc_hash(i + vec2(1, 0)), f.x), mix(sc_hash(i + vec2(0, 1)), sc_hash(i + vec2(1, 1)), f.x), f.y);
}
float sc_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * sc_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sc_fbm4(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sc_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float SC_HZ = 0.655;   // hill line
const float SC_RAIL = 0.835; // rail top

// hill ridges (y of the ridge line at x), mid hills are nearer than far hills
float sc_farRidge(float x) { return SC_HZ - 0.040 - 0.032 * sin(x * 2.1 + 1.0) - 0.016 * sin(x * 5.3 + 2.0); }
float sc_midRidge(float x) { return SC_HZ + 0.020 - 0.036 * sin(x * 1.3 + 3.0) - 0.016 * sin(x * 4.1 + 0.5) - 0.008 * sin(x * 9.0); }

// huge cumulus, painted back to front out of round puffs with a lit side toward the sun (up left) and a blue shade; returns colour and alpha
vec4 sc_cumulus(vec2 p, float asp, vec2 pm, bool hasM, float t) {
  vec3 cWhite = vec3(1.0, 0.985, 0.94);
  vec3 cShade = vec3(0.62, 0.74, 0.96);
  vec3 cDeep = vec3(0.45, 0.55, 0.88);
  vec2 toSun = normalize(vec2(-0.50, -0.85));
  vec3 acc = vec3(0.0);
  float alpha = 0.0;
  float span = asp + 1.5;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float cx = mod(((fi + 0.15 + 0.7 * sc_hash(vec2(fi, 1.0))) / 5.0) * span + t * (0.006 + 0.006 * sc_hash(vec2(fi, 2.0))), span) - 0.75;
    if (hasM) cx += (pm.x - cx) * 0.34 * exp(-(pm.x - cx) * (pm.x - cx) / 1.0);   // the clouds drift toward the pointer
    float base = 0.675 + 0.020 * sc_hash(vec2(fi, 3.0));
    float S = 1.10 + 0.90 * sc_hash(vec2(fi, 4.0));
    float lift = hasM ? (pm.y - 0.35) * 0.06 : 0.0;
    if (abs(p.x - cx) > 0.50 * S + 0.12) continue;
    for (int k = 7; k >= 0; k--) {
      float fk = float(k);
      float h = sc_hash(vec2(fi * 9.0 + fk, 6.0));
      float ox, r, cy;
      if (k < 5) {
        float hump = 1.0 - abs(fk - 2.0) / 3.2;
        ox = (fk - 2.0) * 0.118 * S + (h - 0.5) * 0.04;
        r = S * (0.060 + 0.090 * hump * (0.75 + 0.5 * h));
        cy = base - r * 0.80;
      } else {
        ox = (fk - 6.0) * 0.095 * S + (h - 0.5) * 0.03;
        r = S * (0.052 + 0.050 * h);
        cy = base - S * (0.17 + 0.05 * h) - r * 0.15;
      }
      vec2 d = (p - vec2(cx + ox, cy - lift)) / r;
      float dl = length(d);
      if (dl > 1.03) continue;
      float a = smoothstep(1.0, 0.965, dl) * step(p.y, base);
      float L = 0.5 + 0.5 * dot(d / max(dl, 0.001), toSun) * (0.55 + 0.45 * dl);
      L -= 0.38 * smoothstep(base - 0.20 * S, base, p.y);
      vec3 cc = mix(cDeep, cShade, smoothstep(0.08, 0.34, L));
      cc = mix(cc, cWhite, smoothstep(0.44, 0.62, L));
      acc = mix(acc, cc, a);
      alpha = max(alpha, a);
    }
  }
  return vec4(acc, alpha);
}

// distance to a segment, plus position h along it (0..1)
vec2 sc_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}

// one crossing signal: post, cross sign, two red lamps, and the barrier arm; returns the colour over c, alpha in .a via the out value
vec4 sc_signal(vec2 p, float xp, float dir, float lights, float blink, float angle, float armLen, float t) {
  vec4 o = vec4(0.0);
  float topY = 0.395;
  // post: yellow and black stripes
  float dxp = p.x - xp;
  if (abs(dxp) < 0.0062 && p.y > topY && p.y < 0.945) {
    float stripe = step(0.5, fract(p.y * 24.0));
    vec3 pc = mix(vec3(0.10, 0.10, 0.13), vec3(0.98, 0.80, 0.12), stripe);
    pc *= 0.78 + 0.22 * smoothstep(0.006, -0.006, dxp);
    o = vec4(pc, 1.0);
  }
  // cross sign
  vec2 cd = p - vec2(xp, 0.452);
  float al1 = (cd.x + cd.y) * 0.7071, ac1 = (cd.x - cd.y) * 0.7071;
  float al2 = (cd.x - cd.y) * 0.7071, ac2 = (cd.x + cd.y) * 0.7071;
  float b1 = step(abs(al1), 0.068) * step(abs(ac1), 0.0135);
  float b2 = step(abs(al2), 0.068) * step(abs(ac2), 0.0135);
  float edge = max(b1, b2);
  float inner = max(step(abs(al1), 0.062) * step(abs(ac1), 0.0085), step(abs(al2), 0.062) * step(abs(ac2), 0.0085));
  if (edge > 0.5) o = vec4(mix(vec3(0.78, 0.07, 0.08), vec3(0.98, 0.97, 0.93), inner), 1.0);
  // lamp board
  vec2 bd = p - vec2(xp, 0.56);
  float board = step(abs(bd.x), 0.050) * step(abs(bd.y), 0.026);
  if (board > 0.5) o = vec4(0.07, 0.07, 0.09, 1.0);
  // two lamps, alternate blinking
  float glowSum = 0.0;
  for (int k = 0; k < 2; k++) {
    float side = k == 0 ? -1.0 : 1.0;
    float on = lights * (k == 0 ? blink : 1.0 - blink);
    vec2 ld = p - vec2(xp + side * 0.025, 0.56);
    float r = length(ld);
    float lamp = smoothstep(0.0165, 0.0145, r);
    vec3 lc = mix(vec3(0.30, 0.04, 0.05), vec3(1.0, 0.20, 0.13), on);
    lc += vec3(1.0, 0.75, 0.6) * smoothstep(0.008, 0.0, r) * on;
    if (lamp > 0.0) o = vec4(mix(o.rgb, lc, lamp), 1.0);
    glowSum += on * (exp(-r * r / 0.0011) * 0.85 + exp(-r * r / 0.012) * 0.25);
  }
  // barrier arm: yellow and black, red reflector at the tip, hinged low on the post
  vec2 piv = vec2(xp + dir * 0.012, 0.802);
  vec2 ad = vec2(cos(angle) * dir, -sin(angle));
  vec2 tip = piv + ad * armLen;
  vec2 sg = sc_seg(p, piv, tip);
  float aw = 0.0085;
  if (sg.x < aw) {
    float stripe = step(0.5, fract(sg.y * armLen * 22.0));
    vec3 ac = mix(vec3(0.10, 0.10, 0.13), vec3(0.98, 0.80, 0.12), stripe);
    float side = ad.x * (p.y - piv.y) - ad.y * (p.x - piv.x);
    ac *= 0.80 + 0.20 * smoothstep(-aw, aw, side * dir);
    // reflector band at the tip (red)
    float rb = smoothstep(0.88, 0.90, sg.y);
    ac = mix(ac, vec3(0.90, 0.10, 0.10) * (0.8 + 0.4 * lights * blink), rb);
    float a = smoothstep(aw, aw - 0.0016, sg.x);
    o = vec4(mix(o.rgb, ac, a), max(o.a, a));
  }
  // hinge box
  vec2 hb = p - vec2(xp, 0.815);
  if (abs(hb.x) < 0.016 && abs(hb.y) < 0.020) o = vec4(0.14, 0.14, 0.17, 1.0);
  // red glow on top of everything of the signal
  o.rgb += vec3(1.0, 0.18, 0.10) * glowSum * 0.55;
  o.a = max(o.a, clamp(glowSum, 0.0, 1.0) * 0.6);
  return o;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 pm = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  // ---- crossing clock: lights and barrier, then the train, then everything lifts again
  float T = 34.0;
  float ph = mod(t, T);
  float lower = smoothstep(0.5, 3.5, ph) - smoothstep(26.0, 29.0, ph);
  float lights = smoothstep(0.3, 0.8, ph) * (1.0 - smoothstep(28.5, 29.1, ph));
  float blink = smoothstep(0.42, 0.58, fract(t * 1.1)) ;
  float angle = 1.12 * (1.0 - lower) + 0.012 * sin(t * 9.0) * (1.0 - lower) * (lower > 0.0 ? 1.0 : 0.0);
  float trainS = clamp((ph - 3.0) / 22.0, 0.0, 1.0);
  float trainL = 1.58;
  float xf = mix(-0.15, asp + trainL + 0.15, trainS);

  vec3 col;

  // ---- sky: deep blue overhead, brighter and warmer toward the hills, the sun a glare high on the left
  float gy = smoothstep(0.0, 0.72, uv.y);
  vec3 sky = mix(vec3(0.045, 0.235, 0.80), vec3(0.34, 0.70, 0.98), pow(gy, 1.15));
  sky = mix(sky, vec3(0.80, 0.93, 1.0), smoothstep(0.50, 0.70, uv.y) * 0.55);
  vec2 sunP = vec2(0.20 * asp, 0.13);
  float sd = length(p - sunP);
  sky += vec3(1.0, 0.95, 0.78) * (exp(-sd * sd / 0.030) * 0.30 + exp(-sd * sd / 0.0016) * 0.55);

  // ---- huge cumulus; the pointer pulls the cloud field toward itself
  {
    // thin high cirrus streaks in the open blue
    float cir = smoothstep(0.58, 0.82, sc_fbm4(vec2(p.x * 1.1 - t * 0.004, p.y * 9.0)));
    sky = mix(sky, vec3(0.86, 0.94, 1.0), cir * 0.20 * smoothstep(0.50, 0.15, uv.y));
  }
  vec4 cu = sc_cumulus(p, asp, pm, hasM, t);
  col = mix(sky, cu.rgb, cu.a);

  // ---- power lines on poles along the track (behind the train), swaying
  {
    float SP = 0.64;
    float cx = p.x / SP;
    float idx = floor(cx);
    float u = fract(cx);
    float pole = min(u, 1.0 - u) * SP;
    float top = 0.385 + 0.012 * (sc_hash(vec2(floor(cx + 0.5), 7.0)) - 0.5);
    float onPole = step(pole, 0.0042) * step(top, p.y) * step(p.y, 0.815);
    float arm = step(pole, 0.036) * step(abs(p.y - (top + 0.030)), 0.0030) * step(top, p.y);
    vec3 wireC = vec3(0.045, 0.060, 0.15);
    float sagk = 4.0 * u * (1.0 - u);
    float wa = 0.0;
    for (int k = 0; k < 3; k++) {
      float kf = float(k);
      float y0 = 0.425 + 0.038 * kf + 0.010 * (sc_hash(vec2(idx, kf)) - 0.5);
      float y1 = 0.425 + 0.038 * kf + 0.010 * (sc_hash(vec2(idx + 1.0, kf)) - 0.5);
      float yw = mix(y0, y1, u) + 0.030 * sagk + 0.0045 * sin(t * 0.85 + idx * 1.7 + kf * 1.3) * sagk;
      wa = max(wa, smoothstep(0.0016, 0.0005, abs(p.y - yw)));
    }
    float dark = max(max(onPole, arm), wa);
    // a little haze toward the horizon so the poles sit in the air
    float hz = smoothstep(0.30, 0.80, p.y) * 0.15;
    col = mix(col, mix(wireC, sky * 0.7, hz), dark * 0.90);
  }

  // ---- cicada-green hills: far blue-green ridge, mid ridge with round trees, then the rice field
  {
    float fy = sc_farRidge(p.x);
    if (uv.y > fy) {
      float dn = (uv.y - fy) / 0.20;
      vec3 far = mix(vec3(0.50, 0.78, 0.55), vec3(0.34, 0.64, 0.38), clamp(dn, 0.0, 1.0));
      far += vec3(0.05, 0.06, 0.03) * (sc_noise(p * 40.0) - 0.5);
      col = mix(col, far, smoothstep(0.0, 0.003, uv.y - fy));
    }
    float my = sc_midRidge(p.x);
    if (uv.y > my) {
      float dn = clamp((uv.y - my) / 0.16, 0.0, 1.0);
      vec3 mid = mix(vec3(0.46, 0.76, 0.20), vec3(0.27, 0.58, 0.13), pow(dn, 0.7));
      float grain = sc_noise(vec2(p.x * 90.0, uv.y * 24.0)) - 0.5;
      mid += vec3(0.06, 0.07, 0.02) * grain;
      mid *= 0.90 + 0.18 * sc_fbm4(p * vec2(6.0, 14.0));
      col = mix(col, mid, smoothstep(0.0, 0.003, uv.y - my));
    }
    // round trees on the mid ridge
    float TW = 0.105;
    float ci = floor(p.x / TW);
    float tr = 0.0, trl = 0.0;
    for (int k = -1; k <= 1; k++) {
      float id = ci + float(k);
      float hh = sc_hash(vec2(id, 3.0));
      if (hh > 0.40) {
        float cxx = (id + 0.2 + 0.6 * sc_hash(vec2(id, 5.0))) * TW;
        float rad = 0.020 + 0.018 * sc_hash(vec2(id, 9.0));
        vec2 cc = vec2(cxx, sc_midRidge(cxx) - rad * 0.55);
        vec2 dd = (p - cc) / vec2(rad, rad * 1.1);
        float d = length(dd);
        float a = smoothstep(1.0, 0.92, d);
        tr = max(tr, a);
        trl = max(trl, a * smoothstep(0.1, -0.8, dot(dd, vec2(0.6, 0.8))) );
      }
    }
    vec3 treeC = mix(vec3(0.10, 0.34, 0.12), vec3(0.34, 0.62, 0.16), trl);
    col = mix(col, treeC, tr);
    // sunny rice field on the near side, lighter strips
    if (uv.y > SC_HZ + 0.07) {
      float dn = clamp((uv.y - SC_HZ - 0.07) / 0.12, 0.0, 1.0);
      vec3 fld = mix(vec3(0.40, 0.72, 0.17), vec3(0.20, 0.52, 0.10), dn);
      float rows = 0.5 + 0.5 * sin(uv.y * 520.0 + sc_noise(vec2(p.x * 3.0, 1.0)) * 6.0);
      fld *= 0.92 + 0.12 * rows;
      fld += vec3(0.05, 0.07, 0.0) * (sc_noise(p * vec2(60.0, 120.0)) - 0.5);
      col = mix(col, fld, smoothstep(SC_HZ + 0.066, SC_HZ + 0.078, uv.y));
    }
  }

  // ---- the train: a slow dark silhouette, warm lit windows with a few heads
  {
    float lx = xf - p.x;                         // 0 at the nose, trainL at the tail
    float yT = 0.717, yB = SC_RAIL - 0.004;
    float nose = clamp(0.085 - lx, 0.0, 0.085);  // the nose is cut in a slope
    float topY = yT + nose * nose * 4.2;
    float inBody = step(0.0, lx) * step(lx, trainL) * step(topY, p.y) * step(p.y, yB);
    if (inBody > 0.5) {
      float carL = 0.395;
      float cl = mod(lx + 0.06, carL);
      vec3 body = vec3(0.060, 0.075, 0.170);
      // a cool rim light on the roof edge, and the lower skirt a touch darker
      body += vec3(0.20, 0.27, 0.45) * smoothstep(0.012, 0.0, p.y - topY);
      body *= 1.0 - 0.35 * smoothstep(0.80, 0.83, p.y);
      // bright accent stripe (reads even in silhouette)
      float strp = step(abs(p.y - 0.800), 0.0045);
      body = mix(body, vec3(0.28, 0.45, 0.70), strp * 0.65);
      // windows
      float wb = step(0.738, p.y) * step(p.y, 0.782);
      float wl = (cl - 0.045) / ((carL - 0.10) / 3.0);
      float wi = floor(wl);
      float wf = fract(wl);
      float inWin = wb * step(0.0, wl) * step(wl, 3.0) * step(0.14, wf) * step(wf, 0.86);
      if (inWin > 0.5) {
        float cid = floor((lx + 0.06) / carL);
        float wh = sc_hash(vec2(wi + cid * 3.0, 11.0));
        vec3 wc = mix(vec3(1.0, 0.80, 0.42), vec3(1.0, 0.92, 0.66), wh);
        wc *= 0.88 + 0.12 * smoothstep(0.738, 0.782, p.y);
        // a few passengers: a head and shoulders
        if (wh > 0.55) {
          vec2 hc = vec2((wf - 0.5) * (carL - 0.10) / 3.0, p.y - 0.771);
          float head = smoothstep(0.0085, 0.0070, length(hc - vec2(0.0, -0.002)));
          float shoulder = smoothstep(0.016, 0.012, length((hc - vec2(0.0, 0.016)) * vec2(0.8, 1.6)));
          wc = mix(wc, vec3(0.20, 0.15, 0.16), max(head, shoulder));
        }
        body = wc;
      }
      // gaps between cars show the dark underframe only
      float gap = step(cl, 0.030);
      if (gap > 0.5) body = vec3(0.025, 0.030, 0.075);
      // roof boxes
      float box = step(abs(cl - carL * 0.5), 0.050) * step(p.y, yT + 0.010);
      body = mix(body, vec3(0.10, 0.12, 0.22), box);
      // bogies and wheels
      float wheel = step(0.808, p.y) * step(abs(abs(cl - carL * 0.5) - 0.17), 0.030);
      body = mix(body, vec3(0.020, 0.025, 0.060), wheel);
      col = body;
    }
    // soft contact shadow on the rail bed
    col *= 1.0 - 0.18 * step(0.0, lx) * step(lx, trainL) * smoothstep(0.02, 0.0, abs(p.y - (SC_RAIL + 0.012)));
  }

  // ---- rails, sleepers, ballast and the foreground grass
  {
    float rail = smoothstep(0.0034, 0.0014, abs(p.y - (SC_RAIL - 0.001)));
    if (uv.y > SC_RAIL - 0.004 && uv.y < 0.895) {
      float dn = (uv.y - SC_RAIL) / 0.06;
      vec3 bal = mix(vec3(0.60, 0.56, 0.50), vec3(0.36, 0.34, 0.31), clamp(dn, 0.0, 1.0));
      bal *= 0.86 + 0.28 * sc_noise(p * vec2(220.0, 200.0));
      float slp = step(fract(p.x * 17.0), 0.30) * step(SC_RAIL + 0.002, uv.y) * step(uv.y, SC_RAIL + 0.026);
      bal = mix(bal, vec3(0.28, 0.20, 0.15), slp * 0.8);
      col = mix(col, bal, smoothstep(SC_RAIL - 0.004, SC_RAIL - 0.001, uv.y));
    }
    col = mix(col, vec3(0.78, 0.82, 0.88), rail * step(uv.y, SC_RAIL + 0.004) * 0.9);
    // grass strip below, blades reaching up along its edge
    float blades = 0.012 * sc_noise(vec2(p.x * 160.0, 3.0)) + 0.006 * sc_noise(vec2(p.x * 40.0, 8.0));
    float gtop = 0.888 - blades;
    if (uv.y > gtop) {
      float dn = clamp((uv.y - 0.89) / 0.11, 0.0, 1.0);
      vec3 gr = mix(vec3(0.30, 0.64, 0.12), vec3(0.09, 0.30, 0.08), pow(dn, 0.8));
      gr *= 0.88 + 0.24 * sc_noise(vec2(p.x * 70.0, uv.y * 90.0));
      // tiny white and yellow flowers
      vec2 fq = p * vec2(26.0, 26.0);
      vec2 fi = floor(fq);
      float fh = sc_hash(fi);
      float fl = step(0.86, fh) * smoothstep(0.17, 0.10, length(fract(fq) - 0.5));
      gr = mix(gr, mix(vec3(1.0, 0.98, 0.9), vec3(1.0, 0.85, 0.3), step(0.93, fh)), fl * smoothstep(0.0, 0.2, dn));
      col = mix(col, gr, smoothstep(gtop, gtop + 0.0025, uv.y));
    }
  }

  // ---- the two crossing signals in front, with the arms that meet over the road
  {
    float xl = 0.175 * asp + 0.04;
    float xr = 0.825 * asp - 0.04;
    float armLen = (xr - xl) * 0.5 - 0.025;
    vec4 sl = sc_signal(p, xl, 1.0, lights, blink, angle, armLen, t);
    col = mix(col, sl.rgb, sl.a);
    vec4 sr = sc_signal(p, xr, -1.0, lights, 1.0 - blink, angle, armLen, t);
    col = mix(col, sr.rgb, sr.a);
  }

  // let the user's own wallpaper show faintly through the scene
  col *= 0.97 + 0.06 * sc_luma(w);
  col *= 1.0 - 0.20 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
