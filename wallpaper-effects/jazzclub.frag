// label: Smoky jazz club
// hint: a small stage in a dark smoky room, an amber spotlight cone full of drifting smoke, blurred bar lights, a double bass and a stool in silhouette; the spotlight slides toward the pointer
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

float jc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float jc_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(jc_hash(i), jc_hash(i + vec2(1, 0)), f.x), mix(jc_hash(i + vec2(0, 1)), jc_hash(i + vec2(1, 1)), f.x), f.y);
}
float jc_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * jc_noise(p); p = p * 2.03 + 9.0; a *= 0.5; }
  return v;
}
float jc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const vec3 JC_AMBER = vec3(1.0, 0.68, 0.26);
const vec3 JC_BLUE = vec3(0.16, 0.30, 0.78);
const float JC_FLOOR = 0.70;        // where the stage floor meets the back curtain

float jc_ell(vec2 q, vec2 c, vec2 r) { return (length((q - c) / r) - 1.0) * min(r.x, r.y); }
float jc_smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float jc_seg(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// double bass, upright: q is relative to the foot of the instrument (x across, y up in screen units)
float jc_bass(vec2 q) {
  const float K = 0.78;                              // overall size
  q /= K;
  float c = cos(0.04), s = sin(0.04);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  float lower = jc_ell(q, vec2(0.0, 0.19), vec2(0.100, 0.105));
  float upper = jc_ell(q, vec2(0.0, 0.385), vec2(0.064, 0.070));
  float shoulders = jc_ell(q, vec2(0.0, 0.452), vec2(0.028, 0.030));
  float body = jc_smin(jc_smin(lower, upper, 0.045), shoulders, 0.04);
  float neck = jc_seg(q, vec2(0.0, 0.45), vec2(0.0, 0.80), 0.010);
  float scroll = length(q - vec2(0.010, 0.822)) - 0.020;
  float pin = jc_seg(q, vec2(0.0, 0.085), vec2(0.0, -0.02), 0.0035);
  float d = min(min(body, neck), min(scroll, pin));
  return d * K;
}
// bar stool: seat, three legs and a foot ring
float jc_stool(vec2 q) {
  float seat = max(abs(q.x) - 0.050, abs(q.y - 0.355) - 0.012);
  float l1 = jc_seg(q, vec2(-0.040, 0.345), vec2(-0.062, 0.0), 0.005);
  float l2 = jc_seg(q, vec2(0.040, 0.345), vec2(0.062, 0.0), 0.005);
  float l3 = jc_seg(q, vec2(0.0, 0.345), vec2(0.0, 0.0), 0.004);
  float ring = jc_seg(q, vec2(-0.052, 0.14), vec2(0.052, 0.14), 0.004);
  return min(min(seat, min(l1, l2)), min(l3, ring));
}

// blurred bar lights: discs with a brighter rim, on a drifting grid
vec3 jc_bokeh(vec2 p, float cell, float seed, float t) {
  vec2 q = p / cell + vec2(seed * 3.7, seed * 1.3);
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = jc_hash(id + seed);
  float h2 = jc_hash(id + seed + 17.0);
  float h3 = jc_hash(id + seed + 41.0);
  vec2 off = (vec2(jc_hash(id + 3.0 + seed), jc_hash(id + 8.0 + seed)) - 0.5) * 0.2;
  float r = 0.15 + 0.15 * h2;
  float dd = length(f - off) / r;
  float disc = smoothstep(1.0, 0.82, dd) * (0.55 + 0.6 * smoothstep(0.55, 1.0, dd));
  vec3 c = h3 < 0.60 ? JC_AMBER : (h3 < 0.80 ? vec3(1.0, 0.86, 0.60) : (h3 < 0.94 ? vec3(0.25, 0.62, 1.0) : vec3(1.0, 0.35, 0.40)));
  float tw = 0.65 + 0.35 * sin(t * (0.25 + h * 0.5) + h2 * 6.28);
  return c * disc * tw * step(0.38, h);
}

// the spotlight: returns the light density at a point (cone + pool on the floor)
float jc_cone(vec2 p, vec2 S, vec2 T, out float poolK) {
  float s = (p.y - S.y) / (T.y - S.y);
  float axx = mix(S.x, T.x, s);
  float w = 0.03 + 0.215 * s;
  float across = abs(p.x - axx) / w;
  float inside = smoothstep(1.0, 0.45, across) * smoothstep(-0.02, 0.10, s) * smoothstep(1.02, 0.96, s);
  float along = 1.0 - 0.45 * clamp(s, 0.0, 1.0);
  vec2 pl = (p - vec2(T.x, T.y + 0.005)) / vec2(0.25, 0.058);
  poolK = smoothstep(1.0, 0.1, length(pl));
  return inside * along;
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
  float cx = 0.5 * asp;

  // ---- where the spot points: resting between bass and stool, sliding toward the pointer
  float tx = cx - 0.03 + 0.03 * sin(t * 0.13);
  if (hasM) tx = mix(tx, clamp(mp.x, cx - 0.55, cx + 0.55), 0.85);
  vec2 S = vec2(cx + (tx - cx) * 0.30 + 0.05, -0.08);
  vec2 T = vec2(tx, 0.775);
  float poolK;
  float cone = jc_cone(p, S, T, poolK);

  // smoke: slow rolling noise, thick inside the cone
  vec2 sq = vec2(p.x * 3.2 + t * 0.020, p.y * 2.4 - t * 0.050);
  float sm1 = jc_fbm(sq);
  float sm2 = jc_fbm(sq * 2.1 + vec2(5.0 - t * 0.03, t * 0.04));
  float smoke = smoothstep(0.25, 0.85, sm1 * 0.65 + sm2 * 0.45);

  vec3 col;
  float stageHalf = 0.60;
  float inStage = smoothstep(stageHalf + 0.012, stageHalf - 0.012, abs(p.x - cx));

  // ---- the room beyond the stage: a dark warm back-bar full of bokeh
  vec3 room = vec3(0.030, 0.022, 0.026) + vec3(0.07, 0.035, 0.015) * smoothstep(0.25, 0.8, uv.y) * smoothstep(0.55, 1.0, abs(p.x - cx) / stageHalf);
  float barZone = smoothstep(stageHalf * 0.95, stageHalf * 1.30, abs(p.x - cx)) * smoothstep(0.20, 0.42, uv.y) * smoothstep(0.98, 0.78, uv.y);
  vec3 bk = jc_bokeh(p, 0.19, 1.0, t) * 0.75 + jc_bokeh(p, 0.115, 2.0, t) * 0.65 + jc_bokeh(p, 0.065, 3.0, t) * 0.55;
  float topZone = 0.35 * smoothstep(0.30, 0.0, uv.y) * smoothstep(stageHalf * 0.8, stageHalf * 1.3, abs(p.x - cx));
  room += bk * (barZone * 0.95 + topZone);
  // blurred bottles and a lit shelf edge at the sides
  float shelf = smoothstep(0.012, 0.0, abs(uv.y - 0.60)) * smoothstep(stageHalf * 1.0, stageHalf * 1.2, abs(p.x - cx));
  room += JC_AMBER * shelf * 0.10;
  float bottles = smoothstep(0.55, 0.9, jc_noise(vec2(p.x * 26.0, 3.0))) * smoothstep(0.60, 0.45, uv.y) * smoothstep(0.30, 0.45, uv.y);
  room += vec3(0.20, 0.12, 0.05) * bottles * barZone * 0.5;

  // ---- the stage: blue-violet curtain with deep folds, a soft blue backlight, wooden floor in perspective
  float fold = 0.72 + 0.28 * sin(p.x * 34.0 + 2.5 * jc_noise(vec2(p.x * 2.5, 1.0)) + 0.5 * jc_noise(vec2(p.x * 9.0, 4.0)));
  float glowB = exp(-(pow((p.x - cx) / 0.50, 2.0) + pow((uv.y - 0.42) / 0.30, 2.0)));
  vec3 curtain = mix(vec3(0.025, 0.035, 0.095), vec3(0.15, 0.26, 0.62), glowB);
  curtain *= fold * (0.8 + 0.3 * smoothstep(0.0, JC_FLOOR, uv.y));
  curtain += JC_BLUE * 0.10 * sm1 * glowB;
  curtain *= 1.0 - 0.45 * smoothstep(0.12, 0.0, uv.y);                  // dark valance at the top
  vec3 stage;
  if (uv.y < JC_FLOOR) {
    stage = curtain;
  } else {
    float dy = uv.y - 0.46;
    float zf = 0.30 / dy;
    float X = (p.x - cx) * zf;
    float plank = abs(fract(X * 1.6) - 0.5);
    float seamL = smoothstep(0.48, 0.5, plank);
    float joint = step(0.5, jc_hash(vec2(floor(X * 1.6), floor(zf * 1.2)))) * smoothstep(0.03, 0.0, abs(fract(zf * 1.2) - 0.5));
    float grain = jc_noise(vec2(X * 14.0, zf * 2.0));
    vec3 wood = vec3(0.14, 0.085, 0.05) * (0.55 + 0.75 * grain) * (1.0 - 0.55 * seamL) * (1.0 - 0.4 * joint);
    float fr = smoothstep(JC_FLOOR, 1.0, uv.y);
    wood = wood * (0.45 + 0.7 * fr) + vec3(0.02, 0.035, 0.08) * (1.0 - fr) * glowB;
    wood += vec3(0.06, 0.10, 0.22) * smoothstep(0.05, 0.0, uv.y - JC_FLOOR) * glowB;       // floor reflects the blue backdrop at the far edge
    stage = wood;
  }
  // dark proscenium frame
  float edgeD = abs(p.x - cx) - stageHalf;
  float frame = smoothstep(0.0, 0.05, edgeD) ;
  stage *= 1.0 - 0.7 * smoothstep(-0.14, 0.0, edgeD);
  vec3 stageEdge = vec3(0.012, 0.012, 0.016) + JC_AMBER * 0.10 * smoothstep(0.012, 0.0, abs(edgeD));
  col = mix(room, mix(stage, stageEdge, 0.0), inStage);
  col = mix(col, stageEdge, smoothstep(stageHalf - 0.01, stageHalf + 0.0, abs(p.x - cx)) * smoothstep(stageHalf + 0.05, stageHalf + 0.01, abs(p.x - cx)));

  // ---- light from the spot on the stage: pool on the boards, glow on the curtain, smoke in the cone
  float spotK = 1.0;
  float onFloor = smoothstep(JC_FLOOR - 0.01, JC_FLOOR + 0.01, uv.y);
  col += JC_AMBER * poolK * onFloor * 0.85 * (0.75 + 0.5 * jc_noise(vec2(p.x * 20.0, p.y * 26.0)) * 0.7) * inStage;
  col += JC_AMBER * 0.20 * exp(-pow((p.x - tx) / 0.26, 2.0)) * (1.0 - onFloor) * smoothstep(0.02, 0.5, uv.y) * inStage * (0.5 + 0.7 * glowB);   // spill on the curtain
  float conic = cone * (0.38 + 1.05 * smoke);
  col *= 1.0 - 0.40 * min(conic, 1.0);
  col += vec3(1.0, 0.72, 0.36) * conic * 0.62;
  col = mix(col, col * vec3(0.92, 0.95, 1.05), 0.2);

  // ---- silhouettes: double bass at the left of the pool, a stool at the right (rim lit by the spot)
  {
    vec2 bq = vec2(p.x - (cx - 0.215), 0.785 - p.y);
    float db = jc_bass(bq);
    vec2 sq2 = vec2(p.x - (cx + 0.155), 0.800 - p.y);
    float ds = jc_stool(sq2);
    float dsil = min(db, ds);
    float cov = smoothstep(0.0015, -0.0015, dsil);
    // how much of the spot reaches each object
    float cb = jc_cone(vec2(cx - 0.215, 0.60), S, T, poolK);
    float lightB = clamp(cb * 0.9 + exp(-pow((cx - 0.215 - tx) / 0.30, 2.0)) * 0.55, 0.0, 1.0);
    float cs = jc_cone(vec2(cx + 0.155, 0.70), S, T, poolK);
    float lightS = clamp(cs * 0.9 + exp(-pow((cx + 0.155 - tx) / 0.30, 2.0)) * 0.55, 0.0, 1.0);
    float lightO = db < ds ? lightB : lightS;
    float cxo = db < ds ? (cx - 0.215) : (cx + 0.155);
    float rim = smoothstep(0.007, 0.0, -dsil) * step(dsil, 0.0);                 // thin edge band inside the shape
    float facing = smoothstep(-0.03, 0.03, (tx - p.x) * (cxo < tx ? 1.0 : 1.0) );
    float rimSide = mix(0.12, 1.0, facing);
    vec3 body = vec3(0.006, 0.007, 0.012) + JC_BLUE * 0.020 * glowB;
    vec3 sil = body + JC_AMBER * rim * (0.05 + 1.1 * lightO) * rimSide;
    col = mix(col, sil, cov);
    // soft contact shadows on the boards
    float shB = exp(-pow((p.x - (cx - 0.215 + 0.04)) / 0.10, 2.0) - pow((p.y - 0.80) / 0.014, 2.0));
    float shS = exp(-pow((p.x - (cx + 0.155 + 0.03)) / 0.07, 2.0) - pow((p.y - 0.815) / 0.012, 2.0));
    col *= 1.0 - 0.55 * max(shB, shS) * inStage;
  }

  // ---- room smoke: a cool blue veil in the dark, bright amber where the cone crosses it
  col += JC_BLUE * smoke * 0.10 * (0.4 + 0.6 * smoothstep(1.0, 0.2, uv.y)) * (0.6 + 0.4 * inStage);
  col += vec3(0.30, 0.16, 0.06) * smoke * (1.0 - inStage) * barZone * 0.10;

  // ---- candle tables in the foreground
  for (int k = 0; k < 2; k++) {
    float kf = float(k);
    vec2 tc = vec2(k == 0 ? 0.20 * asp : asp - 0.22 * asp, k == 0 ? 0.94 : 0.965);
    vec2 tq = (p - tc) / vec2(0.15, 0.030);
    float top = smoothstep(1.0, 0.92, length(tq));
    vec3 tcol = vec3(0.012, 0.009, 0.010) + JC_AMBER * 0.22 * smoothstep(0.55, 1.0, length(tq)) * smoothstep(0.0, -0.8, tq.y + 0.2);
    col = mix(col, tcol, top);
    vec2 cp = tc + vec2(0.0, -0.040);
    float fl = 0.80 + 0.20 * jc_noise(vec2(t * 3.0 + kf * 9.0, kf));
    float rr = length((p - cp) * vec2(1.0, 0.9));
    col += vec3(1.0, 0.62, 0.20) * (exp(-rr * rr / 0.00012) * 1.4 + exp(-rr * rr / 0.0045) * 0.38) * fl;
    // a glass catching the light
    float gl = smoothstep(0.012, 0.0, length((p - (tc + vec2(0.06, -0.020))) * vec2(1.0, 0.6)));
    col += JC_AMBER * gl * 0.12;
  }

  // ---- dust motes drifting in the beam
  float dust = 0.0;
  for (int k = 0; k < 2; k++) {
    float kf = float(k);
    float sc = 44.0 + 26.0 * kf;
    vec2 q = p * sc + vec2(t * (0.12 + 0.07 * kf), -t * (0.20 + 0.10 * kf)) + kf * 23.0;
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    vec2 off = (vec2(jc_hash(cell + 1.0), jc_hash(cell + 5.0)) - 0.5) * 0.6;
    float on = step(0.55, jc_hash(cell + 9.0 + kf));
    float tw = 0.5 + 0.5 * sin(t * (0.6 + jc_hash(cell) * 1.2) + jc_hash(cell + 2.0) * 6.28);
    dust += smoothstep(0.10, 0.0, length(f - off)) * on * tw;
  }
  col += vec3(1.0, 0.82, 0.55) * dust * (0.10 + 0.9 * cone) * 0.55;

  // let the picture tint the mood a little, soft vignette that keeps the mid tones alive
  col *= mix(vec3(1.0), 0.65 + 0.8 * pic, 0.16);
  col = col / (1.0 + 0.30 * col);
  col *= 1.0 - 0.30 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
  return vec4(clamp(col, 0.0, 1.0), 1.0) * qt_Opacity;
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
