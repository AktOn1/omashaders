#version 440
// category: Trail
// desc: Brand trail: a small glowing branding iron sits at the pointer, its tip white-hot, and burns a thin scorched line along the path it has taken. The line glows orange where the iron just passed, darkens to charred brown and then fades away; a few tiny embers drift up from the tip only
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
  vec4 h4;
  vec4 h5;
  vec4 h6;
  vec4 h7;
  vec4 hs;
};

vec2 P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  if (i == 8) return h3.zw;
  if (i == 9) return h4.xy;
  if (i == 10) return h4.zw;
  if (i == 11) return h5.xy;
  if (i == 12) return h5.zw;
  if (i == 13) return h6.xy;
  if (i == 14) return h6.zw;
  if (i == 15) return h7.xy;
  return h7.zw;
}

float bt_h(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
float bt_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float hy = hs.y;

  // quick reject: far from every history point
  float dmin = length(p - mouse);
  for (int k = 1; k <= 16; k++) dmin = min(dmin, length(p - P(k)));
  if (dmin > 56.0 * sc) { fragColor = vec4(0.0); return; }

  vec3 acc = vec3(0.0);
  float burn = 0.0; vec3 burnCol = vec3(0.0);
  float shade = 0.0;

  // the scorched line: distance to the polyline through the pointer history, aged from 0 (tip) to 1 (oldest)
  float heat = 0.0; float hotSeg = 0.0;
  for (int k = 0; k < 16; k++) {
    vec2 a = P(k);
    vec2 b = P(k + 1);
    vec2 ab = b - a;
    float L2 = dot(ab, ab);
    float u = L2 > 0.25 ? clamp(dot(p - a, ab) / L2, 0.0, 1.0) : 0.0;
    float d = length(p - (a + ab * u));
    float ka = k == 0 ? 0.0 : (float(k) - 1.0 + hy) / 16.0;
    float kb = (float(k) + hy) / 16.0;
    float age = mix(ka, kb, u);
    float fade = (1.0 - age) * (1.0 - 0.35 * age);
    // charred line: thin and dark, a little wider near the iron, with a soft singe around it
    float wd = (1.25 + 0.75 * (1.0 - age)) * sc;
    float line = bt_aa(d, wd) * fade;
    float singe = exp(-d * d / (9.0 * sc * sc)) * fade * 0.50;
    float hot = exp(-age * 6.0);
    float hg = exp(-d * d / (8.0 * sc * sc)) * hot;
    float hl = bt_aa(d, wd * 0.9) * hot;
    // burnt colour: orange-brown while hot, then dark walnut, then char
    vec3 bc = mix(vec3(0.20, 0.095, 0.040), vec3(0.42, 0.19, 0.06), hot);
    if (line * 0.95 > burn) { burn = line * 0.95; burnCol = bc; }
    shade = max(shade, singe + line * 0.35);
    heat = max(heat, hl);
    hotSeg = max(hotSeg, hg);
    acc += vec3(1.00, 0.50, 0.14) * (hl * 0.95 + hg * 0.45) * 0.75;
  }
  acc = min(acc, vec3(1.0, 0.62, 0.25) * 1.0);

  // the iron: a small dark rod pointing up and to the right, red-hot toward the tip, with a white-hot point
  vec2 dm = p - mouse;
  vec2 dir = normalize(vec2(0.62, -0.78));
  float along = dot(dm, dir);
  float perp = abs(dot(dm, vec2(-dir.y, dir.x)));
  float rodLen = 40.0 * sc;
  float rodW = (2.4 + 1.2 * clamp(along / rodLen, 0.0, 1.0)) * sc;
  float rod = bt_aa(perp, rodW) * step(2.0 * sc, along) * step(along, rodLen);
  float rodHeat = exp(-along / (9.0 * sc));
  vec3 rodCol = mix(vec3(0.20, 0.12, 0.08), vec3(1.00, 0.45, 0.10), rodHeat);
  float rodA = rod * (0.92);
  float flick = 0.88 + 0.12 * sin(time * 9.0) * sin(time * 5.3 + 1.0);
  float r2 = dot(dm, dm);
  float tipHalo = exp(-r2 / (17.0 * sc * 17.0 * sc)) * 0.55;
  float tipMid = exp(-r2 / (7.0 * sc * 7.0 * sc)) * 0.95;
  float tipCore = exp(-r2 / (3.4 * sc * 3.4 * sc));
  acc += vec3(1.00, 0.40, 0.08) * (tipHalo + tipMid * 0.7) * flick;
  acc += vec3(1.00, 0.92, 0.62) * tipCore * flick;
  acc += rodCol * rodA * rodHeat * 0.8;
  shade += (tipHalo * 0.9 + rodA * 0.55 + tipMid * 0.4) * 0.8;
  if (rodA > burn) { burn = rodA; burnCol = rodCol * 0.55; }

  // a few embers rising from the tip, continuously, never from the line
  vec2 back = P(2) - mouse;
  float bl = length(back);
  vec2 bdir = bl > 2.0 ? back / bl : vec2(0.0);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float rate = 0.55 + 0.35 * bt_h(fi + 2.0);
    float ph = fract(time * rate + bt_h(fi));
    float cyc = floor(time * rate + bt_h(fi));
    float sd = bt_h(fi * 3.7 + cyc * 1.9);
    vec2 ep = mouse + vec2(-0.25, -1.0) * (ph * 30.0 * sc)
            + vec2(1.0, -0.25) * (sin(ph * 6.0 + fi * 2.0 + cyc) * (3.0 + 5.0 * sd) * sc * ph)
            + bdir * (ph * 7.0 * sc);
    vec2 de = p - ep;
    float er = (1.3 + 0.9 * sd) * sc * (1.0 - 0.45 * ph);
    float life = smoothstep(0.0, 0.10, ph) * (1.0 - ph) * (1.0 - ph);
    float ember = (exp(-dot(de, de) / (er * er)) + 0.20 * exp(-dot(de, de) / (er * er * 9.0))) * life;
    acc += mix(vec3(1.00, 0.85, 0.45), vec3(1.00, 0.40, 0.10), ph) * ember * 1.3;
    shade += ember * 0.15;
  }

  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  float ba = clamp(burn, 0.0, 1.0);
  float sa = clamp(shade, 0.0, 0.50);
  vec3 ink = vec3(0.045, 0.022, 0.010);
  vec3 under = burnCol * ba + ink * sa * (1.0 - ba);
  float ua = ba + sa * (1.0 - ba);
  vec3 rgb = min(acc, vec3(la)) + under * (1.0 - la);
  float a = la + ua * (1.0 - la);
  fragColor = vec4(rgb, a) * qt_Opacity;
}
