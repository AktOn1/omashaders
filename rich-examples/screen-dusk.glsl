// tags: dusk sunset warm golden evening haze calm sunny summer beach coast road mountain desert
// idea: warm golden-hour air over the whole picture. A soft grade, drifting haze in two layers (different speeds), sun
// beams from the upper corner, tiny dust motes that float, a light vignette and a breath of grain. The picture stays sharp.
void main() {
  vec2 uv = v_texcoord;
  vec2 p = vec2(uv.x * 1.78, uv.y);
  vec3 c = texture(tex, uv).rgb;
  float l = luma(c);
  vec3 col = mix(c, c * C_ffb46a * 1.45, 0.28);
  col = mix(col, ramp(l, C_2a1830, C_c8704a, C_ffe6b8), 0.14);

  float haze = mist(p * 0.9, time * 0.8) * 0.6 + mist(p * 1.7 + 4.0, time * 1.6) * 0.4;
  col += C_ffc890 * smoothstep(0.35, 0.85, haze) * (0.35 + 0.65 * uv.y) * 0.16;

  float b = rays(p, vec2(1.55, -0.2), time);
  col += C_ffdca0 * b * 0.20;

  float motes = sparks(p, time * 0.8, 20.0, vec2(0.2, 0.4)) + 0.6 * sparks(p + 6.0, time, 34.0, vec2(-0.3, 0.3));
  col += C_fff0c8 * motes * 0.35;

  float grain = (hash(uv * 900.0 + fract(time) * 37.0) - 0.5) * 0.025;
  fragColor = vec4((col + grain) * vig(uv, 0.22), 1.0);
}
