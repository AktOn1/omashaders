// label: Elven city
// hint: a moonlit city of slender silver spires in drifting mist, windows light up where the pointer passes, golden leaves fall past
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
float ev_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ev_h1(float n) { return fract(sin(n * 127.1 + 17.3) * 43758.5453); }
float ev_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ev_hash(i), ev_hash(i + vec2(1, 0)), f.x), mix(ev_hash(i + vec2(0, 1)), ev_hash(i + vec2(1, 1)), f.x), f.y);
}
float ev_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * ev_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

// one rank of slender elven towers: x = mask, y = lit window, z = moonlit edge
vec3 ev_towers(vec2 p, float scale, float seed, float groundY, float Hmax, float nearW, float t) {
  float x = p.x * scale + seed * 13.0;
  float id = floor(x);
  float f = fract(x) - 0.5;
  float aa = 1.4 * scale / res.y;
  if (p.y > groundY) return vec3(1.0, 0.0, 0.0);
  float h = ev_hash(vec2(id, seed));
  if (h < 0.22) return vec3(0.0);
  float H = Hmax * (0.30 + 0.70 * ev_hash(vec2(id, seed + 2.0)));
  float cx = (ev_hash(vec2(id, seed + 4.0)) - 0.5) * 0.28;
  float v = groundY - p.y;
  float hh = v / H;
  if (hh > 1.16) return vec3(0.0);
  float w = 0.10 + 0.10 * ev_hash(vec2(id, seed + 6.0));
  float bulge = 1.0 + 0.06 * sin(hh * 9.0 + id);
  float halfw = w * bulge;
  if (hh > 0.58) {
    float k = clamp((hh - 0.58) / 0.42, 0.0, 1.0);
    halfw = w * mix(1.0, 0.04, pow(k, 0.75)) * bulge;           // the curving taper of a spire
    if (hh > 1.0) halfw = w * 0.04 * (1.16 - hh) / 0.16;       // the needle on top
  }
  float d = f - cx;
  float m = smoothstep(halfw, halfw - aa, abs(d)) * step(0.0, hh);
  // a slim neighbour tower, sometimes, for rhythm
  float h2 = ev_hash(vec2(id, seed + 8.0));
  if (h2 > 0.55) {
    float cx2 = cx + (h2 > 0.8 ? -0.30 : 0.30);
    float H2 = H * (0.45 + 0.4 * h2);
    float hh2 = v / H2;
    float w2 = 0.045;
    float hw2 = (hh2 < 0.7) ? w2 : w2 * mix(1.0, 0.03, pow((hh2 - 0.7) / 0.3, 0.8));
    if (hh2 > 1.0) hw2 = 0.0;
    m = max(m, smoothstep(hw2, hw2 - aa, abs(f - cx2)) * step(0.0, hh2));
  }
  // lit windows: narrow arches in one or two columns
  float win = 0.0;
  if (hh > 0.08 && hh < 0.60) {
    float wv = v / 0.040;
    float fy = fract(wv);
    float rowId = floor(wv);
    float cols = (h2 > 0.5) ? 2.0 : 1.0;
    float dx = d / scale;
    float colx = (cols > 1.5) ? (dx > 0.0 ? 0.22 * w : -0.22 * w) / scale : 0.0;
    float on = ev_hash(vec2(id * 3.1 + (dx > 0.0 ? 1.0 : 0.0), rowId + seed));
    float flick = 0.8 + 0.2 * sin(t * (0.3 + on) + on * 40.0);
    float wr = smoothstep(0.030 * w / 0.18, 0.0, abs(d - colx)) * smoothstep(0.1, 0.2, fy) * smoothstep(0.85, 0.75, fy);
    win = wr * step(1.0 - nearW, on) * flick;
  }
  float rim = smoothstep(halfw * 0.55, halfw, -d) * step(d, 0.0) * step(0.0, hh);
  return vec3(m, win * m, rim * m);
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

  // moonlit sky: deep blue above, pale aqua mist at the horizon
  vec3 top = vec3(0.075, 0.130, 0.270), mid = vec3(0.20, 0.36, 0.50), low = vec3(0.62, 0.80, 0.86);
  vec3 col = mix(top, mid, smoothstep(0.0, 0.5, uv.y));
  col = mix(col, low, smoothstep(0.35, 0.95, uv.y));
  col = mix(col, col * 0.6 + pic * vec3(0.30, 0.42, 0.50), 0.16);
  vec2 moonC = vec2(0.30 * asp, 0.22);
  float dm = length(p - moonC);
  col += vec3(0.40, 0.55, 0.65) * exp(-dm * dm / 0.030) * 0.55 + vec3(0.30, 0.45, 0.58) * exp(-dm * dm / 0.25) * 0.4;
  col = mix(col, vec3(0.93, 0.97, 1.0) * (0.9 + 0.1 * ev_noise(p * 40.0)), smoothstep(0.052, 0.046, dm));
  // thin cirrus lit by the moon
  float cir = ev_fbm(vec2(p.x * 2.2 + t * 0.006, p.y * 9.0));
  col += vec3(0.30, 0.42, 0.55) * smoothstep(0.50, 0.80, cir) * smoothstep(0.7, 0.1, uv.y) * 0.35;
  // stars
  vec2 sg = p * 60.0; vec2 sid = floor(sg), sf = fract(sg) - 0.5;
  float sh = ev_hash(sid + 3.3);
  if (sh > 0.94) col += vec3(0.9, 0.95, 1.0) * smoothstep(0.10, 0.0, length(sf - (vec2(ev_hash(sid), ev_hash(sid + 1.0)) - 0.5) * 0.6)) * (0.5 + 0.5 * sin(t * 0.7 + sh * 90.0)) * smoothstep(0.55, 0.1, uv.y) * 0.8;

  // three ranks of towers, far to near, mist between them; the pointer slides the ranks a little (parallax)
  float par = near > 0.5 ? (m.x - 0.5) : 0.0;
  vec3 farC = vec3(0.50, 0.68, 0.78), nearC = vec3(0.08, 0.19, 0.29);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float depth = fl / 2.0;
    vec2 pq = vec2(p.x + par * (0.015 + 0.05 * depth), p.y);
    float groundY = mix(0.97, 1.12, depth);
    float scale = mix(5.2, 2.5, depth);
    float Hm = mix(0.46, 0.92, depth);
    // the windows wake up near the pointer
    vec2 dpq = p - mp;
    float wake = near * exp(-dot(dpq, dpq) / 0.10);
    float nearW = mix(0.26, 0.55, depth) + 0.5 * wake;
    vec3 tw = ev_towers(pq, scale, fl * 3.0 + 1.0, groundY, Hm, nearW, t);
    // aerial perspective: far ranks are pale and cool, near ranks deep teal-navy
    vec3 body = mix(farC, nearC, depth);
    body += vec3(0.05, 0.08, 0.10) * smoothstep(0.0, 1.0, (groundY - p.y) * 1.2) * (1.0 - depth);   // lighter toward the tops
    vec3 c = mix(col, body, tw.x * 0.97);
    c += vec3(0.65, 0.82, 0.95) * tw.z * 0.45 * (0.5 + 0.5 * depth);          // moonlit left edges
    c += vec3(1.0, 0.86, 0.52) * tw.y * (0.9 + 0.8 * wake);                    // warm windows
    col = c;
    // mist bank in front of this rank
    float mist = ev_fbm(vec2(p.x * 1.3 - t * (0.008 + 0.006 * fl) + fl * 7.0, p.y * 4.0 + fl * 3.0));
    float band = exp(-pow((p.y - (groundY - 0.10 - 0.05 * depth)) / (0.13 + 0.05 * depth), 2.0));
    col = mix(col, vec3(0.62, 0.78, 0.86) * (1.0 - 0.35 * depth), smoothstep(0.30, 0.75, mist) * band * (0.55 - 0.1 * depth));
  }

  // golden mallorn leaves drifting down in the foreground
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float sp = 0.020 + 0.03 * ev_h1(fi);
    float y = fract(t * sp + ev_h1(fi + 5.0));
    float x = (ev_h1(fi + 9.0) + sin(t * 0.25 + fi * 3.0) * 0.04 + y * 0.12) * asp;
    vec2 d = (p - vec2(x, y * 1.1 - 0.05)) * vec2(1.0, 1.9);
    float a = t * 0.5 + fi * 2.0;
    vec2 r = vec2(cos(a) * d.x + sin(a) * d.y, -sin(a) * d.x + cos(a) * d.y);
    float leaf = smoothstep(0.011, 0.004, length(r * vec2(1.0, 2.2)));
    col = mix(col, vec3(1.0, 0.85, 0.45), leaf * 0.8);
  }

  col *= 1.0 - 0.40 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
