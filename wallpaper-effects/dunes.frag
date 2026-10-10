// label: Dunes
// hint: golden-hour dunes, drifting sand, pointer stirs a gust
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

const vec3 SAND  = vec3(1.00, 0.80, 0.50);   // lit sand
const vec3 OCHRE = vec3(0.86, 0.52, 0.20);   // mid tones
const vec3 UMBER = vec3(0.26, 0.11, 0.07);   // lee side shadows
const vec3 HAZE  = vec3(1.00, 0.70, 0.40);   // warm air
const vec3 SUN   = vec3(1.00, 0.88, 0.64);   // low sun

// thin wind-blown sand streaks: rows of short dashes sliding sideways at row-dependent speeds
float streaks(vec2 p, float rows, float lenX, float speed, float seed, float boost) {
  vec2 q = vec2(p.x / lenX, p.y * rows);
  float row = floor(q.y);
  float h = hash(vec2(row, seed));
  q.x += -time * speed * (0.55 + 0.9 * h) - boost * (0.5 + h) + h * 17.0;
  float id = floor(q.x);
  float hh = hash(vec2(id, row + seed * 3.1));
  float seg = fract(q.x);
  float along = sin(seg * 3.14159);
  along *= along;
  float across = smoothstep(0.17, 0.0, abs(fract(q.y) - 0.5 - 0.3 * (hh - 0.5)));
  return step(0.8, hh) * along * across * (0.5 + 0.5 * h);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(mpx.x / res.x * asp, mpx.y / res.y);

  // the pointer is a gust: sand streams bend around it and race past
  vec2 d = p - mp;
  float r2 = dot(d, d);
  float R = 0.17;
  float gust = exp(-r2 / (R * R * 1.6));
  vec2 away = d * (R * R) / (r2 + R * R);
  float ground = smoothstep(0.0, 0.85, uv.y);              // dunes and haze build toward the bottom

  // heat shimmer: the picture wobbles gently near the bottom and around the gust
  float wob = vnoise(vec2(p.x * 9.0 + time * 0.35, p.y * 38.0 - time * 0.9));
  float wob2 = vnoise(vec2(p.x * 21.0 - time * 0.2, p.y * 70.0 - time * 1.3));
  float shim = (wob - 0.5) * 0.7 + (wob2 - 0.5) * 0.3;
  float amp = 0.0016 * (0.25 + 1.4 * smoothstep(0.45, 1.0, uv.y)) + 0.0022 * gust;
  vec2 suv = uv + vec2(shim * amp, shim * amp * 0.45);
  vec3 col = wall(suv);

  // golden hour grade: keep the picture's own colours but pull them toward amber, lift the shadows to umber
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 amber = mix(mix(UMBER, OCHRE, smoothstep(0.0, 0.45, l)), SAND, smoothstep(0.35, 1.0, l));
  col = mix(col, amber, 0.62);
  col = mix(col, col * vec3(1.06, 0.97, 0.84), 0.5);

  // dunes: lazy ridges with a gentle windward slope and a steeper shaded lee side, sun low on the left
  vec2 dq = p * 1.0;
  float warp = vnoise(dq * vec2(1.3, 1.9) + 3.0) * 1.1 + vnoise(dq * vec2(3.1, 4.3)) * 0.35 + vnoise(dq * vec2(6.5, 9.0)) * 0.1;
  float ph = uv.y * 2.6 + p.x * 0.30 + warp * 2.2;
  float f = fract(ph);
  float lee = smoothstep(0.70, 0.76, f) * smoothstep(1.0, 0.86, f);                 // steep shaded side
  float lit = smoothstep(0.05, 0.7, f) * (1.0 - smoothstep(0.70, 0.74, f));          // gentle sunlit side
  float crest = smoothstep(0.05, 0.0, abs(f - 0.72));                                 // bright knife-edge of the ridge
  float dg = smoothstep(0.22, 0.95, uv.y);
  col *= 1.0 - 0.26 * lee * (0.04 + 0.96 * dg);
  col += SAND * (0.06 * lit + 0.07 * crest) * dg;
  // fine sand ripples on the slopes
  float rip = sin(uv.y * 150.0 + warp * 40.0 + shim * 2.0) * 0.5 + 0.5;
  col *= 1.0 + 0.05 * (rip - 0.5) * ground * (0.4 + 0.6 * lit);

  // drifting sand: streaks in two depths; the gust pushes them aside and speeds them up
  vec2 sp = p - away * 0.9;
  float boost = gust * 2.6;
  float s1 = streaks(sp + vec2(0.0, 0.003 * sin(p.x * 5.0 + time * 0.4)), 95.0, 0.30, 0.26, 1.0, boost);
  float s2 = streaks(sp * 1.0 + vec2(0.31, 0.0), 52.0, 0.55, 0.42, 7.0, boost * 1.4);
  float sandy = (s1 * 0.55 + s2 * 0.8) * (0.25 + 0.75 * smoothstep(0.1, 0.8, uv.y));
  sandy *= 1.0 + gust * 1.2;
  col += mix(SAND, SUN, 0.35) * sandy * 0.5;

  // floating dust grains, two sizes, carried right; those near the pointer swirl and glow
  float grains = 0.0;
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 26.0 : 44.0;
    vec2 g = sp * sc;
    g.x -= time * (k == 0 ? 0.9 : 1.5);
    g.y += sin(time * 0.5 + float(k) * 2.0 + g.x * 0.3) * 0.25;
    vec2 id = floor(g), fl = fract(g) - 0.5;
    float h = hash(id + float(k) * 19.0);
    vec2 o = (vec2(hash(id + 3.3), hash(id + 8.1)) - 0.5) * 0.6;
    float rr = k == 0 ? 0.11 : 0.08;
    grains += step(0.78, h) * smoothstep(rr, 0.0, length(fl - o)) * (0.55 + 0.45 * sin(time * 1.6 + h * 40.0));
  }
  col += SUN * grains * (0.22 + 0.5 * gust);

  // warm air: haze thickens toward the horizon-bottom, a low sun glows in the upper right
  col = mix(col, col * 0.75 + HAZE * 0.34, 0.30 * smoothstep(0.35, 1.0, uv.y));
  float sunD = length((uv - vec2(0.86, 0.08)) * vec2(asp, 1.0));
  col += SUN * 0.20 * exp(-sunD * sunD * 3.2);
  col += HAZE * 0.08 * gust;
  // light vignette, warm instead of black
  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0) * vec3(0.8, 1.0, 1.25);
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
