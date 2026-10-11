// label: Pop art dots
// hint: comic pop art over your picture: big flat halftone dots in red, yellow and blue that slowly roll and pulse, a bold inked starburst with a hard shadow; the dots swell around the pointer
// category: Style studies
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
float pp_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pp_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pp_hash(i), pp_hash(i + vec2(1, 0)), f.x), mix(pp_hash(i + vec2(0, 1)), pp_hash(i + vec2(1, 1)), f.x), f.y);
}

// the flat inks
vec3 pp_ink(float k) {
  if (k < 0.5) return vec3(0.07, 0.30, 0.86);   // blue
  if (k < 1.5) return vec3(0.93, 0.11, 0.14);   // red
  return vec3(1.0, 0.82, 0.04);                 // yellow
}
// which ink a spot of the page gets: big slow-moving flat fields
float pp_zone(vec2 q, float t) {
  float z = 0.62 * pp_noise(q * 1.05 + vec2(t * 0.004, 3.0)) + 0.38 * pp_noise(q * 2.3 + vec2(7.0, t * 0.006));
  return z < 0.40 ? 0.0 : (z < 0.58 ? 1.0 : 2.0);
}
// signed distance to a straight-sided star (n points, inner radius ri, outer ro), negative inside
float pp_star(vec2 dq, float rot, float n, float ri, float ro) {
  float an = 6.28318 / n;
  float a = atan(dq.y, dq.x) + rot;
  float ang = abs(mod(a + an * 0.5, an) - an * 0.5);
  vec2 q = length(dq) * vec2(cos(ang), sin(ang));
  vec2 T = vec2(ro, 0.0);
  vec2 V = vec2(ri * cos(an * 0.5), ri * sin(an * 0.5));
  vec2 e = V - T;
  vec2 nrm = normalize(vec2(e.y, -e.x));
  return dot(q - T, nrm);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);
  float aa = 1.6 / res.y;

  // the page: your picture, lifted a touch toward newsprint cream
  vec3 col = mix(w, vec3(0.98, 0.94, 0.84), 0.14);
  vec3 black = vec3(0.035, 0.03, 0.04);

  // ---- halftone: two interleaved dot grids on the classic 45 degree screen
  float S = 0.085;
  mat2 R = mat2(0.70711, -0.70711, 0.70711, 0.70711);
  vec2 roll = vec2(t * 0.020, t * 0.008);
  vec2 g = (R * p) / S + roll;
  // small dots in the gaps (drawn first)
  {
    vec2 g2 = g + 0.5;
    vec2 c2 = floor(g2);
    vec2 f2 = g2 - c2 - 0.5;
    vec2 pc = ((c2 - roll) * S) * R;
    float wave = 0.5 + 0.5 * sin(pc.x * 7.0 + pc.y * 4.5 - t * 1.1 + 2.0);
    float rad = S * (0.095 + 0.12 * wave);
    float sw = hasM ? exp(-dot(pc - mp, pc - mp) / 0.045) : 0.0;
    rad = min(rad * (1.0 + 1.5 * sw), S * 0.30);
    float d = length(f2) * S;
    float cov = 1.0 - smoothstep(rad - aa, rad + aa, d);
    float zk = mod(pp_zone(pc, t) + 2.0, 3.0);
    col = mix(col, pp_ink(zk), cov * 0.80);
  }
  // the big dots
  {
    vec2 c = floor(g);
    vec2 f = g - c - 0.5;
    vec2 pc = ((c + 0.5 - roll) * S) * R;
    float wave = 0.5 + 0.5 * sin(pc.x * 7.0 + pc.y * 4.5 - t * 1.1);
    float rad = S * (0.17 + 0.30 * wave);
    float sw = hasM ? exp(-dot(pc - mp, pc - mp) / 0.045) : 0.0;
    rad = min(rad * (1.0 + 0.95 * sw), S * 0.49);
    float d = length(f) * S;
    float cov = 1.0 - smoothstep(rad - aa, rad + aa, d);
    float ring = 1.0 - smoothstep(0.0, aa * 1.8, abs(d - rad - 0.003));
    col = mix(col, pp_ink(pp_zone(pc, t)), cov * 0.84);
    col = mix(col, black, ring * 0.40);
  }

  // ---- the bold starburst: hard shadow, thick ink outline, flat yellow with a red heart
  {
    vec2 C = vec2(0.64 * asp, 0.47);
    float pulse = 1.0 + 0.045 * sin(t * 1.5);
    float rot = t * 0.035;
    vec2 dq = p - C;
    float r = length(dq);
    float Ro = 0.31 * pulse, Ri = 0.19 * pulse;
    // action lines beyond the points
    float u = (atan(dq.y, dq.x) + rot) * 28.0 / 6.28318;
    float j = floor(u);
    float fj = abs(fract(u) - 0.5) * 2.0;
    float reach = Ro * (1.30 + 0.35 * pp_hash(vec2(j, 4.0)));
    float rn = (r - Ro * 1.10) / max(reach - Ro * 1.10, 0.001);
    float ray = step(0.40, pp_hash(vec2(j, 9.0))) * step(0.0, rn) * step(rn, 1.0) * (1.0 - smoothstep(0.55 * (1.0 - rn) - 0.03, 0.55 * (1.0 - rn) + 0.02, fj));
    col = mix(col, black, ray * 0.45);
    // hard offset shadow
    float so = pp_star(dq - vec2(0.016, 0.019), rot, 14.0, Ri, Ro);
    col = mix(col, black, (1.0 - smoothstep(-aa, aa, so)) * 0.70);
    // ink outline and flat yellow fill
    float o = pp_star(dq, rot, 14.0, Ri, Ro);
    col = mix(col, black, (1.0 - smoothstep(-aa, aa, o - 0.011)) * 0.93);
    float fillk = 1.0 - smoothstep(-aa, aa, o);
    col = mix(col, vec3(1.0, 0.84, 0.05), fillk * 0.88);
    // red inner star, turned half a point, with its own outline
    float o2 = pp_star(dq, rot + 3.14159 / 14.0, 14.0, Ri * 0.52, Ro * 0.70);
    col = mix(col, black, (1.0 - smoothstep(-aa, aa, o2 - 0.008)) * fillk * 0.92);
    col = mix(col, vec3(0.93, 0.11, 0.14), (1.0 - smoothstep(-aa, aa, o2)) * fillk * 0.88);
    // a cream boss in the middle, with a few black halftone dots
    float boss = Ri * 0.30;
    col = mix(col, black, (1.0 - smoothstep(-aa, aa, r - boss - 0.007)) * 0.92);
    col = mix(col, vec3(0.99, 0.95, 0.85), (1.0 - smoothstep(-aa, aa, r - boss)) * 0.90);
    vec2 hg = dq / 0.026;
    vec2 hf = fract(hg) - 0.5;
    float hdot = (1.0 - smoothstep(0.20, 0.24, length(hf))) * (1.0 - smoothstep(boss - 0.012, boss - 0.004, r));
    col = mix(col, black, hdot * 0.75);
  }

  // a printed edge: the picture stays readable underneath, the corners get a little darker
  col *= 1.0 - 0.18 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
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
