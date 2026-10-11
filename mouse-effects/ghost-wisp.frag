#version 440
// category: Trail
// desc: Ghost wisp: a pale will-o'-the-wisp at the pointer with a thin, drifting ghostly tail that curls and fades behind it, and a couple of cold motes that orbit the flame
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
};

float gw_hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 gw_P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  return h3.zw;
}
// the tail point k: the pointer's own path plus a lazy curling drift that grows with age, so it floats even when the pointer rests
vec2 gw_T(int k, float ph) {
  float a = float(k);
  vec2 d = vec2(sin(time * 1.3 + a * 0.75 + ph) * (1.0 + a * 2.6) - a * 0.6, -a * 2.6 + cos(time * 0.9 + a * 0.6 + ph) * a * 0.8);
  return gw_P(k) + d;
}
float gw_seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
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
  for (int s = 0; s < 2; s++) {
    float ph = float(s) * 2.3;
    float wmul = s == 0 ? 1.0 : 0.65;
    for (int k = 0; k < 8; k++) {
      float age = float(k) / 8.0;
      vec2 a = gw_T(k, ph), b = gw_T(k + 1, ph);
      float d = gw_seg(p, a, b);
      float w = mix(2.6, 0.5, age) * wmul;
      float core = exp(-pow(d / w, 2.0));
      float haze = exp(-d / (w * 5.0)) * 0.22;
      float flick = 0.75 + 0.25 * sin(time * 2.2 + float(k) * 1.1 + ph * 3.0);
      float f = pow(1.0 - age, 1.5) * flick * (s == 0 ? 0.55 : 0.34);
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
