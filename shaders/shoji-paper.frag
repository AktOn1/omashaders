#version 300 es
// target: window
// category: Light
// desc: Shoji paper: the window becomes a thin paper screen, fine fibre texture, a faint grid of wooden slats and warm light from behind that is stronger in the focused window; every window gets its own fibres and glow (static)
// strength: 60
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float sj_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sj_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sj_h(i), sj_h(i + vec2(1.0, 0.0)), f.x), mix(sj_h(i + vec2(0.0, 1.0)), sj_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 sj_rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                           // un-premultiply; the composer re-applies alpha
    float S = STRENGTH;
    float K = S * 1.6667;                                          // 1.0 at the default strength
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;

    // slat grid: whole cells, so the frame always closes at the window edge (about 260 x 190 px per cell)
    vec2 cells = max(vec2(2.0), floor(surface_size / vec2(260.0, 190.0) + 0.5));
    vec2 cs = surface_size / cells;
    vec2 cu = px / cs;
    vec2 f = fract(cu);
    vec2 dpx = min(f, 1.0 - f) * cs;                               // distance to the nearest slat, in pixels
    float dline = min(dpx.x, dpx.y);
    float slat = smoothstep(1.9, 0.5, dline);                      // the wooden slat itself
    float halo = smoothstep(7.0, 1.0, dline) * (1.0 - slat);       // paper next to wood is a little shadowed
    // a finer second lattice inside each cell (kumiko), much fainter
    vec2 f2 = fract(cu * vec2(3.0, 2.0));
    vec2 d2 = min(f2, 1.0 - f2) * cs / vec2(3.0, 2.0);
    float fine = smoothstep(1.2, 0.2, min(d2.x, d2.y)) * (1.0 - slat);

    // fibres: stretched, slightly tilted noise at two scales, different for every window
    vec2 q = sj_rot(px, 0.35 + sd * 1.2) + sd * 400.0;
    float fib = sj_n(q * vec2(0.55, 0.06)) * 0.55 + sj_n(sj_rot(q, 1.3) * vec2(0.40, 0.05) + 7.0) * 0.45;
    float mott = sj_n(px / 90.0 + sd * 17.0);                      // slow thickness variation of the paper
    fib = fib - 0.5;

    // warm light from behind: a glow pooling low in the window and drifting with the seed, plus a mild glow in every cell
    float lampx = 0.25 + 0.5 * sd;
    float pool = exp(-pow((uv.x - lampx) * 1.1, 2.0) * 3.0) * smoothstep(0.2, 1.0, uv.y);
    float cellGlow = 1.0 - smoothstep(0.0, 0.75, length((f - 0.5) * vec2(1.0, 1.1)));
    float glow = 0.55 * pool + 0.45 * cellGlow;
    vec3 warm = vec3(1.0, 0.76, 0.42);
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));

    // paper: a faint warm cast, fibres, slight mottling
    c = mix(c, c * vec3(1.05, 1.00, 0.90), 0.7 * min(K, 1.5));
    c *= 1.0 + fib * 0.07 * K + (mott - 0.5) * 0.04 * K;
    // light behind the paper, additive and gentle so text keeps its contrast
    float lift = mix(0.060, 0.115, act) * K * (0.40 + 0.85 * glow);
    c += warm * lift * (0.65 + 0.7 * (1.0 - lum));
    // the wooden slats: dark warm brown, with the shadowed paper beside them
    c = mix(c, c * vec3(0.62, 0.50, 0.38), slat * 0.50 * min(K, 1.4));
    c *= 1.0 - 0.07 * halo * K - 0.035 * fine * K;
    c += warm * slat * 0.010 * K * act;                            // light leaking round the wood in the focused window
    // the outer frame is a little heavier
    float edge = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
    c = mix(c, c * vec3(0.55, 0.43, 0.32), smoothstep(3.2, 1.2, edge) * 0.55 * min(K, 1.4));

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
