// label: Polygon drift
// hint: a few small flat-shaded low-poly shapes in four console colours (a diamond, a pyramid, a cube) turn slowly over your picture with wobbly, grid-snapped corners; a faint rainbow disc sheen sweeps across like light on a disc, and sparse square dust floats by. The shapes tilt and turn toward the pointer. Calm, your picture stays the wallpaper
// category: Retro machines
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

float dp_h(float n) { return fract(sin(n * 127.1 + 17.3) * 43758.5453); }

// the four logo-like colours, slightly softened so they sit calmly on any picture
vec3 dp_pal(float h) {
  vec3 r = vec3(0.90, 0.07, 0.10);
  vec3 y = vec3(0.98, 0.80, 0.10);
  vec3 g = vec3(0.05, 0.64, 0.30);
  vec3 b = vec3(0.04, 0.45, 0.74);
  h = fract(h) * 4.0;
  if (h < 1.0) return mix(r, y, smoothstep(0.0, 1.0, h));
  if (h < 2.0) return mix(y, g, smoothstep(0.0, 1.0, h - 1.0));
  if (h < 3.0) return mix(g, b, smoothstep(0.0, 1.0, h - 2.0));
  return mix(b, r, smoothstep(0.0, 1.0, h - 3.0));
}

// 4x4 ordered dither value 0..1 for a screen pixel (no tables)
float dp_b2(vec2 q) { return 2.0 * q.x + 3.0 * q.y - 4.0 * q.x * q.y; }
float dp_bayer(vec2 ip) {
  vec2 a = mod(ip, 2.0);
  vec2 b = floor(mod(ip, 4.0) * 0.5);
  return (dp_b2(a) * 4.0 + dp_b2(b) + 0.5) / 16.0;
}

// the shapes: x, y (screen fractions), size (fraction of height), kind (0 diamond, 1 pyramid, 2 cube)
vec4 dp_a(int i) {
  if (i == 0) return vec4(0.865, 0.205, 0.036, 0.0);
  if (i == 1) return vec4(0.115, 0.725, 0.040, 1.0);
  if (i == 2) return vec4(0.775, 0.790, 0.031, 2.0);
  if (i == 3) return vec4(0.205, 0.245, 0.027, 0.0);
  return vec4(0.585, 0.105, 0.023, 1.0);
}
vec3 dp_c(int i) {
  if (i == 0) return vec3(0.04, 0.45, 0.74);
  if (i == 1) return vec3(0.90, 0.07, 0.10);
  if (i == 2) return vec3(0.98, 0.80, 0.10);
  if (i == 3) return vec3(0.05, 0.64, 0.30);
  return vec3(0.90, 0.07, 0.10);
}
vec3 dp_s(int i) { // phase, spin (rad/s), bob phase
  if (i == 0) return vec3(0.4, 0.17, 1.3);
  if (i == 1) return vec3(2.1, -0.14, 4.0);
  if (i == 2) return vec3(3.6, 0.19, 2.2);
  if (i == 3) return vec3(5.2, -0.21, 5.5);
  return vec3(1.0, 0.13, 0.7);
}

// per-object globals (set before drawing the shape)
float dp_cy; float dp_sy; float dp_cp; float dp_sp; float dp_sz; float dp_snap; float dp_ph;
vec3 dp_L; vec3 dp_Lg;

// rotate, scale, wobble a little and snap to a coarse grid, like a console that rounds its vertices
vec3 dp_v(vec3 v) {
  float x1 = dp_cy * v.x + dp_sy * v.z;
  float z1 = -dp_sy * v.x + dp_cy * v.z;
  float y2 = dp_cp * v.y - dp_sp * z1;
  float z2 = dp_sp * v.y + dp_cp * z1;
  vec3 r = vec3(x1, -y2, z2) * dp_sz;
  float k = dot(v, vec3(12.9, 78.2, 37.7)) + dp_ph;
  r.xy += dp_sz * 0.040 * vec2(sin(time * 1.3 + k), cos(time * 1.1 + k * 1.7));
  r.xy = floor(r.xy / dp_snap + 0.5) * dp_snap;
  return r;
}

// one flat-shaded triangle: premultiplied colour, only if it faces the viewer
vec4 dp_tri(vec2 q, vec3 a0, vec3 b0, vec3 c0, vec3 base, float pw, float hue) {
  vec3 a = dp_v(a0), b = dp_v(b0), c = dp_v(c0);
  vec3 n = cross(b - a, c - a);
  vec3 ctr = (a + b + c) * 0.3333;
  if (dot(n, ctr) < 0.0) n = -n;
  if (n.z <= 0.0) return vec4(0.0);
  n = normalize(n);
  vec2 ab = b.xy - a.xy, bc = c.xy - b.xy, ca = a.xy - c.xy;
  float area = ab.x * (c.y - a.y) - ab.y * (c.x - a.x);
  float sg = area > 0.0 ? 1.0 : -1.0;
  float d0 = sg * (ab.x * (q.y - a.y) - ab.y * (q.x - a.x)) / max(length(ab), 1e-5);
  float d1 = sg * (bc.x * (q.y - b.y) - bc.y * (q.x - b.x)) / max(length(bc), 1e-5);
  float d2 = sg * (ca.x * (q.y - c.y) - ca.y * (q.x - c.x)) / max(length(ca), 1e-5);
  float cov = clamp((min(d0, min(d1, d2)) + 0.5 * pw) / pw, 0.0, 1.0);
  if (cov <= 0.0) return vec4(0.0);
  float lam = max(dot(n, dp_L), 0.0);
  vec3 col = base * (0.32 + 0.78 * lam);
  float sp = pow(max(dot(n, dp_Lg), 0.0), 14.0);
  col += dp_pal(hue + n.x * 0.3 + n.y * 0.2) * sp * 0.45;
  col = mix(col, vec3(dot(col, vec3(0.33))), 0.12);
  return vec4(col * cov, cov);
}

vec4 dp_over(vec4 acc, vec4 f) { return vec4(acc.rgb * (1.0 - f.a) + f.rgb, acc.a + f.a * (1.0 - acc.a)); }

vec4 dp_diamond(vec2 q, vec3 base, float pw, float hue) {
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float sx = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0;
    float sy = mod(floor(fi * 0.5), 2.0) < 1.0 ? 1.0 : -1.0;
    float sz = fi < 4.0 ? 1.0 : -1.0;
    acc = dp_over(acc, dp_tri(q, vec3(0.78 * sx, 0.0, 0.0), vec3(0.0, 1.28 * sy, 0.0), vec3(0.0, 0.0, 0.78 * sz), base, pw, hue));
  }
  return acc;
}

vec4 dp_pyramid(vec2 q, vec3 base, float pw, float hue) {
  vec4 acc = vec4(0.0);
  vec3 apex = vec3(0.0, 1.05, 0.0);
  for (int i = 0; i < 4; i++) {
    float a0 = float(i) * 1.5708 + 0.7854;
    float a1 = a0 + 1.5708;
    vec3 p0 = vec3(cos(a0) * 1.0, -0.62, sin(a0) * 1.0);
    vec3 p1 = vec3(cos(a1) * 1.0, -0.62, sin(a1) * 1.0);
    acc = dp_over(acc, dp_tri(q, apex, p0, p1, base, pw, hue));
  }
  vec3 b0 = vec3(1.0, -0.62, 0.0), b1 = vec3(0.0, -0.62, 1.0), b2 = vec3(-1.0, -0.62, 0.0), b3 = vec3(0.0, -0.62, -1.0);
  acc = dp_over(acc, dp_tri(q, b0, b1, b2, base, pw, hue));
  acc = dp_over(acc, dp_tri(q, b0, b2, b3, base, pw, hue));
  return acc;
}

vec4 dp_cube(vec2 q, vec3 base, float pw, float hue) {
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float s = mod(fi, 2.0) < 1.0 ? 0.72 : -0.72;
    vec3 n3, u3, v3;
    if (i < 2) { n3 = vec3(s, 0.0, 0.0); u3 = vec3(0.0, 0.72, 0.0); v3 = vec3(0.0, 0.0, 0.72); }
    else if (i < 4) { n3 = vec3(0.0, s, 0.0); u3 = vec3(0.0, 0.0, 0.72); v3 = vec3(0.72, 0.0, 0.0); }
    else { n3 = vec3(0.0, 0.0, s); u3 = vec3(0.72, 0.0, 0.0); v3 = vec3(0.0, 0.72, 0.0); }
    acc = dp_over(acc, dp_tri(q, n3 + u3 + v3, n3 - u3 + v3, n3 - u3 - v3, base, pw, hue));
    acc = dp_over(acc, dp_tri(q, n3 + u3 + v3, n3 - u3 - v3, n3 + u3 - v3, base, pw, hue));
  }
  return acc;
}

vec4 fxMain(vec2 mpx) {
  float asp = res.x / res.y;
  vec2 uv = qt_TexCoord0;
  vec2 p = vec2(uv.x * asp, uv.y);
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? vec2(mpx.x / res.y, mpx.y / res.y) : vec2(-10.0);
  vec2 par = has ? (vec2(mpx.x / res.x, mpx.y / res.y) - vec2(0.5, 0.5)) : vec2(0.0);
  float t = time;
  float pw = 1.0 / res.y;
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  // ---- a faint rainbow disc sheen: wedges of light sweeping round a far centre, quantised like a 15-bit picture ----
  vec2 sc = vec2((0.50 + par.x * 0.06) * asp, 1.40 + par.y * 0.05);
  vec2 sd = p - sc;
  float sr = length(sd);
  float sa = atan(sd.y, sd.x);
  float wedge = 0.5 + 0.5 * cos(sa * 7.0 - t * 0.09 - par.x * 0.8);
  wedge = pow(wedge, 4.0) * (0.55 + 0.45 * sin(sa * 3.0 + t * 0.05));
  float ring = smoothstep(0.45, 0.85, sr) * smoothstep(2.2, 1.2, sr);
  float sheen = wedge * ring;
  sheen = floor(sheen * 14.0 + dp_bayer(floor(uv * res))) / 14.0;
  vec3 sheenCol = dp_pal(sr * 0.55 + sa * 0.45 + t * 0.008);
  vec3 sh = sheenCol * sheen * 0.24 * (1.0 - 0.45 * lum0);
  col = vec3(1.0) - (vec3(1.0) - col) * (vec3(1.0) - sh);

  // ---- the shapes ----
  dp_L = normalize(vec3(-0.45, -0.60, 0.66));
  for (int i = 0; i < 5; i++) {
    vec4 A = dp_a(i);
    vec3 S = dp_s(i);
    vec2 cen = vec2(A.x * asp, A.y);
    cen += vec2(0.010 * sin(t * 0.050 + S.x), 0.012 * sin(t * 0.063 + S.z));
    cen += par * 0.020 * vec2(asp, 1.0) * (A.z * 18.0);
    vec2 q = p - cen;
    float sz = A.z;
    if (dot(q, q) < sz * sz * 2.9) {
      // turn toward the pointer: a nudge in yaw and pitch, strongest when it is near
      vec2 dm = has ? (mp - cen) : vec2(0.0);
      float near = has ? (0.45 + 0.55 * exp(-length(dm) * 1.6)) : 0.0;
      float yaw = t * S.y + S.x + 0.9 * clamp(dm.x * 2.5, -1.0, 1.0) * near;
      float pit = 0.38 + 0.12 * sin(t * 0.11 + S.z) + 0.55 * clamp(-dm.y * 2.5, -1.0, 1.0) * near;
      dp_cy = cos(yaw); dp_sy = sin(yaw); dp_cp = cos(pit); dp_sp = sin(pit);
      dp_sz = sz; dp_snap = sz / 11.0; dp_ph = S.x * 3.0;
      dp_Lg = normalize(vec3(0.9 * sin(t * 0.22 + S.x), 0.6 * cos(t * 0.17 + S.z), 0.8));
      vec3 base = dp_c(i);
      vec4 o;
      if (A.w < 0.5) o = dp_diamond(q, base, pw, S.x);
      else if (A.w < 1.5) o = dp_pyramid(q, base, pw, S.x);
      else o = dp_cube(q, base, pw, S.x);
      // a soft ink shade behind keeps the shapes readable on bright pictures
      col *= 1.0 - 0.13 * exp(-dot(q, q) / (sz * sz * 1.6));
      if (o.a > 0.0) col = mix(col, o.rgb / o.a, o.a * 0.80);
    }
  }

  // ---- sparse square dust, drifting up and across, snapped to a coarse grid ----
  for (int k = 0; k < 14; k++) {
    float fk = float(k);
    float spd = 0.010 + 0.012 * dp_h(fk + 3.0);
    float ph = t * spd + dp_h(fk * 5.7);
    float seed = floor(ph) + fk * 13.0;
    float life = fract(ph);
    vec2 dpos = vec2((0.03 + 0.94 * dp_h(seed + 1.0)) * asp + 0.03 * sin(life * 6.0 + fk), 1.04 - life * 1.08);
    vec2 dd = dpos - mp;
    float dl = length(dd);
    dpos += dd / (dl + 0.05) * 0.04 * exp(-pow(dl / 0.16, 2.0));
    float g = res.y * 0.5;
    dpos = floor(dpos * g + 0.5) / g;
    float r = (1.0 + 0.8 * dp_h(seed + 4.0)) * pw;
    vec2 e = abs(p - dpos);
    float a = step(max(e.x, e.y), r);
    float tw = 0.55 + 0.45 * sin(t * (0.6 + dp_h(seed + 6.0)) + fk * 3.1);
    float fade = smoothstep(0.0, 0.10, life) * smoothstep(1.0, 0.85, life);
    vec3 dc = mix(vec3(0.82, 0.86, 0.92), dp_pal(dp_h(seed + 8.0)), 0.55);
    col = mix(col, dc, a * tw * fade * 0.55);
  }

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
