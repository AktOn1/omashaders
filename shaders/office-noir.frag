#version 300 es
// category: Ambient
// desc: Office noir: cigarette smoke drifts through a dark room, one warm desk lamp pools low on the left and falls off to deep shadow, hard vignette, film grain and faint rain shimmer high up (animated)
// strength: 45
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;

float on_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float on_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(on_h(i), on_h(i + vec2(1.0, 0.0)), f.x), mix(on_h(i + vec2(0.0, 1.0)), on_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float on_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * on_n(p); p = p * 2.03 + 7.1; a *= 0.5; }
    return v;
}
float on_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// thin rain streaks sliding down the glass: one column per cell, each with its own speed and phase
float on_rain(vec2 p, float cols, float speed, float sd) {
    vec2 q = vec2(p.x * cols, p.y);
    float id = floor(q.x);
    float h = on_h(vec2(id, sd));
    if (h < 0.35) return 0.0;
    float x = fract(q.x) - 0.5 + (on_h(vec2(id, sd + 4.0)) - 0.5) * 0.5;
    float y = fract(q.y * (0.5 + h) - time * speed * (0.6 + 0.8 * h) + on_h(vec2(id, sd + 9.0)));
    float w = smoothstep(0.07, 0.0, abs(x));
    float tail = smoothstep(0.0, 0.5, y) * smoothstep(0.55, 0.45, y);      // a short streak with a fading tail
    return w * tail * (0.5 + 0.5 * on_h(vec2(id, sd + 2.0)));
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float S = STRENGTH;
    float k = S / 0.45;                                                   // 1.0 at the default strength
    vec2 sz = vec2(textureSize(tex, 0));
    float asp = sz.x / sz.y;
    vec2 p = vec2(uv.x * asp, uv.y);                                      // square-ish units, height = 1
    float top = 1.0 - uv.y;                                               // 1 at the top edge of the screen

    // the desk lamp, low on the left, with the faintest flicker
    vec2 lamp = vec2(0.13 * asp, 0.86);
    float flick = 1.0 + 0.025 * sin(time * 7.0) * sin(time * 2.3 + 1.0) + 0.015 * on_n(vec2(time * 9.0, 1.0));
    vec2 dl = (p - lamp) * vec2(0.82, 1.18);                               // the pool is wider than it is tall
    float d = length(dl);
    float pool = exp(-d * d * 2.4) * flick;                                // tight warm pool
    float wide = exp(-d * 1.15) * flick;                                   // long soft spill across the room

    // smoke: three slow, domain-warped layers rising and drifting right; thickest in the light, thin elsewhere
    vec2 sp = p * vec2(1.0, 1.15);
    vec2 w1 = vec2(on_fbm(sp * 1.6 + vec2(time * 0.020, -time * 0.035)), on_fbm(sp * 1.6 + vec2(5.0 - time * 0.015, time * 0.025)));
    float s1 = on_fbm(sp * 1.5 + (w1 - 0.5) * 1.1 + vec2(-time * 0.030, time * 0.040));
    float s2 = on_fbm(sp * 3.1 + (w1 - 0.5) * 0.9 + vec2(time * 0.045, time * 0.060) + 20.0);
    float smoke = smoothstep(0.40, 0.78, s1 * 0.68 + s2 * 0.32);
    smoke *= 0.55 + 0.45 * smoothstep(0.0, 0.8, 1.0 - uv.y + 0.3 * wide);      // more smoke low and near the lamp
    vec3 smokeCool = vec3(0.30, 0.36, 0.46);
    vec3 smokeWarm = vec3(0.95, 0.66, 0.38);
    vec3 smokeCol = mix(smokeCool, smokeWarm, clamp(wide * 1.4, 0.0, 1.0));

    // room light: cool, almost black blue at the edges, warm tungsten in the pool
    float lit = clamp(0.46 + 0.40 * wide + 0.30 * pool, 0.0, 1.0);          // how much of the picture survives
    float dark = mix(1.0, lit, clamp(0.95 * k, 0.0, 1.0));
    vec3 shade = mix(vec3(0.70, 0.82, 1.06), vec3(1.10, 0.96, 0.78), clamp(wide * 1.3 + pool * 0.5, 0.0, 1.0));
    vec3 g = c * dark * mix(vec3(1.0), shade, clamp(k, 0.0, 1.0));
    // the shadows are blue-black rather than just darker
    g += vec3(0.004, 0.010, 0.022) * (1.0 - lit) * k;

    // smoke catches the lamp, then veils the picture a little (never enough to hide text)
    float smokeAmt = smoke * (0.20 + 0.30 * wide) * k;
    g = mix(g, smokeCol * (0.62 + 0.8 * wide), smokeAmt);
    g += smokeWarm * smoke * pool * 0.045 * k;

    // lamp glow, a trace of bloom where the pool hits something bright
    g += vec3(1.0, 0.68, 0.34) * pool * 0.05 * k;
    g += vec3(1.0, 0.72, 0.40) * pool * on_luma(c) * 0.06 * k;

    // rain shimmer on the glass, only high up and fading by mid screen
    float rainMask = smoothstep(0.40, 0.95, top);
    float rain = on_rain(vec2(uv.x * asp * 0.6, uv.y), 90.0, 0.35, 1.0) + 0.7 * on_rain(vec2(uv.x * asp * 0.6 + 0.37, uv.y), 52.0, 0.22, 7.0);
    float sparkle = 0.75 + 0.25 * sin(time * 3.0 + uv.x * 80.0);
    g += vec3(0.50, 0.62, 0.80) * rain * rainMask * sparkle * 0.11 * k;

    // hard noir vignette: the corners fall into black quickly
    vec2 vc = (uv - vec2(0.5, 0.52)) * vec2(1.0, 1.05);
    float vr = length(vec2(vc.x * min(asp, 1.8) * 0.62, vc.y));
    float vig = 1.0 - smoothstep(0.40, 0.90, vr) * 0.55 * clamp(k, 0.0, 1.4);
    g *= mix(1.0, vig, 1.0);

    // a little less colour in the dark, like stock that cannot see into the shadows
    float l = on_luma(g);
    g = mix(vec3(l), g, mix(0.78, 1.0, smoothstep(0.0, 0.5, l)) + (1.0 - clamp(k, 0.0, 1.0)) * 0.22);

    // film grain: re-rolled 24 times a second, strongest in the mid tones
    float gt = floor(time * 24.0);
    float gr = on_h(uv * sz + vec2(gt * 1.37, gt * 0.91)) - 0.5;
    g += gr * 0.060 * k * (0.35 + 1.3 * l * (1.0 - l) * 2.0);

    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
