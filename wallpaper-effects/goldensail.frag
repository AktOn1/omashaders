// label: Golden sail
// hint: a small sailboat crossing the sun's glitter path at golden hour, warm sky, low swell; the pointer stirs extra glints
// category: Sea and sky
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
float gs_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gs_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gs_hash(i), gs_hash(i + vec2(1, 0)), f.x), mix(gs_hash(i + vec2(0, 1)), gs_hash(i + vec2(1, 1)), f.x), f.y);
}
float gs_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * gs_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float gs_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * gs_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float gs_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
const float GS_HZ = 0.52;

// signed side of a triangle: >0 inside
float gs_tri(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 e0 = b - a, e1 = c - b, e2 = a - c;
  float s0 = e0.x * (p.y - a.y) - e0.y * (p.x - a.x);
  float s1 = e1.x * (p.y - b.y) - e1.y * (p.x - b.x);
  float s2 = e2.x * (p.y - c.y) - e2.y * (p.x - c.x);
  float k = min(min(s0 * sign(e0.x * (c.y - a.y) - e0.y * (c.x - a.x)), s1 * sign(e0.x * (c.y - a.y) - e0.y * (c.x - a.x))), s2 * sign(e0.x * (c.y - a.y) - e0.y * (c.x - a.x)));
  return k;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);
  float pl = gs_luma(pic);
  vec2 sun = vec2(asp * 0.40, GS_HZ - 0.075);

  // ---- sky: peach-gold at the horizon, rose, then dusky teal at the top
  float h = clamp(uv.y / GS_HZ, 0.0, 1.0);
  vec3 sky = mix(vec3(1.00, 0.70, 0.36), vec3(0.95, 0.46, 0.34), smoothstep(0.55, 0.30, h));
  sky = mix(sky, vec3(0.42, 0.34, 0.50), smoothstep(0.42, 0.08, h));
  sky = mix(sky, vec3(0.16, 0.24, 0.40), smoothstep(0.22, 0.0, h));
  // long thin cirrus streaks catching the light
  float cir = gs_fbm3(vec2(p.x * 1.2 - t * 0.006, p.y * 14.0));
  float cir2 = gs_fbm3(vec2(p.x * 0.7 + t * 0.004 + 9.0, p.y * 9.0));
  float streak = smoothstep(0.45, 0.78, cir * 0.65 + cir2 * 0.5) * smoothstep(0.02, 0.35, h) * smoothstep(1.0, 0.55, h);
  sky = mix(sky, mix(vec3(0.78, 0.36, 0.36), vec3(1.0, 0.76, 0.52), exp(-pow((p.x - sun.x) / 0.5, 2.0))), streak * 0.65);
  sky += vec3(0.012, 0.01, 0.008) * pl;
  float ds = length(p - sun);
  sky += vec3(1.0, 0.50, 0.18) * exp(-ds * ds / 0.040) * 0.55 + vec3(1.0, 0.72, 0.40) * exp(-ds * ds / 0.0045) * 0.40;
  sky = mix(sky, vec3(1.0, 0.95, 0.80), smoothstep(0.050, 0.044, ds));         // the sun disc
  sky = mix(sky, vec3(1.0, 0.70, 0.40), smoothstep(0.0, 0.07, abs(uv.y - GS_HZ)) * 0.0);

  // ---- sea
  float depth = max(uv.y - GS_HZ, 0.0);
  float sc = 1.0 / (depth + 0.012);
  float swell = sin(p.x * 3.0 * (1.0 + depth * 4.0) + t * 0.5 + sin(p.y * 12.0 + t * 0.3)) ;
  vec2 wq = vec2(p.x * (5.0 + depth * 14.0) + t * 0.05, sc * 0.34 + depth * 24.0 - t * 0.12);
  float w1 = gs_fbm(wq + vec2(0.0, gs_fbm3(wq * 0.7) * 1.2));
  float w2 = gs_noise(wq * vec2(2.0, 4.0) + 3.0);
  vec3 sea = mix(vec3(0.60, 0.30, 0.22), vec3(0.10, 0.17, 0.27), smoothstep(0.0, 0.34, depth));   // copper near the horizon, deep blue near us
  sea = mix(sea, sea * vec3(1.15, 1.1, 0.9) + vec3(0.04, 0.03, 0.02), smoothstep(0.35, 0.7, w1) * 0.6);
  // the sun's glitter path: broken horizontal dashes, wider toward the viewer
  float pw = 0.035 + 0.30 * depth;
  float pd = (p.x - sun.x) + (w1 - 0.5) * (0.05 + 0.2 * depth);
  float path = exp(-pd * pd / (2.0 * pw * pw));
  float dash = smoothstep(0.50, 0.80, gs_noise(vec2(p.x * (9.0 + depth * 14.0) + t * 0.15, sc * 1.3 + depth * 60.0 - t * 0.8)) * 0.8 + w2 * 0.35);
  float glint = path * dash;
  sea += vec3(1.0, 0.78, 0.45) * glint * 0.95;
  sea += vec3(1.0, 0.60, 0.30) * path * 0.22 * (1.0 - smoothstep(0.0, 0.3, depth));
  // pointer: a patch of sparkle where it stirs the water
  if (m.y > GS_HZ) {
    float dm = length((p - mp) * vec2(1.0, 2.2));
    float sp = smoothstep(0.55, 0.85, gs_noise(wq * vec2(5.0, 7.0) + t * 0.7)) * exp(-dm * dm / 0.012);
    sea += vec3(1.0, 0.85, 0.55) * sp * 0.85;
  }
  float wmask = smoothstep(GS_HZ - 0.002, GS_HZ + 0.003, uv.y);
  vec3 col = mix(sky, sea, wmask);

  // ---- the sailboat, bobbing
  vec2 bc = vec2(asp * 0.585, GS_HZ + 0.052);
  float rot = 0.035 * sin(t * 0.9) ;
  vec2 q = (p - bc) / 1.8; q = vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
  q.y += 0.003 * sin(t * 0.7);
  q /= 1.0;
  // hull: a thin curved sliver
  float hull = step(abs(q.x), 0.036) * smoothstep(0.0, 0.002, q.y) * smoothstep(0.0, 0.002, (0.010 - 0.012 * pow(abs(q.x) / 0.036, 2.0)) - q.y + 0.0) * step(-0.002, q.y);
  float mast = step(abs(q.x + 0.002), 0.0007) * step(q.y, 0.0) * step(-0.095, q.y);
  float sailA = step(0.0004, gs_tri(q, vec2(0.0, -0.095), vec2(0.0, -0.006), vec2(-0.034, -0.008)));
  float sailB = step(0.0004, gs_tri(q, vec2(0.006, -0.088), vec2(0.006, -0.006), vec2(0.040, -0.008)));
  float sails = max(sailA * 0.9, sailB);
  vec3 dark = vec3(0.07, 0.03, 0.035);
  vec3 sailLit = mix(vec3(0.95, 0.55, 0.32), vec3(1.0, 0.82, 0.62), clamp(0.5 + q.x * 12.0, 0.0, 1.0)); // sun-lit sails (backlit)
  col = mix(col, dark, max(hull, mast));
  col = mix(col, mix(vec3(0.20, 0.08, 0.08), sailLit * 0.75, smoothstep(0.30, 0.0, abs(q.x + 0.004 - 0.0))), clamp(sails, 0.0, 1.0) * 0.92);
  // reflection of the boat: a short dark smear below
  vec2 rq = vec2(q.x * 1.0, -(q.y) - 0.012);
  float refl = step(abs(rq.x), 0.026) * step(0.0, rq.y) * step(rq.y, 0.05) * (1.0 - rq.y / 0.05) * (0.5 + 0.5 * sin(rq.y * 500.0 + t * 2.0));
  col = mix(col, vec3(0.30, 0.14, 0.10), refl * 0.35 * wmask);

  // a couple of gulls
  for (int k = 0; k < 3; k++) {
    float kf = float(k);
    vec2 gp = vec2(asp * (0.18 + 0.12 * kf) + 0.02 * sin(t * 0.2 + kf * 2.0), 0.16 + 0.07 * kf + 0.01 * sin(t * 0.3 + kf));
    vec2 g = (p - gp) * vec2(1.0, 1.7) * 90.0;
    float flap = sin(t * (2.5 + kf * 0.4) + kf * 3.0) * 0.6;
    float wing = abs(g.y + abs(g.x) * (0.5 + flap) - 0.4 * (flap)) ;
    float gl = smoothstep(0.5, 0.0, wing) * step(abs(g.x), 3.0);
    col = mix(col, vec3(0.20, 0.10, 0.12), gl * 0.7 * smoothstep(0.7, 0.4, uv.y));
  }

  col *= 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.4);
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
