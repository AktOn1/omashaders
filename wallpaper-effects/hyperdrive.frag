// label: Hyperdrive
// hint: light speed, stars streak out from the pointer
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

const vec3 CYAN = vec3(0.16, 0.88, 1.0);
const vec3 ORANGE = vec3(1.0, 0.54, 0.12);
const float TAU = 6.28318;

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  // the pointer is the vanishing point; with no pointer (reaction 0) it sits a little above the centre
  vec2 c = mpx.x < -5000.0 ? vec2(0.5, 0.46) : clamp(mpx / res, vec2(-0.5), vec2(1.5));
  vec2 p = (uv - c) * vec2(asp, 1.0);
  float r = length(p);
  float ang = atan(p.y, p.x);

  // the wallpaper seen through the viewport: zoom-blurred toward the vanishing point, cooled to cyan with warm highlights
  vec2 dir = (c - uv) * 0.05 * smoothstep(0.1, 0.9, r);
  vec3 w = vec3(0.0);
  float jit = fract(52.9829189 * fract(dot(uv * res, vec2(0.06711056, 0.00583715))));   // dithered taps hide the stepping of a 5-tap blur
  for (int k = 0; k < 5; k++) w += wall(uv + dir * ((float(k) + jit) / 5.0));
  w *= 0.2;
  float l = dot(w, vec3(0.2126, 0.7152, 0.0722));
  vec3 grad = mix(vec3(0.008, 0.03, 0.07), vec3(0.16, 0.55, 0.72), smoothstep(0.0, 0.6, l));
  grad += ORANGE * 0.30 * smoothstep(0.55, 1.0, l);
  vec3 col = mix(w * 0.45, grad * 0.8, 0.62);
  col *= 1.0 - 0.55 * smoothstep(0.45, 1.15, length((uv - 0.5) * vec2(asp, 1.0) / asp * 1.4));  // cockpit vignette

  // star streaks: every sector holds one star that flies outward and accelerates, longer and brighter as it nears
  for (int k = 0; k < 4; k++) {
    float n = k == 0 ? 130.0 : (k == 1 ? 90.0 : (k == 2 ? 62.0 : 40.0));
    float a = ang / TAU * n;
    float id = floor(a);
    float wd = (fract(a) - 0.5) * TAU * r / n;                  // distance across the streak, in screen heights
    float h = hash(vec2(id, float(k) + 1.0));
    float h2 = hash(vec2(id + 7.3, float(k) + 3.0));
    if (h2 < 0.3) continue;
    float z = fract(h * 13.0 + time * (0.05 + 0.05 * h2 + 0.02 * float(k)));
    float head = z * z * 1.25;
    float tailLen = head * (k == 0 ? 0.18 : 0.28 + 0.42 * z);
    float along = (head - r) / max(tailLen, 1e-3);              // 0 at the head, 1 at the tail
    if (along < 0.0 || along > 1.0) continue;
    float thick = 0.0007 + 0.0016 * z + 0.0004 * float(k);
    float line = smoothstep(thick, thick * 0.15, abs(wd));
    float inten = pow(1.0 - along, 1.6) * smoothstep(0.0, 0.12, z) * (0.35 + 0.9 * z);
    inten *= smoothstep(0.02, 0.12, r);                         // keep the pointer itself clear
    vec3 tint = h < 0.2 ? ORANGE : mix(CYAN, vec3(1.0), 0.25 + 0.5 * h2);
    col += tint * line * inten * 1.1;
    col += tint * smoothstep(thick * 7.0, 0.0, abs(wd)) * inten * 0.12;   // soft bloom around the line
  }

  // the light at the end of the tunnel
  col += mix(CYAN, vec3(1.0), 0.6) * exp(-r * 22.0) * 0.30 + ORANGE * exp(-r * 8.0) * 0.05 + CYAN * exp(-r * 3.0) * 0.04;
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
