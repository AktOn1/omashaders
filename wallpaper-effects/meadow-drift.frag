// label: Meadow drift
// hint: a warm breeze of golden light brushing across your own picture: soft wind waves of light travel over it, dandelion seed fluff and glowing pollen motes drift by in two depths, a little green warmth settles in the shadows, and a thin edge of tall grass sways along the very bottom. Seeds blow away from the pointer, your picture stays the wallpaper
// category: Nature
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

float md_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float md_aa(float d) { return clamp(0.5 - d, 0.0, 1.0); }
float md_vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(md_h(i), md_h(i + vec2(1.0, 0.0)), f.x), mix(md_h(i + vec2(0.0, 1.0)), md_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

// the same breeze for everything: a wave that runs from left to right
float md_wind(float x, float t) {
  return (sin(x * 0.0060 - t * 0.70) + 0.55 * sin(x * 0.0150 - t * 1.30 + 1.7)) * (0.65 + 0.35 * sin(x * 0.0021 - t * 0.30));
}

// a layer of drifting particles; seeds = dandelion fluff with fine spokes, otherwise glowing pollen
// returns x = light, y = shade for readability on bright pictures
vec2 md_layer(vec2 pp, float C, float t, float speed, float dens, float rad, bool seed, float salt, vec2 mp, float sc, out float warm) {
  float lit = 0.0; float shade = 0.0; warm = 0.0;
  vec2 q = pp - vec2(speed * t, -0.35 * speed * t * 0.4);
  vec2 c0 = floor(q / C);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 ca = c0 + vec2(float(i), float(j));
      if (md_h(ca + salt) > dens) continue;
      float h1 = md_h(ca + salt + 4.1);
      float h2 = md_h(ca + salt + 8.3);
      float h3 = md_h(ca + salt + 2.7);
      // each particle bobs on its own slow orbit inside its cell
      float ph = t * (0.35 + 0.5 * h3) + h1 * 40.0;
      vec2 pos = (ca + 0.25 + 0.5 * vec2(h1, h2)) * C + vec2(sin(ph), cos(ph * 0.83 + 1.3)) * C * 0.17;
      vec2 wp = pos + vec2(speed * t, -0.35 * speed * t * 0.4); // back to screen space
      // blown away from the pointer
      vec2 dm = wp - mp;
      float dl = length(dm);
      float push = exp(-dl * dl / (2.0 * 130.0 * sc * 130.0 * sc)) * 70.0 * sc;
      wp += dm / max(dl, 1.0) * push;
      vec2 d = pp - wp;
      float R = rad * (0.7 + 0.6 * h2) * sc;
      float r = length(d);
      float tw = 0.65 + 0.35 * sin(t * (0.9 + 1.5 * h1) + h2 * 50.0);
      if (seed) {
        if (r > R * 1.6 + 3.0) continue;
        float th = atan(d.y, d.x);
        float rot = h1 * 6.28 + t * (0.15 + 0.2 * h3) * (h2 > 0.5 ? 1.0 : -1.0);
        float spokes = pow(0.5 + 0.5 * cos(11.0 * th + rot), 5.0);
        float core = exp(-r * r / (1.5 * sc * 1.5 * sc));
        float fil = spokes * smoothstep(R, R * 0.12, r) * smoothstep(1.5 * sc, 3.0 * sc, r);
        float ring = md_aa(abs(r - R * 0.92) - 0.35 * sc) * 0.30 * smoothstep(0.0, 1.0, spokes + 0.35);
        // a short stalk hanging below, with the seed at its end
        vec2 ds = d - vec2(0.0, 0.0);
        float stalk = md_aa(abs(ds.x + 0.12 * ds.y) - 0.35 * sc) * step(0.0, ds.y) * step(ds.y, R * 1.35) * 0.65;
        float seedHead = exp(-dot(ds - vec2(0.0, R * 1.35), ds - vec2(0.0, R * 1.35)) / (1.4 * sc * 1.4 * sc)) * 0.8;
        float glow = exp(-r * r / (R * R * 1.1)) * 0.28;
        lit += (core * 1.1 + fil * 0.85 + ring + stalk * 0.7 + seedHead * 0.4 + glow) * tw;
        shade += (glow + core * 0.4 + fil * 0.20 + stalk * 0.3) * 0.9;
      } else {
        float core = exp(-r * r / (R * R * 0.55));
        float halo = exp(-r * r / (R * R * 7.0)) * 0.40;
        lit += (core + halo) * tw * (0.6 + 0.6 * h2);
        shade += halo * 0.4 + core * 0.2;
        warm += (core + halo) * h1;
      }
    }
  }
  return vec2(lit, shade);
}

// tall grass along the very bottom edge: dark silhouettes with a sunlit rim, swaying in the breeze; returns coverage, tone in z, rim in y
vec3 md_grass(vec2 pp, float sc, float t, vec2 mp) {
  float a = res.y - pp.y;
  float hmax = 78.0 * sc;
  if (a > hmax) return vec3(0.0);
  float cell = 10.0 * sc;
  float i0 = floor(pp.x / cell);
  float cov = 0.0; float rim = 0.0; float tone = 0.0;
  for (int i = -3; i <= 3; i++) {
    float id = i0 + float(i);
    float h1 = md_h(vec2(id, 5.5));
    if (h1 > 0.92) continue;
    float h2 = md_h(vec2(id, 9.1));
    float h3 = md_h(vec2(id, 13.7));
    float bx = (id + 0.15 + 0.7 * h2) * cell;
    float clump = 0.45 + 0.75 * md_vn(vec2(bx / (160.0 * sc), 2.0));
    float H = (22.0 + 50.0 * h3 * h3) * sc * clump;
    if (a > H + 1.0) continue;
    float s = a / H;
    float L = (h2 * 2.0 - 1.0) * 0.30 * H + md_wind(bx, t) * H * 0.34;
    vec2 dm = vec2(bx, res.y) - mp;
    L += sign(dm.x + 0.01) * exp(-dot(dm, dm) / (2.0 * 150.0 * sc * 150.0 * sc)) * H * 0.55;
    float cross = pp.x - (bx + L * s * s);
    float hw = (2.4 + 1.3 * h1) * sc * (1.0 - pow(s, 1.5));
    float slope = 2.0 * L * s / H;
    float d = (abs(cross) - hw) / sqrt(1.0 + slope * slope);
    float cv = md_aa(d) * smoothstep(H + 1.0, H - 0.5, a);
    if (cv > 0.0) {
      cov = max(cov, cv);
      rim = max(rim, cv * smoothstep(0.1, 1.0, cross / max(hw, 0.4)) * (0.2 + 0.8 * s));
      tone = max(tone, cv * (0.5 + 0.5 * h1));
    }
  }
  return vec3(cov, rim, tone);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  vec2 pp = uv * res;
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? mpx : vec2(-10000.0);
  float t = time;
  vec3 col = wall(uv);
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));
  float asp = res.x / res.y;
  vec2 q = (uv - 0.5) * vec2(asp, 1.0);

  vec3 gold = vec3(1.00, 0.82, 0.42);
  vec3 cream = vec3(1.00, 0.97, 0.86);
  vec3 leaf = vec3(0.30, 0.62, 0.20);

  // light green warmth in the shadows
  float shadow = 1.0 - smoothstep(0.03, 0.50, lum0);
  col = mix(col, col * vec3(0.84, 1.07, 0.80) + vec3(0.004, 0.026, 0.006), shadow * 0.80);

  // soft sunny wash from the upper right, a hint of cream overall
  float sun = exp(-dot(q - vec2(0.62 * asp * 0.5, -0.38), q - vec2(0.62 * asp * 0.5, -0.38)) / 0.45);
  col = mix(col, col * vec3(1.10, 1.03, 0.86), sun * 0.65);

  // wind waves of golden light: soft diagonal bands that travel across the picture, never the same width twice
  float along = dot(q, normalize(vec2(1.0, -0.38)));
  float across = dot(q, normalize(vec2(0.38, 1.0)));
  float phase = along * 6.2 - t * 0.55 + 1.6 * sin(across * 2.3 + t * 0.12) + 0.9 * md_vn(vec2(across * 2.0, t * 0.05));
  float band = pow(0.5 + 0.5 * sin(phase), 2.2);
  float env = 0.55 + 0.45 * md_vn(vec2(along * 1.6 - t * 0.04, across * 1.3 + 4.0));
  float wave = band * env;
  float wl = 0.55 + 0.45 * smoothstep(0.65, 0.05, lum0);
  col += gold * wave * 0.17 * wl;
  col = mix(col, col * vec3(1.10, 1.04, 0.88), wave * 0.45);

  // drifting particles: far pollen, far seeds, near seeds, near pollen
  float warmA, warmB;
  vec2 pf = md_layer(pp, 74.0 * sc, t, 14.0 * sc, 0.50, 2.2, false, 3.0, mp, sc, warmA);
  vec2 sf = md_layer(pp, 150.0 * sc, t, 22.0 * sc, 0.34, 7.0, true, 11.0, mp, sc, warmB);
  vec2 sn = md_layer(pp, 260.0 * sc, t, 38.0 * sc, 0.30, 15.0, true, 23.0, mp, sc, warmB);
  vec2 pn = md_layer(pp, 130.0 * sc, t, 30.0 * sc, 0.42, 3.8, false, 37.0, mp, sc, warmB);

  float bright = smoothstep(0.45, 0.85, lum0);
  float shadeAll = (sf.y * 0.30 + sn.y * 0.55 + pn.y * 0.5) * bright;
  col *= 1.0 - clamp(shadeAll, 0.0, 0.45) * vec3(0.55, 0.50, 0.70);
  col += gold * (pf.x * 0.55 + pn.x * 0.95) * (1.0 - 0.45 * bright);
  col += cream * (sf.x * 0.60 + sn.x * 0.95) * (1.0 - 0.30 * bright);

  // the grass edge at the very bottom
  vec3 g = md_grass(pp, sc, t, mp);
  if (g.x > 0.0) {
    float hgt = clamp((res.y - pp.y) / (78.0 * sc), 0.0, 1.0);
    vec3 gc = mix(vec3(0.020, 0.075, 0.030), vec3(0.075, 0.24, 0.07), 0.35 + 0.65 * g.z * hgt);
    gc += gold * g.y * 0.75;
    col = mix(col, gc, g.x * 0.93);
  }

  // a soft darkening where the grass stands, so it sits in the picture
  float foot = smoothstep(46.0 * sc, 0.0, res.y - pp.y);
  col *= 1.0 - 0.22 * foot;

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
