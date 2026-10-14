#version 440
// category: Trail
// desc: Ghost wisp: a pale will-o'-the-wisp at the pointer with a thin, drifting ghostly tail that stays behind it, curls and fades over about a second, and a couple of cold motes that orbit the flame
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

// the tail point k: the pointer's own path plus a lazy curling drift that grows with age, so it floats even when the pointer rests
vec2 gw_T(int k, float ph) {
  float a = AGE(k) * 8.0;
  float s = SID(k);
  vec2 d = vec2(sin(time * 1.3 + s * 0.75 + ph) * (1.0 + a * 2.6) - a * 0.6, -a * 2.6 + cos(time * 0.9 + s * 0.6 + ph) * a * 0.8);
  return P(k) + d;
}
vec2 gw_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 pale = vec3(0.70, 0.93, 0.96);
  vec3 white = vec3(0.96, 1.0, 1.0);
  vec3 cold = vec3(0.42, 0.74, 0.88);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // the tail: two thin strands with different phases, tapering and fading with age
  for (int k = 0; k < 16; k++) {
    // cheap early-out: the strands stay within ~40 px of the path
    if (gw_seg(p, P(k), P(k + 1)).x > 40.0) continue;
    for (int s = 0; s < 2; s++) {
      float ph = float(s) * 2.3;
      float wmul = s == 0 ? 1.0 : 0.65;
      vec2 sg = gw_seg(p, gw_T(k, ph), gw_T(k + 1, ph));
      float age = mix(AGE(k), AGE(k + 1), sg.y);
      float d = sg.x;
      float w = mix(2.6, 0.5, age) * wmul;
      float core = exp(-pow(d / w, 2.0));
      float haze = exp(-d / (w * 5.0)) * 0.22;
      float flick = 0.75 + 0.25 * sin(time * 2.2 + (SID(k) - sg.y) * 1.1 + ph * 3.0);
      float f = pow(1.0 - age, 1.5) * flick * (s == 0 ? 0.65 : 0.4);
      float v = (core * 0.9 + haze) * f;
      col += mix(white, cold, age) * v;
      alpha += v;
    }
  }

  // the flame: a soft cold glow with a bright little heart, a faint flicker
  float fl = 0.90 + 0.10 * sin(time * 5.1) + 0.05 * sin(time * 8.3 + 1.0);
  float dm = length((p - mouse) / vec2(1.0, 1.15) + vec2(0.0, 1.0));
  float halo = exp(-dm / 17.0) * 0.30 * fl;
  float heart = smoothstep(4.6, 0.8, dm) * 0.85 * fl;
  col += pale * halo + white * heart;
  alpha += halo + heart;

  // two motes circling the flame
  for (int i = 0; i < 2; i++) {
    float sd = float(i) * 4.1;
    float an = time * (1.4 + 0.5 * float(i)) + sd;
    vec2 mp = mouse + vec2(cos(an), sin(an) * 0.7) * (13.0 + 4.0 * sin(time * 0.8 + sd));
    float m = exp(-pow(length(p - mp) / 1.4, 2.0)) * 0.8 + exp(-length(p - mp) / 4.0) * 0.12;
    col += pale * m;
    alpha += m;
  }

  float a = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(clamp(col / max(alpha, 1.0), 0.0, 1.0), a) * qt_Opacity;
}
