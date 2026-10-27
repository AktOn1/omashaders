// label: Wolf moon
// hint: a winter moon laid over your own picture: a painted moon finds the brightest part of your sky and sends slow rings of light across it, a wolf howls on the dark bottom edge between pines and bare branches, fog banks drift along the floor and part around the pointer, and everything is cooled a little. No scenery: your picture stays the picture
// category: Dark tales
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
layout(binding = 2) uniform sampler2D sprites; // wolfmoon.png: 4 x 2 cells of 256 px (moon, wolf, pines, pines, owl, branch, branch)

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales

float wm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float wm_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wm_h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float wm_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wm_h(i), wm_h(i + vec2(1.0, 0.0)), f.x), mix(wm_h(i + vec2(0.0, 1.0)), wm_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wm_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * wm_n(p); p = p * 2.07 + 13.1; a *= 0.5; }
  return v;
}

// where a sprite cell sits in the 4 x 2 atlas; q runs -1..1 inside the cell
vec2 wm_cuv(float cell, vec2 q) {
  return (vec2(mod(cell, 4.0), floor(cell / 4.0)) + 0.5 + q * 0.453) / vec2(4.0, 2.0);
}

// how bright the picture is around a point: three taps, so the moon can look for open sky
float wm_probe(vec2 uv) {
  return (wm_luma(wall(uv)) + wm_luma(wall(uv + vec2(0.055, 0.035))) + wm_luma(wall(uv + vec2(-0.050, 0.040)))) / 3.0;
}

// the few painted objects: x, y (fractions of the screen), radius (fraction of the screen height), atlas cell
vec4 wm_spot(int i) {
  if (i == 0) return vec4(0.175, 0.890, 0.125, 1.0);   // the wolf, on the dark lower edge
  if (i == 1) return vec4(0.042, 0.905, 0.125, 2.0);   // pines, left edge
  if (i == 2) return vec4(0.962, 0.945, 0.118, 3.0);   // pines, right edge
  if (i == 3) return vec4(0.101, 0.138, 0.044, 4.0);   // a small owl sitting on the left branch
  if (i == 4) return vec4(-0.010, 0.135, 0.205, 5.0);  // a bare branch reaching in from the left edge
  return vec4(1.022, 0.178, 0.195, 6.0);               // a bare branch leaning in from the top right
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? vec2(mpx.x / res.y, mpx.y / res.y) : vec2(-20.0);
  vec2 par = has ? (vec2(mpx.x / res.x, mpx.y / res.y) - 0.5) : vec2(0.0);

  vec3 pic = wall(uv);
  float pl = wm_luma(pic);
  // the sky part of the picture: open, brighter, higher up. Everything airy is keyed to it
  float sky = smoothstep(0.14, 0.52, pl) * (0.30 + 0.70 * smoothstep(0.95, 0.30, uv.y));

  // ---- the moon goes to the brightest of three places in the upper half of the picture
  vec2 c0 = vec2(0.705, 0.205), c1 = vec2(0.482, 0.145), c2 = vec2(0.296, 0.252);
  float b0 = wm_probe(c0), b1 = wm_probe(c1) * 0.98, b2 = wm_probe(c2) * 0.96;
  vec2 mc = b0 >= b1 ? (b0 >= b2 ? c0 : c2) : (b1 >= b2 ? c1 : c2);
  float moonR = 0.098;
  vec2 moonP = vec2(mc.x * asp, mc.y) + par * 0.016 * vec2(-1.0, -1.0);
  float dM = length(p - moonP);

  // ---- the pointer pushes the fog and the motes away from itself
  vec2 dmv = p - mp;
  float dmd = length(dmv);
  vec2 dir = dmv / max(dmd, 0.001);
  float fall = has ? exp(-dmd / 0.26) : 0.0;
  vec2 push = dir * 0.12 * fall + vec2(-dir.y, dir.x) * 0.05 * fall;
  float part = has ? exp(-dmd * dmd / 0.050) : 0.0;

  // ---- the cool moonlit grade: your picture, a little darker and a little blue
  vec3 cool = pic * vec3(0.88, 0.93, 1.06);
  cool = mix(cool, vec3(wm_luma(cool)), 0.18);
  vec3 col = cool * 0.915 + vec3(0.010, 0.014, 0.028);
  // the lower end of the picture sinks a touch deeper than the upper end
  col *= 1.0 - 0.085 * smoothstep(0.45, 1.0, uv.y);

  // ---- thin cloud strips drifting across the moon
  float cs = wm_fbm(vec2(p.x * 1.05 - t * 0.016, (p.y - moonP.y) * 8.5 + 5.0));
  float strip = smoothstep(0.50, 0.80, cs) * exp(-pow((p.y - moonP.y - 0.015) / 0.17, 2.0));
  float cloud = strip * (0.35 + 0.65 * sky);

  // ---- a large soft halo around the moon, lying on the picture
  float halo = exp(-max(dM - moonR, 0.0) / 0.34) * 0.52 + exp(-max(dM - moonR, 0.0) / 0.085) * 0.40;
  float near = has ? exp(-pow(length(mp - moonP) / 0.45, 2.0)) : 0.0;   // it swells when the pointer comes near
  vec3 moonCol = vec3(0.70, 0.79, 1.00);
  col += moonCol * halo * (0.30 + 0.45 * sky) * (0.85 + 0.35 * near) * (1.0 - 0.30 * cloud);

  // ---- two slow rings of light leaving the moon, strongest where the sky is open
  float ringSum = 0.0;
  for (int k = 0; k < 2; k++) {
    float ph = fract(t / 11.0 + float(k) * 0.5);
    float rr = moonR * 1.05 + 1.30 * pow(ph, 0.78);
    float rw = 0.022 + 0.085 * ph;
    float ri = pow(1.0 - ph, 1.7) * smoothstep(0.0, 0.05, ph);
    ringSum += exp(-pow((dM - rr) / rw, 2.0)) * ri;
    ringSum += exp(-pow((dM - rr * 0.78) / (rw * 1.35), 2.0)) * ri * 0.30;
  }
  float ringLit = ringSum * (0.25 + 0.75 * sky) * (0.90 + 0.40 * near);
  col += moonCol * ringLit * 0.30;
  // the cloud strips catch the halo and the rings
  col += vec3(0.62, 0.70, 0.90) * cloud * (0.055 + 0.10 * halo + 0.12 * ringSum);

  // ---- fog banks lying along the floor, parting around the pointer
  vec2 pf1 = p - push * 1.15;
  float f1 = wm_fbm(vec2(pf1.x * 1.15 - t * 0.021, pf1.y * 3.1 + 2.0) + wm_fbm(pf1 * 1.7 + t * 0.012) * 0.65);
  float band1 = smoothstep(0.70, 0.98, uv.y);
  float fog1 = smoothstep(0.33, 0.72, f1) * band1 * (1.0 - 0.88 * part);
  vec2 pf2 = p - push * 0.8;
  float f2 = wm_fbm(vec2(pf2.x * 0.95 + t * 0.014, pf2.y * 2.6 + 9.0));
  float band2 = smoothstep(0.60, 0.80, uv.y) * smoothstep(0.98, 0.84, uv.y);
  float fog2 = smoothstep(0.42, 0.78, f2) * band2 * (1.0 - 0.80 * part);
  vec3 fogC = vec3(0.33, 0.40, 0.56) + moonCol * (0.10 + 0.22 * halo + 0.30 * ringSum);
  float fog = clamp(fog1 * 0.46 + fog2 * 0.30, 0.0, 0.70);
  col = mix(col, fogC, fog);

  // ---- the painted objects: they stand in the fog, so it only half veils them
  for (int i = 0; i < 6; i++) {
    vec4 sp = wm_spot(i);
    float r = sp.z;
    // the owl rides the branch it sits on: same drift, same sway
    float fi = i == 3 ? 4.0 : float(i);
    float dr = i == 3 ? 0.205 : r;
    vec2 home = vec2(sp.x * asp, sp.y);
    float depth = 0.35 + 0.65 * smoothstep(0.04, 0.17, dr);
    home += par * depth * 0.026 * vec2(-1.0, -1.0);
    float sway = i == 0 ? 0.20 : 1.0;                               // the wolf holds still, the trees breathe
    home += vec2(0.0040 * sin(t * 0.31 + fi * 1.7), 0.0022 * sin(t * 0.47 + fi * 2.3)) * sway;
    vec2 q0 = p - home;
    if (abs(q0.x) < r && abs(q0.y) < r) {
      vec2 q = q0 / r;
      if (i == 2 || i == 4 || i == 5) q.x = -q.x;                   // mirrored copies
      vec4 s = texture(sprites, wm_cuv(sp.w, q));
      if (s.a > 0.004) {
        // the edge that faces the moon catches a cold rim light
        vec2 toMoon = normalize(moonP - home + vec2(0.0001));
        vec2 rq = q + toMoon * 0.028;
        float aOff = (abs(rq.x) < 1.0 && abs(rq.y) < 1.0) ? texture(sprites, wm_cuv(sp.w, rq)).a : 0.0;
        float rim = clamp(s.a - aOff, 0.0, 1.0);
        float lit = 0.55 + 0.45 * sky + 0.6 * ringSum;
        // the painting sinks into the night, pale bark and frost deepest of all
        float slum = wm_luma(s.rgb);
        vec3 pc = mix(s.rgb, vec3(0.045, 0.058, 0.105), 0.60 + 0.34 * smoothstep(0.24, 0.72, slum));
        pc *= vec3(0.80, 0.88, 1.08);
        pc += moonCol * rim * 0.40 * lit;
        // the wolf answers the pointer: it lights up when the pointer comes to it
        if (i == 0) {
          float wn = has ? exp(-pow(length(mp - home) / 0.28, 2.0)) : 0.0;
          pc += moonCol * (rim * 0.70 + 0.10) * wn;
        }
        pc = mix(pc, fogC, fog * 0.58);                             // the fog lies around them, not over them
        col = mix(col, pc, s.a * 0.94);
      }
    }
  }

  // ---- the moon itself, painted, with a thin ring of light round its rim
  vec2 mq = (p - moonP) / moonR;
  if (abs(mq.x) < 1.0 && abs(mq.y) < 1.0) {
    vec4 s = texture(sprites, wm_cuv(0.0, mq));
    if (s.a > 0.004) {
      vec3 dc = s.rgb * vec3(0.96, 0.98, 1.04) * (0.92 + 0.14 * ringSum);
      dc = mix(dc, dc * vec3(0.80, 0.86, 0.98) + vec3(0.06, 0.07, 0.10), cloud * 0.45);
      col = mix(col, dc, s.a);
    }
  }
  col += moonCol * exp(-pow((dM - moonR * 1.02) / (moonR * 0.10), 2.0)) * 0.22 * (0.6 + 0.4 * sky);

  // ---- a last thin wisp of fog drifting in front of everything
  col = mix(col, fogC, fog * fog * 0.30);

  // ---- a few frost motes drifting up through the moonlight
  for (int k = 0; k < 12; k++) {
    float fk = float(k);
    float sp2 = 0.020 + 0.030 * wm_h1(fk + 2.0);
    float life = fract(t * sp2 + wm_h1(fk * 5.3));
    float lane = wm_h1(fk * 1.7) * asp;
    vec2 e = vec2(lane + 0.07 * sin(t * (0.25 + 0.2 * wm_h1(fk)) + fk), 1.02 - life * (0.55 + 0.35 * wm_h1(fk + 7.0)));
    vec2 de = e - mp;
    float dl = length(de);
    e += de / (dl + 0.04) * 0.055 * (has ? exp(-pow(dl / 0.17, 2.0)) : 0.0);
    float sz = 0.0022 + 0.0020 * wm_h1(fk + 11.0);
    float a = exp(-dot(p - e, p - e) / (sz * sz)) * smoothstep(0.0, 0.10, life) * smoothstep(1.0, 0.60, life);
    col += moonCol * a * (0.55 + 0.45 * sin(t * 2.1 + fk * 2.0)) * 0.80;
  }

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
