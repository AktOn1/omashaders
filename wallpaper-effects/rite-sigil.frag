// label: Rite sigil
// hint: fine brass engraving assembles over the dark parts of the picture and clicks into new alignment, painted iron and brass chains sway in front in the candle light and lean away from the pointer, a slow oxblood tide rises in the shadows, ash and embers drift through the glow
// category: Horror
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
layout(binding = 2) uniform sampler2D sprites; // rite-sigil.png: FLUX atlas of the three front chains, see rs_tex

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales

float rs_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rs_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rs_hash(i), rs_hash(i + vec2(1, 0)), f.x), mix(rs_hash(i + vec2(0, 1)), rs_hash(i + vec2(1, 1)), f.x), f.y);
}
float rs_fbm(vec2 p) { return rs_noise(p) * 0.55 + rs_noise(p * 2.03 + 5.3) * 0.30 + rs_noise(p * 4.07 + 11.7) * 0.15; }
float rs_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const vec3 RS_BRASS = vec3(0.86, 0.65, 0.26);
const vec3 RS_AMBER = vec3(1.0, 0.55, 0.18);
const vec3 RS_BONE = vec3(0.95, 0.88, 0.78);
const vec3 RS_OX = vec3(0.42, 0.03, 0.05);
const vec3 RS_CRIMSON = vec3(0.75, 0.06, 0.08);

// the one candle: steady wobble, small irregular tremor, and now and then a gutter where it nearly dies
float rs_flick(float t) {
  float f = 0.80 + 0.07 * sin(t * 5.1 + 1.0) * sin(t * 2.3 + 0.4) + 0.10 * (rs_noise(vec2(t * 7.0, 1.7)) - 0.5);
  float per = 7.0;
  float slot = floor(t / per);
  float u = t - slot * per - (1.0 + 4.5 * rs_hash(vec2(slot, 3.0)));
  float calm = step(0.45, rs_hash(vec2(slot, 9.0)));
  float dip = exp(-u * u / 0.012) * 0.32 + exp(-(u - 0.33) * (u - 0.33) / 0.008) * 0.2;
  return f * (1.0 - dip * calm);
}

// ---------------------------------------------------------------- brass engraving
// nested squares, each level turning by its own number of eighth-turns on every click, cut diagonals, edge ticks;
// a bright glint runs along the lines when a panel settles
vec2 rs_panel(vec2 p, float t, float px) {
  float cs = 0.92;
  vec2 gp = p / cs;
  vec2 id = floor(gp);
  float h = rs_hash(id + 3.1);
  float slotT = t / 34.0 + h * 9.0;
  float k = floor(slotT);
  float fr = fract(slotT);
  if (rs_hash(id + k * 1.713 + 11.0) > 0.46) return vec2(0.0);
  float appear = smoothstep(0.0, 0.14, fr) * (1.0 - smoothstep(0.86, 1.0, fr));
  vec2 jit = (vec2(rs_hash(id + k + 21.0), rs_hash(id + k + 33.0)) - 0.5) * 0.10;
  vec2 f = (fract(gp) - 0.5) * cs - jit;
  float s0 = cs * (0.255 + 0.03 * rs_hash(id + k + 5.0));
  if (max(abs(f.x), abs(f.y)) > s0 * 1.5) return vec2(0.0);

  float u = t / 12.0 + h * 5.0;
  float kk = floor(u);
  float ff = fract(u) * 12.0;
  float sN = clamp(ff / 1.1, 0.0, 1.0);
  float c = kk + sN * sN * (3.0 - 2.0 * sN) + 0.07 * sin(sN * 12.566) * (1.0 - sN);   // the click: a quick turn with a small overshoot, then still

  float w = 0.8 * px;
  float sum = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float sg = 1.0 - 2.0 * mod(fi, 2.0);
    float r = s0 * (1.0 - 0.19 * fi);
    float a = sg * (fi + 1.0) * c * 0.7853982;
    float ca = cos(a), sa = sin(a);
    vec2 v = vec2(ca * f.x + sa * f.y, -sa * f.x + ca * f.y);
    float ch = max(abs(v.x), abs(v.y));
    float dl = abs(ch - r);
    float app = smoothstep(0.10 * fi, 0.10 * fi + 0.35, appear);
    float ln = exp(-dl * dl / (w * w)) + exp(-dl / (3.5 * px)) * 0.14;
    float dt = min(abs(v.x), abs(v.y));
    float band = smoothstep(r - 0.06 * s0 - px, r - 0.06 * s0, ch) * (1.0 - smoothstep(r - px, r, ch));
    float tick = exp(-dt * dt / (w * w)) * band;
    float dd = abs(abs(v.x) - abs(v.y)) * 0.7071;
    float dmask = smoothstep(r * 0.5, r * 0.52, ch) * (1.0 - smoothstep(r * 0.96 - px, r * 0.96, ch));
    float dash = smoothstep(-0.15, 0.15, sin(ch / s0 * 34.0 + fi * 2.0));
    float diag = exp(-dd * dd / (w * w)) * dmask * dash;
    sum += (ln + tick * 0.9 + diag * 0.75) * app * (1.0 - 0.10 * fi);
  }
  float gpos = dot(f, vec2(0.7071)) / s0;
  float sp = -1.5 + 3.0 * clamp((ff - 1.1) / 1.4, 0.0, 1.0);
  float win = smoothstep(1.0, 1.2, ff) * (1.0 - smoothstep(2.5, 2.7, ff));
  float gl = exp(-(gpos - sp) * (gpos - sp) / 0.0144) * win;
  return vec2(sum * (1.0 + 3.5 * gl), gl) * appear;
}

// a sparse lattice of triangular facets: three families of hairlines, in patches, broken into dashes, turning a notch with the click
float rs_lattice(vec2 p, float t, float px) {
  float u = t / 12.0;
  float sN = clamp((fract(u) * 12.0) / 1.3, 0.0, 1.0);
  float rot = 0.30 + 0.2618 * (floor(u) + sN * sN * (3.0 - 2.0 * sN));
  float sp = 0.215;
  float w = 0.75 * px;
  float patchm = smoothstep(0.52, 0.72, rs_noise(p * 1.35 + vec2(t * 0.012, 4.0)));
  if (patchm < 0.01) return 0.0;
  float acc = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a = rot + fi * 1.0471976;
    vec2 dir = vec2(cos(a), sin(a));
    float along = dot(p, dir) / sp;
    float d = abs(fract(along + 0.5) - 0.5) * sp;
    float par = dot(p, vec2(-dir.y, dir.x));
    float gap = smoothstep(0.38, 0.56, rs_noise(vec2(par * 4.5 + fi * 7.0, floor(along + 0.5) * 3.17 + fi * 5.1 + t * 0.01)));
    acc += (exp(-d * d / (w * w)) + exp(-d / (3.0 * px)) * 0.10) * gap;
  }
  return acc * patchm;
}

// ---------------------------------------------------------------- chains
float rs_cx(float yy, vec4 prm, float yL, vec2 pm, float rng, float depth) {
  float u = clamp(yy / yL, 0.0, 1.0);
  float t = time;
  float x = prm.x + prm.y * u * sin(prm.z * t + prm.w - 1.5 * u) + prm.y * 0.30 * u * u * sin(prm.z * 1.83 * t + prm.w * 2.1 - 3.0 * u);
  float dx = pm.x - prm.x;
  float dy = yy - 0.12 - pm.y;
  // leans away from the pointer, never toward it
  float lean = -dx / (abs(dx) + 0.12) * exp(-abs(dx) / (0.2 + 0.5 * rng)) * exp(-dy * dy / 0.18) * (0.05 + 0.07 * depth) * smoothstep(0.0, 0.4, u);
  return x + lean;
}

vec4 rs_over(vec4 acc, vec4 c) {          // premultiplied
  return vec4(c.rgb + acc.rgb * (1.0 - c.a), c.a + acc.a * (1.0 - c.a));
}

// the front chains are FLUX paintings: three cells of 192 x 1024 in rite-sigil.png, each cropped tight to its chain (x = across, y = top to foot)
const vec2 RS_ATL = vec2(576.0, 1024.0);
float rs_aspect(int k) {           // width / length of the painted chain
  if (k == 0) return 0.1318;
  if (k == 1) return 0.1100;   // the twisted brass one is painted slim; drawn 1.5 times wider so it reads
  return 0.1311;
}
vec4 rs_tex(int k, vec2 uv) {
  vec2 q = clamp(uv, 0.003, 0.997);
  return texture(sprites, vec2((float(k) * 192.0 + q.x * 192.0) / RS_ATL.x, q.y));
}

// one painted chain hung from above the frame; its centre line follows the sway, candle light scales the baked metal
vec4 rs_chain(vec2 p, int k, float flip, float ax, float len, float depth, float seed, vec2 cp, float flick, vec2 pm, float cam) {
  float t = time;
  float y = p.y + 0.12;
  float yL = len + 0.12;
  if (p.y > len + 0.02) return vec4(0.0);
  vec4 prm = vec4(ax + cam * (0.4 + depth) * 0.02,
                  mix(0.010, 0.030, depth),
                  6.2831853 / (5.2 + 2.6 * seed),
                  seed * 17.0);
  float x0 = rs_cx(y, prm, yL, pm, range, depth);
  float halfW = yL * rs_aspect(k) * 0.5 * mix(0.50, 0.80, depth);
  float u = 0.5 + (p.x - x0) / (2.0 * halfW);
  if (u < 0.0 || u > 1.0) return vec4(0.0);
  vec4 s = rs_tex(k, vec2(mix(u, 1.0 - u, flip), y / yL));
  if (s.a < 0.003) return vec4(0.0);
  vec2 dc = p - cp;
  float att = 1.0 / (1.0 + dot(dc, dc) / 0.22) * flick;
  float shade = 0.40 + 0.60 * smoothstep(0.25, 0.75, rs_noise(vec2(y * 3.1 + seed * 9.0, t * 0.04 + seed * 3.0)));
  vec3 lit = mix(vec3(1.0), RS_AMBER * 1.25, clamp(att * 1.4, 0.0, 1.0));
  vec3 c = s.rgb * (0.60 + 1.30 * att * shade) * lit * mix(0.62, 1.0, depth);
  return vec4(c * s.a, s.a);
}

// ---------------------------------------------------------------- ash and embers
// one depth of drifting flakes; some cells are embers that glow and die
vec4 rs_ash(vec2 p, float scale, vec2 vel, float density, float rad, float seed, vec2 cp, float flick, out float ember) {
  float t = time;
  ember = 0.0;
  vec2 q = (p - vel * t) * scale;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 k = id + seed * 7.3;
  float h = rs_hash(k);
  if (h > density) return vec4(0.0);
  float h2 = rs_hash(k + 17.3), h3 = rs_hash(k + 41.7), h4 = rs_hash(k + 73.1);
  vec2 c = (vec2(h2, h3) - 0.5) * 0.36;
  c += 0.14 * vec2(sin(t * 0.37 * (0.6 + h2) + h4 * 6.28), cos(t * 0.27 * (0.6 + h3) + h2 * 6.28));
  vec2 d = f - c;
  vec2 pc = (id + 0.5 + c) / scale + vel * t;
  vec2 dl = cp - pc;
  float att = 1.0 / (1.0 + dot(dl, dl) / 0.42) * flick;
  float r = rad * (0.5 + 0.9 * h4);
  if (h4 > 0.80) {
    ember = 1.0;
    float rr = length(d);
    float life = pow(max(sin(t * (0.25 + 0.3 * h3) + h2 * 50.0), 0.0), 2.0);
    float i = (exp(-rr * rr / (r * r) * 3.0) + exp(-rr / (r * 0.5)) * 0.14) * life;
    return vec4(mix(RS_AMBER, vec3(1.0, 0.82, 0.55), 0.3 * h3), i);
  }
  float tilt = t * (0.5 + 1.2 * h3) + h4 * 40.0;
  float an = t * 0.3 * (h2 - 0.5) + h * 30.0;
  vec2 e = vec2(cos(an) * d.x + sin(an) * d.y, -sin(an) * d.x + cos(an) * d.y);
  e = vec2(e.x / (r * (0.25 + 0.75 * abs(cos(tilt)))), e.y / (r * 0.85));
  float cov = 1.0 - smoothstep(0.65, 1.0, length(e));
  float glint = pow(abs(cos(tilt)), 14.0);
  vec3 col = vec3(0.075, 0.062, 0.058) + (RS_AMBER * 0.62 + RS_BONE * 0.28) * att * (0.55 + 1.9 * glint);
  return vec4(col, cov * 0.78);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  float px = 1.0 / res.y;
  vec2 pm = vec2(mpx.x / res.x * asp, mpx.y / res.y);

  vec3 base = wall(uv);
  float lum0 = rs_luma(base);
  vec2 o = vec2(14.0 / res.x, 14.0 / res.y);
  float lumA = lum0 * 0.36 + 0.16 * (rs_luma(wall(uv + o)) + rs_luma(wall(uv - o)) + rs_luma(wall(uv + vec2(o.x, -o.y))) + rs_luma(wall(uv + vec2(-o.x, o.y))));
  float dark = 1.0 - smoothstep(0.20, 0.75, lumA);

  // ---- the candle: a low flame below the frame, breathing irregularly
  float flick = rs_flick(t);
  float breath = 0.80 + 0.20 * sin(t * 0.7 + 1.3 * sin(t * 0.23)) + 0.08 * (rs_noise(vec2(t * 1.3, 8.0)) - 0.5);
  vec2 cp = vec2(0.40 * asp + 0.05 * sin(t * 0.11), 1.06 + 0.02 * sin(t * 0.37));
  vec2 dcp = p - cp;
  float pool = 1.0 / (1.0 + dot(dcp, dcp) / (0.34 * breath)) * flick;

  vec3 col = base;

  // ---- oxblood tide: rises from the bottom through the dark parts and goes down again, about 7 s
  float ph = 0.5 - 0.5 * cos(6.2831853 * t / 7.0);
  ph = ph * ph * (3.0 - 2.0 * ph);
  float nz = rs_fbm(p * 1.6 + vec2(t * 0.015, 3.0));
  float tideY = 1.38 - ph * 1.15;
  float I = smoothstep(tideY - 0.28, tideY + 0.10, uv.y + (nz - 0.5) * 0.55);
  float key = 1.0 - smoothstep(0.05, 0.42, lumA);
  float oxm = I * key;
  col = mix(col, col * vec3(1.50, 0.58, 0.60) + vec3(0.11, 0.004, 0.011), oxm * 0.52);
  col += RS_CRIMSON * 0.05 * ph * oxm * oxm * (0.4 + 0.6 * nz);

  // ---- candle pool on the picture itself: warm, soft, mostly in the lower half
  col *= 1.0 + vec3(0.20, 0.09, 0.0) * pool * 0.45;
  col += RS_AMBER * pool * 0.035 * (0.4 + dark);

  // ---- brass engraving, only where the picture is dark
  float gate = 0.08 + 0.92 * dark;
  vec2 pn = rs_panel(p, t, px);
  float lat = rs_lattice(p, t, px);
  float lineGain = (0.22 + 1.5 * pool) * gate;
  vec3 brass = mix(RS_BRASS, RS_BONE, clamp(pn.y * 0.8, 0.0, 1.0));
  vec3 add = brass * (pn.x * 0.50 + lat * 0.20) * lineGain;
  // the lines pick up the flame's warmth and sparkle a little where it is strongest
  add += RS_AMBER * pn.x * 0.06 * pool * gate;

  // ---- chains: four, at different depths; the far ones are smaller, dimmer and sway less
  float cam = sin(t * 0.045) * 0.9 + 0.3 * sin(t * 0.11 + 1.0);
  vec4 ch = vec4(0.0);
  ch = rs_over(ch, rs_chain(p, 1, 0.0, 0.27 * asp, 0.40, 0.20, 0.31, cp, flick, pm, cam));
  ch = rs_over(ch, rs_chain(p, 0, 0.0, 0.71 * asp, 0.52, 0.55, 0.62, cp, flick, pm, cam));
  ch = rs_over(ch, rs_chain(p, 2, 0.0, 0.945 * asp, 0.76, 0.88, 0.14, cp, flick, pm, cam));
  ch = rs_over(ch, rs_chain(p, 0, 1.0, 0.055 * asp, 0.66, 1.00, 0.83, cp, flick, pm, cam));

  // ---- put it together: light is added the way light is, with a soft shoulder so bright pictures do not clip
  col = 1.0 - (1.0 - col) * (1.0 - clamp(add, 0.0, 0.9));
  col = col * (1.0 - ch.a) + ch.rgb;

  // ---- ash in two depths; embers shine by their own light
  float em0, em1;
  vec4 a0 = rs_ash(p, 15.0, vec2(0.004, 0.011), 0.46, 0.060, 1.0, cp, flick, em0);
  vec4 a1 = rs_ash(p + 0.23, 7.0, vec2(-0.006, 0.020), 0.34, 0.075, 2.0, cp, flick, em1);
  col = mix(col, a0.rgb, a0.a * (1.0 - em0) * 0.7);
  col += a0.rgb * a0.a * em0 * 0.85;
  col = mix(col, a1.rgb, a1.a * (1.0 - em1));
  col += a1.rgb * a1.a * em1 * 1.0;

  return vec4(clamp(col, 0.0, 1.0), 1.0) * qt_Opacity;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored, above 1 = exaggerated
void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
