#version 300 es
// target: window
// category: Glass
// desc: Pond glass: the window sits under a thin film of water, very soft wavy bands of light, a faint green tint along the bottom edge and calm rings around the pointer; the focused window is brighter and each window has its own ripples (static)
// strength: 55
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

float pg_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pg_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(pg_h(i), pg_h(i + vec2(1.0, 0.0)), f.x), mix(pg_h(i + vec2(0.0, 1.0)), pg_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 pg_rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                           // un-premultiply; the composer re-applies alpha
    float S = STRENGTH;
    float K = S * 1.8182;                                          // 1.0 at the default strength
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;

    // each window has its own water: the pattern is shifted and turned by the seed
    vec2 q = pg_rot(px, sd * 6.283) + sd * vec2(1700.0, 900.0);

    // very soft wavy light bands (two crossing swells, bent by a slow warp), the way light wobbles under a thin film of water
    float warp = pg_n(q / 330.0 + 3.0) * 2.0 + pg_n(q / 140.0 + 9.0) * 0.7;
    float b1 = sin(q.x / (95.0 + 40.0 * sd) + warp * 2.4 + sd * 20.0);
    float b2 = sin(pg_rot(q, 1.05).x / (130.0 + 50.0 * sd) + warp * 1.9 + 4.0);
    float bands = 0.5 + 0.5 * (b1 * 0.6 + b2 * 0.4);
    bands = smoothstep(0.35, 0.95, bands);                         // soft bright ridges, wide dark troughs

    // calm rings around the pointer, fading with distance (the pointer is a finger resting on the surface)
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * surface_size;
    float dm = length(px - mp);
    float rings = sin(dm / (17.0 + 6.0 * sd) - 1.5) * exp(-dm / 230.0) * smoothstep(8.0, 30.0, dm);
    rings = 0.5 + 0.5 * rings;
    float ringLight = smoothstep(0.55, 1.0, rings) * exp(-dm / 260.0);

    // light: pale water-green, a little stronger in the focused window
    vec3 lightCol = vec3(0.70, 1.0, 0.88);
    float lift = (mix(0.046, 0.075, act) * bands + mix(0.030, 0.052, act) * ringLight) * K;
    c += lightCol * lift * (1.0 - 0.5 * dot(c, vec3(0.3333)));
    // the troughs are a hair darker, so the bands read without hurting text
    c *= 1.0 - 0.030 * (1.0 - bands) * K;

    // faint green tint pooling at the bottom edge, thicker the lower you go
    float low = smoothstep(0.55, 1.0, uv.y);
    c = mix(c, c * vec3(0.88, 1.02, 0.94) + vec3(0.0, 0.026, 0.020), low * 0.7 * min(K, 1.5));
    // a slight cool-green cast overall so inactive windows still look "under water"
    c = mix(c, c * vec3(0.96, 1.01, 0.99), 0.6 * min(K, 1.5) * (1.0 - 0.5 * act));

    // thin bright water line along the edges (surface tension), stronger when focused
    float edge = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
    float rim = smoothstep(2.2, 0.0, edge);
    c += lightCol * rim * mix(0.03, 0.09, act) * K * (0.6 + 0.4 * bands);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
