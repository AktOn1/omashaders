// label: City twinkle
// hint: tiny warm and cool lights twinkle on the dark areas, denser toward the bottom, with a few slow cars crawling along
// category: Night and water
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}



float ct_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// textureLod so it is safe inside branches; the picture at a point, same mapping as wall()
vec3 ct_tap(vec2 uv) { return textureLod(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0)), 0.0).rgb; }
// how dark the picture is around a point (centre and four neighbours): 1 = dark, 0 = lit
float ct_dark(vec2 uv, float rad) {
  float l = ct_lum(ct_tap(uv));
  l += ct_lum(ct_tap(uv + vec2(rad, 0.0))) + ct_lum(ct_tap(uv - vec2(rad, 0.0)))
     + ct_lum(ct_tap(uv + vec2(0.0, rad))) + ct_lum(ct_tap(uv - vec2(0.0, rad)));
  return 1.0 - smoothstep(0.06, 0.20, l * 0.2);
}

// one grid of tiny lights; each cell holds at most one, probability rising toward the bottom of the picture
vec3 ct_layer(vec2 uv, float asp, float sc, float seed, float size, float base, float rise) {
  vec2 g = vec2(uv.x * asp, uv.y) * sc;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float cy = (id.y + 0.5) / sc;
  float pr = base * smoothstep(0.3, 0.6, cy) + rise * smoothstep(0.38, 0.88, cy);
  float h = hash(id + seed);
  if (h > pr) return vec3(0.0);
  vec2 q = (id + 0.5) / sc;
  float dk = ct_dark(vec2(q.x / asp, q.y), 0.028);
  if (dk <= 0.001) return vec3(0.0);
  float h2 = hash(id + seed + 4.1), h3 = hash(id + seed + 8.3), h4 = hash(id + seed + 2.9);
  vec2 c = 0.5 + (vec2(hash(id + seed + 1.1), hash(id + seed + 9.7)) - 0.5) * 0.45;
  vec2 d = f - c;
  // colour: mostly warm windows, some cool, a few red/green signal lights
  vec3 tint = vec3(1.0, 0.72, 0.38);
  if (h2 > 0.55) tint = vec3(0.62, 0.80, 1.0);
  if (h2 > 0.86) tint = vec3(1.0, 0.93, 0.80);
  if (h2 > 0.955) tint = vec3(1.0, 0.25, 0.18);
  if (h2 > 0.985) tint = vec3(0.30, 1.0, 0.50);
  // soft slow twinkle; some lights also drift on and off over a few seconds
  float tw = 0.45 + 0.55 * (0.5 + 0.5 * sin(time * (0.5 + 1.4 * h3) + h4 * 100.0));
  float onoff = smoothstep(-0.6, 0.0, sin(time * (0.12 + 0.12 * h4) + h3 * 70.0));
  float shape;
  if (h3 > 0.72) {
    vec2 bd = abs(d) - vec2(size * 0.9, size * 1.25);                        // a lit window
    shape = smoothstep(size * 0.5, -size * 0.2, max(bd.x, bd.y));
  } else {
    shape = exp(-dot(d, d) / (2.0 * size * size));                           // a point light
  }
  float halo = exp(-dot(d, d) / (2.0 * size * size * 9.0)) * 0.22;
  vec2 w2 = smoothstep(0.0, 0.12, f) * smoothstep(1.0, 0.88, f);
  return tint * (shape + halo) * w2.x * w2.y * tw * onoff * dk * (0.6 + 0.6 * h4);
}

// a car: two lights (red ahead of us, white coming) crawling along a horizontal line, a faint glow on the road around it
vec3 ct_car(vec2 uv, float asp, float lane, float ph, float spd, float dir) {
  float x = fract(ph + time * spd * dir) * 1.2 - 0.1;
  float y = lane + 0.003 * sin(time * 0.3 + ph * 20.0);
  vec2 d = vec2((uv.x - x) * asp, uv.y - y);
  if (abs(d.y) > 0.05 || abs(d.x) > 0.16) return vec3(0.0);
  float dk = ct_dark(vec2(clamp(x, 0.0, 1.0), y), 0.03);
  if (dk <= 0.001) return vec3(0.0);
  vec3 tint = dir > 0.0 ? vec3(1.0, 0.20, 0.12) : vec3(1.0, 0.90, 0.68);
  float sep = 0.0075;
  float l1 = exp(-dot(d - vec2(sep, 0.0), d - vec2(sep, 0.0)) / (2.0 * 0.003 * 0.0030));
  float l2 = exp(-dot(d + vec2(sep, 0.0), d + vec2(sep, 0.0)) / (2.0 * 0.003 * 0.0030));
  float glow = exp(-dot(d * vec2(1.0, 2.2), d * vec2(1.0, 2.2)) / (2.0 * 0.014 * 0.014)) * 0.4;
  float tb = -d.x * dir;                                              // distance behind the car: a short faint trail
  float trail = exp(-abs(d.y) / 0.0022) * smoothstep(0.0, 0.01, tb) * exp(-tb / 0.03) * 0.3;
  float edge = smoothstep(0.0, 0.08, x + 0.0) * smoothstep(1.0, 0.92, x);
  return tint * (l1 + l2 + glow + trail) * dk * edge * 0.95;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec3 col = wall(uv);
  vec3 add = ct_layer(uv, asp, 78.0, 1.0, 0.11, 0.05, 0.15) * 1.0
           + ct_layer(uv, asp, 38.0, 9.0, 0.10, 0.02, 0.10) * 1.0;
  add += ct_car(uv, asp, 0.67, 0.15, 0.021, 1.0)
       + ct_car(uv, asp, 0.67, 0.65, 0.021, 1.0)
       + ct_car(uv, asp, 0.76, 0.40, 0.027, -1.0)
       + ct_car(uv, asp, 0.76, 0.90, 0.027, -1.0)
       + ct_car(uv, asp, 0.86, 0.30, 0.034, 1.0);
  col = 1.0 - (1.0 - col) * (1.0 - clamp(add, 0.0, 1.0));
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
