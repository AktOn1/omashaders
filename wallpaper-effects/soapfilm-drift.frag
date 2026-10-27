// label: Soap film
// hint: a drifting film of soap sits on the picture and splits the light into interference colours, thinner and black at the top, draining downward; the pointer pops and pushes it
// category: Light and prism
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
  vec4 tr0;
  vec4 tr1;
  vec4 tr2;
  vec4 tr3;
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales

float sf_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sf_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sf_hash(i), sf_hash(i + vec2(1, 0)), f.x), mix(sf_hash(i + vec2(0, 1)), sf_hash(i + vec2(1, 1)), f.x), f.y);
}
float sf_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * sf_noise(p); p = p * 2.07 + 13.0; a *= 0.5; }
  return v;
}
float sf_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// ---- thin-film interference -------------------------------------------------
// A soap film reflects two rays: one off the front face, one off the back face.
// They travel an extra optical path D = 2*n*thickness and the front reflection
// flips phase, so a wavelength L comes back with reflectance ~ sin^2(pi*D/L).
// Running that per channel through the red, green and blue response gives the
// Newton colour series: black, straw, gold, magenta, blue, green, pink ...
const vec3 SF_LAMBDA = vec3(612.0, 549.0, 464.0);   // nm, the channels' mean wavelengths
const float SF_PI = 3.14159265;

vec3 sf_film1(float D) {                             // one coherent sample (cheap, for the rims)
  vec3 s = sin(SF_PI * max(D, 0.0) / SF_LAMBDA);
  return s * s;
}
// Real films are never perfectly even: within one pixel the thickness varies a
// little, which washes the higher orders out. Averaging three nearby thicknesses
// reproduces that, so the deep orders fade to pale pearl instead of rainbow mush.
vec3 sf_film(float D) {
  float d = max(D, 0.0);
  vec3 a = sin(SF_PI * d / SF_LAMBDA);
  vec3 b = sin(SF_PI * (d * 1.11 + 26.0) / SF_LAMBDA);
  vec3 c = sin(SF_PI * (d * 0.89 + 52.0) / SF_LAMBDA);
  return (a * a + b * b + c * c) * 0.3333;
}

// soft light (W3C blend mode): a mid-grey layer leaves the picture exactly as it is
vec3 sf_soft(vec3 b, vec3 s) {
  vec3 lo = 2.0 * b * s + b * b * (1.0 - 2.0 * s);
  vec3 hi = sqrt(clamp(b, 0.0, 1.0)) * (2.0 * s - 1.0) + 2.0 * b * (1.0 - s);
  return mix(lo, hi, step(vec3(0.5), s));
}

// one floating bubble: a thin iridescent rim with a small highlight, drifting up
vec4 sf_bubble(vec2 p, float t, float id) {
  float h1 = sf_hash(vec2(id, 3.7));
  float h2 = sf_hash(vec2(id, 9.1));
  float R = 0.040 + 0.034 * h1;
  float yy = fract(h2 + t * (0.010 + 0.007 * h1));
  float y = 1.10 - yy * 1.20;                                  // bottom to top
  float x = 0.10 + 0.80 * h2 + 0.030 * sin(t * 0.21 + h1 * 6.28);
  float asp = res.x / res.y;
  vec2 d = p - vec2(x * asp, y);
  float r = length(d);
  if (r > R * 1.35) return vec4(0.0);
  float rim = exp(-pow((r - R) / (R * 0.11), 2.0));
  // the bubble's own film drains too: thicker at its bottom, so the rim runs through the series
  float D = 240.0 + 560.0 * (0.5 + 0.5 * d.y / R) + 150.0 * sin(atan(d.y, d.x) * 2.0 + t * 0.18 + h2 * 6.0);
  vec3 cr = sf_film1(D);
  float hl = exp(-pow(length(d - vec2(-0.36, -0.40) * R) / (R * 0.18), 2.0));
  float fade = smoothstep(0.0, 0.12, y) * smoothstep(1.02, 0.90, y);
  float a = (rim * 0.60 + hl * 0.45) * fade;
  return vec4(cr * rim * 1.15 + vec3(0.95, 0.98, 1.0) * hl * 0.85, a);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;

  // ---- the flow: a curl of slow noise, so the film creases and swirls instead of sliding
  vec2 q = p * 1.60 + vec2(0.0, -t * 0.016);
  float e = 0.055;
  float n0 = sf_fbm(q);
  float nx = sf_fbm(q + vec2(e, 0.0));
  float ny = sf_fbm(q + vec2(0.0, e));
  vec2 curl = vec2(ny - n0, -(nx - n0)) / e;                   // divergence-free: it stirs, never piles up
  vec2 warp = p * 4.30 + curl * 0.160 + vec2(0.0, -t * 0.032);

  // ---- thickness of the film, in nanometres of optical path
  float th = 0.16 + 0.98 * (sf_noise(warp) * 0.58 + sf_noise(warp * 2.4 + 21.0) * 0.28 + sf_noise(warp * 5.3 + 47.0) * 0.14);
  vec3 base0 = wall(uv);
  float lum0 = sf_luma(base0);
  th += 0.30 * uv.y;                                           // gravity: the film drains down and thickens
  th += 0.22 * (1.0 - lum0);                                   // thicker where the picture is dark
  // the film drains away at the top: where it has gone it is only nanometres thick and
  // every wavelength cancels, the black film. It hangs in a few patches, never as a band.
  float drained = smoothstep(0.50, 0.95, sf_noise(vec2(p.x * 2.9 + t * 0.010, 1.7)));
  float topThin = smoothstep(0.0, 0.025 + 0.195 * drained, uv.y);

  // ---- the pointer: a ring of ripples that pushes the film, and a pop flash when it moves fast
  vec2 m = mpx / res;
  vec2 dm = p - vec2(m.x * asp, m.y);
  float rm = length(dm);
  float env = exp(-rm * 13.0);
  float ripple = sin(rm * 72.0 - t * 2.6) * env * 0.11;
  float sp = 0.0;                                              // pointer speed from the trail (0 when there is no trail)
  if (min(length(tr0.xy), length(tr0.zw)) > 1.0) sp = distance(tr0.xy, tr0.zw);
  float fast = smoothstep(5.0, 34.0, sp);
  float pop = exp(-pow((rm - 0.055) / 0.020, 2.0)) * fast;     // a bright burst ring on a quick flick
  th += ripple + pop * 0.16;

  float black = 1.0 - topThin;                                 // how far the film has drained away
  float D = mix(120.0 + th * 520.0, 45.0, black);              // thin film: every wavelength cancels, so it turns grey-black
  vec3 film = sf_film(D);

  // the interference colour, split into how bright the reflection is and what hue it is
  float fl = dot(film, vec3(0.3333));
  vec3 chroma = film - fl;                                     // sums to zero: pure colour, no brightness

  // ---- where the sheen may show: strongest on the mid and bright parts, patchy, a trace in the dark
  float cover = 0.46 + 0.54 * smoothstep(0.22, 0.68, n0 + 0.18 * uv.y);
  float sheen = (0.16 + 0.84 * smoothstep(0.04, 0.32, lum0)) * (1.0 - 0.62 * smoothstep(0.62, 1.00, lum0)) * cover;
  sheen *= 1.0 - 0.72 * black;

  // the film bends the light a hair, so the picture ripples under it
  vec2 off = clamp(curl * 0.00075 + dm * env * 0.012, -0.0022, 0.0022);
  vec3 col = wall(uv + off);

  // the hue of the film is laid on without touching the picture's brightness, so it stays readable
  col += chroma * sheen * (0.30 + 0.52 * lum0) * 0.60;
  // and its brightness as soft light around mid grey, which leaves a mid film alone
  col = mix(col, sf_soft(col, mix(vec3(0.5), vec3(fl), 0.70)), sheen * 0.28);
  col = mix(col, col * vec3(0.88, 0.90, 0.95), black * 0.30);  // the black film is a grey veil, not a hole

  // a faint specular sheen where the film creases, in its own interference colour
  float crease = smoothstep(0.35, 1.0, length(curl) * 0.85);
  col += film * crease * sheen * 0.10;
  col += vec3(0.85, 0.92, 1.0) * pop * 0.12 * sheen;           // the pop flash itself
  col += film * max(ripple, 0.0) * env * 0.14 * sheen;         // light caught on the ripple crests

  // ---- three floating bubbles, translucent, mostly rim
  vec4 b0 = sf_bubble(p, t, 1.0);
  vec4 b1 = sf_bubble(p, t, 2.0);
  vec4 b2 = sf_bubble(p, t, 3.0);
  col += (b0.rgb * b0.a + b1.rgb * b1.a + b2.rgb * b2.a) * 0.20;

  return vec4(clamp(col, 0.0, 1.0), 1.0) * qt_Opacity;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored, above 1 = exaggerated
void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
