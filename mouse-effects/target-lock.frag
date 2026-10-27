#version 440
// category: Focus
// desc: Target lock: a small phosphor-green reticle at the pointer with a thin circle, four tan tick marks, a tiny dotted range ring and an amber centre dot, followed by a short fading trail of dots. A faint ring breathes outward now and then. Calm and low-contrast
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
// coverage of a line d pixels from its centre with half width w
float tl_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 green = vec3(0.45, 0.95, 0.40);
  vec3 tan = vec3(0.86, 0.78, 0.55);
  vec3 amber = vec3(1.00, 0.70, 0.24);
  vec3 acc = vec3(0.0);
  float shade = 0.0;

  vec2 d = p - mouse;
  float r = length(d);
  float ang = atan(d.x, -d.y);
  float breathe = 1.0 + 0.04 * sin(time * 1.6);

  // dark olive pool under the reticle so it reads on any picture
  shade += exp(-r * r / 520.0) * 0.20;

  // thin circle, 11 px
  float R = 11.0 * breathe;
  float ring = tl_aa(abs(r - R), 0.55);
  acc += green * ring * 0.85;
  shade += ring * 0.16;

  // four tick marks crossing the circle at the compass points (outside and a little inside)
  vec2 ad = abs(d);
  float tickV = tl_aa(ad.x, 0.55) * step(R - 3.0, ad.y) * step(ad.y, R + 6.0);
  float tickH = tl_aa(ad.y, 0.55) * step(R - 3.0, ad.x) * step(ad.x, R + 6.0);
  float tk = max(tickV, tickH);
  acc += tan * tk * 0.95;
  shade += tk * 0.18;

  // tiny dotted range ring, 20 px, slowly turning, plus short scale marks every 30 degrees
  float rr = 20.0;
  float dotted = step(fract(ang * rr / 7.0 + time * 0.20), 0.45);
  float rg = tl_aa(abs(r - rr), 0.45) * dotted;
  acc += green * rg * 0.55;
  float sa = ang / 6.2832 * 12.0;
  float sd = abs(fract(sa + 0.5) - 0.5) * 6.2832 * (rr + 3.0) / 12.0;
  float sm = tl_aa(sd, 0.45) * step(rr + 1.5, r) * step(r, rr + 4.5);
  acc += tan * sm * 0.45;

  // amber centre dot with a faint halo; a slow lock pulse
  float pul = 0.75 + 0.25 * sin(time * 3.0);
  acc += amber * (exp(-r * r / 3.2) * 1.0 + exp(-r * r / 40.0) * 0.12) * pul;

  // a faint ring breathing outward every three seconds
  float ph = fract(time / 3.0);
  float pr = 24.0 + 22.0 * ph;
  float pa = tl_aa(abs(r - pr), 0.45) * (1.0 - ph) * (1.0 - ph) * 0.35;
  acc += green * pa;

  // short fading trail: seven dots on older pointer samples, hidden while the pointer rests
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    int slot = 2 + i * 2;
    vec2 q = P(slot);
    float age = (float(slot) - 1.0 + hs.y) / 16.0;
    float dq = length(q - mouse);
    float away = smoothstep(14.0, 30.0, dq);
    float rad = 2.3 - 0.22 * fi;
    float dd = length(p - q);
    float fade = (1.0 - 0.85 * age) * away;
    float dotA = smoothstep(rad + 0.7, rad - 0.3, dd);
    acc += mix(green, tan, fi / 6.0) * dotA * fade * 0.85;
    shade += dotA * fade * 0.22;
  }

  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  float sa2 = clamp(shade, 0.0, 0.45);
  vec3 ink = vec3(0.04, 0.05, 0.02);
  vec3 rgb = min(acc, vec3(la)) + ink * sa2 * (1.0 - la);
  float a = la + sa2 * (1.0 - la);
  fragColor = vec4(rgb, a) * qt_Opacity;
}
