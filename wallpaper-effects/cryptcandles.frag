// label: Crypt candles
// hint: a stone vault with an arched passage and four candles on iron stands, each flame flickering on its own, dust motes drifting in the warm light and the cold breathing off the stone at the edges; flames lean toward the pointer
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
float cc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cc_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cc_hash(i), cc_hash(i + vec2(1, 0)), f.x), mix(cc_hash(i + vec2(0, 1)), cc_hash(i + vec2(1, 1)), f.x), f.y);
}
float cc_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * cc_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float cc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float cc_box(vec2 p, vec2 c, vec2 h, float aa) {
  vec2 d = abs(p - c) - h;
  return smoothstep(aa, -aa, max(d.x, d.y));
}
float cc_ell(vec2 p, vec2 c, vec2 h, float aa) {
  return smoothstep(aa, -aa, (length((p - c) / h) - 1.0) * min(h.x, h.y));
}
float cc_seg(vec2 p, vec2 a, vec2 b, float w, float aa) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return smoothstep(w + aa, w - aa, length(pa - ba * h));
}

const vec2 CC_VP = vec2(0.5, 0.47);
// the four candles: x as a fraction of the aspect, where the stand meets the floor, and a scale (nearer = larger)
vec3 cc_cd(int i, float asp) {
  if (i == 0) return vec3(0.15 * asp, 0.965, 1.00);
  if (i == 1) return vec3(0.82 * asp, 0.845, 0.72);
  if (i == 2) return vec3(0.34 * asp, 0.700, 0.43);
  return vec3(0.645 * asp, 0.632, 0.29);
}
vec2 cc_flamePos(int i, float asp) { vec3 c = cc_cd(i, asp); return vec2(c.x, c.y - 0.405 * c.z); }
float cc_flick(int i, float t) {
  float fi = float(i);
  return 0.84 + 0.16 * sin(t * (6.0 + 1.7 * fi) + fi * 2.3) * sin(t * (2.9 + 0.8 * fi) + fi) + 0.16 * (cc_noise(vec2(t * (7.0 + fi), fi * 5.0)) - 0.5);
}
// light of all four flames at a point: more reach on the floor and the ceiling than on the sides
float cc_pool(vec2 p, float asp, float t, float boost) {
  float L = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 c = cc_cd(i, asp);
    vec2 fp = cc_flamePos(i, asp);
    float sg = 0.06 + 0.22 * c.z;
    vec2 d = (p - fp) / vec2(sg, sg * 1.25);
    L += (exp(-dot(d, d)) + 0.10 * exp(-length(d) * 0.9)) * cc_flick(i, t) * (0.50 + 0.70 * c.z) * boost;
  }
  return L;
}

// the tunnel metric: a rounded vault, flat floor
float cc_r(vec2 uv) {
  vec2 q = vec2((uv.x - CC_VP.x) * 2.0, (uv.y - CC_VP.y) / (uv.y < CC_VP.y ? CC_VP.y : 1.0 - CC_VP.y));
  float P = mix(2.6, 6.5, smoothstep(-0.2, 0.2, q.y));
  return pow(pow(abs(q.x), P) + pow(abs(q.y), P), 1.0 / P);
}
// the stone: height (x), block tone (y), depth (z) and rib mask (w)
vec4 cc_stone(vec2 uv) {
  vec2 q = vec2((uv.x - CC_VP.x) * 2.0, (uv.y - CC_VP.y) / (uv.y < CC_VP.y ? CC_VP.y : 1.0 - CC_VP.y));
  float r = cc_r(uv);
  float z = 1.0 / max(r, 0.02);
  float u = atan(q.y, q.x) * 0.159155;
  float zc = z * 2.4;
  float row = floor(zc);
  float ub = u * 20.0 + 0.5 * mod(row, 2.0);
  vec2 cell = vec2(floor(ub), row);
  float lx = 0.5 - abs(fract(ub) - 0.5);
  float lz = 0.5 - abs(fract(zc) - 0.5);
  float fw = fwidth(zc) * 1.2 + 0.003;
  float joint = max(0.45 * smoothstep(0.035 + fw, 0.012, lx * 0.5), smoothstep(0.05 + fw, 0.018, lz));   // mortar, soft far away
  float tone = 0.68 + 0.50 * cc_hash(cell) + 0.35 * (cc_fbm3(vec2(ub * 2.2, zc * 3.0)) - 0.5);
  float rib = smoothstep(0.050, 0.020, abs(fract((z - 0.2) * 0.55) - 0.5));
  float grain = cc_noise(vec2(ub * 7.0, zc * 9.0)) * 0.55 + cc_noise(vec2(ub * 19.0, zc * 23.0)) * 0.45;
  float h = (1.0 - joint) * (0.70 + 0.30 * grain) + 0.30 * rib;
  float fade = smoothstep(0.06, 0.30, r);
  return vec4(mix(0.7, h, fade), mix(0.9, tone * (1.0 - 0.45 * joint) * (1.0 + 0.30 * rib), fade), z, rib);
}

// one candle on its stand; lit by its own flame (pool) and tinted by the cold ambient
void cc_candle(vec2 p, vec3 cd, float fl, float lean, float t, int id, float aa, float pool, inout vec3 col) {
  float s = cd.z;
  vec2 q = (p - vec2(cd.x, cd.y)) / s;
  float aq = aa / s;
  if (abs(q.x) > 0.12 || q.y > 0.02 || q.y < -0.52) return;
  vec3 iron = vec3(0.020, 0.020, 0.024) + vec3(0.9, 0.5, 0.2) * pool * 0.045;
  float stand = cc_box(q, vec2(0.0, -0.15), vec2(0.0042, 0.15), aq);
  stand = max(stand, cc_seg(q, vec2(0.0, -0.05), vec2(0.052, 0.0), 0.0042, aq));
  stand = max(stand, cc_seg(q, vec2(0.0, -0.05), vec2(-0.052, 0.0), 0.0042, aq));
  stand = max(stand, cc_ell(q, vec2(0.0, -0.17), vec2(0.0115, 0.0085), aq));
  stand = max(stand, cc_ell(q, vec2(0.0, -0.245), vec2(0.0085, 0.006), aq));
  float dish = max(cc_ell(q, vec2(0.0, -0.292), vec2(0.032, 0.0075), aq), cc_ell(q, vec2(0.0, -0.284), vec2(0.022, 0.012), aq));
  float rimLight = smoothstep(0.0, -0.004, q.y + 0.296) * 0.0;
  col = mix(col, iron, stand * 0.97);
  col = mix(col, iron * 1.6 + vec3(0.9, 0.55, 0.25) * pool * 0.10, dish * 0.97);
  // the wax: a pale cylinder lit from its own flame at the top
  float cb = cc_box(q, vec2(0.0, -0.334), vec2(0.0098, 0.043), aq);
  float cyl = 1.0 - pow(abs(q.x) / 0.0098, 2.0) * 0.65;
  float lit = 0.30 + 0.70 * smoothstep(-0.292, -0.376, q.y);
  vec3 wax = vec3(0.90, 0.80, 0.60) * cyl * lit * (0.45 + 0.9 * min(pool, 1.4)) + vec3(0.04, 0.06, 0.08);
  float drip = cc_box(q, vec2(0.0042, -0.360 + 0.5 * 0.012), vec2(0.0019, 0.012 + 0.012 * cc_hash(vec2(float(id), 2.0))), aq)
             + cc_box(q, vec2(-0.0052, -0.360 + 0.5 * 0.022), vec2(0.0017, 0.020 + 0.01 * cc_hash(vec2(float(id), 5.0))), aq);
  wax += vec3(0.30, 0.22, 0.12) * clamp(drip, 0.0, 1.0) * lit;
  col = mix(col, wax, cb);
  float topEll = cc_ell(q, vec2(0.0, -0.377), vec2(0.0098, 0.0032), aq);
  col = mix(col, vec3(1.0, 0.86, 0.55) * (0.55 + 0.45 * fl), topEll);
  float wick = cc_box(q, vec2(0.0, -0.384), vec2(0.0006, 0.005), aq);
  col = mix(col, vec3(0.02), wick);
  // the flame: a teardrop, narrow at the wick, leaning with the draught and toward the pointer
  float H = 0.056 * (0.80 + 0.40 * fl);
  vec2 fq = q - vec2(0.0, -0.383);
  float yy = -fq.y / H;
  float sway = 0.0030 * sin(t * (8.0 + float(id)) + yy * 6.0 + float(id) * 3.0) * yy + lean * 0.055 * yy * yy;
  fq.x -= sway;
  float hw = 0.0112 * pow(max(sin(3.14159 * pow(clamp(yy, 0.0, 1.0), 0.58)), 0.0), 0.85);
  float fm = smoothstep(aq * 1.2, -aq * 1.2, abs(fq.x) - hw) * step(0.0, yy) * step(yy, 1.0);
  float core = pow(clamp(1.0 - abs(fq.x) / max(hw, 1e-4), 0.0, 1.0), 0.85) * (1.0 - 0.40 * yy);
  vec3 fc = mix(vec3(1.0, 0.40, 0.08), vec3(1.0, 0.94, 0.66), core);
  fc = mix(fc, vec3(0.55, 0.65, 1.0), smoothstep(0.16, 0.0, yy) * 0.55 * smoothstep(0.0, 0.5, core));
  col = mix(col, fc * (0.85 + 0.3 * fl), fm);
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

  // nearness of the pointer to the flames brightens them a little, and bends them
  float boost = 1.0;
  if (hasM) boost += 0.25 * exp(-length(mp - vec2(0.5 * asp, 0.55)) / 0.9);

  // ---- the vault
  vec4 st = cc_stone(uv);
  float r = cc_r(uv);
  float pool = cc_pool(p, asp, t, boost);
  // bump lighting from the strongest side
  vec2 lc = vec2(0.0);
  for (int i = 0; i < 4; i++) lc += cc_flamePos(i, asp) * cc_cd(i, asp).z;
  lc /= 2.44;
  vec2 ld = normalize(lc - p + vec2(0.0001));
  vec4 st2 = cc_stone(uv + vec2(ld.x / asp, ld.y) * 0.0035);
  float bump = clamp(0.55 + (st.x - st2.x) * 2.4, 0.0, 1.3);

  vec3 stone = vec3(0.42, 0.42, 0.42) * st.y;
  vec3 amb = vec3(0.030, 0.050, 0.075) * (1.0 + 2.0 * exp(-r * 5.0)) * (0.55 + 0.45 * st.x);
  vec3 warmCol = vec3(1.0, 0.60, 0.26);
  float lightK = pool * (0.50 + 1.25 * bump);
  vec3 col = stone * (amb + warmCol * lightK * 0.55);
  // each rib is a pale stone arch that catches the light a little more
  col += warmCol * stone * st.w * pool * 0.12;

  // ---- the far end: a dark wall with an arched way out into the cold, the user's picture glimmering in it
  float endWall = smoothstep(0.150, 0.125, r);
  col = mix(col, vec3(0.020, 0.030, 0.040) * (0.7 + 0.6 * st.y) + vec3(0.9, 0.55, 0.25) * pool * 0.02, endWall);
  vec2 dq = vec2((uv.x - CC_VP.x) * asp, uv.y - 0.50);
  float dh = 0.082, dw = 0.044;                                        // arch: half-width, height above the sill
  float dyy = clamp(-dq.y / dh, 0.0, 1.0);
  float archW = dw * pow(max(1.0 - pow(dyy, 2.2), 0.0), 0.5);
  float door = smoothstep(aa * 1.5, -aa * 1.5, abs(dq.x) - archW) * smoothstep(-aa, aa, dq.y + dh) * smoothstep(aa, -aa, dq.y - 0.045) * endWall;
  vec2 puv = vec2(0.5, 0.47) + (uv - vec2(0.5, 0.47)) * 2.6;
  vec3 outside = wall(puv) * vec3(0.42, 0.60, 0.74) * 0.60 + vec3(0.030, 0.055, 0.085);
  outside *= 0.80 + 0.20 * sin(t * 0.5);
  col = mix(col, outside, door);
  // cold light spilling in the doorway and on the floor in front of it
  col += vec3(0.16, 0.28, 0.38) * exp(-pow(dq.x / 0.07, 2.0)) * smoothstep(0.045, 0.12, dq.y) * exp(-(dq.y - 0.045) * 6.0) * 0.20;

  // ---- the stone breathes cold at the edges: a pale blue haze that swells and ebbs
  float breath = 0.55 + 0.45 * sin(t * 0.42);
  float cold = smoothstep(0.62, 1.15, r) * (0.55 + 0.9 * cc_fbm3(vec2(uv.x * 3.0, uv.y * 4.0) + t * 0.03));
  col += vec3(0.075, 0.125, 0.165) * cold * (0.35 + 0.65 * breath) * (1.0 - clamp(pool * 0.6, 0.0, 0.8));

  // glints of the flames on the polished floor
  for (int i = 0; i < 4; i++) {
    vec3 cd = cc_cd(i, asp);
    float dy = uv.y - cd.y;
    float streak = exp(-pow((p.x - cd.x) / (0.020 * cd.z + 0.004 * dy), 2.0)) * smoothstep(0.0, 0.01, dy) * exp(-dy / (0.12 * cd.z)) * 0.35 * cc_flick(i, t) * (0.5 + 0.5 * cc_noise(vec2(uv.y * 90.0, t * 1.5 + float(i))));
    col += vec3(1.0, 0.58, 0.24) * streak * cd.z;
  }

  // ---- the candles, farthest first
  for (int k = 0; k < 4; k++) {
    int i = 3 - k;
    vec3 cd = cc_cd(i, asp);
    vec2 fp = cc_flamePos(i, asp);
    float lean = 0.0;
    float prox = 0.0;
    if (hasM) { prox = exp(-length(mp - fp) / 0.55); lean = clamp((mp.x - fp.x) * 3.0, -1.0, 1.0) * prox; }
    float fl = cc_flick(i, t) * (1.0 + 0.12 * prox);
    vec2 bq = (p - fp) / cd.z;
    col += vec3(1.0, 0.58, 0.22) * exp(-length(bq * vec2(1.0, 0.8) + vec2(0.0, 0.022)) / 0.060) * 0.55 * fl * (0.4 + 0.6 * cd.z);
    cc_candle(p, cd, fl, lean, t, i, aa, cc_pool(vec2(cd.x, cd.y - 0.2 * cd.z), asp, t, boost), col);
  }

  // ---- dust motes in the warm light: two layers of cells, each holding one drifting speck
  vec3 dust = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float fl2 = float(l);
    vec2 g = p * (15.0 + 11.0 * fl2) + vec2(t * (0.10 + 0.05 * fl2), -t * (0.14 + 0.06 * fl2));
    vec2 id = floor(g);
    vec2 f = fract(g);
    float h1 = cc_hash(id + 3.0 * fl2), h2 = cc_hash(id + 11.0 + fl2), h3 = cc_hash(id + 23.0);
    vec2 c = vec2(0.5 + 0.28 * sin(t * (0.35 + 0.3 * h3) + h1 * 6.28), 0.5 + 0.28 * cos(t * (0.30 + 0.3 * h1) + h2 * 6.28));
    float d = length((f - c)) ;
    float tw = 0.45 + 0.55 * sin(t * (0.9 + h2) + h3 * 30.0);
    float pl = cc_pool(p, asp, t, boost);
    float sp = smoothstep(0.075 - 0.02 * fl2, 0.0, d) * step(0.55, h1) * tw;
    dust += vec3(1.0, 0.78, 0.46) * sp * clamp(pl, 0.0, 1.3) * (0.9 - 0.35 * fl2);
  }
  col += dust * 0.9;

  // let the user's picture colour the cold ambient very slightly
  col += pic * vec3(0.4, 0.55, 0.7) * 0.03 * (1.0 - clamp(pool, 0.0, 1.0));
  col *= 1.0 - 0.32 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
