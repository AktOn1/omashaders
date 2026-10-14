// label: Light streaks
// hint: a few long soft glowing light trails glide across, tinted from the picture
// category: Speed and motion
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}


// one long glowing trail: a thin bright core with a soft halo, a head that glides along and a tail that fades behind it
float ls_trail(vec2 uv, float asp, vec2 m, float i, out float along) {
  float h0 = hash(vec2(i, 3.1));
  float h1 = hash(vec2(i, 7.7));
  float h2 = hash(vec2(i, 13.3));
  float h3 = hash(vec2(i, 19.9));
  float dir = (h3 < 0.62) ? 1.0 : -1.0;                        // most glide left, the odd one opposite
  float spd = 0.035 + 0.075 * h1;                              // screen widths per second, each trail its own pace
  float period = 1.55 + 0.7 * h2;                               // the head wraps round off-screen so trails come and go
  float head = fract(time * spd * 0.8 + h0 * 7.0);             // 0..1 round trip
  float hx = (dir > 0.0 ? 1.0 - head : head) * period - (period - 1.0) * 0.5;
  float L = 0.65 + 0.5 * h2;                                  // trail length in screen widths
  float s = (uv.x - hx) * -dir;                                // distance behind the head, positive in the tail
  float x = uv.x;
  // its path: a gentle slant and a slow wave
  float y0 = 0.18 + 0.64 * hash(vec2(i, 29.0));
  float yc = y0 + (h2 - 0.5) * 0.10 * (x - 0.5) * 2.0 + 0.012 * sin(x * 5.0 + time * 0.07 + h0 * 20.0);
  // the pointer nudges trails aside
  vec2 dm = (vec2(x, yc) - m) * vec2(asp, 1.0);
  float near = exp(-dot(dm, dm) / (2.0 * 0.15 * 0.15));
  yc += 0.05 * near * sign(yc - m.y + 0.0001);
  float d = (uv.y - yc);
  float width = 0.0045 + 0.0055 * h0;
  float core = exp(-d * d / (2.0 * width * width));
  float halo = exp(-d * d / (2.0 * width * width * 30.0)) * 0.34;
  float tail = smoothstep(-0.015, 0.06, s) * pow(max(1.0 - max(s, 0.0) / L, 0.0), 1.7);
  float headGlow = exp(-(s - 0.01) * (s - 0.01) / 0.0016) * 0.8;                // bright bead where the trail is leading
  float env = tail + headGlow;
  float shimmer = 0.85 + 0.15 * sin(s * 22.0 + time * 0.9 + h0 * 30.0);
  along = tail;
  return (core + halo) * env * shimmer * (1.0 + 0.9 * near);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);

  // tints from the picture's own brightest colours: scan a few spots, favour bright and saturated ones
  vec3 best = vec3(1.0, 0.86, 0.62);
  vec3 second = vec3(1.0, 0.90, 0.78);
  float bs = 0.0, bs2 = 0.0;
  for (int k = 0; k < 8; k++) {
    float fk = float(k);
    vec2 p = vec2(0.10 + 0.80 * fract(fk * 0.618 + 0.11), 0.15 + 0.70 * fract(fk * 0.382 + 0.37));
    vec3 c = wall(p);
    float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
    float sc = mx + 0.9 * (mx - mn);
    if (sc > bs) { bs2 = bs; second = best; bs = sc; best = c; }
    else if (sc > bs2) { bs2 = sc; second = c; }
  }
  float bm = max(max(best.r, best.g), max(max(best.b, 0.2), 0.001));
  float sm = max(max(second.r, second.g), max(max(second.b, 0.2), 0.001));
  vec3 warm = vec3(1.0, 0.88, 0.68);
  vec3 tA = mix(warm, best / bm, 0.75);
  vec3 tB = mix(warm, second / sm, 0.60);
  tA = mix(vec3(dot(tA, vec3(0.333))), tA, 1.25);
  tA = clamp(tA * 1.05, 0.0, 1.0);

  vec3 add = vec3(0.0);
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float a;
    float v = ls_trail(uv, asp, m, fk, a);
    vec3 t = (mod(fk, 2.0) < 0.5) ? tA : tB;
    add += mix(t, vec3(1.0), 0.28 * clamp(v, 0.0, 1.0)) * v;
  }
  col = 1.0 - (1.0 - col) * (1.0 - clamp(add * 0.80, 0.0, 1.0));   // screen
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
