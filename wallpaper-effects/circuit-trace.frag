// label: Circuit trace
// hint: a printed circuit board lying over your own picture: grid-routed copper traces that turn at 45 degrees, gold pads and vias, small chips, resistors and LEDs, a faint silkscreen layer and a deeper ghost layer of traces underneath. Bright pulses run along the traces and the LEDs blink amber. The board shows mostly in the dark parts and edges of the picture; traces near the pointer power up and carry faster pulses. Your picture stays the wallpaper
// category: Machines
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

float cb_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float cb_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float cb_seg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float u = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - (a + ab * u));
}
// filled rectangle (half sizes hs, pixels) with a one pixel soft edge
float cb_box(vec2 r, vec2 hs) { vec2 d = abs(r) - hs; return clamp(0.5 - max(d.x, d.y), 0.0, 1.0); }
float cb_pick(vec4 v, int i) { return i == 0 ? v.x : (i == 1 ? v.y : (i == 2 ? v.z : v.w)); }
vec2 cb_mid(int i) { return i == 0 ? vec2(0.0, 0.5) : (i == 1 ? vec2(1.0, 0.5) : (i == 2 ? vec2(0.5, 0.0) : vec2(0.5, 1.0))); }
vec2 cb_in(int i) { return i == 0 ? vec2(1.0, 0.0) : (i == 1 ? vec2(-1.0, 0.0) : (i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0))); }

// what sits in a grid cell: 0 trace cell, 1 chip, 2 resistor (across), 3 resistor (up), 4 LED, 5 square chip
float cb_kind(vec2 c, float sd) {
  float r = cb_h(c + sd + 0.37);
  if (r < 0.05) return 1.0;
  if (r < 0.085) return 2.0;
  if (r < 0.115) return 3.0;
  if (r < 0.135) return 4.0;
  if (r < 0.165) return 5.0;
  return 0.0;
}
float cb_allow(float k, float horiz) {
  if (k < 0.5) return 1.0;
  if (k > 4.5) return 1.0;
  if (k > 2.5 && k < 3.5) return horiz < 0.5 ? 1.0 : 0.0;
  return horiz > 0.5 ? 1.0 : 0.0;
}
// the connection across one cell edge: 0 none, 1 a single trace, 3 a three-lane bus. horiz = 1: the edge to the right of c, 0: the edge below c
float cb_edge(vec2 c, float kA, float kB, float horiz, float sd) {
  if (cb_allow(kA, horiz) < 0.5 || cb_allow(kB, horiz) < 0.5) return 0.0;
  float comp = (kA > 0.5 || kB > 0.5) ? 0.88 : 0.47;
  if (cb_h(c * 1.31 + horiz * 17.3 + sd * 0.7 + 5.1) > comp) return 0.0;
  bool two = (kA > 1.5 && kA < 4.5) || (kB > 1.5 && kB < 4.5);
  return (cb_h(c * 0.77 + horiz * 9.1 + sd + 2.9) < 0.32 && !two) ? 3.0 : 1.0;
}
float cb_ext(float k) { return k < 0.5 ? 0.0 : (k > 4.5 ? 0.21 : 0.27); }

// current pulses riding a run of trace: a = position along the run in cells, id = which row or column
float cb_pulse(float a, float id, float dirH, float t, float wake, float sd) {
  float sgn = cb_h(vec2(id * 3.1 + dirH * 7.7, sd + 11.0)) < 0.5 ? -1.0 : 1.0;
  float ph = t * 0.34 - sgn * a / 3.0 + cb_h(vec2(id, dirH + sd + 2.0));
  float k = floor(ph);
  float u = ph - k;
  float on = step(cb_h(vec2(id * 1.7 + k * 0.73, dirH * 5.0 + sd)), 0.34 + 0.40 * wake);
  float f = on * exp(-u * 12.0) * smoothstep(1.0, 0.97, u);
  float ph2 = t * 1.05 - sgn * a / 2.0 + cb_h(vec2(id + 4.0, dirH + sd + 9.0));
  float k2 = floor(ph2);
  float u2 = ph2 - k2;
  float on2 = step(cb_h(vec2(id * 2.3 + k2 * 0.91, dirH * 3.0 + sd + 6.0)), 0.95 * wake);
  f = max(f, on2 * exp(-u2 * 9.0) * smoothstep(1.0, 0.97, u2));
  return f;
}

// one board layer. cu copper trace, au gold (pads, pins, vias), dk dark bodies, ho drilled holes, sk silkscreen, em light (pulses, LEDs, markings)
void cb_board(vec2 p, float C, float sd, float sc, float t, vec2 mp, float full,
              out float cu, out float au, out float dk, out float ho, out float sk, out vec3 em) {
  cu = 0.0; au = 0.0; dk = 0.0; ho = 0.0; sk = 0.0; em = vec3(0.0);
  vec2 g = p / C;
  vec2 c = floor(g);
  vec2 q = g - c;
  vec2 r = (q - 0.5) * C;
  float hw = 0.85 * sc;
  float P = 0.075 * C;
  float kd = cb_kind(c, sd);
  float kL = cb_kind(c - vec2(1.0, 0.0), sd); float kR = cb_kind(c + vec2(1.0, 0.0), sd);
  float kU = cb_kind(c - vec2(0.0, 1.0), sd); float kD = cb_kind(c + vec2(0.0, 1.0), sd);
  vec4 nv = vec4(cb_edge(c - vec2(1.0, 0.0), kL, kd, 1.0, sd), cb_edge(c, kd, kR, 1.0, sd), cb_edge(c - vec2(0.0, 1.0), kU, kd, 0.0, sd), cb_edge(c, kd, kD, 0.0, sd));
  float deg = step(0.5, nv.x) + step(0.5, nv.y) + step(0.5, nv.z) + step(0.5, nv.w);
  float wake = full > 0.5 ? smoothstep(300.0 * sc, 30.0 * sc, length(p - mp)) : 0.0;

  float dm = 1e4; float nn = 1.0; float axH = 1.0;
  vec2 viaAt = vec2(0.5); float viaR = 0.0;
  if (kd < 0.5 && deg > 1.5 && deg < 2.5) {
    // two edges meet: a run that turns at 45 degrees where the two edges are not opposite
    int i1 = -1; int i2 = -1; float n1 = 0.0; float n2 = 0.0;
    for (int i = 0; i < 4; i++) {
      float n = cb_pick(nv, i);
      if (n > 0.5) { if (i1 < 0) { i1 = i; n1 = n; } else { i2 = i; n2 = n; } }
    }
    vec2 M1 = cb_mid(i1); vec2 M2 = cb_mid(i2);
    vec2 Q1 = M1 + cb_in(i1) * 0.25; vec2 Q2 = M2 + cb_in(i2) * 0.25;
    float d0 = cb_seg(q, M1, Q1); float d1 = cb_seg(q, Q1, Q2); float d2 = cb_seg(q, Q2, M2);
    dm = min(min(d0, d1), d2) * C;
    nn = length(q - M1) < length(q - M2) ? n1 : n2;
    if (d0 <= d1 && d0 <= d2) axH = i1 < 2 ? 1.0 : 0.0;
    else if (d2 <= d1) axH = i2 < 2 ? 1.0 : 0.0;
    else axH = i1 < 2 ? 1.0 : 0.0;
    if (full > 0.5 && cb_h(c + sd + 31.7) < 0.24) { viaAt = (Q1 + Q2) * 0.5; viaR = 0.058 * C; }
  } else if (deg > 0.5) {
    // stubs from each used edge towards the middle (or to the pins of a part)
    float e = cb_ext(kd);
    for (int i = 0; i < 4; i++) {
      float n = cb_pick(nv, i);
      if (n > 0.5) {
        vec2 M = cb_mid(i);
        float di = cb_seg(q, M, M + cb_in(i) * (0.5 - e));
        if (di * C < dm) { dm = di * C; nn = n; axH = i < 2 ? 1.0 : 0.0; }
      }
    }
    if (kd < 0.5) { viaR = (deg > 2.5 ? 0.075 : 0.062) * C; }
  }
  if (dm < 1e3) {
    float cv = cb_aa(dm, hw);
    if (nn > 2.0) cv = max(cv, cb_aa(abs(dm - P), hw));
    cu = cv;
    if (full > 0.5 && dm < 5.0 * sc * 3.0) {
      float f = cb_pulse(axH > 0.5 ? g.x : g.y, axH > 0.5 ? c.y : c.x, axH, t, wake, sd);
      float halo = exp(-dm * dm / (3.4 * sc * 3.4 * sc));
      float body = cv + 0.45 * halo;
      em += (vec3(1.0, 0.70, 0.32) * f * 0.85 + vec3(0.85, 0.95, 1.0) * f * f * 0.9) * body;
    }
  }
  if (viaR > 0.0) {
    float rv = length(r - (viaAt - 0.5) * C);
    float ring = cb_aa(abs(rv - viaR * 0.72), viaR * 0.30);
    au = max(au, ring);
    ho = max(ho, cb_aa(rv, viaR * 0.38));
  }

  if (kd > 0.5 && full > -0.5) {
    vec2 rr = (kd > 2.5 && kd < 3.5) ? r.yx : r;
    if (kd < 1.5) {
      // small chip with five pins down each long side
      vec2 bs = vec2(0.20 * C, 2.6 * P);
      dk = cb_box(rr, bs);
      float row = clamp(floor(rr.y / P + 0.5), -2.0, 2.0);
      au = cb_box(vec2(abs(rr.x) - 0.23 * C, rr.y - row * P), vec2(0.04 * C, 0.28 * P));
      if (full > 0.5) {
        vec2 so = abs(rr) - vec2(0.31 * C, 3.7 * P);
        sk = cb_aa(abs(max(so.x, so.y)), 0.55 * sc);
        sk = max(sk, cb_aa(length(rr - vec2(-0.30 * C, -3.7 * P + 0.0)), 1.6 * sc));
        float hl = smoothstep(-bs.y + 4.0 * sc, -bs.y, rr.y);
        float mk = 0.0;
        for (int k = 0; k < 3; k++) {
          float yk = (float(k) - 1.0) * 1.1 * P;
          float lk = (0.11 + 0.05 * cb_h(c + float(k) + sd)) * C;
          mk = max(mk, cb_aa(abs(rr.y - yk), 0.5 * sc) * step(abs(rr.x + 0.03 * C), lk));
        }
        float dot1 = cb_aa(length(rr - vec2(-0.145 * C, -bs.y + 0.075 * C)), 1.5 * sc);
        em += vec3(0.62, 0.68, 0.72) * (dk * hl * 0.20 + dk * mk * 0.34 + dk * dot1 * 0.5);
      }
    } else if (kd < 4.5) {
      // resistor / LED across two pads
      au = cb_box(vec2(abs(rr.x) - 0.205 * C, rr.y), vec2(0.065 * C, 0.085 * C));
      dk = cb_box(rr, vec2(0.14 * C, 0.055 * C));
      if (full > 0.5) {
        vec2 so = abs(rr) - vec2(0.31 * C, 0.125 * C);
        sk = cb_aa(abs(max(so.x, so.y)), 0.55 * sc);
        if (kd < 3.5) {
          float hl = smoothstep(-0.055 * C + 2.5 * sc, -0.055 * C, rr.y);
          em += vec3(0.62, 0.68, 0.72) * dk * hl * 0.20;
        } else {
          float per = 1.5 + 2.6 * cb_h(c + sd + 4.4);
          float on = step(fract(t / per + cb_h(c + sd + 6.1)), 0.42);
          float hv = on * (1.0 + 0.6 * wake) + 0.10;
          float rl = length(rr);
          float lamp = dk * (0.25 + 0.75 * hv);
          float core = exp(-dot(rr, rr) / (0.15 * C * 0.15 * C));
          float far = exp(-dot(rr, rr) / (0.28 * C * 0.28 * C));
          dk = dk * (1.0 - 0.6 * on);
          em += vec3(1.0, 0.62, 0.12) * (lamp + on * (0.55 * core + 0.20 * far) * (1.0 + 0.5 * wake));
        }
      }
    } else {
      // square chip with a few pins on every side
      dk = cb_box(rr, vec2(0.15 * C));
      vec2 a = abs(rr);
      float rowy = clamp(floor(rr.y / P + 0.5), -1.0, 1.0);
      float rowx = clamp(floor(rr.x / P + 0.5), -1.0, 1.0);
      au = max(cb_box(vec2(a.x - 0.18 * C, rr.y - rowy * P), vec2(0.03 * C, 0.28 * P)),
               cb_box(vec2(rr.x - rowx * P, a.y - 0.18 * C), vec2(0.28 * P, 0.03 * C)));
      if (full > 0.5) {
        vec2 so = a - vec2(0.27 * C);
        sk = cb_aa(abs(max(so.x, so.y)), 0.55 * sc);
        float hl = smoothstep(-0.15 * C + 4.0 * sc, -0.15 * C, rr.y);
        float dot1 = cb_aa(length(rr - vec2(-0.095 * C, -0.095 * C)), 1.5 * sc);
        float mk = cb_aa(abs(rr.y - 0.02 * C), 0.5 * sc) * step(abs(rr.x), 0.08 * C);
        em += vec3(0.62, 0.68, 0.72) * (dk * hl * 0.20 + dk * mk * 0.30 + dk * dot1 * 0.5);
      }
    }
  } else if (kd < 0.5 && deg < 0.5 && full > 0.5) {
    float h = cb_h(c * 1.9 + sd + 12.3);
    if (h < 0.10) {
      // silkscreen target mark
      float rv = length(r);
      float cr = min(cb_aa(abs(r.x), 0.5 * sc) * step(abs(r.y), 0.14 * C), cb_aa(abs(r.y), 0.5 * sc) * step(abs(r.x), 0.14 * C)) ;
      cr = max(cb_aa(abs(r.x), 0.5 * sc) * step(abs(r.y), 0.14 * C), cb_aa(abs(r.y), 0.5 * sc) * step(abs(r.x), 0.14 * C));
      sk = max(cb_aa(abs(rv - 0.10 * C), 0.55 * sc), cr);
    } else if (h < 0.18) {
      // a mounting hole with a gold ring
      float rv = length(r);
      au = cb_aa(abs(rv - 0.085 * C), 0.03 * C);
      ho = cb_aa(rv, 0.055 * C);
    }
  }
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  vec2 pp = uv * res;
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float C = 80.0 * sc;
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? mpx : vec2(-10000.0);
  float t = time;
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  // how dark and how edgy the picture is around here: the board shows through the dark parts and along edges
  vec2 st = vec2(12.0 * sc) / res;
  vec2 se = vec2(3.0 * sc) / res;
  vec3 lw = vec3(0.299, 0.587, 0.114);
  float lA = lum0 + dot(wall(uv + st), lw) + dot(wall(uv - st), lw) + dot(wall(uv + vec2(st.x, -st.y)), lw) + dot(wall(uv - vec2(st.x, -st.y)), lw);
  lA *= 0.2;
  float ex = abs(dot(wall(uv + se) - col, lw));
  float ey = abs(dot(wall(uv + vec2(se.x, -se.y)) - col, lw));
  float edge = smoothstep(0.03, 0.18, ex + ey);
  float dark = 1.0 - smoothstep(0.16, 0.60, lA);
  float vig = smoothstep(0.30, 0.95, length((uv - 0.5) * vec2(res.x / res.y, 1.0)));
  float wk = has ? smoothstep(300.0 * sc, 40.0 * sc, length(pp - mp)) : 0.0;
  float vis = clamp(max(0.26 + 0.74 * dark, 0.30 * vig + 0.30 * edge) + 0.5 * wk, 0.0, 1.0);
  float lift = 1.0 - 0.45 * smoothstep(0.50, 0.90, lA);

  vec3 copper = vec3(0.74, 0.42, 0.19);
  vec3 gold = vec3(1.00, 0.82, 0.42);
  vec3 body = vec3(0.020, 0.026, 0.024);
  vec3 silk = vec3(0.78, 0.90, 0.82);

  // the picture sits inside the casing: a faint solder-mask green in the shadows and the corners
  float tintA = (0.24 + 0.34 * vig) * (0.45 + 0.55 * dark);
  col = mix(col, col * vec3(0.74, 0.92, 0.80) + vec3(0.000, 0.014, 0.005), tintA);
  col *= 1.0 - 0.30 * vig * vig;

  // the deeper layer: faint larger traces beneath
  float gcu, gau, gdk, gho, gsk; vec3 gem;
  cb_board(pp + vec2(137.0, 59.0), C * 2.7, 53.0, sc, t, mp, -1.0, gcu, gau, gdk, gho, gsk, gem);
  float ghost = max(gcu * 0.8, gau);
  col = mix(col, vec3(0.12, 0.38, 0.26) * lift + col * 0.3, ghost * 0.45 * (0.40 + 0.60 * vis));

  // the top layer, with a hairline of light on the upper-left edges and a shadow on the lower-right ones
  float cu, au, dk, ho, sk; vec3 em;
  cb_board(pp, C, 0.0, sc, t, mp, 1.0, cu, au, dk, ho, sk, em);
  float cu2, au2, dk2, ho2, sk2; vec3 em2;
  vec2 off = vec2(1.4, 1.4) * sc;
  cb_board(pp - off, C, 0.0, sc, t, mp, 0.0, cu2, au2, dk2, ho2, sk2, em2);
  float solid = max(max(cu, au), dk);
  float solid2 = max(max(cu2, au2), dk2);
  float shadow = solid2 * (1.0 - solid);
  float rim = solid * (1.0 - solid2);
  float vs = vis * lift;
  col *= 1.0 - shadow * 0.55 * vis;
  col = mix(col, body, dk * 0.88 * max(vis, 0.55));
  vec3 cuCol = mix(copper, vec3(1.0, 0.72, 0.36), 0.7 * wk) * (1.0 + 0.5 * rim);
  col = mix(col, cuCol, cu * 0.88 * vs);
  col = mix(col, gold * (1.0 + 0.4 * rim), au * 0.92 * max(vs, 0.45 * vis));
  col = mix(col, vec3(0.01, 0.015, 0.012), ho * 0.9 * max(vis, 0.4));
  col = mix(col, silk, sk * 0.50 * vis * lift);
  col += em * (0.35 + 0.65 * max(vis, 0.5)) ;

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
