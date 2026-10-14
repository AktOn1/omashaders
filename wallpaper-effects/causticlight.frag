// label: Caustic light
// hint: drifting caustic light webs on the water in the lower half, glints, and ripples that spread from the pointer
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

// caustic light on the water, rings that spread from the pointer, a few glints
vec3 overlay(vec2 uv, vec3 base, vec2 m, float react) {
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  float lum = luma(base);
  float water = smoothstep(0.36, 0.62, uv.y);
  vec2 dm = p - mp;
  float d = length(dm);
  float near = clamp(react, 0.0, 2.0) * exp(-d * 3.2);
  vec2 push = dm / max(d, 0.001) * sin(d * 52.0 - time * 4.5) * 0.05 * near;
  vec2 q = (p + push) * 9.0;
  float t = time * 0.28;
  float n1 = noise(q + vec2(t, t * 0.6) + 3.0 * noise(q * 0.5 - t));
  float n2 = noise(q * 1.37 + vec2(-t * 0.8, t) + 11.0);
  float web = clamp(1.0 - abs(n1 - n2) * 2.4, 0.0, 1.0);
  float n3 = noise(q * 0.8 + vec2(t * 0.5, -t * 0.7) + 21.0);
  float n4 = noise(q * 1.1 - vec2(t * 0.6, t * 0.4) + 31.0);
  float web2 = clamp(1.0 - abs(n3 - n4) * 2.4, 0.0, 1.0);
  float caustic = pow(web, 3.0) * 0.6 + pow(web2, 3.0) * 0.5;
  vec3 lc = mix(vec3(0.92, 1.0, 0.96), base * 1.5 + 0.1, 0.35);
  vec3 col = base + lc * caustic * (0.15 + 0.85 * water) * (0.30 + 0.70 * smoothstep(0.05, 0.6, lum)) * 0.75;
  float ring = 0.0;
  for (int i = 0; i < 3; i++) {
    float ph = fract(time * 0.30 + float(i) / 3.0);
    ring += smoothstep(0.010, 0.0, abs(d - ph * 0.34)) * (1.0 - ph);
  }
  col += lc * ring * clamp(react, 0.0, 2.0) * (0.4 + 0.6 * water) * 0.30;
  vec2 g = uv * vec2(64.0, 36.0);
  vec2 id = floor(g);
  float h = hash(id);
  float tw = pow(0.5 + 0.5 * sin(time * (1.2 + 2.5 * h) + h * 50.0), 3.0);
  col += lc * smoothstep(0.2, 0.0, length(fract(g) - 0.5)) * step(0.90, h) * tw * water * 0.55;
  return col;
}

void main() {
  vec2 uv = qt_TexCoord0;
  vec3 base = wall(uv);
  vec3 c = overlay(uv, base, mouse / res, react);
  fragColor = clamp(vec4(c, 1.0) * qt_Opacity, 0.0, 1.0);
}
