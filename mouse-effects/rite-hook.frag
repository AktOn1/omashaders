#version 440
// category: Focus
// desc: Rite hook: one polished brass hook fixed to the pointer, hanging from a short chain of eight painted brass links (FLUX sprites, rite-hook.png); the chain is a real pendulum that trails the movement (every link follows the pointer's path a little later than the one above it), stretches out behind a fast hand and settles into a slow swing of three to four seconds when you stop. Candle light from the upper left picks out the brass, a dim crimson rim glows on the far side and a tiny red catchlight sits in the bowl of the hook; a glint runs down the chain and along the curve every few seconds. Nothing is spawned or left behind, and a dark shade under the metal keeps it readable on bright pictures
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
layout(binding = 1) uniform sampler2D sprites; // rite-hook.png (512 x 512): link in the left-top 256 x 256 cell, hook in the right 256 x 512 cell

// Pointer history: P(0) is the pointer, P(1) the newest sample, P(16) the oldest (about one second back).
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

float rh_h(float n) { return fract(sin(n * 12.9898 + 3.3131) * 43758.5453); }

// where the pointer was `k` history steps ago (k fractional, 0 = now), continuous in time
vec2 rh_past(float k) {
  float fl = floor(k);
  int i = int(fl);
  float f = k - fl;
  vec2 a = mix(P(i + 1), P(i), hs.y);
  vec2 b = mix(P(i + 2), P(i + 1), hs.y);
  return mix(a, b, f);
}

const float RH_LINK_ASPECT = 0.8600;   // painted link: width / length
const float RH_HOOK_ASPECT = 0.5000;   // painted hook: width / length

// uv in 0..1 inside the sprite; k = 0 link, 1 hook
vec4 rh_tex(int k, vec2 uv) {
  vec2 q = clamp(uv, 0.004, 0.996);
  if (k == 0) return texture(sprites, q * vec2(0.5, 0.5));
  return texture(sprites, vec2(0.5 + q.x * 0.5, q.y));
}

vec4 rh_over(vec4 acc, vec4 c) { return vec4(c.rgb + acc.rgb * (1.0 - c.a), c.a + acc.a * (1.0 - c.a)); }

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  vec2 d0 = p - mouse;
  if (dot(d0, d0) > 240.0 * 240.0) { fragColor = vec4(0.0); return; }

  const vec3 amber = vec3(1.0, 0.55, 0.18);
  const vec3 bone = vec3(0.95, 0.88, 0.78);

  float v = distance(mouse, P(4)) / max(4.0 * hs.z, 0.01);          // pointer speed, px/s
  float sp = smoothstep(120.0, 1500.0, v);
  float lagMag = (length(P(5) - mouse) + length(P(10) - mouse) + length(P(16) - mouse)) * 0.3333;
  float exc = smoothstep(8.0, 120.0, lagMag);                       // how much the chain has been stirred in the last second

  // the candle: slow breathing with a quicker irregular tremble
  float fk = floor(time * 11.0);
  float flick = 0.90 + 0.07 * sin(time * 2.3 + 1.0) + 0.04 * sin(time * 7.7) + 0.05 * (rh_h(fk) - 0.5) * (0.5 + 0.5 * sin(time * 3.1));
  vec2 ldj = 0.07 * vec2(sin(time * 1.9), sin(time * 1.3 + 2.0)) + 0.05 * (vec2(rh_h(fk + 3.0), rh_h(fk + 9.0)) - 0.5);

  // ------------------------------------------------------------------ the chain: eight painted links hung from the pointer
  float L = mix(13.0, 22.0, sp);                                     // link pitch: the chain pays out when the hand is fast
  float omega = 6.2831853 / 3.6;                                    // idle sway period 3.6 s
  float swayK = 1.0 + 1.6 * exc;                                    // a stirred chain swings wider for a while

  float cyc = clamp(fract(time / 5.4) / 0.28, 0.0, 1.0);            // glint travelling pointer -> hook tip
  float gpos = cyc * 1.45 - 0.22;
  float glintGate = smoothstep(0.0, 0.4, cyc);

  vec4 acc = vec4(0.0);
  float halo = 0.0;
  vec2 prev = mouse;
  vec2 qj = mouse;
  vec2 dirPrev = vec2(0.0, 1.0);
  for (int j = 1; j <= 8; j++) {
    float fj = float(j);
    // the pull of the hand: this link follows the pointer's path a little later than the one above it
    vec2 lag = rh_past(fj * 0.85) - mouse;
    float lagLen = length(lag);
    lag *= 0.82 / (1.0 + lagLen / 700.0);
    // hanging: straight down, leaning a hair to the left so the pointer arrow stays clear; sway grows towards the hook
    vec2 sway = vec2(cos(omega * time - 0.42 * fj) * swayK * 0.95 + 0.5 * sin(omega * 0.63 * time + 1.7 - 0.2 * fj),
                     0.25 * sin(omega * 0.5 * time - 0.3 * fj)) * (fj * 0.9) * (0.35 + 0.65 * fj / 8.0);
    vec2 target = mouse + vec2(-0.10, 1.0) * (fj * L * 0.97) + lag + sway;
    vec2 dd = target - prev;
    float dl = length(dd);
    vec2 dir = dl > 1e-3 ? dd / dl : dirPrev;
    // a chain has no stretch and bends only a little at each joint
    dir = normalize(dir + dirPrev * 0.55);
    qj = prev + dir * L;

    // the link between prev and qj: long axis of the sprite along the chain
    vec2 c = 0.5 * (prev + qj);
    vec2 lp = p - c;
    vec2 pd = vec2(-dir.y, dir.x);
    float x = dot(lp, dir);
    float y = dot(lp, pd);
    bool faceOn = mod(fj, 2.0) < 0.5;
    float Ll = L * 1.75;                                             // links interlock: each is longer than the pitch
    float Lw = Ll * RH_LINK_ASPECT * (faceOn ? 1.0 : 0.50);          // an edge-on link is a slim bar
    vec2 uv = vec2(0.5 + y / Lw, 0.5 + x / Ll);
    if (uv.x >= -0.35 && uv.x <= 1.35 && uv.y >= -0.1 && uv.y <= 1.1) {
      vec4 s = rh_tex(0, uv);
      float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      s *= inside;
      // a soft dark rim round the metal so it reads on bright pictures
      vec2 uh = vec2(0.5 + (uv.x - 0.5) * 0.72, 0.5 + (uv.y - 0.5) * 0.72);
      float ha = rh_tex(0, uh).a * step(0.0, uh.x) * step(uh.x, 1.0) * step(0.0, uh.y) * step(uh.y, 1.0);
      halo = max(halo, ha * (faceOn ? 1.0 : 0.8));
      if (s.a > 0.003) {
        float glt = exp(-((fj - 0.5) / 8.0 * 0.55 - gpos) * ((fj - 0.5) / 8.0 * 0.55 - gpos) / 0.0045) * glintGate;
        float lum = dot(s.rgb, vec3(0.3, 0.59, 0.11));
        vec3 col = s.rgb * (faceOn ? 1.0 : 0.78) * (0.80 + 0.30 * flick) + bone * glt * lum * 1.1;
        acc = rh_over(acc, vec4(col * s.a, s.a));
      }
    }
    prev = qj;
    dirPrev = dir;
  }

  // ------------------------------------------------------------------ the hook, hung from the last joint
  {
    vec2 u = dirPrev;                                                // the chain's last direction
    vec2 nrm = vec2(u.y, -u.x);
    vec2 lp = p - qj;
    float la = dot(lp, u);
    float lb = dot(lp, nrm);
    const float Hh = 62.0;                                           // hook length in px
    float Hw = Hh * RH_HOOK_ASPECT;
    vec2 uv = vec2(0.5 + lb / Hw, (la + 4.0) / Hh);                  // the eye sits on the last joint
    if (uv.x >= -0.35 && uv.x <= 1.35 && uv.y >= -0.1 && uv.y <= 1.1) {
      float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      vec4 s = rh_tex(1, uv) * inside;
      vec2 uh = vec2(0.5 + (uv.x - 0.5) * 0.78, 0.5 + (uv.y - 0.5) * 0.86);
      float ha = rh_tex(1, uh).a * step(0.0, uh.x) * step(uh.x, 1.0) * step(0.0, uh.y) * step(uh.y, 1.0);
      halo = max(halo, ha);
      if (s.a > 0.003) {
        float glt = exp(-(0.58 + 0.42 * uv.y - gpos) * (0.58 + 0.42 * uv.y - gpos) / 0.0045) * glintGate;
        float lum = dot(s.rgb, vec3(0.3, 0.59, 0.11));
        vec3 col = s.rgb * (0.80 + 0.30 * flick) + bone * glt * lum * 1.4;
        acc = rh_over(acc, vec4(col * s.a, s.a));
      }
    }
  }

  // ------------------------------------------------------------------ put it together: the metal over a dark shade over the picture
  vec3 ink = vec3(0.025, 0.006, 0.01);
  float sh = clamp(halo * 0.62, 0.0, 0.62) * (1.0 - acc.a);
  vec3 outc = acc.rgb + ink * sh;
  float a = clamp(acc.a + sh, 0.0, 1.0);
  // a faint candle bloom on the air right next to the metal
  float bloom = clamp(halo * (1.0 - acc.a) * 0.10 * flick, 0.0, 0.2);
  outc += amber * bloom;
  a = clamp(a + bloom * 0.5, 0.0, 1.0);
  outc = min(outc, vec3(a));
  fragColor = vec4(outc, a) * qt_Opacity;
}
