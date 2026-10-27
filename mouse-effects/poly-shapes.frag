#version 440
// category: Retro
// desc: Polygon shapes: a short trail of tiny flat-shaded shapes (triangle, square, circle, cross) in four console colours follows the pointer, each turning slowly with a slight jitter on a coarse pixel grid, and they drift into a small orbit when the pointer rests. Calm and low-contrast
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
  vec4 h4;
  vec4 h5;
  vec4 h6;
  vec4 h7;
  vec4 hs;
};

vec2 P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  if (i == 8) return h3.zw;
  if (i == 9) return h4.xy;
  if (i == 10) return h4.zw;
  if (i == 11) return h5.xy;
  if (i == 12) return h5.zw;
  if (i == 13) return h6.xy;
  if (i == 14) return h6.zw;
  if (i == 15) return h7.xy;
  return h7.zw;
}
float ps_hash(float n) { return fract(sin(n * 127.1 + 9.7) * 43758.5453); }

vec3 ps_col(int i) {
  if (i == 0) return vec3(0.90, 0.07, 0.10);
  if (i == 1) return vec3(0.98, 0.80, 0.10);
  if (i == 2) return vec3(0.05, 0.64, 0.30);
  if (i == 3) return vec3(0.04, 0.45, 0.74);
  return vec3(0.90, 0.07, 0.10);
}

// signed distance to each little shape (negative inside); u is in pixels, already rotated
float ps_sd(int kind, vec2 u, float r) {
  if (kind == 0) { // triangle
    vec2 q = vec2(abs(u.x), u.y + r * 0.35);
    return max(q.x * 0.866 + q.y * 0.5 - r * 0.5, -q.y - r * 0.5) ;
  }
  if (kind == 1) { // square
    vec2 d = abs(u) - vec2(r * 0.78);
    return max(d.x, d.y);
  }
  if (kind == 2) return length(u) - r * 0.82; // circle
  vec2 a = abs(u) - vec2(r * 1.0, r * 0.34); // cross
  vec2 b = abs(u) - vec2(r * 0.34, r * 1.0);
  return min(max(a.x, a.y), max(b.x, b.y));
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec3 acc = vec3(0.0);
  float alpha = 0.0;
  float shade = 0.0;

  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    int slot = 2 + i * 2;
    float age = (float(slot) - 1.0 + hs.y) / 16.0;
    vec2 q = P(slot);
    float ang = time * (0.55 + 0.20 * ps_hash(fi + 1.0)) + fi * 1.7;
    float rad = 6.0 + 3.5 * fi;
    q += vec2(cos(ang), sin(ang * 1.2)) * rad * (0.50 + 0.50 * sin(time * 0.5 + fi * 1.3));
    // a slight wobble, then snap to a coarse grid like a console that rounds its vertices
    q += 1.3 * vec2(sin(time * 3.1 + fi * 2.3), cos(time * 2.7 + fi * 1.9));
    q = floor(q / 2.0 + 0.5) * 2.0;
    float r = 7.5 - 0.65 * fi;
    int kind = int(mod(fi, 4.0));
    float rot = time * (0.9 + 0.3 * ps_hash(fi + 4.0)) * (mod(fi, 2.0) < 1.0 ? 1.0 : -1.0) + fi * 1.1;
    float cs = cos(rot), sn = sin(rot);
    vec2 d = p - q;
    if (dot(d, d) > r * r * 6.0) continue;
    vec2 u = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
    float sd = ps_sd(kind, u, r);
    float a = clamp(0.5 - sd, 0.0, 1.0);
    float fade = 1.0 - 0.45 * age;
    // flat two-tone shading: one half in the light, one half in shade, split along a diagonal
    vec3 c = ps_col(int(mod(fi, 4.0)));
    float lit = (u.x * 0.7 - u.y * 0.7) > 0.0 ? 1.0 : 0.58;
    vec3 fc = c * lit;
    fc = mix(fc, vec3(dot(fc, vec3(0.33))), 0.10);
    fc += vec3(1.0, 0.95, 0.85) * 0.18 * smoothstep(0.7, 0.0, abs(sd + 0.6)) ; // a thin edge catch light
    shade += clamp(0.5 - (sd - 2.0) * 0.4, 0.0, 1.0) * 0.16 * fade;
    float aa = a * fade;
    acc = acc * (1.0 - aa) + fc * aa;
    alpha = alpha + aa * (1.0 - alpha);
  }

  float sa = clamp(shade, 0.0, 0.35);
  vec3 ink = vec3(0.03, 0.04, 0.09);
  vec3 rgb = acc + ink * sa * (1.0 - alpha);
  float aOut = alpha + sa * (1.0 - alpha);
  fragColor = vec4(rgb, aOut) * qt_Opacity;
}
