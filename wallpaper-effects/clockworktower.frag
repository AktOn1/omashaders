// label: Clockwork tower
// hint: the inside of a clock tower: huge bronze gears turn slowly behind each other, a pendulum swings, warm light shafts stream through the back of the glass clock face with dust drifting in them; gears near the pointer turn faster
// category: Frontier and steam
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
float ct_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ct_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ct_hash(i), ct_hash(i + vec2(1, 0)), f.x), mix(ct_hash(i + vec2(0, 1)), ct_hash(i + vec2(1, 1)), f.x), f.y);
}
float ct_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * ct_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ct_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float CT_TAU = 6.2831853;
const float CT_AA = 0.0013;

// angular catch-up for gears near the pointer: a bounded extra turn that keeps creeping forward (two overlapping sawtooth phases, so it never jumps)
float ct_surge(float t) {
  float u1 = fract(t / 9.0), u2 = fract(t / 9.0 + 0.5);
  float w1 = sin(u1 * 3.14159); w1 *= w1;
  return w1 * u1 + (1.0 - w1) * u2;
}

// a toothed gear with spokes. returns coverage; rr = radius / R, edge = bevel highlight (1 on the rim)
float ct_gear(vec2 d, float R, float N, float ang, float tooth, float spokes, out float rr, out float edge, out float a0) {
  float r = length(d);
  rr = r / R;
  edge = 0.0;
  a0 = 0.0;
  if (rr > 1.15) return 0.0;
  float a = atan(d.y, d.x) - ang;
  a0 = a;
  float ph = fract(a * N / CT_TAU);
  float tp = smoothstep(0.04, 0.20, ph) * (1.0 - smoothstep(0.42, 0.58, ph));
  float Rb = R * (1.0 - tooth * (1.0 - tp));
  float body = smoothstep(Rb, Rb - CT_AA, r);
  float ring = smoothstep(0.30, 0.32, rr) * (1.0 - smoothstep(0.80, 0.82, rr));
  float sp = abs(sin(a * spokes * 0.5));
  float hole = ring * smoothstep(0.13, 0.17, sp);
  hole = max(hole, smoothstep(0.075, 0.07, abs(rr - 0.0)) * 0.0);
  edge = 1.0 - clamp((Rb - r) / (0.045 * R), 0.0, 1.0);
  float hub = smoothstep(0.17, 0.15, rr);
  edge = max(edge, smoothstep(0.80, 0.84, rr) * 0.45 * (1.0 - hub));         // the bevel on the inside of the rim
  edge = max(edge, hole * 0.0);
  return body * (1.0 - hole);
}


// bronze with a verdigris cast, lit from the glass: depth 0 = far and hazy, 1 = near and almost black
vec3 ct_gearCol(float lightK, float ge, float spill, float depth) {
  vec3 warm = vec3(1.0, 0.70, 0.34);
  vec3 dark = vec3(0.016, 0.024, 0.026);
  vec3 bronze = vec3(0.42, 0.30, 0.12);
  float k = (0.10 + 0.55 * lightK * (0.3 + spill)) * (1.0 - 0.80 * depth);
  vec3 c = mix(dark, bronze, k);
  c = mix(c, vec3(0.10, 0.22, 0.18), 0.30 * (1.0 - lightK) * (1.0 - depth));
  c += warm * ge * (0.30 + 0.55 * depth) * lightK * (0.35 + 1.1 * spill);
  return c;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  // the clock face (seen from behind) and the light it throws
  vec2 dc = vec2(asp * 0.70, 0.45);
  float DR = 0.33;
  vec2 dd = p - dc;
  float dist = length(dd);
  float ang = atan(dd.y, dd.x);
  vec3 warm = vec3(1.0, 0.70, 0.34);
  vec3 cream = vec3(1.0, 0.88, 0.62);

  // ---- the tower interior: old dark timber and masonry, brightened by what spills from the face
  float spill = exp(-max(dist - DR, 0.0) / 0.55);
  float stone = ct_fbm3(vec2(p.x * 9.0, p.y * 6.0));
  vec3 col = vec3(0.012, 0.026, 0.032) + vec3(0.020, 0.020, 0.016) * stone;
  // vertical timber beams on the wall
  float beam = smoothstep(0.012, 0.0, abs(fract(p.x * 1.5 + 0.2) - 0.5) - 0.40) * (0.5 + 0.5 * ct_noise(vec2(p.y * 3.0, p.x * 4.0)));
  col += vec3(0.030, 0.022, 0.014) * beam;
  col += warm * 0.17 * spill * (0.55 + 0.6 * stone);
  col += w * vec3(0.07, 0.07, 0.06) * 0.5;                                           // the picture's glow, faintly, as light through cracks

  // ---- the glass dial, backlit: milky amber, with the marks and the hands as dark shapes seen from behind
  if (dist < DR * 1.10) {
    float rr = dist / DR;
    float th = ang + 1.5707963;                                                       // angle from 12 o'clock, clockwise
    vec3 glass = mix(vec3(1.0, 0.80, 0.46), vec3(1.0, 0.94, 0.78), smoothstep(0.1, 0.9, rr));
    glass *= 0.78 + 0.22 * ct_fbm3(dd * 14.0 + 3.0);                                  // a little unevenness in the old glass
    glass = mix(glass, glass * (0.55 + 0.9 * w), 0.30);                               // the picture shows through the glass
    vec3 face = glass;
    // hour bars and minute ticks
    float hq = CT_TAU / 12.0;
    float dh = abs(fract(th / hq + 0.5) - 0.5) * hq * dist;
    float bar = step(dh, 0.0085) * step(0.78, rr) * step(rr, 0.92);
    float dm = abs(fract(th / (CT_TAU / 60.0) + 0.5) - 0.5) * (CT_TAU / 60.0) * dist;
    float tick = step(dm, 0.0020) * step(0.88, rr) * step(rr, 0.93);
    float ring2 = smoothstep(0.0024, 0.0010, abs(rr - 0.74));
    // a second short bar beside every third hour, like numerals read from behind
    float dh2 = abs(fract((th + 0.04) / hq + 0.5) - 0.5) * hq * dist;
    float num = step(dh2, 0.0035) * step(0.62, rr) * step(rr, 0.70) * step(fract(th / (hq * 3.0) + 0.5), 0.5);
    float marks = max(max(bar, tick), max(ring2, num * 0.8));
    face = mix(face, vec3(0.20, 0.10, 0.04), marks * 0.86);
    // hands
    float thm = t * 0.011 + 1.25;
    float thh = thm / 12.0 + 3.35;
    vec2 dirM = vec2(sin(thm), -cos(thm));
    vec2 dirH = vec2(sin(thh), -cos(thh));
    float alM = dot(dd, dirM), pM = abs(dot(dd, vec2(-dirM.y, dirM.x)));
    float sM = alM / (DR * 0.82);
    float wM = 0.0050 * (1.0 - 0.5 * sM) + 0.010 * exp(-pow((sM - 0.82) / 0.07, 2.0));
    float hM = step(-0.07, alM) * step(alM, DR * 0.85) * smoothstep(wM, wM - CT_AA, pM);
    float alH = dot(dd, dirH), pH = abs(dot(dd, vec2(-dirH.y, dirH.x)));
    float sH = alH / (DR * 0.55);
    float wH = 0.0085 * (1.0 - 0.45 * sH) + 0.016 * exp(-pow((sH - 0.74) / 0.10, 2.0));
    float hH = step(-0.05, alH) * step(alH, DR * 0.57) * smoothstep(wH, wH - CT_AA, pH);
    float hub = smoothstep(0.030, 0.026, dist);
    float hands = max(max(hM, hH), hub);
    face = mix(face, vec3(0.07, 0.04, 0.02), hands * 0.92);
    // the bezel: a dark bronze ring with a bright inner edge
    float bez = smoothstep(0.96, 0.975, rr) * (1.0 - smoothstep(1.06, 1.075, rr));
    vec3 bzc = vec3(0.10, 0.07, 0.035) + warm * 0.55 * smoothstep(0.95, 0.975, rr) * (1.0 - smoothstep(0.975, 0.99, rr));
    face = mix(face, bzc, bez);
    float inside = 1.0 - smoothstep(1.07, 1.085, rr);
    col = mix(col, face, inside);
  }
  // bloom outside the face
  col += warm * 0.35 * exp(-max(dist - DR * 1.05, 0.0) / 0.10) * step(DR * 1.05, dist);

  // ---- gears, back to front. each: centre, radius, teeth, spin; nearer to the pointer = turns a bit faster
  float srg = ct_surge(t);
  float gr, ge, ga, cv, near, spin, lightK;
  vec2 gc, Ldir;

  // back: one huge dim wheel
  gc = vec2(asp * 0.17, 0.30);
  near = hasM ? smoothstep(0.50, 0.12, length(mp - gc) - 0.40) : 0.0;
  spin = 0.040 * t + near * 0.9 * srg;
  cv = ct_gear(p - gc, 0.40, 40.0, spin, 0.040, 6.0, gr, ge, ga);
  lightK = 0.5 + 0.5 * dot(normalize(p - gc + 0.0001), normalize(dc - gc));
  col = mix(col, ct_gearCol(lightK, ge, spill, 0.0), cv * 0.92);

  // a second wheel meshing with it, lower
  gc = vec2(asp * 0.17 + 0.62 * cos(1.05), 0.30 + 0.62 * sin(1.05));
  near = hasM ? smoothstep(0.45, 0.10, length(mp - gc) - 0.24) : 0.0;
  spin = -0.040 * 40.0 / 24.0 * t + 3.14159 / 24.0 - near * 0.9 * srg * 40.0 / 24.0;
  cv = ct_gear(p - gc, 0.24, 24.0, spin, 0.050, 5.0, gr, ge, ga);
  lightK = 0.5 + 0.5 * dot(normalize(p - gc + 0.0001), normalize(dc - gc));
  col = mix(col, ct_gearCol(lightK, ge, spill, 0.25), cv * 0.92);

  // middle: dark wheels against the glow, a pair in mesh
  gc = vec2(asp * 0.40, 0.80);
  near = hasM ? smoothstep(0.45, 0.10, length(mp - gc) - 0.28) : 0.0;
  spin = 0.062 * t + near * 1.0 * srg;
  cv = ct_gear(p - gc, 0.28, 28.0, spin, 0.050, 5.0, gr, ge, ga);
  lightK = 0.5 + 0.5 * dot(normalize(p - gc + 0.0001), normalize(dc - gc));
  col = mix(col, ct_gearCol(lightK, ge, spill, 0.6), cv);

  gc = vec2(asp * 0.40 + 0.466 * cos(-0.62), 0.80 + 0.466 * sin(-0.62));
  near = hasM ? smoothstep(0.42, 0.10, length(mp - gc) - 0.19) : 0.0;
  spin = -0.062 * 28.0 / 19.0 * t + 3.14159 / 19.0 - near * 1.0 * srg * 28.0 / 19.0;
  cv = ct_gear(p - gc, 0.19, 19.0, spin + 0.2, 0.055, 4.0, gr, ge, ga);
  lightK = 0.5 + 0.5 * dot(normalize(p - gc + 0.0001), normalize(dc - gc));
  col = mix(col, ct_gearCol(lightK, ge, spill, 0.6), cv);

  gc = vec2(asp * 0.94, 0.10);
  near = hasM ? smoothstep(0.45, 0.10, length(mp - gc) - 0.20) : 0.0;
  spin = 0.075 * t + near * 1.0 * srg;
  cv = ct_gear(p - gc, 0.20, 22.0, spin, 0.055, 4.0, gr, ge, ga);
  lightK = 0.5 + 0.5 * dot(normalize(p - gc + 0.0001), normalize(dc - gc));
  col = mix(col, ct_gearCol(lightK, ge, spill, 0.6), cv);

  // ---- light shafts out of the glass, with dust drifting in them
  float shaft = 0.0;
  {
    vec2 au = vec2(cos(ang + t * 0.010), sin(ang + t * 0.010));
    float k1 = ct_noise(au * 4.2 + 2.0);
    float k2 = ct_noise(vec2(cos(ang - t * 0.015), sin(ang - t * 0.015)) * 8.0 + 7.0);
    shaft = smoothstep(0.48, 0.80, k1) * (0.25 + 1.0 * smoothstep(0.30, 0.75, k2));
    shaft *= smoothstep(DR * 0.95, DR * 1.4, dist) * exp(-max(dist - DR, 0.0) / 0.62);
    // the numerals and the hands cut the light into rays: slightly stronger where an hour bar points
    float hq = CT_TAU / 12.0;
    float dhh = abs(fract((ang + 1.5707963) / hq + 0.5) - 0.5);
    shaft *= 0.70 + 0.55 * smoothstep(0.17, 0.0, dhh);
  }
  col += vec3(1.0, 0.72, 0.38) * shaft * 0.80;
  // dust: three layers of slowly rising motes, bright in the shafts and near the face, faint elsewhere
  float dust = 0.0;
  for (int l = 0; l < 3; l++) {
    float lf = float(l);
    float sc = 22.0 + 16.0 * lf;
    vec2 q = vec2(p.x * sc, p.y * sc);
    q.y += t * (0.35 + 0.18 * lf) * (1.0 + 0.0 * lf);
    q.x += t * 0.10 * (lf - 1.0);
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    float h1 = ct_hash(cell + lf * 7.7), h2 = ct_hash(cell + 11.3 + lf);
    vec2 off = vec2(sin(t * (0.4 + h1) + h2 * 6.0), cos(t * (0.3 + h2) + h1 * 6.0)) * 0.25;
    float md = length(f - off + vec2(h1 - 0.5, h2 - 0.5) * 0.3);
    float tw = 0.5 + 0.5 * sin(t * (0.8 + 1.4 * h1) + h2 * 20.0);
    dust += smoothstep(0.11 - 0.025 * lf, 0.0, md) * step(0.55, h1) * (0.35 + 0.65 * tw);
  }
  col += cream * dust * (0.06 + 1.5 * shaft + 0.55 * spill * spill) * 0.55;

  // ---- front layer: the darkest gears, near the viewer
  gc = vec2(asp * 0.04, 0.96);
  near = hasM ? smoothstep(0.45, 0.10, length(mp - gc) - 0.24) : 0.0;
  spin = -0.055 * t - near * 1.0 * srg;
  cv = ct_gear(p - gc, 0.24, 24.0, spin, 0.055, 4.0, gr, ge, ga);
  lightK = 0.5 + 0.5 * dot(normalize(p - gc + 0.0001), normalize(dc - gc));
  col = mix(col, ct_gearCol(lightK, ge, spill, 1.0), cv);

  gc = vec2(asp * 0.97, 1.0);
  near = hasM ? smoothstep(0.50, 0.10, length(mp - gc) - 0.32) : 0.0;
  spin = 0.035 * t + near * 0.9 * srg;
  cv = ct_gear(p - gc, 0.32, 30.0, spin, 0.045, 5.0, gr, ge, ga);
  lightK = 0.5 + 0.5 * dot(normalize(p - gc + 0.0001), normalize(dc - gc));
  col = mix(col, ct_gearCol(lightK, ge, spill, 1.0), cv);

  // ---- the pendulum: a long rod from the ceiling and a heavy lens bob, swinging across the light
  vec3 bronze = vec3(0.50, 0.36, 0.15);
  {
    vec2 pv = vec2(asp * 0.43, -0.03);
    float th = 0.25 * sin(t * 1.20);
    float L = 0.82;
    vec2 e = pv + L * vec2(sin(th), cos(th));
    vec2 rd = e - pv;
    vec2 pa = p - pv;
    float h = clamp(dot(pa, rd) / dot(rd, rd), 0.0, 1.0);
    float rod = smoothstep(0.0048, 0.0030, length(pa - rd * h));
    float de = length((p - e) * vec2(1.0, 1.0));
    vec2 be = p - e;
    float bob = smoothstep(0.072, 0.068, length(be * vec2(1.0, 1.15)));
    // bronze lens lit from the right (the face side)
    float lf = 0.5 + 0.5 * dot(normalize(be + 0.0001), normalize(dc - e));
    vec3 bc = mix(vec3(0.020, 0.017, 0.013), bronze * 0.7, smoothstep(0.35, 0.95, lf) * 0.8);
    bc += warm * smoothstep(0.050, 0.068, length(be * vec2(1.0, 1.15))) * 0.6 * lf;
    bc += warm * smoothstep(0.016, 0.0, length(be - vec2(0.020, -0.016))) * 0.35;
    vec3 rc = vec3(0.020, 0.016, 0.012) + warm * 0.18 * smoothstep(0.0048, 0.003, abs(length(pa - rd * h) - 0.0019)) * 0.0;
    col = mix(col, rc, rod);
    col = mix(col, bc, bob);
    // a thin collar above the bob
    float collar = smoothstep(0.0095, 0.0070, length((p - (e - 0.083 * normalize(rd))) * vec2(1.0, 2.0)));
    col = mix(col, vec3(0.03, 0.025, 0.02), collar);
  }

  // let the picture breathe a little, and a gentle vignette keeping the corners calm
  col *= 0.96 + 0.08 * ct_luma(w);
  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
