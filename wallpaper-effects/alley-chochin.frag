// label: Izakaya alley
// hint: paper lanterns sway over a wet night alley under a pink neon sign, the pointer is a warm draught
// category: Places and eras
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
float ac_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float ac_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ac_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ac_h2(i), ac_h2(i + vec2(1, 0)), f.x), mix(ac_h2(i + vec2(0, 1)), ac_h2(i + vec2(1, 1)), f.x), f.y);
}
float ac_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * ac_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ac_wire(float x, float r) { return 0.0 + 0.014 * sin(x * 2.6 + r * 2.0) + 0.006 * sin(x * 7.0 + r); }

// one paper lantern: returns rgb in .rgb and coverage in .a. c = centre of the body, s = size, ang = swing, hot = brightness boost
vec4 ac_lantern(vec2 p, vec2 c, float s, float ang, float hot, float id) {
  vec2 att = c + vec2(0.0, -s * 1.55);                         // where the cord is tied to the wire
  vec2 q = p - att;
  float ca = cos(ang), sa = sin(ang);
  q = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y);          // un-rotate the pixel about the knot
  vec2 l = (q - vec2(0.0, s * 1.55)) / s;                       // lantern-local coordinates, body centred on 0
  float body = length(l / vec2(0.82, 1.12));
  float cov = smoothstep(1.0, 0.93, body);
  float rib = 0.5 + 0.5 * cos(l.y * 20.0);
  float edge = smoothstep(0.35, 1.0, body);
  vec3 inner = mix(vec3(1.0, 0.82, 0.38), vec3(1.0, 0.50, 0.14), smoothstep(0.0, 0.8, body));
  vec3 outer = vec3(0.62, 0.05, 0.03);
  vec3 col = mix(inner, outer, edge * (0.65 + 0.35 * rib));
  col *= 0.78 + 0.32 * rib * (1.0 - edge) + 0.5 * hot;
  col = mix(col, vec3(0.08, 0.02, 0.02), 0.5 * smoothstep(0.88, 1.0, body));   // dark rim
  // black caps top and bottom
  float capT = smoothstep(0.02, 0.0, max(abs(l.x) - 0.42, abs(l.y + 1.13) - 0.1));
  float capB = smoothstep(0.02, 0.0, max(abs(l.x) - 0.36, abs(l.y - 1.13) - 0.08));
  float cord = smoothstep(0.03, 0.0, max(abs(l.x) - 0.03, abs(l.y + 1.6) - 0.5));
  col = mix(col, vec3(0.04, 0.03, 0.03), max(capT, capB));
  float a = max(max(cov, capT), max(capB, cord * 0.9));
  col = mix(col, vec3(0.05, 0.04, 0.04), cord * (1.0 - cov));
  return vec4(col, a);
}

// rounded-box distance
float ac_box(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  float t = time;

  // ---- the night alley: the picture pushed into a deep indigo with a little warmth
  vec3 pic = wall(uv);
  float lum = dot(pic, vec3(0.299, 0.587, 0.114));
  vec3 col = mix(pic, vec3(lum), 0.45) * vec3(0.52, 0.46, 0.66) + vec3(0.016, 0.008, 0.030);
  col *= 1.0 - 0.28 * smoothstep(0.25, 1.0, uv.y);              // the street is darker than the sky

  vec3 glow = vec3(0.0);                                        // light thrown on the scene
  float refl = 0.0;                                             // column glow for the wet street
  vec4 over = vec4(0.0);                                        // opaque things (lanterns, sign) drawn last

  for (int r = 0; r < 2; r++) {
    float fr = float(r);
    float S = r == 0 ? 0.34 : 0.215;
    float sz = r == 0 ? 0.046 : 0.027;
    float y0 = r == 0 ? 0.075 : 0.215;
    float shade = r == 0 ? 1.0 : 0.62;
    float cell = floor(p.x / S);
    for (int k = -1; k <= 1; k++) {
      float id = cell + float(k) + fr * 40.0;
      float cx = (cell + float(k) + 0.5) * S + (ac_hash(id) - 0.5) * 0.35 * S;
      float wy = y0 + ac_wire(cx, fr);
      vec2 c = vec2(cx, wy + sz * 1.9);
      float prox = exp(-dot(vec2(cx, c.y) - mp, vec2(cx, c.y) - mp) / (2.0 * 0.20 * 0.20));
      float side = clamp((cx - mp.x) * 4.0, -1.0, 1.0);
      float ang = 0.07 * sin(t * 0.8 + id * 3.1) + 0.04 * sin(t * 1.9 + id * 1.7)
                + prox * (0.22 * side + 0.10 * sin(t * 2.6 + id));
      float flick = 0.94 + 0.06 * sin(t * (2.0 + ac_hash(id + 2.0) * 3.0) + id * 9.0);
      float hot = prox * 0.5;
      vec4 L = ac_lantern(p, c, sz, ang, hot, id);
      // halo of warm light around the lantern (a little to the sides, more downward)
      vec2 dl = (p - (c + vec2(sin(ang) * sz * 1.5, 0.0))) * vec2(1.0, 1.05);
      float d2 = dot(dl, dl);
      float halo = (exp(-d2 / (2.0 * sz * sz * 4.0)) * 0.55 + exp(-d2 / (2.0 * sz * sz * 22.0)) * 0.30) * flick * (1.0 + 0.7 * prox) * shade;
      glow += vec3(1.0, 0.38, 0.10) * halo * 0.75;
      if (r == 0) {
        float dx = p.x - c.x;
        refl += exp(-dx * dx / (2.0 * 0.03 * 0.03)) * (1.0 + 0.8 * prox) * flick;
      }
      vec3 lc = L.rgb * flick * shade;
      over.rgb = mix(over.rgb, lc, L.a);
      over.a = max(over.a, L.a);
    }
    // the wire itself
    float w = smoothstep(0.0022, 0.0006, abs(p.y - (y0 + ac_wire(p.x, fr))));
    over.rgb = mix(over.rgb, vec3(0.03, 0.025, 0.03), w * (1.0 - over.a * 0.0));
    over.a = max(over.a, w * 0.85);
  }

  // ---- a vertical neon sign at the right: pink tube frame, glowing glyph bars, a slow flicker
  {
    vec2 sc = vec2(asp * 0.885, 0.46);
    vec2 sp = p - sc;
    float d = ac_box(sp, vec2(0.034, 0.145), 0.012);
    float tube = smoothstep(0.0045, 0.0008, abs(d));
    float fl = 0.88 + 0.12 * sin(t * 1.3) * sin(t * 0.37);
    float dip = step(0.992, sin(t * 0.7 + 1.0) * 0.5 + 0.5);                    // rare brief stutter
    fl *= 1.0 - 0.55 * dip;
    float bars = 0.0;
    for (int i = 0; i < 4; i++) {
      float yy = -0.098 + float(i) * 0.065;
      float wdt = 0.015 + 0.007 * ac_hash(float(i) + 4.0);
      float bd = ac_box(sp - vec2(0.0, yy), vec2(wdt, 0.011), 0.005);
      float bl = i == 2 ? fl * (0.7 + 0.3 * sin(t * 4.1)) : fl;
      bars += smoothstep(0.003, 0.0, bd) * bl;
    }
    float aura = exp(-max(d, 0.0) * 22.0) * 0.55 * fl;
    float inside = smoothstep(0.0, -0.01, d);
    col = mix(col, col * 0.55, inside * 0.7);
    glow += vec3(1.0, 0.18, 0.46) * aura * 0.38;
    col += vec3(1.0, 0.30, 0.55) * tube * 0.95 * fl + vec3(1.0, 0.80, 0.88) * bars * 0.85;
    refl += exp(-pow((p.x - sc.x) / 0.04, 2.0)) * 0.7 * fl * 0.0;
  }

  col += glow;

  // ---- wet street: the lanterns smear down the wet stones
  float gy = smoothstep(0.80, 0.84, uv.y);
  float depth = max(uv.y - 0.80, 0.0) / 0.20;
  float ripple = ac_noise(vec2(p.x * 36.0, uv.y * 14.0 - t * 0.35 + mpx.x * 0.0)) - 0.5;
  float streak = ac_noise(vec2(p.x * 160.0 + ripple * 6.0, uv.y * 3.0 + ripple));
  float rr = refl * (0.35 + 0.65 * streak) * exp(-depth * 2.6);
  col = mix(col, col * 0.62, gy * 0.8);
  col += vec3(1.0, 0.34, 0.10) * rr * 0.50 * gy;
  col += vec3(0.20, 0.06, 0.10) * gy * (0.2 + 0.4 * exp(-depth * 3.0)) * (0.5 + ripple);

  // objects on top
  col = mix(col, over.rgb, over.a);

  // faint hazy smoke drifting through the glow
  float sm = ac_fbm(vec2(p.x * 2.4 + t * 0.03, p.y * 3.0 - t * 0.02));
  col += vec3(0.30, 0.12, 0.08) * smoothstep(0.45, 0.8, sm) * 0.10 * smoothstep(0.0, 0.5, uv.y) * (1.0 - gy);

  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
