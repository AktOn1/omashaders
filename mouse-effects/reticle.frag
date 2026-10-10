#version 440
// category: Focus
// desc: Targeting reticle: a slowly turning cyan lock ring with an orange centre dot, a radar ping that spreads every two seconds and a light-speed streak tail
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
  return h3.zw;
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  const vec3 CYAN = vec3(0.16, 0.88, 1.0);
  const vec3 ORANGE = vec3(1.0, 0.54, 0.12);
  const float TAU = 6.28318;
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // streak tail: two thin speed lines and a soft core along the pointer's recent path, orange at the far end, cyan near the pointer
  for (int i = 0; i < 8; i++) {
    vec2 a = P(i), b = P(i + 1);
    vec2 ab = b - a;
    float len = length(ab);
    if (len < 1.0) continue;
    vec2 dir = ab / len;
    vec2 nrm = vec2(-dir.y, dir.x);
    vec2 q = p - a;
    float tRaw = dot(q, dir) / len;
    float t = clamp(tRaw, 0.0, 1.0);
    float across = dot(q, nrm);
    float along = length(q - dir * t * len);
    float age = (float(i) + t) / 8.0;
    float fade = (1.0 - age) * (1.0 - age);
    float core = smoothstep(2.6 * (1.0 - age) + 0.6, 0.0, along);
    float l1 = smoothstep(1.2, 0.0, abs(across - 7.0 * (1.0 - age * 0.6)));
    float l2 = smoothstep(1.2, 0.0, abs(across + 7.0 * (1.0 - age * 0.6)));
    float inSeg = step(0.0, tRaw) * step(tRaw, 1.0);
    float speed = smoothstep(2.0, 18.0, len);
    float glow = smoothstep(14.0, 0.0, along) * 0.12;
    float s = (core * 0.85 + (l1 + l2) * 0.45 * smoothstep(0.0, 0.2, age) + glow) * fade * speed * inSeg;
    vec3 tint = mix(CYAN, ORANGE, smoothstep(0.1, 0.9, age));
    col += tint * s;
    alpha += s;
  }

  // the reticle
  vec2 d = p - mouse;
  float dist = length(d);
  float R = 20.0;
  float ang = atan(d.y, d.x) + time * 0.7;
  float seg = fract(ang / (TAU / 3.0));                         // three arcs with gaps, turning slowly
  float arcMask = smoothstep(0.04, 0.1, seg) * smoothstep(0.82, 0.76, seg);
  float ring = smoothstep(1.4, 0.4, abs(dist - R)) * arcMask;
  float ring2 = smoothstep(1.0, 0.3, abs(dist - (R - 5.0))) * 0.35;                 // thin inner ring
  vec2 ad = abs(d);
  float tickV = step(ad.x, 0.9) * step(R + 4.0, ad.y) * step(ad.y, R + 11.0);       // four fixed ticks outside
  float tickH = step(ad.y, 0.9) * step(R + 4.0, ad.x) * step(ad.x, R + 11.0);
  float cross_ = (step(ad.x, 0.7) * step(ad.y, 4.0) + step(ad.y, 0.7) * step(ad.x, 4.0)) * step(2.0, max(ad.x, ad.y)); // small cross inside
  float dotc = smoothstep(3.2, 1.6, dist);
  float rg = ring * 0.95 + ring2 + (tickV + tickH) * 0.75 + cross_ * 0.55;
  float halo = smoothstep(R + 12.0, R - 4.0, dist) * 0.07;
  col += CYAN * (rg + halo);
  alpha += rg + halo;
  col += ORANGE * dotc;
  alpha += dotc;

  // radar ping
  float ph = fract(time * 0.5);
  float pr = R + 8.0 + ph * 70.0;
  float ping = smoothstep(1.5, 0.3, abs(dist - pr)) * (1.0 - ph) * (1.0 - ph) * 0.6;
  col += mix(CYAN, vec3(1.0), 0.3) * ping;
  alpha += ping;

  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
