// label: Deco foyer
// hint: an art deco lobby in black and gold: a radiating gold fan above an elevator dial whose pointer drifts between floors, glints running along the gold lines, a marble floor mirroring it all; glints run in toward the pointer
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
float df_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float df_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(df_hash(i), df_hash(i + vec2(1, 0)), f.x), mix(df_hash(i + vec2(0, 1)), df_hash(i + vec2(1, 1)), f.x), f.y);
}
float df_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * df_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float df_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float DF_FL = 0.70;                       // floor line
const vec3 DF_GOLD = vec3(0.86, 0.69, 0.38);    // champagne gold
const vec3 DF_HI = vec3(1.0, 0.91, 0.66);

// thin line of width w around a distance d >= 0
float df_ln(float d, float w) { return 1.0 - smoothstep(w * 0.35, w, d); }
float df_box(vec2 q, vec2 hs) {
  vec2 d = abs(q) - hs;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
// stepped ziggurat outline: three stacked boxes, widest and lowest first (q = x, height above the floor)
float df_zig(vec2 q, vec3 ws, vec3 hs) {
  float d0 = df_box(vec2(q.x, q.y - hs.x * 0.5), vec2(ws.x, hs.x * 0.5));
  float d1 = df_box(vec2(q.x, q.y - hs.y * 0.5), vec2(ws.y, hs.y * 0.5));
  float d2 = df_box(vec2(q.x, q.y - hs.z * 0.5), vec2(ws.z, hs.z * 0.5));
  return min(d0, min(d1, d2));
}
// a fan of gold rays above a centre (fq.y < 0 is "up"); every second ray is shorter
float df_rays(vec2 fq, float n, float rin, float rout, float w) {
  if (fq.y > 0.0) return 0.0;
  float r = length(fq);
  float a = atan(fq.x, -fq.y);
  float u = a * n / 3.14159 + n * 0.5;
  float k = floor(u + 0.5);
  float db = abs(u - k) * r * 3.14159 / n;
  float lim = mix(rout, rout * 0.72, mod(k, 2.0));
  return df_ln(db, w) * smoothstep(rin, rin + 0.01, r) * (1.0 - smoothstep(lim - 0.006, lim, r));
}
// fish-scale scallops (the classic deco wave): returns the ring lines of the top-most scale at p
float df_scallop(vec2 p) {
  float sx = 0.075, sy = 0.0375, rad = 0.052;
  float row = floor(p.y / sy);
  for (int k = 2; k >= 1; k--) {
    float rk = row + float(k);
    float off = 0.5 * mod(rk, 2.0);
    float i = floor(p.x / sx - off + 0.5);
    vec2 d = p - vec2((i + off) * sx, rk * sy);
    float r = length(d);
    if (r < rad && d.y < 0.0) {
      float l = df_ln(abs(r - rad * 0.97), 0.0024);
      l = max(l, df_ln(abs(r - rad * 0.66), 0.0020));
      l = max(l, df_ln(abs(r - rad * 0.34), 0.0018));
      return l;
    }
  }
  return 0.0;
}

// the foyer wall: p in aspect-corrected units (x 0..asp, y 0..1), returns the lit colour
vec3 df_scene(vec2 p, float asp, vec2 mp, bool hasM, float t) {
  float x = p.x - 0.5 * asp;
  float y = p.y;
  float ax = abs(x);
  float hy = DF_FL - y;                         // height above the floor
  vec2 D = vec2(0.0, 0.22);                     // centre of the dial and the great fan
  vec2 fq = vec2(x, y - D.y);
  float r = length(fq);

  // black-green lacquer with a faint warm pool behind the dial
  vec3 base = vec3(0.011, 0.028, 0.023) + vec3(0.016, 0.030, 0.020) * (1.0 - y * 0.8);
  base += vec3(0.060, 0.045, 0.018) * exp(-dot(vec2(x, y - 0.40), vec2(x, y - 0.40)) / 0.10);
  float g = 0.0;                                // bright gold lines
  float gs = 0.0;                               // dim gold lines (texture)
  float brass = 0.0;                            // dull brass fills

  // ---- the great fan above the dial
  float RF = 0.56;
  if (y < D.y) {
    float a = atan(x, -fq.y);
    float sec = floor(a * 20.0 / 3.14159 + 10.0);
    base += vec3(0.004, 0.016, 0.011) * mod(sec, 2.0) * step(r, RF) * smoothstep(0.09, 0.14, r);
    g = max(g, df_rays(fq, 40.0, 0.10, RF - 0.01, 0.0026));
    g = max(g, df_ln(abs(r - RF), 0.0034));
    g = max(g, df_ln(abs(r - RF - 0.016), 0.0022));
    gs = max(gs, 0.7 * df_ln(abs(r - 0.34), 0.0022));
    gs = max(gs, 0.6 * df_ln(abs(r - 0.22), 0.0020));
    // beads round the middle ring
    float ba = atan(x, -fq.y) * 40.0 / 3.14159;
    float bd = length(vec2((fract(ba) - 0.5) * r * 3.14159 / 40.0, r - 0.45));
    gs = max(gs, 0.9 * (1.0 - smoothstep(0.0032, 0.0052, bd)));
  }
  // scallops fill the corners above the cornice, outside the fan
  if (y < 0.24 && r > RF + 0.03) gs = max(gs, 0.55 * df_scallop(p - vec2(0.5 * asp, 0.0)));

  // ---- side bays with stepped panels and small fans, pilasters between them
  if (ax > 0.30) {
    float P = 0.20;
    float u = (ax - 0.30) / P;
    float fx = fract(u) - 0.5;
    float wx = fx * P;
    float db = (0.5 - abs(fx)) * P;                  // distance to the pilaster edge
    float pil = step(db, 0.016);
    base = mix(base, vec3(0.040, 0.044, 0.022), pil);
    g = max(g, max(df_ln(abs(db - 0.004), 0.0022), df_ln(abs(db - 0.015), 0.0022)));
    float sd = df_zig(vec2(wx, hy), vec3(0.080, 0.060, 0.042), vec3(0.34, 0.375, 0.41));
    sd = sd * (1.0 - pil) + 0.5 * pil;
    g = max(g, df_ln(abs(sd), 0.0030));
    g = max(g, 0.75 * df_ln(abs(sd + 0.011), 0.0024));
    g = max(g, 0.55 * df_ln(abs(sd + 0.022), 0.0020));
    float inner = 1.0 - smoothstep(-0.026, -0.020, sd);
    base = mix(base, base * 1.5 + vec3(0.012, 0.020, 0.012), (1.0 - step(0.0, sd)) * 0.7);
    // a small fan in the middle of each panel
    vec2 sq = vec2(wx, y - (DF_FL - 0.17));
    g = max(g, 0.9 * df_rays(sq, 14.0, 0.008, 0.050, 0.0017) * inner);
    g = max(g, df_ln(abs(length(sq) - 0.054), 0.0022) * step(sq.y, 0.0) * inner);
    g = max(g, df_ln(abs(length(sq) - 0.032), 0.0018) * step(sq.y, 0.0) * inner * 0.8);
    // flutes under the fan
    float fl = 1.0 - smoothstep(0.03, 0.09, abs(fract(wx * 150.0) - 0.5));
    gs = max(gs, 0.30 * fl * inner * step(0.0, sq.y - 0.004));
  }
  // cornice lines across the sides
  if (ax > 0.30) {
    g = max(g, df_ln(abs(y - 0.245), 0.0030));
    gs = max(gs, 0.7 * df_ln(abs(y - 0.262), 0.0020));
  }

  // ---- the elevator: stepped surround, two brass leaves with chevrons, a centre seam
  {
    float sd = df_zig(vec2(x, hy), vec3(0.235, 0.195, 0.155), vec3(0.37, 0.41, 0.445));
    g = max(g, df_ln(abs(sd), 0.0032));
    g = max(g, 0.8 * df_ln(abs(sd + 0.012), 0.0024));
    g = max(g, 0.6 * df_ln(abs(sd + 0.024), 0.0020));
    float leaf = 1.0 - smoothstep(-0.038, -0.032, sd);
    brass = leaf;
    float s = hy * 10.0 + ax * 16.0;
    gs = max(gs, 0.32 * (1.0 - smoothstep(0.02, 0.06, abs(fract(s) - 0.5))) * leaf);
    g = max(g, df_ln(ax, 0.0030) * leaf);
    g = max(g, df_ln(abs(ax - 0.006), 0.0016) * leaf * 0.6);
  }
  // door threshold
  g = max(g, df_ln(abs(hy - 0.012), 0.0022) * step(ax, 0.30));
  g = max(g, df_ln(abs(hy), 0.0030));

  // ---- the floor dial: a half circle with nine ticks and a slow pointer
  float dial = 0.0;
  float litTick = 0.0;
  {
    vec2 dq = vec2(x, y - D.y);
    float dr = length(dq);
    float up = step(dq.y, 0.0);
    float face = step(dr, 0.078) * up;
    base = mix(base, vec3(0.004, 0.007, 0.006), face);
    float plate = df_box(dq - vec2(0.0, 0.009), vec2(0.082, 0.009));
    base = mix(base, vec3(0.006, 0.010, 0.008), step(plate, 0.0));
    g = max(g, df_ln(abs(plate), 0.0024));
    g = max(g, df_ln(abs(dr - 0.080), 0.0030) * up);
    g = max(g, 0.7 * df_ln(abs(dr - 0.072), 0.0016) * up);
    // ticks every 0.36 rad, from -4 to +4
    float a = atan(dq.x, -dq.y);
    float idx = clamp(floor(a / 0.36 + 0.5), -4.0, 4.0);
    float tick = df_ln(abs(a - idx * 0.36) * dr, 0.0016) * smoothstep(0.050, 0.054, dr) * (1.0 - smoothstep(0.064, 0.068, dr)) * up;
    // pointer: floor to floor every 5 s, an eased swing
    float s = t / 5.0;
    float k = floor(s);
    float f = fract(s);
    float i0 = floor(df_hash(vec2(k - 1.0, 3.7)) * 9.0) - 4.0;
    float i1 = floor(df_hash(vec2(k, 3.7)) * 9.0) - 4.0;
    float e = smoothstep(0.0, 0.62, f);
    float th = mix(i0, i1, e) * 0.36;
    vec2 nd = vec2(sin(th), -cos(th));
    float pr = clamp(dot(dq, nd), 0.0, 0.066);
    float dn = length(dq - nd * pr);
    float needle = df_ln(dn, 0.0026) * (1.0 - smoothstep(0.062, 0.068, length(dq))) * step(0.012, dr + 0.012);
    float hub = 1.0 - smoothstep(0.0075, 0.0105, dr);
    float cur = abs(idx - mix(i0, i1, e));
    litTick = tick * (1.0 - smoothstep(0.35, 0.7, cur));
    g = max(g, max(max(tick * 0.7, litTick), max(needle, hub)));
    dial = 1.0;
  }

  // ---- glints: a slow diagonal sheen, and rings that run in toward the pointer
  float sheen = 0.0;
  float d1 = x * 0.75 + y * 0.45;
  sheen += exp(-pow((d1 - (-0.8 + 2.0 * fract(t / 12.0))) / 0.05, 2.0));
  float d2 = x * 0.75 - y * 0.30;
  sheen += 0.8 * exp(-pow((d2 - (0.8 - 1.8 * fract(t / 17.0 + 0.4))) / 0.05, 2.0));
  if (hasM) {
    float rp = length(p - mp);
    float fr = fract(t * 0.20);
    float rr = 0.85 * (1.0 - fr);
    float amp = smoothstep(0.0, 0.10, rr);
    sheen += 1.5 * exp(-pow((rp - rr) / 0.04, 2.0)) * amp;
    float fr2 = fract(t * 0.20 + 0.5);
    float rr2 = 0.85 * (1.0 - fr2);
    sheen += 1.5 * exp(-pow((rp - rr2) / 0.04, 2.0)) * smoothstep(0.0, 0.10, rr2);
    sheen += 0.5 * exp(-rp * rp / 0.004);
  }
  sheen = clamp(sheen, 0.0, 1.6);

  float warm = exp(-dot(vec2(x * 0.7, y - 0.45), vec2(x * 0.7, y - 0.45)) / 0.35);
  vec3 gcol = DF_GOLD * (0.62 + 0.30 * warm) + DF_HI * sheen * 0.85;
  vec3 col = base;
  col += vec3(0.105, 0.078, 0.034) * brass * (0.65 + 0.35 * smoothstep(0.35, 0.0, ax));   // brass leaves
  col += DF_GOLD * sheen * 0.10 * brass;
  col = mix(col, DF_GOLD * 0.34 + DF_HI * sheen * 0.30, clamp(gs, 0.0, 1.0));
  col = mix(col, gcol, clamp(g, 0.0, 1.0));
  col += DF_HI * litTick * 0.4;
  return col;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  vec3 col;
  if (uv.y < DF_FL) {
    col = df_scene(p, asp, mp, hasM, t);
  } else {
    // ---- polished black marble floor in perspective, with gold veins, gold tile seams and a mirror image of the wall
    float x = p.x - 0.5 * asp;
    float depth = uv.y - DF_FL;
    float dn = depth / (1.0 - DF_FL);
    float gz = depth + 0.035;
    vec2 fp = vec2(x / gz * 1.3, 0.27 / gz);
    float vn = df_fbm(fp * 0.32 + vec2(3.0, 1.0) + df_fbm(fp * 0.6) * 1.4);
    float vein = 1.0 - smoothstep(0.0, 0.06, abs(vn - 0.5));
    vec2 tf = abs(fract(fp) - 0.5);
    float seam = (1.0 - smoothstep(0.0, 0.025 + 0.03 * gz, 0.5 - max(tf.x, tf.y))) * smoothstep(0.02, 0.10, depth);
    float chk = mod(floor(fp.x) + floor(fp.y), 2.0);
    vec3 marble = vec3(0.012, 0.022, 0.018) + vec3(0.010, 0.016, 0.012) * chk + vec3(0.018, 0.024, 0.020) * df_fbm(fp * 1.2);
    marble += vec3(0.34, 0.26, 0.12) * vein * 0.42;
    marble = mix(marble, DF_GOLD * 0.42, seam * 0.8);
    float wob = (df_noise(vec2(x * 60.0, depth * 5.0)) - 0.5) * 0.004 * (0.3 + dn);
    vec3 refl = df_scene(vec2(p.x + wob, DF_FL - depth * 0.95), asp, mp, hasM, t);
    float rk = 0.62 * (1.0 - 0.50 * dn) * (1.0 - 0.25 * vein);
    col = marble + refl * rk;
    col += vec3(0.5, 0.4, 0.2) * 0.04 * exp(-depth * 40.0);              // the line where floor meets wall
    // seam glints: the same sheen travels along the tile lines, led toward the pointer
    if (hasM) {
      float rp = length(p - mp);
      float rr = 0.85 * (1.0 - fract(t * 0.20));
      col += DF_HI * seam * 0.4 * exp(-pow((rp - rr) / 0.05, 2.0)) * smoothstep(0.0, 0.10, rr);
    }
  }

  // the user's picture shows faintly through the black
  col += w * 0.05 * (1.0 - clamp(df_luma(col) * 3.0, 0.0, 1.0));
  col *= 0.97 + 0.06 * df_luma(w);
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
