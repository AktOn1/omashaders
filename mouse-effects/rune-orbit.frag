#version 440
// category: Trail
// desc: Rune orbit: a small ring of seven carved gold runes circles the pointer, tilting and leaning like a loose halo when you move and drifting back to a calm slow turn when you stop. The nearer runes are bigger and brighter, the far side sits dim and ember-warm; a faint gold-to-teal thread follows the pointer's path behind it
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

float ro_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float ro_seg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float u = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - (a + ab * u));
}
// seven small signs, box x -0.6..0.6, y -1..1 (y up); returns the distance to the strokes
float ro_glyph(vec2 p, int g) {
  float d = 9.0;
  if (g == 0) { // fehu
    d = min(d, ro_seg(p, vec2(-0.2, -1.0), vec2(-0.2, 1.0)));
    d = min(d, ro_seg(p, vec2(-0.2, 0.45), vec2(0.45, 1.0)));
    d = min(d, ro_seg(p, vec2(-0.2, -0.1), vec2(0.45, 0.45)));
  } else if (g == 1) { // thurisaz
    d = min(d, ro_seg(p, vec2(-0.2, -1.0), vec2(-0.2, 1.0)));
    d = min(d, ro_seg(p, vec2(-0.2, 0.55), vec2(0.45, 0.1)));
    d = min(d, ro_seg(p, vec2(0.45, 0.1), vec2(-0.2, -0.35)));
  } else if (g == 2) { // ansuz
    d = min(d, ro_seg(p, vec2(-0.25, -1.0), vec2(-0.25, 1.0)));
    d = min(d, ro_seg(p, vec2(-0.25, 1.0), vec2(0.45, 0.35)));
    d = min(d, ro_seg(p, vec2(-0.25, 0.3), vec2(0.45, -0.35)));
  } else if (g == 3) { // gebo
    d = min(d, ro_seg(p, vec2(-0.45, -0.8), vec2(0.45, 0.8)));
    d = min(d, ro_seg(p, vec2(-0.45, 0.8), vec2(0.45, -0.8)));
  } else if (g == 4) { // sowilo
    d = min(d, ro_seg(p, vec2(-0.35, 1.0), vec2(0.3, 0.3)));
    d = min(d, ro_seg(p, vec2(0.3, 0.3), vec2(-0.3, -0.3)));
    d = min(d, ro_seg(p, vec2(-0.3, -0.3), vec2(0.35, -1.0)));
  } else if (g == 5) { // tiwaz
    d = min(d, ro_seg(p, vec2(0.0, -1.0), vec2(0.0, 1.0)));
    d = min(d, ro_seg(p, vec2(-0.45, 0.45), vec2(0.0, 1.0)));
    d = min(d, ro_seg(p, vec2(0.45, 0.45), vec2(0.0, 1.0)));
  } else { // othala
    d = min(d, ro_seg(p, vec2(0.0, 1.0), vec2(0.45, 0.4)));
    d = min(d, ro_seg(p, vec2(0.45, 0.4), vec2(0.0, -0.2)));
    d = min(d, ro_seg(p, vec2(0.0, -0.2), vec2(-0.45, 0.4)));
    d = min(d, ro_seg(p, vec2(-0.45, 0.4), vec2(0.0, 1.0)));
    d = min(d, ro_seg(p, vec2(0.0, -0.2), vec2(-0.45, -1.0)));
    d = min(d, ro_seg(p, vec2(0.0, -0.2), vec2(0.45, -1.0)));
  }
  return d;
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float R = 35.0 * sc;

  // how fast the pointer is going, and which way: the ring leans into the motion and trails behind it
  vec2 vel = mouse - P(3);
  float spd = length(vel);
  float mv = smoothstep(6.0 * sc, 60.0 * sc, spd);
  vec2 dir = spd > 0.5 ? vel / spd : vec2(0.0, 1.0);
  if (dir.y < 0.0) dir = -dir;                   // the ring's short axis, sign does not matter
  vec2 ax = normalize(mix(vec2(0.0, 1.0), dir, mv));
  vec2 perp = vec2(-ax.y, ax.x);
  float squash = mix(0.50, 0.38, mv);              // how squashed the ring looks
  vec2 cen = mouse + (P(2) - mouse) * 0.30;      // the centre lags the pointer a little

  float dmin = length(p - cen);
  float dtrail = 1e5;
  for (int k = 0; k < 15; k++) {
    vec2 ta = P(k);
    vec2 tb = P(k + 1) - ta;
    float tl = dot(tb, tb);
    float tu = tl > 0.01 ? clamp(dot(p - ta, tb) / tl, 0.0, 1.0) : 0.0;
    dtrail = min(dtrail, length(p - (ta + tb * tu)));
  }
  if (dmin > R * 1.9 + 14.0 * sc && dtrail > 12.0 * sc && length(p - mouse) > 14.0 * sc) { fragColor = vec4(0.0); return; }

  vec3 gold = vec3(1.00, 0.80, 0.40);
  vec3 ember = vec3(1.00, 0.48, 0.16);
  vec3 teal = vec3(0.32, 0.86, 0.80);
  vec3 bone = vec3(1.00, 0.94, 0.80);
  vec3 acc = vec3(0.0);
  float shade = 0.0;

  // the thread behind the pointer: gold at the head, fading to teal along the history
  for (int k = 0; k < 15; k++) {
    vec2 a = P(k);
    vec2 b = P(k + 1);
    vec2 ab = b - a;
    float L2 = dot(ab, ab);
    if (L2 < 0.01) continue;
    float u = clamp(dot(p - a, ab) / L2, 0.0, 1.0);
    float dl = length(p - (a + ab * u));
    float age = (float(k) + u) / 15.0;
    float fade = pow(1.0 - age, 1.6);
    float line = ro_aa(dl, 0.62 * sc * (1.0 - 0.55 * age)) * fade * 0.55;
    float glow = exp(-dl * dl / (9.0 * sc * sc)) * fade * 0.16;
    vec3 tc = mix(gold, teal, smoothstep(0.1, 0.9, age));
    acc += tc * (line + glow);
    shade += (line * 0.30 + glow * 0.9) * 0.9;
  }

  // the ring: seven runes on a tilted circle; nearer ones bigger and brighter
  float spin = time * 0.42;
  vec2 q = p - cen;
  float qa = dot(q, perp);
  float qb = dot(q, ax);
  // the faint orbit line itself (an ellipse)
  float er = length(vec2(qa, qb / squash));
  float eDist = abs(er - R) * (squash + (1.0 - squash) * 0.5);
  acc += gold * ro_aa(eDist, 0.35 * sc) * 0.16;
  shade += ro_aa(eDist, 0.5 * sc) * 0.06;
  for (int k = 0; k < 7; k++) {
    float ph = spin + float(k) * 0.8976;
    float cz = sin(ph);                            // depth: +1 near, -1 far
    vec2 rp = cen + perp * (R * cos(ph)) + ax * (R * squash * sin(ph));
    float z = cz * 0.5 + 0.5;
    float s = (6.5 + 3.5 * z) * sc;
    vec2 d = p - rp;
    if (abs(d.x) > s + 9.0 * sc || abs(d.y) > s * 1.2 + 9.0 * sc) continue;
    int g = k;
    float dist = ro_glyph(vec2(d.x, -d.y) / s, g) * s;
    float w = (0.80 + 0.30 * z) * sc;
    float line = ro_aa(dist, w);
    float halo = exp(-dist * dist / (6.0 * sc * sc * (1.0 + z)));
    float soft = exp(-dot(d, d) / (s * s * 2.2));
    float br = 0.50 + 0.50 * z;
    vec3 rc = mix(ember, mix(gold, bone, 0.35), z);
    acc += rc * (line * br + halo * 0.24 * br + soft * 0.06);
    shade += line * 0.40 + halo * 0.30 + soft * 0.32 * (0.5 + 0.5 * z);
  }

  // the pointer: a small warm spark in the middle of the ring
  vec2 dm = p - mouse;
  float rm2 = dot(dm, dm);
  float pt = 0.85 + 0.15 * sin(time * 2.0);
  float pcore = exp(-rm2 / (1.7 * sc * 1.7 * sc));
  float phalo = exp(-rm2 / (9.0 * sc * 9.0 * sc)) * 0.34;
  acc += mix(gold, bone, 0.5) * (pcore * 0.95 + phalo) * pt;
  shade += pcore * 0.25 + phalo * 1.0;

  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  float sa = clamp(shade, 0.0, 0.50);
  vec3 ink = vec3(0.025, 0.035, 0.07);
  vec3 rgb = min(acc, vec3(la)) + ink * sa * (1.0 - la);
  float a = la + sa * (1.0 - la);
  fragColor = vec4(rgb, a) * qt_Opacity;
}
