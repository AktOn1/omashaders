#version 440
// category: Trail
// desc: Apex line: a small double chevron sits at the pointer and points the way you are moving; behind it one smooth ribbon follows the pointer's path, white-hot at the head and cooling through amber to deep red as it tapers away, like a brake-light streak, with a few tail-light beads riding along it. Idle, only the little chevron remains
// motion: yes
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec4 h0;
  vec4 h1;
  vec4 h2;
  vec4 h3;
  vec4 h4;
  vec4 h5;
  vec4 h6;
  vec4 h7;
  vec4 hs;
};

vec2 P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  if (i == 8) return h3.zw;
  if (i == 9) return h4.xy;
  if (i == 10) return h4.zw;
  if (i == 11) return h5.xy;
  if (i == 12) return h5.zw;
  if (i == 13) return h6.xy;
  if (i == 14) return h6.zw;
  if (i == 15) return h7.xy;
  return h7.zw;
}

float al_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float al_seg(vec2 p, vec2 a, vec2 b, out float u) {
  vec2 ab = b - a;
  u = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return length(p - (a + ab * u));
}
// head-to-tail colour of the streak: white-hot, amber, signal red, deep red
vec3 al_heat(float s) {
  vec3 white = vec3(1.0, 0.95, 0.88);
  vec3 amber = vec3(1.0, 0.66, 0.16);
  vec3 red = vec3(1.0, 0.12, 0.08);
  vec3 deep = vec3(0.55, 0.02, 0.04);
  vec3 c = mix(white, amber, smoothstep(0.0, 0.14, s));
  c = mix(c, red, smoothstep(0.10, 0.40, s));
  return mix(c, deep, smoothstep(0.45, 0.95, s));
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float hy = hs.y;

  // quick reject: far from the whole path
  vec2 lo = mouse; vec2 hi = mouse;
  for (int i = 1; i <= 16; i++) { vec2 q = P(i); lo = min(lo, q); hi = max(hi, q); }
  float pad = 46.0 * sc;
  bool nearPath = p.x > lo.x - pad && p.x < hi.x + pad && p.y > lo.y - pad && p.y < hi.y + pad;
  if (!nearPath) { fragColor = vec4(0.0); return; }

  vec3 acc = vec3(0.0);
  float shade = 0.0;

  // the ribbon grows out of motion: no streak while the pointer rests
  float trailLen = length(mouse - P(8));
  float sf = smoothstep(2.0 * sc, 30.0 * sc, trailLen);

  // beads riding on the streak at fixed ages behind the pointer (seconds / 0.066)
  float bAge0 = 2.6; float bAge1 = 5.6; float bAge2 = 9.4;

  float body = 0.0; float core = 0.0; float glow = 0.0; vec3 bodyC = vec3(0.0); float bodyW = 0.0;
  float beadA = 0.0; vec3 beadC = vec3(0.0);
  if (sf > 0.001) {
    vec2 pm1 = mouse; vec2 a = mouse; vec2 b = P(1);
    for (int i = 0; i < 16; i++) {
      vec2 c = P(i < 14 ? i + 2 : 16);
      vec2 m = (-pm1 + 9.0 * a + 9.0 * b - c) / 16.0;
      float ag0 = i == 0 ? 0.0 : float(i) - 1.0 + hy;
      float ag1 = float(i) + hy;
      float agm = 0.5 * (ag0 + ag1);
      for (int h = 0; h < 2; h++) {
        vec2 s0 = h == 0 ? a : m;
        vec2 s1 = h == 0 ? m : b;
        float g0 = h == 0 ? ag0 : agm;
        float g1 = h == 0 ? agm : ag1;
        float u;
        float d = al_seg(p, s0, s1, u);
        float ag = mix(g0, g1, u);
        float s = clamp(ag / 15.5, 0.0, 1.0);
        float fall = pow(1.0 - s, 1.15);
        float hw = (5.2 * sc * pow(1.0 - s, 0.95) + 0.3 * sc) * sf;
        float cv = al_aa(d, hw) * fall;
        float cr = al_aa(d, hw * 0.36) * fall;
        float lumg = exp(-d * d / (hw * hw * 7.0 + 1.0)) * 0.36 * pow(1.0 - s, 1.6);
        if (cv > body) { body = cv; bodyC = al_heat(s); }
        core = max(core, cr);
        glow = max(glow, lumg);
        bodyW = max(bodyW, al_aa(d, hw * 1.9 + 1.5 * sc) * (1.0 - s) * 0.55);
      }
      // tail-light beads, positioned continuously by age
      for (int k = 0; k < 3; k++) {
        float A = k == 0 ? bAge0 : (k == 1 ? bAge1 : bAge2);
        if (A >= ag0 && A < ag1) {
          float f = (A - ag0) / max(ag1 - ag0, 0.0001);
          vec2 bp = f < 0.5 ? mix(a, m, f * 2.0) : mix(m, b, f * 2.0 - 1.0);
          vec2 dd = p - bp;
          float r2 = dot(dd, dd);
          float br = (3.6 - 0.5 * float(k)) * sc;
          float bs = A / 15.5;
          float v = exp(-r2 / (br * br)) * 1.2 + 0.40 * exp(-r2 / (br * br * 12.0));
          beadA += v * (1.0 - bs * 0.7) * sf;
          beadC = mix(vec3(1.0, 0.85, 0.55), al_heat(0.30 + 0.35 * bs), 0.45);
        }
      }
      pm1 = a; a = b; b = c;
    }
    acc += bodyC * body * 0.95 + vec3(1.0, 0.10, 0.06) * glow;
    acc += vec3(1.0, 0.90, 0.78) * core * 0.80;
    acc += beadC * beadA * 0.9;
    shade += bodyW * 0.70 + body * 0.20;
  }

  // the pointer: a double chevron pointing the way the pointer is going
  vec2 v = mouse - P(5);
  float vl = length(v);
  vec2 def = normalize(vec2(-0.45, -0.89));
  float kdir = smoothstep(5.0 * sc, 40.0 * sc, vl);
  vec2 fwd = normalize(mix(def, v / max(vl, 0.0001), kdir));
  vec2 nrm = vec2(-fwd.y, fwd.x);
  vec2 dp = p - mouse;
  float lx = dot(dp, -fwd);
  float ly = abs(dot(dp, nrm));
  float u1;
  float dA = al_seg(vec2(lx, ly), vec2(0.0), vec2(17.0 * sc, 10.5 * sc), u1);
  float dB = al_seg(vec2(lx, ly), vec2(13.5 * sc, 0.0), vec2(25.0 * sc, 7.8 * sc), u1);
  float chA = al_aa(dA, 1.7 * sc);
  float chAo = al_aa(dA, 3.3 * sc);
  float chB = al_aa(dB, 1.4 * sc) * 0.95;
  float chBo = al_aa(dB, 3.0 * sc);
  float pr2 = dot(dp, dp);
  float tipGlow = exp(-pr2 / (9.0 * sc * 9.0 * sc)) * 0.30;
  vec3 cw = vec3(1.0, 0.96, 0.90);
  vec3 cr = vec3(1.0, 0.16, 0.10);
  acc += cr * (chAo - chA) * 0.85 + cw * chA;
  acc += cr * chB + vec3(1.0, 0.45, 0.20) * (chBo - chB) * 0.25;
  acc += vec3(1.0, 0.30, 0.12) * tipGlow;
  shade += (chAo * 0.8 + chBo * 0.6 + tipGlow * 1.2) * 0.85;

  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  float sa = clamp(shade, 0.0, 0.62);
  vec3 ink = vec3(0.025, 0.012, 0.014);
  vec3 rgb = min(acc, vec3(la)) + ink * sa * (1.0 - la);
  float a2 = la + sa * (1.0 - la);
  fragColor = vec4(rgb, a2) * qt_Opacity;
}
