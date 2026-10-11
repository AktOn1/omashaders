// label: Joy confetti
// hint: a bright sunny sky with slowly turning sun rays and tumbling confetti the pointer blows aside
// category: Mood scenes
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
float wl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float wl_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wl_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wl_hash(i), wl_hash(i + vec2(1, 0)), f.x), mix(wl_hash(i + vec2(0, 1)), wl_hash(i + vec2(1, 1)), f.x), f.y);
}
float wl_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * wl_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

vec3 wl_pal(float h) {
  h = fract(h) * 6.0;
  if (h < 1.0) return vec3(1.00, 0.42, 0.38);   // coral
  if (h < 2.0) return vec3(1.00, 0.80, 0.22);   // sun yellow
  if (h < 3.0) return vec3(0.30, 0.82, 0.62);   // mint
  if (h < 4.0) return vec3(0.28, 0.66, 1.00);   // sky blue
  if (h < 5.0) return vec3(0.98, 0.52, 0.80);   // bubblegum
  return vec3(1.00, 0.62, 0.20);                // tangerine
}

// one layer of tumbling confetti: returns rgb in xyz, coverage in w
vec4 wl_confetti(vec2 pp, float cell, float fall, float seed, float t, vec2 mpix, float push) {
  vec2 q = pp / cell;
  q.y -= t * fall / cell;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = wl_hash(id + seed);
  if (h < 0.60) return vec4(0.0);
  float h2 = wl_hash(id + seed + 5.7);
  float h3 = wl_hash(id + seed + 9.1);
  // sway
  vec2 o = (vec2(h2, h3) - 0.5) * 0.55;
  o.x += 0.12 * sin(t * (0.5 + h2) + h * 40.0);
  vec2 c = pp * 0.0 + (id + 0.5 + o) * cell;
  // the pointer blows nearby flakes away
  vec2 cw = vec2(c.x, c.y + t * fall);
  vec2 away = cw - mpix;
  float dm = length(away);
  vec2 shove = away / max(dm, 1.0) * push * exp(-dm * dm / (2.0 * 90.0 * 90.0));
  vec2 d = (f - o) * cell - shove;
  float ang = t * (0.6 + 1.2 * h3) * (h2 > 0.5 ? 1.0 : -1.0) + h * 30.0;
  float ca = cos(ang), sa = sin(ang);
  vec2 r = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
  float flip = 0.25 + 0.75 * abs(sin(t * (0.7 + h2) + h3 * 20.0));     // tumbling
  vec2 sz = vec2(4.5 + 3.5 * h2, 2.2 + 1.8 * h3) * (cell / 60.0 + 0.4) * 0.8;
  float k = smoothstep(1.2, 0.0, max(abs(r.x) - sz.x, abs(r.y) - sz.y * flip));
  return vec4(wl_pal(h + h2) * (0.8 + 0.2 * flip), k);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;

  // bright sky: aqua at the top, warm cream-yellow toward the bottom, the picture shining through, lifted
  vec3 sky = mix(vec3(0.42, 0.80, 1.00), vec3(1.00, 0.93, 0.66), smoothstep(0.0, 1.0, uv.y));
  vec3 pic = pow(wall(uv), vec3(0.62));
  vec3 col = mix(sky, pic * vec3(1.06, 1.02, 0.90), 0.42);

  // the sun sits upper left and leans a little toward the pointer
  vec2 sun = vec2(0.17 * asp, 0.10);
  if (m.x > -1.0) sun += (mp - sun) * 0.06;
  vec2 d = p - sun;
  float r = length(d);
  float ang = atan(d.y, d.x);
  // slowly turning rays, soft, fading with distance
  float rays = 0.5 + 0.5 * sin(ang * 11.0 + t * 0.12 + 0.6 * sin(ang * 3.0 - t * 0.07));
  rays = smoothstep(0.35, 1.0, rays) * exp(-r * 1.15);
  col += vec3(1.0, 0.90, 0.55) * rays * 0.22;
  col += vec3(1.0, 0.85, 0.45) * exp(-r * r / (2.0 * 0.20 * 0.20)) * 0.36;
  col += vec3(1.0, 0.97, 0.80) * smoothstep(0.075, 0.062, r) * 0.45;

  // two layers of confetti, the far one small and slow
  vec2 pp = vec2(uv.x * res.x, uv.y * res.y);
  vec2 mpix = m * res;
  vec4 c1 = wl_confetti(pp * 0.8 + 40.0, 70.0, 14.0, 2.0, t, mpix * 0.8 + 40.0, 40.0);
  vec4 c2 = wl_confetti(pp, 120.0, 26.0, 9.0, t, mpix, 60.0);
  col = mix(col, c1.rgb, c1.w * 0.55);
  col = mix(col, c2.rgb, c2.w * 0.85);

  // soft white clouds drifting slowly across the lower sky, for rest
  float cl = wl_fbm(vec2(p.x * 1.6 - t * 0.012, p.y * 3.4 + 4.0));
  col = mix(col, vec3(1.0, 0.99, 0.95), smoothstep(0.52, 0.80, cl) * smoothstep(0.35, 0.95, uv.y) * 0.30);

  col *= 1.0 - 0.14 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
