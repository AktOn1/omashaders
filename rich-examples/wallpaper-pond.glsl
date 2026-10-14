// tags: water pond lake river daylight calm sunny summer caustics lilies underwater
// idea: sunlit shallow water. Slow wide caustics and fast fine caustics (two layers, two speeds), sun beams that sway,
// pollen glints that rise, and rings that spread from the pointer. Only the water half gets caustics; the sky stays clean.
vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float a = asp();
  vec2 p = vec2(uv.x * a, uv.y);
  vec2 mp = vec2(m.x * a, m.y);
  float lum = luma(base);
  float water = smoothstep(0.50, 0.70, uv.y);
  vec3 lc = mix(C_f4ffe8, base * 1.4 + 0.1, 0.30);

  vec2 dm = p - mp;
  float d = length(dm);
  float near = clamp(react, 0.0, 2.0) * exp(-d * 3.4);
  vec2 push = dm / max(d, 0.001) * sin(d * 50.0 - time * 4.0) * 0.04 * near;

  vec2 q = warp((p + push) * 1.3, time * 0.6);
  float wide = caustic(q * 0.8, time * 0.30);
  float fine = caustic(q * 2.1 + 3.0, time * 0.75);
  float light = wide * 0.75 + fine * 0.55;
  vec3 col = base + lc * light * water * (0.30 + 0.70 * smoothstep(0.05, 0.6, lum)) * 0.85;

  float beams = rays(uv * vec2(a, 1.0), vec2(0.15 * a, -0.2), time);
  col += C_fff4c8 * beams * (0.10 + 0.14 * water) * 0.8;

  float g = sparks(p, time, 16.0, vec2(0.15, 1.0)) + 0.7 * sparks(p + 4.0, time * 1.35, 28.0, vec2(-0.25, 0.8));
  col += C_f4ffe8 * g * (0.25 + 0.75 * water) * 0.7;

  float rg = 0.0;
  for (int i = 0; i < 3; i++) {
    float ph = fract(time * 0.30 + float(i) / 3.0);
    rg += ring(dm, ph * 0.34, 0.006, 0.012) * (1.0 - ph);
  }
  col += lc * rg * clamp(react, 0.0, 2.0) * (0.35 + 0.65 * water) * 0.35;
  return col;
}
