// label: Star chart
// hint: a quiet star chart laid over your own picture: small stars at fixed places that twinkle, a few of them joined by faint constellation lines, soft dotted chart arcs with degree ticks, a thin drifting haze band and now and then a shooting star. Stars near the pointer wake up and brighten. Cool blues and silver, your picture stays the wallpaper
// category: Deep space
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

// the star field: one jittered cell grid, shared with the star-weave cursor effect
float sw_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
bool sw_has(vec2 c) { return sw_h(c + 41.7) < 0.80; }
vec2 sw_pos(vec2 c, float C) { return (c + 0.14 + 0.72 * vec2(sw_h(c), sw_h(c + 17.3))) * C; }
vec2 sw_off(int o) { return o == 0 ? vec2(1.0, 0.0) : (o == 1 ? vec2(0.0, 1.0) : (o == 2 ? vec2(1.0, 1.0) : vec2(1.0, -1.0))); }
bool sw_link(vec2 c, int o) {
  vec2 off = sw_off(o);
  return sw_h(c * 1.7 + off * 3.1 + 9.2) < (o < 2 ? 0.58 : 0.40) && sw_has(c + off);
}
float sw_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float sc_noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sw_h(i), sw_h(i + vec2(1.0, 0.0)), f.x), mix(sw_h(i + vec2(0.0, 1.0)), sw_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
// how awake a star is: 0 far from the pointer, 1 beside it
float sc_wake(vec2 s, vec2 mp, float R) { return smoothstep(R, R * 0.25, length(s - mp)); }

// add an overlay colour; on bright pictures it is darkened so it still reads
vec3 sc_ov(vec3 col, vec3 c, float a, float lum) {
  vec3 ec = c * (1.0 - 0.72 * smoothstep(0.45, 0.85, lum));
  return mix(col, ec, clamp(a, 0.0, 1.0));
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  vec2 pp = uv * res;
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float C = 92.0 * sc;
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? mpx : vec2(-10000.0);
  float t = time;
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  vec3 ice = vec3(0.70, 0.84, 1.00);
  vec3 white = vec3(0.92, 0.96, 1.00);
  vec3 gold = vec3(1.00, 0.86, 0.55);
  vec3 haze = vec3(0.45, 0.50, 0.98);

  // cool indigo wash at the corners
  float vig = smoothstep(0.45, 1.15, length((uv - 0.5) * vec2(res.x / res.y, 1.0)));
  col = mix(col, col * vec3(0.80, 0.84, 1.00) + vec3(0.0, 0.004, 0.022), 0.45 * vig);

  // a thin hazy band drifting across, like a faint stretch of the Milky Way
  vec2 q = (uv - 0.5) * vec2(res.x / res.y, 1.0);
  float along = dot(q, vec2(0.80, -0.60));
  float across = dot(q, vec2(0.60, 0.80)) + 0.10 * sin(along * 2.2 + t * 0.03);
  float band = exp(-across * across / 0.030);
  float cloud = sc_noise(vec2(along * 5.0 + t * 0.02, across * 7.0)) * 0.65 + sc_noise(vec2(along * 11.0 - t * 0.015, across * 15.0 + 3.0)) * 0.35;
  col = sc_ov(col, haze, band * cloud * 0.60, lum0);

  // chart arcs: dotted circles around a centre below and to the right, degree ticks on one of them
  vec2 cc = vec2(res.x * 0.82, res.y * 1.30);
  vec2 dc = pp - cc;
  float rc = length(dc);
  float ac = atan(dc.x, -dc.y);
  float arcs = 0.0;
  for (int k = 0; k < 4; k++) {
    float Rk = res.y * (0.62 + 0.26 * float(k));
    float dash = step(fract(ac * Rk / (10.0 * sc)), 0.5);
    arcs = max(arcs, sw_aa(abs(rc - Rk), 0.5) * dash * (0.9 - 0.12 * float(k)));
  }
  float R2 = res.y * 0.88;
  float tk = ac / 6.2832 * 144.0;
  float tkd = abs(fract(tk + 0.5) - 0.5) * 6.2832 * R2 / 144.0;
  float tlen = mod(floor(tk + 0.5), 6.0) < 0.5 ? 11.0 : 5.0;
  arcs = max(arcs, sw_aa(tkd, 0.4) * step(R2 - tlen * sc, rc) * step(rc, R2) * 0.9);
  float merid = sw_aa(abs(dc.x), 0.5) * step(dc.y, 0.0) * step(0.5, fract(dc.y / (12.0 * sc))) ;
  arcs = max(arcs, merid * 0.7);
  col = sc_ov(col, ice, arcs * 0.30, lum0);

  // stars at fixed places: all of them dim and twinkling, a few joined by faint lines, brighter near the pointer
  float Rw = 210.0 * sc;
  vec2 c0 = floor(pp / C);
  float starA = 0.0; float goldA = 0.0; float lineA = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 ca = c0 + vec2(float(i), float(j));
      if (!sw_has(ca)) continue;
      vec2 sa = sw_pos(ca, C);
      float ma = sw_h(ca + 5.9);
      float wa = has ? sc_wake(sa, mp, Rw) : 0.0;
      vec2 d = pp - sa;
      float r2 = dot(d, d);
      float tw = 0.70 + 0.30 * sin(t * (0.9 + 1.7 * ma) + ma * 60.0);
      float rad = (1.4 + 1.5 * ma) * sc * (1.0 + 0.5 * wa);
      float core = exp(-r2 / (rad * rad));
      float halo = exp(-r2 / (rad * rad * 18.0)) * 0.22;
      float spike = 0.0;
      if (ma > 0.52) {
        spike = (exp(-abs(d.x) / (0.7 * sc)) * exp(-abs(d.y) / (rad * 6.0))
               + exp(-abs(d.y) / (0.7 * sc)) * exp(-abs(d.x) / (rad * 6.0))) * 0.50;
      }
      float s = (core + halo + spike * (0.4 + 0.6 * wa)) * tw * (0.62 + 0.38 * wa) * (0.55 + 0.45 * ma);
      if (sw_h(ca + 77.7) < 0.18) goldA += s; else starA += s;
      // the quiet constellations: only some of the links the cursor effect also knows
      for (int o = 0; o < 4; o++) {
        if (!sw_link(ca, o)) continue;
        if (sw_h(ca * 2.3 + sw_off(o) * 5.7 + 1.3) > 0.30) continue;
        vec2 sb = sw_pos(ca + sw_off(o), C);
        vec2 ab = sb - sa;
        float u = clamp(dot(pp - sa, ab) / dot(ab, ab), 0.0, 1.0);
        float dl = length(pp - (sa + ab * u));
        float wb = has ? sc_wake(sb, mp, Rw) : 0.0;
        lineA += sw_aa(dl, 0.45 * sc) * (0.30 + 0.45 * min(wa, wb)) * (0.75 + 0.25 * tw);
      }
    }
  }
  col = sc_ov(col, ice, lineA * 0.50, lum0);
  col = sc_ov(col, white, starA * 0.95, lum0);
  col = sc_ov(col, gold, goldA * 0.95, lum0);

  // a shooting star every eleven seconds
  float slotN = floor(t / 11.0);
  float lt = (t / 11.0 - slotN) * 11.0;
  if (lt < 1.3) {
    float h1 = sw_h(vec2(slotN, 3.3)); float h2 = sw_h(vec2(slotN, 8.8)); float h3 = sw_h(vec2(slotN, 1.7));
    vec2 start = vec2(res.x * (0.12 + 0.76 * h1), res.y * (0.04 + 0.36 * h2));
    float ang = 0.30 + 0.45 * h3;
    vec2 dir = vec2((h1 > 0.5 ? 1.0 : -1.0) * cos(ang), sin(ang));
    vec2 head = start + dir * (880.0 * sc * lt);
    vec2 dd = pp - head;
    float behind = dot(dd, -dir);
    float perp = abs(dot(dd, vec2(-dir.y, dir.x)));
    float Lt = 240.0 * sc;
    float tail = sw_aa(perp, 0.55 * sc) * step(0.0, behind) * step(behind, Lt) * pow(1.0 - behind / Lt, 2.0);
    float hg = exp(-dot(dd, dd) / (6.0 * sc * 6.0 * sc));
    float life = smoothstep(0.0, 0.15, lt) * smoothstep(1.3, 0.95, lt);
    col = sc_ov(col, white, (tail * 0.9 + hg * 0.9) * life, lum0);
  }

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
