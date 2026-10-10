// label: Lavender fields
// hint: lavender rows swaying at dusk, fireflies near mouse
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
float lf_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lf_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lf_h(i), lf_h(i + vec2(1, 0)), f.x), mix(lf_h(i + vec2(0, 1)), lf_h(i + vec2(1, 1)), f.x), f.y);
}

// a few fireflies: one per jittered cell, drifting on slow loops, glowing in slow pulses; the pointer draws them in and wakes them up
vec3 lf_flies(vec2 p, vec2 mp, float sc, float seed, float t, float asp) {
  vec2 g = p * sc;
  vec2 id = floor(g);
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = id + vec2(float(i), float(j));
      float h = lf_h(cell + seed);
      if (h < 0.55) continue;
      float h2 = lf_h(cell + seed + 4.3), h3 = lf_h(cell + seed + 8.9);
      vec2 c = cell + 0.5 + 0.38 * vec2(sin(t * (0.10 + h2 * 0.12) + h * 40.0), cos(t * (0.09 + h3 * 0.12) + h2 * 30.0));
      vec2 w = c / sc;
      vec2 dmv = (mp - w) * vec2(asp, 1.0);
      float dm = length(dmv);
      float near = smoothstep(0.30, 0.0, dm);
      c += (dmv / max(dm, 0.001)) * near * 0.18 * sc;          // drifts toward the pointer
      float idle = 0.25 + 0.55 * pow(0.5 + 0.5 * sin(t * (0.30 + h3 * 0.35) + h * 60.0), 2.0);
      float lum = idle + near * 0.55;
      vec2 dd = g - c;
      float d2 = dot(dd, dd);
      float core = exp(-d2 * 520.0 / (sc * 0.12));
      float halo = exp(-d2 * 34.0 / (sc * 0.12));
      vec3 tint = mix(vec3(0.62, 0.95, 0.35), vec3(1.0, 0.85, 0.40), h2);
      acc += lum * (tint * halo * 0.20 + vec3(1.0, 0.97, 0.70) * core * 0.75);
    }
  }
  return acc;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.2126, 0.7152, 0.0722));

  // dusk light: violet sky, rose glow low down, kept gentle so the picture stays the picture
  float hz = 0.66;
  vec3 skyTop = vec3(0.30, 0.20, 0.55);
  vec3 skyLow = vec3(0.95, 0.52, 0.62);
  float sk = smoothstep(0.0, 0.85, uv.y);
  vec3 dusk = mix(skyTop, skyLow, sk);
  col = mix(col, col * 0.86 + dusk * 0.30, 0.55);
  float glowBand = exp(-pow((uv.y - hz) / 0.17, 2.0));
  col += vec3(0.95, 0.50, 0.55) * glowBand * 0.10 * (0.6 + 0.4 * lf_n(vec2(p.x * 1.4 + time * 0.01, 3.0)));

  // lavender rows in perspective: they run toward a vanishing point on the horizon
  float dy = uv.y - hz;
  if (dy > 0.0) {
    float depth = 1.0 / max(dy, 0.001);
    float xr = (uv.x - 0.5) * asp * depth * 1.5;     // lateral position in row units (rows are 1.0 apart)
    // breeze: waves roll across the field; sway grows toward the viewer; the pointer leans plants away from it
    float wave = sin(time * 0.45 + depth * 0.9 + xr * 0.10) * 0.55 + sin(time * 0.31 + depth * 1.7 - xr * 0.16) * 0.35;
    vec2 dm = (uv - m) * vec2(asp, 1.0);
    float dl = length(dm);
    float stir = exp(-dl * dl / (2.0 * 0.13 * 0.13));
    float lean = stir * (dm.x / max(dl, 0.02)) * (0.8 + 0.2 * sin(time * 1.1));
    float xs = xr + (wave * 0.10 + lean * 0.30) * clamp(dy * 4.0, 0.0, 1.0);
    float rowId = floor(xs);
    float rf = fract(xs) - 0.5;                        // -0.5..0.5 across the row
    float rh = lf_h(vec2(rowId, 7.0));
    float rw = 0.40 + 0.06 * rh;                       // bush half-width
    float edge = smoothstep(rw, rw * 0.5, abs(rf));
    // flower spikes: elongated clusters, finer toward the horizon; each row has its own pattern
    float f1 = lf_n(vec2(xs * 6.0 + wave * 0.5, depth * 5.0 + rowId * 3.1));      // soft mottling along the row
    float f2 = lf_n(vec2(xs * 26.0 + 2.0 + rowId * 9.0, depth * 1.6));            // fine stalks running along the row
    float fine = smoothstep(0.07, 0.22, dy);          // fine detail only where it can be resolved
    float spikes = mix(0.5, smoothstep(0.2, 0.8, f1 * 0.6 + f2 * 0.4), fine) * (0.75 + 0.25 * smoothstep(0.45, 0.0, abs(rf)));
    float plants = 0.75 + 0.25 * lf_n(vec2(rowId * 5.0, depth * 0.7));
    float near = smoothstep(0.03, 0.25, dy);           // fades out toward the horizon (no aliasing, no hard edge)
    float cover = edge * near * plants;
    vec3 shade = vec3(0.17, 0.10, 0.32);
    vec3 lav = mix(vec3(0.48, 0.36, 0.84), vec3(0.76, 0.62, 0.97), f2);
    vec3 pc = mix(shade, lav, 0.25 + 0.75 * spikes);
    pc = mix(pc, vec3(1.0, 0.74, 0.68), 0.22 * spikes * f1 * (1.0 - dy));    // rose-gold on the tops from the low sun
    col *= 1.0 - 0.22 * (1.0 - edge) * near;           // soil between the rows
    float a = clamp(cover * (0.30 + 0.26 * spikes), 0.0, 0.56);
    col = mix(col, pc * (0.7 + 0.3 * lum0), a);
  }

  // a few fireflies
  vec3 fl = lf_flies(p, m, 5.0, 0.0, time, asp) + 0.7 * lf_flies(p + 3.7, m, 8.0, 17.0, time, asp);
  col += fl * 0.8;

  col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(1.0, 1.05)), 2.0);
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
