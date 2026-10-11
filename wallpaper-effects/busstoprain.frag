// label: Bus stop rain
// hint: an evening bus shelter in the rain: bokeh street lights, a warm lit bus drifting by now and then, puddle rings and drops on the glass; a drop runs along the glass to the pointer
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
float bs_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bs_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bs_hash(i), bs_hash(i + vec2(1, 0)), f.x), mix(bs_hash(i + vec2(0, 1)), bs_hash(i + vec2(1, 1)), f.x), f.y);
}
float bs_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * bs_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float bs_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float BS_HZ = 0.600;      // where the road starts

vec3 bs_pal(float h) {
  if (h < 0.36) return vec3(1.00, 0.64, 0.24);   // sodium amber
  if (h < 0.56) return vec3(1.00, 0.86, 0.66);   // warm white
  if (h < 0.70) return vec3(1.00, 0.26, 0.20);   // tail-light red
  if (h < 0.82) return vec3(0.30, 0.95, 0.70);   // shop-sign green
  if (h < 0.92) return vec3(0.66, 0.82, 1.00);   // cold white
  return vec3(1.00, 0.40, 0.72);                  // pink neon
}

// one layer of out-of-focus lights, one disc per grid cell; elong > 1 stretches the discs downward (road reflections)
vec3 bs_bokeh(vec2 q, float scale, float seed, float yLo, float yHi, float rad, float dens, float elong, float t) {
  vec2 g = q * scale;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h1 = bs_hash(id + seed);
  float on = step(1.0 - dens, h1);
  vec2 pos = vec2(0.5 + (bs_hash(id + seed + 3.1) - 0.5) * 0.36, 0.5 + (bs_hash(id + seed + 7.7) - 0.5) * 0.36);
  vec2 d = f - pos;
  d.y /= elong;
  float r = rad * (0.65 + 0.7 * bs_hash(id + seed + 11.3));
  float l = length(d) / r;
  float disc = smoothstep(1.0, 0.86, l) * (0.55 + 0.45 * smoothstep(0.55, 1.0, l)); // brighter rim, like real bokeh
  float cy = (id.y + 0.5) / scale;
  float band = smoothstep(yLo - 0.03, yLo, cy) * smoothstep(yHi + 0.03, yHi, cy);
  float tw = 0.85 + 0.15 * sin(t * (0.5 + bs_hash(id + seed + 5.0)) + h1 * 40.0);
  return bs_pal(bs_hash(id + seed + 9.0)) * disc * on * band * tw * (0.45 + 0.55 * bs_hash(id + seed + 13.0));
}

// the glow the same lights leave in the wet air: very soft, big, low
vec3 bs_halo(vec2 q, float scale, float seed, float yLo, float yHi, float dens) {
  vec2 g = q * scale;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h1 = bs_hash(id + seed);
  vec2 pos = vec2(0.5 + (bs_hash(id + seed + 3.1) - 0.5) * 0.3, 0.5 + (bs_hash(id + seed + 7.7) - 0.5) * 0.3);
  vec2 d = f - pos;
  float cy = (id.y + 0.5) / scale;
  float band = smoothstep(yLo - 0.04, yLo, cy) * smoothstep(yHi + 0.04, yHi, cy);
  return bs_pal(bs_hash(id + seed + 9.0)) * exp(-dot(d, d) / 0.018) * step(1.0 - dens, h1) * band;
}

// the bus: dark body, a row of warm lit windows with passengers, a red destination sign, two headlights; soft because the glass is wet
vec4 bs_bus(vec2 q, float bx, float soft) {
  float W = 0.95;
  float lx = q.x - bx;
  if (lx < -0.05 || lx > W + 0.05) return vec4(0.0);
  float body = smoothstep(0.0, soft, lx) * smoothstep(W, W - soft, lx) * smoothstep(0.452, 0.452 + soft, q.y) * smoothstep(0.668, 0.668 - soft, q.y);
  float win = smoothstep(0.490, 0.490 + soft, q.y) * smoothstep(0.572, 0.572 - soft, q.y) * smoothstep(0.03, 0.03 + soft, lx) * smoothstep(W - 0.16, W - 0.16 - soft, lx);
  float cellI = floor(lx / 0.135);
  float cf = fract(lx / 0.135);
  win *= smoothstep(0.06, 0.06 + soft * 6.0, cf) * smoothstep(0.96, 0.96 - soft * 6.0, cf);
  float hw = bs_hash(vec2(cellI, 4.0));
  vec3 inside = vec3(1.0, 0.76, 0.40) * (0.62 + 0.38 * hw);
  // a passenger or two as soft dark heads and shoulders
  vec2 pc = vec2((cellI + 0.5) * 0.135 + (hw - 0.5) * 0.03, 0.560);
  float pr = length((vec2(lx, q.y) - pc) * vec2(1.0, 1.3));
  float person = step(0.45, hw) * smoothstep(0.034, 0.018, pr) * smoothstep(0.545, 0.575, q.y);
  inside = mix(inside, vec3(0.20, 0.10, 0.04), person * 0.85);
  vec3 c = vec3(0.020, 0.026, 0.040) + vec3(0.05, 0.07, 0.10) * smoothstep(0.462, 0.452, q.y);       // roof sheen
  c += vec3(0.05, 0.03, 0.02) * smoothstep(0.55, 0.668, q.y);
  c = mix(c, inside, win);
  // the destination sign above the windscreen end and the headlight pair
  float dsign = smoothstep(W - 0.14, W - 0.14 + soft, lx) * smoothstep(W - 0.02, W - 0.02 - soft, lx) * smoothstep(0.462, 0.462 + soft, q.y) * smoothstep(0.484, 0.484 - soft, q.y);
  c = mix(c, vec3(1.0, 0.45, 0.14), dsign * 0.95);
  vec3 col = c;
  float a = body;
  vec2 hl = vec2(lx - W + 0.012, q.y - 0.637);
  float lamp = exp(-dot(hl, hl) / 0.0006) * 1.1 + exp(-dot(hl, hl) / 0.012) * 0.45;
  col += vec3(1.0, 0.90, 0.72) * lamp;
  a = max(a, clamp(lamp, 0.0, 1.0));
  return vec4(col, a);
}

vec3 bs_scene(vec2 q, float asp, float t, vec2 busPos) {
  float y = q.y;
  // night air with a warm city glow low down
  vec3 col = mix(vec3(0.035, 0.055, 0.115), vec3(0.120, 0.130, 0.190), smoothstep(0.0, BS_HZ, y));
  col += vec3(0.42, 0.24, 0.10) * exp(-pow((y - 0.575) / 0.11, 2.0)) * 0.50;
  col += vec3(0.08, 0.10, 0.16) * bs_fbm3(vec2(q.x * 2.0 + t * 0.01, y * 4.0));
  if (y < BS_HZ + 0.002) {
    // skyline: blocks of buildings, their windows only soft warm specks
    float bid = floor(q.x * 7.0);
    float bh = 0.40 + 0.13 * bs_hash(vec2(bid, 1.0)) + 0.03 * bs_hash(vec2(floor(q.x * 28.0), 2.0));
    float bld = smoothstep(bh, bh + 0.006, y);
    vec2 wg = vec2(q.x * 46.0, y * 38.0);
    vec2 wi = floor(wg);
    float wl = step(0.72, bs_hash(wi + 3.0)) * smoothstep(0.34, 0.12, length(fract(wg) - 0.5));
    vec3 bc = vec3(0.016, 0.022, 0.040) + vec3(0.95, 0.60, 0.26) * wl * 0.20;
    col = mix(col, bc, bld);
    col += bs_halo(q, 4.0, 70.0, 0.30, 0.64, 0.80) * 0.28;
    col += bs_bokeh(q, 4.5, 90.0, 0.25, 0.62, 0.34, 0.55, 1.0, busPos.y) * 0.85;
    col += bs_bokeh(q, 7.0, 1.0, 0.34, 0.62, 0.30, 0.80, 1.0, busPos.y) * 0.95;
    col += bs_bokeh(q, 12.0, 20.0, 0.38, 0.60, 0.26, 0.75, 1.0, busPos.y) * 0.80;
    col += bs_bokeh(q, 19.0, 50.0, 0.40, 0.60, 0.24, 0.65, 1.0, busPos.y) * 0.60;
    vec4 bus = bs_bus(q, busPos.x, 0.011);
    vec4 glowBus = bs_bus(q, busPos.x, 0.06);
    col += glowBus.rgb * glowBus.a * 0.16;
    col = mix(col, bus.rgb, bus.a);
  } else {
    // the wet road: dark asphalt, a glossy sheen, and the lights stretched down it
    float dy = y - BS_HZ;
    vec3 road = mix(vec3(0.040, 0.050, 0.075), vec3(0.012, 0.016, 0.028), smoothstep(0.0, 0.40, dy));
    float rip = bs_fbm3(vec2(q.x * 10.0, dy * 40.0) + t * vec2(0.05, 0.0));
    vec2 rq = vec2(q.x + (rip - 0.5) * 0.020, BS_HZ - dy * 0.38);
    float fade = exp(-dy * 2.2);
    vec3 refl = bs_bokeh(rq, 4.5, 90.0, 0.25, 0.62, 0.34, 0.55, 1.0, busPos.y) * 0.85
              + bs_bokeh(rq, 7.0, 1.0, 0.34, 0.62, 0.30, 0.80, 1.0, busPos.y) * 0.95
              + bs_bokeh(rq, 12.0, 20.0, 0.38, 0.60, 0.26, 0.75, 1.0, busPos.y) * 0.80
              + bs_bokeh(rq, 19.0, 50.0, 0.40, 0.60, 0.24, 0.65, 1.0, busPos.y) * 0.60;
    vec4 bus = bs_bus(rq, busPos.x, 0.03);
    refl += bus.rgb * bus.a * 0.7;
    col = road + refl * fade * 0.70;
    col += vec3(0.18, 0.12, 0.07) * exp(-dy * 20.0) * 0.5;
    // rain rings on the road
    float RS = 7.0;
    vec2 g = vec2(q.x * RS, dy * RS * 2.2);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = bs_hash(id + 5.0);
    float k = fract(t * (0.35 + 0.35 * h) + h * 9.0);
    vec2 d = (f - (vec2(bs_hash(id + 1.0), bs_hash(id + 2.0)) - 0.5) * 0.4) * vec2(1.0, 0.45);
    float ring = exp(-pow((length(d) - k * 0.42) / 0.028, 2.0)) * (1.0 - k) * step(0.45, h);
    col += (vec3(0.45, 0.50, 0.62) + refl * 0.5) * ring * 0.24 * smoothstep(0.0, 0.15, dy);
  }
  return col;
}

// a lens: a round drop of water that shows the scene magnified and upside down; returns inside mask, writes offset, rim shine
float bs_lens(vec2 d, float r, out vec2 off, out float shine) {
  float l = length(d) / r;
  float inside = smoothstep(1.0, 0.92, l);
  off = -d * 1.7 * inside;
  shine = smoothstep(0.95, 0.70, length(d / r - vec2(-0.35, -0.38))) * 0.0
        + smoothstep(0.24, 0.0, length(d / r - vec2(-0.38, -0.42))) * inside
        + smoothstep(0.86, 1.0, l) * smoothstep(1.02, 0.96, l) * 0.35;
  return inside;
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

  // ---- the bus goes by every 19 s, left to right, then the street is empty for a while
  float kb = fract((t + 6.0) / 19.0);
  float bx = (kb < 0.62) ? mix(-1.05, asp + 0.1, kb / 0.62) : -5.0;
  vec2 busPos = vec2(bx, t);

  // ---- glass: drops that sit still, drops that creep down, and the trail that runs toward the pointer
  vec2 off = vec2(0.0);
  float shineSum = 0.0, dark = 0.0, clear = 0.0;
  for (int s = 0; s < 2; s++) {
    float fs = float(s);
    float S = 17.0 + 15.0 * fs;
    vec2 g = p * S + vec2(fs * 9.0, 3.0);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = bs_hash(id + fs * 31.0);
    float here = step(0.62 - 0.08 * fs, h);
    vec2 cen = (vec2(bs_hash(id + 2.0 + fs), bs_hash(id + 5.0 + fs)) - 0.5) * 0.46;
    float rr = (0.12 + 0.14 * bs_hash(id + 8.0)) * (1.0 - 0.25 * fs);
    vec2 o; float sh;
    float ins = bs_lens((f - cen) * vec2(1.0, 0.88), rr, o, sh) * here;
    off += o / S * here * 1.0;
    shineSum += sh * here;
    dark += ins * smoothstep(0.55, 1.0, length((f - cen) / rr)) * 0.16;
    clear += ins * 0.6;
  }
  // creeping drops with a thin wet trail above each
  {
    float NC = 9.0;
    float cid = floor(p.x * NC);
    float ch = bs_hash(vec2(cid, 3.0));
    if (ch > 0.38) {
      float cxp = (cid + 0.5 + (bs_hash(vec2(cid, 6.0)) - 0.5) * 0.5) / NC;
      float sp = 0.020 + 0.030 * bs_hash(vec2(cid, 9.0));
      float yd = fract(t * sp + ch * 7.0);
      float yy = -0.1 + 1.25 * yd + 0.012 * sin(yd * 60.0 + ch * 20.0);
      float wob = 0.004 * sin(uv.y * 30.0 + ch * 12.0);
      float dx = p.x - cxp - wob;
      float above = yy - uv.y;
      float trail = exp(-dx * dx / 0.000010) * smoothstep(0.0, 0.01, above) * smoothstep(0.34, 0.02, above);
      vec2 o; float sh;
      float ins = bs_lens(vec2(dx, uv.y - yy) * vec2(1.0, 0.8), 0.0105, o, sh);
      off += o;
      shineSum += sh;
      dark += ins * 0.2;
      clear += trail * 0.8 + ins;
    }
  }
  // the pointer: a drop runs along the glass to it, drawing a clear line behind it
  {
    float T = 7.5;
    float cyc = floor(t / T);
    float k = fract(t / T);
    vec2 M = hasM ? vec2(m.x * asp, m.y) : vec2(0.5 * asp, 1.4);
    vec2 A = hasM ? M + vec2((bs_hash(vec2(cyc, 1.0)) - 0.5) * 0.7, -(0.30 + 0.25 * bs_hash(vec2(cyc, 2.0)))) : vec2(0.35 * asp, 0.05);
    float s = smoothstep(0.02, 0.62, k);
    vec2 P = mix(A, M, s);
    vec2 D = P - A;
    float dd = max(dot(D, D), 1e-5);
    float u = clamp(dot(p - A, D) / dd, 0.0, 1.0);
    vec2 nrm = normalize(vec2(-D.y, D.x) + 1e-5);
    vec2 cl = A + D * u + nrm * 0.014 * sin(u * 11.0 + cyc) * sin(u * 3.14159);
    float dist = length(p - cl);
    float fadeOut = smoothstep(1.0, 0.78, k) * (hasM ? 1.0 : 0.0);
    float tr = exp(-dist * dist / 0.000028) * (0.30 + 0.70 * u) * fadeOut * step(0.02, k);
    vec2 hp = p - (P + nrm * 0.014 * sin(s * 11.0 + cyc) * sin(s * 3.14159));
    vec2 o; float sh;
    float ins = bs_lens(hp * vec2(1.0, 0.85), 0.020, o, sh) * fadeOut * step(0.02, k);
    off += o + nrm * 0.0;
    shineSum += sh * fadeOut;
    dark += ins * 0.2;
    clear += tr + ins;
    // the trail slightly bends the light along its length
    off += nrm * tr * 0.006 * sin(u * 80.0);
    shineSum += tr * 1.5;
    dark += tr * 0.10;
  }

  vec3 col = bs_scene(p + off, asp, t, busPos);

  // condensation: a cool veil over the glass, wiped clear where drops and trails run
  float fog = (0.40 + 0.6 * bs_fbm3(p * 5.0 + vec2(0.0, 2.0))) * (1.0 - clamp(clear, 0.0, 1.0) * 0.9);
  col = mix(col, vec3(0.085, 0.115, 0.165) + col * 0.5, 0.20 * fog);
  col *= 1.0 - dark;
  col += vec3(0.85, 0.90, 1.0) * shineSum * 0.16;

  // ---- the shelter: a roof beam with a cold strip light on top, and a steel post on the left
  float roof = smoothstep(0.048, 0.038, uv.y);
  col = mix(col, vec3(0.012, 0.016, 0.026) + vec3(0.06, 0.08, 0.10) * smoothstep(0.038, 0.046, uv.y) * smoothstep(0.052, 0.046, uv.y), roof);
  col += vec3(0.50, 0.62, 0.80) * exp(-pow((uv.y - 0.052) / 0.018, 2.0)) * 0.07;
  float post = smoothstep(0.040, 0.035, uv.x);
  float postHi = smoothstep(0.004, 0.0, abs(uv.x - 0.032)) * 0.18 + smoothstep(0.006, 0.0, abs(uv.x - 0.010)) * 0.08;
  col = mix(col, vec3(0.020, 0.024, 0.034) + vec3(0.7, 0.8, 1.0) * postHi, post);

  // long thin streaks of rain sliding down the pane, barely there
  {
    vec2 sq = vec2(p.x * 140.0 + uv.y * 6.0, uv.y * 3.0 - t * 1.1);
    float sid = floor(sq.x);
    float sh2 = bs_hash(vec2(sid, 2.0));
    float st = smoothstep(0.80, 1.0, fract(sq.y + sh2 * 9.0)) * smoothstep(0.35, 0.0, abs(fract(sq.x) - 0.5)) * step(0.6, sh2);
    col += vec3(0.55, 0.65, 0.85) * st * 0.045 * (0.4 + col.r + col.g);
  }

  // the user's picture stays a faint tone under the scene
  col = mix(col, col * (0.55 + 1.0 * bs_luma(w)), 0.20);
  col *= 1.0 - 0.40 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
