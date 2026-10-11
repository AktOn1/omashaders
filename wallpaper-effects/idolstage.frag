// label: Idol stage
// hint: an empty concert stage, coloured light beams criss-crossing over a glowing tiled floor with a ripple ring, floating star and heart sparkles and confetti dots; the beams swing toward the pointer
// category: Anime and play
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
float is_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float is_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float is_d2(vec2 v) { return dot(v, v); }

const float IS_HZ = 0.60;   // back edge of the stage floor
const float IS_YF = 0.80;   // the plane where the beams touch the floor

vec3 is_pastel(float h) {
  if (h < 0.2) return vec3(1.00, 0.62, 0.86);
  if (h < 0.4) return vec3(0.60, 0.96, 1.00);
  if (h < 0.6) return vec3(1.00, 0.95, 0.62);
  if (h < 0.8) return vec3(0.80, 0.70, 1.00);
  return vec3(0.70, 1.00, 0.86);
}
vec3 is_beamCol(int i) {
  if (i == 0) return vec3(1.00, 0.40, 0.76);
  if (i == 1) return vec3(0.28, 0.92, 1.00);
  if (i == 2) return vec3(1.00, 0.90, 0.40);
  if (i == 3) return vec3(0.62, 0.50, 1.00);
  if (i == 4) return vec3(0.42, 1.00, 0.78);
  return vec3(1.00, 0.52, 0.60);
}

// criss-crossing beams from lamps on the truss; the pointer pulls them around
vec3 is_beams(vec2 p, float asp, vec2 pm, bool hasM, float t) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 src0 = vec2(asp * (0.07 + 0.86 * fi / 5.0), 0.035);
    float th0 = atan(asp * 0.5 - src0.x, 0.75) + 0.60 * sin(t * 0.42 + fi * 1.9) * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0);
    float th = th0;
    if (hasM) {
      float target = atan(pm.x - src0.x, max(pm.y - src0.y, 0.05));
      th = mix(th0, target + 0.07 * sin(t * 1.4 + fi * 2.0), 0.62);
    }
    vec2 v = p - src0;
    float dist = length(v);
    float ang = atan(v.x, v.y);
    float da = ang - th;
    float body = exp(-da * da / 0.0042);                 // soft cone
    float core = exp(-da * da / 0.00016);                // bright core line
    float along = (0.35 + 0.65 * smoothstep(0.0, 0.30, dist)) * exp(-dist * 0.55);
    float vis = step(0.0, v.y);
    acc += is_beamCol(i) * (body * 0.50 + core * 0.35) * along * vis;
  }
  return acc;
}

// 4-point sparkle, 5-point star, heart
float is_heart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(is_d2(p - vec2(0.25, 0.75))) - 0.35355339;
  return sqrt(min(is_d2(p - vec2(0.0, 1.0)), is_d2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}
float is_star5(vec2 p, float r, float rf) {
  vec2 k1 = vec2(0.809016994375, -0.587785252292);
  vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

// one layer of floating sparkles; returns colour in rgb and alpha in a
vec4 is_sparkles(vec2 p, float cs, float seed, float t, float up, float presence) {
  float cid = floor(p.x / cs);
  float spd = (0.5 + is_hash(vec2(cid, seed + 9.0))) * up;
  vec2 q = vec2(p.x / cs, p.y / cs + t * spd);
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = is_hash(id + seed);
  vec4 o = vec4(0.0);
  if (h > presence) return o;
  float h2 = is_hash(id + seed + 7.3), h3 = is_hash(id + seed + 13.1), h4 = is_hash(id + seed + 21.7);
  vec2 jit = (vec2(h2, h3) - 0.5) * 0.20;
  vec2 l = f - jit;
  l.x -= 0.06 * sin(t * (0.8 + h2) + h3 * 20.0);                       // gentle sway
  float rad = 0.16 + 0.12 * h4;
  float tw = 0.78 + 0.22 * sin(t * (2.0 + 2.5 * h3) + h2 * 30.0);   // twinkle
  rad *= tw;
  vec3 c = is_pastel(h4);
  float kind = h2 * 0.6 + h3 * 0.4;
  float a;
  vec2 u = l / rad;
  if (kind < 0.36) {
    // 4-point sparkle
    float s = pow(abs(u.x), 0.55) + pow(abs(u.y), 0.55);
    a = smoothstep(1.0, 0.80, s) + 0.35 * exp(-dot(u, u) * 4.0);
    c = mix(c, vec3(1.0), 0.5);
  } else if (kind < 0.64) {
    float d = is_star5(vec2(u.x, -u.y) * 0.95, 0.85, 0.5) - 0.02;
    a = smoothstep(0.03, -0.03, d);
    c = mix(c, vec3(1.0, 0.97, 0.80), 0.35);
  } else {
    float d = is_heart(vec2(u.x, -u.y) * 0.95 + vec2(0.0, 0.5)) ;
    a = smoothstep(0.03, -0.03, d - 0.0);
    c = mix(c, vec3(1.0, 0.62, 0.78), 0.5);
  }
  a = max(a, 0.22 * exp(-dot(u, u) * 1.3));
  o = vec4(c, clamp(a, 0.0, 1.0) * 0.92);
  return o;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 pm = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  vec3 col;
  float cxs = p.x - asp * 0.5;
  if (uv.y < IS_HZ) {
    // ---- backdrop: indigo to magenta glow, a soft bloom at the middle, round bokeh
    float g = smoothstep(0.0, IS_HZ, uv.y);
    col = mix(vec3(0.10, 0.07, 0.36), vec3(0.52, 0.22, 0.70), pow(g, 1.3));
    col = mix(col, vec3(0.98, 0.52, 0.86), pow(g, 4.0) * 0.55);
    float bl = exp(-(cxs * cxs) / 0.35 - (uv.y - 0.52) * (uv.y - 0.52) / 0.06);
    col += vec3(0.30, 0.62, 0.80) * bl * 0.30;
    // soft vertical LED columns
    float led = 0.5 + 0.5 * sin(p.x * 70.0);
    col *= 0.94 + 0.08 * led * smoothstep(0.1, 0.5, uv.y);
    // bokeh discs
    for (int k = 0; k < 2; k++) {
      float cs = k == 0 ? 0.22 : 0.13;
      vec2 q = p / cs + vec2(0.0, 0.0);
      vec2 id = floor(q);
      float h = is_hash(id + float(k) * 31.0);
      if (h > 0.45) {
        vec2 c0 = vec2(0.5) + (vec2(is_hash(id + 3.1), is_hash(id + 5.7)) - 0.5) * 0.3;
        float r = 0.18 + 0.12 * is_hash(id + 9.3);
        float d = length(fract(q) - c0) / r;
        float tw = 0.65 + 0.35 * sin(t * (0.7 + h * 1.5) + h * 40.0);
        float disc = smoothstep(1.0, 0.85, d) * (0.45 + 0.55 * smoothstep(0.55, 1.0, d)) * tw;
        col += is_pastel(is_hash(id + 1.3)) * disc * 0.16 * smoothstep(0.0, 0.2, uv.y);
      }
    }
    // the LED strip along the back edge of the stage
    float strip = exp(-pow((uv.y - IS_HZ + 0.004) / 0.006, 2.0));
    col += mix(vec3(1.0, 0.55, 0.85), vec3(0.45, 0.95, 1.0), 0.5 + 0.5 * sin(p.x * 3.0 + t * 0.6)) * strip * 0.9;
  } else {
    // ---- glowing tiled floor, in perspective
    float dy = uv.y - IS_HZ + 0.002;
    float wx = cxs / dy * 0.16;
    float wz = 0.16 / dy;
    vec2 gq = vec2(wx, wz) * 3.2;
    vec2 gf = abs(fract(gq) - 0.5);
    float line = smoothstep(0.50, 0.465, max(gf.x, gf.y));
    float edgeL = 1.0 - line;                                   // 1 on the grid lines
    float par = mod(floor(gq.x) + floor(gq.y), 2.0);
    vec3 tileA = vec3(0.30, 0.13, 0.50);
    vec3 tileB = vec3(0.16, 0.20, 0.55);
    col = mix(tileA, tileB, par);
    float fade = smoothstep(0.0, 0.10, dy);
    // glow lines pink and cyan, travelling pulse
    float pulse = 0.5 + 0.5 * sin(wz * 2.0 - t * 1.2 + wx * 0.8);
    vec3 lineC = mix(vec3(1.0, 0.55, 0.88), vec3(0.45, 0.95, 1.0), par);
    col += lineC * edgeL * (0.30 + 0.30 * pulse) * fade;
    col += mix(vec3(0.7, 0.3, 0.8), vec3(0.3, 0.7, 0.9), par) * 0.12 * line * (0.5 + 0.5 * pulse);
    // ripple rings spreading over the floor from the stage centre
    vec2 rc = vec2(0.0, 0.62);
    float rr = length(vec2(wx - rc.x, wz - rc.y));
    for (int k = 0; k < 2; k++) {
      float age = fract(t * 0.16 + float(k) * 0.5);
      float R = age * 0.95;
      float ring = exp(-pow((rr - R) / 0.045, 2.0)) * (1.0 - age) * (1.0 - age);
      vec3 rc2 = k == 0 ? vec3(1.0, 0.78, 0.94) : vec3(0.72, 0.98, 1.0);
      col += rc2 * ring * 0.75 * fade;
      col += lineC * edgeL * ring * 0.9 * fade;
    }
    // everything fades into the glow of the stage edge
    col = mix(vec3(0.85, 0.50, 0.85), col, fade * 0.85 + 0.15);
    // pools of light where the beams touch the floor, and a glossy reflection of them
    float refl = 0.0;
    float mirrorY = 2.0 * IS_YF - uv.y;
    vec3 rb = is_beams(vec2(p.x, mirrorY), asp, pm, hasM, t);
    col += rb * 0.55 * smoothstep(IS_YF - 0.03, IS_YF + 0.03, uv.y) * (0.55 + 0.45 * line);
  }

  // beams in the air, above the floor plane
  if (uv.y < IS_YF) {
    vec3 b = is_beams(p, asp, pm, hasM, t);
    // screen blend keeps them from burning out
    col = 1.0 - (1.0 - col) * (1.0 - clamp(b * 0.85, 0.0, 0.92));
  }

  // truss with lamp heads at the top
  {
    float bar = step(abs(uv.y - 0.022), 0.0055);
    col = mix(col, vec3(0.06, 0.04, 0.14), bar * 0.92);
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      vec2 lp = vec2(asp * (0.07 + 0.86 * fi / 5.0), 0.035);
      float d = length(p - lp);
      col += is_beamCol(i) * exp(-d * d / 0.0006) * 0.9;
      col = mix(col, vec3(1.0, 0.96, 0.98), smoothstep(0.0075, 0.0055, d));
    }
  }

  // ---- floating star and heart sparkles, two sizes
  {
    vec4 s1 = is_sparkles(p, 0.24, 1.0, t, 0.040, 0.30);
    col = mix(col, s1.rgb, s1.a);
    vec4 s2 = is_sparkles(p + vec2(0.11, 0.0), 0.15, 5.0, t, 0.030, 0.26);
    col = mix(col, s2.rgb, s2.a * 0.9);
  }
  // ---- confetti dots drifting down
  {
    float cs = 0.065;
    float cid = floor(p.x / cs);
    float spd = 0.045 + 0.06 * is_hash(vec2(cid, 2.0));
    vec2 q = vec2(p.x / cs, p.y / cs - t * spd / cs * 0.5);
    vec2 id = floor(q);
    float h = is_hash(id + 40.0);
    if (h > 0.80) {
      vec2 f = fract(q) - 0.5;
      float hh = is_hash(id + 41.0), hg = is_hash(id + 43.0);
      f.x -= 0.10 * sin(t * (1.0 + hh) + hg * 30.0);
      f.x *= 1.0 / (0.35 + 0.65 * abs(cos(t * (1.5 + hh) + hg * 20.0)));   // flutter
      float rad = 0.10 + 0.10 * hg;
      float d = length(f - (vec2(hh, hg) - 0.5) * 0.3) / rad;
      float a = smoothstep(1.0, 0.8, d);
      col = mix(col, is_pastel(is_hash(id + 47.0)), a * 0.85);
    }
  }

  // let the user's own wallpaper show faintly through the scene
  col *= 0.97 + 0.06 * is_luma(w);
  col *= 1.0 - 0.22 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
