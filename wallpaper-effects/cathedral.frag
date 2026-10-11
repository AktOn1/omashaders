// label: Gothic cathedral
// hint: the nave of a cathedral with tall pointed arches in perspective, ruby, sapphire and amber light shafts falling through incense haze onto the stone floor with dust glittering in the beams; the pointer draws a pale beam of light down onto itself and brightens the shafts near it
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

float cd_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cd_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cd_hash(i), cd_hash(i + vec2(1, 0)), f.x), mix(cd_hash(i + vec2(0, 1)), cd_hash(i + vec2(1, 1)), f.x), f.y);
}
float cd_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * cd_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float cd_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// pointed (equilateral) arch, half span h, spring line sp above the origin; negative inside the opening, in the units of q
float cd_open(vec2 q, float h, float sp) {
  float ax = abs(q.x);
  float up = -q.y - sp;
  float dr = length(vec2(ax + h, up)) - 2.0 * h;
  return up > 0.0 ? dr : ax - h;
}

// one shaft of light: returns its strength at p (axis passes through o, direction d, widening with distance)
float cd_shaft(vec2 p, vec2 o, vec2 d, float w0, float yEnd, float t, float seed) {
  vec2 n = vec2(d.y, -d.x);
  vec2 r = p - o;
  float al = dot(r, d), pp = dot(r, n);
  float w = w0 + 0.07 * max(al, 0.0);
  float core = smoothstep(w, 0.0, abs(pp));
  core = core * core * (3.0 - 2.0 * core);
  float haze = 0.55 + 0.9 * cd_fbm(vec2(pp * 5.5 + seed * 9.0, al * 2.2 - t * 0.045 + seed));
  float lenF = smoothstep(0.0, 0.25, al) * smoothstep(yEnd + 0.03, yEnd - 0.18, p.y);
  return core * haze * lenF * (1.0 - 0.28 * clamp(al, 0.0, 1.5));
}

vec3 cd_ruby() { return vec3(0.98, 0.10, 0.20); }
vec3 cd_sapph() { return vec3(0.14, 0.34, 1.00); }
vec3 cd_amber() { return vec3(1.00, 0.66, 0.12); }

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);
  float pl = cd_luma(pic);

  // ---- layout: one-point perspective down the nave
  vec2 vp = vec2(0.5 * asp, 0.50);
  vec2 v = p - vp;
  const float H = 0.36;        // half span of an arch
  const float SP = 0.34;       // spring line above the eye
  const float FQ = 0.55;       // floor below the eye
  const float RR = 0.72;       // each arch is this much smaller than the one before
  vec3 fogC = vec3(0.30, 0.25, 0.42);
  vec3 stoneC = vec3(0.30, 0.27, 0.36);
  vec2 dl = normalize(vec2(0.40, 1.0));

  // ---- the light that falls into the nave
  float breath = 0.88 + 0.12 * sin(t * 0.37);
  vec2 oR = vec2(0.10 * asp, -0.10);
  vec2 oS = vec2(0.36 * asp, -0.10);
  vec2 oA = vec2(0.62 * asp, -0.10);
  float yR = 0.80, yS = 0.90, yA = 0.74;
  float nearR = 0.0, nearS = 0.0, nearA = 0.0;
  vec2 nrm = vec2(dl.y, -dl.x);
  if (hasM) {
    nearR = exp(-pow(dot(mp - oR, nrm), 2.0) / 0.030);
    nearS = exp(-pow(dot(mp - oS, nrm), 2.0) / 0.030);
    nearA = exp(-pow(dot(mp - oA, nrm), 2.0) / 0.030);
  }
  float sR = cd_shaft(p, oR, dl, 0.055, yR, t, 0.0) * breath * (1.0 + 0.9 * nearR);
  float sS = cd_shaft(p, oS, dl, 0.070, yS, t, 1.7) * (0.92 + 0.08 * sin(t * 0.29 + 2.0)) * (1.0 + 0.9 * nearS);
  float sA = cd_shaft(p, oA, dl, 0.050, yA, t, 3.1) * (0.82 + 0.18 * sin(t * 0.45 + 4.0)) * (1.0 + 0.9 * nearA);
  float pT = 0.0, pS = 0.0;
  vec2 mo = vec2(0.0);
  float yM = 0.8;
  if (hasM) {
    yM = max(mp.y + 0.04, 0.66);
    mo = mp - dl * (mp.y + 0.12) / dl.y;
    pS = cd_shaft(p, mo, dl, 0.050, yM, t, 5.3) * 0.85;
  }

  // ---- the nave: arches painted from the nearest to the farthest
  float kk = -1.0, dEdge = 0.0, sK = 1.0;
  for (int k = 0; k < 7; k++) {
    float s = pow(RR, float(k));
    float d = cd_open(v / s, H, SP);
    if (kk < 0.0 && d > 0.0) { kk = float(k); dEdge = d * s; sK = s; }
  }
  bool floorPx = v.y > 0.0 && (abs(v.x) < (H / FQ) * v.y || (kk >= 0.0 && v.y > FQ * sK));
  vec3 col;
  float stoneMask = 0.0;

  // glow at the far end of the nave
  float rv = length(v * vec2(0.8, 1.0));
  float apse = exp(-rv / 0.10) * 1.0 + exp(-rv / 0.38) * 0.30;
  vec3 apseC = mix(vec3(1.0, 0.82, 0.58), vec3(0.78, 0.66, 0.95), smoothstep(0.0, 0.5, rv));

  if (floorPx) {
    // polished stone floor in perspective
    float z = FQ / max(v.y, 0.001);
    float u = v.x / max(v.y, 0.001);
    float gz = abs(fract(z * 1.6) - 0.5), gx = abs(fract(u * 2.2 + 0.5) - 0.5);
    float line = smoothstep(0.035 * z * 0.5 + 0.004, 0.0, gz * 0.5) + smoothstep(0.012, 0.0, gx * 0.5 / max(z * 0.35, 0.3));
    line = clamp(line, 0.0, 1.0);
    float tile = 0.55 + 0.45 * cd_hash(floor(vec2(z * 1.6, u * 2.2 + 0.5)));
    vec3 fl = vec3(0.075, 0.07, 0.11) * (0.6 + 0.8 * tile);
    fl = mix(fl, vec3(0.16, 0.15, 0.22), line * 0.5);
    // sheen down the middle from the far glow
    fl += apseC * exp(-abs(u) * 2.2) * exp(-v.y * 3.0) * 0.30;
    float rvF = length(vec2(v.x * 0.8, v.y * 1.4));
    fl += apseC * (exp(-rvF / 0.10) * 0.85 + exp(-rvF / 0.40) * 0.22);
    col = fl;
    stoneMask = 0.0;
  } else if (kk < 0.0) {
    // far end: the apse, three coloured lancets in a blaze
    vec3 g = apseC * apse * 1.4;
    float lx = v.x / 0.034;
    float lw = smoothstep(1.2, 0.8, abs(abs(lx) < 0.6 ? lx : (lx - sign(lx) * 1.6)));
    vec3 lc = abs(lx) < 0.6 ? cd_sapph() : (lx < 0.0 ? cd_ruby() : cd_amber());
    float ly = smoothstep(0.075, 0.045, abs(v.y + 0.010)) ;
    g = mix(g, lc * 1.3 + 0.3, lw * ly * 0.8);
    col = g;
  } else {
    float s = sK;
    float depth = kk / 6.0;
    // stone block texture
    float ang = atan(v.y, v.x);
    float course = abs(fract(length(v) / (0.11 * s + 0.0001) * 0.07 + 0.0) - 0.5);
    float voussoir = abs(fract(ang * 7.0 / 3.14159) - 0.5);
    float vl = smoothstep(0.03, 0.0, voussoir * 0.5) * 0.5;
    float n = cd_fbm(v / s * 3.0 + vec2(kk * 3.7, 1.3));
    float ringW = H * s * (1.0 / RR - 1.0) + 0.0001;
    float f = clamp(dEdge / ringW, 0.0, 3.0);
    vec3 st = stoneC * (0.30 + 0.45 * n);
    st *= 0.55 + 1.25 * pow(depth, 1.1);                 // near arches are dark silhouettes against the light behind
    st *= 1.0 - 0.30 * vl;
    // lit edge, facing the glow at the end
    float rim = exp(-dEdge / (0.010 + 0.020 * s));
    st += apseC * rim * (0.10 + 0.30 * depth) * (0.4 + apse * 0.8);
    // the thin soffit of the nearer arch is paler
    float soff = smoothstep(0.80, 0.95, f) * (1.0 - smoothstep(0.98, 1.05, f));
    st += fogC * soff * 0.08;
    // faint trace of the user's picture in the stone
    st += pic * 0.07 * (0.5 + depth);
    col = mix(st, fogC * 0.5, 0.10 + 0.55 * depth);
    stoneMask = 1.0 - depth * 0.5;
  }

  // ---- ambient haze: incense hanging in the air, thicker toward the far end and the floor
  float hz = cd_fbm(p * vec2(1.6, 2.2) + vec2(t * 0.012, -t * 0.020));
  float hzAmt = (0.08 + 0.22 * exp(-length(v) / 0.55) + 0.12 * smoothstep(0.55, 1.0, uv.y)) * (0.5 + hz);
  col += fogC * hzAmt * 0.55;
  col += apseC * apse * 0.10 * (floorPx ? 0.0 : 1.0) * (kk < 0.0 ? 0.0 : 1.0);

  // ---- shafts in the haze
  float lightK = floorPx ? 0.55 : 1.0;
  float vis = 1.0 - 0.60 * stoneMask * smoothstep(0.0, 1.0, (kk < 0.0 ? 0.0 : 1.0));
  vec3 shaft = (cd_ruby() * sR + cd_sapph() * sS + cd_amber() * sA) * 0.70
             + vec3(1.00, 0.84, 0.50) * pS * 0.80;
  col += shaft * lightK * (floorPx ? 0.35 : vis);

  // ---- pools of coloured light on the floor, with the stone's joints showing through
  float zF = FQ / max(v.y, 0.04);
  float uF = v.x / max(v.y, 0.04);
  float jn = 0.80 + 0.35 * smoothstep(0.0, 0.5, abs(fract(zF * 1.6) - 0.5)) + 0.0 * uF;
  if (v.y > 0.0) {
    float depthS = clamp(v.y / FQ, 0.0, 1.5);
    // each pool sits where its shaft meets the floor
    float tR = (yR - oR.y) / dl.y, tS = (yS - oS.y) / dl.y, tA = (yA - oA.y) / dl.y;
    vec2 cR = oR + dl * tR, cS = oS + dl * tS, cA = oA + dl * tA;
    float qR = length((p - cR) / vec2(0.19 + 0.05 * tR, 0.032));
    float qS = length((p - cS) / vec2(0.24 + 0.05 * tS, 0.038));
    float qA = length((p - cA) / vec2(0.17 + 0.05 * tA, 0.028));
    float poR = exp(-qR * qR * 0.9) * (1.0 + 0.9 * nearR) * breath;
    float poS = exp(-qS * qS * 0.9) * (1.0 + 0.9 * nearS);
    float poA = exp(-qA * qA * 0.9) * (1.0 + 0.9 * nearA);
    vec3 pools = cd_ruby() * poR + cd_sapph() * poS + cd_amber() * poA;
    if (hasM) {
      float tM = (yM - mo.y) / dl.y;
      vec2 cM = mo + dl * tM;
      float qM = length((p - cM) / vec2(0.15 + 0.04 * tM, 0.026));
      pools += vec3(1.0, 0.88, 0.62) * exp(-qM * qM * 0.9) * 0.9;
    }
    col += pools * (floorPx ? 0.80 * jn : 0.22);
  }

  // ---- dust turning in the beams
  float inBeam = clamp(sR + sS + sA + pS, 0.0, 1.5);
  vec3 dustC = (cd_ruby() * sR + cd_sapph() * sS + cd_amber() * sA + vec3(1.0, 0.9, 0.7) * pS) / max(sR + sS + sA + pS, 0.001);
  float dust = 0.0;
  {
    vec2 g = p * 34.0 + vec2(t * 0.25, -t * 0.55);
    vec2 gi = floor(g), gf = fract(g) - 0.5;
    vec2 off = (vec2(cd_hash(gi), cd_hash(gi + 7.7)) - 0.5) * 0.55;
    float tw = 0.5 + 0.5 * sin(t * (1.0 + 2.5 * cd_hash(gi + 3.1)) + 6.28 * cd_hash(gi + 1.3));
    dust += smoothstep(0.17, 0.0, length(gf - off)) * tw * step(0.55, cd_hash(gi + 9.0));
    vec2 g2 = p * 63.0 + vec2(-t * 0.35, -t * 0.30) + 19.0;
    vec2 gi2 = floor(g2), gf2 = fract(g2) - 0.5;
    vec2 off2 = (vec2(cd_hash(gi2), cd_hash(gi2 + 5.5)) - 0.5) * 0.5;
    float tw2 = 0.5 + 0.5 * sin(t * (1.5 + 2.0 * cd_hash(gi2 + 2.1)) + 6.28 * cd_hash(gi2 + 4.3));
    dust += 0.7 * smoothstep(0.13, 0.0, length(gf2 - off2)) * tw2 * step(0.60, cd_hash(gi2 + 11.0));
  }
  col += mix(dustC, vec3(1.0), 0.5) * dust * smoothstep(0.05, 0.6, inBeam) * 1.1 * (floorPx ? 0.4 : 1.0);

  // soft tone map so the brightest light glows instead of clipping, and a vignette
  col = vec3(1.0) - exp(-col * 1.55);
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.15)), 2.4);
  col = mix(col, col + pic * 0.03, 1.0);
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
