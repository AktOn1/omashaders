#version 440
// category: Trail
// desc: Soap burst: small soap bubbles are blown off the pointer as it moves, each with a rainbow rim of thin-film colour and a white highlight; they swell, thin out, break into arcs and are gone
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

// Pointer history: P(0) is the pointer, P(1) the newest sample, P(16) the oldest (about one second back).
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
float SID(int i) { return mod(hs.x - float(i) + 1.0, 4096.0); }
float AGE(int i) { return i == 0 ? 0.0 : (float(i) - 1.0 + hs.y) / 16.0; }
float sb_hash(float x) { return fract(sin(x * 12.9898 + 7.233) * 43758.5453); }

// thin-film interference: the extra path D (nm) between the two faces of the film
// cancels or doubles each wavelength, which is what paints a bubble's rim
vec3 sb_film(float D) {
  vec3 s = sin(3.14159265 * max(D, 0.0) / vec3(612.0, 549.0, 464.0));
  return s * s;
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(2.0, 11.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float id = SID(i);
    float k = sb_hash(id * 0.731);
    if (k > 0.62) continue;                                  // only some of the samples blow a bubble
    float age = AGE(i);
    // it drifts a little off the path and rises as it ages, the way a bubble does
    vec2 c = P(i) + (vec2(sb_hash(id * 1.9), sb_hash(id * 3.3)) - 0.5) * 16.0 + vec2(0.0, -16.0 * age);
    vec2 d = p - c;
    float R = (6.0 + 17.0 * k) * (0.45 + 0.85 * age);        // it swells as the film thins
    float dist = length(d);
    if (dist > R * 1.5) continue;

    float burst = smoothstep(0.52, 0.86, age);               // the film tears, then it is gone
    float w = (0.9 + 1.7 * age) * (1.0 + 2.5 * burst);
    float rim = exp(-pow((dist - R) / w, 2.0));
    float ang = atan(d.y, d.x);
    // the rim runs through the Newton series: thinnest at the top, thickest at the bottom
    float D = 210.0 + 520.0 * (0.5 + 0.5 * d.y / max(R, 1.0)) + 170.0 * sin(ang * 2.0 + id * 0.9);
    vec3 cr = sb_film(D);
    cr = cr * 0.82 + 0.22 * dot(cr, vec3(0.3333)) + 0.17;        // a pearl floor: a rim is never soot
    // breaking up: the ring goes gappy before it disappears
    float gap = mix(1.0, 0.35 + 0.65 * sin(ang * 5.0 + id * 2.1), burst);
    float hl = exp(-pow(length(d - vec2(-0.38, -0.40) * R) / max(R * 0.20, 1.0), 2.0));
    float fill = smoothstep(R, R * 0.70, dist) * (1.0 - burst) * 0.10;   // the skin between the rims

    float fade = (1.0 - smoothstep(0.62, 1.0, age)) * moved;
    float a = (rim * gap * 0.55 + hl * 0.38 + fill) * fade;
    a = max(a, 0.0);
    col += (cr * (rim * gap * 1.05 + fill) + vec3(0.96, 0.99, 1.0) * hl * 0.9) * fade;
    alpha += a;
  }
  // a small pale bead right at the pointer, so it never hides the real cursor
  float dm = length(p - mouse);
  float core = smoothstep(9.0, 0.0, dm) * 0.10;
  col += vec3(0.88, 0.94, 1.0) * core;
  alpha += core;
  float a = clamp(alpha, 0.0, 0.88);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
