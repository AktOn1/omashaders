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


vec3 flies(vec2 p, vec2 mp, float sc, float seed, float t, float asp) {
  vec2 g = p * sc;
  vec2 id = floor(g);
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = id + vec2(float(i), float(j));
      float h = hash(cell + seed);
      if (h < 0.55) continue;
      float h2 = hash(cell + seed + 4.3), h3 = hash(cell + seed + 8.9), h4 = hash(cell + seed + 1.1);
      vec2 c = cell + 0.5 + 0.42 * vec2(sin(t * 0.5 * (0.23 + h2 * 0.30) + h * 40.0) + 0.5 * sin(t * 0.5 * (0.61 + h3 * 0.4) + h2 * 30.0),
                                        sin(t * 0.5 * (0.19 + h3 * 0.30) + h2 * 50.0) + 0.5 * sin(t * 0.5 * (0.53 + h4 * 0.4) + h3 * 20.0));
      vec2 w = c / sc;
      vec2 away = (w - mp) * vec2(asp, 1.0);
      float dm = length(away);
      c += normalize(away + 1e-4) * smoothstep(0.20, 0.0, dm) * 0.7 * sc * 0.1;
      vec2 dd = g - c;
      float d2 = dot(dd, dd);
      float period = 4.0 + 3.5 * h4;
      float ph = fract(t / period + h * 7.0);
      float pulse = smoothstep(0.0, 0.25, ph) * smoothstep(0.75, 0.35, ph);
      float blink = 0.5 + 0.5 * pulse * pulse * (0.9 + 0.1 * sin(t * 7.0 + h * 90.0));
      float core = exp(-d2 * 560.0 / (sc * 0.11));
      float halo = exp(-d2 * 60.0 / (sc * 0.11));
      vec3 tint = mix(vec3(0.55, 1.0, 0.22), vec3(0.78, 1.0, 0.35), h3);
      acc += blink * (tint * halo * 0.55 + vec3(0.72, 1.0, 0.50) * core * 1.2);
    }
  }
  return acc;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec3 col = wall(uv) * 0.62;
  col = mix(col, col * vec3(0.75, 0.95, 0.9), 0.5);
  vec3 glow = flies(p, vec2(m.x, m.y), 6.0, 0.0, time, asp)
            + 0.8 * flies(p + 3.7, vec2(m.x, m.y), 10.0, 17.0, time, asp);
  col += glow * vec3(0.9, 1.0, 0.8);
  col = mix(col, col * (1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0) * 1.2), 1.0);
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
