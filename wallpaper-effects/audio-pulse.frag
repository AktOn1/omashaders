// label: Pulse
// hint: reacts to the music: bass rings and breathing, treble sparkle (idle breathing in silence)
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
  float audio;
  float bass;
  float mid;
  float treble;
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

const vec3 PINK = vec3(1.0, 0.18, 0.62);
const vec3 CYAN = vec3(0.16, 0.88, 1.0);
const vec3 INDIGO = vec3(0.10, 0.05, 0.30);
const float HORIZON = 0.74;

// treble sparkle: tiny stars on a grid, more of them (and brighter) the more treble there is; a few always twinkle in silence
vec3 sparkle(vec2 p, float tre) {
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 26.0 : 44.0;
    vec2 g = p * sc;
    vec2 id = floor(g), f = fract(g);
    float h = hash(id + float(k) * 17.0);
    float dens = 0.045 + 0.30 * tre;                          // share of cells that may light up
    float live = smoothstep(dens, dens - 0.06, h);
    vec2 c = vec2(0.25 + 0.5 * hash(id + 3.0), 0.25 + 0.5 * hash(id + 7.0));
    float tw = pow(0.5 + 0.5 * sin(time * (1.5 + 5.0 * hash(id + 9.0)) + h * 60.0), 2.0 + 4.0 * (1.0 - tre));
    vec2 d = f - c;
    float core = smoothstep(0.16, 0.0, length(d));
    float cross = max(smoothstep(0.015, 0.0, abs(d.x)) * smoothstep(0.34, 0.0, abs(d.y)),
                      smoothstep(0.015, 0.0, abs(d.y)) * smoothstep(0.34, 0.0, abs(d.x)));
    vec3 tint = hash(id + 11.0) < 0.5 ? PINK : CYAN;
    acc += mix(tint, vec3(1.0), 0.55) * (core + 0.8 * cross) * live * tw * (k == 0 ? 1.0 : 0.65);
  }
  return acc;
}

// synthwave floor grid: scrolls toward you, lights up with the bass
vec3 floorGrid(vec2 uv, float asp, float bs, float md) {
  float py = uv.y - HORIZON;
  if (py <= 0.0) return vec3(0.0);
  float d = 1.0 / (py + 0.012);                                  // depth: large near the horizon
  float x = (uv.x - 0.5) * asp * d * 0.55;
  float zz = d * 0.32 - time * 0.35;
  float wx = max(fwidth(x), 1e-4), wz = max(fwidth(zz), 1e-4);
  float lx = smoothstep(wx * 1.4, 0.0, abs(fract(x) - 0.5)) * smoothstep(0.7, 0.3, wx);
  float lz = smoothstep(wz * 1.4, 0.0, abs(fract(zz) - 0.5)) * smoothstep(0.7, 0.3, wz);
  float line = max(lx, lz);
  float fade = smoothstep(0.0, 0.04, py) * smoothstep(0.0, 0.2, 0.34 - py + 0.1);
  vec3 tint = mix(PINK, CYAN, clamp(0.5 + (uv.x - 0.5) * 1.4 + (md - 0.3), 0.0, 1.0));
  return tint * line * fade * (0.16 + 0.8 * bs);
}

vec4 fxMain(vec2 mpx) {
  vec4 fragColor;
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  bool away = mpx.x < -5000.0;
  vec2 m = away ? vec2(0.5, 0.42) : mpx / res;               // rings start at the pointer, or the screen centre when it is ignored
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 mp = vec2(m.x * asp, m.y);

  // idle breathing so the desktop is never dead: a slow swell plus a faint heartbeat, replaced by the real levels when sound plays
  float breath = 0.5 + 0.5 * sin(time * 0.8);
  float beat = pow(0.5 + 0.5 * sin(time * 2.0), 6.0);
  float idle = 0.10 * breath + 0.10 * beat;
  float bs = clamp(max(bass, idle * (1.0 - audio)), 0.0, 1.0);
  float md = clamp(max(mid, 0.12 * (0.5 + 0.5 * sin(time * 0.5 + 1.0)) * (1.0 - audio)), 0.0, 1.0);
  float tr = clamp(treble, 0.0, 1.0);
  float lv = clamp(max(audio, idle), 0.0, 1.0);

  // bass rings from the pointer; the picture is pushed outward along each ring
  vec2 dv = p - mp;
  float dist = length(dv);
  vec2 dir = dv / max(dist, 1e-4);
  float rings = 0.0;
  for (int k = 0; k < 4; k++) {
    float ph = fract(time * 0.22 + float(k) * 0.25);
    float r = ph * 1.25;
    float w = smoothstep(0.035 + 0.04 * ph, 0.0, abs(dist - r));
    rings += w * (1.0 - ph) * (1.0 - ph) * (0.30 + 1.5 * bs) * smoothstep(0.0, 0.05, ph);
  }
  float push = rings * 0.006 * (0.4 + 1.6 * bs);

  // the whole picture breathes (about the screen centre) and splits its colours with the level
  vec2 cuv = (uv - 0.5) / (1.0 + 0.012 * breath * (1.0 - audio) + 0.035 * bs) + 0.5;
  cuv -= dir * push * vec2(1.0 / asp, 1.0);
  vec2 fringe = (uv - m) * vec2(1.0, 1.0) * (0.002 + 0.016 * lv * lv + 0.004 * bs);
  vec3 col = vec3(wall(cuv + fringe).r, wall(cuv).g, wall(cuv - fringe).b);

  // night grade: dark indigo with magenta mids; louder music lifts it a little
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 tinted = mix(INDIGO * 0.7, mix(PINK * 0.85, CYAN, smoothstep(0.45, 0.95, l)), smoothstep(0.02, 0.6, l));
  col = mix(col * vec3(0.78, 0.66, 1.05), tinted, 0.35) * (0.52 + 0.24 * lv + 0.28 * bs);

  // neon: rings, floor grid, sparkle, frame glow
  vec3 ringCol = mix(PINK, CYAN, clamp(dist * 0.9 + 0.5 * md, 0.0, 1.0));
  col += ringCol * rings * 0.55 * smoothstep(1.5, 0.1, dist);
  col += floorGrid(uv, asp, bs, md);
  col += sparkle(p, tr) * (0.55 + 0.45 * tr);
  float edge = smoothstep(0.16, 0.0, min(min(uv.x, 1.0 - uv.x) * asp * 0.6, min(uv.y, 1.0 - uv.y)));
  col += mix(PINK, CYAN, uv.x) * edge * edge * (0.10 + 0.55 * md + 0.35 * bs);
  // soft bloom disc at the origin of the rings that swells on the beat
  col += mix(PINK, CYAN, 0.5) * exp(-dist * dist * (60.0 - 40.0 * bs)) * (0.05 + 0.40 * bs);

  col *= 1.0 - 0.5 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.0);
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
