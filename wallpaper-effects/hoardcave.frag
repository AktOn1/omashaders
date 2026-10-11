// label: Dragon hoard
// hint: a cavern filled with a dragon's gold: glinting coins and gems, slit eyes in the dark that wake when the pointer comes near, the pointer is your torch
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
float hc_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hc_h1(float n) { return fract(sin(n * 127.1 + 17.3) * 43758.5453); }
float hc_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hc_hash(i), hc_hash(i + vec2(1, 0)), f.x), mix(hc_hash(i + vec2(0, 1)), hc_hash(i + vec2(1, 1)), f.x), f.y);
}
float hc_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * hc_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

float hc_heap(float x) {
  return 0.86 - 0.12 * hc_noise(vec2(x * 1.1, 1.0)) - 0.05 * hc_noise(vec2(x * 3.7, 5.0)) - 0.17 * exp(-pow((x - 0.35) / 0.45, 2.0)) - 0.10 * exp(-pow((x - 1.45) / 0.30, 2.0)) - 0.012 * hc_noise(vec2(x * 11.0, 2.0));
}

// one layer of coins: every cell holds one disc with its own tilt, rotation and brightness; rgb + coverage in .a, glint in g
vec4 hc_layer(vec2 q, float lit, float t, float sd, out float glint) {
  vec2 id = floor(q), f = fract(q) - 0.5;
  float h = hc_hash(id + sd), h2 = hc_hash(id + sd + 7.7), h3 = hc_hash(id + sd + 3.3);
  f += (vec2(hc_hash(id + sd + 1.1), hc_hash(id + sd + 2.2)) - 0.5) * 0.18;
  float ang = h3 * 6.2832;
  vec2 e = vec2(cos(ang) * f.x + sin(ang) * f.y, -sin(ang) * f.x + cos(ang) * f.y);
  e.y *= 1.0 + 1.6 * h;                                         // tilted discs look like ellipses
  float rr = 0.40 + 0.08 * h2;
  float d = length(e);
  float disc = smoothstep(rr, rr - 0.08, d);
  float rim = smoothstep(rr - 0.22, rr - 0.04, d) * disc;
  vec3 gold = mix(vec3(0.50, 0.26, 0.04), vec3(1.0, 0.76, 0.22), h2 * h2 + 0.2 * h);
  float shade = 0.5 + 0.5 * dot(normalize(e + vec2(0.001)), normalize(vec2(-0.6, -0.8)));
  vec3 c = gold * (0.30 + 0.70 * mix(0.55, 1.0, shade) * lit);
  c += vec3(1.0, 0.85, 0.5) * rim * (0.20 + 0.25 * shade) * lit;
  c *= 0.45 + 0.55 * smoothstep(0.0, 0.5, rr - d);
  if (h > 0.988) {
    vec3 gem = (h3 < 0.33) ? vec3(0.95, 0.1, 0.2) : (h3 < 0.66 ? vec3(0.1, 0.85, 0.5) : vec3(0.3, 0.5, 1.0));
    float gd = smoothstep(0.26, 0.14, length(f));
    c = mix(c, gem * (0.45 + 0.9 * lit), gd);
  }
  float tw = pow(max(0.0, sin(t * (0.5 + 1.4 * h2) + h * 60.0)), 20.0);
  float cross = smoothstep(0.05, 0.0, min(abs(f.x), abs(f.y))) * smoothstep(0.5, 0.05, length(f));
  glint = (h2 > 0.6 ? 1.0 : 0.0) * tw * (cross * 0.8 + smoothstep(0.10, 0.0, length(f)));
  return vec4(c, disc);
}

// the heap: two overlapping layers of coins, bigger toward the bottom of the screen
vec4 hc_coins(vec2 p, float hy, float lit, float t) {
  float sc = 30.0;
  vec2 q = vec2(p.x, p.y * 1.25) * sc;
  float g1, g2;
  vec4 back = hc_layer(q + vec2(0.5, 0.5), lit * 0.55, t, 5.0, g1);
  vec4 front = hc_layer(q, lit, t, 0.0, g2);
  vec3 c = vec3(0.10, 0.05, 0.015) * lit;
  c = mix(c, back.rgb, back.a);
  c = mix(c, front.rgb, front.a);
  return vec4(c, g2 * front.a + g1 * back.a * 0.5);
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

  // cave: dark red-brown rock, lit from below by the hoard
  float rock = hc_fbm(p * vec2(3.0, 4.0) + 3.0);
  float rock2 = hc_noise(p * vec2(14.0, 18.0));
  vec3 col = mix(vec3(0.020, 0.010, 0.010), vec3(0.085, 0.040, 0.025), rock) * (0.8 + 0.4 * rock2);
  col += pic * vec3(0.05, 0.03, 0.02);
  float up = smoothstep(0.1, 1.0, uv.y);
  col += vec3(0.30, 0.13, 0.03) * pow(up, 2.2) * (0.5 + 0.7 * rock);       // warm gold glow rising from the heap
  // stalactites hang from the ceiling
  float tooth = pow(hc_noise(vec2(p.x * 5.5, 3.0)), 2.2) * 0.30 + 0.05 * hc_noise(vec2(p.x * 17.0, 1.0));
  float ceil_ = smoothstep(tooth + 0.01, tooth - 0.02, uv.y);
  col = mix(col, vec3(0.006, 0.003, 0.004) + vec3(0.04, 0.015, 0.0) * smoothstep(0.35, 0.0, uv.y), ceil_);
  // a distant shaft of cold light from a crack in the roof, to set the gold against
  vec2 sp = vec2(p.x - 0.30 * asp - (uv.y - 0.1) * 0.30, 0.0);
  float shaft = exp(-sp.x * sp.x / 0.003) * smoothstep(0.1, 0.55, uv.y) * (1.0 - smoothstep(0.62, 0.84, uv.y));
  col += vec3(0.10, 0.12, 0.14) * shaft * (0.6 + 0.4 * hc_noise(vec2(p.x * 8.0, t * 0.2))) * 0.8;

  // the dragon's eyes: two slits in the dark upper right; half closed when asleep, wide open when the pointer comes near
  vec2 e0 = vec2(0.70 * asp, 0.33), e1 = e0 + vec2(0.105, -0.012);
  float dEye = near > 0.5 ? length(mp - 0.5 * (e0 + e1)) : 9.0;
  float wake = 0.18 + 0.82 * smoothstep(0.85, 0.15, dEye);
  float breath = 0.5 + 0.5 * sin(t * 0.4);
  float blink = 1.0 - smoothstep(0.0, 0.12, abs(fract(t * 0.07 + 0.3) - 0.5) - 0.46) * 0.0;   // (kept simple: no blink flicker)
  float open = wake * (0.88 + 0.12 * breath);
  vec3 eyeGlow = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    vec2 ec = (k == 0) ? e0 : e1;
    vec2 d = p - ec;
    // eye looks at the pointer
    vec2 look = (near > 0.5) ? clamp((mp - ec) * 0.8, vec2(-0.012), vec2(0.012)) : vec2(0.0);
    float W = 0.034, Hh = 0.020 * open + 0.0015;
    vec2 q = vec2(d.x / W, d.y / Hh);
    // almond shape: two arcs
    float almond = 1.0 - (abs(q.y) + abs(q.x) * abs(q.x) * 0.9);
    float eye = smoothstep(0.0, 0.18, almond);
    float iris = clamp(1.0 - length((d - look) * vec2(1.0, 0.9)) / 0.020, 0.0, 1.0);
    vec3 ic = mix(vec3(1.0, 0.45, 0.04), vec3(1.0, 0.85, 0.2), iris);
    float slit = smoothstep(0.0085 * (1.2 - open * 0.5), 0.0010, abs(d.x - look.x)) * smoothstep(0.03, 0.0, abs(d.y - look.y));
    vec3 ec3 = ic * (0.5 + iris * 1.0) * (1.0 - slit * 0.95);
    col += (ec3 * eye) * 0.95 * (0.5 + 0.5 * open);
    // heat glow around the eyes, and the brow ridge catching it
    float gl = exp(-dot(d, d) / (0.0030 + 0.0020 * open));
    eyeGlow += vec3(0.8, 0.3, 0.05) * gl * (0.25 + 0.55 * open);
  }
  col += eyeGlow * 0.35;

  // the hoard
  float hy = hc_heap(p.x);
  float inHeap = smoothstep(hy - 0.004, hy + 0.006, uv.y);
  if (inHeap > 0.001) {
    vec2 dm = p - mp;
    float torch = near * exp(-dot(dm, dm) / 0.06);
    float depthShade = 1.0 - 0.55 * smoothstep(hy, 1.0, uv.y);                // the heap darkens as it falls away from view
    float lit = (0.95 + 1.3 * torch) * (0.55 + 0.45 * depthShade);
    // surface lumpiness: slow shifting shadows so it reads as a pile, not a pattern
    lit *= 0.7 + 0.6 * hc_fbm(p * vec2(4.0, 5.0) + 11.0);
    vec4 cn = hc_coins(p, hy, lit, t);
    vec3 hcol = cn.rgb + vec3(1.0, 0.9, 0.6) * cn.a * (0.9 + 1.0 * torch);
    // ambient gold sheen at the crest where the glow is strongest
    hcol += vec3(0.5, 0.26, 0.05) * smoothstep(0.08, 0.0, uv.y - hy) * 0.35;
    col = mix(col, hcol, inHeap);
  }
  // heat shimmer motes rising off the gold: a few slow embers
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    vec2 o = vec2(hc_h1(fi) * asp, 0.0);
    float sp2 = 0.02 + 0.03 * hc_h1(fi + 4.0);
    float y = 1.0 - fract(t * sp2 + hc_h1(fi + 9.0)) * 0.75;
    float x = o.x + sin(t * 0.3 + fi * 5.0) * 0.03;
    float d = length(p - vec2(x, y));
    col += vec3(1.0, 0.7, 0.25) * smoothstep(0.004, 0.0, d) * (0.5 + 0.5 * sin(t * 2.0 + fi * 7.0)) * 0.6 * smoothstep(0.0, 0.2, y - hy + 0.05);
  }

  col *= 1.0 - 0.6 * pow(length((uv - 0.5) * vec2(1.0, 1.15)), 2.3);
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
