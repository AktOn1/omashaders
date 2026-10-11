// label: Candy clouds
// hint: soft pastel cloud mountains under a round sun and a pastel rainbow, balloons and little stars bobbing in the air; the balloons float toward the pointer
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
float cc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// ---- pastel palettes (no arrays: if-chains)
vec3 cc_layerCol(int i) {
  if (i == 0) return vec3(0.86, 0.82, 1.00);
  if (i == 1) return vec3(1.00, 0.80, 0.89);
  if (i == 2) return vec3(0.76, 0.97, 0.89);
  return vec3(1.00, 0.96, 0.76);
}
vec3 cc_layerDeep(int i) {
  if (i == 0) return vec3(0.70, 0.68, 0.96);
  if (i == 1) return vec3(0.98, 0.64, 0.80);
  if (i == 2) return vec3(0.56, 0.88, 0.80);
  return vec3(0.98, 0.82, 0.58);
}
vec3 cc_balloonCol(int i) {
  if (i == 0) return vec3(1.00, 0.55, 0.72);
  if (i == 1) return vec3(0.45, 0.88, 0.80);
  if (i == 2) return vec3(1.00, 0.86, 0.35);
  if (i == 3) return vec3(0.52, 0.72, 1.00);
  if (i == 4) return vec3(0.78, 0.62, 1.00);
  if (i == 5) return vec3(1.00, 0.68, 0.50);
  return vec3(0.60, 0.92, 0.55);
}
vec3 cc_rainbow(float x) {
  vec3 c0 = vec3(1.00, 0.55, 0.62);
  vec3 c1 = vec3(1.00, 0.74, 0.50);
  vec3 c2 = vec3(1.00, 0.92, 0.55);
  vec3 c3 = vec3(0.62, 0.92, 0.66);
  vec3 c4 = vec3(0.55, 0.88, 0.96);
  vec3 c5 = vec3(0.62, 0.72, 1.00);
  vec3 c6 = vec3(0.80, 0.65, 0.98);
  float f = clamp(x, 0.0, 6.999);
  float s = smoothstep(0.30, 0.70, fract(f));
  if (f < 1.0) return mix(c0, c1, s);
  if (f < 2.0) return mix(c1, c2, s);
  if (f < 3.0) return mix(c2, c3, s);
  if (f < 4.0) return mix(c3, c4, s);
  if (f < 5.0) return mix(c4, c5, s);
  if (f < 6.0) return mix(c5, c6, s);
  return c6;
}

// ridge of a row of round cloud domes: height above the base at x
float cc_ridge(float x, float W, float seed, float Hs) {
  float id = floor(x / W);
  float hmax = 0.0;
  for (int k = -1; k <= 1; k++) {
    float j = id + float(k);
    float cx = (j + 0.5 + (cc_hash(vec2(j, seed)) - 0.5) * 0.5) * W;
    float r = W * (0.55 + 0.35 * cc_hash(vec2(j, seed + 3.0)));
    float hh = Hs * (0.55 + 0.55 * cc_hash(vec2(j, seed + 7.0)));
    float dx = (x - cx) / r;
    if (abs(dx) < 1.0) hmax = max(hmax, hh * sqrt(1.0 - dx * dx));
  }
  return hmax;
}

// rounded five-point star (signed distance, tip up)
float cc_star5(vec2 p, float r, float rf) {
  vec2 k1 = vec2(0.809016994375, -0.587785252292);
  vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
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

  // ---- sky: baby blue to peach cream
  float gy = smoothstep(0.0, 0.85, uv.y);
  vec3 col = mix(vec3(0.52, 0.78, 0.99), vec3(0.84, 0.91, 1.0), smoothstep(0.0, 0.55, gy));
  col = mix(col, vec3(1.0, 0.92, 0.88), smoothstep(0.45, 1.0, gy));

  // ---- a round sun with soft round halos
  {
    vec2 sc = vec2(0.17 * asp, 0.17);
    float d = length(p - sc);
    float halo1 = smoothstep(0.17, 0.085, d);
    float halo2 = smoothstep(0.26, 0.15, d);
    col = mix(col, vec3(1.0, 0.97, 0.78), halo2 * 0.30);
    col = mix(col, vec3(1.0, 0.95, 0.66), halo1 * 0.45);
    col = mix(col, vec3(1.0, 0.93, 0.50), smoothstep(0.066, 0.060, d));
    col = mix(col, vec3(1.0, 0.98, 0.78), smoothstep(0.046, 0.040, length(p - sc + vec2(0.014, 0.014))) * 0.55);
  }

  // ---- a soft rainbow, feet hidden behind the cloud mountains
  {
    vec2 rc = vec2(0.60 * asp, 0.80);
    float r = length(p - rc);
    float bw = 0.034;
    float R0 = 0.46;
    float u = (r - R0) / bw;
    float a = smoothstep(-0.2, 0.5, u) * smoothstep(7.2, 6.5, u);
    float shimmer = 0.92 + 0.08 * sin(atan(p.x - rc.x, rc.y - p.y) * 9.0 - t * 0.8);
    col = mix(col, cc_rainbow(u) * shimmer, a * 0.86 * step(p.y, rc.y));
  }

  // ---- little sky puffs: three round clouds drifting slowly
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float span = asp + 0.8;
    float cx = mod(span * (0.42 + 0.30 * fi) + t * (0.004 + 0.002 * fi), span) - 0.4;
    float cy = 0.20 + 0.12 * fi + 0.02 * sin(fi * 4.0);
    float sz = 0.045 + 0.012 * fi;
    float dd = 10.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      vec2 o = vec2((fk - 1.0) * sz * 1.05, (fk == 1.0 ? -sz * 0.35 : 0.0));
      float rk = sz * (fk == 1.0 ? 1.05 : 0.80);
      dd = min(dd, (length(p - vec2(cx, cy) - o) - rk) / sz);
    }
    col = mix(col, vec3(1.0, 0.99, 0.98), smoothstep(0.02, -0.02, dd) * 0.95);
  }

  // ---- pastel cloud mountains, far to near, each a row of round domes with a white rim
  for (int L = 0; L < 4; L++) {
    float fl = float(L);
    float base = 0.62 + 0.095 * fl + 0.012 * fl * fl * 0.5;
    float W = 0.36 - 0.045 * fl;
    float Hs = 0.215 - 0.030 * fl;
    float xs = p.x + t * 0.0025 * (fl + 1.0) + fl * 1.7;
    float hgt = cc_ridge(xs, W, fl * 11.0 + 2.0, Hs);
    float top = base - hgt;
    float below = p.y - top;
    if (below > 0.0) {
      vec3 lc = cc_layerCol(L), dc = cc_layerDeep(L);
      vec3 cl = mix(lc, dc, smoothstep(0.0, Hs * 1.5, below) * 0.55);
      // soft shine along the top edge
      cl = mix(cl, vec3(1.0), smoothstep(0.020, 0.0, below) * 0.80);
      cl += vec3(0.05) * smoothstep(0.06, 0.0, below);
      // a few round dimples to keep the clouds from looking flat
      vec2 dq = vec2(xs, p.y) / 0.085;
      vec2 di = floor(dq);
      float dh = cc_hash(di + fl * 5.0);
      float dimple = step(0.78, dh) * smoothstep(0.30, 0.18, length(fract(dq) - 0.5));
      cl = mix(cl, mix(lc, vec3(1.0), 0.5), dimple * 0.45);
      col = mix(col, cl, smoothstep(0.0, 0.0035, below));
    }
  }

  // ---- little stars bobbing in the air
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 c0 = vec2(asp * (0.06 + 0.88 * (fi + cc_hash(vec2(fi, 1.0))) / 7.0), 0.10 + 0.34 * cc_hash(vec2(fi, 2.0)));
    c0.y += 0.014 * sin(t * (0.9 + 0.4 * cc_hash(vec2(fi, 3.0))) + fi * 2.1);
    c0.x += 0.008 * sin(t * 0.6 + fi * 1.3);
    float r = 0.020 + 0.012 * cc_hash(vec2(fi, 4.0));
    vec2 l = (p - c0) / r;
    if (dot(l, l) > 6.0) continue;
    float d = cc_star5(vec2(l.x, -l.y) * 0.9, 0.62, 0.45) - 0.20;
    float a = smoothstep(0.06, -0.06, d);
    vec3 sc = fi < 1.0 ? vec3(1.0, 0.92, 0.45) : (mod(fi, 3.0) < 1.0 ? vec3(1.0, 0.86, 0.45) : (mod(fi, 3.0) < 2.0 ? vec3(1.0, 0.72, 0.84) : vec3(1.0, 0.99, 0.90)));
    // a round glow around each star and a tiny highlight
    col = mix(col, vec3(1.0, 0.97, 0.88), exp(-dot(l, l) * 0.35) * 0.30);
    col = mix(col, sc, a);
    col = mix(col, vec3(1.0), smoothstep(0.30, 0.18, length(l - vec2(-0.22, 0.12)) ) * a * 0.55);
  }

  // ---- balloons: round, glossy, strings trailing; they float toward the pointer
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 b0 = vec2(asp * (0.07 + 0.86 * (fi + 0.2 + 0.6 * cc_hash(vec2(fi, 11.0))) / 7.0), 0.30 + 0.28 * cc_hash(vec2(fi, 12.0)));
    float r = 0.040 + 0.014 * cc_hash(vec2(fi, 13.0));
    vec2 b = b0;
    if (hasM) b += (pm - b0) * 0.30;
    b.y += 0.020 * sin(t * 0.8 + fi * 1.7);
    b.x += 0.012 * sin(t * 0.55 + fi * 2.3);
    vec3 bc = cc_balloonCol(i);
    // string
    float sy = p.y - (b.y + r * 1.15);
    float strLen = 0.20;
    if (sy > 0.0 && sy < strLen) {
      float sx = b.x + 0.010 * sin(sy * 34.0 - t * 1.6 + fi) * (sy / strLen) + (b0.x - b.x) * 0.25 * (sy / strLen);
      float sa = smoothstep(0.0020, 0.0006, abs(p.x - sx)) * smoothstep(strLen, strLen - 0.03, sy);
      col = mix(col, vec3(1.0, 0.99, 0.97), sa * 0.85);
    }
    // body: slightly egg shaped, narrower at the bottom
    vec2 d = p - b;
    if (abs(d.x) > r * 1.3 || abs(d.y) > r * 1.5) continue;
    float narrow = 1.0 + 0.10 * smoothstep(-0.2, 1.0, d.y / r);
    vec2 e = vec2(d.x * narrow, d.y / 1.14) / r;
    float el = length(e);
    float a = smoothstep(1.0, 0.95, el);
    vec3 body = mix(bc, bc * vec3(0.80, 0.78, 0.92), smoothstep(-0.2, 1.0, dot(e, normalize(vec2(0.6, 0.8)))));   // shaded lower right
    body = mix(body, mix(bc, vec3(1.0), 0.45), smoothstep(0.65, 0.0, length(e - vec2(-0.25, -0.30))) * 0.5);
    // glossy highlight, two round dots
    body = mix(body, vec3(1.0), smoothstep(0.24, 0.17, length((e - vec2(-0.40, -0.45)) * vec2(1.0, 1.35))) * 0.90);
    body = mix(body, vec3(1.0), smoothstep(0.07, 0.04, length(e - vec2(-0.12, -0.72))) * 0.8);
    // round knot
    float kn = smoothstep(0.13, 0.09, length((d - vec2(0.0, r * 1.18)) / r)) ;
    body = mix(body, bc * 0.78, kn);
    col = mix(col, body, max(a, kn));
  }

  // ---- tiny round sparkles twinkling in the sky
  {
    float cs = 0.16;
    vec2 q = p / cs;
    vec2 id = floor(q);
    float h = cc_hash(id + 70.0);
    if (h > 0.70 && uv.y < 0.55) {
      vec2 c0 = vec2(0.5) + (vec2(cc_hash(id + 71.0), cc_hash(id + 72.0)) - 0.5) * 0.5;
      float d = length(fract(q) - c0);
      float tw = 0.5 + 0.5 * sin(t * (1.0 + 2.0 * h) + h * 50.0);
      col = mix(col, vec3(1.0), smoothstep(0.045, 0.02, d) * (0.35 + 0.55 * tw));
    }
  }

  // let the user's own wallpaper show faintly through the scene
  col *= 0.97 + 0.06 * cc_luma(w);
  col *= 1.0 - 0.10 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
