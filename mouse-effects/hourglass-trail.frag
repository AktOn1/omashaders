#version 440
// category: Retro
// desc: Hourglass trail: a small pixel hourglass with white glass and teal sand that slowly runs down beside the pointer, followed by a dithered trail of little square pixels that fade from desktop teal to white. Hard pixels, calm and low-contrast
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

const vec3 hg_teal = vec3(0.0, 0.502, 0.502);
const vec3 hg_navy = vec3(0.0, 0.0, 0.502);
const float hg_cell = 2.0;   // size of one pixel of the effect, in screen pixels

float hg_idx2(vec2 c) {
  float a = mod(floor(c.x), 2.0);
  float b = mod(floor(c.y), 2.0);
  return mod(a + b, 2.0) * 2.0 + b;
}
float hg_bayer(vec2 c) { return (hg_idx2(c) * 4.0 + hg_idx2(floor(c * 0.5)) + 0.5) / 16.0; }

// pixel hourglass on an integer grid (x 0..10, y 0..14, neck on row 7): returns rgb in .rgb, alpha in .a
// outline black, glass white, sand teal; the sand level s (0..1) drains from the top chamber to the bottom one
vec4 hg_glass(vec2 g, float s) {
  if (g.x < 0.0 || g.y < 0.0 || g.x > 10.0 || g.y > 14.0) return vec4(0.0);
  // top and bottom bars
  if (g.y < 1.0 || g.y >= 14.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float dd = abs(g.y - 7.0);
  float hw = floor(dd * 0.7);
  float ax = abs(g.x - 5.0);
  if (ax > hw + 0.5) return vec4(0.0);
  if (ax > hw - 0.5) return vec4(0.0, 0.0, 0.0, 1.0);     // the glass wall
  // inside the glass: sand or air
  float drained = floor(s * 6.0);                          // rows of sand moved down
  if (g.y < 7.0) {
    if (g.y >= 1.0 + drained) return vec4(hg_teal, 1.0);
    return vec4(1.0, 1.0, 1.0, 0.92);
  }
  float pile = 14.0 - 1.0 - drained;                        // top row of the bottom pile
  if (g.y >= pile && drained > 0.5) return vec4(hg_teal, 1.0);
  // a one-cell stream through the neck while the sand runs
  if (abs(g.x - 5.0) < 0.5 && s < 0.97 && g.y >= 7.0 && g.y < pile) return vec4(hg_teal, 1.0);
  return vec4(1.0, 1.0, 1.0, 0.92);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec2 pc = floor(p / hg_cell);                             // integer pixel cell under this fragment

  // result as premultiplied rgb + alpha, painted back to front
  vec3 rgb = vec3(0.0);
  float al = 0.0;

  // ---- dithered trail: little squares that shrink and fade from desktop teal to white, oldest first ----
  for (int i = 16; i >= 1; i--) {
    float fi = float(i);
    float age = (fi - 1.0 + hs.y) / 16.0;                   // 0 = newest, 1 = oldest
    vec2 q0 = P(i);
    vec2 q1 = P(i - 1);
    for (int k = 0; k < 2; k++) {
      vec2 q = k == 0 ? q0 : (q0 + q1) * 0.5;
      vec2 qc = floor(q / hg_cell);
      vec2 d = pc - qc;
      float n = age < 0.18 ? 3.0 : (age < 0.45 ? 2.0 : 1.0);
      vec2 ds = d - vec2(1.0);                              // the same square one cell down and right: a hard navy shadow
      float fade = pow(max(1.0 - age, 0.0), 1.2) * 0.95;
      float lit = step(hg_bayer(pc), fade);
      if (d.x >= 0.0 && d.y >= 0.0 && d.x < n && d.y < n && lit > 0.5) {
        vec3 c = mix(hg_teal, vec3(1.0), smoothstep(0.0, 0.85, age));
        rgb = c; al = 1.0;
      } else if (ds.x >= 0.0 && ds.y >= 0.0 && ds.x < n && ds.y < n && lit > 0.5 && al < 0.5) {
        rgb = hg_navy * 0.7; al = 0.45;
      }
    }
  }

  // ---- the hourglass: just down and to the right of the pointer, sand running about once every ten seconds ----
  vec2 org = floor((mouse + vec2(10.0, 12.0)) / hg_cell);
  float s = fract(time * 0.10);
  vec2 g = pc - org;
  vec4 sh = hg_glass(g - vec2(1.0), s);
  if (sh.a > 0.0 && al < 0.5) { rgb = vec3(0.0); al = 0.30; }
  vec4 gv = hg_glass(g, s);
  if (gv.a > 0.0) { rgb = gv.rgb; al = gv.a; }   // glass cells are slightly see-through, so the picture shows through the white

  fragColor = vec4(rgb * al, al) * qt_Opacity;
}
