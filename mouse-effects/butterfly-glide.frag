#version 440
// category: Trail
// desc: Butterfly glide: one small butterfly rides along with the pointer, flapping its two-tone golden wings, lagging behind a little and drifting in a gentle looping wobble along the path the pointer took; it leaves a faint glitter of pollen dust that fades away quickly. A soft shade under it keeps it readable on bright pictures
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

float bg_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float bg_aa(float d) { return clamp(0.5 - d, 0.0, 1.0); }

// distance-like value of a rotated ellipse in the wing plane, and the screen-space gradient length used to antialias it
float bg_ell(vec2 q, vec2 c, vec2 r, float f, out float g) {
  vec2 d = q - c;
  float e = length(d / r);
  vec2 n = normalize(d / (r * r) + vec2(0.00001));
  g = length(vec2(n.x / f, n.y));
  return (e - 1.0) * min(r.x, r.y);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float hy = hs.y;
  float t = time;

  // where the butterfly flies: a little behind and above the pointer, in a slow loop, following the path
  vec2 lagP = mix(P(1), P(2), 0.5);
  vec2 vel = P(0) - P(6);
  float sp = length(vel);
  vec2 wob = vec2(cos(t * 2.1) * 9.0 + sin(t * 3.7) * 3.0, sin(t * 2.7) * 7.0 + cos(t * 4.3) * 2.5) * sc;
  vec2 hover = vec2(15.0, -13.0) * sc;
  vec2 B = lagP + (hover + wob) * (0.55 + 0.45 * smoothstep(40.0 * sc, 5.0 * sc, sp));
  // the loop opens up into a gentle sway while moving
  vec2 vdir = sp > 0.5 ? vel / sp : vec2(0.0);
  B += vec2(-vdir.y, vdir.x) * sin(t * 5.3) * 4.0 * sc * smoothstep(5.0 * sc, 60.0 * sc, sp);

  float S = 17.0 * sc;

  vec3 acc = vec3(0.0);
  float shade = 0.0;
  vec4 bcol4 = vec4(0.0);

  // pollen dust: glitter points scattered along the path, falling slowly and fading fast
  for (int i = 3; i <= 15; i++) {
    for (int j = 0; j < 2; j++) {
      float age = (float(i) - 1.0 + float(j) * 0.5 + hy) / 16.0;
      vec2 a0 = P(i); vec2 a1 = P(i + 1);
      vec2 pos = mix(a0, a1, float(j) * 0.5);
      float id = mod(hs.x - float(i) + 1.0, 4096.0) * 2.0 + float(j);
      float h1 = bg_h(vec2(id, 1.7));
      float h2 = bg_h(vec2(id, 5.3));
      float h3 = bg_h(vec2(id, 9.9));
      if (h3 > 0.80) continue;
      pos += (vec2(h1, h2) - 0.5) * 2.0 * (7.0 + 10.0 * age) * sc + vec2(0.0, 20.0 * age * age) * sc;
      vec2 d = p - pos;
      float r2 = dot(d, d);
      float rad = (1.0 + 1.0 * h2) * sc;
      if (r2 > 14.0 * rad * rad * 4.0) continue;
      float life = pow(clamp(1.0 - age * 1.15, 0.0, 1.0), 1.6);
      float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * (6.0 + 6.0 * h1) + h3 * 70.0), 2.0);
      float core = exp(-r2 / (rad * rad));
      float glow = exp(-r2 / (rad * rad * 9.0)) * 0.22;
      float cross = (exp(-abs(d.x) / (0.55 * sc)) * exp(-abs(d.y) / (rad * 3.6)) + exp(-abs(d.y) / (0.55 * sc)) * exp(-abs(d.x) / (rad * 3.6))) * 0.5 * step(0.5, h1);
      vec3 dc = h2 > 0.82 ? vec3(1.0, 0.82, 0.88) : (h2 > 0.30 ? vec3(1.0, 0.88, 0.45) : vec3(0.96, 1.0, 0.82));
      float a = (core + glow + cross) * tw * life;
      acc += dc * a;
      shade += (core * 0.45 + glow) * life * 0.7;
    }
  }

  // the butterfly: heading follows the motion, wanders gently when the pointer rests
  vec2 hv = vdir * smoothstep(8.0 * sc, 50.0 * sc, sp) + vec2(sin(t * 0.8), -0.8 - 0.2 * cos(t * 0.6)) * 0.6;
  hv = normalize(hv + vec2(0.0001));
  vec2 ev = vec2(-hv.y, hv.x);
  vec2 dB = p - B;
  float u = dot(dB, hv) / S;     // along the body, 1 = one body-scale towards the head
  float v = dot(dB, ev) / S;     // across
  float flapT = t * 14.0;
  float f = 0.16 + 0.84 * pow(0.5 + 0.5 * cos(flapT), 0.85);
  float av = abs(v);
  vec2 q = vec2(av / f, u);      // the open wing, unfolded

  if (length(dB) < 2.6 * S) {
    float gF, gH;
    // fore wing: a long ellipse swept out and forward from the root; hind wing: a rounder one swept out and back
    const float cf = 0.8365; const float sf = 0.5480;   // 33 degrees
    const float ch = 0.8253; const float sh = 0.5646;   // 34 degrees
    vec2 dq = q - vec2(0.05, 0.02);
    vec2 qF = vec2(cf * dq.x + sf * dq.y, -sf * dq.x + cf * dq.y);
    vec2 dq2 = q - vec2(0.05, -0.04);
    vec2 qH = vec2(ch * dq2.x - sh * dq2.y, sh * dq2.x + ch * dq2.y);
    float dF = bg_ell(qF, vec2(0.95, 0.0), vec2(1.00, 0.52), f, gF);
    dF += 0.10 * max(0.0, 0.25 - qF.x);
    float dH = bg_ell(qH, vec2(0.60, 0.0), vec2(0.66, 0.44), f, gH);
    dH += 0.10 * max(0.0, 0.2 - qH.x);
    float covF = bg_aa(dF * S * gF);
    float covH = bg_aa(dH * S * gH);
    float wingMask = max(covF, covH);

    vec3 col = vec3(0.0);
    if (wingMask > 0.0) {
      // hind wing: pale buttercup, a small poppy spot, dark rim with tiny white dots
      vec3 hcol = mix(vec3(1.0, 0.95, 0.55), vec3(1.0, 0.80, 0.25), smoothstep(-0.5, -0.1, dH));
      float bandH = smoothstep(-0.17, -0.05, dH);
      hcol = mix(hcol, vec3(0.14, 0.17, 0.07), bandH);
      hcol = mix(hcol, vec3(0.92, 0.18, 0.10), bg_aa((length(qH - vec2(0.50, 0.0)) / 0.075 - 1.0) * 0.075 * S) * (1.0 - bandH));
      vec2 rH = qH - vec2(0.60, 0.0);
      float sH = fract(atan(rH.y, rH.x) * 1.4324 + 0.5) - 0.5;
      float spH = bg_aa((length(vec2(sH * 0.55 * 0.70, dH + 0.085)) - 0.035) * S);
      hcol = mix(hcol, vec3(1.0, 0.98, 0.90), spH * bandH);

      // fore wing: deep orange to gold, dark veins fanning from the root
      vec3 fcol = mix(vec3(1.0, 0.45, 0.06), vec3(1.0, 0.76, 0.14), smoothstep(0.0, 1.5, length(qF - vec2(0.1, 0.0))));
      vec2 rF = qF - vec2(0.05, 0.0);
      float vein = pow(abs(sin(atan(rF.y, rF.x) * 6.0)), 16.0) * smoothstep(0.1, 0.5, length(rF)) * 0.55;
      fcol = mix(fcol, vec3(0.30, 0.13, 0.03), vein);
      float bandF = smoothstep(-0.19, -0.06, dF);
      fcol = mix(fcol, vec3(0.13, 0.15, 0.06), bandF);
      vec2 rF2 = qF - vec2(0.95, 0.0);
      float sF = fract(atan(rF2.y, rF2.x) * 1.6 + 0.5) - 0.5;
      float spF = bg_aa((length(vec2(sF * 0.75 * 0.62, dF + 0.10)) - 0.04) * S);
      fcol = mix(fcol, vec3(1.0, 0.98, 0.90), spF * bandF);
      float rootDark = smoothstep(0.5, 0.0, length(q));
      fcol *= 1.0 - 0.45 * rootDark;
      hcol *= 1.0 - 0.45 * rootDark;

      col = mix(hcol, fcol, covF);
      col *= 0.70 + 0.30 * f;
      col += vec3(0.16, 0.10, 0.02) * pow(f, 3.0) * smoothstep(0.2, 0.9, 1.0 - length(qF - vec2(1.1, 0.0)));
    }
    // body and antennae
    float bodyD = length(vec2(max(abs(u - 0.0) - 0.62, 0.0), v * 1.0)) - 0.12;
    float body = bg_aa(bodyD * S);
    vec3 bcol = mix(vec3(0.10, 0.09, 0.04), vec3(0.34, 0.22, 0.06), smoothstep(-0.2, 0.2, v));
    float headD = length(vec2(u - 0.74, v)) - 0.14;
    body = max(body, bg_aa(headD * S));
    // two curved antennae
    vec2 aq = vec2(u - 0.80, av);
    float ax = clamp(aq.x, 0.0, 0.62);
    float ant;
    float antD = length(vec2(aq.x - ax, aq.y - (0.06 + 0.42 * ax - 0.12 * ax * ax)));
    ant = bg_aa((antD - 0.025) * S) * step(0.0, aq.x);
    float bodyAll = max(body, ant);
    col = mix(col, bcol, body);
    col = mix(col, vec3(0.08, 0.08, 0.04), ant * (1.0 - body));
    float cov = max(wingMask, bodyAll);

    // light: a faint pollen glow round the butterfly
    float lumg = exp(-dot(dB, dB) / (S * S * 1.8)) * 0.14;
    acc += vec3(1.0, 0.84, 0.40) * lumg;
    bcol4 = vec4(col, cov);
    // ink shade: a soft deep-green pool under the wings (wider than the wings) so it reads on bright pictures
    float sd = max(max(bg_aa(dF * S * gF - 2.2 * sc), bg_aa(dH * S * gH - 3.0 * sc)) * 0.55, bg_aa(bodyD * S - 2.2 * sc) * 0.5);
    shade += sd * 0.55;
  }

  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  // butterfly pixels are solid
  float sa2 = clamp(shade, 0.0, 0.50);
  vec3 ink = vec3(0.02, 0.07, 0.03);
  vec3 rgb = min(acc, vec3(la)) + ink * sa2 * (1.0 - la);
  float a = la + sa2 * (1.0 - la);
  // the butterfly itself is solid, drawn over the dust and the shade
  rgb = bcol4.rgb * bcol4.a + rgb * (1.0 - bcol4.a);
  a = bcol4.a + a * (1.0 - bcol4.a);
  fragColor = vec4(rgb, a) * qt_Opacity;
}
