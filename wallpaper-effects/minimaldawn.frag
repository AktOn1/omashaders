// label: Minimal dawn
// hint: almost nothing: a soft grey-blue to peach gradient, a thin horizon line, one pale sun rising very slowly in a barely visible haze; its glow warms toward the pointer
// category: Quiet and focus
#version 440
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec2 imgSize;
  vec4 cBg;
  vec4 cBlue;
  vec4 cMagenta;
  vec4 cPink;
  vec4 cCream;
  vec4 cTarget;
  float react;
  float range;
  float zoom;
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
float md_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float md_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(md_h(i), md_h(i + vec2(1, 0)), f.x), mix(md_h(i + vec2(0, 1)), md_h(i + vec2(1, 1)), f.x), f.y);
}
float md_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * md_n(p); p = p * 2.03 + 5.0; a *= 0.5; }
  return v;
}
float md_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float MD_HZ = 0.64;

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  // ---- the sun: it rises very slowly (a 10 minute swing) and is cut by the horizon
  float rise = 0.5 + 0.5 * sin(t * 0.0105 - 1.2);               // 0 = just touching the horizon, 1 = well up
  float R = 0.058;
  vec2 sc = vec2(0.5 * asp, MD_HZ - 0.012 - 0.150 * rise);
  // the glow warms and leans a little toward the pointer
  vec2 toM = hasM ? (mp - sc) : vec2(0.0);
  float pull = hasM ? exp(-dot(toM, toM) / 0.9) : 0.0;           // stronger when the pointer is near the sun
  vec2 gc = sc + toM * 0.10 * (0.4 + 0.6 * pull);
  float warmth = hasM ? (0.30 + 0.70 * pull) : 0.0;

  // ---- sky: grey-blue at the top, pale peach at the horizon
  float up = clamp((MD_HZ - uv.y) / MD_HZ, 0.0, 1.0);            // 1 at the top, 0 at the horizon
  vec3 top = vec3(0.600, 0.655, 0.745);
  vec3 mid = vec3(0.800, 0.800, 0.840);
  vec3 low = vec3(0.965, 0.865, 0.790);
  vec3 sky = mix(low, mid, smoothstep(0.0, 0.40, up));
  sky = mix(sky, top, smoothstep(0.30, 1.0, up));
  // below the horizon: a calm flat grey-blue field that deepens only very slowly
  float dn = clamp((uv.y - MD_HZ) / (1.0 - MD_HZ), 0.0, 1.0);
  vec3 land = mix(vec3(0.835, 0.800, 0.800), vec3(0.545, 0.595, 0.690), pow(dn, 0.7));
  vec3 col = uv.y < MD_HZ ? sky : land;

  // sun glow: a wide soft bloom, a tighter one, then the pale disc
  float ds = length(p - gc);
  vec3 glowC = mix(vec3(1.0, 0.89, 0.76), vec3(1.0, 0.78, 0.60), warmth);
  col += glowC * exp(-ds * ds / (2.0 * 0.30 * 0.30)) * (0.075 + 0.045 * warmth);
  col += glowC * exp(-ds * ds / (2.0 * 0.10 * 0.10)) * 0.035;
  float dd = length(p - sc);
  float disc = smoothstep(R, R - 0.006, dd) * step(uv.y, MD_HZ + 0.0005);
  col = mix(col, vec3(1.0, 0.985, 0.95), disc * 0.95);
  col += vec3(1.0, 0.92, 0.82) * smoothstep(R + 0.03, R, dd) * 0.025 * step(uv.y, MD_HZ);

  // a faint reflection of the sun below the horizon: a short soft vertical streak
  float refl = exp(-pow((p.x - sc.x) / 0.030, 2.0)) * exp(-dn * 7.0) * (0.35 + 0.65 * rise);
  col += vec3(1.0, 0.90, 0.80) * refl * 0.085 * step(MD_HZ, uv.y);

  // ---- haze: a barely visible band along the horizon with the slowest drift
  float hz = exp(-pow((uv.y - MD_HZ + 0.012) / 0.060, 2.0));
  float hn = md_fbm(vec2(p.x * 1.4 + t * 0.004, uv.y * 7.0));
  col = mix(col, vec3(0.94, 0.90, 0.88), hz * (0.16 + 0.12 * hn));

  // ---- the thin horizon line
  float line = smoothstep(0.0016, 0.0, abs(uv.y - MD_HZ));
  col = mix(col, vec3(0.99, 0.95, 0.91), line * 0.55);
  col -= vec3(0.020, 0.018, 0.012) * smoothstep(0.004, 0.0, abs(uv.y - MD_HZ - 0.003)) * 0.6;

  // ---- the user's picture is only a whisper under it
  col *= 0.985 + 0.03 * md_luma(w);
  col *= 1.0 - 0.07 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
  // a hint of paper-fine grain so the gradient never bands
  col += (md_h(uv * res) - 0.5) * 0.008;
  fragColor = vec4(col, 1.0) * qt_Opacity;
  return fragColor;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored, above 1 = exaggerated (extrapolated from the no-pointer look)
void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
