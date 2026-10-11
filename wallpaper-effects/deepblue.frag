// label: Deep blue
// hint: open ocean seen from below: sun rays from the surface, a huge whale gliding far off, drifting plankton and two small fish shoals that dart away from the pointer
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
float db_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 db_h2(vec2 p) { return vec2(db_hash(p), db_hash(p + vec2(37.1, 11.7))); }
float db_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(db_hash(i), db_hash(i + vec2(1, 0)), f.x), mix(db_hash(i + vec2(0, 1)), db_hash(i + vec2(1, 1)), f.x), f.y);
}
float db_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * db_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float db_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// the whale in its own frame: x runs from the tail (-1) to the snout (+1), y across; returns coverage and a belly factor
vec2 db_whale(vec2 q, float t) {
  float bend = 0.085 * sin(t * 0.42 - q.x * 2.4) * (0.55 - 0.45 * q.x);   // the tail swings more than the head
  q.y -= bend;
  float x = q.x;
  float cov = 0.0;
  float belly = 0.0;
  // body: a long spindle, thickest a little in front of the middle, a blunt head, a thin tail stalk
  if (x > -0.72 && x < 1.0) {
    float u = (x + 0.72) / 1.72;
    float prof = pow(sin(3.14159 * pow(u, 0.85)), 0.62);
    float hb = 0.185 * prof * (0.62 + 0.38 * smoothstep(0.0, 0.5, u));
    float d = abs(q.y) - hb;
    cov = smoothstep(0.02, -0.02, d);
    belly = smoothstep(-0.02, 0.17, q.y);                                // paler underside
  }
  // pectoral flipper: a slim blade hanging down behind the head
  {
    vec2 f = q - vec2(0.28, 0.16);
    float c = cos(0.75), s = sin(-0.75);
    f = vec2(c * f.x - s * f.y, s * f.x + c * f.y);
    float fl = smoothstep(0.03, -0.03, length(f / vec2(0.15, 0.035)) - 1.0) ;
    cov = max(cov, fl);
  }
  // flukes: a swept-back crescent at the end of the stalk, thin at the tips
  {
    float s = abs(q.y) / 0.27;
    float xc = -0.70 - 0.36 * pow(s, 1.25);
    float ht = 0.050 * (1.0 - 0.82 * s) + 0.008;
    float inx = smoothstep(ht + 0.015, ht - 0.015, abs(q.x - xc));
    cov = max(cov, inx * smoothstep(1.06, 0.94, s));
  }
  return vec2(clamp(cov, 0.0, 1.0), belly);
}

// one fish, in a frame where 'h' is the heading; returns coverage and writes a flank shade
float db_fishShape(vec2 d, vec2 h, float L, out float shade) {
  float a = dot(d, h);
  float b = dot(d, vec2(-h.y, h.x));
  float W = L * 0.32;
  float body = smoothstep(1.0, 0.7, length(vec2(a / L, b / W)));
  float tw = (-0.65 * L - a) / (1.1 * L) * W * 1.5;
  float tail = step(a, -0.65 * L) * step(-1.75 * L, a) * smoothstep(tw, tw * 0.6, abs(b)) * step(0.0, tw);
  shade = 0.55 + 0.45 * smoothstep(0.6, -0.8, b / W);                        // lighter belly, darker back
  return max(body, tail * 0.85);
}

// a shoal: cells hold fish, an oval envelope thins them at the edges; the pointer pushes the whole shoal and scatters its fish.
// returns (coverage, glint, brightness)
vec3 db_shoal(vec2 p, vec2 c0, vec2 vel, float cell, float L, float seed, vec2 m, bool hasM, float t) {
  vec2 c = c0;
  vec2 heading = normalize(vel + vec2(1e-4, 0.0));
  float scare = 0.0;
  if (hasM) {
    vec2 dm = c0 - m;
    float dd = length(dm);
    scare = smoothstep(0.62, 0.05, dd);
    c += dm / max(dd, 0.001) * 0.40 * scare;                                 // the whole shoal bolts away
    heading = normalize(mix(heading, dm / max(dd, 0.001), scare));
  }
  vec2 R = vec2(0.17, 0.095) * (1.0 - 0.25 * scare);
  vec2 rel0 = p - c;
  if (length(rel0 / (R * 1.5)) > 1.0) return vec3(0.0);
  vec2 q = rel0 / cell;
  vec2 ic = floor(q);
  float cov = 0.0, glint = 0.0, br = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = ic + vec2(float(i), float(j));
      vec2 h = db_h2(id + seed);
      vec2 fl = (id + 0.5 + (h - 0.5) * 0.7) * cell;
      fl += 0.22 * cell * vec2(sin(t * 0.8 + h.x * 6.28), cos(t * 0.7 + h.y * 6.28));
      float env = 1.0 - smoothstep(0.55, 1.0, length(fl / R));
      if (db_hash(id + seed * 1.7) > env * 1.7) continue;
      vec2 fp = c + fl;
      if (hasM) {
        vec2 dd2 = fp - m;
        float dl = length(dd2);
        fp += dd2 / max(dl, 0.001) * 0.030 * exp(-dl * dl / 0.05);            // single fish fan out
      }
      vec2 fh = normalize(heading + 0.35 * vec2(sin(t * 0.9 + h.x * 9.0), cos(t * 0.8 + h.y * 9.0)));
      vec2 d = p - fp;
      float sh;
      float cv = db_fishShape(d, fh, L * (0.8 + 0.4 * h.y) * (1.0 + 0.7 * scare), sh);
      float gl = pow(0.5 + 0.5 * sin(t * 1.6 + h.x * 40.0), 6.0);             // sparse silver flashes
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

  // ---- water: bright blue-teal under the surface sinking to black
  float dep = uv.y;
  vec3 top = vec3(0.07, 0.40, 0.58);
  vec3 midc = vec3(0.02, 0.15, 0.30);
  vec3 low = vec3(0.0, 0.025, 0.075);
  vec3 col = mix(top, midc, smoothstep(0.0, 0.50, dep));
  col = mix(col, low, smoothstep(0.30, 1.0, dep));
  col = mix(col, vec3(0.0, 0.004, 0.02), smoothstep(0.72, 1.0, dep) * 0.8);
  // a wide pool of light where the sun stands above
  float sx = asp * 0.60;
  col += vec3(0.05, 0.22, 0.26) * exp(-pow((p.x - sx) / (0.55 * asp), 2.0)) * exp(-dep * 3.2);

  // ---- the whale, far away: a soft dark blue form, veiled by distance; rays cross it later
  {
    float cyc = 240.0;
    float ph = fract(t / cyc + 0.30);
    float wx = (asp + 0.80) - (2.0 * asp + 1.6) * ph;                                   // glides right to left, then is gone a while
    float wy = 0.43 + 0.05 * sin(t * 0.045) + 0.035 * sin(t * 0.021 + 1.0);
    float sc = 0.56;                                             // body half length in screen height units
    vec2 q = (p - vec2(wx, wy)) / sc;
    q.x = -q.x;                                                               // head towards the left
    q.y *= 1.0;
    // the glide tilts a little: nose slightly down
    float tilt = 0.06;
    q = vec2(q.x * cos(tilt) - q.y * sin(tilt), q.x * sin(tilt) + q.y * cos(tilt));
    vec2 wh = db_whale(q, t);
    float haze = 0.38;                                                        // how far into the blue it has melted
    vec3 wcol = mix(vec3(0.0, 0.03, 0.075), vec3(0.04, 0.17, 0.26), wh.y * 0.65);
    wcol = mix(wcol, col, haze);
    col = mix(col, wcol, wh.x * 0.9);
  }

  // ---- sun rays fanning down from above the surface
  {
    vec2 s0 = vec2(sx, -0.55);
    vec2 dv = p - s0;
    float ang = atan(dv.x, dv.y);
    float r1 = db_noise(vec2(ang * 15.0 + 3.0, t * 0.035));
    float r2 = db_noise(vec2(ang * 38.0 - t * 0.022, 7.0));
    float r3 = db_noise(vec2(ang * 7.0, t * 0.02 + 20.0));
    float rays = smoothstep(0.30, 0.86, r1 * 0.5 + r2 * 0.28 + r3 * 0.22);
    float fade = exp(-dep * 2.15) * smoothstep(0.0, 0.07, dep);
    float breathe = 0.82 + 0.18 * sin(t * 0.21 + ang * 4.0);
    col += vec3(0.20, 0.62, 0.72) * rays * fade * breathe * 0.60;
    // gentle shimmer of the surface at the very top
    float sh = db_fbm(vec2(p.x * 3.0 + t * 0.06, p.y * 14.0 - t * 0.05));
    col += vec3(0.30, 0.65, 0.72) * smoothstep(0.12, 0.0, dep) * (0.35 + 0.8 * sh) * 0.30;
  }

  // ---- plankton and marine snow: three drifting layers
  {
    for (int l = 0; l < 3; l++) {
      float fl = float(l);
      float sc = 26.0 + fl * 22.0;
      vec2 g = p * sc + vec2(t * (0.12 + 0.05 * fl) * (1.0 + fl) * 0.4, -t * (0.30 + 0.12 * fl) * (0.7 + fl * 0.5) * 0.5) + vec2(fl * 11.0, fl * 5.0);
      vec2 id = floor(g);
      vec2 h = db_h2(id + fl * 3.3);
      vec2 f = fract(g) - (0.2 + 0.6 * h);
      float on = step(0.86 - 0.05 * fl, db_hash(id + 9.1 * fl));
      float tw = 0.5 + 0.5 * sin(t * (0.5 + h.x * 1.5) + h.y * 30.0);
      float r = (0.050 + 0.040 * h.x) * (l == 0 ? 1.4 : 1.0);
      float dot1 = exp(-dot(f, f) / (r * r)) * on;
      vec3 pc = l == 1 ? vec3(0.35, 0.95, 0.85) : vec3(0.65, 0.88, 1.0);       // the middle layer glows green-cyan
      float a = l == 1 ? (0.20 + 0.6 * tw) : 0.45;
      col += pc * dot1 * a * (0.8 - 0.55 * dep) * (l == 0 ? 0.55 : 0.8);
    }
  }

  // ---- fish shoals (the second is smaller and farther, so dimmer and bluer)
  {
    vec3 s1 = db_shoal(p, vec2(asp * (0.34 + 0.12 * sin(t * 0.045)), 0.60 + 0.06 * sin(t * 0.07 + 1.0)),
                       vec2(cos(t * 0.045), 0.3 * cos(t * 0.07 + 1.0)), 0.040, 0.0115, 1.0, mp, hasM, t);
    vec3 s2 = db_shoal(p, vec2(asp * (0.74 + 0.10 * sin(t * 0.038 + 2.0)), 0.30 + 0.05 * sin(t * 0.06 + 4.0)),
                       vec2(cos(t * 0.038 + 2.0), 0.3 * cos(t * 0.06 + 4.0)), 0.040, 0.0072, 5.0, mp, hasM, t);
    float lightA = 1.0 - 0.45 * dep;
    vec3 fc1 = mix(vec3(0.20, 0.38, 0.52), vec3(0.78, 0.92, 1.0), s1.z) + vec3(0.8) * s1.y * 0.3;
    col = mix(col, fc1 * lightA, s1.x * 0.86);
    vec3 fc2 = mix(vec3(0.10, 0.24, 0.36), vec3(0.50, 0.72, 0.88), s2.z) + vec3(0.5) * s2.y * 0.2;
    col = mix(col, fc2 * (lightA * 0.8), s2.x * 0.70);
  }

  // let the user's picture show through as faint colour in the water
  col += w * vec3(0.30, 0.55, 0.75) * 0.14 * (1.0 - 0.6 * dep);
  col *= 0.94 + 0.12 * db_luma(w);
  col *= 1.0 - 0.42 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
