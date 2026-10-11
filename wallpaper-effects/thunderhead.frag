// label: Thunderhead
// hint: a towering anvil storm cell over golden plains, lightning flickering deep inside the cloud, a grey rain curtain and a gold rim of low sun; the rain curtain leans toward the pointer
// category: Wild weather
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
float th_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float th_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th_hash(i), th_hash(i + vec2(1, 0)), f.x), mix(th_hash(i + vec2(0, 1)), th_hash(i + vec2(1, 1)), f.x), f.y);
}
float th_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * th_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float th_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * th_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float th_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float TH_HZ = 0.765;      // horizon
const float TH_BASE = 0.535;    // cloud base

// the cell: x = density 0..1, y = envelope (how far inside the big shape), z = billow texture
vec3 th_cloud(vec2 p, float cx, float t) {
  float x = p.x - cx, y = p.y;
  float n = th_fbm3(vec2(x * 2.2, y * 2.6) + vec2(0.0, -t * 0.006));
  float wx = th_fbm3(vec2(x * 4.0, y * 4.0) + 31.0), wy = th_fbm3(vec2(x * 4.0, y * 4.0) + 57.0);
  x += (wx - 0.5) * 0.10;
  y += (wy - 0.5) * 0.04;
  float ty = clamp((TH_BASE - y) / (TH_BASE - 0.12), 0.0, 1.0);
  x -= 0.10 * (ty - 0.5);                                            // the tower leans downwind
  float tw = (0.42 - 0.17 * smoothstep(0.0, 0.45, ty) + 0.10 * smoothstep(0.45, 0.9, ty)) * (0.8 + 0.4 * n);
  float tx = abs(x) / tw;
  float envT = (1.0 - tx * tx) * smoothstep(0.10, 0.19, y) * smoothstep(TH_BASE + 0.012, TH_BASE - 0.040, y) * 1.15;
  vec2 ad = vec2((x - 0.14) / (x > 0.14 ? 0.95 : 0.62), (y - 0.145) / 0.056);
  float envA = (1.0 - dot(ad, ad)) * (0.95 - 0.35 * smoothstep(0.35, 0.9, abs(x)));
  float sy = (y - (TH_BASE - 0.045) + (n - 0.5) * 0.06) / 0.058;
  float envS = (1.0 - sy * sy) * exp(-x * x / 0.30) * (0.8 + 0.5 * n);
  float env = max(envT, max(envA, envS));
  float lob = th_fbm(vec2(x * 7.0, y * 8.0) + vec2(0.0, -t * 0.012) + 3.0);
  lob = smoothstep(0.15, 0.85, lob);
  float fine = th_fbm3(vec2(x * 17.0, y * 20.0) + 9.0);
  float tex = lob * 0.7 + fine * 0.3;
  return vec3(smoothstep(0.05, 0.55, env + (tex - 0.5) * 0.70 * smoothstep(-0.25, 0.15, env)), env, tex);
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
  float cx = 0.50 * asp;
  vec2 sunP = vec2(0.17 * asp, TH_HZ - 0.055);

  // ---- lightning clock: a flicker deep inside the cell every 5.5 s, a weaker one on a second beat
  float c1 = floor(t / 5.5), k1 = fract(t / 5.5);
  float f1 = exp(-k1 * 22.0) * (0.55 + 0.45 * step(0.0, sin(k1 * 90.0))) + 0.8 * smoothstep(0.05, 0.065, k1) * exp(-(k1 - 0.06) * 30.0);
  f1 = clamp(f1, 0.0, 1.0) * step(k1, 0.3);
  vec2 fp1 = vec2(cx + (th_hash(vec2(c1, 1.0)) - 0.5) * 0.30, 0.20 + 0.28 * th_hash(vec2(c1, 2.0)));
  float c2 = floor((t + 2.7) / 4.1), k2 = fract((t + 2.7) / 4.1);
  float f2 = exp(-k2 * 30.0) * step(k2, 0.2) * 0.65;
  vec2 fp2 = vec2(cx + (th_hash(vec2(c2, 5.0)) - 0.5) * 0.36, 0.17 + 0.30 * th_hash(vec2(c2, 6.0)));

  vec3 col;
  // ---- sky: steel blue overhead, a pale gold wash low down, strongest toward the sun
  float low = smoothstep(0.05, TH_HZ, uv.y);
  float sunSide = exp(-pow((p.x - sunP.x) / 0.55, 2.0));
  vec3 sky = mix(vec3(0.20, 0.27, 0.40), vec3(0.58, 0.60, 0.64), pow(low, 1.4));
  sky = mix(sky, vec3(0.98, 0.72, 0.40), pow(low, 3.0) * (0.30 + 0.70 * sunSide));
  float sunD = length((p - sunP) * vec2(0.8, 1.0));
  sky += vec3(1.0, 0.82, 0.50) * exp(-sunD * sunD / 0.0016) * 1.0 + vec3(1.0, 0.62, 0.25) * exp(-sunD * sunD / 0.035) * 0.50;
  // thin high cirrus streaks pulled out of the anvil
  float cir = th_fbm3(vec2(p.x * 2.2 - t * 0.004, p.y * 9.0));
  sky = mix(sky, vec3(0.62, 0.64, 0.70), smoothstep(0.55, 0.85, cir) * 0.35 * (1.0 - low));
  col = sky;

  // ---- the storm cell
  vec3 cl = th_cloud(p, cx, t);
  float dens = cl.x;
  vec2 toSun = normalize(sunP - p);
  vec3 cl2 = th_cloud(p + toSun * 0.03, cx, t);
  float ty = clamp((TH_BASE - p.y) / (TH_BASE - 0.12), 0.0, 1.0);
  float depth = clamp(cl.y, 0.0, 1.0);
  float edge = (cl.z - cl2.z) * 2.6 + (cl.x - cl2.x) * 0.8;                 // billows that face the sun are brighter
  float sideL = clamp(0.55 - (p.x - cx + 0.10 * (ty - 0.5)) / 0.70, 0.0, 1.0);
  float lightAmt = clamp(0.06 + (0.35 + 0.55 * sideL) * pow(ty, 0.9) * 1.1 + (cl.z - 0.5) * 0.22 + edge * 0.40 - 0.30 * depth * (1.0 - ty), 0.0, 1.0);
  float sunK = 0.30 + 0.70 * exp(-pow((p.x - sunP.x) / 1.1, 2.0));
  vec3 slate = vec3(0.100, 0.115, 0.165);
  vec3 steel = vec3(0.34, 0.39, 0.50);
  vec3 gold = mix(vec3(0.98, 0.66, 0.34), vec3(1.0, 0.88, 0.70), smoothstep(0.3, 1.0, ty));
  vec3 body = mix(slate, steel, smoothstep(0.0, 0.55, lightAmt));
  body = mix(body, gold, smoothstep(0.40, 0.85, lightAmt) * sunK);
  body = mix(body, gold * 0.95, clamp(edge, 0.0, 1.0) * sunK * 0.35);
  body += gold * 0.45 * dens * (1.0 - dens) * 4.0 * sunK * smoothstep(0.1, 0.7, ty + 0.2);   // thin edges glow like a silver lining
  body *= (0.78 + 0.5 * cl.z) * (1.0 - 0.40 * smoothstep(0.50, 0.0, ty) * (0.3 + 0.7 * depth));
  body += gold * 0.55 * exp(-pow((p.y - (TH_BASE - 0.012)) / 0.020, 2.0)) * sunK * sunK * (0.5 + 0.5 * cl.z);   // the sun lights the underside edge
  float g1 = exp(-dot(p - fp1, p - fp1) / 0.035) * f1;
  float g2 = exp(-dot(p - fp2, p - fp2) / 0.020) * f2;
  float glow = g1 + g2;
  body += vec3(0.62, 0.72, 1.0) * glow * (0.35 + 1.1 * cl.z) * (0.5 + 0.9 * (1.0 - depth * 0.5)) * 0.9;
  col = mix(col, body, dens);
  col += vec3(0.28, 0.34, 0.55) * glow * 0.20 * (1.0 - dens);

  // ---- rain curtain: grey shaft under the shelf, its foot leans toward the pointer
  float sx0 = 0.665 * asp;
  float tgt = hasM ? m.x * asp : sx0 + 0.04;
  float fall = clamp((uv.y - (TH_BASE - 0.01)) / (TH_HZ - TH_BASE + 0.01), 0.0, 1.0);
  float lean = (tgt - sx0) * 0.55 * fall * fall + 0.02 * fall;
  float cxr = sx0 + lean;
  float hw = 0.12 + 0.09 * fall + 0.03 * th_noise(vec2(uv.y * 8.0, t * 0.2));
  float dxr = p.x - cxr;
  float shaft = exp(-pow(dxr / hw, 2.0)) * smoothstep(0.0, 0.10, fall + 0.05) * smoothstep(1.0, 0.82, fall + 0.03 * (th_noise(vec2(p.x * 20.0, 3.0)) - 0.5));
  float strk = th_noise(vec2((p.x - lean * 0.5) * 130.0 + uv.y * 30.0, uv.y * 5.0 - t * 1.6)) * 0.55 + th_fbm3(vec2(p.x * 9.0, uv.y * 3.0 - t * 0.3)) * 0.55;
  shaft *= 0.30 + 0.95 * strk;
  float rainOn = shaft * step(TH_BASE - 0.02, uv.y);
  vec3 rainC = mix(vec3(0.30, 0.34, 0.40), vec3(0.58, 0.58, 0.58), fall * 0.5) + vec3(0.30, 0.20, 0.08) * sunSide * smoothstep(0.0, -0.1, dxr + 0.02) * 0.6;
  rainC += vec3(0.40, 0.48, 0.70) * glow * 0.3;
  col = mix(col, rainC, clamp(rainOn * 0.92, 0.0, 0.88));

  // ---- the plains: gold light at the far edge, deep ochre in front, gusts rolling over the grass
  if (uv.y > TH_HZ) {
    float depthG = (uv.y - TH_HZ) / (1.0 - TH_HZ);
    float gz = (uv.y - TH_HZ) + 0.03;
    float gust = th_fbm(vec2((p.x - 0.5 * asp) * 0.32 / gz + t * 0.30, 0.06 / gz - t * 0.04));
    gust = smoothstep(0.25, 0.80, gust);
    float blades = th_noise(vec2(p.x * (50.0 + 420.0 * depthG), depthG * 36.0));
    float fpat = th_fbm3(vec2((p.x - 0.5 * asp) * 0.55 / gz, 0.10 / gz) + 4.0);
    vec3 farC = mix(vec3(0.95, 0.70, 0.32), vec3(0.78, 0.66, 0.30), smoothstep(0.35, 0.65, fpat));
    vec3 nearC = mix(vec3(0.30, 0.20, 0.07), vec3(0.20, 0.17, 0.06), smoothstep(0.35, 0.65, fpat));
    vec3 g = mix(farC, nearC, pow(depthG, 0.45));
    g *= 0.50 + 1.0 * gust;
    g *= 0.82 + 0.34 * blades * smoothstep(0.1, 0.9, depthG);
    g += vec3(1.0, 0.72, 0.32) * exp(-pow((p.x - sunP.x) / 0.50, 2.0)) * exp(-depthG * 7.0) * 0.55;
    g += vec3(1.0, 0.80, 0.50) * exp(-depthG * 22.0) * 0.12;
    // cool grey under the rain, a darker patch of shadow beneath the cell
    float under = exp(-pow((p.x - cxr) / 0.22, 2.0)) * exp(-depthG * 4.0);
    g = mix(g, vec3(0.22, 0.24, 0.26), under * 0.55);
    g = mix(g, g * vec3(0.55, 0.56, 0.66), exp(-pow((p.x - cx) / 0.55, 2.0)) * 0.35);
    g += vec3(0.20, 0.25, 0.40) * glow * 0.14;
    col = g;
    // a thin line of haze on the horizon
    col += vec3(1.0, 0.80, 0.50) * exp(-(uv.y - TH_HZ) / 0.012) * 0.28 * (0.4 + 0.6 * sunSide);
  }
  // rain meeting the ground: spray and mist
  col = mix(col, vec3(0.50, 0.50, 0.50) * (0.7 + 0.5 * th_noise(vec2(p.x * 40.0, t))) , exp(-pow(dxr / (hw * 0.9), 2.0)) * exp(-abs(uv.y - TH_HZ - 0.01) / 0.02) * 0.30 * smoothstep(0.0, 1.0, fall));

  // ---- wind in the grass line: tall stalks along the near edge, bending in waves that roll across
  {
    float cell = floor(p.x * 95.0);
    float hh = th_hash(vec2(cell, 7.0));
    float wave = sin(p.x * 6.0 - t * 1.5) * 0.5 + 0.5;
    wave *= 0.5 + 0.5 * th_noise(vec2(p.x * 3.0 - t * 0.5, 4.0));
    float bend = (0.010 + 0.016 * wave) * clamp((uv.y - 0.90) / 0.10, 0.0, 1.0);
    float topY = 0.925 - 0.050 * hh * hh + 0.004 * wave;
    float fx = fract(p.x * 95.0 - bend * 95.0 * 2.0) - 0.5;
    float widthB = 0.44 * clamp((uv.y - topY) / 0.035, 0.0, 1.0);
    float stalk = smoothstep(widthB, widthB - 0.12, abs(fx)) * smoothstep(topY, topY + 0.004, uv.y);
    float head = smoothstep(0.009, 0.003, length(vec2(fx * 0.0105, (uv.y - topY - 0.004) * 0.6))) * step(0.6, hh);
    float body2 = smoothstep(0.985 - 0.02 * th_noise(vec2(p.x * 25.0, 1.0)), 1.0, uv.y);
    vec3 gc = vec3(0.040, 0.030, 0.012) + vec3(0.55, 0.36, 0.12) * sunSide * 0.22 * (0.4 + wave) * smoothstep(0.96, 0.92, topY + 0.03 * hh);
    col = mix(col, gc, clamp(max(stalk, body2), 0.0, 1.0) * 0.94);
  }

  // the user's picture is kept very faintly in the tone of the scene
  col = mix(col, col * (0.55 + 1.0 * th_luma(w)), 0.22);
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
