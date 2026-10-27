#version 440
// category: Trail
// desc: Lumen wake: a small lens-flare comet fixed to the pointer, a cyan-white core with a steady faint halo ring and a four-ray glint whose long amber arm is anamorphic and stretches with the pointer's speed; a thin tapered ribbon of light follows the movement and fades out, with a few hair-thin hyper streaks beside it at speed; it breathes slowly when idle
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

// Pointer history: P(0) is the pointer, P(1) the newest sample, P(16) the oldest (about one second back).
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
float AGE(int i) { return i == 0 ? 0.0 : (float(i) - 1.0 + hs.y) / 16.0; }

// unit normal of the path at history point i (from its two neighbours, so the hyper streaks bend smoothly)
vec2 lw_normal(int i) {
  vec2 t = P(i > 0 ? i - 1 : 0) - P(i < 16 ? i + 1 : 16);   // no int min/max: GLSL ES 1.00 has none
  float l = length(t);
  return l < 1e-3 ? vec2(0.0, 1.0) : vec2(-t.y, t.x) / l;
}

vec2 lw_seg(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return vec2(length(p - a - ba * h), h);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }

  const vec3 cy = vec3(0.45, 0.92, 1.0);      // cyan light
  const vec3 wh = vec3(0.86, 0.98, 1.0);      // the hot white-cyan of the core
  const vec3 am = vec3(1.0, 0.66, 0.25);      // amber glint

  // how fast the pointer is going, px/s, measured over the last four samples so it stays smooth
  float v = distance(mouse, P(4)) / max(4.0 * hs.z, 0.01);
  float sp = smoothstep(220.0, 2200.0, v);                 // 0 at rest, 1 flat out
  float gate = smoothstep(70.0, 380.0, v);                 // the ribbon only exists while it moves
  float pulse = 0.5 + 0.5 * sin(time * 1.5707963);         // 4 s breath

  vec3 acc = vec3(0.0);
  float shade = 0.0;                                       // dark ink under the lights

  // ---------------- the head: core, halo, glint (one object, always at the pointer)
  vec2 d = p - mouse;
  float r = length(d);
  float ax = abs(d.x), ay = abs(d.y);

  float hot = exp(-r * r / (2.0 * 2.3 * 2.3));
  float bloom = 0.60 * exp(-r / 6.5) + 0.16 * exp(-r / 20.0);
  acc += wh * hot * 1.15 + cy * bloom * (0.85 + 0.15 * pulse);
  shade += 0.38 * exp(-r * r / (2.0 * 13.0 * 13.0));

  // one steady faint ring of constant radius, lit a little more on the upper left like a lens rim
  float R = 34.0;
  float ang = atan(d.y, d.x);
  float rimk = 0.62 + 0.38 * cos(ang + 2.4);
  float ring = exp(-pow((r - R) / 1.15, 2.0)) * 0.34 + exp(-pow((r - R) / 5.5, 2.0)) * 0.07;
  acc += mix(cy, wh, 0.25) * ring * rimk;
  shade += 0.15 * exp(-pow((r - R) / 3.0, 2.0));

  // four-ray glint: long horizontal anamorphic arm (amber toward its tip), short vertical arm
  float breath = 0.80 + 0.20 * pulse;
  float Lh = mix(44.0, 128.0, sp) * (0.90 + 0.10 * pulse);
  float tw = 1.0 + 1.9 * exp(-ax / 10.0);                 // a little fatter near the centre
  float alongH = pow(clamp(1.0 - ax / Lh, 0.0, 1.0), 2.1);
  float armH = exp(-ay * ay / (2.0 * tw * tw * 0.55)) * alongH;
  float hazeH = exp(-ay * ay / (2.0 * 6.0 * 6.0)) * alongH * alongH * 0.42;
  vec3 hc = mix(wh, am, smoothstep(0.02, 0.40, ax / Lh));
  acc += hc * armH * 0.95 * breath + am * hazeH * (0.6 + 0.4 * sp) * breath;
  shade += 0.20 * exp(-ay / 5.0) * alongH;

  float Lv = 25.0 + 8.0 * pulse;
  float twv = 1.0 + 1.6 * exp(-ay / 9.0);
  float alongV = pow(clamp(1.0 - ay / Lv, 0.0, 1.0), 2.0);
  float armV = exp(-ax * ax / (2.0 * twv * twv * 0.5)) * alongV;
  acc += mix(wh, cy, 0.4) * armV * 0.80 * breath;

  // ---------------- the wake: tapered ribbon and hyper streaks through the history points
  if (gate > 0.0) {
    float Lmax = mix(80.0, 300.0, smoothstep(250.0, 2000.0, v));
    // bounding box of the path, so the 100 segment tests below are skipped for almost every pixel
    vec2 lo = mouse, hi = mouse;
    for (int i = 1; i <= 16; i++) { vec2 q = P(i); lo = min(lo, q); hi = max(hi, q); }
    vec2 pad = vec2(34.0);
    if (p.x > lo.x - pad.x && p.x < hi.x + pad.x && p.y > lo.y - pad.y && p.y < hi.y + pad.y) {
      float rib = 0.0, ribGlow = 0.0, ribS = 0.0;
      float s0 = 0.0, s1 = 0.0, s2 = 0.0;                 // hyper streak strengths
      float cum = 0.0;
      vec2 nA = lw_normal(0);
      for (int i = 0; i < 16; i++) {
        vec2 a = P(i), b = P(i + 1);
        vec2 nB = lw_normal(i + 1);
        float len = distance(a, b);
        if (cum > Lmax) break;
        float sa = cum, sb = cum + len;
        float ageA = AGE(i), ageB = AGE(i + 1);
        vec2 sg = lw_seg(p, a, b);
        float s = mix(sa, sb, sg.y);
        float age = mix(ageA, ageB, sg.y);
        float u = clamp(s / Lmax, 0.0, 1.0);
        float fade = pow(1.0 - u, 1.7) * pow(1.0 - age, 1.1);
        // thin and crisp at the head, tapering to nothing
        float w = mix(3.0, 0.4, pow(u, 0.55));
        float core = smoothstep(w, w * 0.30, sg.x) * fade;
        float glow = exp(-sg.x / (w * 3.0 + 1.5)) * 0.30 * fade;
        if (core + glow > rib + ribGlow) { rib = core; ribGlow = glow; ribS = u; }

        // hyper streaks: three hair-thin lines that fan out from the head and run parallel
        float oA = smoothstep(0.0, Lmax * 0.6, sa), oB = smoothstep(0.0, Lmax * 0.6, sb);
        vec2 q0a = a + nA * (-11.0 * oA), q0b = b + nB * (-11.0 * oB);
        vec2 q1a = a + nA * (7.5 * oA),   q1b = b + nB * (7.5 * oB);
        vec2 q2a = a + nA * (17.0 * oA),  q2b = b + nB * (17.0 * oB);
        vec2 g0 = lw_seg(p, q0a, q0b), g1 = lw_seg(p, q1a, q1b), g2 = lw_seg(p, q2a, q2b);
        float ss0 = mix(sa, sb, g0.y), ss1 = mix(sa, sb, g1.y), ss2 = mix(sa, sb, g2.y);
        float f0 = pow(clamp(1.0 - ss0 / (Lmax * 0.92), 0.0, 1.0), 1.5) * smoothstep(6.0, 30.0, ss0);
        float f1 = pow(clamp(1.0 - ss1 / (Lmax * 0.66), 0.0, 1.0), 1.5) * smoothstep(4.0, 24.0, ss1);
        float f2 = pow(clamp(1.0 - ss2 / (Lmax * 0.46), 0.0, 1.0), 1.5) * smoothstep(8.0, 34.0, ss2);
        float ag0 = pow(1.0 - mix(ageA, ageB, g0.y), 1.1), ag1 = pow(1.0 - mix(ageA, ageB, g1.y), 1.1), ag2 = pow(1.0 - mix(ageA, ageB, g2.y), 1.1);
        s0 = max(s0, (smoothstep(1.4, 0.3, g0.x) + 0.25 * smoothstep(5.0, 0.0, g0.x)) * f0 * ag0);
        s1 = max(s1, (smoothstep(1.4, 0.3, g1.x) + 0.25 * smoothstep(5.0, 0.0, g1.x)) * f1 * ag1);
        s2 = max(s2, (smoothstep(1.4, 0.3, g2.x) + 0.25 * smoothstep(5.0, 0.0, g2.x)) * f2 * ag2);
        cum = sb;
        nA = nB;
      }
      // ribbon colour: white-cyan at the head, cyan along the body, a breath of violet-blue at the very end
      vec3 rc = mix(wh, cy, smoothstep(0.0, 0.35, ribS));
      rc = mix(rc, vec3(0.30, 0.55, 1.0), smoothstep(0.55, 1.0, ribS) * 0.7);
      acc += rc * (rib * 0.95 + ribGlow) * gate;
      acc += (cy * s0 + am * s1 + vec3(0.82, 0.5, 1.0) * s2 * 0.8) * 0.85 * smoothstep(0.12, 0.65, sp) * gate;
      shade += (min(rib, 1.0) * 0.40 + ribGlow * 1.2) * gate * 0.85;
      shade += (s0 + s1 + s2) * 0.14 * smoothstep(0.12, 0.65, sp);
    }
  }

  // ---------------- compose: ink underneath so the lights read on bright pictures, light on top, premultiplied
  vec3 ink = vec3(0.012, 0.05, 0.085);
  float sa = clamp(shade, 0.0, 0.62);
  float la = clamp(max(acc.r, max(acc.g, acc.b)) * 0.94, 0.0, 1.0);
  vec3 col = min(acc, vec3(la)) + ink * sa * (1.0 - la);
  float a = la + sa * (1.0 - la);
  fragColor = vec4(col, a) * qt_Opacity;
}
