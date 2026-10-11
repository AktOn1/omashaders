#version 300 es
// target: window
// category: Glass
// desc: Blue swell: slow layered swells of pale blue mist rise along the bottom of the window with a thin crest of light, an overcast glow sits in one corner and the pointer leaves a faint cold lamp on the glass; calmer and bluer when the window is not focused, text stays crisp (static)
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float bs_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bs_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(bs_h(i), bs_h(i + vec2(1.0, 0.0)), f.x), mix(bs_h(i + vec2(0.0, 1.0)), bs_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float bs_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float D = max(surface_size.x, surface_size.y);
    float lum = bs_luma(c);
    float room = 1.0 - 0.9 * smoothstep(0.35, 0.95, lum);
    float K = mix(0.65, 1.0, act);

    // three swells of mist from the bottom edge, each with its own period and drift
    float fromB = surface_size.y - px.y;
    float H = clamp(surface_size.y * 0.30, 90.0, 260.0);
    vec3 mistCol = vec3(0.45, 0.58, 0.86);
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float edge = H * (0.30 + 0.30 * fk)
            + 14.0 * sin(px.x / (190.0 + 70.0 * fk) + sd * 9.0 + fk * 2.0)
            + 18.0 * (bs_n(vec2(px.x / (340.0 + 90.0 * fk) + sd * 7.0, fk * 4.0)) - 0.5);
        float cover = smoothstep(edge + 26.0, edge - 4.0, fromB);
        float crest = smoothstep(3.0, 0.0, abs(fromB - edge));
        c = mix(c, c * 0.88 + mistCol * 0.20, cover * (0.62 - 0.12 * fk) * K * room);
        c += vec3(0.55, 0.68, 0.95) * crest * (0.22 - 0.04 * fk) * K * room;
    }

    // overcast glow in one top corner
    vec2 corner = vec2(sd < 0.5 ? surface_size.x : 0.0, 0.0);
    float dc = length(px - corner) / D;
    c += vec3(0.50, 0.62, 0.90) * exp(-dc * dc / (2.0 * 0.26 * 0.26)) * 0.17 * K * room;

    // the pointer: a faint cold lamp on the glass
    vec2 mp = mouse - window_box.xy;
    float dm = length(px - mp);
    c += vec3(0.55, 0.68, 0.98) * exp(-dm * dm / (2.0 * 70.0 * 70.0)) * 0.13 * K * room;

    // cool tint on dark parts only
    float dark = 1.0 - smoothstep(0.10, 0.50, lum);
    c = mix(c, c * vec3(0.90, 0.97, 1.08) + vec3(0.002, 0.006, 0.020), 0.55 * dark * K);

    // focused windows get a thin pale line along the top
    c += vec3(0.55, 0.68, 0.98) * smoothstep(2.0, 0.0, px.y) * act * 0.07;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
