// label: Redline rumble
// hint: your picture as seen from a racing car: the whole view buzzes with the engine and now and then takes a kerb hit with a quick damped bounce, fine speed streaks fly past at the left and right edges with a little motion blur, a faint heat shimmer rises near the bottom and tiny grit slides by along the asphalt. Moving the pointer away from the middle opens the throttle: more streaks, more shake
// category: Motion
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

float rr_h(float x) { return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
float rr_h2(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float rr_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float rr_n1(float x) {
  float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(rr_h(i), rr_h(i + 1.0), f);
}

// one kerb hit: a kick that rings down in a quick damped bounce (front wheel, then the rear wheel a moment later)
float rr_ring(float dt) {
  if (dt <= 0.0) return 0.0;
  return sin(dt * 44.0) * exp(-dt * 6.0);
}
// the irregular bumps: at most one hit per slot of about two seconds, each with its own strength and side
vec2 rr_bumps(float t) {
  float P = 1.9;
  float k0 = floor(t / P);
  vec2 v = vec2(0.0);
  for (int j = 0; j < 2; j++) {
    float k = k0 - float(j);
    if (rr_h(k + 7.0) < 0.22) continue;
    float te = (k + 0.08 + 0.62 * rr_h(k + 1.0)) * P;
    float dt = t - te;
    float a = 1.6 + 2.6 * rr_h(k + 3.0);
    float side = rr_h(k + 5.0) < 0.5 ? -1.0 : 1.0;
    float r = rr_ring(dt) + 0.55 * rr_ring(dt - 0.11);
    v += vec2(side * 0.38 * a * rr_ring(dt * 0.8), a * r);
  }
  return v;
}

// add an overlay colour; on bright pictures it is darkened so it still reads
vec3 rr_ov(vec3 col, vec3 c, vec3 dk, float a, float lum) {
  vec3 ec = mix(c, dk, smoothstep(0.45, 0.85, lum));
  return mix(col, ec, clamp(a, 0.0, 1.0));
}

vec4 fxMain(vec2 mpx, float r) {
  vec2 uv = qt_TexCoord0;
  vec2 pp = uv * res;
  float sp = res.y / 1080.0;
  float sc = clamp(sp, 0.75, 2.0);
  bool has = mpx.x > -5000.0;
  float t = time;

  // throttle: the further the pointer sits from the middle, the faster the car goes
  float thr = has ? smoothstep(0.08, 0.75, length((mpx / res - 0.5) * vec2(1.0, 0.6)) * 2.0) : 0.0;
  float spd = 1.0 + 0.85 * thr * r;
  float amp = (0.4 + 0.6 * r) * (1.0 + 0.35 * thr * r);

  // the shake of the whole view, in pixels at 1080p: fast engine buzz plus the irregular kerb hits
  vec2 buzz = vec2(0.55 * (rr_n1(t * 53.0) - 0.5) + 0.30 * sin(t * 71.0), 0.95 * sin(t * 97.0) * (0.6 + 0.4 * sin(t * 6.1)) + 0.55 * (rr_n1(t * 41.0 + 9.0) - 0.5));
  vec2 shk = (buzz * (0.8 + 0.4 * spd) + rr_bumps(t)) * amp;
  vec2 off = shk / vec2(1080.0 * res.x / res.y, 1080.0);

  // faint heat shimmer rising from the road, strongest near the bottom
  float heat = smoothstep(0.55, 1.0, uv.y);
  off.x += heat * 0.55 * (rr_n1(uv.y * 70.0 - t * 5.0) - 0.5) / (1080.0 * res.x / res.y) * 2.0;
  off.y += heat * 0.25 * sin(uv.x * 30.0 + t * 3.0 + 2.0 * rr_n1(uv.y * 20.0 + t)) / 1080.0;

  vec2 q = uv + off;

  // a few taps toward the middle for a speed blur, only toward the left and right edges
  vec2 dir = uv - vec2(0.5, 0.52);
  float em = smoothstep(0.26, 0.52, abs(dir.x));
  float bl = (0.018 * em * em + 0.004 * smoothstep(0.30, 0.55, abs(dir.y))) * spd;
  vec3 col = wall(q);
  if (bl > 0.0008) {
    vec3 acc = col;
    float wsum = 1.0;
    for (int i = 1; i <= 4; i++) {
      float f = float(i) / 4.0;
      float w = 1.0 - 0.18 * float(i);
      acc += wall(q - dir * bl * 2.0 * f) * w;
      wsum += w;
    }
    col = acc / wsum;
  }
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));

  // asphalt dusk: the corners fall into charcoal with a trace of red
  float vig = smoothstep(0.32, 1.00, length((uv - 0.5) * vec2(res.x / res.y, 1.0)));
  col = mix(col, col * vec3(0.78, 0.72, 0.75) + vec3(0.022, 0.0, 0.0), 0.85 * vig);

  vec3 white = vec3(1.0, 0.96, 0.92);
  vec3 red = vec3(1.0, 0.13, 0.10);
  vec3 amber = vec3(1.0, 0.68, 0.20);
  vec3 dark = vec3(0.10, 0.02, 0.02);

  // speed streaks: thin horizontal lines flying outward at the left and right edges
  float o = abs(uv.x - 0.5);
  float side = uv.x < 0.5 ? 0.0 : 1.0;
  float zone = smoothstep(0.26, 0.44, o);
  float sA = 0.0; float sR = 0.0; float sY = 0.0;
  for (int l = 0; l < 2; l++) {
    float rows = l == 0 ? 210.0 : 130.0;
    float yy = uv.y * rows + (l == 0 ? 0.0 : 17.3);
    float id = floor(yy) + side * 91.0 + float(l) * 37.0;
    float hh = rr_h(id);
    if (hh > 0.26 + 0.14 * thr * r) continue;
    float rate = (0.45 + 1.1 * rr_h(id + 2.0)) * 0.55 * spd;
    float len = 0.05 + 0.15 * rr_h(id + 4.0);
    float ho = 0.22 + fract(rr_h(id + 1.0) + t * rate) * 0.38;
    float body = smoothstep(ho - len, ho, o) * (1.0 - smoothstep(ho - 0.004, ho + 0.012, o));
    float thick = 1.0 - smoothstep(0.20, 0.38, abs(fract(yy) - 0.5));
    float s = body * thick * zone * (0.40 + 0.6 * rr_h(id + 6.0));
    float kind = rr_h(id + 8.0);
    if (kind < 0.09) sR += s; else if (kind < 0.20) sY += s; else sA += s;
  }
  col = rr_ov(col, white, dark, sA * 0.70, lum0);
  col = rr_ov(col, amber, dark, sY * 0.70, lum0);
  col = rr_ov(col, red, vec3(0.45, 0.0, 0.0), sR * 0.70, lum0);

  // tiny grit sliding past on the road, nearer ones bigger and faster
  float roadM = smoothstep(0.80, 0.96, uv.y);
  if (roadM > 0.0) {
    float gA = 0.0; float gR = 0.0; float gY = 0.0;
    for (int l = 0; l < 3; l++) {
      float fl = float(l);
      float cw = (46.0 + 26.0 * fl) * sc;
      float ch = (10.0 + 6.0 * fl) * sc;
      float v = (260.0 + 210.0 * fl) * sc * spd;
      vec2 gp = vec2(pp.x + t * v, pp.y);
      vec2 ci = floor(gp / vec2(cw, ch));
      float hv = rr_h2(ci + fl * 13.7);
      if (hv > 0.26) continue;
      float depth = clamp((uv.y - 0.80) / 0.20, 0.0, 1.0);
      if (rr_h2(ci + 5.1) > 0.30 + 0.7 * depth) continue;
      vec2 cp = (ci + 0.15 + 0.7 * vec2(rr_h2(ci + 1.7), rr_h2(ci + 8.3))) * vec2(cw, ch);
      vec2 d = gp - cp;
      float Lp = (2.0 + 9.0 * rr_h2(ci + 3.3)) * sc * (0.7 + 0.5 * spd) * (0.6 + 0.8 * fl / 2.0);
      float ax = max(abs(d.x) - Lp, 0.0);
      float dist = length(vec2(ax, d.y));
      float a = rr_aa(dist, (0.6 + 0.5 * fl) * sc) * (0.55 + 0.45 * rr_h2(ci + 6.6));
      float kind = rr_h2(ci + 9.9);
      if (kind < 0.07) gR += a; else if (kind < 0.20) gY += a; else gA += a;
    }
    col = rr_ov(col, vec3(0.86, 0.86, 0.88), dark, gA * 0.55 * roadM, lum0);
    col = rr_ov(col, amber, dark, gY * 0.75 * roadM, lum0);
    col = rr_ov(col, red, vec3(0.45, 0.0, 0.0), gR * 0.75 * roadM, lum0);
  }

  // a warm heat haze near the road edge
  col += vec3(0.085, 0.030, 0.0) * heat * heat * (1.0 - 0.6 * smoothstep(0.45, 0.85, lum0));

  return vec4(col, 1.0) * qt_Opacity;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored (the shake is also softened), above 1 = exaggerated
void main() {
  vec2 away = vec2(-10000.0);
  float r = clamp(react, 0.0, 2.0);
  vec4 c = r <= 0.005 ? fxMain(away, 0.0) : fxMain(mouse, r);
  fragColor = clamp(c, 0.0, 1.0);
}
