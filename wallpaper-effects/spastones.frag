// label: Spa stones
// hint: balanced river stones over still dark water with steam and candle bokeh, the pointer sends slow rings across the water
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
float sp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sp_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sp_h(i), sp_h(i + vec2(1, 0)), f.x), mix(sp_h(i + vec2(0, 1)), sp_h(i + vec2(1, 1)), f.x), f.y);
}
float sp_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sp_n(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sp_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// pointer in 0..1 screen units, or a calm default when the pointer is away
vec2 sp_ptr(vec2 mpx, vec2 dflt) { return mpx.x < -5000.0 ? dflt : mpx / res; }

// a spa at night: a balanced stack of warm river stones over still dark water, steam rising from the basin,
// and warm candle bokeh behind; the pointer touches the water and sends slow rings
// signed shape of a stone: centre, half width, half height, returns shading in a, mask in b
vec2 sp_stone(vec2 p, vec2 c, vec2 r, float tilt) {
  vec2 d = p - c;
  float ca = cos(tilt), sa = sin(tilt);
  d = vec2(d.x * ca + d.y * sa, -d.x * sa + d.y * ca) / r;
  float q = dot(d, d);
  float mask = smoothstep(1.0, 0.94, q);
  vec3 n = vec3(d, sqrt(max(1.0 - q, 0.0)));
  float lit = clamp(dot(normalize(n + 1e-4), normalize(vec3(-0.5, -0.6, 0.65))), 0.0, 1.0);
  return vec2(lit, mask);
}
vec3 sp_stoneCol(float id) {
  if (id < 0.5) return vec3(0.30, 0.28, 0.28);
  if (id < 1.5) return vec3(0.40, 0.34, 0.30);
  if (id < 2.5) return vec3(0.26, 0.28, 0.30);
  return vec3(0.34, 0.31, 0.27);
}
vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 m = sp_ptr(mpx, vec2(-5.0));
  float wl = 0.72;                                                     // water line
  vec3 base = wall(uv);
  // the room: deep slate teal, warmer toward the bottom, a hint of the picture
  vec3 col = mix(vec3(0.030, 0.052, 0.062), vec3(0.075, 0.090, 0.095), smoothstep(0.0, wl, uv.y));
  col += base * vec3(0.03, 0.05, 0.05);
  // candle bokeh behind the stones
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 c = vec2((0.05 + 0.15 * fi + 0.06 * sp_h(vec2(fi, 1.0))) * asp, 0.42 + 0.20 * sp_h(vec2(fi, 4.0)));
    float r = 0.030 + 0.035 * sp_h(vec2(fi, 7.0));
    float tw = 0.8 + 0.2 * sin(t * (0.4 + 0.3 * sp_h(vec2(fi, 9.0))) + fi * 4.0);
    col += vec3(1.0, 0.68, 0.38) * smoothstep(r, r * 0.3, length(p - c)) * 0.14 * tw;
  }
  // the stack: a big flat stone, a middle one, a small top pebble; and a lone stone beside it
  float sx = 0.64 * asp;
  vec2 s1 = sp_stone(p, vec2(sx, wl - 0.055), vec2(0.17, 0.060), 0.03);
  vec2 s2 = sp_stone(p, vec2(sx + 0.008, wl - 0.150), vec2(0.115, 0.050), -0.05);
  vec2 s3 = sp_stone(p, vec2(sx - 0.005, wl - 0.225), vec2(0.07, 0.034), 0.08);
  vec2 s4 = sp_stone(p, vec2(sx - 0.33, wl - 0.040), vec2(0.10, 0.040), -0.04);
  // reflections come from the same shapes mirrored below the water line
  vec2 pr = vec2(p.x + sin(uv.y * 80.0 + t * 0.6) * 0.003 * (uv.y - wl), 2.0 * wl - uv.y);
  vec2 r1 = sp_stone(pr, vec2(sx, wl - 0.055), vec2(0.17, 0.060), 0.03);
  vec2 r2 = sp_stone(pr, vec2(sx + 0.008, wl - 0.150), vec2(0.115, 0.050), -0.05);
  vec2 r3 = sp_stone(pr, vec2(sx - 0.005, wl - 0.225), vec2(0.07, 0.034), 0.08);
  vec2 r4 = sp_stone(pr, vec2(sx - 0.33, wl - 0.040), vec2(0.10, 0.040), -0.04);
  vec3 stone = vec3(0.0);
  float sm = 0.0;
  vec3 warm = vec3(1.0, 0.72, 0.45);
  if (uv.y < wl) {
    vec3 c4 = sp_stoneCol(3.0) * (0.25 + 0.9 * s4.x) * s4.y;
    vec3 c1 = sp_stoneCol(0.0) * (0.25 + 0.9 * s1.x);
    vec3 c2 = sp_stoneCol(1.0) * (0.25 + 0.9 * s2.x);
    vec3 c3 = sp_stoneCol(2.0) * (0.25 + 0.9 * s3.x);
    col = mix(col, c4, s4.y);
    col = mix(col, c1, s1.y);
    col = mix(col, c2, s2.y);
    col = mix(col, c3, s3.y);
    col += warm * (s1.y * s1.x + s2.y * s2.x + s3.y * s3.x + s4.y * s4.x) * 0.06;
  } else {
    // the water: dark, glassy, with the stones faintly mirrored, ripples from the pointer
    float depth = uv.y - wl;
    vec3 water = mix(vec3(0.020, 0.040, 0.050), vec3(0.030, 0.055, 0.065), smoothstep(0.0, 0.25, depth));
    float refl = 0.0;
    refl = max(max(r1.y, r2.y), max(r3.y, r4.y));
    float rl = max(max(r1.x * r1.y, r2.x * r2.y), max(r3.x * r3.y, r4.x * r4.y));
    water += (vec3(0.24, 0.22, 0.20) * (0.2 + rl)) * refl * 0.55 * exp(-depth * 6.0);
    // pointer rings on the water
    if (m.y > wl) {
      vec2 dd = (p - m * vec2(asp, 1.0)) * vec2(1.0, 2.6);
      float rr = length(dd);
      float ring = sin(rr * 70.0 - t * 2.0) * exp(-rr * 6.0);
      water += vec3(0.50, 0.70, 0.75) * max(ring, 0.0) * 0.12;
    }
    // soft warm glints
    float gl = smoothstep(0.62, 0.9, sp_n(vec2(p.x * 40.0, uv.y * 160.0 - t * 0.3)));
    water += warm * gl * 0.04 * exp(-depth * 5.0);
    col = water;
  }
  col += vec3(0.50, 0.62, 0.62) * smoothstep(0.005, 0.0, abs(uv.y - wl)) * 0.14;
  // steam: slow drifting mist off the water around the stones, thinning where the pointer is
  float thin = 1.0 - 0.6 * exp(-dot((p - m * vec2(asp, 1.0)) * vec2(1.0, 1.4), (p - m * vec2(asp, 1.0)) * vec2(1.0, 1.4)) * 10.0);
  vec2 q = vec2(p.x * 1.5, uv.y * 2.2);
  float n1 = sp_fbm(q + vec2(sin(t * 0.05) * 0.5, -t * 0.045));
  float n2 = sp_fbm(q * 1.7 + vec2(4.0 + t * 0.02, -t * 0.07) + n1 * 1.2);
  float rise = smoothstep(wl + 0.05, wl - 0.30, uv.y) * smoothstep(0.0, 0.15, wl - uv.y + 0.05);
  float steam = smoothstep(0.42, 0.85, n2) * rise * thin;
  col = mix(col, vec3(0.62, 0.70, 0.70), steam * 0.26);
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
