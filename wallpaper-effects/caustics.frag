// label: Sunlit shallows
// hint: slow caustic light on the sand, ripples at the pointer
// category: Calm scenes
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
float cs_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 cs_h2(vec2 p) { return vec2(cs_h(p), cs_h(p + 19.19)); }
float cs_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cs_h(i), cs_h(i + vec2(1, 0)), f.x), mix(cs_h(i + vec2(0, 1)), cs_h(i + vec2(1, 1)), f.x), f.y);
}
vec2 cs_rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

// one layer of caustics. A few slow sine swells make a wavy water surface; light refracted by it is focused where the
// refraction map folds over itself, i.e. where the Jacobian of (p + bend * gradient of the height) has determinant zero.
// That is evaluated analytically (sines only, no loops over cells), and gives the thin bright, branching lines of real caustics.
float cs_net(vec2 p, float t, float sd, float bend) {
  float jxx = 1.0, jyy = 1.0, jxy = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float h = cs_h(vec2(fi, sd + 1.7));
    float h2 = cs_h(vec2(fi + 9.0, sd + 4.1));
    float ang = fi * 1.0472 + h * 0.9 + sd;
    vec2 k = vec2(cos(ang), sin(ang));
    float kk = 1.0 + 0.55 * h2;                         // wavenumber, a little different for every swell
    float ph = dot(p, k) * kk + t * (0.45 + 0.5 * h) * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0) + fi * 2.3;
    float b = bend * kk * kk * 0.34 * sin(ph);
    jxx -= b * k.x * k.x;
    jyy -= b * k.y * k.y;
    jxy -= b * k.x * k.y;
  }
  float det = jxx * jyy - jxy * jxy;
  float x = abs(det) * 5.5;
  float soft = 1.0 / (1.0 + x * x * 0.3);
  return 0.75 / (1.0 + x * x * 3.0) + 0.30 * soft * soft;
}

// tiny sand specks stirred up by the current: one speck per cell, drifting slowly, twinkling very gently
float cs_specks(vec2 uv, float asp, float scale, float speed, float sd) {
  vec2 p = vec2(uv.x * asp, uv.y) * scale;
  p += vec2(time * speed, time * speed * 0.35 + sin(time * 0.11 + sd) * 0.6);
  vec2 id = floor(p), f = fract(p) - 0.5;
  float h = cs_h(id + sd);
  if (h < 0.55) return 0.0;
  vec2 o = (cs_h2(id + sd + 3.1) - 0.5) * 0.6 + 0.10 * vec2(sin(time * 0.4 + h * 40.0), cos(time * 0.33 + h * 23.0));
  float r = 0.035 + 0.035 * cs_h(id + sd + 1.3);
  float tw = 0.45 + 0.55 * (0.5 + 0.5 * sin(time * (0.35 + h) + h * 90.0));
  return smoothstep(r, r * 0.2, length(f - o)) * tw;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  vec3 col = wall(uv);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));

  // the pointer touches the water: soft rings run outward and bend the light net
  vec2 dm = p - mp;
  float r = length(dm);
  vec2 dir = dm / max(r, 1e-4);
  float env = exp(-r * 2.8) * smoothstep(0.0, 0.05, r);
  float ph = r * 34.0 - time * 2.1;
  float wave = sin(ph) * env;
  vec2 pw = p + dir * wave * 0.075;                          // refraction: the net is pushed along the rings
  float rim = pow(0.5 + 0.5 * sin(ph - 1.2), 5.0);

  // shallow clear water: a cool turquoise veil that is lighter toward the "surface" at the top, picture still visible
  vec3 aqua = vec3(0.50, 0.90, 0.88);
  col = mix(col, vec3(l) * aqua * 1.15 + col * 0.35, 0.28);
  col += vec3(0.010, 0.060, 0.070) * (1.0 - 0.55 * uv.y);
  col = mix(col, col * vec3(0.88, 1.0, 0.98), 0.25);

  // two layers of caustic net at different scales, drifting different ways, plus a broad slow patch of sunlight
  float t = time * 0.55;
  float n1 = cs_net(pw * 30.0 + vec2(t * 0.10, -t * 0.05), t, 0.0, 1.15);
  float n2 = cs_net(cs_rot(pw, -0.8) * 49.0 + vec2(-t * 0.07, t * 0.09) + 5.0, t * 0.8 + 2.0, 3.0, 0.95);
  float net = n1 * 0.85 + n2 * 0.55;
  float patch_ = 0.55 + 0.45 * cs_n(p * 1.3 + vec2(time * 0.012, -time * 0.008));
  net *= patch_;
  net += 0.10 * n1 * n2;
  vec3 sun = vec3(1.0, 0.95, 0.78);
  vec3 cool = vec3(0.55, 1.0, 0.95);
  col += mix(cool, sun, 0.55) * net * 0.34;
  col += cool * net * net * 0.05;
  col += vec3(0.04, 0.10, 0.10) * rim * env * 3.2;          // the wet sheen of the ring crests

  // a soft pale-sand glow on the bottom, as if the light reached the sand there
  col += vec3(0.05, 0.045, 0.025) * smoothstep(0.55, 1.0, uv.y);

  // sand specks drifting in the current, two depths
  float sp = cs_specks(uv, asp, 34.0, 0.006, 1.0) + 0.7 * cs_specks(uv + 0.3, asp, 19.0, 0.010, 7.0);
  col += vec3(1.0, 0.94, 0.78) * sp * 0.30;

  col *= 1.0 - 0.32 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
