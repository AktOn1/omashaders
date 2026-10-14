// tags: forest night woods firefly fireflies moon magic mist cabin camp dark calm glow
// idea: a night forest that is alive. Fireflies wander in two depth layers and glow brighter near the pointer, moonlight
// beams sway between the trees, a low mist breathes at two speeds, and now and then a firefly flares up.
vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float a = asp();
  vec2 p = vec2(uv.x * a, uv.y);
  vec2 mp = vec2(m.x * a, m.y);
  float k = ptr(p, mp, 0.35) * clamp(react, 0.0, 2.0);
  float lum = luma(base);

  float beams = rays(p, vec2(a * 0.85, -0.25), time) * (0.4 + 0.6 * smoothstep(0.0, 0.5, uv.y));
  vec3 col = base + C_9ab8ff * beams * 0.20;

  float low = smoothstep(0.35, 1.0, uv.y);
  float fog = mist(p * 1.2, time);
  col += C_7f93b8 * smoothstep(0.30, 0.85, fog) * low * 0.20;

  float f1 = sparks(p, time * 0.8, 9.0, vec2(0.3, 0.6));
  float f2 = sparks(p + 7.0, time * 1.1, 15.0, vec2(-0.4, 0.5)) * 0.7;
  float flare = pow(0.5 + 0.5 * sin(time * 0.6 + hash(floor(p * 9.0)) * 40.0), 12.0);
  float fly = (f1 * (1.0 + 2.5 * flare) + f2) * (1.0 + 2.2 * k);
  col += mix(C_ffe07a, C_c8ff9a, hash(floor(p * 9.0))) * fly * 1.1;
  col += C_ffe07a * ptr(p, mp, 0.10) * 0.10 * clamp(react, 0.0, 2.0);
  return col;
}
