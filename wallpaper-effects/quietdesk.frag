// label: Quiet desk
// hint: a calm focus desk: soft window light from the left with a slowly swaying leaf shadow on a pale wall, a tiny plant and a mug with a wisp of steam in the corners and a clear light centre; the pointer nudges the leaf shadow
// category: Quiet and focus
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
float qd_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float qd_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(qd_h(i), qd_h(i + vec2(1, 0)), f.x), mix(qd_h(i + vec2(0, 1)), qd_h(i + vec2(1, 1)), f.x), f.y);
}
float qd_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * qd_n(p); p = p * 2.03 + 3.0; a *= 0.5; }
  return v;
}
float qd_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float QD_DESK = 0.895;

// one leaf shadow: an ellipse along a direction, pointed at both ends; returns coverage 0..1
float qd_leaf(vec2 p, vec2 c, float ang, float len, float wid) {
  vec2 d = p - c;
  float ca = cos(ang), sa = sin(ang);
  vec2 q = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
  float u = q.x / len;                                  // -1..1 along the leaf
  float hw = wid * (1.0 - u * u);
  hw = max(hw, 0.0);
  return smoothstep(hw, hw * 0.55, abs(q.y)) * step(abs(u), 1.0);
}

// the swaying branch with its leaves, in wall units; the whole thing is shifted by `sh` (pointer nudge)
float qd_leaves(vec2 p, vec2 sh, float t) {
  float cov = 0.0;
  // a slender branch coming in from the top left
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float f = (fi + 0.5) / 9.0;                          // position along the branch
    vec2 bp = vec2(-0.05 + f * 0.62, 0.02 + 0.50 * pow(f, 1.3));
    bp += vec2(0.012 * sin(t * 0.30 + fi * 0.8), 0.014 * sin(t * 0.23 + fi * 1.3)) * (0.5 + f);
    float side = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0;
    float ang = 0.74 + 0.80 * side + 0.14 * sin(t * 0.42 + fi * 1.7) + 0.05 * sin(t * 0.9 + fi);
    vec2 c = bp + vec2(cos(ang), sin(ang)) * 0.075 + sh * (0.6 + f);
    float len = 0.072 + 0.020 * sin(fi * 2.3) + 0.010 * f;
    cov = max(cov, qd_leaf(p, c, ang, len, 0.036));
  }
  // the branch itself, a thin soft stroke following the same curve
  float fb = (p.x - sh.x * 0.9 + 0.05) / 0.62;
  float yb = 0.02 + 0.50 * pow(clamp(fb, 0.0, 1.0), 1.3) + 0.014 * sin(t * 0.23 + 1.0) * (0.5 + fb) + sh.y * 0.9;
  float slope = 0.50 * 1.3 * pow(clamp(fb, 0.0, 1.0), 0.3) / 0.62;
  float db = abs(p.y - yb) / sqrt(1.0 + slope * slope);
  cov = max(cov, smoothstep(0.0075, 0.002, db) * step(0.0, fb) * smoothstep(0.98, 0.9, fb) * 0.75);
  return cov;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  float t = time;
  vec3 w = wall(uv);

  // ---- the wall: pale warm plaster, with the softest plaster mottling
  vec3 wallC = vec3(0.925, 0.905, 0.870);
  wallC *= 0.985 + 0.03 * (qd_fbm(p * 2.2) - 0.5) * 2.0;
  wallC *= 0.99 + 0.02 * qd_n(p * 600.0);
  vec3 col = wallC;

  // ---- window light from the left: a warm wash that fades long before the centre
  float lx = uv.x;
  float wash = exp(-lx * lx / 0.060);
  col += vec3(0.055, 0.038, 0.012) * wash;
  // a very soft slanted window pane of light on the wall (no hard edges), upper left
  float pane = smoothstep(0.50, 0.0, uv.x + (uv.y - 0.4) * 0.25) * smoothstep(0.95, 0.35, uv.y);
  col += vec3(0.025, 0.020, 0.008) * pane;

  // ---- the leaf shadow, only strong close to the window and gone toward the centre
  vec2 sh = hasM ? (m - 0.5) * vec2(0.060, 0.045) : vec2(0.0);
  vec2 pw = vec2(p.x, p.y);
  float cov = qd_leaves(pw, sh, t);
  // soften the shadow by blurring through a second, offset sample
  float cov2 = qd_leaves(pw + vec2(0.006, 0.005), sh, t);
  float shadow = 0.6 * cov + 0.4 * cov2;
  float reach = smoothstep(0.62, 0.05, uv.x) * smoothstep(1.0, 0.45, uv.y);
  // the light flickers through the leaves very slowly
  float dapple = 0.92 + 0.08 * sin(t * 0.37 + p.y * 3.0);
  col *= 1.0 - 0.085 * shadow * reach * dapple;
  col -= vec3(0.0, 0.006, 0.014) * shadow * reach * 0.5;         // shadows lean a touch cool

  // ---- the desk: a pale wooden edge along the bottom with a soft line where it meets the wall
  float onDesk = smoothstep(QD_DESK - 0.001, QD_DESK + 0.002, uv.y);
  float grainDesk = qd_n(vec2(p.x * 3.0, p.y * 140.0)) * 0.5 + qd_n(vec2(p.x * 9.0, p.y * 420.0)) * 0.5;
  vec3 deskC = vec3(0.835, 0.775, 0.690) * (0.97 + 0.05 * grainDesk);
  deskC += vec3(0.04, 0.03, 0.012) * exp(-uv.x * uv.x / 0.07);
  col = mix(col, deskC, onDesk);
  col -= vec3(0.06, 0.055, 0.050) * smoothstep(0.0, 0.012, abs(uv.y - QD_DESK) + 0.0) * 0.0;
  col -= vec3(0.045, 0.045, 0.045) * smoothstep(0.014, 0.0, abs(uv.y - QD_DESK - 0.003)) * 0.5;

  // ---- a mug in the bottom left corner: body, handle, a dark soft coffee surface hint; a soft shadow to the right
  vec2 mc = vec2(0.115 * asp, QD_DESK);
  vec2 mq = p - mc;
  float mugW = 0.036, mugH = 0.060;
  float body = smoothstep(mugW, mugW - 0.002, abs(mq.x)) * smoothstep(0.0, -0.002, mq.y - 0.0) * smoothstep(-mugH - 0.002, -mugH, mq.y);
  vec2 hq = (mq - vec2(mugW + 0.004, -0.028)) / vec2(0.016, 0.017);
  float handle = smoothstep(1.0, 0.82, length(hq)) * smoothstep(0.45, 0.62, length(hq));
  float mug = max(body, handle * step(mugW * 0.6, mq.x));
  vec3 mugC = vec3(0.66, 0.70, 0.74) * (0.86 + 0.20 * clamp(0.5 - mq.x / (2.0 * mugW), 0.0, 1.0));
  float mshadow = exp(-pow((mq.x - 0.040) / 0.050, 2.0)) * exp(-pow((mq.y + 0.001) / 0.010, 2.0)) * step(-0.01, mq.y);
  col *= 1.0 - 0.10 * mshadow;
  col = mix(col, mugC, mug * 0.85);
  // steam: a thin slow S-curve wisp rising from the mug, widening and fading
  {
    float hgt = (-mq.y - mugH) / 0.20;                    // 0 at the rim, 1 high above
    if (hgt > -0.05 && hgt < 1.15) {
      float xo = 0.012 * sin(hgt * 7.0 - t * 0.9) * (0.4 + hgt) + 0.007 * sin(hgt * 13.0 - t * 1.4 + 1.0) * hgt;
      float wd = 0.007 + 0.022 * hgt;
      float dx = mq.x - xo;
      float strand = exp(-dx * dx / (2.0 * wd * wd));
      float fn = 0.55 + 0.45 * qd_n(vec2(mq.x * 40.0, hgt * 6.0 - t * 0.45));
      float fade = smoothstep(-0.05, 0.12, hgt) * smoothstep(1.1, 0.35, hgt);
      float st = strand * fn * fade;
      col *= 1.0 - 0.075 * st;                                  // a cool soft shade so it reads on the pale wall
      col += vec3(-0.004, 0.0, 0.010) * st;
    }
  }

  // ---- a tiny plant in the bottom right corner: a pot and a few soft leaves
  vec2 pc = vec2(0.925 * asp, QD_DESK);
  vec2 pq = p - pc;
  float potW = 0.022 * (1.0 + 0.45 * clamp(-pq.y / 0.034, 0.0, 1.0));
  float pot = smoothstep(potW, potW - 0.002, abs(pq.x)) * step(pq.y, 0.0) * step(-0.034, pq.y);
  vec3 potC = vec3(0.70, 0.55, 0.44) * (0.88 + 0.14 * clamp(0.5 - pq.x / (2.0 * potW), 0.0, 1.0));
  float pshadow = exp(-pow((pq.x + 0.035) / 0.050, 2.0)) * exp(-pow((pq.y + 0.001) / 0.010, 2.0)) * step(-0.01, pq.y);
  col *= 1.0 - 0.10 * pshadow;
  col = mix(col, potC, pot * 0.9);
  float leafA = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float ang = -1.57 + (fi - 2.0) * 0.50 + 0.05 * sin(t * 0.35 + fi * 1.9);
    float lenL = 0.042 + 0.010 * sin(fi * 2.1 + 1.0);
    vec2 c = pc + vec2(0.0, -0.034) + vec2(cos(ang), sin(ang)) * lenL * 0.95;
    leafA = max(leafA, qd_leaf(p, c, ang, lenL, 0.013));
  }
  col = mix(col, vec3(0.34, 0.40, 0.31), leafA * 0.78);

  // ---- the user's picture is only a whisper; the centre stays clear
  col *= 0.985 + 0.03 * qd_luma(w);
  col *= 1.0 - 0.06 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
  col = min(col, vec3(0.975, 0.965, 0.945));
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
