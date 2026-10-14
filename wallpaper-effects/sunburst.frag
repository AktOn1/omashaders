// label: Golden rays
// hint: warm golden shafts of light fanning from an off-screen sun, slowly breathing
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



float sb_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 sb_bright() {
  vec3 b = vec3(0.0); float bl = -1.0;
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      vec3 s = wall(vec2(0.2 + 0.3 * float(i), 0.15 + 0.3 * float(j)));
      float l = sb_lum(s);
      if (l > bl) { bl = l; b = s; }
    }
  }
  return b;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);

  // the sun stands off-screen at the top right, or the top left when that side of the picture is brighter
  float lL = sb_lum(wall(vec2(0.10, 0.10))) + sb_lum(wall(vec2(0.25, 0.20)));
  float lR = sb_lum(wall(vec2(0.90, 0.10))) + sb_lum(wall(vec2(0.75, 0.20)));
  float left = step(lR + 0.08, lL);
  vec2 sun = vec2(mix(1.07, -0.07, left), -0.13);
  sun += vec2(0.015 * sin(time * 0.05), 0.012 * sin(time * 0.043 + 1.0));
  if (m.x > -1.0) sun += (m - 0.5) * vec2(-0.05, -0.03);
  vec2 q = (uv - sun) * vec2(asp, 1.0);
  float l = length(q);
  float a = atan(q.y, q.x);

  vec3 b = sb_bright();
  vec3 gold = mix(vec3(1.0, 0.78, 0.40), b / max(max(b.r, max(b.g, b.b)), 0.05), 0.22);

  // shafts: two scales of angular noise, drifting slowly; the whole fan breathes
  float s1 = noise(vec2(a * 9.0 + time * 0.035, 1.0));
  float s2 = noise(vec2(a * 22.0 - time * 0.045, 5.0));
  float sh = smoothstep(0.30, 0.78, s1 * 0.6 + s2 * 0.4);
  float breathe = 0.72 + 0.28 * sin(time * 0.27 + a * 4.0 + sin(time * 0.11) * 2.0);
  // density drifting along each shaft keeps them from looking like stripes
  float dens = 0.55 + 0.45 * noise(vec2(a * 6.0 + 3.0, l * 2.2 - time * 0.06));
  float fall = exp(-l * 0.85) * smoothstep(0.0, 0.25, l);
  float rays = sh * breathe * dens * fall;

  vec3 add = gold * rays * 0.55;
  // bloom around the hidden sun
  add += gold * (0.42 * exp(-l * 1.9) + 0.25 * exp(-l * 0.7)) * (0.9 + 0.1 * sin(time * 0.3));

  // screen blend (never darkens) plus a warm lift of the lit highlights
  col = col + add * (1.0 - col * 0.75);
  float lm = sb_lum(col);
  col += col * vec3(0.20, 0.10, 0.0) * rays * 0.9;
  col += gold * smoothstep(0.45, 1.0, lm) * 0.05;
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
