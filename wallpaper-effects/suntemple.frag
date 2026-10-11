// label: Temple of the Sun
// hint: a stepped sun temple at sunrise, gold light on its stairs, incense smoke from two braziers, birds crossing the sun and mist in the valley; the smoke bends toward the pointer and the steps glow brighter near it
// category: Ancient worlds
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
float st_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float st_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(st_hash(i), st_hash(i + vec2(1, 0)), f.x), mix(st_hash(i + vec2(0, 1)), st_hash(i + vec2(1, 1)), f.x), f.y);
}
float st_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * st_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float st_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * st_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float st_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  vec2 sunP = vec2(0.27 * asp, 0.40);
  float cx = 0.68 * asp;
  float yb = 0.80;
  float th = 0.046;

  // ---- sky: violet to rose to gold, low sun with soft rays and a few warm streak clouds
  vec3 col = mix(vec3(0.22, 0.19, 0.40), vec3(0.88, 0.48, 0.47), smoothstep(0.0, 0.62, uv.y));
  col = mix(col, vec3(1.0, 0.80, 0.48), smoothstep(0.42, 0.74, uv.y));
  float streak = st_fbm(vec2(p.x * 1.4 - t * 0.008, uv.y * 11.0));
  col = mix(col, mix(vec3(1.0, 0.62, 0.52), vec3(1.0, 0.86, 0.62), smoothstep(0.1, 0.55, uv.y)), smoothstep(0.52, 0.80, streak) * 0.40 * smoothstep(0.02, 0.2, uv.y) * (1.0 - smoothstep(0.35, 0.62, uv.y)));
  vec2 ds = p - sunP;
  float dd = length(ds);
  float ang = atan(ds.y, ds.x);
  float rays = 0.5 + 0.5 * sin(ang * 11.0 + st_noise(vec2(ang * 3.0, 0.3)) * 5.0 + t * 0.03);
  col += vec3(1.0, 0.72, 0.36) * exp(-dd * dd / 0.05) * 0.50;
  col += vec3(1.0, 0.84, 0.54) * exp(-dd * dd / 0.006) * 0.55;
  col += vec3(1.0, 0.80, 0.50) * pow(rays, 3.0) * exp(-dd * 1.7) * 0.15 * smoothstep(0.04, 0.2, dd);
  float discA = smoothstep(0.050, 0.044, dd);
  col = mix(col, vec3(1.0, 0.96, 0.84), discA);

  // ---- birds crossing the sun: five small flapping V shapes in a loose flock
  float birds = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float run = fract(t * 0.012 + 0.036 * fi + 0.05);
    vec2 bp = vec2(asp * (-0.05 + 1.10 * run), 0.385 + 0.045 * sin(fi * 2.3 + 1.0) + 0.010 * sin(t * 0.7 + fi * 1.9));
    float sz = 0.017 * (0.8 + 0.4 * st_hash(vec2(fi, 3.0)));
    vec2 d = (p - bp) / sz;
    float flap = 0.55 * sin(t * 5.0 + fi * 2.1);
    float yv = abs(d.x) * (0.45 + flap) - 0.35 * d.x * d.x * 0.0 - 0.0;
    float line = smoothstep(0.20, 0.04, abs(d.y + yv - 0.35)) * smoothstep(1.25, 0.9, abs(d.x));
    birds = max(birds, line);
  }

  // ---- far ridges
  float r1 = 0.53 + 0.12 * st_fbm3(vec2(p.x * 1.5 + 3.0, 1.0));
  float r2 = 0.60 + 0.11 * st_fbm3(vec2(p.x * 2.1 + 9.0, 4.0));
  vec3 hz = vec3(1.0, 0.80, 0.52);
  col = mix(col, mix(hz, vec3(0.52, 0.38, 0.54), 0.62), smoothstep(r1 - 0.002, r1 + 0.002, uv.y));
  col = mix(col, vec3(0.36, 0.28, 0.40) + vec3(0.30, 0.16, 0.06) * exp(-dd * 2.2), smoothstep(r2 - 0.002, r2 + 0.002, uv.y));
  col = mix(col, vec3(0.04, 0.03, 0.06), birds * (1.0 - smoothstep(r1, r1 + 0.01, uv.y)) * 0.85);

  // ---- valley mist between ridges and temple hill
  float mA = smoothstep(0.36, 0.72, st_fbm(vec2(p.x * 1.7 - t * 0.018, uv.y * 7.0 + 2.0))) * exp(-pow((uv.y - 0.72) / 0.10, 2.0));
  col = mix(col, vec3(1.0, 0.82, 0.66), clamp(mA * 0.90, 0.0, 0.9));
  float mC = smoothstep(0.40, 0.75, st_fbm(vec2(p.x * 2.6 + t * 0.012, uv.y * 9.0 + 11.0))) * exp(-pow((uv.y - 0.625) / 0.045, 2.0));
  col = mix(col, vec3(1.0, 0.78, 0.62), clamp(mC * 0.55, 0.0, 0.6));

  // ---- the stepped temple: eight tiers, a central stair, a small shrine, two braziers
  float gp = hasM ? exp(-dot(p - mp, p - mp) / 0.045) : 0.0;
  float hh = (yb - uv.y) / th;
  float dx = p.x - cx;
  vec3 stone = vec3(0.64, 0.40, 0.30);
  float tmask = 0.0;
  vec3 tcol = vec3(0.0);
  if (hh > 0.0 && hh < 8.0) {
    float k = floor(hh);
    float f = fract(hh);
    float hw = 0.275 - 0.022 * k;
    if (abs(dx) < hw) {
      float L = clamp(0.62 - 0.40 * dx / hw, 0.15, 1.0);
      float blocks = 0.86 + 0.26 * st_noise(vec2(p.x * 70.0, k * 9.0 + floor(f * 3.0) * 3.0));
      if (f > 0.84) {
        tcol = vec3(1.0, 0.78, 0.46) * (0.45 + 0.55 * L) * (1.0 - 0.45 * smoothstep(0.90, 1.0, f));
      } else {
        tcol = stone * (0.26 + 0.95 * L) * blocks * vec3(1.0, 0.92, 0.86);
        tcol *= 0.78 + 0.22 * smoothstep(0.0, 0.25, f);
        tcol += vec3(1.0, 0.62, 0.28) * 0.14 * smoothstep(hw * 0.7, hw, -dx) ;
      }
      tmask = 1.0;
      float sw = 0.050 - 0.0016 * k;
      if (abs(dx) < sw + 0.006) {
        float s = fract(hh * 4.0);
        vec3 tread = vec3(1.0, 0.80, 0.44) * (0.88 + 0.12 * sin(t * 0.4));
        vec3 riser = vec3(0.50, 0.24, 0.17);
        vec3 st = mix(riser, tread, smoothstep(0.30, 0.50, s));
        float edge = smoothstep(sw, sw + 0.006, abs(dx));
        tcol = mix(st, tcol * 0.55, edge);
      }
      tcol *= 1.0 + 0.22 * gp;
      tcol += vec3(0.90, 0.58, 0.20) * gp * 0.30 * (abs(dx) < 0.062 ? 1.0 : 0.35);
    }
  }
  // shrine
  {
    float sy = yb - 8.0 * th;
    vec2 q = vec2(abs(dx), uv.y - sy);
    float body = step(q.x, 0.054) * step(-0.050, q.y) * step(q.y, 0.0);
    float comb = step(q.x, 0.040 - (sy - 0.050 - uv.y) * 0.8) * step(uv.y, sy - 0.050) * step(sy - 0.078, uv.y);
    float roof = step(q.x, 0.062) * step(sy - 0.058, uv.y) * step(uv.y, sy - 0.050);
    float door = step(q.x, 0.015) * step(-0.034, q.y) * step(q.y, 0.0);
    float L2 = clamp(0.62 - 0.40 * dx / 0.06, 0.2, 1.0);
    vec3 sh = stone * (0.30 + 0.95 * L2) * (0.9 + 0.2 * st_noise(p * 80.0));
    vec3 inner = mix(vec3(0.10, 0.05, 0.05), vec3(1.0, 0.58, 0.22), 0.55 + 0.25 * sin(t * 2.3) * 0.5 + 0.15 * (1.0 - q.y * -30.0));
    float sa = max(max(body, comb), roof);
    if (sa > 0.0) { tcol = sh; tmask = 1.0; }
    if (roof > 0.0) { tcol = vec3(1.0, 0.74, 0.42) * (0.5 + 0.5 * L2); }
    if (door > 0.0) { tcol = inner * (1.0 + 0.3 * gp); }
    // brazier bowls and flames
    for (int i = 0; i < 2; i++) {
      float sg = i == 0 ? -1.0 : 1.0;
      vec2 b = p - vec2(cx + sg * 0.092, sy);
      float bowl = step(abs(b.x), 0.011 - max(0.0, -b.y) * 0.0) * step(-0.011, b.y) * step(b.y, 0.0);
      if (bowl > 0.0) { tcol = vec3(0.30, 0.15, 0.10) + vec3(0.8, 0.45, 0.15) * smoothstep(-0.006, -0.011, b.y); tmask = 1.0; }
      float fl = exp(-(b.x * b.x / 0.00004 + pow((b.y + 0.020 + 0.002 * sin(t * 9.0 + float(i) * 3.0)) / 0.014, 2.0)));
      tcol += vec3(1.0, 0.55, 0.18) * fl * 0.9;
      tmask = max(tmask, step(0.15, fl));
      col += vec3(1.0, 0.55, 0.2) * exp(-dot(b - vec2(0.0, -0.02), b - vec2(0.0, -0.02)) / 0.0018) * 0.25;
    }
  }
  col = mix(col, tcol, tmask);

  // ---- incense smoke: two thin plumes that lean toward the pointer
  float smk = 0.0;
  for (int i = 0; i < 2; i++) {
    float sg = i == 0 ? -1.0 : 1.0;
    float fi = float(i);
    vec2 b0 = vec2(cx + sg * 0.092, yb - 8.0 * th - 0.030);
    float r = b0.y - p.y;
    if (r > 0.0 && r < 0.36) {
      float u = r / 0.36;
      float sway = 0.011 * sin(r * 24.0 - t * 1.1 + fi * 2.4) * u + 0.013 * sin(r * 9.0 - t * 0.5 + fi) * u;
      float toM = hasM ? clamp((mp.x - b0.x) * 0.55, -0.55, 0.55) : 0.04;
      float x0 = b0.x + sway + toM * pow(u, 1.6);
      float dxs = p.x - x0;
      float wd = 0.0030 + 0.024 * u;
      float dens = exp(-dxs * dxs / (wd * wd)) * smoothstep(1.0, 0.25, u) * smoothstep(0.0, 0.03, r);
      float turb = 0.50 + 0.95 * st_noise(vec2(dxs * 60.0 + fi * 7.0, r * 15.0 - t * 0.9));
      smk += dens * turb * 0.55;
    }
  }
  col = mix(col, vec3(1.0, 0.90, 0.76), clamp(smk, 0.0, 0.72));

  // ---- temple hill: dark jungle with a warm rim where the sun touches it
  float yH = 0.865 - 0.095 * exp(-pow((p.x - cx) / 0.48, 2.0)) - 0.030 * st_fbm3(vec2(p.x * 3.0, 5.0)) - 0.012 * st_noise(vec2(p.x * 50.0, 2.0));
  if (uv.y > yH - 0.002) {
    float dh = uv.y - yH;
    vec3 jg = mix(vec3(0.24, 0.26, 0.15), vec3(0.06, 0.09, 0.07), smoothstep(0.0, 0.10, dh));
    jg *= 0.8 + 0.4 * st_noise(p * vec2(90.0, 130.0));
    jg += vec3(0.75, 0.42, 0.14) * exp(-dh * 55.0) * 0.45 * smoothstep(cx + 0.5, cx - 0.5, p.x);
    col = mix(col, jg, smoothstep(-0.002, 0.002, dh));
  }

  // ---- low mist in front of the hill
  float mB = smoothstep(0.42, 0.80, st_fbm(vec2(p.x * 1.3 + t * 0.014, uv.y * 6.0 + 7.0))) * exp(-pow((uv.y - 0.885) / 0.065, 2.0));
  col = mix(col, vec3(1.0, 0.80, 0.64), clamp(mB * 0.62, 0.0, 0.7));

  // ---- foreground leaves, black-green with a gold edge
  float yF = 0.955 - 0.050 * st_fbm3(vec2(p.x * 5.0 + 2.0, 8.0)) - 0.35 * smoothstep(asp - 0.36, asp, p.x) * st_fbm3(vec2(p.x * 4.0, 3.0)) - 0.22 * smoothstep(0.30, 0.0, p.x) * st_fbm3(vec2(p.x * 5.0 + 4.0, 6.0)) - 0.016 * st_noise(vec2(p.x * 70.0, 9.0));
  if (uv.y > yF - 0.002) {
    float df = uv.y - yF;
    vec3 fg = vec3(0.03, 0.055, 0.045) + vec3(0.55, 0.32, 0.10) * exp(-df * 70.0) * 0.45;
    col = mix(col, fg, smoothstep(-0.002, 0.002, df));
  }

  // let the user's own wallpaper show faintly through the scene
  col += (w - st_luma(w)) * 0.08;
  col *= 0.96 + 0.08 * st_luma(w);
  col *= 1.0 - 0.30 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
