// label: Prairie storm
// hint: a thunderstorm rolls over open prairie, a gold slit of sun on the horizon, a rain shaft and lightning that strikes where the pointer is
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
float ps_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ps_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ps_hash(i), ps_hash(i + vec2(1, 0)), f.x), mix(ps_hash(i + vec2(0, 1)), ps_hash(i + vec2(1, 1)), f.x), f.y);
}
float ps_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ps_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ps_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float PS_HZ = 0.68;

// the bolt: a jagged vertical line with one side branch; returns (core, glow)
vec2 ps_bolt(vec2 p, float bx, float seed) {
  float y = p.y;
  float top = 0.10, bot = PS_HZ + 0.004;
  if (y < top || y > bot) return vec2(0.0);
  float j = (ps_noise(vec2(y * 17.0, seed)) - 0.5) * 0.10 + (ps_noise(vec2(y * 53.0, seed + 3.0)) - 0.5) * 0.022;
  float x = bx + j + (y - top) * 0.05 * (ps_hash(vec2(seed, 1.0)) - 0.5) * 2.0;
  float dx = abs(p.x - x);
  float fade = smoothstep(top, top + 0.06, y);
  float core = smoothstep(0.0022, 0.0004, dx) * fade;
  float glow = exp(-dx * dx / 0.00045) * 0.5 * fade;
  // branch from 40% down
  float by0 = top + 0.40 * (bot - top);
  if (y > by0 && y < by0 + 0.20) {
    float t = y - by0;
    float bxx = bx + (ps_noise(vec2(by0 * 17.0, seed)) - 0.5) * 0.10 + t * (ps_hash(vec2(seed, 2.0)) > 0.5 ? 0.28 : -0.28)
              + (ps_noise(vec2(y * 41.0, seed + 9.0)) - 0.5) * 0.02;
    float d2 = abs(p.x - bxx);
    float f2 = smoothstep(by0 + 0.20, by0 + 0.08, y);
    core += smoothstep(0.0016, 0.0003, d2) * f2 * 0.7;
    glow += exp(-d2 * d2 / 0.0003) * 0.25 * f2;
  }
  return vec2(clamp(core, 0.0, 1.0), glow);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  float t = time;
  vec3 w = wall(uv);

  // ---- lightning clock: one storm cycle every 7 seconds, a double flicker at its start
  float cyc = floor(t / 7.0);
  float k = fract(t / 7.0);
  float fl = exp(-k * 38.0) + 0.7 * smoothstep(0.045, 0.052, k) * exp(-(k - 0.05) * 52.0);
  fl = clamp(fl, 0.0, 1.0);
  float seed = cyc * 7.31 + 1.7;
  float bxRand = (0.18 + 0.60 * ps_hash(vec2(cyc, 4.0))) * asp;
  float bx = hasM ? m.x * asp : bxRand;
  vec2 bolt = (k < 0.11) ? ps_bolt(p, bx, seed) : vec2(0.0);
  float boltK = (k < 0.11) ? (exp(-k * 28.0) * (0.55 + 0.45 * step(0.0, sin(k * 420.0)))) : 0.0;
  float flash = fl * 0.85;

  vec3 col;
  if (uv.y < PS_HZ) {
    // ---- sky: perspective cloud deck, dark and heavy, a gold slit of sun low on the left horizon
    float dy = max(PS_HZ - uv.y, 0.07);
    vec2 q = vec2((p.x - 0.5 * asp) * 0.34 / dy, 0.22 / dy) + vec2(t * 0.012, t * 0.007);
    float n1 = ps_fbm(q * 1.15);
    float n2 = ps_fbm(q * 2.6 + 9.0);
    float dens = n1 * 0.72 + n2 * 0.28;
    float thick = smoothstep(0.30, 0.62, dens + (0.28 - dy) * 0.55);
    float slitX = exp(-pow((uv.x - 0.14) / 0.36, 2.0));
    float gap = smoothstep(0.085, 0.012, PS_HZ - uv.y) * (0.30 + 0.70 * slitX) * (0.55 + 0.9 * n2);
    thick *= 1.0 - clamp(gap, 0.0, 0.92);
    float slit = exp(-pow((uv.x - 0.14) / 0.30, 2.0)) * exp(-pow((uv.y - (PS_HZ - 0.035)) / 0.07, 2.0));
    vec3 clearTop = vec3(0.17, 0.22, 0.27);
    vec3 clearLow = vec3(0.78, 0.60, 0.36);
    vec3 sky = mix(clearTop, clearLow, pow(smoothstep(0.0, 1.0, uv.y / PS_HZ), 4.0) * 0.55);
    sky = mix(sky, vec3(1.0, 0.76, 0.40), slit * 0.85);
    // cloud body: blue-slate with a green-grey bruise, lit from the slit on the lower edges
    vec3 cdark = vec3(0.045, 0.060, 0.085);
    vec3 cmid = vec3(0.36, 0.41, 0.48);
    float lit = (1.0 - dens) * 0.9 + 0.1 * n2;
    vec3 cloud = mix(cdark, cmid, smoothstep(0.22, 0.78, lit));
    cloud = mix(cloud, cloud * vec3(0.8, 1.0, 0.92), 0.5);
    cloud += vec3(0.60, 0.40, 0.20) * slit * (0.35 + 0.4 * (1.0 - thick)) * smoothstep(0.45, 0.78, lit);
    cloud += vec3(0.05, 0.08, 0.05) * smoothstep(0.55, 0.9, n2);              // greenish hail core
    col = mix(sky, cloud, thick);
    // the flash lights the cloud interiors from the bolt's side
    float fd = length((p - vec2(bx, 0.22)) * vec2(0.8, 1.0));
    float inner = exp(-fd * fd / 0.14);
    col += vec3(0.62, 0.70, 1.0) * flash * (0.12 + 0.45 * inner) * (0.5 + 0.8 * thick);
    // mammatus-like dark belly along the horizon side of the deck
    col *= 1.0 - 0.25 * smoothstep(0.25, 0.0, dy) * thick;
    col = mix(col, vec3(0.36, 0.34, 0.30), smoothstep(0.05, 0.0, PS_HZ - uv.y) * 0.45);   // haze lying on the land

    // ---- rain shaft: a grey curtain under the cloud base, slanted, with streaks, pointer drags it sideways
    float sx = (hasM ? m.x : 0.74) * asp;
    float slant = (uv.y - 0.30) * 0.10;
    float dxs = (p.x - sx) - slant;
    float shaft = exp(-dxs * dxs / (0.5 * 0.014 + 0.008 * (uv.y - 0.25))) * smoothstep(0.16, 0.34, uv.y);
    float rs = ps_noise(vec2(p.x * 180.0 + uv.y * 24.0, uv.y * 7.0 - t * 1.2)) * 0.6 + ps_fbm(vec2(p.x * 7.0, uv.y * 3.0 - t * 0.25)) * 0.4;
    shaft *= 0.35 + 0.9 * rs;
    col = mix(col, vec3(0.42, 0.46, 0.52) + vec3(0.18, 0.12, 0.06) * slit, clamp(shaft * 0.95, 0.0, 0.85));

    // bolt on top
    col += vec3(0.78, 0.84, 1.0) * bolt.y * boltK * 0.55;
    col = mix(col, vec3(1.0), bolt.x * boltK);
  } else {
    // ---- prairie: gold-green grass, lit at the horizon by the sun slit, dark in front, wind rolling over it
    float depth = uv.y - PS_HZ;
    float dn = depth / (1.0 - PS_HZ);
    float gz = depth + 0.035;
    float wind = ps_fbm(vec2((p.x - 0.5 * asp) * 0.30 / gz + t * 0.20, 0.07 / gz - t * 0.05));
    wind = smoothstep(0.2, 0.8, wind);
    float blades = ps_noise(vec2(p.x * (60.0 + 400.0 * dn), dn * 40.0 + 1.0));
    vec3 far = vec3(0.42, 0.36, 0.17);
    vec3 near = vec3(0.07, 0.08, 0.04);
    col = mix(far, near, pow(dn, 0.55));
    col *= 0.55 + 0.95 * wind;                                      // gusts roll over the grass
    col *= 0.86 + 0.28 * blades * smoothstep(0.1, 0.9, dn);
    float slitG = exp(-pow((uv.x - 0.14) / 0.38, 2.0)) * exp(-dn * 7.0);
    col += vec3(0.90, 0.60, 0.26) * slitG * 0.42 * (0.7 + 0.5 * wind);
    // cool grey wash from the rain on the right
    float rainSide = exp(-pow((p.x - (hasM ? m.x : 0.74) * asp) / 0.30, 2.0)) * exp(-dn * 5.0);
    col = mix(col, vec3(0.26, 0.30, 0.34), rainSide * 0.45);
    // sheet-lit grass catches the flash
    col += vec3(0.30, 0.34, 0.45) * flash * (0.30 + 0.5 * exp(-dn * 3.0)) * (0.5 + 0.8 * wind);
    // the bolt's footprint on the horizon
    col += vec3(0.60, 0.68, 1.0) * boltK * exp(-pow((p.x - bx) / 0.04, 2.0)) * exp(-dn * 22.0) * 0.8;
  }

  // lone tree on the horizon (a dark blob and a thin trunk), distance haze eats the bottom of it
  {
    vec2 tc = vec2(0.30 * asp, PS_HZ - 0.030);
    vec2 d = (p - tc) / vec2(0.034, 0.022);
    float leaf = smoothstep(1.0, 0.82, length(d + vec2(0.0, 0.12 * ps_noise(p * 70.0))));
    float trunk = step(abs(p.x - tc.x), 0.0022) * step(tc.y, p.y) * step(p.y, PS_HZ + 0.001);
    float tr = max(leaf, trunk);
    col = mix(col, vec3(0.04, 0.045, 0.05) + vec3(0.12, 0.08, 0.04) * flash, tr * 0.96);
  }
  // distant horizon line: a thin cool haze lying on the land
  col += vec3(0.20, 0.18, 0.14) * smoothstep(0.014, 0.0, abs(uv.y - PS_HZ - 0.002)) * 0.35;

  // let the user's own wallpaper show faintly through the scene
  col *= 0.97 + 0.06 * ps_luma(w);
  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
