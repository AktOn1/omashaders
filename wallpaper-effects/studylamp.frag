// label: Study lamp
// hint: a desk lamp in a dark room: a warm cone and pool of light with dust in the beam, the pointer swings the lamp
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
float sl_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sl_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sl_h(i), sl_h(i + vec2(1, 0)), f.x), mix(sl_h(i + vec2(0, 1)), sl_h(i + vec2(1, 1)), f.x), f.y);
}
float sl_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sl_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sl_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 sl_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }

// a desk lamp in a dark room: a warm cone and a pool of light on the desk, dust turning in the beam;
// the pointer swings the lamp, the picture shows through, darkened and warmed
float sl_motes(vec2 p, float cell, float spd, float sd, float t) {
  vec2 q = p / cell;
  q.y -= t * spd;
  q.x += sin(t * 0.15 + q.y * 0.7 + sd * 9.0) * 0.3;
  vec2 id = floor(q), f = fract(q) - 0.5;
  float h = sl_h(id + sd);
  if (h < 0.55) return 0.0;
  vec2 o = (vec2(sl_h(id + sd + 3.1), sl_h(id + sd + 7.7)) - 0.5) * 0.6;
  float r = 0.07 + 0.09 * sl_h(id + sd + 1.3);
  float tw = 0.5 + 0.5 * sin(t * (0.5 + sl_h(id + 5.5)) + h * 40.0);
  return smoothstep(r, r * 0.2, length(f - o)) * tw;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = sl_ptr(mpx, vec2(0.30, 0.5));
  // the lamp head sits above the top edge; the pointer slides it sideways, and tilts the beam
  float lampX = mix(0.30, m.x, 0.8) * asp;
  vec2 head = vec2(lampX, -0.10);
  vec2 poolC = vec2(lampX + (m.x - 0.5) * 0.10, 0.80 + (m.y - 0.5) * 0.06);
  vec2 axis = normalize(poolC - head);
  vec2 rel = p - head;
  float along = dot(rel, axis);
  float across = dot(rel, vec2(-axis.y, axis.x));
  float halfW = 0.10 + along * 0.52;                            // the cone opens downward
  float cone = smoothstep(halfW, halfW * 0.35, abs(across)) * smoothstep(0.0, 0.25, along);
  cone *= 1.0 - 0.45 * smoothstep(0.5, 1.15, along);
  // the pool of light on the desk: a flat ellipse
  vec2 pd = (p - poolC) * vec2(1.0, 2.6);
  float pool = exp(-dot(pd, pd) / (2.0 * 0.30 * 0.30));
  float glow = exp(-dot(rel, rel) / (2.0 * 0.22 * 0.22));      // the bulb's own glow, above the screen

  vec3 base = wall(uv);
  float l = sl_lum(base);
  vec3 night = mix(vec3(0.012, 0.016, 0.035), vec3(0.060, 0.075, 0.130), smoothstep(0.0, 0.7, l));  // dark blue room
  night += base * 0.10;
  // the desk: lower part, lit wood with long horizontal grain
  float deskY = 0.70;
  float desk = smoothstep(deskY - 0.004, deskY + 0.012, uv.y);
  float grain = sl_n(vec2(uv.x * 7.0, uv.y * 260.0)) * 0.6 + sl_n(vec2(uv.x * 22.0 + 5.0, uv.y * 90.0)) * 0.4;
  vec3 wood = vec3(0.20, 0.12, 0.07) * (0.55 + 0.9 * grain);
  vec3 col = mix(night, night * 0.55 + wood * 0.22, desk);
  vec3 warm = vec3(1.0, 0.70, 0.36);
  vec3 hot = vec3(1.0, 0.86, 0.60);
  float lit = clamp(cone * 0.55 + pool * 0.95, 0.0, 1.2);
  // light on the wall picture is its own colours, warmed; on the desk it shows the grain
  vec3 under = mix(base * vec3(1.15, 0.95, 0.70), wood * 1.8 * (0.5 + grain), desk);
  col += under * lit * 0.55 + warm * lit * 0.10;
  col += hot * glow * 0.30;
  // the desk edge catches a thin highlight inside the pool
  col += hot * smoothstep(0.012, 0.0, abs(uv.y - deskY)) * pool * 0.22;
  // dust turning in the beam
  float dust = sl_motes(p + vec2(0.0, 0.0), 0.045, 0.012, 1.0, t) + 0.7 * sl_motes(p * 0.8 + 9.0, 0.07, 0.008, 2.0, t);
  col += hot * dust * cone * (1.0 - desk) * 0.55;
  // slow flicker-free breathing of the whole lamp
  col *= 0.97 + 0.03 * sin(t * 0.3);
  col *= 1.0 - 0.55 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
