// label: Cloud garden
// hint: slow pastel clouds with sunlit rims, parted by mouse
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
float cs_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cs_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cs_h(i), cs_h(i + vec2(1, 0)), f.x), mix(cs_h(i + vec2(0, 1)), cs_h(i + vec2(1, 1)), f.x), f.y);
}
float cs_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * cs_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

// cloud density of one layer at point p (aspect-corrected screen units): puffy cumulus, thresholded fbm
float cs_dens(vec2 p, float sc, float cover, float seed, float t, float speed) {
  vec2 q = p * sc + vec2(t * speed + seed * 13.0, seed * 7.0);
  q.y *= 1.5;                                                  // wider than tall
  float n = cs_fbm(q) * 0.85 + 0.15 * cs_n(q * 4.0 + 3.0);
  return smoothstep(cover, cover + 0.11, n);
}

// one layer: returns the cloud colour in rgb and its coverage in a. The sun sits to the upper right, so edges facing it get a warm rim
// and the underside of every puff is a soft blue-lilac shade.
vec4 cs_layer(vec2 p, vec2 pdm, float push, float sc, float cover, float seed, float t, float speed, float soft) {
  vec2 pp = p - pdm * push;                                    // smooth lens: the sample point is pulled toward the pointer, so the clouds move away from it
  float d = cs_dens(pp, sc, cover, seed, t, speed);
  float e = 0.075 / sc;
  float dSun = cs_dens(pp + vec2(0.6, -0.8) * e, sc, cover, seed, t, speed);     // toward the sun (y grows downward)
  float dLow = cs_dens(pp + vec2(-0.2, 1.0) * e * 1.3, sc, cover, seed, t, speed); // below
  float rim = clamp(d - dSun, 0.0, 1.0);                       // thinner toward the sun: the sunlit edge
  float under = clamp(d - dLow, 0.0, 1.0);                     // thinner below: the underside
  vec3 lit = vec3(0.985, 0.965, 0.95);                         // creamy, never pure white
  vec3 shade = vec3(0.74, 0.80, 0.94);                         // soft blue-lilac
  vec3 col = mix(lit, shade, 0.85 * under);
  col = mix(col, vec3(1.0, 0.88, 0.74), rim * 0.75);           // warm sunlit rim
  return vec4(col, d * soft);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  vec3 col = wall(uv);

  // pastel sky tint over the picture: powder blue above, a hint of peach toward the horizon
  vec3 skyTop = vec3(0.60, 0.72, 0.92);
  vec3 skyLow = vec3(1.00, 0.84, 0.76);
  vec3 sky = mix(skyTop, skyLow, smoothstep(0.1, 1.0, uv.y));
  col = mix(col, col * 0.80 + sky * 0.28, 0.45);

  // warm sun glow, upper right, with a faint haze
  vec2 sp = vec2(0.82 * asp, 0.12);
  float ds = length(p - sp);
  col += vec3(1.0, 0.82, 0.58) * exp(-ds * ds / (2.0 * 0.28 * 0.28)) * 0.13;
  col += vec3(1.0, 0.90, 0.75) * exp(-ds * ds / (2.0 * 0.07 * 0.07)) * 0.05;

  // the pointer parts the clouds: they are pushed away from it and thin out a little around it
  vec2 dm = p - mp;
  float dl = length(dm);
  float part = exp(-dl * dl / (2.0 * 0.16 * 0.16));
  float lift = exp(-dl * dl / (2.0 * 0.10 * 0.10));

  // three layers, far to near: smaller, paler and slower in the distance; larger, slower to change and brighter up close
  vec4 L1 = cs_layer(p, dm, part * 0.30, 3.0, 0.57, 1.0, time, 0.0042, 0.50);
  vec4 L2 = cs_layer(p, dm, part * 0.42, 2.0, 0.57, 2.0, time, 0.0075, 0.70);
  vec4 L3 = cs_layer(p, dm, part * 0.55, 1.3, 0.59, 3.0, time, 0.0120, 0.85);
  float thin = (1.0 - 0.45 * lift) * (1.0 - 0.75 * smoothstep(0.55, 0.9, uv.y));   // clouds thin out low down, over the ground
  col = mix(col, L1.rgb, L1.a * thin);
  col = mix(col, L2.rgb, L2.a * thin);
  col = mix(col, L3.rgb, L3.a * thin);

  // soft light near the pointer, where the clouds open up
  col += vec3(1.0, 0.88, 0.72) * lift * 0.035;

  col = min(col, vec3(0.97, 0.955, 0.94));                  // gentle ceiling: no glare
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
