#version 300 es
// target: window
// category: Light
// desc: Sunbeam pane: soft warm rays fan out from one top corner of the window and a pale sun glow lifts the corner; the pointer leans the rays, the focused window is brighter and gets a thin golden line on top, text stays crisp (static)
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

float sp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sp_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sp_h(i), sp_h(i + vec2(1.0, 0.0)), f.x), mix(sp_h(i + vec2(0.0, 1.0)), sp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float D = max(surface_size.x, surface_size.y);
    float lum = sp_luma(c);
    float room = 1.0 - 0.85 * smoothstep(0.40, 0.95, lum);
    float K = mix(0.65, 1.0, act);

    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0));
    float lean = clamp(mp.x - 0.5, -1.0, 1.0) * 0.18;

    // the sun is just outside one top corner (left or right by seed)
    float side = sd < 0.5 ? 0.0 : 1.0;
    vec2 sun = vec2(side * surface_size.x + (side < 0.5 ? -0.04 : 0.04) * D, -0.05 * D);
    vec2 d = px - sun;
    float r = length(d) / D;
    float ang = atan(d.y, d.x * (side < 0.5 ? 1.0 : -1.0));            // mirrored for the right corner
    // 7 broad rays, each a little uneven, fading with distance
    float rays = 0.5 + 0.5 * sin(ang * 9.0 + lean * 9.0 + sd * 6.0 + 0.7 * sin(ang * 3.0 + sd * 11.0));
    rays = smoothstep(0.40, 1.0, rays);
    rays *= 0.7 + 0.3 * sp_n(vec2(ang * 6.0 + sd * 9.0, r * 3.0));
    rays *= exp(-r * 1.9);
    vec3 warm = vec3(1.0, 0.82, 0.46);
    c += warm * rays * 0.42 * K * room;
    // the sun glow itself
    c += vec3(1.0, 0.86, 0.55) * exp(-r * r / (2.0 * 0.16 * 0.16)) * 0.30 * K * room;
    // light warms what it falls on
    c = mix(c, c * vec3(1.05, 1.01, 0.92), rays * 0.6 * K);

    // a faint warm bounce along the bottom edge, like light off a table
    float fromB = surface_size.y - px.y;
    c += vec3(1.0, 0.78, 0.50) * exp(-fromB / 60.0) * 0.05 * K * room;

    // the focused window gets a thin golden line along its top edge
    c += vec3(1.0, 0.80, 0.38) * smoothstep(2.0, 0.0, px.y) * act * 0.12;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
