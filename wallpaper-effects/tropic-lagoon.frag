// label: Tropic lagoon
// hint: a turquoise lagoon under a bright sky, a white beach where the waves slide in and out, rings on the water where the pointer touches it
// category: Wild places
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
float tl_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tl_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tl_hash(i), tl_hash(i + vec2(1, 0)), f.x), mix(tl_hash(i + vec2(0, 1)), tl_hash(i + vec2(1, 1)), f.x), f.y);
}
float tl_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * tl_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float tl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

const float TL_HZ = 0.40;

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 w = wall(uv);

  // the shoreline: a lazy curve, the swash breathes in and out
  float swash = 0.012 * sin(t * 0.55) + 0.006 * sin(t * 1.3 + p.x * 3.0);
  float shore = 0.80 + 0.045 * sin(p.x * 2.1 + 0.8) + 0.02 * sin(p.x * 5.3) + swash;

  vec3 col;
  if (uv.y < TL_HZ) {
    // ---- sky: clear blue, soft cumulus, a bright sun over the sea
    vec3 sky = mix(vec3(0.16, 0.52, 0.92), vec3(0.72, 0.90, 0.98), pow(smoothstep(0.0, TL_HZ, uv.y), 1.4));
    vec2 sunC = vec2(0.68 * asp, 0.16);
    float ds = length(p - sunC);
    sky += vec3(1.0, 0.96, 0.82) * (exp(-ds * ds / 0.0022) * 0.9 + exp(-ds * ds / 0.04) * 0.2);
    float cl = tl_fbm(vec2(p.x * 2.0 + t * 0.006, uv.y * 4.4) * 1.0 + 3.0);
    float cm = smoothstep(0.52, 0.72, cl + (0.12 - uv.y) * 0.4 * 0.0 + 0.10 * (1.0 - uv.y / TL_HZ));
    float cshade = tl_fbm(vec2(p.x * 2.0 + t * 0.006 + 0.07, uv.y * 4.4 - 0.1) + 3.0);
    vec3 cc = mix(vec3(0.78, 0.84, 0.92), vec3(1.0, 0.99, 0.96), smoothstep(0.35, 0.6, cshade + 0.15));
    sky = mix(sky, cc, cm * 0.82 * smoothstep(0.0, 0.08, uv.y));
    col = sky;
    // a far green island, low and hazy
    float isl = TL_HZ - 0.028 * smoothstep(0.0, 0.5, tl_noise(vec2(p.x * 5.0 + 2.0, 1.0))) * smoothstep(0.1 * asp, 0.3 * asp, p.x) * smoothstep(0.62 * asp, 0.38 * asp, p.x)
              - 0.012 * tl_noise(vec2(p.x * 40.0, 3.0)) * smoothstep(0.1 * asp, 0.3 * asp, p.x) * smoothstep(0.62 * asp, 0.38 * asp, p.x);
    if (uv.y > isl) col = mix(vec3(0.20, 0.45, 0.42), vec3(0.45, 0.70, 0.68), 0.4);
    // a small white sail near the horizon
    vec2 sd = p - vec2(0.80 * asp, TL_HZ - 0.020);
    float sail = step(0.0, sd.y + 0.026) * step(sd.y, 0.0) * step(abs(sd.x - 0.004) * 1.0, 0.0125 * (sd.y + 0.026) / 0.026) * step(0.0, sd.x + 0.006 + (sd.y + 0.026) * 0.0);
    col = mix(col, vec3(1.0, 0.98, 0.94), sail * 0.95);
    col = mix(col, vec3(0.30, 0.22, 0.18), step(abs(sd.x), 0.016) * step(abs(sd.y + 0.001), 0.0016) * 0.8);
  } else if (uv.y < shore) {
    // ---- the lagoon: deep blue at the horizon, bright turquoise over the sand flats near the beach
    float dn = (uv.y - TL_HZ) / (shore - TL_HZ);                  // 0 at the horizon, 1 at the shoreline
    float persp = 1.0 / (dn * 0.9 + 0.08);
    // pointer rings
    vec2 dpm = (p - mp) * vec2(1.0, 2.2);
    float dm = length(dpm);
    float ring = sin(dm * 130.0 - t * 3.2) * exp(-dm * 6.0);
    vec2 q = vec2(p.x * persp * 0.9 + t * 0.04, persp * 0.35 + t * 0.03 + ring * 0.02);
    float wv = tl_fbm(q * 2.6);
    float sandbar = tl_fbm(vec2(p.x * 2.4 + 4.0, dn * 4.0 + 1.0));
    float sb = smoothstep(0.50, 0.68, sandbar) * smoothstep(0.1, 0.55, dn);
    vec3 c0 = vec3(0.02, 0.26, 0.46);
    vec3 c1 = vec3(0.00, 0.56, 0.70);
    vec3 c2 = vec3(0.12, 0.82, 0.78);
    vec3 c3 = vec3(0.62, 0.96, 0.86);
    col = mix(c0, c1, smoothstep(0.0, 0.30, dn));
    col = mix(col, c2, smoothstep(0.25, 0.70, dn));
    col = mix(col, c3, smoothstep(0.75, 1.0, dn) * 0.8);
    col = mix(col, vec3(0.50, 0.90, 0.80), sb * 0.55);               // pale sandbars show through
    col *= 0.88 + 0.22 * wv;
    // light caustics on the shallow bed
    float cs = tl_noise(vec2(q.x * 7.0, q.y * 7.0) + wv * 2.0);
    float caus = pow(1.0 - abs(cs * 2.0 - 1.0), 8.0);
    col += vec3(0.75, 1.0, 0.95) * caus * smoothstep(0.35, 0.9, dn) * 0.22;
    // sky reflected near the horizon (fresnel), a glitter path under the sun
    col = mix(col, vec3(0.62, 0.82, 0.95), pow(1.0 - smoothstep(0.0, 0.35, dn), 2.0) * 0.45);
    float gp = exp(-pow((p.x - 0.68 * asp) / (0.03 + 0.20 * dn), 2.0));
    float gl = tl_noise(vec2(p.x * 90.0, uv.y * 260.0 - t * 0.8));
    col += vec3(1.0, 0.97, 0.85) * smoothstep(0.72, 0.95, gl) * gp * 0.65;
    col += vec3(0.9, 1.0, 1.0) * max(ring, 0.0) * 0.14;
  } else {
    // ---- beach: wet then dry white sand, foam where the water ends
    float dsh = uv.y - shore;                                      // pixels below the water line
    float fm = tl_fbm(vec2(p.x * 38.0, dsh * 160.0 - t * 0.2));
    float foam = smoothstep(0.030, 0.0, dsh + 0.006 * tl_noise(vec2(p.x * 30.0, t * 0.5))) * (0.85 + 0.8 * fm);
    float wet = smoothstep(0.075, 0.0, dsh);
    vec3 dry = mix(vec3(0.96, 0.90, 0.76), vec3(0.88, 0.78, 0.62), smoothstep(0.0, 0.25, dsh));
    dry *= 0.95 + 0.10 * tl_noise(vec2(p.x * 160.0, uv.y * 160.0));
    vec3 wets = vec3(0.62, 0.55, 0.44);
    col = mix(dry, wets, wet * 0.8);
    // a glassy sheet of water slides over the wet sand, mirroring the sky
    col = mix(col, vec3(0.70, 0.92, 0.90), smoothstep(0.02, 0.0, dsh) * 0.6);
    col = mix(col, vec3(1.0, 1.0, 0.98), clamp(foam, 0.0, 1.0) * 0.95);
  }
  // foam lace along the waterline on the water side too
  float dwl = shore - uv.y;
  if (dwl > 0.0) col = mix(col, vec3(1.0), smoothstep(0.012, 0.0, dwl) * (0.5 + 0.5 * tl_noise(vec2(p.x * 50.0, t * 0.4))) * 0.9);

  col *= 0.985 + 0.03 * tl_luma(w);
  col *= 1.0 - 0.20 * pow(length((uv - 0.5) * vec2(1.0, 1.0)), 2.2);
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
