// label: Tea house
// hint: a shoji screen glowing with paper light and bamboo shadows, a tatami floor and a cup whose steam rises at the pointer
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
float th_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float th_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th_h(i), th_h(i + vec2(1, 0)), f.x), mix(th_h(i + vec2(0, 1)), th_h(i + vec2(1, 1)), f.x), f.y);
}
float th_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * th_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float th_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 th_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }

// a Japanese tea room: a shoji screen glowing with paper light and swaying bamboo shadows, a tatami floor,
// and a cup of tea whose steam rises where the pointer is
float th_leaf(vec2 p, vec2 c, float ang, float len, float wid) {
  vec2 d = p - c;
  float ca = cos(ang), sa = sin(ang);
  vec2 q = vec2(d.x * ca + d.y * sa, -d.x * sa + d.y * ca);
  float u = q.x / len;
  if (u < 0.0 || u > 1.0) return 0.0;
  float w = wid * sin(3.14159 * u) * (1.0 - 0.3 * u);
  return smoothstep(w, w * 0.4, abs(q.y));
}
float th_bamboo(vec2 p, float x0, float width, float t, float sd, float asp) {
  float sway = sin(t * 0.25 + sd * 6.0) * 0.012 * p.y;
  float xs = x0 + sway;
  float stalk = smoothstep(width, width * 0.6, abs(p.x - xs));
  float node = smoothstep(0.004, 0.0, abs(fract(p.y * 3.2 + sd) - 0.5) - 0.47) * 0.0;
  float nd = smoothstep(0.012, 0.0, abs(fract((p.y + sd) * 3.2) - 0.0));
  stalk *= 1.0;
  // leaves: a few hanging clusters
  float lv = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float ly = 0.12 + 0.17 * fi + 0.04 * th_h(vec2(fi, sd));
    float side = (i % 2 == 0) ? 1.0 : -1.0;
    vec2 c = vec2(xs + side * 0.01 + sway * 0.4, ly);
    float flutter = sin(t * 0.5 + fi * 2.0 + sd * 5.0) * 0.08;
    lv += th_leaf(p, c, 0.5 + side * -0.9 + flutter, 0.15, 0.011);
    lv += th_leaf(p, c + vec2(0.0, 0.02), 1.6 + side * 0.4 + flutter, 0.12, 0.010);
    lv += th_leaf(p, c + vec2(0.0, -0.015), 0.0 + side * -1.4 + flutter, 0.13, 0.010);
  }
  return clamp(stalk + lv, 0.0, 1.0);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = th_ptr(mpx, vec2(0.62, 0.5));
  float floorY = 0.74;

  vec3 base = wall(uv);
  // paper: warm cream, lit from outside, a little of the picture seen through it
  vec3 paper = vec3(0.90, 0.84, 0.66) * (0.78 + 0.18 * th_lum(base)) ;
  float fib = th_n(vec2(p.x * 90.0, p.y * 60.0)) * 0.5 + th_n(vec2(p.x * 25.0 + 4.0, p.y * 200.0)) * 0.5;
  paper *= 0.94 + 0.08 * fib;
  paper *= 0.82 + 0.18 * smoothstep(1.0, 0.0, uv.y);               // brighter at the top
  // bamboo shadows on the paper: three stalks at different depths
  float bam = th_bamboo(p, 0.22 * asp, 0.007, t, 0.3, asp) * 0.55 + th_bamboo(p, 0.58 * asp, 0.010, t, 1.9, asp) * 0.65 + th_bamboo(p, 0.86 * asp, 0.006, t, 3.1, asp) * 0.5;
  paper = mix(paper, paper * vec3(0.52, 0.58, 0.40), clamp(bam, 0.0, 1.0) * 0.55);
  // the shoji lattice: dark wood, a 4 x 3 grid of panels with a finer cross rail
  float cw = asp / 5.0;
  float gx = abs(fract(p.x / cw) - 0.5) * cw;
  float gy = abs(fract(uv.y / (floorY / 3.0)) - 0.5) * (floorY / 3.0);
  float lat = smoothstep(cw * 0.5 - 0.004, cw * 0.5, gx) + smoothstep(floorY / 6.0 - 0.003, floorY / 6.0, gy);
  float fine = smoothstep(0.0022, 0.0, abs(fract(p.x / (cw / 3.0)) - 0.5) * (cw / 3.0) - 0.0) * 0.0;
  float rail = smoothstep(0.0025, 0.0, abs(fract(uv.y / (floorY / 9.0)) - 0.5) * (floorY / 9.0) - (floorY / 18.0 - 0.0025)) * 0.0;
  lat = clamp(lat, 0.0, 1.0);
  vec3 wood = vec3(0.17, 0.11, 0.07) * (0.8 + 0.4 * th_n(vec2(p.x * 8.0, p.y * 80.0)));
  vec3 col = mix(paper, wood, lat * 0.92);
  // a soft glow of daylight, brighter in the middle of the screen
  col += vec3(1.0, 0.92, 0.70) * 0.06 * exp(-dot((uv - vec2(0.5, 0.35)) * vec2(1.3, 1.0), (uv - vec2(0.5, 0.35)) * vec2(1.3, 1.0)) * 3.0);

  // the floor: tatami mats with dark cloth borders
  if (uv.y > floorY) {
    float fy = (uv.y - floorY) / (1.0 - floorY);
    vec2 q = vec2(p.x / (0.34 * (0.5 + fy)), fy);
    float mid = abs(fract(p.x / 0.62) - 0.5);
    vec3 tat = vec3(0.66, 0.62, 0.38) * (0.8 + 0.2 * th_n(vec2(p.x * 160.0, uv.y * 12.0)));
    tat *= 0.82 + 0.4 * smoothstep(1.0, 0.0, fy) * 0.5;
    float border = smoothstep(0.006, 0.0, abs(fract(p.x / 0.62) - 0.5) - 0.495 + 0.0) ;
    tat = mix(tat, vec3(0.08, 0.10, 0.06), smoothstep(0.012, 0.0, abs(mid - 0.5) ) * 0.9);
    tat = mix(tat, vec3(0.10, 0.12, 0.08), smoothstep(0.012, 0.0, abs(fy - 0.5)) * 0.0);
    col = tat * 0.7;
    // the sill where the screen meets the floor
    col = mix(col, wood * 1.1, smoothstep(0.018, 0.0, uv.y - floorY));
  }
  // the cup: sits on the floor at the pointer's x
  float cx = clamp(m.x, 0.08, 0.92) * asp;
  vec2 cupC = vec2(cx, 0.87);
  vec2 cd = (p - cupC) * vec2(1.0, 1.0);
  float cup = smoothstep(0.003, 0.0, length(vec2(cd.x * 0.8, max(cd.y - 0.0, 0.0) * 1.6 - 0.0)) - 0.034) * step(cd.y, 0.0);
  float cupBody = smoothstep(0.002, 0.0, max(abs(cd.x) - 0.034 * (1.0 + cd.y * 4.0), 0.0) + max(cd.y - 0.0, -cd.y - 0.04) - 0.0);
  float cupMask = step(abs(cd.x), 0.034 + cd.y * 0.45) * step(0.0, -cd.y + 0.0) * step(cd.y, 0.0) ;
  cupMask = smoothstep(0.003, 0.0, abs(cd.x) - (0.034 + (cd.y + 0.04) * 0.35)) * step(-0.04, cd.y) * step(cd.y, 0.0) + smoothstep(0.003, 0.0, length(vec2(cd.x * 0.85, (cd.y) * 3.0)) * 0.0 - 0.0) * 0.0;
  cupMask = clamp(cupMask, 0.0, 1.0);
  col = mix(col, vec3(0.30, 0.40, 0.33) * (0.8 + 0.5 * smoothstep(0.03, -0.03, cd.x)), cupMask);
  col += vec3(0.30, 0.45, 0.22) * smoothstep(0.006, 0.0, abs(cd.y + 0.001)) * step(abs(cd.x), 0.035) * 0.35;   // tea surface rim
  // steam: a sinuous column that widens and fades as it rises
  float rise = max(cupC.y - uv.y, 0.0);
  float wob = sin(rise * 14.0 - t * 0.7) * 0.012 * (0.4 + rise * 3.0) + sin(rise * 6.0 - t * 0.4 + 1.0) * 0.02 * rise;
  float sdx = p.x - cupC.x - wob;
  float sw = 0.022 + rise * 0.16;
  float steam = exp(-sdx * sdx / (sw * sw)) * smoothstep(0.0, 0.05, rise) * exp(-rise * 1.7);
  steam *= 0.35 + 0.65 * th_fbm(vec2(sdx * 12.0, rise * 6.0 - t * 0.35));
  steam *= step(uv.y, cupC.y);
  col = mix(col, vec3(0.96, 0.94, 0.86), clamp(steam * 1.4, 0.0, 1.0) * 0.75);
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
