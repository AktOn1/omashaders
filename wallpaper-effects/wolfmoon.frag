// label: Wolf moon
// hint: an enormous low moon behind a ridge of pines with a wolf howling on a knoll, mist lying in the valley and now and then a slow ring of pale light rippling out from the moon; the pointer swirls the mist away from itself
// category: Dark tales
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

float wm_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wm_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wm_hash(i), wm_hash(i + vec2(1, 0)), f.x), mix(wm_hash(i + vec2(0, 1)), wm_hash(i + vec2(1, 1)), f.x), f.y);
}
float wm_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * wm_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float wm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float wm_smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float wm_cap(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// the line of a ridge: a base height with slow hills; knoll adds one raised place for the wolf
float wm_ridge(float x, float b, float a, float f, float sd) {
  return b + a * (wm_noise(vec2(x * f + sd, sd * 1.7)) - 0.5) * 2.0 + a * 0.4 * (wm_noise(vec2(x * f * 2.7 + sd * 3.0, sd)) - 0.5);
}

// a row of pines standing on a ridge: 1 inside a tree
float wm_pines(vec2 p, float cw, float hmin, float hmax, float b, float a, float f, float sd, float aa) {
  float m = 0.0;
  float ci = floor(p.x / cw);
  for (int k = -1; k <= 1; k++) {
    float i = ci + float(k);
    float cx = (i + 0.5 + (wm_hash(vec2(i, sd)) - 0.5) * 0.7) * cw;
    float h = hmin + (hmax - hmin) * wm_hash(vec2(i * 1.7, sd + 4.0));
    float by = wm_ridge(cx, b, a, f, sd) + 0.01;
    float yf = (p.y - (by - h)) / h;                      // 0 at the tip, 1 at the foot
    if (yf > -0.02 && yf < 1.0) {
      float tier = fract(yf * 6.5 + wm_hash(vec2(i, sd + 9.0)));
      float w = 0.48 * cw * 1.25 * (yf * (0.55 + 0.45 * tier)) + 0.0008;
      m = max(m, smoothstep(aa, -aa, abs(p.x - cx) - w) * smoothstep(-0.02, 0.0, yf));
    }
  }
  return m;
}

// a howling wolf in profile facing right, in local units; returns the signed distance (negative inside)
float wm_wolf(vec2 q) {
  float d = wm_cap(q, vec2(-0.30, 0.00), vec2(0.14, -0.02), 0.105);                 // body
  d = wm_smin(d, wm_cap(q, vec2(0.12, -0.02), vec2(0.20, -0.05), 0.115), 0.08);      // deep chest
  d = wm_smin(d, wm_cap(q, vec2(-0.27, 0.04), vec2(-0.31, 0.33), 0.052), 0.06);      // hind leg
  d = wm_smin(d, wm_cap(q, vec2(-0.14, 0.06), vec2(-0.12, 0.34), 0.042), 0.05);
  d = wm_smin(d, wm_cap(q, vec2(0.08, 0.06), vec2(0.07, 0.34), 0.042), 0.05);        // front legs
  d = wm_smin(d, wm_cap(q, vec2(0.17, 0.06), vec2(0.18, 0.34), 0.040), 0.05);
  d = wm_smin(d, wm_cap(q, vec2(-0.33, -0.03), vec2(-0.58, 0.07), 0.045), 0.06);     // tail
  d = wm_smin(d, wm_cap(q, vec2(-0.56, 0.06), vec2(-0.66, 0.22), 0.030), 0.05);
  d = wm_smin(d, wm_cap(q, vec2(0.17, -0.08), vec2(0.31, -0.30), 0.085), 0.09);      // neck lifted
  d = wm_smin(d, wm_cap(q, vec2(0.31, -0.30), vec2(0.38, -0.41), 0.078), 0.07);      // skull
  d = wm_smin(d, wm_cap(q, vec2(0.38, -0.41), vec2(0.53, -0.62), 0.044), 0.06);      // muzzle toward the moon
  d = wm_smin(d, wm_cap(q, vec2(0.32, -0.38), vec2(0.29, -0.52), 0.030), 0.05);      // ear
  return d;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  float aa = 1.5 / res.y;
  vec3 pic = wall(uv);

  // ---- layout
  vec2 moonP = vec2(0.60 * asp, 0.60);
  float moonR = 0.26;
  float wolfX = 0.36 * asp;
  float sc = 0.27;

  // ---- the pointer: it pushes the mist outward and spins it a little
  vec2 dmv = p - mp;
  float dmd = length(dmv);
  vec2 dir = dmv / max(dmd, 0.001);
  float fall = hasM ? exp(-dmd / 0.24) : 0.0;
  vec2 push = dir * 0.13 * fall + vec2(-dir.y, dir.x) * 0.07 * fall;
  float part = hasM ? exp(-dmd * dmd / 0.045) : 0.0;

  // ---- the howl: a slow ring of pale light leaves the moon every 13 s
  float ph = fract(t / 13.0 + 0.05);
  float ringR = moonR * 1.02 + 1.25 * pow(ph, 0.8);
  float ringW = 0.020 + 0.070 * ph;
  float ringI = pow(1.0 - ph, 1.6) * smoothstep(0.0, 0.04, ph);
  float dM = length(p - moonP);
  float ring = exp(-pow((dM - ringR) / ringW, 2.0)) * ringI;
  float ring2 = exp(-pow((dM - ringR * 0.80 + 0.03) / (ringW * 1.3), 2.0)) * ringI * 0.28;
  float howl = ring + ring2;
  float swell = smoothstep(0.0, 0.10, ph) * (1.0 - smoothstep(0.10, 0.45, ph));   // the moon brightens as it leaves

  // ---- the sky: deep blue, brighter around the low moon, a few stars
  float hv = clamp((p.y - 0.1) / 0.6, 0.0, 1.0);
  vec3 sky = mix(vec3(0.012, 0.028, 0.070), vec3(0.075, 0.115, 0.200), hv * hv);
  sky += vec3(0.28, 0.34, 0.46) * exp(-max(dM - moonR, 0.0) / 0.30) * 0.40;
  sky += vec3(0.60, 0.62, 0.62) * exp(-max(dM - moonR, 0.0) / 0.05) * 0.16;
  vec2 sg = p * 90.0;
  vec2 sgi = floor(sg), sgf = fract(sg) - 0.5;
  float star = smoothstep(0.10, 0.0, length(sgf - (vec2(wm_hash(sgi), wm_hash(sgi + 3.3)) - 0.5) * 0.6)) * step(0.965, wm_hash(sgi + 7.0));
  star *= 0.5 + 0.5 * sin(t * (0.6 + wm_hash(sgi)) + wm_hash(sgi + 1.0) * 6.28);
  sky += vec3(0.85, 0.90, 1.0) * star * 0.55 * smoothstep(0.55, 0.15, p.y) * (1.0 - smoothstep(moonR, moonR * 2.2, dM));
  // thin cloud streaks drifting across the moon
  float cn = wm_fbm(vec2(p.x * 1.3 - t * 0.012, p.y * 7.0 + 3.0));
  float cloud = smoothstep(0.52, 0.78, cn) * smoothstep(0.18, 0.40, p.y) * smoothstep(0.78, 0.50, p.y) * smoothstep(0.9, 0.2, abs(p.x - moonP.x) / asp * 2.0);
  vec3 col = sky;
  col += vec3(0.70, 0.78, 0.92) * howl * 0.30;

  // ---- the moon itself, enormous and low, warmer where it meets the haze
  float disc = smoothstep(moonR, moonR - aa * 2.0, dM);
  vec2 mq = (p - moonP) / moonR;
  float mare = smoothstep(0.48, 0.66, wm_fbm(mq * 2.3 + 4.0)) * 0.42 + smoothstep(0.55, 0.72, wm_fbm(mq * 5.5 + 11.0)) * 0.10;
  float crat = 0.0;
  vec3 moonC = mix(vec3(0.97, 0.95, 0.88), vec3(1.0, 0.86, 0.68), smoothstep(-0.2, 1.0, mq.y));
  moonC *= 1.0 - mare - crat * 0.5;
  moonC *= 0.88 + 0.12 * sqrt(max(1.0 - dot(mq, mq), 0.0));
  moonC *= 1.0 + 0.18 * swell;
  moonC = mix(moonC, vec3(0.70, 0.76, 0.86), cloud * 0.18);
  col = mix(col, moonC * 0.80, disc);
  col += vec3(0.50, 0.55, 0.65) * cloud * 0.12 * (1.0 - disc);

  // ---- far ridge of pines, hazy blue
  float rFar = wm_ridge(p.x, 0.70, 0.030, 1.6, 1.0);
  float farM = max(step(rFar, p.y), wm_pines(p, 0.026, 0.040, 0.085, 0.70, 0.030, 1.6, 1.0, aa));
  vec3 farC = mix(vec3(0.060, 0.090, 0.150), vec3(0.20, 0.25, 0.34), exp(-abs(p.x - moonP.x) / 0.30) * 0.5 * smoothstep(0.55, 0.85, p.y));
  col = mix(col, farC, farM);

  // ---- mist in the far valley
  vec2 pm1 = p - push * 0.9;
  float n1 = wm_fbm(vec2(pm1.x * 1.5 + t * 0.020, pm1.y * 4.2 + 1.0) + wm_fbm(pm1 * 2.2 - t * 0.01) * 0.6);
  float band1 = smoothstep(0.64, 0.74, p.y) * smoothstep(0.90, 0.78, p.y);
  float mist1 = smoothstep(0.30, 0.72, n1) * band1 * (1.0 - 0.85 * part);
  vec3 mistC = vec3(0.22, 0.31, 0.45) + vec3(0.60, 0.62, 0.58) * exp(-abs(p.x - moonP.x) / 0.50) * 0.45;
  col = mix(col, mistC * 1.1, mist1 * 0.85);

  // ---- the near ridge with its pines, and the knoll where the wolf stands
  float knoll = 0.075 * exp(-pow((p.x - wolfX) / 0.11, 2.0));
  float rMid = wm_ridge(p.x, 0.80, 0.030, 1.9, 5.0) - knoll;
  float midM = max(step(rMid, p.y), wm_pines(p, 0.034, 0.060, 0.135, 0.80, 0.030, 1.9, 5.0, aa) * (1.0 - smoothstep(0.10, 0.19, abs(p.x - wolfX))));
  vec3 midC = vec3(0.020, 0.032, 0.060);
  col = mix(col, midC, midM);
  // the wolf
  float wy = wm_ridge(wolfX, 0.80, 0.030, 1.9, 5.0) - 0.075 - 0.33 * sc + 0.012;
  vec2 wq = (p - vec2(wolfX, wy)) / sc;
  float wd = wm_wolf(wq) * sc;
  float wolf = smoothstep(aa, -aa, wd);
  col = mix(col, vec3(0.010, 0.016, 0.034), wolf);

  // ---- low mist rolling in front, lit from the moon
  vec2 pm2 = p - push * 1.2;
  float n2 = wm_fbm(vec2(pm2.x * 1.2 - t * 0.030, pm2.y * 3.4 + 7.0) + wm_fbm(pm2 * 1.7 + t * 0.012) * 0.7);
  float band2 = smoothstep(0.78, 0.88, p.y) * smoothstep(1.05, 0.93, p.y);
  float mist2 = smoothstep(0.30, 0.72, n2) * band2 * (1.0 - 0.80 * part);
  col = mix(col, mistC * 1.05, mist2 * 0.88);
  col += vec3(0.60, 0.65, 0.75) * howl * 0.10 * (mist1 + mist2);

  // ---- dark pines in the foreground at the edges
  float edge = smoothstep(0.30, 0.06, p.x / asp) + smoothstep(0.72, 0.94, p.x / asp);
  float nearM = wm_pines(p, 0.060, 0.22, 0.46, 1.02, 0.020, 1.3, 9.0, aa) * clamp(edge, 0.0, 1.0);
  col = mix(col, vec3(0.006, 0.010, 0.022), max(nearM, step(0.985, uv.y)));

  // a faint trace of the user's picture, and a gentle vignette
  col += pic * 0.045;
  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
