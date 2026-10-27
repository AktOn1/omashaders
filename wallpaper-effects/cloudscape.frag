// label: Cloud garden
// hint: slow pastel clouds that gather where the picture is bright and open
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
// a tap of the picture at an explicit level, safe to call anywhere
vec3 cs_tap(vec2 uv) { return textureLod(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0)), 0.0).rgb; }
float cs_lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
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

// the far layer needs no sculpting: a pale, flat puff
vec4 cs_far(vec2 p, float sc, float cover, float seed, float t, float speed, float soft) {
  float d = cs_dens(p, sc, cover, seed, t, speed);
  return vec4(mix(vec3(0.985, 0.965, 0.95), vec3(0.84, 0.88, 0.97), 0.35), d * soft);
}

// the middle layer: one extra sample below, so the undersides get the blue-lilac shade and the tops stay creamy
vec4 cs_mid(vec2 p, float sc, float cover, float seed, float t, float speed, float soft) {
  float d = cs_dens(p, sc, cover, seed, t, speed);
  float dLow = cs_dens(p + vec2(-0.2, 1.0) * (0.095 / sc), sc, cover, seed, t, speed);
  float under = clamp(d - dLow, 0.0, 1.0);
  vec3 col = mix(vec3(0.985, 0.965, 0.95), vec3(0.76, 0.82, 0.95), 0.78 * under);
  return vec4(col, d * soft);
}

// one layer: returns the cloud colour in rgb and its coverage in a. The sun sits to the upper right, so edges facing it get a warm rim
// and the underside of every puff is a soft blue-lilac shade.
vec4 cs_layer(vec2 p, float sc, float cover, float seed, float t, float speed, float soft) {
  float d = cs_dens(p, sc, cover, seed, t, speed);
  float e = 0.075 / sc;
  float dSun = cs_dens(p + vec2(0.6, -0.8) * e, sc, cover, seed, t, speed);     // toward the sun (y grows downward)
  float dLow = cs_dens(p + vec2(-0.2, 1.0) * e * 1.3, sc, cover, seed, t, speed); // below
  float rim = clamp(d - dSun, 0.0, 1.0);                       // thinner toward the sun: the sunlit edge
  float under = clamp(d - dLow, 0.0, 1.0);                     // thinner below: the underside
  vec3 lit = vec3(0.985, 0.965, 0.95);                         // creamy, never pure white
  vec3 shade = vec3(0.74, 0.80, 0.94);                         // soft blue-lilac
  vec3 col = mix(lit, shade, 0.85 * under);
  col = mix(col, vec3(1.0, 0.88, 0.74), rim * 0.75);           // warm sunlit rim
  return vec4(col, d * soft);
}

// how open and sky-like the picture is around uv: bright and smooth reads as sky, dark or busy reads as ground
float cs_open(vec2 uv, float asp) {
  vec2 e = vec2(0.055 / asp, 0.055);
  float l0 = cs_lum(cs_tap(uv));
  float l1 = cs_lum(cs_tap(uv + e));
  float l2 = cs_lum(cs_tap(uv - e));
  float l3 = cs_lum(cs_tap(uv + vec2(e.x, -e.y)));
  float l4 = cs_lum(cs_tap(uv - vec2(e.x, -e.y)));
  float mean = (l0 + l1 + l2 + l3 + l4) * 0.2;
  float hi = max(max(l0, l1), max(max(l2, l3), l4));
  float lo = min(min(l0, l1), min(min(l2, l3), l4));
  float smoothness = smoothstep(0.45, 0.10, hi - lo);          // little contrast around here: an open surface
  return smoothstep(0.14, 0.48, mean) * mix(0.42, 1.0, smoothness);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec3 col = wall(uv);

  // where the picture is bright and open, clouds may gather; over dark or busy ground only a breath of haze stays
  float open = cs_open(uv, asp);
  float place = 0.07 + 0.93 * open;

  // pastel sky tint: powder blue above, a hint of peach toward the horizon, mostly on the open parts
  vec3 skyTop = vec3(0.60, 0.72, 0.92);
  vec3 skyLow = vec3(1.00, 0.84, 0.76);
  vec3 sky = mix(skyTop, skyLow, smoothstep(0.1, 1.0, uv.y));
  col = mix(col, col * 0.90 + sky * 0.15, 0.12 + 0.26 * open);

  // warm sun glow, upper right, with a faint haze
  vec2 sp = vec2(0.82 * asp, 0.12);
  float ds = length(p - sp);
  float sunlit = 0.20 + 0.80 * open;                        // the glow only lands on open, lit parts: no sun painted on a dark picture
  col += vec3(1.0, 0.82, 0.58) * exp(-ds * ds / (2.0 * 0.30 * 0.30)) * 0.085 * sunlit;
  col += vec3(1.0, 0.90, 0.75) * exp(-ds * ds / (2.0 * 0.11 * 0.11)) * 0.030 * sunlit;

  // three layers, far to near: smaller, paler and slower in the distance; larger, slower to change and brighter up close
  vec4 L1 = cs_far(p, 3.0, 0.58, 1.0, time, 0.0042, 0.46);
  vec4 L2 = cs_mid(p, 2.0, 0.58, 2.0, time, 0.0075, 0.62);
  vec4 L3 = cs_layer(p, 1.3, 0.60, 3.0, time, 0.0120, 0.75);
  float thin = place * (1.0 - 0.40 * smoothstep(0.55, 0.95, uv.y));   // clouds thin out low down, toward the foreground
  col = mix(col, L1.rgb, L1.a * thin);
  col = mix(col, L2.rgb, L2.a * thin);
  col = mix(col, L3.rgb, L3.a * thin);

  col = min(col, vec3(0.97, 0.955, 0.94));                  // gentle ceiling: no glare
  col *= 1.0 - 0.10 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
  fragColor = vec4(col, 1.0) * qt_Opacity;
  return fragColor;
}

// this effect does not follow the pointer: one pass, the mouse reaction slider has nothing to change
void main() {
  fragColor = clamp(fxMain(mouse), 0.0, 1.0);
}
