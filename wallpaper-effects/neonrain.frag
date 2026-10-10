// label: Neon rain
// hint: night rain, pointer is an umbrella
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

const float HORIZON = 0.84;           // where the puddle starts
const vec3 NEON_PINK = vec3(1.0, 0.18, 0.62);
const vec3 NEON_CYAN = vec3(0.16, 0.88, 1.0);
const vec3 NEON_AMBER = vec3(1.0, 0.62, 0.20);

// the dark wet city: tinted wallpaper plus soft neon bokeh lights drifting in the distance
vec3 city(vec2 uv, vec2 m, float asp) {
  vec3 col = wall(uv);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l) * vec3(0.55, 0.40, 0.95), 0.5) * 0.62;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 5.0 : 9.0;
    float seed = float(k) * 13.0;
    vec2 g = p * sc + vec2(time * 0.012 * (k == 0 ? 1.0 : -1.4), 0.0);
    vec2 id = floor(g), f = fract(g);
    float h = hash(id + seed);
    if (h > 0.45) {
      vec2 c = vec2(0.3 + 0.4 * hash(id + seed + 2.0), 0.3 + 0.4 * hash(id + seed + 5.0));
      float h2 = hash(id + seed + 8.0);
      vec3 tint = h2 < 0.4 ? NEON_PINK : (h2 < 0.8 ? NEON_CYAN : NEON_AMBER);
      float r = 0.16 + 0.12 * hash(id + seed + 11.0);
      float d = length(f - c);
      float disc = smoothstep(r, r * 0.7, d) * 0.55 + smoothstep(r * 1.9, r * 0.5, d) * 0.25; // soft out-of-focus disc
      float pulse = 0.65 + 0.35 * sin(time * (0.4 + h2) + h * 30.0);
      // lights near the horizon are brighter, like signs along a street
      float street = 0.35 + 0.65 * smoothstep(0.0, HORIZON * 0.9, uv.y) * smoothstep(HORIZON, HORIZON * 0.6, uv.y);
      acc += tint * disc * pulse * street * (k == 0 ? 0.55 : 0.4);
    }
  }
  return col + acc;
}

// vertical rain streaks, three depths
float rain(vec2 uv, float asp) {
  float acc = 0.0;
  for (int k = 0; k < 3; k++) {
    float cols = k == 0 ? 90.0 : (k == 1 ? 55.0 : 32.0);
    float speed = k == 0 ? 0.55 : (k == 1 ? 0.8 : 1.15);
    float len = k == 0 ? 0.05 : (k == 1 ? 0.085 : 0.13);
    float wid = k == 0 ? 0.20 : (k == 1 ? 0.26 : 0.34);
    float amp = k == 0 ? 0.5 : (k == 1 ? 0.8 : 1.1);
    vec2 p = vec2(uv.x * asp, uv.y);
    p.x += uv.y * 0.07;              // wind lean
    float cx = p.x * cols;
    float id = floor(cx);
    float h = hash(vec2(id, float(k) * 5.0));
    float y = fract(uv.y - time * speed * (0.7 + 0.6 * h) + h * 9.0);
    float fx = abs(fract(cx) - 0.5);
    float streak = smoothstep(wid, 0.0, fx) * smoothstep(len, 0.0, y) * step(0.35, hash(vec2(id, 3.0 + float(k))));
    acc += streak * amp * smoothstep(0.0, 1.0, y / len);
  }
  return acc;
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 m = mpx / res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);

  vec3 col;
  float puddle = smoothstep(HORIZON - 0.01, HORIZON + 0.02, uv.y);
  float edge = smoothstep(0.012, 0.0, abs(uv.y - HORIZON - 0.005));
  vec2 ruv = uv;
  // ripples on the puddle: rings from raindrops, plus rings around the pointer when it is in the puddle
  float ring = 0.0;
  if (puddle > 0.0) {
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 11.0 : 19.0;
      vec2 g = vec2(p.x * sc, (uv.y - HORIZON) * sc * 3.2);
      vec2 id = floor(g), f = fract(g) - 0.5;
      float h = hash(id + float(k) * 7.0);
      float phase = fract(time * (0.35 + 0.3 * h) + h * 9.0);
      vec2 c = (vec2(hash(id + 3.0), hash(id + 5.0)) - 0.5) * 0.5;
      float d = length(f - c);
      float rr = phase * 0.55;
      float w = smoothstep(0.07, 0.0, abs(d - rr)) * (1.0 - phase) * step(0.5, h);
      ring += w * (k == 0 ? 1.0 : 0.6);
    }
    float dmp = length((p - mp) * vec2(1.0, 3.2));
    ring += smoothstep(0.03, 0.0, abs(dmp - fract(time * 0.5) * 0.22)) * (1.0 - fract(time * 0.5)) * smoothstep(0.35, 0.0, dmp) * step(HORIZON, m.y) * 1.2;
    ruv.y = HORIZON - (uv.y - HORIZON) * 0.95;
    ruv.x += ring * 0.004 * sin(uv.y * 400.0);
    ruv.y += ring * 0.003;
  }
  vec3 above = city(uv, m, asp);
  if (puddle > 0.0) {
    vec3 refl = city(clamp(ruv, 0.0, 1.0), m, asp) * 0.75;
    refl += NEON_CYAN * ring * 0.10;
    float depth = smoothstep(HORIZON, 1.0, uv.y);
    refl = mix(refl, refl * 0.6, depth);
    refl += NEON_PINK * 0.05 * (1.0 - depth);
    col = mix(above, refl, puddle * 0.88);
  } else {
    col = above;
  }

  // the pointer is an umbrella: rain is held off in a dome, and the drops that hit its edge light up
  float dm = length((p - mp) * vec2(1.0, 1.0));
  float R = 0.13;
  float under = smoothstep(R, R * 0.85, dm);
  float r = rain(uv, asp) * (1.0 - under) * (1.0 - 0.4 * puddle);
  float rim = smoothstep(0.03, 0.0, abs(dm - R)) * (0.75 + 0.25 * sin(time * 9.0 + p.x * 90.0));
  vec3 rainCol = mix(vec3(0.55, 0.75, 1.0), NEON_CYAN, 0.45);
  col += rainCol * r * 0.7;
  col += NEON_PINK * max(rim, 0.0) * 0.20 * smoothstep(R * 1.6, R, dm); // splash light flickering on the umbrella edge
  col += (NEON_PINK * 0.5 + NEON_CYAN * 0.5) * smoothstep(R * 1.5, R * 0.9, dm) * (1.0 - under) * 0.07;

  col += NEON_CYAN * edge * 0.12; // wet shoreline of the puddle
  col *= 1.0 - 0.45 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
