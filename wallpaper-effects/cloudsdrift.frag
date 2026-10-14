// label: Drifting clouds
// hint: thin pale clouds drifting through the upper sky, lit from the side, with faint shadows
// category: Sun and sky
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



float cd_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 cd_bright() {
  vec3 b = vec3(0.0); float bl = -1.0;
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      vec3 s = wall(vec2(0.2 + 0.3 * float(i), 0.15 + 0.3 * float(j)));
      float l = cd_lum(s);
      if (l > bl) { bl = l; b = s; }
    }
  }
  return b;
}
// cloud density field: wide drifting layer, stretched sideways, with a few octaves of detail
float cd_field(vec2 p, int oct) {
  vec2 c = vec2(p.x * 1.5 + time * 0.022, p.y * 3.2 + time * 0.004);
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    if (i >= oct) break;
    v += a * noise(c);
    c = c * 2.07 + vec2(11.3, 5.1);
    a *= 0.5;
  }
  return v / (1.0 - pow(0.5, float(oct)));
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec3 col = wall(uv);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);

  vec3 b = cd_bright();
  vec3 tn = b / max(max(b.r, max(b.g, b.b)), 0.05);
  vec3 pale = mix(vec3(1.0, 0.99, 0.97), tn, 0.30);          // sunlit cloud tone: white pulled toward the picture's brightest colour
  vec3 dusk = mix(vec3(0.90, 0.92, 0.97), tn * 0.95, 0.20);  // shaded side

  // thin clouds in the upper half, fading out towards the middle of the picture
  float zone = smoothstep(0.70, 0.12, uv.y + 0.10 * (noise(vec2(p.x * 1.2 + time * 0.01, 7.0)) - 0.5));
  float pd = length(p - mp);
  float push = 1.0 - 0.45 * exp(-pd * pd / (2.0 * 0.13 * 0.13));   // the pointer thins the clouds a little
  float n0 = cd_field(p, 4);
  float d = smoothstep(0.42, 0.64, n0) * zone * push;
  // side lighting: compare with the density a short step toward the light (upper right)
  vec2 ld = vec2(0.045, -0.03);
  float n1 = cd_field(p + ld, 3);
  float d1 = smoothstep(0.42, 0.64, n1) * zone;
  float rim = clamp((d - d1) * 3.5 + 0.35, 0.0, 1.0);        // bright where the cloud faces the light
  float body = 0.68 + 0.32 * rim;

  vec3 cc = mix(dusk, pale, body);
  float a = clamp(d * 0.80, 0.0, 0.70);
  // translucent: the cloud colour is lifted in, never below the picture
  vec3 lifted = max(cc, col * 0.97);
  col = mix(col, lifted, a);
  col *= 1.0 - 0.04 * d * (1.0 - rim);                       // a touch of shading on the side away from the light
  col += pale * pow(rim, 2.0) * d * 0.16;                    // silver lining on the lit edges

  // soft cloud shadows sliding over the lower half (at most ~7 %)
  float sn = noise(vec2(p.x * 1.1 + time * 0.020, p.y * 1.6 + 3.0)) * 0.65 + noise(vec2(p.x * 2.3 + time * 0.022, p.y * 3.1 - 5.0)) * 0.35;
  float sh = smoothstep(0.50, 0.78, sn) * smoothstep(0.42, 0.75, uv.y);
  col *= 1.0 - 0.07 * sh;
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
