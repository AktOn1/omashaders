// tags: firefly fireflies magic forest night calm ring orbit garden pond water ripple
// idea: a breathing ring around the pointer with three little lights that orbit it at different speeds, and a
// ripple that spreads out every moment. Quiet when still, alive when it moves.
vec4 cursorFx(vec2 p, vec2 m) {
  vec2 d = p - m;
  float r = length(d);
  float breathe = 30.0 + 4.0 * sin(time * 2.2);
  float rg = ring(d, breathe, 1.2, 3.0) * 0.8;
  float ph = fract(time * 0.5);
  float ripple = ring(d, 20.0 + 70.0 * ph, 1.0, 5.0) * (1.0 - ph) * 0.6;
  float orbit = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ang = time * (1.2 + 0.7 * fi) + fi * 2.1;
    vec2 q = m + (24.0 + 9.0 * fi) * vec2(cos(ang), sin(ang));
    orbit += disc(p - q, 2.4, 3.0) * (0.7 + 0.3 * sin(time * 5.0 + fi));
  }
  float glow = exp(-r / 22.0) * 0.18;
  vec3 col = C_ffe07a * (rg + orbit) + C_9ac8ff * ripple + C_c8ff9a * glow;
  float a = clamp(rg + orbit + ripple + glow, 0.0, 1.0);
  return vec4(col * a, a);
}
