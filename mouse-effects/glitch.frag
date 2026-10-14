#version 440
// category: Trail
// desc: Digital glitches stay behind in the mouse trail and fade out: torn colour bars and blocks
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

// Pointer history: P(0) is the pointer, P(1) the newest sample, P(16) the oldest (about one second back).
// SID(i): stable id of the sample in slot i (it keeps its id as it moves to the next slot), use it to seed hashes.
// AGE(i): 0 at the pointer, 1 when the sample is dropped; it grows continuously, so fade to 0 as AGE -> 1.
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
float SID(int i) { return mod(hs.x - float(i) + 1.0, 4096.0); }
float AGE(int i) { return i == 0 ? 0.0 : (float(i) - 1.0 + hs.y) / 16.0; }

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float box(vec2 p, vec2 c, vec2 half_) {
  vec2 d = abs(p - c) - half_;
  return step(max(d.x, d.y), 0.0);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    vec2 c = P(i);
    if (abs(p.x - c.x) > 130.0 || abs(p.y - c.y) > 60.0) continue;
    float moved = smoothstep(1.5, 9.0, distance(c, P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float fade = (1.0 - age) * moved;
    float sid = SID(i);
    for (int k = 0; k < 2; k++) {
      float seed = sid * 13.7 + float(k) * 5.3;
      if (hash(seed + 9.1) < 0.45) continue;
      float w = 8.0 + hash(seed) * 50.0 * (1.0 - 0.5 * age);
      float h = 1.5 + hash(seed + 1.3) * 5.0;
      float slide = (hash(seed + 7.7) - 0.5) * 50.0 * age;   // bars slowly slip sideways as they age
      vec2 bc = c + vec2((hash(seed + 2.1) - 0.5) * 70.0 + slide, (hash(seed + 3.7) - 0.5) * 50.0);
      float shift = (3.0 + hash(seed + 4.9) * 7.0) * (0.5 + age);   // the colour split opens up with age
      float pick = hash(seed + 6.2);
      vec3 main_ = pick < 0.4 ? vec3(0.0, 1.0, 0.9) : (pick < 0.75 ? vec3(1.0, 0.1, 0.6) : vec3(0.9, 1.0, 0.9));
      float m = box(p, bc, vec2(w, h));
      float r = box(p, bc + vec2(shift, 0.0), vec2(w, h)) * (1.0 - m);
      float b = box(p, bc - vec2(shift, 0.0), vec2(w, h)) * (1.0 - m);
      col = max(col, (main_ * m + vec3(1.0, 0.0, 0.1) * r + vec3(0.1, 0.2, 1.0) * b) * fade);
      alpha = max(alpha, max(m, max(r, b)) * fade);
    }
    // small square pixel blocks
    for (int k = 0; k < 2; k++) {
      float seed = sid * 3.9 + float(k) * 8.1;
      if (hash(seed + 0.5) < 0.5) continue;
      float s = 3.0 + floor(hash(seed) * 4.0) * 3.0;
      vec2 q = c + (vec2(hash(seed + 1.1), hash(seed + 2.2)) - 0.5) * 80.0;
      q = floor(q / s) * s;
      float bl = box(p, q, vec2(s * 0.5));
      float pick = hash(seed + 3.3);
      vec3 bc3 = pick < 0.33 ? vec3(0.0, 1.0, 0.9) : (pick < 0.66 ? vec3(1.0, 0.1, 0.6) : vec3(1.0));
      col = max(col, bc3 * bl * fade);
      alpha = max(alpha, bl * fade);
    }
    // thin torn line running out of some of the samples
    if (hash(sid * 5.3 + 1.0) > 0.7) {
      float len = 30.0 + 90.0 * hash(sid * 5.3 + 2.0);
      float ln = box(p, c + vec2(len * 0.5, (hash(sid * 5.3 + 3.0) - 0.5) * 30.0), vec2(len * 0.5, 0.75));
      col = max(col, vec3(0.0, 1.0, 0.9) * ln * fade * 0.6);
      alpha = max(alpha, ln * fade * 0.6);
    }
  }
  // faint scanlines inside the glitch
  alpha *= 0.75 + 0.25 * step(0.5, fract(p.y / 3.0));
  col = clamp(col, 0.0, 1.0);
  fragColor = vec4(col * alpha, alpha) * qt_Opacity;
}
