#version 440
// category: Trail
// desc: Mercury beads: little drops of liquid metal fall off the pointer, lag behind it, sag and merge into each other like quicksilver; each drop is shaded as a tiny chrome ball with a white glint and a cool blue rim
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
float mb_h(float s) { return fract(sin(s * 12.9898) * 43758.5453); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < -240.0 || mouse.y < -240.0 || mouse.x > res.x + 240.0 || mouse.y > res.y + 240.0) { fragColor = vec4(0.0); return; }

  // metaball field over the trail samples: close drops flow into one body, the way quicksilver does
  float field = 0.0, aged = 0.0;
  vec2 grad = vec2(0.0);
  for (int i = 1; i <= 16; i++) {
    float sid = SID(i);
    if (mb_h(sid * 0.733 + 4.1) < 0.42) continue;               // only some samples shed a drop: the trail stays sparse
    float moved = smoothstep(2.0, 12.0, distance(P(i), P(i == 16 ? 15 : i + 1)));
    if (moved <= 0.0) continue;
    float age = AGE(i);
    float big = 0.50 + 0.50 * mb_h(sid * 1.7);                  // every drop keeps its own size
    float r = (2.8 + 5.4 * big) * (1.0 - 0.72 * age) * moved;
    if (r < 0.6) continue;
    // a heavy drop sags and rolls a little aside as it is left behind
    vec2 c = P(i) + vec2((mb_h(sid * 2.9) - 0.5) * 7.0 * age, age * age * 11.0 * big);
    vec2 d = p - c;
    float q = dot(d, d) + 1.5;
    if (q > r * r * 26.0) continue;
    float rr = r * r;
    float w = rr / q;
    field += w;
    aged += w * age;
    grad -= 2.0 * rr * d / (q * q);
  }
  if (field < 0.22) { fragColor = vec4(0.0); return; }
  float age = clamp(aged / field, 0.0, 1.0);

  // the blob surface, and its normal from the slope of the field
  float body = smoothstep(0.70, 1.45, field);
  vec3 n = normalize(vec3(-grad * 7.0, 1.0));

  // chrome shading: a small bright sky above, a dark floor below, a hard glint and a cool fresnel rim
  float up = clamp(0.5 - 0.5 * n.y, 0.0, 1.0);                  // screen y points down
  vec3 sky = vec3(0.76, 0.82, 0.92);
  vec3 floorc = vec3(0.09, 0.12, 0.18);
  vec3 env = mix(floorc, sky, smoothstep(0.22, 0.82, up));
  env += vec3(0.20, 0.25, 0.34) * pow(max(1.0 - abs(n.y), 0.0), 8.0);          // horizon band across the bead
  vec3 L = normalize(vec3(-0.46, -0.58, 0.67));
  float nl = max(dot(n, L), 0.0);
  float glint = pow(nl, 34.0);
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
  vec3 col = env * (0.70 + 0.44 * nl) + vec3(1.0, 0.99, 0.96) * glint * 0.80 + vec3(0.56, 0.68, 0.95) * fres * 0.36;

  // a very faint cool halo just outside the metal, so the drops sit on the picture instead of floating
  float halo = smoothstep(0.22, 0.70, field) * (1.0 - body) * 0.12;

  float a = clamp((body * 0.92 + halo) * (1.0 - 0.55 * age * age), 0.0, 1.0);
  vec3 outc = mix(vec3(0.56, 0.66, 0.88), clamp(col, 0.0, 1.0), body);
  fragColor = vec4(outc * a, a) * qt_Opacity;
}
