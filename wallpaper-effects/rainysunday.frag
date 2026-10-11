// label: Rainy Sunday
// hint: a grey rainy window with slow drops and warm blurred lights, a knitted blanket in front, the pointer wipes the glass clear
// category: Cozy corners
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
float rs_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rs_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rs_h(i), rs_h(i + vec2(1, 0)), f.x), mix(rs_h(i + vec2(0, 1)), rs_h(i + vec2(1, 1)), f.x), f.y);
}
float rs_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * rs_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float rs_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 rs_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }

// a rainy Sunday: a grey window with slow drops and trails, blurred warm lights outside, and a knitted blanket in front;
// the pointer wipes a little warm clear patch into the glass
vec3 rs_blur(vec2 uv, float r) {
  vec3 a = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float fi = float(i) + 0.5;
    float ang = fi * 2.39996;
    float rr = sqrt(fi / 12.0) * r;
    a += wall(uv + vec2(cos(ang), sin(ang)) * rr);
  }
  return a / 12.0;
}
// a layer of drops that creep down the glass; returns xy = refraction offset, z = trail / head mask
vec3 rs_drops(vec2 uv, float asp, float cw, float sp, float seedv, float t) {
  vec2 p = vec2(uv.x * asp, uv.y);
  float cid = floor(p.x / cw);
  float dx0 = (fract(p.x / cw) - 0.5) * cw;
  float h = rs_h(vec2(cid, seedv));
  float h2 = rs_h(vec2(cid, seedv + 4.0));
  float h3 = rs_h(vec2(cid, seedv + 9.0));
  if (h < 0.20) return vec3(0.0);
  float ox = (h2 - 0.5) * cw * 0.5;
  float y0 = fract(t * sp * (0.4 + h3) + h2 * 3.0);
  float r = 0.010 + 0.008 * h3;
  vec2 d = vec2(dx0 - ox, (uv.y - y0));
  d.y *= 0.8;
  float dist = length(d);
  float head = smoothstep(r, r * 0.55, dist);
  float up = y0 - uv.y;
  float L = 0.12 + 0.25 * h;
  float tr = step(0.0, up) * step(up, L) * smoothstep(0.0036, 0.0008, abs(dx0 - ox + sin(up * 40.0 + h * 9.0) * 0.0007)) * (1.0 - up / L) * 0.55;
  vec2 off = -d / r * head * 0.012;
  return vec3(off, clamp(head + tr, 0.0, 1.0));
}
vec3 rs_knit(vec2 p, float shadeFold) {
  vec2 q = vec2(p.x / 0.034, p.y / 0.044);
  vec2 id = floor(q), f = fract(q);
  float v = abs(f.x - 0.5) * 2.0;
  float band = smoothstep(0.45, 0.0, abs(f.y - (0.12 + 0.70 * (1.0 - v)))); // the V of a stitch
  float tone = 0.78 + 0.22 * rs_h(id);
  vec3 c = mix(vec3(0.46, 0.29, 0.22), vec3(0.88, 0.66, 0.50), band * tone);
  c *= 0.82 + 0.18 * rs_n(p * 6.0);
  return c * shadeFold;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = rs_ptr(mpx, vec2(-5.0));
  // a patch the pointer has wiped clear
  float wipe = exp(-dot((p - m * vec2(asp, 1.0)) * vec2(1.0, 1.0), (p - m * vec2(asp, 1.0))) / (2.0 * 0.12 * 0.12));
  wipe *= react > 0.0 ? 1.0 : 0.0;

  // drops on the glass: two layers
  vec3 d1 = rs_drops(uv, asp, 0.045, 0.012, 1.0, t);
  vec3 d2 = rs_drops(uv + vec2(0.013, 0.0), asp, 0.028, 0.007, 7.0, t);
  vec2 off = (d1.xy + d2.xy) * (1.0 - wipe);
  float dropMask = clamp(d1.z + d2.z, 0.0, 1.0) * (1.0 - wipe);

  float blurR = mix(0.024, 0.004, wipe);
  vec3 base = rs_blur(uv + off, blurR);
  // grey-blue rainy daylight
  float l = rs_lum(base);
  vec3 grey = mix(vec3(0.20, 0.25, 0.30), vec3(0.58, 0.66, 0.72), smoothstep(0.0, 0.8, l));
  vec3 col = mix(grey, grey * 0.6 + base * vec3(0.9, 0.9, 1.0) * 0.45, 0.5);
  col = mix(col, base * vec3(1.05, 0.95, 0.85), wipe * 0.55);
  col *= 0.88 + 0.22 * (1.0 - uv.y);                                  // lighter toward the top of the pane
  // blurred warm street lights outside
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2((0.08 + 0.17 * fi + 0.06 * rs_h(vec2(fi, 2.0))) * asp, 0.46 + 0.20 * rs_h(vec2(fi, 5.0)));
    float r = 0.025 + 0.035 * rs_h(vec2(fi, 8.0));
    float d = length(p - c + off * 2.0);
    float tw = 0.85 + 0.15 * sin(t * 0.3 + fi * 5.0);
    vec3 lc = i % 2 == 0 ? vec3(1.0, 0.78, 0.45) : vec3(1.0, 0.92, 0.75);
    col += lc * smoothstep(r, r * 0.35, d) * 0.22 * tw * (1.0 - wipe * 0.8);
  }
  // water on the glass: bright rim and darker body
  col += vec3(0.75, 0.82, 0.90) * dropMask * 0.10;
  col *= 1.0 - dropMask * 0.05;

  // the blanket along the bottom, with a wavy folded edge
  float edge = 0.78 + 0.012 * sin(p.x * 5.0 + 1.0) + 0.03 * (rs_fbm(vec2(p.x * 1.6, 2.0)) - 0.5);
  float inB = smoothstep(edge, edge + 0.006, uv.y);
  float fold = 0.78 + 0.30 * (0.5 + 0.5 * sin(p.x * 7.0 + rs_fbm(vec2(p.x * 2.0, 1.0)) * 5.0));
  fold *= 1.0 - 0.45 * smoothstep(0.0, 0.18, uv.y - edge) * 0.0 + 0.0;
  vec3 knit = rs_knit(vec2(p.x, uv.y), fold);
  knit *= mix(1.0, 0.72, smoothstep(0.0, 0.20, uv.y - edge));        // darker deeper down
  col *= 1.0 - 0.40 * exp(-(edge - uv.y) / 0.025) * (1.0 - inB) * step(uv.y, edge);   // soft shadow cast above the edge
  col = mix(col, knit * 0.95, inB);
  col += vec3(1.0, 0.8, 0.55) * smoothstep(0.006, 0.0, abs(uv.y - edge - 0.003)) * 0.10;   // fuzzy lit edge
  col *= 1.0 - 0.40 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
