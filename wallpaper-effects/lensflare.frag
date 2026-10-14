// label: Sun lens flare
// hint: a warm sun flare from the upper corner: bloom, ghost discs and a gentle streak
// category: Sun and sky
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}



// the picture's brightest tone: brightest of a 3x3 grid of samples, normalised to a colour (not a brightness)
vec3 lf_bright() {
  vec3 b = vec3(0.0); float bl = -1.0;
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      vec3 s = wall(vec2(0.2 + 0.3 * float(i), 0.15 + 0.3 * float(j)));
      float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
      if (l > bl) { bl = l; b = s; }
    }
  }
  return b;
}
vec3 lf_tint() {
  vec3 b = lf_bright();
  return mix(vec3(1.0), b / max(max(b.r, max(b.g, b.b)), 0.05), 0.55);
}

// hexagon-ish distance (aperture blades): 1.0 on the hexagon edge for a unit radius
float lf_hex(vec2 p) { p = abs(p); return max(p.x * 0.866 + p.y * 0.5, p.y); }
// one ghost: a soft hexagonal disc with a brighter, slightly rainbow-fringed rim, centred at c, radius r
vec3 lf_ghost(vec2 p, vec2 c, float r, float rim, float edge) {
  float d = lf_hex((p - c) / r);
  vec3 dd = d * vec3(0.95, 1.0, 1.05);
  float fill = smoothstep(1.05, 0.2, d);
  vec3 ring = smoothstep(vec3(edge), vec3(0.0), abs(dd - 0.88));
  return vec3(fill * 0.30) + ring * rim;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  vec3 tn = lf_tint();
  vec3 warm = mix(vec3(1.0, 0.93, 0.80), tn, 0.45);

  vec2 p = vec2(uv.x * asp, uv.y);
  // the sun sits in the upper right corner, drifting very slowly; the pointer nudges it a little
  vec2 sun = vec2(0.90 + 0.035 * sin(time * 0.045) + 0.02 * sin(time * 0.071 + 1.0), 0.07 + 0.03 * sin(time * 0.037 + 2.0));
  if (m.x > -1.0) sun += (m - 0.5) * vec2(-0.05, -0.04);
  vec2 sp = vec2(sun.x * asp, sun.y);
  vec2 cp = vec2(0.5 * asp, 0.5);
  vec2 d = p - sp;
  float r = length(d);

  // bloom: a bright core, a wide halo, a faint veil over the whole sky
  float bloom = 0.55 * exp(-r * 5.5) + 0.35 / (1.0 + r * r * 90.0) + 0.30 * exp(-r * 1.5);
  // gentle spikes and a soft horizontal streak through the sun
  float ang = atan(d.y, d.x);
  float spikes = 0.6 + 0.4 * noise(vec2(ang * 5.0 + time * 0.05, 3.0));
  float streak = exp(-abs(d.y) * 38.0) * exp(-abs(d.x) * 1.4) * 0.30;
  float flare = bloom * (0.85 + 0.15 * spikes) + streak;
  vec3 add = warm * flare;

  // ghosts along the line from the sun through the screen centre and beyond
  vec2 ax = cp - sp;
  float pulse = 0.85 + 0.15 * sin(time * 0.31);
  vec3 gc = vec3(0.0);
  vec3 a1 = lf_ghost(p, sp + ax * 0.45, 0.07, 0.30, 0.30);
  vec3 a2 = lf_ghost(p, sp + ax * 0.75, 0.12, 0.22, 0.30);
  vec3 a3 = lf_ghost(p, sp + ax * 1.20, 0.05, 0.40, 0.45);
  vec3 a4 = lf_ghost(p, sp + ax * 1.55, 0.17, 0.18, 0.25);
  vec3 a5 = lf_ghost(p, sp + ax * 1.90, 0.09, 0.30, 0.35);
  gc += vec3(1.0, 0.70, 0.45) * a1 * 0.40;
  gc += vec3(0.55, 0.85, 1.00) * a2 * 0.22;
  gc += vec3(1.0, 0.92, 0.70) * a3 * 0.45;
  gc += vec3(0.75, 1.00, 0.80) * a4 * 0.18;
  gc += vec3(1.0, 0.65, 0.80) * a5 * 0.28;
  // ghosts are tinted by the picture and fade as the sun leaves the corner
  add += mix(vec3(1.0), tn, 0.4) * gc * pulse * 1.9;

  // a big soft ring halo around the centre line
  float rr = length(p - sp);
  float halo = smoothstep(0.16, 0.0, abs(rr - 0.78)) * 0.07;
  add += warm * halo;

  // screen-blend on top: never darkens, never clips hard
  add = min(add, vec3(1.2));
  col = col + add * (1.0 - col * 0.8) * 0.9;
  // a small sunny lift of the whole picture
  col += warm * 0.025 * exp(-r * 0.6);
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
