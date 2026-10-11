// label: Breath orb
// hint: guided breathing: a pastel orb swells for 4 seconds, rests for 2 and shrinks for 6, ripples leave on every exhale, the pointer draws it gently
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
float bo_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bo_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bo_h(i), bo_h(i + vec2(1, 0)), f.x), mix(bo_h(i + vec2(0, 1)), bo_h(i + vec2(1, 1)), f.x), f.y);
}
float bo_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * bo_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float bo_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 bo_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }

// guided breathing: a soft orb of pastel rings that swells for 4 s, rests for 2 s, shrinks for 6 s (a 12 s breath),
// ripples leaving on every exhale; the pointer draws the orb gently toward itself
float bo_breath(float t) {
  float ph = mod(t, 12.0);
  if (ph < 4.0) { float x = ph / 4.0; return x * x * (3.0 - 2.0 * x); }
  if (ph < 6.0) return 1.0;
  float x = (ph - 6.0) / 6.0; x = x * x * (3.0 - 2.0 * x);
  return 1.0 - x;
}
vec3 bo_ramp(float x) {            // lavender -> peach -> sea mint, repeating gently
  vec3 a = vec3(0.58, 0.50, 0.90);
  vec3 b = vec3(0.98, 0.70, 0.62);
  vec3 c = vec3(0.50, 0.88, 0.80);
  x = fract(x);
  if (x < 0.333) return mix(a, b, smoothstep(0.0, 0.333, x));
  if (x < 0.667) return mix(b, c, smoothstep(0.333, 0.667, x));
  return mix(c, a, smoothstep(0.667, 1.0, x));
}
vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = bo_ptr(mpx, vec2(0.5, 0.5));
  float b = bo_breath(t);
  vec2 c = mix(vec2(0.5, 0.5), m, 0.18) * vec2(asp, 1.0);
  vec2 d = p - c;
  float r = length(d);
  vec3 base = wall(uv);
  // background: a deep dusky teal-violet field that lightens a little as the orb swells
  vec3 col = mix(vec3(0.045, 0.050, 0.120), vec3(0.090, 0.075, 0.190), smoothstep(0.0, 1.0, uv.y));
  col += base * 0.05;
  float R = 0.16 + 0.12 * b;                                       // orb radius
  // orb: layered gradient, brighter centre, rim of pastel colour that slowly turns
  float ang = atan(d.y, d.x);
  float turn = t * 0.015;
  vec3 rimc = bo_ramp(ang / 6.28318 + turn);
  float body = smoothstep(R, R * 0.35, r);
  float rim = exp(-pow((r - R) / (0.020 + 0.01 * b), 2.0));
  col += mix(vec3(0.20, 0.16, 0.34), rimc * 0.5, smoothstep(0.0, R, r)) * body * 0.9;
  col += rimc * rim * 0.55;
  col += vec3(1.0, 0.92, 0.88) * exp(-r * r / (2.0 * 0.05 * 0.05)) * (0.18 + 0.20 * b);       // glowing core
  // an aura around the orb
  col += rimc * exp(-pow(max(r - R, 0.0) / (0.12 + 0.06 * b), 2.0)) * 0.12 * (0.7 + 0.5 * b);
  // ripples: on every exhale three rings leave the orb and fade
  float tm = mod(t, 12.0);
  for (int i = 0; i < 3; i++) {
    float st = 6.0 + float(i) * 1.2;
    float age = (tm - st) / 6.0;
    if (age > 0.0 && age < 1.0) {
      float rr = R + age * (0.55 - float(i) * 0.08);
      col += bo_ramp(ang / 6.28318 + 0.3 * float(i) + turn) * exp(-pow((r - rr) / 0.006, 2.0)) * (1.0 - age) * (1.0 - age) * 0.35;
    }
  }
  col *= 1.0 - 0.40 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
