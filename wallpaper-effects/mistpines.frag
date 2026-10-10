// label: Misty pines
// hint: layered pine ridges in drifting fog, the mist parts at the pointer
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




// rolling hills of one ridge: the smooth screen y of its crest (0 = top of screen)
float mp_hills(float x, float base, float amp, float hscale, float seed) {
  return base + (noise(vec2(x * hscale + seed, seed * 1.7)) * 0.65 + noise(vec2(x * hscale * 2.3 + seed + 5.0, 3.0)) * 0.35 - 0.5) * amp;
}
// height of the pine fringe on top of the crest at x: jittered, uneven trees of varied width and height
float mp_trees(float x, float seed, float tcount, float tH) {
  float tx = x * tcount;
  float id = floor(tx);
  float best = 0.0;
  for (int k = -1; k <= 1; k++) {
    float cell = id + float(k);
    float hr = 0.30 + 0.70 * hash(vec2(cell, seed));
    hr *= 0.75 + 0.25 * noise(vec2(cell * 0.21, seed));              // clumps of taller and shorter trees
    float wide = 0.80 + 0.55 * hash(vec2(cell + 7.0, seed));
    float cx = cell + 0.5 + (hash(vec2(cell + 3.0, seed)) - 0.5) * 0.7;
    float tri = max(0.0, 1.0 - abs(tx - cx) / wide);
    tri = pow(tri, 1.45);
    best = max(best, tH * hr * tri);
  }
  return best;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  vec3 col = wall(uv);

  // cool dawn grade: the picture goes a little blue-green and quiet
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l) * vec3(0.78, 0.98, 1.0) + vec3(0.0, 0.012, 0.018), 0.30);
  // pale dawn glow low in the sky, behind the farthest ridge
  col += vec3(0.50, 0.62, 0.60) * 0.10 * exp(-pow((uv.y - 0.50) / 0.22, 2.0)) * (0.8 + 0.2 * noise(vec2(p.x * 1.3, 4.0)));

  // pointer: the mist parts around it (a soft, wide oval)
  vec2 dm = (p - mp) * vec2(0.8, 1.7);
  float part = exp(-dot(dm, dm) / (2.0 * 0.25 * 0.25));

  vec3 fogCol = vec3(0.70, 0.80, 0.82);
  for (int j = 0; j < 5; j++) {
    float f = float(j) / 4.0;                         // 0 far, 1 near
    float base = 0.56 + 0.34 * f;                      // ridge baseline moves down the screen
    float sc = 0.9 + 0.9 * f;
    float tcount = 90.0 - 52.0 * f;                    // fewer, larger trees up close
    float tH = 0.014 + 0.062 * f;
    float amp = 0.06 + 0.06 * f;
    float seed = 3.0 + 11.0 * float(j);
    float crest = mp_hills(p.x, base, amp, sc * 1.25, seed);
    float top = crest - mp_trees(p.x, seed, tcount, tH);
    float e = 0.0016 + 0.0016 * (1.0 - f);
    float cover = smoothstep(top - e, top + e, uv.y);
    // ridge colour: dark spruce at the top edge, fading into the mist toward its foot; far layers are paler
    vec3 nearCol = vec3(0.045, 0.12, 0.12);
    vec3 farCol = vec3(0.34, 0.46, 0.50);
    vec3 rc = mix(farCol, nearCol, pow(f, 0.8));
    float foot = smoothstep(crest, crest + 0.14 + 0.10 * f, uv.y);
    rc = mix(rc, fogCol * 0.85, foot * (0.60 - 0.25 * f));
    float a = mix(0.26, 0.55, f) * (1.0 - 0.35 * foot);
    col = mix(col, rc, cover * a);

    // fog bank in front of this layer: a band that hugs the layer's lower slopes and drifts sideways at its own pace
        float band = exp(-pow((uv.y - (base + 0.10 - 0.06 * f)) / (0.10 + 0.04 * f), 2.0));
    float drift = time * (0.006 + 0.004 * f) * (mod(float(j), 2.0) < 0.5 ? 1.0 : -1.0);
    float bank = noise(vec2((p.x + drift) * (1.6 + 0.6 * f), uv.y * 4.0 + float(j) * 3.0)) * 0.6
               + noise(vec2((p.x - drift * 1.7) * (3.7 + f), uv.y * 7.0 + 9.0 + float(j))) * 0.4;
    float fog = band * smoothstep(0.38, 0.72, bank) * (1.0 - 0.9 * part);
    col = mix(col, fogCol, fog * (0.50 - 0.12 * f));
  }

  // soft cool mist veil along the bottom, with a clear gap at the pointer
  float veil = smoothstep(0.62, 1.05, uv.y) * (1.0 - 0.8 * part);
  col = mix(col, fogCol * 0.7, veil * 0.22);

  // cool vignette
  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
