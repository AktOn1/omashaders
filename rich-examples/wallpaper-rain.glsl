// tags: city neon rain night street wet cyberpunk urban puddle reflection cafe lights dark
// idea: a rainy neon night. Two sheets of rain at different speeds and slants, neon that flickers like a real tube,
// ripples dancing on the wet ground (each stays inside its own cell, so none is cut off), and rings under the pointer. Light, so the picture stays readable.
vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float a = asp();
  vec2 p = vec2(uv.x * a, uv.y);
  vec2 mp = vec2(m.x * a, m.y);
  float lum = luma(base);
  float wet = smoothstep(0.55, 0.9, uv.y);

  vec2 r1 = rot(p, 0.12);
  vec2 r2 = rot(p + 3.0, 0.08);
  float rain = sparks(r1 * vec2(1.0, 0.07), time * 0.9, 38.0, vec2(0.0, -1.0));
  rain += 0.7 * sparks(r2 * vec2(1.0, 0.05), time * 1.5, 70.0, vec2(0.0, -1.0));
  vec3 col = base + C_b8c8ff * rain * 0.9;

  float flick = 0.75 + 0.25 * step(0.2, hash(vec2(floor(time * 9.0), 4.0)));
  float glowmask = smoothstep(0.45, 0.9, lum) * (1.0 - wet);
  col += mix(C_ff3a9a, C_3ad8ff, uv.x) * glowmask * flick * 0.10;

  float puddles = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 id = floor(p * vec2(9.0, 5.0) + fi * 11.0);
    vec2 c = (id + 0.3 + 0.4 * hash2(id + fi)) / vec2(9.0, 5.0) - fi * 11.0 / vec2(9.0, 5.0);
    float ph = fract(time * 0.5 + hash(id));
    puddles += ring(p - c, ph * 0.028, 0.0015, 0.004) * (1.0 - ph) * step(0.5, hash(id + 2.0));
  }
  col += C_9fe6ff * puddles * wet * 0.9;

  vec2 d = p - mp;
  float rg = 0.0;
  for (int i = 0; i < 3; i++) {
    float ph = fract(time * 0.4 + float(i) / 3.0);
    rg += ring(d, ph * 0.25, 0.004, 0.01) * (1.0 - ph);
  }
  col += C_ff7ac8 * rg * clamp(react, 0.0, 2.0) * 0.5;
  return col;
}
