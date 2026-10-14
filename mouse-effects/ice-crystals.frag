#version 440
// category: Trail
// desc: Ice crystals: the pointer leaves six-armed snowflake crystals along its path that glitter, slowly turn and melt away behind it over about a second, with a trail of fine ice dust
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
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// six-armed snowflake in pixel units: returns x = line distance (px), y = hexagon-core distance (0 inside)
vec2 flake(vec2 d, float R, float rot) {
  const float SEC = 1.0471976;
  float r = length(d);
  float a = atan(d.y, d.x) - rot;
  a = mod(a + SEC * 0.5, SEC) - SEC * 0.5;                  // fold into one 60 degree sector, arm on the axis
  vec2 q = r * vec2(cos(a), abs(sin(a)));
  float dist = seg(q, vec2(0.0), vec2(R, 0.0));            // the arm
  vec2 dir = vec2(0.5, 0.866);
  dist = min(dist, seg(q, vec2(0.46 * R, 0.0), vec2(0.46 * R, 0.0) + dir * 0.34 * R));   // two pairs of side branches
  dist = min(dist, seg(q, vec2(0.74 * R, 0.0), vec2(0.74 * R, 0.0) + dir * 0.20 * R));
  float hex = r * cos(abs(a) - SEC * 0.5) ;                // hexagon core (edge distance along the folded normal)
  return vec2(dist, max(hex - 0.20 * R, 0.0));
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 ice = vec3(0.80, 0.95, 1.00);
  vec3 teal = vec3(0.20, 0.85, 0.85);
  vec3 violet = vec3(0.58, 0.40, 1.00);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int i = 1; i <= 16; i++) {
    float moved = smoothstep(1.5, 9.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float sid = SID(i);
    float hs = hash(sid * 1.37 + 0.5);
    vec2 c = P(i) + vec2(hash(sid + 7.0) - 0.5, hash(sid + 9.0) - 0.5) * 8.0;
    float fade = pow(1.0 - age, 1.4) * moved;
    // a crystal on about every second sample, the rest only shed dust
    float hasFlake = smoothstep(0.42, 0.50, hs);
    float R = (9.0 + 10.0 * hash(sid * 2.9 + 1.0)) * (0.75 + 0.45 * age);       // crystals grow a little as they fade
    vec2 d = p - c;
    if (hasFlake > 0.0 && dot(d, d) < (R * 1.1 + 6.0) * (R * 1.1 + 6.0)) {
      float rot = hs * 6.2832 + age * 0.9 + time * 0.25 * (hs - 0.5);
      vec2 f = flake(d, R, rot);
      float line = smoothstep(1.25, 0.0, f.x);
      float core = smoothstep(1.0, 0.0, f.y) * 0.45;
      float halo = exp(-f.x / 3.5) * 0.22;
      float glint = 0.75 + 0.25 * sin(time * 5.0 + hs * 40.0);               // slow glitter
      float fl = fade * hasFlake;
      float a = (line * glint + core + halo) * fl;
      float under = smoothstep(2.8, 0.6, f.x) * 0.38 * fl;             // faint navy under-stroke keeps the ice visible on light windows
      col += vec3(0.03, 0.10, 0.28) * under;
      alpha += under;
      vec3 tint = mix(mix(ice, teal, age * 0.9), violet, halo * 0.9);
      col += mix(tint, vec3(1.0), line * 0.45) * a;
      alpha += a;
    }
    // ice dust drifting off the sample
    for (int k = 0; k < 2; k++) {
      float hd = hash(sid * 3.1 + float(k) * 11.0 + 3.0);
      float ang = hd * 6.2832;
      vec2 dp = c + vec2(cos(ang), sin(ang)) * (6.0 + age * 30.0 * (0.6 + hash(sid + float(k) * 5.0))) + vec2(0.0, age * 10.0);
      vec2 dv = p - dp;
      if (dot(dv, dv) > 12.0) continue;
      float tw = 0.7 + 0.3 * sin(time * 4.0 + hd * 40.0);
      float dust = smoothstep(2.2, 0.0, length(dv)) * fade * tw * 1.0;
      col += mix(ice, teal, 0.3) * dust;
      alpha += dust;
    }
  }
  // the pointer itself: a small frozen star and a cold glow
  vec2 dm = p - mouse;
  float dl = length(dm);
  if (dl < 40.0) {
    vec2 f = flake(dm, 8.0, time * 0.4);
    float star = smoothstep(1.2, 0.0, f.x) * 0.9 + smoothstep(1.0, 0.0, f.y) * 0.5;
    float glow = exp(-dl / 9.0) * 0.30;
    float under = smoothstep(2.8, 0.6, f.x) * 0.38;
    col += mix(ice, vec3(1.0), 0.4) * star + teal * glow + vec3(0.03, 0.10, 0.28) * under;
    alpha += star + glow + under;
  }
  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * (a / max(alpha, 1e-4)), a) * qt_Opacity;
}
