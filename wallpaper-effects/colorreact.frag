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
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp(uv, 0.0, 1.0))).rgb; }
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


// OKLab distance between a pixel and the picked colour (cTarget): works for greys and for saturated colours alike
vec3 toLab(vec3 c) {
  c = pow(max(c, 0.0), vec3(2.2));
  float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 1.0 / 3.0);
  float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 1.0 / 3.0);
  float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
float matchOf(vec3 c, vec3 targetLab, float tol) {
  vec3 d = toLab(c) - targetLab;
  d.x *= 0.7;
  return 1.0 - smoothstep(tol * 0.55, tol, length(d));
}

// Only pixels close to the picked colour react: they glow near the pointer, are pulled toward it and ripple;
// everything else stays exactly the wallpaper. Without the pointer the picked colour just breathes slowly.
vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  vec2 A = vec2(res.x / res.y, 1.0);
  vec2 m = mpx / res;
  float tol = mix(0.04, 0.36, clamp(range, 0.0, 1.0));
  vec3 tLab = toLab(cTarget.rgb);

  vec2 d = (uv - m) * A;
  float r = length(d);
  float infl = exp(-r * r / (2.0 * 0.15 * 0.15));
  vec2 dir = d / max(r, 1e-4);

  // pull toward the pointer plus outgoing ripple rings, only sampled; the mask decides where they show
  vec2 off = dir / A * (infl * 0.035 + sin(r * 42.0 - time * 5.0) * infl * 0.006);
  vec3 base = wall(uv);
  vec3 moved = wall(uv + off);
  float mb = matchOf(base, tLab, tol);
  float mm = matchOf(moved, tLab, tol);
  vec3 col = mix(base, moved, mm * infl);
  float mask = max(mb, mm * infl);

  // glow: matched colour gets brighter and a little more saturated near the pointer, its edge lights up
  float edge = mask * (1.0 - mask) * 4.0;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 glow = mix(vec3(lum), col, 1.0 + 0.6 * infl) * (1.0 + (0.08 + 0.35 * (1.0 - lum)) * infl) + cTarget.rgb * 0.05 * infl;
  glow = glow / (1.0 + 1.5 * max(glow - 0.7, 0.0));
  col = mix(col, glow, mask * infl);
  col += mix(cTarget.rgb, cCream.rgb, 0.4) * edge * infl * 0.12;

  // idle breathing of the picked colour, anywhere on screen
  float breath = 0.5 + 0.5 * sin(time * 0.9 + fbm(uv * 3.0 * A) * 6.0);
  col *= 1.0 + mb * (breath - 0.5) * 0.12;
  return vec4(col, 1.0) * qt_Opacity;
}

void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
