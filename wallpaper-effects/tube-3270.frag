// label: Green screen
// hint: a dim green mainframe tube scrolling pages of text, the pointer lights the lines it reads and a block cursor sits under it
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

float tt_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tt_box(vec2 p, vec2 c, vec2 e) {          // signed distance to a box
  vec2 d = abs(p - c) - e;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
// a pseudo glyph in a unit cell: seven strokes switched on by the cell's hash; returns the distance to the nearest lit stroke
float tt_glyph(vec2 f, vec2 id, float prob) {
  float d = 1.0;
  float t = 0.075;
  if (tt_h(id + 1.1) < prob)  d = min(d, tt_box(f, vec2(0.5, 0.14), vec2(0.27, t)));
  if (tt_h(id + 2.3) < prob)  d = min(d, tt_box(f, vec2(0.5, 0.50), vec2(0.27, t)));
  if (tt_h(id + 3.7) < prob)  d = min(d, tt_box(f, vec2(0.5, 0.86), vec2(0.27, t)));
  if (tt_h(id + 4.9) < prob)  d = min(d, tt_box(f, vec2(0.22, 0.32), vec2(t, 0.18)));
  if (tt_h(id + 5.3) < prob)  d = min(d, tt_box(f, vec2(0.22, 0.68), vec2(t, 0.18)));
  if (tt_h(id + 6.1) < prob)  d = min(d, tt_box(f, vec2(0.78, 0.32), vec2(t, 0.18)));
  if (tt_h(id + 7.9) < prob)  d = min(d, tt_box(f, vec2(0.78, 0.68), vec2(t, 0.18)));
  return d;
}

vec4 fxMain(vec2 mpx) {
  vec2 px = qt_TexCoord0 * res;
  float sc = max(res.y / 1080.0, 0.6);
  vec2 cell = vec2(10.0, 20.0) * sc;
  float t = time;
  vec3 ph = vec3(0.30, 1.00, 0.42);                   // P39 phosphor green

  // the picture, as a dim green ghost on the tube
  vec3 pic = wall(qt_TexCoord0);
  float lum = dot(pic, vec3(0.30, 0.59, 0.11));
  vec3 col = vec3(0.004, 0.018, 0.008) + ph * vec3(0.55, 0.9, 0.6) * lum * 0.16;

  // text grid, scrolling up one line at a time
  float step_ = floor(t * 0.7);
  vec2 g = px / cell;
  vec2 cid = floor(g);
  vec2 f = fract(g);
  float row = cid.y + step_;
  float cols = floor(res.x / cell.x);
  float rh = tt_h(vec2(row, 3.3));
  float lineLen = 8.0 + tt_h(vec2(row, 9.1)) * (cols - 14.0);
  bool blank = rh < 0.24;
  bool bar = rh > 0.955;
  float indent = (tt_h(vec2(row, 5.5)) < 0.35) ? 4.0 : 0.0;
  float c = cid.x - indent;
  float lit = 0.0, halo = 0.0;
  float rowGain = 0.45 + 0.55 * tt_h(vec2(row, 1.7));
  if (!blank && c >= 0.0 && c < lineLen) {
    vec2 id = vec2(c, row);
    bool gap = tt_h(id + 0.5) < 0.17 || (tt_h(vec2(floor(c / 7.0), row)) < 0.12);
    float d = 1.0;
    if (bar) d = tt_box(f, vec2(0.5, 0.52), vec2(0.5, 0.06));
    else if (!gap) d = tt_glyph(f, id, 0.52);
    // field underline on a few rows
    lit = smoothstep(0.045, 0.0, d);
    halo = exp(-max(d, 0.0) * 9.0) * 0.30 * step(d, 0.8);
  }
  // reverse-video header row now and then
  bool rev = rh > 0.90 && rh <= 0.955;
  if (rev && cid.x < lineLen) { lit = 1.0 - lit; halo = 0.0; col += ph * 0.05; }
  float text = (lit + halo) * rowGain;

  // the pointer reads the screen: nearby lines glow brighter, and a block cursor sits in the cell under it
  float dm = length(px - mpx);
  float near = exp(-dm * dm / (2.0 * 150.0 * 150.0 * sc * sc));
  text *= 0.24 + 1.9 * near;
  vec2 mc = floor(mpx / cell);
  float blink = step(0.35, fract(t * 0.9));
  if (cid == mc && mpx.x > 0.0) { text = mix(text, 1.1, blink); }
  col += ph * text * 0.78;

  // mild scan structure and tube vignette
  col *= 0.90 + 0.10 * (0.5 + 0.5 * sin(px.y * 3.14159 / (1.5 * sc)));
  col *= 1.0 - 0.55 * pow(length((qt_TexCoord0 - 0.5) * vec2(1.0, 0.9)), 2.2);
  col *= 0.97 + 0.03 * sin(t * 37.0);
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
