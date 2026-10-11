// label: Oasis noon
// hint: a desert oasis in the white heat of noon: dunes, palms and a turquoise pond that rings where the pointer touches it
// category: Wild places
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
float on_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float on_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(on_hash(i), on_hash(i + vec2(1, 0)), f.x), mix(on_hash(i + vec2(0, 1)), on_hash(i + vec2(1, 1)), f.x), f.y);
}
float on_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * on_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float on_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// dune height (up is positive) along x
float on_dune(float x, float seed, float freq, float amp) {
  return amp * (on_noise(vec2(x * freq, seed)) * 0.75 + on_noise(vec2(x * freq * 2.7, seed + 5.0)) * 0.25);
}

// one palm: trunk and fronds, returns coverage 0..1. c = crown, b = base on the ground
float on_palm(vec2 p, vec2 c, vec2 b, float seed, float t) {
  float cov = 0.0;
  float sway = sin(t * 0.7 + seed * 5.0) * 0.006;
  // trunk
  float s = (p.y - c.y) / max(b.y - c.y, 0.001);
  if (s > 0.0 && s < 1.0) {
    float xc = mix(c.x + sway * (1.0 - s), b.x, s * s) + 0.006 * sin(s * 5.0 + seed);
    float wd = 0.0042 + 0.0036 * s;
    cov = max(cov, smoothstep(wd, wd * 0.5, abs(p.x - xc)));
  }
  // fronds: eight leaves, arching out and drooping, with a comb of leaflets
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float side = mod(fi, 2.0) < 1.0 ? -1.0 : 1.0;
    float k = floor(fi / 2.0);                                    // 0..3
    float lift = 0.60 - 0.30 * k + 0.08 * sin(seed * 11.0 + fi * 3.1);
    float droop = 0.20 + 0.16 * k;
    float L = 0.135 - 0.011 * k + 0.012 * on_hash(vec2(seed, fi));
    float u = side * (p.x - c.x - sway * 1.5) / L;               // 0 at the crown, 1 at the tip
    if (u > 0.0 && u < 1.0) {
      float fy = c.y - lift * L * u * (1.0 - u * 0.2) + droop * L * u * u * 1.6 + sway * u * u;
      float wdt = 0.019 * pow(1.0 - u, 0.6) * (0.55 + 0.45 * abs(sin(u * L * 420.0 + fi)));
      cov = max(cov, smoothstep(wdt, wdt * 0.3, abs(p.y - fy)) * smoothstep(0.0, 0.05, u));
    }
  }
  // a young frond straight up
  float uu = (c.y - p.y) / 0.07;
  if (uu > 0.0 && uu < 1.0) cov = max(cov, 1.0 - smoothstep(0.0015, 0.0015 + 0.005 * (1.0 - uu), abs(p.x - c.x - sway * uu * 1.5 - 0.01 * uu * uu)));
  return cov;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  // heat shimmer: wobbles the picture just above the dune line, the pointer calms it
  float calm = 1.0 - 0.8 * exp(-dot((p - mp) * vec2(1.0, 1.5), (p - mp) * vec2(1.0, 1.5)) / 0.03);
  float shim = smoothstep(0.50, 0.66, uv.y) * smoothstep(0.78, 0.66, uv.y) * calm;
  float px = p.x + sin(uv.y * 520.0 + t * 2.4 + on_noise(vec2(p.x * 6.0, t * 0.3)) * 6.0) * 0.0016 * shim;

  // ---- sky: cobalt up high, almost white at the horizon, a hot sun with a halo, faint high streaks
  vec2 sunC = vec2(0.76 * asp, 0.14);
  float ds = length(p - sunC);
  vec3 sky = mix(vec3(0.10, 0.36, 0.78), vec3(0.74, 0.86, 0.96), pow(smoothstep(0.0, 0.62, uv.y), 0.9));
  sky += vec3(1.0, 0.95, 0.80) * (exp(-ds * ds / 0.003) * 0.9 + exp(-ds * ds / 0.05) * 0.30 + exp(-ds / 0.35) * 0.10);
  float cir = on_fbm(vec2(px * 2.2 + t * 0.004, uv.y * 9.0));
  sky = mix(sky, vec3(1.0), smoothstep(0.55, 0.85, cir) * 0.22 * smoothstep(0.55, 0.15, uv.y));

  vec3 col = sky;
  // ---- two ranges of dunes
  float hz1 = 0.585, hz2 = 0.665;
  float h1 = hz1 - on_dune(px, 3.0, 1.3, 0.06);
  float h2 = hz2 - on_dune(px + 4.0, 11.0, 1.9, 0.07);
  float e = 0.012;
  if (uv.y > h1) {
    float sl = (on_dune(px - e + 0.0, 3.0, 1.3, 0.06) - on_dune(px + e, 3.0, 1.3, 0.06)) / e;   // > 0: slope falls to the right, faces the sun
    float lit = smoothstep(-0.2, 0.5, sl);
    vec3 c1 = mix(vec3(0.80, 0.58, 0.42), vec3(0.97, 0.80, 0.60), lit);
    c1 = mix(c1, vec3(0.78, 0.82, 0.90), 0.38);                    // far haze
    col = c1;
  }
  if (uv.y > h2) {
    float sl = (on_dune(px + 4.0 - e, 11.0, 1.9, 0.07) - on_dune(px + 4.0 + e, 11.0, 1.9, 0.07)) / e;
    float lit = smoothstep(-0.2, 0.5, sl);
    vec3 c2 = mix(vec3(0.82, 0.54, 0.32), vec3(1.0, 0.80, 0.50), lit);
    c2 = mix(c2, vec3(0.80, 0.80, 0.82), 0.15);
    col = c2;
  }
  // ---- the ground plane: pale sand with wind ripples, a hollow with the pond
  float gy = uv.y - 0.69;
  if (gy > 0.0) {
    float rp = on_noise(vec2(px * 22.0 + gy * 30.0, gy * 150.0)) * 0.5 + on_noise(vec2(px * 70.0, gy * 400.0)) * 0.5;
    vec3 sand = mix(vec3(1.0, 0.84, 0.58), vec3(0.88, 0.62, 0.38), smoothstep(0.0, 0.35, gy) * 0.8);
    sand *= 0.92 + 0.16 * rp;
    col = sand;
  }

  // ---- the pond with its reflection, pushed by the pointer
  vec2 pc = vec2(0.44 * asp, 0.805);
  vec2 pr = vec2(0.30 * asp * 0.92, 0.062);
  vec2 dp = (p - pc) / pr;
  float ring = 0.0;
  float dm = length((p - mp) * vec2(1.0, 2.6));
  ring = sin(dm * 150.0 - t * 3.0) * exp(-dm * 7.0);
  float shape = length(dp + vec2(0.0, 0.0) + 0.05 * vec2(on_noise(p * 12.0) - 0.5, on_noise(p * 12.0 + 4.0) - 0.5));
  if (shape < 1.0) {
    float depth = 1.0 - shape;                                   // 0 at the shore, 1 in the middle
    vec3 shallow = vec3(0.30, 0.86, 0.78);
    vec3 deep = vec3(0.02, 0.45, 0.62);
    vec3 water = mix(shallow, deep, smoothstep(0.0, 0.65, depth));
    // sky and palms mirrored: reflection samples the scene upside down about the shoreline
    vec2 rp2 = vec2(p.x + ring * 0.0025 + (on_noise(vec2(p.x * 40.0, p.y * 90.0 - t * 0.5)) - 0.5) * 0.005, 2.0 * (pc.y - pr.y * 0.55) - p.y);
    float rfl = on_palm(rp2, vec2(0.205 * asp, 0.400), vec2(0.215 * asp, 0.775), 1.3, t)
              + on_palm(rp2, vec2(0.690 * asp, 0.455), vec2(0.675 * asp, 0.790), 4.1, t)
              + 0.7 * on_palm(rp2, vec2(0.640 * asp, 0.520), vec2(0.655 * asp, 0.785), 7.7, t);
    water = mix(water, vec3(0.0, 0.18, 0.12), clamp(rfl, 0.0, 1.0) * 0.55);
    water = mix(water, sky * 0.95 + vec3(0.0, 0.05, 0.04), 0.26 * smoothstep(0.1, 0.9, depth));
    // sun glitter and the pointer's rings
    float gl = on_noise(vec2(p.x * 160.0, p.y * 420.0 - t * 0.9));
    water += vec3(1.0, 0.98, 0.88) * smoothstep(0.88, 0.99, gl) * 0.5 * (0.4 + 0.6 * smoothstep(0.0, 0.5, depth));
    water += vec3(0.8, 1.0, 1.0) * max(ring, 0.0) * 0.18;
    // wet green-sand rim
    float rim = smoothstep(0.0, 0.10, depth);
    col = mix(vec3(0.38, 0.62, 0.30), water, rim);
    col = mix(col, water, 0.0);
  } else {
    // a darker damp ring and tufts of reeds around the water
    float damp = smoothstep(1.28, 1.0, shape);
    col *= 1.0 - 0.18 * damp;
    float reed = on_noise(vec2(p.x * 260.0, 1.0));
    float rm = smoothstep(1.0 + 0.22 * reed, 1.0, shape) * smoothstep(0.7, 0.95, reed) * step(uv.y, pc.y + 0.01);
    col = mix(col, vec3(0.20, 0.45, 0.14), rm * 0.8);
  }

  // ---- palms, in front of everything
  float palm = on_palm(p, vec2(0.205 * asp, 0.400), vec2(0.215 * asp, 0.775), 1.3, t);
  palm = max(palm, on_palm(p, vec2(0.690 * asp, 0.455), vec2(0.675 * asp, 0.790), 4.1, t));
  palm = max(palm, 0.9 * on_palm(p, vec2(0.640 * asp, 0.520), vec2(0.655 * asp, 0.785), 7.7, t));
  vec3 leafC = mix(vec3(0.05, 0.22, 0.07), vec3(0.20, 0.46, 0.13), smoothstep(0.7, 0.4, uv.y) * on_noise(p * 40.0));
  col = mix(col, leafC, palm);

  // shade under the palms on the sand
  float sh = exp(-pow((p.x - 0.22 * asp) / 0.16, 2.0)) * smoothstep(0.76, 0.84, uv.y) * 0.12;
  col *= 1.0 - sh;

  // a soft near-white bloom of noon light, the user's wallpaper just nudges the tones
  col *= 0.985 + 0.03 * on_luma(w);
  col = mix(col, vec3(0.90, 0.92, 0.95), smoothstep(0.03, 0.0, abs(uv.y - 0.60)) * 0.12);
  col += vec3(1.0, 0.95, 0.85) * exp(-ds * ds / 0.06) * 0.06;
  col *= 1.0 - 0.22 * pow(length((uv - 0.5) * vec2(1.0, 1.0)), 2.2);
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
