// label: High noon
// hint: a white-hot noon sun over a canyon road: heat shimmer on the horizon, telegraph poles running away, two vultures circling and a lonely dust devil that drifts toward the pointer
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
float hn_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hn_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hn_hash(i), hn_hash(i + vec2(1, 0)), f.x), mix(hn_hash(i + vec2(0, 1)), hn_hash(i + vec2(1, 1)), f.x), f.y);
}
float hn_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * hn_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float hn_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * hn_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float hn_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hn_seg(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return 1.0 - smoothstep(r - 0.0005, r + 0.0007, length(pa - ba * h));
}

const float HN_HZ = 0.56;

// a vulture soaring: body and two long wings slightly raised, tips drooping, a lazy flap
float hn_bird(vec2 p, vec2 c, float s, float flap, float dir) {
  vec2 q = (p - c) / s;
  q.x *= dir;
  float body = 1.0 - smoothstep(0.30, 0.42, length(q * vec2(1.0, 2.6)));
  float ang = 0.30 + 0.22 * flap;
  vec2 wr = vec2(cos(ang), -sin(ang));
  float wing = 0.0;
  for (int k = 0; k < 2; k++) {
    float sg = (k == 0) ? 1.0 : -1.0;
    vec2 a = vec2(0.0, 0.0);
    vec2 b = vec2(sg * wr.x * 2.6, wr.y * 2.6 + 0.35);
    vec2 pa = q - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float w = mix(0.34, 0.10, h);
    wing = max(wing, 1.0 - smoothstep(w * 0.7, w, length(pa - ba * h)));
  }
  return clamp(body + wing, 0.0, 1.0);
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
  vec2 V = vec2(asp * 0.5, HN_HZ);

  // ---- heat shimmer: the picture of everything near the horizon is shaken sideways in thin lines that crawl upward
  float prox = exp(-pow((uv.y - HN_HZ) / 0.045, 2.0));
  float wob = (sin(uv.y * 520.0 - t * 2.4 + hn_noise(vec2(p.x * 4.0, t * 0.3)) * 6.0) * 0.6 + sin(uv.y * 190.0 - t * 1.3 + p.x * 3.0) * 0.4);
  vec2 pw = p + vec2(prox * 0.0042 * wob * (0.6 + 0.8 * hn_noise(vec2(p.x * 6.0, uv.y * 40.0 - t * 0.7))), 0.0);

  // ---- the sun: nearly white, with a huge bleaching glow
  vec2 sunP = vec2(asp * 0.60, 0.115);
  vec2 sd = (p - sunP);
  float dS = length(sd);
  vec3 col;
  float k = clamp(uv.y / HN_HZ, 0.0, 1.0);
  vec3 skyTop = vec3(0.30, 0.52, 0.82);
  vec3 skyMid = vec3(0.64, 0.80, 0.93);
  vec3 skyLow = vec3(1.0, 0.94, 0.80);
  vec3 sky = mix(skyTop, skyMid, smoothstep(0.0, 0.62, k));
  sky = mix(sky, skyLow, smoothstep(0.55, 1.0, k));
  sky = mix(sky, vec3(1.0, 0.98, 0.92), exp(-dS * dS / 0.05) * 0.85);
  sky += vec3(1.0, 0.95, 0.80) * exp(-dS * 3.2) * 0.30;
  float disc = 1.0 - smoothstep(0.026, 0.032, dS);
  sky = mix(sky, vec3(2.2), disc);
  // a few thin high cirrus streaks that barely move
  float cir = smoothstep(0.55, 0.80, hn_fbm3(vec2(p.x * 0.8 - t * 0.004, uv.y * 14.0 + 2.0))) * smoothstep(0.40, 0.05, uv.y) * 0.35;
  sky = mix(sky, vec3(1.0, 0.98, 0.95), cir);
  col = sky;

  // ---- far mesas seen through the gap at the end of the road, washed pale by the haze
  {
    float mh = hn_fbm3(vec2(pw.x * 2.1 + 1.5, 5.0));
    float rid = HN_HZ - 0.014 - 0.06 * smoothstep(0.40, 0.52, mh) - 0.015 * mh;
    float mesa = smoothstep(rid - 0.0012, rid + 0.0015, uv.y);
    vec3 mc = mix(vec3(0.74, 0.58, 0.60), vec3(0.97, 0.88, 0.76), 0.55 + 0.30 * smoothstep(rid, HN_HZ, uv.y));
    col = mix(col, mc, mesa * step(uv.y, HN_HZ + 0.02));
    float rid2 = HN_HZ - 0.008 - 0.03 * smoothstep(0.35, 0.50, hn_fbm3(vec2(pw.x * 3.3 + 9.0, 1.0)));
    col = mix(col, vec3(0.88, 0.70, 0.60), smoothstep(rid2 - 0.001, rid2 + 0.0015, uv.y) * step(uv.y, HN_HZ + 0.02) * 0.9);
  }

  // ---- the canyon: two terraced red walls that run in perspective toward the vanishing point, strata in bands, haze with distance
  {
    float gap = 0.15;
    float side = (pw.x < V.x) ? -1.0 : 1.0;
    float dxw = abs(pw.x - V.x) - gap;
    if (dxw > 0.0) {
      float u = 0.16 / (dxw + 0.04);                 // depth along the wall
      float sl = (pw.y - HN_HZ) / dxw;               // slope: where on the face
      float nTop = hn_fbm3(vec2(u * 3.0 + (side > 0.0 ? 11.0 : 0.0), 2.0));
      float ku = 0.82 + 0.30 * (nTop - 0.5) + 0.12 * (floor(u * 5.0) * 0.2 - 0.3) * 0.0;
      // terraces: the top edge steps
      float stepQ = floor(nTop * 4.0) * 0.07;
      float topS = -(ku + stepQ - 0.1);
      float kd = 0.95;
      if (sl > topS && sl < kd) {
        float f = (sl - topS) / (kd - topS);
        // strata: bands of different red that run along the wall
        float st = sl * 7.0 + hn_noise(vec2(u * 4.0, sl * 2.0 + side)) * 1.8 + hn_fbm3(vec2(u * 9.0, sl * 5.0)) * 1.2;
        float band = hn_hash(vec2(floor(st), side + 3.0));
        vec3 rA = vec3(0.78, 0.36, 0.20), rB = vec3(0.58, 0.24, 0.16), rC = vec3(0.92, 0.58, 0.34);
        vec3 wc = mix(mix(rA, rB, smoothstep(0.25, 0.7, band)), rC, smoothstep(0.7, 1.0, band) * 0.8);
        wc *= 0.80 + 0.30 * hn_fbm(vec2(u * 7.0, sl * 9.0 + side * 3.0));
        wc *= 0.78 + 0.22 * smoothstep(0.0, 0.5, fract(st));           // each band has a darker lower lip
        wc *= 0.70 + 0.55 * (1.0 - f * 0.55);                          // lower rock is in its own shade
        wc = mix(wc, wc * vec3(1.15, 1.02, 0.92), 0.5 * smoothstep(0.35, 0.0, f));   // the sunlit rim at the top
        float hz = smoothstep(0.55, 0.06, dxw) * 0.75;                 // far end washed by haze
        wc = mix(wc, vec3(0.96, 0.84, 0.72), hz);
        float edgeA = smoothstep(topS, topS + 0.012, sl);
        col = mix(col, wc, edgeA);
      }
    }
  }

  // ---- the plain and the road
  if (uv.y > HN_HZ - 0.004) {
    float dpt = max(pw.y - HN_HZ, 0.0);
    float gz = dpt + 0.012;
    float gzz = 0.04 / gz;                           // depth coordinate: bigger = farther
    float gx = (pw.x - V.x) / gz * 0.04;             // lateral world coordinate
    vec3 far = vec3(0.96, 0.84, 0.64);
    vec3 near = vec3(0.80, 0.54, 0.34);
    vec3 g = mix(far, near, pow(clamp(dpt / 0.42, 0.0, 1.0), 0.6));
    float grain = hn_fbm(vec2(gx * 7.0, gzz * 6.0));
    g *= 0.88 + 0.22 * grain;
    // scrub bushes scattered on the plain
    vec2 sg = vec2(gx * 10.0, gzz * 3.0);
    vec2 sc = floor(sg);
    vec2 sj = vec2(hn_hash(sc + 1.3), hn_hash(sc + 7.7));
    float sOn = step(0.84, hn_hash(sc + 3.1)) * step(0.2, abs(gx)) * smoothstep(0.12, 0.22, pw.y - HN_HZ) * step(0.0, gzz);
    float bush = smoothstep(0.26, 0.10, length((fract(sg) - (0.25 + 0.5 * sj)) * vec2(1.0, 0.65)));
    g = mix(g, vec3(0.43, 0.38, 0.22) * (0.8 + 0.4 * hn_noise(sg * 5.0)), bush * sOn * 0.85 * smoothstep(0.0, 0.03, dpt));
    // the road: pale asphalt with a worn centre line
    float roadHalf = 0.012 + dpt * 0.62;
    float onRoad = 1.0 - smoothstep(roadHalf - 0.0015 - dpt * 0.01, roadHalf + 0.0015 + dpt * 0.01, abs(pw.x - V.x));
    vec3 road = mix(vec3(0.82, 0.78, 0.70), vec3(0.46, 0.43, 0.42), pow(clamp(dpt / 0.40, 0.0, 1.0), 0.7));
    road *= 0.92 + 0.12 * hn_fbm(vec2(gx * 4.0, gzz * 14.0));
    float dash = step(0.5, fract(gzz * 2.2)) * (1.0 - smoothstep(0.004 + dpt * 0.012, 0.006 + dpt * 0.014, abs(pw.x - V.x)));
    road = mix(road, vec3(0.93, 0.80, 0.42), dash * 0.7 * smoothstep(0.012, 0.05, dpt));
    // dusty shoulders blend the road into the plain
    g = mix(g, road, onRoad);
    g = mix(g, vec3(0.88, 0.74, 0.55), (1.0 - onRoad) * exp(-pow((abs(pw.x - V.x) - roadHalf) / (0.01 + dpt * 0.10), 2.0)) * 0.35);
    col = mix(col, g, smoothstep(0.0, 0.004, uv.y - (HN_HZ - 0.004)));
    // mirage: pale sky-coloured pools shiver on the road in the distance
    float mir = smoothstep(0.075, 0.0, dpt) * smoothstep(0.0, 0.006, dpt);
    float streak = smoothstep(0.55, 0.9, hn_noise(vec2(pw.x * 18.0 + wob * 0.6, uv.y * 120.0 - t * 0.9)));
    col += vec3(0.80, 0.90, 1.0) * mir * (0.35 + 0.65 * streak) * 0.26 * (0.4 + 0.6 * onRoad);
    col = mix(col, vec3(1.0, 0.95, 0.84), smoothstep(0.03, 0.0, dpt) * 0.35);
    // short noon shadows are mostly just dark spots under things, handled with the poles
  }

  // ---- telegraph poles marching along the right side of the road, with sagging wires
  {
    float wires = 0.0;
    float poles = 0.0;
    float prevX = 0.0, prevY = 0.0;
    for (int i = 0; i < 9; i++) {
      float d = 0.42 * pow(0.68, float(i));
      float shake = 1.0 + prox * 0.0;
      float baseY = HN_HZ + d;
      float bx = V.x + 0.012 + d * 0.62 + d * 0.38 + 0.0;
      float h = d * 1.15 + 0.012;
      float topY = baseY - h;
      float wdt = 0.0016 + d * 0.016;
      float sx = p.x - bx;
      // pole and cross arm
      poles += hn_seg(p, vec2(bx, baseY + 0.002), vec2(bx, topY), wdt);
      poles += hn_seg(p, vec2(bx - h * 0.22, topY + h * 0.07), vec2(bx + h * 0.22, topY + h * 0.07), wdt * 0.7);
      poles += hn_seg(p, vec2(bx - h * 0.12, topY + h * 0.17), vec2(bx + h * 0.12, topY + h * 0.17), wdt * 0.55);
      // wires from the previous (nearer) pole to this one
      if (i > 0) {
        for (int w = 0; w < 2; w++) {
          float off = (w == 0) ? -0.22 : 0.22;
          float oy = 0.07;
          float pdd = 0.42 * pow(0.68, float(i - 1));
          float ph = pdd * 1.15 + 0.012;
          vec2 a = vec2(V.x + 0.012 + pdd + off * ph, HN_HZ + pdd - ph + oy * ph);
          vec2 b = vec2(bx + off * h, topY + oy * h);
          float u = (p.x - a.x) / (b.x - a.x);
          if (u > 0.0 && u < 1.0) {
            float yl = mix(a.y, b.y, u) + (0.012 + pdd * 0.11) * 4.0 * u * (1.0 - u);
            wires += (1.0 - smoothstep(0.0004 + wdt * 0.12, 0.0010 + wdt * 0.22, abs(p.y - yl))) * 0.8;
          }
        }
      }
      // a dark spot under the pole, the sun is straight overhead
      float spot = exp(-(pow((p.x - bx) / (0.012 + d * 0.06), 2.0) + pow((p.y - baseY - 0.003) / (0.003 + d * 0.012), 2.0)));
      col *= 1.0 - 0.35 * spot;
    }
    vec3 pc = vec3(0.19, 0.12, 0.10);
    float hazeFar = smoothstep(0.50, 0.0, (p.y - HN_HZ)) * 0.5;
    pc = mix(pc, vec3(0.75, 0.62, 0.55), hazeFar * step(HN_HZ, p.y + 0.3));
    col = mix(col, pc, clamp(poles, 0.0, 1.0));
    col = mix(col, pc, clamp(wires, 0.0, 0.7));
  }

  // ---- two vultures circling high up on the left, one smaller (farther)
  {
    vec2 tc = vec2(asp * 0.27, 0.21);
    float a1 = t * 0.20, a2 = t * 0.17 + 2.6;
    vec2 b1 = tc + vec2(cos(a1) * 0.17, sin(a1) * 0.045);
    vec2 b2 = tc + vec2(0.04, -0.03) + vec2(cos(a2) * 0.12, sin(a2) * 0.032);
    float v1 = hn_bird(p, b1, 0.016, sin(t * 1.1) * 0.5 + sin(t * 2.3) * 0.2, sign(-sin(a1) + 0.0001));
    float v2 = hn_bird(p, b2, 0.011, sin(t * 1.4 + 1.0) * 0.5, sign(-sin(a2) + 0.0001));
    col = mix(col, vec3(0.11, 0.09, 0.10), clamp(v1 + v2 * 0.85, 0.0, 1.0));
  }

  // ---- the dust devil: a thin twisting column of dust on the plain, it slowly walks toward the pointer
  {
    vec2 wander = vec2(asp * (0.36 + 0.10 * sin(t * 0.045)), 0.80 + 0.06 * sin(t * 0.032 + 1.0));
    vec2 dpos = wander;
    if (hasM) dpos = mix(wander, vec2(mp.x, clamp(mp.y, HN_HZ + 0.10, 0.95)), 0.65);
    float sc = (dpos.y - HN_HZ);                            // nearness: scale of the whole thing
    float H = 0.26 + 1.0 * sc;
    float f = (dpos.y - p.y) / H;                           // 0 at the ground, 1 at the top
    if (f > -0.15 && f < 1.1) {
      float fc = clamp(f, 0.0, 1.0);
      float sway = 0.35 * H * (sin(f * 3.4 + t * 0.9) * 0.10 + sin(f * 7.0 - t * 1.7) * 0.03) * fc;
      float xc = dpos.x + sway + 0.04 * H * (fc * fc) * sin(t * 0.3);
      float w = (0.012 + 0.125 * pow(fc, 1.1)) * (0.6 + 1.5 * sc);
      float u = (p.x - xc) / max(w, 0.0005);
      // spiral banding that climbs the column
      float spin = sin(fc * 22.0 - t * 4.2 + u * 2.4) * 0.5 + 0.5;
      float body = exp(-u * u * 1.6) * (0.35 + 0.65 * spin) * smoothstep(1.1, 0.7, f) * smoothstep(-0.15, 0.03, f);
      body *= 0.55 + 0.9 * hn_fbm3(vec2(u * 2.0 + t * 0.2, f * 7.0 - t * 0.6));
      body *= mix(1.0, 0.7, fc);                           // thins out toward the top
      vec3 dc = mix(vec3(0.52, 0.34, 0.21), vec3(0.98, 0.84, 0.62), smoothstep(-1.2, 1.2, u + (spin - 0.5) * 1.6) * 0.8 + 0.2 * fc);
      col = mix(col, dc, clamp(body * 1.25, 0.0, 0.88));
    }
    // dust skirt on the ground
    vec2 sq = (p - (dpos + vec2(0.0, 0.004))) / vec2(0.09 * (0.5 + 1.3 * sc) + 0.01, 0.014 * (0.5 + 1.3 * sc) + 0.002);
    float skirt = exp(-dot(sq, sq)) * (0.55 + 0.45 * hn_noise(vec2(p.x * 40.0 - t * 2.0, p.y * 60.0)));
    col = mix(col, vec3(0.86, 0.66, 0.44), clamp(skirt * 0.95, 0.0, 0.85));
    // debris whirling around the column
    for (int j = 0; j < 4; j++) {
      float jf = float(j);
      float fa = fract(t * (0.25 + 0.07 * jf) + jf * 0.27);
      float ang = t * (3.0 + jf) + jf * 1.9;
      vec2 dp = dpos + vec2(cos(ang) * (0.015 + 0.05 * fa) * (0.5 + 1.3 * sc), -fa * H * 0.7 + sin(ang) * 0.004);
      float db = 1.0 - smoothstep(0.0016, 0.0028, length(p - dp));
      col = mix(col, vec3(0.30, 0.20, 0.14), db * (1.0 - fa) * 0.9);
    }
  }

  // ---- the heat: everything is a little bleached, a shimmering band hangs on the horizon, the picture shows faintly through
  col += vec3(1.0, 0.96, 0.84) * prox * (0.10 + 0.05 * wob);
  col = mix(col, vec3(hn_luma(col)), 0.12);
  col *= 0.97 + 0.06 * hn_luma(pic);
  col *= 1.0 - 0.30 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
