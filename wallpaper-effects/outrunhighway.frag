// label: Outrun highway
// hint: a night drive toward a giant striped sun between neon grid mountains, with palms and tail lights streaming past; the pointer pulls the sun's glow toward it and leans the speed streaks
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
float oh_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float oh_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float oh_tri(float x) { return abs(fract(x) - 0.5) * 2.0; }

const float OH_HOR = 0.56;   // horizon line (uv y)
const float OH_SP = 2.6;     // road speed, world units per second
const float OH_K = 1.5;      // screen width of one world unit, per unit of distance below the horizon
const float OH_D = 0.34;     // depth scale: dy = OH_D / z

float oh_ridge(float x, float vx, float ph) {
  float h = 0.030 + 0.075 * oh_tri(x * 1.15 + ph) + 0.040 * oh_tri(x * 2.9 + ph * 1.7) + 0.012 * oh_tri(x * 7.3 + ph * 3.1);
  return h * (0.18 + 0.82 * smoothstep(0.05, 0.85, abs(x - vx)));
}

// neon rimmed palm: x = core coverage, y = rim coverage
vec2 oh_palm(vec2 p, vec2 foot, float h, float lean, float len, float rimW) {
  float aa = 1.1 / res.y;
  vec2 cc = vec2(foot.x + lean * 0.32 * h, foot.y - h);
  float core = 0.0, outer = 0.0;
  // trunk
  float tt = clamp((foot.y - p.y) / h, 0.0, 1.0);
  float tx = foot.x + lean * 0.32 * h * tt * tt;
  float w = (0.030 - 0.014 * tt) * h;
  float dT = abs(p.x - tx);
  float inY = step(p.y, foot.y) * step(foot.y - h, p.y);
  core = smoothstep(w + aa, w - aa, dT) * inY;
  outer = smoothstep(w + rimW + aa, w + rimW - aa, dT) * inY;
  // fronds: four elevations on each side, tips droop
  vec2 q = p - cc;
  for (int k = 0; k < 4; k++) {
    float e = k == 0 ? 1.5 : (k == 1 ? 0.95 : (k == 2 ? 0.40 : -0.10));
    float lk = len * (k == 0 ? 0.60 : 1.0);
    for (int j = 0; j < 2; j++) {
      float sj = j == 0 ? -1.0 : 1.0;
      float u = q.x * sj / lk;
      if (u > 0.0 && u < 1.0) {
        float yv = -lk * (e * u - 0.95 * u * u);
        float wd = lk * (0.075 * (1.0 - u) + 0.012) * (0.82 + 0.18 * sin(u * 48.0));
        float d = abs(q.y - yv) * 0.85;
        core = max(core, smoothstep(wd + aa, wd - aa, d));
        outer = max(outer, smoothstep(wd + rimW + aa, wd + rimW - aa, d));
      }
    }
  }
  return vec2(core, outer);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);
  float pl = oh_luma(pic);
  float hor = OH_HOR;
  vec2 vp = vec2(asp * 0.5, hor);
  vec2 sc = vec2(asp * 0.5, 0.355);
  float sr = 0.20;
  // the sun's glow leans toward the pointer
  vec2 gc = onScr ? sc + clamp((mp - sc) * 0.42, vec2(-0.55, -0.22), vec2(0.55, 0.22)) : sc;
  vec3 sunCol = vec3(1.0, 0.36, 0.46);
  vec3 cyan = vec3(0.10, 0.85, 1.0);
  vec3 pink = vec3(1.0, 0.16, 0.70);
  float dy = p.y - hor;
  vec3 col;

  if (dy <= 0.0) {
    // ---- sky
    float k = clamp((hor - p.y) / hor, 0.0, 1.0);
    col = mix(vec3(1.0, 0.50, 0.22), vec3(0.95, 0.16, 0.50), smoothstep(0.0, 0.14, k));
    col = mix(col, vec3(0.32, 0.04, 0.46), smoothstep(0.10, 0.55, k));
    col = mix(col, vec3(0.03, 0.0, 0.11), smoothstep(0.45, 1.0, k));
    col += pic * 0.05;
    // stars
    vec2 sg = p * 64.0;
    vec2 cid = floor(sg);
    float hs = oh_hash(cid);
    vec2 fp = fract(sg) - 0.2 - 0.6 * vec2(oh_hash(cid + 1.3), oh_hash(cid + 7.7));
    float star = smoothstep(0.10, 0.0, length(fp)) * step(0.972, hs);
    col += vec3(0.8, 0.85, 1.0) * star * smoothstep(0.38, 0.75, k) * (0.45 + 0.55 * sin(t * 1.7 + hs * 60.0));

    // sun glow, shifted toward the pointer
    float dg = length(p - gc);
    col += sunCol * (exp(-dg * 3.0) * 0.40 + exp(-dg * dg * 48.0) * 0.45);
    // striped sun disc
    vec2 q = p - sc;
    float r = length(q);
    float disc = smoothstep(sr, sr - 0.0015, r);
    float vv = (p.y - (sc.y - sr)) / (2.0 * sr);
    float s = (vv - 0.46) / 0.54;
    float band = fract(vv * 9.0 - t * 0.02);
    float cut = s > 0.0 ? step(band, 0.05 + 0.60 * s) : 0.0;
    vec3 dcol = mix(vec3(1.0, 0.93, 0.40), vec3(1.0, 0.30, 0.38), smoothstep(0.08, 0.95, vv));
    dcol += vec3(1.0, 0.72, 0.45) * exp(-dot(p - gc, p - gc) * 28.0) * 0.38;
    col += sunCol * exp(-abs(r - sr) * 42.0) * 0.30;
    col = mix(col, dcol, disc * (1.0 - cut));
    col *= 1.0 - 0.60 * cut * disc;

    // two ranges of low-poly grid mountains
    for (int n = 0; n < 2; n++) {
      float nf = float(n);
      float scl = mix(0.95, 1.55, nf);
      float amp = mix(1.35, 0.95, nf);
      float ridgeY = hor - amp * oh_ridge(p.x * scl, vp.x * scl, 0.30 + 2.2 * nf);
      float body = smoothstep(-0.0012, 0.0012, p.y - ridgeY);
      float dd = max(p.y - ridgeY, 0.0);
      vec3 edgeC = mix(pink, cyan, nf);
      vec3 mc = mix(vec3(0.07, 0.0, 0.15), vec3(0.03, 0.0, 0.08), nf);
      mc += vec3(0.55, 0.08, 0.38) * smoothstep(0.10, 0.0, hor - p.y) * (0.5 - 0.2 * nf);
      mc += sunCol * 0.10 * exp(-length(p - gc) * 2.2) * (1.0 - 0.4 * nf);
      float gx = abs(fract((p.x - vp.x) / 0.075 + 0.5) - 0.5) * 0.075;
      float gy = abs(fract((hor - p.y) / 0.024) - 0.5) * 0.024;
      float ln = max(smoothstep(0.0016, 0.0004, gx), smoothstep(0.0016, 0.0004, gy));
      float fade = 0.25 + 0.75 * smoothstep(0.0, 0.10, hor - p.y);
      vec3 mcol = mc + edgeC * ln * 0.55 * fade * smoothstep(0.0, 0.01, dd);
      col = mix(col, mcol, body);
      float er = abs(p.y - ridgeY);
      col += edgeC * (exp(-er / 0.0022) * 0.95 + exp(-er / 0.014) * 0.22 * (p.y < ridgeY ? 1.0 : 0.5));
    }
  } else {
    // ---- ground: neon grid plane with the highway on it
    float dyc = max(dy, 0.0008);
    float z = OH_D / dyc;
    float X = (p.x - vp.x) / (OH_K * dyc);
    float hz = exp(-dy / 0.07);
    col = mix(vec3(0.035, 0.0, 0.085), vec3(0.50, 0.07, 0.38), hz * 0.85);
    float aaX = 1.0 / (res.y * OH_K * dyc);
    float aaZ = (1.0 / res.y) * OH_D / (dyc * dyc);
    float far = smoothstep(0.0, 0.03, dy);
    float roadM = smoothstep(1.02, 0.98, abs(X));

    // grid off the road
    float dX = (0.5 - abs(fract(X * 0.5) - 0.5)) * 2.0;
    float wX = 0.014 + aaX * 1.2;
    float lX = smoothstep(wX, wX * 0.35, dX) * (0.014 / wX);
    float dZ = (0.5 - abs(fract((z + t * OH_SP) / 2.0) - 0.5)) * 2.0;
    float wZ = 0.014 + aaZ * 1.2;
    float lZ = smoothstep(wZ, wZ * 0.35, dZ) * (0.014 / wZ);
    float grid = max(lX, lZ) * far * (1.0 - roadM);
    col += mix(pink, vec3(0.75, 0.2, 1.0), smoothstep(0.0, 6.0, abs(X) - 2.0)) * grid * (0.55 * (1.0 - hz * 0.55));

    // asphalt
    vec3 road = vec3(0.020, 0.014, 0.042) + vec3(0.02, 0.006, 0.03) * hz;
    col = mix(col, road, roadM);
    // dashed lane lines
    float dash = step(fract((z + t * OH_SP) / 3.0), 0.42);
    dash = mix(dash, 0.42, smoothstep(8.0, 16.0, z));
    float dl = abs(abs(X) - 0.333);
    float wl = 0.018 + aaX * 1.1;
    col += vec3(0.95, 0.88, 1.0) * smoothstep(wl, wl * 0.4, dl) * (0.018 / wl) * dash * roadM * far * 0.75;
    // solid edge lines with glow: cyan on the left, pink on the right
    float de = abs(abs(X) - 1.0);
    vec3 ec = X < 0.0 ? cyan : pink;
    float we = 0.030 + aaX * 1.1;
    col += mix(ec, vec3(1.0), 0.5) * smoothstep(we, we * 0.4, de) * (0.030 / we) * far * 0.9;
    col += ec * exp(-de / 0.07) * 0.34 * far * (1.0 - 0.6 * hz);
    // the sun mirrored on the asphalt, shimmering
    float rcol = exp(-pow((p.x - gc.x) / (0.03 + 0.55 * dy), 2.0));
    float shim = 0.68 + 0.32 * sin(z * 4.5 + t * 3.0) * smoothstep(40.0, 10.0, z);
    col += sunCol * rcol * shim * exp(-dy / 0.16) * (0.20 + 0.45 * roadM);
  }

  // glowing band along the horizon
  float hb = exp(-abs(p.y - hor) / 0.012);
  col += vec3(1.0, 0.45, 0.30) * hb * (0.35 + 0.55 * exp(-pow((p.x - gc.x) / 0.55, 2.0)));

  // ---- speed streaks fanning out from a point that leans toward the pointer
  vec2 so = vec2(vp.x, hor - 0.02);
  if (onScr) so += vec2(clamp((mp.x - vp.x) * 0.38, -0.65, 0.65), clamp((mp.y - hor) * 0.12, -0.08, 0.08));
  vec2 sq = p - so;
  float srad = length(sq);
  float cellA = (atan(sq.y, sq.x) / 6.2831853 + 0.5) * 120.0;
  float ca = floor(cellA);
  float h1 = oh_hash(vec2(ca, 4.0));
  float h2 = oh_hash(vec2(ca, 9.0));
  float h3 = oh_hash(vec2(ca, 15.0));
  float sph = fract(log(srad + 0.03) * 1.3 - t * (0.30 + 0.35 * h2) + h1);
  float seg = smoothstep(0.0, 0.03, sph) * smoothstep(0.17, 0.09, sph);
  float perp = abs(fract(cellA) - 0.5) * srad * 6.2831853 / 120.0;
  float wlin = 0.0007 + 0.0016 * srad;
  float streak = smoothstep(wlin, wlin * 0.3, perp) * seg * step(0.70, h3);
  streak *= smoothstep(0.14, 0.38, srad) * smoothstep(1.5, 0.75, srad);
  col += mix(vec3(0.75, 0.95, 1.0), vec3(1.0, 0.65, 0.95), h2) * streak * 0.32;

  // ---- a few cars ahead: dark shape, two red tail lights, glow on the asphalt
  for (int j = 0; j < 4; j++) {
    float jf = float(j);
    float cz = 4.2 + 3.4 * jf + 1.2 * sin(t * 0.13 + jf * 2.3);
    float cx = fract(jf * 0.37 + 0.15) * 1.5 - 0.75;
    float cdy = OH_D / cz;
    float u = OH_K * cdy;
    vec2 foot = vec2(vp.x + cx * u, hor + cdy);
    vec2 b = p - (foot - vec2(0.0, 0.40 * u));
    float sdb = max(abs(b.x) / (0.80 * u), abs(b.y) / (0.42 * u));
    float cov = smoothstep(1.0, 0.82, sdb);
    col = mix(col, vec3(0.012, 0.0, 0.03) + vec3(0.25, 0.04, 0.18) * smoothstep(0.55, 0.0, hor - p.y) * 0.3, cov * 0.92);
    float brake = j == 2 ? 0.65 + 0.35 * smoothstep(0.2, 0.9, 0.5 + 0.5 * sin(t * 0.5)) : 0.85;
    float rr = 0.10 * u + 0.0018;
    vec2 ld = vec2(abs(p.x - foot.x) - 0.62 * u, p.y - (foot.y - 0.42 * u));
    float dl2 = length(ld);
    col += vec3(1.0, 0.07, 0.10) * (exp(-dl2 * dl2 / (rr * rr)) * 1.3 + exp(-dl2 / (rr * 5.0)) * 0.22) * brake;
    float below = p.y - foot.y;
    if (below > 0.0) {
      float rx = abs(p.x - foot.x) - 0.62 * u;
      col += vec3(1.0, 0.05, 0.10) * exp(-below / (0.9 * u)) * exp(-rx * rx / (0.30 * u * 0.30 * u)) * 0.30 * brake;
    }
  }

  // ---- palms rushing past on both sides, rimmed in neon
  for (int sd = 0; sd < 2; sd++) {
    float sg2 = sd == 0 ? -1.0 : 1.0;
    for (int i = 0; i < 5; i++) {
      float mm = float(i) * 4.0 + (sd == 0 ? 0.0 : 2.0) - t * OH_SP;
      float cyc = floor(mm / 20.0);
      float z2 = 1.0 + mm - cyc * 20.0;
      float hs1 = oh_hash(vec2(cyc + float(i) * 7.3, float(sd) * 3.1 + 1.0));
      float hs2 = oh_hash(vec2(float(i) * 3.7, cyc * 2.9 + float(sd) * 5.0));
      float X2 = sg2 * (2.3 + 0.9 * hs2);
      float dyf = OH_D / z2;
      vec2 foot = vec2(vp.x + X2 * OH_K * dyf, hor + dyf);
      float u2 = OH_K * dyf;
      float h = (2.3 + 1.2 * hs1) * u2;
      float len = (1.7 + 0.5 * hs2) * u2;
      float lean = -sg2 * (0.22 + 0.35 * hs1);
      float midx = foot.x + lean * 0.16 * h;
      if (abs(p.x - midx) < len * 1.15 + 0.5 * abs(lean) * 0.32 * h + 0.01 && p.y < foot.y + 0.004 && p.y > foot.y - h - len) {
        vec2 cv = oh_palm(p, foot, h, lean, len, 0.0030 + 0.0045 * u2);
        float fogp = smoothstep(5.0, 21.0, z2);
        float vis = smoothstep(21.0, 17.0, z2);
        vec3 pc = mix(vec3(0.010, 0.0, 0.030), vec3(0.45, 0.07, 0.34), fogp * 0.8);
        vec3 rim = mix(pink, cyan, sd == 0 ? 1.0 : 0.0);
        col += rim * max(cv.y - cv.x, 0.0) * 0.55 * vis;
        col = mix(col, pc, cv.x * vis);
      }
    }
  }

  // the picture stays faintly present, vignette closes the corners
  col *= 0.94 + 0.12 * pl;
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
