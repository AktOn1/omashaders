// label: EGA desk
// hint: the picture in 16 DOS colours with ordered dither, and the pointer carries a small window of the real picture in a double-line frame
// category: Retro machines
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

vec3 eg_pal(int i) {
  if (i == 0) return vec3(0.0, 0.0, 0.0);
  if (i == 1) return vec3(0.0, 0.0, 0.667);
  if (i == 2) return vec3(0.0, 0.667, 0.0);
  if (i == 3) return vec3(0.0, 0.667, 0.667);
  if (i == 4) return vec3(0.667, 0.0, 0.0);
  if (i == 5) return vec3(0.667, 0.0, 0.667);
  if (i == 6) return vec3(0.667, 0.333, 0.0);
  if (i == 7) return vec3(0.667, 0.667, 0.667);
  if (i == 8) return vec3(0.333, 0.333, 0.333);
  if (i == 9) return vec3(0.333, 0.333, 1.0);
  if (i == 10) return vec3(0.333, 1.0, 0.333);
  if (i == 11) return vec3(0.333, 1.0, 1.0);
  if (i == 12) return vec3(1.0, 0.333, 0.333);
  if (i == 13) return vec3(1.0, 0.333, 1.0);
  if (i == 14) return vec3(1.0, 1.0, 0.333);
  return vec3(1.0);
}
vec3 eg_nearest(vec3 c) {
  vec3 best = vec3(0.0);
  float bd = 1e9;
  for (int i = 0; i < 16; i++) {
    vec3 p = eg_pal(i);
    vec3 d = (c - p) * vec3(0.9, 1.2, 0.6);          // the eye cares most about green
    float dd = dot(d, d);
    if (dd < bd) { bd = dd; best = p; }
  }
  return best;
}
float eg_bayer(vec2 p) {                              // 4x4 ordered-dither threshold, 0..1
  vec2 q = mod(floor(p), 4.0);
  float x = q.x, y = q.y;
  float a = mod(x, 2.0), b = mod(floor(x / 2.0), 2.0);
  float c = mod(y, 2.0), d = mod(floor(y / 2.0), 2.0);
  // bit interleave of (x xor y) and y
  float i0 = abs(a - c), i1 = abs(b - d);
  float v = i0 * 8.0 + c * 4.0 + i1 * 2.0 + d;
  return (v + 0.5) / 16.0;
}

vec4 fxMain(vec2 mpx) {
  vec2 px = qt_TexCoord0 * res;
  float sc = max(floor(res.y / 360.0 + 0.5), 2.0);     // one EGA pixel = sc screen pixels (3 on 1080p)
  vec2 vp = floor(px / sc);
  vec2 vuv = (vp + 0.5) * sc / res;
  vec3 pic = wall(vuv);
  pic = pic * 0.92 + 0.02;
  float th = eg_bayer(vp) - 0.5;
  vec3 col = eg_nearest(clamp(pic + th * 0.34, 0.0, 1.0));

  // the pointer carries a little 'window': a 320x200 patch of the real picture in a DOS double-line frame with a hard shadow
  if (mpx.x > -1000.0) {
    vec2 half_ = vec2(160.0, 100.0) * sc / 3.0;
    vec2 d = abs(px - mpx);
    vec2 ds = abs(px - (mpx + vec2(10.0, 10.0) * sc / 3.0));
    float t = sc / 3.0;
    if (max(ds.x - half_.x - 7.0 * t, ds.y - half_.y - 7.0 * t) < 0.0 && max(d.x - half_.x - 7.0 * t, d.y - half_.y - 7.0 * t) >= 0.0) col *= 0.35;
    float e = max(d.x - half_.x, d.y - half_.y);        // <0 inside the picture
    if (e < 0.0) col = pic;
    else if (e < 7.0 * t) {
      float k = e / t;
      col = (k < 2.0 || (k >= 4.0 && k < 6.0)) ? vec3(0.667, 0.667, 0.667) : vec3(0.0, 0.0, 0.667);
      if (k >= 6.0) col = vec3(1.0);
      if (k < 1.0) col = vec3(1.0);
    }
  }
  col *= 1.0 - 0.28 * pow(length((qt_TexCoord0 - 0.5) * vec2(1.0, 0.9)), 2.4);
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
