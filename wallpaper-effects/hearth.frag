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


float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
vec3 fireRamp(float v) {
  vec3 c = mix(vec3(0.0), vec3(0.55, 0.05, 0.0), smoothstep(0.0, 0.25, v));
  c = mix(c, vec3(1.0, 0.35, 0.02), smoothstep(0.2, 0.55, v));
  c = mix(c, vec3(1.0, 0.78, 0.18), smoothstep(0.5, 0.8, v));
  c = mix(c, vec3(1.0, 0.97, 0.75), smoothstep(0.8, 1.05, v));
  return c;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  float flick = 0.86 + 0.10 * noise(vec2(time * 5.0, 1.0)) + 0.06 * sin(time * 2.3 + 1.0 * sin(time * 0.7));
  vec2 fp = vec2((uv.x - 0.5) * asp, 1.0 - uv.y);
  float lean = clamp((m.x - 0.5), -0.5, 0.5) * 0.22;
  vec2 q = vec2(fp.x - lean * fp.y * 2.0, fp.y);

  // wall lit by the fire: warm, falling off from the hearth
  vec2 toFire = vec2(fp.x, fp.y + 0.10);
  float lit = exp(-length(toFire * vec2(0.9, 1.15)) * 1.9) * flick;
  vec3 wcol = wall(uv);
  vec3 col = wcol * vec3(0.58, 0.50, 0.47);   // the picture stays readable, a little dimmer
  col += wcol * vec3(1.15, 0.62, 0.30) * lit * 1.1;
  col += vec3(1.0, 0.35, 0.08) * 0.10 * lit;

  // flames
  float n1 = fbm(vec2(q.x * 3.6, q.y * 2.4 - time * 1.35));
  float n2 = fbm(vec2(q.x * 7.5 + 3.0, q.y * 4.6 - time * 2.3));
  float width = exp(-q.x * q.x / 0.075);
  float reach = 0.44 * (0.2 + 0.8 * width);
  float body = 1.0 - q.y / reach;
  float fl = body + (n1 - 0.5) * 0.95 + (n2 - 0.5) * 0.45 - 0.12;
  fl *= width * 0.9 + 0.35;
  float flame = smoothstep(0.0, 0.45, fl);
  float coreHeat = clamp(fl * 1.05, 0.0, 1.2);
  vec3 fcol = fireRamp(coreHeat);
  col = mix(col, fcol * 1.15 + col * 0.3, flame * smoothstep(0.0, 0.04, fl) * 0.62);   // light on the picture, not a solid shape
  col += fcol * 0.35 * smoothstep(-0.3, 0.3, fl) * width;

  // logs and coals
  float l1 = capsule(vec2(fp.x, fp.y), vec2(-0.30, 0.030), vec2(0.27, 0.060), 0.026);
  float l2 = capsule(vec2(fp.x, fp.y), vec2(-0.26, 0.062), vec2(0.30, 0.026), 0.024);
  float logD = min(l1, l2);
  float logMask = smoothstep(0.014, -0.010, logD);
  float grain = 0.5 + 0.5 * noise(vec2(fp.x * 90.0, fp.y * 14.0));
  vec3 logCol = vec3(0.07, 0.035, 0.02) * (0.6 + 0.8 * grain);
  logCol += vec3(1.0, 0.40, 0.08) * 0.35 * exp(-max(logD, 0.0) * 40.0) * flick * (0.4 + 0.6 * n2);
  col = mix(col, col * 0.35 + logCol * 0.5, logMask * 0.45);   // logs are a soft shadow, not a black bar
  float coalN = noise(vec2(fp.x * 38.0, fp.y * 38.0 + 3.0)) * noise(vec2(fp.x * 13.0 + time * 0.3, fp.y * 20.0));
  float coalZone = smoothstep(0.075, 0.0, fp.y) * exp(-fp.x * fp.x / 0.12);
  float pulse = 0.65 + 0.35 * sin(time * 1.7 + coalN * 25.0);
  col += vec3(1.0, 0.30, 0.04) * pow(coalN * 2.2, 2.0) * coalZone * pulse * (1.0 - logMask * 0.6);

  // rising sparks
  vec3 sp = vec3(0.0);
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float life = 3.0 + 2.5 * hash(vec2(fi, 2.2));
    float ph = fract(time / life + hash(vec2(fi, 8.8)));
    float sd = floor(time / life + hash(vec2(fi, 8.8))) * 3.7 + fi;
    vec2 pos = vec2((hash(vec2(sd, 1.0)) - 0.5) * 0.35, 0.06 + ph * (0.5 + 0.5 * hash(vec2(sd, 2.0))));
    pos.x += 0.05 * sin(ph * 9.0 + fi * 2.0) * ph + lean * ph * 0.8;
    float dd = length(fp - pos);
    float tw = 0.6 + 0.4 * sin(time * 12.0 + fi * 4.0);
    sp += vec3(1.0, 0.55, 0.15) * exp(-dd * dd / 0.000012) * (1.0 - ph) * tw;
    sp += vec3(1.0, 0.35, 0.08) * exp(-dd * dd / 0.00028) * (1.0 - ph) * 0.25;
  }
  col += sp;
  float vig = 1.0 - 0.38 * pow(length((uv - 0.5) * vec2(1.0, 1.0)), 2.0) * 1.6;
  col *= vig;
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
