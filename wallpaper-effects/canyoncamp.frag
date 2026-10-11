// label: Canyon campfire
// hint: night in a red-rock canyon: a campfire with rising sparks, a wagon silhouette and a huge starry sky with a shooting star now and then; the sparks lift toward the pointer
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
float cc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cc_h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float cc_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cc_hash(i), cc_hash(i + vec2(1, 0)), f.x), mix(cc_hash(i + vec2(0, 1)), cc_hash(i + vec2(1, 1)), f.x), f.y);
}
float cc_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * cc_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float cc_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * cc_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float cc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float cc_seg(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return 1.0 - smoothstep(r - 0.0004, r + 0.0006, length(pa - ba * h));
}
float cc_ring(vec2 p, vec2 c, float r, float w) {
  return 1.0 - smoothstep(w * 0.6, w, abs(length(p - c) - r));
}

const float CC_GY = 0.80;      // where the canyon floor starts

// stepped terraces: flat shelves joined by steep risers
float cc_stair(float v, float q) {
  float k = v / q;
  return (floor(k) + smoothstep(0.80, 1.0, fract(k))) * q;
}
// the far wall silhouette: height of the rim above a column (y-down: smaller = higher)
float cc_rim(float x, float asp, float seed, float lo, float hi) {
  float s = abs(x - asp * 0.5) / (asp * 0.5);
  float base = mix(lo, hi, smoothstep(0.18, 0.98, s));
  base = cc_stair(base + (cc_fbm3(vec2(x * 1.3 + seed, seed)) - 0.5) * 0.12, 0.055);
  return base + (cc_noise(vec2(x * 26.0 + seed, 2.0)) - 0.5) * 0.014;
}

// covered wagon silhouette in local units (origin: axle height, x toward the front)
float cc_wagon(vec2 q) {
  float body = (1.0 - smoothstep(-0.001, 0.002, abs(q.x) - 0.115)) * (1.0 - smoothstep(-0.001, 0.002, abs(q.y + 0.032) - 0.016));
  vec2 cq = vec2(q.x * 0.92 - 0.004, q.y + 0.050);
  float arch = (1.0 - smoothstep(0.0, 0.003, length(cq * vec2(1.0, 1.55)) - 0.112)) * step(cq.y, 0.0);
  body = max(body, arch * step(abs(q.x), 0.118));
  body = max(body, cc_seg(q, vec2(-0.115, -0.012), vec2(-0.215, 0.012), 0.0035));
  float wheel = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 wcn = (k == 0) ? vec2(0.062, 0.0) : vec2(-0.066, 0.006);
    float wr = (k == 0) ? 0.050 : 0.040;
    wheel = max(wheel, cc_ring(q, wcn, wr, 0.0042));
    for (int s = 0; s < 4; s++) {
      float a = float(s) * 0.7854 + 0.2;
      vec2 d = vec2(cos(a), sin(a)) * wr;
      wheel = max(wheel, cc_seg(q, wcn - d, wcn + d, 0.0016));
    }
  }
  return clamp(max(body, wheel), 0.0, 1.0);
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
  vec2 F = vec2(asp * 0.44, CC_GY + 0.075);                // the fire at the foot of the flames
  float flick = 0.85 + 0.15 * sin(t * 9.0) * sin(t * 5.3 + 1.0) + 0.08 * sin(t * 17.0);

  // ---- the sky: deep indigo, a milky band, many stars
  float sk = clamp(uv.y / 0.7, 0.0, 1.0);
  vec3 col = mix(vec3(0.015, 0.025, 0.09), vec3(0.075, 0.075, 0.20), pow(sk, 1.4));
  col = mix(col, vec3(0.20, 0.10, 0.20), smoothstep(0.55, 1.0, sk) * 0.35);   // a last warm glow low over the rim
  {
    vec2 bn = normalize(vec2(0.55, 0.83));
    float d = dot(p - vec2(asp * 0.52, 0.20), bn);
    float band = exp(-d * d / 0.025);
    float cl = cc_fbm(p * 5.0 + 3.0);
    col += vec3(0.20, 0.20, 0.42) * band * (0.25 + 0.9 * cl) * 0.50;
    col += vec3(0.30, 0.14, 0.26) * exp(-d * d / 0.008) * smoothstep(0.55, 0.8, cl) * 0.25;
    // stars: one per grid cell, brighter ones with a little cross, denser inside the band
    for (int L = 0; L < 2; L++) {
      float sc = (L == 0) ? 70.0 : 150.0;
      vec2 g = p * sc;
      vec2 id = floor(g);
      vec2 fr = fract(g) - 0.5;
      float h = cc_hash(id + float(L) * 7.7);
      float thr = (L == 0) ? 0.90 - 0.06 * band : 0.93 - 0.05 * band;
      if (h > thr) {
        vec2 off = (vec2(cc_hash(id + 3.3), cc_hash(id + 8.1)) - 0.5) * 0.6;
        float dd = length(fr - off);
        float sz = (L == 0 ? 0.11 : 0.07) * (0.6 + 0.8 * cc_hash(id + 1.1));
        float tw = 0.65 + 0.35 * sin(t * (1.5 + 3.0 * cc_hash(id + 5.5)) + h * 40.0);
        float st = smoothstep(sz, 0.0, dd) * tw;
        float cross = (smoothstep(0.02, 0.0, abs(fr.x - off.x)) * smoothstep(0.30, 0.0, abs(fr.y - off.y)) + smoothstep(0.02, 0.0, abs(fr.y - off.y)) * smoothstep(0.30, 0.0, abs(fr.x - off.x))) * step(0.965, h) * 0.5;
        vec3 sc3 = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.88, 0.70), cc_hash(id + 2.2));
        col += sc3 * (st * 0.95 + cross * tw) * (L == 0 ? 1.0 : 0.7);
      }
    }
    // shooting star: now and then, from a random place in the open sky
    float per = 11.0;
    float ph = t / per + 0.62;
    float sd = floor(ph);
    float lf = fract(ph) * per;                   // seconds into this cycle
    if (lf < 0.9) {
      float s = lf / 0.9;
      float dirx = (cc_h1(sd + 1.0) > 0.5) ? 1.0 : -1.0;
      vec2 dir = normalize(vec2(dirx, 0.42 + 0.3 * cc_h1(sd + 2.0)));
      vec2 st0 = vec2(asp * (0.40 + 0.2 * cc_h1(sd + 3.0)) - dirx * 0.12, 0.04 + 0.12 * cc_h1(sd + 4.0));
      vec2 head = st0 + dir * (0.45 * s);
      vec2 rel = p - head;
      float along = -dot(rel, dir);               // distance behind the head
      float across = abs(dot(rel, vec2(-dir.y, dir.x)));
      float tail = smoothstep(0.0, 0.01, along) * exp(-along * 11.0) * smoothstep(0.0022, 0.0, across - along * 0.004);
      float hd = smoothstep(0.006, 0.0, length(rel)) * 1.0;
      float env = sin(s * 3.14159);
      col += vec3(0.85, 0.92, 1.0) * (tail * 0.9 + hd * 1.3) * env;
    }
  }

  // ---- far wall (a paler indigo layer), near wall (dark, red where the fire reaches it)
  float fireD = length((p - F) * vec2(1.0, 1.15));
  float fireL = flick / (1.0 + fireD * fireD * 14.0);       // light falling off from the fire
  float fireW = flick * exp(-fireD * 3.1);
  {
    float rimF = cc_rim(p.x, asp, 4.0, 0.66, 0.06);
    if (p.y > rimF) {
      float depthf = (p.y - rimF);
      float st = p.y * 22.0 + cc_noise(vec2(p.x * 3.0, p.y * 3.0)) * 2.0;
      vec3 w = mix(vec3(0.10, 0.10, 0.24), vec3(0.17, 0.13, 0.27), 0.5 + 0.5 * sin(st * 0.7));
      w *= 0.8 + 0.4 * cc_fbm3(vec2(p.x * 6.0, p.y * 10.0));
      w += vec3(0.50, 0.20, 0.10) * fireW * 0.12;
      col = mix(col, w, smoothstep(0.0, 0.0025, depthf));
    }
        float sN = abs(p.x - asp * 0.5) / (asp * 0.5);
    float rN = mix(0.80, 0.10, smoothstep(0.34, 1.00, sN));
    rN = cc_stair(rN + (cc_fbm3(vec2(p.x * 2.0 + 11.0, 4.0)) - 0.5) * 0.16, 0.07) + (cc_noise(vec2(p.x * 31.0, 9.0)) - 0.5) * 0.012;
    if (p.y > rN) {
      float dpt = p.y - rN;
      // strata that run along the face and wear away at the edges
      float st = p.y * 26.0 + cc_noise(vec2(p.x * 4.0 + 2.0, p.y * 6.0)) * 2.4 + cc_fbm3(vec2(p.x * 9.0, p.y * 7.0)) * 1.6;
      float band = cc_hash(vec2(floor(st), 4.0));
      vec3 shade = mix(vec3(0.08, 0.05, 0.12), vec3(0.17, 0.08, 0.13), band);       // indigo-black shadows
      shade *= 0.8 + 0.4 * cc_fbm(vec2(p.x * 8.0, p.y * 14.0));
      vec3 lightc = mix(vec3(0.66, 0.24, 0.12), vec3(0.92, 0.46, 0.20), band);       // terracotta in the firelight
      float fl = clamp(fireL * 1.25, 0.0, 1.0) * (0.55 + 0.7 * cc_fbm3(vec2(p.x * 7.0, p.y * 12.0 - 1.0)));
      vec3 w = shade + lightc * fl * 0.95 * smoothstep(0.25, 0.85, p.y);
      w += vec3(0.30, 0.12, 0.10) * smoothstep(0.03, 0.0, dpt) * 0.35 * (0.3 + fireL);   // faint rim catch light
      col = mix(col, w, smoothstep(0.0, 0.0025, dpt));
    }
  }

  // ---- the canyon floor, with the fire pool of light
  if (p.y > CC_GY) {
    float dg = p.y - CC_GY;
    vec3 g = vec3(0.07, 0.05, 0.10) * (0.9 + 0.3 * cc_fbm(vec2(p.x * 9.0, p.y * 22.0)));
    float pool = flick / (1.0 + pow(length((p - F) * vec2(0.8, 2.6)), 2.0) * 22.0);
    g += vec3(0.95, 0.40, 0.14) * pool * 0.75 * (0.6 + 0.8 * cc_fbm3(vec2(p.x * 12.0, p.y * 30.0)));
    // a few pebbles and a scrub
    vec2 pg = vec2(p.x * 40.0, p.y * 90.0);
    vec2 pid = floor(pg);
    float pbl = step(0.975, cc_hash(pid)) * smoothstep(0.28, 0.12, length(fract(pg) - 0.5));
    g += vec3(0.5, 0.25, 0.14) * pbl * (0.05 + pool * 0.8);
    col = mix(col, g, smoothstep(0.0, 0.004, dg));
  }

  // ---- the wagon: a covered wagon, dark with a warm rim facing the fire
  {
    float wc = asp * 0.74;
    float gy = CC_GY + 0.058;
    vec2 q = p - vec2(wc, gy);
    float sil = cc_wagon(q);
    float rimL = sil * (1.0 - cc_wagon(q + vec2(-0.0045, -0.0015)));      // edges that face the fire
    float lit = clamp(fireL * 2.4, 0.0, 1.0);
    vec3 wcol = vec3(0.022, 0.018, 0.04) + vec3(0.20, 0.08, 0.05) * lit * smoothstep(0.0, 0.5, (F.x - p.x) * 5.0 + 0.6);
    col = mix(col, wcol, sil);
    col += vec3(0.95, 0.42, 0.16) * rimL * lit * 1.1;
    float shd = exp(-pow((p.x - wc - 0.05) / 0.17, 2.0)) * exp(-pow((p.y - gy - 0.052) / 0.010, 2.0));
    col *= 1.0 - 0.45 * shd * step(CC_GY, p.y);
  }

  // ---- the fire: logs, a flickering teardrop of flame, a hot core
  {
    // logs
    float lg = cc_seg(p, F + vec2(-0.034, 0.010), F + vec2(0.030, -0.005), 0.0075);
    lg = max(lg, cc_seg(p, F + vec2(0.034, 0.010), F + vec2(-0.030, -0.005), 0.0075));
    vec3 lc = mix(vec3(0.08, 0.04, 0.03), vec3(0.95, 0.35, 0.08), 0.3 + 0.5 * cc_noise(p * 160.0 + t));
    col = mix(col, lc * (0.6 + 0.4 * flick), lg);
    // stones ring
    for (int k = 0; k < 7; k++) {
      float a = float(k) * 0.8976 + 0.3;
      vec2 sp = F + vec2(cos(a) * 0.062, 0.015 + sin(a) * 0.016);
      float sr = 0.0095 + 0.003 * cc_h1(float(k) + 2.0);
      float sdsk = smoothstep(sr, sr * 0.7, length((p - sp) * vec2(1.0, 1.35)));
      col = mix(col, vec3(0.05, 0.035, 0.06) + vec3(0.6, 0.25, 0.1) * 0.22 * flick * (0.5 + 0.5 * cos(a)), sdsk);
    }
    // the flames
    vec2 q = p - F;
    float lean = 0.0;
    if (hasM) lean = clamp((mp.x - F.x) * 0.06, -0.012, 0.012);
    float hgt = 0.18 * (0.9 + 0.2 * sin(t * 3.1));
    float fy = -q.y / hgt;
    if (fy > -0.05 && fy < 1.15) {
      float fc = clamp(fy, 0.0, 1.0);
      float wob = (cc_noise(vec2(fc * 3.5 - t * 3.4, 1.0)) - 0.5) * 0.04 * fc + lean * fc * fc;
      float w = 0.052 * pow(1.0 - fc, 0.85) * (0.8 + 0.25 * cc_noise(vec2(fc * 6.0 - t * 5.0, 7.0)));
      float u = (q.x - wob) / max(w, 0.0008);
      float fl = smoothstep(1.0, 0.0, abs(u)) * smoothstep(1.1, 0.8, fy) * smoothstep(-0.05, 0.05, fy);
      fl *= 0.6 + 0.6 * cc_fbm3(vec2(u * 1.2 + t * 0.4, fy * 5.0 - t * 3.0));
      float core = smoothstep(0.55, 0.0, abs(u)) * smoothstep(0.75, 0.0, fy);
      vec3 fc3 = mix(vec3(0.85, 0.18, 0.05), vec3(1.0, 0.62, 0.15), smoothstep(0.0, 0.8, 1.0 - abs(u)));
      fc3 = mix(fc3, vec3(1.0, 0.92, 0.60), core * 0.85);
      col = mix(col, fc3, clamp(fl * 1.1, 0.0, 1.0));
    }
    // heat and glow, additive
    col += vec3(1.0, 0.45, 0.12) * flick * exp(-length(q * vec2(1.0, 1.4) - vec2(0.0, -0.05)) * 11.0) * 0.36;
  }

  // ---- sparks: lift off the fire in the breeze; when the pointer is near they curve toward it
  {
    vec3 acc = vec3(0.0);
    for (int j = 0; j < 22; j++) {
      float jf = float(j);
      float s = jf * 4.31;
      float spd = 0.10 + 0.07 * cc_h1(s + 1.0);
      float life = fract(t * spd + cc_h1(s));
      float x0 = F.x + (cc_h1(s + 2.0) - 0.5) * 0.045;
      float rise = life * (0.34 + 0.34 * cc_h1(s + 3.0));
      vec2 pos = vec2(x0 + sin(t * (1.2 + cc_h1(s + 4.0)) + s * 5.0) * 0.012 * life + 0.02 * life * life, F.y - 0.07 - rise);
      if (hasM) {
        float pull = smoothstep(0.05, 0.85, life) * (0.35 + 0.35 * cc_h1(s + 5.0));
        pos = mix(pos, mp + vec2(sin(t * 2.0 + s), cos(t * 2.3 + s * 2.0)) * 0.02, pull * pull * 1.2);
      }
      float sz = 0.0018 + 0.0024 * cc_h1(s + 6.0);
      float dd = length(p - pos);
      float g = smoothstep(sz, sz * 0.2, dd) + exp(-dd * dd / (sz * sz * 14.0)) * 0.35;
      float fade = smoothstep(0.0, 0.05, life) * pow(1.0 - life, 0.7) * (0.65 + 0.35 * sin(t * 14.0 + s * 3.0));
      vec3 sc = mix(vec3(1.0, 0.85, 0.40), vec3(0.95, 0.30, 0.08), life);
      acc += sc * g * fade;
    }
    col += acc * 2.4;
    // a faint smoke haze above the flame that the stars shine through
    col += vec3(0.25, 0.10, 0.05) * flick * exp(-pow((p.x - F.x - 0.01) / 0.07, 2.0)) * smoothstep(F.y - 0.30, F.y - 0.12, p.y) * smoothstep(F.y - 0.03, F.y - 0.12, p.y) * 0.10;
  }

  // ---- finish: the picture only as a faint trace, a soft vignette
  col *= 0.97 + 0.06 * cc_luma(pic);
  col *= 1.0 - 0.35 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
