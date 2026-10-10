#version 440
// category: Glow
// desc: Pulse halo (reacts to sound): a neon magenta and cyan ring around the pointer that swells and sends out shock rings on the bass, a thin inner ring on the mids and flying flecks on the treble; a calm idle pulse in silence
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
  float audio;
  float bass;
  float mid;
  float treble;
};

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 P(int i) {
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

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 pink = vec3(1.0, 0.18, 0.62);
  vec3 cyan = vec3(0.16, 0.88, 1.0);

  // calm idle pulse (a slow swell and a faint heartbeat) that the real levels replace when sound plays
  float breath = 0.5 + 0.5 * sin(time * 1.1);
  float beat = pow(0.5 + 0.5 * sin(time * 2.4), 8.0);
  float idle = (0.12 * breath + 0.18 * beat) * (1.0 - audio);
  float b = clamp(max(bass, idle), 0.0, 1.0);
  float m = clamp(max(mid, 0.25 * breath * (1.0 - audio)), 0.0, 1.0);
  float tr = clamp(treble, 0.0, 1.0);

  vec2 dv = p - mouse;
  float d = length(dv);
  float ang = atan(dv.y, dv.x);
  float R = 30.0 + 20.0 * b + 3.0 * breath;
  vec3 col = vec3(0.0);

  // the halo: inner glow, bright ring, wide soft ring; the colour runs magenta to cyan around it and slowly turns
  float grad = 0.5 + 0.5 * sin(ang + time * 0.6);
  vec3 tint = mix(pink, cyan, grad);
  float dr = abs(d - R);
  float w = 1.5 + 2.0 * b;
  col += tint * smoothstep(w, 0.0, dr) * (0.55 + 0.55 * b);
  col += tint * exp(-dr * dr / (2.0 * (6.0 + 9.0 * b) * (6.0 + 9.0 * b))) * (0.16 + 0.34 * b);
  col += mix(pink, vec3(0.30, 0.10, 0.80), 0.5) * exp(-d * d / (2.0 * R * R * 0.45)) * (0.10 + 0.20 * b);

  // mids: a thin cyan ring inside the halo
  col += cyan * smoothstep(1.3, 0.0, abs(d - R * 0.58)) * (0.12 + 0.55 * m);

  // bass: shock rings leaving the halo
  for (int k = 0; k < 2; k++) {
    float ph = fract(time * 0.9 + float(k) * 0.5);
    float rr = R + ph * (34.0 + 50.0 * b);
    col += mix(cyan, pink, float(k)) * smoothstep(2.4, 0.0, abs(d - rr)) * (1.0 - ph) * (1.0 - ph) * (0.10 + 0.85 * b);
  }

  // core dot
  col += mix(pink, vec3(1.0), 0.6) * smoothstep(3.0 + 3.0 * b, 0.0, d) * (0.5 + 0.4 * b);

  // treble flecks: one per sector, flying outward; more of them light up the louder the treble
  const float N = 18.0;
  float sec = floor((ang + 3.14159265) / 6.2831853 * N);
  for (int o = -1; o <= 1; o++) {
    float s = mod(sec + float(o), N);
    float h = hash(s + 1.0);
    float ph = fract(time * (0.45 + 0.7 * h) + h * 9.0);
    float live = smoothstep(0.10 + 0.85 * tr, 0.04 + 0.85 * tr, hash(s + 40.0) * 0.9);
    float fa = (s + 0.2 + 0.6 * hash(s + 7.0)) / N * 6.2831853 - 3.14159265;
    float fr = R * 1.08 + ph * (22.0 + 45.0 * (0.4 + tr));
    vec2 fp = mouse + vec2(cos(fa), sin(fa)) * fr;
    float fl = smoothstep(1.9 + 1.2 * tr, 0.0, length(p - fp)) * (1.0 - ph) * live;
    col += mix(mix(pink, cyan, hash(s + 3.0)), vec3(1.0), 0.55) * fl * (0.7 + 0.5 * tr);
  }

  // short beat trail: smaller, fading copies of the ring where the pointer has been
  for (int i = 1; i < 9; i++) {
    float behind = smoothstep(4.0, 40.0, distance(P(i), mouse));
    if (behind <= 0.0) continue;
    float age = float(i) / 8.0;
    float di = length(p - P(i));
    float rt = R * (1.0 - 0.5 * age);
    col += mix(pink, cyan, age) * smoothstep(1.6, 0.0, abs(di - rt)) * (1.0 - age) * (1.0 - age) * behind * (0.30 + 0.4 * b);
  }

  col = clamp(col, 0.0, 1.0);
  float a = max(col.r, max(col.g, col.b));
  fragColor = vec4(col, a) * qt_Opacity;
}
