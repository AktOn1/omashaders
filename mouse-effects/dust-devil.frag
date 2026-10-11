#version 440
// category: Focus
// desc: Dust devil: a small whirlwind of dust grains spirals up out of the pointer in a leaning funnel, wide at the top and tight at the foot, with a pale dusty veil inside and a scuffed skirt on the ground. It leans away from the way the pointer moves
// motion: yes
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec4 h0;
  vec4 h1;
  vec4 h2;
  vec4 h3;
};

float dd_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float dd_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dd_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dd_h2(i), dd_h2(i + vec2(1.0, 0.0)), f.x), mix(dd_h2(i + vec2(0.0, 1.0)), dd_h2(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec2 mv = mouse - h2.xy;                       // recent motion: the funnel leans the other way
  float spd = length(mv);
  vec2 lean = spd > 1.0 ? -mv / spd * min(spd, 60.0) / 60.0 : vec2(0.0);
  float H = 84.0;                                // height of the funnel in px
  vec3 lit = vec3(1.0, 0.86, 0.62);
  vec3 mid = vec3(0.86, 0.62, 0.36);
  vec3 dark = vec3(0.50, 0.32, 0.18);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // the veil: a soft translucent cone of dust, noisy, twisting
  float f = (mouse.y - p.y) / H;                 // 0 at the ground, 1 at the top
  if (f > -0.1 && f < 1.15) {
    float fc = clamp(f, 0.0, 1.0);
    float xc = mouse.x + lean.x * 30.0 * fc * fc + sin(fc * 5.0 - time * 1.8) * 2.5 * fc;
    float w = 5.0 + 30.0 * pow(fc, 1.15);
    float u = (p.x - xc) / w;
    float twist = dd_noise(vec2(u * 2.4 + time * 0.5, fc * 6.0 - time * 1.9));
    float veil = exp(-u * u * 1.7) * (0.35 + 0.65 * twist) * smoothstep(1.15, 0.8, f) * smoothstep(-0.1, 0.05, f);
    veil *= 0.55 + 0.55 * (1.0 - fc * 0.6);
    vec3 vc = mix(dark, lit, smoothstep(-1.0, 1.0, u + (twist - 0.5)));
    col += vc * veil;
    alpha += veil;
  }

  // the grains: each one climbs the funnel on a spiral, circling faster near the foot
  for (int k = 0; k < 26; k++) {
    float kf = float(k);
    float s = kf * 3.17;
    float life = fract(time * (0.22 + 0.12 * dd_hash(s + 1.0)) + dd_hash(s));
    float hh = life;
    float ang = time * (5.5 - 2.5 * hh) + dd_hash(s + 2.0) * 6.283 + hh * 4.0;
    float r = (3.5 + 30.0 * pow(hh, 1.15)) * (0.8 + 0.4 * dd_hash(s + 3.0));
    vec2 gp = vec2(mouse.x + cos(ang) * r + lean.x * 30.0 * hh * hh, mouse.y - hh * H + sin(ang) * r * 0.30 + lean.y * 8.0 * hh);
    float depth = sin(ang);                      // +1 near the viewer, -1 behind the funnel
    float sz = (1.8 + 1.5 * dd_hash(s + 4.0)) * (0.8 + 0.25 * depth);
    float g = smoothstep(sz, sz * 0.25, length(p - gp));
    float fade = smoothstep(0.0, 0.08, hh) * smoothstep(1.0, 0.7, hh);
    float ga = g * fade * (0.55 + 0.4 * depth);
    vec3 gc = mix(dark, lit, 0.5 + 0.5 * depth * 0.8 + 0.2 * sin(time * 8.0 + s));
    col += gc * ga;
    alpha += ga;
  }

  // the skirt: scuffed dust on the ground at the pointer, slowly rotating streaks
  vec2 sq = (p - (mouse + vec2(0.0, 3.0))) / vec2(36.0, 8.0);
  float skirt = exp(-dot(sq, sq)) * (0.5 + 0.5 * dd_noise(vec2(p.x * 0.18 - time * 2.4, p.y * 0.5)));
  col += mid * skirt * 0.45;
  alpha += skirt * 0.45;

  // a tiny bright glint at the pointer so it is always found
  float dm = length(p - mouse);
  float core = smoothstep(8.0, 0.0, dm) * 0.35;
  col += lit * core;
  alpha += core;

  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col / max(alpha, 1e-4), 0.0, 1.0) * a, a) * qt_Opacity;
}
