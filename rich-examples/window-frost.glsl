// tags: frost ice snow winter cold glass crystal calm night blue cabin
// idea: frosted glass. Ice crystals grow in from the edge and slowly shimmer, a faint cold sheen sweeps across now and
// then, and the middle of the window stays perfectly clear so the content is easy to read.
void main() {
  vec2 uv = v_texcoord;
  vec3 c = texture(tex, uv).rgb;
  vec2 px = uv * surface_size;
  float edge = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
  float depth = smoothstep(150.0 + 40.0 * sin(seed * 6.28), 0.0, edge);
  float ice = ridge(px / 70.0 + seed * 9.0 + vec2(0.0, time * 0.02));
  float crystals = smoothstep(0.55, 0.9, ice) * depth;
  float fine = gnoise(px / 9.0 + time * 0.1);
  float shimmer = pow(0.5 + 0.5 * sin(fine * 12.0 + time * 1.3 + ice * 6.0), 8.0) * depth;
  vec3 col = mix(c, c * 0.85 + C_cfe4ff * 0.35, depth * 0.30);
  col += C_f0f8ff * crystals * 0.30 + C_ffffff * shimmer * 0.30;
  float sweep = smoothstep(0.06, 0.0, abs(fract(time * 0.05 + seed) * 2.4 - 0.7 - (uv.x + uv.y * 0.6)));
  col += C_cfe4ff * sweep * 0.10 * depth;
  fragColor = vec4(col, 1.0);
}
