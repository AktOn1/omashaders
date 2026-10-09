#version 440
// category: Trail
// desc: Digital glitches flicker in the mouse trail: torn colour bars and blocks
// motion: yes
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec4 h0;
  vec4 h1;
  vec4 h2;
  vec4 h3;
};

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  return h3.zw;
}
float box(vec2 p, vec2 c, vec2 half_) {
  vec2 d = abs(p - c) - half_;
  return step(max(d.x, d.y), 0.0);
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float step_ = floor(time * 14.0);
  for (int i = 0; i < 9; i++) {
    float fade = 1.0 - float(i) / 9.0;
    vec2 c = P(i);
    for (int k = 0; k < 2; k++) {
      float seed = float(i) * 13.7 + float(k) * 5.3 + step_;
      if (hash(seed + 9.1) < 0.6) continue;
      float w = 8.0 + hash(seed) * 60.0 * fade;
      float h = 1.5 + hash(seed + 1.3) * 5.0;
      vec2 bc = c + vec2((hash(seed + 2.1) - 0.5) * 70.0, (hash(seed + 3.7) - 0.5) * 50.0);
      float shift = 3.0 + hash(seed + 4.9) * 7.0;
      float pick = hash(seed + 6.2);
      vec3 main_ = pick < 0.4 ? vec3(0.0, 1.0, 0.9) : (pick < 0.75 ? vec3(1.0, 0.1, 0.6) : vec3(0.9, 1.0, 0.9));
      float m = box(p, bc, vec2(w, h));
      float r = box(p, bc + vec2(shift, 0.0), vec2(w, h)) * (1.0 - m);
      float b = box(p, bc - vec2(shift, 0.0), vec2(w, h)) * (1.0 - m);
      col = max(col, (main_ * m + vec3(1.0, 0.0, 0.1) * r + vec3(0.1, 0.2, 1.0) * b) * fade);
      alpha = max(alpha, max(m, max(r, b)) * fade);
    }
    // small square pixel blocks
    for (int k = 0; k < 2; k++) {
      float seed = float(i) * 3.9 + float(k) * 8.1 + step_ * 1.7;
      if (hash(seed + 0.5) < 0.5) continue;
      float s = 3.0 + floor(hash(seed) * 4.0) * 3.0;
      vec2 q = c + (vec2(hash(seed + 1.1), hash(seed + 2.2)) - 0.5) * 80.0;
      q = floor(q / s) * s;
      float bl = box(p, q, vec2(s * 0.5));
      float pick = hash(seed + 3.3);
      vec3 bc3 = pick < 0.33 ? vec3(0.0, 1.0, 0.9) : (pick < 0.66 ? vec3(1.0, 0.1, 0.6) : vec3(1.0));
      col = max(col, bc3 * bl * fade);
      alpha = max(alpha, bl * fade);
    }
  }
  // occasional full-width tear through the cursor row
  float tear = step(0.88, hash(step_ * 3.1)) * box(p, vec2(res.x * 0.5, mouse.y), vec2(res.x * 0.5, 1.5)) * 0.5;
  col = max(col, vec3(0.0, 1.0, 0.9) * tear);
  alpha = max(alpha, tear);
  // faint scanlines inside the glitch
  alpha *= 0.75 + 0.25 * step(0.5, fract(p.y / 3.0));
  col = clamp(col, 0.0, 1.0);
  float onS = step(0.0, mouse.x) * step(mouse.x, res.x) * step(0.0, mouse.y) * step(mouse.y, res.y);
  alpha *= onS;
  fragColor = vec4(col * alpha, alpha) * qt_Opacity;
}
