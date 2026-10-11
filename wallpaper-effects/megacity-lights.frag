// label: Megacity lights
// hint: a cyberpunk megacity at night: layered towers with lit windows and neon signs, flying cars, a hologram ring in the smog; the pointer slides the camera and wakes the windows
// category: Sci-fi worlds
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
float mcl_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mcl_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mcl_hash(i), mcl_hash(i + vec2(1, 0)), f.x), mix(mcl_hash(i + vec2(0, 1)), mcl_hash(i + vec2(1, 1)), f.x), f.y);
}
float mcl_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * mcl_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

// one skyline layer: columns of towers, lit windows, neon signs, rooftop beacons; returns the new colour
vec3 mcl_layer(vec3 col, vec2 p, float xoff, float n, float yb, float hr, float sd, float depth, float t, vec2 mp, vec3 fog) {
  float x = (p.x + xoff) * n;
  float id = floor(x);
  float fx = fract(x);
  float gap = 0.04 + 0.10 * mcl_hash(vec2(id, sd + 3.0));
  float hh = mcl_hash(vec2(id, sd));
  float top = yb - (0.05 + hr * hh * hh + 0.16 * step(0.90, mcl_hash(vec2(id, sd + 9.0))));
  float u = 1.0 / n;
  float inside = step(top, p.y) * step(gap, fx) * step(fx, 1.0 - gap);
  if (inside < 0.5) {
    // rooftop beacon of the tall ones
    float bx = (id + 0.5) / n - xoff;
    if (hh > 0.62) {
      float bd = length(p - vec2(bx, top - 0.004));
      float blink = step(0.5, fract(t * 0.35 + hh * 7.0));
      col += vec3(1.0, 0.12, 0.15) * exp(-bd * bd / 0.000012) * blink * 0.8 * (1.0 - depth * 0.5);
    }
    return col;
  }
  vec3 body = mix(vec3(0.010, 0.008, 0.030), fog * 0.5, depth);
  // soft vertical gradient: windows glow lights the lower part
  body += vec3(0.07, 0.02, 0.10) * (0.3 + 0.7 * smoothstep(top, yb, p.y)) * (1.0 - depth);
  // windows
  vec2 wc = vec2(fx * 6.0, (p.y - top) / u * 6.0 * 0.9);
  vec2 wi = floor(wc), wf = fract(wc);
  float wh = mcl_hash(wi + vec2(id * 7.31, sd * 3.0));
  float wh2 = mcl_hash(wi + vec2(id * 3.7 + 5.0, sd));
  float lit = step(0.50 + 0.18 * mcl_hash(vec2(id, sd + 4.0)), wh);
  float flick = step(0.2, 0.5 + 0.5 * sin(t * (0.05 + 0.1 * wh2) + wh * 80.0));
  vec2 wr = smoothstep(vec2(0.18), vec2(0.30), wf) * smoothstep(vec2(0.18), vec2(0.30), 1.0 - wf);
  float win = wr.x * wr.y * lit * flick * step(0.06, fx - gap) * step(0.06, 1.0 - gap - fx);
  vec3 wcol = wh2 < 0.18 ? vec3(0.25, 0.90, 1.0) : (wh2 < 0.30 ? vec3(1.0, 0.25, 0.70) : vec3(1.0, 0.78, 0.45));
  // the pointer wakes the windows around it
  float near = exp(-pow(length((p - mp) * vec2(1.0, 1.0)) / 0.22, 2.0));
  float wk = (0.45 + 1.1 * near) * (1.0 - depth * 0.30);
  body += wcol * win * wk;
  // rim light on the left edge, cyan or magenta by building
  float rim = smoothstep(0.035, 0.0, fx - gap);
  body += (hh > 0.5 ? vec3(0.10, 0.55, 0.75) : vec3(0.70, 0.12, 0.45)) * rim * 0.55 * (1.0 - depth * 0.6);
  // neon sign: a vertical tube on some towers
  float sg = mcl_hash(vec2(id, sd + 11.0));
  if (sg > 0.78) {
    vec3 nc = sg > 0.9 ? vec3(1.0, 0.15, 0.62) : vec3(0.15, 0.85, 1.0);
    float sy = top + (0.12 + 0.35 * mcl_hash(vec2(id, sd + 5.0))) * (yb - top);
    float len = 0.25 * (yb - top);
    float bar = smoothstep(0.04, 0.0, abs(fx - 0.5)) * smoothstep(len, len * 0.8, abs(p.y - sy));
    float glow = exp(-pow((fx - 0.5) / 0.28, 2.0)) * smoothstep(len * 1.5, 0.0, abs(p.y - sy)) * 0.20;
    float pulse = 0.85 + 0.15 * sin(t * 1.3 + sg * 30.0);
    body += nc * (bar * 0.9 + glow) * pulse * (1.0 - depth * 0.4);
  }
  return body;
}

// one lane of flying cars: a warm headlight and a red tail, drifting sideways
vec3 mcl_cars(vec2 p, float y, float cell, float speed, float sd, float t) {
  float q = p.x / cell - t * speed;
  float id = floor(q), lx = fract(q);
  float h = mcl_hash(vec2(id, sd));
  if (h > 0.42) return vec3(0.0);
  float x0 = 0.25 + 0.5 * mcl_hash(vec2(id, sd + 2.0));
  float dx = (lx - x0) * cell * sign(speed);
  float dy = p.y - y - 0.0015 * sin(t * 0.7 + id);
  float yline = exp(-dy * dy / 0.000007);
  float head = exp(-pow(dx / 0.006, 2.0)) * yline;
  float tail = smoothstep(0.0, -0.05, dx) * smoothstep(-0.10, -0.01, dx) * yline * 0.8;
  tail = max(tail, 0.0);
  return vec3(1.0, 0.85, 0.65) * head * 1.2 + vec3(1.0, 0.18, 0.28) * tail * (dx < 0.0 ? 1.0 : 0.0);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  float hasPtr = step(-5000.0, mpx.x);
  if (hasPtr < 0.5) m = vec2(0.5, 0.6);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  float cam = (m.x - 0.5) * asp;                     // pointer slides the camera sideways: nearer layers move more

  // sky: indigo above, magenta smog in the middle, hot orange-pink near the horizon
  float h = uv.y;
  vec3 top = vec3(0.012, 0.008, 0.070);
  vec3 mid = vec3(0.230, 0.030, 0.260);
  vec3 low = vec3(0.900, 0.200, 0.420);
  vec3 sky = mix(top, mid, smoothstep(0.0, 0.50, h));
  sky = mix(sky, low, smoothstep(0.45, 0.80, h) * 0.85);
  sky += wall(uv) * 0.045;
  // smog clouds lit from below
  float cl = mcl_fbm(vec2(p.x * 1.6 + t * 0.006, p.y * 3.4));
  sky += vec3(0.50, 0.10, 0.35) * smoothstep(0.45, 0.80, cl) * 0.22 * smoothstep(0.1, 0.6, h);
  // a giant hologram ring hanging over the city, glowing cyan
  vec2 rc = vec2(0.40 * asp, 0.30);
  float rd = length(p - rc + vec2(cam * 0.04, 0.0));
  float ring = exp(-pow((rd - 0.115) / 0.004, 2.0)) + 0.5 * exp(-pow((rd - 0.150) / 0.003, 2.0)) * step(0.0, sin(atan(p.y - rc.y, p.x - rc.x) * 12.0 + t * 0.4));
  sky += vec3(0.20, 0.85, 1.0) * (ring * 0.55 + exp(-pow((rd - 0.115) / 0.03, 2.0)) * 0.10);

  vec3 col = sky;
  vec3 fogA = vec3(0.55, 0.12, 0.40), fogB = vec3(0.30, 0.06, 0.34);
  // far -> near
  col = mcl_layer(col, p, cam * 0.04 + 3.0, 14.0, 0.86, 0.34, 1.0, 0.85, t, mp, fogA);
  col += mcl_cars(p, 0.50, 0.18, 0.030, 4.0, t) * 0.6;
  col = mcl_layer(col, p, cam * 0.10 + 9.0, 9.0, 0.95, 0.42, 7.0, 0.55, t, mp, fogB);
  col += mcl_cars(p, 0.44, 0.24, -0.050, 8.0, t) * 0.8;
  col += mcl_cars(p, 0.62, 0.30, 0.070, 2.0, t);
  // mist between mid and near layers
  float mist = mcl_fbm(vec2(p.x * 2.0 - t * 0.01, p.y * 6.0)) * smoothstep(0.5, 1.0, h);
  col = mix(col, fogA * 0.8, mist * 0.30);
  col = mcl_layer(col, p, cam * 0.22 + 20.0, 5.0, 1.12, 0.55, 13.0, 0.0, t, mp, fogB);
  col += mcl_cars(p, 0.75, 0.40, -0.12, 6.0, t) * 1.2;

  // pointer: a faint searchlight sweeping up from the street where the pointer is
  float beam = exp(-pow((p.x - mp.x) / (0.015 + 0.10 * (1.0 - p.y)), 2.0)) * smoothstep(0.2, 1.0, p.y) * 0.10;
  col += vec3(0.6, 0.85, 1.0) * beam * hasPtr;

  col *= 1.0 - 0.40 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
