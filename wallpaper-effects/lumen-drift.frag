// label: Lumen drift
// hint: soft bokeh lights, glints and thin light streaks drift through the picture in depth, god-rays rise from its own bright spots, caustic water-light plays over it; the pointer parts the lights and wakes them
// category: Light and prism
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

float ld_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ld_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ld_hash(i), ld_hash(i + vec2(1, 0)), f.x), mix(ld_hash(i + vec2(0, 1)), ld_hash(i + vec2(1, 1)), f.x), f.y);
}
float ld_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const vec3 LD_CYAN = vec3(0.45, 0.92, 1.0);
const vec3 LD_AMBER = vec3(1.0, 0.66, 0.25);
const vec3 LD_VIOLET = vec3(0.72, 0.52, 1.0);

// the lights drift along one slow current, a little up and to the right
const vec2 LD_DIR = vec2(0.342, -0.940);
const vec2 LD_PERP = vec2(0.940, 0.342);

// One depth layer of floating lights. The plane is rotated to the current and cut into cells; each cell holds at most one light that
// wobbles inside it. `sa` stretches the cell along the current (streak layers), `shape` stretches the light the same way.
// kind: 0 bokeh disc with a bright rim, 1 glowing mote with a faint glint, 2 streak with a bright head
vec4 ld_layer(vec2 p, float asp, float scale, float speed, float sa, float shape, float density, float rad, int kind, float seed, float boost) {
  float t = time;
  float a = dot(p, LD_DIR), b = dot(p, LD_PERP);
  vec2 q = vec2(a / sa, b) * scale;
  float colId = floor(q.y);
  q.x += t * speed + ld_hash(vec2(colId, seed)) * 17.0;       // every column of cells has its own phase
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 k = id + seed * 3.1;
  float h = ld_hash(k), h2 = ld_hash(k + 17.3), h3 = ld_hash(k + 41.7), h4 = ld_hash(k + 73.1);
  if (h > density) return vec4(0.0);
  vec2 c = (vec2(h2, h3) - 0.5) * 0.30;
  c += 0.07 * vec2(sin(t * 0.35 * (0.6 + h2) + h4 * 6.28), cos(t * 0.29 * (0.6 + h3) + h2 * 6.28));
  vec2 d = f - c;
  float r = rad * (0.55 + 0.9 * h4);
  float tw = 0.62 + 0.38 * sin(t * (0.8 + 2.2 * h3) + h * 60.0);   // each light breathes on its own beat
  float i = 0.0;
  if (kind == 0) {
    float rr = length(d);
    i = smoothstep(r, r * 0.55, rr) * (0.45 + 0.75 * smoothstep(r * 0.55, r * 0.95, rr)) * 0.55;
  } else if (kind == 1) {
    float rr = length(d);
    i = exp(-(rr * rr) / (r * r) * 3.0) * 0.9 + exp(-rr / (r * 0.35)) * 0.15;
    if (h4 > 0.78) {                                           // the brightest few catch a thin cross of light
      float g = exp(-abs(d.x) / (r * 0.12)) * exp(-abs(d.y) / (r * 2.4)) + exp(-abs(d.y) / (r * 0.12)) * exp(-abs(d.x) / (r * 2.4));
      i += g * 0.55;
    }
  } else {
    float dxn = d.x / r;                                       // along the current, in light radii; the head leads, the tail trails behind it
    float along = dxn > 0.0 ? exp(-dxn * dxn * 5.0) : exp(dxn / (shape * 0.5));
    i = along * exp(-pow(d.y / (r * 0.45), 2.0) * 2.0);
    i *= 0.55 + 0.45 * smoothstep(-1.0, 0.0, dxn);
    i += exp(-(dxn * dxn + pow(d.y / r, 2.0)) * 1.4) * 0.5;       // a small bright head
  }
  i *= tw * boost;
  // the light takes a saturated echo of the picture's own colour where it floats
  vec2 qc = id + 0.5 + c;
  qc.x -= t * speed + ld_hash(vec2(colId, seed)) * 17.0;
  vec2 pc = (qc.x * sa / scale) * LD_DIR + (qc.y / scale) * LD_PERP;
  vec2 uvc = clamp(vec2(pc.x / asp, pc.y), 0.0, 1.0);
  vec3 pic = wall(uvc);
  vec3 sat = pic / max(max(pic.r, max(pic.g, pic.b)), 0.18);
  vec3 pal = h2 < 0.55 ? LD_CYAN : (h2 < 0.88 ? LD_AMBER : LD_VIOLET);
  vec3 col = mix(pal, mix(sat, vec3(1.0), 0.2), 0.42);
  return vec4(col, i);
}

// caustic water-light: light bent by a moving surface above, a tiling net of bright threads
float ld_caustic(vec2 p, float t) {
  vec2 pp = p * 7.5 - 250.0;
  vec2 i = pp;
  float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = pp + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(pp.x / (sin(i.x + tt) / 0.006), pp.y / (cos(i.y + tt) / 0.006)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(clamp(abs(c), 0.0, 4.0), 8.0);
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;

  // ---- the pointer: lights are parted around it like a lens, and the ones close by wake up
  vec2 pm = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  vec2 dm = p - pm;
  float r2 = dot(dm, dm);
  float lens = exp(-r2 / 0.06);
  float wake = 1.0 + 2.2 * exp(-r2 / 0.09);

  // ---- the picture, bent a hair by the water-light above it
  vec3 base = wall(uv);
  float lum0 = ld_luma(base);
  float cs = ld_caustic(p, t * 0.22);
  float csDepth = 0.30 + 0.70 * (1.0 - uv.y);                  // the light comes from above and thins out downward
  float cl = cs * csDepth * 1.5;
  vec2 off = vec2(cs - 0.5, ld_caustic(p + 0.07, t * 0.22) - 0.5) * 0.0016;
  vec3 col = wall(uv + off);
  vec3 dark = vec3(0.92, 0.985, 1.04);
  col = mix(col, col * dark + vec3(0.0, 0.010, 0.018), 0.55 * (1.0 - lum0));   // deep water tint, mostly in the shadows
  vec3 fl = vec3(0.0);
  fl += LD_CYAN * cl * (0.10 + 0.14 * (1.0 - lum0));
  fl += vec3(0.30, 0.38, 0.40) * cl * 0.05;

  fl += mix(LD_CYAN, vec3(1.0, 0.9, 0.75), 0.4) * exp(-r2 / 0.022) * 0.09;   // a soft pool of light travels with the pointer

  // ---- god-rays from the picture's own bright spots: find where the light sits, then pull the bright parts toward it
  vec2 lc = vec2(0.0);
  float lw = 0.0;
  for (int j = 0; j < 3; j++) {
    for (int ii = 0; ii < 4; ii++) {
      vec2 g = vec2((float(ii) + 0.5) / 4.0, (float(j) + 0.35) / 3.0);
      float w = pow(ld_luma(wall(g)), 3.0) + 0.002;
      lc += g * w; lw += w;
    }
  }
  lc /= lw;
  lc = mix(vec2(0.62, 0.12), lc, 0.85);
  vec2 toL = lc - uv;
  float dl = length(toL * vec2(asp, 1.0));
  float jit = fract(52.9829189 * fract(dot(uv * res, vec2(0.06711056, 0.00583715))));
  float ray = 0.0;
  for (int s = 0; s < 8; s++) {
    float u = (float(s) + jit) / 8.0;
    vec3 w = wall(uv + toL * u * 0.9);
    ray += smoothstep(0.20, 0.62, ld_luma(w)) * (1.0 - u * 0.75);
  }
  ray /= 8.0;
  float ang = atan(toL.y * 1.0, toL.x * asp);
  float shaft = 0.55 + 0.45 * ld_noise(vec2(ang * 5.0 + t * 0.05, 3.0)) * ld_noise(vec2(ang * 11.0 - t * 0.04, 9.0)) * 2.0;
  float rays = ray * shaft * smoothstep(0.0, 0.25, dl) * (0.35 + 0.65 * (1.0 - uv.y));
  fl += mix(LD_CYAN, vec3(1.0, 0.93, 0.80), 0.45) * rays * 0.62;

  // ---- floating lights in four depths, nearest ones move most and are bent most by the pointer
  vec3 add = vec3(0.0);
  vec2 pf = p - dm * lens * 0.9;                              // far: barely bent
  vec2 pn = p - dm * lens * 1.4;
  vec2 pk = p - dm * lens * 1.8;                              // near: bent most
  vec4 l0 = ld_layer(pf, asp, 3.0, 0.022, 1.0, 1.0, 0.62, 0.30, 0, 1.0, 1.0);
  vec4 l1 = ld_layer(pn, asp, 7.5, 0.045, 1.0, 1.0, 0.50, 0.075, 1, 2.0, wake);
  vec4 l2 = ld_layer(pk, asp, 14.0, 0.075, 1.0, 1.0, 0.36, 0.040, 1, 3.0, wake);
  vec4 l3 = ld_layer(pk, asp, 6.0, 0.11, 12.0, 4.0, 0.32, 0.032, 2, 4.0, 1.0 + 0.7 * (wake - 1.0));
  // far bokeh sits in the dark and fades over bright ground; near lights stay
  float darkAt = 1.0 - 0.55 * smoothstep(0.35, 0.85, lum0);
  add += l0.rgb * l0.a * 1.15 * darkAt;
  float inRay = 1.0 + 2.2 * clamp(rays * 1.6, 0.0, 1.0);        // lights inside a shaft catch it and burn brighter
  add += l1.rgb * l1.a * 1.5 * inRay;
  add += l2.rgb * l2.a * 1.5 * inRay;
  add += l3.rgb * l3.a * 1.6;

  // ---- put it together: light is added the way light is, with a soft shoulder so bright pictures do not clip
  vec3 light = fl + add;
  col = 1.0 - (1.0 - col) * (1.0 - clamp(light, 0.0, 0.92));
  return vec4(clamp(col, 0.0, 1.0), 1.0) * qt_Opacity;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored, above 1 = exaggerated
void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
