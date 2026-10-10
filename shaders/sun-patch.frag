#version 300 es
// target: window
// category: Light
// desc: Sun patch: a soft slanting patch of late-afternoon sun lies on the window with the faint shadow of a window frame across it; fuller and brighter on the focused window, and its place shifts with each window (static)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec4 window_box;
uniform vec2 resolution;
layout(location = 0) out vec4 fragColor;

// signed distance to a box (negative inside)
float sp_box(vec2 q, vec2 h) {
    vec2 d = abs(q) - h;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                      // un-premultiply; the composer re-applies alpha
    float S = STRENGTH;
    float K = S * 1.8182;                                     // 1.0 at the default strength
    float act = is_active;
    float sd = fract(seed);

    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = uv * size;
    float u = sqrt(size.x * size.y);                          // a length that scales with the window

    // where the patch lies: a seed-dependent spot in the upper-left two thirds, nudged by where the window sits on the monitor
    // (so neighbouring windows catch different parts of the same sun)
    vec2 wp = window_box.xy / max(resolution, vec2(1.0));
    vec2 centre = size * vec2(0.30 + 0.26 * fract(sd * 3.7 + 0.13), 0.34 + 0.18 * fract(sd * 5.3 + 0.41));
    centre += (vec2(0.5) - wp) * size * vec2(0.22, 0.14);

    // the patch: a slanted (sheared) soft rectangle, bigger and fuller when the window is focused
    vec2 q = px - centre;
    q.x -= q.y * 0.55;                                        // sun slants in from the upper left
    vec2 hb = vec2(0.30 * size.x, 0.30 * size.y) * mix(0.82, 1.0, act);
    hb = max(hb, vec2(0.18 * u));
    float blur = 0.085 * u;
    float d = sp_box(q, hb - vec2(blur));
    float lit = 1.0 - smoothstep(-blur, blur, d);

    // the faint shadow of the window frame: a cross of mullions (two pane columns, two pane rows) with soft edges
    vec2 bw = vec2(0.016 * u);
    float bar_v = 1.0 - smoothstep(bw.x, bw.x + 0.020 * u, abs(q.x - 0.0));
    float bar_h = 1.0 - smoothstep(bw.x, bw.x + 0.020 * u, abs(q.y + 0.08 * hb.y));
    float bars = max(bar_v * smoothstep(hb.y, hb.y * 0.6, abs(q.y)), bar_h) * smoothstep(hb.x * 1.05, hb.x * 0.6, abs(q.x));
    float glow = lit * (1.0 - 0.60 * bars);                   // light with the frame's shadow cut out of it
    // the light is stronger toward the middle of the patch
    float core = smoothstep(0.0, 0.9, lit) * (1.0 - smoothstep(0.0, 1.3, length(q / hb)) * 0.4);

    // outside the sun: very slightly dimmer and warmer-brown, so the sunny part reads without darkening text
    float shade = 1.0 - lit;
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 warm = vec3(1.0, 0.80, 0.48);

    c = mix(c, c * vec3(0.95, 0.93, 0.90), shade * 0.35 * K * (1.0 - 0.5 * act));
    c = mix(c, c * vec3(1.06, 1.0, 0.84), glow * 0.55 * min(K, 1.4));
    // additive honey light, a little more on dark windows (keeps text contrast on light ones)
    float lift = mix(0.075, 0.13, act) * core * (1.0 - 0.60 * bars) * K;
    c += warm * lift * (0.65 + 0.7 * (1.0 - lum)) * lit;

    c *= 1.0 - 0.08 * bars * lit * min(K, 1.4);                 // the frame's shadow itself, soft and faint

    // sunlit top-left edge of the window, like light spilling over the frame
    float edge = min(px.x, px.y);
    float rim = smoothstep(2.5, 0.0, edge);
    c += warm * rim * mix(0.02, 0.07, act) * K;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
