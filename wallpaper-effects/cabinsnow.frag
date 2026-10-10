// label: Snow outside
// hint: slow snowfall in three layers, warm window light, the pointer parts the flakes
// category: Calm scenes
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
float sn_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 sn_h2(vec2 p) { return vec2(sn_h(p), sn_h(p + 19.19)); }
float sn_n(vec2 p) {
  vec2 i = floor(p), f;
  f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sn_h(i), sn_h(i + vec2(1, 0)), f.x), mix(sn_h(i + vec2(0, 1)), sn_h(i + vec2(1, 1)), f.x), f.y);
}

// warm light of the cabin window, lower left: 1 at the window, fading across the snow
float sn_glow(vec2 uv, float asp) {
  vec2 d = (uv - vec2(0.02, 1.02)) * vec2(asp, 1.0);
  return exp(-length(d * vec2(0.8, 1.15)) * 1.25);
}

// one depth layer of snowfall. sc = flakes per screen height, fall = speed, rad = flake radius in cells, soft = edge softness.
// Each cell may hold one flake that falls, sways, and is shoved aside by the pointer; returns xy = (cool, warm) light amount
vec2 sn_layer(vec2 uv, vec2 mp, float asp, float sc, float fall, float rad, float soft, float seed, float keep) {
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 g = p * sc;
  g.y -= time * fall;
  g.x += sin(time * 0.17 + seed) * 0.9 + time * fall * 0.12;            // a breath of wind
  vec2 id = floor(g);
  vec2 acc = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = id + vec2(float(i), float(j));
      float h = sn_h(cell + seed);
      if (h > keep) continue;
      vec2 hh = sn_h2(cell + seed + 4.7);
      vec2 c = cell + 0.5 + (hh - 0.5) * 0.62;
      c.x += 0.28 * sin(time * (0.35 + 0.4 * hh.x) + h * 60.0 + c.y * 0.9);      // each flake sways on its own
      // parted by the pointer: flakes near it drift outward (flake position back in screen space)
      vec2 w = vec2((c.x - sin(time * 0.17 + seed) * 0.9 - time * fall * 0.12) / sc, (c.y + time * fall) / sc);
      vec2 dm = (w - vec2(mp.x * asp, mp.y));
      float dl = length(dm);
      float push = exp(-dl * dl / (2.0 * 0.13 * 0.13));
      vec2 shift = dm / max(dl, 1e-3) * push * 0.75;                  // at most 3/4 of a cell, so no flake leaves its neighbourhood
      c += shift;
      vec2 dd = g - c;
      float d = length(dd);
      float rr = rad * (0.65 + 0.7 * hh.y);
      float a = smoothstep(rr, rr * (1.0 - soft), d);
      a += 0.25 * smoothstep(rr * 3.2, 0.0, d) * (1.0 - soft * 0.3) * 0.5;
      a *= 0.55 + 0.45 * sn_h(cell + seed + 9.1);
      float wl = sn_glow(w, asp);
      acc += a * vec2(1.0 - 0.8 * wl, wl);
    }
  }
  return acc;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));

  // cold blue winter dusk over the picture
  vec3 dusk = vec3(0.50, 0.66, 0.95);
  col = mix(col, vec3(l) * dusk * 1.35 + col * 0.35, 0.38);
  col += vec3(0.010, 0.022, 0.050) * (1.0 - 0.5 * uv.y);

  // warm amber spill from the cabin window at the lower left: a broad glow plus a soft slanted pane-shaped patch of light
  float gl = sn_glow(uv, asp);
  vec2 q = (uv - vec2(0.02, 0.99)) * vec2(asp, 1.0);
  vec2 wp = vec2(q.x * 0.82 + q.y * 0.30, q.y * 0.95 - q.x * 0.10);     // slanted, like light falling on snow at an angle
  float box = smoothstep(0.62, 0.50, abs(wp.x - 0.50)) * smoothstep(0.55, 0.40, abs(wp.y + 0.28));
  float bars = 1.0 - 0.45 * (smoothstep(0.018, 0.0, abs(wp.x - 0.50)) + smoothstep(0.018, 0.0, abs(wp.y + 0.28)));   // window mullions
  float patch_ = box * bars * smoothstep(0.0, 0.5, uv.x * 1.6 + 0.0 * uv.y + 0.2) * exp(-length(q) * 0.8);
  vec3 amber = vec3(1.0, 0.62, 0.22);
  col += amber * gl * gl * 0.30 + amber * gl * 0.10;
  col += amber * patch_ * 0.22;
  col = mix(col, col * vec3(1.10, 0.98, 0.84), gl * 0.5);

  // three depths of snow: far (many, tiny, dim), middle, near (few, large, soft)
  vec2 sfar = sn_layer(uv, m, asp, 30.0, 0.55, 0.085, 0.55, 3.0, 0.55);
  vec2 smid = sn_layer(uv + 0.17, m, asp, 17.0, 0.85, 0.11, 0.6, 11.0, 0.50);
  vec2 snear = sn_layer(uv + 0.43, m, asp, 8.5, 1.25, 0.16, 0.85, 23.0, 0.42);
  vec3 cool = vec3(0.80, 0.90, 1.0);
  vec3 warm = vec3(1.0, 0.86, 0.62);
  vec3 snow = (cool * (sfar.x * 0.40 + smid.x * 0.62 + snear.x * 0.55)) + (warm * (sfar.y * 0.50 + smid.y * 0.75 + snear.y * 0.70));
  col += snow;
  col = col + snow * 0.0;

  col *= 1.0 - 0.38 * pow(length((uv - vec2(0.5, 0.45)) * vec2(1.0, 1.1)), 2.0) * (1.0 - 0.6 * gl);
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
