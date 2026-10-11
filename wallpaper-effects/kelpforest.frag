// label: Kelp forest
// hint: golden-green kelp swaying in green-blue light with sun shafts, a small silver school, floating particles and a sandy floor; the pointer makes the kelp lean away and the fish glint
// category: Water worlds
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
float kf_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 kf_h2(vec2 p) { return vec2(kf_hash(p), kf_hash(p + vec2(37.1, 11.7))); }
float kf_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(kf_hash(i), kf_hash(i + vec2(1, 0)), f.x), mix(kf_hash(i + vec2(0, 1)), kf_hash(i + vec2(1, 1)), f.x), f.y);
}
float kf_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * kf_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float kf_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float kf_sandLine(float x) { return 0.865 + 0.018 * sin(x * 2.3 + 1.0) + 0.012 * kf_noise(vec2(x * 3.0, 4.0)); }

// sun shafts: fan of soft beams from above the surface
float kf_rays(vec2 p, float t, float asp) {
  vec2 dv = p - vec2(asp * 0.38, -0.45);
  float ang = atan(dv.x, dv.y);
  float r1 = kf_noise(vec2(ang * 13.0 + 5.0, t * 0.04));
  float r2 = kf_noise(vec2(ang * 33.0 - t * 0.025, 9.0));
  float r3 = kf_noise(vec2(ang * 6.0, t * 0.02 + 30.0));
  float rays = smoothstep(0.32, 0.86, r1 * 0.5 + r2 * 0.28 + r3 * 0.22);
  return rays * exp(-p.y * 1.5) * smoothstep(0.0, 0.07, p.y) * (0.85 + 0.15 * sin(t * 0.23 + ang * 5.0));
}

// one depth layer of kelp stalks (l = 0 far .. 2 near), composited onto col
void kf_layer(inout vec3 col, vec2 p, float l, float t, vec2 mp, bool hasM, vec3 fog, float lightPool) {
  float cw = l < 0.5 ? 0.13 : (l < 1.5 ? 0.19 : 0.30);
  float ls = l < 0.5 ? 0.55 : (l < 1.5 ? 0.82 : 1.2);
  float yb0 = l < 0.5 ? 0.875 : (l < 1.5 ? 0.915 : 0.985);
  float fogK = l < 0.5 ? 0.58 : (l < 1.5 ? 0.28 : 0.0);
  float id0 = floor(p.x / cw);
  for (int i = -1; i <= 1; i++) {
    float id = id0 + float(i);
    vec2 h = kf_h2(vec2(id, 3.0 + l * 7.3));
    if (h.x > 0.88) continue;                                                // a few gaps in the forest
    float xb = (id + 0.2 + 0.6 * h.y) * cw;
    float Hh = (0.60 + 0.40 * kf_hash(vec2(id, 9.0 + l))) * (l > 1.5 ? 1.45 : (l > 0.5 ? 1.0 : 0.72));
    float yb = yb0 - 0.02 * h.y;
    float k = yb - p.y;
    if (k < 0.0 || k > Hh) continue;
    float hn = k / Hh;
    float ph = h.y * 6.28;
    // sway grows with height; two slow swells
    float sway = 0.036 * ls * pow(hn, 1.15) * (0.65 * sin(t * 0.55 + hn * 2.6 + ph) + 0.35 * sin(t * 0.33 + hn * 4.7 + 2.0 * ph));
    float lean = 0.0;
    if (hasM) {
      float dxm = xb - mp.x;
      lean = (dxm / sqrt(dxm * dxm + 0.015)) * 0.15 * exp(-dxm * dxm / 0.10) * pow(hn, 1.3);   // away from the pointer
    }
    float xs = xb + sway + lean;
    float wd = 0.0042 * ls * (1.0 - 0.45 * hn);
    float dx = abs(p.x - xs);
    float stalk = smoothstep(wd + 0.0014, wd - 0.0010, dx);
    // blades: alternate sides, root every 'sp' up the stalk
    float sp = 0.072 * ls;
    float kk = k / sp;
    float bi = floor(kk);
    float f = fract(kk) * sp;
    float sd = kf_hash(vec2(id * 13.0 + bi, l)) > 0.5 ? 1.0 : -1.0;
    float Lb = (0.040 + 0.040 * kf_hash(vec2(bi, id + 5.0))) * ls * (1.0 - 0.45 * hn);
    float lx = sd * (p.x - xs);
    float leaf = 0.0, lt = 0.0;
    if (lx > 0.0 && lx < Lb && bi > 0.0) {
      float u = lx / Lb;
      float fc = 0.012 * ls + lx * 0.55 - lx * lx * (3.2 / ls);
      float hw = 0.0125 * ls * (0.35 + 0.65 * pow(sin(3.14159 * min(u * 0.94 + 0.03, 1.0)), 0.7)) * (1.0 - 0.3 * u) + 0.0006;
      leaf = smoothstep(hw + 0.0016, hw - 0.0008, abs(f - fc));
      lt = u;
    }
    float cov = max(stalk, leaf);
    if (cov <= 0.002) continue;
    // colour: deep green low, gold high; blades warmer at their free ends; light from above-left
    vec3 g0 = vec3(0.07, 0.20, 0.07);
    vec3 g1 = vec3(0.52, 0.55, 0.10);
    vec3 g2 = vec3(0.86, 0.72, 0.20);
    vec3 kc = mix(g0, g1, 0.25 + 0.65 * hn);
    kc = mix(kc, g2, leaf * (0.15 + 0.5 * lt) * (0.4 + 0.6 * hn));
    kc *= 0.72 + 0.5 * (stalk > leaf ? 0.5 : 0.5 + 0.5 * smoothstep(0.0, 1.0, 1.0 - abs(f / sp - 0.45)));
    kc *= 0.55 + 0.9 * lightPool;                                            // the shafts glow through the blades
    kc = mix(kc, fog, fogK);
    col = mix(col, kc, cov * 0.96);
  }
}

// silver school; returns (coverage, glint, shade). Fish near the pointer flash.
float kf_fishShape(vec2 d, vec2 h, float L, out float shade) {
  float a = dot(d, h);
  float b = dot(d, vec2(-h.y, h.x));
  float W = L * 0.34;
  float body = smoothstep(1.0, 0.7, length(vec2(a / L, b / W)));
  float tw = (-0.65 * L - a) / (1.1 * L) * W * 1.5;
  float tail = step(a, -0.65 * L) * step(-1.75 * L, a) * smoothstep(tw, tw * 0.6, abs(b)) * step(0.0, tw);
  shade = 0.55 + 0.45 * smoothstep(0.6, -0.8, b / W);
  return max(body, tail * 0.85);
}
vec3 kf_school(vec2 p, vec2 c, vec2 vel, float cell, float L, vec2 mp, bool hasM, float t) {
  vec2 R = vec2(0.20, 0.085);
  vec2 rel0 = p - c;
  if (length(rel0 / (R * 1.5)) > 1.0) return vec3(0.0);
  vec2 heading = normalize(vel + vec2(1e-4, 0.0));
  vec2 q = rel0 / cell;
  vec2 ic = floor(q);
  float cov = 0.0, glint = 0.0, br = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = ic + vec2(float(i), float(j));
      vec2 h = kf_h2(id + 2.0);
      vec2 fl = (id + 0.5 + (h - 0.5) * 0.7) * cell;
      fl += 0.2 * cell * vec2(sin(t * 0.8 + h.x * 6.28), cos(t * 0.7 + h.y * 6.28));
      float env = 1.0 - smoothstep(0.55, 1.0, length(fl / R));
      if (kf_hash(id + 3.7) > env * 1.7) continue;
      vec2 fp = c + fl;
      vec2 fh = normalize(heading + 0.3 * vec2(sin(t * 0.9 + h.x * 9.0), cos(t * 0.8 + h.y * 9.0)));
      float sh;
      float cv = kf_fishShape(p - fp, fh, L * (0.8 + 0.4 * h.y), sh);
      float gl = 0.0;
      if (hasM) {
        vec2 dm = fp - mp;
        gl = exp(-dot(dm, dm) / 0.045) * pow(0.5 + 0.5 * sin(t * 7.0 + h.x * 50.0), 3.0);
      }
      if (cv > cov) { cov = cv; br = sh; glint = gl; }
    }
  }
  return vec3(cov, glint, br);
}

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

  // ---- green-blue water, bright at the top
  vec3 top = vec3(0.18, 0.60, 0.52);
  vec3 midc = vec3(0.06, 0.34, 0.38);
  vec3 low = vec3(0.02, 0.17, 0.20);
  vec3 water = mix(top, midc, smoothstep(0.0, 0.45, uv.y));
  water = mix(water, low, smoothstep(0.35, 0.95, uv.y));
  float rays = kf_rays(p, t, asp);
  vec3 col = water;
  col += vec3(0.05, 0.20, 0.14) * exp(-pow((p.x - asp * 0.38) / (0.6 * asp), 2.0)) * exp(-uv.y * 2.4);

  // ---- sand floor with ripples and drifting caustics
  float sl = kf_sandLine(p.x);
  if (p.y > sl) {
    float dd = (p.y - sl) / (1.0 - sl);
    vec3 sandC = mix(vec3(0.86, 0.76, 0.46), vec3(0.34, 0.34, 0.22), pow(dd, 0.8));
    float rip = sin(p.x * 70.0 + kf_fbm(p * vec2(4.0, 18.0)) * 9.0 + p.y * 30.0);
    sandC *= 0.90 + 0.10 * rip;
    sandC *= 0.88 + 0.24 * kf_noise(p * 90.0);
    sandC = mix(sandC, water * 0.8, 0.22);
    float c1 = 1.0 - abs(2.0 * kf_fbm(p * 7.0 + vec2(t * 0.05, t * 0.03)) - 1.0);
    float c2 = 1.0 - abs(2.0 * kf_fbm(p * 9.0 - vec2(t * 0.04, -t * 0.05) + 5.0) - 1.0);
    float caus = pow(c1 * c2, 5.0) * 2.2;
    sandC += vec3(0.60, 0.80, 0.45) * caus * 0.40 * (1.0 - dd * 0.7);
    col = mix(sandC, col, smoothstep(0.0, 0.006, sl - p.y + 0.003));
    col = mix(col, sandC, smoothstep(0.0, 0.004, p.y - sl));
  }

  // ---- far kelp, then shafts of light, then the closer kelp
  vec3 fogc = water * 0.9 + vec3(0.02, 0.07, 0.05);
  float lp = rays;
  kf_layer(col, p, 0.0, t, mp, hasM, fogc, lp);
  col += vec3(0.62, 0.88, 0.50) * rays * 0.36;
  kf_layer(col, p, 1.0, t, mp, hasM, fogc, lp);

  // ---- silver school in the mid water
  {
    vec3 s = kf_school(p, vec2(asp * (0.56 + 0.12 * sin(t * 0.04 + 1.0)), 0.44 + 0.05 * sin(t * 0.06)),
                       vec2(cos(t * 0.04 + 1.0), 0.3 * cos(t * 0.06)), 0.040, 0.0125, mp, hasM, t);
    vec3 fc = mix(vec3(0.34, 0.50, 0.52), vec3(0.88, 0.98, 1.0), s.z) + vec3(1.0) * s.y * 0.9;
    col = mix(col, fc, s.x * 0.88);
  }
  kf_layer(col, p, 2.0, t, mp, hasM, fogc, lp);

  // ---- floating particles, drifting up slowly
  {
    for (int l = 0; l < 2; l++) {
      float fl = float(l);
      float sc = 30.0 + fl * 24.0;
      vec2 g = p * sc + vec2(t * 0.35 * (1.0 + fl), t * (0.20 + 0.10 * fl)) + vec2(fl * 13.0, fl * 7.0);
      vec2 id = floor(g);
      vec2 h = kf_h2(id + 4.4 * fl);
      vec2 f = fract(g) - (0.2 + 0.6 * h);
      float on = step(0.85, kf_hash(id + 1.3 * fl));
      float r = 0.055 + 0.04 * h.x;
      float d1 = exp(-dot(f, f) / (r * r)) * on;
      float tw = 0.55 + 0.45 * sin(t * (0.6 + h.x) + h.y * 30.0);
      float nearM = hasM ? exp(-dot(p - mp, p - mp) / 0.05) : 0.0;
      col += vec3(0.80, 0.95, 0.60) * d1 * tw * (0.42 + 0.8 * nearM);
    }
  }

  // let the user's picture show through as faint tint
  col += w * vec3(0.30, 0.55, 0.40) * 0.10;
  col *= 0.94 + 0.12 * kf_luma(w);
  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
