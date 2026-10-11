// label: Great wave
// hint: an ukiyo-e woodblock sea: indigo scales in perspective, a curling wave with foam claws, cream sky and a small Mount Fuji; the pointer lifts spray and leans the wave
// category: Art studio
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
float hk_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hk_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hk_hash(i), hk_hash(i + vec2(1, 0)), f.x), mix(hk_hash(i + vec2(0, 1)), hk_hash(i + vec2(1, 1)), f.x), f.y);
}
float hk_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * hk_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
const float HK_HZ = 0.60;

// seigaiha: overlapping scales, drawn back to front; returns ring colour index in x (0..1 = ring position) and edge line in y; z = 1 when covered
vec3 hk_scales(vec2 q) {
  // q: x across (period 2), y receding rows (spacing 0.5), circles of radius 1
  float row0 = floor(q.y / 0.5);
  float best = -1.0e3;
  vec3 res = vec3(0.0);
  for (int k = -3; k <= 3; k++) {
    float j = row0 + float(k);
    float cy = j * 0.5;
    float cx = 2.0 * floor((q.x - 1.0 * mod(j, 2.0)) / 2.0 + 0.5) + mod(j, 2.0);
    vec2 d = q - vec2(cx, cy);
    float r = length(d);
    if (r < 1.0 && cy > best) { best = cy; res = vec3(r, hk_hash(vec2(cx, j)), 1.0); }
  }
  return res;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  float t = time;
  vec2 sw = (m - 0.5) * vec2(0.05, 0.02);                 // the pointer leans the great wave a little (parallax)
  if (m.x < -5.0) sw = vec2(0.0);

  // ---- sky: cream paper with a darker bokashi band at the top and long thin cloud streaks
  vec3 skyTop = vec3(0.86, 0.76, 0.56);
  vec3 skyLow = vec3(0.97, 0.93, 0.80);
  vec3 col = mix(skyTop, skyLow, smoothstep(0.0, HK_HZ, uv.y));
  float cl = hk_fbm(vec2(p.x * 1.1 - t * 0.004, p.y * 9.0)) ;
  float streak = smoothstep(0.52, 0.60, cl) * smoothstep(0.10, 0.45, uv.y) * (1.0 - smoothstep(0.50, 0.60, uv.y));
  col = mix(col, vec3(0.90, 0.80, 0.62), streak * 0.65);
  col = mix(col, vec3(0.78, 0.60, 0.42), smoothstep(0.04, 0.0, abs(uv.y - (HK_HZ - 0.035))) * 0.25);   // faint warm haze line

  // ---- Mount Fuji: a small indigo cone with a white cap, far away at the horizon
  vec2 fj = p - vec2(asp * 0.72, HK_HZ);
  float fh = 0.17;
  float fhh = -fj.y / fh;                                   // 0 at the shore, 1 at the summit
  if (fhh > 0.0 && fhh < 1.0) {
    float hw = 0.30 * pow(1.0 - fhh, 1.55) + 0.012 * (1.0 - fhh);
    float ax = abs(fj.x) + 0.004 * sin(fj.y * 160.0 + fj.x * 20.0);
    if (ax < hw) {
      float capLine = 0.60 + 0.07 * sin(fj.x * 70.0) + 0.05 * hk_noise(vec2(fj.x * 40.0, 2.0)) + (fj.x > 0.0 ? 0.0 : 0.02);
      vec3 body = mix(vec3(0.36, 0.50, 0.66), vec3(0.22, 0.35, 0.54), smoothstep(0.0, 0.8, fhh));
      vec3 fc = fhh > capLine ? vec3(0.96, 0.96, 0.93) : body;
      fc = mix(fc, vec3(0.12, 0.20, 0.36), smoothstep(0.006, 0.0, hw - ax) * 0.65);
      col = fc;
    }
  }

  // ---- the sea behind: indigo with fine horizontal print lines, lighter toward the horizon
  float dep = max(uv.y - HK_HZ, 0.0);
  vec3 seaFar = vec3(0.30, 0.46, 0.62);
  vec3 seaNear = vec3(0.07, 0.17, 0.34);
  vec3 sea = mix(seaFar, seaNear, smoothstep(0.0, 0.40, dep));
  float lines = smoothstep(0.35, 0.5, abs(fract((uv.y + hk_noise(vec2(p.x * 3.0 + t * 0.03, uv.y * 40.0)) * 0.006) * 140.0) - 0.5) * 2.0);
  sea *= 1.0 - 0.10 * (1.0 - lines) * smoothstep(0.0, 0.05, dep);
  float wmask = smoothstep(HK_HZ - 0.001, HK_HZ + 0.003, uv.y);
  col = mix(col, sea, wmask);

  // seigaiha scales in perspective across the foreground
  float dd = max(dep, 0.0001);
  float depthK = 0.060;                                   // scale size at the bottom
  vec2 q = vec2((p.x - asp * 0.5 + t * 0.010) / (dd + 0.12) * 2.6, 1.25 / (dd + 0.12) - t * 0.03);
  vec3 sc = hk_scales(q);
  float fade = smoothstep(0.015, 0.09, dep);              // scales dissolve into plain water at the far line
  if (sc.z > 0.5 && dep > 0.0) {
    float r = sc.x;
    float ringIdx = floor(r * 3.0);
    vec3 c0 = vec3(0.07, 0.17, 0.34);
    vec3 c1 = vec3(0.14, 0.30, 0.50);
    vec3 c2 = vec3(0.26, 0.46, 0.64);
    vec3 sc_col = ringIdx < 1.0 ? c2 : (ringIdx < 2.0 ? c1 : c0);
    sc_col = mix(sc_col, vec3(0.93, 0.93, 0.88), smoothstep(0.045, 0.0, abs(fract(r * 3.0) - 0.0)) * 0.55 + smoothstep(0.05, 0.0, abs(r - 1.0)) * 0.7);
    sc_col *= 0.92 + 0.14 * sc.y;
    col = mix(col, sc_col, fade * 0.92);
  }

  // ---- the great wave: a thick crescent curling over to the right, built from two discs
  vec2 cA = vec2(asp * 0.22, 0.70) + sw;
  float RA = 0.52;
  vec2 cB = cA + vec2(0.22, 0.13);
  float RB = 0.38;
  float dA = length(p - cA) - RA;
  float dB = RB - length(p - cB);                          // > 0 inside the hollow
  float cres = max(dA, dB);
  float inA = 1.0 - smoothstep(-0.0015, 0.0015, dA);
  float bodyM = 1.0 - smoothstep(-0.0015, 0.0015, cres);
  float hollowM = inA * (1.0 - bodyM);
  float ed = -dA;                                          // distance in from the outer rim
  // body: contour stripes follow the outer edge
  float wob = hk_fbm(p * 5.0 + 3.0) * 0.5;
  float stripe = smoothstep(0.42, 0.50, abs(fract(ed * 30.0 + wob) - 0.5) * 2.0);
  vec3 bodyCol = mix(vec3(0.05, 0.12, 0.27), vec3(0.16, 0.34, 0.54), smoothstep(0.22, 0.0, ed));
  bodyCol = mix(bodyCol, bodyCol * 1.5 + 0.03, (1.0 - stripe) * 0.45 * smoothstep(0.0, 0.04, ed));
  // the hollow: below the curl, dark water; above it you see through to the sky
  float lowPart = smoothstep(cB.y - 0.10, cB.y + 0.02, p.y);
  vec3 face = mix(vec3(0.07, 0.17, 0.33), vec3(0.04, 0.10, 0.23), smoothstep(0.0, 0.3, length(p - cB) * 0.0 + p.y - cB.y));
  float faceStripe = smoothstep(0.42, 0.5, abs(fract((length(p - cB)) * 26.0 + wob * 0.6) - 0.5) * 2.0);
  face = mix(face, face * 1.55 + 0.03, (1.0 - faceStripe) * 0.40);
  vec3 wave = bodyCol;
  float showHollow = hollowM * lowPart;
  wave = mix(wave, face, hollowM);
  // keylines
  float key = smoothstep(0.0045, 0.0015, abs(dA)) + smoothstep(0.0045, 0.0015, abs(dB)) * inA;
  // foam: crisp lace on the crest, white along the curling lip, claws hanging into the hollow
  float lace = hk_fbm(p * 34.0 + vec2(t * 0.05, 0.0));
  float crestFoam = 1.0 - smoothstep(0.46, 0.50, lace * 0.9 + ed * 6.5 - 0.10);
  crestFoam *= step(0.0, ed);
  float lipFoam = 1.0 - smoothstep(0.46, 0.50, lace * 0.9 + abs(dB) * 11.0 - 0.10);
  lipFoam *= inA * step(0.0, -dB + 0.03);                  // lip foam sits on the body side of the hollow edge
  vec2 lb = p - cB;
  float ang = atan(lb.y, lb.x);
  float cellA = floor(ang * 6.5);
  float fa = fract(ang * 6.5);
  float flen = 0.030 + 0.075 * hk_hash(vec2(cellA, 3.0)) + 0.006 * sin(t * 0.5 + cellA * 2.0);
  float tipw = 1.0 - dB / flen;                            // dB grows into the hollow
  float claw = (dB > 0.0 && tipw > 0.0) ? smoothstep(0.02, -0.02, abs(fa - 0.5) * 2.0 - 0.85 * tipw) : 0.0;
  claw *= inA * smoothstep(-2.6, -2.0, ang) * (1.0 - smoothstep(0.1, 0.7, ang));
  float foam = clamp(max(max(crestFoam, lipFoam), claw), 0.0, 1.0);
  vec3 foamCol = mix(vec3(0.97, 0.96, 0.92), vec3(0.78, 0.88, 0.94), 0.35 * hk_noise(p * 80.0));
  wave = mix(wave, foamCol, foam);
  wave = mix(wave, vec3(0.03, 0.07, 0.16), clamp(key, 0.0, 1.0) * 0.8);
  // inside the hollow, high up, the sky shows through: a pale glaze with an ink edge
  float skyHole = hollowM * (1.0 - lowPart);
  wave = mix(wave, mix(col, vec3(0.92, 0.88, 0.76), 0.35), skyHole);
  // spray drops beyond the crest
  vec2 sg = p * 60.0;
  vec2 sid = floor(sg);
  float sh = hk_hash(sid);
  float spray = 0.0;
  if (sh > 0.80) {
    vec2 so = vec2(hk_hash(sid + 3.1), hk_hash(sid + 7.7)) * 0.6 + 0.2;
    float rr = length(fract(sg) - so);
    spray = smoothstep(0.17 + 0.1 * sh, 0.10 + 0.1 * sh, rr) * smoothstep(0.12, 0.01, dA) * smoothstep(-0.003, 0.004, dA);
  }
  col = mix(col, wave, inA);
  col = mix(col, foamCol, spray * (1.0 - inA));

  // pointer: a few drops of spray lifted around it
  if (m.x > -5.0) {
    vec2 mp = vec2(m.x * asp, m.y);
    vec2 g = (p - mp) * 70.0;
    vec2 gid = floor(g);
    float gh = hk_hash(gid + 9.0);
    float md = length(p - mp);
    if (gh > 0.9 && md < 0.14) {
      vec2 go = vec2(hk_hash(gid + 1.3), hk_hash(gid + 5.1)) * 0.6 + 0.2;
      col = mix(col, vec3(0.96, 0.95, 0.90), smoothstep(0.20, 0.06, length(fract(g) - go)) * smoothstep(0.14, 0.04, md) * 0.8);
    }
  }

  // woodblock print: paper fibres, a little ink unevenness, soft darker edges
  float fibre = hk_noise(vec2(p.x * 520.0, p.y * 60.0)) * hk_noise(vec2(p.x * 60.0, p.y * 520.0));
  float tooth = hk_noise(p * 300.0);
  col *= 0.95 + 0.07 * tooth - 0.03 * fibre;
  col *= 1.0 - 0.18 * pow(length((uv - 0.5) * vec2(1.0, 1.05)), 2.4);
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
