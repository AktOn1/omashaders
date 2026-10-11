// label: Wisp wood
// hint: an enchanted night forest: ranks of trees in teal fog, glowing wisps that drift and gather round the pointer
// category: Fantasy realms
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
float ww_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ww_h1(float n) { return fract(sin(n * 127.1 + 17.3) * 43758.5453); }
float ww_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ww_hash(i), ww_hash(i + vec2(1, 0)), f.x), mix(ww_hash(i + vec2(0, 1)), ww_hash(i + vec2(1, 1)), f.x), f.y);
}
float ww_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * ww_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

// one rank of tree trunks: returns coverage 0..1 (cells along x, a trunk in most of them, leaning, tapered a little)
float ww_trunks(vec2 p, float scale, float seed, float gap) {
  float x = p.x * scale + seed * 7.0;
  float id = floor(x), f = fract(x);
  float h = ww_hash(vec2(id, seed));
  if (h < gap) return 0.0;
  float cx = 0.5 + (ww_hash(vec2(id * 1.7, seed + 3.0)) - 0.5) * 0.45;
  float lean = sin(p.y * 2.2 + id * 1.3 + seed) * 0.035 + (p.y - 0.5) * (ww_hash(vec2(id, seed + 9.0)) - 0.5) * 0.18;
  float w = (0.045 + 0.055 * ww_hash(vec2(id, seed + 5.0))) * (0.75 + 0.55 * p.y);
  float d = abs(f - cx - lean);
  // bark: faint vertical grain
  float bark = 0.85 + 0.15 * ww_noise(vec2(f * 40.0 + id * 5.0, p.y * 6.0));
  return smoothstep(w, w * 0.8, d) * bark;
}

// a wisp: soft cold light with a bright core
vec3 ww_wisp(vec2 p, vec2 c, float size, vec3 tint, float pulse) {
  vec2 d = p - c;
  float r2 = dot(d, d);
  float g = size * size / (r2 + size * size);
  float core = exp(-r2 / (size * size * 0.06));
  return tint * (g * g * 0.55 + core * 0.9) * pulse;
}

vec2 ww_pos(int i, float t, vec2 mp, float asp, float near) {
  float fi = float(i);
  float a = ww_h1(fi), b = ww_h1(fi + 11.0), c = ww_h1(fi + 23.0), d = ww_h1(fi + 37.0);
  vec2 base = vec2((0.08 + 0.84 * a) * asp, 0.28 + 0.52 * b);
  vec2 q = base + vec2(sin(t * (0.10 + 0.12 * c) + fi * 2.1) * 0.20, sin(t * (0.13 + 0.10 * d) + fi * 4.3) * 0.09 + cos(t * 0.07 + fi) * 0.04);
  // the pointer draws the wisps closer; a few circle round it
  vec2 dm = mp - q;
  float pull = exp(-dot(dm, dm) / 0.5) * near;
  float orbitR = 0.05 + 0.07 * a;
  vec2 orbit = mp + orbitR * vec2(cos(t * (0.6 + c) + fi * 1.7), sin(t * (0.6 + c) + fi * 1.7) * 0.75);
  return mix(q, orbit, pull * 0.8);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  float near = (m.x > -1.0 && m.x < 2.0 && m.y > -1.0 && m.y < 2.0) ? 1.0 : 0.0;
  float t = time;
  float par = near > 0.5 ? (m.x - 0.5) : 0.0;          // parallax: the forest slides a little with the pointer

  vec3 pic = wall(uv);
  float pl = dot(pic, vec3(0.30, 0.59, 0.11));
  // night: deep blue-green, a pale glade glow behind the trees, the picture only a ghost
  vec3 col = mix(vec3(0.022, 0.060, 0.090), vec3(0.050, 0.165, 0.175), smoothstep(0.95, 0.15, uv.y));
  float glade = exp(-dot((p - vec2(0.5 * asp, 0.55)) * vec2(0.7, 1.4), (p - vec2(0.5 * asp, 0.55)) * vec2(0.7, 1.4)) * 3.0);
  col += vec3(0.10, 0.26, 0.24) * glade;
  col = mix(col, col * 0.4 + pic * vec3(0.10, 0.24, 0.26) + vec3(0.0, 0.01, 0.015), 0.5);

  // wisp light field (computed first so the fog and trunks can catch it)
  vec3 wl = vec3(0.0);
  vec3 wispsA = vec3(0.0);
  for (int i = 0; i < 14; i++) {
    vec2 wp = ww_pos(i, t, mp, asp, near);
    float fi = float(i);
    float pulse = 0.65 + 0.35 * sin(t * (0.5 + 0.6 * ww_h1(fi + 3.0)) + fi * 3.0);
    vec3 tint = (ww_h1(fi + 50.0) < 0.28) ? vec3(1.0, 0.82, 0.42) : (ww_h1(fi + 51.0) < 0.5 ? vec3(0.45, 1.0, 0.85) : vec3(0.40, 0.85, 1.0));
    float sz = 0.016 + 0.016 * ww_h1(fi + 7.0);
    wispsA += ww_wisp(p, wp, sz, tint, pulse);
    // wide light cast on fog and trunks
    vec2 dd = p - wp;
    wl += tint * pulse * 0.075 / (dot(dd, dd) * 28.0 + 1.0);
  }

  // the forest: four ranks from far to near, a fog bank between each
  for (int l = 0; l < 4; l++) {
    float fl = float(l);
    float depth = fl / 3.0;                         // 0 far .. 1 near
    vec2 pq = vec2(p.x + par * (0.02 + 0.07 * depth), p.y);
    float scale = mix(7.5, 2.1, depth);
    float tr = ww_trunks(pq, scale, fl + 1.0, mix(0.30, 0.55, depth));
    // fog before this rank: pale teal, thicker low down, drifting
    float fog = ww_fbm(vec2(p.x * (1.2 + fl * 0.3) - t * (0.012 + 0.01 * fl) + fl * 9.0, p.y * 3.5 + fl * 4.0));
    fog = smoothstep(0.35, 0.80, fog) * (0.35 + 0.65 * smoothstep(0.2, 0.95, uv.y));
    vec3 fogCol = vec3(0.07, 0.20, 0.22) * (1.15 - 0.4 * depth);
    col = mix(col, fogCol + wl * 0.8, fog * (0.26 + 0.10 * (1.0 - depth)));
    // trunk colour: far = pale blue-green silhouette, near = almost black; lit edges from the wisps
    vec3 trunk = mix(vec3(0.07, 0.17, 0.19), vec3(0.008, 0.020, 0.026), depth);
    trunk += wl * (0.5 + 0.5 * depth) * 0.9;
    col = mix(col, trunk, tr * 0.96);
  }

  // canopy: leaf clumps across the top, dark, with the glow of the sky showing through the gaps
  float leaf = ww_fbm(p * vec2(5.0, 9.0) + vec2(par * 0.3, 3.0));
  float edge = 0.03 + 0.12 * ww_noise(vec2(p.x * 2.5, 2.0));
  float canopy = smoothstep(edge + 0.08 * leaf, edge - 0.10 + 0.08 * leaf, uv.y - 0.06 * leaf) ;
  canopy *= smoothstep(0.34, 0.50, leaf + (0.35 - uv.y) * 0.9);
  col = mix(col, vec3(0.004, 0.012, 0.016) + wl * 0.4, clamp(canopy, 0.0, 1.0) * 0.92);

  // forest floor: a dark rise with glowing mushrooms and clover
  float gh = 0.90 - 0.035 * ww_noise(vec2(p.x * 3.0, 1.0)) - 0.02 * ww_noise(vec2(p.x * 9.0, 4.0));
  float ground = smoothstep(gh, gh + 0.012, uv.y);
  col = mix(col, vec3(0.004, 0.015, 0.014) + wl * 0.5, ground);
  vec2 mq = vec2(p.x * 26.0, (uv.y - gh) * 40.0);
  vec2 mid = vec2(floor(mq.x), 0.0), mf = vec2(fract(mq.x) - 0.5, mq.y);
  float mh = ww_hash(mid + 3.0);
  if (mh > 0.55) {
    float mo = (ww_hash(mid + 7.0) - 0.5) * 0.5;
    float mr = 0.9 + 1.4 * ww_hash(mid + 1.0);
    float cap = smoothstep(0.35, 0.0, length(vec2((mf.x - mo) * 1.0, (mf.y - 0.3 - 0.5 * mr) * 1.3 / mr)));
    float tw = 0.7 + 0.3 * sin(t * (0.4 + mh) + mh * 30.0);
    col += mix(vec3(0.2, 0.9, 0.8), vec3(0.6, 0.5, 1.0), step(0.8, mh)) * cap * ground * 0.45 * tw;
  }

  // the wisps themselves, bright over everything but the nearest foreground
  col += wispsA * 0.9;
  col += wl * 0.18;

  // the pointer: a gentle cold glow, so you can tell where you are
  vec2 dp = p - mp;
  col += vec3(0.25, 0.65, 0.6) * 0.07 * exp(-dot(dp, dp) / 0.012) * near;

  col *= 1.0 - 0.55 * pow(length((uv - 0.5) * vec2(1.0, 1.15)), 2.4);
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
