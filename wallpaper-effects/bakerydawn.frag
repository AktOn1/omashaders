// label: Bakery dawn
// hint: a peach and rose sunrise through a tall window, flour dust floating in the light, golden loaves on the shelf, the pointer stirs the flour
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
float bd_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bd_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bd_h(i), bd_h(i + vec2(1, 0)), f.x), mix(bd_h(i + vec2(0, 1)), bd_h(i + vec2(1, 1)), f.x), f.y);
}
float bd_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * bd_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float bd_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 bd_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }

// a bakery at dawn: a peach and rose sunrise through a tall window, flour dust floating in the light, warm loaves on the shelf;
// the pointer stirs the flour
vec3 bd_crust(float x, float y) {                 // golden crust: lighter on top, darker on the underside
  return mix(vec3(0.55, 0.30, 0.13), vec3(0.93, 0.66, 0.34), clamp(y, 0.0, 1.0)) * (0.85 + 0.2 * x);
}
vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = bd_ptr(mpx, vec2(-5.0));
  vec2 mp = m * vec2(asp, 1.0);
  vec3 base = wall(uv);
  // dawn sky: rose at the top, peach and cream near the horizon, a big soft sun low on the left
  vec3 sky = mix(vec3(0.74, 0.55, 0.62), vec3(0.99, 0.80, 0.62), smoothstep(0.0, 0.62, uv.y));
  sky = mix(sky, vec3(1.0, 0.92, 0.78), smoothstep(0.45, 0.70, uv.y) * 0.8);
  sky = mix(sky, sky * 0.6 + base * vec3(1.0, 0.85, 0.75) * 0.6, 0.18);
  vec2 sunC = vec2(0.26 * asp, 0.55);
  float ds = length(p - sunC);
  sky += vec3(1.0, 0.86, 0.60) * exp(-ds * ds / (2.0 * 0.16 * 0.16)) * 0.35 + vec3(1.0, 0.95, 0.80) * smoothstep(0.050, 0.030, ds) * 0.7;
  // a couple of long, soft clouds
  float cl = smoothstep(0.50, 0.75, bd_fbm(vec2(p.x * 1.1 - t * 0.003, uv.y * 7.0) + 3.0)) * exp(-pow((uv.y - 0.30) / 0.10, 2.0));
  sky = mix(sky, vec3(1.0, 0.78, 0.74), cl * 0.45);
  vec3 col = sky;
  // the window: tall mullions and a transom across the dawn, dark wood seen from inside, lit at the edges
  float mx = abs(fract(p.x / (asp / 3.0)) - 0.5) * (asp / 3.0);
  float tr = abs(uv.y - 0.28);
  float frame = smoothstep(0.010, 0.006, asp / 6.0 - mx) + smoothstep(0.008, 0.004, tr);
  vec3 wood = vec3(0.30, 0.17, 0.10) * (0.8 + 0.4 * bd_n(vec2(p.x * 6.0, uv.y * 60.0)));
  col = mix(col, wood, clamp(frame, 0.0, 1.0) * 0.80);
  // window light falls into the room: a warm haze that is thicker in the lower right
  col += vec3(1.0, 0.82, 0.55) * 0.05;
  // the shelf and loaves along the bottom
  float shelf = 0.80;
  if (uv.y > shelf) {
    float fy = (uv.y - shelf) / (1.0 - shelf);
    col = mix(vec3(0.58, 0.36, 0.20), vec3(0.36, 0.21, 0.12), smoothstep(0.0, 1.0, fy)) * (0.75 + 0.3 * bd_n(vec2(p.x * 4.0, uv.y * 120.0)));
    col = mix(col, vec3(0.95, 0.80, 0.55), smoothstep(0.012, 0.0, uv.y - shelf) * 0.5);
  }
  // loaves: domed ovals standing on the shelf, with scoring
  float cw = 0.20;
  float lid = floor(p.x / cw);
  float lx = (fract(p.x / cw) - 0.5) * cw;
  float lh = bd_h(vec2(lid, 2.0));
  float lw = 0.075 + 0.025 * lh;
  float ht = 0.085 + 0.045 * bd_h(vec2(lid, 6.0));
  float dx = lx / lw;
  float dy = (shelf + 0.004 - uv.y) / ht;
  float q = dx * dx + dy * dy;
  float lm = smoothstep(1.0, 0.94, q) * step(0.0, dy);
  if (lm > 0.0) {
    vec3 lc = bd_crust(dx, dy * 0.9);
    // scoring: three diagonal cuts, lighter
    float cut = smoothstep(0.10, 0.0, abs(fract((dx * 3.0 + dy * 1.6) * 1.1) - 0.5) - 0.40) * smoothstep(0.55, 0.30, abs(dx));
    lc = mix(lc, vec3(0.99, 0.84, 0.56), cut * 0.5 * step(0.1, dy));
    lc *= 0.70 + 0.45 * smoothstep(-1.0, 0.5, -dx * 0.8 + dy * 0.6);       // lit from the left, where the sun is
    col = mix(col, lc * 0.92, lm);
  }
  // flour dust floating, brighter where the sun is; the pointer stirs it
  float dust = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float cell = 0.05 + 0.025 * fk;
    vec2 q2 = p / cell;
    q2.y += t * (0.02 + 0.01 * fk);
    q2.x += sin(t * 0.1 + q2.y * 0.6 + fk * 2.0) * 0.5;
    vec2 away = p - mp;
    q2 += normalize(away + 1e-4) * exp(-dot(away, away) * 14.0) * 1.4 * react;
    vec2 id = floor(q2), f = fract(q2) - 0.5;
    float h = bd_h(id + fk * 11.0);
    vec2 o = (vec2(bd_h(id + 3.1), bd_h(id + 7.7)) - 0.5) * 0.6;
    float rr = 0.04 + 0.05 * bd_h(id + 1.3);
    float tw = 0.5 + 0.5 * sin(t * (0.4 + bd_h(id + 5.5)) + h * 40.0);
    dust += step(0.72, h) * smoothstep(rr, rr * 0.2, length(f - o)) * (0.5 + 0.5 * tw);
  }
  col += vec3(1.0, 0.97, 0.90) * dust * 0.32;
  col *= 1.0 - 0.30 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
