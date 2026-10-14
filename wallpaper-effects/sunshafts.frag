// label: Sun shafts
// hint: slanting sunbeams with dust drifting in them; the pointer parts the air
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
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; }

// slanting sun shafts with dust drifting in them; the pointer parts the air
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float shafts(vec2 p) {
  vec2 q = rot(p - vec2(0.05, -0.1), 0.50);
  float a = q.x;
  float w = 0.5 + 0.5 * sin(a * 13.0 + 5.0 * noise(vec2(a * 2.2 + time * 0.03, 1.0)) + time * 0.05);
  float b = smoothstep(0.45, 0.95, w) * (0.35 + 0.95 * noise(vec2(a * 4.0 - time * 0.02, 5.0)));
  float leaf = 0.65 + 0.35 * noise(vec2(a * 2.0 + 4.0, q.y * 3.0 - time * 0.10));
  float breathe = 0.78 + 0.22 * sin(time * 0.35 + a * 2.2);
  return b * leaf * breathe * exp(-max(q.y, 0.0) * 0.30);
}
float dust(vec2 p, float scale, float rad, float drift, float seed, float lit) {
  vec2 g = p * scale;
  g += vec2(time * drift * 0.4, -time * drift) + 0.5 * vec2(noise(g * 0.5 + seed + time * 0.03) - 0.5, noise(g * 0.5 + seed + 9.0 - time * 0.025) - 0.5);
  vec2 id = floor(g);
  float h = hash(id + seed);
  if (h < 0.55) return 0.0;
  vec2 o = (vec2(hash(id + seed + 3.1), hash(id + seed + 6.7)) - 0.5) * 0.5 + 0.14 * vec2(sin(time * 0.4 + h * 40.0), cos(time * 0.3 + h * 23.0));
  float d = length(fract(g) - 0.5 - o);
  float tw = 0.4 + 0.6 * pow(0.5 + 0.5 * sin(time * (0.5 + h) + h * 90.0), 2.0);
  return (smoothstep(rad, rad * 0.15, d) + 0.25 * smoothstep(rad * 3.0, 0.0, d)) * tw * lit;
}
vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  vec2 dm = p - mp;
  float wind = clamp(react, 0.0, 2.0) * exp(-dot(dm, dm) / (2.0 * 0.20 * 0.20));
  vec2 pw = mp + rot(dm * (1.0 - 0.5 * wind), 0.5 * wind);
  float s = shafts(pw) * (1.0 - 0.3 * wind);
  vec3 sun = vec3(1.0, 0.93, 0.72);
  vec3 col = base + sun * s * 0.78 * (1.1 - 0.5 * luma(base));
  float lit = 0.35 + 1.2 * s;
  float mo = dust(pw, 18.0, 0.09, 0.012, 1.0, lit) + 0.8 * dust(pw + 0.3, 9.0, 0.1, 0.018, 7.0, lit) + 0.5 * dust(pw + 0.6, 4.5, 0.12, 0.025, 19.0, lit);
  col += vec3(1.0, 0.92, 0.7) * mo * 0.7;
  return col;
}

void main() {
  vec2 uv = qt_TexCoord0;
  vec3 base = wall(uv);
  vec3 c = overlay(uv, base, mouse / res, react);
  fragColor = clamp(vec4(c, 1.0) * qt_Opacity, 0.0, 1.0);
}
