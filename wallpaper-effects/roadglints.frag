// label: Road glints
// hint: sparkle glints slide across the road and bonnet reflections, faster near the bottom
// category: Speed and motion
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


// one layer of road glints on a perspective ground plane: cells in world space, so far glints are small and slow, near ones large and quick
float rg_layer(vec2 uv, float asp, float hz, float scale, float spd, float seed, float dens, out float flare) {
  float dy = max(uv.y - hz, 0.02);
  float Z = 1.0 / dy;                                          // depth
  float X = (uv.x - 0.5) * asp * Z;                            // sideways world position
  vec2 g = vec2(X * scale * 0.5 + time * spd * 0.5, Z * scale * 0.9);      // the road slides left under the lens
  float rw = hash(vec2(floor(g.y), seed + 0.5));
  g.x += rw * 11.0 + time * spd * 0.3 * (rw - 0.5);        // rows slip against each other
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id + seed);
  flare = 0.0;
  if (h > dens) return 0.0;
  vec2 o = (vec2(hash(id + seed + 2.3), hash(id + seed + 5.1)) - 0.5) * vec2(0.45, 0.75);
  vec2 d = f - o;
  float hh = hash(id + seed + 9.7);
  // a short sparkle-streak along the direction of travel; a thin vertical flare for the brighter ones
  float lx = 0.10 + 0.07 * hh;
  float ly = 0.06 + 0.05 * hh;
  float st = exp(-(d.x * d.x) / (2.0 * lx * lx) - (d.y * d.y) / (2.0 * ly * ly));
  float dot_ = exp(-dot(d, d) / (2.0 * 0.035 * 0.07));
  flare = exp(-(d.x * d.x) / (2.0 * 0.006 * 0.006) - (d.y * d.y) / (2.0 * 0.22 * 0.22)) * step(0.55, hh);
  float tw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(time * (0.7 + 1.1 * hh) + hh * 60.0), 2.0);
  return (st * 0.9 + dot_ * 0.7) * tw;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  float hz = 0.56;
  float zone = smoothstep(0.64, 0.84, uv.y);                   // only the lower part of the picture
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  // a second look a little to the side: reflective patches are brighter than their surroundings
  vec3 c2 = wall(vec2(uv.x + 0.012, uv.y - 0.010));
  float lum2 = max(lum, dot(c2, vec3(0.2126, 0.7152, 0.0722)));
  float gate = 0.38 + 0.62 * smoothstep(0.06, 0.45, lum2);
  vec2 dm = (uv - m) * vec2(asp, 1.0);
  float pt = exp(-dot(dm, dm) / (2.0 * 0.16 * 0.16));          // the pointer wakes glints nearby
  gate = clamp(gate + 0.5 * pt, 0.0, 1.2);
  float f1, f2;
  float a = rg_layer(uv, asp, hz, 2.0, 0.50, 3.0, 0.52, f1);
  float b = rg_layer(uv, asp, hz, 4.0, 1.00, 17.0, 0.50, f2);
  float g = (a + 0.8 * b) * zone * gate * (1.0 + 0.8 * pt);
  float fl = (f1 + 0.7 * f2) * zone * gate * 0.6;
  vec3 tint = mix(vec3(1.0, 0.95, 0.85), col / max(max(col.r, max(col.g, col.b)), 0.15), 0.28);
  vec3 add = tint * clamp(g * 1.6 + fl, 0.0, 1.3);
  col = 1.0 - (1.0 - col) * (1.0 - clamp(add, 0.0, 1.0) * 0.9);   // screen
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
