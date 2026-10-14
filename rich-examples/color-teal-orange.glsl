// tags: cinematic warm sunny golden teal orange film car road sunset summer
// idea: a film grade. Cool teal shadows, warm orange highlights, a gentle S curve, slightly lifted blacks and a little more colour.
void main() {
  vec3 c = texture(tex, v_texcoord).rgb;
  float l = luma(c);
  vec3 curved = c * c * (3.0 - 2.0 * c);
  vec3 col = mix(c, curved, 0.45);
  vec3 toned = ramp(l, C_103844, C_808078, C_ffb070);
  col = mix(col, col * toned * 2.0, 0.40);
  float s = luma(col);
  col = mix(vec3(s), col, 1.12);
  col = max(col, C_0c1418 * 0.5);
  fragColor = vec4(col, 1.0);
}
