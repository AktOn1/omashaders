// label: Orbital dawn
// hint: a view from a space-station window: the Earth's limb with city lights on the night side and a sunrise flaring over the horizon, a solar-panel wing against the stars; the pointer shifts the viewpoint
// category: Sci-fi worlds
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
float orb_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float orb_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(orb_hash(i), orb_hash(i + vec2(1, 0)), f.x), mix(orb_hash(i + vec2(0, 1)), orb_hash(i + vec2(1, 1)), f.x), f.y);
}
float orb_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * orb_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

vec3 orb_stars(vec2 p, float t) {
  vec3 acc = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float sc = l == 0 ? 60.0 : 130.0;
    vec2 sp = p * sc + float(l) * 31.7;
    vec2 id = floor(sp), f = fract(sp) - 0.5;
    float h = orb_hash(id);
    if (h > (l == 0 ? 0.90 : 0.94)) {
      vec2 o = (vec2(orb_hash(id + 3.1), orb_hash(id + 8.3)) - 0.5) * 0.6;
      float tw = 0.75 + 0.25 * sin(t * (0.4 + h * 2.0) + h * 90.0);
      float s = smoothstep(0.10, 0.0, length(f - o)) * tw;
      vec3 tint = h > 0.97 ? vec3(0.75, 0.85, 1.0) : (h > 0.935 ? vec3(1.0, 0.92, 0.8) : vec3(0.9, 0.95, 1.0));
      acc += tint * s * (l == 0 ? 0.55 : 0.35);
    }
  }
  return acc;
}

// the Earth seen from orbit: ocean, land, clouds, city lights on the night side, a thin bright atmosphere
vec3 orb_earth(vec2 p, vec2 c, float R, float rot, float tilt, vec3 sunDir, float t) {
  vec2 n = (p - c) / R;
  float r2 = dot(n, n);
  float r = sqrt(r2);
  vec3 col = vec3(0.0);
  float edge = 0.0;
  if (r < 1.0) {
    float z = sqrt(1.0 - r2);
    vec3 N = vec3(n.x, -n.y, z);
    float lon = atan(N.x, N.z) + rot;
    float lat = asin(clamp(N.y, -1.0, 1.0)) + tilt;
    vec2 g = vec2(lon * 2.2, lat * 3.0);
    float cont = orb_fbm(g * 1.1 + 4.0) * 0.65 + orb_fbm(g * 3.0 + 9.0) * 0.35;
    float land = smoothstep(0.50, 0.55, cont);
    float lt = max(dot(N, sunDir), -0.3);
    float day = smoothstep(-0.05, 0.35, lt);
    // surface colour
    vec3 ocean = mix(vec3(0.02, 0.07, 0.22), vec3(0.04, 0.22, 0.52), smoothstep(0.1, 0.9, lt));
    vec3 ground = mix(vec3(0.28, 0.34, 0.18), vec3(0.55, 0.42, 0.26), smoothstep(0.55, 0.75, cont));
    vec3 surf = mix(ocean, ground * (0.25 + 0.75 * day), land);
    // clouds drifting slowly
    float cl = orb_fbm(vec2(g.x * 1.8 + t * 0.01, g.y * 2.6) + 20.0) * 0.7 + orb_fbm(vec2(g.x * 4.5 - t * 0.015, g.y * 6.0) + 40.0) * 0.3;
    float cloud = smoothstep(0.50, 0.72, cl);
    surf = mix(surf, vec3(0.95, 0.97, 1.0) * (0.12 + 0.9 * day), cloud * 0.85);
    // shading: sunlit side bright, terminator warm
    vec3 lit = surf * (0.10 + 1.15 * smoothstep(-0.1, 0.9, lt));
    lit += vec3(1.0, 0.45, 0.2) * exp(-pow(lt / 0.10, 2.0)) * 0.22 * (1.0 - cloud * 0.4);   // sunrise line on the terminator
    // city lights, only on land, on the night side
    float night = 1.0 - smoothstep(-0.02, 0.15, lt);
    vec2 cg = g * 38.0;
    vec2 cid = floor(cg);
    float ch = orb_hash(cid);
    float cluster = smoothstep(0.55, 0.85, orb_fbm(g * 7.0 + 60.0));
    float dots = step(0.86, ch) * smoothstep(0.30, 0.0, length(fract(cg) - 0.5)) * cluster * land * (1.0 - cloud * 0.8);
    lit += vec3(1.0, 0.75, 0.38) * dots * night * 1.4;
    lit += vec3(1.0, 0.7, 0.35) * cluster * land * night * 0.05;
    // fresnel: the atmosphere brightens toward the limb
    float fr = pow(r, 4.0);
    lit += vec3(0.25, 0.55, 1.0) * fr * (0.15 + 0.85 * smoothstep(-0.2, 0.5, lt)) * 0.9;
    col = lit;
    edge = smoothstep(1.0, 0.996, r);
  }
  // thin atmosphere above the limb
  float h = max(r - 1.0, 0.0);
  float sunSide = smoothstep(-0.4, 0.8, dot(normalize(n + 1e-5), vec2(sunDir.x, -sunDir.y)));
  float atm = exp(-h / 0.010) * 0.9 + exp(-h / 0.045) * 0.35;
  vec3 atmCol = mix(vec3(0.20, 0.45, 1.0), vec3(0.55, 0.80, 1.0), exp(-h / 0.006));
  atmCol = mix(atmCol, vec3(1.0, 0.55, 0.25), exp(-h / 0.012) * pow(sunSide, 4.0) * 0.7);
  vec3 outc = atmCol * atm * (0.12 + 0.88 * sunSide) * step(1.0, r);
  return col * edge + outc;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  float hasPtr = step(-5000.0, mpx.x);
  if (hasPtr < 0.5) m = vec2(0.5, 0.5);
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  vec2 pm = m - 0.5;

  vec3 col = vec3(0.004, 0.006, 0.016) + wall(uv) * 0.025;
  col += orb_stars(p + pm * 0.02, t) * smoothstep(0.35, 0.9, 1.0 - uv.y * 0.0);

  // the planet: its limb rises across the lower part of the window, rotating slowly
  vec2 ec = vec2(asp * 0.42, 2.02);
  float R = 1.50;
  vec3 sunDir = normalize(vec3(0.85, -0.18 + pm.y * 0.1, 0.30));
  vec3 earth = orb_earth(p + pm * vec2(0.03, 0.015), ec, R, t * 0.004 + pm.x * 0.5, 0.35 + pm.y * 0.2, sunDir, t);
  // the sun: just behind the limb at the right, a hard white spark with a long anamorphic streak and a soft halo
  vec2 sp = vec2(asp * 0.97, 0.47) - pm * vec2(0.03, 0.015);
  vec2 sd = p - sp;
  float sr = length(sd);
  float behind = smoothstep(-0.003, 0.012, length(p + pm * vec2(0.03, 0.015) - ec) - R);   // hidden below the limb
  float sun = (exp(-sr * sr / 0.00006) * 1.4 + exp(-sr * sr / 0.004) * 0.5 + exp(-sr * sr / 0.06) * 0.14) * behind;
  float streak = exp(-abs(sd.y) / 0.0035) * exp(-abs(sd.x) / 0.28) * 0.38 * behind;
  float st2 = exp(-abs(sd.x) / 0.0035) * exp(-abs(sd.y) / 0.16) * 0.12 * behind;
  col += earth;
  col += vec3(1.0, 0.92, 0.80) * (sun + streak + st2) * 0.85;
  col += vec3(1.0, 0.55, 0.25) * exp(-sr * sr / 0.18) * 0.06;
  // a gentle lens ghost on the opposite side of the screen centre
  vec2 gp = vec2(asp * 0.5, 0.5) - (sp - vec2(asp * 0.5, 0.5)) * 0.55;
  col += vec3(0.4, 0.7, 1.0) * exp(-pow((length(p - gp) - 0.07) / 0.012, 2.0)) * 0.05 * behind;

  // a solar-panel wing of the station, dark against the stars, rimmed by sunlight
  vec2 po = p - vec2(asp * 0.05, 0.14) - pm * vec2(0.07, 0.04);
  float ang = -0.32 + sin(t * 0.03) * 0.01;
  vec2 q = vec2(cos(ang) * po.x - sin(ang) * po.y, sin(ang) * po.x + cos(ang) * po.y);
  if (abs(q.x - 0.22) < 0.24 && abs(q.y) < 0.045) {
    vec2 cell = vec2((q.x + 0.02) * 26.0, q.y * 22.0);
    vec2 cf = abs(fract(cell) - 0.5);
    float grid = smoothstep(0.46, 0.50, max(cf.x, cf.y));
    float sheen = 0.5 + 0.5 * sin(q.x * 9.0 + 1.0);
    vec3 panel = vec3(0.020, 0.040, 0.100) + vec3(0.04, 0.09, 0.20) * sheen * smoothstep(0.0, 0.5, q.x);
    panel += vec3(0.30, 0.38, 0.55) * grid * 0.4;
    panel += vec3(1.0, 0.8, 0.5) * smoothstep(0.040, 0.045, abs(q.y)) * 0.35;
    col = panel;
  }
  // the truss it hangs from
  if (abs(q.y) < 0.003 && q.x > -0.30 && q.x < -0.02) col = vec3(0.30, 0.34, 0.42);

  col = col / (1.0 + col * 0.35);                                 // soft shoulder so the sun does not clip harshly
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
