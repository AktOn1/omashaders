// label: Liquid chrome
// hint: parts of the picture flow across a slow liquid-metal surface, chrome ridges drift and catch a turning light, the pointer leaves a healing dent
// category: Style studies
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

float mf_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mf_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mf_hash(i), mf_hash(i + vec2(1, 0)), f.x), mix(mf_hash(i + vec2(0, 1)), mf_hash(i + vec2(1, 1)), f.x), f.y);
}
float mf_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// ---- the surface: a height field, not a picture. Two slow flows warp a small noise stack (domain warping),
// so the metal keeps folding into new ridges instead of sliding past as a texture.
float mf_height(vec2 p, float t) {
  vec2 w = vec2(mf_noise(p * 1.55 + vec2(t * 0.042, -t * 0.028)),
                mf_noise(p * 1.75 + vec2(-t * 0.035, t * 0.049) + 11.3));
  vec2 q = p + (w - 0.5) * 1.15;
  return mf_noise(q * 2.7 + vec2(t * 0.022, 0.0)) * 0.56
       + mf_noise(q * 5.9 - vec2(0.0, t * 0.030) + 5.0) * 0.30
       + mf_noise(q * 12.1 + 9.0) * 0.14;
}

// the pointer presses a dent into the metal: a smooth bulge with slow rings running out of it,
// so the surface looks like it is healing back to flat behind the pointer
float mf_dent(vec2 p, vec2 mp, float t) {
  vec2 d = p - mp;
  float r = length(d);
  float bowl = exp(-r * r / (2.0 * 0.070 * 0.070));
  float rings = sin(r * 46.0 - t * 1.7) * exp(-r * r / (2.0 * 0.135 * 0.135)) * 0.22;
  return bowl * 0.85 + rings;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(mpx.x / res.x * asp, mpx.y / res.y);
  float t = time;

  vec3 base = wall(uv);
  float lum = mf_luma(base);

  // ---- where the metal is: an organic set of drifting blobs with soft edges, plus thin crests.
  // Only a part of the picture is ever liquid; everywhere else the picture is untouched.
  float blob = mf_noise(p * 1.20 + vec2(t * 0.028, -t * 0.020)) * 0.64
             + mf_noise(p * 2.85 - vec2(t * 0.016, 0.0) + 3.7) * 0.36;
  float mask = smoothstep(0.560, 0.775, blob);

  float e = 0.0045;
  float h0 = mf_height(p, t);
  float ridge = smoothstep(0.075, 0.0, abs(h0 - 0.52)) * 0.42;        // thin bright crest lines
  mask = clamp(mask + ridge * mask, 0.0, 1.0);
  mask *= 0.42 + 0.58 * smoothstep(0.04, 0.55, lum);                   // the metal catches the lit parts of the picture
  mask *= 1.0 - 0.35 * pow(length(uv - 0.5) * 1.35, 3.0);              // calmer at the very corners

  // the dent rides on top of the mask so the pointer always finds metal under it
  float dent = mf_dent(p, mp, t);
  float pm = clamp(dent, 0.0, 1.0);
  mask = clamp(mask + pm * 0.55 * (0.45 + 0.55 * smoothstep(0.05, 0.5, lum)), 0.0, 1.0);
  if (mask < 0.004) { return vec4(clamp(base, 0.0, 1.0), 1.0) * qt_Opacity; }

  // ---- surface normal from finite differences of the height field (+ the dent)
  float hx = mf_height(p + vec2(e, 0.0), t) + mf_dent(p + vec2(e, 0.0), mp, t) * 0.5;
  float hy = mf_height(p + vec2(0.0, e), t) + mf_dent(p + vec2(0.0, e), mp, t) * 0.5;
  float hc = h0 + dent * 0.5;
  float slope = 0.165;
  vec3 n = normalize(vec3(-(hx - hc) / e * slope, -(hy - hc) / e * slope, 1.0));

  // ---- the picture is the environment map.
  // near sample: refraction through the thin sheet, with a touch of dispersion
  vec2 off = n.xy * (0.030 + 0.020 * pm) * mask;
  vec3 refr;
  refr.r = wall(uv + off * 1.12).r;
  refr.g = wall(uv + off).g;
  refr.b = wall(uv + off * 0.88).b;
  // far sample: what the mirror sees, far along the normal, which is what makes a chrome sheet readable
  vec3 env = wall(uv + n.xy * 0.34);

  // ---- fresnel: face-on silver, blue steel at an angle, a warm copper edge at grazing angles
  vec3 V = normalize(vec3((uv - 0.5) * vec2(asp, 1.0) * 0.55, 1.0));
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 4.0);
  vec3 silver = vec3(0.80, 0.85, 0.92);
  vec3 steel = vec3(0.60, 0.72, 0.96);
  vec3 copper = vec3(1.00, 0.76, 0.54);
  vec3 tint = mix(silver, steel, smoothstep(0.05, 0.55, fres));
  tint = mix(tint, copper, smoothstep(0.55, 1.0, fres) * 0.50);

  // ---- a light slowly orbiting over the sheet
  vec3 L = normalize(vec3(cos(t * 0.105) * 0.70, sin(t * 0.105) * 0.52, 0.72));
  vec3 Hv = normalize(L + V);
  float nh = max(dot(n, Hv), 0.0);
  float spec = pow(nh, 60.0) * 1.05 + pow(nh, 16.0) * 0.10;
  float shade = clamp(0.70 + 1.45 * dot(n.xy, L.xy), 0.10, 2.2);       // metal: bright toward the light, dark away

  // chrome shading: the picture pulled toward its own grey, tinted and lit by the slope
  vec3 body = mix(refr, env, 0.34 + 0.34 * fres);
  vec3 chrome = mix(body, vec3(mf_luma(body)), 0.52) * tint * shade;

  float rr = length(p - mp);
  float ringGlint = max(sin(rr * 46.0 - t * 1.7), 0.0) * exp(-rr * rr / (2.0 * 0.11 * 0.11));

  vec3 col = mix(base, chrome, mask * 0.55);
  col += vec3(1.00, 0.98, 0.94) * spec * mask * 0.70;
  col += vec3(0.86, 0.92, 1.00) * ringGlint * pm * 0.12;

  return vec4(clamp(col, 0.0, 1.0), 1.0) * qt_Opacity;
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
