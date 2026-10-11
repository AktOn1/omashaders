// label: Sleep sky
// hint: a blue hour sky of indigo and plum with slow clouds, a thin crescent and stars that fade in and out, the pointer wakes nearby stars
// category: Cozy corners
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
float sl2_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sl2_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sl2_h(i), sl2_h(i + vec2(1, 0)), f.x), mix(sl2_h(i + vec2(0, 1)), sl2_h(i + vec2(1, 1)), f.x), f.y);
}
float sl2_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sl2_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sl2_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 sl2_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }

// blue hour wind-down: an indigo to plum sky, long slow clouds with lilac edges, a thin crescent moon and stars that
// fade in and out very slowly; the whole sky breathes at the pace of sleep; the pointer wakes the stars near it
float sl2_cres(vec2 p, vec2 c, float R, float shift) {
  float a = smoothstep(R, R * 0.93, length(p - c));
  float b = smoothstep(R * 0.92, R * 0.99, length(p - c - vec2(shift, shift * -0.35)));
  return a * b;
}
vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = sl2_ptr(mpx, vec2(-5.0));
  float breath = 0.5 + 0.5 * sin(t * 0.52);                           // about 12 s per breath
  // sky gradient: plum at the horizon, indigo overhead, deep navy at the top
  vec3 top = vec3(0.020, 0.030, 0.095);
  vec3 mid = vec3(0.075, 0.075, 0.220);
  vec3 low = vec3(0.34, 0.20, 0.40);
  float y = uv.y;
  vec3 sky = mix(top, mid, smoothstep(0.0, 0.55, y));
  sky = mix(sky, low, smoothstep(0.45, 1.05, y) * (0.85 + 0.15 * breath));
  vec3 base = wall(uv);
  sky += base * vec3(0.05, 0.04, 0.09) * 0.8;                          // a trace of the picture
  // stars: sparse, slow fade in and out, wake near the pointer
  vec2 sp = p * 44.0;
  vec2 id = floor(sp), f = fract(sp) - 0.5;
  float h = sl2_h(id + 3.3);
  if (h > 0.90) {
    vec2 o = (vec2(sl2_h(id + 1.7), sl2_h(id + 6.1)) - 0.5) * 0.6;
    float ph = t * (0.12 + 0.12 * sl2_h(id)) + h * 60.0;
    float tw = pow(0.5 + 0.5 * sin(ph), 2.0);
    float near = exp(-dot(p - m * vec2(asp, 1.0), p - m * vec2(asp, 1.0)) * 18.0);
    float s = smoothstep(0.10, 0.0, length(f - o)) * (0.12 + 0.7 * tw + 0.8 * near * react) * (0.35 + 0.65 * sl2_h(id + 2.9));
    sky += vec3(0.85, 0.88, 1.0) * s * (1.0 - smoothstep(0.55, 0.95, y)) * 0.8;
  }
  // long clouds, drifting very slowly; lit on their upper edge by the last light
  float c1 = sl2_fbm(vec2(p.x * 0.9 - t * 0.004, y * 5.5) + 2.0);
  float c2 = sl2_fbm(vec2(p.x * 1.3 - t * 0.007 + 7.0, y * 7.5) + 9.0);
  float band1 = smoothstep(0.52, 0.72, c1) * exp(-pow((y - 0.62) / 0.14, 2.0));
  float band2 = smoothstep(0.50, 0.70, c2) * exp(-pow((y - 0.80) / 0.13, 2.0));
  float band3 = smoothstep(0.55, 0.75, sl2_fbm(vec2(p.x * 0.7 - t * 0.003 + 15.0, y * 4.0))) * exp(-pow((y - 0.35) / 0.10, 2.0)) * 0.6;
  vec3 cloudCol = vec3(0.17, 0.14, 0.32);
  vec3 rim = vec3(0.60, 0.42, 0.65);
  float edge = smoothstep(0.0, 0.5, c1 - sl2_fbm(vec2(p.x * 0.9 - t * 0.004, y * 5.5 + 0.08) + 2.0) + 0.25);
  sky = mix(sky, cloudCol, clamp(band1 + band2 * 0.9, 0.0, 0.8));
  sky += rim * (band1 * edge * 0.18 + band2 * 0.10);
  sky = mix(sky, vec3(0.10, 0.10, 0.26), band3 * 0.6);
  // crescent moon, with a halo that swells a little with each breath
  vec2 mc = vec2(0.80 * asp, 0.22);
  float dm = length(p - mc);
  vec3 col = sky + vec3(0.55, 0.55, 0.95) * exp(-dm * dm / (2.0 * 0.12 * 0.12)) * (0.10 + 0.06 * breath);
  col = mix(col, vec3(0.95, 0.93, 0.85), sl2_cres(p, mc, 0.040, 0.020) * 0.92);
  col *= 0.94 + 0.06 * breath;
  col *= 1.0 - 0.35 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
