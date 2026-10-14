// label: Bokeh lights
// hint: soft out-of-focus light discs in the picture's own colours drift and breathe over the darker parts, pushed gently by the pointer
// category: Night and water
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
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}



float bk_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 bk_rot(vec2 p, float a) { float s = sin(a), c = cos(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float bk_hex(vec2 p) { p = abs(p); return max(p.x * 0.8660254 + p.y * 0.5, p.y); }   // hexagon distance (flat top), 1.0 at the corners... edge at 0.866*r

// one layer of discs: a jittered grid that drifts; each cell holds at most one disc, coloured from the picture's brighter spots
vec3 bk_layer(vec2 p, float asp, float sc, float ro, float seed, float spd, float rad, float dens) {
  vec2 g = bk_rot(p, ro) * sc + bk_rot(vec2(1.0, 0.45), ro * 2.0 + seed) * (time * spd);
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id + seed);
  if (h > dens) return vec3(0.0);
  float h2 = hash(id + seed + 4.3), h3 = hash(id + seed + 8.9);
  float breath = 1.0 + 0.09 * sin(time * (0.45 + 0.4 * h2) + h * 40.0);
  float r = rad * (0.72 + 0.5 * h2) * breath;
  vec2 c = (vec2(hash(id + seed + 1.7), hash(id + seed + 9.1)) - 0.5) * 2.0 * (0.5 - rad * 1.25 - 0.02);
  c += 0.04 * vec2(sin(time * 0.31 + h * 30.0), cos(time * 0.27 + h2 * 17.0));
  vec2 q = f - c;
  float d;
  if (h3 > 0.87) d = bk_hex(bk_rot(q, h * 6.28)) / 0.866;   // a few hexagonal (aperture-blade) discs
  else d = length(q);
  float soft = r * (0.10 + 0.18 * h3);
  float disc = smoothstep(r, r - soft, d);
  disc *= 0.62 + 0.55 * smoothstep(r * 0.55, r - soft * 0.5, d);   // brighter rim, like a real out-of-focus light
  // colour: the brightest / most saturated of three random spots of the picture
  vec2 s1 = vec2(0.06 + 0.88 * hash(id + seed + 2.1), 0.06 + 0.88 * hash(id + seed + 6.6));
  vec2 s2 = vec2(0.06 + 0.88 * hash(id + seed + 3.7), 0.06 + 0.88 * hash(id + seed + 7.2));
  vec2 s3 = vec2(0.06 + 0.88 * hash(id + seed + 5.1), 0.06 + 0.88 * hash(id + seed + 1.3));
  vec3 a = wall(s1), b = wall(s2), e = wall(s3);
  float va = max(a.r, max(a.g, a.b)), vb = max(b.r, max(b.g, b.b)), ve = max(e.r, max(e.g, e.b));
  float sa = va * (0.5 + (va - min(a.r, min(a.g, a.b))) / max(va, 0.05));
  float sb = vb * (0.5 + (vb - min(b.r, min(b.g, b.b))) / max(vb, 0.05));
  float se = ve * (0.5 + (ve - min(e.r, min(e.g, e.b))) / max(ve, 0.05));
  vec3 best = a; float bv = va;
  if (sb > sa && sb >= se) { best = b; bv = vb; } else if (se > sa && se > sb) { best = e; bv = ve; }
  vec3 tint = best / max(bv, 0.05);
  tint = mix(vec3(bk_lum(tint)), tint, 1.25);
  vec3 warm = mix(vec3(1.0, 0.72, 0.42), cCream.rgb, 0.3);
  tint = mix(warm, tint, smoothstep(0.22, 0.55, bv));        // dull picture: fall back to warm lamp tones
  tint = clamp(tint, 0.0, 1.0);
  float tw = 0.82 + 0.18 * sin(time * (0.6 + 0.5 * h3) + h2 * 50.0);
  return tint * disc * tw * (0.5 + 0.5 * h3);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  // pointer: discs slide gently away from it (lookup coordinate shifts toward it)
  vec2 dm = p - mp;
  float dl = length(dm);
  float wind = exp(-dl * dl / (2.0 * 0.2 * 0.2));
  vec2 pw = p - dm / (dl + 0.12) * 0.09 * wind;

  vec3 add = bk_layer(pw, asp, 3.0, 0.3, 1.0, 0.035, 0.27, 0.42)
           + bk_layer(pw + 0.5, asp, 5.2, 1.1, 7.0, 0.05, 0.25, 0.38) * 0.9
           + bk_layer(pw + 1.3, asp, 8.5, 2.2, 13.0, 0.07, 0.24, 0.30) * 0.8;
  float l = bk_lum(col);
  float dk = 0.30 + 0.70 * (1.0 - smoothstep(0.18, 0.85, l));   // strongest where the picture is dark
  add *= dk * 0.62;
  col = 1.0 - (1.0 - col) * (1.0 - clamp(add, 0.0, 1.0));      // screen: never clips harshly, readable on bright pictures too
  return vec4(col, 1.0) * qt_Opacity;
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
