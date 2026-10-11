// label: Soul river
// hint: the river of the dead in a cold cavern: pale souls drift up the dark water with long tails, a ferryman's lantern crosses far off, the pointer draws the souls and stirs rings
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
float sr_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sr_h1(float n) { return fract(sin(n * 127.1 + 17.3) * 43758.5453); }
float sr_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sr_hash(i), sr_hash(i + vec2(1, 0)), f.x), mix(sr_hash(i + vec2(0, 1)), sr_hash(i + vec2(1, 1)), f.x), f.y);
}
float sr_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sr_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

vec3 sr_soulPos(int i, float t, vec2 mp, float near, float asp, out float spd) {
  float fi = float(i);
  float a = sr_h1(fi + 1.0), b = sr_h1(fi + 9.0), c = sr_h1(fi + 21.0);
  spd = 0.020 + 0.030 * c;
  float span = asp + 0.5;
  float x = fract(t * spd + a * 3.0) * span - 0.25;
  float y = 0.50 + 0.38 * b * b + sin(t * (0.2 + 0.2 * c) + fi * 2.0) * 0.025;
  // drawn to the pointer when it is near: the souls turn aside toward it
  vec2 dm = mp - vec2(x, y);
  float pull = near * exp(-dot(dm, dm) / 0.07);
  vec2 q = vec2(x, y) + dm * pull * 0.45;
  return vec3(q, 0.7 + 0.3 * sin(t * 0.8 + fi * 5.0) + pull);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  float near = (m.x > -1.0 && m.x < 2.0 && m.y > -1.0 && m.y < 2.0) ? 1.0 : 0.0;
  float t = time;
  vec3 pic = wall(uv);
  float HZ = 0.46;

  // cavern: near-black blue-green, a pale cold glow low on the far side of the river
  vec3 col = mix(vec3(0.004, 0.010, 0.016), vec3(0.020, 0.052, 0.062), smoothstep(0.0, HZ, uv.y));
  col += pic * vec3(0.012, 0.025, 0.030);
  float glow = exp(-pow((uv.y - HZ + 0.03) / 0.10, 2.0)) * exp(-pow((p.x - 0.58 * asp) / 0.55, 2.0));
  col += vec3(0.25, 0.55, 0.52) * glow * 0.45;
  // the distant gate: a tall pale arch of light in the far shore
  vec2 gd = p - vec2(0.58 * asp, HZ - 0.09);
  float gate = smoothstep(0.003, -0.003, max(abs(gd.x) - 0.030 + max(gd.y + 0.06, 0.0) * 0.0 - (gd.y < -0.05 ? length(vec2(gd.x, gd.y + 0.05)) - 0.030 + abs(gd.x) : 0.0), gd.y - 0.09));
  col += vec3(0.55, 0.85, 0.80) * gate * 0.35 * (0.8 + 0.2 * sin(t * 0.7));
  // ceiling teeth
  float tooth = pow(sr_noise(vec2(p.x * 4.5, 1.0)), 2.0) * 0.26 + 0.03 * sr_noise(vec2(p.x * 15.0, 7.0));
  col = mix(col, vec3(0.002, 0.005, 0.008), smoothstep(tooth + 0.01, tooth - 0.015, uv.y));

  // the far shore: broken columns and ragged rock against the glow
  float shore = HZ - 0.02 - 0.035 * sr_noise(vec2(p.x * 3.0, 2.0)) - 0.02 * sr_noise(vec2(p.x * 9.0, 4.0));
  float cx = p.x * 11.0;
  float cid = floor(cx), cf = fract(cx) - 0.5;
  float ch = sr_hash(vec2(cid, 3.0));
  float colH = (ch > 0.62) ? 0.04 + 0.16 * sr_hash(vec2(cid, 5.0)) : 0.0;
  float column = smoothstep(0.17, 0.15, abs(cf)) * step(shore - colH - 0.01 * sr_noise(vec2(p.x * 40.0, 1.0)), uv.y) * step(uv.y, HZ);
  float rockM = step(shore, uv.y);
  col = mix(col, vec3(0.004, 0.012, 0.014), max(column, rockM * step(uv.y, HZ + 0.002)));

  // the river: dark glass, a slow current to the right, glints where it catches the cold light
  float below = uv.y - HZ;
  if (below > 0.0) {
    float dp = below / (1.0 - HZ);                           // 0 at the far shore, 1 at the bottom
    float persp = 0.35 + 2.2 * dp;
    vec2 wq = vec2(p.x * 3.0 / persp - t * 0.06, dp * 14.0 / (0.4 + dp));
    float w1 = sr_fbm(wq * vec2(1.0, 1.0));
    float w2 = sr_noise(vec2(wq.x * 3.0 + 7.0, wq.y * 6.0));
    vec3 water = mix(vec3(0.010, 0.030, 0.038), vec3(0.020, 0.060, 0.070), w1);
    water += vec3(0.35, 0.65, 0.62) * pow(smoothstep(0.55, 0.9, w2 * w1 * 1.8), 2.0) * 0.22 * (0.3 + dp);
    water += vec3(0.20, 0.45, 0.45) * glow * 0.35 * (0.5 + 0.5 * w1);
    // pointer: slow rings on the river surface
    vec2 dd = (p - mp) * vec2(1.0, 2.0);
    float r = length(dd);
    float ring = near * smoothstep(0.012, 0.0, abs(fract(r * 11.0 - t * 0.35) - 0.5) - 0.40) * exp(-r * 4.0);
    water += vec3(0.5, 0.85, 0.8) * ring * 0.25;
    col = mix(col, water, smoothstep(0.0, 0.004, below));
  }

  // Charon's boat: a low hull and a bent figure with a lantern, crossing very slowly
  float bx = mod(t * 0.007 + 0.15, 1.2) * asp - 0.1;
  vec2 bd = p - vec2(bx, HZ + 0.03);
  float hull = smoothstep(0.003, 0.0, bd.y - 0.012 * (1.0 - bd.x * bd.x / 0.0016)) * step(-0.04, bd.x) * step(bd.x, 0.04) * step(-0.004, bd.y) * 0.0;
  float hullM = step(abs(bd.x), 0.035 - bd.y * 1.5) * step(-0.002, bd.y) * step(bd.y, 0.010);
  float fig = smoothstep(0.006, 0.003, abs(bd.x + 0.008) - 0.003 * (1.0 + (-bd.y) * 12.0)) * step(-0.034, bd.y) * step(bd.y, 0.0);
  float pole = smoothstep(0.0012, 0.0004, abs(bd.x - 0.020 + bd.y * 0.1)) * step(-0.045, bd.y) * step(bd.y, 0.0);
  col = mix(col, vec3(0.002, 0.006, 0.008), max(hullM, max(fig, pole)));
  vec2 ld = p - vec2(bx + 0.03, HZ + 0.013);
  col += vec3(0.60, 0.95, 0.75) * (exp(-dot(ld, ld) / 0.00004) * 0.9 + exp(-dot(ld, ld) / 0.0010) * 0.18);
  vec2 lr = (p - vec2(bx + 0.03, HZ + 0.06)) * vec2(1.0, 0.18);
  col += vec3(0.30, 0.65, 0.5) * exp(-dot(lr, lr) / 0.0008) * 0.18 * step(HZ, uv.y);

  // the souls: pale lights drifting up the river with long fading tails and soft reflections
  for (int i = 0; i < 16; i++) {
    float spd;
    vec3 s = sr_soulPos(i, t, mp, near, asp, spd);
    vec2 d = p - s.xy;
    float fi = float(i);
    // tail trails behind (to the left); it narrows and wavers
    float tl = -d.x / (0.10 + 0.10 * sr_h1(fi + 3.0));
    float wav = sin(d.x * 60.0 + t * 3.0 + fi) * 0.003 * clamp(tl, 0.0, 3.0);
    float tail = (tl > 0.0) ? exp(-tl * 1.5) * exp(-pow((d.y + wav) / (0.014 * exp(-tl * 0.8) + 0.002), 2.0)) : 0.0;
    float head = exp(-dot(d, d) / 0.00012) + 0.25 * exp(-dot(d, d) / 0.0016);
    vec3 tint = (sr_h1(fi + 31.0) < 0.2) ? vec3(0.75, 0.65, 1.0) : mix(vec3(0.55, 1.0, 0.85), vec3(0.75, 0.95, 1.0), sr_h1(fi + 4.0));
    col += tint * (head * 0.9 + tail * 0.55) * s.z;
    // reflection in the water: a smeared vertical streak below it
    vec2 rd = vec2(d.x * 1.0, d.y - 0.07 - 0.10 * (s.y - HZ));
    float refl = exp(-pow(rd.x / 0.03, 2.0)) * exp(-pow(rd.y / 0.07, 2.0)) * (0.7 + 0.3 * sin(p.y * 220.0 + t * 2.0 + fi));
    col += tint * refl * 0.14 * s.z * step(HZ, uv.y) * smoothstep(HZ, HZ + 0.05, uv.y);
  }

  // faint mist along the water line
  float mist = sr_fbm(vec2(p.x * 1.4 - t * 0.01, p.y * 6.0));
  col += vec3(0.10, 0.22, 0.22) * smoothstep(0.4, 0.8, mist) * exp(-pow((uv.y - HZ - 0.02) / 0.07, 2.0)) * 0.5;

  col *= 1.0 - 0.6 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
