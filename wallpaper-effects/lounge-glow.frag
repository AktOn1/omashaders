// label: Seventies lounge glow
// hint: sodium light, teak veneer grain and a swag-lamp pool that leans toward the pointer
// category: Places and eras
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
vec3 lg_tap(vec2 uv) { return textureLod(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0)), 0.0).rgb; }
float lg_lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float lg_h1(float n) { return fract(sin(n * 127.1 + 3.7) * 43758.5453); }
float lg_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lg_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lg_h2(i), lg_h2(i + vec2(1, 0)), f.x), mix(lg_h2(i + vec2(0, 1)), lg_h2(i + vec2(1, 1)), f.x), f.y);
}

// how much warm halation one ring of taps gives back: only the parts of the picture that are already bright bleed
float lg_halo(vec2 uv, float asp) {
  vec2 e = vec2(0.030 / asp, 0.030);
  float b = 0.0;
  b += max(lg_lum(lg_tap(uv + e)) - 0.55, 0.0);
  b += max(lg_lum(lg_tap(uv - e)) - 0.55, 0.0);
  b += max(lg_lum(lg_tap(uv + vec2(e.x, -e.y))) - 0.55, 0.0);
  b += max(lg_lum(lg_tap(uv - vec2(e.x, -e.y))) - 0.55, 0.0);
  b += max(lg_lum(lg_tap(uv + vec2(e.x * 1.9, 0.0))) - 0.55, 0.0);
  b += max(lg_lum(lg_tap(uv - vec2(e.x * 1.9, 0.0))) - 0.55, 0.0);
  return b * (1.0 / 6.0);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  float t = time;

  vec3 pic = wall(uv);
  float lum = lg_lum(pic);

  // ---- the swag lamp: no lamp is drawn, only the warm pool of light it throws; it swings slowly and leans toward the pointer
  vec2 att = vec2(0.27 * asp, -0.06);
  float lean = clamp((mp.x - att.x) * 0.45, -0.50, 0.50) * smoothstep(2.8, 0.8, abs(mp.x - att.x));
  float ang = 0.030 * sin(t * 0.55) + 0.018 * sin(t * 1.13 + 1.0) + lean;
  vec2 lamp = att + vec2(sin(ang), cos(ang)) * 0.44;
  vec2 dl = p - lamp;
  float dd = length(dl * vec2(1.0, 1.25));
  float pool = exp(-dd * dd / (2.0 * 0.29 * 0.29));
  float cone = smoothstep(-0.05, 0.50, dl.y) * exp(-pow(dl.x / (0.13 + 0.60 * max(dl.y, 0.0)), 2.0)) * 0.75;
  float lit = pool * 0.95 + cone * 0.55;

  // ---- sodium colour wash: the mid-tones take the warm lamp colour, the shadows go brown-amber, the blues sink
  float mid = smoothstep(0.10, 0.38, lum) * smoothstep(0.98, 0.60, lum);
  vec3 col = pic;
  col = mix(col, col * vec3(1.12, 0.94, 0.72), 0.16 + 0.34 * mid + 0.22 * lit);
  vec3 amber = vec3(lum) * vec3(1.22, 0.96, 0.66);                           // every colour has amber pulled through it,
  float warmth = clamp((col.r - col.b) * 2.2 + 0.5, 0.0, 1.0);               // cold and green parts take much more of it than warm ones
  col = mix(col, amber, 0.09 + 0.11 * mid + 0.26 * (1.0 - warmth));
  col += vec3(0.040, 0.020, 0.006) * (1.0 - smoothstep(0.0, 0.55, lum));     // faded print: the blacks lift to warm brown

  // ---- teak veneer: long wavy grain with fine rays, multiplied in very lightly, as if the picture were printed on wood
  float gx = p.x * 30.0;
  float wav = lg_n(vec2(gx * 0.18, p.y * 1.5));
  float grain = lg_n(vec2(gx * 0.55 + wav * 3.2, p.y * 1.9));
  float rays = lg_n(vec2(gx * 2.3 + wav * 1.5, p.y * 22.0));
  float veneer = grain * 0.68 + rays * 0.32;
  col *= mix(vec3(1.0), vec3(1.07, 0.97, 0.86) * (0.90 + 0.21 * veneer), 0.30);

  // ---- halation: bright parts of the picture bleed a warm orange glow, as on old film under tungsten light
  float halo = lg_halo(uv, asp);
  col += vec3(1.0, 0.55, 0.20) * halo * 1.10;
  col += vec3(1.0, 0.76, 0.40) * max(lum - 0.70, 0.0) * 0.22;

  // ---- the lamp light on the picture
  col *= 0.93 + 0.34 * lit;
  col += vec3(1.0, 0.56, 0.18) * (pool * 0.110 + cone * 0.065);

  // ---- dust floating in the beam, lit only where the light is
  float motes = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float sp = 0.010 + 0.016 * lg_h1(fi * 3.1 + 1.0);
    float mx = fract(lg_h1(fi * 7.3) + t * sp * 0.30 + 0.030 * sin(t * 0.33 + fi)) * asp;
    float my = fract(lg_h1(fi * 2.7 + 2.0) - t * sp * 0.55);
    vec2 d = p - vec2(mx, my);
    float r = (0.0016 + 0.0022 * lg_h1(fi * 5.9)) * (1.0 + 0.3 * sin(t * 0.8 + fi * 2.1));
    motes += smoothstep(r, r * 0.15, length(d)) * (0.55 + 0.45 * sin(t * 1.7 + fi * 4.0));
  }
  col += vec3(1.0, 0.82, 0.52) * motes * 0.30 * clamp(lit, 0.0, 1.2);

  // ---- warm vignette: the corners fall into amber shadow
  float r2 = dot((uv - 0.5) * vec2(1.0, 1.08), (uv - 0.5) * vec2(1.0, 1.08));
  col = mix(col, col * vec3(1.0, 0.80, 0.56), clamp(r2 * 1.5, 0.0, 0.45));
  col *= 1.0 - 0.52 * r2;

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
