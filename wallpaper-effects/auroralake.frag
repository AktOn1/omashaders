// label: Aurora lake
// hint: slow soft aurora over a still lake with a mirrored reflection, the ribbon leans toward the pointer
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
float al_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float al_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(al_hash(i), al_hash(i + vec2(1, 0)), f.x), mix(al_hash(i + vec2(0, 1)), al_hash(i + vec2(1, 1)), f.x), f.y);
}

const float AL_HZ = 0.72;   // horizon: the lake lies below it

// light of the sky at uv (additive, 0..~0.4): three slow curtains, a few faint stars. mp = pointer in uv units.
vec3 al_sky(vec2 uv, vec2 mp, float asp, float t) {
  vec3 acc = vec3(0.0);
  float x = uv.x * asp;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float y0 = 0.30 + 0.09 * fk + 0.09 * sin(x * (1.5 + 0.4 * fk) + t * (0.030 + 0.01 * fk) + fk * 2.1)
             + 0.04 * sin(x * (3.9 + fk) - t * 0.045 + fk * 4.0)
             + 0.06 * (al_noise(vec2(x * 1.6 + fk * 7.0 + t * 0.02, fk * 3.0)) - 0.5);
    // the pointer bends the ribbon toward itself and brightens it a little
    float dx = (x - mp.x * asp);
    float g = exp(-dx * dx / (2.0 * 0.20 * 0.20));
    float gy = exp(-pow(uv.y - mp.y, 2.0) / (2.0 * 0.30 * 0.30));
    y0 = mix(y0, mp.y, 0.28 * g);
    float up = y0 - uv.y;                                  // > 0 above the ribbon's lower edge
    float body = smoothstep(-0.035, 0.012, up) * exp(-max(up, 0.0) / (0.10 + 0.03 * fk));
    // soft vertical rays, drifting very slowly
    float rays = 0.40 + 0.60 * smoothstep(0.25, 0.80, al_noise(vec2(x * (26.0 + 8.0 * fk) + fk * 5.0 + sin(t * 0.05 + fk) * 2.0, up * 0.9 + t * 0.015)));
    float broad = 0.15 + 0.85 * smoothstep(0.30, 0.72, al_noise(vec2(x * 1.9 + fk * 9.0 - t * 0.025, 2.0 + fk)));   // curtains thin out and vanish in places
    float inten = body * rays * broad * (1.0 + 0.7 * g * gy);
    vec3 low = vec3(0.20, 0.95, 0.52);
    vec3 midc = vec3(0.12, 0.78, 0.78);
    vec3 hi = vec3(0.52, 0.34, 0.92);
    float h = clamp(up / 0.22, 0.0, 1.0);
    vec3 col = mix(mix(low, midc, smoothstep(0.0, 0.35, h)), hi, smoothstep(0.30, 0.95, h) * (0.55 + 0.2 * fk));
    acc += col * inten * (0.42 - 0.07 * fk);
  }
  // a few faint stars (sparse grid, slow twinkle)
  vec2 sp = vec2(x, uv.y) * 46.0;
  vec2 id = floor(sp), f = fract(sp) - 0.5;
  float h = al_hash(id + 3.7);
  if (h > 0.90) {
    vec2 o = (vec2(al_hash(id + 1.3), al_hash(id + 8.1)) - 0.5) * 0.6;
    float tw = 0.65 + 0.35 * sin(t * (0.25 + 0.3 * al_hash(id)) + h * 80.0);
    acc += vec3(0.80, 0.92, 1.0) * smoothstep(0.10, 0.0, length(f - o)) * tw * (0.20 + 0.25 * al_hash(id + 5.0));
  }
  return acc * smoothstep(AL_HZ + 0.02, AL_HZ - 0.12, uv.y);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 me = m;
  if (me.y > AL_HZ) me.y = 2.0 * AL_HZ - me.y;            // a pointer on the lake bends the ribbon above it
  vec3 col = wall(uv);

  // sky: the picture stays, a night tint and soft aurora light on top (screen blend, never harsh)
  vec3 sky = al_sky(uv, me, asp, time);
  vec3 dark = col * vec3(0.80, 0.93, 0.98);
  vec3 above = 1.0 - (1.0 - dark) * (1.0 - clamp(sky, 0.0, 0.9));

  // lake: mirrored sky and picture, darker and teal, with slow gentle ripples that grow away from the horizon
  float depth = max(uv.y - AL_HZ, 0.0);
  float w = al_noise(vec2(uv.x * 9.0, uv.y * 70.0 - time * 0.25));
  float amp = 0.0016 + 0.010 * depth;
  float rip = (w - 0.5) * 2.0 * amp;
  vec2 mw = vec2(m.x * asp, m.y);
  vec2 dm = vec2(uv.x * asp, uv.y) - mw;
  float dd = length(dm * vec2(1.0, 2.2));
  if (m.y > AL_HZ) {                                       // the pointer on the water makes slow rings that shake the reflection
    rip += 0.006 * sin(dd * 70.0 - time * 2.2) * exp(-dd * 7.0);
  }
  vec2 ruv = vec2(uv.x + rip, AL_HZ - depth * 1.7 - abs(rip) * 0.5);   // the reflection is a little compressed, so more of the sky shows in the lake
  vec3 refl = wall(ruv) * vec3(0.52, 0.72, 0.80);
  vec3 rsky = al_sky(ruv, me, asp, time) * 0.65;
  refl = 1.0 - (1.0 - refl) * (1.0 - clamp(rsky, 0.0, 0.8));
  refl += vec3(0.004, 0.014, 0.020);
  refl *= 1.0 - 0.35 * smoothstep(AL_HZ, 1.0, uv.y);        // deeper toward the viewer
  float glint = smoothstep(0.80, 1.0, al_noise(vec2(uv.x * 40.0 + time * 0.1, uv.y * 160.0 - time * 0.3)));
  refl += vec3(0.20, 0.45, 0.45) * glint * 0.10 * (1.0 - depth * 1.5);
  float water = smoothstep(AL_HZ - 0.002, AL_HZ + 0.008, uv.y);
  col = mix(above, refl, water);
  // faint haze line along the far shore
  col += vec3(0.05, 0.16, 0.14) * smoothstep(0.035, 0.0, abs(uv.y - AL_HZ)) * 0.8;
  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
