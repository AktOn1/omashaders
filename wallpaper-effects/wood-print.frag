// label: Walnut print
// hint: your picture printed onto a walnut board: planks with thin dark seams and butt joints, cathedral grain, a few knots and fine pores show through the ink, light areas turn into bare honey-oak wood, dark areas soak into the rings, the ink bleeds a little along the grain, and a soft varnish sheen drifts across the boards. A warm glint on the varnish follows the pointer
// category: Workshop
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

float wp_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float wp_n(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wp_h(i), wp_h(i + vec2(1.0, 0.0)), f.x), mix(wp_h(i + vec2(0.0, 1.0)), wp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wp_lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// the board under the print. q is in 1080p-pixels; returns the light level of the bare wood in .x,
// the late-wood darkness in .y and the pore amount in .z
vec3 wp_grain(vec2 q, float id, float seg, float lyPx) {
  float off = 137.0 * wp_h(vec2(id, seg + 3.0));
  vec2 g0 = vec2(q.x + off * 40.0, lyPx);
  // cathedral rings: the ring coordinate is bent by a slow noise that is stretched along the board
  float warp = wp_n(vec2(g0.x * 0.0021, lyPx * 0.0050 + id * 5.1 + seg * 2.3)) * 0.70
             + wp_n(vec2(g0.x * 0.0052, lyPx * 0.0110 + id * 1.7)) * 0.30;
  float gc = lyPx * 0.0330 + 0.95 * wp_n(vec2(lyPx * 0.021 + id * 7.0, g0.x * 0.0007 + seg)) + warp * 2.3 + wp_h(vec2(id, seg)) * 5.0;
  // a knot per board segment now and then: rings crowd around it and a dark eye sits in the middle
  float kh = wp_h(vec2(id * 3.1 + 0.7, seg * 1.3 + 5.2));
  float eye = 0.0; float ring = 0.0; float kdist = 1e4; float Rk = 20.0;
  if (kh > 0.38) {
    float kx = (0.22 + 0.56 * wp_h(vec2(seg, id + 9.1))) * 1100.0 ;
    float ky = (0.30 + 0.40 * wp_h(vec2(id + 4.4, seg))) * 330.0;
    Rk = 17.0 + 15.0 * wp_h(vec2(seg + 2.2, id));
    vec2 kd2 = vec2((q.x - kx) / 1.7, lyPx - ky);
    float kd = length(kd2);
    kdist = kd;
    float bump = exp(-kd * kd / (Rk * Rk * 16.0));
    gc += 2.8 * bump * (lyPx - ky) / (abs(lyPx - ky) + Rk * 1.1);
    eye = smoothstep(Rk * 1.05, Rk * 0.25, kd);
    ring = sin(kd * 0.62) * smoothstep(Rk * 1.8, Rk * 0.5, kd);
  }
  float s = fract(gc);
  float late = pow(s, 2.4) * smoothstep(1.0, 0.90, s) * (0.50 + 0.95 * wp_h(vec2(floor(gc) + id * 13.0, seg)));
  float fib = wp_n(vec2(g0.x * 0.0060, lyPx * 0.60)) * 0.55 + wp_n(vec2(g0.x * 0.0230, lyPx * 2.10)) * 0.45;
  float por = smoothstep(0.80, 0.97, wp_n(vec2(g0.x * 0.26, lyPx * 1.35)));
  float w = 0.68 - 0.17 * late + 0.18 * (fib - 0.5) - 0.12 * por * (0.4 + late) + 0.07 * ring - 0.34 * eye - 0.10 * smoothstep(Rk * 2.6, Rk * 1.0, kdist) * (1.0 - eye);
  return vec3(w, clamp(late + 0.7 * eye, 0.0, 1.0), por);
}

vec3 wp_wood(float w) {
  vec3 dk = vec3(0.17, 0.095, 0.050);
  vec3 wal = vec3(0.36, 0.205, 0.105);
  vec3 hon = vec3(0.80, 0.575, 0.325);
  vec3 cre = vec3(0.94, 0.83, 0.62);
  float x = clamp(w, 0.0, 1.0);
  vec3 c = mix(dk, wal, smoothstep(0.0, 0.34, x));
  c = mix(c, hon, smoothstep(0.30, 0.66, x));
  c = mix(c, cre, smoothstep(0.66, 0.95, x) * 0.55);
  return c;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  vec2 pp = uv * res;
  vec2 q = pp / sc;
  bool has = mpx.x > -5000.0;
  float t = time;

  // planks run along x, about 330 px tall, with butt joints every ~1100 px
  float P = 330.0;
  float py = q.y / P + 0.31;
  float id = floor(py);
  float ly = fract(py);
  float lyPx = ly * P;
  float Jw = 1100.0;
  float jc0 = floor((q.x + 400.0 * wp_h(vec2(id, 8.8))) / Jw);
  float jx = jc0 * Jw - 400.0 * wp_h(vec2(id, 8.8));
  float seg = jc0;
  float ex = min(q.x - jx, jx + Jw - q.x);
  // draw the knot x relative to the segment start
  vec3 gr = wp_grain(vec2(q.x - jx, q.y), id, seg, lyPx);
  float ptone = 0.94 + 0.12 * wp_h(vec2(id, seg + 11.0));
  float w = gr.x * ptone;
  vec3 woodc = wp_wood(w);

  // the ink: the picture, sampled a few times along the grain so it bleeds a little, more in the late wood
  float bleed = (0.8 + 2.4 * gr.y) * sc / res.x;
  float fibJit = 0.5 + 0.5 * wp_n(vec2(q.x * 0.011, q.y * 0.35));
  vec3 pic = wall(uv) * 0.40;
  pic += wall(uv + vec2(bleed, 0.0)) * 0.20 + wall(uv - vec2(bleed, 0.0)) * 0.20;
  pic += wall(uv + vec2(bleed * 2.2 * fibJit, 0.0)) * 0.10 + wall(uv - vec2(bleed * 2.2 * fibJit, 0.0)) * 0.10;
  float L = wp_lum(pic);
  // the picture keeps its own hue and light; the wood works as multiply detail (grain, rings, pores) and a warm tint
  float dens = 1.0 + 0.30 * (gr.y - 0.35) + 0.20 * gr.z;
  vec3 base = pow(clamp(pic, 0.0, 1.0), vec3(dens));
  float rel = w - 0.58;
  vec3 tone = woodc / max(wp_lum(woodc), 0.05);
  vec3 col = base * (1.0 + 1.7 * rel + 0.25 * (ptone - 1.0));
  col = mix(col, col * tone * 0.95, 0.55);
  // the lightest areas show bare wood
  float bare = smoothstep(0.62, 0.95, L);
  col = mix(col, woodc * (0.78 + 0.5 * L), bare * 0.30);
  col = mix(col, col * vec3(1.05, 0.96, 0.86), 0.5);

  // plank seams and butt joints: a dark gap with a bright lip
  float eY = min(lyPx, P - lyPx) / sc;
  float eX = ex / sc;
  float gapY = 1.0 - smoothstep(0.6, 2.0, eY);
  float gapX = 1.0 - smoothstep(0.5, 1.7, eX);
  float gap = max(gapY, gapX);
  float lip = smoothstep(1.4, 2.4, eY) * (1.0 - smoothstep(2.4, 4.5, eY)) * step(lyPx, P * 0.5) * 0.18
            + smoothstep(1.2, 2.2, eX) * (1.0 - smoothstep(2.2, 4.0, eX)) * 0.08;
  col = col * (1.0 - 0.80 * gap) + vec3(0.95, 0.80, 0.55) * lip * (1.0 - gap);
  // a faint shade just under each seam
  col *= 1.0 - 0.10 * (1.0 - smoothstep(2.0, 14.0, lyPx < P * 0.5 ? lyPx / sc : 99.0));

  // varnish: a broad drifting sheen, brighter along the fibres, plus some soft sparkle in the pores
  vec2 qn = (uv - 0.5) * vec2(res.x / res.y, 1.0);
  float along = dot(qn, vec2(0.86, -0.50));
  float across = dot(qn, vec2(0.50, 0.86)) - 0.32 * sin(t * 0.045) + 0.04 * sin(along * 3.0 + t * 0.03);
  float band = exp(-across * across / 0.020);
  float chat = 0.55 + 0.75 * wp_n(vec2(q.x * 0.0045 + t * 0.002, q.y * 0.55));
  vec3 varn = vec3(1.00, 0.86, 0.58);
  float shine = band * chat * 0.20;

  // the pointer: a warm specular glint, stretched along the grain, riding on the varnish
  if (has) {
    vec2 dm = (pp - mpx) / sc;
    float spotR = 150.0;
    vec2 dg = dm * vec2(0.42, 1.0);
    float lobe = exp(-dot(dg, dg) / (spotR * spotR * 0.55));
    float core = exp(-dot(dm * vec2(0.55, 1.0), dm * vec2(0.55, 1.0)) / (26.0 * 26.0));
    shine += lobe * (0.20 + 0.20 * chat) + core * 0.30 * (0.7 + 0.5 * chat);
  }
  col = 1.0 - (1.0 - col) * (1.0 - clamp(varn * shine, 0.0, 0.9));
  col *= 1.0 + 0.10 * band;

  // a little of the unprinted picture stays: the ink never covers the board completely
  // warm falloff toward the corners, like a lit board
  float vig = smoothstep(0.55, 1.20, length(qn));
  col *= 1.0 - 0.12 * vig;

  return vec4(clamp(col, 0.0, 1.0), 1.0) * qt_Opacity;
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
