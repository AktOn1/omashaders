// tags: comet trail speed fast spark fire warm sunny car glow
// idea: a comet. A bright head, a tail that follows the real pointer trail and tapers, sparks that peel off and fade,
// and a soft halo. It stays within about 200 px of the pointer.
vec4 cursorFx(vec2 p, vec2 m) {
  float tail = 0.0;
  for (int i = 0; i < 8; i++) {
    float k = float(i) / 8.0;
    tail = max(tail, seg(p, P(i), P(i + 1), 7.0 * (1.0 - k) + 1.5, 6.0 + 10.0 * k) * (1.0 - k));
  }
  float head = disc(p - m, 6.0, 5.0);
  float halo = exp(-length(p - m) / 28.0) * 0.35;
  float sp = sparks((p - m) / 220.0 + 0.5, time, 6.0, vec2(-1.0, 0.3)) * smoothstep(210.0, 60.0, length(p - m));
  vec3 col = mix(C_ff7a2a, C_ffe6a0, head) * (tail + head) + C_ff9a50 * halo + C_ffe8b8 * sp;
  float a = clamp(tail * 0.9 + head + halo + sp, 0.0, 1.0);
  return vec4(col * a, a);
}
