// label: Ink wash
// hint: picture turned into sumi-e wash tones, ink clouds bloom where the pointer goes
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
float fbm4(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

const vec3 INK   = vec3(0.050, 0.052, 0.060);   // sumi
const vec3 PAPER = vec3(0.90, 0.855, 0.75);     // washi
const vec3 SHU   = vec3(0.86, 0.24, 0.15);      // vermilion, the only colour
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// one ink cloud: x = body of the cloud (0..1), y = how far it has bled into the paper rim (0..1)
vec2 inkCloud(vec2 p, vec2 c, float R, float seed, float t) {
  vec2 q = p - c;
  if (dot(q, q) > R * R * 3.2) return vec2(0.0);
  vec2 u = q / R;
  vec2 w = vec2(noise(u * 1.6 + seed + t * 0.5), noise(u * 1.6 + seed + 9.3 - t * 0.4)) - 0.5;
  u += w * 0.9;                                           // water currents bend the cloud
  float n = fbm4(u * 2.1 + seed - t * 0.25);
  float d = length(u) + (n - 0.5) * 1.15;
  float body = smoothstep(1.0, 0.25, d);
  float rim = smoothstep(0.25, 0.0, abs(d - 0.92)) ;     // pigment gathers at the edge of the bleed
  float tendril = smoothstep(0.58, 0.8, fbm4(u * 5.0 - seed)) * smoothstep(1.55, 0.7, d) * smoothstep(0.55, 0.95, d);
  return vec2(clamp(body + tendril * 0.5, 0.0, 1.0), rim);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  vec2 px = 1.0 / res;

  // soft picture: centre + 8 taps on a ring (also gives the edge direction for ink outlines)
  vec3 c0 = wall(uv);
  vec3 acc = c0;
  float lt[8];
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    vec3 s = wall(uv + vec2(cos(a), sin(a)) * px * 3.0);
    acc += s;
    lt[i] = luma(s);
  }
  vec3 soft = acc / 9.0;
  float l = luma(soft);
  float gx = (lt[0] * 2.0 + lt[1] + lt[7]) - (lt[4] * 2.0 + lt[3] + lt[5]);
  float gy = (lt[2] * 2.0 + lt[1] + lt[3]) - (lt[6] * 2.0 + lt[5] + lt[7]);
  float edge = length(vec2(gx, gy)) * 0.25;

  // paper fibres, drawn as long thin strokes
  vec2 fp = vec2(uv.x * asp, uv.y) * res.y;
  vec2 fa = vec2(fp.x * 0.9 + fp.y * 0.42, fp.y * 0.9 - fp.x * 0.42);
  vec2 fb = vec2(fp.x * 0.35 - fp.y * 0.94, fp.y * 0.35 + fp.x * 0.94);
  float fib = noise(vec2(fa.x * 0.011, fa.y * 0.13)) * 0.55 + noise(vec2(fb.x * 0.09, fb.y * 0.011)) * 0.45;
  float paperTex = (fib - 0.5) * 0.045;

  // wash tones: continuous tone plus soft steps with wavering edges, like layered washes
  float wob = (fbm4(p * 3.0 + vec2(0.0, time * 0.01)) - 0.5) * 0.9;
  float x = clamp(l, 0.0, 1.0) * 5.0 + wob * 0.7;
  float stp = (floor(x) + smoothstep(0.30, 0.70, fract(x))) / 5.0;
  float tone = mix(l, stp, 0.5);
  tone = pow(smoothstep(0.0, 0.85, tone), 0.75);
  vec3 col = mix(INK, PAPER * 0.80, tone);

  // low mist drifting between the washes
  float mist = fbm4(vec2(p.x * 1.3 + time * 0.012, p.y * 4.2) + 4.0);
  mist = smoothstep(0.42, 0.78, mist) * smoothstep(0.1, 0.5, tone) * 0.18;
  col = mix(col, PAPER * 0.76, mist);

  // brush outlines where the picture has edges
  col = mix(col, INK * 0.7, smoothstep(0.10, 0.45, edge) * 0.35);

  // the only colour: reds of the picture are kept as vermilion
  float red = smoothstep(0.22, 0.5, soft.r - soft.g) * smoothstep(0.14, -0.04, soft.b - soft.g);
  col = mix(col, SHU * (0.55 + 0.75 * l), red * 0.92);
  col += paperTex * (0.4 + 0.6 * tone);

  // ink clouds: three that slowly bloom somewhere on the wallpaper, one that follows the pointer
  vec2 ink = vec2(0.0);
  float tint = 0.0;
  for (int k = 0; k < 3; k++) {
    float per = 21.0 + 7.0 * float(k);
    float ph0 = time / per + float(k) * 0.37;
    float cyc = floor(ph0), ph = fract(ph0);
    vec2 c = vec2(0.25 + 0.5 * hash(vec2(cyc, float(k) * 3.1)), 0.2 + 0.6 * hash(vec2(cyc, float(k) * 5.7 + 1.0)));
    c.x *= asp * 1.2 - 0.1;
    float grow = 1.0 - pow(1.0 - ph, 2.2);
    float env = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.5, 1.0, ph));
    vec2 v = inkCloud(p, c, 0.09 + 0.15 * grow, float(k) * 7.0 + cyc * 3.0, time * 0.35);
    ink = max(ink, v * env * 0.5);
  }
  if (m.x > -5.0) {
    float breathe = 0.5 + 0.5 * sin(time * 0.35);
    vec2 v = inkCloud(p, mp, 0.15 + 0.03 * breathe, 31.0, time * 0.5);
    ink = max(ink, v);
    tint = v.x * (1.0 - v.x) * 4.0;
  }
  // in dark washes the ink reads as a lighter grey smoke, over light washes it is black ink
  float lw = luma(col);
  vec3 inkCol = mix(vec3(0.40, 0.395, 0.40), INK * 0.5, smoothstep(0.12, 0.5, lw));
  inkCol *= 0.85 + 0.30 * noise(p * 14.0 + time * 0.03);
  col = mix(col, inkCol, ink.x * 0.82);
  col = mix(col, inkCol * 0.55, ink.y * 0.30 * ink.x);
  col = mix(col, SHU * 0.9, smoothstep(0.55, 0.0, ink.x) * ink.y * 0.06 * smoothstep(-5.0, -4.0, m.x) * step(0.001, tint));

  col *= 1.0 - 0.35 * pow(length((uv - 0.5) * vec2(1.0, 1.15)), 2.2);
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
