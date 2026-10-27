// label: Radar grid
// hint: a quiet field-console overlay on your own picture: a faint map grid with coordinate ticks along the edges, small corner brackets, a slow radar dial in the lower right with a fading sweep and a few tiny blips, and dotted range rings around the pointer that wake the grid near them. Olive, tan, phosphor green and amber, your picture stays the wallpaper
// category: Sci-fi and tech
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

float rg_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float rg_glow(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }
// anti-aliased coverage of a line whose centre is d pixels away and whose half width is w pixels
float rg_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }

// the few tiny blips on the dial: angle (turns), radius (fraction of the dial), phase
vec3 rg_blip(int i) {
  if (i == 0) return vec3(0.07, 0.62, 0.3);
  if (i == 1) return vec3(0.21, 0.34, 1.7);
  if (i == 2) return vec3(0.46, 0.78, 2.9);
  if (i == 3) return vec3(0.63, 0.50, 4.1);
  if (i == 4) return vec3(0.82, 0.70, 5.3);
  return vec3(0.93, 0.28, 0.9);
}

// add an overlay colour; on bright pictures it is darkened so it still reads
vec3 rg_ov(vec3 col, vec3 c, float a, float lum) {
  vec3 ec = c * (1.0 - 0.68 * smoothstep(0.45, 0.85, lum));
  return mix(col, ec, clamp(a, 0.0, 1.0));
}

vec4 fxMain(vec2 mpx) {
  float asp = res.x / res.y;
  vec2 uv = qt_TexCoord0;
  vec2 p = vec2(uv.x * asp, uv.y);
  float px = 1.0 / (res.y * max(zoom, 0.05));      // one screen pixel in p units
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? vec2(mpx.x / res.y, mpx.y / res.y) : vec2(-10.0);
  float t = time;
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  vec3 green = vec3(0.45, 0.92, 0.40);
  vec3 amber = vec3(1.00, 0.68, 0.22);
  vec3 head = vec3(0.72, 1.0, 0.55);
  vec3 tan = vec3(0.78, 0.70, 0.50);
  vec3 olive = vec3(0.16, 0.20, 0.07);

  // drab olive wash at the corners; the middle of the picture is left alone
  float vig = smoothstep(0.45, 1.15, length((uv - 0.5) * vec2(asp, 1.0)));
  col = mix(col, col * vec3(0.86, 0.92, 0.78) + vec3(0.004, 0.010, 0.0), 0.45 * vig);

  // ---- map grid: faint minor lines, stronger every fifth, small crosses where the major ones meet ----
  float cell = 0.08;
  vec2 gp = p / cell;
  vec2 gd = abs(fract(gp + 0.5) - 0.5) * cell / px;      // pixel distance to the nearest line
  vec2 gi = floor(gp + 0.5);
  float majX = mod(gi.x, 5.0) < 0.5 ? 1.0 : 0.0;
  float majY = mod(gi.y, 5.0) < 0.5 ? 1.0 : 0.0;
  float lineX = rg_aa(gd.x, 0.25) * (0.18 + 0.22 * majX);
  float lineY = rg_aa(gd.y, 0.25) * (0.18 + 0.22 * majY);
  float near = has ? rg_glow(p, mp, 0.26) : 0.0;          // the grid wakes near the pointer
  float gridA = max(lineX, lineY) * (1.0 + 1.8 * near);
  float cross = majX * majY * step(max(gd.x, gd.y), 8.0) * step(min(gd.x, gd.y), 0.5);
  gridA = max(gridA, cross * 0.60);
  col = rg_ov(col, green, gridA, lum0);

  // ---- edge rulers: ticks along all four edges, longer every fifth and twenty-fifth ----
  vec2 ed = vec2(min(uv.x, 1.0 - uv.x) * res.x, min(uv.y, 1.0 - uv.y) * res.y) / max(zoom, 0.05);
  float fine = 0.016;
  float fx = floor(p.x / fine + 0.5), fy = floor(p.y / fine + 0.5);
  float dxp = abs(p.x - fx * fine) / px, dyp = abs(p.y - fy * fine) / px;
  float lenX = (mod(fx, 5.0) < 0.5 ? (mod(fx, 25.0) < 0.5 ? 22.0 : 13.0) : 6.0);
  float lenY = (mod(fy, 5.0) < 0.5 ? (mod(fy, 25.0) < 0.5 ? 22.0 : 13.0) : 6.0);
  float tickH = rg_aa(dxp, 0.4) * step(ed.y, lenX) * step(1.0, ed.y) * (uv.y > 0.5 ? 1.0 : 0.6);
  float tickV = rg_aa(dyp, 0.4) * step(ed.x, lenY) * step(1.0, ed.x) * (uv.x < 0.5 ? 1.0 : 0.6);
  col = rg_ov(col, tan, max(tickH, tickV) * 0.75, lum0);

  // the pointer's coordinates ride along the bottom and left edges as two small amber marks
  if (has) {
    float mx = rg_aa(abs(p.x - mp.x) / px, 0.8) * step(ed.y, 20.0) * step(1.0, ed.y) * step(0.5, uv.y);
    float my = rg_aa(abs(p.y - mp.y) / px, 0.8) * step(ed.x, 20.0) * step(1.0, ed.x) * step(uv.x, 0.5);
    col = rg_ov(col, amber, max(mx, my) * 0.95, lum0);
  }

  // ---- corner brackets: small tan L shapes, 2 px thick ----
  vec2 sp = vec2(uv.x * asp, uv.y) / px;
  vec2 sz = vec2(asp, 1.0) / px;
  vec2 q = min(sp, sz - sp);
  float inset = 30.0, blen = 64.0;
  float bx = rg_aa(abs(q.x - inset), 1.4) * step(inset - 1.0, q.y) * step(q.y, inset + blen);
  float by = rg_aa(abs(q.y - inset), 1.4) * step(inset - 1.0, q.x) * step(q.x, inset + blen);
  col = rg_ov(col, tan, max(bx, by) * 0.90, lum0);

  // ---- radar dial in the lower right ----
  vec2 rc = vec2(asp - 0.31, 0.655);
  float R = 0.25;
  vec2 d = p - rc;
  float r = length(d);
  float ang = atan(d.x, -d.y);
  ang += ang < 0.0 ? 6.2832 : 0.0;
  float sweepA = mod(t * 0.50, 6.2832);
  float age = mod(sweepA - ang, 6.2832);                 // how long ago the sweep passed this angle
  float inD = smoothstep(R + 1.5 * px, R - 1.5 * px, r);
  // a slightly dark olive face so the dial reads on any picture
  col = mix(col, col * 0.74 + olive * 0.16, inD * 0.70);
  // rings: two dotted, one solid, plus the faint cross
  float ringA = 0.0;
  for (int k = 1; k < 4; k++) {
    float rk = R * float(k) / 3.0;
    float dr = abs(r - rk) / px;
    float dt = k == 3 ? 1.0 : step(fract(ang * rk / (11.0 * px) + 0.5 * float(k)), 0.55);
    ringA = max(ringA, rg_aa(dr, 0.4) * dt * (k == 3 ? 0.85 : 0.60));
  }
  float axes = max(rg_aa(abs(d.x) / px, 0.2), rg_aa(abs(d.y) / px, 0.2)) * step(r, R) * 0.34;
  // degree ticks just inside the outer ring: every 15 degrees, longer every 90
  float tk = ang / 6.2832 * 24.0;
  float tkd = abs(fract(tk + 0.5) - 0.5) * 6.2832 * R / 24.0 / px;
  float tlen = mod(floor(tk + 0.5), 6.0) < 0.5 ? 14.0 : 7.0;
  float tickR = rg_aa(tkd, 0.3) * step(R - tlen * px, r) * step(r, R) * 0.85;
  col = rg_ov(col, green, max(max(ringA, axes), tickR), lum0);
  // the sweep: a bright thin arm and a wedge that fades behind it
  float wedge = exp(-age * 0.95) * (0.60 + 0.40 * r / R) * inD;
  float arm = exp(-pow(min(age, 6.2832 - age) * r / (2.0 * px), 2.0)) * step(r, R);
  col = rg_ov(col, green, wedge * 0.85, lum0);
  col = rg_ov(col, head, arm * 0.95, lum0);
  // a few tiny blips, bright when the sweep has just passed, more so near the pointer
  float blipA = 0.0;
  for (int i = 0; i < 6; i++) {
    vec3 B = rg_blip(i);
    float ba = B.x * 6.2832 + 0.05 * sin(t * 0.13 + B.z);
    float bage = mod(sweepA - ba, 6.2832);
    vec2 bp = rc + vec2(sin(ba), -cos(ba)) * (B.y * R);
    float seen = 0.30 + 0.70 * exp(-bage * 0.85);
    float nearP = has ? rg_glow(bp, mp, 0.12) : 0.0;
    float sz2 = 4.5 * px * (1.0 + 0.5 * nearP);
    blipA += (rg_glow(p, bp, sz2) + 0.25 * rg_glow(p, bp, sz2 * 3.0)) * seen * (1.0 + 0.8 * nearP);
  }
  col = rg_ov(col, amber, blipA * 1.3, lum0);

  // ---- dotted range rings around the pointer: three steady, one slowly spreading ping ----
  if (has) {
    vec2 dm = p - mp;
    float rm = length(dm);
    float am = atan(dm.x, -dm.y);
    float pr = 0.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float rk = 0.060 + 0.058 * fk;
      float dr = abs(rm - rk) / px;
      float dots = step(fract(am * rk / (9.0 * px) + t * 0.05 * (k == 1 ? -1.0 : 1.0)), 0.55);
      pr = max(pr, rg_aa(dr, 0.7) * dots * (0.95 - 0.10 * fk));
    }
    float pl = fract(t * 0.22);
    float rp = 0.04 + pl * 0.22;
    pr = max(pr, rg_aa(abs(rm - rp) / px, 0.5) * (1.0 - pl) * (1.0 - pl) * 0.80);
    // a small cross at the centre
    float cr = max(rg_aa(abs(dm.x) / px, 0.0) * step(abs(dm.y), 7.0 * px) * step(2.5 * px, abs(dm.y)),
                   rg_aa(abs(dm.y) / px, 0.0) * step(abs(dm.x), 7.0 * px) * step(2.5 * px, abs(dm.x)));
    col = rg_ov(col, green, max(pr, cr * 0.9), lum0);
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
