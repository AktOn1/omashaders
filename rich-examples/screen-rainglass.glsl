// tags: rain glass window night city moody storm cozy cafe autumn dark blue grey wet
// idea: looking through a rainy window. Droplets that slide down the glass bend the picture a little, two sheets of fine rain
// pass at different speeds, a cool grade with a bit of lifted black, and the glass fogs softly toward the bottom.
void main() {
  vec2 uv = v_texcoord;
  vec2 p = vec2(uv.x * 1.78, uv.y);
  vec2 g = p * vec2(14.0, 8.0);
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec2 h = hash2(id);
  float life = fract(time * (0.05 + 0.1 * h.x) + h.y);
  vec2 dpos = vec2((h.x - 0.5) * 0.4, 0.38 - life * 0.76);
  vec2 dd = (f - dpos) * vec2(1.0, 0.7);
  float drop = smoothstep(0.17, 0.0, length(dd)) * step(0.55, hash(id + 5.0)) * sin(3.14159 * life);
  float trail = smoothstep(0.03, 0.0, abs(f.x - dpos.x)) * step(f.y, dpos.y + 0.02) * step(dpos.y - 0.5 * (1.0 - life), f.y) * 0.25 * step(0.55, hash(id + 5.0));
  vec2 lens = dd * drop * 0.09;
  vec3 c = texture(tex, uv - lens).rgb;
  c += C_cfe4ff * (drop * 0.10 + trail * 0.12);

  float rain = sparks(rot(p, 0.1) * vec2(1.0, 0.08), time * 0.9, 34.0, vec2(0.0, -1.0)) + 0.6 * sparks(rot(p + 2.0, 0.07) * vec2(1.0, 0.05), time * 1.4, 60.0, vec2(0.0, -1.0));
  c += C_c8d8ff * rain * 0.45;

  vec3 col = mix(c, c * C_a8c0ff * 1.25, 0.20);
  col = max(col, C_141828 * 0.4);
  float fog = mist(p * 1.1, time) * smoothstep(0.4, 1.0, uv.y);
  col = mix(col, C_8898b8 * 0.55 + col * 0.5, fog * 0.20);
  fragColor = vec4(col * vig(uv, 0.18), 1.0);
}
