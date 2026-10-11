// label: Candle meditation
// hint: a single candle flame low in a dark room, breathing slowly on a six second cycle inside a faint halo ring with a few specks of dust floating by; the flame leans toward the pointer
// category: Quiet and focus
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
float cm_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float cm_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cm_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cm_h2(i), cm_h2(i + vec2(1, 0)), f.x), mix(cm_h2(i + vec2(0, 1)), cm_h2(i + vec2(1, 1)), f.x), f.y);
}
float cm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  // ---- breathing: a six second cycle, eased so it never snaps
  float br = 0.5 + 0.5 * sin(6.2831853 * t / 6.0 - 1.2);
  br = br * br * (3.0 - 2.0 * br);
  // a very small flicker on top (slow, smooth)
  float fk = 0.5 * cm_n(vec2(t * 1.3, 3.0)) + 0.5 * cm_n(vec2(t * 2.9, 8.0)) - 0.5;
  float level = 0.86 + 0.14 * br + 0.04 * fk;

  // ---- the candle: wick base low and centred
  vec2 base = vec2(0.5 * asp, 0.640);
  vec2 q = p - base;

  // dark room: warm near-black, the user's picture only whispers in it
  vec3 col = vec3(0.034, 0.025, 0.021);
  col += vec3(0.060, 0.045, 0.034) * (0.15 + min(cm_luma(w), 0.6)) * 0.35;

  // ---- light on the room: a wide amber pool that breathes, plus a soft floor of light under the candle
  float dr = length(q * vec2(1.0, 1.05) - vec2(0.0, -0.07));
  col += vec3(0.62, 0.34, 0.12) * exp(-dr / 0.22) * (0.17 + 0.06 * br) * level;
  col += vec3(0.50, 0.26, 0.09) * exp(-dr * dr / 0.13) * 0.07 * level;
  // the table: a faint warm ellipse of light on the surface the candle stands on
  vec2 qt = (q - vec2(0.0, 0.112)) / vec2(0.36, 0.060);
  col += vec3(0.34, 0.18, 0.07) * exp(-dot(qt, qt) * 1.1) * 0.20 * level;

  // ---- halo ring: a faint circle on the dark that swells with the breath
  float ringR = 0.255 + 0.012 * br;
  float rr = length(q * vec2(1.0, 1.0) - vec2(0.0, -0.06));
  float ring = exp(-pow((rr - ringR) / 0.010, 2.0));
  float ring2 = exp(-pow((rr - ringR * 1.55) / 0.016, 2.0));
  col += vec3(0.50, 0.28, 0.11) * (ring * 0.080 + ring2 * 0.030) * (0.55 + 0.45 * br);

  // ---- the stick: a short pale candle, lit from its top
  float cw = 0.018;
  float cy = q.y - 0.006;
  float stickMask = step(abs(q.x), cw) * step(0.006, q.y) * step(q.y, 0.160);
  float edge = smoothstep(cw, cw - 0.004, abs(q.x));
  float cyl = sqrt(max(1.0 - pow(q.x / cw, 2.0), 0.0));
  float lightDown = exp(-max(q.y, 0.0) / 0.055);
  vec3 wax = vec3(0.95, 0.78, 0.55) * (0.20 + 0.80 * cyl) * (0.10 + 0.90 * lightDown) * level;
  wax += vec3(0.20, 0.10, 0.04) * lightDown * 0.5;
  col = mix(col, wax * 0.85, stickMask * edge * 0.92 * smoothstep(0.17, 0.08, q.y));
  // the melted rim at the top of the stick, a thin bright ellipse
  float rim = smoothstep(0.006, 0.0, abs((q.y - 0.007) * 1.0)) * smoothstep(cw + 0.004, cw - 0.006, abs(q.x));
  col += vec3(0.95, 0.70, 0.36) * rim * 0.28 * level;

  // ---- the flame leans toward the pointer a little
  float lean = 0.0;
  if (hasM) {
    float dx = mp.x - base.x;
    lean = clamp(dx / 0.7, -1.0, 1.0) * 0.016;
  }
  float tt = clamp(-q.y / 0.092, 0.0, 1.2);                   // 0 at the wick, 1 at the tip
  float sway = 0.003 * sin(t * 1.9 + tt * 3.0) * tt + 0.002 * sin(t * 4.3) * tt * tt;
  float cx = q.x - (lean * tt * tt + sway);
  float hw = 0.0165 * sin(3.14159 * pow(clamp(tt, 0.0, 1.0), 0.62)) * (1.0 - 0.18 * tt) * (0.94 + 0.06 * br);
  float inFlame = step(0.0, -q.y) * step(tt, 1.0);
  float dn = abs(cx) / max(hw, 0.0005);
  float body = smoothstep(1.0, 0.45, dn) * inFlame * smoothstep(0.0, 0.03, tt);
  float core = smoothstep(0.62, 0.0, dn) * inFlame * smoothstep(0.0, 0.10, tt) * (1.0 - smoothstep(0.55, 0.95, tt));
  float blue = smoothstep(0.30, 0.0, tt) * smoothstep(0.7, 0.2, dn) * inFlame * smoothstep(0.0, 0.03, tt);
  vec3 fc = mix(vec3(1.00, 0.50, 0.14), vec3(1.00, 0.84, 0.46), core);
  fc = mix(fc, vec3(1.00, 0.97, 0.84), core * core * 0.9);
  fc = mix(fc, vec3(0.45, 0.58, 0.95), blue * 0.45);
  float fa = body * (0.82 + 0.18 * level);
  col = mix(col, fc, clamp(fa, 0.0, 1.0));
  // a small soft glow right around the flame
  vec2 fq = (p - (base + vec2(lean * 0.45, -0.045))) / vec2(0.5, 0.85);
  col += vec3(1.0, 0.60, 0.22) * exp(-dot(fq, fq) / 0.0040) * 0.30 * level;
  // the wick
  col = mix(col, vec3(0.05, 0.03, 0.02), smoothstep(0.0020, 0.0008, abs(q.x - lean * 0.01)) * step(0.0, q.y) * step(q.y, 0.014) * 0.9);

  // ---- tiny dust drifting slowly in the light of the flame
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float sx = (cm_h(fi * 3.1 + 0.5) * 2.0 - 1.0) * 0.42;      // around the candle in x
    float sy0 = cm_h(fi * 5.3 + 1.7);
    float spd = 0.004 + 0.006 * cm_h(fi + 9.0);
    float yy = fract(sy0 - t * spd);                           // slowly rising
    vec2 dp = base + vec2(sx + 0.020 * sin(t * 0.17 + fi * 2.0) + 0.012 * sin(t * 0.41 + fi), -0.50 + yy * 0.62);
    float dist = length(p - dp);
    float rad = 0.0014 + 0.0012 * cm_h(fi + 21.0);
    float near = exp(-dot(dp - base, dp - base) / 0.12);         // only lit when near the flame
    float tw = 0.65 + 0.35 * sin(t * (0.5 + cm_h(fi + 4.0)) + fi * 5.0);
    float fadeY = smoothstep(0.0, 0.12, yy) * smoothstep(1.0, 0.85, yy);
    col += vec3(1.0, 0.72, 0.38) * exp(-pow(dist / rad, 2.0)) * (0.20 + 0.50 * near) * tw * fadeY;
    col += vec3(1.0, 0.62, 0.28) * exp(-dist / 0.010) * 0.020 * near * tw * fadeY;
  }

  col *= 1.0 - 0.30 * pow(length((uv - vec2(0.5, 0.55)) * vec2(1.0, 1.1)), 2.0);
  fragColor = vec4(col, 1.0) * qt_Opacity;
  return fragColor;
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
