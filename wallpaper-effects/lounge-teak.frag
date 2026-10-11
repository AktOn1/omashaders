// label: Seventies lounge
// hint: teak paneling, an orange shag floor and a swag lamp that leans toward the pointer
// category: Places and eras
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
float lt_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lt_h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float lt_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lt_h2(i), lt_h2(i + vec2(1, 0)), f.x), mix(lt_h2(i + vec2(0, 1)), lt_h2(i + vec2(1, 1)), f.x), f.y);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  float t = time;

  vec3 pic = wall(uv);
  float lum = dot(pic, vec3(0.299, 0.587, 0.114));

  // ---- the swag lamp: a globe hanging from the ceiling on a long cable; it swings a little and leans toward the pointer
  vec2 att = vec2(0.20 * asp, -0.02);
  float cableL = 0.25;
  float lean = clamp((mp.x - att.x) * 0.6, -0.30, 0.30) * smoothstep(1.3, 0.3, abs(mp.x - att.x));
  float ang = 0.035 * sin(t * 0.7) + 0.02 * sin(t * 1.3 + 1.0) + lean * (mpx.x > -5000.0 ? 1.0 : 0.0);
  vec2 lamp = att + vec2(sin(ang), cos(ang)) * cableL;
  float gr = 0.058;

  // ---- paneling: vertical planks with dark grooves, long wavy grain, each plank a slightly different shade
  float pw = 0.072;
  float pid = floor(p.x / pw);
  float pf = fract(p.x / pw);
  float shade = 0.82 + 0.34 * lt_h1(pid + 3.0);
  float gx = p.x * 46.0 + lt_h1(pid) * 40.0;
  float grain = lt_noise(vec2(gx * 0.55 + lt_noise(vec2(gx * 0.2, p.y * 2.0)) * 3.0, p.y * 2.2 + lt_h1(pid) * 9.0));
  float fine = lt_noise(vec2(gx * 1.7, p.y * 28.0 + lt_h1(pid + 5.0) * 20.0));
  vec3 wood = mix(vec3(0.20, 0.095, 0.040), vec3(0.42, 0.215, 0.085), grain * 0.75 + fine * 0.25) * shade;
  float groove = smoothstep(0.045, 0.0, pf) + smoothstep(0.955, 1.0, pf) * 0.5;
  wood *= 1.0 - 0.75 * smoothstep(0.03, 0.0, pf);
  wood += vec3(0.10, 0.05, 0.02) * smoothstep(0.02, 0.07, pf) * smoothstep(0.12, 0.05, pf) * 0.7;          // a lit edge right of each groove
  // a visible trace of the wallpaper picture shows through as light variation
  vec3 col = wood * (0.78 + 0.55 * lum) * (0.92 + 0.16 * vec3(pic.r, pic.g * 0.7, pic.b * 0.3)) * 1.35;

  // ---- wall art: three-colour bullseye, warm 1970s sun
  vec2 ac = vec2(0.80 * asp, 0.36);
  float ad = length(p - ac);
  float ring = ad / 0.15;
  vec3 art = ring < 0.30 ? vec3(0.92, 0.80, 0.52)
           : ring < 0.55 ? vec3(0.86, 0.42, 0.08)
           : ring < 0.80 ? vec3(0.78, 0.60, 0.10)
           : ring < 1.00 ? vec3(0.30, 0.34, 0.10) : vec3(0.0);
  float amask = smoothstep(1.0, 0.985, ring);
  art *= 0.78 + 0.20 * lt_noise(p * 90.0);                      // canvas
  col = mix(col, art * 0.80, amask * 0.9);
  col = mix(col, vec3(0.06, 0.03, 0.015), smoothstep(0.02, 0.0, abs(ring - 1.015)) * 0.8);

  // ---- the floor: orange shag carpet, a skirting board above it
  float fy = 0.835;
  float onFloor = smoothstep(fy, fy + 0.004, uv.y);
  float fibre = lt_noise(p * vec2(240.0, 200.0)) * 0.6 + lt_noise(p * vec2(520.0, 460.0) + 7.0) * 0.4;
  float tuft = lt_noise(p * vec2(60.0, 42.0) + 3.0);
  vec3 shag = mix(vec3(0.36, 0.13, 0.03), vec3(0.88, 0.42, 0.08), fibre * 0.7 + tuft * 0.3) * (0.80 + 0.30 * lum);
  float skirt = smoothstep(fy - 0.035, fy - 0.03, uv.y) * smoothstep(fy + 0.001, fy - 0.004, uv.y);
  col = mix(col, vec3(0.13, 0.062, 0.028) * (0.8 + 0.4 * grain), skirt);
  col = mix(col, shag, onFloor);
  col *= 1.0 - 0.38 * smoothstep(fy, 1.0, uv.y) * 0.0;

  // ---- the light of the lamp: a warm pool on the paneling, a cone downward, the floor catches it too
  vec2 dl = p - lamp;
  float dd = length(dl);
  float pool = exp(-dd * dd / (2.0 * 0.32 * 0.32));
  float cone = smoothstep(0.0, 0.45, dl.y) * exp(-pow(dl.x / (0.10 + 0.55 * max(dl.y, 0.0)), 2.0)) * 0.9;
  float lit = pool * 0.9 + cone * 0.7;
  float ambient = 0.72;
  col *= ambient + 1.10 * lit;
  col += vec3(1.0, 0.55, 0.16) * (pool * 0.22 + cone * 0.12);

  // the globe: milky orange glass, hot in the middle, a bright spot of reflected window
  float gd = length(p - lamp) / gr;
  float cableD = abs(dot(p - att, vec2(cos(ang), -sin(ang))));
  float cable = smoothstep(0.0016, 0.0005, cableD) * step(p.y, lamp.y - gr * 0.9) * step(att.y, p.y);
  col = mix(col, vec3(0.03, 0.02, 0.015), cable * 0.9);
  vec3 glass = mix(vec3(1.0, 0.88, 0.50), vec3(1.0, 0.45, 0.07), smoothstep(0.1, 0.95, gd));
  float gmask = smoothstep(1.0, 0.94, gd);
  col = mix(col, glass * 1.05, gmask);
  col += vec3(1.0, 0.95, 0.85) * smoothstep(0.30, 0.0, length((p - lamp) / gr - vec2(-0.35, -0.40))) * gmask * 0.5;
  col += vec3(1.0, 0.45, 0.10) * exp(-gd * gd * 0.35) * 0.20 * (1.0 - gmask);          // glow right around the globe
  // the cap of the lamp
  float capD = smoothstep(0.004, 0.0, max(abs(p.x - lamp.x) - gr * 0.28, abs(p.y - (lamp.y - gr * 1.02)) - gr * 0.12));
  col = mix(col, vec3(0.05, 0.04, 0.035), capD);

  col *= 1.0 - 0.42 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
