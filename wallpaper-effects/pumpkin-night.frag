// label: Pumpkin night
// hint: a bunch of painted jack-o-lanterns float over your wallpaper; they glow brighter, lean away and bob when the pointer comes close, with a few embers. No scenery: your picture stays
// category: Seasons and festivals
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
layout(binding = 2) uniform sampler2D sprites; // pumpkin-night.png: 4 x 2 cells of 256 px, each a pumpkin cut-out

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
float pkn_h(float n) { return fract(sin(n * 127.1) * 43758.5453); }

// one floating pumpkin: x, y (fractions of the screen), radius (fraction of the screen height), sprite cell
vec4 pkn_spot(int i) {
  if (i == 0) return vec4(0.035, 0.30, 0.050, 6.0);
  if (i == 1) return vec4(0.965, 0.18, 0.062, 7.0);
  if (i == 2) return vec4(0.105, 0.59, 0.044, 3.0);
  if (i == 3) return vec4(0.915, 0.52, 0.042, 5.0);
  if (i == 4) return vec4(0.285, 0.955, 0.050, 2.0);
  if (i == 5) return vec4(0.735, 0.965, 0.046, 4.0);
  if (i == 6) return vec4(0.185, 0.905, 0.075, 5.0);
  if (i == 7) return vec4(0.825, 0.905, 0.080, 2.0);
  if (i == 8) return vec4(0.065, 0.805, 0.112, 0.0);
  return vec4(0.945, 0.815, 0.108, 1.0);
}

vec3 pkn_over(vec3 base, vec3 c, float a) { return mix(base, c, a); }

vec4 fxMain(vec2 mpx) {
  float asp = res.x / res.y;
  vec2 uv = qt_TexCoord0;
  vec2 p = vec2(uv.x * asp, uv.y);
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? vec2(mpx.x / res.y, mpx.y / res.y) : vec2(-10.0);
  vec2 par = has ? (vec2(mpx.x / res.x, mpx.y / res.y) - vec2(0.5, 0.5)) : vec2(0.0);
  float t = time;
  vec3 col = wall(uv);
  vec3 glow = vec3(0.0);

  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    vec4 sp = pkn_spot(i);
    float r = sp.z;
    float depth = 0.5 + 0.5 * smoothstep(0.04, 0.11, r); // big ones are near, they shift more with the pointer
    vec2 home = vec2(sp.x * asp, sp.y);
    home += par * depth * 0.035 * vec2(-1.0, -1.0);
    // slow figure-of-eight drift and bob
    home += vec2(0.006 * sin(t * 0.37 + fi * 2.1), 0.010 * sin(t * 0.61 + fi * 1.3)) * (0.6 + r * 6.0);
    // pointer: lean away and hop when it comes close, glow from further away
    vec2 d = home - mp;
    float dist = length(d);
    float reach = 0.16 + r * 2.4;
    float push = exp(-pow(dist / reach, 2.0));
    float see = exp(-pow(dist / (0.55 + r * 3.0), 2.0));
    vec2 away = d / (dist + 0.04);
    vec2 c = home + away * push * (0.02 + r * 0.65) - vec2(0.0, push * r * 0.25);
    float tilt = (clamp(away.x, -1.0, 1.0) * 0.55 + 0.12 * sin(t * 0.9 + fi * 1.7)) * push + 0.045 * sin(t * 0.7 + fi * 3.0) * (1.0 - push);
    float sq = 1.0 - 0.10 * push + 0.025 * sin(t * 1.6 + fi);
    vec2 q0 = p - c;
    float flick = 0.86 + 0.14 * sin(t * (5.0 + fi * 0.9) + fi * 3.0) * sin(t * 2.3 + fi) + 0.04 * sin(t * 13.0 + fi * 7.0);
    float lamp = step(sp.w, 5.5); // cells 0-5 are lit jack-o-lanterns, 6 and 7 are not
    float lit = 0.55 + 0.9 * see + 0.55 * push;

    float dc = length(q0);
    if (dc < r * 3.4) {
      // soft light spilling on the picture around the pumpkin
      float hl = exp(-dc * dc / (r * r * 3.2));
      glow += vec3(1.0, 0.46, 0.10) * hl * 0.30 * flick * lit * lamp;
    }
    float cs = cos(tilt), sn = sin(tilt);
    vec2 q = vec2(cs * q0.x + sn * q0.y, -sn * q0.x + cs * q0.y) / r;
    q.y /= sq; q.x *= sq;
    if (pkn_h(fi * 3.7) > 0.5) q.x = -q.x;
    if (abs(q.x) < 1.0 && abs(q.y) < 1.0) {
      float cell = sp.w;
      vec2 cuv = (vec2(mod(cell, 4.0), floor(cell / 4.0)) + 0.5 + q * 0.453) / vec2(4.0, 2.0);
      vec4 s = texture(sprites, cuv);
      float lum = dot(s.rgb, vec3(0.299, 0.587, 0.114));
      float emis = smoothstep(0.50, 0.88, lum) * smoothstep(0.10, 0.45, s.r - s.b);
      vec3 pc = s.rgb * (0.80 + 0.12 * flick);
      pc *= 1.0 + 0.55 * see + 0.30 * push;
      pc += vec3(1.0, 0.62, 0.20) * emis * lamp * (0.25 + 0.55 * see + 0.30 * push) * flick;
      pc = mix(pc, pc * vec3(1.0, 0.93, 0.85), 0.5);
      col = pkn_over(col, pc, s.a);
    }
  }
  col += glow;

  // a few embers rising from the pumpkins; the pointer blows them aside
  for (int k = 0; k < 14; k++) {
    float fk = float(k);
    vec4 sp = pkn_spot(k - (k / 10) * 10);
    float life = fract(t * (0.055 + 0.02 * pkn_h(fk + 1.0)) + pkn_h(fk * 7.1));
    float seed = floor(t * (0.055 + 0.02 * pkn_h(fk + 1.0)) + pkn_h(fk * 7.1)) + fk * 13.0;
    vec2 o = vec2(sp.x * asp + (pkn_h(seed) - 0.5) * sp.z * 2.0, sp.y - sp.z * 0.6);
    vec2 e = o + vec2(0.03 * sin(life * 9.0 + fk) + (pkn_h(seed + 3.0) - 0.5) * 0.06 * life, -life * (0.10 + 0.14 * pkn_h(fk + 5.0)));
    vec2 de = e - mp;
    float dl = length(de);
    e += de / (dl + 0.03) * 0.07 * exp(-pow(dl / 0.18, 2.0));
    float sz = 0.0045 + 0.0035 * pkn_h(fk + 9.0);
    float a = exp(-dot(p - e, p - e) / (sz * sz)) * smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.55, life);
    col += vec3(1.0, 0.58, 0.16) * a * 1.2 + vec3(1.0, 0.45, 0.10) * a * 0.0;
  }
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
