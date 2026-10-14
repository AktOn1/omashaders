// tags: neon night cyber city magenta cyan dark moody rain synthwave
// idea: neon night grade. Shadows go deep violet, mid tones keep the picture, highlights lean cyan and the hot spots lean magenta.
void main() {
  vec3 c = texture(tex, v_texcoord).rgb;
  float l = luma(c);
  vec3 toned = ramp(l, C_140a2c, C_5a4a9c, C_7fe8ff);
  vec3 col = mix(c, c * toned * 2.0, 0.42);
  float hot = smoothstep(0.7, 1.0, max(c.r, max(c.g, c.b)));
  col = mix(col, col * C_ff6ad0 * 1.6, hot * 0.25);
  float s = luma(col);
  col = mix(vec3(s), col, 1.18);
  fragColor = vec4(col, 1.0);
}
