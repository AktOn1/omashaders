// label: Moon lake
// hint: a full moon over a calm lake with a silver reflection path and drifting mist, the pointer ripples the water
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
float ml_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ml_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ml_hash(i), ml_hash(i + vec2(1, 0)), f.x), mix(ml_hash(i + vec2(0, 1)), ml_hash(i + vec2(1, 1)), f.x), f.y);
}
float ml_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * ml_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

const float ML_HZ = 0.68;   // horizon: the lake lies below it

// one low bank of mist: a long, flat, slowly drifting cloud of fog; returns 0..1 density
float ml_bank(vec2 p, float yc, float thick, float speed, float seed, float t) {
  float n = ml_fbm(vec2(p.x * 1.3 - t * speed + seed, p.y * 5.0 + seed * 0.7));
  float prof = exp(-pow((p.y - yc) / thick, 2.0));
  return smoothstep(0.30, 0.68, n) * prof;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  vec2 moonC = vec2(0.64 * asp, 0.27);
  float t = time;

  vec3 col = wall(uv);
  float depth = max(uv.y - ML_HZ, 0.0);

  // ---- the sky: a cool night wash, a large soft moon with a halo, a few faint stars
  float dm = length(p - moonC);
  float R = 0.072;
  float halo = exp(-dm * dm / (2.0 * 0.12 * 0.12)) * 0.26 + exp(-dm * dm / (2.0 * 0.34 * 0.34)) * 0.12;
  vec3 night = col * vec3(0.78, 0.88, 1.0) + vec3(0.004, 0.010, 0.026);
  float edge = smoothstep(R, R * 0.84, dm);
  vec2 mq = (p - moonC) / R;
  float maria = ml_fbm(mq * 1.7 + 4.0) * 0.6 + ml_fbm(mq * 4.0 + 9.0) * 0.4;
  vec3 disc = mix(vec3(0.95, 0.97, 1.0), vec3(0.70, 0.78, 0.90), smoothstep(0.42, 0.72, maria) * 0.55);
  disc *= 0.80 + 0.20 * sqrt(max(1.0 - dot(mq, mq), 0.0));                 // limb darkening
  vec3 sky = night + vec3(0.55, 0.68, 0.95) * halo;
  sky = mix(sky, disc, edge * 0.86);
  // stars: sparse, tiny, dimmed near the moon, slow shallow twinkle
  vec2 sp = p * 52.0;
  vec2 sid = floor(sp), sf = fract(sp) - 0.5;
  float sh = ml_hash(sid + 5.3);
  if (sh > 0.93) {
    vec2 so = (vec2(ml_hash(sid + 1.7), ml_hash(sid + 6.1)) - 0.5) * 0.6;
    float tw = 0.7 + 0.3 * sin(t * (0.3 + 0.4 * ml_hash(sid)) + sh * 70.0);
    float s = smoothstep(0.11, 0.0, length(sf - so)) * tw * (0.25 + 0.35 * ml_hash(sid + 2.9));
    sky += vec3(0.82, 0.92, 1.0) * s * smoothstep(0.10, 0.28, dm) * (1.0 - smoothstep(ML_HZ - 0.1, ML_HZ, uv.y));
  }

  // ---- the lake: dark cool water, the picture shimmering gently under it, a silver path under the moon
  float disturb = 0.0;                                             // the pointer on the water: slow rings
  float ringPhase = 0.0;
  if (m.y > ML_HZ) {
    vec2 dd = (p - mp) * vec2(1.0, 2.0);
    float r = length(dd);
    disturb = exp(-r * 5.5);
    ringPhase = sin(r * 85.0 - t * 2.4) * disturb;
  }
  float wv = (ml_noise(vec2(uv.x * 14.0, uv.y * 90.0 - t * 0.2)) - 0.5) * (0.003 + 0.012 * depth);
  vec2 wuv = vec2(uv.x + wv + ringPhase * 0.004, uv.y);
  vec3 water = wall(wuv) * vec3(0.30, 0.42, 0.58) + vec3(0.004, 0.010, 0.022);
  water += vec3(0.02, 0.04, 0.07) * (1.0 - smoothstep(0.0, 0.14, depth));          // sky light near the far shore
  water *= 1.0 - 0.30 * smoothstep(0.0, 0.32, depth);

  // the reflection path: a column of short horizontal glints that widens toward the viewer
  float pw = 0.022 + 0.20 * depth;
  float pdx = p.x - moonC.x + (ml_noise(vec2(uv.y * 30.0 - t * 0.15, 3.0)) - 0.5) * (0.02 + 0.07 * depth) + ringPhase * 0.012;
  float prof = exp(-pdx * pdx / (2.0 * pw * pw));
  vec2 gp = vec2(p.x * 38.0, (uv.y + ringPhase * 0.012) * 190.0 - t * 0.45);
  float gl = ml_noise(gp) * 0.6 + ml_noise(gp * vec2(2.1, 2.3) + 7.0) * 0.4;
  float glints = smoothstep(0.52, 0.86, gl);
  float pathFade = 1.0 - smoothstep(0.0, 0.30, depth) * 0.55;
  float soft = exp(-pdx * pdx / (2.0 * (pw * 1.8) * (pw * 1.8))) * 0.10;
  float pathL = (prof * glints * 0.60 + soft) * pathFade;
  pathL *= 1.0 + 0.8 * disturb;                                   // the disturbed water throws more light
  water += vec3(0.78, 0.86, 1.0) * pathL;
  // a thin ring of light where the pointer touches the water
  water += vec3(0.55, 0.65, 0.85) * max(ringPhase, 0.0) * 0.10;

  float wmask = smoothstep(ML_HZ - 0.002, ML_HZ + 0.006, uv.y);
  col = mix(sky, water, wmask);
  col += vec3(0.10, 0.14, 0.22) * smoothstep(0.012, 0.0, abs(uv.y - ML_HZ)) * 0.55;    // far shore line

  // ---- mist: two slow low banks, thinning where the pointer is
  float thin = 1.0 - 0.7 * exp(-pow(length((p - mp) * vec2(1.0, 1.6)) / 0.20, 2.0));
  float b1 = ml_bank(p, ML_HZ - 0.03, 0.075, 0.012, 3.0, t);
  float b2 = ml_bank(p * 1.2 + 5.0, ML_HZ + 0.07, 0.065, -0.008, 11.0, t);
  float b3 = ml_bank(p * 0.8 + 9.0, ML_HZ - 0.15, 0.06, 0.006, 21.0, t) * 0.6;
  float mist = clamp(b1 * 0.60 + b2 * 0.45 + b3, 0.0, 1.0) * thin;
  vec3 mistCol = vec3(0.60, 0.70, 0.84) * (0.85 + 0.30 * halo * 4.0 * smoothstep(0.5, 0.0, abs(p.x - moonC.x)));
  col = mix(col, mistCol, mist * 0.55);

  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
