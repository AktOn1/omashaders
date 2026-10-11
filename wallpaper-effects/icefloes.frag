// label: Ice floes
// hint: pale ice floes drifting on dark polar water from above, a teal glow under their rims, the pointer pushes them apart
// category: Sea and sky
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
float if_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float if_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(if_hash(i), if_hash(i + vec2(1, 0)), f.x), mix(if_hash(i + vec2(0, 1)), if_hash(i + vec2(1, 1)), f.x), f.y);
}
float if_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * if_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float if_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * if_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float if_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);

  // the pointer pushes the floes away (we sample the ice field from nearer to the pointer)
  vec2 dv = p - mp;
  float pr = length(dv) + 1e-4;
  vec2 q = p;
  // slow drift, plus a slight rotation of the whole sheet
  q += vec2(t * 0.006, t * 0.002);
  vec2 g = q * 2.7;
  g += (vec2(if_fbm3(g * 0.8 + 3.0), if_fbm3(g * 0.8 + 11.0)) - 0.5) * 0.35;   // irregular outlines

  // cellular distances F1, F2 to the nearest two feature points
  vec2 gi = floor(g), gf = fract(g);
  float f1 = 9.0, f2 = 9.0; float id1 = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = gi + vec2(float(i), float(j));
      vec2 c = vec2(float(i), float(j)) + 0.15 + 0.7 * vec2(if_hash(id + 2.1), if_hash(id + 5.3));
      // each cell's point wanders very slowly: the floes turn and bump
      c += 0.08 * vec2(sin(t * 0.07 + if_hash(id) * 6.0), cos(t * 0.06 + if_hash(id + 1.0) * 6.0));
      float d = length(c - gf);
      if (d < f1) { f2 = f1; f1 = d; id1 = if_hash(id + 9.1); }
      else if (d < f2) { f2 = d; }
    }
  }
  float edge = f2 - f1;                                       // 0 on a border between cells, grows toward a cell centre
  float gap = 0.07 + 0.50 * id1 * id1 * id1 + (if_noise(q * 24.0) - 0.5) * 0.045;                         // some cells are small floes, a few are mostly open water
  float inside = edge - gap - 0.55 * exp(-pr * pr / 0.018) - 0.12 * exp(-pr * pr / 0.10);   // the floes drift back from the pointer
  float floe = smoothstep(0.0, 0.015, inside);

  // ---- water: deep navy, a pale rose-lavender sky light on the far side
  float lightPos = smoothstep(1.2, -0.2, uv.y + (1.0 - uv.x) * 0.3);
  vec3 water = mix(vec3(0.01, 0.06, 0.11), vec3(0.03, 0.14, 0.22), lightPos);
  float ripple = if_noise(p * vec2(18.0, 24.0) + vec2(t * 0.15, -t * 0.1));
  water += vec3(0.02, 0.05, 0.06) * smoothstep(0.55, 0.9, ripple);
  // pointer ripples on the water
  float pring = sin(pr * 70.0 - t * 2.2) * exp(-pr * 5.0) ;
  water += vec3(0.04, 0.10, 0.12) * max(pring, 0.0) * step(-5000.0, mpx.x);
  // teal glow of the submerged ice just outside each floe
  float under = exp(-max(-inside, 0.0) * 12.0) * (1.0 - floe);
  water += vec3(0.05, 0.42, 0.50) * under * 0.55 + vec3(0.02, 0.18, 0.26) * exp(-max(-inside, 0.0) * 3.5) * (1.0 - floe) * 0.5;

  // ---- ice top: snow white, pale blue shadows, slightly translucent rim
  float h = smoothstep(0.0, 0.25, inside);                      // 0 at the rim, 1 in the middle
  float grain = if_fbm(q * 14.0 + id1 * 30.0);
  float sheen = if_noise(q * 45.0 + id1 * 17.0);
  vec3 ice = mix(vec3(0.74, 0.88, 0.95), vec3(0.95, 0.98, 1.0), smoothstep(0.25, 0.75, grain));
  ice = mix(ice, vec3(0.62, 0.82, 0.93), 0.45 * fract(id1 * 7.3));
  ice = mix(ice, vec3(0.50, 0.78, 0.88), (1.0 - h) * 0.65);      // rim: thinner, bluer ice
  ice *= 0.93 + 0.07 * sheen;
  // pressure ridges and hairline cracks
  float crack = smoothstep(0.02, 0.0, abs(if_fbm3(q * 7.0 + id1 * 7.0) - 0.5)) * 0.35;
  ice = mix(ice, vec3(0.45, 0.70, 0.82), crack * 0.5 * h);
  // pink-peach light from the low sun, mostly on the side facing it
  float sunSide = clamp(0.5 + 0.5 * (-dv.x * 0.0 + (0.7 - uv.x) * 1.2), 0.0, 1.0);
  ice += vec3(0.10, 0.04, 0.02) * sunSide * h + vec3(0.02, 0.0, 0.03) * (1.0 - sunSide);
  ice += vec3(0.02) * if_luma(pic);
  // dark thin line where the ice meets water
  ice *= 0.86 + 0.14 * smoothstep(0.0, 0.03, inside);

  vec3 col = mix(water, ice, floe);
  // low sun haze at the horizon edge of the picture (top)
  col += vec3(0.45, 0.22, 0.20) * smoothstep(0.35, 0.0, uv.y) * 0.09;
  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
