// label: Harvest gold
// hint: golden-hour autumn: low sun and long rays over amber hills and trees, leaves tumbling down, the pointer stirs them into a whirl
// category: Seasons and festivals
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
float hvl_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hvl_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hvl_h22(vec2 p) { return vec2(hvl_h2(p), hvl_h2(p + vec2(37.2, 91.7))); }
float hvl_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hvl_h2(i), hvl_h2(i + vec2(1, 0)), f.x), mix(hvl_h2(i + vec2(0, 1)), hvl_h2(i + vec2(1, 1)), f.x), f.y);
}
float hvl_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * hvl_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float hvl_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 hvl_leafCol(float h) {
  if (h < 0.25) return vec3(0.80, 0.22, 0.10);
  if (h < 0.55) return vec3(0.96, 0.52, 0.12);
  if (h < 0.80) return vec3(0.98, 0.76, 0.22);
  return vec3(0.55, 0.28, 0.10);
}

// one layer of falling leaves; returns rgb in xyz, coverage in w. 'size' is the leaf length in pixels
vec4 hvl_leaves(vec2 p, float size, float speed, float seed, float t) {
  float cell = size * 4.2;
  vec2 q = vec2(p.x + t * speed * 18.0, p.y - t * speed * 42.0);       // drift right, fall down
  vec2 id = floor(q / cell);
  vec2 f = q / cell - id;
  float h = hvl_h2(id + seed);
  if (h < 0.42) return vec4(0.0);
  float ph = hvl_h2(id + seed + 9.0) * 6.28;
  vec2 c = vec2(0.5 + 0.2 * sin(t * 0.8 * (0.6 + h) + ph), 0.5 + 0.12 * sin(t * 1.1 + ph * 1.7)) ;
  vec2 d = (f - c) * cell;
  float a = ph + t * (0.6 + h) * 1.1 + sin(t * 0.9 + ph) * 0.9;             // tumbling
  float cs = cos(a), sn = sin(a);
  vec2 l = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
  float flat_ = 0.35 + 0.65 * abs(sin(t * 0.7 * (0.5 + h) + ph * 2.0));      // turning edge-on
  l.y /= flat_;
  float u = l.x / size;
  float w = 0.40 * (1.0 - u * u * 4.0) * (1.0 - 0.35 * u);                  // half width at u in -0.5..0.5, fuller toward the stem
  float inside = smoothstep(0.0, 0.03, w - abs(l.y) / size) * step(abs(u), 0.5);
  vec3 lc = hvl_leafCol(hvl_h2(id + seed + 4.0));
  float vein = smoothstep(0.05, 0.0, abs(l.y) / size) * 0.22 + smoothstep(0.03, 0.0, abs(abs(l.y) / size - (0.5 - abs(u)) * 0.5)) * 0.10;
  lc *= 0.82 + 0.28 * (u + 0.5);
  lc = mix(lc, lc * 0.55, vein);
  return vec4(lc, inside);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 pp = uv * res;
  float S = res.y / 1080.0;
  float t = time;
  vec3 base = wall(uv);
  vec2 sunP = vec2(0.24 * asp, 0.60);

  // golden-hour sky: dusty blue overhead, peach and honey toward the low sun
  float sk = smoothstep(0.0, 0.62, uv.y);
  vec3 sky = mix(vec3(0.22, 0.30, 0.55), vec3(0.95, 0.62, 0.38), pow(sk, 1.1));
  sky = mix(sky, vec3(1.0, 0.80, 0.45), exp(-pow(length((p - sunP) * vec2(0.8, 1.6)), 2.0) * 4.0));
  vec3 col = mix(base * vec3(1.05, 0.88, 0.70), sky, 0.88);
  float cl = hvl_fbm(vec2(p.x * 3.0 - t * 0.01, p.y * 8.0 + 2.0));
  col = mix(col, vec3(1.0, 0.72, 0.52), smoothstep(0.52, 0.75, cl) * 0.30 * (1.0 - smoothstep(0.1, 0.6, uv.y)));

  // the low sun and long god rays
  vec2 ds = p - sunP;
  float dl = length(ds);
  col += vec3(1.0, 0.78, 0.40) * (exp(-dl * dl * 6.0) * 0.32 + exp(-dl * dl * 80.0) * 0.28);
  float ang = atan(ds.y, ds.x);
  float rays = hvl_n(vec2(ang * 7.0 + t * 0.03, 1.0)) * 0.6 + hvl_n(vec2(ang * 19.0 - t * 0.05, 4.0)) * 0.4;
  col += vec3(1.0, 0.72, 0.36) * smoothstep(0.45, 0.85, rays) * exp(-dl * 1.7) * 0.22;

  // three rows of hills; the nearer ones carry a rim of autumn trees
  float hy1 = 0.64 + 0.04 * hvl_n(vec2(p.x * 2.0, 3.0)) - 0.03 * smoothstep(0.2, 1.5, p.x);
  float hy2 = 0.70 + 0.05 * hvl_n(vec2(p.x * 2.6 + 5.0, 6.0));
  float hy3 = 0.82 + 0.05 * hvl_n(vec2(p.x * 1.6 + 9.0, 8.0));
  col = mix(col, vec3(0.66, 0.42, 0.34), smoothstep(hy1 - 0.002, hy1 + 0.002, uv.y) * 0.7);
  float tr2 = hy2 - 0.035 * hvl_n(vec2(p.x * 38.0, 3.0)) * smoothstep(0.0, 0.5, hvl_fbm(vec2(p.x * 6.0, 7.0)));
  vec3 fol2 = mix(vec3(0.62, 0.28, 0.12), vec3(0.88, 0.50, 0.14), hvl_fbm(vec2(p.x * 24.0, uv.y * 40.0)));
  col = mix(col, fol2 * vec3(1.0, 0.85, 0.75), smoothstep(tr2 - 0.002, tr2 + 0.002, uv.y) * 0.85);
  float tr3 = hy3 - 0.05 * hvl_n(vec2(p.x * 22.0 + 4.0, 5.0)) * smoothstep(0.1, 0.6, hvl_fbm(vec2(p.x * 3.0, 2.0)));
  vec3 fol3 = mix(vec3(0.42, 0.14, 0.07), vec3(0.78, 0.38, 0.10), hvl_fbm(vec2(p.x * 40.0, uv.y * 60.0 + 3.0)));
  col = mix(col, fol3, smoothstep(tr3 - 0.002, tr3 + 0.002, uv.y) * 0.92);
  // warm rim light on the trees facing the sun
  float rim = exp(-pow((uv.y - tr3) / 0.012, 2.0)) * exp(-dl * 1.2);
  col += vec3(1.0, 0.65, 0.25) * rim * 0.20 * step(tr3, uv.y + 0.012);
  // the field in front: dark gold, ploughed rows
  float fy = 0.90;
  float inField = smoothstep(fy - 0.002, fy + 0.002, uv.y + 0.02 * hvl_n(vec2(p.x * 2.0, 1.0)));
  float rowsF = 0.5 + 0.5 * sin((p.x - 0.9 * asp) / (uv.y - 0.82 + 0.06) * 0.35 * 0.1 + uv.y * 0.0);
  vec3 fld = mix(vec3(0.22, 0.12, 0.06), vec3(0.50, 0.30, 0.10), hvl_fbm(vec2(p.x * 30.0, uv.y * 90.0)) * 0.7 + 0.2 * rowsF);
  col = mix(col, fld, inField * 0.9);

  // leaves: swirl them around the pointer, then three depth layers
  vec2 mq = mpx;
  vec2 rel = pp - mq;
  float dist = length(rel);
  float sw = exp(-dist * dist / (2.0 * 150.0 * 150.0)) * 1.6;
  float ca = cos(sw), sa = sin(sw);
  vec2 pl = mq + vec2(ca * rel.x - sa * rel.y, sa * rel.x + ca * rel.y);
  vec4 l1 = hvl_leaves(pl / S + 31.0, 20.0, 1.0, 1.0, t);
  vec4 l2 = hvl_leaves(pl / S * 0.62 + 7.0, 30.0 * 0.62 / 0.62, 0.7, 5.0, t * 0.8);
  vec4 l3 = hvl_leaves(pl / S * 0.5 + 99.0, 46.0, 1.25, 8.0, t * 1.1);
  l1.rgb *= vec3(1.0, 0.92, 0.85);
  col = mix(col, l1.rgb * 0.62, l1.a * 0.55);
  col = mix(col, l2.rgb * 0.88, l2.a * 0.9);
  col = mix(col, l3.rgb * 1.08, l3.a * 0.95);

  // floating dust in the low light
  vec2 mo = pp / S / 60.0 + vec2(t * 0.03, -t * 0.04);
  vec2 mi = floor(mo), mf = fract(mo) - 0.5;
  float mh = hvl_h2(mi + 3.0);
  float mote = smoothstep(0.06, 0.0, length(mf - (hvl_h22(mi) - 0.5) * 0.6)) * step(0.7, mh) * (0.6 + 0.4 * sin(t * 1.3 + mh * 40.0));
  col += vec3(1.0, 0.82, 0.5) * mote * 0.35 * exp(-dl * 1.1);

  col *= 1.0 - 0.34 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
