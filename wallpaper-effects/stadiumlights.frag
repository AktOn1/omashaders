// label: Stadium lights
// hint: a floodlit stadium at night from the top of the stands: striped green pitch with white lines, four bright light towers with halos and moths, a ripple of crowd lights and a ball that arcs now and then; the pointer is a spotlight circle on the pitch
// category: Style studies
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
float sl_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 sl_h2(vec2 p) { return vec2(sl_hash(p), sl_hash(p + vec2(37.1, 11.7))); }
float sl_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sl_hash(i), sl_hash(i + vec2(1, 0)), f.x), mix(sl_hash(i + vec2(0, 1)), sl_hash(i + vec2(1, 1)), f.x), f.y);
}
float sl_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * sl_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float SL_YH = -0.25;      // horizon of the pitch plane (above the picture)
const float SL_YF = 0.27;       // far touchline on screen
const float SL_YN = 0.93;       // near touchline on screen
const float SL_ROOF = 0.14;     // top of the far stand

float sl_line(float d, float lw, float aa) { return smoothstep(lw + aa, lw - aa * 0.5, d); }

// signed distance of a point to a box (centre c, half size hs)
float sl_box(vec2 q, vec2 hs) {
  vec2 d = abs(q) - hs;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// the floodlight tower j: x fraction, y, panel half width, glare size
vec4 sl_tower(int j, float asp) {
  if (j == 0) return vec4(0.25 * asp, 0.075, 0.030, 1.0);
  if (j == 1) return vec4(0.75 * asp, 0.075, 0.030, 1.0);
  if (j == 2) return vec4(0.045 * asp, 0.185, 0.050, 1.7);
  return vec4(0.955 * asp, 0.185, 0.050, 1.7);
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

  // pitch plane geometry: X across (world), Z depth; v = 0 at the far touchline, 1 at the near one
  float dy = uv.y - SL_YH;
  float Zn = 1.0 / (SL_YN - SL_YH), Zf = 1.0 / (SL_YF - SL_YH);
  float D = Zf - Zn;
  float HX = 0.5 * asp * 1.04 / (SL_YN - SL_YH);
  float Xw = (p.x - 0.5 * asp) / dy;
  float Zw = Zf - 1.0 / dy;                    // depth from the far edge, world units
  float u = Xw / HX;
  float v = Zw / D;

  vec3 col;
  // ---- sky: deep blue-black with a haze of light over the roofs
  vec3 skyTop = vec3(0.008, 0.020, 0.070);
  vec3 skyLow = vec3(0.05, 0.10, 0.22);
  col = mix(skyTop, skyLow, smoothstep(0.0, SL_ROOF + 0.02, uv.y));
  col += vec3(0.05, 0.07, 0.12) * sl_fbm(p * vec2(2.5, 4.0) + vec2(t * 0.01, 0.0)) * smoothstep(0.0, 0.14, uv.y);

  bool onGrass = (uv.y > SL_YF - 0.03) && abs(u) < 1.07 && v > -0.12 && v < 1.06;
  bool inner = abs(u) < 1.0 && v > 0.0 && v < 1.0;
  if (onGrass) {
    // mown stripes across the length, fine grain, a darker margin outside the lines
    float band = floor((u * 0.5 + 0.5) * 14.0);
    float par = mod(band, 2.0);
    vec3 g0 = vec3(0.045, 0.40, 0.085);
    vec3 g1 = vec3(0.085, 0.52, 0.115);
    col = mix(g0, g1, par);
    col *= 0.90 + 0.20 * sl_noise(vec2(Xw, Zw) * 55.0);
    col *= 0.94 + 0.10 * sl_noise(vec2(Xw, Zw) * 9.0);
    if (!inner) col *= 0.62;
    // floodlight wash: brighter in the middle, a little darker at the corners
    col *= 0.78 + 0.34 * (1.0 - 0.6 * u * u) * (1.0 - 0.35 * pow(abs(v - 0.5) * 2.0, 2.0));
    // white lines
    float aa = 0.0022 * dy;
    float lw = 0.0075 * (0.6 + 0.4 * dy);
    float ax = abs(Xw);
    float dz = Zw - 0.5 * D;
    float line = 0.0;
    float dB = min(HX - ax, min(Zw, D - Zw));
    if (inner) line = max(line, sl_line(abs(dB), lw, aa));
    line = max(line, sl_line(ax, lw, aa) * (inner ? 1.0 : 0.0));
    float Rc = 0.135 * D;
    line = max(line, sl_line(abs(length(vec2(Xw, dz)) - Rc), lw, aa) * (inner ? 1.0 : 0.0));
    line = max(line, smoothstep(0.016, 0.010, length(vec2(Xw, dz))) * (inner ? 1.0 : 0.0));
    float hxb = 0.157 * HX * 2.0;
    float hzb = 0.296 * D;
    float dpen = abs(sl_box(vec2(ax - (HX - hxb * 0.5), dz), vec2(hxb * 0.5, hzb)));
    float hxg = 0.052 * HX * 2.0;
    float hzg = 0.135 * D;
    float dgoal = abs(sl_box(vec2(ax - (HX - hxg * 0.5), dz), vec2(hxg * 0.5, hzg)));
    float darc = abs(length(vec2(ax - (HX - 0.105 * HX * 2.0), dz)) - Rc) + step(HX - hxb, ax) * 1.0;
    if (inner) line = max(line, max(sl_line(dpen, lw, aa), max(sl_line(dgoal, lw, aa), sl_line(darc, lw, aa))));
    col = mix(col, vec3(0.93, 0.98, 0.95), line * 0.88);
  } else if (uv.y > SL_ROOF) {
    // ---- stands: a dark crowd, tiny lights (phones, flashes) that ripple along the rows
    float y = uv.y;
    float gy = log(1.0 + 4.0 * y) * 35.7;
    float rowc = floor(gy) + 0.5;
    float yrow = (exp(rowc / 35.7) - 1.0) / 4.0;
    float s = 0.007 * (1.0 + 4.0 * yrow);
    vec2 cid = vec2(floor(p.x / s), floor(gy));
    vec2 cf = vec2(fract(p.x / s), fract(gy)) - 0.5;
    vec2 h = sl_h2(cid);
    vec3 base = vec3(0.012, 0.018, 0.040);
    base += vec3(0.020, 0.024, 0.040) * (0.4 + 0.6 * h.x);                        // heads and shoulders
    float rowShade = 0.8 + 0.4 * smoothstep(0.35, 0.65, abs(fract(gy) - 0.5) * 2.0 + 0.0);
    col = base * rowShade;
    float wave = 0.5 + 0.5 * sin(p.x * 4.2 - t * 1.0 + y * 7.0) * sin(p.x * 1.3 + t * 0.4);
    float thr = 0.035 + 0.20 * smoothstep(0.55, 1.0, wave);
    float lit = step(h.y, thr);
    float blink = 0.55 + 0.45 * sin(t * (1.0 + 2.0 * h.x) + h.y * 40.0);
    vec3 lc = mix(vec3(1.0, 0.92, 0.72), vec3(0.75, 0.88, 1.0), step(0.55, h.x));
    float dd = length(cf * vec2(1.0, 1.1));
    col += lc * lit * blink * smoothstep(0.30, 0.10, dd) * 0.72;
    // the stand is lit from the floodlights: a faint wash near the roof
    col += vec3(0.02, 0.035, 0.07) * smoothstep(0.35, SL_ROOF, y) * 2.0;
    // advertising boards along the far touchline
    float by0 = SL_YF - 0.032;
    if (y > by0 && y < SL_YF - 0.012 && abs(u) < 1.07) {
      float seg = floor(p.x * 6.0 - t * 0.12);
      vec3 pal = 0.5 + 0.5 * cos(6.28318 * (sl_hash(vec2(seg, 3.0)) + vec3(0.0, 0.33, 0.67)));
      col = mix(col, pal * 0.8 + 0.1, 0.70);
    }
  }
  // roof edge of the far stand: a lit rim and a dark roof against the sky
  {
    float roofMask = smoothstep(SL_ROOF + 0.004, SL_ROOF - 0.004, uv.y);
    float rim = exp(-pow((uv.y - SL_ROOF) / 0.0035, 2.0));
    col = mix(col, col * 0.7 + vec3(0.02, 0.03, 0.06), roofMask * 0.0);
    col += vec3(0.45, 0.58, 0.85) * rim * (0.16 + 0.12 * sl_noise(vec2(p.x * 9.0, 2.0)));
  }

  // ---- the pointer: a spotlight circle on the pitch
  {
    float sm = clamp(m.y, SL_YF + 0.03, SL_YN - 0.03);
    float sx = clamp(m.x * asp, 0.5 * asp - HX * 0.9 * (sm - SL_YH), 0.5 * asp + HX * 0.9 * (sm - SL_YH));
    float dym = sm - SL_YH;
    float Xm = (sx - 0.5 * asp) / dym;
    float Zm = Zf - 1.0 / dym;
    float dsp = length(vec2(Xw - Xm, Zw - Zm));
    float Rs = 0.17;
    float spot = smoothstep(Rs, Rs * 0.35, dsp);
    float ring = exp(-pow((dsp - Rs) / (0.012), 2.0));
    float on = (hasM && onGrass) ? 1.0 : 0.0;
    col *= 1.0 + 0.85 * spot * on;
    col += vec3(0.20, 0.30, 0.18) * spot * on * 0.55;
    col += vec3(0.85, 0.95, 0.85) * ring * on * 0.18;
  }

  // ---- ball: an arc over the pitch every now and then
  {
    float T = 11.0;
    float ck = t / T + 0.18;
    float cid = floor(ck);
    float k = fract(ck);
    if (k < 0.34) {
      float s = k / 0.34;
      vec2 a = vec2(mix(-0.8, 0.8, sl_hash(vec2(cid, 1.0))), mix(0.15, 0.85, sl_hash(vec2(cid, 2.0))));
      vec2 b = vec2(mix(-0.8, 0.8, sl_hash(vec2(cid, 3.0))), mix(0.15, 0.85, sl_hash(vec2(cid, 4.0))));
      vec2 g = mix(a, b, s);
      float Zg = Zf - g.y * D;
      float dg = 1.0 / Zg;
      float gx = 0.5 * asp + g.x * HX * dg;
      float gy2 = SL_YH + dg;
      float hgt = 4.0 * s * (1.0 - s);
      float by = gy2 - hgt * 0.20 * (0.5 + dg);
      float rb = 0.012 * (0.3 + dg);
      // shadow on the grass
      float sd = length((p - vec2(gx, gy2)) / vec2(rb * 1.8, rb * 0.7));
      col *= 1.0 - 0.45 * smoothstep(1.0, 0.3, sd) * (0.4 + 0.6 * (1.0 - hgt * 0.8));
      float db = length(p - vec2(gx, by));
      float ball = smoothstep(rb, rb * 0.7, db);
      float shade = 0.80 + 0.20 * smoothstep(rb, -rb, (p.y - by) * 0.7 + (p.x - gx) * 0.5);
      col = mix(col, vec3(0.97, 0.98, 1.0) * shade, ball);
      col += vec3(0.9, 0.95, 1.0) * exp(-db / (rb * 3.0)) * 0.18 * smoothstep(0.0, 0.1, s) * smoothstep(1.0, 0.9, s);
    }
  }

  // ---- floodlight towers: pole, lamp panel, halo, beam haze and moths
  vec3 tgt = vec3(0.5 * asp, 0.62, 0.0);
  for (int j = 0; j < 4; j++) {
    vec4 tw = sl_tower(j, asp);
    vec2 tp = tw.xy;
    float ps = tw.w;
    vec2 d = p - tp;
    // pole
    if (p.y > tp.y && !onGrass && !(j < 2 && p.y > SL_YF - 0.012)) {
      float pw = 0.0035 * ps * (1.0 + 0.8 * (p.y - tp.y));
      col *= 1.0 - 0.8 * smoothstep(pw + 0.001, pw - 0.001, abs(d.x)) * smoothstep(tp.y, tp.y + 0.03, p.y);
    }
    // beam: a faint cone from the panel to the middle of the pitch, hazy
    vec2 dirv = tgt.xy - tp;
    float blen = length(dirv);
    vec2 dn = dirv / blen;
    float sp = dot(d, dn) / blen;
    float lat = abs(dot(d, vec2(-dn.y, dn.x)));
    if (sp > 0.0 && sp < 1.1) {
      float wdt = 0.012 + 0.12 * sp * ps * 0.8;
      float beam = smoothstep(wdt, 0.0, lat) * (1.0 - smoothstep(0.55, 1.1, sp)) * (0.55 + 0.9 * sl_fbm(vec2(sp * 6.0 - t * 0.04, lat * 25.0 + float(j))));
      col += vec3(0.50, 0.62, 0.85) * beam * 0.075 * ps;
    }
    // lamp panel: a dark frame with a grid of bright lamps
    vec2 hs = vec2(tw.z, tw.z * 0.62);
    vec2 q = d / hs;
    if (abs(q.x) < 1.0 && abs(q.y) < 1.0) {
      vec2 gcell = fract((q * 0.5 + 0.5) * vec2(5.0, 3.0)) - 0.5;
      float lamp = smoothstep(0.42, 0.18, length(gcell));
      col = mix(vec3(0.12, 0.13, 0.17), vec3(1.0, 0.97, 0.88), lamp);
    }
    // halo with long tails, a faint horizontal streak
    float r = length(d);
    float glow = 0.55 / (1.0 + pow(r / (0.030 * ps), 2.0)) + 0.22 / (1.0 + pow(r / (0.11 * ps), 2.0)) + 0.06 / (1.0 + pow(r / (0.40 * ps), 2.0));
    float streak = exp(-abs(d.y) * 90.0 / ps) * exp(-abs(d.x) * 4.0 / ps) * 0.14;
    col += vec3(1.0, 0.95, 0.82) * (glow + streak) * 0.9;
    // moths: flutter in the beam and circle the lamps
    if (r < 0.55) {
      vec2 perp = vec2(-dn.y, dn.x);
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float hh = sl_hash(vec2(fi, float(j) * 7.0));
        float hh2 = sl_hash(vec2(fi + 11.0, float(j) * 3.0));
        float ph = hh * 6.28;
        float s0 = 0.05 + 0.30 * hh2;
        vec2 base = tp + dn * blen * s0 * 0.9;
        float A = (0.02 + 0.06 * s0) * ps;
        vec2 mp2 = base + perp * A * sin(t * (0.5 + 0.7 * hh) + ph) + dn * 0.04 * ps * sin(t * (0.8 + 0.5 * hh2) + ph * 2.0);
        if (i == 0) mp2 = tp + 0.045 * ps * vec2(cos(t * 0.9 + ph), 0.7 * sin(t * 1.1 + ph));         // one circles the lamps
        float dm = length(p - mp2);
        float wing = (0.0030 + 0.0022 * abs(sin(t * 12.0 + ph))) * (0.7 + 0.5 * ps);
        float moth = exp(-dm * dm / (wing * wing));
        col += vec3(1.0, 0.96, 0.82) * moth * 0.95 + vec3(1.0, 0.92, 0.7) * exp(-dm / 0.010) * 0.10;
      }
    }
  }

  // let the user's picture show through as faint tint
  col += w * vec3(0.40, 0.50, 0.70) * 0.06;
  col *= 0.95 + 0.10 * sl_luma(w);
  col *= 1.0 - 0.34 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
