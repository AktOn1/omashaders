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


vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 d = (uv - m) * vec2(asp, 1.0);
  float r = length(d);
  vec2 dir = d / max(r, 0.0001);
  vec2 px = 3.0 / res;
  float tl = dot(wall(uv + px * vec2(-1.0, -1.0)), vec3(0.33));
  float tc = dot(wall(uv + px * vec2(0.0, -1.0)), vec3(0.33));
  float tr = dot(wall(uv + px * vec2(1.0, -1.0)), vec3(0.33));
  float ml = dot(wall(uv + px * vec2(-1.0, 0.0)), vec3(0.33));
  float mr = dot(wall(uv + px * vec2(1.0, 0.0)), vec3(0.33));
  float bl = dot(wall(uv + px * vec2(-1.0, 1.0)), vec3(0.33));
  float bc = dot(wall(uv + px * vec2(0.0, 1.0)), vec3(0.33));
  float br = dot(wall(uv + px * vec2(1.0, 1.0)), vec3(0.33));
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
  float e = smoothstep(0.10, 0.55, length(vec2(gx, gy)));
  vec3 nc = mix(cBlue.rgb, cPink.rgb, 0.5 + 0.5 * sin(uv.x * 3.0 + uv.y * 2.0 + time * 0.5));
  vec3 col = wall(uv) * 0.3 + nc * e * 1.3;
  col = mix(col, wall(uv), smoothstep(0.2, 0.08, r) * 0.85);
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
