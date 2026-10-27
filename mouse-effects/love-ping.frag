#version 440
// category: Trail
// desc: Love ping: a small pixel heart at the pointer with a soft cyan ping ring now and then, followed by a trail of tiny pixel hearts and @ sparks that fade from hot pink through lavender to electric cyan and drift upward as they age. When the pointer rests they settle into a slow ring. Calm, small and low-contrast
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
float lp_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

const vec3 lp_pink = vec3(1.00, 0.34, 0.66);
const vec3 lp_lav  = vec3(0.74, 0.66, 1.00);
const vec3 lp_cyan = vec3(0.24, 0.94, 1.00);
const vec3 lp_plum = vec3(0.14, 0.04, 0.26);

// 7 x 6 bitmap heart (y 0 = top row)
float lp_heart(vec2 g) {
  if (g.x < 0.0 || g.x > 6.0 || g.y < 0.0 || g.y > 5.0) return 0.0;
  float ax = abs(g.x - 3.0);
  if (g.y < 0.5) return (ax > 0.5 && ax < 2.5) ? 1.0 : 0.0;
  if (g.y < 2.5) return 1.0;
  if (g.y < 3.5) return ax < 2.5 ? 1.0 : 0.0;
  if (g.y < 4.5) return ax < 1.5 ? 1.0 : 0.0;
  return ax < 0.5 ? 1.0 : 0.0;
}
// 7 x 7 bitmap "@" (g 0..6, y 0 = top row), one bit mask per row
float lp_at(vec2 g) {
  if (g.x < -0.5 || g.x > 6.5 || g.y < -0.5 || g.y > 6.5) return 0.0;
  int y = int(g.y + 0.5);
  int m = 62;
  if (y == 1) m = 65;
  else if (y == 2) m = 93;
  else if (y == 3) m = 85;
  else if (y == 4) m = 95;
  else if (y == 5) m = 64;
  int x = int(g.x + 0.5);
  return mod(floor(float(m) / exp2(float(6 - x)) + 0.01), 2.0);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 acc = vec3(0.0);
  float A = 0.0;

  // trail: oldest first so the newest sits on top; each item sits on an older pointer sample plus a small orbit
  for (int j = 0; j < 7; j++) {
    int k = 6 - j;
    float fk = float(k);
    int slot = 2 + k * 2;
    float age = (float(slot) - 1.0 + hs.y) / 16.0;
    vec2 q = P(slot);
    float ang = time * (0.8 + 0.25 * lp_hash(fk + 1.0)) + fk * 2.1;
    float rad = 6.0 + 4.0 * fk;
    q += vec2(cos(ang), sin(ang * 1.3)) * rad * (0.55 + 0.45 * sin(time * 0.6 + fk));
    q.y -= 10.0 * age;                                  // a slow float upward as they age
    q.x += 2.5 * sin(time * 2.0 + fk * 1.7) * age;
    float cs = 2.0;
    q = floor(q / cs + 0.5) * cs;
    vec2 d = p - q;
    if (abs(d.x) < cs * 5.0 && abs(d.y) < cs * 5.0) {
      float t01 = fk / 6.0;
      vec3 c = t01 < 0.5 ? mix(lp_pink, lp_lav, t01 * 2.0) : mix(lp_lav, lp_cyan, t01 * 2.0 - 1.0);
      float blink = step(0.22, lp_hash(floor(time * 2.2 + fk * 3.0) + fk * 11.0));
      float fade = (1.0 - 0.55 * age) * (0.62 + 0.38 * blink);
      float body, ring;
      if ((k - (k / 2) * 2) == 0) {
        vec2 g = floor(d / cs + vec2(3.5, 3.0));
        body = lp_heart(g);
        ring = max(max(lp_heart(g + vec2(1.0, 0.0)), lp_heart(g - vec2(1.0, 0.0))), max(lp_heart(g + vec2(0.0, 1.0)), lp_heart(g - vec2(0.0, 1.0)))) * (1.0 - body);
      } else {
        vec2 g = floor(d / cs + 3.5);
        body = lp_at(g);
        ring = max(max(lp_at(g + vec2(1.0, 0.0)), lp_at(g - vec2(1.0, 0.0))), max(lp_at(g + vec2(0.0, 1.0)), lp_at(g - vec2(0.0, 1.0)))) * (1.0 - body);
      }
      float ra = ring * 0.42 * fade;
      acc = acc * (1.0 - ra) + lp_plum * ra; A = A + ra * (1.0 - A);
      float ba = body * 0.92 * fade;
      acc = acc * (1.0 - ba) + c * ba; A = A + ba * (1.0 - A);
    }
  }

  // ping ring: a soft thin cyan ring that grows from the pointer every couple of seconds
  float pl = fract(time * 0.42);
  float pr = 7.0 + 30.0 * pl;
  float pa = exp(-pow((length(p - mouse) - pr) / 1.7, 2.0)) * (1.0 - pl) * (1.0 - pl) * 0.50;
  acc = acc * (1.0 - pa) + lp_cyan * pa; A = A + pa * (1.0 - A);

  // head: the biggest heart, a little off the tip so the arrow stays visible, with a white shine pixel
  {
    float cs = 3.0;
    vec2 q = mouse + vec2(10.0, 11.0);
    q = floor(q / cs + 0.5) * cs;
    vec2 g = floor((p - q) / cs + vec2(3.5, 3.0));
    float body = lp_heart(g);
    float ring = max(max(lp_heart(g + vec2(1.0, 0.0)), lp_heart(g - vec2(1.0, 0.0))), max(lp_heart(g + vec2(0.0, 1.0)), lp_heart(g - vec2(0.0, 1.0)))) * (1.0 - body);
    float beat = 0.88 + 0.12 * step(0.5, sin(time * 5.0) * sin(time * 1.6));
    float hi = step(abs(g.x - 1.0), 0.5) * step(abs(g.y - 1.0), 0.5);
    vec3 c = mix(lp_pink, vec3(1.0), hi * 0.85);
    c *= 1.0 - 0.16 * step(3.5, g.y);
    float ra = ring * 0.55;
    acc = acc * (1.0 - ra) + lp_plum * ra; A = A + ra * (1.0 - A);
    float ba = body * beat;
    acc = acc * (1.0 - ba) + c * ba; A = A + ba * (1.0 - A);
  }

  // a faint plum shade under the whole thing so it holds on bright pictures
  float sh = exp(-dot(p - mouse, p - mouse) / 520.0) * 0.16;
  acc = acc + lp_plum * sh * (1.0 - A);
  A = A + sh * (1.0 - A);

  fragColor = vec4(acc, A) * qt_Opacity;
}
