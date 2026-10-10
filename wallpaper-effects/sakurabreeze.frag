// label: Sakura breeze
// hint: cherry-blossom petals tumble at dusk, the pointer is a breeze that blows them away
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

const vec3 PETAL_PALE = vec3(1.00, 0.91, 0.95);
const vec3 PETAL_PINK = vec3(1.00, 0.72, 0.83);
const vec3 PETAL_DEEP = vec3(0.93, 0.44, 0.65);
const vec3 PETAL_BACK = vec3(0.84, 0.72, 0.95);   // the shaded side leans lavender
const vec3 PETAL_RIM = vec3(0.70, 0.30, 0.55);
const vec3 HAZE = vec3(0.62, 0.52, 0.85);          // distant petals melt into the lavender dusk

// the wallpaper in a soft pink-lavender twilight: lilac sky, a rose glow low down, plum corners
vec3 dusk(vec2 uv) {
  vec3 col = wall(uv);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l) * vec3(1.0, 0.88, 1.0), 0.18);
  col *= vec3(0.90, 0.84, 0.96);
  vec3 glow = mix(vec3(0.42, 0.34, 0.72) * 0.16, vec3(1.0, 0.55, 0.68) * 0.20, smoothstep(0.15, 0.95, uv.y));
  col = 1.0 - (1.0 - col) * (1.0 - glow);
  float v = pow(length((uv - 0.5) * vec2(1.0, 1.05)), 2.0);
  col = mix(col, vec3(0.10, 0.05, 0.19), clamp(v * 0.55, 0.0, 0.5));
  return col;
}

// one depth layer of tumbling petals on a drifting grid. A petal is a notched teardrop that spins on the screen and
// turns edge-on and back (foreshortening plus a lighter/shaded side), and the pointer shoves it away in a swirl.
void petals(inout vec3 col, vec2 p, vec2 mp, float sc, float fall, float wind, float size, float soft,
            float dens, float seed, float alpha, float haze, float push) {
  vec2 drift = vec2(wind, fall);
  vec2 g = p * sc - drift * time;
  vec2 base = floor(g);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = base + vec2(float(i), float(j));
      float h = hash(id + seed);
      if (h > dens) continue;
      float h2 = hash(id + seed + 3.1), h3 = hash(id + seed + 7.7), h4 = hash(id + seed + 11.3);
      vec2 cc = id + vec2(0.2 + 0.6 * h2, 0.2 + 0.6 * h3);
      cc += 0.28 * vec2(sin(time * 0.55 + h4 * 40.0), 0.6 * sin(time * 0.8 + h2 * 50.0)); // gentle sway
      vec2 pc = (cc + drift * time) / sc;
      // the breeze: petals near the pointer are pushed away along a swirl
      vec2 away = pc - mp;
      float d = length(away);
      float f = smoothstep(0.30, 0.0, d);
      vec2 dir = away / (d + 0.02);
      pc += (dir + 0.5 * vec2(-dir.y, dir.x)) * f * push / sc;
      vec2 r = p - pc;
      float reach = size * (1.5 + soft);
      if (dot(r, r) > reach * reach) continue;
      float a = h4 * 6.2832 + time * (0.5 + h3 * 1.1) * (h2 < 0.5 ? -1.0 : 1.0) + f * 3.0 * sin(time * 3.0 + h * 40.0);
      float ca = cos(a), sa = sin(a);
      vec2 u = vec2(ca * r.x + sa * r.y, -sa * r.x + ca * r.y) / size;
      float tx = cos(time * (0.7 + h2 * 0.9) + h * 30.0 + f * 2.0);   // turning towards / away from the viewer
      float ty = cos(time * (0.5 + h3 * 0.7) + h4 * 20.0);
      u.x /= 0.22 + 0.78 * abs(tx);
      u.y /= 0.55 + 0.45 * abs(ty);
      float w = max(0.55 + 0.22 * u.y, 0.2);                           // narrow at the base, wide near the notch
      float e = length(vec2(u.x / w, u.y)) - 1.0;
      float aa = 0.05 + soft;
      float cover = smoothstep(aa, -aa, e);
      cover *= smoothstep(0.12, 0.18 + aa, length(u - vec2(0.0, 1.0))); // the little notch at the tip
      if (cover <= 0.003) continue;
      vec3 c = mix(PETAL_DEEP, PETAL_PINK, smoothstep(-1.0, 0.0, u.y));
      c = mix(c, PETAL_PALE, smoothstep(0.1, 1.0, u.y) * 0.55);
      c = mix(c, PETAL_DEEP, 0.28 * smoothstep(0.14, 0.0, abs(u.x)) * smoothstep(0.7, -0.6, u.y)); // vein
      c = mix(c, PETAL_PALE, 0.25 * h3);
      c = mix(PETAL_BACK * (0.8 + 0.2 * c), c, smoothstep(-0.25, 0.25, tx));      // shaded back side
      c *= 0.82 + 0.18 * abs(tx);
      c = mix(c, PETAL_RIM, 0.35 * smoothstep(-0.32, -0.02, e) * (1.0 - soft));   // faint darker edge: reads on pink trees too
      c = mix(c, HAZE, haze);
      c *= 1.0 + 0.15 * f;
      col = mix(col, c, cover * alpha);
    }
  }
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  vec3 col = dusk(uv);
  //     scale fall wind  size   soft  dens seed alpha haze push
  petals(col, p, mp, 9.0, 0.35, 0.30, 0.0115, 0.20, 0.40, 1.0, 0.60, 0.40, 0.40);  // far: small, hazy, slow
  petals(col, p, mp, 6.0, 0.45, 0.50, 0.0190, 0.08, 0.45, 5.0, 0.92, 0.08, 0.45);  // middle: in focus
  petals(col, p, mp, 3.5, 0.50, 0.70, 0.0400, 0.40, 0.45, 9.0, 0.78, 0.00, 0.45);  // near: big, out of focus, fast
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
