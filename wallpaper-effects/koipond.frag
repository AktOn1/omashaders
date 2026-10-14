// label: Koi pond
// hint: dusk pond, lily pads, koi drift toward the pointer
// category: Calm scenes
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

// ---------------------------------------------------------------- ripples on the surface
// one wave packet around a centre: height and its gradient (x, y), d = distance, r = radius of the leading crest
vec3 kpWave(vec2 dv, float r, float amp) {
  float d = length(dv);
  float x = d - r;
  float env = exp(-x * x / (2.0 * 0.020 * 0.020)) ;
  float k = 140.0;
  float h = cos(x * k) * env * amp;
  float dh = (-sin(x * k) * k * env + cos(x * k) * env * (-x / (0.020 * 0.020))) * amp;
  vec2 g = dv / max(d, 1e-4) * dh;
  return vec3(h, g);
}
// all ripples at p (aspect-corrected, height units): slow raindrops on the pond plus rings round the pointer
vec3 kpRipples(vec2 p, vec2 mp) {
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 3.2 : 5.5;
    vec2 g = p * sc;
    vec2 id = floor(g);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cell = id + vec2(float(i), float(j)) + float(k) * 31.0;
        float period = 9.0 + 8.0 * hash(cell + 2.2);
        float ph = time / period + hash(cell + 7.7);
        float cyc = floor(ph);
        float fr = fract(ph);
        if (hash(cell + cyc * 13.7) > 0.45) continue;
        vec2 c = floor(id) + vec2(float(i), float(j)) + 0.2 + 0.6 * vec2(hash(cell + cyc * 3.3), hash(cell + cyc * 5.1));
        float r = fr * 0.80 / sc;
        float amp = 0.0016 * pow(1.0 - fr, 1.6) * smoothstep(0.0, 0.05, fr);
        vec3 w = kpWave((g - c) / sc, r, amp);
        w += kpWave((g - c) / sc, r * 0.72, amp * 0.7) * 0.8;
        acc += w;
      }
    }
  }
  if (mp.x > -2.0) {
    for (int j = 0; j < 3; j++) {
      float fr = fract(time * 0.14 + float(j) / 3.0);
      float r = 0.012 + fr * 0.30;
      float amp = 0.0022 * pow(1.0 - fr, 1.7) * smoothstep(0.0, 0.06, fr);
      acc += kpWave(p - mp, r, amp);
    }
  }
  return acc;
}

// ---------------------------------------------------------------- lily pads (premultiplied colour in rgb, coverage in a)
vec4 kpPads(vec2 p, vec2 mp, float asp, float sc, float seed, float dens, out float shade) {
  vec2 drift = vec2(time * 0.0035, time * 0.0012) * sc;
  vec2 g = p * sc + drift;
  vec2 id = floor(g);
  float ew = 1.6 * sc / res.y;
  vec3 col = vec3(0.0);
  float cov = 0.0;
  shade = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = id + vec2(float(i), float(j));
      float h = hash(cell + seed);
      vec2 wc = (cell + 0.5 - drift) / sc;
      float edge = length(wc / vec2(asp, 1.0) - 0.5);
      float dd = dens * (0.35 + 1.0 * smoothstep(0.05, 0.7, edge));
      if (h > dd) continue;
      vec2 c = cell + 0.25 + 0.5 * vec2(hash(cell + seed + 3.1), hash(cell + seed + 5.7));
      c += 0.035 * vec2(sin(time * 0.21 + h * 50.0), cos(time * 0.17 + h * 37.0));
      vec2 pw = (c - drift) / sc - mp;
      float dm = length(pw);
      c += pw / max(dm, 1e-3) * exp(-dm * dm / (0.15 * 0.15)) * 0.16;     // the pointer nudges pads aside
      float r = 0.20 + 0.16 * hash(cell + seed + 9.3);
      vec2 d = g - c;
      float rd = length(d);
      float an = atan(d.y, d.x);
      float ang0 = hash(cell + seed + 11.9) * 6.2832;
      float da = abs(mod(an - ang0 + 3.14159, 6.28318) - 3.14159);
      float notch = smoothstep(0.07, 0.15, da);
      float rr = r * (1.0 + 0.03 * sin(an * 5.0 + h * 20.0));
      float inside = smoothstep(rr, rr - ew, rd) * notch;
      float sh = smoothstep(rr * 1.22, rr * 0.80, length(d - vec2(0.035, 0.05)));
      shade = max(shade, sh * 0.55 * (1.0 - cov));
      if (inside > 0.0 || sh > 0.0) {
        vec2 dir = d / max(rd, 1e-3);
        float t = rd / rr;
        float lit = 0.5 + 0.5 * dot(dir, vec2(-0.6, -0.8));
        float hue = hash(cell + seed + 2.2);
        vec3 base = mix(vec3(0.040, 0.165, 0.092), vec3(0.100, 0.290, 0.140), hue);
        if (hue > 0.9) base = mix(base, vec3(0.30, 0.30, 0.09), 0.5);
        float vein = pow(abs(cos((an - ang0) * 4.5)), 30.0) * smoothstep(0.12, 0.5, t) * (1.0 - 0.4 * t);
        vec3 pc = base * (0.70 + 0.55 * lit * (0.35 + 0.65 * t)) + vec3(0.025, 0.065, 0.030) * vein;
        pc += vec3(0.10, 0.17, 0.10) * smoothstep(0.78, 1.0, t) * lit * 0.55;         // wet rim catching the sky
        pc += vec3(0.0, 0.02, 0.01) * (1.0 - t);
        col = pc * inside + col * (1.0 - inside);
        cov = inside + cov * (1.0 - inside);
        // a lotus blossom on some pads
        if (hash(cell + seed + 14.1) > 0.80) {
          vec2 fc = c + r * 0.30 * vec2(cos(ang0 + 3.0), sin(ang0 + 3.0));
          vec2 fd = g - fc;
          float fr = length(fd);
          float fa = atan(fd.y, fd.x);
          float R = r * 0.46;
          float pr = R * (0.60 + 0.40 * abs(cos(fa * 4.0 + h * 6.0)));
          float fin = smoothstep(pr, pr - ew, fr);
          if (fin > 0.0) {
            float u = fr / max(pr, 1e-3);
            vec3 petal = mix(vec3(0.97, 0.55, 0.70), vec3(1.0, 0.88, 0.92), smoothstep(0.2, 1.0, u));
            petal *= 0.88 + 0.12 * cos(fa * 8.0 + h * 9.0);
            petal = mix(petal, vec3(1.0, 0.86, 0.38), smoothstep(0.30, 0.0, fr / R));
            petal *= 0.85;                                                           // dusk light
            col = petal * fin + col * (1.0 - fin);
            cov = max(cov, fin);
          }
        }
      }
    }
  }
  return vec4(col, cov);
}

// ---------------------------------------------------------------- koi
// the loop a fish swims along (aspect-corrected height units); the pointer pulls the whole loop gently toward it
vec2 kpFishPos(float fi, float t, float asp, vec2 mp, float curious) {
  float a1 = hash1(fi * 7.13 + 1.0), a2 = hash1(fi * 3.71 + 2.0), a3 = hash1(fi * 5.37 + 3.0), a4 = hash1(fi * 2.29 + 4.0);
  float a5 = hash1(fi * 9.91 + 5.0), a6 = hash1(fi * 6.43 + 6.0), a7 = hash1(fi * 4.17 + 7.0), a8 = hash1(fi * 8.53 + 8.0);
  vec2 cb = vec2(asp * (0.18 + 0.64 * a1), 0.25 + 0.5 * a2);
  vec2 cw = cb + vec2(asp * 0.07 * sin(t * 0.019 + a5 * 6.28), 0.06 * cos(t * 0.023 + a6 * 6.28));
  vec2 pw = mp - cb;
  float pull = curious * 0.6 * exp(-dot(pw, pw) / 1.1);
  cw += pw * pull;
  float w = (0.085 + 0.045 * a8) * (a7 < 0.5 ? 1.0 : -1.0);
  float th = w * t + a3 * 6.28;
  vec2 A = vec2(0.30 + 0.13 * a4, 0.19 + 0.07 * a3);
  vec2 q = vec2(A.x * cos(th), A.y * sin(th));
  float al = a6 * 6.28 + t * 0.011 * (a7 < 0.5 ? 1.0 : -1.0);
  q = vec2(cos(al) * q.x - sin(al) * q.y, sin(al) * q.x + cos(al) * q.y);
  return cw + q;
}
float kpRadius(float s, float rm) {
  float up = 0.55 + 0.45 * smoothstep(0.0, 0.22, s);
  float down = 1.0 - 0.80 * smoothstep(0.28, 0.82, s);
  float f = smoothstep(0.80, 1.0, s);
  return rm * (up * down + 0.85 * f * f);
}
vec2 kpSeg(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return vec2(length(p - a - ba * h), h);
}
// returns rgb + alpha of koi number fi at p; `under` receives a soft shadow amount on the pond bed
vec4 kpKoi(vec2 p, float fi, float asp, vec2 mp, vec3 water, out float under) {
  under = 0.0;
  float h0 = hash1(fi * 1.77 + 0.3);
  float curious = 0.45 + 0.55 * hash1(fi * 12.3 + 1.1);
  float L = 0.19 + 0.07 * hash1(fi * 5.5 + 9.0);
  vec2 head = kpFishPos(fi, time, asp, mp, curious);
  if (length(p - head) > L * 1.15) return vec4(0.0);
  float rm = 0.105 * L;
  float N = 9.0;
  float w = (0.085 + 0.045 * hash1(fi * 8.53 + 8.0));
  float A1 = 0.30 + 0.13 * hash1(fi * 2.29 + 4.0), A2 = 0.19 + 0.07 * hash1(fi * 5.37 + 3.0);
  float dt = (L / N) / (w * sqrt(A1 * A2));
  float wigPh = time * 2.1 + h0 * 40.0;

  float dBody = 1e3, sBody = 0.0, latBody = 0.0;
  float dFin = 1e3;
  vec2 pa = head;
  for (int k = 0; k < 9; k++) {
    float s0 = float(k) / N, s1 = float(k + 1) / N;
    vec2 pr = kpFishPos(fi, time - float(k + 1) * dt, asp, mp, curious);
    vec2 dn = (pr - pa) / max(length(pr - pa), 1e-5);
    vec2 pb = pa + dn * (L / N);                              // fixed segment length: a fish never stretches or shrinks
    vec2 nv = vec2(-dn.y, dn.x);
    float wa = 0.085 * L * sin(wigPh - s0 * 5.0) * pow(s0, 1.3);
    float wb = 0.085 * L * sin(wigPh - s1 * 5.0) * pow(s1, 1.3);
    vec2 a = pa + nv * wa, b = pb + nv * wb;
    vec2 sg = kpSeg(p, a, b);
    float r0 = kpRadius(s0, rm), r1 = kpRadius(s1, rm);
    float d = sg.x - mix(r0, r1, sg.y);
    if (d < dBody) {
      dBody = d;
      sBody = mix(s0, s1, sg.y);
      vec2 cp = a + (b - a) * sg.y;
      latBody = dot(p - cp, nv) / max(mix(r0, r1, sg.y), 1e-4);
    }
    if (k == 2) {                                              // pectoral fins
      for (int sgn = -1; sgn <= 1; sgn += 2) {
        vec2 root = a + nv * float(sgn) * r0 * 0.85;
        float flap = 0.015 * L * sin(wigPh * 0.8 + float(sgn));
        vec2 tip = root + dn * 0.15 * L + nv * float(sgn) * (0.075 * L + flap);
        vec2 fs = kpSeg(p, root, tip);
        dFin = min(dFin, fs.x - mix(0.010 * L, 0.030 * L, fs.y));
      }
    }
    pa = pb;
  }
  float bl = 0.010;
  under = smoothstep(0.05, 0.0, min(dBody, dFin)) * 0.30;
  float aBody = smoothstep(bl, -bl * 0.5, dBody);
  float aFin = smoothstep(bl * 1.6, -bl * 0.5, dFin) * 0.55;
  float tailMask = smoothstep(0.80, 0.95, sBody);
  aBody *= 1.0 - 0.50 * tailMask;
  float a = max(aBody, aFin);
  if (a <= 0.001) return vec4(0.0);

  // colour: white skin with orange patches, different for each fish
  float sd = hash1(fi * 3.3 + 0.7) * 40.0;
  float ns = noise(vec2(sBody * 3.4, latBody * 0.9) + sd) * 0.65 + noise(vec2(sBody * 8.0, latBody * 2.2) + sd * 1.7) * 0.35;
  float thr = 0.36 + 0.22 * hash1(fi * 6.1 + 2.0);
  float pch = smoothstep(thr, thr + 0.07, ns);
  vec3 orange = mix(vec3(0.95, 0.34, 0.07), vec3(1.0, 0.56, 0.13), noise(vec2(sBody * 5.0, latBody) + sd));
  vec3 white = vec3(0.94, 0.91, 0.85);
  vec3 kc = mix(white, orange, pch);
  if (hash1(fi * 2.1 + 5.0) > 0.45) {                           // a red cap on some of them
    float cap = smoothstep(0.17, 0.09, sBody) * smoothstep(1.1, 0.4, abs(latBody));
    kc = mix(kc, vec3(0.88, 0.16, 0.08), cap);
  }
  kc *= 0.80 + 0.20 * (1.0 - latBody * latBody * 0.9);          // rounded back, darker flanks
  vec3 fc = mix(kc, vec3(1.0, 0.85, 0.7), 0.45);
  kc = mix(kc, fc, max(tailMask * 0.8, aFin > aBody ? 0.8 : 0.0));
  kc = mix(kc, water, 0.50) * 0.90;                              // seen through a little water, at dusk
  return vec4(kc, a * 0.85);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);

  // ripples bend what lies under and on the surface
  vec3 rp = kpRipples(p, mp);
  vec2 bend = rp.yz;

  // the pond bed: the wallpaper seen through dark green water
  vec3 col = wall(clamp(uv + bend * 0.024 / vec2(asp, 1.0), 0.0, 1.0));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 water = vec3(0.025, 0.115, 0.095);
  col = mix(col, vec3(l) * vec3(0.55, 1.0, 0.80), 0.28) * 0.80 + water * 0.22;   // the picture's own colours, seen through a little green water
  float murk = fbm3(p * 2.1 + vec2(time * 0.006, -time * 0.004));
  col *= 0.90 + 0.20 * murk;
  col += vec3(0.060, 0.045, 0.030) * smoothstep(0.55, 0.0, uv.y) * 0.5;      // dusk sky glow on the far water

  // koi swim below the surface
  vec2 pk = p + bend * 0.02;
  for (int i = 0; i < 4; i++) {
    float under;
    vec4 k = kpKoi(pk, float(i) + 1.0, asp, mp, water, under);
    col *= 1.0 - under * 0.6;
    col = mix(col, k.rgb, k.a * 0.80);                                          // under the surface: the picture shows through
  }

  // a thin veil of reflected sky above them
  col += vec3(0.020, 0.040, 0.034) * (0.4 + 0.6 * murk) * smoothstep(1.0, 0.0, uv.y);

  // lily pads on the surface
  vec2 pp = p + bend * 0.004;
  float s1, s2;
  vec4 padsA = kpPads(pp, mp, asp, 4.2, 0.0, 0.13, s1);
  vec4 padsB = kpPads(pp + 2.7, mp, asp, 7.3, 17.0, 0.09, s2);
  col *= 1.0 - max(s1, s2) * 0.45;
  col = padsB.rgb * 0.72 + col * (1.0 - padsB.a * 0.72);                      // pads are translucent: the wallpaper stays readable under them
  col = padsA.rgb * 0.72 + col * (1.0 - padsA.a * 0.72);

  // ripple light: crests catch the dusk sky
  float spec = clamp(dot(bend, vec2(-0.6, -0.8)) * 0.9, 0.0, 1.0);
  col += vec3(0.55, 0.85, 0.75) * spec * 0.6;
  col += vec3(0.04, 0.07, 0.06) * clamp(rp.x * 90.0, -1.0, 1.0);

  col *= 1.0 - 0.32 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
