// label: Water sparkle
// hint: sun or moon glitter twinkling on the lower half of the picture (water, wet road, snow), larger toward the bottom, brightest on bright areas
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



float ws_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// one layer of glitter on a perspective grid (cells are constant in 1/depth, so they grow toward the bottom of the picture)
float ws_layer(vec2 uv, float asp, float hz, float su, float sv, float seed, float spd, vec2 mp) {
  float z = uv.y - hz;
  float u = (uv.x - 0.5) * asp / (0.22 + 0.7 * z);   // columns widen less than rows grow, so the cells stay upright
  float v = 1.0 / z;
  vec2 g = vec2(u * su + time * spd * 0.35, v * sv + time * spd);   // slow drift toward the viewer, a little sideways
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h = hash(id + seed);
  if (h > 0.78) return 0.0;
  float h2 = hash(id + seed + 3.1), h3 = hash(id + seed + 6.3);
  vec2 c = 0.5 + (vec2(hash(id + seed + 1.1), hash(id + seed + 9.7)) - 0.5) * 0.4
         + 0.05 * vec2(sin(time * 0.5 + h * 30.0), cos(time * 0.4 + h2 * 20.0));
  vec2 d = f - c;
  // twinkle out of sync: short bright peaks (a few tenths of a Hz)
  float tw = 0.5 + 0.5 * sin(time * (0.9 + 1.6 * h2) + h3 * 60.0);
  tw = tw * tw * tw * tw;
  tw = 0.04 + tw;
  vec2 ad = abs(d);
  // flat horizontal glint with a thin vertical needle; perspective squashes it into a streak toward the horizon
  float core = exp(-(ad.x * ad.x) / (2.0 * 0.11 * 0.11) - (ad.y * ad.y) / (2.0 * 0.09 * 0.09));
  float arm = exp(-ad.x / 0.26 - ad.y / 0.03) * 0.8 + exp(-ad.y / 0.24 - ad.x / 0.025) * 0.45;
  vec2 w2 = smoothstep(0.0, 0.15, f) * smoothstep(1.0, 0.85, f);
  // brighter near the pointer
  vec2 sp = vec2(uv.x * asp, uv.y) - mp;
  float pt = 1.0 + 0.9 * exp(-dot(sp, sp) / (2.0 * 0.13 * 0.13));
  return (core + arm) * w2.x * w2.y * tw * (0.55 + 0.7 * h3) * pt;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  vec2 mp = vec2(m.x * asp, m.y);
  float hz = 0.44;
  float z = uv.y - hz;
  if (z > 0.015) {
    float mask = smoothstep(0.03, 0.2, z);                         // nothing on the sky, fades in below the horizon
    float l = ws_lum(col);
    float lit = 0.14 + 1.15 * smoothstep(0.12, 0.7, l);            // brighter where the picture is already bright, never zero
    float s = ws_layer(uv, asp, hz, 6.0, 1.15, 1.0, 0.16, mp)
            + 0.8 * ws_layer(uv, asp, hz, 11.0, 2.3, 17.0, 0.22, mp);
    vec3 hue = col / max(max(col.r, max(col.g, col.b)), 0.05);
    vec3 tint = mix(vec3(1.0, 0.97, 0.9), hue, 0.45);             // the light's colour is borrowed from the water under it
    vec3 add = tint * s * mask * lit * 1.5;
    col = 1.0 - (1.0 - col) * (1.0 - clamp(add, 0.0, 1.0));
  }
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
