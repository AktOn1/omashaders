// tags: car road speed fast drive motion race highway wind blur dust daylight misty
// idea: a fast drive. Two layers of speed lines (thin and slow far away, long and fast near the road), wind-borne dust,
// a low mist that streams past, and a warm sun glint on the horizon. The pointer pulls speed up around it. The streaks fade over
// strongly coloured pixels (the car) so the subject stays clean.
vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float a = asp();
  vec2 p = vec2(uv.x * a, uv.y);
  vec2 mp = vec2(m.x * a, m.y);
  float lum = luma(base);
  float k = ptr(p, mp, 0.5) * clamp(react, 0.0, 2.0);
  float road = smoothstep(0.46, 0.70, uv.y);
  float sat = max(base.r, max(base.g, base.b)) - min(base.r, min(base.g, base.b));
  float clear = 1.0 - smoothstep(0.22, 0.45, sat);
  float horizon = exp(-pow((uv.y - 0.52) * 7.0, 2.0));
  float t = time * (1.0 + 1.2 * k);

  float far = streaks(vec2(p.x * 0.8, uv.y), t, 90.0, 0.9) * (0.35 + 0.65 * road);
  float near = streaks(vec2(p.x * 0.5 + 3.0, uv.y), t, 26.0, 1.8) * road;
  vec3 col = base + C_fff0d8 * (far * 0.35 + near * 0.55) * (0.25 + 0.75 * clear);

  float fog = mist(vec2(p.x * 0.6, uv.y * 1.5) + vec2(time * 0.1, 0.0), time * 2.5);
  col += C_e8d8c0 * smoothstep(0.35, 0.8, fog) * horizon * 0.22;

  float dust = sparks(vec2(p.x, uv.y), time * 2.2, 22.0, vec2(-1.0, 0.05)) + 0.6 * sparks(vec2(p.x, uv.y) + 5.0, time * 3.0, 40.0, vec2(-1.0, 0.0));
  col += C_ffe2b0 * dust * (0.25 + 0.75 * road) * 0.6;

  float glint = pow(max(0.0, 1.0 - length((p - vec2(a * 0.86, 0.46)) * vec2(0.5, 3.2))), 3.0);
  col += C_ffc890 * glint * (0.55 + 0.45 * sin(time * 1.7)) * 0.35;
  return col;
}
