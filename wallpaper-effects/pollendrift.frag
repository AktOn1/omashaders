// label: Pollen drift
// hint: pollen and seeds floating up on the breeze, blown aside by the pointer
// category: Sun and sky
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

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; }

// pollen and fluffy seeds drifting on a slow breeze; the pointer blows them aside
float pollen(vec2 p, float scale, float rad, float speed, float seed, float seedy) {
  vec2 g = p * scale;
  g += vec2(time * speed, -time * speed * 0.45);
  g += 0.9 * vec2(noise(g * 0.35 + seed + time * 0.05) - 0.5, noise(g * 0.35 + seed + 5.0 - time * 0.04) - 0.5);
  vec2 id = floor(g);
  float h = hash(id + seed);
  if (h < 0.60) return 0.0;
  vec2 o = (vec2(hash(id + seed + 2.3), hash(id + seed + 8.1)) - 0.5) * 0.5;
  o += 0.18 * vec2(sin(time * 0.6 + h * 31.0), cos(time * 0.5 + h * 17.0));
  vec2 v = fract(g) - 0.5 - o;
  float d = length(v);
  float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(time * (0.7 + h) + h * 70.0), 2.0);
  float v0 = smoothstep(rad, rad * 0.1, d) + 0.22 * smoothstep(rad * 3.5, 0.0, d);
  float spokes = smoothstep(rad * 0.18, 0.0, min(abs(v.x), abs(v.y))) * smoothstep(rad * 4.0, 0.0, d) * seedy;
  return (v0 + 0.7 * spokes) * tw;
}
vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  vec2 dm = p - mp;
  float d = length(dm);
  float gust = clamp(react, 0.0, 2.0) * exp(-d * d / (2.0 * 0.16 * 0.16));
  vec2 pw = p + dm / max(d, 0.001) * (-0.20 * gust);
  float a = pollen(pw, 16.0, 0.08, 0.05, 1.0, 0.0) + 0.8 * pollen(pw + 0.4, 8.0, 0.09, 0.075, 5.0, 0.0) + 0.7 * pollen(pw + 0.8, 3.6, 0.10, 0.10, 13.0, 1.0);
  vec3 col = base + mix(vec3(1.0, 0.95, 0.72), base * 1.6 + 0.15, 0.25) * a * 0.75;
  col += vec3(1.0, 0.95, 0.75) * 0.05 * gust;
  return col;
}

void main() {
  vec2 uv = qt_TexCoord0;
  vec3 base = wall(uv);
  vec3 c = overlay(uv, base, mouse / res, react);
  fragColor = clamp(vec4(c, 1.0) * qt_Opacity, 0.0, 1.0);
}
