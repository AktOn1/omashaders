// label: Sun motes
// hint: slanting sunbeams, dust motes that drift away from the pointer
// category: Calm scenes
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
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}




vec2 sm_rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

// slanting sunbeams: soft bands of light falling from the upper left, breathing very slowly
float sm_beams(vec2 p) {
  vec2 q = sm_rot(p - vec2(-0.15, -0.15), 0.62);          // q.y runs along the beam, q.x across it
  float across = q.x;
  float b = noise(vec2(across * 3.1 + time * 0.012, 2.0)) * 0.55
          + noise(vec2(across * 7.3 - time * 0.010, 6.0)) * 0.30
          + noise(vec2(across * 15.0 + time * 0.007, 11.0)) * 0.15;
  b = smoothstep(0.40, 0.70, b);
  float breathe = 0.75 + 0.25 * sin(time * 0.17 + across * 2.0) ;
  float along = exp(-max(q.y, 0.0) * 0.70);              // beams fade out with distance from the window
  float soft = noise(vec2(across * 1.3 + 3.0, q.y * 1.7 - time * 0.02));   // slow drifting density along the beam
  return b * breathe * along * (0.55 + 0.45 * soft);
}

// one layer of dust motes: a jittered mote per grid cell, wandering lazily, twinkling as it turns in the light
float sm_motes(vec2 p, float scale, float rad, float drift, float seed, float lit) {
  vec2 g = p * scale;
  g += vec2(time * drift * 0.35 + sin(time * 0.05 + seed) * 0.6, time * drift);
  g += 0.55 * vec2(noise(g * 0.45 + seed + time * 0.02) - 0.5, noise(g * 0.45 + seed + 9.1 - time * 0.017) - 0.5);
  vec2 id = floor(g), f = fract(g) - 0.5;
  float h = hash(id + seed);
  if (h < 0.55) return 0.0;
  vec2 o = (vec2(hash(id + seed + 3.1), hash(id + seed + 6.7)) - 0.5) * 0.55;
  o += 0.14 * vec2(sin(time * 0.35 + h * 40.0), cos(time * 0.29 + h * 23.0));
  float r = rad * (0.6 + 0.8 * hash(id + seed + 1.3));
  float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(time * (0.35 + h * 0.6) + h * 90.0), 2.0);
  float d = length(f - o);
  return (smoothstep(r, r * 0.12, d) * 0.85 + smoothstep(r * 3.2, 0.0, d) * 0.18) * tw * lit;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  vec3 col = wall(uv);

  // late-afternoon grade: the picture warms and softens a little, shadows lift toward brown
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l) * vec3(1.18, 0.98, 0.72) + vec3(0.02, 0.012, 0.004), 0.30);
  col += vec3(0.05, 0.030, 0.012) * (1.0 - uv.y * 0.6);

  // sun in the upper left corner
  vec2 sd = (uv - vec2(0.0, 0.0)) * vec2(asp, 1.0);
  col += vec3(1.0, 0.78, 0.45) * 0.10 * exp(-dot(sd, sd) * 1.1);

  // the pointer: dust is pushed away and swirls round it (applied as a warp of where motes are looked up)
  vec2 dm = p - mp;
  float dl = length(dm);
  float wind = exp(-dl * dl / (2.0 * 0.19 * 0.19));
  vec2 pw = mp + sm_rot(dm * (1.0 - 0.62 * wind), 0.9 * wind);   // magnified and turned: motes slide outward and curl round the pointer

  float beams = sm_beams(pw);
  // the beams part a little where the pointer pushes the air
  beams *= 1.0 - 0.35 * wind;
  vec3 sunCol = vec3(1.0, 0.80, 0.46);
  col += sunCol * beams * 0.36;
  col = mix(col, col * vec3(1.15, 1.0, 0.78), beams * 0.35);

  // motes: far ones small and numerous, near ones big, soft and slow; all brighter inside a beam and near the sun
  float glow = 0.35 + 1.15 * beams + 0.25 * exp(-dot(sd, sd) * 0.8);
  float mo = sm_motes(pw, 20.0, 0.085, 0.006, 1.0, glow)
           + 0.8 * sm_motes(pw + 0.31, 10.0, 0.09, 0.009, 7.0, glow)
           + 0.55 * sm_motes(pw + 0.67, 4.5, 0.11, 0.013, 19.0, glow);
  col += vec3(1.0, 0.84, 0.50) * mo * 0.85;

  // a warm gleam round the pointer, where the swirl catches the light
  col += vec3(1.0, 0.82, 0.50) * 0.05 * exp(-dl * dl / (2.0 * 0.07 * 0.07));

  // warm brown vignette
  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0) * vec3(0.8, 1.0, 1.25);
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
