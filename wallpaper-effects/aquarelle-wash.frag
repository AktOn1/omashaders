// label: Aquarelle wash
// hint: wet watercolour washes over cold-press paper, the pigment creeps slowly and the pointer is a drop of clean water
// category: Art studio
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
float aq_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float aq_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(aq_hash(i), aq_hash(i + vec2(1, 0)), f.x), mix(aq_hash(i + vec2(0, 1)), aq_hash(i + vec2(1, 1)), f.x), f.y);
}
float aq_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * aq_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float aq_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// the wallpaper smeared over a small disc (a wet brush has no hard detail)
vec3 aq_wash(vec2 uv, float r) {
  vec3 acc = wall(uv) * 1.5;
  float ws = 1.5;
  for (int i = 0; i < 8; i++) {
    float fi = float(i) + 0.5;
    float a = fi * 2.39996;
    float rr = sqrt(fi / 8.0) * r;
    acc += wall(uv + vec2(cos(a), sin(a)) * rr * vec2(res.y / res.x, 1.0));
    ws += 1.0;
  }
  return acc / ws;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;

  // slow wet-in-wet drift: the pigment creeps through the water
  vec2 flow = vec2(aq_fbm(p * 3.0 + vec2(t * 0.012, 0.0)), aq_fbm(p * 3.0 + vec2(7.0, t * 0.010 + 3.0))) - 0.5;
  // the pointer is a drop of clean water: it pushes the colour outward and leaves a pale, dark-rimmed bloom
  vec2 dd = p - mp;
  float dr = length(dd);
  float R = 0.085 + 0.012 * sin(t * 0.45) + (aq_fbm(vec2(atan(dd.y, dd.x) * 1.6, t * 0.05)) - 0.5) * 0.05;
  float inside = 1.0 - smoothstep(R * 0.55, R, dr);
  float push = exp(-dr * dr / (2.0 * 0.07 * 0.07)) * 0.018;
  vec2 uvw = uv + flow * 0.020 + normalize(dd + 1e-5) * push * vec2(1.0 / asp, 1.0);

  vec3 c = aq_wash(uvw, 0.014);
  float l = aq_luma(c);

  // flat washes: soften the tones into a few translucent layers with wobbly edges
  float bands = 5.0;
  float wob = aq_fbm(p * 7.0 + 3.0) - 0.5;
  float ql = (floor(l * bands + 0.5 + wob * 0.9) + 0.0) / bands;
  float q = mix(l, clamp(ql, 0.02, 1.0), 0.5);
  c = c * (q / max(l, 0.03));
  // watercolour is translucent: lighter and a touch more colour than the dark source
  c = pow(clamp(c, 0.0, 1.0), vec3(0.70));
  vec3 gray = vec3(aq_luma(c));
  c = mix(gray, c, 1.18);

  // pigment pools at the edges of a wash: darker thin lines where the tone changes
  vec2 e = vec2(0.0035, 0.0035 * asp);
  float gx = aq_luma(aq_wash(uvw + vec2(e.x / asp * 1.0, 0.0), 0.006)) - aq_luma(aq_wash(uvw - vec2(e.x / asp * 1.0, 0.0), 0.006));
  float gy = aq_luma(aq_wash(uvw + vec2(0.0, e.x), 0.006)) - aq_luma(aq_wash(uvw - vec2(0.0, e.x), 0.006));
  float edge = smoothstep(0.02, 0.12, length(vec2(gx, gy)));
  c *= 1.0 - 0.15 * edge;

  // paper: cold-press tooth and pigment granulation
  float tooth = aq_noise(p * 260.0) * 0.5 + aq_noise(p * 120.0 + 4.0) * 0.5;
  float fibre = aq_noise(vec2(p.x * 40.0, p.y * 600.0)) * aq_noise(vec2(p.x * 600.0, p.y * 40.0));
  vec3 paper = vec3(0.965, 0.945, 0.905) * (0.965 + 0.05 * tooth);
  float dens = 1.0 - aq_luma(c);
  float gran = 0.90 + 0.22 * tooth;
  c = mix(paper, c, 0.84);
  c = c * mix(1.0, gran, 0.6 * (0.3 + dens));
  c = mix(c, c * 0.97, fibre * 0.5);

  // cauliflower blooms: pale blotchy patches where more water has pushed pigment away
  float bloom = smoothstep(0.62, 0.78, aq_fbm(p * 2.3 + 11.0 + flow * 2.0));
  c = mix(c, mix(c, paper, 0.55), bloom * 0.45);
  // drop of water at the pointer
  float rim = smoothstep(0.012, 0.0, abs(dr - R)) * smoothstep(0.0, 0.3, 1.0 - inside * 0.5);
  c = mix(c, mix(c, paper, 0.75), inside * 0.38);
  c *= 1.0 - 0.20 * rim;

  // unpainted paper edge with an irregular, hand-painted border
  float eb = min(min(uv.x, 1.0 - uv.x) * asp, min(uv.y, 1.0 - uv.y));
  float edgeNoise = (aq_fbm(p * 9.0) - 0.5) * 0.035;
  float pm = smoothstep(0.022 + edgeNoise, 0.010 + edgeNoise, eb);
  float rimEdge = smoothstep(0.010, 0.0, abs(eb - 0.022 - edgeNoise)) * 0.18;
  c = mix(c, paper, pm);
  c *= 1.0 - rimEdge;
  return vec4(c, 1.0) * qt_Opacity;
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
