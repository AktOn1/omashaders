// label: Quarantine deck
// hint: a failing alarm beacon sweeps red and amber haze across the picture, a ceiling strip light stutters out, cold steam drifts low, dust and embers catch the beam, a huge shadow passes now and then; the pointer parts the steam and draws the motes
// category: Horror
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

float qd_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float qd_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(qd_hash(i), qd_hash(i + vec2(1, 0)), f.x), mix(qd_hash(i + vec2(0, 1)), qd_hash(i + vec2(1, 1)), f.x), f.y);
}
float qd_fbm(vec2 p) {
  return qd_noise(p) * 0.52 + qd_noise(p * 2.07 + 5.3) * 0.30 + qd_noise(p * 4.13 + 11.7) * 0.18;
}
float qd_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float qd_wrap(float a) { return a - 6.2831853 * floor((a + 3.1415927) / 6.2831853); }
float qd_bump(float x, float a, float b) { return smoothstep(a, a + 0.03, x) * (1.0 - smoothstep(b - 0.04, b, x)); }

const vec3 QD_CYAN = vec3(0.50, 0.88, 1.0);
const vec3 QD_STEEL = vec3(0.74, 0.90, 1.06);
const vec3 QD_AMBER = vec3(1.0, 0.62, 0.20);
const vec3 QD_RED = vec3(1.0, 0.17, 0.10);

// the alarm beacon sits above the deck, out of frame, and turns slowly: the wedge is on the picture for a few seconds, then gone
const float QD_OMEGA = 0.50;
const float QD_PHASE = 0.20;

// a failing light: 1 = steady, down to 0 = dark. A short stutter of drops at uneven gaps, then a long dark with a faint return. No two drops closer than half a second.
float qd_flick(float t, float seed) {
  float per = 9.0 + 3.0 * qd_hash(vec2(seed, 1.0));
  float x = t + seed * 5.3;
  float slot = floor(x / per);
  float h = qd_hash(vec2(slot, seed + 3.0));
  float u = x - slot * per - (1.2 + 4.5 * h);
  float calm = step(0.35, qd_hash(vec2(slot, seed + 8.0)));          // some cycles pass without a fault
  float d = qd_bump(u, 0.0, 0.10) * 0.85 + qd_bump(u, 0.55, 0.69) * 0.7 + qd_bump(u, 1.15, 1.22) * 0.9;
  float longd = qd_bump(u, 1.85, 2.25 + 1.0 * h) * (1.0 - 0.45 * qd_bump(u, 2.02, 2.08));
  d = max(d, longd);
  return 1.0 - clamp(d * calm, 0.0, 1.0);
}

// the lit strip, two neighbouring segments blended: every stretch of the tube fails on its own timetable
float qd_strip(float x, float t) {
  float q = x * 4.0;
  float id = floor(q);
  float m = smoothstep(0.30, 0.70, fract(q));
  return mix(qd_flick(t, id + 1.0), qd_flick(t, id + 2.0), m);
}

// something huge moving past a light: a soft, noisy-edged mass crosses the picture slowly, from one side or the other, every ~38 s
float qd_shadow(vec2 p, float asp, float t) {
  float per = 38.0;
  float slot = floor(t / per);
  float u = (t - slot * per - 7.0) / 17.0;
  if (u < 0.0 || u > 1.0) return 0.0;
  float dirn = qd_hash(vec2(slot, 2.0)) < 0.5 ? 1.0 : -1.0;
  float e = u * 0.65 + 0.35 * u * u * (3.0 - 2.0 * u);
  float cx = dirn > 0.0 ? mix(-0.62, asp + 0.62, e) : mix(asp + 0.62, -0.62, e);
  float cy = 0.38 + 0.24 * qd_hash(vec2(slot, 7.0));
  vec2 w = vec2(qd_noise(p * 2.2 + vec2(t * 0.05, 1.0)), qd_noise(p * 2.2 + vec2(5.0, -t * 0.04))) - 0.5;
  vec2 d = (p - vec2(cx, cy)) / vec2(0.36, 0.62) + w * 0.75;
  float body = smoothstep(1.0, 0.18, length(d));
  vec2 d2 = (p - vec2(cx - dirn * 0.58, cy + 0.26)) / vec2(0.26, 0.52) + w * 0.75;
  body = max(body, 0.65 * smoothstep(1.0, 0.18, length(d2)));
  return body;
}

// one depth of drifting motes. A cell holds at most one; it only shows where the beam is, or where the picture itself is bright.
// kind 0: cold dust, kind 1: amber ember that breathes
vec4 qd_mote(vec2 p, float asp, float scale, vec2 vel, float density, float rad, float seed, float kind, float lit) {
  float t = time;
  vec2 q = (p - vel * t) * scale;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 k = id + seed * 7.3;
  float h = qd_hash(k);
  if (h > density) return vec4(0.0);
  float h2 = qd_hash(k + 17.3), h3 = qd_hash(k + 41.7), h4 = qd_hash(k + 73.1);
  vec2 c = (vec2(h2, h3) - 0.5) * 0.4;
  c += 0.12 * vec2(sin(t * 0.31 * (0.6 + h2) + h4 * 6.28), cos(t * 0.23 * (0.6 + h3) + h2 * 6.28));
  vec2 pc = (id + 0.5 + c) / scale + vel * t;
  vec2 uvc = vec2(pc.x / asp, pc.y);
  if (uvc.x < 0.0 || uvc.x > 1.0 || uvc.y < 0.0 || uvc.y > 1.0) return vec4(0.0);
  float lum = qd_luma(wall(uvc));
  float brightNear = smoothstep(0.24, 0.70, lum);
  float catchL = clamp(lit * 1.6 + 0.62 * brightNear, 0.0, 1.0);
  vec2 d = f - c;
  float r = rad * (0.5 + 0.9 * h4);
  float rr = length(d);
  float tw = 0.55 + 0.45 * sin(t * (0.6 + 1.6 * h3) + h * 50.0);
  vec3 col;
  float i;
  if (kind < 0.5) {
    i = (exp(-(rr * rr) / (r * r) * 3.0) + exp(-rr / (r * 0.4)) * 0.12) * tw * catchL;
    col = mix(QD_CYAN * 0.9 + 0.1, vec3(1.0, 0.72, 0.52), clamp(lit * 1.5, 0.0, 1.0));
  } else {
    float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * (0.5 + 0.7 * h3) + h2 * 40.0), 3.0);
    i = (exp(-(rr * rr) / (r * r) * 3.0) + exp(-rr / (r * 0.5)) * 0.16) * pulse * (0.25 + 0.75 * catchL);
    col = mix(QD_AMBER, vec3(1.0, 0.86, 0.62), 0.25 * h4);
  }
  return vec4(col, i);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;

  // ---- the pointer: steam parts around it like a lens, the nearby motes lean toward it (range sets how far)
  vec2 pm = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  vec2 dm = p - pm;
  float r2 = dot(dm, dm);
  float wide = 0.03 + 0.07 * range;
  float lens = exp(-r2 / wide);

  // ---- something large goes by
  float sh = qd_shadow(p, asp, t);

  // ---- holographic scan band: a thin cyan band slides down the picture; it traces the picture's own edges
  float sy = fract(t * 0.038 + 0.30) * 1.40 - 0.20;
  float sd = uv.y - sy;
  float band = exp(-sd * sd / 0.0009);
  float wob = qd_noise(vec2(uv.y * 90.0, t * 3.0)) - 0.5;
  vec2 bo = vec2(band * wob * 0.0035, 0.0);

  vec3 base = wall(uv + bo);
  float lum0 = qd_luma(base);

  // ---- steel grade: cooler and a little greyer, mostly in the dark
  vec3 steel = vec3(lum0) * QD_STEEL + vec3(0.0, 0.006, 0.014);
  float dk = 1.0 - smoothstep(0.08, 0.62, lum0);
  vec3 col = mix(base, steel, 0.13 + 0.42 * dk);

  // ---- ceiling strip light: a band of the picture drops out in uneven stutters, then the cold glow lingers
  float bandY = smoothstep(0.0, 0.10, uv.y) * exp(-max(uv.y - 0.10, 0.0) / 0.17);   // light falls from the tube and thins out downward
  float f0 = qd_strip(uv.x, t);
  float f1 = qd_strip(uv.x, t - 0.16);
  float f2 = qd_strip(uv.x, t - 0.34);
  float aft = clamp(max(f1, f2) - f0, 0.0, 1.0);
  float surge = clamp(f0 - f1, 0.0, 1.0);                       // the light coming back overshoots a moment
  col *= 1.0 - bandY * 0.50 * (1.0 - f0);
  col *= 1.0 + bandY * (0.24 * surge + 0.07 * f0);
  col += QD_CYAN * 0.034 * f0 * bandY * (0.35 + lum0);           // the steady cold wash from the tube
  // a hair-thin tube line along the top of the band, lit segment by segment
  float tube = (exp(-pow((uv.y - 0.045) / 0.004, 2.0)) * 0.6 + exp(-pow((uv.y - 0.045) / 0.028, 2.0)) * 0.3) * smoothstep(0.50, 0.70, qd_noise(vec2(uv.x * 6.0, 3.0)));
  vec3 add = vec3(0.0);
  add += mix(QD_CYAN, vec3(1.0), 0.45) * tube * f0 * 0.12 * (1.0 - 0.8 * sh);
  add += QD_CYAN * aft * bandY * 0.075 * (0.4 + 0.9 * lum0);

  // ---- alarm beacon: a soft wedge of light turns across the picture, lifting its bright parts, with haze in the beam
  vec2 bp = vec2(0.30 * asp, -0.55);
  vec2 rel = p - bp;
  float ang = atan(rel.y, rel.x);
  float dist = length(rel);
  float A = QD_OMEGA * t + QD_PHASE;
  float dA = qd_wrap(ang - A);
  float passId = floor(A / 6.2831853);
  float redness = qd_hash(vec2(passId, 5.0)) < 0.62 ? 0.88 : 0.22;
  vec3 bc = mix(QD_AMBER, QD_RED, redness);
  float core = 0.66 * exp(-dA * dA / (2.0 * 0.10 * 0.10)) + 0.38 * exp(-dA * dA / (2.0 * 0.20 * 0.20));
  float halo = exp(-dA * dA / (2.0 * 0.42 * 0.42));
  float att = 1.0 / (1.0 + dist * dist * 0.85);
  float sag = 0.80 + 0.20 * qd_flick(t * 1.0 + 4.0, 9.0);       // the beacon's power sags with the rest of the deck
  sag *= 0.92 + 0.08 * qd_noise(vec2(t * 7.0, 2.0));
  float hz = qd_fbm(vec2(p.x * 3.0 - t * 0.05, p.y * 2.6 + t * 0.03) + qd_noise(p * 1.5 + t * 0.04) * 1.2);
  float shaft = 0.25 + 0.55 * qd_noise(vec2(ang * 34.0, dist * 1.2 - t * 0.16)) + 0.45 * qd_noise(vec2(ang * 95.0 + 7.0, dist * 2.0 - t * 0.1));
  float beamAt = core * att * sag * (1.0 - 0.85 * sh);
  float haloAt = halo * att * sag * (1.0 - 0.85 * sh);
  float am = mod(A, 6.2831853);
  float pres = smoothstep(0.15, 0.75, am) * (1.0 - smoothstep(2.2, 2.9, am));   // the wedge is somewhere on the picture
  // while it passes, the ambient light dips; the beam leaves a cold dark behind it
  col *= 1.0 - 0.20 * pres * (1.0 - clamp(haloAt * 1.8, 0.0, 1.0));
  // lift the picture's own bright parts, tinted by the beam
  float bk = clamp(beamAt * (0.55 + 0.7 * hz) * (0.45 + 0.8 * shaft), 0.0, 0.50);
  vec3 lit = (col * 0.50 + vec3(qd_luma(col)) * 0.65) * (bc * 1.30 + 0.06);   // the picture's own structure, seen by beam light
  col = mix(col, lit, bk * (0.40 + 0.60 * smoothstep(0.05, 0.55, lum0)));
  col = mix(col, col * (bc * 1.2 + 0.1), clamp(haloAt * 0.14, 0.0, 0.3));
  float haze = beamAt * shaft * (0.30 + 0.95 * hz);
  add += bc * haze * 0.36 + bc * haloAt * hz * 0.045;

  // ---- vapour: two layers low in the frame, the far one slow and pale, the near one slower to rise and thicker; lit by the beam
  vec2 psf = p - dm * lens * 0.55;                              // steam is pushed aside where the pointer is
  float gust = 0.65 + 0.35 * sin(t * 0.21 + p.x * 1.3) * sin(t * 0.13 + 1.7);
  vec2 sq = psf * vec2(1.6, 3.4);
  vec2 wp = vec2(qd_noise(sq * 0.8 + vec2(t * 0.03, 2.0)), qd_noise(sq * 0.8 + vec2(9.0, -t * 0.02))) - 0.5;
  float s0 = qd_fbm(sq + wp * 1.6 + vec2(t * 0.045, -t * 0.012));
  float far = smoothstep(0.36, 0.80, s0) * smoothstep(0.30, 0.85, uv.y);
  vec2 sq2 = psf * vec2(1.1, 2.6) + vec2(3.1, 1.7);
  vec2 wp2 = vec2(qd_noise(sq2 * 0.9 + vec2(-t * 0.04, 4.0)), qd_noise(sq2 * 0.9 + vec2(2.0, t * 0.03))) - 0.5;
  float s1 = qd_fbm(sq2 + wp2 * 1.8 + vec2(-t * 0.07, -t * 0.02));
  float nearL = smoothstep(0.34, 0.78, s1) * smoothstep(0.45, 0.98, uv.y);
  float part = 1.0 - 0.78 * exp(-r2 / (wide * 0.8));
  float vap = clamp((far * 0.55 + nearL * 0.85) * gust * part, 0.0, 1.0);
  vec3 vcol = vec3(lum0 * 0.50 + 0.13) * QD_STEEL * 0.9 + vec3(0.0, 0.02, 0.03);
  col = mix(col, vcol, vap * 0.58);
  vec3 vlight = mix(QD_CYAN * 0.05, bc * 0.55, clamp(beamAt * 2.2 + haloAt * 0.25, 0.0, 1.0));
  add += QD_CYAN * vap * 0.035;
  add += vlight * vap * (0.5 + 0.9 * beamAt * 3.0);

  // ---- the passing mass: cold, soft, a little blue
  col = mix(col, col * vec3(0.56, 0.72, 0.90) * 0.82, sh * 0.70);

  // ---- scan band additions: fine interference lines and a cyan trace of the picture's edges
  float lines = 0.5 + 0.5 * sin(uv.y * res.y * 1.9 + t * 4.0);
  float ex = qd_luma(wall(uv + vec2(2.5 / res.x, 0.0))) - qd_luma(wall(uv - vec2(2.5 / res.x, 0.0)));
  float ey = qd_luma(wall(uv + vec2(0.0, 2.5 / res.y))) - qd_luma(wall(uv - vec2(0.0, 2.5 / res.y)));
  float edge = clamp(length(vec2(ex, ey)) * 5.0, 0.0, 1.0);
  float bandM = band * (0.55 + 0.45 * lines) * (1.0 - 0.7 * sh);
  add += QD_CYAN * bandM * (0.040 + 0.30 * edge);
  col *= 1.0 + band * 0.05;

  // ---- motes in three depths; dust only shows in the beam or by bright parts of the picture, embers glow low and amber
  vec2 pfar = p + dm * lens * 0.18;
  vec2 pmid = p + dm * lens * 0.40;
  vec2 pnear = p + dm * lens * 0.70;
  float litP = clamp(beamAt * 1.6 + haloAt * 0.15, 0.0, 1.0);
  vec4 m0 = qd_mote(pfar, asp, 9.0, vec2(0.010, 0.006), 0.58, 0.065, 1.0, 0.0, litP);
  vec4 m1 = qd_mote(pmid + 0.31, asp, 16.0, vec2(-0.012, 0.016), 0.50, 0.055, 2.0, 0.0, litP);
  vec4 m2 = qd_mote(pnear + 0.17, asp, 7.0, vec2(0.006, -0.020), 0.34, 0.060, 3.0, 1.0, litP);
  float mAt = 1.0 - 0.7 * sh;
  add += m0.rgb * m0.a * 0.62 * mAt;
  add += m1.rgb * m1.a * 0.90 * mAt;
  add += m2.rgb * m2.a * 0.80 * mAt;

  // ---- put it together: light is added the way light is, with a soft shoulder so bright pictures do not clip
  col = 1.0 - (1.0 - col) * (1.0 - clamp(add, 0.0, 0.92));
  return vec4(clamp(col, 0.0, 1.0), 1.0) * qt_Opacity;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored, above 1 = exaggerated
void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
