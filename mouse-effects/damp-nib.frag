#version 440
// category: Trail
// desc: Damp nib: a soft ink brush tip with a tiny bright water bead at the pointer, dragging one continuous dark indigo stroke behind it along the pointer's path. The older the stroke, the wider and softer it bleeds into the paper, with a faint tide line at its edge, until it fades away
// motion: yes
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec4 h0;
  vec4 h1;
  vec4 h2;
  vec4 h3;
  vec4 h4;
  vec4 h5;
  vec4 h6;
  vec4 h7;
  vec4 hs;
};

vec2 P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  if (i == 8) return h3.zw;
  if (i == 9) return h4.xy;
  if (i == 10) return h4.zw;
  if (i == 11) return h5.xy;
  if (i == 12) return h5.zw;
  if (i == 13) return h6.xy;
  if (i == 14) return h6.zw;
  if (i == 15) return h7.xy;
  return h7.zw;
}

float dn_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float dn_noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dn_h(i), dn_h(i + vec2(1.0, 0.0)), f.x), mix(dn_h(i + vec2(0.0, 1.0)), dn_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float hy = hs.y;
  float r0 = 7.0 * sc;
  float rMax = r0 * 4.2 + 12.0 * sc;

  float dmin = length(p - mouse);
  for (int k = 1; k <= 16; k++) dmin = min(dmin, length(p - P(k)));
  if (dmin > rMax) { fragColor = vec4(0.0); return; }

  vec3 indigo = vec3(0.045, 0.080, 0.250);
  vec3 slate = vec3(0.300, 0.420, 0.640);
  vec3 foam = vec3(0.840, 0.950, 0.940);

  // the stroke: the polyline through the pointer history; the radius grows with age (the ink bleeds), the density thins out
  float body = 0.0;      // how much ink is here
  float rimA = 0.0;      // the tide line at the bleed edge
  float feather = 0.0;   // thin outer bleed
  float wob = dn_noise(p / (11.0 * sc)) - 0.5;
  float wob2 = dn_noise(p / (4.5 * sc) + 7.0) - 0.5;
  for (int i = 0; i < 16; i++) {
    vec2 a = P(i);
    vec2 b = P(i + 1);
    if (i > 0 && b == mouse) continue; // history slots not filled yet repeat the pointer
    vec2 ab = b - a;
    float L2 = dot(ab, ab);
    float uRaw = L2 > 0.0001 ? dot(p - a, ab) / L2 : 0.0;
    float u = clamp(uRaw, 0.0, 1.0);
    float inSeg = step(0.0, uRaw) * step(uRaw, 1.0);
    float d = length(p - (a + ab * u));
    float age = clamp((float(i) + u - 1.0 + hy) / 16.0, 0.0, 1.0);
    float rad = r0 * (0.80 + 2.8 * pow(age, 0.7));
    float de = d + (wob * 0.8 + wob2 * 0.22) * rad * (0.10 + 0.70 * age);
    float dens = (1.0 - smoothstep(0.30 * rad, 1.00 * rad, de)) * pow(1.0 - age, 0.85) / (1.0 + 0.5 * age);
    float fe = (1.0 - smoothstep(0.80 * rad, 1.45 * rad, de)) * pow(1.0 - age, 1.1) * smoothstep(0.08, 0.55, age) * 0.55;
    float rim = exp(-pow((de - 0.92 * rad) / (0.14 * rad + 0.8 * sc), 2.0)) * smoothstep(0.15, 0.60, age) * pow(1.0 - age, 1.1) * inSeg;
    body = max(body, dens);
    feather = max(feather, fe);
    rimA = max(rimA, rim);
  }

  // the nib: a soft brush tip at the pointer, pointing back along the stroke
  vec2 dirv = mouse - P(3);
  float dl = length(dirv);
  vec2 dir = dl > 0.5 ? dirv / dl : vec2(0.0, -1.0);
  vec2 dn = p - mouse;
  float along = dot(dn, dir);
  float perp = dot(dn, vec2(-dir.y, dir.x));
  float nibW = r0 * 1.20 * (1.0 - 0.55 * smoothstep(-2.0 * sc, 14.0 * sc, -along)) ;
  float nibShape = along > 0.0 ? length(vec2(along * 1.5, perp)) / (r0 * 1.20) : abs(perp) / max(nibW, 0.01);
  nibShape = max(nibShape, along < -16.0 * sc ? 2.0 : 0.0);
  float nib = 1.0 - smoothstep(0.78, 1.0, nibShape);

  float inkA = clamp(max(body * 0.94, nib), 0.0, 1.0);
  float ax = clamp(feather * (1.0 - inkA), 0.0, 1.0);

  // a pale tide line and a light edge so the stroke still shows on dark pictures
  float rimC = clamp(rimA * 0.55, 0.0, 0.6) * (1.0 - smoothstep(0.20, 0.55, body));

  // layer: ink stroke (premultiplied), slate feather beneath, pale tide line on top
  vec3 cInk = mix(indigo, indigo * 1.9 + slate * 0.25, smoothstep(0.55, 0.0, body) * 0.7);
  vec3 rgb = slate * ax * 0.55 + cInk * inkA * (1.0 - ax * 0.55);
  float a = clamp(inkA + ax * 0.55 * (1.0 - inkA), 0.0, 1.0);
  rgb = mix(rgb, slate * 1.15, rimC * 0.7);
  a = max(a, rimC * 0.8);
  // light halo around the tip so the nib reads on dark ground
  float halo = exp(-dot(dn, dn) / (13.0 * sc * 13.0 * sc)) * 0.18;
  rgb += foam * halo * 0.6 * (1.0 - inkA);
  a = clamp(a + halo * 0.5 * (1.0 - a), 0.0, 1.0);

  // the water bead resting on the tip: clear drop with a darker edge, a bright core reflection and a small highlight
  vec2 bc = mouse + (-dir * 0.9 + vec2(-0.45, -0.55)) * 3.2 * sc + dir * 2.0 * sc;
  vec2 db = p - bc;
  float br = 3.9 * sc;
  float rb = length(db);
  float bead = 1.0 - smoothstep(br - 1.0, br + 0.6, rb);
  float bedge = exp(-pow((rb - br * 0.88) / (0.55 * sc + 0.4), 2.0));
  vec2 hl = db - vec2(-0.30, -0.34) * br;
  float spec = exp(-dot(hl, hl) / (0.28 * br * 0.28 * br));
  float glow = exp(-rb * rb / (9.0 * sc * 9.0 * sc)) * 0.30;
  vec3 beadC = mix(foam * 0.92, vec3(0.30, 0.48, 0.74), bedge * 0.65);
  beadC = mix(beadC, vec3(1.0), spec * 0.95);
  rgb = rgb * (1.0 - bead) + beadC * bead + foam * glow * (1.0 - bead);
  a = clamp(a * (1.0 - bead) + bead * 0.97 + glow * (1.0 - bead) * (1.0 - a), 0.0, 1.0);

  fragColor = vec4(rgb, a) * qt_Opacity;
}
