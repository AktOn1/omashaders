// label: Ink in water
// hint: pigment bleeds out of your picture's own bright and colourful places: marbled tendrils, blooming edges and slow drift, as if a drop of ink had been let into a glass of water; the pointer drips more
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
  vec4 tr0;
  vec4 tr1;
  vec4 tr2;
  vec4 tr3;
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
float inw_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float inw_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(inw_hash(i), inw_hash(i + vec2(1, 0)), f.x), mix(inw_hash(i + vec2(0, 1)), inw_hash(i + vec2(1, 1)), f.x), f.y);
}
float inw_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * inw_noise(p); p = p * 2.07 + 13.0; a *= 0.5; }
  return v;
}
float inw_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 inw_sat(vec3 c, float k) { return clamp(mix(vec3(inw_luma(c)), c, k), 0.0, 1.0); }
// how much pigment a pixel of the picture holds: bright and colourful places are the sources
float inw_src(vec3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  return mx * (0.42 + 0.80 * (mx - mn) / max(mx, 0.001));
}
// the water turns slowly: the curl of a drifting noise field
vec2 inw_flow(vec2 q, float t) {
  float e = 0.07;
  float n0 = inw_fbm(q * 1.5 + vec2(0.0, -t * 0.018));
  float nx = inw_fbm(q * 1.5 + vec2(e, -t * 0.018));
  float ny = inw_fbm(q * 1.5 + vec2(0.0, e - t * 0.018));
  vec2 v = vec2(ny - n0, -(nx - n0));
  return v / max(length(v), 1e-4);
}
// the eight most recent pointer positions in pixels, newest first
vec2 inw_tp(int i) {
  if (i == 0) return tr0.xy;
  if (i == 1) return tr0.zw;
  if (i == 2) return tr1.xy;
  if (i == 3) return tr1.zw;
  if (i == 4) return tr2.xy;
  if (i == 5) return tr2.zw;
  if (i == 6) return tr3.xy;
  return tr3.zw;
}
// the three pigments on the palette, picked by a slow field so the water keeps changing colour
vec3 inw_pigment(float k) {
  vec3 c = mix(vec3(0.055, 0.430, 0.470), vec3(0.660, 0.175, 0.290), smoothstep(0.38, 0.56, k));   // viridian -> alizarin
  return mix(c, vec3(0.185, 0.245, 0.690), smoothstep(0.56, 0.74, k));                              // -> ultramarine
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;

  // ---------- 1. the water: everything drifts a little along a slow turning current ----------
  vec2 fl = inw_flow(p, t);
  vec2 warp = fl * 0.0090 * (0.65 + 0.35 * sin(t * 0.08 + p.x * 1.3));
  vec3 base = wall(uv + vec2(warp.x / asp, warp.y));
  float own = inw_src(base);

  // ---------- 2. pigment bleeds downstream out of the picture's own bright, saturated places ----------
  float reach = 0.115 + 0.055 * sin(t * 0.11 + inw_fbm(p * 0.8) * 6.0);      // the bloom pushes out and draws back
  float ca = cos(0.26), sa = sin(0.26);
  vec2 dir = fl;
  vec2 q = p;
  float best = 0.0;
  vec3 pig = base;
  for (int i = 1; i <= 7; i++) {
    dir = vec2(dir.x * ca - dir.y * sa, dir.x * sa + dir.y * ca);            // the trail curls as it travels
    q -= dir * (reach / 7.0);
    vec3 c = wall(vec2(q.x / asp, q.y));
    float s = inw_src(c) * (1.0 - float(i) / 13.0);
    if (s > best) { best = s; pig = c; }
  }
  // pigment carried downstream: strongest where the water it arrives in is still clear
  float carry = best * (0.30 + 1.00 * (1.0 - own));
  float excess = clamp(best - own * 0.80, 0.0, 0.5);                         // a real bloom, just outside a bright place

  // marbling: the pigment separates into filaments and veils instead of a flat cloud
  float fil = inw_fbm(vec2(q.x * 5.5, q.y * 5.5) + vec2(0.0, -t * 0.035));
  float fil2 = inw_fbm(vec2(q.x * 17.0, q.y * 17.0) + 7.0);
  float veins = 1.0 - abs(fil2 * 2.0 - 1.0);                                 // thin threads where the fine field folds
  float bleed = carry * (0.20 + 1.00 * smoothstep(0.34, 0.66, fil)) * (0.45 + 0.60 * veins + 0.55 * smoothstep(0.80, 1.0, veins))
                      * (0.60 + 1.90 * excess);

  // ---------- 3. colour: the picture's own pigment, pulled toward a palette colour ----------
  float am = inw_fbm(p * 0.65 + vec2(t * 0.013, 2.0));
  vec3 accent = inw_pigment(am);
  vec3 pc = inw_sat(pig, 1.75);
  vec3 pigCol = mix(pc, accent * (0.45 + 1.25 * inw_luma(pc)), 0.52);

  float amt = clamp(bleed * 1.30, 0.0, 0.70);
  vec3 col = mix(base, pigCol, amt);
  // the leading edge of a wash dries darker: a thin concentrated rim around every bloom
  float edge = smoothstep(0.10, 0.24, bleed) * (1.0 - smoothstep(0.24, 0.46, bleed));
  col = mix(col, pigCol * 0.55, edge * 0.30);

  // ---------- 4. the pointer drips pigment that blooms and drifts away ----------
  if (mpx.x > -5000.0) {
    for (int i = 0; i < 8; i++) {
      vec2 g = inw_tp(i);
      if (g.x < 1.0 || g.y < 1.0) continue;                                  // slot not fed yet
      vec2 gp = g / res.y;
      vec2 d = p - gp - fl * (0.006 * float(i));                             // older drops have drifted downstream
      float rad = 0.018 + 0.017 * float(i);
      if (dot(d, d) > (rad * 2.3) * (rad * 2.3)) continue;
      float e = length(d) + (inw_noise(d * 20.0 + float(i) * 5.0) - 0.5) * 0.018;
      float core = 1.0 - smoothstep(rad * 0.30, rad, e);
      float halo = 1.0 - smoothstep(rad * 0.80, rad * 2.2, e);
      float dAmt = (core * 0.72 + halo * 0.34) * (1.0 - 0.10 * float(i));
      vec3 dc = inw_pigment(inw_hash(floor(gp * 9.0)));                      // every drop keeps its own colour
      col = mix(col, dc * (0.55 + 0.95 * inw_luma(base)), clamp(dAmt, 0.0, 1.0) * 0.52);
    }
    vec2 dm = p - mpx / res.y;
    float em = length(dm) + (inw_noise(dm * 26.0 + 11.0) - 0.5) * 0.012;
    float fresh = (1.0 - smoothstep(0.005, 0.016, em)) * 0.8 + (1.0 - smoothstep(0.012, 0.034, em)) * 0.3;
    vec3 fc = inw_pigment(fract(am + 0.33));
    col = mix(col, fc * (0.50 + 1.0 * inw_luma(base)), clamp(fresh, 0.0, 1.0) * 0.55);
  }

  // ---------- 5. wet paper: a damp tooth and a faint cool bloom in the highlights ----------
  float tooth = inw_noise(p * 300.0) * 0.6 + inw_noise(p * 130.0 + 5.0) * 0.4;
  col *= 0.975 + 0.050 * tooth;
  col = mix(col, col + vec3(0.03, 0.05, 0.06) * smoothstep(0.62, 1.0, inw_luma(col)), 0.8);
  col *= 1.0 - 0.09 * pow(length((uv - 0.5) * vec2(1.0, 1.05)), 2.6);
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
