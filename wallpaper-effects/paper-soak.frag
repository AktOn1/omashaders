// label: Soaked paper
// hint: your picture as a sheet of washi that slowly soaks: water wicks up through the paper fibres as an uneven damp front with thin capillary fingers and a darker tide line at its edge, the wet part turns deep indigo with the picture showing through, then dries again while other parts get wet. Fine paper fibres everywhere, a small vermilion seal in the corner. The pointer is a damp spot that draws the water toward it
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

float ps_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float ps_noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ps_h(i), ps_h(i + vec2(1.0, 0.0)), f.x), mix(ps_h(i + vec2(0.0, 1.0)), ps_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ps_fbm(vec2 p) {
  float a = 0.5; float s = 0.0;
  for (int k = 0; k < 4; k++) { s += a * ps_noise(p); p = p * 2.03 + vec2(7.1, 3.7); a *= 0.5; }
  return s / 0.9375;
}
// one layer of long thin paper fibres at an angle (p in pixels / sc)
float ps_fibre(vec2 p, float ang, float len, float seed) {
  float ca = cos(ang); float sa = sin(ang);
  vec2 r = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);
  float n = ps_noise(vec2(r.x / len + seed, r.y / 1.7 + seed * 3.1));
  return smoothstep(0.66, 0.92, n);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  vec2 pp = uv * res;
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  vec2 q = pp / sc;
  bool has = mpx.x > -5000.0;
  float t = time;
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  vec3 indigo = vec3(0.060, 0.115, 0.330);
  vec3 slate = vec3(0.230, 0.320, 0.520);
  vec3 foam = vec3(0.780, 0.900, 0.880);

  // paper fibres: long thin crossing strands, a little lighter and darker than the sheet
  float fib = ps_fibre(q, 0.35, 70.0, 1.0) + 0.8 * ps_fibre(q, 1.95, 90.0, 5.0) + 0.7 * ps_fibre(q, -0.75, 60.0, 9.0);
  float fibV = ps_fibre(q, 1.45, 120.0, 13.0);
  float grain = ps_noise(q * 0.9) - 0.5;

  // when the water reaches each point: a smooth, domain-warped blob field (so the front runs in several directions at once),
  // a slight pull from the bottom, a short soft fibre wobble on the edge
  vec2 wq = q * 0.0034;
  vec2 warp = vec2(ps_fbm(wq + vec2(3.1, 1.7)), ps_fbm(wq + vec2(8.7, 4.2))) - 0.5;
  float fld = ps_fbm(wq + warp * 1.7 + vec2(1.0, 2.0));
  float H = 1.0 - uv.y;
  float fing = ps_noise(vec2(q.x / 13.0, q.y / 26.0 + 3.0)) * 0.6 + ps_noise(vec2(q.x / 30.0, q.y / 50.0)) * 0.4;
  float mot = ps_fbm(q * 0.018 + vec2(5.0, 9.0));          // mottling of the wet paper
  float ts = (fld - 0.5) * 24.0 + H * 4.0 + (ps_fbm(q * 0.03 + 2.0) - 0.5) * 2.0 + (fing - 0.5) * 0.9;
  float rp = 0.30 * res.y;
  vec2 dm = pp - mpx;
  float pn = has ? exp(-dot(dm, dm) / (rp * rp)) : 0.0;
  ts -= 2.2 * pn;

  float dur = 4.2 + 3.0 * ps_fbm(q * 0.0035 + vec2(11.0, 1.0)) + 0.5 * fing;
  float P = 18.0;
  float tau = mod(t - ts, P);
  float onset = smoothstep(0.0, 0.65, tau);
  float dry = 1.0 - smoothstep(dur - 2.6, dur, tau);
  float wet = onset * dry;
  float spot = has ? exp(-dot(dm, dm) / (62.0 * sc * 62.0 * sc)) : 0.0;
  wet = max(wet, 0.60 * spot);
  // a thin darker tide line just inside the front, and a fainter dried mark where the water left
  float rim = smoothstep(0.02, 0.16, tau) * exp(-tau / 0.30) * (0.6 + 0.4 * fing);
  float mark = exp(-pow((tau - dur) / 0.40, 2.0)) * 0.50 * smoothstep(0.5, 1.5, tau) * (0.5 + 0.5 * mot);
  float stain = smoothstep(dur, dur + 1.0, tau) * (1.0 - smoothstep(dur + 1.0, dur + 5.0, tau)) * 0.07;

  // the sheet itself: soft cream light from above, a hint of fibre
  col = mix(col, col * vec3(1.05, 1.03, 0.97) + vec3(0.02, 0.016, 0.006), 0.35 * (1.0 - uv.y) * smoothstep(0.35, 0.8, lum0 + 0.25));
  col *= 1.0 + 0.060 * (fib - 0.5) + 0.020 * grain;
  col += (vec3(1.0, 0.97, 0.90) * 0.020) * fibV;

  // wet: darker, deeper in colour, indigo-tinted but mottled (pooled and thin spots), picture showing through
  float lw = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 deep = mix(vec3(lw), col, 1.35) * vec3(0.62, 0.70, 0.94);
  vec3 soaked = mix(deep, col * vec3(0.46, 0.52, 0.82) + indigo * 0.65, 0.78);
  soaked += slate * 0.06 * (1.0 - lw);
  soaked *= 1.0 - 0.10 * (fib * 0.6 + fibV * 0.4);
  float pool = 0.55 + 0.75 * mot + 0.25 * (ps_noise(q * 0.08) - 0.5);
  col = mix(col, soaked, clamp(wet * (0.44 + 0.26 * exp(-tau / 2.5)) * pool + wet * 0.10, 0.0, 0.85));
  vec3 ink = indigo * 0.55;
  col = mix(col, ink + col * 0.22, clamp(rim * onset * 0.55, 0.0, 0.6));
  col = mix(col, ink + col * 0.30, clamp(mark * (1.0 - wet * 0.3) * 0.60, 0.0, 0.6));
  col = mix(col, indigo * 0.6 + col * 0.45, stain);
  col += foam * 0.07 * exp(-pow((tau - 0.9) / 0.9, 2.0)) * wet * (fing * 0.7 + 0.3) * (1.0 - 0.7 * lum0);
  col += foam * 0.07 * spot;

  // a small vermilion seal in the lower right corner: a rounded square with a few stamped strokes
  vec2 sp = (pp - vec2(res.x - 78.0 * sc, res.y - 78.0 * sc)) / sc;
  vec2 sd = abs(sp) - vec2(17.0);
  float box = 1.0 - smoothstep(-0.5, 1.0, length(max(sd, 0.0)) + min(max(sd.x, sd.y), 0.0) - 2.5);
  float bar = max(max(1.0 - smoothstep(0.0, 1.0, abs(sp.x + 6.0) - 2.2) , 1.0 - smoothstep(0.0, 1.0, abs(sp.y - 4.0) - 2.0)) * step(abs(sp.y), 12.0) * step(abs(sp.x), 12.0),
                  (1.0 - smoothstep(0.0, 1.0, abs(sp.x - 7.0) - 2.2)) * step(abs(sp.y + 2.0), 10.0));
  float mark2 = box * (1.0 - bar * 0.85) * (0.80 + 0.20 * ps_noise(sp * 0.7));
  vec3 vermil = vec3(0.82, 0.18, 0.12);
  col = mix(col, mix(col * 0.45, vermil, 0.85), mark2 * 0.55);

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
