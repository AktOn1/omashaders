// label: Dread creep
// hint: darkness crawls in from the corners as slow veins and beats like a heart, a tube light stutters, ash drifts in the lit spots, pale eyes open in the dark and close when the pointer comes near
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

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales

float dc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dc_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dc_hash(i), dc_hash(i + vec2(1, 0)), f.x), mix(dc_hash(i + vec2(0, 1)), dc_hash(i + vec2(1, 1)), f.x), f.y);
}
float dc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float dc_bump(float x, float a, float b) { return smoothstep(a, a + 0.03, x) * (1.0 - smoothstep(b - 0.04, b, x)); }

const vec3 DC_BONE = vec3(0.86, 0.90, 0.80);
const vec3 DC_EYE = vec3(0.80, 0.97, 0.86);
const vec3 DC_BLOOD = vec3(0.34, 0.015, 0.025);

// one depth of ash: a cell holds at most one mote; it only shows where the picture itself is bright there
vec4 dc_ash(vec2 p, float asp, float scale, float speed, float density, float rad, float seed) {
  float t = time;
  vec2 off = vec2(0.0, -t * speed);
  vec2 q = p * scale + off;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 k = id + seed * 7.3;
  float h = dc_hash(k);
  if (h > density) return vec4(0.0);
  float h2 = dc_hash(k + 17.3), h3 = dc_hash(k + 41.7), h4 = dc_hash(k + 73.1);
  vec2 c = (vec2(h2, h3) - 0.5) * 0.4;
  c += 0.12 * vec2(sin(t * 0.31 * (0.6 + h2) + h4 * 6.28), cos(t * 0.23 * (0.6 + h3) + h2 * 6.28));
  vec2 pc = (id + 0.5 + c - off) / scale;
  vec2 uvc = vec2(pc.x / asp, pc.y);
  if (uvc.x < 0.0 || uvc.x > 1.0 || uvc.y < 0.0 || uvc.y > 1.0) return vec4(0.0);
  float lum = dc_luma(wall(uvc)) * 0.65 + dc_luma(wall(clamp(uvc + vec2(0.04, -0.05), 0.0, 1.0))) * 0.35;
  float catchL = smoothstep(0.22, 0.65, lum);
  vec2 d = f - c;
  float r = rad * (0.5 + 0.9 * h4);
  float rr = length(d);
  float tw = 0.55 + 0.45 * sin(t * (0.5 + 1.5 * h3) + h * 50.0);
  float i = (exp(-(rr * rr) / (r * r) * 3.0) + exp(-rr / (r * 0.4)) * 0.12) * tw * catchL;
  return vec4(DC_BONE, i);
}

// a pair of pale eyes living in the dark. returns glow rgb; `gate` is how much the dark allows them, `shy` how far the pointer is
vec3 dc_eyes(vec2 p, float asp, float shy) {
  float t = time;
  float cell = 0.34;
  vec2 q = p / cell;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = dc_hash(id + 3.7);
  float L = 17.0 + 11.0 * dc_hash(id + 9.1);               // every cell lives on its own long cycle
  float tt = t + h * L;
  float slot = floor(tt / L);
  float u = fract(tt / L);
  vec2 k = id + slot * 13.7;
  float exist = step(dc_hash(k + 5.5), 0.55);
  vec2 c = (vec2(dc_hash(k + 1.3), dc_hash(k + 2.9)) - 0.5) * 0.62;
  vec2 pcen = (id + 0.5 + c) * cell;
  vec2 uvc = vec2(pcen.x / asp, pcen.y);
  if (uvc.x < 0.02 || uvc.x > 0.98 || uvc.y < 0.03 || uvc.y > 0.97) return vec3(0.0);
  float lum = dc_luma(wall(uvc));
  vec2 s = (uvc - 0.5) * 2.0;
  float e = pow(pow(abs(s.x), 3.0) + pow(abs(s.y), 3.0), 0.3333);
  float gate = smoothstep(0.36, 0.11, lum) * (0.30 + 0.70 * smoothstep(0.50, 0.95, e));
  // open slowly, blink now and then, then close slowly and stay shut
  float openv = smoothstep(0.02, 0.22, u) * (1.0 - smoothstep(0.62, 0.95, u));
  float b1 = 0.30 + 0.12 * dc_hash(k + 8.1), b2 = 0.52 + 0.08 * dc_hash(k + 6.4);
  float blink = 1.0 - exp(-pow((u - b1) / 0.007, 2.0)) - 0.8 * exp(-pow((u - b2) / 0.007, 2.0));
  float vis = exist * openv * clamp(blink, 0.0, 1.0) * gate * shy;
  if (vis < 0.003) return vec3(0.0);
  float sep = 0.020 + 0.014 * dc_hash(k + 4.4);
  float sz = 0.0058 + 0.0034 * dc_hash(k + 11.9);
  vec2 d = p - pcen;
  float tilt = (dc_hash(k + 2.2) - 0.5) * 0.5;
  d = vec2(d.x + d.y * tilt, d.y - d.x * tilt);
  vec2 dl = d + vec2(sep, 0.0), dr = d - vec2(sep, 0.0);
  float hy = 0.45 * (0.35 + 0.65 * vis / max(exist * gate * shy, 0.001)); // slits narrow as the lid closes
  float el = length(vec2(dl.x / sz, dl.y / (sz * hy)));
  float er = length(vec2(dr.x / sz, dr.y / (sz * hy)));
  float core = exp(-el * el * 1.6) + exp(-er * er * 1.6);
  float halo = exp(-length(dl) / (sz * 3.2)) + exp(-length(dr) / (sz * 3.2));
  return DC_EYE * (core * 0.80 + halo * 0.16) * vis;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;

  vec3 base = wall(uv);
  float lum0 = dc_luma(base);

  // ---- the pointer: eyes shy away from it (range sets how far)
  vec2 pm = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  float dm = length(p - pm);
  float rr = 0.20 + 0.34 * range;
  float shy = smoothstep(rr * 0.35, rr, dm);

  // ---- heartbeat: two beats, then a rest
  float ph = fract(t / 4.2);
  float beat = exp(-pow((ph - 0.04) / 0.022, 2.0)) + 0.72 * exp(-pow((ph - 0.165) / 0.026, 2.0));
  float swell = exp(-pow((ph - 0.07) / 0.09, 2.0)) * 0.6 + exp(-pow((ph - 0.19) / 0.08, 2.0)) * 0.4;

  // ---- creeping darkness: a rounded-square distance to the edge, bent by a warped noise; thin threads and shadowy fingers
  // follow ridges of a noise that is stretched along the radius (seamless around the centre), so they reach inward like roots
  vec2 s = (uv - 0.5) * 2.0;
  float e = pow(pow(abs(s.x), 3.0) + pow(abs(s.y), 3.0), 0.3333);
  vec2 pq = p * 1.15;
  vec2 w = vec2(dc_noise(pq * 1.6 + vec2(t * 0.020, 3.1)), dc_noise(pq * 1.6 + vec2(8.7, -t * 0.017))) - 0.5;
  vec2 pw = pq + w * 0.95;
  float n1 = dc_noise(pw * 2.4 + vec2(0.0, t * 0.012)) * 0.6 + dc_noise(pw * 5.0 - vec2(t * 0.02, 0.0)) * 0.28 + dc_noise(pw * 10.0 + 4.0) * 0.12;
  vec2 dir = s / (length(s) + 0.001);
  dir += w * 0.7;                                               // crooked, never a straight spoke
  float rad = length(s);
  float tn = dc_noise(dir * 3.2 + vec2(rad * 0.50 + t * 0.014, rad * 0.30 - t * 0.011)) * 0.62
           + dc_noise(dir * 6.5 + vec2(rad * 0.8 - t * 0.02, 5.0 - rad * 0.45)) * 0.38;
  float vr = 1.0 - abs(2.0 * tn - 1.0);
  float sector = smoothstep(0.40, 0.70, dc_noise(dir * 1.7 + vec2(7.0 + t * 0.01, 2.0)));   // roots gather in some places only
  float reach = 0.85 - 0.05 * sin(t * 0.05) - 0.04 * (0.5 + 0.5 * sin(t * 0.021 + 1.0)) - 0.055 * swell;
  float fb = e + (n1 - 0.45) * 0.42;
  float Db = smoothstep(reach, reach + 0.34, fb);
  float near = smoothstep(reach - 0.17, reach + 0.08, fb);
  float Dt = pow(vr, mix(14.0, 7.0, near)) * near * (0.35 + 0.65 * sector);   // thin and taut inside, thick at the root
  float Df = pow(vr, 4.0) * smoothstep(reach - 0.14, reach + 0.06, fb) * (0.3 + 0.7 * sector);
  float D = max(Db * 0.80, max(Dt * 0.80, Df * 0.55));
  float core = Dt * Dt * (1.0 - Db * 0.5);

  // ---- tube light: a short stutter that lifts the picture's own bright spots, then drops it darker
  float per = 11.0;
  float slot = floor(t / per);
  float x = t - slot * per - (2.0 + 6.0 * dc_hash(vec2(slot, 4.0)));
  float fk = dc_bump(x, 0.0, 0.11) * 0.65 + dc_bump(x, 0.30, 0.52);
  float dip = smoothstep(0.50, 0.58, x) * (1.0 - smoothstep(0.58, 1.9, x));
  fk *= step(0.0, x);
  dip *= step(0.0, x);

  D = clamp(D * (1.0 - 0.40 * fk + 0.35 * dip), 0.0, 0.92);       // the mass shrinks from the light, then lunges back

  // ---- grade: cold green-grey, crushed, mostly inside the dark
  vec3 col = base;
  vec3 cold = vec3(lum0) * vec3(0.78, 1.0, 0.90) + vec3(0.0, 0.010, 0.008);
  col = mix(col, cold, 0.10 + 0.70 * D);
  col *= 1.0 - D * (0.84 - 0.20 * swell);
  col = max(col - 0.016 * D, 0.0);
  col *= 1.0 - 0.34 * dip;
  col += DC_BONE * smoothstep(0.18, 0.80, lum0) * fk * 0.42 * (1.0 - 0.5 * D);
  col *= 1.0 + 0.30 * fk * smoothstep(0.1, 0.6, lum0);
  // dried blood in the veins, a pulse at each beat
  col += DC_BLOOD * core * (0.18 + 0.60 * beat) * 0.55;

  // ---- ash in two depths, then the eyes
  vec3 add = vec3(0.0);
  vec4 a0 = dc_ash(p, asp, 7.0, 0.020, 0.62, 0.085, 1.0);
  vec4 a1 = dc_ash(p + 0.31, asp, 13.0, 0.045, 0.55, 0.065, 2.0);
  add += a0.rgb * a0.a * 0.55 * (1.0 - 0.5 * D);
  add += a1.rgb * a1.a * 0.85 * (1.0 - 0.5 * D);
  add += dc_eyes(p, asp, shy);

  col = 1.0 - (1.0 - col) * (1.0 - clamp(add, 0.0, 0.92));
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
