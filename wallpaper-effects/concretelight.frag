// label: Concrete light
// hint: bare board-marked concrete, a slab and a stair block, one hard slanted sun shaft that drifts very slowly over the wall with fine dust in it; the pointer nudges the shaft edge sideways
// category: Style studies
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
float cl_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 cl_h2(vec2 p) { return vec2(cl_hash(p), cl_hash(p + vec2(37.1, 11.7))); }
float cl_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cl_hash(i), cl_hash(i + vec2(1, 0)), f.x), mix(cl_hash(i + vec2(0, 1)), cl_hash(i + vec2(1, 1)), f.x), f.y);
}
float cl_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * cl_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float cl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float CL_FLOOR = 0.90;      // top of the floor slab
const float CL_SOFFIT = 0.075;    // lower edge of the slab above

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  float t = time;
  vec3 w = wall(uv);

  // ---- the stair block on the right: steps rise to the right edge
  float x0 = 0.58 * asp;
  float sw = 0.085 * asp;
  float rh = 0.095;
  float nStep = floor((p.x - x0) / sw) + 1.0;
  float yTop = CL_FLOOR - rh * min(nStep, 5.0);
  bool block = p.x >= x0 && p.y > yTop && p.y < CL_FLOOR + 0.0;
  bool floorSlab = p.y >= CL_FLOOR;
  bool soffit = p.y < CL_SOFFIT;

  // ---- surface value of the concrete (flat grey, no light yet)
  vec3 base = vec3(0.50, 0.50, 0.50);
  float tone = 0.0;
  // mottling, very fine grain, board marks and weathering streaks
  float mott = cl_fbm(p * 5.0 + 3.0);
  float grain = cl_noise(p * 520.0) * 0.6 + cl_noise(p * 210.0) * 0.4;
  float boards = cl_noise(vec2(p.x * 2.5, p.y * 150.0));
  float streak = cl_noise(vec2(p.x * 38.0, p.y * 1.4 + 5.0));
  tone += (mott - 0.5) * 0.10 + (grain - 0.5) * 0.065 + (boards - 0.5) * 0.030 + (streak - 0.5) * 0.050;
  // pits (tiny air holes)
  {
    vec2 g = p * 90.0;
    vec2 id = floor(g);
    vec2 h = cl_h2(id);
    vec2 f = fract(g) - (0.25 + 0.5 * h);
    float pit = step(0.93, cl_hash(id + 2.0)) * smoothstep(0.16, 0.04, length(f));
    tone -= pit * 0.10;
  }
  vec3 surf = base + tone;

  // formwork: panel seams and tie holes on the wall; the block and floor have their own joints
  float lineD = 1e3;        // distance to the nearest seam (uv units)
  float holes = 0.0;
  if (!block && !floorSlab && !soffit) {
    float pw = 0.62, ph = 0.30;
    vec2 q = vec2(p.x + 0.12, p.y);
    float sx = abs(fract(q.x / pw + 0.5) - 0.5) * pw;
    float sy = abs(fract(q.y / ph) - 0.5) * ph;
    lineD = min(abs(sx - 0.5 * pw), abs(sy - 0.5 * ph));
    lineD = min(abs(fract(q.x / pw) * pw), min(abs(pw - fract(q.x / pw) * pw), min(fract(q.y / ph) * ph, ph - fract(q.y / ph) * ph)));
    // tie holes: four per panel, inset
    vec2 cellq = vec2(fract(q.x / pw) * pw, fract(q.y / ph) * ph);
    vec2 hh = abs(cellq - 0.5 * vec2(pw, ph)) - 0.5 * vec2(pw, ph) + vec2(0.065, 0.062);
    holes = smoothstep(0.0085, 0.0045, length(hh));
  } else if (block) {
    float ry = (CL_FLOOR - p.y) / rh;
    lineD = min(abs(fract(ry) * rh), abs(rh - fract(ry) * rh));
    float rx = (p.x - x0) / sw;
    lineD = min(lineD, min(abs(fract(rx) * sw), abs(sw - fract(rx) * sw)) * 4.0);
  } else if (floorSlab) {
    float fx = fract((p.x + 0.12) / 0.72);
    lineD = min(fx * 0.72, (1.0 - fx) * 0.72) * 3.0;
  }
  float seam = smoothstep(0.0022, 0.0004, lineD);
  surf -= seam * 0.17;
  surf += smoothstep(0.0075, 0.0022, lineD - 0.0022) * 0.020;       // a faint chamfer highlight beside a seam
  surf -= holes * 0.22;

  // different tones: the block a touch darker, the floor slab lighter and smoother, the soffit darker
  if (block) surf *= 0.84;
  if (floorSlab) { surf = surf * 0.96 + 0.05 + (mott - 0.5) * 0.04; }
  if (soffit) surf *= 0.86;
  // tread edges: a lit strip along the top of each step, a dark crevice below it
  if (block) {
    float dtop = p.y - yTop;
    surf += 0.15 * smoothstep(0.026, 0.020, dtop) * smoothstep(-0.002, 0.002, dtop);   // the tread seen from a little above
    surf -= 0.09 * smoothstep(0.040, 0.026, dtop) * smoothstep(0.020, 0.026, dtop);
    float sxn = (p.x - x0) / sw;
    surf += 0.045 * smoothstep(0.03, 0.0, fract(sxn) * sw);          // the nosing of each riser
  }
  // contact and ambient occlusion
  float ao = 1.0;
  if (!block && !floorSlab) {
    if (p.x >= x0) ao *= 1.0 - 0.34 * smoothstep(0.045, 0.0, yTop - p.y);                 // wall above the steps
    ao *= 1.0 - 0.22 * smoothstep(0.05, 0.0, CL_FLOOR - p.y);                             // wall into the floor
    ao *= 1.0 - 0.26 * smoothstep(0.07, 0.0, p.y - CL_SOFFIT) * step(CL_SOFFIT, p.y);      // under the slab
  }
  if (floorSlab) ao *= 1.0 - 0.30 * smoothstep(0.07, 0.0, p.y - CL_FLOOR);
  if (block) ao *= 1.0 - 0.18 * smoothstep(0.05, 0.0, CL_FLOOR - p.y);
  surf *= ao;

  // ---- the sun shaft: one hard slanted band
  vec2 sdir = normalize(vec2(0.42, 0.91));
  vec2 snrm = vec2(sdir.y, -sdir.x);
  vec2 so = vec2(0.5 * asp, 0.5);
  float s = dot(p - so, snrm);
  s += (cl_noise(p * 70.0) - 0.5) * 0.0045;                           // the edge follows the texture a little
  float r = dot(p - so, sdir);
  float W = 0.34 * (1.0 + 0.05 * sin(t * 0.017));
  float shift = -0.12 + 0.30 * sin(t * 0.0105 + 0.6) + 0.07 * sin(t * 0.0037 + 2.0);
  if (hasM) shift += (m.x - 0.5) * 0.15;                               // the pointer moves the shaft edge
  float edge = 0.0022;
  float inB = smoothstep(shift - edge, shift + edge, s) * smoothstep(shift + W + edge, shift + W - edge, s);
  // shadows of a window frame inside the light: one lengthwise mullion and one crossbar
  float mull = smoothstep(0.0045, 0.0015, abs(s - (shift + W * 0.64)));
  float cross1 = smoothstep(0.0055, 0.0020, abs(r - 0.10));
  float inLight = inB * (1.0 - 0.55 * max(mull, cross1 * 0.9));
  // the stair block and the floor stand slightly forward of the wall, so the shaft meets them a hair offset
  vec3 shade = vec3(0.80, 0.81, 0.83);                 // shadowed concrete: slightly cool
  vec3 lit = vec3(1.50, 1.43, 1.30);                   // sunlit concrete: warm
  float k = inLight;
  vec3 light = mix(shade, lit, k);
  // a soft bounce of warm light close to the shaft inside the shadow
  float ds = min(abs(s - shift), abs(s - shift - W));
  light += vec3(0.07, 0.065, 0.055) * exp(-ds / 0.12) * (1.0 - inB);
  vec3 col = surf * light;
  // texture reads stronger in raking light
  col += (tone) * 0.35 * k;

  // ---- dust in the shaft
  {
    for (int l = 0; l < 2; l++) {
      float fl = float(l);
      float sc = 48.0 + 40.0 * fl;
      vec2 g = p * sc + vec2(t * 0.020 * (1.0 + fl), t * 0.050 * (0.6 + fl)) + vec2(fl * 5.0, 3.0 * fl);
      vec2 id = floor(g);
      vec2 h = cl_h2(id + fl * 8.0);
      vec2 f = fract(g) - (0.2 + 0.6 * h);
      float on = step(0.80, cl_hash(id + 1.7));
      float tw = 0.5 + 0.5 * sin(t * (0.20 + 0.3 * h.x) + h.y * 30.0);
      float rr = 0.045 + 0.04 * h.x;
      float d1 = exp(-dot(f, f) / (rr * rr)) * on * tw;
      col += vec3(1.0, 0.96, 0.86) * d1 * inB * 0.55 * (l == 0 ? 0.8 : 0.5);
    }
  }

  // very faint luma from the user's picture; never a colour tint
  col *= 0.97 + 0.06 * cl_luma(w);
  col *= 1.0 - 0.20 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0) * qt_Opacity;
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
