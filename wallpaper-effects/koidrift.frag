// label: Koi drift
// hint: a few koi gliding under the surface of the water, darting away from the pointer
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

// slow koi gliding under the water; they swim away from the pointer and leave faint rings
vec4 koi(vec2 p, vec2 mp, float seed, float react) {
  float t = time * 0.07 + seed * 6.0;
  vec2 c = vec2(0.3 + 0.55 * seed + 0.28 * sin(t * 1.1 + seed * 9.0), 0.78 + 0.10 * sin(t * 0.8 + seed * 5.0));
  c.x *= res.x / res.y;
  vec2 away = c - mp;
  float da = length(away);
  c += away / max(da, 0.001) * clamp(react, 0.0, 2.0) * 0.22 * exp(-da * 2.2);
  vec2 vel = vec2(0.28 * 1.1 * cos(t * 1.1 + seed * 9.0), 0.10 * 0.8 * cos(t * 0.8 + seed * 5.0));
  vec2 dir = normalize(vel + away / max(da, 0.001) * 0.15 * exp(-da * 2.2) + vec2(0.0001));
  vec2 q = p - c;
  float u = dot(q, dir);
  float v = dot(q, vec2(-dir.y, dir.x));
  float len = 0.075;
  v -= sin(u * 24.0 - time * 3.0 + seed * 7.0) * 0.015 * smoothstep(0.3 * len, -len * 1.6, u);
  float sx = clamp(u / len, -1.0, 1.0);
  float body = 0.048 * sqrt(max(0.0, 1.0 - sx * sx)) * (0.65 + 0.35 * smoothstep(-1.0, 0.3, sx));
  float tt = clamp((-u - len) / (len * 0.95), 0.0, 1.0);
  float tail = (0.010 + 0.034 * tt) * step(len, -u) * step(-u, len * 1.95);
  float w = max(body * step(abs(u), len), tail);
  float a = smoothstep(w, w * 0.5 + 0.0001, abs(v)) * step(0.0005, w);
  float spot = smoothstep(0.50, 0.62, noise(vec2(u * 38.0, v * 55.0) + seed * 17.0));
  vec3 kc = mix(vec3(1.0, 0.50, 0.16), vec3(1.0, 0.93, 0.85), spot);
  return vec4(kc, a);
}
vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  float water = smoothstep(0.50, 0.66, uv.y);
  vec4 k1 = koi(p, mp, 0.15, react);
  vec4 k2 = koi(p, mp, 0.55, react);
  vec4 k3 = koi(p, mp, 0.85, react);
  vec4 k4 = koi(p, mp, 0.35, react);
  vec4 k5 = koi(p, mp, 0.70, react);
  vec3 col = base;
  col = mix(col, k1.rgb * (0.55 + 0.6 * luma(base)), k1.a * water * 0.95);
  col = mix(col, k2.rgb * (0.55 + 0.6 * luma(base)), k2.a * water * 0.95);
  col = mix(col, k3.rgb * (0.55 + 0.6 * luma(base)), k3.a * water * 0.95);
  col = mix(col, k4.rgb * (0.55 + 0.6 * luma(base)), k4.a * water * 0.95);
  col = mix(col, k5.rgb * (0.55 + 0.6 * luma(base)), k5.a * water * 0.95);
  float d = length(p - mp);
  float ring = 0.0;
  for (int i = 0; i < 2; i++) {
    float ph = fract(time * 0.25 + float(i) * 0.5);
    ring += smoothstep(0.008, 0.0, abs(d - ph * 0.25)) * (1.0 - ph);
  }
  col += vec3(0.85, 1.0, 0.95) * ring * clamp(react, 0.0, 2.0) * (0.3 + 0.7 * water) * 0.30;
  return col;
}

void main() {
  vec2 uv = qt_TexCoord0;
  vec3 base = wall(uv);
  vec3 c = overlay(uv, base, mouse / res, react);
  fragColor = clamp(vec4(c, 1.0) * qt_Opacity, 0.0, 1.0);
}
