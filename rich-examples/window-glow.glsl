// tags: glow neon edge frame light border pulse calm cyber sunny warm
// idea: a window that glows from its edge. The glow breathes, a bright comet of light runs around the frame (faster on the
// active window), a few specks drift in from the edge, and each window has its own phase (seed). The content stays clear.
void main() {
  vec2 uv = v_texcoord;
  vec3 c = texture(tex, uv).rgb;
  vec2 px = uv * surface_size;
  float edge = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
  float act = 0.45 + 0.55 * is_active;
  float breathe = 0.75 + 0.25 * sin(time * 1.1 + seed * 6.28);
  float glow = smoothstep(110.0, 0.0, edge) * act * breathe;

  float per = 2.0 * (surface_size.x + surface_size.y);
  float along = mod(time * (120.0 + 160.0 * is_active) + seed * per, per);
  float pos = px.y < surface_size.y * 0.5 ? (px.x < surface_size.x * 0.5 ? px.y : px.x) : (px.x < surface_size.x * 0.5 ? per - px.x : px.y + surface_size.x);
  float dist = abs(pos - along);
  dist = min(dist, per - dist);
  float comet = smoothstep(260.0, 0.0, dist) * smoothstep(34.0, 0.0, edge);

  vec3 col = mix(c, C_5ad8ff, glow * 0.40);
  col += C_b8f0ff * comet * 0.55 * act;
  float specks = sparks(px / 420.0, time, 3.0, vec2(0.0, 0.0)) * smoothstep(160.0, 20.0, edge) * 0.8;
  col += C_e8fbff * specks * act;
  fragColor = vec4(col, 1.0);
}
